# PRD: FORGE Dashboard Refresh

## 1. Introduction / Overview

The FORGE dashboard needs a full reset.

The previous attempt at [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) landed as a collection of separate modules, but it did not yet feel like the one-page fantasy hockey command center the product is aiming for. The refreshed dashboard must be a slate-first, insight-dense page for fantasy managers who care about sustainability, trend strength, ownership-driven pickup opportunities, and quick access to deeper views.

The main job of the new dashboard is:

- tell the user who is for real
- tell the user who is fake hot
- keep tonight's slate and streamable player opportunities visible at first glance

The dashboard should sit between the current visual and product instincts of:

- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)
- [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
- [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)
- [underlying-stats/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx)
- [trends/placeholder.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/placeholder.tsx)
- [trendsSandbox.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsSandbox.tsx)

The desired product tone is approximately `75:25` in favor of a dense analytical terminal, with enough editorial labeling to keep the insights readable and actionable.

Two routes are in scope:

- [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx): the actual dashboard
- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx): rebuilt as a slim landing page with preview modules and links into the full dashboard and subpages

## 2. Goals

1. Build a single-page dashboard at [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) that opens with tonight's slate as the dominant first-glance element.
2. Surface top player adds ranked primarily by recent trend strength, with a hard default ownership filter and visible ownership movement.
3. Make "real vs fake hot" the central player-insight layer through sustainability and trend cards.
4. Preserve team context at first glance through team power, CTPI, matchup strength, and variance / sustainability warning signals.
5. Use different card types for projection, sustainability, and streak/trend use cases instead of forcing one generic player card for all contexts.
6. Provide multiple equally accessible drill-in paths to:
   1. a new dedicated team detail page
   2. the existing or refreshed player-trend subpage
   3. the start-chart view
   4. the trends view
7. Use `yahoo_players` ownership data, including `ownership_timeline`, to show current ownership and recent ownership movement on player opportunity surfaces.
8. Support fantasy-manager workflows for both:
   1. tonight-only decisions
   2. week-long streaming decisions
9. Keep the mobile experience usable by stacking sections, collapsing heavier charts behind accordions, and preserving the most important sections expanded by default.
10. Replace the current underwhelming dashboard composition with a cleaner, better-contained page architecture and component plan before major implementation work continues.

## 3. User Stories

1. As a fantasy hockey manager, I want tonight's slate to be the first thing I see so I can immediately understand the active game environment.
2. As a fantasy hockey manager, I want top player adds filtered by ownership so I can focus on realistic waiver and streamer options.
3. As a fantasy hockey manager, I want to distinguish sustainable risers from fake-hot players so I do not chase noise.
4. As a fantasy hockey manager, I want hot/cold and trending up/down signals separated from sustainability signals so I can understand both short-term momentum and long-term trust.
5. As a fantasy hockey manager, I want visible ownership movement so I can spot pickup urgency before the market fully reacts.
6. As a fantasy hockey manager, I want team trend context next to player opportunity context so I can evaluate whether the environment supports the player signal.
7. As a fantasy hockey manager, I want player and team cards to lead naturally into deeper pages without having to hunt through nav.
8. As a mobile user, I want the most important decision sections to remain easy to scan even when heavier analytical sections are collapsed.

## 4. Functional Requirements

1. The system must rebuild [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) as a one-page dashboard with tonight's slate as the top visual priority.
2. The system must rebuild [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) as a slim landing page that previews the dashboard and links into the main dashboard and related subpages.
3. The dashboard top band must use:
   1. a wide slate strip as the dominant hero
   2. a right-side Top Player Adds rail
4. The dashboard must not abandon Top Player Adds or Team Trend Context just because tonight's slate is first.
5. The dashboard must include a compact secondary nav and also support navigation by clicking cards, rows, headshots, and logos.
6. The dashboard must expose links to at least:
   1. the full dashboard
   2. the start-chart view
   3. the trends view
   4. the new team detail page
   5. the relevant player detail destinations
7. The dashboard must include a Top Player Adds section ranked by recent trend strength with a low-ownership bias.
8. The Top Player Adds section must support a `Tonight` / `This Week` toggle.
9. The `Tonight` / `This Week` toggle must apply to Top Player Adds only.
10. The Top Player Adds section must default to an ownership range of `25%` to `75%`.
11. Other player discovery sections must default to an ownership range of `25%` to `50%`.
12. Ownership thresholds must be user-adjustable via sliders or equivalent controls.
13. The dashboard must use `yahoo_players.percent_ownership` and the latest `ownership_timeline` value as the current ownership signal.
14. The dashboard must display a recent ownership sparkline on relevant player cards using `ownership_timeline`.
15. The default ownership trend spark window must be `5` days.
16. The dashboard must include Team Trend Context near the top of the page.
17. Team Trend Context must include:
   1. team power
   2. CTPI
   3. matchup strength
   4. variance or sustainability warning context
