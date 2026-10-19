# R5 candidate file set (2026-10-19, assembled ~14:05 ET)

- Base: `git archive ad93e2887` (prod/master R4), exported to `scratchpad/r5/candidate` with `web/node_modules` symlinked to the canonical checkout. A second pristine export (`scratchpad/r5/prod`) was used only for failure baselines.
- 101 files: the 97 manifest paths plus 4 more (2 test-only fixes, 2 optional F2 Start Chart files). `candidate-files.json` lists `{path, sha1, source}`; `sha1` is `git hash-object` of the candidate bytes.
- Sources: **HEAD** = `git cat-file blob <manifest candidateBlob>` (b47c512fb). **worktree** = copied from the canonical checkout and re-hashed equal to the manifest (re-checked at the end; unchanged). **unit-only rebuild** = prod bytes + `git diff <c>^ <c>` for U2 → U1 → U3 (+ HEAD→worktree delta for U4–U6); every one equals the manifest `unitOnlyBlob`. **hand-port** = edited by hand as described below.
- Draft-pro (U1 A-06, 7 files): HEAD blobs, per F1's recommendation (unit-only rebuild impossible; prod→HEAD is one coherent A-06 change).
- `web/vercel.json`: prod + line 32 `"5 10 * * *"` → `"5-55/5 10 * * *"`; hash = `e30da9ac8c0347a7a846366600e1f54698a6aab1` as expected.

## Hand-ports (diffs vs prod)

