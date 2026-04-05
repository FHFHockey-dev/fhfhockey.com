# Underlying Stats Landing Page Layout Audit

Task: `4.1 Review the rendered landing page against fhfh-styles.md and identify the specific header, spacing, and module-density changes needed to make the page more table-first.`

## Audit basis

Audited against the current working-tree render, not just the last commit.

Verified render sources:

- desktop screenshot from `http://localhost:3003/underlying-stats`
- mobile screenshot from `http://localhost:3003/underlying-stats`
- current implementation in:
  - `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`
  - `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss`

Reference rules:

- table-heavy/data-page structure in `/Users/tim/Code/fhfhockey.com/fhfh-styles.md:208`
- typography and scanability rules in `/Users/tim/Code/fhfhockey.com/fhfh-styles.md:576`
- table structure and row-density rules in `/Users/tim/Code/fhfhockey.com/fhfh-styles.md:1028`

## Findings

### 1. The table is still too far below the fold on both desktop and mobile

Severity: high

Why it is off:

- The style guide says table-heavy pages should keep the table close to the title/context and avoid support modules that dominate more vertical space than the table.
- The current page order is:
  - header panel
  - secondary panel row
  - large summary-card row
  - table
- On mobile, the first viewport is effectively consumed by:
  - header
  - metric legend panel
  - sub-ratings panel
  - part of summary cards
- On desktop, the table is visible earlier than on mobile, but it is still pushed down by multiple full-width support sections before the main surface.

Primary source locations:

- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`
- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss`

Needed change:

- Reorder the page so the table lands immediately after a compact title/control block and, at most, a compact micro-summary row.

### 2. The summary-card section is too large for a table-first page

Severity: high

Why it is off:

- The three `Top teams overview` cards are visually strong, tall, and repeated.
- The style guide explicitly warns against oversized cards above the table on table-heavy pages.
- These cards duplicate information already present in the table:
  - rank
  - team
  - power
  - component context
  - trend
  - tiers

Primary source locations:

- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`
- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss`

Needed change:

- Convert the summary-card area into a compact summary strip or remove it from above-the-fold position.
- If retained, it should become materially shorter and denser than the current card anatomy.

### 3. The sub-ratings spotlight is useful but misplaced for the page archetype

Severity: medium-high

Why it is off:

- The module is legitimate supporting context, but it currently occupies premium space above the table.
- For this page archetype, it reads as a secondary analytical module and should not block access to the dominant table surface.

Primary source locations:

- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`
- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss`

Needed change:

- Demote it below the table, or compress it into a much smaller summary chip row if it must stay near the top.

### 4. The header is cleaner than before, but still too tall for a dense data page

Severity: medium

Why it is off:

- The intro copy block and date control card still read more like a separated hero-plus-control composition than one dense title/control bar.
- The style guide asks for a compact title and connected controls on data pages.

Primary source locations:

- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`
- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss`

Needed change:

- Tighten header padding and gaps.
- Reduce intro copy footprint.
- Make the date control feel more like part of the same compact control band rather than a separate side panel.

### 5. The current working-tree width treatment breaks style-system discipline

Severity: medium

Why it is off:

- The current working tree removes `$page-max-width` and replaces the shared page-width rule with `width: 90%` for multiple top-level sections.
- That is a local one-off implementation choice, not a tokenized or style-guide-backed page-width rule.
- It weakens consistency and makes the shell harder to reason about across breakpoints.

Primary source location:

- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss`

Needed change:

- Restore a tokenized/shared width constraint rather than a local percent-based override.
- If the page really needs a wider table shell, that width decision should still be expressed through the style system rather than a one-off local rule.

### 6. The legend is acceptable as collapsed details, but still competes with primary space

Severity: medium-low

Why it is off:

- The details/summary treatment is better than an always-open formula block.
- But it is still placed above the table in the same priority band as the first viewport.
- On mobile especially, it adds another full panel before the main surface.

Primary source locations:

- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`
- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss`

Needed change:

- Keep the legend collapsed, but consider relocating it below the table header zone or integrating the most important formula context into a compact inline note instead of a dedicated top-row panel.

## Recommended `4.x` direction

To make the page align with the canonical table-heavy/data-page archetype, the next layout pass should aim for:

1. Compact title + scope + snapshot controls in one connected top band.
2. Optional micro-summary row only if it materially improves scanning.
3. Dominant table surface immediately after that.
4. Secondary modules such as sub-ratings and expanded explanatory context below the table.

## Verified vs inferred

Verified:

- The render currently places multiple support modules before the dominant table surface.
- The mobile render is the clearest failure case for table-first density.
- The current working tree includes a local `width: 90%` shell change in the feature stylesheet.

Inferred design judgement:

- The page does not need all three current support surfaces above the table to remain understandable.
- The best table-first correction is structural reordering plus density reduction, not a decorative restyle.
