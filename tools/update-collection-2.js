/**
 * Part 2 — applies verified fixes + REAL captured examples for the remaining
 * modules (Auth, Profile, Employee, Identity, Leave, Payslip, Letters,
 * Lookups, Health). Run AFTER update-collection.js. Same conventions:
 * real captured responses; expected-success examples are explicitly labeled.
 * Usage: node update-collection-2.js [collection-path]
 */
const fs = require('fs');
const path = require('path');

const COLLECTION = process.argv[2] || 'C:/New folder/hmc-project/HMC_BackEnd/postman/HMC-Sanaad-Full.postman_collection.json';
const TOOLS = 'C:/New folder/hmc-project/tools';
const collection = JSON.parse(fs.readFileSync(COLLECTION, 'utf8'));

const results = {};
for (const f of fs.readdirSync(TOOLS).filter((f) => /^results-phase\d+.*\.json$/.test(f)).sort()) {
  for (const r of JSON.parse(fs.readFileSync(path.join(TOOLS, f), 'utf8'))) {
    if (r.httpStatus === undefined) continue;
    results[`${r.module}|${r.name}`] = r;
  }
}

const STATUS_TEXT = {
  200: 'OK', 400: 'Bad Request', 404: 'Not Found', 500: 'Internal Server Error', 503: 'Service Unavailable', 504: 'Gateway Timeout',
};

function folder(name) {
  const f = collection.item.find((i) => i.name === name);
  if (!f) throw new Error(`folder not found: ${name}`);
  return f;
}
function request(folderName, reqName) {
  const r = folder(folderName).item.find((i) => i.name === reqName);
  if (!r) throw new Error(`request not found: ${folderName} / ${reqName}`);
  return r;
}
function pmUrl(rawPath, pathVars) {
  const [pathPart, queryPart] = rawPath.split('?');
  const url = { raw: `{{baseUrl}}${rawPath}`, host: ['{{baseUrl}}'], path: pathPart.split('/').filter(Boolean) };
  if (queryPart) {
    url.query = queryPart.split('&').map((kv) => {
      const [key, ...rest] = kv.split('=');
      return { key, value: decodeURIComponent(rest.join('=')) };
    });
  }
  if (pathVars) url.variable = Object.entries(pathVars).map(([key, value]) => ({ key, value }));
  return url;
}
function rawBody(obj) {
  return { mode: 'raw', raw: JSON.stringify(obj, null, 2), options: { raw: { language: 'json' } } };
}
function example(key, name, { urlPath } = {}) {
  const r = results[key];
  if (!r) throw new Error(`no captured result for: ${key}`);
  const original = { method: r.method, header: [], url: pmUrl(urlPath ?? r.path) };
  if (r.body !== undefined) {
    original.header.push({ key: 'Content-Type', value: 'application/json' });
    original.body = rawBody(r.body);
  }
  return {
    name,
    originalRequest: original,
    status: STATUS_TEXT[r.httpStatus] ?? String(r.statusText || ''),
    code: r.httpStatus,
    _postman_previewlanguage: 'json',
    header: [{ key: 'Content-Type', value: 'application/json; charset=utf-8' }],
    cookie: [],
    body: JSON.stringify(r.responseBody, null, 2),
  };
}
function expectedExample({ name, method, urlPath, requestBody, responseBody }) {
  const original = { method, header: [], url: pmUrl(urlPath) };
  if (requestBody !== undefined) {
    original.header.push({ key: 'Content-Type', value: 'application/json' });
    original.body = rawBody(requestBody);
  }
  return {
    name,
    originalRequest: original,
    status: 'OK',
    code: 200,
    _postman_previewlanguage: 'json',
    header: [{ key: 'Content-Type', value: 'application/json; charset=utf-8' }],
    cookie: [],
    body: JSON.stringify(responseBody, null, 2),
  };
}
const EXPECTED_SUBMIT_SUCCESS = { status: 'success', successflag: 'S', message: 'Success', httpStatusCode: 200 };
function setExamples(f, r, ex) { request(f, r).response = ex.filter(Boolean); }
function setBody(f, r, obj) { request(f, r).request.body = rawBody(obj); }
function setDescription(f, r, text) { request(f, r).request.description = text; }
function setUrl(f, r, rawPath, vars) { request(f, r).request.url = pmUrl(rawPath, vars); }
function appendDescription(f, r, text) {
  const req = request(f, r).request;
  req.description = (req.description ? req.description + '\n\n' : '') + text;
}

