# PRD: NHL Game Prediction Model and Analytics Platform

## 1. Introduction / Overview

This feature is a full NHL prediction platform for the website. It will generate pregame NHL game predictions, explain the key factors behind each prediction, track model performance over time, and support future player and goalie projection layers.

The core problem this feature solves is that NHL prediction content is difficult to make trustworthy unless the site can do four things consistently:

1. Collect reliable pregame data before each NHL game.
2. Produce probability-based predictions instead of binary guesses.
3. Store predictions before the game starts so performance can be measured honestly later.
4. Improve the model over time through retraining, evaluation, and model versioning.

The platform should use the NHL public API plus the statistics already available in the existing Supabase database. The first production version should prioritize a reliable game prediction pipeline, a detailed public analytics page, and a measurable model feedback loop. Player and goalie predictions are in scope, but they should be implemented in a lightweight, non-blocking way at first. The game prediction model must still work when player-level or confirmed goalie data is incomplete.

This PRD intentionally avoids treating every research article, PDF, or GitHub repo as equally correct. The product should support comparison between approaches, preserve a baseline model, and promote better models only when they show measurable improvement on held-out historical games.

### Schema-aligned direction

The existing Supabase schema changes the implementation direction: v1 should reuse the current hockey data contracts rather than create a parallel prediction warehouse.

Primary existing tables and views to reuse:

- Identity and schedule: `games`, `teams`, `players`, `seasons`
- Team features: `team_power_ratings_daily`, `nst_team_gamelogs_as_counts`, `nst_team_gamelogs_as_rates`, `nst_team_gamelogs_pp_counts`, `nst_team_gamelogs_pp_rates`, `nst_team_gamelogs_pk_counts`, `nst_team_gamelogs_pk_rates`, `nst_team_5v5`, `nst_team_all`, `nst_team_pp`, `nst_team_pk`, `wgo_team_stats`, `nhl_standings_details`
- Goalie features: `goalie_start_projections`, `wgo_goalie_stats`, `wgo_goalie_stats_totals`, `vw_goalie_stats_unified`, and NST goalie gamelog all/5v5/EV/PP/PK count and rate tables
- Optional lineup/player context: `lineCombinations`, `lines_nhl`, `lines_dfo`, `lines_gdl`, `lines_ccc`, `forge_roster_events`, `forge_player_projections`, `forge_goalie_projections`, `forge_team_projections`
- Prediction and provenance contracts: `game_prediction_outputs`, `player_prediction_outputs`, `forge_runs`, `source_provenance_snapshots`

The first implementation should create only the missing glue needed for game-prediction history, feature snapshots, model metrics, and job status. In particular, `game_prediction_outputs` is the preferred serving/output contract, but it may need an append-only companion table or a primary-key extension before it can honestly preserve multiple same-day pregame predictions for the same game/model.

Do not use latest-only display views, such as `nhl_team_data`, as historical training inputs. Historical feature generation must join dated source rows as-of the prediction timestamp.

Storage audit results confirm this direction. `game_prediction_outputs` and `player_prediction_outputs` have the expected output fields, JSON payloads, timestamps, and probability-shape checks, but their current keys do not include `computed_at`, a generated prediction ID, a feature snapshot ID, or a run ID. Treat them as latest/serving tables until append-only prediction history and immutable feature snapshots are added. `forge_runs` can carry run status and coarse metrics, but its latest audited `as_of_date` is 2026-04-16 and many rows have no `git_sha`, so game-model metrics still need explicit model/version/feature-set segmentation. `source_provenance_snapshots` has useful source/freshness fields, but audited rows include null and expired freshness timestamps; it should be expanded and freshness-gated before it becomes the sole provenance authority.

Live Supabase audit results add several source-use rules for v1. Treat `nst_team_5v5`, `nst_team_all`, `nst_team_pp`, and `nst_team_pk` as cumulative/snapshot sources rather than one-game logs; use `nst_team_gamelogs_*` tables for rolling game-window features. Do not treat stale NST rows as current: the audited gamelog tables currently end on 2026-04-11 and the snapshot tables on 2026-03-21, while `team_power_ratings_daily` continues through 2026-04-27. Avoid direct use of stored PP/PK `xgf_pct` until its special-teams semantics are confirmed; recompute percentages from vetted numerator/denominator fields or use raw/rate fields instead.

Representative row-level checks passed for schedule required fields and duplicate natural keys across the primary planned sources. Remaining quality work is filtering or clipping recent WGO/goalie outliers, excluding or classifying non-one-game NST gamelog rows, and handling the 56 audited 2025-10-01+ game/team sides that do not have a recent team-power or standings row within the 14-day lookback used by the audit.

As-of/leakage checks confirm that historical training must use stricter cutoffs than current display logic. `nhl_team_data` exists but is not a planned training source and should stay excluded. Team features should prefer rows dated before the game date; the audit found 88 game/team sides missing pregame `team_power_ratings_daily`/WGO rows and 32 sides where team power was same-day-only. Most current `goalie_start_projections` rows were created after scheduled puck drop, so they are useful for current predictions but not historical training unless a pregame snapshot/backfill is created. `lineCombinations` lacks an observation timestamp, some line-source rows are observed after start time, and FORGE projections use date-level `as_of_date` values that are usually on or after game date; all of these must be optional or conservatively excluded from historical training until pregame-safe provenance exists.

The same audit changes the expected WGO usage: recent `wgo_team_stats` rows behave as team-game rows with `games_played = 1`, not season-to-date snapshots. Use `game_id`, `team_id`, `opponent_id`, and `date` for those joins when present, and record fallback behavior for the small set of recent rows with null `game_id`/`opponent_id`.

For standings, record/split math passed, but field names are not always scale-safe. In particular, `nhl_standings_details.goals_for_pctg` and `goal_differential_pctg` behave as rate-like fields in live data and must be documented in the feature dictionary before normalization.

