import { Body, Controller, Get, Post, Query, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LangQueryDto } from '@shared/dto/lang-query.dto';
import { ProfileQueryDto, LovUserQueryDto } from '@shared/dto/common-query.dto';
import { LovResponseDto } from '@shared/dto/lov-response.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { ApiReadOkResponse } from '@shared/swagger/api-read-ok-response.decorator';
import { LeaveService } from '../application/leave.service';
import {
  ApplyLeaveRequestDto,
  LeaveAmendRequestDto,
  LeaveBalanceQueryDto,
  LeaveCalcRequestDto,
  LeaveCancelRequestDto,
  LeaveReturnRequestDto,
} from './dto/leave.dto';
import {
  LEAVE_AMEND_BODY,
  LEAVE_CANCEL_BODY,
  LEAVE_CLASSES_LOV_EXAMPLE,
  LEAVE_DEFAULTS_EXAMPLE,
  LEAVE_EMPTY_ITEMS_EXAMPLE,
  LEAVE_REASONS_LOV_EXAMPLE,
  LEAVE_REQUEST_LOV_EXAMPLE,
  LEAVE_RETURN_BODY,
  LEAVE_TYPES_LOV_EXAMPLE,
} from './leave.examples';

/** Leave endpoints (14 ops). See Docs_Ai/API/README.md — Module: leave. */
@ApiTags('leave')
@ApiBearerAuth()
@Controller('leave')
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @Get('balance')
  @ApiOperation({ summary: 'op 9 — Leave balance', operationId: 'leave_balance' })
  balance(@Query() q: LeaveBalanceQueryDto) {
    return this.service.getBalance(q.enum, q.lang, q.effectivedate, q.accurlpln);
  }

  @Post('apply')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 10 — Leave submission', operationId: 'leave_apply' })
  @ApiOkResponse({ type: SubmitResultDto })
  apply(
    @Body() dto: ApplyLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.service.apply({ ...dto }, user, lang);
  }

  @Post('calculate')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 47 — Leave duration calculation', operationId: 'leave_calculate' })
  calculate(
    @Body() dto: LeaveCalcRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.service.calculate(dto.absenceType, dto.startDate, dto.endDate, user, lang);
  }

  @Post('amend')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 57 — Leave amend', operationId: 'leave_amend' })
  @ApiBody(LEAVE_AMEND_BODY)
  @ApiOkResponse({ type: SubmitResultDto })
  amend(
    @Body() body: LeaveAmendRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    // Accepts the spec's HR_LEAV_AMEND_PR body (p_* keys, incl. attachments).
    return this.service.amend(body, user, lang);
  }

  @Post('cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 58 — Leave cancel', operationId: 'leave_cancel' })
  @ApiBody(LEAVE_CANCEL_BODY)
  @ApiOkResponse({ type: SubmitResultDto })
  cancel(
    @Body() body: LeaveCancelRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    // Accepts the spec's HR_LEAV_CANCEL_PR body (p_* keys, incl. attachments).
    return this.service.cancel(body, user, lang);
  }

  @Post('return')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 56 — Return from leave', operationId: 'leave_return' })
  @ApiBody(LEAVE_RETURN_BODY)
  @ApiOkResponse({ type: SubmitResultDto })
  returnFromLeave(
    @Body() body: LeaveReturnRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    // Accepts the spec's RET_FRM_LEAV_PR body (p_* keys, incl. attachments).
    return this.service.returnFromLeave(body, user, lang);
  }

  @Get('lov/types')
  @ApiOperation({ summary: 'op 12 — Leave types LOV', operationId: 'leave_typesLov' })
  @ApiOkResponse({ type: LovResponseDto })
  @ApiReadOkResponse({ example: LEAVE_TYPES_LOV_EXAMPLE })
  async types(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.types(q.lang) };
  }

  @Get('lov/reasons')
  @ApiOperation({ summary: 'op 13 — Leave reasons LOV', operationId: 'leave_reasonsLov' })
  @ApiOkResponse({ type: LovResponseDto })
  @ApiReadOkResponse({ example: LEAVE_REASONS_LOV_EXAMPLE })
  async reasons(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.reasons(q.lang) };
  }

  @Get('lov/classes')
  @ApiOperation({ summary: 'op 14 — Leave classes LOV', operationId: 'leave_classesLov' })
  @ApiOkResponse({ type: LovResponseDto })
  @ApiReadOkResponse({ example: LEAVE_CLASSES_LOV_EXAMPLE })
  async classes(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.classes(q.lang) };
  }

  @Get('lov/defaults')
  @ApiOperation({ summary: 'op 45 — Leave defaults', operationId: 'leave_defaults' })
  @ApiReadOkResponse({ example: LEAVE_DEFAULTS_EXAMPLE })
  defaults(@Query() q: ProfileQueryDto) {
    return this.service.defaults(q.enum, q.lang);
  }

  @Get('lov/request-lov')
  @ApiOperation({ summary: 'op 46 — Leave request LOVs', operationId: 'leave_requestLov' })
  @ApiReadOkResponse({ example: LEAVE_REQUEST_LOV_EXAMPLE })
  requestLov(@Query() q: ProfileQueryDto) {
    return this.service.requestLov(q.lang);
  }

  @Get('lov/return')
  @ApiOperation({ summary: 'op 55 — Return-from-leave LOV', operationId: 'leave_returnLov' })
  @ApiOkResponse({ type: LovResponseDto })
  @ApiReadOkResponse({ example: LEAVE_EMPTY_ITEMS_EXAMPLE })
  async returnLov(@Query() q: LovUserQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.returnLov(q.username, q.lang) };
  }

  @Get('lov/cancel')
  @ApiOperation({ summary: 'op 61 — Leave cancel LOV', operationId: 'leave_cancelLov' })
  @ApiOkResponse({ type: LovResponseDto })
  @ApiReadOkResponse({ example: LEAVE_EMPTY_ITEMS_EXAMPLE })
  async cancelLov(@Query() q: LovUserQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.cancelLov(q.username, q.lang) };
  }

  @Get('lov/amend')
  @ApiOperation({ summary: 'op 62 — Leave amend LOV', operationId: 'leave_amendLov' })
  @ApiOkResponse({ type: LovResponseDto })
  @ApiReadOkResponse({ example: LEAVE_EMPTY_ITEMS_EXAMPLE })
  async amendLov(@Query() q: LovUserQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.amendLov(q.username, q.lang) };
  }
}
