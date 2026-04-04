# FHFHockey.com Canonical Style System Prompt

This document is the canonical styling source of truth for FHFHockey.com.

If Codex is told to re-style a page "per `fhfh-styles.md`", it should treat this file as an implementation spec, not as loose inspiration.

## 1. How To Use This Document

When styling or re-styling a page:

1. Identify the page archetype first.
2. Reuse the canonical element families defined here instead of inventing local one-off patterns.
3. Use shared tokens from `web/styles/vars.scss` and shared panel helpers from `web/styles/_panel.scss`.
4. If a required token does not exist, add it to the shared token source instead of hardcoding a new literal in the feature stylesheet.
5. Prefer the structure, density, and reusable UI patterns from `DraftDashboard` over decorative effects.
6. Treat gradients, glow, and blur as optional emphasis tools, not as default background treatments.
7. Keep the documentation, shared tokens, sandbox page, and production implementation aligned.

## 2. Non-Negotiable Rules

### 2.1 Core Brand Rules

1. The site remains dark, dense, and analytics-focused.
2. The site should feel like one connected product system, not a collection of individually styled pages.
3. Readability, hierarchy, and data scanning take priority over atmosphere.
4. `DraftDashboard` is the primary visual reference for reusable application UI unless a better canonical site example is explicitly documented.
5. New page work should extend the system, not invent a parallel one.

### 2.2 Background And Surface Rules

1. Gradients are to be used sparingly and are generally not the default background treatment.
2. Page backgrounds should usually be flat or near-flat dark surfaces using shared tokens.
3. Default panels, cards, tables, and control shells should sit on solid or almost-solid dark surfaces with visible borders.
4. Large full-page gradients, noisy color transitions, and decorative glow washes should not be used as baseline styling.
5. If a gradient is used, it should be restrained, low-contrast, and justified by emphasis rather than decoration.
6. Glassmorphism, blur, and bloom are optional emphasis tools and should usually be limited to overlays, highlighted modules, or special focus states.

### 2.3 Density And Spacing Rules

1. Layouts should be compact and information-dense without feeling cramped.
2. Avoid oversized hero padding, oversized empty gutters, or marketing-style whitespace on analytics pages.
3. Headers, controls, filters, and tables should feel visually connected rather than floating in unrelated blocks.
4. Repetition of oversized panel padding across the page is discouraged; use tighter spacing for dense work surfaces.

### 2.4 Reuse Rules

1. Reuse canonical patterns for buttons, toggles, cards, tables, headers, filters, dialogs, and search controls.
2. Do not introduce a new local button style, card anatomy, or table treatment when an existing system pattern already fits.
3. If a component needs a variant, create a documented system variant rather than a one-off local exception.
4. If a pattern is missing, add it to the style guide, token system, and sandbox instead of improvising silently in one feature stylesheet.

### 2.5 Token And Implementation Rules

1. Shared values belong in `web/styles/vars.scss` or `web/styles/_panel.scss`.
2. Do not hardcode canonical colors, spacing, radii, shadows, borders, or focus treatments in feature-local modules when they should be reusable.
3. If a required token does not exist, create it in the shared token source and verify that it is used consistently.
4. Before finalizing a restyle, cross-check that every referenced token actually exists.

### 2.6 Explicit Anti-Patterns

Avoid these as defaults unless a documented exception is justified:

- gradient-heavy page shells
- panel backgrounds that look glossy, cloudy, or airbrushed
- purple-on-black neon treatment as a generic fallback
- oversized rounded cards with weak borders and soft hierarchy
- generic SaaS hero layouts on analytics pages
- detached floating filters with too much surrounding whitespace
- glow on every border, button, or active state
- multiple unrelated accent colors fighting on the same surface
- one-off local control styling that does not match the system

## 3. Codex Role And Output Expectation

Role:

- You are styling a production sports analytics application, not a marketing site.
- Your job is to make pages feel like part of one coherent system.

Output expectation:

- The result should feel intentional, dense, readable, and clearly part of FHFHockey.com.
- New styling should read as a system extension, not an isolated redesign.
- If you encounter an element family not covered well enough here, stop and ask for a site example rather than improvising a final canonical rule.

## 4. Core Design Direction

### 4.1 Brand Identity

FHFH should feel like a futuristic sports analytics terminal, but the implementation should be more disciplined than purely neon/cyberpunk styling.

- Vibe: Tron meets Moneyball.
- Core traits:
  - dark canvas
  - compact control surfaces
  - dense data presentation
  - visible border hierarchy
  - restrained accent color usage
  - selective glow only where it improves emphasis

