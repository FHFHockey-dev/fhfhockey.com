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

This section defines the page-level structure Codex should follow before styling individual components. Choose the archetype first, then apply the corresponding shell, spacing, and hierarchy rules.

### 6.1 Dashboard Pages

Use for pages like `DraftDashboard`.

- Enter directly into utility surfaces rather than a marketing-style intro.
- Keep top-level spacing compact from the first viewport.
- Favor full-width control planes, horizontal utility rails, and multi-panel workspaces.
- Use one visually emphasized primary panel at most.
- Group related controls into one dense control plane instead of scattering filters throughout the page.
- Prefer asymmetric workspaces such as `2fr / 1fr / 2fr` or a dominant primary column with supporting side rails.
- Panels should feel operational and continuously usable, not decorative.

Recommended structure:

1. compact page header or title band when needed
2. primary settings or filter plane
3. utility rail or summary rail if applicable
4. main multi-panel workspace

Do not default to:

- oversized hero intros
- centered marketing layouts
- equal-width cards when one area is clearly primary

### 6.2 Data Pages

Use for pages like `underlying-stats`.

- Keep the same dark system, border language, and typography hierarchy as dashboard pages.
- Soften decorative chrome compared with dashboard pages.
- Reduce empty space and avoid detached hero sections.
- Keep headers, controls, summary context, and data sections tightly connected.
- Treat the first viewport as an analytics workspace, not a landing page.
- Use compact context rows, summary chips, or metadata blocks to explain scope without consuming excessive vertical space.

Recommended structure:

1. compact title and scope context
2. connected filter and control block
3. optional summary metrics row
4. primary data surface such as table, grouped cards, or mixed sections

Default tone:

- disciplined
- compact
- readable
- less chrome-heavy than a true dashboard

### 6.3 Bento-Box Pages

Use when a page is composed of multiple distinct insight modules of different sizes.

- Use a clear visual grid with intentional size hierarchy.
- Allow one or two modules to span wider than the rest.
- Each box should still use canonical panel anatomy and spacing.
- Avoid random masonry styling; modules should align to a predictable grid.
- Use bento layouts only when the page genuinely contains multiple different insight types.

Recommended structure:

1. compact header and filters
2. modular insight grid with mixed spans
3. table or detail section below if one module requires deep inspection

Good fit for:

- dashboard-like overviews
- mixed cards plus charts plus rankings
- preview and spotlight pages

### 6.4 Table-Heavy Pages

Use when the table is the primary reason the page exists.

- Keep the table close to the filter bar and page context.
- Sticky headers, compact row density, strong numeric alignment, and scanability are mandatory.
- Support controls should be compact and should not dominate more vertical space than the table itself.
- Use summary metrics sparingly and only when they materially help the table reading experience.
- The page shell should support width and density rather than decorative framing.

Recommended structure:

1. compact page title and context
2. dense filter and search toolbar
3. optional micro-summary row
4. dominant table panel

Do not default to:

- oversized cards above the table
- repeated full-width decorative panels
- filter stacks that push the table too far below the fold

### 6.5 Chart Pages

Use when charts are the primary content.

- Use the same shell and typography system.
- Chart framing, legends, and toolbar rules should reuse canonical panel and control patterns.
- Keep chart controls close to the chart they affect.
- Let the chart own the space; do not compress a primary chart into a small card without reason.
- Use supporting metrics, notes, and legends as secondary surfaces around the chart.
- Multiple charts on one page should still maintain a clear hierarchy, not a wall of identical panels.

Recommended structure:

1. compact title and scope controls
2. primary chart surface
3. supporting legend / notes / comparative modules
4. secondary chart grid or table if needed

### 6.6 Drill-Down / Detail Pages

- Reuse the data-page shell, not a dashboard shell.
- Promote page context, identity, filters, and breadcrumbs clearly.
- Do not default to oversized hero treatment.
- The top of the page should answer who or what the page is about, what slice of data is shown, and what controls are active.
- Follow the context block with the main analytical surface quickly.
- Use secondary sections below for supporting history, breakdowns, tables, or related modules.

Recommended structure:

1. identity and scope header
2. compact control row
3. primary analytical section
4. supporting secondary sections

Detail-page caution:

- do not let the identity header consume the same space as a consumer-profile page
- do not separate the primary chart or table too far below the fold

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

Usage rules:

1. Canvas and panel surfaces should remain dark enough to let borders, data, and accents read clearly.
2. Primary text should be reserved for key values, titles, row labels, and important controls.
3. Secondary text should be used for subtitles, helper copy, metadata, stale notes, and supporting values.
4. Strong white text should be used selectively for high-priority headings and emphasized values, not as the default for all text.

### 7.2 Accent Rules

1. The primary accent should be the dominant interaction and emphasis color across the site.
2. Secondary accent use should be limited to subtle variation, support states, or adjacent emphasis rather than creating a second competing system.
3. Accent color should guide attention, not flood the interface.
4. Buttons, toggles, active states, current-row emphasis, links, and selected cards should all feel related through the same accent family.
5. Do not introduce arbitrary new accent colors in local modules when the shared accent system already covers the need.

### 7.3 Border System

1. Borders are a core part of hierarchy on FHFH and should usually be visible.
2. Default panels, cards, tables, toolbars, and inputs should use a restrained neutral border instead of relying on shadow alone.
3. Border contrast should be clear enough to separate layers, but not so bright that every surface looks outlined in chrome.
4. Active, selected, or focused states may intensify border color toward the accent family.
5. Data pages should generally use quieter borders than the most intense dashboard treatments.
6. Left accent borders are the canonical emphasis treatment for recommendation cards and similar spotlight modules.

### 7.4 State Colors

Use shared semantic colors for meaning, not decorative novelty.

- success / positive outcome: `$success-color`
- warning / caution / stale context: `$warning-color`
- danger / error / destructive context: `$danger-color`
- info / neutral emphasis: `$info-color`

Rules:

1. Semantic colors should communicate status first and brand style second.
2. Warning and danger colors should be used sparingly so alerts retain meaning.
3. Positive and negative deltas in tables or cards should use a consistent rule set across the site.
4. State color should usually appear in text, pills, borders, small badges, or accent bars before it appears as a full-surface fill.

