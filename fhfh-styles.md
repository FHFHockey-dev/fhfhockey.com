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
*   **Interaction:**
    *   **Hover:** `transform: translateY(-2px)`, increased shadow, border glow.
*   **SCSS Snippet:**
    ```scss
    .card {
      position: relative;
      background: linear-gradient(180deg, rgba($accent, 0.12) 0%, transparent 100%),
                  linear-gradient(145deg, #202020 0%, #1a1d21 100%);
      border: 1px solid rgba($accent, 0.3);
      &::before {
        content: "";
        position: absolute; left: 0; top: 0; bottom: 0; width: 12px;
        background: $accent;
        box-shadow: 0 0 14px $accent; // The Neon Glow
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
