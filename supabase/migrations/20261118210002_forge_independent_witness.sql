-- No password, human membership, schedule, approval or connection is provisioned here.
begin;
create role forge_independent_verifier login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 1;
create role forge_named_witness nologin;
create schema forge_witness_api;
revoke all on schema forge_witness_api from public, anon, authenticated, service_role;
grant usage on schema forge_witness_api to forge_independent_verifier, forge_named_witness;

create table forge_pregame_capture.independent_reads (
  claim_id uuid primary key references forge_pregame_capture.claims(id),
  game_id bigint not null unique references forge_pregame_capture.hosted_runs(game_id),
  challenge uuid not null unique default gen_random_uuid(),
  verifier_role name not null, read_at timestamptz not null default clock_timestamp(),
  reader_xid xid8 not null default pg_current_xact_id()
);
create table forge_pregame_capture.independent_checks (
  claim_id uuid primary key references forge_pregame_capture.independent_reads(claim_id),
  verdict text not null check (verdict in ('accepted','rejected')),
  reason text check (reason in ('packet_invalid','packet_binding','statement_binding','token_invalid','timing_invalid')),
  raw_sha256 text not null, canonical_sha256 text not null, token_sha256 text not null,
  checked_at timestamptz not null default clock_timestamp(), writer_xid xid8 not null default pg_current_xact_id(),
  check ((verdict = 'accepted') = (reason is null))
);
-- verified_at is an upper bound on the COMMITTED independent check, observed in a subsequent transaction.
create table forge_pregame_capture.independent_verdicts (
  claim_id uuid primary key references forge_pregame_capture.independent_checks(claim_id),
  game_id bigint not null unique references forge_pregame_capture.hosted_runs(game_id),
  verified_at timestamptz not null, verifier_role name not null,
  verdict text not null check (verdict in ('accepted','rejected')), reason text,
  raw_sha256 text not null, canonical_sha256 text not null, token_sha256 text not null
);
do $$
declare tbl text;
begin
  foreach tbl in array array['independent_reads','independent_checks','independent_verdicts'] loop
    execute format('alter table forge_pregame_capture.%I enable row level security',tbl);
    execute format('revoke all on forge_pregame_capture.%I from public, anon, authenticated, service_role, forge_independent_verifier, forge_named_witness',tbl);
    execute format('create trigger immutable before update or delete on forge_pregame_capture.%I for each row execute function forge_pregame_capture.reject_mutation()',tbl);
    execute format('create trigger no_truncate before truncate on forge_pregame_capture.%I for each statement execute function forge_pregame_capture.reject_mutation()',tbl);
    execute format('alter table forge_pregame_capture.%I enable always trigger immutable',tbl);
    execute format('alter table forge_pregame_capture.%I enable always trigger no_truncate',tbl);
  end loop;
end $$;

-- This role check uses the authenticated session login even inside a SECURITY DEFINER call.
-- A named witness is a separately provisioned, dedicated LOGIN whose only membership is the human group.
create function forge_pregame_capture.independent_scope(p_game bigint, p_sha text)
returns setof forge_pregame_capture.hosted_runs language sql volatile set search_path = '' as $$
  select r.* from forge_pregame_capture.hosted_runs r
  join forge_pregame_capture.claims c on c.id = r.claim_id and c.game_id = r.game_id and c.policy_id = r.policy_id
    and c.code_version = r.expected_code_version and c.scheduled_start = r.scheduled_start
  join public.games g on g.id = c.game_id and g.date = c.slate_date and g."startTime" = c.scheduled_start
    and g."homeTeamId" = c.home_team_id and g."awayTeamId" = c.away_team_id
  join forge_pregame_capture.hosted_schedule(p_game) s on s.schedule_state = 'ready'
    and s.safe_start = r.scheduled_start and s.scheduled_start = r.scheduled_start
  join pg_catalog.pg_roles actor on actor.rolname = session_user
  where r.game_id = p_game and r.expected_code_version = p_sha and r.phase = 'verify'
    and r.policy_id = 'pregame-native-v1' and r.witness_principal = session_user
    and r.armed_at <= r.open_at and c.claimed_at between r.open_at and r.close_at
    and clock_timestamp() between r.open_at and least(r.scheduled_start,s.safe_start) - interval '60 minutes'
    and actor.rolcanlogin and not (actor.rolsuper or actor.rolbypassrls or actor.rolcreaterole
      or actor.rolcreatedb or actor.rolreplication or pg_has_role(session_user,'service_role','member'))
    and not exists (select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles parent on parent.oid = m.roleid
      where m.member = actor.oid and (parent.rolname <> 'forge_named_witness' or m.admin_option))
    and ((r.witness_authority = 'automated' and session_user = 'forge_independent_verifier')
      or (r.witness_authority = 'named_human' and session_user <> 'forge_independent_verifier'
        and pg_has_role(session_user,'forge_named_witness','member')))
    and exists (select 1 from forge_pregame_capture.outcomes o where o.claim_id = c.id
      and o.game_id = c.game_id and o.policy_id = c.policy_id and o.outcome = 'qualified')
    and exists (select 1 from forge_pregame_capture.witnesses w where w.claim_id = c.id and w.verdict = 'qualified')
    and not exists (select 1 from forge_pregame_capture.save_fences f where f.claim_id = c.id)
