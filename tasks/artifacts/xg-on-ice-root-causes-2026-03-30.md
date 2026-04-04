# On-Ice Root Causes - 2026-03-30

## Scope

This artifact records the investigation result for remediation task `5.1` in `/Users/tim/Code/fhfhockey.com/tasks/tasks-xg-release-remediation.md`.

Question investigated:

- what is causing the representative `cf/ca`, `ff/fa`, `sf/sa`, `gf/ga`, and zone-start mismatches in the sampled `nst_gamelog_as_counts_oi` overlap set

## Files Reviewed

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlNstParityMetrics.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlOnIceAttribution.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlShiftStints.ts`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-parity-rerun-2026-03-30.md`

## Representative Sample Used

Primary game inspected:

- `2025020982`

Primary representative player:

- `8471685`

Why this row was chosen:

- it had simultaneous drift in `cf/ca`, `ff/fa`, `sf/sa`, `gf/ga`, `toi`, and zone-start fields
- the deltas were small enough to inspect at event level but large enough to reveal the methodology split

## Finding 1: `shots_blocked` On-Ice Drift Is Mostly Comparison Noise, Not Parity Logic

Across the legacy-overlap sample dates:

- total `nst_gamelog_as_counts_oi` rows inspected: `1043`
- rows with `shots_blocked IS NULL`: `1043`
- rows with `shots_blocked = 0`: `0`
- rows with `shots_blocked > 0`: `0`

Implication:

- the current validation harness is treating legacy `NULL` versus new explicit `0` as an exact-family mismatch
- this inflates the `shots_blocked` on-ice error surface without proving a parity-engine bug for that metric

Conclusion:

- this bucket should be normalized in parity validation before it is used as evidence of on-ice logic drift

## Finding 2: The Current Zone-Start Logic Is A Real Bug

Current implementation in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlNstParityMetrics.ts`:

- counts a faceoff as a zone start whenever the immediately previous event is one of:
  - `stoppage`
  - `period-start`
  - `goal`
  - `penalty`
  - `delayed-penalty`

Why that is wrong:

- for practical NHL play-by-play flow, almost every faceoff is preceded by one of those restart-like events
- that makes the current rule behave like:
  - zone starts = on-ice faceoffs

Representative proof for player `8471685` in game `2025020982`:

Legacy row:

- `off_zone_starts = 5`
- `neu_zone_starts = 4`
- `def_zone_starts = 6`
- `on_the_fly_starts = 12`
- `off_zone_faceoffs = 8`
- `neu_zone_faceoffs = 8`
- `def_zone_faceoffs = 16`

Current NHL-derived row:

- `off_zone_starts = 8`
- `neu_zone_starts = 8`
- `def_zone_starts = 16`
- `off_zone_faceoffs = 8`
- `neu_zone_faceoffs = 8`
- `def_zone_faceoffs = 16`

Observed event-level probe:

- total on-ice faceoffs for this player: `32`
- zone starts by the current rule: `32`

Conclusion:

- the present parity engine is overcounting zone starts by equating them with all on-ice faceoffs
- frozen NST clearly treats zone starts as a narrower concept and tracks `on_the_fly_starts` separately
- this is a parity-engine bug, not merely a legacy-definition quirk

## Finding 3: Representative `cf/ca`, `ff/fa`, `sf/sa`, `gf/ga` Drift Traces To Shift-Boundary Inclusion Convention

Current on-ice attribution uses the shift-stint lookup rule from `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlShiftStints.ts`:

- active when `startSecond <= eventSecond < endSecond`

That is a half-open interval convention:

- shift start is inclusive
- shift end is exclusive

Representative proof for player `8471685` in game `2025020982`:

Legacy row:

- `cf = 30`, new `29`
- `ca = 26`, new `27`
- `ff = 23`, new `22`
- `fa = 17`, new `18`
- `sf = 11`, new `10`
- `sa = 14`, new `15`
- `gf = 2`, new `1`
- `ga = 1`, new `2`

Boundary events found for this player:

1. Event `98`
   - type: `goal`
   - period/second: `1:197`
   - team `26` goal
   - occurs exactly at the player's shift end `145-197`
   - current half-open rule excludes the player from this goal
   - legacy row shape implies the player was counted on-ice for it

2. Event `1050`
   - type: `goal`
   - period/second: `3:1081`
   - opponent team `2` goal
   - occurs exactly at the player's shift start `1081-1185`
   - current half-open rule includes the player for this goal
   - legacy row shape implies the player was not counted on-ice for it

Why this matters:

- those two exact-boundary goals explain the representative `gf/ga` swing
- because a goal is also a shot attempt, unblocked attempt, and shot on goal, the same two boundary decisions propagate into:
  - `cf/ca`
  - `ff/fa`
  - `sf/sa`

Conclusion:

- the representative shot-share and goal-share drift is not random
- it is consistent with a boundary-convention mismatch between:
  - current NHL-derived on-ice attribution: `[start, end)`
  - frozen NST overlap rows: effectively end-inclusive and start-exclusive for at least some boundary events

## Root-Cause Summary

The representative `counts_oi` drift breaks into three categories:

1. validator/comparison noise
   - `shots_blocked` is `NULL` on every sampled legacy `counts_oi` row
   - new explicit zeros are being treated as exact mismatches

2. real parity-engine bug
   - zone starts are currently overcounted because the implementation effectively counts every on-ice faceoff as a zone start

3. frozen-NST boundary-definition difference
   - representative `cf/ca`, `ff/fa`, `sf/sa`, and `gf/ga` mismatches trace to exact shift-boundary inclusion rules
   - this may need either:
     - deliberate emulation of NST boundary behavior for parity mode, or
     - explicit retirement as an approved `nhl correctness` divergence

## Conclusion

Task `5.1` result:

- the broad `counts_oi` error surface is not one single bug
- the zone-start surface contains a real parity-engine defect
- the representative shot-share and goal-share drift is explained by shift-boundary attribution convention
- the `shots_blocked` on-ice surface is largely a validation normalization problem

That gives task `5.2` a clear decision point:

- decide whether frozen NST boundary behavior must still be matched exactly for on-ice families, or whether official NHL shift-boundary behavior wins under the approved `nhl correctness` policy

