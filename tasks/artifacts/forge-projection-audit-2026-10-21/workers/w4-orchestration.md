# W4 — Scheduled orchestration and run lifecycle (R12 code, HEAD 3c90d72b3)

Read-only audit of `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` (RFP), `web/lib/rollingForgePipelineRunState.ts` (RS), `web/lib/projections/projectionPipelineState.ts` (PPS), `web/pages/api/v1/db/run-projection-v2.ts` (RPV2), `web/lib/projections/queries/run-lifecycle-queries.ts` (RLQ), `web/lib/projections/run-forge-projections.ts` (RFPj), `web/lib/projections/releasedRunFence.ts`, `web/lib/projections/apiHelpers.ts`, `web/pages/api/v1/db/update-goalie-projections-v2.ts` (GOALIE), `web/pages/api/v1/db/build-projection-derived-v2.ts`, `web/pages/api/v1/db/ingest-projection-inputs.ts`, `web/lib/cron/withCronJobAudit.ts` (AUDIT), `web/pages/api/v1/db/cron-report.ts`, `web/vercel.json`, pg_cron inventory in `tasks/TASKS/cron-operations/cron-schedule.md` and `tasks/artifacts/independent-audit-2026-10-17/data/db-readonly-reads.md` §R5. No commands, routes, DB or Vercel calls were run. Prior evidence cited: `tasks/diaries/2026-10-21-claude-forge-pipeline-repair.md` (DIARY), side-session note `forge-pipeline-repair-2026-10-21.md` (NOTE), `tasks/handoff-2026-10-20/CONSOLIDATED-CHECKPOINTS-2026-10-20.md` §B (CKPT).

## 1. Stage map (scheduled `mode=daily_incremental`, implicit window)

Cron: `vercel.json:31-32` — `/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&includeDownstream=true&includeAccuracy=false&stopOnFailure=false` at `5,10,15,20,30,35,40,45,55 10 * * *` (9 invocations, 240 s `maxDuration`, RFP:418).

Dates (RFP:189-207): `date` = today ET; `startDate=endDate=date`; because no date params are sent (`useDurableProjectionBacklog`, RFP:1468-1471) the rolling and source windows are `completedDate = date-1`. Run scope key = `buildRollingForgeRunScopeKey(mode, date)` (RFP:1115), state in `projection_pipeline_state` via the lease RPC (RS:19-23, PPS:182).

Budgets (RFP:212-243): invocation claim budget 180 s; a second-or-later stage of unknown length starts only if elapsed < 90 s (RFP:1181-1186; rolling instead needs ≥30 s claim left); stage lease 270 s; rolling in-flight deadline start+220 s; chunk 16 then 4–60 players sized at 0.75 of remaining claim / measured ms-per-player; blocking stage retried once (`MAX_BLOCKING_STAGE_ATTEMPTS=2`); 3 dead-lease kills close the stage (`MAX_KILLED_STAGE_ATTEMPTS=3`).

