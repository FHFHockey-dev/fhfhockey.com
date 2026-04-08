# NST Direct Caller Inventory

Last updated: 2026-04-08

## Scope

This inventory covers repository files that directly reference NST network hosts in executable code:

- `https://www.naturalstattrick.com/...`
- `https://naturalstattrick.com/...`
- `https://data.naturalstattrick.com/...`

It excludes:

- comment-only examples
- UI copy mentioning NST
- downstream consumers of already-ingested NST data
- indirect callers that hit an internal FHFH route or hosted function instead of NST directly

## Direct NST Callers

| File | Endpoint family | Host style | Direct caller notes |
| --- | --- | --- | --- |
| `functions/api/fetch_team_table.py` | `teamtable.php` | `www.naturalstattrick.com` | Direct Python fetcher; also sets NST referer and performs a session-establishing request to the main site root. |
| `web/scripts/fetch_team_table.py` | `teamtable.php` | `www.naturalstattrick.com` | Direct Python script fetcher; mirrors the Flask/function implementation. |
| `web/pages/api/fetch_team_table.ts` | `teamtable.php` | `www.naturalstattrick.com` | Direct Next.js route fetcher for team tables. |
| `web/pages/api/SustainabilityStats/[playerId].ts` | `playerteams.php` | `www.naturalstattrick.com` | Direct NST player-team fetch for sustainability metrics. |
| `web/pages/api/Teams/[teamAbbreviation].ts` | `playerreport.php` | `naturalstattrick.com` | Direct player-report fetch; file path suggests team scope but code fetches player report data. |
| `web/pages/api/CareerAverages/[playerId].ts` | `playerreport.php` | `naturalstattrick.com` | Direct career-averages route fetcher. |
| `web/pages/api/Averages/helpers.ts` | `playerreport.php` | `naturalstattrick.com` | Shared helper used by player-report style routes. |
| `web/pages/api/ThreeYearAverages/[playerId].ts` | `playerreport.php` | `naturalstattrick.com` | Direct three-year averages route with multiple NST fetch variants. |
| `web/pages/api/ThreeYearAverages/nstgamelog.py` | `playerreport.php` | `naturalstattrick.com` | Standalone Python NST script. |
| `web/pages/api/ThreeYearAverages/nsttest.py` | `playerreport.php` | `naturalstattrick.com` | Standalone Python NST test script. |
| `web/pages/api/v1/db/update-nst-player-reports.ts` | `playerreport.php` | `www.naturalstattrick.com` | Direct production ingestion route for seasonal player reports. |
| `web/pages/api/v1/db/update-nst-goalies.ts` | `playerteams.php` | `www.naturalstattrick.com` | Direct production ingestion route for goalie gamelogs. |
| `web/pages/api/v1/db/check-missing-goalie-data.ts` | `playerteams.php` | `www.naturalstattrick.com` | Direct NST validation route for goalie coverage checks. |
| `web/pages/api/v1/db/update-nst-current-season.ts` | `playerteams.php` | `www.naturalstattrick.com` | Direct production ingestion route for current-season player tables. |
| `web/pages/api/v1/db/update-nst-gamelog.ts` | `playerteams.php` | `www.naturalstattrick.com` | Direct production ingestion route for skater gamelogs; also carries legacy referer headers. |
| `web/pages/api/v1/db/nst_gamelog_scraper.py` | `playerteams.php` | `www.naturalstattrick.com` | Standalone Python gamelog scraper. |
| `web/pages/api/v1/db/update-nst-last-ten.ts` | `playerteams.php` | `www.naturalstattrick.com` | Direct production or support route for player-team slices. |
| `web/pages/api/v1/db/nst_gamelog_goalie_scraper.py` | `playerteams.php` | `www.naturalstattrick.com` | Standalone Python goalie gamelog scraper. |
| `web/pages/api/v1/db/update-nst-team-daily.ts` | `teamtable.php` | `www.naturalstattrick.com` | Direct production ingestion route for team daily tables; also carries legacy referer headers. |

## Classification

