## Relevant Files

- `tasks/TASKS/nhl-game-prediction-model/tasks-prd-nhl-game-prediction-roster-sos-model.md` - Living task list and decision log for the roster, SoS, decay, and game-prediction model work.
- `web/lib/game-predictions/featureBuilder.ts` - Builds game-level feature payloads; extend with roster-adjusted player impact, opponent-adjusted team form, and strength-of-schedule inputs.
- `web/lib/game-predictions/featureBuilder.test.ts` - Regression coverage for new feature construction, as-of filtering, decay, and fallback behavior.
- `web/lib/game-predictions/rosterImpact.ts` - TOI-weighted projected-line/current-roster player-impact aggregation with coverage and fallback metadata.
- `web/lib/game-predictions/rosterImpact.test.ts` - Deterministic coverage for weighting, strict as-of filtering, and current-roster fallback behavior.
- `web/lib/game-predictions/baselineModel.ts` - Defines baseline feature vectors, logistic model training, prediction output, and feature-signal analysis.
- `web/lib/game-predictions/baselineModel.test.ts` - Unit tests for feature-vector changes, weighting/shrinkage helpers, and model output metadata.
- `web/lib/xg/binaryLogistic.ts` - Shared logistic trainer with backward-compatible positive sample-weight support.
- `web/lib/xg/binaryLogistic.test.ts` - Regression proving weighted gradients affect fitted probability while unweighted behavior stays intact.
- `web/lib/game-predictions/accountability.ts` - Walk-forward backtests, ablations, baseline comparisons, and feature-signal analysis.
- `web/lib/game-predictions/accountability.test.ts` - Deterministic tests for new ablation variants, blend behavior, and feature-analysis summaries.
- `web/lib/game-predictions/featureSources.ts` - Feature-set version and source registry for new roster, player-rating, and SoS sources.
- `web/lib/game-predictions/workflow.ts` - Production scoring workflow that must consume any promoted feature-set/model version.
- `web/lib/predictions/contracts.ts` - Shared prediction metadata/source-freshness contract now embedded in feature snapshot provenance.
- `web/lib/predictions/sourceProvenance.ts` - Game-prediction source-provenance rows written during pregame generation.
- `web/pages/api/v1/game-predictions/backtest-ablation.ts` - Dry-run comparison endpoint for roster, SoS, decay, and blend variants.
- `web/pages/api/v1/game-predictions/feature-signal-analysis.ts` - Dry-run endpoint for statistical relationship analysis between features and game outcomes.
- `web/lib/ratings/playerImpactRatings.ts` - Builds TOI-shrunk skater offense, skater defense, and goalie impact ratings from game-log source rows.
- `web/lib/ratings/playerImpactRatings.test.ts` - Unit coverage for player-impact rating ranking, sample shrinkage, and snapshot-date selection.
- `web/pages/api/v1/db/update-player-impact-ratings.ts` - Admin update endpoint that dry-runs or backfills daily player impact ratings into the rating contract tables.
- `web/sql/ratings/001_create_analytics_rating_contracts.sql` - Existing first-class skater offense, skater defense, goalie, and team rating tables that may support roster-impact features.
- `web/pages/api/v1/db/update-team-sos.ts` - Existing strength-of-schedule ingestion path to reuse or extend for opponent-adjusted form.
- `web/pages/api/v1/trends/team-sos.ts` - Existing SoS read/API logic that can inform feature reads.
- `web/lib/splits/splitsServer.ts` - Existing roster and TOI aggregation logic that may provide roster composition and usage references.
- `web/pages/api/v1/db/update-sko-stats.ts` - Existing skater stats ingestion with per60/TOI fields that can feed player impact ratings.
- `web/pages/api/v1/db/update-wgo-totals.ts` - Existing WGO ingestion with skater and goalie totals/rate fields that can feed player impact ratings.

### Notes

