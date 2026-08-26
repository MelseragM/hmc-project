import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import {
  APPROVALS_REPOSITORY,
  ApprovalDecision,
  ApprovalRow,
  ApprovalsRepository,
  ApprovalsSummary,
  AttachmentContent,
  MyRequests,
  ReassignType,
  RequestAttachment,
  WORKLIST_REPOSITORY,
  WorklistRepository,
} from '../domain/approvals.repository';
import { RequestField, buildRequestFields, requestTypeKeyOf } from '../domain/request-fields';

/** Controller-facing shape of the RFMI submit (route carries the notification id). */
export interface RequestInfoDto {
  itemType: string;
  itemKey: string;
  mode: string;
  comment: string;
  toUsername?: string;
}

/** Display-ready response of op 21 — see `details()`. */
export interface RequestDetailResponse {
  notificationId: string;
  itemKey: string | null;
  itemType: string | null;
  /** Localised label, e.g. `Request School Fee Reimb`. */
  requestType: string | null;
  /** Stable key for client-side branching, e.g. `SCHOOL_FEE`. */
  requestTypeKey: string | null;
  serviceView: string | null;
  subject: string | null;
  requestor: { userName: string | null; name: string | null };
  approver: { userName: string | null; name: string | null };
  submittedAt: string | null;
  dueDate: string | null;
  /** False when the notification id matched nothing (still HTTP 200). */
  found: boolean;
  fields: RequestField[];
  values: Record<string, string | number | null>;
  attachments: RequestAttachment[];
}

/** Approvals summary/detail/decision/my-requests (ops 20, 21, 22, 23). */
@Injectable()
export class ApprovalsService {
  constructor(@Inject(APPROVALS_REPOSITORY) private readonly repo: ApprovalsRepository) {}

  /**
   * `identifier` is whatever the client sent (`enum`) — login or employee
   * number. `user` adds the authenticated identity, so the views that store the
   * other form still match without the client having to know which is which.
   */
  summary(identifier: string, lang: Lang, user?: AuthenticatedUser): Promise<ApprovalsSummary> {
    return this.repo.getSummary(ApprovalsService.keysOf(identifier, user), lang);
  }

  /** Caller identifiers in every form the approvals views may store. */
  private static keysOf(identifier: string, user?: AuthenticatedUser): string[] {
    return [...new Set([identifier, user?.username, user?.employeeNumber].filter(Boolean))] as string[];
  }

  /**
   * op 21 — one request, ready to render.
   *
   * The client gets an ordered `fields` list (label key + value + value kind)
   * instead of the raw columns of whichever of the 17 detail views this request
   * happens to live in, so a single screen renders every request type and a new
   * column does not need an app release. `values` is the same data as a flat
   * map, for validation/filtering, and `attachments` carries a download path
   * per file.
   */
  async details(approvalId: string, lang: Lang): Promise<RequestDetailResponse> {
    const src = await this.repo.getDetails(approvalId, lang);
    const header = src.header ?? {};
    const { fields, values } = buildRequestFields(src.serviceView, src.detailRow);
    const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
    const date = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

    return {
      notificationId: approvalId,
      itemKey: src.itemKey,
      itemType: str(header.ITEM_TYPE),
      requestType: str(header.SERVICE_REQUEST),
      requestTypeKey: requestTypeKeyOf(src.serviceView),
      serviceView: src.serviceView,
      subject: str(header.SUBJECT),
      requestor: { userName: str(header.REQUESTOR_USER_NAME), name: str(header.REQUESTOR_NAME) },
      approver: { userName: str(header.APPROVER_USER_NAME), name: str(header.APPROVER_NAME) },
      submittedAt: date(src.detailRow?.DATE_OF_SUBMISSION ?? header.BEGIN_DATE),
      dueDate: date(header.DUE_DATE),
      found: !!src.header,
      fields,
      values,
      attachments: src.attachments,
    };
  }

  async attachment(attachedDocumentId: string): Promise<AttachmentContent> {
    const file = await this.repo.getAttachmentContent(attachedDocumentId);
    if (!file) throw new NotFoundException(`Attachment ${attachedDocumentId} was not found.`);
    return file;
  }

  decide(
    approvalId: string,
    dto: { decision: ApprovalDecision; itemType: string; itemKey: string; comment?: string },
    user: AuthenticatedUser,
    lang: Lang,
  ): Promise<SubmitResult> {
    return this.repo.decide({ username: user.username, lang, approvalId, ...dto });
  }

  requestInfo(
    approvalId: string,
    dto: RequestInfoDto,
    user: AuthenticatedUser,
    lang: Lang,
  ): Promise<SubmitResult> {
    return this.repo.requestInfo({ username: user.username, lang, approvalId, ...dto });
  }

  myRequests(identifier: string, lang: Lang, user?: AuthenticatedUser): Promise<MyRequests> {
    return this.repo.getMyRequests(ApprovalsService.keysOf(identifier, user), lang);
  }
}

/** Worklist main/summary/history + reassign (ops 68, 69, 70, 71). */
@Injectable()
export class WorklistService {
  constructor(@Inject(WORKLIST_REPOSITORY) private readonly repo: WorklistRepository) {}

  worklist(username: string, lang: Lang): Promise<ApprovalRow[]> {
    return this.repo.getWorklist(username, lang);
  }

  worklistSummary(username: string, lang: Lang, notificationId?: string): Promise<ApprovalRow[]> {
    return this.repo.getWorklistSummary(username, lang, notificationId);
  }

  history(itemKey: string, lang: Lang, itemType?: string): Promise<ApprovalRow[]> {
    return this.repo.getActionHistory(itemKey, lang, itemType);
  }

  reassign(
    approvalId: string,
    dto: { assignTo: string; type: ReassignType; comment?: string },
    user: AuthenticatedUser,
    lang: Lang,
  ): Promise<SubmitResult> {
    return this.repo.reassign({ username: user.username, lang, approvalId, ...dto });
  }
}
