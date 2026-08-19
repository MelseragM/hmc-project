import { attachmentProperties, ATTACHMENT_EXAMPLE } from '@shared/swagger/request-body.util';

/**
 * Real successful `result` payloads captured from api_test.json, used as Swagger
 * examples. These are the inner `result` values; the ResponseInterceptor wraps
 * them in the Sanaad success envelope.
 */

/** Shared employment/basic record (ops 3 & 8 return the same shape). */
export const EMPLOYEE_EMPLOYMENT_EXAMPLE = {
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
  employeeNumber: '053613',
  department:
    'Admin.Information Communication and Technology.Health Information and Communication Technology',
  supervisorName: 'Mr. Usama Mahmoud Mohamed Maabed Abdelsamad',
};

/** op 7 — GET /employee/performance?enum=&lang= */
export const EMPLOYEE_PERFORMANCE_EXAMPLE = [
  {
    USER_NAME: 'V-ISIDDIQUI',
    REVIEW_DATE: '16-06-2024',
    LAST_RATING: 'GOOD/5',
    RELATED_EVENT: 'Annual Appraisal',
  },
  {
    USER_NAME: 'V-ISIDDIQUI',
    REVIEW_DATE: '15-02-2023',
    LAST_RATING: 'VERY GOOD/5',
    RELATED_EVENT: 'Annual Appraisal',
  },
  {
    USER_NAME: 'V-ISIDDIQUI',
    REVIEW_DATE: '16-02-2022',
    LAST_RATING: 'VERY GOOD/5',
    RELATED_EVENT: 'Annual Appraisal',
  },
  {
    USER_NAME: 'V-ISIDDIQUI',
    REVIEW_DATE: '09-02-2021',
    LAST_RATING: 'GOOD/5',
    RELATED_EVENT: 'Annual Appraisal',
  },
  {
    USER_NAME: 'V-ISIDDIQUI',
    REVIEW_DATE: '01-04-2020',
    LAST_RATING: 'VERY GOOD/5',
    RELATED_EVENT: 'Annual Appraisal',
  },
];

/**
 * op 36 — POST /employee/supervisor request body (SUPERVISOR_PR).
 * `p_user_name` and `p_language` are injected server-side and must NOT be sent.
 * Field names are the procedure's `p_*` binds (bare `new_supervisor` also works).
 */
export const EMPLOYEE_SUPERVISOR_UPDATE_BODY = {
  description: 'Supervisor-reassignment payload (SUPERVISOR_PR `p_*` binds).',
  schema: {
    type: 'object',
    required: ['p_new_supervisor', 'p_reason'],
    properties: {
      p_new_supervisor: {
        type: 'string',
        example: '037915',
        description: 'Employee number of the proposed new supervisor.',
      },
      p_reason: { type: 'string', example: 'Team restructure', description: 'Reason for the change.' },
      ...attachmentProperties(),
    },
    example: {
      p_new_supervisor: '037915',
      p_reason: 'Team restructure',
      ...ATTACHMENT_EXAMPLE,
    },
  },
};

/** op 36 — POST /employee/supervisor response (action envelope). */
export const EMPLOYEE_SUPERVISOR_UPDATE_EXAMPLE = {
  status: 'success',
  successflag: 'S',
  message: 'Success',
  httpStatusCode: 200,
};

/** op 35 — GET /employee/supervisor/views?username=&lang= */
export const EMPLOYEE_SUPERVISOR_VIEWS_EXAMPLE = [
  {
    FULL_NAME: '000001 - Dr. Hajar Ahmed Hajar',
    EMPLOYEE_NUMBER: '000001',
    PERSON_ID: 112,
  },
  {
    FULL_NAME: '000004 - Dr. Abdulla Al Baker',
    EMPLOYEE_NUMBER: '000004',
    PERSON_ID: 113,
  },
  {
    FULL_NAME: '000014 - Mr. Omar Hassan Hashisho',
    EMPLOYEE_NUMBER: '000014',
    PERSON_ID: 116,
  },
];
