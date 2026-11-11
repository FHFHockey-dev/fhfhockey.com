# Audit packet: xG (part 2 of 2)

Master entries M-XG-061 to M-XG-070 (10 of 70 in this family).

Slim copy (Chef, 2026-11-11): boilerplate status lines, generic leads, tags and duplicate locations removed. Full packet: `../packets/xg-part2.md`. Leads are hypotheses; line numbers date from 2026-11-10, so re-locate by symbol.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-XG-061 | Goalie GSAx share module (NST xGA) | Opus only | 0 | 1 |
| M-XG-062 | xG explorer derived ratios | Opus only | 0 | 2 |
| M-XG-063 | Rolling-window xG aggregates (5/10/20 games) | Opus only | 0 | 4 |
| M-XG-064 | xG rich rebound heads (offline logistic) | Opus only | 0 | 1 |
| M-XG-065 | xG release validation: native NST-parity counts vs NST gamelogs | Opus only | 0 | 1 |
| M-XG-066 | xG approval-grade eligibility gates | Opus only | 0 | 1 |
| M-XG-067 | Strength segments and TOI-by-split accumulation | Opus only | 0 | 2 |
| M-XG-068 | NST parity comparison tolerances | Opus only | 0 | 2 |
| M-XG-069 | Tracking-alignment audit | Opus only | 0 | 1 |
| M-XG-070 | Approval-grade eligibility gates | Opus only | 0 | 3 |

## M-XG-061 Goalie GSAx share module (NST xGA)

- **Match:** Opus only; Opus XG-036; Codex —
- **Purpose:** Window GSAx for social share cards from NST goalie game logs.
- **Where:** `web/lib/socialShare/modules/goalieGsax.ts:33 (toiSeconds = toi*60)`; `web/lib/socialShare/modules/goalieGsax.ts:113 (gsax)`; `web/lib/socialShare/modules/goalieGsax.ts:123 (competitionRanks)`
- **Opus view (XG-036):**
  - Method: Admitted if appearances >= minAppearances, covered>0 and coverage% >= minCoverage; GSAx = sum xGA - sum GA (rounded to cents); per-60 magnitude = \|GSAx\|*3600/TOI signed; competition ranks best/worst.
  - Inputs/units: minutes TOI converted to seconds; sources: nst goalie game rows (NST_GSAX_COLUMNS)
  - Output scale: goals; per-60; writes: —
  - Status: live — social share modules
  - Consumers: social share card
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/goalieGsax.ts:14 comment: GSAx is xg_against - goals_against, never NST gsaa
  - External references: MoneyPuck/EH GSAx
  - Tests: `web/lib/socialShare/modules/goalieGsax.test.ts`
- **Leads (not audited):**
  - (opus) uses NST xGA, not FHFH model xG

## M-XG-062 xG explorer derived ratios

- **Match:** Opus only; Opus XG-047; Codex —
- **Purpose:** Leaderboard rows mixing rolling xG with created/transition/rebound metrics.
- **Where:** `web/lib/underlying-stats/xgExplorer.ts:249 (xgPct)`; `web/lib/underlying-stats/xgExplorer.ts:254 (ratio)`; `web/lib/underlying-stats/xgExplorer.ts:335 (buildPlayerXgExplorerRows)`; `web/lib/underlying-stats/xgExplorer.ts:402 (buildTeamXgExplorerRows)`; `web/lib/underlying-stats/xgExplorer.ts:450 (buildGoalieXgExplorerRows)`
- **Opus view (XG-047):**
  - Method: xGF% = xGF/(xGF+xGA) (fraction 0-1); latest rolling row per entity for chosen window; transition & rebound metrics summed over all fetched game rows; sort by created xG, xGF%, GSAx.
  - Inputs/units: xG goals; sources: nhl_xg_*_rolling_aggregates, nhl_xg_transition_game_aggregates, nhl_xg_rebound_control_*_game_aggregates, nhl_xg_player_created_xg_rolling_aggregates
  - Output scale: fraction 0-1; xG goals; writes: —
  - Status: live — /api/v1/underlying-stats/xg
  - Consumers: web/pages/api/v1/underlying-stats/xg.ts; /underlying-stats/xg page
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST xGF%
  - Tests: `web/__tests__/pages/underlying-stats/xg/index.test.tsx`; `web/lib/underlying-stats/xgExplorer.test.ts`
