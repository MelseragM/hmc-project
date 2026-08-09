import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang, toOracleLanguage } from '@shared/domain/lang';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import {
  GeneratePayslipQuery,
  PayslipCount,
  PayslipDocument,
  PayslipPeriod,
  PayslipRepository,
} from '../../domain/payslip.repository';

/**
 * GET_PAYSLIP_PERIODS input params. The procedure is keyed by the caller's login
 * (`p_user_name`), not the person id — binding `person_id` left `p_user_name`
 * NULL and the call returned no periods. The cursor OUT parameter is
 * `p_get_periods` (used only when the data dictionary is unreadable).
 */
const PERIODS_PARAMS = ['user_name', 'language'] as const;

/** CHK_PAYROLL_CNT input params (Sanaad spec — CHECK_PAYSLIP_COUNT: PERSON_ID, LANGUAGE, PERIOD). */
const COUNT_PARAMS = ['person_id', 'language', 'period'] as const;

/** PAYSLIP_PR input params (Sanaad spec — generatepayslip request template). */
const GENERATE_PARAMS = ['person_id', 'language', 'period', 'assignment_id'] as const;

/**
 * Payroll is served by Oracle program units (GET_PAYSLIP_PERIODS,
 * CHK_PAYROLL_CNT, PAYSLIP_PR) that return their rows through a REF CURSOR.
 *
 * The mapping documents the inputs of the legacy services but not the formal
 * parameter names, so the calls are built from the declared signature when the
 * data dictionary is readable (see BaseOracleRepository) and fall back to the
 * documented names otherwise; `pick` tolerates the `p_` prefix either way.
 */
@Injectable()
export class PayslipOracleRepository extends BaseOracleRepository implements PayslipRepository {
  constructor(ora: OracleService, schema: OracleSchemaService) {
    super(ora, schema);
  }

  getPeriods(username: string, lang: Lang): Promise<PayslipPeriod[]> {
    return this.callRowsProc<PayslipPeriod>(
      ORACLE_OBJECTS.GET_PAYSLIP_PERIODS,
      PERIODS_PARAMS,
      {
        user_name: username,
        language: toOracleLanguage(lang),
      },
      'p_get_periods',
    );
  }

  async checkCount(
    employeeNumber: string,
    lang: Lang,
    payslipPeriod: string,
  ): Promise<PayslipCount> {
    const rows = await this.callRowsProc<Record<string, unknown>>(
      ORACLE_OBJECTS.CHK_PAYROLL_CNT,
      COUNT_PARAMS,
      {
        person_id: employeeNumber,
        language: toOracleLanguage(lang),
        period: payslipPeriod,
      },
    );
    return { count: rows.length };
  }

  async generate(query: GeneratePayslipQuery): Promise<PayslipDocument> {
    const rows = await this.callRowsProc<Record<string, unknown>>(
      ORACLE_OBJECTS.PAYSLIP_PR,
      GENERATE_PARAMS,
      {
        person_id: query.employeeNumber,
        language: toOracleLanguage(query.lang),
        period: query.payPeriod,
        assignment_id: query.assignmentId,
      },
    );
    // The procedure returns the payslip as rows (earnings, deductions, totals),
    // not as a file; the service layer shapes them for the client.
    return { rows };
  }
}
