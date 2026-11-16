# FORGE player projection pipeline: blind audit (2026-11-16)

Auditor: independent, blind. Evidence is code at `octoberBranch` HEAD `8aaf71545`, released `master` `5c42cb14f`
(read with `git show` / `git diff`), and read-only production SQL through `ro_sql.py`. Every query and its raw result
is saved under `blind/sql/NNN.{sql,csv}` (numbered from 020). The first 16 statements ran before the wrapper saved
results; the ones this report relies on were re-run and saved as sql 084-089. Paths are relative to the repository root unless they start with `web/`.

Reading order: §1 map, §2 measurements (§2.7 sits after §4), §3 reconciliation, §4 filters and normalisations, §5 freshness,
§6 load paths, §7 failure states, §8 findings, §9 optimisations, §10 open questions, §11 gaps. Times are UTC.

Branch note: `git diff --stat 5c42cb14f HEAD -- web supabase` shows no change to any projection pipeline, API or
consumer file. The only FORGE-adjacent differences are `web/lib/projections/pregameCapture/slateQueue.ts` (out of
scope) and one unapplied index migration (`supabase/migrations/…forge_physical_totals_covering_index.sql`). Unless a
finding says otherwise it applies to **both** `master` and `octoberBranch`. Production rows of 11-13 were written by
SHA `e1ab46318e` (2026-11-12 20:48 -05:00, stamped on the rows), an ancestor of `5c42cb14f`. Between those two
commits the producer itself changed (`git diff --stat e1ab46318e 5c42cb14f`: `run-forge-projections.ts` 380 lines,
`stages/skater-stage.ts` 638, `stages/goalie-stage.ts` 298, `lib/cron/withCronJobAudit.ts` 50, …) while
`verifiedForgeReleases.ts`, `scenario-blending.ts`, `reconcile.ts`, the constants and `pages/api/v1/forge/*` did
not. Which SHA was live on which day is inferred from stamps and schedules, not read from deployment records.

---

## 1. Pipeline map

### 1.1 Schedulers (three independent ones)

| Scheduler | Where defined | What it triggers for FORGE |
|---|---|---|
| Vercel cron | `web/vercel.json:33-36` | `/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental…` at 10:05, :10, :15, :20, :30, :35, :40, :45, :55 UTC (nine slots; one resumable run per ET date) |
| Vercel cron | `web/vercel.json:125-132` | `forge-served-forecast-settle` 11:00 UTC, `forge-served-forecast-snapshot` 12:40 UTC |
| Vercel cron | `web/vercel.json:13-16` | `/api/internal/starter-board` every minute (board/revision dispatcher) |
| Vercel cron | `web/vercel.json:137-140` | `cron/update-roster-optimizer-schedule-daily` 08:52 and 14:52 UTC (RSO schedule cache; no FORGE dependency) |
| pg_cron (Supabase) | `cron.job` (sql 084) | Standalone copies of pipeline steps: job 363 `ingest-projection-inputs` 09:45, 364 `update-goalie-projections-v2` 09:30, 305 `build-projection-derived-v2` 10:25, 361 `run-projection-accuracy` 11:30, 16 `update-shifts` 09:55, 24 `update-line-combinations` 08:00, 1 `update-line-combinations?count=10` every 25 min, 388 `update-power-play-combinations` 08:05, 9 `update-wgo-skaters` 07:30, 14 `update-wgo-totals` 07:40, 6 `update-players` 02:00, 7 `update-games` 03:00, 278 `update-rolling-player-averages` Sundays 08:15. Job 308 (`run-projection-v2` 10:05) is **inactive**. |
| pg_cron | job 399 | `route-runner-tick` every minute (operator-queued routes) |

### 1.2 Stages of the scheduled run

Coordinator: `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` (`handler` :1535, `runResumablePipeline` :1237,
`runStage` :642). Stage order is `ROLLING_FORGE_PIPELINE_ORDER` in `web/lib/rollingForgePipeline.ts:48-197`.
Progress is one row per stage in `projection_pipeline_state` keyed
(`rolling_forge_pipeline`, `daily_incremental:<ET date>`, `<stage id>`) (`web/lib/rollingForgePipelineRunState.ts:16-28`).
Each invocation has a 180 s work budget inside the 240 s Vercel limit (`run-rolling-forge-pipeline.ts:241-258`).
"Run date" D is today in ET (`:186-198`); played-game steps use D-1 (`:218-239`).

| # | Stage (id) | Entry point | Inputs | Outputs |
|---|---|---|---|---|
| 1 | core_entity_freshness | `web/pages/api/v1/db/update-games.ts:158`, `update-teams.ts:132`, `update-players.ts:64` (skippable in daily) | NHL API | `games`, `teams`, `players`, `rosters` |
| 2 | upstream_skater_sources | `web/pages/api/v1/db/update-nst-gamelog.ts:3256`, `update-wgo-skaters.ts:2235`, `update-wgo-totals.ts:857` | Natural Stat Trick, NHL stats API | `nst_gamelog_*`, `wgo_skater_stats`, `wgo_skater_stats_totals` |
| 3 | contextual_builders | `update-line-combinations/index.ts:162`, `update-power-play-combinations/index.ts:105` | NHL shift/PBP | `lineCombinations`, `powerPlayCombinations` |
| 4 | rolling_player_recompute | `update-rolling-player-averages.ts:1121` (chunked, cursor = player id) | stage 2+3 tables | `rolling_player_game_metrics` (pk player_id, game_date, strength_state) |
| 5 | projection_input_ingest | `ingest-projection-inputs.ts:851` (`ingestProjectionInputsHandler` :242) | NHL gamecenter PBP + shift charts | `pbp_games`, `pbp_plays`, `shift_charts` |
| 6 | projection_relationship_build | `shift-charts.ts:1444` | `shift_charts` | relationship-owned columns of `shift_charts` |
| 7 | projection_derived_build | `build-projection-derived-v2.ts:571` (window D-7..D-1, `run-rolling-forge-pipeline.ts:695-700`) | pbp + shifts | `forge_player_game_strength`, `forge_team_game_strength`, `forge_goalie_game`, `projection_game_materialization_status` |
| 8a | projection_execution: goalie priors | `update-goalie-projections-v2.ts:548` | goalie history, `games` | `goalie_start_projections` (pk game_id, player_id) |
| 8b | projection_execution: FORGE run | `run-projection-v2.ts:1860` (`handler` :1049, preflight :554) → `web/lib/projections/run-forge-projections.ts` `runProjectionCalculations` :901 → `stages/preflight-stage.ts:164`, `stages/skater-stage.ts:4046`, `stages/goalie-stage.ts:1062`, `stages/persistence-stage.ts:7-60` | all of the above plus `rosters`, `players`, trend bands, market tables, `forge_roster_events`, board evidence | `forge_runs` (run_id, as_of_date, status, git_sha, metrics), `forge_player_projections` (pk run_id, game_id, player_id, horizon_games), `forge_team_projections`, `forge_goalie_projections`, `forge_reserve_projections` (flag-gated). One run **per date**: D, then D+1…D+N (`forgeProjectionDaysAhead`, `run-rolling-forge-pipeline.ts:205-210`, N from env `FORGE_PROJECTION_DAYS_AHEAD`, max 6) |
| 9 | downstream_projection_consumers | `run-projection-accuracy.ts:2711` (cron passes `includeAccuracy=false`, so the stage is a no-op in the pipeline; pg_cron 361 runs it at 11:30) | FORGE rows + actuals | `forge_projection_results`, `forge_projection_accuracy_*`, `forge_projection_calibration_daily` |
| 10 | monitoring | `web/pages/api/v1/db/cron-report.ts:2656` (also Vercel cron 13:00 UTC, `vercel.json:133-136`) | `cron_job_audit` | report email, `cron_job_report` |

Side stages outside the coordinator:

| Stage | Entry | Tables |
|---|---|---|
| Served-forecast ledger | `forge-served-forecast-snapshot.ts:165` (12:40 UTC), `forge-served-forecast-settle.ts:108` (11:00 UTC) | `forge_served_forecast_ledger`, `forge_served_forecast_universe`, `forge_served_forecast_scoreboard_daily` |
| Starter board / revisions | `web/pages/api/internal/starter-board.ts:9` (every minute) → queue in `forge_game_update_queue` → per-game `selected_games` FORGE runs → `forge_game_revisions`, `forge_final_pregame_revisions`, `forge_game_selection_events`, `forge_board_*`; read through RPC `read_forge_game_revisions` (`supabase/migrations/20261004181455_forge_public_revision_reader.sql`) |
| Roster events | `web/pages/api/v1/forge/roster-events.ts` (admin CRUD) | `forge_roster_events` (read by preflight) |
| Native catalogue / player-forecast jobs (dormant for pages) | pg_cron 394 `player-forecasts/jobs/daily` 10:00, 396 `…/settle` hourly, 397 `…/drain?dryRun=true` every 5 min (`web/pages/api/v1/player-forecasts/jobs/daily.ts:7`, `settle.ts:6`, `drain.ts:11`) | `player_forecast_*` tables. Pages switch to it only when `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` is set (`web/lib/player-forecasts/forecastServingSource.ts:61-78`); today's snapshot shows `native: 0` (sql 089), so it serves nothing. Not audited further. |
| Operator route runner | pg_cron 399 → `web/pages/api/v1/db/route-runner-tick.ts:42-69` | runs operator-queued routes from `route_runner_jobs`; not part of the daily chain |

### 1.3 Read paths per consumer page (detail in §6)

