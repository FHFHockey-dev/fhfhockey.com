# NST Route Ownership Decisions

## Purpose

This file records the explicit keep, retire, and compatibility decisions for the ambiguous NST routes discovered during the migration audit.

## Decisions

### 1. `web/pages/api/v1/db/update-nst-player-reports.ts`

Decision:

- treat as retired from active operational ownership

Why:

- no active scheduler entry was found in `web/rules/cron-schedule.md`
- no current in-repo callers were found
- the file still carries unresolved scope TODOs about goalie handling and current-season behavior
- user-facing `playerreport.php` product reads already flow through the shared helper/client path instead

Implication:

- keep the migrated code for now so the route does not silently break if something external still calls it
- do not treat it as a supported scheduled production writer going forward

### 2. `web/pages/api/v1/db/update-nst-last-ten.ts`

Decision:

- treat as retired from active operational ownership

Why:

- no active scheduler entry was found in `web/rules/cron-schedule.md`
- no current in-repo callers were found
- the file still has copied route identity drift from `update-nst-gamelog`
- its current behavior is not self-evident from the route name

Implication:

- keep the migrated code as a compatibility surface for now
- do not treat it as an active production-owned NST writer

### 3. `web/pages/api/fetch_team_table.ts`

Decision:

- keep as a supported compatibility route for now
- canonical production ownership remains `functions/api/fetch_team_table.py`

Why:

- `web/pages/api/Teams/nst-team-stats.ts` is wired to the hosted Python function path today
- no current internal callers were found for the TypeScript route
- the TypeScript route is still a live public API surface and now has parity coverage

Implication:

- Python hosted function remains the canonical owner
- TypeScript route stays available as a compatibility path until a later cleanup pass retires it explicitly

### 4. `web/pages/api/Teams/[teamAbbreviation].ts`

Decision:

- retire this route rather than treat it as supported

Why:

- no current internal callers were found
- the file path advertises team scope but the implementation reads `playerId`
- it fetches `playerreport.php` and returns player-career messaging
- preserving it as “supported” would keep a misleading contract alive

Implication:

- retain the file only until the cleanup pass removes or replaces it safely
- do not treat it as a valid team API contract in active documentation or runbooks
