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
  WORKLIST_REPOSITORY,
  WorklistRepository,
} from '../domain/approvals.repository';

/** Approvals summary/detail/decision/my-requests (ops 20, 21, 22, 23). */
@Injectable()
export class ApprovalsService {
  constructor(@Inject(APPROVALS_REPOSITORY) private readonly repo: ApprovalsRepository) {}

  summary(employeeNumber: string, lang: Lang): Promise<ApprovalsSummary> {
    return this.repo.getSummary(employeeNumber, lang);
  }

  details(approvalId: string, lang: Lang): Promise<ApprovalRow[]> {
    return this.repo.getDetails(approvalId, lang);
  }

  decide(
    approvalId: string,
    decision: ApprovalDecision,
    comment: string | undefined,
    user: AuthenticatedUser,
    lang: Lang,
  ): Promise<SubmitResult> {
    return this.repo.decide({ username: user.username, lang, approvalId, decision, comment });
  }

  myRequests(employeeNumber: string, lang: Lang): Promise<MyRequests> {
    return this.repo.getMyRequests(employeeNumber, lang);
  }
}

/** Worklist main/summary/history + reassign (ops 68, 69, 70, 71). */
@Injectable()
export class WorklistService {
  constructor(@Inject(WORKLIST_REPOSITORY) private readonly repo: WorklistRepository) {}

  worklist(employeeNumber: string, lang: Lang): Promise<ApprovalRow[]> {
    return this.repo.getWorklist(employeeNumber, lang);
  }

  worklistSummary(employeeNumber: string, lang: Lang): Promise<ApprovalRow[]> {
    return this.repo.getWorklistSummary(employeeNumber, lang);
  }

  history(approvalId: string, lang: Lang): Promise<ApprovalRow[]> {
    return this.repo.getActionHistory(approvalId, lang);
  }

  reassign(
    approvalId: string,
    assignTo: string,
    comment: string | undefined,
    user: AuthenticatedUser,
    lang: Lang,
  ): Promise<SubmitResult> {
    return this.repo.reassign({ username: user.username, lang, approvalId, assignTo, comment });
  }
}
