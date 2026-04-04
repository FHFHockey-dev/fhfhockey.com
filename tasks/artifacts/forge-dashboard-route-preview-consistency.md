# FORGE Route Preview Consistency

## Status

- `red`

## Scope Compared

- Landing route: [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- Full dashboard route: [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
- Previewed dashboard components:
  - [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)
  - [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
  - [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx)

## Consistency Goal

Each landing-page preview should be a smaller but semantically faithful version of the dashboard module it advertises. A preview does not need every control, but it must preserve:

- source family
- effective date honesty
- degraded-state meaning
- drill-in semantics

## Panel-By-Panel Comparison

### Slate Preview vs Dashboard Slate

Consistency result:

- `yellow`

What matches:

- both use `/api/v1/start-chart`
- both surface the resolved slate date
- both route preview rows into Start Chart with a date query

What drifts:

- the landing-page CTA uses `/start-chart` without the resolved date
- the preview is limited to three rows and strips out the dashboard's richer matchup focus state
- the landing page has no explicit equivalent to the dashboard band-level stale summary

Bottom line:

- the preview is recognizably the same surface, but the CTA-level context preservation is weaker than it should be

### Top Adds Preview vs Dashboard Top Adds

Consistency result:

- `red`

What matches:

- both use FORGE skater projections plus Yahoo ownership trends
- both rank candidates with [topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts)
- both stay within the broad `25% - 75%` opportunity concept

What drifts materially:

- the landing page hard-codes a single tonight-style preview
- the dashboard supports:
  - `Tonight / This Week`
  - ownership sliders
  - position filtering
  - schedule-context enrichment
  - ownership snapshot overlays
- the landing page preview does not expose the dashboard's degraded-state logic around schedule context or ownership filtering
- the landing page links players with `?date=${requestedDate}` even when the projection feed resolved to an older `asOfDate`

Bottom line:

- the preview does not merely simplify the dashboard module; it changes the operating contract enough that the same “Top Adds” label is stronger than the preview really deserves

### Sustainability Preview vs Dashboard Sustainability

Consistency result:

- `red`

What matches:

- both use `/api/v1/sustainability/trends`
- both split the view into trust-like versus risk-like directions
- both surface stale snapshot messaging when `snapshot_date !== requested date`

What drifts materially:

- the landing page shows only raw `S` and `Pressure`
- the dashboard adds:
  - trust / overheated explanation language
  - reason text
  - driver interpretation
  - ownership-band filtering
  - richer stale/degraded reporting through the dashboard band
- the landing-page labels `Trustworthy` and `Overheated` imply a stronger interpreted verdict than the raw preview actually justifies on its own

Bottom line:

- the landing route is currently using dashboard-language labels without carrying enough of the dashboard explanation contract to make those labels equally trustworthy

## Degraded-State Consistency

Landing-page degraded behavior is weaker than the dashboard in three ways:

- it treats each preview panel independently, but does not summarize when the page is mixed-cadence overall
- it uses notices and warnings, but does not preserve the dashboard's fuller band-level status model
- it can keep a preview visible while dropping the context that explains why the full dashboard would treat the same module more cautiously

## Drill-In Consistency

### Good

- preview rows mostly point at semantically related destinations
- sustainability rows go to trend-player drill-ins
- dashboard access is always available through nav and CTA links

### Weak

- `Open Start Chart` drops preview date context
- `Open Dashboard Adds` and `Open Dashboard Insight` do not preserve preview context at all
- Top Adds player links preserve the requested date, not the actual projection `asOfDate`

## Status Rationale

The landing-page previews are not consistently faithful enough to earn `yellow`.

The main problem is not that previews are smaller. That is expected.

The real problem is that two of the three previews change the practical meaning of the underlying module:

- Top Adds loses too much of the dashboard contract
- Sustainability keeps the label language without enough of the dashboard explanation layer
- the route as a whole also fails to normalize mixed-date preview context

That combination makes the preview surface too easy to over-trust.

## Required Follow-Ups

- define explicit “preview contracts” for slate, adds, and sustainability so landing modules are intentionally smaller rather than accidentally different
- preserve resolved preview context in drill-ins where the preview has already resolved an effective date
- add a page-level mixed-preview warning when preview modules are resolving from different dates
- either:
  - align landing-preview labels more closely to the reduced preview semantics, or
  - enrich the previews enough that the labels remain justified
