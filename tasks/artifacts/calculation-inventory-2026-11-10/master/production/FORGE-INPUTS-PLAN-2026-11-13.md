# FORGE inputs: verified plan (queue steps 4 and 5), 2026-11-13

All reads are bounded and read-only. Read hygiene was checked before each batch: 0–1 active queries, none long-running. Nothing below writes until TJ approves it by pop-up.

## Step 4: forge_team_game_strength rebuild. **Already done; no action.**
- Codex's DRM step 5 (2026-11-12 19:07–23:24Z) rebuilt the input, relationship and derived tables for all 298 games.
- `projection_game_materialization_status` for 2026020001–2026029999 shows 298 games, all `projection-input-materializer-v3-penalty-clock` / `shift_relationship_materializer_v6_strength_segments` / `projection-derived-materialization-v1`, derived complete and current.
- `forge_team_game_strength` has 596 rows for 298 games.
- **Note for L9a/Astra:** Codex's 24b1cb4d3 replaced L9a's ice-time classifier (8bc43a855) with a penalty clock in `ingest/shifts.ts`, but derived event counts still use situation codes. The two agree on decision 70 (pulled goalie); edge cases are unverified.

## Step 5a: "held" rolling/FORGE writes
- The holds are rows in `projection_pipeline_state` (`pipeline_key='rolling_forge_pipeline'`, scope = `daily_incremental:<date>`).
- **Stuck `running` at stage 2 `upstream_skater_sources`** (lease expired about 10:10): 11-01, 11-04, 11-08, 11-10, 11-11, 11-12; 8 rows since 10-01.
- **`failed` at `projection_execution`** (`stage_failed:attempt-2`): 11-05, 11-06, 11-07.
- **What actually happened on 11-12:** `update-nst-gamelog` succeeded at 10:05:55 (3,640 rows). The 10:05 pipeline call then never recorded its handoff or its own audit row. The 8 later slots all failed because they refuse to take over a `running` row. The NST data landed; the rest of the pipeline did not run.
- NST counts exist for every date through 11-11 (`nst_gamelog_as_counts`), so nothing NST-side is missing or needs a retry.
- **Consequences:**
  - Rolling rows stop at game date 11-08, and game date 11-07 has 106 rows against 431 NST rows.
  - FORGE runs for 11-10 onward were all created on 11-09, so projections are 4 days stale.
- Old scopes are never resumed, because each day opens a new scope. Reconciling them needs no state-row write; it is a recorded check (this file).
- **Root cause open:** the 10:05 call dies after NST without acknowledging the handoff, on most days since 11-07. It will likely recur at 10:05 today. This is a code investigation, tracked separately.

## Step 5b: rolling recompute, 2026-27 (L6 fixes)
- **Route:** `/api/v1/db/update-rolling-player-averages`, `adminOnly` with `CRON_SECRET`. It upserts `rolling_player_metric_support_payloads` and `rolling_player_game_metrics` on (player_id, game_date, strength_state), 5 strengths.
- **No providers:** it reads `wgo_skater_stats`, `nst_gamelog_*` and the line tables. Never use `fullRefreshMode` rpc_truncate or delete.
- **Window:** 2026-09-29 → 2026-11-11 (last complete NST date). 764 skaters. Expected about 54k rows per table, all upserts and idempotent.
- **README bound:** a window over 15 days must use maxPlayers or resumeFrom.
- **Plan:**
  1. Dry run: `dryRunUpsert=true`, `maxPlayers=25`, `maxRuntimeMs=200000`. Measure duration and row counts.
  2. Live: the same parameters without the dry run, sequential, following `resume.nextResumeFrom`. About 31 calls.
  3. Guards before each call: active queries ≤ 5, none over 10 s, probe under 1 s, no lock or I/O waits.
  4. Stop rules: pause after one call over 120 s; stop on two in a row, any call over 200 s, any non-200, or any 422. A freshness 422 can follow writes, so reconcile before any retry.
  5. Stay outside 10:05–10:55 UTC and the pg_cron slots at 08:00–08:15 and 09:30–10:25.
