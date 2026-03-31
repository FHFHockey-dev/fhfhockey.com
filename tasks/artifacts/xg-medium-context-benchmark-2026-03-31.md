# xG Medium-Priority Context Benchmark

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `4.4`
Scope: benchmark each medium-priority contextual addition against the current promoted feature reference set instead of only reading isolated raw holdout snapshots.

## Reference Set

Because no feature set is formally approved yet, this pass uses the current promoted named reference family as the comparison baseline:

- `expanded_v2`

Compared additions:

- `deployment`:
  - on-ice skater-count, goalie-on-ice, and coarse matchup buckets
- `fatigue`:
  - prior-shift gap and prior-shift duration history
- `score-effects`:
  - game-time-aware score-effects buckets and late-game leading/final-window flags

All runs used the same March 31 validated 10-game sample and the same split contract:

- `210` train
- `88` validation
- `0` test

## Raw Holdout Comparison

### `logistic_unregularized`

- reference `expanded_v2`: `logLoss 1.177458`, `Brier 0.056818`
- `+deployment`: `1.412950`, `0.068182`
- `+fatigue`: `1.177458`, `0.056818`
- `+score-effects`: `1.177458`, `0.056818`

Interpretation:

- deployment made the unregularized family worse
- fatigue and score-effects were inert on this sample

### `logistic_l2`

- reference `expanded_v2`: `logLoss 2.354917`, `Brier 0.113636`
- `+deployment`: `3.078997`, `0.154776`
- `+fatigue`: `2.587036`, `0.128665`
- `+score-effects`: `2.354917`, `0.113636`

Interpretation:

- deployment made the regularized family materially worse
- fatigue also made it worse, though less severely
- score-effects-by-time were inert relative to the existing `expanded_v2` score-state surface

### `xgboost_js`

- reference `expanded_v2`: `logLoss 0.776406`, `Brier 0.291165`
- `+deployment`: `0.757375`, `0.281865`
- `+fatigue`: `0.756140`, `0.281271`
- `+score-effects`: `0.776406`, `0.291165`

Interpretation:

- deployment and fatigue both produced small raw holdout improvements
- fatigue was the slightly better of the two
- score-effects-by-time were inert on this sample

## Platt-Calibrated Comparison

### `logistic_unregularized`

- reference `expanded_v2`: `logLoss 0.218134`, `Brier 0.053591`
- `+deployment`: `0.250835`, `0.063761`
- `+fatigue`: `0.218134`, `0.053591`
- `+score-effects`: `0.218134`, `0.053591`

### `logistic_l2`

- reference `expanded_v2`: `logLoss 0.224979`, `Brier 0.059910`
- `+deployment`: `0.212314`, `0.055957`
- `+fatigue`: `0.215264`, `0.058059`
- `+score-effects`: `0.224979`, `0.059910`

### `xgboost_js`

- reference `expanded_v2`: `logLoss 0.225108`, `Brier 0.054591`
- `+deployment`: `0.224826`, `0.054542`
- `+fatigue`: `0.224544`, `0.054498`
- `+score-effects`: `0.225108`, `0.054591`

Interpretation:

- deployment and fatigue gave tiny `Platt`-calibrated gains for the regularized and boosted families
- those gains were not large enough to justify promotion on this weak benchmark package
- score-effects-by-time remained inert even after calibration

## Decision

No medium-priority contextual addition is promoted into the named reference set at this time.

Current disposition:

- deployment context:
  - keep available as optional ablation
  - do not promote
- prior-shift fatigue history:
  - keep available as optional ablation
  - do not promote
- score-effects-by-time:
  - keep available as optional ablation
  - do not promote

## Why Nothing Was Promoted

- the benchmark package still has no dedicated `test` split
- holdout positive coverage remains sparse
- rebound and rush positive holdout coverage remain absent
- the observed improvements were either family-specific, tiny after calibration, or absent entirely

## Conclusion

- `expanded_v2` remains the current promoted reference feature family
- medium-priority additions stay implemented and benchmarked, but not promoted
- future promotion should wait for an approval-grade rerun with a dedicated `test` split and stronger slice coverage
