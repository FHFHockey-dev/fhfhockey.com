## Relevant Files

- `web/pages/goalies.js` - Active goalie page runtime used by `/variance/goalies`; owns tabs, filters, leaderboard fetches, and advanced metrics rendering.
- `web/pages/variance/skaters.tsx` - Current skaters scaffold that must become a live MVP table.
- `web/components/Variance/skaterVariance.ts` - Shared skater variance aggregation, production proxy, and volatility helpers.
- `web/components/Variance/skaterVariance.test.ts` - Focused skater aggregation and game-volatility tests.
- `web/components/GoaliePage/GoalieLeaderboard.tsx` - Goalie leaderboard table surface for Value Tier and relative variance display.
- `web/components/GoaliePage/GoalieAdvancedMetricsTable.tsx` - Advanced goalie Metrics table with sortable season-level Supabase metrics.
- `web/components/GoaliePage/GoalieTable.tsx` - Existing standard table convention to reuse for advanced goalie and skater table patterns.
- `web/components/GoaliePage/goalieCalculations.ts` - Shared goalie ranking, volatility, fantasy points, and Value Tier calculation logic.
- `web/components/GoaliePage/goalieMetrics.ts` - Current advanced metrics/card helpers and leaderboard column definitions to replace or refactor.
- `web/components/GoaliePage/goalieMetrics.test.ts` - Covers goalie metrics helpers, including advanced metrics row aggregation and missing-value fallback.
- `web/components/GoaliePage/goalieFilters.ts` - Minimum GP parser to reuse or generalize for skaters.
- `web/components/Variance/varianceFilters.ts` - Shared Variance filter parser for goalie and skater Minimum GP text inputs.
- `web/components/Variance/varianceFilters.test.ts` - Shared Minimum GP parser tests for non-negative whole numbers and invalid input fallback.
- `web/components/GoaliePage/goalieTypes.ts` - Goalie row/metric types that need advanced metric and Value Tier hardening.
- `web/styles/Goalies.module.scss` - Active goalie table/control styles and advanced card styles to convert toward table usage.
- `web/pages/variance/variance.module.scss` - Shared Variance hub/skater page styles.
- `web/lib/navigation/siteSurfaceLinks.ts` - Shared surface link inventory; removed unused goalie-specific link set during route cleanup.
- `web/rules/context/variance-runbook.md` - Durable data-flow and metric-maintenance runbook to update after implementation.
- `web/rules/context/goalie-page-relevant-tables.md` - Goalie schema glossary for advanced Metrics table field mapping.
- `web/rules/context/player-table-schemas.md` - Skater schema source for MVP table fields.
- `web/rules/context/supabase-table-structure.md` - Broader skater schema source for MVP table fields.
- `web/components/GoaliePage/goalieFilters.test.ts` - Existing Minimum GP parser tests.
- `web/components/GoaliePage/goalieCalculations.test.ts` - Existing calculation tests to extend for volatility/tier behavior.

### Notes

- Default unresolved PRD choices for implementation: use visible label `Even Strength` for the `nst_ev_*` strength mode; use a neutral skater production proxy for v1 instead of assuming site-wide fantasy scoring; start goalie advanced metrics from season/totals data unless matching the selected date range is straightforward without changing backend contracts.
- Unit tests should live alongside the code files they test, following the existing `GoaliePage/*.test.ts` pattern.
- Confirm the repo’s current test command before execution; existing files use Vitest-style tests.

## Tasks

- [x] 1.0 Tighten Variance route family and cleanup route assumptions
  - [x] 1.1 Verify `/variance`, `/variance/goalies`, `/variance/skaters`, and `/goalies` redirect behavior still match the PRD before making runtime changes.
  - [x] 1.2 Audit active internal links for `/goalies` and replace user-facing links with `/variance/goalies` where needed.
  - [x] 1.3 Re-audit `GOALIE_SURFACE_LINKS` and either wire it intentionally into the goalie surface or remove stale/dead references.
  - [x] 1.4 Keep `/variance` minimal and avoid expanding the hub beyond the two required route links.

- [x] 2.0 Build Supabase-backed goalie advanced metrics data path
  - [x] 2.1 Choose the concrete goalie source for v1 advanced metrics from the documented surfaces, preferring `goalie_totals_unified` or `goalie_stats_unified` where the required fields exist.
  - [x] 2.2 Add a narrow Supabase fetch path for advanced goalie metrics without changing the current NHL API-backed leaderboard fetch path.
  - [x] 2.3 Map fetched rows to a stable advanced goalie metric row model keyed by goalie/player id.
  - [x] 2.4 Handle loading, empty, error, and missing-field states without breaking the standard Metrics tab.
  - [x] 2.5 Keep advanced metric fetch scope explicit in code comments or helper names so it is not mistaken for the leaderboard source of truth.