const AUTH_NOTE =
  '**Auth:** Bearer {{token}} (staging runs AUTH_DISABLED=true: dev user `AIBRAHIM39`/`037400` is injected; 401/403 not reproducible).';
const VERIFIED = '**Verified against staging (current build) on 2026-08-23 — examples below are real captured responses unless labeled "Expected".**';

// ============================ AUTH ============================
setBody('Auth', 'POST /healthcheck', { deviceimei: '356789012345678', platform: 'Android', appname: 'Sanaad', version: '1.0.0' });
setDescription('Auth', 'POST /healthcheck',
  '**Purpose:** API-1 — App-launch health check (downtime + forced/optional update). PUBLIC (no token).\n\n' +
  '**Body (HealthCheckRequestDto):** `deviceimei` (required — NOT `imeinumber`/`username`: the old collection body was rejected with 400, see example), optional `platform`, `sysdate`, `appname`, `version`.\n\n' + VERIFIED);
setExamples('Auth', 'POST /healthcheck', [
  example('auth|Healthcheck success (correct body)', 'Success (200)'),
  example('auth|Healthcheck success', 'Validation Error (400) — old body (username/imeinumber) rejected; deviceimei required'),
]);

setBody('Auth', 'POST /auth/initiate', { username: 'AIBRAHIM39', imeinumber: '356789012345678', platform: 'Android' });
setDescription('Auth', 'POST /auth/initiate',
  '**Purpose:** API-2 — User validate (LDAP + send OTP). PUBLIC.\n\n**Staging note:** dev bypass is active — identity is synthesized and no real OTP is sent; `requestid` is a generated UUID.\n\n' + VERIFIED);
setExamples('Auth', 'POST /auth/initiate', [
  example('auth|Initiate success', 'Success (200) — dev-bypass identity + requestid'),
  example('auth|Initiate validation empty', 'Validation Error (400) — username/imeinumber required'),
]);

setBody('Auth', 'POST /auth/otp/validate', { username: 'AIBRAHIM39', imeinumber: '356789012345678', otp: '123456', requestid: 'TESTREQID001' });
setDescription('Auth', 'POST /auth/otp/validate',
  '**Purpose:** API-3 — Validate OTP. PUBLIC.\n\n**Staging note:** dev bypass accepts any 4-8 digit OTP; non-numeric returns the real "Invalid OTP" error body.\n\n' + VERIFIED);
setExamples('Auth', 'POST /auth/otp/validate', [
  example('auth|OTP validate success (dev bypass)', 'Success (200)'),
  example('auth|OTP validate invalid otp', 'Business Error (200) — Invalid OTP'),
]);

setBody('Auth', 'POST /auth/mpin/update', { username: 'AIBRAHIM39', imeinumber: '356789012345678', mpin: '123456' });
setDescription('Auth', 'POST /auth/mpin/update',
  '**Purpose:** API-4 — Set MPIN (first-time). PUBLIC. Staging (dev bypass): not persisted.\n\n' + VERIFIED);
setExamples('Auth', 'POST /auth/mpin/update', [example('auth|MPIN set success', 'Success (200)')]);

setBody('Auth', 'POST /auth/login', { username: 'AIBRAHIM39', imeinumber: '356789012345678', mpin: '123456', platform: 'Android', version: '1.0.0' });
setDescription('Auth', 'POST /auth/login',
  '**Purpose:** API-5 — Login (MPIN → JWT + functionaccesslist). PUBLIC.\n\n**Staging note:** dev bypass — MPIN not verified; a real signed JWT is returned (save it into {{token}}).\n\n' + VERIFIED);
setExamples('Auth', 'POST /auth/login', [
  example('auth|Login success', 'Success (200) — JWT + functionaccesslist'),
  example('auth|Login validation empty', 'Validation Error (400)'),
]);

setBody('Auth', 'POST /auth/mpin/forgot', { username: 'AIBRAHIM39', imeinumber: '356789012345678' });
setExamples('Auth', 'POST /auth/mpin/forgot', [example('auth|Forgot MPIN success', 'Success (200) — requestid issued')]);

setBody('Auth', 'POST /auth/mpin/update/reset', { username: 'AIBRAHIM39', imeinumber: '356789012345678', otp: '123456', newmpin: '654321', requestid: 'TESTREQID001' });
setExamples('Auth', 'POST /auth/mpin/update/reset', [example('auth|Reset MPIN success', 'Success (200)')]);

