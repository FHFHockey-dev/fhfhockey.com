# PRD: Variance Section, Goalie Route Migration, and Goalie Analytics Expansion

## Document Status

- Status: Draft, curated for task-list generation
- Owner: TBD
- Primary audience: junior developer implementing the feature and AI assistant generating the task list
- Intended follow-up artifact: `tasks/tasks-prd-variance-section.md`

## Relevant Files

- `web/pages/goalies.js` - current active goalie entrypoint and runtime orchestration surface.
- `web/components/GoaliePage/GoalieLeaderboard.tsx` - active leaderboard/table header surface.
- `web/components/GoaliePage/GoalieList.tsx` - page-layer ranking and row-shaping adapter.
- `web/components/GoaliePage/GoalieTable.tsx` - weekly table renderer and sort/display layer.
- `web/components/GoaliePage/goalieCalculations.ts` - ranking, percentile, and goalie scoring helpers.
- `web/components/GoaliePage/goalieTypes.ts` - shared goalie row and stat-column types.
- `web/styles/Goalies.module.scss` - active goalie styling plus legacy-adjacent shared styles.
- `web/rules/context/goalie-page-relevant-tables.md` - glossary for the shared goalie data contracts.
- `web/pages/trueGoalieValue.tsx` - adjacent legacy goalie surface with overlapping concepts.
- `web/components/Layout/NavbarItems/NavbarItemsData.ts` - current navigation surface that still points to `/goalies`.
- `web/components/SurfaceWorkflowLinks/SurfaceWorkflowLinks.tsx` - existing landing-page card/button pattern that can be reused for `/variance`.

## Current-State Audit

This is not a greenfield page.

The live goalie experience currently runs from `web/pages/goalies.js`, which:

- fetches season timing from the NHL API through the existing CORS proxy
- builds its own week windows from season dates
- reads `goalie_weekly_aggregates`, `league_weekly_goalie_averages`, and `wgo_goalie_stats`
- renders the current value/metrics tabbed surface through the goalie components

Important current-state facts:

- the current page already has a `Metrics` tab scaffold, but it is not yet a real advanced-analytics surface
- the current Minimum GP control is a select-style control, not a text input
- the current page still uses `/goalies` as the primary route and the navbar still advertises that path
- `GOALIE_SURFACE_LINKS` is imported in `goalies.js` but is not used by the active runtime
- `trueGoalieValue.tsx` is adjacent/legacy, not the active entrypoint, but it still carries overlapping goalie ideas and styling
- the current calculations include standard deviation-style volatility math, but the current naming and labels treat it as variance language
- the current table and leaderboard layers duplicate some formatting and percentage-coloring behavior

Schema and data-context facts:

- the goalie glossary already exposes richer advanced fields than the active page currently shows
- no schema/view changes are required for this scope
- the new work must stay page-layer safe and reuse existing shared data contracts

## Introduction and Overview

Build a new Variance information architecture with:

- a landing page at `/variance`
- a goalie surface at `/variance/goalies`
- a skaters scaffold at `/variance/skaters`

The active goalie page must move into the Variance section and become the canonical goalie surface for that product family. The goal is not just a route move; it is a product framing change that makes the page feel like part of a dedicated analysis hub instead of a standalone `/goalies` page.

At the same time, expand the goalie table into a more useful fantasy-analysis surface by:

- widening the Metrics tab using existing advanced goalie data
- replacing Minimum GP with a text input
- adding deterministic Value Tier output
- adding a Relativity mode for variance/volatility columns

This PRD is intentionally scoped to existing runtime code and existing documented goalie data only.

## Goals

1. Move the active goalie experience from `/goalies` to `/variance/goalies`.
2. Stand up a minimal `/variance` landing page with one button to goalies and one button to skaters.
3. Provide a `/variance/skaters` scaffold page that is intentionally minimal and clearly incomplete.
4. Expand the Metrics tab using advanced goalie fields already available in the documented data glossary.
5. Replace the current Minimum GP control with a text input that accepts typed numeric values.
6. Add Value Tier output for goalies using a fixed, explainable composite score.
7. Add a Relativity toggle that shows variance/volatility columns as plus/minus versus league average.
8. Keep the page stable, readable, and honest about what is calculated versus what is only displayed.
9. Avoid schema/view refactors and avoid changing the shared goalie data contracts.

