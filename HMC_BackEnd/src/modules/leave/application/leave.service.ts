import { Inject, Injectable } from '@nestjs/common';
import { Lang } from '@shared/domain/lang';
import { LovItem } from '@shared/domain/lov-item';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LookupsService } from '@lookups/application/lookups.service';
import {
  LEAVE_REPOSITORY,
  LeaveApplyCommand,
  LeaveBalance,
  LeaveDuration,
  LeaveRepository,
} from '../domain/leave.repository';

/**
 * Leave application service (ops 9,10,12,13,14,45,46,47,55,56,57,58,61,62).
 * NOTE: Docs_Ai/Services recommends splitting this into per-use-case classes
 * as the procedures are fleshed out; kept as one cohesive service for the scaffold.
 */
@Injectable()
export class LeaveService {
  constructor(
    @Inject(LEAVE_REPOSITORY) private readonly repo: LeaveRepository,
    private readonly lookups: LookupsService,
  ) {}

  // ── Procedures ────────────────────────────────────────────
  getBalance(
    username: string,
    lang: Lang,
    effectiveDate: string,
    accrualPlan?: string,
  ): Promise<LeaveBalance[]> {
    return this.repo.getBalance({ username, lang, accrualPlan, effectiveDate });
  }

  apply(cmd: Omit<LeaveApplyCommand, 'username' | 'lang'>, user: AuthenticatedUser, lang: Lang) {
    return this.repo.apply({ ...cmd, username: user.username, lang });
  }

  calculate(
    absenceType: string,
    startDate: string,
    endDate: string,
    user: AuthenticatedUser,
    lang: Lang,
  ): Promise<LeaveDuration> {
    return this.repo.calculate({ username: user.username, lang, absenceType, startDate, endDate });
  }

  amend(fields: Record<string, unknown>, user: AuthenticatedUser, lang: Lang): Promise<SubmitResult> {
    return this.repo.amend({ username: user.username, lang, fields });
  }

  cancel(fields: Record<string, unknown>, user: AuthenticatedUser, lang: Lang): Promise<SubmitResult> {
    return this.repo.cancel({ username: user.username, lang, fields });
  }

  returnFromLeave(
    fields: Record<string, unknown>,
    user: AuthenticatedUser,
    lang: Lang,
  ): Promise<SubmitResult> {
    return this.repo.returnFromLeave({ username: user.username, lang, fields });
  }

  // ── Simple LOVs (via shared kernel) ───────────────────────
  types(lang: Lang): Promise<LovItem[]> {
    return this.lookups.getByObject(ORACLE_OBJECTS.ABSENCE_TYPE_V, lang);
  }
  reasons(lang: Lang): Promise<LovItem[]> {
    return this.lookups.getByObject(ORACLE_OBJECTS.ABSENCE_REASON_V, lang);
  }
  classes(lang: Lang): Promise<LovItem[]> {
    return this.lookups.getByObject(ORACLE_OBJECTS.LEAV_CLASS_V, lang);
  }
  returnLov(username: string, lang: Lang): Promise<LovItem[]> {
    return this.lookups.getByObject(ORACLE_OBJECTS.RFL_REL_LEAVE1_V, lang, username);
  }
  cancelLov(username: string, lang: Lang): Promise<LovItem[]> {
    return this.lookups.getByObject(ORACLE_OBJECTS.LEAVE_CANCEL_V, lang, username);
  }
  amendLov(username: string, lang: Lang): Promise<LovItem[]> {
    return this.lookups.getByObject(ORACLE_OBJECTS.LEAVE_AMEND_V, lang, username);
  }

  // ── Aggregated LOVs (fan-out; parallelized) ───────────────
  async requestLov(lang: Lang): Promise<Record<string, LovItem[]>> {
    const [numOfChild, leaveClass, examCentre, bereavement, contractYear, types, reasons, leaveType] =
      await Promise.all([
        this.lookups.getByObject(ORACLE_OBJECTS.NUM_OF_CHILD_V, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.LEAV_CLASS_V, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.EXAM_CENTRE_V, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.BEREAV_RELAT_V, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.CONTRACT_YEAR_V, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.ABSENCE_TYPE_V, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.ABSENCE_REASON_V, lang),
        this.lookups.getByObject(ORACLE_OBJECTS.LEAVE_TYPE_V, lang),
      ]);
    return {
      numOfChild,
      leaveClass,
      examCentre,
      bereavement,
      contractYear,
      types,
      reasons,
      leaveType,
    };
  }

  async defaults(
    employeeNumber: string,
    lang: Lang,
  ): Promise<{ employment?: Record<string, unknown>; lovs: Record<string, LovItem[]> }> {
    const [employment, annualTicket, library, alsr, contractYear] = await Promise.all([
      this.repo.getEmploymentContext(employeeNumber),
      this.lookups.getByObject(ORACLE_OBJECTS.ANNUAL_TICKT_LOV, lang),
      this.lookups.getByObject(ORACLE_OBJECTS.LIBR_DFALT_LOV, lang),
      this.lookups.getByObject(ORACLE_OBJECTS.ALSR_DFALT_LOV, lang),
      this.lookups.getByObject(ORACLE_OBJECTS.CONTRACT_YEAR_V, lang),
    ]);
    return { employment, lovs: { annualTicket, library, alsr, contractYear } };
  }
}
