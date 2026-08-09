import {
  ATTACHMENT_FIELDS,
  defineOptionalStringFields,
  RequiredString,
} from '@shared/dto/oracle-submit.dto';

/** op 36 — SUPERVISOR_PR request template. */
export class SupervisorUpdateRequestDto {
  @RequiredString('037915')
  p_new_supervisor!: string;

  @RequiredString('Team restructure')
  p_reason!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(SupervisorUpdateRequestDto, ATTACHMENT_FIELDS);