### 7.5 Chart Colors

1. Charts should use a restrained, intentional palette that fits the product accent system.
2. One primary series may use the main accent color.
3. Supporting series should use coordinated, lower-conflict colors rather than a rainbow palette.
4. Gridlines, axes, legends, and chart annotations should stay subdued and readable against dark surfaces.
5. Danger, warning, and success chart colors should preserve the same semantic meaning they have elsewhere in the UI.
6. Avoid over-saturated chart palettes that compete with nearby cards, controls, and table states.

### 7.6 Data-Page Softened Treatment

Data pages should usually be visually softer than the most intense dashboard modules.

- lower gradient intensity
- quieter border glow
- more neutral panel fills
- fewer stacked accent effects
- stronger emphasis on readability and scanability

This does not mean flat and lifeless. It means restrained and consistent.

### 7.7 Position Accent Colors

Use position accents only when the UI benefits from category identity.

- C: `$info-color`
- LW: `$color-orange`
- RW: `$color-purple`
- D: `$color-teal`
- G: `$success-color`
- UTIL: `$warning-color`

Allowed uses:

- player position pills
- roster composition summaries
- position-coded recommendation cards
- filters or legends where position identity materially improves scanning

Do not use position accents for:

- generic buttons
- page shells
- general panel borders
- unrelated headings
- large background treatments

### 7.8 Token Governance

- If a spacing, border, radius, shadow, focus, or state token is missing, add it to `vars.scss`.
- If a reusable surface/helper pattern is missing, add or refine it in `_panel.scss`.
- Do not bury canonical values inside feature-local SCSS modules.

## 8. Typography System

Typography should establish hierarchy quickly and support dense analytics reading. It should feel technical, disciplined, and legible at a glance.

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
  - restrained use
  - not for paragraphs or dense explanatory copy

### 8.2 Body Font

- Token: `$font-family-primary`
- Use for:
  - labels
  - descriptions
  - helper text
  - subtitles
  - table support copy
  - general page copy
- Standard traits:
  - normal case by default
  - high readability
  - neutral tracking
  - medium or regular weight by default

### 8.3 Numeric / Data Font

- Token: `$font-family-numbers`
- Use for:
  - table metrics
  - compact stat pills
  - percentages
  - timing, rates, and counts
  - numeric controls when monospaced alignment helps readability

### 8.4 Hierarchy Roles

#### Page Title

Use for the primary page heading.

- Font: accent
- Weight: bold
- Case: uppercase by default
- Tracking: wide
- Size target:
  - desktop: `2rem` to `2.5rem`
  - mobile: `1.5rem` to `2rem`
- Color: strongest text color
- Usage rule:
  - only one primary page title per page

#### Section Title

Use for major sections within a page or large panel.

- Font: accent
- Weight: bold
- Case: uppercase by default
- Tracking: medium to wide
- Size target:
  - desktop: `1rem` to `1.35rem`
  - mobile: `0.95rem` to `1.15rem`
- Usage rule:
  - stronger than labels, weaker than the page title

#### Panel Title

Use inside panel headers.

- Font: accent
- Weight: bold
- Case: uppercase by default
- Tracking: medium to wide
- Size target:
  - desktop and mobile: `0.85rem` to `1rem`
- Usage rule:
  - panel titles should be compact and never compete with the page title

#### Subtitle / Supporting Intro Copy

Use for the short explanatory line beneath a page title or section title.

- Font: body
- Weight: regular or medium
- Case: sentence case
- Tracking: normal
- Size target:
  - desktop: `0.95rem` to `1.1rem`
  - mobile: `0.9rem` to `1rem`
- Color: secondary text
- Usage rule:
  - keep concise; do not let subtitles become long marketing paragraphs

#### Eyebrow / Kicker / Meta Label

Use for pre-title labels, category labels, status context, or grouped metadata.

- Font: accent or body depending on density
- Weight: semibold
- Case: uppercase when used as a system label
- Tracking: wide when uppercase
- Size target:
  - `0.65rem` to `0.8rem`
- Color: muted or accent-tinted text depending on emphasis

#### Body Copy

Use for explanatory text blocks and general interface copy.

- Font: body
- Weight: regular
- Case: sentence case
- Tracking: normal
- Size target:
  - `0.95rem` to `1rem`
- Line height:
  - looser than labels, tighter than marketing/editorial content

#### UI Label

Use for form labels, control labels, table toolbar labels, and compact metadata labels.

- Font: body
- Weight: medium or semibold
- Case: sentence case by default
- Size target:
  - `0.75rem` to `0.9rem`
- Usage rule:
  - labels should read crisply but should not overpower the control itself

#### Table Header Label

Use for column headers and sortable labels.

- Font: accent or semibold body depending on density
- Weight: semibold to bold
- Case: uppercase or title-style compact labels depending on available width
- Tracking: slight increase when uppercase
- Size target:
  - `0.7rem` to `0.82rem`
- Usage rule:
  - table headers should privilege scanability over decorative styling

#### Table Cell Text

Use for primary non-numeric table values.

- Font: body
- Weight: regular to medium
- Size target:
  - `0.78rem` to `0.92rem`
- Color:
  - primary text for key values
  - secondary text for supporting values

#### Numeric Data Text

Use for counts, rates, percentages, deltas, and standings-style metrics.

- Font: numeric / data font when alignment matters
- Weight: medium or semibold
- Size target:
  - `0.78rem` to `0.95rem`
- Usage rule:
  - keep numeric alignment visually stable across rows and cards

#### Caption / Helper Text

Use for secondary explanatory copy, empty-state guidance, filter hints, and chart notes.

- Font: body
- Weight: regular
- Size target:
  - `0.72rem` to `0.85rem`
- Color: secondary text
- Usage rule:
  - captions should support the interface, not compete with it

#### Footnote / Fine Print

Use for validation notes, freshness notes, provenance, or low-priority caveats.

- Font: body
- Weight: regular
- Size target:
  - `0.68rem` to `0.78rem`
- Color: muted secondary text
- Usage rule:
  - only use when the information is genuinely secondary

