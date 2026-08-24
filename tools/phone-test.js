/**
 * Prove the phone-upsert theory: XXHMC_SND_PHONE_PKG.add_or_update_phone takes
 * ETSND_VARCHAR (an associative array), not scalars — and the package ships
 * str_to_type() to build one from a string. Runs an IDEMPOTENT update of the
 * test user's own phone (same id / type / number) through the dev console.
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

const run = (sql, binds) =>
  post('/execute', { sqlB64: Buffer.from(sql, 'utf8').toString('base64'), binds });

function report(label, r) {
  console.log('\n>>> ' + label);
  if (!r) return console.log('   (no response)');
  if (r.waf) return console.log('   [WAF BLOCKED]');
  if (r.ok === false && r.error) {
    console.log('   ERROR ORA-' + (r.error.oraCode || '?') + ': ' + r.error.message.split('\n')[0]);
    return;
  }
  if (r.ok === undefined) return console.log('   REJECTED ' + JSON.stringify(r).slice(0, 250));
  if (r.outBinds) console.log('   OUT: ' + JSON.stringify(r.outBinds));
  if (r.rows?.length) console.log('   ' + JSON.stringify(r.rows[0]));
}

(async () => {
  // Write mode is needed for PL/SQL blocks (console ships read-only).
  const mode = await post('/mode', { enabled: true });
  console.log('write mode:', JSON.stringify(mode?.allowWrite));

  // 1) What does str_to_type make of a single value?
  report(
    'str_to_type single value -> element count',
    await run(
      `DECLARE
         l XXHMC_SND_PHONE_PKG.ETSND_VARCHAR;
       BEGIN
         l := XXHMC_SND_PHONE_PKG.str_to_type('Qatar Mobile Number');
         :n := l.COUNT;
         :first := l(1);
       END;`,
      { n: { dir: 3003, type: 2010 }, first: { dir: 3003, type: 2001, maxSize: 200 } },
    ),
  );

  // 2) Idempotent update of the user's own phone, arrays built by str_to_type.
  report(
    'add_or_update_phone via str_to_type (same id/type/number = no-op update)',
    await run(
      `BEGIN
         XXHMC_SND_PHONE_PKG.add_or_update_phone(
           p_user_name             => 'AIBRAHIM39',
           p_phone_id              => XXHMC_SND_PHONE_PKG.str_to_type('310129'),
           p_object_version_number => XXHMC_SND_PHONE_PKG.str_to_type('1'),
           p_phone_type            => XXHMC_SND_PHONE_PKG.str_to_type('Qatar Mobile Number'),
           p_phone_number          => XXHMC_SND_PHONE_PKG.str_to_type('55723893'),
           p_success_flag          => :flag,
           p_error_msg             => :msg,
           p_error_msg_ar          => :msg_ar);
       END;`,
      {
        flag: { dir: 3003, type: 2001, maxSize: 10 },
        msg: { dir: 3003, type: 2001, maxSize: 2000 },
        msg_ar: { dir: 3003, type: 2001, maxSize: 2000 },
      },
    ),
  );

  await post('/mode', { enabled: false });
  console.log('\nwrite mode disabled again.');
})();
