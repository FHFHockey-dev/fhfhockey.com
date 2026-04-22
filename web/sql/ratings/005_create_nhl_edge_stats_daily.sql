create table if not exists public.nhl_edge_stats_daily (
  snapshot_date date not null,
  season_id bigint not null,
  game_type smallint not null default 2,
  entity_type text not null check (entity_type in ('skater', 'team', 'goalie')),
  entity_id bigint not null,
  entity_slug text,
  entity_name text,
  team_id bigint,
  team_abbreviation text,
  endpoint_family text not null,
  endpoint_variant text not null default '',
  rank_order integer not null default 0,
  source text not null default 'nhl-edge',
  source_url text not null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (
    snapshot_date,
    season_id,
    game_type,
    endpoint_family,
    endpoint_variant,
    entity_type,
    entity_id
  )
);

create index if not exists idx_nhl_edge_stats_daily_snapshot
  on public.nhl_edge_stats_daily (snapshot_date desc, endpoint_family, endpoint_variant);

create index if not exists idx_nhl_edge_stats_daily_entity
  on public.nhl_edge_stats_daily (entity_type, entity_id, season_id, game_type);

create index if not exists idx_nhl_edge_stats_daily_team
  on public.nhl_edge_stats_daily (team_id, team_abbreviation, season_id, game_type);

comment on table public.nhl_edge_stats_daily is
  'Daily historical snapshots of public NHL Edge payloads for skaters, teams, goalies, and supported leaderboard families.';
