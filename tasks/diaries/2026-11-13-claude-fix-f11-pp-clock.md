# 2026-11-13 claude fix-f11 PP clock validation (decision 144)

## Scope
Lane F11: validate the team PP clock against stored `teamGameStats.powerPlayToi` (decision 144, 71; L8 W2-P0-13). Report only; no app code; no prod writes; no NHL/NST calls. Not in tonight's release.

## Where
- Branch `octoberBranch`, checkout `/Users/tim/Code/fhfhockey.com`.
- Folder: `tasks/artifacts/calculation-inventory-2026-11-10/master/production/pp-clock-validation-2026-11-13/` (REPORT.md, scripts 01–11, `results/`).
- Raw PBP/shift pages kept in the session scratchpad only (not committed).

## State
- Done: classification (all seasons), clock vs official (2025-26 + 2026-27), cause attribution, MAT/15 what-if, aligned audit, shift numerator check, REPORT.md.
- Headline: 2,493/2,500 comparable team-games exact; 2 at 1 s; 5 scrum mismatches withheld. 2026-27 reg: 607 display + 9 N/A + 2 withheld. 2025-26 reg: 881 placeholder "00:00" rows (Dec 9–10 2025, Jan 4–Mar 20 2026), not repairable from stored evidence.
- Read hygiene gate ran before every page; never tripped. One single-game jsonb probe (2 payloads).
- Checks: scripts ran end to end; report counts re-derived from `results/team-game-results.csv`.

