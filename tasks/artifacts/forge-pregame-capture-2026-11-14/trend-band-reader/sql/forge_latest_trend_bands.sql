-- CANDIDATE MIGRATION (not in supabase/migrations; unapplied; needs TJ approval to move and apply).
--
-- FORGE skater trend-band reader (web/lib/projections/queries/skater-queries.ts,
-- fetchLatestSkaterTrendAdjustments): the latest sustainability_trend_bands row on or
-- before p_as_of for each requested (player, metric, window). It replaces one GET
-- that asked for every snapshot of the team's players (limit=12000, silently capped
-- at PostgREST max_rows = 1,000) and sorted it by snapshot_date. That read touched
-- each player's whole history and timed out (57014, 8 s) on 2026-11-15.
--
-- One output row per distinct requested key (player x metric x window), ordered by
-- player_id, metric_key, window_code (byte order, collation-independent), so the reader can prove coverage without a
-- count. snapshot_date and the value columns are null when the key has no row on or
-- before p_as_of. A stale row is returned with its date and never treated as missing.
-- Each key is one indexed "order by snapshot_date desc limit 1" probe; the
-- primary key makes snapshot_date unique per (player, metric, window).
--
-- Refused instead of truncated: null or empty inputs, null elements, and more than
-- 1,000 keys (PostgREST would otherwise cut the result at max_rows without an error).
-- Read-only and STABLE, so the reader calls it by GET.

create or replace function public.forge_latest_trend_bands(
  p_player_ids integer[],
  p_metric_keys text[],
  p_window_codes text[],
  p_as_of date
)
returns table (
  player_id integer,
  metric_key text,
  window_code text,
  snapshot_date date,
  value numeric,
  ci_lower numeric,
  ci_upper numeric,
  n_eff numeric
)
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
#variable_conflict use_column
declare
  v_keys bigint;
begin
  if p_as_of is null then
    raise exception 'forge_latest_trend_bands: p_as_of is required' using errcode = '22004';
  end if;
  if coalesce(cardinality(p_player_ids), 0) = 0
     or coalesce(cardinality(p_metric_keys), 0) = 0
     or coalesce(cardinality(p_window_codes), 0) = 0 then
    raise exception 'forge_latest_trend_bands: player, metric and window lists must be non-empty' using errcode = '22023';
  end if;
  if array_position(p_player_ids, null) is not null
     or array_position(p_metric_keys, null) is not null
     or array_position(p_window_codes, null) is not null then
    raise exception 'forge_latest_trend_bands: list elements must not be null' using errcode = '22004';
  end if;
  select (select count(distinct ids.id) from unnest(p_player_ids) as ids(id))
       * (select count(distinct mk.k) from unnest(p_metric_keys) as mk(k))
       * (select count(distinct wc.w) from unnest(p_window_codes) as wc(w))
    into v_keys;
  if v_keys > 1000 then
    raise exception 'forge_latest_trend_bands: % keys requested; at most 1000', v_keys using errcode = '54000';
  end if;

  return query
  select requested.id, metrics.k, windows.w,
         latest.snapshot_date, latest.value, latest.ci_lower, latest.ci_upper, latest.n_eff
  from (select distinct ids.id from unnest(p_player_ids) as ids(id)) as requested
  cross join (select distinct mk.k from unnest(p_metric_keys) as mk(k)) as metrics
  cross join (select distinct wc.w from unnest(p_window_codes) as wc(w)) as windows
  left join lateral (
    select b.snapshot_date, b.value, b.ci_lower, b.ci_upper, b.n_eff
    from public.sustainability_trend_bands as b
    where b.player_id = requested.id
      and b.metric_key = metrics.k
      and b.window_code = windows.w
      and b.snapshot_date <= p_as_of
    order by b.snapshot_date desc
    limit 1
  ) as latest on true
  order by requested.id, metrics.k collate "C", windows.w collate "C";
end;
$$;

revoke all on function public.forge_latest_trend_bands(integer[], text[], text[], date)
  from public, anon, authenticated;
grant execute on function public.forge_latest_trend_bands(integer[], text[], text[], date)
  to service_role;

comment on function public.forge_latest_trend_bands(integer[], text[], text[], date) is
  'FORGE skater reader: latest sustainability_trend_bands row on or before p_as_of per requested (player, metric, window); null columns when none.';
