

```sql
create table public.nst_gamelog_goalie_5v5_counts (
  player_id integer not null,
  player_name text null,
  team text null,
  date_scraped date not null,
  season integer not null,
  gp integer null,
  toi numeric null,
  shots_against integer null,
  saves integer null,
  goals_against integer null,
  sv_percentage numeric null,
  gaa numeric null,
  gsaa numeric null,
  xg_against numeric null,
  hd_shots_against integer null,
  hd_saves integer null,
  hd_sv_percentage numeric null,
  hd_gaa numeric null,
  hd_gsaa numeric null,
  md_shots_against integer null,
  md_saves integer null,
  md_goals_against integer null,
  md_sv_percentage numeric null,
  md_gaa numeric null,
  md_gsaa numeric null,
  ld_shots_against integer null,
  ld_sv_percentage numeric null,
  ld_gaa numeric null,
  ld_gsaa numeric null,
  rush_attempts_against integer null,
  rebound_attempts_against integer null,
  avg_shot_distance numeric null,
  avg_goal_distance numeric null,
  constraint pk_nst_gamelog_goalie_5v5_counts primary key (player_id, date_scraped)
) TABLESPACE pg_default;
```

```sql
create table public.nst_gamelog_goalie_5v5_rates (
  player_id integer not null,
  player_name text null,
  team text null,
  date_scraped date not null,
  season integer not null,
  gp integer null,
  toi numeric null,
  toi_per_gp numeric null,
  shots_against_per_60 numeric null,
  saves_per_60 numeric null,
  sv_percentage numeric null,
  gaa numeric null,
  gsaa_per_60 numeric null,
  xg_against_per_60 numeric null,
  hd_shots_against_per_60 numeric null,
  hd_saves_per_60 numeric null,
  hd_sv_percentage numeric null,
  hd_gaa numeric null,
  hd_gsaa_per_60 numeric null,
  md_shots_against_per_60 numeric null,
  md_saves_per_60 numeric null,
  md_sv_percentage numeric null,
  md_gaa numeric null,
  md_gsaa_per_60 numeric null,
  ld_shots_against_per_60 numeric null,
  ld_saves_per_60 numeric null,
  ld_sv_percentage numeric null,
  ld_gaa numeric null,
  ld_gsaa_per_60 numeric null,
  rush_attempts_against_per_60 numeric null,
  rebound_attempts_against_per_60 numeric null,
  avg_shot_distance numeric null,
  avg_goal_distance numeric null,
  constraint pk_nst_gamelog_goalie_5v5_rates primary key (player_id, date_scraped)
) TABLESPACE pg_default;
```

```sql
create table public.nst_gamelog_goalie_all_counts (
  player_id integer not null,
  player_name text null,
  team text null,
  date_scraped date not null,
  season integer null,
  gp integer null,
  toi numeric null,
  shots_against integer null,
  saves integer null,
  goals_against integer null,
  sv_percentage numeric null,
  gaa numeric null,
  gsaa numeric null,
  xg_against numeric null,
  hd_shots_against integer null,
  hd_saves integer null,
  hd_sv_percentage numeric null,
  hd_gaa numeric null,
  hd_gsaa numeric null,
  md_shots_against integer null,
  md_saves integer null,
  md_goals_against integer null,
  md_sv_percentage numeric null,
  md_gaa numeric null,
  md_gsaa numeric null,
  ld_shots_against integer null,
  ld_sv_percentage numeric null,
  ld_gaa numeric null,
  ld_gsaa numeric null,
  rush_attempts_against integer null,
  rebound_attempts_against integer null,
  avg_shot_distance numeric null,
  avg_goal_distance numeric null,
  constraint pk_nst_gamelog_goalie_all_counts primary key (player_id, date_scraped),
  constraint unique_all_counts unique (player_id, date_scraped)
) TABLESPACE pg_default;
```

```sql
create table public.nst_gamelog_goalie_all_rates (
  player_id integer not null,
  player_name text null,
  team text null,
  date_scraped date not null,
  season integer null,
  gp integer null,
  toi numeric null,
  toi_per_gp numeric null,
  shots_against_per_60 numeric null,
  saves_per_60 numeric null,
  sv_percentage numeric null,
  gaa numeric null,
  gsaa_per_60 numeric null,
  xg_against_per_60 numeric null,
  hd_shots_against_per_60 numeric null,
  hd_saves_per_60 numeric null,
  hd_sv_percentage numeric null,
  hd_gaa numeric null,
  hd_gsaa_per_60 numeric null,
  md_shots_against_per_60 numeric null,
  md_saves_per_60 numeric null,
  md_sv_percentage numeric null,
  md_gaa numeric null,
  md_gsaa_per_60 numeric null,
  ld_shots_against_per_60 numeric null,
  ld_saves_per_60 numeric null,
  ld_sv_percentage numeric null,
  ld_gaa numeric null,
  ld_gsaa_per_60 numeric null,
  rush_attempts_against_per_60 numeric null,
  rebound_attempts_against_per_60 numeric null,
  avg_shot_distance numeric null,
  avg_goal_distance numeric null,
  constraint pk_nst_gamelog_goalie_all_rates primary key (player_id, date_scraped),
  constraint unique_all_rates unique (player_id, date_scraped)
) TABLESPACE pg_default;
```

```sql
create table public.nst_gamelog_goalie_ev_counts (
  player_id integer not null,
  player_name text null,
  team text null,
  date_scraped date not null,
  season integer null,
  gp integer null,
  toi numeric null,
  shots_against integer null,
  saves integer null,
  goals_against integer null,
  sv_percentage numeric null,
  gaa numeric null,
  gsaa numeric null,
  xg_against numeric null,
  hd_shots_against integer null,
  hd_saves integer null,
  hd_sv_percentage numeric null,
  hd_gaa numeric null,
  hd_gsaa numeric null,
  md_shots_against integer null,
  md_saves integer null,
  md_goals_against integer null,
  md_sv_percentage numeric null,
  md_gaa numeric null,
  md_gsaa numeric null,
  ld_shots_against integer null,
  ld_sv_percentage numeric null,
  ld_gaa numeric null,
  ld_gsaa numeric null,
  rush_attempts_against integer null,
  rebound_attempts_against integer null,
  avg_shot_distance numeric null,
  avg_goal_distance numeric null,
  constraint pk_nst_gamelog_goalie_ev_counts primary key (player_id, date_scraped),
  constraint unique_ev_counts unique (player_id, date_scraped)
) TABLESPACE pg_default;
```

```sql
create table public.nst_gamelog_goalie_ev_rates (
  player_id integer not null,
  player_name text null,
  team text null,
  date_scraped date not null,
  season integer null,
  gp integer null,
  toi numeric null,
  toi_per_gp numeric null,
  shots_against_per_60 numeric null,
  saves_per_60 numeric null,
  sv_percentage numeric null,
  gaa numeric null,
  gsaa_per_60 numeric null,
  xg_against_per_60 numeric null,
  hd_shots_against_per_60 numeric null,
  hd_saves_per_60 numeric null,
  hd_sv_percentage numeric null,
  hd_gaa numeric null,
  hd_gsaa_per_60 numeric null,
  md_shots_against_per_60 numeric null,
  md_saves_per_60 numeric null,
  md_sv_percentage numeric null,
  md_gaa numeric null,
  md_gsaa_per_60 numeric null,
  ld_shots_against_per_60 numeric null,
  ld_saves_per_60 numeric null,
  ld_sv_percentage numeric null,
  ld_gaa numeric null,
  ld_gsaa_per_60 numeric null,
  rush_attempts_against_per_60 numeric null,
  rebound_attempts_against_per_60 numeric null,
  avg_shot_distance numeric null,
  avg_goal_distance numeric null,
  constraint pk_nst_gamelog_goalie_ev_rates primary key (player_id, date_scraped),
  constraint unique_ev_rates unique (player_id, date_scraped)
) TABLESPACE pg_default;
```

