/**
 * Applies verified fixes + REAL captured examples to the Postman collection.
 * - Fixes request bodies/urls/descriptions for the 6 target modules
 * - Replaces placeholder examples with real responses captured from staging
 *   (current deployed build, 2026-08-23)
 * - Adds the missing POST /approvals/:id/request-info request
 *
 * Inputs: results-phase*.json (recorded by api-test-runner.js / resilient-runner.js)
 * Usage:  node update-collection.js [collection-path]
 */
const fs = require('fs');
const path = require('path');

const COLLECTION = process.argv[2] || 'C:/New folder/hmc-project/HMC_BackEnd/postman/HMC-Sanaad-Full.postman_collection.json';
const TOOLS = 'C:/New folder/hmc-project/tools';

const collection = JSON.parse(fs.readFileSync(COLLECTION, 'utf8'));

// ---------- load all captured results, keyed by "module|name" ----------
const results = {};
for (const f of fs.readdirSync(TOOLS).filter((f) => /^results-phase\d.*\.json$/.test(f)).sort()) {
  for (const r of JSON.parse(fs.readFileSync(path.join(TOOLS, f), 'utf8'))) {
    if (r.httpStatus === undefined) continue; // network failures are not examples
    results[`${r.module}|${r.name}`] = r; // later phases overwrite earlier ones
  }
}

const STATUS_TEXT = {
  200: 'OK', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 409: 'Conflict', 500: 'Internal Server Error', 503: 'Service Unavailable',
};

// ---------- helpers ----------
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

