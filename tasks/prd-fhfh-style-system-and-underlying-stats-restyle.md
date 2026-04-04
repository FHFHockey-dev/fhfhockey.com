# PRD: FHFH Style System Canonicalization and Underlying Stats Restyle

## Introduction / Overview

FHFHockey.com currently has strong visual patterns, but they are not yet expressed as a single reliable styling system that a junior developer, or Codex in a future prompt, can apply consistently across the site. The `DraftDashboard` surface is the best current reference because it contains a wide range of reusable UI primitives: dashboard shells, segmented toggles, cards, tables, search controls, buttons, headers, dense data layouts, and stateful panels.

This project will do three connected things in one coordinated pass:

1. Audit the rendered `DraftDashboard` experience component by component using browser-based inspection rather than static JSX/CSS reading alone.
2. Rewrite [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md) into a canonical prompt-style design system that is explicit enough for Codex to restyle future pages from that file alone.
3. Implement the first production application of that system by restyling the `underlying-stats` entry surfaces so they align with the site-wide design rules while remaining slightly calmer than `DraftDashboard`.

Important current-state note:

- [indexUS.module.scss](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss) styles [index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx).
- [playerStats/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/index.tsx) is styled by [playerStats.module.scss](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/playerStats.module.scss), not `indexUS.module.scss`.

The end state should allow a future prompt such as “Please re-style `[page]` per the rules in `fhfh-styles.md`” to be actionable without extra interpretation.

## Goals

1. Establish a single canonical style guide in [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md) that defines FHFH visual rules in prompt-ready language, with enough specificity for Codex to apply them consistently.
2. Use the rendered `DraftDashboard` UI as the primary reference system for reusable site patterns, while softening that treatment slightly for data pages that should have less dashboard chrome.
3. Standardize the styling anatomy for core UI primitives: page shells, backgrounds, headers, subtitles, cards, tables, buttons, toggles, inputs, dropdowns, search boxes, steppers, chips, banners, empty states, loading states, and chart containers.
4. Ensure style tokens are governed centrally through [vars.scss](/Users/tim/Code/fhfhockey.com/web/styles/vars.scss) and [_panel.scss](/Users/tim/Code/fhfhockey.com/web/styles/_panel.scss), with missing variables added there rather than invented locally inside feature modules.
5. Create a reusable sandbox page for element approval and smoke testing so new or revised primitives can be reviewed in isolation before or during production usage.
6. Restyle the `underlying-stats` entry surfaces to prove the new style guide works in production and is not merely aspirational documentation.
7. Define a component-by-component approval workflow so future design work can be reviewed in small, isolated chunks instead of large all-at-once visual rewrites.

## User Stories

1. As the site owner, I want a single styling rulebook that is explicit enough for Codex to follow without me re-explaining the site aesthetic every time.
2. As the site owner, I want `DraftDashboard` to serve as the primary source of truth for reusable interface patterns because it already contains many of the interaction types used across the site.
3. As a junior developer, I want each element type documented with anatomy, variables, states, and example CSS so I can implement new pages without guessing.
4. As a junior developer, I want a sandbox page that shows canonical examples of cards, tables, toggles, buttons, dropdowns, search fields, and other primitives so I can validate styles before touching a production page.
5. As a future Codex agent, I want [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md) to tell me what to do for each element type, page archetype, and token decision so I can execute a restyle prompt consistently.
6. As a site visitor, I want `underlying-stats` pages to feel visually related to the rest of FHFHockey.com, with clearer hierarchy, tighter controls, and more consistent UI treatment.

## Functional Requirements

1. The system must audit the rendered `DraftDashboard` interface in-browser and use that inspection as the foundation for style decisions.
2. The audit must cover at minimum the following reference files and their rendered output:
   - [draft-dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/draft-dashboard.tsx)
   - [DraftDashboard.tsx](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/DraftDashboard.tsx)
   - [DraftDashboard.module.scss](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/DraftDashboard.module.scss)
   - [DraftBoard.tsx](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/DraftBoard.tsx)
   - [DraftBoard.module.scss](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/DraftBoard.module.scss)
   - [DraftSettings.tsx](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/DraftSettings.tsx)
   - [DraftSettings.module.scss](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/DraftSettings.module.scss)
   - [MyRoster.tsx](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/MyRoster.tsx)
   - [MyRoster.module.scss](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/MyRoster.module.scss)
   - [SuggestedPicks.tsx](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/SuggestedPicks.tsx)
   - [SuggestedPicks.module.scss](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/SuggestedPicks.module.scss)
3. The audit should also review supporting `DraftDashboard` components when they materially define reusable styling patterns, including `ProjectionsTable`, compare modals, summary modals, and import flows.
4. The resulting [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md) must be rewritten as a Codex-oriented prompt document rather than a loose brand note.
5. The style guide must define page-level archetypes, including:
   - dashboard pages
   - data pages
   - chart pages
   - bento-box layouts
   - table-heavy pages
   - detail/drill-down pages
