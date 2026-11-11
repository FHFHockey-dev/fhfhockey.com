-- NOT APPLIED. Math-audit fix lane L4a (W2-1 D3 / PR-SQL-3, D6; decision 85).
-- Apply only with TJ's pop-up approval, singly, then record schema_migrations and migration-authority.json.
--
-- get_skater_game_scores_for_season filtered wgo_skater_stats by season_id only, and the 20242025 label
-- carries rows dated 2010-2017, so the Game Score chart showed games from other seasons. A row now counts
-- only when its game is a regular-season game (type 2) of the requested season: by game_id when the row
-- has one, otherwise by a regular-season game of that season on the row's date. Signature, return type,
-- SECURITY DEFINER and the search_path set by 20260731035012 are kept; the formula is unchanged.
-- The chart calendar (fetchWigoPlayerStats.ts) is a separate reader (lane L4b). The mislabelled rows
-- themselves are a separate, separately approved data repair.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.get_skater_game_scores_for_season(p_player_id integer, p_season_id integer)
 RETURNS TABLE(game_date date, game_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT sub.game_date, sub.game_score
  FROM (
    SELECT
        wgs.date AS game_date,
        (
          0.75 * wgs.goals +
          0.7 * wgs.total_primary_assists +
          0.55 * wgs.total_secondary_assists +
          0.075 * wgs.shots +
          0.05 * wgs.blocked_shots +
          0.15 * wgs.penalties_drawn -
          0.15 * wgs.penalties +
          0.01 * wgs.total_fow -
          0.01 * wgs.total_fol +
          0.05 * wgs.sat_for -
          0.05 * wgs.sat_against +
          0.15 * (wgs.es_goals_for + wgs.pp_goals_for + wgs.sh_goals_for) -
          0.15 * (wgs.es_goals_against + wgs.pp_goals_against + wgs.sh_goals_against)
        )::numeric AS game_score
    FROM
        "wgo_skater_stats" wgs
    WHERE
        wgs."player_id" = p_player_id
        AND wgs."season_id" = p_season_id
        AND EXISTS (
          SELECT 1
          FROM public.games g
          WHERE g."seasonId" = p_season_id
            AND g.type = 2
            AND CASE WHEN wgs.game_id IS NOT NULL THEN g.id = wgs.game_id ELSE g.date = wgs.date END
        )
  ) sub
  WHERE sub.game_score IS NOT NULL
  ORDER BY sub.game_date ASC;
END;
$$;

COMMENT ON FUNCTION public.get_skater_game_scores_for_season(integer, integer) IS
  'FHFH Game Score (all-situation goals), regular season of the requested season only. Per game: '
  '0.75 G + 0.7 A1 + 0.55 A2 + 0.075 SOG + 0.05 BLK + 0.15 PD - 0.15 PEN + 0.01 FOW - 0.01 FOL '
  '+ 0.05 SAT_for - 0.05 SAT_against + 0.15 (ES+PP+SH on-ice GF) - 0.15 (ES+PP+SH on-ice GA). '
  'Goal terms are all-situation, not 5v5 (decision 85).';

commit;

-- READBACK (bounded):
-- select count(*), min(game_date), max(game_date)
--   from public.get_skater_game_scores_for_season(8478402, 20242025);  -- expect dates within 2024-10..2025-04 only
-- select proconfig, prosecdef from pg_proc where oid = 'public.get_skater_game_scores_for_season(integer,integer)'::regprocedure;
--   -- expect {"search_path=pg_catalog, public, extensions, pg_temp"}, true
-- ROLLBACK: supabase/tests/l4a_sql_readers_rollback.sql (baseline body + the 20260731035012 search_path).
