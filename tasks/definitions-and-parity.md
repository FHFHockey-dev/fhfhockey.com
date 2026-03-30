# Definitions and Parity

## Purpose

This document is the canonical source of truth for:

- event definitions,
- inclusion and exclusion rules,
- strength-state rules,
- parity expectations,
- versioning policy

for the NHL API to xG data-foundation migration.

## Phase 1 Scope

- Phase 1 parity covers skaters plus goalies.
- NHL-derived correctness wins when it conflicts with legacy NST edge-case behavior.
- First production rollout prioritizes current season.
- Historical backfill must be available through a query parameter.
- Rush, rebound, flurry, and danger-bucket classifications are phase 1 deliverables.

## Core Event Definitions

### Shot Families

- `shot attempt`
  - Any offensive event intended as a scoring attempt.
  - Includes `goal`, `shot-on-goal`, `missed-shot`, and `blocked-shot`.
- `unblocked shot attempt`
  - Any shot attempt that is not blocked before reaching the net area.
  - Includes `goal`, `shot-on-goal`, and `missed-shot`.
- `shot on goal`
  - Event type `shot-on-goal` plus `goal`.
  - A goal always counts as a shot on goal.
- `missed shot`
  - Event type `missed-shot`.
  - Includes all miss reasons unless explicitly excluded by a later derived-rule version.
- `blocked shot`
  - Event type `blocked-shot`.
  - Counts as a shot attempt, but not as an unblocked shot attempt or shot on goal.
- `goal`
  - Event type `goal`.
  - Counts as a shot attempt, unblocked shot attempt, and shot on goal.

### Phase 1 Derived Classifications

- `rebound`
  - A derived shot classification based on prior-event context and a time-window rule.
  - Final implementation must use normalized event order and time deltas, not ad hoc query logic.
- `rush`
  - A derived shot classification based on transition context from preceding events.
  - Final implementation must be NHL-derived and documented when it diverges from NST-era conventions.
- `flurry`
  - A derived sequence classification for multiple close-together shot events in the same attacking sequence.
  - Raw per-shot values and flurry-adjusted sequence accounting must both remain queryable.
- `danger bucket`
  - A rule-based phase 1 shot classification into at least low-, medium-, and high-danger groupings.
  - The exact thresholds and geometry rules must be versioned.

### Individual Offensive Counts

- Goals
- Assists
- Points
- Shots
- ixG
- iCF
- iFF
- iSCF
- iHDCF
- Rebounds created
- Rush attempts

### Individual Non-Scoring Counts

- PIM
- Penalty breakdowns
- Penalties drawn
- Giveaways
- Takeaways
- Hits
- Hits taken
- Shots blocked
- Faceoffs won
- Faceoffs lost
- Faceoff percentage

### On-Ice Counts

- CF, CA
- FF, FA
- SF, SA
- GF, GA
- xGF, xGA
- SCF, SCA
- HDCF, HDCA
- HDGF, HDGA
- MDCF, MDCA
- MDGF, MDGA
- LDCF, LDCA
- LDGF, LDGA
- On-ice SH%
- On-ice SV%
- PDO
- Offensive, neutral, and defensive zone starts
- Offensive, neutral, and defensive zone faceoffs
- On-the-fly starts

### Rate Families

- Every supported count family must also support the relevant per-60 surface where that metric family exists in the legacy NST contract.
- Raw TOI and `TOI/GP` must remain available.

## Strength Definitions

### Situation Code

Use the empirically validated format:

- `situationCode = awayGoalie, awaySkaters, homeSkaters, homeGoalie`

Validated examples:

- `1331` means both goalies in, 3v3.
- `0651` means away goalie pulled, away 6 skaters, home 5 skaters, home goalie in.
- `1560` means away 5 skaters with goalie in, home 6 skaters with goalie pulled.

### Stored Strength Labels

- `strength_exact`
  - Exact manpower label in away-vs-home format.
  - Examples: `5v5`, `5v4`, `5v3`, `4v4`, `3v3`, `6v5`.
- `strength_state`
  - Canonical event-relative label.
  - Allowed phase 1 values:
    - `EV`
    - `PP`
    - `SH`
    - `EN`

### Canonical Rules

