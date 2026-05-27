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
- `web/pages/api/v1/db/update-nhl-edge-stats.ts` - NHL EDGE ingestion endpoint for typed skater/team/goalie metric tables.
- `web/pages/api/v1/db/update-nhl-edge-teams.ts` - Team-focused NHL EDGE ingestion endpoint.
- `web/lib/NHL/edgeIngestion.ts` - NHL EDGE row builders and typed metric extraction.
- `web/rules/context/cron-schedule.md` - Cron documentation and placement for xG feature/prediction refresh jobs.
- `tasks/xg-training-feature-contract.md` - Current xG feature contract and leakage-exclusion reference.
- `tasks/xg-training-dataset-contract.md` - Current xG training-row, label, split, and rebound-creation target contract.

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

- [ ] 5.0 Build and approve the separate `rebound_creation` model
  - [x] 5.1 Define the rebound-creation label precisely, including time window, same-possession requirement, blocked-shot treatment, and goalie-freeze exclusions.
  - [ ] 5.2 Extend the training dataset builder to support `predictionType=rebound_creation` without changing the approved shot-goal contract.
  - [ ] 5.3 Train a baseline rebound model with real train/validation/test splits and enough positive examples.
  - [ ] 5.4 Add rebound-specific approval gates for sample size, calibration, positive-rate stability, and holdout performance.
  - [ ] 5.5 Store a distinct approved rebound artifact and require it when the prediction endpoint receives `predictionType=rebound_creation`.
  - [ ] 5.6 Add tests proving shot-goal artifacts cannot score rebound-creation rows.

- [ ] 6.0 Wire xG predictions into team, player, and goalie aggregates
  - [ ] 6.1 Define aggregate grains for team game, team rolling window, player game, player rolling window, goalie game, and goalie rolling window.
  - [ ] 6.2 Create or extend persisted aggregate tables/views for team `xGF/xGA`, player `ixG`, goalie `xGA`, and goalie saved-goals style metrics.
  - [ ] 6.3 Add aggregation logic that consumes only approved `shot_goal` prediction rows by model version.
  - [ ] 6.4 Add provenance fields that preserve source model version, feature version, aggregation window, and refresh timestamp.
  - [ ] 6.5 Update downstream readers to prefer in-house xG aggregates where the contract is complete.

- [ ] 7.0 Add aggregate QA and reconciliation checks
  - [ ] 7.1 Verify team `xGF` equals the sum of owned shot xG and team `xGA` equals the opponent-owned shot xG for the same games.
  - [ ] 7.2 Verify player `ixG` sums reconcile to team owned xG except for unmapped shooter rows.
  - [ ] 7.3 Verify goalie `xGA` reconciles to shot rows with `goalie_in_net_id` and flags empty-net exclusions separately.
  - [ ] 7.4 Add drift checks comparing in-house xG distributions to prior artifact baselines and existing NST/WGO xG surfaces where available.
  - [ ] 7.5 Add a small admin/report endpoint or SQL view that lists missing rows, unmapped players, empty-net exclusions, and reconciliation deltas.

- [ ] 8.0 Add shot assists, primary shot assists, and expected primary assists
  - [ ] 8.1 Audit current PBP and possession-chain fields to determine what can be inferred reliably without puck-tracking pass events.
  - [ ] 8.2 Define heuristic shot-assist attribution rules using previous same-team controlled events, timing, zone, coordinates, and possession-chain continuity.
  - [ ] 8.3 Persist shot-assist candidate rows with confidence/provenance rather than treating inferred assists as official facts.
  - [ ] 8.4 Add `expected_primary_assists` by assigning shot xG credit to the inferred primary shot-assist player.
  - [ ] 8.5 Add tests covering false positives after faceoffs, rebounds, turnovers, blocked/missed events, and line changes.

- [ ] 9.0 Add entry assists, controlled entries/exits, and transition metrics
  - [ ] 9.1 Audit whether NHL PBP coordinates, event order, and possession chains are sufficient for a first-pass transition proxy.
  - [ ] 9.2 Define controlled-entry, dump-in, controlled-exit, failed-exit, and entry-assist heuristics with explicit confidence tiers.
  - [ ] 9.3 Persist typed transition events or features with source event IDs and provenance.
  - [ ] 9.4 Add player and team aggregates for controlled entries, controlled exits, entry assists, and transition-created shots/xG.
  - [ ] 9.5 Add tests for neutral-zone turnovers, offensive-zone faceoffs, rush shots, and ambiguous coordinate sequences.