| # | stage id (all `blocking:true` except 9,10; `web/lib/rollingForgePipeline.ts:50-197`) | steps and params in scheduled mode | cursor / resume | on failure |
|---|---|---|---|---|
| 1 | core_entity_freshness | GET update-games, update-teams, update-players, no params (RFP:641-657) | none; whole stage repeats if killed | failed step → stage failed, attempt 1; retried next invocation; attempt 2 → `attempts_exhausted`, run stops (RFP:1358-1376) |
| 2 | upstream_skater_sources | update-nst-gamelog `runMode=incremental&startDate=endDate=date-1&deadlineAt=start+160 s` (RFP:660-675; NST resume contract INACTIVE, `nstStepResume.enabled=false` RFP:414); update-wgo-skaters `action=all&startDate=date-1`; update-wgo-totals `season=current` | none (NST cursor path dormant) | as above |
| 3 | contextual_builders | update-line-combinations `repairMode=historical_backfill&gameIds=<date-1 games that started ≥3 h ago>` else `count=10` (RFP:720-733); update-power-play-combinations `startDate=endDate=date-1`; synthetic `verify-line-context` (RFP:756-775) | none | missing both-team line rows: fails once (attempt 1) so the next invocation retries; second time `success` with degraded warning |
| 4 | rolling_player_recompute | chunked update-rolling-player-averages `startDate=endDate=date-1&fastMode=true&executionProfile=daily_incremental&bypassFreshnessBlockers=true&maxPlayers=N&maxRuntimeMs=<claim left>&deadlineAt=start+220 s&resumeFrom=<cursor>` (RFP:779-842) | cursor persisted after every chunk via `advanceRollingForgeStage` keeping the 270 s lease (RFP:1315-1324); stage `partial` → cursor stored, `continuation_required` (RFP:1346-1357) | failed chunk → stage failed attempt N (same retry rule); dead invocation → `stage_killed:attempt-N` on `<stage>:kills` companion row (RS:84-134) |
| 5 | projection_input_ingest | POST ingest-projection-inputs, no query → route reads oldest `canonical:%` backlog in `projection_pipeline_state` (ingest:383-416; PPS:194-240) else `startDate=previousUtcDate()` (ingest:306-307) | the route's own PPS lease | `success:false` or ≥400 → failed (RFP:453-462) → blocking → everything after is `skipped` (RFP:1137-1143) |
| 6 | projection_relationship_build | POST shift-charts `gameId=all` (RFP:893-901) | none | as above |
| 7 | projection_derived_build | POST build-projection-derived-v2, no query → queue of ≤3 pending dates from `projection_game_materialization_status` (derived:76, 329-355) | route-level | as above |
| 8 | projection_execution | GET update-goalie-projections-v2 `limit=7` **every invocation** (RFP:919-926); then run-projection-v2 `date=today&maxDurationMs=max(30 s, 180 s−elapsed)`, then `date=tomorrow` if ≥30 s remain (RFP:939-985) | stage cursor = number of dates finished (0/1/2) via `persistProjectionDatesDone` (RFP:976-983, 1331-1339); RPV2's own per-game lease in `forge_runs.metrics.resume` (RLQ:16-20, 292-355) | today failing (422/500) → stage failed attempt N; tomorrow failing → step rewritten `skipped` (non-blocking, RFP:968-974); 207 `operationStatus:"partial"` + `resume.required` → stage `partial`, resumed next invocation (RFP:385-394) |
| 9 | downstream_projection_consumers (non-blocking) | `includeAccuracy=false` → run-projection-accuracy recorded `skipped` (RFP:1002-1012) | — | — |
| 10 | monitoring (non-blocking) | cron-report always `skipped` (RFP:1025-1037) | — | — |

**`stopOnFailure=false` in the cron URL is a no-op.** RFP:1493-1495: `stopOnFailure = useDurableProjectionBacklog ? true : requestedStopOnFailure`. The scheduled run is always the resumable path (RFP:1513-1517), which never consults `stopOnFailure` at all; it stops on any blocking-stage failure after the attempt rule above. `stopOnFailure` only affects explicit one-shot runs (RFP:1546-1552). The response still echoes `stopOnFailure:true` (RFP:1642-1646), so the audit row contradicts the URL.

Terminal response: 200 only when `termination.state==="completed"`; otherwise 207 (RFP:1579, 1627). A 207 whose `termination.state==="continuation_required"` and `failureSummary.failedStepCount===0` is audited as `continued` (AUDIT:204-223, 372-376); a 207 `stopped_on_blocking_failure` or any failed step → `failure`.

## 2. Invocation economics (normal day, R12 code; derived, not measured)

Inputs: ~3 players/s after the GIN-index drop (NOTE "Tonight's outcome"), 396 players → 132 s of rolling claim time plus one route call per chunk (~5–8 chunks). RPV2 ~36 s for 2 games incl. preflight (NOTE) → ~15–18 s/game; a 12-game slate ≈ 190–220 s, 16 games ≈ 250–290 s. Goalie step: processes from the last `goalie_start_projections.game_date` through today UTC only (GOALIE:98, 126-132) — a few teams' NHL log fetches, tens of seconds (not measured).