### 4.2 What To Borrow From `DraftDashboard`

Use `DraftDashboard` as the main reference for:

- utility-first page shells
- full-width control planes
- compact grouped settings layouts
- segmented toggle rails
- compact action buttons
- panel header + scroll-body composition
- left-accent recommendation cards
- dense sticky-header tables
- current-row/current-state emphasis
- modal shell anatomy

### 4.3 What Not To Copy Blindly

Do not copy these as defaults without judgment:

- heavy full-surface gradients
- strong neon bloom on every interactive element
- blur/glass treatment on every panel
- animated shimmer or pulse effects unless the element genuinely needs high emphasis

## 5. Source Of Truth Files

- Tokens: `web/styles/vars.scss`
- Shared panel helpers: `web/styles/_panel.scss`
- Primary canonical UI reference: `web/components/DraftDashboard/*`
- Sandbox and showcase surface: `web/pages/cssTestingGrounds.tsx` and `web/pages/cssTestingGrounds.module.scss`

## 6. Page Archetypes

This section defines the document structure Codex should follow. Detailed rules will be expanded further in later sections and future passes.

### 6.1 Dashboard Pages

Use for pages like `DraftDashboard`.

- Enter directly into utility surfaces.
- Keep top-level spacing compact.
- Favor full-width control planes and multi-panel workspaces.
- Use one visually emphasized primary panel at most.

### 6.2 Data Pages

Use for pages like `underlying-stats`.

- Keep the same dark system and border language as dashboard pages.
- Soften decorative chrome compared with dashboard pages.
- Reduce empty space.
- Keep headers, controls, and data sections tightly connected.

### 6.3 Chart Pages

Reserved page archetype.

- Use the same shell and typography system.
- Chart framing, legends, and toolbar rules should reuse canonical panel and control patterns.
- Detailed chart-page rules will be expanded once the chart reference set is finalized.

### 6.4 Drill-Down / Detail Pages

Reserved page archetype.

- Reuse the data-page shell.
- Promote page context and filters clearly, but do not default to oversized hero treatment.

## 7. Token System

Use shared tokens before writing local values.

### 7.1 Core Palette

- Canvas background: `$background-dark` (`#1a1d21`)
- Panel surface: `$background-medium`
- Primary accent: `$primary-color` (`#14a2d2`)
- Secondary accent: `$secondary-color` (`#07aae2`)
- Primary text: `$text-primary`
- Secondary text: `$text-secondary`
- Strong header text: `$color-white`

### 7.2 Position Accent Colors

Use position accents only when the UI benefits from category identity.

- C: `$info-color`
- LW: `$color-orange`
- RW: `$color-purple`
- D: `$color-teal`
- G: `$success-color`
- UTIL: `$warning-color`

### 7.3 Token Governance

- If a spacing, border, radius, shadow, focus, or state token is missing, add it to `vars.scss`.
- If a reusable surface/helper pattern is missing, add or refine it in `_panel.scss`.
- Do not bury canonical values inside feature-local SCSS modules.

## 8. Typography System

### 8.1 Accent Font

- Token: `$font-family-accent`
- Use for:
  - page titles
  - panel titles
  - section headers
  - button labels when the button is part of the dashboard/control language
- Standard traits:
  - uppercase
  - wide tracking
  - bold

### 8.2 Body Font

- Token: `$font-family-primary`
- Use for:
  - labels
  - descriptions
  - helper text
  - general page copy

### 8.3 Numeric / Data Font

- Token: `$font-family-numbers`
- Use for:
  - table metrics
  - compact stat pills
  - percentages
  - timing, pricing, or numeric controls when monospaced alignment helps readability

## 9. Canonical Component Families

This is the main component catalog. Detailed rules will be expanded and tightened over later sub-tasks, but the structure below is the required long-term shape of the guide.

### 9.1 Page Shells

- Default shell:
  - dark canvas
  - compact top-level padding
  - clearly separated sections
  - no unnecessary marketing-style whitespace
- Dashboard shell reference:
  - `DraftDashboard.module.scss`

### 9.2 Panels

#### Standard Panel

Use for most work surfaces.

- Background: dark opaque surface
- Border: visible neutral border
- Radius: shared medium radius
- Shadow: restrained depth

#### Overlay / Dialog Panel

Use for modals and feature overlays.

- May use stronger emphasis than standard panels
- Glass and blur are allowed here more than on normal page panels
- Must still preserve readability and border hierarchy

#### Panel Header

- Darker than panel body
- Visible bottom divider
- Accent font title
- Compact vertical padding