- **Leads (not audited):**
  - (opus) window mismatch: xG fields are trailing-N-game rolling, while transition/rebound fields are sums over whatever game rows were fetched
  - (opus) xGF% here is 0-1 while NST-parity xgf_pct is 0-100

## M-XG-063 Rolling-window xG aggregates (5/10/20 games)

- **Match:** Opus only; Opus XG-048; Codex —
- **Purpose:** Trailing-N-game sums of xG and goals by team, player and goalie.
- **Where:** `web/lib/xg/aggregates.ts:271 (DEFAULT_ROLLING_WINDOWS)`; `web/lib/xg/aggregates.ts:463 (buildRollingTeamRows)`; `web/lib/xg/aggregates.ts:515 (buildRollingPlayerRows)`; `web/lib/xg/aggregates.ts:564 (buildRollingGoalieRows)`
- **Opus view (XG-048):**
  - Method: Sort an entity's games by date; for each game and window W in {5,10,20}: sum of last min(W, available) games (games_count recorded). Sums only, no per-60.
  - Inputs/units: xG goals; sources: nhl_xg_*_game_aggregates (in-memory)
  - Output scale: sums over N games; writes: nhl_xg_team_rolling_aggregates, nhl_xg_player_rolling_aggregates, nhl_xg_goalie_rolling_aggregates
  - Status: live — admin/cron route web/pages/api/v1/db/update-nhl-xg-aggregates.ts; read by MetricsTimeline, homepageGameAnalytics, FORGE team-context-queries, /underlying-stats/xg
  - Consumers: web/lib/projections/queries/team-context-queries.ts:204 (FORGE xgfPerGame = xg_for/games_count); web/pages/api/v1/underlying-stats/xg.ts; run-forge-projections.ts:415
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST last-N rolling; EH rolling xGF
  - Tests: `web/lib/xg/aggregates.test.ts`
- **Leads (not audited):**
  - (opus) entities grouped only by id — rows from different model_version/feature_version/season passed together would mix in one window
  - (opus) windows cross season boundaries if multi-season input
  - (opus) partial windows (games_count<W) not flagged except by games_count
  - (opus) totals not TOI-normalized

## M-XG-064 xG rich rebound heads (offline logistic)

