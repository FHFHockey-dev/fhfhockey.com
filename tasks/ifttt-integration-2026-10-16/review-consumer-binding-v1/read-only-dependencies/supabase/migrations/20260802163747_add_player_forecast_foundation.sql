begin;

set lock_timeout = '5s';
set statement_timeout = '60s';

create schema if not exists fhfh_internal;
revoke all on schema fhfh_internal from public, anon, authenticated, service_role;

create table public.player_forecast_schedule_revisions (
  id uuid primary key default gen_random_uuid(),
  game_id bigint not null references public.games(id),
  season_id bigint not null,
  scheduled_start_at timestamptz not null,
  game_date date not null,
  home_team_id bigint not null references public.teams(id),
  away_team_id bigint not null references public.teams(id),
  game_status text not null default 'scheduled'
    check (game_status in ('scheduled', 'postponed', 'cancelled', 'started', 'final')),
  source text not null,
  source_revision_key text not null,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  supersedes_id uuid references public.player_forecast_schedule_revisions(id),
  payload_hash text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source, source_revision_key, payload_hash),
  check (available_at >= observed_at),
  check (btrim(source) <> '' and btrim(source_revision_key) <> '' and btrim(payload_hash) <> '')
);

create table public.player_forecast_source_observations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  dataset_key text not null,
  entity_kind text not null,
  entity_key text not null,
  source_url text,
  source_revision_key text,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  payload_hash text not null,
  payload jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, dataset_key, entity_key, payload_hash),
  check (available_at >= observed_at),
  check (
    btrim(provider) <> '' and btrim(dataset_key) <> ''
    and btrim(entity_kind) <> '' and btrim(entity_key) <> ''
    and btrim(payload_hash) <> ''
  )
);

create table public.player_forecast_goalie_start_observations (
  id uuid primary key default gen_random_uuid(),
  game_id bigint not null references public.games(id),
  team_id bigint not null references public.teams(id),
  player_id bigint references public.players(id),
  raw_player_name text,
  observation_status text not null
    check (observation_status in ('confirmed', 'likely', 'projected', 'unconfirmed', 'ruled_out')),
  confidence numeric(6,5) check (confidence is null or confidence between 0 and 1),
  raw_status text,
  source_group text not null,
  source_key text not null,
  source_account text,
  source_capture_key text references public.line_source_snapshots(capture_key),
  source_url text,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  expires_at timestamptz,
  supersedes_id uuid references public.player_forecast_goalie_start_observations(id),
  parser_version text not null,
  accepted boolean not null default true,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (player_id is not null or nullif(btrim(raw_player_name), '') is not null),
  check (available_at >= observed_at),
  check (expires_at is null or expires_at > available_at)
);

create table public.player_forecast_lineup_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_id bigint not null references public.games(id),
  team_id bigint not null references public.teams(id),
  source_group text not null,
  source_key text not null,
  source_account text,
  source_capture_key text not null references public.line_source_snapshots(capture_key),
  source_url text,
  classification text not null
    check (classification in ('lineup', 'practice_lines', 'power_play', 'injury')),
  observed_at timestamptz not null,
  available_at timestamptz not null,
  expires_at timestamptz,
  completeness numeric(6,5) not null default 0 check (completeness between 0 and 1),
  accepted boolean not null default true,
  rejection_reason text,
  parser_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_capture_key, team_id),
  check (available_at >= observed_at),
  check (expires_at is null or expires_at > available_at)
);

