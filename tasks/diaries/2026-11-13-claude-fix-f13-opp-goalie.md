# F13 — opponent goalie (Astra AF-02, AF-06 / decision 148)

- **Scope:** AF-02 null history rows become shutouts in `fetchOpponentGoalieCandidateQuality`; AF-06 neutral opponent-goalie goal/assist multiplier (decision 148), posterior kept as labelled context.
- **Where:** `octoberBranch`, `/Users/tim/Code/fhfhockey.com`. Owned: `web/lib/projections/opponentGoalieQuality.ts`, `web/lib/projections/stages/skater-stage.ts`, their tests (`skater-stage.strengthBuckets.test.ts`).
- **Freeze:** 18:30 UTC 2026-11-13.

## Log
- Start: both owned files clean in tree (goalie-stage.ts dirty = Codex, not mine). Only live path is skater-stage → opponentGoalieQuality; `start-chart.ts` (Codex) only reads `goal_rate_multiplier` as a driver.
- Plan: strict integer count parse before conversion; context drops the multiplier, carries `adjustment: "neutral_unvalidated"`; skater-stage applies 1.0 and stops counting "adjustments applied".

- Implemented: `knownCount` strict parse (null/undefined/""/non-integer → unknown, game dropped); null start probability dropped before conversion; context loses `goalRateMultiplier`/`passThrough`, gains `adjustment: "neutral_unvalidated"`; version → v2; skater-stage multipliers 1/1, `opponent_goalie_context_adjustments_applied` no longer incremented. Payload path: `uncertainty.model.skater_selection.opponent_goalie_context.adjustment`.
- Tests: 3 opponent-goalie tests in `skater-stage.strengthBuckets.test.ts` (labelled context, identical strong/weak payload, adapter + payload AF-02). All 3 fail on HEAD code (swapped in, restored, cmp-verified), pass on fix.
- Suites: strengthBuckets 13/13, coverage 8/8, runProjectionV2 126/126, module-imports 4/4. ESLint exit 0.
- Gotcha: `reserveProjections.test.ts` source-scan guard fails because F7's uncommitted `modeledHeadTotals.ts` now reads the reserve table — not this lane.

- `npm run typecheck` EXIT=2: 4 errors, all other lanes' in-flight files (F14 `goalieOutcomes.ts` x2, F7 `modeledHeadTotals.test.ts` x2); none in F13 files.
- Committed `0eaa1f5b4` (3 files, explicit pathspecs). Hand-over note: side-session-notes/<chef family>/F13-report.md.

## Next
- Chef acceptance; retire this diary once accepted. Nothing blocked.
