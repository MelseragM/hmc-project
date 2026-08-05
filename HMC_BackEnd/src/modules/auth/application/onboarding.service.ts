import { Inject, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AuditService } from '@core/audit/audit.service';
import { AuthLifecycleEvent } from '@core/audit/audit-event';
import { LDAP_USER_PORT, LdapUserPort } from '../domain/ports/ldap-user.port';
import { OTP_PORT, OtpPort } from '../domain/ports/otp.port';
import { MPIN_STORE_PORT, MpinStorePort } from '../domain/ports/mpin-store.port';
import { EmployeeIdentity } from '../domain/auth-identity';
import {
  UserValidateRequestDto,
  UserValidateResponseDto,
  ValidateOtpRequestDto,
} from '../interface/dto/onboarding.dto';
import { StatusMessageDto } from '../interface/dto/auth.dto';
import { devIdentity } from './dev-fallback';

/**
 * API-2 (User Validate) + API-3 (Validate OTP). Per the auth framework doc,
 * API-2 looks the username up in LDAP (NO password): it confirms the user is a
 * valid employee, resolves the registered phone number, decides new-vs-existing
 * user (from the MPIN store), then triggers OTP delivery. In non-prod a dev
 * bypass synthesizes identity and accepts any well-formed OTP.
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly devBypass: boolean;

  constructor(
    @Inject(LDAP_USER_PORT) private readonly ldap: LdapUserPort,
    @Inject(OTP_PORT) private readonly otp: OtpPort,
    @Inject(MPIN_STORE_PORT) private readonly mpin: MpinStorePort,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    const nodeEnv = config.get<string>('app.nodeEnv', 'development');
    const authDisabled = config.get<boolean>('auth.disabled', false);
    this.devBypass = authDisabled || nodeEnv !== 'production';
  }

  async validateUser(dto: UserValidateRequestDto): Promise<UserValidateResponseDto> {
    const ctx = {
      username: dto.username,
      deviceImei: dto.imeinumber,
      platform: dto.platform,
      appVersion: dto.version,
    };

    let identity: EmployeeIdentity;
    if (this.devBypass) {
      this.logger.warn(`DEV bypass: synthesizing identity for "${dto.username}" (no LDAP).`);
      identity = devIdentity(dto.username);
    } else {
      // API-2 is a passwordless LDAP lookup (see auth framework doc): resolve
      // the employee by directory search using the service/bind account.
      identity = await this.ldap.validate({
        username: dto.username,
        imei: dto.imeinumber,
        platform: dto.platform,
      });
    }

    if (!identity.isEmployee) {
      this.audit.lifecycle(AuthLifecycleEvent.USER_VALIDATE_FAILURE, { ...ctx, status: 'error' });
      return { status: 'error', message: 'Invalid employee id received.' };
    }

    // New (first-time) vs existing user is owned by the MPIN store: a user with
    // an MPIN registered on this device is "existing". Guarded so LDAP can be
    // exercised before the MPIN store is wired.
    if (!this.devBypass) {
      identity.isNewUser = !(await this.hasMpin(dto.username, dto.imeinumber));
    }

    const requestid = this.devBypass
      ? randomUUID().replace(/-/g, '').toUpperCase()
      : (
          await this.otp.send({
            username: dto.username,
            phoneNumber: identity.phoneNumber,
            imei: dto.imeinumber,
            purpose: 'ONBOARDING',
          })
        ).requestId;

    this.audit.lifecycle(AuthLifecycleEvent.USER_VALIDATE_SUCCESS, { ...ctx, status: 'success' });
    this.audit.lifecycle(AuthLifecycleEvent.OTP_SENT, ctx);

    return {
      employeeusername: identity.username,
      employeename: identity.employeeName,
      newuser: identity.isNewUser ? 'Yes' : 'No',
      employeeflag: identity.isEmployee ? 'Yes' : 'No',
      employeephonenumber: identity.phoneNumber,
      requestid,
    };
  }

  async validateOtp(dto: ValidateOtpRequestDto): Promise<StatusMessageDto> {
    const ctx = {
      username: dto.username,
      deviceImei: dto.imeinumber,
      platform: dto.platform,
      appVersion: dto.version,
    };

    const ok = this.devBypass
      ? /^\d{4,8}$/.test(dto.otp)
      : await this.otp.verify({
          username: dto.username,
          imei: dto.imeinumber,
          requestId: dto.requestid,
          otp: dto.otp,
        });

    this.audit.lifecycle(ok ? AuthLifecycleEvent.OTP_VALIDATED : AuthLifecycleEvent.OTP_FAILED, {
      ...ctx,
      status: ok ? 'success' : 'error',
    });

    return ok
      ? { status: 'success', message: 'OTP Validated successfully' }
      : { status: 'error', message: 'Invalid OTP' };
  }

  /**
   * Whether the user already has an MPIN registered on this device (existing
   * user). Tolerates the MPIN store not being wired yet: treats the user as
   * new so the LDAP validation path can be exercised independently.
   */
  private async hasMpin(username: string, imei: string): Promise<boolean> {
    try {
      return await this.mpin.exists(username, imei);
    } catch (err) {
      if (err instanceof NotImplementedException) {
        this.logger.warn('MPIN store not wired — treating user as first-time (newuser=Yes).');
        return false;
      }
      throw err;
    }
  }
}
