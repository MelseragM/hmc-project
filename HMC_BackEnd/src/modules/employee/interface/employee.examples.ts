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
  SUPERVISOR_NAME_AR: 'اسامه محمود محمد معبد عبدالصمد',
  DEPARTMENT_AR:
    'إدارة تقنية المعلومات والاتصالات.قسم تقنية المعلومات والاتصالات.الإدارة',
  JOB_AR: '112216.محلل نظم المعلومات الصحية وتكنولوجيا الإتصالات .HMC.',
  employeeNumber: '053613',
  department:
    'Admin.Information Communication and Technology.Health Information and Communication Technology',
  departmentAr:
    'إدارة تقنية المعلومات والاتصالات.قسم تقنية المعلومات والاتصالات.الإدارة',
  supervisorName: 'Mr. Usama Mahmoud Mohamed Maabed Abdelsamad',
};

/** op 7 — GET /employee/performance?enum=&lang= */
export const EMPLOYEE_PERFORMANCE_EXAMPLE = [
  {
    USER_NAME: 'V-ISIDDIQUI',
    REVIEW_DATE: '16-06-2024',
    LAST_RATING: 'GOOD/5',
    RELATED_EVENT: 'Annual Appraisal',
    RELATED_EVENT_AR: 'Annual Appraisal',
  },
  {
    USER_NAME: 'V-ISIDDIQUI',
    REVIEW_DATE: '15-02-2023',
    LAST_RATING: 'VERY GOOD/5',
    RELATED_EVENT: 'Annual Appraisal',
    RELATED_EVENT_AR: 'Annual Appraisal',
  },
  {
    USER_NAME: 'V-ISIDDIQUI',
    REVIEW_DATE: '16-02-2022',
    LAST_RATING: 'VERY GOOD/5',
    RELATED_EVENT: 'Annual Appraisal',
    RELATED_EVENT_AR: 'Annual Appraisal',
  },
  {
    USER_NAME: 'V-ISIDDIQUI',
    REVIEW_DATE: '09-02-2021',
    LAST_RATING: 'GOOD/5',
    RELATED_EVENT: 'Annual Appraisal',
    RELATED_EVENT_AR: 'Annual Appraisal',
  },
  {
    USER_NAME: 'V-ISIDDIQUI',
    REVIEW_DATE: '01-04-2020',
    LAST_RATING: 'VERY GOOD/5',
    RELATED_EVENT: 'Annual Appraisal',
    RELATED_EVENT_AR: 'Annual Appraisal',
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
