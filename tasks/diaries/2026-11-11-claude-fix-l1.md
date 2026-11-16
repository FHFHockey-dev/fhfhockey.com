# 2026-11-11 · Claude fix lane L1 (event state, parity, PBP ingestion)

## Scope
Brief: tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L1.md (+ _COMMON.md). Chef: local_78a99adf.
Owned: web/lib/supabase/Upserts/nhl*.ts + nhlRawGamecenter.mjs (+ tests); web/pages/api/v1/db/update-stats/[gameId].ts (+ tests).
Decisions: 7, 8, 9, 11, 13, 24, 59, 70, 83 (placeholders → null), 84 (EN = opponent's empty net only).

## Where
Branch octoberBranch, sole checkout. Commits: cb28ffc58 (event layer, parity, writers), 3e6562f9a (update-stats placeholders -> null).
Notes: side-session-notes/<chef>/L1-helper-contract.md, L1-tickets-placeholders-null.md, L1-strength-v2-renormalization.md.
- 72e78b3d1: d.ts STRENGTH_VERSION 2 (granted by Chef), medium/low-danger labels. L4a told: exactly 3 skater columns nullable.
- Found: update-nhl-xg-shot-features.ts defaults strengthVersion=1 -> v2 games lose xG features (release hazard, ticketed).
Claim appended: CLAUDE-TO-CODEX.md `CLAUDE-FIX-L1-CLAIM-20261111` (Codex mailbox tail checked: no claim on L1 paths since 11-10).

## State / checkpoints
- 11-11: read brief, decisions, W2-2/W2-3/W2-7/BA W1-1/W1-2 sections.
- Baseline before edits: Upserts nhl* + update-stats-cron tests 21 files / 145 tests pass.
- Implemented (uncommitted): classifyTeamManpower (+ById, orientStrengthExact, toLegacyStrengthState,
  isPenaltyShotSituation, STRENGTH_CLASSIFIER_VERSION=2) in nhlStrengthState.ts; running-score timeline
  (buildRunningScoreTimeline/ByEventKey, getSideScoreDiff, matchesScoreState) in nhlScoreState.ts;
  parity rewired to both; penalty classes by type code; goalie distance sums/counts; NST_RUSH_OPTIONS (4 s,
  no faceoffs) for parity rush only; penalty-expiry boundaries; PDO adapter; PARITY_CHANCE_DEFINITIONS
  (house labels); miss reasons exact map (version 2); EN/penalty-shot in nhlEventInclusion; parser + .mjs
  writer: EN = opponent's empty net, SO goals not is_goal, STRENGTH_VERSION 2.
- Failing-first: new tests run against a HEAD copy of Upserts (scratch harness run-on-head.sh) -> all new
  tests fail on HEAD except two D8 guard cases (early PP goal, coincidental minors) which are guards against
  over-correction and pass on both.
- Updated tests that pinned defects: nhlStrengthState (0651/1560 EN), nhlPlayByPlayParser, nhlOnIceAttribution,
  nhlNormalizedLayer, nhlShotFeatureBuilder (own-net-empty is not EN; "short" miss reason), nhlMissReasons,
  nhlRawGamecenter (strength_version literal 1 -> STRENGTH_VERSION).

- Checks: Upserts + underlying-stats + xg + projections + db routes 171 files / 2,107 tests pass; lib/cron + update-stats 38/330;
  npm run typecheck exit 0; eslint on changed files exit 0. Contract checkpoint sent to Chef after cb28ffc58.

## Next
Chef closed L1 (verified cb28ffc58, 3e6562f9a; 72e78b3d1 sent after). Keep this diary until the debrief records it.
xG strengthVersion hazard closed by L14 in 60f1b3eb9 (default v2, 409 otherwise; decision 99). Nothing open in-lane.

## Blockers / approvals
- L4a migration committed: f066be4ce (20261111180900, pending, not applied; proof supabase/tests/l4a_game_stats_nullable.py).
- 3e6562f9a must not be released before that L4a migration is applied (skatersGameStats NOT NULL/defaults + persist_complete_game_stats_v1 checks).
- STRENGTH_VERSION 2 release => season re-normalization via fingerprint change: needs TJ approval as a bounded step.
- Tickets: types/nhlRawGamecenter.d.ts STRENGTH_VERSION 2; L14 feature semantics; L2 distance sums; L15/L9b/L8 null readers; UI HD/SC labels.

## Decisions taken (lane-local)
- Penalty advantage = on-ice skaters minus an extra attacker (goalie digit 0). 6v5 no penalty = ES; 6v4 = PP; 0551 = away PK.
- Shot-feature rush (10 s, xG model input) left unchanged; parity rush uses decision 8 via NST_RUSH_OPTIONS.
- HD/SC: no saved NST reference -> declared FHFH house definitions; display rename is UI owners' (ticket).
- STRENGTH_VERSION bump changes NORMALIZATION_PARSER_FINGERPRINT -> every normalized game reads stale; the
  normalization backfill selector would re-select the season after release. Production step, needs TJ approval.
- types/nhlRawGamecenter.d.ts (not owned) still declares STRENGTH_VERSION: 1 -> ticket.

## Insights / gotchas
- strength_exact is away-first ("{awaySkaters}v{homeSkaters}").
- Parity goalie accumulator already holds distance total/count internally but only emits the average.

- 2026-11-11 reopen (W2-2 D11, decision 9): parity off_zone_start_pct / off_zone_faceoff_pct now OZ ÷ (OZ + DZ), null when OZ + DZ = 0; neutral counts kept. Commit 765e6f71c. Fixture fails on HEAD (40 vs 66.7). Upserts 388/388; ESLint 0; typecheck exit 2 only from another lane's uncommitted rankings.test.tsx. Not touched: fetchRollingPlayerAverages.ts reads the stored pct (other lane).
