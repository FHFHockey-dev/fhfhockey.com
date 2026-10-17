# G5a-forge-model-startchart: verification findings

Read-only audit, 2026-10-17, branch octoberBranch, HEAD `ceceb407a`, production `457435eb`. One focused test file was run (`web/scripts/qualify-native-players-offline.test.ts`, 8 failures reproduced). Nothing else was run.

## (a) Coverage

- **Completed rows in group:** 364 ledger rows, all `[x]`. They are 102 prediction-engine super list, 18 prd, 56 goalie, 40 projection-model, 36 modularization, 57 skater and 55 start-chart.
- **Post-import rows:**
  - Start-chart gained 58 rows (48 `[x]`, 10 `[ ]`).
  - Projection-model gained 19 rows (4 `[x]` OCT11-P*, 15 `[ ]`).
  - The super list gained 1 open row (`OCT14-COMP`).
  - Source totals now: start-chart 103/113, projection-model 44/59, super list 102/103.
- **Master rows:** 7 audited (3.9, 4.6, 5.4.1, 5.4.2, 5.4.6, 5.7.6, 5.7.23).
- **Source rows:** 51 audited in depth (58 table rows with the 7 master rows), plus sub-claims folded into the master rows.
- **Selection:**
  - All 7 master rows.
  - Both rows tagged P1 in the group (goalie NEW 9.0, skater NEW 9.0/9.1).
  - Rows whose owning code changed after completion: the 25c89d795 Start Chart page, the be1aaa0b06 FORGE page rewrite, and 7f094c8e6 "big commit" (skater/goalie stages, readers, admission, `start-chart.ts`).
  - The 4 completed OCT11-P* rows.
  - A spread sample across all 7 sources.
- **Ledger-line column:** the master-list line for ledger rows. "(post-import, src Lnnn)" marks rows added after the ledger import, with the source-file line. Master rows use the master-list line.
- **Working tree:** `git diff HEAD` showed the uncommitted work in `calibrationEligibility.ts`, `run-forge-projections.ts` and `start-chart.ts` as another session's B1/N1 fixes. I treated it as non-final.

## (b) Verdict table

