# TOI And On-Ice Resolution - 2026-03-30

## Scope

This artifact records the resolution for remediation task `2.3` in `tasks/tasks-xg-release-remediation.md`.

Question addressed:

- what TOI and on-ice drift should be corrected in code
- what remaining TOI mismatch is a legacy-surface difference rather than a bug under the approved `nhl correctness` policy

## Code Fix Applied

Updated file:

- `web/lib/supabase/Upserts/nhlShiftStints.ts`

Fix:

- exact duplicate shift windows for the same player/team/period/start/end are now deduplicated during normalized interval construction

Why this matters:

- duplicate raw shift rows can inflate total TOI
- duplicate windows also create avoidable risk for later stint and on-ice logic

Regression coverage added:

- `web/lib/supabase/Upserts/nhlShiftStints.test.ts`
- `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`

## Representative TOI Investigation

Representative game:

- `2025020982`

Representative players:

- `8470621`
- `8471685`
- `8475314`

### Before The Duplicate-Window Fix

Observed parity TOI from the investigation sample:

- `8470621`: `951`
- `8471685`: `1510`
- `8475314`: `1199`

### Duplicate-Window Finding

Player `8475314` had an exact duplicate shift window in period `2`:

- `17:00` to `18:01`
- duplicated as two separate rows

That duplicate inflated TOI by `61` seconds.

After deduplicating identical windows:

- `8475314` normalized TOI becomes `1138`

### Official NHL Boxscore Check

Checked live against:

- `https://api-web.nhle.com/v1/gamecenter/2025020982/boxscore`

Official NHL boxscore TOI for the representative players:

- `8470621`: `15:51` = `951`
- `8471685`: `25:10` = `1510`
- `8475314`: `18:58` = `1138`

## Resolution

Resolved as code bugs:

- duplicate identical shift windows inflating TOI

Resolved as accepted non-bugs under policy:

- remaining mismatch between the corrected NHL-derived TOI and frozen legacy NST TOI for some players

Why that mismatch is not being forced into the new pipeline:

- the corrected NHL-derived TOI now matches the official NHL gamecenter boxscore for the representative sample
- the project decision is `nhl correctness` over exact NST parity on edge cases
- forcing the new pipeline to match a legacy TOI value that disagrees with the official NHL source would move the system away from the approved policy

## On-Ice Implication

Current conclusion for on-ice attribution:

- no separate representative on-ice count bug was found beyond the shift-row normalization issues already addressed in `2.2` and the duplicate-window fix above
- event-time on-ice attribution remains grounded in deduplicated normalized shift intervals and reconstructed stints

## Conclusion

Task `2.3` resolution:

- the real TOI normalization bug was fixed by deduplicating identical shift windows
- the remaining representative TOI differences are legacy-surface disagreements, not NHL-correctness bugs
- those remaining differences should be documented as approved divergence candidates during the parity rerun in task `2.4`
