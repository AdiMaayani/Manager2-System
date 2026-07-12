# Phase 3 - Repository Migration Progress

Tracks per-domain progress of the service-refactor + dual-run repository migration. Each migrated
domain ships three parts following the reference pattern (see `50_domain_wave_playbook.md`):

1. `Postgres<Domain>Repository` - Npgsql implementation reproducing the stored-procedure behavior
   as parameterized SQL against the translated `database/postgres/schema` tables.
2. `<Domain>RepositoryRouter` - dual-run router: primary provider serves the response; shadow reads
   and dual writes are gated by `DataProvider` flags and recorded via `IProviderDriftRecorder`.
3. DI wiring in `Program.cs` - both concrete repositories + router bound to the domain interface.

With default flags (`Primary=SqlServer`, shadow/dual-write off) every router delegates purely to the
existing SQL Server repository, so this work is additive and inert until an operator opts in.

## Status

| Domain | Wave | Postgres repo | Router | DI | Notes |
|---|---|---|---|---|---|
| CompanySettings | 1 | Done | Done | Done | Reference implementation (single-row upsert). |
| Customers | 2 | Done | Done | Done | Trim + NULLIF, UTC stamps, FK/CHECK -> 23503/23514. |
| Contacts | 2 | Done | Done | Done | Adds GetByCustomerId; same trim/NULLIF rules. |
| Sites | 2 | Done | Done | Done | Soft-delete (IsActive); deactivate guard mirrors THROW 51010; local CreatedAt + UTC UpdatedAt. |
| Employees | 2 | Done | Done | Done | No-trim writes; local CreatedAt; distinct active-role projection. |
| Users | 2 | Done | Done | Done | Transactional soft-delete cascade, SetRoles/Departments upsert, exact-set restore sync, best-effort lockout (columns are a pending migration -> errors swallowed). Validated live against Docker Postgres. |
| Contractors / WorkItems / Quotes / assignments | 3 | Done | Done | Done | Schema gap filled first: added `ProjectMilestones` + WorkItems `TaskCategory`/`MilestoneId`/`IsArchived`/`ArchivedAt` columns, the three schedulable-category CHECKs and `FK_WorkItems_Milestone` (39 tables total). `PostgresWorkItemRepository` (partial across 4 files) reproduces every WorkItem/work-plan/milestone/assignment SP: category+WorkType derivation and DATEDIFF-minute EstimatedHours, the 4-result-set schedule (`EXTRACT(EPOCH)/60`, boolean `IsServiceCall`), the project-manager `ROW_NUMBER` projection, the assignment `UNION ALL`, and the transactional `DeleteWorkPlanTask` cascade with all 8 result codes/Hebrew messages. Contractors has no CRUD SPs — only the contractor-assignment paths. `PostgresQuoteRepository` mirrors the C# transactional orchestration (header + full line replacement + totals recalc), `Q-YYYY-####` numbering, `ROUND` line totals, and wraps validation/DbException into `UserValidationException`. Validated live against Docker Postgres. |
| Reports / Inventory | 4 | Done | Done | Done | Schema gap filled first: WorkReports lifecycle columns (`LifecycleStatus`/`Finalized*`/`Reversed*`/`AmendsWorkReportId`/`Updated*`) with the 3 lifecycle CHECKs + 4 FKs + indexes, plus the three migration tables `WorkReportInventoryItems`, `WorkReportAttachments`, `InventoryStockMovements` (42 tables total). `PostgresInventoryItemRepository` mirrors every `sp_Inventory_*` SP (btrim/NULLIF normalization, required/non-negative guards, active-SKU uniqueness, canonical-category guard on create-with-image, previous-image reporting via `RETURNING` CTE). `PostgresWorkReportRepository` (partial across 4 files) reproduces the report CRUD + child rows, the lifecycle guards, and — the key deliverable — the inventory finalize/reverse as a **validated C# transaction** (service-refactor of `sp_InventoryStockMovements_ApplyForReport`): no-double-usage / reversal-requires-usage / quantity-match guards, aggregated per-item stock deltas with insufficient/inactive protection (rowcount `<>1`), and the idempotent immutable movement ledger (`NOT EXISTS` per line+type, backed by the filtered UNIQUE index). Both routers dual-run with default flags delegating to SQL Server. Build + 81 unit tests pass; validated live against Docker Postgres with a transactional finalize→idempotency→reverse→guards smoke that rolls back. |
| SmartAssignment / AdvancedSmartAssignment (`Rec_*`) | 5 | Done | Done | Done | Extracted `ISmartAssignmentRepository` (was a concrete-only class) so the domain fits the router pattern; only the 4 `Rec_*` SPs the app actually calls are migrated (`Rec_GetTaskRecommendationInput`, `Rec_GetDraftTaskRecommendationInput` — 14 result sets each — plus writes `Rec_CreateRecommendationRun`/`Rec_SaveTaskAssignmentRecommendation`). `PostgresSmartAssignmentRepository` re-expresses the multi-result-set SPs as explicit ordered sequential queries hydrating the same provider-neutral `TaskRecommendationInputModel` (scoring stays in `SmartAssignmentService`, untouched). Router shadow-reads with `SmartAssignmentInputParityNormalizer` (SPs have no ORDER BY; C# scoring is order-insensitive, so lists are sorted only to stabilize comparison) and best-effort dual-writes with a per-request SQL→PG `RecommendationRunId` map to keep the run/recommendation FK intact. Schema 05 (15 `Rec_*` tables) already translated; JSON snapshot columns kept as `text` to preserve exact content. Build + 101 unit tests pass (+20 new: scoring fixtures, parity normalizer, default-flag safety); validated live against Docker Postgres with a read-parity + write-path + guards smoke that rolls back. |

## Validation gate before advancing waves

Per the plan guardrails (`00_guardrails_and_go_no_go.md`) and `AGENTS.md`, the remaining domains are
**gated on operator-provided infrastructure** and cannot be completed purely in code:

- A running PostgreSQL instance with the translated schema applied is required to enable shadow reads.
- Each migrated domain must pass its read-parity phase (`60_dual_run_validation.md`) with zero
  unexplained drift before controlled dual writes are enabled.
- The coding agent does not execute databases, migrations, or stored procedures (DB-safety rules), so
  the shadow/dual-run validation steps are operator-executed.

## Build/test state

- `dotnet build apps/api/ManageR2.Backend.sln` - succeeds (0 warnings, 0 errors).
- `dotnet test apps/api/ManageR2.Backend.sln` - 101 passed, 0 failed.

## Phase 4 (cutover) — remaining, operator-gated

All five domain waves are code-complete and inert under default flags. Phase 4 is NOT started and must
not be started by the agent. Remaining before any provider promotion:

1. **Live SQL Server ↔ Postgres shadow-read parity** per domain (`60_dual_run_validation.md`): enable
   `DataProvider:ShadowReadPostgres=true` in a non-prod environment with both databases populated from the
   same data, drive representative traffic, and confirm zero unexplained drift in `IProviderDriftRecorder`
   logs. The agent validated PG-internal contracts only (schema + smoke), not live cross-provider equality.
2. **Controlled dual-write burn-in** (`DataProvider:DualWritePostgres=true`) for the write domains
   (Users, WorkItems/Quotes, Reports/Inventory, SmartAssignment run/recommendation writes), watching for
   dual-write failures. Note the SmartAssignment run→recommendation FK mapping is per-request/in-memory
   only — acceptable for best-effort dual-write but not for a PG-primary future.
3. **Pending schema deltas** before PG can be primary (see OBJECT_TRACKING): Vault tables
   (`CustomerSystems*`), `AuditLog`, `Users` login-lockout columns, `ProjectBoqItems`/`ProjectDrawings`
   migration-delta cols, and `Rec_*` geo coordinate columns.
4. **Backfill + cutover runbook** (data copy, sequence reseat, `DataProvider:Primary=Postgres` flip,
   rollback plan) — none of which the agent performs.