setDescription('Auth', 'GET /auth/me',
  '**Purpose:** Current token claims.\n\n' + AUTH_NOTE + '\n\n' + VERIFIED);
setExamples('Auth', 'GET /auth/me', [example('auth|Me with token', 'Success (200) — dev user claims')]);

// ============================ PROFILE ============================
setDescription('Profile', 'GET /profile',
  '**Purpose:** op 2 — Personal detail (profile + phones + outside addresses + dependent contact info).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `username` (required — Oracle username form; `enum` is rejected).\n\n' + VERIFIED);
setExamples('Profile', 'GET /profile', [
  example('profile|Profile success', 'Success (200) — full profile'),
  example('profile|Profile validation missing username', 'Validation Error (400) — username required'),
]);

setDescription('Profile', 'GET /profile/lov/marital-status',
  '**Purpose:** op 63 — Marital status LOV.\n\n' + AUTH_NOTE + '\n\n' + VERIFIED);
setExamples('Profile', 'GET /profile/lov/marital-status', [
  example('profile|Marital LOV success', 'Success (200)'),
  example('profile|Marital LOV bad lang', 'Validation Error (400) — lang must be en|ar'),
]);

setBody('Profile', 'POST /profile/personal', {
  p_effective_date: '01-Jan-2026',
  p_first_name: 'Amir',
  p_middle_name: 'Sami Samir',
  p_last_name: 'Ibrahim',
  p_marital_status: 'Married',
  p_file_name1: 'marriage-cert.pdf',
  p_attachment1: 'dGVzdCBhdHRhY2htZW50',
});
setUrl('Profile', 'POST /profile/personal', '/profile/personal?lang=en');
setDescription('Profile', 'POST /profile/personal',
  '**Purpose:** op 48 — Update personal details (`XXHMC_SND_UPD_PERSONAL_INFO_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Verified success (2026-08-23):** this payload returned `successflag S` (marital status from op 63 LOV).\n\n' + VERIFIED);
setExamples('Profile', 'POST /profile/personal', [
  example('profile|Update personal submit', 'Success (200, successflag=S)'),
  example('profile|Update personal validation empty', 'Validation Error (400) — required p_* fields missing'),
]);

// ============================ EMPLOYEE ============================
setDescription('Employee', 'GET /employee/employment',
  '**Purpose:** op 3 — Employment details.\n\n' + AUTH_NOTE + '\n\n**Query:** `lang`, `enum` (employee number).\n\n' + VERIFIED);
setExamples('Employee', 'GET /employee/employment', [example('employee|Employment success', 'Success (200)')]);

setDescription('Employee', 'GET /employee/basic',
  '**Purpose:** op 8 — Basic employee info.\n\n' + AUTH_NOTE + '\n\n**Query:** `lang`, `enum` (employee number).\n\n' + VERIFIED);
setExamples('Employee', 'GET /employee/basic', [
  example('employee|Basic success', 'Success (200)'),
  example('employee|Basic validation missing enum', 'Validation Error (400) — enum required'),
]);

setDescription('Employee', 'GET /employee/performance',
  '**Purpose:** op 7 — Performance records.\n\n' + AUTH_NOTE + '\n\n**Query:** `lang`, `username` (Oracle username form).\n\n' + VERIFIED);
setExamples('Employee', 'GET /employee/performance', [
  example('employee|Performance AIBRAHIM39', 'Success (200) — AIBRAHIM39'),
  example('employee|Performance V-ISIDDIQUI', 'Success (200) — V-ISIDDIQUI'),
]);

setDescription('Employee', 'GET /employee/supervisor/views',
  '**Purpose:** op 35 — Supervisor view (candidate supervisors with PERSON_ID — use PERSON_ID in op 36).\n\n' + AUTH_NOTE + '\n\n' + VERIFIED);
setExamples('Employee', 'GET /employee/supervisor/views', [
  example('employee|Supervisor views AIBRAHIM39', 'Success (200)'),
]);

setBody('Employee', 'POST /employee/supervisor', { p_new_supervisor: '112', p_reason: 'Team restructure' });
setUrl('Employee', 'POST /employee/supervisor', '/employee/supervisor?lang=en');
setDescription('Employee', 'POST /employee/supervisor',
  '**Purpose:** op 36 — Supervisor update (`XXHMC_SND_SUPERVISOR_PR`).\n\n' + AUTH_NOTE +
  '\n\n**IMPORTANT (verified 2026-08-23):** `p_new_supervisor` must be the Oracle **PERSON_ID** from op 35 (`supervisor/views` → PERSON_ID, e.g. `112`) — the employee number (`037915`) fails the "HMC Change Supervisor" flexfield and a name string raises FLEX-DSQL ORA-01722. With PERSON_ID the procedure returned `successflag S`.\n\n' + VERIFIED);
