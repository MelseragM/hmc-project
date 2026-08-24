/**
 * Pull a PL/SQL unit's source through the dev console /source endpoint (GET —
 * survives the WAF, unlike quoted SQL) and grep it locally.
 *   node grepsrc.js NAME PATTERN        → matching lines
 *   node grepsrc.js NAME --from 190 --to 210
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1/dev-console';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
      const t = await res.text();
      try { return JSON.parse(t); } catch { return { waf: /Request Rejected/.test(t) }; }
    } catch (e) {
      if (i === tries - 1) return { netError: String(e) };
      await sleep(5000);
    }
  }
}

(async () => {
  const name = process.argv[2];
  const args = process.argv.slice(3);
  const fromFlag = args.indexOf('--from');
  const toFlag = args.indexOf('--to');
  const pattern = fromFlag === -1 && toFlag === -1 ? args.join(' ') : null;

  // /source without `line` returns the whole unit.
  const j = await get(`${BASE}/source?name=${encodeURIComponent(name)}`);
  if (!j || !j.lines) { console.log(JSON.stringify(j).slice(0, 200)); return; }
  console.log(`${j.object}: ${j.total} line(s)`);
  const lines = j.lines;
  if (pattern) {
    const re = new RegExp(pattern, 'i');
    const hits = lines.filter((l) => re.test(String(l.TEXT ?? '')));
    console.log(`matches for /${pattern}/i : ${hits.length}`);
    for (const l of hits) console.log(String(l.LINE).padStart(5) + ' | ' + String(l.TEXT ?? '').replace(/\s+$/, ''));
  } else {
    const from = Number(args[fromFlag + 1] || 1);
    const to = Number(args[toFlag + 1] || from + 40);
    for (const l of lines) {
      const n = Number(l.LINE);
      if (n >= from && n <= to) console.log(String(n).padStart(5) + ' | ' + String(l.TEXT ?? '').replace(/\s+$/, ''));
    }
  }
})();