Goalie-source audit results also shape v1. `goalie_start_projections` has full schedule-side coverage in its current date range, so it remains the primary starter-probability source, but the model must normalize or flag game/team groups whose probabilities do not sum to roughly 1 and review extreme `projected_gsaa_per_60` values. Recent `wgo_goalie_stats` rows behave as goalie-game rows; `wgo_goalie_stats_totals` is not historical-training-safe without a snapshot/as-of rule. NST goalie sources include all, 5v5, EV, PP, and PK count/rate tables, but they currently top out at 2026-04-09 and rate fields need low-TOI outlier handling before training.

Lineup/player-context audit confirms these sources must remain optional in v1. `lineCombinations` is mostly populated for the audited current-season window but still misses 50 game/team sides. `lines_nhl`, `lines_dfo`, `lines_gdl`, and `lines_ccc` are sparse prospective sources rather than full historical training inputs. FORGE player/goalie/team projections are useful optional context only when fresh, and `forge_roster_events` should not be required while the table is empty.

### V1 source-to-feature data dictionary

| Source group | Tables/views | Feature role | Required for v1? | As-of/freshness rule | Fallback | Go/no-go |
| --- | --- | --- | --- | --- | --- | --- |
| Schedule identity | `games`, `teams`, `seasons` | Game ID, home/away teams, season, game date/start time, home ice, rest windows | Required | Use stored game start time; no latest-only joins | Mark prediction unavailable if game/team identity is missing | Go |
| Player/goalie identity | `players` | Player IDs, goalie IDs, optional current-team context | Required for goalie/player joins, optional for skater context | Treat `players.team_id` as nullable/stale | Join by stable player ID; avoid blocking on current team | Go with caveat |
| Team ratings | `team_power_ratings_daily` | Prior/team strength, offense, defense, pace, special-teams-derived ratings | Required | Prefer rows strictly before game date for training; record source-date cutoff and stale state | Wider lookback or preseason/team prior when missing | Go with caveat |
| NST team gamelogs | `nst_team_gamelogs_as_counts`, `nst_team_gamelogs_as_rates`, `nst_team_gamelogs_pp_counts`, `nst_team_gamelogs_pp_rates`, `nst_team_gamelogs_pk_counts`, `nst_team_gamelogs_pk_rates` | Rolling xG, shot, chance, goal, PP, PK, possession features | Optional but high-value | Use dated rows strictly before game date; freshness-gate because latest audited rows end 2026-04-11 | Drop stale/missing NST features and rely on team ratings/WGO | Go with caveat |
| NST team snapshots | `nst_team_5v5`, `nst_team_all`, `nst_team_pp`, `nst_team_pk` | Cumulative/snapshot team context only | Optional | Treat as snapshot/cumulative, not one-game logs; latest audited rows end 2026-03-21 | Prefer gamelog rolling windows | Limited use |
| WGO team stats | `wgo_team_stats` | Team-game goals, shots, PP/PK, faceoff, discipline, rolling form | Optional but high-value | Use rows before game date for training; join by `game_id`/`team_id`/`opponent_id` when present; clip outliers | Fall back to team ratings/standings when IDs or recent rows are missing | Go with caveat |
| Standings | `nhl_standings_details` | Record, points percentage, home/road/l10 splits, goal differential | Optional | Use rows before game date; document rate-like fields before normalization | Drop split fields if stale/missing | Go |
| Goalie starts | `goalie_start_projections` | Starter probability, confirmation state, projected goalie quality | Required for current predictions, not safe for historical training without snapshots | Current predictions may use latest fresh rows; backtests need rows created before puck drop or a pregame backfill | Blend likely starters; fall back to team goalie strength | Go current-only; training blocked until backfilled |
| Goalie quality | `wgo_goalie_stats`, `vw_goalie_stats_unified`, NST goalie all/5v5/EV/PP/PK count/rate tables | Recent goalie form, save quality, workload, GSAA/xGA/high-danger context | Optional but high-value | Use dated rows before game date; freshness-gate NST goalie rows and clip low-TOI rate outliers | Team-level goalie strength or starter projection only | Go with caveat |
| Goalie totals | `wgo_goalie_stats_totals` | Current prior/fallback goalie quality | Optional | Not historical-training-safe without snapshot/as-of rule | Use only for current prior or exclude in backtests | Limited use |
| Lineups | `lineCombinations`, `lines_nhl`, `lines_dfo`, `lines_gdl`, `lines_ccc` | Optional expected-lineup context and explanation metadata | Optional | Require `observed_at < startTime` for training; `lineCombinations` has no observation timestamp | Omit lineup features; do not block prediction | Current/explanation only |
| FORGE projections | `forge_player_projections`, `forge_goalie_projections`, `forge_team_projections` | Optional player/goalie/team projection context | Optional | Freshness-gate; date-only `as_of_date` is not enough for strict pregame backtests when on/after game date | Omit FORGE context | Current/optional only |
| Roster/news events | `forge_roster_events` | Injuries, transactions, lineup/news context | Optional | Empty in audit; use only when populated and timestamped | Omit | No-go for v1 dependency |
| Prediction serving | `game_prediction_outputs`, `player_prediction_outputs` | Latest public prediction rows | Required for serving | Do not rely on as append-only history; current key overwrites same-day same-model rows | Add append-only history/feature snapshots before evaluation | Go for serving only |
| Prediction history/features | New or extended history/snapshot contract | Immutable model input, output, source cutoffs, model/run IDs | Required before honest evaluation | Store before puck drop with `computed_at`, source cutoffs, feature-set version, and provenance | None; must add | Missing contract |
| Run/metrics metadata | `forge_runs` plus game-model metric storage if needed | Run status, model version, metric summaries | Required | Reuse `forge_runs` for shared run metadata; metrics need model/version/feature-set/date-segment keys | Add minimal game-model metric table | Partial |
| Source provenance | `source_provenance_snapshots` plus prediction provenance payloads | Source freshness, fallback state, source URLs/payloads | Required for transparency | Freshness-gate; existing rows include null/expired freshness timestamps | Store source cutoffs in feature snapshot/history payloads | Go with caveat |

