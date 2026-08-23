import { NotImplementedException } from '@nestjs/common';
import { MssqlService } from '@core/database/mssql.service';
import { MssqlUserRepository } from './mssql-user.repository';

function makeDb() {
  return { query: jest.fn(), execute: jest.fn() } as unknown as jest.Mocked<MssqlService>;
}

const QUERY = { username: 'hmc1', imei: 'imei-1', platform: 'Android' };

describe('MssqlUserRepository (AUTH_DIRECTORY=usersdb)', () => {
  it('resolves identity from the exact (LoginID, IMEINumber) registration row', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce([
      {
        DeviceID: 7,
        LoginID: 'hmc1',
        IMEINumber: 'imei-1',
        MPIN: 'stored-hash',
        MobileNumber: '77861234',
        EmployeeName: 'Jane Doe',
      },
    ]);

    const identity = await new MssqlUserRepository(db).validate(QUERY);

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /FROM HMC_Sanad_DeviceRegn_tbl[\s\S]*WHERE LoginID = @username AND IMEINumber = @imei/,
      ),
      { username: 'hmc1', imei: 'imei-1' },
    );
    expect(identity).toMatchObject({
      username: 'hmc1',
      employeeName: 'Jane Doe',
      phoneNumber: '77861234',
      isEmployee: true,
      isNewUser: false,
    });
  });

  it('falls back to the latest row on any device for a new IMEI (keeps stored phone)', async () => {
    const db = makeDb();
    db.query
      .mockResolvedValueOnce([]) // exact (LoginID, IMEI) row
      .mockResolvedValueOnce([{ LoginID: 'hmc1', IMEINumber: 'old-imei', MobileNo: '55550001' }]);

    const identity = await new MssqlUserRepository(db).validate(QUERY);

    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringMatching(/WHERE LoginID = @username[\s\S]*ORDER BY DateFirstRegistered DESC/),
      { username: 'hmc1' },
    );
    expect(identity).toMatchObject({
      phoneNumber: '55550001',
      isEmployee: true,
      isNewUser: true, // no MPIN column value on the fallback row
    });
  });

  it('treats a user with no registration rows as a valid first-time employee without a phone', async () => {
    const db = makeDb();
    db.query.mockResolvedValue([]);

    const identity = await new MssqlUserRepository(db).validate(QUERY);

    expect(identity).toMatchObject({
      username: 'hmc1',
      employeeName: 'hmc1',
      phoneNumber: undefined,
      isEmployee: true,
      isNewUser: true,
    });
  });

  it('authenticate() is not part of the Users-DB journey (501)', () => {
    expect(() =>
      new MssqlUserRepository(makeDb()).authenticate({ username: 'hmc1', password: 'x' }),
    ).toThrow(NotImplementedException);
  });
});
