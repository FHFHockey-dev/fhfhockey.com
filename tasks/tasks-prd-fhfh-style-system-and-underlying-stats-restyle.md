## Relevant Files

- `tasks/prd-fhfh-style-system-and-underlying-stats-restyle.md` - Source PRD defining the style-system, sandbox, token, and `underlying-stats` restyle scope.
- `fhfh-styles.md` - Canonical prompt-style design system document to be rewritten with explicit rules, examples, approval guidance, and future Codex instructions.
- `web/styles/vars.scss` - Primary shared token source for colors, spacing, typography, borders, shadows, breakpoints, and any new variables required by the style system.
- `web/styles/_panel.scss` - Shared panel and surface mixins that should be aligned with the new canonical panel, header, and container rules.
- `web/pages/cssTestingGrounds.tsx` - New sandbox/showcase page for isolated review of canonical UI primitives.
- `web/pages/cssTestingGrounds.module.scss` - Styles for the sandbox/showcase page and its canonical example blocks.
- `web/pages/draft-dashboard.tsx` - Entry route used to inspect the rendered Draft Dashboard reference surface.
- `web/components/DraftDashboard/DraftDashboard.tsx` - Root dashboard composition and source of shared page-shell/layout patterns.
- `web/components/DraftDashboard/DraftDashboard.module.scss` - Root dashboard layout, panel, and button patterns to audit and potentially normalize.
- `web/components/DraftDashboard/DraftBoard.tsx` - Draft board surface used to extract table, header, badge, and status patterns.
- `web/components/DraftDashboard/DraftBoard.module.scss` - Draft board styling reference for dense data grids, panel headers, and stateful cells.
- `web/components/DraftDashboard/DraftSettings.tsx` - Reference component for toggles, controls, settings groups, inputs, and action clusters.
- `web/components/DraftDashboard/DraftSettings.module.scss` - Reference styling for segmented controls, settings blocks, selects, number inputs, and compact buttons.
- `web/components/DraftDashboard/MyRoster.tsx` - Reference component for roster cards, progress sections, and data-dense panel composition.
- `web/components/DraftDashboard/MyRoster.module.scss` - Reference styling for roster modules, summary cards, progress bars, and nested sections.
- `web/components/DraftDashboard/SuggestedPicks.tsx` - Reference component for card rails, filters, compact controls, and recommendation layouts.
- `web/components/DraftDashboard/SuggestedPicks.module.scss` - Reference styling for cards with left accent borders, compact controls, and hover/selected states.
- `web/components/DraftDashboard/ProjectionsTable.tsx` - Reference table-heavy surface for shared grid, filtering, sorting, and action patterns.
- `web/components/DraftDashboard/ProjectionsTable.module.scss` - Reference styling for large data tables and advanced table controls.
- `web/components/DraftDashboard/DraftSummaryModal.tsx` - Reference modal structure for overlay and dialog rules if modals are included in the canonical system.
- `web/components/DraftDashboard/DraftSummaryModal.module.scss` - Reference modal styling for overlay surfaces and dialog internals.
- `web/components/DraftDashboard/ComparePlayersModal.tsx` - Additional modal/reference surface for table and comparison layouts.
- `web/components/DraftDashboard/ComparePlayersModal.module.scss` - Styling reference for comparison overlays and dense modal content.
- `web/components/DraftDashboard/ImportCsvModal.tsx` - Reference modal/workflow surface for dialog accessibility, overlays, and complex modal body structure.
- `tasks/tasks-prd-fhfh-style-system-and-underlying-stats-restyle.md` - Active implementation checklist for this PRD; must stay updated as subtasks complete and new work is discovered.
- `web/pages/underlying-stats/index.tsx` - Production `underlying-stats` entry page that uses `indexUS.module.scss` and must be aligned to the new system.
- `web/pages/underlying-stats/indexUS.module.scss` - Existing stylesheet for the top-level `underlying-stats` entry page to be restyled using canonical tokens and patterns.
- `web/pages/underlying-stats/playerStats/index.tsx` - Production player-stats landing page to be restyled using the new system.
- `web/pages/underlying-stats/playerStats/playerStats.module.scss` - Actual stylesheet used by `playerStats/index.tsx`; primary target for the player landing-page restyle.
- `web/pages/underlying-stats/playerStats/[playerId].tsx` - Adjacent detail surface that should be evaluated for alignment or documented deferral.
- `web/pages/underlying-stats/playerStats/index.test.tsx` - Existing test coverage that may need updates if markup or visible headings/labels change.
- `web/pages/underlying-stats/playerStats/[playerId].test.tsx` - Existing detail-page tests that may need updates if the detail surface is touched.
- `web/components/DraftDashboard/DraftDashboard_Audit.md` - Existing audit notes that can be mined or updated when translating dashboard observations into canonical style rules.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- The rule template references `npx jest`, but this repository uses Vitest for the visible page tests; use the project’s existing test commands when updating or running tests.
- Because this project is heavily visual, browser-based verification and sandbox review are required in addition to automated tests.

## Tasks

