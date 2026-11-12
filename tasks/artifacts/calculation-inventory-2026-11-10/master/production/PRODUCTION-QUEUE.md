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
| 1 | Strength v2 re-normalization, 2026-27 regular season (298 games; NHL API re-fetch, about 1,200 GETs) | L1 note `L1-strength-v2-renormalization.md` | release | plan below, awaiting pop-up |
| 2 | Summary sweep (players + teams) for re-normalized games, then the goalie partition refresh again (same 44-call script) | L1, L2, L2-landing | 1 | plan with step 1 |
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
| 13 | Pause the update-predictions-sko cron (decision 129); gate get-predictions-sko if TJ chooses | L20 | — | to prepare |
| 14 | Log checks for legacy routes (decisions 79, 124) | L19, L20 | — | to prepare |
| 15 | goalie_totals_unified_snapshot refresh | L4a | 0c | to prepare |
| 16 | LEDGER_BASIS_SCHEMA_ENABLED flip (code constant: a commit plus a production release) | L10 | 0a (138) | batch with the next release |
| 17 | Comprehensive FIX-SPRINT-DEBRIEF.md and ASTRA-SPRINT-AUDIT-PROMPT.md | Chef | — | after production steps, or in parallel |

## Step 1 + 2 verified plan: strength v2 re-normalization, 2026-27 regular season
Read-only checks, 2026-11-12 ~15:15Z:
- **Inventory:** 298 regular-season games over 44 dates (2026-09-29 to 2026-11-11), all type 2. All 298 have normalization status `complete` at `strength_version 1` (all PBP events are v1). The deployed code writes `STRENGTH_VERSION 2` (new parser fingerprint), so tonight's games will be v2 and the season will be mixed until this runs.
- **No scheduled re-normalizer:** no pg_cron, Vercel or GitHub job calls `update-nhl-play-by-play`, `update-nhl-shift-charts` or `sweep-gamecenter-normalization`. Cron 381 (09:35Z) ingests only yesterday's games, so it doesn't overlap this range.
- **Route:** `GET /api/v1/db/update-nhl-play-by-play?seasonId=20262027&startDate=D1&endDate=D2&limit=25`, date-range mode. The route rejects any range over 25 games. Per game, sequentially, it makes 4 NHL API GETs (play-by-play, boxscore, landing, shiftcharts; HTML shift report only as a fallback). It then runs one normalization RPC, which replaces that game's events and shifts at v2. It does no summary refresh and makes no NST or Yahoo calls. NHL GETs total about 1,200.
- **Load:** windows are built from the per-date inventory so each holds 25 games or fewer. The first window is the smallest date (3 games), to measure seconds per game. Windows are then sized so projected time stays at 150 s or less (`maxDuration` is 240 s). Calls run sequentially, 10 s apart, with the DB guard before each (5 or fewer active, none over 10 s).
- **Stop on:** any non-200, `NHL_RAW_INGEST_PARTIAL_FAILURE`, `succeededGameIds` shorter than `gameIds`, or a call over 200 s.
- **Reconciliation after each call (read-only):** for the window's games, normalization status is `complete` with the new parser fingerprint and `strength_version = 2`, and event and shift row counts are observed = expected. A partial failure reruns once by `gameId`, then stops.
- **Step 2:** `GET /api/v1/db/sweep-gamecenter-normalization` with the same date window. This is DB-only and refreshes team and player summaries for games normalized after their summaries were built. Limit 50 or fewer, sequential, repeated until nothing is selected. Then rerun the approved goalie partition script (44 calls, about 3 min).
- **Final receipts:** `nhl_api_pbp_events` for the 298 games are all v2; summary markers are fresh; goalie partitions are rev 2. No smoke GETs; the budget is spent.
