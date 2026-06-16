# ManageR2 — Database & Deployment Runbook

Authoritative, step-by-step procedure to rebuild, configure, and verify the ManageR2 system
(SQL Server database + ASP.NET Core API + React web app) for a clean demo or a new deployment.

> **Read this first.** This runbook supersedes the older "Run order" section of `database/README.md`.
> The README's object counts (36 tables / 108 SPs) and its "migrations are historical / optional"
> note are **out of date**: the recent feature migrations are now **required** for a fresh build.
> See [Reconciliation](#8-reconciliation-repo-scripts-vs-current-database) for details.

---

## 1. Current authoritative DB state

Validated against the production schema dump `igroup30_prod.sql` (current Ruppin database):

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

The 4 tables and 17 procedures that exist **only in migrations** (not in `schema/`/`SP/`):

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

117 + 17 = 134 SPs, 38 + 4 = 42 tables — the repo + required migrations reproduce the dump exactly.

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
| `SP/*.sql` (excl. `2026-*`) | Canonical programmability (`CREATE OR ALTER`) | Yes | Every build |
| `migrations/2026-06-14_users_login_lockout.sql` | **Required** migration | Yes (`IF NOT EXISTS` + `CREATE OR ALTER`) | Fresh build + existing DBs |
| `migrations/2026-06-15_customer_systems_vault.sql` | **Required** migration | Yes | Fresh build + existing DBs |
| `migrations/2026-06-15_smart_assignment_persistence_explainability.sql` | **Required** migration | Yes | Fresh build + existing DBs (run **before** factor activation) |
| `migrations/2026-06-15_smart_assignment_factor_activation.sql` | **Required** migration | Yes | Fresh build + existing DBs (run **after** persistence) |
| `migrations/2026-06-15_audit_log_core.sql` | **Required** migration | Yes (`IF NOT EXISTS` + `CREATE OR ALTER`) | Fresh build + existing DBs (independent; additive only) |
| other `migrations/2026-06-0x_*.sql` | Historical (folded into baseline) | Yes | Only to upgrade an **older** DB; redundant for a fresh build |
| `seed/2026-06-14_permission_roles.sql` | **Required** seed (role catalog) | Yes | Fresh build |
| `seed/initial_admin/00_seed_initial_admin.sql` | **Required** seed (first login) | Yes | Fresh build |
| `seed/2026-06-07_dev_realistic/0x..10` | Optional dev demo data | Yes (re-runnable) | Demo dataset only — **never production** (it deletes operational data) |
| `cleanup/2026-06-01_drop_legacy_functions.sql` | Manual cleanup | N/A | Only on old DBs that still contain removed legacy functions |
| `SP/2026-04-20_workplan_algorithm_data_model_extension.sql` | Historical `ALTER` migration | Yes | Folded into baseline; not needed for fresh build |
| `SP/2026-04-20_seed_WorkPlanAlgorithmDemoData.sql` | Demo `UPDATE` seed | **No / risky** | **Do not run** against real data — it mutates specific rows |

---

## 4. Database build (fresh database)

Run the steps **in this exact order**. Steps 1–4 build schema + programmability; step 5 applies the
required recent migrations; step 6 seeds the role catalog and first admin.

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

### Step 4 — Stored procedures (idempotent)
Run every `database/SP/*.sql` **except** the two `2026-04-20_*` files. Order irrelevant
(`CREATE OR ALTER` does not require referenced objects to exist at create time). → 117 procs.

### Step 5 — Required recent migrations (idempotent, **order-sensitive**)
Run these five, **in this order**:

1. `migrations/2026-06-14_users_login_lockout.sql` — adds 2 `Users` columns + 3 `sp_Users_*` SPs.
2. `migrations/2026-06-15_customer_systems_vault.sql` — adds 3 Vault tables + 11 Vault SPs.
3. `migrations/2026-06-15_audit_log_core.sql` — adds the `AuditLog` table (+2 indexes) and SPs `sp_AuditLog_Create`, `sp_AuditLog_GetList`. Additive and independent of the Smart Assignment migrations.
4. `migrations/2026-06-15_smart_assignment_persistence_explainability.sql` — adds `Rec_GetDraftTaskRecommendationInput`, updates `Rec_GetLatestRecommendationsForTask`.
5. `migrations/2026-06-15_smart_assignment_factor_activation.sql` — updates `Rec_GetTaskRecommendationInput` **and** `Rec_GetDraftTaskRecommendationInput` to emit result sets 13 (current load) + 14 (continuity).

> ℹ️ **The audit-log migration (#3) is order-independent** — it only adds new objects and references
> the existing baseline `Users` table for display joins. It is placed between the Vault and Smart
> Assignment migrations here purely for readability; it can run any time after the baseline schema.

> ⚠️ **Order matters between #4 and #5.** Both `CREATE OR ALTER` `Rec_GetDraftTaskRecommendationInput`.
> #4 defines it with 12 result sets; #5 defines it with 14. The factor-activation version (14) must be
> applied **last**, so **run #4 before #5**. A naive alphabetical filename sort runs `factor_activation`
> **before** `persistence_explainability` (because "f" < "p") — which is **wrong** and silently downgrades
> the draft procedure back to 12 result sets (workload/continuity factors then read as neutral on the
> New-Task draft flow, with no error). Always use the explicit order above, not a glob sort.
>
> **Verify #4 won:** the SSMS query in [§7](#7-final-verification--ssms-queries) checks that
> `Rec_GetDraftTaskRecommendationInput`'s definition contains the `13. CURRENT LOAD` / `14. CONTINUITY` blocks.

> The other `migrations/2026-06-0x_*.sql` files (company settings, reports lifecycle, employees CRUD,
> service calls, project equipment/BOQ/drawings, sites deactivate, inventory, quotes, internal work
> context, project file refs) are **already folded into `schema/tables.sql` + `SP/`** and are **not
> needed** for a fresh build. They remain for upgrading older databases and are idempotent.

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
$server = 'localhost'
$db     = 'ManageR2_Dev'
$root   = '.\database'

# 1) schema (empty DB only)
sqlcmd -S $server -d $db -b -i "$root\schema\tables.sql"

# 2) functions
Get-ChildItem "$root\functions\*.sql" | ForEach-Object { sqlcmd -S $server -d $db -b -i $_.FullName }

# 3) stored procedures (skip the two dated historical files)
Get-ChildItem "$root\SP\*.sql" -Exclude '2026-*' | ForEach-Object { sqlcmd -S $server -d $db -b -i $_.FullName }

# 4) required migrations — EXPLICIT order (do NOT sort the folder alphabetically)
$migrations = @(
  "$root\migrations\2026-06-14_users_login_lockout.sql",
  "$root\migrations\2026-06-15_customer_systems_vault.sql",
  "$root\migrations\2026-06-15_audit_log_core.sql",
  "$root\migrations\2026-06-15_smart_assignment_persistence_explainability.sql",
  "$root\migrations\2026-06-15_smart_assignment_factor_activation.sql"
)
$migrations | ForEach-Object { sqlcmd -S $server -d $db -b -i $_ }

# 5) required seeds
sqlcmd -S $server -d $db -b -i "$root\seed\2026-06-14_permission_roles.sql"
sqlcmd -S $server -d $db -b -i "$root\seed\initial_admin\00_seed_initial_admin.sql"
```
> `-b` makes `sqlcmd` stop on the first error so a broken deploy fails loudly.
> Hebrew seed files are UTF-8 **with BOM**; `sqlcmd` auto-detects the BOM (force with `-f 65001` if needed).

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
-- (a) Object counts — expect 42 / 134 / 2 / 0
SELECT type_desc, COUNT(*) AS Cnt
FROM sys.objects
WHERE is_ms_shipped = 0 AND schema_id = SCHEMA_ID('dbo')
  AND type_desc IN ('USER_TABLE','SQL_STORED_PROCEDURE','SQL_SCALAR_FUNCTION','VIEW')
GROUP BY type_desc ORDER BY type_desc;
-- USER_TABLE = 42, SQL_STORED_PROCEDURE = 134, SQL_SCALAR_FUNCTION = 2, VIEW = 0

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
       THEN 'PASS — factor activation applied' ELSE 'FAIL — re-run factor_activation migration' END AS DraftProcState;

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
- [ ] **Tables exist** — query (a) returns `USER_TABLE = 42`.
- [ ] **Important SPs exist** — query (d) returns all 9; query (a) returns `SQL_STORED_PROCEDURE = 134`.
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

**Matches (the repo + the five required migrations reproduce the dump exactly):**
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
3. **Same-day SA migration ordering** (`persistence_explainability` before `factor_activation`) is
   **not** discoverable from filenames (alphabetical sort reverses them). Documented as an explicit
   ordered list in [§4 step 5](#step-5--required-recent-migrations-idempotent-order-sensitive). **No file renamed.**

Nothing in the repo conflicts with the dump's object definitions; the only gaps are the
migration-delivered objects above, which the ordered build applies.

---

## 9. Authoritative vs duplicate / risky scripts

- **Quotes SPs** appear both in `SP/sp_Quotes_*.sql` (canonical) and inside `migrations/2026-06-04_quotes_mvp.sql`.
  Authoritative = the `SP/` files (and the baseline `Quotes`/`QuoteLineItems` tables in `schema/tables.sql`).
  The migration is idempotent and only needed to upgrade a pre-quotes database.
- The same "canonical `SP/` file + idempotent migration copy" pattern applies to company settings, reports
  lifecycle, employees CRUD, service calls, project equipment/BOQ/drawings, sites deactivate, inventory,
  and internal work context. For a **fresh** build, the `SP/` files are authoritative; the matching
  migrations are redundant-but-safe.
- **`Rec_GetTaskRecommendationInput`** exists in `SP/` **and** is re-defined by the factor-activation
  migration — both now emit result sets 13/14, so they agree. **`Rec_GetDraftTaskRecommendationInput`**
  exists **only** in migrations (persistence defines 12 result sets, factor activation redefines 14) —
  authoritative = factor activation (run last).
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
4. Run  SP/*.sql            (exclude SP/2026-*)
5. Run  migrations, in order:
     2026-06-14_users_login_lockout.sql
     2026-06-15_customer_systems_vault.sql
     2026-06-15_audit_log_core.sql
     2026-06-15_smart_assignment_persistence_explainability.sql
     2026-06-15_smart_assignment_factor_activation.sql      (must be last of the SA pair)
6. Run  seed/2026-06-14_permission_roles.sql
        seed/initial_admin/00_seed_initial_admin.sql
7. Set secrets: ConnectionStrings:DefaultConnection, Jwt:Key (>=32), CustomerSystemsVault:EncryptionKey (base64 32B)
8. Backend:  cd apps/api && dotnet build ManageR2.Backend.sln && dotnet run --project ManageR2.Api
9. Frontend: npm install && npm run dev
10. Log in:  admin@manager2.local / Admin#2026!   then run §7 verification.
```
