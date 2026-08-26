import { Body, Controller, Get, Param, Post, Query, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { AuthenticatedUser, Role } from '@core/auth/auth-user.interface';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { VerifiedBody } from '@shared/dto/verified-body';
import { ApprovalsService, WorklistService } from '../application/approvals.service';
import {
  ActionHistoryQueryDto,
  ApprovalDetailQueryDto,
  ApproveRejectRequestDto,
  ReassignApprovalRequestDto,
  RequestInfoRequestDto,
  WorklistSummaryQueryDto,
} from './dto/approvals.dto';

/** Approvals/Worklist endpoints (ops 20-23, 68-71). APPROVER/SUPERVISOR only. */
@ApiTags('approvals')
@ApiBearerAuth()
@Roles(Role.APPROVER, Role.SUPERVISOR)
@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly worklist: WorklistService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'op 20 — Approvals summary', operationId: 'approvals_summary' })
  summary(@Query() q: ProfileQueryDto, @CurrentUser() user: AuthenticatedUser) {
    // `enum` accepts either the login or the employee number: the two views
    // behind this response store different forms of the same person.
    return this.approvals.summary(q.enum, q.lang, user);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'op 23 — My requests', operationId: 'approvals_myRequests' })
  myRequests(@Query() q: ProfileQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.approvals.myRequests(q.enum, q.lang, user);
  }

  @Get('worklist')
  @ApiOperation({ summary: 'op 68 — Worklist main', operationId: 'approvals_worklist' })
  worklistMain(@Query() q: ProfileQueryDto) {
    return this.worklist.worklist(q.enum, q.lang);
  }

  @Get('worklist/summary')
  @ApiOperation({ summary: 'op 69 — Worklist summary', operationId: 'approvals_worklistSummary' })
  worklistSummary(@Query() q: WorklistSummaryQueryDto) {
    return this.worklist.worklistSummary(q.enum, q.lang, q.notificationId);
  }

  /** `id` is the workflow ITEM_KEY that ACTION_HISTORY_V is keyed by. */
  @Get('worklist/:id/history')
  @ApiOperation({ summary: 'op 70 — Worklist action history', operationId: 'approvals_history' })
  history(@Param('id') id: string, @Query() q: ActionHistoryQueryDto) {
    return this.worklist.history(id, q.lang, q.itemType);
  }

  @Get(':id/details')
  @ApiOperation({ summary: 'op 21 — Approval detail', operationId: 'approvals_details' })
  details(@Param('id') id: string, @Query() q: ApprovalDetailQueryDto) {
    return this.approvals.details(id, q.lang);
  }

  /** Download one of the files listed by `:id/details` → `attachments[].url`. */
  @Get('attachments/:documentId')
  @ApiOperation({
    summary: 'op 21b — Download a request attachment',
    operationId: 'approvals_attachment',
  })
  attachment(@Param('documentId') documentId: string) {
    return this.approvals.attachment(documentId);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 22 — Approve/Reject', operationId: 'approvals_decision' })
  @ApiOkResponse({ type: SubmitResultDto })
  // `id` (notification id) and `itemKey` must come from the SAME row of
  // GET /approvals/worklist — Oracle Workflow rejects a mismatched pair with
  // "Attribute 'RESULT' does not exist for notification".
  @VerifiedBody(
    ApproveRejectRequestDto,
    { decision: 'APPROVE', itemKey: '18875905', itemType: 'HRSSA', comment: 'Approved.' },
    'Take the path id AND itemKey from one row of GET /approvals/worklist (STATUS=OPEN and actionable — FYI notifications reject APPROVE).',
  )
  decision(
    @Param('id') id: string,
    @Body() dto: ApproveRejectRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.approvals.decide(
      id,
      {
        decision: dto.decision,
        itemKey: dto.itemKey,
        itemType: dto.itemType ?? 'HRSSA',
        comment: dto.comment,
      },
      user,
      lang,
    );
  }

  /** `id` is the notification id, like the decision route. */
  @Post(':id/request-info')
  @HttpCode(200)
  @ApiOperation({
    summary: 'RFMI — Request more information (HR_RFMI_PR)',
    operationId: 'approvals_requestInfo',
  })
  @ApiOkResponse({ type: SubmitResultDto })
  @VerifiedBody(
    RequestInfoRequestDto,
    {
      itemKey: '18875965',
      itemType: 'HRSSA',
      mode: 'QUESTION',
      toUsername: 'V-NFERNANDO',
      comment: 'Please attach the supporting documents.',
    },
    'Verified against staging (successflag S) with a real OPEN notification of the caller — take id + itemKey from GET /approvals/worklist.',
  )
  requestInfo(
    @Param('id') id: string,
    @Body() dto: RequestInfoRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.approvals.requestInfo(
      id,
      {
        itemKey: dto.itemKey,
        itemType: dto.itemType ?? 'HRSSA',
        mode: dto.mode ?? 'QUESTION',
        comment: dto.comment,
        toUsername: dto.toUsername,
      },
      user,
      lang,
    );
  }

  @Post(':id/reassign')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 71 — Reassign approval', operationId: 'approvals_reassign' })
  @ApiOkResponse({ type: SubmitResultDto })
  @VerifiedBody(
    ReassignApprovalRequestDto,
    { assignTo: 'V-NFERNANDO', type: 'DELEGATE', comment: 'Reassigning while on leave.' },
    'Verified against staging (successflag S) with an OPEN notification owned by the caller — the path id comes from GET /approvals/worklist.',
  )
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignApprovalRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.worklist.reassign(
      id,
      { assignTo: dto.assignTo, type: dto.type ?? 'DELEGATE', comment: dto.comment },
      user,
      lang,
    );
  }
}
