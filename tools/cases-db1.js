// Investigate the open DB blockers — no quoted literals (WAF), binds only.
module.exports = [
  {
    label: 'who am I / current schema',
    sql: 'SELECT USER AS db_user, SYS_CONTEXT(:ns, :key) AS cur_schema FROM DUAL',
    binds: { ns: 'USERENV', key: 'CURRENT_SCHEMA' },
  },
  {
    label: 'where does XXHMC_SND_PHONE_TYPE_V live',
    sql: 'SELECT owner, object_type, status FROM all_objects WHERE object_name = :n',
    binds: { n: 'XXHMC_SND_PHONE_TYPE_V' },
  },
  {
    label: 'synonym target of the phone view',
    sql: 'SELECT owner, synonym_name, table_owner, table_name FROM all_synonyms WHERE synonym_name = :n',
    binds: { n: 'XXHMC_SND_PHONE_TYPE_V' },
  },
  {
    label: 'phone package objects',
    sql: 'SELECT owner, object_name, object_type, status FROM all_objects WHERE object_name LIKE :p ORDER BY 2,3',
    binds: { p: 'XXHMC_SND_PHONE%' },
  },
  {
    label: 'is ALL_SOURCE readable for the phone package?',
    sql: 'SELECT owner, name, type, COUNT(*) AS lines FROM all_source WHERE name = :n GROUP BY owner, name, type',
    binds: { n: 'XXHMC_SND_PHONE_PKG' },
  },
  {
    label: 'source lines of school-fee proc (does ALL_SOURCE work at all?)',
    sql: 'SELECT owner, name, type, COUNT(*) AS lines FROM all_source WHERE name = :n GROUP BY owner, name, type',
    binds: { n: 'XXHMC_SND_SCHOOL_FEE_PR' },
  },
];
