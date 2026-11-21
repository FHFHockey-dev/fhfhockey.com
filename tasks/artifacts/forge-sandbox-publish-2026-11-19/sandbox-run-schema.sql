-- Written in source names; sandbox_bootstrap.py renames public → forge_sandbox and forge_pregame_capture → forge_sandbox_capture.
-- Production's nhl_team_data carries season_id, which the released RSO daily bridge filters on. The fixture shape came
-- from the candidate's reads and lacks it; add it with the fixture's one season so the released reader sees real rows.
alter table public.nhl_team_data add column if not exists season_id integer;
update public.nhl_team_data set season_id = 20262027 where season_id is null;

-- One single-use run for fixture game 2099020991: capture, one publication from that claim, both RSO readers.
-- A duplicate begin inserts nothing and returns the stored receipt, so a second request can never publish.
create table forge_pregame_capture.sandbox_runs (
  game_id bigint primary key references public.games(id) check (game_id = 2099020991),
  code_version text not null check (code_version ~ '^[a-f0-9]{40}$'),
  began_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  elapsed_ms integer check (elapsed_ms >= 0),
  outcome text check (outcome in ('succeeded', 'failed', 'unresolved')),
  reason text,
  claim_id uuid references forge_pregame_capture.claims(id),
  revision_id uuid,
  readers jsonb check (readers is null or octet_length(readers::text) <= 4000),
  summary jsonb check (summary is null or octet_length(summary::text) <= 8000)
);
alter table forge_pregame_capture.sandbox_runs enable row level security;
revoke all on forge_pregame_capture.sandbox_runs from public, anon, authenticated, service_role;

create function forge_pregame_capture.sandbox_receipt_v1(p_game bigint) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('gameId', s.game_id, 'release', s.code_version, 'beganAt', s.began_at, 'finishedAt', s.finished_at,
    'dbElapsedMs', round(extract(epoch from s.finished_at - s.began_at) * 1000), 'appElapsedMs', s.elapsed_ms,
    'outcome', s.outcome, 'reason', s.reason, 'claim', s.claim_id, 'custody', o.outcome, 'witness', w.verdict,
    'witnessReason', w.verdict_reason, 'tokenSha256', w.tsa_token_sha256, 'tsaGenTime', w.tsa_gen_time,
    'packetSha256', a.raw_sha256, 'canonicalSha256', a.canonical_sha256, 'packetBytes', a.byte_length,
    'inputCutoff', c.input_cutoff, 'revisionId', s.revision_id, 'committedRevision', p.revision_id,
    'publishedAt', g.published_at, 'publicationCount', (select count(*) from forge_pregame_capture.publications p2
      join forge_pregame_capture.claims c2 on c2.id = p2.claim_id where c2.game_id = s.game_id),
    'readers', s.readers, 'summary', s.summary,
    'claims', (select count(*) from forge_pregame_capture.claims c3 where c3.game_id = s.game_id))
  from forge_pregame_capture.sandbox_runs s
  left join forge_pregame_capture.claims c on c.id = s.claim_id
  left join forge_pregame_capture.artifacts a on a.claim_id = s.claim_id
  left join forge_pregame_capture.witnesses w on w.claim_id = s.claim_id
  left join forge_pregame_capture.outcomes o on o.claim_id = s.claim_id
  left join forge_pregame_capture.publications p on p.claim_id = s.claim_id
  left join public.forge_game_revisions g on g.id = p.revision_id
  where s.game_id = p_game
$$;

create function public.forge_sandbox_run_begin_v1(p_game_id bigint, p_code_version text)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare game record; inserted bigint;
begin
  if p_game_id is distinct from 2099020991 or p_code_version !~ '^[a-f0-9]{40}$' then raise exception 'sandbox_scope_refused'; end if;
  insert into forge_pregame_capture.sandbox_runs (game_id, code_version) values (p_game_id, p_code_version)
    on conflict (game_id) do nothing returning game_id into inserted;
  if inserted is null then
    return jsonb_build_object('status', 'duplicate', 'receipt', forge_pregame_capture.sandbox_receipt_v1(p_game_id));
  end if;
  select g.date, g."startTime", g."seasonId" into game from public.games g where g.id = p_game_id;
  return jsonb_build_object('status', 'started', 'gameId', p_game_id, 'slateDate', game.date, 'scheduledStart', game."startTime",
    'seasonId', game."seasonId");
