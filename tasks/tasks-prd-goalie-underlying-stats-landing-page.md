## Relevant Files

- `web/pages/underlying-stats/goalieStats/index.tsx` - Dedicated goalie landing page route and page-level state orchestration.
- `web/pages/underlying-stats/goalieStats/index.test.tsx` - Landing-page route tests for goalie-first loading, filters, and table rendering.
- `web/pages/underlying-stats/goalieStats/[playerId].tsx` - Dedicated goalie detail page route and goalie drill-down surface.
- `web/pages/underlying-stats/goalieStats/[playerId].test.tsx` - Detail-page tests for goalie-specific routing and preserved filter context.
- `web/pages/underlying-stats/goalieStats/goalieStats.module.scss` - Dedicated goalie page styles aligned to the current FHFH surface system.
- `web/pages/api/v1/underlying-stats/goalies.ts` - Dedicated goalie landing API wrapper over the shared aggregation engine.
- `web/pages/api/v1/underlying-stats/goalies/[playerId].ts` - Dedicated goalie detail API wrapper over the shared detail aggregation engine.
- `web/pages/api/v1/underlying-stats/goalies/[playerId]/chart.ts` - Dedicated goalie chart API wrapper if expandable-row charts are retained on the goalie landing page.
- `web/lib/underlying-stats/goalieStatsQueries.ts` - Goalie-specific API path builders, request parsing, and response contracts.
- `web/lib/underlying-stats/goalieStatsFilters.ts` - Goalie-first filter defaults, normalization, URL serialization, and validation rules.
- `web/lib/underlying-stats/goalieStatsTypes.ts` - Dedicated goalie surface types if a wrapper contract is introduced over the shared player-underlying types.
- `web/lib/underlying-stats/goalieStatsServer.ts` - Goalie route wrapper layer delegating to shared player-underlying aggregation logic.
- `web/lib/underlying-stats/goalieStatsQueries.test.ts` - Unit tests for goalie route parsing, path building, and response contracts.
- `web/lib/underlying-stats/goalieStatsFilters.test.ts` - Unit tests for goalie filter compatibility, scope exclusivity, and URL-state behavior.
- `web/lib/underlying-stats/goalieStatsServer.test.ts` - Unit tests proving the goalie wrapper correctly reuses the shared aggregation pipeline.
- `web/lib/underlying-stats/playerStatsLandingServer.ts` - Shared source-of-truth aggregation engine already computing goalie metrics and likely requiring targeted reuse hooks.
- `web/lib/underlying-stats/playerStatsSummaryRefresh.ts` - Shared summary refresh and cache warm path that must remain canonical for goalie reads.
- `web/pages/api/v1/db/update-player-underlying-stats.ts` - Canonical refresh entry point that the goalie PRD explicitly reuses.
- `web/pages/api/v1/db/update-player-underlying-summaries.ts` - Canonical summary-only refresh entry point that the goalie PRD explicitly reuses.
- `web/components/underlying-stats/PlayerStatsTable.tsx` - Shared wide-table component that may be reused or specialized for the dedicated goalie landing page.
- `web/components/underlying-stats/playerStatsColumns.ts` - Existing goalie counts and rates column definitions to audit and either reuse or extract.
- `web/components/underlying-stats/PlayerStatsFilters.tsx` - Existing shared filter component whose goalie-specific pieces may be reused or extracted.
- `tasks/prd-goalie-underlying-stats-landing-page.md` - Source PRD for this task list.
- `tasks/artifacts/goalie-stats-current-data-path-audit.md` - `1.1` audit of the current shared goalie landing/detail/chart read path through the player-underlying routes and server modules.
- `tasks/artifacts/goalie-stats-column-audit.md` - `1.2` comparison of current shared goalie counts/rates columns against the dedicated goalie PRD requirements.
- `tasks/artifacts/goalie-stats-filter-semantics-audit.md` - `1.3` audit of current goalie filter semantics, including shared scope behavior and unsupported strength/score-state gaps.
- `tasks/artifacts/goalie-stats-summary-refresh-audit.md` - `1.4` audit of the shared summary refresh and maintenance routes to confirm goalie coverage and note cache-warm nuances.
- `tasks/artifacts/goalie-stats-reuse-boundary.md` - `1.5` reuse-boundary decision for what remains in the shared player-underlying pipeline versus what becomes goalie-specific route/API/UI code.

### Notes

- Unit tests should typically be placed alongside the code files they are testing or in the current repo’s existing `__tests__` layout when that pattern is already established.
- Use `npx vitest run [optional/path/to/test/file]` for targeted verification in this repo.
- The dedicated goalie surface should reuse the existing player-underlying summary snapshot and aggregation pipeline unless a verified blocker requires deeper pipeline change.
- The task list assumes `goalieStats` is a dedicated product surface and API namespace, not a second ingestion system.

## Tasks