create table public.player_forecast_lineup_assignments (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.player_forecast_lineup_snapshots(id),
  player_id bigint references public.players(id),
  raw_player_name text,
  unit_type text not null
    check (unit_type in ('forward_line', 'defense_pair', 'power_play', 'penalty_kill', 'goalie_order', 'scratch', 'injury')),
  unit_number smallint check (unit_number is null or unit_number between 1 and 10),
  slot_number smallint check (slot_number is null or slot_number between 1 and 10),
  assignment_status text not null default 'observed'
    check (assignment_status in ('observed', 'projected', 'confirmed', 'ruled_out')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (player_id is not null or nullif(btrim(raw_player_name), '') is not null),
  unique nulls not distinct (snapshot_id, unit_type, unit_number, slot_number, player_id, raw_player_name)
);

create table public.player_forecast_observation_conflicts (
  id uuid primary key default gen_random_uuid(),
  conflict_key text not null,
  conflict_version integer not null check (conflict_version > 0),
  conflict_type text not null check (conflict_type in ('goalie_start', 'lineup', 'identity', 'schedule')),
  game_id bigint references public.games(id),
  team_id bigint references public.teams(id),
  player_id bigint references public.players(id),
  detected_at timestamptz not null,
  source_high_watermark timestamptz not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (conflict_key, conflict_version),
  check (btrim(conflict_key) <> '' and btrim(summary) <> '')
);

create table public.player_forecast_conflict_members (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.player_forecast_observation_conflicts(id),
  observation_type text not null check (observation_type in ('goalie_start', 'lineup', 'schedule')),
  observation_id uuid not null,
  position smallint not null default 1 check (position > 0),
  created_at timestamptz not null default now(),
  unique (conflict_id, observation_type, observation_id)
);

create table public.player_forecast_conflict_resolutions (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.player_forecast_observation_conflicts(id),
  resolution_version integer not null check (resolution_version > 0),
  action text not null check (action in ('select_observation', 'accept_mixture', 'dismiss', 'supersede')),
  selected_observation_type text,
  selected_observation_id uuid,
  resolved_by uuid,
  resolver_email text,
  note text,
  resolved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (conflict_id, resolution_version),
  check (
    (action = 'select_observation' and selected_observation_type is not null and selected_observation_id is not null)
    or action <> 'select_observation'
  )
);

create table public.player_forecast_feature_snapshots (
  id uuid primary key default gen_random_uuid(),
  content_hash text not null unique,
  game_id bigint not null references public.games(id),
  team_id bigint not null references public.teams(id),
  player_id bigint not null references public.players(id),
  population text not null check (population in ('forward', 'defense', 'goalie')),
  team_game_horizon smallint not null check (team_game_horizon between 1 and 10),
  cutoff_at timestamptz not null,
  feature_schema_version text not null,
  source_high_watermark timestamptz not null,
  features jsonb not null,
  missingness jsonb not null default '{}'::jsonb,
  fallback_flags text[] not null default '{}'::text[],
  source_manifest jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (btrim(content_hash) <> '' and btrim(feature_schema_version) <> '')
);

create table public.player_forecast_model_artifacts (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  model_version text not null,
  feature_schema_version text not null,
  calibration_version text,
  population text not null check (population in ('forward', 'defense', 'goalie', 'availability', 'opportunity')),
  target_keys text[] not null,
  horizon_min smallint not null check (horizon_min between 1 and 10),
  horizon_max smallint not null check (horizon_max between horizon_min and 10),
  artifact_uri text not null,
  artifact_checksum text not null,
  training_cutoff_at timestamptz not null,
  code_version text not null,
  lifecycle_status text not null default 'candidate'
    check (lifecycle_status in ('candidate', 'shadow', 'production', 'retired', 'rejected')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (model_key, model_version, feature_schema_version, artifact_checksum),
  check (btrim(model_key) <> '' and btrim(model_version) <> '' and btrim(artifact_uri) <> '' and btrim(artifact_checksum) <> '')
);

create table public.player_forecast_inference_queue (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null unique,
  game_id bigint references public.games(id),
  team_id bigint references public.teams(id),
  team_game_horizon smallint check (team_game_horizon is null or team_game_horizon between 1 and 10),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  first_enqueued_at timestamptz not null,
  last_observed_at timestamptz not null,
  not_before timestamptz not null,
  source_high_watermark timestamptz not null,
  claimed_watermark timestamptz,
  processed_watermark timestamptz,
  lease_owner uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(scope_key) <> ''),
  check (
    (status = 'running' and lease_owner is not null and lease_expires_at is not null and claimed_watermark is not null)
    or status <> 'running'
  )
);

create table public.player_forecast_runs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  queue_id uuid references public.player_forecast_inference_queue(id),
  game_id bigint not null references public.games(id),
  team_id bigint not null references public.teams(id),
  team_game_horizon smallint not null check (team_game_horizon between 1 and 10),
  model_artifact_id uuid references public.player_forecast_model_artifacts(id),
  run_kind text not null check (run_kind in ('canonical_daily', 'event_reissue', 'retry', 'backtest')),
  release_channel text not null default 'shadow' check (release_channel in ('shadow', 'candidate', 'production')),
  status text not null check (status in ('running', 'succeeded', 'failed', 'research_blocked')),
  cutoff_at timestamptz not null,
  issued_at timestamptz,
  source_high_watermark timestamptz not null,
  feature_schema_version text,
  code_version text not null,
  research_gate text,
  degraded boolean not null default false,
  degraded_reasons text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (btrim(idempotency_key) <> '' and btrim(code_version) <> '')
);

