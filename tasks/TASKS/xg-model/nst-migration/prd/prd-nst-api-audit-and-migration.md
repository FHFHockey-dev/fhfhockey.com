# PRD: NST API Audit and Migration

## Introduction/Overview

Natural Stat Trick has changed the supported path for automated access as of April 2026. Scrapers and bots are expected to use `data.naturalstattrick.com` instead of `www.naturalstattrick.com`, and every request must include an approved access key either as the `nst-key` header or as a `key` query parameter. The main site is being hardened against scraper traffic before the 2026 playoffs, so the current FHFH NST integrations are at risk of partial failure or full breakage if they continue to call the legacy host.

This project will audit every direct NST caller in the repository, migrate them to the supported data subdomain and key-based authentication flow, and validate that each migrated endpoint produces the same downstream behavior as the current scripts. The work must also replace the old NST rate-limit assumptions with the new token-based operating model, add environment-based key management for local and deployed server environments, and produce an operator-facing rollout and monitoring runbook.

The target reader is a junior developer. The document is intentionally explicit about scope, success conditions, and what “parity” means.

## Goals

- Inventory every direct code path in the repository that calls Natural Stat Trick and classify whether it is production, debug-only, legacy, or duplicate.
- Migrate all in-scope direct NST callers from `www.naturalstattrick.com` or bare `naturalstattrick.com` to `data.naturalstattrick.com`.
- Standardize NST authentication on a shared, environment-driven contract using `NST_KEY` and prevent secrets from leaking into logs, errors, responses, or audit rows.
- Preserve request parity and downstream behavior parity for the migrated routes, including parsed payload shape, API responses, and database writes.
- Replace or update the existing NST throttling assumptions so cron and backfill routes operate safely under NST’s token model instead of the old anti-bot timing rules.
- Produce a rollout plan, verification plan, and post-migration runbook that operators can use before and after the main-site restrictions tighten.

## User Stories

- As an operator, I want all NST-backed jobs to use the approved scraping host and key flow so production updates keep working when the main site clamps down on scrapers.
- As an operator, I want the NST key managed through environment variables in local development and deployed server environments so the key is not hardcoded into source files.
- As an operator, I want migration logging to be clear enough to identify which endpoint failed, why it failed, and whether it was a config, auth, upstream, parsing, or rate-budget issue.
- As a developer, I want one shared NST request layer so TypeScript and Python callers do not all reimplement host selection, headers, retries, and masking rules differently.
- As a developer, I want parity tests that prove the migrated endpoints still return and persist the same data contract as the current scripts.
- As a developer, I want duplicate or legacy NST fetchers called out explicitly so I know which ones should be migrated, consolidated, or deprecated.

## Functional Requirements