Walk-through of the 9 slots:
- 10:05 (inv 1): stages 1–3 (unknown, assume 40–70 s), then rolling with ~110–140 s claim left → ~250–350 players; stage `partial`, 207 `continued`. ≈ 180–225 s.
- 10:10 (inv 2): rolling tail (~30–50 s) → complete; elapsed <90 s so ingest, relationship build, derived run (routes have their own 270 s defaults but hold small backlogs; assume 20–60 s); projection_execution starts only if elapsed <90 s — usually not → deferred. ≈ 60–150 s.
- 10:15 (inv 3): goalie step + today's run with `maxDurationMs≈180 s−goalie` → ~8–10 games, 207 partial (resume lease). ≈ 200–220 s.
- 10:20 (inv 4): goalie step again + today's remaining 2–6 games (≈40–110 s) → `datesDone=1`; tomorrow starts with the remaining ≥30 s → 207 partial. ≈ 200 s.
- 10:30 (inv 5): goalie step + tomorrow ≈ 8–10 games → 207 partial. ≈ 200 s.
- 10:35 (inv 6): goalie step + tomorrow tail → `datesDone=2`; stages 9–10 skipped; 200 `completed`. ≈ 60–150 s.
- 10:40, 10:45, 10:55: read state, every stage `complete` → 200 in ~1–3 s each (RFP:1146-1152).

Total ≈ 6 productive invocations ≈ 900–1,150 s of function time, plus 3 idle ≈ 5 s, plus nested audit rows: every step handler is the wrapped default export (RFP:38-48), so each chunk/step also inserts its own `cron_job_audit` row (`update-rolling-player-averages`, `run-projection-v2`, …) — roughly 15–25 nested rows per day on top of 9 pipeline rows.

Non-pipeline writers on the same morning (cron-schedule.md:764-790; db-readonly-reads.md §R5): pg_cron 278 `update-rolling-player-averages` 08:15Z with POST `{}` → implicit 14-day window, 210 s profile budget / 220 s in-flight deadline (a05 note; `rollingPlayerOperationalPolicy.ts:39-46`, rolling route:186-192) ≈ 220 s, work that stage 4 redoes for date-1 two hours later; pg_cron 364 goalie 09:30, ingest 09:45, derived 09:50 (duplicates of stages 5/7/8-goalie, each small); pg_cron 393 `run-projection-v2?horizonGames=5` 10:12Z ≈ up to 210 s (`PROJECTION_ROUTE_DEFAULT_BUDGET_MS`, policy:8) for rows no reader uses (bridge filters `horizon_games===1`, `forgeDailyBridge.ts:277-278, 481-483`; start-chart `start-chart.ts:884`). Wasted: the 3 idle slots (trivial), the 4–5 repeated goalie steps (~tens of s each), 4–5 repeated RPV2 route preflights + stage preflights (RPV2:1154, RFPj:759), the h5 run (~200 s/day), job 278's overlap with stage 4 (~220 s/day). Kills: with chunked cursors a kill loses at most one chunk (≤60 players ≈ 20 s) plus the goalie step.

## 3. Correctness and coverage gaps after R12

