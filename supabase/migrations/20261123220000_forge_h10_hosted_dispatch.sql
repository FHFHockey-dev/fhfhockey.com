-- NOT APPLIED. Per-dispatch HMAC authentication for the hosted FORGE H1–H10 route (TJ Q3 decision, 2026-11-23),
-- after the 11-17 pregame pattern (20261117215012). Applies after 20261029235656. Installation creates no Vault secret,
-- extension or Cron job; the Vault secret `forge_h10_dispatch_secret` and the cron jobs are separate, approved steps.
--
-- pg_cron calls the owner-only `forge_v2_private.forge_h10_tick_v1(mode)`. It records a one-use dispatch (uuid,
-- mode, run, expiry) and posts it with an HMAC over route, mode, run, dispatch id and expiry. Only the signature
-- travels; the reusable secret stays in Vault. The route verifies the signature, then calls
-- `public.forge_h10_dispatch_begin_v1`, which starts the dispatch exactly once; a duplicate or concurrent delivery
-- reports the same run and does no work. One dispatch is in flight at a time; a started one is stale after 6 minutes.
begin;
set lock_timeout = '5s';

do $$ begin
  if to_regnamespace('forge_v2_private') is null then raise exception 'apply 20261029235656 first'; end if;
end $$;

create table forge_v2_private.forge_h10_dispatches (
  dispatch_id uuid primary key,
  mode text not null check (mode in ('nightly', 'material')),
  run_key text not null check (run_key ~ '^(nightly|material):[0-9]{4}-[0-9]{2}-[0-9]{2}$' and split_part(run_key, ':', 1) = mode),
  route text not null check (route = '/api/v1/db/forge-h10-shadow'),
  expires_at timestamptz not null,
  state text not null default 'queued' check (state in ('queued', 'started', 'finished')),
  request_id bigint,
  queued_at timestamptz not null default clock_timestamp(),
  started_at timestamptz,
  stale_at timestamptz,
  ended_at timestamptz,
  outcome text,
  check ((state = 'finished') = (ended_at is not null and outcome is not null)),
  check ((state = 'started') = (stale_at is not null))
);
create unique index forge_h10_one_in_flight on forge_v2_private.forge_h10_dispatches ((true)) where state in ('queued', 'started');
create index forge_h10_dispatches_run on forge_v2_private.forge_h10_dispatches (run_key, queued_at);
alter table forge_v2_private.forge_h10_dispatches enable row level security;
revoke all on forge_v2_private.forge_h10_dispatches from public, anon, authenticated, service_role;

-- The run a tick belongs to: the Eastern date of the latest 04:00 ET cutoff (the route computes the same key).
create function forge_v2_private.forge_h10_run_key(p_mode text, p_at timestamptz) returns text
language sql stable set search_path = '' as $$
  select p_mode || ':' || to_char(case when (p_at at time zone 'America/New_York')::time >= time '04:00'
    then (p_at at time zone 'America/New_York')::date else (p_at at time zone 'America/New_York')::date - 1 end, 'YYYY-MM-DD');
$$;

-- Owner-only. Cron calls it; nothing else may. Expired queued dispatches and stale started ones are closed first, so a
-- lost delivery never blocks the next tick for more than one interval.
create function forge_v2_private.forge_h10_tick_v1(p_mode text)
returns text language plpgsql set search_path = '' set lock_timeout = '2s' as $$
declare
  fence uuid; expires timestamptz; run text; secret text; signature text; net_id bigint; message text;
  route constant text := '/api/v1/db/forge-h10-shadow';