- **Match:** Opus only; Opus XG-052; Codex —
- **Purpose:** Train conditional rebound-danger, goalie-freeze and second-chance-xG binary heads
- **Where:** `web/scripts/train-nhl-xg-rebound-heads-offline.ts:113 (labelForHead)`; `web/scripts/train-nhl-xg-rebound-heads-offline.ts:121 (auc)`; `web/scripts/train-nhl-xg-rebound-heads-offline.ts:140 (metrics)`; `web/scripts/train-nhl-xg-rebound-heads-offline.ts:167 (trainHead)`
- **Opus view (XG-052):**
  - Method: logistic_l2 iters 500 lr 0.05 l2 0.01; base rate = train positive rate; metrics Brier, log loss (clip 1e-9), rank-based AUC with tie-averaged ranks (Mann-Whitney); gate: rows>=100, positives>=10, Brier & LL beat base rate, AUC>=0.5 on validation and test; promotionAuthorized always false
  - Inputs/units: encoded feature vectors; binary labels; sources: nhl_api_pbp_events, nhl_shot_features (feature_payload rows)
  - Output scale: probability 0-1; AUC 0-1; writes: scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json
  - Status: draft — offline, promotionAuthorized hard-coded false
  - Consumers: offline research only
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (output field promotionAuthorized:false)
  - External references: Mann-Whitney AUC; logistic regression
  - Fixtures/test data: `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
  - Tests: `web/lib/xg/binaryLogistic.test.ts`
- **Leads (not audited):**
  - (opus) default artifact/reference paths hard-coded to specific 2025-26 run directories

## M-XG-065 xG release validation: native NST-parity counts vs NST gamelogs

- **Match:** Opus only; Opus XG-053; Codex —
- **Purpose:** Compare native PBP-derived skater/goalie count families with NST game logs before an xG release
- **Where:** `web/scripts/run-nhl-xg-release-validation.ts:443 (main)`; `web/scripts/run-nhl-xg-release-validation.ts:47 (SKATER_COUNT_KEYS)`; `web/scripts/run-nhl-xg-release-validation.ts:91 (GOALIE_COUNT_KEYS)`
- **Opus view (XG-053):**
  - Method: audit re-derivation: per fixed training/overlap game IDs, build native counts and diff against NST per player per key; PASS requires zero raw-validation failed games and zero blocking parity failures (summarizeParityReleaseDisposition in lib)
  - Inputs/units: per-game counts; sources: nst_gamelog_as_counts, nst_gamelog_as_counts_oi, nst_gamelog_goalie_all_counts, nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: PASS/FAIL; writes: —
  - Status: live — manual release gate script
  - Consumers: xG release decision
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in script header (help text only)
  - External references: Natural Stat Trick counts
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Leads (not audited):**
  - (opus) default game ID lists are hard-coded constants

## M-XG-066 xG approval-grade eligibility gates

- **Match:** Opus only; Opus XG-054; Codex —
- **Purpose:** Decide whether an xG artifact may be promoted
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:364 (buildReboundCreationApprovalBlockingReasons)`; `web/scripts/train-nhl-xg-baseline.ts:472 (buildApprovalGradeEligibility)`; `web/scripts/benchmark-nhl-xg-baselines.ts:115 (getApprovalGradeBlockingReasons)`; `web/scripts/benchmark-nhl-xg-baselines.ts:169 (detectBenchmarkWarnings)`
- **Opus view (XG-054):**
  - Method: goal model: test goals>=10, holdout goals>=10, holdout avg prediction in (0.001,0.999), no forbidden post-event features, coverage blocking reasons; rebound_creation: validation/test examples>=1000, positives>=100 each, holdout positives>=250, \|val rate - test rate\|<=0.025, \|holdout avgPred - rate\|<=0.025, holdout LL and Brier must beat base-rate; benchmark warns if feature 'shotEventType:goal' present (label leakage)
  - Inputs/units: counts, probabilities; sources: —
  - Output scale: eligible boolean + reasons; writes: model-artifact.json
  - Status: live — gates artifact approval
  - Consumers: benchmark-nhl-xg-baselines.ts; xG promotion
- **Audit context:**
  - Intent (Opus): blocking reason messages web/scripts/train-nhl-xg-baseline.ts:364-575; constants :331-343
  - Fixtures/test data: `web/scripts/output/xg-*/**/model-artifact.json (approvalGradeEligibility)`
  - Tests: `web/lib/xg/featureCoverage.test.ts`; `web/scripts/benchmark-nhl-xg-baselines.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) goal-model gate needs only 10 test goals, far looser than rebound gate (100/250)

## M-XG-067 Strength segments and TOI-by-split accumulation

- **Match:** Opus only; Opus XG-061; Codex —
- **Purpose:** Allocate skater/goalie TOI to strength and score splits.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:588 (buildStrengthSegments)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:654 (resolveTeamRelativeSituation)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:688 (matchesRelativeStrengthSplit)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:906 (accumulateToiBySplit)`
- **Opus view (XG-061):**
  - Method: Segment = [event second, next event second) in the same period, with that event's situation code and score; TOI = overlap of each shift interval with segments matching the split.
  - Inputs/units: seconds; sources: nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: seconds; writes: —
  - Status: live — via NST-parity builder
  - Consumers: per-60 denominators in NST-parity
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST TOI by situation
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Leads (not audited):**
  - (opus) strength changes between events (e.g., penalty expiry) are attributed late until the next event
  - (opus) segments use event home/away score fields which are often only on goal events

## M-XG-068 NST parity comparison tolerances

