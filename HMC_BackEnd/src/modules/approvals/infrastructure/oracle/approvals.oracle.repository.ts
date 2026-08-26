import { Injectable, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang, toOracleLanguage } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS, REQUEST_DETAIL_VIEWS } from '@shared/constants/oracle-objects';
import {
  APPROVER_KEY_CANDIDATES,
  ITEM_KEY_COLUMN,
  ITEM_TYPE_COLUMN,
  MORE_INFO_ROLE_COLUMN,
  REQUESTOR_KEY_CANDIDATES,
  NOTIFICATION_ID_COLUMN,
  RECIPIENT_ROLE_COLUMN,
  USERNAME_KEY_CANDIDATES,
} from '@shared/constants/oracle-columns';
import {
  ApprovalRow,
  ApprovalsRepository,
  ApprovalsSummary,
  AttachmentContent,
  DecisionCommand,
  MyRequests,
  ReassignCommand,
  RequestAttachment,
  RequestDetailSource,
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
  /** Own logger — the base class keeps its instance private. */
  private static readonly log = new Logger(ApprovalsOracleRepository.name);

  constructor(ora: OracleService, schema: OracleSchemaService) {
    super(ora, schema);
  }

  /**
   * op 20 — what is waiting for MY approval, so both views are filtered on the
   * APPROVER side. `keys` carries the caller's username AND employee number
   * because these views disagree on which form they store (see
   * readByResolvedKeyAny).
   */
  async getSummary(keys: readonly string[], _lang: Lang): Promise<ApprovalsSummary> {
    const [approvals, pendingQid] = await Promise.all([
      this.readByResolvedKeyAny<ApprovalRow>(
        ORACLE_OBJECTS.APPROVE_SUMRY_V,
        keys,
        APPROVER_KEY_CANDIDATES,
      ),
      this.readByResolvedKeyAny<ApprovalRow>(
        ORACLE_OBJECTS.PNDNG_QID_V,
        keys,
        APPROVER_KEY_CANDIDATES,
      ),
    ]);
    return { approvals, pendingQid };
  }

  /**
   * op 21 — everything about one request, keyed by the notification id the
   * summary rows carry.
   *
   * The notification row only DESCRIBES the request; the values the employee
   * submitted live in a per-type view whose name the row itself carries in
   * `SERVICE_VIEW` (a school-fee request points at
   * `XXHMC_SND_PNDNG_SCHOO_FEE_V`, holding academic year, child, school,
   * amount, receipt…). So the row is resolved → its view → the matching row by
   * `ITEM_KEY`, and paired with `XXHMC_SND_HR_ATTACHMENTS_V` for the files.
   *
   * `SERVICE_VIEW` is data, hence the REQUEST_DETAIL_VIEWS check before it is
   * ever put in a statement.
   */
  async getDetails(approvalId: string, _lang: Lang): Promise<RequestDetailSource> {
    const header = await this.findRequestHead(approvalId);
    const serviceView = header?.SERVICE_VIEW ? String(header.SERVICE_VIEW).toUpperCase() : null;
    const itemKey = header?.ITEM_KEY ? String(header.ITEM_KEY) : null;
    const known = !!serviceView && REQUEST_DETAIL_VIEWS.has(serviceView);

    if (serviceView && !known) {
      ApprovalsOracleRepository.log.warn(
        `SERVICE_VIEW "${serviceView}" of notification ${approvalId} is not an allow-listed ` +
          'detail view — returning the request without its payload.',
      );
    }

    const [detail, attachments] = await Promise.all([
      known && itemKey
        ? this.query<ApprovalRow>(`SELECT * FROM ${serviceView} WHERE ${ITEM_KEY_COLUMN} = :k`, {
            k: itemKey,
          })
        : Promise.resolve([]),
      itemKey ? this.readAttachments(itemKey) : Promise.resolve([]),
    ]);

    return { header, serviceView, itemKey, detailRow: detail[0], attachments };
  }

  /**
   * Locate the request by notification id. `NOTYFY_APPR_V` only holds OPEN
   * actionable notifications, so the two summary views are fallbacks — that way
   * a row opened from "my requests" resolves as well.
   */
  private async findRequestHead(notificationId: string): Promise<ApprovalRow | undefined> {
    for (const object of [
      ORACLE_OBJECTS.NOTYFY_APPR_V,
      ORACLE_OBJECTS.MY_REQEST_SUMMARY_V,
      ORACLE_OBJECTS.APPROVE_SUMRY_V,
    ]) {
      const rows = await this.query<ApprovalRow>(
        `SELECT * FROM ${object} WHERE ${NOTIFICATION_ID_COLUMN} = :id`,
        { id: notificationId },
      );
      if (rows.length) return rows[0];
    }
    return undefined;
  }

  /** Metadata only — the BLOB is fetched on demand by the download endpoint. */
  private async readAttachments(itemKey: string): Promise<RequestAttachment[]> {
    const rows = await this.query<Record<string, any>>(
      `SELECT attached_document_id, file_name, file_content_type,
              DBMS_LOB.GETLENGTH(file_data) AS size_bytes, last_update_date
         FROM ${ORACLE_OBJECTS.HR_ATTACHMENTS_V}
        WHERE ${ITEM_KEY_COLUMN} = :k
        ORDER BY last_update_date DESC`,
      { k: itemKey },
    );
    return rows.map((r) => ({
      id: Number(r.ATTACHED_DOCUMENT_ID),
      fileName: String(r.FILE_NAME ?? ''),
      contentType: String(r.FILE_CONTENT_TYPE ?? 'application/octet-stream'),
      sizeBytes: r.SIZE_BYTES === null ? null : Number(r.SIZE_BYTES),
      uploadedAt: r.LAST_UPDATE_DATE ? new Date(r.LAST_UPDATE_DATE).toISOString() : null,
      url: `/approvals/attachments/${r.ATTACHED_DOCUMENT_ID}`,
    }));
  }

  async getAttachmentContent(attachedDocumentId: string): Promise<AttachmentContent | undefined> {
    const rows = await this.query<Record<string, any>>(
      `SELECT file_name, file_content_type, file_data
         FROM ${ORACLE_OBJECTS.HR_ATTACHMENTS_V}
        WHERE attached_document_id = :id`,
      { id: attachedDocumentId },
    );
    const row = rows[0];
    if (!row) return undefined;
    // fetchAsString covers CLOBs only, so a BLOB arrives as a Buffer.
    const data = row.FILE_DATA;
    return {
      fileName: String(row.FILE_NAME ?? ''),
      contentType: String(row.FILE_CONTENT_TYPE ?? 'application/octet-stream'),
      contentBase64: Buffer.isBuffer(data) ? data.toString('base64') : '',
    };
  }

  /** op 23 — what I submitted, so both views are filtered on the REQUESTOR side. */
  async getMyRequests(keys: readonly string[], _lang: Lang): Promise<MyRequests> {
    const [requests, pendingQid] = await Promise.all([
      this.readByResolvedKeyAny<ApprovalRow>(
        ORACLE_OBJECTS.MY_REQEST_SUMMARY_V,
        keys,
        REQUESTOR_KEY_CANDIDATES,
      ),
      this.readByResolvedKeyAny<ApprovalRow>(
        ORACLE_OBJECTS.PNDNG_QID_V,
        keys,
        REQUESTOR_KEY_CANDIDATES,
      ),
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
