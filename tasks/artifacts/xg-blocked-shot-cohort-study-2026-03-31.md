# xG Blocked-Shot Cohort Study

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `5.1`
Scope: decide how blocked-shot events should be handled in future xG training work without destabilizing the current clean approval path.

## Current State

The current pipeline already does three important things correctly:

- blocked shots are preserved in the normalized and derived feature layers
- blocked shots remain available for parity reconstruction and sequence context
- blocked shots are excluded from the current baseline training cohort

Current first-pass training eligibility is explicitly:

- `goal`
- `shot-on-goal`
- `missed-shot`

Blocked shots are therefore a modeling-scope decision, not a parser-gap decision.

## Options Studied

### 1. Excluded Rows

Meaning:

- keep blocked shots out of the shot-value training cohort
- continue to model only unblocked shot attempts as the first skater-shot xG surface

Advantages:

- keeps the target aligned with a standard unblocked-attempt xG interpretation
- avoids mixing defender-interrupted attempts into the same label surface as shots that reached or missed the net
- preserves comparability with the current benchmark and calibration contract
- does not force a label decision for events that are qualitatively different from unblocked attempts

Disadvantages:

- excludes one real attempt family from direct training
- requires a later decision if the product wants blocked-attempt shot value rather than only unblocked-attempt shot value

### 2. Zero-Probability Contextual Rows

Meaning:

- include blocked shots in the training table as contextual rows with a forced non-goal outcome

Why this is unattractive:

- it would inject a large class of events whose probability is structurally constrained by defender interruption rather than only shot quality
- it would distort calibration and class balance for the current unblocked-attempt objective
- it would blur two different questions:
  - chance quality if the shot gets through
  - probability an attempt becomes blocked before it gets through

Conclusion:

- this is the wrong objective for the current baseline path

### 3. Separate Modeled Class

Meaning:

- treat blocked attempts as a distinct modeling problem, either:
  - multi-class attempt outcome modeling
  - a separate blocked-attempt branch
  - a two-stage model where one stage predicts shot survival and another predicts goal probability conditional on an unblocked attempt

Advantages:

- methodologically cleaner than forcing blocked attempts into the current binary goal label
- preserves the distinction between shot generation and shot survival
- can support richer attempt-level products later

Disadvantages:

- materially expands scope
- requires new label design, benchmark design, and calibration design
- should not run in parallel with the still-unapproved first skater-shot baseline

Conclusion:

- plausible later research track
- not appropriate for the next clean approval pass

## Decision

For the next clean approval pass, blocked shots should remain:

- excluded rows for direct model fitting
- available contextual events in the feature layer and sequence logic
- available parity events in the event/parity surfaces

This means:

- do not add blocked shots to the current binary goal training cohort
- do not force blocked shots into a zero-probability training row
- do not start a separate blocked-attempt model until the unblocked skater-shot baseline is approval-ready

## Rationale

This is the best fit with the current project state:

- the approved row-grain and label contract are unblocked-shot based
- the benchmark package still needs stronger approval-grade evidence even before adding new cohort complexity
- blocked shots already provide useful context indirectly:
  - as prior-event context
  - as rebound/rush chain context where applicable
  - as parity events for attempt-volume accounting

## Follow-Up Rule

Blocked-shot modeling may be revisited later only as a versioned methodology change.

If revisited, it should be framed as one of:

- a separate blocked-attempt modeling track
- a multi-class attempt-outcome model
- a staged model with explicit blocked-vs-unblocked handling

It should not be introduced as an unversioned extension of the current binary unblocked-shot baseline.
