## Relevant Files

- `migrations/20260522_create_nhl_xg_shot_feature_tables.sql` - Defines the persisted xG feature and prediction tables that need backfill, QA, and aggregate consumers.
- `web/pages/api/v1/db/update-nhl-xg-shot-features.ts` - Endpoint for generating and upserting persisted shot-feature rows.
- `web/pages/api/v1/db/update-nhl-xg-shot-predictions.ts` - Endpoint for scoring persisted shot features with approved model artifacts.
- `web/lib/xg/shotFeaturePersistence.ts` - Shared xG feature/prediction persistence, artifact loading, and probability scoring helpers.
- `web/lib/xg/shotFeaturePersistence.test.ts` - Regression tests for persisted prediction row shaping and calibrated probability behavior.
- `web/lib/xg/backfillCoverageAudit.ts` - Shared xG backfill coverage audit helper for feature, prediction, and upstream normalized-data checks.
- `web/pages/api/v1/db/audit-nhl-xg-backfill.ts` - Admin endpoint that reports xG feature/prediction backfill coverage by season, game type, version, and model.
- `web/scripts/train-nhl-xg-baseline.ts` - Current shot-goal xG training path and likely starting point for rebound-creation model training.
- `web/scripts/train-nhl-xg-baseline.test.ts` - Existing training-path tests to extend when adding rebound targets or approval gates.
- `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts` - Source of derived shot features, rebound flags, rush flags, and contextual shot rows.
- `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts` - Tests for shot-feature derivation and future shot-assist/transition feature behavior.
- `web/lib/supabase/Upserts/nhlRebounds.ts` - Existing rebound-detection logic to extend for rebound-creation labels and richer rebound-control metrics.
- `web/lib/supabase/Upserts/nhlRebounds.test.ts` - Tests for rebound detection and future rebound-creation target rules.
- `web/lib/supabase/Upserts/nhlPossessionChains.ts` - Possession-chain foundation for shot-assist, created-xG, transition, and rebound-creation attribution.
- `web/lib/supabase/Upserts/nhlPossessionChains.test.ts` - Tests for possession-chain ownership and control-change behavior.
- `web/lib/supabase/Upserts/nhlRush.ts` - Existing rush detection and transition-adjacent feature logic.
- `web/lib/supabase/Upserts/nhlRush.test.ts` - Tests for rush/transition classification.
- `web/pages/api/v1/db/shift-charts.ts` - After-the-fact shift-chart and line-combination source relevant to QoT/QoC and on-ice context.
- `web/pages/api/v1/db/update-shifts.ts` - Shift ingestion endpoint relevant to on-ice teammate/opponent context.
- `web/pages/api/v1/db/update-lines-ccc.ts` - CCC source ingestion for pregame lineup, goalie, and injury signals.
- `web/pages/api/v1/db/update-line-combinations/index.ts` - Line-combination ingestion path that can support QoT/QoC and lineup-derived context.
- `web/pages/api/v1/db/update-line-sources.ts` - Line-source ingestion endpoint for source freshness and provenance.
- `web/pages/api/v1/db/update-lineup-source-provenance.ts` - Provenance endpoint for lineup/source confidence.
- `web/pages/twitterEmbeds/index.tsx` - Manual/review UI for tweet-derived goalie, lineup, and injury signals.
- `web/pages/api/v1/db/tweet-pattern-review.ts` - Review endpoint for tweet regex/pattern classification of lineups, goalie starts, and injuries.
- `web/lib/sources/tweetPatternReview.ts` - Tweet pattern classification logic to extend for lineup, goalie-start, and injury recognition.
- `web/lib/sources/tweetPatternReview.test.ts` - Tests for tweet pattern classification.
- `web/lib/sources/injuryStatusIngestion.ts` - Existing injury/status ingestion layer to extend for severity, body region, and return limitation fields.
- `web/lib/sources/injuryStatusIngestion.test.ts` - Tests for normalized injury/status behavior.
- `web/lib/projections/utils/projection-metadata-builders.ts` - Existing starter scenario metadata path and likely bridge to first-class goalie mixture distributions.
- `web/lib/projections/goalieStarterMixtures.ts` - Builds first-class goalie starter mixture distributions and branch projection rows.
- `web/lib/projections/goalieStarterMixtures.test.ts` - Tests confirmed starters, ambiguous distributions, stale rows, back-to-backs, manual overrides, and weighted branch outputs.
- `migrations/20260527_create_goalie_starter_mixture_tables.sql` - Defines persisted goalie starter mixture distribution and projection branch tables.
- `web/pages/api/v1/db/update-goalie-starter-mixtures.ts` - Admin endpoint for dry-running or upserting starter mixture distributions from `goalie_start_projections`.
- `web/lib/game-predictions/featureBuilder.ts` - Game-level feature builder where travel, timezone, fatigue, leakage registry, and EDGE features may feed prediction models.
- `web/lib/game-predictions/featureSources.ts` - Existing feature-source metadata that may become part of the leakage/source-safety registry.
- `web/lib/ml/featureLeakageRegistry.ts` - Global feature/source safety registry and validation helpers for model builders.
- `web/lib/ml/featureLeakageRegistry.test.ts` - Tests for pregame safety, freshness warnings, postgame/target leakage rejection, and fail-closed unknown sources.
- `web/pages/api/v1/db/update-nhl-edge-stats.ts` - NHL EDGE ingestion endpoint for typed skater/team/goalie metric tables.
- `web/pages/api/v1/db/update-nhl-edge-teams.ts` - Team-focused NHL EDGE ingestion endpoint.
- `web/lib/NHL/edgeIngestion.ts` - NHL EDGE row builders and typed metric extraction.
- `web/lib/NHL/edgeFeatureContract.ts` - Model-facing NHL EDGE feature contracts, join-plan helpers, and snapshot freshness validation.
- `web/lib/NHL/edgeFeatureContract.test.ts` - Tests EDGE contracts, leakage-gated join plans, leaderboard exclusion, and stale snapshot handling.
- `web/lib/NHL/pptReplayCoverage.ts` - Discovers NHL `pptReplayUrl` events from explicit gamecenter PBP fields and summarizes coverage by game/type.
- `web/lib/NHL/pptReplayCoverage.test.ts` - Tests controlled replay URL discovery and non-goal coverage accounting.
- `web/lib/NHL/pptReplayIngestion.ts` - Fetches discovered public replay URLs and builds raw payload plus normalized player/puck frame rows.
- `web/lib/NHL/pptReplayIngestion.test.ts` - Tests raw replay payload row shaping, player frame normalization, puck inference, and failed fetch rows.
- `web/pages/api/v1/db/audit-nhl-ppt-replay-coverage.ts` - Admin audit endpoint for replay URL coverage by selected game IDs or scheduled game ranges.
- `web/pages/api/v1/db/update-nhl-ppt-replay-tracking.ts` - Admin endpoint that discovers PBP replay URLs, fetches public sprite JSON, and upserts raw payload/frame rows.
- `migrations/20260530_create_nhl_ppt_replay_tracking_tables.sql` - Defines raw replay payload and normalized player/puck frame tables.
- `migrations/20260527_create_nhl_xg_created_xg_tables.sql` - Defines player game and rolling created-xG aggregate tables with component breakdowns.
- `web/lib/xg/createdXg.ts` - Builds distinct player created-xG aggregates from inferred shot-assist candidates and selected non-shooter transition credit.
- `web/lib/xg/createdXg.test.ts` - Tests created-xG component aggregation, rolling windows, shooter self-credit exclusions, and reconciliation checks.
- `web/pages/api/v1/db/update-nhl-xg-created-xg.ts` - Admin endpoint for dry-running or upserting player created-xG game and rolling aggregates.
- `web/lib/xg/adjustedImpact.ts` - Defines the first adjusted-impact target family and builds sparse on-ice xG differential design rows from shift stints.
- `web/lib/xg/adjustedImpact.test.ts` - Tests adjusted-impact design-row coefficients, context features, goalie exclusion, and skip reasons.
- `migrations/20260527_create_nhl_xg_adjusted_impact_tables.sql` - Defines adjusted-impact model-run metadata and player coefficient output tables.
- `web/pages/api/v1/db/update-nhl-xg-adjusted-impact.ts` - Admin endpoint for dry-running or upserting regularized adjusted-impact model outputs.
- `web/lib/xg/qotQoc.ts` - Builds role/TOI-bucket offensive and defensive percentile ratings for QoT/QoC inputs.
- `web/lib/xg/qotQoc.test.ts` - Tests QoT/QoC percentile buckets, comparable groups, and invalid-row handling.
- `migrations/20260527_create_nhl_xg_qot_qoc_tables.sql` - Defines player-game, line/pair, and player rolling QoT/QoC feature tables.
- `web/pages/api/v1/db/update-nhl-xg-qot-qoc.ts` - Admin endpoint for dry-running or upserting postgame shift-overlap QoT/QoC features.
- `web/lib/xg/travelFatigue.ts` - Builds pregame-safe team-game travel, timezone, circadian, road-trip, and fatigue features from the `games` schedule.
- `web/lib/xg/travelFatigue.test.ts` - Tests home/away identification, timezone inference, back-to-backs, three-in-four, road trips, and missing timezone handling.
- `migrations/20260527_create_nhl_xg_travel_fatigue_tables.sql` - Defines persisted team-game travel/fatigue feature rows.
- `web/pages/api/v1/db/update-nhl-xg-travel-fatigue.ts` - Admin endpoint for dry-running or upserting schedule-derived travel/fatigue rows.
- `web/lib/xg/reboundControl.ts` - Builds team, player, and goalie rebound-control outputs from approved rebound-creation predictions.
- `web/lib/xg/reboundControl.test.ts` - Tests rebound-control aggregates, empty-net goalie exclusions, delayed-penalty QA, and unapproved-row rejection.
- `migrations/20260527_create_nhl_xg_rebound_control_tables.sql` - Defines team/player/goalie rebound-control aggregate tables.
- `web/pages/api/v1/db/update-nhl-xg-rebound-control.ts` - Admin endpoint for dry-running or upserting rebound-control aggregates.
- `web/pages/underlying-stats/playerStats/index.tsx` - Candidate UI surface for player-level xG creation, shot-assist, and transition metrics.
- `web/pages/underlying-stats/teamStats/index.tsx` - Candidate UI surface for team-level xGF/xGA and transition metrics.
- `web/pages/api/v1/underlying-stats/players.ts` - Existing player underlying-stats API that may be extended or joined with xG creation summaries.
- `web/pages/api/v1/underlying-stats/teams.ts` - Existing team underlying-stats API that may be extended or joined with xG aggregate summaries.
- `web/pages/api/v1/underlying-stats/xg.ts` - Read-only xG lab API with paginated Supabase reads, model resolution, and supplemental coverage warnings.
- `web/components/underlying-stats/PlayerStatsTable.tsx` - Existing table component that supports adding extra player-stat columns.
- `web/components/underlying-stats/playerStatsColumns.ts` - Existing player-stat column definitions where xG creation fields can be grouped.
- `web/pages/underlying-stats/xg/index.tsx` - Dedicated xG lab page for player/team/goalie xG aggregate review before production wiring.
- `web/pages/underlying-stats/xg/xg.module.scss` - xG lab page styles, including the visible supplemental coverage warning state.
- `web/lib/underlying-stats/xgExplorer.ts` - xG lab row builders and supplemental coverage QA report helpers.
- `web/lib/underlying-stats/xgExplorer.test.ts` - Focused tests for xG lab row merging and supplemental coverage warning thresholds.
- `web/__tests__/pages/underlying-stats/xg/index.test.tsx` - Focused xG lab page/query tests that verify the read-only API path and scope switching.
- `tasks/TASKS/cron-operations/cron-schedule.md` - Cron documentation and placement for xG feature/prediction refresh jobs.
- `tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md` - Current xG feature contract and leakage-exclusion reference.
- `tasks/TASKS/xg-model/baseline/xg-training-dataset-contract.md` - Current xG training-row, label, split, and rebound-creation target contract.
- `tasks/TASKS/xg-model/nhl-api-foundation/feature-leakage-registry.md` - Documentation for registry categories and onboarding requirements for new model features.
- `tasks/TASKS/three-pillars-analytics/nhl-edge/nhl-edge-feature-contract.md` - Documents model-usable EDGE tables, grains, fields, and freshness/leakage semantics.
- `web/lib/supabase/Upserts/fetchPbP.ts` - Existing PBP ingestion path that can discover NHL `pptReplayUrl` values when gamecenter exposes goal-replay sprite URLs.
- `web/pages/api/v1/db/update-PbP.ts` - Existing operator endpoint for PBP ingestion and candidate source for replay URL discovery coverage checks.
- `web/lib/projections/ingest/pbp.ts` - Normalized PBP ingestion layer that can be extended to preserve replay URL provenance for tracking ingestion.

