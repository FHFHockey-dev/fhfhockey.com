do $guard$
begin
  if exists (
    select 1
    from public.yahoo_names
    where nullif(btrim(player_id), '') is null
  ) then
    raise exception using
      errcode = '23502',
      message = 'yahoo_names.player_id contains null or blank identities.';
  end if;

  if exists (
    select 1
    from public.yahoo_names
    group by player_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'yahoo_names.player_id contains duplicate identities.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'yahoo_names',
        'yahoo_nhl_player_map',
        'yahoo_players',
        'yahoo_positions'
      )
      and (
        relation.relkind <> 'r'
        or not relation.relrowsecurity
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'Yahoo read surface RLS no longer matches the expected contract.';
  end if;
end
$guard$;

alter table public.yahoo_names
  alter column player_id set not null;

create unique index yahoo_names_player_id_key
  on public.yahoo_names (player_id);

create policy public_read
  on public.yahoo_positions
  for select
  to anon, authenticated
  using (true);

create view public.yahoo_nhl_player_map_read
with (security_invoker = true)
as
select
  mapping.nhl_player_id,
  mapping.nhl_player_name,
  mapping.nhl_team_abbreviation,
  mapping.yahoo_player_id,
  mapping.yahoo_player_name,
  mapping.yahoo_team,
  mapping.percent_ownership,
  mapping.eligible_positions,
  mapping.injury_note,
  mapping.status,
  mapping.status_full,
  mapping.points,
  mapping.goals,
  mapping.assists,
  mapping.shots,
  mapping.pp_points,
  mapping.blocked_shots,
  mapping.hits,
  mapping.total_fow,
  mapping.penalty_minutes,
  mapping.sh_points,
  mapping.wins,
  mapping.losses,
  mapping.saves,
  mapping.shots_against,
  mapping.shutouts,
  mapping.quality_start,
  mapping.goals_against_avg,
  mapping.save_pct,
  mapping.player_type,
  case when mapping.player_type = 'goalie' then 'G' else 'Skater' end
    as player_position,
  case when mapping.player_type = 'goalie' then 'G' else 'Skater' end
    as mapped_position,
  case when mapping.player_type = 'goalie' then 'G' else 'Skater' end
    as normalized_position,
  public.immutable_unaccent(
    lower(coalesce(mapping.nhl_team_abbreviation, mapping.yahoo_team))
  ) as normalized_team,
  null::numeric as percent_games
from public.yahoo_nhl_player_map as mapping;

revoke all on table
  public.yahoo_names,
  public.yahoo_nhl_player_map,
  public.yahoo_nhl_player_map_mat,
  public.yahoo_nhl_player_map_read,
  public.yahoo_players,
  public.yahoo_positions
from public, anon, authenticated;

grant select on table
  public.yahoo_names,
  public.yahoo_nhl_player_map,
  public.yahoo_nhl_player_map_read,
  public.yahoo_players,
  public.yahoo_positions
to anon, authenticated;

comment on column public.yahoo_names.player_id is
  'Stable nonblank Yahoo player identity; unique across the compatibility name catalog.';

comment on view public.yahoo_nhl_player_map_read is
  'Security-invoker Yahoo/NHL compatibility mapping over RLS-protected base rows.';
