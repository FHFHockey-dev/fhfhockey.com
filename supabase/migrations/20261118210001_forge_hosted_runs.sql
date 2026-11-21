begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Owner registers a dormant scope. Arming and scheduling are separate, explicit operations.
-- The legacy slate remains disabled. Its minute job may be repointed only on approval.
create table forge_pregame_capture.hosted_runs (
  game_id bigint primary key check (game_id > 0),
  expected_code_version text not null check (expected_code_version ~ '^[a-f0-9]{40}$'),
  policy_id text not null default 'pregame-native-v1' check (policy_id = 'pregame-native-v1'),
  scheduled_start timestamptz not null,
  slate_date date not null,
  open_at timestamptz not null,
  close_at timestamptz not null,
  witness_authority text not null check (witness_authority in ('named_human','automated')),
  witness_principal name not null,
  player_id bigint not null check (player_id > 0),
  context_id text not null check (context_id = 'synthetic-single-center-points-v1'),
  -- Exact HTTPS origin of this environment, owner-provided. Tokens are single-use and domain separated.
  app_origin text not null check (app_origin ~ '^https://[a-z0-9][a-z0-9.-]+[a-z0-9]$'),
  phase text not null default 'dormant' check (phase in
    ('dormant','approved','preflight','ready','capture','verify','publish','readers','succeeded','skipped','failed','unresolved')),
  armed_at timestamptz,
  claim_id uuid unique references forge_pregame_capture.claims(id),
  publication jsonb,
  reader_results jsonb,
  terminal_at timestamptz,
  reconciled_at timestamptz,
  reason text,
  check (open_at < close_at and close_at <= scheduled_start - interval '66 minutes 2 seconds'),
  check ((phase in ('succeeded','skipped','failed','unresolved')) = (terminal_at is not null))
);
create unique index hosted_one_active_run on forge_pregame_capture.hosted_runs ((true))
  where phase not in ('dormant','succeeded','skipped','failed') and reconciled_at is null;
create table forge_pregame_capture.hosted_steps (
  id uuid primary key default gen_random_uuid(),
  game_id bigint not null references forge_pregame_capture.hosted_runs(game_id),
  stage text not null check (stage in ('preflight','capture','publish','readers')),
  request_id bigint not null,
  queued_at timestamptz not null default clock_timestamp(),
  consumed_at timestamptz,
  reported_reason text,
  unique(game_id,stage)
);
alter table forge_pregame_capture.hosted_runs enable row level security;
alter table forge_pregame_capture.hosted_steps enable row level security;
revoke all on forge_pregame_capture.hosted_runs, forge_pregame_capture.hosted_steps from public, anon, authenticated, service_role;

-- After registration, scope edits require a separately reviewed replacement decision.
-- Phase transitions may attach immutable receipt pointers but cannot replace the target.
create trigger immutable_hosted_scope before update of game_id,expected_code_version,policy_id,scheduled_start,slate_date,
  open_at,close_at,witness_authority,witness_principal,player_id,context_id,app_origin on forge_pregame_capture.hosted_runs
  for each row execute function forge_pregame_capture.reject_mutation();

create function forge_pregame_capture.hosted_arm_v2(p_game_id bigint)
returns void language plpgsql set search_path = '' as $$
declare r forge_pregame_capture.hosted_runs; s record;
begin
  perform pg_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'),1);
  perform forge_pregame_capture.lock_key(p_game_id,'pregame-native-v1');
  select * into strict r from forge_pregame_capture.hosted_runs where game_id=p_game_id and phase='dormant' for update;
  select * into s from forge_pregame_capture.hosted_schedule(p_game_id);
  if s.schedule_state is distinct from 'ready' or s.slate_date is distinct from r.slate_date or
    s.scheduled_start is distinct from r.scheduled_start or s.safe_start is distinct from r.scheduled_start or
    clock_timestamp() >= r.open_at or exists(select from forge_pregame_capture.hosted_slates where enabled) or
    exists(select from forge_pregame_capture.hosted_games where game_id=p_game_id or state in ('queued','started','ambiguous')) or
    exists(select from forge_pregame_capture.claims where game_id=p_game_id and policy_id=r.policy_id) or
    exists(select from forge_pregame_capture.outcomes where game_id=p_game_id and policy_id=r.policy_id)
  then raise exception 'hosted_scope_ineligible'; end if;
  insert into forge_pregame_capture.hosted_slates(slate_date,expected_code_version,canary_game_id,canary_scheduled_start)
    values (r.slate_date,r.expected_code_version,r.game_id,r.scheduled_start)
    on conflict (slate_date) do nothing;
  -- A different approval on the same date keeps its ownership.
  if not exists(select from forge_pregame_capture.hosted_slates where slate_date=r.slate_date and not enabled
    and canary_game_id=p_game_id and canary_scheduled_start=r.scheduled_start and expected_code_version=r.expected_code_version
    and stop_reason is null)
  then raise exception 'hosted_slate_owned'; end if;
  update forge_pregame_capture.hosted_runs set phase='approved',armed_at=clock_timestamp() where game_id=p_game_id;
