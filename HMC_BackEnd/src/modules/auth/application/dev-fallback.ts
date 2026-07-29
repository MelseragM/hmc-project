import { Role } from '@core/auth/auth-user.interface';
import { EmployeeIdentity, FunctionAccess, FunctionStatus } from '../domain/auth-identity';

/**
 * Dev-only fallbacks used when auth is bypassed (AUTH_DISABLED or non-production),
 * mirroring the repo's existing dev-token philosophy so the full journey can be
 * exercised without LDAP/OTP/MPIN backends. NEVER used in production.
 */
export const DEV_FUNCTION_ACCESS: FunctionAccess[] = [
  { functionname: 'Payroll SSRS', functioncode: 'PYSRS', remarks: 'Payroll SSRS', status: FunctionStatus.ENABLED },
  { functionname: 'Leave', functioncode: 'LEAVE', remarks: 'Leave', status: FunctionStatus.ENABLED },
  { functionname: 'Letters', functioncode: 'LETTER', remarks: 'Letters', status: FunctionStatus.ENABLED },
  { functionname: 'Staff Clinic Apptmnt', functioncode: 'SDCAPT', remarks: 'Staff Clinic Appointment', status: FunctionStatus.ENABLED },
  { functionname: 'Housing', functioncode: 'HOUSNG', remarks: 'Housing (coming soon)', status: FunctionStatus.COMING_SOON },
];

export function devIdentity(username: string): EmployeeIdentity {
  return {
    username,
    employeeNumber: '000000',
    employeeName: 'Dev User',
    employeeNameAr: 'مستخدم تجريبي',
    department: 'Information Communication and Technology',
    company: 'HMC',
    phoneNumber: '7786XXXX',
    isEmployee: true,
    isNewUser: false,
    roles: [Role.EMPLOYEE],
  };
}