/** Build a Postman URL object from a raw path like "/contact/phone?lang=en" with {{baseUrl}} host. */
function pmUrl(rawPath, pathVars) {
  const [pathPart, queryPart] = rawPath.split('?');
  const url = {
    raw: `{{baseUrl}}${rawPath}`,
    host: ['{{baseUrl}}'],
    path: pathPart.split('/').filter(Boolean),
  };
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

/** Build a Postman example from a captured result (module|case-name key). */
function example(key, name, { urlPath, pathVars } = {}) {
  const r = results[key];
  if (!r) throw new Error(`no captured result for: ${key}`);
  const original = {
    method: r.method,
    header: [],
    url: pmUrl(urlPath ?? r.path, pathVars),
  };
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

/**
 * Build an EXPECTED-success example from the backend code (NOT a captured
 * response) for endpoints whose success path is blocked by staging DB/env
 * issues. The name makes the provenance explicit.
 */
function expectedExample({ name, method, urlPath, pathVars, requestBody, responseBody }) {
  const original = { method, header: [], url: pmUrl(urlPath, pathVars) };
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

/** Tolerant example that names itself by the captured outcome (S vs N). Null when not captured. */
function maybeSuccessExample(key, baseName, opts) {
  const r = results[key];
  if (!r) return null;
  const isS = JSON.stringify(r.responseBody).includes('"successflag":"S"');
  return example(key, (isS ? 'Success (200, successflag=S) — ' : 'Business Error (200, successflag=N) — ') + baseName.replace(/^Response — /, ''), opts);
}

/** The exact success envelope `ResponseInterceptor` + `toSubmitResult` produce for submit procs. */
const EXPECTED_SUBMIT_SUCCESS = {
  status: 'success',
  successflag: 'S',
  message: 'Success',
  httpStatusCode: 200,
};
const EXPECTED_NAME =
  'Expected Success (200) — built from code, pending staging DB/env fix (NOT a captured response)';

function setExamples(folderName, reqName, examples) {
  request(folderName, reqName).response = examples.filter(Boolean);
}
function setBody(folderName, reqName, obj) {
  request(folderName, reqName).request.body = rawBody(obj);
}
function setDescription(folderName, reqName, text) {
  request(folderName, reqName).request.description = text;
}
function setUrl(folderName, reqName, rawPath, pathVars) {
  request(folderName, reqName).request.url = pmUrl(rawPath, pathVars);
}

const AUTH_NOTE =
  '**Auth:** Bearer {{token}} (staging currently runs with AUTH_DISABLED=true: requests succeed even without a token, ' +
  'the backend injects dev user `AIBRAHIM39`/`037400`, and 401/403 cannot be reproduced there).';
const VERIFIED = '**Verified against staging (current build) on 2026-08-23 — every example below is a real captured response.**';

// =====================================================================
// CONTACT
// =====================================================================
setDescription('Contact', 'GET /contact/lov/phone-type',
  '**Purpose:** op 27 — Phone-type LOV (`XXHMC_SND_PHONE_TYPE_V`).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang` (en|ar, default en).\n\n**Response:** read envelope `{ result: { items: [{code, meaning, used_value}] }, opstatus, status, httpStatusCode }` — `used_value` is always the English label and is what submit procedures expect.\n\n' + VERIFIED);
setExamples('Contact', 'GET /contact/lov/phone-type', [
  example('contact|Success (200) — en', 'Success (200) — en'),
  example('contact|Success (200) — ar', 'Success (200) — ar'),
  example('contact|Validation Error (400) — bad lang', 'Validation Error (400) — lang must be en|ar'),
]);

setDescription('Contact', 'GET /contact/lov/country',
  '**Purpose:** op 30 — Country LOV (`XXHMC_SND_COUNTRY_LOV`).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang` (en|ar, default en).\n\n**Response:** read envelope with `items: [{code, meaning, meaningAr?, used_value}]`. NOTE: submit procedures expect the country NAME (`used_value`, e.g. `Qatar`), not the 2-letter `code` — sending `QA` to op 25 returned "Invalid Country".\n\n' + VERIFIED);
setExamples('Contact', 'GET /contact/lov/country', [
  example('contact|Success (200) — country en', 'Success (200) — en'),
  example('contact|Validation Error (400) — country bad lang', 'Validation Error (400) — lang must be en|ar'),
]);

setBody('Contact', 'POST /contact/phone', { phones: [{ phoneType: 'Qatar Mobile Number', phoneNumber: '55512345' }] });
setUrl('Contact', 'POST /contact/phone', '/contact/phone?lang=en');
setDescription('Contact', 'POST /contact/phone',
  '**Purpose:** op 28 — Add/Update phone number(s) (`XXHMC_SND_PHONE_PKG.ADD_OR_UPDATE_PHONE`, one call per array item; stops at the first failed item).\n\n' + AUTH_NOTE +
  '\n\n**Body (UpdatePhoneRequestDto):** `phones` — required non-empty array of `{ phoneId?, objectVersionNumber?, phoneType (required), phoneNumber (required) }`. Unknown keys are rejected (400). Omit `phoneId` to create; send it to update.\n\n' +
  '**Response:** action envelope `{ status, successflag (S|N), message, httpStatusCode }` — business failures come back as HTTP 200 with `successflag: "N"`.\n\n' +
  '**KNOWN STAGING ISSUE (re-verified 2026-08-24):** the procedure still rejects EVERY phone type with `successflag N — "Phone type doesnot exist"`. The DB team shared the intended 11-value list (incl. `Landline` and 3 sickness-address types the op 27 LOV does not expose) — retested `Qatar Mobile Number` and `Landline` from that list and both are STILL rejected, so the procedure\'s internal lookup remains broken/empty on staging. Request format is correct per DTO/Swagger.\n\n' + VERIFIED);
setExamples('Contact', 'POST /contact/phone', [
  expectedExample({
    name: EXPECTED_NAME,
    method: 'POST',
    urlPath: '/contact/phone?lang=en',
    requestBody: { phones: [{ phoneType: 'Qatar Mobile Number', phoneNumber: '55512345' }] },
    responseBody: EXPECTED_SUBMIT_SUCCESS,
  }),
  example('contact|Phone update-in-place (real phoneId, same values)', 'Business Error (200, successflag=N) — even own phone\'s stored type rejected (staging DB issue)'),
  example('contact|Success (200) — create phone', 'Business Error (200, successflag=N) — create with LOV meaning rejected'),
  example('contact|Phone create with LOV code M', 'Business Error (200, successflag=N) — create with LOV code rejected'),
  example('contact|Validation Error (400) — empty body', 'Validation Error (400) — phones required'),
  example('contact|Validation Error (400) — unknown property', 'Validation Error (400) — unknown key rejected'),
]);

setBody('Contact', 'POST /contact/phone/delete', { phoneId: '1574794' });
setUrl('Contact', 'POST /contact/phone/delete', '/contact/phone/delete?lang=en');
setDescription('Contact', 'POST /contact/phone/delete',
  '**Purpose:** op 32 — Delete phone (`XXHMC_SND_DEL_PHONE_NUMBER_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Body (DeletePhoneRequestDto):** `phoneId` (required) — an existing phone id of the user (visible in `GET /profile` → `phones[].phoneId`); `phoneType`, `phoneNumber` optional.\n\n' +
  '**Response:** action envelope; unknown phone id → HTTP 200 with `successflag N`.\n\n' +
  '**Note:** a success example was intentionally NOT captured — the dev user has exactly one real phone (310129) and deleting it would destroy real staging data.\n\n' + VERIFIED);
setExamples('Contact', 'POST /contact/phone/delete', [
  expectedExample({
    name: 'Expected Success (200) — built from code; needs a real deletable phoneId (NOT a captured response)',
    method: 'POST',
    urlPath: '/contact/phone/delete?lang=en',
    requestBody: { phoneId: '1574794' },
    responseBody: EXPECTED_SUBMIT_SUCCESS,
  }),
  example('contact|Business Error — delete unknown phoneId', 'Business Error (200, successflag=N) — phone id does not exist'),
  example('contact|Validation Error (400) — delete empty body', 'Validation Error (400) — phoneId required'),
]);

setBody('Contact', 'POST /contact/address', {
  p_effective_date: '20260823',
  p_primary_flag: 'N',
  p_country: 'Qatar',
  p_address_type: 'Temporary Offer Address',
  p_address_line1: 'Building 45',
  p_town_or_city: 'Doha',
  p_po_box: '12345',
});
setUrl('Contact', 'POST /contact/address', '/contact/address?lang=en');
setDescription('Contact', 'POST /contact/address',
  '**Purpose:** op 29 — Create address (`XXHMC_SND_CREATE_ADDRESS_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Body (CreateAddressRequestDto — p_* keys):** required `p_effective_date` (yyyymmdd), `p_primary_flag` (Y|N), `p_country` (country NAME from op 30 `used_value`, e.g. `Qatar`), `p_address_type` (address-type value from op 64 LOV, e.g. `Primary Local Address`, `Temporary Offer Address`), `p_address_line1`; optional `p_main_address`, `p_address_line2/3`, `p_town_or_city`, `p_region1/2/3`, `p_po_box`. Non-`p_*` keys (the old collection body: `addressType`, `country`) are REJECTED with 400.\n\n' +
  '**Response:** action envelope; business failures are HTTP 200 with `successflag N`.\n\n' +
  '**Business rule (verified):** creating a second address of the same type with an overlapping date range fails ("You have already created an address ... which overlaps this date range" — sanitized on the wire).\n\n' + VERIFIED);
setExamples('Contact', 'POST /contact/address', [
  example('contact|Create address — Temporary Offer Address', 'Success (200, successflag=S)'),
  example('contact|Success (200) — create address', 'Business Error (200, successflag=N) — duplicate/overlapping address for the type'),
  example('contact|Validation Error (400) — address empty body', 'Validation Error (400) — required p_* fields missing'),
  example('contact|Validation Error (400) — address old wrong keys', 'Validation Error (400) — non-p_* keys rejected (old collection body)'),
]);

setBody('Contact', 'POST /contact/address/update', {
  p_address_id: '1720601',
  p_effective_date: '20260823',
  p_address_type: 'Primary Home Country Address',
  p_country: 'Qatar',
  p_address_line1: 'Building 45',
});
setUrl('Contact', 'POST /contact/address/update', '/contact/address/update?lang=en');
setDescription('Contact', 'POST /contact/address/update',
  '**Purpose:** op 25 — Update address (`XXHMC_SND_UPD_ADDRESS_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Body (UpdateAddressRequestDto — p_* keys):** required `p_address_id` (an address the user OWNS — see `GET /profile` → `outsideAddresses[].addressId`), `p_effective_date` (yyyymmdd); optional `p_address_line1/2/3`, `p_city`, `p_region1/2/3`, `p_po_box`, `p_address_type`, `p_country`. Non-`p_*` keys are rejected (400).\n\n' +
  '**Verified rules (2026-08-23):** `p_country` must be the country NAME (`Qatar`) — the 2-letter code `QA` returns `successflag N — "Invalid Country"`; `p_address_type` must match the target address\'s own type (updating address 1720601 of type `Primary Home Country Address` succeeded; foreign/unmatched ids+types return "It is not possible to save the address with the type that you have chosen"). Oracle date-tracks the change: repeating the SAME update with the SAME `p_effective_date` returns a generic database error (`successflag N`) — use a new effective date for a new update.\n\n' + VERIFIED);
setExamples('Contact', 'POST /contact/address/update', [
  example('contact|Update address real id country name', 'Success (200, successflag=S) — own address id + matching type + country name'),
  example('contact|Update address real id (same values)', 'Business Error (200, successflag=N) — "Invalid Country" (2-letter code sent)'),
  example('contact|Success (200) — update address', 'Business Error (200, successflag=N) — address type does not match the address'),
  example('contact|Validation Error (400) — address update empty body', 'Validation Error (400) — p_address_id / p_effective_date required'),
]);

// =====================================================================
// DEPENDENTS
// =====================================================================
setBody('Dependents', 'POST /dependents', {
  p_title: 'Mr.',
  p_first_name: 'Testchild3',
  p_last_name: 'Ibrahim',
  p_relationship: 'Child',
  p_relationship_start_date: '20150101',
  p_gender: 'Male',
  p_date_of_birth: '20150101',
  p_effective_date: '20260823',
  p_email_address: 'testchild3@example.com',
  p_passport_number: 'A7654323',
  p_pp_issue_date: '20200101',
  p_pp_expiry_date: '20300101',
  p_place_of_issue: 'Doha',
  p_country_of_issue: 'QA',
  p_visa_type: 'Residence Permit',
  p_visa_number: '123456791',
  p_visa_issue_date: '20250101',
  p_visa_expiry_date: '20270101',
  p_visa_validity: 'Yes',
  p_id_number: '31599876544',
  p_id_issue_date: '20250101',
  p_id_expiry_date: '20270101',
  p_job_as_in_qid: 'Student',
  p_type_of_sponsorship: 'Employee',
  p_sponsor_contact_name: 'Amir Ibrahim',
  p_file_name1: 'birth-certificate.pdf',
  p_attachment1: 'dGVzdCBhdHRhY2htZW50',
});
setUrl('Dependents', 'POST /dependents', '/dependents?lang=en');
setDescription('Dependents', 'POST /dependents',
  '**Purpose:** op 65 — Add dependent (`XXHMC_SND_ADD_DEPENDENT_PKG.XXHMC_SND_ADD_DEPENDENT_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Body (AddDependentRequestDto — p_* keys):** DTO requires `p_first_name`, `p_last_name`, `p_relationship`, `p_gender`, `p_date_of_birth` (yyyymmdd), `p_effective_date` (yyyymmdd). The old collection body (`p_dependent_name`, `p_dob`) was invalid — rejected with 400.\n\n' +
  '**Oracle flexfield additionally REQUIRES (discovered live, 2026-08-23 — the wire only shows a sanitized message, the real errors are FLEX-NULL/FLEX-VALUE):** at least one attachment ("Attachement is mandatory"), `p_passport_number`, `p_pp_expiry_date` ("Date of Expiry"), `p_country_of_issue`, `p_visa_type` (op 64 LOV VISA group: `QID(Qatari)` | `Residence Permit`), `p_visa_validity` = `Yes`|`No` (HMC_YES_NO_POP_LIST), and a UNIQUE `p_id_number` (QID — duplicates return "This QID already exists."). `p_relationship` must be an op 64 CONTACT value (`Child`, `Spouse`, ... — NOT "Son"). With all of those the procedure returns `successflag S` (real example below).\n\n' + VERIFIED);
setExamples('Dependents', 'POST /dependents', [
  example('dependents|Add dependent SUCCESS (full flexfield payload)', 'Success (200, successflag=S) — full flexfield payload'),
  example('dependents|Success (200) — add dependent', 'Business Error (200, successflag=N) — attachment is mandatory'),
  example('dependents|Add dependent WITH attachment', 'Business Error (200, successflag=N) — flexfield-required fields missing (sanitized on the wire)'),
  example('dependents|Validation Error (400) — add empty body', 'Validation Error (400) — required p_* fields missing'),
]);

setBody('Dependents', 'POST /dependents/update', {
  p_dependent_id: '4668195',
  p_first_name: 'John',
  p_effective_date: '20260823',
  p_file_name1: 'update-proof.pdf',
  p_attachment1: 'dGVzdCBhdHRhY2htZW50',
});
setUrl('Dependents', 'POST /dependents/update', '/dependents/update?lang=en');
setDescription('Dependents', 'POST /dependents/update',
  '**Purpose:** op 24 — Update dependent (`XXHMC_SND_ADD_DEPENDENT_PKG.XXHMC_SND_UPDATE_DEPENDENT_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Body (UpdateDependentRequestDto — p_* keys):** required `p_dependent_id`; every other field optional (names, passport, visa, QID, address, phones, attachments). Legacy misspellings (`p_gendar`, `p_relation_ship`, `p_visa_validy`, `p_date_of_issuue_qid`, `p_type_of_sponsership`) are also accepted and mirrored. `p_dependent_name` (old collection body) is rejected with 400.\n\n' +
  '**Verified (2026-08-24):** attachment is mandatory. The DB team provided real dependent ids for AIBRAHIM39 (329302/329303/42465/1607679), BUT the `ORA-00027` kill-session defect at package line 3506 REGRESSED — it intermittently returns (reproduced with real id 329302). When it does not crash, the procedure validates ownership properly ("Dependent doesnot exits…" for foreign ids). DB team re-informed.\n\n' + VERIFIED);
setExamples('Dependents', 'POST /dependents/update', [
  expectedExample({
    name: 'Expected Success (200) — pending the intermittent ORA-00027 fix (NOT a captured response)',
    method: 'POST',
    urlPath: '/dependents/update?lang=en',
    requestBody: {
      p_dependent_id: '329302',
      p_first_name: 'Jerome',
      p_effective_date: '20260824',
      p_file_name1: 'update-proof.pdf',
      p_attachment1: '<base64-encoded file content>',
    },
    responseBody: EXPECTED_SUBMIT_SUCCESS,
  }),
  example('dependents|Update dependent REAL id 329302', 'Staging DB error (200, successflag=N sanitized) — intermittent ORA-00027 regressed with real id'),
  example('dependents|BLOCKER recheck - dependent update', 'Business Error (200, successflag=N) — dependent id not the caller\'s (ORA-01403 sanitized)'),
  example('dependents|Update dependent (pinned id)', 'Business Error (200, successflag=N) — attachment is mandatory'),
  example('dependents|Validation Error (400) — update empty body', 'Validation Error (400) — p_dependent_id required'),
]);

setBody('Dependents', 'POST /dependents/delete', {
  p_dependent_id: '1607679',
  p_contact_type: 'C',
  p_relationship: 'Child',
  p_relationship_end_date: '20260824',
  p_file_name1: 'end-proof.pdf',
  p_attachment1: 'dGVzdCBhdHRhY2htZW50',
});
setUrl('Dependents', 'POST /dependents/delete', '/dependents/delete?lang=en');
setDescription('Dependents', 'POST /dependents/delete',
  '**Purpose:** op 31 — Delete dependent (`XXHMC_SND_REMOVE_DEPENDENT_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Verified rules (2026-08-24, with the DB team\'s real ids 329302/329303/42465/1607679 for AIBRAHIM39):** `p_contact_type` (code, e.g. `C`) AND `p_relationship` (e.g. `Child`) must BOTH be sent — omitting them makes the procedure try to update PER_CONTACT_RELATIONSHIPS.CONTACT_TYPE to NULL (`ORA-01407`, sanitized on the wire). At least one attachment is mandatory. Unknown id → `successflag N — "Dependent does not exist"`.\n\n' + VERIFIED);
setExamples('Dependents', 'POST /dependents/delete', [
  maybeSuccessExample('dependents|Delete SUCCESS attempt full', 'Response — full payload (real id + contact type + relationship + attachment)'),
  example('dependents|Delete 1607679 contact C rel Child', 'Business Error (200, successflag=N) — attachment is mandatory (contact-type check passed)'),
  example('dependents|Delete dependent REAL id 1607679', 'Business Error (200, successflag=N) — ORA-01407 when p_contact_type/p_relationship are omitted (sanitized)'),
  example('dependents|Business Error — delete unknown dependent', 'Business Error (200, successflag=N) — dependent does not exist'),
  example('dependents|Validation Error (400) — delete empty body', 'Validation Error (400) — p_dependent_id required'),
]);

setDescription('Dependents', 'GET /dependents/lov',
  '**Purpose:** op 64 — Dependent LOV (`XXHMC_SND_DEP_LOOKUP_LOV` — one view mixing address types, relationships, genders, employment statuses...). Items carry `type` (grouping, e.g. `CONTACT`) and `used_value` (English label to bind back on submits).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang` (en|ar); optional `data_type` to return only one group (e.g. `CONTACT` = relationships).\n\n' + VERIFIED);
setUrl('Dependents', 'GET /dependents/lov', '/dependents/lov?lang=en');
setExamples('Dependents', 'GET /dependents/lov', [
  example('dependents|Success (200) — lov en', 'Success (200) — full mixed list'),
  example('dependents|Success (200) — lov filtered data_type=CONTACT', 'Success (200) — filtered by data_type=CONTACT'),
  example('dependents|Validation Error (400) — lov bad lang', 'Validation Error (400) — lang must be en|ar'),
]);

setDescription('Dependents', 'GET /dependents/passport/types',
  '**Purpose:** op 33 — Passport types LOV (`XXHMC_SND_PASSPORT_TYPE`).\n\n' + AUTH_NOTE + '\n\n**Query:** `lang` (en|ar).\n\n' + VERIFIED);
setExamples('Dependents', 'GET /dependents/passport/types', [
  example('dependents|Success (200) — passport types', 'Success (200)'),
  example('dependents|Passport types — bad lang 400', 'Validation Error (400) — lang must be en|ar'),
]);

setDescription('Dependents', 'GET /dependents/passport/issue-place',
  '**Purpose:** op 49 — Passport issue-place LOV (`XXHMC_SND_DEP_PLACE_LOV`).\n\n' + AUTH_NOTE + '\n\n**Query:** `lang` (en|ar).\n\n' + VERIFIED);
setExamples('Dependents', 'GET /dependents/passport/issue-place', [
  example('dependents|Success (200) — issue place', 'Success (200)'),
]);

setBody('Dependents', 'POST /dependents/passport/apply', {
  p_passport_number: 'A498989',
  p_date_of_issue: '20260121',
  p_date_of_expiry: '20360121',
  p_type_of_passport: 'Normal',
  p_place_of_issue: 'Doha',
  p_country_of_issue: 'QA',
});
setUrl('Dependents', 'POST /dependents/passport/apply', '/dependents/passport/apply?lang=en');
setDescription('Dependents', 'POST /dependents/passport/apply',
  '**Purpose:** op 34 — Passport detail request (`XXHMC_SND_PASS_DTL_PR`) — for the EMPLOYEE (not keyed by a dependent id; the old collection body sent `p_dependent_id`/`p_passport_type`, which are rejected with 400).\n\n' + AUTH_NOTE +
  '\n\n**Body (PassportApplyRequestDto — p_* keys):** required `p_passport_number`, `p_date_of_issue` (yyyymmdd), `p_date_of_expiry` (yyyymmdd), `p_type_of_passport` (op 33 LOV), `p_place_of_issue` (op 49 LOV), `p_country_of_issue`; optional attachments.\n\n' +
  '**Response:** action envelope — real success captured (`successflag S`). NOTE: on a cold Oracle cache the first call was observed to take >20 s.\n\n' + VERIFIED);
setExamples('Dependents', 'POST /dependents/passport/apply', [
  example('dependents|Success (200) — passport apply', 'Success (200, successflag=S)'),
  example('dependents|Validation Error (400) — passport empty body', 'Validation Error (400) — required p_* fields missing'),
]);

// =====================================================================
// SCHOOL FEES
// =====================================================================
setBody('School Fees', 'POST /school-fees/apply', {
  p_academic_year: '2025-2026',
  p_acd_st_dt: '20250901',
  p_acd_end_dt: '20260630',
  p_child_name: 'Jerome Amir Sami Samir Ibrahim',
  p_child_date_birth: '20100923',
  p_passport_number: 'A38697134',
  p_rp_number: '31081804108',
  p_school_name: 'Al Arqam Academy',
  p_educational_stage: 'Primary',
  p_request_type: 'Cash',
  p_term: 'Term1',
  p_amount: '1000',
  p_receipt_number: '123',
  p_spouse_working: 'No',
  p_comments: 'test',
});
setUrl('School Fees', 'POST /school-fees/apply', '/school-fees/apply?lang=en');
setDescription('School Fees', 'POST /school-fees/apply',
  '**Purpose:** op 39 — School-fee request (`XXHMC_SND_SCHOOL_FEE_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Body (SchoolFeeApplyRequestDto — p_* keys):** required `p_academic_year` (op 50 LOV), `p_acd_st_dt`/`p_acd_end_dt` (yyyymmdd), `p_child_name` + `p_child_date_birth` (real values from GET /school-fees/children), `p_school_name` (op 37 LOV), `p_educational_stage` (op 40 LOV), `p_request_type` (op 53 LOV — for this user only `Cash`), `p_term` (op 38 LOV, e.g. `Term1`), `p_amount`; optional `p_passport_number`, `p_rp_number`, `p_receipt_number`, `p_spouse_working`, `p_comments`, attachments. The old collection body was missing 6 required fields (400).\n\n' +
  '**KNOWN STAGING ISSUE (2026-08-23):** with real child/school/LOV data the procedure itself fails: `ORA-01403: no data found` at line 197 (surfaced as HTTP 404) and intermittently `ORA-00027` at line 114 (HTTP 500). Exhaustively probed — school by name AND by code, `test` values from the spec sample, full optional fields (passport/RP/receipt/spouse/comments), with and without attachment, both academic years — all hit line 197. The failing SELECT INTO is inside the procedure (reference data missing on staging); needs the DB team — request format matches DTO/Swagger/spec.\n\n' + VERIFIED);
setExamples('School Fees', 'POST /school-fees/apply', [
  expectedExample({
    name: EXPECTED_NAME,
    method: 'POST',
    urlPath: '/school-fees/apply?lang=en',
    requestBody: {
      p_academic_year: '2025-2026',
      p_acd_st_dt: '20250901',
      p_acd_end_dt: '20260630',
      p_child_name: 'Jerome Amir Sami Samir Ibrahim',
      p_child_date_birth: '20100923',
      p_passport_number: 'A38697134',
      p_rp_number: '31081804108',
      p_school_name: 'Al Arqam Academy',
      p_educational_stage: 'Primary',
      p_request_type: 'Cash',
      p_term: 'Term1',
      p_amount: '1000',
      p_receipt_number: '123',
      p_spouse_working: 'No',
      p_file_name1: 'receipt.pdf',
      p_attachment1: '<base64-encoded file content>',
    },
    responseBody: EXPECTED_SUBMIT_SUCCESS,
  }),
  example('school-fees|Apply fuller payload (spec-style)', 'Staging DB error (404) — ORA-01403 raised inside XXHMC_SND_SCHOOL_FEE_PR'),
  example('school-fees|Apply retry (same real data)', 'Staging DB error (500) — intermittent ORA-00027 inside the procedure'),
  example('school-fees|Validation Error (400) — empty body', 'Validation Error (400) — required p_* fields missing'),
]);

setUrl('School Fees', 'GET /school-fees/lov/schools', '/school-fees/lov/schools?lang=en&username=AIBRAHIM39');
setDescription('School Fees', 'GET /school-fees/lov/schools',
  '**Purpose:** op 37 — School name LOV (`XXHMC_SND_SCHOOL_NAME_LOV`, Oracle-side paging).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `username` (required — Oracle username form), optional `search`, `page` (default 1), `pageSize` (default 100, max 200).\n\n' + VERIFIED);
setExamples('School Fees', 'GET /school-fees/lov/schools', [
  example('school-fees|Success (200) — schools', 'Success (200)'),
  example('school-fees|Success (200) — schools search+page', 'Success (200) — search=Doha&page=1&pageSize=5'),
  example('school-fees|Validation Error (400) — schools missing username', 'Validation Error (400) — username required'),
]);

setDescription('School Fees', 'GET /school-fees/lov/terms',
  '**Purpose:** op 38 — School term LOV (`XXHMC_SND_SCHOOL_TERM_LOV`). Bind `used_value` (e.g. `Term1`) back on submits.\n\n' + AUTH_NOTE + '\n\n' + VERIFIED);
setExamples('School Fees', 'GET /school-fees/lov/terms', [example('school-fees|Success (200) — terms', 'Success (200)')]);
setDescription('School Fees', 'GET /school-fees/lov/edu-stage',
  '**Purpose:** op 40 — Education stage LOV (`XXHMC_SND_EDU_STAGE_LOV`).\n\n' + AUTH_NOTE + '\n\n' + VERIFIED);
setExamples('School Fees', 'GET /school-fees/lov/edu-stage', [example('school-fees|Success (200) — edu stage', 'Success (200)')]);
setDescription('School Fees', 'GET /school-fees/lov/academic-year',
  '**Purpose:** op 50 — Academic year LOV (`XXHMC_SND_ACAD_YR_STRT_END_LOV`).\n\n' + AUTH_NOTE + '\n\n' + VERIFIED);
setExamples('School Fees', 'GET /school-fees/lov/academic-year', [example('school-fees|Success (200) — academic year', 'Success (200)')]);
setDescription('School Fees', 'GET /school-fees/lov/request-type',
  '**Purpose:** op 53 — Request type LOV (`XXHMC_SND_REQUEST_TYPE_LOV`, user-scoped).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `username` (required).\n\n' + VERIFIED + ' For AIBRAHIM39 the only value is `Cash`.');
setExamples('School Fees', 'GET /school-fees/lov/request-type', [example('school-fees|Success (200) — request type', 'Success (200)')]);

setDescription('School Fees', 'GET /school-fees/children',
  '**Purpose:** op 52 — Child details (`CHILD_DETS_VIEW` table function). The Oracle call is keyed by the authenticated USERNAME (per DB team), so on staging (AUTH_DISABLED) it always returns dev user AIBRAHIM39\'s children regardless of `enum`.\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `enum` (required by the DTO), `acadyrstrtdt` (required, yyyymmdd).\n\n' + VERIFIED);
setExamples('School Fees', 'GET /school-fees/children', [
  example('school-fees|Success (200) — children', 'Success (200) — real children of the dev user'),
  example('school-fees|Validation Error (400) — children bad date', 'Validation Error (400) — acadyrstrtdt must be yyyymmdd'),
  example('school-fees|Validation Error (400) — children missing enum', 'Validation Error (400) — enum required'),
]);

// =====================================================================
// ANNUAL TICKET
// =====================================================================
setDescription('Annual Ticket', 'GET /annual-ticket/master',
  '**Purpose:** op 66 — Annual-ticket master LOV. NOTE: the Sanaad spec maps op 66 to `XXHMC_SND_TICKET_MASTER` keyed by person_id (rich contract/contact rows), but the backend deliberately reads the user-scoped `XXHMC_SND_ANNUAL_TICKT_LOV` instead (unfiltered TICKET_MASTER exceeded the request timeout). Username comes from the token (staging: AIBRAHIM39).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang` (en|ar).\n\n' + VERIFIED);
setExamples('Annual Ticket', 'GET /annual-ticket/master', [
  example('annual-ticket|Success (200) — master', 'Success (200)'),
  example('annual-ticket|Validation Error (400) — master bad lang', 'Validation Error (400) — lang must be en|ar'),
]);

setBody('Annual Ticket', 'POST /annual-ticket/apply', {
  p_request_for: 'Self',
  p_employee: '26023',
  p_request_type: 'Annual Ticket',
  p_contractual_year: '01-SEP-2025 to 31-AUG-2026',
  p_traveling_dest: 'Doha',
  p_travel_class: 'Economy',
});
setUrl('Annual Ticket', 'POST /annual-ticket/apply', '/annual-ticket/apply?lang=en');
setDescription('Annual Ticket', 'POST /annual-ticket/apply',
  '**Purpose:** op 67 — Submit annual ticket (`XXHMC_SND_TICKET_REQ_PR`).\n\n' + AUTH_NOTE +
  '\n\n**Body (AnnualTicketApplyRequestDto — p_* keys):** required `p_request_for`, `p_employee`, `p_request_type`, `p_contractual_year`, `p_traveling_dest`, `p_travel_class`; optional `p_passenger1..4`, `p_comments`, attachments. The old collection body (`p_ticket_class`, `p_travel_year`) was invalid (400).\n\n' +
  '**IMPORTANT (CONFIRMED by the DB team 2026-08-24):** `p_employee` must be the Oracle **PERSON_ID** (e.g. `26023` for AIBRAHIM39) — NOT the employee number (they rejected 053613/53613/037400 in the flexfield). `p_contractual_year` must be the full period text (`01-SEP-2025 to 31-AUG-2026`). Re-tested 2026-08-24: format passes; the dev user still has no ticket entitlement ("No ticket balance available…") — a `successflag S` needs an employee with a balance (requested from the DB team).\n\n' + VERIFIED);
setExamples('Annual Ticket', 'POST /annual-ticket/apply', [
  expectedExample({
    name: 'Expected Success (200) — built from code; needs an employee with ticket balance (NOT a captured response)',
    method: 'POST',
    urlPath: '/annual-ticket/apply?lang=en',
    requestBody: {
      p_request_for: 'Self',
      p_employee: '26023',
      p_request_type: 'Annual Ticket',
      p_contractual_year: '01-SEP-2025 to 31-AUG-2026',
      p_traveling_dest: 'Doha',
      p_travel_class: 'Economy',
    },
    responseBody: EXPECTED_SUBMIT_SUCCESS,
  }),
  example('annual-ticket|Apply with person id 26023', 'Business Error (200, successflag=N) — correct format; user has no ticket balance'),
  example('annual-ticket|Success (200) — apply', 'Business Error (200, successflag=N) — employee number rejected by flexfield (wrong p_employee format)'),
  example('annual-ticket|Validation Error (400) — empty body', 'Validation Error (400) — required p_* fields missing'),
]);

// =====================================================================
// APPROVALS
// =====================================================================
setUrl('Approvals', 'GET /approvals', '/approvals?enum=AIBRAHIM39&lang=en');
setDescription('Approvals', 'GET /approvals',
  '**Purpose:** op 20 — Approvals summary (`XXHMC_SND_APPROVE_SUMRY_V` + `XXHMC_SND_PNDNG_QID_V`).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `enum` (required). The views are keyed by USERNAME (`AIBRAHIM39`); the employee-number form returns empty.\n\n' + VERIFIED);
setExamples('Approvals', 'GET /approvals', [
  example('approvals|Summary keyed by username AIBRAHIM39', 'Success (200) — empty for this user'),
  example('approvals|Validation Error (400) — summary missing enum', 'Validation Error (400) — enum required'),
]);

setUrl('Approvals', 'GET /approvals/my-requests', '/approvals/my-requests?enum=AIBRAHIM39&lang=en');
setDescription('Approvals', 'GET /approvals/my-requests',
  '**Purpose:** op 23 — My requests (`XXHMC_SND_MY_REQEST_SUMMARY_V` + `XXHMC_SND_PNDNG_QID_V`).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `enum` (required, username form).\n\n' + VERIFIED);
setExamples('Approvals', 'GET /approvals/my-requests', [
  example('approvals|My-requests keyed by username AIBRAHIM39', 'Success (200) — empty for this user'),
]);

setUrl('Approvals', 'GET /approvals/worklist', '/approvals/worklist?enum=AIBRAHIM39&lang=en');
setDescription('Approvals', 'GET /approvals/worklist',
  '**Purpose:** op 68 — Worklist main (`XXHMC_SND_WORKLISTS_V` filtered by workflow recipient/more-info role, as published in the Sanaad mapping).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `enum` (required). The workflow role is the USERNAME — `enum=AIBRAHIM39` returns the real worklist (44 rows), while the employee-number form returns empty. NOTE: on a cold Oracle cache the first call can exceed the 25 s call timeout (observed once → HTTP 500); warm calls take ~1.5 s.\n\n' + VERIFIED);
setExamples('Approvals', 'GET /approvals/worklist', [
  example('approvals|Worklist keyed by username AIBRAHIM39', 'Success (200) — real worklist rows (username key)'),
  example('approvals|Success (200) — worklist', 'Success (200) — empty (employee-number key)'),
]);

setUrl('Approvals', 'GET /approvals/worklist/summary', '/approvals/worklist/summary?enum=AIBRAHIM39&lang=en&notificationId=123859197');
setDescription('Approvals', 'GET /approvals/worklist/summary',
  '**Purpose:** op 69 — Worklist summary (`XXHMC_SND_WORKLISTS_V`), optionally scoped to one `notificationId`.\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `enum` (required, username form), `notificationId` (optional — omit to get the full worklist).\n\n' + VERIFIED);
setExamples('Approvals', 'GET /approvals/worklist/summary', [
  example('approvals|Worklist summary real notificationId', 'Success (200) — scoped to one real notification'),
  example('approvals|Success (200) — worklist summary (all)', 'Success (200) — unscoped (empty for employee-number key)'),
]);

setUrl('Approvals', 'GET /approvals/worklist/:id/history', '/approvals/worklist/:id/history?lang=en&itemType=HRSSA', { id: '18875965' });
setDescription('Approvals', 'GET /approvals/worklist/:id/history',
  '**Purpose:** op 70 — Action history (`XXHMC_SND_ACTION_HISTORY_V`, keyed by ITEM_TYPE + ITEM_KEY). `:id` is the workflow ITEM_KEY from the worklist rows; `itemType` defaults to `HRSSA`.\n\n' + AUTH_NOTE + '\n\n' + VERIFIED);
setExamples('Approvals', 'GET /approvals/worklist/:id/history', [
  example('approvals|History real item key (passport request)', 'Success (200) — real history (Submit → Pending)', { urlPath: '/approvals/worklist/:id/history?lang=en&itemType=HRSSA', pathVars: { id: '18875965' } }),
  example('approvals|History real item key (closed LOA)', 'Success (200) — real history (Submit → Approve)', { urlPath: '/approvals/worklist/:id/history?lang=en&itemType=HRSSA', pathVars: { id: '18875905' } }),
  example('approvals|History unknown key (real empty)', 'Success (200) — unknown item key returns empty result', { urlPath: '/approvals/worklist/:id/history?lang=en&itemType=HRSSA', pathVars: { id: '99001' } }),
]);

setUrl('Approvals', 'GET /approvals/:id/details', '/approvals/:id/details?lang=en', { id: '123859197' });
setDescription('Approvals', 'GET /approvals/:id/details',
  '**Purpose:** op 21 — Approval detail (`XXHMC_SND_NOTYFY_APPR_V`, keyed by NOTIFICATION_ID). `:id` is the notification id from summary/worklist rows.\n\n' + AUTH_NOTE +
  '\n\n**Observed (2026-08-23):** the view returned no rows for FYI and closed notifications of the dev user — it appears to contain only OPEN actionable approvals for the recipient, and none existed during testing.\n\n' + VERIFIED);
setExamples('Approvals', 'GET /approvals/:id/details', [
  example('approvals|Details real notification (FYI passport)', 'Success (200) — empty (FYI notification not in the approval view)', { urlPath: '/approvals/:id/details?lang=en', pathVars: { id: '123859197' } }),
  example('approvals|Details unknown id (real empty)', 'Success (200) — empty for unknown id', { urlPath: '/approvals/:id/details?lang=en', pathVars: { id: '99001' } }),
]);

setUrl('Approvals', 'POST /approvals/:id/decision', '/approvals/:id/decision?lang=en', { id: '123859121' });
setBody('Approvals', 'POST /approvals/:id/decision', {
  decision: 'APPROVE',
  itemKey: '18875905',
  itemType: 'HRSSA',
  comment: 'Approved.',
});
setDescription('Approvals', 'POST /approvals/:id/decision',
  '**Purpose:** op 22 — Approve/Reject (`XXHMC_SND_APPROVE_REJECT_PR`). `:id` is the notification id; the body carries the workflow `itemKey`.\n\n' + AUTH_NOTE +
  '\n\n**Body (ApproveRejectRequestDto):** `decision` (APPROVE|REJECT), `itemKey` (required), `itemType?` (default HRSSA), `comment?`.\n\n' +
  '**Note (2026-08-23):** no OPEN actionable APPROVAL notification existed for the dev user (FYI notifications reject APPROVE, and the only actionable one was already CLOSED), so the real examples cover the closed notification, an own OPEN FYI, and unknown ids (all `successflag N`). A success example needs a live pending approval assigned to the caller — e.g. a test user whose supervisor is AIBRAHIM39 submitting a leave request.\n\n' + VERIFIED);
setExamples('Approvals', 'POST /approvals/:id/decision', [
  expectedExample({
    name: 'Expected Success (200) — built from code; needs an OPEN approval assigned to the caller (NOT a captured response)',
    method: 'POST',
    urlPath: '/approvals/:id/decision?lang=en',
    pathVars: { id: '123859121' },
    requestBody: { decision: 'APPROVE', itemKey: '18875905', itemType: 'HRSSA', comment: 'Approved.' },
    responseBody: EXPECTED_SUBMIT_SUCCESS,
  }),
  example('approvals|Decision on closed notification (real business error)', 'Business Error (200, successflag=N) — notification already closed', { urlPath: '/approvals/:id/decision?lang=en', pathVars: { id: '123859121' } }),
  example('approvals|Decision APPROVE own stale FYI', 'Business Error (200, successflag=N) — FYI notification cannot be approved', { urlPath: '/approvals/:id/decision?lang=en', pathVars: { id: '123857060' } }),
  example('approvals|Decision business error (unknown ids)', 'Business Error (200, successflag=N) — unknown notification/item key', { urlPath: '/approvals/:id/decision?lang=en', pathVars: { id: '99001' } }),
  example('approvals|Validation Error (400) — decision empty body', 'Validation Error (400) — decision/itemKey required', { urlPath: '/approvals/:id/decision', pathVars: { id: '99001' } }),
]);

setUrl('Approvals', 'POST /approvals/:id/reassign', '/approvals/:id/reassign?lang=en', { id: '123857058' });
setBody('Approvals', 'POST /approvals/:id/reassign', {
  assignTo: 'V-NFERNANDO',
  type: 'DELEGATE',
  comment: 'Reassigning while on leave.',
});
setDescription('Approvals', 'POST /approvals/:id/reassign',
  '**Purpose:** op 71 — Reassign (`XXHMC_SND_REASSIGN_PR`). `:id` is a notification id assigned to the caller (from the worklist).\n\n' + AUTH_NOTE +
  '\n\n**Body (ReassignApprovalRequestDto):** `assignTo` (required — USERNAME, not employee number; the old collection example `037915` was the number form), `type?` (DELEGATE|TRANSFER, default DELEGATE), `comment?`.\n\n' +
  '**Verified success (2026-08-23):** DELEGATE of an OPEN notification owned by the caller (123857058) to `V-NFERNANDO` returned `successflag S`.\n\n' + VERIFIED);
setExamples('Approvals', 'POST /approvals/:id/reassign', [
  example('approvals|Reassign own stale FYI to V-NFERNANDO', 'Success (200, successflag=S) — DELEGATE of an own open notification', { urlPath: '/approvals/:id/reassign?lang=en', pathVars: { id: '123857058' } }),
  example('approvals|Reassign business error (unknown ids)', 'Business Error (200, successflag=N) — unknown notification id', { urlPath: '/approvals/:id/reassign?lang=en', pathVars: { id: '99001' } }),
  example('approvals|Validation Error (400) — reassign empty body', 'Validation Error (400) — assignTo required', { urlPath: '/approvals/:id/reassign', pathVars: { id: '99001' } }),
]);

// ---- add the missing POST /approvals/:id/request-info ----
{
  const approvalsFolder = folder('Approvals');
  const existingIdx = approvalsFolder.item.findIndex((i) => i.name === 'POST /approvals/:id/request-info');
  if (existingIdx >= 0) approvalsFolder.item.splice(existingIdx, 1);
  const decisionIdx = approvalsFolder.item.findIndex((i) => i.name === 'POST /approvals/:id/decision');
  const requestInfoItem = {
    name: 'POST /approvals/:id/request-info',
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            'pm.test("Response is valid JSON", function () {',
            '    pm.response.to.be.json;',
            '});',
          ],
        },
      },
    ],
    request: {
      method: 'POST',
      header: [{ key: 'Content-Type', value: 'application/json' }],
      url: pmUrl('/approvals/:id/request-info?lang=en', { id: '123859197' }),
      body: rawBody({
        itemKey: '18875965',
        itemType: 'HRSSA',
        mode: 'QUESTION',
        toUsername: 'V-NFERNANDO',
        comment: 'Please attach the supporting documents.',
      }),
      description:
        '**Purpose:** RFMI — Request more information (`XXHMC_SND_HR_RFMI_PR`, companion of the op 26 RFMI user LOV). `:id` is the notification id; this request was missing from the collection.\n\n' + AUTH_NOTE +
        '\n\n**Body (RequestInfoRequestDto):** `itemKey` (required), `comment` (required), `itemType?` (default HRSSA), `mode?` (default QUESTION; e.g. ANSWER to respond), `toUsername?` (see op 26 LOV `GET /lookups/rfmi-user`).\n\n' +
        '**Response:** action envelope.\n\n' +
        '**Verified success (2026-08-23):** QUESTION on an open item owned by the caller (notification 123859197 / itemKey 18875965) addressed to `V-NFERNANDO` returned `successflag S`.\n\n' + VERIFIED,
    },
    response: [],
  };
  approvalsFolder.item.splice(decisionIdx + 1, 0, requestInfoItem);
}
setExamples('Approvals', 'POST /approvals/:id/request-info', [
  example('approvals|Request-info QUESTION on own open passport item', 'Success (200, successflag=S) — QUESTION sent on an own open item', { urlPath: '/approvals/:id/request-info?lang=en', pathVars: { id: '123859197' } }),
  example('approvals|Request-info business error (unknown ids)', 'Business Error (200, successflag=N) — unknown notification/item key', { urlPath: '/approvals/:id/request-info?lang=en', pathVars: { id: '99001' } }),
  example('approvals|Request-info validation error (400)', 'Validation Error (400) — itemKey/comment required', { urlPath: '/approvals/:id/request-info', pathVars: { id: '99001' } }),
]);

