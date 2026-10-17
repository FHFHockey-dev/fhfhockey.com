# FORGE serving slice: review addendum (blocker-fix pass)

This is an independent review of the files whose bytes changed in the blocker-fix pass (B1, B2 writers, B3 test support, N1–N3, W1). It uses `REVIEW.md`'s legend, depth scale and criteria. Every verdict applies to the exact blobs listed below. If a blob changes, its verdict lapses.

The review was read-only. Only this file was written. Nothing was committed, pushed or deployed, and no hosted Supabase, production or Vercel request was made. No file in the Monday 2026-10-20 import graph was touched.

## Drift check (stop-on-drift rule)

At 2026-10-17T22:48:41Z, each file was re-hashed (`git hash-object`, sha256 and byte count) against `slice.json` (`generatedAt` 2026-10-17T22:47:17Z).

| Set | Files | Result |
|---|---|---|
| The 11 files in scope | listed below | **0 drift**: blob, sha256 and bytes all match |
| Every other pin in `slice.json` (`runtimeSlice`, `scheduleWriters`, `testSupport`, `branchOnlyRuntime`) | 64 | **0 drift** |

There was no drift, so the review proceeded.

### Drift after the review (re-hash at 2026-10-17T22:58:19Z)

Another session edited 3 pinned files at about 22:56Z, after the 22:48:41Z hash and while this review was running. `slice.json` was not updated.

