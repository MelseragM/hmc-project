import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';

export type ApprovalRow = Record<string, unknown>;

export interface ApprovalsSummary {
  approvals: ApprovalRow[];
  pendingQid: ApprovalRow[];
}

export interface MyRequests {
  requests: ApprovalRow[];
  pendingQid: ApprovalRow[];
}

export type ApprovalDecision = 'APPROVE' | 'REJECT';

/** How a worklist task is handed over (documented `p_type` of REASSIGN_PR). */
export type ReassignType = 'DELEGATE' | 'TRANSFER';

export interface DecisionCommand {
  username: string;
  lang: Lang;
  /** Notification id — the path parameter of the decision route. */
  approvalId: string;
  /** Workflow item type, `HRSSA` for the HR self-service flows. */
  itemType: string;
  /** Workflow item key of the request being approved. */
  itemKey: string;
  decision: ApprovalDecision;
  comment?: string;
}

export interface ReassignCommand {
  username: string;
  lang: Lang;
  approvalId: string;
  assignTo: string;
  type: ReassignType;
  comment?: string;
}

/**
 * Request-more-information on a notification (HR_RFMI_PR). `mode` is the
 * procedure's `p_mode`; `toUsername` (`p_to_user_name`, optional) is who the
 * question is directed to — pick from the RFMI user LOV (op 26).
 */
export interface RequestInfoCommand {
  /** Caller — bound as `p_from_user_name`. */
  username: string;
  lang: Lang;
  /** Notification id — the path parameter of the route (`p_notification_id`). */
  approvalId: string;
  toUsername?: string;
  /** Workflow item type, `HRSSA` for the HR self-service flows. */
  itemType: string;
  itemKey: string;
  mode: string;
  comment: string;
}

/**
 * Port: approvals summary/detail/decision/my-requests (ops 20, 21, 22, 23).
 * The reads are scoped by the caller's username — the legacy services take
 * USER_NAME, and the views carry no employee-number column.
 */
export interface ApprovalsRepository {
  /**
   * `keys` are the caller's identifiers in BOTH forms (login + employee
   * number): APPROVE_SUMRY_V / MY_REQEST_SUMMARY_V store the employee number
   * while PNDNG_QID_V stores the login, and one response reads both.
   */
  getSummary(keys: readonly string[], lang: Lang): Promise<ApprovalsSummary>;
  getDetails(approvalId: string, lang: Lang): Promise<ApprovalRow[]>;
  decide(cmd: DecisionCommand): Promise<SubmitResult>;
  requestInfo(cmd: RequestInfoCommand): Promise<SubmitResult>;
  getMyRequests(keys: readonly string[], lang: Lang): Promise<MyRequests>;
}
export const APPROVALS_REPOSITORY = Symbol('APPROVALS_REPOSITORY');

/** Port: worklist main/summary/history + reassign (ops 68, 69, 70, 71). */
export interface WorklistRepository {
  getWorklist(username: string, lang: Lang): Promise<ApprovalRow[]>;
  getWorklistSummary(
    username: string,
    lang: Lang,
    notificationId?: string,
  ): Promise<ApprovalRow[]>;
  getActionHistory(itemKey: string, lang: Lang, itemType?: string): Promise<ApprovalRow[]>;
  reassign(cmd: ReassignCommand): Promise<SubmitResult>;
}
export const WORKLIST_REPOSITORY = Symbol('WORKLIST_REPOSITORY');
