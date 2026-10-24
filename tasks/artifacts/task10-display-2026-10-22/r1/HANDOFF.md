# Task10 R1 classification correction

Local correction complete; independent acceptance remains pending. Canonical checkout: octoberBranch, observed HEAD `20307fe13dc5b9dfd6eda974663f86fcbc16fd26`. Exact source is pinned separately from HEAD.

## Fix

Added only `LOSSES_GOALIE` and `GAMES_STARTED` to `planning.ts::GOALIE_STATS`, matching the established Yahoo points contract. This is the only production-line change. Complete skater G=1/A=2 with G×3/A×2 plus either goalie-only weight now renders 7.0. Genuinely missing applicable and unknown stats remain unavailable; goalie zero and negative weighted totals are preserved. No admission, refresh, expiry or model code changed.

Retained the seven cross-class mounted cases in `RosterScheduleOptimizer.points.test.tsx`; added two goalie missing/zero/negative controls plus one unknown-stat control in `gameForecastPoints.test.ts`. The reviewer fixture and original assertion files are unchanged.

## Verification

- Before correction: actual mounted regression reproduced **2 failed / 5 passed**, with six unrelated cases excluded by the explicit name filter. `REGRESSION-RED.log`.
- After correction: **248 passed in 11 files**, single-worker Vitest in an isolated copy of the reviewed fixed snapshot with only the three correction files overlaid. Includes all 93 earlier review cases, 10 new retained regressions and 145 shared-planner cases. `TARGETED-TESTS.log`, exact invocation/environment in `TEST-COMMAND.json`.
- Node 22.11/npm, private fixture HOME/TMPDIR, existing dependency symlink; Node socket/HTTP/fetch and Vitest network-denial setup retained. No environment/credential files loaded.
- Scoped ESLint: passed with no diagnostics (`LINT.log`). Scoped diff check: passed.
- Full TypeScript was not repeated for this classification-only correction; earlier receipts are not relabeled as R1 checks.
- No Chromium launch, retry, escalation or workaround was attempted. The review's browser hold remains in force; prior owner images are historical evidence only.

## Pins and reconstruction

`CANDIDATE.json` pins all **39 combined candidate files**, including the three R1 deltas; the other 36 and all eight P07 R2 delta files are unchanged. `FIXED-SNAPSHOT.json` pins all 3,379 fixed files; 3,375 are unchanged. Beyond the three correction files, the only difference is the execution-only private Vitest cache path. `END-INTEGRITY.json` confirms canonical and tested candidate hashes match, and reviewer fixtures are unchanged. `after/` freezes the three correction files; `correction.patch` is relative to `before/`.

For review, use the previous combined fixed snapshot from `tasks/artifacts/p07-task10-independent-review-2026-10-22`, then overlay these three `after/` files and verify the new manifests. The already-tested isolated copy is named in `SCRATCH-PATH.txt`; only its temporary Vitest cache path differs from source configuration. Historical task10/P07/reviewer manifests were preserved.

All own operations finished. No external calls, production requests, browser operations, migrations, commit, push or deployment. Root owns the next independent review and combined acceptance; no new runtime blocker or uncertain action remains.