1. The project must produce a complete inventory of direct NST callers in the repository, including the files already identified by the user and additional discovered callers such as:
   - [functions/api/fetch_team_table.py](/Users/tim/Code/fhfhockey.com/functions/api/fetch_team_table.py)
   - [web/scripts/fetch_team_table.py](/Users/tim/Code/fhfhockey.com/web/scripts/fetch_team_table.py)
   - [web/pages/api/fetch_team_table.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/fetch_team_table.ts)
   - [web/pages/api/Averages/helpers.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Averages/helpers.ts)
   - [web/pages/api/CareerAverages/[playerId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/CareerAverages/[playerId].ts)
   - [web/pages/api/ThreeYearAverages/[playerId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/ThreeYearAverages/[playerId].ts)
   - [web/pages/api/SustainabilityStats/[playerId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/SustainabilityStats/[playerId].ts)
   - [web/pages/api/Teams/[teamAbbreviation].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/[teamAbbreviation].ts)
   - [web/pages/api/Teams/nst-team-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/nst-team-stats.ts)
   - [web/pages/api/v1/db/update-nst-gamelog.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-gamelog.ts)
   - [web/pages/api/v1/db/update-nst-goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-goalies.ts)
   - [web/pages/api/v1/db/update-nst-team-daily.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-team-daily.ts)
   - [web/pages/api/v1/db/update-nst-current-season.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-current-season.ts)
   - [web/pages/api/v1/db/update-nst-player-reports.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-player-reports.ts)
   - [web/pages/api/v1/db/update-nst-last-ten.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-last-ten.ts)
   - [web/pages/api/v1/db/check-missing-goalie-data.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/check-missing-goalie-data.ts)
   - [web/pages/api/v1/db/nst_gamelog_scraper.py](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/nst_gamelog_scraper.py)
   - [web/pages/api/v1/db/nst_gamelog_goalie_scraper.py](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/nst_gamelog_goalie_scraper.py)
   - [web/pages/api/ThreeYearAverages/nstgamelog.py](/Users/tim/Code/fhfhockey.com/web/pages/api/ThreeYearAverages/nstgamelog.py)
   - [web/pages/api/ThreeYearAverages/nsttest.py](/Users/tim/Code/fhfhockey.com/web/pages/api/ThreeYearAverages/nsttest.py)
2. The inventory must classify each NST caller as one of:
   - active production route
   - cron/backfill route
   - helper used by production code
   - debug/manual tool
   - duplicate or retirement candidate
3. The implementation must define one canonical NST base URL, `https://data.naturalstattrick.com`, and all in-scope direct callers must use it.
4. The implementation must define one canonical secret name, `NST_KEY`, and all in-scope direct callers must read the key from environment variables rather than hardcoding it.
5. The migration must support `NST_KEY` in local development and deployed server environments.
6. The implementation must not commit the NST key to source control, fixture files, snapshots, test output, logs, or error messages.
7. The system must standardize on a shared NST request helper or client contract that handles:
   - base URL selection
   - key injection
   - timeout defaults
   - safe request logging
   - retry policy
   - response status handling
   - masking of secrets in any stored URL or audit payload
8. The shared NST request contract must choose one primary authentication method. The default should be `nst-key` request header, with query-string `key` support reserved for compatibility cases that cannot set custom headers.
9. If a compatibility fallback to query-string authentication is retained, any log, audit payload, or surfaced error must redact the `key` value before storing or returning the URL.
10. Every migrated NST caller must preserve request parity with the current implementation, meaning the query parameters, dataset shapes, season/date behavior, and table selection logic remain functionally equivalent unless the PR explicitly documents an intentional change.
11. Every migrated NST caller must preserve downstream behavior parity with the current implementation, meaning:
   - the parsed payload shape remains equivalent for non-DB routes
   - the upsert targets and row-mapping behavior remain equivalent for DB routes
   - route-level success and failure behavior remains equivalent except for intended improvements in auth, logging, and throttling
12. The project must identify and document any callers whose current code is already inconsistent with the intended contract, such as routes that appear misnamed, duplicated, or not aligned with their file path purpose.
13. The migration must review and update browser-mimic headers currently used to work around legacy anti-bot behavior. The implementation must keep only the headers still needed for the data subdomain and remove unnecessary behavior if the shared client can prove it is not required.
14. The project must update NST rate-control logic to reflect NST’s published key-based limits:
   - 80 page requests per 5 minutes
   - 180 page requests per hour
   - 10 tokens per page
   - token refresh behavior as described by NST
15. The implementation must audit current hardcoded interval logic in:
   - [web/lib/cron/nstRateLimitPolicy.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/nstRateLimitPolicy.ts)
   - [web/lib/cron/nstBurstPlans.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/nstBurstPlans.ts)
   - [web/lib/cron/nstClassification.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/nstClassification.ts)
   and replace or adapt it so direct NST jobs budget against the new token windows instead of the legacy four-window anti-bot assumptions.
16. The system must maintain safe spacing between direct NST cron jobs even after the token-model update so parallel job starts do not accidentally exhaust the shared key budget.
17. The implementation must define how direct NST jobs coordinate shared request budget across:
   - gamelog ingestion
   - goalie ingestion
   - team daily ingestion
   - player reports
   - team stats
   - current-season and last-ten jobs
18. The migration must preserve or improve idempotency for backfill and incremental jobs. If a request is retried because of auth, upstream, or rate-budget failure, the route must not create duplicated downstream records.
19. The project must add automated parity coverage for representative NST callers across both TypeScript and Python code paths, using captured or mocked HTML fixtures where needed so tests do not consume live NST request budget.
20. The project must define a manual smoke-test matrix for live NST verification using the approved key after the code change is complete.
21. The manual smoke-test matrix must cover at minimum:
   - one `playerreport.php` caller
   - one `playerteams.php` gamelog caller
   - one `playerteams.php` goalie caller
   - one `teamtable.php` caller
   - one cron-backed route that writes to Supabase
22. The manual verification plan must compare legacy behavior and migrated behavior for the same sample inputs and confirm request parity plus downstream behavior parity.
23. The implementation must not rely on the main `www.naturalstattrick.com` site for automated access once migration is complete, except for explicitly documented manual-browser workflows.
24. The project must add or update documentation for local setup so developers know to place `NST_KEY` in `.env.local`.
25. The project must add or update documentation for deployed environments so operators know `NST_KEY` must be present in server-side environment configuration before rollout.
26. The project must include a rollout checklist that starts with local verification, then preview or staging verification if available, then targeted production job rollout.
27. The project must include a rollback path that allows operators to disable NST jobs safely if the new authenticated flow fails after deployment.
28. The project must include post-migration monitoring guidance covering:
   - auth failures
   - upstream 4xx or 5xx spikes
   - parse failures caused by HTML changes
   - token-budget exhaustion
   - cron duration regressions
   - stale downstream tables caused by blocked NST refreshes
29. The implementation must document which files are migrated, which files are intentionally left as debug or legacy tools, and which files should be consolidated or removed in a follow-up cleanup.
30. The project must produce an operator runbook that explains how to validate key presence, diagnose auth failures, inspect redacted request metadata, and determine whether a failure is caused by config, NST throttling, parsing drift, or application logic.

## Non-Goals (Out of Scope)

- Rewriting every NST parser for style only. Small refactors are allowed when they reduce duplication or enable the shared client, but parser logic should stay behaviorally stable.
- Replacing NST-derived product features with a different upstream provider.
- Redesigning database schemas unless a small additive field is needed for safer auditing or monitoring.
- Building a full distributed rate-limiter service unless the existing app architecture clearly requires it for the scoped jobs.
- Removing every duplicate legacy helper in the same PR if doing so raises migration risk. Duplicates may be marked for follow-up cleanup instead.
- Rotating the NST key inside source control or automating key lifecycle management with NST.

## Design Considerations

- The implementation should prefer one obvious NST integration path over many similar helpers.
- Operator-facing errors should be short and specific, such as `NST_KEY missing`, `NST auth rejected`, `NST token budget exhausted`, or `NST table parse failed`.
- Any surfaced URLs should be redacted if they include sensitive query parameters.
- Existing route contracts should remain stable for callers and dashboards unless the PR explicitly documents a safer failure mode.

## Technical Considerations

- Several current callers hardcode `https://www.naturalstattrick.com/...` or `https://naturalstattrick.com/...`, and some also send browser-like headers and referers tailored to the old site protections.
- Current NST throttling code in [web/lib/cron/nstRateLimitPolicy.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/nstRateLimitPolicy.ts) still models four old windows, while NST’s current published key model keeps only the 5-minute and 1-hour ceilings.
- Current burst planning in [web/lib/cron/nstBurstPlans.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/nstBurstPlans.ts) assumes route-local request counts. The new PR should evaluate whether route-local budgeting is enough or whether a shared per-key budget ledger is needed across jobs.
- Some files appear duplicated across TypeScript and Python implementations of similar fetch flows. The audit should state which implementation is canonical for production use and which ones are fallback, legacy, or manual utilities.
- Routes using `fetchWithCache` may need a compatible hook for header-based authentication so the migration does not force query-string secrets into cached URLs.
- `NST_KEY` is expected to be added to `.env.local`, which is gitignored. The implementation should not depend on committing local secret files.
- Because the user will rotate the currently shared key after testing, the implementation should avoid any step that stores the present key in durable repo artifacts.
- The PR should prefer primary-source validation against NST’s own current guidance rather than assumptions carried over from the old scraping behavior.

## Success Metrics

- Zero in-scope direct NST callers continue to reference `www.naturalstattrick.com` or bare `naturalstattrick.com` for automated requests after migration.
- All in-scope direct NST callers load `NST_KEY` from environment configuration instead of hardcoded values.
- Automated tests pass for the shared NST client behavior and representative parser parity cases.
- Manual smoke tests pass for representative `playerreport.php`, `playerteams.php`, and `teamtable.php` flows against `data.naturalstattrick.com`.
- Targeted cron or backfill routes complete without auth errors when `NST_KEY` is present.
- Targeted cron or backfill routes fail fast with sanitized configuration errors when `NST_KEY` is absent.
- No log, audit row, response payload, or snapshot exposes the live NST key.
- Post-rollout monitoring shows no unexpected increase in NST parse failures, 4xx responses, or stale-table incidents for the scoped routes.

## Open Questions

- Should the shared NST client support both header auth and query-string auth from day one, or should query-string auth be limited to explicit edge cases only?
- Do any deployed non-Vercel environments also need `NST_KEY`, or is the active server footprint limited to local development plus the existing deployed app environment?
- Which currently discovered NST callers are truly production-reachable versus historical or manual-only utilities?
- Should token-budget coordination live only in cron scheduling logic, or does it need runtime coordination across concurrently invoked routes too?
- Are there any other hosted functions or external jobs outside this repository that still call legacy NST URLs and need to be included in the operator runbook?
- After migration lands, should a follow-up cleanup PR retire duplicate Python and TypeScript fetchers that are no longer needed?