### 8.5 Typography Rules

1. Typography must create a clear ladder from page title to panel title to labels to data to captions.
2. Accent typography should be used intentionally, not sprayed across every text element.
3. Do not mix too many font sizes inside a single panel; use a controlled hierarchy.
4. Avoid oversized subtitle copy, bloated panel headers, and decorative letter spacing on body text.
5. Numeric alignment matters in analytics tables and metric cards; use the numeric font where it improves scanability.
6. Uppercase is primarily a system-heading and metadata-label tool, not a default for body copy.

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
- Use for:
  - data sections
  - tables
  - filter containers
  - summary modules
  - chart frames

Behavior rules:

1. Standard panels are the baseline surface treatment across the site.
2. They should feel solid, bordered, and structured before they feel elevated.
3. Default panel emphasis should come from hierarchy, header treatment, and content density, not heavy effects.

#### Flat Panel

Use when the panel should sit quietly inside a dense data page.

- Near-flat fill
- Clear border
- Minimal glow
- Minimal lift

Good fit for:

- table wrappers
- stacked data sections
- subordinate detail blocks
- page sections where too much elevation would create noise

#### Elevated Panel

Use when a module needs slightly more separation or prominence.

- Same base anatomy as the standard panel
- Stronger shadow or contrast than a flat panel
- Still restrained relative to dashboard-intense modules

Good fit for:

- primary summary blocks
- standout control surfaces
- promoted charts or recommendation modules

#### Dashboard-Intense Panel

Use sparingly for a small number of primary dashboard modules.

- May use stronger accent tinting
- May use slightly stronger shadow, border emphasis, or glow
- Should still preserve readability and not become glossy or theatrical

Rules:

1. Do not make every panel on the page dashboard-intense.
2. Usually only one or two panels on a dashboard should carry this stronger treatment.
3. This treatment is usually inappropriate as the default on data pages.

#### Data-Page Softened Panel

Use as the default panel treatment on data-heavy pages.

- Darker, flatter, quieter
- Cleaner border hierarchy
- Lower glow intensity
- Emphasis comes from layout and content, not effects

Rules:

1. This is the default target for `underlying-stats` style pages.
2. If in doubt on a data page, choose the softened panel treatment.

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

Panel header rules:

1. Panel headers should visually separate metadata or actions from the content body.
2. Header height should stay compact.
3. Header actions should align cleanly and never overwhelm the title.
4. Panel headers should not become mini hero sections.

#### Panel Interaction States

- hover:
  - minor border emphasis
  - minor shadow increase when the panel is interactive
- selected / active:
  - stronger border or accent treatment
  - may add restrained accent tinting
- focus within:
  - visible accessibility-focused outline or border shift

Rules:

1. State changes should intensify the existing anatomy, not replace it with a different visual language.
2. Focus styles must remain visible on dark backgrounds.
3. Hover motion should be subtle and directional, never floaty.

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

#### Card Surface Variants

##### Standard Data Card

- Use for summary cards, metric modules, and supporting detail blocks
- Flat-to-lightly-elevated surface
- Visible border
- Compact internal spacing

##### Recommendation / Spotlight Card

- Use for suggested picks, spotlight modules, and ranked recommendation items
- Left accent strip is the default emphasis treatment
- May use a slightly stronger hover and selected state than standard data cards

##### Intense Dashboard Card

- Use sparingly for high-attention modules inside dashboards
- May use stronger accent tint or shadow than the standard card
- Should still keep the same structural anatomy

#### Card State Rules

- hover:
  - modest border emphasis
  - slight lift or directional motion
- selected:
  - stronger border
  - stronger accent strip or accent tint
  - same core shape and spacing
- focus:
  - clear accessible outline or border emphasis
- disabled / inactive:
  - reduced contrast
  - reduced motion

Rules:

1. Cards should never rely on glow alone to indicate interactivity.
2. Hover and selected states should feel crisp and intentional, not flashy.
3. Left accent strips should be flat, clean, and aligned with the card edge.
4. Data-page cards should use quieter shadows and tints than dashboard spotlight cards.

#### Card Content Rules

1. Internal spacing should support dense reading and quick scanning.
2. Metric stacks, sublabels, trend indicators, and metadata should align to a consistent vertical rhythm.
3. Avoid oversized empty padding inside cards.
4. If a card becomes too complex, it should probably be a panel section instead of a card.

### 9.4 Buttons

#### Primary Button

- Strong action emphasis
- Accent-led
- Compact but obvious
- Current canonical reference should follow the `GameGrid` date-nav control language more closely than the earlier generic button example

Rules:

1. Use for the main action in a local area, not every action on the page.
2. The primary button should feel clearly interactive without becoming oversized.
3. Accent fill and accent border should feel related to the global accent system.
4. Use compact accent typography when the surrounding interface follows the dashboard/control language.
5. For dense dashboard controls, prefer the `GameGrid` pattern: `2px` accent border, low accent fill at rest, stronger accent fill on hover, and uppercase accent typography.

Typical states:

- default:
  - accent-led fill or strong accent treatment
- hover:
  - stronger border and slightly brighter emphasis
- active:
  - slightly compressed or darker pressed state
- focus:
  - visible focus ring or outline on dark backgrounds
- disabled:
  - reduced contrast and reduced saturation

#### Secondary Button

- Lower emphasis than the primary button
- Usually border-led or low-fill
- Suitable for secondary actions in a shared action cluster

Rules:

1. Secondary buttons should read clearly next to primary buttons without competing with them.
2. Border contrast matters more than shadow.
3. Hover states may borrow accent treatment, but the resting state should remain quieter than the primary button.

#### Secondary / Ghost Button

- Transparent or low-fill
- Border-led
- Gains accent treatment on hover

Rules:

1. Use for low-priority actions, utility controls, and inline toolbars.
2. Ghost buttons should still feel clickable; do not make them fade into the background.
3. Use them sparingly in dense toolbars so the interface does not become visually noisy.

#### Hub Navigation Button

- Solid border
- Semi-transparent background of the same color as the border
- Intensified accent color on hover and active states

Rules:

1. Use exclusively for top-level navigation hubs (e.g., Underlying Stats tab switching).
2. Maintain solid borders while utilizing low-opacity backgrounds (`0.15` to `0.2` resting).
3. Selected/active state should increase the opacity (e.g., `0.5`) to clearly indicate the current page and change text color to white for contrast.

#### Compact Dashboard Action Button

Current best reference:

- `DraftSettings .toggleButton.active`
- `DraftSettings .summaryButton`

Rules:

- compact height
- uppercase accent typography
- clear border
- no oversized vertical padding
- fits dense settings rows and utility clusters

#### Button Size Guidance

- compact:
  - default for dashboards, filter bars, table toolbars, and dense controls
- standard:
  - use when a page-level action needs more presence
- large:
  - avoid unless a page has a very small number of actions and one clearly deserves prominence

Button anti-patterns:

- oversized pill buttons
- extra-tall buttons in dense analytics contexts
- unrelated colors per button
- weak ghost buttons with unreadable borders

### 9.5 Segmented Toggles

Primary reference: `GameGrid .modeToggle`

Secondary reference: `DraftSettings .draftTypeToggle`

- Dark rail with `4px` internal padding
- Compact internal padding
- Inactive state stays quiet
- Active state uses accent fill + accent border
- This is the canonical segmented-control pattern

Rules:

1. Segmented toggles are the default pattern for switching between two to five closely related modes.
2. The rail should read as one control group, not a row of unrelated buttons.
3. Inactive segments should remain legible without stealing attention.
4. Active segments should intensify through accent treatment, not by changing shape.
5. Segmented controls should stay compact enough for settings rows and dashboard filters.
6. Default to the `GameGrid` anatomy: dark grouped rail, transparent inactive buttons, accent-tinted hover state, and active buttons with `primary-color-opaque` plus a `2px` accent border.

Use for:

- mode switches
- counts vs rates
- player vs team views
- time-slice toggles
- dashboard subsection modes

Do not use for:

- long menus
- large choice lists
- controls with highly unequal label lengths

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

#### Text Input

Use for direct text entry, filter terms, and compact form fields.

Rules:

1. Inputs should be compact, bordered, and clearly readable against dark surfaces.
2. Placeholder text should be subdued but legible.
3. Focus state must be visible and consistent across all input types.
4. Input chrome should not overpower surrounding labels and data.

#### Search Input

Use for player search, table search, and local filtering.

Rules:

1. Search inputs should use the same base anatomy as text inputs.
2. Search fields in dense toolbars should remain compact.
3. If an icon is used, it should be quiet and aligned cleanly.
4. Search should feel like part of the same filter bar rather than a separate visual system.
5. Current approved search reference is the `ProjectionsTable` / `MyRoster` pattern: dark field, visible border, blue border on focus, and a restrained focus ring.
6. Search placeholder text should use `Roboto Condensed` via `$font-family-primary`, with italic styling and transparentized secondary text rather than full-opacity body copy.

#### Select

Use for compact enumerated choices.

Rules:

1. Selects should use the same background, border, and focus treatment as other inputs.
2. Avoid decorative custom arrows or over-styled dropdown chrome.
3. Select width should fit expected content without wasting toolbar space.
4. In dense dashboards, selects should align cleanly with adjacent buttons and inputs.
5. Approved base reference is `PlayerStatsFilters .select` for border, focus, and arrow treatment.
6. Sandbox and future custom menu demos may use a stronger hover preview state with `$color-brand-primary` background and `$color-brand-dark` text so option hover is unmistakable during review.

#### Number Input

Use for compact numeric entry where direct typing is useful.

Rules:

1. Numeric inputs should align visually with steppers and selects.
2. The field should remain readable even at compact widths.
3. Avoid extra-heavy shadows or detached plus/minus buttons unless the stepper pattern is used.

#### Stepper

Use when the user is expected to increment or decrement small values directly.

Rules:

1. Use a compact joined control with a central value field and adjacent increment/decrement actions.
2. Button hit areas should remain usable without becoming oversized.
3. Stepper controls should feel engineered and compact, not toy-like.
4. The value display should use stable numeric alignment.

#### Dropdown / Action Menu

Canonical site-wide menu rules still need more examples, but default guidance is:

- anchor visually to the triggering control
- dark panel shell
- clear border
- compact option density
- strong hover and focus states
- no floating white menu treatment
- open directly below the trigger, not on top of it
- option hover may use `$color-brand-primary` fill with `$color-brand-dark` text for clear review-state approval

### 9.7 Filter Bars And Control Rows

Use for grouped controls above tables, dashboards, or analytical sections.

Rules:

1. Filter bars should read as one connected control surface.
2. Controls inside a filter bar should align by height and visual weight.
3. Search, selects, segmented toggles, and compact action buttons should coexist without one style family dominating the row.
4. Dense control rows should wrap cleanly on smaller screens.
5. Avoid excessive vertical stacking unless the viewport forces it.

Recommended ingredients:

- one search field
- one or more compact selects
- a segmented mode toggle when relevant
- one or two secondary actions
- one clearly primary action only if necessary
### 9.8 Progress Modules

Primary reference: `MyRoster .rosterProgress`

- low-height track
- clear label/count header
- compact spacing
- should feel like a support module, not a hero component

### 9.9 Tables

Primary heavy-table reference: `ProjectionsTable.module.scss`

Primary compact-table reference: `DraftBoard.module.scss`

Rules:

- sticky headers where tables are scrollable
- compact row height
- rely on spacing and alignment more than heavy internal borders
- use restrained striping
- support current-row or selected-row emphasis with left accent border or restrained tint

#### Table Structure Rules

1. Tables should usually live inside a canonical panel shell.
2. Table headers, toolbar controls, and scroll containers should feel like one system.
3. Column density should favor scanability over decorative spacing.
4. Numeric columns should align consistently and use the numeric/data font when helpful.
5. Heavy internal gridlines should be avoided unless the data truly needs them.

#### Row Density Rules

1. Default row density should be compact.
2. Dense analytics tables should privilege visible data per viewport over oversized padding.
3. If a row needs secondary metadata, keep it visually subordinate to the primary value.
4. Do not use tall rows as the default on table-heavy pages.

