DO $$
DECLARE today date := (clock_timestamp() AT TIME ZONE 'America/New_York')::date;
receipt jsonb; result jsonb; queue_row public.player_forecast_season_queue; n integer;
BEGIN
 receipt := jsonb_build_array(jsonb_build_object('key','overnight','date',today,'status','complete',
   'revision','synthetic-r1','expectedItems',12,'completedItems',12,'completedAt',clock_timestamp()-interval '1 minute'));
 result := public.enqueue_player_forecast_morning_cadence(today,'current',ARRAY['overnight'],jsonb_set(receipt,'{0,status}','"partial"'));
 ASSERT result->>'outcome'='held','partial held';
 ASSERT (SELECT count(*) FROM public.player_forecast_season_queue)=0,'partial no writes';
 result := public.enqueue_player_forecast_morning_cadence(today,'current',ARRAY['overnight'],jsonb_set(receipt,'{0,completedItems}','11'));
 ASSERT result->>'outcome'='held','missing item held';
 result := public.enqueue_player_forecast_morning_cadence(today,'current',ARRAY['overnight'],receipt);
 ASSERT result->>'outcome'='enqueued','initial enqueue';
 result := public.enqueue_player_forecast_morning_cadence(today,'current',ARRAY['overnight'],receipt);
 ASSERT result->>'outcome'='deduplicated','pending dedup';
 SELECT * INTO queue_row FROM public.player_forecast_season_queue LIMIT 1;
 UPDATE public.player_forecast_season_queue SET status='succeeded' WHERE id=queue_row.id;
 result := public.enqueue_player_forecast_morning_cadence(today,'current',ARRAY['overnight'],receipt);
 ASSERT result->>'status'='succeeded','success never reopened';
 UPDATE public.player_forecast_season_queue SET status='failed',attempt_count=2 WHERE id=queue_row.id;
 result := public.enqueue_player_forecast_morning_cadence(today,'current',ARRAY['overnight'],receipt);
 ASSERT (result->>'recoveryEligible')::boolean,'failed recovery eligible';
 SELECT count(*) INTO n FROM public.claim_player_forecast_season_jobs(gen_random_uuid(),8,780);
 ASSERT n=1,'third bounded attempt allowed';
 UPDATE public.player_forecast_season_queue SET status='failed',lease_owner=null,lease_expires_at=null,claimed_watermark=null WHERE id=queue_row.id;
 SELECT count(*) INTO n FROM public.claim_player_forecast_season_jobs(gen_random_uuid(),8,780);
 ASSERT n=0,'fourth attempt blocked';
 result := public.enqueue_player_forecast_morning_cadence(today,'current',ARRAY['overnight'],receipt);
 ASSERT NOT (result->>'recoveryEligible')::boolean,'exhaustion observable';
 PERFORM public.enqueue_player_forecast_season_job('legacy-test',20262027,'current',NULL::smallint,NULL::smallint,NULL::bigint,'daily_refresh',clock_timestamp(),now()-interval '1 minute');
 UPDATE public.player_forecast_season_queue SET status='failed',attempt_count=5 WHERE scope_key='legacy-test';
 SELECT count(*) INTO n FROM public.claim_player_forecast_season_jobs(gen_random_uuid(),8,780);
 ASSERT n=1,'legacy semantics preserved';
 ASSERT ('2026-03-08 08:00'::timestamp AT TIME ZONE 'America/New_York')='2026-03-08T12:00:00Z'::timestamptz,'spring DST';
 ASSERT ('2026-11-01 08:00'::timestamp AT TIME ZONE 'America/New_York')='2026-11-01T13:00:00Z'::timestamptz,'autumn DST';
 RAISE NOTICE '13 cadence assertions passed';
END $$;
