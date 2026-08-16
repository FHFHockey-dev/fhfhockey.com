begin;

set lock_timeout = '5s';
set statement_timeout = '120s';

create table public.player_forecast_season_artifacts (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  artifact_version text not null,
  artifact_checksum text not null,
  artifact_path text not null,
  contract_version text not null,
  contract_checksum text not null,
  feature_schema_version text not null,
  training_cutoff_at timestamptz not null,
  code_version text not null,
  model_manifest jsonb not null,
  golden_vectors jsonb not null default '[]'::jsonb,
  lifecycle_status text not null default 'candidate'
    check (lifecycle_status in ('candidate', 'frozen_opening', 'shadow', 'retired', 'rejected')),
  created_at timestamptz not null default now(),
  unique (season_id, artifact_version, artifact_checksum),
  check (artifact_checksum ~ '^[0-9a-f]{64}$'),
  check (contract_checksum ~ '^[0-9a-f]{64}$'),
  check (artifact_path ~ ('^sha256/' || artifact_checksum || '/[a-zA-Z0-9._/-]+$')),
  check (btrim(artifact_version) <> '' and btrim(contract_version) <> ''),
  check (jsonb_typeof(model_manifest) = 'object'),
  check (jsonb_typeof(golden_vectors) = 'array')
);

create table public.player_forecast_season_roster_snapshots (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  source text not null,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  completeness numeric(6,5) not null check (completeness between 0 and 1),
  revision_hash text not null,
  source_manifest jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (season_id, revision_hash),
  check (available_at >= observed_at),
  check (revision_hash ~ '^[0-9a-f]{64}$'),
  check (btrim(source) <> ''),
  check (jsonb_typeof(source_manifest) = 'array' and jsonb_typeof(metadata) = 'object')
);

create table public.player_forecast_season_roster_members (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.player_forecast_season_roster_snapshots(id),
  fhfh_player_id bigint not null references public.fhfh_player_identities(id),
  team_id smallint references public.teams(id),
  previous_team_id smallint references public.teams(id),
  position text not null check (position in ('C', 'L', 'R', 'D', 'G')),
  pool_status text not null
    check (pool_status in ('verified_active', 'active_prospect', 'unsigned_relevant', 'review_required', 'excluded')),
  roster_confidence numeric(6,5) not null check (roster_confidence between 0 and 1),
  prior_based boolean not null default false,
  source_provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, fhfh_player_id),
  check (team_id is distinct from previous_team_id),
  check (jsonb_typeof(source_provenance) = 'object')
);

create table public.player_forecast_season_player_pool_review (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  season_id bigint not null references public.seasons(id),
  nhl_player_id bigint,
  raw_player_name text not null,
  team_id smallint references public.teams(id),
  position text check (position is null or position in ('C', 'L', 'R', 'D', 'G')),
  issue_code text not null,
  resolution_status text not null
    check (resolution_status in ('pending', 'mapped', 'excluded')),
  mapped_fhfh_player_id bigint references public.fhfh_player_identities(id),
  resolution_reason text,
  supersedes_id uuid references public.player_forecast_season_player_pool_review(id),
  created_by uuid,
  source_provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (btrim(review_key) <> '' and btrim(raw_player_name) <> '' and btrim(issue_code) <> ''),
  check (jsonb_typeof(source_provenance) = 'object'),
  check (
    (resolution_status = 'pending' and mapped_fhfh_player_id is null and created_by is null)
    or (
      resolution_status = 'mapped'
      and mapped_fhfh_player_id is not null
      and created_by is not null
      and nullif(btrim(resolution_reason), '') is not null
    )
    or (
      resolution_status = 'excluded'
      and mapped_fhfh_player_id is null
      and created_by is not null
      and nullif(btrim(resolution_reason), '') is not null
    )
  )
);

create table public.player_forecast_season_schedule_snapshots (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  source text not null,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  completeness numeric(6,5) not null check (completeness between 0 and 1),
  revision_hash text not null,
  source_manifest jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (season_id, revision_hash),
  check (available_at >= observed_at),
  check (revision_hash ~ '^[0-9a-f]{64}$'),
  check (btrim(source) <> ''),
  check (jsonb_typeof(source_manifest) = 'array' and jsonb_typeof(metadata) = 'object')
);

create table public.player_forecast_season_schedule_games (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.player_forecast_season_schedule_snapshots(id),
  game_id bigint not null,
  game_type smallint not null default 2,
  scheduled_start_at timestamptz not null,
  home_team_id smallint not null references public.teams(id),
  away_team_id smallint not null references public.teams(id),
  game_status text not null default 'scheduled'
    check (game_status in ('scheduled', 'postponed', 'cancelled', 'started', 'final')),
  source_revision_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, game_id),
  check (home_team_id <> away_team_id),
  check (btrim(source_revision_key) <> ''),
  check (jsonb_typeof(metadata) = 'object')
);

create table public.player_forecast_season_deployment_snapshots (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  team_id smallint not null references public.teams(id),
  source text not null,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  expires_at timestamptz,
  revision_hash text not null,
  processing_status text not null
    check (processing_status in ('trusted', 'review_required', 'rejected')),
  forecast_relevant boolean not null default false,
  completeness numeric(6,5) not null check (completeness between 0 and 1),
  source_manifest jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (season_id, team_id, revision_hash),
  check (available_at >= observed_at),
  check (expires_at is null or expires_at > available_at),
  check (revision_hash ~ '^[0-9a-f]{64}$'),
  check (btrim(source) <> ''),
  check (jsonb_typeof(source_manifest) = 'array' and jsonb_typeof(metadata) = 'object')
);

create table public.player_forecast_season_deployment_assignments (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.player_forecast_season_deployment_snapshots(id),
  fhfh_player_id bigint not null references public.fhfh_player_identities(id),
  position text not null check (position in ('C', 'L', 'R', 'D', 'G')),
  most_likely_role jsonb not null default '{}'::jsonb,
  role_probabilities jsonb not null default '{}'::jsonb,
  confidence numeric(6,5) not null check (confidence between 0 and 1),
  expected_toi jsonb not null default '{}'::jsonb,
  source_provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, fhfh_player_id),
  check (
    jsonb_typeof(most_likely_role) = 'object'
    and jsonb_typeof(role_probabilities) = 'object'
    and jsonb_typeof(expected_toi) = 'object'
    and jsonb_typeof(source_provenance) = 'object'
  )
);

