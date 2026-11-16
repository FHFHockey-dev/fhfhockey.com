# FORGE served snapshot: first natural 12:40Z run, 2026-11-15 (Claude, read-only)

## Scope
Close out the first natural 12:40 UTC run of `/api/v1/db/forge-served-forecast-snapshot` after release #445 (F19).
Done = (1) the run's response plus its ledger/universe rows, (2) a response showing nothing to write, or
(3) sourced evidence that it never ran, with the likely reason. Read-only: no route/cron/ETL run, no writes,
deploys, pushes or flag changes. Every production read needs TJ's pop-up approval of the exact query first.

## Where
- octoberBranch HEAD `3fdd94c56`. Production at 12:40Z was probably master `baeb5df7f` (#447, merged 02:38Z 11-15; INFERRED from merge time, unconfirmed);
  #445 `51f818cef` and #446 `89da739cb` precede it. All three have `"40 12 * * *"` for the snapshot cron
  (`web/vercel.json:127-128`).
- Route: `web/pages/api/v1/db/forge-served-forecast-snapshot.ts`, wrapped
  `adminOnly(withCronJobAudit(withNhlOffSeasonSkip(handler)))`.

## Local facts (no production read yet)
- Audit: `withCronJobAudit` inserts one `cron_job_audit` row after the handler returns; `job_name` = URL path
  without query (`/api/v1/db/forge-served-forecast-snapshot`); `run_time` is the insert time (end of run; baseline DDL `run_time ... DEFAULT now()`);
  details hold invocationSource (`vercel-cron-claimed` when UA is vercel-cron/1.0), statusCode, durationMs,
  error, response (≤4000 chars), responseOutcome. No `skipAuditWhenNoOp`, so every run that reaches the
  wrapper is audited, including a 0-games run.
- `adminOnly` is OUTSIDE the audit wrapper: a 401/403 (bad CRON_SECRET) writes no audit row.
- Neighbours `draft-ranker-health` (12:45), `refresh-draft-ranker-community` (12:15) and `cron-report` (13:00) use the
  same `adminOnly(withCronJobAudit(...))` wrappers, so they are a fair control for dispatch and the secret.
- Audit stores at most 4,000 chars of the body; report it as captured (`responseTruncated`), not as complete.
- Nothing-to-write path: `games` has no rows for the ET date → 200 `{success:true, games:0, rowsUpserted:0}`.
- Tables: `forge_served_forecast_ledger` (PK served_date, player_id, game_id, source; index served_date,source),
  `forge_served_forecast_universe` (PK served_date, player_id, game_id). LEDGER_BASIS_SCHEMA_ENABLED=true,
  LEDGER_MARKET_ENABLED=false. Upsert: a rerun updates `updated_at`, `created_at` stays from the first insert.
- `cron_job_audit_run_time_idx (run_time, job_name, status, rows_affected)` exists, so the audit reads are cheap.
- Supabase project ref `fyhftlxokyjtpndbkfse`. Vercel team `team_KVFicHhQJARTbO6wRD2x6jpq`,
  project `prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw` (from 2026-11-07 diary).

## Approval request (verbatim; sent 14:07Z 11-15)
Connector: plugin Supabase `execute_sql`, project `fyhftlxokyjtpndbkfse`. Sequential, one at a time. Stop rule:
Q0 active > 20 or longest active > 60 s → stop, run nothing else.
- Q0 `select count(*) filter (where state = 'active') as active, count(*) as total, coalesce(max(extract(epoch from now() - query_start)) filter (where state = 'active'), 0)::int as longest_active_s from pg_stat_activity where datname = current_database();`
- Q1 `select run_time, job_name, status, rows_affected, details->>'invocationSource' as invocation_source, details->>'method' as method, details->>'url' as url, details->>'statusCode' as status_code, details->>'durationMs' as duration_ms, details->>'error' as error, details->>'responseTruncated' as response_truncated, details->'responseOutcome' as response_outcome, details->>'response' as response from public.cron_job_audit where run_time >= '2026-11-14T00:00:00Z' and run_time < '2026-11-16T00:00:00Z' and job_name like '/api/v1/db/forge-served-forecast-snapshot%' order by run_time;`
- Q2 `select job_name, count(*) as runs, min(run_time) as first_at, max(run_time) as last_at, string_agg(distinct status, ',') as statuses from public.cron_job_audit where run_time >= '2026-11-15T12:25:00Z' and run_time < '2026-11-15T13:05:00Z' group by job_name order by min(run_time);`
- Q3 `select id, date, "startTime", "homeTeamId", "awayTeamId" from public.games where date = '2026-11-15' order by id;`
- Q4 `select source, player_class, count(*) as rows, count(distinct game_id) as games, count(distinct run_id) as runs, min(created_at) as first_created, max(created_at) as last_created, max(updated_at) as last_updated, min(issued_at) as first_issued, max(issued_at) as last_issued, count(settled_at) as settled from public.forge_served_forecast_ledger where served_date = '2026-11-15' group by source, player_class order by source, player_class;`
- Q5 `select player_class, count(*) as rows, count(distinct game_id) as games, min(created_at) as first_created, max(created_at) as last_created, max(updated_at) as last_updated, count(settled_at) as settled from public.forge_served_forecast_universe where served_date = '2026-11-15' group by player_class order by player_class;`
Vercel tier (team `team_KVFicHhQJARTbO6wRD2x6jpq`, project `prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw`), only if Q1 has no
11-15 row or it is ambiguous:
- V1 `get_project` idOrName=prj_LV0…, teamId=team_KV… (read `crons`: enabledAt/disabledAt, deploymentId, snapshot definition).
- V2 `list_deployments` projectId=prj_LV0…, teamId=team_KV…, target=production, since=1794614400000 (11-14 00:00Z), limit=10.
- V3a `get_runtime_logs` projectId, teamId, environment=production, since=2026-11-15T12:35:00Z, until=2026-11-15T12:50:00Z, group_by=requestPath.
- V3b same window, query="forge-served-forecast-snapshot", limit=20.

## Results (TJ approved Q0–Q5 at about 14:08Z; Vercel tier only if unclear, so NOT run)
- Q0: 1 active of 10 connections, longest active 0 s. OK.
- Q1: **success**. run_time 12:40:39.846Z, HTTP 200, 4,543 ms, vercel-cron-claimed, rows_affected 693, body complete
  (not truncated). Body: 5 games, 332 players, rowsUpserted 693 {bridge_exact 175, naive_last5 259, naive_season 259,
  others 0}, universeUpserted 332, universe_persisted, skippedGames []. The prior day's 11-14 run was a 500 at 12:32:43Z
  (141.8 s, deadline in forge_bridge).
- Q2: auto-news audited 12:32:23Z, 8 min before the snapshot. All neighbours succeeded.
- Q3: 5 games, starting 00:30–02:00Z on 11-16.
- Q4/Q5: ledger 693 rows (bridge_exact 175 skater; each naive source 236 skater + 23 goalie), universe 332
  (297 + 35). All counts equal the response. created_at = updated_at, 12:40:39.63–.81Z, inside the run. settled 0.
- Full write-up: side-session notes folder `forge-snapshot-1240-closeout.md`; exact body in
  `forge-snapshot-1240-response-2026-11-15.json` there.

## State
- DONE: condition 1 met (exact response plus matching ledger/universe rows). Nothing changed in production or the repo
  except this diary. Not committed.

## Next step
- Owner records the outcome in PRODUCTION-QUEUE #445 ("Not done: first natural run" → succeeded 12:40:39Z). Then
  retire this diary.

## Insights
- Why the Vercel logs looked empty is not investigated. The route logs only on failure, but Vercel normally lists
  requests anyway, so this is unexplained. One clean run does not confirm F19: the 12:30 slot passed about 5 of 12 days.
- Open for the owner: the bridge has one proven run (11-09). 7 newer runs are withheld for unproven exclusion, so 157
  players get no forecast.
