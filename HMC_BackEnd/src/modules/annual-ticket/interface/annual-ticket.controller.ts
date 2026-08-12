import { Body, Controller, Get, Post, Query, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LangQueryDto } from '@shared/dto/lang-query.dto';
import { LovResponseDto } from '@shared/dto/lov-response.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { AnnualTicketService } from '../application/annual-ticket.service';
import { AnnualTicketApplyRequestDto } from './dto/annual-ticket.dto';
import { ANNUAL_TICKET_APPLY_BODY } from './annual-ticket.examples';

/** Annual-ticket endpoints (ops 66, 67). See Docs_Ai/API/README.md. */
@ApiTags('annual-ticket')
@ApiBearerAuth()
@Controller('annual-ticket')
export class AnnualTicketController {
  constructor(private readonly service: AnnualTicketService) {}

  @Get('master')
  @ApiOperation({ summary: 'op 66 — Annual ticket master LOV', operationId: 'annualTicket_master' })
  @ApiOkResponse({ type: LovResponseDto })
  async master(
    @Query() q: LangQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LovResponseDto> {
    return { items: await this.service.master(q.lang, user.username) };
  }

  @Post('apply')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 67 — Submit annual ticket', operationId: 'annualTicket_apply' })
  @ApiBody(ANNUAL_TICKET_APPLY_BODY)
  @ApiOkResponse({ type: SubmitResultDto })
  apply(
    @Body() body: AnnualTicketApplyRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    // Accepts the spec's TICKET_REQ_PR body (p_* keys, incl. passengers + attachments).
    return this.service.apply(body, user, lang);
  }
}
