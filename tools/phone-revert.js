/**
 * Revert the test user's phone type back to its original value. The EBS
 * procedure commits internally, so the earlier probe persisted even though the
 * surrounding block raised.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1/dev-console';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(p, payload, tries = 6) {
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
const show = (l, r) => {
  console.log('\n>>> ' + l);
  if (r?.ok === false && r.error) return console.log('   ' + r.error.message.split('\n')[0]);
  console.log('   ' + JSON.stringify(r?.rows ?? r ?? {}).slice(0, 300));
};

(async () => {
  await post('/mode', { enabled: true });

  show('before', await run(
    `SELECT phone_id, phone_type, phone_number FROM XXHMC_SND_EMP_PHONE_V WHERE user_name = 'AIBRAHIM39'`));

  // No RAISE this time: let the procedure's own commit stand.
  show('revert to Qatar Mobile Number', await run(
    `DECLARE
       v_flag VARCHAR2(10); v_msg VARCHAR2(2000); v_msg_ar VARCHAR2(2000);
     BEGIN
       XXHMC_SND_PHONE_PKG.ADD_OR_UPDATE_PHONE(
         p_user_name => 'AIBRAHIM39',
         p_phone_id => XXHMC_SND_PHONE_PKG.str_to_type('310129'),
         p_object_version_number => XXHMC_SND_PHONE_PKG.str_to_type('1'),
         p_phone_type => XXHMC_SND_PHONE_PKG.str_to_type('Qatar Mobile Number'),
         p_phone_number => XXHMC_SND_PHONE_PKG.str_to_type('55723893'),
         p_success_flag => v_flag, p_error_msg => v_msg, p_error_msg_ar => v_msg_ar);
     END;`));

  show('after', await run(
    `SELECT phone_id, phone_type, phone_number FROM XXHMC_SND_EMP_PHONE_V WHERE user_name = 'AIBRAHIM39'`));

  await post('/mode', { enabled: false });
  console.log('\nwrite mode disabled again.');
})();