// =====================================================================
// APPOINTMENTS
// =====================================================================
const CERNER_NOTE =
  '\n\n**Staging status (verified 2026-08-23):** every appointments endpoint returns HTTP 503 — `CERNER_BASE_URL` is not configured on staging, so `CernerClient` refuses the call. This is environment configuration, not application code (see AGENTS.md). Set `CERNER_BASE_URL` (and optionally `CERNER_TIMEOUT_MS`) to enable.';

setDescription('Appointments', 'GET /appointments/upcoming',
  '**Purpose:** op 41 — Upcoming staff-clinic appointments (Cerner).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `enum` (required).' + CERNER_NOTE + '\n\n' + VERIFIED);
setExamples('Appointments', 'GET /appointments/upcoming', [
  expectedExample({
    name: 'Expected Success (200) — read envelope per code; Cerner payload passes through (NOT a captured response)',
    method: 'GET',
    urlPath: '/appointments/upcoming?enum=053613&lang=en',
    responseBody: {
      result: [
        {
          appointmentId: 'APT-0001',
          clinicId: 'CLINIC-001',
          clinicName: 'Staff Clinic',
          locationId: 'LOC-001',
          locationName: 'Hamad General Hospital',
          serviceId: 'SVC-001',
          serviceName: 'General Consultation',
          slot: '2026-09-01T09:30:00',
          status: 'BOOKED',
        },
      ],
      opstatus: 0,
      status: 'success',
      httpStatusCode: 200,
    },
  }),
  example('appointments|Upcoming — real staging behaviour', 'Service Unavailable (503) — Cerner not configured on staging'),
  example('appointments|Validation Error (400) — upcoming missing enum', 'Validation Error (400) — enum required'),
]);

