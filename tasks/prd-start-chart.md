# PRD — Start Chart: Short-Horizon Fantasy Hockey Player & Team Prediction

Owner: TJ
Product: Start Chart (streaming/start-sit recommendations)
Horizon: 7–14 days (rolling)
Modes: Points and Categories
Stack: Next.js (Vercel) + Supabase + Node/TS jobs (or Python for ingestion)

---

## 0) Purpose and Outcomes

Goal: Rank players by position over the next 1–2 weeks using player trends, opponent context, and goalie effects, with user-tunable scoring and recency.
Primary Outcome: A Start Chart UI that converts short-horizon projections into actionable start/stream decisions with confidence and accountability.

Success Metrics
- Start-vs-replacement decision win rate ≥ 65 percent over rolling 30 days
- MAPE: Shots ≤ 20 percent, PPP window totals ≤ 30 percent
- Calibration: 50 percent intervals contain actuals ≈ 50 percent
- P95 projection latency under 4s for 100 players, 7-day window

---

## 1) Scope

In-scope
- Data ingestion: schedule, lines, skaters, team state-split metrics, goalies
- Decay-blended player rates and trend-aware TOI
- Opponent and goalie adjustments (5v5 and PP)
- Goalie start probabilities and goalie quality effects
- Window aggregation with off-night capacity/bench conflicts
- Points and Categories modes with positional replacement (VORP and VONA)
- Prediction logging, outcome capture, evaluation metrics and basic dashboards

Out-of-scope for MVP
- Market odds blending
- Altitude effects (explicitly excluded)
- Rich injury modeling beyond status feeds

---

## 2) Definitions

Decay-weighted rate (s*): exponential recency smoothing with user τ
Opponent multipliers: defensive intensity factors by game state
Start probability: probability a goalie starts a specific game
Off-night leverage: ability to use projected games given daily roster caps
Replacement level: per-position baseline implied by league size and slots

---

## 3) Data Requirements

3.1 Schedule and Context
- Games next 14 days: date, home, away, team time zones
- Rest days per team since last game; back-to-back flags for home and away
- Do not include altitude

3.2 Team Strength (by state)
- 5v5: xGF per 60, xGA per 60, CF per 60, CA per 60, HDCF per 60, HDCA per 60, pace proxy
- PP offense: PP xGF per 60, PP individual shots per 60, PPO per game
- PK defense: PK xGA per 60, PK shots against per 60, PPOA per game
- Rolling windows: last 10, 25, 50 GP; league baselines L_xGA60_5v5 and L_PK_xGA60

3.3 Goalies
- Depth chart and rolling 30-day starter share
- Rest days, B2B, home or away
- Recent SV percent for 7, 14, 40 games; GSAx per 60 if available; rebounds per shot against if available
- Start confirmations when known; otherwise start probabilities

3.4 Skaters
- Usage: ATOI, TOI by 5v5, PP, PK; line and PP unit (1 vs 2)
- Individual rates: ixG per 60, iSF per 60, iCF per 60, iHDCF per 60, A1 per 60, A2 per 60
- On-ice: xGF_on per 60, xGA_on per 60, xGF percent relative
- Deployment: OZS percent; QoT and QoC indices optional v2+
- Peripherals: Hits per 60, Blocks per 60, FOW per 60, FOL per 60, PIM per 60
- Status flags: DTD, IR, scratched

3.5 User Scoring and Constraints
- Points weights JSON for goals, assists, shots, hits, blocks, PIM, PPP, SHP, GWG, etc.
- Categories list, per-week tie and win logic
- League structure: teams count, slots per position, bench slots
- Daily lineup caps for bench conflict estimation

---

## 4) Computational Model

4.1 Recency Smoothing
- For any event rate s at time t_i with time now t_now and user τ:
    w_i = exp(-(t_now - t_i) / τ)
    s* = sum(s_i * w_i) / sum(w_i)
- τ defaults to 30 days and is user-tunable (for example 15, 30, 60)

