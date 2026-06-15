## Relevant Files

- `tasks/TASKS/forge-projections/command-center/prd-forge-command-center-rebuild.md` - Source PRD for the FORGE Command Center rebuild.
- `web/pages/forge/command-center.tsx` - New scratch route for the command-center dashboard.
- `web/styles/ForgeCommandCenter.module.scss` - New route-specific layout and visual styling for the command center.
- `web/components/forge-command-center/CommandCenterShell.tsx` - Shared shell, panel, and page-level layout primitives for the new route.
- `web/components/forge-dashboard/ForgeRouteNav.tsx` - Existing FORGE route-family navigation updated with a non-breaking Command Center link.
- `web/components/forge-command-center/CommandCenterControls.tsx` - Date, team, position, slate/window, and reset controls with URL-backed state.
- `web/components/forge-command-center/TeamPowerTerminal.tsx` - Team power, CTPI, matchup, and variance terminal module.
- `web/components/forge-command-center/FocusedSlateContext.tsx` - Slate and focused matchup module with goalie and fantasy-environment context.
- `web/components/forge-command-center/TopAddsWatchlist.tsx` - Ownership-aware top adds table/rail with sparks and add-score display.
- `web/components/forge-command-center/PlayerInsightCore.tsx` - Sustainability, trust/fade, quadrant, and momentum insight module.
- `web/components/forge-command-center/GoalieContextPanel.tsx` - Goalie probability, volatility, confidence, and recommendation module.
- `web/lib/dashboard/commandCenterTypes.ts` - Shared command-center route, module-state, module-contract, and mixed-state types.
- `web/lib/dashboard/commandCenterLinks.ts` - Shared command-center destination builder for context-preserving drill-in links.
- `web/lib/dashboard/commandCenterLinks.test.ts` - Route-continuity tests for command-center destination links.
- `web/lib/dashboard/commandCenterData.ts` - Coordinated data-loading and normalization layer for command-center modules.
- `web/lib/dashboard/commandCenterData.test.ts` - Focused tests for normalization, module states, mixed-date aggregation, and top-add filtering.
- `web/lib/dashboard/forgeLinks.ts` - Existing route-context parser/builder to extend for command-center links if needed.
- `web/__tests__/pages/forge/command-center.test.tsx` - Page-level tests for rendering, URL filters, state banners, and click-through context.
- `tasks/artifacts/forge-command-center-reconciliation-checklist.md` - Source-to-UI and promotion-gate checklist for the new route.

### Notes

- Use existing dashboard helpers where they are still clean: `normalizers.ts`, `freshness.ts`, `topAddsRanking.ts`, `playerOwnership.ts`, `teamContext.ts`, and `forgeLinks.ts`.
- Keep `/forge/dashboard` intact until the new route passes launch gates and the user approves promotion.
- Run focused Vitest tests during development, then `npm run test:full`, `npx tsc --noEmit --pretty false`, and `npm run build` from `web/` before promotion.

## Tasks

- [x] 1.0 Establish the command-center route and implementation boundary
  - [x] 1.1 Create `web/pages/forge/command-center.tsx` as a new route without modifying `/forge/dashboard` behavior.
  - [x] 1.2 Create `web/styles/ForgeCommandCenter.module.scss` and wire the new page to it instead of reusing `ForgeDashboard.module.scss` wholesale.
  - [x] 1.3 Create `web/components/forge-command-center/` for new command-center components, keeping existing `forge-dashboard` components untouched unless deliberately reused.
  - [x] 1.4 Add a route-level title, metadata, and basic page shell that renders successfully with mocked or empty view-model data.
  - [x] 1.5 Add a temporary nav path from the existing FORGE route family only if it does not disrupt current dashboard links.
  - [x] 1.6 Document in code or task notes that `/forge/dashboard` remains the rollback/reference route until explicit promotion.

- [x] 2.0 Build URL-backed filters and route-context continuity
  - [x] 2.1 Define command-center query params for `date`, `team`, `position`, slate/window mode, add mode, and resolved fallback date.
  - [x] 2.2 Extend or reuse `forgeLinks.ts` so command-center links preserve requested date, resolved date, selected team, selected position, mode, and return URL.
  - [x] 2.3 Build `CommandCenterControls` with date, team, position, slate/window, and reset controls.
  - [x] 2.4 Ensure filter changes update the URL with shallow routing where appropriate.
  - [x] 2.5 Define card/table row click destinations for player, team, start-chart, trends, and goalie contexts.
  - [x] 2.6 Add route-continuity tests covering filter parsing and click-through URL construction.

- [x] 3.0 Create the coordinated command-center data layer
  - [x] 3.1 Define command-center view-model and module-state types in `commandCenterTypes.ts`.
  - [x] 3.2 Create a module contract model covering source APIs, source tables, freshness expectation, fallback strategy, empty-state rule, and click destination.
  - [x] 3.3 Implement `commandCenterData.ts` to fetch and normalize existing API responses for start chart, FORGE players, FORGE goalies, team ratings, CTPI, sustainability, skater power, ownership trends, ownership snapshots, and latest run status when needed.
  - [x] 3.4 Dedupe overlapping requests and expose one normalized page view model to the route.
  - [x] 3.5 Aggregate requested/resolved date metadata from child feeds into one page-level mixed-state summary.
  - [x] 3.6 Preserve module-level loading, empty, partial, stale/fallback, and error states.
  - [x] 3.7 Keep current projection, sustainability, goalie, and top-add formulas unchanged unless a separate approved task authorizes math changes.
  - [x] 3.8 Add data-layer tests for successful normalization, partial failures, empty modules, fallback dates, mixed-date detection, and ownership-band filtering.

