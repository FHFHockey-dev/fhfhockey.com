# Game Grid to Draft Dashboard Brand — Style Overhaul Tasks

## Relevant Files

- `tasks/TASKS/draft-dashboard-yahoo/prd/prd-gamegrid-draft-dashboard-style-overhaul.md` - Source PRD, scope, guardrails, style inventory, and acceptance criteria.
- `tasks/TASKS/draft-dashboard-yahoo/docs/DraftDashboard_Audit.md` - Canonical Draft Dashboard element-family/style reference and known consolidation conflicts.
- `tasks/TASKS/rules/fhfh-styles.md` - FHFH visual system source of truth.
- `tasks/TASKS/rules/brand-style-cheat-sheet.md` - Concise brand/style reference.
- `tasks/TASKS/rules/vars_Audit.md` - Token audit and current variable guidance.
- `web/styles/vars.scss` - Shared tokens, breakpoints, focus rings, schedule colors, and mixins.
- `web/styles/_panel.scss` - Shared panel/table/title helpers.
- `web/components/DraftDashboard/*.module.scss` - Current Neon Noir reference implementations.
- `web/components/GameGrid/GameGrid.module.scss` - Core page shell, header, schedule rows, cells, and responsive layout styles.
- `web/components/GameGrid/TransposedGrid.module.scss` - Alternate-orientation grid styles.
- `web/components/GameGrid/OpponentMetricsTable.module.scss` - Opponent table panel styles.
- `web/components/GameGrid/utils/FourWeekGrid.module.scss` - Four-week grid/table styles.
- `web/components/PlayerPickupTable/PlayerPickupTable.module.scss` - Pickup controls/table/pagination styles.
- `web/components/GameGrid/Toggle/Toggle.module.scss` - Toggle control styles.
- `web/components/GameGrid/Switch/Switch.module.scss` - Switch control styles.
- `web/styles/pdhcTooltip.module.scss` - PDHC tooltip overlay styles.
- `web/styles/PoissonHeatmap.module.scss` - PDHC heatmap modal styles.
- `web/components/GameGrid/PDHC/Tooltip.tsx` - PDHC dialog trigger, ownership, dismissal, and focus lifecycle.
- `web/components/GameGrid/PDHC/Tooltip.test.tsx` - Focus, keyboard, dismissal, and unique-ownership regression coverage.
- `web/components/GameGrid/PDHC/PoissonHeatMap.tsx` - Team-color hooks and feature-specific probability visualization.
- `tasks/TASKS/draft-dashboard-yahoo/gamegrid-draft-dashboard-style-audit-report.md` - Canonical recipes, finding classifications, exceptions, and verification evidence.
- `web/components/GameGrid/*.tsx` - Existing markup/semantic hooks; modify only when SCSS cannot satisfy semantics or class targeting.

### Notes

- This list repairs the missing task-list pair for the Game Grid style PRD.
- Correctness/data/layout-logic changes are out of scope here and remain owned by Game Grid/Draft Dashboard functional initiatives.
- Treat Draft Dashboard as the visual grammar reference, not a reason to copy feature-specific internals or duplicate local tokens.
- Prefer targeted SCSS Module edits and existing tokens/mixins. Add a token only when the semantic value is truly shared and no current token fits.
- Preserve class names and markup where practical. Do not perform broad visual rewrites while functional routes are unstable.
- Styling-only changes normally use direct compilation/visual/accessibility verification; add tests only for required semantic markup or interaction regressions.

## Tasks

- [ ] 1.0 Establish the canonical style checklist and baseline evidence
  - [ ] 1.1 Read the three FHFH style references, `vars.scss`, `_panel.scss`, and relevant Draft Dashboard modules; record the exact surface, type, spacing, border, focus, table, badge, control, modal, scrollbar, and responsive recipes to reuse.
  - [ ] 1.2 Capture current desktop, tablet, and mobile screenshots for Game Grid orientations, side tables, pickup table, controls, tooltip, and heatmap using representative populated data.
  - [x] 1.3 Inventory raw colors, duplicate tokens, local radii/shadows/transitions/breakpoints, inconsistent type, double borders, and obsolete `.module.css` duplicates across the scoped files.
  - [x] 1.4 Classify each finding as token replacement, shared mixin adoption, local exception, semantic/markup prerequisite, or functional issue to append outside this style list.
  - [x] 1.5 Confirm every planned `v.$...` token and `panel.*` helper exists before implementation.

