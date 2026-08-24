module.exports = [
  {
    label: 'F1 — which program unit raises the Policy Awareness message?',
    sql: 'SELECT name, type, line, text FROM all_source WHERE text LIKE :p AND rownum <= 10',
    binds: { p: '%Policy Awareness%' },
  },
  {
    label: 'B1 — letters LOV objects (to find the name+language pairing)',
    sql: 'SELECT owner, object_name, object_type FROM all_objects WHERE object_name LIKE :p ORDER BY 2,3',
    binds: { p: 'XXHMC_SND%LTR%' },
  },
  {
    label: 'B2 — more letters objects',
    sql: 'SELECT owner, object_name, object_type FROM all_objects WHERE object_name LIKE :p ORDER BY 2,3',
    binds: { p: 'XXHMC_SND%LETTER%' },
  },
  {
    label: 'C1 — payslip proc: where are the cursors opened?',
    sql: 'SELECT line, text FROM all_source WHERE name LIKE :n AND text LIKE :p ORDER BY line',
    binds: { n: 'XXHMC_SND_PAYSLIP_PR', p: '%OPEN %' },
  },
];
