import {
  ATTACHMENT_FIELDS,
  defineOptionalStringFields,
  RequiredString,
} from '@shared/dto/oracle-submit.dto';

/** op 19 — QID_UPD_PR (QID_CHG_PR request template). */
export class QidUpdateRequestDto {
  @RequiredString('28381807872')
  p_qid_number!: string;

  @RequiredString('2025-OCT-17')
  p_iss_date!: string;

  @RequiredString('2029-OCT-16')
  p_exp_date!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(QidUpdateRequestDto, ['p_qid_job', ...ATTACHMENT_FIELDS]);

/** op 54 — RequestCompanyID (COID_REQ_PR request template). */
export class CompanyIdApplyRequestDto {
  @RequiredString('Damaged')
  p_reason!: string;

  @RequiredString('No')
  p_charge_for_new_id!: string;

  @RequiredString('Al Wakra Hospital')
  p_delivery_loc!: string;

  @RequiredString('Others')
  p_working_location!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(CompanyIdApplyRequestDto, ['p_comments', ...ATTACHMENT_FIELDS]);
