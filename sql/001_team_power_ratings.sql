-- 001_team_power_ratings.sql
-- Materialized view and refresh helpers for Team Power Rankings.
-- This script builds daily offense/defense/pace indices, PP/PK tiers, and trend metrics.


DROP MATERIALIZED VIEW IF EXISTS public.team_power_ratings_daily;

CREATE MATERIALIZED VIEW public.team_power_ratings_daily AS
WITH params AS (
    SELECT
        25::int AS lookback_games,
        10.0::numeric AS half_life_games,
        COALESCE(NULLIF(current_setting('team_power_mode', true), ''), 'all') AS mode_preference
),
source_union AS (
    -- Primary source: all-situation per-60 rates.
    SELECT
        g.team_abbreviation,
        g.date::date AS date,
        g.season_id,
        g.cf_per_60::numeric AS cf_per_60,
        g.ca_per_60::numeric AS ca_per_60,
        g.sf_per_60::numeric AS sf_per_60,
        g.sa_per_60::numeric AS sa_per_60,
        g.gf_per_60::numeric AS gf_per_60,
        g.ga_per_60::numeric AS ga_per_60,
        g.xgf_per_60::numeric AS xgf_per_60,
        g.xga_per_60::numeric AS xga_per_60,
        g.gp AS gp,
        g.toi_seconds::numeric AS toi_seconds,
        'all'::text AS data_mode
    FROM public.nst_team_gamelogs_as_rates g
    WHERE g.situation = 'all'

    UNION ALL

    -- Optional 5v5-only override.
    SELECT
        f.team_abbreviation,
        f.date::date AS date,
        g_all.season_id,
        CASE WHEN f.toi IS NOT NULL AND f.toi > 0 THEN (f.cf::numeric * 3600.0) / f.toi::numeric ELSE NULL END AS cf_per_60,
        CASE WHEN f.toi IS NOT NULL AND f.toi > 0 THEN (f.ca::numeric * 3600.0) / f.toi::numeric ELSE NULL END AS ca_per_60,
        CASE WHEN f.toi IS NOT NULL AND f.toi > 0 THEN (f.sf::numeric * 3600.0) / f.toi::numeric ELSE NULL END AS sf_per_60,
        CASE WHEN f.toi IS NOT NULL AND f.toi > 0 THEN (f.sa::numeric * 3600.0) / f.toi::numeric ELSE NULL END AS sa_per_60,
        CASE WHEN f.toi IS NOT NULL AND f.toi > 0 THEN (f.gf::numeric * 3600.0) / f.toi::numeric ELSE NULL END AS gf_per_60,
        CASE WHEN f.toi IS NOT NULL AND f.toi > 0 THEN (f.ga::numeric * 3600.0) / f.toi::numeric ELSE NULL END AS ga_per_60,
        CASE WHEN f.toi IS NOT NULL AND f.toi > 0 THEN (f.xgf::numeric * 3600.0) / f.toi::numeric ELSE NULL END AS xgf_per_60,
        CASE WHEN f.toi IS NOT NULL AND f.toi > 0 THEN (f.xga::numeric * 3600.0) / f.toi::numeric ELSE NULL END AS xga_per_60,
        f.gp AS gp,
        NULL::numeric AS toi_seconds,
        '5v5'::text AS data_mode
    FROM public.nst_team_5v5 f
    LEFT JOIN public.nst_team_gamelogs_as_rates g_all
      ON g_all.team_abbreviation = f.team_abbreviation
     AND g_all.date = f.date
     AND g_all.situation = 'all'
    WHERE f.situation = 'all'
),
base_games AS (
    SELECT
        s.team_abbreviation,
        s.date,
        s.season_id,
        s.cf_per_60,
        s.ca_per_60,
        s.sf_per_60,
        s.sa_per_60,
        s.gf_per_60,
        s.ga_per_60,
        s.xgf_per_60,
        s.xga_per_60,
        s.gp,
        s.toi_seconds,
        ((s.cf_per_60 + s.ca_per_60) / 2.0)::numeric AS pace_per_60
    FROM source_union s
    CROSS JOIN params p
    WHERE (p.mode_preference = '5v5' AND s.data_mode = '5v5')
       OR (p.mode_preference <> '5v5' AND s.data_mode = 'all')
),
team_games AS (
    SELECT
        b.*,
        ROW_NUMBER() OVER (PARTITION BY b.team_abbreviation, b.season_id ORDER BY b.date DESC) - 1 AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY b.team_abbreviation, b.season_id ORDER BY b.date ASC) AS gp_to_date
    FROM base_games b
),
ewma_metrics AS (
    SELECT
        cur.team_abbreviation,
        cur.date,
        cur.season_id,
        cur.gp_to_date,
        SUM(prev.xgf_per_60 * POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) /
            SUM(POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) AS xgf60_ewma,
        SUM(prev.gf_per_60 * POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) /
            SUM(POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) AS gf60_ewma,
        SUM(prev.sf_per_60 * POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) /
            SUM(POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) AS sf60_ewma,
        SUM(prev.xga_per_60 * POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) /
            SUM(POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) AS xga60_ewma,
        SUM(prev.ga_per_60 * POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) /
            SUM(POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) AS ga60_ewma,
        SUM(prev.sa_per_60 * POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) /
            SUM(POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) AS sa60_ewma,
        SUM(prev.pace_per_60 * POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) /
            SUM(POWER(0.5::numeric, ((prev.rn_desc - cur.rn_desc)::numeric) / p.half_life_games)) AS pace60_ewma
    FROM team_games cur
    CROSS JOIN params p
    JOIN team_games prev
      ON prev.team_abbreviation = cur.team_abbreviation
     AND prev.season_id = cur.season_id
     AND prev.rn_desc BETWEEN cur.rn_desc AND cur.rn_desc + (p.lookback_games - 1)
    GROUP BY cur.team_abbreviation, cur.date, cur.season_id, cur.gp_to_date
),
league_metric_daily AS (
    SELECT
        e.date,
        AVG(e.xgf60_ewma) AS league_xgf60_avg,
        STDDEV_SAMP(e.xgf60_ewma) AS league_xgf60_stddev,
        AVG(e.gf60_ewma) AS league_gf60_avg,
        STDDEV_SAMP(e.gf60_ewma) AS league_gf60_stddev,
        AVG(e.sf60_ewma) AS league_sf60_avg,
        STDDEV_SAMP(e.sf60_ewma) AS league_sf60_stddev,
        AVG(e.xga60_ewma) AS league_xga60_avg,
        STDDEV_SAMP(e.xga60_ewma) AS league_xga60_stddev,
        AVG(e.ga60_ewma) AS league_ga60_avg,
        STDDEV_SAMP(e.ga60_ewma) AS league_ga60_stddev,
        AVG(e.sa60_ewma) AS league_sa60_avg,
        STDDEV_SAMP(e.sa60_ewma) AS league_sa60_stddev,
        AVG(e.pace60_ewma) AS league_pace60_avg,
        STDDEV_SAMP(e.pace60_ewma) AS league_pace60_stddev
    FROM ewma_metrics e
    GROUP BY e.date
),
blended_metrics AS (
    SELECT
        e.team_abbreviation,
        e.date,
        e.season_id,
        e.gp_to_date,
        l.league_xgf60_avg,
        l.league_xgf60_stddev,
        l.league_gf60_avg,
        l.league_gf60_stddev,
        l.league_sf60_avg,
        l.league_sf60_stddev,
        l.league_xga60_avg,
        l.league_xga60_stddev,
        l.league_ga60_avg,
        l.league_ga60_stddev,
        l.league_sa60_avg,
        l.league_sa60_stddev,
        l.league_pace60_avg,
        l.league_pace60_stddev,
        LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) AS gp_weight,
        (LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.xgf60_ewma) +
            ((1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_xgf60_avg) AS xgf60,
        (LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.gf60_ewma) +
            ((1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_gf60_avg) AS gf60,
        (LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.sf60_ewma) +
            ((1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_sf60_avg) AS sf60,
        (LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.xga60_ewma) +
            ((1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_xga60_avg) AS xga60,
        (LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.ga60_ewma) +
            ((1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_ga60_avg) AS ga60,
        (LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.sa60_ewma) +
            ((1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_sa60_avg) AS sa60,
        (LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.pace60_ewma) +
            ((1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_pace60_avg) AS pace60
    FROM ewma_metrics e
    JOIN league_metric_daily l
      ON l.date = e.date
),
z_scored AS (
    SELECT
        b.*,
        (b.xgf60 - b.league_xgf60_avg) / NULLIF(b.league_xgf60_stddev, 0) AS xgf60_z,
        (b.gf60 - b.league_gf60_avg) / NULLIF(b.league_gf60_stddev, 0) AS gf60_z,
        (b.sf60 - b.league_sf60_avg) / NULLIF(b.league_sf60_stddev, 0) AS sf60_z,
        (b.xga60 - b.league_xga60_avg) / NULLIF(b.league_xga60_stddev, 0) AS xga60_z,
        (b.ga60 - b.league_ga60_avg) / NULLIF(b.league_ga60_stddev, 0) AS ga60_z,
        (b.sa60 - b.league_sa60_avg) / NULLIF(b.league_sa60_stddev, 0) AS sa60_z,
        (b.pace60 - b.league_pace60_avg) / NULLIF(b.league_pace60_stddev, 0) AS pace60_z
    FROM blended_metrics b
),
raw_scores AS (
    SELECT
        z.*,
        (0.7 * COALESCE(z.xgf60_z, 0)) +
        (0.2 * COALESCE(z.sf60_z, 0)) +
        (0.1 * COALESCE(z.gf60_z, 0)) AS off_raw,
        (0.7 * COALESCE(-z.xga60_z, 0)) +
        (0.2 * COALESCE(-z.sa60_z, 0)) +
        (0.1 * COALESCE(-z.ga60_z, 0)) AS def_raw,
        COALESCE(z.pace60_z, 0) AS pace_raw
    FROM z_scored z
),
raw_distribution AS (
    SELECT
        r.date,
        AVG(r.off_raw) AS off_raw_avg,
        STDDEV_SAMP(r.off_raw) AS off_raw_stddev,
        AVG(r.def_raw) AS def_raw_avg,
        STDDEV_SAMP(r.def_raw) AS def_raw_stddev,
        AVG(r.pace_raw) AS pace_raw_avg,
        STDDEV_SAMP(r.pace_raw) AS pace_raw_stddev
    FROM raw_scores r
    GROUP BY r.date
),
ratings_raw AS (
    SELECT
        r.team_abbreviation,
        r.date,
        r.season_id,
        100 + 15 * ((r.off_raw - d.off_raw_avg) / NULLIF(d.off_raw_stddev, 0)) AS off_rating,
        100 + 15 * ((r.def_raw - d.def_raw_avg) / NULLIF(d.def_raw_stddev, 0)) AS def_rating,
        100 + 15 * ((r.pace_raw - d.pace_raw_avg) / NULLIF(d.pace_raw_stddev, 0)) AS pace_rating,
        r.xgf60,
        r.gf60,
        r.sf60,
        r.xga60,
        r.ga60,
        r.sa60,
        r.pace60
    FROM raw_scores r
    JOIN raw_distribution d
      ON d.date = r.date
),
team_id_map AS (
    SELECT *
    FROM (VALUES
        (1,  'NJD'),
        (2,  'NYI'),
        (3,  'NYR'),
        (4,  'PHI'),
        (5,  'PIT'),
        (6,  'BOS'),
        (7,  'BUF'),
        (8,  'MTL'),
        (9,  'OTT'),
        (10, 'TOR'),
        (12, 'CAR'),
        (13, 'FLA'),
        (14, 'TBL'),
        (15, 'WSH'),
        (16, 'CHI'),
        (17, 'DET'),
        (18, 'NSH'),
        (19, 'STL'),
        (20, 'CGY'),
        (21, 'COL'),
        (22, 'EDM'),
        (23, 'VAN'),
        (24, 'ANA'),
        (25, 'DAL'),
        (26, 'LAK'),
        (28, 'SJS'),
        (29, 'CBJ'),
        (30, 'MIN'),
        (52, 'WPG'),
        (54, 'VGK'),
        (55, 'SEA'),
        (68, 'UTA'),
        (53, 'UTA'),
        (59, 'UTA')
    ) AS t(team_id, team_abbreviation)
),
team_name_map AS (
    SELECT *
    FROM (VALUES
        ('New Jersey Devils', 'NJD'),
        ('New York Islanders', 'NYI'),
        ('New York Rangers', 'NYR'),
        ('Philadelphia Flyers', 'PHI'),
        ('Pittsburgh Penguins', 'PIT'),
        ('Boston Bruins', 'BOS'),
        ('Buffalo Sabres', 'BUF'),
        ('Montréal Canadiens', 'MTL'),
        ('Montreal Canadiens', 'MTL'),
        ('Ottawa Senators', 'OTT'),
        ('Toronto Maple Leafs', 'TOR'),
        ('Carolina Hurricanes', 'CAR'),
        ('Florida Panthers', 'FLA'),
        ('Tampa Bay Lightning', 'TBL'),
        ('Washington Capitals', 'WSH'),
        ('Chicago Blackhawks', 'CHI'),
        ('Detroit Red Wings', 'DET'),
        ('Nashville Predators', 'NSH'),
        ('St. Louis Blues', 'STL'),
        ('St Louis Blues', 'STL'),
        ('Calgary Flames', 'CGY'),
        ('Colorado Avalanche', 'COL'),
        ('Edmonton Oilers', 'EDM'),
        ('Vancouver Canucks', 'VAN'),
        ('Anaheim Ducks', 'ANA'),
        ('Dallas Stars', 'DAL'),
        ('Los Angeles Kings', 'LAK'),
        ('San Jose Sharks', 'SJS'),
        ('Columbus Blue Jackets', 'CBJ'),
        ('Minnesota Wild', 'MIN'),
        ('Winnipeg Jets', 'WPG'),
        ('Vegas Golden Knights', 'VGK'),
        ('Seattle Kraken', 'SEA'),
        ('Utah Mammoth', 'UTA'),
        ('Utah Utah HC', 'UTA'),
        ('Arizona Coyotes', 'UTA'),
        ('Phoenix Coyotes', 'UTA')
    ) AS t(franchise_name, team_abbreviation)
),
team_universe AS (
    SELECT DISTINCT team_abbreviation FROM base_games
),
date_universe AS (
    SELECT DISTINCT date FROM base_games
),
wgo_calendar AS (
    SELECT
        t.team_abbreviation,
        d.date
    FROM team_universe t
    CROSS JOIN date_universe d
),
wgo_base AS (
    SELECT
        COALESCE(ti.team_abbreviation, tn.team_abbreviation) AS team_abbreviation,
        w.date::date AS date,
        w.power_play_pct::numeric AS power_play_pct,
        w.penalty_kill_pct::numeric AS penalty_kill_pct
    FROM public.wgo_team_stats w
    LEFT JOIN team_id_map ti
      ON ti.team_id = w.team_id
    LEFT JOIN team_name_map tn
      ON tn.franchise_name = w.franchise_name
    WHERE COALESCE(ti.team_abbreviation, tn.team_abbreviation) IS NOT NULL
),
wgo_filled AS (
    SELECT
        cal.team_abbreviation,
        cal.date,
        latest.power_play_pct,
        latest.penalty_kill_pct,
        latest.source_date
    FROM wgo_calendar cal
    LEFT JOIN LATERAL (
        SELECT
            b.power_play_pct,
            b.penalty_kill_pct,
            b.date AS source_date
        FROM wgo_base b
        WHERE b.team_abbreviation = cal.team_abbreviation
          AND b.date <= cal.date
        ORDER BY b.date DESC
        LIMIT 1
    ) AS latest
      ON TRUE
    WHERE latest.source_date IS NOT NULL
      AND cal.date - latest.source_date <= INTERVAL '7 days'
),
wgo_percentiles AS (
    SELECT
        date,
        percentile_cont(0.33) WITHIN GROUP (ORDER BY power_play_pct) FILTER (WHERE power_play_pct IS NOT NULL) AS pp_pct33,
        percentile_cont(0.67) WITHIN GROUP (ORDER BY power_play_pct) FILTER (WHERE power_play_pct IS NOT NULL) AS pp_pct67,
        percentile_cont(0.33) WITHIN GROUP (ORDER BY penalty_kill_pct) FILTER (WHERE penalty_kill_pct IS NOT NULL) AS pk_pct33,
        percentile_cont(0.67) WITHIN GROUP (ORDER BY penalty_kill_pct) FILTER (WHERE penalty_kill_pct IS NOT NULL) AS pk_pct67
    FROM wgo_filled
    GROUP BY date
),
wgo_tiers AS (
    SELECT
        f.team_abbreviation,
        f.date,
        CASE
            WHEN f.power_play_pct IS NULL THEN NULL
            WHEN f.power_play_pct >= p.pp_pct67 THEN 1
            WHEN f.power_play_pct >= p.pp_pct33 THEN 2
            ELSE 3
        END AS pp_tier,
        CASE
            WHEN f.penalty_kill_pct IS NULL THEN NULL
            WHEN f.penalty_kill_pct >= p.pk_pct67 THEN 1
            WHEN f.penalty_kill_pct >= p.pk_pct33 THEN 2
            ELSE 3
        END AS pk_tier
    FROM wgo_filled f
    LEFT JOIN wgo_percentiles p
      ON p.date = f.date
),
ratings_with_special AS (
    SELECT
        r.*,
        w.pp_tier,
        w.pk_tier
    FROM ratings_raw r
    LEFT JOIN wgo_tiers w
      ON w.team_abbreviation = r.team_abbreviation
     AND w.date = r.date
),
teams AS (
    SELECT DISTINCT team_abbreviation FROM ratings_with_special
),
rating_dates AS (
    SELECT DISTINCT date FROM ratings_with_special
),
calendar AS (
    SELECT
        t.team_abbreviation,
        d.date
    FROM teams t
    CROSS JOIN rating_dates d
),
filled AS (
    SELECT
        cal.team_abbreviation,
        cal.date,
        latest.off_rating,
        latest.def_rating,
        latest.pace_rating,
        COALESCE(latest.pp_tier, 3) AS pp_tier,
        COALESCE(latest.pk_tier, 3) AS pk_tier,
        latest.xgf60,
        latest.gf60,
        latest.sf60,
        latest.xga60,
        latest.ga60,
        latest.sa60,
        latest.pace60
    FROM calendar cal
    LEFT JOIN LATERAL (
        SELECT
            r.*
        FROM ratings_with_special r
        WHERE r.team_abbreviation = cal.team_abbreviation
          AND r.date <= cal.date
        ORDER BY r.date DESC
        LIMIT 1
    ) AS latest
      ON TRUE
    WHERE latest.date IS NOT NULL
      AND cal.date - latest.date <= INTERVAL '3 days'
),
with_trend AS (
    SELECT
        f.*,
        AVG(f.off_rating) OVER (
            PARTITION BY f.team_abbreviation
            ORDER BY f.date
            ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING
        ) AS off_rating_last10
    FROM filled f
)
SELECT
    wt.date,
    wt.team_abbreviation,
    ROUND(COALESCE(wt.off_rating, 100)::numeric, 2) AS off_rating,
    ROUND(COALESCE(wt.def_rating, 100)::numeric, 2) AS def_rating,
    ROUND(COALESCE(wt.pace_rating, 100)::numeric, 2) AS pace_rating,
    wt.pp_tier,
    wt.pk_tier,
    ROUND(COALESCE(wt.off_rating - wt.off_rating_last10, 0)::numeric, 2) AS trend10,
    ROUND(wt.xgf60::numeric, 4) AS xgf60,
    ROUND(wt.gf60::numeric, 4) AS gf60,
    ROUND(wt.sf60::numeric, 4) AS sf60,
    ROUND(wt.xga60::numeric, 4) AS xga60,
    ROUND(wt.ga60::numeric, 4) AS ga60,
    ROUND(wt.sa60::numeric, 4) AS sa60,
    ROUND(wt.pace60::numeric, 4) AS pace60,
    timezone('utc', now()) AS created_at
FROM with_trend wt
ORDER BY wt.date, wt.team_abbreviation;

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_power_ratings_daily_team_date
    ON public.team_power_ratings_daily (team_abbreviation, date);

CREATE INDEX IF NOT EXISTS idx_team_power_ratings_daily_date
    ON public.team_power_ratings_daily (date);

COMMENT ON MATERIALIZED VIEW public.team_power_ratings_daily IS
    'Daily team power ratings with blended offense/defense/pace indices, special teams tiers, and recent trend.';

DROP FUNCTION IF EXISTS public.refresh_team_power_ratings(date, date);

CREATE FUNCTION public.refresh_team_power_ratings(date_from date DEFAULT NULL, date_to date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'Refreshing team_power_ratings_daily (date_from %, date_to %).', date_from, date_to;
    REFRESH MATERIALIZED VIEW public.team_power_ratings_daily;
END;
$$;

-- Optional: switch to 5v5-only mode prior to refresh
-- SET team_power_mode = '5v5';
-- SELECT refresh_team_power_ratings(current_date - 7, current_date);
-- RESET team_power_mode;

-- Unit-ish checks (run after refresh):
-- SELECT date, AVG(off_rating) AS avg_off, AVG(def_rating) AS avg_def, AVG(pace_rating) AS avg_pace
-- FROM team_power_ratings_daily
-- WHERE date = current_date - 1
-- GROUP BY date;