- This task list treats the current conversation as the source PRD.
- Use per60 stats for player rates, but apply TOI/sample-size shrinkage so small-sample players do not dominate roster impact.
- Apply recency decay both to player priors and multi-season model training examples.
- Keep new modeling work behind dry-run ablations until it beats v4 and the simple goal-differential baseline on accuracy, Brier, and log loss.
- Current benchmark set from the 2026-01-01 through 2026-03-08 replay window:
  - v4 default: `203/369`, accuracy `0.550136`, Brier `0.246517`, log loss `0.686185`, rolling25 `0.68`, rolling50 `0.62`.
  - Goal differential baseline: `230/369`, accuracy `0.623306`, Brier `0.240157`, log loss `0.673927`.
  - Standings point percentage baseline: `214/369`, accuracy `0.579946`, Brier `0.246025`, log loss `0.685777`.
  - Signal selected: `201/369`, accuracy `0.544715`, Brier `0.246202`, log loss `0.685463`.
  - Signal selected strict: `197/369`, accuracy `0.533875`, Brier `0.247336`, log loss `0.687744`.
- Promotion gates for any new model variant:
  - Must beat v4 default on probability quality: lower Brier score and lower log loss.
  - Must beat v4 default on winner selection or provide a deliberate probability-only rationale; target at least `203/369` correct before review.
  - Should improve rolling25 and rolling50 accuracy, not only cumulative accuracy.
  - Must be compared against the goal-differential baseline; a variant that still trails goal differential should be treated as an intermediate model or blended/anchored candidate, not final promotion.
  - Must preserve calibration-bucket sanity; large overconfidence in sparse high-confidence buckets blocks promotion.
- Winner-selection policy decision: use Option C. Keep probabilities unchanged, keep the selected-threshold winner explicit, and also report the default 50% winner so threshold effects are auditable instead of hidden inside the model.
- Data inventory findings from local schema and live counts:
  - `skater_offensive_ratings_daily`, `skater_defensive_ratings_daily`, and `goalie_ratings_daily` have the right columns for player priors (`rating_raw`, `rating_0_to_100`, `sample_games`, `sample_toi_seconds`, `components`, `provenance`, `metadata`) but currently have `0` rows for `20252026`.
  - `rosters` has `1146` rows for `20252026`, but only `2` non-current/ended rows; current consumers mostly filter `is_current = true`, so it is reliable for current roster state but not yet a full historical roster-by-date source.
  - `sos_standings` has `6592` rows for `20252026` and includes `game_date`, team record fields, past opponent totals, future opponent totals, and opponent JSON payloads.
  - Historical lineup source tables have limited prospective coverage after `2025-10-01`: `lines_nhl = 30`, `lines_dfo = 14`, `lines_gdl = 42`, `lines_ccc = 161`.
  - Existing game-prediction features already use strict `< sourceAsOfDate` reads for team power, standings, WGO team stats, NST team logs, and goalie performance. SoS and roster-prior reads should follow the same rule.
- Player-impact rating backfill completed for `20252026` from `2025-10-07` through `2026-03-08` using `update-player-impact-ratings` with `dryRun=false`:
  - `skater_offensive_ratings_daily`: `100762` rows, first snapshot `2025-10-07`, last snapshot `2026-03-08`.
  - `skater_defensive_ratings_daily`: `100762` rows, first snapshot `2025-10-07`, last snapshot `2026-03-08`.
  - `goalie_ratings_daily`: `10156` rows, first snapshot `2025-10-07`, last snapshot `2026-03-08`.
