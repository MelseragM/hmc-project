module.exports = [
  {
    label: 'our pooled sessions: do they carry an SSHR action? (root cause of ORA-00027)',
    sql: 'SELECT sid, serial#, client_identifier, action, module, program FROM v$session WHERE client_identifier IS NOT NULL AND rownum <= 20',
  },
  {
    label: 'REMOVE_DEPENDENT_PR — lines mentioning CONTACT_TYPE',
    sql: 'SELECT line, text FROM all_source WHERE name = :n AND UPPER(text) LIKE :p ORDER BY line',
    binds: { n: 'XXHMC_SND_REMOVE_DEPENDENT_PR', p: '%CONTACT_TYPE%' },
  },
  {
    label: 'RET_FRM_LEAV_PR — lines around the 06502 buffer (190..200)',
    sql: 'SELECT line, text FROM all_source WHERE name = :n AND line BETWEEN :a AND :b ORDER BY line',
    binds: { n: 'XXHMC_SND_RET_FRM_LEAV_PR', a: 185, b: 205 },
  },
  {
    label: 'LEAV_OF_ABSEN_NEW_PR — around line 168 (kill session?)',
    sql: 'SELECT line, text FROM all_source WHERE name = :n AND line BETWEEN :a AND :b ORDER BY line',
    binds: { n: 'XXHMC_SND_LEAV_OF_ABSEN_NEW_PR', a: 155, b: 175 },
  },
];
