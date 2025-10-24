# PRD: Player Sustainability and Short-Horizon Projections

## Introduction / Overview

We will build a modeling pipeline that evaluates each NHL skater’s recent performance against their personal historical norms and projects near-term outcomes. The system produces:
- A Sustainability Score indicating how likely current form is to persist.
- Hot/Cold/Normal streak probabilities for the next 5 and 10 games.
- Short-horizon projections for key counting stats (with confidence bands).
- Overperforming/Underperforming flags with brief explanations.

Primary user: Fantasy manager. Initial displays target rolling windows (last 3/5/10/25/50 games) and per-upcoming-opponent views. Updates nightly after games and expose an API to recalculate and append new daily data.

## Goals

- Quantify “form vs. norm” using surface and underlying metrics, adjusted for usage and context.
- Generate per-player Sustainability Score (0–100) plus explainable drivers.
- Produce calibrated probabilities of hot/cold/normal streaks for the next 5 and 10 games.
- Provide projections and confidence intervals for surface stats over 5- and 10-game horizons.
- Refresh outputs nightly and append to historical snapshots for trend tracking.
- Make outputs queryable via API and persist to the database for UI consumption.

## User Stories

- As a fantasy manager, I want to see whether a player’s recent production is sustainable so I can decide to buy, hold, or sell.
- As a fantasy manager, I want per-opponent probability and projection signals for the next few games to optimize starts/sits.
- As a fantasy manager, I want a simple score and flags with a short explanation (e.g., “Shooting% well above career, ixG stable, PP TOI up”).
- As a fantasy manager, I want confidence bands so I can gauge risk.
- As a fantasy manager, I want signals based on both surface stats (goals/assists/shots/etc.) and underlying drivers (ixG, xGF/xGA, SCF/HDCF, deployment).

## Functional Requirements

1. Metric Windows and Baselines
   1.1 Compute rolling windows for last 3, 5, 10, 25, and 50 games per player.
   1.2 Compute career baseline (all strengths) for comparison and as a prior.
   1.3 Prefer WGO for usage (TOI) where overlapping.

2. Surface Metrics (S1–S13)
   The system must ingest and analyze per-player:
   - S1 Goals, S2 Assists, S3 Points, S4 Shots, S5 PP points, S6 Hits, S7 Blocks, S8 PIM, S9 Plus/Minus, S10 Faceoffs Won/FO%, S11 TOI, S12 PP TOI, S13 PP% (definition to finalize; see Open Questions).

3. Underlying Metrics (U)
   The system must ingest and analyze:
   - U1 Individual: ixG, iCF/FF/SF, Rush attempts, Rebounds created, IPP, SOG/60, First/Second assists.
   - U2 On-ice: xGF/xGA, CF/FF/SF, SCF, HDCF, zone start % (OZS%), PDO, on-ice SH% (oiSH%).
   - U3 Usage: ESTOI, PPTOI, SHTOI and share of team minutes.
   - U4 Team/opponent: Team defensive/possession rates; opponent adjustments for upcoming games.

4. Outputs
   4.1 Sustainability Score (0–100) per player per snapshot.
   4.2 Streak probabilities for Hot/Normal/Cold for horizons: 5 games and 10 games.
   4.3 Projections for surface stats over next 5 and 10 games (totals and per-game), with 50% and 80% confidence bands.
   4.4 Flags: Overperforming/Underperforming vs. career norms and recent underlying drivers.
   4.5 Explanations: Top 3 contributing drivers (e.g., “PP TOI up +40% vs career; SH% +2.1σ; ixG stable”).

5. Per-Opponent Adjustment
   5.1 Incorporate opponent strength using team-level rates; produce per-upcoming-game distributions.
   5.2 Aggregate per-game distributions to cumulative 5- and 10-game horizons.

6. Scheduling and Updates
   6.1 Recompute nightly after games; append to historical snapshots.
   6.2 Provide an API endpoint to trigger recomputation for a given date range (default: last 1 day).

7. Persistence
   7.1 Persist trend bands and per-metric z-scores for recent windows (reuse `sustainability_trend_bands` where applicable).
   7.2 Persist projections, probabilities, flags, and explanations to a new projections table (see Technical Considerations).

