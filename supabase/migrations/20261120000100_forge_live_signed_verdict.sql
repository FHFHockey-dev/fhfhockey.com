-- Live FORGE pregame run, signed-verdict gate (Track A). Additive over 20261119230000; nothing else changes.
-- The authoritative witness gate is the Ed25519-signed verdict verified in release code against the pinned keys
-- (signedVerdict.ts). The database cannot verify signatures; here it only requires that a structurally accepted signed
-- verdict exists for the exact claim and its three stored hashes, and it no longer consults the unsigned verdict
-- (forge_witness.publication_gate_v1 / require_accepted_v1), so a game never mixes the two. Apply as postgres AFTER
-- forge-witness-signed.sql. Rollback: rollback-20261120000100.sql in tasks/artifacts/forge-live-release-2026-11-19.
begin;
set local lock_timeout = '5s';

do $$ begin
  if to_regprocedure('forge_witness.signed_verdict_v1(uuid)') is null then raise exception 'signed_witness_missing'; end if;
  if to_regprocedure('public.forge_live_publish_begin_v1(text)') is null then raise exception 'live_run_missing'; end if;
end $$;

-- Structural view of the stored signed verdict for one claim (signature NOT checked here; the release checks it).
create function forge_pregame_capture.live_signed_gate_v1(p_claim uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c forge_pregame_capture.claims; a forge_pregame_capture.artifacts; w forge_pregame_capture.witnesses;
  sv jsonb; p jsonb; deadline timestamptz; why text;
begin
  select * into c from forge_pregame_capture.claims where id = p_claim;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'claim_missing'); end if;
  deadline := c.scheduled_start - interval '60 minutes';
  select * into a from forge_pregame_capture.artifacts where claim_id = p_claim;
  select * into w from forge_pregame_capture.witnesses where claim_id = p_claim;
  sv := forge_witness.signed_verdict_v1(p_claim);
  begin
    p := (sv->>'payload')::jsonb;
  exception when others then p := null;
  end;
  why := case
    when sv is null then 'signed_verdict_missing'
    when p is null then 'payload_invalid'
    when p->>'verdict' is distinct from 'accepted' then 'verdict_rejected'
    when p->>'claimId' is distinct from p_claim::text or (p->>'gameId')::bigint is distinct from c.game_id
      or p->>'rawSha256' is distinct from a.raw_sha256 or p->>'canonicalSha256' is distinct from a.canonical_sha256
      or p->>'tsaTokenSha256' is distinct from w.tsa_token_sha256 then 'binding_mismatch'
    when (p->>'officialStart')::timestamptz is distinct from c.scheduled_start then 'official_start_mismatch'
    when (p->>'deadline')::timestamptz is distinct from deadline then 'deadline_mismatch'
    when (p->>'verifiedAt')::timestamptz > deadline then 'verified_late'
  end;
  return jsonb_build_object('accepted', why is null, 'reason', why, 'deadline', deadline, 'keyId', sv->>'keyId',
    'verifiedAt', p->>'verifiedAt', 'signatureChecked', false);
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
  return jsonb_build_object('accepted', false, 'reason', 'payload_invalid', 'deadline', deadline, 'signatureChecked', false);
end $$;
revoke all on function forge_pregame_capture.live_signed_gate_v1(uuid) from public, anon, authenticated, service_role;

-- The claim's custody hashes for the release's signed-verdict check (the signed row itself is read through
-- forge_witness_api.signed_verdict_v1). Read-only; service_role only.
create function public.forge_live_claim_hashes_v1(p_claim uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('claimId', c.id, 'gameId', c.game_id, 'scheduledStart', c.scheduled_start,
    'raw', a.raw_sha256, 'canonical', a.canonical_sha256, 'tsaTokenSha256', w.tsa_token_sha256)
  from forge_pregame_capture.claims c
  join forge_pregame_capture.artifacts a on a.claim_id = c.id
  join forge_pregame_capture.witnesses w on w.claim_id = c.id
  where c.id = p_claim
$$;
revoke all on function public.forge_live_claim_hashes_v1(uuid) from public, anon, authenticated;
grant execute on function public.forge_live_claim_hashes_v1(uuid) to service_role;

create or replace function forge_pregame_capture.live_receipt_v1(p_game bigint) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('gameId', r.game_id, 'release', r.expected_code_version, 'scheduledStart', r.scheduled_start,
    'playerNhlId', r.player_nhl_id, 'approvedBy', r.approved_by, 'armedAt', r.armed_at, 'stoppedAt', r.stopped_at,
    'stopReason', r.stop_reason, 'captureBeganAt', r.capture_began_at, 'captureFinishedAt', r.capture_finished_at,
    'claim', r.claim_id, 'custody', o.outcome, 'witness', w.verdict, 'packetSha256', a.raw_sha256,
    'canonicalSha256', a.canonical_sha256, 'tokenSha256', w.tsa_token_sha256,
    'verdict', case when a.claim_id is not null and w.claim_id is not null
      then forge_pregame_capture.live_signed_gate_v1(r.claim_id) end,
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
  -- The independent verifier's SIGNED verdict owns the decision; the release verifies its signature. This only asks
  -- whether a structurally accepted signed verdict for the exact claim and all three stored hashes exists yet.
  gate := forge_pregame_capture.live_signed_gate_v1(r.claim_id);
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
  if (forge_pregame_capture.live_signed_gate_v1(new.claim_id)->>'accepted')::boolean is not true
    or new.raw_sha256 is distinct from (select a.raw_sha256 from forge_pregame_capture.artifacts a where a.claim_id = new.claim_id)
    or new.canonical_sha256 is distinct from (select a.canonical_sha256 from forge_pregame_capture.artifacts a where a.claim_id = new.claim_id)
  then raise exception 'witness_verdict_required' using errcode = '42501'; end if;
  return new;
end $$;

revoke all on function forge_pregame_capture.live_receipt_v1(bigint), forge_pregame_capture.require_live_verdict_v1()
  from public, anon, authenticated, service_role;
revoke all on function public.forge_live_publish_begin_v1(text) from public, anon, authenticated;
grant execute on function public.forge_live_publish_begin_v1(text) to service_role;
commit;
notify pgrst, 'reload schema';