#### Header And Sorting Rules

1. Sticky headers are the default when the table scrolls vertically.
2. Header labels should be compact, legible, and visually distinct from body rows.
3. Sortable columns should have a clear affordance, but the icon treatment should remain restrained.
4. Active sort state should be obvious through accent or stronger text emphasis.
5. Header bars should remain darker or more separated than the table body.

#### Row State Rules

- hover:
  - subtle row tint or border emphasis
- selected:
  - stronger tint and/or left accent
- current / active:
  - the clearest row emphasis state
- disabled / unavailable:
  - reduced contrast

Rules:

1. Current-row and selected-row states should intensify the existing table language, not introduce unrelated colors.
2. A left accent border is the preferred strong-emphasis treatment when a row needs standout focus.
3. Striping should remain restrained enough that selected and current states still read clearly.

#### Table States

##### Empty State

- should live inside the same panel shell as the table
- should explain why there are no rows
- may suggest the control or filter to change

##### Loading State

- should preserve the table frame or panel shell
- may use skeleton rows or a compact loading banner
- should not cause the entire page to jump structure

##### Error State

- should stay inside the data container
- should use semantic warning/danger treatment sparingly
- should explain what failed and, when appropriate, how to retry

### 9.10 Chart Containers

Chart containers should use canonical panel anatomy unless a documented exception is needed.

#### Chart Frame

- dark panel shell
- visible border
- compact header or toolbar area
- chart area gets the majority of the space

Rules:

1. The chart frame should support the chart, not visually compete with it.
2. Chart modules should feel like part of the same system as tables and cards.
3. Primary charts may use elevated or promoted panel treatment, but still within the same panel language.

#### Chart Toolbar

Use for chart-local controls such as timeframe, series mode, compare toggles, or legend visibility.

Rules:

1. Chart controls should sit close to the chart they affect.
2. Toolbars should use the same button, select, and segmented-control system as the rest of the site.
3. Toolbars should remain compact and should not dominate vertical space above the chart.
4. If multiple controls exist, they should wrap cleanly on smaller screens.

#### Chart Legend And Notes

1. Legends should be readable, compact, and visually secondary to the chart itself.
2. Legend color chips should match the chart palette exactly.
3. Notes, caveats, and freshness context should use caption-level typography.
4. Supporting notes should not crowd the plotting area.

#### Chart States

##### Empty Chart State

- explain why the chart has no data
- preserve the chart frame
- align with table empty-state language

##### Loading Chart State

- preserve the chart frame and title area
- use a calm placeholder or skeleton
- avoid large layout shifts

##### Error Chart State

- keep the message within the chart container
- use semantic state styling sparingly
- do not replace the page shell with a large global error block

### 9.11 Dense Grid / Matrix Cells

Primary reference: `DraftBoard` pick grid

- shared neutral base cell
- state variants for current, past, completed, selected, etc.
- anchor cells may use stronger accent treatment than normal data cells

### 9.12 Recommendation Rails

Primary reference: `SuggestedPicks .cardsRow`

- horizontal repeated-card rail
- compact controls above
- should support featured content without becoming a second full page shell

### 9.13 Dialogs And Overlays

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

## 10. Do / Do Not + SCSS Patterns

Use these as compact execution references when styling a page from this document.

### 10.1 Page Shell

Do:

- keep the page shell dark, compact, and utility-first
- connect the header, controls, and first data surface closely

Do not:

- build a marketing hero
- center the whole page in a narrow content column if the page is data-heavy

```scss
.pageShell {
  min-height: 100%;
  padding: 1rem 1rem 1.25rem;
  background: v.$background-dark;
  color: v.$text-primary;
}

.pageStack {
  display: grid;
  gap: 0.9rem;
}
```

### 10.2 Standard Panel

Do:

- use a solid dark surface
- use a clear neutral border
- keep the header compact

Do not:

- rely on shadow alone for separation
- turn every panel into a glowing feature box

```scss
.panel {
  background: v.$background-medium;
  border: v.$border-subtle;
  border-radius: v.$radius-md;
  box-shadow: v.$shadow-panel;
  overflow: clip;
}

.panelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid v.$border-soft;
  background: v.$background-dark;
}

.panelBody {
  padding: 0.9rem;
}
```

### 10.3 Softened Data Panel

Do:

- use a flatter, quieter version of the standard panel on data pages

Do not:

- use dashboard-intense glow by default on analytics surfaces

```scss
.dataPanel {
  background: v.$background-medium;
  border: v.$border-subtle;
  border-radius: v.$radius-md;
  box-shadow: none;
}
```

### 10.4 Left-Accent Card

Do:

- use the flat left accent strip for spotlight and recommendation cards

Do not:

- replace the accent strip with a full-card gradient

```scss
.accentCard {
  position: relative;
  padding: 0.85rem 0.9rem 0.85rem 1.1rem;
  background: v.$background-medium;
  border: v.$border-subtle;
  border-radius: v.$radius-md;
}

.accentCard::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: v.$primary-color;
  border-radius: v.$radius-md 0 0 v.$radius-md;
}
```

### 10.5 Primary Button

Do:

- keep buttons compact and clearly interactive

Do not:

- use oversized pill buttons in dense interfaces

```scss
.buttonPrimary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2rem;
  padding: 0 0.85rem;
  border: 2px solid v.$primary-color;
  border-radius: v.$border-radius-sm;
  background: rgba(v.$primary-color, 0.18);
  color: v.$secondary-color;
  font: 700 0.78rem/1 v.$font-family-accent;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: all 0.2s ease;
}

.buttonPrimary:hover {
  color: v.$color-white;
  background: rgba(v.$primary-color, 0.3);
  box-shadow: 0 8px 16px rgba(v.$primary-color, 0.22);
}
```

### 10.6 Segmented Toggle

Do:

- treat the rail as one control group

Do not:

- style each segment like a disconnected button