---

## 2. Goals

1. **Generate pregame predictions for NHL games.**
   - For every scheduled NHL game, produce a home-team win probability, away-team win probability, confidence label, and explanation of the strongest model factors.

2. **Build a model that improves over time.**
   - Store every prediction before puck drop.
   - Store actual outcomes after games finish.
   - Evaluate model performance after results are known.
   - Retrain on a scheduled cadence using only data that would have been available before each historical game.
   - Promote new model versions only after they beat the current production model on agreed-upon evaluation metrics.

3. **Use NHL API and existing Supabase data.**
   - Pull schedule, teams, games, box scores, rosters, skater stats, goalie stats, and other available NHL data.
   - Use Supabase as the application database, feature store, prediction store, and model performance history store.

4. **Support player and goalie projections without making the MVP too expensive.**
   - Include player and goalie impact features where data exists.
   - Avoid a costly player-by-player simulation engine in the MVP.
   - Ensure game-level predictions still run if player or goalie projections are unavailable.

5. **Create a detailed analytics page on the website.**
   - Display the prediction, matchup context, key factors, player/goalie impact, model confidence, data freshness, and historical model performance.

6. **Measure prediction quality with proper probabilistic metrics.**
   - Primary metrics should include log loss, Brier score, calibration, and accuracy.
   - Accuracy alone must not be treated as the main measure of success because this is a probability model, not just a pick generator.

7. **Create a clear implementation path for a junior developer.**
   - Requirements should be explicit, phased, and testable.
   - The developer should understand what must ship first and what can be added later.

---

## 3. User Stories

### 3.1 Public Website Visitor

As a hockey fan, I want to see the predicted win probability for an upcoming NHL game so that I can understand which team the model favors and by how much.

As a hockey fan, I want to see the main reasons behind a prediction so that the model does not feel like a black box.

As a hockey fan, I want to compare the two teams across important matchup categories such as team form, goaltending, special teams, shot generation, and defensive strength so that I can understand the matchup more deeply.

As a hockey fan, I want to know when the prediction was last updated so that I can tell whether it reflects the latest available data.

### 3.2 Returning Website Visitor

As a returning visitor, I want to see how the model has performed historically so that I can judge whether its predictions are improving over time.

As a returning visitor, I want to see the model version used for each prediction so that changes in predictions are transparent.

### 3.3 Site Owner / Admin

As the site owner, I want every prediction saved before the game starts so that model performance can be evaluated honestly after the game ends.

As the site owner, I want to compare the current production model against new candidate models so that weaker models are not accidentally promoted.

As the site owner, I want to see which features contributed most to recent predictions so that I can audit whether the model is relying on reasonable hockey signals.

As the site owner, I want failed data ingestion or prediction jobs to be visible so that missing or stale predictions can be fixed quickly.

### 3.4 Developer

As a developer, I want clear tables or entities for games, teams, players, goalies, features, predictions, model runs, and model metrics so that the system is maintainable.

As a developer, I want prediction generation, result ingestion, evaluation, and retraining to be separate steps so that failures are easier to debug.

As a developer, I want the model pipeline to handle missing data gracefully so that the site does not break when a starting goalie is unknown or a player-level stat is missing.

---

## 4. Functional Requirements

### 4.1 Data Ingestion Requirements

**FR-1. NHL schedule ingestion**  
The system must ingest upcoming NHL games from the NHL public API into the existing `games` table unless that table is proven insufficient.

Each scheduled game record should include, at minimum:

- NHL game ID
- Season
- Game date and start time
- Home team
- Away team
- Venue, if available
- Game state/status
- Regular season or playoff indicator, if available
- Mapping to existing `games.id`, `games.date`, `games."seasonId"`, `games."startTime"`, `games."homeTeamId"`, `games."awayTeamId"`, and `games.type`

**FR-2. Completed game result ingestion**  
The system must ingest completed NHL game results and attach outcomes to the corresponding stored game records or a dedicated result/evaluation table.

Each completed game record should include, at minimum:

- Final score
- Winning team
- Losing team
- Regulation, overtime, or shootout result, if available
- Home and away goals
- Game completion timestamp

**FR-3. Team statistics ingestion or mapping**  
The system must use available team statistics from Supabase and/or the NHL API.

Important team-level feature categories should include:

- Primary team ratings from `team_power_ratings_daily`, including xG, shot, goal, defensive, offensive, pace, and special-teams-derived fields
- NST team xG, shot, goal, scoring-chance, high-danger, Corsi, and Fenwick metrics from `nst_team_gamelogs_as_counts`, `nst_team_gamelogs_as_rates`, `nst_team_gamelogs_pp_counts`, `nst_team_gamelogs_pp_rates`, `nst_team_gamelogs_pk_counts`, `nst_team_gamelogs_pk_rates`, `nst_team_5v5`, `nst_team_all`, `nst_team_pp`, and `nst_team_pk`
- WGO team goals, shots, power play, penalty kill, faceoff, discipline, and 5v5 possession fields from `wgo_team_stats`
- Standings and home/road/recent record context from `nhl_standings_details`
- Recent performance over rolling windows, such as last 5, 10, and 20 games

The MVP should not create duplicate team-stat tables unless these sources cannot support a required dated/as-of feature.

**FR-4. Goalie statistics ingestion or mapping**  
The system must support goalie-level features when available.

Important goalie-level feature categories should include:

- Starter probability and confirmation state from `goalie_start_projections.start_probability` and `goalie_start_projections.confirmed_status`
- Projected goalie quality from `goalie_start_projections.projected_gsaa_per_60`
- Season and recent goalie form from `wgo_goalie_stats`, guarded current-prior/fallback use of `wgo_goalie_stats_totals`, `vw_goalie_stats_unified`, and NST goalie all/5v5/EV/PP/PK count and rate tables
- Save percentage, goals against average, shots against, GSAA/GSAx-style fields, high-danger save performance, and rest/workload indicators where available

