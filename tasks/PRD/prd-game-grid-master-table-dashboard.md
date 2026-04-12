# PRD: Game Grid Master Table Dashboard Refactor

## 1. Introduction / Overview

Redesign the Game Grid page into a more elegant, modern, dark dashboard with a single unified desktop table that combines the current Opponent Metrics Table (OMT), Game Grid (GG), and Four Week Grid (4WG) into one master table.

The current page is split across separate rails and separate table systems. That creates unnecessary eye travel, duplicated team identity columns, repeated styling logic, and a layout that feels heavier than it needs to. The goal of this project is to unify the experience on desktop, preserve existing calculations and behavior, and roll out the redesign in small, reviewable increments so visual and behavior changes can be approved step by step.

This PRD also covers a lighter visual refresh for the Player Pickup Table after the Game Grid redesign is stable.

## 2. Goals

1. Build a unified desktop master table that combines OMT, GG, and 4WG into a single table structure.
2. Redesign the page shell and `dashboardHeader` to match the intended dark, modern dashboard aesthetic shown in the provided screenshot.
3. Preserve all existing data sources, schedule logic, score calculations, and behavior unless explicitly approved otherwise.
4. Keep team logos and existing icons, while removing redundant repeated team logo columns across the current separate table sections.
5. Support column sorting in the final desktop table, with default sort remaining alphabetical by team.
6. Keep day columns (`Mon` through `Sun`) non-sortable.
7. Add a grouped expand/collapse control for the 4WG column set on desktop.
8. Maintain a safer transitional mobile/tablet experience with separate collapsible tables rather than forcing the unified master table onto smaller breakpoints immediately.
9. Refresh the Player Pickup Table styling after the Game Grid redesign so the full page reads as one coherent UI.
10. Deliver the work in small implementation phases with explicit review checkpoints between phases.

## 3. User Stories

1. As a fantasy hockey manager, I want to compare opponent quality, weekly schedule, and four-week schedule outlook in one row so I can make faster roster decisions.
2. As a daily user of the Game Grid, I want the desktop view to feel cleaner and more modern without changing how scores and schedule data are calculated.
3. As a user scanning many teams quickly, I want alternating rows, subtle separators, and restrained highlight colors so the table remains dense but readable.
4. As a user evaluating schedule value, I want the score signal to stand out with subtle top-10 and bottom-10 highlighting so I can identify the best and worst weekly situations at a glance.
5. As a user who relies on logos and icons for fast recognition, I want them retained in the redesigned table.
6. As a mobile or tablet user, I want the page to remain usable during the refactor, even if the unified master table is initially desktop-only.
7. As the product owner, I want the redesign broken into small phases so I can review the direction early and change course without unwinding a large refactor.

## 4. Functional Requirements

1. The system must redesign the Game Grid page shell and `dashboardHeader` to align with the provided visual direction: dark canvas, lighter table surface, modern dashboard framing, and restrained accent usage.
2. The system must create a unified master table for desktop that replaces the current three-panel desktop layout of OMT, GG, and 4WG.
3. The unified desktop table must order columns as follows:
   OMT metrics first, then a single team logo / identity column, then the day columns (`Mon` through `Sun`), then current-week summary columns, then the 4WG columns.
4. The OMT metric block in the unified desktop table must include:
   `xGF`, `xGA`, `GF`, `GA`, `SF`, `SA`, and `W%`.