```scss
.segmentRail {
  display: flex;
  padding: 4px;
  min-height: 40px;
  background: rgba(v.$background-dark, 0.9);
  border: 1px solid rgba(v.$color-white, 0.08);
  border-radius: v.$border-radius-lg;
  box-shadow: inset 0 1px 0 rgba(v.$color-white, 0.04);
}

.segment {
  min-height: 32px;
  padding: 0 v.$space-md;
  border: 2px solid transparent;
  border-radius: v.$border-radius-sm;
  background: transparent;
  color: v.$secondary-color;
  font-family: v.$font-family-accent;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.segment:hover {
  color: v.$primary-color;
  background: rgba(v.$primary-color, 0.1);
}

.segmentActive {
  border: 2px solid v.$primary-color;
  background: v.$primary-color-opaque;
  color: v.$color-white;
}
```

### 10.7 Input / Select

Do:

- keep inputs dark, bordered, and compact

Do not:

- use bright white inputs or oversized form chrome

```scss
.field {
  min-height: v.$control-height-md;
  padding: 0 v.$space-sm;
  border: 2px solid v.$border-secondary;
  border-radius: v.$border-radius-md;
  background: v.$background-dark;
  color: v.$text-primary;
}

.field:focus-visible {
  outline: none;
  border-color: v.$primary-color;
  box-shadow: 0 0 0 3px rgba(v.$primary-color, 0.2);
}

.field::placeholder {
  color: rgba(v.$text-secondary, 0.55);
  font-family: v.$font-family-primary, sans-serif;
  font-style: italic;
  opacity: 1;
}

.selectLike {
  min-height: v.$control-height-md;
  padding: v.$space-sm 2.5rem v.$space-sm v.$space-md;
  border: 1px solid rgba(v.$color-white, 0.14);
  border-radius: v.$border-radius-md;
  background: color.adjust(v.$background-dark, $lightness: -1%);
  color: v.$text-primary;
}

.selectLike:hover {
  background: v.$color-brand-primary;
  color: v.$color-brand-dark;
}
```

### 10.8 Table Shell

Do:

- keep headers sticky when scrolling
- use compact rows and strong numeric alignment

Do not:

- use heavy internal borders as the main organizing tool

```scss
.tableWrap {
  overflow: auto;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: v.$background-dark;
  border-bottom: 1px solid v.$border-soft;
  padding: 0.65rem 0.7rem;
}

.table tbody td {
  padding: 0.62rem 0.7rem;
  border-bottom: 1px solid v.$border-soft;
}
```

### 10.9 Chart Frame

Do:

- keep the chart inside a canonical panel shell

Do not:

- detach legends and controls into unrelated floating modules

```scss
.chartFrame {
  display: grid;
  gap: 0.75rem;
  padding: 0.9rem;
  background: v.$background-medium;
  border: v.$border-subtle;
  border-radius: v.$radius-md;
}

.chartToolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
```

### 10.10 Empty State

Do:

- preserve the parent panel shell
- explain what is empty and why

Do not:

- replace the whole page with a generic blank message

```scss
.emptyState {
  display: grid;
  gap: 0.35rem;
  justify-items: start;
  padding: 1rem;
  border: 1px dashed v.$border-soft;
  border-radius: v.$radius-md;
  color: v.$text-secondary;
}
```

## 11. Layout And Spacing

- Prefer CSS Grid for dashboard and data-page layouts.
- Keep gaps disciplined and reusable.
- Panels and controls should read as part of one system.
- On mobile:
  - stack vertically
  - reduce spacing slightly
  - preserve the same hierarchy, not a different visual language

## 12. Implementation Checklist For Codex

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

## 13. Sandbox And Approval Workflow

The sandbox page is the canonical staging area for style approval before or during production rollout.

Primary sandbox surface:

- `web/pages/cssTestingGrounds.tsx`
- `web/pages/cssTestingGrounds.module.scss`

Rules:

1. Every new canonical element family should be represented in the sandbox when practical.
2. The sandbox should include dummy or reference examples for cards, tables, toggles, buttons, inputs, dropdowns, search boxes, chart frames, empty states, loading states, and other reusable primitives.
3. The sandbox is not a random demo page. It is the review surface for approving canonical UI behavior and appearance.
4. The sandbox must stay synchronized with this document and with the shared token system.

### 13.0 Canonical Approval Checklist

This is the required review order for canonical element approval.

Process rule:

1. Review exactly one checklist item at a time.
2. Use `DraftDashboard` as the canonical source first.
3. If `DraftDashboard` does not contain a strong enough example, use another rendered site surface and record that source explicitly.
4. Compare the sandbox or production implementation against the rendered reference before marking the item approved.
5. Do not move to the next item until the current item is marked `Approved`, `Rework Required`, or `Deferred`.

Checklist statuses:

- `Approved`: the family has an accepted canonical reference and an implementation direction strong enough for future Codex restyles.
- `Rework Required`: the family exists, but the current sandbox/production expression is not yet aligned well enough.
- `Deferred`: the family needs a stronger site example or a later dedicated pass before it should be treated as final canon.

| Review Order | Element Family | Primary Canonical Source | Current Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Page shell | `DraftDashboard` shell, then `underlying-stats` production pages for softened data pages | Approved | Use dashboard shell for operational layouts and the `underlying-stats` pages for calmer table-first shells. |
| 2 | Headers and title bands | `DraftDashboard` section headers, then `underlying-stats` / `playerStats` production headers | Approved | Includes page title, eyebrow, subtitle, utility row, and compact metadata context. |
| 3 | Panels and cards | `SuggestedPicks`, `MyRoster`, `DraftDashboard`, then production summary cards | Approved | Includes standard panels, softened data panels, left-accent cards, and compact summary cards. |
| 4 | Tables | `ProjectionsTable`, `DraftBoard`, `PlayerStatsTable`, `underlying-stats` production tables | Approved | Sticky headers, dense row spacing, numeric alignment, and compact footer/pagination behavior are canonical. |
| 5 | Buttons | `GameGrid.module.scss` (`.dateButtonPrev`) and compact dashboard utility buttons | Approved | `GameGrid` is the stronger dense-control reference than the earlier sandbox version. |
| 6 | Toggles | `GameGrid.module.scss` (`.modeToggle`) and `DraftSettings` segmented controls | Approved | Use the denser `GameGrid` behavior first, with `DraftSettings` as the grouped dashboard variant. |
| 7 | Inputs and selects | `ProjectionsTable`, `MyRoster`, `PlayerStatsFilters`, `DraftSettings` | Approved | Includes search boxes, text inputs, numeric inputs, selects, dropdown triggers, and field-row grouping. |
| 8 | State banners | `playerStats` and `underlying-stats` production pages | Approved | Loading, warning, error, stale-data, and empty-table banners should stay in-section, not page-replacing. |
| 9 | Chart frames | No locked `DraftDashboard` source; use strongest chart page reference when supplied | Deferred | Keep sandbox chart examples provisional until a stronger chart-first production example is documented. |

