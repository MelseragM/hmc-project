import { attachmentProperties, nullAttachmentExample } from '@shared/swagger/request-body.util';

/**
 * Request body for the annual-ticket submit procedure. `p_user_name`/`p_language`
 * are injected server-side and must NOT be sent. Field names are the
 * procedure's `p_*` binds (the backend also accepts the bare form). Passenger
 * slots `p_passenger1..4` and attachment slots `p_file_name1..10` /
 * `p_attachment1..10` are optional.
 */

/** op 67 — POST /annual-ticket/apply request body (TICKET_REQ_PR). */
export const ANNUAL_TICKET_APPLY_BODY = {
  description: 'Annual-ticket request payload (TICKET_REQ_PR `p_*` binds).',
  schema: {
    type: 'object',
    required: [
      'p_request_for',
      'p_employee',
      'p_request_type',
      'p_contractual_year',
      'p_traveling_dest',
      'p_travel_class',
    ],
    properties: {
      p_request_for: { type: 'string', example: 'Self' },
      p_employee: { type: 'string', example: '053613', description: 'Employee number.' },
      p_passenger1: { type: 'string', nullable: true, example: null },
      p_passenger2: { type: 'string', nullable: true, example: null },
      p_passenger3: { type: 'string', nullable: true, example: null },
      p_passenger4: { type: 'string', nullable: true, example: null },
      p_request_type: { type: 'string', example: 'Annual Ticket' },
      p_contractual_year: { type: 'string', example: '2025-2026' },
      p_traveling_dest: { type: 'string', example: 'Doha' },
      p_travel_class: { type: 'string', example: 'Economy' },
      p_comments: { type: 'string', example: '' },
      ...attachmentProperties(),
    },
    example: {
      p_request_for: 'Self',
      p_employee: '053613',
      p_passenger1: null,
      p_passenger2: null,
      p_passenger3: null,
      p_passenger4: null,
      p_request_type: 'Annual Ticket',
      p_contractual_year: '2025-2026',
      p_traveling_dest: 'Doha',
      p_travel_class: 'Economy',
      p_comments: '',
      ...nullAttachmentExample(),
    },
  },
};
