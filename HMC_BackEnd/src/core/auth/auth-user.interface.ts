/**
 * Identity extracted from the bearer token. Roles are inferred from the
 * approval/supervisor flows in the mapping (confirm against the real model).
 * See Docs_Ai/Domains/README.md (Auth) — login flow is out-of-band.
 */
export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  SUPERVISOR = 'SUPERVISOR',
  APPROVER = 'APPROVER',
}

export interface AuthenticatedUser {
  username: string;
  employeeNumber?: string;
  roles: Role[];
  claims?: Record<string, unknown>;
}

/** Permissive identity used only when AUTH_DISABLED=true (local dev). */
export const DEV_USER: AuthenticatedUser = {
  username: 'dev',
  employeeNumber: '000000',
  roles: [Role.EMPLOYEE, Role.SUPERVISOR, Role.APPROVER],
};
