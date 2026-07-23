import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import oracledb = require('oracledb');
import { OracleConfig } from '../config/configuration';
import { ERROR_MESSAGES } from '@shared/constants/error-codes';
import { OracleQueryError } from './oracle.error';

/**
 * Single `node-oracledb` connection pool for the whole app (thin mode).
 * Exposes low-level primitives:
 *  - `query`   → parameterized SELECT against views/LOVs (Pattern A)
 *  - `call`    → anonymous PL/SQL block for `_PR`/`_PKG` with OUT binds (Pattern B/C)
 *  - `callCursor` → PL/SQL returning a REF CURSOR read into an array
 *
 * See Docs_Ai/Repository Pattern/README.md.
 */
@Injectable()
export class OracleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OracleService.name);
  private pool: oracledb.Pool | undefined;
  private readonly cfg: OracleConfig;

  constructor(config: ConfigService) {
    this.cfg = config.getOrThrow<OracleConfig>('oracle');
  }

  async onModuleInit(): Promise<void> {
    if (this.cfg.disabled) {
      this.logger.warn('ORACLE_DISABLED=true — connection pool not created.');
      return;
    }
    if (!this.cfg.user || !this.cfg.dsn) {
      this.logger.warn('Oracle credentials/DSN missing — pool not created. Data calls will fail.');
      return;
    }
    try {
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      oracledb.fetchAsString = [oracledb.CLOB];
      this.pool = await oracledb.createPool({
        user: this.cfg.user,
        password: this.cfg.password,
        connectString: this.cfg.dsn,
        poolMin: this.cfg.poolMin,
        poolMax: this.cfg.poolMax,
        poolTimeout: this.cfg.poolTimeout,
      });
      this.logger.log(
        `Oracle pool created (min=${this.cfg.poolMin}, max=${this.cfg.poolMax}) → ${this.cfg.dsn}`,
      );
    } catch (err) {
      this.logger.error(`Failed to create Oracle pool: ${(err as Error).message}`);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.close(5);
      this.logger.log('Oracle pool closed.');
    }
  }

  isEnabled(): boolean {
    return this.pool !== undefined;
  }

  private getPool(): oracledb.Pool {
    if (!this.pool) {
      throw new ServiceUnavailableException(ERROR_MESSAGES.ORACLE_UNAVAILABLE);
    }
    return this.pool;
  }

  /** Parameterized SELECT — returns mapped rows (object format). */
  async query<T = Record<string, any>>(
    sql: string,
    binds: oracledb.BindParameters = {},
  ): Promise<T[]> {
    const conn = await this.getPool().getConnection();
    try {
      const result = await conn.execute<T>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return (result.rows as T[]) ?? [];
    } catch (err) {
      throw OracleQueryError.from(err);
    } finally {
      await this.safeClose(conn);
    }
  }

  /** Execute an anonymous PL/SQL block; returns the OUT binds. */
  async call<T = Record<string, any>>(
    plsql: string,
    binds: oracledb.BindParameters,
    options: oracledb.ExecuteOptions = {},
  ): Promise<T> {
    const conn = await this.getPool().getConnection();
    try {
      const result = await conn.execute(plsql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
        ...options,
      });
      return (result.outBinds as T) ?? ({} as T);
    } catch (err) {
      throw OracleQueryError.from(err);
    } finally {
      await this.safeClose(conn);
    }
  }

  /**
   * Execute a PL/SQL block returning a REF CURSOR bound as `cursorBindName`
   * (default `:cursor`). Reads all rows then closes the cursor.
   */
  async callCursor<T = Record<string, any>>(
    plsql: string,
    binds: oracledb.BindParameters,
    cursorBindName = 'cursor',
  ): Promise<T[]> {
    const conn = await this.getPool().getConnection();
    try {
      const result = await conn.execute(plsql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
      });
      const outBinds = (result.outBinds ?? {}) as Record<string, oracledb.ResultSet<T>>;
      const cursor = outBinds[cursorBindName];
      if (!cursor) return [];
      const rows = (await cursor.getRows(0)) as T[];
      await cursor.close();
      return rows ?? [];
    } catch (err) {
      throw OracleQueryError.from(err);
    } finally {
      await this.safeClose(conn);
    }
  }

  /** Lightweight readiness check for the /health endpoint. */
  async ping(): Promise<boolean> {
    if (!this.pool) return false;
    const conn = await this.pool.getConnection();
    try {
      await conn.execute('SELECT 1 FROM DUAL');
      return true;
    } finally {
      await this.safeClose(conn);
    }
  }

  private async safeClose(conn: oracledb.Connection): Promise<void> {
    try {
      await conn.close();
    } catch (err) {
      this.logger.error(`Error closing Oracle connection: ${(err as Error).message}`);
    }
  }
}
