---

## ProjectionsTable.tsx

 - Summary: Main available-players table with rich sorting, filtering, need-weighted value metrics (VORP/VONA/VBD and composite score), risk estimation to next pick, favorites, expandable last-season stats via Supabase, diagnostics, and an advanced settings drawer. Supports categories vs points modes, stat-columns view, and compare-players modal.

**Props**
 - Inbound: `players`, `allPlayers?`, `draftedPlayers`, `isLoading`, `error`, `onDraftPlayer`, `canDraft`, `vorpMetrics?`, `replacementByPos?`, `baselineMode?`, `onBaselineModeChange?`, `expectedRuns?`, `needWeightEnabled?`, `onNeedWeightChange?`, `posNeeds?`, `needAlpha?`, `onNeedAlphaChange?`, `nextPickNumber?`, `leagueType?`, `forwardGrouping?`, `activeCategoryKeys?`, `enabledSkaterStatKeys?`, `enabledGoalieStatKeys?`.
 - Outbound: `onDraftPlayer` when drafting, `onBaselineModeChange`, `onNeedWeightChange`, `onNeedAlphaChange`.

**Dependencies**
 - External: `react` hooks, browser `localStorage`, `supabase` client for last-season totals, `STATS_MASTER_LIST` for stat definitions.
 - Project: `ComparePlayersModal`, CSS `ProjectionsTable.module.scss`, types `ProcessedPlayer`, `DraftedPlayer`, `PlayerVorpMetrics`.

**Data Flows**
 - Persistence: Many UI preferences persisted to localStorage (stat columns mode, hide drafted, band scope, risk SD, position filter, sort field/dir, stat sort key, favorites and favorites-only).
 - Filters: Position filter (supports `ALL`, `SKATER`, `FORWARDS`, `G`, and discrete), search (debounced), favorites-only, and optional hide-drafted.
 - Sorting: By name, position, team, ADP, FP/Score, VORP/VONA/VBD (need-adjusted), Risk, or a selected stat column. Sort dir inferred per field; stat sort direction uses stat def’s `higherIsBetter`.
 - Value metrics: Builds `vorpMap` from `vorpMetrics` and adjusts VBD with `posNeeds` and `needAlpha` when `needWeightEnabled` is true. Bands (success/warning/danger) computed per position or overall using percentile ranks over remaining (undrafted) players.
 - Risk model: Computes probability of being drafted before `nextPickNumber` using a Normal CDF with adjustable SD (picks). Colors the AVL% cell.
 - Expand rows: On expand, fetches last-season skater or goalie totals from Supabase and caches results per player ID with loading/error state.
 - Diagnostics: Optional panel summarizes exclusion reasons and counts; cross-check can query all projection source tables to find players present in sources but missing from UI pool.
 - Compare: Right-most checkboxes select players for `ComparePlayersModal` (requires 2+ selections).

**Efficiency Gaps & Recommendations**
 - Re-sorting large arrays:
   - Full `filtered.sort` runs on every input change; `filtered` is copied upfront. Acceptable for moderate sizes, but heavy at scale.
   - Recommendation: Memoize comparator inputs (`vorpMap`, `riskMap`, `statSortKey`, etc.) and consider stable-sort with key extraction to reduce repeated property access. For very large lists, consider windowing in the table.
 - Multiple passes for filters and diagnostics:
   - The `diagnostics` memo re-walks `players` with similar predicates as the main filter.
   - Recommendation: Factor shared predicate helpers; optionally compute diagnostic counters during the main filter step when `showDiagnostics` is enabled.
 - Supabase fetch per expand:
   - Each first expand triggers a DB call; rapid expands can fan out.
   - Recommendation: Add a simple in-flight guard (already present via `seasonLoading[id]`) and a small LRU or sessionStorage cache keyed by playerId to persist across page reloads.
 - LocalStorage churn:
   - Many effects write individual keys on every change.
   - Recommendation: Batch writes by section (e.g., settings vs filters) with a debounced effect, or serialize a single object namespace `projections.prefs`.
 - Risk recompute and Normal CDF:
   - `riskMap` recomputes for all `players` when SD or `nextPickNumber` changes.
   - Recommendation: It’s O(n) and fine; micro-opt: precompute normalized ADP values and skip players with missing ADP early.
 - ADP sort handling:
   - Missing ADP path includes tiebreakers; fine, but consider memoizing ADP normalization.
 - getDisplayPos recalculation:
   - Called in multiple maps and sorts.
   - Recommendation: Cache a `displayPosById` via `useMemo` if profiling shows cost.
 - Draft button state:
   - Only disables when already drafted.
   - Recommendation: Also respect `!canDraft` and `!onDraftPlayer` to guard UI.

**Actionable Improvements (to implement post-audit)**
 - Share filter predicate logic:
   - Extract `matchesFilters(player)` used by both diagnostics and the main filter to avoid divergence and double work.
 - Debounce preference persistence:
   - Use a single `useDebouncedEffect` to persist a `prefs` object: `{ bandScope, riskSd, positionFilter, sortField, sortDirection, statColumnsMode, statSortKey, favoritesOnly }`.
 - Respect draftability:
   - Disable Draft button when `!canDraft`; optionally add a tooltip explaining why.
 - Memoize display position:
   - `const displayPosById = useMemo(() => new Map(players.map(p => [String(p.playerId), getDisplayPos(p)])), [players, forwardGrouping]);` and reuse where possible.
 - Cross-check guardrails:
   - Limit cross-check result size in UI or provide CSV export; ensure Supabase errors surface succinctly.
 - Window the table (optional):
   - If list length exceeds a threshold (e.g., > 1000), add react-window or a simple manual windowing to reduce DOM nodes.

**Connections & Cross-References**
 - Consumes `vorpMetrics`, `replacementByPos`, and `baselineMode` from `DraftDashboard.tsx`/`useVORPCalculations`; ensure banding semantics align with SuggestedPicks’ ranking and DraftBoard’s leaderboard.
 - Honors `forwardGrouping` same as `MyRoster.tsx` and filters/labels positions consistently.
 - The `ComparePlayersModal` leverages `allPlayers`; ensure parent provides complete pool when available to include drafted players in comparisons.

**Potential Acceptance Tests (informal)**
 - Sorting by each header works; direction toggles; stat header respects `higherIsBetter`.
 - Filters (position/search/favorites-only/hide-drafted) produce expected counts; diagnostics numbers align when enabled.
 - Expanding a player loads and caches last-season totals; subsequent expands are instant and show formatted values.
 - Risk color coding matches AVL% thresholds and updates when `riskSd` or `nextPickNumber` changes.
 - Draft button disabled when `!canDraft`; clicking draft invokes `onDraftPlayer` with stringified id.

# Draft Dashboard – Structured Audit

---

## DraftSettings.tsx

- Summary: Settings panel controlling league configuration, roster structure, scoring modes, projection source weighting, CSV import/export triggers, keepers, traded picks, and portable bookmark serialization. Debounced UX for weight editing and normalization, plus optional expansion UIs for adding/removing stats and categories.

**Props**
- Inbound: `settings`, `onSettingsChange`, `isSnakeDraft`, `onSnakeDraftChange`, `myTeamId`, `onMyTeamIdChange`, `undoLastPick`, `resetDraft`, `draftHistory`, `draftedPlayers`, `currentPick`, `customTeamNames`, `forwardGrouping`, `onForwardGroupingChange`, `sourceControls`, `onSourceControlsChange`, `goalieSourceControls`, `onGoalieSourceControlsChange`, `goalieScoringCategories`, `onGoalieScoringChange`, `onOpenSummary`, `onOpenImportCsv`, `customSourceLabel`, `availableSkaterStatKeys`, `availableGoalieStatKeys`, `onExportCsv`, `onRemoveCustomSource`, `pickOwnerOverrides`, `onAddTradedPick`, `onRemoveTradedPick`, `keepers`, `onAddKeeper`, `onRemoveKeeper`, `onBookmarkCreate`, `onBookmarkImport`, `playersForKeeperAutocomplete`.
- Outbound: Calls parent callbacks to mutate settings and trigger actions; no children receive new props from this component.

**Dependencies**
- External: `react`, `lz-string` for bookmark compression, browser APIs (`localStorage`, `sessionStorage`, `alert`, `prompt`, `navigator.clipboard`).
- Project: `PROJECTION_SOURCES_CONFIG`, `getDefaultFantasyPointsConfig`, CSS `DraftSettings.module.scss`, `PlayerAutocomplete`.
- Types: `DraftSettings` type imported from `DraftDashboard`.