18. Team Trend Context cards or rows must also include quick links into the dedicated team detail view.
19. The dashboard must include paired player insight tabs or differentiators for:
   1. `Sustainable` vs `Unsustainable`
   2. `Hot` vs `Cold`
20. The primary player insight pair shown on first load must be:
   1. sustainable risers
   2. unsustainable heaters
21. The dashboard must support additional trend-state tabs or differentiators for:
   1. trending up
   2. trending down
22. Projection cards, sustainability cards, and streak/trend cards must remain distinct card types with different information density and purpose.
23. Projection cards must emphasize:
   1. near-term fantasy utility
   2. matchup context
   3. ownership
   4. click-through opportunity
24. Sustainability cards must emphasize:
   1. signal quality
   2. trend-band or elasticity context
   3. trust / fade framing
25. Streak or trend cards must emphasize:
   1. recent movement
   2. short explanation
   3. whether the streak appears actionable
26. The dashboard must include a goalie section with:
   1. start probability
   2. risk / volatility
   3. confidence drivers
   4. matchup context
27. The dashboard must include a Start-Chart-style slate view that remains recognizable as a fantasy decision tool rather than only a visualization.
28. The dashboard must include moderate charting only, with approximately `2` to `3` compact charts at once on desktop.
29. The dashboard must not rely on heavy chart density as the primary mode of understanding the page.
30. The dashboard must use stale-data handling that can show stale data with warnings when possible.
31. The dashboard must document section-specific stale handling rules instead of applying one single policy blindly.
32. The system must create a new dedicated team detail page for team clicks from dashboard team contexts.
33. Player card click behavior must depend on card type.
34. Sustainability- and trend-focused player cards should lead to the player trends experience, either the existing [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx) or a refreshed equivalent.
35. Projection- or opportunity-focused player cards may lead to a more dashboard-specific player detail destination if that provides better context than the trend page.
36. The PRD and implementation plan must define the exact card-type-to-destination mapping before build work begins.
37. On desktop, the dashboard should feel like one connected control surface rather than separate unrelated modules.
38. On mobile, the same sections must remain available, but some heavier charts must collapse behind accordions.
39. On mobile, the following sections must remain expanded by default:
   1. slate
   2. sustainable / unsustainable section
   3. goalie section
40. The new [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) landing page must include:
   1. a slate preview
   2. a Top Player Adds preview
   3. a sustainability preview
   4. links into the full dashboard and subpages
41. The landing page must act as a gateway and preview, not as a second full dashboard.
42. The dashboard must support visual and data integration with the existing schedule helpers where useful, including:
   1. [useSchedule.ts](/Users/tim/Code/fhfhockey.com/web/components/GameGrid/utils/useSchedule.ts)
   2. [useTeamSchedule.ts](/Users/tim/Code/fhfhockey.com/web/hooks/useTeamSchedule.ts)
