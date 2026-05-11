## Relevant Files

- `migrations/20260407_create_team_underlying_stats_tables.sql` - The clean replacement migration for the v1 team-underlying schema, starting with the dedicated game-by-team summary table.
- `web/pages/api/v1/db/catch-up-player-underlying.ts` - Reference implementation for incremental catch-up batching and admin-route response shape.
- `web/pages/api/v1/db/backfill-player-underlying-season.ts` - Reference implementation for season backfill batching and landing-cache warm flow.
- `web/lib/underlying-stats/playerStatsSummaryRefresh.ts` - Reference implementation for per-game summary refresh helpers and cache warming.
- `web/pages/api/v1/underlying-stats/players.ts` - Reference landing API contract for sortable table reads.
- `web/pages/underlying-stats/playerStats/index.tsx` - Reference shared landing-page shell, staged loading, and client state orchestration.
- `web/pages/underlying-stats/goalieStats/index.tsx` - Reference route-level query canonicalization for a non-player landing variant.
- `web/__tests__/pages/underlying-stats/goalieStats/[playerId].test.tsx` - Repaired goalie detail route test file that had the pre-existing syntax error blocking the full suite.
- `web/components/underlying-stats/PlayerStatsFilters.tsx` - Shared filter UI to adapt for the team variant.
- `web/components/underlying-stats/PlayerStatsTable.tsx` - Shared wide-table renderer to reuse for team results.
- `web/components/underlying-stats/UnderlyingStatsLandingShell.tsx` - Shared landing-page frame for the player, goalie, and team underlying-stats variants.
- `web/components/underlying-stats/playerStatsColumns.ts` - Reference column-definition patterns for ordered, sortable stat families.
- `web/lib/underlying-stats/playerStatsFilters.ts` - Reference filter normalization, URL serialization, and scope-exclusivity behavior.
- `web/lib/underlying-stats/playerStatsQueries.ts` - Reference landing-query contract and API-path helper patterns.
- `web/pages/api/v1/db/catch-up-team-underlying.ts` - New admin catch-up route for team summary refreshes.
- `web/pages/api/v1/db/backfill-team-underlying-season.ts` - New admin route for bulk historical team backfills.
- `web/lib/underlying-stats/teamStatsSummaryRefresh.ts` - New team summary refresh helpers and optional landing-cache warm hooks.
- `web/lib/underlying-stats/teamStatsRefreshWindow.ts` - Incremental team catch-up game selection helper that mirrors the existing player and goalie refresh-window flow.
- `web/pages/api/v1/underlying-stats/teams.ts` - New landing API wrapper for team table reads.
- `web/lib/underlying-stats/teamStatsFilters.ts` - New team landing filter-state, URL parsing, and default-sort contract.
- `web/lib/underlying-stats/teamStatsLandingApi.ts` - Client-safe team landing response and path contract shared by the route, tests, and server query layer.
- `web/lib/underlying-stats/teamStatsQueries.ts` - New team landing query and aggregation layer.
- `web/__tests__/pages/underlying-stats/teamStats/index.test.tsx` - Route-level tests for canonical team URL rewriting, default-load fetch behavior, and display-mode API integration.
- `web/components/underlying-stats/teamStatsColumns.ts` - New canonical Team Counts and Team Rates column definitions.
- `web/pages/underlying-stats/teamStats/index.tsx` - New team underlying-stats landing route.
- `web/components/underlying-stats/teamStatsColumns.test.ts` - Tests for team column families and default sorts.
- `web/lib/underlying-stats/teamStatsFilters.test.ts` - Tests for team filter parsing, URL round-trips, and scope exclusivity.
- `web/lib/underlying-stats/teamStatsQueries.test.ts` - Tests for team aggregation math, filtering, and opponent semantics.

### Notes

