/*
 * Builds a STANDALONE Postman collection directly from the real captured
 * calls in api_test_work.json (success) and api_test.json (failure/fix) at
 * the repo root — independent of postman/HMC_Sanaad_B2E.postman_collection.json.
 * Each unique endpoint becomes one request with saved example responses
 * (success + failure, when available).
 *
 * Run with: node postman/build-collection-from-tests.js
 * Output:   postman/api-test-results.postman_collection.json
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const successPath = path.join(repoRoot, 'api_test_work.json');
const failurePath = path.join(repoRoot, 'api_test.json');
const outPath = path.join(__dirname, 'api-test-results.postman_collection.json');

/** Same tolerant sanitizer as attach-examples.js: fold raw newlines found
 * inside strings, then drop the "sql"/"orcalError" debug fields whose values
 * embed unescaped JSON/SQL fragments (not needed here anyway). */
function sanitizeJson(raw) {
  let folded = '';
  let inString = false;
  let escaped = false;
  for (const ch of raw) {
    if (inString && !escaped && (ch === '\n' || ch === '\r')) {
      folded += ch === '\n' ? '\\n' : '\\r';
      continue;
    }
    folded += ch;
    if (escaped) escaped = false;
    else if (ch === '\\') escaped = true;
    else if (ch === '"') inString = !inString;
  }
  return folded
    .split('\n')
    .filter((line) => !/^\s*"(sql|orcalError)"\s*:/.test(line))
    .join('\n')
    .replace(/,(\s*[}\]])/g, '$1');
}

const successCases = JSON.parse(sanitizeJson(fs.readFileSync(successPath, 'utf8')));
const failureCases = JSON.parse(sanitizeJson(fs.readFileSync(failurePath, 'utf8')));

/** Endpoints that are POST in the real API (everything else here is GET). */
const POST_PATHS = new Set([
  'profile/personal',
  'employee/supervisor',
  'identity/qid/update',
  'identity/idcard/apply',
  'letters/apply',
  'leave/apply',
  'leave/calculate',
  'leave/amend',
  'leave/cancel',
  'leave/return',
]);

function parseApi(raw) {
  const [pathPart, query] = String(raw).split('?');
  const cleanPath = pathPart
    .replace(/^\/+/, '')
    .replace(/^api\/v1\//i, '')
    .replace(/\/+$/, '');
  const params = [];
  if (query) {
    for (const pair of query.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      params.push({ key: decodeURIComponent(k), value: decodeURIComponent(v) });
    }
  }
  return { key: cleanPath.toLowerCase(), cleanPath, params };
}

function isRealSuccess(c) {
  const r = c.response;
  if (!r) return false;
  if (r.status === 'error' || r.success === false) return false;
  if (r.path && parseApi(r.path).key !== parseApi(c.api).key) return false;
  return true;
}

/** Merge all cases (success + failure) for the same endpoint into one entry. */
const endpoints = new Map();

function addCase(c, kind) {
  if (!c || !c.api || !c.response) return;
  const { key, cleanPath, params } = parseApi(c.api);
  if (!endpoints.has(key)) {
    endpoints.set(key, { cleanPath, params, method: POST_PATHS.has(key) ? 'POST' : 'GET', successes: [], failures: [] });
  }
  const entry = endpoints.get(key);
  // Prefer the case with the richest query params for the canonical request URL.
  if (params.length > entry.params.length) entry.params = params;
  if (kind === 'success') entry.successes.push(c);
  else entry.failures.push(c);
}

for (const c of successCases) {
  if (isRealSuccess(c)) addCase(c, 'success');
}
for (const c of failureCases) {
  addCase(c, 'failure');
}

function folderNameFor(cleanPath) {
  const seg = cleanPath.split('/')[0] || 'misc';
  return seg;
}

function requestNameFor(cleanPath, method) {
  return `${method} /${cleanPath}`;
}

function toPostmanUrl(cleanPath, params) {
  const pathParts = cleanPath.split('/').filter(Boolean);
  const query = params.map((p) => ({ key: p.key, value: p.value }));
  const rawQuery = query.length ? '?' + query.map((q) => `${q.key}=${encodeURIComponent(q.value)}`).join('&') : '';
  return {
    raw: `{{baseUrl}}/${pathParts.join('/')}${rawQuery}`,
    host: ['{{baseUrl}}'],
    path: pathParts,
    query: query.length ? query : undefined,
  };
}

function toResponseEntry(name, code, request, body) {
  return {
    name,
    originalRequest: request,
    status: code >= 200 && code < 300 ? 'OK' : code >= 500 ? 'Internal Server Error' : 'Error',
    code,
    _postman_previewlanguage: 'json',
    header: [{ key: 'Content-Type', value: 'application/json' }],
    body: JSON.stringify(body, null, 2),
  };
}

const folders = new Map();

for (const [, entry] of [...endpoints].sort((a, b) => a[0].localeCompare(b[0]))) {
  const { cleanPath, params, method, successes, failures } = entry;
  const url = toPostmanUrl(cleanPath, params);
  const request = {
    method,
    header: method === 'POST' ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    url,
    ...(method === 'POST'
      ? { body: { mode: 'raw', raw: '{}', options: { raw: { language: 'json' } } } }
      : {}),
  };

  const responses = [];
  for (const c of successes) {
    const code = c.response.httpStatusCode || 200;
    responses.push(toResponseEntry(`Success — ${c.api}`, code, request, c.response));
  }
  for (const c of failures) {
    const code = c.response.httpStatusCode || 500;
    const label = c.fix ? `Failure (fix: ${c.fix})` : 'Failure';
    responses.push(toResponseEntry(`${label} — ${c.api}`, code, request, c.response));
  }
  if (!responses.length) continue;

  const item = {
    name: requestNameFor(cleanPath, method),
    request,
    response: responses,
  };

  const folder = folderNameFor(cleanPath);
  if (!folders.has(folder)) folders.set(folder, []);
  folders.get(folder).push(item);
}

const collection = {
  info: {
    name: 'HMC Sanaad — Captured API Test Results',
    _postman_id: 'hmc-sanaad-api-test-results-0001',
    description:
      'Standalone collection built directly from api_test_work.json (success) and ' +
      'api_test.json (failure/fix) at the repo root. Each request carries the real ' +
      'captured response(s) as saved examples — success and/or failure — rather ' +
      'than being executed live. Regenerate with postman/build-collection-from-tests.js ' +
      'whenever those test files change.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:443/api/v1', type: 'string' },
    { key: 'token', value: '', type: 'string' },
  ],
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{token}}', type: 'string' }],
  },
  item: [...folders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({ name, item: items })),
};

fs.writeFileSync(outPath, JSON.stringify(collection, null, 2) + '\n');

const totalRequests = [...folders.values()].reduce((n, items) => n + items.length, 0);
const totalSuccess = [...endpoints.values()].reduce((n, e) => n + e.successes.length, 0);
const totalFailure = [...endpoints.values()].reduce((n, e) => n + e.failures.length, 0);
console.log(`wrote ${outPath}`);
console.log(`folders: ${folders.size}, requests: ${totalRequests}`);
console.log(`success examples: ${totalSuccess}, failure examples: ${totalFailure}`);
