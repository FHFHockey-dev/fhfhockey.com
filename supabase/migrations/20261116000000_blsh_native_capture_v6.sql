-- BLSH native-input capture v6 (tasks/artifacts/blsh-cron-v6-2026-11-15/DESIGN.md §3, §7, §8).
-- FILE ONLY: drafted offline, never applied by the drafting lane. Applying it needs TJ's approval.
-- Inert after apply: blsh_capture_control.enabled defaults to false and no schedule is created here
-- (the pg_cron jobs live in tasks/artifacts/blsh-cron-v6-2026-11-15/schedule/SCHEDULE.sql).
--
-- What it creates:
--   - blsh_capture_control: singleton kill switch (default off);
--   - blsh_capture_runs: one row per (pipeline, source_date), the one-shot claim and state machine;
--   - blsh_capture_objects: append-only sha256 index of every packet file in Storage;
--   - private Storage bucket blsh-native-packets (no policies: service_role only);
--   - service_role-only RPCs used by the route's isolated writer and the watchdog;
--   - owner-only retention helpers: rows are kept forever; Storage bytes are deleted first through the
--     Storage API, and only then is the run marked pruned (DESIGN.md §3.5, review L5).
begin;
set local lock_timeout = '5s';

create table public.blsh_capture_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.blsh_capture_control (singleton) values (true);

create table public.blsh_capture_runs (
  run_id uuid primary key default gen_random_uuid(),
  pipeline text not null check (pipeline = 'native-v6'),
  source_date date not null,
  state text not null default 'claimed'
    check (state in ('claimed', 'no_slate', 'refused_schedule', 'failed', 'abandoned_uncertain', 'packet_complete_pending_review')),
  reason text check (reason is null or reason ~ '^[a-z][a-z0-9_:]{2,100}$'),
  claimed_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  deployment jsonb not null default '{}'::jsonb check (jsonb_typeof(deployment) = 'object' and octet_length(deployment::text) <= 2048),
  operation_intents jsonb not null default '[]'::jsonb check (jsonb_typeof(operation_intents) = 'array' and jsonb_array_length(operation_intents) <= 2),
  manifest_sha256 text check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  keep boolean not null default false,
  pruned_at timestamptz,
  constraint blsh_capture_runs_one_shot unique (pipeline, source_date),
  constraint blsh_capture_runs_closed check ((state = 'claimed') = (closed_at is null)),
  constraint blsh_capture_runs_manifest check ((state in ('packet_complete_pending_review', 'no_slate')) = (manifest_sha256 is not null))
);

