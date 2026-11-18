-- Run against a disposable database with the referenced schema and RPC.
begin;

insert into public.games (id, date, "seasonId", "startTime", type, "homeTeamId", "awayTeamId",
  game_state, game_schedule_state, game_state_observed_at)
values
  (2026020301, '2026-11-14', 20262027, '2026-11-14 20:00Z', 2, 10, 20, 'OFF', 'OK', '2026-11-15 02:00Z'),
  (2026020302, '2026-11-15', 20262027, '2026-11-15 20:00Z', 2, 10, 20, 'OFF', 'OK', '2026-11-16 02:00Z'),
  (2026020303, '2026-11-16', 20262027, '2026-11-16 20:00Z', 2, 10, 20, 'FUT', 'PPD', '2026-11-16 19:00Z'),
  (2026020304, '2026-11-17', 20262027, '2026-11-17 20:00Z', 2, 10, 20, 'OFF', 'OK', '2026-11-18 02:00Z');

insert into public.nhl_api_game_payloads_raw (id, game_id, endpoint, season_id,
  game_date, source_url, payload_hash, payload, fetched_at)
select id, id, 'boxscore', 20262027, date,
  'https://api-web.nhle.com/v1/gamecenter/' || id || '/boxscore', 'fixture-' || id,
  jsonb_build_object('id', id, 'gameDate', date, 'season', 20262027, 'gameType', 2,
    'gameState', 'OFF', 'gameScheduleState', 'OK', 'homeTeam', '{"id":10}'::jsonb,
    'awayTeam', '{"id":20}'::jsonb, 'playerByGameStats', '{
      "homeTeam":{"forwards":[{"playerId":1,"toi":"12:00"},{"playerId":20,"toi":"00:00"}],"defense":[]},
      "awayTeam":{"forwards":[],"defense":[{"playerId":2,"toi":"01:00"}]}}'::jsonb),
  game_state_observed_at
from public.games where id in (2026020302, 2026020304);

insert into public.nhl_api_game_payload_snapshot_heads (game_id, endpoint, snapshot_version,
  raw_payload_id, payload_hash, fetched_at)
select game_id, endpoint, 1, id, payload_hash, fetched_at from public.nhl_api_game_payloads_raw
where id in (2026020302, 2026020304) on conflict do nothing;

insert into public.wgo_skater_stats (id, player_id, player_name, date, games_played,
  season_id, game_id, toi_per_game_5v5)
values
  (1, 1, 'Fixture 1', '2026-11-14', 1, 20262027, 2026020301, 700),
  (3, 3, 'Fixture 3', '2026-11-14', 1, 20262027, 2026020301, 700),
  (11, 1, 'Fixture 1', '2026-11-15', 1, 20262027, 2026020302, 700),
  (12, 2, 'Fixture 2', '2026-11-15', 1, 20262027, 2026020302, 0),
  (21, 1, 'Fixture 1', '2026-11-17', 1, 20262027, 2026020304, 700),
  (22, 2, 'Fixture 2', '2026-11-17', 1, 20262027, 2026020304, 0);

insert into public.entity_metric_rankings (entity_type, entity_id, season_id, snapshot_date, window_type,
  window_semantics, strength_state, metric_key, peer_group_type, peer_group_key)
select 'skater', id, 20262027, '2026-11-14', 'season', 'season_to_date', '5v5',
  'points_per_60', 'all_skaters', 'all' from (values (1), (3)) as players(id);

insert into public.projection_pipeline_state (pipeline_key, scope_key, operation_key, revision, status,
  range_start_date, range_end_date, created_at, updated_at)
select 'rolling_forge_pipeline', 'daily_incremental:' || (date + 1), stage, 2, 'complete', date + 1, date + 1,
  ((date + 1) + started)::timestamptz, ((date + 1) + completed)::timestamptz
from (values ('2026-11-15'::date), ('2026-11-17'::date)) dates(date)
cross join (values
  ('upstream_skater_sources', '10:05'::time, '10:09'::time),
  ('rolling_player_recompute', '10:10'::time, '10:17'::time)
) stages(stage, started, completed);

insert into public.cron_job_audit (job_name, run_time, status, details)
select '/api/v1/db/update-games', date + '03:00'::time, 'success',
  '{"responseOutcome":{"rankingsCalendar":{"version":1,"status":"complete","seasonId":20262027,
    "days":{"2026-11-15":[2026020302],"2026-11-16":[2026020303],"2026-11-17":[2026020304]}}}}'
from (values ('2026-11-17'::date), ('2026-11-18'::date)) dates(date);

insert into public.cron_job_audit (job_name, run_time, status, details)
select 'update-nst-gamelog', (date + 1) + '10:07'::time, 'success',
  jsonb_build_object('nstProgress', jsonb_build_object(
    'scope', '{"version":2,"runMode":"incremental","dates":["' || date || '"],"queue":"test"}',
    'state', 'attempts_finished_coverage_unverified',
    'sourceDown', 'null'::jsonb, 'stoppedEarly', false, 'sourceOutcomes', '{"unresolvedCount":0}'::jsonb,
    'plannedRequestCount', 3, 'continuation', '{"nextIndex":3,"totalUrls":3,"blocked":false}'::jsonb))