**Data Flows**
- League & roster: Stepper and inputs adjust `teamCount`, `draftOrder`, `myTeamId`, and `rosterConfig` via `onSettingsChange` and `onMyTeamIdChange`.
- Modes: Toggles for `isSnakeDraft`, `leagueType`, `isKeeper`, and `forwardGrouping` propagate up.
- Scoring: Points mode edits `settings.scoringCategories`. Categories mode edits `settings.categoryWeights`, split UI for skater vs goalie categories using available keys from parent.
- Sources: Displays and edits `sourceControls`/`goalieSourceControls` with debounced numeric/slider inputs, optional auto-normalization to sum of 1.00 for selected sources. Custom sources can be removed via `onRemoveCustomSource`.
- Goalie scoring: Separate `goalieScoringCategories` with add/remove, reset to defaults via `getDefaultFantasyPointsConfig("goalie")`.
- Bookmarks: Builds a portable payload including parent-managed state fields (read-only here), compresses with `lz-string`, offers copy and prompt-based import, then calls `onBookmarkImport` to reconcile state in parent.
- Keepers & traded picks: Provides UI for entering overrides and keepers; emits `onAddTradedPick`, `onRemoveTradedPick`, `onAddKeeper`, `onRemoveKeeper` with parsed values from DOM inputs.
- Persistence/UX: Collapsed state stored in localStorage; “Unsaved/Saved” indicator debounced by hashing key inputs; popover for weight editing; normalization state badge.

**Efficiency Gaps & Recommendations**
- Debounced timers per source id:
  - Current approach uses `Map` of timers for skater/goalie with frequent `setTimeout` churn. This is fine for small sets but can scale poorly with many sources.
  - Recommendation: Use a single debounced commit per control set (skater/goalie) keyed by last edit time, aggregating all pending changes into one update. Reduces timer churn and renders.
- DOM querying for forms (keeper/trade):
  - Uses `document.getElementById` to read inputs, then pulses classes for error feedback.
  - Recommendation: Convert to controlled local component state for round/pick/team fields. Improves React correctness and testability; removes direct DOM coupling and class pulsing via imperative code.
- Normalization work and copies:
  - `normalizeWeights`, `rebalanceWithAnchor`, and `orderSources` create new objects/arrays frequently.
  - Recommendation: Memoize ordered source arrays and precomputed totals with `useMemo`. Consider performing share calculations on-the-fly without storing interim maps in state when `autoNormalize` is true.
- Bookmarks and alerts:
  - `alert`/`prompt` are blocking and can disrupt UX; clipboard API may fail silently.
  - Recommendation: Provide non-blocking UI feedback (toast) and a modal for import. Keep `serializeBookmark`/`deserializeBookmark` but avoid blocking calls in production.
- Labels from sessionStorage per render:
  - Resolves custom CSV names by reading and parsing `draft.customCsvList.v2` on each render.
  - Recommendation: Accept `customCsvList` or a `getCustomSourceLabel(id)` prop from parent to avoid storage reads within render.
- Accessible controls clustering:
  - Many buttons inside stepper rows; ensure `aria-*` labels maintained, but consider grouping in forms with submit handlers instead of imperative read on click.

**Actionable Improvements (to implement post-audit)**
- Convert keeper/trade inputs to controlled state:
  - Local state: `tradeOwner`, `tradeRound`, `tradePick`, `keeperTeam`, `keeperRound`, `keeperPick`, `keeperSelectedPlayerId` (already). Dispatch callbacks using state values; remove `document.getElementById` and class pulsing via direct DOM.
- Aggregate debounced source updates:
  - Replace per-id timers with a single `useDebouncedCallback` that commits the latest working copy of controls after 200ms. Manage a local working `controlsDraft` object while sliders move.
- Provide import/export UI hooks:
  - Replace `alert/prompt` with `onToast(message)` prop and an `onOpenBookmarkImport()` modal signal. Keep backward compatibility for dev.
- Accept custom CSV labeling via props:
  - Add optional prop `getCustomSourceLabel?: (id: string) => string` and prefer it before reading sessionStorage.
- Memoize derived values:
  - `orderSources(obj)`, `totalActiveSourceWeight`, and `totalActiveGoalieSourceWeight` can be memoized by shallow-equality of control maps to reduce re-renders.
- Guard coercion effect:
  - Coercion from percents to scalars should only run once per mount or when a clear violation is detected; add a guard ref to prevent repeated warnings.

**Connections & Cross-References**
- Consumes and mutates state owned by `DraftDashboard.tsx`. Critical contracts:
  - Source control shapes and normalization expectations used by `useProcessedProjectionsData` in the parent.
  - Category/scoring keys must align with `availableSkaterStatKeys`/`availableGoalieStatKeys` computed in the parent from processed players.
  - Keeper/trade handlers directly alter parent’s `draftedPlayers` and `pickOwnerOverrides`, affecting `currentTurn`, `teamStats`, and `posNeeds`.
  - Bookmark import/export mirrors the parent’s Snapshot V2 fields; ensure parity with any future persistence refactors.

**Potential Acceptance Tests (informal)**
- Changing any source weight updates share badges and calls `onSourceControlsChange` after debounce; normalization sums to ~1.00 for selected sources when Auto is on.
- Adding/removing skater/goalie stats updates respective configs and hides “Add” when nothing is available.
- Keeper and traded pick additions propagate callbacks with correct parsed values and reflect in parent state (e.g., current pick auto-advance on keepers).
- Team count changes update `draftOrder` and `myTeamId` validity; roster stepper respects per-position max.

---

## DraftBoard.tsx

- Summary: Visualizes draft progress and team standings. Renders a leaderboard with category totals and team VORP, a GitHub-style contribution grid of rounds/picks (with traded pick ownership and keeper badges), and supports inline team name editing. Derives dynamic categories from settings and computes per-team aggregates using the complete player pool.

**Props**
- Inbound: `draftSettings`, `draftedPlayers`, `currentTurn` ({ round, pickInRound, teamId, isMyTurn }), `teamStats`, `isSnakeDraft`, `availablePlayers` (optional), `allPlayers` (complete player pool), `onUpdateTeamName`, `pickOwnerOverrides`, `keepers`, `vorpMetrics` (Map by playerId).
- Outbound: Calls `onUpdateTeamName(teamId, newName)` when editing team names.

**Dependencies**
- External: `react` (state, memo, effect, refs), DOM timing (`setTimeout`), environment check for DEBUG.
- Project: Types from `DraftDashboard`, `ProcessedPlayer` from `useProcessedProjectionsData`, `PlayerVorpMetrics` from `useVORPCalculations`, CSS `DraftBoard.module.scss`.

**Data Flows**
- Augmented pool: Builds `augmentedAllPlayers` Map → Array to ensure every drafted player has a placeholder if missing from `allPlayers` (guards against source-filtered pools).
- Team names: Builds `teamNameById` from `teamStats` (preferred) or `draftSettings.draftOrder` fallback.
- Contribution grid: Iterates teams × rounds, determines pick owner (snake + `pickOwnerOverrides`), marks current pick, keeper cells, and traded ownership; colors by projected fantasy points intensity from `augmentedAllPlayers`.
- Leaderboard: Derives `teamStatsWithCategories` by recomputing category sums from `draftedPlayers` using `augmentedAllPlayers` plus dynamic categories from `draftSettings.categoryWeights` that aren’t part of a fixed core. Computes `teamScoreAvg` in categories leagues from `vorpMetrics.value`.
- Extents: Computes per-category and metric extents for heat coloring cells. Sorting supports core categories, dynamic categories, teamVorp, and projectedPoints/score.
- Editing: Inline team name edit with refs for autofocus and a blur-timeout to commit changes via `onUpdateTeamName`.

**Efficiency Gaps & Recommendations**
- O(n) lookups inside loops:
  - Uses `Array.find` within per-team loops (e.g., `augmentedAllPlayers.find`), which leads to O(n·m) behavior.
  - Recommendation: Build a `playerById` Map once from `augmentedAllPlayers` and use O(1) lookups throughout grid and leaderboard aggregation. The file already builds `allPlayersData` Map; reuse it universally to avoid any remaining `.find` calls.
- Rebuilding augmented pool:
  - `augmentedAllPlayers` recreates an Array from a Map every time; downstream code immediately turns it back into a Map (`allPlayersData`).
  - Recommendation: Keep `augmentedAllPlayersMap` as a Map in memo and derive both Array (when needed for iteration) and Map from the same memo source to avoid duplicate conversions.
- Heatmap intensity scaling:
  - `maxFantasyPoints` scans all augmented players each render dependency change.
  - Recommendation: Derive while constructing the Map to avoid a second pass, or cache `maxFantasyPoints` as part of the same memo that builds the Map.
- Debug logging:
  - Extensive `console.log` in `teamStatsWithCategories` and editing handlers can be noisy in production.
  - Recommendation: Wrap behind a runtime `DEBUG` flag (already present) and ensure stripped or disabled in production builds.
- Contribution grid scale:
  - Renders teams × rounds cells; with many rounds the DOM count grows large.
  - Recommendation: Consider virtualization for the grid (windowing) when team count × rounds > threshold, or chunk into rows with lazy rendering.
