import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { AuthenticatedUser, Role } from '@core/auth/auth-user.interface';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { EmployeeService, SupervisorService } from '../application/employee.service';
import { SupervisorUpdateRequestDto } from './dto/supervisor-update.request.dto';

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
  employment(@Query() q: ProfileQueryDto) {
    return this.employee.employment(q.enum, q.lang);
  }

  @Get('basic')
  @ApiOperation({ summary: 'op 8 — Basic employee info', operationId: 'employee_basic' })
  basic(@Query() q: ProfileQueryDto) {
    return this.employee.basic(q.enum, q.lang);
  }

  @Get('performance')
  @ApiOperation({ summary: 'op 7 — Performance records', operationId: 'employee_performance' })
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
  @ApiOkResponse({ type: SubmitResultDto })
  supervisorUpdate(
    @Body() dto: SupervisorUpdateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.supervisor.update({ ...dto }, user, lang);
  }
}
