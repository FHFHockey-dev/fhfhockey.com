## Relevant Files

- `web/pages/goalies.js` - Current active goalie entrypoint that will need to move into the Variance route family and host the new UI behavior.
- `web/components/GoaliePage/GoalieLeaderboard.tsx` - Current leaderboard/tab header surface where route, label, and display changes will need to stay consistent.
- `web/components/GoaliePage/GoalieList.tsx` - Page-layer adapter where ranking, Value Tier shaping, and Minimum GP parsing will likely live.
- `web/components/GoaliePage/GoalieTable.tsx` - Weekly table renderer where Relativity display and column presentation will be updated.
- `web/components/GoaliePage/goalieCalculations.ts` - Calculation helpers for volatility, ranking, percentile, and any new Value Tier support.
- `web/components/GoaliePage/goalieTypes.ts` - Shared goalie row and stat-column types that may need tightening for the new metrics and display modes.
- `web/components/GoaliePage/goalieFilters.ts` - Minimum GP parsing helper used by the goalie page text input.
- `web/components/GoaliePage/goalieMetrics.ts` - Shared helpers for advanced metric cards, leaderboard columns, and Value Tier scoring.
- `web/components/GoaliePage/goalieFilters.test.ts` - Coverage for Minimum GP parsing and invalid-input fallback behavior.
- `web/components/GoaliePage/goalieMetrics.test.ts` - Coverage for relative variance labels, Value Tier stability, and advanced metrics cards.
- `web/components/GoaliePage/goalieCalculations.test.ts` - Coverage for volatility math and weekly ranking behavior.
- `web/styles/Goalies.module.scss` - Active goalie styling surface that will need to support the Variance landing page, goalie page, and scaffold page.
- `web/pages/variance/index.tsx` - New Variance landing page that provides entry buttons to goalie and skater surfaces.
- `web/pages/variance/goalies.js` - Variance route wrapper that re-exports the active goalie page under `/variance/goalies`.
- `web/pages/variance/skaters.tsx` - Minimal skaters scaffold page for the new Variance route family.
- `web/pages/variance/variance.module.scss` - Shared styling for the Variance landing and scaffold pages.
- `web/pages/trueGoalieValue.tsx` - Legacy adjacent goalie surface that should be checked for reuse boundaries, stale assumptions, and cleanup risk.
- `web/components/Layout/NavbarItems/NavbarItemsData.ts` - Global nav inventory that must point users at the new Variance section.
- `web/lib/navigation/siteSurfaceLinks.ts` - Shared surface-link configuration that may be repurposed or cleaned up during the route migration.
- `web/components/SurfaceWorkflowLinks/SurfaceWorkflowLinks.tsx` - Reusable landing-page card/button pattern for the new `/variance` hub.
- `web/rules/context/goalie-page-relevant-tables.md` - Read-only glossary of available goalie data fields to drive the Metrics tab expansion and relativity/value planning.

### Notes

- Unit tests should typically live alongside the code files they test or in the repo’s existing `__tests__` layout where that pattern already exists.
- Keep the task set focused on implementation work that can be completed without changing the shared goalie schema or view contracts.
- Treat `/goalies` migration, `/variance` landing work, and goalie analytics expansion as one coordinated rollout so route and UI changes do not drift apart.

## Tasks

- [x] 1.0 Lock the Variance route family and update navigation
  - [x] 1.1 Create the `/variance` landing route and wire it to the site’s existing page-shell and link-card conventions.
  - [x] 1.2 Move the active goalie experience to `/variance/goalies` while preserving the current runtime behavior of the existing page.
  - [x] 1.3 Add a `/variance/skaters` scaffold page with minimal copy, a clear back-link to `/variance`, and no fake analytics surface.
  - [x] 1.4 Update global navigation and any in-app links so the Variance section is discoverable from the main site nav.
  - [x] 1.5 Decide whether `/goalies` should redirect to `/variance/goalies` during rollout and implement the chosen compatibility behavior.

- [x] 2.0 Re-home the goalie page into the new route and clean up route-tied assumptions
  - [x] 2.1 Update the goalie page entrypoint and any route metadata so the active page is clearly owned by the Variance section.
  - [x] 2.2 Remove or repair assumptions that still frame the page as a standalone `/goalies` destination.
  - [x] 2.3 Verify the current data-fetch chain still works after the route move and fix any path-dependent regressions.
  - [x] 2.4 Audit `GOALIE_SURFACE_LINKS` usage and either remove the dead import or repurpose it intentionally for the new Variance surface.
  - [x] 2.5 Add route-level tests or smoke checks for the new goalie path and the landing/scaffold pages.