$$;
revoke all on function forge_pregame_capture.independent_scope(bigint,text) from public, anon, authenticated, service_role;

create function forge_witness_api.independent_read_v1(p_game bigint, p_sha text)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  scope forge_pregame_capture.hosted_runs;
  ticket forge_pregame_capture.independent_reads;
  evidence jsonb;
begin
  perform 1 from forge_pregame_capture.hosted_runs where game_id = p_game and phase = 'verify' for share;
  select * into scope from forge_pregame_capture.independent_scope(p_game,p_sha);
  if not found or not forge_pregame_capture.hosted_load_open() then return null; end if;
  insert into forge_pregame_capture.independent_reads(claim_id,game_id,verifier_role)
    values(scope.claim_id,p_game,session_user) on conflict do nothing returning * into ticket;
  if not found then return null; end if;
  select to_jsonb(e) || jsonb_build_object(
    'challenge',ticket.challenge,'expected_sha',scope.expected_code_version,'open_at',scope.open_at,
    'witness_read_at',w.db_read_at,'final_read_at',w.final_read_at,'ack_upper',w.ack_upper,
    'tsa_gen_time',w.tsa_gen_time,'tsa_signer_sha256',w.tsa_signer_sha256,'tsa_token_sha256',w.tsa_token_sha256,
    'tsa_accuracy_us',w.tsa_accuracy_us,'tsa_resolution_us',w.tsa_resolution_us,'tsa_accuracy_source',w.tsa_accuracy_source,
    'statement_sha256',w.statement_sha256,'home_abbrev',h.abbreviation,'away_abbrev',a.abbreviation)
    into strict evidence from public.forge_pregame_capture_read_v1(scope.claim_id) e
    join forge_pregame_capture.witnesses w on w.claim_id = e.claim_id
    join public.teams h on h.id = e.home_team_id join public.teams a on a.id = e.away_team_id;
  return evidence;
end $$;

create function forge_witness_api.independent_append_v1(
  p_challenge uuid, p_verdict text, p_reason text, p_raw text, p_canonical text, p_token text)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  ticket forge_pregame_capture.independent_reads;
  scope forge_pregame_capture.hosted_runs;
begin
  select * into strict ticket from forge_pregame_capture.independent_reads
    where challenge = p_challenge and verifier_role = session_user and reader_xid <> pg_current_xact_id()
      and clock_timestamp() between read_at and read_at + interval '90 seconds';
  perform 1 from forge_pregame_capture.hosted_runs where game_id = ticket.game_id and phase = 'verify' for share;
  select s.* into strict scope from forge_pregame_capture.hosted_runs r
    cross join lateral forge_pregame_capture.independent_scope(r.game_id,r.expected_code_version) s
    where r.game_id = ticket.game_id and s.claim_id = ticket.claim_id;
  if not exists (select 1 from forge_pregame_capture.artifacts a join forge_pregame_capture.witnesses w using(claim_id)
    where a.claim_id = ticket.claim_id and a.raw_sha256 = p_raw and a.canonical_sha256 = p_canonical
      and w.tsa_token_sha256 = p_token and (p_verdict = 'rejected' or
        (a.inserted_at <= w.db_read_at and w.db_read_at <= w.final_read_at and w.final_read_at <= ticket.read_at
         and greatest(w.ack_upper,w.final_read_at) <= scope.scheduled_start - interval '60 minutes'))) then
    raise exception 'independent_evidence_binding' using errcode = '22023';
  end if;
  insert into forge_pregame_capture.independent_checks(claim_id,verdict,reason,raw_sha256,canonical_sha256,token_sha256)
    values(ticket.claim_id,p_verdict,p_reason,p_raw,p_canonical,p_token);
end $$;

create function forge_witness_api.independent_confirm_v1(p_game bigint, p_sha text)
returns text language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  scope forge_pregame_capture.hosted_runs;
  at_time timestamptz;
  result text;
begin
  perform 1 from forge_pregame_capture.hosted_runs where game_id = p_game and phase = 'verify' for share;
  select * into scope from forge_pregame_capture.independent_scope(p_game,p_sha);
  if not found then return 'idle'; end if;
  at_time := clock_timestamp();
  insert into forge_pregame_capture.independent_verdicts
    (claim_id,game_id,verified_at,verifier_role,verdict,reason,raw_sha256,canonical_sha256,token_sha256)
    select k.claim_id,p_game,at_time,d.verifier_role,k.verdict,k.reason,k.raw_sha256,k.canonical_sha256,k.token_sha256
    from forge_pregame_capture.independent_checks k join forge_pregame_capture.independent_reads d using(claim_id)
    where k.claim_id = scope.claim_id and k.writer_xid <> pg_current_xact_id() and d.verifier_role = session_user
      and at_time between k.checked_at and least(d.read_at + interval '90 seconds',scope.scheduled_start - interval '60 minutes')
    on conflict (claim_id) do nothing;
  select v.verdict into result from forge_pregame_capture.independent_verdicts v
    where v.claim_id = scope.claim_id and v.verifier_role = session_user;
  return coalesce(result,'idle');
end $$;
revoke all on all functions in schema forge_witness_api from public, anon, authenticated, service_role;
grant execute on all functions in schema forge_witness_api to forge_independent_verifier, forge_named_witness;
commit;
