-- Arm the signed independent witness for one game: one Supabase Cron job that POSTs to the Edge Function
-- forge-witness-verify (this project) at most :max_fires times (default 1, at most 3) and unschedules itself once the
-- game has a signed verdict. The Bearer is the project's PUBLIC anon key (the function only needs a valid project JWT
-- to be invoked; invoking it confers no authority, since a verdict counts only with the Edge key's signature).
-- Run as postgres:
--   psql -v game=2026020356 -v schedule='56-58 0 20 11 *' -v anon_key="$ANON_KEY" [-v max_fires=3] -f arm-signed-verify.sql
-- Fire after the capture's qualified outcome and at least 3 minutes before T−60 (official start).
\set ON_ERROR_STOP on
\if :{?max_fires}
\else
\set max_fires 1
\endif
begin;
set local lock_timeout = '2s';
select set_config('forge_witness_arm.game', :'game', true), set_config('forge_witness_arm.max', :'max_fires', true),
  set_config('forge_witness_arm.anon', :'anon_key', true);
do $$ declare game bigint := current_setting('forge_witness_arm.game')::bigint; begin
  if to_regclass('forge_witness.signed_verdicts') is null
    or exists (select from cron.job where jobname = 'forge-witness-signed-' || game)
    or current_setting('forge_witness_arm.max')::int not between 1 and 3
    or coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC')
    or current_setting('forge_witness_arm.anon') !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    or (forge_witness.signed_status_v1(game)->>'signed')::boolean
    then raise exception 'signed_arm_preflight_failed (installed, job free, max_fires 1-3, UTC cron, anon key, not yet signed)'; end if;
end $$;

create schema if not exists forge_witness_ops;
revoke all on schema forge_witness_ops from public;
create table if not exists forge_witness_ops.signed_fires (
  game_id bigint not null,
  fire integer not null check (fire between 1 and 3),
  jobid bigint not null,
  request_id bigint not null,
  fired_at timestamptz not null default clock_timestamp(),
  primary key (game_id, fire)
);
revoke all on forge_witness_ops.signed_fires from public;

create or replace function forge_witness_ops.fire_signed_v1(p_game bigint, p_max integer, p_anon text) returns text
language plpgsql set search_path = '' as $$
declare request bigint; job bigint; fired integer;
begin
  perform pg_advisory_xact_lock(hashtext('forge_witness_signed_fire'), hashtext(p_game::text));
  select jobid into job from cron.job where jobname = 'forge-witness-signed-' || p_game;
  select count(*) into fired from forge_witness_ops.signed_fires where game_id = p_game;
  if (forge_witness.signed_status_v1(p_game)->>'signed')::boolean or fired >= p_max then
    if job is not null then perform cron.unschedule(job); end if;
    return case when fired >= p_max then 'fires_spent' else 'decided' end;
  end if;
  request := net.http_post(url := 'https://fyhftlxokyjtpndbkfse.supabase.co/functions/v1/forge-witness-verify',
    body := '{}'::jsonb, headers := jsonb_build_object('Authorization', 'Bearer ' || p_anon, 'Content-Type', 'application/json'),
    timeout_milliseconds := 120000);
  insert into forge_witness_ops.signed_fires (game_id, fire, jobid, request_id) values (p_game, fired + 1, coalesce(job, -1), request);
  if fired + 1 >= p_max and job is not null then perform cron.unschedule(job); end if;
  return 'fired ' || request;
end $$;
revoke all on function forge_witness_ops.fire_signed_v1(bigint, integer, text) from public;

select forge_witness.arm_v1(:game) where not (forge_witness.signed_status_v1(:game)->>'armed')::boolean;
select cron.schedule('forge-witness-signed-' || :game, :'schedule',
  format('select forge_witness_ops.fire_signed_v1(%s, %s, %L)', :game, :max_fires, :'anon_key'));
commit;
select jobid, jobname, schedule, active from cron.job where jobname = 'forge-witness-signed-' || :game;