- **Match:** Opus only; Opus XG-062; Codex —
- **Purpose:** Compare in-house NST-style metrics to stored NST rows with per-metric tolerances.
- **Where:** `web/lib/supabase/Upserts/nhlXgValidation.ts:125 (tolerance constants)`; `web/lib/supabase/Upserts/nhlXgValidation.ts:138 (APPROXIMATE_METRICS)`; `web/lib/supabase/Upserts/nhlXgValidation.ts:281 (getToleranceForMetric)`; `web/lib/supabase/Upserts/nhlXgValidation.ts:446 (compareLegacyAndNhlParitySample)`; `web/lib/supabase/Ups … (full text in the original packet)
- **Opus view (XG-062):**
  - Method: exact metrics tol 1e-6; approximate: *_pct/pdo/ipp 0.02, *_per_60/gaa/avg_* 0.25, xg* 0.15, counts 1. xG, scoring-chance, danger, rush, rebound metrics classed approximate.
  - Inputs/units: mixed (percent 0-100, per-60, counts); sources: nst_gamelog_* tables
  - Output scale: pass/fail; writes: —
  - Status: live (validation) — run manually via web/scripts/run-nhl-xg-release-validation.ts
  - Consumers: web/scripts/run-nhl-xg-release-validation.ts
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md, xg-release-validation-output-contract-2026-03-31.md)
  - External references: NST definitions
  - Tests: `web/lib/supabase/Upserts/nhlXgValidation.test.ts`
- **Leads (not audited):**
  - (opus) percent tolerance 0.02 on a 0-100 scale is near-exact while counts get +/-1
  - (opus) xG tolerance 0.15 absolute regardless of magnitude

## M-XG-069 Tracking-alignment audit

- **Match:** Opus only; Opus XG-068; Codex —
- **Purpose:** Coverage ratios for tracking frames before any tracking-based training.
- **Where:** `web/lib/xg/trackingAlignment.ts:27 (auditXgTrackingAlignment)`
- **Opus view (XG-068):**
  - Method: playerIdentityCoverage = identified player objects / player objects (issue if <0.95); puckEventCoverage = events with puck / events (issue if <1); out-of-rink if \|x\|>110 or \|y\|>50; goal-only coverage blocks training.
  - Inputs/units: feet; sources: —
  - Output scale: ratios 0-1; writes: —
  - Status: legacy/dead — no non-test callers found by rg
  - Consumers: none found (no non-test callers)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Tests: `web/lib/xg/trackingAlignment.test.ts`
- **Leads (not audited):**
  - (opus) no callers outside tests

## M-XG-070 Approval-grade eligibility gates

- **Match:** Opus only; Opus XG-069; Codex —
- **Purpose:** Decide whether a trained artifact may be used to score production predictions.
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:333 (MIN_* constants)`; `web/scripts/train-nhl-xg-baseline.ts:364 (buildReboundCreationApprovalBlockingReasons)`; `web/scripts/train-nhl-xg-baseline.ts:472 (buildApprovalGradeEligibility)`; `web/scripts/train-nhl-xg-baseline.ts:242 (assertNoLeakedBaselineArtifactFeatures)`; `web/scripts/b … (full text in the original packet)
- **Opus view (XG-069):**
  - Method: Block if: no test split; test goals <10; holdout goals <10; mean prediction <=0.001 or >=0.999; calibration adoptability reasons; required post-calibration with no adoptable method; feature coverage blocking reasons; forbidden features present. Rebound-creation: >=1000 val/test rows, >=100 positives each, >=250 holdout positives, \|val-test rate\| <=0.025, \|holdout mean pred - rate\| <=0.025, log loss and Brier must beat base-rate baselines.
  - Inputs/units: counts, probabilities; sources: —
  - Output scale: boolean + reasons; writes: model-artifact.json
  - Status: live (offline) — run manually via `tsx web/scripts/train-nhl-xg-baseline.ts`; produced artifacts consumed by update-nhl-xg-shot-predictions via artifact path env
  - Consumers: update-nhl-xg-shot-predictions (refuses unapproved unless allowUnapproved=true); model registry
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (tasks/artifacts/xg-release-gate-verdict-2026-03-30.md, xg-harness-enforcement-2026-03-31.md)
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`; `web/scripts/output/xg-approval-run-20260522/`
  - Tests: `web/scripts/benchmark-nhl-xg-baselines.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) shot_goal gate does NOT require beating the null-model log loss/Brier (rebound gate does)
  - (opus) 10-goal minimums are very low for xG
  - (opus) approved run cfg9bac2706 passed despite missReasonBucket leakage (caught later)

