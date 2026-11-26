-- READ-ONLY verification of the first natural FORGE H1–H10 nightly run (run key nightly:2026-11-24, ticks from
-- Tue 2026-11-24 09:00Z). One read-only transaction, 30 s per statement, rolled back; it writes no row anywhere and
-- calls no function that writes. Run it with psql (it uses \o, \gset and \if), ideally within 6 hours of the run:
-- pg_net keeps HTTP responses ~6 h by default, and they are the only place the route's per-reason gap tallies live.
--
--   psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f first-night-verify.sql                     # run date 2026-11-24
--   psql "$DB_URL" -X -v ON_ERROR_STOP=1 -v run_date=2026-11-23 -f first-night-verify.sql
--
-- Output: one file per query in ./first-night-verify-<run_date>/ (created by this script on the client):
--   00-parameters.txt   run date, nominal 04:00 ET cutoff, window, server time and version
--   01-dispatches.txt   dispatch summary (first/last begin and finish, elapsed, counts by state and outcome)
--   02-dispatch-list.txt every dispatch of the run, with the pg_net HTTP result while it is retained
--   03-ticks.txt        pg_cron tick results for the nightly job (if cron.job_run_details is readable)
--   04-freeze.txt       the night's freeze record and completion marker
--   05-reconcile.txt    expected vs stored by key, per class and horizon H1–H10 (with class totals)
--   06-route-gaps.txt   gap tallies the route reported (pg_net responses and the completion marker)
--   07-missing.csv, 08-extra.csv, 09-duplicate.csv   key lists, at most 2,000 rows each; every row carries the total
--   10-lineage.txt, 11-lineage-values.txt, 12-uncertainty.txt   lineage gaps per kind and the values behind them
--   13-load.txt         load snapshot (pg_stat_statements if installed; cumulative since its reset, not per run)
--
-- Definitions (by key, never by count):
--   expected  = the frozen denominator keys of the night's freeze record (scope forge-h10-nightly:<run_date>, latest
--               ordinal), keyed (class, player, game, team, horizon).
--   stored    = a published vintage (receipt present, receipt hash = output hash) inserted from the freeze until the
--               next night's 04:00 ET cutoff that names this denominator (source forge-h10-denominator:<sha>), keyed
--               the same way from its own payload. Stored is read independently of expected.
--   missing   = expected key with no stored vintage. extra = published vintage in the window whose key is not
--               expected: it names another denominator, its (player, game) is not frozen, or its team/horizon differs.
--   duplicate = more than one published vintage naming this denominator for one (class, player, game). Editions
--               from earlier nights are outside the window and never count.
--   numeric_complete = stored key whose every category mean is available and numeric.
--   reported_gap     = stored key with a category declared unavailable (a gap the vintage itself reports).
--   Keys the route skipped (schedule fields missing, lock closed, training below support) are never stored per
--   key: they appear here as missing, and their reasons only as tallies in 06 while pg_net retains responses.
\set ON_ERROR_STOP on
\if :{?run_date}
\else
  \set run_date 2026-11-24
\endif
\set out_dir 'first-night-verify-' :run_date
\setenv FORGE_H10_VERIFY_OUT :out_dir
\! mkdir -p "$FORGE_H10_VERIFY_OUT"
\pset pager off
\pset null '(null)'

begin read only;
set local statement_timeout = '30s';
set local lock_timeout = '2s';

