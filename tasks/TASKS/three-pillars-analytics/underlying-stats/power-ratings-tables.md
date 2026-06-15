## team_power_ratings_daily
```sql

 WITH params AS (
         SELECT 25 AS lookback_games,
            10.0 AS half_life_games,
            COALESCE(NULLIF(current_setting('team_power_mode'::text, true), ''::text), 'all'::text) AS mode_preference
        ), source_union AS (
         SELECT g.team_abbreviation,
            g.date,
            g.season_id,
            g.cf_per_60::numeric AS cf_per_60,
            g.ca_per_60::numeric AS ca_per_60,
            g.sf_per_60::numeric AS sf_per_60,
            g.sa_per_60::numeric AS sa_per_60,
            g.gf_per_60::numeric AS gf_per_60,
            g.ga_per_60::numeric AS ga_per_60,
            g.xgf_per_60::numeric AS xgf_per_60,
            g.xga_per_60::numeric AS xga_per_60,
            g.gp,
            g.toi_seconds::numeric AS toi_seconds,
            g.hdcf_per_60::numeric AS hdcf_per_60,
            g.hdca_per_60::numeric AS hdca_per_60,
            g.pdo::numeric AS pdo,
            'all'::text AS data_mode
           FROM nst_team_gamelogs_as_rates g
          WHERE g.situation = 'all'::text
        UNION ALL
         SELECT f.team_abbreviation,
            f.date,
            g_all.season_id,
                CASE
                    WHEN f.toi > 0 THEN f.cf::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS cf_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.ca::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS ca_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.sf::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS sf_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.sa::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS sa_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.gf::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS gf_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.ga::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS ga_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.xgf::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS xgf_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.xga::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS xga_per_60,
            f.gp,
            NULL::numeric AS toi_seconds,
            NULL::numeric AS hdcf_per_60,
            NULL::numeric AS hdca_per_60,
            g_all.pdo::numeric AS pdo,
            '5v5'::text AS data_mode
           FROM nst_team_5v5 f
             LEFT JOIN nst_team_gamelogs_as_rates g_all ON g_all.team_abbreviation = f.team_abbreviation AND g_all.date = f.date AND g_all.situation = 'all'::text
          WHERE f.situation = 'all'::text
        ), base_games AS (
         SELECT s.team_abbreviation,
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
            (s.cf_per_60 + s.ca_per_60) / 2.0 AS pace_per_60,
            s.hdcf_per_60,
            s.hdca_per_60,
            s.pdo
           FROM source_union s
             CROSS JOIN params p
          WHERE p.mode_preference = '5v5'::text AND s.data_mode = '5v5'::text OR p.mode_preference <> '5v5'::text AND s.data_mode = 'all'::text
        ), team_games AS (
         SELECT b.team_abbreviation,
            b.date,
            b.season_id,
            b.cf_per_60,
            b.ca_per_60,
            b.sf_per_60,
            b.sa_per_60,
            b.gf_per_60,
            b.ga_per_60,
            b.xgf_per_60,
            b.xga_per_60,
            b.gp,
            b.toi_seconds,
            b.pace_per_60,
            b.hdcf_per_60,
            b.hdca_per_60,
            b.pdo,
            row_number() OVER (PARTITION BY b.team_abbreviation, b.season_id ORDER BY b.date DESC) - 1 AS rn_desc,
            row_number() OVER (PARTITION BY b.team_abbreviation, b.season_id ORDER BY b.date) AS gp_to_date
           FROM base_games b
        ), ewma_metrics AS (
         SELECT cur.team_abbreviation,
            cur.date,
            cur.season_id,
            cur.gp_to_date,
            sum(prev.xgf_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS xgf60_ewma,
            sum(prev.gf_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS gf60_ewma,
            sum(prev.sf_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS sf60_ewma,
            sum(prev.xga_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS xga60_ewma,
            sum(prev.ga_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS ga60_ewma,
            sum(prev.sa_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS sa60_ewma,
            sum(prev.pace_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS pace60_ewma
           FROM team_games cur
             CROSS JOIN params p
             JOIN team_games prev ON prev.team_abbreviation = cur.team_abbreviation AND prev.season_id = cur.season_id AND prev.rn_desc >= cur.rn_desc AND prev.rn_desc <= (cur.rn_desc + (p.lookback_games - 1))
          GROUP BY cur.team_abbreviation, cur.date, cur.season_id, cur.gp_to_date, p.half_life_games
        ), league_metric_daily AS (
         SELECT e.date,
            avg(e.xgf60_ewma) AS league_xgf60_avg,
            stddev_samp(e.xgf60_ewma) AS league_xgf60_stddev,
            avg(e.gf60_ewma) AS league_gf60_avg,
            stddev_samp(e.gf60_ewma) AS league_gf60_stddev,
            avg(e.sf60_ewma) AS league_sf60_avg,
            stddev_samp(e.sf60_ewma) AS league_sf60_stddev,
            avg(e.xga60_ewma) AS league_xga60_avg,
            stddev_samp(e.xga60_ewma) AS league_xga60_stddev,
            avg(e.ga60_ewma) AS league_ga60_avg,
            stddev_samp(e.ga60_ewma) AS league_ga60_stddev,
            avg(e.sa60_ewma) AS league_sa60_avg,
            stddev_samp(e.sa60_ewma) AS league_sa60_stddev,
            avg(e.pace60_ewma) AS league_pace60_avg,
            stddev_samp(e.pace60_ewma) AS league_pace60_stddev
           FROM ewma_metrics e
          GROUP BY e.date
        ), blended_metrics AS (
         SELECT e.team_abbreviation,
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
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.xgf60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_xgf60_avg AS xgf60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.gf60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_gf60_avg AS gf60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.sf60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_sf60_avg AS sf60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.xga60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_xga60_avg AS xga60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.ga60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_ga60_avg AS ga60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.sa60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_sa60_avg AS sa60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.pace60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_pace60_avg AS pace60
           FROM ewma_metrics e
             JOIN league_metric_daily l ON l.date = e.date
        ), z_scored AS (
         SELECT b.team_abbreviation,
            b.date,
            b.season_id,
            b.gp_to_date,
            b.league_xgf60_avg,
            b.league_xgf60_stddev,
            b.league_gf60_avg,
            b.league_gf60_stddev,
            b.league_sf60_avg,
            b.league_sf60_stddev,
            b.league_xga60_avg,
            b.league_xga60_stddev,
            b.league_ga60_avg,
            b.league_ga60_stddev,
            b.league_sa60_avg,
            b.league_sa60_stddev,
            b.league_pace60_avg,
            b.league_pace60_stddev,
            b.gp_weight,
            b.xgf60,
            b.gf60,
            b.sf60,
            b.xga60,
            b.ga60,
            b.sa60,
            b.pace60,
            (b.xgf60 - b.league_xgf60_avg) / NULLIF(b.league_xgf60_stddev, 0::numeric) AS xgf60_z,
            (b.gf60 - b.league_gf60_avg) / NULLIF(b.league_gf60_stddev, 0::numeric) AS gf60_z,
            (b.sf60 - b.league_sf60_avg) / NULLIF(b.league_sf60_stddev, 0::numeric) AS sf60_z,
            (b.xga60 - b.league_xga60_avg) / NULLIF(b.league_xga60_stddev, 0::numeric) AS xga60_z,
            (b.ga60 - b.league_ga60_avg) / NULLIF(b.league_ga60_stddev, 0::numeric) AS ga60_z,
            (b.sa60 - b.league_sa60_avg) / NULLIF(b.league_sa60_stddev, 0::numeric) AS sa60_z,
            (b.pace60 - b.league_pace60_avg) / NULLIF(b.league_pace60_stddev, 0::numeric) AS pace60_z
           FROM blended_metrics b
        ), raw_scores AS (
         SELECT z.team_abbreviation,
            z.date,
            z.season_id,
            z.gp_to_date,
            z.league_xgf60_avg,
            z.league_xgf60_stddev,
            z.league_gf60_avg,
            z.league_gf60_stddev,
            z.league_sf60_avg,
            z.league_sf60_stddev,
            z.league_xga60_avg,
            z.league_xga60_stddev,
            z.league_ga60_avg,
            z.league_ga60_stddev,
            z.league_sa60_avg,
            z.league_sa60_stddev,
            z.league_pace60_avg,
            z.league_pace60_stddev,
            z.gp_weight,
            z.xgf60,
            z.gf60,
            z.sf60,
            z.xga60,
            z.ga60,
            z.sa60,
            z.pace60,
            z.xgf60_z,
            z.gf60_z,
            z.sf60_z,
            z.xga60_z,
            z.ga60_z,
            z.sa60_z,
            z.pace60_z,
            0.7 * COALESCE(z.xgf60_z, 0::numeric) + 0.2 * COALESCE(z.sf60_z, 0::numeric) + 0.1 * COALESCE(z.gf60_z, 0::numeric) AS off_raw,
            0.7 * COALESCE(- z.xga60_z, 0::numeric) + 0.2 * COALESCE(- z.sa60_z, 0::numeric) + 0.1 * COALESCE(- z.ga60_z, 0::numeric) AS def_raw,
            COALESCE(z.pace60_z, 0::numeric) AS pace_raw
           FROM z_scored z
        ), raw_distribution AS (
         SELECT r.date,
            avg(r.off_raw) AS off_raw_avg,
            stddev_samp(r.off_raw) AS off_raw_stddev,
            avg(r.def_raw) AS def_raw_avg,
            stddev_samp(r.def_raw) AS def_raw_stddev,
            avg(r.pace_raw) AS pace_raw_avg,
            stddev_samp(r.pace_raw) AS pace_raw_stddev
           FROM raw_scores r
          GROUP BY r.date
        ), ratings_raw AS (
         SELECT r.team_abbreviation,
            r.date,
            r.season_id,
            100::numeric + 15::numeric * ((r.off_raw - d.off_raw_avg) / NULLIF(d.off_raw_stddev, 0::numeric)) AS off_rating,
            100::numeric + 15::numeric * ((r.def_raw - d.def_raw_avg) / NULLIF(d.def_raw_stddev, 0::numeric)) AS def_rating,
            100::numeric + 15::numeric * ((r.pace_raw - d.pace_raw_avg) / NULLIF(d.pace_raw_stddev, 0::numeric)) AS pace_rating,
            r.xgf60,
            r.gf60,
            r.sf60,
            r.xga60,
            r.ga60,
            r.sa60,
            r.pace60
           FROM raw_scores r
             JOIN raw_distribution d ON d.date = r.date
        ), team_id_map AS (
         SELECT t.team_id,
            t.team_abbreviation
           FROM ( VALUES (1,'NJD'::text), (2,'NYI'::text), (3,'NYR'::text), (4,'PHI'::text), (5,'PIT'::text), (6,'BOS'::text), (7,'BUF'::text), (8,'MTL'::text), (9,'OTT'::text), (10,'TOR'::text), (12,'CAR'::text), (13,'FLA'::text), (14,'TBL'::text), (15,'WSH'::text), (16,'CHI'::text), (17,'DET'::text), (18,'NSH'::text), (19,'STL'::text), (20,'CGY'::text), (21,'COL'::text), (22,'EDM'::text), (23,'VAN'::text), (24,'ANA'::text), (25,'DAL'::text), (26,'LAK'::text), (28,'SJS'::text), (29,'CBJ'::text), (30,'MIN'::text), (52,'WPG'::text), (54,'VGK'::text), (55,'SEA'::text), (68,'UTA'::text), (53,'UTA'::text), (59,'UTA'::text)) t(team_id, team_abbreviation)
        ), team_name_map AS (
         SELECT t.franchise_name,
            t.team_abbreviation
           FROM ( VALUES ('New Jersey Devils'::text,'NJD'::text), ('New York Islanders'::text,'NYI'::text), ('New York Rangers'::text,'NYR'::text), ('Philadelphia Flyers'::text,'PHI'::text), ('Pittsburgh Penguins'::text,'PIT'::text), ('Boston Bruins'::text,'BOS'::text), ('Buffalo Sabres'::text,'BUF'::text), ('Montréal Canadiens'::text,'MTL'::text), ('Montreal Canadiens'::text,'MTL'::text), ('Ottawa Senators'::text,'OTT'::text), ('Toronto Maple Leafs'::text,'TOR'::text), ('Carolina Hurricanes'::text,'CAR'::text), ('Florida Panthers'::text,'FLA'::text), ('Tampa Bay Lightning'::text,'TBL'::text), ('Washington Capitals'::text,'WSH'::text), ('Chicago Blackhawks'::text,'CHI'::text), ('Detroit Red Wings'::text,'DET'::text), ('Nashville Predators'::text,'NSH'::text), ('St. Louis Blues'::text,'STL'::text), ('St Louis Blues'::text,'STL'::text), ('Calgary Flames'::text,'CGY'::text), ('Colorado Avalanche'::text,'COL'::text), ('Edmonton Oilers'::text,'EDM'::text), ('Vancouver Canucks'::text,'VAN'::text), ('Anaheim Ducks'::text,'ANA'::text), ('Dallas Stars'::text,'DAL'::text), ('Los Angeles Kings'::text,'LAK'::text), ('San Jose Sharks'::text,'SJS'::text), ('Columbus Blue Jackets'::text,'CBJ'::text), ('Minnesota Wild'::text,'MIN'::text), ('Winnipeg Jets'::text,'WPG'::text), ('Vegas Golden Knights'::text,'VGK'::text), ('Seattle Kraken'::text,'SEA'::text), ('Utah Mammoth'::text,'UTA'::text), ('Utah Utah HC'::text,'UTA'::text), ('Arizona Coyotes'::text,'UTA'::text), ('Phoenix Coyotes'::text,'UTA'::text)) t(franchise_name, team_abbreviation)
        ), team_universe AS (
         SELECT DISTINCT base_games.team_abbreviation
           FROM base_games
        ), date_universe AS (
         SELECT DISTINCT base_games.date
           FROM base_games
        ), wgo_calendar AS (
         SELECT t.team_abbreviation,
            d.date
           FROM team_universe t
             CROSS JOIN date_universe d
        ), wgo_base AS (
         SELECT COALESCE(ti.team_abbreviation, tn.team_abbreviation) AS team_abbreviation,
            w.date,
            w.power_play_pct::numeric AS power_play_pct,
            w.penalty_kill_pct::numeric AS penalty_kill_pct,
            w.penalties_drawn_per_60::numeric AS penalties_drawn_per_60,
            w.penalties_taken_per_60::numeric AS penalties_taken_per_60,
            w.pp_opportunities_per_game::numeric AS pp_opportunities_per_game,
            w.times_shorthanded_per_game::numeric AS times_shorthanded_per_game
           FROM wgo_team_stats w
             LEFT JOIN team_id_map ti ON ti.team_id = w.team_id
             LEFT JOIN team_name_map tn ON tn.franchise_name = w.franchise_name
          WHERE COALESCE(ti.team_abbreviation, tn.team_abbreviation) IS NOT NULL
        ), wgo_filled AS (
         SELECT cal.team_abbreviation,
            cal.date,
            latest.power_play_pct,
            latest.penalty_kill_pct,
            latest.penalties_drawn_per_60,
            latest.penalties_taken_per_60,
            latest.pp_opportunities_per_game,
            latest.times_shorthanded_per_game,
            latest.penalties_drawn_per_60 - latest.penalties_taken_per_60 AS discipline_diff_per60,
            latest.date AS source_date
           FROM wgo_calendar cal
             LEFT JOIN LATERAL ( SELECT b.team_abbreviation,
                    b.date,
                    b.power_play_pct,
                    b.penalty_kill_pct,
                    b.penalties_drawn_per_60,
                    b.penalties_taken_per_60,
                    b.pp_opportunities_per_game,
                    b.times_shorthanded_per_game
                   FROM wgo_base b
                  WHERE b.team_abbreviation = cal.team_abbreviation AND b.date <= cal.date
                  ORDER BY b.date DESC
                 LIMIT 1) latest ON true
          WHERE latest.date IS NOT NULL AND cal.date <= (latest.date + 7)
        ), wgo_percentiles AS (
         SELECT wgo_filled.date,
            percentile_cont(0.33::double precision) WITHIN GROUP (ORDER BY (wgo_filled.power_play_pct::double precision)) FILTER (WHERE wgo_filled.power_play_pct IS NOT NULL) AS pp_pct33,
            percentile_cont(0.67::double precision) WITHIN GROUP (ORDER BY (wgo_filled.power_play_pct::double precision)) FILTER (WHERE wgo_filled.power_play_pct IS NOT NULL) AS pp_pct67,
            percentile_cont(0.33::double precision) WITHIN GROUP (ORDER BY (wgo_filled.penalty_kill_pct::double precision)) FILTER (WHERE wgo_filled.penalty_kill_pct IS NOT NULL) AS pk_pct33,
            percentile_cont(0.67::double precision) WITHIN GROUP (ORDER BY (wgo_filled.penalty_kill_pct::double precision)) FILTER (WHERE wgo_filled.penalty_kill_pct IS NOT NULL) AS pk_pct67
           FROM wgo_filled
          GROUP BY wgo_filled.date
        ), wgo_tiers AS (
         SELECT f.team_abbreviation,
            f.date,
                CASE
                    WHEN f.power_play_pct IS NULL THEN NULL::integer
                    WHEN f.power_play_pct::double precision >= p.pp_pct67 THEN 1
                    WHEN f.power_play_pct::double precision >= p.pp_pct33 THEN 2
                    ELSE 3
                END AS pp_tier,
                CASE
                    WHEN f.penalty_kill_pct IS NULL THEN NULL::integer
                    WHEN f.penalty_kill_pct::double precision >= p.pk_pct67 THEN 1
                    WHEN f.penalty_kill_pct::double precision >= p.pk_pct33 THEN 2
                    ELSE 3
                END AS pk_tier,
            f.discipline_diff_per60,
            f.penalties_drawn_per_60,
            f.penalties_taken_per_60,
            f.pp_opportunities_per_game,
            f.times_shorthanded_per_game
           FROM wgo_filled f
             LEFT JOIN wgo_percentiles p ON p.date = f.date
        ), ratings_with_special AS (
         SELECT r.team_abbreviation,
            r.date,
            r.season_id,
            r.off_rating,
            r.def_rating,
            r.pace_rating,
            r.xgf60,
            r.gf60,
            r.sf60,
            r.xga60,
            r.ga60,
            r.sa60,
            r.pace60,
            w.pp_tier,
            w.pk_tier,
            w.discipline_diff_per60,
            w.penalties_drawn_per_60,
            w.penalties_taken_per_60,
            w.pp_opportunities_per_game,
            w.times_shorthanded_per_game
           FROM ratings_raw r
             LEFT JOIN wgo_tiers w ON w.team_abbreviation = r.team_abbreviation AND w.date = r.date
        ), teams AS (
         SELECT DISTINCT ratings_with_special.team_abbreviation
           FROM ratings_with_special
        ), rating_dates AS (
         SELECT DISTINCT ratings_with_special.date
           FROM ratings_with_special
        ), calendar AS (
         SELECT t.team_abbreviation,
            d.date
           FROM teams t
             CROSS JOIN rating_dates d
        ), filled AS (
         SELECT cal.team_abbreviation,
            cal.date,
            latest.season_id,
            latest.off_rating,
            latest.def_rating,
            latest.pace_rating,
            latest.xgf60,
            latest.gf60,
            latest.sf60,
            latest.xga60,
            latest.ga60,
            latest.sa60,
            latest.pace60,
            latest.pp_tier,
            latest.pk_tier,
            latest.discipline_diff_per60,
            latest.penalties_drawn_per_60,
            latest.penalties_taken_per_60,
            latest.pp_opportunities_per_game,
            latest.times_shorthanded_per_game
           FROM calendar cal
             LEFT JOIN LATERAL ( SELECT r.team_abbreviation,
                    r.date,
                    r.season_id,
                    r.off_rating,
                    r.def_rating,
                    r.pace_rating,
                    r.xgf60,
                    r.gf60,
                    r.sf60,
                    r.xga60,
                    r.ga60,
                    r.sa60,
                    r.pace60,
                    r.pp_tier,
                    r.pk_tier,
                    r.discipline_diff_per60,
                    r.penalties_drawn_per_60,
                    r.penalties_taken_per_60,
                    r.pp_opportunities_per_game,
                    r.times_shorthanded_per_game
                   FROM ratings_with_special r
                  WHERE r.team_abbreviation = cal.team_abbreviation AND r.date <= cal.date
                  ORDER BY r.date DESC
                 LIMIT 1) latest ON true
          WHERE latest.date IS NOT NULL AND cal.date <= (latest.date + 3)
        ), with_trend AS (
         SELECT f.team_abbreviation,
            f.date,
            f.season_id,
            f.off_rating,
            f.def_rating,
            f.pace_rating,
            f.xgf60,
            f.gf60,
            f.sf60,
            f.xga60,
            f.ga60,
            f.sa60,
            f.pace60,
            f.pp_tier,
            f.pk_tier,
            f.discipline_diff_per60,
            f.penalties_drawn_per_60,
            f.penalties_taken_per_60,
            f.pp_opportunities_per_game,
            f.times_shorthanded_per_game,
            avg(f.off_rating) OVER (PARTITION BY f.team_abbreviation ORDER BY f.date ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING) AS off_rating_last10
           FROM filled f
        ), pp_rates AS (
         SELECT nst_team_gamelogs_pp_rates.team_abbreviation,
            nst_team_gamelogs_pp_rates.date,
            nst_team_gamelogs_pp_rates.xgf_per_60 AS pp_xgf60,
            nst_team_gamelogs_pp_rates.gf_per_60 AS pp_gf60
           FROM nst_team_gamelogs_pp_rates
          WHERE nst_team_gamelogs_pp_rates.situation = 'pp'::text
        ), pk_rates AS (
         SELECT nst_team_gamelogs_pk_rates.team_abbreviation,
            nst_team_gamelogs_pk_rates.date,
            nst_team_gamelogs_pk_rates.xga_per_60 AS pk_xga60,
            nst_team_gamelogs_pk_rates.ga_per_60 AS pk_ga60
           FROM nst_team_gamelogs_pk_rates
          WHERE nst_team_gamelogs_pk_rates.situation = 'pk'::text
        ), extras AS (
         SELECT b.team_abbreviation,
            b.date,
            b.season_id,
            b.gf_per_60 - b.xgf_per_60 AS finishing_delta_per60,
            b.xga_per_60 - b.ga_per_60 AS goaltending_delta_per60,
            b.pdo,
            b.hdcf_per_60 / NULLIF(b.hdcf_per_60 + b.hdca_per_60, 0::numeric) AS hdcf_share,
            pp.pp_xgf60,
            pp.pp_gf60,
            pk.pk_xga60,
            pk.pk_ga60,
            w.discipline_diff_per60
           FROM base_games b
             LEFT JOIN pp_rates pp ON pp.team_abbreviation = b.team_abbreviation AND pp.date = b.date
             LEFT JOIN pk_rates pk ON pk.team_abbreviation = b.team_abbreviation AND pk.date = b.date
             LEFT JOIN wgo_tiers w ON w.team_abbreviation = b.team_abbreviation AND w.date = b.date
        ), extras_z AS (
         SELECT e.team_abbreviation,
            e.date,
            e.season_id,
            e.finishing_delta_per60,
            e.goaltending_delta_per60,
            e.pdo,
            e.hdcf_share,
            e.pp_xgf60,
            e.pp_gf60,
            e.pk_xga60,
            e.pk_ga60,
            e.discipline_diff_per60,
            (e.finishing_delta_per60 - avg(e.finishing_delta_per60) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.finishing_delta_per60) OVER (PARTITION BY e.date), 0::numeric) AS finishing_z,
            (e.goaltending_delta_per60 - avg(e.goaltending_delta_per60) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.goaltending_delta_per60) OVER (PARTITION BY e.date), 0::numeric) AS goalie_z,
            (e.hdcf_share - avg(e.hdcf_share) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.hdcf_share) OVER (PARTITION BY e.date), 0::numeric) AS danger_z,
            (e.pp_xgf60 - avg(e.pp_xgf60) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.pp_xgf60) OVER (PARTITION BY e.date), 0::double precision) AS pp_off_z,
            (e.pk_xga60 - avg(e.pk_xga60) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.pk_xga60) OVER (PARTITION BY e.date), 0::double precision) AS pk_def_z,
            (e.discipline_diff_per60 - avg(e.discipline_diff_per60) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.discipline_diff_per60) OVER (PARTITION BY e.date), 0::numeric) AS discipline_z,
            (e.pdo - avg(e.pdo) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.pdo) OVER (PARTITION BY e.date), 0::numeric) AS pdo_z
           FROM extras e
        ), extended_raw AS (
         SELECT r.team_abbreviation,
            r.date,
            r.season_id,
            r.gp_to_date,
            r.league_xgf60_avg,
            r.league_xgf60_stddev,
            r.league_gf60_avg,
            r.league_gf60_stddev,
            r.league_sf60_avg,
            r.league_sf60_stddev,
            r.league_xga60_avg,
            r.league_xga60_stddev,
            r.league_ga60_avg,
            r.league_ga60_stddev,
            r.league_sa60_avg,
            r.league_sa60_stddev,
            r.league_pace60_avg,
            r.league_pace60_stddev,
            r.gp_weight,
            r.xgf60,
            r.gf60,
            r.sf60,
            r.xga60,
            r.ga60,
            r.sa60,
            r.pace60,
            r.xgf60_z,
            r.gf60_z,
            r.sf60_z,
            r.xga60_z,
            r.ga60_z,
            r.sa60_z,
            r.pace60_z,
            r.off_raw,
            r.def_raw,
            r.pace_raw,
            ex.finishing_z,
            ex.goalie_z,
            ex.danger_z,
            ex.pp_off_z,
            ex.pk_def_z,
            ex.discipline_z,
            ex.pdo_z
           FROM raw_scores r
             LEFT JOIN extras_z ex ON ex.team_abbreviation = r.team_abbreviation AND ex.date = r.date
        ), components AS (
         SELECT er.team_abbreviation,
            er.date,
            er.season_id,
            er.gp_to_date,
            er.league_xgf60_avg,
            er.league_xgf60_stddev,
            er.league_gf60_avg,
            er.league_gf60_stddev,
            er.league_sf60_avg,
            er.league_sf60_stddev,
            er.league_xga60_avg,
            er.league_xga60_stddev,
            er.league_ga60_avg,
            er.league_ga60_stddev,
            er.league_sa60_avg,
            er.league_sa60_stddev,
            er.league_pace60_avg,
            er.league_pace60_stddev,
            er.gp_weight,
            er.xgf60,
            er.gf60,
            er.sf60,
            er.xga60,
            er.ga60,
            er.sa60,
            er.pace60,
            er.xgf60_z,
            er.gf60_z,
            er.sf60_z,
            er.xga60_z,
            er.ga60_z,
            er.sa60_z,
            er.pace60_z,
            er.off_raw,
            er.def_raw,
            er.pace_raw,
            er.finishing_z,
            er.goalie_z,
            er.danger_z,
            er.pp_off_z,
            er.pk_def_z,
            er.discipline_z,
            er.pdo_z,
            100::numeric + 15::numeric * COALESCE(er.finishing_z, 0::numeric) AS finishing_rating,
            100::numeric + 15::numeric * COALESCE(er.goalie_z, 0::numeric) AS goalie_rating,
            100::numeric + 15::numeric * COALESCE(er.danger_z, 0::numeric) AS danger_rating,
            100::double precision + 15::double precision * (0.20::double precision * COALESCE(er.pp_off_z, 0::double precision) + 0.20::double precision * COALESCE(- er.pk_def_z, 0::double precision)) AS special_rating,
            100::numeric + 15::numeric * COALESCE(er.discipline_z, 0::numeric) AS discipline_rating,
                CASE
                    WHEN abs(COALESCE(er.pdo_z, 0::numeric)) >= 1.0 THEN 1
                    ELSE 0
                END AS variance_flag
           FROM extended_raw er
        )
 SELECT wt.date,
    wt.team_abbreviation,
    round(COALESCE(wt.off_rating, 100::numeric), 2) AS off_rating,
    round(COALESCE(wt.def_rating, 100::numeric), 2) AS def_rating,
    round(COALESCE(wt.pace_rating, 100::numeric), 2) AS pace_rating,
    wt.pp_tier,
    wt.pk_tier,
    round(COALESCE(wt.off_rating - wt.off_rating_last10, 0::numeric), 2) AS trend10,
    round(wt.xgf60, 4) AS xgf60,
    round(wt.gf60, 4) AS gf60,
    round(wt.sf60, 4) AS sf60,
    round(wt.xga60, 4) AS xga60,
    round(wt.ga60, 4) AS ga60,
    round(wt.sa60, 4) AS sa60,
    round(wt.pace60, 4) AS pace60,
    round(COALESCE(c.finishing_rating, 100::numeric), 2) AS finishing_rating,
    round(COALESCE(c.goalie_rating, 100::numeric), 2) AS goalie_rating,
    round(COALESCE(c.danger_rating, 100::numeric), 2) AS danger_rating,
    round(COALESCE(c.special_rating, 100::double precision)::numeric, 2) AS special_rating,
    round(COALESCE(c.discipline_rating, 100::numeric), 2) AS discipline_rating,
    c.variance_flag,
    timezone('utc'::text, now()) AS created_at
   FROM with_trend wt
     LEFT JOIN components c ON c.team_abbreviation = wt.team_abbreviation AND c.date = wt.date
  ORDER BY wt.date, wt.team_abbreviation;
  ```