- Blur debounce for submit:
  - `setTimeout` per blur may conflict if many edits happen quickly.
  - Recommendation: Use a stable debounced submit per `editingTeam` or commit on Enter and explicit checkmark button; keep blur simple to cancel edit.

**Actionable Improvements (to implement post-audit)**
- Replace `.find` lookups:
  - Build `const playerById = useMemo(() => new Map(augmentedAllPlayers.map(p => [String(p.playerId), p])), [augmentedAllPlayers]);` and use `playerById.get(id)` in leaderboard category sums and contribution grid.
- Single memo for pool + max:
  - Memoize `{ playerById, maxFantasyPoints }` from `allPlayers` and `draftedPlayers`; remove the separate `maxFantasyPoints` pass and derive intensity directly from memo output.
- Consolidate team name editing:
  - Provide a single input instance via portal/modal or maintain controlled state keyed by `editingTeam` with a `useDebouncedCallback` for submit. This removes ref juggling across two inputs.
- Optional virtualization:
  - Introduce windowing for the contribution grid when `roundsToShow` is large (e.g., > 20) or teamCount > 16 to keep DOM size manageable.
- Hoist derived dynamic keys:
  - Accept `dynamicCategoryKeys` from parent (optional) to ensure consistent derivation with parent’s stats and reduce per-component derivation churn.

**Connections & Cross-References**
- Consumes `teamStats` computed in `DraftDashboard.tsx` but also recomputes category totals locally using `augmentedAllPlayers`. Ensure these stay consistent with parent logic; consider sharing a single `useTeamStats` hook across both to avoid divergence.
- Uses `vorpMetrics` from parent to compute `teamScoreAvg` for categories. Align semantics with how `SuggestedPicks` and `ProjectionsTable` display/weight scores.
- Depends on `pickOwnerOverrides` and `keepers` semantics set in `DraftSettings` → parent; grid rendering reflects those decisions visually.

**Potential Acceptance Tests (informal)**
- Sorting by each column orders rows correctly; toggling sort direction flips order.
- Keeper/traded pick flags render correct badges and ownership tooltips; current pick cell highlights as expected.
- Team name edit: clicking a name focuses input, Enter commits, Escape cancels, blur after 100ms commits change; parent receives `onUpdateTeamName` with trimmed value.
- Category totals and VORP cells match sums reported by parent `teamStats` for the same players.

This single document will accumulate file-by-file findings and cross-references for the Draft Dashboard feature.

---

## DraftDashboard.tsx

- Summary: Top-level orchestrator for the draft experience. Manages session state, projections ingestion (skaters/goalies + custom CSV), team/draft flow, VORP metrics, and passes rich props to child components.

**Props**
- Component: `DraftDashboard`: no incoming props (root container).
- Outbound (to children):
  - `DraftSettings`: `settings`, `onSettingsChange`, `isSnakeDraft`, `onSnakeDraftChange`, `myTeamId`, `onMyTeamIdChange`, undo/reset handlers, history, `draftedPlayers`, `currentPick`, `customTeamNames`, `forwardGrouping`, `onForwardGroupingChange`, source controls (skater/goalie), goalie scoring, modal openers, `customSourceLabel`, available stat keys, CSV export handler, custom-source removal, traded-picks & keepers handlers and data, `playersForKeeperAutocomplete`, `customSourceResolutions`, bookmark create/import handlers.
  - `SuggestedPicks`: `players`, `vorpMetrics`, need-weight toggles and alpha, `posNeeds`, `currentPick`, `teamCount`, `baselineMode`, `nextPickNumber`, `onDraftPlayer`, `canDraft`, `leagueType`, `catNeeds`, `rosterProgress`, personalize replacement toggles.
  - `DraftBoard`: `draftSettings`, `draftedPlayers`, `currentTurn`, `teamStats`, `isSnakeDraft`, `availablePlayers`, `allPlayers`, `onUpdateTeamName`, `pickOwnerOverrides`, `keepers`, `vorpMetrics`.
  - `MyRoster`: `myTeamId`, `teamStatsList`, `draftSettings`, `availablePlayers`, `allPlayers`, `onDraftPlayer`, `onMovePlayer`, `canDraft`, `currentPick`, `currentTurn`, `teamOptions`, `vorpMetrics`, need-weight toggles and alpha, `posNeeds`, `forwardGrouping`.
  - `ProjectionsTable`: `players`, `allPlayers`, `draftedPlayers`, `isLoading`, `error`, `onDraftPlayer`, `canDraft`, `vorpMetrics`, `replacementByPos`, `baselineMode`, `onBaselineModeChange`, `expectedRuns`, need-weight toggles and alpha, `posNeeds`, `nextPickNumber`, `leagueType`, `forwardGrouping`, enabled skater/goalie stat keys.
  - `DraftSummaryModal`: `isOpen`, `onClose`, `draftSettings`, `draftedPlayers`, `teamStats`, `allPlayers`, `vorpMetrics`.
  - `ImportCsvModal`: `open`, `onClose`, minimum coverage/name-fallback, `onImported` (persists CSV to session and toggles sources).

**Dependencies**
- External: `react` (hooks), browser APIs (`localStorage`, `sessionStorage`, `Blob`, `URL`, `window.addEventListener`), `console` logging.
- Project libs/hooks:
  - `hooks/useProcessedProjectionsData`, types `ProcessedPlayer`, `CustomAdditionalProjectionSource`.
  - `hooks/useVORPCalculations` (VORP, replacement, expected runs).
  - `hooks/useCurrentSeason`.
  - `lib/projectionsConfig/*`: `getDefaultFantasyPointsConfig`, `PROJECTION_SOURCES_CONFIG`.
  - `lib/supabase` (passed into projections hook).
- Internal components: `DraftSettings`, `DraftBoard`, `MyRoster`, `ProjectionsTable`, `SuggestedPicks`, `DraftSummaryModal`, `ImportCsvModal`, CSS module `DraftDashboard.module.scss`.

**Data Flows**
- Projections ingestion:
  - Two calls to `useProcessedProjectionsData` (skater/goalie), configured via `sourceControls`/`goalieSourceControls`, league settings, season, and custom CSV sources from `sessionStorage` list `draft.customCsvList.v2`.
  - Custom CSV rows are split by position (skater vs goalie) and mapped to standardized stat keys. Name-fallback and per-source coverage drive UI banners.
- Aggregation:
  - `skaterPlayers` + `goaliePlayers` -> `allPlayers`.
  - `availablePlayers` filters `allPlayers` by `draftedPlayers` via a Set.
- Metrics:
  - `useVORPCalculations` consumes `allPlayers`, `availablePlayers`, settings, picks-until-next, `baselineMode`, `forwardGrouping`, `personalizeReplacement`, `prorate82` -> returns `vorpMetrics` Map, `replacementByPos`, `expectedTakenByPos`, `expectedN`.
- Team/draft state:
  - `draftSettings`, `currentPick`, `isSnakeDraft`, `myTeamId`, `draftedPlayers`, `positionOverrides`, traded-pick owner overrides, `keepers`, custom team names.
  - `currentTurn` computed from `currentPick`, snake logic, and overrides.
  - `teamStats` derives per-team roster slot fills, bench, projected points, category totals, and `teamVorp` by summing `vorpMetrics` for drafted players.
  - `posNeeds` and `catNeeds` derived from `teamStats`; `rosterProgress` for progress bar.
- Persistence/session:
  - Snapshot V2 persisted to `sessionStorage` key `draft.snapshot.v2` (contains nearly all draft state incl. controls and CSV list). Prompt to resume on mount.
  - Legacy session V1 in `localStorage` (`draftDashboard.session.v1`) also has a resume prompt, but see note under Efficiency.
  - Several independent localStorage flags: `forwardGrouping`, `personalizeReplacement`, `baselineMode`, `needWeightEnabled`, `needAlpha`, `projections.prorate82`.
- UI interactions:
  - `draftPlayer`, `undoLastPick`, `resetDraft`, `assignPlayerToSlot`.
  - Auto-skip already drafted picks (keepers) by advancing `currentPick`.
  - Keyboard shortcuts: U (undo), S (summary), N (need-weight toggle), B (baseline toggle).
  - Data refresh button bumps `refreshKey` to re-query projections.
  - CSV export builds a blended projections file from `allPlayers`.

**Efficiency Gaps & Recommendations**
- Repeated lookups by ID:
  - Pattern: `allPlayers.find(p => String(p.playerId) === draftedPlayer.playerId)` inside loops (e.g., building `teamStats`). This is O(n) per lookup and becomes O(n·m) for `m` drafted players per team.
  - Recommendation: Memoize `playerById` as `Map<string, ProcessedPlayer>` via `useMemo` and replace all `.find` usages with O(1) map lookups. Expectably reduces `teamStats` and category aggregation cost significantly.
