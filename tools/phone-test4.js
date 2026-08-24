/**
 * The arrays are index-aligned, so a MIXED batch (existing phone + brand-new
 * one) is how an insert is expressed: the new row carries an EMPTY id at its
 * index. Test the real design.
 */
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
  console.log('   ' + JSON.stringify(r.rows || r.outBinds || {}).slice(0, 400));
}

(async () => {
  await post('/mode', { enabled: true });

  report('how does str_to_type handle trailing / leading delimiters?',
    await run(`DECLARE
        a XXHMC_SND_PHONE_PKG.ETSND_VARCHAR; b XXHMC_SND_PHONE_PKG.ETSND_VARCHAR;
      BEGIN
        a := XXHMC_SND_PHONE_PKG.str_to_type('310129,');
        b := XXHMC_SND_PHONE_PKG.str_to_type(',');
        RAISE_APPLICATION_ERROR(-20999, 'RESULT trailing=' || a.COUNT || ' onlyDelim=' || b.COUNT ||
          ' a1=[' || a(1) || ']' || CASE WHEN a.COUNT > 1 THEN ' a2=[' || a(2) || ']' ELSE '' END);
      END;`));

  report('MIXED batch: update the real phone + add a new Landline (empty id at index 2)',
    await run(`DECLARE
        v_flag VARCHAR2(10); v_msg VARCHAR2(2000); v_msg_ar VARCHAR2(2000);
      BEGIN
        XXHMC_SND_PHONE_PKG.add_or_update_phone(
          p_user_name             => 'AIBRAHIM39',
          p_phone_id              => XXHMC_SND_PHONE_PKG.str_to_type('310129,'),
          p_object_version_number => XXHMC_SND_PHONE_PKG.str_to_type('1,'),
          p_phone_type            => XXHMC_SND_PHONE_PKG.str_to_type('Qatar Mobile Number,Landline'),
          p_phone_number          => XXHMC_SND_PHONE_PKG.str_to_type('55723893,44412345'),
          p_success_flag          => v_flag, p_error_msg => v_msg, p_error_msg_ar => v_msg_ar);
        RAISE_APPLICATION_ERROR(-20999, 'RESULT flag=' || v_flag || ' msg=[' || SUBSTR(v_msg,1,250) || ']');
      END;`));

  report('did a Landline row appear for the user?',
    await run(`SELECT phone_id, phone_type, phone_number FROM XXHMC_SND_EMP_PHONE_V WHERE user_name = 'AIBRAHIM39'`));

  await post('/mode', { enabled: false });
  console.log('\nwrite mode disabled again.');
})();
