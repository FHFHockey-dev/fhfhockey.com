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

- Brent Burns: `BLOCKED`
- Corey Perry: `BLOCKED`
- Jesper Bratt: `BLOCKED`
- Seth Jones: `BLOCKED`

Important details:

- Burns, Perry, and Bratt now have fresh upstream tails through `2026-03-12`, but their latest rolling rows still stop before those tails, so `targetFreshnessOk` is currently `false`
- Perry still has genuine PK source-tail blockers
- Jones remains limited by older WGO scope and PK source-tail blockers

Interpretation:

- the repaired writer is still working, but the retained validation set now needs another rolling recompute pass after the later optional-metric and payload work if the audit artifacts are expected to reflect March 14 freshness

### Targeted Family Reconstruction

Command:

- `npm run check:rolling-player-family-reconstruction`

Result:

- Brent Burns and Jesper Bratt both showed:
  - `missingStoredRows = 4` across families
  - zero mismatches for most compared families where stored rows exist
  - historical-baseline mismatch samples concentrated in the newly added optional metric surfaces

Observed mismatch pattern:

- `primary_assists_avg_season`, `primary_assists_avg_3ya`, `primary_assists_avg_career`
- `secondary_assists_avg_season`, `secondary_assists_avg_3ya`, `secondary_assists_avg_career`
- `penalties_drawn_avg_season`
- `penalties_drawn_per_60_avg_season`, `*_avg_3ya`, `*_avg_career`

Interpretation:

- the new optional metrics are deriving correctly in recompute output
- stored historical baseline fields for those metrics are still `null` on the sampled earliest rows until a full backfill / recompute refresh is performed

## Net Outcome

- `trendsDebug.tsx` optimization work is verified at the source-test and typecheck level
- targeted validation scripts still expose the remaining operational follow-ups:
  - rerun/backfill retained validation-player rolling rows so target freshness catches up to current upstream tails
  - backfill optional-metric historical baseline fields on stored rows
  - resolve remaining genuine PK source-tail blockers for affected validation scopes
