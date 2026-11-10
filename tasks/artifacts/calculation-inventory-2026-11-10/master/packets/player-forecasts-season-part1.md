# Audit packet: Player forecasts (season) (part 1 of 5)

Master entries M-PFC-001 to M-PFC-060 (60 of 264 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-PFC-001 | fn build_player_forecast_runtime_features | Both | 0 | 19 |
| M-PFC-002 | Fantasy performance predictor (RF/GBM/XGB/linear) with league scoring | Both | 0 | 7 |
| M-PFC-003 | Advanced skater/team observations (individual attempts, distance dang… | Both | 0 | 4 |
| M-PFC-004 | Advanced goalie danger-band shots/goals against, xGA and GSAx | Both | 0 | 4 |
| M-PFC-005 | Advanced EDGE context selection | Both | 0 | 1 |
| M-PFC-006 | Deterministic Gaussian copula simulation for season quantiles | Both | 0 | 5 |
| M-PFC-007 | Advanced per-game mean/variance and team season totals | Both | 0 | 4 |
| M-PFC-008 | Advanced EB rate policy with chronological split and conformal residu… | Both | 0 | 5 |
| M-PFC-009 | Expected assists proxied by actual-assist projections | Both | 0 | 3 |
| M-PFC-010 | Season / rest-of-season aggregation and current-view actuals | Both | 0 | 6 |
| M-PFC-011 | Contextual EB profile: age curve, back-to-back and home/away multipli… | Both | 0 | 5 |
| M-PFC-012 | Future age multiplier (season aging adjustment) | Both | 0 | 4 |
| M-PFC-013 | Current-appearance skater rate (current-season-only decayed mean) | Both | 0 | 4 |
| M-PFC-014 | Prior-appearance skater rates (previous-season arithmetic means + mea… | Both | 0 | 3 |
| M-PFC-015 | Legacy skater baseline per-appearance rate (projection consensus + pr… | Both | 0 | 6 |
| M-PFC-016 | Current-season SOG appearance mean (VAN canary) | Both | 0 | 3 |
| M-PFC-017 | Native power-play points per game (landing scoring summary) | Both | 0 | 2 |
| M-PFC-018 | Daily-board opponent/home/player-residual ridge context model | Both | 0 | 4 |
| M-PFC-019 | Goalie start probability temperature scaling | Both | 0 | 4 |
| M-PFC-020 | Daily-board historical baselines (season rate, recent blend, role-awa… | Both | 0 | 3 |
| M-PFC-021 | Participation logistic regression | Both | 0 | 4 |
| M-PFC-022 | Joint game scenario simulator (Poisson shot process, goal odds, assis… | Both | 0 | 4 |
| M-PFC-023 | Daily-board strength-split baselines (EV/PP/PK usage x rate) | Both | 0 | 3 |
| M-PFC-024 | Baseline policy grid selection (recent weight, prior minutes) | Both | 0 | 2 |
| M-PFC-025 | Deployment evidence weights and injury/scratch availability multiplier | Both | 0 | 4 |
| M-PFC-026 | Deployment role heuristics (lines, pairs, PP/PK units, teammate quali… | Both | 0 | 3 |
| M-PFC-027 | Forecast-diagnostics team goal mean alignment (FORGE vs team model) | Both | 0 | 2 |
| M-PFC-028 | Empirical team goals baseline (own GF/gm and opponent GA/gm) | Both | 0 | 3 |
| M-PFC-029 | Prospective point and probability evaluation (MAE, bias, Brier, paire… | Both | 0 | 5 |
| M-PFC-030 | Ledger scoring: MAE/bias/RMSE, Mincer-Zarnowitz, reliability bins, FP… | Both | 0 | 4 |
| M-PFC-031 | Paired ledger comparison (RMSE skill) and market probability scoring … | Both | 0 | 3 |
| M-PFC-032 | Release evaluation gates (v4 fantasy batch and v5 advanced batch) | Both | 0 | 2 |
| M-PFC-033 | Horizon residual quantile calibration | Both | 0 | 2 |
| M-PFC-034 | Paired loss bootstrap (game/slate clusters) | Both | 0 | 1 |
| M-PFC-035 | Daily-board evaluation metrics (MAE, RMSE, bias, Brier, log loss, cal… | Both | 0 | 3 |
| M-PFC-036 | Paired slate bootstrap and lockbox promotion gates | Both | 0 | 2 |
| M-PFC-037 | Range evaluation MAE/RMSE and skill score | Both | 0 | 4 |
| M-PFC-038 | Rolling-origin randomized conformal 80% interval calibration | Both | 0 | 3 |
| M-PFC-039 | Validation challenger features (HistoricalSeries, team/opponent posit… | Both | 0 | 6 |
| M-PFC-040 | Historical-core feature engineering (career, season, last-N, EWMA, EB… | Both | 0 | 4 |
| M-PFC-041 | Native goalie win rate per appearance (boxscore decision) | Both | 0 | 5 |
| M-PFC-042 | Native goalie volume rates (SV, GA, SA, minutes per appearance) | Both | 0 | 3 |
| M-PFC-043 | Native goalie summary-credited W and SO rates | Both | 0 | 6 |
| M-PFC-044 | Legacy goalie baseline rates (per-appearance volume, per-start W/SO) | Both | 0 | 4 |
| M-PFC-045 | Goalie starter label from boxscore | Both | 0 | 1 |
| M-PFC-046 | Challenger/inference serving (validation shadow worker) | Both | 0 | 4 |
| M-PFC-047 | Per-game target multiplier (pace, opponent defense, venue, rest, home… | Both | 0 | 4 |
| M-PFC-048 | Per-game evaluation: unconditional mean and mixture variance | Both | 0 | 2 |
| M-PFC-049 | Frozen-window and roster-observation participation variants (Sep 29 -… | Both | 0 | 5 |
| M-PFC-050 | Skater participation frequency (eligible-opportunity appearance rate) | Both | 0 | 3 |
| M-PFC-051 | Rolling 14-day participation (skater/goalie appearance and goalie sta… | Both | 0 | 8 |
| M-PFC-052 | PP shot-rate exposure shrinkage ablation | Both | 0 | 2 |
| M-PFC-053 | Adjusted defense rating (on-ice suppression goal-equivalents per 60) | Both | 0 | 4 |
| M-PFC-054 | Player rating signals and percentiles (offense, defense, goaltending) | Both | 0 | 5 |
| M-PFC-055 | Derived-stat reconciliation (_reconcile) | Both | 0 | 2 |
| M-PFC-056 | Normal-approximation quantiles and ratio-interval reconciliation | Both | 0 | 5 |
| M-PFC-057 | Game expectations: horizon totals, expected appearances/starts, SV% a… | Both | 0 | 6 |
| M-PFC-058 | Rest-of-season aggregation (normal approximation with participation m… | Both | 0 | 4 |
| M-PFC-059 | Rookie roster logistic offsets (age, draft, trajectory, PPG) | Both | 0 | 6 |
| M-PFC-060 | Rookie league-transition model (NHLe-style equivalency and roster pro… | Both | 0 | 4 |

## M-PFC-001 fn build_player_forecast_runtime_features

- **Match:** Both; Opus PFC-001; Codex sql-forecast-feature-rpc, sql-runtime-assists-career, sql-runtime-assists-current, sql-runtime-assists-ewma_0_1, sql-runtime-assists-last_20, sql-runtime-assists-opponent_allowed_rate, sql-runtime-assists-position_prior, sql-runtime-assists-previous, sql-runtime-assists-team_rate, sql-runtime-hits-career, sql-runtime-hits-current, sql-runtime-hits-ewma_0_1, sql-runtime-hits-last_20, sql-runtime-hits-opponent_allowed_rate, sql-runtime-hits-position_prior, sql-runtime-hits-previous, sql-runtime-hits-team_rate
- **Purpose:** Cutoff-safe per-player assist/hit feature vector (career, seasons, last-20, EWMA, team/opponent context)
- **Where:** `supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3 (latest, 4-arg)`; `supabase/migrations/20260805002036_add_player_forecast_runtime_feature_rpc.sql:1 (earlier 3-arg, dropped)`; `supabase/migrations/20260805002036_add_player_forecast_runtime_feature_rpc.sql:1; replacement supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3`; `supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3 build_player_forecast_runtime_features`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (PFC-001):**
  - Method: Regular-season games before cutoff. Per player: career mean, current-season mean, previous season (season_id-10001) mean, last-20 mean, EWMA with decay 0.9 per game back (sum x*0.9^(k-1)/sum 0.9^(k-1)); multi_season_weighted = 0.7*current + 0.3*previous (else whichever exists); position prior = mean by game position over all history; team_position_rate = mean for rows on p_team; opponent_allowed_position_rate = mean of rows whose opponent was p_opponent (all seasons).
  - Inputs/units: per-game counts; sources: rosters, players, skatersGameStats, games, nhl_api_game_roster_spots, shift_charts
  - Output scale: per-game means; writes: —
  - Status: live — called by web/lib/player-forecasts/serving.ts
  - Consumers: web/lib/player-forecasts/serving.ts; web/scripts/verify-player-forecast-local-acceptance.ts
- **Codex view (sql-forecast-feature-rpc, calculation, location; Codex family 'Player forecast SQL cross-reference'):** build_player_forecast_runtime_features
  - Purpose: Aggregate historical game inputs and team/goalie context for forecast feature generation.
  - Inputs/units: Candidate roster plus cutoff-exclusive official NHL completed boxscore history, historical team/opponent identities, season and position; assists/hits event counts per player-game.
  - Output scale: For assists and hits: history_count; career/current/previous-season/last20 arithmetic means; normalized EWMA weights 0.9^(reverse_game_number−1); multi-season weighted rate .7×current+.3×previous (available-side fallback); position prior mean; team-position and opponent-allowed-position means; missingness flags and source manifest.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-runtime-assists-career, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** assists_career
  - Purpose: avg(all eligible historical assists)
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-assists-current, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** assists_current
  - Purpose: avg(current season assists)
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-assists-ewma_0_1, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** assists_ewma_0_1
  - Purpose: sum(value*.9^(reverse_game_number-1))/sum(.9^(reverse_game_number-1))
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-assists-last_20, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** assists_last_20
  - Purpose: avg(latest 20 assists)
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-assists-opponent_allowed_rate, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** assists_opponent_allowed_rate
  - Purpose: avg(assists) when historical opponent equals target opponent
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-assists-position_prior, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** assists_position_prior
  - Purpose: avg(assists) by position
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-assists-previous, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** assists_previous
  - Purpose: avg(previous season assists)
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-assists-team_rate, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** assists_team_rate
  - Purpose: avg(assists) when historical actual team equals target team
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-hits-career, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** hits_career
  - Purpose: avg(all eligible historical hits)
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-hits-current, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** hits_current
  - Purpose: avg(current season hits)
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-hits-ewma_0_1, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** hits_ewma_0_1
  - Purpose: sum(value*.9^(reverse_game_number-1))/sum(.9^(reverse_game_number-1))
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-hits-last_20, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** hits_last_20
  - Purpose: avg(latest 20 hits)
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-hits-opponent_allowed_rate, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** hits_opponent_allowed_rate
  - Purpose: avg(hits) when historical opponent equals target opponent
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-hits-position_prior, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** hits_position_prior
  - Purpose: avg(hits) by position
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-hits-previous, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** hits_previous
  - Purpose: avg(previous season hits)
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-runtime-hits-team_rate, calculation, codex_part_of_opus; Codex family 'Player forecast SQL runtime features'):** hits_team_rate
  - Purpose: avg(hits) when historical actual team equals target team
  - Inputs/units: Historical skater game counts, canonical game starts before cutoff, season and historical team identification.
  - Output scale: Count per historical row/game as SQL average; unavailable SQL NULL is retained.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:186 COMMENT 'Builds cutoff-safe historical-core skater features, including team and opponent context'
  - Intended contract (Codex sql-forecast-feature-rpc): RPC comment: cutoff-safe historical-core skater features; current roster supplies candidates and never rewrites historical outcomes.
  - Intended contract (Codex sql-runtime-assists-career): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(all eligible historical assists)"}
  - Intended contract (Codex sql-runtime-assists-current): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(current season assists)"}
  - Intended contract (Codex sql-runtime-assists-ewma_0_1): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "sum(value*.9^(reverse_game_number-1))/sum(.9^(reverse_game_number-1))"}
  - Intended contract (Codex sql-runtime-assists-last_20): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(latest 20 assists)"}
  - Intended contract (Codex sql-runtime-assists-opponent_allowed_rate): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(assists) when historical opponent equals target opponent"}
  - Intended contract (Codex sql-runtime-assists-position_prior): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(assists) by position"}
  - Intended contract (Codex sql-runtime-assists-previous): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(previous season assists)"}
  - Intended contract (Codex sql-runtime-assists-team_rate): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(assists) when historical actual team equals target team"}
  - Intended contract (Codex sql-runtime-hits-career): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(all eligible historical hits)"}
  - Intended contract (Codex sql-runtime-hits-current): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(current season hits)"}
  - Intended contract (Codex sql-runtime-hits-ewma_0_1): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "sum(value*.9^(reverse_game_number-1))/sum(.9^(reverse_game_number-1))"}
  - Intended contract (Codex sql-runtime-hits-last_20): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(latest 20 hits)"}
  - Intended contract (Codex sql-runtime-hits-opponent_allowed_rate): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(hits) when historical opponent equals target opponent"}
  - Intended contract (Codex sql-runtime-hits-position_prior): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(hits) by position"}
  - Intended contract (Codex sql-runtime-hits-previous): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(previous season hits)"}
  - Intended contract (Codex sql-runtime-hits-team_rate): {"source": "supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3", "statement": "avg(hits) when historical actual team equals target team"}
  - External references: Marcel-style weighting; EWMA
  - Fixtures/test data: none listed
  - Tests: `supabase/tests/data_api_grants.sql`; `web/lib/player-forecasts/playerForecasts.test.ts`; `{"discovered_not_run": []}`; `{"status": "Discovered; not run", "references": ["No dedicated test linkage resolved in this bounded pass."]}`
- **Leads (not audited):**
  - (opus) team and opponent context rates pool every season in history (no recency window)
  - (opus) per-game means, not TOI-normalized; only assists and hits
  - (codex:sql-forecast-feature-rpc) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-runtime-assists-career) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-assists-current) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-assists-ewma_0_1) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-assists-last_20) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-assists-opponent_allowed_rate) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-assists-position_prior) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-assists-previous) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-assists-team_rate) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-hits-career) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-hits-current) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-hits-ewma_0_1) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-hits-last_20) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-hits-opponent_allowed_rate) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-hits-position_prior) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-hits-previous) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-runtime-hits-team_rate) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-PFC-002 Fantasy performance predictor (RF/GBM/XGB/linear) with league scoring

- **Match:** Both; Opus PFC-005; Codex core-312, core-313, core-314, core-315
- **Purpose:** Research ML models predicting next-game / next-5 / next-10 fantasy points from WGO game logs
- **Where:** `web/scripts/performance_prediction.py:61 (fantasy_scoring)`; `web/scripts/performance_prediction.py:210 (calculate_fantasy_points)`; `web/scripts/performance_prediction.py:232 (engineer_features)`; `web/scripts/performance_prediction.py:278 (create_prediction_targets)`; `web/scripts/performance_prediction.py:407 (train_models)`; `web/scripts/performance_prediction.py:667 (predict_future_performance)`; `web/scripts/performance_prediction.py:210 calculate_fantasy_points`; `web/scripts/performance_prediction.py:232 engineer_features`; `web/scripts/performance_prediction.py:278 create_prediction_targets`; `web/scripts/performance_prediction.py:407 train_models`
- **Tags (heuristic):** denominators: per 60, per game, shots on goal; generation: legacy, research
- **Opus view (PFC-005):**
  - Method: FP = 6 G + 2 A + 1 PPP + 1 SHG + 1 SHP + 0.2 SOG + 0.2 HIT + 0.25 BLK; features: rolling 10 and 5 game means (min_periods 1, include current game), games played in season, days since last game, season progress (date-min)/(max-min) within season, position code map C0 L1 R2 D3, team_fantasy_avg_10; targets: next game FP (shift -1), mean of next 5 and next 10 games; time split at 80th percentile of date; models RF(100), GBR(100), XGB(100), Linear, Ridge(alpha 1), Lasso(alpha 1) with StandardScaler for linear; metrics MAE, RMSE, R2
  - Inputs/units: per-game counts; TOI as stored in wgo_skater_stats (seconds); per-60 rates; percents as stored; sources: wgo_skater_stats (REST, seasons 20232024+20242025)
  - Output scale: fantasy points per game; writes: local CSV hockey_performance_predictions.csv
  - Status: legacy/dead — standalone research script, no callers
  - Consumers: none found (research script)
- **Codex view (core-312, calculation, location; Codex family 'legacy performance research'):** Research fantasy scoring
  - Formula: 6G+2A+PPP+SHG+SHP+.2SOG+.2HIT+.25BLK.
  - Purpose: Calculate research fantasy scoring.
  - Inputs/units: G, A, PPP, SHG, SHP, SOG, HIT, BLK counts.
  - Output scale: Fantasy points/game.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Standalone research script; no promoted/deployed model evidence. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final sta…
- **Codex view (core-313, calculation, codex_part_of_opus; Codex family 'legacy performance research'):** Research rolling and trend features
  - Formula: Group means and chronological counters; auxiliary calculate_rolling_averages adds 5/10/15/20 means, SD and linear slopes.
  - Purpose: Calculate research rolling and trend features.
  - Inputs/units: Player game histories and dates.
  - Output scale: Rolling 5/10 means; season game count; days since game; season progress; position encoding; team rolling mean.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Standalone research script; no promoted/deployed model evidence. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final sta…
- **Codex view (core-314, calculation, codex_part_of_opus; Codex family 'legacy performance research'):** Research forward targets
  - Formula: shift(-1), rolling 5-game mean shift(-5), rolling 10-game mean shift(-10).
  - Purpose: Calculate research forward targets.
  - Inputs/units: Player fantasy-point history.
  - Output scale: Next-game points; next 5/10-game averages.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Standalone research script; no promoted/deployed model evidence. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final sta…
- **Codex view (core-315, calculation, codex_part_of_opus; Codex family 'legacy performance research'):** Research regression models and evaluation
  - Formula: Fits configured linear/regularized/tree/boosting regressors with source-defined split/scaling; selects best testR² in predict_future_performance.
  - Purpose: Calculate research regression models and evaluation.
  - Inputs/units: Numeric feature matrices and future fantasy targets.
  - Output scale: Predictions, MAE/MSE/R² and model feature importance.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Standalone research script; no promoted/deployed model evidence. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final sta…
- **Audit context:**
  - Intent (Opus): module docstring web/scripts/performance_prediction.py:2-13
  - Intended contract (Codex core-312): Source types and implementation in web/scripts/performance_prediction.py:210; separate acceptance not verified.
  - Intended contract (Codex core-313): Source types and implementation in web/scripts/performance_prediction.py:232; separate acceptance not verified.
  - Intended contract (Codex core-314): Source types and implementation in web/scripts/performance_prediction.py:278; separate acceptance not verified.
  - Intended contract (Codex core-315): Source types and implementation in web/scripts/performance_prediction.py:407; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/scripts/performance_prediction.py`
- **Leads (not audited):**
  - (opus) team_fantasy_avg_10 is a rolling mean over rows grouped by team_id but the frame is sorted by player then date, so it mixes players in arbitrary order
  - (opus) season_progress uses each season's max date (future information)
  - (opus) goal weight 6 here vs 3 in fantasy_points_analysis.py and a third scoring (G6 A4 SOG0.9 HIT0.6 BLK0.6) in calculate_derived_features of the same file
  - (codex:core-312) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-313) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-314) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-315) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-PFC-003 Advanced skater/team observations (individual attempts, distance danger bands, rush, rebound, ixG, pace)

- **Match:** Both; Opus PFC-006; Codex modeling-player-forecasts-advanced-build-advanced-observations
- **Purpose:** Aggregates shot features into per-game individual and team advanced counts
- **Where:** `modeling/player_forecasts/advanced.py:1016 (_build_advanced_observations)`; `modeling/player_forecasts/advanced.py:1162 (danger bands)`; `modeling/player_forecasts/advanced.py:1287 (TEAM_PACE)`; `modeling/player_forecasts/advanced.py:1016 _build_advanced_observations`
- **Tags (heuristic):** denominators: per game, unblocked attempts; generation: current
- **Opus view (PFC-006):**
  - Method: SHOT_ATTEMPTS += 1 per attempt; UNBLOCKED if flag; danger: distance<=20 ft HIGH, <=40 MID, else LONG (all attempts); RUSH/REBOUND shots by flag; EXPECTED_GOALS = sum xg of champion model; REBOUNDS_CREATED = expected_rebounds_created; TEAM CF/CA/FF/FA/HD for/against by event owner; TEAM_PACE = (CF+CA)/2; TEAM xGF/xGA from team_xg
  - Inputs/units: shot distance in feet; xG 0-1; sources: nhl_xg_shot_features, nhl_xg_shot_predictions, nhl_xg_rebound_control_player_game_aggregates, nhl_xg_team_game_aggregates
  - Output scale: per-game counts and xG sums; writes: in-memory -> advanced season-artifact.json rates
  - Status: unknown — manual CLI season-advanced-train/-evaluate/-project (modeling/player_forecasts/__main__.py:163-175, docs/player-projections/player-forecasts-runbook.md advanced-v5 section); output imported with the season bundle; no scheduler found
  - Consumers: _fit_rate_policy; project_advanced_release
- **Codex view (modeling-player-forecasts-advanced-build-advanced-observations, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Build advanced observations (_build_advanced_observations)
  - Purpose: Build advanced observations for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _build_advanced_observations( freeze: Path, players: dict[int, dict[str, Any]], source_audit: dict[str, Any], ) -> dict[str, Any]: fhfh_by_nhl = { int(value["nhlPlayerId"]): fhfh_id for fhfh_id, value in players.items() if value.get("nhlPlayerId") is not None } skater_games: dict[tuple[int, int], dict[str, Any]] = {} goalie_games: dict[tuple[int, int], dict[str, Any]] = {} team_games: dict[tuple[int, int], dict[str, Any]] = {} def skater_observation( nhl_id: Any, game_id: Any, game_date: Any,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): DANGER_TAXONOMY_VERSION 'player-forecasts-v5-distance-bands-v1' (advanced.py:74); docs/player-projections/research-contract-v5-season-advanced.json
  - Intended contract (Codex modeling-player-forecasts-advanced-build-advanced-observations): {"source": "modeling/player_forecasts/advanced.py:1016", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/advanced.py:1095 for row in read_jsonl(freeze / \"player_on_ice.jsonl\"):", "modeling/player_forecasts/advanced.py:1117 for row in read_jsonl(freeze / \"team_xg.jsonl\"):", "modeling/player_forecasts/advanced.py:1135 for row in read_jsonl(freeze / \"shot_features.jsonl\"):", "modeling/player_forecasts/advanced.py:1235 for row in read_jsonl(freeze / \"shot_predictions.jsonl\"):", "modeling/player_forecasts/advanced.py:1253 for row in read_jsonl(freeze / \"player_rebounds.jsonl\"):", "modeling/player_forecasts/advanced.py:1269 for row in read_jsonl(freeze / \"goalie_xg.jsonl\"):", "modeling/player_forecasts/advanced.py:1290 ) / 2"]}
  - External references: NST high-danger (slot/home-plate zones), NHL EDGE shot-location bands; MoneyPuck/Evolving-Hockey ixG
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) 'high danger' is distance-only (<=20 ft), not NST's zone-based definition, and named like NST metrics
  - (opus) REBOUNDS_CREATED is a model expectation, not an observed count
  - (opus) player-games appear only when the player has on-ice rows or a shot; games with neither are missing rather than zero, biasing per-game means up
  - (codex:modeling-player-forecasts-advanced-build-advanced-observations) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-004 Advanced goalie danger-band shots/goals against, xGA and GSAx

- **Match:** Both; Opus PFC-007; Codex modeling-player-forecasts-advanced-advanced-reconcile, modeling-player-forecasts-advanced-build-advanced-observations
- **Purpose:** Per-game goalie shot-quality outcomes and derived save percentages
- **Where:** `modeling/player_forecasts/advanced.py:1207 (_build_advanced_observations goalie branch)`; `modeling/player_forecasts/advanced.py:1793 (_advanced_reconcile)`; `modeling/player_forecasts/advanced.py:1793 _advanced_reconcile`; `modeling/player_forecasts/advanced.py:1016 _build_advanced_observations`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game, shots on goal; generation: current
- **Opus view (PFC-007):**
  - Method: SOG with goalie in net and not empty net bucketed by distance (<=20/<=40/>40 ft); goals likewise; EXPECTED_GOALS_AGAINST_GOALIE from goalie_xg; GSAx = xGA - GA; danger goals clipped to shots; danger SV% = (shots-goals)/shots
  - Inputs/units: shot distance in feet; xG goals; sources: nhl_xg_shot_features, nhl_xg_goalie_game_aggregates
  - Output scale: per-game counts; GSAx goals; save fraction 0-1; writes: advanced season-artifact.json
  - Status: unknown — manual CLI season-advanced-train/-evaluate/-project (modeling/player_forecasts/__main__.py:163-175, docs/player-projections/player-forecasts-runbook.md advanced-v5 section); output imported with the season bundle; no scheduler found
  - Consumers: project_advanced_release
- **Codex view (modeling-player-forecasts-advanced-advanced-reconcile, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Advanced reconcile (_advanced_reconcile)
  - Purpose: Advanced reconcile for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _advanced_reconcile(values: dict[str, float], population: str) -> dict[str, float]: reconciled = { key: _rounded(_number(value)) for key, value in _reconcile(values, population).items() } if population == "goalie": reconciled["GOALS_SAVED_ABOVE_EXPECTED"] = _rounded( reconciled.get("EXPECTED_GOALS_AGAINST_GOALIE", 0) - reconciled.get("GOALS_AGAINST_GOALIE", 0) ) for danger in ("HIGH_DANGER", "MID_RANGE", "LONG_RANGE"): shots = reconciled.get(f"{danger}_SHOTS_AGAINST_GOALIE", 0) goals = min(shots, reconciled.get(f"{danger}_GOALS_AGAINST_GOALIE", 0)) reconciled[f"{danger}_GOALS_AGAINST_GOALIE"] = _rounded(goals) saves = max(0.0, shots - goals) reconciled[f"{danger}_SAVES_GOALIE"] = _rounded(saves) reconciled[f"{danger}_SAVE_PERCENTAGE_GOALIE"] = _roun…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-advanced-build-advanced-observations, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Build advanced observations (_build_advanced_observations)
  - Purpose: Build advanced observations for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _build_advanced_observations( freeze: Path, players: dict[int, dict[str, Any]], source_audit: dict[str, Any], ) -> dict[str, Any]: fhfh_by_nhl = { int(value["nhlPlayerId"]): fhfh_id for fhfh_id, value in players.items() if value.get("nhlPlayerId") is not None } skater_games: dict[tuple[int, int], dict[str, Any]] = {} goalie_games: dict[tuple[int, int], dict[str, Any]] = {} team_games: dict[tuple[int, int], dict[str, Any]] = {} def skater_observation( nhl_id: Any, game_id: Any, game_date: Any,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/player-projections/research-contract-v5-season-advanced.json
  - Intended contract (Codex modeling-player-forecasts-advanced-advanced-reconcile): {"source": "modeling/player_forecasts/advanced.py:1793", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/advanced.py:1810 saves / shots if shots > 0 else 0", "modeling/player_forecasts/advanced.py:1825 for_value / (for_value + against_value)"]}
  - Intended contract (Codex modeling-player-forecasts-advanced-build-advanced-observations): {"source": "modeling/player_forecasts/advanced.py:1016", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/advanced.py:1095 for row in read_jsonl(freeze / \"player_on_ice.jsonl\"):", "modeling/player_forecasts/advanced.py:1117 for row in read_jsonl(freeze / \"team_xg.jsonl\"):", "modeling/player_forecasts/advanced.py:1135 for row in read_jsonl(freeze / \"shot_features.jsonl\"):", "modeling/player_forecasts/advanced.py:1235 for row in read_jsonl(freeze / \"shot_predictions.jsonl\"):", "modeling/player_forecasts/advanced.py:1253 for row in read_jsonl(freeze / \"player_rebounds.jsonl\"):", "modeling/player_forecasts/advanced.py:1269 for row in read_jsonl(freeze / \"goalie_xg.jsonl\"):", "modeling/player_forecasts/advanced.py:1290 ) / 2"]}
  - External references: MoneyPuck/Evolving-Hockey GSAx; NST HDSV%
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2331"]}`
- **Leads (not audited):**
  - (opus) goalie danger counts use only SOG while skater danger counts use all attempts - same band names, different denominators
  - (opus) xGA (all unblocked shots incl. misses?) minus GA mixes shot universes if the xG model scores unblocked attempts
  - (codex:modeling-player-forecasts-advanced-advanced-reconcile) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-advanced-build-advanced-observations) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-005 Advanced EDGE context selection

- **Match:** Both; Opus PFC-008; Codex modeling-player-forecasts-advanced-build-edge-contexts
- **Purpose:** Attaches the latest cutoff-safe NHL EDGE snapshot metrics to players and teams (descriptive, zero coefficient)
- **Where:** `modeling/player_forecasts/advanced.py:759 (_build_edge_contexts)`; `modeling/player_forecasts/advanced.py:759 _build_edge_contexts`
- **Tags (heuristic):** generation: current
- **Opus view (PFC-008):**
  - Method: keep rows with available_at <= cutoff and snapshot_date <= cutoff date; latest (snapshot, available) per entity; metrics copied and rounded
  - Inputs/units: NHL EDGE metrics (mph, miles, percents as reported); sources: nhl_edge_skater_metrics_daily, nhl_edge_goalie_metrics_daily, nhl_edge_team_metrics_daily
  - Output scale: descriptive context (zero coefficient); writes: advanced season-artifact.json
  - Status: unknown — manual CLI season-advanced-train/-evaluate/-project (modeling/player_forecasts/__main__.py:163-175, docs/player-projections/player-forecasts-runbook.md advanced-v5 section); output imported with the season bundle; no scheduler found
  - Consumers: advanced release provenance
- **Codex view (modeling-player-forecasts-advanced-build-edge-contexts, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Build edge contexts (_build_edge_contexts)
  - Purpose: Build edge contexts for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _build_edge_contexts( freeze: Path, players: dict[int, dict[str, Any]], context_cutoff_at: str, ) -> dict[str, Any]: cutoff = datetime.fromisoformat(str(context_cutoff_at).replace("Z", "+00:00")) if cutoff.tzinfo is None: raise RuntimeError("NHL EDGE context cutoff must include a timezone") fhfh_by_nhl = { int(value["nhlPlayerId"]): fhfh_id for fhfh_id, value in players.items() if value.get("nhlPlayerId") is not None } player_contexts: dict[str, dict[str, Any]] = {} team_contexts: dict[str, dict[str, Any]] = {} excluded_post_cutoff = 0 def eligible(row: dict[str, Any]) -> tuple[datetime, date] \| None:
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): advanced.py:870 'coefficient remains zero until chronological validation demonstrates lift'
  - Intended contract (Codex modeling-player-forecasts-advanced-build-edge-contexts): {"source": "modeling/player_forecasts/advanced.py:759", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/advanced.py:789 source_path = freeze / f\"{source_name}.jsonl\"", "modeling/player_forecasts/advanced.py:826 source_path = freeze / \"edge_team_context.jsonl\""]}
  - External references: NHL EDGE
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2332"]}`
- **Leads (not audited):**
  - (codex:modeling-player-forecasts-advanced-build-edge-contexts) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-006 Deterministic Gaussian copula simulation for season quantiles

- **Match:** Both; Opus PFC-010; Codex modeling-player-forecasts-advanced-advanced-rate, modeling-player-forecasts-advanced-simulation-quantiles
- **Purpose:** Draws joint samples of all v4+v5 targets to produce reconciled p10/p50/p90
- **Where:** `modeling/player_forecasts/advanced.py:1867 (_simulation_quantiles)`; `modeling/player_forecasts/advanced.py:2040 (player_rows)`; `modeling/player_forecasts/advanced.py:1859 _advanced_rate`; `modeling/player_forecasts/advanced.py:1867 _simulation_quantiles`
- **Tags (heuristic):** generation: current
- **Opus view (PFC-010):**
  - Method: LCG (1664525, 1013904223) Box-Muller normals seeded by SHA-256; one common factor with correlation 0.65 for every target pair; value = mean + sd*(0.65*common + sqrt(1-0.65^2)*idio), clipped >=0; GP/GS capped at components (ROS) or 84; GA capped at SA; each draw reconciled; 256 draws; nearest-rank quantiles
  - Inputs/units: season means and variances; sources: v4 player aggregates, advanced aggregates
  - Output scale: p10/p50/p90 season totals; writes: advanced player-aggregates.jsonl
  - Status: unknown — manual CLI season-advanced-train/-evaluate/-project (modeling/player_forecasts/__main__.py:163-175, docs/player-projections/player-forecasts-runbook.md advanced-v5 section); output imported with the season bundle; no scheduler found
  - Consumers: advanced release import
- **Codex view (modeling-player-forecasts-advanced-advanced-rate, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Advanced rate (_advanced_rate)
  - Purpose: Advanced rate for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _advanced_rate(artifact: dict[str, Any], player_id: int, population: str, target: str) -> float: player = (artifact.get("players") or {}).get(str(player_id)) or {} rate = (player.get("rates") or {}).get(target) if rate is not None: return max(0.0, _number(rate)) return max(0.0, _number(_policy_for(artifact, population, target).get("baselineRate")))
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-advanced-simulation-quantiles, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Simulation quantiles (_simulation_quantiles)
  - Purpose: Simulation quantiles for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _simulation_quantiles( means: dict[str, float], variances: dict[str, float], seed: str, population: str, maximum_games: int \| None = None, draws: int = 256, ) -> tuple[dict[str, float], dict[str, float], dict[str, float]]: state = int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16) def normal() -> float: nonlocal state state = (1664525 * state + 1013904223) & 0xFFFFFFFF first = (state + 0.5) / 4294967296.0 state = (1664525 * state + 1013904223) & 0xFFFFFFFF second = (state + 0.5) / 4294967296.0 return math.sqrt(-2.0 * math.log(first)) * math.cos(2.0 * math.pi * second)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): provenance simulation 'deterministic_reconciled_gaussian_copula_v2', withinPlayerTargetCorrelation 0.65 (advanced.py project_advanced_release)
  - Intended contract (Codex modeling-player-forecasts-advanced-advanced-rate): {"source": "modeling/player_forecasts/advanced.py:1859", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex modeling-player-forecasts-advanced-simulation-quantiles): {"source": "modeling/player_forecasts/advanced.py:1867", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/advanced.py:1879 state = (1664525 * state + 1013904223) & 0xFFFFFFFF", "modeling/player_forecasts/advanced.py:1880 first = (state + 0.5) / 4294967296.0", "modeling/player_forecasts/advanced.py:1881 state = (1664525 * state + 1013904223) & 0xFFFFFFFF", "modeling/player_forecasts/advanced.py:1882 second = (state + 0.5) / 4294967296.0", "modeling/player_forecasts/advanced.py:1883 return math.sqrt(-2.0 * math.log(first)) * math.cos(2.0 * math.pi * second)", "modeling/player_forecasts/advanced.py:1887 independent_weight = math.sqrt(1 - correlation * correlation)", "modeling/player_forecasts/advanced.py:1892 deviation = correlation * common + independent_weight * normal()", "modeling/player_forecasts/advanced.py:1893 value = mean + math.sqrt(max(0.0, variances.get(target, 0))) * deviation"]}
  - External references: Gaussian copula with estimated correlation matrix
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2334"]}`
- **Leads (not audited):**
  - (opus) a single 0.65 correlation for all targets (including GA vs saves, hits vs goals) is unestimated and forbids negative correlations
  - (opus) 256 draws give noisy p10/p90
  - (opus) non-ROS cap of 84 games while the schedule has 82
  - (codex:modeling-player-forecasts-advanced-advanced-rate) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-advanced-simulation-quantiles) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-007 Advanced per-game mean/variance and team season totals

- **Match:** Both; Opus PFC-011; Codex modeling-player-forecasts-advanced-advanced-rate, modeling-player-forecasts-advanced-simulation-quantiles
- **Purpose:** Builds per-game advanced components and team ROS totals with intervals
- **Where:** `modeling/player_forecasts/advanced.py:1965 (game_rows)`; `modeling/player_forecasts/advanced.py:2159 (team_rows)`; `modeling/player_forecasts/advanced.py:1859 (_advanced_rate)`; `modeling/player_forecasts/advanced.py:1859 _advanced_rate`; `modeling/player_forecasts/advanced.py:1867 _simulation_quantiles`
- **Tags (heuristic):** conditionality: conditional; denominators: per game; generation: current
- **Opus view (PFC-011):**
  - Method: mean = rate*p; conditional variance = max(rate, residual80^2); variance = p*cv + p(1-p)*rate^2; p10/p90 = mean -/+ 1.2815515655*sd; team mean = rate*games (pace stays per game); team width = residual80*sqrt(games)
  - Inputs/units: per-game rate; residual80 in target units; probability 0-1; sources: advanced artifact, v4 bundle
  - Output scale: per-game means/variances; team totals; writes: advanced bundles
  - Status: unknown — manual CLI season-advanced-train/-evaluate/-project (modeling/player_forecasts/__main__.py:163-175, docs/player-projections/player-forecasts-runbook.md advanced-v5 section); output imported with the season bundle; no scheduler found
  - Consumers: _simulation_quantiles; team aggregates
