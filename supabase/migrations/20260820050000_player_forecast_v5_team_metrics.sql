alter table public.player_forecast_season_team_aggregates
  add column if not exists model_means jsonb not null default '{}'::jsonb,
  add column if not exists p10 jsonb not null default '{}'::jsonb,
  add column if not exists p50 jsonb not null default '{}'::jsonb,
  add column if not exists p90 jsonb not null default '{}'::jsonb;

alter table public.player_forecast_season_release_teams
  add column if not exists base_values jsonb not null default '{}'::jsonb,
  add column if not exists published_values jsonb not null default '{}'::jsonb,
  add column if not exists p10 jsonb not null default '{}'::jsonb,
  add column if not exists p50 jsonb not null default '{}'::jsonb,
  add column if not exists p90 jsonb not null default '{}'::jsonb;

do $$
declare
  definition text;
  patched text;
begin
  definition := pg_catalog.pg_get_functiondef(
    'public.clone_player_forecast_season_run(uuid,text)'::regprocedure
  );
  patched := pg_catalog.replace(
    definition,
    'ratings, deployment, roster_counts,' || chr(10) ||
    '    schedule_neutral_goal_differential, confidence, provenance, aggregate_hash',
    'ratings, deployment, roster_counts, model_means, p10, p50, p90,' || chr(10) ||
    '    schedule_neutral_goal_differential, confidence, provenance, aggregate_hash'
  );
  patched := pg_catalog.replace(
    patched,
    'roster_counts, schedule_neutral_goal_differential, confidence,' || chr(10) ||
    '         provenance, aggregate_hash',
    'roster_counts, model_means, p10, p50, p90,' || chr(10) ||
    '         schedule_neutral_goal_differential, confidence, provenance, aggregate_hash'
  );
  if patched = definition then
    raise exception 'PLAYER_FORECAST_V5_CLONE_FUNCTION_PATCH_FAILED';
  end if;
  execute patched;

  definition := pg_catalog.pg_get_functiondef(
    'public.create_player_forecast_season_event_run(uuid,uuid,uuid,timestamptz,timestamptz,text,bigint[],smallint[])'::regprocedure
  );
  patched := pg_catalog.replace(
    definition,
    'ratings, deployment,' || chr(10) ||
    '    roster_counts, schedule_neutral_goal_differential, confidence,' || chr(10) ||
    '    provenance, aggregate_hash',
    'ratings, deployment,' || chr(10) ||
    '    roster_counts, model_means, p10, p50, p90,' || chr(10) ||
    '    schedule_neutral_goal_differential, confidence, provenance, aggregate_hash'
  );
  patched := pg_catalog.replace(
    patched,
    'aggregate.roster_counts, aggregate.schedule_neutral_goal_differential,' || chr(10) ||
    '         aggregate.confidence, aggregate.provenance, aggregate.aggregate_hash',
    'aggregate.roster_counts, aggregate.model_means, aggregate.p10, aggregate.p50,' || chr(10) ||
    '         aggregate.p90, aggregate.schedule_neutral_goal_differential,' || chr(10) ||
    '         aggregate.confidence, aggregate.provenance, aggregate.aggregate_hash'
  );
  if patched = definition then
    raise exception 'PLAYER_FORECAST_V5_EVENT_FUNCTION_PATCH_FAILED';
  end if;
  execute patched;

  definition := pg_catalog.pg_get_functiondef(
    'public.publish_player_forecast_season_release_atomic(uuid,text,text,jsonb,jsonb,jsonb,text,uuid,text)'::regprocedure
  );
  patched := pg_catalog.replace(
    definition,
    'published_ratings, deployment, roster_counts, adjustment_delta,' || chr(10) ||
    '    adjusted, confidence, provenance',
    'published_ratings, deployment, roster_counts, base_values, published_values,' || chr(10) ||
    '    p10, p50, p90, adjustment_delta, adjusted, confidence, provenance'
  );
  patched := pg_catalog.replace(
    patched,
    'row_data.roster_counts, row_data.adjustment_delta,' || chr(10) ||
    '         row_data.adjusted, row_data.confidence, row_data.provenance',
    'row_data.roster_counts, row_data.base_values, row_data.published_values,' || chr(10) ||
    '         row_data.p10, row_data.p50, row_data.p90, row_data.adjustment_delta,' || chr(10) ||
    '         row_data.adjusted, row_data.confidence, row_data.provenance'
  );
  patched := pg_catalog.replace(
    patched,
    'roster_counts jsonb,' || chr(10) ||
    '    adjustment_delta jsonb,',
    'roster_counts jsonb,' || chr(10) ||
    '    base_values jsonb,' || chr(10) ||
    '    published_values jsonb,' || chr(10) ||
    '    p10 jsonb,' || chr(10) ||
    '    p50 jsonb,' || chr(10) ||
    '    p90 jsonb,' || chr(10) ||
    '    adjustment_delta jsonb,'
  );
  if patched = definition then
    raise exception 'PLAYER_FORECAST_V5_PUBLISH_FUNCTION_PATCH_FAILED';
  end if;
  execute patched;
end;
$$;

alter table public.player_forecast_season_team_aggregates force row level security;
alter table public.player_forecast_season_release_teams force row level security;

revoke all on table public.player_forecast_season_team_aggregates from anon, authenticated;
revoke all on table public.player_forecast_season_release_teams from anon, authenticated;
grant all on table public.player_forecast_season_team_aggregates to service_role;
grant all on table public.player_forecast_season_release_teams to service_role;