- `EV`
  - Skater counts match and both goalies are in.
- `PP`
  - `eventOwnerTeamId` has more skaters than the opponent.
- `SH`
  - `eventOwnerTeamId` has fewer skaters than the opponent.
- `EN`
  - Either goalie digit is `0`.

## Inclusion and Exclusion Rules

### Included by Default

- Regulation events
- Overtime events
- Special-teams events
- Empty-net events
- Delayed-penalty-state events

### Explicit Exclusions

- Shootout events are excluded from NST-style parity metrics.
- Penalty-shot treatment must be explicitly versioned and documented once implemented; it must never be left implicit.

### Empty Net

- Empty-net events are not treated as ordinary goalie-in-net EV/PP/SH states.
- Any state with a zero goalie digit is classified as `EN` in canonical event-relative strength logic.

### On-Ice Attribution

- On-ice attribution must be reconstructed from raw shift rows.
- `eventOwnerTeamId` is not a substitute for actual on-ice player attribution.
- Zone-start and faceoff-zone metrics must be driven by shift/on-ice logic rather than scorekeeper ownership fields alone.

## Parity Expectations

### Required Phase 1 Surfaces

- All situations
- Even strength
- Power play
- Penalty kill

### Parity Standard

- Phase 1 is not “copy NST no matter what.”
- The target is to preserve existing useful product metrics while preferring NHL-derived correctness when the two disagree.
- Every intentional divergence from NST behavior must be:
  - documented,
  - versioned,
  - test-covered where feasible

### Required Documentation for Divergences

For each divergence from NST-era behavior, record:

- the legacy NST expectation,
- the NHL-derived implementation,
- why the NHL-derived result is preferred,
- which metric families are affected,
- which version introduced the divergence

## Versioning Policy

Track separate versions for:

- parser logic,
- strength-state logic,
- derived feature logic,
- parity logic,
- future model logic

### Versioning Rules

- Any change that can alter stored normalized rows, derived features, or parity outputs must increment the relevant version.
- Raw upstream snapshots are immutable and are never overwritten in place.
- Backfills must be replayable against raw payloads with explicit parser/feature/parity versions.
- If definitions change, old outputs must remain attributable to the version that produced them.

### Versioned Domains

- `parser_version`
  - Increments when raw payloads are mapped differently into normalized event, roster, or shift rows.
- `strength_version`
  - Increments when `situationCode` decoding, exact manpower labeling, or canonical strength-state classification changes.
- `feature_version`
  - Increments when derived feature logic changes, including distance/angle normalization, prior-event context, rebound rules, rush rules, flurry rules, or danger-bucket logic.
- `parity_version`
  - Increments when a legacy NST-facing metric definition, exclusion rule, strength filter, or on-ice attribution rule changes.
- `model_version`
  - Reserved for later xG training and scoring logic; model versioning must remain separate from parser, feature, and parity versions.

### Increment Rules

- Increment `parser_version` if a normalized row can change even when the raw payload is identical.
- Increment `strength_version` if any event could move between `EV`, `PP`, `SH`, `EN`, or exact manpower buckets under the same raw payload.
- Increment `feature_version` if any derived shot or sequence feature could change under the same normalized inputs.
- Increment `parity_version` if any published skater, goalie, on-ice, or strength-split metric can change under the same normalized and feature inputs.
- Do not reuse an old version number for a different definition.

### Storage Requirements

- Normalized tables must carry the relevant parser and strength versions.
- Derived feature tables must carry parser, strength, and feature versions.
- Parity output tables must carry parser, strength, feature, and parity versions as needed to make outputs replayable.
- Validation artifacts and audits must record the versions they validated.

### Change Management

- A version bump must be accompanied by documentation updates in this file and, when relevant, updates in `tasks/metric-parity-map.md`.
- Any intentional divergence from previous behavior must include a short rationale and the affected metric families.
- Backfills triggered after a version change must preserve enough metadata to compare old and new outputs for the same games.

## Release Gates

The following are release blockers:

- strength-state decoding is documented and validated,
- raw payload storage is working,
- normalized event and shift ingestion are working,
- on-ice attribution logic is validated,
- parity outputs are validated against representative legacy outputs,
- divergences are documented and versioned
