# W1 — Pipeline inputs and freshness (read-only audit, 2026-10-21)

Scope: what feeds the rolling-metrics writer (`update-rolling-player-averages` → `rolling_player_game_metrics`) and FORGE v2, who produces it, on what schedule, and where coverage is lost before the 10:05Z scheduled pipeline. No code run, no routes called, no DB reads. All line numbers are from the current octoberBranch working tree (which carries uncommitted edits in other files; the files cited below were read as-is).

Lane labels: **Codex** = NST/WGO ingestion routes and `web/lib/nst/**`, `web/lib/cron/nst*` (report only, never "ours"). **Claude** = pipeline orchestrator, rolling writer, FORGE queries. **Ops/TJ** = pg_cron / vercel.json schedule changes (approval required).

---

## 1. Input inventory

Pipeline order and cadence: `web/vercel.json:31-32` runs `/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&includeDownstream=true&includeAccuracy=false&stopOnFailure=false` at `5,10,15,20,30,35,40,45,55 10 * * *` (nine resumable invocations, 180 s budget each: `run-rolling-forge-pipeline.ts:209-243`). Stage order (`web/lib/rollingForgePipeline.ts:50-197`, all blocking except accuracy/monitoring): core_entity_freshness → upstream_skater_sources → contextual_builders → rolling_player_recompute → projection_input_ingest → projection_relationship_build → projection_derived_build → projection_execution → downstream → monitoring.

Implicit (scheduled) window: `parseDateWindow` (`run-rolling-forge-pipeline.ts:189-207`) sets `sourceStartDate = sourceEndDate = rollingStartDate = rollingEndDate = run date − 1` (R11), while `date/startDate/endDate` stay = run date (used by projection_execution).

