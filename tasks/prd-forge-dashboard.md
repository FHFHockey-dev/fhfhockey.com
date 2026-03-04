# PRD: Forge Dashboard

## 1. Introduction / Overview
The Forge Dashboard is a new one-page fantasy hockey command center at `pages/forge/dashboard.tsx` that combines the highest-value signals currently spread across Forge, Trends, Start Chart, and underlying stats pages.

This page is designed for a hybrid fantasy manager who needs both fast lineup decisions and confidence in sustainability/regression signals. On desktop (`1440x900` and larger), the dashboard must load with no page scroll. Mobile is a first-class target (`mobile-also`), but not mobile-first: content can stack and scroll on smaller screens while preserving usability and interaction quality.

This PRD does **not** introduce any "V2" naming. Existing `web/pages/FORGE.tsx` remains available while the new dashboard is built at `web/pages/forge/dashboard.tsx`.

## 2. Goals
1. Deliver a single-screen desktop dashboard with actionable fantasy insights in under 60 seconds.
2. Provide six MVP modules at launch:
   1. Team Power Rankings
   2. Sustainable vs Unsustainable Players
   3. Hot / Cold Streaks
   4. Goalie Start Probabilities + Risk
   5. Start-Chart Slate Strip
   6. Top Movers
3. Ensure every module is backed by verified, reliable data sources (endpoint and table audits).
4. Implement automated endpoint validation tests plus manual QA checklist prior to launch.
5. Preserve strong mobile usability with responsive layouts and touch-safe interactions.

## 3. User Stories
1. As a fantasy manager, I want to see team power and momentum immediately so I can prioritize streamers and matchups.
2. As a fantasy manager, I want to identify sustainable breakouts vs likely regressions so I can make add/drop/trade decisions confidently.
3. As a fantasy manager, I want hot/cold streak context with concise reasons so I can avoid overreacting to noisy short-term results.
4. As a fantasy manager, I want goalie start and risk probabilities in one place so I can set starts quickly.
5. As a fantasy manager on mobile, I want the same data clarity and interactive controls without broken layouts.

## 4. Functional Requirements
1. The system must create a new page at `web/pages/forge/dashboard.tsx`.
2. The system must keep `web/pages/FORGE.tsx` accessible during rollout.
3. The dashboard must render without vertical page scroll on desktop at `1440x900` and larger.
4. The dashboard must include date controls and shared filters that update all active modules consistently.
5. The dashboard must display Team Power Rankings with trend/momentum indicators.
6. The dashboard must display Sustainable vs Unsustainable player sections using trend-band/sustainability logic.
7. The dashboard must display Hot and Cold streak modules with compact reason text.
8. The dashboard must display goalie start probability, win probability, shutout probability, and risk/volatility indicators.
9. The dashboard must display a Start-Chart game slate strip with matchup context.
10. The dashboard must display Top Movers for at least one team trend lens and one skater trend lens.
11. Each module must have loading, empty, stale-data, and error states.
12. The page must support responsive mobile behavior (stacked cards, preserved tap targets, readable tables/charts).
13. The system must expose a dependency inventory for each dashboard module including:
    1. UI component(s)
    2. API endpoint(s)
    3. Supabase table(s)
14. The system must execute a full data audit for each module that verifies:
    1. Accuracy (values/ranges/joins/time alignment)
    2. Automation (scheduled freshness and repeatable generation)
    3. Optimization (query and payload efficiency)
    4. Reliability (error handling, fallback behavior, stale-data strategy)
15. The system must include an automated endpoint test suite covering contract shape, status codes, null safety, and key invariants for all required endpoints.
16. The system must include manual QA scripts for visual and interaction checks across desktop and mobile breakpoints.
17. The dashboard must document and surface data timestamps (`asOfDate`/`generatedAt`) per module where available.
18. The system must detect and log endpoint inconsistencies that could cause data mismatch (e.g., route duplication for goalie projections).
19. The system must define performance budgets for initial dashboard load and per-module refresh.
20. The system must gate launch on manual QA + automated endpoint suite pass.

