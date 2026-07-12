# Postgres Migration - Observability and Drift Detection

Observability is a Phase 0 prerequisite: we must be able to see divergence between
providers before we trust PostgreSQL with any traffic.

## Signals to emit

| Signal | Emitted when | Purpose |
|---|---|---|
| `provider.read.shadow_compared` | A shadow read runs against Postgres | Coverage of dual-run |
| `provider.read.drift_detected` | Shadow read differs from primary after normalization | Blocks promotion |
| `provider.write.dual_write_attempted` | A dual-write to Postgres runs | Coverage |
| `provider.write.dual_write_failed` | Dual-write raised (best-effort, primary unaffected) | Health |
| `provider.exception.translated` | Provider exception mapped to a domain exception | Error-contract parity |

## Implementation hook

The infrastructure provides `IProviderDriftRecorder` (see
`apps/api/ManageR2.Infrastructure/DAL/Providers/IProviderDriftRecorder.cs`). The default
implementation logs structured events; it can later be backed by a metrics exporter without
touching call sites.

Shadow-read comparison uses `IPayloadParityComparer` to normalize and diff two payloads and
records `drift_detected` with a stable diff summary (never the raw sensitive payload).

## Drift review loop

1. Enable `ShadowReadPostgres=true` for a domain in a non-production, production-like environment.
2. Replay representative traffic (or run the endpoint snapshot suite).
3. Review `drift_detected` events daily.
4. Critical drift (wrong value, missing row, wrong error) blocks the wave. Cosmetic drift
   (ordering, formatting) is fixed by tightening normalization rules, not by ignoring it.

## Promotion threshold

- Critical drift over the observation window must be exactly zero.
- Dual-write failures must be zero for the wave before `Primary=Postgres` is considered.
