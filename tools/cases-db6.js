module.exports = [
  {
    label: 'B3 — letter NAME LOV definition (does it expose the language pairing?)',
    sql: 'SELECT text FROM all_views WHERE view_name LIKE :v',
    binds: { v: 'XXHMC_SND_LETTER_NAME_LOV' },
  },
  {
    label: 'B4 — letter names as the LOV serves them',
    sql: 'SELECT * FROM XXHMC_SND_LETTER_NAME_LOV WHERE rownum <= 30',
  },
  {
    label: 'C2 — payslip: what guards the first OPEN (line 930..945)?',
    sql: 'SELECT line, text FROM all_source WHERE name LIKE :n AND line > :a AND line < :b ORDER BY line',
    binds: { n: 'XXHMC_SND_PAYSLIP_PR', a: 925, b: 946 },
  },
];
