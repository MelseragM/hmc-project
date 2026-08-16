import {
  ATTACHMENT_FIELDS,
  defineOptionalStringFields,
  RequiredString,
} from '@shared/dto/oracle-submit.dto';

/** op 67 — Submit_Annual_Ticket (TICKET_REQ_PR request template). */
export class AnnualTicketApplyRequestDto {
  @RequiredString('Self')
  p_request_for!: string;

  @RequiredString('053613')
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
