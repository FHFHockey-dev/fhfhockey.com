# xG Goalie Follow-Up Gate

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `5.3`
Scope: decide how goalie-specific xG follow-up work should relate to the still-unapproved skater-shot baseline.

## Current State

Two facts are already locked:

- goalie-facing modeling should reuse the skater-shot baseline as its shot-value engine
- no skater-shot baseline is approved yet

That means goalie-specific modeling is still downstream of the unresolved skater-shot approval decision.

## Decision

Goalie-specific additions remain blocked until the skater-shot baseline is approved.

Current rule:

- do not start a separate goalie baseline track
- do not start goalie-specific calibration or benchmarking ahead of skater-shot approval
- do not fork the current training contract into a goalie-only model path yet

## What Is Allowed Now

The following remain acceptable while the skater-shot baseline is still unapproved:

- documentation of the later goalie path
- preserving goalie-related enrichment fields in the feature layer
- keeping goalie follow-ups queued as explicit later work

The following are not yet justified:

- declaring a goalie-facing xGA baseline
- running a separate goalie model-selection track
- changing the current baseline-approval path to accommodate goalie-specific methodology

## Required Precondition

Goalie-specific modeling may begin only after:

- one skater-shot baseline family is actually approved
- the approved model has an explicit shot-value artifact and calibration story
- goalie work can inherit that approved shot-value contract rather than compete with it

## Expected Later Shape

Once the skater-shot baseline is approved, goalie-facing work should proceed as a later layer on top of it:

- reuse the approved skater-shot shot-value engine
- benchmark goalie-facing aggregation and calibration separately
- test goalie-specific additions such as:
  - rebound-control proxies
  - handedness interactions beyond the shared base layer
  - goalie workload and workload-trend context

## Conclusion

Task `5.3` does not open a new modeling branch.

It records the gating rule:

- goalie-specific additions stay deferred
- the approved skater-shot baseline remains the prerequisite
- reuse of that baseline, not duplication of it, is the intended path
