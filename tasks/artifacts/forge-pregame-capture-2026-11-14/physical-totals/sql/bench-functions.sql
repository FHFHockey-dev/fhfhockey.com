-- Local benchmark copies (generated). current = migration 20261112090000; candidate adds the hull range.
create or replace function public.bench_current(p_season_id integer, p_cutoff date)
returns table (
  scope text,
  position_group text,
  player_games bigint,
  hits bigint,
  blocks bigint,
  toi_seconds double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select (p_season_id / 10000) as y
    where p_season_id between 19001901 and 29992999 and p_season_id % 10000 = p_season_id / 10000 + 1
      and p_cutoff >= pg_catalog.make_date(p_season_id / 10000, 9, 1)
  ),
  rows as (
    select
      case when s.season_id = p_season_id then 'to_date' else 'prior2' end as scope,
      case when s.position_code = 'D' then 'D' else 'F' end as position_group,
      coalesce(s.hits, 0) as hits, coalesce(s.blocked_shots, 0) as blocks, s.toi_per_game::double precision as toi
    from public.wgo_skater_stats s
    cross join bounds b
    where s.games_played = 1 and s.toi_per_game > 0 and s.position_code in ('C', 'L', 'R', 'D')
      and (
        (s.season_id = p_season_id
          and s.date >= pg_catalog.make_date(b.y, 9, 1) and s.date < least(p_cutoff, pg_catalog.make_date(b.y + 1, 9, 1)))
        or (s.season_id in (p_season_id - 10001, p_season_id - 20002)
          and s.date >= pg_catalog.make_date(b.y - 2, 9, 1) and s.date < pg_catalog.make_date(b.y, 9, 1)
          and extract(year from s.date - interval '8 months')::integer = s.season_id / 10000)
      )
  )
  select k.scope, k.position_group, count(r.hits), coalesce(sum(r.hits), 0)::bigint,
    coalesce(sum(r.blocks), 0)::bigint, coalesce(sum(r.toi), 0)
  from (values ('to_date', 'F'), ('to_date', 'D'), ('prior2', 'F'), ('prior2', 'D')) k(scope, position_group)
  left join rows r using (scope, position_group)
  group by k.scope, k.position_group
  order by k.scope, k.position_group;
$$;

create or replace function public.bench_candidate(p_season_id integer, p_cutoff date)
returns table (
  scope text,
  position_group text,
  player_games bigint,
  hits bigint,
  blocks bigint,
  toi_seconds double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select (p_season_id / 10000) as y
    where p_season_id between 19001901 and 29992999 and p_season_id % 10000 = p_season_id / 10000 + 1
      and p_cutoff >= pg_catalog.make_date(p_season_id / 10000, 9, 1)
  ),
  rows as (
    select
      case when s.season_id = p_season_id then 'to_date' else 'prior2' end as scope,
      case when s.position_code = 'D' then 'D' else 'F' end as position_group,
      coalesce(s.hits, 0) as hits, coalesce(s.blocked_shots, 0) as blocks, s.toi_per_game::double precision as toi
    from public.wgo_skater_stats s
    cross join bounds b
    where s.games_played = 1 and s.toi_per_game > 0 and s.position_code in ('C', 'L', 'R', 'D')
      and s.date >= pg_catalog.make_date(greatest(3, least(9997, p_season_id / 10000)) - 2, 9, 1)
      and s.date < least(p_cutoff, pg_catalog.make_date(greatest(3, least(9997, p_season_id / 10000)) + 1, 9, 1))
      and (
        (s.season_id = p_season_id
          and s.date >= pg_catalog.make_date(b.y, 9, 1) and s.date < least(p_cutoff, pg_catalog.make_date(b.y + 1, 9, 1)))
        or (s.season_id in (p_season_id - 10001, p_season_id - 20002)
          and s.date >= pg_catalog.make_date(b.y - 2, 9, 1) and s.date < pg_catalog.make_date(b.y, 9, 1)
          and extract(year from s.date - interval '8 months')::integer = s.season_id / 10000)
      )
  )
  select k.scope, k.position_group, count(r.hits), coalesce(sum(r.hits), 0)::bigint,
    coalesce(sum(r.blocks), 0)::bigint, coalesce(sum(r.toi), 0)
  from (values ('to_date', 'F'), ('to_date', 'D'), ('prior2', 'F'), ('prior2', 'D')) k(scope, position_group)
  left join rows r using (scope, position_group)
  group by k.scope, k.position_group
  order by k.scope, k.position_group;
$$;
