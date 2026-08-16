alter table public.wgo_goalie_stats
  add column if not exists game_id bigint,
  add column if not exists opponent_team_abbrev text,
  add column if not exists home_road text;

create index if not exists idx_wgo_goalie_stats_game_id
  on public.wgo_goalie_stats (game_id)
  where game_id is not null;

create index if not exists idx_wgo_skater_stats_game_id
  on public.wgo_skater_stats (game_id)
  where game_id is not null;

create index if not exists idx_wgo_skater_stats_playoffs_game_id
  on public.wgo_skater_stats_playoffs (game_id)
  where game_id is not null;

alter table public.wgo_goalie_stats
  add constraint wgo_goalie_stats_game_id_required
  check (game_id is not null) not valid,
  add constraint wgo_goalie_stats_game_identity_valid
  check (
    season_id is not null
    and season_id = ((game_id / 1000000) * 10000 + (game_id / 1000000) + 1)
    and ((game_id / 10000) % 100) in (2, 3)
  ) not valid,
  add constraint wgo_goalie_stats_home_road_valid
  check (home_road is null or home_road in ('H', 'R')) not valid;

alter table public.wgo_skater_stats
  add constraint wgo_skater_stats_game_id_required
  check (game_id is not null) not valid,
  add constraint wgo_skater_stats_game_identity_valid
  check (
    season_id is not null
    and season_id = ((game_id / 1000000) * 10000 + (game_id / 1000000) + 1)
    and ((game_id / 10000) % 100) = 2
  ) not valid;

alter table public.wgo_skater_stats_playoffs
  add constraint wgo_skater_stats_playoffs_game_id_required
  check (game_id is not null) not valid,
  add constraint wgo_skater_stats_playoffs_game_identity_valid
  check (
    season_id is not null
    and season_id = ((game_id / 1000000) * 10000 + (game_id / 1000000) + 1)
    and ((game_id / 10000) % 100) = 3
  ) not valid;