If confirmed starter data is unavailable, the system must blend across likely starters using `start_probability`. If no usable goalie-start rows exist for a team/game, the system must fall back to team-level goaltending and record the fallback in prediction provenance.

**FR-5. Skater statistics ingestion or mapping**  
The system must support lightweight skater-level features when available.

Important skater-level feature categories should include:

- Optional lineup context from `lineCombinations`, `lines_nhl`, `lines_dfo`, `lines_gdl`, and `lines_ccc`
- Optional roster/news events from `forge_roster_events`
- Optional player projections from `forge_player_projections`
- Recent production and usage from `player_stats_unified`, `player_totals_unified`, WGO skater tables, and NST skater tables
- Aggregate impact of expected top forwards, top defensemen, scratches, injuries, and power-play units where source coverage is sufficient

The MVP should not require a full player-by-player simulation to produce a game prediction.

**FR-6. Supabase data dictionary**  
The developer must document which Supabase tables and columns are used for each feature group.

The data dictionary should identify:

- Source table
- Source field
- Feature name used by the model
- Data type
- Whether the field is required or optional
- Fallback behavior when missing
- Whether the field is safe to use before puck drop

The first data dictionary should start from the schema-aligned tables listed near the top of this PRD and explicitly mark Yahoo/fantasy tables as non-core unless used for identity mapping or display.

**FR-7. Data freshness tracking**  
The system must track when each major data source was last updated.

The website should be able to display whether a prediction was generated from fresh, stale, or partially missing data.

**FR-8. Missing data handling**  
The prediction pipeline must not fail completely because of one missing optional feature.

Examples:

- If confirmed goalie data is missing, use team-level goalie strength or projected starter assumptions.
- If player-level data is missing, generate a game prediction using team-level and schedule-level features.
- If a game is missing a required team or schedule field, mark the prediction as unavailable and log the issue.

---

### 4.2 Feature Engineering Requirements

**FR-9. Pregame-only feature generation**  
The system must generate model features using only information that would have been known before the game started.

This is required to prevent data leakage.

Examples of forbidden leakage:

- Using final score data for the same game.
- Using postgame box score data from the game being predicted.
- Using season averages that accidentally include the game being predicted.
- Using confirmed information that was not available before the prediction timestamp.
- Using latest-only views, such as `nhl_team_data`, for historical training rows.
- Joining cumulative dated tables on the current date instead of the last row available before the prediction timestamp.

**FR-10. Core game-level feature groups**  
The model must support the following feature groups:

1. **Team strength**
   - `team_power_ratings_daily` offensive, defensive, pace, and special-teams ratings
   - Overall season performance
   - Recent form
   - Home and away splits from dated standings where available

2. **Offensive ability**
   - Goals for
   - Shots for
   - Shot generation rates
   - Expected goals, scoring chances, high-danger chances, Corsi, and Fenwick from NST sources

3. **Defensive ability**
   - Goals against
   - Shots against
   - Shot suppression
   - Expected goals against, scoring chances against, high-danger chances against, Corsi against, and Fenwick against from NST sources

4. **Goaltending**
   - Confirmed or probability-weighted projected starter quality
   - Team save percentage
   - Recent goalie form
   - Goalie rest/workload
   - GSAA/GSAx-style fields where available

5. **Special teams**
   - Power play strength
   - Penalty kill strength
   - Penalty rates, if available
   - `team_power_ratings_daily` special-teams tiers/fields where available

6. **Schedule context**
   - Home ice
   - Days of rest
   - Back-to-back games
   - Three games in four nights, if available
   - Travel or time-zone burden, if available

7. **Player availability and impact**
   - Top skater availability, if available
   - Aggregated recent production from key skaters
   - Aggregated goalie impact
   - Source-ranked lineup context where available, but optional for MVP model execution

**FR-11. Rolling-window features**  
The system must support rolling-window features over recent games.

Recommended windows:

- Last 5 games for short-term form
- Last 10 games for medium-term form
- Last 20 games for broader trend
- Full season for stable baseline strength

Recent form should be useful, but it must not overwhelm more stable indicators without evidence from validation results.

**FR-12. Difference-based matchup features**  
The system should generate matchup features that compare the two teams directly.

Examples:

- Home team offensive strength minus away team defensive strength
- Away team offensive strength minus home team defensive strength
- Home goalie strength minus away goalie strength
- Home power play strength versus away penalty kill strength
- Away power play strength versus home penalty kill strength
- Rest advantage or disadvantage

**FR-13. Avoid weak standalone predictors**  
The model should not rely heavily on weak or misleading standalone predictors unless evaluation proves they help.

Features to treat cautiously:

- Head-to-head record between the two teams
- Simple win streaks or losing streaks
- Raw team record without schedule or context
- Single-game recent performance
- Unadjusted goals alone when stronger shot, expected-goal, or goalie-adjusted features are available

These can be displayed as context if useful, but they should not be assumed to be high-value model inputs without validation.

---

### 4.3 Prediction Output Requirements

**FR-14. Game prediction output**  
For each upcoming game, the system must generate:

- Home team win probability
- Away team win probability
- Predicted winner
- Confidence label
- Model version
- Prediction timestamp
- Data freshness status
- Top positive factors for the favored team
- Top negative or risk factors for the favored team

**FR-15. Confidence labels**  
The system must translate model probability into user-friendly confidence labels.

Example labels:

- Toss-up
- Slight edge
- Moderate edge
- Strong edge

The labels must avoid implying certainty.

**FR-16. Player projection output**  
The system should support player-level outputs where data exists.

For the MVP/full-platform launch, player outputs can be lightweight and should focus on model context rather than expensive simulations.

Acceptable early player outputs:

- Key skaters likely to influence the matchup
- Recent production indicators
- Shot volume indicators
- Power play usage indicators
- Aggregate top-player advantage by team

Player projections should not block game prediction generation.

**FR-17. Goalie projection output**  
The system should support goalie-level outputs where data exists.

Acceptable early goalie outputs:

