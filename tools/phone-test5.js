/**
 * Runs EXACTLY the statement shape the fixed repository now builds (named args,
 * str_to_type wrappers, comma-joined values) to confirm it before the deploy.
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
  console.log('   ' + JSON.stringify(r.rows || {}).slice(0, 300));
}

(async () => {
  await post('/mode', { enabled: true });

  // Same statement the repository emits, with the OUT values raised so nothing
  // depends on OUT-bind типы over JSON.
  report('repository-shaped call: update phone 310129 (type + number unchanged)',
    await run(`DECLARE
        v_flag VARCHAR2(10); v_msg VARCHAR2(2000); v_msg_ar VARCHAR2(2000);
      BEGIN
        XXHMC_SND_PHONE_PKG.ADD_OR_UPDATE_PHONE(
          p_user_name => 'AIBRAHIM39',
          p_phone_id => XXHMC_SND_PHONE_PKG.str_to_type('310129'),
          p_object_version_number => XXHMC_SND_PHONE_PKG.str_to_type('1'),
          p_phone_type => XXHMC_SND_PHONE_PKG.str_to_type('Qatar Mobile Number'),
          p_phone_number => XXHMC_SND_PHONE_PKG.str_to_type('55723893'),
          p_success_flag => v_flag, p_error_msg => v_msg, p_error_msg_ar => v_msg_ar);
        RAISE_APPLICATION_ERROR(-20999, 'RESULT flag=' || v_flag || ' msg=[' || SUBSTR(v_msg,1,200) || ']');
      END;`));

  report('does a phone TYPE change work too? (Landline on the same row, then revert)',
    await run(`DECLARE
        v_flag VARCHAR2(10); v_msg VARCHAR2(2000); v_msg_ar VARCHAR2(2000);
      BEGIN
        XXHMC_SND_PHONE_PKG.ADD_OR_UPDATE_PHONE(
          p_user_name => 'AIBRAHIM39',
          p_phone_id => XXHMC_SND_PHONE_PKG.str_to_type('310129'),
          p_object_version_number => XXHMC_SND_PHONE_PKG.str_to_type('1'),
          p_phone_type => XXHMC_SND_PHONE_PKG.str_to_type('Landline'),
          p_phone_number => XXHMC_SND_PHONE_PKG.str_to_type('55723893'),
          p_success_flag => v_flag, p_error_msg => v_msg, p_error_msg_ar => v_msg_ar);
        RAISE_APPLICATION_ERROR(-20999, 'RESULT flag=' || v_flag || ' msg=[' || SUBSTR(v_msg,1,200) || ']');
      END;`));

  report('current phone rows (nothing above was committed — each block raised)',
    await run(`SELECT phone_id, phone_type, phone_number FROM XXHMC_SND_EMP_PHONE_V WHERE user_name = 'AIBRAHIM39'`));

  await post('/mode', { enabled: false });
  console.log('\nwrite mode disabled again.');
})();