- Scope this task list to the landing-page v1 only. `pages/underlying-stats/teamStats/[teamId]` is explicitly deferred.
- Do not create `pages/underlying-stats/teamStats/[teamId]` or any team-detail API route during v1 implementation unless the task list is expanded later.
- Delete the existing incorrect first-pass migration before rebuilding the team schema from scratch.
- Use `Points desc` as the default sort for Team Counts and `xGF% desc` as the default sort for Team Rates unless product direction changes.
- Treat `Date Range`, `Game Range`, and `Team Game Range` as mutually exclusive scope modifiers in both UI state and query logic.
- Treat `Team` and `Opponent` as one aggregate-query surface for v1: `againstTeamId` alone means league-wide results against that opponent, while `teamId + againstTeamId` means the selected team's aggregate against that opponent. Do not introduce a separate matchup or detail experience.
- Use the repo’s current test stack for targeted verification. Prefer `npx vitest run [optional/path/to/test/file]`.

## Tasks

- [x] 1.0 Reset the incorrect first pass and lock the v1 assumptions before implementation starts
  - [x] 1.1 Delete the incorrect first-pass team migration file(s), including `migrations/20260408_create_team_underlying_stats_tables.sql`, so the feature restarts from a clean schema baseline.
  - [x] 1.2 Confirm the v1 scope is the landing page only and explicitly defer `pages/underlying-stats/teamStats/[teamId]`.
  - [x] 1.3 Lock pragmatic default sorts for implementation: `Counts -> Points desc`, `Rates -> xGF% desc`, unless product direction changes before build-out.
  - [x] 1.4 Lock v1 opponent semantics: `teamId + againstTeamId` narrows the same aggregate query to that matchup sample; do not create a separate head-to-head surface.

- [x] 2.0 Rebuild the team schema and apply the migration cleanly
  - [x] 2.1 Draft a fresh migration that creates the canonical per-game/per-team summary table(s) needed for landing-page aggregation, rather than reusing player or goalie tables.
  - [x] 2.2 Include all PRD-required identity and filter dimensions in the schema: season, season type or game type, game/date, team, opponent, venue, strength, score state, and TOI context.
  - [x] 2.3 Persist every numerator and denominator needed to derive the requested Team Counts and Team Rates columns, including standings outcomes (`W`, `L`, `OTL`, `ROW`, `Points`, `Point %`) and the full CF/FF/SF/GF/xGF/SC/HDC/MDC/LDC shot-family inputs.
  - [x] 2.4 Add uniqueness constraints and performance indexes for season scans, game refreshes, team/opponent filters, and strength/score-state slices.
  - [x] 2.5 Apply the migration through the established project workflow and verify the new tables are the only active team-underlying schema for this feature.

- [x] 3.0 Build the team-specific refresh, catch-up, and season-backfill pipeline
  - [x] 3.1 Implement team summary refresh helpers in `web/lib/underlying-stats/teamStatsSummaryRefresh.ts` using the player summary-refresh pattern as the operational template.
  - [x] 3.2 Create `web/pages/api/v1/db/catch-up-team-underlying.ts` to ingest newly finished or missing games and refresh only the affected team summary rows.
  - [x] 3.3 Create `web/pages/api/v1/db/backfill-team-underlying-season.ts` to populate historical team coverage in bounded batches and finish with a team landing-cache warm step if the route introduces one.
  - [x] 3.4 Ensure both admin routes write only to the new team tables and do not regress player or goalie refresh behavior.
  - [x] 3.5 Add focused tests for game selection, batching, partial-failure reporting, and summary-refresh invocation.