- First player-impact rating versions are `skater_impact_v1_game_log_toi_shrunk` and `goalie_impact_v1_game_log_toi_shrunk`. They are current-season, game-log aggregated, z-score based ratings with TOI shrinkage; multi-season recency decay remains open.
- Player-prior season decay is implemented as `player_impact_season_decay_v1_current_1_prev_0_65_prev2_0_35_prev3_0_2`, combining player rating rows by `rating_raw`, weighting the target season at `1.0`, one season back at `0.65`, two seasons back at `0.35`, and three seasons back at `0.20`, then reranking the decayed prior within the target snapshot.
- Player-impact rating tests now cover TOI shrinkage, season decay, empty-source fallback, zero-TOI filtering, and no-usable-season decay fallback.
- Prior-season player-rating anchors for multi-season priors are now available:
  - `20222023`: full available source coverage from `2023-01-01` through `2023-04-14` with `61136` skater offense rows, `61136` skater defense rows, and `6603` goalie rows.
  - `20232024`: partial daily rows plus final anchor through `2024-04-18` with `46368` skater offense rows, `45591` skater defense rows, and `4507` goalie rows.
  - `20242025`: final anchor snapshot on `2025-04-17` with `1042` skater offense rows, `1042` skater defense rows, and `103` goalie rows.
  - Full daily prior-season backfills are not required for the first recency-decay player-prior pass; use prior-season final anchors for early-season priors unless later ablations show daily historical snapshots matter.
- Roster-history decision for first roster-prior ablation: do not build a true roster-history backfill yet. Use projected line-source rows when available, then current `rosters` as the fallback roster state. Revisit roster history only if coverage gaps or ablation results show this is blocking model quality.
- Latest prerequisite coverage verification:
  - `rosters`: `1146` rows for `20252026`, `1144` current rows.
  - `lines_nhl`: `30` rows since `2025-10-01`, snapshots `2026-04-22` through `2026-04-22`.
  - `lines_dfo`: `14` rows since `2025-10-01`, snapshots `2026-04-22` through `2026-04-23`.
  - `lines_gdl`: `42` rows since `2025-10-01`, snapshots `2026-04-22` through `2026-04-23`.
  - `lines_ccc`: `162` rows since `2025-10-01`, snapshots `2026-04-25` through `2026-04-30`.
  - `sos_standings`: `6592` rows for `20252026`, `2025-10-07` through `2026-04-30`.
- Current feature-context implementation adds CTPI, past-opponent team-power schedule strength, FORGE team projection deltas, goalie workload/rest context, and source-provenance rows with deterministic tests. Promotion/backtest tasks remain open until the versioned model beats the recorded gates.

## Tasks

- [x] 1.0 Lock the modeling contract and evaluation gates
  - [x] 1.1 Record the current benchmark set: v4 default, goal differential baseline, standings point percentage baseline, and latest signal-selected ablations.
  - [x] 1.2 Define promotion criteria for new variants across accuracy, rolling accuracy, Brier score, log loss, and calibration buckets.
  - [x] 1.3 Decide whether winner selection should continue using the 52% home threshold or be tuned separately from probability calibration.
  - [x] 1.4 Add model metadata fields for roster-impact, SoS, season-decay, and blend versions so future backtest outputs remain auditable.

- [x] 2.0 Inventory and validate reusable player, roster, TOI, and SoS data
  - [x] 2.1 Confirm which existing tables provide skater per60 offense/defense inputs, goalie rate inputs, TOI, team assignment, and game-date availability.
  - [x] 2.2 Confirm whether existing `rosters` data is sufficient for historical roster composition by date or only current roster state.
  - [x] 2.3 Identify the best source for expected lineup/active roster on a prediction date, including fallback behavior when lineup data is missing.
  - [x] 2.4 Validate that `sos_standings` or related SoS tables can be read strictly as-of the prediction date without target-game leakage.
  - [x] 2.5 Document any missing tables or backfill gaps before changing model features.

- [x] 3.0 Build player impact priors that survive roster movement. Current and prior-season anchor ratings, TOI shrinkage, season decay, and deterministic fallback coverage are complete (2026-07-12).
  - [x] 3.1 Define skater offensive impact from per60 scoring, shot, xG, and on-ice creation metrics using existing data where available.
  - [x] 3.2 Define skater defensive impact from xGA/shot suppression, defensive usage, PK context, and goals-against context where available.
  - [x] 3.3 Define goalie impact separately using GSAA/GSAx/save-rate/workload features, with current negative GSAA signal treated as a known risk.
  - [x] 3.4 Apply TOI/sample-size shrinkage to each per60 player impact rating.
  - [x] 3.5 Apply season recency decay to player priors, with current season weighted most heavily and prior seasons retained with lower weights.
  - [x] 3.6 Add deterministic tests for shrinkage, decay, and zero/missing-player fallback behavior.

