-- NOT APPLIED. Math-audit fix lane L4a (W2-1 D8).
-- Apply only with TJ's pop-up approval, singly, then record schema_migrations and migration-authority.json.
--
-- get_skaters_avg_stats averaged every skatersGameStats row in the date range, including preseason and
-- playoff games. The per-game means and the game count now use regular-season games (games.type = 2)
-- only. Signature, return type and the search_path set by 20260731035012 are kept. No sample floor is
-- added here (that would change the signature); readers own any minimum-games rule.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.get_skaters_avg_stats(start_date date, end_date date)
 RETURNS TABLE(id bigint, avggoals numeric, avgassists numeric, avgplusminus numeric, avgpim numeric, avghits numeric, avgblockedshots numeric, avgpowerplaypoints numeric, avgshots numeric, numgames bigint)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $$BEGIN
   RETURN QUERY
      SELECT
       "skatersGameStats"."playerId" AS "id",
       AVG("skatersGameStats"."goals") AS "avgGoals",
       AVG("skatersGameStats"."assists") AS "avgAssists",
       AVG("skatersGameStats"."plusMinus") AS "avgPlusMinus",
       AVG("skatersGameStats"."pim") AS "avgPim",
       AVG("skatersGameStats"."hits") AS "avgHits",
       AVG("skatersGameStats"."blockedShots") AS "avgBlockedShots",
       AVG("skatersGameStats"."powerPlayPoints") AS "avgPowerPlayPoints",
       AVG("skatersGameStats"."shots") AS "avgShots",
       COUNT("skatersGameStats"."playerId") AS "numGames"
   FROM
       "skatersGameStats"
   INNER JOIN
       "games" ON "skatersGameStats"."gameId" = "games"."id"
   WHERE
       "games"."date" >= start_date AND
       "games"."date" <= end_date AND
       "games"."type" = 2
   GROUP BY "skatersGameStats"."playerId";
END;$$;

commit;

-- READBACK (bounded): select numgames from public.get_skaters_avg_stats('2025-10-01', '2025-10-15') where id = 8478402;
--   -- expect regular-season games only (no preseason)
-- ROLLBACK: supabase/tests/l4a_sql_readers_rollback.sql.
