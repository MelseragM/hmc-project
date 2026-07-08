import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LangQueryDto } from '@shared/dto/lang-query.dto';
import { LovResponseDto } from '@shared/dto/lov-response.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { DependentService, PassportService } from '../application/dependents.service';
import {
  AddDependentRequestDto,
  DeleteDependentRequestDto,
  PassportDetailRequestDto,
  UpdateDependentRequestDto,
} from './dto/dependents.dto';

/** Dependents endpoints (ops 24, 31, 33, 34, 49, 64, 65). See Docs_Ai/API/README.md. */
@ApiTags('dependents')
@ApiBearerAuth()
@Controller('dependents')
export class DependentsController {
  constructor(
    private readonly dependents: DependentService,
    private readonly passport: PassportService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'op 65 — Add dependent', operationId: 'dependents_add' })
  @ApiOkResponse({ type: SubmitResultDto })
  add(
    @Body() dto: AddDependentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.dependents.add({ ...dto }, user, lang);
  }

  @Post('update')
  @ApiOperation({ summary: 'op 24 — Update dependent', operationId: 'dependents_update' })
  @ApiOkResponse({ type: SubmitResultDto })
  update(
    @Body() dto: UpdateDependentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.dependents.update({ ...dto }, user, lang);
  }

  @Post('delete')
  @ApiOperation({ summary: 'op 31 — Delete dependent', operationId: 'dependents_delete' })
  @ApiOkResponse({ type: SubmitResultDto })
  delete(
    @Body() dto: DeleteDependentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.dependents.delete(dto.dependentId, user, lang);
  }

  @Get('lov')
  @ApiOperation({ summary: 'op 64 — Dependent LOV', operationId: 'dependents_lov' })
  @ApiOkResponse({ type: LovResponseDto })
  async dependentLov(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.dependents.dependentLov(q.lang) };
  }

  @Get('passport/types')
  @ApiOperation({ summary: 'op 33 — Passport types', operationId: 'dependents_passportTypes' })
  @ApiOkResponse({ type: LovResponseDto })
  async passportTypes(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.passport.types(q.lang) };
  }

  @Post('passport/apply')
  @ApiOperation({ summary: 'op 34 — Passport detail request', operationId: 'dependents_passportApply' })
  @ApiOkResponse({ type: SubmitResultDto })
  passportApply(
    @Body() dto: PassportDetailRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.passport.apply({ ...dto }, user, lang);
  }

  @Get('passport/issue-place')
  @ApiOperation({ summary: 'op 49 — Passport issue place LOV', operationId: 'dependents_issuePlaceLov' })
  @ApiOkResponse({ type: LovResponseDto })
  async issuePlaceLov(@Query() q: LangQueryDto): Promise<LovResponseDto> {
    return { items: await this.passport.issuePlaceLov(q.lang) };
  }
}