- [x] 3.0 Convert goalie Advanced Analytics cards into a sortable table
  - [x] 3.1 Replace the current advanced metrics card grid with a table surface using the same broad conventions as `GoalieTable`.
  - [x] 3.2 Add high-priority columns: `QS%`, `GSAA`, `xGA`, `xGA/60`, `HDSA/60`, and `SA/60`.
  - [x] 3.3 Add medium-priority columns `RA/60` and `RushA/60` if the table remains readable.
  - [x] 3.4 Add optional shot/goal distance columns only if they do not crowd the MVP table.
  - [x] 3.5 Render missing or non-finite values as `N/A` and keep sorting stable with missing values placed after real values.
  - [x] 3.6 Add short header labels plus tooltip/help text for context metrics that are not direct goalie quality grades.
  - [x] 3.7 Remove or retire obsolete advanced metrics card styles once the table is live.

- [x] 4.0 Add goalie advanced metrics strength selector
  - [x] 4.1 Centralize strength options and field-prefix mapping for all situations, 5v5, Even Strength, PK, and PP.
  - [x] 4.2 Default the advanced table to all situations.
  - [x] 4.3 Update the selected strength state without changing the route.
  - [x] 4.4 Ensure counts and rates use distinct field mappings and labels.
  - [x] 4.5 Add tests or fixtures for strength prefix mapping and missing strength data fallback.

- [x] 5.0 Harden Minimum GP as a shared text-input flow
  - [x] 5.1 Confirm current goalie Minimum GP behavior against PRD expectations, especially empty input and last-valid fallback.
  - [x] 5.2 Generalize or reuse `parseMinimumGamesPlayedInput` for skaters without duplicating parser logic.
  - [x] 5.3 Apply Minimum GP consistently to goalie leaderboard, standard goalie Metrics, advanced goalie Metrics, and skater MVP rows.
  - [x] 5.4 Update inline copy if the documented default threshold differs from the current `0` behavior.
  - [x] 5.5 Extend parser tests for non-negative whole numbers, whitespace, empty input, invalid pasted input, and skater reuse.

- [x] 6.0 Revise goalie Value Tier formula and move it out of presentation-only rendering
  - [x] 6.1 Define the revised Value Tier input contract using fantasy production, consistency, workload, and start confidence.
  - [x] 6.2 Include `totalGamesStarted` and `percentAcceptableWeeks` in start-confidence scoring where available.
  - [x] 6.3 Incorporate `QS%` into Value Tier scoring only when the advanced metrics row is available for the goalie.
  - [x] 6.4 Move tier score calculation into shared calculation/data-shaping code instead of computing it inside `GoalieLeaderboard`.
  - [x] 6.5 Expose both tier label and numeric tier score so sorting can use the score.
  - [x] 6.6 Update user-facing labels/tooltips to state that tiers are relative to the current filtered population.
  - [x] 6.7 Update Value Tier tests for determinism, filtered-population behavior, QS% support, and tier-score sorting.

- [x] 7.0 Tighten relative variance display and sorting
  - [x] 7.1 Keep relativity scoped to WoW standard deviation and game standard deviation columns.
  - [x] 7.2 Centralize relative variance formatting so plus signs, `N/A`, and lower-is-better copy are consistent.
  - [x] 7.3 Make labels say filtered average rather than full league average.
  - [x] 7.4 Confirm raw variance sorting remains valid in relative mode because the relative transform subtracts a constant.
  - [x] 7.5 Add or update tests for relative labels, plus/minus formatting, missing values, and sortable column keys.

- [x] 8.0 Build live `/variance/skaters` MVP table
  - [x] 8.1 Replace the scaffold-only skaters page with a live data-loading page.
  - [x] 8.2 Fetch existing skater data from `wgo_skater_stats`, with optional supporting context from `wgo_skater_stats_totals` only if needed.
  - [x] 8.3 Aggregate game rows by player for the selected/current season into MVP table rows.
  - [x] 8.4 Include player name, team where available, position, GP, production proxy, goals, assists, shots, TOI/GP, and one game-to-game volatility measure.
  - [x] 8.5 Use a neutral production proxy for v1 unless an existing site-wide fantasy scoring helper is clearly available.
  - [x] 8.6 Add sortable table headers and stable missing-value formatting.
  - [x] 8.7 Add the shared Minimum GP text input to the skaters table.
  - [x] 8.8 Add copy that clearly frames skaters as the first MVP and avoids claiming full goalie parity.

- [x] 9.0 Add focused tests for new shared calculations and table helpers
  - [x] 9.1 Add tests for goalie advanced strength field mapping.
  - [x] 9.2 Add tests for advanced metric value formatting and missing-value sort behavior.
  - [x] 9.3 Add tests for revised Value Tier score calculation and tier labels.
  - [x] 9.4 Add tests for skater game-to-game volatility calculation.
  - [x] 9.5 Add tests for shared Minimum GP parser behavior across goalie and skater usage.

- [x] 10.0 Update runbook and verify the second-pass rollout
  - [x] 10.1 Update `variance-runbook.md` with the actual goalie advanced metrics source and field mappings used.
  - [x] 10.2 Update the runbook with the skaters MVP data source, aggregation rules, volatility formula, and known gaps.
  - [x] 10.3 Document page-layer versus table/view-layer calculations after the implementation is complete.
  - [x] 10.4 Run targeted checks for `/variance`, `/variance/goalies`, and `/variance/skaters`.
  - [x] 10.5 Run the focused unit tests added or changed for this pass.