create table public.player_forecast_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.player_forecast_runs(id),
  feature_snapshot_id uuid not null references public.player_forecast_feature_snapshots(id),
  game_id bigint not null references public.games(id),
  team_id bigint not null references public.teams(id),
  player_id bigint not null references public.players(id),
  population text not null check (population in ('forward', 'defense', 'goalie')),
  target_key text not null,
  conditioning text not null check (conditioning in ('playing_probability', 'start_probability', 'conditional_playing', 'conditional_start', 'unconditional')),
  team_game_horizon smallint not null check (team_game_horizon between 1 and 10),
  point_estimate numeric,
  probability numeric check (probability is null or probability between 0 and 1),
  distribution_kind text,
  distribution jsonb,
  quantiles jsonb,
  source_high_watermark timestamptz not null,
  fallback_flags text[] not null default '{}'::text[],
  issued_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (run_id, player_id, target_key, conditioning),
  check (btrim(target_key) <> ''),
  check (point_estimate is not null or probability is not null or distribution is not null or quantiles is not null)
);

create table public.player_forecast_outcome_revisions (
  id uuid primary key default gen_random_uuid(),
  game_id bigint not null references public.games(id),
  player_id bigint not null references public.players(id),
  target_key text not null,
  target_version text not null,
  outcome_value numeric,
  outcome_payload jsonb not null default '{}'::jsonb,
  source text not null,
  source_revision_key text not null,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  finality text not null check (finality in ('provisional', 'final', 'corrected')),
  supersedes_id uuid references public.player_forecast_outcome_revisions(id),
  created_at timestamptz not null default now(),
  unique (game_id, player_id, target_key, target_version, source_revision_key),
  check (available_at >= observed_at)
);

