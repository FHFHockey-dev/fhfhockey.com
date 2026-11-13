# Fix-sprint production queue after release (Chef; each step needs its own TJ pop-up with a verified plan)

Release: PR #430 squash = master `631a00c19`. fhfhockey `dpl_137qFEpUhovkj9Q6NaPbD4jAHNzP` is READY. Smoke 5 of 5 GETs returned 200. octoberBranch synced as `c577225e2`.

## Done
| # | Step | Receipt |
|---|---|---|
| 0a | Migrations 125–136, 138–140 | authority rows, commits `d08318dce`, `7c3116717`, `82f643878`, `74c85b556` |
| 0b | Goalie summary rebuild 2026-27 (decision 111) | `GOALIE-REBUILD-2026-27-PLAN.md`; 298/298 games at rev 2 |
| 0c | Migration 141 (goalie_totals_unified, regular season only) | `1aa886c92` |

## Remaining, in dependency order
| # | Step | Lane / note | Depends on | Status |
|---|---|---|---|---|
| 1 | Strength v2 re-normalization, 2026-27 regular season (298 games) | L1 | release | **DONE 2026-11-12 19:35Z: 298/298 v2 complete.** Windowed run, then incident, then slow single-game phases A–E; 11 OT games recovered from official HTML (`GAME-2026020159-RECOVERY-PLAN.md`). Changed heads: `HEADS-CHANGED-2026-11-12.tsv`. |
| 2 | Summary refresh for the re-normalized games | L1, L2, L2-landing | 1 | **DONE 2026-11-12 20:03–20:28Z** (serial step 4): team 41,720 rows in 7 windows (0 stale); player 43,764 partition rows in 44 dates; goalie 14,094 partitions, 298/298 at rev 2. Handoff 3 posted to Codex. |
| 3 | xG: v2 shot features for 2026-27; cfg9bac2706 demotion with per-consumer handling (decision 5); aggregate rebuilds; v2 model build, with training and approval separate | L14 `L14-cfg9bac2706-demotion-plan.md`, decision 99 | 1 | to prepare |
| 4 | forge_team_game_strength rebuild (classifier change) | L9a | 1 | to prepare |
| 5 | Rolling rebuild, after reconciling held rolling/FORGE writes; player-trend v3 rebuild | L6 `L6-production-steps.md` | 1, 3 | to prepare |
| 6 | Trend-band history rebuild (decision 36) | L7 handover | 5 | to prepare |
| 7 | Power ratings v3 recompute; CTPI v2; SOS v2 | L12 | 1 | to prepare |
| 8 | Rankings and composite regeneration (dryRun unless a publish is approved); team_unit_toi rebuild | L5 handover | 5, 7 | to prepare |
| 9 | WiGO rebuild | L4b handover | 5 | to prepare |
| 10 | FORGE run with the new L9a/L9b/L9c writers (Codex's H1 run request; Start Chart labels being applied by Codex) | L9a/b/c, Codex | 4, 5, Codex Start Chart labels | Codex coordinates; TJ approval |
| 11 | Reserve projections migration (authority 101, decision 52), then FORGE_RESERVE_PASS_ENABLED | L9a | 10 | to prepare |
| 12 | Index migrations 123/124: confirm whether still needed | pre-sprint queue | — | to check |
| 13 | Pause the update-predictions-sko cron (decision 129); gate get-predictions-sko if TJ chooses | L20 | — | **DONE 2026-11-12 23:50Z** (TJ "send it"): `cron.alter_job(327, active := false)`; readback: job 327 `update-predictions-sko`, 45 10 * * *, active false; the only matching job. Undo: the same call with active := true. |
| 14 | Log checks for legacy routes (decisions 79, 124) | L19, L20 | — | to prepare |
| 15 | goalie_totals_unified_snapshot refresh | L4a | 0c | **DONE 2026-11-12 23:50Z** (TJ "send it"): plain REFRESH in 6.2 s; 402 rows / 3 seasons (materialized 2025-09-29) → 476 rows / 5 seasons; sample 2025-26 goalies match the live view (GP 58/64/56, 5v5 GAA 2.186/2.353/2.700). No app readers. |
| 16 | LEDGER_BASIS_SCHEMA_ENABLED flip (code constant: a commit plus a production release) | L10 | 0a (138) | batch with the next release |
| 16b | Decision-127 default flip: `DEFAULT_FORECAST_CALENDAR_VERSION` in `web/lib/player-forecasts/contributions.ts:14` is still `forecast-calendar-v1`. L11's call sites accept v1 and v2 (`49c9b3501`), and L10 left the default at v1 for a joint flip that never landed. The flip is a one-line code change plus its test pins and a release. `contributions.ts` was released to Scout on 2026-11-12, so re-claim it through the mailbox or ask Scout. | L10, L11 | release | batch with 16 |
| 17 | Comprehensive FIX-SPRINT-DEBRIEF.md and ASTRA-SPRINT-AUDIT-PROMPT.md | Chef | — | after production steps, or in parallel |

## Step 1 + 2 verified plan: strength v2 re-normalization, 2026-27 regular season
Read-only checks, 2026-11-12 ~15:15Z:
- **Inventory:** 298 regular-season games over 44 dates (2026-09-29 to 2026-11-11), all type 2. All 298 have normalization status `complete` at `strength_version 1` (all PBP events are v1). The deployed code writes `STRENGTH_VERSION 2` (new parser fingerprint), so tonight's games will be v2 and the season will be mixed until this runs.
- **No scheduled re-normalizer:** no pg_cron, Vercel or GitHub job calls `update-nhl-play-by-play`, `update-nhl-shift-charts` or `sweep-gamecenter-normalization`. Cron 381 (09:35Z) ingests only yesterday's games, so it doesn't overlap this range.
- **Route:** `GET /api/v1/db/update-nhl-play-by-play?seasonId=20262027&startDate=D1&endDate=D2&limit=25`, date-range mode. The route rejects any range over 25 games. Per game, sequentially, it makes 4 NHL API GETs (play-by-play, boxscore, landing, shiftcharts; HTML shift report only as a fallback). It then runs one normalization RPC, which replaces that game's events and shifts at v2. It does no summary refresh and makes no NST or Yahoo calls. NHL GETs total about 1,200.
- **Load:** windows are built from the per-date inventory so each holds 25 games or fewer. The first window is the smallest date (3 games), to measure seconds per game. Windows are then sized so projected time stays at 150 s or less (`maxDuration` is 240 s). Calls run sequentially, 10 s apart, with the DB guard before each (5 or fewer active, none over 10 s).
- **Stop on:** any non-200, `NHL_RAW_INGEST_PARTIAL_FAILURE`, `succeededGameIds` shorter than `gameIds`, or a call over 200 s.
- **Reconciliation after each call (read-only):** for the window's games, normalization status is `complete` with the new parser fingerprint and `strength_version = 2`, and event and shift row counts are observed = expected. A partial failure reruns once by `gameId`, then stops.
- **Step 2:** `GET /api/v1/db/sweep-gamecenter-normalization?lookbackDays=44&limit=50`. The route has no start or end date: its window runs from today in ET minus `lookbackDays` up to today, and 44 days reaches back to 2026-09-29, so it leaves out the 2026-09-19..26 preseason. It's DB-only and refreshes team and player summaries for games normalized after their summaries were built. Sequential, repeated until nothing is selected. Then rerun the approved goalie partition script (44 calls, about 3 min).
- **Final receipts:** `nhl_api_pbp_events` for the 298 games are all v2; summary markers are fresh; goalie partitions are rev 2. No smoke GETs; the budget is spent.

## Incident 2026-11-12 (step 1 run)
- **15:35:50–15:45:54Z:** 9 sequential windows. Seconds per game rose from about 2.6 to more than 6.6, and the 9th window (2026-10-20..21, 13 games) got no reply within 230 s. The cause looks like write and I/O saturation: a checkpoint took 270 s to write at 15:42Z.
- **Impact, about 15:44–15:50Z:** Supabase REST returned 522 and 5xx errors to the site, and the pooler couldn't check out connections (`ECHECKOUTTIMEOUT`). The script stopped itself on the timeout and sent nothing more.
- **Recovered 15:50:30Z** without intervention: 0 active queries.
- **State:** 146 of 298 games are at v2, each complete with matching row counts. That includes 6 games from the interrupted window, written as whole games. The other 152 games remain at v1, and no game is half-written. The sweep and goalie refresh did not run.
- **Lesson:** a guard that only counts active queries can't see I/O pressure, and 10 s between 20-game windows was too fast. Any resume uses single-game calls, long gaps, a per-call latency stop, a quiet hour, and TJ's approval.

## Step 2 (serial-order step 4) verified plan: summaries for the 298 re-normalized games
I'm not using the sweep route, because it re-warms the season landing cache on every call. These three summary-only routes, run in order, write no raw data, make no provider calls and delete nothing:

**A. Team summaries:** `POST /api/v1/db/rebuild-team-underlying-summaries?seasonId=20262027&gameType=2&startDate=&endDate=`
- The route allows at most 14 days and 120 games per call; it defaults to dryRun.
- Windows of 7 days (about 45 games) or fewer.
- First, one `dryRun=true` call on the first window, to time it and see `rowsGenerated` and `staleKeyCount`. Then real calls window by window (`dryRun=false`).
- Stale keys are reported, not deleted.

**B. Player summaries:** `GET /api/v1/db/update-player-underlying-summaries?seasonId=20262027&gameType=2&startDate=D&endDate=D`
- Date-range mode builds from the stored v2 events and shifts.
- 44 date calls; no cache warming until the final call (`warmLandingCache=true`).

**C. Goalie partitions:** the approved 44-date goalie script again (it took about 3 min last time).

**Guards for every call:**
- DB preflight first: probe under 1 s, no query over 5 s, no I/O or lock waits.
- 10 s between calls.
- Stop on a non-200, `success:false`, 0 rows for a window that has games, any call over 150 s, or pressure that doesn't clear.
- The first call of A and of B is the smallest window, to time it.

**Readback:**
- Team: rows per window as expected; stale keys listed.
- Player: partition `formulaRevision` is 2 for all 298 games.
- Goalie: 298/298 at rev 2.
- Smoke: none (budget spent). If wanted, one GET each on the player and team landing APIs, with your OK.

**Handoff:** when C ends, post Claude DB handoff 3 for the DRM repair (step 5).

## TJ approvals, 2026-11-13 ~00:00Z (pop-ups)
- **H1 game 2026020307:** let it pass. Codex plans properly for a later game: compute on with a canary for that game, a clean-export deploy, and the full HTTP footprint. Codex owns H1.
- **Next Claude production work:** FORGE inputs first (forge_team_game_strength, rolling, player-trend v3), each as its own verified plan and pop-up.
- **Flag release:** prepare a small release for `LEDGER_BASIS_SCHEMA_ENABLED` and the decision-127 default. Re-claim the files from Scout through the mailbox; gate; push and merge by pop-up.
- **Index migrations 123/124:** check need read-only, then a CONCURRENTLY plan if still needed.
- **Approved read-only work:**
  - Decisions 79/124 legacy-route log check (Vercel runtime logs, 7 days).
  - PP clock qualification reads (L8).
  - The 42 IPP rows (L20 D5).
  - WiGO PP/PK floor split-half validation (L4b).
  - BEAST v3 cut-off analysis (decision 139).
- **Approved write:** 2025-26 goalie partition rebuild, summary-only, paced (about 190 dates, 1,417 games).
- **Debrief:** finalize now, with remaining steps marked pending; write the Astra prompt.
- **Decisions 135–138:** implementation needs lanes and re-claimed files; production steps are separate approvals.

## Log check (decisions 79/124), 2026-11-13 ~00:05Z: inconclusive with available tools
- Vercel runtime logs on this plan (Pro) go back **1 day**, and they contain only console output, not every request.
- Last 23 h, production: no logged activity on `/api/Averages/[playerId]`, `/api/ThreeYearAverages/[playerId]`, `/api/v1/ml/get-predictions-sko` or `/api/v1/forge/scoreboard`. Only our own cron routes `update-wgo-averages` and `update-predictions-sko` matched.
- Request-level counts need **Vercel Observability Plus** (API returned 402 payment_required) or the Vercel CLI request logs (not installed here).
- **Not proof of zero external use.** Options for TJ: check the Vercel dashboard request logs by path, install and authenticate the Vercel CLI, or enable Observability Plus.

## Read-only results, 2026-11-13 (agent, verified by Chef where noted)
**BEAST (decision 139):**
- Cut-offs are `BEAST_TIER_GATES` (`skaterCompositeMethodology.ts:114`), carried over from v2.
- The stored snapshot is `contextual_composites_v1` (2026-11-07, written 11-09) and predates v3.
- v3 simulation on 5v5, all skaters: switching to mid-rank moves only one player's tier (2 / 30 / 49 / 67 for BEAST+ / BEAST / MCM / Watch).
- **Proposal:** keep the same numbers, recorded as the v3 gates. Re-check the default all-strengths view after regeneration.

**Composite regeneration blocker (Chef-verified):** `skaterCompositeWriter.ts:202-224` checks percentiles with the exclusive formula `100·worse/(n−1)`, while the rankings emit mid-rank (decision 90). Ties fail, and the writer refuses non-dry-run writes. No cron runs the writer. Ticket sent to L5.

**Indexes 123/124 are still needed:**
- Neither exists. `pg_stat_statements` over about 8 h:
  - the player-page coverage query: 267 calls, mean 313 ms, max 2.5 s against a 3 s timeout;
  - `line_source_snapshots` newest-500: mean 3.5 s, max 6.8 s against an 8 s timeout;
  - `lines_ccc`: mean 1.1 s.
- 124 (12 MB and 5 MB tables) is trivial.
- 123 (`wgo_skater_stats`, 2.2 GB): must use `CREATE INDEX CONCURRENTLY`, about 3–10 min, outside a transaction. The migration file's plain `create index` would lock WGO writes. Run it after the 2025-26 goalie rebuild, off-peak.
- Optionally add a partial `where team_abbrev is not null`, and drop one of two identical date indexes (separate approval).

## PP clock qualification check, 2026-11-13 (read-only, agent; flag state Chef-verified)
- `PP_CLOCK_QUALIFIED = true` is already on master `4243bcd4e`, via Codex DRM `866b90bc4` / `24b1cb4d3`. No consumer serves PP share yet.
- **Match rate:** the simulated clock matches official `powerPlayToi` on 238 of 240 sampled team-games exactly. The 2 mismatches look like official-field errors.
- **Audit false positives:** the per-game audit wrongly unqualifies 7.5% of team-games, all events at manpower-change seconds. A fix was proposed to Codex.
- **Open:** a disagreement policy (TJ decides, Codex to propose); a full-season run; the storage table and consumer wiring. Mailbox `CLAUDE-PP-CLOCK-QUALIFICATION-EVIDENCE-20261113`.

## IPP rows and WiGO floor (read-only, agent, 2026-11-13; 36 bounded queries)
**L20 W3-7 D5, 43 rows in 2026-27 (points above on-ice GF):**
- **31 rows:** the excess points are assists on goals where shift charts have the player **off the ice**, 1–11 s from a shift boundary, so he changed off after the pass. Stored GF equals the shift-chart on-ice count exactly. This is a property of shift-based on-ice counts, not a writer bug. There's no evidence of extra-attacker or empty-net omission: the 4 empty-net goals with the player on ice are all counted.
- **12 rows:** null GF, because the NHL goalsForAgainst report has no row when the player was on ice for no goals. One exception is unexplained (8480834, game 2026020104).
- **Recommendation:** rename the guard reason to "points include goals while off ice"; compute IPP only over pooled windows; owner decision on whether a missing report row means 0/0/0.
- Earlier seasons have about 1,400 such rows each, not examined.

**L4b W3-1 D3, WiGO floors** (2025-26 split-half reliability, threshold ≥ .5 full-season):
- **PP:** 60 min. Forwards .55, defence .63; 30 min gives only .37–.47.
- **PK:** about 120 min (.52/.55), and still weak, so label it low reliability.
- These replace the provisional 30 min, and need owner approval.

## Production alias restored from Codex's temporary H1 deployment, 2026-11-13 00:25Z (TJ pop-up "Restore now")
- Found: Codex created production deployment dpl_GK6quj7ogBxcQE3FZxV3VDzSTvjM at 00:06:40Z (CLI, source 4243bcd4e) with per-deployment overrides: H1 compute on, canary game 2026020307, scheduler off. fhfhockey.com pointed at it. Codex's diary (`tasks/diaries/2026-11-13-codex-h1-execution.md`, 00:19Z) records that no H1 request was sent: its one POST and its restore were both blocked pending TJ's direct approval.
- Action: promoted the original Git deployment dpl_HH8SPE1cLyonVBW9uN3rUi1MN3Sa (same commit 4243bcd4e, project env). Alias swap only, no build.
- Readback: the dpl_HH8 aliases include fhfhockey.com, www (redirect) and fhfhockey.vercel.app. `GET /api/healthz` returned 200 in 1.25 s; HEAD x-vercel-id iad1 at 00:25:52Z. No H1 write for game 307, as TJ chose earlier ("let 307 pass").
- Next release: confirm the new master deployment auto-aliases to production. Promoting an older deployment may leave auto-assignment paused; if so, promote the release deployment.

## Release #431, 2026-11-13 (TJ pop-up "Push and merge")
- Candidate 981953daa is octoberBranch ec85232a1 without diaries, on top of master 4243bcd4e. Gate on a clean export: typecheck 0; ESLint 0 errors; pytest 213 plus the 4 known git-history tests. Vitest's only failures were environment-only or already failing on master.
- 00:35:06Z: pushed chef/fix-sprint-followups-20261113. No deployment and no checks at ~90 s.
- 00:36:38Z: PR #431 squash-merged as master 502a93b4c; its tree equals the candidate.
- Vercel: fhfhockey dpl_2bhMeBzKvwzq8a3Cw36uAPLKymKE building; cms-fhfhockey, functions-fhfhockey and fhfhockey.com CANCELED.
- Then: confirm the alias (after tonight's promote, auto-assignment may be paused), run the smoke (5 GETs), and do the octoberBranch ours-merge push with a no-build watch.

## Cron overlap found, 2026-11-13 (read-only; decision pending)
- pg_cron 305 build-forge-derived-v2 is active at `05 10 * * *`. It was 09:50 until Codex's 24b1cb4d3 on 11-12.
- Vercel cron 6 run-rolling-forge-pipeline (`includeDownstream=true`) starts at 10:05 and also runs build-projection-derived-v2.
- `combinedCronInventory.test` fails on master because of this.

## 2025-26 goalie partition rebuild (TJ-approved, summary-only), 2026-11-13
- Run 1 ($TMPDIR/goalie-2526/run.py): 178 calls, 0 failed; 1,343 games and 62,805 partitions reconciled at formulaRevision 2. Slowest call 19.4 s. The landing cache was warmed on the last regular-season date (2026-04-16, 200).
- 00:43:33Z: STOP on its guard at 2026-04-27. Game 2025030135 had no partition after one retry. Bounded read: games 2025030135–137 (CAR–OTT games 5–7) exist in `games` but have no raw payloads, because the series ended in 4. They are unplayed "if necessary" games, so the stop was a false alarm and nothing was half-written. The 1,417 count included 23 such games.
- 00:44:17Z: resumed (run2.py) from 2026-04-27 with only games that have raw payloads: 42 dates, 51 played games, 23 unplayed skipped. Same pacing, guards and stop rule; the cache is warmed on the last playoff date.
- 00:50:16Z: DONE. Run 2 made 35 calls, 0 failed; 51 games and 2,359 partitions; landing cache warmed on 2026-06-14 (200). Season coverage: 1,394 games, 65,164 partitions, 0 below formulaRevision 2.

## Cron 305 moved, 2026-11-13 00:50Z (TJ pop-up "Move 305 to 10:25")
- `cron.alter_job(305, schedule := '25 10 * * *')`. Readback: 305 build-forge-derived-v2 is `25 10 * * *`, active, same route. Pre-check: 0 active queries.
- cron-schedule.md updated in 8942d193b; combinedCronInventory 42/42 passes.

## Migrations 142 and 143 applied, 2026-11-13 00:51Z (TJ pop-up "After the rebuild")
- 142: v2_skill nullable numeric plus CHECK; composite_skill_score unchanged.
- 143: viewdefs replaced. Traded skaters' percent_games went from NULL to GP / games available, e.g. 0.8675, 0.6667, 0.6250. Two players with no team match stay NULL (rule 13); the single-team control stays 1.0.
- Ledger rows inserted for both. Authority now has 106 applied and 9 pending.

## Release #432 and DB incident 2, 2026-11-13
- Release #432 (TJ pop-up "Push and merge", after Codex's H1 handback):
  - Branch pushed 01:47:04Z; no build or checks at ~100 s. PR #432 squash-merged 01:48:52Z as master e1ab46318 (tree = candidate 10bec8b32).
  - fhfhockey dpl_7MEwsPkGHYco15B5jwjyLoDoubjU READY 01:55:24Z and auto-aliased; cms, functions and fhfhockey.com CANCELED.
- Smoke: healthz 200 (0.13 s); `/` timed out at 45 s, so the smoke stopped there.
- **DB hang:** Postgres logs stop at 01:55:12Z, right after "checkpoint starting: time". The previous checkpoint wrote for 270 s. Connections via the session pooler fail ("authentication did not complete within 15000ms", then "{:error, :timeout}"). The control plane says ACTIVE_HEALTHY.
  - Starter-board audits fail from 01:56:39 ("Audit acknowledgement timed out").
  - Rolling recompute call 21 (started 01:55:25) got a 504 at 240 s; the runner stopped itself at 01:59:25 (cursor 8478831; calls 1–20 at 200).
  - Release #432 wrote nothing to the DB.
- Probable cause: sustained write load tonight on a burst I/O budget, the same pattern as 11-12. Contributors: 2025-26 goalie rebuild, migrations, rolling recompute (~1,000 rows per 100 s plus jsonb support payloads), Codex H1.
- TJ: "Wait and watch". One short probe per minute for up to 10 min, nothing else against the DB.
- **Recovery:** Postgres restarted at 02:00:46Z (`pg_postmaster_start_time`). Logs show "not accepting connections" at 02:00:46, then pg_cron restarted at 02:00:49. No PANIC or OOM line in the Supabase log stream. Probe at 02:03:58: up, not in recovery. Hang lasted 01:55:12–02:00:46 (~5.5 min).
- Smoke (budget 5) after recovery: `/` 200 0.87 s, `/drm` 200 0.32 s, `/game-grid` 307 (redirect to the default view).
- octoberBranch ours-merge 7f3e6ae09 (tree unchanged) pushed 02:04:45Z; no-build watch running.
- Rolling recompute paused at cursor 8478831: 280 of 764 skaters written (calls 1–20 at 200). Call 21 (12 players) is uncertain, but it is idempotent upserts, so a resume from 8478831 redoes it. Resuming needs TJ's re-approval, as after 11-12.
- 02:08:28Z: TJ restarted the database from the Supabase dashboard (`pg_postmaster_start_time` 02:08:28). At 02:08:44: up, not in recovery, 0 active queries. The rolling recompute is still paused at cursor 8478831; TJ will resume it with the slower steps (8 players per call, 60 s gaps).
- 03:57Z: 2026-27 rolling recompute complete (L6 fixes): 764 skaters × 5 strengths, 10,727 rows each through 11-11, every sampled payload on the L6 shape. Details in FORGE-INPUTS-PLAN-2026-11-13.md. Queue step 5 is done: holds recorded only (TJ), rolling rebuilt, trend v3 forward-only via job 392 (TJ: keep v2 history).

## Reserve projections table (queue 11), 2026-11-13 05:39Z (TJ pop-up "Table now, flag next release")
- Migration 20261027090000 (authority 101) applied with `psql -1` (the file sets local timeouts and has no begin/commit); sha256 matches. Pre-check: 0 active queries.
- Readback: `forge_reserve_projections`, 28 columns, RLS on, 1 select policy, pkey plus 2 indexes, anon/authenticated SELECT only. Ledger row inserted. Authority now has 107 applied and 8 pending.
- `FORGE_RESERVE_PASS_ENABLED` stays unset until it ships with the next release.

## Early run of approved steps, 2026-11-13 ~06:57–07:05Z (TJ: "All steps now", before the 08:00Z cron window)
- **Index 124** applied in 2 s (`psql -1`, file sha matches authority). `line_source_snapshots_observed_at_idx` (192 kB) and `lines_ccc_observed_at_idx` (88 kB) are valid and ready. Ledger row inserted.
- **Power ratings v3:** 45 one-day calls (09-29 → 11-12), all 200, about 1–4 s each, 32 upserts per day, no guard waits. Readback: 1,440 rows, all `team-power-v3-all-team-baseline-prior-after-norm-pooled-st`, 32 teams. The legacy and v2 rows were replaced.
- **xG champion demotion (decision 5):**
  - Backup: `xg-demotion-2026-11-13/registry-backup.json` (2 rows) and `aggregate-counts.txt` (team-game 2,772, goalie-game 2,922, player-game 42,236, team-rolling 8,316, all cfg9bac2706).
  - At 07:01:40Z, one transaction set `logistic_l2-s20252026-p1-st1-f1-cfg9bac2706` to `is_active=false`, `is_champion=false`, `approval_status='retired'`; `model_approved` is kept.
  - Readers (3 GETs): team-timeline `model:null` (`no_active_approved_model`), xG Lab `modelVersion:null` with 0 rows, homepage 200 with no reference to the model. The FORGE prior (env pin unset) is unaffected.
  - Rollback: restore the row from the backup.
- **Index 123** at 07:02:13–07:02:50Z: `create index concurrently` on `wgo_skater_stats (team_abbrev, date)` with `statement_timeout=15min`, run alone and outside a transaction. Built in 37 s. Readback: valid, ready, 17 MB. Ledger row inserted. Authority rows 123 and 124 are applied; counts are now 109 applied, 9 pending, 28 unknown.
- **Remaining:** the dry runs (rankings, composites, team_unit_toi, trend bands) in the 08:20–09:25Z gap; the WiGO check after the 08:50Z cron; the pipeline check at 11:01Z.
- **Dry runs** at 07:03–07:05Z, all 200, no DB load:
  - rankings: 50,320 rows, 14.7 s;
  - composites: `publication.ready`, 764 candidates, 13.2 s;
  - team_unit_toi sample 11-01..04: 24 games, 3,054 rows;
  - trend bands, 10 players: 8,160 bands, 2.4 s.
- **Composites v3 published** at 07:05:55Z (TJ "Publish now"): 764 rows, snapshot 11-11, `contextual_composites_v3`. BEAST tiers (5v5 season): BEAST+ 2, BEAST 24, MCM 53, Watch 63, against the simulation's 2/30/49/67.
- **Rankings written** at 07:06Z (TJ "Write now"): 50,320 upserts in 41 s; snapshot 11-11 has 12,580 rows in each of the season, last_5, last_10 and last_20 windows.
- **team_unit_toi rebuilt** at 07:07–07:08Z (TJ "Rebuild now"): new snapshot 2026-11-13 in 12 four-day batches, all 200. 39,506 rows over 299 games: 37,863 complete and 1,643 partial.
  - The partial rows are 13 games with `goalie_shift_missing_seconds` between 2 and 46. The L5b builder labels these honestly; the old 11-08 snapshot called everything complete.
  - Lane F3's Lines 5v5 switch (ff873398d) can now ship.
- **Trend bands:** later, paced (TJ), after the 11:01Z check: about 10 players per call with 60 s gaps, avoiding 11:15–11:40Z.
- **WiGO check** (read 11:02Z): pg_cron 231 ran 08:50:01–08:51:52Z (111 s, no budget stop). It processed 988 of the 990 listed players and upserted 1,976 rows (2 per player).
  - Of `wigo_career`'s 7,845 rows, the other ~5,870 belong to players outside the current list, so they are not rewritten daily; the "all rows fresh" expectation in the plan was wrong.
  - Audit status is `failure` because the fixed writer rejected 2 players for `missing_identity`: Glenn Gawdin 8478446 (2022-11-12) and Ben McCartney 8481827 (2021-11-06). Their `wgo_skater_stats` rows have no team, opponent or game id. The writer keeps them unwritten by design; their old `wigo_career` rows stay. A 2-row WGO repair would clear it (needs TJ).
- **Pipeline check at 11:01Z** (`daily_incremental:2026-11-13`): all 11 stages `complete` by 10:46:19Z. Stage 2 `upstream_skater_sources` completed at 10:07:53 (the a25f3f542 fix, released in #432, held). FORGE runs `succeeded` for 11-13, 11-14 and 11-15 (created 10:20–10:31). Rolling has 396 rows per strength for game date 11-12.
  - `update-nst-gamelog` (10:05:29–10:06:12) logged `failure`: 395 players and 6,688 rows landed, but 1 troublesome player made 16 of 20 datasets `parse_or_identity_unresolved`. The player is Josh Mahura 8479372 (SEA D): WGO has 14 games, NST has 12, missing 11-07 and 11-12. The 11-08 run (game date 11-07) failed the same way. The players table has one Mahura row, so NST is likely listing him under a different name or provider id on those dates. Follow-up: identity alias, no NST calls made.
- **Trend bands** started as a paced background run (TJ "Later, paced"): `trend-bands-2026-11-13/trend-bands-history.py`, from 11:41Z, 769 players at 10 per call, 60 s gaps, pause 11:58–12:08Z for job 392, stops on any non-200, per-player error, call over 60 s or guard failure. Table: `sustainability_trend_bands`, 5.2 GB, ~11.0M rows before the run.
- **Trend bands DONE** 13:16:02Z: 77 calls, 769 players, 666,376 bands, all 200 (max 9.5 s), guard waits only (each cleared). Readback by snapshot date: about 60 bands per player per snapshot (10-01 484 players, 10-21 208, 11-12 528).
- **F2b** (TJ "Landing fix first"): `ebfc82bc7`. The underlying-stats landing reads the latest `team_sos_daily` v2 snapshot within 7 days and never `sos_standings`. 8 regression tests fail on the old code; underlying-stats tests 219/219; typecheck 0; ESLint 0.
- **Migrations 144, 145, 146** applied singly at 13:16:37, 13:16:47 and 13:16:56Z (TJ "Yes, after trend bands"). Each matched its header readback; ledger rows inserted; authority now 112 applied / 6 pending (`cd5604159`).
- **Release #433** (TJ "Yes, watch via GitHub"):
  - Candidate `359789456` (octoberBranch `cd5604159` tree without diaries) was gated in a clean export: typecheck 0, ESLint 0, PG15 proofs OK. The vitest and pytest failures were export-only, and each passes in the checkout.
  - Branch `chef/release-2026-11-13-f1-f4` pushed 13:25:22Z; no status, deployment or check run at 95 s.
  - Squash-merged as master `4d9b6a10d`, tree identical to the candidate.
  - GitHub statuses: fhfhockey "Deployment has completed" at 13:31:56Z; fhfhockey.com, functions-fhfhockey and cms-fhfhockey canceled by the Ignored Build Step. The Vercel MCP was unavailable (list_deployments disabled in connector settings), so the watch used GitHub statuses.
  - TJ set `FORGE_RESERVE_PASS_ENABLED=true` in production before the merge.
- **Smoke** (5 sequential GETs, all 200): `/api/v1/trends/team-sos` (descriptive-sos-v2), `/api/v1/trends/team-ctpi` (0 teams: the v2 candidate is gated by design, W1-4; v1 is frozen), `/underlying-stats`, `/lines/EDM` and `/`.
- **Post-release runs** (TJ "Run them after release"; `release-433-followups/post-release.py`), all 200:
  - `update-games`: 1,409 games for 2026-27, all with a stored state (OFF 309, FINAL 65, FUT 1,035).
  - CTPI v2 backfill in 2 chunks: 622 + 480 rows. v2 has 1,102 rows over 38 dates (10-07 → 11-13); v1 is unchanged at 9,489.
  - `update-team-sos`: 32 rows, 1 cutoff, 0 pending. Every team has 84 fixtures (the lane note expected 82; 2026-27 is an 84-game season). `sos_standings` is unchanged at 15,680 rows.
- **Open decision:** Recent Team Form (CTPI) has no served rows until v2 is validated and approved (W1-4). Readers default to v2, and v1 can't receive new rows.

## Log check (decisions 79/124), 2026-11-13 ~14:55Z: request logs, last day
- Source: the Vercel dashboard (TJ's signed-in Chrome, read-only), project fhfhockey → Logs → **Request Logs** view (every request, not only console output), timeline "Last day". That's the longest window without Observability Plus, a paid upgrade that wasn't used.
- Request Path facet search (case-insensitive):
  - "verages" matches only our crons `/api/v1/db/update-rolling-player-averages` and `/api/v1/db/update-wgo-averages`, so the facet works;
  - "ThreeYear": no matches;
  - "sko": only our cron `/api/v1/db/update-sko-stats`, no `get-predictions-sko`;
  - "scoreboard": no matches.
- **Result:** 0 requests in about 24 h to `/api/Averages/[playerId]`, `/api/ThreeYearAverages/[playerId]`, `/api/v1/ml/get-predictions-sko` and `/api/v1/forge/scoreboard`. One day of evidence: it rules out a daily caller, not a weekly or occasional one.
- **Release #434** (TJ "Push and merge"):
  - Candidate `01ed7f7bc`: octoberBranch `6873c28ce` tree without diaries, Codex items 1/2/6 (`fc34b053a`, `284f99045`, `c89ff5d24`) and the beta card (`122dd880b`). No migrations.
  - Gate:
    - typecheck 0, ESLint 0 errors, CSS pure 2/2;
    - Vitest 19,754 passed; its 20 failures are in 6 git- or checkout-dependent files, which pass in the real checkout (179/179);
    - pytest 217 in the checkout;
    - TweetSwipeTrainer and planning 195/195 solo;
    - both RSO readers' AF-01 tests fail on the pre-fix code and pass on the candidate (129/129).
  - Branch `chef/release-2026-11-13-final` pushed 15:54:25Z, with no build at 90 s.
  - PR #434 squash-merged as master `496ab3766`, tree identical to the candidate.
  - Build: fhfhockey deployment completed at 16:01:05Z; fhfhockey.com, cms-fhfhockey and functions-fhfhockey canceled by the Ignored Build Step.
  - Smoke, 5 sequential GETs, all as expected:
    - `/api/v1/trends/team-sos` 200 (`metric: points-pct`);
    - `/api/v1/ml/get-predictions-sko` 503 (withheld, decisions 124/129);
    - `/underlying-stats` 200, `/lines/EDM` 200, `/` 200.
  - octoberBranch ours-merge `94d7c2340` pushed at 16:01:45Z, with no build at 90 s.
- **Release #435** (TJ "Push and merge"):
  - Candidate `75dce268c`, master `496ab3766` plus F16's version-aware power labels (`486b18a6f`), F9's writer dry run (`2bf3c1d26`) and the CTPI descriptive beta card (`122dd880b`, `17b342f76`, `3b6d82edc`). Codex items 1/2/6 still held. No migrations.
  - Gate:
    - typecheck 0, ESLint 0 errors, CSS 1/1;
    - Vitest 19,787 passed; its 20 failures are in 6 git-dependent files, which pass in the checkout (179/179); pytest 217;
    - TeamPowerCard fail-first confirmed by the Chef.
  - Branch pushed 16:34:44Z, with no build at 90 s. PR #435 squash-merged as master `6f1cb0767`, tree identical to the candidate.
  - Build: 1 fhfhockey build plus 3 cancels, settled by 16:42:48Z.
  - Smoke, 5/5 at 200:
    - `/api/team-ratings?date=2026-11-12` serves `calculationVersion` (v3) and `sourceThroughDate`;
    - `/stats/team/TOR`, `/forge/command-center`, `/underlying-stats` and `/`.
  - octoberBranch ours-merge `251a4f7bf` pushed 16:43:20Z, with no build at 90 s.
- **Power ratings v4 rebuild** (decisions 145, 147, 150; TJ "Approve, Claude runs it" after the live no-write preflight):
  - Preflight at 16:45Z, PREFLIGHT_OK with 0 writes; the Chef confirmed no write, no 2000-01-01 row and no audit row.
  - Run at 16:46–16:53Z: deployed-writer gate `6f1cb0767`; dry-run probe v4; pre-run snapshot of 1,472 rows (sha256 84d4ac83…); 46 calls (09-29 → 11-13), all 200; one guard wait, which cleared.
  - Per-date readback: 09-29 10 v4 + 22 carried, 09-30 15 + 17, 10-01 25 + 7, 10-02 31 + 1, then 32 v4. DONE.
  - Chef readback:
    - 1,425 `team-power-v4-5v5-goaltending` (09-29..11-13, goalie_rating never null);
    - 47 `legacy_unversioned`, all source 2026-08-29 and equal to the team's 09-28 row;
    - 0 v3 left;
    - `/api/team-ratings?date=2026-09-29` serves 22 legacy (source 2026-08-29) + 10 v4.
  - Log (on disk, gitignored): `production/power-g5v5-2026-11-13/run/rebuild-2026-11-13T1646Z.jsonl`. Backups: `run/issued-rows-…tsv` and `run/pre-run-20261113T164613Z.tsv`.
  - Cron 283 writes v4 from 2026-11-14 10:15Z (05:15 ET).
- **Release #436** (TJ "Push and merge"):
  - Candidate `353a73a31` on master `6f1cb0767`: F17 `f2df257b6` (social score withholds missing stats), F8 `3e7e42aa4` (batched /lines reader, about 293 → about 10–12 reads per regeneration), F11 `de4650c77` (PP clock C1/C2; PP share still withheld). No migrations; Codex 1/2/6 still held; the beta-card wording fix not yet committed.
  - Gate:
    - typecheck 0, ESLint 0 errors;
    - Vitest 19,807 passed; its failures were the git-dependent files plus requestBudget, which passes 21/21 solo;
    - the git-dependent files pass 177/177 in the checkout; pytest 217.
  - Branch pushed 17:13:51Z, with no build at 90 s. PR #436 squash-merged as master `4b45d8f1a`, tree identical to the candidate.
  - Build: 1 build plus 3 cancels, settled 17:20:16Z.
  - Smoke 5/5 at 200: `/lines`, `/lines/EDM`, `/api/team-ratings?date=2026-11-12`, `/underlying-stats`, `/`.
  - octoberBranch `1c8149ff0` pushed 17:20:30Z, with no build.
- **Data repairs, F18** (TJ approved both by pop-up in the F18 session, about 17:15Z; report `production/data-repairs-2026-11-13/REPORT.md`):
  - **WGO legacy identity:**
    - About 17:16Z, a guarded `DO` block set game_id, team, opponent and home/road on exactly **14** `wgo_skater_stats` rows: Gawdin 8478446, 12 rows from 2020–23; McCartney 8481827, 2 rows from 2021.
    - Sources are 4 NHL game-log GETs. All 14 match on date, TOI, goals, assists and shots. The WiGO frame check is now 0 bad rows.
    - Fixing only the 2 reported rows would have moved the failure to the next row.
    - Rollback limit: `game_id` can't return to NULL while the NOT VALID check exists.
  - **Mahura NST re-fetch:**
    - The cause was a stale alias ("Josh Mahura" → "Joshua Mahura"); the code fix `77a6e7592` ships in the next release.
    - Re-fetches ran on TJ's localhost:3000 against production, through the shared NST admission. 11-07 completed (20 datasets). 11-12 was partial: a dev-server error, `writePersistence not_confirmed`, and the failed write committed nothing. Narrow re-runs of 11-12 evenStrength and penaltyKill then completed.
    - About 38 NST requests in total, within every window. Mahura now has 16/16 non-PP rows on 11-07 and 11-12, and NST matches WGO at 14 games.
  - **Noted:** nearly all 2020-21 to 2022-23 WGO rows lack game identity, so other call-ups may trip WiGO the same way. That's a wider backfill, recorded as a ticket.
- **Migration 148** (TJ "Apply now"): `20261113200000_forge_strength_penalty_shot_split`, applied 17:28:45Z, with readback (6 nullable columns, 2 CHECKs, v1 wrapper plus v2, grants postgres/service_role, row counts unchanged, 0 split rows). Ledger row inserted; authority 113 applied / 7 pending (`05a2843e6`).
- **Release #437** (TJ "Push and merge"):
  - Candidate `4cf33215a` on master `4b45d8f1a`:
    - F15 penalty-shot split, readers and parity (`30fa0f00a`, `8a4a7d8d1`, authority `2a9227343`);
    - F18 NST alias (`77a6e7592`);
    - the beta-card same-games fix (`a32478cb0`);
    - item 6's SQL, proof and rollback only (inert, pending order 147; its code held).
  - Gate: typecheck 0, ESLint 0 errors, PG proofs f15 and item6 OK, Vitest 19,824 passed; the 5 git-dependent files pass 177/177 in the checkout; pytest 217.
  - Branch pushed 17:36:35Z, with no build. PR #437 squash-merged as master `b6d43efdc` (tree identical). Build settled 17:42:57Z with 1 build plus 3 cancels.
  - Smoke 5/5: `/`, `/splits`, `/stats/team/PHI`, `/lines`, `/underlying-stats`.
  - octoberBranch `5f782c420` pushed 17:43:11Z, with no build.
- **Penalty-shot rebuild:** dry run at 17:44–17:45Z, DRY_RUN_OK on `b6d43efdc` (8 games, all baselines equal to the official boxscores). `--execute` started about 17:46Z (TJ "Run it, Claude").
