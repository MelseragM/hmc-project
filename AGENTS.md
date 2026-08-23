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

## Outstanding — not a code issue

**Appointments (ops 41-44) return HTTP 503 on staging.** The module talks to
Cerner over HTTP and `CernerClient` refuses to call an unconfigured service, so
all four endpoints report "The appointments service is currently unavailable."
This is environment configuration, not application code: set `CERNER_BASE_URL`
(and `CERNER_TIMEOUT_MS` if the default is not suitable) in the staging
environment. Do not work around it in code.

## Staging verification facts (2026-08-23, via https://sndstgmobileapi.hamad.qa)

Learned by live-testing contact/dependents/school-fees/appointments/
annual-ticket/approvals; the Postman collection carries the captured real
responses as examples.

- Staging runs `AUTH_DISABLED=true`: the gateway forwards without a token and
  the backend injects dev user `AIBRAHIM39`/`037400` (401/403 not reproducible
  there). `POST /auth/login` still returns a signed JWT (dev bypass).
- Approvals/worklist views are keyed by USERNAME (`enum=AIBRAHIM39`), not the
  employee number — `WORKLISTS_V` returned 44 real rows for the username and
  none for `037400`/`053613`. `NOTYFY_APPR_V` (op 21 details) appears to hold
  only OPEN actionable notifications for the recipient.
- op 67 `TICKET_REQ_PR.p_employee` must be the Oracle **PERSON_ID** (26023 for
  AIBRAHIM39): the employee number fails the
  `HMC_HR_PASSAGE_TICKET_EMPLOYEE_NAME` flexfield check and a name string
  raises ORA-01722. `p_contractual_year` must exist in
  `HMC_HR_CONTRACTUAL_YEAR_SIT` ('01-SEP-2025 to 31-AUG-2026' passes,
  calendar-year strings do not). With correct values the test user gets the
  real business answer "No ticket balance available..." (no entitlement).
- `UPD_ADDRESS_PR`: `p_country` takes the country NAME (`Qatar`; `QA` →
  "Invalid Country"), `p_address_type` must equal the target address's own
  type, and repeating an update on the same `p_effective_date` fails
  (date-track). `CREATE_ADDRESS_PR` rejects overlapping same-type addresses.
  Both verified with successflag S.
- op 65 add dependent returns successflag S only when the flexfield's extra
  requirements are met (the wire shows a sanitized message; the FLEX-NULL /
  FLEX-VALUE detail is only in oracle-logs): >=1 attachment,
  `p_passport_number`, `p_pp_expiry_date`, `p_country_of_issue`,
  `p_visa_type` ('QID(Qatari)'|'Residence Permit'), `p_visa_validity`
  (Yes|No), unique `p_id_number` (QID), and `p_relationship` from the op 64
  CONTACT group ('Child', not "Son"). Working example pinned in the DTO and
  Postman.
- op 71 reassign and RFMI request-info returned successflag S when run against
  an OPEN notification owned by the caller (from WORKLISTS_V). op 22 decision
  needs an open actionable APPROVAL assigned to the caller (FYI notifications
  reject APPROVE) — none existed for the dev user.
- Staging DB issues (request format is correct, procedure fails internally):
  `ADD_OR_UPDATE_PHONE` rejects every phone type (all LOV meanings+codes and
  the user's own stored type — the spec's own recorded sample shows the same
  error); `SCHOOL_FEE_PR` raises ORA-01403 at line 197 / ORA-00027 at line 114
  for fully valid payloads; `UPDATE_DEPENDENT_PR` intermittently hits
  ORA-00027 at package line 3506 once an attachment is supplied.
