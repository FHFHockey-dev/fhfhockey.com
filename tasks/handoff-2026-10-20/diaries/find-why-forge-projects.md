# Handoff diary: FORGE proj_hits / proj_blocks zeros (2026-10-19 → 10-20)

## 1. Scope
- **Started from:** the Chef/orchestrator session local_08a0bf1c.
- **Task:** diagnose why FORGE v2 skater rows had proj_hits / proj_blocks = 0 for established players, propose a fix, then implement it once TJ approved.
- **Evidence from the brief:** the 2026-10-19 RSO snapshot showed 50/356 skaters with HITS=0, 61 with BLOCKED_SHOTS=0 and 24 with both (Pulock, Severson, Broberg, Schaefer, Larkin, Panarin, Kuzmenko).
- **Second question:** is early-season shrinkage too weak (Larkin vs Matthew Wood shots and goals)?
- **TJ approvals, in order:**
  1. 4 read-only production queries (Q1–Q4).
  2. Implement F2 + F3 locally with no commit.
  3. Started the calibration proposal (task_43b994ce, session local_24b29608).

## 2. Where
- **Branch:** octoberBranch in /Users/tim/Code/fhfhockey.com.
- **Commits:** the fix, with the constants as calibrated by local_24b29608, is in b8fe1072e. That is TJ's commit, "sfgsdfgsdfgsdf", 2026-10-19 20:57 −0400. It is on origin/octoberBranch.
  - HEAD is 392c02af2, a sync from master b630e0767 (R6f).
  - **b8fe1072e is NOT in master / R6f.** Checked: `computeSkaterPhysicalEventRates` is absent from b630e0767 and origin/master.
- **Files I changed:**
  - web/lib/projections/queries/skater-queries.ts
  - web/lib/projections/types/run-forge-projections.types.ts
  - web/lib/projections/constants/projection-weights.ts
  - web/lib/projections/calculators/skater-adjustments.ts
  - web/lib/projections/stages/skater-stage.ts
  - Tests: runProjectionV2.test.ts, queries/skater-queries.test.ts, nativeGoalAccounting.test.ts
- **Notes:** side-session-notes/local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41/forge-hits-blocks-zeros-2026-10-19.md holds the diagnosis, the Q1–Q4 SQL and results, and the implementation summary.

## 3. State
- **Diagnosis (confirmed with Q1–Q4, read-only):**
  - At EV, rolling hits_per_60 / blocks_per_60 take their counts only from NST `nst_gamelog_es_counts`.
  - 3,311 of 4,499 skater-games in 2026-27 (74%) had no NST EV row. In the sampled players the last row was 2026-10-03; this matches ops-health P-I, the NST gamelog backlog.
  - The last-5 window counts appearances. While it still held 1–2 early NST games with 0 events, the rate was exactly 0. FORGE used that finite 0 with no fallback and no shrinkage.
  - Where NST rows existed, their values agreed with WGO.
  - The 10-19 run itself had 4 hits-zero, 12 blocks-zero and 2 both-zero rows out of 141 skaters. The RSO bridge's 7-day latest-run-per-team window made the snapshot worse.
- **Fix in b8fe1072e:**
  - `fetchRollingRows` accepts `"all"`. The skater stage reads the all-strength row, which has a WGO fallback and includes PK.
  - `computeSkaterPhysicalEventRates` computes `w·last5 + (1−w)·baseline`. The baseline is the three-season totals shrunk toward an F/D prior.
  - TOI = (ES+PP) × the recent all/(ES+PP) ratio, capped.
- **Constants:** local_24b29608 later recalibrated them on WGO 2024-26 data, with separate hit and block scales and a TOI cap of 1.3.
- **My checks on my version:**
  - Focused Vitest: 205/205 passed.
  - Wider suite (`lib/projections`, `lib/rosterScheduleData`, run-projection-v2 route, forge API): 64 files, 1313 tests passed.
  - `tsc --noEmit` exit 0; it needs `NODE_OPTIONS=--max-old-space-size=8192`, because the default heap runs out of memory.
  - ESLint clean.
  - After calibration I re-ran the 3 focused files: 205/205 passed.
- **Follow-on commit:** the recency-weighting line (local_d181f1c6) committed its league-to-date rescale on top of b8fe1072e as 34a5588db, "FORGE hits/blocks: rescale prior seasons to the league rate to date" (13 files).
  - It is local on octoberBranch: not pushed, not released, and its migration is not applied.
  - It is not my work. Its 1,314 passing Vitest tests and clean ESLint are that session's report; I did not run them.

## 4. Next
- Nothing is planned in this session.
- **Release gate:** b8fe1072e and 34a5588db go out together through the octoberBranch → master release flow in AGENTS.md. The 34a5588db migration has to be applied first.

## 5. Blocked / needs TJ
- **Releasing b8fe1072e:** it is a model change, and the release needs TJ's approval.
- **The Q9 re-run** is waiting in local_d181f1c6, per the last relayed note.
- **The NST gamelog backlog (ops-health P-I)** is still open. It also thins the EV/PP shot, goal and assist inputs, which this fix does not touch.
- **Shrinkage policy:** whether to change it, or turn on the season bootstrap for full-slate runs, is TJ's decision.

## 6. Insights
- **NST gaps reach far beyond hits/blocks.** The EV and PP rolling counts (shots, goals, assists, hits, blocks) have no WGO fallback; only strength `all` does.
- **Two missing-data behaviours:** a null rate falls back, but a thin 0 does not.
- **The rolling writer prunes `_all`/`_3ya`/`_avg_*`/`_career` from `rolling_player_game_metrics`** into `rolling_player_metric_support_payloads`, and FORGE hydrates them back. A plain SQL read of the wide table shows those fields as null, which is misleading.
- **Seider looked right only because his window had passed the NST games.** With a null last-5 rate, FORGE fell back to his history rate.
- **Shrinkage concern holds structurally:**
  - `sampleWeight` uses per-game average TOI plus history-wide shots, giving w ≈ 0.7 for any veteran.
  - The shrink target is a league constant.
  - The season bootstrap only runs on scoped Starter Board runs with `STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED`.
  - For Larkin vs Wood, the NST gap is probably the bigger driver. I did not verify that row by row.
- **Production `_3ya` totals were inflated** (up to about 3.5×) by WGO rows whose `season_id` didn't match the game date (2010–2017 rows). The calibration chain fixed this with the R6d season guard and a 2026-27 rolling recompute. These are other sessions' claims, not checked by me.
- **zsh gotcha:** `"$c:web/..."` expands as a zsh `:w` modifier. Use `"${c}:path"` in git show loops.
- **Supabase plugin MCP needs OAuth.** The claude.ai Supabase connector (`execute_sql`, project fyhftlxokyjtpndbkfse) worked for the approved reads.
