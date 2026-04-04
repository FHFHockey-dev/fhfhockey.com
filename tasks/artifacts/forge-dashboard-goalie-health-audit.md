# FORGE Dashboard Goalie Health Audit

## Status

- `red`

## Scope Audited

- [GoalieRiskCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/GoalieRiskCard.tsx)
- [goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts)
- [normalizers.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)
- [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts)
- [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)

## Component Intent

The goalie band is supposed to give a fantasy manager a current goalie decision surface with:

- starter probability
- win / shutout context
- volatility and blowup risk
- confidence drivers
- a practical start/sit recommendation

## Serving Contract

[GoalieRiskCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/GoalieRiskCard.tsx):

- fetches `/api/v1/forge/goalies?date={date}&horizon=1`
- normalizes the payload with [normalizeGoalieResponse(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)
- filters by team when needed
- exposes band-level state through:
  - `loading`
  - `error`
  - `staleMessage`
  - `empty`

## Source Contract

[goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts) serves from:

- `forge_goalie_projections`
- `forge_runs`
- `games`
- `forge_projection_calibration_daily`

and embeds uncertainty/model context from the goalie projection payload.

## Live API Evidence

Direct live response from `/api/v1/forge/goalies` returned:

- `requestedDate = 2026-03-28`
- `asOfDate = 2026-03-26`
- `fallbackApplied = true`
- `horizonGames = 1`
- `requested.scheduledGamesOnDate = 15`
- `requested.rowCount = 0`
- `resolved.scheduledGamesOnDate = 13`
- `resolved.rowCount = 4`

So the route is operational, but the current request is not being served from the requested date. It is falling back two days and only finding four rows on the resolved date.

Sample live rows:

- `Kevin Lankinen`
  - `starter_probability = 0.7871`
  - `proj_win_prob = 0.4853`
  - `modeled_save_pct = 0.881`
  - `blowup_risk = 0.5485`
  - `confidence_tier = MEDIUM`
  - `recommendation = SIT`
- `Jet Greaves`
  - `starter_probability = 0.9385`
  - `proj_win_prob = 0.6045`
  - `modeled_save_pct = 0.9118`
  - `blowup_risk = 0.3871`
  - `confidence_tier = HIGH`
  - `recommendation = STREAM_TARGET`

## What Is Working

### 1. The route has stronger diagnostics than several other audited surfaces

[goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts) returns:

- requested vs resolved date
- fallback status
- row counts
- scheduled game counts
- run metadata
- calibration hints
- notes explaining normalization or empty-result conditions

This is materially better observability than the current trend-movement surface.

### 2. The card renders model context and risk framing coherently

[GoalieRiskCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/GoalieRiskCard.tsx):

- presents spotlight cards first
- extracts starter-confidence drivers from the uncertainty payload
- uses practical labels for:
  - volatility
  - risk
  - confidence tier
  - recommendation

The UI semantics are aligned with the payload.

### 3. The route and card both surface fallback date changes

The route exposes:

- `asOfDate`
- `fallbackApplied`

The card then renders:

- `Showing nearest available projection date ({asOfDate}).`

That means the band is not silently pretending a fallback result is exact-date current.

## Health Failures

### 1. The current live request is fallback-driven

The route had:

- `15` scheduled games on the requested date
- `0` goalie rows on the requested date

and had to fall back to:

- `2026-03-26`
- only `4` rows

That is a source-health failure, not just a UI concern.

### 2. The band can only show a partial goalie slate under current live conditions

Even though the route is instrumented, the current resolved result still contains only a small subset of goalies relative to the requested game slate.

So the band is not delivering the full decision surface implied by its product intent.

### 3. Dashboard freshness policy is present but depends on a stale effective date

[freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts) treats:

- `forge-goalies`
  - `maxAgeHours = 30`
  - severity `error`

That policy is appropriate, but the live route evidence shows the error condition is currently real.

### 4. This component inherits the same upstream instability already seen in the slate audit

The goalie band is not just colliding with presentation issues. It is downstream of the same current-state problem already visible in the slate chain:

- requested-date goalie rows missing
- nearest-date fallback in effect

So the goalie band is independently unhealthy, not merely collateral UI fallout.

## Status Rationale

Why this is not `green`:

- the current request is not being served from the requested date
- the effective result is only a partial fallback set

Why this is not `yellow`:

- the source chain is currently failing to deliver requested-date coverage
- the component cannot provide the full decision surface a user expects on the current slate
- the freshness failure is live and material, not marginal

Under the scoring model, that keeps the goalie band `red`.

## Observability

Useful current positives:

- [goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts) already returns high-signal diagnostics
- [dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx) already covers goalie empty-state and guide rendering
- the dashboard policy layer already has:
  - freshness coverage
  - endpoint budget coverage

Current gap:

- no current automated check proves that requested-date goalie coverage is complete enough for the active slate

## Required Follow-Ups

- trace the upstream refresh chain feeding `forge_goalie_projections` for requested-date coverage failures
- decide what the minimum acceptable row coverage is before the goalie band should:
  - warn
  - degrade
  - or block
- add an explicit coverage check that compares:
  - scheduled games on requested date
  - requested-date goalie rows
  - resolved-date goalie rows after fallback
- keep `/api/v1/forge/goalies` quarantined until requested-date coverage is reliable again
