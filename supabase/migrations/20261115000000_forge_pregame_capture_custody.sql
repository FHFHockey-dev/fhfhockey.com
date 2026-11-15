-- Private FORGE pregame input capture custody (Claude capture lane; TJ steer 20261115).
-- Source-authorized only: applying this migration needs TJ's own pop-up approval.
--
-- One claim per (game, policy). One immutable packet per claim. A separate verifier reads the
-- committed bytes back, then retains an RFC 3161 witness. Exactly one terminal outcome per
-- (game, policy), consistent with the claim's state. Every table is insert-only; all access goes
-- through SECURITY DEFINER functions that only service_role may execute. Nothing here scores,
-- writes forecasts, publishes revisions or changes serving.

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
  -- The claim's own database clock; passed to the readers' as-of filters.
  input_cutoff timestamptz not null,
  ack_deadline timestamptz not null,
  required_ms integer not null check (required_ms between 1000 and 3600000),
  code_version text not null check (length(code_version) between 7 and 64),
  claimed_at timestamptz not null default clock_timestamp(),
  constraint claims_one_attempt unique (game_id, policy_id),
  constraint claims_deadline check (ack_deadline = scheduled_start - interval '60 minutes'),
  constraint claims_cutoff check (input_cutoff = claimed_at and input_cutoff < ack_deadline)
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

-- A save whose outcome is unknown is settled, never retried: settle takes the claim's row lock, so it either
-- sees the committed artifact or records a fence that every later save collides with.
create table forge_pregame_capture.save_fences (
  claim_id uuid primary key references forge_pregame_capture.claims(id),
  fenced_at timestamptz not null default clock_timestamp()
);

create table forge_pregame_capture.witnesses (
  claim_id uuid primary key references forge_pregame_capture.artifacts(claim_id),
  -- The exact canonical text the RFC 3161 imprint covers; its digest is computed here, not supplied.
  statement_text text not null,
  statement jsonb not null,
  statement_sha256 text not null check (statement_sha256 ~ '^[0-9a-f]{64}$'),
  tsa_token bytea not null check (octet_length(tsa_token) between 64 and 65536),
  tsa_token_sha256 text generated always as (encode(sha256(tsa_token), 'hex')) stored,
  tsa_gen_time timestamptz not null,
  tsa_accuracy_us bigint not null check (tsa_accuracy_us between 0 and 60000000),
  tsa_accuracy_source text not null check (tsa_accuracy_source in ('token', 'pinned_policy')),
  tsa_signer_sha256 text not null check (tsa_signer_sha256 ~ '^[0-9a-f]{64}$'),
  ack_upper timestamptz not null,
  db_read_at timestamptz not null,
  verdict text not null check (verdict in ('qualified', 'saved_without_valid_witness')),
  verdict_reason text,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint witnesses_reason check ((verdict = 'qualified') = (verdict_reason is null)),
  constraint witnesses_upper check (ack_upper = tsa_gen_time + (tsa_accuracy_us::text || ' microseconds')::interval),
  constraint witnesses_digest check (statement_sha256 = encode(sha256(convert_to(statement_text, 'UTF8')), 'hex'))
);

create table forge_pregame_capture.outcomes (
  game_id bigint not null,
  policy_id text not null,
  claim_id uuid references forge_pregame_capture.claims(id),
  outcome text not null check (outcome in ('never_dispatched', 'source_failed', 'save_unknown', 'saved_without_valid_witness', 'qualified')),
  -- Diagnostics are metadata only: no packet content.
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (game_id, policy_id),
  constraint outcomes_claim check ((outcome = 'never_dispatched') = (claim_id is null))
);
create unique index outcomes_one_per_claim on forge_pregame_capture.outcomes (claim_id) where claim_id is not null;

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
    -- ALWAYS: also fires under session_replication_role = replica.
    execute format('alter table forge_pregame_capture.%I enable always trigger %I', name, name || '_immutable');
    execute format('alter table forge_pregame_capture.%I enable always trigger %I', name, name || '_no_truncate');
  end loop;
