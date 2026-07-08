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

export interface DecisionCommand {
  username: string;
  lang: Lang;
  approvalId: string;
  decision: ApprovalDecision;
  comment?: string;
}

export interface ReassignCommand {
  username: string;
  lang: Lang;
  approvalId: string;
  assignTo: string;
  comment?: string;
}

/** Port: approvals summary/detail/decision/my-requests (ops 20, 21, 22, 23). */
export interface ApprovalsRepository {
  getSummary(employeeNumber: string, lang: Lang): Promise<ApprovalsSummary>;
  getDetails(approvalId: string, lang: Lang): Promise<ApprovalRow[]>;
  decide(cmd: DecisionCommand): Promise<SubmitResult>;
  getMyRequests(employeeNumber: string, lang: Lang): Promise<MyRequests>;
}
export const APPROVALS_REPOSITORY = Symbol('APPROVALS_REPOSITORY');

/** Port: worklist main/summary/history + reassign (ops 68, 69, 70, 71). */
export interface WorklistRepository {
  getWorklist(employeeNumber: string, lang: Lang): Promise<ApprovalRow[]>;
  getWorklistSummary(employeeNumber: string, lang: Lang): Promise<ApprovalRow[]>;
  getActionHistory(approvalId: string, lang: Lang): Promise<ApprovalRow[]>;
  reassign(cmd: ReassignCommand): Promise<SubmitResult>;
}
export const WORKLIST_REPOSITORY = Symbol('WORKLIST_REPOSITORY');
