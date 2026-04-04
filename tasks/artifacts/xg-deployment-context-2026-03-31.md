# xG Deployment Context

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `4.1`
Scope: add deployment and matchup context features if the current on-ice reconstruction is stable enough.

## Decision

The current on-ice reconstruction is stable enough for a first deployment-context feature pass.

Reason:

- the NHL-derived shift-stint path is already the approved source of truth for on-ice attribution
- the release-validation work already accepted NHL-correctness divergences and fixed the known zone-start overcount bug
- this task only adds coarse skater-role deployment context, not fragile exact frozen-NST replication logic

## Added Feature Surface

The training path now derives these optional shot-level features from reconstructed shift stints plus `players.position`:

- `ownerForwardCountOnIce`
- `ownerDefenseCountOnIce`
- `opponentForwardCountOnIce`
- `opponentDefenseCountOnIce`
- `ownerGoalieOnIce`
- `opponentGoalieOnIce`
- `ownerSkaterDeploymentBucket`
- `opponentSkaterDeploymentBucket`
- `skaterRoleMatchupBucket`

Interpretation:

- owner-side values are the shooting team’s deployment on the shot event
- opponent-side values are the defending team’s deployment on the same event
- deployment buckets summarize skater mix only
- goalie-presence flags remain separate so empty-net or extra-attacker states are still visible

## Current Bucket Format

Deployment buckets currently use coarse skater-role summaries such as:

- `3F-2D`
- `4F-1D`
- `3F-1D+1U`

Where:

- `F` = forward
- `D` = defense
- `U` = unknown skater role from roster metadata

Matchup buckets combine the two sides:

- `3F-2D_vs_4F-1D`

## Important Boundary

This is deliberately a coarse first pass.

It does not yet attempt:

- true line or pairing identity joins
- teammate identity modeling
- opponent identity modeling
- deployment recency or zone-start interaction logic

Those stay for later tasks if this coarse deployment surface proves useful.

## Verification

Focused tests passed for:

- pure deployment-context derivation
- baseline dataset encoding of the new numeric, boolean, and categorical keys
- end-to-end training-context enrichment inside the baseline training script

Training smoke run passed with an explicit deployment-context feature selection:

- family: `logistic_l2`
- games: `2025021018, 2025021103, 2025021003, 2025021140`
- artifact tag: `logistic_l2-s20252026-p1-st1-f1-cfg9798b77b`
- feature family: `first_pass_v1+custom`

The smoke artifact verified that the new deployment and matchup features are accepted by the current training harness.

## Conclusion

- deployment and matchup context is now available as optional training input
- the feature surface is intentionally coarse and built only from the stable on-ice joins already accepted in the validation phase
- comparative benchmarking is deferred to task `4.4`
