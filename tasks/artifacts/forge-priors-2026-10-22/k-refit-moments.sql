-- FORGE prior strength (k) re-fit: method of moments on per-player season totals, regular season 2023-24..2025-26.
-- Output: one row per season x position group (F/D) x strength (ES/PP), aggregates only, no player rows.
-- For a rate y/n with players i: S = sum n_i (y_i/n_i - p)^2, p = sum y / sum n, m = players, N = sum n, Q = sum n_i^2.
--   binomial (assist share A/GF, goals per shot G/S):  tau2 = (S - (m - 1) p (1 - p)) / (N - Q / N); k = p(1-p)/tau2 - 1
--   Poisson (shots per hour):                          tau2 = (S - (m - 1) p) / (N - Q / N);          k = p / tau2
-- Players need a minimum season exposure: GF >= 5 (assist share), S >= 20 (conversion), 2 h (shot rate).
SET statement_timeout = '45s';
WITH reg_dates AS (
  SELECT DISTINCT date FROM public.games WHERE type = 2 AND "seasonId" BETWEEN 20232024 AND 20252026
), pos AS (
  SELECT player_id, season_id AS season,
    CASE WHEN mode() WITHIN GROUP (ORDER BY position_code) = 'D' THEN 'D' ELSE 'F' END AS pos
  FROM public.wgo_skater_stats WHERE season_id BETWEEN 20232024 AND 20252026 AND games_played = 1
  GROUP BY player_id, season_id
), ind AS (
  SELECT 'ES' AS strength, player_id, season, date_scraped, toi, goals, total_assists, shots FROM public.nst_gamelog_es_counts WHERE season BETWEEN 20232024 AND 20252026
  UNION ALL SELECT 'PP', player_id, season, date_scraped, toi, goals, total_assists, shots FROM public.nst_gamelog_pp_counts WHERE season BETWEEN 20232024 AND 20252026
), oi AS (
  SELECT 'ES' AS strength, player_id, season, date_scraped, gf FROM public.nst_gamelog_es_counts_oi WHERE season BETWEEN 20232024 AND 20252026
  UNION ALL SELECT 'PP', player_id, season, date_scraped, gf FROM public.nst_gamelog_pp_counts_oi WHERE season BETWEEN 20232024 AND 20252026
), totals AS (
  SELECT i.strength, i.season, p.pos, i.player_id, sum(i.toi)::float8 / 3600 AS hours, sum(i.goals)::float8 AS g,
    sum(i.total_assists)::float8 AS a, sum(i.shots)::float8 AS s, sum(o.gf)::float8 AS gf
  FROM ind i
  JOIN reg_dates d ON d.date = i.date_scraped
  JOIN pos p ON p.player_id = i.player_id AND p.season = i.season
  LEFT JOIN oi o ON o.strength = i.strength AND o.player_id = i.player_id AND o.season = i.season AND o.date_scraped = i.date_scraped
  WHERE i.toi > 0
  GROUP BY i.strength, i.season, p.pos, i.player_id
), share AS (
  SELECT strength, season, pos, count(*) AS m, sum(gf) AS n, sum(gf * gf) AS q, sum(a) / sum(gf) AS p
  FROM totals WHERE gf >= 5 AND a <= gf GROUP BY strength, season, pos
), share_s AS (
  SELECT t.strength, t.season, t.pos, sum(t.gf * power(t.a / t.gf - s.p, 2)) AS s FROM totals t
  JOIN share s USING (strength, season, pos) WHERE t.gf >= 5 AND t.a <= t.gf GROUP BY t.strength, t.season, t.pos
), conv AS (
  SELECT strength, season, pos, count(*) AS m, sum(s) AS n, sum(s * s) AS q, sum(g) / sum(s) AS p
  FROM totals WHERE s >= 20 GROUP BY strength, season, pos
), conv_s AS (
  SELECT t.strength, t.season, t.pos, sum(t.s * power(t.g / t.s - c.p, 2)) AS s FROM totals t
  JOIN conv c USING (strength, season, pos) WHERE t.s >= 20 GROUP BY t.strength, t.season, t.pos
), rate AS (
  SELECT strength, season, pos, count(*) AS m, sum(hours) AS n, sum(hours * hours) AS q, sum(s) / sum(hours) AS p
  FROM totals WHERE hours >= 2 GROUP BY strength, season, pos
), rate_s AS (
  SELECT t.strength, t.season, t.pos, sum(t.hours * power(t.s / t.hours - r.p, 2)) AS s FROM totals t
  JOIN rate r USING (strength, season, pos) WHERE t.hours >= 2 GROUP BY t.strength, t.season, t.pos
)
SELECT sh.season, sh.pos, sh.strength,
  sh.m AS share_players, round(sh.p::numeric, 4) AS share_p,
  round(((ss.s - (sh.m - 1) * sh.p * (1 - sh.p)) / (sh.n - sh.q / sh.n))::numeric, 6) AS share_tau2,
  round((sh.p * (1 - sh.p) / NULLIF((ss.s - (sh.m - 1) * sh.p * (1 - sh.p)) / (sh.n - sh.q / sh.n), 0) - 1)::numeric, 1) AS share_k,
  c.m AS conv_players, round(c.p::numeric, 4) AS conv_p,
  round(((cs.s - (c.m - 1) * c.p * (1 - c.p)) / (c.n - c.q / c.n))::numeric, 6) AS conv_tau2,
  round((c.p * (1 - c.p) / NULLIF((cs.s - (c.m - 1) * c.p * (1 - c.p)) / (c.n - c.q / c.n), 0) - 1)::numeric, 1) AS conv_k,
  r.m AS rate_players, round(r.p::numeric, 4) AS rate_p,
  round(((rs.s - (r.m - 1) * r.p) / (r.n - r.q / r.n))::numeric, 6) AS rate_tau2,
  round((r.p / NULLIF((rs.s - (r.m - 1) * r.p) / (r.n - r.q / r.n), 0))::numeric, 2) AS rate_k_hours
FROM share sh
JOIN share_s ss USING (strength, season, pos)
JOIN conv c USING (strength, season, pos) JOIN conv_s cs USING (strength, season, pos)
JOIN rate r USING (strength, season, pos) JOIN rate_s rs USING (strength, season, pos)
ORDER BY sh.season, sh.pos, sh.strength;