create table public.player_forecast_evaluation_revisions (
  id uuid primary key default gen_random_uuid(),
  forecast_output_id uuid not null references public.player_forecast_outputs(id),
  outcome_revision_id uuid not null references public.player_forecast_outcome_revisions(id),
  scoring_version text not null,
  settlement_status text not null check (settlement_status in ('provisional', 'final', 'corrected')),
  evaluated_at timestamptz not null,
  metrics jsonb not null,
  baseline_metrics jsonb not null default '{}'::jsonb,
  composite_skill_score numeric check (composite_skill_score is null or composite_skill_score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (forecast_output_id, outcome_revision_id, scoring_version)
);

create table public.player_forecast_accountability_revisions (
  id uuid primary key default gen_random_uuid(),
  slate_date date not null,
  checkpoint_key text not null,
  checkpoint_order integer not null check (checkpoint_order >= 0),
  model_artifact_id uuid not null references public.player_forecast_model_artifacts(id),
  scoring_version text not null,
  settlement_status text not null check (settlement_status in ('provisional', 'final', 'corrected')),
  evaluated_forecasts integer not null check (evaluated_forecasts > 0),
  composite_skill_score numeric not null check (composite_skill_score between 0 and 100),
  metrics jsonb not null,
  baseline_metrics jsonb not null,
  evaluated_at timestamptz not null,
  supersedes_id uuid references public.player_forecast_accountability_revisions(id),
  created_at timestamptz not null default now(),
  unique (slate_date, checkpoint_key, model_artifact_id, scoring_version, evaluated_at),
  check (btrim(checkpoint_key) <> '' and btrim(scoring_version) <> '')
);

create table public.player_forecast_champion_history (
  id uuid primary key default gen_random_uuid(),
  applicability_key text not null,
  model_artifact_id uuid not null references public.player_forecast_model_artifacts(id),
  action text not null check (action in ('promote', 'rollback', 'retire')),
  effective_at timestamptz not null,
  ended_at timestamptz,
  approved_by uuid,
  approval_note text,
  evidence jsonb not null,
  created_at timestamptz not null default now(),
  check (btrim(applicability_key) <> ''),
  check (ended_at is null or ended_at > effective_at)
);

create unique index player_forecast_champion_one_active_idx
  on public.player_forecast_champion_history (applicability_key)
  where ended_at is null and action in ('promote', 'rollback');

create index player_forecast_goalie_observations_lookup_idx
  on public.player_forecast_goalie_start_observations (game_id, team_id, available_at desc);
create unique index player_forecast_goalie_observations_capture_player_idx
  on public.player_forecast_goalie_start_observations (
    source_capture_key,
    team_id,
    coalesce(player_id, 0),
    coalesce(raw_player_name, '')
  );
create index player_forecast_source_observations_lookup_idx
  on public.player_forecast_source_observations (provider, dataset_key, entity_key, available_at desc);
create index player_forecast_lineup_snapshots_lookup_idx
  on public.player_forecast_lineup_snapshots (game_id, team_id, available_at desc);
create index player_forecast_lineup_assignments_player_idx
  on public.player_forecast_lineup_assignments (player_id, snapshot_id);
create index player_forecast_conflicts_lookup_idx
  on public.player_forecast_observation_conflicts (detected_at desc, conflict_type, game_id, team_id);
create index player_forecast_conflict_resolutions_lookup_idx
  on public.player_forecast_conflict_resolutions (conflict_id, resolution_version desc);
create index player_forecast_feature_snapshots_lookup_idx
  on public.player_forecast_feature_snapshots (game_id, team_id, player_id, cutoff_at desc);
create index player_forecast_queue_due_idx
  on public.player_forecast_inference_queue (status, not_before, lease_expires_at);
create index player_forecast_runs_lookup_idx
  on public.player_forecast_runs (game_id, team_id, team_game_horizon, cutoff_at desc);
create index player_forecast_outputs_history_idx
  on public.player_forecast_outputs (player_id, game_id, target_key, conditioning, issued_at);
create index player_forecast_outcomes_lookup_idx
  on public.player_forecast_outcome_revisions (game_id, player_id, target_key, available_at desc);
create index player_forecast_evaluations_lookup_idx
  on public.player_forecast_evaluation_revisions (evaluated_at desc, settlement_status);
create index player_forecast_accountability_lookup_idx
  on public.player_forecast_accountability_revisions (slate_date desc, checkpoint_order, evaluated_at desc);

create or replace function fhfh_internal.reject_player_forecast_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'PLAYER_FORECAST_IMMUTABLE_RECORD';
end;
$$;

revoke all on function fhfh_internal.reject_player_forecast_mutation()
  from public, anon, authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'player_forecast_schedule_revisions',
    'player_forecast_source_observations',
    'player_forecast_goalie_start_observations',
    'player_forecast_lineup_snapshots',
    'player_forecast_lineup_assignments',
    'player_forecast_observation_conflicts',
    'player_forecast_conflict_members',
    'player_forecast_conflict_resolutions',
    'player_forecast_feature_snapshots',
    'player_forecast_model_artifacts',
    'player_forecast_outputs',
    'player_forecast_outcome_revisions',
    'player_forecast_evaluation_revisions',
    'player_forecast_accountability_revisions'
  ] loop
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function fhfh_internal.reject_player_forecast_mutation()',
      table_name || '_immutable',
      table_name
    );
  end loop;
end
$$;

create or replace function public.enqueue_player_forecast_job(
  p_scope_key text,
  p_game_id bigint,
  p_team_id bigint,
  p_team_game_horizon smallint,
  p_reason text,
  p_observed_at timestamptz,
  p_not_before timestamptz,
  p_metadata jsonb default '{}'::jsonb
) returns public.player_forecast_inference_queue
language plpgsql
security invoker
set search_path = ''
as $$
declare
  queued public.player_forecast_inference_queue;
