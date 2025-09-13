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

## Implementation Plan (summary)
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
