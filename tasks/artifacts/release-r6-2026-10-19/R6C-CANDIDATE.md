# Release R6c candidate (RSO port onto master, 2026-10-19)

- **Candidate:** `707f60e8331e22c9d851a5592aa06528e359b7fe`, parent `3755308fa` (R6a on master), tree `97a44fd865`. Local ref `chef/release-r6c-candidate`, not pushed.
- **Built with:** a temp `GIT_INDEX_FILE` (read-tree `3755308fa`, update-index of 85 blobs, `commit-tree`). No merge of octoberBranch.
- **Size:** 85 files (51 new, 34 changed), +9434/−389. All web/, all RSO-owned except `liveDraft.ts` (+test).
- **Source:** octoberBranch `ed949622d` as-is for 77 files; 8 files carry port edits (below).

## Port edits (vs octoberBranch)

- `web/lib/rosterScheduleOptimizer/dailyDecisionReplay.test.ts`: fixture drops the external-fantasy label (master has none; same edit as R6a)
- `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`: held-open expiry fixtures use `expiresAt` (master sources have no `catalogExpiresAt`)
- `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx`: reads plain `PlanningData` (no transport decode); expiry uses `expiresAt` only
- `web/lib/in-season/workspaceSchema.test.ts`: one type cast (master's `ContributionParticipation` has no `model`)
- `web/lib/rosterScheduleData/planning.test.ts`: master's file plus the bridge wiring test (no native-source case)
- `web/lib/rosterScheduleData/planning.ts`: master's loader plus only the bridge option/hunk
- `web/lib/rosterScheduleOptimizer/planningTypes.ts`: power-play role type inlined (no `gameExpectations` import)
- `web/pages/api/v1/roster-schedule-optimizer/data.ts`: master's route plus `{ forgeDailyBridge: true }`; no serving source, no transport

## Left on octoberBranch (not shipped)
- Native/FORGE-contract modules: `consumerRevisionAdmission`, `calibrationEligibility`, `issuedContext`, `gameRevisions`, `skater-adjustments`, `run-forge-projections.types`, `rollingPlayerCountSupport`, all native `player-forecasts/*` (catalog head, modeled participation and stores, contributions/planningContributions/resolvedPlanningForecast/scopeReads changes, baseline*, sourceSnapshot, targetRosterObservation, forecastServingSource, gameExpectations).
- `rosterScheduleData/planningDataTransport.ts` and the native `data.test.ts` route test.
- `rosterScheduleData/planningInputs.ts` (schedule-witness reader, ISO schedule-revision hash: Start Chart imports it), `source.ts`, `recurring.ts`, the schedule cron route.
- `GameGrid/utils/calcWinOdds.ts`.

## Non-RSO file included
- `web/lib/integrations/yahoo/liveDraft.ts` (+5/−1) and its test (+9): the weekly goalie minimum comes from Yahoo `min_games_played` (explicit 0 = none, absent = unknown). Used by the RSO provider and by Start Chart's `starterBoard.ts` only for a limitation note. The RSO goalie-minimum replay tests need it.

## Gate (candidate tree exported to a throwaway `git init`, no GIT_DIR; heavy jobs under the lock)
- `tsc --noEmit -p .` (8 GB heap): **passed**, exit 0.
- ESLint on the 79 .ts/.tsx files: **0 errors**, 6 `react-hooks/exhaustive-deps` warnings in `RosterScheduleOptimizer.tsx` (the same 6 as octoberBranch).
- CSS Modules pure-mode check on the 6 .module.scss files: **passed**.
- Focused Vitest (RSO, rosterScheduleData, yahoo, in-season, player-forecasts, projections, start-chart API, hooks): 140 files, all pass after the port edits.
- Full Vitest vs a pristine `3755308fa` export run back to back:
  - Master: 22 failed / 8209 passed / 11 skipped, 14 failed files.
  - Candidate: 14 failed / 8668 passed / 11 skipped, 10 failed files.
  - Every candidate failure also fails on master (cron inventory, migration ledger, vercel-ignore, native qualify script, file-level loads). Master's 8 extra failures are RSO planner/UI tests the port fixes.

## Behaviour changes TJ approves with the go
1. RSO serves interim FORGE daily projections when no issued forecasts or baselines are admitted (`RSO_FORGE_DAILY_BRIDGE=off` turns it off). Extra reads per RSO data request (public, `s-maxage=300`): `forge_runs`, `forge_player_projections`, `forge_goalie_projections`, `goalie_start_projections`, `wgo_skater_stats_totals`, `nhl_team_data`, `nst_team_stats`, `games`, `opponent_skater_allowed_by_position` (matview from migration `20261019211444`, already applied), plus daily-board evidence (IFTTT goalie news).
2. RSO UI: by-position lineup grid with optimize animation, bench days, candidate cards, lineup-goal toggle, injury flags, one navbar, plan-details tab.
3. Planner: injured-out (IR/IR-LT/IR-NR/O) players are not lined up and never auto-dropped; reserve moves only into open IR/IR+/NA slots; reserve-slot players are never drop options.
4. Yahoo goalie minimum parse (above).

No migrations, env changes or cron changes in this candidate. Start Chart, cms, functions untouched apart from the `liveDraft` note.

## Per-file blobs
| File | Blob | |
|---|---|---|
| `web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx` | 34ab5b6fcf | A |
| `web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx` | f1ef2858d5 | M |
| `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | 1115238ec1 | M (port edit) |
| `web/__tests__/pages/api/v1/roster-schedule-optimizer/diagnostic-context.test.ts` | bcd5db2792 | A |
| `web/__tests__/pages/api/v1/roster-schedule-optimizer/eligibility.test.ts` | c8defba569 | A |
| `web/components/RosterScheduleOptimizer/AcquisitionPeriodTimes.test.tsx` | 724a44dbab | A |
| `web/components/RosterScheduleOptimizer/AcquisitionPeriodTimes.tsx` | 98ff53eea5 | A |
| `web/components/RosterScheduleOptimizer/BenchDays.module.scss` | ceb9d01f68 | A |
| `web/components/RosterScheduleOptimizer/BenchDays.test.tsx` | 053627d975 | A |
| `web/components/RosterScheduleOptimizer/BenchDays.tsx` | bb0e3c0672 | A |
| `web/components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx` | 798a06d174 | A |
| `web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx` | fb0ab84061 | A |
| `web/components/RosterScheduleOptimizer/CandidateBrowser.tsx` | 07aced954b | M |
| `web/components/RosterScheduleOptimizer/CandidateCard.module.scss` | ef5157a1d5 | A |
| `web/components/RosterScheduleOptimizer/CandidateCard.test.tsx` | 19948aeb03 | A |
| `web/components/RosterScheduleOptimizer/CandidateCard.tsx` | c75ceb8644 | A |
| `web/components/RosterScheduleOptimizer/CategoryGains.tsx` | fa135d1a49 | M |
| `web/components/RosterScheduleOptimizer/CompactSchedule.tsx` | eb5a98a664 | M |
| `web/components/RosterScheduleOptimizer/InfoTooltip.module.scss` | 010a088ba5 | A |
| `web/components/RosterScheduleOptimizer/InfoTooltip.test.tsx` | 893ef1b553 | A |
| `web/components/RosterScheduleOptimizer/InfoTooltip.tsx` | 472492107b | A |
| `web/components/RosterScheduleOptimizer/OptimizeLineup.test.tsx` | c5f7df12ab | A |
| `web/components/RosterScheduleOptimizer/OptimizeLineup.tsx` | cbf18bb4c9 | A |
| `web/components/RosterScheduleOptimizer/RosterContribution.tsx` | 6e81e6ff29 | A |
| `web/components/RosterScheduleOptimizer/RosterPlayerRow.tsx` | d292cbd58d | A |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss` | cda608bb1a | M |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | 42db5a6394 | M (port edit) |
| `web/components/RosterScheduleOptimizer/SlotWeekGrid.module.scss` | 5ca9a2ecd9 | A |
| `web/components/RosterScheduleOptimizer/SlotWeekGrid.test.tsx` | 1ef985fdf5 | A |
| `web/components/RosterScheduleOptimizer/SlotWeekGrid.tsx` | 9980bab4d2 | A |
| `web/components/RosterScheduleOptimizer/TeamScheduleContext.module.scss` | 47201e6880 | A |
| `web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx` | 29060082d2 | A |
| `web/components/RosterScheduleOptimizer/TeamScheduleContext.tsx` | 8831c9abbb | A |
| `web/components/RosterScheduleOptimizer/canonicalSchedule.test.ts` | 3e066cf70d | A |
| `web/components/RosterScheduleOptimizer/canonicalSchedule.ts` | 3cb062f05d | A |
| `web/hooks/useCandidateMetrics.test.tsx` | 0abba76c3c | M |
| `web/hooks/useCandidateMetrics.ts` | e6a2bbc758 | M |
| `web/hooks/useYahooEligibility.test.tsx` | d8eb52eae4 | A |
| `web/hooks/useYahooEligibility.ts` | 9592c12dbb | A |
| `web/lib/in-season/workspaceSchema.test.ts` | 2aefb2caf6 | M (port edit) |
| `web/lib/in-season/workspaceSchema.ts` | 7eb8d79918 | M |
| `web/lib/integrations/yahoo/liveDraft.test.ts` | c3aac6488e | M |
| `web/lib/integrations/yahoo/liveDraft.ts` | d6aa60bfb7 | M |
| `web/lib/integrations/yahoo/rosterPlanning.test.ts` | c44003b4c9 | M |
| `web/lib/integrations/yahoo/rosterPlanning.ts` | fb96bed274 | M |
| `web/lib/rosterScheduleData/forgeDailyBridge.test.ts` | 2d9e5314d1 | A |
| `web/lib/rosterScheduleData/forgeDailyBridge.ts` | 4709996ffa | A |
| `web/lib/rosterScheduleData/normalize.ts` | a1bb78e19a | M |
| `web/lib/rosterScheduleData/planning.test.ts` | 807b144c97 | M (port edit) |
| `web/lib/rosterScheduleData/planning.ts` | 43c41f72a5 | M (port edit) |
| `web/lib/rosterScheduleData/types.ts` | 9f42b55254 | M |
| `web/lib/rosterScheduleOptimizer/benchDecisions.ts` | 7b0e4ef86f | M |
| `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts` | 09a7b2f1ed | A |
| `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts` | 6f3bc840c7 | A |
| `web/lib/rosterScheduleOptimizer/contributionLedger.test.ts` | fac47c34c2 | A |
| `web/lib/rosterScheduleOptimizer/contributionLedger.ts` | 3f46f39e44 | A |
| `web/lib/rosterScheduleOptimizer/dailyDecisionReplay.test.ts` | d279564c49 | A (port edit) |
| `web/lib/rosterScheduleOptimizer/diagnostic.test.ts` | f9e9df809c | A |
| `web/lib/rosterScheduleOptimizer/diagnostic.ts` | cceab12f35 | A |
| `web/lib/rosterScheduleOptimizer/lineupGaps.test.ts` | e7a15d53dd | A |
| `web/lib/rosterScheduleOptimizer/lineupGaps.ts` | 98801785a8 | A |
| `web/lib/rosterScheduleOptimizer/periodBoundaries.test.ts` | fa913b3182 | A |
| `web/lib/rosterScheduleOptimizer/periodBoundaries.ts` | 2d711664dc | A |
| `web/lib/rosterScheduleOptimizer/planning.test.ts` | e71fa68c01 | M |
| `web/lib/rosterScheduleOptimizer/planning.ts` | a45effabab | M |
| `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts` | 7b5b2794db | M |
| `web/lib/rosterScheduleOptimizer/planningTimeline.ts` | a5398a8c6f | M |
| `web/lib/rosterScheduleOptimizer/planningTypes.ts` | 6daaff1c13 | M (port edit) |
| `web/lib/rosterScheduleOptimizer/providerRules.test.ts` | 149eeb9825 | M |
| `web/lib/rosterScheduleOptimizer/providerRules.ts` | 8cba4db703 | M |
| `web/lib/rosterScheduleOptimizer/reconciliation.test.ts` | ab277ea73a | M |
| `web/lib/rosterScheduleOptimizer/reconciliation.ts` | dfbff3e1cc | M |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts` | 940ddc9341 | A |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.ts` | 39d6fd786d | A |
| `web/lib/rosterScheduleOptimizer/workspace.test.ts` | 86c0e39705 | M |
| `web/lib/rosterScheduleOptimizer/workspace.ts` | 9ceb2c397e | M |
| `web/lib/rosterScheduleOptimizer/yahooEligibility.ts` | 14bc0a332e | A |
| `web/lib/rosterScheduleOptimizer/yahooEligibilityCache.test.ts` | 397e1265b4 | A |
| `web/lib/rosterScheduleOptimizer/yahooEligibilityCache.ts` | 1a20763f3b | A |
| `web/pages/api/v1/roster-schedule-optimizer/data.ts` | dd2c0cf811 | M (port edit) |
| `web/pages/api/v1/roster-schedule-optimizer/diagnostic-context.ts` | 8766632635 | A |
| `web/pages/api/v1/roster-schedule-optimizer/diagnostic.ts` | 79e733484f | A |
| `web/pages/api/v1/roster-schedule-optimizer/eligibility.ts` | d84ac03d58 | A |
| `web/pages/api/v1/roster-schedule-optimizer/provider.ts` | e0627a3433 | M |
| `web/pages/api/v1/roster-schedule-optimizer/workspace.ts` | e643d024fc | M |