setDescription('Appointments', 'GET /appointments/masters',
  '**Purpose:** op 42 — Clinic master details (Cerner).\n\n' + AUTH_NOTE + '\n\n**Query:** `lang`.' + CERNER_NOTE + '\n\n' + VERIFIED);
setExamples('Appointments', 'GET /appointments/masters', [
  expectedExample({
    name: 'Expected Success (200) — read envelope per code: { clinics, locations, services } (NOT a captured response)',
    method: 'GET',
    urlPath: '/appointments/masters?lang=en',
    responseBody: {
      result: {
        clinics: [{ clinicId: 'CLINIC-001', clinicName: 'Staff Clinic' }],
        locations: [{ locationId: 'LOC-001', locationName: 'Hamad General Hospital' }],
        services: [{ serviceId: 'SVC-001', serviceName: 'General Consultation' }],
      },
      opstatus: 0,
      status: 'success',
      httpStatusCode: 200,
    },
  }),
  example('appointments|Masters — real staging behaviour', 'Service Unavailable (503) — Cerner not configured on staging'),
]);

setDescription('Appointments', 'GET /appointments/booking-init',
  '**Purpose:** op 43 — Booking screen init (masters + upcoming aggregated).\n\n' + AUTH_NOTE +
  '\n\n**Query:** `lang`, `enum` (required).' + CERNER_NOTE + '\n\n' + VERIFIED);
