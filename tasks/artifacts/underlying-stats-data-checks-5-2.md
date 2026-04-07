# Underlying Stats Data Checks

Task: `5.2 Run targeted data checks against the underlying sources to confirm the displayed summary cards, table values, badges, and derived metrics match the intended formulas.`

## Scope checked

Snapshot checked:

- `2026-04-05`

Sources checked:

- direct landing-page fetcher:
  - `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.ts`
- shared power-score derivation:
  - `/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.ts`
- live landing-page API payload:
  - `http://localhost:3000/api/underlying-stats/team-ratings?date=2026-04-05`
- landing-page rendering rules:
  - `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`

## What was verified

### Summary-card selection

- The page selects summary cards from the first three rows of `rankedRatings`.
- `rankedRatings` sorts descending by `computeTeamPowerScore(team)`.
- Verified top three teams for `2026-04-05`:
  - `COL` power `130.6`
  - `CAR` power `125.9`
  - `DET` power `117.0`

These match the rendered summary-card ordering.

### Power-score derivation

- Verified the page uses:
  - `computeTeamPowerScore(team)`
- This equals:
  - average of `offRating`, `defRating`, `paceRating`
  - plus special-teams tier adjustments

Sample verified rows:

- `COL`: power `130.6`
- `TOR`: power `99.7`
- `NYR`: power `98.6`
- `EDM`: power `102.5`

### SoS values and SoS pill thresholds

- Verified `SoS` comes through the landing-page payload and is rendered directly by the page.
- Verified the threshold classes match the page rule:
  - `>= 105` -> positive
  - `<= 95` -> negative
  - otherwise neutral

Sample verified rows:

- `COL`: `SoS 68.98` -> negative
- `CAR`: `SoS 94.88` -> negative
- `DET`: `SoS 101.63` -> neutral
- `TOR`: `SoS 117.59` -> positive
- `NYR`: `SoS 120.72` -> positive
- `EDM`: `SoS 77.96` -> negative

Distribution on the checked snapshot:

- `14` positive
- `7` neutral
- `11` negative

### Trend values

- Verified the page renders `trend10` directly from the landing-page payload.
- Verified current snapshot sample values:
  - `COL`: `-0.13`
  - `CAR`: `4.53`
  - `DET`: `-2.95`
  - `TOR`: `-4.81`
  - `NYR`: `4.50`
  - `EDM`: `-0.81`

These align with the repaired trend path built from prior played snapshots.

### Component-rating badge thresholds

- Verified component badge classes use the same rule as coded in the page:
  - `>= 105` -> positive
  - `<= 95` -> negative
  - otherwise neutral

Sample checks:

- `COL finishing 120.58` -> positive
- `COL goalie 122.89` -> positive
- `CAR finishing 81.26` -> negative
- `CAR goalie 89.47` -> negative
- `TOR finishing 112.29` -> positive
- `TOR goalie 91.59` -> negative
- `NYR finishing 99.25` -> neutral
- `NYR goalie 114.76` -> positive

### API payload alignment

- Verified live landing-page API response:
  - `requestedDate: 2026-04-05`
  - `resolvedDate: 2026-04-05`
  - `count: 32`
- Verified sample API rows matched the direct landing fetcher for:
  - `CAR`
  - `COL`
  - `DET`
  - `EDM`
  - `NYR`
  - `TOR`

## Findings

- No data mismatches were found in the checked landing-page fields for the `2026-04-05` snapshot.
- On the checked snapshot, the summary cards, table ordering, `Power`, `SoS`, `Trend`, and badge classifications all matched the intended landing-page formulas.

## Verification commands

- direct landing fetcher / formula check via `ts-node`
- live API check via `curl http://localhost:3000/api/underlying-stats/team-ratings?date=2026-04-05`
