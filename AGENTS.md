# Working notes

This workspace has two sibling projects: `HMC_BackEnd/` (the Sanaad API, wraps
Oracle) and `HMC_Gateway/` (public-facing gateway in front of it — forwards the
mobile auth journey, validates issued JWTs locally, and proxies everything
else). `npm` is blocked by the PowerShell execution policy in both — call
`npm.cmd` (or `npx.cmd`) instead.

## HMC_BackEnd commands

Run from `HMC_BackEnd/`.

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
  including its OUT contract. It reads `ALL_ARGUMENTS` with
  `OWNER`/`OVERLOAD`/`SUBPROGRAM_ID`/`DATA_LEVEL`/`TYPE_*`, keeps only
  `DATA_LEVEL = 0` formals (collection attributes are not procedure arguments),
  and picks one overload by scoring it against the adapter's documented
  parameter list; a truly ambiguous overload set throws instead of merging.
  Composite (`PL/SQL TABLE`/`RECORD`/`OBJECT`) parameters bind by their declared
  type name.

Related runtime behaviour:

- Submit endpoints have strict request DTOs (required business fields, unknown
  keys rejected 400). Dependent legacy spellings (`p_gendar`,
  `p_relation_ship`, `p_visa_validy`, `p_date_of_issuue_qid`,
  `p_type_of_sponsership`) are accepted and mirrored to the canonical names.
- Submit `POST`s return HTTP 200 (Sanaad convention: business result is in
  `successflag`), not Nest's default 201.
- English/Arabic column twins (`PHONE_TYPE`/`PHONE_TYPE_AR`, `meaning`/
  `meaningAr`, `VALUE`/`VALUEAR`, ...) are collapsed globally by the
  `ResponseInterceptor` via `localizeArTwins` (`shared/utils/localize.util.ts`):
  the base field carries the value for the request's `lang` (Arabic values
  URL-decoded, English fallback when the Arabic twin is empty) and the `*Ar`
  twin is removed from the response for both languages. A key only counts as a
  twin when its base key exists in the same object, so `YEAR`/`calendar` are
  never collapsed.
- Phone upsert (op 28) submits per phone through the scalar
  `ADD_OR_UPDATE_PHONE` signature and stops at the first failed item.
- LOV reads cache per (object, lang, username, options) for `LOV_CACHE_TTL_MS`
  (default 5 min) and coalesce concurrent identical reads. `SCHOOL_NAME_LOV`
  supports `search`/`page`/`pageSize` (Oracle-side `OFFSET/FETCH`).
- Oracle calls carry `ORACLE_CALL_TIMEOUT_MS` (connection `callTimeout`) and the
  pool `ORACLE_QUEUE_TIMEOUT_MS`, both default 25 s, so a hung statement cannot
  outlive the HTTP 30 s timeout or exhaust the pool.

