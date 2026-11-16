# F16: version-aware team power goaltending labels (2026-11-13)

## Scope
Astra #434 addendum, P1 finding 1: readers call every goaltending value "5v5", but production rows are v3 (all situations), legacy carries (`legacy_unversioned`, source 2026-08-29) or unversioned (null). Show "5v5" only on verified v4 rows; label v3, legacy (with source date) and unknown accurately; label per row when a view mixes versions.

## Where
- Branch `octoberBranch`, base `fc9718365`.
- Owned files: `web/lib/teamRatingsService.ts`, `TeamPowerTerminal.tsx`, `TeamPowerCard.tsx`, `teamRatingNarrative.ts`, `web/pages/underlying-stats/index.tsx` (goaltending column and popover), pass-through API paths, their tests.
- Not touched: `web/lib/power-ratings.ts`, the writer route, the rebuild runner folder (lane F9).

## Production facts (read-only query, 2026-11-13)
- null version: 10,355 rows, 2025-10-07..2026-08-29, no source date.
- `legacy_unversioned`: 640 rows, 2026-09-09..09-28, source 2026-08-29.
- v3 `team-power-v3-all-team-baseline-prior-after-norm-pooled-st`: 1,472 rows, 09-29..11-13; source dates 2026-06-30..11-12.
- v4: 0 rows.

## Served paths carrying the ratings
- `/api/team-ratings` -> `fetchTeamRatings` (explicit column list; needs the two columns).
- `/api/underlying-stats/team-ratings` and the landing page props -> landing ratings spread `TeamRating`.
- `/api/v1/start-chart` -> `fetchTeamRatingsAsOf` (`select *`); not a goaltending display.
- Client: `lib/dashboard/normalizers.ts` `normalizeTeamRatings` (card, command center) drops unknown keys, so it must pass the fields.

## Design
- New pure helper `web/lib/teamRatingVersion.ts`: `describeGoaltendingBasis` (v4 = 5v5; v3 = "all situations, v3"; legacy = "carried from 2025-26 · as of Aug 29"; anything else = "version unverified"), `summarizeGoaltendingBasis` (uniform / mixed / empty over rows that have a value), `goaltendingColumnLabel`.
- Tables (card, landing): header says 5v5 only when every shown value is v4; a shared non-v4 basis prints under the header; mixed views tag every value.
- Terminal: label "5v5 Goalie" only on v4; otherwise "Goalie" plus a "Goalie calc" note row.
- Narrative: "5-on-5 goaltending" on v4, "All-situations goaltending" on v3, no goaltending sentence for legacy or unverified rows (a carried value is not "right now").
- Version fields are optional on `TeamRating` (absent = unverified, fails closed) to avoid churn in other lanes' fixtures; required on `NormalizedTeamRatingRow`.

## State
- Committed `486b18a6f` (code + tests, 14 files). Not pushed.
- Checks: 210 tests across 17 suites pass (readers, landing, command center, start chart, forge team, dashboard endpoints). New tests: 9 reader tests fail on HEAD sources (swap-in run); helper suite can't load at HEAD. `npm run typecheck` exit 0. ESLint 0 errors (old `<img>` warnings only). No `.module.scss` edits.
- Not done: no browser look at the pages.

## Next
- Report SHAs to Chef `local_016832c1-5630-43a9-9b8f-59627cb65bda`; Chef gates release #435.
- Follow-ups outside this lane: game-prediction feature `homeMinusAwayGoalieRating` still reads goalie_rating with no version (F9 flag 1); `teamLandingDashboard` "Goalie-carried" tag uses carried/legacy values without a version check (no 5v5 claim).

## Gotchas
- `teamRatingsService.ts` imports the server Supabase client, so the label helper lives in its own pure module for client components.
