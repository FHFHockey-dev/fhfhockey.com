# Recovery-plan read-only query log (Nov 21; all via pgpool.sh with default_transaction_read_only=on)
### Q1 non-scope pipeline state / durable cursors (17:40:06Z)
```sql
select pipeline_key, scope_key, operation_key, status, cursor_game_id, cursor_date, range_start_date, range_end_date, last_error, updated_at from projection_pipeline_state where pipeline_key <> 'rolling_forge_pipeline' or scope_key not like 'daily_incremental:%' order by updated_at desc limit 25;
```
```
projection_input_ingest | completed_game_slates | canonical:2026-11-20:2026-11-20 | complete |  | 2026-11-20 | 2026-11-20 | 2026-11-20 |  | 2026-11-21 09:45:01.646166+00
projection_input_ingest | completed_game_slates | canonical:2026-11-19:2026-11-19 | complete | 2026020358 | 2026-11-19 | 2026-11-19 | 2026-11-19 |  | 2026-11-20 09:45:14.627829+00
projection_input_ingest | completed_game_slates | canonical:2026-11-18:2026-11-18 | complete | 2026020346 | 2026-11-18 | 2026-11-18 | 2026-11-18 |  | 2026-11-19 09:45:06.874265+00
projection_input_ingest | completed_game_slates | canonical:2026-11-17:2026-11-17 | complete | 2026020343 | 2026-11-17 | 2026-11-17 | 2026-11-17 |  | 2026-11-18 09:45:16.033708+00
projection_input_ingest | completed_game_slates | canonical:2026-11-16:2026-11-16 | complete | 2026020332 | 2026-11-16 | 2026-11-16 | 2026-11-16 |  | 2026-11-17 09:45:04.270791+00
projection_input_ingest | completed_game_slates | canonical:2026-11-15:2026-11-15 | complete | 2026020330 | 2026-11-15 | 2026-11-15 | 2026-11-15 |  | 2026-11-16 10:16:54.660933+00
projection_input_ingest | completed_game_slates | canonical:2026-11-14:2026-11-14 | complete | 2026020325 | 2026-11-14 | 2026-11-14 | 2026-11-14 |  | 2026-11-16 09:45:08.160163+00
projection_input_ingest | completed_game_slates | canonical:2026-11-13:2026-11-13 | complete | 2026020311 | 2026-11-13 | 2026-11-13 | 2026-11-13 |  | 2026-11-15 09:45:03.95842+00
projection_input_ingest | completed_game_slates | canonical:2026-11-12:2026-11-12 | complete | 2026020309 | 2026-11-12 | 2026-11-12 | 2026-11-12 |  | 2026-11-13 09:45:10.934755+00
projection_input_ingest | completed_game_slates | canonical:2026-11-11:2026-11-11 | complete | 2026020298 | 2026-11-11 | 2026-11-11 | 2026-11-11 |  | 2026-11-12 09:45:07.629538+00
projection_input_ingest | completed_game_slates | canonical:2026-11-10:2026-11-10 | complete | 2026020292 | 2026-11-10 | 2026-11-10 | 2026-11-10 |  | 2026-11-11 09:45:07.363211+00
projection_input_ingest | completed_game_slates | canonical:2026-11-09:2026-11-09 | complete | 2026020285 | 2026-11-09 | 2026-11-09 | 2026-11-09 |  | 2026-11-10 09:45:04.398159+00
projection_input_ingest | completed_game_slates | canonical:2026-11-08:2026-11-08 | complete | 2026020282 | 2026-11-08 | 2026-11-08 | 2026-11-08 |  | 2026-11-09 09:45:06.949322+00
projection_input_ingest | completed_game_slates | canonical:2026-11-07:2026-11-07 | complete | 2026020276 | 2026-11-07 | 2026-11-07 | 2026-11-07 |  | 2026-11-08 09:45:11.418402+00
projection_input_ingest | completed_game_slates | canonical:2026-11-06:2026-11-06 | complete | 2026020264 | 2026-11-06 | 2026-11-06 | 2026-11-06 |  | 2026-11-07 09:45:07.901011+00
projection_input_ingest | completed_game_slates | canonical:2026-11-05:2026-11-05 | complete | 2026020261 | 2026-11-05 | 2026-11-05 | 2026-11-05 |  | 2026-11-06 09:45:11.631792+00
projection_input_ingest | completed_game_slates | canonical:2026-11-04:2026-11-04 | complete | 2026020250 | 2026-11-04 | 2026-11-04 | 2026-11-04 |  | 2026-11-05 09:45:06.669529+00
projection_input_ingest | completed_game_slates | canonical:2026-11-03:2026-11-03 | complete | 2026020246 | 2026-11-03 | 2026-11-03 | 2026-11-03 |  | 2026-11-04 09:45:13.425244+00
projection_input_ingest | completed_game_slates | canonical:2026-11-02:2026-11-02 | complete | 2026020235 | 2026-11-02 | 2026-11-02 | 2026-11-02 |  | 2026-11-03 09:45:05.373065+00
projection_input_ingest | completed_game_slates | canonical:2026-11-01:2026-11-01 | complete | 2026020231 | 2026-11-01 | 2026-11-01 | 2026-11-01 |  | 2026-11-02 09:45:07.653997+00
projection_input_ingest | completed_game_slates | canonical:2026-10-31:2026-10-31 | complete | 2026020226 | 2026-10-31 | 2026-10-31 | 2026-10-31 |  | 2026-11-01 09:45:12.713939+00
projection_input_ingest | completed_game_slates | canonical:2026-10-30:2026-10-30 | complete | 2026020216 | 2026-10-30 | 2026-10-30 | 2026-10-30 |  | 2026-10-31 09:45:06.549916+00
projection_input_ingest | completed_game_slates | canonical:2026-10-29:2026-10-29 | complete | 2026020213 | 2026-10-29 | 2026-10-29 | 2026-10-29 |  | 2026-10-30 09:45:10.661083+00
projection_input_ingest | completed_game_slates | canonical:2026-10-28:2026-10-28 | complete | 2026020202 | 2026-10-28 | 2026-10-28 | 2026-10-28 |  | 2026-10-29 09:45:06.385663+00
projection_input_ingest | completed_game_slates | canonical:2026-10-27:2026-10-27 | complete | 2026020198 | 2026-10-27 | 2026-10-27 | 2026-10-27 |  | 2026-10-28 09:45:12.657173+00
```
### Q2 Nov 19/20/21 games (17:40:07Z)
```sql
select date, count(*), min(id), max(id) from games where date between '2026-11-19' and '2026-11-21' group by date order by date;
```
```
2026-11-19 | 12 | 2026020347 | 2026020358
2026-11-21 | 14 | 2026020359 | 2026020372
```
### Q3 Nov 19 input coverage by table (12 games 2026020347-358) (17:40:16Z)
```sql
select 'pbp_games', count(distinct id) from pbp_games where id between 2026020347 and 2026020358 union all select 'shift_charts', count(distinct game_id) from shift_charts where game_id between 2026020347 and 2026020358 union all select 'forge_player_game_strength', count(distinct game_id) from forge_player_game_strength where game_id between 2026020347 and 2026020358 union all select 'forge_team_game_strength', count(distinct game_id) from forge_team_game_strength where game_id between 2026020347 and 2026020358 union all select 'forge_goalie_game', count(distinct game_id) from forge_goalie_game where game_id between 2026020347 and 2026020358 union all select 'lineCombinations', count(distinct "gameId") from "lineCombinations" where "gameId" between 2026020347 and 2026020358 union all select 'powerPlayCombinations', count(distinct "gameId") from "powerPlayCombinations" where "gameId" between 2026020347 and 2026020358 union all select 'goalie_start_projections 11-21', count(distinct game_id) from goalie_start_projections where game_date='2026-11-21';
```
```
pbp_games | 12
shift_charts | 12
forge_player_game_strength | 11
forge_team_game_strength | 11
forge_goalie_game | 11
lineCombinations | 12
powerPlayCombinations | 12
goalie_start_projections 11-21 | 14
```
### Q4 Nov 19 game missing derived rows (17:40:24Z)
```sql
select g.id, g."homeTeamId", g."awayTeamId", (select max(updated_at) from forge_player_game_strength s where s.game_id=g.id) from games g where g.date='2026-11-19' order by g.id;
```
```
2026020347 | 10 | 26 | 2026-11-21 10:25:01.398424+00
2026020348 | 9 | 4 | 2026-11-21 10:25:01.865443+00
2026020349 | 14 | 22 | 2026-11-21 10:25:02.151566+00
2026020350 | 5 | 19 | 2026-11-21 10:25:02.378194+00
2026020351 | 15 | 7 | 2026-11-21 10:25:02.657608+00
2026020352 | 12 | 8 | 2026-11-21 10:25:02.890587+00
2026020353 | 16 | 29 | 2026-11-21 10:25:03.107735+00
2026020354 | 52 | 2 | 2026-11-21 10:25:03.350214+00
2026020355 | 20 | 30 | 2026-11-21 10:25:03.57887+00
2026020356 | 21 | 24 | 2026-11-21 10:25:03.83891+00
2026020357 | 55 | 23 | 
2026020358 | 54 | 25 | 2026-11-20 10:25:05.364477+00
```
### Q5 pipeline_state keys (all) + latest per key (17:40:25Z)
```sql
select pipeline_key, operation_key, count(*), max(updated_at) from projection_pipeline_state group by 1,2 order by 4 desc limit 20;
```
```
rolling_forge_pipeline | upstream_skater_sources | 33 | 2026-11-21 10:10:27.495395+00
rolling_forge_pipeline | core_entity_freshness | 33 | 2026-11-21 10:05:31.06663+00
projection_input_ingest | canonical:2026-11-20:2026-11-20 | 1 | 2026-11-21 09:45:01.646166+00
projection_input_ingest | canonical:2026-11-19:2026-11-19 | 1 | 2026-11-20 09:45:14.627829+00
rolling_forge_pipeline | projection_execution | 21 | 2026-11-19 10:20:40.770101+00
rolling_forge_pipeline | projection_execution:goalie | 17 | 2026-11-19 10:16:02.513156+00
rolling_forge_pipeline | projection_derived_build | 21 | 2026-11-19 10:15:54.857241+00
rolling_forge_pipeline | projection_relationship_build | 21 | 2026-11-19 10:15:51.777307+00
rolling_forge_pipeline | projection_input_ingest | 23 | 2026-11-19 10:15:51.221479+00
rolling_forge_pipeline | rolling_player_recompute | 24 | 2026-11-19 10:15:50.959991+00
rolling_forge_pipeline | contextual_builders | 24 | 2026-11-19 10:10:28.536566+00
projection_input_ingest | canonical:2026-11-18:2026-11-18 | 1 | 2026-11-19 09:45:06.874265+00
projection_input_ingest | canonical:2026-11-17:2026-11-17 | 1 | 2026-11-18 09:45:16.033708+00
projection_input_ingest | canonical:2026-11-16:2026-11-16 | 1 | 2026-11-17 09:45:04.270791+00
projection_input_ingest | canonical:2026-11-15:2026-11-15 | 1 | 2026-11-16 10:16:54.660933+00
projection_input_ingest | canonical:2026-11-14:2026-11-14 | 1 | 2026-11-16 09:45:08.160163+00
projection_input_ingest | canonical:2026-11-13:2026-11-13 | 1 | 2026-11-15 09:45:03.95842+00
rolling_forge_pipeline | monitoring | 14 | 2026-11-13 10:46:19.282399+00
rolling_forge_pipeline | downstream_projection_consumers | 14 | 2026-11-13 10:46:19.20239+00
projection_input_ingest | canonical:2026-11-12:2026-11-12 | 1 | 2026-11-13 09:45:10.934755+00
```
### Q6 invalid_row census: rolling rows inside the max 1095-day lookback (cutoff 2026-11-21) lacking game identity (17:40:58Z)
```sql
select count(*) filter (where game_id is null or game_id <= 0) null_or_bad_game_id, count(*) filter (where season is null or season <= 0) null_season, max(game_date) latest_date from rolling_player_game_metrics where game_date > date '2026-11-21' - 1095;
```
```
0 | 0 | 2026-11-19
```
### Q7 live 0359 forge_runs scope/proof metrics (17:42:30Z)
```sql
select run_id, git_sha, metrics->'execution_scope' execution_scope, metrics->'resume'->>'scope_key' scope_key, metrics->>'horizon_games' horizon, metrics ? 'pregame_publication' has_pregame_pub, left((metrics->'pregame_publication')::text,200) from forge_runs where as_of_date='2026-11-21';
```
```
f55203dc-232f-4d78-9986-c2b85665a40e | f47905d28718f6910d7acfa1471517c0235775de | {"mode": "selected_games", "requested_game_ids": [2026020359]} |  | 1 | t | {"version": "forge-pregame-publication-v1", "claim_id": "f55203dc-232f-4d78-9986-c2b85665a40e"}
```
### Q8 derived build audits today (0357 gap) (17:42:31Z)
```sql
select job_name, run_time, status, left(details->>'response',600) from cron_job_audit where job_name ilike '%derived%' and run_time > now() - interval '30 hours' order by run_time;
```
```
build-projection-derived-v2 | 2026-11-21 10:25:03.90104+00 | failure | {"success":false,"startDate":"2026-11-19","endDate":"2026-11-19","chunkDays":0,"maxDays":3,"resumeFromDate":null,"nextStartDate":"2026-11-19","processedDates":[],"deferredDates":["2026-11-19"],"durationMs":"00:03","timedOut":false,"maxDurationMs":"04:30","rowsAffected":422,"rowsVerified":422,"rowsPruned":0,"gamesVerified":10,"gamesIdempotent":0,"player":{"gamesProcessed":10,"rowsUpserted":381,"rowsVerified":381},"team":{"gamesProcessed":10,"rowsUpserted":20,"rowsVerified":20},"goalie":{"gamesProcessed":10,"rowsUpserted":21,"rowsVerified":21,"gamesNotObserved":0},"observability":{"goalieRowsPro
```
### Q-goalie goalie priors for Nov 21 (17:5xZ)
```sql
select count(*), min(updated_at), max(updated_at) from goalie_start_projections where game_date='2026-11-21';
```
```
66|2026-11-21 09:30:07.851+00|2026-11-21 09:30:07.851+00
```
### Q-tables / Q-derived-detail
Table and column discovery (`information_schema`) and the full 10:25Z derived response (`errors: ["2026-11-19 input_manifest: Projection input and relationship manifest is not complete for game 2026020357"]`, `deferredDates ["2026-11-19"]`) were read with the same read-only wrapper.