### 9.3 Cards

Primary card reference: `SuggestedPicks.module.scss`

- Canonical anatomy:
  - dark body surface
  - visible body border
  - left flat accent strip using `::before`
  - enough left padding to clear the accent strip
  - compact internal metric stack
- Interaction:
  - modest directional motion
  - stronger border/shadow on hover
  - selected state should intensify the same anatomy, not invent a new one
- Important rule:
  - the left accent strip is canonical
  - heavy glow/blur/gradient intensity is optional

### 9.4 Buttons

#### Primary Button

- Strong action emphasis
- Accent-led
- Compact but obvious

#### Secondary / Ghost Button

- Transparent or low-fill
- Border-led
- Gains accent treatment on hover

#### Compact Dashboard Action Button

Current best reference:

- `DraftSettings .toggleButton.active`
- `DraftSettings .summaryButton`

Rules:

- compact height
- uppercase accent typography
- clear border
- no oversized vertical padding

### 9.5 Segmented Toggles

Primary reference: `DraftSettings .draftTypeToggle`

- Dark rail
- Compact internal padding
- Inactive state stays quiet
- Active state uses accent fill + accent border
- This is the canonical segmented-control pattern

### 9.6 Inputs And Selects

- Base select reference: `DraftSettings .select`
- Base stepper reference: `DraftSettings .numberInput` + `rosterStepper`
- Base search reference: `MyRoster .searchInput` and `ProjectionsTable .searchInput`

Shared traits:

- dark background
- visible border
- compact radius
- accent focus ring
- compact sizing for dashboard/data pages

### 9.7 Progress Modules

Primary reference: `MyRoster .rosterProgress`

- low-height track
- clear label/count header
- compact spacing
- should feel like a support module, not a hero component

### 9.8 Tables

Primary heavy-table reference: `ProjectionsTable.module.scss`

Primary compact-table reference: `DraftBoard.module.scss`

Rules:

- sticky headers where tables are scrollable
- compact row height
- rely on spacing and alignment more than heavy internal borders
- use restrained striping
- support current-row or selected-row emphasis with left accent border or restrained tint

### 9.9 Dense Grid / Matrix Cells

Primary reference: `DraftBoard` pick grid

- shared neutral base cell
- state variants for current, past, completed, selected, etc.
- anchor cells may use stronger accent treatment than normal data cells

### 9.10 Recommendation Rails

Primary reference: `SuggestedPicks .cardsRow`

- horizontal repeated-card rail
- compact controls above
- should support featured content without becoming a second full page shell

### 9.11 Dialogs And Overlays

Primary shared references:

- `DraftSummaryModal`
- `ComparePlayersModal`
- accessibility behavior from `ComparePlayersModal.tsx` and `ImportCsvModal.tsx`

Canonicalize:

- backdrop
- modal shell
- header band
- close control
- action cluster
- scrollable body

Do not over-canonicalize:

- feature-specific modal internals

## 10. Layout And Spacing

- Prefer CSS Grid for dashboard and data-page layouts.
- Keep gaps disciplined and reusable.
- Panels and controls should read as part of one system.
- On mobile:
  - stack vertically
  - reduce spacing slightly
  - preserve the same hierarchy, not a different visual language

## 11. Implementation Checklist For Codex

When styling a page per this document:

1. Import shared tokens first: `@use "styles/vars" as v;`
2. Import `sass:color` only if the module genuinely needs it.
3. Check whether a shared mixin belongs in `_panel.scss` before writing a local pattern.
4. Match the page archetype before matching individual components.
5. Reuse the canonical `DraftDashboard`-derived element family that best fits the use case.
6. Keep gradients restrained by default.
7. Treat glow, blur, and animation as optional emphasis layers.
8. Preserve accent-color identity where category, status, or position meaning matters.
9. If an element family is missing from this document, request a site example before finalizing a canonical rule.

## 12. Known Gaps

The following element families still need site examples before their canonical rules should be considered final:

- data-page hero/header systems with breadcrumbs and metadata cards
- chart-first layouts with large standalone charts, legends, and chart toolbars
- plain content sections for text-heavy explanatory pages
- advanced dropdown/action-menu popovers
- pagination/load-more patterns
- page-level empty states
- inline content-flow callouts and notices

## 13. Next Expansion Targets

This file structure is now the required framework. Later sub-tasks should expand it by:

1. defining explicit page-archetype rules
2. tightening the brand/non-negotiable rules
3. defining typography, color, and border rules more precisely
4. adding explicit SCSS examples for each component family
5. linking every canonical family to sandbox examples and approval workflow
