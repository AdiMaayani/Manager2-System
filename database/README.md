# ManageR2 Database — Version-Controlled Baseline

> ⚠️ **For setup/rebuild/deployment, use [`RUNBOOK.md`](./RUNBOOK.md) — it is authoritative.**
> The counts and run order below describe the **original 31/05/2026 baseline only** and are now
> **out of date**: the live database has **42 tables / 134 stored procedures** (not 36 / 108), and the
> recent feature migrations (login lockout, Customer Systems Vault, core audit log, Smart Assignment
> persistence & factor activation) are **required** for a fresh build — they are **not** optional/"historical".
> See `RUNBOOK.md` §1 and §8 for the reconciliation against the current `igroup30_prod.sql` dump.

This folder is the version-controlled, reproducible definition of the ManageR2 SQL Server database.
It was originally produced by exporting the live production dump `igroup30_prod.sql`
(Script Date **31/05/2026**, SQL Server 2016, compatibility level 100) into one script per object,
then reconciled with the completed baseline migrations for company settings, report lifecycle, employees CRUD,
service calls, project equipment, project BOQ, project drawings, sites soft-deactivation persistence, and Inventory MVP.

> Goal of this baseline: the live database can be rebuilt from these scripts alone, with no access to the production server.
> No DB logic was changed. The only modifications are **syntax-only, deploy-safety** changes:
> every `CREATE PROCEDURE` / `CREATE FUNCTION` was normalized to `CREATE OR ALTER` so each script is idempotent and re-runnable.

---

## Folder layout

```
database/
  schema/
    tables.sql                 # All current tables, indexes, PKs, defaults, checks, foreign keys
  functions/
    <FunctionName>.sql         # One scalar function per file (2 files)
  cleanup/
    2026-06-01_drop_legacy_functions.sql  # Manual cleanup for removed legacy functions
  migrations/
    2026-06-01_company_settings.sql        # Historical migration for persisted company settings
    2026-06-02_reports_lifecycle.sql       # Historical migration for report read/edit/delete procedures
    2026-06-02_employees_crud.sql          # Historical migration for employee management procedures
    2026-06-02_service_calls_mvp.sql       # Historical migration for WorkItems-backed service calls
    2026-06-02_project_equipment.sql       # Historical migration for project equipment persistence
    2026-06-02_project_boq.sql             # Historical migration for project BOQ persistence
    2026-06-04_project_drawings.sql        # Historical migration for project drawings metadata
    2026-06-04_sites_deactivate.sql        # Historical migration for site soft-deactivation
    2026-06-04_inventory_mvp.sql           # Historical migration for Inventory MVP persistence
    2026-06-18_inventory_product_image.sql # Adds product image metadata columns to InventoryItems
    2026-06-18_inventory_category_cleanup.sql # Deletes obsolete categories and normalizes legacy aliases
  SP/
    <ProcedureName>.sql        # One stored procedure per file (108 canonical files)
    2026-04-20_workplan_algorithm_data_model_extension.sql   # historical migration (see notes)
    2026-04-20_seed_WorkPlanAlgorithmDemoData.sql            # demo seed data (see notes)
  README.md
```

Scripts do **not** embed a `USE [database]` statement, so they are portable across environments.
Select your target database context once before running them (see Run Order).

---

## Object inventory

Counts below are based on the exported `igroup30_prod.sql` object headers plus the reconciled baseline migrations.
Unrelated legacy functions were removed from the repository baseline in the cleanup branch.

| Object type | In dump | Scripts in repo |
|---|---|---|
| Tables | 36 | captured in `schema/tables.sql` |
| Indexes (explicit) | 32 | captured in `schema/tables.sql` |
| Scalar functions | 9 | 2 files in `functions/` |
| Stored procedures | 108 | 108 canonical files in `SP/` |
| Views | 0 | n/a |
| Triggers | 0 | n/a |

`schema/tables.sql` also contains the primary keys, 54 foreign-key statements, default constraints,
and 37 check constraints.

