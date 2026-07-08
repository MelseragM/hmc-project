/**
 * dependency-cruiser rules enforcing the Clean Architecture / module boundaries
 * described in Docs_Ai/Layers and Docs_Ai/Dependencies.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are forbidden (see Dependencies/README.md).',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'domain/ must not import NestJS, oracledb, or DTOs (Layers/README.md).',
      from: { path: '(^|/)domain/' },
      to: { path: 'node_modules/(@nestjs|oracledb)' },
    },
    {
      name: 'oracledb-only-in-infrastructure',
      severity: 'error',
      comment: 'oracledb may only be imported inside core/database or */infrastructure/oracle.',
      from: { pathNot: '(core/database|infrastructure/oracle)' },
      to: { path: 'node_modules/oracledb' },
    },
    {
      name: 'no-feature-to-feature',
      severity: 'error',
      comment: 'Feature modules must not import each other (Dependencies/README.md).',
      from: { path: 'src/modules/([^/]+)/' },
      to: {
        path: 'src/modules/([^/]+)/',
        pathNot: 'src/modules/$1/',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
