# Postgres Migration - Dual-Run Validation (Phase 4)

Operator-executed. Runs a production-like dual-run to prove PostgreSQL parity before cutover.
Requires two running databases and representative traffic, so it is performed by the operator, not
the coding agent.

## Setup

1. Provision a PostgreSQL instance and apply `database/postgres/schema/*.sql` in numeric order.
2. Run `database/postgres/validation/validate_schema.sql`; confirm all expected objects exist.
3. Load a representative dataset into PostgreSQL (operator sync tooling) and record row counts per table.
4. Configure the API:
   - `ConnectionStrings:PostgresConnection` set.
   - `DataProvider:Primary = SqlServer`
   - `DataProvider:ShadowReadPostgres = true`
   - `DataProvider:DualWritePostgres = false` (enable only after read parity holds)

## Read-parity phase

- Drive representative read traffic (or run the endpoint snapshot suite).
- Watch `provider.read.drift_detected` (see `30_observability_and_drift.md`).
- Investigate every critical drift. Fix the Postgres repository/schema or tighten normalization.
- Exit criterion: zero critical drift across the observation window for the domain(s) in scope.

## Write-parity phase

- Set `DataProvider:DualWritePostgres = true`.
- Drive representative write traffic.
- Watch `provider.write.dual_write_failed`; it must be zero.
- Periodically run drift/snapshot comparison of both databases for the domain's tables.
- Exit criterion: zero dual-write failures and zero snapshot drift over the window.

## Load and concurrency

- Run load tests focused on inventory movement and report finalize/reverse under concurrency.
- Assert non-negative stock and idempotency invariants hold under contention.
- Record latency; PostgreSQL must meet the agreed latency target before promotion.

## Promotion gate

Only when read-parity, write-parity, and load/concurrency criteria are all met for every domain does
the migration proceed to the cutover in `40_cutover_and_rollback_runbook.md`.
