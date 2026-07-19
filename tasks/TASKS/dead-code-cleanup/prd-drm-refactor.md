# PRD: Date Range Matrix (DRM) Refactor

> **Implementation task list:** `tasks/TASKS/dead-code-cleanup/tasks-prd-drm-refactor.md`

Generated: 2025-09-12 13:27:53 UTC

## Overview
The DRM visualizes player-to-player time-on-ice relationships for a team over a date range. This refactor unifies data fetching and derivation into a single hook and separates rendering into a presentational component, reducing drift and simplifying future changes.

## Goals
- One data source of truth for DRM (raw shifts or aggregated inputs)
- Stable API (team abbreviation in, presentational props out)
- Easier to validate, test, and optimize
- Preserve current functionality with minimal UI changes

## Scope
- Add unified data hook to power DRM for both sources (raw and aggregated)
- Create a presentational, props-only DRMV (view) component
- Wire `web/pages/drm.tsx` to use the hook and view
- Refactor specialized component to use the unified hook (`DateRangeMatrixForGames`)

## Architecture
- Hook: `useDateRangeMatrixData(teamAbbreviation, startDate, endDate, mode, source, seasonType?, aggregatedData?)`
  - Returns: `{ loading, status, error, stale, source, coverage, teamId, teamName, roster, toiData, homeAwayInfo, playerATOI, lines, pairs }`
  - `source: 'raw'` → uses `getTOIDataForGames` from Supabase `shift_charts`
  - `source: 'aggregated'` → selects the explicit regular-season/playoff bucket and maps existing aggregated rows to typed `PlayerData`
  - Computes `lines` and `pairs` via `calculateLinesAndPairs` consistently in both paths
- View: `DateRangeMatrixView` → thin wrapper around `DateRangeMatrixInternal`
  - Renders grid given props, no fetching/derivation inside
- Page: `web/pages/drm.tsx`
  - Calls `useDateRangeMatrixData` with `source: 'aggregated'`
  - Owns canonical team ID, selected season ID/type, and exact date-window resolution before making one aggregate-reader request
  - Tags resolved aggregate/card results with the exact team/season/type/timeframe/date/game-ID/venue/opponent scope and masks any result whose identity no longer matches
  - Renders `DateRangeMatrixView` with results
- Cards: `LinePairGrid` and its skater/goalie cards are pure scoped consumers
  - Use the same mapped roster as the matrix and exact `skatersGameStats`/`goaliesGameStats` rows limited to post-filter matched game IDs
  - Hide unsupported or incomplete values instead of reading player-global buckets or retaining independent async state
- Specialized: `DateRangeMatrixForGames`
  - Simplified; now calls unified hook with `source: 'raw'`

Visible hook results are keyed to the exact request identity. A team/date/source/season transition synchronously masks prior roster and derived data before passive effects run, late completions cannot overwrite newer requests, invalid inputs reset to `idle`, and failed/empty last-N resolution clears the prior date range instead of reusing it.

## Updated Files
- `web/components/DateRangeMatrix/useDateRangeMatrixData.ts` (new)
- `web/components/DateRangeMatrix/useTOIData.tsx` and focused test (typed complete raw reader and partial-coverage contract)
- `web/components/DateRangeMatrix/DateRangeMatrixView.tsx` (new)
- `web/pages/drm.tsx` (updated to use hook + view)
- `web/components/DateRangeMatrix/DateRangeMatrixForGames.tsx` (refactored to hook)
- `web/components/DateRangeMatrix/fetchAggregatedData.ts` and focused test (complete fail-closed aggregate reader)
- `web/components/DateRangeMatrix/LinePairGrid.tsx`, `PlayerCardDRM.tsx`, `GoalieCardDRM.tsx`, and focused grid test (pure canonical-scoped card rendering and synchronous reset)
- `web/styles/LinePairGrid.module.scss` (supported goalie-card layout and explicit unavailable state)
- `web/components/DateRangeMatrix/utilities.ts` and focused test (date-owner error propagation)

