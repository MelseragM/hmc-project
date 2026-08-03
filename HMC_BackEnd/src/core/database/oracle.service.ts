import * as net from 'net';
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
  error: {
    /** Human-readable, actionable reason (network cause when the driver is opaque). */
    message: string;
    /** ORA/PLS code parsed from the driver message, when present. */
    oraCode?: number;
    /** Driver-level code (e.g. NJS-511) or socket errno, when present. */
    driverCode?: string;
    /** Result of a raw TCP reachability probe to the DSN host:port. */
    tcp?: { host: string; port: number; reachable: boolean; code?: string; timeMs: number };
  } | null;
  checkedAt: string;
}

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
      diag.error = await this.classifyConnectError(err);
    } finally {
      if (conn) await this.safeClose(conn);
      diag.pool = {
        connectionsOpen: this.pool.connectionsOpen,
        connectionsInUse: this.pool.connectionsInUse,
      };
    }
    return diag;
  }

  /**
   * Turn a connection failure into a specific, actionable diagnostic. The thin
   * driver frequently collapses network failures into an opaque "All options
   * tried"; we re-probe the TCP endpoint to report exactly *why* it failed
   * (refused / timed-out / no-route / DNS) instead of that generic message.
   */
  private async classifyConnectError(err: unknown): Promise<OracleDiagnostics['error']> {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const driverCode = this.extractDriverCode(err, rawMessage);
    const hostPort = this.parseHostPort(this.cfg.dsn);
    if (!hostPort) {
      return { message: rawMessage, oraCode: extractOraCode(rawMessage), driverCode };
    }
    const probe = await this.tcpProbe(hostPort.host, hostPort.port);
    const tcp = { host: hostPort.host, port: hostPort.port, ...probe };
    const message = probe.reachable
      ? `Reached ${hostPort.host}:${hostPort.port} at the TCP level, but the Oracle connection failed: ${rawMessage}`
      : `${this.explainTcpFailure(hostPort.host, hostPort.port, probe.code)} (driver: ${rawMessage})`;
    return { message, oraCode: extractOraCode(rawMessage), driverCode, tcp };
  }

  /** Pull an NJS/DPY/ORA/PLS/TNS code from the driver error, if present. */
  private extractDriverCode(err: unknown, message: string): string | undefined {
    const direct = (err as { code?: unknown }).code;
    if (typeof direct === 'string' && direct) return direct;
    const match = /\b(?:NJS|DPY|ORA|PLS|TNS)-\d{3,5}\b/.exec(message);
    return match ? match[0] : undefined;
  }

  /** Parse host + port from an Easy Connect (`host:port/service`) or TNS-descriptor DSN. */
  private parseHostPort(dsn: string): { host: string; port: number } | null {
    if (!dsn) return null;
    // TNS descriptor: (DESCRIPTION=...(ADDRESS=(HOST=..)(PORT=..))..)
    const descHost = /\(\s*HOST\s*=\s*([^)\s]+)\s*\)/i.exec(dsn);
    if (descHost) {
      const descPort = /\(\s*PORT\s*=\s*(\d+)\s*\)/i.exec(dsn);
      return { host: descHost[1], port: descPort ? Number(descPort[1]) : 1521 };
    }
    // Easy Connect: [//]host[:port][/service]
    const s = dsn.trim().replace(/^\/\//, '').split('/')[0];
    const v6 = /^\[([^\]]+)\](?::(\d+))?$/.exec(s); // [ipv6]:port
    if (v6) return { host: v6[1], port: v6[2] ? Number(v6[2]) : 1521 };
    const [host, port] = s.split(':');
    return host ? { host, port: port ? Number(port) : 1521 } : null;
  }

  /** Non-intrusive TCP reachability probe (no Oracle handshake). Never throws. */
  private tcpProbe(
    host: string,
    port: number,
    timeoutMs = 4000,
  ): Promise<{ reachable: boolean; code?: string; timeMs: number }> {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      let settled = false;
      const finish = (reachable: boolean, code?: string): void => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({ reachable, code, timeMs: Date.now() - start });
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false, 'ETIMEDOUT'));
      socket.once('error', (e: NodeJS.ErrnoException) => finish(false, e.code ?? 'UNKNOWN'));
      socket.connect(port, host);
    });
  }

  /** Turn a socket errno into a human-readable, actionable explanation. */
  private explainTcpFailure(host: string, port: number, code?: string): string {
    const target = `${host}:${port}`;
    switch (code) {
      case 'ECONNREFUSED':
        return `TCP connection to ${target} was refused — nothing is listening on that port (Oracle listener down) or a firewall is rejecting the request.`;
      case 'ETIMEDOUT':
        return `TCP connection to ${target} timed out — packets are being dropped (usually a firewall) or the host is down.`;
      case 'EHOSTUNREACH':
        return `No route to host ${target} — this server/container cannot reach that host.`;
      case 'ENETUNREACH':
        return `Network for ${target} is unreachable from this server/container.`;
      case 'ENOTFOUND':
      case 'EAI_AGAIN':
        return `Host "${host}" could not be resolved (DNS failure).`;
      default:
        return `TCP connection to ${target} failed${code ? ` (${code})` : ''}.`;
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
