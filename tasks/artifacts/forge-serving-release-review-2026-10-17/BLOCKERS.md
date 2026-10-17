# Blocking items: FORGE serving release (assignable)

The reasons, evidence and suggested fixes are in `REVIEW.md`. Bytes: `SLICE.md` (2026-10-17T21:50Z).

## Status, 2026-10-17 ~22:50Z (blocker-fix session)

The pins are in `slice.json` (re-pinned) and the runs in `test-evidence.json`. Nothing was committed, pushed or deployed, and no hosted read or write was made.

| ID | Status |
|---|---|
| **B1** | **Fixed.** `buildForgeInputProvenance()` stamps the label only on `{ externalFantasyInputsExcluded: true }`.<br>Only octoberBranch `run-forge-projections.ts` opts in. That file is branch-only: the release keeps it at production bytes.<br>Regression test: `run-forge-projections.local-attempt.test.ts` drives the real pipeline. On the candidate (production pipeline + blending stages) neither the run nor the snapshot carries the label. `apiHelpers.test.ts` pins the default and opt-in builder |
| **B1 side effect (TJ decision)** | Truthful fail-closed behaviour, wider than first stated (confirmed by `REVIEW-ADDENDUM.md`). After A1, production runs no longer claim exclusion, so:<br>(1) Production `run-projection-accuracy` throws 422 `blocked` daily (pg_cron 11:30 UTC), recorded as a failing job. Its production error text names the wrong cause; the branch's 1-line message fix is out of slice.<br>(2) The slice's legacy Start Chart gate (`start-chart.ts:911-913`) drops every unlabelled run, so dashboard callers without `forecast_source` get no FORGE projections: Command Center Focused Slate, `/trends` projections, `SlateStripCard`, `TeamPowerCard`. This is not a 422; they render with a degraded message. Production `start-chart.ts` would instead serve them flagged `unverified_projection_provenance`. Restoring that is one line plus rewriting the test `withholds an unclassified raw run` (reverses a 7f094c8e6 decision).<br>(3) `scripts/audit-start-chart-release-gates.ts` counts 0 eligible runs.<br>Unaffected: `forge/players` (Top Adds), `forge/goalies` (Goalie Context), `projections/*` and `requireLatestSucceededRunId` stay at production bytes, which have no label gate |
| **B2** | **Code side done; refresh not run.** `source.ts` and `update-roster-optimizer-schedule.ts` are now in `slice.json` (`scheduleWriters`), with `source.test.ts`, `update-roster-optimizer-schedule.test.ts`, and a new writer→reader round trip in `rosterScheduleData/planning.test.ts`.<br>The bounded refresh proposal is `B2-SCHEDULE-REFRESH-PROPOSAL.md`; its window is corrected to start at min(D−1, RSO period start − 1) (`REVIEW-ADDENDUM.md` P1).<br>Correction to the review: full mode writes no witness, so use bounded mode only. Production readers tolerate witness rows |
| **B3** | **Fixed.** The candidate is production + slice + 2 inert test-support modules + 49 tests: 3,002/3,022 pass. The 12 failures are exactly the baseline identities, which fail identically on clean production |
| **W1** | **Fixed.** Saved RSO workspaces no longer reject `catalogExpiresAt`: `workspaceSchema.ts` `contributionSource` now accepts it as an optional ISO instant (like its other clocks), and `.strict()` and every bound stay.<br>Regression test in `workspaceSchema.test.ts`: a native catalog baseline source saves and comes back unchanged, and 4 malformed values are rejected. Against the old schema it fails with ZodError `unrecognized_keys: 'catalogExpiresAt'`.<br>The other sessions' uncommitted edits are preserved. The file is not in Monday's graph and has been re-pinned in `slice.json` |
| Pin drift | Since the evidence run (~22:47Z) other sessions changed 4 pinned files: `RosterScheduleOptimizer.tsx`, `workspaceSchema.ts` (`timeZone` line), `planningTypes.ts` and the `RosterScheduleOptimizer.test.tsx` test. `slice.json` and `test-evidence.json` cover the pinned bytes only; re-pin and re-run once those edits settle |
| P4 | **Open (other sessions).** The 7 slice files are still uncommitted, at the review's bytes. This session's changes are uncommitted too |
| N1 | **Fixed.** The Start Chart board omits participation `inputHash`/`evidenceHashes` (the FORGE view's display contract). Responses over 4,000,000 B return a typed 503 `start_chart_too_large` |
| N2 | **Fixed.** The FORGE view catalog cap goes from 10,000 to 50,000 (the player-game bound). The 4,000,000-byte envelope still binds |
| N3 | **Fixed.** The FORGE route sends `s-maxage` ≤ 15 s, never past the earliest receipt expiry or puck drop; that is Start Chart's existing window. Errors stay `no-store`. A 60 s window would be TJ's call. Per-instance memoization is not done |

| ID | Blocks | File(s) | Problem, in one line | Suggested owner |
|---|---|---|---|---|
| **B1** | Release | `web/lib/projections/calibrationEligibility.ts` | `buildForgeInputProvenance()` always stamps `external_fantasy_input_contract`. Unchanged production `run-forge-projections.ts` would label runs "external excluded" while the production stages still blend AG/Cullen/DtZ (`loadSeasonBootstrap(…, true)`), and the slice's new gates would admit them. Fix: make the stamp explicit opt-in | FORGE (native-input separation) |
| **B2** | Serving horizons (FORGE totals, RSO points) | `web/lib/rosterScheduleData/source.ts`, `web/pages/api/v1/db/update-roster-optimizer-schedule.ts` (+ a schedule run) | The slice requires `scheduleCoverage` witnesses that no production writer produces. Every horizon then reads `incomplete_refresh` (fail-closed): FORGE totals null, RSO `projectedValue` null. Ship the 2 writer files (13 lines) and approve a ≤24 h refresh covering the served window | RSO/schedule owner; TJ approves the schedule |
| **B3** | Release gate | `planning.test.ts`, `gameExpectations.test.ts`, `nativeBaselinePublication.test.ts` (catalog-head boundary), production `apiHelpers.test.ts`, production `runProjectionV2.test.ts` | The hub tests import out-of-slice modules, and their production versions fail against the slice: 33 + 1 + 1 new failures. Move fixture builders into shipped test-support files, or add inert script modules, and update the 2 superseded production assertions | FORGE + RSO |
| P4 | Candidate | 7 uncommitted slice files (`SLICE.md`) | The bytes are live edits; commit them before pinning | RSO matrix and consumer-test sessions |

**Fix before activation.** These are non-blocking for the release:

| ID | File(s) | Problem |
|---|---|---|
| N1 | `startChartContract.ts`, `start-chart.ts` | No 4 MB bound. Ships participation `evidenceHashes` on every target. Estimated 2–3 MB at v1, over 4.5 MB after universe growth |
| N2 | `gameExpectationView.ts` | The 10,000-entry catalog cap is at about 7.3k–9.5k for v1; exceeding it returns 503 for the whole next-20 request |
| N3 | `pages/api/v1/forge/forecasts.ts` | Public and `no-store`, while each request re-reads and re-verifies all pinned bundles (up to about 14 MB of participation) |

**Time-sensitive for 2026-10-20.** Two readback checks:
- Expect `incomplete_refresh` (B2) unless hosted schedule rows are refreshed by the octoberBranch writer first.
- Record the FORGE and Start Chart body sizes and catalog counts (N1/N2).
