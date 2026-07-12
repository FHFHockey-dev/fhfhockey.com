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
  - [ ] 1.3 Inventory raw colors, duplicate tokens, local radii/shadows/transitions/breakpoints, inconsistent type, double borders, and obsolete `.module.css` duplicates across the scoped files.
  - [ ] 1.4 Classify each finding as token replacement, shared mixin adoption, local exception, semantic/markup prerequisite, or functional issue to append outside this style list.
  - [ ] 1.5 Confirm every planned `v.$...` token and `panel.*` helper exists before implementation.

- [ ] 2.0 Align the Game Grid page shell and command header
  - [ ] 2.1 Apply the dark canvas, layered background, glass/elevated panels, canonical borders/radii/shadows, and spacing scale to the main shell without changing layout logic.
  - [ ] 2.2 Remove overpowering opaque neon framing and use functional cyan accents, subtle glow, and one consistent panel hierarchy.
  - [ ] 2.3 Apply the canonical title recipe, metadata/subtitle hierarchy, command-bar spacing, and responsive wrapping to the header.
  - [ ] 2.4 Normalize primary, ghost, icon, toggle, and navigation controls with clear active/disabled/hover/pressed/focus-visible states.
  - [ ] 2.5 Verify header controls remain keyboard operable, labeled, and usable at narrow widths.

- [ ] 3.0 Restyle the schedule grid as a dense data-terminal table
  - [ ] 3.1 Standardize sticky day headers, first columns, separators, z-index layers, table density, numeric alignment, and internal scroll behavior.
  - [ ] 3.2 Use canonical zebra and one hover/selected override that remains legible over schedule-intensity fills.
  - [ ] 3.3 Derive off-night/mid/heavy and outline states from shared schedule tokens and opacity/mixin ramps; remove equivalent raw colors.
  - [ ] 3.4 Normalize team/logo sizing, home/away and status badges, cell padding, truncation, and focus/interactive cues without changing row data.
  - [ ] 3.5 Verify horizontal/vertical sticky intersections, overflow, touch scrolling, and row/cell readability across orientations and breakpoints.

- [ ] 4.0 Align side tables and pickup controls with the shared panel/table system
  - [ ] 4.1 Apply consistent panel framing/title treatment to Opponent Metrics, Four Week Grid, and Player Pickup containers.
  - [ ] 4.2 Normalize table headers, row heights, zebra/hover, sortable controls, selected metrics, numeric columns, pagination, and empty/loading/error states.
  - [ ] 4.3 Normalize selects, inputs, filters, buttons, chips, and metric selectors with shared backgrounds, borders, typography, focus rings, and disabled states.
  - [ ] 4.4 Replace raw colors and WebKit-only scrollbar fragments with tokens and the shared scrollbar mixin.
  - [ ] 4.5 Verify dense data remains readable and controls do not wrap or overflow destructively on mobile/tablet.

- [ ] 5.0 Modernize Transposed Grid without changing its behavior
  - [ ] 5.1 Replace old greys/black backgrounds/borders with canonical surfaces and border tokens.
  - [ ] 5.2 Preserve sticky-first-column behavior using shared separators and correct layered backgrounds.
  - [ ] 5.3 Replace legacy color utility classes with shared schedule fill/outline utilities or documented token-based local equivalents.
  - [ ] 5.4 Align type, density, hover, selected, scroll, and responsive behavior with the primary grid while preserving orientation-specific needs.

- [ ] 6.0 Consolidate Toggle and Switch styling/ownership
  - [ ] 6.1 Verify whether paired `.module.css` files are imported or obsolete before modifying/removing them; deletion requires proven consumer absence.
  - [ ] 6.2 Replace hard-coded cyan/rgba values with shared accent, opaque-fill, border, focus, and transition tokens.
  - [ ] 6.3 Standardize hover, checked/active, disabled, pressed, and focus-visible states across toggle/switch components.
  - [ ] 6.4 Verify accessible names, native semantics/ARIA, keyboard behavior, hit targets, and reduced-motion behavior.

- [ ] 7.0 Align PDHC tooltip and heatmap overlays with FHFH dialogs
  - [ ] 7.1 Apply the shared backdrop, blur, dark elevated shell, border/glow, title/header, close/action, and scrollable-body grammar.
  - [ ] 7.2 Convert default/fallback colors to shared tokens while retaining intentional team-color CSS variable hooks.
  - [ ] 7.3 Verify contrast, placement, viewport collision/overflow, focus entry/trap/return, Escape/close behavior, and mobile scrolling.
  - [ ] 7.4 Avoid canonicalizing feature-specific heatmap/tooltip internals that do not belong in the shared modal shell.

- [ ] 8.0 Reconcile token drift and responsive/accessibility quality
  - [ ] 8.1 Re-run raw-color and token-usage scans; document intentional literals and remove duplicate local design tokens where a canonical value exists.
  - [ ] 8.2 Add shared tokens/mixins only when at least two consumers need the same semantic value and update style documentation if behavior changes.
  - [ ] 8.3 Verify text/icon/control/table contrast, focus visibility, color-independent state, reduced motion, zoom/reflow, touch targets, and screen-reader semantics.
  - [ ] 8.4 Compare desktop/tablet/mobile screenshots against the Draft Dashboard reference grammar and correct material inconsistencies without broad unrelated churn.
  - [ ] 8.5 Confirm no layout shift, clipped content, unreadable sticky layer, or broken team-color fallback remains.

- [ ] 9.0 Run build/visual verification and synchronize scope
  - [ ] 9.1 Run the repository's actual targeted lint/type/style compilation commands discovered from `web/package.json`; do not assume the PRD's old `pnpm` command is current.
  - [ ] 9.2 Run relevant direct/component checks for any semantic markup changes and record why styling-only areas do not need new tests.
  - [ ] 9.3 Use browser verification on representative populated routes and inspect console/runtime errors plus common responsive widths.
  - [ ] 9.4 Recheck that sorting, calculations, data fetching, filters, pagination, toggles, orientation, tooltips, and overlays behave exactly as before.
  - [ ] 9.5 Update the PRD, this list, relevant style references, and master ledger with changed files, screenshots/checks, exceptions, and final evidence.

## NEW Tasks

- [ ] NEW 10.0 Append every verified style defect, semantic prerequisite, functional out-of-scope issue, responsive regression, accessibility gap, and reusable-token opportunity discovered during execution here before closure.