Diagnostics endpoints for investigating a failure:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/diagnostics/oracle-object?name=XXHMC_SND_...` | Object type, columns and formal parameters of an allow-listed object |
| `GET /api/v1/diagnostics/oracle-logs` | Every Oracle call made, with SQL, sanitized binds, duration and ORA code |
| `GET /api/v1/diagnostics/oracle-logs/stats` | Aggregates per object |

Submit endpoints accept the specification's `p_*` payload directly; parameter
lookup tolerates the `p_` prefix being present on only one side.

## Users/Sanaad SQL Server DB (auth cycle + healthcheck)

A second database next to Oracle: the legacy Sanaad SQL Server, pooled by the
global `MssqlService` (`core/database/mssql.module.ts`, `mssql` driver,
`USERS_DB_*` env vars — see `.env.example`; `USERS_DB_DISABLED=true` skips the
pool like `ORACLE_DISABLED`). It backs the auth cycle with the legacy tables
and SQL from the client's service mapping, values bound as `@params` and
mpin/otp params redacted from logs:

- `HMC_Sanad_DeviceRegn_tbl` — device binding (`DeviceRegistryPort`) and MPIN
  (`MpinStorePort`); MPIN stored **as received** (client pre-hashes) and
  compared with SQL equality — legacy-compatible by explicit decision, do not
  switch to scrypt without a migration plan.
- `HMC_RHAP_OTP_tbl` — OTP rows (`OtpPort`): `TOP 1 ... ORDER BY SeqNo DESC` +
  `DATEDIFF` freshness; `SeqNo` doubles as the mobile `requestid`. Resend
  window/TTL/max-attempts come from `OTP_*` config (attempts + single-use are
  tracked in-memory; the legacy table has no columns for them).
- `HMC_Sanad_AppDownTime_tbl` / `HMC_Sanad_App_Update_tbl` — API-1
  `/healthcheck` downtime + update-type (`APP_NAME` matches
  `HMC_Sanad_AppMaster_Tbl.AppName`); falls back to the `APP_*` env config when
  the pool is disabled or a query fails.

OTP delivery is `OtpDeliveryPort` → `SmsOtpDeliveryAdapter`, a generic
config-driven HTTP POST (`SMS_API_BASE_URL`/`SMS_API_KEY`/`SMS_SENDER_ID`/
`SMS_MESSAGE_TEMPLATE` with `{otp}`) pending the corporate gateway contract.
Unset base URL = masked log-only in non-production, hard 503 in production.
Raw OTPs and unmasked phone numbers must never be logged.

Identity (employee name + phone for the OTP SMS) still comes from the
directory (LDAP/Entra, below) — the SQL DB only holds device/MPIN/OTP state.
`FunctionAccessPort` is still the 501 stub, so a full production (non-bypass)
login stops at `functionAccess.list()` until its source is wired (the legacy
query against `HMC_Sanad_AppMaster_VW` is documented in the client mapping).
The `AUTH_DISABLED`/non-production dev bypass is unchanged.

## Auth directory provider (LDAPS vs Entra ID)

The corporate-directory lookup behind `LDAP_USER_PORT` (auth journey API-2/5) is
switchable via `AUTH_DIRECTORY`: `ldap` (default) uses `LdapUserRepository`
(LDAPS/`ldapts`), `entra` uses `EntraGraphUserRepository` (Microsoft Graph,
app-only client-credentials over the existing `@nestjs/axios`). The factory is in
`src/modules/auth/auth.module.ts`. Only `validate()` (passwordless lookup) is
used by the journey — the mobile credential stays OTP + MPIN — so `authenticate()`
is a 501 in the Entra adapter. Entra config lives in the `entra` namespace
(`ENTRA_TENANT_ID`/`ENTRA_CLIENT_ID`/`ENTRA_CLIENT_SECRET`/…); the Graph app needs
`User.Read.All` (Application) with admin consent. Switching back to `ldap` is an
instant rollback (no code redeploy). No mobile/gateway/DTO/JWT changes.

## Outstanding — not a code issue

**Appointments (ops 41-44) return HTTP 503 on staging.** The module talks to
Cerner over HTTP and `CernerClient` refuses to call an unconfigured service, so
all four endpoints report "The appointments service is currently unavailable."
This is environment configuration, not application code: set `CERNER_BASE_URL`
(and `CERNER_TIMEOUT_MS` if the default is not suitable) in the staging
environment. Do not work around it in code.

## HMC_Gateway

Public entry point for mobile: forwards the pre-login Sanaad auth journey
(`/healthcheck`, `/auth/initiate`, `/auth/otp/validate`, `/auth/mpin/update`,
`/auth/login`, `/auth/mpin/forgot`, `/auth/mpin/update/reset`) verbatim to
`HMC_BackEnd`, then validates the JWT the backend issued **locally** (shared
`JWT_SECRET`/`JWT_ISSUER`/`JWT_AUDIENCE` — same env var names as
`HMC_BackEnd`, must be kept in sync) on every other request before proxying it
through via a generic `@All('*')` wildcard controller
(`src/modules/proxy/proxy.controller.ts`). Backend responses (success and
error bodies) are relayed byte-for-byte and never re-wrapped; only a real
network failure to the backend (timeout/connection refused) produces a
gateway-originated minimal `{status:'error', message, httpStatusCode}` 502/504
(`ProxyService.handleNetworkError`).

Run from `HMC_Gateway/`.

| Task | Command |
|---|---|
| Install | `npm.cmd ci` |
| Build (typecheck) | `npm.cmd run build` |
| Unit tests | `npm.cmd test` |
| E2E tests (mocked backend) | `npm.cmd run test:e2e` |
| Lint | `npx.cmd eslint src test --ext .ts` |
| Format | `npx.cmd prettier --write "src/**/*.ts" "test/**/*.ts"` |

Notes:

- Unlike `HMC_BackEnd`, this is a brand-new project with no CRLF debt — keep it
  that way; run Prettier normally (not the "don't `--fix`" caveat that applies
  to the backend's existing working copy).
- `test/mock-backend.ts` is a minimal `http` stand-in for `HMC_BackEnd` used by
  `test/gateway.e2e-spec.ts`; it mints a real JWT with the same secret the
  gateway is configured with so the proxy/auth-guard path can be exercised
  without a live backend or Oracle/LDAP.
- Route registration order: `ProxyModule` (the wildcard) is imported last in
  `AppModule`. Nest 11's `RouteSpecificitySorter` already registers literal
  routes before wildcards regardless of import order, so this is
  belt-and-suspenders, not load-bearing — see the doc comment on
  `ProxyCoreModule`.
- Manual smoke test against a real backend (mirrors the backend's own
  no-Oracle smoke test):
  ```powershell
  # Terminal 1 — HMC_BackEnd
  cd HMC_BackEnd
  $env:ORACLE_DISABLED='true'; $env:AUTH_DISABLED='true'; $env:LDAP_ENABLED='false'
  $env:JWT_SECRET='local_dev_secret_local_dev_secret_1234'; $env:PORT='3009'
  node dist/main.js

  # Terminal 2 — HMC_Gateway
  cd HMC_Gateway
  $env:BACKEND_BASE_URL='http://localhost:3009'; $env:BACKEND_API_PREFIX='api/v1'
  $env:JWT_SECRET='local_dev_secret_local_dev_secret_1234'; $env:AUTH_DISABLED='true'
  $env:GATEWAY_PORT='3001'
  node dist/main.js
  ```
  Then `GET http://localhost:3001/api/v1/health` (gateway liveness),
  `GET http://localhost:3001/api/v1/health/backend` (dependency check, proxies
  to the backend's own `/health`), and any other `GET`/`POST
  http://localhost:3001/api/v1/...` route falls through to the wildcard and is
  proxied to the real backend untouched (confirmed against
  `/healthcheck`, `/health/db`, and the Oracle diagnostics response).
