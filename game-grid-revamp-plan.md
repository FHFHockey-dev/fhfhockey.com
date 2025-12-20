# Game Grid Revamp Plan (Condensed Standard Grid)

## Status (Updated)

**Implemented so far**
*   **3-column “cockpit” layout**: Left rail (OMT) + center (GG) + right rail (4WG), with BPA below.
*   **Full-width container option**: Added `contentVariant="full"` to `Container` and applied to the Game Grid page to allow true edge-to-edge layout and sticky rails.
*   **Sticky side rails**: Desktop rails are sticky and height-bounded to the viewport for “sidebar” behavior.
*   **Sidebar table parity pass**:
    *   Added `AVG` row to OMT.
    *   Made OMT columns sortable (Team + metrics) to match 4WG behavior.
    *   Unified table micro-styling (row height, padding, borders, sticky headers, scroll wrappers).
*   **Rank shading**: Top-10/bottom-10 per column shading for both OMT and 4WG (strongest intensity for rank #1).
*   **4WG header gradient**: Reversed header gradient direction (override via `background-image` after `panel-title` mixin).
*   **Controls bar revamp**: Game Grid header controls updated to match DraftSettings patterns (segmented toggle styling, cleaner layout, tightened spacing).
*   **Week badge notch**: Converted the Week badge from a “tab” to a **concave notch** carved out of the top of the header (clip-path + glow).
*   **Cell visual upgrades**:
    *   **First column**: Team abbreviation typography updated (`Tomorrow`, italic, larger), logo moved right and treated as an oversized “behind the border” visual with gradient fade.
    *   **Matchup cells**: Logo overflow + mask behavior updated; H/A icon moved to the opposite side with its own neon badge.
*   **Fonts**: Added Google Font `Tomorrow` to `web/pages/_document.tsx`.
*   **Rendering fixes**: Switched `TeamRow.tsx` from `next/legacy/image` to `next/image` with positioned wrappers to prevent CSS transform clipping/truncation.

**Known constraints / notes**
*   Some builds can fail due to external network fetches during prerender (example: blog/Apollo fetch timeouts). Consider adding resilience (fallback, caching, or skipping prerender for network-bound pages).

## 1. Analysis of Current State

The user wants to revamp the **Standard Game Grid** (where Teams are listed vertically as rows). The goal is to reduce the vertical scrolling required by condensing the row height and utilizing the full page width to place supporting components side-by-side.

**Current Layout Issues:**
*   The standard grid rows are tall (~55px), making the table very long (32 teams).
*   Supporting components (OMT, 4WG) are stacked below, adding to the length.
*   Unused horizontal space on large screens.

## 2. Proposed Layout: "The Condensed Cockpit"

The layout will feature a **3-Column Design** spanning the full width of the page.

### ASCII Mockup (Desktop)

```
+-----------------------------------------------------------------------+
|  [ Header & Controls (Date Nav, Toggles, Legend) ]                    |
+-----------------------------------------------------------------------+
|          |                                              |             |
| [ LEFT ] |              [ MAIN GAME GRID ]              |  [ RIGHT ]  |
|  RAIL    |           (Standard View - Condensed)        |    RAIL     |
|          |                                              |             |
|  (OMT)   |   [Team] [M] [T] [W] [T] [F] [S] [S] [Tot]   |   (4WG)     |
|          |   [ANA ] [ ] [@] [ ] [v] [ ] [@] [ ] [ 3 ]   |             |
| Opponent |   [BOS ] [v] [ ] [ ] [@] [ ] [ ] [v] [ 4 ]   |  Four Week  |
| Metrics  |   [BUF ] [ ] [@] [v] [ ] [ ] [@] [ ] [ 3 ]   |  Summary    |
|          |    ... (32 Rows, ~30px height) ...           |             |
|          |                                              |             |
+-----------------------------------------------------------------------+
|                                                                       |
|                    [ PLAYER PICKUP TABLE (BPA) ]                      |
|                                                                       |
|  (Full Width Table - Sortable, Filterable)                            |
|                                                                       |
+-----------------------------------------------------------------------+
```

### Layout Details

*   **Container**: Full width (`width: 100%`).
    *   **Left Rail**: `OpponentMetricsTable` (OMT).
    *   **Center**: `GameGrid` (Standard View: Teams as Rows).
    *   **Right Rail**: `FourWeekGrid` (4WG).
*   **Bottom**: `PlayerPickupTable` (BPA).

## 3. The "Condensed" Grid

We will implement a **Condensed Mode** for the Standard Grid.

*   **Row Height**: Reduced to **~30px** (from ~55px).
*   **Visuals**:
    *   **Team Logos**: Logos will be sized to fit or slightly overflow the small cells.
    *   **Styling**: "Hidden behind the overflow, positioned to the side" — Logos will be partially tucked or cropped to fit the 30px height while remaining identifiable.
    *   **Text**: Font sizes reduced slightly.
*   **Toggle**: Option to switch between Condensed and Standard views (Default: Condensed).

## 4. Implementation Steps

### Step 1: Layout Restructuring (`GameGrid.tsx`)
*   Remove `max-width` constraints.
*   Create the 3-column grid structure.
*   Place OMT, GameGrid, and 4WG into their respective columns.

### Step 2: CSS / SCSS Updates (`GameGrid.module.scss`)
*   **Condensed Class**: Create `.condensed` styles for `TeamRow` and `Header`.
    *   Set `height: 30px`.
    *   Adjust padding and font sizes.
    *   **Logo Overflow**: Implement specific CSS to handle the logo positioning within the condensed `matchupCell`.
*   **Sidebars**: Style OMT and 4WG to fit the side rails (likely hiding some columns or using a compact version).

### Step 3: Component Logic
*   Add `isCondensed` state (default `true`).
*   Pass `isCondensed` prop to `TeamRow` and `Header`.

## 7. Next Steps / Enhancements

**Visual polish**
1.  **Week notch border/edge polish**: Add a crisp outline that follows the notch geometry (likely via a pseudo-element using the same clip-path).
2.  **Matchup icon asset**: Consider replacing raster home/away icons with an SVG glyph to guarantee consistent fill opacity and sharpness at all scales.
3.  **Matchup cell “behind border” effect**: Fine-tune overflow inset so logos feel tucked behind the inner border without appearing “cropped”.

**UX**
1.  **Keyboard affordances**: Ensure all header controls have consistent focus rings and `aria-label`s.
2.  **Sticky behavior**: Confirm rails + center scroll behavior is ideal (option: center grid scroll independent while rails remain fully static).

**Data**
1.  **OMT/4WG metrics alignment**: Optional: align columns or abbreviations where useful (and add tooltips for dense labels).

## 5. Questions / Decisions

1.  **Sidebar Content**: We will need to ensure OMT and 4WG look good in narrower columns.
2.  **Mobile**: Mobile layout remains stacked.

## 6. Aesthetic & Brand Alignment ("Neon Noir")

To align with the **FHFHockey Design System** (`fhfh-styles.md`), we will inject the "Tron meets Moneyball" vibe into this high-density dashboard.

### Visual Style: "The Analytics Terminal"
*   **Global Vibe**: Dark, sleek, and precise. The grid should feel like a tactical display.
*   **Typography**:
    *   **Headers**: Use `'Train One'` (uppercase, wide spacing) for the main "GAME GRID" title and sidebar headers ("OPPONENT METRICS", "4-WEEK FORECAST").
    *   **Data**: Use `'Martian Mono'` for the grid numbers (games played, off-nights) to emphasize the technical nature.
    *   **Body**: `'Roboto Condensed'` for team names and general text.

### Component Styling
*   **Glassmorphism**: Apply the `glass-panel` mixin to the three main containers (OMT, Grid, 4WG) to give them depth against the void background (`#1a1d21`).
*   **Neon Accents**:
    *   **Active Column**: The current day's column in the grid should have a subtle vertical **Cyan Glow** (`$primary-color`) to act as a "cursor".
    *   **Off-Nights**: Use the **Green Neon** (`$success-color`) for off-night indicators, making them pop against the dark grid.
    *   **Heavy Nights**: Use **Red/Orange** (`$warning-color` or custom red) for heavy nights.
*   **Condensed Cells**:
    *   **Hover State**: When hovering a matchup cell, apply a `box-shadow` glow and a slight `transform: scale(1.1)` (z-index boosted) to make the data "lift" off the screen.
    *   **Team Logos**: In the condensed 30px row, the logos will be partially obscured/cropped. We can add a subtle **inner shadow** or **gradient overlay** to integrate them into the dark theme, preventing them from looking like "stickers" on top of the UI.

### "The Cockpit" Feel
*   **Borders**: Use crisp, thin borders (`1px solid $border-secondary`) with slightly rounded corners (`$border-radius-md`) for the main panels.
*   **Scrollbars**: Custom thin scrollbars in Cyan or Dark Grey to match the theme, avoiding default browser bars.