- [x] 4.0 Implement the team landing query contract, filter state, and URL semantics
  - [x] 4.1 Create `web/lib/underlying-stats/teamStatsFilters.ts` with the canonical landing filter shape covering primary controls, expandable filters, sorting, pagination, and advanced-panel state.
  - [x] 4.2 Support and validate all PRD filters: `From Season`, `Through Season`, `Season Type`, `Strength`, `Score State`, `Display Mode`, `Team`, `Opponent`, `Home/Away`, `Minimum TOI`, `Date Range`, `Game Range`, and `Team Game Range`.
  - [x] 4.3 Enforce that `Date Range`, `Game Range`, and `Team Game Range` are mutually exclusive during normalization and URL serialization.
  - [x] 4.4 Implement deterministic sort mapping for every visible team column and wire the v1 default sorts from `1.3` into the default landing state.
  - [x] 4.5 Implement `web/lib/underlying-stats/teamStatsQueries.ts` to read team summaries, aggregate by team, compute requested counts, derive per-60 rates from TOI, and preserve share or percentage metrics without double-converting them.
  - [x] 4.6 Implement opponent-filter behavior so `againstTeamId` alone shows all teams against that opponent, and `teamId + againstTeamId` shows the selected team’s aggregate against that opponent without special-case UI branching.
  - [x] 4.7 Add focused tests for filter parsing, URL round-trips, scope exclusivity, default sorts, rate derivations, and opponent semantics.

- [x] 5.0 Add the dedicated team landing API surface and route wiring
  - [x] 5.1 Create `web/pages/api/v1/underlying-stats/teams.ts` as the landing API wrapper over `teamStatsQueries.ts`.
  - [x] 5.2 Define the team landing response contract so `rows`, `family`, `sort`, `pagination`, `placeholder`, and `generatedAt` mirror the existing player or goalie landing API pattern where practical.
  - [x] 5.3 Create `web/pages/underlying-stats/teamStats/index.tsx` and mirror the goalie route’s canonical-query normalization so shared links resolve to one stable URL state.
  - [x] 5.4 Wire the route to the team landing API path, default filter state, loading and empty and error states, and display-mode switching without breaking back or forward navigation.
  - [x] 5.5 Add route-level tests for canonical query rewriting, default-load behavior, and landing API integration.

- [x] 6.0 Adapt the shared underlying-stats UI for `variant="team"`
  - [x] 6.1 Refactor or wrap the shared landing-page shell so it cleanly supports `variant="team"` alongside player and goalie.
  - [x] 6.2 Create `web/components/underlying-stats/teamStatsColumns.ts` with the exact Team Counts and Team Rates column order, labels, formatting, and sortable keys required by the PRD.
  - [x] 6.3 Reuse the shared wide-table renderer for team rows, including sticky identifier behavior, horizontal overflow, and sortable headers across the full column surface.
  - [x] 6.4 Update the shared filter UI so the team variant shows `Team` and `Opponent`, hides player-only controls such as `Position Group` and trade-mode behavior, and keeps the primary controls aligned with player and goalie page conventions.
  - [x] 6.5 Verify the team variant keeps page copy, breadcrumbs, loading states, and empty states specific to team analysis rather than player wording.
  - [x] 6.6 Add UI tests for team-specific filter visibility, column families, sort behavior, and wide-table rendering.

- [x] NEW 10.0 Fix the team landing client/server import boundary and strict summary-refresh nullability blockers discovered during route verification.
  - [x] NEW 10.1 Move the team landing API path and response contract into a client-safe module so the page route does not import `pg` through server-only query dependencies.
  - [x] NEW 10.2 Narrow nullable event and game fields in `teamStatsSummaryRefresh.ts` so the new team summary builder passes TypeScript checks.

- [x] 7.0 Validate the landing-page v1 end to end
  - [x] 7.1 Run the team catch-up or season-backfill flow locally against a representative season and verify sample team rows land in the new tables.
  - [x] 7.2 Verify `/underlying-stats/teamStats` renders with the expected default display mode, default sort, and URL-synced filter state.
  - [x] 7.3 Verify `Counts` vs `Rates` switches the correct column families and calculations without dropping active filters.
  - [x] 7.4 Verify `Team`, `Opponent`, `Home/Away`, `Strength`, `Score State`, `Minimum TOI`, `Date Range`, `Game Range`, and `Team Game Range` each affect both data and URL state as expected.
  - [x] 7.5 Verify wide-viewport table behavior matches the existing `playerStats` and `goalieStats` patterns for sticky headers, sticky identity columns if used, and horizontal scrolling.
  - [x] 7.6 Run targeted tests and the workspace typecheck build, then record any remaining risks or follow-up gaps before shipping v1.

