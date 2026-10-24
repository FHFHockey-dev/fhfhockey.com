-- PROPOSAL ONLY. Not executed. Explicit read-only authorization is required.
-- Exactly three SELECT requests, sequentially. Stop on any error or limit sentinel.
-- Proposed historical season: 20252026. Metadata observation ceiling is fixed below.
-- No score, winner, fitted rating, provider call, capture, write or model execution.
begin read only;
set local statement_timeout = '10s';
set local lock_timeout = '1s';

-- Q1: seven named relation definitions. Missing relations remain visible.
with targets(name) as (values
  ('games'), ('teams'), ('seasons'), ('nhl_api_game_payloads_raw'),
  ('player_forecast_season_schedule_snapshots'),
  ('player_forecast_season_schedule_games'), ('player_forecast_schedule_revisions')
)
select t.name, c.oid is not null as present, c.relkind,
  (select jsonb_agg(jsonb_build_object('column', a.attname,
      'type', pg_catalog.format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull)
      order by a.attnum)
   from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
  (select jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid) order by i.indexrelid)
   from pg_catalog.pg_index i where i.indrelid=c.oid) as indexes,
  (select jsonb_agg(pg_catalog.pg_get_triggerdef(tr.oid) order by tr.tgname)
   from pg_catalog.pg_trigger tr where tr.tgrelid=c.oid and not tr.tgisinternal) as triggers
from targets t
left join pg_catalog.pg_namespace n on n.nspname='public'
left join pg_catalog.pg_class c on c.relnamespace=n.oid and c.relname=t.name
order by t.name;

-- Q2: all matching season snapshot headers only if at most 64; row 65 means STOP.
select s.id, s.season_id, s.source, s.observed_at, s.available_at,
       s.completeness, s.revision_hash, s.created_at,
       jsonb_array_length(s.source_manifest) as source_manifest_entries
from public.player_forecast_season_schedule_snapshots s
where s.season_id=20252026
  and s.observed_at < timestamptz '2026-10-23T00:00:00Z'
  and s.available_at < timestamptz '2026-10-23T00:00:00Z'
order by s.available_at, s.id
limit 65;

-- Q3: canonical season game metadata and earliest stored terminal boxscore identity.
-- Reading gameState discovers finality only; no outcomes are exported or scored.
-- Current games rows are identity candidates, not historical schedule revisions.
-- Row 2001 means STOP; never treat a truncated prefix as a complete cohort.
with scoped_games as materialized (
  select g.id, g.date, g."seasonId", g."startTime", g."homeTeamId", g."awayTeamId", g.type
  from public.games g
  where g."seasonId"=20252026 and g.type=2
  order by g.date, g.id
  limit 2001
)
select g.id as game_id, g.date, g."seasonId", g."startTime", g."homeTeamId", g."awayTeamId", g.type,
       r.id as first_stored_final_id, r.payload_hash, r.fetched_at, r.created_at,
       r.game_state, r.payload_game_id, r.payload_season
from scoped_games g
left join lateral (
  select raw.id, raw.payload_hash, raw.fetched_at, raw.created_at,
         raw.payload->>'gameState' as game_state,
         raw.payload->>'id' as payload_game_id,
         raw.payload->>'season' as payload_season
  from public.nhl_api_game_payloads_raw raw
  where raw.game_id=g.id and raw.season_id=g."seasonId" and raw.endpoint='boxscore'
    and raw.fetched_at < timestamptz '2026-10-23T00:00:00Z'
    and raw.payload->>'gameState' in ('FINAL','OFF')
  order by raw.fetched_at, raw.id
  limit 1
) r on true
order by g.date, g.id;

rollback;
