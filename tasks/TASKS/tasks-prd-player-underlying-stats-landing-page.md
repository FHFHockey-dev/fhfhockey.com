## Relevant Files

- `web/pages/underlying-stats/playerStats/index.tsx` - Landing page route for the master player underlying-stats table.
- `web/pages/underlying-stats/playerStats/[playerId].tsx` - Player detail route for season-level logs and drill-down filters.
- `web/pages/underlying-stats/playerStats/playerStats.module.scss` - Shared page-level layout and wide-table styles for the landing and detail pages.
- `web/components/underlying-stats/PlayerStatsFilters.tsx` - Reusable primary and expandable filter controls shared by landing and detail pages.
- `web/components/underlying-stats/PlayerStatsTable.tsx` - Reusable wide-table renderer with sortable headers, empty/loading/error states, and sticky identity columns.
- `web/components/underlying-stats/playerStatsColumns.ts` - Canonical column definitions for Individual, On-Ice, and Goalie counts/rates modes.
- `web/components/underlying-stats/playerStatsColumns.test.ts` - Tests for column families, default sorts, and mode-to-column mapping.
- `web/lib/underlying-stats/playerStatsTypes.ts` - Shared types for filters, view modes, rows, sorting, and URL state.
- `web/lib/underlying-stats/playerStatsFilters.ts` - Filter normalization, compatibility rules, default state, reset logic, and query-param parsing.
- `web/lib/underlying-stats/playerStatsFilters.test.ts` - Tests for filter coercion, URL parsing, and incompatible filter resets.
- `web/lib/underlying-stats/playerStatsQueries.ts` - Query-layer orchestration for landing-page aggregates and player-detail season logs.
- `web/lib/underlying-stats/playerStatsQueries.test.ts` - Query-contract tests for scope semantics, combine/split grouping, and default ordering.
- `web/lib/underlying-stats/playerStatsLandingServer.ts` - Server-only native-source selection and stored NHL PBP adaptation for landing-page aggregation over games, events, shifts, and parity helpers.
- `web/lib/underlying-stats/playerStatsLandingServer.test.ts` - Tests for native landing-source filtering, stored-PBP normalization, and fallback landing aggregation behavior when NHL shiftcharts are empty.
- `web/pages/api/v1/db/update-player-underlying-summaries.ts` - Cron/admin route for refreshing compact per-game player underlying-summary payloads after raw Gamecenter ingest completes.
- `web/lib/supabase/Upserts/nhlRawGamecenterRoute.ts` - Raw NHL Gamecenter ingest route selection logic for explicit games, date ranges, and missing-coverage season backfills.
- `web/__tests__/pages/api/v1/db/update-nhl-shift-charts.test.ts` - Route tests for missing-coverage backfill selection so season catch-up batches skip fully covered games.
- `web/lib/supabase/Upserts/nhlRawGamecenter.mjs` - Raw NHL Gamecenter payload fetcher and normalizer, including shiftcharts HTML-report fallback when the JSON shift endpoint is empty for finished games.
- `web/lib/supabase/Upserts/nhlRawGamecenter.test.ts` - Tests for raw payload fetch retries, deterministic hashes, and HTML-report fallback parsing when modern NHL shiftcharts return empty data.
- `web/lib/underlying-stats/playerStatsFormatting.ts` - Formatting helpers for percentages, rates, TOI, and null-safe table display.
- `web/lib/underlying-stats/playerStatsFormatting.test.ts` - Tests for formatting and denominator-sensitive display behavior.
- `web/pages/api/v1/underlying-stats/players.ts` - API route for landing-page table data if a dedicated server route is used.
- `web/pages/api/v1/underlying-stats/players/[playerId].ts` - API route for player detail season-log data if a dedicated server route is used.
- `web/sql/functions/analytics.rpc_underlying_player_stats_table.sql` - Candidate RPC or SQL function for landing-page aggregation and server-side sorting/filtering if the query layer is pushed into SQL.
- `web/sql/functions/analytics.rpc_underlying_player_stats_detail.sql` - Candidate RPC or SQL function for player detail season-log aggregation if detail-page reads are pushed into SQL.
- `web/pages/stats/player/[playerId].tsx` - Existing player page reference for linking conventions and player-route context.
- `web/pages/underlying-stats/index.tsx` - Existing underlying-stats landing surface for navigation, layout, and shared section conventions.
- `tasks/player-underlying-stats-runbook.md` - End-of-project consolidation target for a cleanup-friendly runbook, TL;DR, and component elevator pitch after temporary planning artifacts are merged or removed.