43. The dashboard must incorporate existing ownership movement patterns where useful, including:
   1. [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
   2. [TransactionTrends.tsx](/Users/tim/Code/fhfhockey.com/web/components/TransactionTrends/TransactionTrends.tsx)
44. The system must inventory and reconcile overlapping dashboard components before implementation so similar components are merged where appropriate.

## 5. Non-Goals (Out of Scope)

1. This PRD does not require keeping the current [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) layout intact.
2. This PRD does not require preserving the current [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) card composition.
3. This PRD does not require a single universal player card that serves all contexts.
4. This PRD does not require chart-heavy analysis as the dominant design language.
5. This PRD does not require betting-focused workflows.
6. This PRD does not require user authentication or per-user customization.
7. This PRD does not require replacing every legacy subpage immediately; some routes may remain as linked drill-ins.
8. This PRD does not require solving every deeper projection, sustainability, or freshness issue before the dashboard redesign plan is approved.

## 6. Design Considerations

1. The dashboard should feel like a fantasy-control terminal, not a generic content homepage.
2. The visual tone should be analytical first, with light editorial framing only where it improves comprehension.
3. The top of the page must visually communicate that tonight's slate is the organizing context.
4. The page must still preserve room for:
   1. Top Player Adds
   2. Team Trend Context
   3. sustainability and trend distinctions
5. The right-side Top Player Adds rail should read like a live opportunity board, not a secondary afterthought.
6. The page should avoid a "pile of cards" feeling by using clear banding and hierarchy.
7. Compact charts should be used as supporting evidence, not as the only expression of insight.
8. Logos, headshots, and rows should behave as intentional navigation cues into the correct subpages.
9. Mobile should keep the same overall content model, but reduce simultaneous complexity through accordions and prioritized expansion behavior.
10. The design should reuse the best compositional ideas from:
    1. [trends/placeholder.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/placeholder.tsx)
    2. [trendsSandbox.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsSandbox.tsx)
    3. [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
    4. [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)
11. The design should not simply restyle the existing [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx); it should recompose it.

## 7. Technical Considerations

### 7.1 Primary Sources and Existing Surfaces

The dashboard refresh should selectively reuse or adapt logic from:

- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)
- [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
- [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)
- [underlying-stats/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx)
- [trends/placeholder.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/placeholder.tsx)
- [trendsSandbox.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsSandbox.tsx)

### 7.2 High-Value Reuse Targets

1. Slate / matchup surfaces:
   - game strip patterns from [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
   - goalie slate and confidence drivers from [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
2. Team context surfaces:
   - team power summary and sub-ratings from [underlying-stats/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx)
   - CTPI and movers logic from [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)
3. Sustainability and trend surfaces:
   - storytelling and chart-card composition from [trends/placeholder.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/placeholder.tsx)
   - trend-band and elasticity concepts from [trendsSandbox.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsSandbox.tsx)
4. Search and drill-ins:
   - search behaviors from [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)
   - metric-family and streak concepts from [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)

### 7.3 Ownership Integration

1. The system should read current ownership from `yahoo_players`.
2. The system should use the latest element of `ownership_timeline` as the current ownership signal when needed.
3. The system should support a `5`-day recent ownership sparkline on player opportunity cards.
4. Existing ownership trend infrastructure in:
   - [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
   - [TransactionTrends.tsx](/Users/tim/Code/fhfhockey.com/web/components/TransactionTrends/TransactionTrends.tsx)
   should be evaluated for reuse rather than rebuilding the sparkline logic from scratch.

### 7.4 Schedule and Streaming Context

1. The Top Player Adds section should support both:
   1. `Tonight`
   2. `This Week`
2. Existing schedule helpers in:
   - [useSchedule.ts](/Users/tim/Code/fhfhockey.com/web/components/GameGrid/utils/useSchedule.ts)
   - [useTeamSchedule.ts](/Users/tim/Code/fhfhockey.com/web/hooks/useTeamSchedule.ts)
   should be evaluated as building blocks for the weekly streaming view.

### 7.5 Component Consolidation Expectations

Before major UI implementation, the task plan should explicitly identify which similar components should be merged into singular reusable components.

Likely merge targets include:

1. team power and team context cards
2. slate strip and matchup strip patterns
3. sustainability, hot/cold, and trend-signal cards
4. player opportunity cards that combine projection and ownership context

### 7.6 Page and Route Expectations

1. [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) is the main product page.
2. [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) becomes the landing / preview surface.
3. A new dedicated team detail page should be created.
4. Player click routing must be formally mapped by card type in the implementation plan.

## 8. Success Metrics

1. The dashboard immediately communicates tonight's slate as the primary context on first load.
2. The dashboard surfaces top player adds that are ownership-filtered by default and visibly actionable.
3. Users can distinguish sustainable risers from fake-hot players without leaving the page.
4. Team context, player opportunity, sustainability, and goalie risk feel like one connected workflow rather than isolated modules.
5. The page supports both `Tonight` and `This Week` add workflows without confusing the user.
6. The landing [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) page clearly funnels users into the dashboard and related subpages.
7. The component plan reduces duplication by merging obviously overlapping surfaces before implementation.
8. Mobile preserves the most important decision areas even when heavier sections collapse.

## 9. Open Questions

1. What exact route should the new dedicated team detail page use?
2. For player click routing, which exact card types should go to:
   1. the player trends page
   2. a dashboard-specific player detail page
3. What exact formula should define the Top Player Adds ranking once the `Tonight` / `This Week` split is active?
4. Which sections should show stale data with warnings versus stronger blocked-state cards?
5. Should the dashboard-specific player detail page exist in MVP, or should some card types temporarily route to the trends player page until the new page is built?
6. Which `2` to `3` charts should be considered mandatory for the initial desktop dashboard layout?

