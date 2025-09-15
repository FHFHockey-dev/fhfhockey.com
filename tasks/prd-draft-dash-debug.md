### Performance & Data Pipeline Optimization Roadmap (NEW)

Context: Projection source tables are static per season; indices exist on player_id and primary keys. Goal is to reduce initial draft dashboard load time and interactive re-computation latency without changing public types or exported APIs.
### Success Metrics

Initial projections load TTFP (time to fantasy points displayed) reduced by >=30% vs baseline.
### Validation Strategy

1. Instrument baseline timings (fetch, process, render) before changes; store in `console.table` snapshot (dev only).
### Notes / Constraints

Must not alter exported types: `ProcessedPlayer`, `TableDataRow`, hook return signatures.
## Performance Update Log (append as changes land)

2025-09-15: Added debounced persistence + last non-zero weight restore in `useProjectionSourceAnalysis` (Tier 1: Debounced sourceControls save). 
2025-09-15: Introduced stale run guard scaffolding (runIdRef) and FP-only recompute placeholder + startTransition in `useProcessedProjectionsData` (Tier 1: Stale run guard). 

2025-09-15: Added composite base / FP keys for future FP-only fast path (Tier 1: Hash/composite key groundwork). 
2025-09-15: Implemented phase instrumentation logs + improved pagination helper (head count, spread push, timing) in `useProcessedProjectionsData` (Tier 1 & Hang Issue mitigation start).
2025-09-15: Added async processing scaffolding with stale run abort checks before/after round summaries (no partial commits) in `useProcessedProjectionsData`.

2025-09-15: Inlined async per-player processing loop with periodic yielding (every 200 players) and mid-loop stale abort.

### Newly Identified Issues (UI/Data Regressions)

Issue A: Duplicate Compare Checkbox Column
- Symptom: After moving the compare checkbox to the far right (COMP.), an earlier left-side compare checkbox remained, producing two selectable columns.
- Root Cause: Initial refactor added the new column without removing the original compare input cell & header placeholder.
- Status: Left duplicate column removed; only rightmost COMP. column retained (ProjectionsTable.tsx / ProjectionsTable.module.scss).
- Follow-up: Ensure accessibility labeling for single remaining checkbox; confirm no stale CSS selectors remain.

Issue B: Value Band Colors (Proj FP / VBD) Lost Visual Emphasis
- Symptom: Green / Yellow / Red bands faded or overridden by zebra striping.
- Root Cause: Zebra row backgrounds had higher specificity; value band classes lacked stronger background overlay.
- Fix: Added reinforced `.valueBand.valueSuccess|Warning|Danger` styles with higher z-index and explicit backgrounds.
- Follow-up: Re-test in dark and light theme modes (if applicable) and ensure contrast ratios >= WCAG AA.

Issue C: Missing ADP (average_draft_pick) Values
- Symptom: ADP column shows '-' for all players; previously populated from `yahoo_players.average_draft_pick`.
 Symptom: ADP column showed '-' for all players; previously populated from `yahoo_players.average_draft_pick`.
 Confirmed Root Cause (post‑investigation): Lookup mismatch caused by relying only on one identifier form. Some mappings referenced composite Yahoo `player_key` values (e.g. `465.p.12345`) while the original fetch queried only by numeric `player_id` (tail segment). As a result, many current‑season rows (scoped by `game_id=465`) were never retrieved or not addressable via the key actually used in `yahooPlayersMap` during processing.
 Implemented Fix: Dual query strategy added:
  1. Split requested IDs into composite IDs (containing '.') and raw numeric IDs.
  2. Query `yahoo_players` twice (by `player_key` and by `player_id`) each constrained with `game_id=465`.
  3. De‑duplicate preferring rows whose `player_key` begins with `CURRENT_YAHOO_GAME_PREFIX`.
  4. Populate `yahooPlayersMap` under BOTH `player_id` and `player_key` to allow flexible resolution when only one form is present in mapping.
 Instrumentation: Dev‑only console.debug block logs counts (compositeIds, numericIds, fetched rows, dedup size, final map size) plus a 3‑entry sample including ADP values for verification.
 Remaining Risks / Edge Cases:
  - Mapping table might store an outdated season prefix causing lookups to resolve to stale / absent ADP (should be mitigated by dual keys).
  - Players with null ADP legitimately (undrafted / new entrants) must not be treated as failures.
  - Potential performance overhead of two queries (acceptable now; can merge with OR logic later if needed, but current Supabase pagination helper simplicity preferred).
 Validation Plan (current phase):
  - Count processed players with non-null parsed ADP; expect > 0 for mainstream skaters.
  - Spot check a few known early‑round players vs Yahoo site values (within reasonable rounding tolerance).
  - Ensure ADP sort ascending places elite players (e.g., McDavid) near top when no other sort applied.
  - Verify `SuggestedPicks` risk model now computes availability (was previously skipping due to null ADP).
 Cleanup (post‑validation):
  - Gate verbose ADP debug logs behind a future `DEBUG_PROJECTIONS` or remove entirely.
  - Collapse dual query if schema guarantees both identifiers moving forward (defer for now).
 Definition of Done (ADP slice): Non‑zero count of players with `processedPlayer.yahooAvgPick !== null`; ADP visible & sortable; risk / suggestion calculations consuming numeric ADP; no TypeScript regressions.

