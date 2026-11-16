-- BLSH daily request/context read v1 (Chef decision 3, 2026-11-15; DESIGN.md §5 step 3).
-- FILE ONLY: drafted offline, never applied by the drafting lane. Its caller stays human-gated
-- until this function is independently reviewed, approved by TJ and applied.
--
-- One narrow SECURITY DEFINER read, executable only by service_role, that returns exactly the
-- rows the request reader (tasks/artifacts/blsh-request-reader-20261111, scope d84a9547) reads:
--   - key seal: wgo_skater_stats ids for season 20262027, dates [p_date_from, p_event_through], id order;
--   - per WGO row, the reader's 4-element group: [wgo row, linked NST individual rows,
--     linked NST on-ice rows, linked games rows], each linked list id-ordered with LIMIT 9
--     (the client refuses more than 8), columns exactly as COLUMNS.json c14231f0... lists them.
-- A STABLE function runs every query on the calling statement's snapshot, so the result is one
-- atomic snapshot, like the reader's REPEATABLE READ READ ONLY transaction. It writes nothing.
-- Bounds (the reader's): <= 10,000 WGO rows (refused at 10,001), <= 8 MiB of JSON, a date span
-- of at most 28 days inside the 2026-27 season. statement_timeout is the caller's (PostgREST).
begin;
set local lock_timeout = '5s';

create function public.blsh_request_context_v1(p_date_from date, p_event_through date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ids integer[];
  v_rows jsonb;
  v_out jsonb;
begin
  if p_date_from is null or p_event_through is null or p_date_from > p_event_through
     or p_date_from < date '2026-07-01' or p_event_through > date '2027-06-30'
     or p_event_through - p_date_from > 28 then
    raise exception 'BLSH_REQUEST_CONTEXT_SCOPE_INVALID';
  end if;
  select coalesce(pg_catalog.array_agg(k.id order by k.id), '{}') into v_ids from (
    select w.id from public.wgo_skater_stats as w
    where w.season_id = 20262027 and w.date between p_date_from and p_event_through
    order by w.id limit 10001) as k;
  if pg_catalog.cardinality(v_ids) > 10000 then raise exception 'BLSH_REQUEST_CONTEXT_ROW_BOUND'; end if;
  select coalesce(pg_catalog.jsonb_agg(s.row order by s.id), '[]'::jsonb) into v_rows from (
    select w.id, pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_array(w."id",w."player_id",w."game_id",w."season_id",w."date",w."player_name",w."team_abbrev",w."position_code",w."games_played",w."toi_per_game",w."es_toi_per_game",w."pp_toi_per_game",w."goals",w."assists",w."pp_points",w."shots",w."hits",w."blocked_shots",w."total_primary_assists",w."total_secondary_assists",w."penalties_drawn",w."penalties",w."total_fow",w."total_fol",w."sat_for",w."sat_against",w."es_goals_for",w."pp_goals_for",w."sh_goals_for",w."es_goals_against",w."pp_goals_against",w."sh_goals_against",w."points"),
      (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(n."id",n."player_id",n."season",n."date_scraped",n."gp",n."toi",n."ixg",n."goals",n."shots") order by n.id), '[]'::jsonb)
         from (select * from public.nst_gamelog_as_counts as x where x.player_id = w.player_id and x.date_scraped = w.date and x.season = 20262027 order by x.id limit 9) as n),
      (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(n."id",n."player_id",n."season",n."date_scraped",n."gp",n."toi",n."xgf",n."xga") order by n.id), '[]'::jsonb)
         from (select * from public.nst_gamelog_as_counts_oi as x where x.player_id = w.player_id and x.date_scraped = w.date and x.season = 20262027 order by x.id limit 9) as n),
      (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(g."id",g."seasonId",g."date",g."type") order by g.id), '[]'::jsonb)
         from (select * from public.games as x where x.id = w.game_id and x."seasonId" = 20262027 order by x.id limit 9) as g)
    ) as row
    from public.wgo_skater_stats as w
    where w.id = any (v_ids) and w.season_id = 20262027 and w.date between p_date_from and p_event_through) as s;
  v_out := pg_catalog.jsonb_build_object(
    'version', 'fhfh.blsh.request-context.v1',
    'seasonId', 20262027,
    'dateFrom', p_date_from,
    'eventThroughDate', p_event_through,
    'snapshotUTC', pg_catalog.transaction_timestamp(),
    'statementUTC', pg_catalog.statement_timestamp(),
    'columnsSHA256', 'c14231f0e62595eed0cb37175360cab33e4731e48a520f22f4bf494e0c127750',
    'keySeal', pg_catalog.jsonb_build_object('ids', pg_catalog.to_jsonb(v_ids), 'rows', pg_catalog.cardinality(v_ids)),
    'rows', v_rows);
  if pg_catalog.octet_length(v_out::text) > 8388608 then raise exception 'BLSH_REQUEST_CONTEXT_BYTE_BOUND'; end if;
  return v_out;
end $$;

revoke all on function public.blsh_request_context_v1(date, date) from public, anon, authenticated;
grant execute on function public.blsh_request_context_v1(date, date) to service_role;

commit;
