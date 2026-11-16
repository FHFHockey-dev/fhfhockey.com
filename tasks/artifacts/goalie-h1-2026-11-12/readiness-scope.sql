-- Final query in the approved three-query H1 readiness inspection.
begin;
set transaction read only;
set local statement_timeout = '5s';
set local lock_timeout = '1s';
select jsonb_build_object(
  'checkedAt',clock_timestamp(),
  'game',(select jsonb_build_object('id',g.id,'date',g.date,'startTime',g."startTime",
    'seasonId',g."seasonId",'type',g.type,'homeTeamId',g."homeTeamId",'awayTeamId',g."awayTeamId",
    'stillUpcoming',g."startTime">clock_timestamp())
    from public.games g where g.id=2026020307 and g.date='2026-11-12'),
  'teams',(select jsonb_agg(jsonb_build_object('id',t.id,'name',to_jsonb(t)->>'name',
    'abbreviation',to_jsonb(t)->>'abbreviation')) from public.teams t where t.id in (19,68)),
  'revisions',coalesce((select jsonb_agg(to_jsonb(r)) from (
    select id,run_id,input_snapshot_id,published_at from public.forge_game_revisions
    where game_id=2026020307 order by published_at desc,id desc limit 6) r),'[]'::jsonb),
  'runs',coalesce((select jsonb_agg(to_jsonb(r)) from (
    select run_id,as_of_date,status,created_at,updated_at,git_sha,
      metrics->'execution_scope' as execution_scope,metrics->'resume' as resume,
      metrics->'board_lease' as board_lease
    from public.forge_runs where as_of_date='2026-11-12'
    order by (status='running') desc,updated_at desc,created_at desc limit 21) r),'[]'::jsonb),
  'localAttempts',coalesce((select jsonb_agg(to_jsonb(a)) from (
    select id,entity_key as run_id,observed_at,
      payload->>'leaseExpiresAt' as lease_expires_at,
      payload->>'codeVersion' as code_version,payload->>'expectedRevisionId' as expected_revision_id
    from public.player_forecast_source_observations
    where provider='forge' and dataset_key='forge-local-execution-v1'
      and payload->>'gameId'='2026020307' order by observed_at desc limit 11) a),'[]'::jsonb),
  'queue',(select jsonb_build_object('gameId',q.game_id,'status',q.status,'activeRunId',q.active_run_id,
    'leaseOwner',q.lease_owner,'leaseExpiresAt',q.lease_expires_at,'claimedVersion',q.claimed_version,
    'lastAcceptedAt',q.last_accepted_at) from public.forge_game_update_queue q where game_id=2026020307),
  'fenceSchemaUsage',has_schema_privilege('service_role','forge_execution_internal','USAGE'),
  'fenceNonServiceExecute',coalesce((select jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',p.proname,'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
    'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE')))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='forge_execution_internal' and p.proname in
      ('lock_forge_execution_scope','active_forge_local_execution','guard_forge_local_reservation','guard_forge_local_publication'))
      or (n.nspname='public' and p.proname in ('begin_forge_local_run','inspect_forge_local_attempt'))),'[]'::jsonb)
) as scope;
commit;