### Tables (36)
CompanySettings, Contacts, Contractors, Customers, Departments, Employees, ProjectEquipmentItems,
InventoryItems, ProjectBoqItems, ProjectDrawings,
Rec_EmployeeAvailability, Rec_EmployeeBaseAddress,
Rec_EmployeeCapacity, Rec_EmployeeLocationEvents, Rec_EmployeePlannedStops, Rec_EmployeeSkills,
Rec_EmployeeWorkZones, Rec_RecommendationRuns, Rec_RouteEstimates, Rec_SiteAddressProfile, Rec_Skills,
Rec_TaskAssignmentRecommendations, Rec_WorkItemAlgorithmProfile, Rec_WorkItemRequiredSkills, Rec_WorkZones,
Roles, Sites, UserDepartments, UserRoles, Users, WorkContractorAssignments, WorkEmployeeAssignments,
WorkItems, WorkReportEmployeeAssignments, WorkReports, WorkReportSystems.

### Scalar functions (2)
funcParseTaskPriority, funcParseTaskStatus.

### Stored procedures (108)
**Rec_* (16):** Rec_CreateRecommendationRun, Rec_GetActiveAssignableEmployees,
Rec_GetAllCandidateAvailabilityForRange, Rec_GetAllCandidateBaseAddresses, Rec_GetAllCandidateCapacities,
Rec_GetAllCandidateEmployeeSkills, Rec_GetAllCandidateLastLocationEventsForDate,
Rec_GetAllCandidatePlannedStopsBeforeTask, Rec_GetAllCandidateWorkZones, Rec_GetCurrentRouteEstimatesForSite,
Rec_GetLatestRecommendationsForTask, Rec_GetSiteAddressProfile, Rec_GetTaskCoreData,
Rec_GetTaskRecommendationInput, Rec_GetWorkItemRequiredSkills, Rec_SaveTaskAssignmentRecommendation.

**sp_* (92):** sp_AddWorkReportEmployeeAssignment, sp_AddWorkReportSystem, sp_AssignContractorToWork,
sp_AssignEmployeeToWork, sp_CloseWorkItem, sp_CreateContact, sp_CreateCustomer, sp_CreateEmployee, sp_CreateSite, sp_CreateUser,
sp_CreateWorkItem, sp_CreateWorkReport, sp_DeactivateContact, sp_DeactivateCustomer,
sp_DeactivateSite, sp_DeactivateUserDepartments, sp_DeactivateUserRoles, sp_DeleteContractorAssignmentsByWorkItemId,
sp_DeleteEmployeeAssignmentsByWorkItemId, sp_DeleteUser, sp_GetActiveContacts, sp_GetActiveCustomers, sp_GetEmployeeById,
sp_GetAllDepartmentNames, sp_GetAllProjectsForWorkPlans, sp_GetAllRoleNames, sp_GetContactById, sp_GetContacts,
sp_GetContactsByCustomerId, sp_GetCustomerById, sp_GetCustomers, sp_GetEmployees, sp_GetProjectForWorkPlan,
sp_GetProjectLifecycle, sp_GetProjectMilestones, sp_GetProjectsList, sp_GetProjectTasksForWorkPlan,
sp_GetSiteById, sp_GetSites, sp_GetTasksByParentWorkItemId, sp_GetUserByEmail, sp_GetUserById,
sp_GetUserDepartments, sp_GetUserRoles, sp_GetUsers, sp_GetWorkEmployees, sp_GetWorkItemDetails, sp_GetWorkItems,
sp_GetWorkItemsByType, sp_GetWorkPlanAssignments, sp_GetWorkPlanProject, sp_GetWorkPlanTasks,
sp_Inventory_ClearImage, sp_Inventory_Create, sp_Inventory_Deactivate, sp_Inventory_GetById, sp_Inventory_GetList, sp_Inventory_SetImage, sp_Inventory_Update,
sp_ProjectBoq_Create, sp_ProjectBoq_Delete, sp_ProjectBoq_GetByProject, sp_ProjectBoq_Reorder, sp_ProjectBoq_Update,
sp_ProjectDrawings_Create, sp_ProjectDrawings_Delete, sp_ProjectDrawings_GetByProject, sp_ProjectDrawings_Update,
sp_ProjectEquipment_Create, sp_ProjectEquipment_Delete, sp_ProjectEquipment_GetByProject, sp_ProjectEquipment_Reorder,
sp_ProjectEquipment_Update, sp_Rec_GetAssignmentInput, sp_SetEmployeeActiveStatus,
sp_Settings_GetCompanySettings, sp_Settings_UpsertCompanySettings, sp_UpdateContact, sp_UpdateCustomer,
sp_UpdateEmployee, sp_UpdateSite, sp_UpdateUser, sp_UpdateUserLastLogin, sp_UpdateWorkItem,
sp_UpsertUserDepartment, sp_UpsertUserRole, sp_WorkReports_Delete, sp_WorkReports_DeleteEmployeeAssignments,
sp_WorkReports_DeleteSystems, sp_WorkReports_GetById, sp_WorkReports_GetEmployeeAssignments,
sp_WorkReports_GetList, sp_WorkReports_GetSystems, sp_WorkReports_Update.