## API Contracts
- Input (hook):
  - `teamAbbreviation: string` (canonical identifier)
  - `startDate, endDate: YYYY-MM-DD`
  - `mode: 'line-combination' | 'full-roster' | 'total-toi'`
  - `source: 'raw' | 'aggregated'`
  - `seasonType: 'regularSeason' | 'playoffs'` (required by the active aggregated caller; defaults only for compatibility)
  - `aggregatedData?: any[]` (only required for aggregated)
- Output (hook):
  - `loading, status, error, stale, source, coverage, teamId, teamName, roster, toiData, homeAwayInfo, playerATOI, lines, pairs`
- View component props mirror hook result values (minus `homeAwayInfo` optional)
- Aggregate durations are normalized to seconds and relationship/count maps to finite numbers before entering the `PlayerData` contract; invalid player identities are excluded rather than materialized as synthetic ID `0` rows.
- Raw reads select only generated `shift_charts` fields, constrain canonical team ID/abbreviation plus exact inclusive dates and either the selected regular/playoff game type or a null game type that must remain visible as incomplete coverage, and use deterministic `id`-ordered inclusive short pages until the first short page. Any page error rejects the complete request. Positive row/game/player identities and unique player-game rows are mandatory; team/date/type conflicts, malformed clocks/JSON/partner identities, impossible appearance TOI beyond game length, and contradictory mirrors reject.
- A raw game is included only when all player rows provide season, selected game type, appearance TOI, game length, and both relationship maps and every unordered player pair has two equal mirrored observations in one persisted relationship category. `home_or_away` is optional because both full relationship writers currently omit it; non-null values must agree, and a home/away row is published only when the game supplies that metadata. Incomplete nullable coverage excludes that entire game and increments genuine skipped-row coverage; observed `00:00` remains a valid zero fact. After bounded player fallback resolves canonical player types, persisted same/mixed category drift is normalized using the writers' forward-versus-non-forward rule, so one pair cannot split across buckets. The reducer publishes one roster row per player, one pair/game fact counted once, exact GP/total TOI/ATOI/line-pair counts, player-relative shared percentages, and canonical team/franchise identity. Unresolved identity metadata rejects.
- Aggregated reader input is one explicit `{ teamId, seasonId, seasonType, startDate, endDate, gameIds?, homeOrAway?, opponentTeamAbbreviation? }` object. The reader does not recalculate last-N dates. It filters the generated `shift_charts` schema by exact team, season, game type, dates, and optional fixed game IDs; reads all rows through deterministic `id`-ordered short pages; rejects page errors or invalid player/game identities; and returns unique post-filter `matchedGameIds` for truthful coverage copy.
- Player-master fallbacks use the shared Supabase helper with deterministic `id` ordering and 200-ID filter chunks. A failed chunk rejects the complete request. Last-N schedule lookup database errors also reject so the page can distinguish `error` from a legitimate empty/insufficient schedule.
- Visible card stats use only the aggregate reader's unique post-filter `matchedGameIds` and the players' exact appearance IDs. Both game and player filters are bounded to 200 IDs, every chunk uses inclusive short-page pagination ordered by compound primary-key identity plus `created_at`, and a later-page error rejects the complete request. A player is published only when there is exactly one valid stat row for every expected appearance and no extra row. Missing, duplicate, malformed, unsafe-identity, or internally contradictory rows produce an explicit unavailable state rather than fabricated zeroes.
- Supported skater values are exact sums of goals, assists, points, power-play points, shots, hits, blocks, and plus/minus. Supported goalie values are appearance count, saves, weighted save percentage, and TOI-weighted GAA. Goalie record, quality-start percentage, shutouts, and starts are hidden because the exact game-stat source cannot prove those semantics.
- Last-N resolution input is explicit `{ teamId, seasonId, seasonType, gamesBack, scopeStartDate, scopeEndDate }`. It reads the completed `wgo_team_stats` ledger through exact team/season/type bounds, deterministic `date DESC, game_id DESC NULLS LAST, id DESC` ordering, and one hard `0..N-1` range; invalid/missing/duplicate candidates and database errors reject, fewer than N rows return `null`, and exact newest-first IDs plus start/end dates are returned.

