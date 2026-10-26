# Week-ahead FORGE h1 lines for RSO: design note (PROV-GUARD)

**Base** HEAD `f98312c9bda9447a36b270f9e616866f775c920a` · **Uncommitted, flag off.** No schedule, env or production change. No production reads. Runtime figures come from repository evidence.

## Why RSO goes empty past tomorrow

1. **A run projects only its own date.** `stages/preflight-stage.ts:81` reads `games` where `date = asOfDate`, so a run's h1 lines exist only for teams playing that day.
2. **The pipeline makes runs for today and tomorrow only.** It's the only scheduled FORGE writer: `run-rolling-forge-pipeline` sets `projectNextDay: true`, so dates are the run date and the run date + 1. pg_cron jobs 308 and 393 are inactive (`cron-schedule.md`).
3. **The bridge reads runs only up to tomorrow.** `forgeDailyBridge.ts` used `to = now + 1 day`, and it reuses each player's latest line for later games. A team with no game on those two dates therefore has no line → Best Fit is empty.
4. **TJ's manual range run (10-26 → 11-01) only half-fixes this until the bridge change ships.** Its runs for dates past tomorrow exist, but the current bridge doesn't read them until each date is within a day.

## The change (smallest, flag-gated)

| File | Change |
|---|---|
| `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` | `projectNextDay` → `projectDaysAhead`, from `forgeProjectionDaysAhead()`: env `FORGE_PROJECTION_DAYS_AHEAD`, an integer 0–6. **Unset or invalid = 1**, i.e. today and tomorrow, exactly as now. 6 = today … today+6. The goalie step's `endDate` follows (`run date + daysAhead`); the route accepts up to a week ahead, and `limit=7` covers it. Dates are projected in order, and the stage cursor (`projectionDatesDone`) persists across the 5-minute invocations. A failed date ahead is `skipped` (non-blocking), recorded as handled, and **no longer stops the dates after it**. The run date stays blocking, as before. |
| `web/lib/rosterScheduleData/forgeDailyBridge.ts` | Reads runs dated through `now + 7 days` (`FORGE_DAILY_BRIDGE_AHEAD_DAYS`). **Not flag-gated:** it only reads proven runs that exist, and it's what makes TJ's manual range run useful. Selection is unchanged: per date, the newest proven run. |

**No change** to `run-projection-v2`. Its range mode, resumable single-date runs and preflight are reused as they are.

**Tests:**
- **Pipeline:** flag parsing (unset, `""`, 0, 1, 6, 7, −1, 2.5, "six"). With 6 days ahead, 7 dates are projected in order, goalie priors run through +6, and the cursor reaches 7. A failed middle date skips, the dates after it continue, and a resume picks up after the last handled date. 0 days ahead projects the run date only. The renamed message and cursor are covered by the existing next-day-failure test.
- **Bridge:** the window is gte today−7 and lte today+7, and a later run of a date supersedes an earlier one for that date's game.

## Cost: 7 dates per day vs today's 2 (estimate)

| | Today (days ahead = 1) | Days ahead = 6 |
|---|---|---|
| Games projected per day | ≈ 14 (two slates) | ≈ 49 (a typical NHL week; ≈ 7 games a day) |
| FORGE compute (≈ 8.5 s per game, measured in `DIAGNOSIS.md`) | ≈ 120 s | ≈ 415 s |
| Same with the reserve pass on (+50–60%) | ≈ 190 s | ≈ 650 s |
| Pipeline invocations used by the projection stage (180 s budget each; the run date gets at least 30 s) | 1–2 | ≈ 3–4 |
| `forge_*_projections` rows per day (≈ 33 skater, 2 team and 2–4 goalie per game, plus reserve rows if on) | ≈ 520 | ≈ 1,800 (≈ 3.5×) |
| `forge_runs` rows per day | 2 | 7 |
| Goalie-prior step (NHL API: one log fetch per team, whatever the date count) | 1 run | 1 run; ≈ same requests, more games computed |
| NST requests | 0 | 0 |

The NST figure was checked by scanning the import closure of `run-projection-v2` alone (97 modules). The only NST mention is a route-name string in `lib/rollingForgePipeline.ts`'s stage contract; there's no fetch. FORGE reads database tables only.

**Resume behaviour under the 210 s route budget:**
- Every date is its own resumable run. The pipeline passes `maxDurationMs` equal to its remaining budget, so a partial date continues on the next invocation, with the same `run_id` and only the unfinished games.
- Finished dates are never re-run within the day, because of the cursor.
- The pipeline's 9 Vercel cron slots (10:05–10:55 UTC) currently have spare slots, but how many the earlier stages use each day isn't measured here.
- **If the slots run out:** the last dates ahead aren't refreshed that day. They keep the previous day's proven run of that date (one day older and still served), except the newest date (+6), which has no line until the next day.
- Downstream of projection there is only `run-projection-accuracy` (off in the cron: `includeAccuracy=false`) and the cron report, so a longer projection stage delays nothing user-facing.

## Interactions

- **Supersession and stale lines:** every day re-projects each date in the window, and the bridge takes the newest proven run per `as_of_date`. A later run of a date therefore supersedes an earlier one for its games (tested).
  - A date ahead that fails today keeps yesterday's proven run, within the bridge's `VALID_DAYS = 8` expiry.
  - The bridge's existing stale rule still applies: a player missing from his team's latest run keeps only lines issued for a game itself.
