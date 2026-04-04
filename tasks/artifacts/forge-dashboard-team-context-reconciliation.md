# FORGE Dashboard Team Trend Context Reconciliation

## Purpose

This artifact reconciles Team Trend Context from source APIs through the rendered card so the component is judged on what it is actually showing the user.

It covers:

- team ratings API output
- CTPI API output
- Start Chart matchup input
- TeamPowerCard rendering
- displayed trend, momentum, matchup, and variance labels

## Reconciliation Verdict

- overall Team Trend Context reconciliation: `red`
- team-power and matchup rendering: `green`
- CTPI/momentum temporal accuracy: `red`
- variance and flat-trend warning rendering: `green`

The component is not flattening all of its inputs. It is correctly rendering several signals from the payloads it receives. But it is mixing current team ratings with stale CTPI and then presenting the whole panel as one current snapshot.

## Current Render Contract

[TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) combines:

- power score from `/api/team-ratings`
- CTPI score and momentum from `/api/v1/trends/team-ctpi`
- matchup edge from `/api/v1/start-chart`
- variance from `/api/team-ratings`

Then it renders:

- spotlight cards
- top/bottom ranking table
- flat-trend warning when all `trend10` values are near zero
- secondary warnings only when CTPI or Start Chart requests fail

## Live Reconciliation Evidence

### Team Ratings API

Direct live response from `/api/team-ratings?date=2026-03-15`:

- row count: `32`
- all `32` teams present
- every `trend10` value is `0`
- example live row:
  - `NJD`
  - `date = 2026-03-15`
  - `offRating = 99.37136978878361`
  - `defRating = 101.02469743692713`
  - `paceRating = 108.43905186600801`
  - `varianceFlag = 0`

### CTPI API

Direct live response from `/api/v1/trends/team-ctpi`:

- team count: `32`
- latest spark dates across returned teams: `2025-11-06` to `2025-11-07`
- example live row behavior:
  - `NJD` CTPI spark starts at `2025-10-29`
  - `NJD` latest CTPI spark point is `2025-11-07`

### Start Chart API

Direct live response from `/api/v1/start-chart?date=2026-03-15`:

- `dateUsed = 2026-03-15`
- games returned: `6`
- home ratings present for all `6`
- away ratings present for all `6`
- those embedded rating snapshots also carry `trend10 = 0`

### Variance Coverage

Direct live rating distribution for `2026-03-15`:

- `varianceFlag = 1`: `8` teams
- `varianceFlag = 0`: `24` teams

That confirms the current UI mapping is operating on a real binary source field, not inventing the distinction.

## What Reconciles Cleanly

### Team Power Values

[TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) computes:

- `powerScore = average(off, def, pace) + special-team adjustments`

through [computeTeamPowerScore(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.ts).

That matches the current UI contract. The card is not silently flattening the ratings leg.

### Matchup Edge

[buildSlateMatchupEdgeMap(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.ts) derives reciprocal matchup edges from Start Chart ratings, and [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) displays them as:

- opponent abbreviation
- signed edge chip

That rendering is faithful to the current matchup source contract.

### Variance Label

[TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) maps:

- `varianceFlag === 1` -> `High`
- everything else -> `Stable`

For the current live source, where the field is binary `0/1`, that mapping is faithful.

### Flat Trend Warning

The flat-trend warning is also faithful:

- the card warns when all `trend10` values are effectively zero
- live `/api/team-ratings?date=2026-03-15` does in fact have `32 / 32` teams at `trend10 = 0`

So this warning is not a UI hallucination. It is reflecting the current source state correctly.

## Reconciliation Failures

### 1. The panel snapshot label is misleading

[TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) sets:

- `metaDate = resolvedDate ?? date`

where `resolvedDate` comes only from the team-ratings leg.

So the panel header currently reads as a `2026-03-15` snapshot, even though the CTPI and momentum values inside the same panel are still derived from `2025-11-06` to `2025-11-07`.

That is the clearest reconciliation failure in the component.

### 2. CTPI and Momentum are rendered accurately to the stale CTPI API, but inaccurately to the intended product meaning

This distinction matters:

- the UI is faithfully rendering the stale CTPI payload it receives
- but the resulting displayed signal is not temporally accurate for the selected dashboard date

So the UI is not flattening the CTPI leg. It is misrepresenting its recency by omission.

### 3. The component has no warning for stale CTPI recency

[TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) only adds secondary warnings when:

- CTPI request fails
- Start Chart request fails

It does not warn when CTPI succeeds but is stale.

So the component can display:

- `CTPI`
- `Momentum`
- sparkline

without telling the user that all three are months old.

### 4. The tests currently validate ideal synchronized payloads, not the live mixed-cadence state

The existing page test for Team Trend Context in [dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx):

- assumes current team ratings
- assumes current CTPI spark series
- assumes current matchup edge

It correctly protects the intended display contract, but it does not protect against the real live failure mode where:

- ratings are current
- CTPI is stale
- the UI still labels the whole panel as current

## Status Rationale

Team Trend Context does not reconcile cleanly enough to be `yellow`.

What is genuinely accurate:

- team-power rendering
- matchup-edge rendering
- variance label rendering
- flat-trend warning rendering

What keeps the overall reconciliation `red`:

- the panel presents one current snapshot date while mixing in CTPI from early November
- momentum and CTPI are therefore misleading in context, even if they are faithful to the stale payload
- the UI has no explicit degraded-state treatment for that mixed-cadence failure

## Required Follow-Ups

- split the displayed recency model so Team Trend Context can show:
  - team-ratings snapshot date
  - CTPI snapshot date
  - matchup snapshot date
- add a degraded warning when CTPI recency materially lags the selected dashboard date
- decide whether stale CTPI should:
  - hide CTPI and momentum
  - keep them with a warning
  - or block the full Team Trend Context panel
- add a regression test that covers:
  - current team ratings
  - stale CTPI spark series
  - current matchup edge
  - and verifies the UI does not label the whole panel as fully current
