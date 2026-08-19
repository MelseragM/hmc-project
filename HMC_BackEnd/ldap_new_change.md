# HMC_BackEnd — New auth flow: local Users DB as the only identity source + DB-backed OTP/MPIN

Replace the current LDAP-only, stub-backed onboarding/login flow with: look users up in an existing "all users" database — the **only** identity source; a username not found there is rejected outright (**no Azure Entra ID / no directory calls at all**) — store OTPs and MPINs in that same database, send the OTP to first-time users **via an SMS API**, and let existing users log in with their stored MPIN without any directory round-trip.

## Decisions confirmed with user

1. **Users DB scope**: an **existing** corporate users database — HMC_BackEnd will get **write access** too (not read-only), so it can also persist MPIN/OTP/device records there (not a brand-new schema, not a separate Oracle table off to the side, and not read-only-with-a-second-store).
2. **No directory calls** (revised): Azure Entra ID is **dropped from this plan entirely** — no adapter, no `@azure/msal-node` dependency, no `AZURE_*` config. The existing `LdapUserPort`/`LdapUserRepository` (`src/modules/auth/infrastructure/adapters/ldap-user.repository.ts`) stays untouched in the codebase but is **not called** by this flow. A username not found in the Users DB is rejected outright (`Invalid employee id received.`); there is **no directory fallback and no app-side user provisioning**.
3. **OTP delivery mechanism** (revised — now decided): **SMS via an API**. When a first-time user (row in the Users DB with no MPIN yet) initiates, the backend generates an OTP, stores its **hash** in the Users DB, and calls an SMS gateway API to deliver the raw OTP to the user's phone number (taken from their Users DB row). Same mechanism for forgot-MPIN (API-6).
4. **Device binding**: **stays in scope**, per the existing `DeviceRegistryPort` scaffolding (`src/modules/auth/domain/ports/device-registry.port.ts`) — continue tracking username↔device (IMEI) trust and use it for new-device detection, backed by the same Users DB instead of the current 501 stub.
5. **New-user signal** (revised): "new user" = a Users DB row that **exists but has no MPIN hash yet** (`isVerified=false`). User rows themselves are provisioned into the Users DB by an external process, never by HMC_BackEnd.

## Current architecture (confirmed by reading the code)

Hexagonal ports/adapters under `src/modules/auth/`:
- `domain/ports/{ldap-user,otp,mpin-store,device-registry,function-access}.port.ts` — interfaces.
- `infrastructure/adapters/` — `LdapUserRepository` (real, `ldapts`) is the only non-stub adapter; `OtpStubRepository`, `MpinStoreStubRepository`, `DeviceRegistryStubRepository`, `FunctionAccessStubRepository` all throw `NotImplementedException` (501) in production and are bypassed by a `devBypass` flag (`AUTH_DISABLED=true` or non-production) inside each application service.
- `application/{onboarding,auth,mpin}.service.ts` — orchestrate API-2/3 (`OnboardingService`), API-5 (`AuthService`), API-4/6/7 (`MpinService`). Each independently computes the same `devBypass` from `ConfigService`.
- `infrastructure/mpin.hasher.ts` — **already implemented**, unused today: `MpinHasher.hash`/`verify` using Node's built-in `scrypt` (`scrypt$<saltHex>$<hashHex>`). Reusable as-is for MPIN storage in the new flow; can also model OTP-at-rest hashing the same way.
- `domain/auth-identity.ts` — framework-free `EmployeeIdentity`/`FunctionAccess` types shared by all adapters/services.
- `core/audit/audit-event.ts` — `AuthLifecycleEvent` enum (already has `USER_VALIDATE_SUCCESS/FAILURE`, `OTP_SENT/VALIDATED/FAILED`, `MPIN_SET/RESET`, `LOGIN_SUCCESS/FAILURE`, `ACCOUNT_LOCK`) and `SecurityIncident` (`EXCESSIVE_OTP_REQUESTS`, `REPEATED_LOGIN_FAILURES`, `DEVICE_SPOOFING`, `TOKEN_TAMPERING`) — reuse, no new taxonomy needed.
- Controllers/DTOs (`interface/{auth,onboarding,mpin}.controller.ts` + `dto/`) are the mobile-facing contract (API-1..7) and **do not need to change** — this is purely a backing-store/identity-source swap behind the same endpoints.
- Only Oracle (`core/database/oracle.module.ts`, `oracledb`) is wired as a DB client today; no generic SQL client exists yet for a second database.
- `EventEmitterModule.forRoot()` is registered globally in `core.module.ts` but nothing emits or listens today — can be used for an audit-only `otp.requested` event alongside the direct SMS call.
- No SMS-gateway client exists yet; `@nestjs/axios` is already a dependency and is the natural HTTP client for the new SMS adapter.

