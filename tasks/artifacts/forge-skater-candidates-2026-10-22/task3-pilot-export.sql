-- PROPOSAL ONLY. Do not execute without TJ's separate approval for this exact pilot.
-- Target: FHFH production project fyhftlxokyjtpndbkfse, public schema.
-- One read-only snapshot, one SELECT, one attempt, no automatic retry/pagination.
-- Dates [2026-10-01, 2026-10-22); season 20262027; <=10000 WGO identities.
-- No names, birthdays, accounts, credentials, league/roster data or write endpoints.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '20s';
SET LOCAL max_parallel_workers_per_gather = 0;

WITH canonical AS MATERIALIZED (
  SELECT w.id AS wgo_id, w.player_id, w.game_id, w.date, w.season_id,
    w.position_code, w.games_played, g.date AS canonical_date,
    g."seasonId" AS canonical_season, g.type AS game_type, g."startTime" AS game_start
  FROM public.wgo_skater_stats w
  LEFT JOIN public.games g ON g.id = w.game_id
  WHERE w.date >= DATE '2026-10-01' AND w.date < DATE '2026-10-22'
    AND w.season_id = 20262027 AND w.games_played = 1
  ORDER BY w.date, w.game_id, w.player_id, w.id
  LIMIT 10001 -- sentinel: do not silently fit a truncated universe
), exported_rows AS (
  SELECT c.*, es_ind.rows AS es_ind, es_oi.rows AS es_oi,
    pp_ind.rows AS pp_ind, pp_oi.rows AS pp_oi
  FROM canonical c
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'playerId', s.player_id,
      'season', s.season, 'date', s.date_scraped, 'gp', s.gp, 'toiSeconds', s.toi,
      'goals', s.goals, 'assists', s.total_assists, 'points', s.total_points) ORDER BY s.id), '[]'::jsonb) AS rows
    FROM (SELECT id, player_id, season, date_scraped, gp, toi, goals, total_assists, total_points
      FROM public.nst_gamelog_es_counts
      WHERE player_id = c.player_id AND date_scraped = c.date AND season = c.season_id
      ORDER BY id LIMIT 2) s
  ) es_ind ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'playerId', s.player_id,
      'season', s.season, 'date', s.date_scraped, 'gp', s.gp, 'toiSeconds', s.toi,
      'goalsFor', s.gf) ORDER BY s.id), '[]'::jsonb) AS rows
    FROM (SELECT id, player_id, season, date_scraped, gp, toi, gf
      FROM public.nst_gamelog_es_counts_oi
      WHERE player_id = c.player_id AND date_scraped = c.date AND season = c.season_id
      ORDER BY id LIMIT 2) s
  ) es_oi ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'playerId', s.player_id,
      'season', s.season, 'date', s.date_scraped, 'gp', s.gp, 'toiSeconds', s.toi,
      'goals', s.goals, 'assists', s.total_assists, 'points', s.total_points) ORDER BY s.id), '[]'::jsonb) AS rows
    FROM (SELECT id, player_id, season, date_scraped, gp, toi, goals, total_assists, total_points
      FROM public.nst_gamelog_pp_counts
      WHERE player_id = c.player_id AND date_scraped = c.date AND season = c.season_id
      ORDER BY id LIMIT 2) s
  ) pp_ind ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'playerId', s.player_id,
      'season', s.season, 'date', s.date_scraped, 'gp', s.gp, 'toiSeconds', s.toi,
      'goalsFor', s.gf) ORDER BY s.id), '[]'::jsonb) AS rows
    FROM (SELECT id, player_id, season, date_scraped, gp, toi, gf
      FROM public.nst_gamelog_pp_counts_oi
      WHERE player_id = c.player_id AND date_scraped = c.date AND season = c.season_id
      ORDER BY id LIMIT 2) s
  ) pp_oi ON true
  WHERE (SELECT count(*) FROM canonical) <= 10000
), payload AS (
  SELECT jsonb_build_object(
    'schema', 'forge-assist-pilot-v1', 'projectRef', 'fyhftlxokyjtpndbkfse',
    'season', 20262027, 'fromInclusive', '2026-10-01', 'toExclusive', '2026-10-22',
    'rowLimit', 10000, 'exportedAt', transaction_timestamp(),
    'evidence', 'current_snapshot_not_historical_asof',
    'canonicalRowCount', (SELECT count(*) FROM canonical),
    'truncated', (SELECT count(*) > 10000 FROM canonical),
    'rows', COALESCE(jsonb_agg(jsonb_build_object(
      'wgoId', c.wgo_id, 'playerId', c.player_id, 'gameId', c.game_id,
      'date', c.date, 'season', c.season_id, 'position', c.position_code,
      'gamesPlayed', c.games_played, 'canonicalDate', c.canonical_date,
      'canonicalSeason', c.canonical_season, 'gameType', c.game_type, 'gameStart', c.game_start,
      'ES', jsonb_build_object('individual', c.es_ind, 'onIce', c.es_oi),
      'PP', jsonb_build_object('individual', c.pp_ind, 'onIce', c.pp_oi)
    ) ORDER BY c.date, c.game_id, c.player_id, c.wgo_id), '[]'::jsonb)
  ) AS export
  FROM exported_rows c
)
SELECT CASE WHEN octet_length(export::text) > 16777216
  THEN jsonb_build_object('error', 'export_exceeds_16MiB')
  ELSE export END AS export
FROM payload;
ROLLBACK;