5. The unified desktop table must contain only one team identity column for each row rather than repeating team logo columns across separate table sections.
6. The unified desktop table must retain the current day columns for the game grid section and continue to show schedule state, logos, and icons as applicable.
7. The current-week summary block in the unified desktop table must include `GP`, `OFF`, and `Score`.
8. The 4WG block must be placed to the right of the current-week summary block and must include the existing four-week metrics currently shown by the 4WG feature.
9. The 4WG block must support a grouped expand/collapse interaction controlled by a visible grouped marker and arrow-style affordance positioned at the boundary immediately after the current-week summary block. The exact icon treatment can be refined during design implementation, but it must clearly communicate collapsing and expanding the 4WG column group.
10. The final unified desktop table must default to alphabetical sort by team.
11. The final unified desktop table must allow users to sort by clickable non-day columns.
12. The day columns (`Mon` through `Sun`) must remain non-sortable.
13. The redesigned table must use alternating row backgrounds to improve scanability.
14. The redesigned table must use subtle column separators rather than heavy grid lines.
15. The redesigned table must use subtle green and red highlighting for top-10 and bottom-10 teams by score.
16. The redesign must retain team logos and existing icons that are currently important to schedule comprehension.
17. On desktop, the left-side OMT information must remain persistently visible as part of the unified master table experience, including during horizontal scanning of the wider table where technically feasible.
18. The redesign must keep current score calculations, schedule calculations, sorting semantics, and data sources unchanged unless explicitly approved otherwise.
19. The page must continue to work while the refactor is underway, which means intermediate phases must avoid breaking the current page behavior.
20. On mobile and tablet, the system must keep separate collapsible tables during this project rather than forcing the desktop master-table architecture onto smaller breakpoints.
21. The mobile/tablet version must still receive the new visual styling so it feels consistent with the new dashboard direction.
22. The Player Pickup Table must receive a visual refresh in a later phase so it matches the updated page shell and table styling.
23. Button and toggle styling used by the page must follow the required button/toggle rules defined in `fhfh-styles.md`.
24. The redesign must use existing shared style variables and mixins from `web/styles/vars.scss` and `web/styles/_panel.scss` wherever possible.

## 5. Non-Goals (Out of Scope)

1. Reworking score formulas, schedule formulas, ranking logic, or opponent-metric calculations.
2. Changing Supabase queries or replacing current data sources unless required for a purely presentational merge of already available data.
3. Delivering a full mobile/tablet unified master table in this project.
4. Replacing existing logos, icons, or team identity patterns with a new asset system.
5. Rebuilding the Player Pickup Table logic, filters, or ranking model.
6. Introducing a new styling framework or abandoning SCSS modules.
7. Solving every historical CSS inconsistency in the Game Grid codebase if it is not necessary for the phased redesign.

## 6. Design Considerations

### Visual Direction

- The screenshot is the primary visual authority for the redesign.
- The page should feel like an elegant sports analytics dashboard with a dark background, lighter table surface, compact density, and crisp information hierarchy.
- The look should remain restrained rather than flashy: glow and accent color should guide attention, not dominate the UI.

### Required Aesthetic Traits

- Dark page background with a lighter table body.
- Alternating row colors.
- Subtle separators between logical column groups.
- Sticky or persistently visible left-side summary context where feasible.
- Logos and icons retained.
- Compact but readable typography for dense table content.

### Style System Guidance

- Reuse variables and shared patterns from `web/styles/vars.scss` and `web/styles/_panel.scss`.
- Follow `fhfh-styles.md` loosely for the broader feel.
- The rules in `fhfh-styles.md` that must be followed are the button and toggle styling rules.
- New tokens should only be introduced if the existing token set is insufficient.

### Header Direction

- Redesign the `dashboardHeader`.
- Standardize sticky header behavior and table-header typography across the page.
- Keep the header aligned with the new dashboard shell rather than treating it as a disconnected control bar.

## 7. Technical Considerations

### In-Scope Files

- `web/components/GameGrid/GameGrid.tsx`
- `web/pages/game-grid/index.tsx`
- `web/components/GameGrid/utils/FourWeekGrid.tsx`
- `web/components/GameGrid/OpponentMetricsTable.tsx`
- `web/components/GameGrid/GameGrid.module.scss`
- `web/components/GameGrid/OpponentMetricsTable.module.scss`
- `web/components/GameGrid/utils/FourWeekGrid.module.scss`
- `web/components/PlayerPickupTable/PlayerPickupTable.tsx`
- `web/components/PlayerPickupTable/PlayerPickupTable.module.scss`

### Current Implementation Constraints

