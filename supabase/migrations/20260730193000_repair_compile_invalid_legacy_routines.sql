-- Repair the three compile-invalid routines exposed by fresh baseline lint.
--
-- Repository and local-catalog scans found no consumers or dependents for the
-- superseded goalie coordinator or legacy Yahoo JSON writer, so preserve their
-- signatures as service-only one-release tombstones. Preserve the read-only
-- aggregate RPC contract and repair only its result typing.

create or replace function public.calculate_goalie_start_projections(
  target_date date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'Legacy RPC retired.';
end;
$$;

alter function public.calculate_goalie_start_projections(date)
  owner to postgres;
revoke all on function public.calculate_goalie_start_projections(date)
  from public, anon, authenticated, service_role;
grant execute on function public.calculate_goalie_start_projections(date)
  to service_role;
comment on function public.calculate_goalie_start_projections(date) is
  'One-release tombstone; update-goalie-projections-v2 owns writes.';

create or replace function public.get_aggregated_player_stats(
  player_id_param integer,
  season_start_date date,
  end_date date
)
returns table (
  shooting_percentage double precision,
  assist_ratio double precision,
  total_peripherals double precision,
  pdo double precision,
  o_zone_start_pct double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    sum(stats.goals)::double precision
      / nullif(sum(stats.shots)::double precision, 0)
      * 100.0,
    sum(stats.total_primary_assists)::double precision
      / nullif(sum(stats.total_secondary_assists)::double precision, 0),
    sum(stats.blocked_shots + stats.hits + stats.shots)::double precision,
    sum(stats.skater_save_pct_5v5)::double precision
      / nullif(sum(stats.shooting_percentage_5v5)::double precision, 0)
      * 100.0,
    avg(stats.zone_start_pct)::double precision
  from public.wgo_skater_stats as stats
  where stats.player_id = player_id_param
    and stats.date >= season_start_date
    and stats.date <= end_date;
$$;

alter function public.get_aggregated_player_stats(integer, date, date)
  owner to postgres;
revoke all on function public.get_aggregated_player_stats(integer, date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.get_aggregated_player_stats(integer, date, date)
  to public, anon, authenticated, service_role;
comment on function public.get_aggregated_player_stats(integer, date, date) is
  'Read-only legacy aggregate contract with explicit double-precision results.';

create or replace function public.upsert_players_batch(players_data jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'Legacy RPC retired.';
end;
$$;

alter function public.upsert_players_batch(jsonb) owner to postgres;
revoke all on function public.upsert_players_batch(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_players_batch(jsonb)
  to service_role;
comment on function public.upsert_players_batch(jsonb) is
  'One-release tombstone; the canonical atomic Yahoo writer owns writes.';