end $$;

-- All application-facing commands consume DB-issued tokens. Only this owner-side tick can enqueue them.
create function forge_pregame_capture.hosted_queue_v2(r forge_pregame_capture.hosted_runs, stage text)
returns uuid language plpgsql set search_path = '' as $$
declare fence uuid := gen_random_uuid(); secret text; signature text; request_id bigint; queued timestamptz := clock_timestamp();
begin
  select case when count(*)=1 then min(decrypted_secret) end into secret from vault.decrypted_secrets
    where name='forge_pregame_dispatch_secret';
  if secret is null or secret !~ '^[!-~]{32,}$' or
    coalesce(nullif(current_setting('pg_net.max_timeout_ms',true),''),'240000')::integer < 240000
    then raise exception 'transport_unavailable'; end if;
  signature := encode(extensions.hmac(convert_to(case when stage='capture' then 'capture-v2:'||fence else 'stage:'||fence end,'UTF8'),
    convert_to(secret,'UTF8'),'sha256'),'hex');
  request_id := net.http_post(url := r.app_origin || '/api/v1/db/forge-pregame-' ||
    case when stage='capture' then 'capture-v2' else 'stage' end, body := jsonb_build_object('dispatchId',fence),
    headers := jsonb_build_object('Content-Type','application/json','X-Forge-Dispatch-Signature',signature),
    timeout_milliseconds := 240000);
  insert into forge_pregame_capture.hosted_steps(id,game_id,stage,request_id,queued_at)
    values(fence,r.game_id,stage,request_id,queued);
  if stage='capture' then
    insert into forge_pregame_capture.hosted_games
      (game_id,approval_date,slate_date,scheduled_start,safe_start,schedule_state,state,dispatch_id,expected_code_version,request_id,queued_at,stale_at)
      values(r.game_id,r.slate_date,r.slate_date,r.scheduled_start,r.scheduled_start,'ready','queued',fence,
        r.expected_code_version,request_id,queued,least(r.close_at,queued+interval '1 minute'));
  end if;
  update forge_pregame_capture.hosted_runs set phase=stage where game_id=r.game_id;
  return fence;
end $$;

create function forge_pregame_capture.hosted_end_v2(p_game bigint,p_phase text,p_reason text)
returns text language plpgsql set search_path='' as $$
begin
  update forge_pregame_capture.hosted_runs set phase=p_phase, terminal_at=clock_timestamp(), reason=p_reason
    where game_id=p_game and terminal_at is null;
  if found then
    insert into public.cron_job_audit(job_name,status,rows_affected,details)
      values('forge-pregame-hosted-dispatch',case when p_phase='succeeded' then 'success' else 'failure' end,1,
        jsonb_build_object('gameId',p_game,'phase',p_phase,'reason',p_reason));
  end if;
  return p_phase;
end $$;

