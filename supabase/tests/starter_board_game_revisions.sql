-- Run only in an empty isolated database with the complete application schema
-- and all Starter Board migrations installed. Fixtures roll back together.
begin;
create function pg_temp.board_input_fixture(p_id uuid,p_payload jsonb) returns void
language sql as $$
  insert into public.player_forecast_source_observations(id,provider,dataset_key,entity_kind,entity_key,observed_at,available_at,payload_hash,payload)
    values(p_id,'forge','forge-run-inputs-v1','projection_run',p_id::text,
      (p_payload->>'inputCutoff')::timestamptz,(p_payload->>'inputCutoff')::timestamptz,
      encode(extensions.digest(p_payload::text,'sha256'),'hex'),p_payload);
$$;
insert into public.seasons(id,"startDate","endDate","regularSeasonEndDate","numberOfGames")
  values(20262027,current_date-365,current_date+365,current_date+300,82);
insert into public.teams(id,name,abbreviation) values(8,'Fixture Montreal','MTL'),(10,'Fixture Toronto','TOR');
insert into public.line_source_snapshots(capture_key,source_group,source_key,source_account,snapshot_date,source,team_id,team_abbreviation,team_name,primary_text_source)
  select key,'test','test','test',current_date,'manual fixture',10,'TOR','Fixture Toronto','manual_fixture'
  from (
    select unnest(array['queue-first','queue-second','expired-worker','atomic-lineup-test','atomic-goalie-a','atomic-goalie-b',
      'future-goalie','mixed-goalie','correction-original','correction-new','correction-late','correction-agreement','two-goalies',
      'operations-first','operations-second','operations-pending','review-920001','review-920002','review-920003']) as key
    union all select 'slate-'||i from generate_series(1,16) i
  ) sources;
insert into public.players(id,"firstName","lastName","fullName",position,"birthDate","heightInCentimeters","weightInKilograms")
  select id,'Fixture',id::text,'Fixture '||id,'C','2000-01-01',180,80
  from unnest(array[7,42,43,910009,910010,910011,910012,910013]) id;
insert into public.games(id, date, "seasonId", "startTime", "homeTeamId", "awayTeamId") values
  (910001, current_date, 20262027, now() + interval '2 hours', 10, 8),
  (910002, current_date, 20262027, now() + interval '3 hours', 10, 8),
  (910003, current_date, 20262027, now() - interval '1 hour', 10, 8);
insert into public.forge_runs(run_id, as_of_date, status) values
  ('00000000-0000-0000-0000-000000000001', current_date, 'succeeded'),
  ('00000000-0000-0000-0000-000000000002', current_date, 'succeeded'),
  ('00000000-0000-0000-0000-000000000003', current_date, 'failed');
select pg_temp.board_input_fixture(r.run_id,
  jsonb_build_object('version','forge-inputs-v1','replayClassification','captured_live','horizonGames',1,
    'slateDate',current_date,'decisionAsOf',now() - interval '5 minutes' + (right(r.run_id::text,1)::integer * interval '1 minute'),
    'inputCutoff',now()-interval '10 minutes',
    'goalieStarts','[]'::jsonb))