- **Codex view (modeling-player-forecasts-advanced-advanced-rate, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Advanced rate (_advanced_rate)
  - Purpose: Advanced rate for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _advanced_rate(artifact: dict[str, Any], player_id: int, population: str, target: str) -> float: player = (artifact.get("players") or {}).get(str(player_id)) or {} rate = (player.get("rates") or {}).get(target) if rate is not None: return max(0.0, _number(rate)) return max(0.0, _number(_policy_for(artifact, population, target).get("baselineRate")))
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-advanced-simulation-quantiles, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Simulation quantiles (_simulation_quantiles)
  - Purpose: Simulation quantiles for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _simulation_quantiles( means: dict[str, float], variances: dict[str, float], seed: str, population: str, maximum_games: int \| None = None, draws: int = 256, ) -> tuple[dict[str, float], dict[str, float], dict[str, float]]: state = int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16) def normal() -> float: nonlocal state state = (1664525 * state + 1013904223) & 0xFFFFFFFF first = (state + 0.5) / 4294967296.0 state = (1664525 * state + 1013904223) & 0xFFFFFFFF second = (state + 0.5) / 4294967296.0 return math.sqrt(-2.0 * math.log(first)) * math.cos(2.0 * math.pi * second)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex modeling-player-forecasts-advanced-advanced-rate): {"source": "modeling/player_forecasts/advanced.py:1859", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex modeling-player-forecasts-advanced-simulation-quantiles): {"source": "modeling/player_forecasts/advanced.py:1867", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/advanced.py:1879 state = (1664525 * state + 1013904223) & 0xFFFFFFFF", "modeling/player_forecasts/advanced.py:1880 first = (state + 0.5) / 4294967296.0", "modeling/player_forecasts/advanced.py:1881 state = (1664525 * state + 1013904223) & 0xFFFFFFFF", "modeling/player_forecasts/advanced.py:1882 second = (state + 0.5) / 4294967296.0", "modeling/player_forecasts/advanced.py:1883 return math.sqrt(-2.0 * math.log(first)) * math.cos(2.0 * math.pi * second)", "modeling/player_forecasts/advanced.py:1887 independent_weight = math.sqrt(1 - correlation * correlation)", "modeling/player_forecasts/advanced.py:1892 deviation = correlation * common + independent_weight * normal()", "modeling/player_forecasts/advanced.py:1893 value = mean + math.sqrt(max(0.0, variances.get(target, 0))) * deviation"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2334"]}`
- **Leads (not audited):**
  - (opus) residual80 (80th percentile of \|error\| ~ 1.28 sd) is used as if it were one standard deviation, then multiplied by 1.28 again - intervals ~1.6x too wide in variance
  - (opus) team interval mean +/- residual80*sqrt(n) treats an 80% half-width as p10/p90 offsets but applies to totals assuming independence
  - (codex:modeling-player-forecasts-advanced-advanced-rate) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-advanced-simulation-quantiles) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-008 Advanced EB rate policy with chronological split and conformal residual

- **Match:** Both; Opus PFC-012; Codex modeling-player-forecasts-advanced-fit-rate-policy, modeling-player-forecasts-advanced-train-advanced-artifact
- **Purpose:** Fits per-entity EB per-game rates for advanced targets and calibrates an 80% absolute residual
- **Where:** `modeling/player_forecasts/advanced.py:875 (_fit_rate_policy)`; `modeling/player_forecasts/advanced.py:621 (_quantile)`; `modeling/player_forecasts/advanced.py:1351 (train_advanced_artifact calls)`; `modeling/player_forecasts/advanced.py:875 _fit_rate_policy`; `modeling/player_forecasts/advanced.py:1301 train_advanced_artifact`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (PFC-012):**
  - Method: development <= 2026-01-02, validation 2026-01-03..2026-04-16; prior = mean of dev rows; rate = (sum + k*prior)/(n + k); challenger chosen if validation rows>=100, entities>=20 and MAE <= baseline; residual80 = nearest-rank 0.8 quantile of \|error\| (rank ceil(p(n+1))); randomized tie coverage via SHA-256 draws; serving rates refit on all rows
  - Inputs/units: per-game counts; prior strength in games; sources: advanced freeze
  - Output scale: per-game rate; residual in target units; coverage 0-1; writes: advanced season-artifact.json
  - Status: unknown — manual CLI season-advanced-train/-evaluate/-project (modeling/player_forecasts/__main__.py:163-175, docs/player-projections/player-forecasts-runbook.md advanced-v5 section); output imported with the season bundle; no scheduler found
  - Consumers: project_advanced_release; evaluate_advanced_batch
- **Codex view (modeling-player-forecasts-advanced-fit-rate-policy, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit rate policy (_fit_rate_policy)
  - Purpose: Fit rate policy for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _fit_rate_policy( observations: list[dict[str, Any]], target: str, prior_strength: float, source_game_coverage: float, ) -> tuple[dict[str, Any], dict[str, float]]: rows = [ (int(row["entityId"]), _day(row["gameDate"]), _number(row["values"].get(target))) for row in observations ] development = [row for row in rows if row[1] <= DEVELOPMENT_END] validation = [row for row in rows if VALIDATION_START <= row[1] <= VALIDATION_END] fit_rows = development or rows prior = sum(row[2] for row in fit_rows) / max(1, len(fit_rows)) development_by_entity: dict[int, list[float]] = defaultdict(list) for entity_id, _, value in fit_rows: development_by_entity[entity_id].append(value) challenger_rates = {
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-advanced-train-advanced-artifact, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Train advanced artifact (train_advanced_artifact)
  - Purpose: Train advanced artifact for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def train_advanced_artifact( freeze: Path, v4_artifact_path: Path, output: Path, ) -> dict[str, Any]: manifest = _assert_advanced_freeze(freeze) v4_artifact, v4_checksum = _verified_v4_artifact(v4_artifact_path) output.mkdir(parents=True, exist_ok=False) source_audit = read_json(freeze / "source-audit.json") if source_audit.get("eligibleForFreeze") is not True: raise RuntimeError("advanced source audit is not eligible for training") players = { int(value["fhfhPlayerId"]): value for value in (v4_artifact.get("players") or {}).values() } edge_contexts = _build_edge_contexts( freeze, players,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): calibrationMethod 'chronological_randomized_conformal_absolute_residual_v1'; evidencePolicy advanced.py:1424
  - Intended contract (Codex modeling-player-forecasts-advanced-fit-rate-policy): {"source": "modeling/player_forecasts/advanced.py:875", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/advanced.py:888 prior = sum(row[2] for row in fit_rows) / max(1, len(fit_rows))", "modeling/player_forecasts/advanced.py:893 entity_id: (sum(values) + prior_strength * prior) / (len(values) + prior_strength)", "modeling/player_forecasts/advanced.py:901 baseline_mae = sum(baseline_errors) / max(1, len(baseline_errors))", "modeling/player_forecasts/advanced.py:902 challenger_mae = sum(challenger_errors) / max(1, len(challenger_errors))", "modeling/player_forecasts/advanced.py:907 below = sum(error < residual_quantile for error in selected_errors)", "modeling/player_forecasts/advanced.py:908 ties = sum(math.isclose(error, residual_quantile, rel_tol=0, abs_tol=1e-12) for error in selected_errors)", "modeling/player_forecasts/advanced.py:910 min(1.0, max(0.0, (0.8 * len(selected_errors) - below) / ties))", "modeling/player_forecasts/advanced.py:914 (below + tie_probability * ties) / len(selected_errors)"]}
  - Intended contract (Codex modeling-player-forecasts-advanced-train-advanced-artifact): {"source": "modeling/player_forecasts/advanced.py:1301", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/advanced.py:1309 source_audit = read_json(freeze / \"source-audit.json\")", "modeling/player_forecasts/advanced.py:1335 assist_coverage = assist_games / source_games", "modeling/player_forecasts/advanced.py:1377 missing_distance_rate = distance_missing / max(1, distance_present + distance_missing)", "modeling/player_forecasts/advanced.py:1448 write_json(output / \"season-artifact.json\", artifact)", "modeling/player_forecasts/advanced.py:1460 write_json(output / \"training-report.json\", report)", "modeling/player_forecasts/advanced.py:1461 artifact_checksum = _file_sha256(output / \"season-artifact.json\")", "modeling/player_forecasts/advanced.py:1471 \"training-report.json\": _file_sha256(output / \"training-report.json\"),", "modeling/player_forecasts/advanced.py:1477 write_json(output / \"artifact-manifest.json\", artifact_manifest)"]}
  - External references: Tango regression to mean; split conformal
  - Fixtures/test data: `generated (not in repo): <advanced artifact dir>/season-artifact.json goldenVectors built at modeling/player_forecasts/advanced.py:1443`
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) source_game_coverage is passed as constant 1.0, so the >=0.95 coverage gate is vacuous
  - (opus) validation window equals the documented lockbox (2026-01-03..04-16) used elsewhere as protected holdout
  - (opus) no decay or prior seasons - single-season EB
  - (codex:modeling-player-forecasts-advanced-fit-rate-policy) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-advanced-train-advanced-artifact) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-009 Expected assists proxied by actual-assist projections

- **Match:** Both; Opus PFC-013; Codex modeling-player-forecasts-advanced-project-advanced-release, modeling-player-forecasts-advanced-v4-assist-policy
- **Purpose:** Fills EXPECTED_PRIMARY/SECONDARY_ASSISTS when shot-assist coverage is low
- **Where:** `modeling/player_forecasts/advanced.py:980 (_v4_assist_policy)`; `modeling/player_forecasts/advanced.py:1703 (settlement)`; `modeling/player_forecasts/advanced.py:1965 (project_advanced_release game_rows)`; `modeling/player_forecasts/advanced.py:1922 project_advanced_release`; `modeling/player_forecasts/advanced.py:980 _v4_assist_policy`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (PFC-013):**
  - Method: expected A1/A2 means and quantiles copied from v4 PRIMARY/SECONDARY_ASSISTS; settlement outcome = actual A1/A2; variance = ((p90-p10)/(2*1.2815515655))^2; always flagged fallback (coverage < 0.80)
  - Inputs/units: per-game assists; sources: v4 season bundle
  - Output scale: per-game assists; writes: advanced bundles
  - Status: unknown — manual CLI season-advanced-train/-evaluate/-project (modeling/player_forecasts/__main__.py:163-175, docs/player-projections/player-forecasts-runbook.md advanced-v5 section); output imported with the season bundle; no scheduler found
  - Consumers: advanced player aggregates
- **Codex view (modeling-player-forecasts-advanced-project-advanced-release, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Project advanced release (project_advanced_release)
  - Purpose: Project advanced release for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def project_advanced_release( advanced_artifact_path: Path, v4_bundle: Path, receipt_path: Path, output: Path, ) -> dict[str, Any]: artifact_root = advanced_artifact_path if advanced_artifact_path.is_dir() else advanced_artifact_path.parent artifact_file = artifact_root / "season-artifact.json" artifact = read_json(artifact_file) artifact_checksum = _file_sha256(artifact_file) artifact_manifest = read_json(artifact_root / "artifact-manifest.json") if ( artifact.get("contractVersion") != ADVANCED_SEASON_CONTRACT_VERSION or artifact.get("contractChecksum") != ADVANCED_SEASON_CONTRACT_SHA256 or artifact_manifest.get("artifactChecksum") != artifact_checksum ): raise RuntimeError("advanced artifact contract or checksum mismatch") receipt = _assert_advanced_r…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-advanced-v4-assist-policy, symbol_candidate, location; Codex family 'Python forecast research and season models'):** V4 assist policy (_v4_assist_policy)
  - Purpose: V4 assist policy for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _v4_assist_policy( v4_artifact: dict[str, Any], population: str, target: str, candidate_game_coverage: float, ) -> dict[str, Any]: source_target = "PRIMARY_ASSISTS" if target == "EXPECTED_PRIMARY_ASSISTS" else "SECONDARY_ASSISTS" source = ((v4_artifact.get("selectionEvidence") or {}).get(population) or {}).get(source_target) or {} return { "target": target, "rows": int(source.get("rows") or 0), "players": int(source.get("players") or 0), "trainingRows": int(source.get("rows") or 0), "fullRows": int(source.get("rows") or 0), "modelFamily": "validated_fantasy_v4_assist_expectation", "baselineModel": source.get("baselineModel") or "population_rate", "validationMae": source.get("validationMae"), "challengerValidationMae": source.get("validationMae"),
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): fallbackReason 'shot_assist_candidate_game_coverage_below_0.80' (advanced.py _v4_assist_policy)
  - Intended contract (Codex modeling-player-forecasts-advanced-project-advanced-release): {"source": "modeling/player_forecasts/advanced.py:1922", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/advanced.py:1929 artifact_file = artifact_root / \"season-artifact.json\"", "modeling/player_forecasts/advanced.py:1932 artifact_manifest = read_json(artifact_root / \"artifact-manifest.json\")", "modeling/player_forecasts/advanced.py:1940 v4_manifest = read_json(v4_bundle / \"import-manifest.json\")", "modeling/player_forecasts/advanced.py:1948 path = v4_bundle / str(metadata[\"path\"])", "modeling/player_forecasts/advanced.py:1954 for row in read_jsonl(v4_bundle / v4_manifest[\"files\"][\"player-aggregates\"][\"path\"])", "modeling/player_forecasts/advanced.py:1958 for row in read_jsonl(v4_bundle / v4_manifest[\"files\"][\"team-aggregates\"][\"path\"])", "modeling/player_forecasts/advanced.py:1966 for row in read_jsonl(v4_bundle / v4_manifest[\"files\"][\"game-outputs\"][\"path\"]):", "modeling/player_forecasts/advanced.py:1996 mean = conditional_value * probability"]}
  - Intended contract (Codex modeling-player-forecasts-advanced-v4-assist-policy): {"source": "modeling/player_forecasts/advanced.py:980", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: xA / shot-assist xG (Evolving-Hockey, HockeyViz)
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) 'expected assists' are actual-assist projections relabelled; settlement scores them against actual assists
  - (codex:modeling-player-forecasts-advanced-project-advanced-release) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-advanced-v4-assist-policy) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-010 Season / rest-of-season aggregation and current-view actuals

- **Match:** Both; Opus PFC-014; Codex modeling-player-forecasts-aggregation-aggregate-rest-of-season, modeling-player-forecasts-season-aggregate-components, modeling-player-forecasts-season-project-season-release
- **Purpose:** Sums per-game components into opening, current and ROS season totals
- **Where:** `modeling/player_forecasts/season.py:4437 (_aggregate_components)`; `modeling/player_forecasts/season.py:4487 (_actuals_by_player)`; `modeling/player_forecasts/season.py:4760 (project_season_release)`; `modeling/player_forecasts/aggregation.py:30 (aggregate_rest_of_season)`; `modeling/player_forecasts/aggregation.py:30 aggregate_rest_of_season`; `modeling/player_forecasts/season.py:4437 _aggregate_components`; `modeling/player_forecasts/season.py:4760 project_season_release`
- **Tags (heuristic):** conditionality: unconditional; denominators: per game; generation: current
- **Opus view (PFC-014):**
  - Method: mean = sum unconditional means; variance = sum variances (independence); quantiles normal with max games = component count; current view adds actuals (games started before cutoff and available before cutoff) to means and to each quantile; ROS = games after cutoff only; aggregation.py same with plays_probability mixture and fullSeason = actual + remaining
  - Inputs/units: per-game means/variances; sources: schedule.json, games.jsonl, skaters/goalies season rows
  - Output scale: season totals and p10/p50/p90; writes: file: player-aggregates.jsonl, team-aggregates.jsonl -> player_forecast_season_player_aggregates / team_aggregates via web/scripts/import-player-forecast-season.ts
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: web/lib/fantasy-projections/seasonJobs.ts; web/lib/fantasy-projections/admin.ts; web/lib/fantasy-projections/readiness.ts
- **Codex view (modeling-player-forecasts-aggregation-aggregate-rest-of-season, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Aggregate rest of season (aggregate_rest_of_season)
  - Purpose: Aggregate rest of season for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def aggregate_rest_of_season( components: Iterable[dict[str, Any]], *, semantics: str, season_to_date_actual: float = 0.0, ) -> dict[str, Any]: if semantics not in {"conditional", "unconditional"}: raise ValueError("semantics must be conditional or unconditional") games = list(components) if not games: raise ValueError("rest-of-season aggregation requires at least one game") moments = [_component_moments(game, semantics == "unconditional") for game in games] remaining_mean = sum(mean for mean, _ in moments) remaining_variance = sum(variance for _, variance in moments) standard_deviation = math.sqrt(remaining_variance) remaining_quantiles = { f"p{int(probability * 100)}": max(0.0, remaining_mean + z_score * standard_deviation) for probability, z_score in…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-season-aggregate-components, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Aggregate components (_aggregate_components)
  - Purpose: Aggregate components for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _aggregate_components(components: list[dict[str, Any]], population: str) -> dict[str, Any]: means: dict[str, float] = defaultdict(float) variances: dict[str, float] = defaultdict(float) for component in components: for target, value in component["unconditionalMeans"].items(): means[target] += float(value) for target, value in component["variances"].items(): variances[target] += float(value) reconciled = _reconcile(dict(means), population) rounded_variances = {key: _round_number(value) for key, value in variances.items()} manifest = sorted( ( {"gameId": int(component["gameId"]), "componentHash": component["componentHash"]} for component in components ), key=lambda row: row["gameId"], ) unsigned = {
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-season-project-season-release, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Project season release (project_season_release)
  - Purpose: Project season release for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def project_season_release( freeze: Path, artifact_path: Path, output: Path, view: str, cutoff_at: str, ) -> dict[str, Any]: if view not in ("opening", "current", "ros"): raise RuntimeError("season projection view must be opening, current, or ros") manifest = read_json(freeze / "manifest.json") artifact = read_json(artifact_path) supported_contracts = { SEASON_CONTRACT_VERSION: SEASON_CONTRACT_SHA256, FANTASY_SEASON_CONTRACT_VERSION: FANTASY_SEASON_CONTRACT_SHA256, } artifact_contract_version = str(artifact.get("contractVersion") or "") artifact_contract_checksum = str(artifact.get("contractChecksum") or "") if (
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): view semantics opening/current/ros: docs/player-projections/player-forecasts-runbook.md (:454) and docs/player-projections/research-contract-v4-season-fantasy.json releaseSemantics; aggregation.py aggregationMethod 'independent_game_moments_normal_approximation'
  - Intended contract (Codex modeling-player-forecasts-aggregation-aggregate-rest-of-season): {"source": "modeling/player_forecasts/aggregation.py:30", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/aggregation.py:42 remaining_mean = sum(mean for mean, _ in moments)", "modeling/player_forecasts/aggregation.py:43 remaining_variance = sum(variance for _, variance in moments)", "modeling/player_forecasts/aggregation.py:46 f\"p{int(probability * 100)}\": max(0.0, remaining_mean + z_score * standard_deviation)"]}
  - Intended contract (Codex modeling-player-forecasts-season-aggregate-components): {"source": "modeling/player_forecasts/season.py:4437", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex modeling-player-forecasts-season-project-season-release): {"source": "modeling/player_forecasts/season.py:4760", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:4769 manifest = read_json(freeze / \"manifest.json\")", "modeling/player_forecasts/season.py:4783 schedule = read_json(freeze / \"schedule.json\")", "modeling/player_forecasts/season.py:4868 team_names = {int(team[\"team_id\"]): team for team in read_json(freeze / \"teams.json\")}", "modeling/player_forecasts/season.py:4875 \"forwards\": sum(player[\"population\"] == \"forward\" for player in members),", "modeling/player_forecasts/season.py:4876 \"defensemen\": sum(player[\"population\"] == \"defense\" for player in members),", "modeling/player_forecasts/season.py:4877 \"goalies\": sum(player[\"population\"] == \"goalie\" for player in members),", "modeling/player_forecasts/season.py:4882 \"confidence\": min(1.0, context[\"sampleGames\"] / 82),", "modeling/player_forecasts/season.py:4903 \"confidence\": min(1.0, context[\"sampleGames\"] / 82),"]}
  - External references: sum of independent game moments; talent-uncertainty correlation (Marcel reliability)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `web/lib/fantasy-projections/fantasyProjections.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2342"]}`
- **Leads (not audited):**
  - (opus) assumes independent games, ignoring shared talent and role uncertainty, so season intervals are far too narrow
  - (opus) rates are not updated with in-season 2026-27 performance; 'current' just adds actuals to an unchanged preseason model
  - (opus) remaining games are taken from the player's current team only (trades not modeled)
  - (codex:modeling-player-forecasts-aggregation-aggregate-rest-of-season) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-aggregate-components) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-project-season-release) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-011 Contextual EB profile: age curve, back-to-back and home/away multipliers