- [ ] 10.0 Create a distinct `created_xg` metric
  - [ ] 10.1 Define `created_xg` separately from shooter `ixG`, likely as shot-assist xG plus transition-created xG and selected rebound-creation credit.
  - [ ] 10.2 Persist player-game and rolling-window `created_xg` outputs with component breakdowns.
  - [ ] 10.3 Ensure `created_xg` does not double-count the shooter's own `ixG` unless explicitly configured.
  - [ ] 10.4 Add reconciliation checks comparing `created_xg` components to underlying shot and assist candidate rows.

- [ ] 11.0 Add RAPM or adjusted player impact modeling
  - [ ] 11.1 Define the first target family for adjusted impact, such as xG differential, shot differential, goal differential, or multi-target variants.
  - [ ] 11.2 Build stint or shift-level design matrices with teammate, opponent, zone, score, home, rest, and manpower context.
  - [ ] 11.3 Fit a regularized baseline model before attempting more complex adjusted-impact methods.
  - [ ] 11.4 Persist player impact outputs with model version, target family, shrinkage settings, and uncertainty.
  - [ ] 11.5 Add temporal validation and leakage checks to prevent same-game target leakage.

- [ ] 12.0 Add first-class QoT/QoC features
  - [ ] 12.1 Audit `shift-charts.ts`, `update-shifts.ts`, `update-lines-ccc.ts`, `update-line-combinations`, `update-line-sources.ts`, and `update-lineup-source-provenance.ts` for usable teammate/opponent deployment inputs.
  - [ ] 12.2 Audit `twitterEmbeds` and `tweet-pattern-review.ts` for pregame lineup, goalie-start, and injury signals that can affect expected teammate/opponent quality.
  - [ ] 12.3 Define offensive and defensive player percentile scores by role/position and similar TOI buckets.
  - [ ] 12.4 Persist QoT/QoC features by player-game, line/pair, and rolling window with source and freshness metadata.
  - [ ] 12.5 Separate pregame-safe QoT/QoC from postgame-descriptive QoT/QoC in the leakage registry.
  - [ ] 12.6 Add tests for traded players, partial games, missing shifts, and stale lineup sources.

- [ ] 13.0 Add typed travel, timezone, circadian, road-trip, and fatigue features
  - [ ] 13.1 Build schedule-derived home/away, previous game, next game, back-to-back, three-in-four, and road-trip sequence features.
  - [ ] 13.2 Infer venue/team timezones and local puck-drop times for circadian and body-clock deltas.
  - [ ] 13.3 Persist travel/fatigue features by team-game and expose player-level inherited features where appropriate.
  - [ ] 13.4 Add clear handling for neutral-site games, missing venue data, daylight-saving transitions, and playoff schedule anomalies.
  - [ ] 13.5 Add tests for home/away identification, timezone inference, and road-trip sequence boundaries.

- [ ] 14.0 Improve injury severity, body-region, and return-limitation data
  - [ ] 14.1 Audit current Twitter feed ingestion, ESPN endpoints, and `injuryStatusIngestion.ts` for fields and phrasing that can support severity/body-region inference.
  - [ ] 14.2 Extend normalized injury states with optional severity tier, body region, expected return window, practice participation, and limitation notes.
  - [ ] 14.3 Store source provenance and confidence for each inferred injury attribute.
  - [ ] 14.4 Add regex/classifier coverage for common NHL phrases such as day-to-day, week-to-week, game-time decision, maintenance, no-contact, and ruled out.
  - [ ] 14.5 Add tests that prevent transaction-only or lineup-only tweets from becoming injury-severity updates.

- [ ] 15.0 Create a global feature-leakage registry
  - [ ] 15.1 Define registry categories: pregame-safe, pregame-safe-with-freshness, in-game-only, postgame-descriptive, target-leakage, and unknown.
  - [ ] 15.2 Register xG features, team/game prediction features, lineup features, goalie starter features, injury features, EDGE features, and aggregate features.
  - [ ] 15.3 Add helper APIs that model builders can call to reject forbidden feature categories for a given training or inference mode.
  - [ ] 15.4 Add tests proving known unsafe features cannot enter pregame model matrices.
  - [ ] 15.5 Document how new features must be registered before being consumed by prediction or trending models.

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
