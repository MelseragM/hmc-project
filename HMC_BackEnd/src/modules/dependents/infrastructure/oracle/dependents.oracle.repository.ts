import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import {
  DeleteDependentCommand,
  DependentCommand,
  DependentRepository,
  PassportCommand,
  PassportRepository,
} from '../../domain/dependents.repository';

/**
 * Dependent lifecycle procedures (ADD_DEPENDENT_PKG/PR, UPDATE_DEPENDENT_PR,
 * REMOVE_DEPENDENT_PR). Bind signatures not captured → notImplemented. add()
 * additionally composes CREATE_ADDRESS_PR (see contact module) once implemented.
 */
@Injectable()
export class DependentOracleRepository extends BaseOracleRepository implements DependentRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async add(_cmd: DependentCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.ADD_DEPENDENT_PKG);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async update(_cmd: DependentCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.UPDATE_DEPENDENT_PR);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async delete(_cmd: DeleteDependentCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.REMOVE_DEPENDENT_PR);
  }
}

/** op 34 — Passport detail request (PASS_DTL_PR, stub). */
@Injectable()
export class PassportOracleRepository extends BaseOracleRepository implements PassportRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async apply(_cmd: PassportCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.PASS_DTL_PR);
  }
}
