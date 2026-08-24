module.exports = [
  {
    label: 'A1 — what lookup does the phone-type VIEW read? (view definition)',
    sql: 'SELECT text FROM all_views WHERE view_name LIKE :v',
    binds: { v: 'XXHMC_SND_PHONE_TYPE_V' },
  },
  {
    label: 'A2 — HR PHONE_TYPE lookup codes (what the HR API accepts)',
    sql: 'SELECT lookup_type, lookup_code, meaning, enabled_flag FROM hr_lookups WHERE lookup_type LIKE :t ORDER BY 2',
    binds: { t: 'PHONE_TYPE' },
  },
  {
    label: 'D1 — ticket value set: which employees are allowed?',
    sql: 'SELECT v.flex_value, t.description FROM fnd_flex_values v, fnd_flex_value_sets s, fnd_flex_values_tl t WHERE s.flex_value_set_id = v.flex_value_set_id AND t.flex_value_id = v.flex_value_id AND s.flex_value_set_name LIKE :n AND rownum <= 25',
    binds: { n: 'HMC_HR_PASSAGE_TICKET_EMPLOYEE_NAME' },
  },
  {
    label: 'E1 — OPEN actionable notifications for our test user',
    sql: 'SELECT notification_id, message_type, subject, status, recipient_role FROM wf_notifications WHERE recipient_role LIKE :u AND status LIKE :s AND rownum <= 25',
    binds: { u: 'AIBRAHIM39', s: 'OPEN' },
  },
];