### Notes

- Items 1 and 2 are currently being manually backfilled; the implementation task is to verify coverage, expose gaps, and make future reruns idempotent.
- Keep `shot_goal` and `rebound_creation` as separate prediction tasks. Do not allow rebound predictions to run from a shot-goal artifact.
- Use the project's existing Vitest and TypeScript conventions. Confirm exact commands from `package.json` before broad test execution.
- Historical training and trending features must be labeled by availability: pregame-safe, in-game-only, or postgame-descriptive.
- Prefer persisted, typed contracts over long-term JSON-only usage for model-critical features.
- Latest `20252026` regular+playoff audit command:
  `DOTENV_CONFIG_PATH=.env.local NODE_PATH=. ./node_modules/.bin/ts-node -r dotenv/config --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' -e "import supabase from './lib/supabase/server'; import { auditXgBackfillCoverage } from './lib/xg/backfillCoverageAudit'; (async () => { const audit = await auditXgBackfillCoverage({ supabase: supabase as any, seasonId: 20252026, gameTypes: [2,3], featureVersion: 1, parserVersion: 1, strengthVersion: 1, modelVersion: null, predictionType: 'shot_goal', sampleLimit: 10 }); console.log(JSON.stringify(audit, null, 2)); })().catch((error) => { console.error(error); process.exit(1); });"`
- Latest `20252026` regular+playoff audit result: 1,410 eligible games, 1,386 games with normalized PBP and shifts, 24 games missing both normalized PBP and shifts, 1,386 games with xG features, 1,386 games with xG predictions, and 0 approved prediction rows missing `calibrated_probability`.
- Missing normalized PBP audit disposition: the 24 missing `20252026` games are playoff placeholders or future games. NHL gamecenter returned 404 for 20 IDs and `gameState="FUT"` with 0 plays for `2025030314`, `2025030315`, `2025030316`, and `2025030317`.
- Task 1.6 closure: feature backfill is complete for all normalized-data-ready `20252026` regular-season and playoff games. The 24 games without features are explicitly excluded until NHL gamecenter exposes real PBP/shift data for them.
- Final `20252026` shot-goal prediction check for `logistic_l2-s20252026-p1-st1-f1-cfg9bac2706`: 118,610 prediction rows, 0 null `raw_probability`, 0 null `calibrated_probability`, 0 null `xg`; sampled rows have `model_approved=true` and `xg=calibrated_probability`.
- Feature materialization idempotency check: `nhl_xg_shot_features` has primary key `(feature_version, game_id, event_id)`, `upsertXgShotFeatureRows` uses `onConflict: "feature_version,game_id,event_id"`, and backfill selection skips games with existing feature rows unless `force=true`.
- Prediction materialization idempotency check: `nhl_xg_shot_predictions` has primary key `(model_version, prediction_type, game_id, event_id)`, the prediction endpoint upserts on `model_version,prediction_type,game_id,event_id`, and repeated limited backfill runs skip already-scored feature rows before selecting rows to score.
- Production xG artifact contract: production scoring should resolve the approved artifact from `NHL_XG_MODEL_ARTIFACT_PATH`; `modelArtifactPath` remains available for local diagnostics and one-off backfills.
- Production xG artifact promotion steps: regenerate and approval-benchmark the artifact, place the approved `model-artifact.json` at the deployed artifact path, set `NHL_XG_MODEL_ARTIFACT_PATH`, verify `/api/v1/db/update-nhl-xg-shot-predictions?action=health`, then run a limited prediction smoke test before scheduling full backfill/cron.
- Artifact health smoke test passed over HTTP for `logistic_l2-s20252026-p1-st1-f1-cfg9bac2706` with `modelApproved=true`, isotonic calibration applied, and serialized calibration present.
- Daily xG refresh order is locked as: game schedule/identity, normalized NHL gamecenter/PBP/shift inputs, `update-nhl-xg-shot-features`, then `update-nhl-xg-shot-predictions`. Prediction refresh must run only after feature refresh has completed for the same date/game selection.
- Daily xG cron SQL is documented in `tasks/TASKS/cron-operations/cron-schedule.md` at 09:51 UTC for `update-nhl-xg-shot-features` and 09:52 UTC for `update-nhl-xg-shot-predictions`. The prediction cron relies on `NHL_XG_MODEL_ARTIFACT_PATH` in production.
- Daily xG endpoint smoke tests passed locally on `gameId=2025020001`: feature refresh rebuilt/upserted 119 shot-feature rows; prediction refresh scored/upserted 82 unblocked shot-goal rows with the approved artifact.
- Rebound-creation dataset support now exists behind `predictionType=rebound_creation`: the default `shot_goal` dataset still uses the unblocked shot-goal cohort and `label_goal`, while rebound creation uses `shot-on-goal`, `missed-shot`, and `blocked-shot` source rows with `label_rebound_creation = createsRebound`.
- First rebound-creation baseline artifact: `scripts/output/xg-rebound-baselines/logistic_l2-rebound_creation-s20252026-p1-st1-f1-cfg67a10a61/model-artifact.json`. It trained on 153,585 rebound-source rows with 107,802 train, 22,692 validation, and 23,091 test examples; validation/test positive labels were 2,091/2,232, and holdout positives were 4,323.
- Rebound-specific approval gates now check validation/test sample size, validation/test positive label counts, holdout positive label count, validation/test positive-rate stability, holdout calibration delta, and whether holdout log loss/Brier beat base-rate baselines. The regenerated rebound artifact passes with no blocking reasons.
- Rebound prediction endpoint smoke test passed for `gameId=2025020001` with the approved rebound artifact: 114 rebound-source feature rows scored/upserted. The endpoint now rejects a shot-goal artifact for `predictionType=rebound_creation` with HTTP 409 and an artifact/request prediction-type mismatch.
- Recommended upstream normalized-data route from the audit: `/api/v1/db/ingest-projection-inputs?startDate=2026-04-27&endDate=2026-06-02&debug=true`.
- Recommended xG feature backfill route from the audit: `/api/v1/db/update-nhl-xg-shot-features?backfill=true&seasonId=20252026&gameTypes=2,3&featureVersion=1&parserVersion=1&strengthVersion=1`.
- Recommended xG prediction backfill route from the audit: `/api/v1/db/update-nhl-xg-shot-predictions?backfill=true&seasonId=20252026&gameTypes=2,3&featureVersion=1&predictionType=shot_goal`.