Practical meaning:

- If a future Codex task says to restyle a page per this guide, it should follow this checklist order during implementation and approval.
- If the page introduces a new family not covered above, that work stops and moves into the missing-element workflow below.

### 13.0.1 Approval Matrix

Use this matrix when implementing or reviewing any canonical family.

| Element Family | Canonical Source Pattern | Source Type | Token Dependencies | Sandbox Example | Expected Interaction States |
| --- | --- | --- | --- | --- | --- |
| Page shell | `DraftDashboard` page shell for dashboard/bento layouts; `underlying-stats` production pages for softened data-page shells | `DraftDashboard` first, then other site surface | `$background-dark`, `$background-medium`, `$text-primary`, `$text-secondary`, `$border-soft`, `$shadow-panel`, `$radius-panel`, `panel-shell` | `cssTestingGrounds -> page-shells -> Dashboard shell`, `cssTestingGrounds -> page-shells -> Data-page shell` | Default, responsive stack, scroll behavior, compact utility-row alignment |
| Headers and title bands | `DraftDashboard` section headers for compact title bars; `underlying-stats` and `playerStats` production headers for data-page title/context treatment | Mixed: `DraftDashboard` plus production site surfaces | `$primary-color`, `$text-primary`, `$text-secondary`, `$background-dark`, `$border-soft`, `$radius-panel`, `panel-header`, `panel-shell` | `cssTestingGrounds -> page-shells` header examples | Default, compact/expanded density, responsive wrap, utility-link hover/focus |
| Panels and cards | `DraftDashboard` panel shell, `SuggestedPicks` left-accent cards, `MyRoster` compact summary cards, `underlying-stats` summary modules | `DraftDashboard` first, then other site surface | `$background-dark`, `$background-medium`, `$border-soft`, `$shadow-panel`, `$radius-card`, `$radius-panel`, `$primary-color`, `$text-primary`, `$text-secondary`, `panel-shell` | `cssTestingGrounds -> surfaces -> Standard panel`, `cssTestingGrounds -> surfaces -> Left-accent card` | Default, hover, selected/current, focus-visible, disabled when applicable |
| Tables | `ProjectionsTable` heavy analytics table, `DraftBoard` compact leaderboard table, `PlayerStatsTable`, `underlying-stats` production table shell | Mixed: `DraftDashboard` plus production site surfaces | `$background-dark`, `$background-medium`, `$border-soft`, `$text-primary`, `$text-secondary`, `$primary-color`, `$radius-panel`, `$shadow-panel`, `panel-shell`, `panel-scroll-surface` | `cssTestingGrounds -> data-display -> Analytics table` | Default, hover row, sticky header, sorted header, empty/loading/error-in-panel, pagination enabled/disabled |
| Buttons | `GameGrid.module.scss` dense date-nav buttons, with compact dashboard utility buttons from `DraftSettings` as secondary reference | Other site surface first, then `DraftDashboard` | `$control-height-sm`, `$control-height-md`, `$radius-control`, `$primary-color`, `$background-dark`, `$text-primary`, `$text-button`, `$border-soft`, `$focus-ring` | `cssTestingGrounds -> controls -> Button set` | Default, hover, active/pressed, focus-visible, disabled |
| Toggles | `GameGrid.module.scss` `.modeToggle` as the strongest dense segmented control; `DraftSettings` segmented rails as grouped dashboard variant | Other site surface first, then `DraftDashboard` | `$control-height-sm`, `$control-height-md`, `$radius-control`, `$primary-color`, `$background-dark`, `$text-primary`, `$text-secondary`, `$border-soft`, `$focus-ring` | `cssTestingGrounds -> controls -> Segmented toggle` | Default, hover, active/selected, focus-visible, disabled |
| Inputs and selects | `ProjectionsTable` / `MyRoster` search field behavior, `PlayerStatsFilters` select behavior, `DraftSettings` base select/input density | Mixed: `DraftDashboard` plus production site surfaces | `$control-height-md`, `$radius-control`, `$background-dark`, `$background-medium`, `$text-primary`, `$text-secondary`, `$primary-color`, `$color-brand-dark`, `$border-soft`, `$focus-ring`, `$font-family-primary` | `cssTestingGrounds -> controls -> Search and filter row` | Default, placeholder, hover, focus-visible, open menu, selected option, disabled |
| State banners | `playerStats` and `underlying-stats` production in-section loading/warning/error/empty banners | Other site surface | `$background-dark`, `$background-medium`, `$text-primary`, `$text-secondary`, `$primary-color`, `$warning-color`, `$danger-color`, `$border-soft`, `$radius-card` | `cssTestingGrounds -> surfaces -> Empty state / loading banner examples` | Loading, warning, error, empty, stale-data/cached-warning, optional secondary action |
| Chart frames | No locked chart-first production reference yet; use `start-chart` framing only as a temporary fallback until a stronger chart page is documented | Deferred to other site surface | `$background-dark`, `$background-medium`, `$border-soft`, `$text-primary`, `$text-secondary`, `$primary-color`, `$radius-panel`, `$shadow-panel`, `panel-shell` | `cssTestingGrounds -> data-display -> Chart frame` | Default, hover on toolbar controls, focus-visible on controls, legend visibility, loading/error/empty chart states |

Source-selection note:

- `Source Type` should be copied into future implementation notes so it stays obvious whether the family is truly `DraftDashboard`-derived or was promoted from another site surface.
- When multiple sources are listed, the first one is the strongest visual reference and the others exist to fill gaps in behavior or density.

