-- Standalone WGO receipt cases for read_rankings_publication_readiness after
-- 20261122145409. rankings_publication_readiness.sh prepends the setup section of
-- rankings_publication_readiness.sql (its open transaction and fixture rows) and
-- runs this file against both migrations applied in order.
--
-- Production shape of the standalone job-9 audit (2026-11-22T07:32:53Z):
--   job update-all-wgo-skaters, url /api/v1/db/update-wgo-skaters?action=all,
--   context {datesProcessed:["2026-11-21"], failedDatesCount:0, skippedDates:[...]}, rows 504.
-- context.sourceDigests is the new writer contract.

-- Nov 17 becomes a 504-row WGO date: its 2 played rows plus 502 non-playing rows
-- (games_played 0). Those stay outside the cohort checks but inside the digest.
insert into public.wgo_skater_stats (id, player_id, player_name, date, games_played,
  season_id, game_id, toi_per_game_5v5)
select 1000 + i, 1000 + i, 'Fixture row ' || i, '2026-11-17', 0, 20262027, 2026020304, 0
from generate_series(1, 502) i;

-- Replace the in-pipeline start-date receipts with standalone job-9 receipts at 07:32:53Z on D+1,
-- recording the digest the writer would record right after committing D.
delete from public.cron_job_audit where job_name = 'update-all-wgo-skaters';
insert into public.cron_job_audit (job_name, run_time, status, rows_affected, details)
select 'update-all-wgo-skaters', (d + 1) + '07:32:53'::time, 'success',
  (public.wgo_skater_date_digest(d)->>'rows')::integer,
  jsonb_build_object('url', '/api/v1/db/update-wgo-skaters?action=all', 'context', jsonb_build_object(
    'datesProcessed', jsonb_build_array(d), 'failedDates', '[]'::jsonb, 'failedDatesCount', 0,
    'skippedDates', skipped, 'sourceDigests', jsonb_build_object(d, public.wgo_skater_date_digest(d))))
from (values ('2026-11-15'::date, '["2026-11-16"]'::jsonb),
             ('2026-11-17'::date, '["2026-11-16", "2026-11-18"]'::jsonb)) runs(d, skipped);

create temporary table original_receipts on commit drop as
  select run_time, status, details from public.cron_job_audit where job_name = 'update-all-wgo-skaters';

do $$
declare
  receipt jsonb;
  nov17 constant timestamptz := '2026-11-18 07:32:53Z';
