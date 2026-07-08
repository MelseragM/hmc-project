# Project Structure — Target NestJS Backend (Sanaad B2E)

> Forward-design blueprint for the folder/module layout of the new NestJS backend that re-exposes the 71 Sanaad operations while **wrapping the existing Oracle views/stored procedures**. There is no existing code; this defines the target the implementation must follow.

## Guiding principles
- **Feature-first modules** (one NestJS module per bounded context) instead of technical-type folders.
- **Clean Architecture layering inside each module**: `domain` → `application` → `infrastructure` → `interface (http)`.
- **Thin Oracle repositories**: business logic stays in Oracle (`_PR`/`_PKG`); repositories only call views/SPs and map rows to domain objects.
- **Shared kernel** for cross-cutting concerns (config, oracle connection pool, auth, lookups, response envelope, i18n, logging, errors).

## Directory tree

```text
HMC_BackEnd/
├── src/
│   ├── main.ts                       # bootstrap: global pipes, filters, interceptors, Swagger
│   ├── app.module.ts                 # root module: imports all feature + core modules
│   │
│   ├── core/                         # framework-level cross-cutting (no business logic)
│   │   ├── config/                   # @nestjs/config schemas (env validation via Joi/zod)
│   │   │   ├── configuration.ts
│   │   │   └── env.validation.ts
│   │   ├── database/                 # Oracle connection pool + base repository
│   │   │   ├── oracle.module.ts      # global module exposing OracleService
│   │   │   ├── oracle.service.ts     # node-oracledb pool, execute(), executeProc()
│   │   │   └── base.repository.ts    # helpers: bindings, row mapping, cursor -> array
│   │   ├── http/                     # global filters/interceptors/pipes
│   │   │   ├── all-exceptions.filter.ts
│   │   │   ├── oracle-exception.filter.ts   # maps ORA-xxxxx -> HTTP
│   │   │   ├── response.interceptor.ts      # wraps payload in Sanaad envelope
│   │   │   ├── logging.interceptor.ts
│   │   │   └── timeout.interceptor.ts
│   │   ├── auth/                     # JWT/bearer guard, @CurrentUser, @Public, roles
│   │   │   ├── auth.module.ts
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── decorators/ (current-user.decorator.ts, roles.decorator.ts, public.decorator.ts)
│   │   └── i18n/                     # lang=en|ar resolution + URL-decode helpers
│   │
│   ├── shared/                       # reusable, domain-agnostic building blocks
│   │   ├── dto/ (pagination.dto.ts, lang-query.dto.ts, envelope.dto.ts)
│   │   ├── constants/ (oracle-objects.ts, lov-names.ts, error-codes.ts)
│   │   ├── utils/ (url-decode.util.ts, date.util.ts, mapper.util.ts)
│   │   └── interfaces/ (sanaad-response.interface.ts)
│   │
│   ├── lookups/                      # shared LOV/master-lookup module (ops 15, 26, generic lovlookup)
│   │   ├── lookups.module.ts
│   │   ├── interface/lookups.controller.ts        # GET /data/lovlookup, /data/masterlookup
│   │   ├── application/lookups.service.ts
│   │   └── infrastructure/lookups.repository.ts   # generic view/LOV reader
│   │
│   └── modules/                      # one folder per bounded context (feature module)
│       ├── auth/                     # op 1
│       ├── profile/                  # ops 2, 48, 63
│       ├── employee/                 # ops 3, 7, 8, 35, 36
│       ├── payslip/                  # ops 5, 6, 11
│       ├── leave/                    # ops 9,10,12,13,14,45,46,47,55,56,57,58,61,62
│       ├── letters/                  # ops 16, 17
│       ├── identity/                 # ops 18,19,53b,54,59,60
│       ├── contact/                  # ops 25,27,28,29,30,32
│       ├── dependents/               # ops 24,31,33,34,49,64,65
│       ├── school-fees/              # ops 37,38,39,40,50,51,52,53
│       ├── appointments/             # ops 41,42,43,44 (Cerner)
│       ├── annual-ticket/            # ops 66,67
│       └── approvals/                # ops 20,21,22,23,68,69,70,71
│
├── test/                            # e2e specs
├── .env.example
├── nest-cli.json
├── tsconfig.json
├── package.json
└── README.md
```

