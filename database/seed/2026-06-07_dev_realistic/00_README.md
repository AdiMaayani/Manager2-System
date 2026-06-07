# Dev Realistic Seed — 2026-06-07

Safe **development** database cleanup + realistic Hebrew seed for ManageR2
(Israeli low-voltage / smart-systems / project-operations domain).

> ⚠️ **Development only.** These scripts delete operational data. Never run
> them against production. Take a backup first (see *Backup & rollback*).

---

## What this does

1. **Cleans** all operational/test data in a foreign-key-safe order.
2. **Preserves** all authentication & org data:
   `Users`, `Roles`, `UserRoles`, `UserDepartments`, `Departments`,
   `CompanySettings`, the `Rec_Skills` / `Rec_WorkZones` reference catalogs,
   and every `Employee` linked to a preserved `User`.
3. **Ensures** the five named admins (Adi, Klil, Almog, Raviv, Ronen) are
   active with the `Admin` role **and linked to the correct employee** — **without
   creating users or touching passwords**.
4. **Reseeds** a coherent dataset: employees, customers, sites, contacts,
   contractors, inventory, projects, tasks, project team, BOQ, drawings,
   equipment, quotes (VAT 17%), service calls, internal/office tasks,
   Smart Assignment **input** data, and work reports.

The Smart Assignment **algorithm is not modified** — only its input tables are
seeded so it has meaningful candidates.

---

## Prerequisites

- SQL Server, with the ManageR2 schema and stored procedures already deployed
  (the scripts call existing SPs and reference existing tables).
- At least **one active `Admin` user** must already exist. Several scripts
  resolve a `SeedUserId` from an active admin and **`THROW` if none exists**
  (they never create users).
- SSMS (or `sqlcmd`) with the **correct development database selected as the
  current context**. There is **no `USE` statement** in any script.

Each script guards itself: it refuses to run against `master/model/msdb/tempdb`
and aborts if core ManageR2 tables are missing.

---

## Run order (strict)

Run **in numerical order**, each as its own batch. Stop immediately if any
script raises a red error message.

| # | File | Purpose |
|---|------|---------|
| 01 | `01_cleanup_operational_data.sql` | FK-safe delete of operational data; re-ensures the internal/office work context. |
| 02 | `02_ensure_admin_roles.sql` | Ensure `Admin` role; activate + grant Admin to the five named admins; report missing ones. |
| 02b | `02b_ensure_admin_employee_links.sql` | Link each named admin **user** to the **correct employee** (create the employee row only if missing); fixes wrong `Users.EmployeeId`. |
| 03 | `03_seed_core.sql` | Employees, customers, sites, contacts, contractors, inventory. |
| 04 | `04_seed_projects_tasks.sql` | Projects (`SEED-P01..P08`), tasks/milestones, team & contractor assignments. |
| 05 | `05_seed_project_details.sql` | BOQ, drawings, equipment for P01–P04 & P07. |
| 06 | `06_seed_quotes.sql` | Quotes + line items via the quote SPs (VAT 17%). |
| 07 | `07_seed_service_calls_internal.sql` | Service calls + internal/office tasks + their assignments. |
| 08 | `08_seed_smart_assignment_inputs.sql` | Skills, zones, employee skills/zones/capacity/availability/base address, site profiles, per-task required skills & algorithm profiles. |
| 09 | `09_seed_reports.sql` | Work reports (submitted/draft) + systems + reporter assignments. |
| 10 | `10_verify.sql` | **Read-only** verification (counts, admin status, integrity, algorithm-readiness). |

> 02 / 02b may be run before or after 01; the rest depend on the data created by
> the scripts before them, so keep the order. Run **02b after 02** (both touch the
> named admins). 02b never creates users or touches passwords — it only fixes the
> admin `User → Employee` link and creates a missing admin employee row.

---

## Idempotency

All seed scripts are safe to re-run:

- Most use **`NOT EXISTS` guards on natural keys**
  (`Employees.FullName`, `Customers.CustomerName`, `Sites (CustomerId, SiteName)`,
  `WorkItems.FinanceProjectNumber` = `SEED-Pnn`, tasks `(ParentWorkItemId, Title)`,
  service calls `(WorkType='ServiceCall', Title)`, `InventoryItems.SkuCode`,
  `Rec_*` unique keys, etc.).
