# Draft Dashboard — Interface Refactor Task List

Updated: 2026-09-04. Status: implementation and local verification complete.

## Skills and scope

- [x] Install the 11 skills from `jakubkrehel/skills` and `make-interfaces-feel-better` in `/Users/tim/.codex/skills/`.
- [x] Apply `better-interface`, `better-layout`, `better-accessibility`, `better-writing`, `better-typography`, `better-colors`, `better-ui`, and `make-interfaces-feel-better` to the populated desktop dashboard.
- [x] Preserve the development maintenance gate, site header, draft state, settings, calculations, imports, provider controls, routing, and existing data sources.
- [x] Keep the detailed two-view settings redesign out of scope while providing its collapsible in-workspace foundation.

## Desktop workspace

- [x] Keep the existing header and add a compact workspace/control bar below it.
- [x] Render Draft Settings as a full-width bordered summary row with a gear icon, current configuration summary, validation state, and one open/close control.
- [x] Keep the settings form mounted when collapsed and give the expanded form an internal scroll area.
- [x] Place Suggested Picks across the top of the working area.
- [x] Keep My Roster as a full-height right rail with team switching and internal scrolling.
- [x] Stack League Standings above Draft Graph in the lower-left column.
- [x] Fill the lower-center area with Available Players.
- [x] Keep the document within one desktop viewport at 1440×900, 1728×900, and 1920×1080; use internal panel scrolling where content exceeds a panel.

## Suggested Picks

- [x] Show six cards at once at every required desktop width.
- [x] Use one shared six-column track calculation for cards and position-progress bars; browser measurements match exactly, including fractional positions.
- [x] Use a true 8px rectangular position-colored left border with no pseudo-element bulb or crescent.
- [x] Keep horizontal overflow, draft, compare, sort, position filters, need weighting, personalization, availability, and roster-progress behavior.
- [x] Remove internal card clipping at the required desktop heights.

## Standings, graph, players, and roster

- [x] Derive standings columns from all active scoring categories.
- [x] Rank higher- and lower-is-better categories correctly and retain tied ranks.
- [x] Use the exact percentile formula `((teamCount - rank + 1) / teamCount) * 100` and the required green/yellow/orange/red quartiles.
- [x] Keep team switching and editing, the current-team indicator, projected score, and team VORP.
- [x] Move the compact round, pick, clock, next-pick, and until-turn status into the Draft Graph header.
- [x] Preserve the existing blue projected-value intensities and yellow current-pick treatment.
- [x] Keep Available Players search, filters, favorites, compare, paging, draft action, value metrics, drafted-player exclusion, and zebra rows.
- [x] Convert sortable table headers from pointer-only table cells to native buttons while retaining `aria-sort` in normal and stat-column modes.
- [x] Keep prior-season expansion keyed by stable player IDs.
- [x] Keep roster position groups, open/full state, position assignment, bench, roster needs, schedule fit, and per-team selection.

## Visual system and accessibility

- [x] Use the existing font variables and tabular numerals for dense changing data.
- [x] Use the shared draft canvas, surface, input, border, zebra, action, and position-color tokens.
- [x] Keep cyan headings, thin structural dividers, restrained focus treatment, and non-color labels for state meaning.
- [x] Measure critical rendered text contrast. Sampled labels, data, headings, and state cells pass WCAG AA; the primary-action color was darkened to raise white text from 4.04:1 to 4.86:1.
- [x] Preserve visible `:focus-visible` styling and accessible names for the main controls.

## Verification

- [x] Draft-focused Vitest suite: 45 files and 175 tests passed.
- [x] Targeted standings and projections-table tests: 2 files and 13 tests passed.
- [x] TypeScript: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` passed. The default heap attempt was inconclusive because Node exhausted memory.
- [x] Targeted ESLint for the changed TypeScript and test files passed with no output.
- [x] `git diff --check` passed for the affected dashboard, test, library, and token paths.
- [x] Browser checks at 1440×900, 1728×900, and 1920×1080 found zero horizontal or vertical document overflow and no framework error overlay.
- [x] Browser interaction check confirmed draft → roster/clock/player-pool/graph updates → undo restoration.
- [x] Browser interaction check confirmed prior-season expansion/collapse, native column sorting, collapsed and expanded settings, six-card alignment, zebra rows, and internal panel containment.
- [x] Final browser console error check returned no errors.

## Explicitly deferred

- [ ] Exercise a real authenticated Yahoo or ESPN provider session in the browser. Provider hooks, workflow logic, and live-panel components pass their local tests; no external account was used for this refactor.
- [ ] Design the detailed two-view settings experience shown beyond the requested foundation.