4.2 Team Ratings (xG-driven Offense and Defense Elo per state)
- Initialize per team and per state: Elo_O_state = 1500 and Elo_D_state = 1500 for states 5v5, PP, PK
- Pre-game expected for team T vs opponent O:
    μ_for_state = L_state * exp(k1 * (Elo_O_state_T - 1500) / 400 - k2 * (Elo_D_state_O - 1500) / 400 + H * home + R * rest_diff + B * b2b_flag)
- Post-game update per state with xG differential:
    Δ = (xGF_for - xGF_against) - (μ_for - μ_against)
    Elo_O_state_T += K * Δ
    Elo_D_state_O -= K * Δ
- Use smaller K early season, then taper

4.3 Opponent Multipliers (clipped)
- 5v5 defensive multiplier:
    M_def_5v5 = clip(xGA60_opp_5v5 / L_xGA60_5v5, 0.75, 1.25)
- PK defensive multiplier:
    M_pk = clip(PK_xGA60_opp / L_PK_xGA60, 0.75, 1.30)

4.4 Goalie Start Probability (logistic)
- Features: rest days, B2B, home, opponent strength, recent 30d start share, team effect
- Model:
    logit(P_start) = β0 + β1 * RestDays + β2 * B2B + β3 * Home + β4 * OppStrength + β5 * RecentStartShare + ζ_team

4.5 Goalie Performance
- Shots against expectation:
    E[SA] = TeamAllowed_SA_rate * pace * M_def_5v5
- SV percent projection using empirical Bayes blend:
    SV_proj = w7 * SV_7 + w14 * SV_14 + w40 * SV_40 + wP * LeaguePrior  where weights sum to 1 using inverse-variance or decay
- Goals allowed:
    E[GA] = E[SA] * (1 - SV_proj)
- Goalie finishing suppression multiplier for skater finishing:
    M_goalie_finish = clip(1 - (SV_proj - L_SV) / 0.070, 0.80, 1.20)

4.6 Skater Per-Game Projection
- TOI trends:
    E[TOI_5v5] = α + β1 * ΔATOI_10 + β2 * LineRole + β3 * ScoreStateBias + ε
    E[PP_TOI] = p(PP1) * PPshare1 + (1 - p(PP1)) * PPshare2  where p(PP1) inferred from recent PP usage
- Event means per game (Poisson assumptions):
    Goals mean
        λ_G = (ixG60_5v5* / 60) * E[TOI_5v5] * M_def_5v5 * M_goalie_finish
            + (ixG60_PP* / 60)  * E[PP_TOI]  * M_pk       * M_goalie_finish
    Assists mean
        λ_A = (xGF_on60_5v5* / 60) * E[TOI_5v5] * M_def_5v5 * AssistShare_5v5*
            + (xGF_on60_PP*  / 60) * E[PP_TOI]  * M_pk       * AssistShare_PP*
    Shots mean
        λ_S = (iSF60_total* / 60) * (E[TOI_5v5] + E[PP_TOI]) * average(M_def_5v5, M_pk)
    Peripherals
        λ_stat = (stat60* / 60) * relevant_TOI * minor_multipliers
- Distribution for counts:
    Stat_i ~ Poisson(λ_i)  or Negative Binomial if overdispersion detected

4.7 Window Aggregation and Capacity
- WindowStat = sum over games of E[Stat given per-game context]
- Bench conflicts on heavy nights:
    AdjFactor_day = min(1, SlotsAvailable_day / ExpectedActive_day)
    WindowStat_adj = sum over days of (sum over games that day of PlayerStat) times AdjFactor_day for players with conflicts

4.8 Points Mode
- Fantasy points:
    fPts = sum over stats of weight_k times WindowStat_adj_k

4.9 Categories Mode with Positional Replacement
- Determine replacement per position from league teams and slots
    N_drafted_pos = Teams * Slots_pos  plus optional bench share if desired
    Replacement_pos = rank threshold N_drafted_pos + 1 within position
- Compute Z-scores for the window vs position
    Z_i = (PlayerStat_i - mean_pos_i) / std_pos_i
- VORP_pos = sum over categories of (Z_i - Z_replacement_pos_i)
- VONA_pos = sum over categories of (Z_i - Z_next_available_pos_i)

