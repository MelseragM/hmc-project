import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthConfig } from '@core/config/configuration';
import { AuthenticatedUser, Role } from '@core/auth/auth-user.interface';
import { AuditService } from '@core/audit/audit.service';
import { AuthLifecycleEvent } from '@core/audit/audit-event';
import { MPIN_STORE_PORT, MpinStorePort } from '../domain/ports/mpin-store.port';
import { LDAP_USER_PORT, LdapUserPort } from '../domain/ports/ldap-user.port';
import { FUNCTION_ACCESS_PORT, FunctionAccessPort } from '../domain/ports/function-access.port';
import { EmployeeIdentity, FunctionAccess, FunctionStatus } from '../domain/auth-identity';
import { LoginRequestDto, LoginResponseDto, MeResponseDto } from '../interface/dto/auth.dto';
import { DEV_FUNCTION_ACCESS, devIdentity } from './dev-fallback';

/**
 * API-5 Login + current-identity. Verifies the MPIN (MpinStorePort), resolves the
 * employee (LdapUserPort), builds the function-access list (FunctionAccessPort),
 * and issues a JWT carrying roles + enabled function codes. In non-production a
 * dev bypass skips MPIN verification (preserving the prior dev-token behavior).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly devBypass: boolean;
  private readonly expiresIn: string;

  constructor(
    private readonly jwt: JwtService,
    @Inject(MPIN_STORE_PORT) private readonly mpinStore: MpinStorePort,
    @Inject(LDAP_USER_PORT) private readonly ldap: LdapUserPort,
    @Inject(FUNCTION_ACCESS_PORT) private readonly functionAccess: FunctionAccessPort,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    const nodeEnv = config.get<string>('app.nodeEnv', 'development');
    const authDisabled = config.get<boolean>('auth.disabled', false);
    this.devBypass = authDisabled || nodeEnv !== 'production';
    this.expiresIn = config.getOrThrow<AuthConfig>('auth').jwtExpiresIn;
  }

  async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
    const ctx = {
      username: dto.username,
      deviceImei: dto.imeinumber,
      platform: dto.platform,
      appVersion: dto.version,
    };

    let identity: EmployeeIdentity;
    let functionList: FunctionAccess[];

    if (this.devBypass) {
      this.logger.warn(`DEV bypass: login for "${dto.username}" WITHOUT MPIN verification.`);
      identity = devIdentity(dto.username);
      functionList = DEV_FUNCTION_ACCESS;
    } else {
      const ok = await this.mpinStore.verify({
        username: dto.username,
        imei: dto.imeinumber,
        mpin: dto.mpin,
      });
      if (!ok) {
        this.audit.lifecycle(AuthLifecycleEvent.LOGIN_FAILURE, { ...ctx, status: 'error' });
        return { status: 'error', message: 'Invalid credentials.' };
      }
      identity = await this.ldap.validate({
        username: dto.username,
        imei: dto.imeinumber,
        platform: dto.platform,
      });
      functionList = await this.functionAccess.list(identity.employeeNumber ?? dto.username);
    }

    const roles = (identity.roles as Role[] | undefined) ?? [Role.EMPLOYEE];
    const enabledFunctions = functionList
      .filter((f) => f.status === FunctionStatus.ENABLED)
      .map((f) => f.functioncode);

    const token = await this.jwt.signAsync({
      sub: identity.employeeNumber ?? dto.username,
      username: identity.username,
      employeeNumber: identity.employeeNumber,
      roles,
      functions: enabledFunctions,
      name: identity.employeeName,
      dept: identity.department,
      company: identity.company,
    });

    this.audit.lifecycle(AuthLifecycleEvent.LOGIN_SUCCESS, { ...ctx, status: 'success' });

    return {
      status: 'success',
      token,
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      employeenumber: identity.employeeNumber,
      employeename: identity.employeeName,
      employeenamear: identity.employeeNameAr,
      employeedepartment: identity.department,
      employeecompany: identity.company,
      functionaccesslist: functionList,
    };
  }

  me(user: AuthenticatedUser): MeResponseDto {
    return {
      username: user.username,
      employeeNumber: user.employeeNumber,
      roles: user.roles,
      functions: user.functions,
    };
  }
}
