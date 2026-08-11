import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { ApiReadOkResponse } from '@shared/swagger/api-read-ok-response.decorator';
import { PayslipService } from '../application/payslip.service';
import { PayslipCountQueryDto, PayslipQueryDto } from './dto/payslip-query.dto';
import { PAYSLIP_COUNT_EXAMPLE, PAYSLIP_PERIODS_EXAMPLE } from './payslip.examples';

/** Payslip endpoints (ops 5, 6, 11). See Docs_Ai/API/README.md. */
@ApiTags('payslip')
@ApiBearerAuth()
@Controller('payslip')
export class PayslipController {
  constructor(private readonly service: PayslipService) {}

  @Get('periods')
  @ApiOperation({ summary: 'op 5 — Payslip periods', operationId: 'payslip_periods' })
  @ApiQuery({ name: 'enum', description: 'Username (Oracle login, e.g. V-xxx).', example: 'AIBRAHIM39' })
  @ApiReadOkResponse({ example: PAYSLIP_PERIODS_EXAMPLE })
  periods(@Query() q: ProfileQueryDto) {
    return this.service.getPeriods(q.enum, q.lang);
  }

  @Get('count')
  @ApiOperation({ summary: 'op 6 — Payslip count for a period', operationId: 'payslip_count' })
  @ApiQuery({ name: 'enum', description: 'Person ID (numeric Oracle PERSON_ID).', example: '852709' })
  @ApiReadOkResponse({ example: PAYSLIP_COUNT_EXAMPLE })
  count(@Query() q: PayslipCountQueryDto) {
    return this.service.checkCount(q.enum, q.lang, q.payslipperiod);
  }

  @Get()
  @ApiOperation({ summary: 'op 11 — Generate payslip', operationId: 'payslip_generate' })
  generate(@Query() q: PayslipQueryDto) {
    return this.service.generate(q.enum, q.lang, q.payperiod, q.assignmentid);
  }
}