**(a) Second writer, pg_cron 393 h5 at 10:12Z.** Same `as_of_date` (today), different scope key `h5:full` vs `h1:full` (RLQ:190-196). `createRun`/`claimResumableRun` look at *every* `running` row for the date regardless of scope (RLQ:209-220, 268-283, 292-320): an active lease of either horizon makes the other return 409 `ACTIVE_RUN_EXISTS` → RPV2 maps `resumeInProgress` to 207 `run_in_progress_elsewhere` (RPV2:1636-1651). So they do not corrupt each other, but they serialize: if the h5 run holds the lease when inv 3 reaches the projection stage, today's h1 run is deferred a whole slot. A paused (207) h5 run is never resumed — pg_cron calls once — and sits `running` until a later claim fails it after `RUN_RESUME_MAX_AGE_MS` 2 h (RLQ:22, 184-187, 318). Reader hazard: `requireLatestSucceededRunId` (apiHelpers:40-66), start-chart (`start-chart.ts:878-890` + `.limit(1)` at ~891) and the bridge (`forgeDailyBridge.ts:468-472`) pick the newest *succeeded* run for the date by `created_at` without a horizon predicate, then filter rows to `horizon_games=1`; an h5 run that succeeds after the h1 run (e.g. h1 ran early by hand, h5 at 10:12) is selected and yields zero skater rows for every team that day. On a normal day the h1 run is created later (≥10:15) so it wins; the race is real on manual-run days and on days the pipeline fails.

**(b) Stamping and fencing.** `currentRunGitSha()` = `VERCEL_GIT_COMMIT_SHA || GIT_SHA || "local:unknown"` (RLQ:248-250) — R12 already stamps local runs `local:unknown`, never null; NOTE §4 and CKPT §B describe the earlier null-stamp coverage loss. Readers and predicates:
- `apiHelpers.requireLatestSucceededRunId` — `status='succeeded'`, `git_sha not null and not like 'local:%'`, `as_of_date = d`, newest `created_at`, plus provenance-contract 422 (apiHelpers:40-66). Used by `/api/v1/projections/{players,teams,goalies}` and `run-projection-accuracy.ts:1676`.
- `start-chart.ts:878-884` — same fence + `as_of_date = target`, embedded `horizon_games=1`, `limit(1)`; no age cap.
- `forge/players.ts:160-170` — fence + `as_of_date >= oldestAllowedDate` (age cap), `limit(30)`; `forge/goalies.ts:301-312` — fence on joined `forge_runs.git_sha`, `horizon_games = horizon`, `limit(1)`.
- `forgeDailyBridge.ts:466-472` — fence + `status='succeeded'`, `as_of_date` in `[now−LOOKBACK, now+1 d]`, latest per date by `created_at <= now`, rows `horizon_games===1`.
- `yahooLiveDraft.ts`, `rosterScheduleOptimizer/workspace.ts` import the fence helpers only indirectly (no forge_runs query of their own found).
Served-but-partial risk: all fences require `status='succeeded'`, and `finalizeRun` flips status only at the end (RLQ:507-518), so a stamped-but-failed run (`failed`) or a paused run (`running`) is never served. A `succeeded` run's game set is whatever its slate was (`pendingGames` loop, RFPj:808-840); on resume, rows of unfinished games are cleared and recomputed (`clearRunGameRows`, RFPj:810), so a succeeded run has complete per-game rows. Gap: a run that *succeeds* with data-quality warnings (missing PbP/shift totals counted in metrics, RFPj:844-851) is served without any reader checking `metrics.data_quality`.

**(c) Team with no game today or tomorrow.** Only `date=today` and `date=tomorrow` are projected (RFP:940-942); nothing projects a team's *next* game by team. A team idle for N days keeps its last served line until a date it plays is projected; the bridge then marks skaters whose latest run date ≠ the team's latest date as stale (`forgeDailyBridge.ts:283, 354`). Worst case under the schedule: a team with a 3-day gap (common) has no h1 row for 1–2 days; the RSO DROP flow surfaces that as "unprojected" (NOTE, RSO section). Tomorrow's run is also best-effort and gated (see d).

**(d) RPV2 per-game resume.** Each call re-runs the route preflight (`runProjectionPreflightChecks`, RPV2:1154) and the stage preflight (`runProjectionPreflightStage`, RFPj:759), re-claims the lease, clears rows for pending games (RFPj:810) and continues the totals from `priorMetrics` (RFPj:790-803). Not recomputed: finished games (`completed_game_ids`). The pipeline's goalie step (`update-goalie-projections-v2?limit=7`) runs at the top of stage 8 on every invocation that enters it, regardless of `datesDone` (RFP:919-926) — "goalie step reruns per resumed invocation" confirmed. At ~18 s/game with ~150–180 s per call after the goalie step, a 16-game slate needs 2 calls for today (≈ 9 + 7 games) → one 207 for today, and the same again for tomorrow: ≈ 2 207s per date, ≈ 4 productive invocations for stage 8 alone, matching the walk-through in §2.