| File | Classification | Rationale |
| --- | --- | --- |
| `functions/api/fetch_team_table.py` | shared helper | Hosted function endpoint used by `web/pages/api/Teams/nst-team-stats.ts`; direct NST caller but primarily serves as an internal fetch abstraction. |
| `web/scripts/fetch_team_table.py` | duplicate or retirement candidate | Appears to duplicate the Flask/function implementation for team-table fetching without clear production wiring. |
| `web/pages/api/fetch_team_table.ts` | duplicate or retirement candidate | Next.js route duplicates the team-table fetch capability already provided through the hosted Python function path. |
| `web/pages/api/SustainabilityStats/[playerId].ts` | production route | Live API route consumed by `web/hooks/useSustainabilityStats.ts` and UI components. |
| `web/pages/api/Teams/[teamAbbreviation].ts` | duplicate or retirement candidate | File path suggests team data but implementation fetches player-report data by `playerId`; no clear consumer was found in current app usage. |
| `web/pages/api/CareerAverages/[playerId].ts` | production route | Live API route consumed by `web/hooks/useCareerAveragesStats.ts` and surfaced in the UI. |
| `web/pages/api/Averages/helpers.ts` | shared helper | Shared NST player-report fetch helper used by route-level code rather than a standalone route. |
| `web/pages/api/ThreeYearAverages/[playerId].ts` | production route | Public API route consumed by `web/components/WiGO/fetchThreeYearAverages.ts`. |
| `web/pages/api/ThreeYearAverages/nstgamelog.py` | debug or manual tool | Standalone script under API folder with no production routing or imports found. |
| `web/pages/api/ThreeYearAverages/nsttest.py` | debug or manual tool | Standalone ad hoc NST test script with no production wiring found. |
| `web/pages/api/v1/db/update-nst-player-reports.ts` | production route | Direct database-writing NST ingestion route in the main app API surface. |
| `web/pages/api/v1/db/update-nst-goalies.ts` | cron or backfill route | Direct database-writing NST route designed for scheduled or bounded ingestion work. |
| `web/pages/api/v1/db/check-missing-goalie-data.ts` | debug or manual tool | Validation and inspection route rather than a core production data-serving endpoint. |
| `web/pages/api/v1/db/update-nst-current-season.ts` | cron or backfill route | Direct database-writing NST route intended for scheduled current-season refreshes. |
| `web/pages/api/v1/db/update-nst-gamelog.ts` | cron or backfill route | Core direct NST ingestion route used by rolling pipeline and cron job definitions. |
| `web/pages/api/v1/db/nst_gamelog_scraper.py` | debug or manual tool | Standalone Python scraper file with no active production imports or route wiring found. |
| `web/pages/api/v1/db/update-nst-last-ten.ts` | production route | Direct Next.js API route with NST fetch logic retained in the live app API surface; not clearly scheduled, but not just a standalone script. |
| `web/pages/api/v1/db/nst_gamelog_goalie_scraper.py` | debug or manual tool | Standalone Python scraper file with no active production imports or route wiring found. |
| `web/pages/api/v1/db/update-nst-team-daily.ts` | cron or backfill route | Direct database-writing NST route designed for daily incremental and manual backfill execution. |

## Classification Summary

- Production routes: 5
- Cron or backfill routes: 4
- Shared helpers: 2
- Debug or manual tools: 5
- Duplicate or retirement candidates: 3

## Notes On Ambiguous Cases

- `web/pages/api/v1/db/update-nst-last-ten.ts` remains in the production-route bucket for now because it is a live API route, but it should be revisited in task `1.3` to confirm whether it is user-triggered, scheduled, or largely dormant.
- `web/pages/api/fetch_team_table.ts` and `functions/api/fetch_team_table.py` overlap heavily. Task `1.4` should decide which implementation is canonical before migration work starts.
- `web/pages/api/Teams/[teamAbbreviation].ts` looks structurally inconsistent with its filename and likely belongs in the cleanup or retirement path unless task `1.3` finds a live consumer.

## Production Reachability

