-- Additive parallel flurry-adjusted xG surfaces. Existing rows stay NULL until
-- the version-qualified aggregate writer recomputes them from source events;
-- raw xG columns remain authoritative and unchanged.

alter table if exists public.nhl_xg_team_game_aggregates
  add column if not exists flurry_adjusted_xg_for numeric(14, 6),
  add column if not exists flurry_adjusted_xg_against numeric(14, 6);

alter table if exists public.nhl_xg_player_game_aggregates
  add column if not exists flurry_adjusted_ixg numeric(14, 6);

alter table if exists public.nhl_xg_goalie_game_aggregates
  add column if not exists flurry_adjusted_xg_against numeric(14, 6),
  add column if not exists flurry_adjusted_goals_saved_above_expected numeric(14, 6);

alter table if exists public.nhl_xg_team_rolling_aggregates
  add column if not exists flurry_adjusted_xg_for numeric(14, 6),
  add column if not exists flurry_adjusted_xg_against numeric(14, 6);

alter table if exists public.nhl_xg_player_rolling_aggregates
  add column if not exists flurry_adjusted_ixg numeric(14, 6);

alter table if exists public.nhl_xg_goalie_rolling_aggregates
  add column if not exists flurry_adjusted_xg_against numeric(14, 6),
  add column if not exists flurry_adjusted_goals_saved_above_expected numeric(14, 6);

comment on column public.nhl_xg_team_game_aggregates.flurry_adjusted_xg_for is
  'Parallel flurry-adjusted xG for; raw xg_for is preserved.';
comment on column public.nhl_xg_team_game_aggregates.flurry_adjusted_xg_against is
  'Parallel flurry-adjusted xG against; raw xg_against is preserved.';