Issue D: Control Toggle Button Focus Styling
- Symptom: Control buttons (.controlToggleBtn) did not visually align with new compare emphasis; requested focus-color border and 40% opaque background when active/focused.
- Fix: Added `.controlToggleBtnActive, .controlToggleBtn:focus-visible` styling using `$focus-color` with translucent background.
- Follow-up: Apply `.controlToggleBtnActive` class in JSX where an active state is conceptually applied (pending if not already wired) and test keyboard focus ring.

Issue E: Compare Button Visual Affinity (Pending)
- Symptom: Compare launch button not yet styled with new yellow/focus-color scheme.
- Planned: Apply `.compareLaunchButton` class to the toolbar Compare button when `selectedIds.size >= 2` for visual affordance.

---

# PRD: Draft Dashboard Debug & UX Fixes

Owner: Tim  •  Status: Draft  •  Scope: Draft Dashboard (web/pages/draft-dashboard.tsx)

## Goals
- Fix category management for Categories leagues (include goalie metrics).
- Keep Team VORP and Proj Pts fixed as rightmost columns on the Draft Board.
- Prevent SHP from appearing unless explicitly added in Points leagues.
- Make Keepers autocomplete selection stick on first click.
- Correct goalie stat label/mapping for GA vs GAA.
- Resolve Suggested Picks hanging when filtering by Skater.

## Non‑Goals
- Redesign of Draft Dashboard UI or data model.
- Changes to projections math or VORP algorithms beyond label/mapping fixes.

## Affected Files
- Entry: `web/pages/draft-dashboard.tsx:1`
- Settings UI: `web/components/DraftDashboard/DraftSettings.tsx:1`
- Draft Board: `web/components/DraftDashboard/DraftBoard.tsx:1`
- Suggested Picks: `web/components/DraftDashboard/SuggestedPicks.tsx:1`
- Player Autocomplete: `web/components/PlayerAutocomplete/PlayerAutocomplete.tsx:1`
- FP defaults: `web/lib/projectionsConfig/fantasyPointsConfig.ts:1`
- Stats mapping context: `web/hooks/useProcessedProjectionsData.tsx:223`

---

## Issue 1: Categories “Select Category” missing goalie metrics

Symptoms
- In Draft Settings, when `League Type = Categories`, the inline “Select Category” dropdown only lists skater metrics; goalie metrics are missing.

Likely Root Cause
- The addable list is built from skater keys only.
- Location: `web/components/DraftDashboard/DraftSettings.tsx:835` (`addableCategoryStats` uses `availableSkaterStatKeys` only).

Proposed Fix
- Merge skater and goalie keys when building `addableCategoryStats` in Categories mode:
  - `const allKeys = [...availableSkaterStatKeys, ...availableGoalieStatKeys]` and filter out existing selections.
- Ensure label helper returns correct goalie labels (see Issue 5 for GA/GAA correction).

Acceptance Criteria
- In Categories mode, “Select Category” lists both skater and goalie stats not yet added.
- Adding a goalie category updates `settings.categoryWeights` and surfaces on the Draft Board (see Issue 2 ordering).

Test Plan
- Switch to Categories, open “+ more”, verify goalie stats appear in dropdown.
- Add a goalie metric, confirm it shows on Draft Board (left of Team VORP/Proj Pts per Issue 2).

---

## Issue 2: New categories render to far right; keep Team VORP/Proj Pts fixed rightmost

Symptoms
- When adding categories, Draft Board appends new columns at the far right. Desired: keep “TEAM VORP” and “PROJ PTS” as the two rightmost columns; place new categories to their left.

Likely Root Cause
- Dynamic category headers/cells are rendered after Proj Pts.
- Locations:
  - Dynamic keys discovery: `web/components/DraftDashboard/DraftBoard.tsx:437` (`dynamicCategoryKeys`).
  - Header placement (after Proj Pts): `web/components/DraftDashboard/DraftBoard.tsx:763`.

Proposed Fix
- Render order in header and body:
  1) Core categories (G, A, PPP, SOG, HIT, BLK)
  2) Dynamic categories (from `dynamicCategoryKeys`)
  3) Team VORP
  4) Proj Pts
- Mirror the same order for `<tbody>` row cells.
- Keep sorting behavior for dynamic keys (`dynamic:${k}`) unchanged.
- Optionally sort dynamic keys alphabetically for stable ordering.

Acceptance Criteria
- After adding a category, it appears to the left of Team VORP and Proj Pts.
- Team VORP and Proj Pts remain the two rightmost columns.

Test Plan
- Add a custom category; verify column order visually and sorting still works.

---

## Issue 3: SHP auto‑added on “+ more” in Points leagues

Symptoms
- With `League Type = Points`, clicking “+ 1 more” in skater scoring shows SHP as if it was added automatically; hiding collapses it. Expected: SHP should only appear if explicitly added via dropdown + “Add Stat”.

