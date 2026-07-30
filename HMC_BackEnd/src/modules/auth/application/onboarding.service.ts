import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AuditService } from '@core/audit/audit.service';
import { AuthLifecycleEvent } from '@core/audit/audit-event';
import { LDAP_USER_PORT, LdapUserPort } from '../domain/ports/ldap-user.port';
import { OTP_PORT, OtpPort } from '../domain/ports/otp.port';
import { EmployeeIdentity } from '../domain/auth-identity';
import {
  UserValidateRequestDto,
  UserValidateResponseDto,
  ValidateOtpRequestDto,
} from '../interface/dto/onboarding.dto';
import { StatusMessageDto } from '../interface/dto/auth.dto';
import { devIdentity } from './dev-fallback';

/**
 * API-2 (User Validate) + API-3 (Validate OTP). Resolves the employee via LDAP,
 * triggers OTP delivery, and correlates verification by requestId. In non-prod a
 * dev bypass synthesizes identity and accepts any well-formed OTP.
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly devBypass: boolean;

  constructor(
    @Inject(LDAP_USER_PORT) private readonly ldap: LdapUserPort,
    @Inject(OTP_PORT) private readonly otp: OtpPort,
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
      if (!dto.password) {
        this.audit.lifecycle(AuthLifecycleEvent.USER_VALIDATE_FAILURE, { ...ctx, status: 'error' });
        return { status: 'error', message: 'Password is required.' };
      }
      try {
        identity = await this.ldap.authenticate({
          username: dto.username,
          password: dto.password,
          imei: dto.imeinumber,
          platform: dto.platform,
        });
      } catch (err) {
        if (err instanceof UnauthorizedException) {
          this.audit.lifecycle(AuthLifecycleEvent.USER_VALIDATE_FAILURE, {
            ...ctx,
            status: 'error',
          });
          return { status: 'error', message: 'Invalid username or password.' };
        }
        throw err;
      }
    }

    if (!identity.isEmployee) {
      this.audit.lifecycle(AuthLifecycleEvent.USER_VALIDATE_FAILURE, { ...ctx, status: 'error' });
      return { status: 'error', message: 'Invalid employee id received.' };
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
}
