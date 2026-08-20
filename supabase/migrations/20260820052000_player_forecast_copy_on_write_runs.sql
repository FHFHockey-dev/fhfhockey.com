alter table public.player_forecast_season_runs
  add column if not exists source_run_id uuid
    references public.player_forecast_season_runs(id);

create index if not exists player_forecast_season_runs_source_run_idx
  on public.player_forecast_season_runs (source_run_id)
  where source_run_id is not null;

do $$
declare
  definition text;
  patched text;
begin
  definition := pg_catalog.pg_get_functiondef(
    'public.clone_player_forecast_season_run(uuid,text)'::regprocedure
  );
  patched := pg_catalog.replace(definition, $old$
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
$old$, $new$
  -- Editorial runs are copy-on-write. Immutable aggregate component manifests
  -- retain the source hashes; only changed game components are materialized.
$new$);
  if patched = definition then
    raise exception 'PLAYER_FORECAST_COPY_ON_WRITE_CLONE_PATCH_FAILED';
  end if;
  execute patched;

  definition := pg_catalog.pg_get_functiondef(
    'public.create_player_forecast_season_event_run(uuid,uuid,uuid,timestamptz,timestamptz,text,bigint[],smallint[])'::regprocedure
  );
  patched := pg_catalog.replace(definition, $old$
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
$old$, $new$
  -- Event runs are copy-on-write. Recomputed players receive fresh components;
  -- unchanged aggregate manifests continue to reference their immutable source.
$new$);
  if patched = definition then
    raise exception 'PLAYER_FORECAST_COPY_ON_WRITE_EVENT_PATCH_FAILED';
  end if;
  execute patched;
end;
$$;

alter table public.player_forecast_season_runs force row level security;
revoke all on table public.player_forecast_season_runs from anon, authenticated;
grant all on table public.player_forecast_season_runs to service_role;
