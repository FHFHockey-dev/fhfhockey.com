-- Read-only acceptance readback for the first natural (scheduled) Rankings dispatch.
-- Replace 2026-MM-DD with the dispatch target date D. Every query pins season, scope and, for row
-- reads, metric_key: production has no (season, snapshot_date) index outside the new dispatch index.
-- Run one statement at a time with statement_timeout = 15s. Nothing here writes.

-- 1. The scheduled dispatch for D: status complete, stage readback, durable cutoff = D.
select target_date, mode, status, stage, reason, prior_cutoff,
  evidence->>'durableCutoff' as durable_cutoff, evidence->>'cohortCount' as cohort,
  evidence->>'rankingRows' as ranking_rows, evidence->>'compositeRows' as composite_rows,
  evidence->'windows' as windows, started_at, finished_at
from public.ranking_publication_dispatches
where season_id = 20262027 and target_date = date '2026-MM-DD' and mode = 'scheduled';

-- 2. Five markers at D: four Rankings windows and the season composite, all complete for the same N.
select surface, window_type, window_size, status, expected_entities, written_entities,
  expected_rows, db_written_rows, started_at, completed_at
from public.ranking_publications
where season_id = 20262027 and snapshot_date = date '2026-MM-DD' and strength_state = '5v5'
  and peer_group_type = 'all_skaters' and peer_group_key = 'all'
order by surface, window_size;

-- 3. Ordering: every Rankings window completed before the composite started.
select count(*) as windows,
  bool_and(r.completed_at <= c.started_at) as all_rankings_before_composite,
  max(r.completed_at) as last_window_completed, min(c.started_at) as composite_started
from public.ranking_publications r
join public.ranking_publications c
  on c.season_id = r.season_id and c.snapshot_date = r.snapshot_date and c.strength_state = r.strength_state
  and c.peer_group_type = r.peer_group_type and c.peer_group_key = r.peer_group_key
  and c.surface = 'skater_composite_ratings' and c.window_type = 'season' and c.window_size = 0
where r.season_id = 20262027 and r.snapshot_date = date '2026-MM-DD' and r.strength_state = '5v5'
  and r.peer_group_type = 'all_skaters' and r.peer_group_key = 'all' and r.surface = 'entity_metric_rankings'
  and (r.window_type, r.window_size) in (('season',0),('last_5',5),('last_10',10),('last_20',20));

-- 4. Same player set: one md5 per Rankings window (pinned metric), equal to the composite set.
select window_type, count(*) as players, md5(string_agg(entity_id::text, ',' order by entity_id)) as id_set
from public.entity_metric_rankings
where season_id = 20262027 and snapshot_date = date '2026-MM-DD' and entity_type = 'skater'
  and strength_state = '5v5' and peer_group_type = 'all_skaters' and peer_group_key = 'all'
  and metric_key = 'points_per_60'
group by window_type order by window_type;

select count(*) as players, md5(string_agg(player_id::text, ',' order by player_id)) as id_set
from public.skater_composite_ratings
where season_id = 20262027 and snapshot_date = date '2026-MM-DD' and window_type = 'season'
  and strength_state = '5v5' and peer_group_type = 'all_skaters' and peer_group_key = 'all_skaters';

-- 5. The database's own five-marker cutoff equals D.
select public.latest_ranking_publication_cutoff(20262027) as served_cutoff;
