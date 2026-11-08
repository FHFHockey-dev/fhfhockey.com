# C7 independent review — C3d stage-timing diagnostic (uncommitted)

**Verdict: accepted.**
- **Diagnostic only:** the catch-all 500 response and its log line gain `stage` and `stageMs`.
- **Unchanged:** branches, budgets, guards, locks, reads, writes and success paths.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git, no live reads. Tests ran under the outbound network-deny preload. Evidence is in `r18-evidence/c3d/`.

## Pins

- **Source:** `forge-served-forecast-snapshot.ts` = `9b78c93e…`, the CODEX-082 reviewed proposed source (baseline `968c894a…`, patch `b957eceb…`).
- **Test:** `forge-served-forecast-snapshot.test.ts` = `76798133…`, as in `C3/INSTALL-RECEIPT.md`.

## Code read (whole diff)

- **Added:**
  - a `stageMs` map and a `stage` cursor, with `enter(next)` recording the elapsed time of the stage being left;
  - seven `enter(...)` calls at the existing stage boundaries: `planning_inputs`, `forge_bridge`, `history_reads`, `ledger_build`, `ledger_upsert` and `market` (starting from `day_games`);
  - in the existing catch: close the current stage's time, then `console.error(…, stage, stageMs, error)`, and add `stage, stageMs` to the existing `500 {success:false, date, error}` body.
- **Not changed:**
  - no new branch, `return`, `throw`, budget or deadline;
  - no read, write, lock or guard edits;
  - the direct 500 on a failed write and the 207 market paths are untouched.
- **What the response means:** `stage` is where the error **surfaced** and `stageMs` is the **observed** elapsed time per stage. The new test makes this concrete: the planning inputs spend 95 s, then `forge_bridge` throws at 0 ms, giving `stage:"forge_bridge"` with `planning_inputs: 95000`. That is CODEX-082's caution: read `stageMs` for the slow stage, not `stage`.
- **Exposure:** the response gains only stage names and millisecond timings. No data or identifiers.

## Tests

**302/302 pass** (`c3d.json`).
- **The receipt's focused set reproduces 157/157:**
  - `forge-served-forecast-snapshot.test.ts` 8, including the new deadline case;
  - `lib/rosterScheduleData/planning.test.ts` 107;
  - `forgeDailyBridge.test.ts` 42.
- **Neighbour I added:** `lib/rosterScheduleOptimizer/planning.test.ts`, 145.

## Limits (to the orchestrator)

- **L1:** `__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts` isn't in any lease's `canonical_write_paths`, as the receipt itself says. It was added for Codex's requested permanent regression test, so the orchestrator should confirm it before committing.
- **L2:** the whole-project typecheck after C3d had **8 errors, all outside C3**, in `lib/forge-testing-grounds/` (`boundedWorker.test.ts` ×6, `memoryRunStore.ts` ×2). That is the TG lane's in-progress work and is TG S06's gate, not C3d's. There are 0 errors in C3 paths.
- **Not covered:** production timings and the 140 s email attribution remain unknown, as CODEX-082 notes. This patch only makes the next failure diagnosable.
