-- NOT APPLIED. FORGE pregame capture lane (Claude Chef), 2026-11-16. Successor to 20261112090000 (order 137,
-- applied). Apply only with TJ's pop-up approval, by hand in the two steps below, then record schema_migrations and
-- migration-authority.json (order 155).
--
-- Problem: forge_league_skater_physical_totals(20262027, '2026-11-15') took 7,441 ms and 7,507 ms on 2026-11-15 and
-- 8,031 ms on 2026-11-16 00:44Z, where it hit the 8 s statement timeout (57014) and failed the 2026020330 capture.
-- Production read-only EXPLAIN (2026-11-16 00:54Z): the body already narrows by date (BitmapOr on
-- idx_wgo_skater_stats_date), but about 2.2 seasons of wide rows (2.26M rows, 2.2 GB heap, about 8 rows per page,
-- date correlation 0.39) are scattered over tens of thousands of heap pages.
-- Fix, two parts that only work together:
--   1. A covering partial index, idx_wgo_skater_stats_gp1_physical, on (date) INCLUDE (season_id, position_code,
--      toi_per_game, hits, blocked_shots) WHERE games_played = 1 AND toi_per_game > 0. It holds every column the
--      body reads, so the read can skip the heap on all-visible pages.
--   2. The same body plus one date range spanning both scopes, written from the arguments alone, so the planner can
--      use it as an index condition. The function plans generically (a non-inlined SQL function); without this
--      range its OR of two date ranges forces a bitmap heap scan, and the index alone does not help.
-- Local production-scale benchmark (2.23M rows, 7 rows per page, correlation 0.25), generic plan: 54,303 pages
-- before; 5,064 pages and an Index Only Scan after. The 4-row answer is identical (md5 e37e23e0...); index only:
-- 36,113 pages; rewrite only: about 57,000 pages. Index size about 58 MB.
-- Unchanged: signature, result columns and order, STABLE, SECURITY INVOKER, search_path '', EXECUTE revoked from
-- public / anon / authenticated and granted to service_role only. Reader: web/lib/projections/queries/skater-queries.ts
-- (no code change). Writes no data.
--
-- Applying by hand (CONCURRENTLY cannot run inside a transaction or through apply_migration):
--   Step 1, the index, on its own session, so the WGO upserts are not blocked while it builds:
--     set statement_timeout = '15min';
--     create index concurrently if not exists idx_wgo_skater_stats_gp1_physical on public.wgo_skater_stats (date)
--       include (season_id, position_code, toi_per_game, hits, blocked_shots)
--       where games_played = 1 and toi_per_game > 0;
--   Check it is valid before step 2:
--     select indisvalid, indisready from pg_index where indexrelid = 'public.idx_wgo_skater_stats_gp1_physical'::regclass;
--   A failed concurrent build leaves an INVALID index: drop index concurrently if exists
--   public.idx_wgo_skater_stats_gp1_physical; and stop (no retry without approval).
--   Step 2, only once the index is valid: the function below (begin ... commit), then the ledger row.
--   Do not run step 2 without the index: the rewritten body alone reads slightly more pages than today's.
-- READBACK (after step 2; reads the catalog only, does not call the function):
--   select md5(prosrc), provolatile, prosecdef, proconfig, proacl from pg_catalog.pg_proc
--    where oid = 'public.forge_league_skater_physical_totals(integer, date)'::pg_catalog.regprocedure;
--   expect md5 5b67ecb4dee0e75e6285fc5468ef06e7, provolatile 's', prosecdef false, proconfig {search_path=""}, and EXECUTE for
--   service_role (and the owner) only; and pg_get_indexdef of idx_wgo_skater_stats_gp1_physical as created above, valid.
-- Proof: supabase/tests/forge_physical_totals_covering.py (local PG15).
-- Rollback: supabase/tests/forge_physical_totals_covering_rollback.sql restores the 20261112090000 body (prosrc md5
-- 0eec9782543c02db802b021c950ecf6e) with its grants; then drop index concurrently if exists
-- public.idx_wgo_skater_stats_gp1_physical.

create index if not exists idx_wgo_skater_stats_gp1_physical on public.wgo_skater_stats (date)
  include (season_id, position_code, toi_per_game, hits, blocked_shots)
  where games_played = 1 and toi_per_game > 0;

begin;

create or replace function public.forge_league_skater_physical_totals(p_season_id integer, p_cutoff date)
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
      -- One date range covering both scopes, from the arguments alone, so it can bound an index-only scan of
      -- idx_wgo_skater_stats_gp1_physical. Implied by the scope predicates below whenever bounds has a row (the
      -- cutoff is on or after Sept 1 of the season), so the answer is unchanged; the clamp only keeps make_date
      -- valid for arguments bounds rejects anyway.
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

revoke all on function public.forge_league_skater_physical_totals(integer, date) from public, anon, authenticated;
grant execute on function public.forge_league_skater_physical_totals(integer, date) to service_role;

commit;