Likely Root Cause
- SHP (`SH_POINTS`) is included in default skater FP config, so it exists even before the user adds it.
- Location: `web/lib/projectionsConfig/fantasyPointsConfig.ts:15` (`SH_POINTS: 1`).

Proposed Fix
- Remove `SH_POINTS` from `DEFAULT_SKATER_FANTASY_POINTS` so it is not active by default.
- No change needed in the expand/collapse code (it doesn’t add stats implicitly).

Acceptance Criteria
- In Points leagues, SHP is not present until the user selects it and clicks “Add Stat”.
- Collapsing/expanding does not change active stats.

Test Plan
- Reset skater scoring, expand, verify SHP is not listed among active until added explicitly.

---

## Issue 4: Keepers autocomplete requires two clicks to “stick”

Symptoms
- With Keepers enabled, selecting a player in the small autocomplete input doesn’t persist on first click; it often requires a second try.

Likely Root Causes
- Parent isn’t controlling the selected player id; `playerId` prop is `undefined`.
  - Location: `web/components/DraftDashboard/DraftSettings.tsx:1884` (`<PlayerAutocomplete playerId={undefined} ... />`).
- Autocomplete’s `onChange` fires on non‑select reasons, clearing selection on blur.
  - Location: `web/components/PlayerAutocomplete/PlayerAutocomplete.tsx:89` (calls `onPlayerIdChange` even when `newValue` is null/blur).

Proposed Fix
- Make the autocomplete controlled from `DraftSettings`:
  - Pass `playerId={keeperSelectedPlayerId ? Number(keeperSelectedPlayerId) : undefined}`.
- In `PlayerAutocomplete`, only propagate selection on `reason === 'selectOption'` (ignore blur/clear unless explicitly clearing).

Acceptance Criteria
- Selecting a player once keeps the name in the input and sets the ✓ status.
- Subsequent UI interactions do not clear the selection unless user clears.

Test Plan
- Enable Keepers, select a player, click elsewhere. The selected player remains. Click “+” to add the keeper successfully.

---

## Issue 5: Goalie GAA vs GA label/mapping mismatch

Symptoms
- Goalie scoring shows “GAA” by default, but the underlying column/mapping used elsewhere is `goals_against` (GA) or `goals_against_avg` for GAA. Labeling is inconsistent.

Context
- Mappings: `web/hooks/useProcessedProjectionsData.tsx:223` shows `GOALS_AGAINST_GOALIE: "goals_against"` and `GOALS_AGAINST_AVERAGE: "goals_against_avg"`.
- Labels:
  - `web/components/DraftDashboard/DraftSettings.tsx:121` maps `GOALS_AGAINST_GOALIE` to "GAA" (incorrect label).
  - `web/components/DraftDashboard/DraftBoard.tsx:414` repeats that mapping in a local label helper.

Proposed Fix
- Use proper label abbreviations:
  - `GOALS_AGAINST_GOALIE` → "GA"
  - `GOALS_AGAINST_AVERAGE` → "GAA"
- Audit any default goalie scoring presets to ensure GA vs GAA are not conflated.

Acceptance Criteria
- Goalie GA displays as "GA" and GAA displays as "GAA" everywhere (settings, board, tables).

Test Plan
- Open Settings (Points and Categories), verify labels for GA and GAA across skater/goalie groups.

---

## Issue 6: Suggested Picks stuck on “Computing suggestions…” when filtering by Skater

Symptoms
- Selecting “Skater” in the “Filter by position” dropdown causes the module to show “Computing suggestions…” indefinitely.

Likely Root Cause
- Position filter matches exact values from `displayPosition` (e.g., `C,LW,RW,D,G`); “Skater” doesn’t match anything, producing an empty list.
- Locations:
  - Options discovery: `web/components/DraftDashboard/SuggestedPicks.tsx:298`.
  - Filtering logic: `web/components/DraftDashboard/SuggestedPicks.tsx:307`.

Proposed Fix
- Treat composite filters:
  - If `posFilter === 'Skater'`, include any non‑goalie (C, LW, RW, D, UTIL).
  - Optionally add explicit “Skater” and “Goalie” options to `availablePositions` for clarity.
- Ensure empty results show a helpful “No matching players” note instead of infinite “Computing…”

Acceptance Criteria
- Selecting “Skater” filters to non‑goalies and shows suggestions.
- If no players match, shows an empty state message, not a spinner.

Test Plan
- Switch the filter to “Skater” and “Goalie” and verify lists populate accordingly.

---

## Issue 8: Projection Source Weighting Yields Zero Points When One Source Set to 100%

Symptoms
- A beta user reports that setting a single projection source slider to 100% (without manually un‑checking the others) causes some players to show 0 projected fantasy points.
- User expectation: forcing one source to 100% should implicitly make that the sole contributor (i.e., blended == that source), never zero out players that have data in that source.

Likely Root Causes / Hypotheses
- Normalization step may only consider sources marked `isSelected`; if others remain selected with weight 0 after user interaction, division by total (or skipping) could yield 0.
- Some players may lack rows in other sources; current blend might multiply by zero weights but still divides by sum > 1 or incorrectly early‑returns 0 when encountering missing stats for a source.
- UI sets a source weight to 100 but other active sources keep small floating weights until explicit normalize, so downstream logic treats them all and, for players missing in the 100% source, returns 0 instead of falling back.

