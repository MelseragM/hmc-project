import { Module } from '@nestjs/common';
import { AuthController } from './interface/auth.controller';
import { HealthCheckController } from './interface/healthcheck.controller';
import { AuthService } from './application/auth.service';
import { OnboardingService } from './application/onboarding.service';
import { MpinService } from './application/mpin.service';
import { HealthCheckService } from './application/healthcheck.service';
import { LDAP_USER_PORT } from './domain/ports/ldap-user.port';
import { OTP_PORT } from './domain/ports/otp.port';
import { MPIN_STORE_PORT } from './domain/ports/mpin-store.port';
import { DEVICE_REGISTRY_PORT } from './domain/ports/device-registry.port';
import { FUNCTION_ACCESS_PORT } from './domain/ports/function-access.port';
import { LdapUserRepository } from './infrastructure/adapters/ldap-user.repository';
import { OtpStubRepository } from './infrastructure/adapters/otp.stub.repository';
import { MpinStoreStubRepository } from './infrastructure/adapters/mpin-store.stub.repository';
import { DeviceRegistryStubRepository } from './infrastructure/adapters/device-registry.stub.repository';
import { FunctionAccessStubRepository } from './infrastructure/adapters/function-access.stub.repository';

/**
 * Auth feature module — Sanaad User Authentication & Access Control framework
 * (APIs 1-7). JWT signing/verification comes from the global core AuthModule.
 * External dependencies (LDAP/OTP/MPIN/device/function-access) are bound to stub
 * adapters (501) until their specs/creds arrive; non-prod uses a dev bypass.
 */
@Module({
  controllers: [AuthController, HealthCheckController],
  providers: [
    AuthService,
    OnboardingService,
    MpinService,
    HealthCheckService,
    { provide: LDAP_USER_PORT, useClass: LdapUserRepository },
    { provide: OTP_PORT, useClass: OtpStubRepository },
    { provide: MPIN_STORE_PORT, useClass: MpinStoreStubRepository },
    { provide: DEVICE_REGISTRY_PORT, useClass: DeviceRegistryStubRepository },
    { provide: FUNCTION_ACCESS_PORT, useClass: FunctionAccessStubRepository },
  ],
})
export class AuthModule {}
