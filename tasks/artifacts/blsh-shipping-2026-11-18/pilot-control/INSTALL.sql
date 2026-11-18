-- Operator artifact for job 404 on November 21. Supply reviewed release_sha and deployment_id as psql variables.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
lock table public.blsh_capture_control, public.blsh_capture_runs in share row exclusive mode;

do $$
begin
  -- These PostgreSQL 15 definitions come from the reviewed migration 153. Refuse schema drift.
  if pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(
       'public.blsh_capture_enabled_v1()'::regprocedure), 'UTF8')), 'hex') <> '8dfa681a7e3e1439b6a47f4e2dc9b9e2aeab431251234f8939e01928b1a4a923'
     or pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(
       'public.blsh_capture_claim_v1(text,date,jsonb)'::regprocedure), 'UTF8')), 'hex') <> '28386d1d686b48fc3cee2f42578a9cbc8912161aa8b3dc5e8d546bfb29882bee' then
    raise exception 'pilot_migration_153_definition_mismatch';
  end if;
  if not exists (select 1 from public.blsh_capture_control where singleton and not enabled)
     or public.blsh_capture_enabled_v1() is distinct from false then
    raise exception 'pilot_install_requires_switch_off';
  end if;
  if exists (select 1 from public.blsh_capture_runs where pipeline = 'native-v6' and source_date = date '2026-11-20') then
    raise exception 'pilot_date_already_consumed';
  end if;
  if pg_catalog.clock_timestamp() >= timestamptz '2026-11-21 12:05:00+00' then
    raise exception 'pilot_install_after_primary_start';
  end if;
end $$;

create table public.blsh_pilot_20261121 (
  singleton boolean primary key check (singleton),
  release_sha text not null check (release_sha ~ '^[0-9a-f]{40}$'),
  deployment_id text not null check (deployment_id ~ '^dpl_[A-Za-z0-9_-]{1,124}$')
);
alter table public.blsh_pilot_20261121 enable row level security;
revoke all on public.blsh_pilot_20261121 from public, anon, authenticated, service_role;
insert into public.blsh_pilot_20261121 values (true, :'release_sha', :'deployment_id');

-- Both the route preflight and migration 153's unchanged claim RPC use this same switch.
create or replace function public.blsh_capture_enabled_v1() returns boolean
language sql volatile security definer set search_path = '' as $$
  select coalesce((select c.enabled from public.blsh_capture_control c where c.singleton), false)
     and pg_catalog.tstzrange(timestamptz '2026-11-21 12:05:00+00', timestamptz '2026-11-21 12:07:00+00', '[)')
         @> pg_catalog.clock_timestamp()
$$;

-- AFTER INSERT rechecks the clock after any uniqueness wait. The original claim owns its transaction
-- and returns its run ID only after this trigger succeeds. Existing rows and later close operations are unaffected.
create function public.blsh_pilot_claim_20261121() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.blsh_capture_control where singleton and enabled for share;
  if not found or not public.blsh_capture_enabled_v1()
     or new.pipeline <> 'native-v6' or new.source_date <> date '2026-11-20'
     or not exists (select 1 from public.blsh_pilot_20261121 p where p.singleton
           and new.deployment @> pg_catalog.jsonb_build_object('gitCommitSha', p.release_sha, 'deploymentId', p.deployment_id)) then
    raise exception 'pilot_claim_outside_permit';
  end if;
  return new;
end $$;
revoke all on function public.blsh_pilot_claim_20261121() from public, anon, authenticated, service_role;
create trigger blsh_pilot_claim_20261121 after insert on public.blsh_capture_runs
  for each row execute function public.blsh_pilot_claim_20261121();
commit;
