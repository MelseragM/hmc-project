/** Read PL/SQL source through the staging dev console: node src.js NAME [from] [to] */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1/dev-console';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const [name, fromArg, toArg] = process.argv.slice(2);
  const from = Number(fromArg || 1);
  const to = Number(toArg || from + 60);
  const mid = Math.round((from + to) / 2);
  const around = Math.max(5, Math.ceil((to - from) / 2) + 1);
  const url = `${BASE}/source?name=${encodeURIComponent(name)}&line=${mid}&around=${around}`;
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
      const t = await res.text();
      let j;
      try { j = JSON.parse(t); } catch { console.log(/Request Rejected/.test(t) ? '[WAF BLOCKED]' : t.slice(0, 200)); return; }
      if (!j.lines) { console.log(JSON.stringify(j).slice(0, 300)); return; }
      console.log(`${j.object} — lines ${j.from}..${j.to} of ${j.total}`);
      for (const l of j.lines) {
        if (Number(l.LINE) < from || Number(l.LINE) > to) continue;
        console.log(String(l.LINE).padStart(5) + ' | ' + String(l.TEXT ?? '').replace(/\s+$/, ''));
      }
      return;
    } catch (e) {
      if (i === 5) console.log('net: ' + e);
      await sleep(5000);
    }
  }
})();
