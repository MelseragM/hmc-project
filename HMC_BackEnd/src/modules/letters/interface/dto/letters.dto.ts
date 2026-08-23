import {
  ATTACHMENT_FIELDS,
  defineOptionalStringFields,
  RequiredString,
} from '@shared/dto/oracle-submit.dto';

/**
 * op 17 — LetterReqSubmit (HR_EMPLYMNT_LTR_PR request template). All values
 * come from the op 16 LOVs (GET /letters/lov). NOTE (staging 2026-08-23): the
 * procedure currently raises ORA-01403 internally even for LOV-sourced values
 * — reference data missing on staging (DB team).
 */
export class LetterApplyRequestDto {
  @RequiredString('English')
  p_letter_language!: string;

  @RequiredString('Bank letter with details with effective date')
  p_letter_name!: string;

  @RequiredString('Qatar')
  p_country!: string;

  @RequiredString('1')
  p_no_of_copies!: string;

  @RequiredString('55723893')
  p_mobile_number!: string;

  @RequiredString('Al Wakra Hospital')
  p_letter_delivery_loc!: string;

  @RequiredString('test')
  p_purpose_comments!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(LetterApplyRequestDto, ATTACHMENT_FIELDS);
