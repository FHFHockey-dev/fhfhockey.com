# forge_goalie_game

```sql
create table public.forge_goalie_game (
  game_id bigint not null,
  goalie_id bigint not null,
  team_id smallint not null,
  opponent_team_id smallint null,
  game_date date not null,
  shots_against integer null,
  goals_allowed integer null,
  saves integer null,
  toi_seconds integer null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint goalie_game_v2_pkey primary key (game_id, goalie_id),
  constraint goalie_game_v2_game_id_fkey foreign KEY (game_id) references games (id),
  constraint goalie_game_v2_goalie_id_fkey foreign KEY (goalie_id) references players (id),
  constraint goalie_game_v2_opponent_team_id_fkey foreign KEY (opponent_team_id) references teams (id),
  constraint goalie_game_v2_team_id_fkey foreign KEY (team_id) references teams (id)
) TABLESPACE pg_default;

create index IF not exists idx_goalie_game_v2_game_date on public.forge_goalie_game using btree (game_date) TABLESPACE pg_default;

create index IF not exists idx_goalie_game_v2_team_game on public.forge_goalie_game using btree (team_id, game_id) TABLESPACE pg_default;
```

# forge_goalie_projections

```sql
create table public.forge_goalie_projections (
  run_id uuid not null,
  as_of_date date not null,
  horizon_games smallint not null,
  game_id bigint not null,
  goalie_id bigint not null,
  team_id smallint not null,
  opponent_team_id smallint not null,
  starter_probability numeric null,
  proj_shots_against numeric null,
  proj_saves numeric null,
  proj_goals_allowed numeric null,
  proj_win_prob numeric null,
  proj_shutout_prob numeric null,
  uncertainty jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint goalie_projections_v2_pkey primary key (run_id, game_id, goalie_id, horizon_games),
  constraint goalie_projections_v2_goalie_id_fkey foreign KEY (goalie_id) references players (id),
  constraint goalie_projections_v2_opponent_team_id_fkey foreign KEY (opponent_team_id) references teams (id),
  constraint goalie_projections_v2_team_id_fkey foreign KEY (team_id) references teams (id),
  constraint goalie_projections_v2_run_id_fkey foreign KEY (run_id) references forge_runs (run_id),
  constraint goalie_projections_v2_game_id_fkey foreign KEY (game_id) references games (id),
  constraint goalie_projections_v2_horizon_check check (
    (
      (horizon_games >= 1)
      and (horizon_games <= 10)
    )
  ),
  constraint goalie_projections_v2_starter_prob_check check (
    (
      (starter_probability is null)
      or (
        (starter_probability >= (0)::numeric)
        and (starter_probability <= (1)::numeric)
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_goalie_projections_v2_as_of_date on public.forge_goalie_projections using btree (as_of_date) TABLESPACE pg_default;

create index IF not exists idx_goalie_projections_v2_game on public.forge_goalie_projections using btree (game_id) TABLESPACE pg_default;

create index IF not exists idx_goalie_projections_v2_goalie on public.forge_goalie_projections using btree (goalie_id) TABLESPACE pg_default;

create index IF not exists idx_goalie_projections_v2_date_horizon on public.forge_goalie_projections using btree (as_of_date, horizon_games) TABLESPACE pg_default;

create index IF not exists idx_goalie_projections_v2_date_team_horizon on public.forge_goalie_projections using btree (as_of_date, team_id, horizon_games) TABLESPACE pg_default;
```

# forge_player_game_strength

```sql
create table public.forge_player_game_strength (
  game_id bigint not null,
  player_id bigint not null,
  team_id smallint not null,
  opponent_team_id smallint null,
  game_date date not null,
  toi_es_seconds integer null,
  toi_pp_seconds integer null,
  toi_pk_seconds integer null,
  shots_es integer null,
  shots_pp integer null,
  shots_pk integer null,
  goals_es integer null,
  goals_pp integer null,
  goals_pk integer null,
  assists_es integer null,
  assists_pp integer null,
  assists_pk integer null,
  hits integer null,
  blocks integer null,
  pim integer null,
  plus_minus integer null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_game_strength_v2_pkey primary key (game_id, player_id),
  constraint player_game_strength_v2_game_id_fkey foreign KEY (game_id) references games (id),
  constraint player_game_strength_v2_opponent_team_id_fkey foreign KEY (opponent_team_id) references teams (id),
  constraint player_game_strength_v2_player_id_fkey foreign KEY (player_id) references players (id),
  constraint player_game_strength_v2_team_id_fkey foreign KEY (team_id) references teams (id)
) TABLESPACE pg_default;

create index IF not exists idx_player_game_strength_v2_game_date on public.forge_player_game_strength using btree (game_date) TABLESPACE pg_default;

create index IF not exists idx_player_game_strength_v2_team_game on public.forge_player_game_strength using btree (team_id, game_id) TABLESPACE pg_default;
```