- [ ] 2.0 Align the Game Grid page shell and command header
  - [x] 2.1 Apply the dark canvas, layered background, glass/elevated panels, canonical borders/radii/shadows, and spacing scale to the main shell without changing layout logic.
  - [x] 2.2 Remove overpowering opaque neon framing and use functional cyan accents, subtle glow, and one consistent panel hierarchy.
  - [x] 2.3 Apply the canonical title recipe, metadata/subtitle hierarchy, command-bar spacing, and responsive wrapping to the header.
  - [x] 2.4 Normalize primary, ghost, icon, toggle, and navigation controls with clear active/disabled/hover/pressed/focus-visible states.
  - [x] 2.5 Verify header controls remain keyboard operable, labeled, and usable at narrow widths.

- [ ] 3.0 Restyle the schedule grid as a dense data-terminal table
  - [x] 3.1 Standardize sticky day headers, first columns, separators, z-index layers, table density, numeric alignment, and internal scroll behavior.
  - [x] 3.2 Use canonical zebra and one hover/selected override that remains legible over schedule-intensity fills.
  - [x] 3.3 Derive off-night/mid/heavy and outline states from shared schedule tokens and opacity/mixin ramps; remove equivalent raw colors.
  - [x] 3.4 Normalize team/logo sizing, home/away and status badges, cell padding, truncation, and focus/interactive cues without changing row data.
  - [ ] 3.5 Verify horizontal/vertical sticky intersections, overflow, touch scrolling, and row/cell readability across orientations and breakpoints.

- [ ] 4.0 Align side tables and pickup controls with the shared panel/table system
  - [x] 4.1 Apply consistent panel framing/title treatment to Opponent Metrics, Four Week Grid, and Player Pickup containers.
  - [x] 4.2 Normalize table headers, row heights, zebra/hover, sortable controls, selected metrics, numeric columns, pagination, and empty/loading/error states.
  - [x] 4.3 Normalize selects, inputs, filters, buttons, chips, and metric selectors with shared backgrounds, borders, typography, focus rings, and disabled states.
  - [ ] 4.4 Replace raw colors and WebKit-only scrollbar fragments with tokens and the shared scrollbar mixin.
  - [ ] 4.5 Verify dense data remains readable and controls do not wrap or overflow destructively on mobile/tablet.

- [ ] 5.0 Modernize Transposed Grid without changing its behavior
  - [x] 5.1 Replace old greys/black backgrounds/borders with canonical surfaces and border tokens.
  - [x] 5.2 Preserve sticky-first-column behavior using shared separators and correct layered backgrounds.
  - [x] 5.3 Replace legacy color utility classes with shared schedule fill/outline utilities or documented token-based local equivalents.
  - [ ] 5.4 Align type, density, hover, selected, scroll, and responsive behavior with the primary grid while preserving orientation-specific needs.

- [x] 6.0 Consolidate Toggle and Switch styling/ownership
  - [x] 6.1 Verify whether paired `.module.css` files are imported or obsolete before modifying/removing them; deletion requires proven consumer absence.
  - [x] 6.2 Replace hard-coded cyan/rgba values with shared accent, opaque-fill, border, focus, and transition tokens.
  - [x] 6.3 Standardize hover, checked/active, disabled, pressed, and focus-visible states across toggle/switch components.
  - [x] 6.4 Verify accessible names, native semantics/ARIA, keyboard behavior, hit targets, and reduced-motion behavior.

- [x] 7.0 Align PDHC tooltip and heatmap overlays with FHFH dialogs
  - [x] 7.1 Apply the shared backdrop, blur, dark elevated shell, border/glow, title/header, close/action, and scrollable-body grammar.
  - [x] 7.2 Convert default/fallback colors to shared tokens while retaining intentional team-color CSS variable hooks.
  - [x] 7.3 Verify contrast, placement, viewport collision/overflow, focus entry/trap/return, Escape/close behavior, and mobile scrolling.
  - [x] 7.4 Avoid canonicalizing feature-specific heatmap/tooltip internals that do not belong in the shared modal shell.

- [ ] 8.0 Reconcile token drift and responsive/accessibility quality
  - [ ] 8.1 Re-run raw-color and token-usage scans; document intentional literals and remove duplicate local design tokens where a canonical value exists.
  - [x] 8.2 Add shared tokens/mixins only when at least two consumers need the same semantic value and update style documentation if behavior changes.
  - [ ] 8.3 Verify text/icon/control/table contrast, focus visibility, color-independent state, reduced motion, zoom/reflow, touch targets, and screen-reader semantics.
  - [ ] 8.4 Compare desktop/tablet/mobile screenshots against the Draft Dashboard reference grammar and correct material inconsistencies without broad unrelated churn.
  - [ ] 8.5 Confirm no layout shift, clipped content, unreadable sticky layer, or broken team-color fallback remains.