-- Fixed points of the run, captured once (\gset) so later queries take literals and prune monthly partitions.
select :'run_date'::date as run_day,
  ((:'run_date'::date + time '04:00') at time zone 'America/New_York') as cutoff_at,
  ((:'run_date'::date + 1 + time '04:00') at time zone 'America/New_York') as window_end,
  'nightly:' || :'run_date' as run_key,
  'forge-h10-nightly:' || :'run_date' as freeze_scope,
  'forge-h10-nightly-complete:' || :'run_date' as complete_scope,
  to_regclass('net._http_response') is not null as has_net,
  to_regclass('cron.job_run_details') is not null and has_table_privilege('cron.job_run_details', 'select') as has_cron,
  coalesce((select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_stat_statements'), '') as pgss_schema
\gset
select :'pgss_schema' <> '' as has_pgss \gset

\set f :out_dir '/00-parameters.txt'
\o :f
select :'run_date' as run_date, :'run_key' as run_key, :'cutoff_at'::timestamptz as nominal_cutoff, :'window_end'::timestamptz as window_end,
  now() as read_at, current_user as read_as, current_setting('server_version') as server_version,
  :'has_net'::boolean as pg_net_responses_readable, :'has_cron'::boolean as cron_history_readable, :'has_pgss'::boolean as pg_stat_statements_installed;

-- 1. Dispatches of the run (independent of the freeze, so a guard refusal still reports here).
\set f :out_dir '/01-dispatches.txt'
\o :f
with d as (select * from forge_v2_private.forge_h10_dispatches where run_key = :'run_key'),
done as (select min(ended_at) as at from d where outcome = 'complete')
select count(*) as dispatches,
  min(queued_at) as first_queued, min(started_at) as first_begin, max(started_at) as last_begin,
  min(ended_at) as first_finish, max(ended_at) as last_finish,
  (select at from done) as first_complete_finish,
  min(started_at) - :'cutoff_at'::timestamptz as cutoff_to_first_begin,
  (select at from done) - min(started_at) as first_begin_to_complete,
  max(ended_at) - min(started_at) as first_begin_to_last_finish,
  count(*) filter (where state in ('queued', 'started')) as in_flight_now
from d;
select state, coalesce(outcome, '(open)') as outcome, count(*) as dispatches,
  min(ended_at - started_at) as shortest, max(ended_at - started_at) as longest, sum(ended_at - started_at) as total_busy
from forge_v2_private.forge_h10_dispatches where run_key = :'run_key' group by 1, 2 order by 1, 2;

\set f :out_dir '/02-dispatch-list.txt'
\o :f
\if :has_net
select d.queued_at, d.started_at, d.ended_at, d.ended_at - d.started_at as busy, d.state, d.outcome, d.request_id,
  h.status_code as http_status, h.timed_out, left(h.error_msg, 120) as http_error,
  substring(h.content from '"status":"([a-z_]+)"') as body_status, substring(h.content from '"reason":"([^"]{1,80})"') as body_reason,
  (h.id is null and d.request_id is not null) as response_expired_or_pending
from forge_v2_private.forge_h10_dispatches d left join net._http_response h on h.id = d.request_id
where d.run_key = :'run_key' order by d.queued_at limit 200;
\else
select d.queued_at, d.started_at, d.ended_at, d.ended_at - d.started_at as busy, d.state, d.outcome, d.request_id, 'pg_net responses not readable' as http
from forge_v2_private.forge_h10_dispatches d where d.run_key = :'run_key' order by d.queued_at limit 200;
\endif

\set f :out_dir '/03-ticks.txt'
\o :f
\if :has_cron
select coalesce(r.return_message, '(none)') as tick_result, r.status, count(*) as ticks, min(r.start_time) as first_tick, max(r.start_time) as last_tick,
  max(r.end_time - r.start_time) as slowest_tick
from cron.job_run_details r join cron.job j on j.jobid = r.jobid
where j.jobname = 'forge-h10-shadow-nightly' and r.start_time >= :'cutoff_at'::timestamptz - interval '1 hour' and r.start_time < :'window_end'::timestamptz
group by 1, 2 order by 4;
\else
select 'cron.job_run_details not readable by ' || current_user as ticks;
\endif

-- 2. The freeze record (latest ordinal in the night's scope, as the route reads it) and the completion marker.
select count(*) as freeze_records, count(*) > 0 as freeze_found,
  (array_agg(id order by ordinal desc))[1] as freeze_id,
  (array_agg(recorded_at order by ordinal desc))[1] as freeze_recorded_at,
  (array_agg(payload::jsonb->'denominator'->>'denominatorSha256' order by ordinal desc))[1] as freeze_sha,
  (array_agg(payload::jsonb->'denominator'->>'asOf' order by ordinal desc))[1] as freeze_asof
from forge_v2_private.forge_v2_records
where kind = 'affiliation' and scope_key = :'freeze_scope' and recorded_at >= :'cutoff_at'::timestamptz - interval '1 day' and recorded_at < :'window_end'::timestamptz
\gset
-- \gset leaves NULL columns unset, so nothing below reads the freeze variables unless the freeze was found.
\if :freeze_found
select 'forge-h10-denominator:' || :'freeze_sha' as denominator_source \gset
\endif

\set f :out_dir '/04-freeze.txt'
\o :f
\if :freeze_found
select :'freeze_records'::int as freeze_records_in_scope, :'freeze_id' as freeze_id, :'freeze_recorded_at'::timestamptz as freeze_recorded_at,
  :'freeze_asof'::timestamptz as denominator_asof, :'freeze_asof'::timestamptz - :'cutoff_at'::timestamptz as asof_after_nominal_cutoff, :'freeze_sha' as denominator_sha256,
  (r.payload::jsonb->'denominator'->'counts'->>'players')::int as players, (r.payload::jsonb->'denominator'->'counts'->>'keys')::int as keys,
  r.payload::jsonb->'denominator'->'counts'->'byClass' as by_class,
  (r.payload::jsonb->'denominator'->'counts'->>'unresolved')::int as unresolved, (r.payload::jsonb->'denominator'->'counts'->>'conflicts')::int as conflicts,
  (r.payload::jsonb->'denominator'->'counts'->>'shortfallPlayers')::int as shortfall_players,
  jsonb_array_length(r.payload::jsonb->'schedule') as frozen_games, r.payload::jsonb->'dropped' as dropped_log_lines, r.payload::jsonb->'limitations' as limitations
from forge_v2_private.forge_v2_records r where r.id = :'freeze_id' and r.recorded_at = :'freeze_recorded_at'::timestamptz;
\else
select 'no freeze record in scope ' || :'freeze_scope' || ' (no run yet, or every dispatch was refused before the freeze: see 01/02)' as freeze;
\endif
select count(*) as completion_markers, min(recorded_at) as completed_at,
  min(recorded_at) - (select min(started_at) from forge_v2_private.forge_h10_dispatches where run_key = :'run_key') as first_begin_to_completion_marker,
  (array_agg(payload::jsonb order by ordinal))[1] - 'asOf' as completion_payload
from forge_v2_private.forge_v2_records
where kind = 'affiliation' and scope_key = :'complete_scope' and recorded_at >= :'cutoff_at'::timestamptz - interval '1 day' and recorded_at < :'window_end'::timestamptz;

\if :freeze_found
-- 3. Reconcile stored against frozen expected keys, by key.
\set f :out_dir '/05-reconcile.txt'
\o :f
with expected as (
  select distinct e->>'playerClass' as cls, (e->>'playerId')::bigint as player_id, (e->>'gameId')::bigint as game_id, (e->>'teamId')::bigint as team_id, (e->>'horizon')::int as horizon
  from forge_v2_private.forge_v2_records r, jsonb_array_elements(r.payload::jsonb->'denominator'->'keys') e
  where r.id = :'freeze_id' and r.recorded_at = :'freeze_recorded_at'::timestamptz),
written as (
  select 'skater' as cls, v.id, v.player_id, v.game_id, v.issuance_sequence, v.payload::jsonb as p, (r.output_hash = v.output_hash) as published
  from forge_v2_private.forge_v2_vintages v left join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id and r.inserted_at >= :'freeze_recorded_at'::timestamptz
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz
  union all
  select 'goalie', v.id, v.player_id, v.game_id, v.issuance_sequence, v.payload::jsonb, (r.output_hash = v.output_hash)
  from forge_v2_private.forge_v2_goalie_vintages v left join forge_v2_private.forge_v2_goalie_publication_receipts r on r.vintage_id = v.id and r.inserted_at >= :'freeze_recorded_at'::timestamptz
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz),
w as (
  select cls, id, player_id, game_id, (p->>'teamId')::bigint as team_id, (p->>'horizon')::int as horizon, coalesce(published, false) as published,
    p->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source')) as tonight,
    (p->'means' ?& case when cls = 'goalie' then array['SAVES','SHOTS_AGAINST','GOALS_ALLOWED','WIN','SHUTOUT'] else array['G','A','PPP','SOG','HIT','BLK','PIM'] end)
      and not exists (select from jsonb_each(p->'means') m where m.value->>'state' is distinct from 'available' or jsonb_typeof(m.value->'value') is distinct from 'number') as numeric_complete
  from written),
stored as (
  select cls, player_id, game_id, team_id, horizon, bool_and(numeric_complete) as numeric_complete
  from w where published and tonight group by 1, 2, 3, 4, 5),
dup as (select cls, player_id, game_id from w where published and tonight group by 1, 2, 3 having count(*) > 1),
per as (
  select e.cls, e.horizon, 1 as expected, (s.cls is not null)::int as stored, (s.cls is null)::int as missing, 0 as extra,
    coalesce(s.numeric_complete, false)::int as numeric_complete, (s.cls is not null and not s.numeric_complete)::int as reported_gap,
    (d.cls is not null)::int as duplicate_keys, 0 as unpublished
  from expected e left join stored s using (cls, player_id, game_id, team_id, horizon) left join dup d using (cls, player_id, game_id)
  union all
  select w.cls, w.horizon, 0, 0, 0, 1, 0, 0, 0, 0 from w
  where w.published and not exists (select from expected e where e.cls = w.cls and e.player_id = w.player_id and e.game_id = w.game_id and e.team_id = w.team_id and e.horizon = w.horizon and w.tonight)
  union all
  select w.cls, w.horizon, 0, 0, 0, 0, 0, 0, 0, 1 from w where not w.published and w.tonight)
select cls as class, coalesce(horizon::text, 'all') as horizon, sum(expected) as expected, sum(stored) as stored, sum(missing) as missing, sum(extra) as extra,
  sum(duplicate_keys) as duplicate_keys, sum(numeric_complete) as numeric_complete, sum(reported_gap) as reported_gap, sum(unpublished) as unpublished_vintages
from per group by grouping sets ((cls, horizon), (cls)) order by 1 desc, grouping(per.horizon), per.horizon;

-- Full key lists (bounded). Each row carries the list's total so a cut list is visible.
\pset format csv
\set f :out_dir '/07-missing.csv'
\o :f
with expected as (
  select distinct e->>'playerClass' as cls, (e->>'playerId')::bigint as player_id, (e->>'gameId')::bigint as game_id, (e->>'teamId')::bigint as team_id, (e->>'horizon')::int as horizon,
    e->>'scheduledStartAt' as scheduled_start_at
  from forge_v2_private.forge_v2_records r, jsonb_array_elements(r.payload::jsonb->'denominator'->'keys') e
  where r.id = :'freeze_id' and r.recorded_at = :'freeze_recorded_at'::timestamptz),
stored as (
  select 'skater' as cls, v.player_id, v.game_id, (v.payload::jsonb->>'teamId')::bigint as team_id, (v.payload::jsonb->>'horizon')::int as horizon
  from forge_v2_private.forge_v2_vintages v join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash and r.inserted_at >= :'freeze_recorded_at'::timestamptz
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz and v.payload::jsonb->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source'))
  union all
  select 'goalie', v.player_id, v.game_id, (v.payload::jsonb->>'teamId')::bigint, (v.payload::jsonb->>'horizon')::int
  from forge_v2_private.forge_v2_goalie_vintages v join forge_v2_private.forge_v2_goalie_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash and r.inserted_at >= :'freeze_recorded_at'::timestamptz
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz and v.payload::jsonb->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source')))
select e.cls as class, e.horizon, e.player_id, e.game_id, e.team_id, e.scheduled_start_at,
  exists (select from stored s where s.cls = e.cls and s.player_id = e.player_id and s.game_id = e.game_id) as stored_with_other_team_or_horizon,
  count(*) over () as total_missing
from expected e where not exists (select from stored s where s.cls = e.cls and s.player_id = e.player_id and s.game_id = e.game_id and s.team_id = e.team_id and s.horizon = e.horizon)
order by e.cls desc, e.horizon, e.team_id, e.player_id, e.game_id limit 2000;

\set f :out_dir '/08-extra.csv'
\o :f
with expected as (
  select distinct e->>'playerClass' as cls, (e->>'playerId')::bigint as player_id, (e->>'gameId')::bigint as game_id, (e->>'teamId')::bigint as team_id, (e->>'horizon')::int as horizon
  from forge_v2_private.forge_v2_records r, jsonb_array_elements(r.payload::jsonb->'denominator'->'keys') e
  where r.id = :'freeze_id' and r.recorded_at = :'freeze_recorded_at'::timestamptz),
w as (
  select 'skater' as cls, v.id, v.player_id, v.game_id, v.inserted_at, v.payload::jsonb as p
  from forge_v2_private.forge_v2_vintages v join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash and r.inserted_at >= :'freeze_recorded_at'::timestamptz
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz
  union all
  select 'goalie', v.id, v.player_id, v.game_id, v.inserted_at, v.payload::jsonb
  from forge_v2_private.forge_v2_goalie_vintages v join forge_v2_private.forge_v2_goalie_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash and r.inserted_at >= :'freeze_recorded_at'::timestamptz
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz),
x as (
  select w.cls, (w.p->>'horizon')::int as horizon, w.player_id, w.game_id, (w.p->>'teamId')::bigint as team_id, w.id as vintage_id, w.inserted_at, w.p->>'issuanceKey' as issuance_key,
    case when not (w.p->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source'))) then 'names_another_denominator'
      when not exists (select from expected e where e.cls = w.cls and e.player_id = w.player_id and e.game_id = w.game_id) then 'player_game_not_frozen'
      else 'team_or_horizon_differs' end as reason
  from w where not (w.p->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source'))
    and exists (select from expected e where e.cls = w.cls and e.player_id = w.player_id and e.game_id = w.game_id and e.team_id = (w.p->>'teamId')::bigint and e.horizon = (w.p->>'horizon')::int)))
select x.*, count(*) over () as total_extra from x order by cls desc, reason, horizon, team_id, player_id, game_id, vintage_id limit 2000;

\set f :out_dir '/09-duplicate.csv'
\o :f
with w as (
  select 'skater' as cls, v.id, v.player_id, v.game_id, v.issuance_sequence, v.inserted_at
  from forge_v2_private.forge_v2_vintages v join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash and r.inserted_at >= :'freeze_recorded_at'::timestamptz
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz and v.payload::jsonb->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source'))
  union all
  select 'goalie', v.id, v.player_id, v.game_id, v.issuance_sequence, v.inserted_at
  from forge_v2_private.forge_v2_goalie_vintages v join forge_v2_private.forge_v2_goalie_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash and r.inserted_at >= :'freeze_recorded_at'::timestamptz
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz and v.payload::jsonb->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source'))),
d as (select cls, player_id, game_id, count(*) as editions, array_agg(id order by issuance_sequence) as vintage_ids, array_agg(inserted_at order by issuance_sequence) as inserted_at
  from w group by 1, 2, 3 having count(*) > 1)
select d.*, count(*) over () as total_duplicate_keys from d order by cls desc, player_id, game_id limit 2000;
\pset format aligned

-- 4. Lineage per kind, over every vintage naming this denominator (published or not), by value, not key presence.
\set f :out_dir '/10-lineage.txt'
\o :f
with expected as (
  select distinct e->>'playerClass' as cls, (e->>'playerId')::bigint as player_id, (e->>'gameId')::bigint as game_id, (e->>'teamId')::bigint as team_id
  from forge_v2_private.forge_v2_records r, jsonb_array_elements(r.payload::jsonb->'denominator'->'keys') e
  where r.id = :'freeze_id' and r.recorded_at = :'freeze_recorded_at'::timestamptz),
w as (
  select 'skater' as cls, v.player_id, v.game_id, v.payload::jsonb as p, r.vintage_id is not null and r.output_hash = v.output_hash as published
  from forge_v2_private.forge_v2_vintages v left join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id and r.inserted_at >= :'freeze_recorded_at'::timestamptz
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz and v.payload::jsonb->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source'))
  union all
  select 'goalie', v.player_id, v.game_id, v.payload::jsonb, r.vintage_id is not null and r.output_hash = v.output_hash
  from forge_v2_private.forge_v2_goalie_vintages v left join forge_v2_private.forge_v2_goalie_publication_receipts r on r.vintage_id = v.id and r.inserted_at >= :'freeze_recorded_at'::timestamptz
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz and v.payload::jsonb->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source'))),
c as (
  select w.cls, w.published,
    coalesce(w.p->>'targetVersion', '') <> case when w.cls = 'goalie' then 'nhl-official-goalie-start-v1' else 'nhl-official-skater-appearance-v1' end as bad_target,
    coalesce(w.p->>'conditioning', '') <> case when w.cls = 'goalie' then 'official_start_given_game_occurs' else 'official_appearance_given_game_occurs' end as bad_conditioning,
    coalesce(btrim(w.p->>'modelVersion'), '') = '' or coalesce(btrim(w.p->>'featureVersion'), '') = '' or coalesce(btrim(w.p->>'codeVersion'), '') = '' as no_model_lineage,
    coalesce(w.p->>'inputCutoffAt', '') !~ '^\d{4}-\d{2}-\d{2}T' as no_cutoff,
    case when coalesce(w.p->>'inputCutoffAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (w.p->>'inputCutoffAt')::timestamptz <> :'freeze_asof'::timestamptz end as cutoff_not_freeze,
    jsonb_typeof(w.p->'teamId') is distinct from 'number' as no_team,
    jsonb_typeof(w.p->'teamId') = 'number' and not exists (select from expected e where e.cls = w.cls and e.player_id = w.player_id and e.game_id = w.game_id and e.team_id = (w.p->>'teamId')::bigint) as team_not_frozen,
    -- Uncertainty components: skaters carry distribution and participation.probability, goalies startProbability.
    (case when w.cls = 'goalie' then array[w.p->'startProbability'] else array[w.p->'distribution', w.p->'participation'->'probability'] end) as u
  from w)
select cls as kind, count(*) as rows, count(*) filter (where not published) as unpublished,
  count(*) filter (where bad_target) as lacking_target_version, count(*) filter (where bad_conditioning) as lacking_conditioning,
  count(*) filter (where no_model_lineage) as lacking_model_lineage, count(*) filter (where no_cutoff) as lacking_cutoff,
  count(*) filter (where cutoff_not_freeze) as cutoff_differs_from_freeze, count(*) filter (where no_team) as lacking_as_issued_team,
  count(*) filter (where team_not_frozen) as as_issued_team_not_frozen,
  count(*) filter (where exists (select from unnest(u) x where x is null or jsonb_typeof(x) <> 'object' or x->>'state' not in ('available', 'unavailable')
    or x->>'state' = 'unavailable' and coalesce(btrim(x->>'reason'), '') = '')) as lacking_uncertainty_undeclared,
  count(*) filter (where not exists (select from unnest(u) x where x->>'state' = 'available')) as no_uncertainty_available
from c group by 1 order by 1 desc;

\set f :out_dir '/11-lineage-values.txt'
\o :f
with w as (
  select 'skater' as cls, v.payload::jsonb as p from forge_v2_private.forge_v2_vintages v
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz and v.payload::jsonb->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source'))
  union all
  select 'goalie', v.payload::jsonb from forge_v2_private.forge_v2_goalie_vintages v
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz and v.payload::jsonb->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source')))
select cls as kind, p->>'codeVersion' as code_version, p->>'modelVersion' as model_version, p->>'featureVersion' as feature_version, p->>'evidenceClass' as evidence_class,
  p->>'trigger' as trigger, count(*) as rows
from w group by 1, 2, 3, 4, 5, 6 order by 1 desc, 7 desc limit 50;

\set f :out_dir '/12-uncertainty.txt'
\o :f
with w as (
  select 'skater' as cls, v.payload::jsonb as p from forge_v2_private.forge_v2_vintages v
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz and v.payload::jsonb->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source'))
  union all
  select 'goalie', v.payload::jsonb from forge_v2_private.forge_v2_goalie_vintages v
  where v.inserted_at >= :'freeze_recorded_at'::timestamptz and v.inserted_at < :'window_end'::timestamptz and v.payload::jsonb->'sourceManifest' @> jsonb_build_array(jsonb_build_object('id', :'denominator_source'))),
comp as (
  select cls, 'distribution' as component, p->'distribution' as x from w where cls = 'skater'
  union all select cls, 'participation.probability', p->'participation'->'probability' from w where cls = 'skater'
  union all select cls, 'calibration', p->'calibration' from w where cls = 'skater'
  union all select cls, 'startProbability', p->'startProbability' from w where cls = 'goalie'
  union all select cls, 'means:' || m.key, m.value from w, jsonb_each(w.p->'means') m)
select cls as kind, component, coalesce(x->>'state', case when x is null or x = 'null'::jsonb then '(null)' else '(not a component)' end) as state,
  left(x->>'reason', 80) as reason, count(*) as rows
from comp group by 1, 2, 3, 4 order by 1 desc, 2, 5 desc limit 200;
\endif

-- 5. Gap tallies the route reported. Per-key and per-horizon gap reasons are not persisted anywhere; the response
-- bodies (pg_net, ~6 h) and the completion marker (goalie totals) are the only records.
\set f :out_dir '/06-route-gaps.txt'
\o :f
\if :has_net
select d.started_at, d.outcome, h.status_code,
  substring(h.content from '"scopes":([0-9]+)')::int as skater_scopes, substring(h.content from '"goalieKeys":([0-9]+)')::int as goalie_keys,
  substring(h.content from '"gaps":(\{[^{}]*\})') as skater_gaps_by_reason, substring(h.content from '"jobs":(\{[^{}]*\})') as skater_jobs,
  substring(h.content from '"goalies":\{[^{}]*?"published":([0-9]+)[,}]')::int as goalie_published, substring(h.content from '"goalies":\{[^{}]*?"reused":([0-9]+)[,}]')::int as goalie_reused,
  substring(h.content from '"nonNumeric":([0-9]+)')::int as goalie_non_numeric, substring(h.content from '"goalies":\{[^{}]*?"gaps":([0-9]+)[,}]')::int as goalie_gaps_cached_total,
  (select jsonb_object_agg(reason, n) from (select g[1] as reason, count(*) as n from regexp_matches(h.content, '"gameId":[0-9]+,"reason":"([a-z_]+)"', 'g') g group by 1) t) as goalie_gaps_by_reason,
  h.id is null as response_not_retained
from forge_v2_private.forge_h10_dispatches d left join net._http_response h on h.id = d.request_id
where d.run_key = :'run_key' and d.started_at is not null order by d.started_at limit 200;
\else
select 'pg_net responses not readable: route gap tallies unavailable; see the completion marker in 04' as route_gaps;
\endif

-- 6. Load snapshot. Statement statistics are cumulative since their last reset, not per run; the dispatch busy times
-- in 01/02 are the per-run measure.
\set f :out_dir '/13-load.txt'
\o :f
select now() as read_at, (select count(*) from pg_stat_activity where state = 'active') as active_sessions,
  (select count(*) from pg_stat_activity) as sessions, current_setting('max_connections')::int as max_connections,
  s.xact_commit, s.xact_rollback, s.blks_read, s.blks_hit, s.temp_files, pg_size_pretty(s.temp_bytes) as temp_bytes, s.deadlocks, s.stats_reset
from pg_stat_database s where s.datname = current_database();
select relname, n_live_tup, n_tup_ins, seq_scan, idx_scan, pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_stat_user_tables where schemaname = 'forge_v2_private' and (n_live_tup > 0 or n_tup_ins > 0) order by pg_total_relation_size(relid) desc limit 40;
\if :has_pgss
\set pgss :pgss_schema '.pg_stat_statements'
select (select stats_reset from :pgss_schema.pg_stat_statements_info) as statements_reset_at,
  count(*) as forge_statements, sum(calls) as calls, round(sum(total_exec_time)::numeric / 1000, 1) as total_exec_s,
  sum(shared_blks_read) as shared_blks_read, sum(temp_blks_written) as temp_blks_written
from :pgss where query ilike '%forge_v2%' or query ilike '%forge_h10%';
select calls, round(total_exec_time::numeric / 1000, 2) as total_exec_s, round(mean_exec_time::numeric, 2) as mean_ms, round(max_exec_time::numeric, 1) as max_ms,
  rows, shared_blks_read, temp_blks_written, left(regexp_replace(query, '\s+', ' ', 'g'), 160) as query
from :pgss where query ilike '%forge_v2%' or query ilike '%forge_h10%' order by total_exec_time desc limit 15;
\else
select 'pg_stat_statements is not installed: per-statement load cannot be measured; use the dispatch busy times in 01/02' as load;
\endif
\o
rollback;
\echo FORGE H10 first-night verification written to :out_dir