- **Reserve pass:** each date's run writes its own reserve rows when that flag is on. Cost is +50–60% per game (as above), and the bridge's reserve selection (team's latest run) is unchanged.
- **Proof and identity:** the new runs are stamped like any run. `run-rolling-forge-pipeline.ts` is a producer-closure root, so **this change moves the closure**. HEAD plus these files gives `87edd78f5dfa96eded8a32927ef184d9266995edf52f395cf5ac6b8565c64f97` (verified with `--tree`: 194 modules, 0 findings). The release candidate must be verified and listed (`verify-forge-release-sha.ts <final SHA>`), or the new runs are refused.
- **Other readers:** Start Chart now finds h1 runs for future slates. Accuracy and the ledger use the newest run per date (the same-day run), as before.

## Orchestrator follow-up checks (lease pinned)

- **A newer run of a game date supersedes an older one:** tested. The bridge reads only the newest proven run per `as_of_date`, so an older run's rows aren't read at all.
- **Unproven future runs stay withheld:** tested.
  - A newer unproven run of a future date is skipped, and the older proven run of that date stands.
  - With no proven run, the date has no line, and the limitation counts the withheld runs.
- **The day-of run beats a run written days ahead, before the lineups existed:** tested.
  - A run written on 10-16 for 10-21 had s2 dressing; the day-of run doesn't. Only the day-of run is read: s1 gets the day-of line, and s2 gets no forecast for that game.
- **Payload with 7 days of exact rows:** tested on the production-shaped league fixture (1065 players, 32 teams), with one run per game day:

  | Week shape | Reserve pass | Forecasts | Wire bytes (budget 2.5 MB) | Expanded bytes (budget) | Today, single run (wire / expanded) |
  |---|---|---|---|---|---|
  | typical (≈48 games) | off | 1,880 | 806,830 | 2,862,188 (4 MB) | 804,660 / 2,943,888 |
  | typical | on | 3,196 | 1,713,620 | 5,513,616 (6 MB) | 1,711,786 / 5,653,556 |
  | maximal (56 games) | off | 2,240 | 960,742 | 3,410,004 (4 MB) | 958,472 / 3,507,444 |
  | maximal | on | 2,240 (reserves withheld) | 960,630 | 3,409,892 (6 MB) | the same; reserves are withheld today too |

  Per-date runs cost about the same as today, under 3% apart either way.
- **Trim order:** no lineup line is trimmed in any 7-day shape, and every date is covered. Lineup skaters and each game's projected starter take the exact line from their own date's run.
  - Reserve lines stay all or nothing (never only the late games), as today.
  - Trimming would happen only past a week (14 or more days, the existing behaviour), and then it keeps the earliest games, as the limitation says.
  - By design, backup goalies without a starter row of their own and reserve lines use the newest run (their latest line, or the team's latest run). That's never an older run.

## What TJ would need to approve (none done), with cost

| # | Change | Where | Cost / effect |
|---|---|---|---|
| 1 | Release this code (one production build), plus the producer-closure allowlist entry for the release commit | Vercel build, `verifiedForgeReleases.ts` | One build. Without the entry, the new runs are refused. **Unset env = today's behaviour**; the bridge then also reads the existing future runs (e.g. a manual range). |
| 2 | `FORGE_PROJECTION_DAYS_AHEAD=6` | Vercel Production env | ≈ +300 s of FORGE compute a day (≈ +460 s with the reserve pass); ≈ 2–3 more pipeline invocations inside the existing 10:05–10:55 cron slots; ≈ +1,300 `forge_*_projections` rows and +5 `forge_runs` rows a day (≈ +475k rows a year); 0 NST requests; NHL goalie-log requests unchanged |
| 3 | Only if a measured day shows the 9 slots aren't enough: add 2–4 `run-rolling-forge-pipeline` slots (e.g. `0,5,10,15 11 * * *`) | `web/vercel.json` cron | One more short invocation per added slot (each slot exits early once the run is complete); a release build is needed for `vercel.json` |
| 4 | Optional one-time fill before the first scheduled day: a bounded range run, with goalie priors written through the end date first | Manual, as today | ≈ 50 games of compute (about 7 minutes, resumable); per-date preflight returns 422 without goalie priors |

## Checks

| Check | Result |
|---|---|
| Focused vitest, 48 files (pipeline, run-projection-v2, `lib/rosterScheduleData` (bridge, planning, reserve payload and the rest), RSO routes, ledger, proof, allowlist, identity, `lib/cron`, `rollingForgePipeline`), UTC and America/New_York | **passed**: 713 in each |
| Whole-project tsc on a HEAD + 4-file `/private/tmp` export, under the heavy lock | **passed**: exit 0 |
| eslint on the 4 files | **passed**: exit 0 |
| Producer closure of that export | `87edd78f…4f97`, 194 modules, 0 findings (receipt in the scratchpad only) |

## Files (sha256)
- `bb8c0c0e467c164584b22ff154b6cf1f9b645fe11030a32a310a062b71faa55d`  web/pages/api/v1/db/run-rolling-forge-pipeline.ts
- `88c61580e6a219dac7a389b265a1c647f0c47902e132bf5c67969468532a2db3`  web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts
- `1c8813819a5eaee9d2499d202d6182d9df722248f3196965389f69f65da1c3cf`  web/lib/rosterScheduleData/forgeDailyBridge.ts
- `bd5f43ba9c41c90e4c91e45778fec14dc955f23a95c4b08342c618da9fa7ac21`  web/lib/rosterScheduleData/forgeDailyBridge.test.ts