## Tasks

- [x] 1.0 Verify and complete `nhl_xg_shot_features` backfill
  - [x] 1.1 Add or document a coverage query comparing eligible `games` to distinct `(feature_version, game_id)` rows in `nhl_xg_shot_features`.
  - [x] 1.2 Verify manual backfill coverage by season, game type, parser version, strength version, and feature version.
  - [x] 1.3 Identify games blocked by missing normalized PBP or shift rows and route them to the proper upstream ingestion endpoint.
  - [x] 1.4 Confirm the feature endpoint can resume idempotently without duplicating rows or skipping partially populated games.
  - [x] 1.5 Record the accepted backfill command patterns and expected row-count checks in an xG runbook or task note.
  - [x] 1.6 Continue feature backfill until the audit shows every normalized-data-ready game has `nhl_xg_shot_features` rows, excluding future/unavailable games explicitly documented by upstream coverage.

- [x] 2.0 Verify and complete `nhl_xg_shot_predictions` backfill
  - [x] 2.1 Add or document a coverage query comparing feature rows to prediction rows by `model_version`, `prediction_type`, `feature_version`, and game.
  - [x] 2.2 Backfill predictions from the approved shot-goal artifact for every completed feature row.
  - [x] 2.3 Verify `raw_probability`, `calibrated_probability`, and `xg` are populated as expected for approved calibrated artifacts.
  - [x] 2.4 Add an audit check that flags feature rows missing approved predictions.
  - [x] 2.5 Confirm prediction reruns are idempotent and preserve the correct `model_version,prediction_type,game_id,event_id` conflict behavior.

- [x] 3.0 Productionize xG model artifact resolution
  - [x] 3.1 Settle the production artifact path contract using `NHL_XG_MODEL_ARTIFACT_PATH` or a small model registry table/config.
  - [x] 3.2 Ensure the prediction endpoint fails clearly when no approved artifact is configured.
  - [x] 3.3 Add a startup or endpoint health check that reports artifact tag, family, feature version, calibration method, and approval status.
  - [x] 3.4 Document artifact promotion steps from training output to production config.
  - [x] 3.5 Smoke-test `/api/v1/db/update-nhl-xg-shot-predictions?action=health` over HTTP once the local dev server is no longer occupied by long-running backfill requests.

- [x] 4.0 Add daily xG feature and prediction scheduling
  - [x] 4.1 Decide the daily refresh order: normalized game data, shifts, `update-nhl-xg-shot-features`, then `update-nhl-xg-shot-predictions`.
  - [x] 4.2 Add Supabase cron SQL for the xG feature refresh endpoint.
  - [x] 4.3 Add Supabase cron SQL for the xG prediction refresh endpoint after feature refresh.
  - [x] 4.4 Add both jobs to the correct chronological section in `tasks/TASKS/cron-operations/cron-schedule.md`.
  - [x] 4.5 Smoke-test the scheduled endpoint URLs with a small `limit` before enabling full daily runs.

- [x] 5.0 Build and approve the separate `rebound_creation` model
  - [x] 5.1 Define the rebound-creation label precisely, including time window, same-possession requirement, blocked-shot treatment, and goalie-freeze exclusions.
  - [x] 5.2 Extend the training dataset builder to support `predictionType=rebound_creation` without changing the approved shot-goal contract.
  - [x] 5.3 Train a baseline rebound model with real train/validation/test splits and enough positive examples.
  - [x] 5.4 Add rebound-specific approval gates for sample size, calibration, positive-rate stability, and holdout performance.
  - [x] 5.5 Store a distinct approved rebound artifact and require it when the prediction endpoint receives `predictionType=rebound_creation`.
  - [x] 5.6 Add tests proving shot-goal artifacts cannot score rebound-creation rows.

- [x] 6.0 Wire xG predictions into team, player, and goalie aggregates
  - [x] 6.1 Define aggregate grains for team game, team rolling window, player game, player rolling window, goalie game, and goalie rolling window.
  - [x] 6.2 Create or extend persisted aggregate tables/views for team `xGF/xGA`, player `ixG`, goalie `xGA`, and goalie saved-goals style metrics.
  - [x] 6.3 Add aggregation logic that consumes only approved `shot_goal` prediction rows by model version.
  - [x] 6.4 Add provenance fields that preserve source model version, feature version, aggregation window, and refresh timestamp.
  - [x] 6.5 Update downstream readers to prefer in-house xG aggregates where the contract is complete.

  Notes:
  - Added `migrations/20260527_create_nhl_xg_aggregate_tables.sql` for team/player/goalie game and rolling xG aggregate tables.
  - Added `/api/v1/db/update-nhl-xg-aggregates` plus pure aggregate builder/tests for approved `shot_goal` rows only.
  - Dry run for model `logistic_l2-s20252026-p1-st1-f1-cfg9bac2706`, feature version `1`, season `20252026`, windows `5,10,20` processed `118610` approved prediction rows with `0` skipped rows and produced `2772` team game, `42236` player game, `2922` goalie game, `8316` team rolling, `126708` player rolling, and `8766` goalie rolling rows.
  - FORGE team-strength context now prefers `nhl_xg_team_rolling_aggregates` when `NHL_XG_TEAM_AGGREGATE_MODEL_VERSION` is configured, and falls back to `nhl_team_data` if the aggregate table/config/data is unavailable.
  - Non-dry-run persistence requires applying the aggregate-table migration first.

