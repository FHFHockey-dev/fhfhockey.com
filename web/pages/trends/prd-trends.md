# Trends Sandbox PRD

## Context & Goal
- Build Sustainability KPI Overview (SKO) for NHL skaters detecting and predicting HOT/COLD streak onsets.
- Training window: 2021-22 to 2023-24 seasons; 2024-25 reserved for hold-out validation.
- Visual analytics delivered through `/trends` D3 notebook interface (legacy alias `/trendsSandbox`).

## Key Deliverables
1. Data contracts for SKO endpoints (baseline, player time series, evaluation summaries).
2. Supabase SQL artifacts: training moments materialized view, per-game EB z-scores, SKO scoring view, streak RPC.
3. SKO statistical framework (features, robust standardization, ridge weights, thresholds, detection rules).
4. HOT/COLD onset prediction models (logistic + tree baseline) with evaluation harness outputs.
5. Frontend `/trends` (legacy alias `/trendsSandbox`) D3 notebook experience with cells A–H and top controls.
6. Evaluation harness generating calibration, PR, threshold JSON for validation cells and barometer.

## Current Status (2025-03-12)
- ✅ Initial cross-functional specification draft prepared (Sections 1–6 deliverable).
- ✅ Folder `/pages/trends/` created and PRD initialized for ongoing tracking.
- ✅ `/trends` sandbox page scaffolded (alias `/trendsSandbox`) with D3 Cell A (baseline) and Cell B (time-series) mock data visualizations.
- ✅ Mock HTTP endpoint `/api/trends/skaters/[playerId]` returns deterministic player series for UI development.
- ✅ Supabase materialized view `analytics.mv_sko_skater_moments` rebuilt with non-zero league filters for on-ice shooting and shooting percentage.
- ✅ Supabase base view `analytics.vw_sko_skater_base` joins WGO + NST gamelog tables in preparation for z-score pipeline.
- ✅ RPC skeleton `analytics.rpc_sko_player_series` defined (index creation removed per view limitations).
- ⏳ Refresh `vw_sko_skater_zscores` and `vw_sko_skater_scores` to consume new helper view.
- ⏳ Model prototyping pending feature extraction pipeline.
- ⏳ Frontend scaffold requires integration with actual API endpoints once ready.

## Recent Updates
- Documented planner guardrails, statistical procedures, SQL artifacts, frontend scaffold, evaluation plan, and UX design blueprint in first design package.
- Established default hyperparameters (λ=1.8 HOT, 1.6 COLD; EWMA span=5; L=2 HOT, 3 COLD) for validation.
- Implemented interactive mock `/trends` page (controls, baseline violin, time-series ribbons) using deterministic fixture data for Cells A & B.
- Frontend `/trends` page now loads player data via the new API route and surfaces loading/error banners.
- Added Supabase helper view `analytics.vw_sko_skater_base` to merge WGO boxscore rows with NST xG metrics and handle missing `game_id` values.
- Updated `analytics.mv_sko_skater_moments` to exclude zero-only games from league medians/MADs for on-ice shooting and personal shooting percentage.
- Created PL/pgSQL RPC `analytics.rpc_sko_player_series` (minus view index) to serve JSON baselines/EWMA once z-score view is refreshed.

## Next Steps
1. Confirm availability of required columns in `wgo_skater_stats` and related NST tables; adjust feature list if needed (in progress).
2. **Refresh** and validate `analytics.vw_sko_skater_zscores` to consume the new joint base view; re-create `analytics.vw_sko_skater_scores` on top of it.
3. Unit-test EB shrinkage math and RPC output against sample players; document any missing NST coverage.
4. Prototype ridge regression for SKO weights using Python notebook; store coefficients in config table.
5. Define API routes in Next.js (or Supabase Edge Functions) matching data contracts; prepare mock responses.
6. Wire `/trends` page to real API once contracts stabilized; replace deterministic fixtures with fetched data.
7. Connect UI controls (player select, season toggle, train/test) to live data-fetch layer once endpoints land.
8. Implement evaluation harness script and schedule nightly job to refresh 2024-25 metrics.
9. Swap mock API implementation for Supabase-backed queries after analytics views materialize and RPC verified.

## Open Questions
- Best data source for injury/return indicators if not present in Supabase tables?
- Should SKO weights diverge for forwards vs defense or add position interaction terms?
- How to represent travel fatigue without external distance dataset?