end $$;
revoke all on function forge_pregame_capture.reject_mutation() from public, anon, authenticated, service_role;

-- One advisory lock per (game, policy) serializes claim, outcome recording and the sweeper.
create function forge_pregame_capture.lock_key(p_game_id bigint, p_policy_id text) returns void
language sql set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('forge_pregame_capture'), pg_catalog.hashtext(p_game_id::text || '/' || p_policy_id));
$$;
revoke all on function forge_pregame_capture.lock_key(bigint, text) from public, anon, authenticated, service_role;

-- Claim one (game, policy) attempt. Refusals insert nothing. The database clock decides lateness and is the cutoff.
create function public.forge_pregame_capture_claim_v1(
  p_game_id bigint, p_policy_id text, p_slate_date date, p_home_team_id smallint, p_away_team_id smallint,
  p_calendar_revision text, p_scheduled_start timestamptz, p_required_ms integer, p_code_version text)
returns table (outcome text, claim_id uuid, ack_deadline timestamptz, db_now timestamptz, input_cutoff timestamptz)
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  game record;
  now_at timestamptz;
  deadline timestamptz;
  inserted uuid;
begin
  perform forge_pregame_capture.lock_key(p_game_id, p_policy_id);
  now_at := clock_timestamp();
  select g.date, g."startTime", g."homeTeamId", g."awayTeamId" into game from public.games g where g.id = p_game_id;
  if not found or game.date <> p_slate_date or game."homeTeamId" <> p_home_team_id or game."awayTeamId" <> p_away_team_id
     or game."startTime" <> p_scheduled_start then
    return query select 'binding_mismatch'::text, null::uuid, null::timestamptz, now_at, null::timestamptz; return;
  end if;
  deadline := p_scheduled_start - interval '60 minutes';
  if exists (select 1 from forge_pregame_capture.claims c where c.game_id = p_game_id and c.policy_id = p_policy_id)
     or exists (select 1 from forge_pregame_capture.outcomes o where o.game_id = p_game_id and o.policy_id = p_policy_id) then
    return query select 'duplicate'::text, null::uuid, deadline, now_at, null::timestamptz; return;
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
    p_scheduled_start, now_at, deadline, p_required_ms, p_code_version, now_at)
  returning id into inserted;
  return query select 'claimed'::text, inserted, deadline, now_at, now_at;
end $$;

-- Save the packet once. A hash mismatch, late save, fenced or second save raises and stores nothing.
-- Callers never retry: an unknown result is settled with settle_v1, by claim id.
-- Callers bound their own wait; a function-level statement_timeout would not bound this call.
create function public.forge_pregame_capture_save_v1(p_claim_id uuid, p_packet_base64 text, p_raw_sha256 text, p_canonical_sha256 text)
returns table (raw_sha256 text, byte_length integer, db_now timestamptz)
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  bytes bytea := pg_catalog.decode(p_packet_base64, 'base64');
  claim record;
  digest text;
begin
  -- The claim row lock serializes this save with settle and outcome recording until this transaction ends.
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
-- Idempotent: repeating it can only return the same state or move absent -> fenced.
create function public.forge_pregame_capture_settle_v1(p_claim_id uuid)
returns table (state text, db_now timestamptz)
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
begin
  perform 1 from forge_pregame_capture.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'capture_claim_missing' using errcode = 'P0002'; end if;
  if exists (select 1 from forge_pregame_capture.artifacts a where a.claim_id = p_claim_id) then
    return query select 'present'::text, clock_timestamp(); return;
  end if;
  insert into forge_pregame_capture.save_fences (claim_id) values (p_claim_id) on conflict on constraint save_fences_pkey do nothing;
  return query select 'fenced'::text, clock_timestamp();
end $$;