- [x] 4.0 Aggregate player priors into roster-adjusted team features. Candidate immutable snapshots now include versioned projected-line/current-roster aggregates, TOI-weighted offense/defense/goalie impacts, special-team context, matchup deltas, and explicit coverage/fallback state; production vectors remain unchanged pending task-8 ablations (2026-07-12).
  - [x] 4.1 Build expected-roster aggregation for skater offense, skater defense, goalie impact, and special-teams context. Projected line-combination skaters are preferred, current rosters are the explicit fallback, goalie ratings remain separate, and team special rating supplies the available special-teams context (2026-07-12).
  - [x] 4.2 Weight skater impact by expected or historical TOI share instead of simple roster average. Latest strict-pregame rating rows are weighted by sampled TOI with deterministic equal-minimum fallback (2026-07-12).
  - [x] 4.3 Use confirmed/projected goalie starter when available, with fallback to goalie-start probability or roster goalie aggregate.
  - [x] 4.4 Emit matchup deltas such as `homeMinusAwayRosterOffImpact`, `homeMinusAwayRosterDefImpact`, and `homeMinusAwayRosterGoalieImpact`. All three are embedded in the candidate snapshot and covered by regression assertions (2026-07-12).
  - [x] 4.5 Add feature-source and warning metadata when roster or player-prior inputs are stale, incomplete, or fallback-derived. Snapshots record version/source/date/count/coverage/fallback fields, source cutoffs, missing/partial warnings, and truthful `forge_team_projection_proxy_v1` metadata for the still-active production proxy (2026-07-12).

- [x] 5.0 Add opponent-adjusted current team form and strength of schedule. Candidate snapshots now preserve raw and versioned adjusted last-5/last-10 goal-differential/xG-share values plus opponent-strength context; bounded ablations rejected promotion (2026-07-12).
  - [x] 5.1 Define season-to-date and recent-window opponent strength features using as-of SoS data.
  - [x] 5.2 Adjust goal differential and xG share form for opponent quality so weak-schedule runs do not inflate teams. Candidate version `sos_adjusted_form_v1_neutral50_goal_diff_div50_xgf_scale_0_05` applies transparent neutral-50 linear adjustments and remains excluded from production by default (2026-07-12).
  - [x] 5.3 Add recent opponent-strength deltas for last 5 and last 10 games. Per-team last-5/last-10 composites, within-team change, and home-away matchup deltas are emitted (2026-07-12).
  - [x] 5.4 Keep raw and adjusted team-form values available for feature-signal analysis and ablations. Both forms and their version metadata coexist in immutable candidate snapshots (2026-07-12).
  - [x] 5.5 Add tests for SoS as-of filtering and opponent-adjusted form calculations. Fixtures prove strict historical cutoffs, last-5/10 composites, formula arithmetic, and raw/adjusted preservation (2026-07-12).

- [x] 6.0 Implement time-dependent roster-prior versus current-form blend features. Candidate snapshots carry versioned per-team weights plus raw and time-weighted roster/current-form components; production vectors remain unchanged pending ablations (2026-07-12).
  - [x] 6.1 Calculate team games played as-of prediction date for both teams. Target-season standings are preferred with prior-game fallback, and the season-qualified regression prevents prior-season totals from contaminating the value (2026-07-12).
  - [x] 6.2 Define a granular blend curve, starting roster-prior heavy and moving toward current team form after 50 games. Version `roster_form_blend_v1_gp0_80_20_gp10_70_30_gp25_50_50_gp50_15_85_gp82_10_90` linearly interpolates between five explicit checkpoints (2026-07-12).
  - [x] 6.3 Use stronger current-form weighting after 50 games than the first-pass 80/20 suggestion, while retaining some roster prior as injury/transaction context. Current form is 85% at game 50 and 90% at the 82-game cap; roster context remains 15%/10% (2026-07-12).
  - [x] 6.4 Emit both the component features and blended matchup features so ablations can test model-learned versus hard-coded blends. Raw roster/current-form fields remain intact while candidate snapshots add per-team weights and separately time-weighted roster offense/defense/goalie plus recent goal-differential/xG-share matchup fields, avoiding an uncalibrated cross-scale sum (2026-07-12).
  - [x] 6.5 Add tests for blend checkpoints and boundary cases. Tests cover 0/10/25/50/82, interpolation at 37.5, cap behavior above 82, snapshot embedding, and weighted matchup arithmetic (2026-07-12).