Token-usage note:

- The token list above is intentionally family-level, not exhaustive per selector.
- If a future implementation needs a new shared color, spacing, shadow, radius, or focus value beyond these, add it to `vars.scss` rather than introducing a feature-local literal.

### 13.1 Order Of New Showcase Items

When a new element is being actively reviewed:

1. Add the new showcase item near the top of `cssTestingGrounds`.
2. Do not bury newly added review items at the bottom of a long showcase page.
3. Once the item is approved, it may remain in place as a permanent reference or be reorganized into the stable showcase grouping.
4. During active iteration, optimization for fast review takes priority over long-term showcase ordering.

### 13.2 Approval Flow

For each new or revised canonical element:

1. identify the canonical source pattern or closest reference
2. define or verify tokens in `vars.scss` / `_panel.scss`
3. build the sandbox example
4. refine until approved visually
5. update `fhfh-styles.md` with the final canonical rule
6. apply the approved pattern in production pages/components

### 13.3 Sync Requirements

When a canonical styling decision changes, the following layers must stay aligned:

- `fhfh-styles.md`
- `web/styles/vars.scss`
- `web/styles/_panel.scss`
- `cssTestingGrounds`
- production implementation files

If one of these changes without the others, the style system is drifting and should be corrected.

Required maintenance rule:

- A change is not complete just because the production page looks correct.
- Canonical styling work is only complete when the documentation layer, token/mixin layer, sandbox layer, and production layer agree with each other.

Layer responsibilities:

- `fhfh-styles.md`
  - defines the canonical rule, approval status, source references, and interaction expectations
- `web/styles/vars.scss`
  - defines shared tokens for colors, spacing, radii, shadows, focus, and control sizing
- `web/styles/_panel.scss`
  - defines shared surface primitives and shared panel/header/body helpers
- `cssTestingGrounds`
  - shows the canonical sandbox example for review and posterity
- production implementation files
  - prove that the pattern works in a real page/component context

When each layer must be touched:

- If the visual rule changes, update `fhfh-styles.md`.
- If a shared color, size, spacing, shadow, focus, or radius value changes, update `vars.scss`.
- If a shared shell/header/body surface rule changes, update `_panel.scss`.
- If the canonical example for the family changes, update `cssTestingGrounds`.
- If the change is being shipped on a real page, update the production implementation too.

Allowed exceptions:

- A production-only exploratory change may temporarily skip sandbox or guide updates while the pattern is still under active review.
- But that temporary state must be called out as provisional and cannot be treated as final canon.

Required drift check before closing a styling task:

1. Confirm the family exists in the checklist and matrix in `fhfh-styles.md`.
2. Confirm all referenced tokens and mixins exist.
3. Confirm the sandbox example matches the current approved production expression, or explicitly document why it is deferred.
4. Confirm the production implementation is using the shared token/mixin layer rather than local literals where reuse is expected.
5. Confirm any deferred items are labeled as deferred rather than implicitly approved.

What counts as drift:

- a new production button/card/table style that is not documented in the guide
- a new token used in production that is not represented in the canonical rules
- a sandbox primitive that no longer resembles the approved production/source reference
- a guide entry that describes a pattern no longer reflected in shipped pages
- an interaction state documented in the guide but missing from the sandbox or production implementation

Codex close-out rule:

- When finishing any future canonical styling task, explicitly mention which layers were updated and whether any layer was intentionally deferred.

### 13.4 Missing Element Workflow

If Codex encounters an element family that is not covered well enough here, it must treat that as a blocked canonicalization step rather than an invitation to improvise.

Trigger conditions:

- the element family does not appear in the approval checklist or matrix
- the guide mentions the family only as a gap or deferred item
- the closest existing reference is clearly a poor fit
- the sandbox example exists but is still marked provisional or deferred
- the element’s interaction model is materially different from any approved family already documented here

Required process:

1. Stop before inventing a final canonical pattern.
2. Identify the missing family in plain language.
3. Search `DraftDashboard` first for the closest usable analogue.
4. If `DraftDashboard` does not contain a strong enough reference, look for another rendered site surface.
5. If no strong rendered site surface exists, request a site example from the owner before writing a final canonical rule.
6. If the owner provides an example, record the source route/component in this guide.
7. Add or update any required shared tokens in `vars.scss` or `_panel.scss`.
8. Add the new family to `cssTestingGrounds` near the top of the page while it is under review.
9. Document the family in the approval checklist and approval matrix.
10. Only after those steps are complete should the family be rolled into production as canonical.

What Codex may do while blocked:

- use a temporary, clearly non-canonical local treatment only if needed to unblock unrelated work
- leave a note that the family is provisional and awaiting owner-supplied reference
- defer the element formally instead of pretending it is approved

What Codex must not do:

- silently invent a site-wide canonical style from general taste
- promote a one-off local implementation to canonical without documentation
- treat an unreviewed sandbox sketch as a final source of truth
- skip the owner-reference step when the family is still listed in `Known Gaps`

Owner request format:

When asking for a missing example, Codex should ask for:

1. a rendered route or page where the element already exists, if one exists
2. the specific element to copy from that page
3. any behavioral expectation that is not obvious from the screenshot alone

Required documentation after owner response:

- add the new family or variant to the checklist
- add the source type (`DraftDashboard` or other site surface) to the approval matrix
- add the sandbox example reference
- add the token dependencies
- note whether the family is now `Approved`, `Rework Required`, or `Deferred`

## 14. Known Gaps

The following element families still need site examples before their canonical rules should be considered final:

- chart-first layouts with large standalone charts, legends, and chart toolbars
- plain content sections for text-heavy explanatory pages
- advanced dropdown/action-menu popovers
- pagination/load-more patterns
- page-level empty states
- inline content-flow callouts and notices

## 15. Next Expansion Targets

This file structure is now the required framework. Later sub-tasks should expand it by:

1. defining explicit page-archetype rules
2. tightening the brand/non-negotiable rules
3. defining typography, color, and border rules more precisely
4. adding explicit SCSS examples for each component family
5. linking every canonical family to sandbox examples and approval workflow
