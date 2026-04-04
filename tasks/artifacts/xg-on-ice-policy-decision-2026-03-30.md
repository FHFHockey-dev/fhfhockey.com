# On-Ice Policy Decision - 2026-03-30

## Scope

This artifact records the policy decision for remediation task `5.2` in `/Users/tim/Code/fhfhockey.com/tasks/tasks-xg-release-remediation.md`.

Decision made:

- `retire as nhl correctness divergences`

## Meaning Of The Decision

This decision does not retire on-ice or zone-start metrics themselves.

It means:

- continue to publish on-ice and zone-start metrics derived from NHL play-by-play plus shift-chart data
- prefer NHL-derived event and shift interpretation when frozen NST disagrees because of legacy conventions
- do not force the new parity engine to mimic frozen NST boundary behavior if doing so would move the system away from NHL-derived correctness

## What Still Must Be Fixed

This decision does not excuse real implementation bugs.

The following still require correction:

- the current zone-start overcount bug, where the parity engine effectively counts every on-ice faceoff as a zone start
- validation noise where frozen legacy `NULL` values are compared against new explicit zeros

## What Becomes Approved Divergence

The following may remain documented divergences rather than parity targets:

- exact shift-boundary inclusion behavior at timestamps that land exactly on shift start or shift end
- frozen NST `on_the_fly_starts` bookkeeping behavior when it cannot be reproduced faithfully from public NHL event and shift data
- other legacy-only on-ice counting conventions that disagree with NHL-derived event and shift interpretation

## Metric Families Affected

Potentially affected by approved divergence policy:

- `nst_gamelog_as_counts_oi`
- `nst_gamelog_as_rates_oi`
- the `ES`, `PP`, and `PK` on-ice variants of those same skater families

Most likely metric-level surfaces affected:

- `cf`, `ca`
- `ff`, `fa`
- `sf`, `sa`
- `gf`, `ga`
- zone starts
- zone faceoffs
- on-ice rate and percentage derivatives built from those counts

## Versioning Consequence

This decision must be treated as parity-policy documentation, not as silent behavior.

If published parity outputs change because of:

- corrected zone-start logic, or
- formal adoption of NHL-derived boundary behavior over frozen NST behavior

then `parity_version` must increment and the divergence must stay documented.

## Conclusion

Task `5.2` decision:

- on-ice and zone-start metrics remain first-class outputs
- source of truth is NHL play-by-play plus shift data
- real bugs still get fixed
- frozen NST-only boundary conventions are retired as approved NHL-correctness divergences rather than forced parity targets