**Goalie-priors gate vs tomorrow (new, needs confirmation).** GOALIE:98-132 processes games from the last `goalie_start_projections.game_date` through **today UTC** (`.lte("date", today)`); it has no `date` param (only `req.query.limit`, GOALIE:101-103) although the preflight's remediation text names `?date=` (RPV2:726). The `goalie_start_priors_v2` gate for `date=tomorrow` counts `goalie_start_projections` rows for tomorrow's game ids and FAILs when zero (RPV2:716-727). Unless another writer fills tomorrow's rows (candidates found by name only: `update-goalie-starter-mixtures.ts`, `update-lineup-source-provenance.ts`, `gameRevisions.ts` — not read), the scheduled next-day run returns 422 every day and is recorded `skipped` (RFP:968-974), so the "today + tomorrow" coverage decided on 10-21 may never deliver tomorrow. DIARY/NOTE Fix 3 asserted `limit=7` covers 7 days ahead; the code reads as 7 *past* dates. Verify with SQL Q5 below before acting.

**(e) Range / explicit-date runs.** Pipeline: any `date|startDate|endDate` → one-shot path, no durable state, `stopOnFailure` honoured, rolling still chunked but cursor only reported (RFP:1519-1577); projection step uses `startDate/endDate` range when they differ (RFP:927-937) and today-only otherwise (no tomorrow). RPV2 range mode: preflight per date, 422 stops the range (RPV2:1197-1254), timeout returns **200 with `success:false`** and `error:"Timed out"` (RPV2:1274-1331) — classified `failure` by the audit wrapper and `failed` by the pipeline (RFP:458-459) and not resumable via the game lease (range dates call `runProjectionV2ForDate` without the single-date 207 path).

**(f) Empty windows.** No games on date-1: contextual stage passes `count=10` to line combos and skips PP (RFP:730-744); rolling processes the window's players (none) and returns quickly; ingest/derived have nothing. No games today: RPV2 preflight passes the goalie gate ("not required", RPV2:728-735), the slate is empty → run succeeds with 0 games (observed: h5 "zero-game no-op 200 in 430 ms", cron-schedule.md:422); `buildGoalieObservability` only warns `goalie_rows_zero` when `gamesProcessed>0` (RPV2:881-885). Postponed games: `games` rows keep their date until update-games moves them; a game projected today and later postponed leaves a succeeded run whose rows the bridge filters by `games.status==="scheduled"` and `startsAt > now` (`forgeDailyBridge.ts:331, 476`), so stale rows are dropped at read time, not rewritten. Season start: `withNhlOffSeasonSkip` wraps all three routes (RFP:1666, RPV2:1711); first in-season day has `date-1` with no completed games (same as the empty case) and derived/preflight windows (`-7`, `-14` days) are empty — the `derived freshness` gates (RPV2:547-561, 676-711) would FAIL for the first days unless derived rows exist; not verified against the gate's exact zero-row handling.

## 4. Observability: one query per surface

Columns that prove a healthy day: `cron_job_audit(job_name, status in {success,continued,failure}, details->>'statusCode', details->>'durationMs', created_at)` (AUDIT:370-400); `projection_pipeline_state(scope_key, operation_key, status, cursor_game_id, last_error, lease_expires_at, updated_at)` for `scope_key` = the day's run key and the `<stage>:kills` companions (PPS:182-184, RS:84-97); `forge_runs(run_id, as_of_date, status, git_sha, created_at, updated_at, metrics->'resume'->>'scope_key', metrics->'resume'->>'invocations')`. A killed invocation (504) writes **no** audit row — the only insert is after the handler returns (AUDIT:408-409) — so gaps in the 9 expected pipeline rows are the kill signal.

