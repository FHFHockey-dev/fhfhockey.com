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
- octoberBranch `24b1cb4d3` (11-12) replaced the clock with `penaltyClock.ts` v2 and set `PP_CLOCK_QUALIFIED = true`; master has neither. Served surfaces still withhold (`/api/toi` available=false; rolling `teamPpClock: null`).
- Shipped `buildTeamPpClock.qualified` never compares to the official total (would qualify 5 mismatches + 856 placeholder rows).
- Shipped audit flags stoppage-type events the clock already ignores (117 agreeing team-games rejected).
- `MAT` duration 15 throws "Unsupported penalty-clock penalty".
- `update-stats` writes "00:00" on every failure path; column NOT NULL default "00:00".

## Next
Chef routes owner items O1–O4 and code items C1–C7 (REPORT.md) to owning lanes. No production step from this lane.

## Blockers
None.
