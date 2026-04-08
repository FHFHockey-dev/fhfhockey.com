## Relevant Files

- `tasks/prd-nst-api-audit-and-migration.md` - Source PRD that defines the migration scope, parity requirements, and rollout expectations.
- `tasks/nst-direct-caller-inventory.md` - Working inventory of direct NST callers, indirect references, and legacy URL touchpoints discovered during task `1.1`.
- `tasks/nst-config-contract.md` - Canonical NST host, secret, auth, redaction, and environment contract established in task `2.1`.
- `web/lib/fetchWithCache.ts` - Shared fetch helper that may need NST-aware header support and URL redaction behavior.
- `web/lib/cors-fetch.ts` - Shared low-level fetch wrapper now extended to accept caller-supplied request init for server-side NST auth headers.
- `web/lib/cors-fetch.test.ts` - Unit tests that lock the shared `Fetch(...)` contract so caller headers extend defaults instead of replacing them.
- `web/lib/nst/client.ts` - Shared TypeScript NST client that centralizes base URL selection, header auth, timeout defaults, retry behavior, and safe URL redaction.
- `web/lib/nst/client.test.ts` - Unit tests for the shared NST client contract.
- `web/lib/cron/nstRateLimitPolicy.ts` - Current NST rate-window policy that still reflects the old limit model.
- `web/lib/cron/nstRateLimitPolicy.test.ts` - Unit tests for NST rate-window calculations and interval selection.
- `web/lib/cron/nstBurstPlans.ts` - Current NST request-plan helper used by direct NST cron jobs.
- `web/lib/cron/nstBurstPlans.test.ts` - Unit tests for NST burst-plan and safe-interval selection behavior.
- `web/lib/cron/nstClassification.ts` - Classifies direct NST jobs and should stay aligned with the updated migration scope.
- `web/lib/cron/nstClassification.test.ts` - Unit tests for NST job classification.
- `web/lib/cron/withCronJobAudit.ts` - Shared audit wrapper that may need redacted NST request metadata and clearer auth or throttle failures.
- `web/lib/cron/withCronJobAudit.test.ts` - Unit tests for audit wrapper behavior.
- `web/lib/cron/benchmarkNotes.ts` - Benchmark metadata for direct NST jobs that may need updated notes after token-budget migration.
- `web/lib/cron/benchmarkNotes.test.ts` - Unit tests for benchmark metadata behavior.
- `web/scripts/cron-audit-runner.ts` - Cron coordination logic that may need updated NST spacing or budgeting rules.
- `web/pages/api/v1/db/update-nst-gamelog.ts` - Primary skater gamelog ingestion route and a key direct NST caller.
- `web/pages/api/v1/db/update-nst-goalies.ts` - Primary goalie gamelog ingestion route and a key direct NST caller.
- `web/pages/api/v1/db/update-nst-team-daily.ts` - Primary team daily NST ingestion route.
- `web/pages/api/v1/db/update-nst-current-season.ts` - Current-season NST route with legacy delay assumptions.
- `web/pages/api/v1/db/update-nst-player-reports.ts` - Seasonal player report ingestion route that should migrate to the shared NST client.
- `web/pages/api/v1/db/update-nst-last-ten.ts` - NST route that must be audited for host, key, and parity behavior.
- `web/pages/api/v1/db/check-missing-goalie-data.ts` - Goalie validation route that directly hits NST and should use the shared request contract.
- `web/pages/api/v1/db/nst_gamelog_scraper.py` - Python NST gamelog scraper that should be classified and either migrated or marked legacy.
- `web/pages/api/v1/db/nst_gamelog_goalie_scraper.py` - Python NST goalie scraper that should be classified and either migrated or marked legacy.
- `web/pages/api/Teams/nst-team-stats.ts` - Team stats route that depends on NST-backed table fetches and scheduling logic.
- `web/pages/api/fetch_team_table.ts` - TypeScript team table fetcher that should migrate to the shared data-subdomain contract.
- `functions/api/fetch_team_table.py` - Python or Flask team table fetcher that should migrate or be retired explicitly.
- `web/scripts/fetch_team_table.py` - Script-level NST team table helper that should be classified and updated or deprecated.
- `web/pages/api/Averages/helpers.ts` - Shared player report fetch helper used by API routes and likely affected by header-based auth.
- `web/pages/api/CareerAverages/[playerId].ts` - Direct NST playerreport caller that must preserve response parity.
- `web/pages/api/ThreeYearAverages/[playerId].ts` - Direct NST playerreport caller with multiple fetch variants.
- `web/pages/api/SustainabilityStats/[playerId].ts` - Direct NST playerteams caller that must preserve parsed metrics.
- `web/pages/api/Teams/[teamAbbreviation].ts` - Direct NST caller that should be reviewed for scope, correctness, and migration handling.
- `web/pages/api/ThreeYearAverages/nstgamelog.py` - Manual NST script that should be classified as active, debug, or retirement candidate.
- `web/pages/api/ThreeYearAverages/nsttest.py` - Manual NST test script that should be classified as active, debug, or retirement candidate.
- `web/rules/nst-team-tables-schemas.md` - Existing NST team-table schema notes that may help verify parity expectations.
- `web/components/WiGO/fetchThreeYearAverages.ts` - Consumer-side helper that may rely on unchanged route contracts after migration.
- `web/hooks/useCareerAveragesStats.ts` - Hook that consumes career averages route output and should remain behaviorally stable.
- `web/hooks/useSustainabilityStats.ts` - Hook that consumes sustainability stats route output and should remain behaviorally stable.
- `tasks/goalie-underlying-stats-runbook.md` - Example operator runbook style that can inform the NST rollout and support docs.
- `tasks/player-underlying-stats-runbook.md` - Example operator runbook style for validation and troubleshooting guidance.
- `tasks/tasks-prd-nst-api-audit-and-migration.md` - Execution plan for this PRD.
- `web/lib/underlying-stats/teamStatsQueries.ts` - Existing team underlying-stats query implementation surfaced by the required full-suite test run as an unrelated blocker to parent-task completion.
- `web/lib/underlying-stats/teamStatsQueries.test.ts` - Existing failing Vitest suite discovered during the mandatory parent-task completion test run.

