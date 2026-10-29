# 2026-10-29 · Claude · RSO recent-form read (lease RSO-RECENT-FORM)

- **Scope:** make the 30-day WGO box-score read in `loadPlanningData` reliable and give it a specific failure reason. Offline only (mock DB).
- **Where:** `octoberBranch`, uncommitted (the orchestrator commits). Files: `web/lib/rosterScheduleData/planning.ts`, `planning.test.ts`, `planningInputs.ts`; receipt in `tasks/artifacts/rso-wave2-2026-10-25/RECENT-FORM/`.
- **Baseline sha256:** all three match the lease (checked at start).

## Log
- Start: read walkthrough "Timed read" and the `pages()` / form code. Plan: new opt-in `concurrentPages()` in `planningInputs.ts` (first page fixes count and page size, rest 4 at a time, every page still re-checks the exact count, one whole-read retry on drift); form budget 2 s -> 6 s inside `deadline`; reasons mapped from a typed `PlanningPageReadError`.
- Gotcha: offset paging over `date desc` means any insert inside the window shifts later pages, so "accept growth outside the window" does not apply: the filter already is the window. Keep per-page exact count (cheap; 4.5 ms index scan) as the drift detector, since without it a pure insert can drop a row undetected.

- Done: `concurrentPages()` + `PlanningPageReadError` (planningInputs.ts), 6 s budget and specific reasons (planning.ts), formDb mock options + 13 new test cases (planning.test.ts). Gotcha: the "duplicate" mock with a partial last page trips `incomplete_page` first, so failure cases use 6,000 rows.
- Checks: vitest rosterScheduleData + rosterScheduleOptimizer 1,026/1,026 passed; eslint clean; tsc 1 error in rso-alt-tidy's dirty `StreamingItinerary.test.tsx` (outside lease).
- RECEIPT.md written with hashes.

## Next
- Orchestrator: review and commit by explicit pathspec. Retire this diary once committed.
