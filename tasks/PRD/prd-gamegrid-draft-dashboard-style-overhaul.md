# PRD: GameGrid Style Refactor to Draft Dashboard Brand

## Purpose
Refactor the **GameGrid** UI styles so the page is visually indistinguishable from the **Draft Dashboard** brand (“Neon Noir Analytics”), while preserving existing behaviors, data, and layout logic.

This document is written as a **Codex execution prompt/gameplan** for ChatGPT 5.2 Codex.

---

## Primary References (must read first)
1) Brand cheat sheet (source of truth): `fhfh-styles.md`  
2) Tokens + mixins: `web/styles/vars.scss`, `web/styles/_panel.scss`  
3) Draft Dashboard reference implementations:
   - `web/components/DraftDashboard/DraftDashboard.module.scss`
   - `web/components/DraftDashboard/DraftSettings.module.scss`
   - `web/components/DraftDashboard/ProjectionsTable.module.scss`
   - `web/components/DraftDashboard/SuggestedPicks.module.scss`
   - `web/components/DraftDashboard/DraftBoard.module.scss`

---

## Goals
- Apply the **Draft Dashboard** surface system (dark canvas, frosted glass panels, neon cyan accents).
- Standardize typography, spacing, borders, and interactions across GameGrid subpanels.
- Remove style drift: eliminate raw color literals where tokens exist; unify duplicated local “design tokens” back to `vars.scss`.
- Ensure accessibility: consistent `:focus-visible` rings, readable contrast, stable hover states.
- Keep UI “data terminal” feel: dense tables remain readable (sticky headers, zebra striping, numeric alignment).

## Non-goals
- Do not change data fetching, business logic, sorting, or calculations.
- Do not redesign information architecture (no feature removals/additions).
- Do not add a new styling framework; remain SCSS Modules + existing shared SCSS.

---

## Scope: Components + Styles (inventory)

### A) GameGrid core
- `web/components/GameGrid/GameGrid.tsx` → `web/components/GameGrid/GameGrid.module.scss`
- `web/components/GameGrid/Header.tsx` → `web/components/GameGrid/GameGrid.module.scss`
- `web/components/GameGrid/TeamRow.tsx` → `web/components/GameGrid/GameGrid.module.scss`
- `web/components/GameGrid/TotalGamesPerDayRow.tsx` → `web/components/GameGrid/GameGrid.module.scss`
- `web/components/GameGrid/VerticalMatchupCell.tsx` → `web/components/GameGrid/GameGrid.module.scss`

### B) Alternate orientation grid
- `web/components/GameGrid/TransposedGrid.tsx` → `web/components/GameGrid/TransposedGrid.module.scss`

### C) Side panels used within GameGrid layout
- `web/components/GameGrid/OpponentMetricsTable.tsx` → `web/components/GameGrid/OpponentMetricsTable.module.scss`
- `web/components/GameGrid/utils/FourWeekGrid.tsx` → `web/components/GameGrid/utils/FourWeekGrid.module.scss`
- `web/components/PlayerPickupTable/PlayerPickupTable.tsx` → `web/components/PlayerPickupTable/PlayerPickupTable.module.scss`

### D) Shared controls used by GameGrid header/grid
- `web/components/GameGrid/Toggle/Toggle.tsx` → `web/components/GameGrid/Toggle/Toggle.module.scss`
- `web/components/GameGrid/Switch/Switch.tsx` → `web/components/GameGrid/Switch/Switch.module.scss`

### E) “PDHC” overlays (rendered from TeamRow; must match brand)
- `web/components/GameGrid/PDHC/Tooltip.tsx` → `web/styles/pdhcTooltip.module.scss`
- `web/components/GameGrid/PDHC/PoissonHeatMap.tsx` → `web/styles/PoissonHeatmap.module.scss`

---

## Brand Requirements (extract from `fhfh-styles.md`)
You must implement the GameGrid with these recognizable Draft Dashboard cues:
- Canvas + surfaces: `$background-dark`, `$background-medium`, subtle gradients (avoid flat black blocks).
- Glass: `@include v.glass-panel(...)` and/or `_panel.scss` mixins (`panel-container`, `panel-title`).
- Titles: `Train One`, uppercase, letter spacing ~`0.08em`, with accent spans in `$primary-color`.
- Neon accents: functional (active, selected, important), never random.
- Buttons: gradient primary CTA, ghost toggles, icon buttons with cyan focus ring.
- Tables: sticky headers, zebra striping, hover override, numeric alignment (`tabular-nums`).
- Scrollbars: always style internal scrollers with `@include v.custom-scrollbar(...)`.

