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
@keyframes shimmer { 0%{transform:translateX(-120%);}60%,100%{transform:translateX(120%);} }
```

### 19.7 Pulse Indicator
```scss
@keyframes pulse-glow { 0%,100% { box-shadow: 0 0 10px rgba($success-color,0.5);} 50% { box-shadow: 0 0 20px rgba($success-color,0.8);} }
```

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