```sql
create table public.nst_gamelog_goalie_pk_counts (
  player_id integer not null,
  player_name text null,
  team text null,
  date_scraped date not null,
  season integer null,
  gp integer null,
  toi numeric null,
  shots_against integer null,
  saves integer null,
  goals_against integer null,
  sv_percentage numeric null,
  gaa numeric null,
  gsaa numeric null,
  xg_against numeric null,
  hd_shots_against integer null,
  hd_saves integer null,
  hd_sv_percentage numeric null,
  hd_gaa numeric null,
  hd_gsaa numeric null,
  md_shots_against integer null,
  md_saves integer null,
  md_goals_against integer null,
  md_sv_percentage numeric null,
  md_gaa numeric null,
  md_gsaa numeric null,
  ld_shots_against integer null,
  ld_sv_percentage numeric null,
  ld_gaa numeric null,
  ld_gsaa numeric null,
  rush_attempts_against integer null,
  rebound_attempts_against integer null,
  avg_shot_distance numeric null,
  avg_goal_distance numeric null,
  constraint pk_nst_gamelog_goalie_pk_counts primary key (player_id, date_scraped),
  constraint unique_pk_counts unique (player_id, date_scraped)
) TABLESPACE pg_default;
```

```sql
create table public.nst_gamelog_goalie_pk_rates (
  player_id integer not null,
  player_name text null,
  team text null,
  date_scraped date not null,
  season integer null,
  gp integer null,
  toi numeric null,
  toi_per_gp numeric null,
  shots_against_per_60 numeric null,
  saves_per_60 numeric null,
  sv_percentage numeric null,
  gaa numeric null,
  gsaa_per_60 numeric null,
  xg_against_per_60 numeric null,
  hd_shots_against_per_60 numeric null,
  hd_saves_per_60 numeric null,
  hd_sv_percentage numeric null,
  hd_gaa numeric null,
  hd_gsaa_per_60 numeric null,
  md_shots_against_per_60 numeric null,
  md_saves_per_60 numeric null,
  md_sv_percentage numeric null,
  md_gaa numeric null,
  md_gsaa_per_60 numeric null,
  ld_shots_against_per_60 numeric null,
  ld_saves_per_60 numeric null,
  ld_sv_percentage numeric null,
  ld_gaa numeric null,
  ld_gsaa_per_60 numeric null,
  rush_attempts_against_per_60 numeric null,
  rebound_attempts_against_per_60 numeric null,
  avg_shot_distance numeric null,
  avg_goal_distance numeric null,
  constraint pk_nst_gamelog_goalie_pk_rates primary key (player_id, date_scraped),
  constraint unique_pk_rates unique (player_id, date_scraped)
) TABLESPACE pg_default;
```

```sql
create table public.nst_gamelog_goalie_pp_counts (
  player_id integer not null,
  player_name text null,
  team text null,
  date_scraped date not null,
  season integer null,
  gp integer null,
  toi numeric null,
  shots_against integer null,
  saves integer null,
  goals_against integer null,
  sv_percentage numeric null,
  gaa numeric null,
  gsaa numeric null,
  xg_against numeric null,
  hd_shots_against integer null,
  hd_saves integer null,
  hd_sv_percentage numeric null,
  hd_gaa numeric null,
  hd_gsaa numeric null,
  md_shots_against integer null,
  md_saves integer null,
  md_goals_against integer null,
  md_sv_percentage numeric null,
  md_gaa numeric null,
  md_gsaa numeric null,
  ld_shots_against integer null,
  ld_sv_percentage numeric null,
  ld_gaa numeric null,
  ld_gsaa numeric null,
  rush_attempts_against integer null,
  rebound_attempts_against integer null,
  avg_shot_distance numeric null,
  avg_goal_distance numeric null,
  constraint pk_nst_gamelog_goalie_pp_counts primary key (player_id, date_scraped),
  constraint unique_pp_counts unique (player_id, date_scraped)
) TABLESPACE pg_default;
```

```sql
create table public.nst_gamelog_goalie_pp_rates (
  player_id integer not null,
  player_name text null,
  team text null,
  date_scraped date not null,
  season integer null,
  gp integer null,
  toi numeric null,
  toi_per_gp numeric null,
  shots_against_per_60 numeric null,
  saves_per_60 numeric null,
  sv_percentage numeric null,
  gaa numeric null,
  gsaa_per_60 numeric null,
  xg_against_per_60 numeric null,
  hd_shots_against_per_60 numeric null,
  hd_saves_per_60 numeric null,
  hd_sv_percentage numeric null,
  hd_gaa numeric null,
  hd_gsaa_per_60 numeric null,
  md_shots_against_per_60 numeric null,
  md_saves_per_60 numeric null,
  md_sv_percentage numeric null,
  md_gaa numeric null,
  md_gsaa_per_60 numeric null,
  ld_shots_against_per_60 numeric null,
  ld_saves_per_60 numeric null,
  ld_sv_percentage numeric null,
  ld_gaa numeric null,
  ld_gsaa_per_60 numeric null,
  rush_attempts_against_per_60 numeric null,
  rebound_attempts_against_per_60 numeric null,
  avg_shot_distance numeric null,
  avg_goal_distance numeric null,
  constraint pk_nst_gamelog_goalie_pp_rates primary key (player_id, date_scraped),
  constraint unique_pp_rates unique (player_id, date_scraped)
) TABLESPACE pg_default;
```

```sql
create table public."goaliesGameStats" (
  "playerId" bigint generated by default as identity not null,
  "gameId" bigint not null,
  position public.NHL_Position_Code not null default 'G'::"NHL_Position_Code",
  "evenStrengthShotsAgainst" text not null default '0/0'::text,
  "powerPlayShotsAgainst" text not null default '0/0'::text,
  "shorthandedShotsAgainst" text not null default '0/0'::text,
  "saveShotsAgainst" text not null default '0/0'::text,
  "evenStrengthGoalsAgainst" smallint not null default '0'::smallint,
  "powerPlayGoalsAgainst" smallint not null default '0'::smallint,
  "shorthandedGoalsAgainst" smallint not null default '0'::smallint,
  pim smallint not null default '0'::smallint,
  "goalsAgainst" smallint not null default '0'::smallint,
  toi text null default '00:00'::text,
  created_at timestamp with time zone not null default now(),
  "savePctg" real null default '0'::real,
  constraint goaliesGameStats_pkey primary key ("playerId", "gameId"),
  constraint goaliesGameStats_gameId_fkey foreign KEY ("gameId") references games (id),
  constraint goaliesGameStats_playerId_fkey foreign KEY ("playerId") references players (id)
) TABLESPACE pg_default;
```

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

VIEW wigo_goalies
```json
[
  {
    "pg_get_viewdef": " SELECT wgo.goalie_id,\n    wgo.goalie_name,\n    wgo.date,\n    counts.team,\n    counts.season,\n    wgo.shoots_catches,\n    wgo.position_code,\n    wgo.games_played,\n    wgo.games_started,\n    wgo.wins,\n    wgo.losses,\n    wgo.ot_losses,\n    wgo.saves,\n    wgo.goals_against,\n    wgo.shots_against,\n    wgo.shutouts,\n    wgo.goals AS goals_scored_by_goalie,\n    wgo.assists AS assists_by_goalie,\n    wgo.complete_games,\n    wgo.incomplete_games,\n    wgo.quality_start,\n    wgo.regulation_losses,\n    wgo.regulation_wins,\n    wgo.save_pct AS save_percentage,\n    wgo.goals_against_avg AS gaa,\n    wgo.time_on_ice AS time_on_ice_seconds,\n    wgo.complete_game_pct,\n    wgo.quality_starts_pct,\n    wgo.games_played_days_rest_0,\n    wgo.games_played_days_rest_1,\n    wgo.games_played_days_rest_2,\n    wgo.games_played_days_rest_3,\n    wgo.games_played_days_rest_4_plus,\n    wgo.save_pct_days_rest_0,\n    wgo.save_pct_days_rest_1,\n    wgo.save_pct_days_rest_2,\n    wgo.save_pct_days_rest_3,\n    wgo.save_pct_days_rest_4_plus,\n    counts.gsaa,\n    counts.xg_against,\n    counts.hd_shots_against,\n    counts.hd_saves,\n    counts.hd_sv_percentage,\n    counts.hd_gaa,\n    counts.hd_gsaa,\n    counts.md_shots_against,\n    counts.md_saves,\n    counts.md_goals_against,\n    counts.md_sv_percentage,\n    counts.md_gaa,\n    counts.md_gsaa,\n    counts.ld_shots_against,\n    counts.ld_sv_percentage,\n    counts.ld_gaa,\n    counts.ld_gsaa,\n    counts.rush_attempts_against,\n    counts.rebound_attempts_against,\n    counts.avg_shot_distance,\n    counts.avg_goal_distance,\n    rates.toi_per_gp,\n    rates.shots_against_per_60,\n    rates.saves_per_60,\n    rates.gsaa_per_60,\n    rates.xg_against_per_60,\n    rates.hd_shots_against_per_60,\n    rates.hd_saves_per_60,\n    rates.hd_gsaa_per_60,\n    rates.md_shots_against_per_60,\n    rates.md_saves_per_60,\n    rates.md_gsaa_per_60,\n    rates.ld_shots_against_per_60,\n    rates.ld_saves_per_60,\n    rates.ld_gsaa_per_60,\n    rates.rush_attempts_against_per_60,\n    rates.rebound_attempts_against_per_60\n   FROM wgo_goalie_stats wgo\n     JOIN nst_gamelog_goalie_all_counts counts ON wgo.goalie_id = counts.player_id AND wgo.date = counts.date_scraped\n     JOIN nst_gamelog_goalie_all_rates rates ON wgo.goalie_id = rates.player_id AND wgo.date = rates.date_scraped;"
  }
]
```

