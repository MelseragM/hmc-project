module.exports = [
  {
    label: 'is the ADD_DEPENDENT package BODY readable?',
    sql: 'SELECT owner, name, type, COUNT(*) AS lines FROM all_source WHERE name LIKE :n GROUP BY owner, name, type',
    binds: { n: 'XXHMC_SND_ADD_DEPENDENT_PKG' },
  },
  {
    label: 'update proc: lines touching CONTACT_TYPE',
    sql: 'SELECT type, line, text FROM all_source WHERE name LIKE :n AND text LIKE :p ORDER BY type, line',
    binds: { n: 'XXHMC_SND_ADD_DEPENDENT_PKG', p: '%contact_type%' },
  },
  {
    label: 'update proc: lines touching relation_ship parameter',
    sql: 'SELECT type, line, text FROM all_source WHERE name LIKE :n AND text LIKE :p ORDER BY type, line',
    binds: { n: 'XXHMC_SND_ADD_DEPENDENT_PKG', p: '%p_relation_ship%' },
  },
];
