You are GPT-5 Codex. Implement the Start Chart DAILY MVP exactly as specified.

Title
Start Chart — Daily Fantasy Hockey Start/Sit Rankings

Objective
Compute and rank short-horizon (single-date) player projections driven by decay-weighted trends, opponent/goalie context, and user scoring. No off-night or bench-capacity adjustments; rankings are for a chosen date only.

Inputs and Inventory
- Supabase schemas are described in 'supabase-table-structure.md' and include: games, wgo_skater_stats(_totals), wgo_goalie_stats(_totals), nst_gamelog_as_rates/_counts (+ _oi and per-state variants), nst_team_5v5, nst_team_pp, nst_team_pk, nst_team_all, lineCombinations, powerPlayCombinations, players, yahoo_*.
- Assume nst.player_id equals NHL id and is consistent with wgo_* for joins.

Deliverables
1) Supabase migrations (db/migrations)
   - Table 'starts' with columns: game_id bigint fk games.id; team_abbrev text; goalie_id bigint; status text default 'projected' (enum-like: projected, probable, confirmed); p_start numeric default 0.50; source text; confirmed_at timestamptz; updated_at timestamptz default now(); unique (game_id, team_abbrev).
   - Table 'scoring_profiles' with profile_id uuid pk, user_id, mode ('points'|'categories'), weights_json (points weights), categories_json (optional), params_json (tau, clips, risk), created_at/updated_at.
   - Table 'model_params' with model_version text pk, params_json jsonb, created_at timestamptz.
   - Useful indexes on games(date), wgo_skater_stats(player_id,date), wgo_goalie_stats(goalie_id,date).
   - Optional 'dim_player_ids' future-proof crosswalk (skip if not needed now).

2) Derived views (create as SQL views or materialized views; place SQL in db/sql)
   - vw_schedule_day(date_param): expand 'games' into team-rows for the target date with columns [team_abbrev, opp_abbrev, game_id, game_date, home_away, rest_days, b2b_flag]. Compute rest/b2b via previous game for each team.
   - vw_team_strength_state_daily: union of nst_team_5v5, nst_team_pp, nst_team_pk standardized to per-60; columns [team_abbrev, date, state in {5v5, PP, PK}, xgf60, xga60, cf60, ca60, scf60, sca60, hdcf60, hdca60, sf60, sa60]. If missing on a date, backfill from nearest prior date; fallback to season in nst_team_stats.
   - vw_pp_unit_share_recent: from powerPlayCombinations unnest to per-player rows; 10–15 game window to compute p_pp1 (fraction PP1), pp_share_recent, pp_toi60_recent.
   - vw_skater_rates_state_recent(tau_days): decay-blended per-60: ixg60_5v5, isf60_5v5, a1_60_5v5, a2_60_5v5; ixg60_pp, isf60_pp, a1_60_pp, a2_60_pp; hits60, blocks60, pim60, fow60, fol60; xgf_on60_5v5, xga_on60_5v5 from _oi tables. Weights w_i = exp(-Δdays/τ).
   - vw_player_usage_recent(tau_days): decay-blended TOI by state (toi5_recent, toipp_recent, toipk_recent), d_atoi10, modal line_role from lineCombinations over recent games, p_pp1 from vw_pp_unit_share_recent.
   - vw_goalie_recent(tau_days): sv_proj from 7/14/40 using inverse-variance or exp blend; sa60_proj; starts_share_30d.
   - vw_opponent_multipliers(date): join vw_team_strength_state_daily for each team vs opponent on date; compute M_def_5v5 = clip(xga60_opp_5v5/L_xGA60_5v5, 0.75, 1.25), M_pk = clip(xga60_opp_pk/L_xGA60_pk, 0.75, 1.30). League baselines come from model_params.params_json (xga60_5v5, xga60_pk, sv_league).
   - vw_skater_game_lambda(date, tau_days): for each (player_id, game_id) on the date, compute λ means:
       toi5 = toi5_recent adjusted by d_atoi10 and line_role
       toipp = toipp_recent scaled by p_pp1 share
       M5, MPK from vw_opponent_multipliers; Mgoalie = clip(1 - (sv_proj_opp - L_SV)/0.070, 0.80, 1.20)
       λ_G = (ixg60_5v5/60)*toi5*M5*Mgoalie + (ixg60_pp/60)*toipp*MPK*Mgoalie
       λ_A = (xgf_on60_5v5/60)*toi5*M5*AssistShare5 + (xgf_on60_pp/60)*toipp*MPK*AssistSharePP
       λ_S = (isf60_total/60)*(toi5+toipp)*avg(M5,MPK)
       λ_peripherals = (rate60/60)*relevant_TOI
     Use Poisson by default; if recent Fano > 1.25 for a stat, use NegBin with fitted r.