### Notes

- Keep the landing page and player detail page on one shared filter and table contract wherever possible; do not let them drift into separate implementations.
- Treat `Date Range`, `Game Range`, and `By Team Games` as mutually exclusive scope modifiers and make that explicit in both UI state and query logic.
- Apply minimum TOI after aggregation over the active scope so rate eligibility stays consistent across counts, rates, combine, and split modes.
- The detail page replaces `Team` with `Against Specific Team`, but should otherwise preserve the same filter philosophy and URL-state behavior as the landing page.
- Use the repo’s existing test stack for new tests; colocate focused tests alongside the new query, filter, and column modules.
- Do not assume every requested metric already exists in a single canonical source; task the implementation to document source-of-truth and any interim derivations explicitly.

## Tasks

- [x] 1.0 Define the canonical data contract and query strategy for the landing page and player detail page
  - [x] 1.1 Inventory the canonical source for each required stat family and identify which requested columns already exist versus which require new derived aggregation.
  - [x] 1.2 Decide whether the first implementation uses direct Supabase query-layer assembly, dedicated API routes, SQL RPCs, or a hybrid, and document that choice in the task output.
  - [x] 1.3 Define the shared row shapes for Individual Counts, Individual Rates, On-Ice Counts, On-Ice Rates, Goalie Counts, and Goalie Rates.
  - [x] 1.4 Define the grouping keys for landing-page rows, including player identity, team identity, position, and combine versus split traded-player behavior.
  - [x] 1.5 Define the grouping keys for player detail rows, including season-level rows and season-team rows when `Split` is active.
  - [x] 1.6 Define how counts, per-60 rates, percentages, and ratio metrics are calculated so columns like `IPP`, `SH%`, `SV%`, and `GAA` do not drift across modes.
  - [x] 1.7 Define how `Game Range` and `By Team Games` scopes are computed from the underlying game sample before final aggregation.
  - [x] 1.8 Define canonical sort keys and deterministic tie-breakers for every table family, including the PRD-defined default sorts.
  - [x] 1.9 Define how team, venue, position, score-state, season-type, strength, and TOI filters apply at the query level before rows are returned.
  - [x] 1.10 Record which requested season-type and strength-state options lack a canonical day-one source and decide whether the initial implementation derives, defers, or blocks them explicitly.

- [x] 2.0 Define the shared filter-state model, URL parameter behavior, and scope semantics
  - [x] 2.1 Create the canonical filter-state shape covering primary controls, expandable filters, sort state, pagination state, and mode-specific compatibility rules.
  - [x] 2.2 Define defaults for landing-page load, including season defaults, stat mode default, display mode default, default sort, and collapsed advanced filters.
  - [x] 2.3 Define the URL/query-param contract for all data-shaping filters so views are shareable and recoverable.
  - [x] 2.4 Define reset behavior for incompatible filters when users switch between `Individual`, `On-Ice`, and `Goalies`.
  - [x] 2.5 Define season-range and date-range validation rules so invalid combinations are rejected before querying.
  - [x] 2.6 Define the UI and state rules that ensure only one scope modifier is active among `Date Range`, `Game Range`, and `By Team Games`.
  - [x] 2.7 Define minimum TOI threshold semantics consistently for counts and rates, including whether the threshold is hidden, disabled, or retained when goalies are selected.
  - [x] 2.8 Define how landing-page context is preserved when linking to `pages/underlying-stats/playerStats/{playerId}`.
  - [x] 2.9 Define the detail-page filter model, including the `Against Specific Team` replacement and any landing-only filters that should not carry over.