create table public.blsh_capture_objects (
  run_id uuid not null references public.blsh_capture_runs (run_id),
  ordinal integer not null check (ordinal between 1 and 64),
  path text not null unique check (path ~ '^native-v6/\d{4}-\d{2}-\d{2}/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes integer not null check (bytes between 1 and 2621440),
  written_at timestamptz not null default clock_timestamp(),
  primary key (run_id, ordinal)
);

alter table public.blsh_capture_control enable row level security;
alter table public.blsh_capture_runs enable row level security;
alter table public.blsh_capture_objects enable row level security;
-- Explicit, whatever the default privileges: service_role may only read; every write goes through
-- the RPCs below, so their checks cannot be bypassed over REST.
revoke all on public.blsh_capture_control, public.blsh_capture_runs, public.blsh_capture_objects from public, anon, authenticated, service_role;
grant select on public.blsh_capture_control, public.blsh_capture_runs, public.blsh_capture_objects to service_role;

-- Rows are never deleted: object rows stay as the integrity record even after their bytes are pruned.
create function public.blsh_capture_guard_v1() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'BLSH capture rows are append-only'; end if;
  if tg_table_name = 'blsh_capture_objects' then raise exception 'BLSH capture objects are append-only'; end if;
  -- blsh_capture_runs: identity never changes; a terminal row is immutable except keep false -> true
  -- and pruned_at null -> a time (only on a closed, not-kept run).
  if new.run_id <> old.run_id or new.pipeline <> old.pipeline or new.source_date <> old.source_date
    or new.claimed_at <> old.claimed_at or new.deployment <> old.deployment then
    raise exception 'BLSH capture run identity is immutable';
  end if;
  if old.state <> 'claimed' then
    if (new.state, new.reason, new.closed_at, new.manifest_sha256, new.operation_intents)
       is distinct from (old.state, old.reason, old.closed_at, old.manifest_sha256, old.operation_intents)
       or (old.keep and not new.keep)
       or (old.pruned_at is not null and new.pruned_at is distinct from old.pruned_at)
       or (new.pruned_at is not null and new.keep) then
      raise exception 'BLSH capture run is terminal';
    end if;
    return new;
  end if;
  if new.pruned_at is not null then raise exception 'BLSH capture run is not closed'; end if;
  if not (new.operation_intents @> old.operation_intents)
     or jsonb_array_length(new.operation_intents) not in (jsonb_array_length(old.operation_intents), jsonb_array_length(old.operation_intents) + 1) then
    raise exception 'BLSH capture intents are append-only';
  end if;
  return new;
end $$;
create trigger blsh_capture_runs_guard before update or delete on public.blsh_capture_runs
  for each row execute function public.blsh_capture_guard_v1();
create trigger blsh_capture_objects_guard before update or delete on public.blsh_capture_objects
  for each row execute function public.blsh_capture_guard_v1();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blsh-native-packets', 'blsh-native-packets', false, 2621440, array['application/json', 'text/html'])
on conflict (id) do nothing;
-- An existing bucket keeps its own settings under "do nothing": refuse unless they are exactly these (review L6).
do $$
begin
  if not exists (select 1 from storage.buckets as b where b.id = 'blsh-native-packets' and b.public = false
                 and b.file_size_limit = 2621440 and b.allowed_mime_types = array['application/json', 'text/html']::text[]) then
    raise exception 'blsh-native-packets bucket exists with other settings (public, size or MIME limits)';
  end if;
end $$;

create function public.blsh_capture_enabled_v1() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.enabled from public.blsh_capture_control as c where c.singleton), false)
$$;

-- The one-shot claim. A second claim for the same (pipeline, source_date) returns claimed=false.
create function public.blsh_capture_claim_v1(p_pipeline text, p_source_date date, p_deployment jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_run uuid;
begin
  if not public.blsh_capture_enabled_v1() then raise exception 'BLSH capture is disabled'; end if;
  insert into public.blsh_capture_runs (pipeline, source_date, deployment)
  values (p_pipeline, p_source_date, coalesce(p_deployment, '{}'::jsonb))
  on conflict on constraint blsh_capture_runs_one_shot do nothing
  returning run_id into v_run;
  if v_run is null then return pg_catalog.jsonb_build_object('claimed', false); end if;
  return pg_catalog.jsonb_build_object('claimed', true, 'run_id', v_run);
end $$;

-- One intent row before each admission+NST pair (outside the 1000 ms permit window).
create function public.blsh_capture_intent_v1(p_run_id uuid, p_group text, p_operations text[])
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_intents jsonb;
begin
  if p_group not in ('individual', 'onIce') or p_operations is distinct from array['admission:' || p_group, 'nst:' || p_group] then
    raise exception 'BLSH capture intent is invalid';
  end if;
  select r.operation_intents into v_intents from public.blsh_capture_runs as r where r.run_id = p_run_id and r.state = 'claimed' for update;
  if v_intents is null then raise exception 'BLSH capture run is not claimed'; end if;
  if pg_catalog.jsonb_array_length(v_intents) <> (case p_group when 'individual' then 0 else 1 end) then
    raise exception 'BLSH capture intent is out of order';
  end if;
  update public.blsh_capture_runs set operation_intents = v_intents || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'group', p_group, 'operations', pg_catalog.to_jsonb(p_operations), 'intendedAtUTC', pg_catalog.clock_timestamp()))
  where run_id = p_run_id;
  return true;
end $$;