6. The style guide must define visual hierarchy rules for:
   - page backgrounds
   - outer page padding
   - section spacing
   - headers
   - titles
   - subtitles
   - eyebrow labels
   - metadata blocks
   - captions
   - footnotes
7. The style guide must define typography rules, including font families, font sizes, weights, line heights, letter spacing, casing, and where each text style is appropriate.
8. The style guide must define the color system and state when each color family is allowed, including default text colors, borders, accents, state colors, position colors, chart colors, and subdued variants for data pages.
9. The style guide must define hard rules for gradients:
   - gradients must be used sparingly
   - gradients should generally not be the default page background treatment
   - any allowed gradient usage must be documented by component type and purpose
10. The style guide must define panel and card rules, including:
    - default background treatment
    - border treatment
    - shadow treatment
    - left-side flat accent border usage
    - padding
    - hover behavior
    - selected behavior
    - focus-visible behavior
    - when a card should look “dashboard-like” versus “data-page-like”
11. The style guide must define button rules for primary, secondary, ghost, compact action, destructive, and icon-only buttons, including standard sizes, padding, border radius, hover/focus behavior, and when each button type should be used.
12. The style guide must define toggle and segmented-control rules, including canonical active/inactive/hover/focus states derived from `DraftDashboard`.
13. The style guide must define form control rules for search inputs, number inputs, selects, dropdown menus, filter bars, steppers, and helper text.
14. The style guide must define data table rules, including sticky headers, condensed spacing, numeric alignment, sorting affordances, striped rows, hover states, action cells, scroll behavior, and empty/loading/error states.
15. The style guide must define chart container rules, chart header rules, chart legends, chart toolbars, and how chart pages differ from dashboard cards.
16. The style guide must define loading, empty, warning, and error banners with canonical tone, border, text, and spacing rules.
17. The style guide must include “do” and “do not” guidance wherever necessary to prevent style drift.
18. The style guide must include concrete SCSS examples for every core element family so a developer can copy the intended pattern.
19. The style guide must tie every canonical style back to token usage, pointing to [vars.scss](/Users/tim/Code/fhfhockey.com/web/styles/vars.scss) and [_panel.scss](/Users/tim/Code/fhfhockey.com/web/styles/_panel.scss) as the central variable/mixin sources.
20. If a needed token does not exist in [vars.scss](/Users/tim/Code/fhfhockey.com/web/styles/vars.scss) or [_panel.scss](/Users/tim/Code/fhfhockey.com/web/styles/_panel.scss), the implementation must add it there instead of introducing one-off literals in feature modules.
21. The implementation must cross-verify that every token referenced by the updated guide and restyled components exists and resolves correctly.
22. The project must create a dedicated sandbox page and stylesheet:
    - [cssTestingGrounds.tsx](/Users/tim/Code/fhfhockey.com/web/pages/cssTestingGrounds.tsx)
    - [cssTestingGrounds.module.scss](/Users/tim/Code/fhfhockey.com/web/pages/cssTestingGrounds.module.scss)
23. The sandbox page must contain dummy/canonical examples of reusable primitives, including at minimum:
    - page shell
    - section header
    - standard panel
    - data-page panel
    - card with left accent border
    - table
    - button family
    - segmented toggle
    - dropdown/select
    - search box
    - input row
    - empty state
    - loading banner
    - chart frame
24. New or revised sandbox elements must be placed at the top of the page during review so the owner does not need to keep scrolling farther down as the showcase grows.
25. After approval, sandbox elements may either remain as canonical showcase examples or be removed, but the decision and intended long-term pattern must be documented in [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md).
26. The implementation must restyle the `underlying-stats` entry surfaces to align with the new guide, including at minimum:
    - [index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx)
    - [indexUS.module.scss](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss)
    - [playerStats/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/index.tsx)
    - [playerStats.module.scss](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/playerStats.module.scss)
27. The implementation must evaluate adjacent `underlying-stats` detail surfaces that share the same system, including [playerStats/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/[playerId].tsx), and either:
    - bring them into alignment in the same pass, or
    - document precisely why they are deferred.
28. The visual direction for `underlying-stats` pages must use `DraftDashboard` as the structural reference while softening the treatment slightly for data pages with less decorative chrome.
29. The restyle must reduce unnecessary empty space, tighten control groupings, and improve visual continuity between headers, filters, summary sections, and tables.
30. The implementation must preserve usability and readability on desktop and mobile and document any responsive rules that differ by page archetype.
31. The project must define a component-by-component signoff workflow for approval of:
    - page shells
    - headers
    - cards
    - tables
    - buttons
    - toggles
    - inputs and selects
    - charts and chart frames
    - state banners
32. Each signoff item must identify:
    - the canonical source pattern
    - the tokens it uses
    - the sandbox or production example used for review
    - what visual behaviors are required
