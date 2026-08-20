import { Injectable } from '@nestjs/common';
import { MssqlService } from '@core/database/mssql.service';
import { DeviceBindingCommand, DeviceRegistryPort } from '../../domain/ports/device-registry.port';

/**
 * Device-binding registry backed by the legacy `HMC_Sanad_DeviceRegn_tbl`
 * (LoginID ↔ IMEINumber). `isBound` is the exact userValidate/forgetMPIN check
 * from the client's service mapping:
 * `SELECT DeviceID FROM HMC_Sanad_DeviceRegn_tbl WHERE LoginID = @u AND IMEINumber = @imei`.
 */
@Injectable()
export class MssqlDeviceRegistryRepository implements DeviceRegistryPort {
  constructor(private readonly db: MssqlService) {}

  async bind(cmd: DeviceBindingCommand): Promise<void> {
    // Idempotent registration: create the row only when this user↔device pair
    // is not registered yet (the MPIN is written separately by the MPIN store).
    await this.db.execute(
      `IF NOT EXISTS (
         SELECT 1 FROM HMC_Sanad_DeviceRegn_tbl WHERE LoginID = @username AND IMEINumber = @imei
       )
       INSERT INTO HMC_Sanad_DeviceRegn_tbl (LoginID, IMEINumber, DateFirstRegistered)
       VALUES (@username, @imei, GETDATE())`,
      { username: cmd.username, imei: cmd.imei },
    );
  }

  async isBound(username: string, imei: string): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT DeviceID
         FROM HMC_Sanad_DeviceRegn_tbl
        WHERE LoginID = @username AND IMEINumber = @imei`,
      { username, imei },
    );
    return rows.length > 0;
  }
}