Desired Behavior
1. Always re‑normalize active (selected) sources so their weights sum to 1.000 (within tolerance) after any slider change (unless user has disabled auto-normalize).
2. If one active source weight is set to 100 (or 1 after normalization) treat blend as that source alone; missing player rows should produce a graceful fallback (e.g., 0 only if truly absent in that chosen source) – but should not become 0 if player exists in that source.
3. If a player is missing in the dominant (100%) source but present elsewhere, either (a) show a clear indicator (e.g., "–" with tooltip "No data in selected source") or (b) optionally fall back to next weighted source (decision: pick (a) for clarity; do not silently mix).
4. Users should not be required to manually un‑check other sources to single‑source the projections.

Proposed Fix
- In `DraftSettings` weight slider handler: after any change, if auto‑normalize is enabled, recompute weights so sum == 1. If a single slider is >= 0.999, force that slider to 1 and set all other selected sources to 0 (but keep their selection state for quick revert) before normalization.
- In blending logic (likely in `useProcessedProjectionsData.tsx`):
  - Ignore any selected source whose effective weight <= 0.0005 (treat as disabled for that calculation) to avoid micro-float contributions.
  - When computing per-player blended metrics, iterate only over sources with weight > 0; accumulate (value * weight). Missing value in a source: skip (do not treat as zero) so long as at least one source supplies the stat. If all contributing sources missing that stat, result undefined → final FP sum should still proceed with available stats; missing stat counts as 0 only for its category weight, not entire player.
  - Provide optional diagnostic map recording which sources contributed for a player (future UI enhancement; not required now).
- Add defensive assertion: if after normalization total weight not within [0.999,1.001], force re‑normalize.

Acceptance Criteria
- Setting one projection source to 100 instantly makes blended fantasy points match that source’s raw projections for players present in that source.
- Players absent from that 100% source display a clear placeholder (e.g., dash, tooltip) and are not incorrectly shown as 0 if they have values in other sources (unless design chooses strict single-source mode—document choice).
- No players that have valid projections in the selected 100% source display 0 due purely to weighting.
- Weight sum invariant holds (logged/verified) after arbitrary slider adjustments.

Test Plan
1. Enable multiple sources; pick a player known to have projections in all sources. Set one source to 100. Verify projected FP equals that source’s value (within rounding tolerance).
2. Pick a player missing in one secondary source— ensure value unchanged when that secondary source weight moves from small > 0 to 0 while dominant at 100.
3. Temporarily disable auto-normalize (if feature exists); set a single source to 100; click normalize – verify weights finalize correctly.
4. Regression: blend with two sources at 60/40 still matches manual weighted average for sample players.
5. Edge: Set all sliders to 0 accidentally; system auto-corrects (either revert previous state or set last changed to 1) – no division by zero.

Open Questions
- Strict single-source semantics vs. fallback. Current assumption: strict; surface absence clearly. Confirm before implementation.

Instrumentation / Logging (Optional)
- Console warn in dev if normalization sum drifts or if player blend path encounters all-missing stats.

---

## Issue 9: Last Season TOI/G Display Should Use MM:SS Format in Expanded Row

Symptoms
- In `ProjectionsTable` expanded player row (after clicking "+"), skater stat `TOI/G` (currently `toi_per_game`) displays as a decimal (e.g., `19.52`) instead of the conventional minutes/seconds format `19:31`.

Context
- Expanded row builds pills and formats `toi_per_game` with `.toFixed(2)`. Field is stored in minutes (fractional). Users expect standard hockey notation (MM:SS).

Desired Behavior
- Convert fractional minutes to `MM:SS` (zero‑pad seconds). For 19.52 minutes: seconds = 0.52 * 60 ≈ 31.2 → `19:31` (round to nearest second).
- If value missing / null: show `-`.
- Tooltip can show original decimal for transparency (optional).

Proposed Fix
- Helper: `function formatMinutesToClock(v:number){ const totalSeconds=Math.round(v*60); const m=Math.floor(totalSeconds/60); const s=totalSeconds%60; return `${m}:${s.toString().padStart(2,'0')}`; }`
- Replace current TOI pill value with the formatted string; optionally keep raw decimal in `title` attribute.
- Ensure goalie expanded rows unaffected (they use different stats set).

Acceptance Criteria
- Expanded skater row shows TOI/G as `MM:SS` consistently (e.g., 20.00 → 20:00; 19.5 → 19:30; 19.51 → 19:31).
- Rounding does not produce 60 seconds; e.g., 19.999 minutes → 20:00 (handle carry).
- No layout regressions in pill grid.

Test Plan
1. Expand a known skater; verify format matches expected clock format.
2. Edge: value with many decimals (simulate 12.0167) → 12:01.
3. Edge: rounding boundary (14.999) → 15:00.
4. Missing value: shows dash.

Implementation Notes
- Keep pure formatting in component (no data model change). Optionally centralize in a `formatters.ts` for reuse.

