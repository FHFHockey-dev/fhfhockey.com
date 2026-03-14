alter table public.rolling_player_game_metrics
  add column if not exists pp_share_of_team double precision null,
  add column if not exists pp_unit_usage_index double precision null,
  add column if not exists pp_unit_relative_toi double precision null,
  add column if not exists pp_vs_unit_avg double precision null;
