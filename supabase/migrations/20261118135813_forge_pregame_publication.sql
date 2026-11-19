begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- This links the published output to immutable private input custody without copying packet bytes.
create table forge_pregame_capture.publications (
  claim_id uuid primary key references forge_pregame_capture.claims(id),
  code_version text not null,
  raw_sha256 text not null,
  canonical_sha256 text not null,
  request_sha256 text not null,
  revision_id uuid not null unique references public.forge_game_revisions(id),
  writer_xid xid8 not null default pg_current_xact_id()
);
alter table forge_pregame_capture.publications enable row level security;
revoke all on forge_pregame_capture.publications from public, anon, authenticated, service_role;
create trigger publications_immutable before update or delete on forge_pregame_capture.publications
  for each row execute function forge_pregame_capture.reject_mutation();
create trigger publications_no_truncate before truncate on forge_pregame_capture.publications
  for each statement execute function forge_pregame_capture.reject_mutation();
alter table forge_pregame_capture.publications enable always trigger publications_immutable;
alter table forge_pregame_capture.publications enable always trigger publications_no_truncate;

-- Keep the pregame fence until transaction end, including a caller that delays COMMIT after the RPC returns.
create function forge_pregame_capture.check_publication_before_commit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from forge_pregame_capture.claims c
    join public.games g on g.id = c.game_id and g.date = c.slate_date and g."startTime" = c.scheduled_start
      and g."homeTeamId" = c.home_team_id and g."awayTeamId" = c.away_team_id
    where c.id = new.claim_id and clock_timestamp() < c.scheduled_start
  ) then raise exception 'pregame_publication_not_pregame' using errcode = '22023'; end if;
  return new;
end $$;
revoke all on function forge_pregame_capture.check_publication_before_commit() from public, anon, authenticated, service_role;
create constraint trigger publications_pregame_commit after insert on forge_pregame_capture.publications
  deferrable initially deferred for each row execute function forge_pregame_capture.check_publication_before_commit();

-- A readback on a subsequent transaction proves the revision was committed by this clock.
-- The receipt remains readable after puck drop. A first observation after puck drop does not authorize serving.
create function public.forge_pregame_publication_receipt_v1(
  p_claim_id uuid, p_code_version text, p_raw_sha256 text, p_canonical_sha256 text
) returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  bound record;
  observed_at timestamptz;
begin
  select p.*, r.input_snapshot_id, r.published_at, c.scheduled_start, c.game_id, c.slate_date,
    c.home_team_id, c.away_team_id
  into bound
  from forge_pregame_capture.publications p
  join public.forge_game_revisions r on r.id = p.revision_id and r.run_id = p.claim_id
  join forge_pregame_capture.claims c on c.id = p.claim_id
  where p.claim_id = p_claim_id;
  if not found then return null; end if;
  if bound.code_version is distinct from p_code_version or bound.raw_sha256 is distinct from p_raw_sha256
    or bound.canonical_sha256 is distinct from p_canonical_sha256 then
    raise exception 'pregame_publication_binding' using errcode = '22023';
  end if;
  if bound.writer_xid = pg_current_xact_id_if_assigned() then
    raise exception 'pregame_publication_uncommitted' using errcode = '55000';
  end if;

  -- Serialize the first observation with duplicate receipts. This updates an existing run's standard timing receipt.
  select (f.metrics->>'succeeded_observed_at')::timestamptz into observed_at
    from public.forge_runs f where f.run_id = p_claim_id and f.status = 'succeeded' for update;
  if not found then raise exception 'pregame_publication_run_missing' using errcode = '55000'; end if;
  if observed_at is null and clock_timestamp() < bound.scheduled_start and exists (
    select 1 from public.games g
    join forge_pregame_capture.hosted_schedule(bound.game_id) schedule on schedule.schedule_state = 'ready'
      and schedule.safe_start = bound.scheduled_start
    where g.id = bound.game_id and g.date = bound.slate_date and g."startTime" = bound.scheduled_start
      and g."homeTeamId" = bound.home_team_id and g."awayTeamId" = bound.away_team_id
  ) then
    observed_at := clock_timestamp();
    if observed_at < bound.scheduled_start and observed_at >= bound.published_at then
      update public.forge_runs f set metrics = f.metrics || jsonb_build_object('succeeded_observed_at', observed_at)
        where f.run_id = p_claim_id;
    else
      observed_at := null;
    end if;
  end if;
  return jsonb_build_object('runId', p_claim_id, 'revisionId', bound.revision_id,
    'inputSnapshotId', bound.input_snapshot_id, 'publishedAt', bound.published_at, 'observedAt', observed_at,
    'alreadyPublished', true);