---

## Implementation Plan (summary)

---

## Prompt for LLM Handoff

You are ChatGPT 5 taking over implementation on a Next.js (15.1+) monorepo with a Draft Dashboard UI. You are continuing work started by a prior assistant. Please read carefully and pick up where we left off.

Context snapshot
- App: Fantasy Hockey Draft Dashboard (Next.js web app).
- State owner: `web/components/DraftDashboard/DraftDashboard.tsx`.
- Data model for players: `ProcessedPlayer` from `web/hooks/useProcessedProjectionsData.tsx`.
- Projections sources: `web/lib/projectionsConfig/projectionSourcesConfig.ts`.
- Stats master list: `web/lib/projectionsConfig/statsMasterList.ts`.
- VORP: `web/hooks/useVORPCalculations.ts`.

What’s implemented in this branch
- Snapshot V2: `DraftSnapshotV2` with `saveSnapshot()`/`loadSnapshot()` in DraftDashboard; sessionStorage key `draft.snapshot.v2`; resume prompt on mount; auto-save after state changes.
- Multi‑CSV: Session‑scoped array `draft.customCsvList.v2` with ids `custom_csv_1..n`. UI to enable/weight/remove appears under Projection Sources in Draft Settings. Hook `useProcessedProjectionsData` accepts `customAdditionalSources` (array) for both skaters and goalies.
- SHA metric: `SH_ASSISTS` added to `STATS_MASTER_LIST` and derived in `useProcessedProjectionsData` as `SHP - SHG` when both present.
- Compare Players: `ComparePlayersModal.tsx` with radar chart (react-chartjs-2/chart.js) and per-metric percentile table. Multi-select checkboxes were added to the Projections table header/rows. A toolbar button opens the modal when 2+ selected.
- Categories sorting: `DraftBoard.tsx` leaderboard “Projected Points” sort now uses `teamScoreAvg` when league type = Categories.

Key files changed
- DraftDashboard.tsx: snapshot save/load, multi‑CSV list utilities, removal handler, reordering snapshot hooks to avoid TDZ.
- useProcessedProjectionsData.tsx: support multiple custom sources; SHA derived metric.
- DraftSettings.tsx: projection sources chips and weights popover updated for multiple `custom_csv_*` ids with removal button.
- ProjectionsTable.tsx: selection checkboxes, compare modal wiring.
- ComparePlayersModal.tsx: new component.
- statsMasterList.ts: add `SH_ASSISTS`.
- DraftBoard.tsx: categories sort fix.

Immediate next steps
1) Build and smoke test locally.
   - Verify no TDZ/SSR issues and no duplicate resume prompts (snapshot vs legacy resume); snapshot effect sets `resumeAttemptedRef` to prevent duplicate.
2) Multi‑CSV QA:
   - Import 2 CSVs; confirm two chips created (skater + goalie sections), weights adjustable, removal works for both control maps.
   - Confirm projections reblend after weight changes and after removal (manual refresh button also available).
3) Compare modal UX:
   - Verify header checkbox column aligns and doesn’t break layout on mobile widths.
   - Validate radar chart renders and table computes percentiles. Check accessibility: ESC to close, focus trap, aria labels.
4) SHA metric:
   - Confirm `SH_ASSISTS` appears as a selectable stat in settings (Derived/Short Handed group) and values compute where SHG/SHP present.
5) Categories sorting:
   - Switch league type to Categories; confirm leaderboard sorts by Score and rightmost columns order remains as specified.

If you need to continue implementation
- Consider adding minimal styles (if any artefacts appear) for the compare selection column in `ProjectionsTable.module.scss` (we reused `.colFav` for the select column).
- Optionally add a per-source enable/weight UI for goalies consistent with skaters; this is already hooked.
- If duplicate resume prompts appear in rare flows, guard the legacy resume block behind absence of `draft.snapshot.v2`.

Definition of done
- No runtime errors; UI accessible; no regressions to points/categories flows, FWD toggle, need‑weight, baseline mode.
- Multi-CSV behaves as independent sources with enable/weight/remove.
- Bookmark Snapshot V2 reliably restores full session and respects resume choice.
- DraftSettings
  - Merge goalie keys into `addableCategoryStats` (Categories mode).
  - Pass controlled `playerId` to Keepers autocomplete; keep local state in sync.
  - Fix goalie label map: GA vs GAA.
- DraftBoard
  - Move dynamic categories columns to render before Team VORP and Proj Pts in both header and body.
  - Align label helper’s GA/GAA mapping.
- PlayerAutocomplete
  - Restrict `onChange` to update selection only on `reason === 'selectOption'`; ignore blur.
- Fantasy Points Defaults
  - Remove `SH_POINTS` from `DEFAULT_SKATER_FANTASY_POINTS` to avoid auto‑adding SHP.
- SuggestedPicks
  - Support composite filters for “Skater” and “Goalie”; adjust empty state.

## Risks & Considerations
- Users who relied on SHP being default will need to re‑add it once; consider a changelog note.
- Column order change affects muscle memory; keep a toggle to show/hide dynamic categories to contain noise (already present).
- Verify GA vs GAA changes don’t break any CSV export/import expectations.