- **Readback:** rows per game date and strength, `windowCountSupport` present, and dates 11-07 and 11-09–11-11 filled.

## Step 5c: player-trend v3
- pg_cron job 392 (`update-player-trend-metrics`, 12:00Z daily) writes v3 (`player-trend-v3-toi-seconds`) for dates from today − 7 days. Its first run on released v3 code is 11-13 12:00Z.
- The route refuses earlier write dates. Older 2026-27 rows stay v2 as issued history (rule 21); rewriting them needs a code change or a local script.

## Next after this: queue step 10, a FORGE run on the rebuilt inputs (own plan and pop-up).

## Run log (TJ approvals: "Dry run, then run"; "Run with bypass")
- 01:07Z dry run: 25 players, 123 s, nothing written. 422 for 3 freshness blockers. Every source is current through 11-11 (WGO, three NST tables; line/PP tables to game 2026020309), so the blockers are per-player tail gaps. The check runs after writes; a bypass changes only the status code.
- 01:12Z live run at 20 players per call with `bypassFreshnessBlockers=true`:
  - call 1: 132 s, 1,485 rows, 3 blockers;
  - call 2: 155 s, 1,715 rows, 18 suspicious-output diagnostics (no availability ratio above 1 in a bounded check).
  - Stopped by the two-slow-calls rule at cursor 8475208. DB idle throughout.
- 01:19Z resumed from 8475208 at 12 players per call (about 95 s each, under the 120 s rule). Codex H1 is authorized by TJ to run concurrently.

## Pipeline stall root cause (TJ: "Investigate here now")
- Audit rows on 11-05..11-12: `update-nst-gamelog` and `update-all-wgo-skaters` succeed every day by ~10:08Z. On good days the 10:05 call records "continued" by ~10:08 (11-09: 151 s).
- On 11-10, 11-11 and 11-12 the 10:05 call has no audit row. Stage 2's last step, `update-wgo-totals` (season-wide), started about 125 s into the call and ran into the 240 s kill. The stage row stayed `running`; NST-stage leases are never taken over, so all 8 later slots failed.
- pg_cron job 14 already refreshes WGO totals at 07:40 UTC, and no later stage reads `wgo_skater_stats_totals`.
- Fix a25f3f542 (local, unreleased): the totals step starts only in the first 70 s of a call, otherwise it is recorded as skipped. Regression test fails on the old route. 79/79; typecheck 0; ESLint clean.
- 02:08Z TJ restarted the DB from the Supabase dashboard after incident 2 (01:55–02:00Z self-restart).
- 02:12Z resumed (TJ: "Could you curl?") with rolling-resume-slow.py: 8 players per call, 60 s gaps, guards.
  - 29 calls, all 200, 32–53 s each: 232 players, 16,780 rows, 176 suspicious-output diagnostics, 25 freshness blockers.
  - Call 29 (03:00–03:03Z, puck drop for game 308 plus top-of-hour crons) took 201.4 s, so it STOPPED on the plan's "any call over 200 s" rule at cursor 8482105.
  - DB afterwards: same postmaster (02:08:28), 0 active, no waits; logs show only top-of-hour crons and a routine checkpoint.
- **Progress:** 512 of 764 skaters recomputed; 252 remain from cursor 8482105. Not resumed without TJ.
- 03:06Z resumed from 8482105 (TJ: "Resume now"). DONE 03:57Z: 32 calls, all 200 (max 46 s); 252 players, 15,995 rows; 5 guard waits that cleared themselves; remaining 0.
- **Readback (step 5b complete):**
  - Each strength (all/ev/5v5/pp/pk) has 10,727 rows for 764 players, 2026-09-29 → 11-11.
  - Gaps filled: 11-07 432 (NST 431), 11-09 108, 11-10 252, 11-11 216, all matching NST.
  - `windowCountSupport` is present on 100% of support payloads sampled (10-01, 10-15, 10-29, 11-05, 11-10; all and pp).
  - `updated_at` is not refreshed on upsert, so the content check is the proof of rewrite.
