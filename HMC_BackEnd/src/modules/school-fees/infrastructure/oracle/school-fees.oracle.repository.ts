import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { EMP_KEY_COLUMN } from '@shared/constants/oracle-columns';
import {
  ChildDetail,
  ChildrenQuery,
  SchoolFeeApplyCommand,
  SchoolFeeRepository,
} from '../../domain/school-fees.repository';

/**
 * op 39 — SCHOOL_FEE_PR submit (bind not captured → notImplemented).
 * op 52 — children read from CHILD_DETS_VIEW (Pattern A; column names TODO(verify)).
 */
@Injectable()
export class SchoolFeeOracleRepository extends BaseOracleRepository implements SchoolFeeRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async apply(_cmd: SchoolFeeApplyCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.SCHOOL_FEE_PR);
  }

  getChildren(query: ChildrenQuery): Promise<ChildDetail[]> {
    // TODO(verify): confirm CHILD_DETS_VIEW key/date column names.
    return this.query<ChildDetail>(
      `SELECT * FROM ${ORACLE_OBJECTS.CHILD_DETS_VIEW}
        WHERE ${EMP_KEY_COLUMN} = :enum AND acad_yr_start_date = :acad`,
      { enum: query.employeeNumber, acad: query.academicYearStartDate },
    );
  }
}
