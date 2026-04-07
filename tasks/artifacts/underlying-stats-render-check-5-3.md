# Underlying Stats Render Check

Task: `5.3 Perform a rendered verification pass on the live local /underlying-stats route for desktop and mobile layouts after the changes.`

## Route checked

- `http://localhost:3000/underlying-stats`

## Mobile verification

Verified with fresh screenshot:

- `/tmp/underlying-stats-3003-mobile.png`

What was visually confirmed:

- the page loads successfully
- the header is materially tighter than the earlier audited state
- the dominant table surface now appears ahead of the summary cards and supporting modules
- the `SoS` column is visible in the leading mobile table viewport alongside:
  - `#`
  - `Team`
  - `Power`
  - `SoS`
  - `Off`
- horizontal scrolling remains available for the full wider metric set
- the summary cards are demoted below the table in the mobile flow

## Desktop verification

Verified live route response:

- `curl http://localhost:3000/underlying-stats` returned `200`
- live HTML confirms the updated copy and page structure are being served

Desktop rendered-screenshot limitation:

- repeated post-change headless Chrome desktop screenshot attempts failed locally and did not emit a usable image file
- because of that, desktop was not visually re-confirmed with a fresh screenshot in this step

What can still be verified from the live served app plus CSS:

- the updated stylesheet includes the table-first visual ordering rules:
  - `.tableSection { order: 2; }`
  - `.summarySection { order: 3; }`
  - `.secondaryPanels { order: 4; }`
- the live served HTML includes the updated compact header and table copy

## Result

- Mobile rendered verification: passed
- Desktop rendered verification: partially blocked by local screenshot tooling
- No evidence of a broken live route or missing landing-page content after the changes
