# Manual Audit Requirements

## Purpose

This document defines the human spot-check requirements for the NHL API ingestion and parity pipeline.

Automated validation is necessary but not sufficient. A human audit must confirm that representative events still make sense when read end to end through:

- raw payload storage
- normalized event parsing
- strength decoding
- shift-based on-ice attribution
- published parity assumptions

## When Manual Audit Is Required

Run a manual audit before:

- first production cutover from NST-derived outputs
- any large historical backfill
- any parser, strength, feature, or parity version bump
- any schema change that affects normalized events, shifts, or parity outputs
- any upstream drift incident where NHL payload shape changed

## Minimum Sample Mix

Every manual audit batch must include at least:

- 1 regulation-control game
- 1 overtime game
- 1 empty-net or goalie-pulled game
- 1 heavy special-teams game

If available, also include:

- 1 low-event game
- 1 high-event game
- 1 game with rare manpower such as `3v5`, `5v3`, or prolonged delayed-penalty empty-net play

## Required Human Checks Per Game

### 1. Raw Presence

Confirm all four raw endpoint payloads exist:

- `play-by-play`
- `boxscore`
- `landing`
- `shiftcharts`

### 2. Event Count Sanity

Confirm:

- raw `plays.length` matches normalized event row count for the game
- event ordering by `sort_order` is monotonic
- sampled event types reconcile to the upstream payload

### 3. Event Parsing Spot Checks

Inspect at least one example of each when available:

- `faceoff`
- `shot-on-goal`
- `goal`
- `missed-shot`
- `blocked-shot`
- `penalty`
- `stoppage`
- `period-start` or `period-end`

For each sampled event, verify:

- `event_id`
- `sort_order`
- `type_desc_key`
- participant ids
- coordinates
- score fields when applicable
- `details` preservation for unpromoted raw context

### 4. Strength Mapping Spot Checks

Inspect at least:

- 1 `5v5` EV event
- 1 PP event
- 1 PK event from the defending side of the same state when possible
- 1 empty-net event
- 1 OT `3v3` event

Verify:

- `strength_exact` matches decoded manpower
- `strength_state` matches owner-relative logic
- empty-net events are labeled `EN`
- rare manpower states are preserved, not collapsed

### 5. On-Ice Attribution Spot Checks

Inspect at least one event each for:

- EV
- PP or PK
- OT
- empty-net

Verify:

- a shift stint is found at the event second
- home and away player sets are plausible
- owner and opponent player sets align with `event_owner_team_id`
- player-set counts are interpreted as goalie-inclusive player counts, not skater-only manpower

Important interpretation rule:

- on-ice player sets include goalies when a goalie is on the ice
- manpower labels such as `5v5`, `4v5`, `6v5`, and `3v3` must come from `situationCode`, not from raw player-set length alone

### 6. Goal Event Spot Checks

Inspect at least:

- 1 power-play goal when available
- 1 empty-net goal when available

Verify:

- scorer and assist ids
- score progression
- goalie presence or absence
- zone code and coordinates look plausible

## Required Audit Output

Each manual audit run must leave behind a dated artifact that records:

- validation date
- sampled game ids and labels
- parser, strength, feature, and parity versions in scope
- exact events inspected
- pass or fail conclusion for:
  - event parsing
  - strength mapping
  - on-ice attribution
- any caveats or follow-up bugs

## Failure Threshold

The manual audit fails if any of the following are observed:

- raw and normalized event counts diverge without a documented versioned explanation
- a sampled event is materially misparsed
- `strength_state` contradicts `situationCode`
- empty-net or OT states are mislabeled
- on-ice attribution cannot find a valid stint for a representative sampled event
- owner and opponent on-ice sets are clearly wrong for a sampled event

## Approval Rule

Do not approve parity rollout or training use unless:

- the automated validation checks are passing
- the manual audit artifact is present
- any divergences are documented and explicitly accepted
