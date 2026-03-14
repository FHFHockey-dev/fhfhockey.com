# Optional Historical Baseline Backfill

Date: `2026-03-14`
Task: `4.3`

## Scope

Confirm whether the retained validation-player recomputes from task `4.1` already backfilled the newly added optional historical baseline fields on stored rows.

## Verification Command

- `npm run check:rolling-player-family-reconstruction`

## Result

The retained ready comparison set no longer shows the earlier optional historical baseline gap.

- Brent Burns (`8470613`)
  - `historical_baselines`: `MATCH`
  - `comparedRows: 248`
  - `missingStoredRows: 0`
  - `mismatchCount: 0`
- Jesper Bratt (`8479407`)
  - `historical_baselines`: `MATCH`
  - `comparedRows: 252`
  - `missingStoredRows: 0`
  - `mismatchCount: 0`

The previously observed stored-null pattern for the newly added optional historical baseline fields is no longer present on the retained ready validation set, including the optional metrics introduced in the later pass-2 rollout.

## Interpretation

- the targeted recomputes from task `4.1` were sufficient to backfill the retained ready validation targets
- no additional broad historical backfill was required to close this task
- any remaining blocked validation cases should be treated as source-tail freshness problems, not optional-baseline write gaps on stored rows

## Net Outcome

Task `4.3` closes as a verification-backed backfill confirmation:

- stored optional historical baseline fields now align with recomputed output for the retained ready validation set
- the earlier March 14 verification artifact is stale on this point and should be superseded by the March 14 retained-player rerun plus this confirmation artifact