create function public.forge_pregame_hosted_begin_v2(p_dispatch_id uuid,p_code_version text,p_compute_enabled boolean,p_compute_game_id bigint)
returns table(status text,game_id bigint,slate_date date,scheduled_start timestamptz,current_scheduled_start timestamptz,
  policy_id text,db_now timestamptz,outcome text,queued_at timestamptz)
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare g forge_pregame_capture.hosted_games; r forge_pregame_capture.hosted_runs; s record; refusal text;
begin
  perform pg_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'),1);
  select * into g from forge_pregame_capture.hosted_games h where h.dispatch_id=p_dispatch_id;
  select * into r from forge_pregame_capture.hosted_runs h where h.game_id=g.game_id for update;
  if r.game_id is null then status:='not_found';
  elsif p_code_version is distinct from r.expected_code_version then status:='pin_mismatch';
  elsif r.phase <> 'capture' or g.state <> 'queued' then status:='duplicate'; outcome:=g.outcome;
  else
    select * into s from forge_pregame_capture.hosted_schedule(r.game_id);
    if p_compute_enabled is not true then refusal:='compute_off';
    elsif p_compute_game_id is distinct from r.game_id then refusal:='wrong_game_scope';
    elsif clock_timestamp() not between r.open_at and r.close_at or clock_timestamp()>=g.stale_at then refusal:='window_missed';
    elsif s.scheduled_start is distinct from r.scheduled_start or s.safe_start is distinct from r.scheduled_start
       or s.slate_date is distinct from r.slate_date or s.schedule_state is distinct from 'ready' then refusal:='schedule_changed';
    elsif exists(select from forge_pregame_capture.hosted_slates h where h.enabled or
      (h.slate_date=r.slate_date and h.stop_reason is not null)) then refusal:='disabled';
    elsif not forge_pregame_capture.hosted_load_open() then refusal:='load_gate_closed';
    end if;
    if refusal is not null then
      update forge_pregame_capture.hosted_games h set state='finished',outcome='never_dispatched',reason=refusal,
        ended_at=clock_timestamp(),stale_at=null where h.game_id=r.game_id;
      perform forge_pregame_capture.hosted_end_v2(r.game_id,'skipped',refusal);
      status:=refusal; outcome:='never_dispatched';
    else
      db_now:=clock_timestamp();
      update forge_pregame_capture.hosted_games h set state='started',started_at=db_now,stale_at=g.queued_at+interval '240 seconds'
        where h.game_id=r.game_id;
      update forge_pregame_capture.hosted_steps set consumed_at=db_now where id=p_dispatch_id;
      status:='started'; game_id:=r.game_id; slate_date:=r.slate_date; scheduled_start:=r.scheduled_start;
      current_scheduled_start:=s.safe_start; policy_id:=r.policy_id; queued_at:=g.queued_at;
    end if;
  end if;
  return next;
end $$;

-- A registered game cannot acquire a claim through a manual or legacy capture. The wrapper
-- sets a transaction-local dispatch fence, then uses the existing claim clock and uniqueness rules.
create function forge_pregame_capture.bind_hosted_claim_v2() returns trigger language plpgsql security definer set search_path='' as $$
declare r forge_pregame_capture.hosted_runs;
begin
  select * into r from forge_pregame_capture.hosted_runs where game_id=new.game_id and armed_at is not null for update;
  if not found then return new; end if;
  if r.phase <> 'capture' or r.claim_id is not null or r.policy_id<>new.policy_id or r.expected_code_version<>new.code_version
    or r.scheduled_start<>new.scheduled_start or r.slate_date<>new.slate_date or not exists (
      select from forge_pregame_capture.hosted_games g where g.game_id=r.game_id and g.state='started'
      and g.dispatch_id::text=current_setting('forge_pregame.dispatch_id',true) and clock_timestamp()<least(r.close_at,g.stale_at))
    then raise exception 'hosted_claim_refused'; end if;
  update forge_pregame_capture.hosted_runs set claim_id=new.id where game_id=r.game_id;
  return new;
end $$;
create trigger bind_hosted_claim after insert on forge_pregame_capture.claims
  for each row execute function forge_pregame_capture.bind_hosted_claim_v2();

create function public.forge_pregame_hosted_claim_v2(p_dispatch_id uuid,p_game_id bigint,p_policy_id text,p_slate_date date,
  p_home_team_id smallint,p_away_team_id smallint,p_calendar_revision text,p_scheduled_start timestamptz,p_required_ms integer,p_code_version text)
returns table(outcome text,claim_id uuid,ack_deadline timestamptz,db_now timestamptz,input_cutoff timestamptz)
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
begin
  if not exists(select from forge_pregame_capture.hosted_games g join forge_pregame_capture.hosted_runs r using(game_id)
    where g.dispatch_id=p_dispatch_id and r.game_id=p_game_id and r.phase='capture' and g.state='started') then
    raise exception 'hosted_claim_refused'; end if;
  perform set_config('forge_pregame.dispatch_id',p_dispatch_id::text,true);
  return query select * from public.forge_pregame_capture_claim_v1(p_game_id,p_policy_id,p_slate_date,p_home_team_id,p_away_team_id,
    p_calendar_revision,p_scheduled_start,p_required_ms,p_code_version);
end $$;

revoke all on function forge_pregame_capture.hosted_arm_v2(bigint),forge_pregame_capture.bind_hosted_claim_v2(),
  forge_pregame_capture.hosted_queue_v2(forge_pregame_capture.hosted_runs,text),forge_pregame_capture.hosted_end_v2(bigint,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.forge_pregame_hosted_begin_v2(uuid,text,boolean,bigint),
  public.forge_pregame_hosted_claim_v2(uuid,bigint,text,date,smallint,smallint,text,timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.forge_pregame_hosted_begin_v2(uuid,text,boolean,bigint),
  public.forge_pregame_hosted_claim_v2(uuid,bigint,text,date,smallint,smallint,text,timestamptz,integer,text) to service_role;
commit;
