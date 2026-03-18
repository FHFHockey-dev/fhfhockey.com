# FORGE Dashboard Top Adds Ranking Formula

## Scope

Sub-task `3.3` formalizes the default Top Player Adds ranking model used by [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx).

## Design Goal

The PRD requirement is:

- recent trend strength should be primary
- lower ownership should receive a real boost
- projection quality should still matter
- the score contract must leave room for future weekly streaming context

## Implemented Formula

The ranking helper now lives in [topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts).

Per candidate:

- `trendStrengthScore = delta * 5`
- `ownershipBiasScore = ((100 - ownership) / 100) * 8`
- `projectionSupportScore = (projectionPts * 2.25) + (ppp * 0.85) + (sog * 0.35) + ((hit + blk) * 0.12)`
- `scheduleContextScore = 0`
- `riskPenaltyScore = uncertainty * 1.5`

Total:

- `total = trendStrengthScore + ownershipBiasScore + projectionSupportScore + scheduleContextScore - riskPenaltyScore`

## Why These Weights

- trend strength carries the largest single multiplier so the rail remains trend-led
- ownership bias is strong enough to change ordering when trend is similar
- projection support prevents empty momentum-only rankings
- uncertainty reduces overaggressive rankings without dominating the score
- schedule context is intentionally wired into the score object now, even though it remains `0` until weekly-streaming inputs are added in a later task

## Sort Contract

Candidates are sorted by:

1. `score.total`
2. `delta`
3. lower `ownership`
4. higher `projectionPts`

This keeps the visible rail consistent with the PRD:

- trust recent movement first
- reward actionable availability
- preserve projection quality as support, not as the top-level identity

## Verification Coverage

[topAddsRanking.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.test.ts) now protects three things:

- trend strength remains dominant
- lower ownership breaks ties meaningfully
- schedule context has a reserved scoring lane without altering current behavior yet

## Deferred Follow-On

- `3.4` should add Yahoo ownership sparkline presentation
- `5.4` and `5.5` should feed real weekly schedule context into `scheduleContextScore`
