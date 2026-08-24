/**
 * Cross-check the three places a request body is documented so a reader can
 * copy any of them and have it work on staging:
 *   1. Swagger  (tools/swagger.json — dumped from the built app)
 *   2. Postman  (HMC_BackEnd/postman/HMC-Sanaad-Full.postman_collection.json)
 *   3. VERIFIED (this file — the payloads that actually returned successflag S,
 *      or, where the endpoint is still blocked, the payload we know is correct)
 *
 * Reports every field where Swagger or Postman disagrees with VERIFIED.
 */
const fs = require('fs');

const swagger = JSON.parse(fs.readFileSync(`${__dirname}/swagger.json`, 'utf8'));
const collection = JSON.parse(
  fs.readFileSync(`${__dirname}/../HMC_BackEnd/postman/HMC-Sanaad-Full.postman_collection.json`, 'utf8'),
);

/** Field values proven against staging (2026-08-23/24). */
const VERIFIED = {
  'POST /school-fees/apply': {
    p_child_name: 'Jerome Amir Sami Samir Ibrahim||Male||23-SEP-10',
    p_spouse_working: 'No',
    p_request_type: 'Cash',
    p_term: 'Term1',
    p_school_name: 'Al Arqam Academy',
    p_educational_stage: 'Primary',
    p_acd_st_dt: '20250901',
  },
  'POST /dependents/update': {
    p_dependent_id: '329302',
    p_relation_ship: 'Child',
    p_type_of_sponsership: 'Employee',
    p_passport_number: 'A38697134',
    p_visa_type: 'Residence Permit',
    p_visa_validy: 'Yes',
  },
  'POST /dependents/delete': { p_dependent_id: '1607679', p_relationship: 'C' },
  'POST /dependents': { p_relationship: 'Child', p_visa_type: 'Residence Permit', p_visa_validity: 'Yes' },
  'POST /contact/phone': { phoneId: '310129', phoneType: 'Qatar Mobile Number', phoneNumber: '55723893' },
  'POST /contact/address': { p_country: 'Qatar' },
  'POST /contact/address/update': { p_country: 'Qatar' },
  'POST /letters/apply': {
    p_letter_language: 'English',
    p_letter_name: 'Bank letter with details with effective date',
    p_country: undefined, // must NOT be part of the happy-path example
  },
  'POST /leave/amend': { p_leave_to_amend: 'Annual Leave|12-MAR-2026|12-MAR-2026' },
  'POST /leave/cancel': { p_leave_to_cancel: 'Annual Leave|12-MAR-2026|12-MAR-2026' },
  'POST /leave/return': { p_leave_details: 'Casual Leave|19-APR-2026|19-APR-2026' },
  'POST /annual-ticket/apply': { p_employee: '26023', p_contractual_year: '01-SEP-2025 to 31-AUG-2026' },
  'POST /employee/supervisor': { p_new_supervisor: '112' },
};

// ── Swagger side ────────────────────────────────────────────
const PREFIX = /^\/api\/v1/;
function swaggerBodies() {
  const out = {};
  for (const [path, ops] of Object.entries(swagger.paths || {})) {
    for (const [method, op] of Object.entries(ops)) {
      const content = op.requestBody?.content?.['application/json'];
      if (!content) continue;
      const key = `${method.toUpperCase()} ${path.replace(PREFIX, '')}`;
      out[key] = resolveExample(content);
    }
  }
  return out;
}

/** Prefer an explicit example; otherwise collect per-property `example` values. */
function resolveExample(content) {
  if (content.example) return content.example;
  if (content.examples) {
    const first = Object.values(content.examples)[0];
    if (first?.value) return first.value;
  }
  let schema = content.schema;
  if (schema?.$ref) schema = deref(schema.$ref);
  if (schema?.example) return schema.example;
  if (schema?.properties) {
    const obj = {};
    for (const [prop, def] of Object.entries(schema.properties)) {
      let d = def;
      if (d.$ref) d = deref(d.$ref);
      if (d.example !== undefined) obj[prop] = d.example;
      else if (d.type === 'array' && d.items) {
        let item = d.items.$ref ? deref(d.items.$ref) : d.items;
        if (item?.properties) {
          const inner = {};
          for (const [p2, d2] of Object.entries(item.properties)) {
            if (d2.example !== undefined) inner[p2] = d2.example;
          }
          if (Object.keys(inner).length) obj[prop] = [inner];
        }
      }
    }
    return obj;
  }
  return {};
}
function deref(ref) {
  const name = ref.split('/').pop();
  return swagger.components?.schemas?.[name];
}

// ── Postman side ────────────────────────────────────────────
function postmanBodies(items, folder = '', out = {}) {
  for (const item of items) {
    if (item.item) {
      postmanBodies(item.item, item.name, out);
      continue;
    }
    const raw = item.request?.body?.raw;
    if (!raw || !item.request?.method) continue;
    const url = item.request.url?.raw || '';
    const path = '/' + (url.split('{{baseUrl}}/')[1] || url).split('?')[0].replace(/^\/+/, '');
    const key = `${item.request.method} ${path}`;
    try {
      out[key] = { body: JSON.parse(raw), folder, name: item.name };
    } catch {
      out[key] = { body: null, folder, name: item.name };
    }
  }
  return out;
}

// ── Compare ─────────────────────────────────────────────────
const sw = swaggerBodies();
const pm = postmanBodies(collection.item || []);

// Postman paths carry the api prefix in the URL; normalise both sides.
const norm = (k) => k.replace(/\/api\/v1/, '').replace(/\/+$/, '');
const swN = Object.fromEntries(Object.entries(sw).map(([k, v]) => [norm(k), v]));
const pmN = Object.fromEntries(Object.entries(pm).map(([k, v]) => [norm(k), v]));

function get(body, field) {
  if (!body) return undefined;
  if (field in body) return body[field];
  // phones[] items
  if (Array.isArray(body.phones) && body.phones[0] && field in body.phones[0]) {
    return body.phones[0][field];
  }
  return undefined;
}

let problems = 0;
console.log('=== Example audit: Swagger + Postman vs verified payloads ===\n');
for (const [endpoint, fields] of Object.entries(VERIFIED)) {
  const key = norm(endpoint);
  const s = swN[key];
  const p = pmN[key]?.body;
  if (!s) console.log(`! ${endpoint}: not found in Swagger`), problems++;
  if (!p) console.log(`! ${endpoint}: not found in Postman`), problems++;
  for (const [field, expected] of Object.entries(fields)) {
    const sv = get(s, field);
    const pv = get(p, field);
    if (expected === undefined) {
      // Field must be ABSENT from the happy-path example.
      if (sv !== undefined) console.log(`SWAGGER  ${endpoint}: ${field} should be absent, found "${sv}"`), problems++;
      if (pv !== undefined) console.log(`POSTMAN  ${endpoint}: ${field} should be absent, found "${pv}"`), problems++;
      continue;
    }
    if (sv !== expected) console.log(`SWAGGER  ${endpoint}: ${field} = ${JSON.stringify(sv)} (want ${JSON.stringify(expected)})`), problems++;
    if (pv !== expected) console.log(`POSTMAN  ${endpoint}: ${field} = ${JSON.stringify(pv)} (want ${JSON.stringify(expected)})`), problems++;
  }
}
console.log(problems ? `\n${problems} mismatch(es).` : '\nAll verified fields match in both Swagger and Postman.');
