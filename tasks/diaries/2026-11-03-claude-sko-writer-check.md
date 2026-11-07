# 2026-11-03 Claude — sKO writer lead check

## Scope
Verify three leads in still-scheduled sKO writers; fix only what holds up. No writer runs, no schedule changes.

## Where
- Branch `octoberBranch`. Targets clean at start (update-predictions-sko.ts, dataFetching.ts, update-sko-stats.ts, ml tests).

## Findings so far
1. CONFIRMED `web/pages/api/v1/ml/update-predictions-sko.ts:319` — `avg5 || avg10 || avg20` replaces a real 0 average with a longer window. Model = 0.6*avg10 + 0.4*avg5 times horizon; no training/backtest.
2. CONFIRMED in code, no live path: `sko_skater_stats` has no `*_goals_against` columns (generated types; writer projection `SKO_SKATER_STATS_COLUMNS`), so `dataFetching.ts:125-127` always yields 0 and `calculations.ts` GA term is 0. But dataFetching/calculations have zero importers; `update-sko-stats.ts` computes no GameScore.
3. CONFIRMED in code, no live path: `statistics.ts` computeStatSummaries/computeCharacteristicResults score each game against whole-sample mean/sd (future games included). Zero importers.
- Readers: predictions_sko → get-predictions-sko.ts → useQuarantinedPredictionsSko / PredictionsLeaderboard (no page mounts them). No views join either table.
- predictions_sko PK includes model_version (history-preserving) → formula fix raises the version question.

## Decisions (TJ pop-up)
- Bump predictions model to v0.3; fix leads 2-3 with tests anyway; one read-only SELECT allowed.

## Changes
- update-predictions-sko.ts: blend = 0.6*avg10 + 0.4*avg5, MODEL_VERSION v0.3, export buildPredictionRecord; predictionsSkoRunControl.ts run key v0.3.
- dataFetching.ts: GA from wgo_skater_stats; types.ts comment. statistics.ts: as-of (prior-games) baseline, first game "Insufficient History".
- Tests: update-predictions-sko.test.ts (+1, v0.3), new lib/supabase/utils/legacySko.test.ts. 52/52 in ml+predictions+utils suites.

## SELECT evidence (one read-only query)
- 2026-11-03 v0.2 h5: 743 players; 188 scoreless last 5; stored ppg avg 0.077 vs corrected 0.041. Stored = avg10 (or avg20 when avg10 = 0) exactly. Job ran today.

## Gotchas
- computeEmpiricalThresholds still pools the whole sample (no callers); noted, not changed.

## State (done)
- Commit 168be2cb6 on octoberBranch (7 files, explicit pathspecs). Not pushed or deployed: production cron keeps writing v0.2 rows until a release.
- Tests: 52/52 passed (lib/predictions, lib/ml, __tests__/pages/api/v1/ml, lib/supabase/utils). `npm run typecheck` EXIT=2, all errors in other lanes (BLSH currentProcessEvidence.server*, WigoComparisonMatrix, retainedBlsh.test, plus StatsTableRowChart.tsx:104 from WiGO commit 2f8336b2e).
- Recommendation (needs TJ approval): pause both pg_cron jobs. Neither table has a mounted user-facing reader; sko_skater_stats is not read by the predictions job (it uses player_stats_unified).