-- Authoritative committed read for the independent verifier and for reconciliation.
-- Recomputes the hash from stored bytes and reports the row version, schedule state and the database clock.
create function public.forge_pregame_capture_read_v1(p_claim_id uuid)
returns table (
  claim_id uuid, game_id bigint, policy_id text, slate_date date, home_team_id smallint, away_team_id smallint,
  calendar_revision text, scheduled_start timestamptz, input_cutoff timestamptz, ack_deadline timestamptz, code_version text,
  artifact_present boolean, save_fenced boolean, packet_base64 text, raw_sha256 text, stored_raw_sha256 text, canonical_sha256 text,
  byte_length integer, row_version text, artifact_inserted_at timestamptz, current_start timestamptz, team_game_statuses text[],
  team_game_fetched_at timestamptz, witness_verdict text, witness_statement_text text, witness_token_base64 text,
  outcome text, db_read_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  return query
  select c.id, c.game_id, c.policy_id, c.slate_date, c.home_team_id, c.away_team_id, c.calendar_revision,
    c.scheduled_start, c.input_cutoff, c.ack_deadline, c.code_version,
    a.claim_id is not null, exists (select 1 from forge_pregame_capture.save_fences f where f.claim_id = c.id),
    pg_catalog.translate(pg_catalog.encode(a.packet, 'base64'), E'\n', ''), pg_catalog.encode(pg_catalog.sha256(a.packet), 'hex'),
    a.raw_sha256, a.canonical_sha256, a.byte_length, a.xmin::text, a.inserted_at,
    (select g."startTime" from public.games g where g.id = c.game_id),
    array(select t.team_abbreviation::text || ':' || t.game_status || ':' || t.schedule_status
      from public.roster_optimizer_team_games t where t.source_game_id = c.game_id order by t.team_abbreviation),
    (select max(t.fetched_at) from public.roster_optimizer_team_games t where t.source_game_id = c.game_id),
    w.verdict, w.statement_text, pg_catalog.translate(pg_catalog.encode(w.tsa_token, 'base64'), E'\n', ''),
    o.outcome,
    clock_timestamp()
  from forge_pregame_capture.claims c
  left join forge_pregame_capture.artifacts a on a.claim_id = c.id
  left join forge_pregame_capture.witnesses w on w.claim_id = c.id
  left join forge_pregame_capture.outcomes o on o.claim_id = c.id
  where c.id = p_claim_id;
end $$;

-- Reconciliation by (game, policy): finds a claim whose response was lost, and any recorded outcome.
create function public.forge_pregame_capture_lookup_v1(p_game_id bigint, p_policy_id text)
returns table (claim_id uuid, artifact_present boolean, save_fenced boolean, witness_verdict text, outcome text, db_now timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  return query
  select c.id, a.claim_id is not null, f.claim_id is not null, w.verdict,
    (select o.outcome from forge_pregame_capture.outcomes o where o.game_id = p_game_id and o.policy_id = p_policy_id), clock_timestamp()
  from (select 1) one
  left join forge_pregame_capture.claims c on c.game_id = p_game_id and c.policy_id = p_policy_id
  left join forge_pregame_capture.artifacts a on a.claim_id = c.id
  left join forge_pregame_capture.save_fences f on f.claim_id = c.id
  left join forge_pregame_capture.witnesses w on w.claim_id = c.id;
end $$;

-- Retains the verifier's witness. The database checks what it can: the statement names exactly the committed
-- bytes, game and policy; its digest is computed here; the upper bound is gen_time + accuracy; the read that the
-- statement attests followed the commit and preceded now; a qualified acknowledgement is at or before T-60.
-- The RFC 3161 signature itself is verified by the verifier and re-verifiable offline from the stored token.
create function public.forge_pregame_capture_record_witness_v1(
  p_claim_id uuid, p_statement_text text, p_tsa_token_base64 text, p_tsa_gen_time timestamptz, p_tsa_accuracy_us bigint,
  p_tsa_accuracy_source text, p_tsa_signer_sha256 text, p_ack_upper timestamptz, p_db_read_at timestamptz,
  p_verdict text, p_verdict_reason text)
returns timestamptz
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  recorded timestamptz;
  bound record;
  statement jsonb := p_statement_text::jsonb;
begin
  select a.raw_sha256, a.canonical_sha256, a.inserted_at, a.xmin::text as row_version, c.ack_deadline, c.game_id, c.policy_id into bound
  from forge_pregame_capture.artifacts a join forge_pregame_capture.claims c on c.id = a.claim_id where a.claim_id = p_claim_id;
  if not found then raise exception 'capture_artifact_missing' using errcode = 'P0002'; end if;
  if statement->>'claimId' is distinct from p_claim_id::text or statement->>'rawSha256' is distinct from bound.raw_sha256
     or statement->>'canonicalSha256' is distinct from bound.canonical_sha256 or statement->>'rowVersion' is distinct from bound.row_version
     or statement->>'gameId' is distinct from bound.game_id::text or statement->>'policyId' is distinct from bound.policy_id then
    raise exception 'capture_witness_binding' using errcode = '22023';
  end if;
  if (statement->>'dbReadAt')::timestamptz is distinct from p_db_read_at
     or p_db_read_at < bound.inserted_at or p_db_read_at > clock_timestamp() then
    raise exception 'capture_witness_read_order' using errcode = '22023';
  end if;
  if p_verdict = 'qualified' and p_ack_upper > bound.ack_deadline then
    raise exception 'capture_witness_late' using errcode = '22023';
  end if;
  insert into forge_pregame_capture.witnesses (claim_id, statement_text, statement, statement_sha256, tsa_token, tsa_gen_time,
    tsa_accuracy_us, tsa_accuracy_source, tsa_signer_sha256, ack_upper, db_read_at, verdict, verdict_reason)
  values (p_claim_id, p_statement_text, statement, pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_statement_text, 'UTF8')), 'hex'),
    pg_catalog.decode(p_tsa_token_base64, 'base64'), p_tsa_gen_time, p_tsa_accuracy_us, p_tsa_accuracy_source, p_tsa_signer_sha256,
    p_ack_upper, p_db_read_at, p_verdict, p_verdict_reason)
  returning recorded_at into recorded;
  return recorded;
