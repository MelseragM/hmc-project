import { Injectable } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { SubmitResult } from '@shared/domain/submit-result';
import { toOracleLanguage } from '@shared/domain/lang';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import {
  LeaveApplyCommand,
  LeaveBalance,
  LeaveBalanceQuery,
  LeaveCalcCommand,
  LeaveDuration,
  LeaveMutationCommand,
  LeaveRepository,
} from '../../domain/leave.repository';
import { LeaveApplyBinds } from './leave-apply.binds';

/** HR_LEAV_AMEND_PR input params (Sanaad spec — LEAVEAMEND body). */
const LEAVE_AMEND_PARAMS = [
  'p_user_name',
  'p_leave_type',
  'p_leave_to_amend',
  'p_new_end_date',
  'p_comments',
  ...BaseOracleRepository.attachmentParams(),
  'p_language',
] as const;

/** HR_LEAV_CANCEL_PR input params (Sanaad spec — LEAVECANCEL body). */
const LEAVE_CANCEL_PARAMS = [
  'p_user_name',
  'p_leave_type',
  'p_leave_to_cancel',
  'p_reason_for_cancel',
  'p_remarks',
  ...BaseOracleRepository.attachmentParams(),
  'p_language',
] as const;

/** RET_FRM_LEAV_PR input params (Sanaad spec — ReturnFromLeaveSubmit body). */
const LEAVE_RETURN_PARAMS = [
  'p_user_name',
  'p_leave_details',
  'p_related_leave1',
  'p_related_leave2',
  'p_return_date',
  'p_comments',
  ...BaseOracleRepository.attachmentParams(),
  'p_language',
] as const;

/** LEAVE_BALANCE_PR input params (Sanaad spec — LeaveBalance input). */
const LEAVE_BALANCE_PARAMS = ['p_user_name', 'p_effective_date', 'p_language'] as const;

/** CALC_LEAV_DUR_PR input params (Sanaad spec — LEAVE_CALCULATION body). */
const LEAVE_CALC_PARAMS = [
  'p_user_name',
  'p_absence_type',
  'p_start_date',
  'p_end_date',
  'p_language',
] as const;

/**
 * Leave procedures. `apply` (op 10) is implemented via the LeaveApplyBinds
 * builder (Pattern C). Balance/calc/amend/cancel/return proc signatures are not
 * fully captured → notImplemented. Employment context is a direct view read.
 */
@Injectable()
export class LeaveOracleRepository extends BaseOracleRepository implements LeaveRepository {
  constructor(ora: OracleService, schema: OracleSchemaService) {
    super(ora, schema);
  }

  /**
   * op 9 — leave balance. LEAVE_BALANCE_PR takes the user, effective date and
   * language and returns the accrual-plan balances through a REF CURSOR.
   */
  async getBalance(query: LeaveBalanceQuery): Promise<LeaveBalance[]> {
    return this.callRowsProc<LeaveBalance>(
      ORACLE_OBJECTS.LEAVE_BALANCE_PR,
      LEAVE_BALANCE_PARAMS,
      {
        // LEAVE_BALANCE_PR's formal parameter is still named p_user_name, but
        // the value it actually expects (confirmed working) is the numeric
        // Oracle PERSON_ID, not a username/employee-number string.
        p_user_name: query.personId,
        p_effective_date: query.effectiveDate,
        p_language: toOracleLanguage(query.lang),
      },
    );
  }

  async apply(cmd: LeaveApplyCommand): Promise<SubmitResult> {
    const binds = LeaveApplyBinds.from(cmd);
    const out = await this.call<Record<string, any>>(
      `BEGIN ${ORACLE_OBJECTS.LEAV_OF_ABSEN_NEW_PR}(\n          ${LeaveApplyBinds.signature}); END;`,
      binds,
    );
    return this.toSubmitResult(out);
  }

  async calculate(cmd: LeaveCalcCommand): Promise<LeaveDuration> {
    // p_success_flag was added to CALC_LEAV_DUR_PR's OUT contract alongside
    // p_status/p_message; omitting it raised PLS-00306 (wrong number of args).
    const namedArgs = [
      ...LEAVE_CALC_PARAMS.map((p) => `${p} => :${p}`),
      'p_status => :p_status',
      'p_message => :p_message',
      'p_success_flag => :p_success_flag',
    ].join(',\n          ');
    const out = await this.call<Record<string, any>>(
      `BEGIN ${ORACLE_OBJECTS.CALC_LEAV_DUR_PR}(\n          ${namedArgs}); END;`,
      {
        p_user_name: cmd.username,
        p_absence_type: cmd.absenceType,
        p_start_date: cmd.startDate,
        p_end_date: cmd.endDate,
        p_language: toOracleLanguage(cmd.lang),
        p_status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
        p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
        p_success_flag: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
      },
    );
    const days = Number(out.p_message);
    return {
      days: Number.isFinite(days) ? days : undefined,
      successflag: out.p_success_flag ?? out.p_status,
      message: out.p_message,
    };
  }

  async amend(cmd: LeaveMutationCommand): Promise<SubmitResult> {
    return this.callSubmitProc(ORACLE_OBJECTS.HR_LEAV_AMEND_PR, LEAVE_AMEND_PARAMS, this.values(cmd));
  }

  async cancel(cmd: LeaveMutationCommand): Promise<SubmitResult> {
    return this.callSubmitProc(ORACLE_OBJECTS.HR_LEAV_CANCEL_PR, LEAVE_CANCEL_PARAMS, this.values(cmd));
  }

  async returnFromLeave(cmd: LeaveMutationCommand): Promise<SubmitResult> {
    return this.callSubmitProc(ORACLE_OBJECTS.RET_FRM_LEAV_PR, LEAVE_RETURN_PARAMS, this.values(cmd));
  }

  /** Merge the posted p_* body with the enforced user + resolved language. */
  private values(cmd: LeaveMutationCommand): Record<string, unknown> {
    return { ...cmd.fields, p_language: toOracleLanguage(cmd.lang), p_user_name: cmd.username };
  }

  async getEmploymentContext(
    employeeNumber: string,
  ): Promise<Record<string, unknown> | undefined> {
    const rows = await this.readByEmployee(ORACLE_OBJECTS.EMPLOYMENT_DETAILS_V, employeeNumber);
    return rows[0];
  }
}
