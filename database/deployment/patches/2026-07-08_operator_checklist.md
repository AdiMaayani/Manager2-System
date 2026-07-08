# Operator checklist — 2026-07-08 canonical SP redeploy

Use with:

- `database/deployment/patches/2026-07-08_precheck_redeploy_canonical_sps.sql`
- `database/deployment/patches/2026-07-08_redeploy_current_canonical_sps.sql`
- `database/deployment/patches/2026-07-08_postcheck_redeploy_canonical_sps.sql`

Repository reference commit: `3d3baa9`

---

## Before deployment

- [ ] Confirm you are **not** connected to production unless this is an approved production change window.
- [ ] Take a **full database backup** (or verified restore-point snapshot) of the target database.
- [ ] Open SSMS/sqlcmd against the **intended target only**.
- [ ] Record `SELECT @@SERVERNAME, DB_NAME();` in the change log.
- [ ] Run **pre-check** script (`2026-07-08_precheck_redeploy_canonical_sps.sql`).
- [ ] Review pre-check output:
  - [ ] All required columns show **PASS** (`ProjectBoqItems.InventoryItemId`, `UnitPrice`; `ProjectEquipmentItems.InventoryItemId`; `ProjectDrawings` file metadata columns).
  - [ ] If any column is **FAIL**, stop and apply `database/migrations/2026-06-11_project_inventory_drawings_files.sql` first (separate approved change).
  - [ ] Note which procedures show **NEEDS_PATCH** vs **PASS**.
- [ ] If all targeted procedures already show **PASS**, deployment is optional (no-op safe, but unnecessary).

## Apply patch

- [ ] Ensure script encoding is **UTF-8** (SSMS: File → Save with Encoding → UTF-8 with BOM; or `sqlcmd -f 65001`).
- [ ] Uncomment/set `-- USE [YourTargetDatabase];` in the patch script if needed.
- [ ] Execute `2026-07-08_redeploy_current_canonical_sps.sql` once.
- [ ] Confirm batch completed without errors.

## After deployment

- [ ] Run **post-check** script (`2026-07-08_postcheck_redeploy_canonical_sps.sql`).
- [ ] Confirm **OVERALL: PASS** for all 10 procedures.
- [ ] Verify procedure `modify_date` values are recent (informational).

## API / UI smoke tests (manual)

Run against the API connected to the patched database:

- [ ] **BOQ** — list, create (with/without inventory link), update unit price, reorder.
  - Endpoints: `GET/POST/PUT/DELETE /api/projects/{id}/boq`
- [ ] **Equipment** — list, create with inventory link, update.
  - Endpoints: `GET/POST/PUT/DELETE /api/projects/{id}/equipment`
- [ ] **Drawings** — list, metadata create, file upload, download.
  - Endpoints: `GET/POST /api/projects/{id}/drawings`, `POST .../drawings/upload`, `GET .../drawings/{id}/file`
- [ ] **Work plan task delete** — attempt delete on locked / reported task; confirm **readable Hebrew** error message (not mojibake).
  - Endpoint: `DELETE /api/workitems/tasks/{taskId}`
- [ ] **Report update** — edit draft report, save; confirm status default/update works.
  - Endpoint: `PUT /api/reports/{id}`

## Rollback

If a single procedure fails post-check:

1. Restore the pre-change backup **or**
2. Re-deploy the previous known-good procedure definition from your backup / prior schema export for that object only.

Do **not** run data-fix scripts as part of rollback unless separately approved.

## Files to retain in repository

Keep these paths under version control with the deployment record:

```
database/deployment/patches/2026-07-08_precheck_redeploy_canonical_sps.sql
database/deployment/patches/2026-07-08_redeploy_current_canonical_sps.sql
database/deployment/patches/2026-07-08_postcheck_redeploy_canonical_sps.sql
database/deployment/patches/2026-07-08_operator_checklist.md
database/SP/sp_ProjectBoq_*.sql
database/SP/sp_ProjectEquipment_*.sql
database/SP/sp_ProjectDrawings_*.sql
database/SP/sp_WorkItems_DeleteTask.sql
database/SP/sp_WorkReports_Update.sql
```

## Explicitly deferred

- `sp_WorkItems_GetInternalContext` — endpoint returns HTTP 410 Gone; include only if you intentionally want to refresh Hebrew seed labels in the deprecated internal-context procedure.