## Decision Log
- 2025-09-21: Adopt robust median/MAD baselines with EB shrinkage (κ=30) and tanh-bounded SKO.
- 2025-09-21: Default λ, L, EWMA span as per spec; to be revisited after validation results.

## Owners
- Product / Coordination: Tim
- Data Engineering: TBD (Supabase views & RPCs)
- Data Science / Modeling: TBD (ridge, logistic, tree, evaluation harness)
- Frontend / D3: TBD (sandbox implementation)
- UX: TBD (notebook interaction design)

## Reporting
- Weekly sync every Monday with summary posted to `/pages/trends/prd-trends.md`.
- Discord channel `#trends` hosts daily asynchronous status updates.

## Hand-off Prompt
You are taking over the fhfhockey SKO trends project. Current state: frontend sandbox `/trends` renders Cells A/B with mock data from `/api/trends/skaters/[playerId]`. On the data side, `analytics.mv_sko_skater_moments` is materialized (league medians avoid zero-only distortions) and helper view `analytics.vw_sko_skater_base` is ready to stitch WGO with NST gamelog xG. The RPC skeleton `analytics.rpc_sko_player_series` is defined but depends on a refreshed z-score view.

Next steps for you:
1. Rebuild `analytics.vw_sko_skater_zscores` to pull from `analytics.vw_sko_skater_base`, ensuring shrinkage math covers new columns (`ixg`, `ixg_per_60`). Validate sample output (player/date ordering, null handling).
2. Recreate `analytics.vw_sko_skater_scores` and rerun `analytics.rpc_sko_player_series` to confirm JSON payload matches the frontend contract. Add unit queries for a couple of players across seasons.
3. Replace the Next.js mock API implementation with live Supabase fetches. Update `/trends` to use SWR or React Query, wire season/player controls, and handle loading states.

Context you may need: NST tables (`nst_gamelog_as_counts`/`rates`) have no `game_id`; join on `(player_id, date)` and fall back to synthetic ordering when missing. League medians intentionally ignore zero-only games for ratio metrics; keep that logic. Model training and evaluation harness still to come after data extracts are stable.

Deliverables expected from you: refreshed SQL artifacts, validated RPC output, frontend wiring to live data, and an updated PRD reflecting these changes.


### SQL TABLES

