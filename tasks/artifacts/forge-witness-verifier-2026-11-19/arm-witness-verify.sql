-- Arm the independent verifier for one game and register its own Supabase Cron job, in the shape of the sandbox GET:
-- net.http_get to the production route with the existing Vault 'cron_secret' as a Bearer header AND the verifier's own
-- token (forge_witness.credentials, set by set-witness-credential.sql) as x-forge-witness-token. Neither is ever in the
-- cron command or the URL. The job fires at most :max_fires times (default 1, at most 3) on the given minutes and unschedules itself
-- once that game has a verdict or the fires are spent. Run as postgres:
--   psql -v game=2026020123 -v schedule='5-7 22 19 11 *' [-v max_fires=3] -f arm-witness-verify.sql
-- Choose minutes after the capture's qualified outcome and at least 3 minutes before T−60.
\set ON_ERROR_STOP on
\if :{?max_fires}
\else
\set max_fires 1
\endif
begin;
set local lock_timeout = '2s';
select set_config('forge_witness_arm.game', :'game', true), set_config('forge_witness_arm.max', :'max_fires', true);
do $$ declare game bigint := current_setting('forge_witness_arm.game')::bigint; begin
  if to_regclass('forge_witness.verdicts') is null
    or exists (select from cron.job where jobname = 'forge-witness-verify-' || game)
    or current_setting('forge_witness_arm.max')::int not between 1 and 3
    or coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC')
    or (select count(*) from vault.decrypted_secrets where name = 'cron_secret') <> 1
    or forge_witness.credential_v1() is null
    then raise exception 'witness_arm_preflight_failed (installed, job free, max_fires 1-3, UTC cron, cron_secret, live credential)'; end if;
end $$;

create schema if not exists forge_witness_ops;
revoke all on schema forge_witness_ops from public;
create table if not exists forge_witness_ops.fires (
  game_id bigint not null,
  fire integer not null check (fire between 1 and 3),
  jobid bigint not null,
  request_id bigint not null,
  fired_at timestamptz not null default clock_timestamp(),
  primary key (game_id, fire)
);
revoke all on forge_witness_ops.fires from public;

-- Runs as the scheduling user (postgres), like the WGO jobs, so it can read Vault and call pg_net.
create or replace function forge_witness_ops.fire_v1(p_game bigint, p_max integer) returns text
language plpgsql set search_path = '' as $$
declare request bigint; job bigint; fired integer; decided boolean; credential text;
begin
  perform pg_advisory_xact_lock(hashtext('forge_witness_verify'), hashtext(p_game::text));
  select jobid into job from cron.job where jobname = 'forge-witness-verify-' || p_game;
  select count(*) into fired from forge_witness_ops.fires where game_id = p_game;
  select exists (select from jsonb_array_elements(forge_witness.status_v1()->'targets') t
    where (t->>'gameId')::bigint = p_game and t->'verdict' is not null and t->'verdict' <> 'null'::jsonb) into decided;
  if decided or fired >= p_max then
    if job is not null then perform cron.unschedule(job); end if;
    return case when decided then 'decided' else 'fires_spent' end;
  end if;
  credential := forge_witness.credential_v1();
  if credential is null then return 'credential_missing'; end if;
  request := net.http_get(url := 'https://fhfhockey.com/api/v1/db/forge-witness-verify',
    headers := jsonb_build_object('Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'x-forge-witness-token', credential),
    timeout_milliseconds := 60000);
  insert into forge_witness_ops.fires (game_id, fire, jobid, request_id) values (p_game, fired + 1, coalesce(job, -1), request);
  if fired + 1 >= p_max and job is not null then perform cron.unschedule(job); end if;
  return 'fired ' || request;
end $$;
revoke all on function forge_witness_ops.fire_v1(bigint, integer) from public;

select forge_witness.arm_v1(:game);
select cron.schedule('forge-witness-verify-' || :game, :'schedule', format('select forge_witness_ops.fire_v1(%s, %s)', :game, :max_fires));
commit;
select jobid, jobname, schedule, active, command from cron.job where jobname = 'forge-witness-verify-' || :game;
