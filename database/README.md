# ManageR2 Database — Version-Controlled Baseline

This folder is the version-controlled, reproducible definition of the ManageR2 SQL Server database.
It was produced by exporting the live production dump `igroup30_prod.sql`
(Script Date **31/05/2026**, SQL Server 2016, compatibility level 100) into one script per object.

> Goal of this baseline: the live database can be rebuilt from these scripts alone, with no access to the production server.
> No DB logic was changed. The only modifications are **syntax-only, deploy-safety** changes:
> every `CREATE PROCEDURE` / `CREATE FUNCTION` was normalized to `CREATE OR ALTER` so each script is idempotent and re-runnable.

---

## Folder layout

```
database/
  schema/
    tables.sql                 # All tables, indexes, PKs, defaults, checks, foreign keys (verbatim DDL snapshot)
  functions/
    <FunctionName>.sql         # One scalar function per file (9 files)
  SP/
    <ProcedureName>.sql        # One stored procedure per file (74 files)
    2026-04-20_workplan_algorithm_data_model_extension.sql   # historical migration (see notes)
    2026-04-20_seed_WorkPlanAlgorithmDemoData.sql            # demo seed data (see notes)
  README.md
```

Scripts do **not** embed a `USE [database]` statement, so they are portable across environments.
Select your target database context once before running them (see Run Order).

---

## Object inventory

Counts below were taken directly from `igroup30_prod.sql` object headers and match the files in this folder.

| Object type | In dump | Scripts in repo |
|---|---|---|
| Tables | 31 | captured in `schema/tables.sql` |
| Indexes (explicit) | 26 | captured in `schema/tables.sql` |
| Scalar functions | 9 | 9 files in `functions/` |
| Stored procedures | 74 | 74 files in `SP/` |
| Views | 0 | n/a |
| Triggers | 0 | n/a |

`schema/tables.sql` also contains the primary keys, 53 foreign-key statements, default constraints,
and 29 check constraints exactly as scripted by the dump.

### Tables (31)
Contacts, Contractors, Customers, Departments, Employees, Rec_EmployeeAvailability, Rec_EmployeeBaseAddress,
Rec_EmployeeCapacity, Rec_EmployeeLocationEvents, Rec_EmployeePlannedStops, Rec_EmployeeSkills,
Rec_EmployeeWorkZones, Rec_RecommendationRuns, Rec_RouteEstimates, Rec_SiteAddressProfile, Rec_Skills,
Rec_TaskAssignmentRecommendations, Rec_WorkItemAlgorithmProfile, Rec_WorkItemRequiredSkills, Rec_WorkZones,
Roles, Sites, UserDepartments, UserRoles, Users, WorkContractorAssignments, WorkEmployeeAssignments,
WorkItems, WorkReportEmployeeAssignments, WorkReports, WorkReportSystems.

### Scalar functions (9)
fnGetAnimalType, fnGetGenderDescription, fnHasParticipant, funcAddLeadingZero, funcCalculate,
funcCalculateGender, funcCalculateStatus, funcParseTaskPriority, funcParseTaskStatus.

### Stored procedures (74)
**Rec_* (16):** Rec_CreateRecommendationRun, Rec_GetActiveAssignableEmployees,
Rec_GetAllCandidateAvailabilityForRange, Rec_GetAllCandidateBaseAddresses, Rec_GetAllCandidateCapacities,
Rec_GetAllCandidateEmployeeSkills, Rec_GetAllCandidateLastLocationEventsForDate,
Rec_GetAllCandidatePlannedStopsBeforeTask, Rec_GetAllCandidateWorkZones, Rec_GetCurrentRouteEstimatesForSite,
Rec_GetLatestRecommendationsForTask, Rec_GetSiteAddressProfile, Rec_GetTaskCoreData,
Rec_GetTaskRecommendationInput, Rec_GetWorkItemRequiredSkills, Rec_SaveTaskAssignmentRecommendation.

