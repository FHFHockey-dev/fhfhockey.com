-- Run only via the adjacent private native-fixture runner. No hosted execution.
BEGIN;
DO $fixture$
BEGIN
  IF current_database() !~ '^wgo_null_guard_' OR inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'private Unix-socket fixture database required';
  END IF;
END;
$fixture$;

DO $semantics$
DECLARE
  r public.wgo_skater_stats;
BEGIN
  INSERT INTO public.wgo_skater_stats
    (id, player_id, player_name, date, game_id, season_id, shots,
     es_goals_for, pp_goals_for, sh_goals_for,
     es_goals_against, pp_goals_against, sh_goals_against)
  VALUES (900000001, 999000001, 'Fixture', '2026-10-08', 2026020061, 20262027, 2,
          0, 0, 0, 0, 0, 0);

  -- Ordinary refill conflict branch: explicit NULLs cannot erase repaired zeros.
  INSERT INTO public.wgo_skater_stats
    (id, player_id, player_name, date, game_id, season_id, shots,
     es_goals_for, pp_goals_for, sh_goals_for,
     es_goals_against, pp_goals_against, sh_goals_against)
  VALUES (900000001, 999000001, 'Fixture', '2026-10-08', 2026020061, 20262027, 4,
          NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (player_id, date) DO UPDATE SET
    shots = EXCLUDED.shots,
    es_goals_for = EXCLUDED.es_goals_for,
    pp_goals_for = EXCLUDED.pp_goals_for,
    sh_goals_for = EXCLUDED.sh_goals_for,
    es_goals_against = EXCLUDED.es_goals_against,
    pp_goals_against = EXCLUDED.pp_goals_against,
    sh_goals_against = EXCLUDED.sh_goals_against;
  SELECT * INTO r FROM public.wgo_skater_stats WHERE id = 900000001;
  ASSERT ARRAY[r.es_goals_for,r.pp_goals_for,r.sh_goals_for,
    r.es_goals_against,r.pp_goals_against,r.sh_goals_against] = ARRAY[0,0,0,0,0,0],
    'refill erased known zeros';
  ASSERT r.shots = 4, 'guard changed an unrelated incoming correction';

  -- A payload omitting game identity keeps the stored identity on conflict.
  -- The guard sees the actual NEW row, rather than guessing from payload keys.
  INSERT INTO public.wgo_skater_stats
    (id,player_id,player_name,date,es_goals_for,pp_goals_for,sh_goals_for,
     es_goals_against,pp_goals_against,sh_goals_against)
  VALUES (900000001,999000001,'Fixture','2026-10-08',
          NULL,NULL,NULL,NULL,NULL,NULL)
  ON CONFLICT (player_id,date) DO UPDATE SET
    es_goals_for=EXCLUDED.es_goals_for, pp_goals_for=EXCLUDED.pp_goals_for,
    sh_goals_for=EXCLUDED.sh_goals_for, es_goals_against=EXCLUDED.es_goals_against,
    pp_goals_against=EXCLUDED.pp_goals_against, sh_goals_against=EXCLUDED.sh_goals_against;
  SELECT * INTO r FROM public.wgo_skater_stats WHERE id=900000001;
  ASSERT r.game_id=2026020061 AND r.season_id=20262027
    AND ARRAY[r.es_goals_for,r.pp_goals_for,r.sh_goals_for,
      r.es_goals_against,r.pp_goals_against,r.sh_goals_against]=ARRAY[0,0,0,0,0,0],
    'omitted identity keys erased stored game values';

  UPDATE public.wgo_skater_stats SET
    es_goals_for = 1, pp_goals_for = 2, sh_goals_for = 3,
    es_goals_against = 4, pp_goals_against = 5, sh_goals_against = 6,
    shots = NULL WHERE id = 900000001;
  SELECT * INTO r FROM public.wgo_skater_stats WHERE id = 900000001;
  ASSERT ARRAY[r.es_goals_for,r.pp_goals_for,r.sh_goals_for,
    r.es_goals_against,r.pp_goals_against,r.sh_goals_against] = ARRAY[1,2,3,4,5,6],
    'non-null correction was blocked';
  ASSERT r.shots IS NULL, 'guard preserved an unrelated nullable column';

  UPDATE public.wgo_skater_stats SET
    es_goals_for = NULL, pp_goals_for = 0, sh_goals_for = NULL,
    es_goals_against = 0, pp_goals_against = NULL, sh_goals_against = 0
  WHERE id = 900000001;
  SELECT * INTO r FROM public.wgo_skater_stats WHERE id = 900000001;
  ASSERT ARRAY[r.es_goals_for,r.pp_goals_for,r.sh_goals_for,
    r.es_goals_against,r.pp_goals_against,r.sh_goals_against] = ARRAY[1,0,3,0,5,0],
    'mixed null/explicit-zero values were not handled field by field';

  -- Existing unknowns and new rows remain unknown; no fabricated zero.
  INSERT INTO public.wgo_skater_stats (id,player_id,player_name,date,game_id,season_id)
  VALUES (900000002,999000002,'Fixture','2026-10-08',2026020061,20262027);
  UPDATE public.wgo_skater_stats SET es_goals_for=NULL WHERE id=900000002;
  SELECT * INTO r FROM public.wgo_skater_stats WHERE id=900000002;
  ASSERT ARRAY[r.es_goals_for,r.pp_goals_for,r.sh_goals_for,
    r.es_goals_against,r.pp_goals_against,r.sh_goals_against]
    IS NOT DISTINCT FROM ARRAY[NULL,NULL,NULL,NULL,NULL,NULL]::integer[],
    'unknowns became observed zeros';
  UPDATE public.wgo_skater_stats SET es_goals_for=2 WHERE id=900000002;
  SELECT * INTO r FROM public.wgo_skater_stats WHERE id=900000002;
  ASSERT r.es_goals_for=2 AND r.pp_goals_for IS NULL,
    'genuine new observation or remaining unknown was lost';

  -- Do not carry observations across a corrected game identity.
  UPDATE public.wgo_skater_stats SET game_id=2026020062,
    es_goals_for=NULL,pp_goals_for=NULL,sh_goals_for=NULL,
    es_goals_against=NULL,pp_goals_against=NULL,sh_goals_against=NULL
  WHERE id=900000001;
  SELECT * INTO r FROM public.wgo_skater_stats WHERE id=900000001;
  ASSERT r.es_goals_for IS NULL AND r.sh_goals_against IS NULL,
    'old-game observations leaked into another game';

  -- Incomplete identity is not enough evidence to inherit stored counts.
  INSERT INTO public.wgo_skater_stats
    (id,player_id,player_name,date,game_id,season_id,es_goals_for)
  VALUES (900000003,999000003,'Fixture','2026-10-08',NULL,20262027,3);
  UPDATE public.wgo_skater_stats SET es_goals_for=NULL WHERE id=900000003;
  SELECT * INTO r FROM public.wgo_skater_stats WHERE id=900000003;
  ASSERT r.es_goals_for IS NULL, 'unidentified game inherited a count';
END;
$semantics$;
ROLLBACK;
