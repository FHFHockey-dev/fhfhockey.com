# Underlying Stats Landing Page Data Path Audit

## Scope

Task `1.1`: trace the full landing-page data path for `/underlying-stats` and confirm where each displayed field originates.

This audit is limited to the landing page at `/underlying-stats`.

## Runtime Path Summary

### 1. Initial server-side page load

- `web/pages/underlying-stats/index.tsx`
  - `getServerSideProps()` fetches raw `date` rows directly from `team_power_ratings_daily`
  - it deduplicates those rows into `availableDates`
  - it chooses `targetDate`
  - it calls `fetchTeamRatings(targetDate)` to get the initial payload

### 2. Client-side date changes

- `web/pages/underlying-stats/index.tsx`
  - `handleDateChange()` updates the query string
  - a `useEffect()` calls `fetch('/api/team-ratings?date=...')`

### 3. API route

- `web/pages/api/team-ratings.ts`
  - validates the `date` query param
  - calls `fetchTeamRatings(date, teamAbbr?)`
  - returns the JSON payload unchanged except for HTTP/cache headers

### 4. Data service

- `web/lib/teamRatingsService.ts`
  - queries `team_power_ratings_daily`
  - selects the core displayed rating fields and extended component fields
  - maps snake_case database columns into the `TeamRating` shape used by the page
  - does not compute page metrics at read time

### 5. Landing-page rendering

- `web/pages/underlying-stats/index.tsx`
  - receives `TeamRating[]`
  - sorts rows client-side using `computeTeamPowerScore()`
  - derives summary cards, spotlight cards, and the table from that sorted array

## Displayed Field Origin Map

### Page-level controls and metadata

- `Snapshot date` dropdown:
  - source: direct SSR query to `team_power_ratings_daily.date`
  - file: `web/pages/underlying-stats/index.tsx`
  - note: this is not fetched through `/api/team-ratings`

- `Showing {ratings.length} teams`:
  - source: length of the current `TeamRating[]` payload
  - file: `web/pages/underlying-stats/index.tsx`

- section meta date:
  - source: `selectedDate`
  - file: `web/pages/underlying-stats/index.tsx`

### Team identity

- `teamAbbr`:
  - source column: `team_power_ratings_daily.team_abbreviation`
  - mapped in: `web/lib/teamRatingsService.ts`

- full team name:
  - source: `teamsInfo` lookup by abbreviation
  - file: `web/pages/underlying-stats/index.tsx`
  - this value does not come from the ratings payload

### Ranked ordering and summary cards

- row order:
  - source: client-side sort using `computeTeamPowerScore(team)`
  - file: `web/pages/underlying-stats/index.tsx`
  - formula helper: `web/lib/dashboard/teamContext.ts`

- top-three summary cards:
  - source: first three rows of the client-side ranked array
  - file: `web/pages/underlying-stats/index.tsx`

- `Power Score`:
  - source: computed at render time
  - formula: average of `offRating`, `defRating`, and `paceRating`, plus special-teams tier adjustments
  - helper: `web/lib/dashboard/teamContext.ts`

### Stored team-rating fields used directly by the landing page

These are read from `team_power_ratings_daily`, mapped in `web/lib/teamRatingsService.ts`, and rendered directly in `web/pages/underlying-stats/index.tsx`.

- `Off` -> `off_rating`
- `Def` -> `def_rating`
- `Pace` -> `pace_rating`
- `Trend` -> `trend10`
- `PP Tier` -> `pp_tier`
- `PK Tier` -> `pk_tier`
- `xGF60` -> `xgf60`
- `xGA60` -> `xga60`
- `Pace60` -> `pace60`
- `Finish` -> `finishing_rating`
- `Goalie` -> `goalie_rating`
- `Danger` -> `danger_rating`
- `Special` -> `special_rating`
- `Disc` -> `discipline_rating`
- `Variance` -> `variance_flag`

### Spotlight module

- `Sub-Ratings Spotlight`:
  - source: the first row in the client-side ranked array
  - fields used: `finishingRating`, `goalieRating`, `dangerRating`, `specialRating`, `disciplineRating`, `varianceFlag`
  - file: `web/pages/underlying-stats/index.tsx`

## Upstream Population Source For Stored Fields

The landing page itself does not compute stored ratings beyond `Power Score`.

The values rendered from the payload are expected to be populated upstream into `team_power_ratings_daily`.

### SQL/source-of-truth documentation

- `web/rules/power-ratings-tables.md`
  - documents:
    - `off_rating`
    - `def_rating`
    - `pace_rating`
    - `trend10`
    - component ratings
    - `variance_flag`

### Updater path currently writing to `team_power_ratings_daily`

- `web/pages/api/v1/db/update-team-power-ratings.ts`
  - calculates final ratings
  - calculates `trend10`
  - derives `pp_tier` and `pk_tier`
  - upserts the final row into `team_power_ratings_daily`

## Confirmed Data-Path Findings From Task 1.1

1. The landing page has two different data-entry paths:
   - SSR directly queries `team_power_ratings_daily` for dates and then calls `fetchTeamRatings()`
   - client-side date changes go through `/api/team-ratings`

2. The page does not trust database ordering for rankings.
   - It re-sorts the payload client-side using `computeTeamPowerScore()`

3. `Power Score` is not stored in `team_power_ratings_daily`.
   - It is derived in the UI from stored `offRating`, `defRating`, `paceRating`, `ppTier`, and `pkTier`

4. Team full names are not part of the ratings payload.
   - They are resolved locally from `teamsInfo`

5. `Trend`, `PP Tier`, `PK Tier`, component ratings, and `Variance` are all stored payload fields.
   - The landing page does not recompute them

6. The date dropdown is fed by a raw-row fetch, not a distinct-date fetch.
   - Because each snapshot date has many team rows, the current `.limit(90)` applies to rows, not days
   - This means the control can expose far fewer distinct dates than intended

7. The landing page currently depends on upstream correctness for `trend10`.
   - There is no read-time repair or fallback in the page, API route, or `teamRatingsService`

## Implication For Next Tasks

- Task `1.2` should compare the intended `trend10` definition in the documented SQL logic against the current stored values in `team_power_ratings_daily`
- Task `1.3` should determine whether the current broken trend behavior is caused primarily by the updater, the stored-table carry-forward logic, or both
- Task `1.5` will need to fix the SSR date-source strategy separately from the ratings payload path
