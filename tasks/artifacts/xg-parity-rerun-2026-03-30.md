# Parity Rerun - 2026-03-30

## Scope

This artifact records the result of remediation task `2.4` in `/Users/tim/Code/fhfhockey.com/tasks/tasks-xg-release-remediation.md`.

Question addressed:

- after the event-id validation fix, shift-id normalization fix, and duplicate-shift TOI fix, do sampled exact-family parity checks now pass
- if not, are the remaining mismatches limited to already approved and documented exceptions

## Rerun Inputs

Training-sample raw validation games:

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

Legacy-overlap parity sample games:

- `2025021018`
- `2025021003`
- `2025021119`
- `2025021140`
- `2025020982`

Runner used:

- `/tmp/run-baseline-validation.ts`

Primary validation modules used:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlXgValidation.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlPlayByPlayParser.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlNstParityMetrics.ts`

## Raw Validation Result

Raw-vs-normalized validation now passes across the full 10-game training sample.

Summary:

- total games: `10`
- passed games: `10`
- failed games: `0`
- matching normalized `event_id` counts: exact for all 10 games
- raw-vs-normalized event-type counts: exact for all 10 games

This confirms that the event-id reconciliation blocker from task `1.0` is resolved.

## Sampled Parity Result

Exact-family parity still does not pass on the sampled legacy-overlap set.

Summary:

- total parity samples: `292`
- passed samples: `108`
- failed samples: `184`
- warning samples: `0`

Failed sample families:

- `nst_gamelog_as_counts`: `40` failed samples
- `nst_gamelog_as_counts_oi`: `144` failed samples
- `nst_gamelog_goalie_all_counts`: `0` failed samples

Failed sample games:

- `2025020982`: `56`
- `2025021003`: `47`
- `2025021018`: `43`
- `2025021119`: `38`
- `2025021140`: `0`

## Remaining Exact Mismatch Surface

Total exact mismatches still present in the rerun:

- `1348`

Top remaining exact mismatch metrics:

- `shots_blocked`: `156`
- `def_zone_starts`: `117`
- `off_zone_starts`: `114`
- `neu_zone_starts`: `111`
- `ca`: `101`
- `fa`: `101`
- `sf`: `100`
- `sa`: `98`
- `cf`: `96`
- `ff`: `94`
- `ga`: `93`
- `gf`: `90`
- `toi`: `32`
- `icf`: `7`
- `iff`: `7`
- `off_zone_faceoffs`: `6`
- `shots`: `5`

Smaller but still unresolved exact mismatches also remain in:

- `misconduct_penalties`
- `hits`
- `def_zone_faceoffs`
- `faceoffs_lost`
- `faceoffs_won`
- `major_penalties`
- `minor_penalties`
- `giveaways`
- `hits_taken`
- `takeaways`

## What Is Resolved Versus Not Resolved

Resolved:

- raw event identity reconciliation
- the catastrophic skater exact-count zeroing bug caused by bigint-string shift identifiers
- duplicate-window TOI inflation in normalized shift intervals

Documented and acceptable under approved policy:

- representative TOI differences where the corrected NHL-derived value matches official NHL gamecenter boxscore while frozen NST differs
- these are documented in `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-toi-on-ice-resolution-2026-03-30.md`

Not yet acceptable as approved exceptions:

- the broad `nst_gamelog_as_counts_oi` drift across four overlap games
- the remaining individual-count drift in `shots_blocked`, `shots`, `icf`, `iff`, faceoffs, and some penalty and hit families

Reason these are not yet approved:

- they are too broad to treat as isolated NHL-correctness edge cases
- they are not limited to the already documented official-boxscore TOI divergences
- they affect exact-count families that were explicitly designated as blocking correctness surfaces in the remediation plan

## Representative Remaining Errors

Examples from the rerun:

- `nst_gamelog_as_counts:skater:8471685:2025020982:2026-03-05`
  - `faceoffs_won`: legacy `11`, new `12`
  - `faceoffs_lost`: legacy `20`, new `19`
- `nst_gamelog_as_counts:skater:8475314:2025020982:2026-03-05`
  - `shots_blocked`: legacy `0`, new `1`
  - `toi`: legacy `1102`, new `1138`
- `nst_gamelog_as_counts_oi:skater:8470621:2025020982:2026-03-05`
  - `cf`: legacy `24`, new `23`
  - `def_zone_starts`: legacy `1`, new `4`
  - `ga`: legacy `1`, new `0`
- `nst_gamelog_as_counts_oi:skater:8471685:2025020982:2026-03-05`
  - `def_zone_starts`: legacy `6`, new `16`
  - `off_zone_starts`: legacy `5`, new `8`
  - `gf`: legacy `2`, new `1`

## Verdict For Task 2.4

Task `2.4` is not satisfied yet.

What the rerun proved:

- raw validation is now healthy
- goalie-all exact counts are not part of the remaining blocker set
- the remaining exact skater parity drift is dominated by on-ice and zone-start families, with a smaller but still real residual individual-count surface

What the rerun did not prove:

- that exact families now pass
- that all remaining mismatches are already approved and documented exceptions

## Required Follow-Up

Before task `2.4` can be completed, the remediation plan still needs:

- targeted investigation of `nst_gamelog_as_counts_oi` drift
- a decision on whether frozen NST on-ice and zone-start definitions should be matched or explicitly retired in favor of NHL-derived definitions
- targeted investigation of the remaining individual exact-count drift in `shots_blocked`, `shots`, `icf`, `iff`, faceoffs, and residual penalty and hit families

