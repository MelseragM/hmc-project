import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { UsersDbConfig } from '../config/configuration';
import { MssqlQueryError, MssqlUnavailableException } from './mssql.error';

/** Result of a data-modifying statement. */
export interface MssqlExecuteResult<T = Record<string, any>> {
  rowsAffected: number;
  /** Rows returned by an OUTPUT clause, when present. */
  rows: T[];
}

/** Connectivity probe report for /health/users-db (mirrors OracleDiagnostics). */
export interface MssqlDiagnostics {
  enabled: boolean;
  connected: boolean;
  latencyMs: number | null;
  connection: {
    user: string;
    server: string;
    database: string;
    poolMin: number;
    poolMax: number;
    encrypt: boolean;
  };
  pool: { size: number; available: number; borrowed: number; pending: number } | null;
  server: { version: string; dbTime: string } | null;
  error: { message: string; code?: string } | null;
  checkedAt: string;
}

/**
 * Single `mssql` connection pool for the Users/Sanaad SQL Server database —
 * the second database wired into the app (sibling of OracleService, same
 * disabled/missing-credentials boot semantics). Backs the auth cycle
 * (HMC_Sanad_DeviceRegn_tbl, HMC_RHAP_OTP_tbl) and the API-1 healthcheck
 * tables (HMC_Sanad_AppDownTime_tbl / HMC_Sanad_App_Update_tbl).
 *
 * Exposes parameterized primitives only — all values go through named
 * `@params`, never string interpolation.
 */