begin
  if nullif(pg_catalog.btrim(p_scope_key), '') is null
    or nullif(pg_catalog.btrim(p_reason), '') is null
    or p_observed_at is null
    or p_not_before is null
  then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_QUEUE_INVALID_ARGUMENT';
  end if;

  insert into public.player_forecast_inference_queue as queue (
    scope_key, game_id, team_id, team_game_horizon, reason, status,
    first_enqueued_at, last_observed_at, not_before, source_high_watermark,
    metadata, updated_at
  ) values (
    p_scope_key, p_game_id, p_team_id, p_team_game_horizon, p_reason, 'pending',
    p_observed_at, p_observed_at, p_not_before, p_observed_at,
    coalesce(p_metadata, '{}'::jsonb), now()
  )
  on conflict (scope_key) do update
  set game_id = excluded.game_id,
      team_id = excluded.team_id,
      team_game_horizon = coalesce(excluded.team_game_horizon, queue.team_game_horizon),
      reason = excluded.reason,
      status = case when queue.status = 'running' then queue.status else 'pending' end,
      first_enqueued_at = least(queue.first_enqueued_at, excluded.first_enqueued_at),
      last_observed_at = greatest(queue.last_observed_at, excluded.last_observed_at),
      not_before = greatest(queue.not_before, excluded.not_before),
      source_high_watermark = greatest(queue.source_high_watermark, excluded.source_high_watermark),
      last_error = null,
      metadata = queue.metadata || excluded.metadata,
      updated_at = now()
  returning * into queued;

  return queued;
end;
$$;

create or replace function fhfh_internal.enqueue_player_forecast_observation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  scheduled_game public.games;
  target_game record;
  source_key text;
  reason text;
  trigger_metadata jsonb;
  team_wide boolean := false;
begin
  if not new.accepted then
    return new;
  end if;

  select * into scheduled_game
  from public.games
  where id = new.game_id
    and type = 2;

  -- Evidence remains immutable after puck drop, but it must never trigger a forecast.
  if scheduled_game.id is null or scheduled_game."startTime" <= new.available_at then
    return new;
  end if;

  source_key := new.source_key;
  if tg_table_name = 'player_forecast_goalie_start_observations' then
    reason := 'source:' || source_key || ':goalie_start';
  else
    reason := 'source:' || source_key || ':' || new.classification;
    team_wide := new.classification = 'injury';
  end if;
  trigger_metadata := pg_catalog.jsonb_build_object(
    'queueSource', 'normalized_observation_trigger',
    'observationTable', tg_table_name,
    'observationId', new.id,
    'sourceCaptureKey', new.source_capture_key
  );

  if team_wide then
    for target_game in
      select
        candidate.id as game_id,
        pg_catalog.row_number() over (
          order by candidate."startTime", candidate.id
        )::smallint as team_game_horizon
      from public.games as candidate
      where candidate.type = 2
        and candidate."startTime" > new.available_at
        and (
          candidate."homeTeamId" = new.team_id
          or candidate."awayTeamId" = new.team_id
        )
      order by candidate."startTime", candidate.id
      limit 10
    loop
      perform public.enqueue_player_forecast_job(
        'game:' || target_game.game_id || ':team:' || new.team_id,
        target_game.game_id,
        new.team_id,
        target_game.team_game_horizon,
        reason,
        new.available_at,
        new.available_at + interval '5 minutes',
        trigger_metadata || '{"teamWide":true}'::jsonb
      );
    end loop;
  else
    perform public.enqueue_player_forecast_job(
      'game:' || new.game_id || ':team:' || new.team_id,
      new.game_id,
      new.team_id,
      null,
      reason,
      new.available_at,
      new.available_at + interval '5 minutes',
      trigger_metadata
    );
  end if;

  return new;
end;
$$;

revoke all on function fhfh_internal.enqueue_player_forecast_observation()
  from public, anon, authenticated, service_role;

create trigger player_forecast_goalie_observation_enqueue
after insert on public.player_forecast_goalie_start_observations
for each row execute function fhfh_internal.enqueue_player_forecast_observation();

create trigger player_forecast_lineup_observation_enqueue
after insert on public.player_forecast_lineup_snapshots
for each row execute function fhfh_internal.enqueue_player_forecast_observation();

