# XG Training Dataset Contract

## Purpose

This document locks the first training-row contract for NHL xG baseline comparisons.

It defines:

- the canonical row grain
- the label definition
- the season and split strategy

This is the contract for baseline task `2.1` in `/Users/tim/Code/fhfhockey.com/tasks/tasks-xg-baseline-options.md`.

## Version Scope

This contract applies to the currently validated version tuple:

- `parser_version = 1`
- `strength_version = 1`
- `feature_version = 1`
- `parity_version = 1`

If the row cohort, label rule, or split logic changes materially, the training artifact metadata must record that change explicitly.

## Canonical Row Grain

The first baseline comparison uses:

- one row per shot-feature row
- one row per unique `(gameId, eventId)`
- sourced from the derived feature layer produced by `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts`

For the first baseline cohort, a row is training-eligible only if all of the following are true:

- the event is already shot-feature eligible under the current feature-layer inclusion rules
- `isUnblockedShotAttempt = true`
- `isPenaltyShotEvent = false`
- `isShootoutEvent = false`

Implication:

- included event types are:
  - `goal`
  - `shot-on-goal`
  - `missed-shot`
- blocked shots are retained in the feature layer for future experimentation, but they are excluded from the first baseline training cohort

## Canonical Label Definition

The first baseline label is:

- binary goal outcome on the current eligible shot row

Stored interpretation:

- `label_goal = 1` when `shotEventType = "goal"`
- `label_goal = 0` when `shotEventType = "shot-on-goal"` or `shotEventType = "missed-shot"`

Important boundaries:

- this is an event-level finishing label, not a possession-level or sequence-level label
- rebounds and flurries remain explanatory features, not alternate labels
- empty-net events remain included unless later excluded by an explicitly versioned training-policy decision
- overtime rows remain included unless later excluded by an explicitly versioned training-policy decision

## Season Scope For The First Baseline Comparison

The first baseline comparison is locked to:

- season `20252026`

Reason:

- this is the currently validated and release-approved training-use season scope
- it matches the project policy that rollout prioritizes the current season first
- it avoids mixing validated and not-yet-validated historical backfill into the first model comparison

Historical seasons may be added later only after:

- the additional seasons are ingested under the same validated contract
- release validation is rerun for the expanded cohort
- the training artifact metadata records the widened season scope

## Split Strategy

The first baseline comparison uses:

- game-level chronological splits
- never row-random splits

Split unit:

- `gameId`

Split rule:

- all rows from a given game must live in exactly one split
- games are ordered by:
  1. `gameDate`
  2. `gameId`

Initial split proportions:

- training: earliest `70%` of games
- validation: next `15%` of games
- test: latest `15%` of games

Why this is the initial rule:

- it prevents same-game leakage across splits
- it approximates real forward-looking deployment better than row-random splitting
- it gives logistic, regularized logistic, and gradient-boosting baselines the same evaluation contract

## Tie And Minimum-Size Rules

When split boundaries land inside a same-date cluster:

- keep each game intact
- assign by the ordered `gameId` tie-breaker

If the validation or test split would be too small because of limited current-season coverage:

- keep game-level chronological integrity
- prefer shrinking training slightly rather than collapsing validation or test into row-random sampling

## Explicit Non-Goals For This Contract

This document does not yet decide:

- the exact mandatory versus optional feature columns
- class weighting strategy
- calibration strategy
- persisted-table versus on-demand dataset materialization
- whether later models should add blocked-shot or goalie-specific cohorts

Those belong to later subtasks in `2.2` through `2.4`.

## Dataset Lineage Requirements

Every generated training dataset, whether ephemeral or persisted, must carry a complete lineage record.

### Required Lineage Fields

- `parser_version`
- `strength_version`
- `feature_version`
- source code commit SHA
- training dataset contract reference
- training feature contract reference
- season scope
- split-strategy identifier
- generation timestamp

### Required Meanings

- `parser_version`
  - identifies the normalized-event parsing contract used to produce the source event rows
- `strength_version`
  - identifies the `situationCode` decoding and strength-label contract used for the cohort
- `feature_version`
  - identifies the methodology-bearing shot/context feature contract used for model inputs
- source code commit SHA
  - identifies the exact repo state that generated the dataset
- training dataset contract reference
  - points to this document so row grain, label definition, and split rules are auditable
- training feature contract reference
  - points to `/Users/tim/Code/fhfhockey.com/tasks/xg-training-feature-contract.md`
- season scope
  - records the exact season or season range included in the dataset
- split-strategy identifier
  - records the chronological game-level split policy used for train, validation, and test assignment
- generation timestamp
  - records when the dataset artifact was produced

### Required Row-Level Lineage Columns

At minimum, every training row must preserve:

- `gameId`
- `eventId`
- `seasonId`
- `gameDate`
- `featureVersion`

Recommended row-level additions when convenient:

- `sortOrder`
- `eventIndex`
- `strengthState`
- `strengthExact`

These row-level fields are not just model inputs. They are replay keys.

### Required Dataset-Level Metadata Block

Every training dataset artifact must include a dataset-level metadata block with:

- `dataset_name`
- `dataset_version`
- `parser_version`
- `strength_version`
- `feature_version`
- `source_commit_sha`
- `generated_at`
- `season_scope`
- `split_strategy`
- `label_definition`
- `row_grain`
- `feature_contract_ref`
- `dataset_contract_ref`

### Versioning Rule

Any of the following requires a new dataset artifact version even if the raw games do not change:

- parser change
- strength-decoding change
- feature logic change
- row-cohort change
- label-definition change
- split-strategy change

### Comparison Rule

Baseline-model comparisons are valid only when compared datasets agree on:

- season scope
- row grain
- label definition
- split strategy

They may differ on:

- selected feature subset
- model family
- model hyperparameters

as long as the lineage metadata makes that difference explicit.

## Materialization Decision

The first baseline workflow will:

- store a versioned dataset artifact

Implications:

- baseline comparisons must train from the stored dataset artifact, not from an implicit live rebuild
- each dataset artifact must preserve the split assignment used for train, validation, and test
- reruns against the same dataset artifact version must be comparable across model families and calibration passes

The exact storage medium may be a versioned table or a versioned file artifact, but the dataset must be treated as a persisted, versioned training input rather than an ad hoc query result.

## Summary

The first xG baseline comparison is now locked to:

- row grain: one eligible unblocked shot-feature row per `(gameId, eventId)`
- label: binary goal on the current shot row
- season scope: `20252026` only
- split strategy: game-level chronological `70/15/15`
- lineage: every dataset artifact must record `parser_version`, `strength_version`, `feature_version`, source commit SHA, contract references, season scope, split strategy, and generation timestamp
- materialization: store a versioned dataset artifact
