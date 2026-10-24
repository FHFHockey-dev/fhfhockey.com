# Combined review command receipts

Node 22.11.0 / npm 10.9.0, isolated source, existing dependency symlink, one Vitest worker. `TEST-COMMAND.txt` and `CROSS-CLASS-COMMAND.txt` contain the exact clean-environment commands. Every fetch in these tests is synthetic; Node socket/HTTP/fetch denial and Vitest denial setup remained active. No `.env` file was loaded.

## Reconstruct

Reconstruct the verified P07 R2 snapshot using its `VERIFY.md` (and R1's referenced setup); then verify/copy all nine files from `tasks/artifacts/task10-display-2026-10-22/after/` using that packet's `candidate.json`. The resulting manifest must match this directory's `FIXED-SNAPSHOT.json`: 3,379 files. Do this before changing only the temporary Vitest cache path. The precise scratch used in this review is in `SCRATCH-PATH.txt`.

Add reviewer fixtures only to scratch:

- `p07Task10Independent.test.tsx` → `web/components/RosterScheduleOptimizer/`.
- `p07Task10Serialization.test.ts` → `web/lib/rosterScheduleOptimizer/`.
- Prior R2 independent `p07R2IndependentCorrelation.test.ts` → `web/lib/rosterScheduleOptimizer/`.

The original R2 review fixtures and unchanged C08 are already supplied by the R2/R1 reconstruction. The preload/config/setup used here are retained in this directory. Use private HOME/TMPDIR and do not install packages.

## Actual executed runs

1. `TEST-COMMAND.txt`: **exit 0, 84 passed in nine files**, `focused.log`. At this point the new mounted fixture contained its first 36 cases. The seven cross-class cases were appended afterward; no existing case/assertion changed.
2. The identical clean environment, running:

```sh
npm test -- --run --config audit.vitest.config.mts \
  lib/rosterScheduleOptimizer/p07Task10Serialization.test.ts
```

**Exit 0, 2 passed**, `serialization.log`.

3. `CROSS-CLASS-COMMAND.txt`, equivalent under the same wrapper to:

```sh
npm test -- --run --config audit.vitest.config.mts \
  components/RosterScheduleOptimizer/p07Task10Independent.test.tsx \
  -t 'does not require goalie-only'
```

**Exit 1, 5 passed / 2 failed / 36 skipped by the explicit name filter**, `cross-class.log`. The two failures are `LOSSES_GOALIE` and `GAMES_STARTED`. The skipped 36 passed in run 1. Total distinct executed cases: **93; 91 passed, 2 failed**. Re-running the full first command against the final fixture also includes the seven appended cases; do not expect the historical 84-case count.

Minimal failing fixture: current approved skater stats `{GOALS:1,ASSISTS:2}`; league weights `{GOALS:3,ASSISTS:2,LOSSES_GOALIE:-2}` (or substitute `GAMES_STARTED`). Expected actual cell label `Expected fantasy points: 7.0`; observed `Expected fantasy points: unavailable`.

## Browser attempt

`browser-check.cjs` attempted only local static-grid inspection with Chromium background networking disabled, DNS blocked, an offline browser context and page route abortion. Clean environment used private HOME/TMPDIR and `PLAYWRIGHT_BROWSERS_PATH=/Users/tim/Library/Caches/ms-playwright`.

The installed headless shell failed during sandbox launch at MachPort `bootstrap_check_in` (permission denied 1100), before context/page creation. **Exit 1, blocked**, `browser.log` and `BROWSER.json`. Process exit and temporary cleanup are confirmed in the log; no uncertain operation or retry remains. No independent screenshot was produced. Owner screenshots are not relabeled as this review's execution.

## Not run

No application TypeScript/lint/full-suite/build or DB/service execution. R2's newer passed heavy-check receipt and task10's scoped lint/full-tree TypeScript diagnostics were read as owner evidence. No lock was acquired, removed or bypassed. The two external ablation-script diagnostics were not repaired or independently rechecked.
