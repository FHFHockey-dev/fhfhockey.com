# PRD: Variance Goalies Second Pass and Skaters MVP

## Introduction/Overview

This pass tightens the Variance route family after the first goalie migration. The current `/variance/goalies` route reuses the legacy goalie runtime, but the product now needs a cleaner Variance information architecture, a real advanced goalie Metrics table, stronger metric labeling, a revised Value Tier framework, relative variance display, and the first live `/variance/skaters` MVP table.

The implementation must use existing data only. For goalies, keep the current leaderboard runtime in place while adding a Supabase-backed advanced Metrics table. For skaters, build a minimal live MVP table from existing skater schema sources documented in `web/rules/context/player-table-schemas.md` and `web/rules/context/supabase-table-structure.md`.

## Goals

1. Keep `/variance/goalies` as the canonical goalie variance route.
2. Keep `/variance` as a minimal hub with links to goalies and skaters.
3. Convert the goalie Advanced Analytics surface from cards into a sortable table.
4. Add goalie advanced metrics from existing Supabase data using an all-situations default and a strength selector.
5. Keep Minimum GP as a text input with safe validation and last-valid fallback behavior.
6. Revise Value Tier into an explainable formula using current data only.
7. Keep Relativity mode for variance columns and make labels, sorting, and fallback rules honest.
8. Build the first live `/variance/skaters` MVP table from existing skater data.
9. Reduce blurred responsibility between page, calculation, table, and presentation layers.
10. Keep the Variance runbook current as part of the implementation.

## User Stories

- As a fantasy user, I want the goalie variance page to show advanced metrics in a table so I can sort and compare goalies quickly.
- As a fantasy user, I want all-situations goalie metrics by default, with strength-specific views available when I need context.
- As a fantasy user, I want typed Minimum GP filtering so I can set the exact sample size I care about.
- As a fantasy user, I want Value Tiers that reflect production, consistency, workload, and start confidence using transparent math.
- As a fantasy user, I want relative variance values so I can tell which goalies are more or less volatile than the filtered average.
- As a fantasy user, I want `/variance/skaters` to show a real first table, even if it is intentionally narrow.
- As a maintainer, I want data source and calculation rules documented so future changes do not drift from the schema or labels.

## Functional Requirements

### Route Family And IA

1. `/variance` must remain a minimal hub with one link/button to `/variance/goalies` and one link/button to `/variance/skaters`.
2. `/variance/goalies` must remain the canonical goalie route.
3. `/goalies` may continue redirecting to `/variance/goalies` for compatibility.
4. Global nav must continue exposing `TOOLS > VARIANCE > GOALIES` and `TOOLS > VARIANCE > SKATERS`.
5. Internal links must not point users to `/goalies` as the primary destination.

### Goalie Runtime Simplification

6. Keep the current NHL API-backed goalie leaderboard runtime for this PRD.
7. Do not migrate the full goalie leaderboard to Supabase in this PRD.
8. Add Supabase data fetching only where needed for the advanced Metrics table.
9. Move reusable row/format/sort helpers out of presentation-only components when they are needed by multiple table surfaces.
10. Remove or intentionally repurpose dead route/link artifacts such as unused `GOALIE_SURFACE_LINKS`.

### Goalie Advanced Metrics Table

11. Replace the current Advanced Analytics cards with a real table.
12. The table must follow the broad conventions of `GoalieTable`: sortable headers, stable rows, safe formatting, missing-value fallback, and readable dense layout.
13. Default strength view must be all situations.
14. The table must provide a strength selector for all situations, 5v5, EV/AS, PK, and PP.
15. Strength labels must map honestly to documented source prefixes:
    - all situations -> `nst_all_*`
    - 5v5 -> `nst_5v5_*`
    - EV/AS -> `nst_ev_*` unless product copy standardizes the visible label as AS
    - PK -> `nst_pk_*`
    - PP -> `nst_pp_*`
16. The first table version must include high-priority metrics where present:
    - `quality_starts_pct` as `QS%`
    - `nst_*_counts_gsaa` as `GSAA`
    - `nst_*_counts_xg_against` as `xGA`
    - `nst_*_rates_xg_against_per_60` as `xGA/60`
    - `nst_*_rates_hd_shots_against_per_60` as `HDSA/60`
    - `nst_*_rates_shots_against_per_60` as `SA/60`
17. The table should include medium-priority metrics where layout remains readable:
    - `nst_*_rates_rebound_attempts_against_per_60` as `RA/60`
    - `nst_*_rates_rush_attempts_against_per_60` as `RushA/60`
18. The table may include lower-priority metrics behind the same column system:
    - `nst_*_avg_shot_distance`
    - `nst_*_avg_goal_distance`
19. Counts and rates must not share one ambiguous label.
20. xGA, HDSA/60, SA/60, RA/60, RushA/60, and distance metrics must be labeled as context/exposure metrics, not goalie quality grades.
21. Missing metric values must render as `N/A`.
22. Missing metric values must sort consistently after real values when sorting descending by performance-style columns.

### Goalie Minimum GP

23. Minimum GP must remain a text input.
24. Valid input is a non-negative whole number.
25. Whitespace must be trimmed.
26. Empty input must be accepted and must use the documented default threshold.
27. Invalid input must preserve the last valid threshold.
28. Invalid input must show an inline validation message.
29. The filter must apply consistently to leaderboard, standard Metrics, and advanced Metrics table rows.

