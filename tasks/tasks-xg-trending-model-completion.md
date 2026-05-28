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
- `web/lib/game-predictions/featureBuilder.ts` - Game-level feature builder where travel, timezone, fatigue, leakage registry, and EDGE features may feed prediction models.
- `web/lib/game-predictions/featureSources.ts` - Existing feature-source metadata that may become part of the leakage/source-safety registry.
- `web/lib/ml/featureLeakageRegistry.ts` - Global feature/source safety registry and validation helpers for model builders.
- `web/lib/ml/featureLeakageRegistry.test.ts` - Tests for pregame safety, freshness warnings, postgame/target leakage rejection, and fail-closed unknown sources.
- `web/pages/api/v1/db/update-nhl-edge-stats.ts` - NHL EDGE ingestion endpoint for typed skater/team/goalie metric tables.
- `web/pages/api/v1/db/update-nhl-edge-teams.ts` - Team-focused NHL EDGE ingestion endpoint.
- `web/lib/NHL/edgeIngestion.ts` - NHL EDGE row builders and typed metric extraction.
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
- `web/pages/underlying-stats/playerStats/index.tsx` - Candidate UI surface for player-level xG creation, shot-assist, and transition metrics.
- `web/pages/underlying-stats/teamStats/index.tsx` - Candidate UI surface for team-level xGF/xGA and transition metrics.
- `web/pages/api/v1/underlying-stats/players.ts` - Existing player underlying-stats API that may be extended or joined with xG creation summaries.
- `web/pages/api/v1/underlying-stats/teams.ts` - Existing team underlying-stats API that may be extended or joined with xG aggregate summaries.
- `web/components/underlying-stats/PlayerStatsTable.tsx` - Existing table component that supports adding extra player-stat columns.
- `web/components/underlying-stats/playerStatsColumns.ts` - Existing player-stat column definitions where xG creation fields can be grouped.
- `web/rules/context/cron-schedule.md` - Cron documentation and placement for xG feature/prediction refresh jobs.
- `tasks/xg-training-feature-contract.md` - Current xG feature contract and leakage-exclusion reference.
- `tasks/xg-training-dataset-contract.md` - Current xG training-row, label, split, and rebound-creation target contract.
- `tasks/feature-leakage-registry.md` - Documentation for registry categories and onboarding requirements for new model features.

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
- Daily xG cron SQL is documented in `web/rules/context/cron-schedule.md` at 09:51 UTC for `update-nhl-xg-shot-features` and 09:52 UTC for `update-nhl-xg-shot-predictions`. The prediction cron relies on `NHL_XG_MODEL_ARTIFACT_PATH` in production.
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
  - [x] 4.4 Add both jobs to the correct chronological section in `web/rules/context/cron-schedule.md`.
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
  - Added `tasks/feature-leakage-registry.md` documenting category semantics and the requirement that new model features be registered before use.
  - Focused verification passed: `npx vitest --run lib/ml/featureLeakageRegistry.test.ts`; full `npx tsc --noEmit --pretty false --incremental false` passed.

- [ ] 16.0 Add first-class goalie starter mixture distributions
  - [ ] 16.1 Audit current starter scenario metadata and Twitter feed ingestion for probability, source, and freshness signals.
  - [ ] 16.2 Persist starter probability distributions by game/team/goalie with source confidence and as-of timestamp.
  - [ ] 16.3 Update goalie and game projections to consume scenario-weighted starter distributions instead of a single thin starter estimate when status is uncertain.
  - [ ] 16.4 Store branch-level projection outputs for likely starters and aggregate them into scenario-weighted slate outputs.
  - [ ] 16.5 Add tests for confirmed starters, ambiguous starters, stale confirmations, back-to-back goalie usage, and manual overrides.

- [ ] 17.0 Add expected rebounds, freezes, and richer rebound-control metrics
  - [ ] 17.1 Extend rebound feature labels to distinguish rebound created, goalie freeze, covered puck, second chance allowed, and no-danger continuation where data supports it.
  - [ ] 17.2 Define goalie-facing rebound-control aggregates separate from shooter shot-goal xG.
  - [ ] 17.3 Train and approve rebound/freezing baselines only after label coverage is sufficient.
  - [ ] 17.4 Persist player/team/goalie rebound-control outputs with model version and confidence.
  - [ ] 17.5 Add QA checks for rebounds after posts/misses, empty-net events, delayed penalties, and rapid flurry sequences.

- [ ] 18.0 Complete typed NHL EDGE feature contracts and model integration
  - [ ] 18.1 Audit `update-nhl-edge-stats.ts`, `update-nhl-edge-teams.ts`, and `edgeIngestion.ts` for skater, goalie, team, and shot-location metric coverage.
  - [ ] 18.2 Finalize typed EDGE table documentation and map every model-usable EDGE field to entity, grain, season, game type, and freshness semantics.
  - [ ] 18.3 Add stable read helpers or views for latest and historical EDGE features.
  - [ ] 18.4 Register EDGE features in the leakage registry with prospective-archive limitations clearly marked.
  - [ ] 18.5 Add EDGE feature joins to the relevant trending/prediction model builders only after freshness and leakage rules are enforced.
  - [ ] 18.6 Add tests for EDGE row parsing, missing percentile fields, unsupported endpoint families, and stale snapshot handling.

- [ ] 19.0 Add xG/trending model outputs to `underlying-stats` web pages
  - [ ] 19.1 Decide whether the first UI should extend the existing player stats page or add a dedicated player creation/xG tab under `web/pages/underlying-stats/playerStats`.
  - [ ] 19.2 Add a read-only underlying-stats API or Supabase view for player xG creation summaries; do not call admin backfill/operator endpoints from the page.
  - [ ] 19.3 Surface player metrics including `ixG`, shot-assist candidates, expected primary assists, controlled entries/exits, entry assists, transition-created shots, transition-created xG, and distinct `created_xg` once task 10 is complete.
  - [ ] 19.4 Add team-level xG/transition metrics to the team stats page, including xGF, xGA, xG%, controlled entries/exits, failed exits, and transition-created xG.
  - [ ] 19.5 Add sorting, formatting, loading, empty-state, and API error handling consistent with the existing underlying-stats tables.
  - [ ] 19.6 Add focused API/query tests and a browser smoke test for the new underlying-stats page or tab.
