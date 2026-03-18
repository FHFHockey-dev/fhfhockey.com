# Forge Dashboard Band State Wrappers

## Scope

- Task: `2.4`
- Page: [web/pages/forge/dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
- Cards:
  - [web/components/forge-dashboard/SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)
  - [web/components/forge-dashboard/TopMoversCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopMoversCard.tsx)
  - [web/components/forge-dashboard/TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx)
  - [web/components/forge-dashboard/SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx)
  - [web/components/forge-dashboard/HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx)
  - [web/components/forge-dashboard/GoalieRiskCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/GoalieRiskCard.tsx)
- Styles: [web/styles/ForgeDashboard.module.scss](/Users/tim/Code/fhfhockey.com/web/styles/ForgeDashboard.module.scss)

## What Changed

- Added a shared card-to-page status contract:
  - `loading`
  - `error`
  - `staleMessage`
  - `empty`
- Each major dashboard card now reports band-level state upward.
- The page now aggregates module state into band summaries for:
  - `Tonight's Slate`
  - `Team Trend Context`
  - `Player Insight Core`
  - `Goalie and Risk`

## Wrapper Behavior

- Band headers now support a consistent status region instead of relying only on per-card messages.
- Each band can render:
  - loading pills
  - a small loading shell
  - error alerts
  - stale alerts
  - empty-state alerts

## Why This Matters

- loading/error/stale treatment is now consistent at the page-shell level
- card internals still keep their detailed local messages
- major sections no longer depend on each child inventing its own wrapper treatment

## Verification Notes

- page-level tests now cover:
  - band-level loading summary presence
  - band-level stale-summary rendering for sustainability fallback
