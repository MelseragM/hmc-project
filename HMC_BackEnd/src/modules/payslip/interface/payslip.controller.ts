import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { PayslipService } from '../application/payslip.service';
import { PayslipCountQueryDto, PayslipQueryDto } from './dto/payslip-query.dto';

/** Payslip endpoints (ops 5, 6, 11). See Docs_Ai/API/README.md. */
@ApiTags('payslip')
@ApiBearerAuth()
@Controller('payslip')
export class PayslipController {
  constructor(private readonly service: PayslipService) {}

  @Get('periods')
  @ApiOperation({ summary: 'op 5 — Payslip periods', operationId: 'payslip_periods' })
  periods(@Query() q: ProfileQueryDto) {
    return this.service.getPeriods(q.enum, q.lang);
  }

  @Get('count')
  @ApiOperation({ summary: 'op 6 — Payslip count for a period', operationId: 'payslip_count' })
  count(@Query() q: PayslipCountQueryDto) {
    return this.service.checkCount(q.enum, q.lang, q.payslipperiod);
  }

  @Get()
  @ApiOperation({ summary: 'op 11 — Generate payslip', operationId: 'payslip_generate' })
  generate(@Query() q: PayslipQueryDto) {
    return this.service.generate(q.enum, q.lang, q.payperiod, q.assignmentid);
  }
}
