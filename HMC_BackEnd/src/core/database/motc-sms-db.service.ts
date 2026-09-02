import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { MotcSmsConfig } from '../config/configuration';
import { MssqlDiagnostics, MssqlExecuteResult } from './mssql.service';
import { MssqlQueryError, MssqlUnavailableException } from './mssql.error';

/**
 * Connection pool for the MOTC SMS gateway SQL Server (`MOTC_SMS` database,
 * named instance with a static port — e.g. HSHCL7VVSQ1\SQL1:9001). The third
 * database next to Oracle and the Users DB; it holds `MOTC_SMS_PushTable`,
 * the government SMS outbox that now carries (and validates) the login OTPs.
 *
 * Pool lifecycle mirrors MssqlService (client request 2026-09-02, same as the
 * Users DB on 2026-08-31): the pool is created DIRECTLY —
 * `MOTC_SMS_DB_DISABLED` is no longer honored — eagerly at boot and, when
 * that fails or the DB is down, retried lazily on the next call
 * (single-flight, so concurrent requests share one attempt). A boot-time
 * failure never crashes the app; a later successful attempt heals without a
 * restart. The only unrecoverable state is missing configuration, and the
 * error then names the exact env vars. /health/motc-sms-db triggers the same
 * retry and reports the real blocker. Parameterized primitives only (named
 * `@params`).
 *
 * Log redaction is stricter than the Users DB pool: `MessageBody` carries the
 * raw OTP and `ToAddress` the full phone number, so both are masked.
 */
