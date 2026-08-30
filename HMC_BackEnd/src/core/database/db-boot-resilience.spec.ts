import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import * as sql from 'mssql';
import { OracleService } from './oracle.service';
import { MssqlService } from './mssql.service';
import { MotcSmsDbService } from './motc-sms-db.service';
import { OracleLogStore } from './oracle-log.store';
import { OracleUnavailableException } from './oracle.error';
import { MssqlUnavailableException } from './mssql.error';

// Both drivers are mocked with explicit factories. Auto-mock cannot be used:
// jest walks the real module's exports and oracledb's dbObject getters throw
// ("Cannot read properties of undefined (reading 'fqn')"), and createPool is
// non-configurable so it cannot be spied on either.
jest.mock('oracledb', () => ({
  createPool: jest.fn(),
  initOracleClient: jest.fn(),
  thin: true,
  outFormat: 0,
  fetchAsString: [],
  OUT_FORMAT_OBJECT: 4002,
  CLOB: 2017,
  BIND_OUT: 3003,
  BIND_INOUT: 3002,
}));
jest.mock('mssql', () => ({ ConnectionPool: jest.fn() }));

/**
 * A database whose credentials are WRONG must not take the whole API down.
 *
 * Until 2026-08-30 each of the three pool services rethrew from
 * onModuleInit, which aborts the Nest bootstrap: while the Users DB was being
 * configured the Oracle DSN broke, the process died, and the host answered a
 * bare HTML 503 for every route — including the auth journey, which never
 * touches Oracle. Missing credentials already degraded gracefully, so only
 * *wrong* ones were fatal, which made the failure look unrelated to config.
 *
 * These cases pin the contract: boot survives, the pool stays absent, and the
 * failure surfaces per request (clean 503) and on /health (reachable = false).
 */
describe('database boot resilience', () => {
  const FAILURE = new Error('ORA-12541: TNS:no listener');

  function config(namespace: string, cfg: Record<string, unknown>): ConfigService {
    return {
      getOrThrow: (key: string) => {
        if (key !== namespace) throw new Error(`unexpected config key ${key}`);
        return cfg;
      },
    } as unknown as ConfigService;
  }

  const ORACLE_CFG = {
    disabled: false,
    user: 'apps',
    password: 'secret',
    dsn: 'host:1521/svc',
    poolMin: 1,
    poolMax: 4,
    poolTimeout: 60,
    queueTimeout: 25000,
    thickMode: false,
  };

  const MSSQL_CFG = {
    disabled: false,
    host: 'sqlhost',
    port: 1433,
    database: 'Sanad',
    user: 'sa',
    password: 'secret',
    poolMin: 1,
    poolMax: 4,
    encrypt: false,
    trustServerCertificate: true,
    requestTimeoutMs: 15000,
    connectTimeoutMs: 15000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (oracledb.createPool as unknown as jest.Mock).mockRejectedValue(FAILURE);
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementation(() => ({
      connect: jest.fn().mockRejectedValue(FAILURE),
    }));
  });

  it('starts without Oracle when the pool cannot be created', async () => {
    const service = new OracleService(
      config('oracle', ORACLE_CFG),
      new OracleLogStore(),
    );

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    // the failure is visible where it belongs, not as a dead process
    await expect(service.ping()).resolves.toBe(false);
    expect(() => service['getPool']()).toThrow(OracleUnavailableException);
  });

  it('starts without the Users DB when the pool cannot be created', async () => {
    const service = new MssqlService(config('usersDb', MSSQL_CFG));

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    await expect(service.ping()).resolves.toBe(false);
    expect(() => service['getPool']()).toThrow(MssqlUnavailableException);
  });

  it('starts without the MOTC SMS DB when the pool cannot be created', async () => {
    const service = new MotcSmsDbService(config('motcSms', MSSQL_CFG));

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    await expect(service.ping()).resolves.toBe(false);
    expect(() => service['getPool']()).toThrow(MssqlUnavailableException);
  });

  it('reports the real reason on /health instead of dying silently', async () => {
    const service = new OracleService(config('oracle', ORACLE_CFG), new OracleLogStore());
    await service.onModuleInit();

    const diag = await service.diagnose();
    expect(diag.error?.message).toBeDefined();
  });

  /**
   * "switched off on purpose" and "configured but broken" must not look the
   * same on /health — telling them apart is the whole point of isConfigured().
   */
  it('separates a broken database from a disabled one', async () => {
    const broken = new OracleService(config('oracle', ORACLE_CFG), new OracleLogStore());
    await broken.onModuleInit();

    const off = new OracleService(
      config('oracle', { ...ORACLE_CFG, disabled: true }),
      new OracleLogStore(),
    );
    await off.onModuleInit();

    // neither has a pool, so both are equally unusable...
    expect(broken.isEnabled()).toBe(false);
    expect(off.isEnabled()).toBe(false);

    // ...but only one of them was meant to be running
    expect(broken.isConfigured()).toBe(true);
    expect(off.isConfigured()).toBe(false);
  });

  it('treats missing credentials as not configured', async () => {
    const service = new OracleService(
      config('oracle', { ...ORACLE_CFG, dsn: '' }),
      new OracleLogStore(),
    );
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(service.isConfigured()).toBe(false);
  });
});
