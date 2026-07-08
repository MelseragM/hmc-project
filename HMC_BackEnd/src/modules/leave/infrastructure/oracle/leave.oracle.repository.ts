import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { SubmitResult } from '@shared/domain/submit-result';
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

/**
 * Leave procedures. `apply` (op 10) is implemented via the LeaveApplyBinds
 * builder (Pattern C). Balance/calc/amend/cancel/return proc signatures are not
 * fully captured → notImplemented. Employment context is a direct view read.
 */
@Injectable()
export class LeaveOracleRepository extends BaseOracleRepository implements LeaveRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBalance(_query: LeaveBalanceQuery): Promise<LeaveBalance[]> {
    // TODO(bind): capture XXHMC_SND_LEAVE_BALANCE_PR signature (accrual plan + effective date).
    return this.notImplemented(ORACLE_OBJECTS.LEAVE_BALANCE_PR);
  }

  async apply(cmd: LeaveApplyCommand): Promise<SubmitResult> {
    const binds = LeaveApplyBinds.from(cmd);
    const out = await this.call<Record<string, any>>(
      `BEGIN ${ORACLE_OBJECTS.LEAV_OF_ABSEN_NEW_PR}(\n          ${LeaveApplyBinds.signature}); END;`,
      binds,
    );
    return this.toSubmitResult(out);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async calculate(_cmd: LeaveCalcCommand): Promise<LeaveDuration> {
    return this.notImplemented(ORACLE_OBJECTS.CALC_LEAV_DUR_PR);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async amend(_cmd: LeaveMutationCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.HR_LEAV_AMEND_PR);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async cancel(_cmd: LeaveMutationCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.HR_LEAV_CANCEL_PR);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async returnFromLeave(_cmd: LeaveMutationCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.RET_FRM_LEAV_PR);
  }

  async getEmploymentContext(
    employeeNumber: string,
  ): Promise<Record<string, unknown> | undefined> {
    const rows = await this.readByEmployee(ORACLE_OBJECTS.EMPLOYMENT_DETAILS_V, employeeNumber);
    return rows[0];
  }
}
