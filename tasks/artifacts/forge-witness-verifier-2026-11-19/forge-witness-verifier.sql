-- FORGE independent verifier (automated witness) — receipts, narrow Data API surface and publisher gate.
-- Apply once as the project owner (postgres), after the custody migration. Then add forge_witness_api to the Data API
-- exposed schemas. Creates no LOGIN role, no password, no cron job and no target; it touches no existing object except
-- read grants on the five custody tables and GRANT forge_witness_api TO authenticator.
--
-- Roles
--   forge_witness_owner  NOLOGIN. Owns both schemas, the receipt tables and every definer below. Its only privileges
--                        outside them: USAGE on forge_pregame_capture and SELECT on its five custody tables. No members
--                        after installation (the installer's temporary membership is revoked at the end).
--   forge_witness_api    NOLOGIN, granted to authenticator so PostgREST can switch to it for a short-lived JWT with
--                        role=forge_witness_api. USAGE on forge_witness_api and EXECUTE on its three wrappers; nothing else.
-- Schemas
--   forge_witness        private: targets (armed games), verdicts (immutable receipts), the publisher gate, and
--                        credentials (the verifier's own Data API token; no grant to anyone, read only by the
--                        installer-run cron fire function through credential_v1, never stored in Vercel env or Vault).
--   forge_witness_api    exposed: pending_v1, evidence_v1, record_v1 (SECURITY DEFINER, owner-owned).
-- The writer (service_role, anon, authenticated, any FORGE API role) can neither create, alter nor write a verdict; it
-- may only EXECUTE the read-only gate. Rows are immutable (ALWAYS triggers); one verdict per claim and per game.
begin;
set local lock_timeout = '5s';

do $guard$ begin
  if exists (select from pg_catalog.pg_namespace where nspname in ('forge_witness', 'forge_witness_api'))
    or exists (select from pg_catalog.pg_roles where rolname in ('forge_witness_owner', 'forge_witness_api')) then
    raise exception 'forge_witness already installed (or a name is taken)';
  end if;
  if to_regclass('forge_pregame_capture.claims') is null or to_regclass('forge_pregame_capture.artifacts') is null
    or to_regclass('forge_pregame_capture.witnesses') is null or to_regclass('forge_pregame_capture.outcomes') is null
    or to_regclass('forge_pregame_capture.save_fences') is null then
    raise exception 'forge_pregame_capture custody tables are required';
  end if;
  if to_regclass('public.games') is null or to_regclass('public.teams') is null
    or to_regclass('public.roster_optimizer_team_games') is null then
    raise exception 'public schedule tables are required';
  end if;
  if not exists (select from pg_catalog.pg_roles where rolname = 'authenticator')
    or not exists (select from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'authenticator and service_role are required';
  end if;
end $guard$;

create role forge_witness_owner nologin noinherit nocreatedb nocreaterole noreplication nobypassrls;
create role forge_witness_api nologin noinherit nocreatedb nocreaterole noreplication nobypassrls;
alter role forge_witness_api set statement_timeout = '20s';
alter role forge_witness_api set timezone = 'UTC';
grant forge_witness_api to authenticator;
grant forge_witness_owner to current_user;

create schema forge_witness authorization forge_witness_owner;
create schema forge_witness_api authorization forge_witness_owner;
revoke all on schema forge_witness, forge_witness_api from public;

-- The owner's only privileges outside its own schemas: read the committed custody rows (no RLS on these tables).
grant usage on schema forge_pregame_capture to forge_witness_owner;
grant select on forge_pregame_capture.claims, forge_pregame_capture.artifacts, forge_pregame_capture.save_fences,
  forge_pregame_capture.witnesses, forge_pregame_capture.outcomes to forge_witness_owner;

-- public.games and public.roster_optimizer_team_games have RLS (the latter FORCE) with policies for anon/authenticated
-- only, so the owner cannot read them directly. This one helper, owned by the installer (who reads them today through
-- the custody read path), returns a single game's schedule facts and is executable only by forge_witness_owner.
-- A game the helper cannot see yields no row, and every caller fails closed on that.
create function forge_witness.schedule_v1(p_game_id bigint)
returns table (game_id bigint, game_date date, start_time timestamptz, home_team_id bigint, away_team_id bigint,
  home_abbrev text, away_abbrev text, team_statuses text[])
language sql stable security definer set search_path = '' as $$
  select g.id, g.date, g."startTime"::timestamptz, g."homeTeamId"::bigint, g."awayTeamId"::bigint,
    (select pg_catalog.btrim(t.abbreviation::text) from public.teams t where t.id = g."homeTeamId"),
    (select pg_catalog.btrim(t.abbreviation::text) from public.teams t where t.id = g."awayTeamId"),
    array(select t.team_abbreviation::text || ':' || t.game_status || ':' || t.schedule_status
      from public.roster_optimizer_team_games t where t.source_game_id = g.id order by t.team_abbreviation)
  from public.games g where g.id = p_game_id
$$;
revoke all on function forge_witness.schedule_v1(bigint) from public, anon, authenticated, service_role;
grant execute on function forge_witness.schedule_v1(bigint) to forge_witness_owner;

set local role forge_witness_owner;

create function forge_witness.reject_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'forge_witness rows are immutable' using errcode = '42501';
end $$;

-- Games the verifier may read and judge. Inserted only by forge_witness.arm_v1 (installer only).
create table forge_witness.targets (
  game_id bigint not null check (game_id > 0),
  policy_id text not null default 'pregame-native-v1' check (policy_id = 'pregame-native-v1'),
  armed_at timestamptz not null default clock_timestamp(),
  armed_by name not null default session_user,
  primary key (game_id, policy_id)
);

-- The verifier's own receipt. Hashes, cutoff, start and deadline are copied from the committed custody rows by the
-- record wrapper, never from the caller; verified_at is the database clock at insert.
create table forge_witness.verdicts (
  id bigint generated always as identity primary key,
  claim_id uuid not null unique,
  game_id bigint not null,
  policy_id text not null,
  verdict text not null check (verdict in ('accepted', 'rejected')),
  reason text check (reason ~ '^[a-z_]{3,48}$'),
  raw_sha256 text check (raw_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_sha256 text check (canonical_sha256 ~ '^[0-9a-f]{64}$'),
  tsa_token_sha256 text check (tsa_token_sha256 ~ '^[0-9a-f]{64}$'),
  statement_sha256 text check (statement_sha256 ~ '^[0-9a-f]{64}$'),
  input_cutoff timestamptz not null,
  scheduled_start timestamptz not null,
  deadline_at timestamptz not null,
  verified_at timestamptz not null default clock_timestamp(),
  verifier_role text not null,
  verifier_release text not null check (verifier_release ~ '^[0-9a-f]{40}$'),
  constraint verdicts_one_per_game unique (game_id, policy_id),
  constraint verdicts_reason check ((verdict = 'accepted') = (reason is null)),
  constraint verdicts_accepted_complete check (verdict <> 'accepted' or (raw_sha256 is not null and canonical_sha256 is not null
    and tsa_token_sha256 is not null and statement_sha256 is not null and verified_at <= deadline_at)),
  constraint verdicts_deadline check (deadline_at <= scheduled_start - interval '60 minutes')
);

do $tables$ declare name text; begin
  foreach name in array array['targets', 'verdicts'] loop
    execute format('alter table forge_witness.%I enable row level security', name);
    execute format('create trigger %I before update or delete on forge_witness.%I for each row execute function forge_witness.reject_mutation()',
      name || '_immutable', name);
    execute format('create trigger %I before truncate on forge_witness.%I for each statement execute function forge_witness.reject_mutation()',
      name || '_no_truncate', name);
    execute format('alter table forge_witness.%I enable always trigger %I', name, name || '_immutable');
    execute format('alter table forge_witness.%I enable always trigger %I', name, name || '_no_truncate');
  end loop;
end $tables$;

-- The verifier's own Data API credential (a JWT for role forge_witness_api, at most 12 h). It never enters Vercel or
-- Vault, which the FORGE writer can read. Only the owner touches the table; the installer sets, revokes and (from the
-- verifier's cron fire function, which runs as the installer like the WGO jobs) reads it through the definers below.
create table forge_witness.credentials (
  id smallint primary key default 1 check (id = 1),
  token text not null check (token ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' and length(token) <= 4096),
  expires_at timestamptz not null,
  set_at timestamptz not null default clock_timestamp()
);
alter table forge_witness.credentials enable row level security;

-- Installer only. Checks the token's claims (role forge_witness_api; expiry 5 min to 12 h away) without verifying its
-- signature, which only the Data API can do. Returns the claims, never the token.
create function forge_witness.set_credential_v1(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare part text; claims jsonb; expires timestamptz;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' or length(p_token) > 4096 then
    raise exception 'witness_credential_shape' using errcode = '22023';
  end if;
  part := pg_catalog.translate(pg_catalog.split_part(p_token, '.', 2), '-_', '+/');
  part := part || pg_catalog.repeat('=', (4 - length(part) % 4) % 4);
  begin
    claims := pg_catalog.convert_from(pg_catalog.decode(part, 'base64'), 'UTF8')::jsonb;
  exception when others then
    raise exception 'witness_credential_claims' using errcode = '22023';
  end;
  if claims->>'role' is distinct from 'forge_witness_api' or jsonb_typeof(claims->'exp') <> 'number' then
    raise exception 'witness_credential_claims' using errcode = '22023';
  end if;
  expires := pg_catalog.to_timestamp((claims->>'exp')::double precision);
  if expires < clock_timestamp() + interval '5 minutes' or expires > clock_timestamp() + interval '12 hours' then
    raise exception 'witness_credential_lifetime' using errcode = '22023';
  end if;
  insert into forge_witness.credentials (id, token, expires_at) values (1, p_token, expires)
    on conflict (id) do update set token = excluded.token, expires_at = excluded.expires_at, set_at = clock_timestamp();
  return pg_catalog.jsonb_build_object('role', claims->>'role', 'expiresAt', expires);
end $$;

-- Installer only: forget the credential. (The operator script also revokes forge_witness_api from authenticator, which
-- makes every outstanding token for the role useless at once.)
create function forge_witness.revoke_credential_v1()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from forge_witness.credentials;
  get diagnostics removed = row_count;
  return pg_catalog.jsonb_build_object('removed', removed);
end $$;

-- Installer only (the cron fire function): the current credential, or null when absent or within 2 min of expiry.
create function forge_witness.credential_v1()
returns text language sql stable security definer set search_path = '' as $$
  select c.token from forge_witness.credentials c where c.expires_at > clock_timestamp() + interval '2 minutes'
$$;

-- Installer only: arm one game. A game with a verdict can never be re-armed (and targets are immutable). The game's
-- schedule must be readable through schedule_v1 (start and both team rows), or the verifier could never decide it.
create function forge_witness.arm_v1(p_game_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t forge_witness.targets; s record;
begin
  if exists (select from forge_witness.verdicts v where v.game_id = p_game_id) then
    raise exception 'witness_target_has_verdict' using errcode = '55000';
  end if;
  select * into s from forge_witness.schedule_v1(p_game_id);
  if s.start_time is null or coalesce(cardinality(s.team_statuses), 0) < 2 then
    raise exception 'witness_schedule_unavailable' using errcode = '55000';
  end if;
  insert into forge_witness.targets (game_id) values (p_game_id) returning * into t;
  return pg_catalog.to_jsonb(t);
end $$;

-- Installer only: what is armed and what was decided (for the cron fire function and readback).
create function forge_witness.status_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'targets', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('gameId', t.game_id, 'armedAt', t.armed_at,
      'verdict', (select pg_catalog.to_jsonb(v) - 'id' from forge_witness.verdicts v where v.game_id = t.game_id and v.policy_id = t.policy_id))
      order by t.armed_at) from forge_witness.targets t), '[]'::jsonb),
    'pending', (select count(*) from forge_witness.targets t
      where not exists (select from forge_witness.verdicts v where v.game_id = t.game_id and v.policy_id = t.policy_id)),
    'dbNow', clock_timestamp())
$$;

-- Everything the verifier needs for one armed game, read from the committed rows. Status values: not_armed,
-- claim_missing, not_terminal (no terminal outcome yet: retry later), decided (verdict already recorded), ready.
create function forge_witness.evidence_v1(p_game_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t forge_witness.targets; c forge_pregame_capture.claims; a forge_pregame_capture.artifacts;
  w forge_pregame_capture.witnesses; o forge_pregame_capture.outcomes; v forge_witness.verdicts; s record;
begin
  select * into t from forge_witness.targets where game_id = p_game_id and policy_id = 'pregame-native-v1';
  if not found then return pg_catalog.jsonb_build_object('status', 'not_armed', 'gameId', p_game_id); end if;
  select * into v from forge_witness.verdicts where game_id = t.game_id and policy_id = t.policy_id;
  if found then return pg_catalog.jsonb_build_object('status', 'decided', 'gameId', p_game_id, 'verdict', pg_catalog.to_jsonb(v)); end if;
  select * into c from forge_pregame_capture.claims where game_id = t.game_id and policy_id = t.policy_id;
  if not found then return pg_catalog.jsonb_build_object('status', 'claim_missing', 'gameId', p_game_id, 'dbNow', clock_timestamp()); end if;
  select * into o from forge_pregame_capture.outcomes where claim_id = c.id;
  if not found then return pg_catalog.jsonb_build_object('status', 'not_terminal', 'gameId', p_game_id, 'claimId', c.id); end if;
  select * into a from forge_pregame_capture.artifacts where claim_id = c.id;
  select * into w from forge_pregame_capture.witnesses where claim_id = c.id;
  select * into s from forge_witness.schedule_v1(p_game_id);
  return pg_catalog.jsonb_build_object(
    'status', 'ready', 'gameId', p_game_id, 'policyId', t.policy_id,
    'claim', pg_catalog.jsonb_build_object('id', c.id, 'gameId', c.game_id, 'policyId', c.policy_id, 'slateDate', c.slate_date,
      'homeTeamId', c.home_team_id, 'awayTeamId', c.away_team_id, 'calendarRevision', c.calendar_revision,
      'scheduledStart', c.scheduled_start, 'inputCutoff', c.input_cutoff, 'ackDeadline', c.ack_deadline, 'codeVersion', c.code_version,
      'claimedAt', c.claimed_at),
    'outcome', o.outcome,
    'saveFenced', exists (select from forge_pregame_capture.save_fences f where f.claim_id = c.id),
    'artifact', case when a.claim_id is null then null else pg_catalog.jsonb_build_object(
      'packetBase64', pg_catalog.translate(pg_catalog.encode(a.packet, 'base64'), E'\n', ''),
      'dbRawSha256', pg_catalog.encode(pg_catalog.sha256(a.packet), 'hex'), 'rawSha256', a.raw_sha256,
      'canonicalSha256', a.canonical_sha256, 'byteLength', a.byte_length, 'rowVersion', a.xmin::text, 'insertedAt', a.inserted_at) end,
    'witness', case when w.claim_id is null then null else pg_catalog.jsonb_build_object(
      'statementText', w.statement_text, 'statementSha256', w.statement_sha256,
      'tokenBase64', pg_catalog.translate(pg_catalog.encode(w.tsa_token, 'base64'), E'\n', ''),
      'dbTokenSha256', pg_catalog.encode(pg_catalog.sha256(w.tsa_token), 'hex'), 'tokenSha256', w.tsa_token_sha256,
      'genTime', w.tsa_gen_time, 'accuracyUs', w.tsa_accuracy_us, 'resolutionUs', w.tsa_resolution_us, 'accuracySource', w.tsa_accuracy_source,
      'signerSha256', w.tsa_signer_sha256, 'ackUpper', w.ack_upper, 'dbReadAt', w.db_read_at, 'finalReadAt', w.final_read_at) end,
    'schedule', case when s.game_id is null then null else pg_catalog.jsonb_build_object('gameDate', s.game_date, 'startTime', s.start_time,
      'homeTeamId', s.home_team_id, 'awayTeamId', s.away_team_id, 'homeAbbrev', s.home_abbrev, 'awayAbbrev', s.away_abbrev,
      'teamStatuses', pg_catalog.to_jsonb(s.team_statuses)) end,
    'dbNow', clock_timestamp());
end $$;

-- Records the verifier's verdict for an armed game's claim. The database re-checks everything it can on its own:
-- the claim belongs to the armed game, the submitted hashes and cutoff equal the committed bytes and rows, the custody
-- read order, the witness bounds and its own clock against least(claimed start, current start) − 60 min. Any failure
-- turns an "accepted" into a stored rejection. Operational gaps (no terminal outcome, schedule invisible) raise and
-- store nothing, so a retry can still decide. A second call for the same game returns the stored row unchanged.
create function forge_witness.record_v1(p_game_id bigint, p_claim_id uuid, p_verdict text, p_reason text, p_raw_sha256 text,
  p_canonical_sha256 text, p_tsa_token_sha256 text, p_statement_sha256 text, p_input_cutoff timestamptz, p_release text, p_caller text)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  t forge_witness.targets; c forge_pregame_capture.claims; a forge_pregame_capture.artifacts;
  w forge_pregame_capture.witnesses; o forge_pregame_capture.outcomes; v forge_witness.verdicts; s record;
  deadline timestamptz; decided text := p_verdict; why text := p_reason; fenced boolean;
begin
  if p_verdict is null or p_verdict not in ('accepted', 'rejected') or ((p_verdict = 'accepted') <> (p_reason is null))
    or coalesce(p_release, '') !~ '^[0-9a-f]{40}$' or (p_reason is not null and p_reason not in ('artifact_missing', 'save_fenced',
      'outcome_not_qualified', 'witness_missing', 'packet_invalid', 'claim_binding', 'game_binding', 'hash_mismatch', 'cutoff_mismatch',
      'statement_binding', 'token_invalid', 'schedule_changed', 'witness_late', 'verification_late', 'timing_invalid')) then
    raise exception 'witness_record_arguments' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('forge_witness'), pg_catalog.hashtext(p_game_id::text));
  select * into t from forge_witness.targets where game_id = p_game_id and policy_id = 'pregame-native-v1';
  if not found then raise exception 'witness_target_not_armed' using errcode = '42501'; end if;
  select * into v from forge_witness.verdicts where game_id = t.game_id and policy_id = t.policy_id;
  if found then return pg_catalog.jsonb_build_object('created', false, 'verdict', pg_catalog.to_jsonb(v)); end if;
  select * into c from forge_pregame_capture.claims where game_id = t.game_id and policy_id = t.policy_id;
  if not found or c.id <> p_claim_id then raise exception 'witness_claim_binding' using errcode = '22023'; end if;
  select * into o from forge_pregame_capture.outcomes where claim_id = c.id;
  if not found then raise exception 'witness_claim_not_terminal' using errcode = '55000'; end if;
  select * into s from forge_witness.schedule_v1(p_game_id);
  if not found or s.start_time is null then raise exception 'witness_schedule_unavailable' using errcode = '55000'; end if;
  deadline := least(c.scheduled_start, s.start_time) - interval '60 minutes';
  select * into a from forge_pregame_capture.artifacts where claim_id = c.id;
  select * into w from forge_pregame_capture.witnesses where claim_id = c.id;
  fenced := exists (select from forge_pregame_capture.save_fences f where f.claim_id = c.id);

  if decided = 'accepted' then
    why := case
      when a.claim_id is null then 'artifact_missing'
      when fenced then 'save_fenced'
      when o.outcome <> 'qualified' then 'outcome_not_qualified'
      when w.claim_id is null then 'witness_missing'
      when p_raw_sha256 is distinct from pg_catalog.encode(pg_catalog.sha256(a.packet), 'hex') or p_raw_sha256 is distinct from a.raw_sha256
        or p_canonical_sha256 is distinct from a.canonical_sha256 then 'hash_mismatch'
      when p_tsa_token_sha256 is distinct from pg_catalog.encode(pg_catalog.sha256(w.tsa_token), 'hex')
        or p_statement_sha256 is distinct from w.statement_sha256 then 'statement_binding'
      when p_input_cutoff is distinct from c.input_cutoff or c.input_cutoff <> c.claimed_at then 'cutoff_mismatch'
      when s.start_time <> c.scheduled_start or s.home_team_id <> c.home_team_id or s.away_team_id <> c.away_team_id
        or s.game_date <> c.slate_date then 'schedule_changed'
      when not (c.input_cutoff <= a.inserted_at and a.inserted_at <= w.db_read_at and w.final_read_at is not null
        and w.db_read_at <= w.final_read_at) then 'timing_invalid'
      when w.ack_upper > deadline or w.final_read_at > deadline then 'witness_late'
      when clock_timestamp() > deadline then 'verification_late'
    end;
    if why is not null then decided := 'rejected'; end if;
  end if;

  insert into forge_witness.verdicts (claim_id, game_id, policy_id, verdict, reason, raw_sha256, canonical_sha256, tsa_token_sha256,
    statement_sha256, input_cutoff, scheduled_start, deadline_at, verifier_role, verifier_release)
  values (c.id, t.game_id, t.policy_id, decided, why,
    case when a.claim_id is null then null else pg_catalog.encode(pg_catalog.sha256(a.packet), 'hex') end, a.canonical_sha256,
    case when w.claim_id is null then null else pg_catalog.encode(pg_catalog.sha256(w.tsa_token), 'hex') end, w.statement_sha256,
    c.input_cutoff, c.scheduled_start, deadline, left(coalesce(p_caller, 'unknown'), 63), p_release)
  on conflict do nothing
  returning * into v;
  if found then return pg_catalog.jsonb_build_object('created', true, 'verdict', pg_catalog.to_jsonb(v)); end if;
  select * into strict v from forge_witness.verdicts where game_id = t.game_id and policy_id = t.policy_id;
  return pg_catalog.jsonb_build_object('created', false, 'verdict', pg_catalog.to_jsonb(v));
end $$;

-- Publisher gate (read-only). Accepted only for an accepted verdict on exactly this claim and these three hashes, which
-- still match the committed artifact and witness, verified at or before least(claimed start, current start) − 60 min.
create function forge_witness.publication_gate_v1(p_claim_id uuid, p_raw_sha256 text, p_canonical_sha256 text, p_tsa_token_sha256 text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v forge_witness.verdicts; c forge_pregame_capture.claims; s record; deadline timestamptz; why text;
begin
  select * into v from forge_witness.verdicts where claim_id = p_claim_id;
  select * into c from forge_pregame_capture.claims where id = p_claim_id;
  if c.id is not null then
    select * into s from forge_witness.schedule_v1(c.game_id);
    -- least() ignores NULL: an invisible current start must not fall back to the claimed start.
    deadline := case when s.start_time is null then null else least(c.scheduled_start, s.start_time) - interval '60 minutes' end;
  end if;
  why := case
    when v.id is null then 'verdict_missing'
    when v.verdict <> 'accepted' then 'verdict_rejected'
    when c.id is null or v.game_id <> c.game_id or v.policy_id <> c.policy_id then 'claim_mismatch'
    when v.raw_sha256 is distinct from p_raw_sha256 or v.canonical_sha256 is distinct from p_canonical_sha256
      or v.tsa_token_sha256 is distinct from p_tsa_token_sha256 then 'hash_mismatch'
    when not exists (select from forge_pregame_capture.artifacts a join forge_pregame_capture.witnesses w using (claim_id)
      where a.claim_id = p_claim_id and a.raw_sha256 = v.raw_sha256 and a.canonical_sha256 = v.canonical_sha256
        and w.tsa_token_sha256 = v.tsa_token_sha256) then 'custody_mismatch'
    when deadline is null then 'schedule_unavailable'
    when v.verified_at > deadline then 'verified_late'
  end;
  return pg_catalog.jsonb_build_object('accepted', why is null, 'reason', why, 'claimId', p_claim_id, 'verdictId', v.id,
    'verifiedAt', v.verified_at, 'deadline', deadline);
end $$;

-- The same gate as a guard for the publish transaction: raises unless accepted.
create function forge_witness.require_accepted_v1(p_claim_id uuid, p_raw_sha256 text, p_canonical_sha256 text, p_tsa_token_sha256 text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare gate jsonb := forge_witness.publication_gate_v1(p_claim_id, p_raw_sha256, p_canonical_sha256, p_tsa_token_sha256);
begin
  if not (gate->>'accepted')::boolean then
    raise exception 'witness_verdict_required' using errcode = '42501', detail = gate->>'reason';
  end if;
  return gate;
end $$;

-- The exposed surface: three SQL definers, each calling one private function. The caller label is the JWT role
-- PostgREST switched to (the role GUC), recorded for the receipt.
create function forge_witness_api.pending_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(p.game_id order by p.armed_at), '[]'::jsonb) from (
    select t.game_id, t.armed_at from forge_witness.targets t
    where not exists (select from forge_witness.verdicts v where v.game_id = t.game_id and v.policy_id = t.policy_id)
      and t.armed_at > clock_timestamp() - interval '2 days'
    order by t.armed_at limit 16) p
$$;
create function forge_witness_api.evidence_v1(p_game_id bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
  select forge_witness.evidence_v1(p_game_id)
$$;
create function forge_witness_api.record_v1(p_game_id bigint, p_claim_id uuid, p_verdict text, p_reason text, p_raw_sha256 text,
  p_canonical_sha256 text, p_tsa_token_sha256 text, p_statement_sha256 text, p_input_cutoff timestamptz, p_release text)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select forge_witness.record_v1(p_game_id, p_claim_id, p_verdict, p_reason, p_raw_sha256, p_canonical_sha256, p_tsa_token_sha256,
    p_statement_sha256, p_input_cutoff, p_release, coalesce(nullif(pg_catalog.current_setting('role', true), 'none'), session_user::text))
$$;

reset role;

-- Lockdown, then the exact grants. Explicit revokes also undo any default privileges the installer carries.
revoke all on all tables in schema forge_witness, forge_witness_api from public, anon, authenticated, service_role;
revoke all on all sequences in schema forge_witness, forge_witness_api from public, anon, authenticated, service_role;
revoke all on all functions in schema forge_witness, forge_witness_api from public, anon, authenticated, service_role;
grant execute on function forge_witness.schedule_v1(bigint) to forge_witness_owner;
grant usage on schema forge_witness_api to forge_witness_api;
grant execute on all functions in schema forge_witness_api to forge_witness_api;
-- Publisher gate: service_role (the FORGE writer's credential) and the installer (owner of the publish definers) may
-- call the read-only gate and nothing else in forge_witness.
grant usage on schema forge_witness to service_role;
grant execute on function forge_witness.publication_gate_v1(uuid, text, text, text),
  forge_witness.require_accepted_v1(uuid, text, text, text) to service_role;
do $installer$ begin
  execute format('grant usage on schema forge_witness to %I', session_user);
  execute format('grant execute on function forge_witness.publication_gate_v1(uuid, text, text, text), '
    'forge_witness.require_accepted_v1(uuid, text, text, text), forge_witness.arm_v1(bigint), forge_witness.status_v1(), '
    'forge_witness.set_credential_v1(text), forge_witness.revoke_credential_v1(), forge_witness.credential_v1() to %I', session_user);
end $installer$;
revoke forge_witness_owner from current_user;
commit;
notify pgrst, 'reload schema';