## Metrics Tab Candidate Stats

The Metrics tab should expand using existing data already documented in the goalie glossary. The goal is to surface meaningful advanced goalie context without inventing new schema or backend contracts.

### High-Priority Candidates

- `SV%` and `GAA`
  - Core skill/efficiency signals that most fantasy users already understand.
  - These should remain visible because they anchor the advanced section with familiar outcome metrics.

- `GSAA` and `GSAA/60`
  - Strong shot-stopping quality signals.
  - Useful for distinguishing good results from merely favorable volume or team context.

- `xG Against` and `xG Against/60`
  - Helps explain shot-quality environment.
  - Important for users who want context beyond raw saves and goals against.

- `Quality Starts %`
  - Directly supports start-confidence evaluation.
  - One of the best available proxies for a goalie who is likely to deliver a reliable start.

- `Complete Game %`
  - Helpful workload/reliability context.
  - Useful for identifying goalies who tend to finish games and absorb full starts.

- `Shots Against/60` and `Saves/60`
  - Helpful for workload and production context.
  - These are especially valuable when users want to compare goalies under normalized load.

### Medium-Priority Candidates

- High-danger, medium-danger, and low-danger split stats
  - Include counts, save percentages, goals against, GAA, and GSAA where available.
  - Valuable for explaining why a goalie looks strong or weak in different shot-quality buckets.
  - Labeling must be explicit because abbreviated split names are easy to misread.

- Rest-split stats
  - `save_pct_days_rest_0..4_plus`
  - `games_played_days_rest_0..4_plus`
  - These are useful for workload and start-confidence context.
  - They should be displayed only if the labels make the rest bucket obvious.

- `Regulation Wins`, `Regulation Losses`, and `Shutouts`
  - Useful contextual production and ceiling indicators.
  - These are not pure skill metrics, so they should be labeled honestly.

- `percent_games`
  - Helpful as a workload-share context metric.
  - Better as supporting context than as a primary headline stat.

### Lower-Priority / Optional Candidates

- `rush_attempts_against/60`
- `rebound_attempts_against/60`
- `Avg. Shot Distance`
- `Avg. Goal Distance`

These are analytically useful, but they are easier to over-interpret and should be added only if the UI can label them clearly and keep the section scannable.

Notes:

- The Metrics tab should stay within currently available shared data.
- Metrics should be grouped and labeled in a way that makes fantasy meaning obvious.
- If a metric is directionally tricky, the copy must say so explicitly.
- `has_nst_*` fields are not user-facing metrics; they are only useful as internal gates for whether an advanced section should render at all.

## User Stories

- As a fantasy user, I want a dedicated Variance hub so I can find goalie and skater analysis from one obvious place.
- As a fantasy user, I want the goalie page under `/variance/goalies` so the product matches the analysis framing instead of feeling like a legacy one-off.
- As a user, I want a richer Metrics tab so I can compare goalies on shot quality, workload, and start confidence without leaving the page.
- As a user, I want to type a minimum games-played value so I can quickly tighten the table to the sample size I care about.
- As a user, I want Value Tier labels so I can scan for the most reliable fantasy goalie options without manually reading every column.
- As a user, I want a Relativity view so I can understand which goalies are above or below league average in the current filtered context.
- As a user, I want `/variance/skaters` to exist even if it is just scaffolding so the new section feels intentional and navigable.

## Functional Requirements

### 1. Variance Routes and Landing Page

1. The system must provide a `/variance` landing page.
2. The `/variance` landing page must contain one button or card linking to `/variance/goalies`.
3. The `/variance` landing page must contain one button or card linking to `/variance/skaters`.
4. The landing page copy must clearly explain that Variance is the section for goalie and skater variance-related analysis.
5. The landing page must use the existing site’s current layout and navigation conventions rather than introducing a one-off shell.

