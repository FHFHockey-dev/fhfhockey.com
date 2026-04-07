# Underlying Stats Landing Page SoS Copy Update

Task: `3.5 Update the metric legend or explanatory copy so the page accurately describes the new SoS metric and any corrected trend behavior.`

## What changed

Updated landing-page copy in `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx` to reflect the shipped data model:

- page `<meta name="description">`
- header description
- metric legend copy
- summary-section support copy
- main table support copy

## Copy decisions

Trend copy now states that:

- trend compares today&apos;s offense index against each club&apos;s prior `10` played snapshots
- trend is not based on flattened carry-forward rows

SoS copy now states that:

- `SoS` means Strength of Schedule
- it is a `50/50` blend of:
  - opponent record strength plus OOWP-style schedule context
  - opponents&apos; current snapshot Power Scores
- it remains on the same `100`-centered scale used by the landing page
- `105+` indicates a more difficult schedule and `95-` indicates a softer one

## Verified vs inferred

Verified:

- The updated legend text matches the implemented helper logic from:
  - `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.ts`
  - `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.ts`
- The trend wording matches the repaired landing-page trend source, which rebuilds prior played snapshots from game history instead of reading flattened stored trend values.

Implementation choices:

- The summary and table descriptions were tightened to mention schedule context without expanding the page copy into a long methodology block.
- Detailed methodology remains in the metric legend and task artifacts, not in the section headers.

## Targeted verification

- `npx vitest run /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.test.ts /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.test.ts`
- Result: passed (`9` tests)
