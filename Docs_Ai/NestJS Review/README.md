# NestJS Best-Practices — Target Conventions

> Reframed as **conventions the new project must adopt** (no code to audit yet). Each item states the rule and how it applies to the Sanaad/Oracle-wrap design.

## 1. Module organization
- **Feature-first modules** (14), plus global `core` (config, oracle, auth, http, i18n) and `shared`. See Project Structure.
- Each module exposes a minimal public surface via `index.ts`; feature modules never import each other.
- Register global concerns once (`OracleModule`, `ConfigModule` as `@Global()`).

## 2. Dependency Injection
- Depend on **abstractions**: inject repository **interfaces** through DI tokens (`Symbol('LEAVE_REPOSITORY')`), bind Oracle impl in the module provider list.
- Prefer constructor injection; avoid `moduleRef.get()` service-locator except in truly dynamic cases.
- Keep providers **stateless**; the only shared state is the Oracle pool inside `OracleService`.

## 3. Provider scopes
- Default **singleton** scope everywhere for performance (pool reuse).
- Avoid `Scope.REQUEST` on data services (kills pool efficiency). If per-request context (user, lang, correlationId) is needed, pass it explicitly or use a lightweight `AsyncLocalStorage` context, not request-scoped providers.

## 4. Configuration management
- `@nestjs/config` with a **validated schema** (Joi/zod): `ORACLE_DSN`, `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_POOL_MIN/MAX`, `JWT_*`, `GATEWAY_BASE_URL`, `CERNER_BASE_URL`.
- No secrets in code or Git; provide `.env.example`. Fail fast on missing/invalid env at boot.

## 5. Validation & pipes
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Every request body/query has a DTO with `class-validator` decorators; enums for `lang`, `lovname`, `payslipperiod`, etc.
- Coerce/validate the URL-encoded Arabic inputs and date formats (`19000101`, `January 2024`) explicitly.

## 6. Exception handling & filters
- `AllExceptionsFilter` (last resort) + `OracleExceptionFilter` mapping `ORA-#####` to HTTP + Sanaad error envelope.
- Throw `HttpException` subclasses from services; never return ad-hoc error objects.
- Distinguish **empty result** (e.g., `ORA-01403: no data found`) from real failure per legacy behavior.

## 7. Interceptors
- `ResponseInterceptor` → wraps success payloads in `{ result, opstatus:0, status:'success', httpStatusCode }`.
- `LoggingInterceptor` → method, path, user, duration, status, correlationId.
- `TimeoutInterceptor` → guard against slow Oracle calls.

## 8. Guards & authorization
- Global `JwtAuthGuard`; `@Public()` for login (op 1) and any unauthenticated LOVs (if applicable).
- `RolesGuard` + `@Roles('APPROVER'|'SUPERVISOR')` for approver/worklist ops (20–23, 68–71) and supervisor view/update (35, 36).
- Resolve the acting employee via `@CurrentUser()`; do not trust `enum`/`username` from the query when a token identity exists.

## 9. Middleware
- Correlation-id middleware (generate/propagate `x-correlation-id`).
- `helmet`, `compression` at bootstrap.

## 10. Custom decorators
- `@CurrentUser()`, `@Roles()`, `@Public()`, `@Lang()` (resolves `en|ar`).
- Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiOkResponse`) on every route.

## 11. Logging
- Structured JSON logs (`nestjs-pino`), correlation-id per request, no PII/secret leakage (mask QID, phone, tokens).
- Log Oracle object name + duration for each repository call (aids migration/perf tuning).

## 12. Environment management
- Separate `.env` per environment (UAT `apigwuat`, PROD `apigw`); the gateway base differs.
- Health endpoints: `/health/live`, `/health/ready` (ready = Oracle pool ping).

## 13. Async programming
- All repository/service methods `async` with `await`; never mix callbacks.
- Bounded Oracle pool + `TimeoutInterceptor`; use `Promise.all` for independent LOV fetches (e.g., LetterReqLOV op 16 fans out to 6 LOVs → parallelize).

## 14. Error handling discipline
- Central error-code catalog in `shared/constants/error-codes.ts`.
- Map known `ORA-` codes; unknown Oracle errors → 500 with correlationId, full detail logged (not returned).

## 15. Documentation & testing
- OpenAPI generated from decorators; keep it the contract.
- Unit-test **mappers** and **services** (mock repositories); e2e-test controllers with a mocked `OracleService`.

## Priority recommendations
1. **Token-based repository DI** from day one — it is the backbone of the Oracle-wrap + testability.
2. **Global envelope + ORA filter** early — 40+ read ops share the exact same success/error shape.
3. **Central `oracle-objects.ts` / `lov-names.ts`** constants — 87 Oracle objects; avoid magic strings.
4. **`dependency-cruiser` in CI** — protect the layer/module boundaries described in Layers & Dependencies.

## Cross-references
`Docs Project/Architecture/README.md`, `Docs Project/SOLID Review/README.md`, `Docs Project/Layers/README.md`.
