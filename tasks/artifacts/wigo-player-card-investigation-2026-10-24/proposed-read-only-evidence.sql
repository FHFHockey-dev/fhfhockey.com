-- PROPOSAL ONLY. NEVER RUN by this investigation. Requires separate authorization.
-- Run sequentially, concurrency one, stop when conclusive. No API/cron/RPC calls.
-- Query bounds: one player, <=2 season records, <=3 aggregate records,
-- <=3 totals records; then <=20 rows from each of three logs.
-- The latest-started season must be confirmed from batch 1; 20262027 below is
-- a calendar expectation, NOT a verified production season selection.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

-- Batch 1: identify the served player/season and stale/null override candidates.
SELECT 'player' AS source, to_jsonb(p) AS payload
FROM (SELECT id, "fullName", position, team_id FROM public.players WHERE id = 8476453 LIMIT 1) p
UNION ALL
SELECT 'season', to_jsonb(s) FROM (
  SELECT id, "startDate", "regularSeasonEndDate", "endDate" FROM public.seasons
  WHERE "startDate" <= CURRENT_DATE ORDER BY "startDate" DESC LIMIT 2
) s
UNION ALL
SELECT 'wigo_career', to_jsonb(c) FROM (SELECT * FROM public.wigo_career WHERE player_id = 8476453 LIMIT 1) c
UNION ALL
SELECT 'wigo_recent', to_jsonb(r) FROM (SELECT * FROM public.wigo_recent WHERE player_id = 8476453 LIMIT 1) r
UNION ALL
SELECT 'wigo_rates', to_jsonb(r) FROM (SELECT * FROM public.wigo_rates WHERE player_id = 8476453 LIMIT 1) r
UNION ALL
SELECT 'nhl_totals', to_jsonb(t) FROM (
  SELECT season, games_played, goals, points, shots, toi_per_game
  FROM public.wgo_skater_stats_totals WHERE player_id = 8476453
  ORDER BY season DESC LIMIT 3
) t;

-- Batch 2 ONLY IF batch 1 cannot explain missing recent metrics.
-- These mirror the reader's cross-season latest-20 input selection.
WITH nhl AS (
  SELECT game_id, date, season_id, games_played, toi_per_game, pp_toi,
         goals, assists, points, total_primary_assists, shots, pp_points
  FROM public.wgo_skater_stats WHERE player_id = 8476453
  ORDER BY date DESC LIMIT 20
), individual AS (
  SELECT date_scraped, season, gp, toi, goals, total_points, shots, ixg, icf, iscfs, hdcf
  FROM public.nst_gamelog_as_counts WHERE player_id = 8476453
  ORDER BY date_scraped DESC LIMIT 20
), on_ice AS (
  SELECT date_scraped, season, gp, toi, gf, sf, xgf, xga, cf, scf
  FROM public.nst_gamelog_as_counts_oi WHERE player_id = 8476453
  ORDER BY date_scraped DESC LIMIT 20
)
SELECT 'nhl_log' AS source, to_jsonb(n) AS payload FROM nhl n
UNION ALL SELECT 'nst_individual_log', to_jsonb(i) FROM individual i
UNION ALL SELECT 'nst_on_ice_log', to_jsonb(o) FROM on_ice o;

-- Batch 3 ONLY IF STD/percentile freshness remains unresolved.
-- Replace seasons if batch 1 selected another season; do not guess it.
SELECT 'seasonal_individual' AS source, to_jsonb(i) AS payload FROM (
  SELECT season, strength, team, gp, toi, shots, ixg, icf, iscfs, ipp, sh_percentage
  FROM public.nst_seasonal_individual_counts WHERE player_id = 8476453
    AND season IN (20262027, 20252026) AND strength = 'all'
  ORDER BY season DESC, team LIMIT 12
) i
UNION ALL
SELECT 'seasonal_on_ice', to_jsonb(o) FROM (
  SELECT season, strength, team, gp, toi, gf, sf, cf, scf, xgf, xga, xgf_pct, on_ice_sh_pct
  FROM public.nst_seasonal_on_ice_counts WHERE player_id = 8476453
    AND season IN (20262027, 20252026) AND strength = 'all'
  ORDER BY season DESC, team LIMIT 12
) o
UNION ALL
SELECT 'as_percentile', to_jsonb(p) FROM (
  SELECT season, gp, toi_seconds, shots_per_60, icf_per_60, iscfs_per_60,
         ixg_per_60, cf_per_60, scf_per_60, xgf_per_60, xgf_pct,
         ipp, sh_percentage, on_ice_sh_pct
  FROM public.nst_percentile_as_offense WHERE player_id = 8476453
    AND season IN (20262027, 20252026) ORDER BY season DESC LIMIT 2
) p;
ROLLBACK;