3) Ingestion jobs (jobs/)
   - Nightly: refresh nst_team_* by state; compute and store league baselines in model_params (xga60_5v5, xga60_pk, sv_league, on_ice_sh_pct_5v5, per-pos means/stds).
   - Nightly: refresh skater gamelogs and goalie stats; update pp and lines from powerPlayCombinations and lineCombinations.
   - Hourly (game days): refresh starts with heuristic P_start if no confirmation:
       P_start = 0.75*recent_start_share_14d - 0.15*b2b_penalty + 0.05*home_bonus - 0.10*poor_form_penalty; clip to [0.05,0.95]; status='projected'. Provide manual override path (UI).

4) Math utilities (src/lib/)
   - decayBlend(samples, tauDays), ewsd(samples, tauDays), slope(lastN), shrinkage(s_recent, s_career, k), clip(x, lo, hi), goalieFinishMult(sv_proj, league_SV).
   - NegBin fitter for overdispersed stats; Fano detector.

5) Next.js API (src/pages/api/)
   - GET /api/v1/projections?date=YYYY-MM-DD&profile={id}&mode=points
       Returns per-player λ and projected counts for that date; also fPts (points mode).
   - GET /api/v1/rankings?date=YYYY-MM-DD&mode=points&position=C
       Returns ranked players for the date with fPts; include M5, MPK, p_pp1, line_role, opponent goalie sv_proj.
   - GET /api/v1/players/rates?since=YYYY-MM-DD&tau=30
       Returns decay-blended rates and usage.
   - GET /api/v1/metrics/rolling?days=30
       Returns rolling MAE/MAPE by stat.
   All accept league parameters and scoring profile id. Validate inputs.

6) Minimal UI (src/app/)
   - Daily Start Chart: date picker default today; tabs by position; columns: Rank, Name, Team, Opp, Goalie, Games(=1), fPts or VORP (categories later), PP1, Line, tags for 'hot/cold' and 'tough goalie'.
   - Controls: date, τ (15/30/60), mode toggle (points now; categories later), scoring profile selector, risk toggle (mean vs P75 when implemented).
   - Explainability tooltip: show key drivers (usage change, PP1 prob, opponent PK rank, opposing SV proj).

7) Metrics & Logging
   - predictions table: game_id, player_id, stat, mean, variance, p_any, model_version, context_json, created_at.
   - outcomes table: game_id, player_id, stat, actual, created_at.
   - metrics endpoint computes rolling MAE/MAPE; later CRPS/Brier optional.

Computation Details
- No off-night or bench-capacity factors; everyone is ranked on the same date’s slate.
- Recency smoothing uses exponential weights w_i = exp(-Δdays/τ), default τ=30 days (configurable via scoring profile params_json or model_params).
- Opponent multipliers and goalie suppression as specified above with clips.
- Forwards vs Defensemen: use position-specific priors and elasticities (β_pp higher for D quarterbacking, β_finish lower for D). Store elasticities in model_params.
- Small-sample shrinkage to career/archetype priors: s_hat = (n_eff/(n_eff+k))*s_recent + (k/(n_eff+k))*s_career where n_eff = Σw_i.

Constraints
- Exclude altitude effects.
- Deterministic outputs given same inputs and model_version.
- P95 latency under 4 seconds for 100 players on the chosen date.
- Graceful handling of missing data via league priors and clipping.

Tests (src/tests/)
- Unit tests for math utilities (decayBlend, ewsd, slope, shrinkage, goalieFinishMult).
- Contract tests for /projections and /rankings responses (schema, determinism).
- Snapshot test for a seeded date slate.

Acceptance
- Rankings endpoint returns deterministic order and values for a seeded date using a fixed model_version.
- Predictions and outcomes logged; metrics endpoint returns rolling MAE/MAPE.
- UI renders a daily position view with ranks, values, PP1 and line chips, and opponent/goalie context.
- Lints and tests pass; TypeScript clean.

Execution Order (priority)
1. Migrations: starts, scoring_profiles, model_params; indexes.
2. Views: vw_schedule_day, vw_team_strength_state_daily.
3. Views: vw_pp_unit_share_recent, vw_player_usage_recent, vw_skater_rates_state_recent.
4. Views: vw_goalie_recent, vw_opponent_multipliers, vw_skater_game_lambda.
5. Math utils; endpoints /projections and /rankings for a given date.
6. Minimal UI (daily chart); metrics logging; rolling metrics endpoint.
7. Heuristic P_start job; manual override UI for starts; polish.

Environment and Constants
- Store clip bounds, τ defaults, elasticities, league baselines in model_params.params_json and expose as constants.
- Provide SCORING_PROFILE_DEFAULT with common points weights; allow user override via scoring_profiles.

Begin now by generating:
- SQL migrations for starts, scoring_profiles, model_params and initial indexes.
- SQL for vw_schedule_day and vw_team_strength_state_daily.
- TypeScript modules for math utilities and API route scaffolds for /projections and /rankings with input validation.