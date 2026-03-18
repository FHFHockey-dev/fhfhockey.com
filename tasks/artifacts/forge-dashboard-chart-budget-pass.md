# Forge Dashboard Chart Budget Pass

## Purpose

Keep the main dashboard in the PRD's moderate-charting lane by reserving compact charts for lead signals instead of rendering repeated microcharts across every visible row.

## Decisions

- `Top Player Adds` keeps ownership sparklines only on the lead add cards.
- `Team Trend Context` keeps a CTPI sparkline only on the lead spotlight card.
- `Hot / Cold` and `Trending Up / Down` keep one sparkline per visible column.
- Remaining rows stay text-first and continue to surface score, ownership, momentum, and reason text.

## Why

- The dashboard should read like a dense analytical terminal, not a chart wall.
- Repeated sparklines across every card dilute the importance of the few signals that actually deserve visual emphasis.
- Text-first lower-priority rows preserve scan speed and mobile legibility.

## Implementation Notes

- The chart budget is enforced inside the dashboard-owned card components, not in page-level layout code.
- Compact note text is rendered where charts are intentionally suppressed so the reduced chart budget is explicit, not accidental.
- The supporting chart surfaces kept on the page are now:
  - the lead Top Adds ownership sparks
  - the lead Team Context CTPI spotlight spark
  - one spark per Hot/Cold column

## Follow-On Guardrail

- If later dashboard work adds another chart to the main page, it should replace an existing compact spark surface or stay behind a drill-in, not expand the first-glance chart count.