4.10 Ranking and Confidence
- Primary rank
    Points mode: by fPts
    Categories mode: by VORP_pos
- Confidence bands from Monte Carlo window simulation drawing per-game Poisson or Negative Binomial counts; report P25 and P75
- Tags: Off-night bonus, PP1, Line 1, soft PK cluster, elite-goalie cluster

---

## 5) Evaluation and Accountability

5.1 Storage
- predictions: game_id, player_id, stat, mean, variance, p_any, timestamp, model_version, context_json
- outcomes: game_id, player_id, stat, actual, timestamp
- rank_decisions: timestamp, mode, player_id, replacement_id, projected_delta, actual_delta

5.2 Metrics
- Continuous: MAE and MAPE for SOG, G, A, PPP
- Distributional: CRPS for counts where simulated
- Binary: Brier for at least one point, goal, assist
- Ranking: Top-N hit rate; Spearman rho per position per day
- Decision quality: start-vs-replacement win rate and average gain

5.3 Dashboards
- Rolling 30-day error by stat, position, team
- Calibration plots; model version diffs
- Bench conflict heatmap by weekday

---

## 6) Data Model (Supabase)

games
- game_id pk, date, home, away, rest_home, rest_away, b2b_home, b2b_away, tz, created_at

starts
- game_id, team, goalie_id, p_start, confirmed_at, updated_at

team_strength
- team, date, state, xgf60, xga60, cf60, ca60, pp_xgf60, pk_xga60, pace, elo_o, elo_d, updated_at
- state in {5v5, PP, PK}

player_rates
- player_id, date, ixg60_5v5, ixg60_pp, isf60, a1_60, a2_60, hits60, blks60, fow60, fol60, toi_5v5, toi_pp, toi_pk, line, pp_unit, status, updated_at

projections
- game_id, player_id, stat, mean, var, p_any, context_json, model_version, created_at

window_summaries
- player_id, start_date, end_date, mode, fpts_mean, p25, p75, leverage, tags, created_at

scoring_profiles
- profile_id pk, user_id, mode, weights_json, categories_json, params_json  includes τ and clip bounds

predictions and outcomes as above; rank_decisions for analysis

Indexes: by date, by player_id plus date, by team plus date

---

## 7) API Surface (Next.js)

GET /api/v1/schedule?days=14
- Returns upcoming games with rest and B2B flags

GET /api/v1/players/rates?since=YYYY-MM-DD&tau=30
- Returns decay-blended rates and usage

GET /api/v1/projections?window=7&profile={id}&mode=points
- Returns per-player per-game projections and window aggregates

GET /api/v1/rankings?window=7&mode=points&position=C
- Returns ranked list by position with fPts or VORP and tags

POST /api/v1/scoring-profiles
- Create or update profile with weights and params

GET /api/v1/metrics/rolling?days=30
- Returns rolling error metrics by stat

All endpoints accept league parameters: teams, slots_json, bench_slots

---

## 8) UI Requirements

Start Chart columns by position
- Rank, Name, Team, Games, fPts or VORP, P25–P75, Off-night, PP1, Line, Notes

Controls
- Horizon 7 or 14 days
- Recency τ slider 15, 30, 60
- Mode toggle Points or Categories
- Include peripherals toggle
- Risk preference: mean vs P75 ranking
- League profile selector

Explainability tooltip
- Example: plus 12 percent week; 4 games; PP1; opponents PK 24th; opposing goalie cluster below league SV average

---

## 9) Non-functional Requirements

- Deterministic outputs for given inputs and model_version
- Full audit trail from inputs to predictions and outcomes
- P95 endpoint latency under 4s for 100 players over 7 days
- Graceful handling of missing data with league priors and clipping
- Feature flags for model versions and modes

---

## 10) Constants and Clips

- Clip 5v5 defense multiplier in [0.75, 1.25]
- Clip PK defense multiplier in [0.75, 1.30]
- Goalie finishing multiplier in [0.80, 1.20]
- Default τ = 30 days
- Elo K: 8 early, 4 mid, 2 late season per state
- H home advantage and R rest and B b2b coefficients tuned via cross-validated grid

---

## 11) Risks and Mitigations

