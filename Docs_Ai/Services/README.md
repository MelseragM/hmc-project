# Service Layer — Target Design

> Application-layer services for the new NestJS backend. Each orchestrates domain repositories, maps to the Sanaad envelope, and holds **no SQL**. Reframed as target design (no code yet). "Complexity" = relative implementation effort/branching.

## Design rules
- One **application service per module** (may delegate to per-use-case classes for the largest, e.g., Leave).
- Services depend on **repository ports** (tokens), never on Oracle classes.
- Services are **stateless singletons**; per-request data (user, lang) passed as args.
- Cross-cutting shaping (envelope, logging, errors) is handled by interceptors/filters — services return domain/DTO models.

## Service catalog

| Module | Service(s) | Public methods (→ op) | Depends on | Complexity | Reusability |
|---|---|---|---|---|---|
| auth | `AuthService` | `login`(1), `me` | core/auth, `ProfileRepository` | Med (pending spec) | High (identity used app-wide) |
| profile | `ProfileService` | `get`(2), `updatePersonal`(48), `maritalStatusLov`(63) | `ProfileRepository`, `LovRepository` | Med (large read assembly) | High |
| employee | `EmployeeService`, `SupervisorService` | `employment`(3), `basic`(8), `performance`(7); `views`(35), `update`(36) | `EmploymentRepository`, `SupervisorRepository` | Low–Med | High (employment context) |
| payslip | `PayslipService` | `getPeriods`(5), `checkCount`(6), `generate`(11) | `PayslipRepository` | Low | Med |
| leave | `LeaveService` + use-cases | `getBalance`(9), `apply`(10), `calculate`(47), `amend`(57), `cancel`(58), `returnFromLeave`(56), `getTypes/Reasons/Classes`(12–14), `getDefaults`(45), `getRequestLov`(46), `returnLov`(55), `cancelLov`(61), `amendLov`(62) | 7 leave ports, `LovRepository`, employment context | **High** | Med |
| letters | `LettersService` | `getLetterLovs`(16), `submit`(17) | `LetterRepository` | Med (6-way LOV fan-out) | Med |
| identity | `QidService`, `IdCardService` | `getQid`(18), `updateQid`(19); `requestCompanyId`(54), `workLocLov`(53b), `deliveryLov`(59), `reasonLov`(60) | `QidRepository`, `IdCardRepository`, `LovRepository` | Med | Med |
| contact | `PhoneService`, `AddressService` | `phoneTypeLov`(27), `upsertPhone`(28), `deletePhone`(32); `createAddress`(29), `updateAddress`(25), `countryLov`(30) | `PhoneRepository`, `AddressRepository`, `LovRepository` | Med | High (shared w/ profile, dependents) |
| dependents | `DependentService`, `PassportService` | `add`(65), `update`(24), `delete`(31), `dependentLov`(64); `passportTypes`(33), `passportApply`(34), `issuePlaceLov`(49) | `DependentRepository`, `PassportRepository`, `AddressRepository`, `LovRepository` | Med–High (add composes address) | Med |
| school-fees | `SchoolFeeService` | `apply`(39), `schoolsLov`(37), `termsLov`(38), `eduStageLov`(40), `academicYearLov`(50), `requestTypeLov`(53), `children`(52) | `SchoolFeeRepository`, `LovRepository` | Med | Med |
| appointments | `AppointmentsService` | `getUpcoming`(41), `getMasters`(42), `initBooking`(43), `book`(44) | `AppointmentsRepository`, `CernerClient` | Med–High (external ACL) | Low |
| annual-ticket | `AnnualTicketService` | `master`(66), `apply`(67) | `TicketRepository`, employment context | Low | Low |
| approvals | `ApprovalsService`, `WorklistService` | `summary`(20), `details`(21), `decision`(22), `myRequests`(23); `worklist`(68), `worklistSummary`(69), `history`(70), `reassign`(71) | `ApprovalsRepository`, `WorklistRepository` | **High** (workflow) | Med |
| lookups | `LookupsService` | `getLov`, `getMaster`, `yesNo`(15), `rfmiUser`(26) | `LovRepository` | Low | **Very High** (shared kernel) |

## Business logic ownership
Because Oracle `_PR`/`_PKG` procedures own the transactional rules, NestJS services primarily:
1. **Assemble/fan-out reads** (e.g., Profile op 2 stitches 6 views; LetterReqLOV op 16 fans out to 6 LOVs — parallelize with `Promise.all`).
2. **Build typed commands** for submits (e.g., `ApplyLeaveCommand` → ~50 binds).
3. **Map** Oracle output + decode Arabic into DTOs.
4. **Enforce transport-level policy** (auth, roles, validation) — not domain invariants.

## Services to split / refactor (proactive)
- **`LeaveService` → per-use-case classes.** 14 operations and a 50-param submit; split into `ApplyLeaveUseCase`, `AmendLeaveUseCase`, `CancelLeaveUseCase`, `ReturnFromLeaveUseCase`, `GetLeaveBalanceUseCase`, `LeaveLovService`. Keeps SRP; avoids a 500-line service.
- **`ApprovalsService` vs `WorklistService`.** Already split; keep decision/routing (`APPROVE_REJECT_PR`, `REASSIGN_PR`) separate from read-only worklist/history.
- **LOV logic → `LookupsService`.** Do **not** reimplement LOV reads in each feature service; call the shared kernel with a `LovName`. Feature services expose thin pass-throughs only where the route is domain-branded (e.g., `/leave/lov/types`).
- **Address composition** shared by `dependents.add` (op 65 uses `CREATE_ADDRESS_PR`) and `contact` — extract `AddressService` and reuse; avoid duplicating address binds.
- **Employment context** (`EMPLOYMENT_DETAILS_V`) needed by leave (45,46) and annual-ticket → expose a small `EmployeeContextService` read model instead of cross-importing repos.

## Reusability guidance
- Envelope, pagination, and `SubmitResult` mapping are **shared utilities**, not per-service code.
- `LookupsService` is the most reused; design its registry (`LOV_OBJECT`) to be the only place LOV→Oracle names live.

## Cross-references
`Docs Project/Repository Pattern/README.md`, `Docs Project/Domains/README.md`, `Docs Project/API/README.md`.