## Validation Checklist
- Defense Points option: added as derived skater stat (`DEFENSE_POINTS` → label "DPTS"), selectable in Draft Settings > Scoring. Defaults to 1.0 on add and is editable. Included in FP math only when added.
- Eligible positions: Projections table shows Yahoo `eligible_positions` as comma-separated list (e.g., "C, RW").
- Dual-eligibility drafting: On draft, fills primary position per existing cascade; if that slot is full, falls back to another eligible position before UTIL/Bench. Roster UI highlights eligible empty slots for swaps using focus color.
- Points and Categories flows exercised after changes.
- Add/remove skater/goalie stats, verify Draft Board totals appear and sort.
- Keepers flow: select → add → list updates; no double‑click required.
- Suggested Picks responds to “Skater”/“Goalie” filters without hanging.

---

## Update Log

- Completed: Issue 1 (Categories dropdown includes goalie metrics). File: `DraftSettings.tsx`.
- Completed: Issue 2 (Dynamic categories render left of Team VORP/Proj Pts). File: `DraftBoard.tsx`.
- Completed: Issue 3 (SHP not auto‑added by default). File: `fantasyPointsConfig.ts`.
- Completed: Issue 4 (Keepers autocomplete sticks on first click). Files: `DraftSettings.tsx`, `PlayerAutocomplete.tsx`.
- Completed: Issue 5 (GA vs GAA labels corrected). Files: `DraftSettings.tsx`, `DraftBoard.tsx`.
- Completed: Issue 6 (Suggested Picks Skater filter no longer hangs; added empty state). File: `SuggestedPicks.tsx`.
- New/Completed: Issue 7 (Auto‑show new category columns on Draft Board; still left of Team VORP/Score). File: `DraftBoard.tsx`.
- New Feature: Categories “Score” replaces Proj FP; leaderboard shows team average Score and tooltips/legend added. Files: `useVORPCalculations.ts`, `ProjectionsTable.tsx`, `DraftBoard.tsx`, `DraftDashboard.tsx`.
- Completed: Defense Points (DPTS) addable scoring metric; computed from D goals + assists when added; editable value. Files: `statsMasterList.ts`, `useProcessedProjectionsData.tsx`, `DraftSettings.tsx`.
- Completed: Yahoo eligible positions displayed (e.g., "C, RW") and used for draft fallback (tries other eligible slots if primary is full). Roster UI highlights eligible empty slots for swaps. Files: `useProcessedProjectionsData.tsx`, `ProjectionsTable.tsx`, `DraftDashboard.tsx`, `MyRoster.tsx`.

---

## New TODOs (Q4 Roadmap)

- [ ] Bookmarking: snapshot everything
  - Save/restore a complete session bundle (draft board state, keepers, traded picks, projections source selections + weights, imported CSV(s), settings including forward grouping, need‑weight, baseline mode, category weights, custom team names, position overrides).
  - Files: `DraftDashboard.tsx` (serialize/deserialize), `DraftSettings.tsx` (export/import helpers), `ImportCsvModal.tsx` (persist imported sources), `useProcessedProjectionsData.tsx` (rebuild from snapshot), `localStorage/sessionStorage` keys.

- [x] Defense points option
  - Add a global toggle/points mapping to award “Defensive points” (e.g., bonus per D position) or a per‑stat weighting group for D only.
  - Files: `DraftSettings.tsx` (UI), `fantasyPointsConfig.ts` (defaults), `useProcessedProjectionsData.tsx` and `useVORPCalculations.ts` (apply modifier only when primary/assigned position is D), `DraftBoard.tsx` (display).

 - [x] Dual/triple‑eligibility position swap in My Roster
  - Status: COMPLETED for current scope. Click‑to‑move to eligible empty slots is implemented with position overrides and visual highlighting; draft auto‑assignment falls back to alternate eligible positions.
  - Future polish (separate task): swap with an occupied slot, drag‑and‑drop UX, and undo integration.
  - Files: `MyRoster.tsx/.module.scss` (UI + DnD), `DraftDashboard.tsx` (override state + history), `useVORPCalculations.ts` (optional personalized replacement using current filled starters).

- [ ] Multiple user projection sets (multi‑CSV)
  - Support importing and enabling multiple custom sources simultaneously; show per‑source controls and weights; de‑dup with name + team; blend in averages.
  - Files: `ImportCsvModal.tsx` (store array `draft.customCsvList.v1`), `DraftDashboard.tsx` (synthesize multiple `customAdditionalSource`s), `useProcessedProjectionsData.tsx` (merge loop already supports N sources), `DraftSettings.tsx` (chips for each custom source).

- [ ] Add SHA derived metric
  - Most sources provide SHP and some SHG. Provide `SHA = SHP - SHG` as a derived projection/actual metric; expose in categories/points selectors.
  - Files: `useProcessedProjectionsData.tsx` (post‑aggregation derivation), `statsMasterList.ts` (new `SHA` definition), `projectionSourcesConfig.ts` (mark derived), `DraftSettings.tsx` (labels), `DraftBoard.tsx` (column), CSV export.

