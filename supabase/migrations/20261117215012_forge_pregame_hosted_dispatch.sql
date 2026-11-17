-- Private hosted dispatch state for the existing pregame-native-v1 custody policy.
-- Installation creates no approval, Vault secret, extension, or Cron job.
create table forge_pregame_capture.hosted_slates (
  slate_date date primary key,
  last_slate_date date check (last_slate_date between slate_date and slate_date + 365),
  discovered_through date,
  enabled boolean not null default false,
  approved_at timestamptz not null default clock_timestamp(),
  expected_code_version text not null check (expected_code_version ~ '^[0-9a-f]{40}$'),
  canary_game_id bigint,
  canary_scheduled_start timestamptz,
  constraint hosted_canary_binding check (
    (canary_game_id is null) = (canary_scheduled_start is null)
    and (canary_game_id is null or last_slate_date is null)
  ),
  gate_failures smallint not null default 0 check (gate_failures between 0 and 2),
  source_failures smallint not null default 0 check (source_failures between 0 and 2),
  stop_reason text,
  stopped_at timestamptz,
  constraint hosted_slate_stop check ((stop_reason is null) = (stopped_at is null))
);
create unique index hosted_one_enabled_slate on forge_pregame_capture.hosted_slates (enabled) where enabled;

create table forge_pregame_capture.hosted_games (
  game_id bigint primary key,
  approval_date date not null references forge_pregame_capture.hosted_slates(slate_date),
  slate_date date not null,
  scheduled_start timestamptz not null,
  safe_start timestamptz not null,
  schedule_state text not null default 'waiting',
  state text not null default 'pending' check (state in ('pending', 'queued', 'started', 'ambiguous', 'finished')),
  dispatch_id uuid unique,
  expected_code_version text check (expected_code_version ~ '^[0-9a-f]{40}$'),
  request_id bigint,
  queued_at timestamptz,
  started_at timestamptz,
  stale_at timestamptz,
  ended_at timestamptz,
  outcome text check (outcome in ('never_dispatched', 'source_failed', 'save_unknown', 'saved_without_valid_witness',
    'qualified', 'unresolved')),
  reason text,
  constraint hosted_dispatch_binding check (
    (dispatch_id is not null) = (expected_code_version is not null and request_id is not null and queued_at is not null)
  ),
  constraint hosted_dispatch_open_clock check (
    (state in ('queued', 'started')) = (stale_at is not null)
  ),
  constraint hosted_dispatch_ending check (
    (state in ('finished', 'ambiguous')) = (outcome is not null and ended_at is not null)
  )
);
create index hosted_pending_slate on forge_pregame_capture.hosted_games (approval_date, safe_start, game_id) where state = 'pending';
create unique index hosted_one_in_flight on forge_pregame_capture.hosted_games ((true)) where state in ('queued', 'started', 'ambiguous');

alter table forge_pregame_capture.hosted_slates enable row level security;
alter table forge_pregame_capture.hosted_games enable row level security;
revoke all on forge_pregame_capture.hosted_slates, forge_pregame_capture.hosted_games from public, anon, authenticated, service_role;

-- Match the current official game and both team schedule rows. The game clock is conservative
-- when a team schedule source has an earlier start. Missing or mixed rows never authorize a dispatch.
create function forge_pregame_capture.hosted_schedule(p_game_id bigint)
returns table (slate_date date, scheduled_start timestamptz, safe_start timestamptz, schedule_state text)
language sql stable set search_path = '' as $$
  select g.date, g."startTime", least(g."startTime", t.start_at),
    case when t.team_count <> 2 or not t.complete or t.first_status <> t.last_status then 'waiting'
         when not t.schedule_ok or t.first_status not in ('FUT', 'PRE') then 'ineligible'
         else 'ready'
    end
  from public.games g
  cross join lateral (
    select min(r.start_time) as start_at, count(distinct r.team_id) as team_count,
      bool_and(r.start_time is not null and nullif(btrim(r.game_status), '') is not null
        and nullif(btrim(r.schedule_status), '') is not null) as complete,
      bool_and(upper(btrim(r.schedule_status)) = 'OK') as schedule_ok,
      min(upper(btrim(r.game_status))) as first_status,
      max(upper(btrim(r.game_status))) as last_status
    from public.roster_optimizer_team_games r
    where r.game_date = g.date and r.source_game_id = g.id and r.source_season_id = g."seasonId"
      and r.team_id in (g."homeTeamId", g."awayTeamId")
  ) t
  where g.id = p_game_id;