from (values ('2026-11-15'::date), ('2026-11-17'::date)) dates(date)
union all
select 'update-all-wgo-skaters', (date + 1) + '10:08'::time, 'success',
  jsonb_build_object('context', jsonb_build_object('startDate', date, 'failedDatesCount', 0,
    'datesProcessed', jsonb_build_array(date)))
from (values ('2026-11-15'::date), ('2026-11-17'::date)) dates(date);

insert into public.nst_gamelog_5v5_counts (player_id, season, date_scraped, toi,
  goals, total_points, total_assists, first_assists, shots, icf, iff, ixg)
values (1, 20262027, '2026-11-15', 700, 0, 0, 0, 0, 1, 3, 2, .08),
       (1, 20262027, '2026-11-17', 700, 0, 0, 0, 0, 1, 3, 2, .08);
insert into public.nst_gamelog_5v5_counts_oi (player_id, season, date_scraped, toi, gf, ga, xgf, xga)
values (1, 20262027, '2026-11-15', 700, 0, 0, .08, .12),
       (1, 20262027, '2026-11-17', 700, 0, 0, .08, .12);

insert into public.rolling_player_game_metrics (player_id, game_date, game_id, season, strength_state, updated_at)
select player_id, date, game_id, season_id, '5v5', (date + 1) + '10:16'::time
from public.wgo_skater_stats where id in (1, 3, 11, 12, 21, 22);
insert into public.rolling_player_metric_support_payloads (player_id, game_date, game_id, season,
  strength_state, support_payload, updated_at)
select player_id, game_date, game_id, season, strength_state,
  '{"windowCountSupport":{"version":"rolling-player-window-counts-v1"}}',
  case when player_id = 3 then updated_at - '100 ms'::interval else updated_at end
from public.rolling_player_game_metrics where game_id in (2026020301, 2026020302, 2026020304);

