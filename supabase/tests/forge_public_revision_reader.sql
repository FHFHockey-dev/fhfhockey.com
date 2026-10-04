-- Run only in an empty isolated reader fixture database, never a hosted project.
-- Load the existing revision/control relation definitions and the reader migration first.
-- All synthetic data and test-only permissions roll back; no forecast is issued.
begin;

insert into public.seasons(id,"startDate","endDate","regularSeasonEndDate","numberOfGames")
  values(20402041,'2040-01-01','2041-12-31','2041-04-01',82);
insert into public.teams(id,name,abbreviation) values(990081,'Reader fixture home','RFH'),(990082,'Reader fixture away','RFA');
insert into public.games(id,date,"seasonId","startTime","homeTeamId","awayTeamId")
  select id,'2040-10-05',20402041,'2040-10-05T23:00:00Z',990081,990082
  from generate_series(990101,990107) id;
insert into public.forge_runs(run_id,as_of_date,status)
  select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'2040-10-05','succeeded' from generate_series(1,3) n;
insert into public.player_forecast_source_observations(id,provider,dataset_key,entity_kind,entity_key,
  observed_at,available_at,payload_hash,payload)
  values('00000000-0000-0000-0000-000000000099','reader-fixture','reader-fixture','test','reader-fixture',
    '2040-10-05T09:00:00Z','2040-10-05T09:00:00Z',repeat('0',64),'{"readerFixture":true}');

insert into public.forge_game_revisions(id,run_id,game_id,slate_date,input_snapshot_id,decision_as_of,published_at,payload)
  select ('00000000-0000-0000-0000-'||lpad(key::text,12,'0'))::uuid,
    ('00000000-0000-0000-0000-'||lpad(run::text,12,'0'))::uuid,game,date,
    '00000000-0000-0000-0000-000000000099',decision,published,
    jsonb_build_object('codeVersion',key::text,'modelMode','fixture','players',jsonb_build_array(key),
      'goalies',jsonb_build_array(game),'previousRevision','must be replaced','extra',jsonb_build_object('run',run))
  from (values
    (101,1,990101,'2040-10-05'::date,'2040-10-05T10:00:00Z'::timestamptz,'2040-10-05T10:01:00Z'::timestamptz),
    (102,2,990101,'2040-10-05','2040-10-05T11:00:00Z','2040-10-05T11:01:00Z'),
    (201,1,990102,'2040-10-05','2040-10-05T10:00:00Z','2040-10-05T10:01:00Z'),
    (202,2,990102,'2040-10-05','2040-10-05T11:00:00Z','2040-10-05T11:01:00Z'),
    (301,1,990103,'2040-10-05','2040-10-05T10:00:00Z','2040-10-05T10:01:00Z'),
    (302,2,990103,'2040-10-05','2040-10-05T11:00:00Z','2040-10-05T11:01:00Z'),
    (401,1,990104,'2040-10-05','2040-10-05T10:00:00Z','2040-10-05T10:01:00Z'),
    (402,2,990104,'2040-10-05','2040-10-05T11:00:00Z','2040-10-05T11:01:00Z'),
    (601,1,990106,'2040-10-05','2040-10-05T12:00:00Z','2040-10-05T12:01:00Z'),
    (602,2,990106,'2040-10-05','2040-10-05T12:00:00Z','2040-10-05T12:01:00Z'),
    (700,3,990107,'2040-10-04','2040-10-04T09:00:00Z','2040-10-04T09:01:00Z'),
    (701,1,990107,'2040-10-04','2040-10-04T10:00:00Z','2040-10-04T10:01:00Z'),
    (702,2,990107,'2040-10-05','2040-10-05T11:00:00Z','2040-10-05T11:01:00Z')
  ) fixtures(key,run,game,date,decision,published);
insert into public.forge_game_selection_events(id,game_id,revision_id,reason,created_at) values
  ('00000000-0000-0000-0000-000000001001',990102,'00000000-0000-0000-0000-000000000201','Older selection','2040-10-05T12:00:00Z'),
  ('00000000-0000-0000-0000-000000001002',990103,'00000000-0000-0000-0000-000000000302','Frozen must win','2040-10-05T12:00:00Z'),
  ('00000000-0000-0000-0000-000000001003',990104,'00000000-0000-0000-0000-000000000401','Prior selection','2040-10-05T12:00:00Z'),
  ('00000000-0000-0000-0000-000000001004',990104,null,'Reset tied event by ID','2040-10-05T12:00:00Z'),
  ('00000000-0000-0000-0000-000000001005',990107,'00000000-0000-0000-0000-000000000701','Existing cross-slate contract','2040-10-05T12:00:00Z');