- [x] 1.0 Audit and lock the shared goalie data contract that the dedicated goalie surface will reuse
  - [x] 1.1 Trace the current goalie landing and detail data path through `playerStatsLandingServer.ts`, `playerStatsQueries.ts`, and the `/api/v1/underlying-stats/players*` routes.
  - [x] 1.2 Verify the currently implemented goalie counts and goalie rates columns against the PRD column requirements and document exact matches, naming differences, and missing fields.
  - [x] 1.3 Verify the current goalie filter semantics for season type, strength, score state, venue, minimum TOI, date range, game range, and team-game range.
  - [x] NEW 1.6 Extend the shared player-underlying summary and landing aggregation pipeline to support non-`allScores` goalie score states and the additional requested strength states before the dedicated goalie route promises them.
  - [x] 1.4 Confirm that the shared summary refresh path in `playerStatsSummaryRefresh.ts` and the `update-player-underlying-*` routes already covers the dedicated goalie surface with no goalie-only ingest gaps.
  - [x] 1.5 Document the reuse boundary: what stays in the shared player-underlying pipeline versus what becomes goalie-specific route, API, and UI code.
  - [x] NEW 1.7 Decide whether the dedicated goalie route needs its own aggregate-cache warm path, since the current optional warm step only prewarms the default shared landing state.

- [ ] 2.0 Create the dedicated goalie routing and API surface while preserving the shared underlying player-summary pipeline
  - [x] 2.1 Create the dedicated landing route at `pages/underlying-stats/goalieStats/index.tsx`.
  - [x] 2.2 Create the dedicated detail route at `pages/underlying-stats/goalieStats/[playerId].tsx`.
  - [x] 2.3 Add dedicated goalie API wrappers for landing, detail, and chart reads under `/api/v1/underlying-stats/goalies`.
  - [x] 2.4 Implement goalie-specific request parsing and URL builders so the goalie surface has stable, shareable route contracts independent of the player route namespace.
  - [x] 2.5 Ensure the dedicated goalie read routes delegate to shared aggregation logic rather than duplicating underlying metric computation.
  - [ ] 2.6 Add route-level tests proving the goalie API surface returns goalie-only families and preserves the existing shared source-of-truth math.

- [ ] 3.0 Implement the `/underlying-stats/goalieStats` landing page with goalie-first controls, table families, and staged loading behavior
  - [ ] 3.1 Build the goalie landing page shell and route-level page state with goalie-first copy, breadcrumbs, defaults, and metadata.
  - [ ] 3.2 Reuse or extract the current shared filter controls so the goalie landing page exposes only goalie-relevant controls.
  - [ ] 3.3 Support the required primary controls: season span, season type, strength, score state, and display mode.
  - [ ] 3.4 Support the required advanced filters: team, home or away, minimum TOI, date range, game range, and team-game range.
  - [ ] 3.5 Render the exact goalie counts and goalie rates column sets from the PRD, including correct identity columns and row-rank behavior.
  - [ ] 3.6 Preserve or adapt staged loading so the dedicated goalie landing page remains performant for large result sets without regressing clarity of progress state.
  - [ ] 3.7 Reuse or adapt the expandable-row chart pattern only if it cleanly fits the goalie surface without introducing width or loading regressions.
  - [ ] 3.8 Add landing-page tests for table-family switching, filter interactions, staged loading behavior, sort defaults, and goalie-only row results.

- [ ] 4.0 Implement the `/underlying-stats/goalieStats/{playerId}` detail page and goalie-specific drill-down navigation flow
  - [ ] 4.1 Build the dedicated goalie detail route shell and goalie-first page framing.
  - [ ] 4.2 Ensure landing-page goalie links route to the dedicated goalie detail page with preserved analysis context in the URL.
  - [ ] 4.3 Reuse the shared detail aggregation engine while constraining the detail surface to goalie-relevant families and controls.
  - [ ] 4.4 Decide and implement whether the detail page keeps the current `Against Specific Team` pattern or uses a simplified goalie-specific alternative.
  - [ ] 4.5 Add dedicated detail-page tests for route resolution, preserved query state, sort behavior, and goalie-specific rendering.

- [ ] 5.0 Align the goalie surface with the current style system and remove player-oriented information architecture from the dedicated goalie experience
  - [ ] 5.1 Reconcile the dedicated goalie landing and detail pages with the current FHFH style system and page-shell conventions.
  - [ ] 5.2 Replace player-oriented headings, descriptions, metadata cards, breadcrumbs, and empty states with goalie-specific copy.
  - [ ] 5.3 Ensure the wide goalie table uses clean horizontal overflow, sticky headers, and readable column density without leaking skater-oriented layout assumptions.
  - [ ] 5.4 Ensure goalie-specific loading, empty, and error states clearly communicate what is happening without implying skater modes or mixed player surfaces.
  - [ ] 5.5 Verify mobile and desktop behavior for the dedicated goalie landing page and detail page.

- [ ] 6.0 Verify data correctness, filter semantics, route safety, and regression coverage across the dedicated goalie surface and shared pipeline
  - [ ] 6.1 Validate goalie counts and rates calculations against the shared aggregation output for representative filters and time scopes.
  - [ ] 6.2 Validate that all required strength states and score states behave correctly for the dedicated goalie route.
  - [ ] 6.3 Validate that date range, game range, and team-game range remain mutually exclusive and produce the intended goalie result windows.
  - [ ] 6.4 Validate that minimum TOI, team, and venue filters are applied after or before aggregation in the correct stages per the PRD.
  - [ ] 6.5 Validate that the dedicated goalie routes do not break or diverge from the shared `update-player-underlying-stats` and `update-player-underlying-summaries` refresh jobs.
  - [ ] 6.6 Run targeted route, page, and server tests and document any residual risks, especially around shared pipeline coupling and future removal of goalie mode from the player surface.
