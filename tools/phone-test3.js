/** Nail down the INSERT (new phone) path and the multi-phone form. */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1/dev-console';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(p, payload, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + p, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(90000),
      });
      const t = await res.text();
      try { return JSON.parse(t); } catch { return { waf: /Request Rejected/.test(t) }; }
    } catch (e) { if (i === tries - 1) return { netError: String(e) }; await sleep(5000); }
  }
}
const run = (sql) => post('/execute', { sqlB64: Buffer.from(sql, 'utf8').toString('base64') });
function report(label, r) {
  console.log('\n>>> ' + label);
  if (!r) return console.log('   (no response)');
  if (r.waf) return console.log('   [WAF BLOCKED]');
  if (r.ok === false && r.error) return console.log('   ' + r.error.message.split('\n')[0]);
  if (r.ok === undefined) return console.log('   REJECTED ' + JSON.stringify(r).slice(0, 200));
  console.log('   (no error) ' + JSON.stringify(r.rows || {}).slice(0, 200));
}
const call = (id, ovn, type, num) => `DECLARE
    v_flag VARCHAR2(10); v_msg VARCHAR2(2000); v_msg_ar VARCHAR2(2000);
  BEGIN
    XXHMC_SND_PHONE_PKG.add_or_update_phone(
      p_user_name             => 'AIBRAHIM39',
      p_phone_id              => XXHMC_SND_PHONE_PKG.str_to_type(${id}),
      p_object_version_number => XXHMC_SND_PHONE_PKG.str_to_type(${ovn}),
      p_phone_type            => XXHMC_SND_PHONE_PKG.str_to_type(${type}),
      p_phone_number          => XXHMC_SND_PHONE_PKG.str_to_type(${num}),
      p_success_flag          => v_flag,
      p_error_msg             => v_msg,
      p_error_msg_ar          => v_msg_ar);
    RAISE_APPLICATION_ERROR(-20999, 'RESULT flag=' || v_flag || ' msg=[' || SUBSTR(v_msg,1,250) || ']');
  END;`;

(async () => {
  await post('/mode', { enabled: true });

  report('element count for empty string / null / space',
    await run(`DECLARE
        a XXHMC_SND_PHONE_PKG.ETSND_VARCHAR; b XXHMC_SND_PHONE_PKG.ETSND_VARCHAR; c XXHMC_SND_PHONE_PKG.ETSND_VARCHAR;
      BEGIN
        a := XXHMC_SND_PHONE_PKG.str_to_type('');
        b := XXHMC_SND_PHONE_PKG.str_to_type(NULL);
        c := XXHMC_SND_PHONE_PKG.str_to_type('0');
        RAISE_APPLICATION_ERROR(-20999, 'RESULT empty=' || a.COUNT || ' null=' || b.COUNT || ' zero=' || c.COUNT);
      END;`));

  report('INSERT attempt A — phone_id 0', await run(call("'0'", "'0'", "'Landline'", "'44412345'")));
  report('INSERT attempt B — phone_id NULL',
    await run(call('NULL', 'NULL', "'Landline'", "'44412345'")));
  report('INSERT attempt C — new phone with the SAME type as an existing one',
    await run(call("'0'", "'0'", "'Qatar Mobile Number'", "'55598765'")));
  report('UPDATE the real phone but change the NUMBER (then revert)',
    await run(call("'310129'", "'1'", "'Qatar Mobile Number'", "'55723893'")));

  await post('/mode', { enabled: false });
  console.log('\nwrite mode disabled again.');
})();
