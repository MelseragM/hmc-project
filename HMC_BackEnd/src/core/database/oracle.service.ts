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
import { ERROR_MESSAGES, extractOraCode } from '@shared/constants/error-codes';
import { OracleQueryError } from './oracle.error';

/** Rich result of a connectivity probe used by the DB health-test endpoint. */
export interface OracleDiagnostics {
  /** Pool was successfully created at startup. */
  enabled: boolean;
  /** A live connection was obtained and a test query executed. */
  connected: boolean;
  /** Round-trip time (ms) for acquiring a connection + running the probe. */
  latencyMs: number | null;
  connection: { user: string; dsn: string; poolMin: number; poolMax: number };
  pool: { connectionsOpen: number; connectionsInUse: number } | null;
  server: { version: string; dbTime: string } | null;
  error: { message: string; oraCode?: number } | null;
  checkedAt: string;
}

/**
 * Single `node-oracledb` connection pool for the whole app. Runs in Thick mode
 * (Oracle Client libraries) when `ORACLE_THICK_MODE` is enabled, otherwise the
 * built-in Thin driver.
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
      this.enableThickModeIfConfigured();
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

  /**
   * Enable node-oracledb Thick mode by loading the Oracle Client libraries.
   * Must run before any pool/connection is created. Idempotent: skips if Thick
   * mode is already active (initOracleClient can only be called once).
   */
  private enableThickModeIfConfigured(): void {
    if (!this.cfg.thickMode) {
      this.logger.log('Oracle Thin mode (ORACLE_THICK_MODE=false).');
      return;
    }
    if (!oracledb.thin) {
      // Client already initialized (e.g. a previous pool in the same process).
      return;
    }
    try {
      oracledb.initOracleClient(this.cfg.libDir ? { libDir: this.cfg.libDir } : undefined);
      this.logger.log(
        `Oracle Thick mode enabled${this.cfg.libDir ? ` (libDir=${this.cfg.libDir})` : ''}.`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to enable Oracle Thick mode — are the Oracle Client libraries installed` +
          `${this.cfg.libDir ? ` at ${this.cfg.libDir}` : ' and on the library path'}? ` +
          `${(err as Error).message}`,
      );
      throw err;
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

  /**
   * Full connectivity probe for the DB health-test endpoint. Never throws:
   * failures are captured in `error` (with the ORA code when available) so the
   * caller can report exactly why the database is unreachable.
   */
  async diagnose(): Promise<OracleDiagnostics> {
    const diag: OracleDiagnostics = {
      enabled: this.pool !== undefined,
      connected: false,
      latencyMs: null,
      connection: {
        user: this.cfg.user || '(not set)',
        dsn: this.cfg.dsn || '(not set)',
        poolMin: this.cfg.poolMin,
        poolMax: this.cfg.poolMax,
      },
      pool: null,
      server: null,
      error: null,
      checkedAt: new Date().toISOString(),
    };

    if (this.cfg.disabled) {
      diag.error = { message: 'ORACLE_DISABLED=true — connection pool not created.' };
      return diag;
    }
    if (!this.pool) {
      diag.error = {
        message:
          !this.cfg.user || !this.cfg.dsn
            ? 'Oracle credentials/DSN missing — pool not initialized.'
            : ERROR_MESSAGES.ORACLE_UNAVAILABLE,
      };
      return diag;
    }

    const start = Date.now();
    let conn: oracledb.Connection | undefined;
    try {
      conn = await this.pool.getConnection();
      const result = await conn.execute<{ DB_TIME: string }>(
        "SELECT TO_CHAR(SYSTIMESTAMP, 'YYYY-MM-DD\"T\"HH24:MI:SS.FF3TZH:TZM') AS DB_TIME FROM DUAL",
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      diag.latencyMs = Date.now() - start;
      diag.connected = true;
      diag.server = {
        version: conn.oracleServerVersionString,
        dbTime: result.rows?.[0]?.DB_TIME ?? '',
      };
    } catch (err) {
      diag.latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      diag.error = { message, oraCode: extractOraCode(message) };
    } finally {
      if (conn) await this.safeClose(conn);
      diag.pool = {
        connectionsOpen: this.pool.connectionsOpen,
        connectionsInUse: this.pool.connectionsInUse,
      };
    }
    return diag;
  }

  private async safeClose(conn: oracledb.Connection): Promise<void> {
    try {
      await conn.close();
    } catch (err) {
      this.logger.error(`Error closing Oracle connection: ${(err as Error).message}`);
    }
  }
}