- Early-season small samples: stronger priors and lower K in Elo
- Line volatility: hysteresis on PP and line changes; require sustained shifts
- Overfitting to streaks: cap τ minimums; blend with career medians when sample thin
- Bench conflict misestimation: calibrate with observed start logs per weekday

---

## 12) Priority Plan (Foundation to MVP)

F0 Foundations
1. Create Supabase schema for games, team_strength, player_rates, starts, scoring_profiles, projections, window_summaries, predictions, outcomes.
2. Ingest schedule for next 14 days; compute rest and B2B flags and time zones.
3. Ingest team rolling state-split metrics and compute league baselines.
4. Ingest skater rates and usage including PP unit and lines.
5. Ingest goalie recent stats and confirmations; compute starter shares.

F1 Core Math
6. Implement exponential decay blending for all per-60 rates with user τ.
7. Implement opponent multipliers M_def_5v5 and M_pk with clipping.
8. Implement goalie finishing multiplier M_goalie_finish using projected SV%.
9. Build per-game λ for G, A, SOG, peripherals with a TOI trend proxy.

F2 Window and Scoring
10. Aggregate per-game to window totals for 7 and 14 days.
11. Implement off-night bench adjustment using expected capacity factors.
12. Implement Points mode: fPts equals sum of weights times adjusted stats.

F3 Rankings and API
13. Build projections and rankings endpoints with validation and profile support.
14. Implement Start Chart UI basics: position tabs, rank, fPts, off-night, PP1, line.

F4 Evaluation Loop (MVP complete at end of F4)
15. Persist predictions with model_version; capture outcomes post-game.
16. Compute MAE and MAPE; expose rolling metrics endpoint and simple dashboard.

F5 Enhancements
17. Goalie start probability model and integration into per-game context.
18. Team offense and defense Elo by state updated using xG differential.
19. Categories mode including per-position replacement, Z-scores, VORP and VONA.
20. Monte Carlo simulation for P25 and P75 confidence bands.
21. Decision analytics for start-vs-replacement gain and win rate.

---

## 13) Example Utilities (TypeScript-like pseudocode)

    function decayBlend(samples, tau = 30):
      weights = samples.map(s => exp(-s.daysAgo / tau))
      numerator = sum over i of samples[i].value * weights[i]
      denominator = max(sum over i of weights[i], 1e-9)
      return numerator / denominator

    function clip(x, lo, hi):
      return min(hi, max(lo, x))

    function opponentMultipliers(opp, league):
      M5 = clip(opp.xGA60_5v5 / league.xGA60_5v5, 0.75, 1.25)
      MPK = clip(opp.pk_xGA60 / league.pk_xGA60, 0.75, 1.30)
      return { M5, MPK }

    function goalieFinishMult(sv_proj, league_SV):
      return clip(1 - (sv_proj - league_SV) / 0.070, 0.80, 1.20)

    function projectSkaterGame(p, ctx):
      { M5, MPK } = opponentMultipliers(ctx.opp, ctx.league)
      Mgoalie = goalieFinishMult(ctx.oppGoalie.sv_proj, ctx.league.SV)
      toi5 = p.toi5_pred
      toipp = p.toipp_pred
      lambdaG = (p.ixg60_5v5 / 60) * toi5 * M5 * Mgoalie + (p.ixg60_pp / 60) * toipp * MPK * Mgoalie
      lambdaA = (p.xgf_on60_5v5 / 60) * toi5 * M5 * p.astShare5 + (p.xgf_on60_pp / 60) * toipp * MPK * p.astSharePP
      lambdaS = (p.isf60_total / 60) * (toi5 + toipp) * ((M5 + MPK) / 2)
      return { G: { mean: lambdaG }, A: { mean: lambdaA }, S: { mean: lambdaS } }

---

## 14) Acceptance Criteria

- Seeded data returns rankings from GET rankings with window and position parameters including fPts or VORP and off-night values
- Predictions written for today’s games; outcomes captured; rolling metrics endpoint returns MAE and MAPE
- Deterministic results given same inputs and model_version
- Basic Start Chart UI renders with interactive controls and tooltips

---



