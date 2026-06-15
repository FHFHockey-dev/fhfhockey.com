# Player Stats Landing Audit

## Scope

This note captures the rendered audit for `/underlying-stats/playerStats` as part of task `5.4`.

Rendered page reviewed:

- Route: `/underlying-stats/playerStats`
- Local verification: `http://localhost:3002/underlying-stats/playerStats`
- Current page identity: `Player Underlying Stats`

Important clarification:

- This route is styled by `web/pages/underlying-stats/playerStats/playerStats.module.scss`.
- It does not use `web/pages/underlying-stats/indexUS.module.scss`.
- Any production restyle for this page must therefore target the local `playerStats.module.scss` surface and only reuse shared tokens/mixins from the common style layer.

## Current Section Map

### 1. Hero Shell

Current implementation:

- breadcrumb row
- eyebrow label
- large hero title
- explanatory copy
- two metadata cards to the right

Canonical mapping:

- should resolve to the `data-page shell` archetype
- not to a marketing hero or dashboard-intense hero

Assessment:

- the information hierarchy is correct
- the shell is too tall and too decorative for a table-first player data page
- the radial background and gradient layering make the page feel more promotional than operational
- the metadata cards are useful, but they currently read like hero accessories instead of compact context modules

Recommendation for restyle:

- preserve breadcrumb, title, and a small amount of explanatory copy
- compress the hero into a tighter page header
- keep the metadata cards, but restyle them as calmer support modules inside the header band

### 2. Primary Controls Section Header

Current implementation:

- a titled section introducing the filter surface
- long explanatory copy
- right-aligned chip summary of the active state

Canonical mapping:

- section header for a table-heavy data page
- compact context row above a dominant filter-and-table surface

Assessment:

- the section split is correct
- the explanatory paragraph is too long for a production data page
- the chip row is useful and should remain, but it should behave as compact metadata rather than visual ornament

Recommendation for restyle:

- shorten the copy substantially
- keep the chip row as a compact active-state summary
- tighten the spacing between the section header, the filters, and the table state messaging

### 3. State Banner

Current implementation:

- in-panel banner used for loading, warning, error, stale-data, and empty-table states

Canonical mapping:

- in-section state treatment directly above the table controls

Assessment:

- structurally correct
- the current banner system is reusable
- the visual treatment should be normalized to the calmer state-banner rules already being established elsewhere

Recommendation for restyle:

- keep the banner in this location
- align borders, fills, and typography to the shared state-banner system
- keep reset actions compact and secondary

### 4. Filter Surface

Current implementation:

- canonical `PlayerStatsFilters` component renders beneath the header and state banner
- dense filter bar controlling season range, season type, strength, score state, mode, display mode, and expandable filters

Canonical mapping:

- dense filter/control row for a table-heavy page

Assessment:

- this is the operational center of the page
- it should visually read as the first-class surface, not as content subordinate to a large hero
- the restyle should make this feel more closely related to the tables and controls used elsewhere on the site

Recommendation for restyle:

- reduce the dominance of the hero so the filters become the primary interaction surface
- align spacing and section framing to the calmer analytics-page system

### 5. Table Frame

Current implementation:

- `PlayerStatsTable` lives in the same panel beneath the filter surface
- table state is driven by canonical URL/query contract and fetch lifecycle

Canonical mapping:

- dominant analytics table inside a single primary data section

Assessment:

- the page is functionally table-first already
- the main style mismatch is the amount of chrome above the table
- the table/frame relationship is the strongest part of the page architecture

Recommendation for restyle:

- preserve the one-section filter + table grouping
- visually promote the table area by reducing header bulk above it
- align the frame to the shared analytics-table shell

## Page Archetype Decision

This page should be treated as:

- primarily a `table-heavy data page`
- secondarily a `drill-down landing page` for player detail routes

Not as:

- a marketing-style hero page
- a dashboard landing page

## Main Style-System Gaps Exposed By This Page

1. The data-page hero/header system still needs a production reference for breadcrumb + title + compact metadata cards.
2. The current hero is too decorative relative to the table-first role of the page.
3. The section-copy blocks are longer than the new system should default to on operational data pages.
4. The state-banner and filter-to-table grouping are strong and should be preserved through the restyle.

## Implementation Guidance For Task 5.0

When restyling this page:

1. Keep the route table-first.
2. Compress the hero into a tighter data-page header.
3. Preserve the metadata cards, but soften and shrink them.
4. Shorten the controls-section copy and keep the active-state chips.
5. Preserve the state-banner placement directly above the filters/table.
6. Treat `playerStats.module.scss`, not `indexUS.module.scss`, as the local production styling target.
