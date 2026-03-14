# Post-Optimization Verification

Date: `2026-03-14`
Task: `6.4`

## Scope

Verify the post-audit optimization work after:

- validation payload enrichment
- `trendsDebug.tsx` heavy/detail payload split
- sandbox demotion to a secondary tab
- downstream compatibility updates
- optional metric additions

## Verification Runs

### Full Vitest

Command:

- `npm test -- --run`

Original result on early March 14 closeout:

- product test suites passed
- Vitest run failed overall because compiled `.next/server/**/*.test.js` artifacts were discovered as suites

Resolved follow-up:

- the Vitest config was updated to exclude `.next/**`
- the same full-suite command now passes cleanly against source tests only
- current full-suite baseline:
  - `51` test files passed
  - `369` tests passed

Interpretation:

- the original full-suite failure was environmental and is now resolved

### Targeted Validation Freshness

Command:

- `npm run check:rolling-player-validation-freshness`

Result:

- Brent Burns: `READY`
- Corey Perry: `BLOCKED`
- Jesper Bratt: `BLOCKED`
- Seth Jones: `BLOCKED`

Important details:

- all four retained validation players now have `targetFreshnessOk: true` after the targeted reruns
- Brent Burns is fully `READY`
- Perry, Bratt, and Jones remain blocked only by genuine PK source-tail blockers
- Perry and Bratt have PK counts / rates / countsOi tails stopping at `2026-03-08` while WGO is current through `2026-03-12`
- Jones remains limited by an older WGO scope plus PK tails stopping at `2025-12-30`

Interpretation:

- the retained validation set no longer has a stale-target problem
- remaining retained-player blockers are upstream PK freshness problems, not rolling write failures or stale stored rows

### Targeted Family Reconstruction

Command:

- `npm run check:rolling-player-family-reconstruction`

Result:

- Brent Burns and Jesper Bratt now both show:
  - `missingStoredRows = 0` across compared families
  - zero mismatches across compared families
  - `historical_baselines = MATCH`

Interpretation:

- the new optional metrics are deriving correctly in recompute output
- the retained ready validation set no longer shows the earlier optional historical baseline stored-null gap
- targeted reruns were sufficient to backfill the sampled stored rows for the ready comparison set

## Net Outcome

- `trendsDebug.tsx` optimization work is verified at the source-test and typecheck level
- the recommended orchestration surface is now the consolidated coordinator:
  - [run-rolling-forge-pipeline.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts)
  - [rollingForgePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingForgePipeline.ts)
- targeted validation scripts still expose the remaining operational follow-ups:
  - resolve remaining genuine PK source-tail blockers for affected validation scopes
  - keep audit evidence synchronized with the newer retained-player parity snapshots instead of the older early-March-14 snapshot

## Recommended Job Surface

The recommended operator-facing process is now:

1. `GET /api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&date=YYYY-MM-DD`
2. `GET /api/v1/db/run-rolling-forge-pipeline?mode=overnight&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
3. `GET /api/v1/db/cron-report`

Interpretation:

- the old scattered route list remains available as implementation primitives and repair helpers
- the runbook surface should now prefer the coordinator plus monitoring
