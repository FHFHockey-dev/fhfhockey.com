# xG Calibration Requirement Reassessment

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `2.1`
Scope: reassess whether post-calibration is still required after the repaired baseline rerun removed leaked current-shot event-class features.

## Decision

- post-calibration is still required under the repaired feature contract

## Why The Decision Did Not Flip

Removing the leaked `shotEventType` feature repaired the contract and made the rerun trustworthy enough for comparison.

But the repaired rerun did not make any family naturally well calibrated in raw form.

The current calibration requirement logic in [calibration.ts](/Users/tim/Code/fhfhockey.com/web/lib/xg/calibration.ts) still triggers when:

- overall holdout `avgPrediction` differs from holdout `goalRate` by at least `0.02`
- or a populated calibration bin differs from observed rate by at least `0.10`

All three repaired families still meet that requirement.

## Repaired Family-Level Result

### `logistic_unregularized`

- raw holdout `avgPrediction: 0.022727`
- raw holdout `goalRate: 0.056818`
- average gap: `0.034091`
- reassessed result: `post-calibration required`

### `logistic_l2`

- raw holdout `avgPrediction: 0.079545`
- raw holdout `goalRate: 0.056818`
- average gap: `0.022727`
- reassessed result: `post-calibration required`

### `xgboost_js`

- raw holdout `avgPrediction: 0.560712`
- raw holdout `goalRate: 0.056818`
- average gap: `0.503894`
- reassessed result: `post-calibration required`

## What Changed Relative To The Earlier Review

The old review was contaminated by label leakage.

The repaired review is materially cleaner because:

- leaked `shotEventType` usage is gone
- the explicit leakage warning is gone
- the observed calibration behavior is now interpretable as real model behavior on the current sample

## What Did Not Change

The repaired rerun still has approval-grade calibration blockers:

- no dedicated `test` split
- only `5` positive holdout goals in `88` holdout examples
- no positive rebound holdout coverage
- no positive rush holdout coverage

So the right reading is:

- calibration is still required
- calibration adoptability is still unresolved
- the next step is to decide which calibration path should be considered first once stronger acceptance rules are in place

## Consequence For `2.2`

The next calibration decision should not revisit whether calibration is needed.

It should decide:

- whether `Platt`, `isotonic`, or no post-calibration is the first candidate approach

under the explicit state that calibration remains required for all three repaired baseline families.
