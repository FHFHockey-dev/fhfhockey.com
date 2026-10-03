-- Disposable fixture only. The test owns a socket-only server and named database;
-- an existing connection (including the developer's SSH tunnel) is rejected.
\set ON_ERROR_STOP on
select current_database()='fhfh_forge_fence_fixture'
  and current_setting('fhfh.fixture',true)='forge-local-execution-v1'
  and current_setting('listen_addresses')='' as fixture_allowed \gset
\if :fixture_allowed
\else
  \quit 3
\endif

create role anon;
create role authenticated;
create role service_role bypassrls;
create schema fhfh_internal;
revoke all on schema fhfh_internal from public,anon,authenticated,service_role;
grant usage on schema public to service_role;
create table public.games(id bigint primary key,date date not null,"startTime" timestamptz,
  "homeTeamId" bigint,"awayTeamId" bigint);
create table public.forge_runs(run_id uuid primary key default gen_random_uuid(),as_of_date date,
  status text,git_sha text,metrics jsonb,created_at timestamptz default clock_timestamp(),updated_at timestamptz);
create table public.player_forecast_source_observations(
  id uuid primary key default gen_random_uuid(),provider text not null,dataset_key text not null,
  entity_kind text not null,entity_key text not null,source_url text,source_revision_key text,
  observed_at timestamptz not null,available_at timestamptz not null,payload_hash text not null,
  payload jsonb not null,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),
  unique(provider,dataset_key,entity_key,payload_hash),check(available_at>=observed_at),
  check(btrim(provider)<>'' and btrim(dataset_key)<>'' and btrim(entity_kind)<>'' and btrim(entity_key)<>'' and btrim(payload_hash)<>''));
alter table public.player_forecast_source_observations enable row level security;
alter table public.player_forecast_source_observations force row level security;
revoke all on public.player_forecast_source_observations from public,anon,authenticated,service_role;
grant select,insert on public.player_forecast_source_observations to service_role;
create function fhfh_internal.reject_player_forecast_mutation() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception using errcode='55000',message='PLAYER_FORECAST_IMMUTABLE_RECORD'; end; $$;
revoke all on function fhfh_internal.reject_player_forecast_mutation() from public,anon,authenticated,service_role;
create trigger player_forecast_source_observations_immutable before update or delete
  on public.player_forecast_source_observations for each row execute function fhfh_internal.reject_player_forecast_mutation();
create table public.forge_player_projections(run_id uuid,game_id bigint,player_id bigint,team_id bigint,horizon_games integer);
create table public.forge_team_projections(run_id uuid,game_id bigint,team_id bigint,horizon_games integer);
create table public.forge_goalie_projections(run_id uuid,game_id bigint,goalie_id bigint,horizon_games integer);
create table public.player_forecast_lineup_snapshots(id uuid,accepted boolean,game_id bigint,team_id bigint,observed_at timestamptz,available_at timestamptz);
create table public.player_forecast_goalie_start_observations(id uuid,accepted boolean,game_id bigint,team_id bigint,observed_at timestamptz,available_at timestamptz);
create table public.player_forecast_observation_conflicts(id uuid,game_id bigint,team_id bigint);
create table public.player_forecast_conflict_resolutions(id uuid,conflict_id uuid,resolved_at timestamptz,created_at timestamptz);
grant select,insert,update on public.forge_runs to service_role;
grant select on public.games to service_role;
grant select,insert on public.forge_player_projections,public.forge_team_projections,public.forge_goalie_projections to service_role;

-- Exercise the actual existing reservation/publication and news/queue guards.
\ir ../migrations/20260916012353_starter_board_game_revisions.sql
\ir ../migrations/20260916014510_starter_board_news_queue.sql
\ir ../migrations/20261002021651_forge_local_execution_fence.sql

insert into public.games select id,current_date+1,(current_date+1)::timestamptz+interval '12 hours',1,2
  from generate_series(9001,9020) id;

create function fhfh_internal.fixture_prepare_forge(p_run uuid,p_game bigint,p_code text)
returns uuid language plpgsql as $$
declare snapshot_id uuid:=gen_random_uuid(); contents jsonb; cutoff timestamptz:=clock_timestamp()-interval '5 seconds';
begin
  update public.forge_runs set status='succeeded',metrics='{}'::jsonb where run_id=p_run;
  contents:=jsonb_build_object('version','forge-inputs-v1','runId',p_run,'slateDate',current_date+1,
    'replayClassification','captured_live','horizonGames',1,'decisionAsOf',cutoff,
    'inputCutoff',cutoff,'capturedAt',clock_timestamp(),'codeVersion',p_code);
  insert into public.player_forecast_source_observations(id,provider,dataset_key,entity_kind,entity_key,
    observed_at,available_at,payload_hash,payload)
    values(snapshot_id,'forge','forge-run-inputs-v1','forge_run',p_run::text,clock_timestamp(),clock_timestamp(),
      encode(sha256(convert_to(contents::text,'UTF8')),'hex'),contents);
  insert into public.forge_player_projections values(p_run,p_game,1,1,1),(p_run,p_game,2,2,1);
  insert into public.forge_team_projections values(p_run,p_game,1,1),(p_run,p_game,2,1);
  return snapshot_id;
end; $$;
