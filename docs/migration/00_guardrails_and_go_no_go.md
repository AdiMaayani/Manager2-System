# Postgres Migration - Phase 0 Guardrails and Go/No-Go

Authoritative guardrails for the SQL Server -> PostgreSQL migration
(service-refactor + phased dual-run strategy). This document governs every later
phase. If any later step conflicts with these guardrails, the guardrails win.

## Non-negotiable safety rules

- SQL Server remains the single source of truth until the cutover gate (Phase 5) passes.
- No production traffic is served from PostgreSQL until read parity AND write parity gates pass.
- Every write path stays transactional and idempotent. Never split a previously
  atomic stored-procedure transaction into multiple non-atomic C# calls.
- API HTTP contracts (routes, DTO shapes, status codes, error message body) must not
  change during migration. The frontend must not require changes to talk to either provider.
- No destructive database operation runs without an explicit, separately approved change window.
- Never execute `igroup30_prod.sql`.

## Business invariants that MUST be preserved

| Domain | Invariant |
|---|---|
| Work reports | `Status` stays the Hebrew business workflow value; `LifecycleStatus` independently controls Draft/Finalized/Reversed. |
| Inventory | Finalization is transactional, idempotent, never yields negative stock, one movement per line/type. |
| Reports lifecycle | Report inventory/attachments editable only while `LifecycleStatus='Draft'`. |
| Smart assignment | Draft recommendation never overwrites a manual assignment. |
| Auth | PBKDF2-SHA256 password hashing and login lockout semantics unchanged. |
| Timezone | Planned datetimes remain UTC end to end. |

## Provider selection flags (runtime configuration)

Config section `DataProvider` (see `appsettings.json`):

| Flag | Values | Meaning |
|---|---|---|
| `Primary` | `SqlServer` \| `Postgres` | Authoritative provider that serves the response. |
| `ShadowReadPostgres` | `true`/`false` | On reads, also query Postgres and compare (no effect on response). |
| `DualWritePostgres` | `true`/`false` | On writes, also write to Postgres (best-effort, never fails the primary). |

Legal combinations during migration:

1. Baseline: `Primary=SqlServer`, both shadow flags `false`.
2. Read validation: `Primary=SqlServer`, `ShadowReadPostgres=true`.
3. Write validation: `Primary=SqlServer`, `ShadowReadPostgres=true`, `DualWritePostgres=true`.
4. Cutover: `Primary=Postgres` (SQL Server standby, rollback-ready).

Illegal during migration: `Primary=Postgres` with unfinished parity scorecard.

## Go/No-Go gate per domain wave

A domain wave may advance only when ALL are true:

- [ ] Postgres schema objects for the domain exist and pass the schema validation script.
- [ ] Provider-agnostic repository contract tests pass on BOTH providers.
- [ ] Endpoint snapshot tests match byte-for-byte (after normalization) across providers.
- [ ] Shadow-read drift rate over the observation window is 0 critical mismatches.
- [ ] Concurrency/transaction tests pass (mandatory for Reports + Inventory waves).
- [ ] Rollback for the wave is documented and rehearsed.

## Global cutover gate (Phase 5)

- [ ] Every domain wave has a completed parity scorecard (see `20_parity_contract_template.md`).
- [ ] Full-database data validation (row counts, checksums, business predicates) passes.
- [ ] Load + concurrency test on Postgres meets latency and correctness targets.
- [ ] Backups taken; rollback rehearsal completed within the last change window.
- [ ] Stakeholder sign-off recorded.

## Explicit out-of-scope for the coding agent (human-operator actions)

These require running databases, production infrastructure, or Git and are performed by the operator, not the agent:

- Executing any SQL against a real database (schema apply, migrations, seeds).
- Running the dual-run against production-like traffic.
- The cutover switch and SQL Server decommission.
- All Git operations (branching, commit, merge).