do $$
declare receipt jsonb;
begin
  if has_function_privilege('anon', 'public.read_rankings_publication_readiness(integer,date,date)', 'execute')
      or has_function_privilege('authenticated', 'public.read_rankings_publication_readiness(integer,date,date)', 'execute')
      or not has_function_privilege('service_role', 'public.read_rankings_publication_readiness(integer,date,date)', 'execute') then
    raise exception 'unexpected readiness ACL';
  end if;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' <> 'ready'
      or jsonb_array_length(receipt->'expectedRollingSources') <> 3
      or receipt #>> '{expectedRollingSources,2,gameDate}' <> '2026-11-14'
      or (receipt->>'readyAt')::timestamptz <> '2026-11-18 10:17Z' then
    raise exception 'gap readiness failed: %', receipt;
  end if;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-16');
  if receipt->>'status' <> 'no_slate' then raise exception 'postponed slate admitted: %', receipt; end if;
  update public.games set date = '2026-11-19' where id = 2026020303;
  update public.cron_job_audit set details =
    jsonb_set(details, '{responseOutcome,rankingsCalendar,days,2026-11-16}', '[]'::jsonb)
    where job_name = '/api/v1/db/update-games';
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-16');
  if receipt->>'status' <> 'no_slate' then raise exception 'witnessed empty slate not recognized: %', receipt; end if;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' <> 'ready' then raise exception 'witnessed empty intermediate day blocked gap: %', receipt; end if;
  update public.games set date = '2026-11-16' where id = 2026020303;
  update public.cron_job_audit set details =
    jsonb_set(details, '{responseOutcome,rankingsCalendar,days,2026-11-16}', '[2026020303]'::jsonb)
    where job_name = '/api/v1/db/update-games';
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-18');
  if not (receipt->'details' ? 'cutoff_schedule_unverified') then
    raise exception 'unverified empty calendar treated as postponed: %', receipt;
  end if;
  update public.games set date = '2026-11-18' where id = 2026020304;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ?& array['calendar_slate_mismatch',
      'official_boxscore_without_scheduled_final', 'wgo_appearance_mismatch']) then
    raise exception 'missing calendar game masked despite boxscore/WGO evidence: %', receipt;
  end if;
  update public.games set date = '2026-11-17' where id = 2026020304;
  update public.games set game_state = 'LIVE', game_state_observed_at = '2026-11-18 01:45Z'
    where id = 2026020304;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' <> 'ready' then raise exception 'newer final official boxscore refused: %', receipt; end if;
  update public.games set game_schedule_state = 'PPD' where id = 2026020304;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'official_boxscore_without_scheduled_final') then
    raise exception 'postponed conflict admitted: %', receipt;
  end if;
  update public.games set game_state = 'OFF', game_schedule_state = 'OK' where id = 2026020304;

  insert into public.cron_job_audit (job_name, run_time, status, details)
  values ('/api/v1/db/update-games', '2026-11-18 09:00Z', 'success',
    '{"responseOutcome":{"rankingsCalendar":{"version":1,"status":"incomplete","seasonId":20262027}}}');
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'cutoff_schedule_unverified') then
    raise exception 'new incomplete calendar did not supersede old proof: %', receipt;
  end if;
  delete from public.cron_job_audit where run_time = '2026-11-18 09:00Z';

  update public.cron_job_audit set details = details #- '{responseOutcome,rankingsCalendar,days,2026-11-16}'
    where run_time = '2026-11-18 03:00Z';
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'calendar_slate_mismatch') then
    raise exception 'calendar omitted intermediate date: %', receipt;
  end if;
  update public.cron_job_audit set details =
    jsonb_set(details, '{responseOutcome,rankingsCalendar,days,2026-11-16}', '[2026020303]'::jsonb)
    where run_time = '2026-11-18 03:00Z';

  insert into public.cron_job_audit (job_name, run_time, status, details)
  values ('update-nst-gamelog', '2026-11-18 10:20Z', 'continued', '{"rankingsSourceDate":"2026-11-17"}');
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'later continued NST did not supersede success: %', receipt;
  end if;
  delete from public.cron_job_audit where run_time = '2026-11-18 10:20Z';
  insert into public.cron_job_audit (job_name, run_time, status, details)
  values ('/api/v1/db/update-wgo-skaters', '2026-11-18 10:21Z', 'failure',
      '{"url":"/api/v1/db/update-wgo-skaters?date=2026-11-17"}');
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'later manual WGO failure did not supersede success: %', receipt;
  end if;
  delete from public.cron_job_audit where run_time = '2026-11-18 10:21Z';

  update public.cron_job_audit set details = details #- '{nstProgress,sourceDown}'
    where run_time = '2026-11-16 10:07Z' and job_name = 'update-nst-gamelog';
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'NST audit with unproved source outcome admitted: %', receipt;
  end if;
  update public.cron_job_audit set details = jsonb_set(details, '{nstProgress,sourceDown}', '{"status":503}')
    where run_time = '2026-11-16 10:07Z' and job_name = 'update-nst-gamelog';
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'NST source failure object admitted: %', receipt;
  end if;
  update public.cron_job_audit set details = jsonb_set(details, '{nstProgress,sourceDown}', 'null'::jsonb)
    where run_time = '2026-11-16 10:07Z' and job_name = 'update-nst-gamelog';

  update public.rolling_player_metric_support_payloads set updated_at = updated_at + '100 ms'::interval
  where player_id = 1 and game_date = '2026-11-17' and strength_state = '5v5';
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'rolling_5v5_source_missing') then
    raise exception 'partial support refresh admitted: %', receipt;
  end if;

  -- One delayed rolling repair can replace an unproved daily receipt only
  -- when the renewed rolling/support pair shares the repair write revision.
  delete from public.projection_pipeline_state
    where scope_key = 'daily_incremental:2026-11-18' and operation_key = 'rolling_player_recompute';
  update public.rolling_player_game_metrics set updated_at = '2026-11-18 11:01Z'
    where game_date = '2026-11-17' and strength_state = '5v5';
  update public.rolling_player_metric_support_payloads set updated_at = '2026-11-18 11:01Z'
    where game_date = '2026-11-17' and strength_state = '5v5';
  insert into public.cron_job_audit (job_name, run_time, status, details)
  values ('/api/v1/db/update-rolling-player-averages', '2026-11-18 11:02Z', 'continued',
    '{"responseOutcome":{"success":true,"rankingSourceDate":"2026-11-17","rankingSourceSeason":20262027},
      "timing":{"startedAt":"2026-11-18T11:00:00.000Z"}}');
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'rolling_receipt_missing') then
    raise exception 'nonterminal repair admitted: %', receipt;
  end if;
  update public.cron_job_audit set status = 'success' where run_time = '2026-11-18 11:02Z';
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' <> 'ready' or (receipt->>'readyAt')::timestamptz <> '2026-11-18 11:02Z' then
    raise exception 'terminal repair not admitted: %', receipt;
  end if;

  update public.wgo_skater_stats set player_id = 4 where id = 21;
  delete from public.nst_gamelog_5v5_counts_oi where date_scraped = '2026-11-15' and player_id = 1;
  update public.cron_job_audit set status = 'failure'
  where run_time = '2026-11-16 10:07Z' and job_name = 'update-nst-gamelog';
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ?& array['wgo_appearance_mismatch', 'nst_5v5_input_missing', 'upstream_receipt_missing']) then
    raise exception 'incomplete gap admitted: %', receipt;
  end if;

  delete from public.nhl_api_game_payload_snapshot_heads where game_id = 2026020304 and endpoint = 'boxscore';
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'invalid_boxscore') then
    raise exception 'cutoff with no official evidence admitted: %', receipt;
  end if;
end;
$$;

rollback;
