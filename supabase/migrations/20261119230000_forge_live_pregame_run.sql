-- One approved, game-scoped live FORGE pregame run: capture → independent verdict → one publication → both RSO readers.
-- Requires 20261115000000 (custody), 20261117215012 (hosted dispatch; hosted_schedule) and 20261118135813 (publication).
-- Nothing is approved or armed here. The operator inserts one approval row, arms it, and registers the two one-shot
-- cron jobs (operator SQL in tasks/artifacts/forge-live-release-2026-11-19/). Every gate below is enforced in the
-- database, so a stopped or dead operator machine leaves the run refused, never half-published.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table forge_pregame_capture.live_runs (
  game_id bigint primary key references public.games(id),
  policy_id text not null default 'pregame-native-v1' check (policy_id = 'pregame-native-v1'),
  expected_code_version text not null check (expected_code_version ~ '^[a-f0-9]{40}$'),
  slate_date date not null,
  scheduled_start timestamptz not null,
  player_nhl_id bigint not null check (player_nhl_id > 0),
  approved_by text not null check (length(btrim(approved_by)) > 0),
  approved_at timestamptz not null default clock_timestamp(),
  armed_at timestamptz,
  stopped_at timestamptz,
  stop_reason text,
  capture_began_at timestamptz,
  capture_finished_at timestamptz,
  claim_id uuid unique references forge_pregame_capture.claims(id),
  capture_outcome text,
  capture_reason text,
  publish_began_at timestamptz,
  publish_finished_at timestamptz,
  revision_id uuid,
  readers jsonb check (readers is null or octet_length(readers::text) <= 4000),
  outcome text check (outcome in ('succeeded', 'failed', 'unresolved', 'stopped')),
  reason text,
  terminal_at timestamptz,
  check ((outcome is null) = (terminal_at is null))
);
alter table forge_pregame_capture.live_runs enable row level security;
revoke all on forge_pregame_capture.live_runs from public, anon, authenticated, service_role;

