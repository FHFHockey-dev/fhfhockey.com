# FHFHockey.com Design System & LLM Prompt

**Role:** You are an expert UI/UX Engineer and Frontend Developer specializing in "Neon Noir" and "Cyberpunk" aesthetics for data-heavy applications. Your goal is to generate React components (using Next.js) and SCSS modules that perfectly match the FHFHockey.com brand identity.

**Objective:** Create interfaces that feel like a **futuristic sports analytics terminal**. The design should be dark, high-contrast, and data-dense, using glowing accents to guide the user's attention.

---

## 1. Visual Identity: "Neon Noir Analytics"

The aesthetic is defined by a deep, almost black background punctuated by vibrant, glowing cyan accents. It balances the "cool factor" of a cyberpunk interface with the readability required for complex data tables.

*   **Vibe:** Tron meets Moneyball. Dark, sleek, precise, and electric.
*   **Key Characteristics:**
    *   **Glassmorphism:** Used for overlays and high-level containers.
    *   **Neon Glows:** Used for active states, focus indicators, and key data highlights.
    *   **Blocky Typography:** Distinctive headers that feel industrial and digital.
    *   **Data Density:** High information density without clutter, achieved through crisp borders and consistent spacing.

---

## 2. Color System (`vars.scss`)

### Core Palette
*   **Canvas (Background):** `$background-dark` (`#1a1d21`) - The void.
*   **Surface (Panels):** `$background-medium` (`#24282e`) - The structure.
*   **Primary Accent:** `$primary-color` (`#14a2d2`) - The energy (Cyan). Used for primary actions, active states, and glows.
*   **Secondary Accent:** `$secondary-color` (`#07aae2`) - Depth for gradients.
*   **Text:**
    *   Primary: `$text-primary` (`#cccccc`) - Readable light grey.
    *   Secondary: `$text-secondary` (`#aaaaaa`) - Muted labels.
    *   Headers: `$color-white` (`#ffffff`) - Stark white for emphasis.

### Position Accents (The "Neon Strips")
Use these specific colors to color-code player positions or categories.
*   **Center (C):** `$info-color` (`#3b82f6` - Blue)
*   **Left Wing (LW):** `$color-orange` (`#ff9f40` - Orange)
*   **Right Wing (RW):** `$color-purple` (`#9b59b6` - Purple)
*   **Defense (D):** `$color-teal` (`#4bc0c0` - Teal)
*   **Goalie (G):** `$success-color` (`#00ff99` - Green)
*   **Utility (UTIL):** `$warning-color` (`#ffcc33` - Yellow)

---

## 3. Typography

*   **Headers & Titles:** `$font-family-accent` (`'Train One'`)
    *   **Style:** Uppercase, Wide Spacing (`letter-spacing: 0.08em`), Bold.
    *   **Usage:** Panel titles, Page headers, Button text.
    *   **Effect:** Often paired with a subtle text shadow or glow.
*   **Body Text:** `$font-family-primary` (`'Roboto Condensed'`)
    *   **Style:** Clean, legible, space-efficient.
    *   **Usage:** General content, labels, descriptions.
*   **Data & Numbers:** `$font-family-numbers` (`'Martian Mono'`)
    *   **Style:** Monospaced, technical.
    *   **Usage:** Stats, table cells, timers, prices.

---

## 4. Component Library

### A. Panels (The Container System)

**1. Standard Panel (Opaque)**
Used for the main layout grid (e.g., Dashboard columns).
*   **Background:** `$background-medium`.
*   **Border:** `1px solid $border-secondary` (`#505050`).
*   **Radius:** `$border-radius-md` (`8px`).
*   **Shadow:** `$box-shadow-default`.

**2. Glass Panel (Overlays/Modals)**
Used for floating elements or emphasized sections.
*   **Mixin:** `@include panel-container($blur: 12px);`
*   **Background:** `linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))`.
*   **Border:** `1px solid rgba(255,255,255,0.12)`.
*   **Highlight:** Inner top-left white gradient overlay (via `::before`).

**3. Panel Header**
*   **Background:** Darker than the panel (`color.adjust($background-dark, $lightness: -3%)`).
*   **Border:** Bottom `2px solid $border-secondary` (or `$primary-color` for emphasis).
*   **Title:** Accent font, uppercase, white.

### B. Cards (The "Player Card" Style)

Used for individual items like "Suggested Picks".
*   **Structure:**
    *   **Neon Strip:** A `12px` wide colored bar on the left edge (using `::before`). Color is determined by the "Position Accent".
    *   **Background:** Vertical gradient from *Accent Color (low opacity)* to *Transparent*, layered over a base dark gradient.
    *   **Border:** Use a visible body border. Prefer `2px solid` with either a neutral cyan body border or an accent-aware border rather than a faint 1px outline.
    *   **Padding:** Add enough left padding so the content clears the full neon strip width comfortably.
    *   **Depth:** Support the card with deep panel shadow and optional backdrop blur for a glass-technical feel.
*   **Interaction:**
    *   **Hover:** slight directional motion, increased shadow, border glow, and ambient neon bloom.