- [x] 3.0 Build the reusable table architecture and column configuration for all six stat families
  - [x] 3.1 Create a canonical column-definition module that maps each stat family to ordered columns, labels, formatting rules, sort keys, and alignment behavior.
  - [x] 3.2 Define reusable identity columns for `Player`, `Team`, `Position`, `GP`, and `TOI` so they render consistently across families.
  - [x] 3.3 Implement reusable formatting helpers for TOI, percentages, per-60 metrics, distance metrics, and null-safe display.
  - [x] 3.4 Implement sortable header behavior that supports every visible column and uses deterministic default sorting per family.
  - [x] 3.5 Build the reusable wide-table shell with horizontal overflow handling, sticky identifying columns if practical, and graceful long-column performance.
  - [x] 3.6 Implement reusable table states for loading, empty results, query errors, and no-compatible-filter-combination warnings.
  - [x] 3.7 Define pagination versus virtualization behavior for the initial release and wire the table shell to that decision.
  - [x] 3.8 Add tests that verify each stat family gets the correct columns, correct default sort, and correct formatting rules.

- [x] 4.0 Implement the landing page data flow, controls, sorting, pagination, and user states
  - [x] 4.1 Create the landing page route at `web/pages/underlying-stats/playerStats/index.tsx`.
  - [x] 4.2 Implement the primary dropdown controls for season range, season type, strength, score state, stat mode, and display mode.
  - [x] 4.3 Implement the expandable filters for team, position group, venue, minimum TOI, date range, game range, by-team-games, and combine/split.
  - [x] 4.4 Wire the landing page to the canonical filter-state and URL-state modules so page reloads and shared links reconstruct the same view.
  - [x] 4.5 Implement server-backed sorting and pagination for the landing table so large result sets do not require full client-side materialization.
  - [x] 4.6 Implement combine versus split traded-player behavior in the landing results and ensure team labels remain understandable in both modes.
  - [x] 4.7 Implement position filtering for skaters, defensemen, centers, left wings, right wings, and goalies using canonical roster logic rather than ad hoc labels.
  - [x] 4.8 Implement the mutually exclusive scope behavior for date range, player-game range, and team-game range on the landing page.
  - [x] 4.9 Implement clear loading, empty, error, and reset states for the landing page.
  - [x] 4.10 Validate that the landing page supports all six table families and the full requested column surface without layout breakage.
  - [x] 4.11 Build the server-only native landing source layer that resolves eligible games and adapts stored NHL PBP rows into the shared parity-helper event shape.
  - [x] 4.12 Implement per-game native parity aggregation for landing data over stored games, PBP events, shot features, and shifts.
  - [x] 4.13 Aggregate per-game native outputs into landing rows with combine/split grouping, post-aggregation minimum TOI gating, sorting, and pagination.
  - [x] 4.14 Replace the placeholder landing API response with real native landing rows and validate the route-level landing flow against non-placeholder results.
  - [x] 4.15 Repair raw NHL Gamecenter backfill selection so season catch-up batches target games missing raw or normalized coverage instead of re-reading arbitrary already-covered games.
  - [x] 4.16 Run a 2025-2026 missing-coverage raw ingest catch-up and verify landing-page game counts against NHL player landing totals before detail-page work resumes.

- [x] 5.0 Implement player drill-down routing and the player detail season-log page
  - [x] 5.1 Create the detail route at `web/pages/underlying-stats/playerStats/[playerId].tsx`.
  - [x] 5.2 Implement row linking from the landing page so every player name routes to the correct detail page with preserved context.
  - [x] 5.3 Build the detail-page query path for season-level logs using the same metric families and calculation rules as the landing page.
  - [x] 5.4 Replace the landing-page `Team` filter with `Against Specific Team` on the detail page and define its query semantics clearly.
  - [x] 5.5 Support one row per season by default, with season-team row splitting when `Split` is active for traded players.
  - [x] 5.6 Reuse the shared filter, sort, formatting, and table abstractions on the detail page so the two pages do not drift.
  - [x] 5.7 Implement detail-page loading, empty, and error states, including invalid-player and no-data cases.
  - [x] 5.8 Validate that detail-page filters, sorting, and carried-over landing context behave as expected.