begin
  -- Standalone receipts with matching digests make the gap ready at the unchanged readyAt.
  if public.wgo_skater_date_digest('2026-11-17')->>'rows' <> '504' then
    raise exception 'fixture date does not hold 504 rows';
  end if;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' <> 'ready' or (receipt->>'readyAt')::timestamptz <> '2026-11-18 10:17Z'
      or jsonb_path_query_array(receipt, '$.evidence.stages[*].wgo_standalone') <> '[true, true]'::jsonb then
    raise exception 'standalone receipts not admitted: %', receipt;
  end if;

  -- Off-day: a witnessed postponed-only cutoff is no_slate, and the off-day inside the gap
  -- needed no WGO receipt (the ready gap above spans Nov 16).
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-16');
  if receipt->>'status' <> 'no_slate' then raise exception 'off-day cutoff not no_slate: %', receipt; end if;

  -- Today's real audit shape carries no row proof: a green audit alone defers.
  update public.cron_job_audit set details = details #- '{context,sourceDigests}' where run_time = nov17;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'audit without row proof admitted: %', receipt;
  end if;
  update public.cron_job_audit a set details = o.details from original_receipts o
    where a.job_name = 'update-all-wgo-skaters' and a.run_time = o.run_time;

  -- Required: a 504-row rewrite of Nov 17 commits 500 rows, then fails; all 504 keys remain.
  update public.wgo_skater_stats set player_name = player_name || ' (rewrite)'
    where id in (select id from public.wgo_skater_stats where date = '2026-11-17' order by id limit 500);
  if (select count(*) from public.wgo_skater_stats where date = '2026-11-17') <> 504 then
    raise exception 'rewrite fixture lost keys';
  end if;
  --   (a) the failed rewrite left its audit: D processed and failed.
  insert into public.cron_job_audit (job_name, run_time, status, rows_affected, details)
  values ('update-all-wgo-skaters', '2026-11-18 08:05Z', 'success', 500, jsonb_build_object(
    'url', '/api/v1/db/update-wgo-skaters?action=all', 'context', jsonb_build_object(
      'datesProcessed', '["2026-11-17"]'::jsonb, 'failedDates', '["2026-11-17"]'::jsonb,
      'failedDatesCount', 1, 'skippedDates', '[]'::jsonb)));
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' = 'ready' or not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'partial rewrite with a failure audit admitted: %', receipt;
  end if;
  --   (b) the process died before any audit: the earlier green receipt no longer matches the rows.
  delete from public.cron_job_audit where run_time = '2026-11-18 08:05Z';
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' = 'ready' or not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'unaudited partial rewrite admitted on an earlier green audit: %', receipt;
  end if;
  --   (c) a complete rerun that records its own digest before the stage completes is admitted.
  update public.wgo_skater_stats set player_name = player_name || ' (rewrite)'
    where date = '2026-11-17' and player_name not like '% (rewrite)';
  insert into public.cron_job_audit (job_name, run_time, status, rows_affected, details)
  values ('update-all-wgo-skaters', '2026-11-18 08:10Z', 'success', 504, jsonb_build_object(
    'url', '/api/v1/db/update-wgo-skaters?action=all', 'context', jsonb_build_object(
      'datesProcessed', '["2026-11-17"]'::jsonb, 'failedDates', '[]'::jsonb, 'failedDatesCount', 0,
      'skippedDates', '[]'::jsonb, 'sourceDigests',
      jsonb_build_object('2026-11-17', public.wgo_skater_date_digest('2026-11-17')))));
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' <> 'ready' then raise exception 'complete audited rerun refused: %', receipt; end if;
  delete from public.cron_job_audit where run_time = '2026-11-18 08:10Z';
  update public.wgo_skater_stats set player_name = replace(player_name, ' (rewrite)', '')
    where date = '2026-11-17';
  --   (d) rows restored to exactly what the 07:32 run recorded match its digest again.
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' <> 'ready' then raise exception 'restored rows refused: %', receipt; end if;

  -- Incomplete inputs defer.
  update public.cron_job_audit set details = jsonb_set(details, '{context,failedDatesCount}', '1')
    where run_time = nov17;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'receipt with failed dates admitted: %', receipt;
  end if;
  update public.cron_job_audit set details = jsonb_set(jsonb_set(details, '{context,failedDatesCount}', '0'),
      '{context,datesProcessed}', '[]') || jsonb_build_object('context', details->'context'
        || '{"datesProcessed":[],"skippedDates":["2026-11-16","2026-11-17","2026-11-18"]}'::jsonb)
    where run_time = nov17;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'run that skipped the played date admitted: %', receipt;
  end if;
  update public.cron_job_audit a set details = o.details, status = 'continued' from original_receipts o
    where a.run_time = nov17 and o.run_time = nov17;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'non-terminal receipt admitted: %', receipt;
  end if;
  update public.cron_job_audit set status = 'success', run_time = '2026-11-18 10:30Z' where run_time = nov17;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' = 'ready' or not (receipt->'details' ? 'rolling_receipt_missing') then
    raise exception 'receipt after the upstream stage completed admitted: %', receipt;
  end if;
  update public.cron_job_audit set run_time = nov17 where run_time = '2026-11-18 10:30Z';
  update public.cron_job_audit set details = details #- '{url}'
    || jsonb_build_object('url', '/api/v1/db/update-wgo-skaters?action=all&startDate=2026-11-10')
    where run_time = nov17;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ? 'upstream_receipt_missing') then
    raise exception 'ranged run without an explicit start receipt admitted: %', receipt;
  end if;
  update public.cron_job_audit a set details = o.details from original_receipts o
    where a.run_time = nov17 and o.run_time = nov17;

  delete from public.wgo_skater_stats where id = 22;
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if not (receipt->'details' ?& array['upstream_receipt_missing', 'wgo_appearance_mismatch']) then
    raise exception 'missing finalized-game row admitted: %', receipt;
  end if;
  insert into public.wgo_skater_stats (id, player_id, player_name, date, games_played,
    season_id, game_id, toi_per_game_5v5)
  values (22, 2, 'Fixture 2', '2026-11-17', 1, 20262027, 2026020304, 0);

  -- Rollout compatibility: current FORGE still calls WGO in-pipeline with startDate=D after job 9.
  -- The newer start-date receipt decides and keeps working.
  insert into public.cron_job_audit (job_name, run_time, status, details)
  values ('update-all-wgo-skaters', '2026-11-18 10:08Z', 'success',
    '{"context":{"startDate":"2026-11-17","failedDatesCount":0,"datesProcessed":["2026-11-17"]}}');
  receipt := public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17');
  if receipt->>'status' <> 'ready'
      or jsonb_path_query_array(receipt, '$.evidence.stages[*].wgo_standalone') <> '[true, false]'::jsonb then
    raise exception 'in-pipeline receipt after job 9 refused: %', receipt;
  end if;
end;
$$;

rollback;