create table public.player_forecast_season_runs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  season_id bigint not null references public.seasons(id),
  view_key text not null check (view_key in ('opening', 'current', 'ros')),
  run_kind text not null check (run_kind in ('opening', 'daily', 'event', 'editorial', 'local_import', 'replay')),
  status text not null default 'draft'
    check (status in ('draft', 'running', 'validated', 'failed', 'research_blocked', 'superseded')),
  artifact_id uuid not null references public.player_forecast_season_artifacts(id),
  roster_snapshot_id uuid not null references public.player_forecast_season_roster_snapshots(id),
  schedule_snapshot_id uuid not null references public.player_forecast_season_schedule_snapshots(id),
  cutoff_at timestamptz not null,
  source_high_watermark timestamptz not null,
  contract_version text not null,
  contract_checksum text not null,
  deterministic_hash text,
  hold_reason_code text,
  validation_receipt jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (btrim(idempotency_key) <> ''),
  check (contract_checksum ~ '^[0-9a-f]{64}$'),
  check (deterministic_hash is null or deterministic_hash ~ '^[0-9a-f]{64}$'),
  check (validation_receipt is null or jsonb_typeof(validation_receipt) = 'object'),
  check ((status in ('validated', 'failed', 'research_blocked', 'superseded')) = (completed_at is not null))
);

create table public.player_forecast_season_game_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.player_forecast_season_runs(id),
  schedule_game_id uuid not null references public.player_forecast_season_schedule_games(id),
  fhfh_player_id bigint not null references public.fhfh_player_identities(id),
  team_id smallint not null references public.teams(id),
  opponent_team_id smallint not null references public.teams(id),
  population text not null check (population in ('forward', 'defense', 'goalie')),
  playing_probability numeric(8,7) check (playing_probability between 0 and 1),
  start_probability numeric(8,7) check (start_probability is null or start_probability between 0 and 1),
  conditional_means jsonb not null,
  unconditional_means jsonb not null,
  baseline_unconditional_means jsonb not null,
  variances jsonb not null,
  quantiles jsonb not null,
  deployment jsonb not null default '{}'::jsonb,
  fallback_flags text[] not null default '{}'::text[],
  component_hash text not null,
  created_at timestamptz not null default now(),
  unique (run_id, schedule_game_id, fhfh_player_id),
  check (team_id <> opponent_team_id),
  check (component_hash ~ '^[0-9a-f]{64}$'),
  check (
    jsonb_typeof(conditional_means) = 'object'
    and jsonb_typeof(unconditional_means) = 'object'
    and jsonb_typeof(baseline_unconditional_means) = 'object'
    and jsonb_typeof(variances) = 'object'
    and jsonb_typeof(quantiles) = 'object'
    and jsonb_typeof(deployment) = 'object'
  ),
  check (
    (population = 'goalie' and start_probability is not null)
    or (population <> 'goalie' and start_probability is null)
  )
);

create table public.player_forecast_season_player_aggregates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.player_forecast_season_runs(id),
  fhfh_player_id bigint not null references public.fhfh_player_identities(id),
  team_id smallint references public.teams(id),
  player_name text not null,
  position text not null check (position in ('C', 'L', 'R', 'D', 'G')),
  population text not null check (population in ('forward', 'defense', 'goalie')),
  pool_status text not null
    check (pool_status in ('verified_active', 'active_prospect', 'unsigned_relevant', 'review_required', 'excluded')),
  roster_confidence numeric(6,5) not null check (roster_confidence between 0 and 1),
  expected_games numeric not null check (expected_games >= 0 and expected_games <= 84 and expected_games <> 'NaN'::numeric),
  expected_starts numeric check (expected_starts is null or (expected_starts >= 0 and expected_starts <= expected_games and expected_starts <> 'NaN'::numeric)),
  expected_toi jsonb not null,
  ratings jsonb not null,
  deployment jsonb not null,
  model_means jsonb not null,
  p10 jsonb not null,
  p50 jsonb not null,
  p90 jsonb not null,
  component_manifest jsonb not null,
  fallback_flags text[] not null default '{}'::text[],
  provenance jsonb not null,
  aggregate_hash text not null,
  created_at timestamptz not null default now(),
  unique (run_id, fhfh_player_id),
  check (btrim(player_name) <> ''),
  check (aggregate_hash ~ '^[0-9a-f]{64}$'),
  check (
    jsonb_typeof(expected_toi) = 'object'
    and jsonb_typeof(ratings) = 'object'
    and jsonb_typeof(deployment) = 'object'
    and jsonb_typeof(model_means) = 'object'
    and jsonb_typeof(p10) = 'object'
    and jsonb_typeof(p50) = 'object'
    and jsonb_typeof(p90) = 'object'
    and jsonb_typeof(component_manifest) = 'array'
    and jsonb_typeof(provenance) = 'object'
  )
);

create table public.player_forecast_season_team_aggregates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.player_forecast_season_runs(id),
  team_id smallint not null references public.teams(id),
  team_name text not null,
  abbreviation text not null,
  ratings jsonb not null,
  deployment jsonb not null,
  roster_counts jsonb not null,
  schedule_neutral_goal_differential numeric not null,
  confidence numeric(6,5) not null check (confidence between 0 and 1),
  provenance jsonb not null,
  aggregate_hash text not null,
  created_at timestamptz not null default now(),
  unique (run_id, team_id),
  check (btrim(team_name) <> '' and btrim(abbreviation) <> ''),
  check (aggregate_hash ~ '^[0-9a-f]{64}$'),
  check (
    jsonb_typeof(ratings) = 'object'
    and jsonb_typeof(deployment) = 'object'
    and jsonb_typeof(roster_counts) = 'object'
    and jsonb_typeof(provenance) = 'object'
  )
);