- [x] 7.0 Add aggregate QA and reconciliation checks
  - [x] 7.1 Verify team `xGF` equals the sum of owned shot xG and team `xGA` equals the opponent-owned shot xG for the same games.
  - [x] 7.2 Verify player `ixG` sums reconcile to team owned xG except for unmapped shooter rows.
  - [x] 7.3 Verify goalie `xGA` reconciles to shot rows with `goalie_in_net_id` and flags empty-net exclusions separately.
  - [x] 7.4 Add drift checks comparing in-house xG distributions to prior artifact baselines and existing NST/WGO xG surfaces where available.
  - [x] 7.5 Add a small admin/report endpoint or SQL view that lists missing rows, unmapped players, empty-net exclusions, and reconciliation deltas.

  Notes:
  - `/api/v1/db/update-nhl-xg-aggregates?dryRun=true` now returns aggregate QA with reconciliation issues and skipped/missing shooter/goalie/empty-net exclusion counts.
  - Dry run for model `logistic_l2-s20252026-p1-st1-f1-cfg9bac2706`, feature version `1`, season `20252026`, windows `5,10,20` returned `qa.passed=true`, `issueCount=0`, team rows checked `2772`, player rows checked `42236`, goalie rows checked `2922`.
  - Current QA reports `emptyNetGoalieRows=1061`, `emptyNetGoalieXg=336.075482`, `emptyNetGoalieGoals=542`, and `missingGoalieRows=0`.
  - Drift check against the approved artifact returned no warnings: current average prediction `0.070518` vs artifact `0.0706`, current goal rate `0.071722` vs artifact `0.071801`.
  - NST team-game xG drift check compared `2544` team-game rows, missed `228` comparison rows, and flagged `large_team_xg_surface_delta` with average absolute xGF/xGA delta `0.953186`; WGO is reported unavailable because `wgo_team_stats` has no xG/xGA columns.

- [x] 8.0 Add shot assists, primary shot assists, and expected primary assists
  - [x] 8.1 Audit current PBP and possession-chain fields to determine what can be inferred reliably without puck-tracking pass events.
  - [x] 8.2 Define heuristic shot-assist attribution rules using previous same-team controlled events, timing, zone, coordinates, and possession-chain continuity.
  - [x] 8.3 Persist shot-assist candidate rows with confidence/provenance rather than treating inferred assists as official facts.
  - [x] 8.4 Add `expected_primary_assists` by assigning shot xG credit to the inferred primary shot-assist player.
  - [x] 8.5 Add tests covering false positives after faceoffs, rebounds, turnovers, blocked/missed events, and line changes.

  Notes:
  - Public NHL PBP does not expose pass events, so the first-pass contract is intentionally `nhl_xg_shot_assist_candidates`: inferred primary shot-assist candidates with confidence, not official assists.
  - Added `migrations/20260527_create_nhl_xg_shot_assist_candidates.sql`, `web/lib/xg/shotAssists.ts`, and `/api/v1/db/update-nhl-xg-shot-assists`.
  - Heuristics require an approved `shot_goal` prediction, unblocked non-rebound shot, previous same-team controlled event within `8` seconds, non-self actor, and explicit exclusions for faceoffs, rebounds, giveaways/turnovers, blocked/missed/failed shots, penalties, stoppages, and line-change style events.
  - `expected_primary_assists` is stored as `shot_xg * candidate_confidence` with provenance noting this is inferred from NHL event sequences.
  - Limited dry run for season `20252026`, model `logistic_l2-s20252026-p1-st1-f1-cfg9bac2706`, feature version `1`, limit `100`: `4` candidates, `2` medium confidence, `2` low confidence, `0.006774` expected primary assists.

- [x] 9.0 Add entry assists, controlled entries/exits, and transition metrics
  - [x] 9.1 Audit whether NHL PBP coordinates, event order, and possession chains are sufficient for a first-pass transition proxy.
  - [x] 9.2 Define controlled-entry, dump-in, controlled-exit, failed-exit, and entry-assist heuristics with explicit confidence tiers.
  - [x] 9.3 Persist typed transition events or features with source event IDs and provenance.
  - [x] 9.4 Add player and team aggregates for controlled entries, controlled exits, entry assists, and transition-created shots/xG.
  - [x] 9.5 Add tests for neutral-zone turnovers, offensive-zone faceoffs, rush shots, and ambiguous coordinate sequences.

  Notes:
  - Public NHL PBP is sufficient for a first-pass transition proxy using rush source, possession start zone/type, offensive-zone entry flags, event order, and approved shot xG. It is not true puck-tracking zone-entry data.
  - Added `migrations/20260527_create_nhl_xg_transition_tables.sql`, `web/lib/xg/transitions.ts`, and `/api/v1/db/update-nhl-xg-transitions`.
  - Persisted transition event types: `controlled_entry_proxy`, `dump_in_entry_proxy`, `controlled_exit_proxy`, `failed_exit_against_proxy`, `entry_assist_proxy`, and `transition_created_shot`, each with confidence/provenance.
  - Added team/player game aggregates for controlled entries, dump-in entries via controlled-entry count, controlled exits, failed exits against, entry assists, transition-created shots, and transition-created xG.
  - Limited dry run for season `20252026`, model `logistic_l2-s20252026-p1-st1-f1-cfg9bac2706`, feature version `1`, limit `100`: `42` transition events, `62` aggregate rows, `6` controlled entries, `0` dump-in entries, `2` controlled exits, `8` failed exits against, `4` entry assists, `22` transition-created shots, `0.123795` transition-created xG.

