alter table public.team_underlying_stats_summary
  add column if not exists wins integer not null default 0,
  add column if not exists losses integer not null default 0,
  add column if not exists otl integer not null default 0,
  add column if not exists row_wins integer not null default 0,
  add column if not exists points integer not null default 0,
  add column if not exists cf integer not null default 0,
  add column if not exists ca integer not null default 0,
  add column if not exists ff integer not null default 0,
  add column if not exists fa integer not null default 0,
  add column if not exists sf integer not null default 0,
  add column if not exists sa integer not null default 0,
  add column if not exists gf integer not null default 0,
  add column if not exists ga integer not null default 0,
  add column if not exists xgf double precision not null default 0,
  add column if not exists xga double precision not null default 0,
  add column if not exists scf integer not null default 0,
  add column if not exists sca integer not null default 0,
  add column if not exists scsf integer not null default 0,
  add column if not exists scsa integer not null default 0,
  add column if not exists scgf integer not null default 0,
  add column if not exists scga integer not null default 0,
  add column if not exists hdcf integer not null default 0,
  add column if not exists hdca integer not null default 0,
  add column if not exists hdsf integer not null default 0,
  add column if not exists hdsa integer not null default 0,
  add column if not exists hdgf integer not null default 0,
  add column if not exists hdga integer not null default 0,
  add column if not exists mdcf integer not null default 0,
  add column if not exists mdca integer not null default 0,
  add column if not exists mdsf integer not null default 0,
  add column if not exists mdsa integer not null default 0,
  add column if not exists mdgf integer not null default 0,
  add column if not exists mdga integer not null default 0,
  add column if not exists ldcf integer not null default 0,
  add column if not exists ldca integer not null default 0,
  add column if not exists ldsf integer not null default 0,
  add column if not exists ldsa integer not null default 0,
  add column if not exists ldgf integer not null default 0,
  add column if not exists ldga integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_underlying_stats_summary_venue_check'
      and conrelid = 'public.team_underlying_stats_summary'::regclass
  ) then
    alter table public.team_underlying_stats_summary
      add constraint team_underlying_stats_summary_venue_check
      check (venue in ('home', 'away'));
  end if;
end
$$;

create index if not exists team_underlying_stats_summary_season_idx
  on public.team_underlying_stats_summary (season_id, game_type, game_date desc);

create index if not exists team_underlying_stats_summary_team_filters_idx
  on public.team_underlying_stats_summary (
    team_id,
    season_id,
    game_type,
    strength,
    score_state,
    venue,
    game_date desc
  );

create index if not exists team_underlying_stats_summary_opponent_filters_idx
  on public.team_underlying_stats_summary (
    opponent_team_id,
    season_id,
    game_type,
    strength,
    score_state,
    venue,
    game_date desc
  );

create index if not exists team_underlying_stats_summary_strength_state_idx
  on public.team_underlying_stats_summary (
    strength,
    score_state,
    season_id,
    game_type,
    game_date desc
  );