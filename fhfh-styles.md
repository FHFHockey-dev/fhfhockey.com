# Prompt for FHFHockey.com Page Redesign

## Objective

You are to redesign a web page or component to align with the FHFHockey.com **Vibrant Glassmorphism** design system. This system is used for data-intensive sports analytics dashboards and prioritizes a futuristic, glowing aesthetic while maintaining clarity and information density.

Your primary goal is to use the provided design tokens and component recipes to create a visually consistent, high-quality user interface. Adherence to the established patterns is critical.

## Core Design Principles

1.  **Vibrancy & Glow**: Use bright, saturated accent colors (especially the primary cyan) against a very dark background. Key interactive or important elements should feature a "neon glow" effect.
2.  **Glassmorphism**: All primary UI panels, cards, and modals must simulate frosted glass. This is achieved with `backdrop-filter: blur()`, semi-transparent `background` gradients, and thin, light-colored `border`s.
3.  **Information Density**: The UI must efficiently present large amounts of data. Employ compact layouts, small font sizes for data, and clean tables. Use `font-family: Martian Mono` for all tabular numerical data to ensure alignment.
4.  **Dynamic Theming**: Where applicable (e.g., for player or team-specific components), the UI must dynamically adapt its color scheme to match NHL team colors. This is a critical feature of the design system.

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