end $$;

-- Exactly one terminal outcome per (game, policy), consistent with the claim's state under the claim lock:
--   never_dispatched  no claim exists;
--   source_failed     no artifact (a fence is set so none can appear later);
--   save_unknown      no artifact (fenced likewise);
--   saved_without_valid_witness  an artifact exists and no qualified witness;
--   qualified         a qualified witness exists.
create function public.forge_pregame_capture_record_outcome_v1(p_game_id bigint, p_policy_id text, p_claim_id uuid, p_outcome text, p_metadata jsonb)
returns timestamptz
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  recorded timestamptz;
  has_artifact boolean;
  verdict text;
begin
  perform forge_pregame_capture.lock_key(p_game_id, p_policy_id);
  if p_claim_id is null then
    if p_outcome <> 'never_dispatched' then raise exception 'capture_outcome_needs_claim' using errcode = '22023'; end if;
    if exists (select 1 from forge_pregame_capture.claims c where c.game_id = p_game_id and c.policy_id = p_policy_id) then
      raise exception 'capture_outcome_claim_exists' using errcode = '22023';
    end if;
  else
    perform 1 from forge_pregame_capture.claims c where c.id = p_claim_id and c.game_id = p_game_id and c.policy_id = p_policy_id for update;
    if not found then raise exception 'capture_outcome_binding' using errcode = '22023'; end if;
    has_artifact := exists (select 1 from forge_pregame_capture.artifacts a where a.claim_id = p_claim_id);
    select w.verdict into verdict from forge_pregame_capture.witnesses w where w.claim_id = p_claim_id;
    if (p_outcome = 'qualified' and verdict is distinct from 'qualified')
       or (p_outcome = 'saved_without_valid_witness' and (not has_artifact or verdict = 'qualified'))
       or (p_outcome in ('source_failed', 'save_unknown') and has_artifact)
       or p_outcome = 'never_dispatched' then
      raise exception 'capture_outcome_state' using errcode = '22023';
    end if;
    if p_outcome in ('source_failed', 'save_unknown') then
      insert into forge_pregame_capture.save_fences (claim_id) values (p_claim_id) on conflict on constraint save_fences_pkey do nothing;
    end if;
  end if;
  insert into forge_pregame_capture.outcomes (game_id, policy_id, claim_id, outcome, metadata)
  values (p_game_id, p_policy_id, p_claim_id, p_outcome, coalesce(p_metadata, '{}'::jsonb))
  returning recorded_at into recorded;
  return recorded;
