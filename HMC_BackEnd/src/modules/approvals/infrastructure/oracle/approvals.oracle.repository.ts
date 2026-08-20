import { Injectable } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang, toOracleLanguage } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import {
  ITEM_KEY_COLUMN,
  ITEM_TYPE_COLUMN,
  MORE_INFO_ROLE_COLUMN,
  NOTIFICATION_ID_COLUMN,
  RECIPIENT_ROLE_COLUMN,
  USERNAME_KEY_CANDIDATES,
} from '@shared/constants/oracle-columns';
import {
  ApprovalRow,
  ApprovalsRepository,
  ApprovalsSummary,
  DecisionCommand,
  MyRequests,
  ReassignCommand,
  RequestInfoCommand,
  WorklistRepository,
} from '../../domain/approvals.repository';

/** APPROVE_REJECT_PR input params (Sanaad spec — ApproveReject request input). */
const APPROVE_REJECT_PARAMS = [
  'p_user_name',
  'p_itemtype',
  'p_item_key',
  'p_result',
  'p_notification_id',
  'p_user_comment',
  'p_language',
] as const;

/**
 * HR_RFMI_PR input params (request-more-information; signature provided by the
 * DB team — no p_language parameter, OUT contract is the usual
 * p_success_flag/p_error_msg/p_error_msg_ar resolved from the dictionary).
 */
const RFMI_PARAMS = [
  'p_from_user_name',
  'p_to_user_name',
  'p_itemtype',
  'p_item_key',
  'p_notification_id',
  'p_mode',
  'p_comments',
] as const;

/**
 * Approvals reads (APPROVE_SUMRY_V, NOTYFY_APPR_V, MY_REQEST_SUMMARY_V,
 * PNDNG_QID_V). The spec drives these services with USER_NAME, so the key column
 * is resolved from the dictionary rather than assumed to be `employee_number`
 * (which raised ORA-00904 for every approvals endpoint).
 */
@Injectable()
export class ApprovalsOracleRepository extends BaseOracleRepository implements ApprovalsRepository {
  constructor(ora: OracleService, schema: OracleSchemaService) {
    super(ora, schema);
  }

  async getSummary(username: string, _lang: Lang): Promise<ApprovalsSummary> {
    const [approvals, pendingQid] = await Promise.all([
      this.readByUser(ORACLE_OBJECTS.APPROVE_SUMRY_V, username),
      this.readByUser(ORACLE_OBJECTS.PNDNG_QID_V, username),
    ]);
    return { approvals, pendingQid };
  }

  getDetails(approvalId: string, _lang: Lang): Promise<ApprovalRow[]> {
    // The detail service is keyed by the notification id the summary rows carry.
    return this.query<ApprovalRow>(
      `SELECT * FROM ${ORACLE_OBJECTS.NOTYFY_APPR_V} WHERE ${NOTIFICATION_ID_COLUMN} = :id`,
      { id: approvalId },
    );
  }

  async getMyRequests(username: string, _lang: Lang): Promise<MyRequests> {
    const [requests, pendingQid] = await Promise.all([
      this.readByUser(ORACLE_OBJECTS.MY_REQEST_SUMMARY_V, username),
      this.readByUser(ORACLE_OBJECTS.PNDNG_QID_V, username),
    ]);
    return { requests, pendingQid };
  }

  async decide(cmd: DecisionCommand): Promise<SubmitResult> {
    return this.callSubmitProc(ORACLE_OBJECTS.APPROVE_REJECT_PR, APPROVE_REJECT_PARAMS, {
      p_user_name: cmd.username,
      p_itemtype: cmd.itemType,
      p_item_key: cmd.itemKey,
      p_result: cmd.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      p_notification_id: cmd.approvalId,
      p_user_comment: cmd.comment,
      p_language: toOracleLanguage(cmd.lang),
    });
  }

  async requestInfo(cmd: RequestInfoCommand): Promise<SubmitResult> {
    return this.callSubmitProc(ORACLE_OBJECTS.HR_RFMI_PR, RFMI_PARAMS, {
      p_from_user_name: cmd.username,
      p_to_user_name: cmd.toUsername ?? null,
      p_itemtype: cmd.itemType,
      p_item_key: cmd.itemKey,
      p_notification_id: cmd.approvalId,
      p_mode: cmd.mode,
      p_comments: cmd.comment,
    });
  }

  private readByUser(object: string, username: string): Promise<ApprovalRow[]> {
    return this.readByResolvedKey<ApprovalRow>(object, username, USERNAME_KEY_CANDIDATES);
  }
}

/**
 * Worklist reads (WORKLISTS_V, ACTION_HISTORY_V) + reassign (REASSIGN_PR).
 * The WHERE clauses reproduce the SQL published in the Sanaad mapping: the
 * worklist is scoped by workflow role (not by employee number) and the action
 * history by item type + item key (not by a `request_id` column, which does not
 * exist and raised ORA-00904).
 */
@Injectable()
export class WorklistOracleRepository extends BaseOracleRepository implements WorklistRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  getWorklist(username: string, _lang: Lang): Promise<ApprovalRow[]> {
    return this.query<ApprovalRow>(
      `SELECT * FROM ${ORACLE_OBJECTS.WORKLISTS_V}
        WHERE (${RECIPIENT_ROLE_COLUMN} = :u AND ${MORE_INFO_ROLE_COLUMN} IS NULL)
           OR ${MORE_INFO_ROLE_COLUMN} = :u`,
      { u: username },
    );
  }

  getWorklistSummary(
    username: string,
    _lang: Lang,
    notificationId?: string,
  ): Promise<ApprovalRow[]> {
    if (!notificationId) return this.getWorklist(username, _lang);
    return this.query<ApprovalRow>(
      `SELECT * FROM ${ORACLE_OBJECTS.WORKLISTS_V}
        WHERE ${NOTIFICATION_ID_COLUMN} = :id
          AND ((${RECIPIENT_ROLE_COLUMN} = :u AND ${MORE_INFO_ROLE_COLUMN} IS NULL)
                OR ${MORE_INFO_ROLE_COLUMN} = :u)`,
      { id: notificationId, u: username },
    );
  }

  getActionHistory(itemKey: string, _lang: Lang, itemType = 'HRSSA'): Promise<ApprovalRow[]> {
    return this.query<ApprovalRow>(
      `SELECT rownum sequence_num, v.* FROM ${ORACLE_OBJECTS.ACTION_HISTORY_V} v
        WHERE ${ITEM_TYPE_COLUMN} = :type AND ${ITEM_KEY_COLUMN} = :key`,
      { type: itemType, key: itemKey },
    );
  }

  /**
   * REASSIGN_PR is documented with a positional signature and its own OUT
   * contract: `(p_username, p_type, p_notification_id, p_dusername, p_comment,
   * p_success_flag, p_error_msg, p_error_msg_ar)`.
   */
  async reassign(cmd: ReassignCommand): Promise<SubmitResult> {
    const out = await this.call<Record<string, any>>(
      `BEGIN ${ORACLE_OBJECTS.REASSIGN_PR}(
          :p_username, :p_type, :p_notification_id, :p_dusername, :p_comment,
          :p_success_flag, :p_error_msg, :p_error_msg_ar); END;`,
      {
        p_username: cmd.username,
        p_type: cmd.type,
        p_notification_id: cmd.approvalId,
        p_dusername: cmd.assignTo,
        p_comment: cmd.comment ?? null,
        p_success_flag: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 2500 },
        p_error_msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 2500 },
        p_error_msg_ar: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 2500 },
      },
    );
    return this.toSubmitResult(out);
  }
}