| File | Reachability status | Evidence |
| --- | --- | --- |
| `functions/api/fetch_team_table.py` | production-reachable | Exposes `/api/fetch_team_table` in `functions/api/index.py` and is called by `web/pages/api/Teams/nst-team-stats.ts` via `https://functions-fhfhockey.vercel.app/api/fetch_team_table`. |
| `web/scripts/fetch_team_table.py` | historical or manual utility | No live imports, UI usage, or route wiring found. |
| `web/pages/api/fetch_team_table.ts` | production-reachable but apparently unused | It is a live Next.js API route by convention, but no current internal callers were found; likely dormant duplicate surface. |
| `web/pages/api/SustainabilityStats/[playerId].ts` | production-reachable | Called by `web/hooks/useSustainabilityStats.ts`, which is used by the sustainability vs career chart UI. |
| `web/pages/api/Teams/[teamAbbreviation].ts` | apparently dormant or miswired | Live Next.js API route by convention, but no current callers were found and the implementation does not match the team-oriented file path. |
| `web/pages/api/CareerAverages/[playerId].ts` | production-reachable | Called by `web/hooks/useCareerAveragesStats.ts`, which is used by the sustainability vs career chart UI. |
| `web/pages/api/Averages/helpers.ts` | production-reachable via helper path | Shared helper used by route code rather than a standalone route surface. |
| `web/pages/api/ThreeYearAverages/[playerId].ts` | production-reachable | Called by `web/components/WiGO/fetchThreeYearAverages.ts`. |
| `web/pages/api/ThreeYearAverages/nstgamelog.py` | historical or manual utility | No imports, scheduled calls, or route wiring found. |
| `web/pages/api/ThreeYearAverages/nsttest.py` | historical or manual utility | No imports, scheduled calls, or route wiring found. |
| `web/pages/api/v1/db/update-nst-player-reports.ts` | production-reachable but not confirmed active | Live Next.js API route surface exists, but no cron schedule or internal callers were found in the current repo scan. |
| `web/pages/api/v1/db/update-nst-goalies.ts` | production-reachable and scheduled | Present in cron schedule definitions and direct NST job classification. |
| `web/pages/api/v1/db/check-missing-goalie-data.ts` | manual utility | Live route surface exists, but no callers or schedules were found; appears diagnostic. |
| `web/pages/api/v1/db/update-nst-current-season.ts` | production-reachable and scheduled | Present in cron schedule definitions and direct NST job classification. |
| `web/pages/api/v1/db/update-nst-gamelog.ts` | production-reachable and scheduled | Present in cron schedule definitions, direct NST job classification, and rolling pipeline code. |
| `web/pages/api/v1/db/nst_gamelog_scraper.py` | historical or manual utility | No imports, scheduled calls, or route wiring found. |
| `web/pages/api/v1/db/update-nst-last-ten.ts` | production-reachable but not confirmed active | Live Next.js API route surface exists, but no current callers or schedules were found in the repo scan. |
| `web/pages/api/v1/db/nst_gamelog_goalie_scraper.py` | historical or manual utility | No imports, scheduled calls, or route wiring found. |
| `web/pages/api/v1/db/update-nst-team-daily.ts` | production-reachable and scheduled | Present in cron schedule definitions, direct NST job classification, and DB backfill UI wiring. |

## Reachability Summary

- Production-reachable and scheduled: 4 direct callers
- Production-reachable via live UI or internal route consumption: 5 direct callers
- Production-reachable but not confirmed active: 3 direct callers
- Manual diagnostic utility: 1 direct caller
- Historical or manual utilities: 5 direct callers
- Apparently dormant or miswired: 1 direct caller

## Migration Notes For Ambiguous Reachability

- `web/pages/api/v1/db/update-nst-player-reports.ts` should stay in migration scope for now because it is live API surface and directly fetches NST, even though this scan did not find a current scheduler or consumer.
- `web/pages/api/v1/db/update-nst-last-ten.ts` should stay in migration scope for now for the same reason: live route surface plus direct NST dependency, but no current scheduler or caller evidence.
- `web/pages/api/fetch_team_table.ts` should be treated as a dormant duplicate until task `1.4` decides whether the TypeScript route or Python hosted function is canonical.
- `web/pages/api/Teams/[teamAbbreviation].ts` should not be assumed safe to delete during migration. It is misaligned with its file name, but because it is a live route surface, it needs an explicit keep, fix, or retire decision.