| Input table(s) | Producer route | Trigger(s) | Window written | Consumer(s) |
|---|---|---|---|---|
| `nst_gamelog_{as,es,5v5,pp,pk}_{counts,rates,counts_oi,rates_oi}` (20 tables/date) | `update-nst-gamelog.ts` (URL matrix `:1540-1569`: 5 strengths × std/oi × counts/rates) | (a) pg_cron job 79 `25 7 * * *` GET no params → `runMode=incremental` automatic scope: whole season aperture from season start to today (`:2514-2546`), bookmark-rotated, **max 6 URLs/run** (`nstBurstPlans.ts:12`, used at `:2720`); (b) pipeline step `upstream_skater_sources` with `runMode=incremental&startDate=endDate=run−1&deadlineAt` (`run-rolling-forge-pipeline.ts:660-675`) → explicit scope, full plan = 20 URLs, `canBurstNstRequests(20)` → interval 0 ms, `maxRequests=20` (`:2712-2720`, `nstBurstPlans.ts:168-177`) | (a) 6 URLs anywhere in the season queue; (b) the completed day | Rolling writer (`fetchRollingPlayerAverages.ts:270-300` STRENGTH_CONFIGS: counts, rates, counts_oi per strength); FORGE skater stage via `rolling_player_game_metrics` + support sidecar |
| `wgo_skater_stats` | `update-wgo-skaters.ts` | pg_cron job 9 `30 7 * * *` `?action=all` (from max stored date + 1, `:1246-1248`); pipeline step `action=all&startDate=run−1` (`run-rolling-forge-pipeline.ts:694-702`; provided date path `:1233-1238`, runs through today `:1230-1231`) | run−1 .. today | Rolling writer (`fetchRollingPlayerAverages.ts` reads `wgo_skater_stats` ×2); FORGE `skater-queries.ts` reads `wgo_skater_stats`; season guard `update-wgo-skaters.ts:387-394` |
| `wgo_skater_totals` (season totals) | `update-wgo-totals.ts` | pg_cron job 14 `40 7 * * *`; pipeline step `season=current` (`:703-710`) | current season | FORGE / player pages (not rolling) |
| `wgo_goalie_stats` | `update-wgo-goalies.ts` | **pg_cron job 8 `35 7 * * *` only** (`?action=all`); not a pipeline step | max date + 1 → today; partial dates skipped on retry (D2, MASTER-TASKLIST:91-96) | FORGE goalie queries (`goalie-queries.ts:220,285`); `build-projection-derived-v2` goalie game prep |
| `wgo_goalie_totals` | `update-wgo-goalie-totals.ts` | pg_cron job 76 `20 8 * * *` | season | goalie serving |
| `lineCombinations` | `update-line-combinations/index.ts` | pg_cron `update-line-combinations-job` `*/25 * * * *` (`count=10`, recent_gap), `update-line-combinations-all` `0 8 * * *`; pipeline `repairMode=historical_backfill&gameIds=<completed games of run−1>` (`run-rolling-forge-pipeline.ts:720-733`) then `verify-line-context` (`:756-775`) | games of run−1 whose start ≥3 h ago (`GAME_COMPLETION_GRACE_MS`, `:243`, `:547-556`) | Rolling writer (`fetchRollingPlayerAverages.ts` reads `lineCombinations`, `powerPlayCombinations`); FORGE `line-combo-queries.ts`; goalie prior from line combos (`goalie-queries.ts:34-59`) |
| `powerPlayCombinations` | `update-power-play-combinations/index.ts` + `[gameId].ts` | pg_cron job 388 `05 8 * * *` with `?startDate=` (**empty value** in inventory `cron-schedule.md:182-187`); pipeline `startDate=endDate=run−1` (`:746-754`); DB trigger URL in `20260716112910_harden_line_combination_trigger_auth.sql:106` | games of run−1; pregame (FUT/PRE) games are skipped not failed (`index.ts:27`, `:107-151`) | Rolling writer PP context; FORGE PP units |
| `games`, `teams`, `players` | `update-games/teams/players` | pg_cron `update-games-job` `0 3 * * *`; pipeline core stage (`:641-657`) | schedule incl. startTime | every stage; `selectCompletedGameIds` depends on `games.startTime` |
| `teamGameStats` | NHL boxscore ingestion (not in this slice) | — | per game | line-combo recent_gap mode requires both teams present (`update-line-combinations/index.ts:262-277`) |
| `nst_team_gamelogs_{as,es,pp,pk}_{counts,rates}` (8 tables/date) | `update-nst-team-daily.ts` (`:102-165`) | pg_cron job 328 `update-nst-team-daily-incremental` `55 9 * * *` (job 275 inactive) | incremental from latest complete date; 8 URLs/date; 10 req paced (A-12 note) | team CTPI (`update-team-ctpi-daily` 10:10Z) |
| `nst_team_all`, `nst_team_stats` | `web/pages/api/Teams/nst-team-stats.ts` | pg_cron job 329 `update-nst-team-stats-all` **`55 10 * * *`** (job 17 inactive) | season-to-date aggregates | FORGE team context (`team-context-queries.ts:329`, `:356`) |
| `wgo_team_stats` | `run-fetch-wgo-data` | pg_cron job 44 `update-wgo-teams` `35 9 * * *` | daily team rows | FORGE team context (`team-context-queries.ts:287`) |
| Projection raw inputs (PbP, shift charts, `nhl_api_game_normalization_status`) | `ingest-projection-inputs.ts` | pg_cron job 363 `45 9 * * *` **and** pipeline step (durable backlog, `:877-891`) | durable game backlog | `build-projection-derived-v2` |
| `forge_goalie_game`, derived v2 tables (`projection_game_materialization_status`) | `build-projection-derived-v2.ts` | pg_cron job 305 `50 9 * * *` **and** pipeline step (`:903-917`) | durable backlog | FORGE goalie stage (`goalie-queries.ts:68-285`) |
| `goalie_start_projections` | `update-goalie-projections-v2.ts` (NHL stats API fetch, writes starts) | pipeline step `limit=7` (`:918-926`) | next 7 game days | FORGE goalie stage (`goalie-queries.ts:367`) |
| `rolling_player_game_metrics` + `rolling_player_metric_support_payloads` | `update-rolling-player-averages.ts` | pg_cron **job 278 `15 8 * * *`** (no params, 180 s + `continueDailyWindow` cursor; the 6 proposed 08:20-08:45Z continuation entries were never applied — CHECKPOINTS §D) **and** pipeline rolling stage (`startDate=endDate=run−1, fastMode, bypassFreshnessBlockers=true`, `:778-876`) | run−1 (pipeline); 14-day window (job 278, per A-05 note) | FORGE `skater-queries.ts` (`rolling_player_game_metrics`) |

