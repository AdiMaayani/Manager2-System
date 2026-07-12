# Postgres Migration - Parity Contract Template

One parity contract is filled out per domain wave. It is the objective record that a
domain behaves identically on PostgreSQL and SQL Server. A wave is not "done" until its
contract is complete and green.

## How to use

1. Copy the "Contract" block below into `docs/migration/parity/<domain>.md`.
2. Enumerate every endpoint and repository method in the domain.
3. Define the normalization rules (see below) so cross-provider comparison is deterministic.
4. Record results from the automated parity suite.

## Normalization rules (applied before comparing provider outputs)

- Trim trailing whitespace on strings; treat `null` and SQL `NULL` as equal.
- Compare datetimes as UTC ISO-8601 with millisecond precision.
- Compare decimals by value, not string form (e.g. `1.50` == `1.5`).
- Order-insensitive comparison for list endpoints unless the endpoint guarantees an order.
- Ignore server-assigned identity values in create responses when the contract marks them "provider-assigned";
  compare the rest of the payload and assert referential resolution instead.

## Contract (copy per domain)

```
# Parity Contract: <Domain>

Wave: <1-5>
Owner: <name>
Status: <Draft | Read-parity | Write-parity | Cutover-ready>

## Endpoints in scope
| Method + Route | Repository method | Read/Write | Notes |
|---|---|---|---|
| GET /api/... | XxxRepository.GetAsync | Read | |

## Error-semantics mapping
| Scenario | SQL Server behavior | Postgres behavior | HTTP result (must match) |
|---|---|---|---|
| Not found | THROW 5xxxx | RAISE EXCEPTION | 404/400 + message |

## Transaction invariants (Reports/Inventory waves)
- [ ] Idempotent finalize/reverse
- [ ] No negative stock
- [ ] Atomic lifecycle transition

## Parity results
| Check | Result | Date | Evidence |
|---|---|---|---|
| Contract tests both providers | PASS/FAIL | | link |
| Endpoint snapshot parity | PASS/FAIL | | link |
| Shadow-read drift (window) | 0 critical | | dashboard |
| Concurrency tests | PASS/FAIL | | link |

## Go/No-Go
- [ ] All checks green -> wave may advance
```