-- The interface to the independent verifier (a separate role and route, provisioned elsewhere). Only that role may insert;
-- rows are immutable. Publication of a live run requires an accepted row here, verified by T−60, with matching hashes.
create table forge_pregame_capture.live_verdicts (
  claim_id uuid primary key references forge_pregame_capture.claims(id),
  game_id bigint not null references forge_pregame_capture.live_runs(game_id),
  verdict text not null check (verdict in ('accepted', 'rejected')),
  reason text,
  raw_sha256 text not null check (raw_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_sha256 text not null check (canonical_sha256 ~ '^[0-9a-f]{64}$'),
  verifier_role name not null default session_user,
  verified_at timestamptz not null default clock_timestamp(),
  check ((verdict = 'accepted') = (reason is null))
);
alter table forge_pregame_capture.live_verdicts enable row level security;
revoke all on forge_pregame_capture.live_verdicts from public, anon, authenticated, service_role;
create trigger live_verdicts_immutable before update or delete on forge_pregame_capture.live_verdicts
  for each row execute function forge_pregame_capture.reject_mutation();
create trigger live_verdicts_no_truncate before truncate on forge_pregame_capture.live_verdicts
  for each statement execute function forge_pregame_capture.reject_mutation();

-- Each cron stage fires at most once; the request id is the cron → pg_net → HTTP link for the receipt.
create table forge_pregame_capture.live_requests (
  game_id bigint not null references forge_pregame_capture.live_runs(game_id),
  stage text not null check (stage in ('capture', 'publish')),
  jobid bigint,
  request_id bigint not null,
  fired_at timestamptz not null default clock_timestamp(),
  primary key (game_id, stage)
);
alter table forge_pregame_capture.live_requests enable row level security;
revoke all on forge_pregame_capture.live_requests from public, anon, authenticated, service_role;

create function forge_pregame_capture.live_receipt_v1(p_game bigint) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('gameId', r.game_id, 'release', r.expected_code_version, 'scheduledStart', r.scheduled_start,
    'playerNhlId', r.player_nhl_id, 'approvedBy', r.approved_by, 'armedAt', r.armed_at, 'stoppedAt', r.stopped_at,
    'stopReason', r.stop_reason, 'captureBeganAt', r.capture_began_at, 'captureFinishedAt', r.capture_finished_at,
    'claim', r.claim_id, 'custody', o.outcome, 'witness', w.verdict, 'packetSha256', a.raw_sha256,
    'canonicalSha256', a.canonical_sha256, 'tokenSha256', w.tsa_token_sha256, 'verdict', to_jsonb(v),
    'publishBeganAt', r.publish_began_at, 'publishFinishedAt', r.publish_finished_at, 'revisionId', r.revision_id,
    'committedRevision', p.revision_id, 'readers', r.readers, 'outcome', r.outcome, 'reason', r.reason, 'terminalAt', r.terminal_at,
    'requests', (select jsonb_agg(to_jsonb(q) order by q.fired_at) from forge_pregame_capture.live_requests q where q.game_id = r.game_id))
  from forge_pregame_capture.live_runs r
  left join forge_pregame_capture.outcomes o on o.claim_id = r.claim_id
  left join forge_pregame_capture.artifacts a on a.claim_id = r.claim_id
  left join forge_pregame_capture.witnesses w on w.claim_id = r.claim_id
  left join forge_pregame_capture.live_verdicts v on v.claim_id = r.claim_id
  left join forge_pregame_capture.publications p on p.claim_id = r.claim_id
  where r.game_id = p_game
$$;

-- Terminal state and self-disarm: removes this game's cron jobs. Idempotent.
create function forge_pregame_capture.live_end_v1(p_game bigint, p_outcome text, p_reason text) returns jsonb
language plpgsql set search_path = '' as $$
declare job record;
begin
  update forge_pregame_capture.live_runs set outcome = p_outcome, reason = p_reason, terminal_at = clock_timestamp()
    where game_id = p_game and terminal_at is null;
  for job in select jobid from cron.job where jobname in (format('forge-live-capture-%s', p_game), format('forge-live-publish-%s', p_game),
      format('forge-live-close-%s', p_game)) loop
    perform cron.unschedule(job.jobid);
  end loop;
  return forge_pregame_capture.live_receipt_v1(p_game);
end $$;

-- Operator controls (owner only).
create function forge_pregame_capture.live_arm_v1(p_game bigint) returns jsonb
language plpgsql set search_path = '' as $$
declare r forge_pregame_capture.live_runs; s record;
begin
  select * into r from forge_pregame_capture.live_runs where game_id = p_game for update;
  if not found or r.armed_at is not null or r.terminal_at is not null then raise exception 'live_run_not_armable'; end if;
  select * into s from forge_pregame_capture.hosted_schedule(p_game);
  if s.schedule_state is distinct from 'ready' or s.scheduled_start is distinct from r.scheduled_start
    or s.safe_start is distinct from r.scheduled_start or s.slate_date is distinct from r.slate_date then raise exception 'live_schedule_mismatch'; end if;
  if exists (select from forge_pregame_capture.claims where game_id = p_game and policy_id = r.policy_id)
    or exists (select from forge_pregame_capture.outcomes where game_id = p_game and policy_id = r.policy_id) then
    raise exception 'live_custody_exists'; end if;
  if clock_timestamp() >= r.scheduled_start - interval '64 minutes' then raise exception 'live_capture_window_closed'; end if;
  update forge_pregame_capture.live_runs set armed_at = clock_timestamp() where game_id = p_game;
  return forge_pregame_capture.live_receipt_v1(p_game);
end $$;

create function forge_pregame_capture.live_stop_v1(p_game bigint, p_reason text) returns jsonb
language plpgsql set search_path = '' as $$
begin
  update forge_pregame_capture.live_runs set stopped_at = coalesce(stopped_at, clock_timestamp()),
    stop_reason = coalesce(stop_reason, p_reason) where game_id = p_game;
  return forge_pregame_capture.live_end_v1(p_game, 'stopped', coalesce(p_reason, 'operator_stop'));
end $$;

-- After puck drop, close whatever is left: a run that never finished is recorded as unresolved, never retried.
create function forge_pregame_capture.live_close_v1(p_game bigint) returns jsonb
language plpgsql set search_path = '' as $$
declare r forge_pregame_capture.live_runs;
begin
  select * into r from forge_pregame_capture.live_runs where game_id = p_game for update;
  if not found then return null; end if;
  if r.terminal_at is null and clock_timestamp() >= r.scheduled_start then
    return forge_pregame_capture.live_end_v1(p_game, 'unresolved', case when r.claim_id is null then 'capture_missing'
      when r.publish_began_at is null then 'publication_not_started' else 'publication_unconfirmed' end);
  end if;
  return forge_pregame_capture.live_end_v1(p_game, coalesce(r.outcome, 'unresolved'), coalesce(r.reason, 'closed'));
end $$;

-- Cron command: one pg_net GET per stage, in WGO's shape (Vault cron_secret as Bearer). Refuses when stopped,
-- terminal, unarmed or outside the stage window; fires once; unschedules its own job either way.
create function forge_pregame_capture.live_fire_v1(p_game bigint, p_stage text) returns text
language plpgsql set search_path = '' as $$
declare r forge_pregame_capture.live_runs; job bigint; request bigint; refused text;
begin
  perform pg_advisory_xact_lock(hashtext('forge_live_fire'), p_game::integer);
  select jobid into job from cron.job where jobname = format('forge-live-%s-%s', p_stage, p_game);
  select * into r from forge_pregame_capture.live_runs where game_id = p_game for update;
  refused := case
    when not found or r.armed_at is null then 'unarmed'
    when r.stopped_at is not null or r.terminal_at is not null then 'stopped'
    when exists (select from forge_pregame_capture.live_requests where game_id = p_game and stage = p_stage) then 'already_fired'
    when p_stage = 'capture' and clock_timestamp() >= r.scheduled_start - interval '66 minutes' then 'capture_window_closed'
    when p_stage = 'publish' and (r.claim_id is null or clock_timestamp() >= r.scheduled_start - interval '2 minutes') then 'publish_window_closed'
    when p_stage not in ('capture', 'publish') then 'invalid_stage' end;
  if refused is null then
    request := net.http_get(url := format('https://fhfhockey.com/api/v1/db/forge-live-%s', p_stage),
      headers := ('{}'::jsonb || jsonb_build_object('Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))),
      timeout_milliseconds := 240000);
    insert into forge_pregame_capture.live_requests (game_id, stage, jobid, request_id) values (p_game, p_stage, job, request);
  end if;
  if job is not null then perform cron.unschedule(job); end if;
  return coalesce(refused, 'fired ' || request);
end $$;

-- Route RPCs (service_role). The deployment's commit must equal the approved release at every stage.
create function public.forge_live_capture_begin_v1(p_code_version text) returns jsonb
language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare r forge_pregame_capture.live_runs; s record; season bigint;
begin
  select * into r from forge_pregame_capture.live_runs where armed_at is not null and terminal_at is null
    and capture_began_at is null order by scheduled_start limit 1 for update;
  if not found then
    return jsonb_build_object('status', 'none_armed');
  end if;
  if r.expected_code_version is distinct from p_code_version then return jsonb_build_object('status', 'release_mismatch'); end if;
  if r.stopped_at is not null then return jsonb_build_object('status', 'stopped'); end if;
  if clock_timestamp() >= r.scheduled_start - interval '64 minutes' then
    perform forge_pregame_capture.live_end_v1(r.game_id, 'failed', 'capture_window_closed');
    return jsonb_build_object('status', 'capture_window_closed');
  end if;
  select * into s from forge_pregame_capture.hosted_schedule(r.game_id);
  if s.schedule_state is distinct from 'ready' or s.scheduled_start is distinct from r.scheduled_start or s.safe_start is distinct from r.scheduled_start then
    perform forge_pregame_capture.live_end_v1(r.game_id, 'failed', 'schedule_changed');
    return jsonb_build_object('status', 'schedule_changed');
  end if;
  select g."seasonId" into season from public.games g where g.id = r.game_id;
  update forge_pregame_capture.live_runs set capture_began_at = clock_timestamp() where game_id = r.game_id;
  return jsonb_build_object('status', 'started', 'gameId', r.game_id, 'slateDate', r.slate_date, 'scheduledStart', r.scheduled_start,
    'seasonId', season, 'playerNhlId', r.player_nhl_id);
end $$;

-- The custody tables decide the capture outcome; the application's report is checked against them.
create function public.forge_live_capture_finish_v1(p_game bigint, p_code_version text, p_claim_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare r forge_pregame_capture.live_runs; custody text;
begin
  select * into r from forge_pregame_capture.live_runs where game_id = p_game for update;
  if not found or r.expected_code_version is distinct from p_code_version or r.capture_began_at is null then raise exception 'live_run_missing'; end if;
  if r.capture_finished_at is not null then return forge_pregame_capture.live_receipt_v1(p_game); end if;
  select o.outcome into custody from forge_pregame_capture.outcomes o join forge_pregame_capture.claims c on c.id = o.claim_id
    where o.claim_id = p_claim_id and c.game_id = p_game and c.code_version = p_code_version;
  update forge_pregame_capture.live_runs set capture_finished_at = clock_timestamp(), claim_id = p_claim_id,
    capture_outcome = custody, capture_reason = p_reason where game_id = p_game;
  if custody is distinct from 'qualified' then
    return forge_pregame_capture.live_end_v1(p_game, case when custody is null then 'unresolved' else 'failed' end,
      coalesce(p_reason, custody, 'capture_unconfirmed'));
  end if;
  return forge_pregame_capture.live_receipt_v1(p_game);
end $$;

create function public.forge_live_publish_begin_v1(p_code_version text) returns jsonb
language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare r forge_pregame_capture.live_runs; season bigint;
begin
  select * into r from forge_pregame_capture.live_runs where armed_at is not null and terminal_at is null
    and capture_outcome = 'qualified' and publish_began_at is null order by scheduled_start limit 1 for update;
  if not found then return jsonb_build_object('status', 'none_ready'); end if;
  if r.expected_code_version is distinct from p_code_version then return jsonb_build_object('status', 'release_mismatch'); end if;
  if r.stopped_at is not null then return jsonb_build_object('status', 'stopped'); end if;
  if clock_timestamp() >= r.scheduled_start - interval '2 minutes' then
    perform forge_pregame_capture.live_end_v1(r.game_id, 'failed', 'publish_window_closed');
    return jsonb_build_object('status', 'publish_window_closed');
  end if;
  if not exists (select from forge_pregame_capture.live_verdicts v join forge_pregame_capture.artifacts a on a.claim_id = v.claim_id
      where v.claim_id = r.claim_id and v.game_id = r.game_id and v.verdict = 'accepted'
        and v.verified_at <= r.scheduled_start - interval '60 minutes'
        and v.raw_sha256 = a.raw_sha256 and v.canonical_sha256 = a.canonical_sha256) then
    if exists (select from forge_pregame_capture.live_verdicts where claim_id = r.claim_id and verdict = 'rejected') then
      perform forge_pregame_capture.live_end_v1(r.game_id, 'failed', 'witness_rejected');
      return jsonb_build_object('status', 'witness_rejected');
    end if;
    if clock_timestamp() >= r.scheduled_start - interval '60 minutes' then
      perform forge_pregame_capture.live_end_v1(r.game_id, 'failed', 'independent_deadline_missed');
      return jsonb_build_object('status', 'independent_deadline_missed');
    end if;
    return jsonb_build_object('status', 'awaiting_verdict');
  end if;
  select g."seasonId" into season from public.games g where g.id = r.game_id;
  update forge_pregame_capture.live_runs set publish_began_at = clock_timestamp() where game_id = r.game_id;
  return jsonb_build_object('status', 'started', 'gameId', r.game_id, 'claimId', r.claim_id, 'slateDate', r.slate_date,
    'scheduledStart', r.scheduled_start, 'seasonId', season, 'playerNhlId', r.player_nhl_id);
end $$;

-- Success requires exactly one committed publication of this claim with the reported revision, and both readers bound
-- to that claim. A reader may legitimately withhold the player; it may not name a different run.
create function public.forge_live_publish_finish_v1(p_game bigint, p_code_version text, p_revision_id uuid, p_readers jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare r forge_pregame_capture.live_runs; why text := p_reason;
begin
  select * into r from forge_pregame_capture.live_runs where game_id = p_game for update;
  if not found or r.expected_code_version is distinct from p_code_version or r.publish_began_at is null then raise exception 'live_run_missing'; end if;
  if r.terminal_at is not null then return forge_pregame_capture.live_receipt_v1(p_game); end if;
  if p_readers is not null and (jsonb_typeof(p_readers) <> 'object' or octet_length(p_readers::text) > 4000) then raise exception 'invalid_reader_receipt'; end if;
  if why is null and not exists (select from forge_pregame_capture.publications p where p.claim_id = r.claim_id and p.revision_id = p_revision_id) then
    why := 'publication_not_committed'; end if;
  if why is null and (p_readers is null
      or p_readers->'daily'->>'selectedRun' is distinct from r.claim_id::text
      or p_readers->'detailed'->>'selectedRun' is distinct from r.claim_id::text
      or p_readers->'detailed'->>'revisionId' is distinct from p_revision_id::text
      or p_readers->'daily'->>'revisionId' is distinct from 'forge-daily-bridge-v1:' || r.claim_id::text) then
    why := 'reader_lineage_mismatch'; end if;
  update forge_pregame_capture.live_runs set publish_finished_at = clock_timestamp(), revision_id = p_revision_id, readers = p_readers
    where game_id = p_game;
  return forge_pregame_capture.live_end_v1(p_game, case when why is null then 'succeeded'
    when why in ('publication_unconfirmed', 'run_deadline') then 'unresolved' else 'failed' end, coalesce(why, 'readers_recorded'));
end $$;

-- Database fence on the owner's publisher: a live-run game publishes only inside its publish stage, from its own claim,
-- after an accepted verdict by T−60 with matching hashes, before puck drop. Other publications are unaffected.
create function forge_pregame_capture.require_live_verdict_v1() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r forge_pregame_capture.live_runs;
begin
  select l.* into r from forge_pregame_capture.live_runs l join forge_pregame_capture.claims c on c.game_id = l.game_id
    where c.id = new.claim_id for share of l;
  if not found then return new; end if;
  if r.claim_id is distinct from new.claim_id or r.publish_began_at is null or r.terminal_at is not null or r.stopped_at is not null
    or r.expected_code_version is distinct from new.code_version or clock_timestamp() >= r.scheduled_start
    or not exists (select from forge_pregame_capture.live_verdicts v where v.claim_id = new.claim_id and v.verdict = 'accepted'
      and v.verified_at <= r.scheduled_start - interval '60 minutes' and v.raw_sha256 = new.raw_sha256
      and v.canonical_sha256 = new.canonical_sha256)
  then raise exception 'live_publication_gate' using errcode = '22023'; end if;
  return new;
end $$;
create trigger require_live_verdict before insert on forge_pregame_capture.publications
  for each row execute function forge_pregame_capture.require_live_verdict_v1();

revoke all on function forge_pregame_capture.live_receipt_v1(bigint), forge_pregame_capture.live_end_v1(bigint, text, text),
  forge_pregame_capture.live_arm_v1(bigint), forge_pregame_capture.live_stop_v1(bigint, text), forge_pregame_capture.live_close_v1(bigint),
  forge_pregame_capture.live_fire_v1(bigint, text), forge_pregame_capture.require_live_verdict_v1() from public, anon, authenticated, service_role;
revoke all on function public.forge_live_capture_begin_v1(text), public.forge_live_capture_finish_v1(bigint, text, uuid, text),
  public.forge_live_publish_begin_v1(text), public.forge_live_publish_finish_v1(bigint, text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.forge_live_capture_begin_v1(text), public.forge_live_capture_finish_v1(bigint, text, uuid, text),
  public.forge_live_publish_begin_v1(text), public.forge_live_publish_finish_v1(bigint, text, uuid, jsonb, text) to service_role;
commit;
