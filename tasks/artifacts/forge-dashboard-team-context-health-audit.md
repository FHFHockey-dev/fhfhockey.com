# FORGE Dashboard Team Trend Context Health Audit

## Status

- `red`

## Scope Audited

- [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx)
- [team-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/team-ratings.ts)
- [team-ctpi.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/team-ctpi.ts)
- [teamContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.ts)
- [teamRatingsService.ts](/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsService.ts)
- [normalizers.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)

## Component Intent

Team Trend Context is supposed to combine:

- current team power
- CTPI / momentum pulse
- same-slate matchup edge
- variance / warning context

into one current and trustworthy team-decision surface.

## Serving Contract

[TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) fetches three legs in parallel:

- `/api/team-ratings?date=...`
- `/api/v1/trends/team-ctpi`
- `/api/v1/start-chart?date=...`

Then it:

- normalizes each payload
- computes `powerScore` from the team-ratings leg
- computes `ctpiDelta` from CTPI spark series
- computes matchup edge from Start Chart team ratings
- renders spotlight cards plus a rank table

## Source Contract

Current Team Trend Context depends on:

- `team_power_ratings_daily`
- `team_power_ratings_daily__new`
- `team_ctpi_daily`
- `games`
- `player_projections`
- `goalie_start_projections`
- supporting team power inputs already embedded into Start Chart rating snapshots

## Live Source Evidence

### Team Ratings Leg

Direct source and API evidence for `2026-03-15`:

- `team_power_ratings_daily` latest date: `2026-03-17`
- `team_power_ratings_daily__new` latest date: `2026-03-17`
- `/api/team-ratings?date=2026-03-15` row count: `32`
- `trend10 = 0` count on `2026-03-15`: `32 / 32`
- distinct `trend10` values on that date: `[0]`

So the team-power leg is current by date, but its trend field is completely flat in live data.

### CTPI Leg

Direct API evidence from `/api/v1/trends/team-ctpi`:

- returned teams: `32`
- API `generatedAt`: current
- latest sparkline date across returned teams: between `2025-11-06` and `2025-11-07`

That means the CTPI API is presenting current-time metadata while actually serving early-November season snapshots.

Code inspection explains why:

- [team-ctpi.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/team-ctpi.ts) reads `team_ctpi_daily`
- it does not paginate or range the Supabase read
- Supabase therefore returns only the default first `1000` ordered rows
- because the query is ordered by `date ASC`, the response gets truncated to early-season data

So the CTPI leg is not merely stale. It is systematically truncated.

### Matchup-Edge Leg

Direct API evidence from `/api/v1/start-chart?date=2026-03-15`:

- `dateUsed`: `2026-03-15`
- games returned: `6`
- games with home ratings: `6`
- games with away ratings: `6`

The matchup-edge leg is present and current for the audited slate date, but it inherits the same team-rating source family whose `trend10` field is flat.

## Route And Helper Behavior

### Team Ratings Route

[team-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/team-ratings.ts) is operationally simple:

- requires an exact `date`
- proxies to [teamRatingsService.ts](/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsService.ts)
- returns exact-date rows only

[teamRatingsService.ts](/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsService.ts):

- prefers `team_power_ratings_daily`
- falls back to `team_power_ratings_daily__new`
- returns exact-date rows
- caches for `60s`

This leg is date-current, but it is faithfully serving a flat `trend10` field.

### CTPI Route

[team-ctpi.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/team-ctpi.ts):

- prefers precomputed `team_ctpi_daily`
- only falls back to on-the-fly compute if the daily table is empty
- returns `generatedAt` based on request time, not snapshot recency

The failure is therefore hidden:

- the route looks current
- the payload shape looks complete
- but the underlying season read is truncated to early November

### Team Context Helper Layer

[teamContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.ts):

- computes `powerScore` deterministically
- computes `ctpiDelta` from the first and last spark points
- builds matchup edge reciprocally from Start Chart ratings

The helper math itself is coherent.

The problem is not the formulas. It is the freshness and completeness of the inputs.

### UI Behavior

[TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx):

- renders a flat-trend warning if every `trend10` is effectively zero
- warns if CTPI or Start Chart requests fail
- does **not** inspect CTPI recency
- does **not** surface that CTPI is months older than the selected dashboard date

So the component currently mixes:

- current team ratings
- stale CTPI pulse
- current same-slate matchup edge

without telling the user that the CTPI layer is stale.

## What Is Working

- team ratings are current by date and available for all `32` teams on the audited date
- Start Chart matchup-edge coverage is present for all `6` audited slate games
- [teamContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.ts) keeps power-score, CTPI-delta, and matchup-edge math explicit and test-covered
- existing dashboard tests already prove the intended UI contract for:
  - CTPI display
  - matchup edge display
  - top/bottom range toggles
  - team-detail links

## Health Failures

### 1. The CTPI feed is materially stale while presenting itself as current

This is the most important failure.

`/api/v1/trends/team-ctpi` returns a current `generatedAt`, but the latest spark dates in the payload are only `2025-11-06` to `2025-11-07`.

That means the dashboard is rendering a stale momentum layer as if it were current.

### 2. The CTPI route is truncated by the default Supabase row cap

[team-ctpi.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/team-ctpi.ts) does not paginate or range the `team_ctpi_daily` read.

Because the query is ordered by ascending date, the default `1000` rows capture early-season data and prevent the route from ever reaching the current end of the season.

This is a serving bug, not just a cron lag.

### 3. The team-power trend field is flat for every team

For `2026-03-15`, all `32` rows in `/api/team-ratings` carry:

- `trend10 = 0`

[TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) at least warns about this, but the component still loses one of its advertised signal lanes because the source trend field is not carrying useful movement.

### 4. The card’s stale-state logic does not protect the mixed-cadence chain

[TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx):

- only derives `resolvedDate` from the team-ratings leg
- does not use CTPI recency at all
- only reports secondary warnings when CTPI or Start Chart fetches fail outright

So the component can remain visually healthy while one of its key sub-feeds is months old.

### 5. The current stale branch for team ratings is effectively dead

[team-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/team-ratings.ts) serves exact-date rows only.

That means [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) almost never gets a “nearest available snapshot” case from this route, even though it has a stale-message branch for it.

The real degraded path here is mixed-source staleness, not nearest-snapshot fallback.

## Status Rationale

Team Trend Context does not qualify for `green` or `yellow`.

Why it is not `green`:

- CTPI is not current
- `trend10` is not useful
- the mixed-source state is not surfaced safely

Why it is not `yellow`:

- one of the core signal legs is currently wrong by months, not hours
- that failure is hidden behind a current response timestamp
- the component therefore presents misleading freshness, not just partial freshness

Under the scoring model, that keeps the component `red`.

## Required Follow-Ups

- fix [team-ctpi.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/team-ctpi.ts) so it reads the full current season instead of truncating at the default Supabase row cap
- add explicit CTPI recency handling to [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) so stale CTPI becomes a visible degraded state, not a silent mixed-source merge
- investigate why `trend10` is `0` for all `32` current team-power rows and either fix the writer or formally downgrade/remove that signal from the card until it is trustworthy
- align the component’s stale/degraded model to the real mixed-cadence risk:
  - current team ratings
  - stale CTPI
  - current matchup edge
- add a reconciliation check that records:
  - team-ratings snapshot date
  - CTPI latest spark date
  - team count coverage for both legs
  - flat-trend coverage count
