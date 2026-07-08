# Sanaad → NestJS Docs — Progress Checklist

Tracking the forward-design documentation build. Source of truth: `Docs Project/sanaad-api-service-mapping.html` (v1.9).

## Phases
- [x] **Phase 0** — Master operation inventory (`Docs_Ai/operation-inventory.md`) + this checklist
- [x] **Phase 1** — Foundations: Project Structure, Architecture, Layers, Dependencies, NestJS Review, SOLID Review
- [x] **Phase 2** — Domains (DDD)
- [x] **Phase 3** — API catalog, Legacy APIs mapping, Services, Repository Pattern
- [x] **Phase 4** — Database catalog (+ Mermaid ER), Postman collection/env/README
- [x] **Phase 5** — `Docs Project/README.md` index + cross-link/consistency pass

## Target deliverables (folders under `Docs Project/`)
- [x] `Architecture/` — NestJS building blocks + request flow
- [x] `API/` — endpoint catalog by module
- [x] `Database/` — Oracle object catalog + ER/data-flow diagrams
- [x] `Dependencies/` — module dependency graph + external packages
- [x] `Domains/` — DDD bounded contexts
- [x] `Layers/` — Clean Architecture layers
- [x] `Legacy APIs/` — per-operation migration mapping
- [x] `NestJS Review/` — best-practice conventions
- [x] `Postman/` — collection.json + environment.json + README
- [x] `Project Structure/` — folder tree + responsibilities
- [x] `Repository Pattern/` — thin Oracle repositories
- [x] `Services/` — service layer design
- [x] `SOLID Review/` — SOLID design guidelines
- [x] `README.md` — top-level index (tie-together)

## Key facts locked
- Stack: **NestJS + TypeScript**; persistence = **wrap existing Oracle views/SPs** via `node-oracledb`.
- 71 operations, 14 proposed modules, 87 Oracle objects, UAT base `https://apigwuat.api.hamad.qa/sanaad`.
- Open: Login/auth spec (out-of-band), roles/permissions (inferred from approval flows), exact POST paths for `*_PR` ops (inferred).
