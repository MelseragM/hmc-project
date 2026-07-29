import { EmployeeIdentity } from '../auth-identity';

/** Input for API-2 User Validate. */
export interface ValidateUserQuery {
  username: string;
  imei: string;
  platform?: string;
}

/**
 * Port for username validation against the corporate directory (LDAP) and
 * employee-eligibility resolution. Adapter/spec pending — see the auth
 * framework doc, API-2.
 */
export interface LdapUserPort {
  validate(query: ValidateUserQuery): Promise<EmployeeIdentity>;
}

export const LDAP_USER_PORT = Symbol('LDAP_USER_PORT');