VIEW wgo_goalie_stats_per_game
```json
[
  {
    "pg_get_viewdef": " SELECT g.goalie_id,\n    g.goalie_name,\n    g.season_id,\n    g.shoots_catches,\n    g.games_played,\n    g.games_started,\n    g.games_played::numeric / NULLIF(ts.games_played, 0)::numeric AS percent_games,\n    g.wins::numeric / NULLIF(g.games_played, 0)::numeric AS wins,\n    g.losses::numeric / NULLIF(g.games_played, 0)::numeric AS losses,\n    g.saves::numeric / NULLIF(g.games_played, 0)::numeric AS saves,\n    g.shots_against::numeric / NULLIF(g.games_played, 0)::numeric AS shots_against,\n    g.shutouts::numeric / NULLIF(g.games_played, 0)::numeric AS shutouts,\n    g.quality_start::numeric / NULLIF(g.games_played, 0)::numeric AS quality_start,\n    g.goals_against_avg,\n    g.save_pct,\n    g.team_abbrevs,\n    g.current_team_abbreviation\n   FROM wgo_goalie_stats_totals g\n     LEFT JOIN teams tm ON\n        CASE\n            WHEN strpos(g.team_abbrevs, ','::text) > 0 THEN g.current_team_abbreviation\n            ELSE g.team_abbrevs\n        END = tm.abbreviation::text\n     LEFT JOIN team_summary_years ts ON tm.name = ts.team_full_name AND g.season_id = ts.season_id;"
  }
]
```