#### `analytics.mv_sko_skater_moments`
```sql
 WITH base AS (
         SELECT ws.player_id,
            COALESCE(ws.position_code, 'F'::text) AS position_code,
            COALESCE(ws.season_id::bigint, g."seasonId") AS season_id,
            ws.shots,
            ws.toi_per_game,
            ws.pp_toi_per_game,
            ws.o_zone_fo_percentage,
            ws.on_ice_shooting_pct,
            ws.shooting_percentage
           FROM wgo_skater_stats ws
             LEFT JOIN games g ON g.id = ws.game_id
          WHERE COALESCE(ws.season_id::bigint, g."seasonId") = ANY (ARRAY[20212022::bigint, 20222023::bigint, 20232024::bigint])
        ), player_medians AS (
         SELECT base.player_id,
            base.position_code,
            count(*) AS n_games,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (base.shots::double precision)) AS shots_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY base.toi_per_game) AS toi_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY base.pp_toi_per_game) AS pp_toi_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY base.o_zone_fo_percentage) AS ozfo_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY base.on_ice_shooting_pct) AS onice_sh_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY base.shooting_percentage) AS shooting_pct_med
           FROM base
          GROUP BY base.player_id, base.position_code
        ), player_mads AS (
         SELECT b.player_id,
            b.position_code,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.shots::double precision - pm_1.shots_med))) AS shots_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.toi_per_game - pm_1.toi_med))) AS toi_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.pp_toi_per_game - pm_1.pp_toi_med))) AS pp_toi_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.o_zone_fo_percentage - pm_1.ozfo_med))) AS ozfo_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.on_ice_shooting_pct - pm_1.onice_sh_med))) AS onice_sh_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.shooting_percentage - pm_1.shooting_pct_med))) AS shooting_pct_mad_raw
           FROM base b
             JOIN player_medians pm_1 USING (player_id, position_code)
          GROUP BY b.player_id, b.position_code
        ), league_base AS (
         SELECT base.position_code,
            base.shots,
            base.toi_per_game,
            base.pp_toi_per_game,
            base.o_zone_fo_percentage,
            NULLIF(base.on_ice_shooting_pct, 0::double precision) AS onice_sh_for_league,
            NULLIF(base.shooting_percentage, 0::double precision) AS shooting_pct_for_league
           FROM base
        ), league_medians AS (
         SELECT league_base.position_code,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (league_base.shots::double precision)) AS shots_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.toi_per_game) AS toi_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.pp_toi_per_game) AS pp_toi_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.o_zone_fo_percentage) AS ozfo_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.onice_sh_for_league) AS onice_sh_med,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY league_base.shooting_pct_for_league) AS shooting_pct_med
           FROM league_base
          GROUP BY league_base.position_code
        ), league_mads AS (
         SELECT b.position_code,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.shots::double precision - lm_1.shots_med))) AS shots_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.toi_per_game - lm_1.toi_med))) AS toi_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.pp_toi_per_game - lm_1.pp_toi_med))) AS pp_toi_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.o_zone_fo_percentage - lm_1.ozfo_med))) AS ozfo_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.onice_sh_for_league - lm_1.onice_sh_med))) AS onice_sh_mad_raw,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (abs(b.shooting_pct_for_league - lm_1.shooting_pct_med))) AS shooting_pct_mad_raw
           FROM league_base b
             JOIN league_medians lm_1 USING (position_code)
          GROUP BY b.position_code
        )
 SELECT pm.player_id,
    pm.position_code,
    pm.n_games,
    pm.shots_med,
    1.4826::double precision * pmad.shots_mad_raw AS shots_mad,
    pm.toi_med,
    1.4826::double precision * pmad.toi_mad_raw AS toi_mad,
    pm.pp_toi_med,
    1.4826::double precision * pmad.pp_toi_mad_raw AS pp_toi_mad,
    pm.ozfo_med,
    1.4826::double precision * pmad.ozfo_mad_raw AS ozfo_mad,
    pm.onice_sh_med,
    1.4826::double precision * pmad.onice_sh_mad_raw AS onice_sh_mad,
    pm.shooting_pct_med,
    1.4826::double precision * pmad.shooting_pct_mad_raw AS shooting_pct_mad,
    lm.shots_med AS league_shots_med,
    1.4826::double precision * lmad.shots_mad_raw AS league_shots_mad,
    lm.toi_med AS league_toi_med,
    1.4826::double precision * lmad.toi_mad_raw AS league_toi_mad,
    lm.pp_toi_med AS league_pp_toi_med,
    1.4826::double precision * lmad.pp_toi_mad_raw AS league_pp_toi_mad,
    lm.ozfo_med AS league_ozfo_med,
    1.4826::double precision * lmad.ozfo_mad_raw AS league_ozfo_mad,
    lm.onice_sh_med AS league_onice_sh_med,
    1.4826::double precision * lmad.onice_sh_mad_raw AS league_onice_sh_mad,
    lm.shooting_pct_med AS league_shooting_pct_med,
    1.4826::double precision * lmad.shooting_pct_mad_raw AS league_shooting_pct_mad
   FROM player_medians pm
     JOIN player_mads pmad USING (player_id, position_code)
     JOIN league_medians lm USING (position_code)
     JOIN league_mads lmad USING (position_code);
```

#### `analytics.vw_sko_skater_base`
```sql
 SELECT ws.player_id,
    COALESCE(ws.position_code, 'F'::text) AS position_code,
    COALESCE(ws.season_id, nc.season) AS season_id,
    ws.game_id,
    ws.date,
    ws.shots,
    ws.toi_per_game,
    ws.pp_toi_per_game,
    ws.o_zone_fo_percentage,
    ws.on_ice_shooting_pct,
    ws.shooting_percentage,
    nc.ixg,
    nr.ixg_per_60
   FROM wgo_skater_stats ws
     LEFT JOIN nst_gamelog_as_counts nc ON nc.player_id = ws.player_id AND nc.date_scraped = ws.date
     LEFT JOIN nst_gamelog_as_rates nr ON nr.player_id = ws.player_id AND nr.date_scraped = ws.date;
```