# forge_player_projections

```sql
create table public.forge_player_projections (
  run_id uuid not null,
  as_of_date date not null,
  horizon_games smallint not null,
  game_id bigint not null,
  player_id bigint not null,
  team_id smallint not null,
  opponent_team_id smallint not null,
  proj_toi_es_seconds integer null,
  proj_toi_pp_seconds integer null,
  proj_toi_pk_seconds integer null,
  proj_shots_es numeric null,
  proj_shots_pp numeric null,
  proj_shots_pk numeric null,
  proj_goals_es numeric null,
  proj_goals_pp numeric null,
  proj_goals_pk numeric null,
  proj_assists_es numeric null,
  proj_assists_pp numeric null,
  proj_assists_pk numeric null,
  proj_hits numeric null,
  proj_blocks numeric null,
  proj_pim numeric null,
  proj_plus_minus numeric null,
  uncertainty jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_projections_v2_pkey primary key (run_id, game_id, player_id, horizon_games),
  constraint player_projections_v2_opponent_team_id_fkey foreign KEY (opponent_team_id) references teams (id),
  constraint player_projections_v2_game_id_fkey foreign KEY (game_id) references games (id),
  constraint player_projections_v2_player_id_fkey foreign KEY (player_id) references players (id),
  constraint player_projections_v2_run_id_fkey foreign KEY (run_id) references forge_runs (run_id),
  constraint player_projections_v2_team_id_fkey foreign KEY (team_id) references teams (id),
  constraint player_projections_v2_horizon_check check (
    (
      (horizon_games >= 1)
      and (horizon_games <= 10)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_player_projections_v2_as_of_date on public.forge_player_projections using btree (as_of_date) TABLESPACE pg_default;

create index IF not exists idx_player_projections_v2_game on public.forge_player_projections using btree (game_id) TABLESPACE pg_default;

create index IF not exists idx_player_projections_v2_player on public.forge_player_projections using btree (player_id) TABLESPACE pg_default;

create index IF not exists idx_player_projections_v2_team on public.forge_player_projections using btree (team_id) TABLESPACE pg_default;

create index IF not exists idx_player_projections_v2_date_horizon on public.forge_player_projections using btree (as_of_date, horizon_games) TABLESPACE pg_default;

create index IF not exists idx_player_projections_v2_date_team_horizon on public.forge_player_projections using btree (as_of_date, team_id, horizon_games) TABLESPACE pg_default;

create index IF not exists idx_player_projections_v2_date_opponent_horizon on public.forge_player_projections using btree (as_of_date, opponent_team_id, horizon_games) TABLESPACE pg_default;
```

# forge_roster_events

```sql
create table public.forge_roster_events (
  event_id bigint generated by default as identity not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  effective_from timestamp with time zone not null default now(),
  effective_to timestamp with time zone null,
  team_id smallint null,
  player_id bigint null,
  event_type text not null,
  confidence numeric not null default 0.5,
  payload jsonb not null default '{}'::jsonb,
  source_text text null,
  constraint roster_events_pkey primary key (event_id),
  constraint roster_events_player_id_fkey foreign KEY (player_id) references players (id),
  constraint roster_events_team_id_fkey foreign KEY (team_id) references teams (id),
  constraint roster_events_confidence_check check (
    (
      (confidence >= (0)::numeric)
      and (confidence <= (1)::numeric)
    )
  ),
  constraint roster_events_subject_check check (
    (
      (team_id is not null)
      or (player_id is not null)
    )
  ),
  constraint roster_events_type_check check (
    (
      event_type = any (
        array[
          'INJURY_OUT'::text,
          'DTD'::text,
          'RETURN'::text,
          'CALLUP'::text,
          'SENDDOWN'::text,
          'LINE_CHANGE'::text,
          'PP_UNIT_CHANGE'::text,
          'GOALIE_START_CONFIRMED'::text,
          'GOALIE_START_LIKELY'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_roster_events_team_effective_from on public.forge_roster_events using btree (team_id, effective_from desc) TABLESPACE pg_default;

create index IF not exists idx_roster_events_player_effective_from on public.forge_roster_events using btree (player_id, effective_from desc) TABLESPACE pg_default;
```

# forge_runs

