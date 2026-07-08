import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import {
  ApprovalRow,
  ApprovalsRepository,
  ApprovalsSummary,
  DecisionCommand,
  MyRequests,
  ReassignCommand,
  WorklistRepository,
} from '../../domain/approvals.repository';

/** Approvals reads (APPROVE_SUMRY_V, NOTYFY_APPR_V, MY_REQEST_SUMMARY_V, PNDNG_QID_V). */
@Injectable()
export class ApprovalsOracleRepository extends BaseOracleRepository implements ApprovalsRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  async getSummary(employeeNumber: string, _lang: Lang): Promise<ApprovalsSummary> {
    const [approvals, pendingQid] = await Promise.all([
      this.readByEmployee<ApprovalRow>(ORACLE_OBJECTS.APPROVE_SUMRY_V, employeeNumber),
      this.readByEmployee<ApprovalRow>(ORACLE_OBJECTS.PNDNG_QID_V, employeeNumber),
    ]);
    return { approvals, pendingQid };
  }

  getDetails(approvalId: string, _lang: Lang): Promise<ApprovalRow[]> {
    // TODO(verify): confirm the NOTYFY_APPR_V id column name.
    return this.query<ApprovalRow>(
      `SELECT * FROM ${ORACLE_OBJECTS.NOTYFY_APPR_V} WHERE notification_id = :id`,
      { id: approvalId },
    );
  }

  async getMyRequests(employeeNumber: string, _lang: Lang): Promise<MyRequests> {
    const [requests, pendingQid] = await Promise.all([
      this.readByEmployee<ApprovalRow>(ORACLE_OBJECTS.MY_REQEST_SUMMARY_V, employeeNumber),
      this.readByEmployee<ApprovalRow>(ORACLE_OBJECTS.PNDNG_QID_V, employeeNumber),
    ]);
    return { requests, pendingQid };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async decide(_cmd: DecisionCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.APPROVE_REJECT_PR);
  }
}

/** Worklist reads (WORKLISTS_V, ACTION_HISTORY_V) + reassign (REASSIGN_PR). */
@Injectable()
export class WorklistOracleRepository extends BaseOracleRepository implements WorklistRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  getWorklist(employeeNumber: string, _lang: Lang): Promise<ApprovalRow[]> {
    return this.readByEmployee<ApprovalRow>(ORACLE_OBJECTS.WORKLISTS_V, employeeNumber);
  }

  getWorklistSummary(employeeNumber: string, _lang: Lang): Promise<ApprovalRow[]> {
    return this.readByEmployee<ApprovalRow>(ORACLE_OBJECTS.WORKLISTS_V, employeeNumber);
  }

  getActionHistory(approvalId: string, _lang: Lang): Promise<ApprovalRow[]> {
    // TODO(verify): confirm the ACTION_HISTORY_V id column name.
    return this.query<ApprovalRow>(
      `SELECT * FROM ${ORACLE_OBJECTS.ACTION_HISTORY_V} WHERE request_id = :id`,
      { id: approvalId },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async reassign(_cmd: ReassignCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.REASSIGN_PR);
  }
}