- [x] 1.0 Audit the rendered `DraftDashboard` and related reference surfaces to extract canonical reusable UI patterns
  - [x] 1.1 Inspect the rendered `draft-dashboard` page in-browser and capture screenshots/notes for each major surface area rather than relying only on JSX and SCSS reads.
  - [x] 1.2 Review the root dashboard shell in `DraftDashboard.tsx` and `DraftDashboard.module.scss` to document page layout, panel structure, spacing, and high-level visual hierarchy patterns.
  - [x] 1.3 Review `DraftSettings.tsx` and `DraftSettings.module.scss` to isolate canonical rules for segmented toggles, settings groups, selects, number inputs, compact action buttons, and grouped controls.
  - [x] 1.4 Review `DraftBoard.tsx` and `DraftBoard.module.scss` to isolate canonical rules for dense tables/grids, panel headers, state badges, pick-status cells, and leaderboard sections.
  - [x] 1.5 Review `MyRoster.tsx`, `MyRoster.module.scss`, `SuggestedPicks.tsx`, `SuggestedPicks.module.scss`, and `ProjectionsTable` to isolate canonical rules for cards, progress blocks, recommendation rails, search/filter controls, and data-table behavior.
  - [x] 1.6 Review supporting modal and overlay surfaces to determine whether dialog patterns should be included in the same style-system pass.
  - [x] 1.7 Produce an audit summary that maps each reusable element family to its current best reference implementation and flags duplicated or conflicting patterns.
  - [x] 1.8 Record any missing element types not represented in `DraftDashboard` and list them as owner-follow-up gaps that need site examples before final canonical rules are written.

- [x] 2.0 Rewrite `fhfh-styles.md` into a complete Codex-oriented style system with explicit element-by-element rules and SCSS examples
  - [x] 2.1 Restructure `fhfh-styles.md` so it reads as a prompt-ready system document instead of a loose aesthetic memo.
  - [x] 2.2 Define non-negotiable brand rules, including the hard rule that gradients are to be used sparingly and are generally not the default background treatment.
  - [x] 2.3 Define page archetypes and layout guidance for dashboard pages, data pages, chart pages, bento-box pages, table-heavy pages, and drill-down/detail pages.
  - [x] 2.4 Define typography rules covering fonts, font sizes, weights, letter spacing, casing, and visual hierarchy for page titles, section titles, subtitles, eyebrow labels, body copy, captions, and footnotes.
  - [x] 2.5 Define the canonical color and border system, including default text colors, accent rules, subdued data-page treatments, state colors, chart colors, and when positional accent colors are allowed.
  - [x] 2.6 Define canonical panel and card patterns, including flat versus elevated surfaces, left-side accent borders, hover/selected/focus behavior, and when to use dashboard-intense versus data-page-softened treatment.
  - [x] 2.7 Define canonical controls, including primary/secondary/ghost/compact buttons, segmented toggles, dropdowns, search boxes, text inputs, number inputs, filter bars, and steppers.
  - [x] 2.8 Define canonical table and chart-container rules, including sticky headers, row density, numeric alignment, sorting affordances, empty/loading/error states, chart framing, and chart toolbar behavior.
  - [x] 2.9 Add “do” and “do not” guidance plus SCSS examples for every core element family so future Codex prompts can be executed from this file alone.
  - [x] 2.10 Add a dedicated section explaining how the sandbox page and approval workflow map back to the style guide, including how newly added showcase items should appear at the top during active review.

- [x] 3.0 Normalize shared design tokens and panel primitives in `vars.scss` and `_panel.scss`, and cross-verify all referenced variables exist
  - [x] 3.1 Audit the existing tokens in `vars.scss` to identify duplicates, conflicting names, obsolete aliases, and missing variables required by the rewritten style guide.
  - [x] 3.2 Add or rename shared tokens in `vars.scss` for any canonical spacing, typography, color, border, shadow, radius, focus, or state values that the new guide depends on.
  - [x] 3.3 Update `_panel.scss` to provide canonical mixins/helpers for panel shells, section headers, scroll wrappers, and related shared surfaces where appropriate.
  - [x] 3.4 Replace or reduce local one-off literals and gradient-heavy assumptions in shared styling helpers where they conflict with the new “gradients sparingly” rule.
  - [x] 3.5 Cross-verify that every token and mixin referenced in `fhfh-styles.md`, the sandbox page, and the restyled production pages actually exists and compiles cleanly.
  - [x] 3.6 Document any intentional legacy aliases that must remain temporarily for compatibility, and distinguish them from the new canonical tokens.

