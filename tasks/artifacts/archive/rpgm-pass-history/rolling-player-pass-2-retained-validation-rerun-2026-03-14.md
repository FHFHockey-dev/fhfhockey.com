## Retained Validation Player Rerun - 2026-03-14

### Goal

Rerun the retained validation players through the current rolling writer after the optional-metric rollout and runtime/orchestration changes so the retained set no longer depends on stale target rows.

### Command Shape

- execution path: `fetchRollingPlayerAverages.main(...)` via `ts-node`
- settings:
  - `season=20252026`
  - `playerConcurrency=4`
  - `upsertBatchSize=500`
  - `upsertConcurrency=4`
  - `skipDiagnostics=true`

### Retained Validation Players

- Brent Burns (`8470613`)
- Corey Perry (`8470621`)
- Jesper Bratt (`8479407`)
- Seth Jones (`8477495`)

### Result

All four targeted reruns completed successfully.

- Brent Burns:
  - `ok: true`
  - duration: `7269ms`
  - rows upserted: `248`
- Corey Perry:
  - `ok: true`
  - duration: `6496ms`
  - rows upserted: `208`
- Jesper Bratt:
  - `ok: true`
  - duration: `6862ms`
  - rows upserted: `252`
- Seth Jones:
  - `ok: true`
  - duration: `5574ms`
  - rows upserted: `160`

### Interpretation

- the retained validation set is now refreshed against the current writer implementation
- the older stale-target blocker state from the March 12 and early March 14 artifacts should no longer be treated as current evidence
- any remaining retained-set readiness blockers after this point should be re-evaluated as:
  - genuine upstream source-tail issues
  - or post-rerun freshness drift from newer upstream updates
