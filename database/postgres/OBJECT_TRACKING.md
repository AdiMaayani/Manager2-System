# PostgreSQL Translation - Object Tracking

Source of truth for schema translation progress. `Done` means the table is translated into
`database/postgres/schema/` with faithful columns, defaults, constraints, and indexes. Waves match
the domain migration order in the plan (`docs/migration` + the migration plan).

## Baseline tables (from database/schema/tables.sql)

| Table | Wave | Status | File |
|---|---|---|---|
| CompanySettings | 1 | Done | `schema/01_core_identity.sql` |
| Roles | 2 | Done | `schema/01_core_identity.sql` |
| Departments | 2 | Done | `schema/01_core_identity.sql` |
| Employees | 2 | Done | `schema/01_core_identity.sql` |
| Users | 2 | Done | `schema/01_core_identity.sql` |
| UserRoles | 2 | Done | `schema/01_core_identity.sql` |
| UserDepartments | 2 | Done | `schema/01_core_identity.sql` |
| Customers | 2 | Done | `schema/02_customers_sites_contacts.sql` |
| Sites | 2 | Done | `schema/02_customers_sites_contacts.sql` |
| Contacts | 2 | Done | `schema/02_customers_sites_contacts.sql` |
| Contractors | 3 | Done | `schema/03_workitems_projects_quotes.sql` |
| WorkItems | 3 | Done | `schema/03_workitems_projects_quotes.sql` (self-referencing ParentWorkItemId; incl. migration cols TaskCategory/MilestoneId/IsArchived/ArchivedAt, nullable CustomerId, schedulable-category CHECKs, FK_WorkItems_Milestone) |
| ProjectEquipmentItems | 3 | Done | `schema/03_workitems_projects_quotes.sql` |
| ProjectBoqItems | 3 | Done | `schema/03_workitems_projects_quotes.sql` (migration-delta cols still pending) |
| ProjectDrawings | 3 | Done | `schema/03_workitems_projects_quotes.sql` (file metadata cols still pending) |
| Quotes | 3 | Done | `schema/03_workitems_projects_quotes.sql` |
| QuoteLineItems | 3 | Done | `schema/03_workitems_projects_quotes.sql` |
| WorkEmployeeAssignments | 3 | Done | `schema/03_workitems_projects_quotes.sql` |
| WorkContractorAssignments | 3 | Done | `schema/03_workitems_projects_quotes.sql` |
| InventoryItems | 4 | Done | `schema/04_inventory_workreports.sql` |
| WorkReports | 4 | Done | `schema/04_inventory_workreports.sql` (Hebrew Status default; lifecycle cols LifecycleStatus/Finalized*/Reversed*/Amends*/Updated* + 3 CHECKs + 4 FKs + indexes added) |
| WorkReportEmployeeAssignments | 4 | Done | `schema/04_inventory_workreports.sql` |
| WorkReportSystems | 4 | Done | `schema/04_inventory_workreports.sql` |
| Rec_Skills | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_WorkZones | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_EmployeeSkills | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_EmployeeAvailability | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_EmployeeCapacity | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_EmployeeWorkZones | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_EmployeeBaseAddress | 5 | Done | `schema/05_smartassignment.sql` (geo coordinate migration cols pending) |
| Rec_EmployeeLocationEvents | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_EmployeePlannedStops | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_SiteAddressProfile | 5 | Done | `schema/05_smartassignment.sql` (geo coordinate migration cols pending) |
| Rec_RouteEstimates | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_WorkItemAlgorithmProfile | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_WorkItemRequiredSkills | 5 | Done | `schema/05_smartassignment.sql` |
| Rec_RecommendationRuns | 5 | Done | `schema/05_smartassignment.sql` (JSON cols as text) |
| Rec_TaskAssignmentRecommendations | 5 | Done | `schema/05_smartassignment.sql` (JSON cols as text) |

## Migration-delivered tables (from database/migrations/*, see database/RUNBOOK.md)

These do not exist in `schema/tables.sql`; they are added by required migrations. Translate alongside
their owning domain wave.

| Table | Wave | Status | Notes |
|---|---|---|---|
| ProjectMilestones | 3 | Done | `schema/03_workitems_projects_quotes.sql`; dedicated milestone table + circular FK from WorkItems.MilestoneId |
| CustomerSystems | 4 | Pending | Vault |
| CustomerSystemSecrets | 4 | Pending | Vault; encryption stays in C# |
| CustomerSystemSecretAccessLog | 4 | Pending | Vault |
| WorkReportInventoryItems | 4 | Done | `schema/04_inventory_workreports.sql`; immutable report inventory lines, UNIQUE(report,item,usage) upsert key |
| InventoryStockMovements | 4 | Done | `schema/04_inventory_workreports.sql`; immutable ledger written by the C# transactional finalize/reverse; filtered UNIQUE(line,type) enforces idempotency |
| WorkReportAttachments | 4 | Done | `schema/04_inventory_workreports.sql`; attachment metadata, UNIQUE(StoredFileName) |
| AuditLog | 2 | Pending | append-only; write via C# only |
| Users.FailedLoginAttempts / LockoutUntilUtc | 2 | Pending | login lockout columns |
| geo coordinate columns | 5 | Pending | Rec_* address coordinate migration |

## Notes on high-risk translations

- `WorkItems` is self-referencing (`ParentWorkItemId`) and is referenced by many tables; translate it
  before any Project/WorkReport/Rec_* table.
- JSON columns (`InputSnapshotJson`, `SummaryJson`, `WarningsJson`) are kept as `text` (Wave 5 decision),
  not `jsonb`: the app treats them as opaque snapshot/summary strings and never queries inside them, so
  `text` preserves the exact SQL Server content byte-for-byte and avoids cast/whitespace-reformat drift in
  shadow-read parity. Converting to `jsonb` is an optional later optimization only if in-DB JSON querying
  is introduced.
- SmartAssignment (Wave 5) is a **service-refactor**, not a plpgsql port: the recommendation scoring stays
  in `SmartAssignmentService` (C#, provider-agnostic). Only the 4 `Rec_*` data-access SPs the app calls are
  reimplemented in `PostgresSmartAssignmentRepository`; the multi-result-set reads become explicit ordered
  sequential queries hydrating the same `TaskRecommendationInputModel`. All other `Rec_*` SPs are unused by
  the application and were intentionally NOT migrated.
- The inventory finalize transaction, originally in `sp_InventoryStockMovements_ApplyForReport`, is
  reimplemented as a transactional C# service (service-refactor strategy) - it is NOT a plpgsql port.
  Done in Wave 4: `PostgresWorkReportRepository.ApplyInventoryMovementsAsync` runs inside the finalize/
  reverse transaction; idempotency is backed by the filtered `UX_InventoryStockMovements_Line_Type` index.
- Hebrew `WorkReports.Status` default (`N'טיוטה'`) must be preserved exactly.