create table public.player_forecast_season_overrides (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  run_id uuid not null references public.player_forecast_season_runs(id),
  scope_type text not null check (scope_type in ('player', 'team')),
  fhfh_player_id bigint references public.fhfh_player_identities(id),
  team_id smallint references public.teams(id),
  field_path text not null,
  base_value jsonb,
  override_value jsonb not null,
  reason text not null,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  supersedes_id uuid references public.player_forecast_season_overrides(id),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  check (
    (scope_type = 'player' and fhfh_player_id is not null)
    or (scope_type = 'team' and team_id is not null and fhfh_player_id is null)
  ),
  check (btrim(field_path) <> '' and btrim(reason) <> ''),
  check (expires_at is null or expires_at > effective_at)
);

create table public.player_forecast_season_completeness_waivers (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  roster_snapshot_id uuid not null references public.player_forecast_season_roster_snapshots(id),
  team_id smallint not null references public.teams(id),
  reason text not null,
  expires_at timestamptz,
  supersedes_id uuid references public.player_forecast_season_completeness_waivers(id),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  check (btrim(reason) <> '')
);

create table public.player_forecast_season_releases (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  view_key text not null check (view_key in ('opening', 'current', 'ros')),
  release_number integer not null check (release_number > 0),
  run_id uuid not null references public.player_forecast_season_runs(id),
  release_label text not null,
  beta boolean not null default true,
  issued_at timestamptz not null default now(),
  cutoff_at timestamptz not null,
  artifact_checksum text not null,
  contract_version text not null,
  contract_checksum text not null,
  roster_revision_hash text not null,
  schedule_revision_hash text not null,
  source_high_watermark timestamptz not null,
  validation_receipt jsonb not null,
  release_hash text not null,
  created_at timestamptz not null default now(),
  unique (season_id, view_key, release_number),
  unique (season_id, view_key, release_hash),
  check (btrim(release_label) <> ''),
  check (artifact_checksum ~ '^[0-9a-f]{64}$'),
  check (contract_checksum ~ '^[0-9a-f]{64}$'),
  check (roster_revision_hash ~ '^[0-9a-f]{64}$'),
  check (schedule_revision_hash ~ '^[0-9a-f]{64}$'),
  check (release_hash ~ '^[0-9a-f]{64}$'),
  check (jsonb_typeof(validation_receipt) = 'object')
);

create table public.player_forecast_season_release_players (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.player_forecast_season_releases(id),
  fhfh_player_id bigint not null references public.fhfh_player_identities(id),
  team_id smallint references public.teams(id),
  player_name text not null,
  position text not null check (position in ('C', 'L', 'R', 'D', 'G')),
  population text not null check (population in ('forward', 'defense', 'goalie')),
  pool_status text not null
    check (pool_status in ('verified_active', 'active_prospect', 'unsigned_relevant', 'review_required')),
  roster_confidence numeric(6,5) not null check (roster_confidence between 0 and 1),
  expected_games numeric not null check (expected_games >= 0 and expected_games <= 84 and expected_games <> 'NaN'::numeric),
  expected_starts numeric check (expected_starts is null or (expected_starts >= 0 and expected_starts <= expected_games and expected_starts <> 'NaN'::numeric)),
  expected_toi jsonb not null,
  ratings jsonb not null,
  deployment jsonb not null,
  base_values jsonb not null,
  published_values jsonb not null,
  p10 jsonb not null,
  p50 jsonb not null,
  p90 jsonb not null,
  adjustment_delta jsonb not null default '{}'::jsonb,
  adjusted boolean not null default false,
  provenance jsonb not null,
  fallback_flags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  unique (release_id, fhfh_player_id),
  check (btrim(player_name) <> ''),
  check (
    jsonb_typeof(expected_toi) = 'object'
    and jsonb_typeof(ratings) = 'object'
    and jsonb_typeof(deployment) = 'object'
    and jsonb_typeof(base_values) = 'object'
    and jsonb_typeof(published_values) = 'object'
    and jsonb_typeof(p10) = 'object'
    and jsonb_typeof(p50) = 'object'
    and jsonb_typeof(p90) = 'object'
    and jsonb_typeof(adjustment_delta) = 'object'
    and jsonb_typeof(provenance) = 'object'
  )
);

create table public.player_forecast_season_release_teams (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.player_forecast_season_releases(id),
  team_id smallint not null references public.teams(id),
  team_name text not null,
  abbreviation text not null,
  base_ratings jsonb not null,
  published_ratings jsonb not null,
  deployment jsonb not null,
  roster_counts jsonb not null,
  adjustment_delta jsonb not null default '{}'::jsonb,
  adjusted boolean not null default false,
  confidence numeric(6,5) not null check (confidence between 0 and 1),
  provenance jsonb not null,
  created_at timestamptz not null default now(),
  unique (release_id, team_id),
  check (btrim(team_name) <> '' and btrim(abbreviation) <> ''),
  check (
    jsonb_typeof(base_ratings) = 'object'
    and jsonb_typeof(published_ratings) = 'object'
    and jsonb_typeof(deployment) = 'object'
    and jsonb_typeof(roster_counts) = 'object'
    and jsonb_typeof(adjustment_delta) = 'object'
    and jsonb_typeof(provenance) = 'object'
  )
);

create table public.player_forecast_season_active_releases (
  season_id bigint not null references public.seasons(id),
  view_key text not null check (view_key in ('opening', 'current', 'ros')),
  release_id uuid not null references public.player_forecast_season_releases(id),
  pointed_at timestamptz not null default now(),
  primary key (season_id, view_key)
);

create table public.player_forecast_season_release_events (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  view_key text not null check (view_key in ('opening', 'current', 'ros')),
  release_id uuid not null references public.player_forecast_season_releases(id),
  action text not null check (action in ('publish', 'auto_publish', 'rollback')),
  reason text not null,
  actor_kind text not null check (actor_kind in ('editor', 'system')),
  actor_user_id uuid,
  created_at timestamptz not null default now(),
  check (
    (actor_kind = 'editor' and actor_user_id is not null)
    or (actor_kind = 'system' and actor_user_id is null)
  ),
  check (btrim(reason) <> '')
);