```sql
create table public.forge_runs (
  run_id uuid not null default gen_random_uuid (),
  as_of_date date not null,
  status text not null default 'created'::text,
  git_sha text null,
  notes text null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint projection_runs_v2_pkey primary key (run_id),
  constraint projection_runs_v2_status_check check (
    (
      status = any (
        array[
          'created'::text,
          'running'::text,
          'succeeded'::text,
          'failed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_projection_runs_v2_as_of_date on public.forge_runs using btree (as_of_date) TABLESPACE pg_default;

create index IF not exists idx_projection_runs_v2_status on public.forge_runs using btree (status) TABLESPACE pg_default;
```

# forge_team_game_strength

```sql
create table public.forge_team_game_strength (
  game_id bigint not null,
  team_id smallint not null,
  opponent_team_id smallint null,
  game_date date not null,
  toi_es_seconds integer null,
  toi_pp_seconds integer null,
  toi_pk_seconds integer null,
  shots_es integer null,
  shots_pp integer null,
  shots_pk integer null,
  goals_es integer null,
  goals_pp integer null,
  goals_pk integer null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint team_game_strength_v2_pkey primary key (game_id, team_id),
  constraint team_game_strength_v2_game_id_fkey foreign KEY (game_id) references games (id),
  constraint team_game_strength_v2_opponent_team_id_fkey foreign KEY (opponent_team_id) references teams (id),
  constraint team_game_strength_v2_team_id_fkey foreign KEY (team_id) references teams (id)
) TABLESPACE pg_default;

create index IF not exists idx_team_game_strength_v2_game_date on public.forge_team_game_strength using btree (game_date) TABLESPACE pg_default;

create index IF not exists idx_team_game_strength_v2_team_game on public.forge_team_game_strength using btree (team_id, game_id) TABLESPACE pg_default;
```

# forge_team_projections

```sql
create table public.forge_team_projections (
  run_id uuid not null,
  as_of_date date not null,
  horizon_games smallint not null,
  game_id bigint not null,
  team_id smallint not null,
  opponent_team_id smallint not null,
  proj_toi_es_seconds integer null,
  proj_toi_pp_seconds integer null,
  proj_toi_pk_seconds integer null,
  proj_shots_es numeric null,
  proj_shots_pp numeric null,
  proj_shots_pk numeric null,
  proj_goals_es numeric null,
  proj_goals_pp numeric null,
  proj_goals_pk numeric null,
  uncertainty jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint team_projections_v2_pkey primary key (run_id, game_id, team_id, horizon_games),
  constraint team_projections_v2_game_id_fkey foreign KEY (game_id) references games (id),
  constraint team_projections_v2_opponent_team_id_fkey foreign KEY (opponent_team_id) references teams (id),
  constraint team_projections_v2_run_id_fkey foreign KEY (run_id) references forge_runs (run_id),
  constraint team_projections_v2_team_id_fkey foreign KEY (team_id) references teams (id),
  constraint team_projections_v2_horizon_check check (
    (
      (horizon_games >= 1)
      and (horizon_games <= 10)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_team_projections_v2_as_of_date on public.forge_team_projections using btree (as_of_date) TABLESPACE pg_default;

create index IF not exists idx_team_projections_v2_game on public.forge_team_projections using btree (game_id) TABLESPACE pg_default;

create index IF not exists idx_team_projections_v2_team on public.forge_team_projections using btree (team_id) TABLESPACE pg_default;

create index IF not exists idx_team_projections_v2_date_horizon on public.forge_team_projections using btree (as_of_date, horizon_games) TABLESPACE pg_default;

create index IF not exists idx_team_projections_v2_date_team_horizon on public.forge_team_projections using btree (as_of_date, team_id, horizon_games) TABLESPACE pg_default;
```

# forge_projection_accuracy_stat_daily

```sql
create table public.forge_projection_accuracy_stat_daily (
  date date not null,
  scope text not null,
  stat_key text not null,
  mae numeric not null,
  rmse numeric not null,
  player_count integer not null,
  error_abs_sum numeric not null,
  error_sq_sum numeric not null,
  updated_at timestamp with time zone not null default now(),
  constraint forge_projection_accuracy_stat_daily_pkey primary key (date, scope, stat_key)
) TABLESPACE pg_default;

create index IF not exists idx_projection_accuracy_stat_daily_date on public.forge_projection_accuracy_stat_daily using btree (date) TABLESPACE pg_default;

create index IF not exists idx_projection_accuracy_stat_daily_scope on public.forge_projection_accuracy_stat_daily using btree (scope) TABLESPACE pg_default;
```