VIEW vw_goalie_stats_unified
```json
[
  {
    "pg_get_viewdef": " SELECT w.goalie_id AS player_id,\n    w.date,\n    w.season_id,\n    p.team_id,\n    w.goalie_name AS player_name,\n    w.position_code,\n    w.shoots_catches,\n    w.games_played,\n    w.games_started,\n    w.wins,\n    w.losses,\n    w.ot_losses,\n    w.save_pct,\n    w.saves,\n    w.goals_against,\n    w.goals_against_avg,\n    w.shots_against,\n    w.time_on_ice,\n    w.shutouts,\n    w.goals,\n    w.assists,\n    w.complete_game_pct,\n    w.complete_games,\n    w.incomplete_games,\n    w.quality_start,\n    w.quality_starts_pct,\n    w.regulation_losses,\n    w.regulation_wins,\n    w.shots_against_per_60,\n    w.games_played_days_rest_0,\n    w.games_played_days_rest_1,\n    w.games_played_days_rest_2,\n    w.games_played_days_rest_3,\n    w.games_played_days_rest_4_plus,\n    w.save_pct_days_rest_0,\n    w.save_pct_days_rest_1,\n    w.save_pct_days_rest_2,\n    w.save_pct_days_rest_3,\n    w.save_pct_days_rest_4_plus,\n    n5c.toi AS nst_5v5_counts_toi,\n    n5c.shots_against AS nst_5v5_counts_shots_against,\n    n5c.saves AS nst_5v5_counts_saves,\n    n5c.goals_against AS nst_5v5_counts_goals_against,\n    n5c.sv_percentage AS nst_5v5_counts_sv_percentage,\n    n5c.gaa AS nst_5v5_counts_gaa,\n    n5c.gsaa AS nst_5v5_counts_gsaa,\n    n5c.xg_against AS nst_5v5_counts_xg_against,\n    n5c.hd_shots_against AS nst_5v5_counts_hd_shots_against,\n    n5c.hd_saves AS nst_5v5_counts_hd_saves,\n    n5c.hd_sv_percentage AS nst_5v5_counts_hd_sv_percentage,\n    n5c.hd_gaa AS nst_5v5_counts_hd_gaa,\n    n5c.hd_gsaa AS nst_5v5_counts_hd_gsaa,\n    n5c.md_shots_against AS nst_5v5_counts_md_shots_against,\n    n5c.md_saves AS nst_5v5_counts_md_saves,\n    n5c.md_goals_against AS nst_5v5_counts_md_goals_against,\n    n5c.md_sv_percentage AS nst_5v5_counts_md_sv_percentage,\n    n5c.md_gaa AS nst_5v5_counts_md_gaa,\n    n5c.md_gsaa AS nst_5v5_counts_md_gsaa,\n    n5c.ld_shots_against AS nst_5v5_counts_ld_shots_against,\n    n5c.ld_sv_percentage AS nst_5v5_counts_ld_sv_percentage,\n    n5c.ld_gaa AS nst_5v5_counts_ld_gaa,\n    n5c.ld_gsaa AS nst_5v5_counts_ld_gsaa,\n    n5c.rush_attempts_against AS nst_5v5_counts_rush_attempts_against,\n    n5c.rebound_attempts_against AS nst_5v5_counts_rebound_attempts_against,\n    n5c.avg_shot_distance AS nst_5v5_counts_avg_shot_distance,\n    n5c.avg_goal_distance AS nst_5v5_counts_avg_goal_distance,\n    n5r.shots_against_per_60 AS nst_5v5_rates_shots_against_per_60,\n    n5r.saves_per_60 AS nst_5v5_rates_saves_per_60,\n    n5r.sv_percentage AS nst_5v5_rates_sv_percentage,\n    n5r.gaa AS nst_5v5_rates_gaa,\n    n5r.gsaa_per_60 AS nst_5v5_rates_gsaa_per_60,\n    n5r.xg_against_per_60 AS nst_5v5_rates_xg_against_per_60,\n    n5r.hd_shots_against_per_60 AS nst_5v5_rates_hd_shots_against_per_60,\n    n5r.hd_saves_per_60 AS nst_5v5_rates_hd_saves_per_60,\n    n5r.hd_sv_percentage AS nst_5v5_rates_hd_sv_percentage,\n    n5r.hd_gaa AS nst_5v5_rates_hd_gaa,\n    n5r.hd_gsaa_per_60 AS nst_5v5_rates_hd_gsaa_per_60,\n    n5r.md_shots_against_per_60 AS nst_5v5_rates_md_shots_against_per_60,\n    n5r.md_saves_per_60 AS nst_5v5_rates_md_saves_per_60,\n    n5r.md_sv_percentage AS nst_5v5_rates_md_sv_percentage,\n    n5r.md_gaa AS nst_5v5_rates_md_gaa,\n    n5r.md_gsaa_per_60 AS nst_5v5_rates_md_gsaa_per_60,\n    n5r.ld_shots_against_per_60 AS nst_5v5_rates_ld_shots_against_per_60,\n    n5r.ld_saves_per_60 AS nst_5v5_rates_ld_saves_per_60,\n    n5r.ld_sv_percentage AS nst_5v5_rates_ld_sv_percentage,\n    n5r.ld_gaa AS nst_5v5_rates_ld_gaa,\n    n5r.ld_gsaa_per_60 AS nst_5v5_rates_ld_gsaa_per_60,\n    n5r.rush_attempts_against_per_60 AS nst_5v5_rates_rush_attempts_against_per_60,\n    n5r.rebound_attempts_against_per_60 AS nst_5v5_rates_rebound_attempts_against_per_60,\n    nac.toi AS nst_all_counts_toi,\n    nac.shots_against AS nst_all_counts_shots_against,\n    nac.saves AS nst_all_counts_saves,\n    nac.goals_against AS nst_all_counts_goals_against,\n    nac.sv_percentage AS nst_all_counts_sv_percentage,\n    nac.gaa AS nst_all_counts_gaa,\n    nac.gsaa AS nst_all_counts_gsaa,\n    nac.xg_against AS nst_all_counts_xg_against,\n    nac.hd_shots_against AS nst_all_counts_hd_shots_against,\n    nac.hd_saves AS nst_all_counts_hd_saves,\n    nac.hd_sv_percentage AS nst_all_counts_hd_sv_percentage,\n    nac.hd_gaa AS nst_all_counts_hd_gaa,\n    nac.hd_gsaa AS nst_all_counts_hd_gsaa,\n    nac.md_shots_against AS nst_all_counts_md_shots_against,\n    nac.md_saves AS nst_all_counts_md_saves,\n    nac.md_goals_against AS nst_all_counts_md_goals_against,\n    nac.md_sv_percentage AS nst_all_counts_md_sv_percentage,\n    nac.md_gaa AS nst_all_counts_md_gaa,\n    nac.md_gsaa AS nst_all_counts_md_gsaa,\n    nac.ld_shots_against AS nst_all_counts_ld_shots_against,\n    nac.ld_sv_percentage AS nst_all_counts_ld_sv_percentage,\n    nac.ld_gaa AS nst_all_counts_ld_gaa,\n    nac.ld_gsaa AS nst_all_counts_ld_gsaa,\n    nac.rush_attempts_against AS nst_all_counts_rush_attempts_against,\n    nac.rebound_attempts_against AS nst_all_counts_rebound_attempts_against,\n    nac.avg_shot_distance AS nst_all_counts_avg_shot_distance,\n    nac.avg_goal_distance AS nst_all_counts_avg_goal_distance,\n    nar.shots_against_per_60 AS nst_all_rates_shots_against_per_60,\n    nar.saves_per_60 AS nst_all_rates_saves_per_60,\n    nar.sv_percentage AS nst_all_rates_sv_percentage,\n    nar.gaa AS nst_all_rates_gaa,\n    nar.gsaa_per_60 AS nst_all_rates_gsaa_per_60,\n    nar.xg_against_per_60 AS nst_all_rates_xg_against_per_60,\n    nar.hd_shots_against_per_60 AS nst_all_rates_hd_shots_against_per_60,\n    nar.hd_saves_per_60 AS nst_all_rates_hd_saves_per_60,\n    nar.hd_sv_percentage AS nst_all_rates_hd_sv_percentage,\n    nar.hd_gaa AS nst_all_rates_hd_gaa,\n    nar.hd_gsaa_per_60 AS nst_all_rates_hd_gsaa_per_60,\n    nar.md_shots_against_per_60 AS nst_all_rates_md_shots_against_per_60,\n    nar.md_saves_per_60 AS nst_all_rates_md_saves_per_60,\n    nar.md_sv_percentage AS nst_all_rates_md_sv_percentage,\n    nar.md_gaa AS nst_all_rates_md_gaa,\n    nar.md_gsaa_per_60 AS nst_all_rates_md_gsaa_per_60,\n    nar.ld_shots_against_per_60 AS nst_all_rates_ld_shots_against_per_60,\n    nar.ld_saves_per_60 AS nst_all_rates_ld_saves_per_60,\n    nar.ld_sv_percentage AS nst_all_rates_ld_sv_percentage,\n    nar.ld_gaa AS nst_all_rates_ld_gaa,\n    nar.ld_gsaa_per_60 AS nst_all_rates_ld_gsaa_per_60,\n    nar.rush_attempts_against_per_60 AS nst_all_rates_rush_attempts_against_per_60,\n    nar.rebound_attempts_against_per_60 AS nst_all_rates_rebound_attempts_against_per_60,\n    nec.toi AS nst_ev_counts_toi,\n    nec.shots_against AS nst_ev_counts_shots_against,\n    nec.saves AS nst_ev_counts_saves,\n    nec.goals_against AS nst_ev_counts_goals_against,\n    nec.sv_percentage AS nst_ev_counts_sv_percentage,\n    nec.gaa AS nst_ev_counts_gaa,\n    nec.gsaa AS nst_ev_counts_gsaa,\n    nec.xg_against AS nst_ev_counts_xg_against,\n    nec.hd_shots_against AS nst_ev_counts_hd_shots_against,\n    nec.hd_saves AS nst_ev_counts_hd_saves,\n    nec.hd_sv_percentage AS nst_ev_counts_hd_sv_percentage,\n    nec.hd_gaa AS nst_ev_counts_hd_gaa,\n    nec.hd_gsaa AS nst_ev_counts_hd_gsaa,\n    nec.md_shots_against AS nst_ev_counts_md_shots_against,\n    nec.md_saves AS nst_ev_counts_md_saves,\n    nec.md_goals_against AS nst_ev_counts_md_goals_against,\n    nec.md_sv_percentage AS nst_ev_counts_md_sv_percentage,\n    nec.md_gaa AS nst_ev_counts_md_gaa,\n    nec.md_gsaa AS nst_ev_counts_md_gsaa,\n    nec.ld_shots_against AS nst_ev_counts_ld_shots_against,\n    nec.ld_sv_percentage AS nst_ev_counts_ld_sv_percentage,\n    nec.ld_gaa AS nst_ev_counts_ld_gaa,\n    nec.ld_gsaa AS nst_ev_counts_ld_gsaa,\n    nec.rush_attempts_against AS nst_ev_counts_rush_attempts_against,\n    nec.rebound_attempts_against AS nst_ev_counts_rebound_attempts_against,\n    nec.avg_shot_distance AS nst_ev_counts_avg_shot_distance,\n    nec.avg_goal_distance AS nst_ev_counts_avg_goal_distance,\n    ner.shots_against_per_60 AS nst_ev_rates_shots_against_per_60,\n    ner.saves_per_60 AS nst_ev_rates_saves_per_60,\n    ner.sv_percentage AS nst_ev_rates_sv_percentage,\n    ner.gaa AS nst_ev_rates_gaa,\n    ner.gsaa_per_60 AS nst_ev_rates_gsaa_per_60,\n    ner.xg_against_per_60 AS nst_ev_rates_xg_against_per_60,\n    ner.hd_shots_against_per_60 AS nst_ev_rates_hd_shots_against_per_60,\n    ner.hd_saves_per_60 AS nst_ev_rates_hd_saves_per_60,\n    ner.hd_sv_percentage AS nst_ev_rates_hd_sv_percentage,\n    ner.hd_gaa AS nst_ev_rates_hd_gaa,\n    ner.hd_gsaa_per_60 AS nst_ev_rates_hd_gsaa_per_60,\n    ner.md_shots_against_per_60 AS nst_ev_rates_md_shots_against_per_60,\n    ner.md_saves_per_60 AS nst_ev_rates_md_saves_per_60,\n    ner.md_sv_percentage AS nst_ev_rates_md_sv_percentage,\n    ner.md_gaa AS nst_ev_rates_md_gaa,\n    ner.md_gsaa_per_60 AS nst_ev_rates_md_gsaa_per_60,\n    ner.ld_shots_against_per_60 AS nst_ev_rates_ld_shots_against_per_60,\n    ner.ld_saves_per_60 AS nst_ev_rates_ld_saves_per_60,\n    ner.ld_sv_percentage AS nst_ev_rates_ld_sv_percentage,\n    ner.ld_gaa AS nst_ev_rates_ld_gaa,\n    ner.ld_gsaa_per_60 AS nst_ev_rates_ld_gsaa_per_60,\n    ner.rush_attempts_against_per_60 AS nst_ev_rates_rush_attempts_against_per_60,\n    ner.rebound_attempts_against_per_60 AS nst_ev_rates_rebound_attempts_against_per_60,\n    nkc.toi AS nst_pk_counts_toi,\n    nkc.shots_against AS nst_pk_counts_shots_against,\n    nkc.saves AS nst_pk_counts_saves,\n    nkc.goals_against AS nst_pk_counts_goals_against,\n    nkc.sv_percentage AS nst_pk_counts_sv_percentage,\n    nkc.gaa AS nst_pk_counts_gaa,\n    nkc.gsaa AS nst_pk_counts_gsaa,\n    nkc.xg_against AS nst_pk_counts_xg_against,\n    nkc.hd_shots_against AS nst_pk_counts_hd_shots_against,\n    nkc.hd_saves AS nst_pk_counts_hd_saves,\n    nkc.hd_sv_percentage AS nst_pk_counts_hd_sv_percentage,\n    nkc.hd_gaa AS nst_pk_counts_hd_gaa,\n    nkc.hd_gsaa AS nst_pk_counts_hd_gsaa,\n    nkc.md_shots_against AS nst_pk_counts_md_shots_against,\n    nkc.md_saves AS nst_pk_counts_md_saves,\n    nkc.md_goals_against AS nst_pk_counts_md_goals_against,\n    nkc.md_sv_percentage AS nst_pk_counts_md_sv_percentage,\n    nkc.md_gaa AS nst_pk_counts_md_gaa,\n    nkc.md_gsaa AS nst_pk_counts_md_gsaa,\n    nkc.ld_shots_against AS nst_pk_counts_ld_shots_against,\n    nkc.ld_sv_percentage AS nst_pk_counts_ld_sv_percentage,\n    nkc.ld_gaa AS nst_pk_counts_ld_gaa,\n    nkc.ld_gsaa AS nst_pk_counts_ld_gsaa,\n    nkc.rush_attempts_against AS nst_pk_counts_rush_attempts_against,\n    nkc.rebound_attempts_against AS nst_pk_counts_rebound_attempts_against,\n    nkc.avg_shot_distance AS nst_pk_counts_avg_shot_distance,\n    nkc.avg_goal_distance AS nst_pk_counts_avg_goal_distance,\n    nkr.shots_against_per_60 AS nst_pk_rates_shots_against_per_60,\n    nkr.saves_per_60 AS nst_pk_rates_saves_per_60,\n    nkr.sv_percentage AS nst_pk_rates_sv_percentage,\n    nkr.gaa AS nst_pk_rates_gaa,\n    nkr.gsaa_per_60 AS nst_pk_rates_gsaa_per_60,\n    nkr.xg_against_per_60 AS nst_pk_rates_xg_against_per_60,\n    nkr.hd_shots_against_per_60 AS nst_pk_rates_hd_shots_against_per_60,\n    nkr.hd_saves_per_60 AS nst_pk_rates_hd_saves_per_60,\n    nkr.hd_sv_percentage AS nst_pk_rates_hd_sv_percentage,\n    nkr.hd_gaa AS nst_pk_rates_hd_gaa,\n    nkr.hd_gsaa_per_60 AS nst_pk_rates_hd_gsaa_per_60,\n    nkr.md_shots_against_per_60 AS nst_pk_rates_md_shots_against_per_60,\n    nkr.md_saves_per_60 AS nst_pk_rates_md_saves_per_60,\n    nkr.md_sv_percentage AS nst_pk_rates_md_sv_percentage,\n    nkr.md_gaa AS nst_pk_rates_md_gaa,\n    nkr.md_gsaa_per_60 AS nst_pk_rates_md_gsaa_per_60,\n    nkr.ld_shots_against_per_60 AS nst_pk_rates_ld_shots_against_per_60,\n    nkr.ld_saves_per_60 AS nst_pk_rates_ld_saves_per_60,\n    nkr.ld_sv_percentage AS nst_pk_rates_ld_sv_percentage,\n    nkr.ld_gaa AS nst_pk_rates_ld_gaa,\n    nkr.ld_gsaa_per_60 AS nst_pk_rates_ld_gsaa_per_60,\n    nkr.rush_attempts_against_per_60 AS nst_pk_rates_rush_attempts_against_per_60,\n    nkr.rebound_attempts_against_per_60 AS nst_pk_rates_rebound_attempts_against_per_60,\n    npc.toi AS nst_pp_counts_toi,\n    npc.shots_against AS nst_pp_counts_shots_against,\n    npc.saves AS nst_pp_counts_saves,\n    npc.goals_against AS nst_pp_counts_goals_against,\n    npc.sv_percentage AS nst_pp_counts_sv_percentage,\n    npc.gaa AS nst_pp_counts_gaa,\n    npc.gsaa AS nst_pp_counts_gsaa,\n    npc.xg_against AS nst_pp_counts_xg_against,\n    npc.hd_shots_against AS nst_pp_counts_hd_shots_against,\n    npc.hd_saves AS nst_pp_counts_hd_saves,\n    npc.hd_sv_percentage AS nst_pp_counts_hd_sv_percentage,\n    npc.hd_gaa AS nst_pp_counts_hd_gaa,\n    npc.hd_gsaa AS nst_pp_counts_hd_gsaa,\n    npc.md_shots_against AS nst_pp_counts_md_shots_against,\n    npc.md_saves AS nst_pp_counts_md_saves,\n    npc.md_goals_against AS nst_pp_counts_md_goals_against,\n    npc.md_sv_percentage AS nst_pp_counts_md_sv_percentage,\n    npc.md_gaa AS nst_pp_counts_md_gaa,\n    npc.md_gsaa AS nst_pp_counts_md_gsaa,\n    npc.ld_shots_against AS nst_pp_counts_ld_shots_against,\n    npc.ld_sv_percentage AS nst_pp_counts_ld_sv_percentage,\n    npc.ld_gaa AS nst_pp_counts_ld_gaa,\n    npc.ld_gsaa AS nst_pp_counts_ld_gsaa,\n    npc.rush_attempts_against AS nst_pp_counts_rush_attempts_against,\n    npc.rebound_attempts_against AS nst_pp_counts_rebound_attempts_against,\n    npc.avg_shot_distance AS nst_pp_counts_avg_shot_distance,\n    npc.avg_goal_distance AS nst_pp_counts_avg_goal_distance,\n    npr.shots_against_per_60 AS nst_pp_rates_shots_against_per_60,\n    npr.saves_per_60 AS nst_pp_rates_saves_per_60,\n    npr.sv_percentage AS nst_pp_rates_sv_percentage,\n    npr.gaa AS nst_pp_rates_gaa,\n    npr.gsaa_per_60 AS nst_pp_rates_gsaa_per_60,\n    npr.xg_against_per_60 AS nst_pp_rates_xg_against_per_60,\n    npr.hd_shots_against_per_60 AS nst_pp_rates_hd_shots_against_per_60,\n    npr.hd_saves_per_60 AS nst_pp_rates_hd_saves_per_60,\n    npr.hd_sv_percentage AS nst_pp_rates_hd_sv_percentage,\n    npr.hd_gaa AS nst_pp_rates_hd_gaa,\n    npr.hd_gsaa_per_60 AS nst_pp_rates_hd_gsaa_per_60,\n    npr.md_shots_against_per_60 AS nst_pp_rates_md_shots_against_per_60,\n    npr.md_saves_per_60 AS nst_pp_rates_md_saves_per_60,\n    npr.md_sv_percentage AS nst_pp_rates_md_sv_percentage,\n    npr.md_gaa AS nst_pp_rates_md_gaa,\n    npr.md_gsaa_per_60 AS nst_pp_rates_md_gsaa_per_60,\n    npr.ld_shots_against_per_60 AS nst_pp_rates_ld_shots_against_per_60,\n    npr.ld_saves_per_60 AS nst_pp_rates_ld_saves_per_60,\n    npr.ld_sv_percentage AS nst_pp_rates_ld_sv_percentage,\n    npr.ld_gaa AS nst_pp_rates_ld_gaa,\n    npr.ld_gsaa_per_60 AS nst_pp_rates_ld_gsaa_per_60,\n    npr.rush_attempts_against_per_60 AS nst_pp_rates_rush_attempts_against_per_60,\n    npr.rebound_attempts_against_per_60 AS nst_pp_rates_rebound_attempts_against_per_60,\n        CASE\n            WHEN n5c.player_id IS NOT NULL THEN true\n            ELSE false\n        END AS has_nst_5v5_counts,\n        CASE\n            WHEN n5r.player_id IS NOT NULL THEN true\n            ELSE false\n        END AS has_nst_5v5_rates,\n        CASE\n            WHEN nac.player_id IS NOT NULL THEN true\n            ELSE false\n        END AS has_nst_all_counts,\n        CASE\n            WHEN nar.player_id IS NOT NULL THEN true\n            ELSE false\n        END AS has_nst_all_rates,\n        CASE\n            WHEN nec.player_id IS NOT NULL THEN true\n            ELSE false\n        END AS has_nst_ev_counts,\n        CASE\n            WHEN ner.player_id IS NOT NULL THEN true\n            ELSE false\n        END AS has_nst_ev_rates,\n        CASE\n            WHEN nkc.player_id IS NOT NULL THEN true\n            ELSE false\n        END AS has_nst_pk_counts,\n        CASE\n            WHEN nkr.player_id IS NOT NULL THEN true\n            ELSE false\n        END AS has_nst_pk_rates,\n        CASE\n            WHEN npc.player_id IS NOT NULL THEN true\n            ELSE false\n        END AS has_nst_pp_counts,\n        CASE\n            WHEN npr.player_id IS NOT NULL THEN true\n            ELSE false\n        END AS has_nst_pp_rates,\n    CURRENT_TIMESTAMP AS materialized_at\n   FROM wgo_goalie_stats w\n     LEFT JOIN players p ON w.goalie_id = p.id\n     LEFT JOIN nst_gamelog_goalie_5v5_counts n5c ON w.goalie_id = n5c.player_id AND w.date = n5c.date_scraped AND w.season_id = n5c.season\n     LEFT JOIN nst_gamelog_goalie_5v5_rates n5r ON w.goalie_id = n5r.player_id AND w.date = n5r.date_scraped AND w.season_id = n5r.season\n     LEFT JOIN nst_gamelog_goalie_all_counts nac ON w.goalie_id = nac.player_id AND w.date = nac.date_scraped AND w.season_id = nac.season\n     LEFT JOIN nst_gamelog_goalie_all_rates nar ON w.goalie_id = nar.player_id AND w.date = nar.date_scraped AND w.season_id = nar.season\n     LEFT JOIN nst_gamelog_goalie_ev_counts nec ON w.goalie_id = nec.player_id AND w.date = nec.date_scraped AND w.season_id = nec.season\n     LEFT JOIN nst_gamelog_goalie_ev_rates ner ON w.goalie_id = ner.player_id AND w.date = ner.date_scraped AND w.season_id = ner.season\n     LEFT JOIN nst_gamelog_goalie_pk_counts nkc ON w.goalie_id = nkc.player_id AND w.date = nkc.date_scraped AND w.season_id = nkc.season\n     LEFT JOIN nst_gamelog_goalie_pk_rates nkr ON w.goalie_id = nkr.player_id AND w.date = nkr.date_scraped AND w.season_id = nkr.season\n     LEFT JOIN nst_gamelog_goalie_pp_counts npc ON w.goalie_id = npc.player_id AND w.date = npc.date_scraped AND w.season_id = npc.season\n     LEFT JOIN nst_gamelog_goalie_pp_rates npr ON w.goalie_id = npr.player_id AND w.date = npr.date_scraped AND w.season_id = npr.season\n  WHERE w.games_played = 1 AND w.date >= '2023-01-01'::date AND w.goalie_id IS NOT NULL AND w.date IS NOT NULL\n  ORDER BY w.goalie_id, w.date;"
  }
]
```