from public.forge_runs r;
insert into public.forge_player_projections(run_id, game_id, player_id, team_id, horizon_games, as_of_date, opponent_team_id)
select r.run_id, g.id, t.id + g.id, t.id, 1, current_date, case when t.id=8 then 10 else 8 end from public.forge_runs r
cross join public.games g cross join (values(8),(10)) t(id)
where r.run_id <> '00000000-0000-0000-0000-000000000002' or g.id = 910001;
insert into public.forge_team_projections(run_id, game_id, team_id, horizon_games, as_of_date, opponent_team_id)
select distinct run_id, game_id, team_id, horizon_games, as_of_date, opponent_team_id from public.forge_player_projections;
do $$
declare n integer;
begin
  n := public.publish_forge_game_revisions('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
  if n <> 2 then raise exception 'Expected two pregame publications, got %', n; end if;
  n := public.publish_forge_game_revisions('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
  if n <> 0 then raise exception 'Duplicate publication was not idempotent'; end if;
  n := public.publish_forge_game_revisions('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002');
  if n <> 1 then raise exception 'Bounded update did not publish exactly one game'; end if;
  if (select count(*) from public.read_forge_game_revisions(current_date)) <> 2 then
    raise exception 'Bounded update lost an unaffected game';
  end if;
  if not exists (select 1 from public.read_forge_game_revisions(current_date)
    where game_id=910002 and run_id='00000000-0000-0000-0000-000000000001') then
    raise exception 'Unaffected revision changed';
  end if;
  if exists (select 1 from public.forge_game_revisions where game_id=910003) then
    raise exception 'Published after puck drop';
  end if;
  begin
    perform public.publish_forge_game_revisions('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003');
    raise exception using errcode='ZX001',message='Failed run published';
  exception when raise_exception then null; end;
  begin
    update public.forge_game_revisions set payload='{}';
    raise exception using errcode='ZX001',message='Immutable publication updated';
  exception when sqlstate '55000' then null; end;
  if has_table_privilege('anon','public.forge_game_revisions','SELECT')
    or has_function_privilege('authenticated','public.publish_forge_game_revisions(uuid,uuid)','EXECUTE') then
    raise exception 'Private publication data exposed';
  end if;
end;
$$;

do $$
declare future_run uuid := gen_random_uuid(); partial_run uuid := gen_random_uuid();
begin
  insert into public.forge_runs(run_id,as_of_date,status) values(future_run,current_date,'succeeded'),(partial_run,current_date,'succeeded');
  perform pg_temp.board_input_fixture(r.run_id,jsonb_build_object(
      'version','forge-inputs-v1','replayClassification','captured_live','horizonGames',1,'slateDate',current_date,
      'decisionAsOf',case when r.run_id=future_run then now()+interval '1 hour' else now() end,'inputCutoff',now()-interval '1 minute'))
    from public.forge_runs r where run_id in (future_run,partial_run);
  begin
    perform public.publish_forge_game_revisions(future_run,future_run);
    raise exception using errcode='ZX001',message='Future cutoff published';
  exception when raise_exception then null; end;
  begin
    perform public.publish_forge_game_revisions(partial_run,'00000000-0000-0000-0000-000000000001');
    raise exception using errcode='ZX001',message='Snapshot for another run accepted';
  exception when raise_exception then null; end;
  insert into public.forge_player_projections(run_id,game_id,player_id,team_id,horizon_games,as_of_date,opponent_team_id) values(partial_run,910001,7,10,1,current_date,8);
  insert into public.forge_team_projections(run_id,game_id,team_id,horizon_games,as_of_date,opponent_team_id) values(partial_run,910001,10,1,current_date,8);
  if public.publish_forge_game_revisions(partial_run,partial_run)<>0 then raise exception 'One-team partial revision published'; end if;
  if not exists(select 1 from public.read_forge_game_revisions(current_date) where game_id=910001 and run_id='00000000-0000-0000-0000-000000000002') then
    raise exception 'Failed/partial attempt displaced last successful board'; end if;
end; $$;

-- Independent game claims, bounded debounce, supersession, and dispatch timing.
insert into public.player_forecast_lineup_snapshots(game_id,team_id,accepted,observed_at,available_at,source_group,source_key,source_capture_key,classification,parser_version)
  values(910001,10,true,now()-interval '1 minute',now(),'test','test','queue-first','lineup','test');
do $$
declare owner uuid := gen_random_uuid(); first_ready timestamptz; claimed record; r1 uuid; r2 uuid;
begin
  select not_before into first_ready from public.forge_game_update_queue where game_id=910001;
  insert into public.player_forecast_lineup_snapshots(game_id,team_id,accepted,observed_at,available_at,source_group,source_key,source_capture_key,classification,parser_version)
    values(910001,8,true,now(),now(),'test','test','queue-second','lineup','test');
  if (select not_before from public.forge_game_update_queue where game_id=910001)<>first_ready then
    raise exception 'News extended the coalescing window'; end if;
  if (select count(*) from public.claim_starter_board_jobs(owner,4))<>0 then raise exception 'Claimed before coalescing elapsed'; end if;
  update public.forge_game_update_queue set not_before=now()-interval '1 second' where game_id=910001;
  select * into claimed from public.claim_starter_board_jobs(owner,4);
  if claimed.claimed_version<>2 then raise exception 'Claim did not capture latest version'; end if;
  if (select count(*) from public.claim_starter_board_jobs(gen_random_uuid(),4))<>0 then raise exception 'Duplicate concurrent claim'; end if;
  insert into public.player_forecast_goalie_start_observations(game_id,team_id,accepted,observed_at,available_at,player_id,observation_status,source_group,source_key,parser_version)
    values(910001,10,true,now(),now(),42,'confirmed','test','queue-goalie','test');
  perform public.finish_starter_board_job(910001,owner,null,'superseded');
  if (select status from public.forge_game_update_queue where game_id=910001)<>'pending' then raise exception 'Superseded job did not requeue'; end if;
  insert into public.player_forecast_observation_conflicts(id,game_id,team_id,conflict_key,conflict_version,conflict_type,detected_at,source_high_watermark,summary)
    values('00000000-0000-0000-0000-000000000099',910001,10,'queue-review',1,'lineup',now(),now(),'Fixture conflict');
  insert into public.player_forecast_conflict_resolutions(conflict_id,resolved_at,resolution_version,action)
    values('00000000-0000-0000-0000-000000000099',clock_timestamp(),1,'dismiss');
  if (select version from public.forge_game_update_queue where game_id=910001)<>4 then raise exception 'Conflict review did not enqueue a new game revision'; end if;
  if (select count(*) from public.forge_board_news_events where game_id=910001)<>4 then raise exception 'Accepted news history lost'; end if;
  if not exists(select 1 from public.forge_board_dispatch_observations where game_id=910001 and queue_version=2 and lease_owner=owner) then raise exception 'Dispatch timestamp missing'; end if;
  begin
    -- Remove the unique-key obstacle so the stale-input guard is exercised.
    insert into public.forge_game_revisions(run_id,game_id,slate_date,input_snapshot_id,decision_as_of,payload)
      values('00000000-0000-0000-0000-000000000003',910001,current_date,
        '00000000-0000-0000-0000-000000000003',now()-interval '1 minute','{}');
    raise exception using errcode='ZX001',message='Superseded input published';
  exception when raise_exception then null; end;
  r1 := public.begin_forge_game_run(current_date,array[910001]::bigint[],'test-code');
  r2 := public.begin_forge_game_run(current_date,array[910002]::bigint[],'test-code');
  begin
    perform public.begin_forge_game_run(current_date,array[910001]::bigint[],'test-code');
    raise exception using errcode='ZX001',message='Overlapping game run allowed';
  exception when raise_exception then null; end;
  begin
    perform public.begin_forge_game_run(current_date,array[]::bigint[],'test-code');
    raise exception using errcode='ZX001',message='Overlapping full-slate run allowed';
  exception when raise_exception then null; end;
  if has_table_privilege('anon','public.forge_game_update_queue','SELECT') then raise exception 'Queue exposed publicly'; end if;
end; $$;

-- Lease replacement does not wait for the general ten-minute run timeout.
insert into public.games(id,date,"seasonId","startTime","homeTeamId","awayTeamId") values(910004,current_date,20262027,now()+interval '2 hours',10,8);
insert into public.player_forecast_lineup_snapshots(game_id,team_id,accepted,observed_at,available_at,source_group,source_key,source_capture_key,classification,parser_version)
  values(910004,10,true,now(),now(),'test','test','expired-worker','lineup','test');
update public.forge_game_update_queue set not_before=now()-interval '1 second' where game_id=910004;
do $$
declare owner1 uuid:=gen_random_uuid(); owner2 uuid:=gen_random_uuid(); run1 uuid; run2 uuid;
begin
  perform public.claim_starter_board_jobs(owner1,16);
  run1:=public.begin_forge_game_run(current_date,array[910004]::bigint[],'test',owner1,1);
  begin
    perform public.begin_forge_game_run(current_date,array[910004]::bigint[],'test',owner1,1);
    raise exception using errcode='ZX001',message='Duplicate worker started a run';
  exception when no_data_found then null; end;
  update public.forge_game_update_queue set lease_expires_at=now()-interval '1 second' where game_id=910004;
  perform public.claim_starter_board_jobs(owner2,16);
  if (select status from public.forge_runs where run_id=run1)<>'failed' then raise exception 'Expired run still blocks replacement'; end if;
  run2:=public.begin_forge_game_run(current_date,array[910004]::bigint[],'test',owner2,1);
  begin
    insert into public.forge_game_revisions(run_id,game_id,slate_date,input_snapshot_id,decision_as_of,payload)
      values(run1,910004,current_date,'00000000-0000-0000-0000-000000000001',now(),'{}');
    raise exception using errcode='ZX001',message='Expired worker published';
  exception when raise_exception then
    if sqlerrm<>'Expired worker cannot publish' then raise; end if;
  end;
end $$;

do $$
declare first_revision uuid; probe uuid:=gen_random_uuid();
begin
  select id into first_revision from public.forge_game_revisions where game_id=910001 and run_id='00000000-0000-0000-0000-000000000001';
  perform public.select_starter_board_revision(910001,first_revision,'Canary rollback');
  if not exists(select 1 from public.read_forge_game_revisions(current_date) where game_id=910001 and id=first_revision) then raise exception 'Selected revision not served'; end if;
  perform public.select_starter_board_revision(910001,null,'Resume latest');
  if exists(select 1 from public.read_forge_game_revisions(current_date) where game_id=910001 and id=first_revision) then raise exception 'Selection reset failed'; end if;
  perform public.select_starter_board_revision(910001,first_revision,'Pinned at puck drop');
  update public.games set "startTime"=now()-interval '1 second' where id=910001;
  if public.freeze_starter_board_pregame(current_date)<>1 then raise exception 'Final pregame revision was not frozen'; end if;
  if public.freeze_starter_board_pregame(current_date)<>0 then raise exception 'Freeze is not idempotent'; end if;
  begin
    perform public.select_starter_board_revision(910001,null,'Too late');
    raise exception using errcode='ZX001',message='Rewrote final pregame history';
  exception when raise_exception then null; end;
  if not exists(select 1 from public.forge_final_pregame_revisions where game_id=910001 and revision_id=first_revision) then raise exception 'Frozen selection changed'; end if;
  if has_function_privilege('anon','public.select_starter_board_revision(bigint,uuid,text,uuid)','EXECUTE') then raise exception 'Public rollback access'; end if;
  if public.record_starter_board_visibility(probe,array[first_revision])<>1 then raise exception 'Visible revision not recorded'; end if;
  if public.record_starter_board_visibility(probe,array[first_revision])<>0 then raise exception 'Duplicate probe receipt'; end if;
  if has_table_privilege('anon','public.forge_board_news_events','SELECT') or has_function_privilege('authenticated','public.record_starter_board_visibility(uuid,uuid[])','EXECUTE') then raise exception 'Private telemetry exposed'; end if;
end $$;
-- Failed assertions roll back the snapshot and news trigger in the same transaction.
insert into public.games(id,date,"seasonId","startTime","homeTeamId","awayTeamId")
  values(910005,current_date,20262027,now()+interval '2 hours',10,8);
do $$
declare snapshot jsonb; assignments jsonb; captured jsonb; retry jsonb; news_count integer;
begin
  snapshot := jsonb_build_object('game_id',910005,'team_id',10,'source_group','test','source_key','test',
    'source_account','test','source_capture_key','atomic-lineup-test','source_url',null,'classification','power_play',
    'observed_at',now(),'available_at',now(),'expires_at',null,'completeness',0.05,'accepted',true,
    'parser_version','test','metadata','{}'::jsonb);
  assignments := '[{"player_id":42,"raw_player_name":"Fixture","unit_type":"power_play","unit_number":2,"slot_number":1,"assignment_status":"observed"}]';
  begin
    perform public.capture_starter_board_lineup(snapshot,jsonb_set(assignments,'{0,slot_number}','11'));
    raise exception using errcode='ZX001',message='Invalid assignment accepted';
  exception when check_violation then null; end;
  if exists(select 1 from public.player_forecast_lineup_snapshots where source_capture_key='atomic-lineup-test')
    or exists(select 1 from public.forge_board_news_events where game_id=910005)
    or exists(select 1 from public.forge_game_update_queue where game_id=910005) then
    raise exception 'Failed assignment exposed partial capture';
  end if;
  captured := public.capture_starter_board_lineup(snapshot,assignments);
  if not (captured->>'insertedSnapshot')::boolean or (captured->>'insertedAssignments')::integer<>1 then
    raise exception 'Capture failed after retry'; end if;
  select count(*) into news_count from public.forge_board_news_events where game_id=910005;
  retry := public.capture_starter_board_lineup(snapshot,assignments);
  if retry->>'snapshotId'<>captured->>'snapshotId' or (retry->>'insertedSnapshot')::boolean
    or (retry->>'insertedAssignments')::integer<>0 then raise exception 'Exact retry not idempotent'; end if;
  if (select count(*) from public.forge_board_news_events where game_id=910005)<>news_count then
    raise exception 'Retry counted as independent news'; end if;
  begin
    perform public.capture_starter_board_lineup(snapshot,jsonb_set(assignments,'{0,unit_number}','1'));
    raise exception using errcode='ZX001',message='Changed duplicate assignments accepted';
  exception when raise_exception then null; end;
  begin
    perform public.capture_starter_board_lineup(jsonb_set(snapshot,'{game_id}','910002'),assignments);
    raise exception using errcode='ZX001',message='Changed duplicate scope accepted';
  exception when raise_exception then null; end;
  if has_function_privilege('anon','public.capture_starter_board_lineup(jsonb,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.capture_starter_board_lineup(jsonb,jsonb)','EXECUTE') then
    raise exception 'Private capture exposed'; end if;
end $$;
-- Inject a failure after the first conflict member to verify full rollback.
create function pg_temp.fail_second_goalie_member() returns trigger language plpgsql as $$
begin
  if new.position=2 and current_setting('starter_board_test.fail_member',true)='true' then
    raise exception 'Controlled member failure'; end if;
  return new;
end $$;
create trigger test_goalie_member_failure before insert on public.player_forecast_conflict_members
  for each row execute function pg_temp.fail_second_goalie_member();
insert into public.games(id,date,"seasonId","startTime","homeTeamId","awayTeamId")
  values(910007,current_date,20262027,clock_timestamp()+interval '2 hours',10,8),(910008,current_date,20262027,clock_timestamp()+interval '2 hours',10,8);
do $$
declare original jsonb; alternate jsonb; corrected jsonb; captured jsonb; retry jsonb; news_count integer; version_before bigint;
begin
  original:=jsonb_build_object('game_id',910007,'team_id',10,'player_id',42,'raw_player_name','Fixture goalie A',
    'observation_status','confirmed','confidence',null,'raw_status','Confirmed starter','source_group','test','source_key','test',
    'source_account','reporter-a','source_capture_key','atomic-goalie-a','source_url',null,
    'observed_at',clock_timestamp()-interval '2 minutes','available_at',clock_timestamp()-interval '1 minute',
    'expires_at',null,'parser_version','test','accepted',true,'metadata','{}'::jsonb);
  captured:=public.capture_starter_board_goalies(jsonb_build_array(original));
  if (captured->>'insertedObservations')::int<>1 or (captured->>'insertedConflicts')::int<>0 then raise exception 'Initial goalie capture failed'; end if;
  alternate:=original||jsonb_build_object('player_id',43,'raw_player_name','Fixture goalie B','source_account','reporter-b',
    'source_capture_key','atomic-goalie-b','observed_at',clock_timestamp()-interval '1 minute','available_at',clock_timestamp());
  select version into version_before from public.forge_game_update_queue where game_id=910007;
  perform set_config('starter_board_test.fail_member','true',true);
  begin
    perform public.capture_starter_board_goalies(jsonb_build_array(alternate));
    raise exception using errcode='ZX001',message='Controlled member failure did not fire';
  exception when raise_exception then null; end;
  if exists(select 1 from public.player_forecast_goalie_start_observations where source_capture_key='atomic-goalie-b')
    or exists(select 1 from public.player_forecast_observation_conflicts where game_id=910007)
    or exists(select 1 from public.player_forecast_conflict_members)
    or (select version from public.forge_game_update_queue where game_id=910007)<>version_before then
    raise exception 'Failed member exposed partial evidence or queue change'; end if;
  perform set_config('starter_board_test.fail_member','false',true);
  captured:=public.capture_starter_board_goalies(jsonb_build_array(alternate));
  if (captured->>'insertedObservations')::int<>1 or (captured->>'insertedConflicts')::int<>1
    or (select count(*) from public.player_forecast_conflict_members)<>2 then raise exception 'Complete goalie retry failed'; end if;
  select count(*) into news_count from public.forge_board_news_events where game_id=910007;
  retry:=public.capture_starter_board_goalies(jsonb_build_array(alternate));
  if retry->'observationIds'<>captured->'observationIds' or (retry->>'insertedObservations')::int<>0
    or (retry->>'insertedConflicts')::int<>0
    or (select count(*) from public.forge_board_news_events where game_id=910007)<>news_count then
    raise exception 'Goalie retry was not idempotent'; end if;
  begin
    perform public.capture_starter_board_goalies(jsonb_build_array(alternate||'{"observation_status":"likely"}'::jsonb));
    raise exception using errcode='ZX001',message='Changed goalie retry accepted';
  exception when raise_exception then null; end;
  begin
    perform public.capture_starter_board_goalies(jsonb_build_array(original||jsonb_build_object('source_capture_key','future-goalie',
      'observed_at',clock_timestamp()+interval '1 hour','available_at',clock_timestamp()+interval '1 hour')));
    raise exception using errcode='ZX001',message='Future goalie accepted';
  exception when raise_exception then null; end;
  begin
    perform public.capture_starter_board_goalies(jsonb_build_array(
      original||'{"source_capture_key":"mixed-goalie","observation_status":"unconfirmed"}'::jsonb,
      alternate||'{"source_capture_key":"mixed-goalie","observation_status":"unconfirmed"}'::jsonb));
    raise exception using errcode='ZX001',message='Mixed goalie batch accepted';
  exception when raise_exception then null; end;
  if exists(select 1 from public.player_forecast_goalie_start_observations where source_capture_key in ('future-goalie','mixed-goalie')) then
    raise exception 'Invalid goalie batch exposed partial observations'; end if;

  original:=original||jsonb_build_object('game_id',910008,'source_capture_key','correction-original');
  perform public.capture_starter_board_goalies(jsonb_build_array(original));
  corrected:=alternate||jsonb_build_object('game_id',910008,'source_account','reporter-a','source_capture_key','correction-new');
  captured:=public.capture_starter_board_goalies(jsonb_build_array(corrected));
  if (captured->>'insertedConflicts')::int<>0 then raise exception 'Reporter correction counted as independent conflict'; end if;
  captured:=public.capture_starter_board_goalies(jsonb_build_array(original||jsonb_build_object('source_capture_key','correction-late','available_at',clock_timestamp())));
  if (captured->>'insertedConflicts')::int<>0 then raise exception 'Late old assertion superseded newer publication'; end if;
  -- A later reporter agreeing with the correction must not conflict with the
  -- first reporter's superseded original assertion.
  captured:=public.capture_starter_board_goalies(jsonb_build_array(corrected||jsonb_build_object('source_capture_key','correction-agreement',
    'source_account','reporter-b','available_at',clock_timestamp())));
  if (captured->>'insertedConflicts')::int<>0 then raise exception 'Agreement conflicted with superseded evidence'; end if;
  captured:=public.capture_starter_board_goalies(jsonb_build_array(
    corrected||'{"source_capture_key":"two-goalies","observation_status":"unconfirmed"}'::jsonb,
    corrected||'{"source_capture_key":"two-goalies","observation_status":"unconfirmed","player_id":42,"raw_player_name":"Fixture goalie A"}'::jsonb));
  if (captured->>'insertedObservations')::int<>2 or (captured->>'insertedConflicts')::int<>0 then
    raise exception 'Two-goalie report was not captured together as unconfirmed'; end if;
  if has_function_privilege('anon','public.capture_starter_board_goalies(jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.capture_starter_board_goalies(jsonb)','EXECUTE') then
    raise exception 'Private goalie capture exposed'; end if;
end $$;
-- Exercise actual lease -> publication -> visibility joins, including a newer
-- revision delivering earlier coalesced news and a stale rollback observation.
create function pg_temp.publish_board_fixture(p_game bigint,p_owner uuid,p_version bigint) returns uuid
language plpgsql as $$
declare run uuid; cutoff timestamptz; result uuid; slate date;
begin
  select date into strict slate from public.games where id=p_game;
  run:=public.begin_forge_game_run(slate,array[p_game],'operations-fixture',p_owner,p_version);
  cutoff:=clock_timestamp();
  update public.forge_runs set metrics=metrics||jsonb_build_object('started_at',cutoff) where run_id=run;
  insert into public.forge_player_projections(run_id,game_id,player_id,team_id,horizon_games,as_of_date,opponent_team_id)
    values(run,p_game,42,10,1,slate,8),(run,p_game,43,8,1,slate,10);
  insert into public.forge_team_projections(run_id,game_id,team_id,horizon_games,as_of_date,opponent_team_id)
    values(run,p_game,10,1,slate,8),(run,p_game,8,1,slate,10);
  update public.forge_runs set status='succeeded',metrics=metrics||jsonb_build_object('finished_at',clock_timestamp()) where run_id=run;
  perform pg_temp.board_input_fixture(run,jsonb_build_object('version','forge-inputs-v1',
      'replayClassification','captured_live','codeVersion','operations-fixture','horizonGames',1,'slateDate',slate,'inputCutoff',cutoff,
      'decisionAsOf',clock_timestamp(),'goalieStarts','[]'::jsonb));
  perform public.publish_forge_game_revisions(run,run);
  perform public.finish_starter_board_job(p_game,p_owner,run,null);
  select id into strict result from public.forge_game_revisions where run_id=run and game_id=p_game;
  return result;
end $$;
insert into public.games(id,date,type,"seasonId","startTime","homeTeamId","awayTeamId")
  values(910006,current_date,2,20262027,clock_timestamp()+interval '2 hours',10,8);
do $$
declare snapshot jsonb; assignments jsonb; owner uuid; captured jsonb; first_revision uuid; second_revision uuid;
  report_row jsonb; window_from timestamptz:=clock_timestamp()-interval '1 minute'; as_of timestamptz;
  before_visible timestamptz; first_observation uuid; pending_observation uuid; latest_version bigint;
begin
  snapshot:=jsonb_build_object('game_id',910006,'team_id',10,'source_group','test','source_key','test',
    'source_account','test','source_capture_key','operations-first','source_url',null,'classification','power_play',
    'observed_at',clock_timestamp()-interval '5 seconds','available_at',clock_timestamp()-interval '5 seconds',
    'expires_at',null,'completeness',0.05,'accepted',true,'parser_version','test',
    'metadata',jsonb_build_object('sourceTiming',jsonb_build_object('sourcePublishedAt',null,'receivedAt',clock_timestamp()-interval '5 seconds',
      'sourceReference','tweet:fixture-original')));
  assignments:='[{"player_id":42,"raw_player_name":"Fixture","unit_type":"power_play","unit_number":2,"slot_number":1,"assignment_status":"observed"}]';
  captured:=public.capture_starter_board_lineup(snapshot,assignments);
  first_observation:=(captured->>'snapshotId')::uuid;
  owner:=gen_random_uuid();
  update public.forge_game_update_queue set not_before=clock_timestamp()-interval '1 second' where game_id=910006;
  perform public.claim_starter_board_jobs(owner,16);
  first_revision:=pg_temp.publish_board_fixture(910006,owner,1);

  captured:=public.capture_starter_board_lineup(jsonb_set(snapshot,'{source_capture_key}','"operations-second"'),assignments);
  owner:=gen_random_uuid();
  update public.forge_game_update_queue set not_before=clock_timestamp()-interval '1 second' where game_id=910006;
  perform public.claim_starter_board_jobs(owner,16);
  second_revision:=pg_temp.publish_board_fixture(910006,owner,2);
  before_visible:=clock_timestamp();
  perform public.record_starter_board_visibility_timed(gen_random_uuid(),array[second_revision],clock_timestamp());
  -- Run metadata is mutable operational state; immutable revision timing must
  -- retain the lease association even if that mutable state subsequently changes.
  update public.forge_runs set metrics='{}' where run_id=(select run_id from public.forge_game_revisions where id=second_revision);
  as_of:=clock_timestamp();
  select x into strict report_row from public.read_starter_board_operational_events(window_from,as_of,as_of) x
    where x->>'eventId'=(select id::text from public.forge_board_news_events where observation_id=first_observation);
  if report_row->>'revisionId'<>second_revision::text or report_row->>'visibilityReceivedAt' is null
    or report_row->>'calculationCompletedAt' is null or report_row->'categories'<>'["pp"]'::jsonb
    or report_row->>'sourcePublishedAt' is not null or report_row->>'receivedAt' is null or report_row->>'newsKey' is null then
    raise exception 'Incorrect operational correlation: %',report_row; end if;
  if (select count(distinct x->>'newsKey') from public.read_starter_board_operational_events(window_from,as_of,as_of) x
    where x->>'gameId'='910006')<>1 then raise exception 'Reposted source did not retain identity'; end if;
  select x into strict report_row from public.read_starter_board_operational_events(window_from,before_visible,before_visible) x
    where x->>'eventId'=(select id::text from public.forge_board_news_events where observation_id=first_observation);
  if report_row->>'visibilityReceivedAt' is not null then raise exception 'Report leaked later visibility'; end if;

  captured:=public.capture_starter_board_lineup(jsonb_set(snapshot,'{source_capture_key}','"operations-pending"'),assignments);
  pending_observation:=(captured->>'snapshotId')::uuid;
  perform public.select_starter_board_revision(910006,first_revision,'Controlled stale rollback observation');
  perform public.record_starter_board_visibility_timed(gen_random_uuid(),array[first_revision],clock_timestamp());
  as_of:=clock_timestamp();
  select x into strict report_row from public.read_starter_board_operational_events(window_from,as_of,as_of) x
    where x->>'eventId'=(select id::text from public.forge_board_news_events where observation_id=pending_observation);
  if report_row->>'revisionId' is not null or report_row->>'visibilityReceivedAt' is not null then
    raise exception 'Old rendered revision incorrectly delivered new news'; end if;
  if has_function_privilege('anon','public.read_starter_board_operational_events(timestamptz,timestamptz,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.record_starter_board_visibility_timed(uuid,uuid[],timestamptz)','EXECUTE') then
    raise exception 'Operational evidence exposed'; end if;
  begin
    perform public.read_starter_board_operational_events(as_of-interval '32 days',as_of,as_of);
    raise exception using errcode='ZX001',message='Unbounded operational report allowed';
  exception when raise_exception then null; end;
end $$;
-- Isolated release registry fixtures. These synthetic dates exercise milestone
-- guards; they are never exported as prospective observations.
do $$
declare today date:=(clock_timestamp() at time zone 'America/New_York')::date;
  release_id uuid; wrong_release uuid; owner uuid; revision uuid; regular_revision uuid;
  visible_id uuid; registry jsonb; review jsonb; fixture record;
begin
  insert into public.forge_board_releases(release_key,code_version,model_identity,evaluation_version,policy_hash,policy)
    values('fixture','operations-fixture','FORGE','fixture-v1',repeat('a',64),'{}') returning id into release_id;
  insert into public.forge_board_releases(release_key,code_version,model_identity,evaluation_version,policy_hash,policy)
    values('wrong-code','other-code','FORGE','fixture-v1',repeat('a',64),'{}') returning id into wrong_release;
  for fixture in select * from (values(920001,1,today),(920002,2,today-1),(920003,2,today)) v(game_id,game_type,slate) loop
    insert into public.games(id,date,type,"seasonId","startTime","homeTeamId","awayTeamId")
      values(fixture.game_id,fixture.slate,fixture.game_type,20262027,clock_timestamp()+interval '2 hours',10,8);
    insert into public.player_forecast_lineup_snapshots(game_id,team_id,accepted,observed_at,available_at,source_group,source_key,source_capture_key,classification,parser_version)
      values(fixture.game_id,10,true,clock_timestamp()-interval '5 seconds',clock_timestamp()-interval '5 seconds','test','test','review-'||fixture.game_id,'lineup','test');
    owner:=gen_random_uuid();
    update public.forge_game_update_queue set not_before=clock_timestamp()-interval '1 second' where game_id=fixture.game_id;
    perform public.claim_starter_board_jobs(owner,16);
    revision:=pg_temp.publish_board_fixture(fixture.game_id,owner,1);
    if fixture.game_id=920003 then regular_revision:=revision; end if;
    -- Inactive tracking cannot start the clock, regardless of game type.
    perform public.record_starter_board_visibility_timed(gen_random_uuid(),array[revision],clock_timestamp());
    if exists(select 1 from public.forge_board_live_slates) then raise exception 'Inactive tracking started validation'; end if;
    if fixture.game_id<>920003 then
      perform public.activate_starter_board_release(release_id,'Excluded cohort test');
      perform public.record_starter_board_visibility_timed(gen_random_uuid(),array[revision],clock_timestamp());
      if exists(select 1 from public.forge_board_live_slates) then raise exception 'Historical/preseason receipt started validation'; end if;
      perform public.activate_starter_board_release(null,'Reset fixture tracking');
    end if;
  end loop;
  perform public.activate_starter_board_release(wrong_release,'Code mismatch test');
  perform public.record_starter_board_visibility_timed(gen_random_uuid(),array[regular_revision],clock_timestamp());
  if exists(select 1 from public.forge_board_live_slates) then raise exception 'Wrong code started validation'; end if;
  perform public.activate_starter_board_release(release_id,'Matching code test');
  perform public.record_starter_board_visibility_timed(gen_random_uuid(),array[regular_revision],clock_timestamp());
  perform public.record_starter_board_visibility_timed(gen_random_uuid(),array[regular_revision],clock_timestamp());
  registry:=public.read_starter_board_validation();
  if registry->>'startedOn'<>today::text or (registry->>'liveRegularSlates')::int<>1 then
    raise exception 'Live start or daily deduplication failed: %',registry; end if;
  review:=jsonb_build_object('contractVersion','starter-board-review-v1','evaluationVersion','fixture-v1',
    'policyHash',repeat('a',64),'asOf',clock_timestamp(),'windowStart',today,'windowEnd',today,
    'evidenceClass','captured_live','gameType','regular_season');
  begin
    insert into public.forge_board_validation_reviews(release_id,kind,report_hash,report) values(release_id,'day14',repeat('b',64),review);
    raise exception using errcode='ZX001',message='Early milestone accepted';
  exception when raise_exception then null; end;
  begin
    insert into public.forge_board_validation_reviews(release_id,kind,report_hash,report) values(release_id,'weekly',repeat('b',64),review-'windowStart');
    raise exception using errcode='ZX001',message='Missing review window accepted';
  exception when raise_exception then null; end;
  begin
    insert into public.forge_board_validation_reviews(release_id,kind,report_hash,report)
      values(release_id,'weekly',repeat('b',64),jsonb_set(review,'{policyHash}',to_jsonb(repeat('c',64))));
    raise exception using errcode='ZX001',message='Different policy accepted';
  exception when raise_exception then null; end;
  begin
    insert into public.forge_board_validation_reviews(release_id,kind,report_hash,report)
      values(release_id,'weekly',repeat('b',64),jsonb_set(review,'{evidenceClass}','"historical_reconstruction"'));
    raise exception using errcode='ZX001',message='Historical review accepted';
  exception when raise_exception then null; end;
  insert into public.forge_board_validation_reviews(release_id,kind,report_hash,report) values(release_id,'weekly',repeat('b',64),review);
  -- Seed a synthetic older start solely to exercise positive milestone paths.
  select visibility_id into visible_id from public.forge_board_live_slates where slate_date=today;
  insert into public.forge_board_live_slates values(today-29,release_id,regular_revision,visible_id,clock_timestamp()-interval '29 days');
  insert into public.forge_board_validation_reviews(release_id,kind,report_hash,report) values(release_id,'day14',repeat('c',64),review),(release_id,'day30',repeat('d',64),review);
  perform public.activate_starter_board_release(wrong_release,'Release change preserves initial date');
  if public.read_starter_board_validation()->>'startedOn'<>(today-29)::text then raise exception 'Release reset validation date'; end if;
  perform public.activate_starter_board_release(null,'Disable disclosure tracking');
  if public.read_starter_board_validation()->>'startedOn'<>(today-29)::text then raise exception 'Deactivation erased history'; end if;
  begin
    update public.forge_board_validation_reviews set kind='weekly' where report_hash=repeat('d',64);
    raise exception using errcode='ZX001',message='Review mutated';
  exception when sqlstate '55000' then null; end;
  if has_table_privilege('anon','public.forge_board_validation_reviews','SELECT')
    or has_table_privilege('authenticated','public.forge_board_releases','SELECT')
    or has_function_privilege('anon','public.read_starter_board_validation()','EXECUTE')
    or has_function_privilege('authenticated','public.activate_starter_board_release(uuid,text)','EXECUTE') then
    raise exception 'Private registry exposed'; end if;
end $$;
-- Canary filtering happens before leasing; the rest of a full slate stays pending.
insert into public.games(id,date,"seasonId","startTime","homeTeamId","awayTeamId")
  select 980000+i,current_date,20262027,now()+interval '2 hours',10,8 from generate_series(1,16) i;
insert into public.player_forecast_lineup_snapshots(game_id,team_id,accepted,observed_at,available_at,source_group,source_key,source_capture_key,classification,parser_version)
  select 980000+i,10,true,now(),now(),'test','test','slate-'||i,'lineup','test' from generate_series(1,16) i;
update public.forge_game_update_queue set not_before=now()-interval '1 second' where game_id between 980001 and 980016;
do $$
declare owner uuid:=gen_random_uuid(); selected_ids bigint[]; invalid_ids bigint[];
begin
  select array_agg(game_id order by game_id) into selected_ids
    from public.claim_starter_board_jobs(owner,16,array[980002,980016]::bigint[]);
  if selected_ids is distinct from array[980002,980016]::bigint[] then raise exception 'Canary scope not respected'; end if;
  if (select count(*) from public.forge_game_update_queue where game_id between 980001 and 980016
      and game_id not in (980002,980016) and status='pending' and lease_owner is null and attempt_count=0)<>14 then
    raise exception 'Canary claimed unrelated games'; end if;
  if exists(select 1 from public.forge_board_dispatch_observations where game_id between 980001 and 980016
      and game_id not in (980002,980016)) then raise exception 'Canary dispatched unrelated games'; end if;
  foreach invalid_ids slice 1 in array array[array[0,1],array[1,1],array[null,1]]::bigint[][] loop
    begin
      perform public.claim_starter_board_jobs(owner,16,invalid_ids);
      raise exception using errcode='ZX001',message='Invalid canary accepted';
    exception when raise_exception then
      if sqlerrm<>'Invalid board canary scope' then raise; end if;
    end;
  end loop;
  begin
    perform public.claim_starter_board_jobs(owner,16,array[]::bigint[]);
    raise exception using errcode='ZX001',message='Empty canary opened the slate';
  exception when raise_exception then
    if sqlerrm<>'Invalid board canary scope' then raise; end if;
  end;
  if has_function_privilege('anon','public.claim_starter_board_jobs(uuid,integer,bigint[])','EXECUTE')
    or has_function_privilege('authenticated','public.claim_starter_board_jobs(uuid,integer,bigint[])','EXECUTE') then
    raise exception 'Canary claim exposed publicly'; end if;
end $$;
-- A crashed full slate can be replaced as one bounded claim, while stale
-- completions cannot release or overwrite any replacement lease.
do $$
declare old_owner uuid:=gen_random_uuid(); new_owner uuid:=gen_random_uuid();
  ids bigint[]; claimed bigint[]; game bigint; old_run uuid; new_run uuid;
begin
  select array_agg(980000+i::bigint) into ids from generate_series(1,16) i;
  update public.forge_game_update_queue set lease_expires_at=now()-interval '1 second'
    where game_id=any(ids) and status='running';
  select array_agg(game_id order by game_id) into claimed
    from public.claim_starter_board_jobs(old_owner,16,ids);
  if claimed is distinct from ids then raise exception 'Full slate was not claimed'; end if;
  foreach game in array ids loop
    perform public.begin_forge_game_run(current_date,array[game],'crashed-slate',old_owner,1);
  end loop;
  update public.forge_game_update_queue set lease_expires_at=now()-interval '1 second' where game_id=any(ids);
  select array_agg(game_id order by game_id) into claimed
    from public.claim_starter_board_jobs(new_owner,16,ids);
  if claimed is distinct from ids then raise exception 'Full crashed slate was not reclaimed'; end if;
  if (select count(*) from public.forge_runs where git_sha='crashed-slate' and status='failed')<>16 then
    raise exception 'Crashed slate retained active runs'; end if;
  foreach game in array ids loop
    select run_id into old_run from public.forge_runs where git_sha='crashed-slate'
      and (metrics #>> '{execution_scope,requested_game_ids,0}')::bigint=game;
    new_run:=public.begin_forge_game_run(current_date,array[game],'replacement-slate',new_owner,1);
    begin
      perform public.finish_starter_board_job(game,old_owner,old_run,'Late crashed-worker result');
      raise exception using errcode='ZX001',message='Stale completion accepted';
    exception when raise_exception then
      if sqlerrm<>'Board job lease lost or publication missing' then raise; end if;
    end;
    if not exists(select 1 from public.forge_game_update_queue where game_id=game
        and status='running' and lease_owner=new_owner and active_run_id=new_run) then
      raise exception 'Stale worker disturbed replacement lease'; end if;
  end loop;
  if exists(select 1 from public.claim_starter_board_jobs(gen_random_uuid(),16,ids)) then
    raise exception 'Overlapping scheduler reclaimed a live lease'; end if;
end $$;
rollback;
