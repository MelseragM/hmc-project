# Postman — Sanaad B2E Collection

> Postman v2.1 collection + environment generated from `sanaad-api-service-mapping.html`. A Postman collection is JSON by nature, so this folder is JSON + this Markdown guide (the rest of the knowledge base is Markdown).

## Files
- `sanaad.postman_collection.json` — all operations, organized into folders **by NestJS module**.
- `sanaad.postman_environment.json` — environment variables.

## Import
1. Postman → **Import** → select both files.
2. Select environment **"Sanaad B2E - UAT"** (top-right).
3. Set `token` (bearer) — obtained from the login flow (op 1, spec out-of-band).

## Environment variables
| Variable | Default | Purpose |
|---|---|---|
| `baseUrl` | `https://apigwuat.api.hamad.qa/sanaad` | Legacy UAT gateway (real endpoints). |
| `apiV1Url` | `http://localhost:3000/api/v1` (disabled) | New NestJS backend once built — switch requests to this. |
| `token` | _(secret)_ | `Authorization: Bearer {{token}}` (collection-level auth). |
| `enum` | `053613` | Employee number (a.k.a. `personid`). |
| `username` | `V-NFERNANDO` | Oracle username form. |
| `lang` | `en` | `en` or `ar`. |
| `payslipperiod` / `payperiod` | `August 2024` / `January 2024` | Payroll params. |
| `assignmentid` | `7179444713` | Payslip key. |
| `acadyrstrtdt` | `20200202` | School-fees academic-year token. |

## Auth
Collection-level **Bearer Token** = `{{token}}`. The login request in the `auth` folder is marked no-auth; its body/flow is out-of-band ("Another document provided" in the source) — update once the auth spec is available.

## Structure (folders = modules)
`auth`, `profile`, `employee`, `payslip`, `leave`, `letters`, `identity`, `contact`, `dependents`, `school-fees`, `appointments`, `annual-ticket`, `approvals`, `lookups`.

## Notes & caveats
- Requests use the **legacy gateway paths** so they can exercise the real UAT system during migration. Known paths are exact (e.g., `/employee/leave/apply`, `/employee/phone/update`); operations whose URL was not explicit in the source are marked **`[path TBD]`** in the request name and point at the best-inferred path.
- POST bodies use the exact sample bodies from the mapping where available (e.g., Leave apply ~50 fields, Phone update), otherwise a representative skeleton.
- LOV/master-lookup operations use the generic `/data/lovlookup?Lovname=...` and `/data/masterlookup?lookupname=...` endpoints.
- Example responses from the mapping are embedded on key requests; responses share the Sanaad envelope (`status`, `opstatus`/`successflag`, `errormessage`, `httpStatusCode`).

## Regeneration
When the NestJS backend exists, enable OpenAPI (`@nestjs/swagger`) and generate/refresh this collection from the live spec; keep folder-by-module organization.

## Cross-references
`Docs Project/API/README.md`, `Docs Project/Legacy APIs/README.md`.
