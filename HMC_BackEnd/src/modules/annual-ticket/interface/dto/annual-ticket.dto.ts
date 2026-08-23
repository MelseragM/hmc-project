import {
  ATTACHMENT_FIELDS,
  defineOptionalStringFields,
  RequiredString,
} from '@shared/dto/oracle-submit.dto';

/**
 * op 67 — Submit_Annual_Ticket (TICKET_REQ_PR request template).
 * `p_employee` carries the Oracle PERSON_ID, not the employee number: the
 * procedure validates it against the HMC_HR_PASSAGE_TICKET_EMPLOYEE_NAME
 * flexfield value set (verified on staging 2026-08-23 — the employee-number
 * form fails the flex check and a name string raises ORA-01722).
 */
export class AnnualTicketApplyRequestDto {
  @RequiredString('Self')
  p_request_for!: string;

  @RequiredString('26023')
  p_employee!: string;

  @RequiredString('Annual Ticket')
  p_request_type!: string;

  @RequiredString('01-SEP-2025 to 31-AUG-2026')
  p_contractual_year!: string;

  @RequiredString('Doha')
  p_traveling_dest!: string;

  @RequiredString('Economy')
  p_travel_class!: string;

  [key: string]: unknown;
}

defineOptionalStringFields(AnnualTicketApplyRequestDto, [
  'p_passenger1',
  'p_passenger2',
  'p_passenger3',
  'p_passenger4',
  'p_comments',
  ...ATTACHMENT_FIELDS,
]);
