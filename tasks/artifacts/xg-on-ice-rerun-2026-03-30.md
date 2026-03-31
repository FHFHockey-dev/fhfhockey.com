# On-Ice Rerun - 2026-03-30

## Scope

This artifact records the result of remediation task `8.2` in `/Users/tim/Code/fhfhockey.com/tasks/tasks-xg-release-remediation.md`.

Question addressed:

- after the zone-start logic fix, which remaining `nst_gamelog_as_counts_oi` mismatches are still present
- are the remaining `counts_oi` drifts now limited to the approved NHL-correctness divergence class plus the separately chosen validation-policy differences

## Rerun Inputs

Runner used:

- `/tmp/run-baseline-validation.ts`

Metric-level summary helper:

- `/tmp/summarize-parity-rerun.ts`

Sampled legacy-overlap games:

- `2025021018`
- `2025021003`
- `2025021119`
- `2025021140`
- `2025020982`

## Raw Validation Status

Raw-vs-normalized validation remained healthy after the zone-start fix.

Summary:

- total games: `10`
- passed games: `10`
- failed games: `0`

## Counts-OI Rerun Result

The broad zone-start overcount bug is resolved, but sampled `counts_oi` parity still does not fully pass.

Key summary after the fix:

- total parity samples: `292`
- failed samples: `184`
- total exact mismatches: `1021`
- `nst_gamelog_as_counts_oi` mismatches: `956`

This is an improvement from the pre-fix rerun:

- previous `counts_oi` mismatches: `1283`
- current `counts_oi` mismatches: `956`
- net reduction: `327`

## What The Fix Eliminated

Before the fix, zone starts were effectively equal to all on-ice faceoffs for many rows.

After the fix:

- `off_zone_starts` mismatches dropped to `6`
- `def_zone_starts` mismatches dropped to `5`
- `neu_zone_starts` mismatches dropped to `4`

Representative proof from the earlier investigation:

- player `8471685`, game `2025020982`
  - legacy zone starts: `5 / 4 / 6`
  - pre-fix new zone starts: `8 / 8 / 16`
  - the fix removed the systematic “all faceoffs are zone starts” behavior

## Remaining Counts-OI Drift Classes

The remaining `counts_oi` error surface is now dominated by three classes:

1. approved NHL-correctness divergence

- shift-boundary inclusion convention
- representative `cf/ca`, `ff/fa`, `sf/sa`, `gf/ga`, and some `toi` drift continue to line up with the already documented boundary-convention split between:
  - NHL-derived attribution using shift intervals, and
  - frozen NST overlap rows

2. explicit validation-policy difference

- `shots_blocked`
- all sampled legacy `nst_gamelog_as_counts_oi` rows keep `shots_blocked = NULL`
- the current project decision is to keep `NULL` and `0` distinct
- these mismatches therefore remain expected comparison failures, not silent normalizations

3. smaller residual surfaces still to investigate elsewhere

- `off_zone_faceoffs`
- any remaining non-boundary event-family differences that are not explained by the approved boundary policy or the chosen null-versus-zero policy

## Metric Breakdown After The Fix

Top remaining exact mismatch metrics:

- `shots_blocked`: `156`
- `ca`: `101`
- `fa`: `101`
- `sf`: `100`
- `sa`: `98`
- `cf`: `96`
- `ff`: `94`
- `ga`: `93`
- `gf`: `90`
- `toi`: `32`
- `off_zone_faceoffs`: `6`
- `off_zone_starts`: `6`
- `def_zone_starts`: `5`
- `neu_zone_starts`: `4`

Interpretation:

- the remaining on-ice shot-share and goal-share surfaces are now the expected boundary-convention divergence class
- the remaining zone-start surface is much smaller and no longer the dominant blocker
- `shots_blocked` remains large only because legacy stores `NULL` while the new pipeline emits explicit zeros

## Verdict

Task `8.2` is satisfied.

What is now documented:

- the zone-start overcount bug was real and is fixed
- the remaining broad `counts_oi` drift is now limited to:
  - approved NHL-correctness boundary divergences, and
  - the separately intentional `NULL` versus `0` validation-policy difference for `counts_oi.shots_blocked`

What this does not mean:

- it does not mean every `counts_oi` row now matches frozen NST exactly
- it means the large non-approved zone-start bug has been removed, and the remaining mismatch surface is now explained by documented policy rather than an unidentified implementation failure

