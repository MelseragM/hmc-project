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

/** op 45 — GET /leave/lov/defaults?enum=&lang= */
export const LEAVE_DEFAULTS_EXAMPLE = {
  employment: {
    PERSON_ID: 852709,
    USER_NAME: 'V-NFERNANDO',
    EMPLOYEE_NUMBER: '053613',
    JOINING_DATE: '28-10-2018',
    EMAIL_ADDRESS: 'username@null.qa',
    DEPARTMENT:
      'Admin.Information Communication and Technology.Health Information and Communication Technology',
    JOB: '112216.HICT Analyst.HMC.',
    SUPERVISOR_NUMBER: '037915',
    SUPERVISOR_NAME: 'Mr. Usama Mahmoud Mohamed Maabed Abdelsamad',
    SUPERVISOR_NAME_AR: 'اسامه محمود محمد معبد عبدالصمد',
    DEPARTMENT_AR:
      'إدارة تقنية المعلومات والاتصالات.قسم تقنية المعلومات والاتصالات.الإدارة',
    JOB_AR: '112216.محلل نظم المعلومات الصحية وتكنولوجيا الإتصالات .HMC.',
  },
  lovs: {
    annualTicket: [],
    library: [{ code: 'No', meaning: 'No', meaningAr: 'لا' }],
    alsr: [{ code: 'No', meaning: 'No', meaningAr: 'لا' }],
    contractYear: [],
  },
};

/** op 46 — GET /leave/lov/request-lov?enum=&lang= */
export const LEAVE_REQUEST_LOV_EXAMPLE = {
  numOfChild: [
    { code: 'Single', meaning: 'Single' },
    { code: 'Special Child', meaning: 'Special Child' },
    { code: 'Twins or more', meaning: 'Twins or more' },
  ],
  leaveClass: [
    { code: 'Inside Qatar', meaning: 'Inside Qatar' },
    { code: 'Outside Qatar', meaning: 'Outside Qatar' },
  ],
  examCentre: [
    { code: 'Inside Qatar', meaning: 'Inside Qatar' },
    { code: 'Outside Qatar', meaning: 'Outside Qatar' },
  ],
  bereavement: [
    { code: 'Aunt', meaning: 'Aunt' },
    { code: 'Sibling', meaning: 'Sibling' },
    { code: 'Parents', meaning: 'Parents' },
    { code: 'Spouse', meaning: 'Spouse' },
  ],
  contractYear: [],
  types: [
    { code: 'Annual Leave', meaning: 'Annual Leave', meaningAr: 'أجازة سنوية' },
    { code: 'Casual Leave', meaning: 'Casual Leave', meaningAr: 'إجازة عارضة' },
    { code: 'Sick Leave', meaning: 'Sick Leave', meaningAr: 'إجازة مرضية' },
  ],
  reasons: [
    { code: 'Annual Leave', meaning: 'Annual Leave' },
    { code: 'Sick Leave', meaning: 'Sick Leave' },
    { code: 'Casual Leave', meaning: 'Casual Leave' },
  ],
  leaveType: [
    { code: 'Annual Leave', meaning: 'Annual Leave', meaningAr: 'أجازة سنوية' },
    { code: 'Casual Leave', meaning: 'Casual Leave', meaningAr: 'إجازة عارضة' },
    { code: 'Leave without Pay', meaning: 'Leave without Pay', meaningAr: 'Leave without Pay' },
    { code: 'Sick Leave', meaning: 'Sick Leave', meaningAr: 'إجازة مرضية' },
  ],
};

/** ops 55/61/62 — GET /leave/lov/{return,cancel,amend}?username=&lang= (empty when there's nothing eligible). */
export const LEAVE_EMPTY_ITEMS_EXAMPLE = { items: [] };

/** op 47 — POST /leave/calculate (CALC_LEAV_DUR_PR: read result, not a submit envelope). */
export const LEAVE_CALCULATE_EXAMPLE = {
  days: 3,
  successFlag: 'Y',
  errorMessage: ' ',
};

/**
 * op 10 — POST /leave/apply response (action envelope) — a real business-rule
 * rejection from LEAV_OF_ABSEN_NEW_PR. `message` is the English text here
 * because this example's request used `lang=en` (default); the same call
 * with `lang=ar` would return the Arabic text instead — the client never
 * sees both.
 */
export const LEAVE_APPLY_EXAMPLE = {
  status: 'error',
  successflag: 'N',
  message: 'Reason does not exist with Absence',
  httpStatusCode: 200,
  result: { leaveDays: 0 },
};

/**
 * op 56 — POST /leave/return response (action envelope) — a real
 * business-rule rejection from RET_FRM_LEAV_PR. `message` reflects `lang=en`
 * (the default); the same call with `lang=ar` returns the Arabic text
 * instead.
 */
export const LEAVE_RETURN_EXAMPLE = {
  status: 'error',
  successflag: 'N',
  message: 'Duty resumption date should not be in future.',
  httpStatusCode: 200,
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