| Row | Ledger line | Verdict | Evidence | Note |
|---|---|---|---|---|
| 3.9 `A-FORGE-V1` | master L434 | STALE-EVIDENCE | `tasks-prd-projection-model.md` is now 44/59 (15 open OCT11-G1..G5, OCT14-COMP-0..9). `skaterRollout.ts:14-20` fail-closed baseline and `skaterRollout.test.ts:13-27` hold. The model changed at 7f094c8e6: `skater-stage.ts:1460,1592` and `goalie-stage.ts:166` now pass `allowCurrentFantasy=false`, and conversion heads are masked to null. | The "main 40/40" count and "current model/reader regression cohort" predate the native-input rewrite. The promotion block (no 14 matched dates) is unchanged. |
| 4.6 `B-START` | master L453 | CONTRADICTED | The source file's own Notes (`tasks-prd-start-chart.md` ~L19) say the 55/55 rows are "not a current completion claim" and that status is the reopened tranche. 10 rows are open (15.1-15.4, 15.6, 17.0, 17.7, 17.7.5, 17.8, plus the 17.0 parent). `96ccea804` (2026-07-30) is an ancestor of production, and production `457435eb` differs from it by about 3,100 lines in `start-chart.ts`/`start-chart.tsx`. | The master "Complete at 55/55" conflicts with the owning list. The Production proof is for a superseded SHA. |
| 5.4.1 | master L492 | STALE-EVIDENCE | Reader, writer and dashboard ownership intact. `GoalieRiskCard.tsx:142` has the stable message, but no test asserts it. The audit missed goalie UI deletions (`tasks-goalie-forge.md` 6.5/8.1/8.3) and the `proj_win_prob` null-to-0 defect (see goalie 8.2). | "Four-file/35-test cohort" is not reproducible: no GoalieRiskCard test exists. |
| 5.4.2 | master L493 | STALE-EVIDENCE | `run-forge-projections.ts` is 1054 lines at production and at HEAD (1056 with edits), not 827. The five stage modules exist. No `.upsert/.insert/.update/.delete` in the runner. | Outcome holds; the line count is stale after the October capture work. |
| 5.4.6 | master L497 | STALE-EVIDENCE | All 19 named paths resolve (checked). Current parity differs from the stated one: F 95/95 (not 94/95), G 86/89 (not 85/89), E 39/39 (not 38/38). The "five open Sustainability rows" are now 3. The super list gained an open `OCT14-COMP` row (L310). | Counts out of date. |
| 5.7.6 `C-DYNAMIC-A-FORGE-V1` | master L511 | REGRESSED | Fail-closed rollout and stable 5xx hold (`apiHelpers.ts:24-26`, wired in all 5 reader routes). 7f094c8e6 added an admission gate to every canonical reader: `apiHelpers.ts:58-62`, `forge/players.ts:161`, `forge/goalies.ts:483`, `projections/{players,teams,goalies}.ts:62-71`, `consumerRevisionAdmission.ts:88`. Production's `buildForgeInputProvenance` never stamped the label (`git show 457435eb:web/lib/projections/calibrationEligibility.ts`). | At HEAD every run written by production code is unreadable/ineligible (422/skip) until the new pipeline writes the label. See Top problem 1. |
| 5.7.23 `C-DYNAMIC-B-START` | master L528 | REGRESSED | `start-chart.ts:910-913` sets `forgeRun = null` when the run lacks `external_fantasy_input_contract`. The page now fetches `...&forecast_source=game_expectations` (`start-chart.tsx` diff, `useSWR` line). The route has 3 serving paths and POST custom scoring (`start-chart.ts:1121-1128`). 3 files/22 tests became 47 + 40 `it`s. | "Reads latest-succeeded run" no longer describes the default page path. 422 `control_unavailable` for tau/risk/model_version still holds (`start-chart.ts:280-326`, test L2296-2303). |
| goalie 1.1 | L2431 | VERIFIED | `runProjectionV2.test.ts:412` "removes non-current-team goalies and very stale options" | |
| goalie 1.2 | L2432 | VERIFIED | `runProjectionV2.test.ts:128` stale goalies after 30+ days | |
| goalie 1.4 | L2434 | VERIFIED | `runProjectionV2.test.ts:97` | |
| goalie 5.3 | L2462 | VERIFIED | `run-projection-v2.ts:920-1060` (`chunkDays`, `resumeFromDate`, `resume_required`); route unchanged vs production; `run-projection-v2.test.ts` | |
| goalie 6.1 | L2467 | VERIFIED | `forge/goalies.test.ts` (model version, scenario count, calibration hints) | |
| goalie 6.3 | L2469 | STALE-EVIDENCE | Starter-confidence drivers survive in `GoalieRiskCard.tsx:65` (`buildConfidenceDrivers`), not in the FORGE goalie view the task names. | UI moved to the dashboard card. |
| goalie 6.5 | L2471 | REGRESSED | be1aaa0b06 (2026-03-18, "Big push") rewrote `pages/FORGE.tsx` (1178 to 824 lines) and removed the goalie disclosure panel. No "limitation/caveat/disclosure" text in `GoalieRiskCard.tsx`. | |
| goalie 8.1 | L2481 | REGRESSED | be1aaa0b06: the game ticker above `.goalieDisclosure` is gone (`grep goalieDisclosure` finds only Start Chart's own `gameStrip`). | |
| goalie 8.2 | L2482 | CONTRADICTED | `forge/goalies.ts:438` coerces `proj_win_prob: row.proj_win_prob ?? 0`, then `normalizeLikelyStarterWinProbabilities` (L150-210) renormalizes to 100%. 7f094c8e6 made the stage emit `null` win probability when team goals are unavailable (`goalie-stage.ts:616,635,755`; `goalieModel.ts:193`). A null becomes 0, and an all-zero matchup falls to starter-probability weights (L186-205), inventing win probabilities. | No test covers null win probability (`forge/goalies.test.ts` has none). |
| goalie 8.3 | L2483 | REGRESSED | be1aaa0b06 removed "Uncertainty Range (Floor / Typical / Ceiling)" blocks from `pages/FORGE.tsx`. Only an API disclosure string remains (`forge/players.ts:453`). | |
| goalie NEW 9.0 (P1) | L2484 | STALE-EVIDENCE | `GoalieRiskCard.tsx:142` renders a fixed unavailable message. | No test asserts it. |
| goalie NEW 9.1 (P3) | L2485 | CONTRADICTED | The claim is that links now resolve to canonical paths. Two Relevant Files paths do not exist: `web/pages/FORGE.test.tsx` (real: `web/__tests__/pages/FORGE.test.tsx`) and `web/pages/api/v1/forge/goalies.test.ts` (real: `web/__tests__/pages/api/v1/forge/goalies.test.ts`). | |
| skater 1.2 | L2573 | VERIFIED | `runProjectionV2.test.ts:1450-1500` (hard/soft stale line-combo boundaries) | |
| skater 3.1 | L2588 | VERIFIED | `skater-adjustments.ts:591-630` `applySupportedSkaterConversionHeads`; ES/PP split present | Behavior changed: heads are null without aligned count support. See top problem 3. |
| skater 6.3 | L2611 | VERIFIED | `__tests__/pages/FORGE.test.tsx:196` renders "L1/PP1 - 58% PP share - 76% goalie certainty - 2d rest" | |
| skater 6.4 | L2612 | STALE-EVIDENCE | No Floor/Typical/Ceiling labels in `pages/*.tsx` or `components/*.tsx`. The definition survives only as an API disclosure string (`forge/players.ts:453`). | |
| skater 7.1 | L2616 | VERIFIED | `run-projection-v2.test.ts:341` "separates missing, stale, thin-role, and derived skater freshness failures" | |
| skater 8.2 | L2623 | UNVERIFIABLE-OFFLINE | Owner exception recorded in the row itself. Code holds `skaterRollout.ts:SKATER_ROLLOUT_GOVERNANCE.shadowMinimumDays=14`, but it is config only. | See section (d), check 4. |
| skater NEW 9.0 (P1) | L2626 | VERIFIED | `skaterRollout.ts:14-21` (only the literal "candidate", case/space-insensitive, selects the candidate); `skater-stage.ts:2635,2700,2722`; test `skaterRollout.test.ts:13-27` | Row text says "exact candidate"; code also accepts case and whitespace variants. Immaterial. |
| skater NEW 9.1 (P1) | L2627 | VERIFIED | `apiHelpers.ts:24-26` returns `stableInternalError` for status>=500; used by all 5 reader routes (grep). `apiHelpers.test.ts` retains the 4xx/5xx cases. | |
| pm 3.6 | L2511 | CONTRADICTED | The row says "write unit tests for these invariants". `web/lib/projections/reconcile.test.ts` was deleted in 7d72524715 (2026-01-07). No test imports `reconcileTeamToPlayers`; `runProjectionV2.test.ts:1113` tests only `validateReconciledPlayerDistribution`. | Hard TOI/shot reconciliation is untested. |
| OCT11-P1 | (post-import, src L131) | VERIFIED | `privateParticipationScenario.ts:1-180` (exact identity binding, original body/hash, clocks, receipts); `privateParticipationScenario.test.ts` (20 `it` blocks) | |
| OCT11-P2 | (post-import, src L132) | VERIFIED | `privateParticipationScenario.ts:55-130`, `assertion()` 0/1 indicator only; `calibratedProbability:false`, `publicAdmissionAllowed:false` (L170-180) | |
| OCT11-P3 | (post-import, src L133) | VERIFIED | `result()` returns `validatedEvidence: reduced ? evidence : null` (L173); test L48 `it.each(["hash-mismatch","expired","canonical-mismatch"])` | |
| OCT11-P4 | (post-import, src L134) | UNVERIFIABLE-OFFLINE | The row is a process claim (reviewer re-ran a four-case probe; 29/29 mechanics regressions). Code and tests agree with it; the review itself is not checkable. | Needs the review artifact. |
| prd C0002 | L2410 | REGRESSED | be1aaa0b06 removed the plain-language low/typical/high FORGE presentation (see goalie 8.3). | |
| prd C0003 | L2411 | REGRESSED | Same. The P10/P50/P90 legend is only an API disclosure string. | |
| mod 5.4 | L2556 | VERIFIED | `stages/{preflight,skater,goalie,persistence,metrics-finalization}-stage.ts`; `module-imports.test.ts` | |
| mod 7.2 | L2563 | STALE-EVIDENCE | Parity artifacts exist (`tasks/artifacts/forge-projections-parity-*`) and are dated March (baseline `a3f6173`). The October stage rewrite no longer matches them (null heads, no external bootstrap). | Historical parity only. |
| mod NEW 8.0 | L2566 | STALE-EVIDENCE | Runner is 1054 lines, not 827; no direct mutations. | |
| pe 5.2 | L2351 | VERIFIED | `pages/api/v1/runs/[runId].ts`; `__tests__/pages/api/v1/runs/detail.test.ts` | |
| pe 5.3 | L2352 | VERIFIED | `forge/roster-events.ts` (adminOnly, GET/POST/PATCH/DELETE); lib `rosterEvents.test.ts`. Route has no test. | Trigger endpoint is the cron-secured `run-projection-v2.ts`. |
| pe 5.7 | L2356 | STALE-EVIDENCE | `reconcileTeamToPlayers` is called at `skater-stage.ts:2544`, but its test is gone (see pm 3.6). | |
| pe 7.9 | L2380 | VERIFIED | `promotionGates.ts`; `promotionGates.test.ts` (4 cases) | |
| pe 10.3 | L2402 | VERIFIED | No `update-start-chart-projections.ts` route; retired route recorded in `compatibilityInventory.ts:88,125` | |
| pe NEW 11.0 (P3) | L2405 | STALE-EVIDENCE | Counts as in 5.4.6. | |
| sc 4.5 | L5575 | STALE-EVIDENCE | `startChartFantasyScoring.ts:60-61` still declares `unavailable.categoryMode: true`, but the page now ships "Individual category" mode (`start-chart.tsx` diff) ranked by `boardScore.sortValue`. | Contract contradicts the shipped UI. |
| sc 5.2 | L5579 | VERIFIED | `start-chart.ts:280-326` 400/422 structured errors; test L2296-2303 | |
| sc 6.3 | L5587 | REGRESSED | No tau/P75/category "unavailable" explanations remain in `start-chart.tsx` (grep empty). The controls were replaced by live category scoring and a comparison-basis selector. | 7f094c8e6 and earlier. |
| sc 7.3 | L5594 | VERIFIED | No write path in `start-chart.ts` (GET/POST scoring only) | |
| sc NEW 9.1 | L5603 | VERIFIED | `startChartFantasyScoring.ts:70-110` competition ranks; tests `start-chart.test.ts:201,242` | |
| sc NEW 9.2 | L5604 | VERIFIED | `start-chart.tsx:1168` key is `${position}-${player.row_key}`; row_key at `startChartContract.ts:109` | |
| sc NEW 9.3 | L5605 | VERIFIED | `start-chart.tsx:1478-1486` destructures `key` and passes it directly | |
| sc NEW 9.4 | L5606 | UNVERIFIABLE-OFFLINE | SHA `96ccea804` is real (2026-07-30) and an ancestor of production. READY/Production state is not provable here, and production now runs `457435eb`. | See section (d), check 1. |
| sc 11.5 | (post-import, src L151) | CONTRADICTED | `start-chart.ts:739-744` `sumProjectionParts` returns the sum of the non-null parts. With heads now masked individually (`skater-adjustments.ts:625-628`), a null PP-goals head is read as zero and the partial total is scored (`hasCompleteScoringLine` at L1563-1570 passes). | Under-reports and does not preserve null. Legacy and dashboard consumers still use this path (`dataFetchers.ts:440`, `TeamPowerCard.tsx:129`, `SlateStripCard.tsx:161`, `FORGE.tsx:230`). |
| sc 12.4 | (post-import, src L159) | REGRESSED | The row says disclose 25 rows at a time. 25c89d795 (2026-09-25) changed `INITIAL_POSITION_LIMIT` 25 to 5 and "Load 25 more" to "View all" (`start-chart.tsx:53,1098`). | |
| sc 14.5 | (post-import, src L175) | VERIFIED | `start-chart.test.ts:1789` builds a 200-row response for the size check; cache bound 64 at `start-chart.ts:MAX_RESPONSE_CACHE_ENTRIES` | The 300 KB figure is now superseded by the 4,000,000 B envelope (`START_CHART_RESPONSE_MAX_BYTES`, uncommitted). `perfBudget.ts:18` still says 300,000. |
| sc 15.5 | (post-import, src L187) | REGRESSED | Cites "25-more/reset flows"; same cause as 12.4. | |
| sc 16.2 | (post-import, src L192) | VERIFIED | `start-chart.tsx:1371` heading "Recent Team Form"; no "CTPI Pulse" | |
| sc 17.6 | (post-import, src L203) | VERIFIED | `ctpi.ts:5-6,12`; `team-ctpi.test.ts:158-232` | |
| sc 17.7.2 | (post-import, src L206) | VERIFIED | `supabase/migrations/20260828142331_recent_team_form_nullable_components.sql` SHA-256 prefix `f8354cea...` matches the row | |

## (c) Top problems

### Failing test: `qualify-native-players-offline.test.ts` (8 failures)

The cause is a real defect, not private-file drift. Reproduced 8 of 56 failing.

- **Cause:** 7f094c8e6 added a gate in `consumerRevisionAdmission.ts:88`. It excludes any revision whose `inputProvenance.external_fantasy_input_contract` is not the native-inputs label (`use_not_approved`).
- **Where the harness falls short:** `scripts/qualify-native-players-offline.ts:391` hand-builds the payload's `inputProvenance` with only `rolling_player_history_contract`, `issuedContexts` and `capturedReads`. It drops the label that `captured.snapshot.inputProvenance` carries. The unchanged admission therefore rejects every offline target, so each `acceptedByUnchangedConsumer: true` assertion and the `missing_participation` reason assertion fails.
- **Separate time-drift cause:** the fixture game starts at 2026-10-12T23:00Z, so a real clock after 10-12 expires the revision. The uncommitted `beforeEach` fake-timer edit (`qualify-native-players-offline.test.ts`) addresses this; the test still fails after it.
- **Private files:** the test does not read `/Users/tim/Documents/FHFH-private`.
- **Fix:** copy `external_fantasy_input_contract` from `captured.snapshot.inputProvenance` into the payload at L391.
- I did not execute that fix. The conclusion rests on the code path plus the 8 reproduced failures.

### 1. P1 REGRESSED (5.7.6, 5.7.23): reader gate on a label production never wrote

7f094c8e6 gates the canonical readers and Start Chart on `external_fantasy_input_contract`.

- **Where:**
  - `start-chart.ts:910-913` nulls the run.
  - `apiHelpers.ts:58-62` returns 422.
  - `forge/players.ts:161` skips the run.
  - `forge/goalies.ts:483` returns 422.
  - `projections/{players,teams,goalies}.ts` return 422.
- **Production contrast:** `git show 457435eb:web/lib/projections/calibrationEligibility.ts` has no such label. Every historical run has `metrics.input_provenance` without it.
- **Effect:** once HEAD code reads production data, every old run is unreadable until the pipeline writes the label. The Start Chart legacy path then silently serves no skaters.
- **Related release blocker:** `BLOCKERS.md` B1 fixes the builder to opt in (uncommitted `calibrationEligibility.ts`). That is correct for octoberBranch. Releasing the readers over production-pipeline bytes writes no label, so the readers keep rejecting new runs too. `BLOCKERS.md` notes the accuracy-cron side effect but not this reader and Start Chart effect.
- **Affected claims:** the "canonical readers", "populated Production evidence", "latest-succeeded run-keyed" claims in 5.7.6, 5.7.23 and 4.6.

### 2. P2 CONTRADICTED (goalie 8.2): null win probability fabricated into a number

`forge/goalies.ts:438` coerces a null `proj_win_prob` to 0, and the matchup normalizer (L150-210) then divides starter probabilities among the goalies. 7f094c8e6 now emits `null` when team goals are missing (`goalieModel.ts:193`, `goalie-stage.ts:616,635,755`). The reader therefore invents a win probability from starter weights. `forge/goalies.test.ts` has no null case.

### 3. P2 CONTRADICTED (sc 11.5): a partial scoring line is scored as complete

`sumProjectionParts` (`start-chart.ts:739-744`) treats a masked head as zero. After 7f094c8e6, `proj_goals_pp` and `proj_assists_pp` can be null independently of the ES heads (`skater-adjustments.ts:625-628`). Goals, assists and PPP become partial sums, and `hasCompleteScoringLine` passes. The result is under-reported fantasy points and ranks on the dashboard and legacy path. Rows with all-null heads are fine.

### 4. P2 CONTRADICTED (pm 3.6, with pe 5.7 STALE): reconciliation constraints have no test

`reconcile.test.ts` was deleted in 7d72524715 and not replaced. `reconcileTeamToPlayers` (used at `skater-stage.ts:2544`) is the sole enforcement of team TOI/shot totals and has no direct test.

### 5. P2 CONTRADICTED (4.6): the master closes what its owning list reopens

The master calls 4.6 "Complete at 55/55", while `tasks-prd-start-chart.md` states the 55/55 rows are not a completion claim and holds 10 open rows. The cited Production proof (`96ccea804`) is not the production SHA.

### 6. P3 REGRESSED: UI behaviors deleted after being marked done

| Rows | Cause |
|---|---|
| goalie 6.5, 8.1, 8.3; prd C0002, C0003 | be1aaa0b06 (2026-03-18) rewrote the FORGE page |
| sc 12.4, 15.5 | 25c89d795 (2026-09-25) |
| sc 6.3 | Category scoring added; unavailable-control copy removed |

### 7. P3 CONTRADICTED / STALE

- **goalie NEW 9.1:** two non-existent paths.
- **Ranking contract:** `START_CHART_RANKING_CONTRACT.unavailable.categoryMode` is still `true` (`startChartFantasyScoring.ts:60`), against the live category mode.
- **`perfBudget.ts:18`:** still 300,000 B.
- **Test coverage:** `apiHelpers.test.ts` lost its `requireLatestSucceededRunId` block in the working tree (replaced by `apiHelpers.runAdmission.test.ts`). `runProjectionV2.test.ts` moved tests to `runProjectionV2.alignedConversion.test.ts`. Both look like relocations; confirm there is no net loss.

## (d) UNVERIFIABLE-OFFLINE checks

1. **Vercel deployment read.** Is `dpl_HCFwiK4yAPeXUG3QzC3R28NtYvsc` (commit `96ccea804`) READY/Production, and what is the current Production deployment? Then run a bounded GET of `/api/v1/start-chart?date=2026-03-14` and compare against the 351/14/32 figures. Budget: at most 5 read-only requests.
2. **SQL:** `select count(*) filter (where metrics->'input_provenance' ? 'external_fantasy_input_contract'), count(*) from forge_runs where status='succeeded'`. This confirms how many hosted runs the new reader gates would reject (problem 1).
3. **SQL:** confirm `rolling_player_metric_support_payloads` exists with the expected `payload_schema_version`. `skater-queries.ts` (7f094c8e6) hard-fails a skater run if a support row is malformed.
4. **SQL:** `forge_projection_results` and `forge_runs` distinct matched dates, to confirm the 14-date shadow gate and the skater 8.2 exception remain unmet.
5. **Review artifact for OCT11-P4:** the independent reviewer record for `privateParticipationScenario.ts`.
6. **Staged migrations:** confirm `20260828130824_start_chart_yahoo_overlay_reader.sql`, `20260828142331_recent_team_form_nullable_components.sql` and `20260828162000_add_sustainability_repair_versions.sql` are still unapplied in the hosted catalog.
