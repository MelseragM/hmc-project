import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LangQueryDto } from '@shared/dto/lang-query.dto';
import { ProfileQueryDto, LovUserQueryDto } from '@shared/dto/common-query.dto';
import { LovResponseDto } from '@shared/dto/lov-response.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { LeaveService } from '../application/leave.service';
import {
  ApplyLeaveRequestDto,
  LeaveBalanceQueryDto,
  LeaveCalcRequestDto,
  LeaveMutationRequestDto,
} from './dto/leave.dto';

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
  @ApiOperation({ summary: 'op 47 — Leave duration calculation', operationId: 'leave_calculate' })
  calculate(
    @Body() dto: LeaveCalcRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.service.calculate(dto.absenceType, dto.startDate, dto.endDate, user, lang);
  }

  @Post('amend')
  @ApiOperation({ summary: 'op 57 — Leave amend', operationId: 'leave_amend' })
  @ApiOkResponse({ type: SubmitResultDto })
  amend(
    @Body() dto: LeaveMutationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.service.amend({ ...dto }, user, lang);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'op 58 — Leave cancel', operationId: 'leave_cancel' })
  @ApiOkResponse({ type: SubmitResultDto })
  cancel(
    @Body() dto: LeaveMutationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.service.cancel({ ...dto }, user, lang);
  }

  @Post('return')
  @ApiOperation({ summary: 'op 56 — Return from leave', operationId: 'leave_return' })
  @ApiOkResponse({ type: SubmitResultDto })
  returnFromLeave(
    @Body() dto: LeaveMutationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.service.returnFromLeave({ ...dto }, user, lang);
  }

  @Get('lov/types')
  @ApiOperation({ summary: 'op 12 — Leave types LOV', operationId: 'leave_typesLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async types(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.types(q.lang) };
  }

  @Get('lov/reasons')
  @ApiOperation({ summary: 'op 13 — Leave reasons LOV', operationId: 'leave_reasonsLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async reasons(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.reasons(q.lang) };
  }

  @Get('lov/classes')
  @ApiOperation({ summary: 'op 14 — Leave classes LOV', operationId: 'leave_classesLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async classes(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.classes(q.lang) };
  }

  @Get('lov/defaults')
  @ApiOperation({ summary: 'op 45 — Leave defaults', operationId: 'leave_defaults' })
  defaults(@Query() q: ProfileQueryDto) {
    return this.service.defaults(q.enum, q.lang);
  }

  @Get('lov/request-lov')
  @ApiOperation({ summary: 'op 46 — Leave request LOVs', operationId: 'leave_requestLov' })
  requestLov(@Query() q: ProfileQueryDto) {
    return this.service.requestLov(q.lang);
  }

  @Get('lov/return')
  @ApiOperation({ summary: 'op 55 — Return-from-leave LOV', operationId: 'leave_returnLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async returnLov(@Query() q: LovUserQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.returnLov(q.username, q.lang) };
  }

  @Get('lov/cancel')
  @ApiOperation({ summary: 'op 61 — Leave cancel LOV', operationId: 'leave_cancelLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async cancelLov(@Query() q: LovUserQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.cancelLov(q.username, q.lang) };
  }

  @Get('lov/amend')
  @ApiOperation({ summary: 'op 62 — Leave amend LOV', operationId: 'leave_amendLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async amendLov(@Query() q: LovUserQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.amendLov(q.username, q.lang) };
  }
}