## Gotchas
- octoberBranch `24b1cb4d3` (11-12) replaced the clock with `penaltyClock.ts` v2 and set `PP_CLOCK_QUALIFIED = true`. Local `master` is stale (3c03df7dc); `origin/master` 4d9b6a10d (#433) contains it, so check origin/master, not master. Served surfaces still withhold (`/api/toi` available=false; rolling `teamPpClock: null`).
- Shipped `buildTeamPpClock.qualified` never compares to the official total (would qualify 5 mismatches + 856 placeholder rows).
- Shipped audit flags stoppage-type events the clock already ignores (117 agreeing team-games rejected).
- `MAT` duration 15 throws "Unsupported penalty-clock penalty".
- `update-stats` writes "00:00" on every failure path; column NOT NULL default "00:00".

## C3 follow-up (Chef request, release freeze 18:30 UTC)
- `a98eda63f`: `penaltyClock.ts` accepts MAT/MATCH duration 15 as one 5-minute major; regression test from stored game 2025021128 (it threw before the fix; after the fix it gives the exact spans and the official 300/240 s). Other MAT durations still throw.
- Checks: getPowerPlayBlocks + shifts tests 113/113 passed; 5 downstream suites 99/99 passed; ESLint on both files exit 0; `npm run typecheck` exit 2, all 6 errors in another lane's uncommitted `lib/rosterScheduleData/forgeDailyBridge*` (none in F11 files).
- C1/C2, `PP_CLOCK_QUALIFIED` and serving are unchanged.

## C1 + C2 follow-up (Chef, TJ approved 11-13)
- Scope: `buildTeamPpClock` qualified also needs the official team PP total (±2 s, rule 4 / O1 open), false for missing, malformed or "00:00" placeholder rows (C1); `auditPpBlocksAgainstSituationCodes` skips the same observations as the clock (C2). Fixture tests must fail on the old code. Re-run 05 offline from scratch PBP; report qualified counts per class.
- Owns `web/utils/getPowerPlayBlocks.ts`, `penaltyClock.ts` and their tests. `PP_CLOCK_QUALIFIED` and serving stay unchanged; O1–O4 stay open. No callers outside the test file (checked with rg).
- Done: `de4650c77` (code + tests). C2 audit skips the clock's refused observations; C1 `official` input, `official: { class, seconds, diffSeconds }` output, ±2 s (`PP_CLOCK_OFFICIAL_TOLERANCE_SECONDS`), reason per case.
- Fixtures: subsets of stored games (penalties, goals, markers, old-audit flags, one interior event per span); each rebuilds the full game's spans. 16 new or changed tests fail on HEAD~ module (checked with temp copies, deleted).
- Re-run (offline, scratch PBP): `results/after-c1-c2/`. Mismatches 0/5 and placeholders 0/883 qualified; shipped audit = aligned audit, 0 disagreements on 3,456 clocks; 2026-27 reg 616/618; +117 recovered by C2, +8 by C3.
- Checks: getPowerPlayBlocks + update-power-play-combinations + projections/ingest 205/205 passed; ESLint exit 0; `npm run typecheck` exit 0.
- Gotcha: two existing counts drop (checkedEvents 3→2 and 6→5) because period-end codes are no longer checked; expected C2 effect.

## Decision 151 follow-up (O1 counts + O4 HTML check)
- Scope: report 2026-27 reg team-games passing the clock check apart from those that can display PP share (numerator: shifts ∩ qualified intervals, no unit time above the clock; never cap). O4: fetch only the five NHL Game Summary pages (Penalty Summary) for the scrum games, read-only, 10 s apart; explain each; keep raw totals; no tolerance change, repairs or enablement.
- Numerator source checked: the rolling reader would use `powerPlayCombinations` (PPTOI, unit, pp_share_of_team) built by update-power-play-combinations from getPowerPlayBlocks; count both the recomputed shifts ∩ spans and the stored rows.
- O4 done: 5 nhl.com requests, 10 s apart, all HTTP 200 (budget used; no further calls). In all five the clock equals the Penalty Summary total to the second; the stored right-rail total is the outlier (−28, +120, −94, −31, +120). Stays withheld; nothing changed.
- O1 done: 2026-27 reg 616/618 pass the clock check (607 with PP + 9 N/A); 607/607 can display with shifts ∩ qualified intervals; 591/607 from stored powerPlayCombinations (16 stale or above the clock, 14 games; 2026020197 t24 49 s > 43 s).
- Gotcha: shift rows have no position; goalies = any shift ≥ 300 s (575 one, 32 two). Stored rows exclude goalies.
- Files: 12–15 scripts, REPORT §9, `results/after-c1-c2/{o4-penalty-summary-check.csv, share-coverage-*}`. Raw HTML stays in scratch.

## Decision 152 Part A (Penalty Summary registry)
- Scope: accept the NHL Penalty Summary as the official reference ONLY for the 5 O4 team-games, ONLY on exact (0 s) reconciliation plus complete PBP and audit 0. Keep both values, reason, URL, sha256 and fetch time in a version-controlled registry; never overwrite the stored row; no blanket override; output says which reference was used. Owned: getPowerPlayBlocks.ts, its test, new registry module. Part B follows from the Chef.
- Done: `web/utils/ppPenaltySummaryRegistry.ts` (5 entries); `buildTeamPpClock` adds `referenceSource` and `penaltySummary`. An entry applies only if the stored row still reads as recorded (conservative choice: a changed stored row falls back).
- Evidence: sha256 and fetch time are the saved scratch pages' (17:15:25Z–17:16:06Z UTC); no new fetch.
- Fixtures: 4 new stored-game subsets (same extractor; each rebuilds the full spans), 2026020036 hoisted to describe scope. The old C1 away assertion now expects `nhlPenaltySummary`; the teamGameStats-only verdict is covered by the unregistered-id and changed-row tests.
- Checks: getPowerPlayBlocks tests 74/74; `npm run typecheck` exit 0; ESLint on the 3 files exit 0.
- Offline re-run: exactly the 5 registered team-games change (2,568 → 2,573 qualified); 2026-27 reg 618/618, 309/309 games; share displayable 609/609 recomputed, 593/609 stored. `results/after-d152/` summaries.

## Decision 152 Part B (numerator source, read-only)
- Scope: computed (shifts ∩ qualified intervals) vs stored powerPlayCombinations per player for 2026-27 reg; common cause of the 16; full page-load cost per reader on demand vs today; recommend (a) reader computes or (b) store same calculation + bounded refresh. No writes, no reader wiring; don't edit LineCombinations/utilities.ts (Codex item 6).
- Comparison (16-numerator-compare.ts): 593/609 team-games agree; 7,152/7,190 stored rows; units 7,172/7,190 using the writer's own pivot + shared-time rule (all 18 misses inside the 16).
- 16 = 3 causes: A 11 team-games/15 rows stale pre-11-01 rows kept by the 11-07 bulk re-run (audit keptUnproven sums to 15); B 4 team-games, OT PP seconds missing per player (production code on stored shifts gives full time → feed at write time lacked OT); C 2026020131 t18 production 11-01 clock 29 s vs 120 s.
- Provenance reads: created_at (7,190 rows), cron_job_audit index-only by week (707 runs) + details for 35 repair runs. The first ILIKE audit query hit the 10 s statement timeout (cancelled, not retried); weekly index-only windows worked.
- Cost probe (17-cost-probe.sql): team-game on demand ≈ 730 rows/26 KB, cold 18–100 ms, warm <2 ms; player/team season 6–15k rows, cold 0.4–1.25 s, warm <10 ms; stored reads cold 3–60 ms. Compute ≈ 12 ms/game both teams locally.
- Gotcha: zsh `$r:web` is a modifier; use `${r}:path` in git show.

- FORGE `toi_pp_seconds` = computed numerator for all 7,195 player-games (updated 11-12/13); master shifts.ts uses situation codes, so the owner must confirm provenance.
- Reader map (Explore agent, verified key paths): PowerPlayCombos (unit + PPTOI order), LinemateMatrix/shiftChart (3 live NHL calls per view, master clock), /api/toi (withheld; already reads FORGE), rolling writer (career chunks), team_unit_toi, planning (2 s deadline), social share, SQL tallies.
- Recommendation (b): one writer from stored PBP/shifts/teamGameStats via buildTeamPpClock; same pPC columns + calculation_version/computed_at; new pp_team_game_clock; replace team-game rows as a set; bounded 2026-27 refresh plan for TJ approval. REPORT section 11.

## Decision 152 writer build (offline, TJ approved via the Chef)
- Scope: stored-calculation writer ([gameId].ts + test), unapplied migration (calculation_version/computed_at, pp_team_game_clock, replace RPC), authority row 149 pending, tests for groups A/B/C, availability rules and transactional replace. No apply/release/refresh/reader change/production write.
- Correction: buildTeamPpClock and C1–C3 are already in production (#430 clock 11-12; #434/#436 qualification 11-13); my Part B text read a stale local `master` (11-10). Report §11 fixed; FORGE match explained (production shift charts use buildPenaltyClock).
- Claim posted in CLAUDE-TO-CODEX.md (the Chef committed it in 817509f2b).
- Fixtures: 2026020163 (A, both teams), 2026020131 (C, t18), 2026020174 (B, t29), 2026020038 (zero t55); one guarded read for 163's stored rows + roster positions of the 4 games.
- Checks: PG15 proof RESULT OK (28 checks); vitest 7 files / 379 tests (writer 17); typecheck exit 0; ESLint exit 0; baseline test 21/21 after counts 149 / 7 pending and the super-goal summary count.
- Dry run on 163: deleted 3 stale rows, 0 updated, 0 inserted, 26 unchanged.
- Gotcha: the baseline test also checks the record count in tasks/TASKS/super-goal/super-goal-final-summary.md; another lane flipped 147/148 to applied mid-task (114 applied / 6 pending before mine).

## Decision 152 dry-run tooling (offline)
- Batch route: dryRun (full per-game diff, clock rows, computed rows, totals; never truncated, ~0.5 MB at the 60 cap), concurrency 1..4 (default 4), 60-game cap kept; nightly call identical (two-argument writer call, same response keys). Writer summary now carries `rows`.
- Runner 20-refresh-runner.py (not run): frozen 309 games / 31 batches (sha256 pinned); dry gate = exactly 16 team-games, 15 deletes, 23 PP updates, 5 inserts, 618 clocks (609 available, 9 N/A); write phase needs the approved dry-run sha256, reads back each batch via psql, stops on first mismatch with --start-batch.
- Checks: batch route 17 tests (9 new) + writer 17; 6 suites / 314 tests; typecheck 0; ESLint 0; offline gate self-check pass + 3 tampers stop.
- Gotcha: the runner's dry phase needs a target running the new writer + route + Part A (production has none); local dev on loopback against prod reads only (plus one cron_job_audit row per call).

## Next
Chef routes the dry run (target choice: release vs local dev) to TJ. No production step from this lane. Chef routes remaining owner and code items. No production step from this lane.

## Blockers
None.
