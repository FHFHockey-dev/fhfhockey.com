# GS receipt 3: distinct slice colours in the Goalie Share chart

Ticket 3 builds on ticket 2's commit 5660dcdd0. Nothing is committed; the orchestrator commits.

## Defect

The chart colours each team's slices from five `teamsInfo` colours in order. Four teams list the same colour twice:

| Team | Repeated colour | Slices that clash |
| --- | --- | --- |
| PHI | `#FFFFFF` | 2 and 4 |
| TOR | `#FFFFFF` / `#ffffff` (differs only in case) | 2 and 4 |
| PIT | `#FFFFFF` | 3 and 5 |
| OTT | `#B9975B` | 3 and 5 |

When one of these teams uses four or five goalies, two slices and their legend boxes look identical. A missing colour would also have left a slice uncoloured.

## Fix

This is in `components/GoalieShareChart/index.tsx` only; `teamsInfo.ts` is outside the lease and unchanged. The team colours are listed first, followed by the existing fallback colours. Missing colours and case-insensitive repeats are removed, which leaves at least five distinct colours. Teams whose palettes don't repeat keep the same colours as before.

## Changed paths (SHA-256 after)

| Path | Before (ticket 2) | After |
| --- | --- | --- |
| `web/components/GoalieShareChart/index.tsx` | `e6e8b813…9df4` | `9d819064174781c02486909ac9504c39f22efaac1f52e4e352134b19002fcfda` (21031 B) |
| `web/components/GoalieShareChart/GoalieShareChart.pagination.test.tsx` | `b4b814a4…ea88` | `964670a05a726fd4299e4fcc7dc89a557ed768909fe3babdf141d08dfd2ac4c9` (10948 B) |

I rechecked all six lease pins before editing. The other four were not touched: `goalieWorkload.ts` `ab0219c0…`, `GoalieShareChart.test.ts` `403d3660…`, and `workloadEvidence.ts`/`.test.ts` unchanged.

## Regression test

The test gives PHI four goalies and checks that the four slice colours are all different (ignoring case) and that slice 1 is still PHI's primary `#cf3308`. The old code gives `#FFFFFF` to slices 2 and 4, so only 3 colours are distinct and the test fails.

## Checks

Run under `/private/tmp/fhfh-heavy.lock` with the network blocked; the lock was released afterwards.

| Check | Result |
| --- | --- |
| Vitest: two chart test files plus `workloadEvidence.test.ts` | **Passed**: 49 tests in 3 files |
| Scoped `tsc --noEmit -p GS/tsconfig.json` | **Passed**, exit 0 |
| ESLint on the six lease files | **Passed**: 0 errors, 2 `<img>` warnings that were already there |
| Whole-project tsc, browser/visual check of the colours | Not run |