- [x] 7.0 Expand training and backtesting beyond a single season. Multi-season inputs, weighted recency, the only available prior-to-target rolling holdout, phase-separated dry-run metrics, and segment-aware feature-signal reports are complete without persistence (2026-07-12).
  - [x] 7.1 Extend walk-forward/backtest inputs to support multi-season training windows without leaking future roster or team-form state. The backtest accepts explicit `trainingSeasonIds`, fetches completed games/outcomes for each unique season, combines them chronologically, and preserves blind-date/replay boundaries; persisted candidate metadata records the exact training seasons. Cross-season window tests prove prior seasons train while the target season remains blind (2026-07-12).
  - [x] 7.2 Add training-example recency weights or replicated-weight approximation if the current logistic trainer cannot consume sample weights directly. Added true positive sample weights to the shared logistic trainer and weighted normalization. Walk-forward examples use version `training_season_recency_v1_current_1_prev_0_65_prev2_0_35_prev3plus_0_2` consistently for initial and replay-added rows; the smoothed home prior uses the same weights and persistence records the version through model-audit metadata (2026-07-12).
  - [x] 7.3 Run rolling holdouts where each available season is evaluated as the blind season after training on prior seasons. Production inventory contains two completed regular seasons, yielding one valid roll: train 2024-25 and blind-test 2025-26. The corrected 12-game opening holdout ran in 18.647s with 5/12 correct, Brier `0.327071`, log loss `0.862579`, explicit training seasons, and `persisted=false` (2026-07-12).
  - [x] 7.4 Compare early-season, mid-season, and late-season performance separately because roster priors and team form should matter at different points. Like-sized early and middle windows scored 5/12 (`0.416667`, Brier `0.327071`, log loss `0.862579`) and 7/12 (`0.583333`, `0.268729`, `0.752719`); the available late horizon supplied 29 phase-qualified games at 10/29 (`0.344828`, `0.330593`, `0.876578`). All runs were dry-run/non-persisting (2026-07-12).
  - [x] 7.5 Report feature-signal analysis by season segment to catch unstable or inverted signals. Signal output now includes typed early/middle/late/playoff analyses with explicit empty segments. Read-only samples covered 12 early, 12 middle, and 29 late games and exposed instability including goalie-start uncertainty changing from negative early weight `-0.963132` to positive late `0.701629`; treat these small-sample signals as ablation diagnostics, not promotion evidence (2026-07-12).

- [x] 8.0 Compare model variants through dry-run ablations. Roster, time-weighted blend, SoS, combined, goal-differential anchor, standings anchor, and per60-only variants were compared without persistence; no candidate satisfied the promotion gates (2026-07-12).
  - [x] 8.1 Add ablation variants for roster-prior features only, SoS-adjusted team form only, and combined roster-plus-SoS features. Selectable default-excluded variants ran with truthful metadata and no persistence (2026-07-12).
  - [x] 8.2 Add blend variants anchored to goal differential and standings point percentage because current simple baselines beat v4. Auditable 50/50 probability anchors improved the bounded sample: goal differential remained 5/12 with Brier/log loss `0.307631/0.817641`; standings reached 6/12 and `0.291907/0.784130`. Evidence remains too small for promotion and was not persisted (2026-07-12).
  - [x] 8.3 Compare raw current-form features versus SoS-adjusted current-form features. On the bounded 12-game middle sample both were 5/12; adjusted form worsened Brier/log loss from `0.360292/0.958583` to `0.363779/0.965023`, so it is not promotable (2026-07-12).
  - [x] 8.4 Compare per60-only player priors versus TOI-shrunk player priors. Stored `components.shrinkage` reconstructs exact pre-shrink scores. Per60-only tied at 5/12 and slightly improved on TOI-shrunk (`0.380668/1.008579` vs. `0.381813/1.011246`) but both trailed v4 (`0.360292/0.958583`), so neither is promotable (2026-07-12).
  - [x] 8.5 Keep all variants dry-run until they beat v4 and the simple goal-differential baseline on the agreed promotion gates. All roster/blend/SoS comparisons used `persistEvidence=false`; none beat v4 probability quality, so no version or production change occurred (2026-07-12).