$$;

-- Same read-only load oracle as the operator gate. Lack of monitoring visibility fails closed.
create function forge_pregame_capture.hosted_load_open()
returns boolean language plpgsql set search_path = '' as $$
declare
  open boolean;
begin
  perform pg_stat_clear_snapshot();
  select count(*) filter (where a.state = 'active') <= 5
    and coalesce(max(clock_timestamp() - a.query_start) filter (where a.state = 'active'), interval '0 seconds') <= interval '10 seconds'
    and count(*) filter (where a.state is null or (a.state = 'active' and a.query_start is null)) = 0
    and not exists (select 1 from pg_catalog.pg_locks l where not l.granted)
  into open
  from pg_catalog.pg_stat_activity a
  where a.datname = current_database() and a.backend_type = 'client backend' and a.pid <> pg_backend_pid();
  return open;
end $$;

create function forge_pregame_capture.hosted_stop(p_slate_date date, p_reason text)
returns void language sql set search_path = '' as $$
  update forge_pregame_capture.hosted_slates s
    set stop_reason = p_reason, stopped_at = clock_timestamp()
    where s.slate_date = p_slate_date and s.stop_reason is null;
  update forge_pregame_capture.hosted_games g
    set state = 'finished', outcome = 'never_dispatched', reason = 'slate_stopped', ended_at = clock_timestamp()
    where g.approval_date = p_slate_date and g.state = 'pending';
$$;

create function forge_pregame_capture.hosted_gate_closed(p_slate_date date)
returns void language plpgsql set search_path = '' as $$
declare
  failures integer;
begin
  update forge_pregame_capture.hosted_slates s set gate_failures = least(s.gate_failures + 1, 2)
    where s.slate_date = p_slate_date returning s.gate_failures into failures;
  if failures = 2 then
    perform forge_pregame_capture.hosted_stop(p_slate_date, 'load_gate_closed_twice');
  end if;
end $$;

create function forge_pregame_capture.hosted_mark_ambiguous(p_game_id bigint, p_outcome text, p_reason text)
returns void language plpgsql set search_path = '' as $$
declare
  affected_slate date;
begin
  update forge_pregame_capture.hosted_games g
    set state = 'ambiguous', outcome = p_outcome, reason = p_reason, stale_at = null, ended_at = clock_timestamp()
    where g.game_id = p_game_id returning g.approval_date into affected_slate;
  perform forge_pregame_capture.hosted_stop(affected_slate, p_reason);
end $$;

-- Cron calls this owner-only function once a minute. Net enqueues in the same transaction as
-- the fencing UUID; a delivery never outruns its durable row. HTTP responses do not release the slot.
create function forge_pregame_capture.hosted_tick_v1()
returns text language plpgsql set search_path = '' set lock_timeout = '2s' as $$
declare
  approval forge_pregame_capture.hosted_slates%rowtype;
  job forge_pregame_capture.hosted_games%rowtype;
  checked_at timestamptz;
  eastern_date date;
  discovery_end date;
  fence uuid;
  shared_secret text;
  net_id bigint;
  custody_outcome text;
  custody_claim uuid;