- CSV list access cost:
  - `getCsvList()` reads/parses `sessionStorage` during render to build `customAdditionalSources` for both hooks. This runs every render.
  - Recommendation: Hoist a `csvList` state with initial read + dedicated setters. Pass `csvList` into hooks and update `refreshKey` when list changes. This avoids repeated storage I/O and JSON parsing.
- Duplicate resume gate:
  - Two mount effects check `resumeAttemptedRef`. The first (Snapshot V2) sets the ref, which prevents the second (Legacy V1) from ever running. If that’s intentional (V2 supersedes V1), consider removing the second effect or separating refs with clear precedence logic. If not intentional, use distinct refs or a single consolidated resume flow with precedence: V2 -> V1.
- Allocation churn in derived arrays/sets:
  - `availableSkaterStatKeys`/`availableGoalieStatKeys` rebuild large sets each time `allPlayers` changes. This is acceptable, but if costly in practice, consider computing once per processed results or doing it server-side during `useProcessedProjectionsData`.
- Console logging in hot path:
  - Multiple `console.log`/`console.warn` run on every render or data change (debug traces). Gate by `process.env.NODE_ENV !== 'production'` or behind a `debug` flag.
- Team stats assembly:
  - `teamPlayers` per team could be computed once via a `Map<teamId, DraftedPlayer[]>` before iterating teams. This avoids repeated filters.
- Auto-skip effect:
  - The auto-advance of `currentPick` on keepers can produce many re-renders when initializing large keeper sets. Consider a while-loop within a single effect pass or precomputing the next available pick.
- Storage writes:
  - Many independent effects write to `localStorage`/`sessionStorage`. Batch writes and/or debounce to reduce synchronous main-thread cost. A custom `usePersistedState` could centralize this.
- Monolith component size:
  - Consider extracting logic into hooks: `useDraftPersistence`, `useCsvSources`, `useTeamStats(playerById, draftedPlayers, settings)`, `useUiShortcuts`. This will improve readability and potentially memoization boundaries.

**Actionable Improvements (to implement post-audit)**
- Player index map:
  - Create `const playerById = useMemo(() => new Map(allPlayers.map(p => [String(p.playerId), p])), [allPlayers]);` and replace all `allPlayers.find(...)` lookups within `teamStats`, `teamVorp` sums, and keeper handling with `playerById.get(id)`.
- Group drafted players by team once:
  - Before mapping `teamStats`, build `const draftedByTeam = useMemo(() => { const m = new Map<string, DraftedPlayer[]>(); draftedPlayers.forEach(dp => { const a = m.get(dp.teamId) || []; a.push(dp); m.set(dp.teamId, a); }); return m; }, [draftedPlayers]);` and then use `draftedByTeam.get(teamId) || []`.
- Hoist CSV list from storage to state:
  - Replace ad-hoc `getCsvList()`/`setCsvList()` with `const [csvList, setCsvList] = useState<SessionCsvEntry[]>(() => initialReadFromSession());` and update the projections hooks’ `customAdditionalSources` to depend on `csvList`. Write back to storage only when `csvList` changes.
- Consolidate session resume flows:
  - Prefer Snapshot V2. Remove or gate the Legacy V1 resume effect behind a check that V2 didn’t resume. Alternatively, merge into a single `useDraftPersistence` hook with precedence V2 -> V1 and a single `resumeAttemptedRef`.
- Reduce storage write frequency:
  - Batch related flags into a single object and persist via a debounced effect (e.g., 200ms) or a custom `useDebouncedLocalStorage(key, value)`.
- Gate debug logging:
  - Wrap dev logs with `if (process.env.NODE_ENV !== 'production') { ... }` or a `const debug = false` flag to minimize noise and work in production.
- Optimize keeper auto-skip:
  - Replace the simple effect with a loop that advances `currentPick` until it reaches the next non-drafted pick within a single state update to avoid multiple renders on init with many keepers.
- Extract heavy logic to hooks:
  - `useTeamStats(playerById, draftedPlayers, draftSettings, vorpMetrics)`
  - `useCsvSources(csvList, setCsvList)` (adds/removes sources and triggers `refreshKey`)
  - `useUiShortcuts({ undoLastPick, setIsSummaryOpen, setNeedWeightEnabled, setBaselineMode })`

**Connections & Cross-References**
- First file in the audit; no prior connections. Establishes the data contract for: `DraftSettings`, `DraftBoard`, `MyRoster`, `ProjectionsTable`, `SuggestedPicks`, `DraftSummaryModal`, `ImportCsvModal`.
  - Key shared types/props to watch in subsequent files: `vorpMetrics` (Map by `playerId`), `replacementByPos`, `expectedRuns` shape, `availablePlayers` vs `allPlayers`, roster assignment (`positionOverrides` semantics), and CSV/custom-source surfaces.

**Potential Acceptance Tests (informal)**
- Changing `sourceControls` or importing CSV updates `allPlayers` and Suggested Picks without full page reload.
- Drafting, undo, keepers, and traded-pick overrides update `currentTurn`, `teamStats`, and `posNeeds` deterministically.
- Toggling `forwardGrouping` updates roster config and downstream needs/VORP behavior.
- Session resume works from Snapshot V2; legacy V1 is clearly deprecated or still functional depending on chosen strategy.

---

## MyRoster.tsx

- Summary: Team roster panel with player search/draft and a visual roster composition view. Supports viewing any team's roster, drafting a selected player via autocomplete, showing projected totals, and indicating eligible move targets for a selected rostered player. Prepares recommendation ranking via `usePlayerRecommendations` (state and sorting are wired), but no recommendations UI is currently rendered and the keyboard handler is not attached.

**Props**
- Inbound: `myTeamId`, `teamStatsList: TeamDraftStats[]`, `draftSettings`, `availablePlayers`, `allPlayers`, `onDraftPlayer(playerId)`, `onMovePlayer?(playerId, targetPos)`, `canDraft`, `currentPick`, `currentTurn` ({ round, pickInRound, teamId, isMyTurn }), `teamOptions`, `vorpMetrics?`, `needWeightEnabled?`, `needAlpha?`, `posNeeds?`, `forwardGrouping?`.
- Outbound: Calls `onDraftPlayer` when clicking Add Player; calls optional `onMovePlayer` when moving a selected roster player into an empty eligible slot.

**Dependencies**
- External: `react` hooks, browser `localStorage` for persisting suggested picks sort.
- Project: `PlayerAutocomplete`, `TeamRosterSelect`, CSS `MyRoster.module.scss`, types `DraftSettings`, `TeamDraftStats`, `DraftedPlayer` from `DraftDashboard`; `ProcessedPlayer` from `useProcessedProjectionsData`; `usePlayerRecommendations` and `PlayerVorpMetrics` from `useVORPCalculations`.