---

## Run order (fresh / scratch database)

All scripts are idempotent (`CREATE OR ALTER` for programmability; the schema snapshot uses plain `CREATE TABLE`,
so run it against an empty database).

1. **Create or select the target database** and set context:
   ```sql
   -- CREATE DATABASE [ManageR2_Scratch];   -- only on a fresh instance
   USE [ManageR2_Scratch];
   GO
   ```
2. **Schema** — run `schema/tables.sql` (creates all tables, indexes, PKs, defaults, checks, foreign keys).
3. **Functions** — run every file in `functions/` (order does not matter; they are independent scalar UDFs).
4. **Stored procedures** — run every file in `SP/` (order does not matter; `CREATE OR ALTER` does not require
   referenced objects to pre-exist at create time).
5. **Initial admin (required for first login)** — run `seed/initial_admin/00_seed_initial_admin.sql`.
   A schema-only database has no `Roles` and no `Users`, so login is impossible until this runs. See
   [Initial admin bootstrap](#initial-admin-bootstrap-first-login) below.

The manual cleanup script in `cleanup/2026-06-01_drop_legacy_functions.sql` is not part of a fresh rebuild. Run it
manually in SSMS against existing target databases that still contain the removed legacy functions.

The scripts in `migrations/` are retained as historical, idempotent migrations for existing databases that were created
from an older baseline. A fresh rebuild from `schema/`, `functions/`, and `SP/` already includes the completed company
settings, report lifecycle, employees CRUD, service calls, and project equipment objects.
It also includes project BOQ, project drawings, sites soft-deactivation, and Inventory MVP objects.

### PowerShell helper (uses `sqlcmd`)

```powershell
$server = 'localhost'
$db     = 'ManageR2_Scratch'

# 1) schema
sqlcmd -S $server -d $db -b -i ".\database\schema\tables.sql"

# 2) functions
Get-ChildItem ".\database\functions\*.sql" | ForEach-Object {
  sqlcmd -S $server -d $db -b -i $_.FullName
}

# 3) stored procedures
Get-ChildItem ".\database\SP\*.sql" -Exclude '2026-*' | ForEach-Object {
  sqlcmd -S $server -d $db -b -i $_.FullName
}
```

> `-b` makes `sqlcmd` stop on the first error so a broken deploy fails loudly.
> The `-Exclude '2026-*'` skips the two historical migration/seed scripts (see notes below).

After the three steps above, run the initial-admin seed once:

```powershell
# 4) initial admin (first login)
sqlcmd -S $server -d $db -b -i ".\database\seed\initial_admin\00_seed_initial_admin.sql"
```

---

## Initial admin bootstrap (first login)

A database built only from `schema/` + `SP/` (or from the production dump `igroup30_prod.sql`, which contains
**no row data**) has zero `Roles` and zero `Users`. Because `POST /api/Users` itself requires an authenticated
Admin, you cannot create the first user through the API — login must be bootstrapped in the database.

`seed/initial_admin/00_seed_initial_admin.sql` creates exactly one administrator and is **idempotent** (safe to
re-run; it never overwrites an existing user's password). It:

1. ensures the `Admin` role row exists,
2. ensures a linked `Employees` row (required: `Users.EmployeeId` is `NOT NULL`),
3. creates the user via `sp_CreateUser`, and
4. grants the active `Admin` role via `sp_UpsertUserRole`.

It calls the same stored procedures the application uses, with signatures verified against `igroup30_prod.sql`.

**Default dev credentials (change before any shared/real environment):**

| Field | Value |
|---|---|
| Email (login) | `admin@manager2.local` |
| Username | `admin` |
| Password | `Admin#2026!` |

### Changing the password

The stored `PasswordHash`/`PasswordSalt` are PBKDF2-SHA256 (100000 iterations, 16-byte salt, 32-byte key, Base64),
matching `apps/api/ManageR2.Infrastructure/Features/Users/Services/PasswordService.cs`. T-SQL cannot compute this,
so the values are precomputed. To use a different password, regenerate the two literals and paste them into the seed:

```powershell
.\database\seed\initial_admin\generate_password_hash.ps1 -Password 'YourNewPassword'
```

---

## Validation

After deploying to a scratch DB, confirm object counts match this baseline:

```sql
SELECT type_desc, COUNT(*) AS Cnt
FROM sys.objects
WHERE is_ms_shipped = 0 AND schema_id = SCHEMA_ID('dbo')
GROUP BY type_desc
ORDER BY type_desc;
-- Expect: USER_TABLE = 36, SQL_STORED_PROCEDURE = 108, SQL_SCALAR_FUNCTION = 2, VIEW = 0
```

Repo-side validation (no DB required):

```powershell
"SP files:        " + (Get-ChildItem .\database\SP\*.sql -Exclude '2026-*').Count        # expect 108
"Function files:  " + (Get-ChildItem .\database\functions\*.sql).Count                    # expect 2
"Schema snapshot: " + (Test-Path .\database\schema\tables.sql)                            # expect True
```

---

## Notes on legacy / unreferenced objects

Legacy scalar functions from an unrelated previous project were removed from the repository baseline in the
`chore/db-legacy-function-cleanup` branch. Existing databases are not changed by this repository update; run
`cleanup/2026-06-01_drop_legacy_functions.sql` manually in SSMS against each target database that should drop them.

`funcParseTaskPriority` and `funcParseTaskStatus` remain in the active function inventory.

### Stored procedures present in the DB but not currently called by the backend
(Confirmed against the current repositories; verify before relying on them.)
`sp_GetActiveContacts`, `sp_GetActiveCustomers`, `sp_GetWorkEmployees`, `sp_GetProjectForWorkPlan`, `sp_GetProjectTasksForWorkPlan`,
`sp_Rec_GetAssignmentInput`, and several granular `Rec_Get*` candidate-loading procedures (the backend uses the
bundled `Rec_GetTaskRecommendationInput`). These are kept because they are part of the live database.

### Historical migration / seed scripts
The `migrations/` files are retained for existing databases that were created before this reconciled baseline.
A fresh rebuild already gets their final table/procedure state from `schema/tables.sql` and `SP/`.

- `migrations/2026-06-01_company_settings.sql` — idempotent migration for persisted company profile settings.
  Its final table and procedures are now part of the canonical baseline; the migration also contains the optional
  single-row seed for existing databases.
- `migrations/2026-06-02_reports_lifecycle.sql` — idempotent migration for report lifecycle stored procedures.
  Its procedures are now split into canonical `SP/sp_WorkReports_*.sql` files.
- `migrations/2026-06-02_employees_crud.sql` — idempotent migration for employee management stored procedures.
  Its procedures are now represented by canonical employee SP files, and `sp_GetEmployees` has the current roster shape.
- `migrations/2026-06-02_service_calls_mvp.sql` — idempotent migration for the Service Calls MVP.
  It keeps Service Calls in `WorkItems` with `WorkType = 'ServiceCall'`; the current `sp_GetWorkItemsByType`
  definition is now canonical under `SP/`.
- `migrations/2026-06-02_project_equipment.sql` — idempotent migration for project equipment persistence.
  Its table is now captured in `schema/tables.sql`; its five procedures are canonical under `SP/`.
- `migrations/2026-06-02_project_boq.sql` — idempotent migration for project BOQ persistence.
  Its table is now captured in `schema/tables.sql`; its five procedures are canonical under `SP/`.
- `migrations/2026-06-04_project_drawings.sql` — idempotent migration for project drawings metadata persistence.
  Its table is now captured in `schema/tables.sql`; its four procedures are canonical under `SP/`.
- `migrations/2026-06-04_sites_deactivate.sql` — idempotent migration for site soft-deactivation.
  Its columns are now captured in `schema/tables.sql`; `sp_DeactivateSite` is canonical under `SP/`.
- `migrations/2026-06-04_inventory_mvp.sql` — idempotent migration for Inventory MVP persistence.
  Its table is now captured in `schema/tables.sql`; its five procedures are canonical under `SP/`.
- `migrations/2026-06-18_inventory_product_image.sql` — idempotent migration adding product image metadata
  columns (`ImagePath`, `ImageContentType`, `ImageFileSizeBytes`) to `InventoryItems`. Columns are now captured
  in `schema/tables.sql`; `sp_Inventory_SetImage` and `sp_Inventory_ClearImage` are canonical under `SP/`.
- `migrations/2026-06-18_inventory_category_cleanup.sql` — idempotent, intentional business-data cleanup that
  deletes obsolete-category items (`בטיחות אש`, `בקרת כניסה`) and normalizes legacy aliases
  (`כריזה ומולטימדיה` → `מולטימדיה`, `מצלמות ואבטחה` → `מצלמות אבטחה`). Runs in a single transaction
  (`SET XACT_ABORT ON` + `TRY/CATCH`). Because `FK_ProjectBoqItems_InventoryItems` and
  `FK_ProjectEquipmentItems_InventoryItems` reference `InventoryItems` with `NO ACTION`, it first deletes the
  dependent `ProjectBoqItems` / `ProjectEquipmentItems` rows that reference exactly the obsolete
  `InventoryItemId`s (parents and unrelated rows untouched; no FK is dropped and no cascade is added), then the
  items. Reports the `ImagePath` values of rows it deletes so their on-disk files can be removed manually (SQL
  does not delete physical files) and returns a summary result set of all counts.
- `SP/2026-04-20_workplan_algorithm_data_model_extension.sql` — conditional `ALTER TABLE ADD COLUMN` migration for
  the work-plan algorithm. Its columns are already present in `schema/tables.sql`, so a fresh build does **not**
  need it. Retained as migration history.
- `SP/2026-04-20_seed_WorkPlanAlgorithmDemoData.sql` — demo `UPDATE` statements for algorithm testing. **Do not**
  run against production; it mutates specific employee/work-item rows for a demo scenario.

### Known schema observations (informational, out of scope for this baseline)
- `WorkItems.Status` / `WorkType` / `Priority` and `Customers.CustomerType` have **no CHECK constraint**
  (app-enforced). Adding guardrails is deferred to a separate branch.
- `Customers` has duplicate `Phone`/`Email` vs `PrimaryPhone`/`PrimaryEmail` columns.
- `Users.Email` carries a single named UNIQUE constraint (`UQ_Users_Email`) in the canonical schema.