end $$;

-- Closes claims whose runner died: past ack_deadline + grace with no outcome. Skips a claim whose row lock is
-- held (a save still in flight); a later sweep takes it. Never touches a claim that already has an outcome.
create function public.forge_pregame_capture_sweep_v1(p_grace_seconds integer, p_limit integer)
returns table (claim_id uuid, game_id bigint, policy_id text, outcome text)
language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  c record;
  has_artifact boolean;
  verdict text;
  chosen text;
begin
  if p_grace_seconds is null or p_grace_seconds < 60 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'capture_sweep_bounds' using errcode = '22023';
  end if;
  for c in
    select k.id, k.game_id, k.policy_id from forge_pregame_capture.claims k
    where k.ack_deadline + make_interval(secs => p_grace_seconds) < clock_timestamp()
      and not exists (select 1 from forge_pregame_capture.outcomes o where o.claim_id = k.id)
    order by k.ack_deadline, k.id
    limit p_limit
    for update skip locked
  loop
    perform forge_pregame_capture.lock_key(c.game_id, c.policy_id);
    continue when exists (select 1 from forge_pregame_capture.outcomes o where o.game_id = c.game_id and o.policy_id = c.policy_id);
    has_artifact := exists (select 1 from forge_pregame_capture.artifacts a where a.claim_id = c.id);
    select w.verdict into verdict from forge_pregame_capture.witnesses w where w.claim_id = c.id;
    if verdict = 'qualified' then chosen := 'qualified';
    elsif has_artifact then chosen := 'saved_without_valid_witness';
    else
      insert into forge_pregame_capture.save_fences (claim_id) values (c.id) on conflict on constraint save_fences_pkey do nothing;
      chosen := 'save_unknown';
    end if;
    insert into forge_pregame_capture.outcomes (game_id, policy_id, claim_id, outcome, metadata)
    values (c.game_id, c.policy_id, c.id, chosen, pg_catalog.jsonb_build_object('reason', 'swept_orphaned_claim', 'witness', verdict));
    claim_id := c.id; game_id := c.game_id; policy_id := c.policy_id; outcome := chosen;
    return next;
  end loop;
end $$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'public.forge_pregame_capture_claim_v1(bigint, text, date, smallint, smallint, text, timestamptz, integer, text)',
    'public.forge_pregame_capture_save_v1(uuid, text, text, text)',
    'public.forge_pregame_capture_settle_v1(uuid)',
    'public.forge_pregame_capture_read_v1(uuid)',
    'public.forge_pregame_capture_lookup_v1(bigint, text)',
    'public.forge_pregame_capture_record_witness_v1(uuid, text, text, timestamptz, bigint, text, text, timestamptz, timestamptz, text, text)',
    'public.forge_pregame_capture_record_outcome_v1(bigint, text, uuid, text, jsonb)',
    'public.forge_pregame_capture_sweep_v1(integer, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end $$;