setExamples('Appointments', 'GET /appointments/booking-init', [
  expectedExample({
    name: 'Expected Success (200) — read envelope per code: { masters, upcoming } aggregated (NOT a captured response)',
    method: 'GET',
    urlPath: '/appointments/booking-init?enum=053613&lang=en',
    responseBody: {
      result: {
        masters: {
          clinics: [{ clinicId: 'CLINIC-001', clinicName: 'Staff Clinic' }],
          locations: [{ locationId: 'LOC-001', locationName: 'Hamad General Hospital' }],
          services: [{ serviceId: 'SVC-001', serviceName: 'General Consultation' }],
        },
        upcoming: [
          {
            appointmentId: 'APT-0001',
            clinicId: 'CLINIC-001',
            slot: '2026-09-01T09:30:00',
            status: 'BOOKED',
          },
        ],
      },
      opstatus: 0,
      status: 'success',
      httpStatusCode: 200,
    },
  }),
  example('appointments|Booking init — real staging behaviour', 'Service Unavailable (503) — Cerner not configured on staging'),
]);

setBody('Appointments', 'POST /appointments/book', {
  clinicId: 'CLINIC-001',
  locationId: 'LOC-001',
  serviceId: 'SVC-001',
  slot: '2026-09-01T09:30:00',
});
setUrl('Appointments', 'POST /appointments/book', '/appointments/book?lang=en');
setDescription('Appointments', 'POST /appointments/book',
  '**Purpose:** op 44 — Book appointment (Cerner; validate + create).\n\n' + AUTH_NOTE +
  '\n\n**Body (BookAppointmentRequestDto):** `clinicId` (required), `locationId` (required), `slot` (required, ISO date-time — the old collection body was missing it), `serviceId?`.' + CERNER_NOTE + '\n\n' + VERIFIED);
setExamples('Appointments', 'POST /appointments/book', [
  expectedExample({
    name: 'Expected Success (200) — action envelope per code (successResult of the Cerner ACL) (NOT a captured response)',
    method: 'POST',
    urlPath: '/appointments/book?lang=en',
    requestBody: { clinicId: 'CLINIC-001', locationId: 'LOC-001', serviceId: 'SVC-001', slot: '2026-09-01T09:30:00' },
    responseBody: { status: 'success', successflag: 'S', message: 'Appointment booked.', httpStatusCode: 200 },
  }),
  example('appointments|Book — real staging behaviour (503)', 'Service Unavailable (503) — Cerner not configured on staging'),
  example('appointments|Validation Error (400) — empty body', 'Validation Error (400) — clinicId/locationId/slot required'),
]);

// ---------- write ----------
fs.writeFileSync(COLLECTION, JSON.stringify(collection, null, 2) + '\n');
console.log('Collection updated OK.');
const check = JSON.parse(fs.readFileSync(COLLECTION, 'utf8'));
console.log('Re-parse OK. Folders:', check.item.length);
