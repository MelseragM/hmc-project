import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { LangQueryDto } from '@shared/dto/lang-query.dto';
import { LovResponseDto } from '@shared/dto/lov-response.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { ProfileService } from '../application/profile.service';

/** Profile endpoints (ops 2, 48, 63). See Docs_Ai/API/README.md. */
@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'op 2 — Personal detail', operationId: 'profile_get' })
  get(@Query() q: ProfileQueryDto) {
    return this.service.getProfile(q.enum, q.lang);
  }

  @Post('personal')
  @ApiOperation({ summary: 'op 48 — Update personal details', operationId: 'profile_updatePersonal' })
  @ApiOkResponse({ type: SubmitResultDto })
  updatePersonal(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    // Accepts the spec's UPDATE_PERSONAL_INFO_PR body (p_* keys, incl. attachments).
    return this.service.updatePersonal(body, user, lang);
  }

  @Get('lov/marital-status')
  @ApiOperation({ summary: 'op 63 — Marital status LOV', operationId: 'profile_maritalLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async maritalStatusLov(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.service.maritalStatusLov(q.lang) };
  }
}