create or replace function public.claim_player_forecast_jobs(
  p_owner_token uuid,
  p_limit integer default 8,
  p_lease_seconds integer default 240
) returns setof public.player_forecast_inference_queue
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_owner_token is null or p_limit not between 1 and 50 or p_lease_seconds not between 30 and 800 then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_CLAIM_INVALID_ARGUMENT';
  end if;

  return query
  with claimable as (
    select queue.id
    from public.player_forecast_inference_queue as queue
    where queue.not_before <= now()
      and (
        queue.status in ('pending', 'failed')
        or (queue.status = 'running' and queue.lease_expires_at <= now())
      )
    order by queue.not_before, queue.first_enqueued_at
    for update skip locked
    limit p_limit
  )
  update public.player_forecast_inference_queue as queue
  set status = 'running',
      lease_owner = p_owner_token,
      lease_expires_at = now() + pg_catalog.make_interval(secs => p_lease_seconds),
      claimed_watermark = queue.source_high_watermark,
      attempt_count = queue.attempt_count + 1,
      last_error = null,
      updated_at = now()
  from claimable
  where queue.id = claimable.id
  returning queue.*;
end;
$$;

create or replace function public.finish_player_forecast_job(
  p_job_id uuid,
  p_owner_token uuid,
  p_succeeded boolean,
  p_error text default null
) returns public.player_forecast_inference_queue
language plpgsql
security invoker
set search_path = ''
as $$
declare
  finished public.player_forecast_inference_queue;
begin
  update public.player_forecast_inference_queue as queue
  set status = case
        when queue.source_high_watermark > queue.claimed_watermark then 'pending'
        when p_succeeded then 'succeeded'
        else 'failed'
      end,
      not_before = case
        when queue.source_high_watermark > queue.claimed_watermark then now() + interval '5 minutes'
        when not p_succeeded then now() + interval '5 minutes'
        else queue.not_before
      end,
      processed_watermark = case when p_succeeded then queue.claimed_watermark else queue.processed_watermark end,
      lease_owner = null,
      lease_expires_at = null,
      claimed_watermark = null,
      last_error = case when p_succeeded then null else left(coalesce(p_error, 'unknown failure'), 2000) end,
      updated_at = now()
  where queue.id = p_job_id
    and queue.status = 'running'
    and queue.lease_owner = p_owner_token
    and queue.lease_expires_at > now()
  returning queue.* into finished;

  if finished.id is null then
    raise exception using errcode = 'P0002', message = 'PLAYER_FORECAST_JOB_LEASE_NOT_FOUND';
  end if;
  return finished;
end;
$$;

create or replace function public.promote_player_forecast_model_atomic(
  p_applicability_key text,
  p_model_artifact_id uuid,
  p_approved_by uuid,
  p_approval_note text,
  p_evidence jsonb,
  p_effective_at timestamptz default now()
) returns public.player_forecast_champion_history
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate public.player_forecast_model_artifacts;
  promoted public.player_forecast_champion_history;
begin
  if nullif(pg_catalog.btrim(p_applicability_key), '') is null
    or p_model_artifact_id is null
    or p_approved_by is null
    or p_evidence is null
    or p_evidence = '{}'::jsonb
  then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_PROMOTION_EVIDENCE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fhfh:player-forecast-promotion:' || p_applicability_key, 0)
  );

  select * into candidate
  from public.player_forecast_model_artifacts
  where id = p_model_artifact_id
    and lifecycle_status = 'shadow';
  if candidate.id is null then
    raise exception using errcode = 'P0002', message = 'PLAYER_FORECAST_SHADOW_ARTIFACT_NOT_FOUND';
  end if;

  update public.player_forecast_champion_history
  set ended_at = p_effective_at
  where applicability_key = p_applicability_key
    and ended_at is null
    and action in ('promote', 'rollback');

  insert into public.player_forecast_champion_history (
    applicability_key, model_artifact_id, action, effective_at,
    approved_by, approval_note, evidence
  ) values (
    p_applicability_key, p_model_artifact_id, 'promote', p_effective_at,
    p_approved_by, p_approval_note, p_evidence
  ) returning * into promoted;

  return promoted;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'player_forecast_schedule_revisions',
    'player_forecast_source_observations',
    'player_forecast_goalie_start_observations',
    'player_forecast_lineup_snapshots',
    'player_forecast_lineup_assignments',
    'player_forecast_observation_conflicts',
    'player_forecast_conflict_members',
    'player_forecast_conflict_resolutions',
    'player_forecast_feature_snapshots',
    'player_forecast_model_artifacts',
    'player_forecast_inference_queue',
    'player_forecast_runs',
    'player_forecast_outputs',
    'player_forecast_outcome_revisions',
    'player_forecast_evaluation_revisions',
    'player_forecast_accountability_revisions',
    'player_forecast_champion_history'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
  end loop;
