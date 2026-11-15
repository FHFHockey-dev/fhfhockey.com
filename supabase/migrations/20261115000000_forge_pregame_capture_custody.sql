-- Private FORGE pregame input capture custody (Claude capture lane; TJ steer 20261115).
-- Source-authorized only: applying this migration needs TJ's own pop-up approval.
--
-- One claim per (game, policy). One immutable packet per claim. A separate verifier reads the
-- committed bytes back, then retains an RFC 3161 witness. Every table is insert-only; all
-- access goes through SECURITY DEFINER functions that only service_role may execute. Nothing
-- here scores, writes forecasts, publishes revisions or changes serving.

create schema forge_pregame_capture;
revoke all on schema forge_pregame_capture from public, anon, authenticated, service_role;

create table forge_pregame_capture.claims (
  id uuid primary key default gen_random_uuid(),
  game_id bigint not null,
  policy_id text not null check (policy_id ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  slate_date date not null,
  home_team_id smallint not null,
  away_team_id smallint not null check (away_team_id <> home_team_id),
  calendar_revision text not null check (calendar_revision ~ '^[0-9a-f]{64}$'),
  scheduled_start timestamptz not null,
  input_cutoff timestamptz not null,
  ack_deadline timestamptz not null,
  required_ms integer not null check (required_ms between 1000 and 3600000),
  code_version text not null check (length(code_version) between 7 and 64),
  claimed_at timestamptz not null default clock_timestamp(),
  constraint claims_one_attempt unique (game_id, policy_id),
  constraint claims_deadline check (ack_deadline = scheduled_start - interval '60 minutes'),
  constraint claims_cutoff check (input_cutoff <= claimed_at and input_cutoff <= ack_deadline)
);

create table forge_pregame_capture.artifacts (
  claim_id uuid primary key references forge_pregame_capture.claims(id),
  packet bytea not null check (octet_length(packet) between 1 and 33554432),
  raw_sha256 text not null check (raw_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_sha256 text not null check (canonical_sha256 ~ '^[0-9a-f]{64}$'),
  byte_length integer not null,
  -- Writer-side database clock. Not proof of committed custody; the witness is.
  inserted_at timestamptz not null default clock_timestamp(),
  constraint artifacts_raw_hash check (raw_sha256 = encode(sha256(packet), 'hex') and byte_length = octet_length(packet))
);

-- A save whose outcome is unknown is settled, never retried: settle_v1 takes the claim's row lock, so it either
-- sees the committed artifact or records a fence that every later save collides with.
create table forge_pregame_capture.save_fences (
  claim_id uuid primary key references forge_pregame_capture.claims(id),
  fenced_at timestamptz not null default clock_timestamp()
);

create table forge_pregame_capture.witnesses (
  claim_id uuid primary key references forge_pregame_capture.artifacts(claim_id),
  statement jsonb not null,
  statement_sha256 text not null check (statement_sha256 ~ '^[0-9a-f]{64}$'),
  tsa_token bytea not null check (octet_length(tsa_token) between 64 and 65536),
  tsa_gen_time timestamptz not null,
  tsa_accuracy_us bigint not null check (tsa_accuracy_us >= 0),
  ack_upper timestamptz not null,
  db_read_at timestamptz not null,
  verdict text not null check (verdict in ('qualified', 'saved_without_valid_witness')),
  verdict_reason text,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint witnesses_reason check ((verdict = 'qualified') = (verdict_reason is null))
);

create table forge_pregame_capture.outcomes (
  game_id bigint not null,
  policy_id text not null,
  claim_id uuid references forge_pregame_capture.claims(id),
  outcome text not null check (outcome in ('never_dispatched', 'source_failed', 'save_unknown', 'saved_without_valid_witness', 'qualified')),
  -- Diagnostics are metadata only: no packet content.
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (game_id, policy_id)
);

create function forge_pregame_capture.reject_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'forge_pregame_capture rows are immutable' using errcode = '42501';
end $$;

do $$
declare name text;
begin
  foreach name in array array['claims', 'artifacts', 'save_fences', 'witnesses', 'outcomes'] loop
    execute format('revoke all on forge_pregame_capture.%I from public, anon, authenticated, service_role', name);
    execute format('create trigger %I before update or delete on forge_pregame_capture.%I for each row execute function forge_pregame_capture.reject_mutation()', name || '_immutable', name);
    execute format('create trigger %I before truncate on forge_pregame_capture.%I for each statement execute function forge_pregame_capture.reject_mutation()', name || '_no_truncate', name);
  end loop;
end $$;
revoke all on function forge_pregame_capture.reject_mutation() from public, anon, authenticated, service_role;

-- Claim one (game, policy) attempt. Refusals insert nothing. The database clock decides lateness.
create function public.forge_pregame_capture_claim_v1(
  p_game_id bigint, p_policy_id text, p_slate_date date, p_home_team_id smallint, p_away_team_id smallint,
  p_calendar_revision text, p_scheduled_start timestamptz, p_input_cutoff timestamptz, p_required_ms integer, p_code_version text)
returns table (outcome text, claim_id uuid, ack_deadline timestamptz, db_now timestamptz, input_cutoff timestamptz)
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  game record;
  now_at timestamptz := clock_timestamp();
  deadline timestamptz;
  inserted uuid;
  cutoff timestamptz := coalesce(p_input_cutoff, now_at); -- null: the claim's own database clock
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('forge_pregame_capture_claim'), pg_catalog.hashtext(p_game_id::text || '/' || p_policy_id));
  select g.date, g."startTime", g."homeTeamId", g."awayTeamId" into game from public.games g where g.id = p_game_id;
  if not found or game.date <> p_slate_date or game."homeTeamId" <> p_home_team_id or game."awayTeamId" <> p_away_team_id
     or game."startTime" <> p_scheduled_start then
    return query select 'binding_mismatch'::text, null::uuid, null::timestamptz, now_at, null::timestamptz; return;
  end if;
  deadline := p_scheduled_start - interval '60 minutes';
  if exists (select 1 from forge_pregame_capture.claims c where c.game_id = p_game_id and c.policy_id = p_policy_id) then
    return query select 'duplicate'::text, null::uuid, deadline, now_at, null::timestamptz; return;
  end if;
  if cutoff > now_at then
    return query select 'future_cutoff'::text, null::uuid, deadline, now_at, null::timestamptz; return;
  end if;
  if now_at >= deadline then
    return query select 'late_start'::text, null::uuid, deadline, now_at, null::timestamptz; return;
  end if;
  if p_required_ms is null or now_at + make_interval(secs => p_required_ms / 1000.0) > deadline then
    return query select 'insufficient_time'::text, null::uuid, deadline, now_at, null::timestamptz; return;
  end if;
  insert into forge_pregame_capture.claims (game_id, policy_id, slate_date, home_team_id, away_team_id, calendar_revision,
    scheduled_start, input_cutoff, ack_deadline, required_ms, code_version, claimed_at)
  values (p_game_id, p_policy_id, p_slate_date, p_home_team_id, p_away_team_id, p_calendar_revision,
    p_scheduled_start, cutoff, deadline, p_required_ms, p_code_version, now_at)
  returning id into inserted;
  return query select 'claimed'::text, inserted, deadline, now_at, cutoff;
end $$;

-- Save the packet once. A hash mismatch, late save or second save raises and stores nothing.
-- Callers never retry: an ambiguous outcome is settled with settle_v1, then read back with read_v1, by claim id.
-- Callers bound their own wait; a function-level statement_timeout would not bound this call.
create function public.forge_pregame_capture_save_v1(p_claim_id uuid, p_packet_base64 text, p_raw_sha256 text, p_canonical_sha256 text)
returns table (raw_sha256 text, byte_length integer, db_now timestamptz)
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  bytes bytea := pg_catalog.decode(p_packet_base64, 'base64');
  claim record;
  digest text;
begin
  -- The claim row lock serializes this save with settle_v1 until this transaction ends.
  select c.ack_deadline into claim from forge_pregame_capture.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'capture_claim_missing' using errcode = 'P0002'; end if;
  if exists (select 1 from forge_pregame_capture.save_fences f where f.claim_id = p_claim_id) then
    raise exception 'capture_save_fenced' using errcode = '55000';
  end if;
  if clock_timestamp() > claim.ack_deadline then raise exception 'capture_save_late' using errcode = '22023'; end if;
  digest := pg_catalog.encode(pg_catalog.sha256(bytes), 'hex');
  if digest <> p_raw_sha256 then raise exception 'capture_raw_hash_mismatch' using errcode = '22023'; end if;
  insert into forge_pregame_capture.artifacts (claim_id, packet, raw_sha256, canonical_sha256, byte_length)
  values (p_claim_id, bytes, digest, p_canonical_sha256, pg_catalog.octet_length(bytes));
  return query select digest, pg_catalog.octet_length(bytes), clock_timestamp();
end $$;

-- Settles an unknown save without retrying it. Waits (bounded by lock_timeout) for any in-flight save on the
-- claim's row lock, then returns 'present' if the artifact committed, otherwise fences the claim: 'fenced'.
-- A function-level statement_timeout does not bound its own call, so absence is never inferred from a timer.
create function public.forge_pregame_capture_settle_v1(p_claim_id uuid)
returns table (state text, db_now timestamptz)
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
begin
  perform 1 from forge_pregame_capture.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'capture_claim_missing' using errcode = 'P0002'; end if;
  if exists (select 1 from forge_pregame_capture.artifacts a where a.claim_id = p_claim_id) then
    return query select 'present'::text, clock_timestamp(); return;
  end if;
  insert into forge_pregame_capture.save_fences (claim_id) values (p_claim_id) on conflict (claim_id) do nothing;
  return query select 'fenced'::text, clock_timestamp();
end $$;

-- Authoritative committed read for the independent verifier and for reconciliation.
-- Recomputes the hash from stored bytes and reports the row version and the database clock.
create function public.forge_pregame_capture_read_v1(p_claim_id uuid)
returns table (
  claim_id uuid, game_id bigint, policy_id text, slate_date date, home_team_id smallint, away_team_id smallint,
  calendar_revision text, scheduled_start timestamptz, input_cutoff timestamptz, ack_deadline timestamptz, code_version text,
  artifact_present boolean, save_fenced boolean, packet_base64 text, raw_sha256 text, stored_raw_sha256 text, canonical_sha256 text,
  byte_length integer, row_version text, current_start timestamptz, team_game_statuses text[], db_read_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  return query
  select c.id, c.game_id, c.policy_id, c.slate_date, c.home_team_id, c.away_team_id, c.calendar_revision,
    c.scheduled_start, c.input_cutoff, c.ack_deadline, c.code_version,
    a.claim_id is not null, exists (select 1 from forge_pregame_capture.save_fences f where f.claim_id = c.id),
    pg_catalog.encode(a.packet, 'base64'), pg_catalog.encode(pg_catalog.sha256(a.packet), 'hex'),
    a.raw_sha256, a.canonical_sha256, a.byte_length, a.xmin::text,
    (select g."startTime" from public.games g where g.id = c.game_id),
    array(select t.team_abbreviation::text || ':' || t.game_status from public.roster_optimizer_team_games t
      where t.source_game_id = c.game_id order by t.team_abbreviation),
    clock_timestamp()
  from forge_pregame_capture.claims c
  left join forge_pregame_capture.artifacts a on a.claim_id = c.id
  where c.id = p_claim_id;
end $$;

create function public.forge_pregame_capture_record_witness_v1(
  p_claim_id uuid, p_statement jsonb, p_statement_sha256 text, p_tsa_token_base64 text, p_tsa_gen_time timestamptz,
  p_tsa_accuracy_us bigint, p_ack_upper timestamptz, p_db_read_at timestamptz, p_verdict text, p_verdict_reason text)
returns timestamptz
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  recorded timestamptz;
  bound record;
begin
  select a.raw_sha256, a.canonical_sha256, c.ack_deadline, c.game_id, c.policy_id into bound
  from forge_pregame_capture.artifacts a join forge_pregame_capture.claims c on c.id = a.claim_id where a.claim_id = p_claim_id;
  if not found then raise exception 'capture_artifact_missing' using errcode = 'P0002'; end if;
  -- The witness statement must name exactly the committed bytes and game it attests.
  if p_statement->>'claimId' is distinct from p_claim_id::text or p_statement->>'rawSha256' is distinct from bound.raw_sha256
     or p_statement->>'canonicalSha256' is distinct from bound.canonical_sha256
     or p_statement->>'gameId' is distinct from bound.game_id::text or p_statement->>'policyId' is distinct from bound.policy_id then
    raise exception 'capture_witness_binding' using errcode = '22023';
  end if;
  if p_verdict = 'qualified' and p_ack_upper > bound.ack_deadline then
    raise exception 'capture_witness_late' using errcode = '22023';
  end if;
  insert into forge_pregame_capture.witnesses (claim_id, statement, statement_sha256, tsa_token, tsa_gen_time, tsa_accuracy_us,
    ack_upper, db_read_at, verdict, verdict_reason)
  values (p_claim_id, p_statement, p_statement_sha256, pg_catalog.decode(p_tsa_token_base64, 'base64'), p_tsa_gen_time,
    p_tsa_accuracy_us, p_ack_upper, p_db_read_at, p_verdict, p_verdict_reason)
  returning recorded_at into recorded;
  return recorded;
end $$;

create function public.forge_pregame_capture_record_outcome_v1(p_game_id bigint, p_policy_id text, p_claim_id uuid, p_outcome text, p_metadata jsonb)
returns timestamptz
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare recorded timestamptz;
begin
  if p_claim_id is not null and not exists (select 1 from forge_pregame_capture.claims c
      where c.id = p_claim_id and c.game_id = p_game_id and c.policy_id = p_policy_id) then
    raise exception 'capture_outcome_binding' using errcode = '22023';
  end if;
  if p_outcome = 'qualified' and not exists (select 1 from forge_pregame_capture.witnesses w
      where w.claim_id = p_claim_id and w.verdict = 'qualified') then
    raise exception 'capture_outcome_unwitnessed' using errcode = '22023';
  end if;
  insert into forge_pregame_capture.outcomes (game_id, policy_id, claim_id, outcome, metadata)
  values (p_game_id, p_policy_id, p_claim_id, p_outcome, coalesce(p_metadata, '{}'::jsonb))
  returning recorded_at into recorded;
  return recorded;
end $$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'public.forge_pregame_capture_claim_v1(bigint, text, date, smallint, smallint, text, timestamptz, timestamptz, integer, text)',
    'public.forge_pregame_capture_save_v1(uuid, text, text, text)',
    'public.forge_pregame_capture_settle_v1(uuid)',
    'public.forge_pregame_capture_read_v1(uuid)',
    'public.forge_pregame_capture_record_witness_v1(uuid, jsonb, text, text, timestamptz, bigint, timestamptz, timestamptz, text, text)',
    'public.forge_pregame_capture_record_outcome_v1(bigint, text, uuid, text, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end $$;