- [x] 4.0 Build shared command-center UI primitives
  - [x] 4.1 Implement shell and panel primitives in `CommandCenterShell.tsx` for page frame, module panels, section headers, and dense dashboard bands.
  - [x] 4.2 Implement reusable `ModuleState` rendering for loading, empty, partial, stale/fallback, and error states.
  - [x] 4.3 Implement `MixedStateBanner` for page-level mixed-date and fallback warnings.
  - [x] 4.4 Implement compact `StatusChip`, `MetricPill`, and `TrendSparkline` primitives.
  - [x] 4.5 Add table/list primitives that support dense desktop rows and mobile-safe compact rows.
  - [x] 4.6 Keep typography compact, avoid nested cards, and use existing FHFH visual tokens where practical.

- [x] 5.0 Implement the first-viewport command modules
  - [x] 5.1 Build `TeamPowerTerminal` with selected team trend, league-average comparison, offense, defense, pace, trend, finishing, goalie, and variance/instability scores.
  - [x] 5.2 Connect `TeamPowerTerminal` to team ratings, CTPI, slate, and projected team environment data where available.
  - [x] 5.3 Build `FocusedSlateContext` with the highest fantasy-environment matchup, team logos, game time, power edge, pace, projected environment, add/stream rating, and goalie confidence.
  - [x] 5.4 Render slate/game fallback and stale states without presenting fallback rows as current.
  - [x] 5.5 Build `TopAddsWatchlist` with rank, player, position, team, ownership, ownership movement, projection, model/add score, and trend sparkline.
  - [x] 5.6 Default Top Adds to the `25%` to `75%` ownership band and make any view toggles map to real filtered states.
  - [x] 5.7 Add click-through behavior from team, matchup, goalie, and player rows with route context preserved.

- [x] 6.0 Implement the player insight and goalie modules
  - [x] 6.1 Build `PlayerInsightCore` with sustainability/trust, recent momentum, cold fades, and overheated heaters as distinct concepts.
  - [x] 6.2 Add Top Trust / Sustainable Plays and Regression Risk / Fade Candidates tables.
  - [x] 6.3 Add a compact quadrant or equivalent visualization for trust versus momentum.
  - [x] 6.4 Add `MomentumTracker` rows for hot/cold movement using skater trend and ownership context.
  - [x] 6.5 Default non-add player insight ownership filtering to `25%` to `50%` unless the implementation documents a stronger reason.
  - [x] 6.6 Build `GoalieContextPanel` with starter probability, projected shots/saves/goals allowed, win/shutout probabilities, volatility, blowup risk, confidence tier, and recommendation.
  - [x] 6.7 Keep goalie uncertainty and starter-probability language explicit; do not collapse goalie output into a single confident point estimate.
  - [x] 6.8 Ensure player insight and goalie modules show module-level stale/fallback notes.

- [ ] 7.0 Apply the visual system and responsive layout
  - [x] 7.1 Implement the desktop layout around Image #2 as the primary reference and Image #1 as the broader inventory reference.
  - [x] 7.2 Use a dark terminal base with restrained cyan focus, green positive/actionable states, red risk/fade states, yellow/orange caution, and muted gray baseline states.
  - [x] 7.3 Keep dashboard panel radii at `8px` or smaller and avoid cards inside cards.
  - [x] 7.4 Use team logos, player headshots, compact icons, chips, and sparklines only where they support decisions.
  - [x] 7.5 Limit desktop-visible charts to `2` or `3` compact charts at once.
  - [x] 7.6 Implement mobile order: controls, slate/focused matchup, top adds, player insight, goalie risk, team context.
  - [x] 7.7 Convert dense tables into mobile-safe compact rows, accordions, or horizontal-safe lists without hiding core decision labels.
  - [ ] 7.8 Verify text does not clip, overlap, or overflow in the target desktop, tablet, and mobile viewport sizes.

- [ ] 8.0 Add tests and source-to-UI reconciliation coverage
  - [x] 8.1 Add `web/__tests__/pages/forge/command-center.test.tsx` for route rendering, empty states, module states, URL filters, and mixed-state banner behavior.
  - [x] 8.2 Add focused `commandCenterData` tests for API normalization and module contract behavior.
  - [x] 8.3 Add tests for top-add ownership defaults and player insight ownership defaults.
  - [x] 8.4 Add tests for click-through context preservation across player, team, start-chart, trends, and goalie links.
  - [x] 8.5 Create `tasks/artifacts/forge-command-center-reconciliation-checklist.md` with source API, source table, rendered value, freshness state, and verification method per module.
  - [ ] 8.6 Reconcile rendered command-center values against normalized API payloads for Team Power Terminal, Focused Slate Context, Top Adds Watchlist, Player Insight Core, and Goalie Context.
  - [ ] 8.7 Record any unresolved data trust, stale-state, or route-continuity gaps in the reconciliation checklist before promotion.

- [ ] 9.0 Validate, visually inspect, and prepare promotion
  - [x] 9.1 Run focused command-center tests during implementation.
  - [ ] 9.2 Run `npm run test:full` from `web/`.
  - [x] 9.3 Run `npx tsc --noEmit --pretty false` from `web/`.
  - [x] 9.4 Run `npm run build` from `web/`.
  - [ ] 9.5 Start the local dev server and visually verify `/forge/command-center`.
  - [ ] 9.6 Capture and inspect screenshots at `1440x900`, `1920x1080`, `390x844`, `430x932`, `768x1024`, and `834x1194`.
  - [ ] 9.7 Fix any overlapping text, broken responsive behavior, misleading stale state, or incoherent density found during browser verification.
  - [ ] 9.8 Compare `/forge/command-center` against `/forge/dashboard` and document whether the new route is ready to promote.
  - [ ] 9.9 Do not replace `/forge/dashboard` until the user approves promotion after reviewing the validated command-center route.
