create table if not exists public.goalie_underlying_summary_partitions (
  game_id bigint not null,
  season_id integer not null,
  game_date date not null,
  strength text not null,
  score_state text not null,
  endpoint text not null default 'landing',
  source_url text not null,
  shared_source_url text not null,
  payload_hash text not null,
  payload jsonb not null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goalie_underlying_summary_partitions_pkey
    primary key (game_id, strength, score_state),
  constraint goalie_underlying_summary_partitions_source_url_key
    unique (source_url)
);

create index if not exists goalie_underlying_summary_partitions_season_idx
  on public.goalie_underlying_summary_partitions (season_id, game_date desc);

create index if not exists goalie_underlying_summary_partitions_date_idx
  on public.goalie_underlying_summary_partitions (game_date desc, fetched_at desc);

create index if not exists goalie_underlying_summary_partitions_source_url_idx
  on public.goalie_underlying_summary_partitions (source_url);