import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { AuthenticatedUser, Role } from '@core/auth/auth-user.interface';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { ApiReadOkResponse } from '@shared/swagger/api-read-ok-response.decorator';
import { EmployeeService, SupervisorService } from '../application/employee.service';
import {
  EMPLOYEE_EMPLOYMENT_EXAMPLE,
  EMPLOYEE_PERFORMANCE_EXAMPLE,
  EMPLOYEE_SUPERVISOR_UPDATE_BODY,
} from './employee.examples';

/** Employee endpoints (ops 3, 7, 8, 35, 36). See Docs_Ai/API/README.md. */
@ApiTags('employee')
@ApiBearerAuth()
@Controller('employee')
export class EmployeeController {
  constructor(
    private readonly employee: EmployeeService,
    private readonly supervisor: SupervisorService,
  ) {}

  @Get('employment')
  @ApiOperation({ summary: 'op 3 — Employee (employment) details', operationId: 'employee_employment' })
  @ApiReadOkResponse({ example: EMPLOYEE_EMPLOYMENT_EXAMPLE })
  employment(@Query() q: ProfileQueryDto) {
    return this.employee.employment(q.enum, q.lang);
  }

  @Get('basic')
  @ApiOperation({ summary: 'op 8 — Basic employee info', operationId: 'employee_basic' })
  @ApiReadOkResponse({ example: EMPLOYEE_EMPLOYMENT_EXAMPLE })
  basic(@Query() q: ProfileQueryDto) {
    return this.employee.basic(q.enum, q.lang);
  }

  @Get('performance')
  @ApiOperation({ summary: 'op 7 — Performance records', operationId: 'employee_performance' })
  @ApiReadOkResponse({ example: EMPLOYEE_PERFORMANCE_EXAMPLE })
  performance(@Query() q: ProfileQueryDto) {
    return this.employee.performance(q.enum, q.lang);
  }

  @Get('supervisor/views')
  @Roles(Role.SUPERVISOR)
  @ApiOperation({ summary: 'op 35 — Supervisor view', operationId: 'employee_supervisorViews' })
  supervisorViews(@Query() q: ProfileQueryDto) {
    return this.supervisor.views(q.enum, q.lang);
  }

  @Post('supervisor')
  @Roles(Role.SUPERVISOR)
  @ApiOperation({ summary: 'op 36 — Supervisor update', operationId: 'employee_supervisorUpdate' })
  @ApiBody(EMPLOYEE_SUPERVISOR_UPDATE_BODY)
  @ApiOkResponse({ type: SubmitResultDto })
  supervisorUpdate(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    // Accepts the spec's SUPERVISOR_PR body (p_* keys, incl. attachments).
    return this.supervisor.update(body, user, lang);
  }
}
