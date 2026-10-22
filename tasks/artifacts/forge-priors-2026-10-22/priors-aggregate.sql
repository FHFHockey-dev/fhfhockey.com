-- FORGE tasks 3/4/5 priors: one read-only aggregate over NST game logs (regular season, 2023-24 onward).
-- Output: one row per season x position group (F/D) x strength (ES/PP/PK), aggregates only, no player rows.
-- Split-half reliability: each player's games alternate into halves by date order; r = corr(half1 rate, half2 rate)
-- across players with exposure in both halves; k = mean per-half exposure x (1 - r) / r (Spearman-Brown style).
SET statement_timeout = '45s';
WITH reg_dates AS (
  SELECT DISTINCT date FROM public.games WHERE type = 2 AND "seasonId" >= 20232024
), pos AS (
  SELECT player_id, season_id AS season,
    CASE WHEN mode() WITHIN GROUP (ORDER BY position_code) = 'D' THEN 'D' ELSE 'F' END AS pos
  FROM public.wgo_skater_stats WHERE season_id >= 20232024 AND games_played = 1
  GROUP BY player_id, season_id
), ind AS (
  SELECT 'ES' AS strength, player_id, season, date_scraped, toi, goals, total_assists, first_assists, total_points, shots FROM public.nst_gamelog_es_counts WHERE season >= 20232024
  UNION ALL SELECT 'PP', player_id, season, date_scraped, toi, goals, total_assists, first_assists, total_points, shots FROM public.nst_gamelog_pp_counts WHERE season >= 20232024
  UNION ALL SELECT 'PK', player_id, season, date_scraped, toi, goals, total_assists, first_assists, total_points, shots FROM public.nst_gamelog_pk_counts WHERE season >= 20232024
), oi AS (
  SELECT 'ES' AS strength, player_id, season, date_scraped, gf FROM public.nst_gamelog_es_counts_oi WHERE season >= 20232024
  UNION ALL SELECT 'PP', player_id, season, date_scraped, gf FROM public.nst_gamelog_pp_counts_oi WHERE season >= 20232024
  UNION ALL SELECT 'PK', player_id, season, date_scraped, gf FROM public.nst_gamelog_pk_counts_oi WHERE season >= 20232024
), games AS (
  SELECT i.strength, i.player_id, i.season, p.pos, i.toi::float8 AS toi, i.goals::float8 AS g, i.total_assists::float8 AS a,
    i.first_assists::float8 AS a1, i.total_points::float8 AS pts, i.shots::float8 AS sog, o.gf::float8 AS gf,
    row_number() OVER (PARTITION BY i.strength, i.player_id, i.season ORDER BY i.date_scraped) % 2 AS half
  FROM ind i
  JOIN reg_dates d ON d.date = i.date_scraped
  JOIN pos p ON p.player_id = i.player_id AND p.season = i.season
  LEFT JOIN oi o ON o.strength = i.strength AND o.player_id = i.player_id AND o.season = i.season AND o.date_scraped = i.date_scraped
  WHERE i.toi > 0
), halves AS (
  SELECT strength, season, pos, player_id, half, sum(toi) AS toi, sum(g) AS g, sum(a) AS a, sum(pts) AS pts, sum(sog) AS sog, sum(gf) AS gf
  FROM games GROUP BY strength, season, pos, player_id, half
), paired AS (
  SELECT h0.strength, h0.season, h0.pos,
    h0.a / NULLIF(h0.gf, 0) AS as0, h1.a / NULLIF(h1.gf, 0) AS as1, (h0.gf + h1.gf) / 2 AS gf_n,
    h0.pts / NULLIF(h0.gf, 0) AS ipp0, h1.pts / NULLIF(h1.gf, 0) AS ipp1,
    h0.sog / NULLIF(h0.toi / 3600, 0) AS sog0, h1.sog / NULLIF(h1.toi / 3600, 0) AS sog1, (h0.toi + h1.toi) / 7200 AS hours_n,
    h0.g / NULLIF(h0.sog, 0) AS sh0, h1.g / NULLIF(h1.sog, 0) AS sh1, (h0.sog + h1.sog) / 2 AS sog_n,
    h0.g / NULLIF(h0.toi / 3600, 0) AS g60_0, h1.g / NULLIF(h1.toi / 3600, 0) AS g60_1,
    h0.a / NULLIF(h0.toi / 3600, 0) AS a60_0, h1.a / NULLIF(h1.toi / 3600, 0) AS a60_1
  FROM halves h0 JOIN halves h1 USING (strength, season, pos, player_id)
  WHERE h0.half = 0 AND h1.half = 1
), totals AS (
  SELECT strength, season, pos, count(DISTINCT player_id) AS players, count(*) AS player_games, sum(toi) AS toi_s,
    sum(g) AS g, sum(a) AS a, sum(a1) AS a1, sum(pts) AS pts, sum(sog) AS sog, sum(gf) AS on_ice_gf,
    count(*) FILTER (WHERE gf IS NULL) AS missing_oi
  FROM games GROUP BY strength, season, pos
), reliability AS (
  SELECT strength, season, pos,
    count(*) FILTER (WHERE as0 IS NOT NULL AND as1 IS NOT NULL) AS n_as, corr(as0, as1) AS r_as, avg(gf_n) FILTER (WHERE as0 IS NOT NULL AND as1 IS NOT NULL) AS gf_per_half,
    corr(ipp0, ipp1) AS r_ipp,
    count(*) FILTER (WHERE hours_n > 0) AS n_sog60, corr(sog0, sog1) AS r_sog60, avg(hours_n) AS hours_per_half,
    count(*) FILTER (WHERE sh0 IS NOT NULL AND sh1 IS NOT NULL) AS n_sh, corr(sh0, sh1) AS r_sh, avg(sog_n) FILTER (WHERE sh0 IS NOT NULL AND sh1 IS NOT NULL) AS sog_per_half,
    corr(g60_0, g60_1) AS r_g60, corr(a60_0, a60_1) AS r_a60
  FROM paired GROUP BY strength, season, pos
)
SELECT t.season, t.pos, t.strength, t.players, t.player_games, round(t.toi_s) AS toi_s, t.g, t.a, t.a1, t.pts, t.sog, t.on_ice_gf, t.missing_oi,
  r.n_as, round(r.r_as::numeric, 4) AS r_as, round(r.gf_per_half::numeric, 2) AS gf_per_half, round(r.r_ipp::numeric, 4) AS r_ipp,
  r.n_sog60, round(r.r_sog60::numeric, 4) AS r_sog60, round(r.hours_per_half::numeric, 3) AS hours_per_half,
  r.n_sh, round(r.r_sh::numeric, 4) AS r_sh, round(r.sog_per_half::numeric, 2) AS sog_per_half,
  round(r.r_g60::numeric, 4) AS r_g60, round(r.r_a60::numeric, 4) AS r_a60
FROM totals t JOIN reliability r USING (strength, season, pos)
ORDER BY t.season, t.pos, t.strength;
