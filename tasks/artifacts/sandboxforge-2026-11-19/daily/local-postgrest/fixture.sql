
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role daily_authenticator login noinherit;
grant service_role to daily_authenticator;
create table public."rolling_player_game_metrics" (
  player_id bigint not null,
  game_id bigint,
  game_date date not null,
  season integer not null,
  strength_state text not null,
  "toi_seconds_avg_last5" numeric,
  "toi_seconds_avg_all" numeric,
  "toi_seconds_total_all" numeric,
  "sog_per_60_last5" numeric,
  "sog_per_60_avg_last5" numeric,
  "sog_per_60_all" numeric,
  "sog_per_60_avg_all" numeric,
  "goals_total_last5" numeric,
  "shots_total_last5" numeric,
  "assists_total_last5" numeric,
  "goals_total_all" numeric,
  "shots_total_all" numeric,
  "assists_total_all" numeric,
  "ipp_all" numeric,
  "hits_per_60_last5" numeric,
  "hits_per_60_avg_last5" numeric,
  "hits_per_60_all" numeric,
  "hits_per_60_avg_all" numeric,
  "blocks_per_60_last5" numeric,
  "blocks_per_60_avg_last5" numeric,
  "blocks_per_60_all" numeric,
  "blocks_per_60_avg_all" numeric,
  "toi_seconds_total_last5" numeric,
  "hits_per_60_hits_3ya" numeric,
  "hits_per_60_toi_seconds_3ya" numeric,
  "blocks_per_60_blocks_3ya" numeric,
  "blocks_per_60_toi_seconds_3ya" numeric,
  "hits_per_60_hits_season" numeric,
  "hits_per_60_toi_seconds_season" numeric,
  "blocks_per_60_blocks_season" numeric,
  "blocks_per_60_toi_seconds_season" numeric,
  primary key (player_id, game_date, strength_state)
);
create table public."rolling_player_metric_support_payloads" (
  player_id bigint not null,
  game_id bigint not null,
  game_date date not null,
  season integer not null,
  strength_state text not null,
  payload_schema_version integer not null,
  support_payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, game_date, strength_state)
);
grant usage on schema public to service_role;
grant select on public."rolling_player_game_metrics", public."rolling_player_metric_support_payloads" to service_role;
insert into public."rolling_player_game_metrics" (player_id, game_date, season, game_id, strength_state) values
  (7, '2026-11-17', 20262027, 2026020317, 'ev'),
  (7, '2026-11-17', 20262027, 2026020317, 'pp'),
  (7, '2026-11-17', 20262027, 2026020317, 'all'),
  (8480252, '2024-01-19', 20232024, null, 'ev'),
  (8480252, '2024-01-19', 20232024, null, 'pp'),
  (8480252, '2024-01-19', 20232024, null, 'all'),
  (8, '2026-11-16', 20262027, null, 'ev'),
  (8, '2026-11-16', 20262027, null, 'pp'),
  (8, '2026-11-16', 20262027, null, 'all');
