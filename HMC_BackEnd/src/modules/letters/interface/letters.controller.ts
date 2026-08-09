import { Body, Controller, Get, Post, Query, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { LettersService } from '../application/letters.service';

/** Letters endpoints (ops 16, 17). See Docs_Ai/API/README.md. */
@ApiTags('letters')
@ApiBearerAuth()
@Controller('letters')
export class LettersController {
  constructor(private readonly service: LettersService) {}

  @Get('lov')
  @ApiOperation({ summary: 'op 16 — Letter request LOVs', operationId: 'letters_lov' })
  lov(@Query() q: ProfileQueryDto) {
    return this.service.getLetterLovs(q.lang, q.enum);
  }

  @Post('apply')
  @HttpCode(200)
  @ApiOperation({ summary: 'op 17 — Submit letter request', operationId: 'letters_apply' })
  @ApiOkResponse({ type: SubmitResultDto })
  apply(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    // Accepts the spec's HR_EMPLYMNT_LTR_PR body (p_* keys).
    return this.service.submit(body, user, lang);
  }
}
