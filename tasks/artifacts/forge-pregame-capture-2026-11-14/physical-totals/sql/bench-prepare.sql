-- Generated from production-explain-proposal.sql sections 5 and 6 (local benchmark only).
prepare probe(integer, date) as
  with bounds as (
    select ($1 / 10000) as y
    where $1 between 19001901 and 29992999 and $1 % 10000 = $1 / 10000 + 1
      and $2 >= pg_catalog.make_date($1 / 10000, 9, 1)
  ),
  rows as (
    select
      case when s.season_id = $1 then 'to_date' else 'prior2' end as scope,
      case when s.position_code = 'D' then 'D' else 'F' end as position_group,
      coalesce(s.hits, 0) as hits, coalesce(s.blocked_shots, 0) as blocks, s.toi_per_game::double precision as toi
    from public.wgo_skater_stats s
    cross join bounds b
    where s.games_played = 1 and s.toi_per_game > 0 and s.position_code in ('C', 'L', 'R', 'D')
      and (
        (s.season_id = $1
          and s.date >= pg_catalog.make_date(b.y, 9, 1) and s.date < least($2, pg_catalog.make_date(b.y + 1, 9, 1)))
        or (s.season_id in ($1 - 10001, $1 - 20002)
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

prepare candidate(integer, date) as
  with bounds as (
    select ($1 / 10000) as y
    where $1 between 19001901 and 29992999 and $1 % 10000 = $1 / 10000 + 1
      and $2 >= pg_catalog.make_date($1 / 10000, 9, 1)
  ),
  rows as (
    select
      case when s.season_id = $1 then 'to_date' else 'prior2' end as scope,
      case when s.position_code = 'D' then 'D' else 'F' end as position_group,
      coalesce(s.hits, 0) as hits, coalesce(s.blocked_shots, 0) as blocks, s.toi_per_game::double precision as toi
    from public.wgo_skater_stats s
    cross join bounds b
    where s.games_played = 1 and s.toi_per_game > 0 and s.position_code in ('C', 'L', 'R', 'D')
      -- Candidate: the hull of both branches, computed from the arguments alone so it can bound the index scan.
      -- Implied by the branches whenever bounds has a row (the cutoff is on or after Sep 1 of the season), so the
      -- result is unchanged; the clamp only keeps make_date valid for inputs that bounds rejects anyway.
      and s.date >= pg_catalog.make_date(greatest(3, least(9997, $1 / 10000)) - 2, 9, 1)
      and s.date < least($2, pg_catalog.make_date(greatest(3, least(9997, $1 / 10000)) + 1, 9, 1))
      and (
        (s.season_id = $1
          and s.date >= pg_catalog.make_date(b.y, 9, 1) and s.date < least($2, pg_catalog.make_date(b.y + 1, 9, 1)))
        or (s.season_id in ($1 - 10001, $1 - 20002)
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

