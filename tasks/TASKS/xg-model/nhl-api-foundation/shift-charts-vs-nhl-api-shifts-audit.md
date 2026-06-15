# shift_charts vs nhl_api_shift_rows Audit

## Purpose

This document records the comparison between the new raw row-level
`nhl_api_shift_rows` table and the legacy `shift_charts` aggregate table.

It is intended to answer:

1. whether the raw shift feed can reproduce current TOI-style outputs
2. whether there is enough interval detail for later stint and on-ice logic
3. whether `shift_charts` is still a trustworthy validation baseline

## Comparison Scope

Initial recon sample games from March 21-29, 2026 did not overlap with the
games currently present in legacy `shift_charts`.

To create a valid overlap set, raw ingestion was additionally run for these
legacy-covered games from March 19, 2026:

- `2025021085`
- `2025021084`
- `2025021083`

Those three games are the basis of the audit below.

## Structural Comparison

### Raw Shift Layer

`nhl_api_shift_rows` preserves one row per shift and includes:

- `player_id`
- `team_id`
- `period`
- `shift_number`
- `start_time`
- `end_time`
- `duration`
- `start_seconds`
- `end_seconds`
- `duration_seconds`
- `event_number`
- `event_description`
- `raw_shift`

Implication:

- this is sufficient grain for later stint reconstruction and event-to-on-ice
  interval joins

### Legacy Aggregate Layer

`shift_charts` stores one row per player-game aggregate.

For the audited overlap games, the legacy rows retained:

- `total_es_toi`
- `total_pp_toi`
- `total_pk_toi`

But the following legacy fields were unexpectedly null:

- `game_toi`
- `durations`
- `shifts`

Implication:

- recent `shift_charts` rows are weaker as a baseline than expected
- the legacy table is not preserving the underlying shift list needed for
  re-audit or stint reconstruction

## Player Coverage Comparison

For each of the three overlap games:

- `nhl_api_shift_rows` covered `38` players
- `shift_charts` covered `38` players
- no players were missing in either direction

Conclusion:

- player-game coverage matched exactly on the overlap set

## TOI Comparison

Because `shift_charts.game_toi` was null for every audited player, the usable
comparison target was:

- `total_es_toi + total_pp_toi + total_pk_toi`

That summed legacy strength TOI was compared against:

- `SUM(nhl_api_shift_rows.duration_seconds)` per `(game_id, player_id)`

### Results

| gameId | raw players | legacy players | legacy `game_toi` present | mismatches vs `ES+PP+PK` |
| --- | ---: | ---: | ---: | ---: |
| `2025021085` | 38 | 38 | 0 | 2 |
| `2025021084` | 38 | 38 | 0 | 0 |
| `2025021083` | 38 | 38 | 0 | 0 |

The two mismatches in `2025021085` were both only one second:

- `8476875`: raw `1301`, legacy summed strength TOI `1302`
- `8482087`: raw `993`, legacy summed strength TOI `992`

Interpretation:

- raw shift durations reproduce legacy TOI outputs exactly for two audited games
- the remaining two differences are consistent with boundary or rounding behavior,
  not a structural feed mismatch

## What This Proves

### 1. Raw Shift Feed Supports Current TOI Totals

Yes.

The raw row-level feed reproduces legacy ES/PP/PK TOI totals at exact or
off-by-one-second agreement on the audited overlap set.

### 2. Raw Shift Feed Supports Later Stint Reconstruction

Yes.

The row-level fields in `nhl_api_shift_rows` preserve the period and interval
boundaries needed for:

- on-ice attribution
- deployment overlap
- line and pairing reconstruction
- event-to-shift joins
- shift-age and fatigue logic

### 3. Legacy shift_charts Is A Partial, Not Perfect, Baseline

Also yes.

The overlap audit shows that recent `shift_charts` rows can still be useful for
strength-split TOI validation, but they are not a complete reconstruction
surface because `game_toi`, `durations`, and `shifts` were null on the sampled
overlap games.

## Recommendation

Use `shift_charts` as a secondary validation surface for:

- player coverage
- ES/PP/PK TOI totals

Do not treat `shift_charts` as the canonical source for:

- raw shift reconstruction
- stint logic
- later on-ice replay or feature generation

That canonical role should belong to `nhl_api_shift_rows`.

## Bottom Line

`nhl_api_shift_rows` is sufficient for current TOI reproduction and materially
better than legacy `shift_charts` for future stint and on-ice work. The only
observed discrepancies on the audited overlap set were two one-second TOI
differences in one game, while the legacy aggregate table itself showed missing
`game_toi` and missing raw shift-list fields.
