# ManageR2 — Database & Deployment Runbook

Authoritative, step-by-step procedure to rebuild, configure, and verify the ManageR2 system
(SQL Server database + ASP.NET Core API + React web app) for a clean demo or a new deployment.

> **Read this first.** This runbook supersedes the older "Run order" section of `database/README.md`.
> The README's object counts (36 tables / 108 SPs) and its "migrations are historical / optional"
> note are **out of date**: the recent feature migrations are now **required** for a fresh build.
> See [Reconciliation](#8-reconciliation-repo-scripts-vs-current-database) for details.

---

## 2026-06-19 WorkPlan/reports in-place database phase

Back up and restore the target to a non-production verification database first. Confirm `DB_NAME()`
before every step. Never execute `igroup30_prod.sql`; it is read-only reference material.

Exact order:

1. Run `migrations/2026-06-19_workplan_reports_overhaul.sql`. It adds the guarded schema and only
   unambiguous category/lifecycle backfills, four domain tables, and four empty control/audit tables.
   Its first mutation gate lists and rejects unknown Hebrew workflow statuses before any DDL or
   backfill runs. `_MilestoneMigrationMap` remains empty.
2. Run `migrations/2026-06-19_workitems_check_constraints_null_semantics_fix.sql`. It replaces the
   two WorkItems type/category CHECK constraints with NULL-safe `CASE ... ELSE 0 END = 1` expressions
   (`WITH NOCHECK`, no data mutation). **Required on databases where step 1 already ran** with the
   original OR/`NOT(...)` predicates; safe to rerun; run before the guarded INTERNAL migration.
3. Deploy the changed/new canonical `SP/*.sql` files. Do not expose the flat UTC schedule endpoint
   to application traffic until the timezone gate passes.
4. Run `migrations/2026-06-19_legacy_data_migration.sql` for read-only diagnostics. It performs no
   DDL or DML. Do not populate `_MilestoneMigrationMap` without approved exact WorkItem ids.
5. Run `migrations/2026-06-19_planned_datetime_utc.sql` with every flag `0`; this is fully read-only.
   Review winter/summer, midnight-crossing, multi-day, API-write-path, DST-hour, and representative
   production previews.
6. With explicit timezone approval, set `@ConventionConfirmedIsraelLocal=1` and
   `@ApplyConversion=1` in an execution copy. Inspect shadows, then approve `@ApproveSwap=1`.
   The later milestone copy preserves those already-converted UTC WorkItem values.
7. With explicit INTERNAL approval, set `@ApproveInternalContext=1` and set
   `@ApprovedInternalProjectId` to the confirmed reserved container id in
   `2026-06-19_legacy_data_migration_apply.sql`. It clears only confirmed synthetic ids, preserves
   real customer/site references and all WorkItem references, and archives only the INTERNAL project.
   It never deactivates the Internal customer or site.
8. Only after `_MilestoneMigrationMap` rows contain `ApprovedBy`/`ApprovedAt`, set
   `@ApproveMilestoneMap=1`. Empty, incomplete, cross-project, or archived mappings roll back.
9. Run `2026-06-19_legacy_data_migration_verify.sql`; require zero invalid type/category matrix
   rows (`InvalidTypeCategoryRows`), zero invalid Regular-task rows (`InvalidRegularNoProjectRows`), zero
   cross-project milestones, map/copy parity, assignment audit coverage, and expected INTERNAL state.
   Then set `@ApproveEnableWorkItemChecks=1` in an approved verification copy to enable the three
   `CK_WorkItems_*` constraints with `WITH CHECK CHECK CONSTRAINT`.
10. In an isolated DB only, run `tests/2026-06-19_workitems_type_category_checks.sql` (static section
    always; gated trusted-check section with `@ApprovedNonProduction=1`), then
    `tests/2026-06-19_workplan_reports_smoke.sql` and the two-session
    `tests/2026-06-19_inventory_finalize_concurrency.sql` after setting their approval/fixture values.

Required gates and verification:

- `WorkReports.Status` stays the Hebrew business workflow state. `LifecycleStatus` is independent.
  `טיוטה` maps to `Draft`; `הוגש`/`הועבר להנה״ח` map to `Finalized`; unknown values block.
- Legacy finalized reports get no stock movements. Verify finalization leaves `Status` unchanged.
- Every milestone reference must belong to the task's project. Milestones never enter the schedule.
- Report inventory and attachment metadata are editable only while `LifecycleStatus='Draft'`.
- Verify inventory aggregated by `InventoryItemId`, deterministic ascending locking, one movement per
  line/type, repeated finalize/reverse idempotency, cross-report safety, no negative stock, and no
  partial movement or lifecycle transition.
- Ambiguous datetime convention is a hard stop. Do not shift any value or enable the UTC API contract.

Rollback:

- Prefer the pre-migration backup before new application traffic. For legacy changes, use
  `2026-06-19_legacy_data_migration_reverse.sql`; it refuses milestone reversal when new tasks refer
  to migrated milestones, requires the confirmed INTERNAL project id, refuses to overwrite tasks
  changed after migration, and never touches customers/sites. Reversing INTERNAL tasks intentionally
  leaves the legacy matrix checks disabled/untrusted until a forward migration is reapplied. For datetime rollback, set only
  `@ApproveReverse=1` in an execution copy of the timezone script to restore audited local values.
- Keep audit/shadow tables through the rollback window. Do not recreate, replace, or manually drop
  operational tables; use a forward fix after traffic begins.

---

## 1. Current authoritative DB state

Validated against the pre-overhaul production schema dump `igroup30_prod.sql` (read-only reference):

| Object | Current DB (dump) | Repo baseline (`schema/` + `functions/` + `SP/`) | Gap closed by migrations |
|---|---|---|---|
| Tables | **42** | 38 (`schema/tables.sql`) | +4 (3 Vault, 1 AuditLog) |
| Stored procedures | **134** | 117 (`SP/*.sql`, excl. dated) | +17 (11 Vault, 3 login-lockout, 1 SA draft, 2 AuditLog) |
| Scalar functions | **2** | 2 (`functions/`) | — |
| Views / triggers | 0 | 0 | — |

The repository uses a **layered** model: a baseline snapshot (`schema/tables.sql`) + canonical
programmability (`functions/`, `SP/`) + dated `migrations/` that add the newer objects + `seed/`.
A fresh rebuild that matches the current database therefore needs **baseline + the required recent
migrations + the required seeds** (full ordered list in [§4](#4-database-build-fresh-database)).

The 4 tables and (originally) 17 procedures that were first delivered **only in migrations** (not in
`schema/`/`SP/`):

- **Customer Systems Vault** (migration `2026-06-15_customer_systems_vault.sql`):
  tables `CustomerSystems`, `CustomerSystemSecrets`, `CustomerSystemSecretAccessLog`;
  SPs `sp_CustomerSystems_*` (5) and `sp_CustomerSystemSecrets_*` (6).
- **Login lockout** (migration `2026-06-14_users_login_lockout.sql`):
  `Users.FailedLoginAttempts` + `Users.LockoutUntilUtc` columns; SPs `sp_Users_GetLoginSecurity`,
  `sp_Users_RegisterFailedLogin`, `sp_Users_ClearFailedLogin`.
- **Smart Assignment draft** (migration `2026-06-15_smart_assignment_persistence_explainability.sql`):
  SP `Rec_GetDraftTaskRecommendationInput` (and an updated `Rec_GetLatestRecommendationsForTask`).
- **Core audit log** (migration `2026-06-15_audit_log_core.sql`):
  table `AuditLog` (append-only security/operational trail); SPs `sp_AuditLog_Create` (server-side
  write path) and `sp_AuditLog_GetList` (read path for the Admin/SeniorManagement audit screen).

> **Canonicalized (SP canonicalization batch):** the 22 code-required procedures that were previously
> migration-only — the 11 Customer Systems Vault procedures, the 3 login-lockout procedures,
> `sp_AuditLog_Create`, `sp_AuditLog_GetList` (the 2026-06-18 search version), and the 6 `sp_Dashboard_*`
> procedures — now also have standalone canonical files under `database/SP`. Their **migrations remain
> required** for the tables, columns, and indexes they create; the canonical `SP/` files own the final
> procedure bodies and are deployed **once, after** all migrations (see
> [§4](#4-database-build-fresh-database)).

The pre-overhaul repo + required migrations reproduce the earlier dump. After the complete current
fresh build (baseline + all 14 required migrations + the single canonical SP deployment), the expected
table total is **55 tables**. The exact stored-procedure total is **not asserted here** — it is left
for a clean fresh build to measure and record; use the named critical-procedure checks in
[§7](#7-final-verification--ssms-queries) for correctness in the meantime. An approved timezone
conversion later adds 2 audit tables (**57 total**); its default diagnostics-only run adds nothing.

---

## 2. Prerequisites

- **SQL Server** 2016+ (the dump targets SQL Server 2016, compat level 100) and **SSMS** or `sqlcmd`.
- **.NET 8 SDK** (the API targets `net8.0`).
- **Node.js 18+** and npm (the web app is a Vite + React workspace).
- Repository checked out at the workspace root (`ManageR2-System/`).

> All SQL scripts are **portable**: none contain a `USE [database]` statement. Select the target
> database as your query context (SSMS dropdown) or pass `-d <db>` to `sqlcmd` before running them.

---

## 3. Script taxonomy (what each folder is)

| Folder / file | Kind | Idempotent? | When to run |
|---|---|---|---|
| `schema/tables.sql` | One-time baseline (plain `CREATE TABLE`) | No (run against an **empty** DB only) | Fresh build, step 1 |
| `functions/*.sql` | Canonical programmability (`CREATE OR ALTER`) | Yes | Every build |
| `SP/*.sql` (excl. `2026-*`) | Canonical programmability (`CREATE OR ALTER`) | Yes | **After all migrations** (fresh build, step 5); redeploy on every build |
| `migrations/2026-06-11_project_inventory_drawings_files.sql` | **Required** migration | Yes (`COL_LENGTH`/`IF NOT EXISTS` guards) | Fresh build + existing DBs (adds `ProjectBoqItems`/`ProjectEquipmentItems` inventory links + drawing-file metadata columns **not** in the baseline) |
| `migrations/2026-06-14_users_login_lockout.sql` | **Required** migration | Yes (`IF NOT EXISTS` + `CREATE OR ALTER`) | Fresh build + existing DBs |
| `migrations/2026-06-15_customer_systems_vault.sql` | **Required** migration | Yes | Fresh build + existing DBs |
| `migrations/2026-06-15_audit_log_core.sql` | **Required** migration | Yes (`IF NOT EXISTS` + `CREATE OR ALTER`) | Fresh build + existing DBs (independent; additive only) |
| `migrations/2026-06-15_smart_assignment_persistence_explainability.sql` | **Required** migration | Yes | Fresh build + existing DBs (run **before** factor activation) |
| `migrations/2026-06-15_smart_assignment_factor_activation.sql` | **Required** migration | Yes | Fresh build + existing DBs (run **after** persistence) |
| `migrations/2026-06-17_dashboard_command_center.sql` | **Required** migration | Yes (`CREATE OR ALTER`) | Fresh build + existing DBs (independent; read-only SPs only) |
| `migrations/2026-06-19_workplan_reports_overhaul.sql` | **Required foundation** | Yes (guarded additive DDL/backfill) | Fresh build + existing DBs; after earlier required migrations |
| `migrations/2026-06-19_workitems_check_constraints_null_semantics_fix.sql` | **Required corrective** | Yes (drop/recreate two CHECK constraints) | Fresh build + existing DBs; **immediately after** the WorkPlan/report foundation |
| `migrations/2026-06-20_geo_rec_tables_canonical.sql` | **Required** migration | Yes (creates geo tables only when missing; adds `Latitude`/`Longitude` when missing) | Fresh build + existing DBs (adds coordinate columns **not** in the baseline geo tables) |
| `migrations/2026-06-20_geo_address_coordinates.sql` | **Required** migration | Yes (verifies/adds `DECIMAL(9,6)` coordinate columns) | Fresh build + existing DBs; **after** the geo canonical migration |
| `migrations/2026-07-18_smart_assignment_policy_profiles.sql` | **Required** migration | Yes | Fresh build + existing DBs |
| `migrations/2026-07-19_smart_assignment_multi_role_feedback.sql` | **Required** migration | Yes | Fresh build + existing DBs (**after** policy profiles) |
| `migrations/2026-07-19_smart_assignment_assignment_feedback_link.sql` | **Required** migration | Yes | Fresh build + existing DBs (**after** multi-role feedback) |
| `migrations/2026-06-19_legacy_data_migration.sql` | Read-only diagnostics | Yes | Existing populated DBs after foundation |
| `migrations/2026-06-19_planned_datetime_utc.sql` | Read-only by default; operator-gated conversion | Yes | Existing populated DBs after foundation |
| other `migrations/*.sql` (earlier 2026-06-0x feature scripts, `2026-06-18_*`, legacy/diagnostic 2026-06-19 scripts) | Upgrade-only migration | Yes | **Not part of the required fresh-build order**; retained to upgrade **older** DBs |
| `seed/2026-06-14_permission_roles.sql` | **Required** seed (role catalog) | Yes | Fresh build |
| `seed/initial_admin/00_seed_initial_admin.sql` | **Required** seed (first login) | Yes | Fresh build |
| `seed/2026-06-07_dev_realistic/0x..10` | Optional dev demo data | Yes (re-runnable) | Demo dataset only — **never production** (it deletes operational data) |
| `cleanup/2026-06-01_drop_legacy_functions.sql` | Manual cleanup | N/A | Only on old DBs that still contain removed legacy functions |
| `SP/2026-04-20_workplan_algorithm_data_model_extension.sql` | Historical `ALTER` migration | Yes | Folded into baseline; not needed for fresh build |
| `SP/2026-04-20_seed_WorkPlanAlgorithmDemoData.sql` | Demo `UPDATE` seed | **No / risky** | **Do not run** against real data — it mutates specific rows |

---

## 4. Database build (fresh database)

Run the steps **in this exact order**. Steps 1–3 build the empty database, baseline schema, and
functions; step 4 applies **all 14 required migrations** in strict dependency order; step 5 deploys
the canonical stored-procedure folder **once, after the migrations**; step 6 seeds the role catalog
and first admin.

> ⚠️ **Why stored procedures deploy *after* the migrations.** An earlier version of this runbook
> deployed `SP/*.sql` before the migrations and re-deployed them afterwards. That order is **wrong**
> and fails on a real SQL Server: several canonical procedures (for example
> `sp_AssignEmployeeToWork.sql` and `sp_UpdateEmployeeWorkAssignment.sql`) reference
> `WorkEmployeeAssignments.SmartAssignmentRecommendationId`, a **column added by migration
> `2026-07-19_smart_assignment_assignment_feedback_link.sql`**. SQL Server may defer a reference to a
> **missing table**, but it does **not** defer a reference to a **missing column on an existing
> table** — so creating those procedures before that column exists raises an error and aborts the
> deploy. Deploy the SP folder exactly **once, after every migration has run**.

### Step 1 — Create / select the database (one-time)
```sql
-- CREATE DATABASE [ManageR2_Dev];   -- only on a fresh instance
USE [ManageR2_Dev];
GO
```
**Verify:** `SELECT DB_NAME();` returns your target DB (not `master`).

### Step 2 — Baseline schema (one-time, empty DB)
Run `database/schema/tables.sql` → creates 38 tables + indexes, PKs, FKs, defaults, checks.
**Verify:** `SELECT COUNT(*) FROM sys.tables;` → 38.

### Step 3 — Functions (idempotent)
Run every file in `database/functions/` (order irrelevant). → `funcParseTaskPriority`, `funcParseTaskStatus`.

### Step 4 — Required migrations (idempotent, **order-sensitive**)
Run all **14** required migrations, **in this exact order**. The order is **not** discoverable from a
filename sort — always use the explicit list below. Do **not** deploy any canonical `SP/*.sql` file
before this step (see the "Why stored procedures deploy after the migrations" note above); the SP
folder is deployed once in step 5.

1. `migrations/2026-06-11_project_inventory_drawings_files.sql` — links `ProjectBoqItems`/`ProjectEquipmentItems` rows to `InventoryItems`, adds optional BOQ unit pricing, and adds server-side drawing-file metadata columns. **Required for a fresh build:** these columns are **not** in the baseline `schema/tables.sql`.
2. `migrations/2026-06-14_users_login_lockout.sql` — adds 2 `Users` columns + 3 `sp_Users_*` SPs.
3. `migrations/2026-06-15_customer_systems_vault.sql` — adds 3 Vault tables + 11 Vault SPs.
4. `migrations/2026-06-15_audit_log_core.sql` — adds the `AuditLog` table (+2 indexes) and SPs `sp_AuditLog_Create`, `sp_AuditLog_GetList`. Additive and independent of the Smart Assignment migrations.
5. `migrations/2026-06-15_smart_assignment_persistence_explainability.sql` — adds `Rec_GetDraftTaskRecommendationInput`, updates `Rec_GetLatestRecommendationsForTask`. Run **before** factor activation (#6).
6. `migrations/2026-06-15_smart_assignment_factor_activation.sql` — updates `Rec_GetTaskRecommendationInput` **and** `Rec_GetDraftTaskRecommendationInput` to emit result sets 13 (current load) + 14 (continuity). Must run **after** #5.
7. `migrations/2026-06-17_dashboard_command_center.sql` — adds six read-only `sp_Dashboard_*` procedures that back `GET /api/dashboard`. Additive and order-independent (only references baseline tables for reads).
8. `migrations/2026-06-19_workplan_reports_overhaul.sql` — adds the WorkPlan/report foundation, guarded legacy backfills, and empty migration-control/audit tables. Stop on unknown report status. Creates **filtered indexes**, so it sets the required session options (`SET QUOTED_IDENTIFIER ON;` etc.) at the top of the script; run it with `sqlcmd -I` (the helper does) or in SSMS, never with `QUOTED_IDENTIFIER OFF`.
9. `migrations/2026-06-19_workitems_check_constraints_null_semantics_fix.sql` — replaces the two WorkItems type/category CHECK constraints with NULL-safe `CASE ... ELSE 0 END = 1` expressions (`WITH NOCHECK`, no data mutation). **Run immediately after the WorkPlan/report foundation (#8).**
10. `migrations/2026-06-20_geo_rec_tables_canonical.sql` — creates `Rec_EmployeeBaseAddress`, `Rec_SiteAddressProfile`, `Rec_RouteEstimates` only when missing, and adds `Latitude`/`Longitude` (`DECIMAL(9,6)`) coordinate columns. **Required for a fresh build:** the coordinate columns are **not** in the baseline geo tables.
11. `migrations/2026-06-20_geo_address_coordinates.sql` — verifies (and, on older DBs, adds) the `DECIMAL(9,6)` coordinate columns on the geo profile tables. Must run **after** #10.
12. `migrations/2026-07-18_smart_assignment_policy_profiles.sql` — creates `Rec_SmartAssignmentPolicyProfiles` + `Rec_SmartAssignmentPolicyVersions` (seeded), the immutable-version trigger, and adds the policy columns (`PolicyProfileKey`, `PolicyVersionNumber`, `PolicyDisplayName`, `PolicySnapshotJson`) to `Rec_TaskAssignmentRecommendations`.
13. `migrations/2026-07-19_smart_assignment_multi_role_feedback.sql` — creates `EmployeeProfessions`, `WorkItemRequiredRoles`, and `Rec_RecommendationFeedback`, plus planned-stop/location coordinate columns. **Requires #12 first** (asserts the policy columns exist, else `THROW 53304`).
14. `migrations/2026-07-19_smart_assignment_assignment_feedback_link.sql` — adds `WorkEmployeeAssignments.SmartAssignmentRecommendationId` (+FK/index) and switches recommendation feedback to one shared row per recommendation. **Requires #13 first** (asserts `Rec_RecommendationFeedback` exists, else `THROW 54102`).

> ⚠️ **Two dependency chains are NOT discoverable from filenames — never use a glob/alphabetical sort:**
> - **Smart-assignment draft factors:** `persistence_explainability` (#5) must run **before**
>   `factor_activation` (#6). Both `CREATE OR ALTER` `Rec_GetDraftTaskRecommendationInput` (#5 with 12
>   result sets, #6 with 14); the factor-activation version must be applied **last**. "f" < "p", so an
>   alphabetical sort reverses them and silently downgrades the draft procedure back to 12 result sets
>   (workload/continuity factors then read as neutral on the New-Task draft flow, with no error).
> - **Smart-assignment feedback chain:** the order is `policy_profiles` (#12) → `multi_role_feedback`
>   (#13) → `assignment_feedback_link` (#14). "assignment" < "multi", so an alphabetical sort runs
>   `assignment_feedback_link` first and it `THROW 54102`s because `Rec_RecommendationFeedback` does
>   not yet exist.
>
> Always use the explicit numbered order above.

> ℹ️ Several migrations are individually order-independent (the audit-log migration only adds new
> objects and reads the baseline `Users` table for display joins; the dashboard migration only adds
> read-only SPs). They are listed above purely to give one unambiguous sequence — running the whole
> list top to bottom is always correct.

> **Verify factor activation won:** the SSMS query in [§7](#7-final-verification--ssms-queries) checks
> that `Rec_GetDraftTaskRecommendationInput`'s definition contains the `13. CURRENT LOAD` /
> `14. CONTINUITY` blocks. Because Step 5 deploys the canonical `SP/Rec_GetDraftTaskRecommendationInput.sql`
> **after** all migrations, the canonical body is always the final one regardless of migration ordering.

> The remaining files under `migrations/` — the earlier 2026-06-0x feature scripts (company settings,
> reports lifecycle, employees CRUD, service calls, project equipment/BOQ, sites deactivate, inventory,
> quotes, internal work context), `2026-06-18_*`, and the legacy/diagnostic 2026-06-19 scripts
> (`legacy_data_migration*`, `planned_datetime_utc`) — are **not** part of the required fresh-build
> order. They are retained to upgrade **older** databases and are idempotent.

### Step 5 — Canonical stored procedures (idempotent, run **after** all migrations)
Run every `database/SP/*.sql` **except** the two `2026-04-20_*` files
(`2026-04-20_workplan_algorithm_data_model_extension.sql` and
`2026-04-20_seed_WorkPlanAlgorithmDemoData.sql`). Order within the folder is irrelevant
(`CREATE OR ALTER`). This is the **single** SP deployment for a fresh build, and it runs **after**
Step 4 so that every table and column a procedure references already exists — SQL Server defers a
missing table reference but **not** a missing column on an existing table (see the "Why stored
procedures deploy after the migrations" note above). It installs the final canonical body of every
procedure, including the 22 formerly migration-only procedures (11 Vault, 3 login-lockout, 2 AuditLog,
6 Dashboard) that now have canonical `SP/` files. The migrations remain required for the tables,
columns, indexes, constraints, and data transformations they perform — deploying the SP folder does
**not** replace them.

### Step 6 — Required seeds (idempotent)
1. `seed/2026-06-14_permission_roles.sql` — inserts roles `SeniorManagement`, `ProjectManager`,
   `Office`, `Technician`, `Inventory` (so `sp_UpsertUserRole` can grant them; `Admin` is seeded below).
2. `seed/initial_admin/00_seed_initial_admin.sql` — creates the `Admin` role + the bootstrap admin
   user and grants it. **Required for first login** (a schema-only DB has no users/roles).

   | Field | Default (dev) |
   |---|---|
   | Email (login) | `admin@manager2.local` |
   | Username | `admin` |
   | Password | `Admin#2026!` |

   Idempotent and **never overwrites an existing user's password**. To change the password, regenerate
   the two hash literals with `seed/initial_admin/generate_password_hash.ps1 -Password 'NewPassword'`
   and paste them into the seed before running. **Change the default before any shared environment.**

### Step 7 — (Optional) realistic demo dataset
For a populated demo only, run `seed/2026-06-07_dev_realistic/01..10` in numeric order — see that
folder's `00_README.md`. **Development only**; it deletes operational data and requires an existing
active admin. Skip for a clean/empty demo.

### PowerShell helper (explicit, correct order)
```powershell
$ErrorActionPreference = 'Stop'
$server = 'localhost'
$db     = 'ManageR2_Dev'
$root   = '.\database'

# Reusable runner. Every SQL file goes through this so the behaviour is identical everywhere:
#   -I  uppercase: establishes QUOTED_IDENTIFIER ON for the connection (required by filtered indexes,
#       indexed views, and computed-column indexes; sqlcmd otherwise defaults QUOTED_IDENTIFIER OFF).
#   -b  makes sqlcmd return a non-zero exit code on the first SQL error.
# IMPORTANT: -b alone does NOT stop a PowerShell pipeline — sqlcmd is a native exe, so a non-zero exit
# code does not throw. We MUST check $LASTEXITCODE after every invocation and abort the whole process,
# otherwise the build would silently continue after a failed file.
function Invoke-ManageR2SqlFile {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] [string] $Path
    )
    Write-Host "==> [$Label] $Path"
    sqlcmd -S $server -d $db -b -I -i $Path
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED [$Label] exit code $LASTEXITCODE : $Path" -ForegroundColor Red
        exit $LASTEXITCODE   # stop the ENTIRE fresh build at the first failed file
    }
}

# 1) baseline schema (empty DB only)
Invoke-ManageR2SqlFile -Label 'schema' -Path "$root\schema\tables.sql"

# 2) functions (deterministic order)
Get-ChildItem "$root\functions\*.sql" | Sort-Object Name | ForEach-Object {
    Invoke-ManageR2SqlFile -Label 'function' -Path $_.FullName
}

# 3) required migrations — EXPLICIT dependency order (do NOT sort the folder; a glob sort is wrong)
$migrations = @(
  "$root\migrations\2026-06-11_project_inventory_drawings_files.sql",
  "$root\migrations\2026-06-14_users_login_lockout.sql",
  "$root\migrations\2026-06-15_customer_systems_vault.sql",
  "$root\migrations\2026-06-15_audit_log_core.sql",
  "$root\migrations\2026-06-15_smart_assignment_persistence_explainability.sql",
  "$root\migrations\2026-06-15_smart_assignment_factor_activation.sql",
  "$root\migrations\2026-06-17_dashboard_command_center.sql",
  "$root\migrations\2026-06-19_workplan_reports_overhaul.sql",
  "$root\migrations\2026-06-19_workitems_check_constraints_null_semantics_fix.sql",
  "$root\migrations\2026-06-20_geo_rec_tables_canonical.sql",
  "$root\migrations\2026-06-20_geo_address_coordinates.sql",
  "$root\migrations\2026-07-18_smart_assignment_policy_profiles.sql",
  "$root\migrations\2026-07-19_smart_assignment_multi_role_feedback.sql",
  "$root\migrations\2026-07-19_smart_assignment_assignment_feedback_link.sql"
)
foreach ($migration in $migrations) {
    Invoke-ManageR2SqlFile -Label 'migration' -Path $migration
}

# 4) canonical stored procedures — ONCE, AFTER the migrations. Exclude exactly the two dated historical
#    files by name (do NOT exclude by a '2026-*' glob — that would also skip future dated SP files).
#    SQL Server defers a missing TABLE reference, but NOT a missing COLUMN on an existing table, so
#    procedures that read migration-added columns (e.g. WorkEmployeeAssignments.SmartAssignmentRecommendationId)
#    must be created only after the migrations above have run.
$excludedSpFiles = @(
  '2026-04-20_workplan_algorithm_data_model_extension.sql',
  '2026-04-20_seed_WorkPlanAlgorithmDemoData.sql'
)
Get-ChildItem "$root\SP\*.sql" |
  Where-Object { $excludedSpFiles -notcontains $_.Name } |
  Sort-Object Name |
  ForEach-Object { Invoke-ManageR2SqlFile -Label 'stored-procedure' -Path $_.FullName }

# 5) required seeds
Invoke-ManageR2SqlFile -Label 'seed' -Path "$root\seed\2026-06-14_permission_roles.sql"
Invoke-ManageR2SqlFile -Label 'seed' -Path "$root\seed\initial_admin\00_seed_initial_admin.sql"

# Any ad-hoc verification query must use the SAME failure check (note -I and -b), e.g.:
# sqlcmd -S $server -d $db -b -I -Q "SELECT COUNT(*) FROM sys.tables;"
# if ($LASTEXITCODE -ne 0) { Write-Host "FAILED [verify] exit code $LASTEXITCODE" -ForegroundColor Red; exit $LASTEXITCODE }
```
> **Why `-I` (uppercase).** Filtered indexes — and indexed views / computed-column indexes — can only be
> created when `QUOTED_IDENTIFIER` is `ON`. `sqlcmd` defaults `QUOTED_IDENTIFIER` **OFF** (unlike SSMS,
> which defaults it ON), so without `-I` the WorkPlan/report migration fails with
> *"CREATE INDEX failed because the following SET options have incorrect settings: 'QUOTED_IDENTIFIER'."*
> Passing `-I` establishes that connection option for every file.
> **Belt-and-braces:** the SQL scripts that create filtered indexes also set the required options
> **inside the script** (`SET QUOTED_IDENTIFIER ON;` etc.), so manual SSMS/Azure Data Studio execution
> is correct even without relying on the client default.
> **Why the `$LASTEXITCODE` check.** `-b` only sets a non-zero **exit code**; because `sqlcmd` is a
> native executable, that does **not** stop a PowerShell pipeline on its own. `Invoke-ManageR2SqlFile`
> checks `$LASTEXITCODE` after each file and calls `exit`, so the first failed file halts the whole
> build and prints the exact failing label and path.
> Never execute `igroup30_prod.sql`; it is read-only reference material.
> Hebrew seed files are UTF-8 **with BOM**; `sqlcmd` auto-detects the BOM (force with `-f 65001` if needed).

### Existing-database upgrade (not a fresh build)

For a database that already exists (for example one matching the reviewed schema snapshot), do **not**
re-run `schema/tables.sql`. Instead:

1. Run only the migrations required to move that database to the current state, in their documented
   dependency order (see [§3](#3-script-taxonomy-what-each-folder-is) and the in-place phase at the top
   of this runbook). Migrations are what create/alter tables, columns, indexes, constraints, and
   transform data.
2. Re-deploy the affected canonical `database/SP/*.sql` files (idempotent `CREATE OR ALTER`) so the
   final procedure bodies match the repository.
3. Run any explicitly approved data/seed fixes and the post-deployment validation.

Adding a canonical `SP/` file does **not** remove or replace the migration that also creates the
supporting tables/columns/indexes — an existing database still needs those structural migrations. The
canonical `SP/` file only owns the final procedure body; it does not reproduce schema changes.

---

## 5. Application configuration (user-secrets / environment variables)

The API reads these via `IConfiguration` (user-secrets in dev, environment variables in prod). The
non-secret defaults live in `appsettings.json` with placeholder sentinels (`__SET_WITH_...__`); the API
**fails fast** if `Jwt:Key` or the connection string are not overridden, and **vault operations fail**
(not startup) if the encryption key is missing/invalid.

| Setting (config path) | Required | Purpose / format | Env-var form |
|---|---|---|---|
| `ConnectionStrings:DefaultConnection` | **Yes** | SQL Server connection string | `ConnectionStrings__DefaultConnection` |
| `Jwt:Key` | **Yes** | JWT signing key, **≥ 32 chars** (HMAC) | `Jwt__Key` |
| `Jwt:Issuer` | Yes (default `ManageR2`) | Token issuer | `Jwt__Issuer` |
| `Jwt:Audience` | Yes (default `ManageR2Client`) | Token audience | `Jwt__Audience` |
| `Jwt:ExpirationMinutes` | No (default `480`) | Access-token lifetime | `Jwt__ExpirationMinutes` |
| `CustomerSystemsVault:EncryptionKey` | **Yes for Vault** | **Base64-encoded 32-byte (256-bit) AES key** | `CustomerSystemsVault__EncryptionKey` |
| `Cors:AllowedOrigins` | Prod only | Extra allowed web origins (array) | `Cors__AllowedOrigins__0`, `__1`, … |
| `RateLimiting:Login:PermitLimit` / `WindowSeconds` | No (10 / 60) | Per-IP login throttle | `RateLimiting__Login__PermitLimit` |

> CORS already always allows local dev origins (`http://localhost:5173`, `:5500`, and `127.0.0.1`
> equivalents). Add production web origins via `Cors:AllowedOrigins`.

### Set dev secrets (from `apps/api/ManageR2.Api/`)
```powershell
cd apps/api/ManageR2.Api
dotnet user-secrets init   # first time only (project already has a UserSecretsId if previously initialized)

dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Database=ManageR2_Dev;Trusted_Connection=True;TrustServerCertificate=True;"
dotnet user-secrets set "Jwt:Key" "<a-random-string-of-at-least-32-characters>"

# Customer Systems Vault key — base64 of 32 random bytes (AES-256):
$key = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
dotnet user-secrets set "CustomerSystemsVault:EncryptionKey" $key
```
> ⚠️ **The Vault encryption key is permanent for stored secrets.** Changing it makes all previously
> encrypted secrets undecryptable. Back it up securely (e.g. a password manager / key vault) and reuse
> the **same** key across restarts and environments that must read the same secrets.

A copyable template lives at `apps/api/ManageR2.Api/appsettings.Development.example.json` (do **not**
commit real secrets into `appsettings*.json`).

### Frontend environment (web)
The web app reads (Vite, `apps/web`):

| Var | Default | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | API base path/URL. |
| `VITE_APP_DATA_MODE` | `local` | `local` = real API (default). `mock` = offline mock data (**dev only**, blocked in production builds). |

---

## 6. Build & run

### Backend
```bash
cd apps/api
dotnet build ManageR2.Backend.sln
dotnet run --project ManageR2.Api
```

### Frontend
```bash
# from repo root
npm install        # first time
npm run dev        # dev server (Vite)
npm run build      # production build of apps/web
```

---

## 7. Final verification & SSMS queries

Run these against the target database after [§4](#4-database-build-fresh-database).

```sql
-- (a) Object counts after the complete current fresh build (baseline + all 14 migrations + one SP deploy).
-- Expect USER_TABLE = 55, SQL_SCALAR_FUNCTION = 2, VIEW = 0.
-- SQL_STORED_PROCEDURE is INFORMATIONAL: record the value a clean fresh build produces here; do not
-- treat any hard-coded procedure count as authoritative. Rely on the named checks (d)/(e) for correctness.
-- After an approved timezone conversion, USER_TABLE becomes 57.
SELECT type_desc, COUNT(*) AS Cnt
FROM sys.objects
WHERE is_ms_shipped = 0 AND schema_id = SCHEMA_ID('dbo')
  AND type_desc IN ('USER_TABLE','SQL_STORED_PROCEDURE','SQL_SCALAR_FUNCTION','VIEW')
GROUP BY type_desc ORDER BY type_desc;
-- USER_TABLE = 55, SQL_SCALAR_FUNCTION = 2, VIEW = 0, SQL_STORED_PROCEDURE = (informational — record from a clean build)

-- (b) Customer Systems Vault tables exist (expect 3 rows)
SELECT name FROM sys.tables
WHERE name IN ('CustomerSystems','CustomerSystemSecrets','CustomerSystemSecretAccessLog');

-- (c) Login-lockout columns exist (expect 2 rows)
SELECT name FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Users') AND name IN ('FailedLoginAttempts','LockoutUntilUtc');

-- (d) Key Smart Assignment + Vault + lockout procedures exist (expect 9 rows)
SELECT name FROM sys.procedures
WHERE name IN (
  'Rec_GetTaskRecommendationInput','Rec_GetDraftTaskRecommendationInput',
  'Rec_CreateRecommendationRun','Rec_SaveTaskAssignmentRecommendation','Rec_GetLatestRecommendationsForTask',
  'sp_CustomerSystemSecrets_GetForReveal','sp_CustomerSystemSecrets_LogAccess',
  'sp_Users_RegisterFailedLogin','sp_Users_ClearFailedLogin')
ORDER BY name;

-- (e) Factor-activation applied LAST (draft proc must contain result sets 13 & 14)
SELECT
  CASE WHEN OBJECT_DEFINITION(OBJECT_ID('dbo.Rec_GetDraftTaskRecommendationInput')) LIKE '%13. CURRENT LOAD%'
        AND OBJECT_DEFINITION(OBJECT_ID('dbo.Rec_GetDraftTaskRecommendationInput')) LIKE '%14. CONTINUITY%'
       THEN 'PASS — factor activation applied' ELSE 'FAIL — inspect or redeploy the canonical Rec_GetDraftTaskRecommendationInput procedure' END AS DraftProcState;

-- (f) Roles exist (expect Admin + 5 = 6)
SELECT RoleName, IsActive FROM dbo.Roles ORDER BY RoleName;

-- (g) Admin user can log in (active user with active Admin role)
SELECT u.UserId, u.Username, u.Email, u.IsActive,
       CAST(CASE WHEN EXISTS (
         SELECT 1 FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.RoleId = ur.RoleId
         WHERE ur.UserId = u.UserId AND ur.IsActive = 1 AND r.RoleName = 'Admin') THEN 1 ELSE 0 END AS BIT) AS HasActiveAdminRole
FROM dbo.Users u WHERE u.Email = 'admin@manager2.local';

-- (h) Recommendation persistence tables exist & are queryable
SELECT COUNT(*) AS RunRows FROM dbo.Rec_RecommendationRuns;
SELECT COUNT(*) AS RecRows FROM dbo.Rec_TaskAssignmentRecommendations;

-- (i) Audit log table exists (expect 1 row)
SELECT name FROM sys.tables WHERE name = 'AuditLog';

-- (j) Audit log stored procedures exist (expect 2 rows: sp_AuditLog_Create, sp_AuditLog_GetList)
SELECT name FROM sys.procedures
WHERE name IN ('sp_AuditLog_Create','sp_AuditLog_GetList')
ORDER BY name;

-- (k) Sample the latest audit rows (newest-first). Empty on a brand-new DB until the first audited action.
SELECT TOP (20)
       AuditLogId, OccurredAtUtc, UserId, Action, EntityType, EntityId, Severity, Summary
FROM dbo.AuditLog
ORDER BY OccurredAtUtc DESC, AuditLogId DESC;
```

### Final verification checklist
- [ ] **Tables exist** — query (a) returns `USER_TABLE = 55` for the complete fresh build (`57` after approved timezone conversion).
- [ ] **Important SPs exist** — query (d) returns all 9; query (a)'s `SQL_STORED_PROCEDURE` count is informational (record the value from a clean fresh build; correctness is confirmed by the named checks, not a hard-coded total).
- [ ] **Vault tables + lockout columns** — queries (b) = 3 rows, (c) = 2 rows.
- [ ] **Smart Assignment SPs exist & factor activation applied** — query (e) = `PASS`.
- [ ] **Audit log objects exist** — query (i) = 1 row (`AuditLog`); query (j) = 2 rows (`sp_AuditLog_Create`, `sp_AuditLog_GetList`).
- [ ] **Roles exist** — query (f) shows `Admin`, `SeniorManagement`, `ProjectManager`, `Office`, `Technician`, `Inventory`.
- [ ] **Admin can log in** — query (g) shows the admin user `IsActive = 1`, `HasActiveAdminRole = 1`; confirm by logging into the web app with `admin@manager2.local` / `Admin#2026!`.
- [ ] **Vault encryption key configured** — `CustomerSystemsVault:EncryptionKey` is set (base64, decodes to 32 bytes); opening a customer's Vault section and revealing a secret works without the "encryption key is not configured" error.
- [ ] **Recommendation run persistence works** — query (h) runs; then in the app, open New Task → run Smart Assignment → save the task → re-run (h): `Rec_TaskAssignmentRecommendations` row count increases.
- [ ] **Audit log records security/operational events** — perform each action below, then re-run query (k) and confirm a new newest row with the expected `Action`:
  - [ ] **Successful login** — log in with valid credentials → a `LoginSucceeded` row (`EntityType = User`).
  - [ ] **Wrong password** — attempt login with a bad password → a `LoginFailed` row (`Severity = Warning`).
  - [ ] **Vault secret reveal** — reveal a customer system secret → a `CustomerSystemSecretRevealed` row, and its `MetadataJson`/`Summary` contain **no plaintext secret** (only identifiers/metadata).
  - [ ] **User role update** — change a user's role/details (Admin) → a `UserUpdated` row (`EntityType = User`).
- [ ] **Backend build works** — `dotnet build ManageR2.Backend.sln` → `Build succeeded`.
- [ ] **Frontend build works** — `npm run build` → succeeds.

> 🔒 **`AuditLog` is append-only.** Rows are written server-side only (there is no public create/update/delete
> endpoint), and the table is an immutable security/operational trail. **Do not manually delete or truncate
> `AuditLog` in production** unless explicitly approved by a system owner (e.g. an approved retention policy).
> The only sanctioned deletes are the self-test cleanup rows in a non-production DB (see the migration's
> SSMS verification block).

---

## 8. Reconciliation: repo scripts vs current database

Comparison of the repository scripts against the attached `igroup30_prod.sql` dump.

**Pre-overhaul match (the earlier repo + required migrations reproduce the read-only dump):**
- 42 tables = 38 (`schema/tables.sql`) + 3 Vault (vault migration) + 1 `AuditLog` (audit-log migration).
- 134 SPs = 117 (`SP/`) + 11 Vault + 3 login-lockout + 1 SA draft + 2 AuditLog (migrations).
- 2 scalar functions, 0 views, 0 triggers — match.

**Mismatches / stale documentation found (no schema change made — documentation-first):**
1. **`database/README.md` is out of date.** It states 36 tables / 108 SPs and says the `migrations/`
   folder is "historical / not part of a fresh rebuild." That is no longer true: the Vault, login-lockout,
   and SA-draft objects exist **only** in migrations and are **required**. This runbook is authoritative;
   a short pointer was added to the README header.
2. **`schema/tables.sql` does not contain** the 3 Vault tables, the `AuditLog` table, or the `Users`
   lockout columns — these are intentionally delivered by migrations (the baseline snapshot predates them).
   Not a defect; just means migrations are mandatory for a fresh build. **No schema edit made.**
3. **Same-day SA migration ordering** (`persistence_explainability` before `factor_activation`; and
   `policy_profiles` → `multi_role_feedback` → `assignment_feedback_link`) is **not** discoverable from
   filenames (alphabetical sort reverses them). Documented as an explicit ordered list in
   [§4 step 4](#step-4--required-migrations-idempotent-order-sensitive). **No file renamed.**

Nothing in the repo conflicts with the dump's object definitions; the only gaps are the
migration-delivered objects above, which the ordered build applies.

---

## 9. Authoritative vs duplicate / risky scripts

- **Quotes SPs** appear both in `SP/sp_Quotes_*.sql` (canonical) and inside `migrations/2026-06-04_quotes_mvp.sql`.
  Authoritative = the `SP/` files (and the baseline `Quotes`/`QuoteLineItems` tables in `schema/tables.sql`).
  The migration is idempotent and only needed to upgrade a pre-quotes database.
- The "canonical `SP/` file + idempotent migration copy" pattern applies to company settings, reports
  lifecycle, employees CRUD, service calls, sites deactivate, inventory, and internal work context: for a
  **fresh** build the `SP/` files are authoritative and those matching migrations are upgrade-only (safe
  to skip on a fresh build).
  **Exception — do not skip the structural project migration:**
  `migrations/2026-06-11_project_inventory_drawings_files.sql` is **required** for a fresh build because it
  adds `ProjectBoqItems`/`ProjectEquipmentItems` inventory-link columns and drawing-file metadata columns that
  are **not** in the baseline `schema/tables.sql`. It is a structural migration, not an SP duplicate.
- **`Rec_GetTaskRecommendationInput`** is defined by exactly **one** canonical file,
  `SP/Rec_GetTaskRecommendationInput.sql` (the 2026-06-15 factor-activation migration also contains a
  historical copy; both agree on result sets 13/14). `SP/Rec_GetDraftTaskRecommendationInput.sql` no
  longer duplicates it — that canonical file now defines **only** `Rec_GetDraftTaskRecommendationInput`,
  removing the earlier deployment-order-dependent duplicate body.
- **`Rec_GetDraftTaskRecommendationInput`** is canonical in `SP/Rec_GetDraftTaskRecommendationInput.sql`
  (Step 5 deploys it after all migrations, so it is authoritative over the historical migration copies).
- **Risky / do-not-run-blindly:**
  - `SP/2026-04-20_seed_WorkPlanAlgorithmDemoData.sql` — **not idempotent**; mutates specific
    employee/work-item rows for a demo scenario. Do not run against real data.
  - `seed/2026-06-07_dev_realistic/01_cleanup_operational_data.sql` (and the rest of that folder) —
    **deletes operational data**. Development only; back up first. Each script guards against system
    databases and missing core tables.
  - `cleanup/2026-06-01_drop_legacy_functions.sql` — manual `DROP`; run only on old DBs that still
    contain the removed legacy functions.
- **Do not delete** any of the above; they are intentional history / dev tooling, not temporary leftovers.

---

## 10. One-page quick start (fresh dev DB)

```
1. CREATE DATABASE [ManageR2_Dev]; USE [ManageR2_Dev];
2. Run  schema/tables.sql
3. Run  functions/*.sql
4. Run  migrations, in this exact order (NOT alphabetical):
     2026-06-11_project_inventory_drawings_files.sql
     2026-06-14_users_login_lockout.sql
     2026-06-15_customer_systems_vault.sql
     2026-06-15_audit_log_core.sql
     2026-06-15_smart_assignment_persistence_explainability.sql
     2026-06-15_smart_assignment_factor_activation.sql          (must be after persistence_explainability)
     2026-06-17_dashboard_command_center.sql
     2026-06-19_workplan_reports_overhaul.sql
     2026-06-19_workitems_check_constraints_null_semantics_fix.sql   (immediately after the foundation)
     2026-06-20_geo_rec_tables_canonical.sql
     2026-06-20_geo_address_coordinates.sql                     (after geo_rec_tables_canonical)
     2026-07-18_smart_assignment_policy_profiles.sql
     2026-07-19_smart_assignment_multi_role_feedback.sql        (after policy_profiles)
     2026-07-19_smart_assignment_assignment_feedback_link.sql   (LAST of the SA chain — after multi_role_feedback; NOT alphabetical)
5. Run  SP/*.sql            (exclude SP/2026-*)  <- ONCE, AFTER the migrations, so canonical bodies win
6. Run  seed/2026-06-14_permission_roles.sql
        seed/initial_admin/00_seed_initial_admin.sql
7. Set secrets: ConnectionStrings:DefaultConnection, Jwt:Key (>=32), CustomerSystemsVault:EncryptionKey (base64 32B)
8. Backend:  cd apps/api && dotnet build ManageR2.Backend.sln && dotnet run --project ManageR2.Api
9. Frontend: npm install && npm run dev
10. Log in:  admin@manager2.local / Admin#2026!   then run §7 verification.
```