## 5. Non-Goals (Out of Scope)
1. Authentication and per-user personalization.
2. Betting-focused features.
3. Full historical backtesting UI in this phase.
4. Replacing all existing legacy pages immediately.

## 6. Design Considerations
1. Information density should feel powerful but not overstimulating.
2. Desktop should use fixed-height card regions with internal scroll only where unavoidable.
3. Visual hierarchy should prioritize decision-critical panels first (goalie starts, sustainability, team power).
4. Mobile should preserve core module order and interaction parity with simplified layout stacking.
5. Avoid introducing new naming that implies a temporary version (no "V2", "2.0", or equivalent).
6. All dashboard UI must follow `fhfh-styles.md` (Neon Noir Analytics) for typography, hierarchy, and interaction behavior.
7. New SCSS must use shared tokens from `web/styles/vars.scss` and avoid hard-coded colors/sizing unless explicitly justified.
8. Panel-like containers should use shared panel patterns/mixins from `web/styles/_panel.scss` for consistency.

## 7. Technical Considerations
### 7.1 Routing and Structure
1. New route: `web/pages/forge/dashboard.tsx`.
2. Keep current page: `web/pages/FORGE.tsx`.
3. Prefer shared data-fetch utility patterns where possible (cache + in-flight dedupe patterns already used in dashboard fetchers).
4. Styling implementation must import `@use "styles/vars" as v;` in new modules and use tokenized spacing/colors.
5. Dashboard panel surfaces should use shared panel mixins from `styles/panel` where feasible.

### 7.2 Module Dependency Inventory (MVP)

#### A. Team Power Rankings
- Candidate source components/pages:
  - `web/pages/underlying-stats/index.tsx`
  - `web/pages/trends/index.tsx`
- API endpoints:
  - `GET /api/team-ratings?date=YYYY-MM-DD`
  - (optional context) `GET /api/v1/trends/team-ctpi`
  - (optional context) `GET /api/v1/trends/team-sos`
- Supabase tables:
  - `team_power_ratings_daily`
  - `team_power_ratings_daily__new` (fallback source)
  - `team_ctpi_daily` (if CTPI context shown)
  - `sos_standings` (if SOS context shown)

#### B. Sustainable vs Unsustainable Players
- Candidate source components/pages:
  - `web/pages/trendsSandbox.tsx`
  - `web/pages/trends/placeholder.tsx`
- API endpoints:
  - `GET /api/v1/sustainability/trend-bands`
  - `POST /api/v1/sustainability/trend-bands` (recompute path)
- Supabase tables:
  - `sustainability_trend_bands`
  - `player_trend_metrics` (upstream for computed signals)
  - `players`

#### C. Hot / Cold Streaks
- Candidate source components/pages:
  - `web/pages/trends/placeholder.tsx` (SparkMini + reasoning patterns)
  - `web/pages/trends/index.tsx`
- API endpoints:
  - `GET /api/v1/trends/team-power`
  - `GET /api/v1/trends/skater-power`
  - `GET /api/v1/trends/team-ctpi` (optional for spark context)
- Supabase tables:
  - `nst_team_gamelogs_as_counts`
  - `nst_team_gamelogs_pp_counts`
  - `nst_team_gamelogs_pk_counts`
  - `wgo_team_stats`
  - `player_trend_metrics`
  - `players`
  - `nst_gamelog_as_counts` (for trend spark lookups where used)

#### D. Goalie Start Probabilities + Risk
- Candidate source components/pages:
  - `web/pages/FORGE.tsx`
  - `web/pages/start-chart.tsx`
- API endpoints:
  - `GET /api/v1/forge/goalies`
  - `GET /api/v1/projections/goalies` (used by dashboard fetch utility; audit for consistency)
  - `GET /api/v1/forge/accuracy?scope=goalie`
- Supabase tables:
  - `forge_goalie_projections`
  - `forge_runs`
  - `forge_projection_calibration_daily`
  - `forge_projection_accuracy_daily`
  - `games`
  - `players`
  - `teams`

