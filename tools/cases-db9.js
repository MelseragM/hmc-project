// Now that the console accepts base64, quoted SQL finally reaches Oracle.
module.exports = [
  {
    label: 'B64 smoke test — quoted literal that the WAF used to block',
    sql: "SELECT 'base64 channel works' AS proof, USER AS db_user FROM DUAL",
  },
  {
    label: 'PHONE: what does the users own phone row look like? (types actually stored)',
    sql: `SELECT * FROM XXHMC_SND_EMP_PHONE_V WHERE user_name = 'AIBRAHIM39'`,
  },
  {
    label: 'PHONE: is the package body visible under a wrapped form?',
    sql: `SELECT owner, name, type, line, text FROM all_source
           WHERE name = 'XXHMC_SND_PHONE_PKG' AND type = 'PACKAGE BODY' AND ROWNUM <= 5`,
  },
  {
    label: 'PHONE: full package spec (signature + comments)',
    sql: `SELECT line, text FROM all_source WHERE name = 'XXHMC_SND_PHONE_PKG' ORDER BY line`,
  },
];