Note: `cron-report.ts:66-106` `PRE_CLASSIFICATION_GAME_DATA_ROUTES` is a hand-maintained list of the routes above whose 0-row success is flagged as "expected work" (`:488-499`).

## 2. Timeline (UTC) for yesterday's games vs the 10:05Z pipeline

| Time (UTC) | Event | Status at 10:05Z |
|---|---|---|
| ~00:00-06:30 | Games played; last Pacific games end ~05:30-06:30. NHL API boxscores/WGO final within minutes; NST gamelog pages typically within the hour. | Sources complete |
| 03:00 | `update-games-job` | `games.startTime` for completion detection: fresh |
| 07:25 | pg_cron job 79 `update-nst-gamelog` (6 URLs anywhere in season queue) | **Best-effort / negligible**: 6 of 20 URLs needed per game-day |
| 07:30 / 07:35 / 07:40 | WGO skaters / goalies / totals (`action=all`) | WGO skaters complete for yesterday if 07:30 run succeeded; goalies partial-date risk (D2) |
| 08:00 / 08:05 | line-combos-all; PP combos `?startDate=` (empty) | PP job's effective scope unclear (empty startDate → route returns 400 unless gameIds given, `index.ts:70-75`); lines depend on `teamGameStats` for both teams |
| 08:15 | pg_cron job 278 rolling recompute, 14-day window, 180 s | Pre-pipeline recompute runs with whatever NST/line context landed; A-05: killed after lowest player ids; **superseded by the pipeline's own rolling stage ~10:15-10:40** |
| 08:30 / 08:45 | NST goalies / NST current season (share NST budget) | — |
| 09:35 | `update-wgo-teams` → `wgo_team_stats` | fresh for FORGE team context |
| 09:45 / 09:50 | ingest-projection-inputs, build-forge-derived-v2 (pg_cron) | duplicates of pipeline stages; fine if idempotent |
| 09:55 | `update-nst-team-daily-incremental` (10 paced requests ≈ 189 s) | may still be running at 10:05 and shares the NST hourly budget with the pipeline's 20-URL burst |
| **10:05-10:55** | **Pipeline**: NST 20 URLs for run−1 (burst) → WGO skaters → lines/PP for completed games → verify → rolling (run−1) → ingest/derived → goalie starts → run-projection-v2 (run date, then next day) | — |
| **10:55** | `update-nst-team-stats-all` → `nst_team_all`, `nst_team_stats` | **Structurally late**: FORGE team-context (`team-context-queries.ts:329-362`) reads yesterday's aggregates one day stale |
| 11:30 | run-projection-accuracy | — |

Structurally late or best-effort inputs: (1) NST gamelog via pg_cron (6 URLs); (2) `nst_team_all` (10:55Z, after FORGE); (3) WGO goalies (no pipeline step; D2 skip); (4) line combos for games whose `teamGameStats` lag (pipeline now uses `historical_backfill` by gameIds which bypasses the two-team check, so this is mitigated for the run−1 date; the `*/25` job still has the race); (5) job 278 rolling recompute runs 2 hours before the NST/line context it needs.