| File | +/- | What changed |
|---|---|---|
| `web/pages/api/v1/forge/players.ts` | +76/-35 | HEAD minus the `FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT` gate. Kept A-02: 3-day fallback age limit (`shiftDateOnly`, `gte as_of_date`), local-sha fence (`.or(git_sha…)`), full-slate-over-scoped sort (`isScopedRun`), `buildResolvedDataServingContract` + `fetchGamesScheduledCount` + `servingBlocked` partial/blocking/message. Kept A-08: `buildSkaterModeledHeadTotals`. Dependency note: `select` now includes `metrics` (needed by the scope sort); rows typed `metrics?: unknown`. Diff from HEAD is exactly the 3 gate lines. |
| `web/__tests__/pages/api/v1/forge/players.test.ts` | +207/-5 | Unit-only rebuild `27e214444d`, then the A-02 fixture's `FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT` reference replaced with the literal `"excluded_from_native_inputs_v1"` (the constant is not exported in prod; prod reader ignores the value). |
| `web/__tests__/pages/api/v1/forge/goalies.test.ts` | +42/-2 | Unit-only rebuild `0123a01d48`, then: `createQueryBuilder` gains the optional `onEq` callback from HEAD (the new A-02 test needs it), and the `forge_runs` mock's provenance metrics become `metrics: {}` (constant not in prod). |
| `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts` | +137/-3 | HEAD blob (manifest said unit-only "yes", but its new U3 test calls `buildForgeInputProvenance({ externalFantasyInputsExcluded: true })`, which prod's zero-arg signature rejects). Changed to `buildForgeInputProvenance()`; prod's eligibility only checks the rolling-history contract, which that still supplies. |
| `web/lib/cron/withCronJobAudit.test.ts` | +45/-0 | Unit-only rebuild `c10a4d7893` minus one assertion on `details.responseOutcome.termination.state` (that field comes from unreleased `569245efd3`). The `continued` status assertions for both 207 bodies stay. |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` | +56/-17 | U3 A-05 hunks 1–3 and 6–10 applied cleanly (`stopClaimingPlayersAtMs`, `stoppedReason`, claimed-prefix cursor). Hunks 4–5 (output loop) hand-ported without the aligned-count builder: the `isWithinRequestedWriteWindow` check becomes an early `continue` right after the GP% accumulator update, and the push is unconditional. No `rollingPlayerCountSupport` or `resolveRollingFullRefreshMode`. |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` | +200/-0 | U3's new `main runtime budget` describe block (3 tests) inserted before `buildGameRecords`; one comment about the aligned-count builder reworded. No other test changes. |
| `web/pages/api/v1/db/update-nst-gamelog.ts` | +2/-1 | U2 off-season wrapper only: import + `adminOnly(withNhlOffSeasonSkip(handler as any))`. No requestBudget rewrite. |
| `web/pages/api/v1/game-predictions/forecast.ts` | +2/-1 | U2 off-season wrapper only. No `summarizePredictionWindowOutcome`. |
| `web/__tests__/pages/api/v1/db/update-nst-gamelog.test.ts` (**not in manifest**) | +1/-0 | Added `vi.mock("lib/cron/nhlOffSeason", …passthrough)`, the same line U2 added to its other route tests. Without it, the wrapper's `games` query is the first one the test sees, so the season-cursor test fails. |
| `web/__tests__/pages/api/v1/db/projection-materialization-auth.test.ts` (**not in manifest**) | +1/-1 | The export regex now also accepts `adminOnly(withNhlOffSeasonSkip(X as any))`. U2 wrapped all four routes, and this test (unchanged at HEAD) failed 4 cases. |

### Optional, listed separately: F2 A-08 Start Chart port (included in the export)
| File | +/- | What changed |
|---|---|---|
| `web/pages/api/v1/start-chart.ts` | +3/-27 | Import `buildSkaterModeledHeadTotals`, delete prod `sumProjectionParts` (partial-sum rule), replace the four calls with `const { goals, assists, shots, ppPoints } = buildSkaterModeledHeadTotals(projection);`. Same shape as b47c512fb's start-chart hunk. No gameExpectationReader or S-1 content. |
| `web/__tests__/pages/api/v1/start-chart.test.ts` | +0/-4 | Drop the `sumProjectionParts` import and its 3 partial-sum assertions. The null rule is covered by `modeledHeadTotals.test.ts`. |

To ship without the port, use the prod bytes for both files: the rest of the candidate does not import them.

## Verification (in the export, under `/private/tmp/fhfh-heavy.lock`; env `NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid` + dummy keys; no GIT_DIR/GIT_WORK_TREE)
- `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit --incremental false`: **passed** (exit 0, after the test hand-ports above; the first run had 12 errors, all in the goalies, players and accuracy tests).
- Focused Vitest (27 files: every unit's manifest list + `start-chart.test.ts`): **passed**, 540/540 after the withCronJobAudit assertion drop.
- Adjacent Vitest (FORGE pages, projections players/goalies, game-predictions forecast, cron-audit-wrappers, run-projection-v2, update-nst-gamelog, commandCenterData): **passed** after the nst-gamelog mock line, 114/114.
- `projection-materialization-auth.test.ts`: **passed** after the regex fix.
- ESLint (`npx eslint <100 changed code files>`): **passed**, no output.
- Full Vitest suite (extra, for cross-file breakage): 26 failed / 8269 passed. Classified:
  - **Pre-existing, also fail on the pristine ad93e2887 export:** `qualify-native-players-offline` (8–9), RSO `planningReproducibility` (5), `CategoryGains`, `RosterScheduleOptimizer`, `supportedBaselineMigration` (1 each); `nativeGoalLedgerAudit`, `nativeIntervalReconciliation` and `researchGoalBaseline` need `git rev-parse` and pass in a throwaway `git init` of the export (removed afterwards).
  - `rosterScheduleOptimizer/planning.test.ts` (1): load flake; passes alone.
  - Fixed by the 2 test hand-ports above: `projection-materialization-auth` (4).
  - **Open, caused by the approved vercel.json edit: `lib/cron/combinedCronInventory.test.ts` › "keeps retired cross-provider projection and sustainability collisions absent".** `findCrossProviderCronCollisions` flags domain `contextual_builders`. pg_cron `update-line-combinations-job` (`*/25 * * * *`, from `tasks/TASKS/cron-operations/cron-schedule.md`) and vercel `run-rolling-forge-pipeline` (`5-55/5 10 * * *`) both fire at 10:25 and 10:50 UTC. Prod's `5 10 * * *` did not collide. **Not changed: Chef/TJ decision.** Options: accept and update the test or allowlist, or use a schedule that skips :25/:50 (that changes the blob from `e30da9ac8`).

## Dropped / not included
- `FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT` gate (players/goalies + tests), `rollingPlayerCountSupport.ts` and aligned counts, `resolveRollingFullRefreshMode`, `lib/nst/requestBudget.ts` and the NST budget rewrite, `summarizePredictionWindowOutcome`, `teamStatsSummaryRefresh` (underlying-stats), `rowsUpserted/partialWrite` (rebuild-baselines), cron-report's `refresh-roster-optimizer-schedule`/`gate`/`responseOutcome` residue, and `569245efd3` `responseOutcome` retention. All are unreleased dependencies, removed via the unit-only rebuilds or hand-ports. No dependency file was added.
- `web/pages/start-chart.tsx`, gameExpectationReader and S-1 `forecastServingSource`: excluded (F2).
- R6 S-1, shift-charts/HTML-fallback, frozen FORGE, homepage/NewsFeed, F3 paths and `tasks/**`: excluded.
- The working-tree `TeamStandingsChart.tsx` was not used; the HEAD blob `2e18a56a0` was (F4).

## Per-file list
| Path | sha1 | Source |
|---|---|---|
| `web/__tests__/pages/api/Teams/nst-team-stats.route.test.ts` | 09dfbb38ff | HEAD |
| `web/__tests__/pages/api/v1/db/cron-report.test.ts` | 6099684bb3 | unit-only rebuild (prod + unit patches) |
| `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts` | bac2fadc40 | worktree |
| `web/__tests__/pages/api/v1/db/projection-materialization-auth.test.ts` | 7a47751656 | hand-port |
| `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts` | bc8e9f5118 | hand-port |
| `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` | 381d6f17aa | worktree |
| `web/__tests__/pages/api/v1/db/sweep-gamecenter-normalization.test.ts` | 6f2c938c6a | HEAD |
| `web/__tests__/pages/api/v1/db/update-nst-gamelog.test.ts` | ba232d2d36 | hand-port |
| `web/__tests__/pages/api/v1/db/update-nst-team-daily.test.ts` | 38031e08fe | HEAD |
| `web/__tests__/pages/api/v1/db/update-rolling-player-averages.test.ts` | 45440b5e8a | unit-only rebuild (prod + unit patches) |
| `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts` | ca182bb837 | HEAD |
| `web/__tests__/pages/api/v1/db/update-wgo-goalies.test.ts` | ba4732f9cc | HEAD |
| `web/__tests__/pages/api/v1/forge/goalies.test.ts` | 3c66d654ed | hand-port |
| `web/__tests__/pages/api/v1/forge/players.test.ts` | 8a5e8f031a | hand-port |
| `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts` | 86c95eac8f | HEAD |
| `web/__tests__/pages/api/v1/season.test.ts` | f7fb05a3ef | HEAD |
| `web/__tests__/pages/api/v1/start-chart.test.ts` | b515ea58c1 | hand-port (F2 A-08 Start Chart, optional) |
| `web/__tests__/pages/api/v1/trends/skater-power.test.ts` | 20b0420aca | HEAD |
| `web/components/Admin/CronRouteRunner.test.ts` | 4fffbb41c6 | HEAD |
| `web/components/Admin/CronRouteRunner.tsx` | 618504e702 | HEAD |
| `web/components/PlayerStats/PlayerContextualStats.tsx` | 177e706177 | HEAD |
| `web/components/TeamStandingsChart/TeamStandingsChart.tsx` | 2e18a56a0d | HEAD |
| `web/components/TeamStandingsChart/chartUtils.test.ts` | d743d6c35c | HEAD |
| `web/components/TeamStandingsChart/chartUtils.ts` | 6c0bb3da2c | HEAD |
| `web/components/WiGO/RateStatPercentiles.test.tsx` | 3aff9c3b10 | HEAD |
| `web/components/WiGO/RateStatPercentiles.tsx` | 10fe03f6a7 | HEAD |
| `web/lib/NHL/server/index.test.ts` | 29c82d92c6 | HEAD |
| `web/lib/cron/nhlOffSeason.test.ts` | c7ddd9fbb4 | HEAD |
| `web/lib/cron/nhlOffSeason.ts` | ca235fd37b | HEAD |
| `web/lib/cron/withCronJobAudit.test.ts` | e3599e77ea | hand-port |
| `web/lib/cron/withCronJobAudit.ts` | 4a7de85bf8 | unit-only rebuild (prod + unit patches) |
| `web/lib/draft-pro/api-tests/private-imports.test.ts` | 492f5dbd36 | HEAD |
| `web/lib/draft-pro/privateImportTransport.test.ts` | 87af22660e | HEAD |
| `web/lib/draft-pro/privateImportTransport.ts` | fe06dfa55d | HEAD |
| `web/lib/draft-pro/requestError.ts` | ab30399057 | HEAD |
| `web/lib/draft-pro/server.ts` | d5c19b5790 | HEAD |
| `web/lib/projections/modeledHeadTotals.test.ts` | 3055a080aa | HEAD |
| `web/lib/projections/modeledHeadTotals.ts` | 7e050e5f04 | HEAD |
| `web/lib/rollingForgePipelineRunState.ts` | e1765914fa | worktree |
| `web/lib/rollingPlayerDailyResume.ts` | d780913971 | HEAD |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` | b6374dd7c6 | hand-port |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` | f953f55d2e | hand-port |
| `web/lib/sustainability/incremental.test.ts` | c8463d6443 | HEAD |
| `web/lib/sustainability/incremental.ts` | a08258971b | HEAD |
| `web/pages/api/Teams/nst-team-stats.ts` | bf1235cd36 | HEAD |
| `web/pages/api/v1/account/draft-pro/private-imports.ts` | 84142feeb4 | HEAD |
| `web/pages/api/v1/account/draft-pro/private-imports/[uploadId]/chunks/[ordinal].ts` | 44ba226597 | HEAD |
| `web/pages/api/v1/account/draft-pro/private-imports/[uploadId]/stage.ts` | 91fa221e75 | HEAD |
| `web/pages/api/v1/db/build-projection-derived-v2.ts` | 0da194a354 | HEAD |
| `web/pages/api/v1/db/calculate-wigo-stats.ts` | 3a92c89f44 | HEAD |
| `web/pages/api/v1/db/cron-report.ts` | b3e0da2fd5 | unit-only rebuild (prod + unit patches) |
| `web/pages/api/v1/db/ingest-projection-inputs.ts` | 6316850937 | worktree |
| `web/pages/api/v1/db/powerPlayTimeFrame.ts` | 99cae572c6 | HEAD |
| `web/pages/api/v1/db/run-fetch-wgo-data.ts` | 2bebbb07b9 | HEAD |
| `web/pages/api/v1/db/run-projection-accuracy.ts` | 569d29401e | unit-only rebuild (prod + unit patches) |
| `web/pages/api/v1/db/run-projection-v2.ts` | 7aee98e1dc | HEAD |
| `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` | d741c4e73b | worktree |
| `web/pages/api/v1/db/sustainability/rebuild-baselines.ts` | 9b3a28e992 | unit-only rebuild (prod + unit patches) |
| `web/pages/api/v1/db/sweep-gamecenter-normalization.ts` | 8bc416ddb2 | HEAD |
| `web/pages/api/v1/db/update-PbP.ts` | fda429f35d | HEAD |
| `web/pages/api/v1/db/update-game-goal-projections/index.ts` | 42293a9be8 | HEAD |
| `web/pages/api/v1/db/update-goalie-projections-v2.ts` | 2e340d7af0 | HEAD |
| `web/pages/api/v1/db/update-line-combinations/index.ts` | 13c06de11a | HEAD |
| `web/pages/api/v1/db/update-lineup-deployment-tallies.ts` | 2ce50209db | HEAD |
| `web/pages/api/v1/db/update-nhl-edge-stats.ts` | bb4a0d6656 | HEAD |
| `web/pages/api/v1/db/update-nst-current-season.ts` | 0e62d7e2de | HEAD |
| `web/pages/api/v1/db/update-nst-gamelog.ts` | 4e3078b9b9 | hand-port |
| `web/pages/api/v1/db/update-nst-goalies.ts` | 79941d58ea | HEAD |
| `web/pages/api/v1/db/update-nst-team-daily.ts` | e81128809d | HEAD |
| `web/pages/api/v1/db/update-player-trend-metrics.ts` | a7e29a6b11 | HEAD |
| `web/pages/api/v1/db/update-player-underlying-stats.ts` | c14332900d | unit-only rebuild (prod + unit patches) |
| `web/pages/api/v1/db/update-power-play-combinations/index.ts` | 402c270f7a | HEAD |
| `web/pages/api/v1/db/update-rolling-player-averages.ts` | 69ad80aceb | unit-only rebuild (prod + unit patches) |
| `web/pages/api/v1/db/update-season-stats.ts` | 674a16ef08 | HEAD |
| `web/pages/api/v1/db/update-shifts.ts` | 72db4c3173 | HEAD |
| `web/pages/api/v1/db/update-sko-stats.ts` | a0cd5b7229 | HEAD |
| `web/pages/api/v1/db/update-standings-details/index.ts` | 21cba0840f | HEAD |
| `web/pages/api/v1/db/update-team-ctpi-daily.ts` | 367e79ff9d | HEAD |
| `web/pages/api/v1/db/update-team-power-ratings.ts` | 08705b7be5 | HEAD |
| `web/pages/api/v1/db/update-team-sos.ts` | d571513597 | HEAD |
| `web/pages/api/v1/db/update-team-yearly-summary.ts` | 2c900b8552 | HEAD |
| `web/pages/api/v1/db/update-wgo-averages.ts` | f1876266ac | HEAD |
| `web/pages/api/v1/db/update-wgo-goalie-totals.ts` | 71d34939ac | HEAD |
| `web/pages/api/v1/db/update-wgo-goalies.ts` | d84e5997da | HEAD |
| `web/pages/api/v1/db/update-wgo-skaters.ts` | 1502615b7e | HEAD |
| `web/pages/api/v1/db/update-wgo-totals.ts` | b8dd15a0e6 | HEAD |
| `web/pages/api/v1/forge/goalies.ts` | 3fafc008f7 | unit-only rebuild (prod + unit patches) |
| `web/pages/api/v1/forge/players.ts` | 96578e1575 | hand-port |
| `web/pages/api/v1/game-predictions/forecast.ts` | 29fcbd8b26 | hand-port |
| `web/pages/api/v1/game-predictions/ingest-espn-odds.ts` | ac26f9124f | HEAD |
| `web/pages/api/v1/game-predictions/score.ts` | e67c483578 | HEAD |
| `web/pages/api/v1/ml/update-predictions-sko.ts` | e24056ebc8 | HEAD |
| `web/pages/api/v1/season.ts` | 381178a0e5 | HEAD |
| `web/pages/api/v1/start-chart.ts` | 7247c33231 | hand-port (F2 A-08 Start Chart, optional) |
| `web/pages/api/v1/sustainability/rebuild-priors.ts` | 12ac31c7d2 | HEAD |
| `web/pages/api/v1/sustainability/rebuild-score.ts` | 091608566d | HEAD |
| `web/pages/api/v1/sustainability/rebuild-trend-bands.ts` | a8950da781 | HEAD |
| `web/pages/api/v1/sustainability/rebuild-window-z.ts` | 913b27e39c | HEAD |
| `web/pages/api/v1/trends/skater-power.ts` | 7ee2a72a43 | HEAD |
| `web/pages/db/index.tsx` | 06b23b1bc7 | HEAD |
| `web/vercel.json` | e30da9ac8c | prod + line-32 edit |