#### E. Start-Chart Slate Strip
- Candidate source components/pages:
  - `web/pages/start-chart.tsx`
  - `web/pages/FORGE.tsx` goalie game strip
- API endpoints:
  - `GET /api/v1/start-chart?date=YYYY-MM-DD`
- Supabase tables:
  - `games`
  - `player_projections`
  - `goalie_start_projections`
  - `yahoo_nhl_player_map_mat`
  - `yahoo_players`
  - `team_ctpi_daily`

#### F. Top Movers
- Candidate source components/pages:
  - `web/components/TopMovers/TopMovers.tsx`
  - `web/pages/trends/index.tsx`
- API endpoints:
  - `GET /api/v1/trends/team-power`
  - `GET /api/v1/trends/skater-power`
- Supabase tables:
  - `nst_team_gamelogs_as_counts`
  - `nst_team_gamelogs_pp_counts`
  - `nst_team_gamelogs_pk_counts`
  - `wgo_team_stats`
  - `player_trend_metrics`
  - `players`

### 7.3 Required Audit Workstream (Full Validation)
1. Build a per-module audit checklist with pass/fail criteria for:
   1. Data contract correctness (required fields and types)
   2. Freshness windows (`asOfDate`, `generatedAt`, update cadence)
   3. Numerical bounds and invariant checks
   4. Cross-source consistency checks (same player/team/date across modules)
   5. Fallback correctness when no same-day data exists
2. Add endpoint test coverage for all MVP endpoints:
   1. `200/4xx/5xx` behavior
   2. Query parameter validation
   3. Empty-state behavior
   4. Deterministic shape assertions
3. Validate Supabase query efficiency:
   1. Avoid unbounded scans where possible
   2. Confirm indexes support date/team/player filters in frequent paths
   3. Monitor payload size and response time at p50/p95
4. Define reliability controls:
   1. Timeouts and retry strategy
   2. Error logging with endpoint + query context
   3. Degraded-mode UI when partial data fails

### 7.4 Performance and Efficiency Targets
1. Desktop initial render target: interactive dashboard in <= 2.5s on warm cache.
2. Endpoint p95 target for key dashboard calls: <= 800ms in normal operation.
3. Avoid duplicate calls for same params via memoization/cache dedupe patterns.

## 8. Success Metrics
1. 100% of MVP modules visible and interactive on first dashboard load.
2. 0 critical data integrity issues in pre-launch audit.
3. Automated endpoint suite pass rate: 100% on required endpoints.
4. Manual QA checklist pass on desktop and mobile breakpoints.
5. Desktop no-scroll requirement met at `1440x900+`.
6. Reduced user navigation hops versus legacy Forge/Trends flow.

## 9. Open Questions
1. Should CTPI Pulse chart be included in MVP launch or phase 2 after core six modules stabilize?
2. What is the required fallback behavior if one module fails: hide module, show stale cache, or show explicit blocked-state card?
3. Which exact mobile breakpoints are release blockers (e.g., `390x844`, `430x932`, tablet portrait)?
4. Should goalie data be standardized to one endpoint (`/api/v1/forge/goalies` vs `/api/v1/projections/goalies`) before dashboard launch?
5. Do we want module-level "last updated" labels always visible, or only in expanded info tooltips?

## 10. Build Gameplan (Execution Order)
1. Create `pages/forge/dashboard.tsx` shell with responsive card layout and shared global filters.
2. Integrate Team Power, Top Movers, and Start-Chart Slate modules first (highest immediate utility).
3. Integrate Goalie Start + Risk module and align endpoint contract choice.
4. Integrate Sustainable/Unsustainable and Hot/Cold modules from trend-band/trend power sources.
5. Implement unified loading/error/empty/fallback UI states.
6. Build and run endpoint audit suite and Supabase dependency verification.
7. Run manual QA checklist for desktop no-scroll and mobile usability.
8. Final data quality sign-off and release.