8. API
   8.1 POST /api/v1/sustainability/recompute?date=YYYY-MM-DD — recompute and append for snapshot date.
   8.2 GET /api/v1/sustainability/player/:playerId?window=10&horizon=5 — return score, probs, projections, flags, explanations for a given rolling window and horizon.
   8.3 GET /api/v1/sustainability/upcoming/:playerId?games=5 — per-opponent per-game distributions and rollup.
   8.4 Responses include metadata (snapshot_date, window_code, horizon_games, strengths where relevant).

9. Performance and Reliability
   9.1 Nightly batch must complete within an acceptable SLA (target <15 min for all active skaters; refine later).
   9.2 API P95 <500ms for cached reads; recompute is batch-only.

10. Access Control
   10.1 Writes require server-side auth only; reads are public (or per existing site policy).

## Non-Goals (Out of Scope)

- Long-horizon forecasts beyond 10 games.
- Goalie-specific models (future phase).
- Yahoo fantasy-specific scoring or roster integration (explicitly excluded).
- Injury modeling and manual news ingestion (future enhancement).
- Line matching / micro-shift simulations.

## Design Considerations (Optional)

- UI widgets: Player card with Sustainability Score, flags, sparkline of trend bands, per-opponent chips for next N games.
- Show “Why” with 2–3 bullets using humanized feature importances.
- Rolling window selector (3/5/10/25/50) and horizon toggle (5/10).

## Technical Considerations (Data + Modeling)

### Data Sources and Mapping

Canonical identity
- Use `players.id` as the canonical key.
- WGO/NST only; no Yahoo integration.

Surface stats (recent form and season aggregates)
- Daily/Per-game: `wgo_skater_stats`
  - goals, assists, points, shots, plus_minus, pp_points, hits, blocked_shots, penalties/penalty_minutes, faceoffs (won/lost/percentage), es_toi_per_game, pp_toi_per_game, sh_toi_per_game.
- Season totals: `wgo_skater_stats_totals` for season-level baselines when needed.

Underlying individual (recent + baseline)
- Game logs: `nst_gamelog_as_counts`, `nst_gamelog_as_rates`
  - ixg/ixg_per_60 (as ixg or ixg_per_60), icf/iff/isf, rush_attempts, rebounds_created, shots, sh_percentage, penalties, etc.
- Seasonal: `nst_seasonal_individual_counts`, `nst_seasonal_individual_rates`
  - per-60 versions: shots_per_60, ixg_per_60, icf_per_60, iff_per_60, ihdcf_per_60, ipp.
- Season-long views: `nst_seasonlong_as_counts`, `nst_seasonlong_as_rates` for multi-season/career baseline.

Underlying on-ice (team/context)
- Seasonal OI: `nst_seasonal_on_ice_counts`, `nst_seasonal_on_ice_rates`
  - xGF/xGA, CF/CA, FF/FA, SF/SA, SCF/HDCF and pct variants; per-60 and pct columns.
- Season-long OI views: `nst_seasonlong_as_counts_oi`, `nst_seasonlong_as_rates_oi`
  - zone starts (off_zone_start_pct), off_zone_faceoff_pct, oiSH% (on_ice_sh_pct), on_ice_sv_pct, PDO.

Team and opponent factors
- Daily team timeseries: `nst_team_all` (timeseries by date) for near-term team form.
- Season team rates: `nst_team_stats`.
- Schedule and upcoming opponents: `games` and team-related views (e.g., `team_games` view if usable) to link players to upcoming opponents.

Trend storage
- Trend bands: `sustainability_trend_bands` (exists) for storing z-scores/bands per metric/window.

Notes
- Prefer WGO for usage (TOI) where overlapping with NST.
- Strength splits (EV/PP/SH) available via WGO per-game and NST rates; initial baseline is all strengths as per requirement.

### Data Joins and Keys

- Player: join WGO `player_id` to `players.id` (verify 1:1; if not exact, add mapping step using internal crosswalks without Yahoo).
- Game date alignment: use `date` (WGO) and `date_scraped` (NST gamelogs); define a canonical game_date where feasible.
- Opponent mapping: from `games` and team abbreviations to team IDs present in NST tables.

### Modeling Approach (Phase 1)

- Start simple and iterate.
  - Rates and regression-to-mean: Empirical Bayes shrinkage of recent per-60 rates toward career priors (all strengths) with window-weighting.
  - Streak classification: Logistic regression (or calibrated gradient boosting later) to predict Hot/Normal/Cold categorical outcome based on recent deltas vs. baseline, usage changes, and on-ice context.
  - Projections: Convert rate projections to counting stat projections by expected TOI and per-opponent defensive adjustments; aggregate across next 5/10 games.
  - Explainability: Shapley/feature importance for logistic model; expose top drivers as short text.

