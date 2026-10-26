-- FORGE reserve projections (plan B′, tasks/artifacts/forge-week-coverage-2026-10-26/DIAGNOSIS.md).
-- LOCAL CANDIDATE: not applied anywhere. Apply only with TJ's explicit approval, BEFORE the release that writes it
-- (without the table the FORGE run's reserve pass fails its write).
--
-- One row per (run, game, player, horizon) for a current-roster player OUTSIDE the run's projected lineup (skaters) or
-- outside the selected starter (goalies). Every row is CONDITIONAL: a skater line holds only if he dresses, a goalie line
-- only if he starts. It is never an expected appearance or a confirmed start, and it carries no participation chance.
-- Kept apart from forge_player_projections / forge_goalie_projections on purpose: Start Chart, accuracy, team rows,
-- game revisions (starter_board_game_revisions) and every other existing reader never see these rows.
-- Writer: web/lib/projections/stages/persistence-stage.ts (persistForgeReserveProjectionRows; not yet cleared by
-- clearRunGameRows on resume, a follow-up). Reader: web/lib/rosterScheduleData/forgeDailyBridge.ts (admitted runs only).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.forge_reserve_projections (
  run_id uuid not null references public.forge_runs(run_id),
  as_of_date date not null,
  horizon_games smallint not null check (horizon_games >= 1 and horizon_games <= 10),
  game_id bigint not null references public.games(id),
  player_id bigint not null references public.players(id),
  team_id smallint not null references public.teams(id),
  opponent_team_id smallint not null references public.teams(id),
  player_class text not null check (player_class in ('skater', 'goalie')),
  -- 'if_dressed' for skaters, 'if_starts' for goalies: the only meanings a reserve row may carry.
  conditioning text not null check ((player_class = 'skater' and conditioning = 'if_dressed')
    or (player_class = 'goalie' and conditioning = 'if_starts')),
  -- Why he is outside the lineup when the run decided it (e.g. not_in_lineup, ruled_out, unavailable, backup_goalie).
  reserve_reason text not null,
  -- Producer binding: FORGE model/version that wrote the line (the run row carries git_sha and metrics).
  model_version text not null,
  proj_toi_es_seconds integer,
  proj_toi_pp_seconds integer,
  proj_shots_es numeric,
  proj_shots_pp numeric,
  proj_goals_es numeric,
  proj_goals_pp numeric,
  proj_assists_es numeric,
  proj_assists_pp numeric,
  proj_hits numeric,
  proj_blocks numeric,
  proj_shots_against numeric,
  proj_saves numeric,
  proj_goals_allowed numeric,
  proj_shutout_prob numeric check (proj_shutout_prob is null or (proj_shutout_prob >= 0 and proj_shutout_prob <= 1)),
  uncertainty jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (run_id, game_id, player_id, horizon_games)
);

create index if not exists idx_forge_reserve_projections_run on public.forge_reserve_projections (run_id, horizon_games);
create index if not exists idx_forge_reserve_projections_player on public.forge_reserve_projections (player_id);

-- Same exposure as the FORGE projection tables it sits beside: public read, service-role write.
alter table public.forge_reserve_projections enable row level security;
create policy public_read on public.forge_reserve_projections for select to anon, authenticated using (true);
grant select on table public.forge_reserve_projections to anon, authenticated;
grant select, insert, update, delete on table public.forge_reserve_projections to service_role;
