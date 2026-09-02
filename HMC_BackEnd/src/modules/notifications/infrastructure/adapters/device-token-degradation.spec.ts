import { MssqlService } from '@core/database/mssql.service';
import { MssqlQueryError, MssqlUnavailableException } from '@core/database/mssql.error';
import { MssqlDeviceTokenRepository } from './mssql-device-token.repository';

/**
 * This ships BEFORE `HMC_Sanad_DeviceToken_tbl` exists, so the deployed state
 * on day one is: endpoints live, table missing. Registering for push is an
 * accessory to using the app — that state has to be a warning, never a 500,
 * and never something that reaches the caller.
 *
 * The same applies to the Users DB being down, which is a routine condition
 * here (`USERS_DB_DISABLED`, maintenance windows).
 */
describe('device-token store when the deployment is incomplete', () => {
  /** SQL Server's "Invalid object name 'X'" */
  const missingTable = () => {
    const driverError = Object.assign(new Error("Invalid object name 'HMC_Sanad_DeviceToken_tbl'."), {
      number: 208,
    });
    return MssqlQueryError.from(driverError);
  };

  function make(err: unknown) {
    const db = {
      query: jest.fn().mockRejectedValue(err),
      execute: jest.fn().mockRejectedValue(err),
    } as unknown as MssqlService;
    return new MssqlDeviceTokenRepository(db);
  }

  const TOKEN = { username: 'AIBRAHIM39', imei: 'imei-1', token: 'tok' };

  describe('table not created yet', () => {
    it('accepts a registration instead of failing the request', async () => {
      await expect(make(missingTable()).save(TOKEN)).resolves.toBeUndefined();
    });

    it('reads back an empty list, not an exception', async () => {
      await expect(make(missingTable()).findByUsername('AIBRAHIM39')).resolves.toEqual([]);
    });

    it('tolerates unregistering', async () => {
      await expect(make(missingTable()).remove('AIBRAHIM39', 'imei-1')).resolves.toBeUndefined();
    });

    it('tolerates pruning', async () => {
      await expect(make(missingTable()).removeTokens(['dead'])).resolves.toBeUndefined();
    });
  });

  describe('Users DB unavailable', () => {
    it('is also a warning, not a failure', async () => {
      const repo = make(new MssqlUnavailableException('Users DB is disabled.'));

      await expect(repo.save(TOKEN)).resolves.toBeUndefined();
      await expect(repo.findByUsername('AIBRAHIM39')).resolves.toEqual([]);
    });
  });

  it('does not touch the database when there is nothing to prune', async () => {
    const db = { execute: jest.fn(), query: jest.fn() } as unknown as MssqlService;

    await new MssqlDeviceTokenRepository(db).removeTokens([]);

    expect(db.execute).not.toHaveBeenCalled();
  });

  it('binds each token by name when pruning — never string-built SQL', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const db = { execute, query: jest.fn() } as unknown as MssqlService;

    await new MssqlDeviceTokenRepository(db).removeTokens(["a'; DROP TABLE x --", 'b']);

    const [sql, binds] = execute.mock.calls[0] as [string, Record<string, unknown>];
    expect(sql).toContain('@t0');
    expect(sql).not.toContain('DROP TABLE');
    expect(binds).toEqual({ t0: "a'; DROP TABLE x --", t1: 'b' });
  });
});