begin
  if not pg_try_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'), 1) then return 'locked'; end if;

  select g.* into job from forge_pregame_capture.hosted_games g where g.state in ('queued', 'started', 'ambiguous');
  if found then
    if job.state = 'ambiguous' then return 'awaiting_reconciliation'; end if;
    if job.stale_at <= clock_timestamp() then
      perform forge_pregame_capture.hosted_mark_ambiguous(job.game_id, 'unresolved', 'ambiguous_game');
      return 'awaiting_reconciliation';
    end if;
  end if;

  select s.* into approval from forge_pregame_capture.hosted_slates s where s.enabled for update;
  if not found then return 'disabled'; end if;
  if approval.stop_reason is not null then return 'stopped'; end if;

  -- Discover today, tomorrow and any earlier date missed since the last tick. Recheck yesterday
  -- to cover late games and schedule additions around ET midnight without rescanning a season.
  checked_at := clock_timestamp();
  eastern_date := (checked_at at time zone 'America/New_York')::date;
  discovery_end := least(eastern_date + 1, coalesce(approval.last_slate_date, approval.slate_date));

  insert into forge_pregame_capture.hosted_games (game_id, approval_date, slate_date, scheduled_start, safe_start)
    select g.id, approval.slate_date, g.date, g."startTime", g."startTime"
    from public.games g
    where g.date between greatest(approval.slate_date,
        least(coalesce(approval.discovered_through, approval.slate_date), eastern_date - 1)) and discovery_end
      and g."startTime" > approval.approved_at
      and (approval.canary_game_id is null or g.id = approval.canary_game_id)
    on conflict (game_id) do nothing;

  if discovery_end >= approval.slate_date and discovery_end is distinct from approval.discovered_through then
    update forge_pregame_capture.hosted_slates s set discovered_through = discovery_end
      where s.slate_date = approval.slate_date;
  end if;

  with bound as (
    select g.game_id, b.scheduled_start, least(g.safe_start, b.safe_start) as safe_start,
      case when b.slate_date is distinct from g.slate_date
             or (approval.canary_game_id = g.game_id and b.scheduled_start is distinct from approval.canary_scheduled_start)
           then 'schedule_changed'
           else b.schedule_state end as schedule_state
    from forge_pregame_capture.hosted_games g
    left join lateral forge_pregame_capture.hosted_schedule(g.game_id) b on true
    where g.approval_date = approval.slate_date and g.state = 'pending'
  ), refreshed as (
    select b.*, case
      when b.schedule_state in ('schedule_changed', 'ineligible') then b.schedule_state
      when checked_at > b.safe_start - interval '66 minutes 2 seconds'
        then case when b.schedule_state = 'waiting' then 'schedule_unavailable' else 'window_missed' end
      end as skip_reason
    from bound b
  )
  update forge_pregame_capture.hosted_games g set
    scheduled_start = coalesce(r.scheduled_start, g.scheduled_start), safe_start = r.safe_start,
    schedule_state = r.schedule_state,
    state = case when r.skip_reason is not null then 'finished' else 'pending' end,
    outcome = case when r.skip_reason is not null then 'never_dispatched' end,
    ended_at = case when r.skip_reason is not null then checked_at end,
    reason = r.skip_reason
  from refreshed r where g.game_id = r.game_id and
    (r.skip_reason is not null or (g.scheduled_start, g.safe_start, g.schedule_state) is distinct from
      (r.scheduled_start, r.safe_start, r.schedule_state));

  if job.game_id is not null then return 'in_flight'; end if;
  if eastern_date - 1 > coalesce(approval.last_slate_date, approval.slate_date)
     and not exists (select 1 from forge_pregame_capture.hosted_games g
       where g.approval_date = approval.slate_date and g.state = 'pending') then
    update forge_pregame_capture.hosted_slates s set enabled = false where s.slate_date = approval.slate_date;
    return 'range_complete';
  end if;

  -- Single-slot backward placement, with the earliest deadline first when the preferred time
  -- has already passed. Keep the owner lead (T-76m02s) and pull earlier for near starts.
  -- Eight minutes reserves the 420s handler and up to one Cron interval.
  with ordered as (
    select g.game_id, g.safe_start,
      row_number() over (order by g.safe_start, g.game_id) as slot_order
    from forge_pregame_capture.hosted_games g
    where g.approval_date = approval.slate_date and g.state = 'pending' and g.schedule_state = 'ready'
  ), plan as (
    select o.*, min(o.safe_start - interval '76 minutes 2 seconds' - o.slot_order * interval '8 minutes')
      over (order by o.slot_order rows between current row and unbounded following)
        + o.slot_order * interval '8 minutes' as due_at
    from ordered o
  )
  select g.* into job
  from plan p join forge_pregame_capture.hosted_games g using (game_id)
  where p.due_at <= checked_at and checked_at <= p.safe_start - interval '66 minutes 2 seconds'
  order by p.slot_order limit 1;
  if not found then return 'idle'; end if;

  -- Claim/terminal custody from the approved manual/earlier lane wins over scheduling.
  perform forge_pregame_capture.lock_key(job.game_id, 'pregame-native-v1');
  select o.outcome into custody_outcome from forge_pregame_capture.outcomes o
    where o.game_id = job.game_id and o.policy_id = 'pregame-native-v1';
  select c.id into custody_claim from forge_pregame_capture.claims c
    where c.game_id = job.game_id and c.policy_id = 'pregame-native-v1';
  if custody_outcome is not null then
    update forge_pregame_capture.hosted_games g
      set state = 'finished', outcome = custody_outcome, reason = 'existing_custody', ended_at = clock_timestamp()
      where g.game_id = job.game_id;
    if custody_outcome = 'save_unknown' then
      perform forge_pregame_capture.hosted_stop(job.approval_date, 'save_unknown');
    end if;
    return 'custody_exists';
  end if;
  if custody_claim is not null then
    perform forge_pregame_capture.hosted_mark_ambiguous(job.game_id, 'unresolved', 'ambiguous_game');
    return 'awaiting_reconciliation';
  end if;

  if not forge_pregame_capture.hosted_load_open() then
    perform forge_pregame_capture.hosted_gate_closed(approval.slate_date);
    return 'load_gate_closed';
  end if;

  checked_at := clock_timestamp();
  if checked_at > job.safe_start - interval '66 minutes 2 seconds' then return 'idle'; end if;
  fence := gen_random_uuid();

  -- Only a one-dispatch HMAC enters the unlogged pg_net queue. Keep the reusable Vault value
  -- out of request headers, application state, responses, and error/notice text.
  begin
    select case when count(*) = 1 then min(v.decrypted_secret) end into shared_secret
      from vault.decrypted_secrets v where v.name = 'forge_pregame_dispatch_secret';
    if shared_secret ~ '^[!-~]{32,}$'
       and coalesce(current_setting('pg_net.max_timeout_ms', true), '420000')::integer >= 420000 then
      net_id := net.http_post(
        url := 'https://fhfhockey.com/api/v1/db/forge-pregame-capture',
        body := jsonb_build_object('dispatchId', fence),
        headers := jsonb_build_object('Content-Type', 'application/json', 'X-Forge-Dispatch-Signature',
          encode(extensions.hmac(convert_to(fence::text, 'UTF8'), convert_to(shared_secret, 'UTF8'), 'sha256'), 'hex')),
        timeout_milliseconds := 420000
      );
    end if;
  exception when others then
    net_id := null;
  end;
  if net_id is null then
    perform forge_pregame_capture.hosted_stop(approval.slate_date, 'transport_unavailable');
    return 'transport_unavailable';
  end if;

  update forge_pregame_capture.hosted_slates s set gate_failures = 0 where s.slate_date = approval.slate_date;
  update forge_pregame_capture.hosted_games g
    set state = 'queued', dispatch_id = fence, request_id = net_id, queued_at = checked_at,
      expected_code_version = approval.expected_code_version,
      stale_at = least(checked_at + interval '1 minute', job.safe_start - interval '66 minutes 2 seconds')
    where g.game_id = job.game_id;
  return 'queued';
