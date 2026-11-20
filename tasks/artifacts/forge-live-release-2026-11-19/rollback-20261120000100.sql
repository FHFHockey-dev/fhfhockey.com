-- Roll back 20261120000100_forge_live_signed_verdict.sql: restore the 20261119230000 definitions of the publish begin
-- RPC, the publication trigger function and the receipt (unsigned verifier gate), and drop the two new functions.
-- Refuses while a live run is open. Run as postgres.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
do $$ begin
  if exists (select from forge_pregame_capture.live_runs where terminal_at is null) then raise exception 'live_run_open'; end if;
end $$;
create or replace function forge_pregame_capture.live_receipt_v1(p_game bigint) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('gameId', r.game_id, 'release', r.expected_code_version, 'scheduledStart', r.scheduled_start,
    'playerNhlId', r.player_nhl_id, 'approvedBy', r.approved_by, 'armedAt', r.armed_at, 'stoppedAt', r.stopped_at,
    'stopReason', r.stop_reason, 'captureBeganAt', r.capture_began_at, 'captureFinishedAt', r.capture_finished_at,
    'claim', r.claim_id, 'custody', o.outcome, 'witness', w.verdict, 'packetSha256', a.raw_sha256,
    'canonicalSha256', a.canonical_sha256, 'tokenSha256', w.tsa_token_sha256,
    'verdict', case when a.claim_id is not null and w.claim_id is not null
      then forge_witness.publication_gate_v1(r.claim_id, a.raw_sha256, a.canonical_sha256, w.tsa_token_sha256) end,
    'publishBeganAt', r.publish_began_at, 'publishFinishedAt', r.publish_finished_at, 'revisionId', r.revision_id,
    'committedRevision', p.revision_id, 'readers', r.readers, 'outcome', r.outcome, 'reason', r.reason, 'terminalAt', r.terminal_at,
    'requests', (select jsonb_agg(to_jsonb(q) order by q.fired_at) from forge_pregame_capture.live_requests q where q.game_id = r.game_id))
  from forge_pregame_capture.live_runs r
  left join forge_pregame_capture.outcomes o on o.claim_id = r.claim_id
  left join forge_pregame_capture.artifacts a on a.claim_id = r.claim_id
  left join forge_pregame_capture.witnesses w on w.claim_id = r.claim_id
  left join forge_pregame_capture.publications p on p.claim_id = r.claim_id
  where r.game_id = p_game
$$;

create or replace function public.forge_live_publish_begin_v1(p_code_version text) returns jsonb
language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare r forge_pregame_capture.live_runs; season bigint; gate jsonb;
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
  -- The independent verifier owns the verdict; this asks its gate for the exact claim and all three stored hashes.
  select forge_witness.publication_gate_v1(r.claim_id, a.raw_sha256, a.canonical_sha256, w.tsa_token_sha256) into gate
    from forge_pregame_capture.artifacts a join forge_pregame_capture.witnesses w on w.claim_id = a.claim_id
    where a.claim_id = r.claim_id;
  if gate is null or (gate->>'accepted')::boolean is not true then
    if gate is null or clock_timestamp() >= coalesce((gate->>'deadline')::timestamptz, r.scheduled_start - interval '60 minutes') then
      perform forge_pregame_capture.live_end_v1(r.game_id, 'failed', 'independent_' || coalesce(gate->>'reason', 'deadline_missed'));
      return jsonb_build_object('status', 'independent_deadline_missed', 'gate', gate);
    end if;
    return jsonb_build_object('status', 'awaiting_verdict', 'gate', gate);
  end if;
  select g."seasonId" into season from public.games g where g.id = r.game_id;
  update forge_pregame_capture.live_runs set publish_began_at = clock_timestamp() where game_id = r.game_id;
  return jsonb_build_object('status', 'started', 'gameId', r.game_id, 'claimId', r.claim_id, 'slateDate', r.slate_date,
    'scheduledStart', r.scheduled_start, 'seasonId', season, 'playerNhlId', r.player_nhl_id);
end $$;

create or replace function forge_pregame_capture.require_live_verdict_v1() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r forge_pregame_capture.live_runs;
begin
  select l.* into r from forge_pregame_capture.live_runs l join forge_pregame_capture.claims c on c.game_id = l.game_id
    where c.id = new.claim_id for share of l;
  if not found then return new; end if;
  if r.claim_id is distinct from new.claim_id or r.publish_began_at is null or r.terminal_at is not null or r.stopped_at is not null
    or r.expected_code_version is distinct from new.code_version or clock_timestamp() >= r.scheduled_start
  then raise exception 'live_publication_gate' using errcode = '22023'; end if;
  perform forge_witness.require_accepted_v1(new.claim_id, new.raw_sha256, new.canonical_sha256,
    (select w.tsa_token_sha256 from forge_pregame_capture.witnesses w where w.claim_id = new.claim_id));
  return new;
end $$;

drop function if exists public.forge_live_claim_hashes_v1(uuid);
drop function if exists forge_pregame_capture.live_signed_gate_v1(uuid);
commit;
notify pgrst, 'reload schema';
