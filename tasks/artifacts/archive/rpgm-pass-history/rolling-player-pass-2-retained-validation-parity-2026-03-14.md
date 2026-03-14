# Retained Validation Parity

Date: `2026-03-14`
Task: `4.4`

## Scope

Re-run the targeted retained-player validation scripts after the optional-baseline backfill confirmation so the retained set has one current parity and freshness snapshot.

## Verification Commands

- `npm run check:rolling-player-family-reconstruction`
- `npm run check:rolling-player-validation-freshness`

## Stored vs Recomputed Parity

The retained ready comparison set remains clean after the targeted reruns.

- Brent Burns (`8470613`)
  - all audited families: `MATCH`
  - `historical_baselines`: `MATCH`
  - `comparedRows: 248`
  - `missingStoredRows: 0`
  - `mismatchCount: 0`
- Jesper Bratt (`8479407`)
  - all audited families: `MATCH`
  - `historical_baselines`: `MATCH`
  - `comparedRows: 252`
  - `missingStoredRows: 0`
  - `mismatchCount: 0`

## Freshness / Readiness

- Brent Burns (`8470613`)
  - `targetFreshnessOk: true`
  - `overallStatus: READY`
  - all strengths current through `2026-03-12`
- Corey Perry (`8470621`)
  - `targetFreshnessOk: true`
  - `overallStatus: BLOCKED`
  - blocker limited to `pk`
  - latest PK counts / rates / countsOi remain `2026-03-08` while WGO is `2026-03-12`
- Jesper Bratt (`8479407`)
  - `targetFreshnessOk: true`
  - `overallStatus: BLOCKED`
  - blocker limited to `pk`
  - latest PK counts / rates / countsOi remain `2026-03-08` while WGO is `2026-03-12`
- Seth Jones (`8477495`)
  - `targetFreshnessOk: true`
  - `overallStatus: BLOCKED`
  - blocker limited to `pk`
  - latest PK counts / rates / countsOi remain `2025-12-30` while WGO is `2026-01-02`

## Interpretation

- stored-versus-recomputed parity is now confirmed on the retained ready comparison set after the optional-metric rollout
- the retained-set story no longer includes stale target rows or optional-baseline null gaps
- the only remaining retained-player blockers are real PK source-tail freshness gaps

## Net Outcome

Task `4.4` closes with a current retained-set parity snapshot:

- ready retained cases are fully reconstructed and fresh
- blocked retained cases are blocked by genuine PK upstream lag only
- the next documentation step should update older March 12 / early March 14 artifacts so they no longer imply stale-target or optional-baseline-write issues