- [x] 4.0 Build `cssTestingGrounds` as the canonical sandbox and approval surface for reusable UI primitives
  - [x] 4.1 Create `web/pages/cssTestingGrounds.tsx` with a layout designed for fast visual inspection and future growth as the style showcase expands.
  - [x] 4.2 Create `web/pages/cssTestingGrounds.module.scss` and implement the canonical sandbox page shell using only approved shared tokens and mixins.
  - [x] 4.3 Add canonical example blocks for page shells, section headers, standard panels, softened data-page panels, left-accent cards, tables, buttons, segmented toggles, dropdowns, search inputs, input rows, empty states, loading banners, and chart frames.
  - [x] 4.4 Ensure newly added or currently-under-review showcase elements can be surfaced at the top of the page without breaking the long-term showcase structure.
  - [x] 4.5 Add labels or annotations inside the sandbox so each showcased element clearly maps to the corresponding section in `fhfh-styles.md`.
  - [x] 4.6 Verify the sandbox page visually in-browser and treat it as the main smoke test surface for approving new base components before broader rollout.
  - [x] 4.7 Run a sequential element-by-element reference-validation pass for every sandbox primitive: identify the closest `DraftDashboard` reference first, fall back to another rendered site example only if the element does not exist there, compare the sandbox recreation against that live reference, and do not advance to the next element until the current one is approved, revised, or explicitly deferred.

- [ ] 5.0 Re-style the `underlying-stats` entry surfaces and align adjacent `playerStats` pages to the new system
  - [ ] 5.1 Review the rendered top-level `underlying-stats` entry page and map its current sections to the new page-shell, panel, control, and table rules.
  - [ ] 5.2 Refactor `web/pages/underlying-stats/index.tsx` markup only as needed to support canonical layout hierarchy, tighter control grouping, and consistent section structure.
  - [ ] 5.3 Rewrite `web/pages/underlying-stats/indexUS.module.scss` to use canonical tokens and shared rules while reducing unnecessary gradients, empty space, and inconsistent control treatment.
  - [ ] 5.4 Review the rendered player-stats landing page and explicitly account for the fact that it uses `playerStats.module.scss`, not `indexUS.module.scss`.
  - [ ] 5.5 Refactor `web/pages/underlying-stats/playerStats/index.tsx` markup only as needed to align hero/header/filter/table sections with the new data-page archetype.
  - [ ] 5.6 Rewrite `web/pages/underlying-stats/playerStats/playerStats.module.scss` to bring the page into alignment with the new system while keeping the softer data-page treatment.
  - [ ] 5.7 Evaluate `web/pages/underlying-stats/playerStats/[playerId].tsx` and its styling surface to decide whether it should be aligned in the same pass or formally documented as deferred.
  - [ ] 5.8 Update or add tests as needed for touched `underlying-stats` pages, then perform browser-based verification to confirm the pages visually align with the new rules on desktop and mobile.

- [ ] 6.0 Define and document the component-by-component signoff workflow, missing-element gap process, and ongoing maintenance rules linking docs, sandbox, tokens, and production
  - [ ] 6.1 Create an itemized approval checklist covering page shells, headers, cards, tables, buttons, toggles, inputs/selects, chart frames, and state banners, and process it strictly one element at a time in review order.
  - [ ] 6.2 For each approval item, document the canonical source pattern, whether that source came from `DraftDashboard` or another site surface, the token dependencies, the sandbox example, and the expected interaction states.
  - [ ] 6.3 Add a documented process for handling missing element types, including how to request a site example from the owner before writing a final canonical rule.
  - [ ] 6.4 Add maintenance guidance stating that changes to canonical styling must stay synchronized across `fhfh-styles.md`, shared tokens/mixins, sandbox examples, and production implementations.
  - [ ] 6.5 Perform a final consistency pass to ensure the rewritten style guide, sandbox examples, shared tokens, and `underlying-stats` production pages all reflect the same canonical decisions.

- [ ] 7.0 Clean up conflicting or duplicated style declarations discovered during the dashboard audit before final canonical rollout
  - [ ] 7.1 Review and consolidate duplicated or conflicting control/checkbox/table style declarations in `web/components/DraftDashboard/ProjectionsTable.module.scss`.
  - [ ] 7.2 Review the nested table-related rules currently scoped under `.summaryValue` in `web/components/DraftDashboard/MyRoster.module.scss` and decide whether they should be relocated, rewritten, or removed as dead/confusing styling.

- [ ] 8.0 Canonicalize shared dialog and overlay patterns as part of the same style-system pass
  - [ ] 8.1 Extract shared modal-shell rules from `DraftSummaryModal`, `ComparePlayersModal`, and `ImportCsvModal`, including backdrop, shell, header, close control, action cluster, and scrollable body behavior.
  - [ ] 8.2 Add modal/dialog guidance to `fhfh-styles.md` and include a representative modal shell example in `cssTestingGrounds` without over-canonicalizing feature-specific modal internals.

- [ ] 9.0 Collect owner-supplied reference pages for missing element families before finalizing canonical rules beyond the dashboard-derived system
  - [ ] 9.1 Request rendered site examples for data-page hero/header systems with breadcrumbs, descriptive copy, and metadata cards.
  - [ ] 9.2 Request rendered site examples for chart-first page layouts, chart-grid layouts, and chart toolbar/legend treatments.
  - [ ] 9.3 Request rendered site examples for advanced dropdown/action menus, pagination patterns, page-level empty states, and inline content callouts if those families need canonical site-wide rules.