**sp_* (58):** sp_AddWorkReportEmployeeAssignment, sp_AddWorkReportSystem, sp_AssignContractorToWork,
sp_AssignEmployeeToWork, sp_CloseWorkItem, sp_CreateContact, sp_CreateCustomer, sp_CreateSite, sp_CreateUser,
sp_CreateWorkItem, sp_CreateWorkReport, sp_DeactivateContact, sp_DeactivateCustomer,
sp_DeactivateUserDepartments, sp_DeactivateUserRoles, sp_DeleteContractorAssignmentsByWorkItemId,
sp_DeleteEmployeeAssignmentsByWorkItemId, sp_DeleteUser, sp_GetActiveContacts, sp_GetActiveCustomers,
sp_GetAllDepartmentNames, sp_GetAllProjectsForWorkPlans, sp_GetAllRoleNames, sp_GetContactById, sp_GetContacts,
sp_GetContactsByCustomerId, sp_GetCustomerById, sp_GetCustomers, sp_GetEmployees, sp_GetProjectForWorkPlan,
sp_GetProjectLifecycle, sp_GetProjectMilestones, sp_GetProjectsList, sp_GetProjectTasksForWorkPlan,
sp_GetSiteById, sp_GetSites, sp_GetTasksByParentWorkItemId, sp_GetUserByEmail, sp_GetUserById,
sp_GetUserDepartments, sp_GetUserRoles, sp_GetUsers, sp_GetWorkEmployees, sp_GetWorkItemDetails, sp_GetWorkItems,
sp_GetWorkItemsByType, sp_GetWorkPlanAssignments, sp_GetWorkPlanProject, sp_GetWorkPlanTasks,
sp_Rec_GetAssignmentInput, sp_UpdateContact, sp_UpdateCustomer, sp_UpdateSite, sp_UpdateUser,
sp_UpdateUserLastLogin, sp_UpdateWorkItem, sp_UpsertUserDepartment, sp_UpsertUserRole.

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

---

## Validation

After deploying to a scratch DB, confirm object counts match this baseline:

```sql
SELECT type_desc, COUNT(*) AS Cnt
FROM sys.objects
WHERE is_ms_shipped = 0 AND schema_id = SCHEMA_ID('dbo')
GROUP BY type_desc
ORDER BY type_desc;
-- Expect: USER_TABLE = 31, SQL_STORED_PROCEDURE = 74, SQL_SCALAR_FUNCTION = 9, VIEW = 0
```

Repo-side validation (no DB required):

```powershell
"SP files:        " + (Get-ChildItem .\database\SP\*.sql -Exclude '2026-*').Count        # expect 74
"Function files:  " + (Get-ChildItem .\database\functions\*.sql).Count                    # expect 9
"Schema snapshot: " + (Test-Path .\database\schema\tables.sql)                            # expect True
```

---

## Notes on legacy / unreferenced objects

These objects are preserved exactly as they exist in production. They are documented here for awareness only —
**nothing was removed**, and this baseline does not change their behavior.

### Legacy scalar functions (no current-table dependency)
`fnGetAnimalType`, `fnGetGenderDescription`, `fnHasParticipant`, `funcCalculate`, `funcCalculateGender`,
`funcCalculateStatus` return Hebrew pet/volunteer/charity labels and reference none of the current tables.
They appear to originate from a previous (unrelated) system and are not used by the ManageR2 backend.
Kept for fidelity; a future cleanup branch may evaluate removal.

`funcAddLeadingZero`, `funcParseTaskPriority`, `funcParseTaskStatus` are generic helpers; verify usage in SP
bodies before relying on or removing them.

### Stored procedures present in the DB but not currently called by the backend
(Confirmed against the current repositories; verify before relying on them.)
`sp_GetActiveContacts`, `sp_GetActiveCustomers`, `sp_GetEmployees` (the backend currently reads employees with
inline SQL), `sp_GetWorkEmployees`, `sp_GetProjectForWorkPlan`, `sp_GetProjectTasksForWorkPlan`,
`sp_Rec_GetAssignmentInput`, and several granular `Rec_Get*` candidate-loading procedures (the backend uses the
bundled `Rec_GetTaskRecommendationInput`). These are kept because they are part of the live database.

### Historical migration / seed scripts (kept, not part of the canonical export)
- `SP/2026-04-20_workplan_algorithm_data_model_extension.sql` — conditional `ALTER TABLE ADD COLUMN` migration for
  the work-plan algorithm. Its columns are already present in `schema/tables.sql`, so a fresh build does **not**
  need it. Retained as migration history.
- `SP/2026-04-20_seed_WorkPlanAlgorithmDemoData.sql` — demo `UPDATE` statements for algorithm testing. **Do not**
  run against production; it mutates specific employee/work-item rows for a demo scenario.

### Known schema observations (informational, out of scope for this baseline)
- `WorkItems.Status` / `WorkType` / `Priority` and `Customers.CustomerType` have **no CHECK constraint**
  (app-enforced). Adding guardrails is deferred to a separate branch.
- `Customers` has duplicate `Phone`/`Email` vs `PrimaryPhone`/`PrimaryEmail` columns.
- `Users.Email` carries two UNIQUE constraints. These are preserved as-is.
