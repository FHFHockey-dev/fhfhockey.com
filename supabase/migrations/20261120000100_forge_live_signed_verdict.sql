-- Live FORGE pregame run: read one claim's custody hashes together with the independent verifier's signed verdict, so
-- the release code (publish route, both RSO readers, acceptance audit) verifies the Ed25519 signature itself against the
-- pinned keys. Read-only; service_role only. The verifier package (Track A) provides forge_witness.signed_verdict_v1;
-- this function binds to it at call time, so it may be applied before that package. Additive: nothing existing changes.
begin;
set local lock_timeout = '5s';

create function public.forge_live_signed_verdict_v1(p_claim uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; signed jsonb;
begin
  select jsonb_build_object('claimId', c.id, 'gameId', c.game_id, 'scheduledStart', c.scheduled_start,
    'raw', a.raw_sha256, 'canonical', a.canonical_sha256, 'tsaTokenSha256', w.tsa_token_sha256)
  into r
  from forge_pregame_capture.claims c
  join forge_pregame_capture.artifacts a on a.claim_id = c.id
  join forge_pregame_capture.witnesses w on w.claim_id = c.id
  where c.id = p_claim;
  if r is null then return null; end if;
  begin
    signed := to_jsonb(forge_witness.signed_verdict_v1(p_claim));
  exception when undefined_function or invalid_schema_name or insufficient_privilege then
    signed := null;   -- no verifier package (or no grant): the release code then fails closed
  end;
  return r || jsonb_build_object('signedVerdict', signed);
end $$;

revoke all on function public.forge_live_signed_verdict_v1(uuid) from public, anon, authenticated;
grant execute on function public.forge_live_signed_verdict_v1(uuid) to service_role;
commit;
notify pgrst, 'reload schema';