### 2. Goalie Route Migration

6. The canonical goalie route must move to `/variance/goalies`.
7. Primary navigation and internal links must point to `/variance/goalies`, not `/goalies`.
8. The goalie surface must preserve the current runtime behavior as much as possible during the move, including the current data fetch path, ranking surface, and tabbed layout.
9. If any legacy `/goalies` access path remains temporarily for safety, it must not be the primary user-facing route and must not become the new canonical surface.
10. Any breakage introduced by the route move must be fixed in the page, nav, or internal linking layer rather than by leaving the old route as the long-term answer.

### 3. Skaters Scaffold

11. The system must provide a `/variance/skaters` scaffold page.
12. The skaters scaffold must be intentionally minimal at launch.
13. The skaters scaffold must contain a clear heading, short explanatory copy, and a path back to `/variance`.
14. The skaters scaffold must not pretend to be a finished analytics product.

### 4. Goalie Page Composition

15. The goalie page must continue to assemble through the existing leaderboard/list/table/calculation layers unless a narrow refactor is needed to support the new route family.
16. The page must keep the current tab structure, including the existing Value Overview and Metrics areas.
17. The page must keep the current sort/filter interaction model unless a specific issue is being corrected.
18. The page must not silently change its underlying data source or schema contract during the route migration.

### 5. Metrics Tab Expansion

19. The Metrics tab must be populated with advanced goalie analytics from the already-documented data glossary.
20. The Metrics tab must include at least the high-priority metrics identified in this PRD.
21. The Metrics tab should include the medium-priority metrics where the data and labeling remain understandable.
22. The Metrics tab may include the lower-priority metrics only if they can be labeled without confusing users.
23. The Metrics tab must not require schema changes to ship v1.
24. The Metrics tab must not degrade the page into an unreadable wall of numbers; grouping and labels matter.

### 6. Minimum GP Control

25. The current Minimum GP control must be replaced with a text input.
26. The input must accept integer values only.
27. The input must trim whitespace and ignore non-numeric characters that are not part of a valid integer.
28. Empty input must not crash the page.
29. Invalid input must show inline validation and must not silently apply a broken filter.
30. The current page must preserve the last valid threshold or default threshold when the user enters an invalid value.
31. The text input behavior must be safe for both keyboard entry and paste input.

### 7. Value Tier Framework

32. The goalie page must expose deterministic Value Tier labels such as Tier 1, Tier 2, Tier 3, and so on.
33. Value Tiering must be derived from a fixed composite rather than from ad hoc per-session judgment.
34. The composite must prioritize factors in this order:
    1. fantasy production
    2. consistency
    3. workload and start confidence
    4. recent form
35. The tiering logic must be explainable to users and maintainable for future page updates.
36. The tiering logic must be built at the page/data-shaping layer, not buried in table presentation code.
37. The tier output must be stable for the same filtered population.
38. The tier labels must be honest about what they represent: fantasy value, not a claim that every goalie in a tier is interchangeable.

### 8. Relativity Toggle

39. The goalie table must provide a Relativity toggle.
40. The toggle must transform variance/volatility columns into plus/minus values relative to league average for the same filtered scope.
41. The relative calculation must use the current page result set as the comparison baseline, not a separate hidden global source.
42. The toggle must be a display-mode transformation, not a schema change.
43. The toggle must preserve directional honesty for lower-is-better metrics such as GAA and shot prevention indicators.
44. The UI must label the relative mode clearly enough that users understand it is league-average-relative.
45. If a relative value cannot be calculated cleanly, the page must fall back to a safe blank or placeholder state rather than a misleading number.

### 9. Calculation and Ranking Integrity