| Page | API route(s) | FORGE tables read | Run selection |
|---|---|---|---|
| `/start-chart` (`web/pages/start-chart.tsx`) | `/api/v1/start-chart` (`web/pages/api/v1/start-chart.ts`) | `forge_runs` + `forge_player_projections`, `goalie_start_projections`, or revisions RPC | newest released h1 run with external-input proof for the ET date (`start-chart.ts:900-910`), or admitted game revisions when `STARTER_BOARD_SERVING_ENABLED` |
| `/FORGE` (`web/pages/FORGE.tsx`) | start-chart, `/api/v1/forge/players?horizon=1` | as above + `forge_player_projections` | `forge/players.ts:297` latest proven run for date, else fallback scan |
| `/forge/command-center` | start-chart, `forge/players`, `forge/goalies`, `runs/latest` | + `forge_goalie_projections`, `forge_runs` | per route |
| `/forge/player/[playerId]`, `/forge/team/[teamId]` | `forge/players`, start-chart | same | same |
| `/forge/forecasts` | `/api/v1/forge/forecasts` | via `loadGameExpectations` → planning data (bridge or revisions) | same as RSO |
| `/trends` | dashboard fetchers → `forge/players`, `forge/goalies` | same | same |
| `/game-grid/*` | `/api/v1/projections/teams`, `forge/goalies?view=game-grid` | `forge_team_projections`, `forge_goalie_projections` | newest proven h1 run for date, no fallback |
| `/roster-schedule-optimizer` | `/api/v1/roster-schedule-optimizer/data` (or `/yahoo-current-data`, `/provider`) → `web/lib/rosterScheduleData/planning.ts` → `forgeDailyBridge.ts:857-924` | `forge_runs` (±7 days), `forge_player_projections`, `forge_goalie_projections`, `forge_reserve_projections` | newest proven released h1 run **per as_of_date** in a 15-day window; older days re-aimed |
| `/nhl-predictions` (indirect) | game-prediction feature builder | `forge_team_projections` | model feature |

---

## 2. Measurements (running log)

### 2.1 Run cadence (sql 085, 086, 023)

`forge_runs` created per UTC day, last 30 days: runs exist for creation dates 10-19…10-31, 11-02, 11-03, 11-05, 11-06,
11-07, 11-09, 11-13. **No run was created on 11-01, 11-04, 11-08, 11-10, 11-11, 11-12 (scheduled), 11-14, 11-15 or
11-16.** The newest row in `forge_runs` was created 2026-11-13 10:41 UTC.

Latest succeeded run per slate date vs scheduled games (023):

| as_of_date | games in `games` | latest run created (UTC) | run games | player rows | goalie rows | eligible skaters | no-projection ("unknown") | min skaters/team | scope |
|---|---|---|---|---|---|---|---|---|---|
| 11-12 | 11 | 11-13 01:40 | **1** | 36 | 2 | 89 | 53 | 18 | selected_games |
| 11-13 | 2 | 11-13 10:20 | 2 | 72 | 4 | 143 | 71 | 18 | full_slate |
| 11-14 | 14 | 11-13 10:21 | 14 | 500 | 28 | 1042 | 542 | 15 | full_slate |
| 11-15 | 5 | 11-13 10:31 | 5 | 179 | 10 | 388 | 209 | 17 | full_slate |
| **11-16 (today)** | 2 | **11-13 10:33** | 2 | 69 | 4 | 132 | 63 | 15 | full_slate |
| 11-17 | 11 | 11-13 10:35 | 11 | 395 | 22 | 845 | 450 | 17 | full_slate |
| 11-18 | 3 | 11-13 10:40 | 3 | 105 | 6 | 215 | 110 | 15 | full_slate |
| 11-19 | 12 | 11-13 10:41 | 12 | 431 | 24 | 898 | 467 | 17 | full_slate |
| 11-21 | 14 | none | | | | | | | |
| 11-22 | 5 | none | | | | | | | |
| 11-23 | 7 | none | | | | | | | |

### 2.2 Pipeline stage state, last 8 days (sql 087)

| Run date | Furthest stage | Terminal state |
|---|---|---|
| 11-09 | monitoring | complete (10:36) |
| 11-10 | upstream_skater_sources | `running`, rev 1, never released |
| 11-11 | upstream_skater_sources | `running`, rev 1, never released |
| 11-12 | upstream_skater_sources | `running`, rev 1, never released |
| 11-13 | monitoring | complete (10:46) |
| 11-14 | projection_input_ingest | `failed`, `stage_failed:attempt-2` |
| 11-15 | projection_input_ingest | `failed`, `stage_failed:attempt-2` |
| 11-16 | projection_execution | `running`, rev 1 since 10:20:34, no goalie-step row, no `forge_runs` row |

The scheduled pipeline completed on 2 of the last 8 days.


### 2.3 Pipeline completion, last 28 run dates (sql 029)

Complete (all 11 stage rows `complete`): 10-22 … 10-31 (10 days), 11-02, 11-03, 11-09, 11-13.
Not complete: 10-20, 10-21 (stage left `running`), 11-01, 11-04, 11-08, 11-10, 11-11, 11-12
(`upstream_skater_sources=running`, last update 10:05), 11-05, 11-06, 11-07
(`projection_execution=failed(stage_failed:attempt-2)`), 11-14, 11-15
(`projection_input_ingest=failed(stage_failed:attempt-2)`), 11-16 (`projection_execution=running`).
**Since 11-01 the scheduled run completed on 4 of 16 days**, with four different stop modes.

### 2.4 What stopped each recent day (cron_job_audit; sql 024, 026, 027, 030, 031, 088)

- **11-16 (today):** invocation of 10:20:29 took `projection_execution` at 10:20:34 and never answered. No audit row
  exists for that invocation, for `update-goalie-projections-v2` or for `run-projection-v2` after 10:20:34, and no
  `projection_execution:goalie` marker row was written. Every later slot (10:30, :35, :40, :45, :55) returned in
  under 0.4 s with `terminalStop.code = stage_handoff_unconfirmed`, "Stage invocation ended without an acknowledged
  handoff; reconcile child outputs and audit before an operator authorizes resumption." No FORGE run was written.
- **11-14 and 11-15:** `ingest-projection-inputs` failed on one game each day
  (`precheck_shifts`: "Shift clock/duration mismatch for game 2026020310, player 8480947; period=1 start_s=0
  end_s=481 duration_s=470" on 11-14; game 2026020318, player 8479292 on 11-15). The pipeline tried twice
  (10:15:51 and 10:20:29 on 11-14; 10:21:35 and 10:31:23 on 11-15) and stopped. The pg_cron copy of the same route
  (job 363, 09:45) "isolated" each game only two days after its game date (11-15 09:45 for the 11-13 game,
  11-16 09:45 for the 11-14 game).
- **11-10, 11-11, 11-12:** killed inside `upstream_skater_sources` after the WGO skater step (11-12: NST 10:05:55,
  WGO skaters 10:07:20, then nothing; 10:10 slot returned `stage_handoff_unconfirmed`).
- **11-05, 11-06, 11-07:** `update-goalie-projections-v2` failed twice per day with
  "Goalie projection writes were incomplete: 0 upserted, 227 failed … ON CONFLICT DO UPDATE command cannot affect row
  a second time". FORGE runs for D..D+3 were still written (11-06: as_of 11-06..11-09), then D+4..D+6 failed
  preflight ("Preflight freshness checks failed") and the stage was marked failed.

### 2.5 Timing of a complete execution stage (11-13; sql 026)

Goalie step 7.8 s. FORGE runs: 11-13 (2 games) 44.6 s; 11-14 (14 games) 107.6 s for 8 games then 71.8 s for 6;
11-15 (5 games) 69.6 s; 11-16 (2 games) 27.9 s + 19.8 s; 11-17 (11 games) 142.3 s; 11-18 (3) 52.6 s; 11-19 (12)
108.2 s + 51.5 s. About 12-13 s per game, 675 s of projection work for 49 games, spread over five invocations (10:20, 10:30,
10:35, 10:40, 10:45), finishing 10:46. The cron has nine slots ending 10:55, so one slot (10:55) was spare.

### 2.6 Run provenance and what readers will serve (sql 041, 042, 043, 044)

Readers serve a run only if it is "proven" (`web/lib/projections/externalInputProof.ts:80-98,102-123`): a captured
input snapshot, or a producer-closure hash listed in `VERIFIED_FORGE_PRODUCER_CLOSURES`
(`web/lib/projections/verifiedForgeReleases.ts:46-145`).

| Runs created | git_sha | stamped closure | snapshot rows | in verified list at master 5c42cb14f / HEAD? |
|---|---|---|---|---|
| 11-09 (as_of 11-09..11-15), 7 runs | a5816ce6d1 | 9b1821ff… | 0 | yes (`verifiedForgeReleases.ts:122`) |
| 11-13 01:40 (as_of 11-12, 1 game, `selected_games`) | 502a93b4c9 | ee3f3ea3… | 1 | no closure entry; judged by snapshot |
| **11-13 10:20-10:46 (as_of 11-13..11-19), 7 runs** | e1ab46318e | **ee5581d9…** | 0 | **no** (`grep ee5581d9` finds nothing in either tree) |
| 11-02/11-03 (14 runs), 11-06 (4 runs), cron-time | `local:unknown` | f87dd707…, ec5bdab6… | n/a | closure listed, but `git_sha` is `local:` so `excludeOffReleaseRuns` (`releasedRunFence.ts:10-12`) drops them |

Production's own 12:40 UTC snapshot job confirms the effect today (sql 043): `countsBySource` =
`bridge_exact 0, bridge_reaimed 70, naive_last5 99, naive_season 99`, with the limitation text "each player's latest
FORGE v2 daily line (runs 2026-11-09 to 2026-11-15) stands in for his remaining games" and "7 FORGE runs in the last
week cannot prove they excluded third-party fantasy projections, so they are withheld". On 11-15 it was
`bridge_exact 175` from the 11-09 runs (sql 044). The 11:30 accuracy job failed today with "Selected projection run
lacks external fantasy exclusion provenance." (sql 088).

So for every game not yet played, the newest rows any proof-gated reader can serve were **computed 2026-11-09
10:16-10:36 UTC**, and no proven run exists for any slate date after 11-15. The one newer proven run is the
single-game rerun for 11-12 (`328a982a`, created 11-13 01:40, game 2026020308, already played).

---

## 3. Population reconciliation

"Most recent run" is defined two ways, because they differ today:
- **R-new** = `26373189-3ebd-4380-b4f4-c6797d469ca9`, the newest succeeded run for today's slate (as_of 2026-11-16,
  created 2026-11-13 10:33 UTC, 2 games: 2026020331 teams 3 v 8, 2026020332 teams 68 v 23).