33. If the audit finds a needed element type that is not represented in `DraftDashboard`, the implementation must explicitly log that gap and request a site example from the owner before defining the final canonical rule.
34. The rewritten [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md) must be sufficient for a future Codex prompt of the form “Please re-style `[page]` per the rules in `fhfh-styles.md`.”
35. The completed implementation must avoid silent drift between the documentation, sandbox examples, tokens, and production components. If one changes, the others must be updated in the same pass.

## Non-Goals (Out of Scope)

1. This project will not redesign the site into a different brand identity. The FHFH dark aesthetic remains.
2. This project will not turn all pages into literal clones of `DraftDashboard`. Data pages should inherit its discipline, not all of its chrome.
3. This project will not replace the existing site with a new design system technology such as Tailwind, CSS-in-JS, or a third-party component library.
4. This project will not refactor unrelated product logic, API contracts, or page data-fetching unless styling work requires a minimal markup adjustment.
5. This project will not fully redesign every page on the site in one pass. It establishes the system and proves it on `underlying-stats`.
6. This project will not define rules for elements that have no source example and no owner-provided reference. Those must be called out as gaps instead of improvised.

## Design Considerations

### Current Rendered Findings

1. The rendered `DraftDashboard` is compact, segmented, dense, and tool-like. It uses narrow paddings, clear border hierarchy, strong control grouping, and repeated component idioms.
2. The rendered `playerStats` landing page currently uses a larger hero treatment, heavier background effects, and more open spacing, which makes it feel less integrated with the tighter application surfaces elsewhere on the site.
3. The current site documentation over-indexes on neon/glass language. The new guide must preserve FHFH identity without encouraging overuse of gradients, blur, or glow.

### Desired Visual Direction

1. Keep the dark FHFH identity.
2. Use `DraftDashboard` as the starting structural template.
3. Soften dashboard chrome slightly for data pages.
4. Use gradients only as an accent tool, not a baseline surface treatment.
5. Prefer disciplined spacing, clear border hierarchy, restrained highlights, and readable typography over decorative effects.

### Style Guide Structure

The rewritten guide should be organized so Codex can apply it directly. It should include:

1. Brand principles and non-negotiable visual rules.
2. Canonical token usage.
3. Page archetypes.
4. Component catalog by element type.
5. Interaction states.
6. Responsive guidance.
7. Approval workflow.
8. Sandbox references.
9. “If you see X, style it like Y” prompt-style mapping guidance.

## Technical Considerations

1. Centralize tokens in [vars.scss](/Users/tim/Code/fhfhockey.com/web/styles/vars.scss) and shared mixins/panel primitives in [_panel.scss](/Users/tim/Code/fhfhockey.com/web/styles/_panel.scss).
2. Audit current token usage for duplication, contradictory names, and obsolete gradient-heavy helpers.
3. Remove or de-emphasize one-off literals from feature SCSS where canonical tokens should exist.
4. Validate that any examples written into [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md) reflect tokens and mixins that exist in the codebase.
5. Ensure the sandbox page is easy to extend and can serve as a living visual reference over time.
6. Prefer shared primitives and shared module patterns over repeated hand-built panel/button/header code across features.
7. Treat browser-rendered inspection as required input. Static file review alone is insufficient for this project.
8. When production markup must change to support canonical styling, keep those changes minimal and purposeful.
9. Because `playerStats/index.tsx` does not use `indexUS.module.scss`, implementation planning must keep the `underlying-stats` top-level page and the `playerStats` landing page as separate styling surfaces that are aligned through shared rules rather than assumed shared files.

## Success Metrics

1. [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md) becomes a complete enough prompt document that a future Codex restyle request can be executed from that file alone.
2. The style guide includes canonical definitions and examples for every major element family encountered in `DraftDashboard` and `underlying-stats`.
3. The sandbox page exists and demonstrates the approved base treatments for the core reusable UI primitives.
4. Newly defined or revised tokens are centralized in [vars.scss](/Users/tim/Code/fhfhockey.com/web/styles/vars.scss) or [_panel.scss](/Users/tim/Code/fhfhockey.com/web/styles/_panel.scss), with no missing references.
5. The `underlying-stats` entry pages visually align with the new system and feel materially closer to the rest of the site.
6. The approval workflow is explicit enough that future element updates can be reviewed one primitive at a time.
7. The resulting implementation reduces style drift, duplicate idioms, and ad hoc local styling decisions.

## Open Questions

1. Which element families used elsewhere on FHFH are still missing from the `DraftDashboard` reference set and will require owner-supplied exemplars?
2. Should approved sandbox examples remain permanently as a public/internal showcase page, or should some be removed once their canonical rule is documented?
3. Are there any site sections beyond `underlying-stats` that should be considered immediate fast-follow candidates once this system is established?
4. Should chart-specific rules eventually be validated against another rendered page with heavier chart density if `DraftDashboard` does not provide enough chart variation?
