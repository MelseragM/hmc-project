# Working notes

## Commands (Windows / PowerShell)

Run from `HMC_BackEnd/`. `npm` is blocked by the PowerShell execution policy — call
`npm.cmd` (or `npx.cmd`) instead.

| Task | Command |
|---|---|
| Install | `npm.cmd ci` |
| Build (typecheck) | `npm.cmd run build` |
| Tests | `npm.cmd test` |
| Lint | `npx.cmd eslint src --ext .ts` |

Known environment issues, both pre-existing:

- `npm.cmd run lint` crashes with `TypeError: expand is not a function` (a
  `minimatch` / `brace-expansion` resolution problem inside ESLint 8). Passing the
  directory instead of the glob, as above, works.
- The working copy uses CRLF while Prettier expects LF, so linting reports
  thousands of `Delete ␍` errors. Filter them out when looking for real findings;
  do not run `--fix`, it would rewrite every file.

Smoke-test the dependency-injection graph without a database:

```powershell
$env:ORACLE_DISABLED='true'; $env:AUTH_DISABLED='true'; $env:LDAP_ENABLED='false'
$env:JWT_SECRET='local_dev_secret_local_dev_secret_1234'; $env:PORT='3009'
node dist/main.js
```

## Oracle integration

The backend wraps existing `XXHMC_SND_*` views and procedures. Two facts drive
most of the runtime failures seen on staging:

1. **`Docs Project/sanaad-api-service-mapping.html` is the source of truth** for
   procedure parameters and, in several places, for the exact SQL the legacy
   services run (for example the `WORKLISTS_V` role filter and the
   `ACTION_HISTORY_V` item-type/item-key filter). Check it before assuming a
   signature is unavailable.
2. **It documents the request parameters of the legacy services, not the database
   objects.** View column names and OUT parameter names differ per object, so
   guessing produced `ORA-00904`, `PLS-00306` and `ORA-04044`.

Because of (2), adapters ask the data dictionary rather than hard-coding:

- `OracleSchemaService.resolveKeyColumn` / `hasColumn` — which key column a view
  actually exposes (`BaseOracleRepository.readByResolvedKey`).
- `OracleSchemaService.resolveParams` — the declared argument list of a procedure,
  used by `callSubmitProc` and `callRowsProc` so the call matches the database
  including its OUT contract.

Diagnostics endpoints for investigating a failure:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/diagnostics/oracle-object?name=XXHMC_SND_...` | Object type, columns and formal parameters of an allow-listed object |
| `GET /api/v1/diagnostics/oracle-logs` | Every Oracle call made, with SQL, sanitized binds, duration and ORA code |
| `GET /api/v1/diagnostics/oracle-logs/stats` | Aggregates per object |

Submit endpoints accept the specification's `p_*` payload directly; parameter
lookup tolerates the `p_` prefix being present on only one side.

## Outstanding — not a code issue

**Appointments (ops 41-44) return HTTP 503 on staging.** The module talks to
Cerner over HTTP and `CernerClient` refuses to call an unconfigured service, so
all four endpoints report "The appointments service is currently unavailable."
This is environment configuration, not application code: set `CERNER_BASE_URL`
(and `CERNER_TIMEOUT_MS` if the default is not suitable) in the staging
environment. Do not work around it in code.
