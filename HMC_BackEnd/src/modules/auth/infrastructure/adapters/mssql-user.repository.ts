import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { Role } from '@core/auth/auth-user.interface';
import { MssqlService } from '@core/database/mssql.service';
import {
  AuthenticateUserQuery,
  LdapUserPort,
  ValidateUserQuery,
} from '../../domain/ports/ldap-user.port';
import { EmployeeIdentity } from '../../domain/auth-identity';

/**
 * Users-DB directory adapter (AUTH_DIRECTORY=usersdb) — resolves the pre-login
 * identity from the legacy `HMC_Sanad_DeviceRegn_tbl` alone, with NO corporate
 * directory involved. This mirrors the legacy Sanaad `userValidate` service,
 * whose only check per the client's service mapping is
 *   `SELECT DeviceID FROM HMC_Sanad_DeviceRegn_tbl
 *     WHERE LoginID = @username AND IMEINumber = @imei`
 * — there is no LDAP lookup anywhere in the legacy journey; HR validity is
 * enforced post-login by `validatehruser` (Oracle).
 *
 *  - The row for (LoginID, IMEINumber) is read first; for a new device, the
 *    user's most recent row on any device still contributes the stored
 *    phone/name.
 *  - Name/phone/employee-number columns are not part of the documented
 *    projection, so they are picked up tolerantly when the table has them. A
 *    user without a resolvable phone simply cannot receive an OTP SMS (the
 *    OTP port then rejects with "No registered phone number").
 *  - Every username is treated as a valid employee pre-login (legacy
 *    semantics). `isNewUser` here is provisional — OnboardingService
 *    recomputes it from the MPIN store.
 *  - `authenticate` throws 501 like the Entra adapter (the mobile credential
 *    is OTP + MPIN, never a password).
 */
@Injectable()
export class MssqlUserRepository implements LdapUserPort {
  private readonly logger = new Logger(MssqlUserRepository.name);

  private static readonly PHONE_COLUMNS = [
    'mobilenumber',
    'mobileno',
    'mobile',
    'phonenumber',
    'phoneno',
    'phone',
    'contactnumber',
    'msisdn',
  ];
  private static readonly NAME_COLUMNS = [
    'employeename',
    'empname',
    'fullname',
    'displayname',
    'username_display',
  ];
  private static readonly EMPNO_COLUMNS = [
    'employeenumber',
    'empno',
    'empnum',
    'staffno',
    'employeeid',
  ];
  private static readonly EMAIL_COLUMNS = ['emailid', 'emailaddress', 'email', 'mailid', 'mail'];

  constructor(private readonly db: MssqlService) {}

  async validate(query: ValidateUserQuery): Promise<EmployeeIdentity> {
    const exact = await this.db.query<Record<string, unknown>>(
      `SELECT TOP 1 * FROM HMC_Sanad_DeviceRegn_tbl
        WHERE LoginID = @username AND IMEINumber = @imei`,
      { username: query.username, imei: query.imei },
    );
    let row = exact[0];
    if (!row) {
      // New device: the user's latest registration on any device still knows
      // the stored phone/name, so onboarding on a replacement phone works.
      const any = await this.db.query<Record<string, unknown>>(
        `SELECT TOP 1 * FROM HMC_Sanad_DeviceRegn_tbl
          WHERE LoginID = @username
          ORDER BY DateFirstRegistered DESC`,
        { username: query.username },
      );
      row = any[0];
      if (!row) {
        this.logger.warn(
          `No HMC_Sanad_DeviceRegn_tbl row for "${query.username}" — first-time user with no stored phone.`,
        );
      }
    }

    return {
      username: query.username,
      employeeNumber: row ? pick(row, MssqlUserRepository.EMPNO_COLUMNS) : undefined,
      employeeName: (row && pick(row, MssqlUserRepository.NAME_COLUMNS)) ?? query.username,
      phoneNumber: row ? pick(row, MssqlUserRepository.PHONE_COLUMNS) : undefined,
      email: row ? pick(row, MssqlUserRepository.EMAIL_COLUMNS) : undefined,
      isEmployee: true,
      isNewUser: !row || pick(row, ['mpin']) === undefined,
      roles: [Role.EMPLOYEE],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authenticate(_query: AuthenticateUserQuery): Promise<EmployeeIdentity> {
    throw new NotImplementedException(
      'Password authentication is not part of the Users-DB journey — the mobile credential is OTP + MPIN.',
    );
  }
}

/** First non-empty value among the candidate columns (case-insensitive). */
function pick(row: Record<string, unknown>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const key = keys.find((k) => k.toLowerCase() === candidate);
    if (!key) continue;
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}
