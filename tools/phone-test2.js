/**
 * Same proof, without OUT binds: the block raises its own result as an
 * application error, so the console's error text carries flag + message. Also
 * means nothing this block does can be committed by the console.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE = 'https://sndstgmobileapi.hamad.qa/api/v1/dev-console';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(p, payload, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + p, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000),
      });
      const t = await res.text();
      try { return JSON.parse(t); } catch { return { waf: /Request Rejected/.test(t), raw: t.slice(0, 150) }; }
    } catch (e) {
      if (i === tries - 1) return { netError: String(e) };
      await sleep(5000);
    }
  }
}
const run = (sql) => post('/execute', { sqlB64: Buffer.from(sql, 'utf8').toString('base64') });

function report(label, r) {
  console.log('\n>>> ' + label);
  if (!r) return console.log('   (no response)');
  if (r.waf) return console.log('   [WAF BLOCKED]');
  if (r.ok === false && r.error) return console.log('   ' + r.error.message.split('\n')[0]);
  if (r.ok === undefined) return console.log('   REJECTED ' + JSON.stringify(r).slice(0, 250));
  console.log('   (no error raised) ' + JSON.stringify(r.outBinds || r.rows || {}).slice(0, 300));
}

(async () => {
  await post('/mode', { enabled: true });

  report('1) how many elements does str_to_type build from one value?',
    await run(`DECLARE
        l XXHMC_SND_PHONE_PKG.ETSND_VARCHAR;
      BEGIN
        l := XXHMC_SND_PHONE_PKG.str_to_type('Qatar Mobile Number');
        RAISE_APPLICATION_ERROR(-20999, 'RESULT count=' || l.COUNT || ' first=[' || l(1) || ']');
      END;`));

  report('2) does a comma-separated string split into several elements?',
    await run(`DECLARE
        l XXHMC_SND_PHONE_PKG.ETSND_VARCHAR;
      BEGIN
        l := XXHMC_SND_PHONE_PKG.str_to_type('Qatar Mobile Number,Landline');
        RAISE_APPLICATION_ERROR(-20999, 'RESULT count=' || l.COUNT || ' first=[' || l(1) || ']');
      END;`));

  report('3) add_or_update_phone with str_to_type arrays (idempotent update)',
    await run(`DECLARE
        v_flag VARCHAR2(10); v_msg VARCHAR2(2000); v_msg_ar VARCHAR2(2000);
      BEGIN
        XXHMC_SND_PHONE_PKG.add_or_update_phone(
          p_user_name             => 'AIBRAHIM39',
          p_phone_id              => XXHMC_SND_PHONE_PKG.str_to_type('310129'),
          p_object_version_number => XXHMC_SND_PHONE_PKG.str_to_type('1'),
          p_phone_type            => XXHMC_SND_PHONE_PKG.str_to_type('Qatar Mobile Number'),
          p_phone_number          => XXHMC_SND_PHONE_PKG.str_to_type('55723893'),
          p_success_flag          => v_flag,
          p_error_msg             => v_msg,
          p_error_msg_ar          => v_msg_ar);
        RAISE_APPLICATION_ERROR(-20999, 'RESULT flag=' || v_flag || ' msg=[' || SUBSTR(v_msg, 1, 300) || ']');
      END;`));

  report('4) same call but a NEW phone (no id) — the shape our API uses',
    await run(`DECLARE
        v_flag VARCHAR2(10); v_msg VARCHAR2(2000); v_msg_ar VARCHAR2(2000);
      BEGIN
        XXHMC_SND_PHONE_PKG.add_or_update_phone(
          p_user_name             => 'AIBRAHIM39',
          p_phone_id              => XXHMC_SND_PHONE_PKG.str_to_type(''),
          p_object_version_number => XXHMC_SND_PHONE_PKG.str_to_type(''),
          p_phone_type            => XXHMC_SND_PHONE_PKG.str_to_type('Landline'),
          p_phone_number          => XXHMC_SND_PHONE_PKG.str_to_type('44412345'),
          p_success_flag          => v_flag,
          p_error_msg             => v_msg,
          p_error_msg_ar          => v_msg_ar);
        RAISE_APPLICATION_ERROR(-20999, 'RESULT flag=' || v_flag || ' msg=[' || SUBSTR(v_msg, 1, 300) || ']');
      END;`));

  await post('/mode', { enabled: false });
  console.log('\nwrite mode disabled again.');
})();
