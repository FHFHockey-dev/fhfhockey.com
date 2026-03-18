# Forge Dashboard Top-Band Layout Tuning

## Scope

- Task: `2.3`
- Styles: [web/styles/ForgeDashboard.module.scss](/Users/tim/Code/fhfhockey.com/web/styles/ForgeDashboard.module.scss)
- Visual reference: user-supplied desktop and mobile screenshots from `2026-03-14`

## Problem Observed

The first shell pass established the correct band order, but the page still looked visually compressed on large screens.

The screenshots showed three concrete issues:

1. the page was still behaving like a viewport-locked dashboard
2. panels were collapsing into internal scroll-boxes instead of reading as normal page sections
3. the `Top Player Adds` rail did not have enough visual separation from the slate hero to feel intentional

## Layout Decisions

- Removed the large-screen viewport lock behavior that was forcing the dashboard into a compressed fixed-height frame.
- Removed the large-screen panel-overflow rule that was turning major content panels into nested scroll areas.
- Increased the desktop top-band imbalance in favor of the slate hero.
- Added explicit desktop minimum heights so the top band and key lower bands hold their footprint even when a module has sparse data.
- Made the desktop right rail sticky so the opportunity rail stays visible during downward scanning.

## Resulting Intent

- `Tonight's Slate` now owns more visual space than the placeholder rail.
- `Top Player Adds` still remains visible as a persistent right-hand opportunity surface.
- `Team Trend Context` is no longer visually buried by the compressed-shell behavior.
- The page now behaves like a scrollable command surface rather than a rigid analytics viewport.

## Deferred

- The real opportunity-rail content still belongs to task `3.0`.
- Further card-level visual tuning inside the top band should happen after the real adds rail is implemented.