- **R-served** = what proof-gated readers can actually serve today (runs created 2026-11-09).

### 3.1 R-new, stage by stage (skaters)

| Boundary | Count | Drop | Rule (file:line) | Evidence |
|---|---|---|---|---|
| Scheduled games on 11-16 | 2 games, 4 teams | | `stages/preflight-stage.ts:173-183` (`games.date = asOfDate`) | sql 051 |
| Current-roster skaters of the 4 teams (the run's "eligible" universe) | 132 (29+38+24+41) | | `queries/skater-queries.ts` `fetchCurrentRosterPlayerIds`, called `stages/skater-stage.ts:1530-1535` | sql 052; `metrics.data_quality.skater_coverage_eligible = 132` (sql 021) |
| Skaters in each team's latest `lineCombinations` row (the lineup source) | 72 (18 x 4) | 60 roster skaters not dressed in the team's last game | `skater-stage.ts:1528-1529` (lineup = `forwards` + `defensemen` of the latest row) | sql 053 |
| After "must be on the current roster" | 69 | **3** (Utah: 8481827, 8483436, 8481708 have no `rosters` row for 20262027 although they dressed 11-12 and 11-14) | `skater-stage.ts:472-492` `constrainSkaterIdsToActiveRoster`, applied `:1588-1591`. **No counter records this drop.** | sql 053, 055, 056 |
| After team/position, missing-metrics, hard-stale (45 d), unavailable, EV/PP gate | 69 | 0 | `skater-stage.ts:919-1000`, `:1706-1711`, `:2826-2829` | metrics: `filtered_skater_team_or_position 0`, `filtered_skater_missing_metrics 0`, `filtered_skater_hard_stale 0`, `skater_unavailable_filtered 0`, `skater_pool_players_dropped_no_ev_pp_gate 0` |
| Reserve ("if he dresses") lines for the other roster skaters | 0 | 63 marked `unknown`, reason `reserve_pass_disabled` | `reserveProjections.ts:25-27` (`FORGE_RESERVE_PASS_ENABLED` not "true"); `skater-stage.ts:4036` | `skater_coverage_unknown 63`; `forge_reserve_projections` has 0 rows since 11-01 (sql 035) |
| Rows written to `forge_player_projections` | **69** (18, 18, 18, 15) | | `stages/persistence-stage.ts:7-19` | sql 052, 059 |
| Served by any proof-gated reader | **0** | 69 | `externalInputProof.ts:80-98` + `verifiedForgeReleases.ts:46-145`: closure `ee5581d9…` unlisted | §2.6 |

Goalies, R-new: 17 roster goalies on the 4 teams (sql 052) → 10 `goalie_start_projections` rows (4+2+2+2, probabilities
sum to 1.000 per team; sql 062): candidates are goalies with at least one game for the franchise this season in
the NHL stats feed (`update-goalie-projections-v2.ts:296-305,333`), kept only if their current roster team is that
team (`:134-155,335,424`) → 4 `forge_goalie_projections` rows, one team slot per team-game
(`stages/goalie-stage.ts:798`), each carrying the per-candidate contract in `uncertainty.goalie_candidates.rows`
(sql 064) → 0 served (same proof gate). For RSO today all 4 team-games have "no FORGE goalie-candidate contract"
and goalie start chances are unknown (sql 089).
Teams: 4 `forge_team_projections` rows.

### 3.2 What a consumer page can show today (R-served)

| Consumer boundary | Count | Rule | Evidence |
|---|---|---|---|
| `/api/v1/forge/players?date=2026-11-16` primary selection | no run | `forge/players.ts:297` → `externalInputProof.ts:227-257` (404 when no proven run) | §2.6 |
| …fallback | serves the **11-15 slate** run created 11-09 (179 rows, 5 games, none of today's 4 teams' games) | `forge/players.ts:137` (3-day window), `:150-211` (newest proven run with rows, ≤ target date) | sql 041, 049 |
| …then roster filter | est. 120 of 179 | `forge/players.ts:118-132` reads `rosters` without pagination; `:397-401` drops players not in the returned set. 1,332 current rows exist; a 1,000-row cap in seq-scan order leaves 59 of the 179 outside | sql 045, 048, 049 (inferred: assumes the hosted API row cap is 1,000) |
| RSO planning catalogue for the 4 teams | **119** identified players (skaters and goalies) of 149 current-roster rows (132 + 17) | `planningInputs.ts:223-225` (identity `verified`, `active_nhl`, unmerged, has NHL id), `:232-237` (unique NHL id, exactly one current roster team); `forgeDailyBridge.ts:480` | sql 052, 089 (`players: 119`); the 30 dropped are roster rows without a verified active identity (not itemised) |
| …with a FORGE line today | **70**, all `bridge_reaimed` from 11-09 runs; **49** withheld | `forgeDailyBridge.ts:876-888` (newest proven run per date; unproven "withheld"), `:754-760` (a player whose team has a newer unproven run gets no line), `:598-612` (re-aim) | sql 089: "49 players have no proven FORGE line because a newer run for their team cannot prove…"; "1 skaters missing from their team's latest FORGE run"; "4 team-games have no FORGE goalie-candidate contract … so goalie start chances there are unknown" |
| Start Chart skater rows for 11-16 | 0 from the run path (no proven h1 run for the date) | `start-chart.ts:900-910` | §2.6; code-read, not observed in a browser |

### 3.3 The same boundaries for the largest recent slate (as_of 11-14, run `fb43a962`, 14 games)

1,042 eligible roster skaters → 500 written (min 15 per team) → 542 `unknown` (reserve pass off) → served on 11-14:
none of these 500 rows (unproven); readers used the 11-09 run for that date instead (sql 023, 041).

### 3.4 Slate-level population drops

- **Single-game run replaces a full slate.** For as_of 11-12 the full-slate run of 11-09 has 11 games / 393 player
  rows; the `selected_games` run `328a982a` created 11-13 01:40 has 1 game / 36 rows and is the only one of the two
  with a snapshot. Readers pick the newest proven run by `created_at` with no scope test
  (`externalInputProof.ts:232-238`, `start-chart.ts:898-910`, `forgeDailyBridge.ts:876-888`), so that date resolves
  to 1 of 11 games (sql 037, 038). Only the `forge/players` fallback ranks full-slate first (`forge/players.ts:183-191`).
- **Input games never ingested.** Games 2026020310 (11-13) and 2026020318 (11-14) have no `pbp_games`,
  `shift_charts` or `forge_player_game_strength` rows (sql 068: 1 of 2 and 13 of 14). Their four teams' most recent
  game is missing from every PBP/shift-derived input.

---

## 4. Population filters and cross-player / team-level normalisations

### 4.1 Filters (run)

| # | Filter | file:line | Effect |
|---|---|---|---|
| F1 | Games = `games.date = asOfDate` (optionally a requested id list) | `stages/preflight-stage.ts:173-183` | Defines the slate; no game-type or state filter |
| F2 | Lineup = latest `lineCombinations` row per team; if missing, hard-stale (>21 d) or empty, fall back to 18 skaters by rolling TOI, else the team is skipped | `stages/skater-stage.ts:1548-1586`; constants `constants/projection-weights.ts:8-9` | A team's projected set is "who dressed last game". Returning players, call-ups and healthy scratches get no line |
| F3 | Lineup ∩ current roster (`rosters.is_current`) | `skater-stage.ts:472-492`, `:1588-1591` | Dressed players without a roster row vanish, uncounted (3 today) |
| F4 | Starter-board confirmed-candidate filter, only when the compute flag is on | `skater-stage.ts:1592-1594` | Off in production (cron reports `mode: capture-only`, sql 024) |
| F5 | Position ≠ G and `players.team_id` = team | `skater-stage.ts:1606-1612`, `:948-958` | counted `filtered_skater_team_or_position` |
| F6 | Has a rolling EV or PP row; last metric ≤ 45 days (soft penalty from 21 d) | `skater-stage.ts:902-917`, `:960-992`; constants `:5-6` | counted `filtered_skater_missing_metrics`, `filtered_skater_hard_stale` |
| F7 | Availability multiplier ≤ 0 from `forge_roster_events` | `preflight-stage.ts:216-240`, `skater-stage.ts:1706-1711` | **Table has 0 rows, ever** (sql 065): no injury or scratch signal reaches the run |
| F8 | Pool recovery when < 15 skaters remain | `skater-stage.ts:1713-1870`; `SKATER_POOL_MIN_VALID_COUNT = 15` (`projection-weights.ts:159`) | Adds roster/rolling candidates only below 15 |
| F9 | No EV and no PP metrics at compute time | `skater-stage.ts:2826-2829` | counted `skater_pool_players_dropped_no_ev_pp_gate` |
| F10 | Reserve pass flag | `reserveProjections.ts:25-27` | Off: every non-lineup roster skater and non-starter goalie has no row |
| F11 | Goalie rows: one selected goalie per team-game; candidates from `goalie_start_projections` | `stages/goalie-stage.ts:923-1062` | 1 row per team-game |

Read-path filters are listed in §6. (§2.7, further measurements, follows this section.)

### 4.2 Normalisations and allocations (run)

| # | What | file:line | Effect on output |
|---|---|---|---|
| N1 | **Team TOI budget split across the projected pool.** Target = 5 skaters x 60 min, split ES/PP/PK by team PP share; each player's TOI is his share of the pool's raw TOI (largest-remainder integer allocation) | target `skater-stage.ts:2832`, guard `calculators/scenario-blending.ts:421-457`, split `reconcile.ts:34-65,97-150` | Sum of player TOI equals the team target exactly. **If the pool has 15-17 skaters the same 300 minutes are spread over fewer players** (guard only below 15). Today: Utah 15 skaters, mean 20.00 min vs 16.67 for 18-skater teams, max 36.2 min; `toi_scale_max 1.29` (sql 021, 059). 7 of 98 team-games in the 11-13 runs have < 18 skaters (sql 060) |
| N2 | **Team shots pinned to the team target**, by strength: player shots are scaled so they sum to the team's average ES and PP shots | `skater-stage.ts:3066-3099`, `reconcile.ts:66-96,97-150` | Player shots, and goals/assists derived per shot, move up or down together; a short pool inflates every remaining player's counts |
| N3 | Distribution validation after N1/N2 (caps top ES/PP share) | `skater-stage.ts:3100-3125` | `reconciliation_distribution_adjustments` (0 today) |
| N4 | PP TOI reallocation by team PP opportunity and unit | `skater-stage.ts:1027-1075`, applied `:2912-2930` | Re-weights PP time inside a team (69 of 69 players today) |
| N5 | Teammate assist coupling | `skater-stage.ts:2990-3000` | Scales assist rates by line-mates' scoring |
| N6 | Role-scenario probabilities normalised to sum to 1 | `skater-stage.ts:891-899` | Blend weights per player |
| N7 | Post-bootstrap re-pin of team shots (season-start only) | `skater-stage.ts:3266-3283` | Scales shots, goals and assists per strength |
| N8 | Team-level context, opponent goalie, rest, shot-quality and trend multipliers, each clamped | constants imported `run-forge-projections.ts:71-150`; applied in `skater-stage.ts` compute | Multiplicative, per team or per player |
| N9 | Goalie: start probabilities per team sum to 1; goalie shots against come from the opponent's projected team shots | `goalie-stage.ts:157-920`; `teamShotsByTeamId` passed `run-forge-projections.ts:778,816` | Goalie volume inherits N2 of the opponent |
| N10 | RSO bridge: season-rate shrinkage to league rates, forwards-vs-defence opponent tilt, goalie news floors, re-aim to a new opponent | `web/lib/rosterScheduleData/forgeDailyBridge.ts:160-173,263-274,598-612,701-706` | Read-side transforms of stored lines |

### 2.7 Further measurements

- **Roster table size (sql 045):** `rosters` has 1,332 current rows for season 20262027 (1,358 total).
- **Short pools (sql 059, 060):** in the seven full-slate runs of 11-13, 7 of 98 team-games have fewer than 18 projected
  skaters (minimum 15). For today's run, team 68 has 15 skaters: mean projected TOI 20.00 min (the 18-skater teams:
  16.67), maximum single-player TOI 36.22 min; team sums equal the team row exactly (ES 15,430 s).