Validation note: local Chrome route verification returned `200` for the default table plus representative advanced date-range, game-range, and team-game-range URLs covering `Team`, `Opponent`, `Home/Away`, `Strength`, `Score State`, and `Minimum TOI`. The default wide table rendered one table with 72 headers, and targeted Vitest coverage for the team route, filters, queries, columns, and mobile stats component passed (`5` files, `24` tests). `npx tsc --noEmit` passed. Residual risk is limited to live data sparsity in very narrow filter combinations, which correctly returns an empty table state instead of a route failure.

- [x] NEW 12.0 Exclude zero-sample placeholder rows from team landing aggregation so narrow slices only report games with actual filtered sample.
  - [x] NEW 12.1 Filter zero-TOI/all-zero summary rows out of `teamStatsQueries.ts` before aggregation so GP, points, and team visibility are not inflated by synthetic slice placeholders.
  - [x] NEW 12.2 Add a regression test proving placeholder rows do not create extra games played or phantom teams in landing results.

- [x] NEW 13.0 Tighten team summary coverage detection so catch-up and backfill revisit partially summarized games.
  - [x] NEW 13.1 Treat a game as covered only when `allStrengths/allScores` contains sampled rows for both teams, rather than any summary row for the game.
  - [x] NEW 13.2 Align the direct-PG missing-game selector with the same broad-slice completeness rule and add focused helper coverage for partial and zero-sample games.
  - [x] NEW 13.3 Add deterministic ordering to paginated season-coverage scans so REST-based full-season coverage checks do not drift across pages.

- [x] NEW 14.0 Repair five-on-five shot classification so the default team landing view surfaces populated shot-based metrics.
  - [x] NEW 14.1 Populate `ownerGoalieOnIce` and `opponentGoalieOnIce` from parsed `situation_code` in `nhlShotFeatureBuilder.ts` instead of leaving them null for every shot feature row.
  - [x] NEW 14.2 Add a regression test covering both normal `5v5` and empty-net situation parsing so five-on-five and empty-net filters cannot silently zero out shot metrics again.

## Recorded Assumptions For V1

- The deliverable is the landing page only. A dedicated team detail route is deferred and out of scope for this checklist.
- Default sorting is assumed to be `Points desc` in `Counts` mode and `xGF% desc` in `Rates` mode until product confirms otherwise.
- Selecting both `Team` and `Opponent` is treated as a filtered aggregate for that matchup sample inside the same landing table, not as a separate head-to-head feature.

## NEW Tasks

- [x] NEW 11.0 Harden the team season-backfill selection path against transient Supabase REST failures discovered during local 7.1 validation.
  - [x] NEW 11.1 Route raw and summary missing-game selection through dependency retries so transient 5xx selection failures do not abort the backfill immediately.
  - [x] NEW 11.2 Use the local direct Postgres path for team missing-game selection when `SUPABASE_DB_URL` is available so full-season scans do not depend on Cloudflare-backed REST pagination.

- [x] NEW 8.0 Repair the pre-existing full-suite blocker before closing parent task 1.0
  - [x] NEW 8.1 Fix the syntax error in `web/__tests__/pages/underlying-stats/goalieStats/[playerId].test.tsx` (`Expected "}" but found "."` near line 50) so `npm run verify:full` can pass again.
  - [x] NEW 8.2 Re-run and verify the newly exposed regression in `web/__tests__/pages/underlying-stats/playerStats/index.test.tsx`; after the goalie-route test repair, the cached first-page revalidation test passes again and `npm run verify:full` returns green.

- [x] NEW 9.0 Reconcile the live Supabase table with the updated team-underlying migration before proceeding past schema work
  - [x] NEW 9.1 Because `team_underlying_stats_summary` was created manually before sub-tasks `2.3` and `2.4`, apply the newly added standings and shot-family columns plus the season/team/opponent/strength index set to the live Supabase schema so the database matches `migrations/20260407_create_team_underlying_stats_tables.sql` before pipeline implementation continues.