setExamples('Employee', 'POST /employee/supervisor', [
  example('employee|Supervisor update person_id 112', 'Success (200, successflag=S) — PERSON_ID form'),
  example('employee|Supervisor update submit', 'Business Error (200, successflag=N) — employee number rejected by flexfield'),
  example('employee|Supervisor update validation empty', 'Validation Error (400) — required p_* fields missing'),
]);

// ============================ IDENTITY ============================
setDescription('Identity', 'GET /identity/qid',
  '**Purpose:** op 18 — QID details.\n\n' + AUTH_NOTE + '\n\n**Query:** `lang`, `username` (required).\n\n' + VERIFIED);
setExamples('Identity', 'GET /identity/qid', [
  example('identity|QID success', 'Success (200)'),
  example('identity|QID validation missing username', 'Validation Error (400) — username required'),
]);

setBody('Identity', 'POST /identity/qid/update', {
  p_qid_number: '28481809470', p_iss_date: '2025-10-17', p_exp_date: '2029-10-16', p_qid_job: 'Analyst',
  p_file_name1: 'qid-front.jpg', p_attachment1: 'dGVzdCBhdHRhY2htZW50',
});
setUrl('Identity', 'POST /identity/qid/update', '/identity/qid/update?lang=en');
setDescription('Identity', 'POST /identity/qid/update',
  '**Purpose:** op 19 — QID update (`XXHMC_SND_QID_CHG_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Verified success (2026-08-23):** this payload (the user\'s real QID + `yyyy-MM-dd` dates + attachment) returned `successflag S`.\n\n' + VERIFIED);
setExamples('Identity', 'POST /identity/qid/update', [
  example('identity|QID update submit', 'Success (200, successflag=S)'),
  example('identity|QID update validation empty', 'Validation Error (400) — required p_* fields missing'),
]);

setBody('Identity', 'POST /identity/idcard/apply', {
  p_reason: 'Damaged', p_charge_for_new_id: 'No', p_delivery_loc: 'Al Wakra Hospital', p_working_location: 'Others', p_comments: 'test',
});
setUrl('Identity', 'POST /identity/idcard/apply', '/identity/idcard/apply?lang=en');
setDescription('Identity', 'POST /identity/idcard/apply',
  '**Purpose:** op 54 — Request company ID (`XXHMC_SND_COID_REQ_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Verified success (2026-08-23):** values from the three LOVs (op 60 reason, op 59 delivery, op 53b work location) returned `successflag S`.\n\n' + VERIFIED);
setExamples('Identity', 'POST /identity/idcard/apply', [
  example('identity|IDCard apply submit', 'Success (200, successflag=S)'),
  example('identity|IDCard apply validation empty', 'Validation Error (400) — required p_* fields missing'),
]);

setExamples('Identity', 'GET /identity/lov/work-location', [example('identity|Work location LOV', 'Success (200)')]);
setExamples('Identity', 'GET /identity/lov/delivery-location', [example('identity|Delivery location LOV', 'Success (200)')]);
setExamples('Identity', 'GET /identity/lov/reason', [example('identity|Reason LOV', 'Success (200)')]);

// ============================ LEAVE ============================
setDescription('Leave', 'GET /leave/balance',
  '**Purpose:** op 9 — Leave balance (`XXHMC_SND_LEAVE_BALANCE_PR`, REF CURSOR). `person_id` = Oracle PERSON_ID.\n\n' + AUTH_NOTE +
  '\n\n**Verified 2026-08-23:** returns 200 with the accrual rows (empty array for the test persons — no accrual plans configured on staging).\n\n' + VERIFIED);
setExamples('Leave', 'GET /leave/balance', [
  example('leave|Balance person 26023', 'Success (200) — empty accrual list for test person'),
  example('leave|Balance validation missing person', 'Validation Error (400) — person_id required'),
]);

setDescription('Leave', 'GET /leaves',
  '**Purpose:** Leave history (`ABSENCE_V`), filtered by `user_name` + optional `leave_type`.\n\n' + AUTH_NOTE + '\n\n' + VERIFIED);
