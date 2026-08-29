-- Add forward-only calculation provenance without relabeling legacy history.

alter table public.player_trend_metrics
  add column if not exists calculation_version text;

alter table public.player_trend_metrics
  drop constraint if exists player_trend_metrics_calculation_version_nonblank,
  add constraint player_trend_metrics_calculation_version_nonblank
    check (
      calculation_version is null
      or (
        nullif(btrim(calculation_version), '') is not null
        and char_length(calculation_version) <= 80
      )
    );

create index if not exists player_trend_metrics_calculation_version_idx
  on public.player_trend_metrics
  (calculation_version, season_id, game_date desc);

comment on column public.player_trend_metrics.calculation_version is
  'Forward calculation contract. NULL means legacy/unverified and must not be inferred.';

alter table public.team_power_ratings_daily
  add column if not exists calculation_version text,
  add column if not exists source_through_date date;

alter table public.team_power_ratings_daily
  drop constraint if exists team_power_ratings_calculation_version_nonblank,
  add constraint team_power_ratings_calculation_version_nonblank
    check (
      calculation_version is null
      or (
        nullif(btrim(calculation_version), '') is not null
        and char_length(calculation_version) <= 80
      )
    ),
  drop constraint if exists team_power_ratings_source_through_date_order,
  add constraint team_power_ratings_source_through_date_order
    check (source_through_date is null or source_through_date <= date);

create index if not exists team_power_ratings_calculation_version_idx
  on public.team_power_ratings_daily
  (calculation_version, date desc, team_abbreviation);

comment on column public.team_power_ratings_daily.calculation_version is
  'Forward rating formula/input contract. NULL means legacy/unverified.';
comment on column public.team_power_ratings_daily.source_through_date is
  'Latest exact source date carried by this rating snapshot.';
