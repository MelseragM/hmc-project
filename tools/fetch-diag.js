process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/diagnostics/oracle-logs?limit=${process.argv[2] || 20}`, { signal: AbortSignal.timeout(30000) });
      const j = await res.json();
      for (const it of (j.result && j.result.items) || []) {
        if (it.op !== 'call' && it.status !== 'error') continue;
        console.log(`=== ${it.object} @ ${it.timestamp} ${it.op} status=${it.status}${it.oraCode ? ' ORA-' + it.oraCode : ''} path=${it.path}`);
        if (it.error) console.log('  err: ' + String(it.error).split('\n').slice(0, 3).join(' | ').slice(0, 320));
        if (it.response) console.log('  out: ' + JSON.stringify(it.response).slice(0, 340));
      }
      return;
    } catch { await sleep(8000); }
  }
  console.log('gave up');
})();
