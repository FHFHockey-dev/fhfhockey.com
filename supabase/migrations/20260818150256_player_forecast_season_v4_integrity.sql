begin;

set lock_timeout = '5s';
set statement_timeout = '120s';

create table public.player_forecast_season_roster_observations (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  fhfh_player_id bigint references public.fhfh_player_identities(id),
  nhl_player_id bigint,
  raw_player_name text not null,
  observation_kind text not null check (
    observation_kind in (
      'official_roster',
      'player_landing',
      'official_transaction',
      'trusted_ifttt'
    )
  ),
  event_type text not null check (
    event_type in (
      'membership',
      'signing',
      'trade',
      'waiver',
      'release',
      'affiliate_assignment',
      'injury',
      'unknown'
    )
  ),
  organization_team_id smallint references public.teams(id),
  roster_status text not null check (
    roster_status in (
      'active_nhl',
      'injured_nhl',
      'affiliate',
      'prospect_reserve',
      'unsigned',
      'unresolved'
    )
  ),
  source_key text not null,
  source_url text,
  source_hash text not null,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  effective_at timestamptz,
  confidence numeric(6,5) not null check (confidence between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  supersedes_id uuid references public.player_forecast_season_roster_observations(id),
  created_at timestamptz not null default now(),
  unique (season_id, observation_kind, source_key, source_hash),
  check (nhl_player_id is not null or fhfh_player_id is not null),
  check (available_at >= observed_at),
  check (source_hash ~ '^[0-9a-f]{64}$'),
  check (btrim(raw_player_name) <> '' and btrim(source_key) <> ''),
  check (source_url is null or btrim(source_url) <> ''),
  check (jsonb_typeof(evidence) = 'object')
);

create index player_forecast_season_roster_observations_player_idx
  on public.player_forecast_season_roster_observations (
    season_id,
    fhfh_player_id,
    available_at desc
  );

create index player_forecast_season_roster_observations_nhl_idx
  on public.player_forecast_season_roster_observations (
    season_id,
    nhl_player_id,
    available_at desc
  ) where nhl_player_id is not null;

create table public.player_forecast_season_roster_conflicts (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  conflict_key text not null,
  fhfh_player_id bigint references public.fhfh_player_identities(id),
  nhl_player_id bigint,
  conflict_type text not null check (
    conflict_type in ('single_source', 'team_disagreement', 'status_disagreement')
  ),
  candidate_team_ids smallint[] not null default '{}',
  summary text not null,
  detected_at timestamptz not null,
  supersedes_id uuid references public.player_forecast_season_roster_conflicts(id),
  created_at timestamptz not null default now(),
  unique (season_id, conflict_key),
  check (nhl_player_id is not null or fhfh_player_id is not null),
  check (btrim(conflict_key) <> '' and btrim(summary) <> '')
);

create index player_forecast_season_roster_conflicts_player_idx
  on public.player_forecast_season_roster_conflicts (
    season_id,
    fhfh_player_id,
    detected_at desc
  );

create table public.player_forecast_season_roster_conflict_members (
  conflict_id uuid not null references public.player_forecast_season_roster_conflicts(id),
  observation_id uuid not null references public.player_forecast_season_roster_observations(id),
  created_at timestamptz not null default now(),
  primary key (conflict_id, observation_id)
);

create table public.player_forecast_season_roster_conflict_resolutions (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.player_forecast_season_roster_conflicts(id),
  resolution_action text not null check (
    resolution_action in (
      'select_team',
      'mark_unsigned',
      'retain_current',
      'exclude_evidence',
      'automatic_consensus'
    )
  ),
  organization_team_id smallint references public.teams(id),
  roster_status text not null check (
    roster_status in (
      'active_nhl',
      'injured_nhl',
      'affiliate',
      'prospect_reserve',
      'unsigned',
      'unresolved'
    )
  ),
  reason text not null,
  created_by uuid,
  supersedes_id uuid references public.player_forecast_season_roster_conflict_resolutions(id),
  created_at timestamptz not null default now(),
  check (btrim(reason) <> ''),
  check (
    (resolution_action = 'select_team' and organization_team_id is not null)
    or resolution_action <> 'select_team'
  ),
  check (
    (resolution_action = 'automatic_consensus' and created_by is null)
    or (resolution_action <> 'automatic_consensus' and created_by is not null)
  )
);

create index player_forecast_season_roster_conflict_resolutions_conflict_idx
  on public.player_forecast_season_roster_conflict_resolutions (
    conflict_id,
    created_at desc
  );

alter table public.player_forecast_season_roster_members
  add column roster_status text not null default 'unresolved' check (
    roster_status in (
      'active_nhl',
      'injured_nhl',
      'affiliate',
      'prospect_reserve',
      'unsigned',
      'unresolved'
    )
  ),
  add column resolved_observation_ids uuid[] not null default '{}',
  add column source_fresh_at timestamptz;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class rel on rel.oid = con.conrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = rel.relnamespace
  where namespace.nspname = 'public'
    and rel.relname = 'player_forecast_season_roster_members'
    and con.contype = 'c'
    and pg_catalog.pg_get_constraintdef(con.oid) like '%team_id IS DISTINCT FROM previous_team_id%';
  if constraint_name is not null then
    execute pg_catalog.format(
      'alter table public.player_forecast_season_roster_members drop constraint %I',
      constraint_name
    );
  end if;
end
$$;

alter table public.player_forecast_season_roster_members
  add constraint player_forecast_season_roster_members_previous_team_check
  check (previous_team_id is null or team_id is distinct from previous_team_id);

alter table public.player_forecast_season_releases
  add column metric_set_version text not null default 'core-v3',
  add column roster_observed_at timestamptz,
  add column transaction_cutoff_at timestamptz,
  add column health_status text not null default 'unknown' check (
    health_status in ('healthy', 'held', 'stale', 'unknown')
  ),
  add column health_summary jsonb not null default '{}'::jsonb check (
    jsonb_typeof(health_summary) = 'object'
  );

alter table public.player_forecast_season_release_players
  add column roster_status text not null default 'unresolved' check (
    roster_status in (
      'active_nhl',
      'injured_nhl',
      'affiliate',
      'prospect_reserve',
      'unsigned',
      'unresolved'
    )
  ),
  add column source_fresh_at timestamptz,
  add column rookie_profile jsonb not null default '{}'::jsonb check (
    jsonb_typeof(rookie_profile) = 'object'
  );

alter table public.player_forecast_season_player_aggregates
  add column roster_status text not null default 'unresolved' check (
    roster_status in (
      'active_nhl',
      'injured_nhl',
      'affiliate',
      'prospect_reserve',
      'unsigned',
      'unresolved'
    )
  ),
  add column source_fresh_at timestamptz,
  add column rookie_profile jsonb not null default '{}'::jsonb check (
    jsonb_typeof(rookie_profile) = 'object'
  );

create or replace function public.apply_player_forecast_season_roster_snapshot(
  p_season_id bigint,
  p_source text,
  p_observed_at timestamptz,
  p_available_at timestamptz,
  p_completeness numeric,
  p_revision_hash text,
  p_source_manifest jsonb,
  p_metadata jsonb,
  p_members jsonb
) returns public.player_forecast_season_roster_snapshots
language plpgsql
security invoker
set search_path = ''
as $$
declare
  snapshot public.player_forecast_season_roster_snapshots;
  member record;
  lifecycle text;
  organization_type text;
  changed_member_count integer;
begin
  if p_season_id is null
    or nullif(pg_catalog.btrim(p_source), '') is null
    or p_observed_at is null
    or p_available_at is null
    or p_available_at < p_observed_at
    or p_completeness not between 0 and 1
    or p_revision_hash !~ '^[0-9a-f]{64}$'
    or pg_catalog.jsonb_typeof(p_source_manifest) <> 'array'
    or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
    or pg_catalog.jsonb_typeof(p_members) <> 'array'
  then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_SEASON_ROSTER_SNAPSHOT_INVALID_ARGUMENT';
  end if;

  insert into public.player_forecast_season_roster_snapshots (
    season_id, source, observed_at, available_at, completeness,
    revision_hash, source_manifest, metadata
  ) values (
    p_season_id, p_source, p_observed_at, p_available_at, p_completeness,
    p_revision_hash, p_source_manifest, p_metadata || '{"suppressEnqueue":true}'::jsonb
  ) on conflict (season_id, revision_hash) do nothing
  returning * into snapshot;

  if snapshot.id is null then
    select * into snapshot
    from public.player_forecast_season_roster_snapshots
    where season_id = p_season_id and revision_hash = p_revision_hash;
    return snapshot;
  end if;

  insert into public.player_forecast_season_roster_members (
    snapshot_id, fhfh_player_id, team_id, previous_team_id, position,
    pool_status, roster_status, roster_confidence, prior_based,
    resolved_observation_ids, source_fresh_at, source_provenance
  )
  select snapshot.id, row_data.fhfh_player_id, row_data.team_id,
         row_data.previous_team_id, row_data.position, row_data.pool_status,
         row_data.roster_status, row_data.roster_confidence,
         row_data.prior_based,
         coalesce(row_data.resolved_observation_ids, '{}'::uuid[]),
         row_data.source_fresh_at, coalesce(row_data.source_provenance, '{}'::jsonb)
  from pg_catalog.jsonb_to_recordset(p_members) as row_data(
    fhfh_player_id bigint,
    team_id smallint,
    previous_team_id smallint,
    position text,
    pool_status text,
    roster_status text,
    roster_confidence numeric,
    prior_based boolean,
    resolved_observation_ids uuid[],
    source_fresh_at timestamptz,
    source_provenance jsonb
  );

  select count(*) into changed_member_count
  from public.player_forecast_season_roster_members
  where snapshot_id = snapshot.id
    and coalesce((source_provenance->>'changed')::boolean, false);

  for member in
    select *
    from public.player_forecast_season_roster_members
    where snapshot_id = snapshot.id
      and (
        coalesce((source_provenance->>'automaticConsensus')::boolean, false)
        or coalesce((source_provenance->>'approvedResolution')::boolean, false)
      )
  loop
    lifecycle := case member.roster_status
      when 'active_nhl' then 'active_nhl'
      when 'injured_nhl' then 'active_nhl'
      when 'unsigned' then 'unsigned_relevant'
      else 'active_prospect'
    end;
    organization_type := case member.roster_status
      when 'active_nhl' then 'nhl'
      when 'injured_nhl' then 'nhl'
      when 'affiliate' then 'ahl'
      when 'unsigned' then 'unsigned'
      else 'unknown'
    end;

    update public.fhfh_player_identities
    set current_nhl_team_id = member.team_id,
        current_organization_type = organization_type,
        lifecycle_status = lifecycle,
        source_provenance = source_provenance || pg_catalog.jsonb_build_object(
          'seasonRosterResolver', pg_catalog.jsonb_build_object(
            'seasonId', p_season_id,
            'snapshotId', snapshot.id,
            'resolvedObservationIds', member.resolved_observation_ids,
            'resolvedAt', p_available_at
          )
        ),
        updated_at = now()
    where id = member.fhfh_player_id;

    if coalesce((member.source_provenance->>'changed')::boolean, false)
      and changed_member_count <= 128
    then
      perform public.enqueue_player_forecast_season_job(
        'season:' || p_season_id || ':view:current:roster:player:' || member.fhfh_player_id,
        p_season_id, 'current', member.team_id, member.previous_team_id,
        member.fhfh_player_id, 'roster_membership_changed', p_available_at,
        null, pg_catalog.jsonb_build_object(
          'rosterSnapshotId', snapshot.id,
          'newTeamId', member.team_id,
          'previousTeamId', member.previous_team_id
        )
      );
      perform public.enqueue_player_forecast_season_job(
        'season:' || p_season_id || ':view:ros:roster:player:' || member.fhfh_player_id,
        p_season_id, 'ros', member.team_id, member.previous_team_id,
        member.fhfh_player_id, 'roster_membership_changed', p_available_at,
        null, pg_catalog.jsonb_build_object(
          'rosterSnapshotId', snapshot.id,
          'newTeamId', member.team_id,
          'previousTeamId', member.previous_team_id
        )
      );
    end if;
  end loop;

  if changed_member_count > 128 then
    perform public.enqueue_player_forecast_season_job(
      'season:' || p_season_id || ':view:current:roster:bulk',
      p_season_id, 'current', null, null, null,
      'roster_snapshot_bulk_change', p_available_at, null,
      pg_catalog.jsonb_build_object(
        'rosterSnapshotId', snapshot.id,
        'changedPlayers', changed_member_count,
        'allLeague', true
      )
    );
    perform public.enqueue_player_forecast_season_job(
      'season:' || p_season_id || ':view:ros:roster:bulk',
      p_season_id, 'ros', null, null, null,
      'roster_snapshot_bulk_change', p_available_at, null,
      pg_catalog.jsonb_build_object(
        'rosterSnapshotId', snapshot.id,
        'changedPlayers', changed_member_count,
        'allLeague', true
      )
    );
  end if;

  return snapshot;
end;
$$;

create or replace function public.latest_player_forecast_season_roster_observations(
  p_season_id bigint
) returns table (
  id uuid,
  fhfh_player_id bigint,
  nhl_player_id bigint,
  raw_player_name text,
  observation_kind text,
  event_type text,
  organization_team_id smallint,
  roster_status text,
  source_key text,
  source_url text,
  source_hash text,
  observed_at timestamptz,
  available_at timestamptz,
  effective_at timestamptz,
  confidence numeric,
  evidence jsonb,
  supersedes_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (
    coalesce(observation.fhfh_player_id, -observation.nhl_player_id),
    observation.observation_kind
  )
    observation.id,
    observation.fhfh_player_id,
    observation.nhl_player_id,
    observation.raw_player_name,
    observation.observation_kind,
    observation.event_type,
    observation.organization_team_id,
    observation.roster_status,
    observation.source_key,
    observation.source_url,
    observation.source_hash,
    observation.observed_at,
    observation.available_at,
    observation.effective_at,
    observation.confidence,
    observation.evidence,
    observation.supersedes_id
  from public.player_forecast_season_roster_observations observation
  where observation.season_id = p_season_id
    and not exists (
      select 1
      from public.player_forecast_season_roster_observations newer
      where newer.supersedes_id = observation.id
    )
  order by
    coalesce(observation.fhfh_player_id, -observation.nhl_player_id),
    observation.observation_kind,
    observation.available_at desc,
    observation.id desc;
$$;

create or replace function public.clone_player_forecast_season_run(
  p_source_run_id uuid,
  p_idempotency_key text
) returns public.player_forecast_season_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_run public.player_forecast_season_runs;
  cloned public.player_forecast_season_runs;
begin
  if nullif(pg_catalog.btrim(p_idempotency_key), '') is null then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_SEASON_CLONE_INVALID_ARGUMENT';
  end if;
  select * into source_run
  from public.player_forecast_season_runs
  where id = p_source_run_id and status = 'validated';
  if source_run.id is null then
    raise exception using errcode = 'P0002', message = 'PLAYER_FORECAST_SEASON_VALIDATED_SOURCE_NOT_FOUND';
  end if;

  insert into public.player_forecast_season_runs (
    idempotency_key, season_id, view_key, run_kind, status, artifact_id,
    roster_snapshot_id, schedule_snapshot_id, cutoff_at, source_high_watermark,
    contract_version, contract_checksum, deterministic_hash
  ) values (
    p_idempotency_key, source_run.season_id, source_run.view_key, 'editorial', 'draft',
    source_run.artifact_id, source_run.roster_snapshot_id, source_run.schedule_snapshot_id,
    source_run.cutoff_at, source_run.source_high_watermark, source_run.contract_version,
    source_run.contract_checksum, source_run.deterministic_hash
  ) returning * into cloned;

  insert into public.player_forecast_season_game_outputs (
    run_id, schedule_game_id, fhfh_player_id, team_id, opponent_team_id,
    population, playing_probability, start_probability, conditional_means,
    unconditional_means, baseline_unconditional_means, variances, quantiles,
    deployment, fallback_flags, component_hash
  )
  select cloned.id, schedule_game_id, fhfh_player_id, team_id, opponent_team_id,
         population, playing_probability, start_probability, conditional_means,
         unconditional_means, baseline_unconditional_means, variances, quantiles,
         deployment, fallback_flags, component_hash
  from public.player_forecast_season_game_outputs
  where run_id = source_run.id;

  insert into public.player_forecast_season_player_aggregates (
    run_id, fhfh_player_id, team_id, player_name, position, population, pool_status,
    roster_status, roster_confidence, source_fresh_at, rookie_profile,
    expected_games, expected_starts, expected_toi, ratings, deployment,
    model_means, p10, p50, p90, component_manifest, fallback_flags,
    provenance, aggregate_hash
  )
  select cloned.id, fhfh_player_id, team_id, player_name, position, population,
         pool_status, roster_status, roster_confidence, source_fresh_at,
         rookie_profile, expected_games, expected_starts, expected_toi, ratings,
         deployment, model_means, p10, p50, p90, component_manifest,
         fallback_flags, provenance, aggregate_hash
  from public.player_forecast_season_player_aggregates
  where run_id = source_run.id;

  insert into public.player_forecast_season_team_aggregates (
    run_id, team_id, team_name, abbreviation, ratings, deployment, roster_counts,
    schedule_neutral_goal_differential, confidence, provenance, aggregate_hash
  )
  select cloned.id, team_id, team_name, abbreviation, ratings, deployment,
         roster_counts, schedule_neutral_goal_differential, confidence,
         provenance, aggregate_hash
  from public.player_forecast_season_team_aggregates
  where run_id = source_run.id;

  return cloned;
end;
$$;

create or replace function public.create_player_forecast_season_event_run(
  p_source_run_id uuid,
  p_roster_snapshot_id uuid,
  p_schedule_snapshot_id uuid,
  p_cutoff_at timestamptz,
  p_source_high_watermark timestamptz,
  p_idempotency_key text,
  p_affected_player_ids bigint[],
  p_affected_team_ids smallint[]
) returns public.player_forecast_season_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_run public.player_forecast_season_runs;
  event_run public.player_forecast_season_runs;
  roster_season bigint;
  schedule_season bigint;
begin
  if nullif(pg_catalog.btrim(p_idempotency_key), '') is null
    or p_cutoff_at is null
    or p_source_high_watermark is null
    or p_affected_player_ids is null
    or p_affected_team_ids is null
  then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_SEASON_EVENT_RUN_INVALID_ARGUMENT';
  end if;
  select * into source_run
  from public.player_forecast_season_runs
  where id = p_source_run_id and status = 'validated';
  if source_run.id is null then
    raise exception using errcode = 'P0002', message = 'PLAYER_FORECAST_SEASON_VALIDATED_SOURCE_NOT_FOUND';
  end if;
  select season_id into roster_season
  from public.player_forecast_season_roster_snapshots
  where id = p_roster_snapshot_id;
  select season_id into schedule_season
  from public.player_forecast_season_schedule_snapshots
  where id = p_schedule_snapshot_id;
  if roster_season is distinct from source_run.season_id
    or schedule_season is distinct from source_run.season_id
  then
    raise exception using errcode = '23514', message = 'PLAYER_FORECAST_SEASON_EVENT_RUN_SNAPSHOT_MISMATCH';
  end if;

  insert into public.player_forecast_season_runs (
    idempotency_key, season_id, view_key, run_kind, status, artifact_id,
    roster_snapshot_id, schedule_snapshot_id, cutoff_at,
    source_high_watermark, contract_version, contract_checksum
  ) values (
    p_idempotency_key, source_run.season_id, source_run.view_key, 'event',
    'draft', source_run.artifact_id, p_roster_snapshot_id,
    p_schedule_snapshot_id, p_cutoff_at, p_source_high_watermark,
    source_run.contract_version, source_run.contract_checksum
  ) on conflict (idempotency_key) do nothing;

  select * into event_run
  from public.player_forecast_season_runs
  where idempotency_key = p_idempotency_key;
  if event_run.id is null then
    raise exception using errcode = 'P0002', message = 'PLAYER_FORECAST_SEASON_EVENT_RUN_NOT_FOUND';
  end if;

  insert into public.player_forecast_season_game_outputs (
    run_id, schedule_game_id, fhfh_player_id, team_id, opponent_team_id,
    population, playing_probability, start_probability, conditional_means,
    unconditional_means, baseline_unconditional_means, variances, quantiles,
    deployment, fallback_flags, component_hash
  )
  select event_run.id, next_game.id, output.fhfh_player_id, output.team_id,
         output.opponent_team_id, output.population, output.playing_probability,
         output.start_probability, output.conditional_means,
         output.unconditional_means, output.baseline_unconditional_means,
         output.variances, output.quantiles, output.deployment,
         output.fallback_flags, output.component_hash
  from public.player_forecast_season_game_outputs output
  join public.player_forecast_season_schedule_games prior_game
    on prior_game.id = output.schedule_game_id
  join public.player_forecast_season_schedule_games next_game
    on next_game.snapshot_id = p_schedule_snapshot_id
   and next_game.game_id = prior_game.game_id
  where output.run_id = source_run.id
    and not (output.fhfh_player_id = any(p_affected_player_ids))
    and next_game.scheduled_start_at > p_cutoff_at
    and next_game.game_status not in ('cancelled', 'started', 'final')
  on conflict (run_id, schedule_game_id, fhfh_player_id) do nothing;

  insert into public.player_forecast_season_player_aggregates (
    run_id, fhfh_player_id, team_id, player_name, position, population,
    pool_status, roster_status, roster_confidence, source_fresh_at,
    rookie_profile, expected_games, expected_starts, expected_toi, ratings,
    deployment, model_means, p10, p50, p90, component_manifest,
    fallback_flags, provenance, aggregate_hash
  )
  select event_run.id, aggregate.fhfh_player_id, aggregate.team_id,
         aggregate.player_name, aggregate.position, aggregate.population,
         aggregate.pool_status, aggregate.roster_status,
         aggregate.roster_confidence, aggregate.source_fresh_at,
         aggregate.rookie_profile, aggregate.expected_games,
         aggregate.expected_starts, aggregate.expected_toi, aggregate.ratings,
         aggregate.deployment, aggregate.model_means, aggregate.p10,
         aggregate.p50, aggregate.p90, aggregate.component_manifest,
         aggregate.fallback_flags, aggregate.provenance,
         aggregate.aggregate_hash
  from public.player_forecast_season_player_aggregates aggregate
  where aggregate.run_id = source_run.id
    and not (aggregate.fhfh_player_id = any(p_affected_player_ids))
  on conflict (run_id, fhfh_player_id) do nothing;

  insert into public.player_forecast_season_team_aggregates (
    run_id, team_id, team_name, abbreviation, ratings, deployment,
    roster_counts, schedule_neutral_goal_differential, confidence,
    provenance, aggregate_hash
  )
  select event_run.id, aggregate.team_id, aggregate.team_name,
         aggregate.abbreviation, aggregate.ratings, aggregate.deployment,
         aggregate.roster_counts, aggregate.schedule_neutral_goal_differential,
         aggregate.confidence, aggregate.provenance, aggregate.aggregate_hash
  from public.player_forecast_season_team_aggregates aggregate
  where aggregate.run_id = source_run.id
    and not (aggregate.team_id = any(p_affected_team_ids))
  on conflict (run_id, team_id) do nothing;

  return event_run;
end;
$$;

create or replace function public.publish_player_forecast_season_release_atomic(
  p_run_id uuid,
  p_release_label text,
  p_release_hash text,
  p_validation_receipt jsonb,
  p_player_rows jsonb,
  p_team_rows jsonb,
  p_actor_kind text,
  p_actor_user_id uuid,
  p_reason text
) returns public.player_forecast_season_releases
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate public.player_forecast_season_runs;
  artifact public.player_forecast_season_artifacts;
  roster_snapshot public.player_forecast_season_roster_snapshots;
  schedule_snapshot public.player_forecast_season_schedule_snapshots;
  published public.player_forecast_season_releases;
  next_release_number integer;
  team_count integer;
  unique_game_count integer;
  invalid_team_count integer;
  open_roster_conflicts integer;
  transaction_cutoff timestamptz;
begin
  if nullif(pg_catalog.btrim(p_release_label), '') is null
    or p_release_hash !~ '^[0-9a-f]{64}$'
    or p_validation_receipt is null
    or pg_catalog.jsonb_typeof(p_validation_receipt) <> 'object'
    or pg_catalog.jsonb_typeof(p_player_rows) <> 'array'
    or pg_catalog.jsonb_typeof(p_team_rows) <> 'array'
    or p_actor_kind not in ('editor', 'system')
    or (p_actor_kind = 'editor' and p_actor_user_id is null)
    or (p_actor_kind = 'system' and p_actor_user_id is not null)
    or nullif(pg_catalog.btrim(p_reason), '') is null
  then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_SEASON_PUBLISH_INVALID_ARGUMENT';
  end if;

  select * into candidate
  from public.player_forecast_season_runs
  where id = p_run_id and status = 'validated';
  if candidate.id is null then
    raise exception using errcode = 'P0002', message = 'PLAYER_FORECAST_SEASON_VALIDATED_RUN_NOT_FOUND';
  end if;
  select * into artifact
  from public.player_forecast_season_artifacts
  where id = candidate.artifact_id;
  select * into roster_snapshot
  from public.player_forecast_season_roster_snapshots
  where id = candidate.roster_snapshot_id;
  select * into schedule_snapshot
  from public.player_forecast_season_schedule_snapshots
  where id = candidate.schedule_snapshot_id;

  if coalesce(
    (roster_snapshot.metadata #>> '{transactionCoverage,complete}')::boolean,
    false
  ) is not true
    or nullif(roster_snapshot.metadata #>> '{transactionCoverage,cutoffAt}', '') is null
    or (roster_snapshot.metadata #>> '{transactionCoverage,cutoffAt}')::timestamptz
      < candidate.cutoff_at - interval '36 hours'
  then
    raise exception using errcode = '23514', message = 'PLAYER_FORECAST_SEASON_TRANSACTION_COVERAGE_REQUIRED';
  end if;

  if not (
      (candidate.contract_version = 'player-forecasts-research-v3-season'
       and candidate.contract_checksum = '29c6766f63ba9a8dbf8890cb6a388418945134b70217d58e9d8645b34dc36b93')
      or
      (candidate.contract_version = 'player-forecasts-research-v4-season-fantasy'
       and candidate.contract_checksum = 'e0b10f508d4f3e96b93cb3b203930e05d15c1f75dcc969030e4a04f20de18150')
      or
      (candidate.contract_version = 'player-forecasts-research-v5-season-advanced'
       and candidate.contract_checksum = '9b91e7d1de540664f404cc518222e61fcb837127a25916ee735f37d7a185a435')
    )
    or artifact.contract_version <> candidate.contract_version
    or artifact.contract_checksum <> candidate.contract_checksum
  then
    raise exception using errcode = '22000', message = 'PLAYER_FORECAST_SEASON_RESEARCH_CONTRACT_MISMATCH';
  end if;

  if candidate.contract_version = 'player-forecasts-research-v5-season-advanced'
    and not exists (
      select 1
      from public.player_forecast_season_active_releases active
      join public.player_forecast_season_releases release on release.id = active.release_id
      where active.season_id = candidate.season_id
        and active.view_key = candidate.view_key
        and release.contract_version = 'player-forecasts-research-v4-season-fantasy'
        and release.contract_checksum = 'e0b10f508d4f3e96b93cb3b203930e05d15c1f75dcc969030e4a04f20de18150'
        and release.health_status = 'healthy'
    )
  then
    raise exception using errcode = '23514', message = 'PLAYER_FORECAST_SEASON_V4_RELEASE_REQUIRED';
  end if;

  if exists (
    select 1
    from public.player_forecast_season_player_pool_review review
    where review.season_id = candidate.season_id
      and review.resolution_status = 'pending'
      and not exists (
        select 1
        from public.player_forecast_season_player_pool_review newer
        where newer.supersedes_id = review.id
      )
  ) then
    raise exception using errcode = '23514', message = 'PLAYER_FORECAST_SEASON_PLAYER_POOL_REVIEW_REQUIRED';
  end if;

  select count(*) into open_roster_conflicts
  from public.player_forecast_season_roster_conflicts conflict
  where conflict.season_id = candidate.season_id
    and not exists (
      select 1
      from public.player_forecast_season_roster_conflicts newer
      where newer.supersedes_id = conflict.id
    )
    and not exists (
      select 1
      from public.player_forecast_season_roster_conflict_resolutions resolution
      where resolution.conflict_id = conflict.id
        and not exists (
          select 1
          from public.player_forecast_season_roster_conflict_resolutions newer_resolution
          where newer_resolution.supersedes_id = resolution.id
        )
    )
    and exists (
      select 1
      from public.player_forecast_season_roster_conflict_members member
      join public.player_forecast_season_roster_observations observation
        on observation.id = member.observation_id
      where member.conflict_id = conflict.id and observation.confidence >= 0.9
    );
  if open_roster_conflicts > 0 then
    raise exception using errcode = '23514', message = 'PLAYER_FORECAST_SEASON_ROSTER_CONFLICT_REVIEW_REQUIRED';
  end if;

  select count(*) into unique_game_count
  from public.player_forecast_season_schedule_games
  where snapshot_id = candidate.schedule_snapshot_id and game_type = 2;
  select count(*) into team_count
  from (
    select team_id
    from (
      select home_team_id as team_id
      from public.player_forecast_season_schedule_games
      where snapshot_id = candidate.schedule_snapshot_id and game_type = 2
      union all
      select away_team_id
      from public.player_forecast_season_schedule_games
      where snapshot_id = candidate.schedule_snapshot_id and game_type = 2
    ) team_games
    group by team_id
    having count(*) = 84
  ) complete_teams;
  if unique_game_count <> 1344 or team_count <> 32 then
    raise exception using errcode = '23514', message = 'PLAYER_FORECAST_SEASON_SCHEDULE_INCOMPLETE';
  end if;

  select count(*) into invalid_team_count
  from (
    select distinct home_team_id as team_id
    from public.player_forecast_season_schedule_games
    where snapshot_id = candidate.schedule_snapshot_id and game_type = 2
    union
    select distinct away_team_id
    from public.player_forecast_season_schedule_games
    where snapshot_id = candidate.schedule_snapshot_id and game_type = 2
  ) schedule_teams
  left join (
    select team_id,
           count(*) filter (where position in ('C', 'L', 'R')) as forwards,
           count(*) filter (where position = 'D') as defensemen,
           count(*) filter (where position = 'G') as goalies
    from pg_catalog.jsonb_to_recordset(p_player_rows) as player_row(
      team_id smallint,
      position text,
      pool_status text
    )
    where team_id is not null and pool_status <> 'excluded'
    group by team_id
  ) counts on counts.team_id = schedule_teams.team_id
  where (
    coalesce(counts.forwards, 0) < 12
    or coalesce(counts.defensemen, 0) < 6
    or coalesce(counts.goalies, 0) < 2
  ) and not exists (
    select 1
    from public.player_forecast_season_completeness_waivers waiver
    where waiver.season_id = candidate.season_id
      and waiver.roster_snapshot_id = candidate.roster_snapshot_id
      and waiver.team_id = schedule_teams.team_id
      and (waiver.expires_at is null or waiver.expires_at > now())
      and not exists (
        select 1
        from public.player_forecast_season_completeness_waivers newer
        where newer.supersedes_id = waiver.id
      )
  );
  if invalid_team_count > 0 then
    raise exception using errcode = '23514', message = 'PLAYER_FORECAST_SEASON_ROSTER_INCOMPLETE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'fhfh:player-forecast-season-release:' || candidate.season_id || ':' || candidate.view_key,
      0
    )
  );
  select coalesce(max(release_number), 0) + 1 into next_release_number
  from public.player_forecast_season_releases
  where season_id = candidate.season_id and view_key = candidate.view_key;
  select max(coalesce(effective_at, available_at)) into transaction_cutoff
  from public.player_forecast_season_roster_observations
  where season_id = candidate.season_id
    and observation_kind in ('official_transaction', 'trusted_ifttt')
    and available_at <= candidate.cutoff_at;

  insert into public.player_forecast_season_releases (
    season_id, view_key, release_number, run_id, release_label, beta,
    cutoff_at, artifact_checksum, contract_version, contract_checksum,
    roster_revision_hash, schedule_revision_hash, source_high_watermark,
    validation_receipt, release_hash, metric_set_version, roster_observed_at,
    transaction_cutoff_at, health_status, health_summary
  ) values (
    candidate.season_id, candidate.view_key, next_release_number, candidate.id,
    p_release_label, true, candidate.cutoff_at, artifact.artifact_checksum,
    candidate.contract_version, candidate.contract_checksum,
    roster_snapshot.revision_hash, schedule_snapshot.revision_hash,
    candidate.source_high_watermark, p_validation_receipt, p_release_hash,
    case candidate.contract_version
      when 'player-forecasts-research-v5-season-advanced' then 'advanced-v5'
      when 'player-forecasts-research-v4-season-fantasy' then 'fantasy-v4'
      else 'core-v3'
    end,
    roster_snapshot.observed_at, transaction_cutoff, 'healthy',
    pg_catalog.jsonb_build_object(
      'rosterCompleteness', roster_snapshot.completeness,
      'openHighConfidenceRosterConflicts', open_roster_conflicts
    )
  ) returning * into published;

  insert into public.player_forecast_season_release_players (
    release_id, fhfh_player_id, team_id, player_name, position, population,
    pool_status, roster_status, roster_confidence, source_fresh_at,
    rookie_profile, expected_games, expected_starts, expected_toi, ratings,
    deployment, base_values, published_values, p10, p50, p90,
    adjustment_delta, adjusted, provenance, fallback_flags
  )
  select published.id, row_data.fhfh_player_id, row_data.team_id,
         row_data.player_name, row_data.position, row_data.population,
         row_data.pool_status, coalesce(row_data.roster_status, 'unresolved'),
         row_data.roster_confidence, row_data.source_fresh_at,
         coalesce(row_data.rookie_profile, '{}'::jsonb), row_data.expected_games,
         row_data.expected_starts, row_data.expected_toi, row_data.ratings,
         row_data.deployment, row_data.base_values, row_data.published_values,
         row_data.p10, row_data.p50, row_data.p90, row_data.adjustment_delta,
         row_data.adjusted, row_data.provenance,
         coalesce(row_data.fallback_flags, '{}'::text[])
  from pg_catalog.jsonb_to_recordset(p_player_rows) as row_data(
    fhfh_player_id bigint,
    team_id smallint,
    player_name text,
    position text,
    population text,
    pool_status text,
    roster_status text,
    roster_confidence numeric,
    source_fresh_at timestamptz,
    rookie_profile jsonb,
    expected_games numeric,
    expected_starts numeric,
    expected_toi jsonb,
    ratings jsonb,
    deployment jsonb,
    base_values jsonb,
    published_values jsonb,
    p10 jsonb,
    p50 jsonb,
    p90 jsonb,
    adjustment_delta jsonb,
    adjusted boolean,
    provenance jsonb,
    fallback_flags text[]
  );

  insert into public.player_forecast_season_release_teams (
    release_id, team_id, team_name, abbreviation, base_ratings,
    published_ratings, deployment, roster_counts, adjustment_delta,
    adjusted, confidence, provenance
  )
  select published.id, row_data.team_id, row_data.team_name,
         row_data.abbreviation, row_data.base_ratings,
         row_data.published_ratings, row_data.deployment,
         row_data.roster_counts, row_data.adjustment_delta,
         row_data.adjusted, row_data.confidence, row_data.provenance
  from pg_catalog.jsonb_to_recordset(p_team_rows) as row_data(
    team_id smallint,
    team_name text,
    abbreviation text,
    base_ratings jsonb,
    published_ratings jsonb,
    deployment jsonb,
    roster_counts jsonb,
    adjustment_delta jsonb,
    adjusted boolean,
    confidence numeric,
    provenance jsonb
  );

  if (select count(*) from public.player_forecast_season_release_teams where release_id = published.id) <> 32
    or (select count(*) from public.player_forecast_season_release_players where release_id = published.id) = 0
  then
    raise exception using errcode = '23514', message = 'PLAYER_FORECAST_SEASON_RELEASE_ROWS_INCOMPLETE';
  end if;

  insert into public.player_forecast_season_active_releases (
    season_id, view_key, release_id, pointed_at
  ) values (
    candidate.season_id, candidate.view_key, published.id, now()
  ) on conflict (season_id, view_key) do update
    set release_id = excluded.release_id, pointed_at = excluded.pointed_at;

  insert into public.player_forecast_season_release_events (
    season_id, view_key, release_id, action, reason, actor_kind, actor_user_id
  ) values (
    candidate.season_id, candidate.view_key, published.id,
    case when p_actor_kind = 'system' then 'auto_publish' else 'publish' end,
    p_reason, p_actor_kind, p_actor_user_id
  );
  return published;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'player_forecast_season_roster_observations',
    'player_forecast_season_roster_conflicts',
    'player_forecast_season_roster_conflict_members',
    'player_forecast_season_roster_conflict_resolutions'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'revoke all on table public.%I from public, anon, authenticated, service_role',
      table_name
    );
  end loop;
end
$$;

grant select, insert on table
  public.player_forecast_season_roster_observations,
  public.player_forecast_season_roster_conflicts,
  public.player_forecast_season_roster_conflict_members,
  public.player_forecast_season_roster_conflict_resolutions
to service_role;

revoke all on function public.apply_player_forecast_season_roster_snapshot(
  bigint, text, timestamptz, timestamptz, numeric, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_player_forecast_season_roster_snapshot(
  bigint, text, timestamptz, timestamptz, numeric, text, jsonb, jsonb, jsonb
) to service_role;
revoke all on function public.latest_player_forecast_season_roster_observations(bigint)
from public, anon, authenticated;
grant execute on function public.latest_player_forecast_season_roster_observations(bigint)
to service_role;
revoke all on function public.create_player_forecast_season_event_run(
  uuid, uuid, uuid, timestamptz, timestamptz, text, bigint[], smallint[]
) from public, anon, authenticated;
grant execute on function public.create_player_forecast_season_event_run(
  uuid, uuid, uuid, timestamptz, timestamptz, text, bigint[], smallint[]
) to service_role;

commit;