### Approved NEW 12 last-N and manual-date contract

- Repository history establishes the compatibility baseline: `586ff3fc3` introduced L7/L14/L30 as the selected team's unfiltered last N games, and `01ef182fd` later added Home/Away and Opponent filters after that range was resolved. The original PRD also requires preservation of current functionality with minimal UI change.
- **Approved Option A — fixed team window, then filters:** L7 means the selected team's exact last seven completed games in the selected season/type. Home/Away and Opponent narrow those same seven IDs, the resolved dates/IDs remain stable when filters change, and the UI reports `x matching games within last 7 team games`, including zero. The owner supplied the exact approval on 2026-07-18; filters-first Option B is retained only as rejected decision history.
- **Manual-date contract:** editing either date switches the timeframe to visible `Custom`; paired calendar-date parsing/formatting preserves the exact inclusive dates across time zones; team and Home/Away/Opponent changes preserve those dates and apply within them; changing season/type exits Custom to that type's full Season bounds; clicking L7/L14/L30/Season exits Custom and recalculates; active-preset re-clicks are no-ops; and missing or reversed ranges fail closed before any aggregate request. NEW 16 separately owns complete URL persistence/restoration and sanitization.
- **Card boundary:** `LinePairGrid` remains unmounted for Custom, loading, error, and empty scopes. NEW 17/18 now also make the consumer pure, exact-scope keyed, and synchronously empty for changed/incomplete/failed/zero-game identities; Custom intentionally uses the exact-date matrix while hiding unsupported cards.

### Displayed-card scope mismatch (NEW 17 — resolved 2026-07-18)

- The aggregate request now fetches exact skater/goalie game-stat rows only for post-filter matched game IDs and the scoped roster's player IDs. Exact per-player appearance coverage is required; missing, duplicate, malformed, unsafe, or contradictory rows remain unavailable, including valid distinction between true zero totals and absent coverage.
- Skater cards retain all eight supported box-score totals. Goalie cards retain only GP, saves, weighted SV%, and weighted GAA; Record, QS%, SO, and GS are hidden because their semantics are not provable from the exact source. Custom hides all cards while the matrix continues to honor its selected exact-inclusive dates.
- Focused filtered, sparse-opponent, injured-player, Custom-hide, exact aggregation, unavailable, and query-bound regressions pass. No player-global `/skaterArray` or date-only goalie read remains in the card tree.

### Stale LinePairGrid retention (NEW 18 — resolved 2026-07-18)

- The page owns one canonical scope key and exposes aggregate/card data only when the resolved key equals the active key. `useDateRangeMatrixData` independently masks changed request identities, and sequence ownership prevents late aggregate completions from overwriting a newer scope.
- `LinePairGrid` has no retained result or independent fetch state: it derives lines/pairs/goalies from current props and returns nothing unless status is success/partial, roster is nonempty, and the matching-game count is positive. Focused first-render A-to-B loading, nonzero-to-zero, empty, error, and page-level filter-invalidation regressions pass.

### Raw/aggregate parity and producer findings (NEW 19–20)

- The rebuilt raw contract is intentionally strict, but the active aggregate `processData` reducer still uses `any`, coerces malformed/null durations to zero, accepts malformed relationship keys, and does not reject duplicate player-game or contradictory mirrored observations. NEW 19 owns the shared typed-reduction/parity repair; NEW 10 does not fabricate equality against that known-lax path.
- `shift_charts` has two incompatible active producer classes: the TypeScript route and legacy JavaScript upsert both write DRM relationship/game/position fields, while projection-input ingestion can insert only strength totals and basic metadata and considers any existing row complete. Such rows cannot prove raw DRM pair semantics and can also make later full enrichment appear unnecessary. NEW 20 owns completeness-aware producer/preflight reconciliation, bounded affected-row inventory, and separately approved production backfill/deployment. Until then the raw contract deliberately includes null-game-type rows in its bounded team/date read and treats every incomplete game as partial rather than zero.

