module.exports = [
  {
    label: 'sponsorship LOV objects',
    sql: 'SELECT owner, object_name, object_type FROM all_objects WHERE object_name LIKE :p ORDER BY 2,3',
    binds: { p: 'XXHMC_SND%SPONSOR%' },
  },
  {
    label: 'dependent-related LOV views',
    sql: 'SELECT owner, object_name FROM all_objects WHERE object_name LIKE :p AND object_type LIKE :t ORDER BY 2',
    binds: { p: 'XXHMC_SND%DEP%', t: 'VIEW' },
  },
];