- Confirmed or projected starter
- Recent goalie form
- Season goalie strength
- Rest/workload status
- Goalie advantage by team

Goalie projections should not block game prediction generation.

**FR-18. Prediction storage**  
The system must store each prediction before the game starts.

The serving contract should reuse `game_prediction_outputs` where possible:

- Store win probabilities in `home_win_probability` and `away_win_probability`.
- Store factor/explanation values in `components`.
- Store source freshness, feature cutoffs, and input table references in `provenance`.
- Store confidence label, feature-set version, calibration version, and fallback flags in `metadata`.

Because `game_prediction_outputs` is keyed by `snapshot_date`, `game_id`, `model_name`, `model_version`, and `prediction_scope`, it is not sufficient by itself for multiple same-day predictions from the same model. The chosen v1 contract is to keep `game_prediction_outputs` as the latest public serving table and add append-only `game_prediction_history` plus immutable `game_prediction_feature_snapshots`.

Stored prediction records should include:

- Game ID
- Prediction timestamp
- Model version
- Feature set version
- Home win probability
- Away win probability
- Predicted winner
- Confidence label
- Top factors shown to users
- Data freshness status
- Whether goalie data was confirmed, projected, or unavailable
- Whether player-level data was included

**FR-19. Do not overwrite historical predictions**  
If the model generates multiple predictions for the same game, the system must preserve each prediction version.

The website may show the latest pregame prediction from `game_prediction_outputs`, but historical prediction records must remain available for evaluation in an append-only store.

Prediction jobs should use the existing cron audit/timing infrastructure for route execution visibility. Do not add a separate prediction-job log table unless the cron audit contract cannot capture route name, status, timing, error summary, model version, and affected game count in its details payload.

---

### 4.4 Model Learning and Evaluation Requirements

**FR-20. Baseline model**  
The system must maintain a simple baseline model for comparison.

The baseline can be based on stable, easy-to-explain inputs such as team strength, home ice, recent form, and goalie/team performance. The exact model choice is a technical implementation decision, but the baseline must be stored and evaluated separately from more advanced models.

**FR-21. Candidate model support**  
The system must support candidate models that can be trained and evaluated against the current production model.

Candidate approaches may include:

- Logistic regression-style probability model
- Rating-based model such as Elo-style team strength
- Tree-based model
- Ensemble model
- Hybrid model using team, goalie, player, and schedule features

The PRD does not require a specific algorithm. The requirement is that the system can compare approaches honestly and promote the best-performing model.

**FR-22. Time-aware validation**  
Model evaluation must use time-aware validation.

The system should train on earlier games and validate on later games to mimic real prediction conditions. Randomly mixing games across time should be avoided because it can make the model look better than it really is.

**FR-23. Hybrid learning process**  
The system must use a hybrid learning approach:

1. **Daily data update**
   - Pull new schedules, completed results, team stats, goalie stats, skater stats, and Supabase updates.

2. **Prediction generation**
   - Generate predictions for upcoming games using the current production model.

3. **Postgame result capture**
   - Attach final outcomes to previously stored predictions.

4. **Performance evaluation**
   - Calculate model metrics after games complete.

5. **Scheduled retraining**
   - Retrain candidate models on a defined cadence, such as daily, weekly, or after a meaningful batch of completed games.

6. **Manual or rules-based promotion**
   - Promote a candidate model only if it improves the agreed metrics and does not create obvious calibration or stability problems.

**FR-24. Model versioning**  
Every prediction must reference a model version.

Each model version should include:

- Model name
- Training date
- Training data date range
- Feature set version
- Evaluation metrics
- Promotion status
- Notes about major changes

**FR-25. Model promotion criteria**  
A candidate model should not become the production model unless it meets defined promotion criteria.

Minimum promotion criteria:

- Better or comparable log loss than the current production model
- Better or comparable Brier score than the current production model
- No major calibration regression
- No major drop in prediction coverage
- No evidence that the model is using leaked or unavailable data

**FR-26. Performance history**  
The system must store historical performance metrics by model version.

Metrics should be calculable for:

- All games
- Recent games
- Home favorites
- Away favorites
- High-confidence predictions
- Toss-up predictions
- Regular season games
- Playoff games, if included

---

### 4.5 Website and UI Requirements

**FR-27. Prediction analytics page**  
The website must include a detailed analytics page for NHL predictions.

The page should include:

- Upcoming games list
- Individual game prediction cards
- Matchup detail view
- Model explanation section
- Team comparison section
- Player/goalie impact section
- Model performance section
- Data freshness indicator

**FR-28. Game prediction card**  
Each game card must show:

- Home team
- Away team
- Game date and start time
- Home win probability
- Away win probability
- Predicted winner
- Confidence label
- Last updated timestamp
- Model version or model label

**FR-29. Matchup detail view**  
Each game should have a detailed view that shows:

- Prediction summary
- Key factor breakdown
- Team offensive comparison
- Team defensive comparison
- Goalie comparison
- Special teams comparison
- Rest and schedule context
- Player impact notes, if available

**FR-30. Key factor explanations**  
The website must explain the model’s top factors in plain language.

Examples:

- “Home team has the stronger recent shot differential.”
- “Away team has a rest disadvantage.”
- “Projected home goalie has better recent save percentage.”
- “Away power play has an edge against the home penalty kill.”

The explanations should be generated from stored factor metadata, not invented after the prediction.

**FR-31. Historical model performance display**  
The website should show model performance in a way users can understand.

At minimum, show:

- Overall accuracy
- Log loss
- Brier score
- Calibration summary or calibration label
- Number of games evaluated
- Date range of evaluated games

**FR-32. Data freshness display**  
The website must show when the prediction data was last updated.

If data is missing or stale, the UI should show a clear warning instead of hiding the issue.

**FR-33. No betting presentation**  
The UI must not present the predictions as betting advice.

The site should avoid language such as:

- Lock
- Guaranteed
- Free money
- Bet this
- Wager recommendation

Predictions should be presented as model estimates and hockey analytics.