### Notes

- Unit tests should typically be placed alongside the code files they are testing, but existing repo conventions for cron or route tests should be preserved where already established.
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.
- Live NST validation should use the approved key only for targeted smoke tests. Automated tests should rely on fixtures, mocks, or captured HTML to avoid consuming live NST request budget.
- `.env.local` is gitignored. The implementation should document `NST_KEY=...` for local setup without committing the secret.

## Tasks

- [x] 1.0 Complete the NST caller inventory and migration scope classification
  - [x] 1.1 Audit every repository reference to `naturalstattrick.com`, `www.naturalstattrick.com`, and `data.naturalstattrick.com` and produce a scoped inventory of direct NST callers.
  - [x] 1.2 Classify each discovered caller as production route, cron or backfill route, shared helper, debug or manual tool, or duplicate or retirement candidate.
  - [x] 1.3 Confirm which listed files are actually production-reachable versus historical or manual utilities, and record any ambiguous cases that need explicit handling in the migration notes.
  - [x] 1.4 Identify duplicated NST fetch logic across TypeScript and Python implementations and decide which code path is canonical for production behavior.
  - [x] 1.5 Document any obviously inconsistent routes or files, such as handlers whose file path purpose does not match their current NST behavior, so the migration can preserve parity without carrying forward silent confusion.

- [x] 2.0 Build the shared NST authentication and request contract
  - [x] 2.1 Define the canonical NST configuration contract around `NST_KEY` and `https://data.naturalstattrick.com`, including local `.env.local` and deployed server environment expectations.
  - [x] 2.2 Implement a shared NST request helper or client for TypeScript callers that centralizes base URL selection, header-based auth, timeout defaults, retry behavior, and safe request logging.
  - [x] 2.3 Add secret-redaction behavior so any logged or surfaced NST URL masks the `key` query parameter if a compatibility fallback ever uses query-string auth.
  - [x] 2.4 Update `fetchWithCache` or the relevant shared fetch layer so header-based NST auth works without forcing secrets into cached URLs.
  - [x] 2.5 Define and document the Python-side integration pattern so Python callers either use an equivalent shared config contract or are explicitly marked legacy and excluded from runtime usage.
  - [x] 2.6 Add fast-fail behavior for missing `NST_KEY` with sanitized, operator-readable errors that do not leak secrets.

