## Retained Validation Freshness Status - 2026-03-14

### Goal

Confirm `targetFreshnessOk` status for the retained validation players after the March 14 rerun and isolate any remaining blockers that are genuine source-tail issues rather than stale target rows.

### Command

```bash
npm run check:rolling-player-validation-freshness
```

### Results

#### Brent Burns (`8470613`)

- `targetFreshnessOk: true`
- `overallStatus: READY`
- all strengths are current
- no unresolved freshness blockers

#### Corey Perry (`8470621`)

- `targetFreshnessOk: true`
- `overallStatus: BLOCKED`
- blocker type: genuine PK source-tail lag
- unresolved blockers: `6`
- blocked strength:
  - `pk`
- PK source dates:
  - latest WGO date: `2026-03-12`
  - latest counts date: `2026-03-08`
  - latest rates date: `2026-03-08`
  - latest counts-on-ice date: `2026-03-08`

#### Jesper Bratt (`8479407`)

- `targetFreshnessOk: true`
- `overallStatus: BLOCKED`
- blocker type: genuine PK source-tail lag
- unresolved blockers: `3`
- blocked strength:
  - `pk`
- PK source dates:
  - latest WGO date: `2026-03-12`
  - latest counts date: `2026-03-08`
  - latest rates date: `2026-03-08`
  - latest counts-on-ice date: `2026-03-08`

#### Seth Jones (`8477495`)

- `targetFreshnessOk: true`
- `overallStatus: BLOCKED`
- blocker type: genuine PK source-tail lag
- unresolved blockers: `3`
- blocked strength:
  - `pk`
- PK source dates:
  - latest WGO date: `2026-01-02`
  - latest counts date: `2025-12-30`
  - latest rates date: `2025-12-30`
  - latest counts-on-ice date: `2025-12-30`

### Interpretation

- the stale-target problem is resolved for the retained validation set
- all four retained players now have `targetFreshnessOk: true`
- remaining retained-player blockers are source-tail blockers only
- the current blocker pattern is narrower than the older March 12 / early March 14 snapshots and should replace those older interpretations in later audit updates

### Current Post-Rerun Status Summary

- `READY`
  - Brent Burns
- `BLOCKED` on real PK source tails
  - Corey Perry
  - Jesper Bratt
  - Seth Jones
