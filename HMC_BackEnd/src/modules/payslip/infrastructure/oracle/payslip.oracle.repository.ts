import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang } from '@shared/domain/lang';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import {
  GeneratePayslipQuery,
  PayslipCount,
  PayslipDocument,
  PayslipPeriod,
  PayslipRepository,
} from '../../domain/payslip.repository';

/**
 * Payroll is served by Oracle procedures/functions (GET_PAYSLIP_PERIODS,
 * CHK_PAYROLL_CNT, PAYSLIP_PR). Their bind signatures are not in the mapping,
 * so these are notImplemented stubs pending capture. TODO(bind).
 */
@Injectable()
export class PayslipOracleRepository extends BaseOracleRepository implements PayslipRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPeriods(_employeeNumber: string, _lang: Lang): Promise<PayslipPeriod[]> {
    return this.notImplemented(ORACLE_OBJECTS.GET_PAYSLIP_PERIODS);
  }

  async checkCount(
    _employeeNumber: string,
    _lang: Lang,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payslipPeriod: string,
  ): Promise<PayslipCount> {
    return this.notImplemented(ORACLE_OBJECTS.CHK_PAYROLL_CNT);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generate(_query: GeneratePayslipQuery): Promise<PayslipDocument> {
    return this.notImplemented(ORACLE_OBJECTS.PAYSLIP_PR);
  }
}