- [x] 3.0 Migrate all in-scope NST callers to the shared data-subdomain integration
  - [x] 3.1 Migrate the primary direct ingestion routes to `data.naturalstattrick.com` through the shared NST request contract, starting with `update-nst-gamelog`, `update-nst-goalies`, `update-nst-team-daily`, `update-nst-current-season`, `update-nst-player-reports`, `update-nst-last-ten`, and `check-missing-goalie-data`.
  - [x] 3.2 Migrate team-table fetch flows, including `web/pages/api/fetch_team_table.ts`, `functions/api/fetch_team_table.py`, `web/scripts/fetch_team_table.py`, and `web/pages/api/Teams/nst-team-stats.ts`, while preserving request parameter behavior and downstream consumers.
  - [x] 3.3 Migrate direct player-report and player-team API callers, including career averages, three-year averages, sustainability stats, and any remaining helper-layer NST fetches.
  - [x] 3.4 Review and update browser-mimic headers, referers, and session-establishment workarounds so the new data-subdomain integration keeps only behavior still required by NST.
  - [x] 3.5 Preserve request parity and downstream behavior parity for every migrated route, including route responses, parser mappings, table upserts, and idempotent retry behavior.
  - [x] 3.6 Mark legacy or manual-only NST scripts clearly if they are not part of the production migration path, and document any follow-up cleanup candidates rather than silently leaving them ambiguous.

- [x] 4.0 Replace legacy NST throttling assumptions with the new token-aware budget model
  - [x] 4.1 Replace the old four-window NST limit assumptions in `nstRateLimitPolicy.ts` with a model aligned to the current published NST key rules and token budget behavior.
  - [x] 4.2 Update `nstBurstPlans.ts` so direct NST jobs select request pacing from the new token-aware ceilings instead of the legacy anti-bot intervals.
  - [x] 4.3 Review `nstClassification.ts`, cron coordination, and benchmark metadata so all direct NST jobs remain correctly classified and scheduled under the new shared-budget model.
  - [x] 4.4 Define how concurrent direct NST jobs coordinate the shared key budget across gamelog, goalies, team daily, team stats, player reports, current season, and last-ten workflows.
  - [x] 4.5 Preserve or improve safeguards that prevent duplicate downstream writes when retries happen because of auth failures, transient upstream errors, or exhausted token budget.
  - [x] 4.6 Update automated tests for NST rate calculations, burst-plan selection, and any audit or benchmark behavior affected by the new pacing model.

- [x] 5.0 Add parity validation, rollout verification, and operator documentation
  - [x] 5.1 Add automated tests for the shared NST client behavior, including config loading, header injection, secret redaction, and failure handling.
  - [x] 5.2 Add representative parser or route parity tests for at least one `playerreport.php` flow, one `playerteams.php` skater flow, one `playerteams.php` goalie flow, and one `teamtable.php` flow using fixtures or mocked HTML.
  - [x] 5.3 Define a manual smoke-test matrix that compares legacy and migrated behavior for representative NST endpoints and one cron-backed Supabase-writing route.
  - [x] 5.4 Document local setup requirements for `NST_KEY`, deployed environment requirements, and the safe sequence for preview or staging verification before production rollout.
  - [x] 5.5 Write the rollout checklist, rollback guidance, and operator runbook covering missing key, auth rejection, token-budget exhaustion, HTML parse drift, upstream 4xx or 5xx responses, and stale downstream data diagnosis.
  - [x] 5.6 Record the final migrated file inventory, the intentionally retained legacy tools, and the recommended follow-up cleanup items after the authenticated NST migration is complete.

- [x] 6.0 Resolve ambiguous direct-route ownership discovered during the NST audit
  - [x] 6.1 Decide whether `web/pages/api/v1/db/update-nst-player-reports.ts` remains an active migrated route or should be retired after confirming operational ownership.
  - [x] 6.2 Decide whether `web/pages/api/v1/db/update-nst-last-ten.ts` remains an active migrated route or should be retired after confirming operational ownership.
  - [x] 6.3 Decide whether `web/pages/api/fetch_team_table.ts` remains a supported route or is retired in favor of `functions/api/fetch_team_table.py`.
  - [x] 6.4 Decide whether `web/pages/api/Teams/[teamAbbreviation].ts` should be fixed, replaced, or retired because its current implementation does not match its file path contract.

- [ ] 7.0 Clean up stale NST route identity and contract drift during migration
  - [ ] 7.1 Update misleading copied file headers and route descriptions in NST ingestion files such as `update-nst-last-ten.ts`.
  - [ ] 7.2 Remove or rewrite stale old-limit comments in NST routes so operator guidance matches the new key-token model.
  - [ ] 7.3 Consolidate duplicated inline `playerreport.php` request construction onto the shared NST request path to prevent post-migration drift.

- [ ] 8.0 Resolve unrelated full-suite test failures blocking NST parent-task closure
  - [ ] 8.1 Investigate the failing assertions in `web/lib/underlying-stats/teamStatsQueries.test.ts` discovered during the mandatory `npm test` run for task `1.0`.
  - [ ] 8.2 Decide whether the `teamStatsQueries` failures reflect expected upstream ongoing work or a real regression that must be fixed before later NST parent tasks are marked complete.