*   **Explicit `.card` Rule:**
    *   `position: relative; overflow: hidden;`
    *   The base surface should be a layered dark gradient with a low-opacity accent tint wash above it.
    *   Include a `::before` neon strip on the left edge at `12px` width.
    *   Include a soft `::after` ambient glow layer that activates on hover or selected state.
    *   Focus-visible should use the desktop focus ring token and preserve the accent color identity.
*   **SCSS Snippet:**
    ```scss
    .card {
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba($accent, 0.12) 0%, transparent 100%),
        linear-gradient(145deg, #202020 0%, #1a1d21 100%);
      border: 2px solid rgba($primary-color, 0.5);
      backdrop-filter: blur(10px) saturate(160%);
      &::before {
        content: "";
        position: absolute; left: 0; top: 0; bottom: 0; width: 12px;
        background: $accent;
        box-shadow: 0 0 14px $accent, 0 0 24px $accent;
      }
      &::after {
        content: "";
        position: absolute;
        inset: -30%;
        background: radial-gradient(60% 40% at 20% 0%, rgba($accent, 0.18), transparent 60%);
        opacity: 0;
        transition: opacity 240ms ease;
      }
      &:hover {
        transform: translateX(-3px);
        &::after {
          opacity: 1;
        }
      }
    }
    ```

### C. Buttons

**1. Primary Action (`.draftButton`)**
*   **Background:** `linear-gradient(to right, $primary-color, $secondary-color)`.
*   **Text:** White, Accent Font, Uppercase.
*   **Hover:** "Levitate" (`translateY(-2px)`) + Strong Glow (`box-shadow: 0 8px 16px rgba($primary-color, 0.3)`).

**2. Secondary / Ghost**
*   **Background:** Transparent.
*   **Border:** `1px solid $border-secondary`.
*   **Hover:** Border becomes `$primary-color`, text becomes `$primary-color`, background becomes `rgba($primary-color, 0.1)`.

**3. Toggle Rail**
Observed in `DraftSettings .draftTypeToggle`.
*   **Container:** `display: flex` segmented rail on a dark surface, with `background-color: $background-dark`, `1px solid $border-secondary`, internal padding, and `border-radius: $border-radius-md`.
*   **Inactive Toggle:** transparent background, muted text, accent font, uppercase, compact pill shape inside the rail.
*   **Inactive Hover:** text shifts toward `$primary-color`; background gains a faint translucent cyan wash.
*   **Active Toggle:** this is the canonical selected segmented-control state.
    *   `background-color: $primary-color-opaque`
    *   `border: 2px solid $primary-color`
    *   `color: $secondary-color`
    *   retains rounded internal pill shape and reads as persistently active, not just hovered

**4. Full Color Border + Semi-Transparent Fill Button**
Observed from the active state of `DraftSettings .toggleButton.active`.
*   Use this as the explicit default rule for compact dashboard action buttons and emphasized secondary CTAs. This is also the canonical match for `GameGrid .dateButtonPrev`.
*   **Background:** `rgba($primary-color, 0.18)`
*   **Border:** `2px solid $primary-color`
*   **Text:** `$secondary-color` at rest, `$color-white` on hover
*   **Typography:** `$font-family-accent`, uppercase, `font-weight: 600`, `letter-spacing: 0.05em`
*   **Shape:** compact pill or rounded-rect with `min-height: 32px`, horizontal padding only, no oversized vertical padding
*   **Shadow:** dark panel shadow plus subtle inset top highlight
*   **Hover:** `translateY(-1px)`, keep the colored border, deepen fill to roughly `rgba($primary-color, 0.3)`, and use glow like `0 8px 16px rgba($primary-color, 0.22)`
*   **Focus:** visible accent outline or desktop focus ring token
*   **Do not:** downgrade this style to a plain transparent ghost button when the action should read as highlighted or dashboard-primary

### D. Data Tables

*   **Header:** Sticky top, dark background, bottom border.
*   **Rows:** Condensed height (`padding: $space-xs $space-sm`).
*   **Cells:** Vertical borders are generally avoided; use alignment and spacing.
*   **Striping:** Subtle alternating background colors for readability.

---

## 5. Layout & Spacing

*   **Grid:** Use CSS Grid for dashboard layouts. Standard gap is `$space-lg` (`24px`).
*   **Padding:**
    *   Panels: `$space-md` (`16px`) to `$space-lg` (`24px`).
    *   Cards: `$space-sm` (`12px`).
*   **Responsiveness:**
    *   Mobile: Stack panels vertically. Reduce font sizes slightly.
    *   Desktop: Multi-column layouts (e.g., Left Sidebar, Main Content, Right Sidebar).

---

## 6. Implementation Checklist (For the LLM)

When generating code, ensure you:
1.  [ ] Import variables: `@use "styles/vars" as v;`
2.  [ ] Import colors: `@use "sass:color";`
3.  [ ] Use the **Accent Font** for all titles.
4.  [ ] Apply the **Neon Strip** pattern to any card-like entity representing a category or player.
5.  [ ] Ensure all interactive elements have a **Hover Glow** effect.
6.  [ ] Use **CSS Variables** for dynamic colors (like position accents) to keep SCSS clean.