#### `analytics.rpc_sko_player_series`
```sql
create function analytics.rpc_sko_player_series(
    p_player_id bigint,
    p_span integer default 5,
    p_lambda_hot numeric default 1.8,
    p_lambda_cold numeric default 1.6,
    p_L_hot integer default 2,
    p_L_cold integer default 3
) returns jsonb
language plpgsql
as $$
declare
    alpha numeric := 2::numeric / (p_span + 1);
    mu0 numeric;
    sigma0 numeric;
    n_train integer;
    payload jsonb;
begin
    select
        percentile_cont(0.5) within group (order by sko),
        1.4826 * percentile_cont(0.5) within group (order by abs(sko - percentile_cont(0.5) within group (order by sko))),
        count(*)
    into mu0, sigma0, n_train
    from analytics.vw_sko_skater_scores
    where player_id = p_player_id
      and season_id in (20212022, 20222023, 20232024);

    with ordered as (
        select
            s.*,
            row_number() over (order by date, game_id nulls last) as rn
        from analytics.vw_sko_skater_scores s
        where s.player_id = p_player_id
        order by date, game_id
    ), ewma as (
        select
            o.rn,
            o.game_id,
            o.date,
            o.sko,
            o.sko_raw,
            o.shots_z,
            o.ixg_z,
            o.ixg_per_60_z,
            o.toi_z,
            o.pp_toi_z,
            o.ozfo_z,
            o.onice_sh_z,
            o.shooting_pct_z,
            o.sko as ewma
        from ordered o
        where o.rn = 1
        union all
        select
            o.rn,
            o.game_id,
            o.date,
            o.sko,
            o.sko_raw,
            o.shots_z,
            o.ixg_z,
            o.ixg_per_60_z,
            o.toi_z,
            o.pp_toi_z,
            o.ozfo_z,
            o.onice_sh_z,
            o.shooting_pct_z,
            alpha * o.sko + (1 - alpha) * e.ewma as ewma
        from ordered o
        join ewma e on o.rn = e.rn + 1
    ), flags as (
        select
            e.*,
            case when e.ewma - mu0 >= p_lambda_hot * sigma0 then 1 else 0 end as hot_flag,
            case when mu0 - e.ewma >= p_lambda_cold * sigma0 then 1 else 0 end as cold_flag
        from ewma e
    ), streaks as (
        select
            f.*,
            case when hot_flag = 1 and lag(hot_flag, p_L_hot - 1, 0) over (order by rn) = 1 then 1 else 0 end as hot_start,
            case when cold_flag = 1 and lag(cold_flag, p_L_cold - 1, 0) over (order by rn) = 1 then 1 else 0 end as cold_start
        from flags f
    ), labeled as (
        select
            s.*,
            sum(hot_start) over (order by rn) as hot_streak_id,
            sum(cold_start) over (order by rn) as cold_streak_id
        from streaks s
    )
    select jsonb_build_object(
        'player_id', p_player_id,
        'baseline', jsonb_build_object(
            'mu0', mu0,
            'sigma0', sigma0,
            'n_train', coalesce(n_train, 0)
        ),
        'series', jsonb_agg(
            jsonb_build_object(
                'game_id', game_id,
                'date', date,
                'sko', sko,
                'sko_raw', sko_raw,
                'ewma', ewma,
                'hot_flag', hot_flag,
                'cold_flag', cold_flag,
                'hot_streak_id', nullif(hot_streak_id, 0),
                'cold_streak_id', nullif(cold_streak_id, 0),
                'features', jsonb_build_object(
                    'shots_z', shots_z,
                    'ixg_z', ixg_z,
                    'ixg_per_60_z', ixg_per_60_z,
                    'toi_z', toi_z,
                    'pp_toi_z', pp_toi_z,
                    'oz_fo_pct_z', ozfo_z,
                    'onice_sh_pct_z', onice_sh_z,
                    'shooting_pct_z', shooting_pct_z
                )
            ) order by rn
        )
    )
    into payload
    from labeled;

    return payload;
end;
$$;
```