### Goalie Value Tier

30. Revise Value Tier using current data only.
31. The formula must remain deterministic for the same filtered population.
32. The formula must include:
    - fantasy-point production
    - consistency / low volatility
    - workload
    - start confidence
33. Start confidence should use `totalGamesStarted` and `percentAcceptableWeeks` where available.
34. If advanced Supabase metrics are available for the row, `QS%` may support start confidence.
35. The formula must live in shared calculation/data-shaping code, not inside `GoalieLeaderboard` rendering.
36. The UI must explain that tiers are relative to the current filtered population unless a fixed global baseline is later added.
37. Tier labels must be concise, for example `Tier 1` through `Tier 5`.
38. Tier sorting must use the underlying numeric tier score, not the display label.

### Goalie Relativity Toggle

39. Relativity mode must apply to WoW standard deviation and game standard deviation columns.
40. Relative values must be calculated as row value minus the filtered population average.
41. Relative variance columns must remain sortable.
42. Sorting in relative mode may use raw variance values because subtracting a constant preserves order.
43. Labels must say filtered average, not full NHL league average, unless the data source changes.
44. Positive deltas must show a plus sign.
45. Lower relative deltas must be visually or textually identifiable as more consistent.
46. Missing or non-finite values must render as `N/A`.

### Skaters MVP Table

47. `/variance/skaters` must become a live MVP table, not a copy-only scaffold.
48. The MVP must use existing skater data from documented schema sources.
49. The primary data source should be `wgo_skater_stats` for game-level rows because it supports game-to-game variance.
50. `wgo_skater_stats_totals` may be used for season/team/player context where useful.
51. NST skater tables documented in `player-table-schemas.md` and `supabase-table-structure.md` may be used for context, but the MVP must not depend on broad advanced-stat wiring.
52. The first table must include:
    - player name
    - team if available from source/context
    - position
    - GP
    - points or fantasy proxy
    - goals
    - assists
    - shots
    - TOI/GP
    - one game-to-game volatility measure
53. The table must support sorting.
54. The table must support a text-input Minimum GP filter using the same parsing rules as goalies.
55. The table must clearly state that it is the first skaters variance MVP and does not yet include all future advanced skater metrics.
56. The MVP must not claim Value Tier parity with goalies unless a skater-specific formula is defined.

### Documentation And Runbook

57. Update `web/rules/context/variance-runbook.md` with any implemented source, calculation, and fallback changes.
58. The runbook must list all Supabase tables/views used by the goalie Metrics table and skaters MVP table.
59. The runbook must document which calculations are page-layer derived and which come from views/tables.
60. The runbook must document metric directionality and missing-data rules.
61. The runbook must document known gaps and next follow-ups after the MVP.

## Non-Goals

- Do not redesign the whole goalie page.
- Do not migrate the full goalie leaderboard runtime to Supabase.
- Do not change Supabase schema, views, or materialized views.
- Do not add new cron jobs.
- Do not implement a full skater Value Tier framework in this PRD.
- Do not add draft-dashboard-specific logic to the Variance pages.
- Do not remove `/goalies` compatibility unless explicitly approved.

## Design Considerations

- Use the existing dark table style and table density conventions from `GoalieTable`.
- Avoid returning to card-based advanced metric summaries for the main advanced surface.
- Keep tables horizontally manageable; prefer fewer high-signal columns over every available field.
- Use short labels in headers and longer explanations in tooltips/help text.
- Keep `/variance` minimal and direct.
- The skaters page should feel live but intentionally early, not like a full finished product.

## Technical Considerations

- Current goalie leaderboard data flow remains NHL API -> page-layer mapping -> `calculateGoalieRankings` -> `GoalieLeaderboard`.
- New goalie advanced table should add a Supabase-backed fetch path for fields documented in `goalie_stats_unified` / `goalie_totals_unified` and NST goalie surfaces.
- Keep strength field mapping centralized so labels and source prefixes cannot drift.
- Skaters MVP should begin from `wgo_skater_stats` because game rows allow volatility calculations without new backend work.
- Use documented skater schema fields from `web/rules/context/player-table-schemas.md` and `web/rules/context/supabase-table-structure.md`.
- Shared Minimum GP parser can be reused or generalized if skaters need the same behavior.
- Add focused tests for parsing, Value Tier scoring, relative variance formatting, strength-field mapping, and skater volatility calculation.

## Success Metrics

- `/variance`, `/variance/goalies`, and `/variance/skaters` all load without route errors.
- The goalie Advanced Analytics surface renders as a table, not cards.
- All-situations goalie advanced metrics appear by default.
- Strength selector changes goalie advanced metric columns/values without changing route.
- Minimum GP invalid input preserves the last valid filter and shows validation.
- Value Tier score is deterministic for identical filtered input.
- Relative variance labels and values match the filtered population baseline.
- `/variance/skaters` shows live skater rows from existing data and supports sorting plus Minimum GP.
- Runbook reflects the implemented data flow and known gaps.

## Open Questions

1. Should the visible EV/AS label be `EV`, `AS`, or `Even Strength`?
2. Should skaters MVP use a site-wide fantasy scoring formula if one already exists elsewhere, or a neutral points/shots production proxy for v1?
3. Should goalie advanced metrics fetch season totals only, or respect the same selected date range as the current leaderboard when feasible?