- [x] 6.0 Validate metric correctness, edge cases, performance, and test coverage across both pages
  - [x] 6.1 Add unit tests for filter parsing, incompatible-filter resets, scope-modifier exclusivity, and URL-state reconstruction.
  - [x] 6.2 Add query-layer tests for season range, date range, game range, by-team-games, combine/split grouping, and minimum TOI eligibility.
  - [x] 6.3 Add table tests for column-family rendering, default sorting, sortable headers, and formatting of counts, rates, percentages, and distances.
  - [x] 6.4 Add route-level tests or integration checks for landing-page rendering, player drill-down, and detail-page season-log behavior.
  - [x] 6.5 Validate edge cases including traded players, partial seasons, low-TOI players, zero-denominator rate rows, missed games in team-game windows, and empty filter results.
  - [x] 6.6 Validate performance on large result sets and confirm the chosen pagination or virtualization strategy is sufficient for wide tables.
  - [x] 6.7 Validate that every requested column is available or explicitly documented as an interim derived field or deferred metric source.
  - [x] 6.8 Record any remaining implementation assumptions or metric-source gaps so the page does not silently ship with undocumented behavior.

- [x] 7.0 Consolidate temporary planning artifacts into one cleanup-friendly runbook and remove redundant markdown clutter
  - [x] 7.1 Create `tasks/player-underlying-stats-runbook.md` as the final runbook / TL;DR / component elevator pitch for future maintainers.
  - [x] 7.2 Consolidate the temporary planning markdown files created during this feature into that runbook where useful, instead of leaving many overlapping docs behind.
  - [x] 7.3 Delete or merge temporary markdown artifacts that are no longer needed once the runbook and implementation are complete.

- [x] 8.0 Harden raw native-coverage catch-up so season backfills do not stall on non-final games
  - [x] 8.1 Exclude future and same-day in-progress games from raw Gamecenter backfill selection so catch-up batches only target safely finished candidates.
  - [x] 8.2 Re-run the 2025-2026 catch-up after the selector fix and verify that landing-page GP totals match expected NHL season usage for representative players.
  - [x] 8.3 Add a PBP-only fallback for `Individual Counts` so finished games with broken NHL shiftcharts still contribute trustworthy event counts, while leaving TOI-dependent and on-ice families strict.
  - [x] 8.4 Add an NHL HTML TOI-report fallback in raw Gamecenter ingestion so finished games with empty JSON shiftcharts can still populate normalized shift rows from `TH/TV*.HTM` reports.
  - [x] 8.5 Re-run the 2025-2026 catch-up after the HTML TOI fallback lands and verify that affected games now contribute real shift rows to native landing, on-ice, and goalie surfaces.
  - [x] 8.6 Optimize full-season landing aggregation source reads now that native season coverage is real, so 2025-2026 landing queries do not hit Supabase statement timeouts at full data volume.
  - [x] 8.7 Re-verify full-season representative-player totals against NHL landing endpoints after the landing aggregation timeout is resolved.
  - [x] 8.8 Build a precomputed or cached native player-game summary path for landing-page full-season queries if the Supabase REST source-bundle path remains above interactive latency and direct Postgres socket access is unavailable in the local app runtime.
  - [x] 8.9 Add a compact per-game player underlying-summary refresh route that persists derived summary payloads into `nhl_api_game_payloads_raw` so postgame/nightly jobs can update fast-path inputs without new schema work.
  - [x] 8.10 Switch the landing API to prefer persisted per-game underlying-summary payloads and only live-reconstruct missing games from normalized PBP and shift rows while summary coverage catches up.
  - [x] 8.11 Stop `update-player-underlying-summaries?backfill=true` from re-requesting preseason games that already yield zero migrated rows, so the v2 summary migration loop terminates cleanly after regular-season coverage is complete.

