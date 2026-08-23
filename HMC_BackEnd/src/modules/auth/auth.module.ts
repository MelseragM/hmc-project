import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './interface/auth.controller';
import { HealthCheckController } from './interface/healthcheck.controller';
import { AuthService } from './application/auth.service';
import { OnboardingService } from './application/onboarding.service';
import { MpinService } from './application/mpin.service';
import { HealthCheckService } from './application/healthcheck.service';
import { LDAP_USER_PORT, LdapUserPort } from './domain/ports/ldap-user.port';
import { OTP_PORT } from './domain/ports/otp.port';
import { OTP_DELIVERY_PORT } from './domain/ports/otp-delivery.port';
import { MPIN_STORE_PORT } from './domain/ports/mpin-store.port';
import { DEVICE_REGISTRY_PORT } from './domain/ports/device-registry.port';
import { FUNCTION_ACCESS_PORT } from './domain/ports/function-access.port';
import { LdapUserRepository } from './infrastructure/adapters/ldap-user.repository';
import { EntraGraphUserRepository } from './infrastructure/adapters/entra-graph-user.repository';
import { MssqlOtpRepository } from './infrastructure/adapters/mssql-otp.repository';
import { MssqlMpinStoreRepository } from './infrastructure/adapters/mssql-mpin-store.repository';
import { MssqlDeviceRegistryRepository } from './infrastructure/adapters/mssql-device-registry.repository';
import { SmsOtpDeliveryAdapter } from './infrastructure/adapters/sms-otp-delivery.adapter';
import { MssqlFunctionAccessRepository } from './infrastructure/adapters/mssql-function-access.repository';
import { MssqlUserRepository } from './infrastructure/adapters/mssql-user.repository';

/**
 * Auth feature module — Sanaad User Authentication & Access Control framework
 * (APIs 1-7). JWT signing/verification comes from the global core AuthModule.
 *
 * OTP / MPIN / device-registry are backed by the legacy Sanaad SQL Server
 * tables (HMC_RHAP_OTP_tbl, HMC_Sanad_DeviceRegn_tbl) via the global
 * MssqlService pool; OTP delivery goes out through the config-driven SMS
 * gateway adapter. Function-access reads the Users DB view named by
 * FUNCTION_ACCESS_VIEW (default HMC_Sanad_AppMaster_VW). The dev bypass inside
 * each application service triggers on AUTH_DISABLED=true only.
 *
 * The identity port (LDAP_USER_PORT) is bound at runtime by AUTH_DIRECTORY:
 * `entra` → Microsoft Graph (EntraGraphUserRepository), `usersdb` → the legacy
 * Users DB itself (MssqlUserRepository — no corporate directory, mirrors the
 * legacy userValidate device check), else LDAPS (LdapUserRepository, the
 * default/fallback). HttpModule backs the Graph and SMS adapters' outbound
 * calls.
 */
@Module({
  imports: [HttpModule],
  controllers: [AuthController, HealthCheckController],
  providers: [
    AuthService,
    OnboardingService,
    MpinService,
    HealthCheckService,
    LdapUserRepository,
    EntraGraphUserRepository,
    MssqlUserRepository,
    {
      provide: LDAP_USER_PORT,
      inject: [ConfigService, LdapUserRepository, EntraGraphUserRepository, MssqlUserRepository],
      useFactory: (
        config: ConfigService,
        ldap: LdapUserRepository,
        entra: EntraGraphUserRepository,
        usersDb: MssqlUserRepository,
      ): LdapUserPort => {
        const directory = config.get<string>('app.directory');
        return directory === 'entra' ? entra : directory === 'usersdb' ? usersDb : ldap;
      },
    },
    { provide: OTP_DELIVERY_PORT, useClass: SmsOtpDeliveryAdapter },
    { provide: OTP_PORT, useClass: MssqlOtpRepository },
    { provide: MPIN_STORE_PORT, useClass: MssqlMpinStoreRepository },
    { provide: DEVICE_REGISTRY_PORT, useClass: MssqlDeviceRegistryRepository },
    { provide: FUNCTION_ACCESS_PORT, useClass: MssqlFunctionAccessRepository },
  ],
})
export class AuthModule {}