- [ ] Compare Players modal
  - In ProjectionsTable add a multi‑select “Compare” action to open a modal:
    - Metrics table: totals/means per player; highlight deltas and per‑metric winner.
    - Radar/Spider chart: percentile per selected category (respect category weights if in Categories mode).
    - Category win table: which player “wins” each metric; summary of winners.
  - Files: `ProjectionsTable.tsx` (select state + button), `components/DraftDashboard/ComparePlayersModal.tsx` (new), `hooks/usePercentiles.ts` (new helper), `styles`.

---

## Gameplan

1) Bookmarking snapshot
- Model: create a single `DraftSnapshotV2` interface capturing all state. Add safe versioning.
- Save: throttle to localStorage; store large/transient (CSV) in sessionStorage but include references in snapshot for restoration.
- Restore: on “Resume?” Yes → restore all; No → clear session CSV and saved snapshot for a clean start.
- Edge cases: missing sources/season id; validate snapshot version; warn and continue.

2) Defense points option

---

## Performance & Data Pipeline Optimization Roadmap (NEW)

Context: Projection source tables are static per season; indices exist on player_id and primary keys. Goal is to reduce initial draft dashboard load time and interactive re-computation latency without changing public types or exported APIs.

### Prioritization Tiers

1. High Impact / Low Risk (implement first)
2. High Impact / Moderate Risk (behind feature flag if needed)
3. Medium Impact / Low Risk (incremental polish)
4. Advanced / Optional (evaluate after measuring gains)

### Tier 1: High Impact / Low Risk

- Parallel Source Fetch
  - Replace sequential per‑source Supabase queries with `Promise.all` (or limited concurrency if rate limited). Each projection source query is independent.
  - Keep existing error handling; use `Promise.allSettled` to allow partial data rather than failing whole load.

- Stale Run / Abort Guard
  - Maintain `fetchRunIdRef`; discard late results if a newer run started (prevents double state commits during rapid weight or filter tweaks).

- Lightweight Fantasy Points Recompute Path
  - If only `fantasyPointSettings` or `showPerGameFantasyPoints` changes, reuse cached base player objects; recompute only FP aggregates (O(n) numeric) instead of full rebuild.

- Debounced LocalStorage Writes in `useProjectionSourceAnalysis`
  - Add 150–200ms debounce; skip write if JSON unchanged.

- Hash-Based Cache Keys
  - Compute a short murmurhash (or simple FNV-1a) of concatenated dependency JSON for quick equality comparisons instead of repeated `JSON.stringify` equality checks.

### Tier 2: High Impact / Moderate Risk

- Row Virtualization (Projections Table)
  - Integrate `@tanstack/react-virtual` for vertical windowing. Target: render ~20–40 rows at a time.
  - Preserve keyboard navigation and existing row expansion logic.

- Paginated Bulk Fetch Optimization
  - Pre-fetch row count (`.select('*', { head: true, count: 'exact' })`). Generate all range queries in parallel with capped concurrency (e.g., 4–6). Fallback to sequential loop on error.

- startTransition Wrapping
  - Wrap `setProcessedPlayers` and `setTableColumns` in `React.startTransition` for smoother UI while heavy JS runs.

### Tier 3: Medium Impact / Low Risk

- Comparator Map & Filter Pipeline Split
  - Split filtering and sorting memos; avoid recomputing filters when only sort toggles.
  - Pre-build comparator functions keyed by `sortField`.

- Skip Rebuild of Static Columns
  - Separate “identity” columns (Name, Pos, Team) from dynamic stat / FP groups. Only regenerate dynamic subset when source selection or stat set changes.

- Microtask Chunking for Large Player Sets
  - If players > 1500, yield every 200 iterations (`await new Promise(r => setTimeout(r, 0))`) to keep main thread responsive.

- Source Weight Epsilon Handling
  - Treat weights below `0.0005` as zero to avoid floating point drizzle causing unexpected blended values.

- Memo Interning of Stat Keys
  - Intern frequently used stat keys to reduce string allocations in hot loops.

### Tier 4: Advanced / Optional

- Web Worker Offload
  - Move CPU-heavy percentile + VORP + diff% computations into a worker. Main thread receives a compact array of derived fields keyed by `playerId`.

- Adaptive Prefetch / Warm Cache
  - On initial season load, prefetch both skater and goalie sets if user likely to toggle soon (heuristic: if user visited both in past 24h).

- Telemetry / Performance Marks
  - Add `performance.mark` / `performance.measure` around: fetch, process, render. Log in dev mode and optionally upload anonymized timings for monitoring.

### Implementation Order & Tracking