```sql
create table public.goalie_start_projections (
  game_id integer not null,
  team_id integer not null,
  player_id integer not null,
  start_probability numeric null,
  projected_gsaa_per_60 numeric null,
  confirmed_status boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  game_date date null,
  l10_start_pct numeric null,
  season_start_pct numeric null,
  games_played numeric null,
  constraint goalie_start_projections_pkey primary key (game_id, player_id),
  constraint goalie_start_projections_start_probability_check check (
    (
      (start_probability >= (0)::numeric)
      and (start_probability <= (1)::numeric)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_goalie_start_projections_game on public.goalie_start_projections using btree (game_id) TABLESPACE pg_default;

create index IF not exists idx_goalie_start_projections_team on public.goalie_start_projections using btree (team_id) TABLESPACE pg_default;

create index IF not exists idx_goalie_start_projections_player on public.goalie_start_projections using btree (player_id) TABLESPACE pg_default;
```

MATERIALIZED VIEW goalie_stats_unified

```json
[
  {
    "pg_get_viewdef": " SELECT vw_goalie_stats_unified.player_id,\n    vw_goalie_stats_unified.date,\n    vw_goalie_stats_unified.season_id,\n    vw_goalie_stats_unified.team_id,\n    vw_goalie_stats_unified.player_name,\n    vw_goalie_stats_unified.position_code,\n    vw_goalie_stats_unified.shoots_catches,\n    vw_goalie_stats_unified.games_played,\n    vw_goalie_stats_unified.games_started,\n    vw_goalie_stats_unified.wins,\n    vw_goalie_stats_unified.losses,\n    vw_goalie_stats_unified.ot_losses,\n    vw_goalie_stats_unified.save_pct,\n    vw_goalie_stats_unified.saves,\n    vw_goalie_stats_unified.goals_against,\n    vw_goalie_stats_unified.goals_against_avg,\n    vw_goalie_stats_unified.shots_against,\n    vw_goalie_stats_unified.time_on_ice,\n    vw_goalie_stats_unified.shutouts,\n    vw_goalie_stats_unified.goals,\n    vw_goalie_stats_unified.assists,\n    vw_goalie_stats_unified.complete_game_pct,\n    vw_goalie_stats_unified.complete_games,\n    vw_goalie_stats_unified.incomplete_games,\n    vw_goalie_stats_unified.quality_start,\n    vw_goalie_stats_unified.quality_starts_pct,\n    vw_goalie_stats_unified.regulation_losses,\n    vw_goalie_stats_unified.regulation_wins,\n    vw_goalie_stats_unified.shots_against_per_60,\n    vw_goalie_stats_unified.games_played_days_rest_0,\n    vw_goalie_stats_unified.games_played_days_rest_1,\n    vw_goalie_stats_unified.games_played_days_rest_2,\n    vw_goalie_stats_unified.games_played_days_rest_3,\n    vw_goalie_stats_unified.games_played_days_rest_4_plus,\n    vw_goalie_stats_unified.save_pct_days_rest_0,\n    vw_goalie_stats_unified.save_pct_days_rest_1,\n    vw_goalie_stats_unified.save_pct_days_rest_2,\n    vw_goalie_stats_unified.save_pct_days_rest_3,\n    vw_goalie_stats_unified.save_pct_days_rest_4_plus,\n    vw_goalie_stats_unified.nst_5v5_counts_toi,\n    vw_goalie_stats_unified.nst_5v5_counts_shots_against,\n    vw_goalie_stats_unified.nst_5v5_counts_saves,\n    vw_goalie_stats_unified.nst_5v5_counts_goals_against,\n    vw_goalie_stats_unified.nst_5v5_counts_sv_percentage,\n    vw_goalie_stats_unified.nst_5v5_counts_gaa,\n    vw_goalie_stats_unified.nst_5v5_counts_gsaa,\n    vw_goalie_stats_unified.nst_5v5_counts_xg_against,\n    vw_goalie_stats_unified.nst_5v5_counts_hd_shots_against,\n    vw_goalie_stats_unified.nst_5v5_counts_hd_saves,\n    vw_goalie_stats_unified.nst_5v5_counts_hd_sv_percentage,\n    vw_goalie_stats_unified.nst_5v5_counts_hd_gaa,\n    vw_goalie_stats_unified.nst_5v5_counts_hd_gsaa,\n    vw_goalie_stats_unified.nst_5v5_counts_md_shots_against,\n    vw_goalie_stats_unified.nst_5v5_counts_md_saves,\n    vw_goalie_stats_unified.nst_5v5_counts_md_goals_against,\n    vw_goalie_stats_unified.nst_5v5_counts_md_sv_percentage,\n    vw_goalie_stats_unified.nst_5v5_counts_md_gaa,\n    vw_goalie_stats_unified.nst_5v5_counts_md_gsaa,\n    vw_goalie_stats_unified.nst_5v5_counts_ld_shots_against,\n    vw_goalie_stats_unified.nst_5v5_counts_ld_sv_percentage,\n    vw_goalie_stats_unified.nst_5v5_counts_ld_gaa,\n    vw_goalie_stats_unified.nst_5v5_counts_ld_gsaa,\n    vw_goalie_stats_unified.nst_5v5_counts_rush_attempts_against,\n    vw_goalie_stats_unified.nst_5v5_counts_rebound_attempts_against,\n    vw_goalie_stats_unified.nst_5v5_counts_avg_shot_distance,\n    vw_goalie_stats_unified.nst_5v5_counts_avg_goal_distance,\n    vw_goalie_stats_unified.nst_5v5_rates_shots_against_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_saves_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_sv_percentage,\n    vw_goalie_stats_unified.nst_5v5_rates_gaa,\n    vw_goalie_stats_unified.nst_5v5_rates_gsaa_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_xg_against_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_hd_shots_against_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_hd_saves_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_hd_sv_percentage,\n    vw_goalie_stats_unified.nst_5v5_rates_hd_gaa,\n    vw_goalie_stats_unified.nst_5v5_rates_hd_gsaa_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_md_shots_against_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_md_saves_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_md_sv_percentage,\n    vw_goalie_stats_unified.nst_5v5_rates_md_gaa,\n    vw_goalie_stats_unified.nst_5v5_rates_md_gsaa_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_ld_shots_against_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_ld_saves_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_ld_sv_percentage,\n    vw_goalie_stats_unified.nst_5v5_rates_ld_gaa,\n    vw_goalie_stats_unified.nst_5v5_rates_ld_gsaa_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_rush_attempts_against_per_60,\n    vw_goalie_stats_unified.nst_5v5_rates_rebound_attempts_against_per_60,\n    vw_goalie_stats_unified.nst_all_counts_toi,\n    vw_goalie_stats_unified.nst_all_counts_shots_against,\n    vw_goalie_stats_unified.nst_all_counts_saves,\n    vw_goalie_stats_unified.nst_all_counts_goals_against,\n    vw_goalie_stats_unified.nst_all_counts_sv_percentage,\n    vw_goalie_stats_unified.nst_all_counts_gaa,\n    vw_goalie_stats_unified.nst_all_counts_gsaa,\n    vw_goalie_stats_unified.nst_all_counts_xg_against,\n    vw_goalie_stats_unified.nst_all_counts_hd_shots_against,\n    vw_goalie_stats_unified.nst_all_counts_hd_saves,\n    vw_goalie_stats_unified.nst_all_counts_hd_sv_percentage,\n    vw_goalie_stats_unified.nst_all_counts_hd_gaa,\n    vw_goalie_stats_unified.nst_all_counts_hd_gsaa,\n    vw_goalie_stats_unified.nst_all_counts_md_shots_against,\n    vw_goalie_stats_unified.nst_all_counts_md_saves,\n    vw_goalie_stats_unified.nst_all_counts_md_goals_against,\n    vw_goalie_stats_unified.nst_all_counts_md_sv_percentage,\n    vw_goalie_stats_unified.nst_all_counts_md_gaa,\n    vw_goalie_stats_unified.nst_all_counts_md_gsaa,\n    vw_goalie_stats_unified.nst_all_counts_ld_shots_against,\n    vw_goalie_stats_unified.nst_all_counts_ld_sv_percentage,\n    vw_goalie_stats_unified.nst_all_counts_ld_gaa,\n    vw_goalie_stats_unified.nst_all_counts_ld_gsaa,\n    vw_goalie_stats_unified.nst_all_counts_rush_attempts_against,\n    vw_goalie_stats_unified.nst_all_counts_rebound_attempts_against,\n    vw_goalie_stats_unified.nst_all_counts_avg_shot_distance,\n    vw_goalie_stats_unified.nst_all_counts_avg_goal_distance,\n    vw_goalie_stats_unified.nst_all_rates_shots_against_per_60,\n    vw_goalie_stats_unified.nst_all_rates_saves_per_60,\n    vw_goalie_stats_unified.nst_all_rates_sv_percentage,\n    vw_goalie_stats_unified.nst_all_rates_gaa,\n    vw_goalie_stats_unified.nst_all_rates_gsaa_per_60,\n    vw_goalie_stats_unified.nst_all_rates_xg_against_per_60,\n    vw_goalie_stats_unified.nst_all_rates_hd_shots_against_per_60,\n    vw_goalie_stats_unified.nst_all_rates_hd_saves_per_60,\n    vw_goalie_stats_unified.nst_all_rates_hd_sv_percentage,\n    vw_goalie_stats_unified.nst_all_rates_hd_gaa,\n    vw_goalie_stats_unified.nst_all_rates_hd_gsaa_per_60,\n    vw_goalie_stats_unified.nst_all_rates_md_shots_against_per_60,\n    vw_goalie_stats_unified.nst_all_rates_md_saves_per_60,\n    vw_goalie_stats_unified.nst_all_rates_md_sv_percentage,\n    vw_goalie_stats_unified.nst_all_rates_md_gaa,\n    vw_goalie_stats_unified.nst_all_rates_md_gsaa_per_60,\n    vw_goalie_stats_unified.nst_all_rates_ld_shots_against_per_60,\n    vw_goalie_stats_unified.nst_all_rates_ld_saves_per_60,\n    vw_goalie_stats_unified.nst_all_rates_ld_sv_percentage,\n    vw_goalie_stats_unified.nst_all_rates_ld_gaa,\n    vw_goalie_stats_unified.nst_all_rates_ld_gsaa_per_60,\n    vw_goalie_stats_unified.nst_all_rates_rush_attempts_against_per_60,\n    vw_goalie_stats_unified.nst_all_rates_rebound_attempts_against_per_60,\n    vw_goalie_stats_unified.nst_ev_counts_toi,\n    vw_goalie_stats_unified.nst_ev_counts_shots_against,\n    vw_goalie_stats_unified.nst_ev_counts_saves,\n    vw_goalie_stats_unified.nst_ev_counts_goals_against,\n    vw_goalie_stats_unified.nst_ev_counts_sv_percentage,\n    vw_goalie_stats_unified.nst_ev_counts_gaa,\n    vw_goalie_stats_unified.nst_ev_counts_gsaa,\n    vw_goalie_stats_unified.nst_ev_counts_xg_against,\n    vw_goalie_stats_unified.nst_ev_counts_hd_shots_against,\n    vw_goalie_stats_unified.nst_ev_counts_hd_saves,\n    vw_goalie_stats_unified.nst_ev_counts_hd_sv_percentage,\n    vw_goalie_stats_unified.nst_ev_counts_hd_gaa,\n    vw_goalie_stats_unified.nst_ev_counts_hd_gsaa,\n    vw_goalie_stats_unified.nst_ev_counts_md_shots_against,\n    vw_goalie_stats_unified.nst_ev_counts_md_saves,\n    vw_goalie_stats_unified.nst_ev_counts_md_goals_against,\n    vw_goalie_stats_unified.nst_ev_counts_md_sv_percentage,\n    vw_goalie_stats_unified.nst_ev_counts_md_gaa,\n    vw_goalie_stats_unified.nst_ev_counts_md_gsaa,\n    vw_goalie_stats_unified.nst_ev_counts_ld_shots_against,\n    vw_goalie_stats_unified.nst_ev_counts_ld_sv_percentage,\n    vw_goalie_stats_unified.nst_ev_counts_ld_gaa,\n    vw_goalie_stats_unified.nst_ev_counts_ld_gsaa,\n    vw_goalie_stats_unified.nst_ev_counts_rush_attempts_against,\n    vw_goalie_stats_unified.nst_ev_counts_rebound_attempts_against,\n    vw_goalie_stats_unified.nst_ev_counts_avg_shot_distance,\n    vw_goalie_stats_unified.nst_ev_counts_avg_goal_distance,\n    vw_goalie_stats_unified.nst_ev_rates_shots_against_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_saves_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_sv_percentage,\n    vw_goalie_stats_unified.nst_ev_rates_gaa,\n    vw_goalie_stats_unified.nst_ev_rates_gsaa_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_xg_against_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_hd_shots_against_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_hd_saves_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_hd_sv_percentage,\n    vw_goalie_stats_unified.nst_ev_rates_hd_gaa,\n    vw_goalie_stats_unified.nst_ev_rates_hd_gsaa_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_md_shots_against_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_md_saves_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_md_sv_percentage,\n    vw_goalie_stats_unified.nst_ev_rates_md_gaa,\n    vw_goalie_stats_unified.nst_ev_rates_md_gsaa_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_ld_shots_against_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_ld_saves_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_ld_sv_percentage,\n    vw_goalie_stats_unified.nst_ev_rates_ld_gaa,\n    vw_goalie_stats_unified.nst_ev_rates_ld_gsaa_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_rush_attempts_against_per_60,\n    vw_goalie_stats_unified.nst_ev_rates_rebound_attempts_against_per_60,\n    vw_goalie_stats_unified.nst_pk_counts_toi,\n    vw_goalie_stats_unified.nst_pk_counts_shots_against,\n    vw_goalie_stats_unified.nst_pk_counts_saves,\n    vw_goalie_stats_unified.nst_pk_counts_goals_against,\n    vw_goalie_stats_unified.nst_pk_counts_sv_percentage,\n    vw_goalie_stats_unified.nst_pk_counts_gaa,\n    vw_goalie_stats_unified.nst_pk_counts_gsaa,\n    vw_goalie_stats_unified.nst_pk_counts_xg_against,\n    vw_goalie_stats_unified.nst_pk_counts_hd_shots_against,\n    vw_goalie_stats_unified.nst_pk_counts_hd_saves,\n    vw_goalie_stats_unified.nst_pk_counts_hd_sv_percentage,\n    vw_goalie_stats_unified.nst_pk_counts_hd_gaa,\n    vw_goalie_stats_unified.nst_pk_counts_hd_gsaa,\n    vw_goalie_stats_unified.nst_pk_counts_md_shots_against,\n    vw_goalie_stats_unified.nst_pk_counts_md_saves,\n    vw_goalie_stats_unified.nst_pk_counts_md_goals_against,\n    vw_goalie_stats_unified.nst_pk_counts_md_sv_percentage,\n    vw_goalie_stats_unified.nst_pk_counts_md_gaa,\n    vw_goalie_stats_unified.nst_pk_counts_md_gsaa,\n    vw_goalie_stats_unified.nst_pk_counts_ld_shots_against,\n    vw_goalie_stats_unified.nst_pk_counts_ld_sv_percentage,\n    vw_goalie_stats_unified.nst_pk_counts_ld_gaa,\n    vw_goalie_stats_unified.nst_pk_counts_ld_gsaa,\n    vw_goalie_stats_unified.nst_pk_counts_rush_attempts_against,\n    vw_goalie_stats_unified.nst_pk_counts_rebound_attempts_against,\n    vw_goalie_stats_unified.nst_pk_counts_avg_shot_distance,\n    vw_goalie_stats_unified.nst_pk_counts_avg_goal_distance,\n    vw_goalie_stats_unified.nst_pk_rates_shots_against_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_saves_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_sv_percentage,\n    vw_goalie_stats_unified.nst_pk_rates_gaa,\n    vw_goalie_stats_unified.nst_pk_rates_gsaa_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_xg_against_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_hd_shots_against_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_hd_saves_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_hd_sv_percentage,\n    vw_goalie_stats_unified.nst_pk_rates_hd_gaa,\n    vw_goalie_stats_unified.nst_pk_rates_hd_gsaa_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_md_shots_against_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_md_saves_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_md_sv_percentage,\n    vw_goalie_stats_unified.nst_pk_rates_md_gaa,\n    vw_goalie_stats_unified.nst_pk_rates_md_gsaa_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_ld_shots_against_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_ld_saves_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_ld_sv_percentage,\n    vw_goalie_stats_unified.nst_pk_rates_ld_gaa,\n    vw_goalie_stats_unified.nst_pk_rates_ld_gsaa_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_rush_attempts_against_per_60,\n    vw_goalie_stats_unified.nst_pk_rates_rebound_attempts_against_per_60,\n    vw_goalie_stats_unified.nst_pp_counts_toi,\n    vw_goalie_stats_unified.nst_pp_counts_shots_against,\n    vw_goalie_stats_unified.nst_pp_counts_saves,\n    vw_goalie_stats_unified.nst_pp_counts_goals_against,\n    vw_goalie_stats_unified.nst_pp_counts_sv_percentage,\n    vw_goalie_stats_unified.nst_pp_counts_gaa,\n    vw_goalie_stats_unified.nst_pp_counts_gsaa,\n    vw_goalie_stats_unified.nst_pp_counts_xg_against,\n    vw_goalie_stats_unified.nst_pp_counts_hd_shots_against,\n    vw_goalie_stats_unified.nst_pp_counts_hd_saves,\n    vw_goalie_stats_unified.nst_pp_counts_hd_sv_percentage,\n    vw_goalie_stats_unified.nst_pp_counts_hd_gaa,\n    vw_goalie_stats_unified.nst_pp_counts_hd_gsaa,\n    vw_goalie_stats_unified.nst_pp_counts_md_shots_against,\n    vw_goalie_stats_unified.nst_pp_counts_md_saves,\n    vw_goalie_stats_unified.nst_pp_counts_md_goals_against,\n    vw_goalie_stats_unified.nst_pp_counts_md_sv_percentage,\n    vw_goalie_stats_unified.nst_pp_counts_md_gaa,\n    vw_goalie_stats_unified.nst_pp_counts_md_gsaa,\n    vw_goalie_stats_unified.nst_pp_counts_ld_shots_against,\n    vw_goalie_stats_unified.nst_pp_counts_ld_sv_percentage,\n    vw_goalie_stats_unified.nst_pp_counts_ld_gaa,\n    vw_goalie_stats_unified.nst_pp_counts_ld_gsaa,\n    vw_goalie_stats_unified.nst_pp_counts_rush_attempts_against,\n    vw_goalie_stats_unified.nst_pp_counts_rebound_attempts_against,\n    vw_goalie_stats_unified.nst_pp_counts_avg_shot_distance,\n    vw_goalie_stats_unified.nst_pp_counts_avg_goal_distance,\n    vw_goalie_stats_unified.nst_pp_rates_shots_against_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_saves_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_sv_percentage,\n    vw_goalie_stats_unified.nst_pp_rates_gaa,\n    vw_goalie_stats_unified.nst_pp_rates_gsaa_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_xg_against_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_hd_shots_against_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_hd_saves_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_hd_sv_percentage,\n    vw_goalie_stats_unified.nst_pp_rates_hd_gaa,\n    vw_goalie_stats_unified.nst_pp_rates_hd_gsaa_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_md_shots_against_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_md_saves_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_md_sv_percentage,\n    vw_goalie_stats_unified.nst_pp_rates_md_gaa,\n    vw_goalie_stats_unified.nst_pp_rates_md_gsaa_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_ld_shots_against_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_ld_saves_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_ld_sv_percentage,\n    vw_goalie_stats_unified.nst_pp_rates_ld_gaa,\n    vw_goalie_stats_unified.nst_pp_rates_ld_gsaa_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_rush_attempts_against_per_60,\n    vw_goalie_stats_unified.nst_pp_rates_rebound_attempts_against_per_60,\n    vw_goalie_stats_unified.has_nst_5v5_counts,\n    vw_goalie_stats_unified.has_nst_5v5_rates,\n    vw_goalie_stats_unified.has_nst_all_counts,\n    vw_goalie_stats_unified.has_nst_all_rates,\n    vw_goalie_stats_unified.has_nst_ev_counts,\n    vw_goalie_stats_unified.has_nst_ev_rates,\n    vw_goalie_stats_unified.has_nst_pk_counts,\n    vw_goalie_stats_unified.has_nst_pk_rates,\n    vw_goalie_stats_unified.has_nst_pp_counts,\n    vw_goalie_stats_unified.has_nst_pp_rates,\n    vw_goalie_stats_unified.materialized_at\n   FROM vw_goalie_stats_unified;"
  }
]
```

