begin;

create table if not exists public.player_lineup_deployment_tallies (
  player_id bigint not null references public.players(id) on delete cascade,
  season_id integer not null,
  game_type integer not null,
  deployment_group text not null,
  deployment_code text not null,
  deployment_label text not null,
  line_number integer null,
  slot_number integer null,
  slot_label text null,
  unit_number integer null,
  games integer not null,
  total_games integer not null,
  share numeric(7, 4) not null,
  team_ids integer[] not null default '{}'::integer[],
  first_game_date date null,
  last_game_date date null,
  source_table text not null,
  source_version text not null default 'lcpg_v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_lineup_deployment_tallies_pkey
    primary key (player_id, season_id, game_type, deployment_group, deployment_code),
  constraint player_lineup_deployment_tallies_game_type_check
    check (game_type in (2, 3)),
  constraint player_lineup_deployment_tallies_group_check
    check (deployment_group in ('forward', 'defense', 'power_play')),
  constraint player_lineup_deployment_tallies_games_check
    check (games >= 0 and total_games > 0 and games <= total_games),
  constraint player_lineup_deployment_tallies_share_check
    check (share >= 0 and share <= 1),
  constraint player_lineup_deployment_tallies_source_table_check
    check (source_table in ('shift_charts', 'lineCombinations', 'powerPlayCombinations'))
);

create index if not exists idx_player_lineup_deployment_tallies_player_season
  on public.player_lineup_deployment_tallies (
    player_id,
    season_id desc,
    game_type,
    deployment_group
  );

create index if not exists idx_player_lineup_deployment_tallies_season_group
  on public.player_lineup_deployment_tallies (
    season_id,
    game_type,
    deployment_group,
    deployment_code
  );

alter table public.player_lineup_deployment_tallies enable row level security;

grant select on table public.player_lineup_deployment_tallies to anon, authenticated;
grant all on table public.player_lineup_deployment_tallies to service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.player_lineup_deployment_tallies from anon, authenticated;

drop policy if exists "public_read" on public.player_lineup_deployment_tallies;
create policy "public_read"
  on public.player_lineup_deployment_tallies
  for select
  to anon, authenticated
  using (true);