| Step | Feature | Tier | Status | Notes |
|------|---------|------|--------|-------|
| 1 | Parallel source fetch | 1 | TODO | Convert fetch loop -> Promise.allSettled |
| 2 | Stale run guard | 1 | TODO | runIdRef increment + check before committing state |
| 3 | FP-only recompute path | 1 | TODO | Detect changes limited to FP settings/per-game toggle |
| 4 | Debounced sourceControls save | 1 | TODO | Add debounce + prev JSON ref |
| 5 | Hash composite cache key | 1 | TODO | Implement FNV-1a helper local to hook |
| 6 | Virtualized projections table | 2 | TODO | Introduce react-virtual; ensure expansion works |
| 7 | Parallel paginated fetch | 2 | TODO | Count head query + batched ranges |
| 8 | startTransition for state commit | 2 | TODO | Guard for non-React 18 fallback |
| 9 | Filter/sort pipeline split | 3 | TODO | Two useMemos; stable identity on filtered array |
| 10 | Static vs dynamic columns | 3 | TODO | Cache static columns separately |
| 11 | Chunked processing | 3 | TODO | Only if player count threshold exceeded |
| 12 | Weight epsilon + intern keys | 3 | TODO | Clean numeric sums; micro-alloc savings |
| 13 | Worker offload | 4 | Backlog | Build only if Tier 1–3 insufficient |
| 14 | Adaptive prefetch | 4 | Backlog | Heuristic user behavior based |
| 15 | Perf telemetry | 4 | Backlog | Dev-mode instrumentation only |

### Success Metrics

- Initial projections load TTFP (time to fantasy points displayed) reduced by >=30% vs baseline.
- Projections table scroll FPS remains >55 on modern laptop while filtering/sorting.
- Weight slider adjustment re-render under 150ms for N ≤ 2000 players.
- No increase in error logs or mismatched fantasy point totals (parity test vs baseline run).

### Validation Strategy

1. Instrument baseline timings (fetch, process, render) before changes; store in `console.table` snapshot (dev only).
2. Implement Tier 1; re-measure and document deltas in Update Log.
3. After Tier 2 (virtualization), test expansions, keyboard nav, and compare modal with virtualization active.
4. Run integrity script comparing FP sums & player counts pre/post refactor (add a temporary dev route if needed).
5. Gate Tier 4 features behind ENV flag `NEXT_PUBLIC_DRAFT_OPT_EXPERIMENTAL=1`.

### Notes / Constraints

- Must not alter exported types: `ProcessedPlayer`, `TableDataRow`, hook return signatures.
- Avoid introducing race conditions with snapshot restore (ensure fetch abort respects snapshot restoration sequence).
- Keep SSR safety: guard any `window` / `localStorage` usage.
- Maintain deterministic ordering for equal sort keys to avoid row flicker (tie-break by `playerId`).

---

## Performance Update Log (append as changes land)

- 2025-09-15: Added debounced persistence + last non-zero weight restore in `useProjectionSourceAnalysis` (Tier 1: Debounced sourceControls save). 
- 2025-09-15: Introduced stale run guard scaffolding (runIdRef) and FP-only recompute placeholder + startTransition in `useProcessedProjectionsData` (Tier 1: Stale run guard). 
- 2025-09-15: Added composite base / FP keys for future FP-only fast path (Tier 1: Hash/composite key groundwork). 

- UX: Settings toggle + numeric input(s). If enabled, apply a modifier for D players only (either additive or multiplier); reflect in ProjectionsTable and DraftBoard.
- Calc: during FP calc, if player assigned/bestPos is D, apply. For Categories, keep separate.

3) My Roster swaps
- Keep current click‑to‑highlight flow. Add click‑to‑swap when clicking a filled target.
- Maintain `positionOverrides` map and draft history for undo. Animate swaps.
- Optionally drag‑and‑drop (HTML5 DnD or keyboard accessible handles).

4) Multi‑CSV
- Storage: migrate to `draft.customCsvList.v1` array.
- Synthesis: map each item to a `CustomAdditionalProjectionSource` with unique id `custom_csv_<n>`.
- UI: chips with weight sliders and remove buttons in DraftSettings.
- Merge: existing name/team alignment step will coalesce rows; ensure no perf regressions.

5) SHA derived metric
- Add `SHA` to `STATS_MASTER_LIST` (numeric, higher is better). Compute after all source aggregation:
  - projected.SHA = clamp(SHP - SHG, >=0); actual.SHA likewise when both present.
- Expose in category selectors and tables with proper labels.

6) Compare Players modal
- Selection: maintain a Set of selected playerIds in ProjectionsTable; enable “Compare” when size ≥ 2.
- Modal: summary header, metric table, radar chart (recharts or chart.js), per‑metric winner row.
- Percentiles: precompute distribution for selected metrics using current pool; cache.
- Accessibility: keyboard navigation and screen reader descriptions.

---

## Files to touch

- Core state/UI: `web/components/DraftDashboard/DraftDashboard.tsx`, `DraftSettings.tsx`, `DraftBoard.tsx`, `MyRoster.tsx`, `MyRoster.module.scss`, `ProjectionsTable.tsx`.
- Data + calc: `web/hooks/useProcessedProjectionsData.tsx`, `web/hooks/useVORPCalculations.ts`.
- Configs + labels: `web/lib/projectionsConfig/statsMasterList.ts`, `projectionSourcesConfig.ts`, `fantasyPointsConfig.ts`.
- New: `web/components/DraftDashboard/ComparePlayersModal.tsx`, `web/hooks/usePercentiles.ts`.

---