## Duplicate Families And Canonical Ownership

### `teamtable.php` family

- Canonical production path: `functions/api/fetch_team_table.py`
- Supporting evidence:
  - `web/pages/api/Teams/nst-team-stats.ts` calls `https://functions-fhfhockey.vercel.app/api/fetch_team_table`
  - `functions/api/index.py` exposes `/fetch_team_table` and `/api/fetch_team_table`
  - `web/pages/api/fetch_team_table.ts` has no confirmed current callers
  - `web/scripts/fetch_team_table.py` is a script duplicate of the Python implementation
- Migration implication:
  - Migrate the Python hosted function as the canonical `teamtable.php` fetch path.
  - Treat `web/pages/api/fetch_team_table.ts` and `web/scripts/fetch_team_table.py` as duplicate or retirement candidates unless later evidence requires them.

### `playerteams.php` gamelog family

- Canonical production path: TypeScript Next.js routes
- Canonical files:
  - `web/pages/api/v1/db/update-nst-gamelog.ts`
  - `web/pages/api/v1/db/update-nst-goalies.ts`
  - `web/pages/api/v1/db/update-nst-current-season.ts`
  - `web/pages/api/v1/db/update-nst-team-daily.ts`
  - `web/pages/api/v1/db/update-nst-last-ten.ts`
  - `web/pages/api/v1/db/check-missing-goalie-data.ts`
- Duplicate or non-canonical files:
  - `web/pages/api/v1/db/nst_gamelog_scraper.py`
  - `web/pages/api/v1/db/nst_gamelog_goalie_scraper.py`
- Supporting evidence:
  - The TypeScript routes are the live Next.js API surfaces and scheduled NST ingestion paths.
  - The Python scrapers have no confirmed production imports, schedules, or route wiring.
- Migration implication:
  - Migrate the TypeScript routes first and treat the Python scrapers as legacy or manual utilities unless later work promotes them explicitly.

### `playerreport.php` family

- Canonical production path: TypeScript API routes plus shared helper
- Canonical files:
  - `web/pages/api/Averages/helpers.ts`
  - `web/pages/api/CareerAverages/[playerId].ts`
  - `web/pages/api/ThreeYearAverages/[playerId].ts`
  - `web/pages/api/SustainabilityStats/[playerId].ts`
  - `web/pages/api/v1/db/update-nst-player-reports.ts`
- Duplicate or non-canonical files:
  - `web/pages/api/ThreeYearAverages/nstgamelog.py`
  - `web/pages/api/ThreeYearAverages/nsttest.py`
  - `web/pages/api/Teams/[teamAbbreviation].ts`
- Supporting evidence:
  - Career, three-year, and sustainability routes all have confirmed TypeScript-side consumers.
  - The Python files are standalone scripts with no confirmed route or scheduler wiring.
  - `web/pages/api/Teams/[teamAbbreviation].ts` is structurally inconsistent and should not be treated as canonical.
- Migration implication:
  - Migrate the shared TypeScript player-report path and keep script-level files out of the canonical ownership path.

## Contract Inconsistencies To Preserve Or Correct Explicitly