- **Inputs per game date (sql 067, 068):** `rolling_player_game_metrics` (EV) has rows through 11-15, updated 11-16 10:16.
  PBP / shift / derived rows exist for 1 of 2 games on 11-13 and 13 of 14 on 11-14. `powerPlayCombinations` has
  0 of 5 games for 11-15 although the 10:10 step reported success (`rowCount: 0`, `qualified: false`,
  `official_class: missing` for every game; sql 069).
- **Availability events (sql 065):** `forge_roster_events` has 0 rows in total.
- **Revision path (sql 034, 035):** 1 `forge_game_revisions` row since 11-01; 0 `forge_reserve_projections` rows. The
  every-minute starter-board cron answers `{"mode":"capture-only"}` (sql 024). The serving path in production is the
  legacy run path plus the RSO bridge (`countsBySource.native = 0`, sql 043).
- **Goalie priors (sql 062, 077):** rows for games 11-16..11-19 were created 11-13 10:20:40 and `updated_at` has not
  moved, although the 09:30 job today reports "Total upserted: 10". No rows exist for games after 11-19, so today's
  10:20 goalie step (which would have written through 11-22) did not write.
- **Served-forecast ledger (sql 071, 074):** rows exist only for served dates 11-07, 11-08, 11-12, 11-15, 11-16. The
  snapshot failed on 11-13 ("Planning read deadline exceeded", `planning_inputs` 182,461 ms) and 11-14
  (`forge_bridge` 141,402 ms). The successful runs took 4.5 s and 5.6 s (sql 076).
- **Accuracy (sql 074, 081):** last scored date 11-12 (5 daily rows per scope in November). The 11-12 scoring wrote 35
  rows from the single-game run (1 game, sql 092), not the 11-game slate. Failed 11-14, 11-15 (not checked), 11-16 with the
  provenance error.
- **Off-release stamps (sql 042, 070):** the scheduled runs of 11-02, 11-03 (14 runs) and 11-06 (4 runs) carry
  `git_sha = 'local:unknown'`.

---

## 5. Freshness

### 5.1 Last run vs schedule (as of 2026-11-16 ~14:00 UTC)

| Stage | Schedule | Last successful run | State |
|---|---|---|---|
| Games/teams/players | pg_cron 03:00 / 00:00 / 02:00; pipeline 10:05 | 11-16 02:00 (rosters `created_at`, sql 058); pipeline stage 11-16 10:05 | current |
| NST + WGO skaters | pipeline 10:05 (+ pg_cron 07:30) | 11-16 10:09 | current |
| Line combinations | pipeline 10:10; pg_cron 08:00 and every 25 min | 11-16 10:10 (5 games) | current |
| PP combinations | pipeline 10:10; pg_cron 08:05 (D-2) | 11-16 10:10, 0 rows for 11-15 | one day behind |
| Rolling metrics | pipeline 10:10-10:16; Sundays 08:15 | 11-16 10:16 | current |
| PBP + shift ingest | pg_cron 09:45; pipeline | 11-16 10:16 for 11-15; two games permanently skipped | current with holes |
| Derived strength tables | pipeline; pg_cron 10:25 | 11-16 10:20 | current with the same holes |
| Goalie start priors | pg_cron 09:30; pipeline | 09:30 reports success; rows unchanged since 11-13 10:20 | cannot be told from the table |
| **FORGE run** | pipeline, daily | **11-13 10:46** | **3 days behind; 4 of the last 16 daily runs completed** |
| **Servable FORGE run** | same | **11-09 10:36** | **7 days behind** |
| Accuracy | pg_cron 11:30 | 11-13 11:30 (for 11-12) | blocked |
| Served-forecast snapshot | 12:40 | 11-16 12:40 (stale inputs) | running, gaps on 11-13/11-14 |

### 5.2 Reaction to inputs that change after a stage has run

