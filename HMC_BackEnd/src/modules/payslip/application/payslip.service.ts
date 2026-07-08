import { Inject, Injectable } from '@nestjs/common';
import { Lang } from '@shared/domain/lang';
import {
  PAYSLIP_REPOSITORY,
  PayslipCount,
  PayslipDocument,
  PayslipPeriod,
  PayslipRepository,
} from '../domain/payslip.repository';

/** Application service for payslip (ops 5, 6, 11). */
@Injectable()
export class PayslipService {
  constructor(@Inject(PAYSLIP_REPOSITORY) private readonly repo: PayslipRepository) {}

  getPeriods(employeeNumber: string, lang: Lang): Promise<PayslipPeriod[]> {
    return this.repo.getPeriods(employeeNumber, lang);
  }

  checkCount(employeeNumber: string, lang: Lang, payslipPeriod: string): Promise<PayslipCount> {
    return this.repo.checkCount(employeeNumber, lang, payslipPeriod);
  }

  generate(
    employeeNumber: string,
    lang: Lang,
    payPeriod: string,
    assignmentId: string,
  ): Promise<PayslipDocument> {
    return this.repo.generate({ employeeNumber, lang, payPeriod, assignmentId });
  }
}
