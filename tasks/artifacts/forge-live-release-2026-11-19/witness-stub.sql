-- LOCAL REHEARSAL ONLY. Stand-in for the independent verifier's migration (refs/rc/forge-witness-verifier-20261119),
-- implementing only its agreed interface so the live run can be rehearsed before that ref lands. Never apply in production.
--   forge_witness.require_accepted_v1(claim, raw, canonical, token_sha): raises 'witness_verdict_required' (42501) unless accepted
--   forge_witness.publication_gate_v1(same) → jsonb {accepted, reason, verifiedAt, deadline}
-- Accepted means: exact claim and all three hashes, verified_at ≤ least(claimed start, current games.startTime) − 60 min.
create schema forge_witness;
create table forge_witness.stub_verdicts (
  claim_id uuid primary key, verdict text not null check (verdict in ('accepted', 'rejected')), reason text,
  raw_sha256 text not null, canonical_sha256 text not null, token_sha256 text not null,
  verified_at timestamptz not null default clock_timestamp()
);
create function forge_witness.publication_gate_v1(p_claim uuid, p_raw text, p_canonical text, p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with deadline as (
    select least(c.scheduled_start, g."startTime") - interval '60 minutes' as at from forge_pregame_capture.claims c
    join public.games g on g.id = c.game_id where c.id = p_claim)
  select jsonb_build_object(
    'accepted', coalesce(v.verdict = 'accepted' and v.raw_sha256 = p_raw and v.canonical_sha256 = p_canonical
      and v.token_sha256 = p_token and v.verified_at <= d.at, false),
    'reason', case when v.claim_id is null then 'no_verdict' when v.verdict = 'rejected' then coalesce(v.reason, 'rejected')
      when v.raw_sha256 <> p_raw or v.canonical_sha256 <> p_canonical or v.token_sha256 <> p_token then 'hash_mismatch'
      when v.verified_at > d.at then 'late' end,
    'verifiedAt', v.verified_at, 'deadline', d.at)
  from deadline d left join forge_witness.stub_verdicts v on v.claim_id = p_claim
$$;
create function forge_witness.require_accepted_v1(p_claim uuid, p_raw text, p_canonical text, p_token text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (forge_witness.publication_gate_v1(p_claim, p_raw, p_canonical, p_token)->>'accepted')::boolean is not true then
    raise exception 'witness_verdict_required' using errcode = '42501';
  end if;
end $$;
revoke all on function forge_witness.publication_gate_v1(uuid, text, text, text), forge_witness.require_accepted_v1(uuid, text, text, text) from public;
grant usage on schema forge_witness to service_role;
grant execute on function forge_witness.publication_gate_v1(uuid, text, text, text), forge_witness.require_accepted_v1(uuid, text, text, text) to service_role;