create table public.player_forecast_season_outcome_revisions (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id),
  schedule_game_id uuid not null references public.player_forecast_season_schedule_games(id),
  fhfh_player_id bigint not null references public.fhfh_player_identities(id),
  population text not null check (population in ('forward', 'defense', 'goalie')),
  primitive_values jsonb not null,
  source text not null,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  finality text not null check (finality in ('provisional', 'corrected', 'final')),
  revision_hash text not null,
  supersedes_id uuid references public.player_forecast_season_outcome_revisions(id),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (schedule_game_id, fhfh_player_id, revision_hash),
  check (available_at >= observed_at),
  check (revision_hash ~ '^[0-9a-f]{64}$'),
  check (btrim(source) <> ''),
  check (jsonb_typeof(primitive_values) = 'object' and jsonb_typeof(provenance) = 'object')
);

create table public.player_forecast_season_evaluation_revisions (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.player_forecast_season_releases(id),
  outcome_revision_id uuid not null references public.player_forecast_season_outcome_revisions(id),
  fhfh_player_id bigint not null references public.fhfh_player_identities(id),
  scoring_version text not null,
  model_losses jsonb not null,
  published_losses jsonb not null,
  finality text not null check (finality in ('provisional', 'corrected', 'final')),
  evaluated_at timestamptz not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (release_id, outcome_revision_id, scoring_version),
  check (btrim(scoring_version) <> ''),
  check (
    jsonb_typeof(model_losses) = 'object'
    and jsonb_typeof(published_losses) = 'object'
    and jsonb_typeof(provenance) = 'object'
  )
);

create table public.player_forecast_season_queue (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null unique,
  season_id bigint not null references public.seasons(id),
  view_key text not null check (view_key in ('current', 'ros')),
  team_id smallint references public.teams(id),
  opponent_team_id smallint references public.teams(id),
  fhfh_player_id bigint references public.fhfh_player_identities(id),
  reasons text[] not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  first_enqueued_at timestamptz not null,
  last_enqueued_at timestamptz not null,
  not_before timestamptz not null,
  source_high_watermark timestamptz not null,
  claimed_watermark timestamptz,
  processed_watermark timestamptz,
  lease_owner uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(scope_key) <> '' and cardinality(reasons) > 0),
  check (jsonb_typeof(metadata) = 'object'),
  check (
    (status = 'running' and lease_owner is not null and lease_expires_at is not null and claimed_watermark is not null)
    or status <> 'running'
  )
);

create index player_forecast_season_artifacts_lookup_idx
  on public.player_forecast_season_artifacts (season_id, lifecycle_status, created_at desc);
create index player_forecast_season_roster_members_team_idx
  on public.player_forecast_season_roster_members (snapshot_id, team_id, position);
create index player_forecast_season_roster_members_player_idx
  on public.player_forecast_season_roster_members (fhfh_player_id, snapshot_id);
create index player_forecast_season_player_pool_review_lookup_idx
  on public.player_forecast_season_player_pool_review (season_id, resolution_status, created_at desc);
create index player_forecast_season_schedule_games_team_start_idx
  on public.player_forecast_season_schedule_games (snapshot_id, home_team_id, away_team_id, scheduled_start_at);
create index player_forecast_season_deployments_team_idx
  on public.player_forecast_season_deployment_snapshots (season_id, team_id, available_at desc);
create index player_forecast_season_deployment_assignments_player_idx
  on public.player_forecast_season_deployment_assignments (fhfh_player_id, snapshot_id);
create index player_forecast_season_runs_lookup_idx
  on public.player_forecast_season_runs (season_id, view_key, cutoff_at desc);
create index player_forecast_season_game_outputs_player_idx
  on public.player_forecast_season_game_outputs (run_id, fhfh_player_id, schedule_game_id);
create index player_forecast_season_player_aggregates_team_idx
  on public.player_forecast_season_player_aggregates (run_id, team_id, population);
create index player_forecast_season_overrides_active_idx
  on public.player_forecast_season_overrides (run_id, scope_type, fhfh_player_id, team_id, effective_at desc)
  where expires_at is null;
create index player_forecast_season_releases_lookup_idx
  on public.player_forecast_season_releases (season_id, view_key, release_number desc);
create index player_forecast_season_release_players_filter_idx
  on public.player_forecast_season_release_players (release_id, population, team_id, position);
create index player_forecast_season_queue_due_idx
  on public.player_forecast_season_queue (status, not_before, lease_expires_at);
create index player_forecast_season_outcomes_lookup_idx
  on public.player_forecast_season_outcome_revisions (season_id, schedule_game_id, fhfh_player_id, available_at desc);
create index player_forecast_season_evaluations_lookup_idx
  on public.player_forecast_season_evaluation_revisions (release_id, finality, evaluated_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'player_forecast_season_artifacts',
    'player_forecast_season_roster_snapshots',
    'player_forecast_season_roster_members',
    'player_forecast_season_player_pool_review',
    'player_forecast_season_schedule_snapshots',
    'player_forecast_season_schedule_games',
    'player_forecast_season_deployment_snapshots',
    'player_forecast_season_deployment_assignments',
    'player_forecast_season_game_outputs',
    'player_forecast_season_player_aggregates',
    'player_forecast_season_team_aggregates',
    'player_forecast_season_overrides',
    'player_forecast_season_completeness_waivers',
    'player_forecast_season_releases',
    'player_forecast_season_release_players',
    'player_forecast_season_release_teams',
    'player_forecast_season_release_events',
    'player_forecast_season_outcome_revisions',
    'player_forecast_season_evaluation_revisions'
  ] loop
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function fhfh_internal.reject_player_forecast_mutation()',
      table_name || '_immutable',
      table_name
    );
  end loop;
end
$$;

