import { ConfigService } from '@nestjs/config';
import { MssqlService } from '@core/database/mssql.service';
import { AppLaunchConfig } from '@core/config/configuration';
import { HealthCheckService } from './healthcheck.service';

const CFG: AppLaunchConfig = {
  minSupportedVersion: '1.0.0',
  latestVersion: '1.2.0',
  downtime: false,
  downtimeStart: '',
  downtimeEnd: '',
  appName: 'SanaadHealth',
};

function makeService(enabled: boolean, cfg: Partial<AppLaunchConfig> = {}) {
  const db = {
    isEnabled: jest.fn().mockReturnValue(enabled),
    query: jest.fn(),
  } as unknown as jest.Mocked<MssqlService>;
  const config = {
    getOrThrow: jest.fn().mockReturnValue({ ...CFG, ...cfg }),
  } as unknown as ConfigService;
  return { service: new HealthCheckService(db, config), db };
}

describe('HealthCheckService', () => {
  it('uses the config fallback when the Users DB is not enabled', async () => {
    const { service, db } = makeService(false, {
      downtime: true,
      downtimeStart: 'a',
      downtimeEnd: 'b',
    });

    await expect(service.check({ deviceimei: 'imei-1' })).resolves.toEqual({
      appDowntime: 'Yes',
      downtimeStart: 'a',
      downtimeEnd: 'b',
      updatetype: 'R',
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('reports an active downtime window from HMC_Sanad_AppDownTime_tbl', async () => {
    const { service, db } = makeService(true);
    db.query
      .mockResolvedValueOnce([
        {
          SchDownStartTime: new Date('2026-08-20T00:00:00Z'),
          SchDownEndTime: new Date('2026-08-20T04:00:00Z'),
          Description: 'Maintenance',
          ReasonDesc: 'Patch',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.check({
      deviceimei: 'imei-1',
      appname: 'SanaadHealth',
      version: '1.0.0',
    });

    expect(result).toEqual({
      appDowntime: 'Yes',
      downtimeStart: '2026-08-20T00:00:00.000Z',
      downtimeEnd: '2026-08-20T04:00:00.000Z',
      updatetype: 'R',
    });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('HMC_Sanad_AppDownTime_tbl'), {
      appName: 'SanaadHealth',
    });
  });

  it('returns the DB UpdateType when an update row matches app + version', async () => {
    const { service, db } = makeService(true);
    db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ NotifyUsers: 1, UpdateType: 'M' }]);

    const result = await service.check({ deviceimei: 'imei-1', version: '1.0.0' });

    expect(result).toEqual({
      appDowntime: 'No',
      downtimeStart: '',
      downtimeEnd: '',
      updatetype: 'M',
    });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('HMC_Sanad_App_Update_tbl'), {
      appName: 'SanaadHealth',
      version: '1.0.0',
    });
  });

  it('skips the update query when the client sends no version', async () => {
    const { service, db } = makeService(true);
    db.query.mockResolvedValueOnce([]);

    const result = await service.check({ deviceimei: 'imei-1' });

    expect(result.updatetype).toBe('R');
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('degrades to the config fallback when the DB query fails', async () => {
    const { service, db } = makeService(true);
    db.query.mockRejectedValue(new Error('connection lost'));

    await expect(service.check({ deviceimei: 'imei-1' })).resolves.toEqual({
      appDowntime: 'No',
      downtimeStart: '',
      downtimeEnd: '',
      updatetype: 'R',
    });
  });
});