end $$;

create function public.forge_pregame_hosted_begin_v1(p_dispatch_id uuid, p_code_version text)
returns table (status text, game_id bigint, slate_date date, scheduled_start timestamptz,
  current_scheduled_start timestamptz, policy_id text, db_now timestamptz, outcome text)
language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  job forge_pregame_capture.hosted_games%rowtype;
  approval forge_pregame_capture.hosted_slates%rowtype;
  binding record;
  refusal text;
begin
  if not pg_try_advisory_xact_lock(hashtext('forge_pregame_hosted_consume'), hashtext(p_dispatch_id::text)) then
    status := 'duplicate';
    db_now := clock_timestamp();
    return next;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'), 1);
  select g.* into job from forge_pregame_capture.hosted_games g where g.dispatch_id = p_dispatch_id;
  status := 'not_found';
  if found then
    if job.expected_code_version is distinct from p_code_version then
      status := 'pin_mismatch';
    elsif job.state <> 'queued' then
      status := 'duplicate';
      outcome := job.outcome;
    else
      select s.* into approval from forge_pregame_capture.hosted_slates s where s.slate_date = job.approval_date for share;
      if job.stale_at <= clock_timestamp() then
        perform forge_pregame_capture.hosted_mark_ambiguous(job.game_id, 'unresolved', 'ambiguous_game');
        status := 'window_missed';
        outcome := 'unresolved';
      elsif approval.expected_code_version is distinct from p_code_version then
        status := 'pin_mismatch';
      elsif not approval.enabled or approval.stop_reason is not null
         or (approval.canary_game_id is not null and approval.canary_game_id <> job.game_id) then
        refusal := 'disabled';
      else
        select b.* into binding from forge_pregame_capture.hosted_schedule(job.game_id) b;
        if not found or binding.slate_date is distinct from job.slate_date
           or binding.scheduled_start is distinct from job.scheduled_start or binding.schedule_state <> 'ready'
           or (approval.canary_game_id is not null and binding.scheduled_start is distinct from approval.canary_scheduled_start) then
          refusal := 'schedule_changed';
        else
          job.safe_start := least(job.safe_start, binding.safe_start);
          perform forge_pregame_capture.lock_key(job.game_id, 'pregame-native-v1');
          select o.outcome into outcome from forge_pregame_capture.outcomes o
            where o.game_id = job.game_id and o.policy_id = 'pregame-native-v1';
          if outcome is not null then
            update forge_pregame_capture.hosted_games g
              set state = 'finished', outcome = o.outcome, reason = 'existing_custody', stale_at = null, ended_at = clock_timestamp()
              from forge_pregame_capture.outcomes o
              where g.game_id = job.game_id and o.game_id = g.game_id and o.policy_id = 'pregame-native-v1';
            if outcome = 'save_unknown' then
              perform forge_pregame_capture.hosted_stop(job.approval_date, 'save_unknown');
            end if;
            status := 'custody_exists';
          elsif exists (select 1 from forge_pregame_capture.claims c
              where c.game_id = job.game_id and c.policy_id = 'pregame-native-v1') then
            perform forge_pregame_capture.hosted_mark_ambiguous(job.game_id, 'unresolved', 'ambiguous_game');
            status := 'custody_exists';
            outcome := 'unresolved';
          elsif not forge_pregame_capture.hosted_load_open() then
            refusal := 'load_gate_closed';
          elsif clock_timestamp() >= job.stale_at or clock_timestamp() > job.safe_start - interval '66 minutes 2 seconds' then
            refusal := 'window_missed';
          else
            db_now := clock_timestamp();
            update forge_pregame_capture.hosted_games g
              set state = 'started', started_at = db_now, stale_at = db_now + interval '7 minutes', safe_start = job.safe_start
              where g.game_id = job.game_id;
            status := 'started';
            game_id := job.game_id;
            slate_date := job.slate_date;
            scheduled_start := job.scheduled_start;
            current_scheduled_start := job.safe_start;
            policy_id := 'pregame-native-v1';
          end if;
        end if;
      end if;
      if refusal is not null then
        update forge_pregame_capture.hosted_games g
          set state = 'finished', outcome = 'never_dispatched', reason = refusal, stale_at = null, ended_at = clock_timestamp()
          where g.game_id = job.game_id;
        if refusal = 'load_gate_closed' then
          perform forge_pregame_capture.hosted_gate_closed(job.approval_date);
        end if;
        status := refusal;
        outcome := 'never_dispatched';
      end if;
    end if;
  end if;
  db_now := coalesce(db_now, clock_timestamp());
  return next;