- [x] 10.0 Create a distinct `created_xg` metric
  - [x] 10.1 Define `created_xg` separately from shooter `ixG`, likely as shot-assist xG plus transition-created xG and selected rebound-creation credit.
  - [x] 10.2 Persist player-game and rolling-window `created_xg` outputs with component breakdowns.
  - [x] 10.3 Ensure `created_xg` does not double-count the shooter's own `ixG` unless explicitly configured.
  - [x] 10.4 Add reconciliation checks comparing `created_xg` components to underlying shot and assist candidate rows.

  Notes:
  - Added `migrations/20260527_create_nhl_xg_created_xg_tables.sql`, `web/lib/xg/createdXg.ts`, and `/api/v1/db/update-nhl-xg-created-xg`.
  - v1 `created_xg` is `shot_assist_created_xg + selected_non_shooter_transition_created_xg + rebound_created_xg`.
  - `shot_assist_created_xg` comes from inferred `expected_primary_assists`; transition credit chooses at most one highest-value non-shooter creator event per player-shot from controlled-entry, controlled-exit, and entry-assist proxy events.
  - `transition_created_shot` and transition rows where the credited player is the shooter are excluded so `created_xg` remains distinct from shooter `ixG`.
  - `rebound_created_xg` is persisted as a component but remains `0` in v1 until task 17 approves rebound-control outputs.
  - Focused verification passed: `npx vitest --run lib/xg/createdXg.test.ts lib/xg/shotAssists.test.ts lib/xg/transitions.test.ts lib/xg/aggregates.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [x] 11.0 Add RAPM or adjusted player impact modeling
  - [x] 11.1 Define the first target family for adjusted impact, such as xG differential, shot differential, goal differential, or multi-target variants.
  - [x] 11.2 Build stint or shift-level design matrices with teammate, opponent, zone, score, home, rest, and manpower context.
  - [x] 11.3 Fit a regularized baseline model before attempting more complex adjusted-impact methods.
  - [x] 11.4 Persist player impact outputs with model version, target family, shrinkage settings, and uncertainty.
  - [x] 11.5 Add temporal validation and leakage checks to prevent same-game target leakage.

  Notes:
  - First target family is `on_ice_xg_differential_v1`, using approved in-house shot xG as the response and sparse on-ice player coefficients: `+1` for event-owner skaters and `-1` for opponent skaters.
  - Design rows carry context for score, zone, home/away, rest-day fields when supplied, and manpower/strength state. This keeps adjustment context explicit before fitting a baseline.
  - The builder uses reconstructed `nhl_api_shift_rows` stints via existing shift-stint utilities; legacy `shift_charts` remains validation context only because it does not reliably preserve row-level shift intervals.
  - Added a ridge-style `ridge_sgd_v1` baseline fitter with L2 shrinkage, player coefficients, context coefficients, MSE, and approximate coefficient uncertainty from model error and player sample size.
  - Added `migrations/20260527_create_nhl_xg_adjusted_impact_tables.sql` and `/api/v1/db/update-nhl-xg-adjusted-impact` for dry-running or upserting model-run metadata and player impact rows.
  - Leakage validation marks adjusted impact as `postgame_descriptive` and rejects `usageMode=pregame` with `adjusted_impact_is_not_pregame_safe` and `same_game_on_ice_target_leakage`.
  - Focused verification passed: `npx vitest --run lib/xg/adjustedImpact.test.ts lib/xg/createdXg.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [x] 12.0 Add first-class QoT/QoC features
  - [x] 12.1 Audit `shift-charts.ts`, `update-shifts.ts`, `update-lines-ccc.ts`, `update-line-combinations`, `update-line-sources.ts`, and `update-lineup-source-provenance.ts` for usable teammate/opponent deployment inputs.
  - [x] 12.2 Audit `twitterEmbeds` and `tweet-pattern-review.ts` for pregame lineup, goalie-start, and injury signals that can affect expected teammate/opponent quality.
  - [x] 12.3 Define offensive and defensive player percentile scores by role/position and similar TOI buckets.
  - [x] 12.4 Persist QoT/QoC features by player-game, line/pair, and rolling window with source and freshness metadata.
  - [x] 12.5 Separate pregame-safe QoT/QoC from postgame-descriptive QoT/QoC in the leakage registry.
  - [x] 12.6 Add tests for traded players, partial games, missing shifts, and stale lineup sources.

  Notes:
  - Postgame QoT/QoC should use `nhl_api_shift_rows` and the existing shift-stint utilities as the canonical overlap source; the prior shift audit shows this row-level feed supports stint reconstruction and event-time on-ice attribution.
  - Legacy `shift_charts` and `lineCombinations` are useful validation/display surfaces but should not be the canonical QoT/QoC overlap source because `shift_charts` stores player-game aggregates and recent rows may not preserve full shift intervals.
  - `update-line-combinations` can backfill after-the-fact game line combinations from gamecenter feeds, which is useful for display and postgame validation, not pregame-safe QoT/QoC.
  - `update-lines-ccc`, `update-line-sources`, and `update-lineup-source-provenance` provide prospective lineup/source signals with source freshness, aliases, unresolved-name handling, and source selection. `update-lineup-source-provenance` explicitly blocks historical replay for current-state sources to avoid dishonest history.
  - `tweet-pattern-review` already categorizes lineup, line-combination, goalie-start, injury, scratch, return, and transaction evidence and can feed future pregame expected QoT/QoC, starter mixtures, and injury availability features.
  - Added `web/lib/xg/qotQoc.ts` to define `forward`/`defense`/`goalie`/`unknown` role groups, low/middle/high TOI buckets inside role, and offensive/defensive percentile ranks within each comparable group.
  - Added `migrations/20260527_create_nhl_xg_qot_qoc_tables.sql` and `/api/v1/db/update-nhl-xg-qot-qoc` for player-game, line/pair, and player rolling feature persistence.
  - Postgame shift-overlap QoT/QoC rows are explicitly `feature_availability='postgame_descriptive'`; `usageMode=pregame` is blocked with `postgame_shift_overlap_qot_qoc_is_not_pregame_safe` and `same_game_teammate_opponent_overlap_leakage`.
  - Focused verification passed: `npx vitest --run lib/xg/qotQoc.test.ts lib/xg/adjustedImpact.test.ts lib/xg/createdXg.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [x] 13.0 Add typed travel, timezone, circadian, road-trip, and fatigue features
  - [x] 13.1 Build schedule-derived home/away, previous game, next game, back-to-back, three-in-four, and road-trip sequence features.
  - [x] 13.2 Infer venue/team timezones and local puck-drop times for circadian and body-clock deltas.
  - [x] 13.3 Persist travel/fatigue features by team-game and expose player-level inherited features where appropriate.
  - [x] 13.4 Add clear handling for neutral-site games, missing venue data, daylight-saving transitions, and playoff schedule anomalies.
  - [x] 13.5 Add tests for home/away identification, timezone inference, and road-trip sequence boundaries.

  Notes:
  - Added `migrations/20260527_create_nhl_xg_travel_fatigue_tables.sql`, `web/lib/xg/travelFatigue.ts`, and `/api/v1/db/update-nhl-xg-travel-fatigue`.
  - v1 schedule features include home/away, previous and next game references, rest days, back-to-back, games in last 4/7/14 days, three-in-four, road-trip and home-stand sequence counts, timezone deltas, travel direction, local puck-drop hour, team body-clock puck-drop hour, and body-clock delta.
  - Current `games` rows do not expose arena/venue timezone, so venue timezone is explicitly `home_team_inference`; missing team timezone rows are retained with `venue_timezone_source='missing_home_team_timezone'` instead of being silently dropped.
  - Feature rows are `feature_availability='pregame_safe'` because they are schedule-derived and do not depend on postgame outcomes.
  - Focused verification passed: `npx vitest --run lib/xg/travelFatigue.test.ts lib/xg/qotQoc.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [x] 14.0 Improve injury severity, body-region, and return-limitation data
  - [x] 14.1 Audit current Twitter feed ingestion, ESPN endpoints, and `injuryStatusIngestion.ts` for fields and phrasing that can support severity/body-region inference.
  - [x] 14.2 Extend normalized injury states with optional severity tier, body region, expected return window, practice participation, and limitation notes.
  - [x] 14.3 Store source provenance and confidence for each inferred injury attribute.
  - [x] 14.4 Add regex/classifier coverage for common NHL phrases such as day-to-day, week-to-week, game-time decision, maintenance, no-contact, and ruled out.
  - [x] 14.5 Add tests that prevent transaction-only or lineup-only tweets from becoming injury-severity updates.

  Notes:
  - Existing `player_status_history` remains schema-compatible; typed injury attributes are stored under `metadata.injuryAttributes`.
  - Added inference for `severityTier`, `bodyRegion`, `expectedReturnWindow`, `returnLimitations`, `confidence`, evidence phrases, and inference provenance.
  - Bell/TSN injury rows now enrich `raw_status` plus `status_detail`; GameDayTweets injury, questionable, and returning rows now enrich tweet text and retain source handle/post labels.
  - Regex coverage now handles day-to-day, week-to-week, multi-week/surgery/season-ending/indefinite, game-time decision, limited practice, non-participant practice, no-contact, maintenance, will-not-travel, ruled out, and returning-to-lineup phrasing.
  - Focused verification passed: `npx vitest --run lib/sources/injuryStatusIngestion.test.ts lib/sources/tweetPatternReview.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [x] 15.0 Create a global feature-leakage registry
  - [x] 15.1 Define registry categories: pregame-safe, pregame-safe-with-freshness, in-game-only, postgame-descriptive, target-leakage, and unknown.
  - [x] 15.2 Register xG features, team/game prediction features, lineup features, goalie starter features, injury features, EDGE features, and aggregate features.
  - [x] 15.3 Add helper APIs that model builders can call to reject forbidden feature categories for a given training or inference mode.
  - [x] 15.4 Add tests proving known unsafe features cannot enter pregame model matrices.
  - [x] 15.5 Document how new features must be registered before being consumed by prediction or trending models.

  Notes:
  - Added `web/lib/ml/featureLeakageRegistry.ts` with categories `pregame_safe`, `pregame_safe_with_freshness`, `in_game_only`, `postgame_descriptive`, `target_leakage`, and `unknown`.
  - Registered schedule/travel, dated team strength/NST/WGO, lineup sources, goalie starter signals, injury status, NHL EDGE, xG shot features/predictions, xG aggregates, shot-assist/transition/created-xG, QoT/QoC, adjusted impact, latest-only display views, direct shot-goal label keys, and serving output tables.
  - Added `validateFeatureLeakageUsage` and `assertFeatureLeakageUsage`; unknown feature ids/tables fail closed, freshness-gated sources emit warnings, and pregame mode rejects in-game/postgame/target-leakage/unknown sources.
  - Added `tasks/TASKS/xg-model/nhl-api-foundation/feature-leakage-registry.md` documenting category semantics and the requirement that new model features be registered before use.
  - Focused verification passed: `npx vitest --run lib/ml/featureLeakageRegistry.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [x] 16.0 Add first-class goalie starter mixture distributions
  - [x] 16.1 Audit current starter scenario metadata and Twitter feed ingestion for probability, source, and freshness signals.
  - [x] 16.2 Persist starter probability distributions by game/team/goalie with source confidence and as-of timestamp.
  - [x] 16.3 Update goalie and game projections to consume scenario-weighted starter distributions instead of a single thin starter estimate when status is uncertain.
  - [x] 16.4 Store branch-level projection outputs for likely starters and aggregate them into scenario-weighted slate outputs.
  - [x] 16.5 Add tests for confirmed starters, ambiguous starters, stale confirmations, back-to-back goalie usage, and manual overrides.

  Notes:
  - Current projection code already builds top starter scenarios and blends branch outputs; task 16 adds the missing persisted distribution contract around those probabilities.
  - Added `migrations/20260527_create_goalie_starter_mixture_tables.sql`, `web/lib/projections/goalieStarterMixtures.ts`, and `/api/v1/db/update-goalie-starter-mixtures`.
  - `nhl_goalie_starter_mixture_distributions` persists game/team/goalie probability rows with `as_of_timestamp`, source confidence, source freshness, confirmed/manual override flags, stale flags, back-to-back context, prior probability, adjusted probability, normalized probability, and provenance.
  - `nhl_goalie_starter_mixture_projection_branches` stores branch-level goalie projection outputs and weighted branch outputs for scenario-weighted slate aggregation.
  - The builder can convert persisted mixture rows back into starter scenarios for projection consumption, preserving ambiguous two-goalie distributions instead of collapsing to one starter.
  - Focused verification passed: `npx vitest --run lib/projections/goalieStarterMixtures.test.ts lib/ml/featureLeakageRegistry.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [x] 17.0 Add expected rebounds, freezes, and richer rebound-control metrics
  - [x] 17.1 Extend rebound feature labels to distinguish rebound created, goalie freeze, covered puck, second chance allowed, and no-danger continuation where data supports it.
  - [x] 17.2 Define goalie-facing rebound-control aggregates separate from shooter shot-goal xG.
  - [x] 17.3 Train and approve rebound/freezing baselines only after label coverage is sufficient.
  - [x] 17.4 Persist player/team/goalie rebound-control outputs with model version and confidence.
  - [x] 17.5 Add QA checks for rebounds after posts/misses, empty-net events, delayed penalties, and rapid flurry sequences.

  Notes:
  - Extended rebound contexts and shot feature payloads with `reboundControlOutcome`, `createsSecondChanceAllowed`, `createsGoalieFreeze`, `createsCoveredPuck`, `createsNoDangerContinuation`, and `reboundOutcomeConfidence`.
  - Added `migrations/20260527_create_nhl_xg_rebound_control_tables.sql`, `web/lib/xg/reboundControl.ts`, and `/api/v1/db/update-nhl-xg-rebound-control`.
  - Expected rebounds use the approved `rebound_creation` prediction rows. Freeze/covered-puck outputs are persisted as label-only with `freeze_model_status='label_only_no_approved_model'`; no expected-freeze probability is emitted until a separate freeze artifact is trained and approved.
  - Team outputs track expected/actual rebounds for and against, goalie freezes, covered pucks, no-danger continuations, and rebound-source shots. Player outputs track expected/actual rebounds created. Goalie outputs track expected rebounds allowed, actual rebounds allowed, rebound-control saved above expected, freezes, covered pucks, and no-danger continuations allowed.
  - QA flags empty-net goalie exclusions, delayed-penalty rebound contexts, unapproved prediction rows, and missing team/shooter/goalie mappings.
  - Focused verification passed: `npx vitest --run lib/supabase/Upserts/nhlRebounds.test.ts lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts lib/xg/reboundControl.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [x] 18.0 Complete typed NHL EDGE feature contracts and model integration
  - [x] 18.1 Audit `update-nhl-edge-stats.ts`, `update-nhl-edge-teams.ts`, and `edgeIngestion.ts` for skater, goalie, team, and shot-location metric coverage.
  - [x] 18.2 Finalize typed EDGE table documentation and map every model-usable EDGE field to entity, grain, season, game type, and freshness semantics.
  - [x] 18.3 Add stable read helpers or views for latest and historical EDGE features.
  - [x] 18.4 Register EDGE features in the leakage registry with prospective-archive limitations clearly marked.
  - [x] 18.5 Add EDGE feature joins to the relevant trending/prediction model builders only after freshness and leakage rules are enforced.
  - [x] 18.6 Add tests for EDGE row parsing, missing percentile fields, unsupported endpoint families, and stale snapshot handling.

  Notes:
  - Existing EDGE ingestion covers raw archive rows plus typed skater, team, goalie, and skater shot-location leaderboard tables; the migration already includes latest analytics views for skater/team/goalie metrics.
  - Added `web/lib/NHL/edgeFeatureContract.ts` and `tasks/TASKS/three-pillars-analytics/nhl-edge/nhl-edge-feature-contract.md` to define model-usable EDGE entities, tables, grains, fields, `snapshot_date <= as_of_date` freshness rules, and latest-view/display boundaries.
  - Corrected the leakage registry to register the actual typed daily tables: `nhl_edge_skater_metrics_daily`, `nhl_edge_team_metrics_daily`, `nhl_edge_goalie_metrics_daily`, and `nhl_edge_skater_shot_location_leaders_daily`.
  - Model join plans now go through `assertFeatureLeakageUsage` and return required `season_id`, `game_type`, and `snapshot_date_lte` filters. Leaderboard rows remain display/ranking support, not model join inputs.
  - Added stale/future/missing snapshot freshness validation with a default 14-day maximum age.
  - Focused verification passed: `npx vitest --run lib/NHL/edgeFeatureContract.test.ts lib/NHL/edgeIngestion.test.ts lib/ml/featureLeakageRegistry.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [x] 19.0 Add xG/trending model outputs to `underlying-stats` web pages
  - [x] 19.1 Decide whether the first UI should extend the existing player stats page or add a dedicated player creation/xG tab under `web/pages/underlying-stats/playerStats`.
  - [x] 19.2 Add a read-only underlying-stats API or Supabase view for player xG creation summaries; do not call admin backfill/operator endpoints from the page.
  - [x] 19.3 Surface player metrics including `ixG`, shot-assist candidates, expected primary assists, controlled entries/exits, entry assists, transition-created shots, transition-created xG, and distinct `created_xg` once task 10 is complete.
  - [x] 19.4 Add team-level xG/transition metrics to the team stats page, including xGF, xGA, xG%, controlled entries/exits, failed exits, and transition-created xG.
  - [x] 19.5 Add sorting, formatting, loading, empty-state, and API error handling consistent with the existing underlying-stats tables.
  - [x] 19.6 Add focused API/query tests and a browser smoke test for the new underlying-stats page or tab.

  Notes:
  - Chose a dedicated lab route first: `/underlying-stats/xg`. The production player, goalie, and team drill-ins remain untouched until the xG output is reviewed and tuned.
  - Added read-only API `/api/v1/underlying-stats/xg`, which resolves latest xG/rebound model versions when query params are omitted and never calls backfill/operator endpoints.
  - Added `web/lib/underlying-stats/xgExplorer.ts` to merge rolling xG aggregates with created-xG, transition, and rebound-control supplemental rows for player/team/goalie views.
  - The lab page exposes player, team, and goalie scopes with season/window/limit/model controls, loading/error/empty states, metadata chips, and compact sortable-by-contract server output.
  - Current smoke result on `http://localhost:3001`: page returns `200`; API returns `200` with an empty-state note when rolling aggregate rows have not been built yet.
  - Focused verification passed: `npx vitest --run lib/underlying-stats/xgExplorer.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.
  - Browser smoke was completed through the in-app browser against the existing local dev server on port `3000`.
  - Follow-up QA needed: after supplemental migrations/backfills, full-season 20252026 only produced `158` shot-assist candidate rows and `570` created-xG rolling rows. The lab now shows non-zero supplemental rows, but the creator metrics are too sparse for production confidence without investigating the public-PBP proxy contract.
  - Added focused page/query coverage in `web/__tests__/pages/underlying-stats/xg/index.test.tsx` to verify the lab uses `/api/v1/underlying-stats/xg` and never calls `/api/v1/db/*` from scope controls.
  - Final verification passed: `npx vitest --run __tests__/pages/underlying-stats/xg/index.test.tsx lib/underlying-stats/xgExplorer.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.
  - Browser smoke on `http://localhost:3000/underlying-stats/xg` passed: page title and scope controls rendered, API settled to the empty state with `Rows=0` and `Source Rows=0`, and browser console errors were empty.

- [x] 20.0 QA and improve sparse xG creator/transition supplemental coverage
  - [x] 20.1 Audit why `update-nhl-xg-shot-assists` only produced `158` candidate rows from `118610` feature/prediction rows.
  - [x] 20.2 Audit why created-xG only produced `190` player-game rows and `570` rolling rows for 20252026.
  - [x] 20.3 Decide whether the shot-assist contract should use additional PBP fields, shift context, on-ice skater context, or another source before promoting created-xG to production pages.
  - [x] 20.4 Add coverage QA thresholds so the xG lab flags sparse supplemental output instead of making zeros look authoritative.

  Notes:
  - Shot-assist funnel audit for `20252026`, feature version `1`, model `logistic_l2-s20252026-p1-st1-f1-cfg9bac2706`: `118610` endpoint feature inputs, `106628` non-rebound rows, `60869` previous same-team rows, `60308` positive previous-time rows, `22571` same-team rows within `8` seconds, and only `4265` rows after excluding faceoff/shot/rebound/giveaway/stoppage/penalty source types. Persisted candidates remain `158`.
  - The dominant same-team-within-8 previous event types are faceoffs (`9023`), shots/misses/blocks (`8731` combined), hits (`2285`), takeaways (`1980`), and giveaways (`552`). The current contract only allows hits and takeaways, then actor/team/self-credit checks reduce candidates further.
  - Created-xG sparsity is expected from source coverage: `158` shot-assist rows plus `191` creator transition rows produce `190` player-game created-xG rows and `570` rolling rows for the three configured windows.
  - Transition table coverage is broader (`10847` rows), but most rows are `transition_created_shot` (`7611`) or `failed_exit_against_proxy` (`3045`); distinct creator credit intentionally uses only `controlled_entry_proxy`, `controlled_exit_proxy`, and `entry_assist_proxy`.
  - Decision: do not promote created-xG zeros into production player/team/goalie pages yet. Treat public-PBP creator metrics as sparse proxy coverage until a richer source is added, likely PBP replay URL tracking where available plus on-ice/shift context and more explicit possession-chain attribution.
  - Added xG lab coverage QA: API responses now include a `coverage` report and warning notes when supplemental created/transition/rebound rows are sparse relative to core rolling xG rows, and the lab page renders those warnings visibly.
  - Focused verification passed: `npx vitest --run lib/underlying-stats/xgExplorer.test.ts __tests__/pages/underlying-stats/xg/index.test.tsx`; full `npx tsc --noEmit --pretty false --incremental false` passed. A live `localhost:3000` API smoke request timed out while fetching full-season paginated source rows, so response-time optimization remains a follow-up before production use.

- [x] 21.0 Add controlled NHL `pptReplayUrl` tracking ingestion and coverage audit
  - [x] 21.1 Audit NHL gamecenter PBP across target seasons to count `pptReplayUrl` coverage by season, game, event type, and game state.
  - [x] 21.2 Create a controlled ingestion path that discovers `pptReplayUrl` only from NHL PBP rather than blind event-ID probing.
  - [x] 21.3 Fetch discovered public replay URLs with normal NHL referer/user-agent headers and store raw JSON plus fetch status/provenance.
  - [x] 21.4 Normalize replay frames into typed player/puck tracking rows with game ID, event ID, frame index, timestamp, player ID, team ID, x/y coordinates, and puck marker.
  - [x] 21.5 Add an audit endpoint/report showing replay coverage by season/game/event type, including whether any non-goal events expose replay URLs.
  - [x] 21.6 Document the limitation that current evidence points to goal-replay sprite frames, not full-game or all-event tracking, until coverage audits prove otherwise.

  Notes:
  - Live NHL PBP samples confirm `pptReplayUrl` is a top-level play field. Sampled games `2025030314`, `2024020096`, and `2023020001` exposed replay URLs only on `goal` events.
  - Added controlled discovery in `web/lib/NHL/pptReplayCoverage.ts`; it only reads explicit `pptReplayUrl` fields already present in NHL gamecenter PBP and does not guess/probe `ev*.json` URLs.
  - Added `/api/v1/db/audit-nhl-ppt-replay-coverage` for selected `gameIds` or bounded game ranges. Smoke test for `gameIds=2025030314,2024020096` processed `2` games, `718` total plays, `13` replay events, `13` goal replay events, and `0` non-goal replay events.
  - Added `migrations/20260530_create_nhl_ppt_replay_tracking_tables.sql` for raw replay payload rows and normalized frame/object rows. Non-dry persistence requires applying this migration before running the update endpoint.
  - Added `/api/v1/db/update-nhl-ppt-replay-tracking`, which discovers replay URLs from PBP, fetches only those exact URLs with NHL referer/user-agent headers, stores fetch status/provenance, and normalizes frame rows with `frame_index`, `frame_timestamp`, `tracking_object_id`, `player_id`, `team_id`, `x`, `y`, and `is_puck`.
  - Replay payload shape check for `https://wsr.nhle.com/sprites/20252026/2025030314/ev428.json`: top-level array, `140` frames, each frame has `timeStamp` plus `onIce` keyed by tracking object ID; the puck appears as a blank-player/team object and is normalized with `is_puck=true`.
  - Dry-run smoke test for `/api/v1/db/update-nhl-ppt-replay-tracking?gameIds=2025030314&limit=1&dryRun=true`: `4` discovered/fetched payload rows, `0` failed payload rows, and `7428` normalized frame rows.
  - Supabase JSON-path ad hoc counting against `nhl_api_pbp_events.raw_event->pptReplayUrl` hit a statement timeout, so the repeatable coverage path should use bounded game selection plus NHL PBP payload discovery unless/until a typed replay URL column/table exists.
  - Current limitation: every observed replay URL is a goal replay sprite, not full-game/all-event tracking. The ingestion contract preserves non-goal accounting if NHL exposes future non-goal URLs, but current evidence should not be treated as complete tracking coverage.
  - Focused verification passed: `npx vitest --run lib/NHL/pptReplayCoverage.test.ts lib/NHL/pptReplayIngestion.test.ts lib/underlying-stats/xgExplorer.test.ts __tests__/pages/underlying-stats/xg/index.test.tsx`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [x] 22.0 Optimize the xG lab API for interactive response times
  - [x] 22.1 Avoid fetching every full-season rolling/source row when the page only needs the latest row per entity and a limited display set.
  - [x] 22.2 Preserve complete paginated coverage counts or coverage QA through separate count/aggregate queries so the lab can still warn about sparse supplemental output.
  - [x] 22.3 Add an API smoke/performance check that verifies `/api/v1/underlying-stats/xg` returns within an acceptable local timeout for player, team, and goalie scopes.

  Notes:
  - `/api/v1/underlying-stats/xg` now uses bounded interactive preview reads (`1000` recent source rows for the default `limit=5`) instead of paging every full-season source/supplemental table before slicing display rows.
  - Full-table coverage counts are preserved through separate exact count queries for core rolling rows and supplemental created/transition/rebound rows. The coverage warning still uses full counts, not just preview rows.
  - Fixed player created-xG merge behavior so the latest created-xG rolling row per player wins instead of an older row overwriting it.
  - Local API smoke checks with `curl --max-time 30` passed for `scope=players`, `scope=teams`, and `scope=goalies`. Player response returned `rows=5`, `sourceRows=42236`, `supplementalRows=7274`, and the sparse created-xG warning. Team response returned `rows=5`, `sourceRows=2772`, `supplementalRows=2594`. Goalie response returned `rows=5`, `sourceRows=2922`, `supplementalRows=0`, and the no-supplemental warning.
  - Focused verification passed: `npx vitest --run lib/underlying-stats/xgExplorer.test.ts __tests__/pages/underlying-stats/xg/index.test.tsx`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [ ] 23.0 Apply Deep Research xG hardening recommendations
  - [x] 23.1 Enforce artifact-feature manifest parity at scoring time: required selected features, encoded feature count, categorical vocabulary coverage, and fail-closed missing scoring payload keys.
  - [x] 23.2 Persist training-time enrichment fields into `nhl_xg_shot_features`: shooter position/group, shooter handedness, goalie catch hand, shooter/goalie handedness matchup, deployment buckets, forward/defense counts, and matchup buckets.
  - [x] 23.3 Add artifact feature-coverage and null-rate gates to model approval, including training null rates, allowed scoring drift, categorical unknown rates, and explicit missingness policy.
  - [x] 23.4 Add a first-class xG model registry table with artifact checksum, feature manifest hash, calibration fingerprint, training/validation/test date ranges, approval status, deployment alias, and active/champion flags.
  - [x] 23.5 Add multi-season training and true out-of-time validation with chronological outer holdouts plus grouped-by-game inner validation.
  - [ ] 23.6 Add rink/arena, playoff, strength-state, and score-state calibration audits.
  - [ ] 23.7 Build separate internal benchmark surfaces for all-situations unblocked xG and 5v5 non-empty-net unblocked xG.
  - [ ] 23.8 Investigate NST/MoneyPuck/Evolving-Hockey taxonomy deltas before treating external xG disagreement as model failure.
  - [ ] 23.9 Train calibrated challenger models under the same frozen contract: LightGBM, CatBoost, XGBoost, and state-partitioned variants.
  - [ ] 23.10 Add flurry-adjusted xG as a parallel aggregate surface while retaining raw xG.
  - [ ] 23.11 Separate baseline shot quality from lagged shooter-finishing and goalie-save residual skill layers.
  - [ ] 23.12 Expand rebound modeling into separate rebound creation, rebound danger, goalie freeze/control, and second-chance xG heads.
  - [ ] 23.13 Continue controlled NHL replay/tracking audits and use real tracking only after stable event-to-frame alignment is proven.
  - [ ] 23.14 Add database-backed advisory locks or queue-backed execution for long-running xG backfills, prediction scoring, and aggregate builds.
  - [ ] 23.15 Add an xG operations dashboard for feature null-rate drift, prediction coverage, calibration drift, aggregate reconciliation, and artifact-contract mismatches.

  Notes:
  - Added artifact feature-contract auditing in `web/lib/xg/shotFeaturePersistence.ts`. The audit now verifies duplicate selected features, categorical level availability, `featureKeys` length, model feature count, and selected-feature presence in scoring payloads.
  - `encodeFeatureVector` now fails closed when a persisted scoring payload is missing a selected model feature instead of silently imputing an absent key to zero.
  - `/api/v1/db/update-nhl-xg-shot-predictions?action=health` now returns `featureContract` status, and scoring requests reject artifacts whose static feature contract is invalid before starting a backfill.
  - Prediction row building now audits each scoring batch before writing rows, so feature-payload contract violations stop the run before corrupted predictions are upserted.
  - Current approved shot-goal artifact audit passed locally: `encodedFeatureCount=72`, selected counts `numeric=13`, `boolean=8`, `categorical=6`, no issues. A 10-row persisted feature sample for 20252026 also passed.
  - Focused verification passed: `npx vitest --run lib/xg/shotFeaturePersistence.test.ts`; full TypeScript verification passed: `npx tsc --noEmit --pretty false --incremental false`.
  - Added `web/lib/xg/shotFeatureEnrichment.ts` to move training-time enrichment into the persisted feature build path. It fetches shooter handedness from `player_stats_unified`, goalie catch hand from `goalie_stats_unified`, roster positions from `players`, and deployment buckets/counts from `nhl_api_shift_rows` stints.
  - `/api/v1/db/update-nhl-xg-shot-features` now enriches built shot rows before upsert so `feature_payload` includes shooter position/group, defenseman shooter flag, shooter hand, goalie catch hand, shooter-goalie hand matchup, on-ice forward/defense counts, goalie-on-ice flags, deployment buckets, and role matchup bucket.
  - Added `migrations/20260601_add_nhl_xg_shot_feature_enrichment_columns.sql` so those fields are also queryable as typed `nhl_xg_shot_features` columns. Apply this migration before running the updated feature backfill endpoint against Supabase.
  - Added `web/lib/xg/shotFeatureEnrichment.test.ts`. Focused verification passed: `npx vitest --run lib/xg/shotFeatureEnrichment.test.ts lib/xg/shotFeaturePersistence.test.ts lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts lib/xg/deploymentContext.test.ts`; full TypeScript verification passed: `npx tsc --noEmit --pretty false --incremental false`.
  - Local non-upsert smoke for game `2025020001` built `119` rows; roster position and deployment bucket populated on all `119`, shooter handedness on `63`, goalie catch hand on `82`.
  - Added `web/lib/xg/featureCoverage.ts` to build selected-feature coverage profiles with explicit missingness policy: missing keys fail, numeric nulls encode as zero, boolean nulls encode as false, categorical nulls encode as all-zero, scoring drift checks require at least `1000` rows, max null-rate drift defaults to `0.25`, and max categorical unknown-level rate defaults to `0.05`.
  - New model and dataset artifacts generated by `web/scripts/train-nhl-xg-baseline.ts` now include `featureCoverage`. Approval-grade eligibility now includes coverage blocking reasons, so selected features that are absent or entirely unpopulated in training rows cannot produce an approved artifact.
  - Prediction artifact health now returns `featureCoverage` summary when present. Scoring-batch audits compare large scoring samples against training coverage and block large null-rate drift or categorical unknown-rate drift when an artifact declares a coverage profile. Legacy artifacts without `featureCoverage` remain backward-compatible.
  - Current approved legacy shot-goal artifact still passes static contract audit locally; it has no coverage profile because it was generated before this gate.
  - Focused verification passed: `npx vitest --run lib/xg/featureCoverage.test.ts scripts/train-nhl-xg-baseline.test.ts lib/xg/shotFeaturePersistence.test.ts`; full TypeScript verification passed: `npx tsc --noEmit --pretty false --incremental false`.
  - Added `migrations/20260601_create_nhl_xg_model_registry.sql` for `nhl_xg_model_registry`. The table stores model version, prediction type, artifact checksum, feature-manifest hash, calibration fingerprint, split date ranges, split counts, approval status, deployment alias, active flag, champion flag, and artifact metadata. Apply this migration before calling the registry endpoint.
  - Added `web/lib/xg/modelRegistry.ts` and `web/lib/xg/modelRegistry.test.ts` to build deterministic registry rows from model artifacts, hash artifact files, fingerprint feature/calibration contracts, and upsert registry rows while deactivating prior active/champion rows for the same prediction type/alias.
  - Added `/api/v1/db/register-nhl-xg-model`. It loads `modelArtifactPath` or `NHL_XG_MODEL_ARTIFACT_PATH`, verifies the artifact feature contract, and upserts the registry row. Optional query params: `deploymentAlias`, `active=true`, `champion=true`, and `approvalStatus=candidate|approved|rejected|retired`.
  - Updated new training artifacts to include `splitDateRanges` for train/validation/test. Legacy artifacts can still register, but split date columns will be null if the artifact predates this metadata.
  - Local registry-row smoke for the current approved artifact produced checksum `1e56fba527b0fb51def027de9836228a092af99b7c17b8d57f7ad9e48200272a`, feature-manifest hash `3ac7a98e4d38f9f0de9c42c65d7a6956e9dff81939012b0f3939610cb67fc211`, calibration fingerprint `7779954dfb505b771fce269339ddc9ca707269fbb7b7f895071cebf01237016a`, approval status `approved`, and split counts `82636/17829/17834`.
  - Focused verification passed: `npx vitest --run lib/xg/modelRegistry.test.ts scripts/train-nhl-xg-baseline.test.ts lib/xg/featureCoverage.test.ts lib/xg/shotFeaturePersistence.test.ts`; full TypeScript verification passed: `npx tsc --noEmit --pretty false --incremental false`.
  - Added multi-season trainer flags to `web/scripts/train-nhl-xg-baseline.ts`: `--seasons 20232024,20242025,20252026` and optional `--testSeasons 20252026`.
  - When `--testSeasons` is supplied, all games from those seasons are assigned to the dedicated `test` split as a true out-of-time outer holdout. Remaining games are assigned by whole game to train/validation using chronological order, so same-game shots cannot cross splits.
  - Artifact tags and config signatures now include the season scope and out-of-time test-season scope. New artifacts carry `seasonScopes` and train/validation/test `splitDateRanges`; legacy `seasonScope` is preserved for single-season artifacts.
  - `buildEncodedBaselineDataset` now accepts explicit game-level split assignments, which keeps split ownership centralized while allowing external split policies such as out-of-time seasons.
  - Example multi-season command: `DOTENV_CONFIG_PATH=.env.local NODE_PATH=. ./node_modules/.bin/ts-node -r dotenv/config --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/train-nhl-xg-baseline.ts --seasons 20232024,20242025,20252026 --testSeasons 20252026 --family logistic_l2 --featureFamily expanded_v2 --predictionType shot_goal`.
  - Local Supabase only currently has normalized xG PBP rows for `20252026`, so full live multi-season training could not be smoke-run against local data yet. The split policy itself is covered by tests.
  - Focused verification passed: `npx vitest --run lib/xg/baselineDataset.test.ts scripts/train-nhl-xg-baseline.test.ts lib/xg/modelRegistry.test.ts`; full TypeScript verification passed: `npx tsc --noEmit --pretty false --incremental false`.