Draft SELECTs for TJ's approval (not run):

```sql
-- Q1 runs since 10-14 with row counts by horizon
select r.run_id, r.as_of_date, r.status, r.git_sha, r.created_at, r.updated_at,
       r.metrics->'resume'->>'scope_key' as scope_key,
       (r.metrics->'resume'->>'invocations')::int as invocations,
       (select count(*) from forge_player_projections p where p.run_id = r.run_id and p.horizon_games = 1) as skater_h1_rows,
       (select count(*) from forge_player_projections p where p.run_id = r.run_id and p.horizon_games <> 1) as skater_other_rows,
       (select count(*) from forge_goalie_projections g where g.run_id = r.run_id) as goalie_rows
from forge_runs r where r.as_of_date >= '2026-10-14' order by r.as_of_date desc, r.created_at desc;

-- Q2 pipeline stage state for the last 3 run dates (incl. kill companions)
select scope_key, operation_key, status, cursor_game_id, cursor_date, last_error, lease_expires_at, updated_at, revision
from projection_pipeline_state
where scope_key like 'daily_incremental%' and updated_at >= now() - interval '3 days'
order by scope_key, operation_key;

-- Q3 audit rows for the four routes, last 7 days
select created_at, job_name, status, details->>'statusCode' as http,
       (details->>'durationMs')::int as duration_ms, details->>'url' as url,
       left(details->>'error', 160) as error
from cron_job_audit
where created_at >= now() - interval '7 days'
  and job_name in ('run-rolling-forge-pipeline','update-rolling-player-averages','run-projection-v2','update-goalie-projections-v2')
order by created_at desc;

-- Q4 pipeline invocations per UTC day vs the 9 scheduled (missing rows = kills)
select date_trunc('day', created_at) as day, count(*) as audit_rows,
       count(*) filter (where status = 'success') as ok,
       count(*) filter (where status = 'continued') as continued,
       count(*) filter (where status = 'failure') as failed
from cron_job_audit where job_name = 'run-rolling-forge-pipeline' and created_at >= now() - interval '7 days'
group by 1 order by 1 desc;

-- Q5 does any writer give tomorrow goalie priors? (tests the §3d gate claim)
select g.date, count(distinct g.id) as games, count(distinct s.game_id) as games_with_goalie_rows, max(s.updated_at) as last_written
from games g left join goalie_start_projections s on s.game_id = g.id
where g.date between current_date - 2 and current_date + 2
group by g.date order by g.date;
```

## 5. Proposals (evaluate, do not assume)

