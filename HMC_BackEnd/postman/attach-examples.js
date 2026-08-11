/*
 * One-off script: attaches saved example responses (success + error) to the
 * existing Postman collection's requests, sourced from real captured calls in
 * api_test_work.json (success) and api_test.json (failure/fix) at the repo
 * root. Matches by normalized path (ignoring query string, method, and
 * leading /api/v1). Run with: node postman/attach-examples.js
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const collectionPath = path.join(__dirname, 'HMC_Sanaad_B2E.postman_collection.json');
const successPath = path.join(repoRoot, 'api_test_work.json');
const failurePath = path.join(repoRoot, 'api_test.json');

/** api_test.json has a few raw newlines inside string values (invalid strict
 * JSON, e.g. a multi-line orcalError). Escape any CR/LF found while inside a
 * (non-escaped) string so JSON.parse can read it. */
function sanitizeJson(raw) {
  // Pass 1: fold any raw CR/LF found while inside a string into `\n`/`\r`
  // escapes, so a field whose value spans multiple physical lines (e.g. a
  // multi-line orcalError) becomes one logical line.
  let folded = '';
  let inString = false;
  let escaped = false;
  for (const ch of raw) {
    if (inString && !escaped && (ch === '\n' || ch === '\r')) {
      folded += ch === '\n' ? '\\n' : '\\r';
      continue;
    }
    folded += ch;
    if (escaped) {
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    }
  }
  // Pass 2: "sql"/"orcalError"/"orcalResponse" debug fields embed raw,
  // unescaped JSON/SQL fragments (e.g. serialized oracledb bind objects)
  // making the line unparsable — and they're not needed for the Postman
  // examples anyway, so drop those whole (now single-line) fields outright.
  return folded
    .split('\n')
    .filter((line) => !/^\s*"(sql|orcalError)"\s*:/.test(line))
    .join('\n')
    // dropping a field can leave a dangling trailing comma before `}`/`]`
    .replace(/,(\s*[}\]])/g, '$1');
}

const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
const successCases = JSON.parse(sanitizeJson(fs.readFileSync(successPath, 'utf8')));
const failureCases = JSON.parse(sanitizeJson(fs.readFileSync(failurePath, 'utf8')));

function normalizePath(raw) {
  return String(raw)
    .split('?')[0]
    .replace(/^\/+/, '')
    .replace(/^api\/v1\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function indexByPath(cases, { requireSuccess = false } = {}) {
  const map = new Map();
  for (const c of cases) {
    if (!c || !c.api || !c.response) continue;
    // A couple of entries in api_test_work.json are mislabeled captures of a
    // failure (status: 'error'/success: false, or a path in the body that
    // doesn't match the case's own `api`) — skip those rather than document a
    // 404/error as a "success" example.
    if (requireSuccess) {
      if (c.response.status === 'error' || c.response.success === false) continue;
      if (c.response.path && normalizePath(c.response.path) !== normalizePath(c.api)) continue;
    }
    const key = normalizePath(c.api);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }
  return map;
}

const successByPath = indexByPath(successCases, { requireSuccess: true });
const failureByPath = indexByPath(failureCases);

function collectionPathFor(item) {
  const url = item.request && item.request.url;
  if (!url) return undefined;
  const parts = Array.isArray(url.path) ? url.path : [];
  return parts.join('/').toLowerCase();
}

function toResponseEntry(name, status, code, item, body) {
  return {
    name,
    originalRequest: item.request,
    status,
    code,
    _postman_previewlanguage: 'json',
    header: [{ key: 'Content-Type', value: 'application/json' }],
    body: JSON.stringify(body, null, 2),
  };
}

let attachedSuccess = 0;
let attachedFailure = 0;
let matched = 0;

function walk(items) {
  for (const item of items) {
    if (item.item) {
      walk(item.item);
      continue;
    }
    const key = collectionPathFor(item);
    if (key === undefined) continue;
    const successMatches = successByPath.get(key);
    const failureMatches = failureByPath.get(key);
    if (!successMatches && !failureMatches) continue;
    matched++;
    item.response = Array.isArray(item.response) ? item.response : [];
    if (successMatches) {
      for (const c of successMatches) {
        const code = (c.response && c.response.httpStatusCode) || 200;
        item.response.push(toResponseEntry(`Success — ${c.api}`, 'OK', code, item, c.response));
        attachedSuccess++;
      }
    }
    if (failureMatches) {
      for (const c of failureMatches) {
        const code = (c.response && c.response.httpStatusCode) || 500;
        const label = c.fix ? `Failure (fix: ${c.fix})` : 'Failure';
        item.response.push(
          toResponseEntry(`${label} — ${c.api}`, code >= 500 ? 'Internal Server Error' : 'Error', code, item, c.response),
        );
        attachedFailure++;
      }
    }
  }
}

walk(collection.item);

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2) + '\n');
console.log(`matched requests: ${matched}`);
console.log(`attached success examples: ${attachedSuccess}`);
console.log(`attached failure examples: ${attachedFailure}`);
