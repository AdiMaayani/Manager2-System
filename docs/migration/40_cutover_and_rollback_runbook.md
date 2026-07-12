# Postgres Migration - Cutover and Rollback Runbook

Operator-executed procedure for the Phase 5 cutover and its rollback. The coding agent
does not run these steps; they require running databases and production operations.

## Preconditions (must all be satisfied)

- [ ] Global cutover gate in `00_guardrails_and_go_no_go.md` is fully green.
- [ ] Every domain parity contract is `Cutover-ready`.
- [ ] Fresh full backups of both SQL Server and PostgreSQL taken and verified.
- [ ] Change window approved; schema freeze in effect on both databases.

## Cutover procedure

1. Announce maintenance window; enable `deployment/app_offline.htm` (IIS) or equivalent drain.
2. Stop writes to SQL Server (quiesce the API or set read-only).
3. Run the final delta data-sync SQL Server -> PostgreSQL (operator tooling).
4. Run the full data validation suite (row counts, checksums, business predicates). Abort on any failure.
5. Set configuration:
   - `DataProvider:Primary = Postgres`
   - `DataProvider:DualWritePostgres = false`
   - `DataProvider:ShadowReadPostgres = false`
6. Restart the API. Confirm health endpoint and provider banner report `Postgres`.
7. Execute the post-cutover smoke suite (login, dashboard, work plan, create+finalize report, inventory movement).
8. Re-open traffic (remove offline page).
9. Keep SQL Server hot standby for the full stabilization window.

## Rollback procedure (immediate)

Trigger if smoke fails or critical errors appear post-cutover.

1. Re-enable the offline page.
2. Set configuration:
   - `DataProvider:Primary = SqlServer`
   - `DataProvider:DualWritePostgres = false`
   - `DataProvider:ShadowReadPostgres = false`
3. If any writes reached Postgres after cutover, reconcile them back to SQL Server using the
   operator reconciliation script (writes are captured in the audit log + dual-write ledger).
4. Restart the API; confirm provider banner reports `SqlServer`.
5. Re-run the smoke suite against SQL Server.
6. Re-open traffic. File an incident with the captured drift/exception evidence.

## Decommission (Phase 6, only after sustained green)

- [ ] Sustained green period met (no critical drift, error budget healthy).
- [ ] Business sign-off recorded.
- [ ] Remove dual-write/shadow-read code paths and flags.
- [ ] Archive SQL Server migration artifacts; retire SQL Server only after final backup.
