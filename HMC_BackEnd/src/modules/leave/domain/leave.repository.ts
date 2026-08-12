import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';

export interface LeaveBalance {
  plan?: string;
  entitlement?: string;
  taken?: string;
  balance?: string;
  [extra: string]: unknown;
}

/**
 * A field literally named `successflag` here would make
 * `ResponseInterceptor.isSubmitResult()` misidentify this read result as a
 * `_PR` action envelope, discarding `days` (only `status`/`successflag`/
 * `errormessage`/`result` are forwarded for that shape) — hence
 * `successFlag`/`errorMessage` (camelCase) rather than the Oracle bind names.
 */
export interface LeaveDuration {
  days?: number;
  successFlag?: string;
  errorMessage?: string;
}

export interface LeaveBalanceQuery {
  personId: string;
  lang: Lang;
  accrualPlan?: string;
  effectiveDate: string;
}

/** op 10 — Apply leave (LEAV_OF_ABSEN_NEW_PR, ~50 binds). */
export interface LeaveApplyCommand {
  username: string;
  lang: Lang;
  absenceType: string;
  absenceReason?: string;
  startDate: string;
  endDate: string;
  /** Additional documented binds captured over time. */
  extra?: Record<string, unknown>;
}

export interface LeaveCalcCommand {
  username: string;
  lang: Lang;
  absenceType: string;
  startDate: string;
  endDate: string;
}

export interface LeaveMutationCommand {
  username: string;
  lang: Lang;
  fields: Record<string, unknown>;
}

/**
 * Port for leave procedures. LOV reads (12,13,14,45,46,55,61,62) flow through
 * the shared LookupsService, not this port. Employment context (for 45) is read
 * here directly from EMPLOYMENT_DETAILS_V to avoid importing the employee module.
 */
export interface LeaveRepository {
  getBalance(query: LeaveBalanceQuery): Promise<LeaveBalance[]>;
  apply(cmd: LeaveApplyCommand): Promise<SubmitResult>;
  calculate(cmd: LeaveCalcCommand): Promise<LeaveDuration>;
  amend(cmd: LeaveMutationCommand): Promise<SubmitResult>;
  cancel(cmd: LeaveMutationCommand): Promise<SubmitResult>;
  returnFromLeave(cmd: LeaveMutationCommand): Promise<SubmitResult>;
  getEmploymentContext(employeeNumber: string): Promise<Record<string, unknown> | undefined>;
}

export const LEAVE_REPOSITORY = Symbol('LEAVE_REPOSITORY');