- The current page is composed of separate table systems with separate sorting, layout framing, and mobile minimize behavior.
- The unified master table should not require score or schedule logic changes.
- The refactor should prefer data consolidation and presentational composition over business-logic rewrites.
- Existing row calculations should be reused wherever possible.
- The page should remain functional between phases; avoid a long-lived broken intermediate state.

### Incremental Rollout Plan

#### Phase 1: Dashboard Shell and Header Refresh

Goal:
Create the new page shell, background treatment, header framing, and shared table visual language without yet merging all table content.

Includes:

- Redesign `dashboardHeader`.
- Establish updated background, panel framing, alternating row treatment, separators, and sticky header styling.
- Normalize button and toggle appearance to match the required style rules.
- Apply the new aesthetic to the existing layout first so the visual direction can be reviewed before structural unification.

Exit Criteria:

- The page visually moves toward the screenshot direction.
- Existing data behavior remains unchanged.
- Header and control styling are consistent enough for visual review.

#### Phase 2: Unified Desktop Master Table Scaffold

Goal:
Introduce the desktop master-table structure and column groups without changing underlying calculations.

Includes:

- Build a new unified desktop table shell.
- Arrange columns in the agreed order.
- Retain only one team identity column.
- Ensure desktop sorting behavior is wired for the columns that should remain sortable.
- Keep day columns non-sortable.

Exit Criteria:

- Desktop uses one master table structure.
- Existing content is represented in the new layout.
- No business-logic regressions are introduced.

#### Phase 3: Merge OMT, GG, and 4WG Data Presentation

Goal:
Fully populate the unified desktop table with OMT, weekly grid, current-week summary, and 4WG data while preserving calculations.

Includes:

- Merge presentational rendering for all three desktop sections into one row model.
- Add the grouped 4WG collapse/expand affordance.
- Preserve logos and schedule icons.
- Add subtle score-based top-10 and bottom-10 highlighting.

Exit Criteria:

- Desktop no longer depends on separate rails for OMT and 4WG.
- The unified table is functionally complete.
- Score highlighting and grouped 4WG controls work as intended.

#### Phase 4: Polish, Mobile/Tablet Visual Alignment, and Player Pickup Table Refresh

Goal:
Clean up the page and make the remaining sections visually coherent without expanding project scope into a full mobile unified-table rebuild.

Includes:

- Apply the final shared visual language to the separate mobile/tablet collapsible tables.
- Refine spacing, separators, sticky behaviors, and hover states.
- Refresh the Player Pickup Table styling so it matches the redesigned Game Grid page.

Exit Criteria:

- Desktop and smaller breakpoints feel like one product family.
- Player Pickup Table styling no longer feels visually disconnected from the Game Grid.
- The page is ready for final QA.

### Review Checkpoints

Each phase should stop for review before moving to the next phase. The implementation should not proceed as a single uninterrupted refactor across all phases.

## 8. Success Metrics

1. The desktop page successfully replaces the three-table rail layout with one master table.
2. Existing schedule, score, and opponent-metric behavior remains unchanged after the redesign.
3. The final desktop table defaults to alphabetical team sorting and supports sorting on intended non-day columns.
4. The 4WG grouped collapse interaction works without breaking the rest of the table layout.
5. The updated page matches the intended dashboard feel closely enough that no major second-pass visual reset is required.
6. Mobile and tablet remain usable throughout the rollout with separate collapsible sections.
7. The Player Pickup Table visually matches the updated page shell by the end of the project.
8. QA does not identify regressions in score display, schedule display, or team-row identity.

## 9. Open Questions

1. Should the 4WG group be expanded or collapsed by default on desktop?
2. Which specific columns from the current four-week implementation should be visible in the default expanded state if future trimming becomes necessary?
3. Which left-side columns should remain sticky during horizontal scroll on desktop if making the entire OMT block sticky is too heavy for the layout?
4. Should score-based top-10 and bottom-10 highlighting apply only to the `Score` column, or should it also influence the full row treatment?
5. Is a temporary feature flag or route-level toggle desired during Phase 2 and Phase 3, or should the new desktop table replace the old layout directly once each phase is approved?