## Recorded Assumptions And Remaining Gaps

This section is the canonical task output for `6.8`.

It exists so the landing/detail pages do not silently ship with behavior that only lives in implementation details, test cases, or operator memory.

### Current Day-One Runtime Support

- Supported native strengths today:
  - `allStrengths`
  - `evenStrength`
  - `fiveOnFive`
  - `powerPlay`
  - `penaltyKill`
- Unsupported strengths currently return route-level `400 Unsupported player stats filter combination`:
  - `fiveOnFourPP`
  - `fourOnFivePK`
  - `threeOnThree`
  - `withEmptyNet`
  - `againstEmptyNet`
- Supported score state today:
  - `allScores`
- Unsupported score states currently return route-level `400 Unsupported player stats filter combination`:
  - `tied`
  - `leading`
  - `trailing`
  - `withinOne`
  - `upOne`
  - `downOne`

### Explicit Metric-Source Behavior

- Full-season landing reads prefer persisted per-game summary partitions stored in `nhl_api_game_payloads_raw` under derived `source_url` keys with the `underlying-player-summary-v2` prefix.
- If persisted summaries are missing, the query layer can still reconstruct rows live from normalized games, PBP events, roster spots, and shift rows.
- `Individual Counts` has an explicit PBP-only fallback for finished games where the NHL shiftcharts feed is empty or broken.
- That PBP-only fallback does not extend to:
  - `On-Ice` families
  - `Goalie` families
  - TOI-dependent rate denominators
- NHL shift coverage now prefers the JSON `shiftcharts` endpoint and falls back to `TH*.HTM` / `TV*.HTM` HTML TOI reports for finished games when the JSON feed is empty.

### Explicitly Derived Fields

- The following goalie fields are explicit derived outputs in the query layer rather than direct persisted source columns:
  - `HD Goals Against`
  - `LD Saves`
  - `LD Goals Against`
  - `GSAA`
  - `GSAA/60`
  - danger-split `GSAA` and `GSAA/60`
- The following share and rate fields are explicit post-aggregation derivations and intentionally null out on zero denominators instead of inventing values:
  - `IPP`
  - `SH%`
  - `Faceoffs %`
  - `CF%`
  - `FF%`
  - `SF%`
  - `GF%`
  - `xGF%`
  - `SCF%`
  - `HDCF%`
  - `HDGF%`
  - `MDCF%`
  - `MDGF%`
  - goalie `SV%`
  - danger-split goalie `SV%`

### Requested Surface Versus Excluded Surface

- The requested six-family page surface is fully represented in the shared column contract and now has explicit tests.
- Extra parity-map fields that exist in the native derivation layer but are intentionally not part of the shipped day-one table surface remain excluded, including:
  - `LDCA`
  - `LDCF%`
  - `LDGF`
  - `LDGA`
  - `LDGF%`
  - `LDCA/60`
  - `LDCF/60`
  - `LDGF/60`
  - `LDGA/60`
  - on-ice `PDO`
  - zone-start and zone-faceoff columns

### Operational Assumptions

- Postgame/nightly freshness depends on this order:
  1. raw Gamecenter ingest
  2. normalized shift coverage, including HTML fallback when needed
  3. per-game underlying-summary refresh
- Summary backfill defaults to regular-season game selection; preseason or playoff refresh runs require explicit game-type targeting if operationally needed.
- Landing-query latency is acceptable only when persisted summaries are present; the live raw reconstruction path remains a fallback, not the preferred steady-state production path.
- The local app runtime may fail direct Postgres hostname resolution and transparently fall back to Supabase REST reads. That fallback is functional, but not the preferred long-term performance path.
