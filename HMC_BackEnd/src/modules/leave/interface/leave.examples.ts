import { attachmentProperties, ATTACHMENT_EXAMPLE } from '@shared/swagger/request-body.util';

/**
 * Real successful `result` payloads captured from api_test.json, used as Swagger
 * examples. These are the inner `result` values; the ResponseInterceptor wraps
 * them in the Sanaad success envelope.
 */

/** op 12 — GET /leave/lov/types?lang= */
export const LEAVE_TYPES_LOV_EXAMPLE = {
  items: [
    { code: 'Annual Leave', meaning: 'Annual Leave', meaningAr: 'أجازة سنوية' },
    { code: 'Casual Leave', meaning: 'Casual Leave', meaningAr: 'إجازة عارضة' },
    { code: 'Compassionate Leave', meaning: 'Compassionate Leave', meaningAr: 'Compassionate Leave' },
    { code: 'Examination leave', meaning: 'Examination leave', meaningAr: 'Examination leave' },
    { code: 'Haj Leave', meaning: 'Haj Leave', meaningAr: 'Haj Leave' },
    { code: 'Iddat Leave', meaning: 'Iddat Leave', meaningAr: 'Iddat Leave' },
    { code: 'Leave without Pay', meaning: 'Leave without Pay', meaningAr: 'Leave without Pay' },
    { code: 'Marriage Leave', meaning: 'Marriage Leave', meaningAr: 'Marriage Leave' },
    { code: 'Maternity Leave', meaning: 'Maternity Leave', meaningAr: 'Maternity Leave' },
    { code: 'Sick Leave', meaning: 'Sick Leave', meaningAr: 'إجازة مرضية' },
  ],
};

/** op 13 — GET /leave/lov/reasons?lang= */
export const LEAVE_REASONS_LOV_EXAMPLE = {
  items: [
    { code: 'Annual Leave', meaning: 'Annual Leave' },
    { code: 'Compassionate Leave', meaning: 'Compassionate Leave' },
    { code: 'Haj Leave', meaning: 'Haj Leave' },
    { code: 'Iddat Leave', meaning: 'Iddat Leave' },
    { code: 'Marriage Leave', meaning: 'Marriage Leave' },
    { code: 'Sick Leave', meaning: 'Sick Leave' },
    { code: 'Casual Leave', meaning: 'Casual Leave' },
    { code: 'Maternity Leave', meaning: 'Maternity Leave' },
    { code: 'Examination leave', meaning: 'Examination leave' },
    { code: 'Leave without Pay', meaning: 'Leave without Pay' },
  ],
};

/** op 14 — GET /leave/lov/classes?lang= */
export const LEAVE_CLASSES_LOV_EXAMPLE = {
  items: [
    { code: 'Inside Qatar', meaning: 'Inside Qatar' },
    { code: 'Outside Qatar', meaning: 'Outside Qatar' },
  ],
};

/*
 * Request bodies for the leave submit procedures. `p_user_name` and
 * `p_language` are injected server-side and must NOT be sent. Field names are the
 * procedures' `p_*` binds (the backend also accepts the bare form). Attachment
 * slots `p_file_name1..10` / `p_attachment1..10` are optional.
 */

/** op 57 — POST /leave/amend request body (HR_LEAV_AMEND_PR). */
export const LEAVE_AMEND_BODY = {
  description: 'Leave-amend payload (HR_LEAV_AMEND_PR `p_*` binds).',
  schema: {
    type: 'object',
    required: ['p_leave_type', 'p_leave_to_amend', 'p_new_end_date'],
    properties: {
      p_leave_type: { type: 'string', example: 'Annual Leave' },
      p_leave_to_amend: { type: 'string', example: '62', description: 'Identifier of the leave to amend.' },
      p_new_end_date: { type: 'string', example: '20-Jun-2026', description: 'New end date (DD-Mon-YYYY).' },
      p_comments: { type: 'string', example: 'Extending by two days.' },
      ...attachmentProperties(),
    },
    example: {
      p_leave_type: 'Annual Leave',
      p_leave_to_amend: '62',
      p_new_end_date: '20-Jun-2026',
      p_comments: 'Extending by two days.',
      ...ATTACHMENT_EXAMPLE,
    },
  },
};

/** op 58 — POST /leave/cancel request body (HR_LEAV_CANCEL_PR). */
export const LEAVE_CANCEL_BODY = {
  description: 'Leave-cancel payload (HR_LEAV_CANCEL_PR `p_*` binds).',
  schema: {
    type: 'object',
    required: ['p_leave_type', 'p_leave_to_cancel', 'p_reason_for_cancel'],
    properties: {
      p_leave_type: { type: 'string', example: 'Annual Leave' },
      p_leave_to_cancel: { type: 'string', example: '62', description: 'Identifier of the leave to cancel.' },
      p_reason_for_cancel: { type: 'string', example: 'Plans changed' },
      p_remarks: { type: 'string', example: 'Will re-apply later.' },
      ...attachmentProperties(),
    },
    example: {
      p_leave_type: 'Annual Leave',
      p_leave_to_cancel: '62',
      p_reason_for_cancel: 'Plans changed',
      p_remarks: 'Will re-apply later.',
      ...ATTACHMENT_EXAMPLE,
    },
  },
};

/** op 56 — POST /leave/return request body (RET_FRM_LEAV_PR). */
export const LEAVE_RETURN_BODY = {
  description: 'Return-from-leave payload (RET_FRM_LEAV_PR `p_*` binds).',
  schema: {
    type: 'object',
    required: ['p_leave_details', 'p_return_date'],
    properties: {
      p_leave_details: { type: 'string', example: '62', description: 'Identifier of the leave being returned from.' },
      p_related_leave1: { type: 'string', example: '' },
      p_related_leave2: { type: 'string', example: '' },
      p_return_date: { type: 'string', example: '15-Jun-2026', description: 'Return date (DD-Mon-YYYY).' },
      p_comments: { type: 'string', example: 'Returned early.' },
      ...attachmentProperties(),
    },
    example: {
      p_leave_details: '62',
      p_return_date: '15-Jun-2026',
      p_comments: 'Returned early.',
      ...ATTACHMENT_EXAMPLE,
    },
  },
};
