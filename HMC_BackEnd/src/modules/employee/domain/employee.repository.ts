import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { EmploymentDetails, PerformanceRecord, SupervisorView } from './entities/employment';

/** Port: employment reads (ops 3, 7, 8). */
export interface EmploymentRepository {
  getEmployment(employeeNumber: string, lang: Lang): Promise<EmploymentDetails | undefined>;
  getBasic(employeeNumber: string, lang: Lang): Promise<EmploymentDetails | undefined>;
  getPerformance(employeeNumber: string, lang: Lang): Promise<PerformanceRecord[]>;
}
export const EMPLOYMENT_REPOSITORY = Symbol('EMPLOYMENT_REPOSITORY');

export interface SupervisorUpdateCommand {
  username: string;
  lang: Lang;
  fields: Record<string, unknown>;
}

/** Port: supervisor view/update (ops 35, 36) — SUPERVISOR role. */
export interface SupervisorRepository {
  getSupervisorViews(employeeNumber: string, lang: Lang): Promise<SupervisorView[]>;
  updateSupervisor(cmd: SupervisorUpdateCommand): Promise<SubmitResult>;
}
export const SUPERVISOR_REPOSITORY = Symbol('SUPERVISOR_REPOSITORY');
