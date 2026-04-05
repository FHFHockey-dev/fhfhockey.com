# Player Stats Detail Audit

## Scope

This note captures the `5.7` evaluation for `/underlying-stats/playerStats/[playerId]`.

Rendered page reviewed:

- Route: `/underlying-stats/playerStats/8479772`
- Local verification: `http://localhost:3003/underlying-stats/playerStats/8479772`

## Styling Surface Decision

Important clarification:

- The detail route imports `./playerStats.module.scss`, the same page-level stylesheet used by the landing page.
- There is no separate detail-page module stylesheet to normalize in this pass.
- Because `5.6` rewrote `playerStats.module.scss`, the detail route already inherits the new calmer data-page shell automatically.

## Current State

What already aligns in this pass:

- page background and page-width shell
- softened header panel
- calmer metadata cards
- section shell and section header styling
- state-banner styling
- page-level spacing, chip treatment, and footnote styling

What is still detail-specific:

- breadcrumb placement remains inside the header instead of moving to the new utility row pattern used on the landing page
- detail copy and labels still use the older route-specific wording (`Player Detail`, `Detail Controls`, `Initial Table Family`)
- the detail page did not receive the same markup compression pass as landing task `5.5`

## Rendered Assessment

The rendered route confirms:

- the page no longer looks visually disconnected from the newly restyled landing page
- the dominant shell is already in-family with the new system
- the remaining inconsistency is structural/textual rather than stylesheet-driven

The rendered check also confirmed the existing data-performance caveat:

- the first uncached detail request can still sit in a loading state while the server performs cold aggregation work
- that is a data-path issue, not a page-shell styling issue

## Decision

Decision for task `5.7`:

- do not open a separate detail-route stylesheet task inside this pass
- treat the detail route as `aligned by shared module inheritance`
- formally defer any detail-specific markup cleanup or copy tightening to a later follow-up unless the owner explicitly wants the route brought to parity in the same tranche

## Follow-up Guidance

If this route is revisited later, the next steps should be:

1. Move breadcrumbs and return navigation into the same utility-row pattern used on the landing page.
2. Tighten the detail-page copy to match the calmer data-page tone.
3. Rename header/section labels so landing and detail pages feel like siblings rather than separate prototypes.
4. Address the cold detail-query latency separately from UI styling work.
