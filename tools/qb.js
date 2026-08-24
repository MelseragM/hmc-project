/**
 * Run console statements as base64 (`sqlB64`) so the staging WAF cannot reject
 * them: node qb.js <cases.js>  where the module exports [{ label, sql, binds? }]
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1/dev-console';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(p, payload, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + p, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000),
      });
      const t = await res.text();
      try { return JSON.parse(t); } catch { return { waf: /Request Rejected/.test(t), raw: t.slice(0, 150) }; }
    } catch (e) {
      if (i === tries - 1) return { netError: String(e) };
      await sleep(5000);
    }
  }
}

function show(label, r) {
  console.log('\n>>> ' + label);
  if (!r) return console.log('   (no response)');
  if (r.waf) return console.log('   [WAF BLOCKED]');
  if (r.netError) return console.log('   ' + r.netError);
  if (r.ok === false && r.error) {
    console.log('   ERROR ORA-' + (r.error.oraCode || '?') + ': ' + r.error.message.split('\n').slice(0, 2).join(' | '));
    if (r.error.stack?.length) console.log('   at ' + r.error.stack.map((s) => `${s.unit}:${s.line}`).join(', '));
    return;
  }
  if (r.ok === undefined) return console.log('   REJECTED ' + JSON.stringify(r).slice(0, 220));
  if (r.outBinds && Object.keys(r.outBinds).length) console.log('   OUT: ' + JSON.stringify(r.outBinds).slice(0, 600));
  const rows = r.rows || [];
  if (!rows.length && !r.outBinds) return console.log('   (0 rows, ' + r.elapsedMs + 'ms)');
  const cols = r.columns?.length ? r.columns : (rows[0] ? Object.keys(rows[0]) : []);
  if (cols.length) console.log('   ' + cols.join(' | '));
  for (const row of rows) console.log('   ' + cols.map((c) => String(row[c] ?? '')).join(' | '));
  if (rows.length) console.log(`   (${rows.length} row(s)${r.truncated ? '+' : ''}, ${r.elapsedMs}ms)`);
}

(async () => {
  const cases = require(path.resolve(process.argv[2]));
  for (const c of cases) {
    show(c.label, await post('/execute', {
      sqlB64: Buffer.from(c.sql, 'utf8').toString('base64'),
      binds: c.binds || {},
      maxRows: c.maxRows || 200,
    }));
  }
})();
