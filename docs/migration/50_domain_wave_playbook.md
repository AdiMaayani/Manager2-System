# Postgres Migration - Domain Wave Playbook (Phase 3)

Repeatable procedure for migrating one domain. The CompanySettings domain is the implemented
reference; every other domain follows the same shape.

## Reference implementation (already in the repo)

| Piece | File |
|---|---|
| Postgres repository (parameterized SQL, service-refactor) | `apps/api/ManageR2.Infrastructure/Features/Settings/Repositories/PostgresCompanySettingsRepository.cs` |
| Dual-run router (primary + shadow-read + dual-write) | `apps/api/ManageR2.Infrastructure/Features/Settings/Repositories/CompanySettingsRepositoryRouter.cs` |
| DI wiring | `apps/api/ManageR2.Api/Program.cs` (CompanySettings block) |
| Provider abstraction used by the above | `apps/api/ManageR2.Infrastructure/DAL/Providers/` |

## Steps per domain

1. **Schema**: confirm the domain's tables are translated in `database/postgres/schema/` and pass
   `database/postgres/validation/validate_schema.sql`. Mark them Done in `OBJECT_TRACKING.md`.

2. **Postgres repository**: add `Postgres<Domain>Repository` implementing the existing
   `I<Domain>Repository`, using parameterized SQL (via `PostgresConnectionFactory`) against the
   translated tables. Reproduce the behavior of the domain's stored procedures in C# - do NOT port
   them as plpgsql. Preserve business invariants (see `00_guardrails_and_go_no_go.md`).

3. **Router**: add `<Domain>RepositoryRouter` implementing `I<Domain>Repository`. Inject the SQL Server
   repository (concrete) and the Postgres repository (concrete) plus `IProviderConnectionResolver`,
   `IProviderDriftRecorder`, `IPayloadParityComparer`. Route reads/writes exactly like
   `CompanySettingsRepositoryRouter`: primary serves the response; shadow-read compares; dual-write is
   best-effort.

4. **DI**: register both concrete repositories and register the router as the interface.

5. **Contract tests**: add provider-agnostic repository contract tests and run them against both
   providers. Add endpoint snapshot tests for the domain's controllers.

6. **Transactional invariants** (Reports/Inventory waves): add concurrency tests proving idempotent
   finalize/reverse and non-negative stock. The finalize transaction must be a single C# transaction
   spanning all writes.

7. **Shadow validation**: in a production-like environment set `ShadowReadPostgres=true`, replay
   traffic, and drive critical drift to zero (`30_observability_and_drift.md`).

8. **Fill the parity contract** (`20_parity_contract_template.md`) and clear the Go/No-Go gate.

## Wave order (low -> high risk)

1. Settings / lookups (CompanySettings - done as reference).
2. CRUD: Customers, Contacts, Sites, Employees, Users.
3. Projects / Quotes / WorkItems read+write.
4. Reports + Inventory transactional paths (highest risk - do transactional tests first).
5. SmartAssignment (multi-result-set flows reshaped into explicit C# queries/DTOs).

## Guard: a wave never advances until

- Contract + snapshot tests pass on both providers.
- Shadow-read critical drift is zero over the window.
- Dual-write failures are zero.
- The domain's parity contract is complete.
