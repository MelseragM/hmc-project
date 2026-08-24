/**
 * Run console statements defined in a JS file, using BIND VARIABLES so the SQL
 * text carries no quoted literals — the F5 WAF in front of staging rejects any
 * request body that looks like quoted SQL.
 *   node q2.js <cases.js>   // module exports an array of { sql, binds?, maxRows? }
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
      try { return JSON.parse(t); } catch { return { waf: /Request Rejected/.test(t), raw: t.slice(0, 160) }; }
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
  if (r.ok === undefined) return console.log('   REJECTED ' + JSON.stringify(r).slice(0, 200));
  const rows = r.rows || [];
  if (!rows.length) return console.log('   (0 rows, ' + r.elapsedMs + 'ms)');
  const cols = r.columns?.length ? r.columns : Object.keys(rows[0]);
  console.log('   ' + cols.join(' | '));
  for (const row of rows) console.log('   ' + cols.map((c) => String(row[c] ?? '')).join(' | '));
  console.log(`   (${rows.length} row(s)${r.truncated ? '+' : ''}, ${r.elapsedMs}ms)`);
}

(async () => {
  const cases = require(path.resolve(process.argv[2]));
  for (const c of cases) {
    show(c.label || c.sql.replace(/\s+/g, ' ').slice(0, 120), await post('/execute', {
      sql: c.sql,
      binds: c.binds || {},
      maxRows: c.maxRows || 200,
    }));
  }
})();
