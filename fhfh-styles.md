<!--
  FHFHockey.com Front-End Product Requirements & Design System Guide
  Purpose: This document enables designers, engineers, and AI copilots to produce net-new pages & components that visually and behaviorally integrate seamlessly with the existing FHFHockey.com experience.
-->

# FHFHockey.com UI / UX PRD & Design System ("Vibrant Glassmorphism" Analytics Aesthetic)

## 0. High‑Level Brand & Experience Summary

FHFHockey.com presents a high-density professional fantasy + NHL analytics environment with a futuristic command-center vibe: dark polar night surface layers, neon cyan energy accents, subtle glass diffusion, condensed typographic rhythm, and purposeful bursts of glow to denote action, state change, or analytical significance. The interface optimizes simultaneous comprehension of multiple metrics (tables, projections, schedules, heat / intensity maps) while preserving visual hierarchy through consistent panel framing, accent borders, and compact control clusters.

Use these brand adjectives when prompting or briefing: analytical, competitive, neon, disciplined, high-contrast, glass-layered, data-forward, modular, responsive, actionable.

## 1. Core Design Principles (Source of Truth)

1. Vibrancy & Glow (Selective Energy): Cyan primaries (#14a2d2 / #07aae2) drive actionable focus. Glow is applied sparingly: current pick, active tab, focus ring, animated shimmer, success/positive pulses, predictive intensities.
2. Layered Glassmorphism: Panels = translucent / diffused dark glass atop deeper matte charcoal substrate. Frosted effect variants: linear gradients + very low-opacity white overlays + blur + subtle border.
3. Information Density With Breathing Points: Data cells, filters, and table headers use reduced padding + small/xxs type; headings and segmentation create rhythm between dense blocks.
4. Dynamic Team Theming: Color injection via CSS variables for team contexts (player cards, matchup cells, charts, header strips). Never hardcode team hex—always map through team classes.
5. Motion as State Reinforcement: Animation (pulse, shimmer, subtle translateY(-2px) on hover) conveys liveness—not ornament. Avoid gratuitous continuous motion outside active statuses.
6. Responsiveness by Reflow, Not Removal: Mobile stacks panels vertically; control groups collapse or wrap while preserving analytical capability.
7. Accessibility & Operability: Keyboard traversal for filters, sticky table headers for orientation, focus-visible outlines that harmonize with glow language.

## 2. Design Tokens (SCSS `vars.scss` – Single Source of Truth)

All colors, spacing, radii, typography, and shadows derive from tokens. Never hardcode #14a2d2, etc. Wrap new structural utilities as mixins referencing tokens.

## Design System Tokens (Source of Truth)

All styling **must** be derived from the following SCSS variables defined in `vars.scss`. Do not use hardcoded values for colors, fonts, spacing, or radii.

```scss
// ===== FHFHOCKEY.COM CORE DESIGN TOKENS (vars.scss) =====

// --- Breakpoints ---
$breakpoint-mobile-max: 480px;
$breakpoint-tablet: 768px;
$breakpoint-desktop: 1024px;

// --- Colors ---
$primary-color: #14a2d2;
$secondary-color: #07aae2;
$success-color: #00ff99;
$warning-color: #ffcc33;
$danger-color: #ff6384;
$info-color: #3b82f6;
$focus-color: rgb(255, 193, 8);

$background-dark: #1a1d21;
$background-medium: #181a1e;
$background-light: #202020;

$text-primary: #cccccc;
$text-secondary: #aaaaaa;
$text-button: #ffffff;

$border-primary: #404040;
$border-secondary: #505050;
$border-accent: $secondary-color;

// --- Typography ---
$font-family-primary: "Roboto Condensed", sans-serif;
$font-family-accent: "Train One", sans-serif;
$font-family-numbers: "Martian Mono", monospace;

$font-size-base: 1rem;    // 16px
$font-size-sm: 0.875rem; // 14px
$font-size-xs: 0.75rem;  // 12px
$font-size-xxs: 0.625rem;// 10px
$font-size-md: 1.125rem; // 18px
$font-size-lg: 1.25rem;  // 20px
$font-size-xl: 1.5rem;   // 24px

// --- Spacing ---
$space-xs: 4px;
$space-sm: 8px;
$space-md: 16px;
$space-lg: 24px;
$space-xl: 32px;

// --- Borders & Shadows ---
$border-radius-sm: 6px;
$border-radius-md: 8px;
$border-radius-lg: 12px;
$box-shadow-panel: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
```

### 2.0 How to import tokens/mixins in SCSS modules

Use SCSS modules with the token namespace so you don’t leak globals. This keeps usage explicit and grep‑friendly.

```scss
// In a component SCSS module
@use "../styles/vars.scss" as v;

.panel {
  @include v.glass-panel; // glass surface + blur + subtle border/shadow
}

.primaryBtn {
  @include v.button-style; // primary cyan button
}

.ghostBtn {
  @include v.button-ghost($active: false); // ghost/secondary button
}

.tableBase {
  @include v.table-base; // dense table baseline (colors, radii, spacing)
}

.scrollBody {
  @include v.custom-scrollbar(v.$primary-color, v.$background-medium, 6px);
}
```

### 2.1 Additional Implicit / Observed Tokens & Patterns
- Extended shadows: contextual variants (soft diffused vs accent glow) often layered: base elevation + colored inner/outer halo.
- Opacity patterns: success/warning overlays use `rgba(token, ~0.1–0.35)` for backgrounds; intensities escalate alpha steps.
- Animation timing: 150–300ms for UI interactions; 1.5–3s loops for shimmer / pulse.

## 3. Visual Layering Strategy

| Layer | Purpose | Typical Styles |
|-------|---------|----------------|
| Base Canvas | Deep neutral foundation | `$background-dark` solid fill |
| Panel Shell | Primary container (board, roster, tables) | `$background-medium` or gradient around medium ±2% lightness, 1px border `$border-secondary`, subtle shadow |
| Highlight / Accent Panel | Elevated focus zone (center roster, modals) | Gradient background + 2px accent (primary) border + glow shadow stack |
| Interactive Element | Buttons, toggles, picks | Gradient or glass button surface + hover lighten + border accent + slight lift |
| Dynamic / Themed | Team context or heat intensity | CSS variables (`--team-*`), intensity classes (.intensity0–4) |

## 4. Typography System & Usage Conventions
- Families:
  - Headings / Titles / Panel Titles: `$font-family-accent` (Train One) or accent style; all-caps, tracking 0.05–0.08em.
  - Body & Labels: `$font-family-primary` (Roboto Condensed) for compactness & scanning.
  - Numbers / Tabular Data: `$font-family-numbers` (Martian Mono) when alignment precision matters (projections, schedules, game logs).
- Scale Mapping:
  - XL (24px) – Page hero / major section header.
  - LG (20px) – Panel headers / modal titles.
  - MD (18px) – Subheaders / control grouping.
  - Base / SM (16–14px) – Standard descriptive text & interactive labels.
  - XS / XXS (12–10px) – Dense table headers, footnotes, intensity legends, bubble labels.
- Letter Spacing: Accent headings use 0.05–0.12em; small uppercase label tokens use 0.05–0.08em.
- Weight: 600–700 on headings, 500–600 on table header, 400–500 body; avoid extraneous bold for data emphasis—use color or subtle background highlight.

## 5. Color Application & Semantics
- Primary / Secondary (Cyan Gradient) = Action, active states, selection emphasis, progress fill.
- Success = Achieved / Keeper / Positive trend / Completed (progress fill, drafted, intensity scaling).
- Warning = Current / Pending attention (active pick, temporal focus, countdown emphasis).
- Danger = Errors, invalid states; used sparingly (error banners, destructive warnings).
- Info = Optional supplemental highlight (rare—charts, tooltip accents).
- Neutral Greys = Structural surfaces, dividers, separators, non-active chrome.
- Team Variables = Applied to abbreviations, stripes, logo halos, themable header trims.

### Glow & Highlight Heuristics
Use glow (outer colored shadow or drop-shadow filter) only on:
1. Current actionable focus (current pick, hovered critical control).
2. Active shimmering summary / call-to-action motion (summary button shimmer pass every 3s).
3. Success or warning attention pulses.
Avoid glow on static dense tables (creates noise) – rely on zebra + hover row highlight.

## 6. Spacing & Density Rules
- Global panel padding: `$space-md $space-lg` desktop, compress to `$space-sm` on tablet/mobile.
- Dense tables: cell vertical padding ~ `$space-xs` to `$space-sm` (never larger); headers maybe +2px.
- Control bars: compress groups with gap `$space-sm`; stacked variants (label above control) reduce horizontal overflow.
- Multi-panel grids: gap `$space-lg` desktop, `$space-sm` mobile.
- Inline icon + label gap: `$space-xs`.

## 7. Layout Archetypes
### 7.1 Three-Panel Analytical Workspace (Draft Dashboard)
Grid: `2fr 1fr 2fr` with min-heights and scrollable internal panel bodies. Center panel (roster) visually accented (gradient background + primary border) to establish user-owned context.

### 7.2 Data Exploration Page (Player / Team Stats)
Stacked modular sections (overview, advanced splits, radar, heatmaps, contextual performance calendar). Each section = panel with unified header strip and consistent spacing rhythm.

### 7.3 Schedule / Grid Hybrid (GameGrid)
Composable column/row structure with horizontal scroll safety, custom vertical separators, condensed interactive header controls (orientation toggles, date navigation, mode switch buttons).

### 7.4 Table + Control Bar Pattern (Projections, Player Game Logs)
Sticky header + scrollable body + dense filters bar (stackable) + optional mini forecast band (micro bar charts / bars using gradient fill).

### 7.5 Contribution / Intensity Matrix (Draft ‘GitHub-style’ grid)
Series of uniform grid tracks, round labels, intensity cells styled by complexity tier (.intensity0–4). Animated states layered on top (current pick pulse, keeper badge, traded gradient overlay).

## 8. Panels & Containers
Base panel: `$background-medium`, 1px border `$border-secondary`, subtle shadow. Elevated / highlighted panel: gradient (angle ~135deg, subtle ±2% lightness shifts) + 2px accent border + glow stack (primary + secondary RGBA overlays). Modals inherit panel shell + additional backdrop blur + dark overlay.

### Panel Header Pattern
Structure: flex/space-between or grid (title | actions | meta). Elements:
- Title (accent font, uppercase, accent color span for dynamic emphasis)
- Secondary inline controls (toggle groups, filters, export/download icons)
- Optional status indicators (pulse dot, progress bar beneath)

### Scroll Containers
Use `@include v.custom-scrollbar(primaryColor, trackColor, size)` for brand-coherent scrollbars. Sticky headers anchor orientation on Y scroll.

## 9. Interaction & Controls
### Buttons
- Primary: Cyan gradient 135deg (primary→secondary), uppercase condensed accent, subtle lift on hover (`translateY(-2px)` + expanded shadow).
- Secondary / Ghost: Transparent or dark surface; accent border only appears on hover.
- Active: Solid accent fill or active highlight background (`$primary-color-opaque` variant) + inner glow.
- Disabled: Grey medium fill, reduced opacity, no transform animation.

### Toggle Groups & Filters
Compact pill-like buttons using small/xxs font + uppercase tracking. Active state uses accent fill or accent border + background overlay. Provide arrow key navigation (index-based, wrap-around) as in Stats filters.

### Switches / Checkboxes
Custom check glyph scaling + gradient or focus-color background when checked. Focus ring uses 2–4px shadow spread with semi-transparent primary or focus token.

### Input Fields
Dark surface `$background-dark`, 1px `$border-secondary` until focus -> highlight `$primary-color` border + subtle outer glow (0 0 0 2px rgba(primary, 0.2)).

## 10. Data Representation Patterns
### Tables
- Sticky thead, zebra striping via ± lightness adjustments to `$background-dark`.
- Sorting: header hover color shift + active cyan text and subtle tinted background.
- Numeric alignment: right or center; ensure `font-variant-numeric: tabular-nums` where alignment critical.
- Row hover: slight lightness increase (not glow) to prevent noise.

### Intensity / Heat Cells
Use .intensity0–4 classes to encode magnitude; scale color from desaturated dark neutral to full success-color saturation. Avoid mixing success + warning in same gradient region (reserve warning for temporal / state, not volume).

### Progress & Forecast Bars
Use linear gradient primary→secondary fill; animate width with 240–500ms ease transitions; never animate color continuously.

### Shimmer Effect
One directional pass (linear-gradient translucent white band) across CTA or summary; cycle 2.5–3s; avoid simultaneous multiple shimmering components.

### Pulsing Indicators
Applied to active turn / current pick: scale or shadow-intensity oscillation; limit to 1–2 active at once.

## 11. Dynamic Team Theming Pattern
1. Team class applied to root container: `.team-<ABBR>`.
2. Class sets CSS vars: `--team-primary`, `--team-secondary`, `--team-accent`, `--team-jersey`, `--team-alt`.
3. Components consume via: borders, accent stripes, monospace data callouts, top header underline.
4. Fallback: if no team, default to primary cyan scheme.
5. Avoid using team colors for error/success semantics; keep semantics distinct.

## 12. Animation Guidelines
| Animation | Purpose | Duration | Notes |
|----------|---------|----------|-------|
| pulse-glow | Draw attention to live / current state | 2s loop | Box-shadow intensity oscillation |
| current-pick-pulse | Emphasize current draft pick | 1.5s loop | Scale 1 → 1.05 → 1 with glow |
| summary-shimmer | CTA highlight | 3s loop | Single directional band |
| drawerSlide | Settings drawer entrance | 300ms | Slide from edge + fade |
| width transitions (progress/minirun) | Metric update | 240–500ms | Ease-in-out width change |

Performance: Use transform & opacity (GPU-friendly). Limit simultaneous shadow animations (costly) to essential states.

## 13. Accessibility & Inclusive Design
- Focus: Always visible focus ring (primary or focus-color) with 2–4px halo offset; do not rely solely on color shift.
- Contrast: Maintain WCAG AA for text vs backgrounds (adjust lightness or add inset dark overlay if team color too light).
- Reduced Motion: Respect `prefers-reduced-motion` – disable shimmer & pulse loops.
- Keyboard: Arrow key cycling for filter groups; ESC to close drawers/modals; space/enter triggers toggles.
- ARIA: Label grouped controls (e.g., "Projection filters"), annotate progress (aria-valuenow) for progress bars, ensure sortable headers have `aria-sort` state.

## 14. Code & SCSS Architecture Patterns
- Modular SCSS (BEM-ish functional sections) with semantic group comments.
- Shared mixins: `@include v.button-style; @include v.component-wrapper; @include v.element-wrapper; @include v.custom-scrollbar();`
- Avoid deep nesting >3 levels; prefer single-class responsibilities (e.g., `.panelHeader`, `.panelContent`).
- Reuse placeholder selectors (`%card-base`, `%performance-*`) in player stats for variant tiers.
- Use maps + loops for repeated intensity or team classes.

## 15. Creating a New Analytics Page – Prescriptive Blueprint
1. Define purpose (e.g., Weekly Matchup Insights) → pick base layout archetype (multi-panel vs stacked).
2. Scaffold root container: `.pageContainer` using component-wrapper mixin.
3. Add primary panels: each with `.panelHeader` (accent title + optional actions) + `.panelContent` scroll region.
4. Introduce control strip: Stacked on small screens, horizontal in >tablet. Provide arrow-key navigation group.
5. Implement data table with sticky header and zebra pattern; use monospace for numeric heavy columns.
6. Add visual metric overlays (mini bar, radar, intensity heat) using existing intensity scale or forecast bar pattern.
7. If team-contextual: wrap root in team class + use CSS vars for accent stripes / small badges.
8. Add accessible focus sequencing and ARIA labeling.
9. Integrate performance-friendly animation only where stateful (no decorative loops).

### Layout Skeleton (LLM Prompt-Safe)
```pseudo
<div class="pageContainer">
  <section class="panel analyticsOverview">
    <header class="panelHeader">
      <h2 class="panelTitle">OVERVIEW <span class="panelTitleAccent">METRICS</span></h2>
      <div class="panelActions">[filters / toggles]</div>
    </header>
    <div class="panelContent">[summary tiles | charts]</div>
  </section>
  <section class="panel dataSection">
    <header class="panelHeader">
      <h2 class="panelTitle">PLAYER <span class="panelTitleAccent">TABLE</span></h2>
      <div class="panelActions">[search | export | timeframe]</div>
    </header>
    <div class="tableWrapper">[sticky header table]</div>
  </section>
  <section class="panel visualSection">[heatmap / radar / forecast bars]</section>
</div>
```

## 16. Common Reusable Patterns (Extracted Examples)
### Status Indicators
Inline pill (success gradient or neutral) + pulsing dot (CSS `content: "●"; animation: pulse`).

### Intensity Classes (.intensity0–4)
Map aggregated frequency / pick density / performance tier to background saturation. Provide legend with inline gradient swatches.

### Keeper / Traded / Current Pick Overlays
Layer badges (absolute positioned, top-right), dashed borders (traded), pulsing or gradient backgrounds (current pick). Maintain clarity over text with text-shadow.

### Mini Run Forecast
Horizontal micro bars sized via width% transitions; descriptor row uppercased 10–12px label; values use tabular numerals.

### Shimmer CTA
Button with relative container + ::after sliding translucent diagonal.

## 17. Do / Don’t Guidance
Do: Use subtle gradient shifts for panel elevation instead of high-contrast borders alone.
Do: Keep row hover states restrained (lightness shift) — avoids disco effect in dense tables.
Do: Provide stacked control layout to prevent horizontal scroll overflow in narrow widths.
Do: Maintain consistent uppercase tracking for all analytic labels.
Don’t: Apply glow on every interactive element—reserve for emphasis.
Don’t: Use team colors for semantic error/success messaging.
Don’t: Animate size or layout properties causing reflow (prefer transform/opacity).

## 18. Future Improvements (Backlog Candidates)
- Unify panel header component (TSX abstraction) with built-in actions slot & responsiveness rules.
- Centralize intensity scale mixin (accept base color + step count).
- Provide theme audit script to flag hardcoded hex usage.
- Introduce motion-reduced class to disable shimmer / pulse when `prefers-reduced-motion` active.
- Add semantic color ramp tokens (e.g., `--primary-100..900`) for refining dark/light variants.

## 19. Component Recipes (Canonical Extracts)
Below are refined recipes (supersedes earlier minimal section) for reuse.

### 19.1 Glass Panel
```scss
.glass-panel {
  background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  backdrop-filter: blur(12px) saturate(150%);
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: $box-shadow-panel;
  border-radius: $border-radius-lg;
  padding: $space-md $space-lg;
  position: relative;
}
```

### 19.2 Panel Header
```scss
.panelHeader {
  background: linear-gradient(
    135deg,
    $background-dark,
    color.adjust($background-dark, $lightness: 4%)
  );
  border-bottom: 2px solid $secondary-color;
  padding: $space-md $space-lg;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-md;
}
.panelTitle { font-family: $font-family-accent; letter-spacing: 0.08em; text-transform: uppercase; font-size: $font-size-lg; margin: 0; }
.panelTitleAccent { color: $primary-color; }
```

### 19.3 Dense Data Table
```scss
.data-table { /* see earlier section for full pattern */ }
```

### 19.4 Toggle Button (Compact)
```scss
.toggleBtn {
  background: $background-dark;
  border: 1px solid $border-secondary;
  padding: 6px 8px;
  font-size: $font-size-xxs;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: $border-radius-sm;
  transition: 0.15s ease;
  &:hover,&:focus-visible { border-color: $primary-color; color: $text-primary; box-shadow: 0 0 0 2px rgba($primary-color,0.25); }
  &.active { background: $primary-color; color: $text-button; }
}
```

### 19.5 Intensity Cell
```scss
.intensity0 { background: color.adjust($background-medium, $lightness: -5%); }
.intensity1 { background: color.adjust($success-color, $alpha: -0.7); }
.intensity2 { background: color.adjust($success-color, $alpha: -0.5); }
.intensity3 { background: color.adjust($success-color, $alpha: -0.3); }
.intensity4 { background: $success-color; }
```

### 19.6 Shimmer CTA
```scss
.ctaShimmer { position: relative; overflow: hidden; }
.ctaShimmer::after {
  content: ""; position: absolute; inset: 0; background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.12) 20%, transparent 40%);
  transform: translateX(-120%); animation: shimmer 3s infinite ease-in-out; pointer-events: none;
}

## 20. Stats Pages style kit (Index • Player • Team • Game)

This kit codifies the Stats pages’ look and recurring mechanics, aligned to the Draft Dashboard “vibrant glassmorphism.” All snippets assume `@use "styles/vars" as v;` and no hardcoded hex. Prefer CSS variables for team contexts.

### 20.1 Shared patterns and helpers
- Root containers: use `@include v.component-wrapper;` for panel shells and `@include v.element-wrapper;` for inner elements.
- Tables: `@include v.table-base;` then apply sticky header, zebra rows, and restrained hover (lightness shift, not glow).
- Scrollbars: `@include v.custom-scrollbar(v.$primary-color, v.$background-medium, 8px);`
- Focus: `@include v.focus-ring();` for keyboardable elements; respect `prefers-reduced-motion`.
- Team theming: set per-page CSS vars based on team context, then consume in accents.

SCSS pattern for team variables
```scss
.hasTeamColors {
  // Provided dynamically on container when team context is available
  // Values come from runtime via inline style or a team class
  --primary-color: var(--team-primary);
  --secondary-color: var(--team-secondary);
  --jersey: var(--team-jersey);
  --accent: var(--team-accent);
  --alt: var(--team-alt);
}
```

Opacity guidance (recurring):
- Glass panels: background linear-gradient white overlay at 0.02–0.06 alpha over dark base.
- Row highlight: use `rgba(v.$focus-color, 0.08–0.16)`; avoid heavy glow.
- Quick stats pills: use color-mix with team primary at ~60–75% into #000 for bg; border at ~60–75% into #fff.
- Heat/Intensity: step alpha 0.15 → 0.9; never mix warning with success in same ramp.

### 20.2 Stats Index page (leaders, filters, teams grid)

Layout shell
```scss
.statsPageContainer {
  width: 100%;
  margin: 0 auto;
  @include v.component-wrapper;
}

.heroSection { // Edge-to-edge on mobile, framed on tablet+
  @include v.component-wrapper;
  padding: v.$mobile-space-xl v.$mobile-space-lg;
  background: v.$background-medium;
  border: 1px solid v.$border-primary;
  border-radius: v.$border-radius-lg;
}
```

Quick stats tiles
```scss
.quickStatCard {
  background: v.$surface-1;
  border: 1px solid v.$border-secondary;
  border-radius: v.$radius-md;
  transition: background-color v.$transition-duration v.$transition-easing;

  &.scoring { border-left: 4px solid v.$primary-color; }
  &.goaltending { border-left: 4px solid v.$secondary-color; }
  &.league { border-left: 4px solid v.$warning-color; }

  &:hover { background: v.$surface-2; box-shadow: v.$shadow-hover; transform: translateY(-2px); }
}
```

Filter group (keyboardable)
```scss
.filterBar { display: flex; gap: v.$space-xs; flex-wrap: wrap; }
.filterButton { @include v.button-style; background: v.$surface-1; border: 1px solid v.$border-secondary; color: v.$text-secondary; }
.filterButtonActive { background: v.$primary-color; color: v.$text-button; border-color: v.$primary-color; position: relative; }
.filterButtonActive::before { content: ""; position: absolute; inset: 0; border-left: 4px solid v.$warning-color; border-radius: inherit; }
```

Leaderboards & dense tables
```scss
.leaderboards { @include v.component-wrapper; }
.leaderboardTable { @include v.table-base; th { position: sticky; top: 0; } }
```

Teams grid (with team color pulse)
```scss
.teamsGridContainer { position: relative; }
.teamListItem {
  background: v.$surface-1; border: 1px solid v.$border-secondary; border-radius: v.$radius-sm;
  transition: transform v.$transition-duration v.$ease-desktop-standard;
  &:hover { transform: translateY(-2px); border-color: v.$border-accent; box-shadow: v.$shadow-hover; }
}
.teamAbbrev { color: var(--team-secondary, v.$secondary-color); text-shadow: 0 0 6px color.change(var(--team-primary, #{v.$primary-color}), $alpha: 0.6); }
```

Accessibility notes
- Provide a roving tabindex or arrow-key cycling for the filter group (already implemented in code).
- Sticky headers preserve orientation in long lists.

### 20.3 Player Stats page (overview • advanced • trends • calendar)

Navigation and header
```scss
.navigationHeader { display: flex; align-items: center; justify-content: space-between; gap: v.$space-sm; }
.backButton { @include v.button-ghost(false); font-size: v.$font-size-sm; }
.pageTitle { font-family: v.$font-family-accent; letter-spacing: 0.08em; text-transform: uppercase; }

.playerHeader { @include v.component-wrapper; display: flex; align-items: center; gap: v.$space-xl; padding: v.$space-lg; }
.playerName { font-size: 2.2rem; letter-spacing: 0.1em; color: v.$text-primary; }
```

Tabs and controls
```scss
%stats-base-button { @include v.button-style; background: transparent; border: 1px solid v.$border-secondary; color: v.$text-secondary; }
.tabNavigation { display: flex; gap: v.$space-sm; border-bottom: 2px solid v.$border-primary; padding-bottom: v.$space-xs; }
.tabButton { @extend %stats-base-button; &.active { background: v.$primary-color; color: v.$text-button; border-color: v.$primary-color; } }
.timeframeButton { @extend %stats-base-button; padding: v.$space-xs v.$space-md; &.active { background: v.$secondary-color; color: v.$text-button; border-color: v.$secondary-color; } }
.controlsSection { @include v.component-wrapper; padding: v.$space-lg; }
```

Overview grid and panels
```scss
.overviewGrid { display: flex; gap: v.$space-lg; }
.leftColumn, .rightColumn { display: flex; flex-direction: column; gap: v.$space-md; }
.radarSection, .insightsSection { @include v.component-wrapper; padding: v.$space-lg; }
.calendarSection { min-height: 500px; padding: v.$space-sm; outline: 5px solid v.$border-color-primary; border-radius: v.$border-radius-lg * 1.5; }
```

Tables
```scss
.tableWrapper { overflow-x: auto; border-radius: v.$border-radius-md; border: 1px solid v.$border-secondary; &.scrollable { height: 400px; overflow-y: auto; background: v.$background-dark; } }
.statsTable { width: 100%; border-collapse: collapse; background: v.$background-dark; th, td { padding: v.$space-sm v.$space-md; border-bottom: 1px solid v.$border-secondary; } th { background: v.$background-medium; color: v.$primary-color; position: sticky; top: 0; } tbody tr:hover { background: v.$background-light; } }
```

Charts and glass wraps
```scss
.chartWrapper, .radarWrapper {
  position: relative; width: 100%; padding: v.$space-md;
  background: linear-gradient(135deg, rgba(v.$background-dark, 0.8) 0%, rgba(v.$background-medium, 0.9) 100%);
  border: 1px solid v.$border-secondary; border-radius: v.$border-radius-md; overflow: hidden;
}
```

Performance badges & heat cells
```scss
.percentile.elite { background-color: rgba(16,185,129,0.2); color: #10b981; }
.percentile.good  { background-color: rgba(v.$success-color,0.2); color: v.$success-color; }
.percentile.average { background-color: rgba(v.$warning-color,0.2); color: v.$warning-color; }
.percentile.poor { background-color: rgba(v.$danger-color,0.2); color: v.$danger-color; }

.heatmapDay.level-0 { background: v.$background-medium; }
.heatmapDay.level-1 { background: rgba(v.$primary-color, 0.3); }
.heatmapDay.level-2 { background: rgba(v.$primary-color, 0.5); }
.heatmapDay.level-3 { background: rgba(v.$primary-color, 0.7); }
.heatmapDay.level-4 { background: rgba(v.$primary-color, 0.9); }
```

Parity checklist (Player)
- Glass panels on all major sections; avoid raw unframed charts/tables.
- Tabs use compact uppercase with active cyan fill.
- Sticky headers in tables; zebra rows via dark lightness steps.
- Calendar/heatmap uses primary ramp opacity steps; no glow.
- Focus-visible always on nav, tabs, and checkboxes.

### 20.4 Team Stats page (header stripes • quick stats • table • shot viz)

Team header stripes and logo
```scss
.teamHeader { position: sticky; top: 0; z-index: 3; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
.teamLogoContainer {
  display: flex; align-items: center; gap: 1rem; padding: 1rem 3rem; height: 100px;
  background: linear-gradient(
    180deg,
    var(--primary-color) 0%, var(--primary-color) 70%,
    var(--jersey) 70%, var(--jersey) 80%,
    var(--accent) 80%, var(--accent) 90%,
    var(--secondary-color) 90%, var(--secondary-color) 100%
  );
}
.teamName { font-family: v.$font-family-accent; text-transform: uppercase; letter-spacing: 0.15em; background: var(--accent); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
```

Quick stats pills
```scss
.quickStats { display: flex; gap: v.$space-md; align-items: center; }
.quickStat { display: flex; flex-direction: column; align-items: center; min-width: 80px;
  background: color-mix(in srgb, var(--primary-color) 70%, #000);
  border: 2px solid color-mix(in srgb, var(--primary-color) 70%, #fff);
  border-radius: 8px; padding: 8px 12px;
}
.quickStatValue { color: color-mix(in srgb, var(--primary-color) 70%, #fff); font-weight: 700; }
.quickStatLabel { color: #ccc; font-size: 0.75rem; }
```

Team stats table
```scss
.teamStatsTable { @include v.table-base; background: #232323; color: #fefefe; border: 5px solid v.$border-color-secondary; outline: 5px solid v.$border-color-primary; border-radius: 0.5rem; min-width: 900px; }
.teamStatsTable th { background: #181818; color: v.$secondary-color; letter-spacing: 0.05em; position: sticky; top: 0; }
.teamStatsTable tbody tr:nth-child(even) td { background-color: v.$background-dark; }
.teamStatsTable tbody tr:nth-child(odd) td { background-color: color.adjust(v.$background-dark, $lightness: 2%); }
.teamStatsTable tbody tr:hover td { background-color: color.change(color.adjust(v.$focus-color, $lightness: -20%), $alpha: 0.4); color: v.$focus-color; font-weight: 600; border-top: 2px solid v.$focus-color; border-bottom: 2px solid v.$focus-color; }
```

Shot visualization split panel
```scss
.shotVisualizationContainer { display: flex; gap: v.$space-md; background: v.$background-light; border: 5px solid v.$border-color-secondary; border-radius: v.$border-radius-md; padding: v.$space-md; }
.controlPanel { width: 280px; display: flex; flex-direction: column; }
.rinkPanel { flex: 1; min-height: 420px; position: relative; }
```

Parity checklist (Team)
- Team header uses 4-band vertical stripe gradient driven by team vars.
- Quick stats pills reflect team primary via color-mix; no pure white text.
- Tables follow sticky header + zebra + restrained hover emphasis.
- Shot viz panel uses framed container with border and radius consistent with tables.

### 20.5 Game page (skeleton for future build)

Skeleton layout
```scss
.gamePageContainer { @include v.component-wrapper; }
.gameHeader { @include v.component-wrapper; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
.gamePanels { display: grid; grid-template-columns: 1fr 1fr; gap: v.$space-lg; }
.gameTable { @include v.table-base; }
```

Notes
- Reuse team theming from Team page when viewing a specific matchup; assign both teams’ colors for stripes or badges.
- Keep intensity/heat scales consistent with Player calendar and Dashboard intensity grid.

### 20.6 Migration and cleanup notes (legacy to tokens)
- `web/styles/teamStats.module.scss` contains hardcoded hex and shadows; migrate to tokenized colors and team CSS vars. Replace explicit `#07aae2`/`#343434` with `v.$secondary-color` and `v.$background-*` tokens.
- Prefer `@use "styles/vars" as v;` in all SCSS modules; avoid global imports.
- Consolidate duplicated table styling by extending `v.table-base` and local modifiers.
- Ensure all scroll containers use the brand scrollbar mixin.

### 20.7 Stats parity checklist (cross-page)
- Panel surfaces use glass/dark layering, not raw backgrounds.
- Accent usage is disciplined: cyan for action/selection, team colors for identity only.
- Tables: sticky headers, zebra rows, restrained hovers, tabular numerals where needed.
- Filters/toggles: compact uppercase, arrow-key accessible, focus-visible rings.
- Scrollbars and focus rings use brand-consistent mixins.
- Heat/Intensity and progress bars use token ramps and width transitions (240–500ms).
@keyframes shimmer { 0%{transform:translateX(-120%);}60%,100%{transform:translateX(120%);} }
```

### 19.7 Pulse Indicator
```scss
@keyframes pulse-glow { 0%,100% { box-shadow: 0 0 10px rgba($success-color,0.5);} 50% { box-shadow: 0 0 20px rgba($success-color,0.8);} }
```

## 19.8 Draft Dashboard style kit (ready-to-use snippets)

Below are production‑ready skeletons extracted from the Draft Dashboard so other pages can mirror the vibe quickly. All snippets assume `@use "../styles/vars.scss" as v;` at the top of the SCSS module.

### A) Dashboard page shell and 3‑panel grid
```scss
@use "../styles/vars.scss" as v;

.dashboardShell {
  background: v.$surface-0;
  color: v.$text-primary;
  display: grid;
  gap: v.$space-lg;
  grid-template-columns: 2fr 1fr 2fr; // desktop
  padding: v.$space-lg;

  @media (max-width: v.$breakpoint-desktop) {
    grid-template-columns: 1fr; // stack on tablet/mobile
    gap: v.$space-md;
    padding: v.$space-md;
  }
}

.panel {
  @include v.glass-panel(v.$space-md v.$space-lg, v.$radius-lg);
}

// Center panel (My Roster) gets a stronger accent frame
.panelAccent {
  background: v.$desktop-surface-elevated; // subtle gradient
  border: 2px solid v.$primary-color;
  box-shadow:
    0 0 0 1px rgba(v.$primary-color, 0.35),
    0 8px 28px -6px rgba(0,0,0,0.6),
    0 0 32px rgba(v.$primary-color, 0.15);
}
```

### B) Panel header strip
```scss
@use "../styles/vars.scss" as v;

.panelHeader {
  display: flex; align-items: center; justify-content: space-between;
  gap: v.$space-md;
  padding: v.$space-md v.$space-lg;
  background: linear-gradient(
    135deg,
    v.$background-dark,
    color.adjust(v.$background-dark, $lightness: 4%)
  );
  border-bottom: 2px solid v.$secondary-color;
}
.panelTitle { font-family: v.$font-family-accent; letter-spacing: 0.08em; text-transform: uppercase; font-size: v.$font-size-lg; margin: 0; }
.panelTitleAccent { color: v.$primary-color; }
.panelActions { display: flex; align-items: center; gap: v.$space-sm; }
```

### C) Projections table baseline (sticky header + scrollbar)
```scss
@use "../styles/vars.scss" as v;

.tableWrap { max-height: 70vh; overflow: auto; @include v.custom-scrollbar(); }

.projectionsTable {
  @include v.table-base;

  thead th {
    position: sticky; top: 0; z-index: v.$z-desktop-sticky;
    background: v.$background-dark;
    font-family: v.$font-family-primary;
    font-size: v.$font-size-xxs; letter-spacing: 0.06em; text-transform: uppercase;
    padding: v.$space-sm v.$space-md;
    border-bottom: 1px solid v.$border-secondary;
  }
  tbody td { padding: v.$space-sm v.$space-md; }
  tbody tr:nth-child(even) { background: color.adjust(v.$background-dark, $lightness: 3%); }
  tbody tr:hover { background: color.adjust(v.$background-dark, $lightness: 6%); }
}
```

### D) Suggested pick card with neon position stripe + ambient glow
```scss
@use "../styles/vars.scss" as v;

.suggestCard {
  position: relative;
  @include v.glass-panel(v.$space-md, v.$radius-md);
  transition: transform .15s ease, box-shadow .2s ease;

  &::before { // position stripe
    content: ""; position: absolute; inset: 0 0 0 0; border-left: 4px solid v.$secondary-color; opacity: .9;
  }
  &::after { // ambient glow
    content: ""; position: absolute; inset: -6px; pointer-events: none;
    box-shadow: 0 0 24px rgba(v.$secondary-color, .25);
  }
  &:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,.5), 0 0 24px rgba(v.$secondary-color,.2); }
}
```

### E) Draft board intensity cells (GitHub‑style grid)
```scss
@use "../styles/vars.scss" as v;

.intensity {
  &.lvl0 { background: color.adjust(v.$background-medium, $lightness: -3%); }
  &.lvl1 { @include v.schedule-fill(v.$schedule-green, .12); @include v.schedule-outline(v.$schedule-green); }
  &.lvl2 { @include v.schedule-fill(v.$schedule-green, .2);  @include v.schedule-outline(v.$schedule-green); }
  &.lvl3 { @include v.schedule-fill(v.$schedule-green, .3);  @include v.schedule-outline(v.$schedule-green); }
  &.lvl4 { background: v.$schedule-green; color: v.$color-black; }
}
```

### F) My Roster progress bars
```scss
@use "../styles/vars.scss" as v;

.progressBar { height: 8px; border-radius: 999px; background: color.adjust(v.$background-dark, $lightness: 6%); overflow: hidden; }
.progressFill { height: 100%; background: linear-gradient(90deg, v.$primary-color, v.$secondary-color); transition: width .35s ease-in-out; }
```

### G) Toggle groups (ghost buttons)
```scss
@use "../styles/vars.scss" as v;

.toggleGroup { display: flex; gap: v.$space-xs; flex-wrap: wrap; }
.toggleBtn  { @include v.button-ghost($active: false); font-size: v.$font-size-xxs; }
.toggleBtn--active { @include v.button-ghost($active: true); }
```

### H) Compare players modal – team theming
```scss
// Parent element sets team vars: .team-NJD { --team-primary: #c8102e; --team-secondary: #000; }
.compareHeader { border-bottom: 2px solid var(--team-primary, currentColor); }
.winnerGlow { box-shadow: 0 0 24px rgba(var(--team-primary-rgb, 20,162,210), .35); }
```

### I) Brand‑coherent scrollbars
```scss
.scrollArea { @include v.custom-scrollbar(v.$primary-color, v.$background-medium, 6px); }
```

### J) Focus rings (desktop/mobile)
```scss
.btn:focus-visible { @include v.focus-ring-desktop; }
@media (max-width: 480px) { .btn:focus-visible { @include v.focus-ring-mobile; } }
```

### Live parity checklist (Draft Dashboard look‑and‑feel)
- Center panel uses gradient surface + 2px primary border + soft outer glow.
- Headers: uppercase Train One with cyan accent span; sticky table headers.
- Dense tables: xx(s)/xs fonts, tight padding, zebra rows, restrained hover.
- Selective glow only for: current pick, active CTA shimmer, winner highlights.
- Custom scrollbar on scrollable panes.
- Team theming via CSS variables; no hardcoded team hex.

## 20. Dynamic Team Theming Example
```scss
// Generated per team
.team-NJD { --team-primary:#000; --team-secondary:#a20620; --team-accent:#154734; }

.team-themed-header {
  border-bottom: 3px solid var(--team-secondary);
  .abbr { color: var(--team-secondary); }
  .metric { color: var(--team-accent); }
}
```

## 21. AI Prompt Template (Copy/Paste)
Use this when asking an LLM to generate a new page or component:
```
You are designing a new FHFHockey.com analytics panel called <Feature Name>.
Follow the FHFHockey Vibrant Glassmorphism system:
 - Dark layered background (use tokens: $background-dark / $background-medium)
 - Panels: glass / gradient style (.glass-panel or panelHeader + panelContent pattern)
 - Headings: uppercase Train One, 0.05–0.08em tracking, accent span with $primary-color
 - Tables: sticky header, zebra striping via lightness adjustments, small font ($font-size-xs or $font-size-xxs), tabular numerals
 - Controls: compact toggle buttons (.toggleBtn), stacked when narrow, accessible arrow key navigation
 - Animations: only shimmer for primary CTA and pulse for live status
 - Use CSS team variables if team context exists; never hardcode team colors
 - No extraneous glow—reserve for active/focus states
 - Provide responsive layout: single column mobile, multi-panel desktop grid
 - Use intensity classes (.intensity0–4) for frequency heat mapping if needed
 - Provide focus-visible outlines and ARIA labels
Output: React + SCSS module referencing existing tokens (do NOT re-declare tokens).
```

## 22. Acceptance Criteria For New Components
- All colors and radii from tokens.
- No raw hex usage (except inline comments/examples).
- Panel header matches capitalization, spacing, accent treatment.
- Tables have sticky header + consistent padding + accessible semantics.
- Mobile layout stacks gracefully without horizontal scroll for controls.
- Team theming (if applicable) implemented via CSS variables and class naming convention.
- Animations respect prefers-reduced-motion.

## 23. Summary
This document codifies existing emergent styling across Draft Dashboard, GameGrid, PlayerStats, TeamStats, and Stats overview pages into a unified, prescriptive system. All future UI work should reference these principles, recipes, and acceptance criteria to ensure cohesive expansion of the analytics surface area.

---
## 23. Visual Nuance Addendum (Screenshots Synthesis v1.1)

The following refinements capture production visual nuances visible in the supplied screenshots. These extend—not replace—the core system definitions above.

### 23.1 Global Navigation & Top Bars
- Top navbar uses a near-black slab with a subtle 1px inner stroke (lighter gray) forming a channel frame; icons (social/support) align right with equal optical spacing.
- Active nav link treatment: subtle cyan underline OR color shift (ensure WCAG contrast) rather than a heavy background fill; keep transitions ≤150ms.
- Save / status badges (e.g., "SAVED") use uppercase XXS type with pill background (focus or success color variant) and slight outer glow (optional, only for dynamic state like unsaved → saved transitions).

### 23.2 Team Icon / Logo Grids (Stats Overview Header)
- Uniform square tokens with consistent padding and centered logos; hover adds: light border brighten + faint cyan ambient glow (RGBA primary at ~0.25 outer spread).
- Inactive state: matte charcoal tile + thin neutral border; do NOT animate scale on all simultaneously—only hovered tile (scale 1.00 → 1.03).

### 23.3 Leaderboard / Quick Stat Cards
- Each player row features: left vertical accent bar encoding rank tier (gold / silver / bronze for top 3, then primary cyan for others) using a 2–3px solid bar or pseudo-element.
- Multi-segment horizontal bars (e.g., Points, PPP) render stacked category contributions: each segment separated by 1px divider using background-dark overlay (no true gaps) to preserve contiguous geometry.
- Player portrait: circular or masked square with subtle inner shadow for depth; fallback silhouette uses neutral grey.
- Micro stat badges (e.g., GP, G, A) use XS font (10–11px) with consistent pill radius (border-radius-sm) and semantic color fill (green = strong, gold = above avg, red = weak, neutral grey/blue = baseline). Maintain color mapping parity with percentile pills (see 23.7).

### 23.4 Team Header Stripes (Team Stats Page)
- Full-width multi-stripe band under primary heading leverages team CSS variables: pattern often = primary (thick) + secondary (thin) + jersey/alt accent. Implement with layered pseudo-elements (`::before` thick, `::after` thin) or flexible grid.
- Heading lockup: Team logo (drop-shadow glow in secondary), large uppercase name with condensed tracking; subordinate metadata (record, division rank) uses inline pill chips following micro badge rules.

### 23.5 Metric Tile Cluster (Recent Form / Momentum / Rankings)
- Tile grid uses uniform internal padding (space-sm) with 2px bottom or full border; internal micro sections divided by 1px separators (border-secondary at 40–50% alpha or a slightly darker background-light variant).
- Ranking tiles show ordinal in large condensed font, companion narrative below in XXS uppercase label (text-secondary). Color-coded ordinal pills (e.g., "12th") adopt same semantic ramp as percentile scale.

### 23.6 Goaltending & Roster Panels
- Status chips (STARTER, BACKUP, IR, etc.) use sharply defined pill with high letter spacing, uppercase XXS; starter = success gradient, backup = neutral grey gradient, attention/injury = warning/danger variant.
- Workload distribution bar: horizontal segmented bar with proportional flex items; active (primary) segment uses slight inset highlight (linear-gradient top lighten 4%).

### 23.7 Percentile / Performance Pill Scale
Observed multi-tier scale for percentile / performance classification across Player, BPA, and Calendar contexts:

| Tier | Approx Range | Visual Fill | Text Color | Usage Examples |
|------|--------------|-------------|------------|----------------|
| Elite | 90–100 | Bright cyan → teal gradient or saturated primary | #fff | Percentile 90+ pills, standout radar nodes |
| Excellent | 75–89 | Strong green (success-color core) | #fff | High percentile pill, calendar strong games |
| Good | 60–74 | Medium green (success-color alpha -20% / darken 10%) | #fff | Above average day / stat |
| Average | 45–59 | Neutral desaturated teal/grey-blue | text-primary | Baseline performance |
| Below Avg | 30–44 | Muted amber (warning-color alpha -40%) | text-primary | Caution metrics |
| Poor | 0–29 | Desaturated red (danger-color alpha -50%) | #fff | Low percentile, weak performance days |
| Special Context | Playoff / Highlight | Border (focus-color / warning) around existing fill | Inherits | Calendar playoff day border, playoff game highlight |

Implementation: generate class set (`.pct-elite`, `.pct-excellent`, etc.) or algorithmically map numeric percentile to tier thresholds. Maintain unified mapping across pages.

### 23.8 Calendar Heatmap (Player Performance Calendar)
- Day cells: square aspect (1:1) with central numeric stat (games or composite), colored background per performance tier. Playoff games add a 1–2px outer border (focus-color) while preserving interior fill.
- Legends: horizontal row of labeled swatches in performance order left→right (Elite → Poor), include textual notes for playoff and missed game markers (missed maybe dark cell with icon or reduced opacity).
- Month grouping: 2–3 column layout of mini-month blocks; month header uses XS uppercase with letter spacing.

### 23.9 Radar Chart Styling
- Dark matte canvas (background-dark slightly lightened 2%) with low-opacity concentric polygon rings (1px lines, 10–15% white alpha).
- Active polygon stroke cyan with soft outer glow (blur 4–6px, 25% alpha). Data points (nodes) are small filled circles (2–4px) optionally brightened on hover.
- Percentile list right side: aligned rows with stat label left, value pill right (uses scale in 23.7). Maintain tabular-number alignment via `font-variant-numeric: tabular-nums`.

### 23.10 Game Grid Nuances
- Schedule cells encode difficulty via green→red neutral ramp (avoid using team success/danger semantics for confusion). Provide accessible alt text mapping for color-coded difficulty.
- Icons (back-to-back, goalie, travel) sit within cells center-aligned; multiple icons stacked horizontally with 2–4px gap; only show tooltips on hover / focus.
- Vertical team label column uses team color fill or left stripe; ensure text over color uses text-shadow for contrast if needed.
- Current day or selected range outlined with thin cyan border (1–2px) rather than full background fill to preserve readability.

### 23.11 Four Week Forecast Table
- Combines zebra strip + heat background layering: base row alt shading first, then cell-specific performance heat overlay with ~0.65 opacity; ensure overlay doesn't eliminate zebra affordance—slight difference still perceivable.
- Numeric cells right-aligned when comparative; left-aligned for labels.

### 23.12 BPA (Best Player Available) Table Enhancements
- Dense grid of percentile pills—ensure wrapping strategy (flex-wrap or grid) with consistent column min width; vertical compression relies on XXS font and 2px vertical padding.
- Row hover: mild lightness increase only (no glow) to prevent cognitive overload among many colored pills.
- Pagination controls use same compact toggle pattern as other filter bars.

### 23.13 Suggested Picks Row
- Player cards: horizontally scrollable (or compressed wrapping) with uniform width; gradient border accent (primary → secondary) plus subtle interior division lines for stat groups.
- Shimmer accent only cycles across one card at a time (selected or hovered primary candidate) to avoid motion saturation.
- Progress micro-bars (ownership, risk, or projection) overlaid near bottom inside card using 2–3px height bars with gradient fill.

### 23.14 Roster Composition Panel
- Center panel emphasis: thicker (2px) accent border + dual-shadow (outer dark drop + inner cyan glow at low opacity). Slot placeholders use dashed outlines until filled.
- Composition breakdown lists each role with minimalistic progress bar (background medium + accent fill width reflecting occupancy).

### 23.15 Micro Interaction Timings
- Hover elevate (translateY -2px) for interactive tiles/cards.
- Pulse loops limited concurrently: prefer a maximum of two active pulses (e.g., current pick + live status) site-wide.
- Shimmer frequency: min 2.5s cycle; never faster.

### 23.16 Edge Cases & Defensive Design
- Large data overflow (e.g., >100 percentile pills) should trigger vertical scroll in constrained panel with sticky header row and optional pill grouping (collapse + expand show more).
- Extremely long team names or player names ellipsize at max-width container; reveal full in tooltip on hover/focus.
- Colorblind support: add shape or border coding for playoff (border), missed (diagonal stripe overlay), and intense vs moderate performance (saturation + optional glyph) if enabling accessibility mode.

### 23.17 Recommended Class Additions (Forward Looking)
```scss
// Percentile tiers
.pct-elite{} .pct-excellent{} .pct-good{} .pct-average{} .pct-below{} .pct-poor{}
// Calendar modifiers
.calendar-day--playoff { outline: 2px solid $focus-color; }
.calendar-day--missed { background: repeating-linear-gradient(45deg, $background-dark, $background-dark 4px, $background-medium 4px, $background-medium 8px); opacity: 0.6; }
// Leader rank bars
.rank-tier-1 { --rank-accent: $warning-color; }
.rank-tier-2 { --rank-accent: color.adjust($text-secondary, $lightness: 10%); }
.rank-tier-3 { --rank-accent: $secondary-color; }
// Stripe utility (team header)
.team-stripe-band { position: relative; &::before,&::after{content:"";position:absolute;left:0;right:0;} &::before{top:0;height:6px;background:var(--team-secondary);} &::after{top:6px;height:3px;background:var(--team-accent);} }
```

### 23.18 Visual Consistency Checklist (Screens Validation)
Use this before merging new UI:
1. Panel frame style consistent (border + padding + header pattern).
2. No more than two simultaneous animated effects (pulse/shimmer).
3. Percentile / performance colors align with unified tier mapping.
4. Scrollable regions have custom scrollbar + sticky headers where applicable.
5. Team-themed areas only alter accents, not semantic success/danger mapping.
6. Micro badges maintain consistent radius + uppercase tracking.
7. Calendar / heatmaps include legend with accessible descriptors.
8. Roster / composition or pick states highlight with thicker accent border, not arbitrary color shifts.

---
End of FHFHockey.com Design System PRD (Interactive v1.1).
<!--
  FHFHockey.com Front-End Product Requirements & Design System Guide (v2.0)
  Canonical source for the "Vibrant Glassmorphism" analytics aesthetic across Draft Dashboard and Stats pages.
  Audience: Designers, engineers, and LLMs building new pages/components that must exactly match the production vibe.
-->

# FHFHockey.com Design System — Vibrant Glassmorphism (Canonical v2.0)

## 0) What to build and how to judge success

This guide is a contract for reproducing the Draft Dashboard and Stats pages look-and-feel exactly.

Success criteria:
- Dark, layered glass aesthetic with disciplined cyan energy accents
- Dense, readable analytics (tables, filters, charts) with consistent panel framing
- Team identity applied via CSS variables without breaking semantic colors
- Minimal glow, purposeful motion, accessible focus states
- Styles only from tokens/mixins in `styles/vars.scss` (no hardcoded hex)

Deliverables must pass: visual parity checklist, accessibility focus/keyboard rules, and token-only usage.

## 1) Tokens and imports (single source of truth)

All colors, spacing, radii, typography, shadows, transitions, and elevations come from `styles/vars.scss`.
Never hardcode hex values. Always import with a namespace.

SCSS module import pattern
```scss
@use "styles/vars" as v; // always use a namespace
```

Core token families (defined in vars.scss)
- Colors: `$primary-color`, `$secondary-color`, `$success-color`, `$warning-color`, `$danger-color`, `$info-color`, `$focus-color`
- Surfaces: `$background-dark`, `$background-medium`, `$background-light` (+ optional surface ramp like `$surface-0/1/2` if present)
- Text: `$text-primary`, `$text-secondary`, `$text-button`
- Borders: `$border-primary`, `$border-secondary`, `$border-accent`
- Typography: `$font-family-*`, `$font-size-*`
- Spacing: `$space-*`
- Radii: `$border-radius-*` (and `$radius-*` if provided)
- Shadows & transitions: `$box-shadow-panel`, `$shadow-hover`, `$transition-duration`, `$transition-easing`
- Breakpoints: `$breakpoint-mobile-max`, `$breakpoint-tablet`, `$breakpoint-desktop`
- Z-index helpers: e.g., `$z-desktop-sticky` (if present)

Mixins (defined in vars.scss)
- `@include v.glass-panel;` — glass surface + blur + subtle border/shadow
- `@include v.button-style;` — primary cyan button baseline
- `@include v.button-ghost($active: false);` — ghost/secondary button
- `@include v.table-base;` — dense table baseline (spacing, colors)
- `@include v.custom-scrollbar(color, track, size);`
- `@include v.focus-ring();` and device variants if provided
- Schedule/intensity helpers if present: `@include v.schedule-fill(color, alpha)`, `@include v.schedule-outline(color)`

Note: If a snippet below references a token name not shown in this summary (e.g., `$surface-1`, `$shadow-hover`), it exists in vars.scss. Do not inline values; use the token.

## 2) Visual language and rules

- Layering: dark base canvas → panel shell (glass/diffused) → content → accent overlays
- Glow: minimal, only for critical focus/active states (current pick, CTA shimmer, winner highlight)
- Density: small/xxs type for tables and controls; tight padding; clear rhythm via panel headers
- Team theming: team CSS variables control identity (stripes, badges), never semantics (success/danger)
- Motion: 150–300ms interactions; 2.5–3s shimmer; avoid continuous ambient animations
- Accessibility: visible focus rings; keyboardable filters/tabs; sticky headers for orientation

## 3) Typography and color semantics

- Headings: Train One (accent), uppercase, 0.05–0.12em tracking
- Body/labels: Roboto Condensed for scan-ability
- Numbers: Martian Mono where alignment matters (tables, logs)
- Semantic color usage:
  - Primary/Secondary cyan → action/active/selection
  - Success/Warning/Danger → outcomes only (not team identity)
  - Team colors via CSS vars → identity stripes, badges, logo glows

## 4) Layout archetypes (canonical)

- Draft Dashboard (three-panel workspace): grid 2fr 1fr 2fr on desktop; stacked on mobile; center (roster) highlighted
- Stats pages (index/player/team/game): stacked modular sections; shared panel shell + header strip + dense tables + charts/heatmaps

## 5) Canonical patterns and recipes

### 5.1 Panels and headers
```scss
@use "styles/vars" as v;

.panel { @include v.glass-panel; }

.panelHeader {
  display: flex; align-items: center; justify-content: space-between; gap: v.$space-md;
  padding: v.$space-md v.$space-lg;
  background: linear-gradient(135deg, v.$background-dark, color.adjust(v.$background-dark, $lightness: 4%));
  border-bottom: 2px solid v.$secondary-color;
}
.panelTitle { font-family: v.$font-family-accent; letter-spacing: .08em; text-transform: uppercase; font-size: v.$font-size-lg; margin: 0; }
.panelTitleAccent { color: v.$primary-color; }
```

### 5.2 Dense tables
```scss
.tableWrap { max-height: 70vh; overflow: auto; @include v.custom-scrollbar(v.$primary-color, v.$background-medium, 6px); }

.dataTable { @include v.table-base; background: v.$background-dark; border-radius: v.$border-radius-md; }
.dataTable thead th {
  position: sticky; top: 0; z-index: 1;
  background: v.$background-medium; color: v.$primary-color;
  font-size: v.$font-size-xxs; letter-spacing: .06em; text-transform: uppercase;
}
.dataTable tbody tr:hover { background: v.$background-light; }
```

### 5.3 Toggle groups and buttons
```scss
%toggleBase { @include v.button-style; background: transparent; border: 1px solid v.$border-secondary; color: v.$text-secondary; }
.toggleBar { display: flex; gap: v.$space-xs; flex-wrap: wrap; }
.toggleBtn { @extend %toggleBase; font-size: v.$font-size-xxs; }
.toggleBtn.active { background: v.$primary-color; color: v.$text-button; border-color: v.$primary-color; }
```

### 5.4 Scrollbars and focus
```scss
.scrollArea { @include v.custom-scrollbar(v.$primary-color, v.$background-medium, 8px); }
:focus-visible { @include v.focus-ring(); }
```

### 5.5 Intensity and progress
```scss
.intensity0 { background: color.adjust(v.$background-medium, $lightness: -3%); }
.intensity1 { @include v.schedule-fill(v.$success-color, .12); @include v.schedule-outline(v.$success-color); }
.intensity2 { @include v.schedule-fill(v.$success-color, .2);  @include v.schedule-outline(v.$success-color); }
.intensity3 { @include v.schedule-fill(v.$success-color, .3);  @include v.schedule-outline(v.$success-color); }
.intensity4 { background: v.$success-color; color: #000; }

.progressBar { height: 8px; border-radius: 999px; background: color.adjust(v.$background-dark, $lightness: 6%); overflow: hidden; }
.progressFill { height: 100%; background: linear-gradient(90deg, v.$primary-color, v.$secondary-color); transition: width .35s ease-in-out; }
```

### 5.6 Shimmer CTA (sparingly)
```scss
.ctaShimmer { position: relative; overflow: hidden; }
.ctaShimmer::after { content: ""; position: absolute; inset: 0; background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,.12) 20%, transparent 40%); transform: translateX(-120%); animation: shimmer 3s infinite ease-in-out; pointer-events: none; }
@keyframes shimmer { 0%{transform:translateX(-120%);} 60%,100%{transform:translateX(120%);} }
```

## 6) Dynamic team theming pattern

1) Apply a team class on the container or set CSS variables inline.
```scss
// team class approach (preferred)
.team-ABBR {
  --team-primary: <hex>;
  --team-secondary: <hex>;
  --team-jersey: <hex>;
  --team-accent: <hex>;
  --team-alt: <hex>;
}
```
2) Consume variables inside components only for identity accents.
```scss
.teamName { background: var(--team-accent); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.logoGlow { filter: drop-shadow(0 0 6px color-mix(in srgb, var(--team-secondary) 70%, #000)); }
```
Rule: Do not use team colors for success/warning/danger semantics.

## 7) Draft Dashboard style kit (production extract)

- Page shell: grid 2fr 1fr 2fr (desktop), stacked on mobile; gap uses `$space-lg`/`$space-md`
- Center panel accent: gradient surface + 2px primary border + soft outer glow
- Panel header: accent strip with uppercase Train One title and cyan span
- Projections table: sticky header, zebra rows, custom scrollbar; numeric columns use tabular-nums
- Suggested pick card: left neon stripe + ambient glow on hover; small lift
- Intensity grid: `.intensity0–4` ramp using success color; optional outline mixin
- Progress bars: gradient primary→secondary; width transitions 240–500ms

Minimal code
```scss
.dashboardShell { display: grid; gap: v.$space-lg; grid-template-columns: 2fr 1fr 2fr; }
.panelAccent { border: 2px solid v.$primary-color; box-shadow: 0 0 0 1px rgba(v.$primary-color,.35), 0 8px 28px -6px rgba(0,0,0,.6), 0 0 32px rgba(v.$primary-color,.15); }
.projectionsTable { @include v.table-base; }
```

## 8) Stats pages style kit (Index • Player • Team • Game)

Shared rules
- Use `@include v.component-wrapper;` for major sections and `@include v.element-wrapper;` for inner frames when available
- Tables extend `v.table-base` and use sticky headers; scroll containers use brand scrollbar
- Filters/toggles are compact, uppercase, keyboardable; active uses cyan fill
- Heat/Calendar uses primary ramp via opacity (0.3→0.9) — no glow

### 8.1 Stats Index (leaders, filters, teams grid)
- Hero: framed panel (background-medium, border primary)
- Quick stats: card with left accent (scoring/goaltending/league)
- Filters: `.filterBar` group with roving focus or arrow-key cycling
- Teams grid: tiles with light lift on hover; abbrev uses team secondary; subtle logo glow

### 8.2 Player page (overview • advanced • trends • calendar)
- Navigation header with back button (ghost) + search
- Player header: glass panel with photo, info, large accent name
- Tabs: compact uppercase; active cyan fill
- Overview grid: radar panel + insights panel; calendar panel framed with outline
- Tables: sticky headers; restrained hover; tabular-nums where needed
- Percentile pills: unified tier mapping (elite/good/average/below/poor)

### 8.3 Team page (header stripes • quick stats • table • shot viz)
- Header stripe band: gradient bands from team vars (primary→jersey→accent→secondary)
- Quick stats pills: color-mix team primary ~70% for bg and border; readable text color
- Team table: sticky headers, zebra, restrained hover emphasis (focus tint)
- Shot viz: split panel with framed control column and rink canvas panel

### 8.4 Game page (skeleton)
- Header: grid 1fr auto 1fr; identity badges for both teams
- Panels: two-column stats layout; tables reuse `v.table-base`

## 9) Accessibility rules (do not omit)

- Always provide visible focus (`:focus-visible`) with brand ring mixin
- Keyboard: arrow-key cycling for filter groups; ESC closes drawers; Enter/Space activate buttons
- Sticky headers for long tables; provide aria-sort on sortable headers
- Respect `prefers-reduced-motion`: disable shimmer/pulse loops

## 10) Acceptance criteria and parity checklists

A) Global parity
- Panel surfaces use glass/dark layering; consistent header pattern
- Cyan accents only for action/selection; team colors only for identity
- Custom scrollbar on all scroll containers; no native default
- Minimal glow limited to active/focus states

B) Tables
- Sticky thead; zebra rows via dark lightness steps
- Hover = lightness shift (no strong glow)
- Numeric columns aligned with tabular-nums

C) Filters/tabs
- Compact uppercase; active cyan fill; arrow-key accessible; focus-visible ring present

D) Heat/Intensity/Progress
- Intensity ramp via opacity steps; consistent success ramp
- Progress bars animate width (240–500ms), not color

## 11) LLM prompt template (copy/paste)

Use this verbatim when asking an LLM to build a new page/component.

```
You are implementing a new FHFHockey.com analytics feature called <Feature Name>.
Follow the FHFHockey Vibrant Glassmorphism system strictly:
- Import tokens/mixins with: @use "styles/vars" as v;
- Panels use glass-panel; headers use the canonical header pattern (uppercase Train One + cyan span)
- Tables extend v.table-base; sticky header; zebra rows; tabular numerals for numeric columns
- Filters/toggles are compact uppercase; active cyan fill; keyboard arrow navigation and focus-visible rings
- Use CSS team variables for identity accents; never for success/warning/danger semantics
- Heat/Intensity use opacity steps; progress bars animate width (240–500ms)
- Minimal glow (CTA shimmer or current state pulse only); respect prefers-reduced-motion
- No hardcoded hex; only tokens from vars.scss
Output: React + SCSS module referencing existing tokens/mixins (do not re-declare tokens).
```

## 12) Migration notes (clean up legacy SCSS)

- Replace hardcoded hex (e.g., `#07aae2`, `#343434`) with tokens
- Add `@use "styles/vars" as v;` to all SCSS modules
- Consolidate duplicate table styles behind `v.table-base` with local modifiers
- Apply `v.custom-scrollbar` and `v.focus-ring` consistently

## 13) Appendix — token cheat sheet (names only)

Colors: `$primary-color`, `$secondary-color`, `$success-color`, `$warning-color`, `$danger-color`, `$info-color`, `$focus-color`
Surfaces: `$background-dark`, `$background-medium`, `$background-light`, `$surface-0/1/2` (if present)
Text: `$text-primary`, `$text-secondary`, `$text-button`
Borders: `$border-primary`, `$border-secondary`, `$border-accent`
Typography: `$font-family-primary`, `$font-family-accent`, `$font-family-numbers`, `$font-size-xxs..xl`
Spacing: `$space-xs..xl`
Radii: `$border-radius-sm..lg` (and `$radius-*` if present)
Shadows/Transitions: `$box-shadow-panel`, `$shadow-hover`, `$transition-duration`, `$transition-easing`
Breakpoints: `$breakpoint-mobile-max`, `$breakpoint-tablet`, `$breakpoint-desktop`
Utilities/Mixins: `glass-panel`, `button-style`, `button-ghost`, `table-base`, `custom-scrollbar`, `focus-ring`, `schedule-fill`, `schedule-outline`

---
This v2.0 guide supersedes previous fragments. If a prior rule contradicts this document, this document wins.
## Component Recipes

Use the following recipes to construct standard UI elements.

### 1. Glass Panel Container

This is the base for all cards, panels, and non-modal containers.

**SCSS:**
```scss
.glass-panel {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  backdrop-filter: blur(12px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: $box-shadow-panel;
  border-radius: $border-radius-lg;
  padding: $space-md $space-lg;
}
```

### 2. Modal Container

Modals consist of a full-screen backdrop and a centered panel.

**SCSS:**
```scss
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-panel {
  // Apply the .glass-panel styles here
  width: min(1200px, 95vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: $space-md $space-lg;
  border-bottom: 2px solid $primary-color;
  font-family: $font-family-accent;
  font-size: $font-size-xl;
  color: $text-button;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

### 3. Data Table

For all tabular data, such as the `ProjectionsTable`.

**SCSS:**
```scss
.data-table {
  width: 100%;
  border-collapse: collapse;
  background-color: $background-dark;
  font-size: $font-size-sm;

  thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  th {
    background-color: color.adjust($background-dark, $lightness: -5%);
    color: $text-primary;
    padding: $space-sm $space-md;
    font-weight: 700;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid $border-secondary;
  }

  td {
    padding: $space-sm $space-md;
    color: $text-secondary;
    border-bottom: 1px solid $border-secondary;
  }

  tbody tr:nth-child(odd) {
    background-color: color.adjust($background-dark, $lightness: -2%);
  }

  tbody tr:hover {
    background-color: color.adjust($background-dark, $lightness: 2%);
  }
}
```

### 4. Dynamic Team Theming

This is a critical pattern for components related to a specific NHL team. It uses CSS variables to inject team colors into the component's styles.

**Implementation Steps:**

1.  **Define SCSS Map**: A map named `$teams` exists in the project, containing color definitions for each team.
2.  **Generate Utility Classes**: An `@each` loop in SCSS generates a class for each team (e.g., `.team-NJD`, `.team-NYR`).
3.  **Set CSS Variables**: Each class sets local CSS variables:
    ```css
    .team-NJD {
      --team-primary: #000000;
      --team-secondary: #a20620;
      --team-accent: #154734;
    }
    ```
4.  **Apply in Component**: The React component should accept a `teamAbbreviation` prop and apply the corresponding class to its root element (e.g., `<div className={\`player-card team-${teamAbbreviation}\`}>`).
5.  **Use Variables in SCSS**: Style the component using the CSS variables.
    ```scss
    .player-card {
      background: var(--team-primary);
      border: 1px solid var(--team-accent);

      .player-name {
        color: var(--team-accent);
      }
    }
    ```

## Your Task

Now, using the design system, principles, and recipes detailed above, please refactor the following page/component. Ensure all new styles are derived from the provided tokens and that the final result is a modern, data-rich interface consistent with the **Vibrant Glassmorphism** aesthetic.

**[ You would insert the specific redesign request here. For example: "Redesign the `PlayerStats` page to align with this design system. Replace the existing opaque containers with glass panels, update the data table to match the new style, and apply dynamic team theming to the header." ]**
