import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import {
  CompanyIdCommand,
  IdCardRepository,
  QidDetail,
  QidRepository,
  QidUpdateCommand,
} from '../../domain/identity.repository';

/** op 18 — QID details (QID_DET_V read). op 19 — QID_CHG_PR (stub). */
@Injectable()
export class QidOracleRepository extends BaseOracleRepository implements QidRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  async getQid(employeeNumber: string, _lang: Lang): Promise<QidDetail | undefined> {
    const rows = await this.readByEmployee(ORACLE_OBJECTS.QID_DET_V, employeeNumber);
    return rows[0];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateQid(_cmd: QidUpdateCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.QID_CHG_PR);
  }
}

/** op 54 — RequestCompanyID (COID_REQ_PR, stub). */
@Injectable()
export class IdCardOracleRepository extends BaseOracleRepository implements IdCardRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async requestCompanyId(_cmd: CompanyIdCommand): Promise<SubmitResult> {
    return this.notImplemented(ORACLE_OBJECTS.COID_REQ_PR);
  }
}