- [ ] 9.0 Run build/visual verification and synchronize scope
  - [x] 9.1 Run the repository's actual targeted lint/type/style compilation commands discovered from `web/package.json`; do not assume the PRD's old `pnpm` command is current.
  - [x] 9.2 Run relevant direct/component checks for any semantic markup changes and record why styling-only areas do not need new tests.
  - [ ] 9.3 Use browser verification on representative populated routes and inspect console/runtime errors plus common responsive widths.
  - [ ] 9.4 Recheck that sorting, calculations, data fetching, filters, pagination, toggles, orientation, tooltips, and overlays behave exactly as before.
  - [x] 9.5 Update the PRD, this list, relevant style references, and master ledger with changed files, screenshots/checks, exceptions, and final evidence.

## NEW Tasks

- [ ] NEW 10.0 Append every verified style defect, semantic prerequisite, functional out-of-scope issue, responsive regression, accessibility gap, and reusable-token opportunity discovered during execution here before closure.
- [x] NEW 11.0 Repair the PDHC overlay's modal semantics and interaction contract: unique ownership IDs, keyboard-operable trigger, focus entry/trap/return, persistent close control, Escape dismissal, and viewport-safe scrolling.

## Completion Reconciliation — July 2026

- The owner-approved Game Grid Phase-1 contract and completed Phase-2 shell audit prove the existing shared-token page shell, compact command header, table/header language, schedule-state styling, icons/logos, responsive wrapping, and focus/control states without a speculative CSS rewrite. Existing `vars.scss` and panel helpers were sufficient.
- The schedule grid already uses sticky headers/identity columns, dense alignment, zebra/hover treatments, shared schedule tokens, stable logo/badge/cell behavior, and unchanged row data. `TransposedGrid.module.scss` likewise uses canonical surfaces/borders, the shared first-column separator, and token-based schedule fill/outline classes.
- Exact imports prove Toggle and Switch consume their `.module.scss` files; the paired `.module.css` files are obsolete but intentionally retained pending the list's later controlled cleanup. The SCSS supplies hover/active/disabled/focus/high-contrast/reduced-motion states, and the actual controls expose labeled native switch semantics with pointer/Enter/Space behavior.
- Four focused Game Grid files pass 11/11 tests. The previously recorded full TypeScript pass and successful `/game-grid/7-Day-Forecast` Sass/route compilation satisfy the targeted command rows. This reconciliation closes 16/52 rows while leaving the shell parent and narrow-width control proof, screenshots, sticky/overflow breakpoint proof, complete hit-target verification, full raw-color/token cleanup, side-table/pickup/overlay styling, broad visual/accessibility verification, final behavior parity, and final synchronization open.
- This historical evidence import did not authorize B-GAMEGRID Phase 3. Phases 3–4 were later owner-authorized and completed under the approved defaults; Phase 5 and its populated cross-breakpoint/Player Pickup proof remain separately gated.

## Style/accessibility execution — July 2026

- The canonical inventory and classification are recorded in `gamegrid-draft-dashboard-style-audit-report.md`. Opponent Metrics, Four Week Grid, and Player Pickup already use the shared panel/control/state recipes, so 4.1–4.3 close without duplicate styling churn; raw-literal cleanup and Phase-5 populated responsive proof remain open.
- Toggle/Switch now source transition and literal color ownership from shared tokens, retain at least 24px targets, and suppress focus/ripple animation under reduced motion. Their existing native/named switch semantics and pointer/Enter/Space behavior remain covered.
- NEW 11.0 repairs the PDHC overlay as a bounded modal dialog with unique ownership, a keyboard-operable trigger, persistent close action, focus entry/trap/return, Escape/backdrop dismissal, shared scrolling/breakpoint treatment, and a token-owned neutral fallback. The feature-specific Poisson scale and team-color variables remain intentionally local.
- Four focused files pass 12/12 tests; TypeScript, targeted lint, the normalized-file Prettier gate, and four direct Sass compilations pass. The legacy Poisson/PRD files retain their parent-proven whole-file format instead of introducing unrelated normalization churn. Browser inspection at 1440, 834, and 390 px finds no body/main overflow or runtime error on the current production route. Offseason-empty data leaves populated orientation, Player Pickup, and live-overlay visual proof open.
