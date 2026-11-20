-- FORGE independent witness, Track A: signed verdicts. Applies on top of forge-witness-verifier.sql (sha256 9673316c…),
-- as postgres. Creates no role and changes no existing object's behaviour.
--
-- Trust model. The FORGE writer can reach postgres and the JWT secret, so nothing the database holds is trusted: rows
-- here are tamper-EVIDENT, not tamper-proof. A verdict counts only if its Ed25519 signature verifies under a public key
-- pinned in the release source (web/lib/projections/pregameCapture/witnessSigningKeys.ts); the private key exists only
-- as the Edge secret of forge-witness-verify. These tables and functions just carry (payload, signature) between the
-- Edge Function and the release-side gate and audit. The immutability triggers stop accidents, not postgres.
--
-- Access: the Edge Function calls forge_witness_api.signed_pending_v1 / signed_evidence_v1 / record_signed_v1 with this
-- project's service role (Data API, schema forge_witness_api). The publish route and readers read a verdict with
-- forge_witness.signed_verdict_v1(claim) as service_role.
begin;
set local lock_timeout = '5s';
do $guard$ begin
  if to_regclass('forge_witness.verdicts') is null or to_regclass('forge_witness.targets') is null
    or to_regprocedure('forge_witness.evidence_v1(bigint)') is null then
    raise exception 'forge-witness-verifier.sql must be installed first';
  end if;
  if to_regclass('forge_witness.signed_verdicts') is not null then raise exception 'signed verdicts already installed'; end if;
end $guard$;
grant forge_witness_owner to current_user;
set local role forge_witness_owner;

create table forge_witness.signed_verdicts (
  claim_id uuid primary key,
  game_id bigint not null check (game_id > 0),
  policy_id text not null default 'pregame-native-v1' check (policy_id = 'pregame-native-v1'),
  -- The exact canonical JSON the signature covers (web/lib/projections/pregameCapture/signedVerdict.ts).
  payload text not null check (octet_length(payload) <= 8192),
  signature text not null check (signature ~ '^[A-Za-z0-9+/]{86}==$'),
  key_id text not null check (key_id ~ '^[0-9a-f]{16}$'),
  recorded_at timestamptz not null default clock_timestamp(),
  constraint signed_verdicts_one_per_game unique (game_id, policy_id)
);
alter table forge_witness.signed_verdicts enable row level security;
create trigger signed_verdicts_immutable before update or delete on forge_witness.signed_verdicts
  for each row execute function forge_witness.reject_mutation();
create trigger signed_verdicts_no_truncate before truncate on forge_witness.signed_verdicts
  for each statement execute function forge_witness.reject_mutation();
alter table forge_witness.signed_verdicts enable always trigger signed_verdicts_immutable;
alter table forge_witness.signed_verdicts enable always trigger signed_verdicts_no_truncate;

-- Armed games (forge_witness.targets, from arm) without a signed verdict, oldest first, from the last 2 days.
create function forge_witness_api.signed_pending_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(p.game_id order by p.armed_at), '[]'::jsonb) from (
    select t.game_id, t.armed_at from forge_witness.targets t
    where not exists (select from forge_witness.signed_verdicts s where s.game_id = t.game_id and s.policy_id = t.policy_id)
      and t.armed_at > clock_timestamp() - interval '2 days'
    order by t.armed_at limit 16) p
$$;