end $$;

create function public.forge_pregame_publish_v1(
  p_claim_id uuid, p_code_version text, p_raw_sha256 text, p_canonical_sha256 text,
  p_snapshot jsonb, p_metrics jsonb, p_players jsonb, p_teams jsonb, p_goalies jsonb, p_reserves jsonb
) returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  bound record;
  publication record;
  game_season_id bigint;
  context jsonb;
  receipt jsonb;
  candidates jsonb;
  entries jsonb;
  snapshot jsonb;
  metrics jsonb;
  decision_at timestamptz;
  write_at timestamptz;
  game_id_json jsonb;
  player_ids bigint[];
  goalie_ids bigint[];
  reserve_ids bigint[];
  request_hash text;
  snapshot_id uuid;
  revision_id uuid;
  published_at timestamptz;
begin
  if p_claim_id is null or coalesce(p_code_version, '') !~ '^[0-9a-f]{40}$'
    or coalesce(p_raw_sha256, '') !~ '^[0-9a-f]{64}$' or coalesce(p_canonical_sha256, '') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_snapshot) is distinct from 'object' or jsonb_typeof(p_metrics) is distinct from 'object'
    or jsonb_typeof(p_players) is distinct from 'array' or jsonb_typeof(p_teams) is distinct from 'array'
    or jsonb_typeof(p_goalies) is distinct from 'array' or jsonb_typeof(p_reserves) is distinct from 'array' then
    raise exception 'pregame_publication_input' using errcode = '22023';
  end if;
  if pg_column_size(p_snapshot) + pg_column_size(p_metrics) + pg_column_size(p_players) + pg_column_size(p_teams)
      + pg_column_size(p_goalies) + pg_column_size(p_reserves) > 2097152
    or jsonb_array_length(p_players) not between 2 and 100 or jsonb_array_length(p_teams) <> 2
    or jsonb_array_length(p_goalies) > 16 or jsonb_array_length(p_reserves) > 100 then
    raise exception 'pregame_publication_limits' using errcode = '22023';
  end if;

  -- Idempotent by claim, including overlapping calls and retries after the prospective window closes.
  perform pg_advisory_xact_lock(hashtextextended('forge-pregame-publication:' || p_claim_id::text, 0));
  -- Recalculation/row clocks and runtime metrics can differ without changing the authorized forecast.
  select encode(sha256(convert_to(jsonb_build_array(p_snapshot - 'capturedAt', jsonb_object_agg(kind, output))::text, 'UTF8')), 'hex')
    into request_hash
    from (
      select kind, (select coalesce(jsonb_agg(projected order by projected), '[]'::jsonb)
        from (select value - array['created_at','updated_at'] as projected from jsonb_array_elements(rows)) stable_rows) as output
      from (values ('players', p_players), ('teams', p_teams), ('goalies', p_goalies), ('reserves', p_reserves)) batches(kind, rows)
    ) normalized;
  select p.*, r.input_snapshot_id, r.published_at, f.metrics->>'succeeded_observed_at' as observed_at
    into publication
    from forge_pregame_capture.publications p join public.forge_game_revisions r on r.id = p.revision_id
    join public.forge_runs f on f.run_id = r.run_id where p.claim_id = p_claim_id;
  if found then
    if publication.code_version is distinct from p_code_version or publication.raw_sha256 is distinct from p_raw_sha256
      or publication.canonical_sha256 is distinct from p_canonical_sha256
      or publication.request_sha256 is distinct from request_hash then
      raise exception 'pregame_publication_conflict' using errcode = '22023';
    end if;
    return jsonb_build_object('runId', p_claim_id, 'revisionId', publication.revision_id,
      'inputSnapshotId', publication.input_snapshot_id, 'publishedAt', publication.published_at,
      'observedAt', publication.observed_at, 'alreadyPublished', true);
  end if;

  if p_metrics->'games' is distinct from '1'::jsonb or p_metrics->'timed_out' is distinct from 'false'::jsonb
    or p_metrics->'player_rows' is distinct from to_jsonb(jsonb_array_length(p_players))
    or p_metrics->'team_rows' is distinct from to_jsonb(jsonb_array_length(p_teams))
    or p_metrics->'goalie_rows' is distinct from to_jsonb(jsonb_array_length(p_goalies)) then
    raise exception 'pregame_publication_partial_output' using errcode = '22023';
  end if;

  select c.*, greatest(w.ack_upper, w.final_read_at) as custody_at
    into bound
    from forge_pregame_capture.claims c
    join forge_pregame_capture.artifacts a on a.claim_id = c.id
    join forge_pregame_capture.witnesses w on w.claim_id = a.claim_id
    join forge_pregame_capture.outcomes o on o.claim_id = c.id and o.game_id = c.game_id and o.policy_id = c.policy_id
    where c.id = p_claim_id and c.policy_id = 'pregame-native-v1' and c.code_version = p_code_version
      and a.raw_sha256 = p_raw_sha256 and a.canonical_sha256 = p_canonical_sha256
      and w.verdict = 'qualified' and o.outcome = 'qualified'
      and c.claimed_at <= a.inserted_at and a.inserted_at <= w.db_read_at and w.db_read_at <= w.final_read_at
      and w.ack_upper <= c.ack_deadline and w.final_read_at <= c.ack_deadline
      and o.recorded_at <= clock_timestamp()
      and w.statement->>'version' = 'forge-pregame-witness-v1'
      and w.statement->>'claimId' = c.id::text and w.statement->>'gameId' = c.game_id::text
      and w.statement->>'policyId' = c.policy_id and w.statement->>'calendarRevision' = c.calendar_revision
      and (w.statement->>'scheduledStart')::timestamptz = c.scheduled_start
      and (w.statement->>'currentStart')::timestamptz = c.scheduled_start
      and (w.statement->>'dbReadAt')::timestamptz = w.db_read_at
      and (w.statement->>'byteLength')::integer = a.byte_length and w.statement->>'rowVersion' = a.xmin::text
      and w.statement->>'rawSha256' = a.raw_sha256 and w.statement->>'canonicalSha256' = a.canonical_sha256
      and not exists (select 1 from forge_pregame_capture.save_fences f where f.claim_id = c.id);
  if not found then raise exception 'pregame_publication_custody' using errcode = '22023'; end if;

  select g."seasonId" into game_season_id from public.games g
    where g.id = bound.game_id and g.date = bound.slate_date and g."startTime" = bound.scheduled_start
      and g."homeTeamId" = bound.home_team_id and g."awayTeamId" = bound.away_team_id for share;
  if not found or clock_timestamp() >= bound.scheduled_start then
    raise exception 'pregame_publication_not_pregame' using errcode = '22023';
  end if;
  perform 1 from public.roster_optimizer_team_games g
    where g.game_date = bound.slate_date and g.source_game_id = bound.game_id and g.source_season_id = game_season_id
      and g.team_id in (bound.home_team_id, bound.away_team_id) for share;
  if not exists (
    select 1 from forge_pregame_capture.hosted_schedule(bound.game_id) s
    where s.schedule_state = 'ready' and s.safe_start = bound.scheduled_start
  ) then raise exception 'pregame_publication_not_pregame' using errcode = '22023'; end if;

  game_id_json := jsonb_build_array(bound.game_id);
  decision_at := (p_snapshot->>'decisionAsOf')::timestamptz;
  receipt := p_snapshot #> '{inputProvenance,capturedReads}';
  context := p_snapshot #> '{inputProvenance,issuedContexts,0}';
  if p_snapshot ? 'reads' or p_snapshot->>'version' is distinct from 'forge-inputs-v1'
    or p_snapshot->>'replayClassification' is distinct from 'captured_live'
    or p_snapshot->>'runId' is distinct from p_claim_id::text or p_snapshot->>'codeVersion' is distinct from p_code_version
    or p_snapshot->>'slateDate' is distinct from bound.slate_date::text or p_snapshot->'horizonGames' is distinct from '1'::jsonb
    or p_snapshot->'gameIds' is distinct from game_id_json or coalesce(p_snapshot->>'modelMode', '') not in ('baseline', 'candidate')
    or coalesce(p_snapshot->>'outputHash', '') !~ '^[0-9a-f]{64}$'
    or (p_snapshot->>'inputCutoff')::timestamptz is distinct from bound.input_cutoff or decision_at is null
    -- Stated availability includes transport clock tolerance, and so may follow a fast witness.
    or decision_at < bound.input_cutoff or decision_at > least(bound.ack_deadline, clock_timestamp())
    or receipt->>'version' is distinct from 'forge-captured-reads-v1' or coalesce(receipt->>'hash', '') !~ '^[0-9a-f]{64}$'
    or coalesce((receipt->>'readCount')::integer, 0) < 1
    or not coalesce((receipt->>'firstReceivedAt')::timestamptz <= (receipt->>'lastReceivedAt')::timestamptz
      and (receipt->>'lastReceivedAt')::timestamptz <= least(decision_at, bound.custody_at + interval '2 seconds')
      and decision_at - (receipt->>'lastReceivedAt')::timestamptz <= interval '60 seconds', false)
    or jsonb_array_length(p_snapshot #> '{inputProvenance,issuedContexts}') is distinct from 1
    or context->>'version' is distinct from 'forge-issued-context-v1'
    or (context #>> '{game,id}')::bigint is distinct from bound.game_id
    or (context #>> '{game,date}')::date is distinct from bound.slate_date
    or (context #>> '{game,seasonId}')::bigint is distinct from game_season_id
    or (context #>> '{game,homeTeamId}')::smallint is distinct from bound.home_team_id
    or (context #>> '{game,awayTeamId}')::smallint is distinct from bound.away_team_id
    or (context #>> '{game,startTime}')::timestamptz is distinct from bound.scheduled_start
    or jsonb_array_length(context->'schedule') is distinct from 2
    or jsonb_typeof(context->'roster') is distinct from 'array'
    or jsonb_array_length(context->'roster') > 200
    or p_snapshot #>> '{inputProvenance,issuedTargets,outputHash}' is distinct from p_snapshot->>'outputHash'
    or jsonb_typeof(p_snapshot->'goalieStarts') is distinct from 'array'
    or jsonb_array_length(p_snapshot->'goalieStarts') > 32 then
    raise exception 'pregame_publication_snapshot_binding' using errcode = '22023';
  end if;
  if (select encode(sha256(convert_to('[' || string_agg(to_jsonb(s.value->>'revision')::text, ',' order by s.ordinality) || ']', 'UTF8')), 'hex')
    from jsonb_array_elements(context->'schedule') with ordinality s) is distinct from bound.calendar_revision then
    raise exception 'pregame_publication_calendar_binding' using errcode = '22023';
  end if;

  -- The trusted calculator verifies these candidate lists against decompressed, hash-checked custody bytes.
  candidates := p_snapshot->'pregameCandidates';
  foreach entries in array array[candidates->'skaters', candidates->'goalies', candidates->'reserves'] loop
    if jsonb_typeof(entries) is distinct from 'array' or jsonb_array_length(entries) > 100 or exists (
      select 1 from jsonb_array_elements(entries) e(value)
      where jsonb_typeof(e.value) <> 'number' or e.value::text !~ '^[1-9][0-9]{0,15}$'
    ) then raise exception 'pregame_publication_candidates' using errcode = '22023'; end if;
  end loop;
  player_ids := array(select value::bigint from jsonb_array_elements_text(candidates->'skaters'));
  goalie_ids := array(select value::bigint from jsonb_array_elements_text(candidates->'goalies'));
  reserve_ids := array(select value::bigint from jsonb_array_elements_text(candidates->'reserves'));

  if exists (
    select 1 from (
      select v, 'player_id' as id_key, player_ids as ids from jsonb_array_elements(p_players) v
      union all select v, null, null from jsonb_array_elements(p_teams) v
      union all select v, 'goalie_id', goalie_ids from jsonb_array_elements(p_goalies) v
      union all select v, 'player_id', case when v->>'player_class' = 'skater' then reserve_ids else goalie_ids end
        from jsonb_array_elements(p_reserves) v
    ) batches
    where jsonb_typeof(v) <> 'object' or (v->>'game_id')::bigint is distinct from bound.game_id
      or (v->>'as_of_date')::date is distinct from bound.slate_date or v->'horizon_games' is distinct from '1'::jsonb
      or (v ? 'run_id' and v->>'run_id' is distinct from p_claim_id::text)
      or not coalesce(((v->>'team_id')::smallint, (v->>'opponent_team_id')::smallint) in
        ((bound.home_team_id,bound.away_team_id), (bound.away_team_id,bound.home_team_id)), false)
      or (id_key is not null and (not coalesce((v->>id_key)::bigint = any(ids), false) or exists (
        select 1 from jsonb_array_elements(context->'roster') m
        where (m->>'nhlId')::bigint = (v->>id_key)::bigint
          and (m->>'teamId')::smallint is distinct from (v->>'team_id')::smallint
      )))
  ) or (select count(distinct (p->>'team_id')::smallint) from jsonb_array_elements(p_players) p) <> 2
    or (select count(distinct (t->>'team_id')::smallint) from jsonb_array_elements(p_teams) t) <> 2 then
    raise exception 'pregame_publication_output_scope' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_snapshot->'goalieStarts') s
    where (s->>'game_id')::bigint is distinct from bound.game_id
      or not coalesce((s->>'team_id')::smallint in (bound.home_team_id, bound.away_team_id), false)
      or not coalesce((s->>'player_id')::bigint = any(goalie_ids), false)) then
    raise exception 'pregame_publication_goalie_start_scope' using errcode = '22023';
  end if;

  write_at := clock_timestamp();
  if write_at >= bound.scheduled_start then raise exception 'pregame_publication_not_pregame' using errcode = '22023'; end if;
  metrics := (p_metrics - 'succeeded_observed_at') || jsonb_build_object(
    'horizon_games', 1, 'input_cutoff', bound.input_cutoff, 'decision_as_of', decision_at,
    'decision_as_of_by_game', jsonb_build_object(bound.game_id::text, decision_at), 'completed_game_ids', game_id_json,
    'execution_scope', jsonb_build_object('mode', 'selected_games', 'requested_game_ids', game_id_json),
    'pregame_publication', jsonb_build_object('version', 'forge-pregame-publication-v1', 'claim_id', p_claim_id));
  insert into public.forge_runs (run_id, as_of_date, status, git_sha, metrics, created_at, updated_at)
    values (p_claim_id, bound.slate_date, 'succeeded', p_code_version, metrics, write_at, write_at);

  -- Only the real projection columns survive JSON-to-composite conversion. Set nonnull defaults explicitly because
  -- inserting a full composite bypasses the table's defaults even when a normal PostgREST write would use them.
  snapshot := jsonb_build_object('run_id', p_claim_id, 'created_at', write_at, 'updated_at', write_at);
  insert into public.forge_player_projections
    select (jsonb_populate_record(null::public.forge_player_projections, '{"uncertainty":{}}'::jsonb || v || snapshot)).*
    from jsonb_array_elements(p_players) v;
  insert into public.forge_team_projections
    select (jsonb_populate_record(null::public.forge_team_projections, '{"uncertainty":{}}'::jsonb || v || snapshot)).*
    from jsonb_array_elements(p_teams) v;
  insert into public.forge_goalie_projections
    select (jsonb_populate_record(null::public.forge_goalie_projections, '{"uncertainty":{}}'::jsonb || v || snapshot)).*
    from jsonb_array_elements(p_goalies) v;
  insert into public.forge_reserve_projections
    select (jsonb_populate_record(null::public.forge_reserve_projections, '{"uncertainty":{}}'::jsonb || v || snapshot)).*
    from jsonb_array_elements(p_reserves) v;

  write_at := clock_timestamp();
  select jsonb_object_agg(key, value) into snapshot from jsonb_each(p_snapshot)
    where key in ('version', 'runId', 'slateDate', 'decisionAsOf', 'inputCutoff', 'codeVersion', 'modelMode',
      'modelEnvironment', 'seasonBootstrapApplied', 'inputProvenance', 'deterministicSeed', 'dailyBoardEvidence',
      'horizonGames', 'gameIds', 'replayClassification', 'outputHash', 'goalieStarts');
  snapshot := snapshot || jsonb_build_object('capturedAt', write_at, 'snapshotKind', 'qualified_pregame_receipt',
    'inputProvenance', (snapshot->'inputProvenance') || jsonb_build_object('pregameObservationRequired', true));
  -- The private artifact retains canonical packet bytes. This compact receipt uses the declared database digest.
  insert into public.player_forecast_source_observations (provider, dataset_key, entity_kind, entity_key,
    observed_at, available_at, payload_hash, payload, metadata)
  values ('forge', 'forge-run-inputs-v1', 'projection_run', p_claim_id::text, decision_at, write_at,
    encode(sha256(convert_to(snapshot::text, 'UTF8')), 'hex'), snapshot,
    jsonb_build_object('replayClassification', 'captured_live', 'outputHash', snapshot->>'outputHash',
      'payloadHashFormat', 'postgres-jsonb-text-sha256-v1',
      'custodyClaimId', p_claim_id, 'rawSha256', p_raw_sha256, 'canonicalSha256', p_canonical_sha256))
  returning id into snapshot_id;

  if public.publish_forge_game_revisions(p_claim_id, snapshot_id) <> 1 then
    raise exception 'pregame_publication_revision_missing' using errcode = '55000';
  end if;
  select r.id, r.published_at into strict revision_id, published_at from public.forge_game_revisions r
    where r.run_id = p_claim_id and r.game_id = bound.game_id and r.input_snapshot_id = snapshot_id;
  if published_at >= bound.scheduled_start or clock_timestamp() >= bound.scheduled_start then
    raise exception 'pregame_publication_not_pregame' using errcode = '22023';
  end if;
  insert into forge_pregame_capture.publications(claim_id, code_version, raw_sha256, canonical_sha256, request_sha256, revision_id)
    values (p_claim_id, p_code_version, p_raw_sha256, p_canonical_sha256, request_hash, revision_id);
  return jsonb_build_object('runId', p_claim_id, 'revisionId', revision_id, 'inputSnapshotId', snapshot_id,
    'publishedAt', published_at, 'observedAt', null, 'alreadyPublished', false);
end $$;

revoke all on function public.forge_pregame_publish_v1(uuid, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb),
  public.forge_pregame_publication_receipt_v1(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.forge_pregame_publish_v1(uuid, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb),
  public.forge_pregame_publication_receipt_v1(uuid, text, text, text) to service_role;

-- Prefer the committed observation clock for custody-backed revisions. The marker is copied into the immutable
-- revision by the existing writer. A missing run or receipt denies eligibility even when the caller can read revisions.
create view fhfh_internal.visible_forge_game_revisions with (security_invoker = true) as
select r.id, r.run_id, r.game_id, r.slate_date, r.input_snapshot_id, r.decision_as_of,
  case when r.payload #> '{inputProvenance,pregameObservationRequired}' = 'true'::jsonb
    then (f.metrics->>'succeeded_observed_at')::timestamptz else r.published_at end as published_at,
  r.payload
from public.forge_game_revisions r
left join public.forge_runs f on f.run_id = r.run_id
  and r.payload #> '{inputProvenance,pregameObservationRequired}' = 'true'::jsonb
where r.payload #> '{inputProvenance,pregameObservationRequired}' is distinct from 'true'::jsonb
  or (f.status = 'succeeded' and (f.metrics->>'succeeded_observed_at')::timestamptz >= r.published_at);
revoke all on fhfh_internal.visible_forge_game_revisions from public, anon, authenticated;
grant select on fhfh_internal.visible_forge_game_revisions to service_role;

-- Use the same eligible set for the freeze and live reader. Preserve explicit selection across slate dates.
create or replace function fhfh_internal.current_starter_board_revisions(p_date date)
returns setof public.forge_game_revisions language sql stable security invoker set search_path = ''
begin atomic
  select chosen.* from (select distinct game_id from public.forge_game_revisions where slate_date = p_date) slate
  left join lateral (
    select id from fhfh_internal.visible_forge_game_revisions where slate_date = p_date and game_id = slate.game_id
      order by decision_as_of desc, published_at desc, id desc limit 1
  ) latest on true
  left join public.forge_final_pregame_revisions frozen on frozen.game_id = slate.game_id
  left join lateral(select revision_id from public.forge_game_selection_events where game_id = slate.game_id
    order by created_at desc, id desc limit 1) selection on true
  join fhfh_internal.visible_forge_game_revisions chosen on chosen.id = coalesce(frozen.revision_id, selection.revision_id, latest.id);
end;

-- Bind references when defining the SQL functions. The service role can run these existing entry points
-- without name lookup privileges on the internal schema. Underlying SELECT and RLS stay caller-scoped.
create or replace function public.read_forge_game_revisions(p_slate_date date)
returns table(id uuid, run_id uuid, game_id bigint, decision_as_of timestamptz, published_at timestamptz, payload jsonb)
language sql stable security invoker set search_path = ''
begin atomic
  select r.id, r.run_id, r.game_id, r.decision_as_of, r.published_at,
    r.payload || pg_catalog.jsonb_build_object('previousRevision', (
      select pg_catalog.jsonb_build_object('id', p.id, 'codeVersion', p.payload->>'codeVersion', 'modelMode', p.payload->>'modelMode',
        'players', p.payload->'players', 'goalies', p.payload->'goalies')
      from fhfh_internal.visible_forge_game_revisions p where p.game_id = r.game_id and p.slate_date = r.slate_date
        and (p.decision_as_of, p.published_at, p.id) < (r.decision_as_of, r.published_at, r.id)
      order by p.decision_as_of desc, p.published_at desc, p.id desc limit 1))
  from fhfh_internal.current_starter_board_revisions(p_slate_date) r;
end;

create or replace function public.freeze_starter_board_pregame(p_date date)
returns integer language sql security invoker set search_path = ''
begin atomic
  with frozen as (
    insert into public.forge_final_pregame_revisions(game_id, revision_id, scheduled_start_at)
    select r.game_id, r.id, g."startTime" from fhfh_internal.current_starter_board_revisions(p_date) r
    join public.games g on g.id = r.game_id where g."startTime" <= clock_timestamp()
    on conflict(game_id) do nothing returning 1
  ) select count(*)::integer from frozen;
end;
commit;
