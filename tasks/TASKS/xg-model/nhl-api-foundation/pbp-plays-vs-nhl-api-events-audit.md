# pbp_plays vs nhl_api_pbp_events Audit

## Purpose

This document records the direct comparison between the legacy `pbp_plays`
table and the new `nhl_api_pbp_events` table for overlapping sampled games.

It exists to answer three questions:

1. whether the new normalized event table preserves legacy event counts
2. whether the shared flattened fields match on overlapping rows
3. which legacy assumptions or fields do not carry forward into the new schema

## Sample Scope

Recon sample game IDs:

- `2025021018`
- `2025021103`
- `2025021003`
- `2025021119`
- `2025021171`
- `2025021140`
- `2025020982`
- `2025021172`
- `2025021170`
- `2025021169`

Games present in both `pbp_plays` and `nhl_api_pbp_events` at audit time:

- `2025021018`
- `2025021003`
- `2025021119`
- `2025021140`
- `2025020982`

Games present in `nhl_api_pbp_events` but not yet present in legacy `pbp_plays`:

- `2025021103`
- `2025021171`
- `2025021172`
- `2025021170`
- `2025021169`

Interpretation:

- the missing legacy rows are a coverage gap in `pbp_plays`, not a failure of the new ingest
- comparison findings about row-level parity apply only to the overlapping games above

## Count Comparison

For the five overlapping sampled games, exact row counts matched:

| gameId | pbp_plays | nhl_api_pbp_events |
| --- | ---: | ---: |
| `2025021018` | 389 | 389 |
| `2025021003` | 366 | 366 |
| `2025021119` | 280 | 280 |
| `2025021140` | 336 | 336 |
| `2025020982` | 350 | 350 |

Conclusion:

- no event-count flattening gap was observed on overlapping sampled games

## Shared Field Comparison

Compared row-by-row using `(gameId, eventId)` / `(game_id, event_id)` keys.

Shared fields checked:

- `sortorder` vs `sort_order`
- `typedesckey` vs `type_desc_key`
- `typecode` vs `type_code`
- `situationcode` vs `situation_code`
- `eventownerteamid` vs `event_owner_team_id`

Result:

- `0` mismatches across all overlapping sampled rows

Conclusion:

- the new normalized table preserves the legacy flattened values for the core overlapping fields tested

## Legacy-Only Fields

Legacy `pbp_plays` stores some fields that are not currently promoted into
typed columns on `nhl_api_pbp_events`:

- `scoringplayertotal`
- `assist1playertotal`
- `assist2playertotal`
- `durationofpenalty` as a string
- `penalizedteam`

Important nuance:

- `penalizedteam` is not actually a team identifier in the legacy ingest
- the legacy flattening writes `details.typeCode` into `penalizedteam`
- example values include `MIN`, `MAJ`, and `BEN`
- the new table stores the same underlying concept more honestly as `penalty_type_code`

Implication:

- if any downstream legacy consumer still relies on season-to-date goal or assist
  totals from event rows, that logic will need either:
  - a compatibility view, or
  - a deliberate decision to stop carrying those totals in the normalized event layer

## Modern-Only Fields

The new `nhl_api_pbp_events` table adds fields and structure that legacy
`pbp_plays` does not have:

- `source_play_by_play_hash`
- `parser_version`
- `strength_version`
- `event_owner_side`
- `is_shot_like`
- `is_goal`
- `is_penalty`
- `strength_exact`
- `strength_state`
- parsed goalie and skater counts:
  - `away_goalie`
  - `away_skaters`
  - `home_skaters`
  - `home_goalie`
- `period_seconds_elapsed`
- `time_remaining_seconds`
- `served_by_player_id`
- `secondary_reason`
- `raw_event`
- `details`

Implication:

- the new table is a strict superset for parity and future feature generation
- raw replay, methodology versioning, and strength-aware analytics no longer
  depend on re-fetching or on hidden ingest assumptions

## Legacy Assumptions Exposed By The Audit

### 1. Legacy Coverage Is Incomplete

Five of the ten recon sample games were absent from `pbp_plays` but present in
the new table after one ingest run.

Implication:

- `pbp_plays` should not be treated as a complete validation baseline for recent games

### 2. Legacy Ingest Skips Any Game That Already Has One Row

`fetchPbP.ts` short-circuits game processing when `pbp_plays` already contains
the target `gameid`.

Implication:

- legacy ingest is coverage-oriented but weak as a replayable normalization pipeline
- schema fixes or parser revisions are harder to re-run systematically

### 3. Legacy Event Rows Flatten Away Upstream Context

Legacy `pbp_plays` stores selected detail fields only and drops the full raw
event shape.

Implication:

- any new feature or parser correction requires re-fetching upstream or widening
  the legacy table again
- `nhl_api_pbp_events.raw_event` and `details` remove that constraint

## Recommendation

For migration planning, treat the comparison result as:

- shared-field parity on overlapping games: confirmed for sampled rows
- legacy table completeness: not reliable enough to be the only validation source
- future parity work: should validate against overlapping windows but should not
  be blocked by missing recent `pbp_plays` coverage

## Bottom Line

`nhl_api_pbp_events` matches legacy `pbp_plays` on sampled overlapping event
counts and core shared flattened fields, while also adding the lineage, raw
payload preservation, strength decoding, and typed context needed for NST parity
and xG feature generation.
