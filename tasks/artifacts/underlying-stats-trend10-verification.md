# Underlying Stats `trend10` Verification

## Scope

Task `1.2`: verify the intended `trend10` definition against the documented SQL source and compare it to the current stored values in `team_power_ratings_daily`.

## Intended Definition

### SQL source-of-truth

`web/rules/power-ratings-tables.md` defines `trend10` as:

- `round(COALESCE(wt.off_rating - wt.off_rating_last10, 0::numeric), 2) AS trend10`

Reference:

- `web/rules/power-ratings-tables.md:628`

Interpretation:

- `trend10` is intended to be the difference between the current `off_rating` and a last-10 baseline (`off_rating_last10`)
- this is a comparative signal, not a constant placeholder

### User-facing page copy

The landing-page legend says:

- `Trend compares today’s offense index against each club’s 10-game baseline.`

Reference:

- `web/pages/underlying-stats/index.tsx:304`

Interpretation:

- the page promises a meaningful recent-form delta
- the page copy is aligned with the SQL definition

## Current Stored Values

### Direct database check

Checked `team_power_ratings_daily` for recent snapshot dates `2026-04-01` through `2026-04-05`.

Result:

- each checked date had 32 team rows
- each checked date had `0` non-zero `trend10` values

Observed samples:

- `2026-04-05`: `COL`, `LAK`, `NSH` all had `trend10 = 0`
- `2026-04-04`: `NYI`, `ANA`, `STL` all had `trend10 = 0`
- `2026-04-03`: `UTA`, `MIN`, `NSH` all had `trend10 = 0`
- `2026-04-02`: `STL`, `PHI`, `SJS` all had `trend10 = 0`
- `2026-04-01`: `OTT`, `NYR`, `WPG` all had `trend10 = 0`

Conclusion:

- the stored table currently does not reflect the intended comparative-trend behavior for these recent snapshots

### API payload check

Checked the live landing-page payload via:

- `/api/team-ratings?date=2026-04-05`

Result:

- 32 team rows returned
- `0` rows with non-zero `trend10`
- sample returned values:
  - `COL`: `trend10 = 0`
  - `CAR`: `trend10 = 0`
  - `WSH`: `trend10 = 0`
  - `DET`: `trend10 = 0`
  - `TBL`: `trend10 = 0`

Conclusion:

- the broken stored value is passed through unchanged to the landing page

## Verification Outcome

### Verified

- The intended SQL definition for `trend10` is a delta from a last-10 offense baseline.
- The landing-page legend describes `trend10` the same way.
- The live stored values in `team_power_ratings_daily` are zero for all teams on the recent dates checked.
- The live API payload serving the landing page also returns all-zero `trend10` values for the checked latest snapshot.

### Inference

- Because both the database check and API check agree, the current user-facing issue is not caused by a display-only formatting problem.
- The mismatch exists before rendering, somewhere in the upstream stored-data path or its carry-forward behavior.

## Implication For Next Tasks

- Task `1.3` should isolate why the stored `trend10` values are collapsing to zero.
- Task `1.4` will need to restore a valid comparative trend path either upstream, at read time, or both.
