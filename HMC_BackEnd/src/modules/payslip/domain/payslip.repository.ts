import { Lang } from '@shared/domain/lang';

export interface PayslipPeriod {
  period: string;
  [extra: string]: unknown;
}

export interface PayslipCount {
  count: number;
}

export interface PayslipDocument {
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  [extra: string]: unknown;
}

export interface GeneratePayslipQuery {
  employeeNumber: string;
  lang: Lang;
  payPeriod: string;
  assignmentId: string;
}

/** Port: payslip periods (5), count (6), generate (11). All Oracle procs/functions. */
export interface PayslipRepository {
  getPeriods(employeeNumber: string, lang: Lang): Promise<PayslipPeriod[]>;
  checkCount(employeeNumber: string, lang: Lang, payslipPeriod: string): Promise<PayslipCount>;
  generate(query: GeneratePayslipQuery): Promise<PayslipDocument>;
}

export const PAYSLIP_REPOSITORY = Symbol('PAYSLIP_REPOSITORY');
