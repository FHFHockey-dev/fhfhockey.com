# Blocking items: FORGE serving release (assignable)

The reasons, evidence and suggested fixes are in `REVIEW.md`. Bytes: `SLICE.md` (2026-10-17T21:50Z).

## Status, 2026-10-18 ~19:10Z (blocker-fix session)

The pins are in `slice.json` (re-pinned at HEAD `0de97e77d`, TJ's checkpoint, plus the uncommitted `start-chart.ts` gate restore and its test) and the runs in `test-evidence.json`. This session committed, pushed and deployed nothing, and made no hosted read or write.

| ID | Status |
|---|---|
| **B1** | **Fixed.** `buildForgeInputProvenance()` stamps the label only on `{ externalFantasyInputsExcluded: true }`.<br>Only octoberBranch `run-forge-projections.ts` opts in. That file is branch-only: the release keeps it at production bytes.<br>Regression test: `run-forge-projections.local-attempt.test.ts` drives the real pipeline. On the candidate (production pipeline + blending stages) neither the run nor the snapshot carries the label. `apiHelpers.test.ts` pins the default and opt-in builder |
| **B1 side effect** | Truthful fail-closed behaviour, wider than first stated (`REVIEW-ADDENDUM.md`). After A1, production runs no longer claim exclusion:<br>(1) **Accuracy cron: proposal below, not applied.** Production `run-projection-accuracy` would throw 422 `blocked` daily (pg_cron 11:30 UTC).<br>(2) **Legacy Start Chart: fixed (TJ-approved 2026-10-18).** `start-chart.ts` restores the production `457435eb` gate, so unlabelled runs are served again with every row flagged `unverified_projection_provenance`, projection state `partial`, and degraded reason `quarantined_or_missing_provenance`. A labelled run stays verified (`ready`). They are never labelled native. The test `withholds an unclassified raw run` is rewritten as `serves an unlabelled raw run flagged unverified while a labelled run stays verified`. Command Center Focused Slate, `/trends`, `SlateStripCard` and `TeamPowerCard` get FORGE projections again while starter-board serving is off, which TJ confirmed for production on 2026-10-18 (see the pre-release check below).<br>(3) `scripts/audit-start-chart-release-gates.ts` counts 0 eligible runs (manual script; no change).<br>Unaffected: `forge/players` (Top Adds), `forge/goalies` (Goalie Context), `projections/*` and `requireLatestSucceededRunId` stay at production bytes, which have no label gate. Native admission (`consumerRevisionAdmission`, RSO data, native catalog) still rejects unlabelled runs |
| **Pre-release check (TJ)** | **Confirmed by TJ on 2026-10-18:** `STARTER_BOARD_SERVING_ENABLED` is `false` in Vercel production. The restored legacy gate therefore matches production, and the revision-mode gap from `REVIEW-ADDENDUM-2.md` does not apply to this release.<br>**Standing check:** before switching that flag (or the legacy `START_CHART_GAME_REVISIONS`) to `true`, note that `fetchSlate` then ignores the raw run and serves only admitted revisions. The slice's `consumerRevisionAdmission.ts` drops every unlabelled revision (`use_not_approved`), so Start Chart and the dashboard callers would get no projections from unlabelled runs. Production `457435eb` admitted them. The test `withholds selected revisions with exclusion contract undefined` pins this |
| **B2** | **Code side done; refresh not run.** `source.ts` and `update-roster-optimizer-schedule.ts` are now in `slice.json` (`scheduleWriters`), with `source.test.ts`, `update-roster-optimizer-schedule.test.ts`, and a new writer→reader round trip in `rosterScheduleData/planning.test.ts`.<br>The bounded refresh proposal is `B2-SCHEDULE-REFRESH-PROPOSAL.md`; its window is corrected to start at min(D−1, RSO period start − 1) (`REVIEW-ADDENDUM.md` P1).<br>Correction to the review: full mode writes no witness, so use bounded mode only. Production readers tolerate witness rows |
| **B3** | **Fixed.** The candidate is production + slice + 2 inert test-support modules + 49 tests. 2026-10-18 final re-run: 3,007/3,027 pass, and the 12 failures are exactly the baseline identities, identical on clean production. Nothing is new.<br>The Sunday-only RSO test (`requires input review and renews it…`, which read the real clock) now pins its clock to Wed 2026-10-14 and passes.<br>`test-evidence.json` `candidateManifest` holds the sha256 of all 123 overlaid files (equal to the pins) and a digest of the whole tested `web/` tree (3,565 files) |
| **W1** | **Fixed.** Saved RSO workspaces no longer reject `catalogExpiresAt`: `workspaceSchema.ts` `contributionSource` now accepts it as an optional ISO instant (like its other clocks), and `.strict()` and every bound stay.<br>Regression test in `workspaceSchema.test.ts`: a native catalog baseline source saves and comes back unchanged, and 4 malformed values are rejected. Against the old schema it fails with ZodError `unrecognized_keys: 'catalogExpiresAt'`.<br>The other sessions' uncommitted edits are preserved. The file is not in Monday's graph and has been re-pinned in `slice.json` |
| Pin drift | **Re-pinned again 2026-10-18 ~18:50Z.** 6 RSO files have newer uncommitted edits from other sessions (`CandidateBrowser`, `CandidateCard`, `RosterScheduleOptimizer.tsx`, `candidatePlanMetrics`, `planning.ts`, `planningTypes`; +45/−22, no new imports). They are pinned at the bytes the candidate tested and not reviewed. Earlier pass: **Re-pinned.** 4 files drifted from other sessions' edits, now committed in `0de97e77d` and not mid-edit: `RosterScheduleOptimizer.tsx` (+5/−1), `workspaceSchema.ts` (+1, `timeZone`), `planningTypes.ts` (+2), and the `RosterScheduleOptimizer.test.tsx` test (+4). None adds an import.<br>They are pinned at current bytes and tested in the candidate, but not independently reviewed (`REVIEW-ADDENDUM.md` verdicts cover the earlier blobs) |
| **S-01a** goalie win probability | **Fixed (branch only).** `forge/goalies.ts` keeps a null `proj_win_prob` null (no `?? 0`). The matchup normalizer skips any matchup that has a null goalie, so it never invents probabilities from starter weights or rescales the known opponent.<br>Tests: one goalie null and both null (`forge/goalies.test.ts`, 9/9).<br>Not in the slice: production `forge/goalies.ts` stays at production bytes, and production stages don't emit null. Shipping branch `goalies.ts` would also bring its label gate |
| **S-01b** Start Chart partial sums | **Fixed (slice).** `sumProjectionParts(es, pp, pk)` returns null when an ES or PP head is withheld. PK is never modeled (both writers store null) and still adds nothing.<br>A partial line now shows null goals, assists and PPP, null fantasy points, and no rank. Complete lines are unchanged.<br>Tests: unit cases plus an API case with masked PP heads beside a complete row.<br>No code computes a separate "46 complete / 14 incomplete" count; incomplete rows are the null-score rows the rank logic already excludes.<br>Same bug class elsewhere, not changed: `forge/players.ts:330-341` (Top Adds) and `run-projection-accuracy.ts:1742-1947` |
| **S-01c** qualify harness | **Fixed (branch only).** `qualify-native-players-offline.ts` carries `external_fantasy_input_contract` from `captured.snapshot.inputProvenance`. The test file passes 56/56 (8 failures before). Date drift was already handled by its fake clock (2026-10-10).<br>The candidate keeps the production script and test, so its 9 qualify baseline failures remain |
| **Q-01** Start Chart acceptance | **Done (local).** See `START-CHART-Q01.md` and `start-chart-parity-receipt.json` (16 keys, 0 mismatches across FORGE, RSO, API and UI parse). New injected-clock, race, partial-refresh, Eastern-date and no-game tests. Fix: unidentifiable-team games show as partial coverage (`unmapped_slate_team`) instead of a silent no-games board. `startChartContract.ts` is re-pinned, and the candidate shows only the 12 baseline failures |
| P4 | **Mostly closed.** TJ's checkpoint `0de97e77d` committed the 7 slice files and this session's earlier changes. Only the `start-chart.ts` gate restore and its test are uncommitted |
| N1 | **Fixed.** The Start Chart board omits participation `inputHash`/`evidenceHashes` (the FORGE view's display contract). Responses over 4,000,000 B return a typed 503 `start_chart_too_large` |
| N2 | **Fixed.** The FORGE view catalog cap goes from 10,000 to 50,000 (the player-game bound). The 4,000,000-byte envelope still binds |
| N3 | **Fixed.** The FORGE route sends `s-maxage` ≤ 15 s, never past the earliest receipt expiry or puck drop; that is Start Chart's existing window. Errors stay `no-store`. A 60 s window would be TJ's call. Per-instance memoization is not done |


## Proposal: daily 422 from `run-projection-accuracy` (not applied; TJ decision)

**Goal.** Score unlabelled (unverified) production runs and record their provenance, rather than refusing them, while keeping B1's labelling honest.

**Today.** At production bytes, `runAccuracyForDate` (around L1665–1680) throws 422 whenever `evaluateForgeCalibrationEligibility` is false. With the slice's eligibility, that is every production run. The job writes nothing, scan status is `blocked`, and production `withCronJobAudit` records a daily failure.

**Change** (one file: `web/pages/api/v1/db/run-projection-accuracy.ts`):
1. Keep the 422 only for `reason === "missing_or_legacy_rolling_history_contract"`. For that case, production's message ("…repaired rolling-history provenance is absent") is correct. So the branch's 1-line message edit isn't needed; make the text reason-specific if anything.
2. On `missing_or_legacy_external_fantasy_exclusion_contract` (rolling history present, no exclusion label), score as before and set `inputProvenance = { externalFantasyInputs: "unverified", reason, observedExternalFantasyContract }`, matching Start Chart's `unverified_projection_provenance`. Record `"blended"` only when the run's captured snapshot shows `seasonBootstrapApplied === true`: `forge_runs.metrics` does not record whether the bootstrap applied, and a run with it off has no external blend. A labelled run gets `"excluded"`.
3. Record that provenance without a schema change. Every writer table lacking a JSON column stays joinable via `forge_projection_results.source_run_id` → `forge_runs`:
   - `forge_runs.metrics.accuracy_calibration[date].input_provenance` (via `updateRunCalibrationMetrics`);
   - `forge_projection_calibration_daily.metrics.input_provenance` (jsonb) for the skater and goalie calibration scopes;
   - the response's `inputProvenance` and a scan note.
4. Keep resolving the run with production `requireLatestSucceededRunId`, which has no label gate. If the branch `apiHelpers.ts` ever ships, this job needs a provenance-agnostic lookup, or it 422s first.

**Where the change lives:**
- **Slice:** the file is not in the slice (production bytes on master; the branch differs only by the message line). It would join as must-land-with `calibrationEligibility.ts`.
- **Monday 2026-10-20 graph:** not in it.
- **Database:** no schema change or migration.

**Readers:**
- `forge/goalies.ts` reads `goalie_calibration_summary` and keeps getting daily rows, as in production today.
- The native catalog reads none of these tables; its participation is `uncalibrated_model`.
- Any future native calibration reader must filter on `metrics.input_provenance.externalFantasyInputs === "excluded"`.

**Tests**, in `__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`, which is unchanged from production and in the candidate set. All four would be new coverage; the file has no eligibility-gate test today:
- (a) An unlabelled run with the rolling-history contract returns 200 and runs the upserts; the run metrics and calibration rows carry `externalFantasyInputs: "unverified"` (or `"blended"` with a snapshot showing `seasonBootstrapApplied: true`).
- (b) A labelled run gets `"excluded"`.
- (c) A missing rolling-history contract still returns 422 `blocked` with the production message and no upserts.
- (d) Through `withCronJobAudit`, the 200 is recorded as success.

**Alternative:** keep refusing, but return 200 `skipped_unverified_provenance`. That silences the failing alert but leaves accuracy history empty until native stages ship.

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