### Raw boundary hardening (NEW 21 — resolved 2026-07-18)

- Unified-hook team metadata uses the same optional-safe trimmed uppercase identity accepted by the raw reader. Duration parsing rejects a reduced clock total that is not a safe integer, and a present game length must be positive. Player-master fallback derives `lastName` from every token after the given name so surname particles match the aggregate fallback contract.

## UI/UX & Styling
- Current DRM page uses custom styles (`drm.module.scss`). To align with site-wide design:
  - Typography: apply site typography scale and consistent font weights
  - Spacing: use standard spacing tokens for paddings, grid gaps, margins
  - Colors: inject theme variables (primary/secondary/accent) via CSS vars and reference shared palette in `styles/`
  - Buttons/toggles: replace ad-hoc styles with reusable button/select components used elsewhere
  - Responsiveness: ensure grid and header scale on small screens; add horizontal scroll affordance
  - Accessibility: increase contrast for matrix cells; add aria labels/tooltips; ensure keyboard focus styles are visible
  - Loading/empty states: standardized skeletons/placeholders

Deliverables for UI polish (follow-up tasks):
- Replace local button styles with shared `Button` component
- Replace `Select` usage with shared select wrapper (consistent spacing, focus)
- Normalize header layout to match page headers (logo size, title casing)
- Audit CSS variables used in DRM and map to global variables in `web/styles/vars.scss`

## Newly Discovered Issues (2025-09-12)

- DatePicker clipping within controls panel:
  - The `react-datepicker` popper gets clipped due to `overflow: hidden` on the panel container. Fix: set `overflow: visible` on the datepicker group and apply a high z-index to `.react-datepicker-popper`, or use `withPortal` to render outside the flow. We’ll do both for robustness.

- Preference for dual team selectors:
  - Keep both the horizontal team navbar (TeamSelect) and the physical dropdown (TeamDropdown) on the DRM page for different workflows. Ensure both are present and accessible.

- Maximum update depth exceeded in DRMPage:
  - Cause: Passing a non-memoized `aggregatedData` (via `Object.values(...)`) to `useDateRangeMatrixData` causes the hook’s effect dependency to change on every render, creating a render loop.
  - Fix: Memoize the `aggregatedData` that’s passed to the hook with `useMemo(() => Object.values(...), [seasonType, regularSeasonData, playoffData])`. Also ensure the hook’s effect list is stable and only recomputes when the actual data changes.

## Action Items (Hotfixes)

- Restore `TeamDropdown` alongside `TeamSelect` on DRM page (both paths available).
- Update datepicker container styles to `overflow: visible` and add `.react-datepicker-popper { z-index: 10000 }`.
- Pass `withPortal` to `DatePicker` to avoid clipping within overflow contexts.
- Memoize `aggregatedData` object array before passing into `useDateRangeMatrixData` to stop infinite re-renders.

## Performance Considerations
- Memoize heavy transforms (`calculateLinesAndPairs`, roster mapping)
- Avoid re-renders by stabilizing prop identities and using `useMemo`
- Consider virtualization for large rosters (if row/col > ~30)
- Defer non-critical logs and dev-only computations

## Risks & Mitigations
- Data parity between sources: use a temporary QA toggle (query param) to compare raw vs aggregated outputs
- Dynamic imports or edge cases: keep hook boundary minimal and typed; add guards for missing data

## Rollout Plan
1) Ship unified hook + view (done)
2) Validate parity with existing outputs on key teams and date ranges
3) Optional: enable `?drm-source=raw` QA toggle for internal verification
4) Remove specialized component if unused (or keep as thin wrapper)
5) UI polish tasks to align with site design

## Appendix: Re-run/Dev Notes
- Types: `cd web && npx tsc -p tsconfig.json --noEmit`
- Dead code scan: see `tasks/prd-dead-code-report.md`
- Inventory: see `tasks/prd-file-inventory.md`
