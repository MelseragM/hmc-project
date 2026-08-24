/** Run a SQL file through the staging dev console: node q.js <file.sql> [maxRows] */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1/dev-console';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, payload, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000),
      });
      const t = await res.text();
      try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(5000);
    }
  }
}

(async () => {
  const file = process.argv[2];
  const maxRows = Number(process.argv[3] || 200);
  const statements = fs
    .readFileSync(file, 'utf8')
    .split(/^\s*----+\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sql of statements) {
    console.log('\n>>> ' + sql.replace(/\s+/g, ' ').slice(0, 150));
    const r = await post('/execute', { sql, maxRows });
    if (!r) { console.log('(no response)'); continue; }
    if (r.ok === false && r.error) {
      console.log('ERROR ORA-' + (r.error.oraCode || '?') + ': ' + r.error.message.split('\n').slice(0, 3).join(' | '));
      if (r.error.stack?.length) console.log('   at ' + r.error.stack.map((s) => `${s.unit}:${s.line}`).join(', '));
      continue;
    }
    if (r.ok === undefined) { console.log('REJECTED: ' + JSON.stringify(r).slice(0, 300)); continue; }
    const rows = r.rows || [];
    if (!rows.length) { console.log('(0 rows, ' + r.elapsedMs + 'ms)'); continue; }
    const cols = r.columns?.length ? r.columns : Object.keys(rows[0]);
    console.log(cols.join(' | '));
    for (const row of rows) console.log(cols.map((c) => String(row[c] ?? '')).join(' | '));
    console.log(`(${rows.length} row(s)${r.truncated ? '+' : ''}, ${r.elapsedMs}ms)`);
  }
})();