---

### 4.6 Admin and Monitoring Requirements

**FR-34. Admin performance view**  
The system should include an admin-facing way to inspect model performance.

This can be a protected page, internal dashboard, or Supabase-driven report.

The admin view should show:

- Current production model
- Recent model metrics
- Prediction coverage
- Failed prediction jobs
- Data freshness issues
- Candidate model comparison, if available

**FR-35. Job monitoring**  
The system must log major scheduled jobs.

Jobs to monitor:

- Schedule ingestion
- Result ingestion
- Feature generation
- Prediction generation
- Model evaluation
- Model retraining

Each job log should include:

- Job name
- Start time
- End time
- Status
- Error message, if failed
- Number of games or records processed

**FR-36. Prediction coverage monitoring**  
The system must track whether predictions were generated for all eligible upcoming games.

A game should be marked as missing a prediction if it is scheduled, eligible, and within the prediction window but no valid prediction exists.

---

## 5. Non-Goals / Out of Scope

1. **Real-money betting features are out of scope.**
   - No sportsbook integration.
   - No real-money wagering.
   - No bet placement.
   - No betting advice or guaranteed-pick language.

2. **An expensive player-by-player simulation pipeline is out of scope for the MVP.**
   - The MVP should not require shift-level simulation.
   - The MVP should not require full Monte Carlo simulation of every skater and goalie outcome.
   - The MVP should not depend on expensive player prop modeling.
   - Lightweight player and goalie impact features are still in scope.

3. **Live in-game prediction updates are out of scope.**
   - The feature is focused on pregame predictions.
   - It does not need to update probabilities during the game.

4. **The PRD does not require a specific machine learning algorithm.**
   - The product must support model comparison and promotion.
   - The implementation can choose the specific algorithm after inspecting available data.

5. **The feature should not claim certainty.**
   - The product should present probabilities, confidence levels, and explanations.
   - It should not imply that the model can know the outcome of a game.

---

## 6. Design Considerations

### 6.1 Page Structure

The NHL prediction page should be organized around clarity and trust.

Recommended sections:

1. **Today’s NHL Predictions**
   - List of upcoming games.
   - Each game has a compact prediction card.

2. **Game Detail Page or Expanded Card**
   - Larger probability display.
   - Key factors.
   - Team comparison.
   - Goalie comparison.
   - Player impact section.

3. **Model Performance Section**
   - Overall model record.
   - Probabilistic scoring metrics.
   - Number of predictions evaluated.
   - Last evaluation date.

4. **Methodology Section**
   - Short explanation of how the model works.
   - Explain that the model uses historical team, goalie, player, and schedule data.
   - Explain that predictions are stored before games and evaluated after results are final.

### 6.2 Visual Treatment

The design should make probabilities easy to understand without exaggerating certainty.

Recommended UI elements:

- Probability bars
- Team comparison rows
- Confidence labels
- Factor cards
- Data freshness badge
- Model version badge
- Historical performance summary

### 6.3 Trust and Transparency

The site should show:

- Prediction timestamp
- Data freshness
- Model version
- Whether goalie data is confirmed or projected
- Whether player-level features were included
- Historical performance metrics

This is important because users need to understand that model predictions can change as better pregame information becomes available.

### 6.4 Accessibility

The page should be usable without relying only on color.

Examples:

- Probability bars should also show numeric percentages.
- Confidence labels should use text.
- Factor explanations should be readable in plain language.
- Mobile layout should keep the prediction card understandable on small screens.

---

## 7. Technical Considerations

### 7.1 Recommended Data Entities

The implementation should map to existing Supabase entities first:

| Entity | Existing contract | Direction |
| --- | --- | --- |
| Teams | `teams` | Reuse. |
| Games | `games` | Reuse for schedule identity; add result/evaluation linkage only if current result fields are insufficient. |
| Players/goalies | `players` | Reuse; goalies are players with goalie position/context. |
| Team stats | `team_power_ratings_daily`, NST team tables, `wgo_team_stats`, `nhl_standings_details` | Reuse as primary team features. |
| Goalie stats | `goalie_start_projections`, `wgo_goalie_stats`, `wgo_goalie_stats_totals`, `vw_goalie_stats_unified`, NST goalie tables | Reuse as primary goalie and starter features. |
| Player/lineup context | `lineCombinations`, line source tables, `forge_roster_events`, FORGE projection tables | Optional MVP features; do not hard-block game predictions. |
| Prediction serving | `game_prediction_outputs` | Reuse or extend for latest public prediction. |
| Prediction history | Missing/incomplete for multiple same-day outputs | Add append-only history or extend the existing prediction output key. |
| Feature snapshots | Missing/incomplete as a stable model contract | Add a feature snapshot table or store immutable feature payloads referenced from prediction history. |
| Model runs | `forge_runs` | Reuse for run metadata where practical; add game-model-specific tables only if `forge_runs.metrics` is too coarse. |
| Model metrics | `forge_projection_accuracy_stat_daily` exists for FORGE projections | Add game-prediction metrics by model/version/date segment if no suitable table exists. |
| Source provenance | `source_provenance_snapshots` | Reuse for lineup, goalie, injury/news, and model-input freshness. |
| Job logs | Existing cron/reporting routes and scheduled job context | Reuse if adequate; otherwise add minimal structured job log rows for prediction jobs. |

### 7.2 Prediction Lifecycle

The expected lifecycle is:

1. Ingest upcoming NHL schedule.
2. Update Supabase with available team, player, and goalie stats.
3. Generate pregame features for each eligible game.
4. Run production model to create predictions.
5. Store predictions and feature snapshots before puck drop.
6. Display latest valid prediction on the website.
7. After games finish, ingest final results.
8. Score predictions against outcomes.
9. Update model performance metrics.
10. Retrain candidate models on the scheduled cadence.
11. Compare candidate models to production model.
12. Promote a candidate model only if it meets promotion criteria.

### 7.3 Model Architecture Guidance

