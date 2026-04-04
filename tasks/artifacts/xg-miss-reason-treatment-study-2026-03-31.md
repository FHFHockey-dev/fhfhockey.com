# xG Miss-Reason Treatment Study

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `5.2`
Scope: decide whether miss-reason handling should change before the next clean xG approval pass.

## Current State

The current pipeline already has an explicit phase-1 miss policy:

- all `missed-shot` rows stay in the unblocked-shot training cohort
- miss reasons are preserved and normalized into explicit buckets
- `missReasonBucket` is already available as a training feature
- `short-side` misses are flagged explicitly but not excluded

Current normalized miss buckets:

- `short-side`
- `wide`
- `post`
- `crossbar`
- `over-net`
- `blocked-like`
- `other`
- `unknown`

## Existing Evidence

Current public-data and contract evidence supports preservation, not exclusion:

- sampled `missed-shot` rows carried reason coverage strongly enough to preserve the subtype
- the upstream ambiguity register already states that current public evidence is not strong enough to justify silently excluding any miss subtype from phase 1 parity or xG inputs
- the baseline training feature contract already includes `missReasonBucket` so subtype signal is available to the model without changing cohort eligibility

## Options Studied

### 1. Keep Current Policy

Meaning:

- retain all missed-shot subtypes in the training cohort
- let `missReasonBucket` and `isShortSideMiss` act as explanatory features

Advantages:

- preserves the current clean unblocked-shot row cohort
- avoids silently redefining the objective
- keeps miss subtype signal available without throwing away rows
- matches the current phase-1 parity and feature policy

### 2. Exclude Specific Miss Subtypes

Meaning:

- remove one or more miss buckets, such as `short-side`, from the training cohort

Why this is not justified now:

- there is no approval-grade benchmark evidence showing material model-quality improvement from excluding any subtype
- silent exclusion would change row cohort and label distribution
- any such change would break comparability with the current validated baseline contract unless versioned deliberately

### 3. Down-Weight Or Separately Model Certain Miss Subtypes

Meaning:

- keep the rows, but alter class weighting or assign a separate modeling track to selected miss buckets

Why this is premature:

- it introduces methodology complexity before the current baseline is even approved
- it requires an approval-grade rerun with stronger sample coverage to justify
- it is a modeling-policy change, not a parser or data-contract fix

## Decision

No miss-reason treatment change is approved for the next clean xG pass.

Current policy remains:

- keep all missed-shot subtypes in the training cohort
- keep `missReasonBucket` and `isShortSideMiss` as available explanatory features
- do not exclude, down-weight, or separately model any miss subtype yet

## Materiality Rule

Miss-reason treatment should change only if a future approval-grade rerun shows a material benefit.

That means:

- a non-empty dedicated `test` split
- sufficient holdout positive coverage
- cleaner calibration evidence
- a benchmark artifact that shows the treatment change improves model quality enough to justify a new cohort version

Until then:

- miss-reason handling remains stable
- the current versioned feature surface is sufficient

## Conclusion

Miss subtypes are already handled at the right level for the current project state:

- preserved in raw and normalized form
- bucketed in derived features
- available to the model as inputs
- not yet strong candidates for exclusion or special weighting

The next clean approval pass should keep the current miss-reason policy unchanged.
