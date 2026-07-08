# SOLID Review — Target Design Guidelines

> No existing code to audit, so each principle is given as a **design rule + concrete example** for the Sanaad NestJS/Oracle-wrap backend, plus the anti-pattern to avoid.

## S — Single Responsibility
**Rule:** one reason to change per class. Controllers do HTTP, services orchestrate, repositories talk to Oracle, mappers translate.

```ts
// GOOD: each class one job
class LeaveController { constructor(private readonly leave: LeaveService) {} }
class LeaveService   { constructor(@Inject(LEAVE_REPOSITORY) private readonly repo: LeaveRepository) {} }
class LeaveOracleRepository implements LeaveRepository { constructor(private readonly ora: OracleService) {} }
class LeaveMapper { toDomain(row): LeaveRequest {/*...*/} }
```
**Avoid:** a `LeaveService` that builds SQL, decodes Arabic, and shapes the HTTP envelope.

## O — Open/Closed
**Rule:** extend without modifying. New LOVs or operations are added via configuration/new providers, not by editing a switch.

```ts
// GOOD: generic LOV reader driven by a registry (open for new LOVs)
@Injectable() class LookupsService {
  constructor(@Inject(LOV_REPOSITORY) private repo: LovRepository) {}
  get(lovName: LovName, lang: Lang) { return this.repo.readLov(LOV_OBJECT[lovName], lang); }
}
```
**Avoid:** `switch(lovName){ case 'COUNTRY_LOV': ... }` edited for every one of the 25+ LOVs.

## L — Liskov Substitution
**Rule:** any implementation of a domain port must honor its contract. A `FakeLeaveRepository` (tests) and `LeaveOracleRepository` (prod) are interchangeable behind `LeaveRepository`.
- Contracts specify: empty result semantics (Oracle `ORA-01403` → empty list, not throw), and `SubmitResult` shape for `_PR` calls.
**Avoid:** an adapter that throws where the interface promises an empty result, breaking callers.

## I — Interface Segregation
**Rule:** small, focused ports. Do not force a fat `IEmployeeRepository` with 20 methods on consumers that need one.

```ts
interface LeaveBalanceRepository { getBalance(emp: string, plan: string, lang: Lang): Promise<LeaveBalance[]>; }
interface LeaveApplyRepository   { apply(cmd: ApplyLeaveCommand): Promise<SubmitResult>; }
// LeaveOracleRepository may implement both, but consumers depend on the slice they use.
```
**Avoid:** one `SanaadRepository` covering all 87 Oracle objects.

## D — Dependency Inversion
**Rule:** high-level (services) and low-level (Oracle adapters) both depend on **abstractions** (domain ports). Wire with DI tokens.

```ts
// module
providers: [ LeaveService, { provide: LEAVE_REPOSITORY, useClass: LeaveOracleRepository } ]
// service depends on the token/interface, not the Oracle class
constructor(@Inject(LEAVE_REPOSITORY) private readonly repo: LeaveRepository) {}
```
**Avoid:** `new LeaveOracleRepository()` or importing `oracledb` inside a service.

## How SOLID maps to the Oracle-wrap design
| Principle | Primary payoff here |
|---|---|
| SRP | Isolates Oracle-specific bind/mapping from transport & orchestration. |
| OCP | 25+ LOVs and future operations added via registry/providers, not edits. |
| LSP | Enables fast unit tests with fake repos; safe future swap of data source. |
| ISP | Prevents a monolithic repository across 87 objects. |
| DIP | The core enabler of "wrap Oracle now, replace later" without touching services. |

## Recommendation
Adopt these as **PR review checklist** items and back them with `dependency-cruiser` boundary rules (see Dependencies). The single highest-leverage rule is **DIP via repository tokens** — everything else in the Oracle-wrap strategy depends on it.

## Cross-references
`Docs Project/Layers/README.md`, `Docs Project/Repository Pattern/README.md`, `Docs Project/NestJS Review/README.md`.
