# Parity Root Causes - 2026-03-30

## Scope

This artifact records the investigation result for remediation task `2.1` in `tasks/tasks-xg-release-remediation.md`.

Question investigated:

- what is causing the representative exact-count parity mismatches seen in the sampled legacy-overlap validation?

## Files Reviewed

- `web/lib/supabase/Upserts/nhlNstParityMetrics.ts`
- `web/lib/supabase/Upserts/nhlShiftStints.ts`
- `web/lib/supabase/Upserts/nhlOnIceAttribution.ts`
- `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts`
- `/tmp/analyze-parity-mismatch.ts`
- `/tmp/check-parity-key-types.ts`

## Representative Sample Used

Primary game inspected:

- `2025020982`

Representative players inspected:

- `8470621`
- `8471685`
- `8475314`

These were selected because they appeared in the prior sampled parity errors with large drift in:

- shots
- `icf`
- `iff`
- faceoffs
- assists and points
- hits taken
- TOI

## Finding 1: Parsed Event Reconstruction Is Mostly Correct

For the representative players, direct event reconstruction from `parseNhlPlayByPlayEvents(...)` matched legacy much more closely than the parity engine output.

Examples:

- player `8470621`
  - legacy: `shots=4`, `icf=4`, `iff=4`, `hits_taken=1`, `faceoffs_lost=1`
  - direct parsed-event reconstruction: `shots=4`, `icf=4`, `iff=4`, `hits_taken=1`, `faceoffs_lost=1`
  - parity engine output: all of those metrics were `0`
- player `8471685`
  - legacy: `total_assists=1`, `shots=1`, `icf=3`, `iff=2`, `takeaways=1`, `shots_blocked=3`
  - direct parsed-event reconstruction matched all of those counts
  - parity engine output zeroed them out
- player `8475314`
  - legacy: `shots=6`, `icf=11`, `iff=9`, `hits=2`, `hits_taken=2`
  - direct parsed-event reconstruction matched all of those counts
  - parity engine output zeroed them out

Implication:

- the large zero-value drift is not primarily a raw play-by-play parser failure
- it is happening inside the parity accumulation path

## Finding 2: The Main Failure Is In Shift-Row Identifier Normalization

Primary root cause:

- `web/lib/supabase/Upserts/nhlNstParityMetrics.ts` builds `playerTeamId` from `normalizeShiftIntervals(shiftRows)`
- `web/lib/supabase/Upserts/nhlShiftStints.ts` only normalizes time fields like:
  - `period`
  - `start_seconds`
  - `end_seconds`
  - `duration_seconds`
- it does not coerce identifier fields such as:
  - `game_id`
  - `shift_id`
  - `team_id`
  - `player_id`

Why that matters:

- the sampled parity investigation used raw `pg` rows for `nhl_api_shift_rows`
- `BIGINT` identifiers from raw `pg` can arrive as strings
- parsed event participant ids are normal numeric ids
- `addSkaterStat(...)` in `nhlNstParityMetrics.ts` looks up the player’s team with:
  - `playerTeamId.get(playerId)`
- if `playerTeamId` was keyed from string-valued shift-row ids, numeric event player ids miss that lookup

Effect:

- individual skater event counts do not accumulate for affected players
- that explains why the parity engine output was zero for shots, `icf`, `iff`, assists, faceoffs, takeaways, and hits taken even when direct parsed-event reconstruction matched legacy

## Finding 3: The Same Shift-ID Type Problem Likely Contaminates TOI And On-Ice Families

The large TOI drift in some sampled rows is consistent with the same identifier-normalization problem.

Examples from the sampled errors:

- player `8470621`
  - legacy TOI: `936`
  - parity TOI: `951`
- player `8475314`
  - legacy TOI: `1102`
  - parity TOI: `1199`

Interpretation:

- split TOI is computed from shift intervals and strength segments
- if shift-row player/team ids are not normalized consistently before:
  - TOI accumulation
  - player-team lookup
  - on-ice attribution
- then exact TOI and on-ice families can drift even when event parsing is correct

This points to the next corrective focus:

- normalize shift-row identifier fields before parity accumulation and stint/on-ice work

## Finding 4: Smaller Residual Legacy Differences Still Exist After The Main Failure

Even in the direct parsed-event reconstruction, a few metrics were still off by `1` from legacy for the sampled players.

Observed examples:

- player `8471685`
  - direct parsed-event reconstruction: `faceoffs_won=12`, `faceoffs_lost=19`
  - legacy: `faceoffs_won=11`, `faceoffs_lost=20`
- player `8475314`
  - direct parsed-event reconstruction: `shots_blocked=1`
  - legacy: `shots_blocked=0`

Interpretation:

- these smaller differences are not caused by the main zeroing failure
- they likely reflect remaining rule-level or legacy-definition drift in:
  - faceoff inclusion/exclusion
  - blocked-shot crediting
  - possibly special-case exclusions

These should be treated as secondary follow-up work after the identifier-normalization bug is fixed.

## Root-Cause Summary

The representative exact-count mismatches break down into two tiers:

1. primary blocking bug
   - raw `pg` shift rows are feeding string-valued bigint identifiers into parity code that assumes numeric ids
   - this breaks player-team lookup and likely corrupts TOI/on-ice attribution paths
   - this is the main cause of the large zero-value parity failures
2. smaller residual methodology drift
   - some direct parsed-event counts still differ slightly from legacy
   - these are likely rule-definition differences, not the same catastrophic zeroing bug

## Conclusion

Current investigation result:

- the major sampled parity drift is not primarily a play-by-play parser problem
- the main root cause is identifier normalization failure in the shift/parity path when using raw `pg` rows
- after that is fixed, smaller exact-definition drifts still need follow-up investigation in later remediation tasks