- [x] 9.0 Promote a new feature set and production model only after validation. Validation rejected every candidate; the promotion gate was enforced and production remains on the existing version (2026-07-12).
  - [x] 9.1 Bump `GAME_PREDICTION_FEATURE_SET_VERSION` only after the new features have deterministic tests and backtest evidence. No bump: deterministic tests pass but no candidate met quality gates (2026-07-12).
  - [x] 9.2 Bump `BASELINE_MODEL_VERSION` only for the selected promoted variant. No variant was selected, so the version correctly remains unchanged (2026-07-12).
  - [x] 9.3 Update production scoring metadata so public predictions expose the new feature sources and top factors clearly. Not applicable without a promoted variant; candidate audit metadata remains available only in dry-run evidence (2026-07-12).
  - [x] 9.4 Re-run persisted accountability backtest for the promoted version. Not applicable because promotion was rejected; all candidate evidence intentionally remained `persistEvidence=false` (2026-07-12).
  - [x] 9.5 Verify `/nhl-predictions` renders the promoted model and baseline comparisons without layout regressions. No public model changed, so existing rendering remains authoritative and no false promoted-model claim was introduced (2026-07-12).

- [x] 10.0 NEW: Populate prerequisite player-rating and roster-history data before roster-prior modeling. Current-season daily ratings and prior-season anchors are populated and verified; first-pass roster history intentionally uses projected line sources with current-roster fallback (2026-07-12).
  - [x] 10.1 Build or run the job that populates `skater_offensive_ratings_daily`, `skater_defensive_ratings_daily`, and `goalie_ratings_daily` for `20252026`.
  - [x] 10.2 Backfill prior seasons for the same player-rating tables if multi-season player priors are required for early-season predictions.
  - [x] 10.3 Decide whether `rosters` needs a true roster-history backfill or whether projected line-source tables plus current roster state are enough for first roster-prior ablations.
  - [x] 10.4 Verify counts and date coverage for player ratings, roster history, and line-source tables before task 4 consumes them.
  - [x] 10.5 NEW: Optimize the historical player-rating endpoint for incremental daily backfills before attempting full daily coverage for all prior seasons. Scope reconciled: full daily prior-season coverage is explicitly not required for the first recency-decay pass; final season anchors are sufficient. The existing endpoint already supports bounded one-day `snapshotDate` execution, explicit date ranges/limits, paginated 1,000-row reads, and 500-row writes, so no speculative rewrite is warranted unless later ablations prove daily historical snapshots add value (2026-07-12).

- [x] 11.0 NEW: Remove past-opponent strength leakage before building SoS-adjusted form. The schedule-strength builder now selects each opponent rating strictly before that historical game date instead of before the later prediction cutoff (2026-07-12).
  - [x] 11.1 Preserve later opponent-rating rows in the fixture and prove the historical selector chooses the earlier eligible snapshot for both teams (2026-07-12).

- [x] 12.0 NEW: Prevent cross-season standings leakage in season-phase and form features. Standings reads and in-memory selection are season-qualified, so opening-week games cannot inherit the prior season's final games-played total (2026-07-12).
  - [x] 12.1 Preserve prior-season final standings in a regression fixture and prove a target-season opener remains `early` with zero target-season games played (2026-07-12).
