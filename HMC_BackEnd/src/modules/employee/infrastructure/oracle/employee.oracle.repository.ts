import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang, toOracleLanguage } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';

/** SUPERVISOR_PR input params (Sanaad spec — SUPERVISOR_PR body). */
const SUPERVISOR_PR_PARAMS = [
  'p_user_name',
  'p_new_supervisor',
  'p_reason',
  'p_language',
  ...BaseOracleRepository.attachmentParams(),
] as const;
import { EmploymentDetails, PerformanceRecord, SupervisorView } from '../../domain/entities/employment';
import {
  EmploymentRepository,
  SupervisorRepository,
  SupervisorUpdateCommand,
} from '../../domain/employee.repository';
import { EmployeeMapper } from './employee.mapper';

/** Employment reads from EMPLOYMENT_DETAILS_V / PERFORMANCE_V (ops 3, 7, 8). */
@Injectable()
export class EmploymentOracleRepository
  extends BaseOracleRepository
  implements EmploymentRepository
{
  constructor(ora: OracleService, schema: OracleSchemaService) {
    super(ora, schema);
  }

  async getEmployment(employeeNumber: string, _lang: Lang): Promise<EmploymentDetails | undefined> {
    const rows = await this.readByEmployee(ORACLE_OBJECTS.EMPLOYMENT_DETAILS_V, employeeNumber);
    return EmployeeMapper.toEmployment(rows[0]);
  }

  async getBasic(employeeNumber: string, _lang: Lang): Promise<EmploymentDetails | undefined> {
    const rows = await this.readByEmployee(ORACLE_OBJECTS.EMPLOYMENT_DETAILS_V, employeeNumber);
    return EmployeeMapper.toEmployment(rows[0]);
  }

  async getPerformance(employeeNumber: string, _lang: Lang): Promise<PerformanceRecord[]> {
    // PERFORMANCE_V is keyed by USERNAME per the spec (Input: USERNAME,LANG);
    // emitted as an inline literal: WHERE username = '<enum>'.
    const rows = await this.readByUsername(ORACLE_OBJECTS.PERFORMANCE_V, employeeNumber);
    return rows.map((r) => EmployeeMapper.toPerformance(r));
  }
}

/** Supervisor view/update (ops 35, 36). SUPERVISOR_PR bind not captured → notImplemented. */
@Injectable()
export class SupervisorOracleRepository
  extends BaseOracleRepository
  implements SupervisorRepository
{
  constructor(ora: OracleService, schema: OracleSchemaService) {
    super(ora, schema);
  }

  getSupervisorViews(employeeNumber: string, _lang: Lang): Promise<SupervisorView[]> {
    return this.readByEmployee<SupervisorView>(ORACLE_OBJECTS.SUPERVISOR_VIEW, employeeNumber);
  }

  async updateSupervisor(cmd: SupervisorUpdateCommand): Promise<SubmitResult> {
    const values = { ...cmd.fields, p_language: toOracleLanguage(cmd.lang), p_user_name: cmd.username };
    return this.callSubmitProc(ORACLE_OBJECTS.SUPERVISOR_PR, SUPERVISOR_PR_PARAMS, values);
  }
}