#### `analytics.vw_sko_skater_zscores`
```sql
 WITH constants AS (
         SELECT 30.0 AS kappa
        ), league AS (
         SELECT DISTINCT ON (mv_sko_skater_moments.position_code) mv_sko_skater_moments.position_code,
            mv_sko_skater_moments.league_shots_med,
            mv_sko_skater_moments.league_shots_mad,
            mv_sko_skater_moments.league_toi_med,
            mv_sko_skater_moments.league_toi_mad,
            mv_sko_skater_moments.league_pp_toi_med,
            mv_sko_skater_moments.league_pp_toi_mad,
            mv_sko_skater_moments.league_ozfo_med,
            mv_sko_skater_moments.league_ozfo_mad,
            mv_sko_skater_moments.league_onice_sh_med,
            mv_sko_skater_moments.league_onice_sh_mad,
            mv_sko_skater_moments.league_shooting_pct_med,
            mv_sko_skater_moments.league_shooting_pct_mad
           FROM analytics.mv_sko_skater_moments
        )
 SELECT b.player_id,
    b.position_code,
    b.season_id,
    COALESCE(b.game_id, row_number() OVER (PARTITION BY b.player_id ORDER BY b.date)) AS game_id,
    b.date,
    b.shots,
    b.ixg,
    b.ixg_per_60,
    b.toi_per_game,
    b.pp_toi_per_game,
    b.o_zone_fo_percentage,
    b.on_ice_shooting_pct,
    b.shooting_percentage,
    m.n_games,
    m.n_games::numeric / (m.n_games::numeric + c.kappa) AS w_player,
    c.kappa / (m.n_games::numeric + c.kappa) AS w_league,
    (b.shots::double precision - ((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.shots_med + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_shots_med)) / NULLIF((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.shots_mad + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_shots_mad, 0::double precision) AS shots_z,
    (b.ixg - ((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.shots_med + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_shots_med)) / NULLIF((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.shots_mad + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_shots_mad, 0::double precision) AS ixg_z,
    (b.ixg_per_60::double precision - ((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.shots_med + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_shots_med)) / NULLIF((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.shots_mad + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_shots_mad, 0::double precision) AS ixg_per_60_z,
    (b.toi_per_game - ((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.toi_med + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_toi_med)) / NULLIF((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.toi_mad + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_toi_mad, 0::double precision) AS toi_z,
    (b.pp_toi_per_game - ((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.pp_toi_med + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_pp_toi_med)) / NULLIF((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.pp_toi_mad + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_pp_toi_mad, 0::double precision) AS pp_toi_z,
    (b.o_zone_fo_percentage - ((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.ozfo_med + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_ozfo_med)) / NULLIF((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.ozfo_mad + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_ozfo_mad, 0::double precision) AS ozfo_z,
    (b.on_ice_shooting_pct - ((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.onice_sh_med + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_onice_sh_med)) / NULLIF((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.onice_sh_mad + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_onice_sh_mad, 0::double precision) AS onice_sh_z,
    (b.shooting_percentage - ((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.shooting_pct_med + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_shooting_pct_med)) / NULLIF((m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision * m.shooting_pct_mad + (c.kappa / (m.n_games::numeric + c.kappa))::double precision * l.league_shooting_pct_mad, 0::double precision) AS shooting_pct_z
   FROM analytics.vw_sko_skater_base b
     JOIN analytics.mv_sko_skater_moments m ON m.player_id = b.player_id
     JOIN league l ON l.position_code = m.position_code
     CROSS JOIN constants c;
```

#### `analytics.vw_sko_skater_scores`
```sql
 SELECT z.player_id,
    z.position_code,
    z.season_id,
    z.game_id,
    z.date,
    z.shots_z,
    z.ixg_z,
    z.ixg_per_60_z,
    z.toi_z,
    z.pp_toi_z,
    z.ozfo_z,
    z.onice_sh_z,
    z.shooting_pct_z,
    '-0.03'::numeric::double precision + 0.24::double precision * COALESCE(z.shots_z, 0::double precision) + 0.28::double precision * COALESCE(z.ixg_z, 0::double precision) + 0.13::double precision * COALESCE(z.ixg_per_60_z, 0::double precision) + 0.09::double precision * COALESCE(z.toi_z, 0::double precision) + 0.07::double precision * COALESCE(z.pp_toi_z, 0::double precision) + 0.09::double precision * COALESCE(z.ozfo_z, 0::double precision) - 0.06::double precision * COALESCE(z.onice_sh_z, 0::double precision) - 0.05::double precision * COALESCE(z.shooting_pct_z, 0::double precision) AS sko_raw,
    tanh('-0.03'::numeric::double precision + 0.24::double precision * COALESCE(z.shots_z, 0::double precision) + 0.28::double precision * COALESCE(z.ixg_z, 0::double precision) + 0.13::double precision * COALESCE(z.ixg_per_60_z, 0::double precision) + 0.09::double precision * COALESCE(z.toi_z, 0::double precision) + 0.07::double precision * COALESCE(z.pp_toi_z, 0::double precision) + 0.09::double precision * COALESCE(z.ozfo_z, 0::double precision) - 0.06::double precision * COALESCE(z.onice_sh_z, 0::double precision) - 0.05::double precision * COALESCE(z.shooting_pct_z, 0::double precision)) AS sko
   FROM analytics.vw_sko_skater_zscores z;
```