-- The committed evidence for an armed game (forge_witness.evidence_v1), or 'decided' once a signed verdict exists. The
-- Edge Function ignores the evidence's database schedule and uses the NHL's.
create function forge_witness_api.signed_evidence_v1(p_game_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s forge_witness.signed_verdicts;
begin
  select * into s from forge_witness.signed_verdicts where game_id = p_game_id and policy_id = 'pregame-native-v1';
  if found then return pg_catalog.jsonb_build_object('status', 'decided', 'gameId', p_game_id, 'claimId', s.claim_id); end if;
  return forge_witness.evidence_v1(p_game_id);
end $$;

-- Stores one signed verdict per armed game. It checks only shape and that the payload names an armed game's claim; the
-- signature is verified by the release, never here. A second call for the game returns created: false.
create function forge_witness_api.record_signed_v1(p_payload text, p_signature text)
returns jsonb language plpgsql volatile security definer set search_path = '' set lock_timeout = '5s' as $$
declare p jsonb; game bigint; claim uuid; stored forge_witness.signed_verdicts;
begin
  begin
    p := p_payload::jsonb;
    game := (p->>'gameId')::bigint;
    claim := (p->>'claimId')::uuid;
  exception when others then
    raise exception 'witness_signed_payload' using errcode = '22023';
  end;
  if p->>'version' is distinct from 'forge-witness-signed-verdict-v1' or coalesce(p->>'keyId', '') !~ '^[0-9a-f]{16}$'
    or p->>'policyId' is distinct from 'pregame-native-v1' or coalesce(p->>'verdict', '') not in ('accepted', 'rejected') then
    raise exception 'witness_signed_payload' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('forge_witness_signed'), pg_catalog.hashtext(game::text));
  if not exists (select from forge_witness.targets t where t.game_id = game and t.policy_id = 'pregame-native-v1') then
    raise exception 'witness_target_not_armed' using errcode = '42501';
  end if;
  if not exists (select from forge_pregame_capture.claims c where c.id = claim and c.game_id = game and c.policy_id = 'pregame-native-v1') then
    raise exception 'witness_claim_binding' using errcode = '22023';
  end if;
  insert into forge_witness.signed_verdicts (claim_id, game_id, payload, signature, key_id)
    values (claim, game, p_payload, p_signature, p->>'keyId')
    on conflict do nothing returning * into stored;
  if found then
    return pg_catalog.jsonb_build_object('created', true, 'claimId', stored.claim_id, 'recordedAt', stored.recorded_at);
  end if;
  select * into stored from forge_witness.signed_verdicts where game_id = game and policy_id = 'pregame-native-v1';
  return pg_catalog.jsonb_build_object('created', false, 'claimId', stored.claim_id, 'recordedAt', stored.recorded_at);
end $$;

-- For the publish route, the readers and the audit: the stored (payload, signature) for one claim, or null.
create function forge_witness.signed_verdict_v1(p_claim_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object('claimId', s.claim_id, 'gameId', s.game_id, 'payload', s.payload, 'signature', s.signature,
    'keyId', s.key_id, 'recordedAt', s.recorded_at)
  from forge_witness.signed_verdicts s where s.claim_id = p_claim_id
$$;

-- Installer only (cron fire function and readback): has this game a signed verdict?
create function forge_witness.signed_status_v1(p_game_id bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object('gameId', p_game_id, 'armed', exists (select from forge_witness.targets t where t.game_id = p_game_id),
    'signed', s.claim_id is not null, 'claimId', s.claim_id, 'keyId', s.key_id, 'recordedAt', s.recorded_at)
  from (select 1) one left join forge_witness.signed_verdicts s on s.game_id = p_game_id and s.policy_id = 'pregame-native-v1'
$$;

reset role;
revoke all on forge_witness.signed_verdicts from public, anon, authenticated, service_role, forge_witness_api;
revoke all on function forge_witness_api.signed_pending_v1(), forge_witness_api.signed_evidence_v1(bigint),
  forge_witness_api.record_signed_v1(text, text), forge_witness.signed_verdict_v1(uuid), forge_witness.signed_status_v1(bigint)
  from public, anon, authenticated, service_role, forge_witness_api;
grant usage on schema forge_witness_api to service_role;
grant execute on function forge_witness_api.signed_pending_v1(), forge_witness_api.signed_evidence_v1(bigint),
  forge_witness_api.record_signed_v1(text, text), forge_witness.signed_verdict_v1(uuid) to service_role;
do $installer$ begin
  execute format('grant execute on function forge_witness.signed_verdict_v1(uuid), forge_witness.signed_status_v1(bigint) to %I', session_user);
end $installer$;
revoke forge_witness_owner from current_user;
commit;
notify pgrst, 'reload schema';
