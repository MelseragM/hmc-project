import { Injectable, NotImplementedException } from '@nestjs/common';
import { LdapUserPort, ValidateUserQuery } from '../../domain/ports/ldap-user.port';
import { EmployeeIdentity } from '../../domain/auth-identity';

/**
 * Stub LDAP adapter. Throws 501 until the corporate directory (LDAP) endpoint
 * and employee-eligibility source are provided. In non-production the
 * OnboardingService short-circuits before reaching this adapter (dev bypass).
 * TODO(spec): implement against the LDAP/HR directory (auth framework API-2).
 */
@Injectable()
export class LdapUserStubRepository implements LdapUserPort {
  validate(_query: ValidateUserQuery): Promise<EmployeeIdentity> {
    throw new NotImplementedException(
      'LDAP user validation is not wired yet — provide the LDAP endpoint/spec. [TODO(spec) API-2]',
    );
  }
}