end $$;

create function public.forge_pregame_hosted_finish_v1(
  p_dispatch_id uuid, p_code_version text, p_outcome text, p_reason text, p_stop_trigger text)
returns table (status text, outcome text)
language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  job forge_pregame_capture.hosted_games%rowtype;
  custody_outcome text;
  custody_claim uuid;
  failure_count integer;
  detail text;
begin
  perform pg_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'), 1);
  select g.* into job from forge_pregame_capture.hosted_games g where g.dispatch_id = p_dispatch_id;
  if not found then
    status := 'not_found';
  elsif job.expected_code_version is distinct from p_code_version then
    status := 'pin_mismatch';
  elsif job.state in ('finished', 'ambiguous') then
    status := 'duplicate';
    outcome := job.outcome;
  elsif job.state <> 'started' then
    status := 'not_started';
  elsif p_outcome = 'unresolved' then
    perform forge_pregame_capture.hosted_mark_ambiguous(job.game_id, 'unresolved',
      case when p_stop_trigger in ('statement_timeout', 'gate_dns_failure') then p_stop_trigger else 'ambiguous_game' end);
    status := 'finished';
    outcome := 'unresolved';
  else
    detail := case when p_reason in (
      'capture_disabled', 'capture_configuration_invalid', 'invalid_dispatch_binding', 'dispatch_window_closed',
      'schedule_unavailable', 'schedule_changed', 'game_no_longer_pregame', 'pin_failed', 'capture_unconfirmed',
      'statement_timeout', 'source_failed', 'save_unknown', 'saved_without_valid_witness'
    ) then p_reason else 'endpoint_finished' end;
    perform forge_pregame_capture.lock_key(job.game_id, 'pregame-native-v1');
    select o.outcome into custody_outcome from forge_pregame_capture.outcomes o
      where o.game_id = job.game_id and o.policy_id = 'pregame-native-v1';
    select c.id into custody_claim from forge_pregame_capture.claims c
      where c.game_id = job.game_id and c.policy_id = 'pregame-native-v1';

    if p_outcome = 'never_dispatched' and custody_outcome is null and custody_claim is null then
      perform public.forge_pregame_capture_record_outcome_v1(job.game_id, 'pregame-native-v1', null::uuid,
        'never_dispatched', jsonb_build_object('reason', detail));
      custody_outcome := 'never_dispatched';
    end if;
    if custody_outcome is null or custody_outcome is distinct from p_outcome then
      perform forge_pregame_capture.hosted_mark_ambiguous(job.game_id, 'unresolved', 'ambiguous_game');
      status := 'outcome_mismatch';
      outcome := 'unresolved';
    else
      update forge_pregame_capture.hosted_games g
        set state = 'finished', outcome = custody_outcome, reason = detail, stale_at = null, ended_at = clock_timestamp()
        where g.game_id = job.game_id;
      update forge_pregame_capture.hosted_slates s
        set source_failures = case when custody_outcome = 'source_failed' then least(s.source_failures + 1, 2) else 0 end
        where s.slate_date = job.approval_date returning s.source_failures into failure_count;
      if p_stop_trigger in ('statement_timeout', 'gate_dns_failure', 'ambiguous_game') then
        perform forge_pregame_capture.hosted_stop(job.approval_date, p_stop_trigger);
      elsif custody_outcome = 'save_unknown' then
        perform forge_pregame_capture.hosted_stop(job.approval_date, 'save_unknown');
      elsif failure_count = 2 then
        perform forge_pregame_capture.hosted_stop(job.approval_date, 'source_failed_twice');
      end if;
      status := 'finished';
      outcome := custody_outcome;
    end if;
  end if;
  return next;