- [x] 3.0 Expand the Metrics tab using existing goalie data only
  - [x] 3.1 Inventory the currently documented goalie fields and map the strongest advanced-stat candidates into display groups.
  - [x] 3.2 Add the high-priority metrics to the Metrics tab first, including workload, shot-quality, and start-confidence signals.
  - [x] 3.3 Add the medium-priority split and rest-context metrics only where the labels remain clear and scannable.
  - [x] 3.4 Decide which lower-priority context metrics should wait for a later pass to avoid cluttering the tab.
  - [x] 3.5 Add copy or tooltip support for directionally tricky metrics so the tab stays honest about what each stat means.
  - [x] 3.6 Add regression coverage for the Metrics tab to protect against missing columns, label drift, and empty-state regressions.

- [x] 4.0 Replace Minimum GP with a typed text input and harden the filter flow
  - [x] 4.1 Move Minimum GP state to raw string input handling at the page layer so validation happens before filtering.
  - [x] 4.2 Parse and validate integer input safely, including whitespace, empty values, and invalid pasted content.
  - [x] 4.3 Preserve the last valid threshold or a known default when the input is invalid so the table does not collapse into a broken state.
  - [x] 4.4 Update the UI copy and validation messaging so users know how the filter behaves.
  - [x] 4.5 Add tests for empty, invalid, and edge-case Minimum GP input behavior.

- [x] 5.0 Add Value Tier scoring and labeling for goalie fantasy value
  - [x] 5.1 Define the page-layer Value Tier composite using the agreed priority order: fantasy production, consistency, workload/start confidence, then recent form.
  - [x] 5.2 Choose the tiering model for the current population, including whether tiers are percentile bands or fixed score bands.
  - [x] 5.3 Implement the Value Tier calculation in shared page-layer transformation logic rather than in presentation-only table code.
  - [x] 5.4 Expose Tier labels in the goalie table and ensure the labels stay stable for the same filtered input.
  - [x] 5.5 Add tests or fixtures that prove the tier output changes when the filtered population changes and stays deterministic otherwise.

- [x] 6.0 Add a Relativity mode for variance/volatility columns
  - [x] 6.1 Identify which current variance-related columns should participate in relative mode and which should remain raw.
  - [x] 6.2 Compute league-average-relative deltas from the currently filtered page population so the mode matches the visible context.
  - [x] 6.3 Update the table layer to render plus/minus relative values without confusing lower-is-better and higher-is-better metrics.
  - [x] 6.4 Add labeling and formatting rules so the user can tell when they are looking at raw volatility versus relative variance.
  - [x] 6.5 Add tests for relative-mode math, display conventions, and fallback handling when league-average data is missing or unusable.

- [x] 7.0 Fix calculation and presentation integrity in the current goalie components
  - [x] 7.1 Audit the goalie volatility helpers and rename or relabel any output that is mathematically standard deviation rather than true variance.
  - [x] 7.2 Reconcile percentage-coloring thresholds and other duplicated display rules between the leaderboard and table components.
  - [x] 7.3 Remove stale or unused props, label keys, and cross-page type coupling that no longer matter to the active goalie workflow.
  - [x] 7.4 Tighten the shared goalie types so the runtime assumptions exposed by the page are represented more honestly.
  - [x] 7.5 Add focused tests around the ranking and display helpers that materially affect interpretation.

- [x] 8.0 Polish the Variance experience for usability and discoverability
  - [x] 8.1 Ensure the `/variance` landing page reads like an intentional hub, not a placeholder route list.
  - [x] 8.2 Keep the goalie page dense but readable as the Metrics tab grows.
  - [x] 8.3 Verify the new route family works on desktop and mobile without horizontal overflow or cramped control spacing.
  - [x] 8.4 Confirm the navbar, page labels, and internal link text all match the new Variance IA.

- [x] 9.0 Validate the rollout and capture remaining follow-up work
  - [x] 9.1 Run targeted checks for the active goalie route, the new Variance landing page, and the skaters scaffold.
  - [x] 9.2 Verify that no schema/view changes were introduced and that the feature still consumes the documented shared goalie data contracts.
  - [x] 9.3 Capture any residual follow-up items for cleanup, copy tightening, or later skater-surface work after the Variance rollout is stable.