# ###############################################################################################################################

## team_power_ratings_daily__new:

```sql
 WITH params AS (
         SELECT 25 AS lookback_games,
            10.0 AS half_life_games,
            COALESCE(NULLIF(current_setting('team_power_mode'::text, true), ''::text), 'all'::text) AS mode_preference
        ), source_union AS (
         SELECT g.team_abbreviation,
            g.date,
            g.season_id,
            g.cf_per_60::numeric AS cf_per_60,
            g.ca_per_60::numeric AS ca_per_60,
            g.sf_per_60::numeric AS sf_per_60,
            g.sa_per_60::numeric AS sa_per_60,
            g.gf_per_60::numeric AS gf_per_60,
            g.ga_per_60::numeric AS ga_per_60,
            g.xgf_per_60::numeric AS xgf_per_60,
            g.xga_per_60::numeric AS xga_per_60,
            g.gp,
            g.toi_seconds::numeric AS toi_seconds,
            g.hdcf_per_60::numeric AS hdcf_per_60,
            g.hdca_per_60::numeric AS hdca_per_60,
            g.pdo::numeric AS pdo,
            'all'::text AS data_mode
           FROM nst_team_gamelogs_as_rates g
          WHERE g.situation = 'all'::text
        UNION ALL
         SELECT f.team_abbreviation,
            f.date,
            g_all.season_id,
                CASE
                    WHEN f.toi > 0 THEN f.cf::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS cf_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.ca::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS ca_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.sf::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS sf_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.sa::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS sa_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.gf::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS gf_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.ga::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS ga_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.xgf::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS xgf_per_60,
                CASE
                    WHEN f.toi > 0 THEN f.xga::numeric * 3600.0 / f.toi::numeric
                    ELSE NULL::numeric
                END AS xga_per_60,
            f.gp,
            NULL::numeric AS toi_seconds,
            NULL::numeric AS hdcf_per_60,
            NULL::numeric AS hdca_per_60,
            g_all.pdo::numeric AS pdo,
            '5v5'::text AS data_mode
           FROM nst_team_5v5 f
             LEFT JOIN nst_team_gamelogs_as_rates g_all ON g_all.team_abbreviation = f.team_abbreviation AND g_all.date = f.date AND g_all.situation = 'all'::text
          WHERE f.situation = 'all'::text
        ), base_games AS (
         SELECT s.team_abbreviation,
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
            (s.cf_per_60 + s.ca_per_60) / 2.0 AS pace_per_60,
            s.hdcf_per_60,
            s.hdca_per_60,
            s.pdo
           FROM source_union s
             CROSS JOIN params p
          WHERE p.mode_preference = '5v5'::text AND s.data_mode = '5v5'::text OR p.mode_preference <> '5v5'::text AND s.data_mode = 'all'::text
        ), team_games AS (
         SELECT b.team_abbreviation,
            b.date,
            b.season_id,
            b.cf_per_60,
            b.ca_per_60,
            b.sf_per_60,
            b.sa_per_60,
            b.gf_per_60,
            b.ga_per_60,
            b.xgf_per_60,
            b.xga_per_60,
            b.gp,
            b.toi_seconds,
            b.pace_per_60,
            b.hdcf_per_60,
            b.hdca_per_60,
            b.pdo,
            row_number() OVER (PARTITION BY b.team_abbreviation, b.season_id ORDER BY b.date DESC) - 1 AS rn_desc,
            row_number() OVER (PARTITION BY b.team_abbreviation, b.season_id ORDER BY b.date) AS gp_to_date
           FROM base_games b
        ), ewma_metrics AS (
         SELECT cur.team_abbreviation,
            cur.date,
            cur.season_id,
            cur.gp_to_date,
            sum(prev.xgf_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS xgf60_ewma,
            sum(prev.gf_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS gf60_ewma,
            sum(prev.sf_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS sf60_ewma,
            sum(prev.xga_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS xga60_ewma,
            sum(prev.ga_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS ga60_ewma,
            sum(prev.sa_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS sa60_ewma,
            sum(prev.pace_per_60 * power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) / sum(power(0.5, (prev.rn_desc - cur.rn_desc)::numeric / p.half_life_games)) AS pace60_ewma
           FROM team_games cur
             CROSS JOIN params p
             JOIN team_games prev ON prev.team_abbreviation = cur.team_abbreviation AND prev.season_id = cur.season_id AND prev.rn_desc >= cur.rn_desc AND prev.rn_desc <= (cur.rn_desc + (p.lookback_games - 1))
          GROUP BY cur.team_abbreviation, cur.date, cur.season_id, cur.gp_to_date, p.half_life_games
        ), league_metric_daily AS (
         SELECT e.date,
            avg(e.xgf60_ewma) AS league_xgf60_avg,
            stddev_samp(e.xgf60_ewma) AS league_xgf60_stddev,
            avg(e.gf60_ewma) AS league_gf60_avg,
            stddev_samp(e.gf60_ewma) AS league_gf60_stddev,
            avg(e.sf60_ewma) AS league_sf60_avg,
            stddev_samp(e.sf60_ewma) AS league_sf60_stddev,
            avg(e.xga60_ewma) AS league_xga60_avg,
            stddev_samp(e.xga60_ewma) AS league_xga60_stddev,
            avg(e.ga60_ewma) AS league_ga60_avg,
            stddev_samp(e.ga60_ewma) AS league_ga60_stddev,
            avg(e.sa60_ewma) AS league_sa60_avg,
            stddev_samp(e.sa60_ewma) AS league_sa60_stddev,
            avg(e.pace60_ewma) AS league_pace60_avg,
            stddev_samp(e.pace60_ewma) AS league_pace60_stddev
           FROM ewma_metrics e
          GROUP BY e.date
        ), blended_metrics AS (
         SELECT e.team_abbreviation,
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
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.xgf60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_xgf60_avg AS xgf60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.gf60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_gf60_avg AS gf60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.sf60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_sf60_avg AS sf60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.xga60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_xga60_avg AS xga60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.ga60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_ga60_avg AS ga60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.sa60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_sa60_avg AS sa60,
            LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0)) * e.pace60_ewma + (1.0 - LEAST(1.0, GREATEST(0.0, e.gp_to_date::numeric / 10.0))) * l.league_pace60_avg AS pace60
           FROM ewma_metrics e
             JOIN league_metric_daily l ON l.date = e.date
        ), z_scored AS (
         SELECT b.team_abbreviation,
            b.date,
            b.season_id,
            b.gp_to_date,
            b.league_xgf60_avg,
            b.league_xgf60_stddev,
            b.league_gf60_avg,
            b.league_gf60_stddev,
            b.league_sf60_avg,
            b.league_sf60_stddev,
            b.league_xga60_avg,
            b.league_xga60_stddev,
            b.league_ga60_avg,
            b.league_ga60_stddev,
            b.league_sa60_avg,
            b.league_sa60_stddev,
            b.league_pace60_avg,
            b.league_pace60_stddev,
            b.gp_weight,
            b.xgf60,
            b.gf60,
            b.sf60,
            b.xga60,
            b.ga60,
            b.sa60,
            b.pace60,
            (b.xgf60 - b.league_xgf60_avg) / NULLIF(b.league_xgf60_stddev, 0::numeric) AS xgf60_z,
            (b.gf60 - b.league_gf60_avg) / NULLIF(b.league_gf60_stddev, 0::numeric) AS gf60_z,
            (b.sf60 - b.league_sf60_avg) / NULLIF(b.league_sf60_stddev, 0::numeric) AS sf60_z,
            (b.xga60 - b.league_xga60_avg) / NULLIF(b.league_xga60_stddev, 0::numeric) AS xga60_z,
            (b.ga60 - b.league_ga60_avg) / NULLIF(b.league_ga60_stddev, 0::numeric) AS ga60_z,
            (b.sa60 - b.league_sa60_avg) / NULLIF(b.league_sa60_stddev, 0::numeric) AS sa60_z,
            (b.pace60 - b.league_pace60_avg) / NULLIF(b.league_pace60_stddev, 0::numeric) AS pace60_z
           FROM blended_metrics b
        ), raw_scores AS (
         SELECT z.team_abbreviation,
            z.date,
            z.season_id,
            z.gp_to_date,
            z.league_xgf60_avg,
            z.league_xgf60_stddev,
            z.league_gf60_avg,
            z.league_gf60_stddev,
            z.league_sf60_avg,
            z.league_sf60_stddev,
            z.league_xga60_avg,
            z.league_xga60_stddev,
            z.league_ga60_avg,
            z.league_ga60_stddev,
            z.league_sa60_avg,
            z.league_sa60_stddev,
            z.league_pace60_avg,
            z.league_pace60_stddev,
            z.gp_weight,
            z.xgf60,
            z.gf60,
            z.sf60,
            z.xga60,
            z.ga60,
            z.sa60,
            z.pace60,
            z.xgf60_z,
            z.gf60_z,
            z.sf60_z,
            z.xga60_z,
            z.ga60_z,
            z.sa60_z,
            z.pace60_z,
            0.7 * COALESCE(z.xgf60_z, 0::numeric) + 0.2 * COALESCE(z.sf60_z, 0::numeric) + 0.1 * COALESCE(z.gf60_z, 0::numeric) AS off_raw,
            0.7 * COALESCE(- z.xga60_z, 0::numeric) + 0.2 * COALESCE(- z.sa60_z, 0::numeric) + 0.1 * COALESCE(- z.ga60_z, 0::numeric) AS def_raw,
            COALESCE(z.pace60_z, 0::numeric) AS pace_raw
           FROM z_scored z
        ), raw_distribution AS (
         SELECT r.date,
            avg(r.off_raw) AS off_raw_avg,
            stddev_samp(r.off_raw) AS off_raw_stddev,
            avg(r.def_raw) AS def_raw_avg,
            stddev_samp(r.def_raw) AS def_raw_stddev,
            avg(r.pace_raw) AS pace_raw_avg,
            stddev_samp(r.pace_raw) AS pace_raw_stddev
           FROM raw_scores r
          GROUP BY r.date
        ), ratings_raw AS (
         SELECT r.team_abbreviation,
            r.date,
            r.season_id,
            100::numeric + 15::numeric * ((r.off_raw - d.off_raw_avg) / NULLIF(d.off_raw_stddev, 0::numeric)) AS off_rating,
            100::numeric + 15::numeric * ((r.def_raw - d.def_raw_avg) / NULLIF(d.def_raw_stddev, 0::numeric)) AS def_rating,
            100::numeric + 15::numeric * ((r.pace_raw - d.pace_raw_avg) / NULLIF(d.pace_raw_stddev, 0::numeric)) AS pace_rating,
            r.xgf60,
            r.gf60,
            r.sf60,
            r.xga60,
            r.ga60,
            r.sa60,
            r.pace60
           FROM raw_scores r
             JOIN raw_distribution d ON d.date = r.date
        ), team_id_map AS (
         SELECT t.team_id,
            t.team_abbreviation
           FROM ( VALUES (1,'NJD'::text), (2,'NYI'::text), (3,'NYR'::text), (4,'PHI'::text), (5,'PIT'::text), (6,'BOS'::text), (7,'BUF'::text), (8,'MTL'::text), (9,'OTT'::text), (10,'TOR'::text), (12,'CAR'::text), (13,'FLA'::text), (14,'TBL'::text), (15,'WSH'::text), (16,'CHI'::text), (17,'DET'::text), (18,'NSH'::text), (19,'STL'::text), (20,'CGY'::text), (21,'COL'::text), (22,'EDM'::text), (23,'VAN'::text), (24,'ANA'::text), (25,'DAL'::text), (26,'LAK'::text), (28,'SJS'::text), (29,'CBJ'::text), (30,'MIN'::text), (52,'WPG'::text), (54,'VGK'::text), (55,'SEA'::text), (68,'UTA'::text), (53,'UTA'::text), (59,'UTA'::text)) t(team_id, team_abbreviation)
        ), team_name_map AS (
         SELECT t.franchise_name,
            t.team_abbreviation
           FROM ( VALUES ('New Jersey Devils'::text,'NJD'::text), ('New York Islanders'::text,'NYI'::text), ('New York Rangers'::text,'NYR'::text), ('Philadelphia Flyers'::text,'PHI'::text), ('Pittsburgh Penguins'::text,'PIT'::text), ('Boston Bruins'::text,'BOS'::text), ('Buffalo Sabres'::text,'BUF'::text), ('Montréal Canadiens'::text,'MTL'::text), ('Montreal Canadiens'::text,'MTL'::text), ('Ottawa Senators'::text,'OTT'::text), ('Toronto Maple Leafs'::text,'TOR'::text), ('Carolina Hurricanes'::text,'CAR'::text), ('Florida Panthers'::text,'FLA'::text), ('Tampa Bay Lightning'::text,'TBL'::text), ('Washington Capitals'::text,'WSH'::text), ('Chicago Blackhawks'::text,'CHI'::text), ('Detroit Red Wings'::text,'DET'::text), ('Nashville Predators'::text,'NSH'::text), ('St. Louis Blues'::text,'STL'::text), ('St Louis Blues'::text,'STL'::text), ('Calgary Flames'::text,'CGY'::text), ('Colorado Avalanche'::text,'COL'::text), ('Edmonton Oilers'::text,'EDM'::text), ('Vancouver Canucks'::text,'VAN'::text), ('Anaheim Ducks'::text,'ANA'::text), ('Dallas Stars'::text,'DAL'::text), ('Los Angeles Kings'::text,'LAK'::text), ('San Jose Sharks'::text,'SJS'::text), ('Columbus Blue Jackets'::text,'CBJ'::text), ('Minnesota Wild'::text,'MIN'::text), ('Winnipeg Jets'::text,'WPG'::text), ('Vegas Golden Knights'::text,'VGK'::text), ('Seattle Kraken'::text,'SEA'::text), ('Utah Mammoth'::text,'UTA'::text), ('Utah Utah HC'::text,'UTA'::text), ('Arizona Coyotes'::text,'UTA'::text), ('Phoenix Coyotes'::text,'UTA'::text)) t(franchise_name, team_abbreviation)
        ), team_universe AS (
         SELECT DISTINCT base_games.team_abbreviation
           FROM base_games
        ), date_universe AS (
         SELECT DISTINCT base_games.date
           FROM base_games
        ), wgo_calendar AS (
         SELECT t.team_abbreviation,
            d.date
           FROM team_universe t
             CROSS JOIN date_universe d
        ), wgo_base AS (
         SELECT COALESCE(ti.team_abbreviation, tn.team_abbreviation) AS team_abbreviation,
            w.date,
            w.power_play_pct::numeric AS power_play_pct,
            w.penalty_kill_pct::numeric AS penalty_kill_pct,
            w.penalties_drawn_per_60::numeric AS penalties_drawn_per_60,
            w.penalties_taken_per_60::numeric AS penalties_taken_per_60,
            w.pp_opportunities_per_game::numeric AS pp_opportunities_per_game,
            w.times_shorthanded_per_game::numeric AS times_shorthanded_per_game
           FROM wgo_team_stats w
             LEFT JOIN team_id_map ti ON ti.team_id = w.team_id
             LEFT JOIN team_name_map tn ON tn.franchise_name = w.franchise_name
          WHERE COALESCE(ti.team_abbreviation, tn.team_abbreviation) IS NOT NULL
        ), wgo_filled AS (
         SELECT cal.team_abbreviation,
            cal.date,
            latest.power_play_pct,
            latest.penalty_kill_pct,
            latest.penalties_drawn_per_60,
            latest.penalties_taken_per_60,
            latest.pp_opportunities_per_game,
            latest.times_shorthanded_per_game,
            latest.penalties_drawn_per_60 - latest.penalties_taken_per_60 AS discipline_diff_per60,
            latest.date AS source_date
           FROM wgo_calendar cal
             LEFT JOIN LATERAL ( SELECT b.team_abbreviation,
                    b.date,
                    b.power_play_pct,
                    b.penalty_kill_pct,
                    b.penalties_drawn_per_60,
                    b.penalties_taken_per_60,
                    b.pp_opportunities_per_game,
                    b.times_shorthanded_per_game
                   FROM wgo_base b
                  WHERE b.team_abbreviation = cal.team_abbreviation AND b.date <= cal.date
                  ORDER BY b.date DESC
                 LIMIT 1) latest ON true
          WHERE latest.date IS NOT NULL AND cal.date <= (latest.date + 7)
        ), wgo_percentiles AS (
         SELECT wgo_filled.date,
            percentile_cont(0.33::double precision) WITHIN GROUP (ORDER BY (wgo_filled.power_play_pct::double precision)) FILTER (WHERE wgo_filled.power_play_pct IS NOT NULL) AS pp_pct33,
            percentile_cont(0.67::double precision) WITHIN GROUP (ORDER BY (wgo_filled.power_play_pct::double precision)) FILTER (WHERE wgo_filled.power_play_pct IS NOT NULL) AS pp_pct67,
            percentile_cont(0.33::double precision) WITHIN GROUP (ORDER BY (wgo_filled.penalty_kill_pct::double precision)) FILTER (WHERE wgo_filled.penalty_kill_pct IS NOT NULL) AS pk_pct33,
            percentile_cont(0.67::double precision) WITHIN GROUP (ORDER BY (wgo_filled.penalty_kill_pct::double precision)) FILTER (WHERE wgo_filled.penalty_kill_pct IS NOT NULL) AS pk_pct67
           FROM wgo_filled
          GROUP BY wgo_filled.date
        ), wgo_tiers AS (
         SELECT f.team_abbreviation,
            f.date,
                CASE
                    WHEN f.power_play_pct IS NULL THEN NULL::integer
                    WHEN f.power_play_pct::double precision >= p.pp_pct67 THEN 1
                    WHEN f.power_play_pct::double precision >= p.pp_pct33 THEN 2
                    ELSE 3
                END AS pp_tier,
                CASE
                    WHEN f.penalty_kill_pct IS NULL THEN NULL::integer
                    WHEN f.penalty_kill_pct::double precision >= p.pk_pct67 THEN 1
                    WHEN f.penalty_kill_pct::double precision >= p.pk_pct33 THEN 2
                    ELSE 3
                END AS pk_tier,
            f.discipline_diff_per60,
            f.penalties_drawn_per_60,
            f.penalties_taken_per_60,
            f.pp_opportunities_per_game,
            f.times_shorthanded_per_game
           FROM wgo_filled f
             LEFT JOIN wgo_percentiles p ON p.date = f.date
        ), ratings_with_special AS (
         SELECT r.team_abbreviation,
            r.date,
            r.season_id,
            r.off_rating,
            r.def_rating,
            r.pace_rating,
            r.xgf60,
            r.gf60,
            r.sf60,
            r.xga60,
            r.ga60,
            r.sa60,
            r.pace60,
            w.pp_tier,
            w.pk_tier,
            w.discipline_diff_per60,
            w.penalties_drawn_per_60,
            w.penalties_taken_per_60,
            w.pp_opportunities_per_game,
            w.times_shorthanded_per_game
           FROM ratings_raw r
             LEFT JOIN wgo_tiers w ON w.team_abbreviation = r.team_abbreviation AND w.date = r.date
        ), teams AS (
         SELECT DISTINCT ratings_with_special.team_abbreviation
           FROM ratings_with_special
        ), rating_dates AS (
         SELECT DISTINCT ratings_with_special.date
           FROM ratings_with_special
        ), calendar AS (
         SELECT t.team_abbreviation,
            d.date
           FROM teams t
             CROSS JOIN rating_dates d
        ), filled AS (
         SELECT cal.team_abbreviation,
            cal.date,
            latest.season_id,
            latest.off_rating,
            latest.def_rating,
            latest.pace_rating,
            latest.xgf60,
            latest.gf60,
            latest.sf60,
            latest.xga60,
            latest.ga60,
            latest.sa60,
            latest.pace60,
            latest.pp_tier,
            latest.pk_tier,
            latest.discipline_diff_per60,
            latest.penalties_drawn_per_60,
            latest.penalties_taken_per_60,
            latest.pp_opportunities_per_game,
            latest.times_shorthanded_per_game
           FROM calendar cal
             LEFT JOIN LATERAL ( SELECT r.team_abbreviation,
                    r.date,
                    r.season_id,
                    r.off_rating,
                    r.def_rating,
                    r.pace_rating,
                    r.xgf60,
                    r.gf60,
                    r.sf60,
                    r.xga60,
                    r.ga60,
                    r.sa60,
                    r.pace60,
                    r.pp_tier,
                    r.pk_tier,
                    r.discipline_diff_per60,
                    r.penalties_drawn_per_60,
                    r.penalties_taken_per_60,
                    r.pp_opportunities_per_game,
                    r.times_shorthanded_per_game
                   FROM ratings_with_special r
                  WHERE r.team_abbreviation = cal.team_abbreviation AND r.date <= cal.date
                  ORDER BY r.date DESC
                 LIMIT 1) latest ON true
          WHERE latest.date IS NOT NULL AND cal.date <= (latest.date + 3)
        ), with_trend AS (
         SELECT f.team_abbreviation,
            f.date,
            f.season_id,
            f.off_rating,
            f.def_rating,
            f.pace_rating,
            f.xgf60,
            f.gf60,
            f.sf60,
            f.xga60,
            f.ga60,
            f.sa60,
            f.pace60,
            f.pp_tier,
            f.pk_tier,
            f.discipline_diff_per60,
            f.penalties_drawn_per_60,
            f.penalties_taken_per_60,
            f.pp_opportunities_per_game,
            f.times_shorthanded_per_game,
            avg(f.off_rating) OVER (PARTITION BY f.team_abbreviation ORDER BY f.date ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING) AS off_rating_last10
           FROM filled f
        ), pp_rates AS (
         SELECT nst_team_gamelogs_pp_rates.team_abbreviation,
            nst_team_gamelogs_pp_rates.date,
            nst_team_gamelogs_pp_rates.xgf_per_60 AS pp_xgf60,
            nst_team_gamelogs_pp_rates.gf_per_60 AS pp_gf60
           FROM nst_team_gamelogs_pp_rates
          WHERE nst_team_gamelogs_pp_rates.situation = 'pp'::text
        ), pk_rates AS (
         SELECT nst_team_gamelogs_pk_rates.team_abbreviation,
            nst_team_gamelogs_pk_rates.date,
            nst_team_gamelogs_pk_rates.xga_per_60 AS pk_xga60,
            nst_team_gamelogs_pk_rates.ga_per_60 AS pk_ga60
           FROM nst_team_gamelogs_pk_rates
          WHERE nst_team_gamelogs_pk_rates.situation = 'pk'::text
        ), extras AS (
         SELECT b.team_abbreviation,
            b.date,
            b.season_id,
            b.gf_per_60 - b.xgf_per_60 AS finishing_delta_per60,
            b.xga_per_60 - b.ga_per_60 AS goaltending_delta_per60,
            b.pdo,
            b.hdcf_per_60 / NULLIF(b.hdcf_per_60 + b.hdca_per_60, 0::numeric) AS hdcf_share,
            pp.pp_xgf60,
            pp.pp_gf60,
            pk.pk_xga60,
            pk.pk_ga60,
            w.discipline_diff_per60
           FROM base_games b
             LEFT JOIN pp_rates pp ON pp.team_abbreviation = b.team_abbreviation AND pp.date = b.date
             LEFT JOIN pk_rates pk ON pk.team_abbreviation = b.team_abbreviation AND pk.date = b.date
             LEFT JOIN wgo_tiers w ON w.team_abbreviation = b.team_abbreviation AND w.date = b.date
        ), extras_z AS (
         SELECT e.team_abbreviation,
            e.date,
            e.season_id,
            e.finishing_delta_per60,
            e.goaltending_delta_per60,
            e.pdo,
            e.hdcf_share,
            e.pp_xgf60,
            e.pp_gf60,
            e.pk_xga60,
            e.pk_ga60,
            e.discipline_diff_per60,
            (e.finishing_delta_per60 - avg(e.finishing_delta_per60) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.finishing_delta_per60) OVER (PARTITION BY e.date), 0::numeric) AS finishing_z,
            (e.goaltending_delta_per60 - avg(e.goaltending_delta_per60) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.goaltending_delta_per60) OVER (PARTITION BY e.date), 0::numeric) AS goalie_z,
            (e.hdcf_share - avg(e.hdcf_share) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.hdcf_share) OVER (PARTITION BY e.date), 0::numeric) AS danger_z,
            (e.pp_xgf60 - avg(e.pp_xgf60) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.pp_xgf60) OVER (PARTITION BY e.date), 0::double precision) AS pp_off_z,
            (e.pk_xga60 - avg(e.pk_xga60) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.pk_xga60) OVER (PARTITION BY e.date), 0::double precision) AS pk_def_z,
            (e.discipline_diff_per60 - avg(e.discipline_diff_per60) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.discipline_diff_per60) OVER (PARTITION BY e.date), 0::numeric) AS discipline_z,
            (e.pdo - avg(e.pdo) OVER (PARTITION BY e.date)) / NULLIF(stddev_samp(e.pdo) OVER (PARTITION BY e.date), 0::numeric) AS pdo_z
           FROM extras e
        ), extended_raw AS (
         SELECT r.team_abbreviation,
            r.date,
            r.season_id,
            r.gp_to_date,
            r.league_xgf60_avg,
            r.league_xgf60_stddev,
            r.league_gf60_avg,
            r.league_gf60_stddev,
            r.league_sf60_avg,
            r.league_sf60_stddev,
            r.league_xga60_avg,
            r.league_xga60_stddev,
            r.league_ga60_avg,
            r.league_ga60_stddev,
            r.league_sa60_avg,
            r.league_sa60_stddev,
            r.league_pace60_avg,
            r.league_pace60_stddev,
            r.gp_weight,
            r.xgf60,
            r.gf60,
            r.sf60,
            r.xga60,
            r.ga60,
            r.sa60,
            r.pace60,
            r.xgf60_z,
            r.gf60_z,
            r.sf60_z,
            r.xga60_z,
            r.ga60_z,
            r.sa60_z,
            r.pace60_z,
            r.off_raw,
            r.def_raw,
            r.pace_raw,
            ex.finishing_z,
            ex.goalie_z,
            ex.danger_z,
            ex.pp_off_z,
            ex.pk_def_z,
            ex.discipline_z,
            ex.pdo_z
           FROM raw_scores r
             LEFT JOIN extras_z ex ON ex.team_abbreviation = r.team_abbreviation AND ex.date = r.date
        ), components AS (
         SELECT er.team_abbreviation,
            er.date,
            er.season_id,
            er.gp_to_date,
            er.league_xgf60_avg,
            er.league_xgf60_stddev,
            er.league_gf60_avg,
            er.league_gf60_stddev,
            er.league_sf60_avg,
            er.league_sf60_stddev,
            er.league_xga60_avg,
            er.league_xga60_stddev,
            er.league_ga60_avg,
            er.league_ga60_stddev,
            er.league_sa60_avg,
            er.league_sa60_stddev,
            er.league_pace60_avg,
            er.league_pace60_stddev,
            er.gp_weight,
            er.xgf60,
            er.gf60,
            er.sf60,
            er.xga60,
            er.ga60,
            er.sa60,
            er.pace60,
            er.xgf60_z,
            er.gf60_z,
            er.sf60_z,
            er.xga60_z,
            er.ga60_z,
            er.sa60_z,
            er.pace60_z,
            er.off_raw,
            er.def_raw,
            er.pace_raw,
            er.finishing_z,
            er.goalie_z,
            er.danger_z,
            er.pp_off_z,
            er.pk_def_z,
            er.discipline_z,
            er.pdo_z,
            100::numeric + 15::numeric * COALESCE(er.finishing_z, 0::numeric) AS finishing_rating,
            100::numeric + 15::numeric * COALESCE(er.goalie_z, 0::numeric) AS goalie_rating,
            100::numeric + 15::numeric * COALESCE(er.danger_z, 0::numeric) AS danger_rating,
            100::double precision + 15::double precision * (0.20::double precision * COALESCE(er.pp_off_z, 0::double precision) + 0.20::double precision * COALESCE(- er.pk_def_z, 0::double precision)) AS special_rating,
            100::numeric + 15::numeric * COALESCE(er.discipline_z, 0::numeric) AS discipline_rating,
                CASE
                    WHEN abs(COALESCE(er.pdo_z, 0::numeric)) >= 1.0 THEN 1
                    ELSE 0
                END AS variance_flag
           FROM extended_raw er
        )
 SELECT wt.date,
    wt.team_abbreviation,
    round(COALESCE(wt.off_rating, 100::numeric), 2) AS off_rating,
    round(COALESCE(wt.def_rating, 100::numeric), 2) AS def_rating,
    round(COALESCE(wt.pace_rating, 100::numeric), 2) AS pace_rating,
    wt.pp_tier,
    wt.pk_tier,
    round(COALESCE(wt.off_rating - wt.off_rating_last10, 0::numeric), 2) AS trend10,
    round(wt.xgf60, 4) AS xgf60,
    round(wt.gf60, 4) AS gf60,
    round(wt.sf60, 4) AS sf60,
    round(wt.xga60, 4) AS xga60,
    round(wt.ga60, 4) AS ga60,
    round(wt.sa60, 4) AS sa60,
    round(wt.pace60, 4) AS pace60,
    round(COALESCE(c.finishing_rating, 100::numeric), 2) AS finishing_rating,
    round(COALESCE(c.goalie_rating, 100::numeric), 2) AS goalie_rating,
    round(COALESCE(c.danger_rating, 100::numeric), 2) AS danger_rating,
    round(COALESCE(c.special_rating, 100::double precision)::numeric, 2) AS special_rating,
    round(COALESCE(c.discipline_rating, 100::numeric), 2) AS discipline_rating,
    c.variance_flag,
    timezone('utc'::text, now()) AS created_at
   FROM with_trend wt
     LEFT JOIN components c ON c.team_abbreviation = wt.team_abbreviation AND c.date = wt.date
  ORDER BY wt.date, wt.team_abbreviation;
```