-- PROPOSAL ONLY: not run. Needs TJ's approval. One read-only psql session to production through the pooler,
-- with no ANALYZE and no writes; the transaction is rolled back. It plans the candidate probe, it does not run it.
-- Players and as-of date are 0326 team 2's: the read that timed out on 2026-11-15 (approved diagnosis EXPLAIN).
begin read only;
set local statement_timeout = '5s';
set local lock_timeout = '1s';

-- Planner settings and statistics state (catalog reads only).
select name, setting from pg_settings
where name in ('random_page_cost', 'seq_page_cost', 'effective_cache_size', 'default_statistics_target', 'jit', 'server_version');
select reltuples::bigint, relpages from pg_class where oid = 'public.sustainability_trend_bands'::regclass;
select attname, n_distinct, null_frac from pg_stats
where schemaname = 'public' and tablename = 'sustainability_trend_bands'
  and attname in ('player_id', 'snapshot_date', 'metric_key', 'window_code');

-- The candidate function's RETURN QUERY body, as a prepared statement (the function is not deployed).
prepare probe(integer[], text[], text[], date) as
  select requested.id, metrics.k, windows.w,
         latest.snapshot_date, latest.value, latest.ci_lower, latest.ci_upper, latest.n_eff
  from (select distinct ids.id from unnest($1) as ids(id)) as requested
  cross join (select distinct mk.k from unnest($2) as mk(k)) as metrics
  cross join (select distinct wc.w from unnest($3) as wc(w)) as windows
  left join lateral (
    select b.snapshot_date, b.value, b.ci_lower, b.ci_upper, b.n_eff
    from public.sustainability_trend_bands as b
    where b.player_id = requested.id and b.metric_key = metrics.k and b.window_code = windows.w
      and b.snapshot_date <= $4
    order by b.snapshot_date desc
    limit 1
  ) as latest on true
  order by requested.id, metrics.k collate "C", windows.w collate "C";

set local plan_cache_mode = force_generic_plan;   -- what plpgsql settles on after repeated calls
explain execute probe('{8478402,8477934,8481617,8476454,8475786,8477953,8477450,8479365,8482703,8486161,8478472,8480029,8478854,8476473,8480803,8475218,8482166,8480834}',
  '{fantasy_score,ixg_per_60,shots_per_60,points_per_60_5v5}', '{l5,l10}', '2026-11-15');
set local plan_cache_mode = force_custom_plan;    -- the first calls
explain execute probe('{8478402,8477934,8481617,8476454,8475786,8477953,8477450,8479365,8482703,8486161,8478472,8480029,8478854,8476473,8480803,8475218,8482166,8480834}',
  '{fantasy_score,ixg_per_60,shots_per_60,points_per_60_5v5}', '{l5,l10}', '2026-11-15');
rollback;

-- Reading the result: an inner "Index Scan Backward using sustainability_trend_bands_pkey" with all four columns in
-- Index Cond is the robust path (no new index). "Index Scan using idx_stb_player_metric" with "Filter: (window_code = ...)"
-- is the statistics-sensitive path; then the narrow index or ANALYZE comes back to TJ as a separate decision.
