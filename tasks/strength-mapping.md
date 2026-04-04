# Strength Mapping

## Purpose

This document is the canonical source of truth for:

- `situationCode` decoding,
- exact manpower labels,
- canonical strength-state labels,
- event-owner-relative strength classification rules,
- empty-net handling rules.

Baseline validation source:

- `tasks/artifacts/nhl-pbp-recon-2026-03-30.md`
- `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`

Last validated sample date: `2026-03-30`

## Situation Code Format

The sampled NHL API play-by-play data is empirically consistent with:

- `situationCode = awayGoalie, awaySkaters, homeSkaters, homeGoalie`

Interpret each digit as:

- `awayGoalie`
  - `1` when the away goalie is in net.
  - `0` when the away goalie is pulled.
- `awaySkaters`
  - Number of non-goalie away skaters on the ice.
- `homeSkaters`
  - Number of non-goalie home skaters on the ice.
- `homeGoalie`
  - `1` when the home goalie is in net.
  - `0` when the home goalie is pulled.

## Validated Examples

### `1331`

- Meaning: away goalie in, away 3 skaters, home 3 skaters, home goalie in.
- Exact manpower: `3v3`
- Canonical state: `EV`
- Sample validation:
  - Game `2025021172` DAL @ PHI
  - `period-start` in overtime
  - `faceoff`
  - `shot-on-goal`

This confirms `1331` is standard goalie-in overtime `3v3`, not a reordered encoding.

### `0651`

- Meaning: away goalie pulled, away 6 skaters, home 5 skaters, home goalie in.
- Exact manpower: `6v5`
- Canonical state: `EN`
- Sample validation:
  - Game `2025021171` CHI @ NJD
  - `shot-on-goal`
  - `stoppage`
  - `faceoff`
  - `blocked-shot`
  - `goal`

This confirms the first digit reflects away-goalie status and that a zero goalie digit denotes an empty-net state.

### `1560`

- Meaning: away goalie in, away 5 skaters, home 6 skaters, home goalie pulled.
- Exact manpower: `5v6`
- Canonical state: `EN`
- Sample validation:
  - Game `2025021103` PHI @ SJS
  - `goal`

This confirms the fourth digit reflects home-goalie status and that home empty-net attack states are encoded symmetrically to away empty-net attack states.

## Stored Strength Labels

### `strength_exact`

Store the exact skater-count label in away-vs-home format:

- `5v5`
- `5v4`
- `5v3`
- `4v4`
- `4v3`
- `3v3`
- `6v5`
- `5v6`

The exact label is derived only from the skater digits, not goalie digits.

### `strength_state`

Store the canonical event-relative state:

- `EV`
- `PP`
- `SH`
- `EN`

## Canonical Classification Rules

### Step 1: Decode Exact Counts

From `situationCode`, derive:

- `away_goalie_in_net`
- `away_skaters`
- `home_skaters`
- `home_goalie_in_net`

### Step 2: Derive Exact Manpower

Use:

- `strength_exact = "${away_skaters}v${home_skaters}"`

Examples:

- `1551` -> `5v5`
- `1541` -> `5v4`
- `1451` -> `4v5`
- `1331` -> `3v3`
- `0651` -> `6v5`
- `1560` -> `5v6`

### Step 3: Derive Canonical State

Apply these rules in order:

1. If either goalie digit is `0`, classify as `EN`.
2. Otherwise, if away skaters equal home skaters, classify as `EV`.
3. Otherwise, classify relative to `eventOwnerTeamId`:
   - owner has more skaters -> `PP`
   - owner has fewer skaters -> `SH`

## Event-Owner-Relative Interpretation

`strength_state` is event-owner-relative for non-empty-net special-teams states.

That means:

- on a `5v4` event owned by the away team, the event is `PP`
- on the same `5v4` state if owned by the home team, the event is `SH`

This is required because the same raw manpower state produces different offensive labels depending on which team owns the event.

## Empty-Net Rules

Any state with either goalie digit equal to `0` is canonical `EN`.

This rule applies even when skater counts are otherwise equal or resemble a normal special-teams state.

Examples:

- `0651` -> `EN`, not `PP`
- `1560` -> `EN`, not `SH`

Phase 1 parity and feature logic must preserve exact manpower labels alongside `EN` so queries can distinguish:

- `6v5` empty-net pressure
- `5v6` defending-empty-net states
- other rare pulled-goalie configurations

## Overtime Rules

Goalie-in overtime states with equal skaters are canonical `EV`.

Examples:

- `1331` -> `3v3` and `EV`

Do not create a separate canonical `OT` strength state in phase 1 storage. Overtime remains queryable via game context and period metadata, not by replacing `EV`, `PP`, `SH`, or `EN`.

## Parser and Storage Expectations

Normalized event rows should persist:

- raw `situationCode`
- decoded away/home goalie flags
- decoded away/home skater counts
- `strength_exact`
- `strength_state`
- `strength_version`

If future recon finds an upstream contradiction, update this document, increment `strength_version`, and preserve the raw source rows for replay.