@Injectable()
export class MotcSmsDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MotcSmsDbService.name);
  private pool: sql.ConnectionPool | undefined;
  /** In-flight creation attempt — shared so concurrent calls don't stampede. */
  private creating: Promise<sql.ConnectionPool> | undefined;
  private readonly cfg: MotcSmsConfig;
  /** Monotonic counter so each call's log lines can be correlated. */
  private callSeq = 0;

  /** Param keys whose values must never be logged (OTP body + phone number). */
  private static readonly SENSITIVE_PARAM =
    /(mpin|password|pwd|otp|secret|token|messagebody|toaddress|phone)/i;

  constructor(config: ConfigService) {
    this.cfg = config.getOrThrow<MotcSmsConfig>('motcSms');
  }

  async onModuleInit(): Promise<void> {
    // Eager attempt so the boot log states the pool's fate — but never fatal:
    // a wrong host/password must not take the rest of the API down, and
    // ensurePool() retries on first use anyway.
    try {
      await this.ensurePool();
    } catch (err) {
      this.logger.error(
        `MOTC SMS DB pool not created at boot: ${(err as Error).message} — ` +
          'OTP send/validate will retry the connection on demand.',
      );
    }
  }

  /** MOTC_SMS_DB_* env vars without which no connection is possible. */
  private missingConfig(): string[] {
    const missing: string[] = [];
    if (!this.cfg.host) missing.push('MOTC_SMS_DB_HOST');
    if (!this.cfg.database) missing.push('MOTC_SMS_DB_NAME');
    if (!this.cfg.user) missing.push('MOTC_SMS_DB_USER');
    return missing;
  }

  /**
   * The pool, created on demand. Throws MssqlUnavailableException (→ 503)
   * with the precise reason when it cannot be.
   */
  private async ensurePool(): Promise<sql.ConnectionPool> {
    if (this.pool) return this.pool;
    if (this.creating) return this.creating;

    const missing = this.missingConfig();
    if (missing.length) {
      throw new MssqlUnavailableException(
        `The SMS gateway database is not configured — set ${missing.join(', ')} in the environment.`,
      );
    }

    // `HOST\INSTANCE` — with a static port (the client-provided setup) the
    // instance name must NOT be passed or tedious would consult the SQL
    // Browser instead; port 0 opts into instance-name resolution.
    const [server, instanceName] = this.cfg.host.split('\\');
    this.creating = new sql.ConnectionPool({
      server,
      ...(this.cfg.port > 0 ? { port: this.cfg.port } : {}),
      database: this.cfg.database,
      user: this.cfg.user,
      password: this.cfg.password,
      pool: { min: this.cfg.poolMin, max: this.cfg.poolMax },
      options: {
        encrypt: this.cfg.encrypt,
        trustServerCertificate: this.cfg.trustServerCertificate,
        ...(this.cfg.port > 0 ? {} : { instanceName }),
      },
      requestTimeout: this.cfg.requestTimeoutMs,
      connectionTimeout: this.cfg.connectTimeoutMs,
    }).connect();

    try {
      const pool = await this.creating;
      pool.on('error', (err) => this.logger.error(`MOTC SMS DB pool error: ${err.message}`));
      this.pool = pool;
      this.logger.log(
        `MOTC SMS DB pool created (min=${this.cfg.poolMin}, max=${this.cfg.poolMax}) → ${this.cfg.host}:${this.cfg.port}/${this.cfg.database}`,
      );
      await this.verifyConnectivity();
      return pool;
    } catch (err) {
      this.logger.error(`Failed to create MOTC SMS DB pool: ${(err as Error).message}`);
      throw new MssqlUnavailableException(
        `The SMS gateway database is currently unavailable: ${(err as Error).message}`,
      );
    } finally {
      this.creating = undefined;
    }
  }

  /** Startup probe — logs only, never blocks boot (mirrors MssqlService). */
  private async verifyConnectivity(): Promise<void> {
    try {
      const started = Date.now();
      const result = await this.pool!.request().query<{ dbTime: Date }>(
        'SELECT SYSDATETIMEOFFSET() AS dbTime',
      );
      this.logger.log(
        `MOTC SMS DB connectivity verified in ${Date.now() - started}ms (server time: ${String(result.recordset[0]?.dbTime ?? 'unknown')})`,
      );
    } catch (err) {
      this.logger.error(
        `MOTC SMS DB pool connected but probe query FAILED — OTP calls will fail: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.logger.log('MOTC SMS DB pool closed.');
    }
  }

  /** A usable pool exists. Callers gate real queries on this. */
  isEnabled(): boolean {
    return this.pool !== undefined;
  }

  /** Configured to be used, pool up or not — see OracleService.isConfigured. */
  isConfigured(): boolean {
    return this.missingConfig().length === 0;
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
    this.logger.log(`[motc#${id}] → ${label} params=${this.formatParams(params)}`);
    const request = (await this.ensurePool()).request();
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value as sql.ISqlType | unknown);
    }
    try {
      const result = await request.query(statement);
      const ms = Date.now() - started;
      const rows = result.recordset?.length ?? 0;
      this.logger.log(
        `[motc#${id}] done ${label} ${rows} row(s), ${result.rowsAffected} affected (${ms}ms)`,
      );
      return result;
    } catch (err) {
      const ms = Date.now() - started;
      const wrapped = MssqlQueryError.from(err);
      this.logger.error(`[motc#${id}] FAILED ${label} after ${ms}ms: ${wrapped.message}`);
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

  /** Lightweight readiness check for the /health endpoint (creates the pool on demand). */
  async ping(): Promise<boolean> {
    try {
      await (await this.ensurePool()).request().query('SELECT 1 AS ok');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Full connectivity probe for /health/motc-sms-db. Never throws — failures
   * are captured in `error`. Mirrors MssqlService.diagnose.
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

    // Bring the pool up on demand (lazy creation) so /health/motc-sms-db
    // reports the REAL blocker: missing env vars or the exact connect error.
    let pool: sql.ConnectionPool;
    try {
      pool = await this.ensurePool();
      diag.enabled = true;
    } catch (err) {
      diag.error = { message: (err as Error).message };
      return diag;
    }

    const start = Date.now();
    try {
      const result = await pool.request().query<{ version: string; dbTime: Date }>(
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
        size: pool.size,
        available: pool.available,
        borrowed: pool.borrowed,
        pending: pool.pending,
      };
      this.logger.log(`MOTC SMS DB diagnose OK (${diag.latencyMs}ms)`);
    } catch (err) {
      diag.latencyMs = Date.now() - start;
      const wrapped = MssqlQueryError.from(err);
      diag.error = { message: wrapped.message, code: (err as { code?: string }).code };
      this.logger.error(
        `MOTC SMS DB diagnose FAILED after ${diag.latencyMs}ms: ${wrapped.message}`,
      );
    }
    return diag;
  }

  /** Loggable `{ k=v, ... }` with secrets redacted. */
  private formatParams(params: Record<string, unknown>): string {
    const keys = Object.keys(params);
    if (keys.length === 0) return '{}';
    const parts = keys.map((k) =>
      MotcSmsDbService.SENSITIVE_PARAM.test(k) ? `${k}=***` : `${k}=${String(params[k])}`,
    );
    return `{ ${parts.join(', ')} }`;
  }
}
