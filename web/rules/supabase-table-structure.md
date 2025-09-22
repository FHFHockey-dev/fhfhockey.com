# Supabase Table Structure

## Tables

- [wgo_skater_stats](#wgo_skater_stats)
- [wgo_skater_stats_totals](#wgo_skater_stats_totals)
- [wgo_goalie_stats](#wgo_goalie_stats)
- [wgo_goalie_stats_totals](#wgo_goalie_stats_totals)
- [nst_gamelog_as_counts](#nst_gamelog_as_counts)
- [nst_gamelog_as_counts_oi](#nst_gamelog_as_counts_oi)
- [nst_gamelog_as_rates](#nst_gamelog_as_rates)
- [nst_gamelog_as_rates_oi](#nst_gamelog_as_rates_oi)
- [nst_seasonlong_as_counts](#nst_seasonlong_as_counts)
- [nst_seasonlong_as_counts_oi](#nst_seasonlong_as_counts_oi)
- [nst_seasonlong_as_rates](#nst_seasonlong_as_rates)
- [nst_seasonlong_as_rates_oi](#nst_seasonlong_as_rates_oi)
- [nst_team_all](#nst_team_all)
- [nst_team_stats](#nst_team_stats)
- [wgo_team_stats](#wgo_team_stats)
- [yahoo_nhl_player_map](#yahoo_nhl_player_map)
- [yahoo_nhl_player_map_mat](#yahoo_nhl_player_map_mat)
- [yahoo_players](#yahoo_players)
- [nhl_standings_details](#nhl_standings_details)
- [nhl_team_data](#nhl_team_data)
- [lineCombinations](#lineCombinations)
- [players](#players)

### wgo_skater_stats

```sql
create table public.wgo_skater_stats (
  id serial not null,
  player_id integer not null,
  player_name text not null,
  date date not null,
  shoots_catches text null,
  position_code text null,
  games_played integer null,
  points integer null,
  points_per_game double precision null,
  goals integer null,
  assists integer null,
  shots integer null,
  shooting_percentage double precision null,
  plus_minus integer null,
  ot_goals integer null,
  gw_goals integer null,
  pp_points integer null,
  fow_percentage double precision null,
  toi_per_game double precision null,
  blocked_shots integer null,
  blocks_per_60 double precision null,
  empty_net_assists integer null,
  empty_net_goals integer null,
  empty_net_points integer null,
  first_goals integer null,
  giveaways integer null,
  giveaways_per_60 double precision null,
  hits integer null,
  hits_per_60 double precision null,
  missed_shot_crossbar integer null,
  missed_shot_goal_post integer null,
  missed_shot_over_net integer null,
  missed_shot_short_side integer null,
  missed_shot_wide_of_net integer null,
  missed_shots integer null,
  takeaways integer null,
  takeaways_per_60 double precision null,
  d_zone_fo_percentage double precision null,
  d_zone_faceoffs integer null,
  ev_faceoff_percentage double precision null,
  ev_faceoffs integer null,
  n_zone_fo_percentage double precision null,
  n_zone_faceoffs integer null,
  o_zone_fo_percentage double precision null,
  o_zone_faceoffs integer null,
  pp_faceoff_percentage double precision null,
  pp_faceoffs integer null,
  sh_faceoff_percentage double precision null,
  sh_faceoffs integer null,
  total_faceoffs integer null,
  d_zone_fol integer null,
  d_zone_fow integer null,
  ev_fol integer null,
  ev_fow integer null,
  n_zone_fol integer null,
  n_zone_fow integer null,
  o_zone_fol integer null,
  o_zone_fow integer null,
  pp_fol integer null,
  pp_fow integer null,
  sh_fol integer null,
  sh_fow integer null,
  total_fol integer null,
  total_fow integer null,
  es_goal_diff integer null,
  es_goals_against integer null,
  es_goals_for integer null,
  es_goals_for_percentage double precision null,
  es_toi_per_game double precision null,
  pp_goals_against integer null,
  pp_goals_for integer null,
  pp_toi_per_game double precision null,
  sh_goals_against integer null,
  sh_goals_for integer null,
  sh_toi_per_game double precision null,
  game_misconduct_penalties integer null,
  major_penalties integer null,
  match_penalties integer null,
  minor_penalties integer null,
  misconduct_penalties integer null,
  net_penalties integer null,
  net_penalties_per_60 double precision null,
  penalties integer null,
  penalties_drawn integer null,
  penalties_drawn_per_60 double precision null,
  penalties_taken_per_60 double precision null,
  penalty_minutes integer null,
  penalty_minutes_per_toi double precision null,
  penalty_seconds_per_game double precision null,
  pp_goals_against_per_60 double precision null,
  sh_assists integer null,
  sh_goals integer null,
  sh_points integer null,
  sh_goals_per_60 double precision null,
  sh_individual_sat_for integer null,
  sh_individual_sat_per_60 double precision null,
  sh_points_per_60 double precision null,
  sh_primary_assists integer null,
  sh_primary_assists_per_60 double precision null,
  sh_secondary_assists integer null,
  sh_secondary_assists_per_60 double precision null,
  sh_shooting_percentage double precision null,
  sh_shots integer null,
  sh_shots_per_60 double precision null,
  sh_time_on_ice integer null,
  sh_time_on_ice_pct_per_game double precision null,
  pp_assists integer null,
  pp_goals integer null,
  pp_goals_for_per_60 double precision null,
  pp_goals_per_60 double precision null,
  pp_individual_sat_for integer null,
  pp_individual_sat_per_60 double precision null,
  pp_points_per_60 double precision null,
  pp_primary_assists integer null,
  pp_primary_assists_per_60 double precision null,
  pp_secondary_assists integer null,
  pp_secondary_assists_per_60 double precision null,
  pp_shooting_percentage double precision null,
  pp_shots integer null,
  pp_shots_per_60 double precision null,
  pp_toi integer null,
  pp_toi_pct_per_game double precision null,
  goals_pct double precision null,
  faceoff_pct_5v5 double precision null,
  individual_sat_for_per_60 double precision null,
  individual_shots_for_per_60 double precision null,
  on_ice_shooting_pct double precision null,
  sat_pct double precision null,
  toi_per_game_5v5 double precision null,
  usat_pct double precision null,
  zone_start_pct double precision null,
  sat_against integer null,
  sat_ahead integer null,
  sat_behind integer null,
  sat_close integer null,
  sat_for integer null,
  sat_tied integer null,
  sat_total integer null,
  usat_against integer null,
  usat_ahead integer null,
  usat_behind integer null,
  usat_close integer null,
  usat_for integer null,
  usat_tied integer null,
  usat_total integer null,
  sat_percentage double precision null,
  sat_percentage_ahead double precision null,
  sat_percentage_behind double precision null,
  sat_percentage_close double precision null,
  sat_percentage_tied double precision null,
  sat_relative double precision null,
  shooting_percentage_5v5 double precision null,
  skater_save_pct_5v5 double precision null,
  skater_shooting_plus_save_pct_5v5 double precision null,
  usat_percentage double precision null,
  usat_percentage_ahead double precision null,
  usat_percentage_behind double precision null,
  usat_percentage_close double precision null,
  usat_percentage_tied double precision null,
  usat_relative double precision null,
  zone_start_pct_5v5 double precision null,
  assists_5v5 integer null,
  assists_per_60_5v5 double precision null,
  goals_5v5 integer null,
  goals_per_60_5v5 double precision null,
  net_minor_penalties_per_60 double precision null,
  o_zone_start_pct_5v5 double precision null,
  on_ice_shooting_pct_5v5 double precision null,
  points_5v5 integer null,
  points_per_60_5v5 double precision null,
  primary_assists_5v5 integer null,
  primary_assists_per_60_5v5 double precision null,
  sat_relative_5v5 double precision null,
  secondary_assists_5v5 integer null,
  secondary_assists_per_60_5v5 double precision null,
  assists_per_game double precision null,
  blocks_per_game double precision null,
  goals_per_game double precision null,
  hits_per_game double precision null,
  penalty_minutes_per_game double precision null,
  primary_assists_per_game double precision null,
  secondary_assists_per_game double precision null,
  shots_per_game double precision null,
  total_primary_assists integer null,
  total_secondary_assists integer null,
  goals_backhand integer null,
  goals_bat integer null,
  goals_between_legs integer null,
  goals_cradle integer null,
  goals_deflected integer null,
  goals_poke integer null,
  goals_slap integer null,
  goals_snap integer null,
  goals_tip_in integer null,
  goals_wrap_around integer null,
  goals_wrist integer null,
  shooting_pct_backhand double precision null,
  shooting_pct_bat double precision null,
  shooting_pct_between_legs double precision null,
  shooting_pct_cradle double precision null,
  shooting_pct_deflected double precision null,
  shooting_pct_poke double precision null,
  shooting_pct_slap double precision null,
  shooting_pct_snap double precision null,
  shooting_pct_tip_in double precision null,
  shooting_pct_wrap_around double precision null,
  shooting_pct_wrist double precision null,
  shots_on_net_backhand integer null,
  shots_on_net_bat integer null,
  shots_on_net_between_legs integer null,
  shots_on_net_cradle integer null,
  shots_on_net_deflected integer null,
  shots_on_net_poke integer null,
  shots_on_net_slap integer null,
  shots_on_net_snap integer null,
  shots_on_net_tip_in integer null,
  shots_on_net_wrap_around integer null,
  shots_on_net_wrist integer null,
  ev_time_on_ice integer null,
  ev_time_on_ice_per_game double precision null,
  ot_time_on_ice integer null,
  ot_time_on_ice_per_game double precision null,
  shifts integer null,
  shifts_per_game double precision null,
  time_on_ice_per_shift double precision null,
  birth_city text null,
  birth_date text null,
  current_team_abbreviation text null,
  current_team_name text null,
  draft_overall integer null,
  draft_round integer null,
  draft_year integer null,
  first_season_for_game_type integer null,
  nationality_code text null,
  weight integer null,
  height integer null,
  birth_country text null,
  season_id integer null,
  constraint wgo_skater_stats_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_wgo_skater_stats_player_id on public.wgo_skater_stats using btree (player_id) TABLESPACE pg_default;

create index IF not exists idx_wgo_skater_stats_player_date on public.wgo_skater_stats using btree (player_id, date desc) TABLESPACE pg_default;

create index IF not exists idx_wgo_skater_stats_date on public.wgo_skater_stats using btree (date desc) TABLESPACE pg_default;

create unique INDEX IF not exists wgo_skater_stats_player_id_date_key on public.wgo_skater_stats using btree (player_id, date) TABLESPACE pg_default;

create index IF not exists skater_name_norm_btree on public.wgo_skater_stats using btree (immutable_unaccent (lower(player_name))) TABLESPACE pg_default;
```

### wgo_skater_stats_totals

```sql
create table public.wgo_skater_stats_totals (
  player_id integer not null,
  player_name text null,
  season text not null,
  shoots_catches text null,
  position_code text null,
  games_played integer null,
  points integer null,
  points_per_game double precision null,
  goals integer null,
  assists integer null,
  shots integer null,
  shooting_percentage double precision null,
  plus_minus integer null,
  ot_goals integer null,
  gw_goals integer null,
  pp_points integer null,
  fow_percentage double precision null,
  toi_per_game double precision null,
  blocked_shots integer null,
  blocks_per_60 double precision null,
  empty_net_goals integer null,
  empty_net_points integer null,
  giveaways integer null,
  giveaways_per_60 double precision null,
  hits integer null,
  hits_per_60 double precision null,
  missed_shots integer null,
  takeaways integer null,
  takeaways_per_60 double precision null,
  d_zone_fo_percentage double precision null,
  d_zone_faceoffs integer null,
  ev_faceoff_percentage double precision null,
  ev_faceoffs integer null,
  n_zone_fo_percentage double precision null,
  n_zone_faceoffs integer null,
  o_zone_fo_percentage double precision null,
  o_zone_faceoffs integer null,
  pp_faceoff_percentage double precision null,
  pp_faceoffs integer null,
  sh_faceoff_percentage double precision null,
  sh_faceoffs integer null,
  total_faceoffs integer null,
  d_zone_fol integer null,
  d_zone_fow integer null,
  ev_fol integer null,
  ev_fow integer null,
  n_zone_fol integer null,
  n_zone_fow integer null,
  o_zone_fol integer null,
  o_zone_fow integer null,
  pp_fol integer null,
  pp_fow integer null,
  sh_fol integer null,
  sh_fow integer null,
  total_fol integer null,
  total_fow integer null,
  es_goals_against integer null,
  es_goals_for integer null,
  es_goals_for_percentage double precision null,
  es_toi_per_game double precision null,
  pp_goals_against integer null,
  pp_goals_for integer null,
  pp_toi_per_game double precision null,
  sh_goals_against integer null,
  sh_goals_for integer null,
  sh_toi_per_game double precision null,
  game_misconduct_penalties integer null,
  major_penalties integer null,
  match_penalties integer null,
  minor_penalties integer null,
  misconduct_penalties integer null,
  penalties integer null,
  penalties_drawn integer null,
  penalties_drawn_per_60 double precision null,
  penalties_taken_per_60 double precision null,
  penalty_minutes integer null,
  penalty_minutes_per_toi double precision null,
  penalty_seconds_per_game double precision null,
  pp_goals_against_per_60 double precision null,
  sh_assists integer null,
  sh_goals integer null,
  sh_points integer null,
  sh_goals_per_60 double precision null,
  sh_individual_sat_for integer null,
  sh_individual_sat_per_60 double precision null,
  sh_points_per_60 double precision null,
  sh_primary_assists integer null,
  sh_primary_assists_per_60 double precision null,
  sh_secondary_assists integer null,
  sh_secondary_assists_per_60 double precision null,
  sh_shooting_percentage double precision null,
  sh_shots integer null,
  sh_shots_per_60 double precision null,
  sh_time_on_ice integer null,
  sh_time_on_ice_pct_per_game double precision null,
  pp_assists integer null,
  pp_goals integer null,
  pp_goals_for_per_60 double precision null,
  pp_goals_per_60 double precision null,
  pp_individual_sat_for integer null,
  pp_individual_sat_per_60 double precision null,
  pp_points_per_60 double precision null,
  pp_primary_assists integer null,
  pp_primary_assists_per_60 double precision null,
  pp_secondary_assists integer null,
  pp_secondary_assists_per_60 double precision null,
  pp_shooting_percentage double precision null,
  pp_shots integer null,
  pp_shots_per_60 double precision null,
  pp_toi integer null,
  pp_toi_pct_per_game double precision null,
  goals_pct double precision null,
  faceoff_pct_5v5 double precision null,
  individual_sat_for_per_60 double precision null,
  individual_shots_for_per_60 double precision null,
  on_ice_shooting_pct double precision null,
  sat_pct double precision null,
  toi_per_game_5v5 double precision null,
  usat_pct double precision null,
  zone_start_pct double precision null,
  sat_against integer null,
  sat_ahead integer null,
  sat_behind integer null,
  sat_close integer null,
  sat_for integer null,
  sat_tied integer null,
  sat_total integer null,
  usat_against integer null,
  usat_ahead integer null,
  usat_behind integer null,
  usat_close integer null,
  usat_for integer null,
  usat_tied integer null,
  usat_total integer null,
  sat_percentage double precision null,
  sat_percentage_ahead double precision null,
  sat_percentage_behind double precision null,
  sat_percentage_close double precision null,
  sat_percentage_tied double precision null,
  sat_relative double precision null,
  shooting_percentage_5v5 double precision null,
  skater_save_pct_5v5 double precision null,
  skater_shooting_plus_save_pct_5v5 double precision null,
  usat_percentage double precision null,
  usat_percentage_ahead double precision null,
  usat_percentage_behind double precision null,
  usat_percentage_close double precision null,
  usat_percentage_tied double precision null,
  usat_relative double precision null,
  zone_start_pct_5v5 double precision null,
  assists_5v5 integer null,
  assists_per_60_5v5 double precision null,
  goals_5v5 integer null,
  goals_per_60_5v5 double precision null,
  o_zone_start_pct_5v5 double precision null,
  on_ice_shooting_pct_5v5 double precision null,
  points_5v5 integer null,
  points_per_60_5v5 double precision null,
  primary_assists_5v5 integer null,
  primary_assists_per_60_5v5 double precision null,
  sat_relative_5v5 double precision null,
  secondary_assists_5v5 integer null,
  secondary_assists_per_60_5v5 double precision null,
  total_primary_assists integer null,
  total_secondary_assists integer null,
  goals_backhand integer null,
  goals_bat integer null,
  goals_between_legs integer null,
  goals_cradle integer null,
  goals_deflected integer null,
  goals_poke integer null,
  goals_slap integer null,
  goals_snap integer null,
  goals_tip_in integer null,
  goals_wrap_around integer null,
  goals_wrist integer null,
  shots_on_net_backhand integer null,
  shots_on_net_bat integer null,
  shots_on_net_between_legs integer null,
  shots_on_net_cradle integer null,
  shots_on_net_deflected integer null,
  shots_on_net_poke integer null,
  shots_on_net_slap integer null,
  shots_on_net_snap integer null,
  shots_on_net_tip_in integer null,
  shots_on_net_wrap_around integer null,
  shots_on_net_wrist integer null,
  ev_time_on_ice integer null,
  ev_time_on_ice_per_game double precision null,
  ot_time_on_ice integer null,
  ot_time_on_ice_per_game double precision null,
  shifts integer null,
  shifts_per_game double precision null,
  time_on_ice_per_shift double precision null,
  birth_city text null,
  birth_date text null,
  current_team_abbreviation text null,
  current_team_name text null,
  draft_overall integer null,
  draft_round integer null,
  draft_year integer null,
  first_season_for_game_type integer null,
  nationality_code text null,
  weight integer null,
  height integer null,
  birth_country text null,
  updated_at timestamp with time zone null,
  constraint wgo_skater_stats_totals_pkey primary key (player_id, season),
  constraint unique_player_season unique (player_id, season)
) TABLESPACE pg_default;

create unique INDEX IF not exists idx_wgo_skater_stats_totals_player_season on public.wgo_skater_stats_totals using btree (player_id, season) TABLESPACE pg_default;
```

### wgo_goalie_stats

```sql
create table public.wgo_goalie_stats (
  goalie_id integer not null,
  goalie_name text not null,
  date date not null,
  shoots_catches text null,
  position_code text null,
  games_played integer null,
  games_started integer null,
  wins integer null,
  losses integer null,
  ot_losses integer null,
  save_pct double precision null,
  saves integer null,
  goals_against integer null,
  goals_against_avg double precision null,
  shots_against integer null,
  time_on_ice double precision null,
  shutouts integer null,
  goals integer null,
  assists integer null,
  complete_game_pct double precision null,
  complete_games integer null,
  incomplete_games integer null,
  quality_start integer null,
  quality_starts_pct double precision null,
  regulation_losses integer null,
  regulation_wins integer null,
  shots_against_per_60 double precision null,
  games_played_days_rest_0 integer null,
  games_played_days_rest_1 integer null,
  games_played_days_rest_2 integer null,
  games_played_days_rest_3 integer null,
  games_played_days_rest_4_plus integer null,
  save_pct_days_rest_0 double precision null,
  save_pct_days_rest_1 double precision null,
  save_pct_days_rest_2 double precision null,
  save_pct_days_rest_3 double precision null,
  save_pct_days_rest_4_plus double precision null,
  season_id integer null,
  team_abbreviation text null,
  constraint wgo_goalie_stats_pkey primary key (goalie_id, date),
  constraint unique_goalie_date unique (goalie_id, date)
) TABLESPACE pg_default;

create index IF not exists idx_wgo_goalie_stats_date on public.wgo_goalie_stats using btree (date desc) TABLESPACE pg_default;

create index IF not exists goalie_name_norm_btree on public.wgo_goalie_stats using btree (immutable_unaccent (lower(goalie_name))) TABLESPACE pg_default;
```

### wgo_goalie_stats_totals

```sql
create table public.wgo_goalie_stats_totals (
  goalie_id bigint not null,
  goalie_name text null,
  season_id integer not null,
  shoots_catches text null,
  games_played integer null,
  games_started integer null,
  wins integer null,
  losses integer null,
  ot_losses integer null,
  save_pct numeric null,
  saves integer null,
  goals_against integer null,
  goals_against_avg numeric null,
  shots_against integer null,
  time_on_ice numeric null,
  shutouts integer null,
  goals integer null,
  assists integer null,
  complete_game_pct numeric null,
  complete_games integer null,
  incomplete_games integer null,
  quality_start integer null,
  quality_starts_pct numeric null,
  regulation_losses integer null,
  regulation_wins integer null,
  shots_against_per_60 numeric null,
  team_abbrevs text null,
  updated_at timestamp with time zone null default now(),
  current_team_abbreviation text null,
  constraint wgo_goalie_stats_totals_pkey primary key (goalie_id, season_id)
) TABLESPACE pg_default;
```

### nst_gamelog_as_counts 

```sql
create table public.nst_gamelog_as_counts (
  id bigserial not null,
  player_id bigint not null,
  season integer not null,
  date_scraped date not null,
  gp smallint null,
  toi integer null,
  goals smallint null,
  total_assists smallint null,
  first_assists smallint null,
  second_assists smallint null,
  total_points smallint null,
  shots smallint null,
  ixg double precision null,
  icf smallint null,
  iff smallint null,
  iscfs smallint null,
  hdcf smallint null,
  rush_attempts smallint null,
  rebounds_created smallint null,
  pim smallint null,
  total_penalties smallint null,
  minor_penalties smallint null,
  major_penalties smallint null,
  misconduct_penalties smallint null,
  penalties_drawn smallint null,
  giveaways smallint null,
  takeaways smallint null,
  hits smallint null,
  hits_taken smallint null,
  shots_blocked smallint null,
  faceoffs_won smallint null,
  faceoffs_lost smallint null,
  ipp numeric null,
  constraint nst_gamelog_as_counts_pkey primary key (id),
  constraint nst_gamelog_as_counts_unique unique (player_id, date_scraped),
  constraint unique_player_date_as_counts unique (player_id, date_scraped),
  constraint nst_gamelog_as_counts_player_id_fkey foreign KEY (player_id) references players (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_nst_gamelog_as_counts_player_date on public.nst_gamelog_as_counts using btree (player_id, date_scraped desc) TABLESPACE pg_default;
```

### nst_gamelog_as_counts_oi

```sql
create table public.nst_gamelog_as_counts_oi (
  player_id integer not null,
  gp integer null,
  cf integer null,
  ca integer null,
  cf_pct double precision null,
  ff integer null,
  fa integer null,
  ff_pct double precision null,
  sf integer null,
  sa integer null,
  sf_pct double precision null,
  gf integer null,
  ga integer null,
  gf_pct double precision null,
  xgf double precision null,
  xga double precision null,
  xgf_pct double precision null,
  scf integer null,
  sca integer null,
  scf_pct double precision null,
  hdcf integer null,
  hdca integer null,
  hdcf_pct double precision null,
  hdgf integer null,
  mdcf integer null,
  mdca integer null,
  mdcf_pct double precision null,
  mdgf integer null,
  mdga integer null,
  mdgf_pct double precision null,
  ldcf integer null,
  ldca integer null,
  ldcf_pct double precision null,
  ldgf integer null,
  ldga integer null,
  ldgf_pct double precision null,
  on_ice_sh_pct double precision null,
  on_ice_sv_pct double precision null,
  off_zone_starts integer null,
  neu_zone_starts integer null,
  def_zone_starts integer null,
  off_zone_start_pct double precision null,
  off_zone_faceoffs integer null,
  neu_zone_faceoffs integer null,
  def_zone_faceoffs integer null,
  off_zone_faceoff_pct double precision null,
  date_scraped date not null,
  season integer not null,
  toi integer null,
  pdo double precision null,
  hdga double precision null,
  hdgf_pct double precision null,
  id bigserial not null,
  shots_blocked integer null,
  constraint nst_gamelog_as_counts_oi_pkey primary key (id),
  constraint nst_gamelog_as_counts_oi_unique unique (player_id, date_scraped),
  constraint unique_player_date_as_counts_oi unique (player_id, date_scraped)
) TABLESPACE pg_default;

create index IF not exists idx_nst_gamelog_as_counts_oi_player_date on public.nst_gamelog_as_counts_oi using btree (player_id, date_scraped desc) TABLESPACE pg_default;
```

### nst_gamelog_as_rates

```sql
create table public.nst_gamelog_as_rates (
  id bigserial not null,
  player_id bigint not null,
  season integer not null,
  date_scraped date not null,
  gp smallint null,
  toi integer null,
  toi_per_gp double precision null,
  icf_per_60 double precision null,
  hdcf_per_60 double precision null,
  cf_pct numeric null,
  ff_pct numeric null,
  sf_pct numeric null,
  gf_pct numeric null,
  xgf_pct numeric null,
  scf_pct numeric null,
  hdcf_pct numeric null,
  hdgf_pct numeric null,
  mdcf_pct numeric null,
  mdgf_pct numeric null,
  ldcf_pct numeric null,
  ldgf_pct numeric null,
  on_ice_sh_pct numeric null,
  on_ice_sv_pct numeric null,
  pdo numeric null,
  off_zone_start_pct numeric null,
  off_zone_faceoff_pct numeric null,
  cf_per_60 numeric null,
  ca_per_60 numeric null,
  ff_per_60 numeric null,
  fa_per_60 numeric null,
  sf_per_60 numeric null,
  sa_per_60 numeric null,
  gf_per_60 numeric null,
  ga_per_60 numeric null,
  xgf_per_60 numeric null,
  xga_per_60 numeric null,
  scf_per_60 numeric null,
  sca_per_60 numeric null,
  hdca_per_60 numeric null,
  hdgf_per_60 numeric null,
  hdga_per_60 numeric null,
  mdcf_per_60 numeric null,
  mdca_per_60 numeric null,
  mdgf_per_60 numeric null,
  mdga_per_60 numeric null,
  ldcf_per_60 numeric null,
  ldca_per_60 numeric null,
  ldgf_per_60 numeric null,
  ldga_per_60 numeric null,
  off_zone_starts_per_60 numeric null,
  neu_zone_starts_per_60 numeric null,
  def_zone_starts_per_60 numeric null,
  off_zone_faceoffs_per_60 numeric null,
  neu_zone_faceoffs_per_60 numeric null,
  def_zone_faceoffs_per_60 numeric null,
  goals_per_60 numeric null,
  total_assists_per_60 numeric null,
  first_assists_per_60 numeric null,
  second_assists_per_60 numeric null,
  shots_per_60 numeric null,
  ixg_per_60 numeric null,
  iff_per_60 numeric null,
  iscf_per_60 numeric null,
  ihdcf_per_60 numeric null,
  rush_attempts_per_60 numeric null,
  rebounds_created_per_60 numeric null,
  pim_per_60 numeric null,
  penalties_drawn_per_60 numeric null,
  giveaways_per_60 numeric null,
  takeaways_per_60 numeric null,
  hits_per_60 numeric null,
  shots_blocked_per_60 numeric null,
  faceoffs_won_per_60 numeric null,
  faceoffs_lost_per_60 numeric null,
  hits_taken_per_60 numeric null,
  total_points_per_60 numeric null,
  iscfs_per_60 numeric null,
  constraint nst_gamelog_as_rates_pkey primary key (id),
  constraint nst_gamelog_as_rates_unique unique (player_id, date_scraped),
  constraint unique_player_date_as_rates unique (player_id, date_scraped),
  constraint nst_gamelog_as_rates_player_id_fkey foreign KEY (player_id) references players (id) on delete CASCADE
) TABLESPACE pg_default;
```

### nst_gamelog_as_rates_oi

```sql
create table public.nst_gamelog_as_rates_oi (
  player_id bigint not null,
  position text null,
  gp integer null,
  toi integer null,
  toi_per_gp double precision null,
  cf_per_60 double precision null,
  ca_per_60 double precision null,
  cf_pct double precision null,
  ff_per_60 double precision null,
  fa_per_60 double precision null,
  ff_pct double precision null,
  sf_per_60 double precision null,
  sa_per_60 double precision null,
  sf_pct double precision null,
  gf_per_60 double precision null,
  ga_per_60 double precision null,
  gf_pct double precision null,
  xgf_per_60 double precision null,
  xga_per_60 double precision null,
  xgf_pct double precision null,
  scf_per_60 double precision null,
  sca_per_60 double precision null,
  scf_pct double precision null,
  hdcf_per_60 double precision null,
  hdca_per_60 double precision null,
  hdcf_pct double precision null,
  hdgf_per_60 double precision null,
  hdga_per_60 double precision null,
  hdgf_pct double precision null,
  mdcf_per_60 double precision null,
  mdca_per_60 double precision null,
  mdcf_pct double precision null,
  mdgf_per_60 double precision null,
  mdga_per_60 double precision null,
  mdgf_pct double precision null,
  ldcf_per_60 double precision null,
  ldca_per_60 double precision null,
  ldcf_pct double precision null,
  ldgf_per_60 double precision null,
  ldga_per_60 double precision null,
  ldgf_pct double precision null,
  on_ice_sh_pct double precision null,
  on_ice_sv_pct double precision null,
  pdo double precision null,
  off_zone_starts_per_60 double precision null,
  neu_zone_starts_per_60 double precision null,
  def_zone_starts_per_60 double precision null,
  off_zone_start_pct double precision null,
  off_zone_faceoffs_per_60 double precision null,
  neu_zone_faceoffs_per_60 double precision null,
  def_zone_faceoffs_per_60 double precision null,
  off_zone_faceoff_pct double precision null,
  date_scraped date not null,
  season integer not null,
  id bigserial not null,
  constraint nst_gamelog_as_rates_oi_pkey primary key (id),
  constraint nst_gamelog_as_rates_oi_unique unique (player_id, date_scraped),
  constraint unique_player_date_as_rates_oi unique (player_id, date_scraped)
) TABLESPACE pg_default;
```

### nst_seasonlong_as_counts (VIEW)

| column_name          | data_type        | is_nullable | column_default | character_maximum_length |
| -------------------- | ---------------- | ----------- | -------------- | ------------------------ |
| player_id            | bigint           | YES         | null           | null                     |
| season               | integer          | YES         | null           | null                     |
| gp                   | bigint           | YES         | null           | null                     |
| toi_seconds          | bigint           | YES         | null           | null                     |
| goals                | bigint           | YES         | null           | null                     |
| total_assists        | bigint           | YES         | null           | null                     |
| first_assists        | bigint           | YES         | null           | null                     |
| second_assists       | bigint           | YES         | null           | null                     |
| total_points         | bigint           | YES         | null           | null                     |
| shots                | bigint           | YES         | null           | null                     |
| sh_percentage        | double precision | YES         | null           | null                     |
| ixg                  | double precision | YES         | null           | null                     |
| icf                  | bigint           | YES         | null           | null                     |
| iff                  | bigint           | YES         | null           | null                     |
| iscfs                | bigint           | YES         | null           | null                     |
| hdcf                 | bigint           | YES         | null           | null                     |
| rush_attempts        | bigint           | YES         | null           | null                     |
| rebounds_created     | bigint           | YES         | null           | null                     |
| pim                  | bigint           | YES         | null           | null                     |
| total_penalties      | bigint           | YES         | null           | null                     |
| minor_penalties      | bigint           | YES         | null           | null                     |
| major_penalties      | bigint           | YES         | null           | null                     |
| misconduct_penalties | bigint           | YES         | null           | null                     |
| penalties_drawn      | bigint           | YES         | null           | null                     |
| giveaways            | bigint           | YES         | null           | null                     |
| takeaways            | bigint           | YES         | null           | null                     |
| hits                 | bigint           | YES         | null           | null                     |
| hits_taken           | bigint           | YES         | null           | null                     |
| shots_blocked        | bigint           | YES         | null           | null                     |
| faceoffs_won         | bigint           | YES         | null           | null                     |
| faceoffs_lost        | bigint           | YES         | null           | null                     |
| faceoffs_percentage  | double precision | YES         | null           | null                     |

### nst_seasonlong_as_counts_oi

| column_name       | data_type        | is_nullable | column_default | character_maximum_length |
| ----------------- | ---------------- | ----------- | -------------- | ------------------------ |
| player_id         | integer          | YES         | null           | null                     |
| season            | integer          | YES         | null           | null                     |
| gp                | bigint           | YES         | null           | null                     |
| toi_seconds_oi    | bigint           | YES         | null           | null                     |
| cf                | bigint           | YES         | null           | null                     |
| ca                | bigint           | YES         | null           | null                     |
| ff                | bigint           | YES         | null           | null                     |
| fa                | bigint           | YES         | null           | null                     |
| sf                | bigint           | YES         | null           | null                     |
| sa                | bigint           | YES         | null           | null                     |
| gf                | bigint           | YES         | null           | null                     |
| ga                | bigint           | YES         | null           | null                     |
| xgf               | double precision | YES         | null           | null                     |
| xga               | double precision | YES         | null           | null                     |
| scf               | bigint           | YES         | null           | null                     |
| sca               | bigint           | YES         | null           | null                     |
| hdcf              | bigint           | YES         | null           | null                     |
| hdca              | bigint           | YES         | null           | null                     |
| hdgf              | bigint           | YES         | null           | null                     |
| hdga              | bigint           | YES         | null           | null                     |
| mdcf              | bigint           | YES         | null           | null                     |
| mdca              | bigint           | YES         | null           | null                     |
| mdgf              | bigint           | YES         | null           | null                     |
| mdga              | bigint           | YES         | null           | null                     |
| ldcf              | bigint           | YES         | null           | null                     |
| ldca              | bigint           | YES         | null           | null                     |
| ldgf              | bigint           | YES         | null           | null                     |
| ldga              | bigint           | YES         | null           | null                     |
| off_zone_starts   | bigint           | YES         | null           | null                     |
| neu_zone_starts   | bigint           | YES         | null           | null                     |
| def_zone_starts   | bigint           | YES         | null           | null                     |
| on_the_fly_starts | bigint           | YES         | null           | null                     |
| off_zone_faceoffs | bigint           | YES         | null           | null                     |
| neu_zone_faceoffs | bigint           | YES         | null           | null                     |
| def_zone_faceoffs | bigint           | YES         | null           | null                     |

### nst_seasonlong_as_rates

| column_name                 | data_type        | is_nullable | column_default | character_maximum_length |
| --------------------------- | ---------------- | ----------- | -------------- | ------------------------ |
| player_id                   | bigint           | YES         | null           | null                     |
| season                      | integer          | YES         | null           | null                     |
| gp                          | bigint           | YES         | null           | null                     |
| toi_seconds                 | bigint           | YES         | null           | null                     |
| goals_per_60                | double precision | YES         | null           | null                     |
| total_assists_per_60        | double precision | YES         | null           | null                     |
| first_assists_per_60        | double precision | YES         | null           | null                     |
| second_assists_per_60       | double precision | YES         | null           | null                     |
| total_points_per_60         | double precision | YES         | null           | null                     |
| shots_per_60                | double precision | YES         | null           | null                     |
| ixg_per_60                  | double precision | YES         | null           | null                     |
| icf_per_60                  | double precision | YES         | null           | null                     |
| iff_per_60                  | double precision | YES         | null           | null                     |
| iscfs_per_60                | double precision | YES         | null           | null                     |
| ihdcf_per_60                | double precision | YES         | null           | null                     |
| rush_attempts_per_60        | double precision | YES         | null           | null                     |
| rebounds_created_per_60     | double precision | YES         | null           | null                     |
| pim_per_60                  | double precision | YES         | null           | null                     |
| total_penalties_per_60      | double precision | YES         | null           | null                     |
| minor_penalties_per_60      | double precision | YES         | null           | null                     |
| major_penalties_per_60      | double precision | YES         | null           | null                     |
| misconduct_penalties_per_60 | double precision | YES         | null           | null                     |
| penalties_drawn_per_60      | double precision | YES         | null           | null                     |
| giveaways_per_60            | double precision | YES         | null           | null                     |
| takeaways_per_60            | double precision | YES         | null           | null                     |
| hits_per_60                 | double precision | YES         | null           | null                     |
| hits_taken_per_60           | double precision | YES         | null           | null                     |
| shots_blocked_per_60        | double precision | YES         | null           | null                     |
| faceoffs_won_per_60         | double precision | YES         | null           | null                     |
| faceoffs_lost_per_60        | double precision | YES         | null           | null                     |
| sh_percentage               | double precision | YES         | null           | null                     |
| faceoffs_percentage         | double precision | YES         | null           | null                     |
| ipp                         | double precision | YES         | null           | null                     |

### nst_seasonlong_as_rates_oi

| column_name          | data_type        | is_nullable | column_default | character_maximum_length |
| -------------------- | ---------------- | ----------- | -------------- | ------------------------ |
| player_id            | integer          | YES         | null           | null                     |
| season               | integer          | YES         | null           | null                     |
| gp                   | bigint           | YES         | null           | null                     |
| toi_seconds_oi       | bigint           | YES         | null           | null                     |
| cf_per_60            | double precision | YES         | null           | null                     |
| ca_per_60            | double precision | YES         | null           | null                     |
| ff_per_60            | double precision | YES         | null           | null                     |
| fa_per_60            | double precision | YES         | null           | null                     |
| sf_per_60            | double precision | YES         | null           | null                     |
| sa_per_60            | double precision | YES         | null           | null                     |
| gf_per_60            | double precision | YES         | null           | null                     |
| ga_per_60            | double precision | YES         | null           | null                     |
| xgf_per_60           | double precision | YES         | null           | null                     |
| xga_per_60           | double precision | YES         | null           | null                     |
| scf_per_60           | double precision | YES         | null           | null                     |
| sca_per_60           | double precision | YES         | null           | null                     |
| hdcf_per_60          | double precision | YES         | null           | null                     |
| hdca_per_60          | double precision | YES         | null           | null                     |
| hdgf_per_60          | double precision | YES         | null           | null                     |
| hdga_per_60          | double precision | YES         | null           | null                     |
| mdcf_per_60          | double precision | YES         | null           | null                     |
| mdca_per_60          | double precision | YES         | null           | null                     |
| mdgf_per_60          | double precision | YES         | null           | null                     |
| mdga_per_60          | double precision | YES         | null           | null                     |
| ldcf_per_60          | double precision | YES         | null           | null                     |
| ldca_per_60          | double precision | YES         | null           | null                     |
| ldgf_per_60          | double precision | YES         | null           | null                     |
| ldga_per_60          | double precision | YES         | null           | null                     |
| cf_pct               | double precision | YES         | null           | null                     |
| ff_pct               | double precision | YES         | null           | null                     |
| sf_pct               | double precision | YES         | null           | null                     |
| gf_pct               | double precision | YES         | null           | null                     |
| xgf_pct              | double precision | YES         | null           | null                     |
| scf_pct              | double precision | YES         | null           | null                     |
| hdcf_pct             | double precision | YES         | null           | null                     |
| hdgf_pct             | double precision | YES         | null           | null                     |
| mdcf_pct             | double precision | YES         | null           | null                     |
| mdgf_pct             | double precision | YES         | null           | null                     |
| ldcf_pct             | double precision | YES         | null           | null                     |
| ldgf_pct             | double precision | YES         | null           | null                     |
| on_ice_sh_pct        | double precision | YES         | null           | null                     |
| on_ice_sv_pct        | double precision | YES         | null           | null                     |
| pdo                  | double precision | YES         | null           | null                     |
| off_zone_start_pct   | double precision | YES         | null           | null                     |
| off_zone_faceoff_pct | double precision | YES         | null           | null                     |

### nst_team_all

```sql
create table public.nst_team_all (
  team_abbreviation text not null,
  team_name text not null,
  gp integer null,
  toi integer null,
  w integer null,
  l integer null,
  otl integer null,
  points integer null,
  cf integer null,
  ca integer null,
  cf_pct double precision null,
  ff integer null,
  fa integer null,
  ff_pct double precision null,
  sf integer null,
  sa integer null,
  sf_pct double precision null,
  gf integer null,
  ga integer null,
  gf_pct double precision null,
  xgf double precision null,
  xga double precision null,
  xgf_pct double precision null,
  scf integer null,
  sca integer null,
  scf_pct double precision null,
  hdcf integer null,
  hdca integer null,
  hdcf_pct double precision null,
  hdsf integer null,
  hdsa integer null,
  hdsf_pct double precision null,
  hdgf integer null,
  hdga integer null,
  hdgf_pct double precision null,
  sh_pct double precision null,
  sv_pct double precision null,
  pdo numeric(6, 3) null,
  date date not null,
  situation text not null default 'all'::text,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint nst_team_all_pkey primary key (team_abbreviation, date)
) TABLESPACE pg_default;
```

### nst_team_stats

```sql
create table public.nst_team_stats (
  team_abbreviation text not null,
  team_name text not null,
  gp integer null,
  toi bigint null,
  w integer null,
  l integer null,
  otl integer null,
  points integer null,
  cf integer null,
  ca integer null,
  cf_pct double precision null,
  ff integer null,
  fa integer null,
  ff_pct double precision null,
  sf integer null,
  sa integer null,
  sf_pct double precision null,
  gf integer null,
  ga integer null,
  gf_pct double precision null,
  xgf double precision null,
  xga double precision null,
  xgf_pct double precision null,
  scf integer null,
  sca integer null,
  scf_pct double precision null,
  hdcf integer null,
  hdca integer null,
  hdcf_pct double precision null,
  hdsf integer null,
  hdsa integer null,
  hdsf_pct double precision null,
  hdgf integer null,
  hdga integer null,
  hdgf_pct double precision null,
  sh_pct double precision null,
  sv_pct double precision null,
  pdo numeric(6, 3) null,
  season integer not null,
  situation text not null default 'all'::text,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint nst_team_stats_pkey primary key (team_abbreviation, season)
) TABLESPACE pg_default;

create trigger set_updated_at BEFORE
update on nst_team_stats for EACH row
execute FUNCTION update_updated_at_column ();
```

### wgo_team_stats

```sql
create table public.wgo_team_stats (
  id serial not null,
  team_id integer null,
  franchise_name text not null,
  date date not null,
  games_played integer null,
  goals_against integer null,
  goals_against_per_game double precision null,
  goals_for integer null,
  goals_for_per_game double precision null,
  losses integer null,
  ot_losses integer null,
  penalty_kill_net_pct double precision null,
  penalty_kill_pct double precision null,
  point_pct double precision null,
  points integer null,
  power_play_net_pct double precision null,
  power_play_pct double precision null,
  regulation_and_ot_wins integer null,
  shots_against_per_game double precision null,
  shots_for_per_game double precision null,
  wins integer null,
  wins_in_regulation integer null,
  wins_in_shootout integer null,
  faceoff_win_pct double precision null,
  blocked_shots integer null,
  blocked_shots_per_60 double precision null,
  empty_net_goals integer null,
  giveaways integer null,
  giveaways_per_60 double precision null,
  hits integer null,
  hits_per_60 double precision null,
  missed_shots integer null,
  sat_pct double precision null,
  takeaways integer null,
  takeaways_per_60 double precision null,
  time_on_ice_per_game_5v5 double precision null,
  bench_minor_penalties integer null,
  game_misconducts integer null,
  major_penalties integer null,
  match_penalties integer null,
  minor_penalties integer null,
  misconduct_penalties integer null,
  net_penalties integer null,
  net_penalties_per_60 double precision null,
  penalties integer null,
  penalties_drawn_per_60 double precision null,
  penalties_taken_per_60 double precision null,
  penalty_minutes integer null,
  penalty_seconds_per_game double precision null,
  total_penalties_drawn integer null,
  pk_net_goals integer null,
  pk_net_goals_per_game double precision null,
  pp_goals_against integer null,
  pp_goals_against_per_game double precision null,
  sh_goals_for integer null,
  sh_goals_for_per_game double precision null,
  times_shorthanded integer null,
  times_shorthanded_per_game double precision null,
  power_play_goals_for integer null,
  pp_goals_per_game double precision null,
  pp_net_goals integer null,
  pp_net_goals_per_game double precision null,
  pp_opportunities integer null,
  pp_opportunities_per_game double precision null,
  pp_time_on_ice_per_game double precision null,
  sh_goals_against integer null,
  sh_goals_against_per_game double precision null,
  goals_4v3 integer null,
  goals_5v3 integer null,
  goals_5v4 integer null,
  opportunities_4v3 integer null,
  opportunities_5v3 integer null,
  opportunities_5v4 integer null,
  overall_power_play_pct double precision null,
  pp_pct_4v3 double precision null,
  pp_pct_5v3 double precision null,
  pp_pct_5v4 double precision null,
  toi_4v3 double precision null,
  toi_5v3 double precision null,
  toi_5v4 double precision null,
  toi_pp double precision null,
  goals_against_3v4 integer null,
  goals_against_3v5 integer null,
  goals_against_4v5 integer null,
  overall_penalty_kill_pct double precision null,
  pk_3v4_pct double precision null,
  pk_3v5_pct double precision null,
  pk_4v5_pct double precision null,
  toi_3v4 double precision null,
  toi_3v5 double precision null,
  toi_4v5 double precision null,
  toi_shorthanded double precision null,
  times_shorthanded_3v4 integer null,
  times_shorthanded_3v5 integer null,
  times_shorthanded_4v5 integer null,
  sat_against integer null,
  sat_behind integer null,
  sat_close integer null,
  sat_for integer null,
  sat_tied integer null,
  sat_total integer null,
  shots_5v5 integer null,
  usat_against integer null,
  usat_ahead integer null,
  usat_behind integer null,
  usat_close integer null,
  usat_for integer null,
  usat_tied integer null,
  usat_total integer null,
  goals_for_percentage double precision null,
  sat_percentage double precision null,
  sat_pct_ahead double precision null,
  sat_pct_behind double precision null,
  sat_pct_close double precision null,
  sat_pct_tied double precision null,
  save_pct_5v5 double precision null,
  shooting_pct_5v5 double precision null,
  shooting_plus_save_pct_5v5 double precision null,
  usat_pct double precision null,
  usat_pct_ahead double precision null,
  usat_pct_behind double precision null,
  usat_pct_close double precision null,
  usat_pct_tied double precision null,
  zone_start_pct_5v5 double precision null,
  d_zone_faceoff_pct double precision null,
  d_zone_faceoffs integer null,
  ev_faceoff_pct double precision null,
  ev_faceoffs integer null,
  neutral_zone_faceoff_pct double precision null,
  neutral_zone_faceoffs integer null,
  o_zone_faceoff_pct double precision null,
  o_zone_faceoffs integer null,
  pp_faceoff_pct double precision null,
  pp_faceoffs integer null,
  sh_faceoff_pct double precision null,
  sh_faceoffs integer null,
  total_faceoffs integer null,
  d_zone_fol integer null,
  d_zone_fow integer null,
  d_zone_fo integer null,
  ev_fo integer null,
  ev_fol integer null,
  ev_fow integer null,
  faceoffs_lost integer null,
  faceoffs_won integer null,
  neutral_zone_fol integer null,
  neutral_zone_fow integer null,
  neutral_zone_fo integer null,
  o_zone_fol integer null,
  o_zone_fow integer null,
  o_zone_fo integer null,
  pp_fol integer null,
  pp_fow integer null,
  sh_fol integer null,
  sh_fow integer null,
  season_id integer null,
  game_id bigint null,
  opponent_id integer null,
  constraint wgo_team_stats_pkey primary key (id),
  constraint unique_season_team_date unique (season_id, team_id, date)
) TABLESPACE pg_default;
```

### yahoo_nhl_player_map

```sql
create table public.yahoo_nhl_player_map (
  nhl_player_id text null,
  nhl_player_name text null,
  nhl_team_abbreviation text null,
  name_norm text null,
  player_type text null,
  points numeric null,
  goals numeric null,
  assists numeric null,
  shots numeric null,
  pp_points numeric null,
  blocked_shots numeric null,
  hits numeric null,
  total_fow numeric null,
  penalty_minutes numeric null,
  sh_points numeric null,
  wins numeric null,
  losses numeric null,
  saves numeric null,
  shots_against numeric null,
  shutouts numeric null,
  quality_start numeric null,
  goals_against_avg numeric null,
  save_pct numeric null,
  yahoo_player_id character varying(255) null,
  yahoo_player_name character varying(255) null,
  yahoo_team character varying(10) null,
  percent_ownership double precision null,
  eligible_positions jsonb null,
  injury_note text null,
  status character varying(10) null,
  status_full character varying(255) null
) TABLESPACE pg_default;

create index IF not exists yahoo_nhl_player_map_nhl_id_idx on public.yahoo_nhl_player_map using btree (nhl_player_id) TABLESPACE pg_default;

create index IF not exists yahoo_nhl_player_map_yahoo_id_idx on public.yahoo_nhl_player_map using btree (yahoo_player_id) TABLESPACE pg_default;
```

### yahoo_nhl_player_map_mat

```sql
 SELECT m.nhl_player_id,
    m.nhl_player_name,
    m.nhl_team_abbreviation,
    m.yahoo_player_id,
    m.yahoo_player_name,
    m.yahoo_team,
    m.percent_ownership,
    m.eligible_positions,
    m.injury_note,
    m.status,
    m.status_full,
    m.points,
    m.goals,
    m.assists,
    m.shots,
    m.pp_points,
    m.blocked_shots,
    m.hits,
    m.total_fow,
    m.penalty_minutes,
    m.sh_points,
    m.wins,
    m.losses,
    m.saves,
    m.shots_against,
    m.shutouts,
    m.quality_start,
    m.goals_against_avg,
    m.save_pct,
    m.player_type,
        CASE
            WHEN m.player_type = 'goalie'::text THEN 'G'::text
            ELSE 'Skater'::text
        END AS player_position,
        CASE
            WHEN m.player_type = 'goalie'::text THEN 'G'::text
            ELSE 'Skater'::text
        END AS mapped_position,
        CASE
            WHEN m.player_type = 'goalie'::text THEN 'G'::text
            ELSE 'Skater'::text
        END AS normalized_position,
    immutable_unaccent(lower(COALESCE(m.nhl_team_abbreviation, m.yahoo_team::text))) AS normalized_team,
    NULL::numeric AS percent_games
   FROM yahoo_nhl_player_map m;
```

### yahoo_players

```sql
create table public.yahoo_players (
  player_name character varying(255) null,
  player_id character varying(255) null,
  draft_analysis jsonb null,
  average_draft_pick double precision null,
  average_draft_round double precision null,
  average_draft_cost double precision null,
  percent_drafted double precision null,
  editorial_player_key character varying(255) null,
  editorial_team_abbreviation character varying(10) null,
  editorial_team_full_name character varying(255) null,
  eligible_positions jsonb null,
  display_position text null,
  headshot_url text null,
  injury_note text null,
  full_name character varying(255) null,
  percent_ownership double precision null,
  player_key character varying(255) not null,
  position_type character varying(50) null,
  status character varying(10) null,
  status_full character varying(255) null,
  last_updated timestamp without time zone null default now(),
  uniform_number smallint null,
  ownership_timeline jsonb null default '[]'::jsonb,
  game_id integer null,
  season integer null,
  constraint yahoo_players_pkey primary key (player_key)
) TABLESPACE pg_default;

create unique INDEX IF not exists yahoo_players_player_key_key on public.yahoo_players using btree (player_key) TABLESPACE pg_default;

create unique INDEX IF not exists yahoo_players_player_id_season_key on public.yahoo_players using btree (player_id, season) TABLESPACE pg_default;

create index IF not exists yp_by_season on public.yahoo_players using btree (season) TABLESPACE pg_default;

create index IF not exists yplayers_name_norm_btree on public.yahoo_players using btree (immutable_unaccent (lower((player_name)::text))) TABLESPACE pg_default;

create index IF not exists yplayers_name_norm_trgm on public.yahoo_players using gin (
  immutable_unaccent (lower((player_name)::text)) gin_trgm_ops
) TABLESPACE pg_default;
```

### nhl_standings_details

```sql
create table public.nhl_standings_details (
  season_id integer not null,
  date date not null,
  team_abbrev text not null,
  conference_abbrev text null,
  conference_home_sequence integer null,
  conference_l10_sequence integer null,
  conference_name text null,
  conference_road_sequence integer null,
  conference_sequence integer null,
  division_abbrev text null,
  division_home_sequence integer null,
  division_l10_sequence integer null,
  division_name text null,
  division_road_sequence integer null,
  division_sequence integer null,
  game_type_id integer null,
  games_played integer null,
  goal_differential integer null,
  goal_differential_pctg numeric(6, 5) null,
  goal_against integer null,
  goal_for integer null,
  goals_for_pctg numeric(6, 5) null,
  home_games_played integer null,
  home_goal_differential integer null,
  home_goals_against integer null,
  home_goals_for integer null,
  home_losses integer null,
  home_ot_losses integer null,
  home_points integer null,
  home_regulation_plus_ot_wins integer null,
  home_regulation_wins integer null,
  home_wins integer null,
  l10_games_played integer null,
  l10_goal_differential integer null,
  l10_goals_against integer null,
  l10_goals_for integer null,
  l10_losses integer null,
  l10_ot_losses integer null,
  l10_points integer null,
  l10_regulation_plus_ot_wins integer null,
  l10_regulation_wins integer null,
  l10_wins integer null,
  league_home_sequence integer null,
  league_l10_sequence integer null,
  league_road_sequence integer null,
  league_sequence integer null,
  losses integer null,
  ot_losses integer null,
  place_name text null,
  point_pctg numeric(6, 5) null,
  points integer null,
  regulation_plus_ot_win_pctg numeric(6, 5) null,
  regulation_plus_ot_wins integer null,
  regulation_win_pctg numeric(6, 5) null,
  regulation_wins integer null,
  road_games_played integer null,
  road_goal_differential integer null,
  road_goals_against integer null,
  road_goals_for integer null,
  road_losses integer null,
  road_ot_losses integer null,
  road_points integer null,
  road_regulation_plus_ot_wins integer null,
  road_regulation_wins integer null,
  road_wins integer null,
  shootout_losses integer null,
  shootout_wins integer null,
  streak_code text null,
  streak_count integer null,
  team_name_default text null,
  team_name_fr text null,
  team_common_name text null,
  waivers_sequence integer null,
  wildcard_sequence integer null,
  win_pctg numeric(6, 5) null,
  wins integer null,
  constraint nhl_standings_pkey primary key (season_id, date, team_abbrev)
) TABLESPACE pg_default;
```

### nhl_team_data

```sql
 WITH latest_standings AS (
         SELECT nhl_standings_details.season_id,
            nhl_standings_details.date,
            nhl_standings_details.team_abbrev,
            nhl_standings_details.conference_abbrev,
            nhl_standings_details.conference_home_sequence,
            nhl_standings_details.conference_l10_sequence,
            nhl_standings_details.conference_name,
            nhl_standings_details.conference_road_sequence,
            nhl_standings_details.conference_sequence,
            nhl_standings_details.division_abbrev,
            nhl_standings_details.division_home_sequence,
            nhl_standings_details.division_l10_sequence,
            nhl_standings_details.division_name,
            nhl_standings_details.division_road_sequence,
            nhl_standings_details.division_sequence,
            nhl_standings_details.game_type_id,
            nhl_standings_details.games_played,
            nhl_standings_details.goal_differential,
            nhl_standings_details.goal_differential_pctg,
            nhl_standings_details.goal_against,
            nhl_standings_details.goal_for,
            nhl_standings_details.goals_for_pctg,
            nhl_standings_details.home_games_played,
            nhl_standings_details.home_goal_differential,
            nhl_standings_details.home_goals_against,
            nhl_standings_details.home_goals_for,
            nhl_standings_details.home_losses,
            nhl_standings_details.home_ot_losses,
            nhl_standings_details.home_points,
            nhl_standings_details.home_regulation_plus_ot_wins,
            nhl_standings_details.home_regulation_wins,
            nhl_standings_details.home_wins,
            nhl_standings_details.l10_games_played,
            nhl_standings_details.l10_goal_differential,
            nhl_standings_details.l10_goals_against,
            nhl_standings_details.l10_goals_for,
            nhl_standings_details.l10_losses,
            nhl_standings_details.l10_ot_losses,
            nhl_standings_details.l10_points,
            nhl_standings_details.l10_regulation_plus_ot_wins,
            nhl_standings_details.l10_regulation_wins,
            nhl_standings_details.l10_wins,
            nhl_standings_details.league_home_sequence,
            nhl_standings_details.league_l10_sequence,
            nhl_standings_details.league_road_sequence,
            nhl_standings_details.league_sequence,
            nhl_standings_details.losses,
            nhl_standings_details.ot_losses,
            nhl_standings_details.place_name,
            nhl_standings_details.point_pctg,
            nhl_standings_details.points,
            nhl_standings_details.regulation_plus_ot_win_pctg,
            nhl_standings_details.regulation_plus_ot_wins,
            nhl_standings_details.regulation_win_pctg,
            nhl_standings_details.regulation_wins,
            nhl_standings_details.road_games_played,
            nhl_standings_details.road_goal_differential,
            nhl_standings_details.road_goals_against,
            nhl_standings_details.road_goals_for,
            nhl_standings_details.road_losses,
            nhl_standings_details.road_ot_losses,
            nhl_standings_details.road_points,
            nhl_standings_details.road_regulation_plus_ot_wins,
            nhl_standings_details.road_regulation_wins,
            nhl_standings_details.road_wins,
            nhl_standings_details.shootout_losses,
            nhl_standings_details.shootout_wins,
            nhl_standings_details.streak_code,
            nhl_standings_details.streak_count,
            nhl_standings_details.team_name_default,
            nhl_standings_details.team_name_fr,
            nhl_standings_details.team_common_name,
            nhl_standings_details.waivers_sequence,
            nhl_standings_details.wildcard_sequence,
            nhl_standings_details.win_pctg,
            nhl_standings_details.wins
           FROM nhl_standings_details
          WHERE (nhl_standings_details.date = ( SELECT max(nhl_standings_details_1.date) AS max
                   FROM nhl_standings_details nhl_standings_details_1))
        )
 SELECT ls.season_id,
    ls.date,
    ls.team_abbrev,
    ls.games_played,
    ls.win_pctg,
    ls.goal_for,
    ls.goal_against,
        CASE
            WHEN (ls.games_played > 0) THEN ((ls.goal_for)::numeric / (ls.games_played)::numeric)
            ELSE (0)::numeric
        END AS goal_for_per_game,
        CASE
            WHEN (ls.games_played > 0) THEN ((ls.goal_against)::numeric / (ls.games_played)::numeric)
            ELSE (0)::numeric
        END AS goal_against_per_game,
    ns.cf_pct,
    ns.sf_pct,
    ns.xgf,
    ns.xga,
    ns.sf,
    ns.sa,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.xgf)::numeric / (ns.gp)::numeric)
            ELSE (0)::numeric
        END AS xgf_per_game,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.xga)::numeric / (ns.gp)::numeric)
            ELSE (0)::numeric
        END AS xga_per_game,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.sf)::numeric / (ns.gp)::numeric)
            ELSE (0)::numeric
        END AS sf_per_game,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.sa)::numeric / (ns.gp)::numeric)
            ELSE (0)::numeric
        END AS sa_per_game
   FROM (latest_standings ls
     LEFT JOIN nst_team_stats ns ON ((ns.team_abbreviation = ls.team_abbrev)));
```

### lineCombinations

```sql
create table public."lineCombinations" (
  "gameId" bigint not null,
  "teamId" smallint not null,
  forwards bigint[] not null,
  defensemen bigint[] not null,
  goalies bigint[] not null,
  constraint lineCombinations_pkey primary key ("gameId", "teamId"),
  constraint lineCombinations_gameId_fkey foreign KEY ("gameId") references games (id),
  constraint lineCombinations_teamId_fkey foreign KEY ("teamId") references teams (id)
) TABLESPACE pg_default;

create trigger after_line_combo_insert
after INSERT on "lineCombinations" for EACH row
execute FUNCTION on_new_line_combo ();

create trigger update_power_play_combinations_after_line_combo_insert
after INSERT on "lineCombinations" for EACH row
execute FUNCTION update_power_play_combinations ();
```

### players

```sql
create table public.players (
  id bigint generated by default as identity not null,
  "firstName" text not null,
  "lastName" text not null,
  "fullName" text not null,
  position public.NHL_Position_Code not null,
  "birthDate" date not null,
  "birthCity" text null,
  "birthCountry" text null default 'USA'::text,
  "heightInCentimeters" smallint not null,
  "weightInKilograms" smallint not null,
  image_url text null,
  team_id smallint null,
  sweater_number smallint null,
  constraint players_pkey primary key (id)
) TABLESPACE pg_default;
```

### games 

```sql
create table public.games (
  id bigint not null,
  date date not null,
  "seasonId" bigint not null,
  "startTime" timestamp with time zone not null default now(),
  type smallint null,
  created_at timestamp with time zone not null default now(),
  "homeTeamId" smallint not null,
  "awayTeamId" smallint not null,
  constraint games_pkey primary key (id),
  constraint games_awayTeamId_fkey foreign KEY ("awayTeamId") references teams (id),
  constraint games_homeTeamId_fkey foreign KEY ("homeTeamId") references teams (id),
  constraint games_seasonId_fkey foreign KEY ("seasonId") references seasons (id)
) TABLESPACE pg_default;

create index IF not exists idx_games_date on public.games using btree (date) TABLESPACE pg_default;

create trigger after_game_insert
after INSERT on games for EACH row
execute FUNCTION insert_into_statsupdatestatus ();
```

### powerPlayCombinations

```sql
create table public.games (
  id bigint not null,
  date date not null,
  "seasonId" bigint not null,
  "startTime" timestamp with time zone not null default now(),
  type smallint null,
  created_at timestamp with time zone not null default now(),
  "homeTeamId" smallint not null,
  "awayTeamId" smallint not null,
  constraint games_pkey primary key (id),
  constraint games_awayTeamId_fkey foreign KEY ("awayTeamId") references teams (id),
  constraint games_homeTeamId_fkey foreign KEY ("homeTeamId") references teams (id),
  constraint games_seasonId_fkey foreign KEY ("seasonId") references seasons (id)
) TABLESPACE pg_default;

create index IF not exists idx_games_date on public.games using btree (date) TABLESPACE pg_default;

create trigger after_game_insert
after INSERT on games for EACH row
execute FUNCTION insert_into_statsupdatestatus ();
```

