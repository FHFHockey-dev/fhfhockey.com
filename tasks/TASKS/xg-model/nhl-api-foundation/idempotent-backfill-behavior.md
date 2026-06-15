# Idempotent Backfill Behavior

## Purpose

This document defines how the NHL API pipeline must behave when the same game is fetched, parsed, and rebuilt more than once.

The goal is strict logical idempotency:

- re-running the same game must not create duplicate logical records
- re-running unchanged payloads under the same version tuple must converge to the same stored result
- re-running changed payloads or newer versions must remain replayable and attributable

## Scope

This contract applies to:

- raw payload archival
- normalized roster rows
- normalized event rows
- normalized shift rows
- future derived shot-feature rows
- future parity-output rows
- current-season incremental runs
- explicit historical backfill batches
- targeted single-game reprocessing

## Core Rule

Idempotency is defined at the logical row level, not at the HTTP request level.

That means:

- duplicate requests are allowed
- duplicate logical rows are not allowed

## Identity Keys By Layer

### Raw Payloads

Raw payload identity is:

- `(game_id, endpoint, payload_hash)`

Behavior:

- identical payloads must not create duplicate raw rows
- changed payloads for the same game and endpoint may create an additional immutable snapshot row with a new hash

Current implementation status:

- already supported by `nhl_api_game_payloads_raw`
- current ingest uses `onConflict: "game_id,endpoint,payload_hash"` plus `ignoreDuplicates: true`

### Normalized Roster Rows

Normalized roster identity is:

- `(game_id, player_id)`

Behavior:

- one logical roster row per player per game
- replay under the same parser version should overwrite to the same result
- replay under a newer parser version should overwrite the logical row and update lineage/version fields

### Normalized Event Rows

Normalized event identity is:

- `(game_id, event_id)`

Behavior:

- one logical event row per upstream event id per game
- replay under the same raw hash and version tuple must converge to the same row content
- replay under a newer parser or strength version must overwrite the same logical row key, not append a duplicate event row

### Normalized Shift Rows

Normalized shift identity is:

- `(game_id, shift_id)`

Behavior:

- one logical shift row per upstream shift id per game
- replay under the same version tuple must converge
- replay under a newer parser version must overwrite the same logical row key

### Future Derived Shot-Feature Rows

Derived shot-feature identity should be:

- `(game_id, event_id, feature_version)`

Behavior:

- one derived shot-feature row per event per feature version
- rebuilding the same game under the same version must replace or converge to the same result
- rebuilding under a new `feature_version` may coexist with older results if version comparison is intentionally preserved

### Future Parity Rows

Parity identity should be:

- player-facing rows: `(game_id, player_id, split, surface, parity_version, feature_version, parser_version, strength_version)`
- goalie-facing rows: `(game_id, player_id, split, surface, parity_version, feature_version, parser_version, strength_version)`

Behavior:

- the same version tuple must not create duplicate published rows
- a new version tuple may intentionally coexist for audit comparison

## Backfill Modes

### 1. Incremental Current-Season Mode

Use for normal production refresh.

Rules:

- fetch candidate games from the local `games` table or explicit date selection
- process only target games for the requested range
- do not rely on `latest game_date` alone as the completeness watermark
- track completeness per game, not just per day

### 2. Single-Game Replay Mode

Use for:

- parser bug repair
- upstream correction handling
- manual validation reruns

Rules:

- safe to rerun the same game repeatedly
- raw archival may no-op if payload hash is unchanged
- normalized tables must converge on one logical row per key

### 3. Historical Backfill Mode

Use for:

- older seasons
- large replays after version changes

Rules:

- batch selection may include already processed games
- idempotency must be enforced by keys and replace semantics, not by skip-only logic
- response and audit output must record processed game count and version tuple used

## Replay Decision Rules

For each game and endpoint:

### Case A: Same Payload Hash, Same Version Tuple

Expected behavior:

- raw layer inserts nothing new
- normalized rows converge to the same final values
- derived and parity rows converge to the same final values

This is a true no-drift idempotent replay.

### Case B: New Payload Hash, Same Version Tuple

Expected behavior:

- raw layer archives a new immutable payload snapshot
- normalized rows are rebuilt from the latest payload and overwrite prior logical rows for that game
- downstream derived and parity rows are rebuilt from the new normalized facts

### Case C: Same Payload Hash, New Version Tuple

Expected behavior:

- raw layer does not change
- normalized, feature, or parity rows are rebuilt according to the version(s) that changed
- resulting rows remain attributable to the new version tuple

### Case D: New Payload Hash, New Version Tuple

Expected behavior:

- archive the new raw snapshot
- rebuild all downstream layers from the new raw snapshot under the new version tuple

## Replace Semantics

Backfill must use full logical replacement semantics for a game, not partial append semantics.

That means:

- upsert rows that still exist
- remove stale rows for the same game and layer when the latest successful rebuild no longer emits them

This matters because plain upsert alone is not enough when:

- an upstream event disappears or is corrected away
- a shift row is removed upstream
- a roster spot disappears from the canonical source

## Current Status

What is already safe today:

- raw payload deduplication by `(game_id, endpoint, payload_hash)`
- normalized row deduplication by primary keys:
  - `(game_id, player_id)`
  - `(game_id, event_id)`
  - `(game_id, shift_id)`
- replay attribution through:
  - `source_play_by_play_hash`
  - `source_shiftcharts_hash`
  - `parser_version`
  - `strength_version`

What still requires explicit full-replacement handling in later implementation:

- deletion or invalidation of stale normalized rows when a replay emits fewer rows than a prior run
- future derived-feature replace semantics per game and version
- future parity-output replace semantics per game and version
- per-game completeness tracking for large backfill batches

## Completion Rules Per Game

A game should be treated as successfully backfilled only when all required layer steps complete for that game:

1. raw payload archival complete
2. normalized roster rows complete
3. normalized event rows complete
4. normalized shift rows complete
5. validation checks for that game pass, or the failure is explicitly recorded

If a game fails partway through:

- do not mark it complete
- leave enough audit context to rerun the exact same game safely
- allow later replay to converge cleanly without manual cleanup

## Required Audit Fields For Backfill Runs

Every backfill or replay run should record:

- mode:
  - `game`
  - `date_range`
  - `backfill_batch`
- target game ids or requested date range
- processed game count
- succeeded game count
- failed game ids
- `parser_version`
- `strength_version`
- `feature_version` when applicable
- `parity_version` when applicable

## What Must Not Be Used As The Only Skip Signal

Do not use these alone to decide that a game is done:

- destination-table row existence only
- latest processed `game_date` only
- presence of any one endpoint only

Those checks are too coarse and break replay safety.

## Approval Rule

Backfill behavior is acceptable only if:

- replaying the same game under the same version tuple creates no duplicate logical rows
- changed payloads overwrite logical normalized rows cleanly
- version changes remain attributable
- stale rows from older logical builds are eventually removed or invalidated by replace semantics