- **Quotes (06)** can't be row-deduplicated (the SP mints a fresh `QuoteNumber`
  each call), so each seeded quote is tagged `SEED::Qnn` in `Notes` and the whole
  block is skipped if any seed-tagged quote already exists.
- **Cleanup (01)** is naturally idempotent (re-running deletes nothing new) and
  re-ensures the internal/office context.

Re-running the full set will **not** create duplicates.

---

## Stored procedures used

| Script | Stored procedure | Why |
|--------|------------------|-----|
| 01, 07 | `sp_WorkItems_GetInternalContext` | Get-or-create the reserved internal customer/site/container project for office tasks. |
| 02 | `sp_UpsertUserRole` | Grant/activate the `Admin` role for an existing user. |
| 06 | `sp_Quotes_Create`, `sp_Quotes_AddLine`, `sp_Quotes_RecalculateTotals` | Own `QuoteNumber` generation, line `LineTotal`, and Subtotal/VAT/Total math. |

### Where direct inserts are used (and why)

`03`, `04`, `05`, `07`, `08`, `09` use guarded, set-based **direct `INSERT`s**
instead of the matching `sp_Create*` procedures. Rationale (documented inline):

- The create SPs are **single-row** and **not idempotent** — direct set-based
  inserts with `NOT EXISTS` keep the seed re-runnable.
- They emit per-row result sets that are awkward to consume in a batch seed.
- They wrap the **same `CHECK`/FK validation the database already enforces**, so
  no business rule is bypassed.
- Direct inserts let us set fields the SPs don't expose (e.g. `ActualStart/End`,
  `ClosedAt`, historical `CreatedAt`) needed for a realistic timeline.

---

## Smart Assignment inputs (script 08)

Seeded so the existing algorithm has real candidates:

- **`Rec_Skills`, `Rec_WorkZones`** — reused if present, created only if missing.
- **`Rec_EmployeeSkills`** — per-role skill profiles (level 1–5, ratio-scored).
- **`Rec_EmployeeWorkZones`** — home (primary) zone + secondary coverage so both
  metro zones have a candidate for every role.
- **`Rec_EmployeeCapacity`** — weekly capacity (presence drives the workload score).
- **`Rec_EmployeeBaseAddress`** — home base + zone (geographic origin).
- **`Rec_EmployeeAvailability`** — one broad `Available` window covering the seed
  horizon, plus a few realistic `Leave`/`Training`/`Busy` blocks.
- **`Rec_SiteAddressProfile`** — each seeded customer site mapped to a zone.
- **`Rec_WorkItemRequiredSkills`** + **`Rec_WorkItemAlgorithmProfile`** — for every
  seeded project task and service call, aligned to `WorkItems.RequiredRole`.

Enum values match the algorithm code: `AvailabilityType` `Available` =
fully-available (blocking types: `Leave`/`Sick`/`Busy`/`Training`);
`ImportanceLevel` ∈ {`Critical`,`Important`,`Preferred`}; skill levels on a 1–5 scale.

**Left intentionally empty** (runtime/computed results, produced by running the
algorithm): `Rec_RecommendationRuns`, `Rec_TaskAssignmentRecommendations`,
`Rec_EmployeePlannedStops`, `Rec_EmployeeLocationEvents`, `Rec_RouteEstimates`.

---

## Manual SSMS steps

> **Encoding (important for Hebrew).** All `.sql` files in this folder are saved as
> **UTF-8 with BOM** so SSMS reads the Hebrew literals correctly. Do **not** re-save
> them as plain ANSI/UTF-8-without-BOM, or Hebrew will be mangled on execution.
> If you copy SQL into a *new* SSMS query window, keep it UTF-8/UTF-16 (or run the
> files directly). `sqlcmd` auto-detects the BOM; if needed, force UTF-8 with `-f 65001`.

1. **Back up** the dev database (see below).
2. Open SSMS → connect to the dev server.
3. In the database dropdown, **select the ManageR2 dev database** (do *not* rely
   on `USE`; there is none).