insert into public.forge_final_pregame_revisions(game_id,revision_id,scheduled_start_at,frozen_at)
  values(990103,'00000000-0000-0000-0000-000000000301','2040-10-05T23:00:00Z','2040-10-05T23:00:00Z');

-- The unchanged private reader supplies the selection oracle, as the fixture owner.
create temp table expected_reader as
  select r.id,r.run_id,r.game_id,r.decision_as_of,r.published_at,
    r.payload||pg_catalog.jsonb_build_object('previousRevision',(
      select pg_catalog.jsonb_build_object('id',p.id,'codeVersion',p.payload->>'codeVersion','modelMode',p.payload->>'modelMode',
        'players',p.payload->'players','goalies',p.payload->'goalies')
      from public.forge_game_revisions p where p.game_id=r.game_id and p.slate_date=r.slate_date
        and (p.decision_as_of,p.published_at,p.id)<(r.decision_as_of,r.published_at,r.id)
      order by p.decision_as_of desc,p.published_at desc,p.id desc limit 1)) payload
  from fhfh_internal.current_starter_board_revisions('2040-10-05') r;
grant select on expected_reader to service_role;

set local role service_role;
do $$ begin
  if has_schema_privilege(current_user,'fhfh_internal','USAGE') then raise exception 'Old private schema was unlocked'; end if;
  if not has_function_privilege(current_user,'public.read_forge_game_revisions(date)','EXECUTE') then raise exception 'Existing RPC execute lost'; end if;
  begin
    perform * from fhfh_internal.current_starter_board_revisions('2040-10-05');
    raise exception 'Private reader unexpectedly reachable';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.read_forge_game_revisions('2040-10-05'))<>6 then raise exception 'Nonempty slate lost or duplicated a game'; end if;
  if exists(
    (select * from public.read_forge_game_revisions('2040-10-05') except select * from expected_reader)
    union all
    (select * from expected_reader except select * from public.read_forge_game_revisions('2040-10-05'))
  ) then raise exception 'Reader differs from unchanged selected-revision contract'; end if;
  if (select array_agg((right(id::text,3))::integer order by game_id) from public.read_forge_game_revisions('2040-10-05'))
    <>array[102,201,301,402,602,701] then raise exception 'Latest/override/frozen/reset/tie identities changed'; end if;
  if (select payload->'previousRevision'->>'codeVersion' from public.read_forge_game_revisions('2040-10-05') where game_id=990101)<>'101'
    or (select payload->'previousRevision' from public.read_forge_game_revisions('2040-10-05') where game_id=990102)<>'null'::jsonb
    or (select payload->'previousRevision'->>'codeVersion' from public.read_forge_game_revisions('2040-10-05') where game_id=990106)<>'601'
    or (select payload->'previousRevision'->>'codeVersion' from public.read_forge_game_revisions('2040-10-05') where game_id=990107)<>'700' then
    raise exception 'Previous revision payload changed'; end if;
  if exists(select 1 from public.read_forge_game_revisions('2040-10-06'))
    or exists(select 1 from public.read_forge_game_revisions(null)) then raise exception 'Empty/null slate contract changed'; end if;
end $$;
reset role;

-- Table RLS remains enforced for a caller without BYPASSRLS: this is still INVOKER.
create role forge_reader_probe;
grant usage on schema public to forge_reader_probe;
grant select on public.forge_game_revisions,public.forge_final_pregame_revisions,public.forge_game_selection_events to forge_reader_probe;
grant execute on function public.read_forge_game_revisions(date) to forge_reader_probe;
set local role forge_reader_probe;
do $$ begin
  if exists(select 1 from public.read_forge_game_revisions('2040-10-05')) then raise exception 'Reader bypassed caller RLS'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform * from public.read_forge_game_revisions('2040-10-05');
    raise exception 'Anonymous reader access expanded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin
    perform * from public.read_forge_game_revisions('2040-10-05');
    raise exception 'Authenticated reader access expanded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare p record; begin
  select * into p from pg_proc where oid='public.read_forge_game_revisions(date)'::regprocedure;
  if p.prosecdef or p.provolatile<>'s' or p.proconfig<>array['search_path=""']
    or p.proargnames<>array['p_slate_date','id','run_id','game_id','decision_as_of','published_at','payload'] then
    raise exception 'Public RPC identity/security configuration changed'; end if;
  if has_schema_privilege('service_role','fhfh_internal','USAGE') then raise exception 'Private-schema denial changed'; end if;
end $$;
select 'PASS: service role, private/browser denial, caller RLS, exact selection/identity/payload and empty/null slate' receipt;
rollback;