| File | Pinned blob | Working tree now | Change |
|---|---|---|---|
| `web/lib/in-season/workspaceSchema.ts` (**in scope**) | `ef9a5669` | `ca9fda58` | 1 added line (126): `timeZone: timeZone.optional(),` |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` (out of scope) | per `slice.json` | `2c886790` | not inspected |
| `web/lib/rosterScheduleOptimizer/planningTypes.ts` (out of scope) | per `slice.json` | `14d64c9c` | not inspected |

Under the stop-on-drift rule, the new bytes were **not reviewed**.
- The W1 verdict below covers pinned `ef9a5669` only. `ca9fda58` needs a re-pin and a fresh verdict.
- `REVIEW.md`'s verdicts for the other two files lapse until they are re-pinned and re-reviewed.
- The other 72 pins, including the remaining 10 in-scope files, were unchanged at 22:58:19Z.

**What changed since `REVIEW.md`:**
- For 5 of the 6 re-pinned slice files, `HEAD` is byte-identical to the previous pin (`previousSha256`), so `git diff HEAD` is exactly the blocker-fix delta.
- For `workspaceSchema.ts`, the current bytes minus the one token ` catalogExpiresAt: instant.optional(),` reproduce the previous pin (`ba918a4f…`) exactly. W1 is therefore the only change since `REVIEW.md`, and the other sessions' uncommitted edits are byte-unchanged from what was reviewed then.

## Checks actually run

| Check | Result |
|---|---|
| Re-hash of 75 pins | 0 drift |
| Vitest, 11 files, octoberBranch working tree: `nativeInputEligibility`, `apiHelpers`, `run-forge-projections.local-attempt`, API `start-chart`, page `start-chart`, `forge/forecasts`, `workspaceSchema`, `source`, `planning`, `gameExpectations`, `update-roster-optimizer-schedule` | **438 passed, 1 skipped, 0 failed** |
| Read-only `git grep` / `git show` against production `457435eb` | callers, readers, and the audit failure rule (below) |
| Typecheck | **Not run.** `test-evidence.json` also records that the candidate `tsc` was not re-run after this pass, and the branch `tsc` was not re-run after W1. Signature compatibility was checked by reading: production `run-forge-projections.ts` calls `buildForgeInputProvenance()` with no arguments, which the optional parameter accepts. The audit script imports only `evaluateForgeCalibrationEligibility` and `FORGE_ROLLING_HISTORY_INPUT_CONTRACT`, and both are still exported |
| Candidate (production + slice) suite | Not re-run; `test-evidence.json` is the evidence |

## Per-file verdicts

| File | Verdict | Depth | Notes |
|---|---|---|---|
| `web/lib/projections/calibrationEligibility.ts` (`188021e5`) | **accept** (B1 closed) | full | The default `buildForgeInputProvenance()` returns only `rolling_player_history_contract`. The exclusion label requires the literal `{ externalFantasyInputsExcluded: true }`. Eligibility requires both contracts, and the reason names the missing one.<br>Production callers re-checked:<br>- `run-forge-projections.ts` (no arguments, so no label)<br>- `run-projection-accuracy.ts`<br>- `start-chart.ts`<br>- `scripts/audit-start-chart-release-gates.ts`<br>So with production pipeline bytes, every slice reader rejects new runs (fail closed). See the side effects below |
| `web/lib/projections/startChartContract.ts` (`d9dc8f3b`) | **accept** (N1 part 1) | diff | `normalizeParticipationModel` no longer emits `inputHash`/`evidenceHashes`, for both target participation and `startParticipation`. The new `StartChartParticipation` type `Omit`s them, so the compiler blocks any consumer that reads them.<br>The page test asserts their absence (`start-chart.test.tsx:672`).<br>Out-of-slice type consumers (`lib/dashboard/normalizers.ts`, `pages/trends/index.tsx`) are production-identical and do not read these fields |
| `web/pages/api/v1/start-chart.ts` (`da71eecb`) | accept with note (N1 part 2) | diff | Every 200 path goes through `sendPayload`: fresh load, in-memory cache hit, in-flight join, and scored POST. So the 4,000,000-byte check covers all of them.<br>Over the bound it returns `503 { error: { code: "start_chart_too_large", message } }` with `no-store`, and the page's fetcher shows that message.<br>Notes:<br>1. The body is serialized twice (once to measure, once by `res.json`): up to about 4 MB of extra CPU per request. Sending the measured string would avoid it.<br>2. An oversized payload is still cached in the in-memory `responseCache` before the check (existing behaviour, at most 64 entries), so for up to 15 s repeat requests re-serialize it and get 503 again.<br>3. The bound also applies to the legacy default path: a legacy board between 4.0 and 4.5 MB now returns 503 instead of 200. That is unlikely at legacy sizes |
| `web/lib/player-forecasts/gameExpectationView.ts` (`b56036cb`) | accept with note (N2) | diff, plus encode/decode read | `catalogEntries` goes to 50,000. The same constant bounds `intern()` on encode (`>=` before push) and `catalog()` on decode (`.max`). Decode indexes are not upper-bounded, so references past 10,000 still resolve. The 4,000,000-byte envelope still binds on both encode and decode.<br>Note: no test exercises more than 10,000 entries; `gameExpectations.test.ts:444` asserts only `≤ cap` |
| `web/pages/api/v1/forge/forecasts.ts` (`06e3faa9`) | accept with note (N3) | full | `s-maxage` = min(15 s, the earliest of: `scheduledAt`, start-participation expiry, each target's `expiresAt`, participation expiry, and source expiries). Each target's `expiresAt` already folds in `catalogExpiresAt` (`gameExpectations.ts:80-96`). The value is floored, and 0 once any clock has passed. Errors send `no-store`. Tests cover 15, 7 and 0 s and the error case.<br>Notes:<br>1. The catalog head's own `selection.expiresAt` is not in the response. It equals the earliest *pinned payload* expiry (`nativeCatalogHead.ts:103-104`). If that earliest payload contributes no clock to the requested scope, a CDN copy can outlive the head by at most 15 s. Bounded, but echoing the head expiry (the previously suggested `forecastManifest` addition) would close it.<br>2. An empty response (no clocks) gets `s-maxage=15`. That is harmless.<br>3. Cache misses still re-verify every pinned bundle, and varied query strings bypass the CDN. Per-instance memoization is not done, as `BLOCKERS.md` says |
| `web/lib/in-season/workspaceSchema.ts` (`ef9a5669`) | accept with note (W1) | diff (byte-reconstructed; see Drift check) | `catalogExpiresAt: instant.optional()` (ISO with offset). `.strict()` and every bound stay. It matches `ContributionSource.catalogExpiresAt?: string` and its producer (`contributionStore.ts:239`, the bundle manifest's `expiresAt`, the same clock family as the already-accepted `expiresAt`). The regression test rejects 4 malformed values.<br>Notes:<br>1. The schema does not order `catalogExpiresAt` against `issuedAt`/`expiresAt`. That is consistent with the other clocks, and the resolver re-checks it on use (`contributions.ts:171-175`).<br>2. `REVIEW.md`'s earlier note still applies: `event` is not cross-checked against `version`.<br>3. The staged rolling-participation `02-integration.patch` (after 2026-10-20 17:00 UTC) edits this file, so it will need another re-pin and verdict |
| `web/lib/rosterScheduleData/source.ts` (`9f7bab6d`, committed) | **accept** (B2 writer) | diff | Days outside `[startDate, endDate]` are skipped before they are recorded. A day seen twice with different regular-season game sets throws. The witness lists only `gameType === 2` IDs and the window-wide `emptyDates`.<br>`readSchedulePage` is a test seam; the default stays `getScheduleDaily`.<br>Full-season mode stamps no witness, which confirms the proposal's correction to `REVIEW.md` B2 |
| `web/pages/api/v1/db/update-roster-optimizer-schedule.ts` (`3968b43d`, committed) | **accept** (B2 writer) | diff, plus guard read | One line passes `scheduleCoverage` into the rows. Auth is unchanged: `withOperationalRouteAuth`, POST only, and `dryRun=true` routes to an `audit: false` handler.<br>The guarded scope hash covers `source_metadata`, including the witness, but not `fetched_at`, so inspect and write hash the same for an unchanged source |
| `web/scripts/preview-native-baseline.ts` (`fc5bec46`, committed) | **accept** (test support) | use | Route-free. Its importers are tests, scripts and branch-only `currentRosterNativeInputs.ts`, which is absent from production and not in the candidate. No `pages/` file imports it.<br>Its only top-level effect sits behind `require.main === module`. It imports slice modules plus production-identical `fantasy-projections/evaluator`, so it is import-closed in the candidate |
| `web/lib/player-forecasts/seasonGameContributions.ts` (`c95793aa`, committed) | **accept** (test support) | use | Pure functions with no I/O. Imports: `evaluator`/`contracts` (identical in production and `HEAD`; the needed exports exist in production) and types |
| `web/lib/projections/run-forge-projections.ts` (`976cd668`, branch-only) | accept with note | diff, plus stage read | The label is opted into at all 3 sites (snapshot, reconstruction, run metrics). That is justified on this branch:<br>- `skater-stage.ts:1460,1592` and `goalie-stage.ts:164-166` pass `allowCurrentFantasy=false`.<br>- `loadSeasonBootstrap` reads external sources only when that flag is true.<br>- `nativeInputEligibility.test.ts` passes 6/6, and the local-attempt test passes.<br>- Market consensus lines feed only output-side edge flags.<br>`slice.json` keeps this file at production bytes for the release, which is correct.<br>Note: the claim is unconditional, not derived from the stage calls. Only `nativeInputEligibility.test.ts` guards it, so that test must ship with these stages |

No file in scope needs a change.

## `B2-SCHEDULE-REFRESH-PROPOSAL.md`

**Verdict: needs change before A2 (activation); it does not block A1.** One coverage claim is wrong. The bounds and the reader-tolerance claim hold.

### Verified correct

- **Reader rules:** the witness rules match `planningInputs.ts:84-122`: version/date match, 2 sides per listed game, one shared `fetched_at` ≤36 h old, identical witness JSON, ≤31 `emptyDates`, ±1-day padding whenever a time zone is sent. All three surfaces send one.
- **Full mode:** it writes no witness. The proposal's correction to `REVIEW.md` B2 is right, and REVIEW's "use full-season mode" advice should be dropped.
- **Production-bytes writer:** it strips the witness in either mode.
- **Guard:** behaviour matches `refreshGuard.ts`:
  - Guarded runs require bounded mode with explicit key and dates.
  - `maxSides` is 1–1000, and 2 × the number of `gameIds` must not exceed it.
  - The game set must match exactly (`REFRESH_SCOPE_MISMATCH`).
  - A write requires `expectedScopeHash`; a changed source gives `REFRESH_SOURCE_CHANGED`.
  - `dryRun` inserts no audit row.
- **Bounds:**
  - D−1…D+43 is 45 days, equal to `MAX_BOUNDED_REFRESH_DAYS`.
  - That window takes 7 weekly NHL reads.
  - About 300 games is about 600 sides, under the 1000-side cap.
  - The reader selects by `source_season_id` and date, not `game_key`, so the one-key check is needed.
- **Production readers tolerate the witness:** confirmed at `457435eb`.
  - `query.ts` passes `source_metadata` through as an untyped record.
  - `scopeReads.ts`, `issuedContext.ts`, `dust.ts` and `scenariosServer.ts` select explicit columns that exclude it.
  - `cron-report.ts` only maps the route to the table.
  - No production code parses `source_metadata` with a schema.

### Needs change: RSO coverage (P1)

The table claims RSO 7–9-day windows are covered "for windows ending by D+42". It assumes they start at or after D. They do not:
- The RSO page's default context is `currentPlanningRange` (`lib/rosterScheduleOptimizer/workspace.ts:150-158`): the Yahoo matchup period, or the Mon–Sun calendar week, containing today.
- `roster-schedule-optimizer/data.ts` passes `startDate` through unclamped.
- `hasScheduleCoverage` checks every date from `startDate−1`, past days included, and each date needs `fetched_at` ≤36 h old.

**Effect:** a daily run that starts at D−1 keeps only D−1 fresh (D−2 too, within 12 h of the run). So the week's leading Sunday goes stale from about Tuesday onward. For roughly 5 of 7 days a week the default RSO view reads `incomplete_refresh`, and `projectedValue` is null. That is fail closed, but it defeats B2's purpose for RSO.

**Fix:**
- Start each run at min(D−1, current Yahoo period start − 1). That is D−7 at most for a Mon–Sun week; longer first or All-Star periods reach further back.
- Set `endDate = startDate + 44`. Start Chart and the current RSO period stay covered. The FORGE `endDate` cap becomes `startDate + 43` (D+36 on Sundays), so update RELEASE-PLAN A3 #1 to match, or keep the second window.
- Alternatively, relax the reader's past-day requirement. That is a slice code change and needs its own review.
- Add one period-start read to the readback. A3's smoke uses `startDate=<today>`, which would not reveal this.

### Notes

1. The inspect and write hashes cover `game_status`, `start_time` and `source_updated_at` for D−1 and D. Run both steps outside game hours: after D−1's games are final and before D's first puck drop. Otherwise expect `REFRESH_SOURCE_CHANGED`. The proposal's "stop at the first non-200, no automatic retry" handles this safely.
2. The optional second window `[D+44, D+60]` also needs ≤24 h cadence. It doubles the daily cost to 4 POSTs and 14 NHL reads.
3. Any full-mode or production-bytes write within 36 h of a served read erases the witnesses. Settle the hosted `cron.job` question (its own read-only approval) before relying on the refresh.

## B1 side effect: production `run-projection-accuracy` will report `blocked`

**Confirmed, and wider than `BLOCKERS.md` states.** It is truthful fail-closed behaviour. TJ's decision before A1 should cover all three items below.

1. **Accuracy cron.**
   - Production `run-projection-accuracy.ts` stays at production bytes but imports the slice's `evaluateForgeCalibrationEligibility`.
   - Production runs carry no label, so every date throws a 422 with `scanSummary.status: "blocked"`.
   - The pg_cron job runs daily at 11:30 UTC (`cron-schedule.md:769`).
   - Production `withCronJobAudit` records any status ≥400 as `failure`. So `cron_job_audit` and the cron report will show a daily failing job.
   - **The error text will be wrong.** At production bytes it reads "…because repaired rolling-history provenance is absent". The body's `calibrationEligibility.reason` (`missing_or_legacy_external_fantasy_exclusion_contract`) is right.
   - The branch already has the corrected 1-line message (`run-projection-accuracy.ts:1675`). Shipping that line, or marking the job as expected-blocked in the ops health view, avoids a misleading alert.
2. **Dashboard: not listed in `BLOCKERS.md`.**
   - The slice's `start-chart.ts:911-913` drops any FORGE run without the label from the legacy (default) path.
   - After A1, production dashboard callers of `/api/v1/start-chart?date=…` without `forecast_source` get no FORGE projections and a `partial` serving message. Those callers are `forge-dashboard/SlateStripCard.tsx`, `forge-dashboard/TeamPowerCard.tsx`, `lib/dashboard/commandCenterData.ts` and `lib/dashboard/dataFetchers.ts`.
   - These callers mostly read `games` and `serving`, so they keep rendering, but with a daily degraded-coverage message.
   - RELEASE-PLAN A1 #4 ("Legacy FORGE revisions are rejected everywhere") covers this only implicitly.
3. **Release-gate audit script.** `scripts/audit-start-chart-release-gates.ts` (manual) will count 0 eligible runs.

**Unaffected:** production `forge/players`, `forge/goalies` and `projections/*` stay at production bytes and do not check the label.

**Alternative:** shipping the native stages remains the not-recommended alternative, for the reasons in `REVIEW.md` B1.

## Summary

| Item | Verdict |
|---|---|
| `calibrationEligibility.ts` | accept (B1 closed) |
| `startChartContract.ts` | accept (N1) |
| `start-chart.ts` | accept with note (N1) |
| `gameExpectationView.ts` | accept with note (N2) |
| `forge/forecasts.ts` | accept with note (N3) |
| `workspaceSchema.ts` | accept with note (W1), **for pinned `ef9a5669` only**. The working tree drifted to `ca9fda58` at about 22:56Z and needs a re-pin and a fresh verdict |
| `source.ts` | accept |
| `update-roster-optimizer-schedule.ts` | accept |
| `scripts/preview-native-baseline.ts` | accept (test support) |
| `seasonGameContributions.ts` | accept (test support) |
| `run-forge-projections.ts` (branch-only) | accept with note |
| `B2-SCHEDULE-REFRESH-PROPOSAL.md` | needs change before A2: the window must start at the RSO period start − 1 (P1) |
| B1 side effect | confirmed. Add the dashboard's legacy Start Chart path, and fix or annotate the accuracy cron's misleading 422 text, for TJ's decision |