| proposal | kind | impact | effort / risk | files / lane | verification |
|---|---|---|---|---|---|
| P1 Remove or repurpose pg_cron 393 h5 (unschedule, or point it at `date=tomorrow` h1 *after* the pipeline window, e.g. 11:05Z) | quick win (DB) | −~200 s/day; removes the §3a serialization and the newest-run-wins hazard; if repurposed, gives a second attempt at tomorrow | low effort; DB-side `cron.unschedule(393)` is ask-first; risk: none to readers (no h5 consumer found) | pg_cron only; record in `tasks/TASKS/cron-operations/cron-schedule.md`. Lane: TJ/DB | Q1 shows no `h5:*` scope after change; Q3 shows no 10:12 run-projection-v2 row |
| P2 Horizon-aware reader fence (`horizon_games=1` run must have h1 rows; or stamp `metrics.horizon_games` and filter in `requireLatestSucceededRunId`, start-chart, bridge) | structural (small) | closes §3a zero-row day | medium; touches 4 readers + tests | `apiHelpers.ts`, `start-chart.ts:878-891`, `forgeDailyBridge.ts:468-472`, `forge/players.ts`. Lane: Claude | Vitest on readers with an h5-newest fixture |
| P3 Stamp local runs `local:unknown` | done in R12 (RLQ:248-250) — cite NOTE §4 / CKPT §B; nothing left except backfilling historical null rows (ask-first SQL) | — | — | — | Q1 `git_sha is null` count |
| P4 Fix the tomorrow goalie gate: give GOALIE a `date`/`endDate` param or extend its window to today+1 and call it with that from stage 8; or make `goalie_start_priors_v2` non-blocking for future dates | quick win if §3d confirmed | makes the R12 "today + tomorrow" coverage real | low–medium; risk: GOALIE fetches NHL logs per team (external calls) | `update-goalie-projections-v2.ts:98-132`, `run-rolling-forge-pipeline.ts:919-926`, `run-projection-v2.ts:716-727`. Lane: Claude | Q5 before/after; pipeline test asserting tomorrow's step is `success` not `skipped` |
| P5 Project each team's next game (by team, not by date) | structural | fixes §3c staleness for idle teams | high: RPV2 is slate-per-date keyed on `as_of_date`; a per-team run needs a new run shape or multi-date issue; readers assume one date | RFPj, RPV2, bridge. Lane: Claude, after P4 | — |
| P6 Self-terminating idle slots | quick win | saves ~3 invocations × ~2 s/day — negligible; **not worth doing** beyond what exists (completed runs already return in ~1–3 s, RFP:1146-1152) | — | — | Q4 durations |
| P7 Single-writer lock across pg_cron and pipeline | structural | redundant if P1 removes the h5 job; RLQ already serializes same-date runs (409/207) | skip unless more writers appear | — | — |
| P8 Preflight once per invocation | quick win | saves one route-level preflight per resumed call (~1–3 s each, 4–6/day); low value | low; risk: stale gate on resume | `run-projection-v2.ts:1154` (skip when `resume` claim resumed) | unit test |
| P9 Fold the goalie step into the stage cursor (run it only when `datesDone===0`, or once per run via a `goalie` companion row) | quick win | saves 3–5 repeated goalie fetches/day (tens of s each, external NHL calls) | low; risk: a goalie step failure after the first invocation no longer retried | `run-rolling-forge-pipeline.ts:919-926, 1331-1339`. Lane: Claude | pipeline Vitest: resumed invocation has no goalie step |
| P10 Alert on `attempts_exhausted` / `stage_killed` | quick win | makes the 3-kill stop visible in the daily report | low; cron-report wording is Codex lane | `cron-report.ts` (Codex); or pipeline sets a `failureSummary.firstFailure.code` already read by the report (RFP:1614-1626). Lane: Codex for wording | report test fixture with a 207 `attempts_exhausted` body |
| P11 Retire pg_cron 278 (08:15 rolling, 14-day implicit window, no resume) or narrow it to a `startDate=endDate=date-1` call | quick win (DB) | −~220 s/day of duplicate rolling work; removes the only writer that touches rolling rows before the pipeline | ask-first DB change; risk: the 14-day window also back-fills late-arriving source days that the pipeline's date-1-only window never revisits — keep that in a weekly job instead | pg_cron; `cron-schedule.md`. Lane: TJ/DB | `rolling_player_game_metrics.updated_at` distribution (SQL, approval needed) |
| P12 Fix the `stopOnFailure` echo (report the effective value or drop the param from the cron URL) | cosmetic | removes a misleading audit field | trivial | `run-rolling-forge-pipeline.ts:1489-1495`, `vercel.json:31` | — |

## Not verified
- Actual durations of stages 1–3, 5–7 and the goalie step (no logs read this session); §2 arithmetic rests on NOTE's ~3 players/s and 36 s/2 games.
- Whether any other writer fills `goalie_start_projections` for future dates (§3d) — Q5 decides.
- cron-report's wording for the pipeline/projection rows (Codex lane; not read beyond classification, cron-report.ts:428-448, 1777-1830, 1951-1957).
- The derived-freshness gates' behaviour on the first in-season days (§3f).
- `start-chart.ts` run pick at ~891 (`limit(1)` after the embed filter) was read in a 36-line window only.