create or replace function public.refresh_player_lineup_deployment_tallies(
  p_season_id integer default null,
  p_player_id bigint default null
)
returns table(deleted_rows integer, inserted_rows integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deleted_rows integer := 0;
  v_inserted_rows integer := 0;
begin
  delete from public.player_lineup_deployment_tallies t
  where (p_season_id is null or t.season_id = p_season_id)
    and (p_player_id is null or t.player_id = p_player_id);

  get diagnostics v_deleted_rows = row_count;

  insert into public.player_lineup_deployment_tallies (
    player_id,
    season_id,
    game_type,
    deployment_group,
    deployment_code,
    deployment_label,
    line_number,
    slot_number,
    slot_label,
    unit_number,
    games,
    total_games,
    share,
    team_ids,
    first_game_date,
    last_game_date,
    source_table,
    updated_at
  )
  with forward_source as (
    select distinct
      f.player_id::bigint as player_id,
      g."seasonId"::integer as season_id,
      g.type::integer as game_type,
      lc."gameId"::bigint as game_id,
      g.date::date as game_date,
      lc."teamId"::integer as team_id,
      (floor((f.ordinality - 1) / 3)::integer + 1) as line_number,
      case
        when upper(p.position::text) in ('LW', 'L') then 'LW'
        when upper(p.position::text) = 'C' then 'C'
        when upper(p.position::text) in ('RW', 'R') then 'RW'
        else null
      end as slot_label
    from public."lineCombinations" lc
    join public.games g on g.id = lc."gameId"
    cross join lateral unnest(lc.forwards) with ordinality as f(player_id, ordinality)
    left join public.players p on p.id = f.player_id
    where f.ordinality <= 12
      and g.type in (2, 3)
      and (p_season_id is null or g."seasonId"::integer = p_season_id)
      and (p_player_id is null or f.player_id::bigint = p_player_id)
  ),
  forward_counts as (
    select
      player_id,
      season_id,
      game_type,
      'forward'::text as deployment_group,
      ('F' || line_number::text || '_' || slot_label)::text as deployment_code,
      ('Forward Line ' || line_number::text || ' ' || slot_label)::text as deployment_label,
      line_number,
      case slot_label when 'LW' then 1 when 'C' then 2 when 'RW' then 3 end as slot_number,
      slot_label,
      null::integer as unit_number,
      count(distinct game_id)::integer as games,
      array_remove(array_agg(distinct team_id order by team_id), null)::integer[] as team_ids,
      min(game_date) as first_game_date,
      max(game_date) as last_game_date,
      'lineCombinations'::text as source_table
    from forward_source
    where slot_label in ('LW', 'C', 'RW')
    group by player_id, season_id, game_type, line_number, slot_label
  ),
  defense_source as (
    select distinct
      d.player_id::bigint as player_id,
      g."seasonId"::integer as season_id,
      g.type::integer as game_type,
      lc."gameId"::bigint as game_id,
      g.date::date as game_date,
      lc."teamId"::integer as team_id,
      (floor((d.ordinality - 1) / 2)::integer + 1) as line_number,
      case ((d.ordinality - 1) % 2)
        when 0 then 'LD'
        else 'RD'
      end as slot_label
    from public."lineCombinations" lc
    join public.games g on g.id = lc."gameId"
    cross join lateral unnest(lc.defensemen) with ordinality as d(player_id, ordinality)
    where d.ordinality <= 6
      and g.type in (2, 3)
      and (p_season_id is null or g."seasonId"::integer = p_season_id)
      and (p_player_id is null or d.player_id::bigint = p_player_id)
  ),
  defense_counts as (
    select
      player_id,
      season_id,
      game_type,
      'defense'::text as deployment_group,
      ('D' || line_number::text || '_' || slot_label)::text as deployment_code,
      ('Defense Pair ' || line_number::text || ' ' || slot_label)::text as deployment_label,
      line_number,
      case slot_label when 'LD' then 1 when 'RD' then 2 end as slot_number,
      slot_label,
      null::integer as unit_number,
      count(distinct game_id)::integer as games,
      array_remove(array_agg(distinct team_id order by team_id), null)::integer[] as team_ids,
      min(game_date) as first_game_date,
      max(game_date) as last_game_date,
      'lineCombinations'::text as source_table
    from defense_source
    where line_number between 1 and 3
    group by player_id, season_id, game_type, line_number, slot_label
  ),
  power_play_source as (
    select distinct on (pp."playerId", g."seasonId", g.type, pp."gameId")
      pp."playerId"::bigint as player_id,
      g."seasonId"::integer as season_id,
      g.type::integer as game_type,
      pp."gameId"::bigint as game_id,
      g.date::date as game_date,
      case
        when g."homeTeamId" = lc."teamId" or g."awayTeamId" = lc."teamId"
          then lc."teamId"::integer
        else null
      end as team_id,
      pp.unit::integer as unit_number
    from public."powerPlayCombinations" pp
    join public.games g on g.id = pp."gameId"
    left join public."lineCombinations" lc
      on lc."gameId" = pp."gameId"
     and pp."playerId" = any(lc.forwards || lc.defensemen)
    where pp.unit in (1, 2)
      and g.type in (2, 3)
      and (p_season_id is null or g."seasonId"::integer = p_season_id)
      and (p_player_id is null or pp."playerId"::bigint = p_player_id)
    order by pp."playerId", g."seasonId", g.type, pp."gameId", pp.unit
  ),
  power_play_counts as (
    select
      player_id,
      season_id,
      game_type,
      'power_play'::text as deployment_group,
      ('PP' || unit_number::text)::text as deployment_code,
      ('Power Play ' || unit_number::text)::text as deployment_label,
      null::integer as line_number,
      unit_number as slot_number,
      ('PP' || unit_number::text)::text as slot_label,
      unit_number,
      count(distinct game_id)::integer as games,
      array_remove(array_agg(distinct team_id order by team_id), null)::integer[] as team_ids,
      min(game_date) as first_game_date,
      max(game_date) as last_game_date,
      'powerPlayCombinations'::text as source_table
    from power_play_source
    group by player_id, season_id, game_type, unit_number
  ),
  combined_counts as (
    select * from forward_counts
    union all
    select * from defense_counts
    union all
    select * from power_play_counts
  ),
  with_totals as (
    select
      c.*,
      sum(c.games) over (
        partition by c.player_id, c.season_id, c.game_type, c.deployment_group
      )::integer as total_games
    from combined_counts c
  )
  select
    player_id,
    season_id,
    game_type,
    deployment_group,
    deployment_code,
    deployment_label,
    line_number,
    slot_number,
    slot_label,
    unit_number,
    games,
    total_games,
    round((games::numeric / nullif(total_games, 0)::numeric), 4) as share,
    team_ids,
    first_game_date,
    last_game_date,
    source_table,
    now() as updated_at
  from with_totals
  where total_games > 0;

  get diagnostics v_inserted_rows = row_count;

  return query select v_deleted_rows, v_inserted_rows;
end;
$$;

revoke all on function public.refresh_player_lineup_deployment_tallies(integer, bigint) from public;
grant execute on function public.refresh_player_lineup_deployment_tallies(integer, bigint) to service_role;

comment on table public.player_lineup_deployment_tallies is
  'Per-player lineup deployment percentage-grid tallies for forward line spots, defense pair spots, and PP1/PP2.';

comment on column public.player_lineup_deployment_tallies.share is
  'Cell share within the player/season/game_type/deployment_group denominator.';

comment on function public.refresh_player_lineup_deployment_tallies(integer, bigint) is
  'Refreshes player lineup deployment tallies from lineCombinations and powerPlayCombinations. Optional filters bound the refresh to a season or player.';

commit;
