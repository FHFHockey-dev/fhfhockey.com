# FORGE Dashboard Slate Health Audit

## Status

- `red`

## Scope Audited

- [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)
- [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts)

## Component Intent

The slate surfaces are supposed to show the current or nearest-available Start Chart slate with matchup context, team ratings, and goalie probability context that a fantasy manager can trust at first glance.

## Serving Contract

- Primary serving route: [start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts)
- Dashboard surface:
  - [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)
  - mounted in [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
- Landing preview surface:
  - [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)

## Source Contract

The Start Chart route currently composes slate output from:

- `games`
- `player_projections`
- `goalie_start_projections`
- `yahoo_nhl_player_map_mat`
- `yahoo_players`
- `team_ctpi_daily`
- `team_power_ratings_daily` with fallback to `team_power_ratings_daily__new`

## Freshness Evidence

Live source snapshot taken on `2026-03-15`:

| Source | Latest date | Notes |
| --- | --- | --- |
| `games` | `2026-04-16` | current enough for the audited slate date |
| `player_projections` | `2026-03-15` | current for the audited slate date |
| `goalie_start_projections` | `2026-02-28` | materially stale versus the audited slate date |
| `yahoo_players` | `2026-03-15` | current |
| `team_ctpi_daily` | `2026-03-15` | current |
| `team_power_ratings_daily` | `2026-03-15` | current |
| `team_power_ratings_daily__new` | `2026-03-15` | current fallback surface |

Target-date evidence for `2026-03-15`:

- `games_on_target_date = 6`
- `skater_projection_rows_on_target_date = 216`
- `goalie_projection_rows_on_target_date = 0`
- latest goalie projection date remained `2026-02-28`

This means the slate route can resolve a current game date and current skater projection set while having no current goalie probability rows for that same slate.

## Route Behavior

[start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts):

- first fetches `games`, `player_projections`, and `goalie_start_projections` for the requested date
- falls back to the previous date only when there are `no games` and `no data`
- falls back to the latest available projection date only when there are still no games and no skater data
- does not treat missing goalie rows on an otherwise valid slate as a stale or blocked condition

That behavior is coherent for games and skater projections, but it is unsafe for a slate surface that claims to include goalie context.

## Source-To-UI Reconciliation

### Proven Working Paths

- slate date resolution is wired through `dateUsed`
- matchup tiles and focused matchup views are built from the Start Chart `games` payload
- team ratings are attached per game using `fetchTeamRatings(dateUsed)`
- dashboard and FORGE preview both normalize the Start Chart response with the shared dashboard normalizer

### Reconciliation Risk

- [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx) renders goalie context directly from `homeGoalies` and `awayGoalies`
- when those arrays are empty, the UI degrades to `No goalie probabilities`
- that absence is not currently tied to a goalie freshness warning, even when the broader slate still resolves as current
- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) uses the same Start Chart route for slate preview, so the preview inherits the same mixed-freshness risk

## Degraded / Fallback Behavior

Current degraded behavior is only partially safe:

- visible and good:
  - previous-date fallback is surfaced through `dateUsed`
  - latest-available slate fallback is surfaced in both dashboard and FORGE preview copy
- unsafe:
  - goalie-feed staleness is not surfaced when games and skater projections are present
  - the component can still look current because the resolved slate date can remain equal to the requested date
  - the user only sees missing goalie probabilities, not an explicit explanation that the goalie projection source is stale

Under the scoring model, this triggers an automatic downgrade to `red`:

- a source feed is known to be stale or broken
- the UI can still look current
- degraded behavior can silently mislead the user about component health

## Observability

Useful current verification paths:

- [dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx)
  - covers slate loading, focused matchup behavior, fallback messaging, and mobile section behavior
- [FORGE.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/FORGE.test.tsx)
  - covers slate preview rendering and latest-available preview messaging
- direct source inspection through Supabase
- payload budget contract in [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)
  - `/api/v1/start-chart` target `p95 <= 900ms`, payload budget `300_000` bytes

Gap:

- there is no current automated check proving that Start Chart goalie rows are fresh relative to the requested slate date

## Status Rationale

The slate surfaces are not safe to mark `green` or `yellow`.

They do have:

- a known serving route
- a clear source chain
- visible date fallback behavior for empty-slate cases
- existing UI tests

But they also have a material health failure:

- `goalie_start_projections` is stale relative to the current slate
- the route still resolves a current `dateUsed`
- the slate UI can therefore appear current while missing one of its advertised decision inputs

That fits the scoring model's `red` conditions more closely than `yellow`.

## Required Follow-Ups

- trace and document the upstream refresh chain that should keep `goalie_start_projections` current for Start Chart
- decide whether Start Chart should:
  - hard-warn when goalie rows are stale for the resolved slate date, or
  - block goalie context inside the slate hero until the goalie feed is current
- add a slate-specific reconciliation check that compares requested slate date, resolved `dateUsed`, game rows, and goalie projection freshness together
- add explicit observability for mixed-freshness Start Chart payloads so the route cannot silently pass as healthy when one sub-feed lags