setExamples('Leave', 'GET /leaves', [
  example('leave|Leaves list AIBRAHIM39', 'Success (200) — all leaves'),
  example('leave|Leaves list V-NFERNANDO filtered', 'Success (200) — filtered by leave_type'),
]);

setBody('Leave', 'POST /leave/apply', { p_absence_type: 'Casual Leave', p_start_date: '2026-09-07', p_end_date: '2026-09-07' });
setDescription('Leave', 'POST /leave/apply',
  '**Purpose:** op 10 — Leave submission (`XXHMC_SND_LEAV_OF_ABSEN_NEW_PR`). Accepts `p_*` spelling or camelCase.\n\n' + AUTH_NOTE +
  '\n\n**UPDATE 2026-08-23 (PM):** the earlier ORA-00027 kill-session defect at line 168 was FIXED by the DB team — the procedure now returns its real business rules: (1) HMC-Law employees may not apply for more than 1 day of Casual Leave; (2) the caller must first submit the Policy Awareness questionnaire ("To avail this function, please submit the Policy Awareness questionnaire."). A `successflag S` needs a test user who completed the questionnaire.\n\n' + VERIFIED);
setExamples('Leave', 'POST /leave/apply', [
  expectedExample({
    name: 'Expected Success (200) — needs a user who submitted the Policy Awareness questionnaire (NOT a captured response)',
    method: 'POST', urlPath: '/leave/apply?lang=en',
    requestBody: { p_absence_type: 'Casual Leave', p_start_date: '2026-09-07', p_end_date: '2026-09-07' },
    responseBody: EXPECTED_SUBMIT_SUCCESS,
  }),
  example('leave|Leave apply ONE day (business rule)', 'Business Error (200, successflag=N) — Policy Awareness questionnaire required'),
  example('leave|BLOCKER recheck - leave apply', 'Business Error (200, successflag=N) — more than 1 day rejected for HMC Law employees'),
  example('leave|Apply validation empty', 'Validation Error (400) — absence type/dates required'),
]);

setDescription('Leave', 'POST /leave/calculate',
  '**Purpose:** op 47 — Leave duration calculation (read-only).\n\n' + AUTH_NOTE + '\n\n' + VERIFIED);
setExamples('Leave', 'POST /leave/calculate', [
  example('leave|Calculate success', 'Success (200) — days computed'),
  example('leave|Calculate validation bad date', 'Validation Error (400) — dates must be dd-Mon-yyyy'),
]);

setBody('Leave', 'POST /leave/amend', { p_leave_type: 'Annual Leave', p_leave_to_amend: 'Annual Leave|12-MAR-2026|12-MAR-2026', p_new_end_date: '2026-03-13', p_comments: 'Extending by one day.' });
setDescription('Leave', 'POST /leave/amend',
  '**Purpose:** op 57 — Leave amend (`XXHMC_SND_HR_LEAV_AMEND_PR`).\n\n' + AUTH_NOTE +
  '\n\n**FORMAT (confirmed by DB team + verified live 2026-08-24, successflag S):** `p_leave_to_amend` is a COMPOSITE string `Leave Type|DD-MON-YYYY|DD-MON-YYYY` (type|start|end) identifying the existing leave — e.g. `Annual Leave|12-MAR-2026|12-MAR-2026`. A numeric id raises ORA-01403 (404). Business rules still apply (e.g. Casual Leave max 1 day for HMC-Law employees). The amend LOV (op 62) lists the user\'s amendable leaves — pass `person_id` (view is person-scoped).\n\n' + VERIFIED);
setExamples('Leave', 'POST /leave/amend', [
  example('leave|Amend Annual 12-MAR to 13-MAR', 'Success (200, successflag=S) — composite format'),
  example('leave|Amend composite Casual 19-APR', 'Business Error (200, successflag=N) — extending Casual Leave beyond 1 day (HMC-Law rule)'),
  example('leave|Leave amend business error (no amendable leaves)', 'Staging error (404) — numeric id not found (ORA-01403)'),
]);

setBody('Leave', 'POST /leave/cancel', { p_leave_type: 'Annual Leave', p_leave_to_cancel: 'Annual Leave|12-MAR-2026|12-MAR-2026', p_reason_for_cancel: 'Plans changed' });
setDescription('Leave', 'POST /leave/cancel',
  '**Purpose:** op 58 — Leave cancel (`XXHMC_SND_HR_LEAV_CANCEL_PR`).\n\n' + AUTH_NOTE +
  '\n\n**FORMAT (verified live 2026-08-24, successflag S):** `p_leave_to_cancel` is a COMPOSITE string `Leave Type|DD-MON-YYYY|DD-MON-YYYY` (type|start|end) — e.g. `Annual Leave|12-MAR-2026|12-MAR-2026`. A numeric id raises ORA-01403 (404).\n\n' + VERIFIED);