4. Open and execute scripts **01 → 10 in order**, one at a time.
   - Watch the **Messages** tab for `RAISERROR ... WITH NOWAIT` progress lines
     and per-table row counts.
   - Any failure rolls back that script's transaction and re-throws — fix and
     re-run from that script (they're idempotent).
5. Review the **result grids** from `10_verify.sql`; every check prints
   `PASS` / `CHECK` / `MISSING`.

`sqlcmd` alternative (PowerShell), DB selected via `-d`:

```powershell
$db = "<YourDevDatabase>"
Get-ChildItem .\0*_*.sql, .\10_verify.sql | Sort-Object Name | ForEach-Object {
    Write-Host "Running $($_.Name)";
    sqlcmd -S localhost -d $db -E -b -i $_.FullName
}
```

---

## Backup & rollback

There is **no automatic rollback** across scripts — each script is atomic on its
own, but once committed its data persists. Before running, take a full backup:

```sql
BACKUP DATABASE [<YourDevDatabase>]
TO DISK = N'<path>\ManageR2_dev_preseed_2026-06-07.bak'
WITH INIT, COMPRESSION, STATS = 10;
```

To roll back the whole operation, **restore that backup**.

---

## Verification checklist (after 10_verify.sql)

- [ ] **1.** Admin mapping grid: each named admin shows the correct `EmployeeName`,
      `IsUserActive = 1`, `IsEmployeeActive = 1`, `HasActiveAdminRole = 1` → `Result = PASS`
      (or clearly reported `MISSING` — not created).
- [ ] **1b.** `ActiveAdminCount >= 1` → `PASS`.
- [ ] **2.** Core counts: ~10 employees, 8 customers, 11 sites, 16 contacts,
      4 contractors, ~28 inventory items.
- [ ] **3.** 8 projects, ~33 project tasks, 10 service calls, 6 internal tasks,
      employee + contractor assignments present.
- [ ] **4.** BOQ / drawings / equipment present for P01–P04 & P07.
- [ ] **5.** All seeded quotes `VatRate = 17`, totals reconcile, `PASS`.
- [ ] **6.** Reports present (submitted + draft) with systems & reporter rows.
- [ ] **7 / 7b.** Every assignable employee has skills, a zone, capacity, a base
      address, and an `Available` window.
- [ ] **8.** Runtime recommendation tables are **empty** → `PASS`.
- [ ] **9.** Every `RequiredRole` has at least one matching active employee → `PASS`.
- [ ] **10.** All integrity counters are **0** (no orphans).

---

## Assumptions & limitations

- **Seeded employees are a separate field roster** (different names) from the
  preserved admin **users**, to avoid duplicating identities.
- **Admin user → employee link** is corrected by `02b`. Because `dbo.Users` has no
  name column (identity is the linked `Employees.FullName`), `02b` links each admin
  user to the employee whose **email matches the user's email**, else the employee
  with the canonical admin name, creating that employee row **only if missing**. It
  also sets the employee's canonical Hebrew full name and makes it active, so a rerun
  converges to the correct name even if a previous run stored a wrong/garbled value:
  - `adi` → `עדי מעיני`
  - `klil` → `כליל כהן`
  - `almog` → `אלמוג שלף`
  - `raviv` → `רביב מעיני`
  - `ronen` → `רונן כץ`
- Admin matching is **case-insensitive** and tolerates real-world variants:
  username `<name>` **or** `Admin - <name>` (e.g. `Klil`, `Admin - Klil`); email
  `<name>@…` **or** `admin<name>@…` (e.g. `adminKlil@example.com`); plus the known
  Almog typo email `algom@gmail.com`. If your admins use other usernames/emails,
  `02` / `02b` / `10` will report them as `MISSING` (never created).
- All dates are **deterministic offsets from the run date** (`@Today`), so the
  work-plan/Gantt horizon is always sensible relative to "today".
- Email/phone values are **illustrative** (`*-example.*` domains) and not real.
- Scope intentionally **excludes** cashflow, full invoices/accounting and payment
  tracking (out of scope per plan).
- Seed volumes are sized for a **realistic demo**, not load/perf testing.