The platform should support multiple model approaches, but the implementation should start with simple, testable models before adding complexity.

Recommended progression:

1. **Baseline model**
   - Simple and explainable.
   - Used to prove the pipeline works.
   - Used as the benchmark that advanced models must beat.
   - Suggested first baseline: regularized logistic model using home ice, rest, `team_power_ratings_daily` differentials, goalie-start weighted goalie quality, and a small set of dated standings/team-form features.

2. **Feature-rich game model**
   - Uses team, goalie, special teams, schedule, and optional lineup/player features.
   - Produces calibrated win probabilities.
   - Should first test existing schema features before adding new ingestion.

3. **Challenger models**
   - More advanced approaches can be tested after the pipeline is reliable.
   - These should be compared using time-aware validation.

4. **Player and goalie projection layer**
   - Adds additional context and features.
   - Should not be required for the game model to function.
   - Should be added only where it improves measured game prediction quality or user understanding.
   - Should prefer existing FORGE projection outputs over a new player-simulation pipeline.

### 7.4 Model Evaluation Guidance

The model should be judged as a probability model.

Primary metrics:

- **Log loss**: Penalizes confident wrong predictions.
- **Brier score**: Measures the squared error of predicted probabilities.
- **Calibration**: Measures whether probabilities match reality over time.
- **Accuracy**: Measures how often the predicted winner won, but should not be used alone.

Secondary metrics:

- Prediction coverage
- Performance by confidence bucket
- Performance by home favorite vs away favorite
- Performance by regular season vs playoffs
- Performance by model version
- Data freshness at prediction time

### 7.5 Calibration Requirement

The model should be checked for calibration.

Example interpretation:

- When the model says a team has a 60% chance to win, teams in that bucket should win close to 60% of the time over a large sample.

The UI does not need to show a complex calibration chart in the first version, but the backend should store enough data to support one later.

### 7.6 Data Leakage Prevention

The implementation must be careful with historical features.

For each historical training game, features must be calculated as if the model were making the prediction before that game started.

This is one of the most important technical requirements because leakage can make a model appear much better than it will be in production.

### 7.7 Supabase Requirements

Supabase should be used for:

- Storing ingested NHL data
- Storing feature snapshots
- Storing predictions
- Storing model results
- Storing model versions
- Storing job logs
- Serving website data to the frontend

The developer should inspect the existing Supabase schema before creating new tables. If existing tables already support a requirement, the implementation should reuse them instead of duplicating data.

Known schema gaps to resolve before implementation:

- `game_prediction_outputs` needs append-only history support for multiple same-day pregame refreshes.
- A stable immutable feature snapshot contract is still needed if feature payloads are not stored directly in prediction history.
- Game-level model metric storage by model/version/date segment may need a new table.
- Job logging may need a minimal prediction-specific table if existing cron reporting is not enough.

### 7.8 Scheduled Jobs

The system will likely need scheduled jobs for:

- Daily schedule sync
- Pregame prediction generation
- Postgame result sync
- Model scoring/evaluation
- Scheduled retraining

The exact scheduler can depend on the current hosting stack. Acceptable options may include platform cron jobs, Supabase scheduled jobs, server-side scheduled functions, or another existing project scheduler.

### 7.9 Frontend Requirements

The frontend must fetch prediction data from a stable backend route or Supabase-backed API layer.

The frontend should not calculate model predictions directly. It should display stored prediction outputs and supporting explanation data.

### 7.10 Explainability Requirement

The system must store explanation data at prediction time.

The UI should not invent explanations after the fact. If a factor is shown to users, it should be traceable to the model output or feature snapshot used for that prediction.

---

## 8. Success Metrics

### 8.1 Model Quality Metrics

The feature is successful if the system can consistently track and improve:

1. **Log loss**
   - Primary probability-quality metric.
   - Lower is better.

2. **Brier score**
   - Measures probability error.
   - Lower is better.

3. **Calibration**
   - Predicted probabilities should match observed outcomes over time.
   - For example, teams predicted around 60% should win roughly 60% of those games over a large enough sample.

4. **Accuracy**
   - Useful, but secondary.
   - Should be reported alongside probability metrics.

5. **Performance against baseline**
   - Advanced models must be compared against the baseline model.
   - A more complex model is not successful unless it improves prediction quality or user understanding.

### 8.2 Product and Reliability Metrics

The feature is successful if:

1. Predictions are generated for the majority of eligible upcoming NHL games.
2. Predictions are stored before puck drop.
3. Completed games are matched to predictions after final results are available.
4. The site displays current predictions without manual intervention.
5. Data freshness is visible to users.
6. Failed jobs are logged clearly enough for debugging.
7. The prediction page loads reliably on desktop and mobile.

### 8.3 Initial Acceptance Targets

The first implementation should be considered acceptable when:

1. The system can ingest upcoming NHL games.
2. The system can ingest completed NHL results.
3. The system can create pregame feature snapshots.
4. The system can generate and store predictions for upcoming games.
5. The website can display a detailed prediction page.
6. The system can score predictions after games finish.
7. The system can report log loss, Brier score, calibration summary, and accuracy.
8. The system can preserve model version history.
9. Missing optional goalie or player data does not break game predictions.
10. The UI clearly avoids betting or wagering language.

---

## 9. Open Questions

1. **Prediction timing**
   - When should the system generate the public prediction for each game?
   - Options include morning of game day, a fixed number of hours before puck drop, or multiple times before puck drop.

2. **Prediction history storage**
   - Should `game_prediction_outputs` be extended to preserve multiple same-day outputs, or should a separate append-only `game_prediction_history` table feed the latest serving table?

3. **Feature snapshot shape**
   - Should immutable feature snapshots be stored as wide typed columns, compact JSONB, or both?
   - The MVP should favor a compact JSONB payload plus typed keys for joins and filtering unless model training requires a wide table.

4. **Historical lineup coverage**
   - How much backfilled coverage exists for `lineCombinations`, `lines_nhl`, `lines_dfo`, `lines_gdl`, and `lines_ccc`?
   - If coverage is sparse, lineup features should remain current-game explanation inputs and not training features.