---

## High-Level Strategy
The GameGrid already contains partial “dashboard framing” ideas; the refactor should **finish the job** by:
1) Replacing mixed/duplicated local tokens with canonical `vars.scss` tokens.
2) Unifying the surface system across *all* GameGrid subpanels: header, schedule grid, rails, tables, drawers, and overlays.
3) Normalizing interaction language: hover lift, glow rings, consistent button/toggle patterns.
4) Migrating legacy raw hex colors to brand tokens (or to CSS vars derived from tokens).

---

## Execution Plan (tasks + subtasks)

### 0) Preconditions (do this first)
- Open and summarize the key rules from `fhfh-styles.md` as a checklist you will apply to every component.
- Confirm `@use` patterns:
  - SCSS Modules should use: `@use "sass:color"; @use "styles/vars" as v;`
  - Use `_panel.scss` helpers where appropriate: `@use "styles/panel" as panel;`

### 1) Audit: current style drift + hotspots
For each in-scope SCSS file:
- Identify any hard-coded colors (hex/rgb/rgba) that overlap tokens in `vars.scss`.
- Identify duplicated local “design tokens” (custom border radii, shadows, transitions, breakpoints).
- Identify inconsistent typography (fonts, casing, letter spacing).
- Identify inconsistent component framing (double borders, competing outlines, mismatched radii).

Deliverable: a short “before” list of key inconsistencies you will fix (no code yet).

### 2) Establish the GameGrid page shell to match the Draft Dashboard
Target: the GameGrid should feel like a sibling page to Draft Dashboard.

In `web/components/GameGrid/GameGrid.module.scss`:
- Ensure the canvas uses `$background-dark` and that large containers use `$background-medium` / glass gradients.
- Replace ad-hoc box shadows with `$desktop-panel-shadow` and/or `$box-shadow-default`.
- Remove or reduce any thick, fully opaque neon borders that overpower content; favor 1–2px borders + glow.
- Normalize spacing to `v.$space-*`.
- Convert local breakpoints to use `v.$breakpoint-*` where possible.

### 3) Header refactor (command-center controls bar)
Target: GameGrid header should read like Draft Dashboard’s top bars.

In `Header.tsx` + `GameGrid.module.scss`:
- Standardize the header title recipe (accent font, uppercase, letter spacing, cyan accent span).
- Make toggle buttons match Draft Dashboard toggle recipe:
  - container: dark pill w/ border
  - active: `$primary-color-opaque` fill + 2px primary border
  - hover: subtle cyan tint
- Standardize nav buttons to primary/ghost patterns (avoid custom hard-coded rgba cyan values).
- Ensure focus rings use `:focus-visible` and match `v.$focus-ring-desktop` where possible.

### 4) Schedule grid (TeamRow, TotalGamesPerDayRow, VerticalMatchupCell)
Target: dense terminal table with neon cues that are readable and not noisy.

In `GameGrid.module.scss` (and any small markup adjustments if necessary):
- Sticky header: ensure day headers are sticky and have a dark elevated background.
- Zebra striping: subtle `color.adjust($background-dark, $lightness: ...)` pattern.
- Hover: one consistent hover background that overrides zebra and intensity backgrounds cleanly.
- Intensity cues:
  - Ensure “off-night/mid/heavy” colors derive from the unified schedule tokens in `vars.scss` (`$schedule-green`, `$schedule-yellow`, `$schedule-red`) and their opacity ramps.
  - If CSS variables are used, initialize them from tokens (no raw hex).
- Badges/icons:
  - Home/away badges should align to the neon badge recipe (small, readable, subtle glow).
  - Ensure icons/logos never break row height; keep clip/overflow rules consistent.

### 5) Side tables: OpponentMetricsTable + FourWeekGrid
Target: these two tables should look like Draft Dashboard tables embedded in glass panels.

In `OpponentMetricsTable.module.scss` and `FourWeekGrid.module.scss`:
- Keep using `_panel.scss` mixins but align typography and table density to Draft Dashboard patterns:
  - header font sizing, uppercase letter spacing, sticky header backgrounds
  - row height + padding consistent between these tables
- Standardize sort button affordances:
  - hover/focus states match Draft Dashboard (cyan hover text + focus ring)
- Replace any table zebra backgrounds that use raw RGBA with `color.adjust(v.$background-dark, ...)` ramps.

### 6) PlayerPickupTable (filters + table + pagination)
Target: reads like a Draft Dashboard “panel + controls + dense table”.

