import {
  ATTACHMENT_FIELDS,
  defineOptionalStringFields,
  RequiredString,
} from '@shared/dto/oracle-submit.dto';

/** op 17 — LetterReqSubmit (HR_EMPLYMNT_LTR_PR request template). */
export class LetterApplyRequestDto {
  @RequiredString('English')
  p_letter_language!: string;

  @RequiredString('Bank letter with details with effective date')
  p_letter_name!: string;

  @RequiredString('Qatar')
  p_country!: string;

  @RequiredString('1')
  p_no_of_copies!: string;

  @RequiredString('66043671')
  p_mobile_number!: string;

  @RequiredString('Main Office - Doha')
  p_letter_delivery_loc!: string;

  @RequiredString('test')
  p_purpose_comments!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(LetterApplyRequestDto, ATTACHMENT_FIELDS);
