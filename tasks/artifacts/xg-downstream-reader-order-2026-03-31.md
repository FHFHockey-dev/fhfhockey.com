# xG Downstream Reader Order

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `6.1`
Scope: choose the first downstream readers that should consume the approved xG baseline once a skater-shot baseline is actually approved.

## Decision

The first downstream readers should be the most directly auditable player-facing and player-level consumers, not the most compounded ranking systems.

## Ordered Reader Priority

### 1. First Readers

Primary first readers once the baseline is approved:

- `/Users/tim/Code/fhfhockey.com/web/pages/stats/player/[playerId].tsx`
- planned underlying-stats readers built around the same player-level surfaces:
  - `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats`
  - `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/[playerId]`

Why these come first:

- they expose direct `ixG`, `xGF`, and `xGA` style outputs at the player-facing stat surface
- they are easier to audit row-by-row against approved artifacts than higher-order ranking systems
- they align with the repo’s ongoing player-underlying-stats expansion work
- mistakes are more diagnosable here because the values are closer to the source metric families

### 2. Second Readers

After the first reader group is stable:

- `/Users/tim/Code/fhfhockey.com/web/sql/views/analytics.vw_sko_skater_base.sql`
- downstream dependent analytics views:
  - `/Users/tim/Code/fhfhockey.com/web/sql/views/analytics.vw_sko_skater_zscores.sql`
  - `/Users/tim/Code/fhfhockey.com/web/sql/views/analytics.vw_sko_skater_scores.sql`

Why these come second:

- they are still player-level and analytically useful
- but they compound xG into z-scores and score layers, which makes debugging harder than direct stat readers
- they should inherit a baseline that has already survived player-facing sanity checks

### 3. Deferred Readers

These should not be the first migration targets:

- `/Users/tim/Code/fhfhockey.com/web/lib/power-ratings.ts`
- trends and ranking readers that consume `ixg/xGF/xGA` indirectly
- long-horizon aggregate update paths such as:
  - `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-wgo-averages.ts`
  - `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts`

Why they are deferred:

- they stack additional smoothing, weighting, and ranking logic on top of xG
- reader-level regressions are harder to isolate there
- they should move only after the direct stat readers are stable on the approved baseline

### 4. Goalie-Facing Readers

Goalie-facing readers remain later than the skater-reader rollout.

Reason:

- goalie work is already gated on reuse of an approved skater-shot baseline
- no goalie-specific rollout should start before that prerequisite is satisfied

## Rollout Rule

When the baseline is finally approved, migration should happen in this order:

1. direct player stat readers
2. player-level analytics views
3. compounded trend, scoring, and power-rating readers
4. goalie-facing readers after their separate follow-up gate clears

## Boundary

This task chooses reader order only.

It does not yet decide:

- persisted model-metadata storage shape
- retrain cadence
- rollout health checks
- exact API or table cutover mechanics
