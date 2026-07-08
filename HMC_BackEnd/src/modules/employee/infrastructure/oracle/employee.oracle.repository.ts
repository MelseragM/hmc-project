import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
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
  constructor(ora: OracleService) {
    super(ora);
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
    const rows = await this.readByEmployee(ORACLE_OBJECTS.PERFORMANCE_V, employeeNumber);
    return rows.map((r) => EmployeeMapper.toPerformance(r));
  }
}

/** Supervisor view/update (ops 35, 36). SUPERVISOR_PR bind not captured → notImplemented. */
@Injectable()
export class SupervisorOracleRepository
  extends BaseOracleRepository
  implements SupervisorRepository
{
  constructor(ora: OracleService) {
    super(ora);
  }

  getSupervisorViews(employeeNumber: string, _lang: Lang): Promise<SupervisorView[]> {
    return this.readByEmployee<SupervisorView>(ORACLE_OBJECTS.SUPERVISOR_VIEW, employeeNumber);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateSupervisor(_cmd: SupervisorUpdateCommand): Promise<SubmitResult> {
    // TODO(bind): capture XXHMC_SND_SUPERVISOR_PR signature (sample shows only p_user_name).
    return this.notImplemented(ORACLE_OBJECTS.SUPERVISOR_PR);
  }
}