| File | Inconsistency | Why it matters for migration |
| --- | --- | --- |
| `web/pages/api/Teams/[teamAbbreviation].ts` | File path promises team-based API behavior, but the handler reads `playerId` from the query string and fetches `playerreport.php` career-style player data. | This is the clearest contract mismatch in scope. Migrating it blindly would preserve confusing behavior behind a misleading route name. |
| `web/pages/api/Teams/[teamAbbreviation].ts` | Success and error messages talk about “career averages stats for player” rather than team data. | Confirms the file is likely copied from a player route and not an intentional team endpoint. |
| `web/pages/api/v1/db/update-nst-last-ten.ts` | File starts with `// pages/api/v1/db/update-nst-gamelog.ts` instead of its own route identity. | Signals likely copy-forward implementation and raises risk that migration changes could be applied under the wrong assumptions. |
| `web/pages/api/v1/db/update-nst-last-ten.ts` | Route naming suggests a “last ten” bounded slice, but the file currently looks like a broader copied `playerteams.php` ingestion implementation. | Needs explicit ownership and contract confirmation before migration logic is consolidated. |
| `web/pages/api/v1/db/update-nst-current-season.ts` | Top-of-file comments still describe old NST anti-bot limits (`40/min`, `100/15min`) rather than the new key-token model. | Confirms documentation drift inside a live route that will be touched during throttling migration. |
| `web/pages/api/v1/db/update-nst-player-reports.ts` | File-level TODOs admit unresolved scope questions about goalie handling and current-season-only behavior. | Indicates this route’s behavioral contract may already be incomplete or unstable even before host/key migration. |
| `web/pages/api/fetch_team_table.ts` | Duplicates the team-table capability of the hosted Python function, but without the same season-default logic or session-bootstrap behavior. | Migration must not assume the TypeScript duplicate is contract-equivalent to the live Python path. |
| `web/scripts/fetch_team_table.py` | Script duplicate diverges from `functions/api/fetch_team_table.py`, including error handling and session bootstrap behavior. | Confirms this file should not be treated as interchangeable with the canonical hosted function without explicit review. |
| `web/pages/api/CareerAverages/[playerId].ts` and `web/pages/api/Averages/helpers.ts` | Both independently construct `playerreport.php` fetch URLs rather than sharing one player-report request builder. | Duplicate request construction raises drift risk when host, auth, and redaction rules are introduced. |
| `web/pages/api/ThreeYearAverages/[playerId].ts` | Contains multiple inline `playerreport.php` URL constructions instead of routing through one shared helper. | This route is likely to drift during migration unless explicitly normalized onto the canonical request path. |

## Recommended Handling For These Inconsistencies

- Preserve live route behavior where it is customer-facing or downstream-dependent, but do not preserve misleading names, stale comments, or duplicate request construction unless necessary for backward compatibility.
- Treat `web/pages/api/Teams/[teamAbbreviation].ts` as an explicit keep, fix, or retire decision rather than an automatic migration.
- Treat `web/pages/api/v1/db/update-nst-last-ten.ts` and `web/pages/api/v1/db/update-nst-player-reports.ts` as behavior-audit routes before consolidation, because their current contracts are not self-evident from file naming and comments.
- Normalize `playerreport.php` request construction onto the shared TypeScript helper path during migration so host/auth changes are not replicated across multiple route files.

## Indirect Or Non-Direct NST References

These files are in NST migration scope, but they do not currently call NST directly and should not be counted as direct callers in this inventory:

| File | Why it is not counted as a direct caller |
| --- | --- |
| `web/pages/api/Teams/nst-team-stats.ts` | Calls the hosted FHFH `fetch_team_table` function URL, not NST directly. |
| `web/lib/cron/nstRateLimitPolicy.ts` | Defines NST pacing policy but does not make network requests. |
| `web/lib/cron/nstBurstPlans.ts` | Defines route request plans but does not make network requests. |
| `web/lib/cron/nstClassification.ts` | Classifies jobs by NST touch level only. |
| `web/scripts/cron-audit-runner.ts` | Coordinates cron timing around NST jobs but does not fetch NST directly. |

## Comment-Only Or Header-Only Legacy References

These references should be cleaned up later if they remain after migration, but they are not standalone direct callers by themselves:

- `web/pages/api/v1/db/update-nst-gamelog.ts` legacy example URLs in comments
- `web/pages/api/v1/db/update-nst-gamelog.ts` legacy `Referer` header
- `web/pages/api/v1/db/update-nst-team-daily.ts` legacy `Referer` header
- `functions/api/fetch_team_table.py` legacy `Referer` header and root-session bootstrap
- `web/scripts/fetch_team_table.py` legacy `Referer` header

## Raw Counts

- Direct NST caller files: 19
- Direct `playerreport.php` callers: 7
- Direct `playerteams.php` callers: 8
- Direct `teamtable.php` callers: 4
- Direct `game.php` callers: 0
- Direct callers already using `data.naturalstattrick.com`: 0