create or replace function public.enqueue_player_forecast_season_job(
  p_scope_key text,
  p_season_id bigint,
  p_view_key text,
  p_team_id smallint,
  p_opponent_team_id smallint,
  p_fhfh_player_id bigint,
  p_reason text,
  p_source_high_watermark timestamptz,
  p_not_before timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.player_forecast_season_queue
language plpgsql
security invoker
set search_path = ''
as $$
declare
  queued public.player_forecast_season_queue;
begin
  if nullif(pg_catalog.btrim(p_scope_key), '') is null
    or p_season_id is null
    or p_view_key not in ('current', 'ros')
    or nullif(pg_catalog.btrim(p_reason), '') is null
    or p_source_high_watermark is null
    or p_metadata is null
    or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
  then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_SEASON_QUEUE_INVALID_ARGUMENT';
  end if;

  insert into public.player_forecast_season_queue (
    scope_key, season_id, view_key, team_id, opponent_team_id, fhfh_player_id,
    reasons, status, first_enqueued_at, last_enqueued_at, not_before,
    source_high_watermark, metadata
  ) values (
    p_scope_key, p_season_id, p_view_key, p_team_id, p_opponent_team_id, p_fhfh_player_id,
    array[p_reason], 'pending', p_source_high_watermark, p_source_high_watermark,
    coalesce(p_not_before, p_source_high_watermark + interval '5 minutes'),
    p_source_high_watermark, p_metadata
  )
  on conflict (scope_key) do update
  set team_id = coalesce(excluded.team_id, public.player_forecast_season_queue.team_id),
      opponent_team_id = coalesce(excluded.opponent_team_id, public.player_forecast_season_queue.opponent_team_id),
      fhfh_player_id = coalesce(excluded.fhfh_player_id, public.player_forecast_season_queue.fhfh_player_id),
      reasons = public.player_forecast_season_queue.reasons || excluded.reasons,
      status = case
        when public.player_forecast_season_queue.status = 'running' then 'running'
        else 'pending'
      end,
      last_enqueued_at = greatest(
        public.player_forecast_season_queue.last_enqueued_at,
        excluded.last_enqueued_at
      ),
      not_before = greatest(
        public.player_forecast_season_queue.not_before,
        excluded.not_before
      ),
      source_high_watermark = greatest(
        public.player_forecast_season_queue.source_high_watermark,
        excluded.source_high_watermark
      ),
      metadata = public.player_forecast_season_queue.metadata || excluded.metadata,
      last_error_code = null,
      last_error_summary = null,
      updated_at = now()
  returning * into queued;

  return queued;
end;
$$;

create or replace function public.claim_player_forecast_season_jobs(
  p_owner_token uuid,
  p_limit integer default 8,
  p_lease_seconds integer default 240
) returns setof public.player_forecast_season_queue
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_owner_token is null or p_limit not between 1 and 50 or p_lease_seconds not between 30 and 800 then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_SEASON_CLAIM_INVALID_ARGUMENT';
  end if;

  return query
  with claimable as (
    select queue.id
    from public.player_forecast_season_queue as queue
    where queue.not_before <= now()
      and (
        queue.status in ('pending', 'failed')
        or (queue.status = 'running' and queue.lease_expires_at <= now())
      )
    order by queue.not_before, queue.first_enqueued_at
    for update skip locked
    limit p_limit
  )
  update public.player_forecast_season_queue as queue
  set status = 'running',
      lease_owner = p_owner_token,
      lease_expires_at = now() + pg_catalog.make_interval(secs => p_lease_seconds),
      claimed_watermark = queue.source_high_watermark,
      attempt_count = queue.attempt_count + 1,
      last_error_code = null,
      last_error_summary = null,
      updated_at = now()
  from claimable
  where queue.id = claimable.id
  returning queue.*;
end;
$$;

create or replace function public.finish_player_forecast_season_job(
  p_job_id uuid,
  p_owner_token uuid,
  p_succeeded boolean,
  p_error_code text default null,
  p_error_summary text default null
) returns public.player_forecast_season_queue
language plpgsql
security invoker
set search_path = ''
as $$
declare
  finished public.player_forecast_season_queue;
begin
  update public.player_forecast_season_queue as queue
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
      last_error_code = case when p_succeeded then null else left(coalesce(p_error_code, 'unknown'), 120) end,
      last_error_summary = case when p_succeeded then null else left(coalesce(p_error_summary, 'unknown failure'), 1000) end,
      updated_at = now()
  where queue.id = p_job_id
    and queue.status = 'running'
    and queue.lease_owner = p_owner_token
    and queue.lease_expires_at > now()
  returning queue.* into finished;

  if finished.id is null then
    raise exception using errcode = 'P0002', message = 'PLAYER_FORECAST_SEASON_JOB_LEASE_NOT_FOUND';
  end if;
  return finished;
end;
$$;

create or replace function fhfh_internal.enqueue_player_forecast_season_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_season bigint;
  snapshot_team smallint;
  snapshot_available timestamptz;
  snapshot_trusted boolean;
  snapshot_suppressed boolean;
  previous_team smallint;
  projected_team smallint;
begin
  if tg_table_name = 'player_forecast_season_roster_members' then
    select snapshot.season_id, snapshot.available_at,
           coalesce((snapshot.metadata->>'suppressEnqueue')::boolean, false)
      into snapshot_season, snapshot_available, snapshot_suppressed
    from public.player_forecast_season_roster_snapshots as snapshot
    where snapshot.id = new.snapshot_id;

    if snapshot_suppressed then
      return new;
    end if;
    if new.team_id is not null then
      perform public.enqueue_player_forecast_season_job(
        'season:' || snapshot_season || ':view:current:team:' || new.team_id,
        snapshot_season, 'current', new.team_id, null, new.fhfh_player_id,
        'normalized_roster_change', snapshot_available, null,
        pg_catalog.jsonb_build_object('rosterSnapshotId', new.snapshot_id)
      );
      perform public.enqueue_player_forecast_season_job(
        'season:' || snapshot_season || ':view:ros:team:' || new.team_id,
        snapshot_season, 'ros', new.team_id, null, new.fhfh_player_id,
        'normalized_roster_change', snapshot_available, null,
        pg_catalog.jsonb_build_object('rosterSnapshotId', new.snapshot_id)
      );
    end if;
    if new.previous_team_id is not null then
      perform public.enqueue_player_forecast_season_job(
        'season:' || snapshot_season || ':view:current:team:' || new.previous_team_id,
        snapshot_season, 'current', new.previous_team_id, new.team_id, new.fhfh_player_id,
        'normalized_roster_departure', snapshot_available, null,
        pg_catalog.jsonb_build_object('rosterSnapshotId', new.snapshot_id)
      );
      perform public.enqueue_player_forecast_season_job(
        'season:' || snapshot_season || ':view:ros:team:' || new.previous_team_id,
        snapshot_season, 'ros', new.previous_team_id, new.team_id, new.fhfh_player_id,
        'normalized_roster_departure', snapshot_available, null,
        pg_catalog.jsonb_build_object('rosterSnapshotId', new.snapshot_id)
      );
    end if;
  elsif tg_table_name = 'player_forecast_season_schedule_games' then
    select snapshot.season_id, snapshot.available_at,
           coalesce((snapshot.metadata->>'suppressEnqueue')::boolean, false)
      into snapshot_season, snapshot_available, snapshot_suppressed
    from public.player_forecast_season_schedule_snapshots as snapshot
    where snapshot.id = new.snapshot_id;

    if snapshot_suppressed then
      return new;
    end if;
    perform public.enqueue_player_forecast_season_job(
      'season:' || snapshot_season || ':view:current:game:' || new.game_id,
      snapshot_season, 'current', new.home_team_id, new.away_team_id, null,
      'normalized_schedule_change', snapshot_available, null,
      pg_catalog.jsonb_build_object('scheduleSnapshotId', new.snapshot_id, 'gameId', new.game_id)
    );
    perform public.enqueue_player_forecast_season_job(
      'season:' || snapshot_season || ':view:ros:game:' || new.game_id,
      snapshot_season, 'ros', new.home_team_id, new.away_team_id, null,
      'normalized_schedule_change', snapshot_available, null,
      pg_catalog.jsonb_build_object('scheduleSnapshotId', new.snapshot_id, 'gameId', new.game_id)
    );
  elsif tg_table_name = 'player_forecast_season_deployment_assignments' then
    select snapshot.season_id, snapshot.team_id, snapshot.available_at,
           snapshot.processing_status = 'trusted' and snapshot.forecast_relevant,
           coalesce((snapshot.metadata->>'suppressEnqueue')::boolean, false)
      into snapshot_season, snapshot_team, snapshot_available, snapshot_trusted,
           snapshot_suppressed
    from public.player_forecast_season_deployment_snapshots as snapshot
    where snapshot.id = new.snapshot_id;

    if snapshot_trusted and not snapshot_suppressed then
      perform public.enqueue_player_forecast_season_job(
        'season:' || snapshot_season || ':view:current:team:' || snapshot_team || ':player:' || new.fhfh_player_id,
        snapshot_season, 'current', snapshot_team, null, new.fhfh_player_id,
        'trusted_forecast_relevant_deployment', snapshot_available, null,
        pg_catalog.jsonb_build_object('deploymentSnapshotId', new.snapshot_id)
      );
      perform public.enqueue_player_forecast_season_job(
        'season:' || snapshot_season || ':view:ros:team:' || snapshot_team || ':player:' || new.fhfh_player_id,
        snapshot_season, 'ros', snapshot_team, null, new.fhfh_player_id,
        'trusted_forecast_relevant_deployment', snapshot_available, null,
        pg_catalog.jsonb_build_object('deploymentSnapshotId', new.snapshot_id)
      );
    end if;
  elsif tg_table_name = 'player_forecast_season_overrides' then
    if new.field_path not like 'stats.%' then
      if new.scope_type = 'player' then
        select aggregate.team_id into snapshot_team
        from public.player_forecast_season_player_aggregates aggregate
        where aggregate.run_id = new.run_id and aggregate.fhfh_player_id = new.fhfh_player_id;
      else
        snapshot_team := new.team_id;
      end if;
      previous_team := snapshot_team;
      projected_team := snapshot_team;
      if new.scope_type = 'player' and new.field_path = 'player.teamId' then
        previous_team := nullif(new.base_value #>> '{}', '')::smallint;
        projected_team := nullif(new.override_value #>> '{}', '')::smallint;
      end if;
      perform public.enqueue_player_forecast_season_job(
        'season:' || new.season_id || ':view:current:' || new.scope_type || ':' || coalesce(new.fhfh_player_id::text, new.team_id::text),
        new.season_id, 'current', projected_team, previous_team, new.fhfh_player_id,
        'editorial_override', new.created_at, null,
        pg_catalog.jsonb_build_object('overrideId', new.id, 'fieldPath', new.field_path)
      );
      perform public.enqueue_player_forecast_season_job(
        'season:' || new.season_id || ':view:ros:' || new.scope_type || ':' || coalesce(new.fhfh_player_id::text, new.team_id::text),
        new.season_id, 'ros', projected_team, previous_team, new.fhfh_player_id,
        'editorial_override', new.created_at, null,
        pg_catalog.jsonb_build_object('overrideId', new.id, 'fieldPath', new.field_path)
      );
      if previous_team is not null and previous_team is distinct from projected_team then
        perform public.enqueue_player_forecast_season_job(
          'season:' || new.season_id || ':view:current:team:' || previous_team || ':departure:' || new.fhfh_player_id,
          new.season_id, 'current', previous_team, projected_team, new.fhfh_player_id,
          'editorial_team_departure', new.created_at, null,
          pg_catalog.jsonb_build_object('overrideId', new.id)
        );
        perform public.enqueue_player_forecast_season_job(
          'season:' || new.season_id || ':view:ros:team:' || previous_team || ':departure:' || new.fhfh_player_id,
          new.season_id, 'ros', previous_team, projected_team, new.fhfh_player_id,
          'editorial_team_departure', new.created_at, null,
          pg_catalog.jsonb_build_object('overrideId', new.id)
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger player_forecast_season_roster_member_enqueue
after insert on public.player_forecast_season_roster_members
for each row execute function fhfh_internal.enqueue_player_forecast_season_change();
create trigger player_forecast_season_schedule_game_enqueue
after insert on public.player_forecast_season_schedule_games
for each row execute function fhfh_internal.enqueue_player_forecast_season_change();
create trigger player_forecast_season_deployment_assignment_enqueue
after insert on public.player_forecast_season_deployment_assignments
for each row execute function fhfh_internal.enqueue_player_forecast_season_change();
create trigger player_forecast_season_override_enqueue
after insert on public.player_forecast_season_overrides
for each row execute function fhfh_internal.enqueue_player_forecast_season_change();

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
    unconditional_means, baseline_unconditional_means, variances, quantiles, deployment, fallback_flags,
    component_hash
  )
  select cloned.id, schedule_game_id, fhfh_player_id, team_id, opponent_team_id,
         population, playing_probability, start_probability, conditional_means,
         unconditional_means, baseline_unconditional_means, variances, quantiles, deployment, fallback_flags,
         component_hash
  from public.player_forecast_season_game_outputs
  where run_id = source_run.id;

  insert into public.player_forecast_season_player_aggregates (
    run_id, fhfh_player_id, team_id, player_name, position, population, pool_status,
    roster_confidence, expected_games, expected_starts, expected_toi, ratings,
    deployment, model_means, p10, p50, p90, component_manifest,
    fallback_flags, provenance, aggregate_hash
  )
  select cloned.id, fhfh_player_id, team_id, player_name, position, population, pool_status,
         roster_confidence, expected_games, expected_starts, expected_toi, ratings,
         deployment, model_means, p10, p50, p90, component_manifest,
         fallback_flags, provenance, aggregate_hash
  from public.player_forecast_season_player_aggregates
  where run_id = source_run.id;

  insert into public.player_forecast_season_team_aggregates (
    run_id, team_id, team_name, abbreviation, ratings, deployment, roster_counts,
    schedule_neutral_goal_differential, confidence, provenance, aggregate_hash
  )
  select cloned.id, team_id, team_name, abbreviation, ratings, deployment, roster_counts,
         schedule_neutral_goal_differential, confidence, provenance, aggregate_hash
  from public.player_forecast_season_team_aggregates
  where run_id = source_run.id;

  return cloned;
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

  select * into artifact from public.player_forecast_season_artifacts where id = candidate.artifact_id;
  select * into roster_snapshot from public.player_forecast_season_roster_snapshots where id = candidate.roster_snapshot_id;
  select * into schedule_snapshot from public.player_forecast_season_schedule_snapshots where id = candidate.schedule_snapshot_id;

  if candidate.contract_version <> 'player-forecasts-research-v3-season'
    or candidate.contract_checksum <> '29c6766f63ba9a8dbf8890cb6a388418945134b70217d58e9d8645b34dc36b93'
    or artifact.contract_version <> candidate.contract_version
    or artifact.contract_checksum <> candidate.contract_checksum
  then
    raise exception using errcode = '22000', message = 'PLAYER_FORECAST_SEASON_RESEARCH_CONTRACT_MISMATCH';
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
  )
    and not exists (
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

  insert into public.player_forecast_season_releases (
    season_id, view_key, release_number, run_id, release_label, beta,
    cutoff_at, artifact_checksum, contract_version, contract_checksum,
    roster_revision_hash, schedule_revision_hash, source_high_watermark,
    validation_receipt, release_hash
  ) values (
    candidate.season_id, candidate.view_key, next_release_number, candidate.id,
    p_release_label, true, candidate.cutoff_at, artifact.artifact_checksum,
    candidate.contract_version, candidate.contract_checksum,
    roster_snapshot.revision_hash, schedule_snapshot.revision_hash,
    candidate.source_high_watermark, p_validation_receipt, p_release_hash
  ) returning * into published;

  insert into public.player_forecast_season_release_players (
    release_id, fhfh_player_id, team_id, player_name, position, population, pool_status,
    roster_confidence, expected_games, expected_starts, expected_toi, ratings,
    deployment, base_values, published_values, p10, p50, p90,
    adjustment_delta, adjusted, provenance, fallback_flags
  )
  select published.id, row_data.fhfh_player_id, row_data.team_id, row_data.player_name,
         row_data.position, row_data.population, row_data.pool_status, row_data.roster_confidence,
         row_data.expected_games, row_data.expected_starts, row_data.expected_toi,
         row_data.ratings, row_data.deployment, row_data.base_values,
         row_data.published_values, row_data.p10, row_data.p50, row_data.p90,
         row_data.adjustment_delta, row_data.adjusted, row_data.provenance,
         coalesce(row_data.fallback_flags, '{}'::text[])
  from pg_catalog.jsonb_to_recordset(p_player_rows) as row_data(
    fhfh_player_id bigint,
    team_id smallint,
    player_name text,
    position text,
    population text,
    pool_status text,
    roster_confidence numeric,
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
  select published.id, row_data.team_id, row_data.team_name, row_data.abbreviation,
         row_data.base_ratings, row_data.published_ratings, row_data.deployment,
         row_data.roster_counts, row_data.adjustment_delta, row_data.adjusted,
         row_data.confidence, row_data.provenance
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
  )
  on conflict (season_id, view_key) do update
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

create or replace function public.rollback_player_forecast_season_release_atomic(
  p_release_id uuid,
  p_actor_user_id uuid,
  p_reason text
) returns public.player_forecast_season_releases
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.player_forecast_season_releases;
begin
  if p_actor_user_id is null or nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_SEASON_ROLLBACK_INVALID_ARGUMENT';
  end if;
  select * into target from public.player_forecast_season_releases where id = p_release_id;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'PLAYER_FORECAST_SEASON_RELEASE_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'fhfh:player-forecast-season-release:' || target.season_id || ':' || target.view_key,
      0
    )
  );

  insert into public.player_forecast_season_active_releases (
    season_id, view_key, release_id, pointed_at
  ) values (
    target.season_id, target.view_key, target.id, now()
  )
  on conflict (season_id, view_key) do update
  set release_id = excluded.release_id, pointed_at = excluded.pointed_at;

  insert into public.player_forecast_season_release_events (
    season_id, view_key, release_id, action, reason, actor_kind, actor_user_id
  ) values (
    target.season_id, target.view_key, target.id, 'rollback', p_reason, 'editor', p_actor_user_id
  );
  return target;
end;
$$;

create or replace function fhfh_internal.invoke_player_forecast_season_endpoint_if_due(p_path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_path is null or p_path !~ '^/api/v1/player-forecasts/jobs/season-' then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_SEASON_CRON_PATH_INVALID';
  end if;
  if not exists (
    select 1
    from public.player_forecast_season_queue queue
    where queue.not_before <= now()
      and (
        queue.status in ('pending', 'failed')
        or (queue.status = 'running' and queue.lease_expires_at <= now())
      )
  ) then
    return null;
  end if;
  return fhfh_internal.invoke_player_forecast_endpoint(p_path);
end;
$$;

create or replace function fhfh_internal.register_player_forecast_season_cron(p_dry_run boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_job_id bigint;
  drain_path text;
  daily_path text;
begin
  if pg_catalog.to_regclass('cron.job') is null then
    raise exception using errcode = '55000', message = 'PLAYER_FORECAST_SEASON_PG_CRON_UNAVAILABLE';
  end if;

  for existing_job_id in
    select jobid from cron.job
    where jobname in ('player-forecasts-season-queue-drain', 'player-forecasts-season-daily-release')
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  drain_path := '/api/v1/player-forecasts/jobs/season-drain?dryRun=' || pg_catalog.lower(p_dry_run::text);
  daily_path := '/api/v1/player-forecasts/jobs/season-daily?dryRun=' || pg_catalog.lower(p_dry_run::text);

  perform cron.schedule(
    'player-forecasts-season-queue-drain',
    '*/5 * * * *',
    pg_catalog.format(
      'select fhfh_internal.invoke_player_forecast_season_endpoint_if_due(%L)',
      drain_path
    )
  );
  perform cron.schedule(
    'player-forecasts-season-daily-release',
    '0 10 * * *',
    pg_catalog.format(
      'select fhfh_internal.invoke_player_forecast_endpoint(%L)',
      daily_path
    )
  );
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'player_forecast_season_artifacts',
    'player_forecast_season_roster_snapshots',
    'player_forecast_season_roster_members',
    'player_forecast_season_player_pool_review',
    'player_forecast_season_schedule_snapshots',
    'player_forecast_season_schedule_games',
    'player_forecast_season_deployment_snapshots',
    'player_forecast_season_deployment_assignments',
    'player_forecast_season_runs',
    'player_forecast_season_game_outputs',
    'player_forecast_season_player_aggregates',
    'player_forecast_season_team_aggregates',
    'player_forecast_season_overrides',
    'player_forecast_season_completeness_waivers',
    'player_forecast_season_releases',
    'player_forecast_season_release_players',
    'player_forecast_season_release_teams',
    'player_forecast_season_active_releases',
    'player_forecast_season_release_events',
    'player_forecast_season_outcome_revisions',
    'player_forecast_season_evaluation_revisions',
    'player_forecast_season_queue'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
  end loop;
end
$$;

grant select, insert on table
  public.player_forecast_season_artifacts,
  public.player_forecast_season_roster_snapshots,
  public.player_forecast_season_roster_members,
  public.player_forecast_season_player_pool_review,
  public.player_forecast_season_schedule_snapshots,
  public.player_forecast_season_schedule_games,
  public.player_forecast_season_deployment_snapshots,
  public.player_forecast_season_deployment_assignments,
  public.player_forecast_season_game_outputs,
  public.player_forecast_season_player_aggregates,
  public.player_forecast_season_team_aggregates,
  public.player_forecast_season_overrides,
  public.player_forecast_season_completeness_waivers,
  public.player_forecast_season_releases,
  public.player_forecast_season_release_players,
  public.player_forecast_season_release_teams,
  public.player_forecast_season_release_events,
  public.player_forecast_season_outcome_revisions,
  public.player_forecast_season_evaluation_revisions
to service_role;

grant select, insert, update on table
  public.player_forecast_season_runs,
  public.player_forecast_season_active_releases,
  public.player_forecast_season_queue
to service_role;

revoke all on function public.enqueue_player_forecast_season_job(text, bigint, text, smallint, smallint, bigint, text, timestamptz, timestamptz, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_player_forecast_season_job(text, bigint, text, smallint, smallint, bigint, text, timestamptz, timestamptz, jsonb)
  to service_role;
revoke all on function public.claim_player_forecast_season_jobs(uuid, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_player_forecast_season_jobs(uuid, integer, integer)
  to service_role;
revoke all on function public.finish_player_forecast_season_job(uuid, uuid, boolean, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.finish_player_forecast_season_job(uuid, uuid, boolean, text, text)
  to service_role;
revoke all on function public.clone_player_forecast_season_run(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.clone_player_forecast_season_run(uuid, text)
  to service_role;
revoke all on function public.publish_player_forecast_season_release_atomic(uuid, text, text, jsonb, jsonb, jsonb, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.publish_player_forecast_season_release_atomic(uuid, text, text, jsonb, jsonb, jsonb, text, uuid, text)
  to service_role;
revoke all on function public.rollback_player_forecast_season_release_atomic(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.rollback_player_forecast_season_release_atomic(uuid, uuid, text)
  to service_role;
revoke all on function fhfh_internal.enqueue_player_forecast_season_change()
  from public, anon, authenticated, service_role;
revoke all on function fhfh_internal.invoke_player_forecast_season_endpoint_if_due(text)
  from public, anon, authenticated, service_role;
revoke all on function fhfh_internal.register_player_forecast_season_cron(boolean)
  from public, anon, authenticated, service_role;

do $$
begin
  if pg_catalog.to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('player-forecast-artifacts', 'player-forecast-artifacts', false)
    on conflict (id) do update set public = false;
  end if;
end
$$;

comment on table public.player_forecast_season_artifacts is
  'Checksum-addressed portable season artifacts. A v3 contract mismatch blocks serving.';
comment on table public.player_forecast_season_game_outputs is
  'Immutable per-game raw hockey forecasts used to construct full-season and ROS distributions.';
comment on table public.player_forecast_season_overrides is
  'Immutable owner-authored assumptions and primitive-stat adjustments; base model values remain untouched.';
comment on table public.player_forecast_season_releases is
  'Immutable numbered beta publications. Public clients read only the release selected by the active pointer.';
comment on function fhfh_internal.register_player_forecast_season_cron(boolean) is
  'Registers bounded existing-web-project Cron calls. Intentionally not invoked by this migration; hosted activation requires explicit approval.';

reset lock_timeout;
reset statement_timeout;

commit;