end
$$;

grant select, insert on table
  public.player_forecast_schedule_revisions,
  public.player_forecast_source_observations,
  public.player_forecast_goalie_start_observations,
  public.player_forecast_lineup_snapshots,
  public.player_forecast_lineup_assignments,
  public.player_forecast_observation_conflicts,
  public.player_forecast_conflict_members,
  public.player_forecast_conflict_resolutions,
  public.player_forecast_feature_snapshots,
  public.player_forecast_model_artifacts,
  public.player_forecast_outputs,
  public.player_forecast_outcome_revisions,
  public.player_forecast_evaluation_revisions,
  public.player_forecast_accountability_revisions,
  public.player_forecast_champion_history
to service_role;

grant select, insert, update on table
  public.player_forecast_inference_queue,
  public.player_forecast_runs
to service_role;

revoke all on function public.enqueue_player_forecast_job(text, bigint, bigint, smallint, text, timestamptz, timestamptz, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_player_forecast_job(text, bigint, bigint, smallint, text, timestamptz, timestamptz, jsonb)
  to service_role;
revoke all on function public.claim_player_forecast_jobs(uuid, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_player_forecast_jobs(uuid, integer, integer)
  to service_role;
revoke all on function public.finish_player_forecast_job(uuid, uuid, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.finish_player_forecast_job(uuid, uuid, boolean, text)
  to service_role;
revoke all on function public.promote_player_forecast_model_atomic(text, uuid, uuid, text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.promote_player_forecast_model_atomic(text, uuid, uuid, text, jsonb, timestamptz)
  to service_role;

comment on table public.player_forecast_goalie_start_observations is
  'Immutable source-attributed goalie-start evidence. Model outputs do not belong in this table.';
comment on table public.player_forecast_lineup_snapshots is
  'Immutable normalized headers for prospective lineup, deployment, and injury observations.';
comment on table public.player_forecast_inference_queue is
  'Five-minute coalescing queue with source watermarks and expiring worker leases.';
comment on table public.player_forecast_outputs is
  'Immutable raw-hockey forecast vintages. Target and distribution semantics are versioned by the approved research contract.';

create or replace function fhfh_internal.invoke_player_forecast_endpoint(p_path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  request_id bigint;
begin
  if p_path is null or p_path !~ '^/api/v1/player-forecasts/jobs/' then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_CRON_PATH_INVALID';
  end if;
  select pg_catalog.min(ds.decrypted_secret)
    into base_url
  from vault.decrypted_secrets as ds
  where ds.name = 'site_url';
  base_url := pg_catalog.rtrim(
    coalesce(nullif(pg_catalog.btrim(base_url), ''), 'https://fhfhockey.com'),
    '/'
  );

  select net.http_post(
    url := base_url || p_path,
    headers := fhfh_internal.require_cron_request_headers(),
    timeout_milliseconds := 240000
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function fhfh_internal.invoke_player_forecast_endpoint(text)
  from public, anon, authenticated, service_role;

do $$
declare
  existing_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise notice 'player forecast cron registration skipped because pg_cron is unavailable';
    return;
  end if;

  for existing_job_id in
    select jobid from cron.job where jobname in (
      'player-forecasts-daily-seed',
      'player-forecasts-queue-drain',
      'player-forecasts-settlement'
    )
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'player-forecasts-daily-seed',
    '0 10 * * *',
    $job$select fhfh_internal.invoke_player_forecast_endpoint('/api/v1/player-forecasts/jobs/daily')$job$
  );
  perform cron.schedule(
    'player-forecasts-queue-drain',
    '* * * * *',
    $job$select fhfh_internal.invoke_player_forecast_endpoint('/api/v1/player-forecasts/jobs/drain?dryRun=true')$job$
  );
  perform cron.schedule(
    'player-forecasts-settlement',
    '20 * * * *',
    $job$select fhfh_internal.invoke_player_forecast_endpoint('/api/v1/player-forecasts/jobs/settle')$job$
  );
end
$$;

reset lock_timeout;
reset statement_timeout;

commit;
