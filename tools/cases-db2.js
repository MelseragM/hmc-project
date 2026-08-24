module.exports = [
  {
    label: 'children rows the proc will search (acd_st_dt 2025/09/01)',
    sql: 'SELECT child_id, dob, date_of_birth FROM table (xxhmc_snd_child_dets_view (:d, :u))',
    binds: { d: '2025/09/01 00:00:00', u: 'AIBRAHIM39' },
  },
  {
    label: 'school LOV rows for the user (name + establishment_id)',
    sql: 'SELECT name, establishment_id FROM XXHMC_SND_SCHOOL_NAME_LOV WHERE user_name = :u AND name LIKE :n',
    binds: { u: 'AIBRAHIM39', n: 'Al Arqam%' },
  },
  {
    label: 'phone package: is there a BODY in all_source?',
    sql: 'SELECT owner, name, type, COUNT(*) AS lines FROM all_source WHERE name LIKE :n GROUP BY owner, name, type',
    binds: { n: 'XXHMC_SND_PHONE%' },
  },
  {
    label: 'phone package spec (18 lines)',
    sql: 'SELECT line, text FROM all_source WHERE name = :n ORDER BY line',
    binds: { n: 'XXHMC_SND_PHONE_PKG' },
  },
];
