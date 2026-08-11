/**
 * Real successful `result` payloads captured from api_test_work.json, used as
 * Swagger examples. These are the inner `result` values; the ResponseInterceptor
 * wraps them in the Sanaad success envelope.
 */

/** op 5 — GET /payslip/periods?enum=&lang= (enum is actually a username here). */
export const PAYSLIP_PERIODS_EXAMPLE = [
  { PERIOD_NAME: 'January 2026', PERIOD_NAME_AR: 'يناير  2026', TIT: 4061, PERSON_ID: 26023, START_DATE: '2026-01-01T00:00:00.000Z' },
  { PERIOD_NAME: 'December 2025', PERIOD_NAME_AR: 'ديسمبر 2025', TIT: 1960, PERSON_ID: 26023, START_DATE: '2025-12-01T00:00:00.000Z' },
  { PERIOD_NAME: 'November 2025', PERIOD_NAME_AR: 'نوفمبر 2025', TIT: 1959, PERSON_ID: 26023, START_DATE: '2025-11-01T00:00:00.000Z' },
  { PERIOD_NAME: 'October 2025', PERIOD_NAME_AR: 'اكتوبر 2025', TIT: 1958, PERSON_ID: 26023, START_DATE: '2025-10-01T00:00:00.000Z' },
];

/** op 6 — GET /payslip/count?enum=&lang=&payslipperiod= (enum is actually a person_id here). */
export const PAYSLIP_COUNT_EXAMPLE = { count: 0 };