setExamples('Leave', 'POST /leave/cancel', [
  example('leave|Cancel composite Annual 12-MAR', 'Success (200, successflag=S) — composite format'),
  example('leave|Leave cancel business error (no cancelable leaves)', 'Staging error (404) — numeric id not found (ORA-01403)'),
]);

setBody('Leave', 'POST /leave/return', {
  p_leave_details: 'Casual Leave|19-APR-2026|19-APR-2026',
  p_return_date: '20-Apr-2026',
});
setDescription('Leave', 'POST /leave/return',
  '**Purpose:** op 56 — Return from leave (`XXHMC_SND_RET_FRM_LEAV_PR`).\n\n' + AUTH_NOTE +
  '\n\n**FORMAT (verified live 2026-08-24):** `p_leave_details` is the SHORT composite `Leave Type|DD-MON-YYYY|DD-MON-YYYY` — this passes the lookup. Do NOT send the op 55 LOV\'s long display string ("… Leave Start Date : …") — it overflows the procedure\'s buffer (`ORA-06502` line 196; LOV display format vs procedure input mismatch reported to the DB team). Success additionally requires the Policy Awareness questionnaire (same prerequisite as op 10).\n\n' + VERIFIED);
setExamples('Leave', 'POST /leave/return', [
  expectedExample({
    name: 'Expected Success (200) — needs a user who submitted the Policy Awareness questionnaire (NOT a captured response)',
    method: 'POST', urlPath: '/leave/return?lang=en',
    requestBody: { p_leave_details: 'Casual Leave|19-APR-2026|19-APR-2026', p_return_date: '20-Apr-2026' },
    responseBody: EXPECTED_SUBMIT_SUCCESS,
  }),
  example('leave|Return short composite Casual 19-APR', 'Business Error (200, successflag=N) — Policy Awareness questionnaire required (format OK)'),
  example('leave|Leave return submit (real LOV value)', 'Staging DB error (500) — ORA-06502 when the LONG LOV display string is sent'),
]);

setExamples('Leave', 'GET /leave/lov/types', [example('leave|Types LOV', 'Success (200)')]);
setExamples('Leave', 'GET /leave/lov/reasons', [
  example('leave|Reasons LOV filtered', 'Success (200) — filtered by leave_type'),
  example('leave|Reasons LOV all', 'Success (200) — all reasons'),
]);
setExamples('Leave', 'GET /leave/lov/classes', [example('leave|Classes LOV', 'Success (200)')]);
setDescription('Leave', 'GET /leave/lov/defaults',
  '**Purpose:** op 45 — Leave defaults (employment context + per-user LOVs).\n\n' + AUTH_NOTE +
  '\n\n**Note:** first call on a cold Oracle cache can take ~20 s; warm calls are fast.\n\n' + VERIFIED);
setExamples('Leave', 'GET /leave/lov/defaults', [example('leave|Defaults enum 053613', 'Success (200)')]);
setExamples('Leave', 'GET /leave/lov/request-lov', [example('leave|Request LOV enum 053613', 'Success (200)')]);
setDescription('Leave', 'GET /leave/lov/return',
  '**Purpose:** op 55 — Return-from-leave LOV. The item `used_value` is what op 56 expects in `p_leave_details`.\n\n' + AUTH_NOTE + '\n\n' + VERIFIED);
setUrl('Leave', 'GET /leave/lov/return', '/leave/lov/return?username=AIBRAHIM39&lang=en');
setExamples('Leave', 'GET /leave/lov/return', [example('leave|Return LOV AIBRAHIM39', 'Success (200) — real leave rows')]);
setUrl('Leave', 'GET /leave/lov/cancel', '/leave/lov/cancel?username=AIBRAHIM39&lang=en');
setExamples('Leave', 'GET /leave/lov/cancel', [example('leave|Cancel LOV AIBRAHIM39', 'Success (200) — empty for this user')]);
setUrl('Leave', 'GET /leave/lov/amend', '/leave/lov/amend?person_id=26023&lang=en');
setDescription('Leave', 'GET /leave/lov/amend',
  '**Purpose:** op 62 — Leave amend LOV (`XXHMC_SND_LEAVE_AMEND_V`).\n\n' + AUTH_NOTE +
  '\n\n**IMPORTANT (DB team 2026-08-24):** the view is scoped by **PERSON_ID** (`WHERE person_id = 26023`) — pass `person_id`. `username`/`enum` remain accepted (legacy) but match nothing on this view, which is why they return empty. NOTE: `person_id` support requires the backend build of 2026-08-24+ (older builds reject the parameter with 400). Use the rows to build the composite `p_leave_to_amend` for op 57.\n\n' + VERIFIED);