**Data Flows**
- Team selection: Local state `selectedViewTeamId` mirrors `myTeamId` when viewing self; can switch to any team via `TeamRosterSelect` or quick "My Team" button. Derives `selectedTeamStats` and `selectedTeamName` from `teamStatsList`/`teamOptions`.
- Player search/draft: `PlayerAutocomplete` receives a processed list of `allPlayers` (mapped to the autocomplete's expected shape) and an ADP map for sorting. Selecting populates `selectedPlayerId`; clicking Add triggers `onDraftPlayer` for the current team and resets selection.
- Recommendations (not rendered): `usePlayerRecommendations` consumes `availablePlayers`, `vorpMetrics`, `posNeeds`, `needWeightEnabled`, `needAlpha`, `currentPick`, and `teamCount` to compute `recommendations`. The component defines sort state (`recSortField`, `recSortDir`) and keyboard navigation helpers (`selectedRecId`, `onRowKeyDown`), but there is no JSX rendering a list or table yet.
- Roster progress: Computes `totalRosterSpots` from `draftSettings.rosterConfig`; `currentPlayerCount` from `selectedTeamStats.rosterSlots` and `bench`. Renders progress bar and summary cards.
- Roster composition: For each position in `positionsToShow` (respects `forwardGrouping` and treats `UTILITY` specially), renders slot cards up to the max count from `rosterConfig`. Click behavior: clicking a filled slot selects that player for potential move; clicking an empty, eligible target slot invokes `onMovePlayer(selected.playerId, pos)` and clears selection.
- Eligibility logic: Determines eligible target positions from a player's `eligiblePositions` or `displayPosition`, merges forwards into `FWD` when grouping is on, and allows all skaters to move to `UTILITY` when present; goalies cannot move to `UTILITY`.
- Bench: Renders bench slots with player names; no move interactions in current implementation.

**Efficiency Gaps & Recommendations**
- Unused recommendations UI:
  - State and handlers for recommendations (sorting, selected item, keyboard nav) are present, but no DOM renders them and `onRowKeyDown` is not attached.
  - Recommendation: Either remove the dead code or add a minimal Recommendations table with attached keyboard handler, or integrate into an existing panel.
- Player mapping per render:
  - `playersOverride` for `PlayerAutocomplete` is rebuilt on every render and `adpByPlayerId` scans `allPlayers` to build an object map.
  - Recommendation: Memoize `playersOverride` and reuse the same memo for `adpByPlayerId`. Consider moving these to a shared hook if multiple components need them.
- Recommendations sorting stability:
  - Sorting calls `arr.sort` even when `recSortField === 'rank'`, returning `0` and doing needless work.
  - Recommendation: Skip sorting for `'rank'` to preserve incoming order from the hook and avoid extra allocations.
- Keyboard navigation index lookup:
  - Rebuilds `ids` array and uses `indexOf` on every keydown.
  - Recommendation: Cache `ids` in `useMemo` and track a numeric `selectedIndex`; derive `selectedRecId` from index.
- Inline handlers for many slots:
  - Closures created for each slot cell may churn with frequent renders.
  - Recommendation: Extract `RosterSlot` and `BenchSlot` components with stable props or use `useCallback` with positional args.
- LocalStorage writes on every sort tweak:
  - Persisting `recSortField` and `recSortDir` immediately is fine but can be debounced.
  - Recommendation: Debounce writes or batch into a single key (e.g., `{ field, dir }`).

**Actionable Improvements (to implement post-audit)**
- Memoize heavy derived props:
  - `const playersOverride = useMemo(() => allPlayers.map(p => ({ id: Number(p.playerId), fullName: p.fullName })), [allPlayers]);`
  - `const adpByPlayerId = useMemo(() => Object.fromEntries(allPlayers.filter(p => Number.isFinite(p.yahooAvgPick)).map(p => [p.playerId, p.yahooAvgPick!])), [allPlayers]);`
- Render or remove recommendations:
  - Option A: Add a compact table listing top `recommendations` with sortable headers and attach `onKeyDown` for ArrowUp/Down.
  - Option B: Remove the unused recommendation state and handlers until the UI is ready to avoid confusion.
- Respect `canDraft` and turn state:
  - Disable the Add button when `!canDraft` or `!currentTurn.isMyTurn` to prevent accidental drafting.
- Strengthen eligibility logic helper:
  - Extract a `getEligibleTargets(player, currentPos, forwardGrouping, hasUtility)` helper to centralize the logic and reuse in future drag-and-drop.
- Extract slot components:
  - Create memoized `RosterSlot`/`BenchSlot` to reduce re-renders and isolate click logic.

**Connections & Cross-References**
- Consumes `teamStatsList`, `draftSettings`, and `currentTurn` from `DraftDashboard.tsx`; move operations should align with the parent’s `assignPlayerToSlot` semantics to keep `rosterSlots` consistent.
- Shares `vorpMetrics`, `posNeeds`, and forward grouping behavior with `SuggestedPicks` and `ProjectionsTable`. Ensure position naming (`FWD` vs `C/LW/RW` vs `UTILITY`) remains consistent across components.
- `TeamRosterSelect` options originate from parent team name state; editing team names in `DraftBoard` should reflect here via `teamOptions`.

**Potential Acceptance Tests (informal)**
- Searching and selecting a player enables the Add button; clicking adds to the active team, clears selection, and decrements availability from `availablePlayers` upstream.
- Switching the view team updates roster composition and progress counts; My Team button jumps back to `myTeamId`.
- Selecting a rostered player highlights eligible empty slots; clicking an eligible empty slot moves the player and clears selection (fires `onMovePlayer`).
- If a Recommendations panel is added: sorting and navigating updates selection with ArrowUp/Down and persists across reload via localStorage.

---

## SuggestedPicks.tsx

- Summary: Renders a ranked set of suggested picks using `usePlayerRecommendations`, with optional availability estimation, roster-need adjusted VORP, multi/single position filters, keyboard shortcuts, and the ability to draft directly from cards. Provides a roster progress bar that doubles as a multi-select position filter.

**Props**
- Inbound: `players` (available only), `vorpMetrics?`, `needWeightEnabled?`, `needAlpha?`, `posNeeds?`, `currentPick`, `teamCount`, `baselineMode?`, `nextPickNumber?`, `defaultLimit?`, `onSelectPlayer?`, `leagueType?`, `catNeeds?`, `rosterProgress?`, `onDraftPlayer?`, `canDraft?`, `personalizeReplacement?`, `onPersonalizeReplacementChange?`.
- Outbound: `onSelectPlayer` on selection change, `onDraftPlayer` when drafting from a card, `onPersonalizeReplacementChange` from PR toggle.

**Dependencies**
- External: `react` hooks, browser `localStorage` for persistent UI prefs.
- Project: `usePlayerRecommendations` (core ranking), types `ProcessedPlayer`, `PlayerVorpMetrics`, CSS `SuggestedPicks.module.scss`.

**Data Flows**
- Recommendations: Uses `usePlayerRecommendations` with `players`, `vorpMetrics`, `posNeeds`, `needWeightEnabled`, `needAlpha`, `currentPick`, `teamCount`, and optional `leagueType`/`catNeeds`; requests a large limit (200), then applies sorting/filters locally and slices to `limit`.
- Availability: Computes `availability` per recommendation via Normal CDF using `nextPickNumber` and `riskSd` (synced with `ProjectionsTable` via localStorage key `projections.riskSd`).
- Roster-adjusted VORP: Optional client-side multiplier (`rosterVorpEnabled`) scales VORP by average positional needs across a player's eligible positions.
- Filters & sorting: Supports single-select `posFilter` and multi-select `selectedPositions` via the roster bar. Sorts by rank/projFp/vorp/vbd/adp/avail/fit with direction toggle.
- Selection & draft: Clicking a card toggles selection and calls `onSelectPlayer`. Keyboard: ArrowLeft/Right move selection; Enter or "d" drafts if `onDraftPlayer` is provided.
- Roster bar: Displays progress per position; clicking toggles inclusion in `selectedPositions` (UTIL acts as reset to ALL) and keeps the dropdown at ALL.
- Preferences: Persists sort, dir, pos filters (single and multi), limit, collapsed, roster bar visibility, and rosterVorpEnabled to localStorage.

**Efficiency Gaps & Recommendations**
- Double computation of risk model:
  - SuggestedPicks maintains its own Normal CDF for availability separate from ProjectionsTable.
  - Recommendation: Extract a shared utility (e.g., `lib/value/risk.ts`) and memoize by `adp` and `nextPickNumber` to ensure consistency and reduce duplication.
- Sorting with constant-return for rank:
  - When `sortField === 'rank'`, comparator returns 0 but still invokes Array.sort.
  - Recommendation: Skip sorting for `'rank'` to preserve hook order and avoid unnecessary work.
- Position parsing in filters:
  - Repeated string splits and case handling.
  - Recommendation: Normalize/canonicalize eligible positions in the player model (once) and reuse across components; or memoize a `posListById` map here.
- Keydown listener:
  - Global window keydown may conflict with other panels and fires when focus is in inputs unless guarded.
  - Recommendation: Scope to component container with `onKeyDown` (already used for arrows/draft); limit global keys or add a feature flag.
- LocalStorage writes:
  - Many individual writes; acceptable but can be batched with a debounced `prefs` object.
- Availability clamp values:
  - Clamps to [0.01, 0.99]; might prefer [0,1] and render UI edge cases explicitly.
- Draft button enablement:
  - Cards always show Draft; guard by `canDraft` and possibly disable when not your turn to avoid misclicks.

**Actionable Improvements (to implement post-audit)**
- Share risk helper:
  - Factor `normalCdf` and availability computation into a shared util used by both SuggestedPicks and ProjectionsTable; memoize results by `(adp, nextPickNumber, sd)`.
- Skip no-op sort:
  - If `sortField === 'rank'`, return `filtered` as-is without calling `.sort`.
- Respect `canDraft`:
  - Disable the Draft link/button when `!canDraft`; show a tooltip hint.
- Memoize positions:
  - `const posListById = useMemo(() => new Map(players.map(p => [String(p.playerId), (p.displayPosition||'').split(',').map(s=>s.trim().toUpperCase())])), [players]);` and use for filters and rosterVorp calculation.
- Batch prefs persistence:
  - Debounce saving `{ sortField, sortDir, posFilter, selectedPositions, limit, collapsed, showRosterBar, rosterVorpEnabled }` into a single localStorage key.
- Align replacement personalization:
  - Indicate visually when `personalizeReplacement` is active; optionally derive a subtle tag in reasonTags.

**Connections & Cross-References**
- Directly complements `ProjectionsTable.tsx`; both use risk and VORP semantics and should stay in sync (shared util recommended).
- Position semantics and grouping should remain consistent with `MyRoster.tsx` and `DraftDashboard.tsx` (forward grouping in parent may affect eligible positions).
- Consumes and signals toggles that impact `useVORPCalculations` in the parent (baseline and personalize replacement paths).

**Potential Acceptance Tests (informal)**
- Toggling NeedV updates card VORP values when rosterVorpEnabled; disabling reverts to base VORP.
- Changing risk SD in ProjectionsTable updates availability percentages shown here (via localStorage sync).
- Multi-select via roster bar filters cards; UTIL segment clears filters.
- Draft action fires `onDraftPlayer`; disabled when `!canDraft`.

---

## ImportCsvModal.tsx

- Summary: CSV import modal for custom projection sources. Parses headers and rows, standardizes column names, previews mapped rows, and resolves player names to internal `player_id` using DB lookups (Supabase), deterministic rules, fuzzy matching, and optional manual overrides. Gated by coverage thresholds with options to require full mapping or force import.

**Props**
- Inbound: `open`, `onClose`, `minimumCoveragePercent = 25`, `allowNameFallback = true`, `onFallbackSettingsChange?({ allowCustomNameFallback, minimumCoveragePercent })`, `onImported({ headers, rows, sourceId, label, resolution })`.
- Outbound: Calls `onFallbackSettingsChange` when confirming; calls `onImported` with `sourceId: "custom_csv"`, the standardized `headers`, fully mapped `rows` (adds `player_id`), user `label` (source name), and `resolution` stats.

**Dependencies**
- External: `react` hooks, `papaparse` (CSV parsing), `react-dropzone` (file input), `supabase` (players lookup), browser focus/keyboard handling.
- Project: `standardizePlayerName`, `standardizeColumnName`, `defaultCanonicalColumnMap` (canonical keys), `teamsInfo` (id/abbr maps).

**Data Flows**
- Parse & headers: Dropzone → Papa.parse with `header: true` and `dynamicTyping`. Builds `headers: { original, standardized, selected, status }` via `standardizeColumnName` and classification: `required` (must include) vs `supported` vs `unsupported`.
- Preview & mapping: Maintains `rawRows` (first 50) and `allRows` (entire file). Builds `mappedPreview` and `mappedAllRows` by re-keying selected headers to canonical names; player column is normalized via `standardizePlayerName`.
- Player index: On open, paginates `players` from Supabase (id, fullName, lastName, position, team_id) and derives `teamAbbrev` via `teamsInfo`. Secondary fetch pulls any missing last names found in the CSV. Indexes: `ids`, `byId`, `byStdName`, `byTeamAbbrev`.
- Resolution (per row):
  - Extracts standardized `Player_Name`, detects any numeric `playerId` column(s), parses optional team from `Team_Abbreviation`.
  - Priority: manual override → exact `player_id` present in roster → single std-name match → multi-match filtered by team → fuzzy by Levenshtein within team candidates (threshold ≤2).
  - Writes `player_id` (and any `playerId`-like columns) on success; else deletes them and records in `__resolution` with `method`, `stdKey`, `team`, `invalidOriginalId`.
  - Accumulates stats: `idMatched`, `nameMatched`, `fuzzyMatched`, `manualOverrides`, `invalidIds`, `unresolved`, `coverage`.
- Ambiguities: Aggregates names that map to multiple DB players (mostly by last name) and suggests best candidate by normalized Levenshtein score. Auto-resolves unique perfect matches; supports explicit Yes/No, select box, and live search per name.
- Coverage gates: Local `allowNameFallback` and `minimumCoveragePercent` mirror props. Confirm is disabled if below threshold or unresolved rows exist, unless "Enable anyway" is toggled. `Require full mapping` enforces 100% coverage.
- Confirm: Persists fallback settings via `onFallbackSettingsChange`, emits `onImported` with rows, headers, label, and stats, then closes.
- Accessibility: Dialog role with aria attributes, focus trap with Tab wrapping, Escape to close, and keyboard-safe controls.

**Efficiency Gaps & Recommendations**
- Full-table prefetch: Fetches all players (paged) on open, then a secondary `in(lastName)` query. For large tables this is heavy.
  - Recommendation: Pre-scan CSV last names first, then fetch only candidates via one or few `in(lastName)` calls (chunked), optionally also `ilike(fullName)` for rare cases. Avoid full-table scan.
- Resolution on main thread: Name→ID resolution runs over entire dataset with multiple passes and string ops; fuzzy matches call Levenshtein repeatedly.
  - Recommendation: Move resolution to a Web Worker for large files; post back progress and results. Alternatively, gate expensive fuzzy matching behind a toggle or limit to rows still unresolved after exact/team filtering.
- Ambiguity keying by name only: `ambiguousChoices` is keyed by canonical name, so a single choice applies to all rows with that name, regardless of CSV team.
  - Recommendation: Key overrides by a compound key, e.g., `${name}|${csvTeamAbbrev||''}|${csvPos||''}`, or by row index. Reflect this in the UI labels and in `resolution` to disambiguate same-name players on different teams.
- `allowNameFallback` semantics: The algorithm always attempts name/fuzzy matching regardless of `allowNameFallback`; the flag only affects messaging.
  - Recommendation: Honor the flag: when false, treat only rows with valid `player_id` as resolved; skip name/fuzzy paths and reflect that in coverage/stats and import rows.
- Duplicate state and copies: Maintains both `allRows` and `rawRows`, and re-maps arrays multiple times.
  - Recommendation: Keep only `allRows`; derive preview via `allRows.slice(0, 50)`. Memoize mapping once per header/player column change.
- Supabase shape: Converts `team_id` to `teamAbbrev` client-side repeatedly.
  - Recommendation: Request `team_id` and compute abbrev once while building the index; store in the index record only.
- Logging noise: Multiple `console.log` for target players and counts.
  - Recommendation: Gate debug logs behind a `DEBUG` flag or `process.env.NODE_ENV !== 'production'`.

**Actionable Improvements (to implement post-audit)**
- Optimize player fetch path:
  - Pre-read CSV to collect unique last names; query Supabase with `in('lastName', names)` in chunks (e.g., 200 each). Skip initial full-table pagination.
- Respect fallback flag:
  - Add `if (!localAllowFallback) { … }` branch in resolution to bypass name/fuzzy matching and only accept valid `player_id` hits. Update coverage and UI copy accordingly.
- Row-scoped overrides:
  - Change `ambiguousChoices` to use a compound key including CSV team/pos (or row index). Update UI to display and set overrides per distinct key.
- Offload heavy work:
  - Introduce a worker (`/workers/csvResolver.ts`) to compute mapping and stats for large files, posting progress to the UI (e.g., every 1k rows).
- Single mapping memo:
  - Replace duplicate mapping of preview and full arrays with one `useMemo` that returns both `mappedAll` and `mappedPreview` from the same computation.
- Import UX polish:
  - Add a Clear File button; persist `sourceName` alongside the session CSV list to show consistent labels in `DraftSettings`.

**Connections & Cross-References**
- `DraftDashboard.tsx`: Consumes `onImported` payload to append to `draft.customCsvList.v2` in session and trigger reprocessing in `useProcessedProjectionsData`. Coverage and fallback settings should influence source weights and warnings in parent.
- `DraftSettings.tsx`: Displays custom source label and removal; consider passing a `getCustomSourceLabel` down from parent to avoid direct storage reads in Settings.
- `useProcessedProjectionsData`: Expects canonical stat keys defined by `defaultCanonicalColumnMap`. Ensure standardized headers match what the processor supports for both skaters and goalies.

**Potential Acceptance Tests (informal)**
- Header mapping: Unsupported headers get flagged; required headers (`Player_Name`, `Team_Abbreviation`, `Position`, `Goals`, `Assists`) must be present or confirmation blocks.
- ID-first resolution: Rows with valid `player_id` resolve via id; invalid ids are repaired via name/team matching and counted under `invalidIds`.
- Fallback off: With `allowNameFallback = false`, only rows with valid `player_id` are considered resolved; coverage reflects this and import is gated appropriately.
- Ambiguities: Duplicate-name rows surface suggestions; auto-resolve unique perfect matches; manual selection updates mapping and coverage.
- Coverage gates: Below-threshold or unresolved rows disable Confirm until "Enable anyway" or 100% mapping when required.
- Payload shape: `onImported` receives `headers`, `rows` with `player_id`, `sourceId: 'custom_csv'`, `label`, and `resolution` matching on-screen summary.

---

## DraftSummaryModal.tsx

- Summary: Shareable end-of-draft recap modal that renders either a roster grid per team or a picks recap board. Computes highlights (biggest steal/reach by ADP and top VORP pick), a simple weighted draft winner metric, and exports the visible summary to a PNG via html-to-image.

**Props**
- Inbound: `isOpen`, `onClose`, `draftSettings`, `draftedPlayers`, `teamStats`, `allPlayers`, `vorpMetrics?`.
- Outbound: No callbacks beyond `onClose`; image export is client-side via DOM.

**Dependencies**
- External: `react` hooks, `html-to-image` (`toPng`), `next/image` for a medal image, CSS module `DraftSummaryModal.module.scss`.
- Project types: `DraftSettings`, `DraftedPlayer`, `TeamDraftStats` from `DraftDashboard`; `ProcessedPlayer` and `PlayerVorpMetrics`.

**Data Flows**
- `playerMap`: Memoized `Map<string, ProcessedPlayer>` keyed by `playerId` for O(1) lookup during rendering and highlight computation.
- `sortedTeams`: Takes up to `teamCount` teams from `teamStats`, sorts by `projectedPoints` desc, adds 1-based `rank`.
- `teamsInDraftOrder`: Reorders `sortedTeams` to match `draftSettings.draftOrder` while preserving computed ranks.
- `chunkedRosters`: Splits teams into rows of `MAX_TEAMS_PER_ROW` for grid layout.
- `picksByTeam`: Groups `draftedPlayers` by `teamId`, sorts each group by `pickNumber` to align recap columns by round.
- `totalRounds`: Computes as `ceil(draftedPlayers.length / teamCount)` to size recap columns.
- `highlights`: Scans all picks to determine:
  - Biggest Steal/Reach by delta = `overallPick - ADP` using `yahooAvgPick` or `adp` when present.
  - Top VORP pick using `vorpMetrics.get(playerId)?.vorp` when provided.
- `draftWinner`: Combines normalized projectedPoints (60%) and teamVorp (40%) across teams to compute a simple composite score and selects the max.
- Rendering:
  - Roster view: Table per team showing slots for C/LW/RW/D/UTIL/G and Bench with pick metadata.
  - Recap view: Colored cells per round with position-coded classes inferred from first token of `displayPosition`.
- Export: `downloadImage()` captures the `.content` container to PNG with background color, `pixelRatio: 2`, and `skipFonts: true`, triggers a download.

**Efficiency Gaps & Recommendations**
- Rounds label mismatch: Header shows "Rounds" as the sum of `rosterConfig` counts, while recap uses `totalRounds` derived from `draftedPlayers`.
  - Recommendation: Display `totalRounds` consistently in the header for accuracy, and optionally include roster slots as a separate meta item.
- Large DOM capture: `toPng` on a big grid can be slow and memory-heavy.
  - Recommendation: Offer capture of the current view only (recap vs roster) and consider a lower `pixelRatio` with an option to upscale. Provide a spinner during export.
- Position class inference: Recomputes per cell.
  - Recommendation: Precompute a small map from first-position token to class or use a function with a memoized lookup object.
- Category vs points display: Leaderboard always sorts by `projectedPoints` and shows a fixed set of skater categories.
  - Recommendation: In categories leagues, consider ranking by composite category standings or show additional goalie/category columns based on `leagueType` and available stats.
- Winner formula rigidity: Uses fixed 60/40 weighting.
  - Recommendation: Expose weighting in UI or compute from league type (e.g., increase VORP share in categories if appropriate) and show a short tooltip explaining the score.
- Accessibility & controls:
  - Modal lacks explicit `role="dialog"`, focus management, and Escape handling.
  - Recommendation: Add `role`, `aria-modal`, focus trap and an Escape key listener consistent with other modals.

**Actionable Improvements (to implement post-audit)**
- Header accuracy: Replace roster-slot sum with `totalRounds` and add a separate "Roster Spots per Team" indicator.
- Export UX: Show a brief loading indicator during PNG render; catch and toast errors. Add an option to export the other view without toggling.
- Dynamic leaderboard: Toggle columns based on `leagueType`; include goalie metrics for goalie-heavy leagues. Optionally colorize ranks by percentile.
- Position class map: `const posClassMap = { C: styles.posC, LW: styles.posLW, RW: styles.posRW, D: styles.posD, G: styles.posG, UTIL: styles.posUTIL }` and use a helper.
- Winner explanation: Add a hover tooltip or small legend describing the 60/40 formula with min-max normalization.
- Modal a11y: Align with `ImportCsvModal` focus/keydown patterns; add `aria-labelledby` and initial focus.

**Connections & Cross-References**
- `DraftDashboard.tsx`: Supplies `teamStats`, `draftedPlayers`, `draftSettings`, `allPlayers`, and `vorpMetrics`. Winner logic and ranks should align with leaderboard/board semantics in `DraftBoard.tsx`.
- `DraftBoard.tsx`: Both render team standings; ensure projectedPoints, category totals, and `teamVorp` values match across views.
- `useVORPCalculations`: `vorpMetrics` used for Top VORP pick; keep metric definitions consistent with `ProjectionsTable` and `SuggestedPicks` displays.

**Potential Acceptance Tests (informal)**
- Toggling Recap/Roster updates the grid and keeps highlights/leaderboard intact.
- Download PNG produces a readable image of the visible content; no CORS font errors; file name includes today’s date.
- Highlights: Changing a pick to one with extreme ADP delta updates Biggest Steal/Reach; providing `vorpMetrics` updates Top VORP pick.
- Leaderboard: Top 3 rows styled gold/silver/bronze; ordering matches sort by projectedPoints.

---

## useProcessedProjectionsData.tsx

- Summary: Core ingestion/processing hook that blends multiple projection sources (built-ins + custom CSV), enriches with ADP/mappings constrained by `CURRENT_YAHOO_GAME_PREFIX`, computes combined stats, and prepares table-friendly `ProcessedPlayer` rows. Supports injecting round summary rows and pulls actual season totals from Supabase for diffs.

**Inputs/Outputs**
- Inbound (props object): active sources (built-in + `CustomAdditionalProjectionSource[]`), season/game prefix, league type, enabled stat keys, forward grouping, and options for round summaries and caching.
- Outbound: `{ players, allPlayers, isLoading, error, availableSkaterStatKeys, availableGoalieStatKeys, ... }` (names inferred from usage in parent/components).

**Pipeline**
- Source fetch: `fetchAllSourceData(supabaseClient, activeSourceConfigs, uniqueNhlPlayerIds, type, currentSeasonId, ...)` paginates via `fetchAllSupabaseData` with `SUPABASE_PAGE_SIZE=1000` and label/timing logs. Applies per-source stat-key mappings.
- Merge & standardize: Collates per-player stat entries into `combinedStats` with projected/actual placeholders and attaches metadata (ADP, team, positions). `stdName` ensures consistent name lookups.
- Actuals: Defines `ACTUAL_*_STATS_TABLE` + `ACTUAL_STATS_COLUMN_MAP` to pull last-season totals and compute `% diff` via `calculateDiffPercentage`.
- Round summaries: `addRoundSummariesToPlayers(sortedPlayers, calculateDiffFn, teamCount)` injects summary rows between players for UI grouping.
- Caching: Exposes snapshot info types for cache layers (`CachedBasePlayerData`, `CachedFullPlayerData`).

**Efficiency Gaps & Recommendations**
- Supabase paging: Multiple full-table loads per source can be costly.
  - Recommendation: Narrow selects; prefer `in(nhl_player_id, ids)` when CSV/name-matched maps are available; chunk queries to reduce bandwidth.
- Key-mapping cost: Per-source stat remap repeated across renders.
  - Recommendation: Pre-compile mapping functions per source and memoize by config hash to reduce object churn.
- Actuals joins: Fetch and join actual stats per player can be heavy.
  - Recommendation: Cache actuals per season in `sessionStorage` with ETag-like key; only refetch on season change or explicit refresh.
- Name index: `stdName` runs broadly; avoid repeated normalization for the same strings.
  - Recommendation: Build a `Map<string,string>` normalization cache for hot paths; size-bound to avoid growth.
- Round summary injection: Increases array size and sort complexity for very large pools.
  - Recommendation: Make summary insertion lazy or behind a UI toggle to keep base arrays lean during heavy interactions.

**Actionables**
- Add a `debug` flag to gate timing logs; provide simple metrics for source fetch duration.
- Memoize per-source mapping functions; include hash of `ProjectionSourceConfig` in deps.
- Introduce a simple in-memory LRU for actuals/ADP joins keyed by `nhl_player_id`.
- Expose a `skipRoundSummaries` option and move summary insertion to the view layer.

**Connections**
- `DraftDashboard.tsx`: Primary consumer, drives players lists and enabled stat keys.
- `ProjectionsTable`/`ComparePlayersModal`: Depend on `availableSkaterStatKeys`/`availableGoalieStatKeys` and consistent stat naming.

---

## useProjectionSourceAnalysis.ts

- Summary: Manages source controls (enable/disable + integer weights 0–100), persists them to localStorage (v3), migrates legacy v2 float weights, and derives per-source normalized shares.

**State & Persistence**
- `controls: SourceControl[]` with `{ id, label, enabled, weight }`.
- Persistence: Debounced save to `LOCAL_KEY_V3` with change-detection to avoid redundant writes. Legacy migration from `LEGACY_KEY_V2` (0–2 floats) to integer 0–100 handled.
- Auto-reconcile: Ensures `initialSources` appear with defaults, drops missing sources.

**API**
- `setEnabled(id, enabled)`: Re-enabling restores last non-zero weight via `lastNonZeroWeightRef` (min 1%).
- `setWeight(id, weight)`: Sets weight and auto-enables when >0; disables when 0.
- `removeSource(id)`: Hard-removes a source.
- `effectiveShares`: Normalized shares across enabled, weight>0 sources; 0 when none enabled.

**Efficiency & UX Notes**
- Debounced persistence: Good; 180ms likely sufficient. Consider grouping with other settings to a single namespace key.
- Last-weight restore: Solid UX; ensure ref is hydrated when migrating legacy data.

**Actionables**
- Add validation to cap weights [0,100]; coerce invalid values from legacy payloads.
- Provide a hook return for `saveInProgress` to show a subtle saving indicator near sliders.
- Add optional `onChange(controls, effectiveShares)` callback for analytics or external sync.

**Connections**
- `DraftSettings.tsx`: UI for sliders/toggles; uses `effectiveShares` to show normalized percent.
- `useProcessedProjectionsData`: Consumes `effectiveShares`/enable flags to weight-blend source stats.

---

## projectionWeights.ts

- Summary: Integer-based helpers for distributing and normalizing source weights.

**Functions**
- `evenlyDistribute(count)`: Returns integer array summing to 100; early indices get +1 remainder.
- `normalizeWithAnchor(weights, anchorIndex)`: Preserves anchor’s value exactly, scales others proportionally to sum to 100 (last non-anchor absorbs drift; anchor bounded at 100 if overweight).
- `normalize(weights)`: Picks first positive weight as anchor (or 0) and normalizes.

**Edge Cases & Guarantees**
- Empty arrays → `[]`; negative/oversized anchor indexes coerced to 0.
- If `othersTotal <= 0`, all weight to anchor (capped at 100), others 0.
- Rounding drift corrected deterministically to largest non-anchor (or anchor).

**Actionables**
- Add unit tests for drift handling and anchor overweight scenarios.
- Provide a `clampWeights` helper to coerce external inputs into [0,100] before normalize.

---

## fantasyPointsConfig.ts

- Summary: Default fantasy point weights for skaters and goalies, plus `getDefaultFantasyPointsConfig` to select a baseline by player type.

**Notes**
- Keys should match `STATS_MASTER_LIST` keys. Non-listed stats default to 0. Skaters and goalies separated.

**Actionables**
- Document any league presets (e.g., Yahoo standard) and expose a merge helper to overlay custom values cleanly.
- Consider versioning the defaults to aid migrations and user education.

---

## projectionSourcesConfig.ts

- Summary: Schema for projection sources and stat mappings. Each source declares where to fetch, which stats it provides, and how to map to canonical keys.

**Key Types**
- `SourceStatMapping`: Per-stat mapping config (project-specific fields omitted here).
- `ProjectionSourceConfig`: Source metadata, table names, stat maps, skater/goalie type, and weightability.

**Actionables**
- Keep mappings centralized and validated at startup; log missing/unknown keys vs `STATS_MASTER_LIST`.
- Provide example mapping snippets for custom CSV to guide users.

---

## columnStandardization.ts

- Summary: Canonical column-name mapping and header normalization utility used by CSV import and source processing.

**Helpers**
- `defaultCanonicalColumnMap`: Rich map covering player info, standard stats, special provider keys (e.g., A&G, Bangers), goalie stats, and fantasy point columns.
- `standardizeColumnName(rawHeader, customMap?)`: Lowercases and trims; matches via merged map; else title-cases and replaces non-alphanumerics with `_`.

**Notes & Actionables**
- Ensure `titleCase` import is correct (already included) and resilient to nullish headers (guard present).
- Add round-trip tests for common vendor headers; keep goalie vs skater distinctions tight.
- Consider exporting `CANONICAL_COLUMN_OPTIONS` for UI autocompletes (mirrors ImportCsvModal behavior).

---

## ComparePlayersModal.tsx

- Summary: Two-player comparison modal with radar chart (Chart.js) and percentile tables across selected metrics. Picks default metric set based on whether any selected is a goalie.

**Data Flows**
- Filters `allPlayers` by `selectedIds` (first 2). Chooses metric keys (`defaultsSkater` vs `defaultsGoalie`). Computes percentiles per metric across `allPlayers`, then constructs radar datasets and per-game derived rows.

**Efficiency & UX**
- Percentiles across allPlayers recomputed per open; acceptable for moderate sizes. Consider memoizing a global index of sorted values per key when available.
- Uses global keydown; ensure handler respects focus in inputs.
- Image headshots list built per player; can cache URLs per playerId.

**Actionables**
- Add a11y parity (role="dialog", focus trap, Escape handling like ImportCsvModal).
- Provide metric selection UI; persist last selection. Allow toggling per-game vs totals.
- Memoize `byKeySorted` across opens or cache in a context when pool unchanged.

**Connections**
- `ProjectionsTable`: Launches modal; relies on stat keys consistency in `STATS_MASTER_LIST`.

---

## useVORPCalculations.ts

- Summary: Core value engine computing comparable value (`value`), VORP, VONA, VBD, best position, and replacement baselines. Supports points and categories leagues, forward grouping, personalized replacement, expected picks before next turn, 82-game proration, and custom fantasy scoring.

**Inputs/Outputs**
- In: `UseVORPParams` including `players`, `availablePlayers`, `draftSettings`, `picksUntilNext`, `leagueType`, `baselineMode`, `categoryWeights`, `forwardGrouping`, `myFilledSlots`, `personalizeReplacement`, `prorate82`, `fantasyPointSettings`.
- Out: `{ playerMetrics: Map<string, PlayerVorpMetrics>, replacementByPos, expectedTakenByPos?, expectedN? }`.

**Algorithm Highlights**
- Eligibility parsing from `displayPosition`, honoring forward grouping.
- Points mode: Computes fantasy points (integrates proration via `prorate82` + `fantasyPointSettings`) and derives VORP-like metrics vs baselines.
- Categories mode: Z-score per category with goalie rate regression (`PRIOR_SHOTS`, `PRIOR_STARTS`), inversion for lower-better stats, and weighted sum via `categoryWeights` to a composite `value`.
- Replacement: Baseline can be among remaining or full pool; accounts for my filled slots when `personalizeReplacement` is on.
- Expected runs: Estimates `expectedTakenByPos` and `expectedN` using `picksUntilNext` to modulate VBD/VONA.

**Efficiency & Recommendations**
- Heavy memos: Good use of `useMemo`; ensure dependencies include all tuning knobs.
- Map/array builds: Build `playerById`/`posBuckets` once; avoid repeated `combinedStats` property traversal when possible.
- Regression params: Consider exposing `PRIOR_*` as configurable tunables via props for experimentation.

**Actionables**
- Add small helper for projected stat access with optional proration baked in to reduce branching.
- Expose debug diagnostics (counts per position, baseline picks) when `__DEV__`.
- Provide a reference doc of metric definitions to align UI labels and tooltips across components.

**Connections**
- Consumed by `DraftDashboard.tsx`, `ProjectionsTable`, and `SuggestedPicks`; keep semantics identical across displays.

---

## proration.ts

- Summary: Utilities to compute 82-game pacing for skater counting stats and recompute fantasy points accordingly without mutating original projections.

**API**
- `PRORATE_82_STAT_KEYS`: Set of skater stat keys to prorate (excludes rates/percentages/goalie stats).
- `isGoaliePlayer(player)`: Detects goalie by `displayPosition`.
- `getProratedStat(player, statKey, enable)`: Returns `(raw/GP)*82` for eligible stats; guards nulls, goalie roles, and invalid GP.
- `computeProratedFantasyPoints(player, enable, customScoring?)`: Merges defaults (`DEFAULT_*_FANTASY_POINTS`) with overrides and sums `proratedStat * weight` when enabled; else returns existing projected FP.

**Actionables**
- Cache per-player GP and derived prorated values for hot keys to avoid repeated property lookups in tight loops (e.g., in VORP calculations).
- Provide a batch function to map a list of players to prorated FP for table precompute.

**Connections**
- `useVORPCalculations`: Consumes via `prorate82` to affect points-league `value`.
- `ProjectionsTable`: Should reflect proration in displayed fantasy points when toggle is on to avoid UI mismatch.

---

## statsMasterList.ts

- Summary: Source of truth for `StatDefinition` and the list of stat keys/metadata used across the app (display names, units, higherIsBetter, player type, etc.).

**Governance**
- Keep keys stable and aligned with canonical names used by `columnStandardization` and processing hooks.
- Mark category-vs-points roles explicitly; include goalie vs skater tags to drive defaults in UI (e.g., Compare modal metric sets).

**Actionables**
- Add docstrings/comments on any non-obvious stat semantics and units.
- Provide a small validator that runs in dev to ensure no duplicates, all keys are uppercase, and every used key in code exists in this list.