- **Match:** Both; Opus PFC-015; Codex modeling-player-forecasts-season-fit-context-profile, modeling-player-forecasts-season-row-context-multiplier
- **Purpose:** Estimates multiplicative age, rest and venue effects as ratios of game value to player mean
- **Where:** `modeling/player_forecasts/season.py:1711 (_fit_context_profile)`; `modeling/player_forecasts/season.py:1817 (_row_context_multiplier)`; `modeling/player_forecasts/season.py:1691 (_age_on_date)`; `modeling/player_forecasts/season.py:1711 _fit_context_profile`; `modeling/player_forecasts/season.py:1817 _row_context_multiplier`
- **Tags (heuristic):** generation: current
- **Opus view (PFC-015):**
  - Method: ratio = value/player_mean (unclipped); age curve per (position, integer age) = (sum ratios + 100)/(n + 100) clipped [0.8,1.2]; player age baseline = mean of curve over the player's games; B2B = (sum+200)/(n+200) clipped [0.85,1.15]; home/away likewise k=200; row multiplier = (age_curve/player_baseline) * rest * venue clipped [0.7,1.3]; PLUS_MINUS excluded
  - Inputs/units: ratio of game value to player mean (unitless); age in integer years; sources: season freeze, fhfh_player_identities.birth_date
  - Output scale: multipliers (age 0.8-1.2, B2B/venue 0.85-1.15, row 0.7-1.3); writes: season-artifact.json contextProfile
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: contextual_empirical_bayes family; _target_multiplier; _future_age_multiplier
- **Codex view (modeling-player-forecasts-season-fit-context-profile, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit context profile (_fit_context_profile)
  - Purpose: Fit context profile for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _fit_context_profile( rows: list[dict[str, Any]], target: str, birth_dates: dict[int, str \| None], cutoff_date: str \| None, ) -> dict[str, Any]: eligible = [ row for row in rows if (not cutoff_date or str(row["game_date"]) < cutoff_date) and row.get(target) is not None ] if target == "PLUS_MINUS" or not eligible: return { "ageCurves": {}, "playerAgeBaselines": {}, "backToBackMultiplier": 1.0, "homeMultiplier": 1.0,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-season-row-context-multiplier, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Row context multiplier (_row_context_multiplier)
  - Purpose: Row context multiplier for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _row_context_multiplier( row: dict[str, Any], profile: dict[str, Any], birth_dates: dict[int, str \| None], ) -> float: player_id = int(row["nhl_player_id"]) age = _age_on_date(birth_dates.get(player_id), str(row["game_date"])) age_factor = 1.0 if age is not None: age_factor = float( (profile.get("ageCurves") or {}) .get(str(row.get("position") or "unknown"), {}) .get(str(age), 1.0) ) / max( 0.01, float((profile.get("playerAgeBaselines") or {}).get(str(player_id), 1.0)), ) rest_factor = (
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): season.py:1750 comment (do not clip sparse ratios, preserve mean-one identity); docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Context' (:67)
  - Intended contract (Codex modeling-player-forecasts-season-fit-context-profile): {"source": "modeling/player_forecasts/season.py:1711", "explicit_comment": "modeling/player_forecasts/season.py:1750 Do not clip sparse count ratios. Clipping one-goal games for low-rate", "arithmetic_locations": ["modeling/player_forecasts/season.py:1737 player_id: sum(values) / len(values)", "modeling/player_forecasts/season.py:1753 ratio = float(row[target]) / player_mean", "modeling/player_forecasts/season.py:1766 factor = (sum(values) + age_shrinkage) / (len(values) + age_shrinkage)", "modeling/player_forecasts/season.py:1784 sum(age_factors_by_player[player_id])", "modeling/player_forecasts/season.py:1785 / len(age_factors_by_player[player_id])", "modeling/player_forecasts/season.py:1792 (sum(rest_ratios) + rest_shrinkage) / (len(rest_ratios) + rest_shrinkage)", "modeling/player_forecasts/season.py:1797 (sum(home_ratios) + venue_shrinkage)", "modeling/player_forecasts/season.py:1798 / (len(home_ratios) + venue_shrinkage)"]}
  - Intended contract (Codex modeling-player-forecasts-season-row-context-multiplier): {"source": "modeling/player_forecasts/season.py:1817", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:1830 ) / max(", "modeling/player_forecasts/season.py:1845 return max(0.7, min(1.3, age_factor * rest_factor * venue_factor))"]}
  - External references: Hockey aging curves (delta method; scoring peak ~24-27, decline after ~28-30); Marcel age adjustment
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2365"]}`
- **Leads (not audited):**
  - (opus) ratio-to-own-career-mean is a within-player cross-section, prone to survivor bias (players who decline leave the sample) and to era/role confounding
  - (opus) integer-age buckets per position with k=100 pseudo-games; no smoothing across adjacent ages
  - (opus) home and away multipliers are estimated separately, each shrunk to 1.0, so both can sit above or below 1 simultaneously
  - (codex:modeling-player-forecasts-season-fit-context-profile) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-row-context-multiplier) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-012 Future age multiplier (season aging adjustment)

- **Match:** Both; Opus PFC-016; Codex modeling-player-forecasts-season-future-age-multiplier, modeling-player-forecasts-season-train-season-artifact
- **Purpose:** Scales a player's projected rate by age-curve value at season start relative to the player's historical age baseline
- **Where:** `modeling/player_forecasts/season.py:1848 (_future_age_multiplier)`; `modeling/player_forecasts/season.py:3296 (train_season_artifact application)`; `modeling/player_forecasts/season.py:1848 _future_age_multiplier`; `modeling/player_forecasts/season.py:2965 train_season_artifact`
- **Tags (heuristic):** generation: current
- **Opus view (PFC-016):**
  - Method: age at hard-coded 2026-10-01; multiplier = curve[position][age]/max(0.01, player baseline) clipped [0.8,1.2]; applied only if the target's selected family is contextual_empirical_bayes and the player is not a rookie
  - Inputs/units: age in years at 2026-10-01; sources: fhfh_player_identities
  - Output scale: multiplier 0.8-1.2; writes: season-artifact.json
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: evaluate_season_game
- **Codex view (modeling-player-forecasts-season-future-age-multiplier, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Future age multiplier (_future_age_multiplier)
  - Purpose: Future age multiplier for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _future_age_multiplier( profile: dict[str, Any], player_id: int, position: str, birth_date: str \| None, ) -> float: age = _age_on_date(birth_date, "2026-10-01") if age is None: return 1.0 future = float( (profile.get("ageCurves") or {}).get(position, {}).get(str(age), 1.0) ) baseline = max( 0.01, float((profile.get("playerAgeBaselines") or {}).get(str(player_id), 1.0)), ) return max(0.8, min(1.2, future / baseline))
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-season-train-season-artifact, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Train season artifact (train_season_artifact)
  - Purpose: Train season artifact for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def train_season_artifact( freeze: Path, output: Path, *, contract_version: str = SEASON_CONTRACT_VERSION, rookie_freeze: Path \| None = None, ) -> dict[str, Any]: manifest = read_json(freeze / "manifest.json") if manifest.get("contractChecksum") != SEASON_CONTRACT_SHA256: raise RuntimeError("season freeze contract checksum mismatch") if contract_version == FANTASY_SEASON_CONTRACT_VERSION: if rookie_freeze is None: raise RuntimeError("v4 season training requires --rookie-freeze") rookie_captures, rookie_transition_model = load_verified_rookie_source_freeze( rookie_freeze ) rookie_translation_eligible = bool( (rookie_transition_model.get("validation") or {}).get(
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Context' (:67)
  - Intended contract (Codex modeling-player-forecasts-season-future-age-multiplier): {"source": "modeling/player_forecasts/season.py:1848", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:1864 return max(0.8, min(1.2, future / baseline))"]}
  - Intended contract (Codex modeling-player-forecasts-season-train-season-artifact): {"source": "modeling/player_forecasts/season.py:2965", "explicit_comment": "modeling/player_forecasts/season.py:3373 Context profiles are fitted from game-level fields. Once a", "arithmetic_locations": ["modeling/player_forecasts/season.py:2972 manifest = read_json(freeze / \"manifest.json\")", "modeling/player_forecasts/season.py:2997 audit_path = (freeze / str(assist_policy.get(\"auditPath\") or \"\")).resolve()", "modeling/player_forecasts/season.py:3022 freeze / str(metric_policy.get(\"auditPath\") or \"\")", "modeling/player_forecasts/season.py:3048 freeze / str(season_total_policy.get(\"auditPath\") or \"\")", "modeling/player_forecasts/season.py:3056 season_total_path = freeze / \"skater_season_totals.jsonl\"", "modeling/player_forecasts/season.py:3073 skaters = [row for row in read_jsonl(freeze / \"skaters.jsonl\") if int(row[\"season_id\"]) <= TRAINING_CUTOFF_SEASON]", "modeling/player_forecasts/season.py:3074 goalies = [row for row in read_jsonl(freeze / \"goalies.jsonl\") if int(row[\"season_id\"]) <= TRAINING_CUTOFF_SEASON]", "modeling/player_forecasts/season.py:3075 pool = read_json(freeze / \"player-pool.json\")"]}
  - External references: Marcel age factor; standard hockey aging curves
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) aging is applied only for targets where the contextual family won the MAE tournament, so most targets have no aging at all
  - (opus) hard-coded 2026-10-01 reference date and SEASON_ID 20262027
  - (codex:modeling-player-forecasts-season-future-age-multiplier) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-train-season-artifact) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-013 Current-appearance skater rate (current-season-only decayed mean)

- **Match:** Both; Opus PFC-017; Codex web-lib-player-forecasts-baselinerates-buildcurrentappearanceskaterrates
- **Purpose:** Native per-appearance skater rates using only current-season positive-minute appearances, no prior.
- **Where:** `web/lib/player-forecasts/baselineRates.ts:14 (CURRENT_APPEARANCE_POLICY)`; `web/lib/player-forecasts/baselineRates.ts:231 (buildCurrentAppearanceSkaterRates)`; `web/lib/player-forecasts/baselineGeneration.ts:229 (TIME_ON_ICE_PER_GAME = appearanceSeconds/60)`; `web/lib/player-forecasts/baselineRates.ts:231 buildCurrentAppearanceSkaterRates`
- **Tags (heuristic):** denominators: per 60, per game, per appearance, shots on goal; generation: current
- **Opus view (PFC-017):**
  - Method: Up to 20 most recent current-season regular-season positive-minute appearances, weight 0.9^index; rate = sum(w*x)/sum(w) per target. Targets GOALS, ASSISTS, POINTS, PP_POINTS, SHOTS_ON_GOAL, HITS, BLOCKED_SHOTS, PENALTY_MINUTES, TIME_ON_ICE_PER_GAME (minutes = seconds/60). No prior, no shrinkage; target missing if no valid observation.
  - Inputs/units: boxscore counts per game; TOI seconds converted to minutes (/60); sources: nhl_api_game_payloads_raw (boxscore, landing), player_forecast_source_observations
  - Output scale: count per appearance; TIME_ON_ICE_PER_GAME and PENALTY_MINUTES in minutes; writes: player_forecast_source_observations (native baseline observations, via cadence/publication)
  - Status: live — approved policy current-appearance-skater-rates-v1 (nativeDailyPipelineV2.ts:35), produced by scripts/forge-daily-v2.ts and scripts/native-means-capture.ts, served to Start Chart/RSO/FORGE via native catalog head
  - Consumers: nativeDailyMeansCapture.assembleNativeDailyMeans; baselineGeneration bundle; planningContributions (RSO, Start Chart, FORGE game expectations)
- **Codex view (web-lib-player-forecasts-baselinerates-buildcurrentappearanceskaterrates, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Current-season native skater means (buildCurrentAppearanceSkaterRates)
  - Purpose: At most 20 current verified positive-minute appearances; weighted sum / weight sum using .9^original appearance age; missing target skips numerator/denominator.
  - Inputs/units: Named model/observation inputs at cited declaration; G,A,PTS,PPP,SOG,HIT,BLK,PIM counts and TOI minutes per appearance; no participation inferred. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: G,A,PTS,PPP,SOG,HIT,BLK,PIM counts and TOI minutes per appearance; no participation inferred.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["current-appearance-skater-rates-v1", "native-prior-appearance-skater-rates-v1", "skater-baseline-rates-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): baselineRates.ts:230 'Explicit current-season-only mean'; tasks/prd-forge-daily-pipeline.md (v2 fresh native means)
  - Intended contract (Codex web-lib-player-forecasts-baselinerates-buildcurrentappearanceskaterrates): {"source": "web/lib/player-forecasts/baselineRates.ts:231", "explicit_comment": "Explicit current-season-only mean. Callers authenticate retained receipts before deriving TOI.", "arithmetic_locations": ["web/lib/player-forecasts/baselineRates.ts:251 const weight = CURRENT_APPEARANCE_POLICY.decay ** index;", "web/lib/player-forecasts/baselineRates.ts:252 numerator += weight * value; denominator += weight; selected.push(row);", "web/lib/player-forecasts/baselineRates.ts:255 targets.push({ targetKey, ratePerAppearance: numerator / denominator, consensusRate: null, previousSeasonRate: null,"]}
  - External references: Marcel / Tango regression to the mean (absent here); EWMA recency weighting
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/contributions.test.ts`; `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/contributions.test.ts:11"]}`
- **Leads (not audited):**
  - (opus) no regression to the mean; a player with 1-2 current-season games gets a raw 1-2 game mean (e.g. 1.0 goals/game) used for RSO totals
  - (opus) native means stage prefers this policy over prior-appearance whenever any current observation exists (nativeDailyMeansCapture.ts:467), so prior season is discarded rather than blended
  - (opus) PIM conditioned on positive minutes excludes penalty-only zero-TOI games
  - (codex:web-lib-player-forecasts-baselinerates-buildcurrentappearanceskaterrates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-014 Prior-appearance skater rates (previous-season arithmetic means + mean TOI)

- **Match:** Both; Opus PFC-018; Codex web-lib-player-forecasts-baselinerates-buildpriorappearanceskaterrates
- **Purpose:** Native prior-season fallback rates for skaters with no current-season appearances.
- **Where:** `web/lib/player-forecasts/baselineRates.ts:204 (buildPriorAppearanceSkaterRates)`; `web/lib/player-forecasts/baselineRates.ts:217 (mean minutes)`; `web/lib/player-forecasts/nativeDailyMeansCapture.ts:467 (policy fallback selection)`; `web/lib/player-forecasts/baselineRates.ts:204 buildPriorAppearanceSkaterRates`
- **Tags (heuristic):** conditionality: conditional; denominators: per appearance; generation: current
- **Opus view (PFC-018):**
  - Method: Counts: reuses legacy buildSkaterBaselineRates with no projections and no recent games, so rate = prior = arithmetic mean of prior-season appearance counts (20*prior/20). TOI = sum(appearanceSeconds)/(60*n). Appearances must be 0 < seconds <= 65*60 within Jul-1..Jul-1 of prior season. Native capture bounds select 20 prior appearances (from 40 candidates).
  - Inputs/units: previous-season boxscore counts; appearanceSeconds (seconds) -> minutes; sources: nhl_api_game_payloads_raw (boxscore)
  - Output scale: count per appearance; TOI minutes per appearance; writes: player_forecast_source_observations
  - Status: live — approved policy native-prior-appearance-skater-rates-v1 (nativeDailyPipelineV2.ts:35), fallback when no current observation (nativeDailyMeansCapture.ts:467)
  - Consumers: nativeDailyMeansCapture.assembleNativeDailyMeans; planning contributions
- **Codex view (web-lib-player-forecasts-baselinerates-buildpriorappearanceskaterrates, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Prior-season native skater means (buildPriorAppearanceSkaterRates)
  - Purpose: Native previous-season appearance count means; TOI arithmetic mean of selected verified seconds divided by 60.
  - Inputs/units: Named model/observation inputs at cited declaration; Conditional counts and minutes per appearance; no external projections. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Conditional counts and minutes per appearance; no external projections.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["current-appearance-skater-rates-v1", "native-prior-appearance-skater-rates-v1", "skater-baseline-rates-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): baselineRates.ts:202 'Native prior-only extension... every retained opportunity must carry positive original minutes'
  - Intended contract (Codex web-lib-player-forecasts-baselinerates-buildpriorappearanceskaterrates): {"source": "web/lib/player-forecasts/baselineRates.ts:204", "explicit_comment": "Native prior-only extension. Caller authenticates original boxscores before this calculation; every retained opportunity must carry positive original minutes.", "arithmetic_locations": ["web/lib/player-forecasts/baselineRates.ts:212 \|\| (row.finalBoxscore as BaselineBoxscoreReceipt).appearanceSeconds > 65 * 60)) {", "web/lib/player-forecasts/baselineRates.ts:217 const minutes = previous.reduce((sum, row) => sum + (row.finalBoxscore as BaselineBoxscoreReceipt).appearanceSeconds, 0) / (60 * previous.length);", "web/lib/player-forecasts/baselineRates.ts:230 /** Explicit current-season-only mean. Callers authenticate retained receipts before deriving TOI. */"]}
  - External references: Marcel prior season weighting; NHL TOI per game
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/contributions.test.ts`; `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/contributions.test.ts:11"]}`
- **Leads (not audited):**
  - (opus) prior-season means used un-regressed and unaged (no age curve, no team/role change adjustment)
  - (opus) policy says 82-appearance window but native capture bound is 20 prior appearances (NATIVE_MEANS_BOUNDS.priorAppearances)
  - (codex:web-lib-player-forecasts-baselinerates-buildpriorappearanceskaterrates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-015 Legacy skater baseline per-appearance rate (projection consensus + prior season prior, decayed recent form)

- **Match:** Both; Opus PFC-019; Codex web-lib-player-forecasts-baselinerates-buildskaterbaselinerates
- **Purpose:** Per-appearance skater count rates blending public projection consensus, previous-season history and decayed current-season games.
- **Where:** `web/lib/player-forecasts/baselineRates.ts:90 (buildSkaterBaselineRates)`; `web/lib/player-forecasts/baselineRates.ts:139 (consensusRate)`; `web/lib/player-forecasts/baselineRates.ts:146 (prior blend)`; `web/lib/player-forecasts/baselineRates.ts:154 (recent decay loop)`; `web/lib/player-forecasts/baselineRates.ts:167 (ratePerAppearance)`; `web/lib/player-forecasts/baselinePolicy.ts:56 (BASELINE_CANDIDATE_POLICY)`; `web/lib/player-forecasts/baselineRates.ts:90 buildSkaterBaselineRates`
- **Tags (heuristic):** denominators: per game, per appearance, all strengths; generation: legacy, current
- **Opus view (PFC-019):**
  - Method: consensusRate = equal-weight mean over available sources of total/projectedGP. previousSeasonRate = arithmetic mean over up to 82 most recent prior-season (seasonId-10001) regular-season appearances. prior = 0.6*consensus + 0.4*previous (falls back to whichever exists). Recent = up to 20 current-season appearances, weight 0.9^index (index counts all appearances in window, missing targets skip numerator+denominator but keep age). rate = (20*prior + sum(w*x)) / (20 + sum(w)), i.e. prior counts as 20 pseudo-appearances (max recent weight ~8.78, so recent form <=~30%). PLUS_MINUS may be negative; other targets must be >=0. Skips GP, SH%, FO%, TOI, SV%, GAA.
  - Inputs/units: projection season totals and projected games played; boxscore counts per game (all strengths); TOI not a target here; sources: PROJECTIONS_{season}_AG_SKATERS, PROJECTIONS_{season}_CULLEN_SKATERS, PROJECTIONS_{season}_DTZ_SKATERS, PROJECTIONS_{season}_5V5_SKATERS, nhl_api_game_payloads_raw (boxscore), games
  - Output scale: count per appearance (non-negative except PLUS_MINUS); writes: —
  - Status: legacy/dead — (projection-blend path) skater-baseline-rates-v1 is not in NATIVE_DAILY_APPROVED_METHODS (nativeDailyPipelineV2.ts:35); function still live as the kernel of the prior-appearance policy (baselineRates.ts:215)
  - Consumers: baselineGeneration.buildBaselineContributionBundle; buildNativeSkaterBaselineSnapshot (legacy branch); contributions.resolveContribution baseline source
- **Codex view (web-lib-player-forecasts-baselinerates-buildskaterbaselinerates, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Hybrid skater baseline rate (buildSkaterBaselineRates)
  - Purpose: Equal-source per-appearance projection rate; .6 projection/.4 prior-season mean when both exist; blend 20 prior appearances with at most 20 current appearances weighted .9^age.
  - Inputs/units: Named model/observation inputs at cited declaration; Supported additive target count per appearance; PLUS_MINUS may be signed. Explicit unvalidated candidate. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Supported additive target count per appearance; PLUS_MINUS may be signed. Explicit unvalidated candidate.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["current-appearance-skater-rates-v1", "native-prior-appearance-skater-rates-v1", "skater-baseline-rates-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): baselineRates.ts:89 'A pure, cutoff-safe candidate'; baselinePolicy.ts:21 'Candidate ingredients are independent of dashboard selection'; baselinePolicy.ts:73 definition pinned by hash
  - Intended contract (Codex web-lib-player-forecasts-baselinerates-buildskaterbaselinerates): {"source": "web/lib/player-forecasts/baselineRates.ts:90", "explicit_comment": "A pure, cutoff-safe candidate. Inputs must retain their original availability timestamps.", "arithmetic_locations": ["web/lib/player-forecasts/baselineRates.ts:140 ? sourceRows.reduce((sum, row) => sum + row.totals[targetKey]! / row.projectedAppearances, 0) / sourceRows.length", "web/lib/player-forecasts/baselineRates.ts:144 ? previousRows.reduce((sum, row) => sum + row.targets[targetKey]!, 0) / previousRows.length : null;", "web/lib/player-forecasts/baselineRates.ts:147 ? POLICY.projectionPriorWeight * consensusRate + POLICY.historyPriorWeight * previousSeasonRate", "web/lib/player-forecasts/baselineRates.ts:157 const weight = POLICY.recentDecay ** index;", "web/lib/player-forecasts/baselineRates.ts:158 weightedRecent += weight * value;", "web/lib/player-forecasts/baselineRates.ts:167 ratePerAppearance: (POLICY.priorAppearanceWeight * prior + weightedRecent)", "web/lib/player-forecasts/baselineRates.ts:168 / (POLICY.priorAppearanceWeight + recentWeight),", "web/lib/player-forecasts/baselineRates.ts:202 /** Native prior-only extension. Caller authenticates original boxscores before this"]}
  - External references: Marcel projections (weighted seasons + regression to mean); Tango regression to the mean with k pseudo-games
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/contributions.test.ts`; `web/lib/player-forecasts/nativeBaselinePublication.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/contributions.test.ts:11", "web/lib/player-forecasts/nativeBaselinePublication.test.ts:17", "web/lib/player-forecasts/nativeContributionAdmission.test.ts:5"]}`
- **Leads (not audited):**
  - (opus) reads draft-dashboard PROJECTIONS_* tables (equal-weight external consensus); native path excludes them, check against the 10-26 'FORGE must not read PROJECTIONS_* tables' rule
  - (opus) fixed k=20 pseudo-appearances for every target regardless of stat stability (goals vs hits), not stat-specific regression
  - (opus) whole-game all-strength boxscore counts; no TOI, role, opponent or participation adjustment
  - (opus) legacy 20252026 schema hard-coded with per-source column allowlists; dtz/5v5 skaters unsupported for legacy season
  - (opus) definition hash pinned at module load (throws if policy changes)
  - (codex:web-lib-player-forecasts-baselinerates-buildskaterbaselinerates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-016 Current-season SOG appearance mean (VAN canary)

- **Match:** Both; Opus PFC-022; Codex web-lib-player-forecasts-currentseasonsogbaseline-assemblecurrentseasonsogbaseline
- **Purpose:** Small-sample conditional shots-on-goal mean for one scoped player-game.
- **Where:** `web/lib/player-forecasts/currentSeasonSogBaseline.ts:9 (CURRENT_SEASON_SOG_SCOPE)`; `web/lib/player-forecasts/currentSeasonSogBaseline.ts:97 (assembleCurrentSeasonSogBaseline)`; `web/lib/player-forecasts/currentSeasonSogBaseline.ts:172 (totalShots/appearances)`; `web/lib/player-forecasts/currentSeasonSogContribution.ts:20 (buildCurrentSeasonSogContribution)`; `web/lib/player-forecasts/currentSeasonSogBaseline.ts:97 assembleCurrentSeasonSogBaseline`
- **Tags (heuristic):** denominators: per game, per appearance, shots on goal; generation: development, current
- **Opus view (PFC-022):**
  - Method: Latest up to 5 final team regular-season games in declared date window; mean = sum(SOG)/positive-minute appearances; zero-minute and unlisted games excluded. Expires at game start or now+1 day. Resolver uses it conditional only (participation null).
  - Inputs/units: boxscore SOG counts per game; sources: api-web.nhle.com schedule and gamecenter boxscore (captured HTTP receipts)
  - Output scale: SOG per appearance (count); writes: —
  - Status: draft — status 'unreleased_local', publicUsesApproved false; run only via scripts/capture-current-season-sog-baseline.ts
  - Consumers: scripts/capture-current-season-sog-baseline.ts; contributions.resolveContribution (CURRENT_SEASON_SOG_CONTRIBUTION_VERSION branch)
- **Codex view (web-lib-player-forecasts-currentseasonsogbaseline-assemblecurrentseasonsogbaseline, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Assemble current season sog baseline (assembleCurrentSeasonSogBaseline)
  - Purpose: Offline assembly only: no fetch, database, projections, prior season or public admission.
  - Inputs/units: Parameter/type declaration excerpt: export function assembleCurrentSeasonSogBaseline(input: CurrentSeasonSogResponses, now = new Date(), gameScope?: CurrentSeasonSogGameScope) { const generatedAt = now.toISOString(), generated = timestampMicros(generatedAt)!; const explicit = gameScope === undefined ? undefined : validatedGameScope(gameScope, generatedAt); const cutoffAt = explicit?.cutoffAt ?? generatedAt, cutoff = timestampMicros(cutoffAt)!; const scope = explicit ?? CURRENT_SEASON_SOG_SCOPE; if (!exactKeys(input, ["schedule", "boxscores"]) \|\| !Array.isArray(input.boxscores) \|\| input.boxscores.length > scope.maximumGames) throw new Error("Expected one schedule and at most five boxscores."); const responses = [input.schedule, ...input.boxscores]; if (responses.some(row => !row \|\| t…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["current-season-sog-appearance-mean-v1", "current-season-sog-game-scope-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): currentSeasonSogBaseline.ts:96 'Offline assembly only: no fetch, database, projections, prior season or public admission.'
  - Intended contract (Codex web-lib-player-forecasts-currentseasonsogbaseline-assemblecurrentseasonsogbaseline): {"source": "web/lib/player-forecasts/currentSeasonSogBaseline.ts:97", "explicit_comment": "Offline assembly only: no fetch, database, projections, prior season or public admission.", "arithmetic_locations": ["web/lib/player-forecasts/currentSeasonSogBaseline.ts:181 mean: totalShots / appearances.length, totalShots, sampleSize: appearances.length,"]}
  - External references: Tango regression to the mean for shot rates
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/currentSeasonSogBaseline.test.ts`; `web/lib/player-forecasts/currentSeasonSogContribution.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/currentSeasonSogBaseline.test.ts:4", "web/lib/player-forecasts/currentSeasonSogContribution.test.ts:4"]}`
- **Leads (not audited):**
  - (opus) default scope hard-coded to one player (playerId 10047 / NHL 8478444, VAN), season 20262027, game 2026020112, dates 2026-10-01..10-14
  - (opus) n<=5 raw mean with no prior
  - (codex:web-lib-player-forecasts-currentseasonsogbaseline-assemblecurrentseasonsogbaseline) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-017 Native power-play points per game (landing scoring summary)

- **Match:** Both; Opus PFC-024; Codex web-lib-player-forecasts-nativepowerplaypoints-derivenativepowerplaypoints
- **Purpose:** Count PP goals and PP assists per game from the landing scoring summary, cross-checked with boxscore.
- **Where:** `web/lib/player-forecasts/nativePowerPlayPoints.ts:22 (deriveNativePowerPlayPoints)`; `web/lib/player-forecasts/baselineGeneration.ts:196 (PP_POINTS substitution)`; `web/lib/player-forecasts/nativePowerPlayPoints.ts:22 deriveNativePowerPlayPoints`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (PFC-024):**
  - Method: Sum goals with strength 'pp' credited as scorer (PPG) or assister (PPA); shootout goals skipped; team goal totals must equal final score minus shootout winner goal; per-player goals/assists/PPG must equal boxscore. PPP = PPG + PPA, replaces/validates boxscore PP_POINTS.
  - Inputs/units: landing scoring summary goal events with strength codes ev/pp/sh; boxscore counts; sources: nhl_api_game_payloads_raw (endpoints landing, boxscore)
  - Output scale: integer PP goals, PP assists, PPP per game; writes: —
  - Status: live — landings captured in native means capture and substituted into PP_POINTS (baselineGeneration.ts:196)
  - Consumers: buildNativeSkaterBaselineSnapshot -> current/prior skater rates
- **Codex view (web-lib-player-forecasts-nativepowerplaypoints-derivenativepowerplaypoints, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Official native PP-point count (deriveNativePowerPlayPoints)
  - Purpose: Count goal/assist credit in verified power-play goal events with retained boxscore/PBP identity and timing; distinguish unavailable support from zero.
  - Inputs/units: Native final boxscore and PBP goal/assist strength evidence.
  - Output scale: Integer power-play points and provenance/availability state.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): nativePowerPlayPoints.ts:20 'Historical observed counts only. Never guesses strength from manpower, fills missing summaries with zero'
  - Intended contract (Codex web-lib-player-forecasts-nativepowerplaypoints-derivenativepowerplaypoints): {"source": "web/lib/player-forecasts/nativePowerPlayPoints.ts:22", "explicit_comment": "Historical observed counts only. Never guesses strength from manpower, fills missing summaries with zero, or modifies a captured baseline bundle.", "arithmetic_locations": []}
  - External references: NHL official PPP definition (goal scored with team on power play)
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts`; `web/lib/player-forecasts/nativePowerPlayPoints.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/nativePowerPlayPoints.test.ts:5"]}`
- **Leads (not audited):**
  - (opus) relies on API 'pp' strength code; 5-on-3 and delayed-penalty edge cases follow API labels
  - (codex:web-lib-player-forecasts-nativepowerplaypoints-derivenativepowerplaypoints) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-018 Daily-board opponent/home/player-residual ridge context model

- **Match:** Both; Opus PFC-025; Codex modeling-player-forecasts-daily-board-context-context-features, modeling-player-forecasts-daily-board-context-fit-context, modeling-player-forecasts-daily-board-context-predict-context
- **Purpose:** Adjusts the recent baseline with home, opponent residual and player residual features
- **Where:** `modeling/player_forecasts/daily_board_context.py:42 (context_features)`; `modeling/player_forecasts/daily_board_context.py:140 (fit_context)`; `modeling/player_forecasts/daily_board_context.py:166 (predict_context)`; `modeling/player_forecasts/daily_board_context.py:24 (POLICY)`; `modeling/player_forecasts/daily_board_context.py:42 context_features`; `modeling/player_forecasts/daily_board_context.py:140 fit_context`; `modeling/player_forecasts/daily_board_context.py:166 predict_context`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: research, development, current
- **Opus view (PFC-025):**
  - Method: opponent residual = mean over last 5 (min 2) opponent games of per-game cohort-average residual (outcome - recent baseline); player residual = mean of last 5 (min 2) same-season residuals; 2-day lag; standardized features, ridge 10 with unpenalized intercept on residual target; prediction = max(0, baseline + x.w); reconciliation caps G<=SOG and PPP<=min(G,SOG)+A
  - Inputs/units: per-game category residuals; home 0/1; sources: daily-board history freeze
  - Output scale: per-game category estimates; fantasy points; writes: file: model.json, evaluation.jsonl, report.json (outside repo)
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: research report (servingDecision retain_FORGE)
- **Codex view (modeling-player-forecasts-daily-board-context-context-features, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Context features (context_features)
  - Purpose: Opponent history contains only residuals of forecasts made from older games.  Outcomes are attached for fitting/scoring, never used in their own features. This is a retrospective appearance cohort, not a pregame candidate pool.
  - Inputs/units: Parameter/type declaration excerpt: def context_features(records: list[dict]) -> dict: """Opponent history contains only residuals of forecasts made from older games. Outcomes are attached for fitting/scoring, never used in their own features. This is a retrospective appearance cohort, not a pregame candidate pool. """ ordered = sorted(records, key=lambda r: (r["game_date"], r["game_id"], r["player_id"])) if ordered: validate_range(ordered[0]["game_date"], ordered[-1]["game_date"]) seen, contexts = set(), {} for row in ordered: identity = row["game_id"], row["player_id"] if identity in seen: raise ValueError("duplicate context player game") seen.add(identity) if row.get("evidence_classification") != "historical_reconstruction" or row.get("settlement_status") != "final": raise ValueError("…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-daily-board-context-fit-context, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit context (fit_context)
  - Purpose: Fit context for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def fit_context(rows: list[dict]) -> dict: if not rows: raise ValueError("no eligible context training rows") models = {} for category in CATEGORIES: models[category] = {} for model, names in FEATURES.items(): means = [sum(r["features"][category][n] for r in rows) / len(rows) for n in names] scales = [max(1e-6, math.sqrt(sum((r["features"][category][n] - mean) ** 2 for r in rows) / len(rows))) for n, mean in zip(names, means)] size = len(names) + 1 matrix, vector = [[0.0] * size for _ in range(size)], [0.0] * size for row in rows: x = [1.0] + [(row["features"][category][n] - mean) / scale for n, mean, scale in zip(names, means, scales)] y = row["outcomes"][category] - row["estimates"][category]["recent_season"] for i in range(size): vector[i] += x[i] * …
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-daily-board-context-predict-context, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Predict context (predict_context)
  - Purpose: Predict context for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def predict_context(row: dict, artifact: dict) -> dict: if artifact.get("policy") != POLICY: raise ValueError("context model policy mismatch") estimates = {c: {"recent_season": row["estimates"][c]["recent_season"]} for c in CATEGORIES} for category in CATEGORIES: for model, fitted in artifact["models"][category].items(): x = [1.0] + [(row["features"][category][n] - mean) / scale for n, mean, scale in zip(fitted["features"], fitted["means"], fitted["scales"])] estimates[category][model] = max(0.0, estimates[category]["recent_season"] + sum(a * b for a, b in zip(x, fitted["weights"]))) adjustments = Counter() for model in MODELS: for category, ceiling in (("GOALS", estimates["SHOTS_ON_GOAL"][model]), ("PP_POINTS", min(estimates["GOALS"][model], estimates[…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): daily_board_context.py:1 docstring and POLICY (:24)
  - Intended contract (Codex modeling-player-forecasts-daily-board-context-context-features): {"source": "modeling/player_forecasts/daily_board_context.py:42", "explicit_comment": "Opponent history contains only residuals of forecasts made from older games.\n\nOutcomes are attached for fitting/scoring, never used in their own features.\nThis is a retrospective appearance cohort, not a pregame candidate pool.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_context.py:96 eligible.append({**row, \"home\": int(original[\"home\"]), \"season_id\": original[\"season_id\"],", "modeling/player_forecasts/daily_board_context.py:107 \"residuals\": {c: sum(r[\"outcomes\"][c] - r[\"estimates\"][c][\"recent_season\"] for r in rows) / len(rows) for c in CATEGORIES},", "modeling/player_forecasts/daily_board_context.py:129 features = {c: {\"home\": row[\"home\"], \"opponent_residual\": sum(p[\"residuals\"][c] for p in past) / len(past),", "modeling/player_forecasts/daily_board_context.py:130 \"player_residual\": sum(p[\"outcomes\"][c] - p[\"estimates\"][c][\"recent_season\"] for p in player_past) / len(player_past)} for c in CATEGORIES}", "modeling/player_forecasts/daily_board_context.py:131 result.append({**row, \"features\": features, \"opponent_history_games\": [p[\"gam…
  - Intended contract (Codex modeling-player-forecasts-daily-board-context-fit-context): {"source": "modeling/player_forecasts/daily_board_context.py:140", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_context.py:147 means = [sum(r[\"features\"][category][n] for r in rows) / len(rows) for n in names]", "modeling/player_forecasts/daily_board_context.py:148 scales = [max(1e-6, math.sqrt(sum((r[\"features\"][category][n] - mean) ** 2 for r in rows) / len(rows))) for n, mean in zip(names, means)]", "modeling/player_forecasts/daily_board_context.py:150 matrix, vector = [[0.0] * size for _ in range(size)], [0.0] * size", "modeling/player_forecasts/daily_board_context.py:152 x = [1.0] + [(row[\"features\"][category][n] - mean) / scale for n, mean, scale in zip(names, means, scales)]", "modeling/player_forecasts/daily_board_context.py:155 vector[i] += x[i] * y", "modeling/player_forecasts/daily_board_context.py:157 matrix[i][j] += x[i] * x[j]"]}
  - Intended contract (Codex modeling-player-forecasts-daily-board-context-predict-context): {"source": "modeling/player_forecasts/daily_board_context.py:166", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_context.py:172 x = [1.0] + [(row[\"features\"][category][n] - mean) / scale for n, mean, scale in zip(fitted[\"features\"], fitted[\"means\"], fitted[\"scales\"])]", "modeling/player_forecasts/daily_board_context.py:173 estimates[category][model] = max(0.0, estimates[category][\"recent_season\"] + sum(a * b for a, b in zip(x, fitted[\"weights\"])))", "modeling/player_forecasts/daily_board_context.py:181 estimates[\"DEFAULT_FANTASY_POINTS\"] = {m: sum(estimates[c][m] * w for c, w in WEIGHTS.items()) for m in MODELS}", "modeling/player_forecasts/daily_board_context.py:182 return {**row, \"estimates\": estimates, \"outcomes\": {**row[\"outcomes\"],", "modeling/player_forecasts/daily_board_context.py:183 \"DEFAULT_FANTASY_POINTS\": sum(row[\"outcomes\"][c] * w for c, w in WEIGHTS.items())}, \"reconciliationCounts\": dict(adjustments)}"]}
  - External references: ridge regression on residuals; opponent-adjusted rates
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1614"]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1685"]}`
- **Leads (not audited):**
  - (opus) opponent residual is the mean over observed appearing players, not team defensive totals (acknowledged)
  - (codex:modeling-player-forecasts-daily-board-context-context-features) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-daily-board-context-fit-context) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-daily-board-context-predict-context) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-019 Goalie start probability temperature scaling

- **Match:** Both; Opus PFC-028; Codex modeling-player-forecasts-daily-board-models-fit-goalie-temperature, modeling-player-forecasts-daily-board-models-goalie-start-probabilities, modeling-player-forecasts-daily-board-models-logistic-probability
- **Possible related records (low-confidence location link, unconfirmed):** modeling-player-forecasts-daily-board-goalies-goalie-groups, modeling-player-forecasts-daily-board-goalies-train-goalie-calibration
- **Purpose:** Calibrates FORGE goalie-start probabilities within a team by temperature
- **Where:** `modeling/player_forecasts/daily_board_models.py:140 (goalie_start_probabilities)`; `modeling/player_forecasts/daily_board_models.py:147 (fit_goalie_temperature)`; `modeling/player_forecasts/daily_board_goalies.py:24 (goalie_groups)`; `modeling/player_forecasts/daily_board_goalies.py:82 (train_goalie_calibration)`; `modeling/player_forecasts/daily_board_models.py:147 fit_goalie_temperature`; `modeling/player_forecasts/daily_board_models.py:140 goalie_start_probabilities`; `modeling/player_forecasts/daily_board_models.py:133 logistic_probability`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per team game; generation: research, development, current
- **Opus view (PFC-028):**
  - Method: p_i' proportional to p_i^(1/T); T grid {0.5,0.75,1,1.25,1.5,2,3}; choose min mean log loss (tie toward T=1); evaluate Brier/log loss/calibration bins on later window; team-games need >=2 candidates and exactly one starter
  - Inputs/units: probabilities 0-1 summing to 1 per team; sources: settled FORGE forecast bundles
  - Output scale: probability 0-1; temperature 0.5-3; writes: file: model.json, evaluation.jsonl, report.json
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: research report (servingDecision retain_FORGE)
- **Codex view (modeling-player-forecasts-daily-board-models-fit-goalie-temperature, calculation, location; Codex family 'Python forecast research and season models'):** Goalie temperature selection (fit_goalie_temperature)
  - Purpose: Minimize average verified starter negative log likelihood over fixed temperatures .5,.75,1,1.25,1.5,2,3.
  - Inputs/units: Named model/observation inputs at cited declaration; Selected research temperature and training log loss; no promotion. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Selected research temperature and training log loss; no promotion.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-daily-board-models-goalie-start-probabilities, calculation, location; Codex family 'Python forecast research and season models'):** Goalie probability temperature scaling (goalie_start_probabilities)
  - Purpose: Normalize p_i^(1/temperature) over complete team candidate probabilities.
  - Inputs/units: Named model/observation inputs at cited declaration; Team goalie start probabilities summing to 1. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Team goalie start probabilities summing to 1.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-daily-board-models-logistic-probability, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Logistic probability (logistic_probability)
  - Purpose: Logistic probability for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def logistic_probability(artifact: dict[str, Any], features: dict[str, float]) -> float \| None: if any(not _number(features.get(name)) for name in artifact["features"]): return None vector = [1.0] + [(features[name] - mean) / scale for name, mean, scale in zip(artifact["features"], artifact["means"], artifact["scales"])] logit = max(-35, min(35, sum(a * b for a, b in zip(artifact["weights"], vector)))) return 1 / (1 + math.exp(-logit))
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): daily_board_goalies.py:1 docstring and :25
  - Intended contract (Codex modeling-player-forecasts-daily-board-models-fit-goalie-temperature): {"source": "modeling/player_forecasts/daily_board_models.py:147", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_models.py:153 losses[temperature] = sum(-math.log(max(1e-12, goalie_start_probabilities(game[\"probabilities\"], temperature)[game[\"labels\"].index(1)])) for game in games) / len(games)"]}
  - Intended contract (Codex modeling-player-forecasts-daily-board-models-goalie-start-probabilities): {"source": "modeling/player_forecasts/daily_board_models.py:140", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_models.py:141 if not _number(temperature) or temperature <= 0 or not probabilities or any(not _number(p) or not 0 <= p <= 1 for p in probabilities) or not math.isclose(sum(probabilities), 1, abs_tol=1e-6):", "modeling/player_forecasts/daily_board_models.py:144 weights = [math.exp((math.log(p) - math.log(largest)) / temperature) if p else 0 for p in probabilities]", "modeling/player_forecasts/daily_board_models.py:145 return [weight / sum(weights) for weight in weights]"]}
  - Intended contract (Codex modeling-player-forecasts-daily-board-models-logistic-probability): {"source": "modeling/player_forecasts/daily_board_models.py:133", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_models.py:136 vector = [1.0] + [(features[name] - mean) / scale for name, mean, scale in zip(artifact[\"features\"], artifact[\"means\"], artifact[\"scales\"])]", "modeling/player_forecasts/daily_board_models.py:137 logit = max(-35, min(35, sum(a * b for a, b in zip(artifact[\"weights\"], vector))))", "modeling/player_forecasts/daily_board_models.py:138 return 1 / (1 + math.exp(-logit))"]}
  - External references: temperature scaling (Guo et al. 2017)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1851"]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1867"]}`
- **Leads (not audited):**
  - (opus) team-games with incomplete labels are dropped whole, possibly non-randomly (acknowledged)
  - (codex:modeling-player-forecasts-daily-board-models-fit-goalie-temperature) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:modeling-player-forecasts-daily-board-models-goalie-start-probabilities) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:modeling-player-forecasts-daily-board-models-logistic-probability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-020 Daily-board historical baselines (season rate, recent blend, role-aware, empirical Bayes)

- **Match:** Both; Opus PFC-029; Codex modeling-player-forecasts-daily-board-models-historical-baselines
- **Purpose:** Per-game conditional category baselines for the Starter Board
- **Where:** `modeling/player_forecasts/daily_board_models.py:22 (historical_baselines)`; `modeling/player_forecasts/daily_board_baseline_issuance.py:74 (baseline_rows)`; `modeling/player_forecasts/daily_board_baseline_issuance.py:20 (POLICY)`; `modeling/player_forecasts/daily_board_models.py:22 historical_baselines`
- **Tags (heuristic):** denominators: per game, per appearance; generation: research, development, current
- **Opus view (PFC-029):**
  - Method: season_rate = mean per game (current season else all history); recent_season = (1-w)*season + w*last-5 mean (w=0.5); role_aware = last-5 mean TOI * season events per minute; empirical_bayes = last-5 TOI * (events + prior_minutes*pooled rate)/(minutes + prior_minutes) with prior 300 min (TOI target: (total + 10*pooled mean)/(n+10)); usage tier >=20 high, >=12 medium; issuance season_id from game_id//1e6
  - Inputs/units: TOI minutes; per-game counts; per-minute rates; sources: daily-board history freeze
  - Output scale: per-game expected counts and TOI minutes; writes: file: evaluation-forecasts.jsonl / issued baseline bundles
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: daily_board_training; daily_board_context; daily_board_baseline_issuance; daily_board_daily
- **Codex view (modeling-player-forecasts-daily-board-models-historical-baselines, calculation, location; Codex family 'Python forecast research and season models'):** Research daily usage and rate baselines (historical_baselines)
  - Purpose: Season appearance mean; 50/50 recent-five-season blend; recent usage×historical rate; empirical-Bayes rates with pooled position prior and prior minutes. Conservative2-calendar-day history lag.
  - Inputs/units: Verified historical player counts/minutes and membership; current request no future labels.
  - Output scale: Per-appearance category means for season_rate,recent_season,role_aware,empirical_bayes. Research only.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): daily_board_models.py:23 docstring (2-day lag, no same-day outcomes); daily_board_baseline_issuance.py:1
  - Intended contract (Codex modeling-player-forecasts-daily-board-models-historical-baselines): {"source": "modeling/player_forecasts/daily_board_models.py:22", "explicit_comment": "Reconstructed completed-game history; no same-day or future outcomes.\n\nA conservative two-calendar-day lag is an explicit reconstruction assumption,\nNOT an invented source publication/receipt timestamp. Actual timestamps remain\nin the source freeze. News and nonappearance targets are excluded here.\nExplicit candidates request means without supplying outcome placeholders;\nthey are never admitted into player history or population rate pools.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_models.py:69 minutes = sum(recent_usage) / len(recent_usage)", "modeling/player_forecasts/daily_board_models.py:78 total = sum(old[\"outcomes\"][target] for old in available)", "modeling/player_forecasts/daily_board_models.py:79 exposure = sum(old[\"outcomes\"][\"TIME_ON_ICE_PER_GAME\"] for old in available)", "modeling/player_forecasts/daily_board_models.py:80 mean = total / len(available)", "modeling/player_forecasts/daily_board_models.py:82 prior_rate = prior_total / prior_exposure if prior_exposure else total / exposure", "modeling/player_forecasts/daily_board_models.py:83 role_aware = …
  - External references: per-60 rate x projected TOI; Tango regression with exposure prior
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1600"]}`
- **Leads (not audited):**
  - (opus) goalie targets (saves, GA, SA) use the same per-minute TOI exposure as skaters, ignoring starter/relief status
  - (opus) pooled prior pools all prior seasons and positions within 'population' (skater), so D and F share one rate prior
  - (codex:modeling-player-forecasts-daily-board-models-historical-baselines) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-021 Participation logistic regression

- **Match:** Both; Opus PFC-030; Codex modeling-player-forecasts-daily-board-models-fit-logistic, modeling-player-forecasts-daily-board-models-goalie-start-probabilities, modeling-player-forecasts-daily-board-models-logistic-probability
- **Purpose:** Fits per-player participation probability from verified pregame features
- **Where:** `modeling/player_forecasts/daily_board_models.py:99 (fit_logistic)`; `modeling/player_forecasts/daily_board_models.py:133 (logistic_probability)`; `modeling/player_forecasts/daily_board_models.py:99 fit_logistic`; `modeling/player_forecasts/daily_board_models.py:140 goalie_start_probabilities`; `modeling/player_forecasts/daily_board_models.py:133 logistic_probability`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, development, current
- **Opus view (PFC-030):**
  - Method: standardize features (population sd); batch gradient descent lr 0.1, 1000 iterations, L2 ridge 1.0 on non-intercept weights; logit clipped [-35,35]
  - Inputs/units: standardized numeric features; sources: daily-board candidate labels
  - Output scale: probability 0-1; writes: artifact JSON
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: daily-board probability evaluation (not serving)
- **Codex view (modeling-player-forecasts-daily-board-models-fit-logistic, calculation, location; Codex family 'Python forecast research and season models'):** Research regularized participation model (fit_logistic)
  - Purpose: Standardize features; gradient descent on Bernoulli logistic loss with ridge on non-intercept weights.
  - Inputs/units: Named model/observation inputs at cited declaration; Probability-model coefficients; promotionEligible=false. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Probability-model coefficients; promotionEligible=false.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-daily-board-models-goalie-start-probabilities, calculation, location; Codex family 'Python forecast research and season models'):** Goalie probability temperature scaling (goalie_start_probabilities)
  - Purpose: Normalize p_i^(1/temperature) over complete team candidate probabilities.
  - Inputs/units: Named model/observation inputs at cited declaration; Team goalie start probabilities summing to 1. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Team goalie start probabilities summing to 1.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-daily-board-models-logistic-probability, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Logistic probability (logistic_probability)
  - Purpose: Logistic probability for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def logistic_probability(artifact: dict[str, Any], features: dict[str, float]) -> float \| None: if any(not _number(features.get(name)) for name in artifact["features"]): return None vector = [1.0] + [(features[name] - mean) / scale for name, mean, scale in zip(artifact["features"], artifact["means"], artifact["scales"])] logit = max(-35, min(35, sum(a * b for a, b in zip(artifact["weights"], vector)))) return 1 / (1 + math.exp(-logit))
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): daily_board_models.py:100 docstring (labels require complete candidate list)
  - Intended contract (Codex modeling-player-forecasts-daily-board-models-fit-logistic): {"source": "modeling/player_forecasts/daily_board_models.py:99", "explicit_comment": "Labels require a complete pregame candidate list and official settlement.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_models.py:113 means = [sum(row[\"features\"][name] for row in records) / count for name in feature_names]", "modeling/player_forecasts/daily_board_models.py:114 scales = [max(1e-6, math.sqrt(sum((row[\"features\"][name] - mean) ** 2 for row in records) / count)) for name, mean in zip(feature_names, means)]", "modeling/player_forecasts/daily_board_models.py:115 vectors = [[1.0] + [(row[\"features\"][name] - mean) / scale for name, mean, scale in zip(feature_names, means, scales)] for row in records]", "modeling/player_forecasts/daily_board_models.py:116 weights = [0.0] * (len(feature_names) + 1)", "modeling/player_forecasts/daily_board_models.py:118 gradient = [0.0] * len(weights)", "modeling/player_forecasts/daily_board_models.py:120 logit = max(-35, min(35, sum(a * b for a, b in zip(weights, vector))))", "modeling/player_forecasts/daily_board_models.py:121 error = 1 / (1 + math.exp(-logit)) - row[\"label\"]", "modeling/player_forecasts/daily_board_models.py:…
  - Intended contract (Codex modeling-player-forecasts-daily-board-models-goalie-start-probabilities): {"source": "modeling/player_forecasts/daily_board_models.py:140", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_models.py:141 if not _number(temperature) or temperature <= 0 or not probabilities or any(not _number(p) or not 0 <= p <= 1 for p in probabilities) or not math.isclose(sum(probabilities), 1, abs_tol=1e-6):", "modeling/player_forecasts/daily_board_models.py:144 weights = [math.exp((math.log(p) - math.log(largest)) / temperature) if p else 0 for p in probabilities]", "modeling/player_forecasts/daily_board_models.py:145 return [weight / sum(weights) for weight in weights]"]}
  - Intended contract (Codex modeling-player-forecasts-daily-board-models-logistic-probability): {"source": "modeling/player_forecasts/daily_board_models.py:133", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_models.py:136 vector = [1.0] + [(features[name] - mean) / scale for name, mean, scale in zip(artifact[\"features\"], artifact[\"means\"], artifact[\"scales\"])]", "modeling/player_forecasts/daily_board_models.py:137 logit = max(-35, min(35, sum(a * b for a, b in zip(artifact[\"weights\"], vector))))", "modeling/player_forecasts/daily_board_models.py:138 return 1 / (1 + math.exp(-logit))"]}
  - External references: L2-regularized logistic regression
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1851"]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1867"]}`
- **Leads (not audited):**
  - (opus) fixed-iteration GD without convergence check
  - (codex:modeling-player-forecasts-daily-board-models-fit-logistic) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:modeling-player-forecasts-daily-board-models-goalie-start-probabilities) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:modeling-player-forecasts-daily-board-models-logistic-probability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-022 Joint game scenario simulator (Poisson shot process, goal odds, assists, OT/shootout)

- **Match:** Both; Opus PFC-031; Codex modeling-player-forecasts-daily-board-scenarios-count, modeling-player-forecasts-daily-board-scenarios-simulate-game
- **Purpose:** Simulates joint per-player and goalie outcomes for a game under deployment scenarios
- **Where:** `modeling/player_forecasts/daily_board_scenarios.py:43 (_count)`; `modeling/player_forecasts/daily_board_scenarios.py:145 (simulate_game)`; `modeling/player_forecasts/daily_board_scenarios.py:255 (write_game_scenarios)`; `modeling/player_forecasts/daily_board_scenarios.py:43 _count`; `modeling/player_forecasts/daily_board_scenarios.py:145 simulate_game`
- **Tags (heuristic):** denominators: shots on goal; generation: research, development, current
- **Opus view (PFC-031):**
  - Method: pace ~ Gamma(shape, 1/shape) mean 1; SOG count per team-strength = Poisson(sum minutes*shotRate*pace) via exponential arrivals; shooter chosen by weight; goal prob p' = p*m/(1-p+p*m) (odds multiplier); 0/1/2 assists by weights excluding shooter; OT 5 min sudden death with 3v3 shares and rate multiplier; shootout winner Bernoulli; hits/blocks Poisson(minutes*rate*pace); goalie SA/GA/saves/W/SO; TOI = 60 + OT
  - Inputs/units: minutes; shots per minute; probabilities 0-1; odds multiplier; sources: supplied game JSON (no DB)
  - Output scale: per-draw integer counts; minutes; writes: file: scenarios output
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: joint_fantasy_samples; CRPS evaluation
- **Codex view (modeling-player-forecasts-daily-board-scenarios-count, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Count (_count)
  - Purpose: Count for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _count(rng, mean): if mean <= 0: return 0 elapsed, count = 0.0, 0 while True: elapsed += rng.expovariate(mean) if elapsed >= 1: return count count += 1 if count > 10000: raise ValueError("scenario event budget exceeded; do not truncate draws")
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["starter-board-joint-scenarios-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-daily-board-scenarios-simulate-game, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Simulate game (simulate_game)
  - Purpose: Simulate game for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def simulate_game(game, *, seed: int, draws: int) -> dict: validate_game(game) if type(seed) is not int or type(draws) is not int or not 1 <= draws <= 10000: raise ValueError("integer seed and 1–10000 draws required") rng = random.Random(seed) teams = {t["side"]: t for t in game["teams"]} profiles = {p["playerId"]: p for t in teams.values() for p in (*t["skaters"], *t["goalies"])} policy = game["policy"] output = [] for index in range(draws): scenario_index = _choose(rng, list(range(len(game["scenarios"]))), [s["probability"] for s in game["scenarios"]]) scenario = game["scenarios"][scenario_index] pace = rng.gammavariate(policy["paceShape"], 1 / policy["paceShape"]) stats = {p["playerId"]: {key: 0 for key in categories} for t in teams.values() for cand…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["starter-board-joint-scenarios-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): daily_board_scenarios.py:1 docstring; docs/start-chart/launch-validation.md (:300)
  - Intended contract (Codex modeling-player-forecasts-daily-board-scenarios-count): {"source": "modeling/player_forecasts/daily_board_scenarios.py:43", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex modeling-player-forecasts-daily-board-scenarios-simulate-game): {"source": "modeling/player_forecasts/daily_board_scenarios.py:145", "explicit_comment": "modeling/player_forecasts/daily_board_scenarios.py:169 The goalie effect is keyed by the attacking team's strength.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_scenarios.py:157 pace = rng.gammavariate(policy[\"paceShape\"], 1 / policy[\"paceShape\"])", "modeling/player_forecasts/daily_board_scenarios.py:171 probability = p * multiplier / (1 - p + p * multiplier)", "modeling/player_forecasts/daily_board_scenarios.py:192 return ({pid: minutes * profiles[pid][\"strengths\"][strength][\"shotsPerMinute\"] for pid, minutes in exposure.items()},", "modeling/player_forecasts/daily_board_scenarios.py:193 {pid: minutes * profiles[pid][\"strengths\"][strength][\"assistWeight\"] for pid, minutes in exposure.items()})", "modeling/player_forecasts/daily_board_scenarios.py:198 for _ in range(_count(rng, sum(shots.values()) * pace)):", "modeling/player_forecasts/daily_board_scenarios.py:203 intensities = {side: sum(ot_weights[side][0].values()) * pace * policy[\"overtimeShotRateMultiplier\"] for side in teams}", "modeling/player_forecasts/daily_board_scenarios.py:204 total = sum(intensi…
  - External references: Poisson/odds-ratio goal models; shot-based game simulators (e.g. MoneyPuck/HockeyViz)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2174"]}`
- **Leads (not audited):**
  - (opus) no empty-net, goalie pulls or relief (acknowledged)
  - (opus) shutout credited when GA=0 even if goalie loses in shootout (consistent with NHL rule) but SO goals not modeled as shots/saves
  - (codex:modeling-player-forecasts-daily-board-scenarios-count) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-daily-board-scenarios-simulate-game) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-023 Daily-board strength-split baselines (EV/PP/PK usage x rate)

- **Match:** Both; Opus PFC-033; Codex modeling-player-forecasts-daily-board-strength-evaluate-strength-freeze, modeling-player-forecasts-daily-board-strength-strength-baselines
- **Purpose:** Projects G/A/SOG by strength as usage times strength-specific rates with shrinkage
- **Where:** `modeling/player_forecasts/daily_board_strength.py:25 (strength_baselines)`; `modeling/player_forecasts/daily_board_strength.py:137 (evaluate_strength_freeze)`; `modeling/player_forecasts/daily_board_strength.py:137 evaluate_strength_freeze`; `modeling/player_forecasts/daily_board_strength.py:25 strength_baselines`
- **Tags (heuristic):** denominators: per game; generation: research, development, current
- **Opus view (PFC-033):**
  - Method: usage_s = 0.5*season mean + 0.5*last-5 mean; observed_history_rate = count/games; total_usage_rate = total usage * count/total exposure; strength_usage_rate = usage_s * own rate_s; strength_shrinkage = usage_s*(count + 180*pooled same-season same-position rate)/(exposure + 180); totals = sum over strengths; PP_POINTS = PPG+PPA; 2-day lag
  - Inputs/units: strength TOI minutes; per-minute rates; sources: daily-board history freeze
  - Output scale: per-game counts by strength and total; writes: file: evaluation.jsonl, report.json
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: research report
- **Codex view (modeling-player-forecasts-daily-board-strength-evaluate-strength-freeze, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Evaluate strength freeze (evaluate_strength_freeze)
  - Purpose: Evaluate strength freeze for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def evaluate_strength_freeze(freeze: Path, output: Path, start: str, end: str) -> dict: validate_range(start, end) assert_output_outside_repository(output, repository_root()) manifest = read_json(freeze / "manifest.json") if manifest.get("normalizerVersion") != NORMALIZER_VERSION: raise ValueError("corrected strength normalizer manifest required") validate_range(manifest["start"], manifest["end"]) if not manifest["start"] <= start <= end <= manifest["end"]: raise ValueError("evaluation dates must be inside the frozen dataset") history_file = freeze / "history.jsonl" source_hash = hashlib.sha256(history_file.read_bytes()).hexdigest() if source_hash != manifest["files"]["history.jsonl"]["sha256"]: raise ValueError("history checksum mismatch") records = li…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-daily-board-strength-strength-baselines, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Strength baselines (strength_baselines)
  - Purpose: Strength baselines for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def strength_baselines(records: list[dict], *, recent_games=5, recent_weight=0.5, prior_minutes=180.0) -> dict: if type(recent_games) is not int or not 1 <= recent_games <= 20 or not _number(recent_weight) or recent_weight > 1 or not _number(prior_minutes) or prior_minutes <= 0: raise ValueError("invalid fixed strength policy") policy = {"version": "starter-board-strength-policy-v1", "recentGames": recent_games, "recentWeight": recent_weight, "priorMinutes": prior_minutes, "historyLagDays": 2, "pool": "same-season prior-position verified strength exposures", "historyScope": "available exported observations, not a claim of complete season history", "refitPolicy": "fixed coefficients; completed history advances without evaluation-driven tuning"} ordered =…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): daily_board_strength.py:1 docstring; docs/start-chart/launch-validation.md (:207)
  - Intended contract (Codex modeling-player-forecasts-daily-board-strength-evaluate-strength-freeze): {"source": "modeling/player_forecasts/daily_board_strength.py:137", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_strength.py:140 manifest = read_json(freeze / \"manifest.json\")", "modeling/player_forecasts/daily_board_strength.py:146 history_file = freeze / \"history.jsonl\"", "modeling/player_forecasts/daily_board_strength.py:154 scored = [{**row, \"target_key\": target, \"outcome\": row[\"outcomes\"][target], \"estimates\": values}", "modeling/player_forecasts/daily_board_strength.py:166 count, checksum = write_jsonl(output / \"evaluation.jsonl\", scored)", "modeling/player_forecasts/daily_board_strength.py:171 \"evaluationSkaterRows\": sum(row.get(\"population\") == \"skater\" and start <= row[\"game_date\"] <= end for row in records),", "modeling/player_forecasts/daily_board_strength.py:184 write_json(output / \"report.json\", report)", "modeling/player_forecasts/daily_board_strength.py:186 (output / name).chmod(0o600)"]}
  - Intended contract (Codex modeling-player-forecasts-daily-board-strength-strength-baselines): {"source": "modeling/player_forecasts/daily_board_strength.py:25", "explicit_comment": "modeling/player_forecasts/daily_board_strength.py:74 Do not disguise a missing recent role observation by silently reaching", "arithmetic_locations": ["modeling/player_forecasts/daily_board_strength.py:87 season_usage = {s: sum(old[\"outcomes\"][f\"{s}_TOI\"] for old in usage_history) / len(usage_history) for s in STRENGTHS}", "modeling/player_forecasts/daily_board_strength.py:88 usage = {s: (1 - recent_weight) * season_usage[s]", "modeling/player_forecasts/daily_board_strength.py:89 + recent_weight * sum(old[\"outcomes\"][f\"{s}_TOI\"] for old in recent) / len(recent) for s in STRENGTHS}", "modeling/player_forecasts/daily_board_strength.py:90 total_usage = sum(usage.values())", "modeling/player_forecasts/daily_board_strength.py:91 total_exposure = sum(old[\"outcomes\"][f\"{s}_TOI\"] for old in rate_history for s in STRENGTHS)", "modeling/player_forecasts/daily_board_strength.py:98 exposure = sum(old[\"outcomes\"][f\"{s}_TOI\"] for old in rate_history)", "modeling/player_forecasts/daily_board_strength.py:99 pool_exposure = sum(old[\"outcomes\"][f\"{s}_TOI\"] for old in pool)", "modeling/player_…
  - External references: NST per-60 by strength x projected TOI
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1510"]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1578"]}`
- **Leads (not audited):**
  - (opus) PK assists/goals included in totals but SH points not reported separately; PK pooled rate uses same 180-minute prior as EV despite far smaller PK exposure
  - (codex:modeling-player-forecasts-daily-board-strength-evaluate-strength-freeze) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-daily-board-strength-strength-baselines) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-024 Baseline policy grid selection (recent weight, prior minutes)

- **Match:** Both; Opus PFC-034; Codex modeling-player-forecasts-daily-board-training-train-daily-baselines
- **Purpose:** Chooses recent weight and prior minutes on development fantasy-point MAE
- **Where:** `modeling/player_forecasts/daily_board_training.py:29 (train_daily_baselines)`; `modeling/player_forecasts/daily_board_training.py:42 (trial grid)`; `modeling/player_forecasts/daily_board_training.py:29 train_daily_baselines`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, development, current
- **Opus view (PFC-034):**
  - Method: trials (0.25,180),(0.5,180),(0.75,180),(0.5,60),(0.5,360); recent weight = argmin recent MAE among first three (tie toward 0.5); prior minutes = argmin EB MAE among last four (tie toward smaller prior)
  - Inputs/units: fantasy-point MAE; sources: daily-board history freeze
  - Output scale: recentWeight 0-1; priorMinutes; writes: file: baseline-policy.json, report.json
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: daily-board research reports
- **Codex view (modeling-player-forecasts-daily-board-training-train-daily-baselines, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Train daily baselines (train_daily_baselines)
  - Purpose: Train daily baselines for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def train_daily_baselines(freeze: Path, output: Path, *, development_end: str, evaluation_start: str, evaluation_end: str, archived_forge: Path \| None = None) -> dict[str, Any]: assert_output_outside_repository(output, repository_root()) manifest = read_json(freeze / "manifest.json") validate_range(manifest["start"], manifest["end"]) validate_range(evaluation_start, evaluation_end) if not manifest["start"] < development_end < evaluation_start <= evaluation_end <= manifest["end"]: raise ValueError("invalid chronological development/evaluation boundaries") history_file = freeze / "history.jsonl" if hashlib.sha256(history_file.read_bytes()).hexdigest() != manifest["files"]["history.jsonl"]["sha256"]: raise ValueError("history checksum mismatch") records =…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): daily_board_training.py:40 comment ('Fixed small grid; no repeated search')
  - Intended contract (Codex modeling-player-forecasts-daily-board-training-train-daily-baselines): {"source": "modeling/player_forecasts/daily_board_training.py:29", "explicit_comment": "modeling/player_forecasts/daily_board_training.py:40 Fixed small grid; no repeated search or tuning against the evaluation period.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_training.py:31 manifest = read_json(freeze / \"manifest.json\")", "modeling/player_forecasts/daily_board_training.py:36 history_file = freeze / \"history.jsonl\"", "modeling/player_forecasts/daily_board_training.py:72 diagnostics[row[\"target_key\"]].append({**row, \"estimates\": {**row[\"estimates\"], \"forge\": value}})", "modeling/player_forecasts/daily_board_training.py:79 write_json(output / \"baseline-policy.json\", artifact)", "modeling/player_forecasts/daily_board_training.py:80 _, feature_hash = write_jsonl(output / \"evaluation-forecasts.jsonl\", evaluation)", "modeling/player_forecasts/daily_board_training.py:94 write_json(output / \"report.json\", report)"]}
  - External references: none suggested
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1977"]}`
- **Leads (not audited):**
  - (opus) issuance uses fixed POLICY 0.5/300 minutes, which is not in this grid (180/60/360) - selected policy is not what is issued
  - (codex:modeling-player-forecasts-daily-board-training-train-daily-baselines) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-025 Deployment evidence weights and injury/scratch availability multiplier

- **Match:** Both; Opus PFC-035; Codex modeling-player-forecasts-season-deployment-evidence, modeling-player-forecasts-season-normalized-role-probabilities
- **Purpose:** Converts lineup tallies and line snapshots into role-probability weights and availability haircuts
- **Where:** `modeling/player_forecasts/season.py:2881 (_deployment_evidence)`; `modeling/player_forecasts/season.py:2873 (_normalized_role_probabilities)`; `modeling/player_forecasts/season.py:3490 (availability_multiplier)`; `modeling/player_forecasts/season.py:2881 _deployment_evidence`; `modeling/player_forecasts/season.py:2873 _normalized_role_probabilities`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (PFC-035):**
  - Method: tally weight = 0.25*share*min(1, games/20) (latest season only); snapshot weight = reliability (lines_nhl 1.0, lines_ccc 0.85, line_source_snapshots 0.7, else 0.5) * exp(-age_days/45); role probabilities = normalized summed weights; availability multiplier = max(0.1, 1 - 0.5*injuryWeight - 0.7*scratchWeight) applied to play probability for the whole season
  - Inputs/units: deployment share 0-1; games; snapshot age in days; sources: player_lineup_deployment_tallies, line_source_snapshots, lines_ccc, lines_nhl
  - Output scale: weights 0-1; availability multiplier 0.1-1; writes: season-artifact.json deployment
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: train_season_artifact role assignment; player_forecast_season_deployment_* via importer
- **Codex view (modeling-player-forecasts-season-deployment-evidence, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Deployment evidence (_deployment_evidence)
  - Purpose: Deployment evidence for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _deployment_evidence( tallies: list[dict[str, Any]], snapshots: list[dict[str, Any]], as_of: str, ) -> dict[tuple[int, int], dict[str, Any]]: evidence: dict[tuple[int, int], dict[str, Any]] = defaultdict( lambda: { "families": defaultdict(lambda: defaultdict(float)), "sources": set(), "confidenceWeight": 0.0, "injuryWeight": 0.0, "scratchWeight": 0.0, } ) latest_season = max((int(row["season_id"]) for row in tallies), default=0) for row in tallies: if int(row["season_id"]) != latest_season: continue
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-season-normalized-role-probabilities, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Normalized role probabilities (_normalized_role_probabilities)
  - Purpose: Normalized role probabilities for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _normalized_role_probabilities(values: dict[str, float]) -> dict[str, float]: positive = {key: max(0.0, float(value)) for key, value in values.items() if value > 0} total = sum(positive.values()) if total <= 0: return {} return {key: _round_number(value / total) for key, value in sorted(positive.items())}
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (constants uncommented); docs/player-projections/player-forecasts-runbook.md 'Roster and transaction integrity' (:672)
  - Intended contract (Codex modeling-player-forecasts-season-deployment-evidence): {"source": "modeling/player_forecasts/season.py:2881", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2907 weight = 0.25 * float(row[\"share\"]) * min(1.0, float(row[\"games\"]) / 20.0)", "modeling/player_forecasts/season.py:2926 age_days = max(0.0, (as_of_time - available).total_seconds() / 86400)", "modeling/player_forecasts/season.py:2927 freshness = math.exp(-age_days / 45.0)", "modeling/player_forecasts/season.py:2928 weight = source_reliability.get(str(row[\"source_table\"]), 0.5) * freshness"]}
  - Intended contract (Codex modeling-player-forecasts-season-normalized-role-probabilities): {"source": "modeling/player_forecasts/season.py:2873", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2875 total = sum(positive.values())", "modeling/player_forecasts/season.py:2878 return {key: _round_number(value / total) for key, value in sorted(positive.items())}"]}
  - External references: none suggested
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2371"]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2372"]}`
- **Leads (not audited):**
  - (opus) a single injury/scratch snapshot cuts season-long play probability by up to 50-70% with no return-date model
  - (opus) magic constants 0.25, 20 games, 45-day half-life-like decay, 0.5/0.7 haircuts are unvalidated
  - (codex:modeling-player-forecasts-season-deployment-evidence) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-normalized-role-probabilities) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-026 Deployment role heuristics (lines, pairs, PP/PK units, teammate quality)

- **Match:** Both; Opus PFC-036; Codex modeling-player-forecasts-season-team-deployment
- **Purpose:** Assigns most-likely line/pair/unit roles and team depth charts
- **Where:** `modeling/player_forecasts/season.py:3543 (TOI ranks)`; `modeling/player_forecasts/season.py:3576 (role probabilities)`; `modeling/player_forecasts/season.py:3656 (teammate_quality)`; `modeling/player_forecasts/season.py:4715 (_team_deployment)`; `modeling/player_forecasts/season.py:4715 _team_deployment`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; denominators: per game; generation: current
- **Opus view (PFC-036):**
  - Method: rank by projected TOI within team-population; forward line = min(4,(rank+2)//3), D pair = min(3,(rank+1)//2), goalie order = rank; PP1 = PP-TOI rank<=5, PP2 <=10; PK1 rank<=4, PK2<=8; fallback probabilities 0.65/0.35 (goalie 0.7/0.3); teammate quality = mean of top-5 peer G+A per game; team charts slice sorted lists 3/2/5/4
  - Inputs/units: TOI seconds per game; ranks; sources: season artifact
  - Output scale: line 1-4, pair 1-3, unit 1-2; probabilities 0-1; writes: season-artifact.json, player_forecast_season_deployment_assignments via importer
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: release bundles; team aggregates
- **Codex view (modeling-player-forecasts-season-team-deployment, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Team deployment (_team_deployment)
  - Purpose: Team deployment for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _team_deployment(players: list[dict[str, Any]]) -> dict[str, Any]: forwards = sorted( (player for player in players if player["population"] == "forward"), key=lambda player: float(player["conditionalRates"].get("TOTAL_TOI", 0)), reverse=True, ) defense = sorted( (player for player in players if player["population"] == "defense"), key=lambda player: float(player["conditionalRates"].get("TOTAL_TOI", 0)), reverse=True, ) goalies = sorted( (player for player in players if player["population"] == "goalie"), key=lambda player: float(player.get("startProbability") or 0), reverse=True, ) return { "forwardLines": [
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): selectionStatus text season.py:3712 ('line_continuity_and_peer_quality_retained_as_prospective_context')
  - Intended contract (Codex modeling-player-forecasts-season-team-deployment): {"source": "modeling/player_forecasts/season.py:4715", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: none suggested
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`; `generated (not in repo): <season artifact dir>/season-artifact.json goldenVectors built at modeling/player_forecasts/season.py:3850`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) PP units assigned by PP TOI rank across F and D combined; fixed 5/10 cutoffs ignore 4F1D vs 3F2D structures
  - (opus) fallback 0.65/0.35 probabilities are arbitrary
  - (codex:modeling-player-forecasts-season-team-deployment) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-027 Forecast-diagnostics team goal mean alignment (FORGE vs team model)

- **Match:** Both; Opus PFC-037; Codex DIAG-ACCOUNT
- **Purpose:** Aggregate player goal means to a team mean and compare with a team-level model.
- **Where:** `web/lib/forecast-diagnostics/contract.ts:117 (comparableMean)`; `web/lib/forecast-diagnostics/contract.ts:160 (compareForecastBases)`; `web/lib/forecast-diagnostics/pairedInputs.ts:144 (accountForgeTeamGoals)`; `web/lib/forecast-diagnostics/pairedInputs.ts:144 accountForgeTeamGoals`; `web/lib/forecast-diagnostics/contract.ts:160 compareForecastBases`
- **Tags (heuristic):** conditionality: unconditional; denominators: per game; generation: research, development, current
- **Opus view (PFC-037):**
  - Method: Team mean = sum(unconditional player means, or conditional * appearanceProbability) + residualMean; requires exclusive ES/PP/PK partition, OT and empty-net coverage; difference = forgeMean - teamMean.
  - Inputs/units: goal means per game (count); appearance probability 0-1; sources: forge_game_revisions (via callers)
  - Output scale: team goals per game; difference in goals; writes: —
  - Status: draft — research diagnostics; scripts/audit-native-goal-ledger.ts, lib/projections/nativeGoalLedgerAudit.ts
  - Consumers: scripts/audit-native-goal-ledger.ts; lib/projections/nativeGoalLedgerAudit.ts (via diagnostics)
- **Codex view (DIAG-ACCOUNT, calculation, location; Codex family 'Forecast diagnostics'):** FORGE team accounting and comparable-mean difference
  - Purpose: Sum aligned player expectations and residuals; compare to team forecast.
  - Inputs/units: Player conditional means and appearance probabilities; roster/strength/OT/empty-net coverage; team mean and lineage.
  - Output scale: Team expected goals; FORGE minus independent mean when scope aligns; unavailable otherwise.
  - Version/status: forecast-diagnostics-v1; frozen-research-pair-v1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): forecast-diagnostics/contract.ts:159 'Alignment is an accounting/lineage check, not predictive validation.'
  - Intended contract (Codex DIAG-ACCOUNT): Alignment is an accounting/lineage check, not predictive validation.
  - External references: Team goal expectation (Poisson team scoring models)
  - Fixtures/test data: `web/lib/forecast-diagnostics/fixtures.ts`
  - Tests: `web/lib/forecast-diagnostics/contract.test.ts`
- **Leads (not audited):**
  - (opus) compareForecastBases used only by fixtures in this slice
  - (codex:DIAG-ACCOUNT) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-PFC-028 Empirical team goals baseline (own GF/gm and opponent GA/gm)

- **Match:** Both; Opus PFC-039; Codex DIAG-TEAMBASE
- **Purpose:** Unfitted research baseline for team goals per game.
- **Where:** `web/lib/forecast-diagnostics/pairedInputs.ts:7 (TEAM_GOALS_PARAMETERS)`; `web/lib/forecast-diagnostics/pairedInputs.ts:81 (scoreTeamGoals)`; `web/lib/forecast-diagnostics/frozenResearchPair.ts:124 (blend equality check)`; `web/lib/forecast-diagnostics/pairedInputs.ts:81 scoreTeamGoals`
- **Tags (heuristic):** denominators: per game; generation: research, development, current
- **Opus view (PFC-039):**
  - Method: Last 20 current-season games per team (min 1). mean = 0.5*own GF/gm + 0.5*opponent GA/gm. No home ice, no regression, calibration none. Research 'opponent_blended' variant must match it within 1e-10.
  - Inputs/units: team goals for/against per game (counts); sources: NHL play-by-play/schedule receipts (research packets)
  - Output scale: expected team goals per game (given game played); writes: —
  - Status: draft — researchOnly: true; lib/projections/researchGoalBaseline.ts, scripts/evaluate-research-goal-baseline.ts
  - Consumers: lib/projections/researchGoalBaseline.ts; scripts/evaluate-research-goal-baseline.ts; frozenResearchPair
- **Codex view (DIAG-TEAMBASE, calculation, location; Codex family 'Forecast diagnostics'):** Independent empirical team-goals baseline
  - Purpose: Produce unfitted comparison means from team histories.
  - Inputs/units: Same-season eligible last20 team goal-for/opponent goal-against game counts available before cutoff.
  - Output scale: Home/away mean goals given game played; .5 own GF/game + .5 opponent GA/game.
  - Version/status: empirical-full-game-goals-v1; researchOnly true. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): pairedInputs.ts:80 'Independent, unfitted baseline. No win probability, FORGE input, or fallback prior.'
  - Intended contract (Codex DIAG-TEAMBASE): Explicit independent unfitted baseline; no win probability, FORGE input or fallback prior.
  - External references: Poisson team goal models (Dixon-Coles / attack-defense ratings) with league-mean regression and home advantage
  - Fixtures/test data: `web/lib/forecast-diagnostics/fixtures.ts`
  - Tests: `No adjacent test located; broader suites not exhaustively traced.`; `web/lib/forecast-diagnostics/frozenResearchPair.test.ts`; `web/lib/projections/researchGameGoals.test.ts`; `web/lib/projections/researchGoalBaseline.test.ts`
- **Leads (not audited):**
  - (opus) minimumGames 1 allows a 1-game team rate; no regression to league mean early season
  - (opus) ignores home ice and opponent strength-of-schedule
  - (codex:DIAG-TEAMBASE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-PFC-029 Prospective point and probability evaluation (MAE, bias, Brier, paired baseline)

- **Match:** Both; Opus PFC-041; Codex web-lib-player-forecasts-evaluation-evaluateissuedobservations
- **Purpose:** Score issued forecasts against final outcomes by cohort (target, conditioning, population, lead day, team-game ordinal).
- **Where:** `web/lib/player-forecasts/evaluation.ts:51 (evaluateIssuedObservations)`; `web/lib/player-forecasts/evaluation.ts:34 (protectedDate)`; `web/lib/player-forecasts/evaluation.ts:36 (prospectiveRanges)`; `web/lib/player-forecasts/evaluation.ts:210 (runProspectiveEvaluation)`; `web/lib/player-forecasts/evaluation.ts:272 (calendarLeadDays)`; `web/lib/player-forecasts/evaluation.ts:306 (runForgeProspectiveEvaluation)`; `web/lib/player-forecasts/evaluation.ts:297 (starterBoardMinimums)`; `web/lib/player-forecasts/evaluation.ts:51 evaluateIssuedObservations`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: legacy, current
- **Opus view (PFC-041):**
  - Method: Point: MAE = mean\|f-a\|, bias = mean(f-a); paired MAE/bias/baseline MAE on rows with same-conditioning baseline. Probability (plays/starts): Brier = mean (p-y)^2, paired Brier vs baseline. Excludes protected holdout 2026-01-03..2026-04-16, non-captured_live, issued >= start. Evaluation window <= 180 days, row cap 50,000. FORGE TOI actual seconds/60. Promotion minimum 200 settled games and 30 slates (informational).
  - Inputs/units: point estimates in target units (TOI minutes after /60); probabilities 0-1; outcomes 0/1; sources: games, player_forecast_outputs, player_forecast_outcome_revisions, player_forecast_runs, forge_final_pregame_revisions, forge_game_revisions, player_forecast_source_observations, nhl_api_game_payloads_raw
  - Output scale: MAE and bias in target units; Brier 0-1; writes: —
  - Status: legacy/dead — runProspectiveEvaluation/runForgeProspectiveEvaluation have no non-test callers
  - Consumers: none outside module found (runProspectiveEvaluation/runForgeProspectiveEvaluation have no non-test callers)
- **Codex view (web-lib-player-forecasts-evaluation-evaluateissuedobservations, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Evaluate issued observations (evaluateIssuedObservations)
  - Purpose: Research holdout stays excluded, including from retrospective local comparisons.
  - Inputs/units: Parameter/type declaration excerpt: export function evaluateIssuedObservations(rows: IssuedObservation[], asOf: string): { points: PointSummary[]; participation: ParticipationSummary[]; excluded: Record<string, number>; } { const points = new Map<string, PointSummary>(); const participation = new Map<string, ParticipationSummary>(); const excluded: Record<string, number> = {}; const seen = new Set<string>(); const exclude = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; }; for (const row of rows) { if (seen.has(row.id)) { exclude("duplicate_output"); continue; } seen.add(row.id); if (protectedDate(row.gameDate)) { exclude("protected_holdout"); continue; } if (row.evidenceClass !== "captured_live" \|\| row.gameType !== "regular_season") { exclude("non_prospective_reg…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): evaluation.ts:50 'Research holdout stays excluded'; evaluation.ts:209 'Read retained issued forecasts and final outcomes for local evidence reporting. Never publishes or promotes.'
  - Intended contract (Codex web-lib-player-forecasts-evaluation-evaluateissuedobservations): {"source": "web/lib/player-forecasts/evaluation.ts:51", "explicit_comment": "Research holdout stays excluded, including from retrospective local comparisons.", "arithmetic_locations": ["web/lib/player-forecasts/evaluation.ts:83 summary.brier += (row.forecast - row.actual) ** 2;", "web/lib/player-forecasts/evaluation.ts:86 summary.pairedBrier = (summary.pairedBrier ?? 0) + (row.forecast - row.actual) ** 2;", "web/lib/player-forecasts/evaluation.ts:87 summary.baselineBrier = (summary.baselineBrier ?? 0) + (row.baseline! - row.actual) ** 2;", "web/lib/player-forecasts/evaluation.ts:133 /** Eligibility covers all competing players and required targets, including bench alternatives. */", "web/lib/player-forecasts/evaluation.ts:140 /** Scores every plan against the same observed player/game values. Points leagues only. */"]}
  - External references: Standard MAE/RMSE, Brier score, Murphy decomposition/calibration curves
  - Fixtures/test data: `web/scripts/seed-player-forecast-fixtures.ts`
  - Tests: `web/lib/player-forecasts/evaluation.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/evaluation.test.ts:4"]}`
- **Leads (not audited):**
  - (opus) no RMSE, log loss or calibration bins here (ledger module has them) - two inconsistent evaluation stacks
  - (opus) hard-coded holdout dates in 2025-26 season
  - (opus) calendarLeadDays from UTC date slices
  - (opus) no non-test callers found
  - (codex:web-lib-player-forecasts-evaluation-evaluateissuedobservations) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-030 Ledger scoring: MAE/bias/RMSE, Mincer-Zarnowitz, reliability bins, FP deciles, coverage

- **Match:** Both; Opus PFC-044; Codex served-ledger-paired-scoring, served-ledger-source-scoring
- **Purpose:** Per-source accuracy and calibration of served forecasts on dressed players.
- **Where:** `web/lib/player-forecasts/servedForecastLedger.ts:332 (errorStat)`; `web/lib/player-forecasts/servedForecastLedger.ts:345 (binaryScore)`; `web/lib/player-forecasts/servedForecastLedger.ts:380 (fpBins)`; `web/lib/player-forecasts/servedForecastLedger.ts:396 (scoreLedger)`; `web/lib/player-forecasts/servedForecastLedger.ts:473 scorePairedLedger`; `web/lib/player-forecasts/servedForecastLedger.ts:460 pairedError`; `web/lib/player-forecasts/servedForecastLedger.ts:447 comparableValues`; `web/lib/player-forecasts/servedForecastLedger.ts:332 errorStat`; `web/lib/player-forecasts/servedForecastLedger.ts:345 binaryScore`; `web/lib/player-forecasts/servedForecastLedger.ts:380 fpBins`; `web/lib/player-forecasts/servedForecastLedger.ts:396 scoreLedger`; `web/lib/player-forecasts/servedForecastLedger.ts:360 scoringRows` …
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game, shots on goal; generation: current
- **Opus view (PFC-044):**
  - Method: MAE, bias = mean(e-a), RMSE, ratio = sum(a)/sum(e), MZ regression a = intercept + slope*e (OLS). Binary: Brier, 10 equal-width reliability bins (floor(p*10), cap 9). Expected-FP deciles by rank (ties kept together). Coverage = covered dressed / dressed universe; phantoms = forecast rows for non-dressed; b2b subset team_rest_days==1. Scoring population dressed only.
  - Inputs/units: expected vs actual per-game counts; probabilities 0-1; sources: forge_served_forecast_ledger
  - Output scale: MAE/RMSE/bias in stat units; ratio actual/expected; MZ slope/intercept; Brier 0-1; reliability bins; coverage 0-1; writes: —
  - Status: unknown — /api/v1/forge/scoreboard route; no page/component caller found
  - Consumers: pages/api/v1/forge/scoreboard.ts
- **Codex view (served-ledger-paired-scoring, calculation, location; Codex family 'Served forecast ledger evaluation'):** Matched-source error and RMSE skill comparisons (scorePairedLedger)
  - Purpose: Pair sources on season_id, served_date, player_class, player_id and game_id, then evaluate each head on the exact same known outcomes. Reuse per-source MAE/bias/RMSE/totals/ratio/MZ summaries and compute RMSE skill=1-sqrt(source SSE/reference SSE) from unrounded same-cohort squared errors. Also produce matched goalie binary Brier/reliability summaries, tied source-expected-FP deciles and exclusion/pairing counts.
  - Inputs/units: Two settled source records per same identity/date/player-game, category count or fantasy-point predictions, equal known category actuals, matching participation labels; goalie probabilities [0,1] and equal known binary start/win/shutout outcomes. Optional fantasy weights are points per category event.
  - Output scale: Head-specific paired n and exclusions are counts. Underlying MAE/bias/RMSE/intercept retain category count or FP units; slopes/ratios are dimensionless. RMSE skill is dimensionless <=1 with no finite lower bound, positive for lower source error, null when reference SSE=0 or no valid pair. Binary Brier and reliability means are [0,1]. Rounded to 4 decimals; paired/no_shared_player_games and scored/no_valid_pairs statuses are separate.
  - Version/status: Checked-in local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. LEDGER_SOURCES includes bridge_exact, bridge_reaimed, native, naive_last5, naive_season, market; source names are not evidence of live/deployed population. LEDGER_MARKET_ENABLED is true in source only. Inspected source files clean; no tests or execution.
- **Codex view (served-ledger-source-scoring, calculation, location; Codex family 'Served forecast ledger evaluation'):** Per-source count, fantasy-point and goalie-event scoring (scoreLedger)
  - Purpose: Summarize each source on its own settled observed sample. For finite forecast/actual pairs compute MAE=mean(abs(forecast-actual)), signed bias=mean(forecast-actual), RMSE=sqrt(mean((forecast-actual)^2)), expected and actual sums, actual/expected total ratio, and Mincer–Zarnowitz regression actual=intercept+slope*forecast. Slope is covariance sum/forecast centered-squares sum; intercept=actual mean-slope*forecast mean. Separately compute goalie start/win/shutout Brier scores and ten probability-bin means. Report independent-universe coverage, phantoms, expected-FP decile and back-to-back slices.
  - Inputs/units: Settled source/player-game ledger predictions and actuals: skater G/A/PPP/SOG/HIT/BLK counts, goalie SV/GA/SA counts, fantasy points, goalie start/win/shutout probabilities [0,1] and known binary outcomes. Optional fantasy weights are points per category event; optional independent player-game universe contains known/unknown dressed membership. Rest days are calendar-day gaps.
  - Output scale: Per source and player class: n/covered/dressed/phantoms and cohort sizes are counts. MAE, bias, RMSE and MZ intercept have head count or fantasy-point units; expected/actual are cohort totals. MZ slope and actual/expected ratio are dimensionless and not bounded. Probability scores and reliability predicted/observed fractions are [0,1]. Coverage is covered/dressed when known nonzero denominator, otherwise null. Deciles are labels 1..10 and probability bins 0..9. Floating summaries rounded to 4 decimals.
  - Version/status: Checked-in local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. LEDGER_SOURCES includes bridge_exact, bridge_reaimed, native, naive_last5, naive_season, market; source names are not evidence of live/deployed population. LEDGER_MARKET_ENABLED is true in source only. Inspected source files clean; no tests or execution.
- **Audit context:**
  - Intent (Opus): servedForecastLedger.ts:394 'Per-source errors use each source's own observed sample, not a paired model comparison. Coverage requires an independently captured and settled universe'
  - Intended contract (Codex served-ledger-paired-scoring): web/lib/player-forecasts/servedForecastLedger.ts:469-472: never compare unrelated source-level averages; require both forecasts and equal known actuals; ambiguous duplicate source keys excluded. Comparisons follow pair order in LEDGER_SOURCES. Count/FP population requires both dressed; goalie binary population permits known nonstarts on participation-consistent pairs. Missing prediction, missing outcome and conflicting actuals counted separately for each head. Source expected-FP rank defines decile membership; optional weight recomputation preserves missing contributing heads. Definitions returned explicitly at :508-512.
  - Intended contract (Codex served-ledger-source-scoring): web/lib/player-forecasts/servedForecastLedger.ts:394-395 expressly distinguishes own-source observed samples from paired model comparison. Count/FP errors use dressed===true; goalie binary scores use all valid settled known events, including proven nonstarts. Identity-invalid and duplicate-source-key rows excluded. No finite pairs => null errors; constant forecast or n<2 => null MZ; zero forecast total => null ratio. Coverage requires independently captured, fully settled membership, not forecast rows. fpBins uses tied expected-FP midpoint rank only (no actuals), so deciles may be empty; B2B is team_rest_days===1. Missing nonzero-weight heads withhold recomputed FP.
  - External references: Mincer-Zarnowitz forecast efficiency regression; Brier reliability diagrams; standard MAE/RMSE
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/servedForecastLedger.test.ts`; `web/lib/player-forecasts/servedForecastLedger.test.ts:164 scoreLedger suite: signed bias/MAE, coverage/phantoms, tied FP, B2B, goalie reliability and independent no-history universe. Discovered, not run.`; `web/lib/player-forecasts/servedForecastLedger.test.ts:209 paired suite covers same-cohort RMSE skill and MZ intercept, dates/seasons/games, duplicates and malformed identities, head-specific missing/conflicting actuals, DNPs, FP bins and weights, zero reference error, and valid/invalid binary events. Discovered, not run.`; `web/lib/player-forecasts/servedForecastLedger.test.ts:238 duplicate/invalid-key behavior; :265 expected-FP deciles; :291 known nonstart binary scoring. Discovered, not run.`; `web/lib/player-forecasts/servedForecastLedger.test.ts:392 market-implied mean paired reference. Discovered, not run.`
- **Leads (not audited):**
  - (opus) dressed-only scoring hides participation error for count heads (unconditional exp vs conditional population)
  - (opus) per-source samples differ (not paired) so cross-source MAE comparisons are confounded (paired scorer exists separately)
  - (codex:served-ledger-paired-scoring) ["Deployed ledger version, persisted population, active capture, independent universe availability and live coverage not verified.", "These are descriptive evaluation summaries, not predictive qualification, as explicitly stated in LEDGER_SCORING_LIMITATIONS."]
  - (codex:served-ledger-source-scoring) ["Deployed ledger version, persisted population, active capture, independent universe availability and live coverage not verified.", "These are descriptive evaluation summaries, not predictive qualification, as explicitly stated in LEDGER_SCORING_LIMITATIONS.", "Skater F/D position and expected/actual TOI and PP-TOI are absent from persisted scoring contract; no opportunity/rate decomposition is produced."]

## M-PFC-031 Paired ledger comparison (RMSE skill) and market probability scoring (Brier skill, log loss)

- **Match:** Both; Opus PFC-045; Codex served-ledger-market-scoring, served-ledger-paired-scoring
- **Purpose:** Head-to-head comparison of sources on identical player-games and versus the betting market.
- **Where:** `web/lib/player-forecasts/servedForecastLedger.ts:460 (pairedError)`; `web/lib/player-forecasts/servedForecastLedger.ts:473 (scorePairedLedger)`; `web/lib/player-forecasts/servedForecastLedger.ts:519 (probabilityScore)`; `web/lib/player-forecasts/servedForecastLedger.ts:530 (scoreMarketLedger)`; `web/lib/player-forecasts/servedForecastLedger.ts:530 scoreMarketLedger`; `web/lib/player-forecasts/servedForecastLedger.ts:519 probabilityScore`; `web/lib/player-forecasts/servedForecastLedger.ts:518 LOG_LOSS_EPSILON`; `web/lib/player-forecasts/servedForecastLedger.ts:360 scoringRows`; `web/lib/player-forecasts/servedForecastLedger.ts:473 scorePairedLedger`; `web/lib/player-forecasts/servedForecastLedger.ts:460 pairedError`; `web/lib/player-forecasts/servedForecastLedger.ts:447 comparableValues`; `web/lib/player-forecasts/servedForecastLedger.ts:332 errorStat` …
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; denominators: per game; generation: current
- **Opus view (PFC-045):**
  - Method: rmseSkill = 1 - sqrt(SSE_source/SSE_reference) on identical cohorts (null if reference SSE 0). Market: prop event = act > line on dressed player (pushes excluded); team_win on known start. Brier, log loss (eps 1e-6), brierSkill = 1 - Brier_source/Brier_market.
  - Inputs/units: per-game counts; probabilities 0-1; sources: forge_served_forecast_ledger
  - Output scale: rmseSkill (1 - RMSE ratio, unbounded below, 1 best); brierSkill (1 - Brier ratio); log loss nats; writes: —
  - Status: unknown — /api/v1/forge/scoreboard (no page caller found) and scripts/forge-ledger-evaluate.ts
  - Consumers: pages/api/v1/forge/scoreboard.ts; scripts/forge-ledger-evaluate.ts
- **Codex view (served-ledger-market-scoring, calculation, location; Codex family 'Served forecast ledger evaluation'):** Same-event model versus market Brier, log loss and Brier skill (scoreMarketLedger)
  - Purpose: Score model and market probabilities on identical settled events. Prop outcome is actual>line for a dressed player; exclude pushes and DNP/unknown outcomes. Team-win outcome is recorded act_win on a known goalie start. Compute mean squared probability error (Brier), mean binary negative natural-log likelihood, and Brier skill=1-source SSE/market SSE from unrounded errors on each model/event cohort.
  - Inputs/units: Settled unique market ledger rows containing de-vigged market P(over\|no push), source P(over\|no push), prop count line and actual category counts; optional conditional team win probability, source team-xG win probability and known binary goalie-start/win outcomes. Valid probabilities must be in [0,1].
  - Output scale: Per player class/event/model: n, pushes, missingOutcome and notStarted are counts. Brier is [0,1]. Log loss uses natural logs (nats per event) with p clipped to [1e-6,1-1e-6] for logarithms only. Brier skill is dimensionless <=1 with no finite lower bound, positive means lower model Brier, null for market SSE=0. Empty probability cohort yields null Brier/logLoss; outputs rounded to 4 decimals.
  - Version/status: Checked-in local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. LEDGER_SOURCES includes bridge_exact, bridge_reaimed, native, naive_last5, naive_season, market; source names are not evidence of live/deployed population. LEDGER_MARKET_ENABLED is true in source only. Inspected source files clean; no tests or execution.
- **Codex view (served-ledger-paired-scoring, calculation, location; Codex family 'Served forecast ledger evaluation'):** Matched-source error and RMSE skill comparisons (scorePairedLedger)
  - Purpose: Pair sources on season_id, served_date, player_class, player_id and game_id, then evaluate each head on the exact same known outcomes. Reuse per-source MAE/bias/RMSE/totals/ratio/MZ summaries and compute RMSE skill=1-sqrt(source SSE/reference SSE) from unrounded same-cohort squared errors. Also produce matched goalie binary Brier/reliability summaries, tied source-expected-FP deciles and exclusion/pairing counts.
  - Inputs/units: Two settled source records per same identity/date/player-game, category count or fantasy-point predictions, equal known category actuals, matching participation labels; goalie probabilities [0,1] and equal known binary start/win/shutout outcomes. Optional fantasy weights are points per category event.
  - Output scale: Head-specific paired n and exclusions are counts. Underlying MAE/bias/RMSE/intercept retain category count or FP units; slopes/ratios are dimensionless. RMSE skill is dimensionless <=1 with no finite lower bound, positive for lower source error, null when reference SSE=0 or no valid pair. Binary Brier and reliability means are [0,1]. Rounded to 4 decimals; paired/no_shared_player_games and scored/no_valid_pairs statuses are separate.
  - Version/status: Checked-in local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. LEDGER_SOURCES includes bridge_exact, bridge_reaimed, native, naive_last5, naive_season, market; source names are not evidence of live/deployed population. LEDGER_MARKET_ENABLED is true in source only. Inspected source files clean; no tests or execution.
- **Audit context:**
  - Intent (Opus): servedForecastLedger.ts:469 'Pairwise comparisons, never intersections of unrelated source-level averages'; :526 'Model versus market in probability space on the same settled events'
  - Intended contract (Codex served-ledger-market-scoring): web/lib/player-forecasts/servedForecastLedger.ts:526-529: probabilities compared on identical known events, pushes and DNP voids excluded; team_win is conditional on known start, never against unconditional goalie exp_win_prob. Each model has its own available-probability intersection with market. Duplicate and invalid identities excluded by scoringRows; invalid model probabilities skipped; explicit event/skill definitions returned at :563-565.
  - Intended contract (Codex served-ledger-paired-scoring): web/lib/player-forecasts/servedForecastLedger.ts:469-472: never compare unrelated source-level averages; require both forecasts and equal known actuals; ambiguous duplicate source keys excluded. Comparisons follow pair order in LEDGER_SOURCES. Count/FP population requires both dressed; goalie binary population permits known nonstarts on participation-consistent pairs. Missing prediction, missing outcome and conflicting actuals counted separately for each head. Source expected-FP rank defines decile membership; optional weight recomputation preserves missing contributing heads. Definitions returned explicitly at :508-512.
  - External references: Skill scores (1 - MSE/MSE_ref), Brier skill score vs market benchmark
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/servedForecastLedger.test.ts`; `web/lib/player-forecasts/servedForecastLedger.test.ts:209 paired suite covers same-cohort RMSE skill and MZ intercept, dates/seasons/games, duplicates and malformed identities, head-specific missing/conflicting actuals, DNPs, FP bins and weights, zero reference error, and valid/invalid binary events. Discovered, not run.`; `web/lib/player-forecasts/servedForecastLedger.test.ts:376 market settlement and same-event Brier/log-loss/skill checks; :397 push/DNP/nonstart exclusions. Discovered, not run.`; `web/lib/player-forecasts/servedForecastLedger.test.ts:392 market-implied mean paired reference. Discovered, not run.`
- **Leads (not audited):**
  - (opus) rmseSkill uses sqrt ratio (RMSE skill), while brierSkill uses MSE ratio; different skill definitions side by side
  - (codex:served-ledger-market-scoring) ["Deployed ledger version, persisted population, active capture, independent universe availability and live coverage not verified.", "These are descriptive evaluation summaries, not predictive qualification, as explicitly stated in LEDGER_SCORING_LIMITATIONS."]
  - (codex:served-ledger-paired-scoring) ["Deployed ledger version, persisted population, active capture, independent universe availability and live coverage not verified.", "These are descriptive evaluation summaries, not predictive qualification, as explicitly stated in LEDGER_SCORING_LIMITATIONS."]

## M-PFC-032 Release evaluation gates (v4 fantasy batch and v5 advanced batch)

- **Match:** Both; Opus PFC-047; Codex modeling-player-forecasts-advanced-evaluate-advanced-batch
- **Purpose:** Blocks release unless loss non-inferiority and interval calibration pass
- **Where:** `modeling/player_forecasts/advanced.py:393 (evaluate_fantasy_batch)`; `modeling/player_forecasts/advanced.py:1481 (evaluate_advanced_batch)`; `modeling/player_forecasts/advanced.py:1481 evaluate_advanced_batch`
- **Tags (heuristic):** generation: current
- **Opus view (PFC-047):**
  - Method: v4: selected MAE <= baseline + 1e-12 and coverage in [0.75,0.85] with conformal method, rookie validation eligible; v5: coverage and observed coverage in [0.75,0.85], source coverage >= 0.95, golden-vector hash replay
  - Inputs/units: MAE; coverage fraction 0-1; sources: artifacts
  - Output scale: boolean gates/blockers; writes: file: evaluation receipt
  - Status: unknown — manual CLI season-advanced-train/-evaluate/-project (modeling/player_forecasts/__main__.py:163-175, docs/player-projections/player-forecasts-runbook.md advanced-v5 section); output imported with the season bundle; no scheduler found
  - Consumers: train_advanced_artifact; project_advanced_release
- **Codex view (modeling-player-forecasts-advanced-evaluate-advanced-batch, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Evaluate advanced batch (evaluate_advanced_batch)
  - Purpose: Evaluate advanced batch for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def evaluate_advanced_batch(artifact_path: Path, output: Path) -> dict[str, Any]: root = artifact_path if artifact_path.is_dir() else artifact_path.parent artifact = read_json(root / "season-artifact.json") manifest = read_json(root / "artifact-manifest.json") if ( artifact.get("contractVersion") != ADVANCED_SEASON_CONTRACT_VERSION or artifact.get("contractChecksum") != ADVANCED_SEASON_CONTRACT_SHA256 or manifest.get("artifactChecksum") != _file_sha256(root / "season-artifact.json") ): raise RuntimeError("advanced artifact contract or checksum mismatch") target_results: list[dict[str, Any]] = [] blockers: list[str] = [] required = { "forward": SKATER_ADVANCED_TARGETS, "defense": SKATER_ADVANCED_TARGETS, "goalie": GOALIE_ADVANCED_TARGETS, "team": TEAM_AD…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["player-forecasts-v5-distance-bands-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): promotionPolicy 'Prospective 2026-27 evidence remains required' (advanced.py evaluate_advanced_batch); docs/player-projections/research-contract-v4-season-fantasy.json acceptance
  - Intended contract (Codex modeling-player-forecasts-advanced-evaluate-advanced-batch): {"source": "modeling/player_forecasts/advanced.py:1481", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/advanced.py:1483 artifact = read_json(root / \"season-artifact.json\")", "modeling/player_forecasts/advanced.py:1484 manifest = read_json(root / \"artifact-manifest.json\")", "modeling/player_forecasts/advanced.py:1488 or manifest.get(\"artifactChecksum\") != _file_sha256(root / \"season-artifact.json\")"]}
  - External references: none suggested
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2336"]}`
- **Leads (not audited):**
  - (opus) gates evaluate in-sample statistics that are near-guaranteed to pass (coverage calibrated on the same folds; selected MAE <= baseline by construction)
  - (codex:modeling-player-forecasts-advanced-evaluate-advanced-batch) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-033 Horizon residual quantile calibration

- **Match:** Both; Opus PFC-048; Codex modeling-player-forecasts-challenger-math-fit-horizon-residual-quantiles
- **Purpose:** Per population/target/horizon empirical residual quantiles for intervals
- **Where:** `modeling/player_forecasts/challenger_math.py:25 (fit_horizon_residual_quantiles)`; `modeling/player_forecasts/challenger_math.py:23 fit_horizon_residual_quantiles`
- **Tags (heuristic):** generation: development, current
- **Opus view (PFC-048):**
  - Method: residuals y - yhat grouped by (population,target,horizon 1..10), pooled fallback when empty; mean, sample variance, quantile offsets p10..p90 (linear interpolation)
  - Inputs/units: residuals in target units; sources: validation-features.jsonl
  - Output scale: quantile offsets; variance; writes: validation-challenger-artifact.json
  - Status: draft — validation-only challenger (CLI build-validation-features/train-validation-challenger, __main__.py:62-67); promotionEligible False; consumed only by the functions inference worker, which is flagged off
  - Consumers: challenger_inference; functions runtime
- **Codex view (modeling-player-forecasts-challenger-math-fit-horizon-residual-quantiles, calculation, location; Codex family 'Python forecast research and season models'):** Horizon residual quantile calibration (fit_horizon_residual_quantiles)
  - Purpose: Group actual-prediction by population/target/horizon 1-10; fallback to pooled population-target; empirical residual offsets and sample variance.
  - Inputs/units: Named model/observation inputs at cited declaration; p10/p25/p50/p75/p90 offsets, mean residual, variance, fallback flags. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: p10/p25/p50/p75/p90 offsets, mean residual, variance, fallback flags.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Horizon uncertainty' (:96)
  - Intended contract (Codex modeling-player-forecasts-challenger-math-fit-horizon-residual-quantiles): {"source": "modeling/player_forecasts/challenger_math.py:23", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/challenger_math.py:40 residual_mean = sum(source) / len(source)", "modeling/player_forecasts/challenger_math.py:41 residual_variance = sum((value - residual_mean) ** 2 for value in source) / max(1, len(source) - 1)", "modeling/player_forecasts/challenger_math.py:52 f\"p{int(probability * 100)}\": _quantile(source, probability)"]}
  - External references: empirical residual (split-conformal style) intervals
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2346"]}`
- **Leads (not audited):**
  - (opus) residuals come from the same development folds used to select the winner
  - (codex:modeling-player-forecasts-challenger-math-fit-horizon-residual-quantiles) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-034 Paired loss bootstrap (game/slate clusters)

- **Match:** Both; Opus PFC-049; Codex modeling-player-forecasts-daily-board-paired
- **Purpose:** Estimates paired loss reduction of a champion vs baseline with cluster bootstrap CI
- **Where:** `modeling/player_forecasts/daily_board.py:102 (_paired)`; `modeling/player_forecasts/daily_board.py:102 _paired`
- **Tags (heuristic):** generation: research, development, current
- **Opus view (PFC-049):**
  - Method: loss = absolute error (squared for probability targets); unit mean of baseline loss - champion loss; 1000 resamples of units, seed 20260915; 2.5%/97.5% quantiles
  - Inputs/units: per-row losses; sources: settled rows
  - Output scale: mean loss reduction and 95% bounds; writes: —
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: all daily-board evaluators
- **Codex view (modeling-player-forecasts-daily-board-paired, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Paired (_paired)
  - Purpose: Paired for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _paired(rows: list[dict[str, Any]], baseline: str, unit: str, champion: str = "forge") -> dict[str, Any]: grouped: dict[str, list[float]] = defaultdict(list) for row in rows: loss = (lambda estimate: (estimate - row["outcome"]) ** 2) if row["target_key"] in PROBABILITY_TARGETS else (lambda estimate: abs(estimate - row["outcome"])) key = row["game_date"] if unit == "slate" else f'{row["game_date"]}:{row["game_id"]}' grouped[key].append(loss(row["estimates"][baseline]) - loss(row["estimates"][champion])) units = [sum(values) / len(values) for _, values in sorted(grouped.items())] if not units: return {"units": 0} rng = random.Random(SEED) draws = [sum(rng.choice(units) for _ in units) / len(units) for _ in range(1000)] return {"units": len(units), "me…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["starter-board-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in code; docs/start-chart/launch-validation.md
  - Intended contract (Codex modeling-player-forecasts-daily-board-paired): {"source": "modeling/player_forecasts/daily_board.py:102", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board.py:105 loss = (lambda estimate: (estimate - row[\"outcome\"]) ** 2) if row[\"target_key\"] in PROBABILITY_TARGETS else (lambda estimate: abs(estimate - row[\"outcome\"]))", "modeling/player_forecasts/daily_board.py:108 units = [sum(values) / len(values) for _, values in sorted(grouped.items())]", "modeling/player_forecasts/daily_board.py:112 draws = [sum(rng.choice(units) for _ in units) / len(units) for _ in range(1000)]", "modeling/player_forecasts/daily_board.py:113 return {\"units\": len(units), \"meanLossReduction\": sum(units) / len(units),"]}
  - External references: cluster bootstrap; Diebold-Mariano style paired comparison
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (codex:modeling-player-forecasts-daily-board-paired) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-035 Daily-board evaluation metrics (MAE, RMSE, bias, Brier, log loss, calibration bins, CRPS, interval score)

- **Match:** Both; Opus PFC-050; Codex modeling-player-forecasts-daily-board-crps, modeling-player-forecasts-daily-board-evaluate-daily-board, modeling-player-forecasts-daily-board-metrics
- **Purpose:** Scores point, probability and sample-based forecasts
- **Where:** `modeling/player_forecasts/daily_board.py:41 (crps)`; `modeling/player_forecasts/daily_board.py:70 (_metrics)`; `modeling/player_forecasts/daily_board.py:122 (evaluate_daily_board)`; `modeling/player_forecasts/daily_board.py:41 crps`; `modeling/player_forecasts/daily_board.py:122 evaluate_daily_board`; `modeling/player_forecasts/daily_board.py:70 _metrics`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, development, current
- **Opus view (PFC-050):**
  - Method: MAE, RMSE, bias = mean(estimate - outcome); Brier; log loss with 1e-12 floor; 10 equal-width calibration bins; CRPS = mean\|X-y\| - sum((2i-n+1)x_i)/n^2; 80% interval from linear-interpolated quantiles; interval score = width + 10*(below) + 10*(above); segments by position/usage/low_owned/rookie/injury/traded/lineup
  - Inputs/units: estimates in target units; probabilities 0-1; samples; sources: settled daily-board rows
  - Output scale: MAE/RMSE/bias; Brier 0-1; log loss; CRPS; interval score; writes: file: evaluation report
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: daily_board_training; daily_board_context; daily_board_goalies; daily_board_strength
- **Codex view (modeling-player-forecasts-daily-board-crps, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Crps (crps)
  - Purpose: Crps for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def crps(samples: list[float], outcome: float) -> float: if not samples or not all(_finite(value) for value in samples): raise ValueError("CRPS requires finite scenario draws") ordered = sorted(samples) size = len(ordered) return sum(abs(value - outcome) for value in ordered) / size - sum( (2 * index - size + 1) * value for index, value in enumerate(ordered) ) / (size * size)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["starter-board-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-daily-board-evaluate-daily-board, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Evaluate daily board (evaluate_daily_board)
  - Purpose: Evaluate daily board for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def evaluate_daily_board(rows: list[dict[str, Any]], *, training_end: str, validation_start: str, validation_end: str, game_type: int = 2) -> dict[str, Any]: if type(game_type) is not int or game_type not in (1, 2): raise ValueError("select preseason (1) or regular season (2) separately") for value in (training_end, validation_start, validation_end): if datetime.fromisoformat(value).date().isoformat() != value: raise ValueError("split dates must use YYYY-MM-DD") if not training_end < validation_start <= validation_end: raise ValueError("training and validation must be chronological and disjoint") accepted = [] excluded: dict[str, int] = defaultdict(int) seen = set() game_checkpoints, checkpoints = {}, set() missing_comparators: dict[str, int] = defaultd…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["starter-board-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-daily-board-metrics, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Metrics (_metrics)
  - Purpose: Metrics for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _metrics(rows: list[dict[str, Any]], model: str, probability: bool) -> dict[str, Any]: pairs = [(float(row["estimates"][model]), float(row["outcome"])) for row in rows] if not pairs: return {"rows": 0} errors = [estimate - outcome for estimate, outcome in pairs] report: dict[str, Any] = {"rows": len(pairs), "mae": sum(map(abs, errors)) / len(pairs), "rmse": math.sqrt(sum(error * error for error in errors) / len(pairs)), "bias": sum(errors) / len(pairs)} if probability: if any(not 0 <= estimate <= 1 or outcome not in (0, 1) for estimate, outcome in pairs): raise ValueError("probability estimates must be in [0,1] with binary labels") report["brier"] = sum(error * error for error in errors) / len(pairs) report["logLoss"] = -sum(outcome * math.log(max(1…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["starter-board-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): daily_board.py:1 docstring; docs/start-chart/daily-board-contract-v1.json
  - Intended contract (Codex modeling-player-forecasts-daily-board-crps): {"source": "modeling/player_forecasts/daily_board.py:41", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board.py:46 return sum(abs(value - outcome) for value in ordered) / size - sum(", "modeling/player_forecasts/daily_board.py:47 (2 * index - size + 1) * value for index, value in enumerate(ordered)", "modeling/player_forecasts/daily_board.py:48 ) / (size * size)"]}
  - Intended contract (Codex modeling-player-forecasts-daily-board-evaluate-daily-board): {"source": "modeling/player_forecasts/daily_board.py:122", "explicit_comment": "modeling/player_forecasts/daily_board.py:145 Historical exports are explicitly limited to type 2. Live captures must", "arithmetic_locations": ["modeling/player_forecasts/daily_board.py:210 positives = sum(r[\"outcome\"] == 1 for r in members)"]}
  - Intended contract (Codex modeling-player-forecasts-daily-board-metrics): {"source": "modeling/player_forecasts/daily_board.py:70", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board.py:75 report: dict[str, Any] = {\"rows\": len(pairs), \"mae\": sum(map(abs, errors)) / len(pairs),", "modeling/player_forecasts/daily_board.py:76 \"rmse\": math.sqrt(sum(error * error for error in errors) / len(pairs)), \"bias\": sum(errors) / len(pairs)}", "modeling/player_forecasts/daily_board.py:80 report[\"brier\"] = sum(error * error for error in errors) / len(pairs)", "modeling/player_forecasts/daily_board.py:81 report[\"logLoss\"] = -sum(outcome * math.log(max(1e-12, estimate)) + (1 - outcome) * math.log(max(1e-12, 1 - estimate)) for estimate, outcome in pairs) / len(pairs)", "modeling/player_forecasts/daily_board.py:84 members = [(p, y) for p, y in pairs if min(9, int(p * 10)) == index]", "modeling/player_forecasts/daily_board.py:86 report[\"calibrationBins\"].append({\"bin\": index, \"rows\": len(members), \"predicted\": sum(p for p, _ in members) / len(members), \"observed\": sum(y for _, y in members) / len(members)})", "modeling/player_forecasts/daily_board.…
  - External references: Gneiting and Raftery (2007) CRPS and interval score; Brier; reliability diagrams
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1996", "web/lib/forge-v2/horizonEvaluation.test.ts:32"]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1996"]}`
- **Leads (not audited):**
  - (codex:modeling-player-forecasts-daily-board-crps) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-daily-board-evaluate-daily-board) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-daily-board-metrics) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-036 Paired slate bootstrap and lockbox promotion gates

- **Match:** Both; Opus PFC-052; Codex modeling-player-forecasts-model-paired-slate-bootstrap, modeling-player-forecasts-scoring-evaluate-lockbox-evidence
- **Purpose:** Tests candidate vs position-prior loss reduction and enforces lockbox readiness
- **Where:** `modeling/player_forecasts/model.py:107 (_paired_slate_bootstrap)`; `modeling/player_forecasts/model.py:266 (seal_for_lockbox)`; `modeling/player_forecasts/scoring.py:64 (evaluate_lockbox_evidence)`; `modeling/player_forecasts/model.py:107 _paired_slate_bootstrap`; `modeling/player_forecasts/scoring.py:57 evaluate_lockbox_evidence`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, development, current
- **Opus view (PFC-052):**
  - Method: slate mean of (baseline loss - model loss); 2000 bootstrap resamples of slates (seed 20260802); lower95 = 2.5% quantile; gates: relative MAE reduction >= 2%, lower95 > 0, \|coverage-0.8\| <= 0.05, sparse (<10 games) relative regression <= 5%
  - Inputs/units: absolute errors per row; sources: features.jsonl
  - Output scale: relative loss reduction fraction; bootstrap bound; writes: model-artifact.json lockboxReview, lockbox evidence file
  - Status: draft — historical-core research lockbox pipeline (CLI freeze/seal-for-lockbox/evaluate-lockbox, modeling/player_forecasts/__main__.py:54-94); artifact promotionEligible False (model.py:279)
  - Consumers: lockbox.evaluate_lockbox_once; freeze.py
- **Codex view (modeling-player-forecasts-model-paired-slate-bootstrap, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Paired slate bootstrap (_paired_slate_bootstrap)
  - Purpose: Paired slate bootstrap for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _paired_slate_bootstrap( rows: list[dict[str, Any]], candidate: str, *, iterations: int = 2000, ) -> dict[str, float \| int \| None]: by_date: dict[str, list[float]] = defaultdict(list) model_losses: list[float] = [] baseline_losses: list[float] = [] for row in rows: estimate = prediction(row, candidate) baseline = prediction(row, "position_prior") if estimate is None or baseline is None: continue outcome = float(row["outcome"]) model_loss = abs(outcome - estimate) baseline_loss = abs(outcome - baseline) by_date[row["game_date"]].append(baseline_loss - model_loss) model_losses.append(model_loss) baseline_losses.append(baseline_loss) dates = sorted(by_date)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-scoring-evaluate-lockbox-evidence, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Evaluate lockbox evidence (evaluate_lockbox_evidence)
  - Purpose: Evaluate lockbox evidence for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def evaluate_lockbox_evidence(freeze: Path, start: str, end: str) -> dict[str, Any]: artifact = read_json(freeze / "model-artifact.json") grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list) for row in read_jsonl(freeze / "features.jsonl"): if not start <= row["game_date"] <= end: continue population = str(row.get("population") or ("defense" if row.get("position") == "D" else "forward")) grouped[(population, str(row["target_key"]))].append(row) segments: list[dict[str, Any]] = [] for (population, target), rows in sorted(grouped.items()): target_model = artifact.get("segments", {}).get(population, {}).get(target) if not target_model: continue candidate = target_model["candidate"] model_pairs = [(prediction(row, candidate), float(row["…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/player-projections/lockbox-evidence-2025-26.md; docs/player-projections/development-evidence-2025-26.md
  - Intended contract (Codex modeling-player-forecasts-model-paired-slate-bootstrap): {"source": "modeling/player_forecasts/model.py:107", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/model.py:127 slate_means = [sum(by_date[date]) / len(by_date[date]) for date in dates]", "modeling/player_forecasts/model.py:130 sum(randomizer.choice(slate_means) for _ in dates) / len(dates)", "modeling/player_forecasts/model.py:133 baseline_mae = sum(baseline_losses) / len(baseline_losses)", "modeling/player_forecasts/model.py:134 model_mae = sum(model_losses) / len(model_losses)", "modeling/player_forecasts/model.py:138 \"relativeLossReduction\": (baseline_mae - model_mae) / max(abs(baseline_mae), 1e-12),"]}
  - Intended contract (Codex modeling-player-forecasts-scoring-evaluate-lockbox-evidence): {"source": "modeling/player_forecasts/scoring.py:57", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/scoring.py:58 artifact = read_json(freeze / \"model-artifact.json\")", "modeling/player_forecasts/scoring.py:60 for row in read_jsonl(freeze / \"features.jsonl\"):", "modeling/player_forecasts/scoring.py:78 model_mae = sum(abs(outcome - model) for model, _, outcome in paired) / len(paired)", "modeling/player_forecasts/scoring.py:79 baseline_mae = sum(abs(outcome - baseline) for _, baseline, outcome in paired) / len(paired)", "modeling/player_forecasts/scoring.py:84 coverage = sum(", "modeling/player_forecasts/scoring.py:87 ) / len(paired)", "modeling/player_forecasts/scoring.py:98 sparse_model = sum(abs(outcome - model) for model, _, outcome in sparse) / len(sparse)", "modeling/player_forecasts/scoring.py:99 sparse_baseline = sum(abs(outcome - baseline) for _, baseline, outcome in sparse) / len(sparse)"]}
  - External references: block (cluster) bootstrap by slate
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (codex:modeling-player-forecasts-model-paired-slate-bootstrap) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-scoring-evaluate-lockbox-evidence) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-037 Range evaluation MAE/RMSE and skill score

- **Match:** Both; Opus PFC-053; Codex modeling-player-forecasts-scoring-evaluate-lockbox-evidence, modeling-player-forecasts-scoring-evaluate-range, modeling-player-forecasts-scoring-skill-score
- **Purpose:** Scores model predictions over a date range and maps loss to a 0-100 skill score
- **Where:** `modeling/player_forecasts/scoring.py:11 (evaluate_range)`; `modeling/player_forecasts/scoring.py:56 (skill_score)`; `modeling/player_forecasts/lockbox.py:26 (evaluate_lockbox_once)`; `modeling/player_forecasts/scoring.py:57 evaluate_lockbox_evidence`; `modeling/player_forecasts/scoring.py:12 evaluate_range`; `modeling/player_forecasts/scoring.py:52 skill_score`
- **Tags (heuristic):** percent scale: 0-100; generation: research, development, current
- **Opus view (PFC-053):**
  - Method: MAE, RMSE per target and population; skill = clip(50 + 50*(baseline - model)/\|baseline\|, 0, 100)
  - Inputs/units: absolute/squared errors; sources: features.jsonl
  - Output scale: MAE/RMSE in target units; skill 0-100 (50 = parity); writes: file: lockbox receipt
  - Status: draft — historical-core research lockbox pipeline (CLI freeze/seal-for-lockbox/evaluate-lockbox, modeling/player_forecasts/__main__.py:54-94); artifact promotionEligible False (model.py:279)
  - Consumers: lockbox workflow
- **Codex view (modeling-player-forecasts-scoring-evaluate-lockbox-evidence, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Evaluate lockbox evidence (evaluate_lockbox_evidence)
  - Purpose: Evaluate lockbox evidence for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def evaluate_lockbox_evidence(freeze: Path, start: str, end: str) -> dict[str, Any]: artifact = read_json(freeze / "model-artifact.json") grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list) for row in read_jsonl(freeze / "features.jsonl"): if not start <= row["game_date"] <= end: continue population = str(row.get("population") or ("defense" if row.get("position") == "D" else "forward")) grouped[(population, str(row["target_key"]))].append(row) segments: list[dict[str, Any]] = [] for (population, target), rows in sorted(grouped.items()): target_model = artifact.get("segments", {}).get(population, {}).get(target) if not target_model: continue candidate = target_model["candidate"] model_pairs = [(prediction(row, candidate), float(row["…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-scoring-evaluate-range, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Evaluate range (evaluate_range)
  - Purpose: Evaluate range for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def evaluate_range(freeze: Path, start: str \| None, end: str) -> dict[str, Any]: artifact = read_json(freeze / "model-artifact.json") errors: dict[str, list[float]] = defaultdict(list) squared: dict[str, list[float]] = defaultdict(list) by_population: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list)) for row in read_jsonl(freeze / "features.jsonl"): if row["game_date"] > end or (start and row["game_date"] < start): continue target = row["target_key"] population = str(row.get("population") or ("defense" if row.get("position") == "D" else "forward")) target_model = artifact.get("segments", {}).get(population, {}).get(target) if not target_model: target_model = artifact.get("targets", {}).get(target, {}) candidate = target_model.g…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-scoring-skill-score, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Skill score (skill_score)
  - Purpose: Skill score for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def skill_score(model_loss: float, baseline_loss: float) -> float: denominator = max(abs(baseline_loss), 1e-12) return min(100.0, max(0.0, 50.0 + 50.0 * ((baseline_loss - model_loss) / denominator)))
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/player-projections/lockbox-evidence-2025-26.md
  - Intended contract (Codex modeling-player-forecasts-scoring-evaluate-lockbox-evidence): {"source": "modeling/player_forecasts/scoring.py:57", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/scoring.py:58 artifact = read_json(freeze / \"model-artifact.json\")", "modeling/player_forecasts/scoring.py:60 for row in read_jsonl(freeze / \"features.jsonl\"):", "modeling/player_forecasts/scoring.py:78 model_mae = sum(abs(outcome - model) for model, _, outcome in paired) / len(paired)", "modeling/player_forecasts/scoring.py:79 baseline_mae = sum(abs(outcome - baseline) for _, baseline, outcome in paired) / len(paired)", "modeling/player_forecasts/scoring.py:84 coverage = sum(", "modeling/player_forecasts/scoring.py:87 ) / len(paired)", "modeling/player_forecasts/scoring.py:98 sparse_model = sum(abs(outcome - model) for model, _, outcome in sparse) / len(sparse)", "modeling/player_forecasts/scoring.py:99 sparse_baseline = sum(abs(outcome - baseline) for _, baseline, outcome in sparse) / len(sparse)"]}
  - Intended contract (Codex modeling-player-forecasts-scoring-evaluate-range): {"source": "modeling/player_forecasts/scoring.py:12", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/scoring.py:13 artifact = read_json(freeze / \"model-artifact.json\")", "modeling/player_forecasts/scoring.py:17 for row in read_jsonl(freeze / \"features.jsonl\"):", "modeling/player_forecasts/scoring.py:33 squared[target].append(error * error)", "modeling/player_forecasts/scoring.py:39 \"mae\": sum(values) / len(values),", "modeling/player_forecasts/scoring.py:40 \"rmse\": math.sqrt(sum(squared[target]) / len(squared[target])),", "modeling/player_forecasts/scoring.py:44 target: {\"rows\": len(values), \"mae\": sum(values) / len(values)}"]}
  - Intended contract (Codex modeling-player-forecasts-scoring-skill-score): {"source": "modeling/player_forecasts/scoring.py:52", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/scoring.py:54 return min(100.0, max(0.0, 50.0 + 50.0 * ((baseline_loss - model_loss) / denominator)))"]}
  - External references: MSE skill score (1 - model/baseline)
  - Fixtures/test data: none listed
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) skill_score is a nonstandard rescaling (50 = parity) - not comparable to the usual skill score
  - (codex:modeling-player-forecasts-scoring-evaluate-lockbox-evidence) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-scoring-evaluate-range) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-scoring-skill-score) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-038 Rolling-origin randomized conformal 80% interval calibration

- **Match:** Both; Opus PFC-054; Codex modeling-player-forecasts-season-select-rate-policy
- **Purpose:** Scales per-player predictive variance so p10-p90 intervals cover 80% in validation
- **Where:** `modeling/player_forecasts/season.py:2391 (_select_rate_policy standardized residuals)`; `modeling/player_forecasts/season.py:2474 (interval multiplier and variance scale)`; `modeling/player_forecasts/season.py:2185 _select_rate_policy`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (PFC-054):**
  - Method: predictive variance = (support*player_var + k*max(\|prior\|,0.01))/(support+k); z = \|y - estimate\|/sqrt(max(var,0.01)); interval multiplier = ceil(0.8n)-th order statistic of z; tie probability randomizes coverage to exactly 0.8; intervalVarianceScale = (multiplier/1.281551565545)^2
  - Inputs/units: standardized absolute residuals (unitless); sources: season freeze
  - Output scale: sd multiplier; variance scale; coverage fraction 0-1; writes: season-artifact.json
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: variances in train_season_artifact; evaluate_fantasy_batch gate 0.75..0.85
- **Codex view (modeling-player-forecasts-season-select-rate-policy, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Select rate policy (_select_rate_policy)
  - Purpose: Select rate policy for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _select_rate_policy( rows: list[dict[str, Any]], target: str, birth_dates: dict[int, str \| None] \| None = None, ) -> dict[str, Any]: birth_dates = birth_dates or {} best: tuple[float, float, float, int] \| None = None for decay in DECAY_CANDIDATES: for shrink in SHRINK_CANDIDATES: absolute_errors: list[float] = [] for start, end in VALIDATION_FOLDS: summaries, (prior, _) = _weighted_summary(rows, target, decay, start) for row in rows: game_date = str(row["game_date"]) if not start <= game_date <= end or int(row["season_id"]) != TRAINING_CUTOFF_SEASON: continue if target not in row or row.get(target) is None: continue
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): calibrationMethod 'rolling_origin_randomized_conformal_p10_p90'; docs/player-projections/research-contract-v4-season-fantasy.json evaluation acceptance
  - Intended contract (Codex modeling-player-forecasts-season-select-rate-policy): {"source": "modeling/player_forecasts/season.py:2185", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2204 estimate = (support * player_mean + shrink * prior) / (support + shrink)", "modeling/player_forecasts/season.py:2206 mae = sum(absolute_errors) / len(absolute_errors) if absolute_errors else math.inf", "modeling/player_forecasts/season.py:2298 glm_mae = sum(glm_errors) / len(glm_errors) if glm_errors else None", "modeling/player_forecasts/season.py:2300 sum(negative_binomial_errors) / len(negative_binomial_errors)", "modeling/player_forecasts/season.py:2303 hurdle_mae = sum(hurdle_errors) / len(hurdle_errors) if hurdle_errors else None", "modeling/player_forecasts/season.py:2320 estimate = (support * player_mean + best[2] * prior) / (support + best[2])", "modeling/player_forecasts/season.py:2324 sum(contextual_errors) / len(contextual_errors)", "modeling/player_forecasts/season.py:2339 sum(baseline_errors) / len(baseline_errors) if baseline_errors else None"]}
  - External references: split conformal prediction (absolute standardized residual)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2381"]}`
- **Leads (not audited):**
  - (opus) calibration is fit on the same folds it then reports, so calibration80Coverage is ~0.8 by construction (randomized ties) and the 0.75-0.85 gate cannot fail
  - (opus) calibrated on single games but applied to season sums assuming independence
  - (codex:modeling-player-forecasts-season-select-rate-policy) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-039 Validation challenger features (HistoricalSeries, team/opponent position rates, play-driver assists)

- **Match:** Both; Opus PFC-057; Codex modeling-player-forecasts-challenger-features-build-validation-features, modeling-player-forecasts-challenger-math-assist-candidate-features, modeling-player-forecasts-challenger-math-official-assist-expectation
- **Purpose:** Builds per-vintage features including team-position and opponent-allowed rates and weighted assist signals
- **Where:** `modeling/player_forecasts/challenger_features.py:36 (HistoricalSeries)`; `modeling/player_forecasts/challenger_features.py:104 (build_validation_features)`; `modeling/player_forecasts/challenger_math.py:9 (official_assist_expectation)`; `modeling/player_forecasts/challenger_math.py:13 (assist_candidate_features)`; `modeling/player_forecasts/challenger_features.py:99 build_validation_features`; `modeling/player_forecasts/challenger_math.py:13 assist_candidate_features`; `modeling/player_forecasts/challenger_math.py:9 official_assist_expectation`
- **Tags (heuristic):** denominators: per game; generation: development, current
- **Opus view (PFC-057):**
  - Method: prefix-sum means before cutoff; last 5/10/20; EWMA (same alphas); multi-season 0.7/0.3; team_position_rate = mean outcome of team's players at that position; opponent_allowed_position_rate = mean outcome of players facing the opponent; projected TOI = last-10 mean; assist variants: decomposed A1+A2, play_driver 0.7*A1+0.3*A2, 0.8*A1+0.2*A2
  - Inputs/units: per-game counts; TOI seconds; sources: skatersGameStats, pbp_plays, nhl_api_game_roster_spots, shift_charts
  - Output scale: per-game features; writes: file: validation-features.jsonl
  - Status: draft — validation-only challenger (CLI build-validation-features/train-validation-challenger, __main__.py:62-67); promotionEligible False; consumed only by the functions inference worker, which is flagged off
  - Consumers: challenger_model.train_validation_challenger; challenger_inference
- **Codex view (modeling-player-forecasts-challenger-features-build-validation-features, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Build validation features (build_validation_features)
  - Purpose: Build validation features for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def build_validation_features( freeze: Path, targets: tuple[str, ...] = TARGETS, ) -> dict[str, Any]: manifest = read_json(freeze / "manifest.json") if manifest.get("contractChecksum") != VALIDATION_CONTRACT_SHA256: raise RuntimeError("validation freeze contract checksum mismatch") target_season = int(manifest.get("targetSeason", TARGET_SEASON)) requested_targets = tuple(dict.fromkeys(targets)) unknown_targets = sorted(set(requested_targets) - set(TARGETS)) if unknown_targets: raise ValueError(f"unknown validation targets: {', '.join(unknown_targets)}") calculation_targets = tuple(dict.fromkeys( requested_targets + (("primary_assists", "secondary_assists") if "assists" in requested_targets else ()) + (("time_on_ice_seconds",) if "hits" in requested_targ…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-challenger-math-assist-candidate-features, calculation, location; Codex family 'Python forecast research and season models'):** Assist feature candidates (assist_candidate_features)
  - Purpose: A1+A2, .7*A1+.3*A2, .8*A1+.2*A2.
  - Inputs/units: Named model/observation inputs at cited declaration; Three research features, distinct from official assists. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Three research features, distinct from official assists.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-challenger-math-official-assist-expectation, calculation, location; Codex family 'Python forecast research and season models'):** Official assist decomposition (official_assist_expectation)
  - Purpose: max(0,primary)+max(0,secondary).
  - Inputs/units: Named model/observation inputs at cited declaration; Official expected assists; not 70/30 or 80/20 play-driver feature. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Official expected assists; not 70/30 or 80/20 play-driver feature.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Assist decomposition decision' (:62)
  - Intended contract (Codex modeling-player-forecasts-challenger-features-build-validation-features): {"source": "modeling/player_forecasts/challenger_features.py:99", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/challenger_features.py:103 manifest = read_json(freeze / \"manifest.json\")", "modeling/player_forecasts/challenger_features.py:116 games = list(read_jsonl(freeze / \"games.jsonl\"))", "modeling/player_forecasts/challenger_features.py:120 skaters = list(read_jsonl(freeze / \"skaters.jsonl\"))", "modeling/player_forecasts/challenger_features.py:158 output_path = freeze / \"validation-features.jsonl\"", "modeling/player_forecasts/challenger_features.py:159 temporary_path = freeze / \"validation-features.jsonl.tmp\"", "modeling/player_forecasts/challenger_features.py:185 0.7 * current_mean + 0.3 * previous_mean", "modeling/player_forecasts/challenger_features.py:263 write_json(freeze / \"manifest.json\", manifest)"]}
  - Intended contract (Codex modeling-player-forecasts-challenger-math-assist-candidate-features): {"source": "modeling/player_forecasts/challenger_math.py:13", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/challenger_math.py:18 \"play_driver_70_30\": 0.7 * primary_value + 0.3 * secondary_value,", "modeling/player_forecasts/challenger_math.py:19 \"play_driver_80_20\": 0.8 * primary_value + 0.2 * secondary_value,"]}
  - Intended contract (Codex modeling-player-forecasts-challenger-math-official-assist-expectation): {"source": "modeling/player_forecasts/challenger_math.py:9", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: opponent-adjusted rates (NST 'against' splits); primary-assist weighting (A1 more repeatable than A2)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2344"]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2348"]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2350"]}`
- **Leads (not audited):**
  - (opus) team/opponent rates only include target-season games (target_game_by_id), unlike position priors that span all seasons
  - (opus) opponent-allowed rate uses the scheduled opponent at vintage but the series key is per-row game opponent; early-season values are tiny-sample
  - (opus) 0.7/0.3 and 0.8/0.2 play-driver weights are fixed, then linearly recalibrated
  - (codex:modeling-player-forecasts-challenger-features-build-validation-features) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-challenger-math-assist-candidate-features) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:modeling-player-forecasts-challenger-math-official-assist-expectation) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-040 Historical-core feature engineering (career, season, last-N, EWMA, EB, opportunity-adjusted)

- **Match:** Both; Opus PFC-058; Codex modeling-player-forecasts-features-build-features
- **Purpose:** Builds leakage-safe per-game candidate predictors for 7 skater targets
- **Where:** `modeling/player_forecasts/features.py:47 (build_features)`; `modeling/player_forecasts/features.py:17 (parse_toi)`; `modeling/player_forecasts/features.py:13 (DECAYS, EMPIRICAL_BAYES_PRIOR_GAMES)`; `modeling/player_forecasts/features.py:47 build_features`
- **Tags (heuristic):** conditionality: conditional; denominators: per game; generation: research, development, current
- **Opus view (PFC-058):**
  - Method: history up to previous date; career mean; season-to-date; previous season; multi-season = 0.7*current + 0.3*previous; position prior = mean of last 10000 observations of that position/target; EB = (sum + 10*prior)/(n + 10); last 5/10/20 means; EWMA alpha in {0.05,0.1,0.2,0.35,0.5}; projected TOI = mean of last 10 TOIs; opportunity-adjusted = per-second EB (events + prior_rate*10*projTOI)/(seconds + 10*projTOI) * projTOI
  - Inputs/units: per-game counts; TOI seconds; sources: skatersGameStats, games, players (via freeze.py SKATER_QUERY)
  - Output scale: per-game features; writes: file: features.jsonl
  - Status: draft — historical-core research lockbox pipeline (CLI freeze/seal-for-lockbox/evaluate-lockbox, modeling/player_forecasts/__main__.py:54-94); artifact promotionEligible False (model.py:279)
  - Consumers: model.train_baseline; scoring.evaluate_range; lockbox
- **Codex view (modeling-player-forecasts-features-build-features, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Build features (build_features)
  - Purpose: Build features for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def build_features(freeze: Path) -> dict[str, Any]: target_season = int(read_json(freeze / "manifest.json").get("targetSeason", TARGET_SEASON)) records = list(normalized_outcomes(freeze / "skaters.jsonl", "skater")) # The raw goalie rows are retained in the sealed freeze, but appearance is # not a trustworthy historical starter label. Conditional-start targets # stay excluded until an audited starter reconstruction is approved. records.sort(key=lambda item: (item[0]["game_date"], item[0]["game_id"], item[0]["player_id"], item[1])) player_history: dict[tuple[int, str], deque[tuple[int, float]]] = defaultdict(lambda: deque(maxlen=1000)) position_history: dict[tuple[str, str], deque[float]] = defaultdict(lambda: deque(maxlen=10000)) player_rate_totals: dic…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): features.py:50 comment on goalie exclusion; docs/player-projections/development-evidence-2025-26.md
  - Intended contract (Codex modeling-player-forecasts-features-build-features): {"source": "modeling/player_forecasts/features.py:47", "explicit_comment": "modeling/player_forecasts/features.py:50 The raw goalie rows are retained in the sealed freeze, but appearance is", "arithmetic_locations": ["modeling/player_forecasts/features.py:48 target_season = int(read_json(freeze / \"manifest.json\").get(\"targetSeason\", TARGET_SEASON))", "modeling/player_forecasts/features.py:49 records = list(normalized_outcomes(freeze / \"skaters.jsonl\", \"skater\"))", "modeling/player_forecasts/features.py:60 output_path = freeze / \"features.jsonl\"", "modeling/player_forecasts/features.py:61 temporary_path = freeze / \"features.jsonl.tmp\"", "modeling/player_forecasts/features.py:80 position_prior = sum(position_values) / len(position_values) if position_values else None", "modeling/player_forecasts/features.py:81 current_mean = sum(current_season) / len(current_season) if current_season else None", "modeling/player_forecasts/features.py:82 previous_mean = sum(previous_season) / len(previous_season) if previous_season else None", "modeling/player_forecasts/features.py:84 0.7 * current_mean + 0.3 * previous_mean"]}
  - External references: Marcel weighting; EWMA smoothing; Tango regression
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2353"]}`
- **Leads (not audited):**
  - (opus) position prior uses a rolling window of the last 10000 observations, mixing seasons arbitrarily
  - (opus) empirical_bayes_rate is computed but not among model.py CANDIDATES (dead feature)
  - (opus) 0.7/0.3 weights hard-coded and differ from Marcel 5/4/3
  - (codex:modeling-player-forecasts-features-build-features) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-041 Native goalie win rate per appearance (boxscore decision)

- **Match:** Both; Opus PFC-067; Codex web-lib-player-forecasts-goaliebaselinerates-buildnativegoaliewinrates, web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoalieoutcomes
- **Purpose:** Observed win credits per positive-minute appearance over last 20 current-season appearances.
- **Where:** `web/lib/player-forecasts/goalieBaselineRates.ts:184 (buildNativeGoalieWinRates)`; `web/lib/player-forecasts/goalieBaselineRates.ts:207 (wins/selected.length)`; `web/lib/player-forecasts/nativeGoalieOutcomes.ts:19 (deriveNativeGoalieOutcomes)`; `web/lib/player-forecasts/goalieBaselineRates.ts:184 buildNativeGoalieWinRates`; `web/lib/player-forecasts/nativeGoalieOutcomes.ts:19 deriveNativeGoalieOutcomes`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per appearance; generation: current
- **Opus view (PFC-067):**
  - Method: Equal-weight mean of winCredit (W=1, L/O=0) over up to 20 most recent current-season positive-minute appearances incl. relief; any missing decision withholds whole rate. Decision validity: exactly one W on winning side, O only if period>3, one-goal margin in OT/SO.
  - Inputs/units: boxscore goalie decision W/L/O per positive-minute appearance; sources: nhl_api_game_payloads_raw (boxscore)
  - Output scale: probability-like rate 0-1 (wins per appearance); writes: player_forecast_source_observations
  - Status: live — approved native-goalie-appearance-win-rates-v1 (nativeDailyPipelineV2.ts:35)
  - Consumers: goalie contribution bundle; planning contributions x appearance probability
- **Codex view (web-lib-player-forecasts-goaliebaselinerates-buildnativegoaliewinrates, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Native goalie boxscore win-credit mean (buildNativeGoalieWinRates)
  - Purpose: Sum explicit credited wins / selected positive-minute appearances; any missing decision withholds whole rate.
  - Inputs/units: Named model/observation inputs at cited declaration; W per appearance [0,1], including relief; not start probability. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: W per appearance [0,1], including relief; not start probability.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-baseline-rates-v1", "native-goalie-appearance-shutout-rates-v1", "native-goalie-appearance-summary-win-rates-v1", "native-goalie-appearance-volume-rates-v1", "native-goalie-appearance-win-rates-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": …
- **Codex view (web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoalieoutcomes, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Derive native goalie outcomes (deriveNativeGoalieOutcomes)
  - Purpose: Observed labels only. No start probability, rate fitting or inferred shutout credit.
  - Inputs/units: Parameter/type declaration excerpt: export function deriveNativeGoalieOutcomes(input: NativeGoalieOutcomeInput) { const { appearance, nhlPlayerId, cutoffAt } = input; verifyBaselineBoxscoreReceipt(appearance, nhlPlayerId, cutoffAt, "goalie"); const receipt = appearance.finalBoxscore as BaselineBoxscoreReceipt; const raw = receipt.rawRow, game = receipt.game, body = raw.payload; const cutoff = timestampMicros(cutoffAt), fetched = timestampMicros(receipt.fetchedAt), start = timestampMicros(game.startTime), bodyStart = timestampMicros(body.startTimeUTC); const period = body.periodDescriptor; const sourceIdValid = id(raw.id) \|\| /^[a-f0-9]{64}$/.test(raw.payload_hash) && raw.id === `http:${raw.payload_hash}`; if (!id(nhlPlayerId) \|\| !sourceIdValid \|\| raw.endpoint !== "boxscore" \|\| cuto…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): goalieBaselineRates.ts:183 'Explicit native mean of observed win credits, including relief appearances. Never a start probability.'
  - Intended contract (Codex web-lib-player-forecasts-goaliebaselinerates-buildnativegoaliewinrates): {"source": "web/lib/player-forecasts/goalieBaselineRates.ts:184", "explicit_comment": "Explicit native mean of observed win credits, including relief appearances. Never a start probability.", "arithmetic_locations": ["web/lib/player-forecasts/goalieBaselineRates.ts:208 targetKey: \"WINS_GOALIE\", basis: \"per_appearance\", rate: wins / selected.length,", "web/lib/player-forecasts/goalieBaselineRates.ts:223 /** Joint appearance population preserves SA=SV+GA and minutes without requiring a prior or any future probability. */"]}
  - Intended contract (Codex web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoalieoutcomes): {"source": "web/lib/player-forecasts/nativeGoalieOutcomes.ts:19", "explicit_comment": "Observed labels only. No start probability, rate fitting or inferred shutout credit.", "arithmetic_locations": ["web/lib/player-forecasts/nativeGoalieOutcomes.ts:80 /** Exact bounded public query. The whole page is exposed; only approved bound appearances may be used. */"]}
  - External references: Team win probability models (Elo/xG); goalie wins largely team-driven
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`; `web/lib/player-forecasts/nativeGoalieOutcomes.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/goalieBaseline.test.ts:6", "web/lib/player-forecasts/nativeContributionAdmission.test.ts:6"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/nativeGoalieOutcomes.test.ts:5"]}`
- **Leads (not audited):**
  - (opus) no prior/shrinkage; with few appearances W rate can be 0 or 1
  - (opus) relief appearances rarely get decisions, mixing them depresses per-appearance W rate vs per-start
  - (opus) ignores opponent/team strength entirely
  - (codex:web-lib-player-forecasts-goaliebaselinerates-buildnativegoaliewinrates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoalieoutcomes) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-042 Native goalie volume rates (SV, GA, SA, minutes per appearance)

- **Match:** Both; Opus PFC-068; Codex web-lib-player-forecasts-goaliebaselinerates-buildnativegoalievolumerates
- **Purpose:** Joint per-appearance means of saves, goals against, shots against and minutes.
- **Where:** `web/lib/player-forecasts/goalieBaselineRates.ts:224 (buildNativeGoalieVolumeRates)`; `web/lib/player-forecasts/goalieBaselineRates.ts:224 buildNativeGoalieVolumeRates`
- **Tags (heuristic):** denominators: per game, per appearance; generation: current
- **Opus view (PFC-068):**
  - Method: Up to 20 most recent current-season positive-minute appearances (incl. relief); each requires SV+GA=SA and 0<min<=65; rate = total/n equal weight for each of 4 targets.
  - Inputs/units: saves/GA/SA counts per game; toiMinutes (minutes, <=65); sources: nhl_api_game_payloads_raw (boxscore)
  - Output scale: counts per appearance; GOALIE_MINUTES minutes per appearance; writes: player_forecast_source_observations
  - Status: live — approved native-goalie-appearance-volume-rates-v1 (nativeDailyPipelineV2.ts:35)
  - Consumers: planning contributions; game expectations SV%/GAA ratios
- **Codex view (web-lib-player-forecasts-goaliebaselinerates-buildnativegoalievolumerates, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Native goalie joint volume means (buildNativeGoalieVolumeRates)
  - Purpose: Average coherent SV,GA,SA,minutes across same selected current positive-minute appearances, including relief.
  - Inputs/units: Named model/observation inputs at cited declaration; SV/GA/SA per appearance, SA=SV+GA; minutes >0 and ≤65 per observation. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: SV/GA/SA per appearance, SA=SV+GA; minutes >0 and ≤65 per observation.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-baseline-rates-v1", "native-goalie-appearance-shutout-rates-v1", "native-goalie-appearance-summary-win-rates-v1", "native-goalie-appearance-volume-rates-v1", "native-goalie-appearance-win-rates-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": …
- **Audit context:**
  - Intent (Opus): goalieBaselineRates.ts:223 'Joint appearance population preserves SA=SV+GA and minutes without requiring a prior or any future probability.'
  - Intended contract (Codex web-lib-player-forecasts-goaliebaselinerates-buildnativegoalievolumerates): {"source": "web/lib/player-forecasts/goalieBaselineRates.ts:224", "explicit_comment": "Joint appearance population preserves SA=SV+GA and minutes without requiring a prior or any future probability.", "arithmetic_locations": ["web/lib/player-forecasts/goalieBaselineRates.ts:245 targetKey, basis: \"per_appearance\", rate: total / selected.length, consensusRate: null,", "web/lib/player-forecasts/goalieBaselineRates.ts:258 /** Separate provenance policy; a missing boxscore decision is never interpreted as zero. */"]}
  - External references: Goalie SV% regression to league mean (~.900-.905) with large k (e.g., ~3000 shots)
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/goalieBaseline.test.ts:7", "web/lib/player-forecasts/nativeContributionAdmission.test.ts:6"]}`
- **Leads (not audited):**
  - (opus) implied SV% from <=20 appearances un-regressed; GA rate not linked to opponent shot quality
  - (opus) equal weights here vs 0.9 decay in skater current policy (inconsistent recency treatment)
  - (codex:web-lib-player-forecasts-goaliebaselinerates-buildnativegoalievolumerates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-043 Native goalie summary-credited W and SO rates

- **Match:** Both; Opus PFC-069; Codex web-lib-player-forecasts-goaliebaselinerates-buildnativegoalieshutoutrates, web-lib-player-forecasts-goaliebaselinerates-buildnativegoaliesummarywinrates, web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoalieshutoutcredit, web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoaliesummarywincredit
- **Purpose:** Wins and shutouts per appearance from official NHL goalie summary rows cross-checked against boxscores.
- **Where:** `web/lib/player-forecasts/goalieBaselineRates.ts:259 (buildNativeGoalieSummaryWinRates)`; `web/lib/player-forecasts/goalieBaselineRates.ts:287 (buildNativeGoalieShutoutRates)`; `web/lib/player-forecasts/nativeGoalieOutcomes.ts:81 (nativeGoalieSummaryUrl)`; `web/lib/player-forecasts/nativeGoalieOutcomes.ts:128 (deriveNativeGoalieShutoutCredit)`; `web/lib/player-forecasts/nativeGoalieOutcomes.ts:141 (deriveNativeGoalieSummaryWinCredit)`; `web/lib/player-forecasts/goalieBaselineRates.ts:287 buildNativeGoalieShutoutRates`; `web/lib/player-forecasts/goalieBaselineRates.ts:259 buildNativeGoalieSummaryWinRates`; `web/lib/player-forecasts/nativeGoalieOutcomes.ts:128 deriveNativeGoalieShutoutCredit`; `web/lib/player-forecasts/nativeGoalieOutcomes.ts:141 deriveNativeGoalieSummaryWinCredit`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game, per appearance; generation: current
- **Opus view (PFC-069):**
  - Method: Summary row must match boxscore SV/GA/SA/TOI exactly (TOI <= 65*60, SV+GA=SA); shutout credit 0/1 only, SO=1 requires GA=0; summary window <=60 days, <=60 games, single page <50 rows. Rate = credits / selected appearances (<=20), withheld if any selected game missing/conflicting.
  - Inputs/units: NHL stats goalie/summary per-game rows (timeOnIce seconds, credited wins/shutouts 0/1); sources: NHL stats REST goalie/summary (captured receipts), nhl_api_game_payloads_raw
  - Output scale: rate 0-1 per appearance; writes: player_forecast_source_observations
  - Status: live — approved native-goalie-appearance-summary-win-rates-v1 and -shutout-rates-v1 (nativeDailyPipelineV2.ts:35)
  - Consumers: goalie contribution bundle; nativeDailyMeansCapture
- **Codex view (web-lib-player-forecasts-goaliebaselinerates-buildnativegoalieshutoutrates, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Native credited-shutout mean (buildNativeGoalieShutoutRates)
  - Purpose: Mean explicit official credited shutouts across selected appearances; no GA=0 inference.
  - Inputs/units: Named model/observation inputs at cited declaration; SO per positive-minute appearance [0,1]. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: SO per positive-minute appearance [0,1].
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-baseline-rates-v1", "native-goalie-appearance-shutout-rates-v1", "native-goalie-appearance-summary-win-rates-v1", "native-goalie-appearance-volume-rates-v1", "native-goalie-appearance-win-rates-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": …
- **Codex view (web-lib-player-forecasts-goaliebaselinerates-buildnativegoaliesummarywinrates, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Native goalie official-summary win mean (buildNativeGoalieSummaryWinRates)
  - Purpose: Mean official-summary win credits across selected appearances, exact boxscore identity/stat agreement required.
  - Inputs/units: Named model/observation inputs at cited declaration; W per appearance [0,1]; missing decisions not zero-filled. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: W per appearance [0,1]; missing decisions not zero-filled.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-baseline-rates-v1", "native-goalie-appearance-shutout-rates-v1", "native-goalie-appearance-summary-win-rates-v1", "native-goalie-appearance-volume-rates-v1", "native-goalie-appearance-win-rates-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": …
- **Codex view (web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoalieshutoutcredit, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Derive native goalie shutout credit (deriveNativeGoalieShutoutCredit)
  - Purpose: Credited SO only. Missing/ambiguous per-game evidence never becomes a GA=0 inference.
  - Inputs/units: Parameter/type declaration excerpt: export function deriveNativeGoalieShutoutCredit(input: NativeGoalieOutcomeInput & { summary: NativeGoalieShutoutSummary }) { const { row, coherent: volumeMatches, matches, body, receipt } = matchedNativeGoalieSummary(input); const coherent = volumeMatches && [0, 1].includes(row.shutouts) && !(row.shutouts === 1 && row.goalsAgainst !== 0); return { shutoutCredit: coherent ? row.shutouts as 0 \| 1 : null, reason: coherent ? null : matches > 1 ? "ambiguous_summary_row" : !row ? "missing_summary_row" : "incoherent_or_unsupported_summary_fields", fullPageRows: body.data.length, usedGameId: input.appearance.gameId, sourceReceipt: { id: `http:${receipt.bodySha256}`, url: receipt.url, fetchedAt: receipt.capturedAt, bodySha256: receipt.bodySha256 }, conditioning…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoaliesummarywincredit, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Derive native goalie summary win credit (deriveNativeGoalieSummaryWinCredit)
  - Purpose: Explicit official per-game win credit, including positive-minute relief/no-decision appearances.
  - Inputs/units: Parameter/type declaration excerpt: export function deriveNativeGoalieSummaryWinCredit(input: NativeGoalieOutcomeInput & { summary: NativeGoalieWinSummary }) { const { row, coherent: volumeMatches, body, receipt } = matchedNativeGoalieSummary(input); const cohortMatches = new Set(body.data.map((r: any) => r?.gameId)).size === body.data.length && body.data.every((r: any) => r && r.playerId === input.nhlPlayerId && (r.seasonId === undefined \|\| r.seasonId === input.appearance.seasonId) && input.summary.scope.approvedGameIds.includes(r.gameId) && typeof r.gameDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.gameDate) && r.gameDate >= input.summary.scope.startDate && r.gameDate <= input.summary.scope.endDate); const explicitCredits = volumeMatches && [row.wins, row.losses, row.otLosses].eve…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): goalieBaselineRates.ts:258 'a missing boxscore decision is never interpreted as zero'; goalieBaselineRates.ts:286 'Credited SO means over the same positive-minute appearance population, including relief.'
  - Intended contract (Codex web-lib-player-forecasts-goaliebaselinerates-buildnativegoalieshutoutrates): {"source": "web/lib/player-forecasts/goalieBaselineRates.ts:287", "explicit_comment": "Credited SO means over the same positive-minute appearance population, including relief.", "arithmetic_locations": ["web/lib/player-forecasts/goalieBaselineRates.ts:301 rate: credits / selected.length, consensusRate: null, previousSeasonRate: null, sourceRows: [], previousGameIds: [],"]}
  - Intended contract (Codex web-lib-player-forecasts-goaliebaselinerates-buildnativegoaliesummarywinrates): {"source": "web/lib/player-forecasts/goalieBaselineRates.ts:259", "explicit_comment": "Separate provenance policy; a missing boxscore decision is never interpreted as zero.", "arithmetic_locations": ["web/lib/player-forecasts/goalieBaselineRates.ts:273 targetKey: \"WINS_GOALIE\", basis: \"per_appearance\", rate: wins / selected.length,", "web/lib/player-forecasts/goalieBaselineRates.ts:286 /** Credited SO means over the same positive-minute appearance population, including relief. */"]}
  - Intended contract (Codex web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoalieshutoutcredit): {"source": "web/lib/player-forecasts/nativeGoalieOutcomes.ts:128", "explicit_comment": "Credited SO only. Missing/ambiguous per-game evidence never becomes a GA=0 inference.", "arithmetic_locations": ["web/lib/player-forecasts/nativeGoalieOutcomes.ts:140 /** Explicit official per-game win credit, including positive-minute relief/no-decision appearances. */"]}
  - Intended contract (Codex web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoaliesummarywincredit): {"source": "web/lib/player-forecasts/nativeGoalieOutcomes.ts:141", "explicit_comment": "Explicit official per-game win credit, including positive-minute relief/no-decision appearances.", "arithmetic_locations": ["web/lib/player-forecasts/nativeGoalieOutcomes.ts:183 /** Original explicit starter flag; zero-minute listed nonstarters are valid labels."]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`; `web/lib/player-forecasts/nativeGoalieOutcomes.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/goalieBaseline.test.ts:8", "web/lib/player-forecasts/nativeContributionAdmission.test.ts:6"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/nativeGoalieOutcomes.test.ts:5"]}`
- **Leads (not audited):**
  - (opus) shutout per appearance from <=20 games is very noisy; no regression
  - (opus) single page limit 50 rows; total>=50 rejects
  - (codex:web-lib-player-forecasts-goaliebaselinerates-buildnativegoalieshutoutrates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-player-forecasts-goaliebaselinerates-buildnativegoaliesummarywinrates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoalieshutoutcredit) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoaliesummarywincredit) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-044 Legacy goalie baseline rates (per-appearance volume, per-start W/SO)

- **Match:** Both; Opus PFC-070; Codex web-lib-player-forecasts-goaliebaselinerates-buildgoaliebaselinerates
- **Purpose:** Goalie saves/GA/SA/minutes per appearance and wins/shutouts per start from projections plus history.
- **Where:** `web/lib/player-forecasts/goalieBaselineRates.ts:78 (buildGoalieBaselineRates)`; `web/lib/player-forecasts/goalieBaselineRates.ts:125 (per-start/per-appearance source rates)`; `web/lib/player-forecasts/goalieBaselineRates.ts:138 (prior blend)`; `web/lib/player-forecasts/goalieBaselineRates.ts:153 (rate)`; `web/lib/player-forecasts/goalieBaselineRates.ts:78 buildGoalieBaselineRates`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per appearance; generation: legacy, current
- **Opus view (PFC-070):**
  - Method: Volume targets (SAVES, GA, SA, GOALIE_MINUTES) per appearance: same as skater formula (prior 0.6 consensus/0.4 prior-season mean over <=82, recent 20 decay 0.9, k=20). WINS/SHUTOUTS per start: consensus of total/projectedStarts, drop source rates > 1; no history or recent term so rate = consensus.
  - Inputs/units: projection totals with projected GP/GS; boxscore saves, GA, SA counts; TOI minutes; sources: PROJECTIONS_{season}_CULLEN_GOALIES, PROJECTIONS_{season}_DTZ_GOALIES, PROJECTIONS_{season}_5V5_GOALIES, nhl_api_game_payloads_raw
  - Output scale: count or minutes per appearance; W/SO per start (0-1); writes: player_forecast_source_observations (dry-run bundle validation)
  - Status: legacy/dead — goalie-baseline-rates-v1 not in approved methods; only dryRunGoalieContributionBundle/dryRunCapturedGoalieBundle (dry runs)
  - Consumers: buildGoalieContributionBundle; dryRunCapturedGoalieBundle
- **Codex view (web-lib-player-forecasts-goaliebaselinerates-buildgoaliebaselinerates, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Hybrid goalie baseline rates (buildGoalieBaselineRates)
  - Purpose: Equal-source rate consensus; .6/.4 projection/history prior; 20-pseudo-appearance shrinkage plus recent .9 decay. Separate per-appearance volume and per-start W/SO denominators.
  - Inputs/units: Named model/observation inputs at cited declaration; SV/GA/SA counts and minutes per appearance; W/SO per start; unvalidated. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: SV/GA/SA counts and minutes per appearance; W/SO per start; unvalidated.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-baseline-rates-v1", "native-goalie-appearance-shutout-rates-v1", "native-goalie-appearance-summary-win-rates-v1", "native-goalie-appearance-volume-rates-v1", "native-goalie-appearance-win-rates-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": …
- **Audit context:**
  - Intent (Opus): goalieBaselineRates.ts:77 'Volume rates use appearances; outcome counts use starts only when projected starts are explicit.'
  - Intended contract (Codex web-lib-player-forecasts-goaliebaselinerates-buildgoaliebaselinerates): {"source": "web/lib/player-forecasts/goalieBaselineRates.ts:78", "explicit_comment": "Volume rates use appearances; outcome counts use starts only when projected starts are explicit.", "arithmetic_locations": ["web/lib/player-forecasts/goalieBaselineRates.ts:126 / (basis === \"per_start\" ? row.projectedStarts! : row.projectedAppearances) }))", "web/lib/player-forecasts/goalieBaselineRates.ts:130 ? sourceRates.reduce((sum, value) => sum + value, 0) / sourceRates.length : null;", "web/lib/player-forecasts/goalieBaselineRates.ts:136 ? previousRows.reduce((sum, row) => sum + value(row)!, 0) / previousRows.length : null;", "web/lib/player-forecasts/goalieBaselineRates.ts:139 ? POLICY.projectionPriorWeight * consensusRate + POLICY.historyPriorWeight * previousSeasonRate", "web/lib/player-forecasts/goalieBaselineRates.ts:147 const weight = POLICY.recentDecay ** index;", "web/lib/player-forecasts/goalieBaselineRates.ts:148 recentWeighted += weight * observation;", "web/lib/player-forecasts/goalieBaselineRates.ts:153 rate: (POLICY.priorAppearanceWeight * prior + recentWeighted)", "web/lib/player-forecasts/goalieBaselineRates.ts:154 / (POLICY.priorAppearanceWeight + recentWeight),"]}
  - External references: Marcel/Tango regression; goalie SV% regression (high-variance stat)
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/goalieBaseline.test.ts:5", "web/lib/player-forecasts/nativeContributionAdmission.test.ts:6"]}`
- **Leads (not audited):**
  - (opus) W/SO per-start rates are pure external projection consensus with no observed data
  - (opus) volume rates are per appearance including relief, mixed with per-start outcomes in the same bundle (later guarded as incompatible_component_basis)
  - (opus) no save-percentage regression; SA and GA averaged independently
  - (codex:web-lib-player-forecasts-goaliebaselinerates-buildgoaliebaselinerates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-045 Goalie starter label from boxscore

- **Match:** Both; Opus PFC-071; Codex web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoaliestarterlabel
- **Purpose:** Historical official starter flag used as the start-frequency outcome label.
- **Where:** `web/lib/player-forecasts/nativeGoalieOutcomes.ts:185 (deriveNativeGoalieStarterLabel)`; `web/lib/player-forecasts/nativeGoalieOutcomes.ts:185 deriveNativeGoalieStarterLabel`
- **Tags (heuristic):** generation: current
- **Opus view (PFC-071):**
  - Method: Starter = explicit boolean; each side must have exactly one starter=true; missing rows are unknown (null), never negative.
  - Inputs/units: boxscore boolean starter flag; sources: nhl_api_game_payloads_raw (boxscore)
  - Output scale: boolean or null; writes: —
  - Status: live — labels feed goalie start frequency (rolling 14d start bundle)
  - Consumers: buildGoalieStartKernel inputs via rolling participation frames
- **Codex view (web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoaliestarterlabel, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Derive native goalie starter label (deriveNativeGoalieStarterLabel)
  - Purpose: Original explicit starter flag; zero-minute listed nonstarters are valid labels. Missing players/flags are unknown, never a negative inferred from bench status.
  - Inputs/units: Parameter/type declaration excerpt: export function deriveNativeGoalieStarterLabel(input: NativeGoalieStarterInput) { const { rawRow: raw, game, contentHash } = input.boxscore; const cutoff = timestampMicros(input.cutoffAt), fetched = timestampMicros(raw?.fetched_at), start = timestampMicros(game?.startTime); const original = raw && game && finalBoxscoreForGame(raw, game); const sourceIdValid = id(raw?.id) \|\| /^[a-f0-9]{64}$/.test(raw?.payload_hash) && raw?.id === `http:${raw.payload_hash}`; if (!id(input.nhlPlayerId) \|\| !id(input.teamId) \|\| !sourceIdValid \|\| raw.endpoint !== "boxscore" \|\| !original \|\| !/^[a-f0-9]{64}$/.test(contentHash) \|\| contentHash !== playerForecastSourcePayloadHash(raw.payload) \|\| cutoff === null \|\| fetched === null \|\| start === null \|\| fetched…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): nativeGoalieOutcomes.ts:183 'Original explicit starter flag; zero-minute listed nonstarters are valid labels. Missing players/flags are unknown'
  - Intended contract (Codex web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoaliestarterlabel): {"source": "web/lib/player-forecasts/nativeGoalieOutcomes.ts:185", "explicit_comment": "Original explicit starter flag; zero-minute listed nonstarters are valid labels. Missing players/flags are unknown, never a negative inferred from bench status.", "arithmetic_locations": []}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/nativeGoalieOutcomes.test.ts`; `web/lib/player-forecasts/rollingParticipationFrame.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/nativeGoalieOutcomes.test.ts:5"]}`
- **Leads (not audited):**
  - (codex:web-lib-player-forecasts-nativegoalieoutcomes-derivenativegoaliestarterlabel) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-046 Challenger/inference serving (validation shadow worker)

- **Match:** Both; Opus PFC-073; Codex modeling-player-forecasts-challenger-inference-infer-conditional-game
- **Purpose:** Serves the selected candidate value plus horizon quantile offsets for a feature snapshot
- **Where:** `modeling/player_forecasts/challenger_inference.py:24 (infer_conditional_game)`; `functions/lib/player_forecasts/runtime.py:57 (run_deterministic_inference loop)`; `functions/lib/player_forecasts/inference.py:8 (run_inference_contract)`; `functions/api/player_forecasts/infer.py:27 (infer)`; `modeling/player_forecasts/challenger_inference.py:24 infer_conditional_game`
- **Tags (heuristic):** conditionality: conditional; denominators: per game; generation: current
- **Opus view (PFC-073):**
  - Method: estimate = features[candidate]; contextual_* recomputed from finalContextModels coefficients; else fallback to position_prior; quantiles = max(0, estimate + residual offset); variance = residualVariance; distributionKind defaults 'negative_binomial' for assists/hits
  - Inputs/units: feature values per game; sources: model/validation artifact JSON, feature snapshots
  - Output scale: point estimate and quantiles per game; writes: HTTP response (player_forecast_outputs via web/lib/player-forecasts/orchestration.ts)
  - Status: flagged off — functions/api/player_forecasts/infer.py requires PLAYER_FORECAST_INFERENCE_SECRET; web/lib/player-forecasts/orchestration.ts:355 runs inference only when PLAYER_FORECAST_ENABLE_INFERENCE='true'
  - Consumers: web/lib/player-forecasts/orchestration.ts; web/lib/player-forecasts/readiness.ts
- **Codex view (modeling-player-forecasts-challenger-inference-infer-conditional-game, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Infer conditional game (infer_conditional_game)
  - Purpose: Infer conditional game for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def infer_conditional_game( artifact: dict[str, Any], snapshot: dict[str, Any], ) -> dict[str, Any]: verify_validation_artifact(artifact) required = { "player_id", "target_game_id", "population", "target_key", "team_game_horizon", "issued_at", "cutoff_at", "game_start_time", "team_id", "opponent_team_id", "home_away", "rest_days", "features", } missing = sorted(required - set(snapshot)) if missing: raise ValueError("feature snapshot is missing: " + ", ".join(missing)) issued_at = datetime.fromisoformat(str(snapshot["issued_at"]).replace("Z", "+00:00")) game_start = datetime.fromisoformat(str(snapshot["game_start_time"]).replace("Z", "+00:00")) if issued_at >= game_start: raise ValueError("forecast issuance must be strictly before puck drop") population …
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): modeling/player_forecasts/challenger_inference.py (validationOnly); functions/lib/player_forecasts/inference.py:9 docstring; docs/player-projections/player-forecasts-runbook.md 'Contract-only smoke test' (:172)
  - Intended contract (Codex modeling-player-forecasts-challenger-inference-infer-conditional-game): {"source": "modeling/player_forecasts/challenger_inference.py:24", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/challenger_inference.py:67 value = max(0.0, sum(item * float(coefficient) for item, coefficient in zip(vector, coefficients)))", "modeling/player_forecasts/challenger_inference.py:95 \"variance\": max(0.0, float(calibration[\"residualVariance\"])),"]}
  - External references: none suggested
  - Fixtures/test data: `web/scripts/seed-player-forecast-fixtures.ts`; `functions/tests/test_player_forecast_inference.py`
  - Tests: `functions/tests/test_player_forecast_inference.py`; `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2351"]}`
- **Leads (not audited):**
  - (opus) winners 'hierarchical_opportunity', 'calibrated_*', 'decomposed_independent_selected' and 'history_adaptive_assist' are not feature keys, so serving silently falls back to position_prior (runtime.py sets no fallback flag) - training/serving mismatch
  - (opus) 'or position_prior' treats a legitimate 0.0 team/opponent rate as missing
  - (opus) distributionKind label 'negative_binomial' while quantiles are empirical offsets
  - (codex:modeling-player-forecasts-challenger-inference-infer-conditional-game) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-047 Per-game target multiplier (pace, opponent defense, venue, rest, home/away)

- **Match:** Both; Opus PFC-074; Codex modeling-player-forecasts-season-target-multiplier
- **Purpose:** Adjusts a player's conditional per-game rate for a specific scheduled game
- **Where:** `modeling/player_forecasts/season.py:4090 (_target_multiplier)`; `modeling/player_forecasts/season.py:4090 _target_multiplier`
- **Tags (heuristic):** generation: current
- **Opus view (PFC-074):**
  - Method: pace = sqrt(max(0.5,team pace)*max(0.5,opp pace)); TOI targets: rest*home only; goalie SA/GA: rest*home*pace*max(0.5,opp offense); skater scoring/shots: rest*home*pace*venue/max(0.5,opp defense); others rest*home*pace*venue
  - Inputs/units: multipliers (unitless); sources: season artifact
  - Output scale: multiplier (unitless); writes: —
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: evaluate_season_game
- **Codex view (modeling-player-forecasts-season-target-multiplier, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Target multiplier (_target_multiplier)
  - Purpose: Target multiplier for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _target_multiplier( target: str, population: str, team: dict[str, Any] \| None, opponent: dict[str, Any] \| None, venue: dict[str, Any] \| None = None, game: dict[str, Any] \| None = None, context_effect: dict[str, Any] \| None = None, ) -> float: pace = math.sqrt( max(0.5, float((team or {}).get("paceMultiplier", 1))) * max(0.5, float((opponent or {}).get("paceMultiplier", 1))) ) venue_multiplier = ( float((venue or {}).get("venueScorerMultipliers", {}).get(target, 1.0)) if target in {"HITS", "BLOCKED_SHOTS", "TAKEAWAYS", "GIVEAWAYS"} else 1.0 )
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): season.py:4121 comment (pace changes opportunity, not TOI)
  - Intended contract (Codex modeling-player-forecasts-season-target-multiplier): {"source": "modeling/player_forecasts/season.py:4090", "explicit_comment": "modeling/player_forecasts/season.py:4121 Game pace changes event opportunity, not the number of regulation", "arithmetic_locations": ["modeling/player_forecasts/season.py:4119 contextual_multiplier = rest_multiplier * home_away_multiplier", "modeling/player_forecasts/season.py:4126 return contextual_multiplier * pace * max(0.5, float((opponent or {}).get(\"offenseMultiplier\", 1)))", "modeling/player_forecasts/season.py:4136 return contextual_multiplier * pace * venue_multiplier / max(0.5, float((opponent or {}).get(\"defenseMultiplier\", 1)))", "modeling/player_forecasts/season.py:4137 return contextual_multiplier * pace * venue_multiplier"]}
  - External references: log5/odds-ratio opponent adjustment; multiplicative team-strength models
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`; `generated (not in repo): <season artifact dir>/season-artifact.json goldenVectors built at modeling/player_forecasts/season.py:3850`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2383"]}`
- **Leads (not audited):**
  - (opus) baseline rates were estimated without removing the player's own historical opponent/pace mix, so opponent adjustment is applied to already schedule-mixed rates
  - (opus) goalie GA ignores own team's defense; PP targets ignore opponent PK
  - (opus) venue multiplier keyed to the venue team, applied to both teams' players
  - (codex:modeling-player-forecasts-season-target-multiplier) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-048 Per-game evaluation: unconditional mean and mixture variance

- **Match:** Both; Opus PFC-075; Codex modeling-player-forecasts-season-evaluate-season-game
- **Purpose:** Converts conditional rates into per-game unconditional means, variances and quantiles
- **Where:** `modeling/player_forecasts/season.py:4348 (evaluate_season_game)`; `modeling/player_forecasts/season.py:4348 evaluate_season_game`
- **Tags (heuristic):** conditionality: unconditional; denominators: per game; generation: current
- **Opus view (PFC-075):**
  - Method: mean = rate*multiplier (GP/GS = 1); unconditional = mean*p; conditional variance scaled by multiplier (not squared); variance = p*var + p*(1-p)*mean^2; baseline means use baselineConditionalRates and baseline probabilities; quantiles via _quantiles with maximum_games=1
  - Inputs/units: per-game rates; probabilities 0-1; TOI seconds; sources: season artifact, schedule.json
  - Output scale: per-game means, variances, quantiles; writes: file: game-outputs.jsonl -> player_forecast_season_game_outputs via importer
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: _aggregate_components; advanced project_advanced_release
- **Codex view (modeling-player-forecasts-season-evaluate-season-game, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Evaluate season game (evaluate_season_game)
  - Purpose: Evaluate season game for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def evaluate_season_game( artifact: dict[str, Any], player: dict[str, Any], game: dict[str, Any], ) -> dict[str, Any]: population = str(player["population"]) default_targets = GOALIE_TARGETS if population == "goalie" else SKATER_TARGETS targets = tuple(player.get("primitiveTargets") or default_targets) playing_probability = min(1.0, max(0.0, float(player["playProbability"]))) start_probability = ( min(playing_probability, max(0.0, float(player.get("startProbability") or 0))) if population == "goalie" else None ) team = artifact["teams"].get(str(game["team_id"])) opponent = artifact["teams"].get(str(game["opponent_team_id"])) venue = team if game.get("is_home") else opponent if "is_home" in game else None conditional: dict[str, float] = {} unconditional:…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in code; docs/player-projections/research-contract-v4-season-fantasy.json releaseSemantics
  - Intended contract (Codex modeling-player-forecasts-season-evaluate-season-game): {"source": "modeling/player_forecasts/season.py:4348", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:4381 mean = float(player[\"conditionalRates\"].get(target, 0.0)) * candidate_multiplier", "modeling/player_forecasts/season.py:4392 unconditional[target] = _round_number(mean * probability)", "modeling/player_forecasts/season.py:4401 ) * _target_multiplier(target, population, team, opponent, venue)", "modeling/player_forecasts/season.py:4409 baseline_unconditional[target] = _round_number(baseline_mean * baseline_probability)", "modeling/player_forecasts/season.py:4411 probability * conditional_variance", "modeling/player_forecasts/season.py:4412 + probability * (1 - probability) * mean * mean"]}
  - External references: law of total variance for zero-inflated mixtures
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`; `generated (not in repo): <season artifact dir>/season-artifact.json goldenVectors built at modeling/player_forecasts/season.py:3850`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2385"]}`
- **Leads (not audited):**
  - (opus) variance scaled linearly by the multiplier (Poisson-like) though variances were built Gaussian-style; mixed conventions
  - (codex:modeling-player-forecasts-season-evaluate-season-game) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-049 Frozen-window and roster-observation participation variants (Sep 29 - Oct 13 frame)

- **Match:** Both; Opus PFC-081; Codex web-lib-player-forecasts-modeledgoalieparticipation-buildfrozenwindowgoalieparticipationreceipt, web-lib-player-forecasts-modeledskaterparticipation-builddatedwindowskaterkernel, web-lib-player-forecasts-modeledskaterparticipation-buildrosterobservationskaterparticipationreceipt
- **Possible related records (low-confidence location link, unconfirmed):** web-lib-player-forecasts-modeledgoalieparticipation-buildgoalieparticipationreceipt
- **Purpose:** Same appearance-frequency estimator over a frozen 14-day early-season frame, with dated eligibility or roster-observation proxy.
- **Where:** `web/lib/player-forecasts/modeledSkaterParticipation.ts:177 (buildFrozenWindowSkaterKernel)`; `web/lib/player-forecasts/modeledSkaterParticipation.ts:185 (frame dates)`; `web/lib/player-forecasts/modeledSkaterParticipation.ts:194 (buildDatedWindowSkaterKernel)`; `web/lib/player-forecasts/modeledSkaterParticipation.ts:243 (buildRosterObservationSkaterParticipationReceipt)`; `web/lib/player-forecasts/modeledGoalieParticipation.ts:33 (buildGoalieParticipationReceipt)`; `web/lib/player-forecasts/modeledGoalieParticipation.ts:104 (buildFrozenWindowGoalieParticipationReceipt)`; `web/lib/player-forecasts/modeledGoalieParticipation.ts:201 (buildRosterObservationGoalieParticipationReceipt)`; `web/lib/player-forecasts/targetRosterObservation.ts:17 (rosterObservationReasons)`; `web/lib/player-forecasts/nativeDailyPipelineV2.ts:30 (FROZEN_PARTICIPATION_LAST_CUTOFF)`; `web/lib/player-forecasts/modeledGoalieParticipation.ts:104 buildFrozenWindowGoalieParticipationReceipt`; `web/lib/player-forecasts/modeledSkaterParticipation.ts:194 buildDatedWindowSkaterKernel`; `web/lib/player-forecasts/modeledSkaterParticipation.ts:243 buildRosterObservationSkaterParticipationReceipt`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy, current
- **Opus view (PFC-081):**
  - Method: Frame fixed to {year}-09-29T04:00Z .. {year}-10-13T04:00Z (14 days); cutoff must be within 14 days of frame end. Roster observation older than 24h -> stale. Goalie appearance variant reuses skater kernel (positive minutes incl. relief). Daily pipeline uses frozen method through 2026-10-27T04:00Z then rolling_14d.
  - Inputs/units: game labels; frame instants (UTC, America/New_York boundaries); sources: player_forecast_source_observations, NHL roster/schedule/boxscore receipts
  - Output scale: probability 0-1 (uncalibrated); writes: player_forecast_source_observations
  - Status: legacy/dead — frozen methods accept cutoffs only through FROZEN_PARTICIPATION_LAST_CUTOFF 2026-10-27T04:00Z (nativeDailyPipelineV2.ts:30)
  - Consumers: nativeDailyPipelineV2.nativeDailyParticipationMethod; planningContributions
- **Codex view (web-lib-player-forecasts-modeledgoalieparticipation-buildfrozenwindowgoalieparticipationreceipt, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Build frozen window goalie participation receipt (buildFrozenWindowGoalieParticipationReceipt)
  - Purpose: Build frozen window goalie participation receipt for native player forecasts and contribution serving. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildFrozenWindowGoalieParticipationReceipt(input: FrozenWindowGoalieParticipationInput, issuance: { issuedAt: string; expiresAt: string }): FrozenWindowGoalieParticipationReceipt { if (input?.version !== "goalie-frozen-window-participation-input-v1" \|\| input.playerClass !== "goalie") { throw new Error("Invalid frozen-window goalie participation input."); } const receipt = buildFrozenWindowSkaterParticipationReceipt({ ...input, version: "skater-frozen-window-participation-input-v1", playerClass: "skater" }, issuance); return { ...receipt, version: "modeled-goalie-frozen-window-participation-v1", methodVersion: FROZEN_WINDOW_GOALIE_PARTICIPATION_METHOD, inputHash: playerForecastSourcePayloadHash(input), limitations: [...receipt.limitati…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-appearance-frequency-v1", "goalie-frozen-window-appearance-frequency-v1", "goalie-frozen-window-start-frequency-v1", "goalie-roster-observation-appearance-frequency-v1", "goalie-roster-observation-start-frequency-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.…
- **Codex view (web-lib-player-forecasts-modeledskaterparticipation-builddatedwindowskaterkernel, calculation, codex_part_of_opus; Codex family 'Native player forecasts and contribution serving'):** Dated-window appearance frequency (buildDatedWindowSkaterKernel)
  - Purpose: Restrict independently complete eligible opportunities to supplied half-open window; positives / eligible denominator after evidence gates.
  - Inputs/units: Historical schedule and dated eligibility; explicit positive/zero-minute labels; frame instants.
  - Output scale: Experimental appearance fraction [0,1] or unavailable, numerator and denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["skater-frozen-window-appearance-frequency-v1", "skater-participation-frequency-v1", "skater-roster-observation-appearance-frequency-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-player-forecasts-modeledskaterparticipation-buildrosterobservationskaterparticipationreceipt, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Build roster observation skater participation receipt (buildRosterObservationSkaterParticipationReceipt)
  - Purpose: Build roster observation skater participation receipt for native player forecasts and contribution serving. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildRosterObservationSkaterParticipationReceipt(input: RosterObservationSkaterParticipationInput, issuance: { issuedAt: string; expiresAt: string }): RosterObservationSkaterParticipationReceipt { if (input?.version !== "skater-roster-observation-participation-input-v1" \|\| input.playerClass !== "skater") { throw new Error("Invalid roster-observation skater participation input."); } const receipt = buildFrozenWindowSkaterKernel({ ...input, version: "skater-frozen-window-participation-input-v1", targetEligibility: null }, { issuedAt: issuance.issuedAt, expiresAt: issuance.expiresAt }, { value: input.targetRosterObservation }); return { ...receipt, version: "modeled-skater-roster-observation-participation-v1", methodVersion: ROSTER_OBSERV…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["skater-frozen-window-appearance-frequency-v1", "skater-participation-frequency-v1", "skater-roster-observation-appearance-frequency-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): modeledSkaterParticipation.ts:171 'Explicit frozen-history baseline; actual capture/cutoff clocks are never backdated.'; tasks/prd-forge-daily-pipeline.md (frozen Sep 29-Oct 12 window)
  - Intended contract (Codex web-lib-player-forecasts-modeledgoalieparticipation-buildfrozenwindowgoalieparticipationreceipt): {"source": "web/lib/player-forecasts/modeledGoalieParticipation.ts:104", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/player-forecasts/modeledGoalieParticipation.ts:122 /** Actual appearance labels remain separate. Starter flags are never converted into TOI labels. */", "web/lib/player-forecasts/modeledGoalieParticipation.ts:133 /** Distinct empirical starter event over the same validated eligible opportunities."]}
  - Intended contract (Codex web-lib-player-forecasts-modeledskaterparticipation-builddatedwindowskaterkernel): {"source": "web/lib/player-forecasts/modeledSkaterParticipation.ts:194", "explicit_comment": "Frozen-window steps over a caller-validated half-open history frame [start, end) in epoch microseconds. Each method keeps its own frame check; versions and limitations are the caller's.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-player-forecasts-modeledskaterparticipation-buildrosterobservationskaterparticipationreceipt): {"source": "web/lib/player-forecasts/modeledSkaterParticipation.ts:243", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/modeledGoalieParticipation.test.ts`; `web/lib/player-forecasts/modeledSkaterParticipation.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/modeledGoalieParticipation.test.ts:3", "web/lib/rosterScheduleData/planning.test.ts:14"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/modeledSkaterParticipation.test.ts (module test)"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/modeledSkaterParticipation.test.ts:3", "web/lib/player-forecasts/nativeBaselinePublication.test.ts:15", "web/lib/player-forecasts/nativeDailyPipeline.test.ts:5", "web/lib/player-forecasts/rollingParticipationFrame.test.ts:5", "web/lib/player-forecasts/rollingWindowParticipation.test.ts:4", "web/lib/rosterScheduleData/planning.test.ts:16"]}`
- **Leads (not audited):**
  - (opus) hard-coded early-season calendar frame; unusable after Oct 27 by design (superseded by rolling)
  - (opus) goalie appearance probability counts relief, then multiplied with appearance-basis W/SV means
  - (codex:web-lib-player-forecasts-modeledgoalieparticipation-buildfrozenwindowgoalieparticipationreceipt) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-player-forecasts-modeledskaterparticipation-builddatedwindowskaterkernel) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-player-forecasts-modeledskaterparticipation-buildrosterobservationskaterparticipationreceipt) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-050 Skater participation frequency (eligible-opportunity appearance rate)

- **Match:** Both; Opus PFC-082; Codex web-lib-player-forecasts-modeledskaterparticipation-buildskaterparticipationkernel
- **Purpose:** Probability a skater records positive minutes in the next game = share of recent eligible club games with positive TOI.
- **Where:** `web/lib/player-forecasts/modeledSkaterParticipation.ts:51 (buildSkaterParticipationKernel)`; `web/lib/player-forecasts/modeledSkaterParticipation.ts:110 (selection <=20)`; `web/lib/player-forecasts/modeledSkaterParticipation.ts:113 (14-day stale)`; `web/lib/player-forecasts/modeledSkaterParticipation.ts:124 (numerator/denominator)`; `web/lib/player-forecasts/modeledSkaterParticipation.ts:135 (participationFromReceipt)`; `web/lib/player-forecasts/modeledSkaterParticipation.ts:51 buildSkaterParticipationKernel`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy, current
- **Opus view (PFC-082):**
  - Method: Frame = 60 days before cutoff (default). Selected = up to 20 most recent games with occurred && eligible. p = (#positiveMinutes)/selected. Withheld (null) if frame incomplete, scope evidence older than 1 day, any unknown eligibility, no eligible history, latest eligible game > 14 days old, or unresolved labels. Issuance <=1 day after cutoff, expiry <=1 day. Uncalibrated, no shrinkage.
  - Inputs/units: game labels (positive minutes boolean); clocks in microseconds; sources: player_forecast_source_observations (materialized receipts), api-web.nhle.com schedule/boxscore receipts
  - Output scale: probability 0-1 (uncalibrated), numerator/denominator counts; writes: player_forecast_source_observations (participation releases via store)
  - Status: legacy/dead — (as a standalone method) skater-participation-frequency-v1 superseded by roster-observation then rolling-14d; kernel still live inside both
  - Consumers: contributions.participationProbability; planningContributions catalog participation
- **Codex view (web-lib-player-forecasts-modeledskaterparticipation-buildskaterparticipationkernel, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Eligible-opportunity skater appearance frequency (buildSkaterParticipationKernel)
  - Purpose: Count verified positive-minute appearances / fully observed eligible historical opportunities; missing evidence withholds.
  - Inputs/units: Complete historical game-opportunity frame and labels, identity/roster/schedule evidence and cutoff clocks.
  - Output scale: Experimental P(positive-minute appearance), numerator/denominator, reasons; endpoints not confirmation.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["skater-frozen-window-appearance-frequency-v1", "skater-participation-frequency-v1", "skater-roster-observation-appearance-frequency-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): modeledSkaterParticipation.ts:44 'Pure finite baseline. Source authenticity/completeness must be reviewed before release.'
  - Intended contract (Codex web-lib-player-forecasts-modeledskaterparticipation-buildskaterparticipationkernel): {"source": "web/lib/player-forecasts/modeledSkaterParticipation.ts:51", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/player-forecasts/modeledSkaterParticipation.ts:56 const historyStart = frame?.start ?? cutoff - 60 * DAY, historyEnd = frame?.end ?? cutoff;", "web/lib/player-forecasts/modeledSkaterParticipation.ts:113 if (selected.length && cutoff - time(selected[0].scheduledAt) > 14 * DAY) reasons.push(\"stale_eligible_history\");", "web/lib/player-forecasts/modeledSkaterParticipation.ts:124 probability: reasons.length ? null : numerator / selected.length,"]}
  - External references: Beta-binomial / Laplace smoothing for availability rates; injury-aware lineup models
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/modeledSkaterParticipation.test.ts`; `web/lib/player-forecasts/modeledSkaterParticipationStore.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/modeledSkaterParticipation.test.ts (module test)"]}`
- **Leads (not audited):**
  - (opus) raw frequency; p = 0 or 1 endpoints common with small denominators, multiplied directly into totals
  - (opus) no injury/scratch-news input; scratched-then-returning players under-projected
  - (codex:web-lib-player-forecasts-modeledskaterparticipation-buildskaterparticipationkernel) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-051 Rolling 14-day participation (skater/goalie appearance and goalie start frequency)

- **Match:** Both; Opus PFC-084; Codex web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowgoalieparticipationreceipt, web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowgoaliestartreceipt, web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowskaterparticipationreceipt, web-lib-player-forecasts-rollingwindowparticipation-rollingappearancekernel, web-lib-player-forecasts-rollingwindowparticipation-rollingparticipationwindow
- **Purpose:** Current approved participation model: frequencies over the 14 America/New_York local days before cutoff.
- **Where:** `web/lib/player-forecasts/rollingWindowParticipation.ts:14 (ROLLING_PARTICIPATION_WINDOW)`; `web/lib/player-forecasts/rollingWindowParticipation.ts:45 (rollingParticipationWindow)`; `web/lib/player-forecasts/rollingWindowParticipation.ts:53 (rollingAppearanceKernel)`; `web/lib/player-forecasts/rollingWindowParticipation.ts:101 (buildRollingWindowSkaterParticipationReceipt)`; `web/lib/player-forecasts/rollingWindowParticipation.ts:111 (buildRollingWindowGoalieParticipationReceipt)`; `web/lib/player-forecasts/rollingWindowParticipation.ts:123 (buildRollingWindowGoalieStartReceipt)`; `web/lib/player-forecasts/rollingParticipationFrame.ts:88 (buildRollingParticipationHistories)`; `web/lib/player-forecasts/rollingWindowParticipation.ts:111 buildRollingWindowGoalieParticipationReceipt`; `web/lib/player-forecasts/rollingWindowParticipation.ts:123 buildRollingWindowGoalieStartReceipt`; `web/lib/player-forecasts/rollingWindowParticipation.ts:101 buildRollingWindowSkaterParticipationReceipt`; `web/lib/player-forecasts/rollingWindowParticipation.ts:53 rollingAppearanceKernel`; `web/lib/player-forecasts/rollingWindowParticipation.ts:45 rollingParticipationWindow`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (PFC-084):**
  - Method: Window = 14 local days ending at local midnight of cutoff date (335/337 h across DST). Appearance p = positive-TOI games / eligible listed games (cap 20; a team plays ~6-8 games in 14 days). Goalie start p = official starter=true count / same eligible denominator. Same null-on-unknown rules as kernel.
  - Inputs/units: boxscore TOI (seconds, >0 vs =0) and starter flags over 14 local days; sources: api-web.nhle.com schedule and boxscore receipts, player_forecast_source_observations
  - Output scale: probability 0-1 (uncalibrated) for appearance or official start; writes: player_forecast_source_observations (participation releases)
  - Status: unknown — (flag-gated) NATIVE_DAILY_V2_FLAGS.rollingFirstIssuance defaults false (nativeDailyPipelineV2.ts:27), but frozen method rejects cutoffs after 2026-10-27, so any daily run since must pass --flags to scripts/forge-daily-v2.ts with it on; also lib/projections/goalie/workloadEvidence.ts
  - Consumers: nativeDailyPipelineV2; nativeCadenceOutputPreparation; lib/projections/goalie/workloadEvidence.ts; contributions/planning
- **Codex view (web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowgoalieparticipationreceipt, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Build rolling window goalie participation receipt (buildRollingWindowGoalieParticipationReceipt)
  - Purpose: Build rolling window goalie participation receipt for native player forecasts and contribution serving. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildRollingWindowGoalieParticipationReceipt(input: RollingWindowGoalieParticipationInput, issuance: Issuance): RollingWindowGoalieParticipationReceipt { if (input?.version !== "goalie-rolling-14d-participation-input-v1" \|\| input.playerClass !== "goalie") { throw new Error("Invalid rolling-window goalie participation input."); } return { ...rollingAppearanceKernel(input, issuance), version: "modeled-goalie-rolling-14d-participation-v1", methodVersion: ROLLING_WINDOW_GOALIE_PARTICIPATION_METHOD, inputHash: playerForecastSourcePayloadHash(input), limitations: [...GOALIE_APPEARANCE_LIMITATIONS] }; } /** Distinct official-starter event over the appearance receipt's selected eligible opportunities, * through the same start kernel as the ros…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-rolling-14d-appearance-frequency-v1", "goalie-rolling-14d-start-frequency-v1", "skater-rolling-14d-appearance-frequency-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowgoaliestartreceipt, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Build rolling window goalie start receipt (buildRollingWindowGoalieStartReceipt)
  - Purpose: Distinct official-starter event over the appearance receipt's selected eligible opportunities, through the same start kernel as the roster-observation start method.
  - Inputs/units: Parameter/type declaration excerpt: export function buildRollingWindowGoalieStartReceipt(input: RollingWindowGoalieStartInput, issuance: Issuance): RollingWindowGoalieStartReceipt { if (input?.version !== "goalie-rolling-14d-start-input-v1" \|\| input.playerClass !== "goalie") { throw new Error("Invalid rolling-window goalie start input."); } const { version: _version, methodVersion: _method, ...receipt } = buildGoalieStartKernel({ ...input, version: "goalie-frozen-window-start-input-v1", targetEligibility: null }, rollingAppearanceKernel(input, issuance), input.targetRosterObservation?.evidence); return { ...receipt, version: "modeled-goalie-rolling-14d-start-v1", methodVersion: ROLLING_WINDOW_GOALIE_START_METHOD, inputHash: playerForecastSourcePayloadHash(input), continuationAssumptionV…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-rolling-14d-appearance-frequency-v1", "goalie-rolling-14d-start-frequency-v1", "skater-rolling-14d-appearance-frequency-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowskaterparticipationreceipt, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Build rolling window skater participation receipt (buildRollingWindowSkaterParticipationReceipt)
  - Purpose: Build rolling window skater participation receipt for native player forecasts and contribution serving. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildRollingWindowSkaterParticipationReceipt(input: RollingWindowSkaterParticipationInput, issuance: Issuance): RollingWindowSkaterParticipationReceipt { if (input?.version !== "skater-rolling-14d-participation-input-v1" \|\| input.playerClass !== "skater") { throw new Error("Invalid rolling-window skater participation input."); } return { ...rollingAppearanceKernel(input, issuance), version: "modeled-skater-rolling-14d-participation-v1", methodVersion: ROLLING_WINDOW_SKATER_PARTICIPATION_METHOD, inputHash: playerForecastSourcePayloadHash(input), limitations: [...SKATER_LIMITATIONS] }; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-rolling-14d-appearance-frequency-v1", "goalie-rolling-14d-start-frequency-v1", "skater-rolling-14d-appearance-frequency-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-player-forecasts-rollingwindowparticipation-rollingappearancekernel, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Rolling appearance kernel (rollingAppearanceKernel)
  - Purpose: The roster-observation frozen-window kernel with only its frame check replaced by the rolling window.
  - Inputs/units: Parameter/type declaration excerpt: function rollingAppearanceKernel(input: AppearanceInput, issuance: Issuance) { const window = rollingParticipationWindow(input?.cutoffAt); const start = time(window.startAt), end = time(window.endAt); if (!input.history \|\| time(input.history.windowStartAt) !== start \|\| time(input.history.windowEndAt) !== end) { throw new Error("Invalid rolling 14-day participation window."); } const { version: _version, methodVersion: _method, ...receipt } = buildDatedWindowSkaterKernel({ ...input, version: "skater-frozen-window-participation-input-v1", playerClass: "skater", targetEligibility: null }, { issuedAt: issuance.issuedAt, expiresAt: issuance.expiresAt }, { start, end }, { value: input.targetRosterObservation }); return { ...receipt, continuationAssumption…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-rolling-14d-appearance-frequency-v1", "goalie-rolling-14d-start-frequency-v1", "skater-rolling-14d-appearance-frequency-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-player-forecasts-rollingwindowparticipation-rollingparticipationwindow, calculation, codex_part_of_opus; Codex family 'Native player forecasts and contribution serving'):** Rolling participation calendar frame (rollingParticipationWindow)
  - Purpose: Previous14 America/New_York local dates, excluding cutoff own local date; half-open at local midnights, preserving DST calendar-day semantics.
  - Inputs/units: Cutoff timestamp.
  - Output scale: startAt,endAt,date list,timeZone; 14 local days, not assumed336 hours.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-rolling-14d-appearance-frequency-v1", "goalie-rolling-14d-start-frequency-v1", "skater-rolling-14d-appearance-frequency-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): rollingWindowParticipation.ts:10 'Approved v2 participation (TJ 2026-10-17)... over the 14 America/New_York calendar days before the cutoff's local date'
  - Intended contract (Codex web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowgoalieparticipationreceipt): {"source": "web/lib/player-forecasts/rollingWindowParticipation.ts:111", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/player-forecasts/rollingWindowParticipation.ts:121 /** Distinct official-starter event over the appearance receipt's selected eligible opportunities,"]}
  - Intended contract (Codex web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowgoaliestartreceipt): {"source": "web/lib/player-forecasts/rollingWindowParticipation.ts:123", "explicit_comment": "Distinct official-starter event over the appearance receipt's selected eligible opportunities, through the same start kernel as the roster-observation start method.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowskaterparticipationreceipt): {"source": "web/lib/player-forecasts/rollingWindowParticipation.ts:101", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-player-forecasts-rollingwindowparticipation-rollingappearancekernel): {"source": "web/lib/player-forecasts/rollingWindowParticipation.ts:53", "explicit_comment": "The roster-observation frozen-window kernel with only its frame check replaced by the rolling window.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-player-forecasts-rollingwindowparticipation-rollingparticipationwindow): {"source": "web/lib/player-forecasts/rollingWindowParticipation.ts:45", "explicit_comment": "The 14 local dates before the cutoff's America/New_York date, as a half-open instant window. Across a daylight-saving change the window is 14 local days (335 or 337 hours), not 336 hours.", "arithmetic_locations": ["web/lib/player-forecasts/rollingWindowParticipation.ts:52 /** The roster-observation frozen-window kernel with only its frame check replaced by the rolling window. */"]}
  - External references: Goalie start probability models (rest days, back-to-backs, starter share), Beta-binomial smoothing
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts`; `web/lib/player-forecasts/rollingParticipationFrame.test.ts`; `web/lib/player-forecasts/rollingWindowParticipation.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/rollingParticipationFrame.test.ts:10", "web/lib/player-forecasts/rollingWindowParticipation.test.ts:7", "web/lib/rosterScheduleData/planning.test.ts:30"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/rollingParticipationFrame.test.ts:11", "web/lib/player-forecasts/rollingWindowParticipation.test.ts:7", "web/lib/rosterScheduleData/planning.test.ts:30"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/rollingWindowParticipation.test.ts (module test)"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/rollingWindowParticipation.test.ts:8", "web/lib/projections/goalie/workloadEvidence.test.ts:5", "web/lib/rosterScheduleData/planning.test.ts:31"]}`
- **Leads (not audited):**
  - (opus) denominator typically 6-8 games, so probabilities move in ~1/7 steps and hit 0/1 often
  - (opus) goalie start frequencies computed per goalie independently; team sum not forced to 1 (only >1 rejected downstream)
  - (opus) no back-to-back/rest-day or confirmed-starter adjustment in the start model
  - (codex:web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowgoalieparticipationreceipt) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowgoaliestartreceipt) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-player-forecasts-rollingwindowparticipation-buildrollingwindowskaterparticipationreceipt) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-player-forecasts-rollingwindowparticipation-rollingappearancekernel) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-player-forecasts-rollingwindowparticipation-rollingparticipationwindow) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-052 PP shot-rate exposure shrinkage ablation

- **Match:** Both; Opus PFC-087; Codex modeling-player-forecasts-pp-shot-support-pp-rate-ablation
- **Purpose:** Engineering harness comparing FORGE PP SOG/60 blend with exposure-weighted shrinkage
- **Where:** `modeling/player_forecasts/pp_shot_support.py:92 (pp_rate_ablation)`; `modeling/player_forecasts/pp_shot_support.py:28 (PROTOCOL)`; `modeling/player_forecasts/pp_shot_support.py:74 pp_rate_ablation`
- **Tags (heuristic):** conditionality: unconditional; denominators: per 60, shots on goal; generation: research, development, current
- **Opus view (PFC-087):**
  - Method: raw rate from last5 else all window (fallback 8 SOG/60); baseline = clamp(raw*context*w + (1-w)*8, 2, 28) with FORGE baseline weight; candidate weight = PP minutes/(PP minutes + prior minutes); flags missing/zero exposure; protocol: 60/20/20 slate split, MSE on unconditional PP shots, acceptance 2% MSE gain, 2000 bootstrap
  - Inputs/units: SOG per 60 PP minutes; PP TOI seconds converted to minutes; sources: rolling_player_game_metrics (via captured FORGE inputs)
  - Output scale: SOG per 60 PP minutes (2-28); writes: file: report.json, mechanics.json (outside repo)
  - Status: draft — offline engineering ablation, servingEnabled False / decision retain_baseline (modeling/player_forecasts/pp_shot_support.py:1, export_engineering)
  - Consumers: none (offline; no serving)
- **Codex view (modeling-player-forecasts-pp-shot-support-pp-rate-ablation, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Pp rate ablation (pp_rate_ablation)
  - Purpose: Compare pre-bound rates only. Completeness is an input assertion, not certification.
  - Inputs/units: Parameter/type declaration excerpt: def pp_rate_ablation(row: dict[str, Any], *, baseline_weight: float, context_multiplier: float, prior_minutes: float, exposure_complete: bool) -> dict[str, Any]: """Compare pre-bound rates only. Completeness is an input assertion, not certification.""" if not _number(baseline_weight) or baseline_weight > 1 or not _number(context_multiplier): raise ValueError("finite baseline weight in [0,1] and nonnegative context required") if type(prior_minutes) not in (int, float) or prior_minutes not in PRIOR_MINUTES: raise ValueError("use the predeclared prior-minute grid") if type(exposure_complete) is not bool: raise ValueError("exposure completeness must be explicit") window, raw_rate = None, 8.0 for candidate_window in ("last5", "all"): # Canonical-first compat…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["forge-pp-shot-support-engineering-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): pp_shot_support.py:27 PROTOCOL hypothesis; docs/player-projections/forge-pp-shot-support.md
  - Intended contract (Codex modeling-player-forecasts-pp-shot-support-pp-rate-ablation): {"source": "modeling/player_forecasts/pp_shot_support.py:74", "explicit_comment": "Compare pre-bound rates only. Completeness is an input assertion, not certification.", "arithmetic_locations": ["modeling/player_forecasts/pp_shot_support.py:95 return min(28.0, max(2.0, raw_rate * context_multiplier * weight + (1 - weight) * 8))", "modeling/player_forecasts/pp_shot_support.py:102 weight = None if reason else (seconds / 60) / (seconds / 60 + prior_minutes)", "modeling/player_forecasts/pp_shot_support.py:104 \"exposureMinutes\": seconds / 60 if _number(seconds) else None,"]}
  - External references: Tango regression with exposure-based reliability (n/(n+k))
  - Fixtures/test data: `modeling/player_forecasts/pp_shot_support.py:110 (engineering_fixtures, fictional cases)`; `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:20"]}`
- **Leads (not audited):**
  - (opus) hard-coded league prior 8 PP SOG/60 and clamp 2..28 replicate web/lib/projections constants (pinned by hash) - source of truth lives in TS
  - (codex:modeling-player-forecasts-pp-shot-support-pp-rate-ablation) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-053 Adjusted defense rating (on-ice suppression goal-equivalents per 60)

- **Match:** Both; Opus PFC-088; Codex modeling-player-forecasts-season-adjusted-defense-ratings
- **Purpose:** Estimates a skater's chance and goal suppression vs team/opponent expectation
- **Where:** `modeling/player_forecasts/season.py:2781 (_adjusted_defense_ratings)`; `modeling/player_forecasts/season.py:2781 _adjusted_defense_ratings`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (PFC-088):**
  - Method: expected chances per game = sqrt(team avg chances allowed * opponent avg chances generated); same for goals; scaled by ice share min(1, toi/3600); suppression = (expected chances - actual)*league goals per chance + (expected goals - actual goals); per 60 = total*3600/toi; shrink to position median with k=20 equivalent games (1200 s each)
  - Inputs/units: events per game; TOI seconds; sources: nhl_api_shift_rows, nhl_api_pbp_events
  - Output scale: goal-equivalents per 60 minutes; writes: season-artifact.json ratingSignals
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: defense rating percentile; _roster_adjusted_team_contexts
- **Codex view (modeling-player-forecasts-season-adjusted-defense-ratings, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Adjusted defense ratings (_adjusted_defense_ratings)
  - Purpose: Adjusted defense ratings for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _adjusted_defense_ratings(rows: list[dict[str, Any]]) -> dict[int, float]: team_games: dict[tuple[int, int], dict[str, float]] = {} for row in rows: team_games[(int(row["game_id"]), int(row["team_id"]))] = { "opponent": int(row["opponent_team_id"]), "chances": float(row["team_chances_against"]), "goals": float(row["team_goals_against"]), } defense_chances: dict[int, list[float]] = defaultdict(list) offense_chances: dict[int, list[float]] = defaultdict(list) defense_goals: dict[int, list[float]] = defaultdict(list) offense_goals: dict[int, list[float]] = defaultdict(list) for (_, team_id), values in team_games.items(): opponent = int(values["opponent"]) defense_chances[team_id].append(values["chances"]) offense_chances[opponent].append(values["chance…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): season.py:3900 limitation text
  - Intended contract (Codex modeling-player-forecasts-season-adjusted-defense-ratings): {"source": "modeling/player_forecasts/season.py:2781", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2801 league_chances = sum(all_chances) / max(1, len(all_chances))", "modeling/player_forecasts/season.py:2802 league_goals = sum(all_goals) / max(1, len(all_goals))", "modeling/player_forecasts/season.py:2803 goal_per_chance = sum(all_goals) / max(1.0, sum(all_chances))", "modeling/player_forecasts/season.py:2807 return sum(rows_for_team) / len(rows_for_team) if rows_for_team else fallback", "modeling/player_forecasts/season.py:2825 ice_share = min(1.0, toi / 3600.0)", "modeling/player_forecasts/season.py:2826 expected_chances = expected_chances_per_game * ice_share", "modeling/player_forecasts/season.py:2827 expected_goals = expected_goals_per_game * ice_share", "modeling/player_forecasts/season.py:2829 (expected_chances - float(row[\"chances_against\"])) * goal_per_chance"]}
  - External references: Evolving-Hockey RAPM / xGA-based defensive ratings; NST on-ice CA/60 relative
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2362"]}`
- **Leads (not audited):**
  - (opus) expected chances are a full-team per-game rate scaled by the player's TOI share, which ignores that 5 skaters share the ice - expectation is per team-60 not per player
  - (opus) no teammate/QoC adjustment and all strengths mixed (PK specialists penalized)
  - (opus) '20 equivalent games' uses 1200 s (20 min) per game for all positions
  - (codex:modeling-player-forecasts-season-adjusted-defense-ratings) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-054 Player rating signals and percentiles (offense, defense, goaltending)

- **Match:** Both; Opus PFC-089; Codex modeling-player-forecasts-season-percentile, modeling-player-forecasts-season-team-contexts
- **Purpose:** Produces 0-100 percentile ratings per position
- **Where:** `modeling/player_forecasts/season.py:3500 (rating signals)`; `modeling/player_forecasts/season.py:3527 (percentile lookups)`; `modeling/player_forecasts/season.py:2546 (_percentile)`; `modeling/player_forecasts/season.py:3623 (ratingConfidence)`; `modeling/player_forecasts/season.py:2546 _percentile`; `modeling/player_forecasts/season.py:2554 _team_contexts`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per 60, per game; generation: current
- **Opus view (PFC-089):**
  - Method: offense = G+A1+A2 per game; defense = adjusted suppression per 60 else PLUS_MINUS*3600/TOI; goalie = (SA-GA)/SA; percentile = 100*(less + 0.5*equal)/n within position (goalies all together); confidence = max(0.75*min(1, sqrt(GP/82)), evidence weight) * roster_confidence
  - Inputs/units: per-game G+A; suppression per 60 or plus-minus per 60; save fraction; sources: season artifact
  - Output scale: percentile 0-100; confidence 0-1; writes: season-artifact.json, player_forecast_season_player_aggregates.ratings via importer
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: player-aggregates ratings; _roster_adjusted_team_contexts
- **Codex view (modeling-player-forecasts-season-percentile, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Percentile (_percentile)
  - Purpose: Percentile for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _percentile(values: list[float], value: float) -> float: if not values: return 50.0 less = sum(1 for item in values if item < value) equal = sum(1 for item in values if item == value) return 100.0 * (less + 0.5 * equal) / len(values)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-season-team-contexts, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Team contexts (_team_contexts)
  - Purpose: Team contexts for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _team_contexts(team_rows: list[dict[str, Any]], teams: list[dict[str, Any]]) -> dict[str, Any]: recent = [row for row in team_rows if int(row["season_id"]) == TRAINING_CUTOFF_SEASON] league_gf = sum(float(row["goals_for"]) for row in recent) / max(1, len(recent)) league_shots = sum(float(row["shots_for"]) + float(row["shots_against"]) for row in recent) / max(1, len(recent)) by_team: dict[int, list[dict[str, Any]]] = defaultdict(list) for row in recent: by_team[int(row["team_id"])].append(row) raw: dict[int, dict[str, float]] = {} for team in teams: team_id = int(team["team_id"]) rows = by_team.get(team_id, []) games = max(1, len(rows)) gf = sum(float(row["goals_for"]) for row in rows) / games ga = sum(float(row["goals_against"]) for row in rows) / …
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (ratings contract in docs/player-projections/research-contract-v3-season.json)
  - Intended contract (Codex modeling-player-forecasts-season-percentile): {"source": "modeling/player_forecasts/season.py:2546", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2549 less = sum(1 for item in values if item < value)", "modeling/player_forecasts/season.py:2550 equal = sum(1 for item in values if item == value)", "modeling/player_forecasts/season.py:2551 return 100.0 * (less + 0.5 * equal) / len(values)"]}
  - Intended contract (Codex modeling-player-forecasts-season-team-contexts): {"source": "modeling/player_forecasts/season.py:2554", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2556 league_gf = sum(float(row[\"goals_for\"]) for row in recent) / max(1, len(recent))", "modeling/player_forecasts/season.py:2557 league_shots = sum(float(row[\"shots_for\"]) + float(row[\"shots_against\"]) for row in recent) / max(1, len(recent))", "modeling/player_forecasts/season.py:2566 gf = sum(float(row[\"goals_for\"]) for row in rows) / games", "modeling/player_forecasts/season.py:2567 ga = sum(float(row[\"goals_against\"]) for row in rows) / games", "modeling/player_forecasts/season.py:2568 pace = sum(float(row[\"shots_for\"]) + float(row[\"shots_against\"]) for row in rows) / games", "modeling/player_forecasts/season.py:2569 pp_goals = sum(float(row[\"pp_goals\"]) for row in rows)", "modeling/player_forecasts/season.py:2570 pp_opportunities = sum(float(row[\"pp_opportunities\"]) for row in rows)", "modeling/player_forecasts/season.py:2571 pk_ga = sum(float(row[\"pk_goals_against\"]) for row in rows)"]}
  - External references: mid-rank percentile convention
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2382"]}`
- **Leads (not audited):**
  - (opus) offense rating uses per-game production, so it is driven by TOI/role rather than per-60 efficiency
  - (opus) defense signal falls back to plus-minus per 60, a different unit from goal-equivalent suppression, mixed into the same percentile pool
  - (opus) roster_confidence magic values 0.85/0.55/0.4 (season.py:1488)
  - (codex:modeling-player-forecasts-season-percentile) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-team-contexts) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-055 Derived-stat reconciliation (_reconcile)

- **Match:** Both; Opus PFC-090; Codex modeling-player-forecasts-season-reconcile
- **Purpose:** Enforces accounting identities and computes derived ratios from primitive projections
- **Where:** `modeling/player_forecasts/season.py:3935 (_reconcile)`; `modeling/player_forecasts/season.py:4701 (_add_actuals)`; `modeling/player_forecasts/season.py:3935 _reconcile`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, shots on goal; generation: current
- **Opus view (PFC-090):**
  - Method: Goalie: saves = max(0, SA-GA); SV% = saves/SA; GAA = 3600*GA/TOI; relief = GP-GS; start% = GS/GP; win% = W/GS; GSAx = xGA-GA; danger saves/SV%. Skater: strength families - G, A1, A2 authoritative; if PP+SH+EN exceeds total, scale them down and EV=0, else EV = total - non-EV; A=A1+A2; P=G+A; PPP=PPG+PPA; SHP; SH% = G/SOG; FO% = FOW/(FOW+FOL); PPG = P/GP; TOI/GP; CF%/FF%/xGF% = for/(for+against)
  - Inputs/units: counts; TOI seconds; sources: —
  - Output scale: fractions 0-1 (SV%, SH%, FO%, CF%); GAA per 60; counts; writes: season bundles
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: evaluate_season_game; _aggregate_components; advanced _advanced_reconcile
- **Codex view (modeling-player-forecasts-season-reconcile, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Reconcile (_reconcile)
  - Purpose: Reconcile for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _reconcile(values: dict[str, float], population: str) -> dict[str, float]: reconciled = {key: float(value) for key, value in values.items()} if population == "goalie": reconciled["SAVES_GOALIE"] = max( 0.0, reconciled.get("SHOTS_AGAINST_GOALIE", 0.0) - reconciled.get("GOALS_AGAINST_GOALIE", 0.0), ) shots = reconciled.get("SHOTS_AGAINST_GOALIE", 0.0) toi = reconciled.get("TOTAL_TOI", 0.0) reconciled["SAVE_PERCENTAGE"] = reconciled["SAVES_GOALIE"] / shots if shots > 0 else 0.0 reconciled["GOALS_AGAINST_AVERAGE"] = ( 3600 * reconciled.get("GOALS_AGAINST_GOALIE", 0.0) / toi if toi > 0 else 0.0 ) reconciled["RELIEF_APPEARANCES_GOALIE"] = max( 0.0, reconciled.get("GAMES_PLAYED", 0.0) - reconciled.get("GAMES_STARTED", 0.0),
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): artifact review strengthReconciliation text (season.py:3837); docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Strength-state reconciliation' (:76)
  - Intended contract (Codex modeling-player-forecasts-season-reconcile): {"source": "modeling/player_forecasts/season.py:3935", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:3945 reconciled[\"SAVE_PERCENTAGE\"] = reconciled[\"SAVES_GOALIE\"] / shots if shots > 0 else 0.0", "modeling/player_forecasts/season.py:3947 3600 * reconciled.get(\"GOALS_AGAINST_GOALIE\", 0.0) / toi if toi > 0 else 0.0", "modeling/player_forecasts/season.py:3956 reconciled[\"START_PERCENTAGE_GOALIE\"] = starts / appearances if appearances > 0 else 0.0", "modeling/player_forecasts/season.py:3958 reconciled.get(\"WINS_GOALIE\", 0.0) / starts if starts > 0 else 0.0", "modeling/player_forecasts/season.py:3976 danger_saves / danger_shots if danger_shots > 0 else 0.0", "modeling/player_forecasts/season.py:3991 component_total = sum(", "modeling/player_forecasts/season.py:3999 non_ev_total = sum(", "modeling/player_forecasts/season.py:4004 scale = authoritative_total / non_ev_total"]}
  - External references: NHL stat definitions; NST CF%/FF%/xGF%
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2378"]}`
- **Leads (not audited):**
  - (opus) win% is wins/starts (NHL-style is W/decisions); win% and SV% computed from expected values (ratio of means, not mean of ratios)
  - (codex:modeling-player-forecasts-season-reconcile) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-056 Normal-approximation quantiles and ratio-interval reconciliation

- **Match:** Both; Opus PFC-091; Codex modeling-player-forecasts-season-quantiles, modeling-player-forecasts-season-reconcile-quantiles
- **Purpose:** Builds p10/p50/p90 per target and coherent intervals for ratio stats
- **Where:** `modeling/player_forecasts/season.py:4330 (_quantiles)`; `modeling/player_forecasts/season.py:4182 (_reconcile_quantiles)`; `modeling/player_forecasts/season.py:4330 _quantiles`; `modeling/player_forecasts/season.py:4182 _reconcile_quantiles`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (PFC-091):**
  - Method: p10/p90 = mean -/+ 1.2815515655*sd, lower clipped at 0 (except PLUS_MINUS); GP and GS clipped to maximum games; ratio intervals use extreme pairings (e.g. SV% low = (SA_p10 - GA_p90)/SA_p90; SH% low = G_p10/SOG_p90; FO% low = FOW_p10/(FOW_p10+FOL_p90)); finally p10<=p50<=p90 enforced
  - Inputs/units: means and variances; sources: —
  - Output scale: p10/p50/p90 in target units; ratios 0-1; writes: season bundles
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by pages/api/v1/player-forecasts/*; no cron in web/vercel.json or .github/workflows; hosted season inference gated by PLAYER_FORECAST_SEASON_INFERENCE_ENABLED (runbook:469 sets false)
  - Consumers: player-aggregates p10/p50/p90
- **Codex view (modeling-player-forecasts-season-quantiles, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Quantiles (_quantiles)
  - Purpose: Quantiles for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _quantiles( means: dict[str, float], variances: dict[str, float], population: str, maximum_games: int \| None = None, ) -> dict[str, dict[str, float]]: result: dict[str, dict[str, float]] = {"p10": {}, "p50": {}, "p90": {}} for target, mean in means.items(): deviation = math.sqrt(max(0.0, float(variances.get(target, 0.0)))) lower = mean - 1.2815515655446004 * deviation if target != "PLUS_MINUS": lower = max(0.0, lower) result["p10"][target] = _round_number(lower) result["p50"][target] = _round_number(mean) result["p90"][target] = _round_number(max(lower, mean + 1.2815515655446004 * deviation)) return _reconcile_quantiles(result, population, maximum_games)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-season-reconcile-quantiles, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Reconcile quantiles (_reconcile_quantiles)
  - Purpose: Reconcile quantiles for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _reconcile_quantiles( quantiles: dict[str, dict[str, float]], population: str, maximum_games: int \| None = None, ) -> dict[str, dict[str, float]]: reconciled = { level: {target: float(value) for target, value in values.items()} for level, values in quantiles.items() } if maximum_games is not None: for values in reconciled.values(): if "GAMES_PLAYED" in values: values["GAMES_PLAYED"] = min( float(maximum_games), max(0.0, values["GAMES_PLAYED"]), ) if "GAMES_STARTED" in values: values["GAMES_STARTED"] = min(
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex modeling-player-forecasts-season-quantiles): {"source": "modeling/player_forecasts/season.py:4330", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:4339 lower = mean - 1.2815515655446004 * deviation", "modeling/player_forecasts/season.py:4344 result[\"p90\"][target] = _round_number(max(lower, mean + 1.2815515655446004 * deviation))"]}
  - Intended contract (Codex modeling-player-forecasts-season-reconcile-quantiles): {"source": "modeling/player_forecasts/season.py:4182", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:4211 return numerator / denominator if denominator > 0 else fallback", "modeling/player_forecasts/season.py:4268 3600 * p50.get(\"GOALS_AGAINST_GOALIE\", 0.0),", "modeling/player_forecasts/season.py:4275 3600 * p10.get(\"GOALS_AGAINST_GOALIE\", 0.0),", "modeling/player_forecasts/season.py:4281 3600 * p90.get(\"GOALS_AGAINST_GOALIE\", 0.0),"]}
  - External references: none suggested
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2377"]}`
- **Leads (not audited):**
  - (opus) p50 is set to the mean (not median) for skewed counts
  - (opus) extreme-pairing ratio intervals are not true quantiles and are systematically too wide
  - (opus) Gaussian clipping at 0 for sparse counts produces p10=0 and mass misplacement
  - (codex:modeling-player-forecasts-season-quantiles) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-reconcile-quantiles) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-057 Game expectations: horizon totals, expected appearances/starts, SV% and GAA ratios

- **Match:** Both; Opus PFC-093; Codex game-expectations-appearanceProbability, game-expectations-ratios, game-expectations-startProbability, game-expectations-totals
- **Purpose:** Per-player per-game expected stats over a calendar or next-N window, summed to horizon totals.
- **Where:** `web/lib/player-forecasts/gameExpectations.ts:138 (buildGameExpectations)`; `web/lib/player-forecasts/gameExpectations.ts:195 (totals)`; `web/lib/player-forecasts/gameExpectations.ts:206 (probabilitySum)`; `web/lib/player-forecasts/gameExpectations.ts:209 (SAVE_PERCENTAGE, GOALS_AGAINST_AVERAGE ratios)`; `web/lib/player-forecasts/gameExpectationReader.ts:7 (parseGameExpectationScope)`; `web/lib/player-forecasts/gameExpectations.ts:206 probabilitySum`; `web/lib/player-forecasts/gameExpectations.ts:208 ratios`; `web/lib/player-forecasts/gameExpectations.ts:195 totals`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: unconditional; denominators: per 60, per game; generation: current
- **Opus view (PFC-093):**
  - Method: Total = sum of per-game expected values only if every game in a complete horizon has a value (else null with reason, coveredSum kept). expectedAppearances = sum(appearanceProbability); expectedStarts = sum(startProbability). SV% = sum(SV)/sum(SA); GAA = 60*sum(GA)/sum(minutes) (ratio of expected totals).
  - Inputs/units: per-game expected counts/minutes; probabilities 0-1; GOALIE_MINUTES minutes; sources: via loadPlanningData: games, roster_optimizer_team_games, player_forecast_source_observations, forge tables
  - Output scale: horizon totals (counts/minutes); SV% fraction 0-1; GAA goals per 60 minutes; expected appearances/starts (games); writes: —
  - Status: live — /api/v1/start-chart (pages/start-chart.tsx), /api/v1/forge/forecasts (pages/FORGE.tsx), lib/tradeValue/valuationComponents.ts
  - Consumers: pages/api/v1/start-chart.ts; pages/api/v1/forge/forecasts.ts; lib/tradeValue/valuationComponents.ts; servedForecastLedger native source
- **Codex view (game-expectations-appearanceProbability, calculation, location; Codex family 'Native game-expectation aggregates'):** Expected appearances
  - Purpose: Sum distinct game-level appearanceProbability only when requested horizon complete, nonempty and every probability finite; otherwise null.
  - Inputs/units: Admitted per-game probability fractions and calendar/next-N scope.
  - Output scale: Expected number of appearances/starts, not a probability or scheduled-game count.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (game-expectations-ratios, calculation, codex_part_of_opus; Codex family 'Native game-expectation aggregates'):** Native aggregate save percentage and GAA
  - Purpose: Summed expected saves/summed expected SA;60*summed expected GA/summed expected minutes; incompatible/missing/nonpositive denominator withheld.
  - Inputs/units: Goalie count and minute totals.
  - Output scale: Save fraction, GAA goals/60; ratios of expected totals, not expected realized ratio.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (game-expectations-startProbability, calculation, location; Codex family 'Native game-expectation aggregates'):** Expected starts
  - Purpose: Sum distinct game-level startProbability only when requested horizon complete, nonempty and every probability finite; otherwise null.
  - Inputs/units: Admitted per-game probability fractions and calendar/next-N scope.
  - Output scale: Expected number of appearances/starts, not a probability or scheduled-game count.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (game-expectations-totals, calculation, location; Codex family 'Native game-expectation aggregates'):** Horizon expected and covered totals
  - Purpose: Sum finite compatible-unit game means; full expected total only with complete horizon and target support, while coveredSum reports partial covered values.
  - Inputs/units: Admitted game-level unconditional count/minute means.
  - Output scale: Target counts/minutes, covered/required game counts and explicit incomplete reasons.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Audit context:**
  - Intent (Opus): gameExpectations.ts:137 'A view of admitted shared inputs; this function never issues, releases or generates a forecast.'; limitations gameExpectations.ts:229
  - Intended contract (Codex game-expectations-appearanceProbability): {"source": "web/lib/player-forecasts/gameExpectations.ts:206", "statement": "Sum distinct game-level appearanceProbability only when requested horizon complete, nonempty and every probability finite; otherwise null."}
  - Intended contract (Codex game-expectations-ratios): {"source": "web/lib/player-forecasts/gameExpectations.ts:208", "statement": "Summed expected saves/summed expected SA;60*summed expected GA/summed expected minutes; incompatible/missing/nonpositive denominator withheld."}
  - Intended contract (Codex game-expectations-startProbability): {"source": "web/lib/player-forecasts/gameExpectations.ts:206", "statement": "Sum distinct game-level startProbability only when requested horizon complete, nonempty and every probability finite; otherwise null."}
  - Intended contract (Codex game-expectations-totals): {"source": "web/lib/player-forecasts/gameExpectations.ts:195", "statement": "Sum finite compatible-unit game means; full expected total only with complete horizon and target support, while coveredSum reports partial covered values."}
  - External references: NHL GAA = GA*60/TOI minutes; SV% = SV/SA
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/forge/forecasts.test.ts`; `web/__tests__/pages/api/v1/start-chart.test.ts`; `web/__tests__/pages/forge/forecasts.test.tsx`; `web/__tests__/pages/start-chart.test.tsx`; `web/lib/player-forecasts/gameExpectations.test.ts`; `{"status": "Discovered, not run", "references": ["web/lib/player-forecasts/gameExpectations.test.ts"]}`
- **Leads (not audited):**
  - (opus) unit fallback treats PENALTY_MINUTES as count (line 89/202) while baseline marks it minutes
  - (opus) ratio of expected totals, not expected ratio (documented)
  - (codex:game-expectations-appearanceProbability) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:game-expectations-ratios) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:game-expectations-startProbability) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:game-expectations-totals) ["No correctness/quality judgment. Active runtime and deployed version unknown."]

## M-PFC-058 Rest-of-season aggregation (normal approximation with participation mixture)

- **Match:** Both; Opus PFC-094; Codex web-lib-player-forecasts-restofseason-aggregateplayerforecastrestofseason
- **Purpose:** Sum per-game means/variances to remaining-season totals and quantiles.
- **Where:** `web/lib/player-forecasts/restOfSeason.ts:9 (NORMAL_QUANTILES)`; `web/lib/player-forecasts/restOfSeason.ts:17 (aggregatePlayerForecastRestOfSeason)`; `web/lib/player-forecasts/restOfSeason.ts:83 (loadPlayerForecastRestOfSeason)`; `web/lib/player-forecasts/restOfSeason.ts:140 (persistPlayerForecastRestOfSeason)`; `web/lib/player-forecasts/restOfSeason.ts:17 aggregatePlayerForecastRestOfSeason`
- **Tags (heuristic):** conditionality: unconditional; denominators: per game; generation: legacy, current
- **Opus view (PFC-094):**
  - Method: Unconditional: mean += p*mu; var += p*sigma^2 + p(1-p)*mu^2 (Bernoulli mixture). Conditional: plain sums. Independence across games. Quantiles p10/p25/p50/p75/p90 = max(0, mean + z*sd) with z = -1.2816, -0.6745, 0, 0.6745, 1.2816. fullSeason = seasonToDateActual + remaining.
  - Inputs/units: per-game mean and variance (counts); playsProbability 0-1; sources: player_forecast_rest_of_season_outputs, players
  - Output scale: remaining-season count totals, variance, quantiles p10-p90 (floored at 0); writes: player_forecast_rest_of_season_outputs
  - Status: legacy/dead — (writer) aggregate/persist have no non-test callers; reader live at /api/v1/player-forecasts/rest-of-season (pages/player-forecasts.tsx)
  - Consumers: pages/api/v1/player-forecasts/rest-of-season.ts (load only)
- **Codex view (web-lib-player-forecasts-restofseason-aggregateplayerforecastrestofseason, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Rest-of-season moment aggregation (aggregatePlayerForecastRestOfSeason)
  - Purpose: Sum independent game moments; optional pμ and pσ²+p(1-p)μ²; normal p10/p25/p50/p75/p90 clipped at zero; add actuals for full season.
  - Inputs/units: Named model/observation inputs at cited declaration; Remaining/full-season means and quantiles, variance, game count. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Remaining/full-season means and quantiles, variance, game count.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (only distributionKind label 'independent_game_moments_normal_approximation', restOfSeason.ts:76)
  - Intended contract (Codex web-lib-player-forecasts-restofseason-aggregateplayerforecastrestofseason): {"source": "web/lib/player-forecasts/restOfSeason.ts:17", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/player-forecasts/restOfSeason.ts:39 if (!Number.isFinite(component.variance) \|\| component.variance < 0) {", "web/lib/player-forecasts/restOfSeason.ts:40 throw new Error(\"Rest-of-season component variance must be non-negative.\");", "web/lib/player-forecasts/restOfSeason.ts:47 remainingMean += probability * component.mean;", "web/lib/player-forecasts/restOfSeason.ts:49 probability * component.variance", "web/lib/player-forecasts/restOfSeason.ts:50 + probability * (1 - probability) * component.mean * component.mean;", "web/lib/player-forecasts/restOfSeason.ts:53 remainingVariance += component.variance;", "web/lib/player-forecasts/restOfSeason.ts:57 const standardDeviation = Math.sqrt(remainingVariance);", "web/lib/player-forecasts/restOfSeason.ts:61 Math.max(0, remainingMean + zScore * standardDeviation),"]}
  - External references: Poisson / negative-binomial count totals; law of total variance
  - Fixtures/test data: `web/scripts/seed-player-forecast-fixtures.ts`
  - Tests: `web/lib/player-forecasts/playerForecasts.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/playerForecasts.test.ts:25"]}`
- **Leads (not audited):**
  - (opus) aggregatePlayerForecastRestOfSeason and persist have no non-test callers (likely dead writer; API only reads)
  - (opus) normal approximation clipped at 0 for low counts (goals) misstates lower quantiles; independence ignores shared role/injury correlation
  - (opus) seasonToDateActual defaults to 0 when absent
  - (codex:web-lib-player-forecasts-restofseason-aggregateplayerforecastrestofseason) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-059 Rookie roster logistic offsets (age, draft, trajectory, PPG)

- **Match:** Both; Opus PFC-095; Codex modeling-player-forecasts-rookies-fit-logistic-offsets, modeling-player-forecasts-rookies-trajectory, modeling-player-forecasts-rookies-transition-features, modeling-player-forecasts-rookies-transition-prediction
- **Purpose:** Adjusts league base roster probability with player features
- **Where:** `modeling/player_forecasts/rookies.py:306 (_transition_features)`; `modeling/player_forecasts/rookies.py:325 (_fit_logistic_offsets)`; `modeling/player_forecasts/rookies.py:478 (_transition_prediction)`; `modeling/player_forecasts/rookies.py:245 (_age_on_season_start)`; `modeling/player_forecasts/rookies.py:253 (_trajectory)`; `modeling/player_forecasts/rookies.py:325 _fit_logistic_offsets`; `modeling/player_forecasts/rookies.py:253 _trajectory`; `modeling/player_forecasts/rookies.py:306 _transition_features`; `modeling/player_forecasts/rookies.py:478 _transition_prediction`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (PFC-095):**
  - Method: features: clip((age-21)/5,-2,2), clip((128-pick)/128,-1,1) (undrafted 0), trajectory clip(PPG_last - PPG_prev,-1,1), clip(PPG,0,3), isD, isG; logit offset from league probability; batch gradient descent lr 0.04, 500 iterations, ridge 0.2 on all coefficients, requires >=30 samples; probability clipped [0.01,0.99]; translated rate = source per-game rate * league factor
  - Inputs/units: age years (Sept 15); draft pick; points per game; sources: player landing
  - Output scale: probability 0.01-0.99; writes: transitionModel JSON
  - Status: unknown — manual CLI season-rookie-freeze (modeling/player_forecasts/__main__.py:121) feeding v4 season-train; serving only when validation eligibleForServing
  - Consumers: rookie_projection_profile; evaluate_rookie_transition_model
- **Codex view (modeling-player-forecasts-rookies-fit-logistic-offsets, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit logistic offsets (_fit_logistic_offsets)
  - Purpose: Fit logistic offsets for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _fit_logistic_offsets(samples: list[dict[str, Any]]) -> list[float]: coefficients = [0.0] * 6 if len(samples) < 30: return coefficients learning_rate = 0.04 ridge = 0.2 for _ in range(500): gradients = [0.0] * len(coefficients) for sample in samples: prediction = _sigmoid( _logit(float(sample["leagueProbability"])) + sum( coefficient * feature for coefficient, feature in zip(coefficients, sample["features"]) ) ) error = prediction - float(sample["madeNhl"]) for index, feature in enumerate(sample["features"]):
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-rookies-trajectory, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Trajectory (_trajectory)
  - Purpose: Trajectory for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _trajectory(rows: list[dict[str, Any]]) -> float: ordered = sorted(rows, key=lambda row: row["season"]) if len(ordered) < 2: return 0.0 first, last = ordered[-2:] first_rate = float(first["points"]) / max(1, int(first["gamesPlayed"])) last_rate = float(last["points"]) / max(1, int(last["gamesPlayed"])) return max(-1.0, min(1.0, last_rate - first_rate))
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-rookies-transition-features, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Transition features (_transition_features)
  - Purpose: Transition features for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _transition_features( capture: dict[str, Any], source: dict[str, Any] ) -> list[float]: age = _age_on_season_start(capture.get("birthDate"), int(source["season"])) draft = capture.get("draftOverall") source_rows = [ row for row in capture["seasonTotals"] if row["league"] == source["league"] and int(row["season"]) <= int(source["season"]) ] return [ _clamp(((age if age is not None else 21.0) - 21.0) / 5.0, -2, 2), 0.0 if draft is None else _clamp((128.0 - float(draft)) / 128.0, -1, 1), _trajectory(source_rows), _clamp(float(source["points"]) / max(1, int(source["gamesPlayed"])), 0, 3), 1.0 if capture.get("position") == "D" else 0.0, 1.0 if capture.get("position") == "G" else 0.0, ]
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (modeling-player-forecasts-rookies-transition-prediction, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Transition prediction (_transition_prediction)
  - Purpose: Transition prediction for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _transition_prediction( capture: dict[str, Any], source: dict[str, Any], transition_model: dict[str, Any], ) -> tuple[float, dict[str, float]]: league_model = (transition_model.get("leagues") or {}).get(source["league"]) global_probability = float( transition_model.get("globalRosterProbability") or 0.2 ) base_probability = float( (league_model or {}).get("rosterProbability") or global_probability ) features = _transition_features(capture, source) offsets = transition_model.get("rosterLogisticOffsets") or [0.0] * len(features) probability = _sigmoid( _logit(base_probability) + sum( float(coefficient) * feature
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/player-projections/research-contract-v4-season-fantasy.json rookieModel
  - Intended contract (Codex modeling-player-forecasts-rookies-fit-logistic-offsets): {"source": "modeling/player_forecasts/rookies.py:325", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/rookies.py:326 coefficients = [0.0] * 6", "modeling/player_forecasts/rookies.py:332 gradients = [0.0] * len(coefficients)", "modeling/player_forecasts/rookies.py:336 + sum(", "modeling/player_forecasts/rookies.py:337 coefficient * feature", "modeling/player_forecasts/rookies.py:343 gradients[index] += error * feature", "modeling/player_forecasts/rookies.py:345 gradients[index] = gradients[index] / len(samples) + ridge * coefficients[index]", "modeling/player_forecasts/rookies.py:346 coefficients[index] -= learning_rate * gradients[index]"]}
  - Intended contract (Codex modeling-player-forecasts-rookies-trajectory): {"source": "modeling/player_forecasts/rookies.py:253", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/rookies.py:258 first_rate = float(first[\"points\"]) / max(1, int(first[\"gamesPlayed\"]))", "modeling/player_forecasts/rookies.py:259 last_rate = float(last[\"points\"]) / max(1, int(last[\"gamesPlayed\"]))"]}
  - Intended contract (Codex modeling-player-forecasts-rookies-transition-features): {"source": "modeling/player_forecasts/rookies.py:306", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/rookies.py:316 _clamp(((age if age is not None else 21.0) - 21.0) / 5.0, -2, 2),", "modeling/player_forecasts/rookies.py:317 0.0 if draft is None else _clamp((128.0 - float(draft)) / 128.0, -1, 1),", "modeling/player_forecasts/rookies.py:319 _clamp(float(source[\"points\"]) / max(1, int(source[\"gamesPlayed\"])), 0, 3),"]}
  - Intended contract (Codex modeling-player-forecasts-rookies-transition-prediction): {"source": "modeling/player_forecasts/rookies.py:478", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/rookies.py:491 offsets = transition_model.get(\"rosterLogisticOffsets\") or [0.0] * len(features)", "modeling/player_forecasts/rookies.py:494 + sum(", "modeling/player_forecasts/rookies.py:495 float(coefficient) * feature", "modeling/player_forecasts/rookies.py:506 float(source[source_key]) / max(1, int(source[\"gamesPlayed\"]))", "modeling/player_forecasts/rookies.py:507 ) * float(factors.get(target) or 0)"]}
  - External references: logistic regression with offset; prospect models (e.g. Hockey Prospecting NHLe + age)
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) undrafted players get draft feature 0, same as pick 128, conflating 'undrafted' with mid-round
  - (opus) features unstandardized while ridge 0.2 applies equally; GD with fixed iterations may not converge
  - (codex:modeling-player-forecasts-rookies-fit-logistic-offsets) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-rookies-trajectory) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-rookies-transition-features) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-rookies-transition-prediction) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-060 Rookie league-transition model (NHLe-style equivalency and roster probability)

- **Match:** Both; Opus PFC-096; Codex modeling-player-forecasts-rookies-learn-rookie-transition-model
- **Purpose:** Learns per-league probability of reaching the NHL next season, conditional games and NHL equivalency factors
- **Where:** `modeling/player_forecasts/rookies.py:350 (learn_rookie_transition_model)`; `modeling/player_forecasts/rookies.py:263 (_latest_source_before)`; `modeling/player_forecasts/rookies.py:277 (_nhl_row)`; `modeling/player_forecasts/rookies.py:350 learn_rookie_transition_model`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; denominators: per game; generation: current
- **Opus view (PFC-096):**
  - Method: transition = non-NHL source season (max GP league) -> NHL next season; global P(made) = (made+8)/(n+16); league P = (made + 20*global)/(n+20); conditional games = mean NHL GP of made; factor per target (G, A, PIM) = sum(nhl_rate*min(82,GP))/sum(source_rate*min(82,GP)); global factor = median of leagues with >=3 transitions (default 0.35); league factor shrunk (n*f + 10*global)/(n+10); global NHL rates per GP
  - Inputs/units: per-game source-league rates; GP; sources: api-web.nhle.com player/{id}/landing (frozen)
  - Output scale: probability 0-1; equivalency factor; games; writes: file: rookie transitionModel JSON
  - Status: unknown — manual CLI season-rookie-freeze (modeling/player_forecasts/__main__.py:121) feeding v4 season-train; serving only when validation eligibleForServing
  - Consumers: rookie_projection_profile; train_season_artifact
- **Codex view (modeling-player-forecasts-rookies-learn-rookie-transition-model, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Learn rookie transition model (learn_rookie_transition_model)
  - Purpose: Learn rookie transition model for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def learn_rookie_transition_model( captures: list[dict[str, Any]], *, training_cutoff_season: int = 20242025, ) -> dict[str, Any]: raw_transitions: list[dict[str, Any]] = [] for capture in captures: totals = capture.get("seasonTotals") or [] for source_season in sorted({ int(row["season"]) for row in totals if row["league"] != NHL_LEAGUE and int(row["season"]) <= training_cutoff_season }): source = _latest_source_before(totals, source_season) if source is None or int(source["season"]) != source_season: continue nhl = _nhl_row(totals, source_season + 10001)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/player-projections/research-contract-v4-season-fantasy.json rookieModel
  - Intended contract (Codex modeling-player-forecasts-rookies-learn-rookie-transition-model): {"source": "modeling/player_forecasts/rookies.py:350", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/rookies.py:377 global_made = sum(1 for row in raw_transitions if row[\"madeNhl\"])", "modeling/player_forecasts/rookies.py:378 global_probability = (global_made + 8) / (len(raw_transitions) + 16)", "modeling/player_forecasts/rookies.py:386 len(made) + 20 * global_probability", "modeling/player_forecasts/rookies.py:387 ) / (len(transitions) + 20)", "modeling/player_forecasts/rookies.py:389 sum(int(transition[\"nhl\"][\"gamesPlayed\"]) for transition in made) / len(made)", "modeling/player_forecasts/rookies.py:402 source_rate = float(source[source_key]) / max(1, int(source[\"gamesPlayed\"]))", "modeling/player_forecasts/rookies.py:403 nhl_rate = float(nhl[nhl_key]) / max(1, int(nhl[\"gamesPlayed\"]))", "modeling/player_forecasts/rookies.py:404 numerator += nhl_rate * min(82, int(nhl[\"gamesPlayed\"]))"]}
  - External references: NHLe (Desjardins 2004; Bader/CapFriendly; e.g. KHL ~0.77, SHL ~0.57, AHL ~0.39-0.47, NCAA ~0.4, CHL ~0.14-0.3)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2391"]}`
- **Leads (not audited):**
  - (opus) sample is drawn only from players captured for the current pool, so transitions are survivor-selected and P(made NHL) is inflated
  - (opus) equivalency factors use only players who made the NHL next season (selection bias toward over-performers) and per-game rates without TOI/age
  - (opus) only the highest-GP non-NHL league in the latest season is used; split seasons drop data
  - (codex:modeling-player-forecasts-rookies-learn-rookie-transition-model) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