setExamples('Leave', 'GET /leave/lov/amend', [example('leave|Amend LOV AIBRAHIM39', 'Success (200) — empty when filtered by username (view is person-scoped)')]);

// ============================ PAYSLIP ============================
setDescription('Payslip', 'GET /payslip/periods',
  '**Purpose:** op 5 — Payslip periods.\n\n' + AUTH_NOTE + '\n\n**Query:** `lang`, `username`.\n\n' + VERIFIED);
setExamples('Payslip', 'GET /payslip/periods', [example('payslip|Periods AIBRAHIM39', 'Success (200) — real periods')]);

setDescription('Payslip', 'GET /payslip/count',
  '**Purpose:** op 6 — Payslip count for a period (`XXHMC_SND_CHK_PAYROLL_CNT`).\n\n' + AUTH_NOTE + '\n\n**Query:** `lang`, `person_id`, `payslipperiod` ("Month YYYY").\n\n' +
  '**Heads-up for mobile:** the build deployed on staging returns `{ "count": n }`; latest main (commit 0616ca8, not deployed yet at test time) extends it to `{ "count": n, "rows": [{PERIOD_NAME, PERIOD_NAME_AR, ASSIGNMENT_ACTION_ID}] }` — the ASSIGNMENT_ACTION_ID feeds op 11 (generate). Re-capture after the next staging deploy.\n\n' + VERIFIED);
setExamples('Payslip', 'GET /payslip/count', [
  example('payslip|Count new shape (852709 Aug2024)', 'Success (200) — deployed build shape { count }'),
  example('payslip|Count validation bad period', 'Validation Error (400) — payslipperiod must be "Month YYYY"'),
]);

setUrl('Payslip', 'GET /payslip', '/payslip?person_id=26023&lang=en&payperiod=January%202026&assignmentid=7179444713');
setDescription('Payslip', 'GET /payslip',
  '**Purpose:** op 11 — Generate payslip (`XXHMC_SND_PAYSLIP_PR`, earnings/deductions REF CURSORs).\n\n' + AUTH_NOTE +
  '\n\n**Verified 2026-08-23:** real payslip returned for person_id 26023 / January 2026. For person 852709 the procedure fails with ORA-24338 ("statement handle not executed" — its cursor is never opened when the person/period has no payslip) → real 500 example below.\n\n' + VERIFIED);
setExamples('Payslip', 'GET /payslip', [
  example('payslip|Generate retry 2 person 26023', 'Success (200) — real payslip'),
  example('payslip|Generate retry 1', 'Staging DB error (500) — ORA-24338 for person without payslip in the period'),
]);

// ============================ LETTERS ============================
setDescription('Letters', 'GET /letters/lov',
  '**Purpose:** op 16 — Letter request LOVs (name/language/copies/country/deliveryLoc/mobile).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `enum` (username form works: AIBRAHIM39 / V-ISIDDIQUI).\n\n' + VERIFIED);
setExamples('Letters', 'GET /letters/lov', [
  example('letters|Letters LOV enum AIBRAHIM39', 'Success (200) — AIBRAHIM39'),
  example('letters|Letters LOV enum V-ISIDDIQUI', 'Success (200) — V-ISIDDIQUI'),
]);

setBody('Letters', 'POST /letters/apply', {
  p_letter_language: 'English',
  p_letter_name: 'Bank letter with details with effective date',
  p_country: 'Qatar',
  p_no_of_copies: '1',
  p_mobile_number: '55723893',
  p_letter_delivery_loc: 'Al Wakra Hospital',
  p_purpose_comments: 'test',
});
setUrl('Letters', 'POST /letters/apply', '/letters/apply?lang=en');
setDescription('Letters', 'POST /letters/apply',
  '**Purpose:** op 17 — Submit letter request (`XXHMC_SND_HR_EMPLYMNT_LTR_PR`).\n\n' + AUTH_NOTE +
  '\n\n**KNOWN STAGING ISSUE (2026-08-23):** with values taken from the op 16 LOVs the procedure raises `ORA-01403: no data found` (line 201/180 depending on the letter type) — reference data missing on staging; intermittently also ORA-00001 on FND_SESSIONS. Request format is correct per DTO/Swagger.\n\n' + VERIFIED);
