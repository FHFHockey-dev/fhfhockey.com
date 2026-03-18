# Forge Dashboard Control Surface Implementation

## Scope

- Task: `2.2`
- Page: [web/pages/forge/dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
- Styles: [web/styles/ForgeDashboard.module.scss](/Users/tim/Code/fhfhockey.com/web/styles/ForgeDashboard.module.scss)
- Tests: [web/__tests__/pages/forge/dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx)

## What Changed

- Replaced the loose quick-links treatment with a unified command surface.
- Added an `Active Context` summary block with:
  - selected date
  - timezone label
  - team chip
  - position chip
  - slate-context chip
  - filter-scope explanation
- Added a compact secondary nav for:
  - `Dashboard`
  - `Start Chart`
  - `Trends`
  - `Team Detail`
  - `FORGE Landing`
- Added a team-aware team-detail shortcut that updates from the shared team filter.
- Added a `Reset Filters` action that restores the page to the default dashboard context.

## Shared Filter Contract

- `Date`
  - affects slate, team context, sustainability, and goalie bands
- `Team`
  - narrows slate-facing and team-facing sections
- `Position`
  - remaps skater-facing insight and adds-oriented sections

## Implementation Notes

- `Team Detail` currently falls back to `/trends` when no team is selected, while still communicating that a specific team filter is needed for the final drill-in path.
- The compact nav is intentionally cross-page, while band-level drill-ins remain a later task.
- The real opportunity-specific controls, including ownership and `Tonight` / `This Week`, remain deferred to task `3.0`.