@Injectable()
export class MssqlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MssqlService.name);
  private pool: sql.ConnectionPool | undefined;
  private readonly cfg: UsersDbConfig;
  /** Monotonic counter so each call's log lines can be correlated. */
  private callSeq = 0;

  /** Param keys whose values must never be logged. */
  private static readonly SENSITIVE_PARAM = /(mpin|password|pwd|otp|secret|token)/i;

  constructor(config: ConfigService) {
    this.cfg = config.getOrThrow<UsersDbConfig>('usersDb');
  }

  async onModuleInit(): Promise<void> {
    if (this.cfg.disabled) {
      this.logger.warn('USERS_DB_DISABLED=true — Users DB pool not created.');
      return;
    }
    if (!this.cfg.host || !this.cfg.database || !this.cfg.user) {
      this.logger.warn(
        'Users DB host/database/user missing — pool not created. Auth-cycle DB calls will fail.',
      );
      return;
    }
    try {
      this.pool = await new sql.ConnectionPool({
        server: this.cfg.host,
        port: this.cfg.port,
        database: this.cfg.database,
        user: this.cfg.user,
        password: this.cfg.password,
        pool: { min: this.cfg.poolMin, max: this.cfg.poolMax },
        options: {
          encrypt: this.cfg.encrypt,
          trustServerCertificate: this.cfg.trustServerCertificate,
        },
        requestTimeout: this.cfg.requestTimeoutMs,
        connectionTimeout: this.cfg.connectTimeoutMs,
      }).connect();
      this.pool.on('error', (err) => this.logger.error(`Users DB pool error: ${err.message}`));
      this.logger.log(
        `Users DB pool created (min=${this.cfg.poolMin}, max=${this.cfg.poolMax}) → ${this.cfg.host}:${this.cfg.port}/${this.cfg.database}`,
      );
      await this.verifyConnectivity();
    } catch (err) {
      // Not rethrown — see the note in OracleService.onModuleInit. A wrong
      // Users DB host/password must not take Oracle-backed endpoints down with
      // it. getPool() already raises MssqlUnavailableException per request and
      // /health reports usersDb.reachable = false.
      this.logger.error(
        `Failed to create Users DB pool: ${(err as Error).message} — starting without it; ` +
          'auth-cycle DB calls will answer 503 until the configuration is fixed.',
      );
    }
  }

  /**
   * Startup probe: run a real query so the boot log states unambiguously
   * whether the Users DB is usable (a pool can connect yet still fail on
   * queries — wrong DB, missing grants). Logs only; never blocks boot.
   */
  private async verifyConnectivity(): Promise<void> {
    try {
      const started = Date.now();
      const result = await this.pool!.request().query<{ dbTime: Date }>(
        'SELECT SYSDATETIMEOFFSET() AS dbTime',
      );
      this.logger.log(
        `Users DB connectivity verified in ${Date.now() - started}ms (server time: ${String(result.recordset[0]?.dbTime ?? 'unknown')})`,
      );
    } catch (err) {
      this.logger.error(
        `Users DB pool connected but probe query FAILED — auth-cycle calls will fail: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.logger.log('Users DB pool closed.');
    }
  }

  /** A usable pool exists. Callers gate real queries on this. */
  isEnabled(): boolean {
    return this.pool !== undefined;
  }

  /** Configured to be used, pool up or not — see OracleService.isConfigured. */
  isConfigured(): boolean {
    return (
      !this.cfg.disabled &&
      Boolean(this.cfg.host) &&
      Boolean(this.cfg.database) &&
      Boolean(this.cfg.user)
    );
  }

  private getPool(): sql.ConnectionPool {
    if (!this.pool) {
      throw new MssqlUnavailableException('The users database is currently unavailable.');
    }
    return this.pool;
  }

  /** Parameterized SELECT — returns mapped rows. */
  async query<T = Record<string, any>>(
    statement: string,
    params: Record<string, unknown> = {},
  ): Promise<T[]> {
    const result = await this.run(statement, params);
    return (result.recordset ?? []) as T[];
  }

  /** Parameterized INSERT/UPDATE/DELETE — returns rows affected (+ OUTPUT rows). */
  async execute<T = Record<string, any>>(
    statement: string,
    params: Record<string, unknown> = {},
  ): Promise<MssqlExecuteResult<T>> {
    const result = await this.run(statement, params);
    return {
      rowsAffected: result.rowsAffected.reduce((a, b) => a + b, 0),
      rows: (result.recordset ?? []) as T[],
    };
  }

  private async run(
    statement: string,
    params: Record<string, unknown>,
  ): Promise<sql.IResult<Record<string, any>>> {
    const id = ++this.callSeq;
    const started = Date.now();
    const label = this.describeSql(statement);
    this.logger.log(`[mssql#${id}] → ${label} params=${this.formatParams(params)}`);
    const request = this.getPool().request();
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value as sql.ISqlType | unknown);
    }
    try {
      const result = await request.query(statement);
      const ms = Date.now() - started;
      const rows = result.recordset?.length ?? 0;
      this.logger.log(
        `[mssql#${id}] done ${label} ${rows} row(s), ${result.rowsAffected} affected (${ms}ms)`,
      );
      return result;
    } catch (err) {
      const ms = Date.now() - started;
      const wrapped = MssqlQueryError.from(err);
      this.logger.error(`[mssql#${id}] FAILED ${label} after ${ms}ms: ${wrapped.message}`);
      throw wrapped;
    }
  }

  /** Short label for a statement: the table read or written. */
  private describeSql(statement: string): string {
    const compact = statement.replace(/\s+/g, ' ').trim();
    const target =
      /\bfrom\s+([a-z0-9_$.\[\]]+)/i.exec(compact) ??
      /\b(?:update|insert\s+into|delete\s+from)\s+([a-z0-9_$.\[\]]+)/i.exec(compact);
    if (target) return target[1].toUpperCase();
    return compact.length > 60 ? `${compact.slice(0, 57)}...` : compact;
  }

  /** Lightweight readiness check for the /health endpoint. */
  async ping(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      await this.pool.request().query('SELECT 1 AS ok');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Full connectivity probe for the /health/users-db endpoint. Never throws:
   * failures are captured in `error` so the caller can report exactly why the
   * database is unreachable. Mirrors OracleService.diagnose.
   */
  async diagnose(): Promise<MssqlDiagnostics> {
    const diag: MssqlDiagnostics = {
      enabled: this.pool !== undefined,
      connected: false,
      latencyMs: null,
      connection: {
        user: this.cfg.user || '(not set)',
        server: this.cfg.host ? `${this.cfg.host}:${this.cfg.port}` : '(not set)',
        database: this.cfg.database || '(not set)',
        poolMin: this.cfg.poolMin,
        poolMax: this.cfg.poolMax,
        encrypt: this.cfg.encrypt,
      },
      pool: null,
      server: null,
      error: null,
      checkedAt: new Date().toISOString(),
    };

    if (this.cfg.disabled) {
      diag.error = { message: 'USERS_DB_DISABLED=true — Users DB pool not created.' };
      return diag;
    }
    if (!this.pool) {
      diag.error = {
        message: 'Users DB host/database/user missing — pool not initialized.',
      };
      return diag;
    }

    const start = Date.now();
    try {
      const result = await this.pool.request().query<{ version: string; dbTime: Date }>(
        'SELECT @@VERSION AS version, SYSDATETIMEOFFSET() AS dbTime',
      );
      diag.latencyMs = Date.now() - start;
      diag.connected = true;
      const row = result.recordset[0];
      diag.server = {
        version: String(row?.version ?? 'unknown').split('\n')[0].trim(),
        dbTime: String(row?.dbTime ?? 'unknown'),
      };
      diag.pool = {
        size: this.pool.size,
        available: this.pool.available,
        borrowed: this.pool.borrowed,
        pending: this.pool.pending,
      };
      this.logger.log(`Users DB diagnose OK (${diag.latencyMs}ms)`);
    } catch (err) {
      diag.latencyMs = Date.now() - start;
      const wrapped = MssqlQueryError.from(err);
      diag.error = { message: wrapped.message, code: (err as { code?: string }).code };
      this.logger.error(`Users DB diagnose FAILED after ${diag.latencyMs}ms: ${wrapped.message}`);
    }
    return diag;
  }

  /** Loggable `{ k=v, ... }` with secrets redacted. */
  private formatParams(params: Record<string, unknown>): string {
    const keys = Object.keys(params);
    if (keys.length === 0) return '{}';
    const parts = keys.map((k) =>
      MssqlService.SENSITIVE_PARAM.test(k) ? `${k}=***` : `${k}=${String(params[k])}`,
    );
    return `{ ${parts.join(', ')} }`;
  }
}