In `PlayerPickupTable.module.scss`:
- Ensure filters container and table container are brand-consistent glass panels.
- Convert hard-coded `#07aae2` (and other raw literals) into `v.$secondary-color` / `v.$primary-color`.
- Normalize control components (selects, inputs, buttons) to the standard recipes:
  - background `$background-dark`
  - border `1px solid $border-secondary`
  - focus ring 2px cyan
- Standardize “metric selection” borders and indicators using tokens.
- Ensure internal scrollers use `@include v.custom-scrollbar(...)` rather than custom WebKit-only snippets.

### 7) TransposedGrid (legacy table styling overhaul)
Target: remove “old theme” (raw greys, borders) and make it match the dashboard table system.

In `TransposedGrid.module.scss`:
- Replace all raw hex colors with `vars.scss` tokens.
- Replace legacy borders (`#606060`, `#505050`) with `$border-secondary` / `$border-primary`.
- Replace `background-color: #101010` with `$background-dark`/`$surface-*`.
- Adopt the same sticky first-column approach but using token-based backgrounds and separators:
  - Use `_panel.scss` `first-col-separator` mixin if applicable.
- Replace `.red/.green/...` classes with the global utility fills already in `_panel.scss` (`.red`, `.orange`, `.yellow`, `.green`, `.grey`) OR rewrite them to use the schedule token mixins in `vars.scss` (`schedule-fill`, `schedule-outline`).

### 8) Switch + Toggle controls
Target: consistent, subtle neon controls (not “different design language”).

In `Toggle.module.scss` and `Switch.module.scss`:
- Remove any hard-coded cyan RGBA values (e.g. `rgba(7, 170, 226, 0.2)`); use tokens:
  - `$primary-color`, `$secondary-color`, `$primary-color-opaque`, `$focus-ring-desktop`
- Ensure `:focus-visible` matches dashboard focus style.
- Keep accessibility behavior intact (keyboard support already exists).

### 9) PDHC Tooltip + Poisson heatmap overlays
Target: overlays must feel like Draft Dashboard modals.

In `web/styles/pdhcTooltip.module.scss` and `web/styles/PoissonHeatmap.module.scss`:
- Convert raw values to tokens (`v.$background-dark`, `v.$border-secondary`, `v.$primary-color`, `v.$secondary-color`).
- Apply glass/backdrop styling consistent with dashboard overlays:
  - backdrop: dark + subtle cyan radial glow + blur
  - modal content: dark elevated surface, neon border, readable title bar
- Keep existing CSS variable hooks for team colors, but ensure “default fallbacks” still match the neon noir palette.

---

## Cross-Reference Checks (variables + mixins)
Before finalizing:
1) Ensure every `v.$...` variable used in modified SCSS exists in `web/styles/vars.scss`.
2) Ensure every `panel.*` mixin/class referenced exists in `web/styles/_panel.scss`.
3) Ensure no new raw color literals were added where a token exists.

Recommended Codex commands:
- List all vars used:  
  - `rg -o \"v\\.\\$[A-Za-z0-9_-]+\" web/components/GameGrid web/components/PlayerPickupTable web/styles -S | sort -u`
- Confirm definitions exist:  
  - `rg -n \"^\\$[A-Za-z0-9_-]+:\" web/styles/vars.scss`
- Find raw color literals to eliminate:  
  - `rg -n \"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b|rgba?\\(\" web/components/GameGrid web/components/PlayerPickupTable web/styles -S`

---

## Syntax + Build Safety Checks
Run at minimum:
- `pnpm -C web lint`

If time permits (preferred):
- `pnpm -C web test`
- `pnpm -C web build` (optional; can be slower)

Also check for SCSS compilation errors by ensuring the Next build/lint succeeds; do not ship broken SCSS.

---

## Acceptance Criteria
- GameGrid page looks like it belongs in the Draft Dashboard brand (surface, typography, neon accents, interactions).
- All in-scope panels share a consistent component grammar:
  - glass panels, title bars, consistent table styling, consistent controls.
- No broken layouts at common widths (desktop, tablet, mobile).
- No new ESLint/type errors; styles compile cleanly.
- All tokens referenced exist in `vars.scss` / `_panel.scss` (or were deliberately added with justification).

---

## Implementation Notes (guardrails)
- Prefer adjusting SCSS Modules first; only touch TSX when required for className hooks or small semantic wrappers.
- Keep class names stable when possible to minimize blast radius.
- Prefer token-driven values and mixins over one-off numbers; where you must use a number (e.g., pixel-perfect grid cell sizing), document why in the PR summary (not inline comments).
- Avoid introducing new global styles; keep changes scoped to modules unless the style is truly global and reusable.

