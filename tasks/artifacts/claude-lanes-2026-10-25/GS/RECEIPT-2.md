# GS receipt 2: null-safe appearance count in the Goalie Share chart

Ticket 2 builds on the official-starts commit f951732dc. Nothing is committed; the orchestrator commits.

## Defect

`buildGoalieShareByTeam` added up each row's `gamesPlayed` with `|| 0`. Each row is one goalie's appearance in one game. A row with a missing `gamesPlayed` therefore counted as **0 appearances**, while its game still counted toward Team GP. That lowered the goalie's pie share without warning. A malformed value above 1 inflated it.

## Fix

Each unique per-game row now counts as exactly one appearance. Only an explicit `gamesPlayed === 0` counts as zero. Duplicate rows are already rejected by `assertUniqueGoalieGameRows`. Starts, rates and windows are unchanged.

## Changed paths (SHA-256 after)

| Path | Before (receipt 1) | After |
| --- | --- | --- |
| `web/lib/goalieWorkload.ts` | `459fc3d6…4a1f` | `ab0219c0df5e4c102981aa983a5383489c81c151549dda026bec39c7cf7a218d` (5462 B) |
| `web/components/GoalieShareChart/GoalieShareChart.test.ts` | `cd1ac67f…52d0` | `403d366075c856c638706569a1d846db80e21d3d2bc872f13d40d3418b3a9742` (7233 B) |

I rechecked both "before" hashes against receipt 1 before editing. The other four lease files were not touched.

## Regression test

The new fixture has one row with `gamesPlayed: null`, one normal row, one row with `gamesPlayed: 3`, and a backup row with an explicit `0`.

- **Expected:** starter has 3 appearances, backup has 0, `totalAppearances` 3, `totalGames` 3.
- **Old code:** the starter got 0 + 1 + 3 = 4, so the test fails on it. (The first draft of the fixture also totalled 3 under the old code. I replaced it before the final run.)

## Checks

Run under `/private/tmp/fhfh-heavy.lock`, with the network blocked and Node 22.11.0. The lock was released afterwards.

| Check | Result |
| --- | --- |
| Vitest: two chart test files plus `workloadEvidence.test.ts` | **Passed**: 48 tests in 3 files |
| Scoped `tsc --noEmit -p GS/tsconfig.json` (six lease files) | **Passed**, exit 0 |
| ESLint on the six lease files | **Passed**: 0 errors, 2 `<img>` warnings that were already there |
| Whole-project tsc, real NHL data, browser check | Not run |
