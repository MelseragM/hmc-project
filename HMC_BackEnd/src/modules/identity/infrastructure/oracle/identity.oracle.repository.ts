import { Injectable } from '@nestjs/common';
import { OracleService } from '@core/database/oracle.service';
import { BaseOracleRepository } from '@core/database/base.repository';
import { Lang, toOracleLanguage } from '@shared/domain/lang';
import { SubmitResult } from '@shared/domain/submit-result';
import { ORACLE_OBJECTS } from '@shared/constants/oracle-objects';
import { USERNAME_COLUMN } from '@shared/constants/oracle-columns';
import {
  CompanyIdCommand,
  IdCardRepository,
  QidDetail,
  QidRepository,
  QidUpdateCommand,
} from '../../domain/identity.repository';

/** QID_CHG_PR input params (Sanaad spec — QID_UPD_PR body). */
const QID_CHG_PARAMS = [
  'p_user_name',
  'p_qid_number',
  'p_iss_date',
  'p_exp_date',
  'p_qid_job',
  ...BaseOracleRepository.attachmentParams(),
] as const;

/** COID_REQ_PR input params (Sanaad spec — RequestCompanyID body). */
const COID_REQ_PARAMS = [
  'p_user_name',
  'p_reason',
  'p_charge_for_new_id',
  'p_delivery_loc',
  'p_working_location',
  'p_comments',
  ...BaseOracleRepository.attachmentParams(),
] as const;

/** op 18 — QID details (QID_DET_V read). op 19 — QID_CHG_PR (stub). */
@Injectable()
export class QidOracleRepository extends BaseOracleRepository implements QidRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  async getQid(employeeNumber: string, _lang: Lang): Promise<QidDetail | undefined> {
    // QID_DET_V is keyed by USER_NAME per the spec (GET_QID_DET?USER_NAME=...);
    // employee_number raised ORA-00904.
    const rows = await this.readByEmployee(
      ORACLE_OBJECTS.QID_DET_V,
      employeeNumber,
      USERNAME_COLUMN,
    );
    return rows[0];
  }

  async updateQid(cmd: QidUpdateCommand): Promise<SubmitResult> {
    const values = { ...cmd.fields, p_language: toOracleLanguage(cmd.lang), p_user_name: cmd.username };
    return this.callSubmitProc(ORACLE_OBJECTS.QID_CHG_PR, QID_CHG_PARAMS, values);
  }
}

/** op 54 — RequestCompanyID (COID_REQ_PR, stub). */
@Injectable()
export class IdCardOracleRepository extends BaseOracleRepository implements IdCardRepository {
  constructor(ora: OracleService) {
    super(ora);
  }

  async requestCompanyId(cmd: CompanyIdCommand): Promise<SubmitResult> {
    const values = { ...cmd.fields, p_language: toOracleLanguage(cmd.lang), p_user_name: cmd.username };
    return this.callSubmitProc(ORACLE_OBJECTS.COID_REQ_PR, COID_REQ_PARAMS, values);
  }
}
