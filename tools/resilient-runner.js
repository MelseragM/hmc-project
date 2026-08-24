/**
 * Resilient variant of api-test-runner: survives VPN/DNS flapping.
 * - Waits for a connectivity window (GET /health == 200) before each case
 * - Saves results incrementally; re-run resumes unfinished cases
 * Usage: node resilient-runner.js <cases.json> <results.json> [maxMinutes]
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');

const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function healthy() {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(8000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function waitForNetwork(deadline) {
  let waited = false;
  while (Date.now() < deadline) {
    if (await healthy()) {
      if (waited) console.log(`[net] back online at ${new Date().toISOString()}`);
      return true;
    }
    if (!waited) console.log(`[net] offline, waiting for a connectivity window...`);
    waited = true;
    await sleep(10000);
  }
  return false;
}

let token = null;
let tokenAt = 0;
async function getToken() {
  if (token && Date.now() - tokenAt < 45 * 60 * 1000) return token;
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'AIBRAHIM39',
      mpin: '123456',
      imeinumber: 'devin-postman-verify-001',
      platform: 'android',
      version: '1.0.0',
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json();
  if (!body.token) throw new Error('login failed: ' + JSON.stringify(body));
  token = body.token;
  tokenAt = Date.now();
  return token;
}

async function runCase(c) {
  const headers = {};
  if (c.auth !== 'none') headers['Authorization'] = `Bearer ${c.auth === 'invalid' ? 'invalid.token.value' : await getToken()}`;
  if (c.body !== undefined) headers['Content-Type'] = 'application/json';
  const started = Date.now();
  const res = await fetch(`${BASE}${c.path}`, {
    method: c.method,
    headers,
    body: c.body !== undefined ? JSON.stringify(c.body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* raw */ }
  return {
    ...c,
    httpStatus: res.status,
    statusText: res.statusText,
    contentType: res.headers.get('content-type'),
    responseBody: parsed ?? text,
    durationMs: Date.now() - started,
  };
}

(async () => {
  const [casesFile, outFile, maxMinutes] = process.argv.slice(2);
  const deadline = Date.now() + Number(maxMinutes || 60) * 60 * 1000;
  const cases = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
  let results = [];
  if (fs.existsSync(outFile)) {
    try { results = JSON.parse(fs.readFileSync(outFile, 'utf8')).filter((r) => r.httpStatus !== undefined); } catch { results = []; }
  }
  const done = new Set(results.map((r) => `${r.module}|${r.name}`));

  const INTER_CASE_DELAY = Number(process.env.CASE_DELAY_MS || 0);
  for (const c of cases) {
    if (INTER_CASE_DELAY) await sleep(INTER_CASE_DELAY);
    const key = `${c.module}|${c.name}`;
    if (done.has(key)) { console.log(`skip (done): ${key}`); continue; }
    let attempts = 0;
    for (;;) {
      if (!(await waitForNetwork(deadline))) {
        console.log('DEADLINE reached while offline — stopping.');
        fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
        process.exit(2);
      }
      try {
        const r = await runCase(c);
        results.push(r);
        fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
        console.log(`${String(r.httpStatus).padEnd(4)} ${c.method.padEnd(5)} ${c.path}  [${c.name}] ${r.durationMs}ms`);
        break;
      } catch (e) {
        attempts++;
        console.log(`retry ${attempts} after error on ${key}: ${String(e).slice(0, 120)}`);
        if (attempts >= 6) {
          results.push({ ...c, error: String(e) });
          fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
          break;
        }
        await sleep(5000);
      }
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nDone. ${results.length} results -> ${outFile}`);
})();
