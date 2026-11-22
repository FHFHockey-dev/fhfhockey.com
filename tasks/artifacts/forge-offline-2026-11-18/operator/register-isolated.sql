-- Isolated rehearsal only. Required psql variables: candidate. Register inactive.
\set ON_ERROR_STOP on
begin;
set local lock_timeout='2s';
do $$ begin
  if exists(select from cron.job) or exists(select from forge_pregame_capture.claims)
    or exists(select from forge_pregame_capture.hosted_runs) or
    (select count(*) from public.games where id=2099020991 and "startTime"='2026-11-23 22:00+00')<>1 or
    exists(select from public.games where id in (2026020336,2026020353))
    then raise exception 'expected unused isolated rehearsal'; end if;
end $$;
-- On a new dedicated Supabase project only. Bound statements on the API pool itself, including
-- a request whose HTTP client disconnected. Inspect the effective setting before activation.
alter role authenticator set statement_timeout='15s';
alter role service_role set statement_timeout='15s';
create function public.forge_rehearsal_api_clock() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('role',current_user,'statementTimeout',current_setting('statement_timeout'),'now',statement_timestamp());
$$;
revoke all on function public.forge_rehearsal_api_clock() from public,anon,authenticated;
grant execute on function public.forge_rehearsal_api_clock() to service_role;
notify pgrst,'reload config';
notify pgrst,'reload schema';

insert into forge_pregame_capture.hosted_runs
  (game_id,expected_code_version,scheduled_start,slate_date,open_at,close_at,witness_authority,witness_principal,player_id,context_id,app_origin)
values (2099020991,:'candidate','2026-11-23 22:00+00','2026-11-23','2026-11-23 20:40+00','2026-11-23 20:53+00',
  'automated','forge_independent_verifier',8471001,'synthetic-single-center-points-v1','https://fhfh-forge-offline-rehearsal.vercel.app');

-- No late action, even if the cron daemon returns months later. The independent watchdog never queues a request.
create function forge_pregame_capture.rehearsal_tick_2099020991(is_monitor boolean) returns text
language plpgsql set search_path='' as $$
declare result text; now_at timestamptz:=clock_timestamp(); job record;
begin
  if now_at<'2026-11-23 20:40+00' then return 'waiting_window'; end if;
  if now_at<'2026-11-23 21:12+00' then
    if is_monitor then result:=forge_pregame_capture.hosted_watch_v2(2099020991);
    else result:=forge_pregame_capture.hosted_tick_v2(); end if;
  else
    perform pg_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'),1);
    perform forge_pregame_capture.hosted_watch_v2(2099020991);
    perform forge_pregame_capture.hosted_end_v2(2099020991,'unresolved','rehearsal_window_closed');
  end if;
  if exists(select from forge_pregame_capture.hosted_runs where game_id=2099020991 and terminal_at is not null) then
    for job in select jobid from cron.job where jobname in ('forge-isolated-dispatch-2099020991','forge-isolated-watch-2099020991')
      and username=current_user and active order by jobid loop
      perform cron.alter_job(job.jobid,active:=false);
    end loop;
    select phase||' '||reason into result from forge_pregame_capture.hosted_runs where game_id=2099020991;
  end if;
  return result;
end $$;
revoke all on function forge_pregame_capture.rehearsal_tick_2099020991(boolean) from public,anon,authenticated,service_role;

-- The separately provisioned reporting login can run only the non-dispatching, exact-game check.
-- A timer on the independent Linux host runs this even if the database scheduler never fires.
create role forge_rehearsal_monitor nologin;
create schema forge_rehearsal_monitor_api;
revoke all on schema forge_rehearsal_monitor_api from public,anon,authenticated,service_role;
grant usage on schema forge_rehearsal_monitor_api to forge_rehearsal_monitor;
create function forge_rehearsal_monitor_api.check_fixture() returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare receipt jsonb;
begin
  perform forge_pregame_capture.rehearsal_tick_2099020991(true);
  receipt:=forge_pregame_capture.hosted_receipt_v2(2099020991);
  return jsonb_build_object('gameId',2099020991,'phase',receipt->>'phase','reason',receipt->>'reason');
end $$;
revoke all on function forge_rehearsal_monitor_api.check_fixture() from public,anon,authenticated,service_role;
grant execute on function forge_rehearsal_monitor_api.check_fixture() to forge_rehearsal_monitor;

select cron.schedule('forge-isolated-dispatch-2099020991','* 20,21 23 11 *','select forge_pregame_capture.rehearsal_tick_2099020991(false)');
select cron.schedule('forge-isolated-watch-2099020991','* 20,21 23 11 *','select forge_pregame_capture.rehearsal_tick_2099020991(true)');
select cron.alter_job(jobid,active:=false) from cron.job where jobname in
  ('forge-isolated-dispatch-2099020991','forge-isolated-watch-2099020991') and username=current_user;
commit;