| Stage | When an input changes later |
|---|---|
| FORGE run for a slate date | Nothing recomputes until the next day's pipeline writes a new run for that date (each date is re-run daily while it is within D..D+N). A lineup change, injury, goalie confirmation or trade after ~10:45 UTC is not reflected. The per-game rerun machinery (starter board, `forge_game_update_queue`) is not computing in production. |
| Days-ahead runs (D+1..D+6) | Preflight is anchored to the run date, not the slate date (`run-projection-v2.ts:593`), so they are built from the same inputs as D. They are superseded only if a later daily run reaches that date. When the pipeline stops early, a date keeps its oldest run (today's slate uses the run made three days before it). |
| Readers | Choose the newest proven run per date at request time, so a new run is picked up at once (start-chart after its 15 s cache; RSO has no cache). Nothing compares a run's creation time with the lineup or goalie inputs it used. |
| Rolling metrics | Recomputed for D-1 only in the daily run; a full recompute runs on Sundays (pg_cron 278). Late stat corrections wait for Sunday. |
| PBP/shift ingest | A game rejected at precheck is retried while it is younger than two UTC days, then marked isolated and never retried automatically (`ingest-projection-inputs.ts:163-171,743-760,818-822`). |
| Derived tables | Rebuilt for D-7..D-1 by the pipeline and for pending dates by pg_cron 305; follows ingest. |
| Goalie priors | Rewritten daily for today..D+6; `updated_at` is not touched by the upsert (`update-goalie-projections-v2.ts:79-81` sends no timestamp), so staleness is invisible. |
| RSO bridge lines | A stored line is valid for 8 days from its run's creation and until game start (`forgeDailyBridge.ts:49,467`); runs are read from a ±7 day window (`:24,27,874-875`). The 11-09 lines therefore stop being served at about 2026-11-17 10:16-10:36 UTC; the single-game run of 11-13 01:40 stays valid to 11-21 01:40 for its two teams. |

---

## 6. Load path per consumer page (code and existing logs only)

Read-side filters that drop players are marked **[filter]**.

### 6.1 `/roster-schedule-optimizer`

No server rendering (`web/pages/roster-schedule-optimizer.tsx:7-10`). Client sequence, from
`web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` and `web/lib/rosterScheduleOptimizer/*`:

1. `GET /api/v1/roster-schedule-optimizer/access` on mount; 15 s timeout; one retry after 3 s on 5xx/timeout; re-check
   every 5 min and on focus.
2. `GET …/workspace` once local state is loaded (no timeout; errors swallowed).
3. Planning read inside a Web Worker: `GET …/data` (anonymous or manual) or `POST …/yahoo-current-data` (signed-in
   Yahoo). 20 s client abort (`currentPlanningRead.ts:68`), no retry. Always `private, no-store` because the client
   always sends a nonce (`data.ts:26`), so the CDN branch on `data.ts:27` is unreachable. Every plan execution
   (including each manual edit) repeats this read.
4. `GET …/schedule` after `/data` returns matchup weeks: 8 s abort, 5-minute client cache, CDN `s-maxage=300`.
5. Yahoo sync users: `POST …/provider` after `/access` (no client timeout; server limit 240 s), repeated every 5 or
   30 minutes; about 65 Yahoo reads (10 s each, one retry on required reads), then a full planning load whose
   forecasts are discarded, then `/yahoo-current-data` loads everything again.
6. `GET …/eligibility` in up to 4 serial batches of 60 ids for a retained Yahoo roster.

Server side of step 3 (`web/lib/rosterScheduleData/planning.ts:74-330`), stages in series under one 20 s deadline:
serving-source choice (8 s) → planning inputs (8 s) → revision discovery (off in production) → FORGE bridge
(`forgeDailyBridge.ts:857-924`, 6 s read deadline): `forge_runs` (500-row pages) → proof read (two queries per 100
run ids) → nine parallel reads, each paged 1,000 rows at a time **serially** with an exact count per page
(`planningInputs.ts:73-98`): skaters (cap 15,000), goalies (cap 2,000), reserves, season totals, board evidence, team
data, games, opponent-by-position → ownership (2 s) → mapping. A cap overflow or deadline throws and the whole bridge
collapses to one limitation line (`planning.ts:230`). No FORGE result is cached on the server.
Third-party calls: Yahoo only (provider path). Existing-log timings of the same loaders: 4.5-5.6 s end to end on
11-15/11-16, but `planning_inputs` 182 s and `forge_bridge` 141 s on 11-13/11-14 (§2.7), far beyond the page's 20 s.

**[filter]** identity verified / one current team / regular-season scheduled future game inside the calendar horizon
(default 14 days) / latest line is for the player's current team / missing from team's latest run → only an exact
line for that game / blank ES or PP heads → no row / byte budget trims later games
(`planningInputs.ts:19,225-237`; `forgeDailyBridge.ts:285-299,460-463,582-605,791-798`).

### 6.2 `/start-chart`

One SWR request to `/api/v1/start-chart?date=<ET today>`; `refreshInterval 30 s`, `dedupingInterval 5 s`,
revalidate on focus (`web/pages/start-chart.tsx:443-448`). Server (`web/pages/api/v1/start-chart.ts`): source choice
(no lookups before native activation) → 15 s in-memory cache with in-flight de-duplication, `s-maxage=15`
(`:1221-1232`) → games, run candidates (20) + proof + run with embedded projections, and goalie priors in parallel
(`:928-932`) → player enrichment and Yahoo overlay RPC → ratings, CTPI, week games, and one recent-goals query per
team in parallel. No third-party call. The optional Yahoo panel is user-triggered and calls Yahoo and the NHL API
(5 s abort).
**[filter]** projections must belong to the proven run and to the slate's games (`:941-951`); goalie priors need
`updated_at <= <date>T23:59:59.999Z` (`:841-848`); UI ownership cap drops players with unknown ownership.

### 6.3 `/FORGE`, `/forge/command-center`, `/forge/player/[id]`, `/forge/team/[id]`, `/trends`

`/FORGE`: five parallel client fetches (start-chart, `forge/players?horizon=1`, ownership trends, two sustainability
reads), 60-90 s client cache; the 10 s timeout does not abort the request (`web/pages/FORGE.tsx:148-167,240-272`).
Command centre: eleven parallel fetches, no timeout (`web/lib/dashboard/commandCenterData.ts:268-329`).
Player page: fetches the whole slate from `forge/players` to find one player; schedule via `/api/v1/schedule`, which
calls the NHL API. `/trends`: server-side date only, then parallel client section loads.
`/api/v1/forge/players` (`web/pages/api/v1/forge/players.ts`): proven run for the date (`:297`) → rows (`:330-334`,
no pagination) → if none, fallback scan of 30 runs within 3 days, one count query per candidate in series, then a
second scan that allows future dates (`:150-211`) → **[filter]** `rosters` set read without pagination (`:118-132`,
`:397-401`) → calibration and season lookups in series. No `Cache-Control`. Default date is UTC (`:286`).
`/api/v1/forge/goalies`: same shape; fallback has no age limit (`forge/goalies.ts:236-270`).

### 6.4 `/game-grid/*`

`useTeamForecasts` → `/api/v1/projections/teams?date=` (15 s abort; no fallback: `projections/teams.ts:54`), and the
goalie grid → `/api/v1/forge/goalies?view=game-grid` (`s-maxage=60/300`, 15 s timeout).

---

## 7. Empty, stale and failure states (what the user sees)

| Condition | RSO | Start Chart | FORGE pages | Game grid |
|---|---|---|---|---|
| No proven run for the date (today's state) | Lines re-aimed from older proven runs while they are < 8 days old; the notice sits in the collapsed "More tools" panel as `limitations[0]`: "Interim FORGE projections until native forecasts go live: each player's latest FORGE v2 daily line (runs … to …) stands in for his remaining games…" (`forgeDailyBridge.ts:803`). Cells with no line show "—" with the tooltip "Expected fantasy points unavailable: an applicable weighted stat or its approved use is missing." | Games listed, "No player projections found." (`start-chart.tsx:1069`), serving mode `partial`, reason `scheduled_games_missing_projections` (`start-chart.ts:1273-1290`) | `forge/players` falls back to the newest proven run up to 3 days old **from another slate** (`fallbackApplied`); the command centre shows a stale warning; the player page says "Player not found in the current FORGE opportunity set." | "Team forecast reader unavailable. Schedule details remain available." (404 from the reader; `GameGrid.tsx:373`) |
| No proven, unexpired line (30 of 32 teams from ~11-17 10:36 UTC unless fixed; all teams after 11-19) | "Interim FORGE projections: no FORGE run in the last week can prove it excluded third-party fantasy projections (N withheld), so planning is schedule-only." (`forgeDailyBridge.ts:389-390`), again only in the collapsed panel; grid shows "Schedule-only capacity; player-quality decisions remain unresolved." | as above | `forge/players` still returns the 11-15 slate as a fallback for dates through 11-18, then empty lists / "No projections available for this date." (`/trends`) | as above |
| Stale but proven run | Nothing age-based: the forecasts timestamp is the oldest issue time as a raw ISO string; "Updated" shows the read time; no threshold or banner | Not flagged (run age is not shown) | Command centre and `/FORGE` show a fallback date when the date differs; a same-date run made days earlier is not flagged | not flagged |
| Loader error or timeout | "Planning data is temporarily unavailable. Your saved manual workspace is preserved." (`data.ts:39`); on the 20 s client abort the browser's abort text becomes the notice; no automatic retry | "Starter Board is unavailable." + raw `START_CHART_UNAVAILABLE` (`start-chart.tsx:1032-1035`); SWR retries | "{label} is unavailable right now." / "Request failed." | error copy above |
| Pipeline failed (operator view) | not visible | not visible | not visible | not visible |

The pipeline's own failures are visible only in `cron_job_audit` and the daily report email; no page tells a user that
today's projections were not produced.

---

## 8. Findings, ranked

Conventions: **Branch** = where the defect exists in code (`master` = `5c42cb14f`, `october` = `octoberBranch`
HEAD). **Basis** = observed (seen in production data or logs) or inferred (from code, not executed). Paths are under
`web/` unless they start with `supabase/`.

### C1. Critical: every scheduled FORGE run written since 11-13 is withheld from all readers; for upcoming games the last servable projections were computed on 11-09

- **Branch:** master and october (identical files). **Basis:** observed (DB + production job output); the forward
  projection in the last bullet is inferred.
- **Evidence.**
  - Readers serve a snapshot-less run only if its stamped producer-closure hash is in a hand-maintained list:
    `lib/projections/externalInputProof.ts:80-98` (`verifiedRunAttribution`), `:102-123` (`externalInputProofByRun`);
    list `lib/projections/verifiedForgeReleases.ts:46-145`, last changed 2026-11-12 14:17 -05:00 (`4243bcd4e`).
  - sql 041/042: the seven runs created 2026-11-13 10:20-10:46 (as_of 11-13..11-19, SHA `e1ab46318e`) carry closure
    `ee5581d901975dd5701c76ecc58e715b396b449bdb50e05360c571f3f3de710b` and have 0 input snapshots.
    `grep ee5581d9 web/lib/projections/verifiedForgeReleases.ts` and the same on `git show 5c42cb14f:…` return nothing.
  - sql 043: today's 12:40 snapshot reports `bridge_exact 0, bridge_reaimed 70` from "runs 2026-11-09 to 2026-11-15"
    and "7 FORGE runs in the last week cannot prove they excluded third-party fantasy projections, so they are withheld".
  - sql 088 and 074: `run-projection-accuracy` fails with "Selected projection run lacks external
    fantasy exclusion provenance." on 11-14 and 11-16.
  - The closure is the import closure of six roots including `run-rolling-forge-pipeline.ts`
    (`scripts/forge-producer-closure.ts:24-31`), so it covers every imported cron route and helper. Between
    `e1ab46318e` and `5c42cb14f`, files inside it changed again (`lib/cron/withCronJobAudit.ts`,
    `lib/projections/ingest/shifts.ts`, `lib/projections/goalie/leagueSavePct.ts`, …; `git diff --name-only`).
- **Root cause.** Serving is gated on an allowlist that must be edited by hand after every release that touches any of
  roughly 200 modules, and nothing fails or alerts when the deployed producer's hash is missing from the deployed
  reader's list. Releases #431, #432 and everything after shipped without a matching entry.
- **User-visible effect.** Today: Start Chart has games but no skater projections for the slate; `/api/v1/forge/players`
  answers with the 11-15 slate (a 11-09 run) as a "fallback"; team forecasts on the game grid 404; RSO shows 7-day-old
  lines re-aimed at today's opponents for 70 of 119 player-games and nothing for the other 49. From about
  **2026-11-17 10:16-10:36 UTC** the 11-09 lines pass their 8-day validity (`forgeDailyBridge.ts:49,467`) and RSO
  loses its FORGE lines for 30 of 32 teams. The two teams of game 2026020308 may keep a re-aimed line from the
  single-game run (valid to 11-21 01:40, inside the 7-day window through 11-19; they play 11-17 and 11-19, sql 094);
  whether the bridge falls back to it once a newer-dated line has expired was not traced. `/api/v1/forge/players`
  keeps answering with the 11-15 slate for requested dates through 11-18 (its 3-day fallback has no validity check). Accuracy and calibration have not updated since 11-13. A successful pipeline run tomorrow
  does not fix this: the producer files changed again after `e1ab46318e` and the list did not, so the current
  build's hash cannot be in it (inferred from `git diff --stat`; the hash itself was not computed).
- **Proposed fix.** (1) Immediate: verify the deployed producer closure with `scripts/verify-forge-release-sha.ts` and
  add its hash (and `ee5581d9…` if the 11-13 runs should be served) to `verifiedForgeReleases.ts`; release. (2)
  Structural: make the mismatch impossible to ship silently, for example a build-time check in `next.config.js` (where
  the hash is already computed) that fails or warns when `__FORGE_PRODUCER_CLOSURE_SHA256__` is not in
  `VERIFIED_FORGE_PRODUCER_CLOSURES`, plus a line in `cron-report` when the newest succeeded run of today is unproven.
  (3) Consider narrowing the closure roots so unrelated cron routes do not change producer identity.
- **Verify.** After release: `requireLatestExternalInputProvenRun(today)` resolves; the 12:40 snapshot shows
  `bridge_exact > 0` and no "withheld" limitation; the 11:30 accuracy job succeeds; re-run sql 041 joined to the list.
- **Confidence.** High for the current state; medium-high for "tomorrow's run is also unlisted" (the build hash cannot
  be computed without building).

### C2. Critical: the scheduled run completed on 4 of the last 16 days; a killed invocation or a twice-failed stage ends the day with no run and no page-level signal

- **Branch:** master and october. **Basis:** observed.
- **Evidence.** sql 029 (stage states per day), §2.3, §2.4. Today: `projection_execution` `running` since 10:20:34, five
  later slots returned `stage_handoff_unconfirmed` in < 0.4 s (sql 088). 11-10..11-12: same at
  `upstream_skater_sources`. `forge_runs` has no row created after 11-13 10:41 (sql 085).
- **Root cause.** Three compounding rules:
  1. A stage left `running` by a dead invocation is never retaken: `lib/rollingForgePipelineRunState.ts:190-202`
     throws `RollingForgeStageReviewRequiredError`, and `pages/api/v1/db/run-rolling-forge-pipeline.ts:1361-1370` turns
     that into a terminal `manual_review_required`. The kill counter that the constants describe
     (`run-rolling-forge-pipeline.ts:261-264`) is unreachable: `recordRollingForgeStageKill` has no caller.
  2. Child steps run in-process with no deadline (`invokeRouteStep`, `:550-585`). The goalie step makes one NHL stats
     request per team through `lib/cors-fetch.ts` with no timeout
     (`pages/api/v1/db/update-goalie-projections-v2.ts:288-323`). Today nothing was written by that step (§2.7), which
     points at it as the step that hung (inferred).
  3. A blocking stage gets two attempts per day (`MAX_BLOCKING_STAGE_ATTEMPTS = 2`, `:260`), then the day is over.
- **User-visible effect.** No new projections for the day; readers keep the previous run for each date with no
  staleness notice (§7).
- **Proposed fix.** Give every child step a deadline inside the invocation budget (wrap `invokeRouteStep` in a race
  against `startedAt + RESUMABLE_INVOCATION_BUDGET_MS`; add `AbortSignal.timeout` to the NHL fetches). Make read-only or
  idempotent stages (`projection_execution` is already resumable through `forge_runs` claims; the goalie step is an
  upsert) retakeable after lease expiry, keeping manual review only for the NST and audit cases. Add a late retry slot
  and an alert when no succeeded run exists for today by a set time.
- **Verify.** Unit test: a `running` row with an expired lease for `projection_execution` is retaken. Production:
  sql 029 shows 11/11 stages complete on consecutive days; `forge_runs` has a row created each day.
- **Confidence.** High on the mechanism; medium on which child hung today.

### H1. High: one rejected shift chart cancels the whole day's projections

- **Branch:** both. **Basis:** observed.
- **Evidence.** sql 027: 11-14 and 11-15 pipeline ingest failed on one game each ("Shift clock/duration mismatch …");
  sql 029: both days stopped at `projection_input_ingest=failed(stage_failed:attempt-2)`.
  Rule: `pages/api/v1/db/ingest-projection-inputs.ts:163-171` (`DURABLE_SOURCE_REJECTION_GRACE_DAYS = 2`) and
  `:743-760`: under the durable cursor a rejected game is isolated only once its date is two UTC days old; before that
  the route `break`s (`:803-813`) and the stage fails. The pipeline always runs the day after the game.
- **Root cause.** The grace period (2 days) is longer than the pipeline's patience (2 attempts within ~15 minutes), so
  a source-data defect in one of up to 16 games always costs at least one full run. Two bad games on consecutive days
  cost two runs.
- **Effect.** No projections on 11-14 and 11-15; the two games are never ingested (H7).
- **Proposed fix.** In the pipeline's ingest stage, treat an isolated-or-rejected game as degraded, not failed: let the
  stage complete when every non-rejected game is ingested, record the rejected ids in the stage result and in
  `forge_runs.metrics`, and keep retrying the rejected game on later days. Alternatively set the grace to 0 for the
  pipeline caller.
- **Verify.** Fixture test with one game whose shift precheck throws: stage result `success` with a degraded note;
  the projection stage runs.
- **Confidence.** High.

### H2. High: production cron runs stamped `git_sha = 'local:unknown'` are dropped by every reader

- **Branch:** both. **Basis:** observed (rows); cause inferred.
- **Evidence.** sql 042, 070: 18 scheduled runs (created 11-02 10:15-10:36, 11-03, 11-06) have `local:unknown`.
  `lib/projections/queries/run-lifecycle-queries.ts:253` falls back to that value when neither
  `VERCEL_GIT_COMMIT_SHA` nor `GIT_SHA` is set; `lib/projections/releasedRunFence.ts:10-12` excludes it in every
  reader.
- **Root cause (inferred).** A production deployment that was not built from Git (for example a CLI deploy of an
  exported tree) has no `VERCEL_GIT_COMMIT_SHA`, so its runs look like local runs.
- **Effect.** Three more days in November whose runs could not be served.
- **Proposed fix.** Fail the run at start in production (`VERCEL_ENV === "production"`) when no commit SHA is
  available, or have the deploy procedure set `GIT_SHA`; add the check to the release checklist.
- **Verify.** After the next non-Git deployment, a test run row has a 40-character SHA.
- **Confidence.** High on the rows and their exclusion; medium on the cause.

### H3. High: a single-game rerun replaces the full slate for its date

- **Branch:** both. **Basis:** observed (data, and the accuracy reader's selection); page readers inferred from the same code path.
- **Evidence.** sql 037, 038, 080: as_of 11-12 has a full-slate run (11 games, 393 rows, created 11-09) and a later
  `selected_games` run for game 2026020308 (36 rows, created 11-13 01:40) with a valid snapshot. Selection orders by
  `created_at` only: `externalInputProof.ts:232-238`, `pages/api/v1/start-chart.ts:898-910`,
  `lib/rosterScheduleData/forgeDailyBridge.ts:876-888`. The scope key of such a run is `h1:<ids>`, which passes the
  horizon fence (`releasedRunFence.ts:24-33`). Production confirms the selection: the accuracy job for 11-12 scored `source_run_id = 328a982a`,
  35 rows, 1 game (sql 092), for an 11-game slate.
- **Root cause.** "Latest run of the date" ignores `metrics.execution_scope`. Only the `forge/players` fallback ranks
  full-slate runs first (`pages/api/v1/forge/players.ts:183-191`).
- **Effect.** After any per-game rerun, the date shows one game's players; the other games lose their projections
  and their accuracy scoring.
- **Proposed fix.** Select per game, not per date: newest proven run that contains the game (the bridge already keys
  exact lines by game id), or exclude `selected_games` runs from date-level selection and merge them over the
  full-slate run. Apply in `requireLatestExternalInputProvenRun`, start-chart and the bridge.
- **Verify.** Test with both runs present: 11 games returned. Production: `select count(distinct game_id)` of the
  served run equals the slate's game count.
- **Confidence.** High.

### H4. High: a 15-17 skater pool receives the full team's ice time and shots, inflating every remaining player

- **Branch:** both. **Basis:** observed.
- **Evidence.** sql 059: team 68 in today's run has 15 skaters whose TOI sums to the full team target; mean 20.00 min,
  maximum 36.22 min; `toi_scale_max = 1.2935` (sql 021). sql 060: 7 of 98 team-games in the 11-13 runs are under 18,
  maximum player TOI 36.43 min. Rule: `lib/projections/calculators/scenario-blending.ts:451-457` keeps the canonical
  300-minute target whenever the pool is at least `SKATER_POOL_MIN_VALID_COUNT = 15`
  (`constants/projection-weights.ts:159`); `lib/projections/reconcile.ts:97-150` then pins TOI and shots to the team
  totals.
- **Root cause.** The pool guard starts below 15, but an NHL team dresses 18 skaters; missing players' minutes and
  shots are reallocated to those present.
- **Effect.** Overstated TOI, shots, goals and assists for every skater on an affected team (about +20% at 15
  skaters), which flows into Start Chart rankings and RSO fantasy points. The opposing goalie's shots against inherit
  the same team total, so that side is unaffected.
- **Proposed fix.** Scale the team target by `min(1, pool / 18)` (or by the pool's own pre-allocation exposure, as the
  guard already does below 15) and record the unmodelled remainder; raise a data-quality counter when the pool is
  under 18.
- **Verify.** Unit test at 15, 16, 17 skaters: mean TOI stays near 16.7 min. Production: re-run sql 060; `max_avg`
  ≤ ~17.
- **Confidence.** High.

### H5. High: `/api/v1/forge/players` filters projections through an unpaginated `rosters` read

- **Branch:** both. **Basis:** inferred (code + table size); not observed through the API.
- **Evidence.** `pages/api/v1/forge/players.ts:118-132` selects `playerId` from `rosters` for the season with
  `is_current = true` and no `.range()`; `:397-401` drops every projection whose player is not in the returned set.
  sql 045: 1,332 current rows. sql 048: the plan is a sequential scan, so a 1,000-row cap returns an arbitrary
  1,000. sql 049: with that cap, 23 of today's 69 rows, 59 of the 179 rows of the run currently served as fallback,
  and 160 of 500 rows of the 11-14 run fall outside the first 1,000. The writer reads the same table with explicit
  paging (`lib/projections/queries/skater-queries.ts:37-60`).
- **Root cause.** Missing pagination on a table that outgrew the API's default row cap (1,000 in
  `supabase/config.toml`; the hosted value was not readable).
- **Effect.** About a third of projected skaters would be missing from `/FORGE`, the command centre, player pages
  ("Player not found in the current FORGE opportunity set.") and `/trends`, with no error.
- **Proposed fix.** Filter with the ids in hand (`.in("playerId", projectedIds)` in chunks) or page the read; throw
  when `count` exceeds the rows returned.
- **Verify.** One request to the route for a date with a served run: returned player count equals
  `count(*)` of the run's rows that have a current roster row (sql 049 shows that is all of them).
- **Confidence.** Medium-high (depends on the hosted row cap being 1,000).

### H6. High: the "fallback" in `/api/v1/forge/players` and `/forge/goalies` presents another slate's players as the requested date

- **Branch:** both. **Basis:** inferred from code and current data.
- **Evidence.** `forge/players.ts:137,150-211`: with no proven run for the date, the newest proven run within three
  days is returned, then any future run. Today that is the as_of 11-15 run created 11-09 (5 games, none involving
  today's four teams' games). `forge/goalies.ts:236-270` has no age limit at all. A future-date fallback is reported
  with a 0-day gap and no message (`lib/dashboard/freshness.ts:103,213-224`, read by the tracer, not re-verified).
- **Effect.** Pages that do not read `fallbackApplied` (the `/trends` sections) show yesterday's slate as today's;
  pages that do show a date notice but still rank players who do not play today.
- **Proposed fix.** Return an empty, explicitly "no run for this date" payload instead of a different slate; if a
  fallback is kept, restrict it to runs that contain games of the requested date.
- **Verify.** Request for a date without a proven run returns no players and `serving.mode = "unavailable"`.
- **Confidence.** Medium (API not called).

### M1. Medium: no availability signal reaches the run; the lineup is "who dressed in the team's last game", up to six days ahead

- **Branch:** both. **Basis:** observed (table empty) + code.
- **Evidence.** `forge_roster_events` has 0 rows (sql 065) and is the only source of the availability multiplier
  (`stages/preflight-stage.ts:216-240`); `skater_unavailable_filtered = 0` in every run inspected. The lineup comes
  from the latest `lineCombinations` row (`stages/skater-stage.ts:1528-1529`). Days-ahead runs reuse it for D+1..D+6.
- **Effect.** Injured or scratched players keep full lines; returning players and call-ups have none. Reserve lines
  that would cover them are off (M2).
- **Proposed fix.** Feed an existing status source (the player-status ingestion or accepted line-source news) into
  `forge_roster_events`, or read it directly in preflight; mark lines of players with a non-active status.
- **Verify.** A known injured player has no row (or a flagged row) in the next run; `skater_unavailable_filtered > 0`.
- **Confidence.** High on the gap; effect size not measured.

### M2. Medium: 48-52% of eligible roster skaters have no line because the reserve pass is off

- **Branch:** both (flag). **Basis:** observed.
- **Evidence.** Run metrics: 63 of 132 (today), 542 of 1,042 (11-14), 467 of 898 (11-19) are `unknown` with reason
  `reserve_pass_disabled` (sql 021, 023); `forge_reserve_projections` is empty (sql 035);
  `lib/projections/reserveProjections.ts:25-27`.
- **Effect.** RSO candidate search and "if he plays" values exist only for the last dressed 18; the page says so only
  in a limitation line. Note the "eligible" universe includes non-NHL roster rows (41.6 current rows per team).
- **Proposed fix.** Decide and document: either enable the pass (the table exists) or state in the RSO UI that
  non-lineup players are not covered.
- **Verify.** `forge_reserve_projections` row count per run; `skater_coverage_unknown` falls.
- **Confidence.** High.

### M3. Medium: dressed players without a `rosters` row are dropped with no counter

- **Branch:** both. **Basis:** observed.
- **Evidence.** sql 053, 055, 056: three Utah skaters dressed on 11-12 and 11-14 have no 20262027 roster row; the run
  projected 15 Utah skaters. `stages/skater-stage.ts:472-492,1588-1591` filters silently; none of the
  `filtered_*` counters moved. League-wide today it is 3 of 576 dressed players (sql 057).
- **Root cause.** Roster ingestion missed three call-ups, and the filter that removes them is the only uncounted one.
  It also triggers H4.
- **Proposed fix.** Count and warn (`filtered_skater_not_on_current_roster`, ids in `metrics.warnings`); consider
  trusting a player who dressed in the team's latest game when the roster row is absent; repair the roster rows.
- **Verify.** Metric present in the next run; Utah has 18 rows.
- **Confidence.** High.

### M4. Medium: the power-play combination step writes zero rows for yesterday's games and reports success

- **Branch:** both. **Basis:** observed outcome; cause not established.
- **Evidence.** sql 068: 0 of 5 games on 11-15 have `powerPlayCombinations` rows after the pipeline's 10:10 step
  (still 0 at ~14:00 UTC); sql 069: every game answered `rowCount: 0`, `qualified: false`,
  `official_class: missing`, status success. The route reads `nhl_api_pbp_events`, `nhl_api_shift_rows`,
  `nhl_api_game_roster_spots` and `teamGameStats` (`update-power-play-combinations/[gameId].ts:354-401`); by 14:17
  UTC all four team rows per game had `powerPlayToi` and raw shift rows existed (sql 083), so an input was probably
  not there yet at 10:10. Stage 3 (`run-rolling-forge-pipeline.ts:818-882`) runs before ingest (stage 5) and its
  verification checks only `lineCombinations` (`:626-640,862-881`). pg_cron 388 covers D-2 the next morning.
- **Effect.** The rolling recompute and the run use power-play unit context that is one game behind for every team
  that played yesterday.
- **Proposed fix.** Establish which input is late (open question 9); then either move the PP step after the stage
  that provides it or have the step report `deferred` (not success) when a game is unqualified, and add PP rows to
  the stage verification.
- **Verify.** sql 068 shows `ppcombos = games` for D-1 after the run.
- **Confidence.** Medium on the outcome mattering; low on the cause.

### M5. Medium: rejected games are never ingested and the preflight gate cannot see them

- **Branch:** both. **Basis:** observed + code.
- **Evidence.** sql 068, 079: games 2026020310 and 2026020318 have no PBP, shift or derived rows; their slates are
  marked `complete`. `ingest-projection-inputs.ts:818-822`: isolated games do not hold the slate open and are retried
  only by an explicit-range run. `run-projection-v2.ts:711-741` and `:252-281`: the ingest gate's denominator is
  "games with complete stored PBP", so a game with no PBP at all is excluded and the gate passes.
- **Effect.** Four teams' most recent game is missing from PBP/shift-derived strength inputs until someone repairs it.
- **Proposed fix.** Keep a retry list for isolated games (retry daily for N days with the HTML-report fallback), and
  count scheduled-and-final games without PBP in the gate as a warning.
- **Verify.** Both games have rows; gate detail lists missing games.
- **Confidence.** High.

### M6. Medium: the execution stage used five of the six slots left to it; one spare

- **Branch:** both. **Basis:** observed timing.
- **Evidence.** §2.5: 675 s of projection work for 49 games on 11-13, finishing 10:46 in the fifth invocation of the
  six available from 10:20; slots end at 10:55 (`vercel.json:35`). (On 11-05..11-07 fewer dates were written, but
  that was the goalie-step failure in §2.4, not capacity.)
- **Root cause.** Projection work per week of slates (about 11 minutes) is close to the 6 x 180 s the schedule
  provides after the earlier stages.
- **Effect.** A heavier week (49 games here; a full week is 50-55), a slower database or two deferred slots leaves
  D+5/D+6 without runs (RSO's later days).
- **Proposed fix.** Add slots (for example every 5 minutes to 11:25), or project days ahead in a second cron after the
  run date is published; reuse per-run caches across dates.
- **Verify.** `projection_execution` cursor reaches 7 daily with at least one unused slot.
- **Confidence.** Medium-high.

### M7. Medium: accuracy, calibration and the served-forecast ledger have gaps and no one is told

- **Branch:** both. **Basis:** observed.
- **Evidence.** sql 081: accuracy last scored 11-12. sql 071, 074: no ledger rows for 11-13/11-14; snapshot failed after
  182 s and 141 s. The settle job on 11-16 read 0 rows for 11-13 and 11-14 (sql 088).
- **Root cause.** Accuracy reads through the same proof gate as pages (C1) and through date-level run selection
  (H3); the snapshot has one attempt per day and shares the planning loaders' deadline.
- **Effect.** Calibration inputs and the public scoreboard are missing days; the model's error is not being tracked
  during the period when it is most stale.
- **Proposed fix.** Follows C1 and H3 for accuracy. For the snapshot: retry once later in the day; investigate the
  11-13/14 slowness (O4). Add both to the daily report as failures, not rows.
- **Verify.** sql 081 shows yesterday's date each morning; sql 071 has a row set for every game day.
- **Confidence.** High.

### M8. Medium: RSO does not surface FORGE staleness and reloads everything on every edit

- **Branch:** both. **Basis:** inferred from code (tracer), spot-verified for timeouts and cache headers.
- **Evidence.** No age threshold on forecasts; the limitation text sits in a collapsed panel
  (`components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx:1177-1179,1291`); "Updated" is the read time.
  `/data` is always `no-store` (`pages/api/v1/roster-schedule-optimizer/data.ts:26`) and each plan execution re-reads
  (`lib/rosterScheduleOptimizer/currentPlanningRead.ts:68-89`). The Yahoo flow loads the bridge up to three times.
- **Root cause.** The page treats forecasts as request-scoped private data (nonce, `no-store`) and has no age rule
  for the run behind them.
- **Effect.** Users plan on 7-day-old lines without a visible warning; edits wait on a multi-second server load that
  takes minutes on a bad day (§2.7) against a 20 s abort.
- **Proposed fix.** Show the newest run's issue date and a warning when it is older than 36 h; cache the bridge result
  per (season, run ids) on the server for a few minutes; reuse the last read for local edits.
- **Verify.** With a stale run the page shows the warning without opening "More tools"; a manual edit triggers no
  `/data` request (network panel or Playwright).
- **Confidence.** Medium.

### M9. Medium: three schedulers call the same routes with different windows

- **Branch:** n/a (configuration: `vercel.json` + `cron.job`). **Basis:** observed.
- **Evidence.** pg_cron 363 (09:45), 364 (09:30), 305 (10:25), 361 (11:30) call routes the Vercel pipeline also calls
  in-process (§1.1). They share the durable ingest cursor (sql 079): the 09:45 job is what eventually isolates poison
  games; the 10:25 derived build fires in the middle of the pipeline's window. Job 308 (the old standalone run) is
  inactive.
- **Root cause.** The Vercel pipeline was added on top of the older pg_cron chain and only job 308 was switched off.
- **Effect.** Behaviour depends on which scheduler reaches a slate first; failures in one are masked or caused by the
  other (H1 is only ever resolved by the pg_cron copy). No harmful interleaving was observed in the days inspected.
- **Proposed fix.** Pick one owner per route; keep pg_cron copies only as explicit late retries with their own names.
- **Verify.** `cron.job` lists each projection route once (or with a distinct retry name); sql 079 shows one writer
  per slate.
- **Confidence.** Medium.

### L1. Low: `missing_pbp_games` counts the game being projected

`run-forge-projections.ts:841-851` (called `:1105`) checks stored PBP for the target (future) game, so the metric equals the number of
games in every pre-game run (2 of 2 today, sql 021). Both branches; observed. Root cause: the completeness check is
aimed at the target game. Effect: a data-quality counter that always fires and so signals nothing. Fix: check the
teams' previous games or drop the counter. Verify: counter is 0 on a healthy run. Confidence: high.

### L2. Low: `goalie_start_projections.updated_at` never advances

Upsert sends no timestamp (`update-goalie-projections-v2.ts:79-81`); rows for today's games still show 11-13 (sql 062,
077). Start Chart filters on that column (`start-chart.ts:841-848`), which today is harmless but would hide rows
refreshed after 23:59 UTC if a trigger were added. Both branches; observed. Root cause: no trigger and no timestamp
in the payload. Effect: goalie-prior freshness cannot be monitored. Fix: set `updated_at` in the payload and drop
the read filter or base it on game start. Verify: sql 077 shows today's time after the 09:30 job. Confidence: high.

### L3. Low: UTC default dates and unfenced run listing

`forge/players.ts:286`, `forge/goalies.ts:311`, `forge/accuracy.ts:39` default to the UTC date (the slate is ET; wrong
between 00:00 and 05:00 UTC). `runs/latest.ts:139-143` lists runs with no release or proof fence. `horizon` is not
passed to run selection (`forge/players.ts:297`). Both branches; inferred from code. Effect: a wrong-day request in
the late-evening ET window for callers that omit `date` (the pages pass ET dates); week mode always takes the slow
fallback; an operator page can show a local or unproven run. Fix: default to the ET date, pass `horizonGames`, apply
the release fence. Verify: unit tests on the three routes. Confidence: medium.

### L4. Low: goalie start probabilities of 0.97-0.98 three days before a game

sql 064 (`start_probability_status: "uncalibrated_model"`). Both branches; observed in output, cause not audited.
Effect: if served, RSO would treat a three-days-out starter as near-certain. Next step: compare stored start
probabilities by lead day with actual starts before changing anything. Confidence: low.

### L5. Low: comments and copy that contradict behaviour

`run-rolling-forge-pipeline.ts:261-264` describes a retake-after-kill that cannot happen (C2). Bridge limitation text
says plans "count 0" for no-line players while rows are emitted as unknown (`forgeDailyBridge.ts:825-830`; tracer,
not re-verified). `start-chart.tsx:1073-1074` likely renders "games arescheduled" (tracer, not verified). Both
branches; inferred. Effect: misleading operator expectations and one visible typo. Fix: correct the comment and
strings. Confidence: medium.

---

## 9. Optimisations that are not defects

- **O1.** `forge/players` and `forge/goalies` fallback scans issue one count query per candidate run in series (up to
  30, twice). One grouped count, or `exists`, would do.
- **O2.** The bridge pages each read serially with `count: "exact"` on every page (`planningInputs.ts:73-98`); request
  the count once and fetch pages in parallel, and stop selecting `starter_probability`, which is unused
  (`forgeDailyBridge.ts:55`).
- **O3.** `/forge/player/[id]` and `/forge/team/[id]` download the whole slate or the whole Start Chart payload to show
  one entity; add `playerId` / `teamId` filters to the routes.
- **O4.** The same planning loaders took 4.5 s and 180 s on different days (§2.7). Capture the bridge's built-in timing
  (`forgeDailyBridge.ts:862-866` is never passed a sink by `planning.ts:216-217`) so slow days can be attributed.
- **O5.** A FORGE run spends about 12-13 s per game, mostly per-team reads repeated for each date; the seven daily
  runs re-read the same rolling rows. Run-scoped caches keyed by team rather than `team:date` would cut days-ahead
  cost (supports M6).
- **O6.** `cron_job_audit` has one index on `(run_time, …)`; job-name lookups over more than a few days time out at
  5 s (three audit queries here did). An index on `(job_name, run_time desc)` would make the report and any
  health check cheap.

## 10. Open questions and the evidence that would settle each

1. **Which step hung at 10:20 today?** Vercel function logs for the 10:20:29 invocation of
   `run-rolling-forge-pipeline` (last log line before the 240 s kill). Not readable under this audit's limits.
2. **What closure hash does the current production build stamp?** The build log line from `next.config.js`
   (`--print`) or the first run it writes; settles the forward-looking part of C1.
3. **Is the hosted API row cap 1,000?** Supabase dashboard API settings, or one call to `/api/v1/forge/players`
   compared with sql 049; settles H5.
4. **Why did scheduled production runs carry `local:unknown` on 11-02, 11-03, 11-06?** Deployment records for those
   days (source: Git or CLI).
5. **Why did planning inputs take 182 s and the bridge 141 s on 11-13/11-14?** Database load and slow-query logs for
   12:30-12:35 UTC on those days.
6. **Were unproven runs ever served?** The allowlist is evaluated at read time, so whether the 10-28..10-31 runs
   (closures `f550d727…`, `cda1026d…`, not in today's list) were served when written depends on the list deployed
   then; `git log -p` of `verifiedForgeReleases.ts` against deployment times would show it.
7. **Is the source-data mismatch in the two rejected games real?** The stored raw shift snapshots for games
   2026020310 and 2026020318 (player 8480947 period 1; player 8479292 period 3) against the NHL HTML TOI report.
8. **Do the three Utah players lack roster rows because of the roster source or the writer?** The `update-players`
   audit rows of 11-12..11-16 for team 68.
9. **Which input was missing when the PP step ran at 10:10?** The full step response (`clock[].unavailable…`
   reason, truncated in the audit row) or a dry run of the route for one 11-15 game.

## 11. Gaps in this audit

- No page was opened and no API route was called; every user-visible statement is from code or from production job
  output.
- Environment flags were not read; flag states are inferred from data (`capture-only`, `native = 0`, reserve rows 0,
  days-ahead 6 from the as_of range of each daily batch).
- The NST, WGO and rolling-recompute internals were mapped but not audited line by line; the goalie model and the
  skater rate model were not audited for statistical correctness.
- Line numbers credited to "the tracer" in §6-§8 come from two read-only code-tracing passes; those re-verified by
  hand are cited without that note.
- No context diary was written under `tasks/diaries/` because this audit may write only inside `blind/`; this file
  is the record.
