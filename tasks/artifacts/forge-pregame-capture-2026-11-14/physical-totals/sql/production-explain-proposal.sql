-- PROPOSAL ONLY until TJ approves this exact text. One read-only psql session to production through the pooler
-- (operator/pgpool.sh, as postgres, non-superuser). No ANALYZE: nothing below executes the aggregate; EXPLAIN only
-- plans it. Catalog reads only otherwise. The transaction is rolled back.
-- Inputs: tonight's failing call, forge_league_skater_physical_totals(20262027, '2026-11-15') (0330, 8,031 ms, 57014).
begin read only;
set local statement_timeout = '5s';
set local lock_timeout = '1s';

-- 1. Planner settings.
select name, setting from pg_settings
where name in ('random_page_cost', 'seq_page_cost', 'effective_cache_size', 'work_mem', 'default_statistics_target',
               'jit', 'max_parallel_workers_per_gather', 'server_version');

-- 2. Table size, row estimate, vacuum/analyze state (index-only scans depend on the visibility map).
select c.reltuples::bigint, c.relpages, c.relallvisible,
       pg_size_pretty(pg_relation_size(c.oid)) as heap, pg_size_pretty(pg_total_relation_size(c.oid)) as total,
       s.n_live_tup, s.n_dead_tup, s.last_vacuum, s.last_autovacuum, s.last_analyze, s.last_autoanalyze
from pg_class c join pg_stat_user_tables s on s.relid = c.oid
where c.oid = 'public.wgo_skater_stats'::regclass;

-- 3. Indexes and their sizes.
select i.indexrelid::regclass as index, pg_size_pretty(pg_relation_size(i.indexrelid)) as size,
       pg_get_indexdef(i.indexrelid) as def
from pg_index i where i.indrelid = 'public.wgo_skater_stats'::regclass order by 1;

-- 4. Column statistics for the filtered columns, and the average row width (for a production-shaped local bench).
select attname, n_distinct, null_frac, correlation, avg_width from pg_stats
where schemaname = 'public' and tablename = 'wgo_skater_stats'
  and attname in ('season_id', 'date', 'games_played', 'toi_per_game', 'position_code', 'hits', 'blocked_shots');
select count(*) as columns, sum(avg_width) as avg_row_width from pg_stats
where schemaname = 'public' and tablename = 'wgo_skater_stats';

-- 5. The function body (migration 20261112090000) as a prepared statement. A non-inlined SQL function plans with its
--    arguments as parameters, so the generic plan is what the function runs; the custom plan is shown for comparison.
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

-- 6. A candidate rewrite (local, not deployed): the same body plus a range on date that the planner can use as an
--    index condition. Planned only, so the two plans can be compared on production statistics.
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

set local plan_cache_mode = force_generic_plan;
explain execute probe(20262027, '2026-11-15');
set local plan_cache_mode = force_custom_plan;
explain execute probe(20262027, '2026-11-15');
set local plan_cache_mode = force_generic_plan;
explain execute candidate(20262027, '2026-11-15');
set local plan_cache_mode = force_custom_plan;
explain execute candidate(20262027, '2026-11-15');
rollback;