46. The page must keep derived calculations isolated enough that labels and math can be audited later without rewriting the whole page.
47. Any metric currently described as variance but actually calculated as standard deviation must be labeled honestly in the UI or renamed in the page-layer output.
48. Ranking and display logic must not rely on hidden assumptions about empty stat selections or empty data sets.
49. Sorting must continue to behave sensibly when the page is in relative mode or when Value Tiers are shown.

### 10. Navigation and Discoverability

50. The navbar must reflect the Variance section and point users to the new route family.
51. The active goalie surface must be discoverable from the Variance landing page.
52. The skaters scaffold must be discoverable from the Variance landing page even before the skaters product is built.

## Non-Goals

1. Do not change the shared goalie schema or view definitions.
2. Do not introduce upstream table/view/column renames or removals.
3. Do not design a new ingest pipeline for this work.
4. Do not replace the active goalie data contract with a new contract.
5. Do not build the full skaters product yet; only scaffold the route and landing entry.
6. Do not redesign the entire site navigation.
7. Do not treat `/goalies` as the long-term primary route once the Variance move is complete.
8. Do not spend this pass reworking every goalie formula; only the product-visible calculations in scope for Metrics, Value Tier, and Relativity are part of this PRD.

## Design Considerations

- Reuse the site’s existing surface-card or button patterns for the `/variance` landing page.
- Keep the landing page minimal and intentional; it only needs to route users to the next surface.
- Preserve the current dense-table style for the goalie page, but plan for the Metrics tab to get wider and more information-rich.
- Use clear section headers and honest labels so the page stays readable as more advanced metrics appear.
- The current goalie page styling can be reused as a base, but legacy styles should be separated from the new Variance experience as part of the migration.
- The `/variance/skaters` scaffold should feel like a deliberate placeholder, not a broken page.
- The Value Tier display should look like a summary signal, not a second competing leaderboard.

## Technical Considerations

- The active runtime chain currently flows through `goalies.js`, `GoalieLeaderboard`, `GoalieList`, `GoalieTable`, `goalieCalculations`, and `goalieTypes`. The route move should preserve that chain unless a narrow refactor is needed.
- The Minimum GP input should keep raw string state at the page layer so the UI can validate before parsing.
- Value Tier scoring should live in page-layer transformation logic or a dedicated helper, not in presentation-only table code.
- Relativity should be computed from the already-filtered table population so the displayed deltas match the current scope.
- The current page uses standard deviation-style math in its volatility helpers. The PRD does not require changing the math, but it does require honest labels and a clear relative-display mode.
- `GoalieLeaderboard` and `GoalieTable` should not keep diverging formatting rules if a shared formatting helper can prevent it.
- `GoalieTable` should stop depending on the legacy `trueGoalieValue` type surface if a local or shared type is cleaner.
- `GOALIE_SURFACE_LINKS` is currently dead runtime surface area and should be treated as cleanup, not as a required dependency for this feature.
- The route migration should not require any schema migration, but it may require a compatibility redirect or link repair if the old route is still bookmarked in the wild.

## Success Metrics

1. `/variance` loads and clearly routes users to goalie and skater entry points.
2. `/variance/goalies` becomes the canonical active goalie experience.
3. The Metrics tab shows real advanced goalie analytics instead of placeholder content.
4. The Minimum GP control accepts typed numeric input and handles invalid input safely.
5. Value Tier labels appear and are stable for the same filtered data set.
6. The Relativity toggle changes variance/volatility columns to league-average-relative display values.
7. Navigation and internal links stop advertising `/goalies` as the primary route.
8. No schema/view changes are required to ship the feature.
9. The goalie page remains understandable and performant even as the Metrics tab gets richer.

## Open Questions

1. Should the weekly grouping for the new Variance goalie surface continue to use the current calendar-week model, or should it be re-aligned to the fantasy matchup-week model documented in the goalie glossary?
2. Should the Value Tier composite be expressed as percentile bands over the active filtered population, or as fixed score bands derived from a normalized composite?
3. Should the old `/goalies` path receive a temporary compatibility redirect during rollout, or should the migration rely only on updated navigation and internal links?
