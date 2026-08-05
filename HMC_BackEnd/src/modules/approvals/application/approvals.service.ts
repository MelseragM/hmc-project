import { Inject, Injectable } from '@nestjs/common';
import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import {
  APPROVALS_REPOSITORY,
  ApprovalDecision,
  ApprovalRow,
  ApprovalsRepository,
  ApprovalsSummary,
  MyRequests,
  ReassignType,
  WORKLIST_REPOSITORY,
  WorklistRepository,
} from '../domain/approvals.repository';

/** Approvals summary/detail/decision/my-requests (ops 20, 21, 22, 23). */
@Injectable()
export class ApprovalsService {
  constructor(@Inject(APPROVALS_REPOSITORY) private readonly repo: ApprovalsRepository) {}

  summary(username: string, lang: Lang): Promise<ApprovalsSummary> {
    return this.repo.getSummary(username, lang);
  }

  details(approvalId: string, lang: Lang): Promise<ApprovalRow[]> {
    return this.repo.getDetails(approvalId, lang);
  }

  decide(
    approvalId: string,
    dto: { decision: ApprovalDecision; itemType: string; itemKey: string; comment?: string },
    user: AuthenticatedUser,
    lang: Lang,
  ): Promise<SubmitResult> {
    return this.repo.decide({ username: user.username, lang, approvalId, ...dto });
  }

  myRequests(username: string, lang: Lang): Promise<MyRequests> {
    return this.repo.getMyRequests(username, lang);
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