Features (illustrative)
- Recent deltas (z-scores) vs. career for: goals/60, assists/60, shots/60, ixG/60, SCF/60, HDCF/60, IPP, oiSH%, PDO, OZS%, PPTOI share, ESTOI.
- Usage trend: ΔPPTOI, ΔESTOI, ΔSHTOI vs. career.
- Finishing form: SH% vs. career; shots mix, rebounds created, rush attempts.
- Team/opponent: opponent xGA/60, CA/60, PK strength, team CF%.

Horizon aggregation
- For each upcoming game, compute opponent-adjusted distribution; roll up to 5- and 10-game totals with uncertainty propagation.

### Persistence (Proposed)

- Continue using `sustainability_trend_bands` for per-metric, per-window bands:
  - player_id, snapshot_date, metric_key, window_code, band_low, band_high, z_score, value.
- New table: `sustainability_projections` (proposed)
  - player_id (int), snapshot_date (date), horizon_games (int), window_code (text),
  - sustainability_score (int), probs JSONB {hot, normal, cold},
  - projections JSONB {goals, assists, points, shots, pp_points, hits, blocks, pim, plus_minus, fow, fo_pct},
  - bands JSONB with percentiles for each metric,
  - flags JSONB {overperforming: bool, underperforming: bool, notes: text[]},
  - explanations JSONB [{feature: string, impact: number, text: string}],
  - opponent_breakdown JSONB [ {game_id, opp_team, date, per_game_projections{...}} ].

### API (Initial Spec)

- POST `/api/v1/sustainability/recompute?date=YYYY-MM-DD`
  - Auth: server-only.
  - Action: recompute nightly snapshot for provided date (default: last 1 day), persist trend bands and projections.
  - Response: { snapshot_date, processed_players, inserted_rows, duration_ms }.

- GET `/api/v1/sustainability/player/:playerId?window=10&horizon=5`
  - Returns current snapshot for player and window/horizon.
  - Response: { player_id, snapshot_date, window_code, horizon_games, sustainability_score, probs, projections, bands, flags, explanations }.

- GET `/api/v1/sustainability/upcoming/:playerId?games=5`
  - Returns per-opponent per-game projections and a rollup.

### Quality and Ops

- Batch job idempotency: upsert by (player_id, snapshot_date, window_code, horizon_games).
- Monitoring: log counts, timing, error rates.
- Recompute retry on partial failure; no duplicate rows.

## Success Metrics

- Projection accuracy: MAE/RMSE for goals, assists, shots, pp_points over 5- and 10-game horizons vs. baseline models (career-average; recent-form-only).
- Probability calibration: Brier score and reliability curves for Hot/Normal/Cold.
- Classification utility: Lift vs. baseline for identifying top decile hot and cold candidates.
- Latency/SLA: Nightly job duration within target; API read P95 <500ms (cached).

## Open Questions

1. PP% (S13) precise definition: PP points per game? PP shot conversion? PP on-ice GF share? Please confirm.
2. Confirm `wgo_skater_stats.player_id` == `players.id` or provide a non-Yahoo crosswalk if mismatched.
3. Acceptable thresholds for Hot/Cold labeling (e.g., z-score > +1.0 as hot)? Or learn thresholds from quantiles.
4. Do we include strength splits (EV/PP/SH) in outputs in v1, or only use them as features while reporting all-strengths projections?
5. Any injuries/scratches data source to exclude non-playing games from horizon totals?
6. For per-opponent adjustments, do we want back-to-back fatigue or home/away effects in v1?

---

Acceptance criteria (v1)
- Nightly batch persists new snapshot rows into `sustainability_trend_bands` and `sustainability_projections` for all active skaters.
- API endpoints return Sustainability Score, probabilities, projections, bands, flags, and explanations for a given player.
- Calibration and MAE baselines computed and logged; v1 beating naive recent-form and career-only baselines on held-out windows.
- Documentation: endpoint schema and field dictionary for metrics and features.

Implementation phases (post-PRD)
- Phase 1: Data prep and joins; rolling windows; career priors; baseline projections; API + persistence.
- Phase 2: Opponent-adjusted projections; logistic streak model; explanations.
- Phase 3: Calibration tuning; UI widgets; expanded features and robustness (B2B, H/A).
