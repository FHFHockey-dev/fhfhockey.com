# Underlying Stats Landing Audit

## Scope

This note captures the rendered audit for `/underlying-stats` as part of task `5.1`.

Rendered page reviewed:

- Route: `/underlying-stats`
- Local verification: `http://localhost:3001/underlying-stats`
- Current page identity: `Team Power Rankings`

Important clarification:

- This route is not currently a broad “underlying stats landing page”.
- It is a concrete table-first data page for team power rankings with a top header, secondary context panels, ranked summary cards, and a dominant analytics table.

## Current Section Map

### 1. Utility Link Row

Current implementation:

- a small plain-text link above the main header (`Visit the unified dashboard →`)

Canonical mapping:

- belongs to the data-page shell as a low-priority utility link or breadcrumb-adjacent row

Assessment:

- structurally acceptable
- visually under-integrated
- should eventually be absorbed into the canonical page shell instead of floating as an unstyled loose link

### 2. Header Panel

Current implementation:

- large bordered header panel
- strong title
- long descriptive copy block
- right-aligned snapshot-date control cluster

Canonical mapping:

- `6.2 Data Pages`
- `6.6 Drill-Down / Detail Pages`
- `9.1 Page Shells`
- softened data-page panel treatment rather than dashboard-intense treatment

Assessment:

- the panel is in the correct structural location
- the title/control relationship is correct
- the description is too long for the tighter data-page shell the new system calls for
- the current treatment still uses more chrome and explanatory copy than the new system should default to

Recommendation for restyle:

- keep the title + snapshot control pairing
- reduce the descriptive copy footprint substantially
- tighten top/bottom spacing
- keep the header operational, not editorial

### 3. Secondary Context Row

Current implementation:

- left `details` legend / formulas panel
- right sub-ratings spotlight panel

Canonical mapping:

- supporting context row beneath the main header
- mix of standard panel and softened data panel

Assessment:

- the two-column supporting context row is structurally useful
- the formulas panel is content-heavy and visually empty when collapsed
- the sub-ratings panel is closer to a canonical supporting analytics module
- this row should become more compact and better balanced relative to the summary cards and table

Recommendation for restyle:

- preserve the idea of a secondary context row
- reduce the decorative/glass treatment on the legend panel
- compress the sub-ratings panel into a denser support module

### 4. Top-Three Summary Cards

Current implementation:

- three ranked cards for the top teams
- oversized `#1 / #2 / #3` numerals
- accent strip at left
- emphasized power score

Canonical mapping:

- derived from the left-accent card family
- should behave like spotlight summary cards, not hero cards

Assessment:

- the cards are visually strong and useful
- the rank numerals are too dominant relative to the content
- the gold/silver/bronze treatment pushes them closer to decorative leaderboard cards than disciplined data-page summaries
- the left-accent structure itself is reusable

Recommendation for restyle:

- preserve the ranked summary concept
- reduce numeral dominance
- keep the left accent border but calm the special-case visual theatrics
- make these feel like data-page summary cards instead of showcase cards

### 5. Main Analytics Table

Current implementation:

- full-width dark table panel
- sticky header
- dense ranking rows
- badge-driven PP / PK and component columns

Canonical mapping:

- `6.4 Table-Heavy Pages`
- `9.9 Tables`
- heavy-table family informed by `ProjectionsTable` and `DraftBoard`

Assessment:

- this is the clearest canonical part of the page
- structurally it already matches the intended page archetype: compact context above, dominant table below
- the row density and sticky header are directionally correct
- table styling should be normalized to the calmer shared table language, but the section architecture itself is right

Recommendation for restyle:

- keep the table as the dominant surface
- align header typography, row hover, borders, and badge treatments to the canonical system
- avoid inflating the area above the table

### 6. Inline States

Current implementation:

- loading banner above the table
- error banner above the table
- empty state inside the table section

Canonical mapping:

- in-panel / in-section state messaging, not full-page replacement

Assessment:

- structurally correct
- should be normalized to the state rules established later in the style system
- do not let these states become more decorative than the table they support

## Page Archetype Decision

This page should be treated as:

- primarily a `table-heavy data page`

Not as:

- a dashboard page
- a chart page
- a landing page with hero treatment

## Main Style-System Gaps Exposed By This Page

1. The data-page shell is still not fully canonicalized because this page itself is the first true production candidate for that role.
2. The top summary-card row is useful, but its current rank-heavy styling is too theatrical for the desired system.
3. The legend/formulas panel needs a tighter content strategy; it currently consumes too much attention for supporting documentation.
4. The table is the strongest part of the page and should become the anchor for the production restyle.

## Implementation Guidance For Task 5.0

When restyling this page:

1. Keep the page table-first.
2. Shorten and tighten the header.
3. Convert the supporting top row into denser, calmer secondary modules.
4. Rework the top-three cards into disciplined summary cards rather than leaderboard showpieces.
5. Preserve the sticky-header analytics table as the dominant surface.
