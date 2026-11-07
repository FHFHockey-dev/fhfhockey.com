---
version: 2026-11-07
name: FHFHockey
description: |
  Five Hole Fantasy Hockey is a dark, dense sports-analytics terminal: "Tron
  meets Moneyball", built with more discipline than neon. Charcoal canvases,
  solid bordered panels and one dominant cyan accent carry the system. Condensed
  uppercase labels set the athletic tone and monospaced numbers set the data
  tone. Warm gold is the one sanctioned secondary highlight. Depth comes from
  surface steps and visible borders, not from gradients, glass or glow.
source:
  tokens: web/styles/vars.scss          # single source of truth; values below computed with sass
  panels: web/styles/_panel.scss
  controls: web/styles/Controls.module.scss
  globals: web/styles/globals.css
  chrome: web/components/Layout/{Header,NavbarItems}/*.module.scss, web/components/Layout/Layout.module.scss, web/components/auth/UserMenu.module.scss
  crossCheck: designmd.me production extraction, 6 pages from /draft-dashboard, 2026-11-06
  spec: tasks/TASKS/rules/fhfh-styles.md   # the implementation spec; this file is the quick reference
colors:
  # Surfaces, lightest to darkest as rendered. "≈" = sass-derived value, rounded.
  body: "#202020"              # html/body background (globals.css) = $background-light = $surface-2
  canvas: "#1a1d21"            # $background-dark = $color-brand-dark: page shells, panel headers, inputs
  surface: "#131518"           # $background-medium ≈ (dark −3% L): standard panel body
  elevated: "#181a1e"          # $desktop-surface-elevated ≈
  header: "#0f1013"            # $background-header ≈ (dark −5% L): desktop site header
  surface-0: "#111417"         # page canvas on newer surfaces
  surface-1: "#1a1c21"         # base card / row
  draft-canvas: "#0d0f11"      # $draft-canvas ≈  (Draft workspace ramp)
  draft-surface: "#15171b"     # $draft-surface ≈
  draft-surface-raised: "#202429"
  draft-input: "#121416"       # also the Controls.module.scss field fill
  draft-border: "rgba(167,180,192,0.25)"
  # Accent
  primary: "#14a2d2"           # $primary-color: actions, active, focus, links ($text-link)
  primary-fill: "rgba(20,163,210,0.4)"   # $primary-color-opaque: active toggle/button fill
  secondary: "#07aae2"         # $secondary-color = $color-brand-primary: support/variation only
  gold: "#ffc857"              # $color-gold-400: favourites, compare, medal, gold control variant
  # Text
  ink: "#ffffff"               # $color-white: page titles, active labels
  text: "#cccccc"              # $text-primary
  text-muted: "#aaaaaa"        # $text-secondary
  text-on-primary: "#101214"   # $text-on-primary: 6.4:1 on primary (white is 2.9:1)
  text-cool: "#d9e2ea"         # $color-neutral-200 (cool UI copy, chips)
  text-steel: "#a7b4c0"        # $color-neutral-400 (icons, bench)
  # Borders
  border: "#505050"            # $border-secondary; $border-subtle = 1px solid this
  border-strong: "#404040"     # $border-primary
  border-soft: "rgba(80,80,80,0.7)"   # $border-soft: dividers, header bottoms, table rows
  border-control: "#6b6f75"    # $border-control-color: form-field edges, 3.35:1 (WCAG 1.4.11)
  # Semantic
  success: "#00ff99"
  warning: "#ffcc33"
  danger: "#ff6384"
  danger-dark: "#670c20"
  info: "#3b82f6"
  focus: "#ffc108"             # $focus-color; global input outline. NB $error-color aliases it
  # Site chrome: $chrome-* in vars.scss (fhfh-styles.md §7.9)
  chrome-bg: "#141719"
  chrome-border: "#33414a"
  chrome-text: "#f4f6f8"
  chrome-label: "#b5c1cc"
  chrome-footer-text: "#c0cbd3"
  chrome-bottom-nav-text: "#d5dce1"
  chrome-link-hover: "#20282e" # desktop nav link hover
  chrome-hover: "#263139"      # menu item / utility hover
  chrome-active: "#122a34"     # desktop nav active fill
  chrome-active-mobile: "#12303d"  # bottom-nav active fill, user trigger
  chrome-menu-bg: "#181e22"    # nav dropdown, user menu shell
positionColors:                # $draft-position-colors + @mixin draft-position-colors → --position-color
  C: "#3b82f6"                 # $info-color
  LW: "#ff9f43"                # $color-orange-400
  RW: "#a78bfa"                # $color-violet-400
  D: "#07aae2"                 # $color-brand-primary
  G: "#00c896"                 # $color-teal-500
  UTIL: "#ffc857"              # $color-gold-400
  BENCH: "#a7b4c0"             # $color-neutral-400
chartColors:
  series:                      # $chart-color-1..10 (one palette; never override locally)
    - "#14a2d2"   # 1 primary
    - "#4bc0c0"   # 2 teal
    - "#9b59b6"   # 3 purple
    - "#07aae2"   # 4 secondary
    - "#ffcc33"   # 5 warning
    - "#ff9f40"   # 6 orange
    - "#98d8a8"   # 7 soft green
    - "#66ccff"   # 8 light blue
    - "#cccccc"   # 9 text
    - "#d3d3d3"   # 10 grey
  grid: "rgba(204,204,204,0.1)"
  tick: "#aaaaaa"
  tooltip: { bg: "rgba(26,29,33,0.9)", border: "#505050", text: "#cccccc" }
scheduleColors:
  green: "#16c271"
  yellow: "#c7a441"
  red: "#b64343"
  rank-good: "#14a2d2"
  rank-bad: "#9e3a3a"
  fillOpacity: [0.15, 0.25, 0.4, 0.6]   # $fill-opacity-subtle / $fill-opacity / -strong / -heavy
typography:
  families:
    page-default: "Roboto"            # globals.css html/body; most long-form and legacy copy
    primary: "Roboto Condensed"       # $font-family-primary: UI labels, body in modules, nav
    accent: "Train One"               # $font-family-accent: titles, panel titles, control labels
    numbers: "Martian Mono"           # $font-family-numbers: stats, table metrics, timers
    sporty: "Tomorrow"                # $font-family-sporty: rare, 2 modules
    secondary: "Arial"                # $font-family-secondary: native form fallback
  loadedWeights:
    Roboto: [400, 500, 700]
    Roboto Condensed: [300, 400]      # 600/700 render as browser faux-bold
    Train One: [400]                  # single weight; bold is synthesised
    Martian Mono: "100-800"
  scale: { xxs: 0.625rem, xs: 0.75rem, sm: 0.875rem, base: 1rem, md: 1.125rem, lg: 1.25rem, xl: 1.5rem, xxl: 2rem }
  weights: { regular: 400, medium: 500, semibold: 600, bold: 700 }
  roles:
    page-title:    { font: accent,  size: "2rem-2.5rem (mobile 1.5-2rem)", case: upper, tracking: wide, color: ink }
    section-title: { font: accent,  size: "1rem-1.35rem", case: upper, tracking: "0.05em+" }
    panel-title:   { font: accent,  size: "0.85rem-1rem", case: upper }
    eyebrow:       { font: "accent or primary", size: "0.65rem-0.8rem", weight: 600, case: upper, tracking: wide }
    nav-link:      { font: primary, size: 15px, case: upper, tracking: 0.04em }
    control-label: { font: accent,  size: 0.625rem, weight: 600, case: upper, tracking: 0.05em }  # Controls.module.scss
    body:          { font: primary, size: "0.95rem-1rem", case: sentence }
    ui-label:      { font: primary, size: "0.75rem-0.9rem", weight: "500-600" }
    table-header:  { font: "accent or primary semibold", size: "0.7rem-0.82rem" }
    table-cell:    { font: primary, size: "0.78rem-0.92rem" }
    numeric:       { font: numbers, size: "0.78rem-0.95rem", weight: "500-600" }
    caption:       { font: primary, size: "0.72rem-0.85rem", color: text-muted }
    fine-print:    { font: primary, size: "0.68rem-0.78rem", color: text-muted }
    placeholder:   { font: primary, style: italic, color: "rgba(#aaaaaa, 0.55-0.7)" }
rounded:
  # Current scale ($radius-*): use for new work
  xs: 4px          # $radius-xs: checkbox, tiny chips
  sm: 6px          # $radius-sm = $radius-control: buttons, inputs, toggles
  md: 10px         # $radius-md = $radius-card = $radius-panel
  lg: 16px         # $radius-lg = $radius-feature
  pill: 999px      # $radius-pill
  # Legacy scale ($border-radius-*): still common, do not extend
  legacy: { sm: 4px, md: 8px, lg: 12px, xl: 16px }
spacing:
  # Desktop ($space-*)
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 16px         # standard unit
  lg: 24px         # $panel-gap
  xl: 32px
  xxl: 48px
  xxxl: 64px
  mobile: [4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px]   # $mobile-space-xxs..xxxl
layout:
  pageMaxWidth: 90%            # $page-max-width + margin-inline: auto. Never edge to edge
  siteHeaderOffset: 72px       # $site-header-offset (sticky header 64px desktop / 56px phone + gap)
  tableHeaderHeight: 35px
  tableCellPadding: { default: "8px 16px", compact: "0.7rem 0.72rem", compactMobile: "0.58rem 0.6rem" }
controls:
  heights: { xs: 24px, sm: 32px, md: 34px, lg: 44px }   # $control-height-*; Controls scope defaults to sm, xs in tbody
  checkbox: 18px
  touchTargets: { inline: 24px, small: 36px, min: 44px, comfortable: 48px, large: 56px }
borderWidths: { hairline: 1px, active: 2px, rail: 4px, focus: "2px (controls) / 3px (global inputs)" }
elevation:
  strategy: surface-steps + visible borders; shadows are soft and ambient, never glow
  shadow-panel: "0 18px 36px -24px rgba(0,0,0,.78), 0 1px 0 rgba(255,255,255,.03)"
  shadow-panel-hover: "0 24px 48px -28px rgba(0,0,0,.84), 0 0 0 1px rgba(255,255,255,.05)"
  shadow-hover: "0 4px 16px -4px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04)"
  shadow-focus: "0 0 0 2px rgba(20,162,210,.55), 0 4px 16px -4px rgba(0,0,0,.6)"
focus:
  controls: "outline 2px solid #14a2d2, offset 2px, + $focus-ring-desktop (0 0 0 2px rgba(primary,.5))"
  mobile: "$focus-ring-mobile: 0 0 0 3px rgba(primary,.8)"
  globalInputs: "outline 3px solid #ffc108, offset 2px (globals.css fallback)"
motion:
  default: "0.2s ease"         # $hover-transition
  controls: 150ms
  easing: { standard: "cubic-bezier(0.3,0.2,0.2,1)", emphasized: "cubic-bezier(0.4,0,0.2,1)" }
  mobileDurations: [0.15s, 0.25s, 0.35s, 0.5s]
zIndex:
  desktop: { sticky: 30, overlay: 400, popover: 500, dialog: 600, toast: 650 }
  mobile: { sticky: 10, header: 20, overlay: 30, popup: 40, modal: 50, toast: 60 }
  siteHeader: 1000             # Header.module.scss literal
breakpoints:
  phone-max: 640px             # $screen-small-max / $breakpoint-sm-max
  tablet: 641px-1007px         # $screen-medium-*
  tablet-alt: 768px            # $breakpoint-tablet
  desktop: 1024px              # $screen-large / $breakpoint-desktop
  site-nav-desktop: 1100px     # header switches from mobile bar + bottom nav to desktop bar
  mobile-detail: [320px, 375px, 414px, 480px]
---

# FHFHockey.com Brand Style Cheat Sheet

The one-page quick reference. The front matter above is the token sheet; every
value is the real one from `web/styles/vars.scss` (derived values computed with
sass). For the full rules, page archetypes and approval workflow, read
[fhfh-styles.md](fhfh-styles.md). When the two disagree, fix the drift; when a
value here disagrees with `vars.scss`, `vars.scss` wins.

## 1. Theme and Atmosphere: "Neon Noir Analytics", Disciplined

A futuristic sports-analytics terminal. Tron meets Moneyball, but with less neon
than the name suggests.

- **Dark only.** There is no light theme. Surfaces step from `#202020` (body) down
  to `#131518` (panels).
- **Dense.** Analytics pages enter straight into controls and data. No marketing
  heroes, no generous whitespace bands.
- **One accent.** Cyan `$primary-color` (`#14a2d2`) carries actions, active
  states, focus and links. Gold `$color-gold-400` (`#ffc857`) is the only warm
  highlight.
- **Structure before effects.** Visible borders and surface steps make the
  hierarchy. Gradients, glass, blur and glow are opt-in emphasis, never the
  default.
- **Typographic signature.** Condensed uppercase labels (Train One / Roboto
  Condensed) for system text and Martian Mono for numbers.

## 2. Colour Palette and Roles

### Surface stack (as rendered)

| Layer | Token | Value | Use |
|---|---|---|---|
| Body | `$background-light` / `$surface-2` | `#202020` | `html, body` (globals.css) |
| Page shell / canvas | `$background-dark` | `#1a1d21` | Page shells, panel headers, field fills |
| Panel body | `$background-medium` | ≈`#131518` | Standard panels (`panel-shell`) |
| Elevated | `$desktop-surface-elevated` | ≈`#181a1e` | Slightly raised modules |
| Site header | `$background-header` | ≈`#0f1013` | Desktop header bar |
| Draft ramp | `$draft-canvas` / `-surface` / `-surface-raised` / `-input` | `#0d0f11` / `#15171b` / `#202429` / `#121416` | Draft workspace and the shared Controls fields |

`$background-medium` is **darker** than `$background-dark`, despite the names.
So a `panel-header` (`$background-dark`) is a step *lighter* than its panel body,
and the `$border-soft` divider is what separates the two.

### Accent

- **Primary** `$primary-color` `#14a2d2`: the dominant interaction colour, also `$text-link`.
- **Primary fill** `$primary-color-opaque` `rgba(20,163,210,.4)`: active toggles and buttons, with a 2px primary border and white text (9.2:1).
- **Secondary** `$secondary-color` `#07aae2`: subtle variation only, never a competing system. It is 3.4:1 on the primary fill, so don't use it as text on fills.
- **Gold** `$color-gold-400` `#ffc857`: favourites, compare columns, rank-1 medal, the `data-control-variant="gold"` control. It is not a link colour.
- **Text on a solid primary fill**: `$text-on-primary` `#101214` (6.4:1). White is only 2.9:1.

### Text

`$color-white` for page titles and active labels. `$text-primary` `#ccc` is the
body and key values. `$text-secondary` `#aaa` is for subtitles, metadata and
captions. `$color-neutral-200` `#d9e2ea` and `$color-neutral-400` `#a7b4c0` are
the cool UI greys.

### Semantic

Success `#00ff99` · Warning `#ffcc33` · Danger `#ff6384` · Info `#3b82f6`. Use them
for meaning, not decoration: as text, pills, borders or rails before any
full-surface fill. Schedule and rank cells use `$schedule-green/yellow/red`,
`$rank-good/bad` and the `$fill-opacity-*` ramp. **Ranked digits keep their
green/yellow/red text colour** as well as the cell tint.

### Position colours

Use the `$draft-position-colors` map through `@include v.draft-position-colors`
and `var(--position-color)`. These are C `#3b82f6`, LW `#ff9f43`, RW `#a78bfa`,
D `#07aae2`, G `#00c896`, UTIL `#ffc857` and BENCH `#a7b4c0`. Use them only for
position identity: pills, roster summaries, position-coded cards and legends.
Never use them for generic buttons, shells or panel borders.

### Charts

Use `$chart-color-1..10` in order, starting with primary. Gridlines take
`$chart-grid-color`, ticks `$chart-tick-color`, and tooltips the
`$chart-tooltip-*` tokens. Semantic colours keep their meaning in charts.

## 3. Typography

| Family | Token | Use |
|---|---|---|
| Roboto | (globals.css body default) | Long-form copy and anything that sets no family |
| Roboto Condensed | `$font-family-primary` | UI labels, module body copy, nav, placeholders (italic) |
| Train One | `$font-family-accent` | Page/section/panel titles, control and toggle labels, uppercase only |
| Martian Mono | `$font-family-numbers` | Stats, table metrics, percentages, timers |

- **Weights that exist:** Roboto Condensed is loaded at 300/400 and Train One at
  400 only, so `font-weight: 600/700` on them is browser faux-bold. Weight is not
  a hierarchy tool for these families: use size, case and colour.
- **Uppercase** is for system labels: titles, eyebrows, nav, buttons and toggles,
  with tracking around `0.04em`–`0.08em`. Body copy stays sentence case.
- **Ladder:** page title 2–2.5rem › section 1–1.35rem › panel 0.85–1rem ›
  labels 0.75–0.9rem › table 0.78–0.92rem › captions 0.72–0.85rem › fine
  print 0.68–0.78rem. Nav links are 15px uppercase; control labels 0.625rem.
- Use only one page title per page, and don't let one panel mix many sizes.

## 4. Components

### HARD NO: "toenail" accent borders

A toenail is a coloured edge on a rounded box whose inner edge curves into a
hook or nail shape. This covers a coloured `border-top` or `border-left` on a
radiused panel, an inset box-shadow stripe on a rounded box, and the miter where
a coloured left border meets grey top and bottom borders. **Banned.** Use one of
these instead:

- **Filled accent rail** (top or side): a `::before` bar, 4px, solid
  `var(--accent)`, with its outer corners following the panel radius and the
  panel border kept neutral. No gradient and no glow.
- **TJ-approved left rule** on compact cards: `border-left: 4px solid <accent>;
  border-radius: 4px 6px 6px 4px;`. The rule is as thick as its corner radius, so
  the inner edge is flat. Scale width and radius together. If the other sides
  have borders, lay a `::before` bar over the left edge
  (`top/bottom/left: -<border>; width: 4px; border-radius: 4px 0 0 4px`) to avoid
  the miter.
- Always check the rendered close-up, not just the SCSS.

```scss
.accentPanel {
  --accent: #{v.$primary-color};
  position: relative;
  overflow: hidden;
  border: v.$border-subtle;
  border-radius: v.$radius-card;

  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 4px;
    border-radius: v.$radius-card v.$radius-card 0 0;
    background: var(--accent);
    pointer-events: none;
  }
}

.accentPanel--side::before {
  inset: 0 auto 0 0;
  width: 4px;
  height: auto;
  border-radius: v.$radius-card 0 0 v.$radius-card;
}
```

**No clipped corner radii either:** a fill that runs edge to edge inside a
square parent gets `border-radius: 0`, or the parent's radius when the parent is
rounded.

### Panels (`@include panel-shell`)

- **standard**: `$background-medium`, `$border-subtle`, `$radius-panel` (10px), `$shadow-panel`.
- **soft**: 1% darker with no shadow. This is the default on data pages.
- **flat**: `$background-dark` with no shadow, for table wrappers and subordinate blocks.
- **intense**: a faint white sheen with `$shadow-panel-hover`. Use it on one or two dashboard modules at most.
- **Header**: `@include panel-header` gives a `$background-dark` band with a `$border-soft` bottom, `8px 16px` padding and an accent-font title. **Body**: `@include panel-body`, 16px.
- Glass (`glass-panel($frosted: true)`, blur 12px) is only for overlays and dialogs.

### Cards

- A dark body, a visible border, `$radius-card`, compact padding and a tight metric stack.
- Emphasis is structural: an accent rail or the approved left rule first, then a stronger border. Glow is never the signal.
- Hover: a slight lift (`translateY(-1px)`) and border emphasis. Selected: the same anatomy, made stronger.
- Reference: `SuggestedPicks.module.scss`.

### Buttons and controls (`web/styles/Controls.module.scss`, `.scope.scope`)

- **Default**: `$control-height-sm` (32px), `4px 8px` padding, a 1px border,
  `$radius-control` (6px), the `$draft-input` fill and `$text-primary` text.
  Labels are Train One, 0.625rem, uppercase, tracked 0.05em.
- **Hover**: primary border, `rgba(primary,.08)` fill and white text.
- **Primary / pressed / expanded** (`data-control-variant="primary"`,
  `aria-pressed="true"`): a 2px primary border, the `$primary-color-opaque` fill
  and white text.
- **Gold variant** (`data-control-variant="gold"`): a 2px gold border with a
  `rgba(gold,.12)` fill, rising to `.25` when hovered or pressed.
- **Focus**: `outline: 2px solid $primary-color; outline-offset: 2px` plus
  `$focus-ring-desktop`. **Disabled**: opacity 0.5.
- **Ghost** (`@include button-ghost`): transparent, with a `$border-secondary`
  1px border and `$text-secondary` text. Active is the same as primary above.
- Inside `tbody`, controls drop to 24px. Icon buttons are square, using
  `data-control-size="icon"`.
- No gradients, no glow, no pill shapes, no tall buttons in dense UI.

### Segmented toggles

A dark rail with 4px padding and the 32–40px control heights. Inactive segments
are transparent with `$text-secondary` text. Hover gets a `rgba(primary,.1)`
tint. Active is a 2px primary border, the `$primary-color-opaque` fill and white
text. References: `GameGrid .modeToggle`, `DraftSettings`.

### Inputs, selects and search

Fields are dark (`$background-dark` or `$draft-input`) with a `$border-control`
edge (`#6b6f75`, 3:1) and `$radius-control`. Focus gives a primary border and
ring. Placeholders are Roboto Condensed italic in `rgba($text-secondary,.55–.7)`.
Custom checkboxes are 18px, `appearance: none`, and fill with primary when
checked. Dropdown menus open below their trigger as a dark shell with a clear
border. An option hover may use a `$color-brand-primary` fill with
`$color-brand-dark` text.

### Tables

Tables sit inside a panel, with sticky `$background-dark` headers, compact rows
(`$table-cell-padding-compact`) and `$border-soft` row dividers. Numbers use
Martian Mono and keep one alignment down each column. Striping is restrained. Current or selected rows
get a tint and the approved left rule. Empty, loading and error states stay
inside the table panel.

### Dialogs

A fixed backdrop at `rgba(0,0,0,.78)` with an optional 6px blur. The shell is
`min(1150px, 96vw)` wide and at most 92vh tall, with a `$border-soft` border,
`$border-radius-lg` and a `$background-dark` fill. The body owns the scroll.
The dialog needs `role="dialog"` and `aria-modal`, a focus trap, Escape to
close, and focus returned to the opener on close. Compose from
`DraftDashboard/ModalShell`.

### Site chrome (header, nav, footer)

- **Desktop** (≥1100px): a 64px header in `$background-header` with a 4px
  double white bottom border and a diagonal cyan/white stripe. Nav links are
  15px uppercase Roboto Condensed at 0.04em. Hover is `$chrome-link-hover`.
  Active is primary text on `$chrome-active` with a primary bottom rule.
  Dropdowns are `$chrome-menu-bg` with `$chrome-label` section labels, and item
  hover is `$chrome-hover`.
- **Mobile**: a 56px sticky bar in `$chrome-bg` with a `$chrome-border` border.
  The bottom nav has five 56px tabs; the active tab has a 3px primary top rule,
  a `$chrome-active-mobile` fill and primary text.
- **Footer**: `$chrome-bg` with a `$chrome-border` top border,
  `$chrome-footer-text` text and primary link hover.
- Keep the blue brand chrome. When flattening a gradient, reproduce the same
  rendered blue as one flat tint, never a neutral grey.

## 5. Layout

- Page workspaces have `max-width: v.$page-max-width` (90%) and
  `margin-inline: auto`. **Never run edge to edge.**
- Use CSS Grid for dashboards. Typical columns are `2fr 1fr 2fr` or a dominant
  primary column with side rails, with `$panel-gap` (24px) between panels.
  Mobile stacks to one column.
- The standard unit is `$space-md` (16px). Dense surfaces use 8–12px gaps.
- A **control bar** is a flex row inside a panel header with `gap: $space-sm`,
  a bottom divider and controls aligned to one height. It wraps on small screens.
- Touch targets are at least 44px (`$touch-target-min`), or 24px for inline text
  buttons.

## 6. Depth and Elevation

Depth comes from surface steps and borders. The shadow tokens are soft, dark
and ambient (`$shadow-panel`, `$shadow-panel-hover`, `$shadow-hover`). There is
no coloured glow: active and selected states are fill plus border. Blur is
allowed only on overlays (`$blur-backdrop-soft` 12px, `-strong` 28px).

## 7. Do and Don't

**Do**

- Use tokens, and add a missing one to `vars.scss` rather than writing a literal.
- Use `@use "styles/vars" as v;`, and `sass:color` only when needed.
- Use `var(--accent)` / `var(--position-color)` for dynamic colour.
- Give every interactive state a non-colour cue as well (border width, fill, text).
- Keep BPA's accent on its three initials in "Best Players Available" headings.
- Check rendered output for toenails, miters and clipped radii.

**Don't**

- Don't use gradient page shells, glossy or cloudy panels, or glass on ordinary panels.
- Don't glow borders, buttons or active states. (The old "add a glow on hover" rule is retired.)
- Don't use 12px glowing "neon strips", gradient primary buttons or purple-on-black fallbacks.
- Don't use gold or secondary cyan as a second link or button system.
- Don't use position colours outside position identity.
- Don't use white text on solid primary fills; use `$text-on-primary`.
- Don't swap blue brand chrome for neutral greys.

## 8. Agent Prompt Guide

1. Pick the page archetype first (fhfh-styles §6).
2. Shell: `#202020` body, then a `$background-dark` page at 90% max width.
3. Panels: `panel-shell` (soft on data pages), `panel-header`, `panel-body`.
4. Controls: wrap the control region in the `Controls.module.scss` scope instead of styling buttons locally.
5. Accent: cyan for everything interactive, gold only for favourite/compare/medal, semantic colours only for meaning.
6. Type: Train One uppercase for titles and labels, Roboto Condensed for UI copy, Martian Mono for numbers.
7. Emphasis: a rail or the approved left rule, a stronger border and a fill. No glow.
8. Before closing: confirm every token exists, run the toenail and clipped-radius sweep, and check contrast (fields 3:1, text 4.5:1).

## 9. Known Gaps and Drift

- Fixed 2026-11-07: site chrome colours are now the `$chrome-*` tokens, and
  `Controls.module.scss` input and select edges use `$border-control-color`
  (3.35:1). Its buttons, summary and checkboxes still use `$border-secondary`.
- Two radius scales (`$radius-*` and `$border-radius-*`) and two spacing scales
  (`$space-*` 2/4/8/16… and `$mobile-space-*` 4/8/12/16…) coexist.
- The position colours (`$draft-position-colors`) differ from the older chart
  auxiliaries (`$color-teal`, `$color-orange`, `$color-purple`).
- `$error-color` aliases the yellow `$focus-color`. Use `$danger-color` for errors.
- Faux-bold Roboto Condensed and Train One (see Typography).
- Still deferred in the spec: chart-first layouts, advanced popovers, page-level
  empty states, inline callouts.
