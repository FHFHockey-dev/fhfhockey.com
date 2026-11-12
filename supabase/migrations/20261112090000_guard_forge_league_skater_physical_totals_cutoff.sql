-- NOT APPLIED. Math-audit fix lane L4a, SQL ticket from L9a (W2-1 C8). Successor to 20261020211500 (order 88,
-- applied 2026-11-12). Apply only with TJ's pop-up approval, singly, then record schema_migrations and
-- migration-authority.json (order 137).
--
-- Defect: forge_league_skater_physical_totals bounds the 'to_date' scope by p_cutoff but not the 'prior2' scope, so a
-- cutoff before the season starts (e.g. (20262027, '2026-05-01'), during the 2025-26 playoffs) still returns two full
-- prior seasons, including rows the caller has not reached yet (a 2025-04 row labelled 20242025 is counted).
-- Fix: the bounds CTE also requires p_cutoff >= Sept 1 of the season's first year. An out-of-window cutoff then
-- returns the four zero rows, exactly like an invalid season id. Everything else is the 20261020211500 body
-- unchanged: same signature and result columns, STABLE, SECURITY INVOKER, search_path '', EXECUTE revoked from
-- public / anon / authenticated and granted to service_role only. For any cutoff on or after Sept 1 the answer
-- is unchanged. Reader: web/lib/projections/queries/skater-queries.ts (FORGE skater physical rates, one call per
-- run), which already refuses a pre-window cutoff before calling, so this puts the same rule in the RPC itself.
-- Replaces a function body only; writes no data; takes no table lock.
--
-- READBACK (after apply; reads the catalog only, does not call the function):
--   select md5(prosrc), provolatile, prosecdef, proconfig, proacl from pg_catalog.pg_proc
--    where oid = 'public.forge_league_skater_physical_totals(integer, date)'::pg_catalog.regprocedure;
--   expect md5 0eec9782543c02db802b021c950ecf6e, provolatile 's', prosecdef false, proconfig {search_path=""}, and EXECUTE for
--   service_role (and the owner) only.
-- ROLLBACK: supabase/tests/l4a_physical_totals_cutoff_rollback.sql (restores the 20261020211500 body, prosrc md5
--   4d70925bd2a309b78daf0d3e0bf6b01c).
-- PROOF: LC_ALL=C python3 -I supabase/tests/l4a_physical_totals_cutoff.py (disposable local PostgreSQL 15).

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
