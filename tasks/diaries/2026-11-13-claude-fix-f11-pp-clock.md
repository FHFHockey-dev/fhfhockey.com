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

## Next
Chef routes owner items O1–O4 and code items C1, C2, C4–C7 (REPORT.md) to owning lanes. No production step from this lane.

## Blockers
None.
