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
import { RequestContext } from '../http/request-context';
import { OracleLogStore } from './oracle-log.store';

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

/** Per-call context threaded through the start/success/error log lines. */
interface OracleCallLog {
  id: number;
  op: 'query' | 'call' | 'callCursor';
  label: string;
  started: number;
  sql: string;
  binds: Record<string, string>;
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
  /** Monotonic counter so each Oracle call's log lines can be correlated. */
  private callSeq = 0;

  /** Bind keys whose values must never be logged. */
  private static readonly SENSITIVE_BIND = /(mpin|password|pwd|otp|secret|token)/i;

  constructor(
    config: ConfigService,
    private readonly logStore: OracleLogStore,
  ) {
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
    const call = this.logCallStart('query', sql, binds);
    const conn = await this.getPool().getConnection();
    try {
      const result = await conn.execute<T>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      const rows = (result.rows as T[]) ?? [];
      this.logCallSuccess(call, { summary: `${rows.length} row(s)`, rowCount: rows.length });
      return rows;
    } catch (err) {
      throw this.logCallError(call, err);
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
    const call = this.logCallStart('call', plsql, binds);
    const conn = await this.getPool().getConnection();
    try {
      const result = await conn.execute(plsql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
        ...options,
      });
      const outBinds = (result.outBinds as T) ?? ({} as T);
      const outKeys = Object.keys(outBinds as object);
      this.logCallSuccess(call, { summary: `out={ ${outKeys.join(', ')} }`, outKeys });
      return outBinds;
    } catch (err) {
      throw this.logCallError(call, err);
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
    const call = this.logCallStart('callCursor', plsql, binds);
    const conn = await this.getPool().getConnection();
    try {
      const result = await conn.execute(plsql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
      });
      const outBinds = (result.outBinds ?? {}) as Record<string, oracledb.ResultSet<T>>;
      const cursor = outBinds[cursorBindName];
      if (!cursor) {
        this.logCallSuccess(call, { summary: 'no cursor', rowCount: 0 });
        return [];
      }
      const rows = (await cursor.getRows(0)) as T[];
      await cursor.close();
      this.logCallSuccess(call, { summary: `${rows?.length ?? 0} row(s)`, rowCount: rows?.length ?? 0 });
      return rows ?? [];
    } catch (err) {
      throw this.logCallError(call, err);
    } finally {
      await this.safeClose(conn);
    }
  }

  // ── Oracle call logging ─────────────────────────────────────
  // Every Oracle function call is logged (start + outcome) so failing/hanging
  // calls can be traced to the exact object and (sanitized) binds. Correlated
  // by a per-call id `[ora#N]`.

  private logCallStart(
    op: OracleCallLog['op'],
    sql: string,
    binds: oracledb.BindParameters,
  ): OracleCallLog {
    const id = ++this.callSeq;
    const entry: OracleCallLog = {
      id,
      op,
      label: this.describeSql(sql),
      started: Date.now(),
      sql: this.compactSql(sql),
      binds: this.sanitizeBinds(binds),
    };
    this.logger.log(`[ora#${id}] ${op} → ${entry.label} binds=${this.formatBinds(entry.binds)}`);
    this.logger.debug(`[ora#${id}] SQL: ${entry.sql}`);
    return entry;
  }

  private logCallSuccess(
    entry: OracleCallLog,
    result: { summary: string; rowCount?: number; outKeys?: string[] },
  ): void {
    const ms = Date.now() - entry.started;
    this.logger.log(`[ora#${entry.id}] ${entry.op} done ${entry.label} ${result.summary} (${ms}ms)`);
    this.recordEntry(entry, ms, {
      status: 'success',
      rowCount: result.rowCount,
      outKeys: result.outKeys,
    });
  }

  private logCallError(entry: OracleCallLog, err: unknown): OracleQueryError {
    const ms = Date.now() - entry.started;
    const wrapped = OracleQueryError.from(err);
    const code = wrapped.oraCode ? ` [ORA-${wrapped.oraCode}]` : '';
    this.logger.error(
      `[ora#${entry.id}] ${entry.op} FAILED ${entry.label} after ${ms}ms${code}: ${wrapped.message}`,
    );
    this.recordEntry(entry, ms, {
      status: 'error',
      oraCode: wrapped.oraCode,
      error: wrapped.message,
    });
    return wrapped;
  }

  /** Persist a structured record to the in-memory store served by the diagnostics API. */
  private recordEntry(
    entry: OracleCallLog,
    durationMs: number,
    outcome: {
      status: 'success' | 'error';
      rowCount?: number;
      outKeys?: string[];
      oraCode?: number;
      error?: string;
    },
  ): void {
    const ctx = RequestContext.get();
    this.logStore.record({
      id: entry.id,
      timestamp: new Date().toISOString(),
      op: entry.op,
      object: entry.label,
      status: outcome.status,
      durationMs,
      rowCount: outcome.rowCount,
      outKeys: outcome.outKeys,
      oraCode: outcome.oraCode,
      error: outcome.error,
      correlationId: ctx?.correlationId,
      method: ctx?.method,
      path: ctx?.path,
      binds: entry.binds,
      sql: entry.sql,
    });
  }

  /** Short label for a statement: the view/table read or the procedure invoked. */
  private describeSql(sql: string): string {
    const compact = this.compactSql(sql);
    const from = /\bfrom\s+([a-z0-9_$.]+)/i.exec(compact);
    if (from) return from[1].toUpperCase();
    const proc = /\b(?:begin\s+)?([a-z0-9_$]+(?:\.[a-z0-9_$]+)?)\s*\(/i.exec(compact);
    if (proc) return proc[1].toUpperCase();
    return compact.length > 60 ? `${compact.slice(0, 57)}...` : compact;
  }

  private compactSql(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  /** Produce a loggable, safe key→value map: OUT binds as `<OUT>`, secrets redacted. */
  private sanitizeBinds(binds: oracledb.BindParameters): Record<string, string> {
    const record = (binds ?? {}) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      out[key] = this.formatBindValue(key, value);
    }
    return out;
  }

  /** Render a sanitized bind map as `{ k=v, ... }` for the console line. */
  private formatBinds(binds: Record<string, string>): string {
    const keys = Object.keys(binds);
    if (keys.length === 0) return '{}';
    return `{ ${keys.map((k) => `${k}=${binds[k]}`).join(', ')} }`;
  }

  private formatBindValue(key: string, value: unknown): string {
    if (OracleService.SENSITIVE_BIND.test(key)) return '***';
    if (value !== null && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      if ('dir' in v) {
        if (v.dir === oracledb.BIND_OUT) return '<OUT>';
        if (v.dir === oracledb.BIND_INOUT) return `<INOUT ${this.formatScalar(v.val)}>`;
        return this.formatScalar(v.val);
      }
    }
    return this.formatScalar(value);
  }

  private formatScalar(value: unknown): string {
    if (value === null || value === undefined) return String(value);
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    return s.length > 120 ? `${s.slice(0, 117)}...` : s;
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
