import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { AuthenticatedUser, Role } from '@core/auth/auth-user.interface';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { ApprovalsService, WorklistService } from '../application/approvals.service';
import {
  ApprovalDetailQueryDto,
  ApproveRejectRequestDto,
  ReassignApprovalRequestDto,
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
  summary(@Query() q: ProfileQueryDto) {
    return this.approvals.summary(q.enum, q.lang);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'op 23 — My requests', operationId: 'approvals_myRequests' })
  myRequests(@Query() q: ProfileQueryDto) {
    return this.approvals.myRequests(q.enum, q.lang);
  }

  @Get('worklist')
  @ApiOperation({ summary: 'op 68 — Worklist main', operationId: 'approvals_worklist' })
  worklistMain(@Query() q: ProfileQueryDto) {
    return this.worklist.worklist(q.enum, q.lang);
  }

  @Get('worklist/summary')
  @ApiOperation({ summary: 'op 69 — Worklist summary', operationId: 'approvals_worklistSummary' })
  worklistSummary(@Query() q: ProfileQueryDto) {
    return this.worklist.worklistSummary(q.enum, q.lang);
  }

  @Get('worklist/:id/history')
  @ApiOperation({ summary: 'op 70 — Worklist action history', operationId: 'approvals_history' })
  history(@Param('id') id: string, @Query() q: ApprovalDetailQueryDto) {
    return this.worklist.history(id, q.lang);
  }

  @Get(':id/details')
  @ApiOperation({ summary: 'op 21 — Approval detail', operationId: 'approvals_details' })
  details(@Param('id') id: string, @Query() q: ApprovalDetailQueryDto) {
    return this.approvals.details(id, q.lang);
  }

  @Post(':id/decision')
  @ApiOperation({ summary: 'op 22 — Approve/Reject', operationId: 'approvals_decision' })
  @ApiOkResponse({ type: SubmitResultDto })
  decision(
    @Param('id') id: string,
    @Body() dto: ApproveRejectRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.approvals.decide(id, dto.decision, dto.comment, user, lang);
  }

  @Post(':id/reassign')
  @ApiOperation({ summary: 'op 71 — Reassign approval', operationId: 'approvals_reassign' })
  @ApiOkResponse({ type: SubmitResultDto })
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignApprovalRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.worklist.reassign(id, dto.assignTo, dto.comment, user, lang);
  }
}
