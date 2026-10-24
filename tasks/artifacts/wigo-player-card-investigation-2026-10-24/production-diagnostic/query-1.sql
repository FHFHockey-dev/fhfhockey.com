BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
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
ROLLBACK;