5. **Model retraining cadence**
   - Should retraining happen daily, weekly, or only after a minimum number of new completed games?

6. **Admin interface**
   - Should model monitoring be a protected website page, a Supabase dashboard, or a developer-only report at first?

7. **Playoff handling**
   - Should playoff games use the same model as regular season games, or should playoff games be evaluated separately until enough data exists?

8. **Public methodology page**
   - Should the website include a public explanation of the model and its limitations?

9. **Expected score**
   - Should expected score be added later, or should the first version focus only on win probability and factor explanation?

---

## 10. Implementation Phasing

### Phase 1: Research, Audit, and Planning

Purpose: understand the available data and establish a trustworthy modeling plan.

Deliverables:

- Supabase data dictionary seeded from `games`, `teams`, `players`, `team_power_ratings_daily`, NST/WGO team and goalie tables, `goalie_start_projections`, FORGE projection tables, lineup source tables, `game_prediction_outputs`, and `source_provenance_snapshots`
- List of available NHL API fields
- Feature inventory
- Missing-data strategy
- Baseline model definition
- Evaluation metric definitions
- Model promotion criteria
- Prediction storage design, including the decision to extend `game_prediction_outputs` or add an append-only history table

### Phase 2: MVP Prediction Pipeline

Purpose: produce and store pregame game predictions.

Deliverables:

- Schedule ingestion
- Result ingestion
- Feature snapshot generation
- Baseline model
- Prediction storage
- Postgame scoring
- Model metrics storage
- Basic job logging

### Phase 3: Detailed Website Analytics Page

Purpose: display predictions and explanations publicly.

Deliverables:

- Prediction cards
- Game detail page
- Team comparison view
- Goalie comparison view
- Key factor explanations
- Data freshness labels
- Model performance summary

### Phase 4: Hybrid Learning Loop

Purpose: make the model improve over time.

Deliverables:

- Scheduled retraining
- Candidate model tracking
- Model versioning
- Production model promotion workflow
- Calibration tracking
- Performance by segment

### Phase 5: Player and Goalie Projection Expansion

Purpose: add richer player and goalie context without creating an expensive simulation dependency.

Deliverables:

- Lightweight skater impact features
- Lightweight goalie projection features
- Player/goalie impact display
- Evaluation of whether these features improve game prediction quality

---

## 11. Codex Handoff Prompt

Use the following prompt when handing this PRD to ChatGPT Codex 5.5 or another implementation-focused coding assistant:

> You are helping implement an NHL Game Prediction Model and Analytics Platform for a website. Use the PRD in `/tasks/TASKS/prd-nhl-game-prediction-model.md` as the source of truth. The goal is to build a full prediction platform, but implementation should be phased. Start with research/audit and a reliable MVP game prediction pipeline before adding expensive complexity.
>
> Product goals:
> - Generate pregame NHL game predictions using NHL public API data plus existing stats in Supabase.
> - Store every prediction before puck drop.
> - Store actual outcomes after games complete.
> - Evaluate predictions using log loss, Brier score, calibration, and accuracy.
> - Support a hybrid learning loop: daily data updates, scheduled retraining, candidate model evaluation, and controlled promotion of better model versions.
> - Display predictions on a detailed public analytics page with probability, confidence, key factors, matchup stats, data freshness, model version, and historical model performance.
> - Include player and goalie projections as lightweight, non-blocking inputs and display context. Do not make the MVP depend on an expensive player-by-player simulation engine.
>
> Existing schema direction:
> - Reuse `games`, `teams`, `players`, and `seasons` for identity/schedule.
> - Use `team_power_ratings_daily`, vetted NST team tables, `wgo_team_stats`, and `nhl_standings_details` for team features with freshness and scale guards.
> - Use `goalie_start_projections`, `wgo_goalie_stats`, guarded `wgo_goalie_stats_totals`, `vw_goalie_stats_unified`, and vetted NST goalie tables for goalie/starter features.
> - Use `lineCombinations`, `lines_nhl`, `lines_dfo`, `lines_gdl`, `lines_ccc`, `forge_roster_events`, and FORGE projection tables only as optional MVP context unless historical coverage is verified.
> - Prefer `game_prediction_outputs` as the latest public output contract, but add or extend append-only storage before supporting multiple same-day prediction updates for the same game/model.
> - Use `source_provenance_snapshots` for data freshness/provenance where practical.
>
> Important implementation caveats:
> - Prevent data leakage. Historical training features must only use data that would have been known before each game.
> - Do not use latest-only display views such as `nhl_team_data` as historical training features.
> - Do not overwrite old predictions. Preserve prediction history and model versions.
> - Do not use accuracy alone as the model success metric. Treat this as a probability model.
> - Do not present predictions as betting advice. No sportsbook integration, wagering language, or real-money betting features.
> - Do not let missing optional goalie or player data break game prediction generation. Use documented fallbacks.
> - Start simple and measurable. Keep a baseline model so advanced models must prove they are better.
>
> Implementation priorities:
> 1. Confirm the existing Supabase schema contracts above and create a data dictionary with as-of safety notes.
> 2. Create or map the required data entities for feature snapshots, append-only prediction history, model metrics, and job logs.
> 3. Build schedule ingestion and completed-result ingestion from the NHL public API.
> 4. Generate pregame feature snapshots using dated Supabase rows available before the prediction timestamp.
> 5. Create a baseline model and store predictions before games start.
> 6. Build postgame scoring and model metric tracking.
> 7. Build the website analytics page that reads stored predictions and explanations.
> 8. Add scheduled retraining and model version promotion only after the basic pipeline works.
> 9. Add player and goalie projection layers incrementally and measure whether they improve game prediction quality.
>
> Before writing implementation code, first produce a concise implementation plan based on the existing project structure and Supabase schema. Identify any missing data, proposed tables, required scheduled jobs, and the minimum viable prediction flow.