## 3. Gap mechanisms, ranked by rolling/FORGE coverage cost

### G1 — NST gamelog backlog (largest; lane: Codex for route/lib, Ops for cadence)
Request math:
- URLs per game-day = 20 (`update-nst-gamelog.ts:1542-1569`; all 20 dataset types are in the automatic scope, `:2538`). Rolling needs 15 of them (counts, rates, counts_oi for 5 strengths, `fetchRollingPlayerAverages.ts:270-300`); FORGE reads only ev/pp/all rolling rows plus sidecar.
- Queue order within a date: all, 5v5, ev, pp, pk × (std counts, std rates, oi counts, oi rates). A 6-URL run that lands at the start of a date covers AS ×4 + 5v5 counts/rates and never reaches ES/PP that day — consistent with "ES/5v5/PP tables unreached since 10-02" (prior evidence; hits/blocks note §1).
- pg_cron job 79 processes **6 URLs/day** (`NST_STRICT_MAX_URLS_PER_RUN`, `nstBurstPlans.ts:12`, `:2720`) against a queue that grows **20 URLs per game-day**. Net backlog growth ≈ +14 URLs per game-day. **Not clearable at this cadence; it diverges.** 374 deferred URLs (10-19 evidence) would take 62 days even if the season froze.
- Rate-limit ceilings (`nstRateLimitPolicy.ts:24-30`): 40/1m, 80/5m, 100/15m, 180/h. At the 21 s pacing (`:33`) the throughput cap is 171/h; the binding limit is 100/15 min (21 s spacing gives 43/15 min, fine). A 240 s Vercel function at 21 s spacing fits ≈10-11 URLs (`maxRuntimeMs` ≤ 220 000, route header `:63-64`).
- Pipeline step (since R11) requests the completed day explicitly: 20 URLs, burst allowed (`canBurstNstRequests(20)` → 0 ms interval), `maxRequests = 20`. If it succeeds daily, **yesterday is fully covered going forward** and the backlog is only the 10-02..10-20 hole. But: (i) D1 says this burst violates the 21 s rule (zero delay for ≤39 URLs, `nstBurstPlans.ts:165-177`, `requestBudget.ts:103-104`); (ii) it shares the hourly 180 budget with `update-nst-team-daily-incremental` at 09:55Z (≤10 req) and `update-nst-team-stats-all` at 10:55Z; (iii) it is gated by the stage deadline (`NST_DEADLINE_HEADROOM_MS`, `:415-460`) and `nstStepResume.enabled` is **off** (diary 2026-10-21), so a 207 continuation blocks the stage instead of resuming.
- Clearing cadence (for the backlog hole, ~380 URLs): at 11 URLs per invocation and 21 s pacing, a pg_cron chain every 5 min yields 132 URLs/h (within 180/h; 33/15 min ≤100; 22/5 min ≤80) → ~3 h to clear, then 2 invocations/day keep up (20 URLs/day). Must be sequenced away from 07:25/08:30/08:45/09:55/10:05-10:55/10:55 NST consumers (`nstCoordination.ts:18-24` lists starts but not the pipeline's burst). **Proposal (structural, lane Codex + Ops approval):** replace the single 6-URL daily job with an explicit-scope chain (`runMode=incremental&startDate=<hole start>&endDate=<hole end>&cursor=…`) honouring 21 s; expected impact: restores EV/PP/5v5 inputs for every rolling metric; effort M; risk: NST key throttling if any other job overlaps; verification: `cron_job_audit` rows for `update-nst-gamelog` with `details.nstProgress.continuation.nextIndex` advancing, then SQL-C below.
- **Quick-win (lane Codex):** reorder the per-date URL matrix so ES and PP counts precede AS rates/oi (rolling and FORGE need counts first); effort S; risk low (dataset keys unchanged); verify with the existing `update-nst-gamelog.test.ts` URL-order assertions.

### G2 — NST-only metrics at ev/pp (coverage amplifier; lane Claude)
See §4. Every ev/pp rolling metric except goals(pp) has no WGO fallback, so G1 zeroes or thins them. FORGE's hits/blocks fix (F2/F3 in the hits-blocks note §6) is local/uncommitted; shots/goals/assists/PP heads remain exposed.

### G3 — Pre-R11 date shift and the UTC shift (historical hole; lane Codex for reverse mode)
Before R11 the implicit run passed the run date, so NST/WGO/PP steps targeted a day with no completed games (diary 2026-10-21 "Findings"). Fixed in `parseDateWindow` (`:193-206`). `formatEstDate(parseISO(date))` X→X−1 remains in **reverse** mode only (A-12 note, CHECKPOINTS §D); TJ's manual catch-up may have landed a day early (unverified). Impact: the 10-02..10-20 hole; no ongoing loss.

### G4 — PP combos skip FUT/PRE games (mitigated; lane Claude)
Route treats pregame as skipped not failed (`update-power-play-combinations/index.ts:27`, `:107-151`); pipeline now passes run−1 so all games are final. Residual: pg_cron job 388 runs with `?startDate=` empty → route 400 (`index.ts:70-75`) unless the inventory text is truncated. **Quick-win (Ops):** confirm job 388's command text; if empty, fix or disable since the pipeline covers it. Verify via SQL-D.

### G5 — Line-combo race (mitigated for run−1; residual for the `*/25` job)
`recent_gap` requires both teams in `teamGameStats` (`update-line-combinations/index.ts:262-277`); pipeline uses `historical_backfill&gameIds` (`:720-733`) and verifies (`:756-775`), retrying once (`contextualFailedAttempts`). Residual cost: games whose Gamecenter feed is unavailable are "skipped" (`:228-233`) and degrade rolling for both rosters ("continuing with degraded line context", `:773`).

### G6 — WGO season-label corruption (contained)
Writer guard `update-wgo-skaters.ts:387-394` released R6d; 253k mislabelled historical rows remain (CHECKPOINTS §D). Rolling/FORGE readers must bound by date; `skater-queries.ts` reads `wgo_skater_stats` — not re-verified here whether it is date-bounded (out of scope).

### G7 — New: `nst_team_all`/`nst_team_stats` refreshed at 10:55Z, after FORGE
`update-nst-team-stats-all` (job 329) runs 50 min after the pipeline starts; FORGE team context (`team-context-queries.ts:329-362`) therefore uses day−2 aggregates. **Quick-win (Ops):** move job 329 to ~09:15Z (after 08:45 NST current-season, ≥10 min gap per `NST_MIN_CRON_BURST_GAP_MS`, `nstCoordination.ts:16`) — needs NST budget check; effort S; risk: NST window overlap with 09:55 team-daily if it runs long.

### G8 — New: duplicate pre-pipeline producers
Job 278 (08:15Z rolling), 363 (09:45 ingest), 305 (09:50 derived) duplicate pipeline stages 2 h earlier with inferior inputs. Job 278 in particular writes 14-day rolling rows before NST/lines land, then the pipeline rewrites run−1 only; days −2..−14 keep the 08:15 values. Cost: Vercel CPU and audit noise; coverage impact neutral-to-negative. **Structural (Ops/TJ):** retire 278/363/305 once the pipeline's resumable stages are trusted; verify with SQL-B before/after.

### G9 — WGO goalies not in pipeline; partial-date skip (D2; lane Codex)
Only job 8 at 07:35Z; a partially written date is skipped on retry (MASTER-TASKLIST:91-96). Cost: missing goalie games → FORGE goalie priors thin. Structural; D2 owns it.

## 4. NST-only rolling metrics (blank/thin when NST lags)
From `web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts`:

| Metric | all | ev / 5v5 / pk | pp |
|---|---|---|---|
| points (`:46-54`) | WGO fallback | **NST only** | **NST only** |
| shots (`:56-64`) | WGO fallback | **NST only** | **NST only** |
| goals (`:66-77`) | WGO fallback | **NST only** | WGO `pp_goals` fallback |
| assists / primary / secondary (`:79-111`) | WGO fallback | **NST only** | **NST only** |
| penalties drawn / taken (`:113-123`) | **NST only** | **NST only** | **NST only** |
| hits, blocks (`:125-143`) | WGO fallback | **NST only** | **NST only** |
| PP points (`:145-153`) | WGO `pp_points` | — | **NST only** (`counts.total_points` at pp) |
| ixG (`:155-161`, `resolveIxgValue`) | WGO ixg fallback (per helper) | NST only (by helper signature) | NST only |
| on-ice xG / rates / TOI (counts_oi, rates tables) | NST only (no WGO equivalent in STRENGTH_CONFIGS) | NST only | NST only |

So with NST lagging: every ev/pp/5v5/pk row is thin for shots, goals, assists, points, hits, blocks, penalties, PP heads, ixG and all on-ice metrics; only `all` rows and `pp` goals/PP points survive via WGO. FORGE's skater stage reads ev/pp rolling rows (hits-blocks note §1), so its EV/PP shot and point rates are exposed exactly as hits/blocks were.

## 5. Observability — proposed read-only SQL (not run; for TJ approval)
`cron_job_audit(job_name text, run_time timestamptz, status text, rows_affected int, details jsonb)` (`20260716112908_production_schema_baseline.sql:7247-7253`); `details` carries `statusCode, durationMs, rowsUpserted, url, response, nstProgress` (`withCronJobAudit.ts:370-390`).

```sql
-- SQL-A: NST gamelog coverage per game-date vs WGO skater-games (2026-27), per strength table
with gd as (
  select date::date d, count(*) games from games
  where "seasonId" = 20262027 and type = 2 and date >= '2026-10-07' and date < current_date
  group by 1),
w as (select date::date d, count(*) wgo_rows from wgo_skater_stats
      where date >= '2026-10-07' and date < current_date group by 1),
n as (
  select d, 'as' k, count(*) c from (select date_scraped::date d from nst_gamelog_as_counts where date_scraped >= '2026-10-07') x group by 1
  union all select d, 'es', count(*) from (select date_scraped::date d from nst_gamelog_es_counts where date_scraped >= '2026-10-07') x group by 1
  union all select d, 'pp', count(*) from (select date_scraped::date d from nst_gamelog_pp_counts where date_scraped >= '2026-10-07') x group by 1
  union all select d, '5v5', count(*) from (select date_scraped::date d from nst_gamelog_5v5_counts where date_scraped >= '2026-10-07') x group by 1)
select gd.d, gd.games, w.wgo_rows,
       sum(c) filter (where k='as') nst_as, sum(c) filter (where k='es') nst_es,
       sum(c) filter (where k='pp') nst_pp, sum(c) filter (where k='5v5') nst_5v5
from gd left join w using (d) left join n using (d)
group by 1,2,3 order by 1;

-- SQL-B: rolling rows written per game_date and strength vs skater-games (expect ≈ wgo_rows per strength)
select r.game_date, r.strength_state, count(*) rolling_rows, max(r.updated_at) last_write
from rolling_player_game_metrics r
where r.game_date >= '2026-10-07' and r.game_date < current_date
group by 1,2 order by 1,2;

-- SQL-C: NST gamelog run ledger — URLs attempted/deferred and continuation cursor per run (last 14 days)
select run_time, status, rows_affected,
       details->>'statusCode' http, details->>'durationMs' ms,
       details->'response'->>'deferredUrls' deferred,
       details->'nstProgress'->'continuation'->>'nextIndex' next_idx,
       details->'nstProgress'->'continuation'->>'totalUrls' total_urls,
       left(details->>'url', 160) url
from cron_job_audit
where job_name = 'update-nst-gamelog' and run_time > now() - interval '14 days'
order by run_time desc;

-- SQL-D: line / PP context coverage per completed game-date (both teams present?)
with g as (select id, date::date d from games where "seasonId" = 20262027 and type = 2 and date >= '2026-10-07' and date < current_date),
l as (select "gameId", count(distinct "teamId") teams from "lineCombinations" group by 1),
p as (select "gameId", count(distinct "teamId") teams from "powerPlayCombinations" group by 1)
select g.d, count(*) games,
       count(*) filter (where coalesce(l.teams,0) >= 2) games_with_lines,
       count(*) filter (where coalesce(p.teams,0) >= 2) games_with_pp
from g left join l on l."gameId" = g.id left join p on p."gameId" = g.id
group by 1 order by 1;
```
Column names (`date_scraped`, `game_date`, `updated_at`, `"seasonId"`, `type`) are taken from the route code; TJ should confirm against the schema before running (`updated_at` is set only on insert per CHECKPOINTS §D, so SQL-B's `last_write` understates rewrites).

## 6. Proposals summary

| # | Proposal | Type | Impact | Effort | Risk | Lane | Verification |
|---|---|---|---|---|---|---|---|
| P1 | Explicit-scope NST backfill chain for 10-02..10-20 at 21 s pacing, ~11 URLs/invocation, every 5 min outside other NST jobs | structural | restores all ev/pp/5v5/pk inputs | M | NST throttle if overlapping | Codex + Ops | SQL-A/C before/after |
| P2 | Reorder NST per-date URL matrix: counts (ES, PP, AS) first | quick-win | 6-URL job becomes useful | S | low | Codex | route URL-order test |
| P3 | Enable `nstStepResume` once Codex ships the 207 contract (D1) so the pipeline's 20-URL day never blocks | structural | daily coverage certainty | S (consumer built) | needs 21 s pacing (D1) | Claude + Codex | pipeline test 34/34 (diary) |
| P4 | Move job 329 `update-nst-team-stats-all` before 10:05Z (≈09:15Z) | quick-win | FORGE team context day-fresh | S | NST window overlap | Ops | `cron_job_audit` run_time; team-context asOf rows |
| P5 | Retire duplicate pre-pipeline jobs 278/363/305 (or make 278 run−1-bounded) | structural | removes stale 14-day rewrite and CPU | S | losing a fallback if pipeline fails | Ops/TJ | SQL-B; cron-report |
| P6 | Confirm/fix job 388 PP-combos empty `startDate=` | quick-win | removes a daily 400 | S | none | Ops | `cron_job_audit` statusCode |
| P7 | Add WGO fallback at ev/pp for shots/goals/assists/points in `rollingPlayerSourceSelection` is **not** possible (WGO has no per-strength counts except pp_goals/pp_points); instead FORGE should read `all`-strength rows for shots/points as done for hits/blocks | structural | FORGE SOG/points robust to NST lag | M | model-quality change | Claude | extend `runProjectionV2.test.ts` |
| P8 | Add D2 WGO-goalie recovery (partial-date retry) | structural | goalie priors complete | M | — | Codex | fixture per MASTER-TASKLIST D2 |

## 7. Not verified / limits
- No production reads: current backlog size, job 278/388 live command text, and whether the R11/R12 pipeline NST step has actually completed 20 URLs on any day are unverified (SQL-A/C answer this).
- `web/lib/rollingPlayerSourceSelection.ts` does not exist at that path; the module is `web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts`.
- `resolveIxgValue` internals (`rollingPlayerMetricMath.ts`) not read; ixG row above inferred from the call signature.
- `wgo_team_stats` producer `run-fetch-wgo-data` not read.
- `cron-schedule.md` is a hand-maintained inventory, not `cron.job`; schedules/active flags could have drifted.