end $$;

-- Owner-only recovery. A committed authoritative outcome is sufficient; absent custody is
-- only resolvable after the original/current T-60 boundary plus the owner's two-minute grace.
-- A claim without an outcome stays unresolved for the existing custody reconciliation. This
-- never creates a claim, replays an HTTP request, or clears a stopped slate's latch.
create function forge_pregame_capture.hosted_reconcile_v1(p_game_id bigint)
returns text language plpgsql set search_path = '' set lock_timeout = '2s' as $$
declare
  job forge_pregame_capture.hosted_games%rowtype;
  current_start timestamptz;
  resolved text;
begin
  perform pg_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'), 1);
  select g.* into job from forge_pregame_capture.hosted_games g where g.game_id = p_game_id;
  if not found then return 'not_found'; end if;
  if job.state = 'finished' then return job.outcome; end if;
  if job.state = 'pending' then return 'not_dispatched'; end if;
  if job.state in ('queued', 'started') then
    if job.stale_at > clock_timestamp() then return 'in_flight'; end if;
    perform forge_pregame_capture.hosted_mark_ambiguous(job.game_id, 'unresolved', 'ambiguous_game');
  end if;

  perform forge_pregame_capture.lock_key(job.game_id, 'pregame-native-v1');
  select o.outcome into resolved from forge_pregame_capture.outcomes o
    where o.game_id = job.game_id and o.policy_id = 'pregame-native-v1';
  if resolved is null then
    if exists (select 1 from forge_pregame_capture.claims c
        where c.game_id = job.game_id and c.policy_id = 'pregame-native-v1') then
      return 'custody_unresolved';
    end if;
    select g."startTime" into current_start from public.games g where g.id = job.game_id;
    if clock_timestamp() <= greatest(job.scheduled_start, current_start) - interval '58 minutes' then
      return 'awaiting_deadline';
    end if;
    perform public.forge_pregame_capture_record_outcome_v1(job.game_id, 'pregame-native-v1', null::uuid,
      'never_dispatched', '{"reason":"hosted_reconciled_no_claim"}'::jsonb);
    resolved := 'never_dispatched';
  end if;

  update forge_pregame_capture.hosted_games g
    set state = 'finished', outcome = resolved, reason = 'operator_reconciled', ended_at = clock_timestamp()
    where g.game_id = job.game_id;
  return resolved;
end $$;

revoke all on function forge_pregame_capture.hosted_schedule(bigint),
  forge_pregame_capture.hosted_load_open(), forge_pregame_capture.hosted_stop(date, text),
  forge_pregame_capture.hosted_gate_closed(date), forge_pregame_capture.hosted_mark_ambiguous(bigint, text, text),
  forge_pregame_capture.hosted_tick_v1(), forge_pregame_capture.hosted_reconcile_v1(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.forge_pregame_hosted_begin_v1(uuid, text),
  public.forge_pregame_hosted_finish_v1(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.forge_pregame_hosted_begin_v1(uuid, text),
  public.forge_pregame_hosted_finish_v1(uuid, text, text, text, text) to service_role;
