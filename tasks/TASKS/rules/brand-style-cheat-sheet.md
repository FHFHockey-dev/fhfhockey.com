# FHFHockey.com Brand Style Cheat Sheet
*Derived from Draft Dashboard Analysis & Design System*

## 1. Core Philosophy: "Neon Noir Analytics"
The design language is a futuristic sports analytics terminal. It combines the darkness of a command-line interface with the vibrancy of neon signage.
*   **Vibe:** Tron meets Moneyball.
*   **Key Elements:** Deep dark backgrounds, high-contrast neon accents (Cyan/Blue/Green), glassmorphism, and blocky, industrial typography.

---

## 2. Color Palette (`vars.scss`)

### Backgrounds
*   **Void (Canvas):** `$background-dark` (`#1a1d21`) - Main page background.
*   **Structure (Panels):** `$background-medium` (`#24282e`) - Cards and containers.
*   **Panel Header:** `color.adjust($background-dark, $lightness: -3%)` - Slightly darker than the void.

### Accents (The "Neon" Glows)
*   **Primary (Cyan):** `$primary-color` (`#14a2d2`) - Main actions, active states, borders.
*   **Secondary (Blue):** `$secondary-color` (`#07aae2`) - Gradients and depth.
*   **Info (Deep Blue):** `$info-color` (`#3b82f6`) - Center position.
*   **Success (Green):** `$success-color` (`#00ff99`) - Goalie position, positive stats.
*   **Warning (Yellow):** `$warning-color` (`#ffcc33`) - Utility position, alerts.
*   **Danger (Orange/Red):** `$color-orange` (`#ff9f40`) - Left Wing position.
*   **Purple:** `$color-purple` (`#9b59b6`) - Right Wing position.
*   **Teal:** `$color-teal` (`#4bc0c0`) - Defense position.

### Text
*   **Headers:** `$color-white` (`#ffffff`) - High emphasis.
*   **Body:** `$text-primary` (`#cccccc`) - Standard readability.
*   **Muted:** `$text-secondary` (`#aaaaaa`) - Labels, secondary info.

---

## 3. Typography

### Headers: "The Industrial Look"
*   **Font:** `$font-family-accent` ('Train One' / Display)
*   **Style:** Uppercase, Bold (900), Wide Spacing (`0.08em` - `0.25em`).
*   **Usage:** Page titles, Panel headers, Button text.
*   **Effect:** Often paired with `text-shadow` or neon color.

### Body: "The Data Terminal"
*   **Font:** `$font-family-primary` ('Roboto Condensed')
*   **Style:** Clean, space-efficient.
*   **Usage:** General text, labels, table headers.

### Data: "The Monospace"
*   **Font:** `$font-family-numbers` ('Martian Mono')
*   **Style:** Monospaced, technical.
*   **Usage:** Statistics, table cells, timers.

---

## 4. UI Components & SCSS Patterns

### A. The "Glass Panel" (Container)
Used for high-level containers and overlays.
```scss
.glassPanel {
  // Base
  background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: $border-radius-lg;
  
  // Effect
  backdrop-filter: blur(12px);
  box-shadow: $box-shadow-default;
  
  // Inner Highlight (Optional)
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, rgba(255,255,255,0.1) 0%, transparent 40%);
    pointer-events: none;
  }
}
```

### B. The "Neon Strip" Card (Player/Item)
The signature card style for the dashboard.
```scss
.neonCard {
  position: relative;
  overflow: hidden;
  
  // Dynamic Accent Variable (Set this inline or via class)
  --accent: #{$primary-color}; 
  
  // Background
  background: linear-gradient(180deg, rgba(var(--accent), 0.12) 0%, transparent 100%),
              linear-gradient(145deg, #202020 0%, #1a1d21 100%);
              
  // Border & Glow
  border: 1px solid rgba(var(--accent), 0.3);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  
  // The Neon Strip
  &::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 12px; // $neon-strip-width
    background: var(--accent);
    box-shadow: 0 0 14px var(--accent);
  }
  
  // Hover Effect
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(var(--accent), 0.25);
    border-color: var(--accent);
  }
}
```

### C. Buttons

**1. Primary Action (`.draftButton`)**
*   **Background:** `linear-gradient(to right, $primary-color, $secondary-color)`
*   **Text:** White, Uppercase, Accent Font.
*   **Hover:** Levitate (`translateY(-2px)`) + Glow.

**2. Ghost / Toggle Button**
*   **Background:** Transparent or `$background-dark`.
*   **Border:** `1px solid $border-secondary`.
*   **Text:** `$text-secondary`.
*   **Active/Hover:** Border becomes `$primary-color`, Text becomes `$primary-color` or White.

### D. Form Controls

**1. Select / Input**
*   **Background:** `$background-dark`.
*   **Border:** `1px solid $border-secondary`.
*   **Focus:** Border `$primary-color`, Box-shadow `0 0 0 2px rgba($primary-color, 0.2)`.

**2. Custom Checkbox**
*   **Appearance:** `none`.
*   **Size:** `18px`.
*   **Style:** Dark background, border.
*   **Checked:** Background `$primary-color`, custom checkmark (pseudo-element).

---

## 5. Layout Patterns

### The "Dashboard Grid"
A 3-column layout is standard for desktop.
*   **Columns:** `2fr 1fr 2fr` (Left | Center | Right).
*   **Gap:** `$space-lg` (24px).
*   **Mobile:** Stacks vertically (`1fr`).

### The "Control Bar"
A condensed header for panels containing filters and actions.
*   **Background:** Darker than panel (`lightness: -2%`).
*   **Border:** Bottom `2px solid $border-secondary`.
*   **Layout:** Flexbox, `align-items: center`, `gap: $space-sm`.

---

## 6. Implementation Checklist
1.  **Imports:** Always `@use "styles/vars" as v;` and `@use "sass:color";`.
2.  **Variables:** Use CSS variables (`--accent`) for dynamic colors to keep SCSS clean.
3.  **Glows:** Don't just change color on hover; add a `box-shadow` glow.
4.  **Spacing:** Use `v.$space-md` (16px) as the standard unit.
5.  **Borders:** Use `v.$border-secondary` for structural borders, `$primary-color` for active borders.