-- Records one uploaded Storage object. The path is re-derived from the run row, ordinals are
-- contiguous, and the object must already exist in the bucket with the stated size.
create function public.blsh_capture_object_v1(p_run_id uuid, p_ordinal integer, p_path text, p_sha256 text, p_bytes integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_run public.blsh_capture_runs%rowtype; v_next integer;
begin
  select * into v_run from public.blsh_capture_runs as r where r.run_id = p_run_id and r.state = 'claimed' for update;
  if v_run.run_id is null then raise exception 'BLSH capture run is not claimed'; end if;
  if p_path is null or pg_catalog.left(p_path, 58) <> 'native-v6/' || v_run.source_date::text || '/' || v_run.run_id::text || '/' then
    raise exception 'BLSH capture object path is not this run''s';
  end if;
  select pg_catalog.count(*) + 1 into v_next from public.blsh_capture_objects as o where o.run_id = p_run_id;
  if p_ordinal <> v_next then raise exception 'BLSH capture object ordinal is not contiguous'; end if;
  if exists (select 1 from public.blsh_capture_objects as o where o.run_id = p_run_id and o.path like '%/MANIFEST.json') then
    raise exception 'BLSH capture manifest is already recorded';
  end if;
  if not exists (select 1 from storage.objects as s where s.bucket_id = 'blsh-native-packets' and s.name = p_path
                 and (s.metadata ->> 'size')::bigint = p_bytes) then
    raise exception 'BLSH capture object is missing from storage or has another size';
  end if;
  insert into public.blsh_capture_objects (run_id, ordinal, path, sha256, bytes) values (p_run_id, p_ordinal, p_path, p_sha256, p_bytes);
  return true;
end $$;

-- Closes a claimed run once. A complete or no_slate close needs the recorded MANIFEST.json as
-- the last object, with the stated sha256. abandoned_uncertain is the watchdog's alone.
create function public.blsh_capture_close_v1(p_run_id uuid, p_state text, p_reason text, p_manifest_sha256 text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_last public.blsh_capture_objects%rowtype;
begin
  if p_state not in ('packet_complete_pending_review', 'no_slate', 'refused_schedule', 'failed') then raise exception 'BLSH capture close state is invalid'; end if;
  perform 1 from public.blsh_capture_runs as r where r.run_id = p_run_id and r.state = 'claimed' for update;
  if not found then raise exception 'BLSH capture run is not claimed'; end if;
  if p_state in ('packet_complete_pending_review', 'no_slate') then
    select * into v_last from public.blsh_capture_objects as o where o.run_id = p_run_id order by o.ordinal desc limit 1;
    if v_last.path is null or v_last.path not like '%/MANIFEST.json' or v_last.sha256 is distinct from p_manifest_sha256 or p_reason is not null then
      raise exception 'BLSH capture completion needs the recorded manifest last';
    end if;
  elsif p_manifest_sha256 is not null or p_reason is null then
    raise exception 'BLSH capture failure needs a reason and no manifest';
  end if;
  update public.blsh_capture_runs set state = p_state, reason = p_reason, closed_at = pg_catalog.clock_timestamp(), manifest_sha256 = p_manifest_sha256
  where run_id = p_run_id;
  return true;
end $$;

-- Watchdog part 1 (12:50Z): marks runs claimed for more than 10 minutes abandoned_uncertain.
-- Their intent rows say which admission/NST pairs may have been consumed. Nothing is re-run.
create function public.blsh_capture_watchdog_v1() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_marked integer;
begin
  update public.blsh_capture_runs
  set state = 'abandoned_uncertain', reason = 'watchdog_claimed_over_10_minutes', closed_at = pg_catalog.clock_timestamp()
  where state = 'claimed' and claimed_at < pg_catalog.clock_timestamp() - interval '10 minutes';
  get diagnostics v_marked = row_count;
  return pg_catalog.jsonb_build_object('abandoned', v_marked);
end $$;

-- Watchdog part 2 (12:52Z, a separate job so part 1 is never rolled back): raises, so the
-- pg_cron run fails visibly, when yesterday's regular-season slate has no closed run, or
-- when that run ended in anything other than a complete packet or no_slate.
create function public.blsh_capture_watchdog_assert_v1(p_today date default (pg_catalog.now() at time zone 'UTC')::date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_day date := p_today - 1; v_games integer; v_state text; v_enabled boolean := public.blsh_capture_enabled_v1();
begin
  select pg_catalog.count(*) into v_games from public.games as g where g.date = v_day and g.type = 2;
  select r.state into v_state from public.blsh_capture_runs as r where r.pipeline = 'native-v6' and r.source_date = v_day;
  if v_enabled and v_games > 0 and v_state is null then raise exception 'BLSH capture missing for %', v_day; end if;
  if v_state is not null and v_state not in ('packet_complete_pending_review', 'no_slate') then
    raise exception 'BLSH capture for % ended %', v_day, v_state;
  end if;
  -- no_slate means the official schedule listed no game for D; games disagreeing is an alert.
  if v_state = 'no_slate' and v_games > 0 then raise exception 'BLSH capture for % was no_slate but games lists % games', v_day, v_games; end if;
  return pg_catalog.jsonb_build_object('sourceDate', v_day, 'games', v_games, 'state', v_state, 'enabled', v_enabled);
end $$;

-- Marks a run to keep past the 45-day retention (a conversion or acceptance references it).
create function public.blsh_capture_keep_v1(p_run_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.blsh_capture_runs set keep = true where run_id = p_run_id;
  return found;
end $$;

-- Retention, step 1 of 3 (owner only): list the Storage paths of closed, not-kept, not-yet-pruned runs
-- older than 45 days. Step 2 deletes those bytes through the Storage API (outside SQL). Step 3 marks
-- each run pruned, and refuses while any of its bytes remain. Rows are never deleted. Never scheduled.
create function public.blsh_capture_retention_v1(p_before date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_before > (pg_catalog.now() at time zone 'UTC')::date - 45 then raise exception 'BLSH capture retention keeps 45 days'; end if;
  return (select pg_catalog.jsonb_build_object('before', p_before, 'paths', coalesce(pg_catalog.jsonb_agg(o.path order by o.path), '[]'::jsonb))
          from public.blsh_capture_objects as o join public.blsh_capture_runs as r using (run_id)
          where r.source_date < p_before and r.state <> 'claimed' and not r.keep and r.pruned_at is null);
end $$;

create function public.blsh_capture_mark_pruned_v1(p_run_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_prefix text;
begin
  select 'native-v6/' || r.source_date::text || '/' || r.run_id::text || '/' into v_prefix
  from public.blsh_capture_runs as r where r.run_id = p_run_id and r.state <> 'claimed' and not r.keep and r.pruned_at is null
    and r.source_date < (pg_catalog.now() at time zone 'UTC')::date - 45;
  if v_prefix is null then raise exception 'BLSH capture run is not eligible for pruning'; end if;
  if exists (select 1 from storage.objects as s where s.bucket_id = 'blsh-native-packets' and pg_catalog.left(s.name, 58) = v_prefix) then
    raise exception 'BLSH capture bytes must be deleted from Storage first';
  end if;
  update public.blsh_capture_runs set pruned_at = pg_catalog.clock_timestamp() where run_id = p_run_id;
  return true;
end $$;

revoke all on function public.blsh_capture_guard_v1(), public.blsh_capture_enabled_v1(), public.blsh_capture_claim_v1(text, date, jsonb),
  public.blsh_capture_intent_v1(uuid, text, text[]), public.blsh_capture_object_v1(uuid, integer, text, text, integer),
  public.blsh_capture_close_v1(uuid, text, text, text), public.blsh_capture_watchdog_v1(), public.blsh_capture_watchdog_assert_v1(date),
  public.blsh_capture_keep_v1(uuid), public.blsh_capture_retention_v1(date), public.blsh_capture_mark_pruned_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.blsh_capture_enabled_v1(), public.blsh_capture_claim_v1(text, date, jsonb),
  public.blsh_capture_intent_v1(uuid, text, text[]), public.blsh_capture_object_v1(uuid, integer, text, text, integer),
  public.blsh_capture_close_v1(uuid, text, text, text), public.blsh_capture_watchdog_v1(), public.blsh_capture_watchdog_assert_v1(date),
  public.blsh_capture_keep_v1(uuid)
  to service_role;
-- blsh_capture_retention_v1 and blsh_capture_mark_pruned_v1 stay owner-only (no grant): run from the SQL editor.

commit;
