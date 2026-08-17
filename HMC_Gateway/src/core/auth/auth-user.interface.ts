/**
 * Identity extracted from the bearer token issued by HMC_BackEnd's
 * /auth/login (API-5). Kept structurally in sync with the backend's
 * AuthenticatedUser — the gateway never issues tokens itself, only verifies
 * them, so this is a read-only mirror of the claims shape.
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
  /** Enabled function/module codes from the login functionaccesslist (API-5). */
  functions?: string[];
  employeeName?: string;
  department?: string;
  company?: string;
  claims?: Record<string, unknown>;
}

/** Permissive identity used only when AUTH_DISABLED=true (local dev). */
export const DEV_USER: AuthenticatedUser = {
  username: 'DEV_USER',
  employeeNumber: '000000',
  roles: [Role.EMPLOYEE, Role.SUPERVISOR, Role.APPROVER],
  functions: ['PYSRS', 'LEAVE', 'LETTER', 'SDCAPT'],
};