end $$;

-- Success is decided here from committed rows: qualified custody, exactly one committed publication of this claim,
-- and both readers bound to that claim and revision. The application's report is only checked against them.
create function public.forge_sandbox_run_finish_v1(p_game_id bigint, p_code_version text, p_reason text, p_claim_id uuid,
  p_revision_id uuid, p_readers jsonb, p_summary jsonb, p_elapsed_ms integer)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare s forge_pregame_capture.sandbox_runs; verdict text; why text := p_reason;
begin
  select * into s from forge_pregame_capture.sandbox_runs where game_id = p_game_id for update;
  if not found or s.code_version is distinct from p_code_version then raise exception 'sandbox_run_missing'; end if;
  if s.finished_at is not null then return forge_pregame_capture.sandbox_receipt_v1(p_game_id); end if;
  if (p_readers is not null and (jsonb_typeof(p_readers) <> 'object' or octet_length(p_readers::text) > 4000))
    or (p_summary is not null and (jsonb_typeof(p_summary) <> 'object' or octet_length(p_summary::text) > 8000)) then
    raise exception 'invalid_report'; end if;
  if why is null and (p_claim_id is null or p_revision_id is null or p_readers is null) then why := 'incomplete_report'; end if;
  if why is null and not exists (select from forge_pregame_capture.claims c
      join forge_pregame_capture.witnesses w on w.claim_id = c.id and w.verdict = 'qualified'
      join forge_pregame_capture.outcomes o on o.claim_id = c.id and o.outcome = 'qualified'
      join forge_pregame_capture.publications p on p.claim_id = c.id and p.revision_id = p_revision_id
      where c.id = p_claim_id and c.game_id = p_game_id and c.code_version = p_code_version) then why := 'publication_not_committed'; end if;
  if why is null and (select count(*) from forge_pregame_capture.publications p join forge_pregame_capture.claims c on c.id = p.claim_id
      where c.game_id = p_game_id) <> 1 then why := 'publication_count'; end if;
  if why is null and (p_readers->'daily'->>'selectedRun' is distinct from p_claim_id::text
      or p_readers->'daily'->>'revisionId' is distinct from 'forge-daily-bridge-v1:' || p_claim_id::text
      or p_readers->'daily'->>'reason' is not null or p_readers->'daily'->>'legalSlot' is distinct from 'C#1'
      or jsonb_typeof(p_readers->'daily'->'points') is distinct from 'number'
      or p_readers->'detailed'->>'selectedRun' is distinct from p_claim_id::text
      or p_readers->'detailed'->>'revisionId' is distinct from p_revision_id::text
      or p_readers->'daily'->>'playerId' is distinct from p_readers->'detailed'->>'playerId'
      or (p_readers->'detailed'->>'reason' is null and p_readers->'detailed'->>'legalSlot' is distinct from 'C#1')
      or (p_readers->'detailed'->>'reason' is not null and (p_readers->'detailed'->>'reason' not in ('missing_participation', 'use_not_approved')
        or p_readers->'detailed'->>'points' is not null or p_readers->'detailed'->>'legalSlot' is not null))) then
    why := 'reader_lineage_mismatch'; end if;
  verdict := case when why is null then 'succeeded'
    when why in ('capture_unconfirmed', 'statement_timeout', 'publication_unconfirmed', 'run_deadline') then 'unresolved' else 'failed' end;
  update forge_pregame_capture.sandbox_runs set finished_at = clock_timestamp(), elapsed_ms = p_elapsed_ms, outcome = verdict,
    reason = coalesce(why, 'readers_recorded'), claim_id = p_claim_id, revision_id = p_revision_id, readers = p_readers, summary = p_summary
    where game_id = p_game_id;
  return forge_pregame_capture.sandbox_receipt_v1(p_game_id);
end $$;

revoke all on function forge_pregame_capture.sandbox_receipt_v1(bigint) from public, anon, authenticated, service_role;
revoke all on function public.forge_sandbox_run_begin_v1(bigint, text),
  public.forge_sandbox_run_finish_v1(bigint, text, text, uuid, uuid, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.forge_sandbox_run_begin_v1(bigint, text),
  public.forge_sandbox_run_finish_v1(bigint, text, text, uuid, uuid, jsonb, jsonb, integer) to service_role;