## Anatomy of one feature module

Each module under `src/modules/<name>/` follows the same internal Clean-Architecture shape:

```text
modules/leave/
├── leave.module.ts                      # wires controllers + providers + repo bindings
├── interface/                           # Presentation layer (HTTP)
│   ├── leave.controller.ts              # routes, Swagger, guards, DTO validation
│   └── dto/
│       ├── apply-leave.request.dto.ts
│       ├── leave-balance.query.dto.ts
│       └── leave-balance.response.dto.ts
├── application/                         # Application layer (use cases / orchestration)
│   ├── leave.service.ts                 # orchestrates repos, mapping, envelope
│   └── use-cases/ (apply-leave.usecase.ts, get-balance.usecase.ts …)
├── domain/                              # Domain layer (framework-free)
│   ├── entities/ (leave-request.entity.ts)
│   ├── value-objects/ (leave-period.vo.ts)
│   └── repositories/ (leave.repository.ts  = interface/port)
└── infrastructure/                      # Infrastructure layer (Oracle adapters)
    └── oracle/
        ├── leave.oracle.repository.ts   # implements domain port; calls XXHMC_SND_* SP/view
        └── mappers/ (leave.mapper.ts)    # Oracle row <-> domain/DTO
```

## Folder responsibilities

| Folder | Layer | Responsibility |
|---|---|---|
| `core/config` | Infrastructure | Typed, validated env configuration (DB DSN, gateway base URL, JWT secret). |
| `core/database` | Infrastructure | Single `node-oracledb` pool; low-level `execute`/`executeProc`; ref-cursor handling. |
| `core/http` | Presentation (global) | Exception filters (incl. `ORA-` mapping), response envelope, logging, timeout. |
| `core/auth` | Presentation/App | JWT/bearer verification, `RolesGuard`, `@CurrentUser`, `@Public`. |
| `core/i18n` | Cross-cutting | `lang` resolution and URL-decode of Arabic values. |
| `shared/*` | Cross-cutting | DTO bases, constants (`oracle-objects.ts`, `lov-names.ts`), pure utils, interfaces. |
| `lookups/*` | Feature (shared) | Generic `/data/lovlookup` + `/data/masterlookup` backed by any `_LOV`/`_V`. |
| `modules/<name>/interface` | Presentation | Controllers, route DTOs, validation, Swagger, guards. |
| `modules/<name>/application` | Application | Use cases, transaction boundaries, cross-repo orchestration, mapping to envelope. |
| `modules/<name>/domain` | Domain | Entities, value objects, **repository interfaces (ports)** — no NestJS/Oracle imports. |
| `modules/<name>/infrastructure` | Infrastructure | Oracle repository implementations + row/DTO mappers. |

## Naming conventions
- Files: `kebab-case.<role>.ts` (`apply-leave.request.dto.ts`, `leave.oracle.repository.ts`).
- Providers bound by token: `provide: LEAVE_REPOSITORY` (Symbol) → `useClass: LeaveOracleRepository` so the domain depends on the interface, not the Oracle class.
- Oracle object names centralized in `shared/constants/oracle-objects.ts` (never hard-coded in services).

## Why feature-first (not `controllers/ services/ repositories/`)
- Keeps each of the 14 bounded contexts independently understandable and testable.
- Localizes change: adding a leave endpoint touches only `modules/leave`.
- Prevents the "god service" anti-pattern and cyclic imports between technical layers.

## Cross-references
- Layer rules: `Docs Project/Layers/README.md`
- Module dependencies: `Docs Project/Dependencies/README.md`
- Domain breakdown: `Docs Project/Domains/README.md`
- Oracle wrapping: `Docs Project/Repository Pattern/README.md`
