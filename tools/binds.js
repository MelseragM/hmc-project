/** Show the sanitized binds of the most recent Oracle call matching a name. */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const needle = (process.argv[2] || '').toUpperCase();
  const keys = (process.argv[3] || '').split(',').filter(Boolean);
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(`${BASE}/diagnostics/oracle-logs?limit=30`, { signal: AbortSignal.timeout(60000) });
      const j = await res.json();
      const hit = (j.result?.items || []).find((e) => String(e.object).toUpperCase().includes(needle));
      if (!hit) return console.log('no matching call in the last 30 entries');
      console.log(hit.object + ' @ ' + hit.timestamp + ' — ' + hit.path);
      const binds = hit.binds || {};
      const show = keys.length ? keys : Object.keys(binds);
      for (const k of show) {
        if (binds[k] !== undefined) console.log('  ' + k.padEnd(30) + ' = ' + binds[k]);
      }
      if (hit.response) console.log('  OUT: ' + JSON.stringify(hit.response).slice(0, 200));
      return;
    } catch { await sleep(5000); }
  }
})();