setExamples('Letters', 'POST /letters/apply', [
  expectedExample({
    name: 'Expected Success (200) — built from code, pending staging DB fix (NOT a captured response)',
    method: 'POST', urlPath: '/letters/apply?lang=en',
    requestBody: {
      p_letter_language: 'English', p_letter_name: 'Bank letter with details with effective date', p_country: 'Qatar',
      p_no_of_copies: '1', p_mobile_number: '55723893', p_letter_delivery_loc: 'Al Wakra Hospital', p_purpose_comments: 'test',
    },
    responseBody: EXPECTED_SUBMIT_SUCCESS,
  }),
  example('letters|Letters apply submit', 'Staging DB error (404) — ORA-01403 inside the procedure'),
  example('letters|Letters apply validation empty', 'Validation Error (400) — required p_* fields missing'),
]);

// ============================ LOOKUPS ============================
setExamples('Lookups', 'GET /lookups/yes-no', [example('lookups|YesNo LOV', 'Success (200)')]);
setDescription('Lookups', 'GET /lookups/rfmi-user',
  '**Purpose:** op 26 — RFMI user LOV (who can be asked for more information; use with POST /approvals/:id/request-info).\n\n' + AUTH_NOTE +
  '\n\n**Note:** first call on a cold Oracle cache exceeded the 30 s gateway timeout (real 504 below); warm calls return in a few seconds.\n\n' + VERIFIED);
setExamples('Lookups', 'GET /lookups/rfmi-user', [
  example('lookups|RFMI user LOV try2', 'Success (200) — warm cache'),
  example('lookups|RFMI user LOV try1', 'Gateway Timeout (504) — first call on cold Oracle cache'),
]);
setExamples('Lookups', 'GET /lookups/lov', [
  example('lookups|Generic LOV marital', 'Success (200) — EMP_MARITAL_LOV'),
  example('lookups|Generic LOV unknown name', 'Validation Error (400) — unknown LOV name'),
]);
setExamples('Lookups', 'GET /lookups/master', [example('lookups|Master GetLeaveType', 'Success (200) — GetLeaveType')]);

// ============================ HEALTH ============================
setExamples('Health', 'GET /health', [example('health|Health', 'Success (200)')]);
setDescription('Health', 'GET /health/db',
  '**Purpose:** Oracle connectivity diagnostics (always HTTP 200 — inspect `status`/`connected`). PUBLIC.\n\n' + VERIFIED);
setExamples('Health', 'GET /health/db', [
  example('health|Health DB (new shape with usersDb)', 'Success (200) — full Oracle diagnostics (current build)'),
]);

// ---- add GET /health/users-db (new endpoint from the Users-DB auth cycle) ----
{
  const healthFolder = folder('Health');
  const existingIdx = healthFolder.item.findIndex((i) => i.name === 'GET /health/users-db');
  if (existingIdx >= 0) healthFolder.item.splice(existingIdx, 1);
  healthFolder.item.push({
    name: 'GET /health/users-db',
    request: {
      method: 'GET',
      header: [],
      url: pmUrl('/health/users-db'),
      description:
        '**Purpose:** Users DB (SQL Server — device/MPIN/OTP auth-cycle database) connectivity diagnostics. PUBLIC; always HTTP 200 — inspect `status`/`connected`/`error`.\n\n' +
        '**Staging status (2026-08-23):** Users DB is NOT configured yet (`USERS_DB host/database/user missing`) — real response below. Once DevOps sets the USERS_DB_* variables the real auth cycle (SMS OTP + persisted MPIN) becomes testable.\n\n' + VERIFIED,
    },
    response: [],
  });
}
setExamples('Health', 'GET /health/users-db', [
  example('health|Health Users DB (new endpoint)', 'Success (200) — Users DB not configured on staging yet'),
]);

fs.writeFileSync(COLLECTION, JSON.stringify(collection, null, 2) + '\n');
console.log('Collection part-2 updated OK.');
JSON.parse(fs.readFileSync(COLLECTION, 'utf8'));
console.log('Re-parse OK.');
