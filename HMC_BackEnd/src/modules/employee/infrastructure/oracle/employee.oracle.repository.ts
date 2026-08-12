import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { USERNAME_KEY_CANDIDATES } from '@shared/constants/oracle-columns';

/**
 * SUPERVISOR_PR input params. The confirmed signature is
 * (p_user_name, p_new_supervisor, p_reason, p_file_nameN/p_attachmentN[BLOB],
 * p_success_flag, p_error_msg, p_error_msg_ar) — there is NO p_language, and the
 * attachments are BLOB. Sending p_language raised PLS-00306.
 */
const SUPERVISOR_PR_PARAMS = [
  'p_user_name',
  'p_new_supervisor',
  'p_reason',
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

  async getPerformance(username: string, _lang: Lang): Promise<PerformanceRecord[]> {
    // PERFORMANCE_V is keyed by the caller's login; resolve the real column name
    // from the data dictionary (hard-coded `username` raised ORA-00904).
    const rows = await this.readByResolvedKey(
      ORACLE_OBJECTS.PERFORMANCE_V,
      username,
      USERNAME_KEY_CANDIDATES,
    );
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
    // Confirmed by Oracle: XXHMC_SND_SUPERVISOR_VIEW is a FUNCTION —
    // `FUNCTION(p_user_name IN VARCHAR2, p_limit_txt VARCHAR2) RETURN
    // xxhmc_snd_emp_dets_nt` (a collection type) — not a table (`SELECT ...
    // WHERE` raised ORA-04044) and not a procedure (`BEGIN ... END;` raised
    // PLS-00221). Table functions are queried via SELECT * FROM TABLE(fn(...)).
    return this.queryTableFunction<SupervisorView>(ORACLE_OBJECTS.SUPERVISOR_VIEW, [
      employeeNumber,
      null,
    ]);
  }

  async updateSupervisor(cmd: SupervisorUpdateCommand): Promise<SubmitResult> {
    // SUPERVISOR_PR takes no p_language; its OUT contract is p_success_flag /
    // p_error_msg / p_error_msg_ar (used for the fallback when the dictionary is
    // unreadable — the dictionary path derives the OUT binds from the signature).
    const values = { ...cmd.fields, p_user_name: cmd.username };
    return this.callSubmitProc(
      ORACLE_OBJECTS.SUPERVISOR_PR,
      SUPERVISOR_PR_PARAMS,
      values,
      this.successFlagOutBinds(),
    );
  }
}