## New flow (target behavior)

**API-2 `POST /auth/initiate` (User Validate) — `OnboardingService.validateUser`:**
1. `UserDirectoryPort.findByUsername(username)` against the Users DB.
2. **Not found** → `{ status: 'error', message: 'Invalid employee id received.' }` (unchanged contract). **No directory call, no fallback, no provisioning** — user rows come from an external process, never from this app.
3. **Found, has an MPIN** (`mpinHash` set / `isVerified=true`) → existing user. Return `newuser: 'No'` (+ cached profile fields from the local row). No OTP. Mobile shows the MPIN entry screen and calls API-5 directly.
4. **Found, no MPIN yet** → first-time user. Generate an OTP, hash + store it as an OTP row (expiry + attempt counter) in the Users DB, **send the raw OTP by SMS** via the SMS gateway API (`OtpDeliveryPort`, phone number from the user's DB row), optionally emit an audit-only `otp.requested` event (payload without the raw OTP) via `EventEmitter2`, return `newuser: 'Yes'` + `requestid`.

**API-3 `POST /auth/otp/validate` — `OnboardingService.validateOtp`:** verify the submitted OTP against the stored (hashed) OTP row for that `requestid`/username (check expiry + attempt counter, lock out after N failed attempts using existing `SecurityIncident.EXCESSIVE_OTP_REQUESTS`), mark the OTP row consumed on success. Same response contract.

**API-4 `POST /auth/mpin/update` (Set MPIN, first-time) — `MpinService.setMpin`:** requires a prior validated OTP for that user (design choice: check the last-consumed OTP row for this username+imei is fresh, or require the client to resubmit `requestid` — TBD, see open question below); hash the MPIN with the existing `MpinHasher` and **write it to the user's row**, mark `isVerified=true`; bind the device (`DeviceRegistryPort`, same DB).

**API-5 `POST /auth/login` — `AuthService.login`:** look up the user row directly by username, verify MPIN with `MpinHasher.verify` against the stored hash (no LDAP, no directory call) — this is the "login using the MPIN already stored" path. Resolve `EmployeeIdentity` fields straight from the cached row (no directory round-trip). `FunctionAccessPort` unchanged (still pending its own spec — separate from this effort).

**API-6/7 (Forgot/Reset MPIN) — `MpinService.forgotInitiate`/`resetMpin`:** same OTP generate/store/SMS-send/verify against the Users DB as API-2/3 (same `OtpDeliveryPort` SMS call), then overwrite the stored MPIN hash.

## New/changed components

**New ports** (`src/modules/auth/domain/ports/`):
- `user-directory.port.ts` — `UserDirectoryPort`: `findByUsername(username): Promise<LocalUserRecord | null>`, `setMpinHash(username, hash): Promise<void>`, `verifyMpin(username, mpin): Promise<boolean>` (delegates to `MpinHasher` internally), `markVerified(username): Promise<void>`. **No `create()`** — the app never provisions user rows; they arrive via an external process. This effectively **absorbs** what `MpinStorePort` was going to do — plan is to keep `MpinStorePort` as a thin wrapper delegating to the same adapter (so `MpinService`/`AuthService` don't need constructor changes), OR fold `MpinStorePort` into `UserDirectoryPort` directly and update the two services' injections. **Recommend the latter** (one port, one adapter, less indirection) — flagged as a decision to confirm during implementation, not blocking this plan.
- `otp-store.port.ts` (replaces the storage half of today's `OtpPort`) — `create(cmd): Promise<{requestId, otp}>` (otp generated server-side, hashed before storage — never store plaintext), `verify(cmd): Promise<boolean>`, `markConsumed(requestId): Promise<void>`. The **delivery** half moves to `OtpDeliveryPort` below.
- `otp-delivery.port.ts` — `OtpDeliveryPort`: `sendOtpSms(phone, otp, purpose): Promise<void>` — called by the services right after `OtpStorePort.create`; the raw OTP goes only to this port (and is never logged or stored in plaintext).

**New adapters** (`src/modules/auth/infrastructure/adapters/`):
- `users-db-directory.repository.ts` (name/engine TBD — see infra questions) — implements `UserDirectoryPort` (or the merged `UserDirectoryPort`) and `OtpStorePort`, `DeviceRegistryPort` against the existing Users DB. **The concrete driver depends on the DB engine infra confirms** (see checklist below):
  - If Oracle → extend the existing `oracledb` pattern (`BaseOracleRepository`-style, new pool or reuse the existing one if it's the *same* Oracle instance as `XXHMC_SND`).
  - If SQL Server → new `mssql` (or `tedious`) dependency + a small pool/module mirroring `core/database/oracle.module.ts`'s shape (config, pool, health-check, diagnostics).
  - If PostgreSQL/MySQL → `pg`/`mysql2` equivalently.
  - Either way, a new `core/database/<engine>.module.ts` sibling to `oracle.module.ts` is the target shape, so `OracleService`-style pooling/timeout/health patterns are reused.
- `sms-otp-delivery.adapter.ts` — implements `OtpDeliveryPort`. Calls the SMS gateway's HTTP API via the existing `@nestjs/axios` (auth/endpoint/payload shape per the gateway infra confirms — see checklist below). Timeout-bounded (`SMS_API_TIMEOUT_MS`); a delivery failure surfaces as an error to the caller (the OTP row already exists, so a retry/resend follows the existing `OTP_RESEND_WINDOW_SECONDS` policy). Never logs the raw OTP or the full phone number (mask all but the last 3-4 digits).

**Service changes:**
- `OnboardingService.validateUser` — swap the `LdapUserPort` call (in the *default*, non-dev-bypass path) for a single `UserDirectoryPort.findByUsername`. Not found → invalid-employee-id error (no directory fallback of any kind). Remove the `MpinStorePort.exists` check for `isNewUser` (`isNewUser` = "the user's DB row has no MPIN hash yet", not "has an MPIN on this device"). For a first-time user: `OtpStorePort.create` → `OtpDeliveryPort.sendOtpSms`.
- `OnboardingService.validateOtp` — swap `OtpPort.verify` (currently 501) for the new `OtpStorePort.verify`.
- `MpinService.setMpin`/`resetMpin` — swap `MpinStorePort.set` for `UserDirectoryPort.setMpinHash`; keep `DeviceRegistryPort.bind` call (now backed by the Users DB adapter instead of the 501 stub).
- `MpinService.forgotInitiate` — swap `OtpPort.send` for `OtpStorePort.create` + `OtpDeliveryPort.sendOtpSms` (optionally also an audit-only `otp.requested` event).
- `AuthService.login` — swap `MpinStorePort.verify` + `LdapUserPort.validate` for a single `UserDirectoryPort.findByUsername` + `MpinHasher.verify`/`UserDirectoryPort.verifyMpin`. Delete the LDAP dependency from this service entirely (LDAP stays wired elsewhere/untouched, just no longer called from login).
- `dev-fallback.ts`/`devBypass` behavior is unchanged — dev bypass continues to synthesize identity and skip all of the above, so local dev without the Users DB/SMS gateway still works exactly as today.

**Config additions** (`core/config/configuration.ts`, `env.validation.ts`, `.env.example`):
- SMS gateway: `SMS_API_BASE_URL`, `SMS_API_KEY` (or `SMS_API_USER`/`SMS_API_PASSWORD` — auth scheme per the gateway), `SMS_SENDER_ID`, `SMS_API_TIMEOUT_MS` (default in line with the existing 25 s call-timeout convention), optional `SMS_MESSAGE_TEMPLATE` (with an `{otp}` placeholder) — exact names finalize once infra confirms the gateway.
- Users DB: engine-dependent — placeholder names `USERS_DB_HOST`, `USERS_DB_PORT`, `USERS_DB_NAME`/`SERVICE_NAME`, `USERS_DB_USER`, `USERS_DB_PASSWORD`, `USERS_DB_POOL_MIN/MAX`, `USERS_DB_CALL_TIMEOUT_MS` — exact shape depends on the confirmed engine.
- OTP policy: reuse existing `OtpConfig` (`OTP_LENGTH`, `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_WINDOW_SECONDS`) already defined in `configuration.ts` — currently unused by any real adapter; the new `OtpStorePort` adapter is the first consumer.

**Audit:** no taxonomy changes needed — reuse `AuthLifecycleEvent`/`SecurityIncident` as-is (`OTP_SENT` now fires when the SMS API call succeeds).

## Open questions to resolve before/during implementation

1. **One port or two?** Fold `MpinStorePort` into the new `UserDirectoryPort`, or keep them separate and have both point at the same adapter? (Recommendation: fold — simpler, but confirm.)
2. **Set-MPIN freshness check**: after OTP validate (API-3) succeeds, API-4 (Set MPIN) is a *separate* call — does the mobile client resubmit the `requestid`, or does the backend need a short-lived "OTP verified" flag/session on the user row to allow API-4 without re-proving the OTP? Current DTOs (`SetMpinRequestDto`) carry no `requestid` today — check with product/mobile team whether the contract should change, or whether we track "otp verified within last N minutes" server-side.
3. **User-row provisioning**: who/what creates rows in the existing "all users" database (HR sync, an existing corporate process)? The app no longer creates them, so a legitimate first-time user who isn't in the DB yet simply cannot onboard — needs an operational owner and a freshness SLA.
4. **Existing-users-DB schema**: do we get to add companion tables (recommended — e.g. `SANAAD_USER_AUTH`, `SANAAD_OTP_REQUESTS`, `SANAAD_DEVICE_BINDINGS`, keyed by whatever unique user identifier the existing table exposes), or must we alter the existing "all users" table directly? Recommend companion tables to avoid touching a table other systems depend on — confirm with infra/DBA.
5. **Phone number source**: which column on the user's Users DB row holds the mobile number for OTP SMS, is it reliably populated/current for all users, and in what format (needs normalizing to the gateway's expected format, e.g. E.164)? A user with a missing/stale phone number cannot receive the OTP.

## Data / access needed from the infrastructure team

### SMS gateway API (OTP delivery)
1. **Which gateway/provider**: the corporate SMS gateway HMC already uses (preferred) or a specific provider — name, API docs, and environment (sandbox vs production) endpoints.
2. **API contract**: base URL, endpoint path, request/response shape (JSON/XML/form), and how delivery success/failure is reported (sync status vs async delivery receipts).
3. **Credentials**: API key / username+password / token — value, rotation policy, and per-environment credentials (dev/test/staging/production).
4. **Sender ID**: the registered sender name/number OTP messages must go out under, and any regulator (CRA) pre-registration/template-approval requirements for OTP content in Qatar.
5. **Network reachability**: outbound HTTPS egress from the app servers to the gateway endpoint (proxy allow-list/firewall), or is it an internal service already reachable?
6. **Rate limits/quotas**: per-second/per-day sending limits and cost model, so the OTP resend window (`OTP_RESEND_WINDOW_SECONDS`) and abuse lockouts can be aligned with them.
7. **Phone number format** the gateway expects (E.164 with/without `+`, local format), to pair with the Users DB phone-column format (open question #5).

### The existing "Users" database
1. **Engine & version** (Oracle / SQL Server / PostgreSQL / MySQL / other) — determines the driver/dependency we add.
2. **Is it the same Oracle instance** already used for `XXHMC_SND_*` views (same host/service, different schema) or a **fully separate server**?
3. **Connectivity**: host, port, database/service name (or connection string), and whether it's reachable directly from this backend's network or requires VPN/bastion/private endpoint — and whether that path is already provisioned.
4. **Service account credentials** with confirmed **write** access (per your answer) — specifically the privilege set needed: `SELECT`/`INSERT`/`UPDATE` at minimum on whatever tables we end up using; `CREATE TABLE` if infra allows us to provision our own companion tables (see open question #4) rather than altering the existing one. Write access covers MPIN/OTP/device-binding/verified-flag data only — the app never inserts user rows into the existing "all users" table.
5. **Existing schema** for the "all users" table: table/column names, the unique key we should match/join on (must correspond to the Sanaad `username`/NT id), data types, and any existing indexes/constraints we must respect.
6. **Confirmation we may add companion tables** (recommended design, open question #4) vs. must alter the existing table in place.
7. **TLS/encryption requirements** for the connection (mandated TLS version, client cert, etc.), and **connection pooling limits** infra wants us to respect (mirroring the existing `ORACLE_POOL_MIN/MAX`-style constraints).
8. **Environments**: matching connection details for dev/test/staging/production, since this is now a hard dependency for the entire auth journey (unlike today, where `AUTH_DISABLED`/dev bypass makes it optional).

## Verification (once implementation starts)

- Unit tests for the new Users DB adapter (mock DB client), the SMS delivery adapter (mock HTTP — assert endpoint/auth/payload, raw OTP and full phone never logged), and updated `OnboardingService`/`AuthService`/`MpinService` (mock the new ports, including "SMS send fails" behavior) — mirroring the existing `devBypass` test-ability.
- Integration/e2e: a dev-bypass path must keep working unauthenticated-DB (`AUTH_DISABLED=true`) for local smoke tests, exactly as documented in `AGENTS.md` today.
- Manual: full journey against a test Users DB + the gateway's sandbox/test endpoint — new user (row exists in DB, no MPIN) → OTP SMS received on a real handset → set MPIN → login; user not in the DB → API-2 returns the invalid-employee-id error (and no outbound directory call is made); existing user (row with MPIN) → login directly with MPIN, no OTP.

## Risks / considerations

- **Users DB coverage/freshness is now the single point of truth** — a legitimate employee missing from the DB (sync lag, new hire) cannot onboard at all and gets "Invalid employee id received."; there is no directory fallback by design. Needs an operational answer (see open question #3: who provisions rows, and how quickly).
- **SMS gateway availability now gates onboarding** — if the gateway is down or throttling, first-time users and forgot-MPIN users cannot complete the journey (existing-user MPIN login is unaffected). Surface a clear retriable error and align resend limits with the gateway's quotas.
- **Missing/stale phone numbers** in the Users DB row mean the OTP never arrives — needs the phone-column confirmation (open question #5) and an operational path for users to correct their number.
- **Existing table mutation risk** — if infra requires altering the existing "all users" table directly (rather than companion tables), that's a shared-system change with blast radius beyond Sanaad; push for companion tables during the infra conversation.
- **Secret management** for the SMS API credentials needs the same handling rigor as `JWT_SECRET`/Oracle credentials today (env-injected in Docker, never committed) — no code should log them, and no log line may contain a raw OTP or an unmasked phone number.
