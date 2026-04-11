# nst_gamelog_goalie_5v5_counts

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

# nst_gamelog_goalie_5v5_rates

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

# nst_gamelog_goalie_all_counts

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

# nst_gamelog_goalie_all_rates

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

#

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

#

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

#

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

#

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

#

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

#

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

#

```sql
create table public.goalie_underlying_summary_partitions (
  game_id bigint not null,
  season_id integer not null,
  game_date date not null,
  strength text not null,
  score_state text not null,
  endpoint text not null default 'landing'::text,
  source_url text not null,
  shared_source_url text not null,
  payload_hash text not null,
  payload jsonb not null,
  fetched_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint goalie_underlying_summary_partitions_pkey primary key (game_id, strength, score_state),
  constraint goalie_underlying_summary_partitions_source_url_key unique (source_url)
) TABLESPACE pg_default;

create index IF not exists goalie_underlying_summary_partitions_season_idx on public.goalie_underlying_summary_partitions using btree (season_id, game_date desc) TABLESPACE pg_default;

create index IF not exists goalie_underlying_summary_partitions_date_idx on public.goalie_underlying_summary_partitions using btree (game_date desc, fetched_at desc) TABLESPACE pg_default;

create index IF not exists goalie_underlying_summary_partitions_source_url_idx on public.goalie_underlying_summary_partitions using btree (source_url) TABLESPACE pg_default;
```