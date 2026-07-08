import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lang } from '@core/i18n/lang.decorator';
import type { Lang as LangCode } from '@shared/domain/lang';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { LangQueryDto } from '@shared/dto/lang-query.dto';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { SubmitResultDto } from '@shared/dto/submit-result.dto';
import { AppointmentsService } from '../application/appointments.service';
import { BookAppointmentRequestDto } from './dto/appointments.dto';

/** Appointments endpoints (Cerner — ops 41-44). See Docs_Ai/API/README.md. */
@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get('upcoming')
  @ApiOperation({ summary: 'op 41 — Upcoming staff-clinic appointments', operationId: 'appointments_upcoming' })
  upcoming(@Query() q: ProfileQueryDto) {
    return this.service.getUpcoming(q.enum, q.lang);
  }

  @Get('masters')
  @ApiOperation({ summary: 'op 42 — Clinic master details', operationId: 'appointments_masters' })
  masters(@Query() q: LangQueryDto) {
    return this.service.getMasters(q.lang);
  }

  @Get('booking-init')
  @ApiOperation({ summary: 'op 43 — Booking screen init', operationId: 'appointments_bookingInit' })
  bookingInit(@Query() q: ProfileQueryDto) {
    return this.service.initBooking(q.enum, q.lang);
  }

  @Post('book')
  @ApiOperation({ summary: 'op 44 — Book appointment', operationId: 'appointments_book' })
  @ApiOkResponse({ type: SubmitResultDto })
  book(
    @Body() dto: BookAppointmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Lang() lang: LangCode,
  ) {
    return this.service.book({ ...dto }, user, lang);
  }
}