begin
  if p_mode not in ('nightly', 'material') then raise exception 'forge_h10_mode_invalid'; end if;
  if not pg_try_advisory_xact_lock(hashtext('forge_h10_hosted_dispatch'), 1) then return 'locked'; end if;
  update forge_v2_private.forge_h10_dispatches d set state = 'finished', outcome = 'expired_undelivered', ended_at = clock_timestamp()
    where d.state = 'queued' and d.expires_at < clock_timestamp();
  update forge_v2_private.forge_h10_dispatches d set state = 'finished', outcome = 'stale', stale_at = null, ended_at = clock_timestamp()
    where d.state = 'started' and d.stale_at <= clock_timestamp();
  if exists (select 1 from forge_v2_private.forge_h10_dispatches d where d.state in ('queued', 'started')) then return 'in_flight'; end if;

  fence := gen_random_uuid();
  expires := date_trunc('second', clock_timestamp()) + interval '90 seconds';
  run := forge_v2_private.forge_h10_run_key(p_mode, clock_timestamp());
  message := concat_ws(E'\n', 'forge-h10-dispatch-v1', route, p_mode, run, fence::text, extract(epoch from expires)::bigint::text);
  -- Keep the reusable Vault value out of headers, application state, responses and error text.
  begin
    select case when count(*) = 1 then min(v.decrypted_secret) end into secret from vault.decrypted_secrets v where v.name = 'forge_h10_dispatch_secret';
    if secret ~ '^[!-~]{32,}$' then
      signature := encode(extensions.hmac(convert_to(message, 'UTF8'), convert_to(secret, 'UTF8'), 'sha256'), 'hex');
      net_id := net.http_post(
        url := 'https://fhfhockey.com' || route,
        body := jsonb_build_object('dispatchId', fence, 'mode', p_mode, 'runKey', run, 'expiresAt', extract(epoch from expires)::bigint),
        headers := jsonb_build_object('Content-Type', 'application/json', 'X-Forge-H10-Signature', signature),
        timeout_milliseconds := 300000);
    end if;
  exception when others then
    net_id := null;
  end;
  if net_id is null then return 'transport_unavailable'; end if;
  insert into forge_v2_private.forge_h10_dispatches (dispatch_id, mode, run_key, route, expires_at, request_id) values (fence, p_mode, run, route, expires, net_id);
  return 'queued';
end $$;

-- The route's only door. Exactly one delivery of a dispatch starts; every other one reports what happened.
create function public.forge_h10_dispatch_begin_v1(p_dispatch_id uuid, p_mode text, p_run_key text, p_expires_at bigint)
returns table (status text, outcome text)
language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare job forge_v2_private.forge_h10_dispatches%rowtype;
begin
  if not pg_try_advisory_xact_lock(hashtext('forge_h10_dispatch_consume'), hashtext(p_dispatch_id::text)) then
    status := 'duplicate'; return next; return;
  end if;
  select d.* into job from forge_v2_private.forge_h10_dispatches d where d.dispatch_id = p_dispatch_id for update;
  if not found then status := 'not_found';
  elsif job.mode <> p_mode or job.run_key <> p_run_key or extract(epoch from job.expires_at)::bigint <> p_expires_at then status := 'binding_mismatch';
  elsif job.state <> 'queued' then status := 'duplicate'; outcome := job.outcome;
  elsif job.expires_at < clock_timestamp() then
    update forge_v2_private.forge_h10_dispatches d set state = 'finished', outcome = 'expired', ended_at = clock_timestamp() where d.dispatch_id = p_dispatch_id;
    status := 'expired'; outcome := 'expired';
  else
    update forge_v2_private.forge_h10_dispatches d set state = 'started', started_at = clock_timestamp(), stale_at = clock_timestamp() + interval '6 minutes'
      where d.dispatch_id = p_dispatch_id;
    status := 'started';
  end if;
  return next;
end $$;

create function public.forge_h10_dispatch_finish_v1(p_dispatch_id uuid, p_outcome text)
returns text language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare updated integer;
begin
  update forge_v2_private.forge_h10_dispatches d set state = 'finished', outcome = left(coalesce(p_outcome, 'unknown'), 60), stale_at = null, ended_at = clock_timestamp()
    where d.dispatch_id = p_dispatch_id and d.state = 'started';
  get diagnostics updated = row_count;
  return case when updated = 1 then 'finished' else 'not_started' end;
end $$;

revoke all on function forge_v2_private.forge_h10_run_key(text, timestamptz), forge_v2_private.forge_h10_tick_v1(text) from public, anon, authenticated, service_role;
revoke all on function public.forge_h10_dispatch_begin_v1(uuid, text, text, bigint), public.forge_h10_dispatch_finish_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.forge_h10_dispatch_begin_v1(uuid, text, text, bigint), public.forge_h10_dispatch_finish_v1(uuid, text) to service_role;
commit;

-- Readback (read-only):
--   select to_regclass('forge_v2_private.forge_h10_dispatches') is not null, to_regprocedure('forge_v2_private.forge_h10_tick_v1(text)') is not null;
--   select has_function_privilege('service_role', 'forge_v2_private.forge_h10_tick_v1(text)', 'execute');  -- expect false
-- Rollback (no dispatch in flight): drop the three functions above, forge_v2_private.forge_h10_run_key and the table.
