/**
 * Thin CLI over the deployed dev console (staging).
 *   node console.js sql "SELECT ..."
 *   node console.js src XXHMC_SND_PHONE_PKG 120     (source around a line)
 *   node console.js desc XXHMC_SND_PHONE_TYPE_V
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1/dev-console';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, opts = {}, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, {
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: opts.body,
        signal: AbortSignal.timeout(90000),
      });
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { raw: text.slice(0, 400), status: res.status }; }
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(6000);
    }
  }
}

const sql = (statement) => call('/execute', { method: 'POST', body: JSON.stringify({ sql: statement, maxRows: 500 }) });

function printResult(r) {
  if (!r) return console.log('(no response)');
  if (r.ok === false && r.error) {
    console.log('ERROR ORA-' + (r.error.oraCode || '?') + ': ' + r.error.message.split('\n')[0]);
    if (r.error.stack?.length) console.log('  at: ' + r.error.stack.map((s) => `${s.unit}:${s.line}`).join(' | '));
    return;
  }
  if (r.message) return console.log('REJECTED: ' + JSON.stringify(r.message));
  const rows = r.rows || [];
  if (!rows.length) return console.log('(0 rows)');
  const cols = r.columns?.length ? r.columns : Object.keys(rows[0]);
  console.log(cols.join(' | '));
  for (const row of rows) console.log(cols.map((c) => String(row[c] ?? '')).join(' | '));
  console.log(`(${rows.length} row(s)${r.truncated ? ', truncated' : ''}, ${r.elapsedMs}ms)`);
}

(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'sql') printResult(await sql(a));
  else if (cmd === 'src') {
    const r = await call(`/source?name=${encodeURIComponent(a)}${b ? `&line=${b}&around=${process.argv[5] || 25}` : ''}`);
    if (!r.lines) return console.log(JSON.stringify(r).slice(0, 400));
    console.log(`${r.object}: lines ${r.from}-${r.to} of ${r.total}`);
    for (const l of r.lines) console.log(String(l.LINE).padStart(5) + ' | ' + String(l.TEXT ?? '').replace(/\s+$/, ''));
  } else if (cmd === 'desc') {
    const r = await call(`/describe?name=${encodeURIComponent(a)}`);
    console.log(JSON.stringify(r, null, 1).slice(0, 4000));
  } else console.log('usage: sql|src|desc');
})();
