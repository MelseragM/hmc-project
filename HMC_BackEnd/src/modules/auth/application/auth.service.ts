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
import { STATIC_FUNCTION_ACCESS, STATIC_LOGIN_IDENTITY } from './static-login.data';

/**
 * API-5 Login + current-identity. Verifies the MPIN (MpinStorePort), resolves the
 * employee (LdapUserPort), builds the function-access list (FunctionAccessPort),
 * and issues a JWT carrying roles + enabled function codes. When
 * AUTH_DISABLED=true an explicit dev bypass skips MPIN verification and returns
 * a static identity/function list; with AUTH_DISABLED=false the real journey
 * runs in every environment (MPIN → directory → function access).
 *
 * AUTH_STATIC_LOGIN=true (testing only, takes precedence): login returns the
 * fixed AIBRAHIM39 payload (static-login.data.ts) and the FULL user data —
 * employee fields + functionaccesslist — is embedded in the signed JWT as a
 * `userdata` claim so the client can read everything from the token alone.
 * Note the JWT is signed (tamper-proof), not encrypted: its payload is
 * base64-readable by design.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly devBypass: boolean;
  private readonly staticLogin: boolean;
  private readonly expiresIn: string;

  constructor(
    private readonly jwt: JwtService,
    @Inject(MPIN_STORE_PORT) private readonly mpinStore: MpinStorePort,
    @Inject(LDAP_USER_PORT) private readonly ldap: LdapUserPort,
    @Inject(FUNCTION_ACCESS_PORT) private readonly functionAccess: FunctionAccessPort,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.devBypass = config.get<boolean>('auth.disabled', false);
    this.staticLogin = config.getOrThrow<AuthConfig>('auth').staticLogin;
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

    if (this.staticLogin) {
      this.logger.warn(
        `AUTH_STATIC_LOGIN: static login payload for "${dto.username}" (no MPIN/directory/DB).`,
      );
      identity = STATIC_LOGIN_IDENTITY;
      functionList = STATIC_FUNCTION_ACCESS;
    } else if (this.devBypass) {
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
      // Static-login testing: the FULL user data travels inside the token so
      // the client can decode everything from the JWT alone.
      ...(this.staticLogin && {
        userdata: {
          employeeusername: identity.username,
          employeenumber: identity.employeeNumber,
          employeename: identity.employeeName,
          employeenamear: identity.employeeNameAr,
          employeedepartment: identity.department,
          employeecompany: identity.company,
          functionaccesslist: functionList,
        },
      }),
    });

    this.audit.lifecycle(AuthLifecycleEvent.LOGIN_SUCCESS, { ...ctx, status: 'success' });

    return {
      status: 'success',
      token,
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      employeeusername: identity.username,
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
