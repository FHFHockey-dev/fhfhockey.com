# PRD: Cron, NST, and Audit Remediation

## Introduction/Overview

The cron health emails from March 29, 2026 and March 31, 2026 show a mix of real job failures, missing audit observations, and likely misclassified audit failures. The current cron-report surfaces in `[cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts)`, `[CronAuditEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronAuditEmail.tsx)`, and `[CronReportEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronReportEmail.tsx)` depend on consistent `cron_job_audit` rows and on stable upstream integrations.

This project has two phases:

- Phase 1: remediate the live failures and observation gaps visible in the March 29 and March 31, 2026 emails, with special priority on Natural Stat Trick (NST) migration and missing audit coverage for cron-scheduled Supabase-writing routes.
- Phase 2: harden audit coverage and reporting behavior for cron-scheduled Supabase-writing routes so the daily emails reflect true operational status instead of noisy or ambiguous failure states.

The NST portion is urgent because `www.naturalstattrick.com` is no longer the correct automated access host. NST traffic must move to `data.naturalstattrick.com` and must require a configured key. Until the key is present, NST routes must fail fast instead of silently using the legacy host.

## Goals

- Restore trustworthy cron visibility so the daily email reflects actual failures, missing runs, and partial-success conditions.
- Migrate all NST-backed application endpoints away from `www.naturalstattrick.com` to `data.naturalstattrick.com`.
- Require an NST key from environment configuration and fail fast when the key is missing.
- Ensure every cron-scheduled API endpoint that writes or upserts to Supabase records a usable audit row.
- Re-run the affected jobs and the cron email flow and confirm the system reaches a stable post-remediation state.

## User Stories

- As an operator, I want the daily cron summary to distinguish hard failures from partial-success or expected transient states so I can act on the right problems.
- As an operator, I want every scheduled Supabase-writing route to emit a matching audit row so missing telemetry does not hide route behavior.
- As an operator, I want NST routes to use the supported bot-access host and authentication flow so production scraping continues to work.
- As a developer, I want audit payloads to follow one consistent contract so the report email can infer status, timing, rows upserted, and failed rows reliably.
- As a developer, I want post-fix validation to prove the cron system is healthy beyond NST alone, because downstream jobs depend on upstream freshness.

## Functional Requirements

1. The system must classify the March 29, 2026 and March 31, 2026 email failures into explicit buckets: real code defect, upstream dependency failure, configuration failure, missing telemetry, schedule mismatch, and partial-success noise.
2. The system must preserve the current daily summary and audit email outputs but improve their input data quality so those emails report true operational state.
3. Every endpoint in scope that currently references `www.naturalstattrick.com` must be updated to use `data.naturalstattrick.com`.
4. All NST-backed routes must read the NST key from environment configuration and must fail fast with a clear, sanitized error if the key is missing.
5. NST authentication details must never be exposed in logs, audit rows, cron emails, or response payloads.
6. The implementation must identify and update all known NST-backed routes in the application layer, including at minimum:
   - `/api/v1/db/update-nst-gamelog`
   - `/api/v1/db/update-nst-current-season`
   - `/api/v1/db/update-nst-last-ten`
   - `/api/v1/db/update-nst-goalies`
   - `/api/v1/db/update-nst-team-daily`
   - `/api/v1/db/update-nst-player-reports`
   - `/api/v1/db/check-missing-goalie-data`
   - `/api/Teams/nst-team-stats`
7. The implementation must document the NST request method used by the codebase, including whether the key is sent as a header, query string, or both, and that choice must be consistent across all NST routes.
8. The audit system must use a consistent success/failure contract for cron-scheduled Supabase-writing routes.
9. A route must not be marked as an audit failure only because a 200 response message contains text such as `Failed games` or similar mixed-result language.
10. Routes that complete with row-level issues must be recorded as successful with structured `failedRows` and sample details when the overall request succeeded.
11. The shared audit behavior in `[withCronJobAudit.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/withCronJobAudit.ts)` must be updated or extended so failure inference prefers explicit structured fields over naive message substring matching.
12. Any scoped route that uses bespoke audit insertion instead of the shared wrapper must be normalized to the same audit contract or otherwise produce equivalent fields for `job_name`, `status`, `rows_affected`, timing, response summary, and structured error details.
13. The project must inventory all cron-scheduled Supabase-writing routes and confirm whether each one records a matching `cron_job_audit` row.
14. The project must remediate the missing-audit cases surfaced in the March 31, 2026 email for scoped routes, including:
   - `update-shift-charts`
   - `update-nst-tables-all`
   - `update-nst-team-daily`
   - `update-season-stats-current-season`
   - `update-rolling-games-recent`
15. The project must explicitly evaluate route-to-job matching in the cron report so a route that is already wrapped with audit logging is not shown as “No audit row” because of alias, path, method, or job-name mismatch.
16. The daily cron report must continue to show observation gaps separately from route failures.
17. The implementation must triage and fix the live non-NST failures shown in the March 31, 2026 daily summary because full-system verification depends on them:
   - `update-standings-details` NHL API `429`
   - `run-forge-projection-v2` `422`
   - `update-sko-stats-full-season` schema mismatch on `assists_5v5`
   - `update-power-rankings` `(void 0) is not a function`
   - `run-projection-accuracy` missing succeeded projection dependency
18. The implementation must account for the March 29, 2026 audit noise where repeated failures were reported for `/api/v1/db/cron/update-stats-cron` and `/api/v1/db/update-line-combinations`, and must distinguish true failures from expected live-game or partial-processing conditions.
19. The implementation must preserve or improve existing cron timing metadata so the email templates can continue to render duration, row counts, and benchmark notes.
20. The project must re-run targeted routes after fixes and then re-run the cron email process so verification covers route execution, audit recording, and email summarization.
21. Full verification must include the cron-report flow plus the relevant upstream/downstream dependencies, not only the NST routes.

## Non-Goals (Out of Scope)

- Retrofitting audit rows for every manually triggered endpoint in the application. This PRD is limited to cron-scheduled Supabase-writing routes.
- Redesigning the visual layout of the cron emails unless a small content tweak is required for clarity.
- Reworking all cron schedules or time slots unless a schedule mismatch is directly causing the scoped failures.
- Expanding NST usage beyond the existing route set.
- Fixing non-scoped side-effect routes that do not write to Supabase, such as Google Sheets sync, except where they block correct cron-report interpretation.

## Design Considerations

- The email surfaces should remain familiar to the operator.
- The report should continue to separate:
  - scheduled failures
  - missing scheduled runs
  - unscheduled activity
  - audit-only failures
  - partial-success warnings
- If wording changes are needed, prefer short operator-facing labels such as `Missing audit row`, `Partial success`, `Config missing`, and `Upstream rate limited`.

## Technical Considerations

- `cron-report.ts` currently relies on both scheduled cron observations and `cron_job_audit` rows. Alias matching between schedule names, route paths, and audit `job_name` values must be reviewed carefully.
- `[withCronJobAudit.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/withCronJobAudit.ts)` currently infers failure partly from message text. This is likely a root cause of the inflated March 29, 2026 audit failure count.
- `[shift-charts.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/shift-charts.ts)` already writes a bespoke audit row and should be normalized against the shared contract instead of left as a special case.
- Some scoped routes already use `withCronJobAudit` but still appeared in the March 31, 2026 email as missing audit rows. That indicates a reporting correlation issue, not only a missing wrapper issue.
- NST migration must include any helper functions, Python scrapers, fetch wrappers, or Vercel function URLs that still assume the legacy NST host.
- Because the NST key is not yet approved at PRD creation time, verification must define a blocked state clearly:
  - before key approval: configuration failure is expected and must fail fast
  - after key approval: legacy host usage is forbidden and all NST validation must use the new authenticated path
- Any audit storage of request URLs must avoid leaking the NST key if the key is passed in the query string.

## Success Metrics

- The post-remediation daily cron summary shows zero scoped “No audit row” findings for cron-scheduled Supabase-writing routes.
- The post-remediation audit email no longer inflates failures for successful 200 responses that only contain mixed-result text.
- All scoped NST routes are confirmed to call `data.naturalstattrick.com` and none call `www.naturalstattrick.com`.
- When the NST key is absent, scoped NST routes fail fast with a clear configuration error.
- When the NST key is present, targeted NST validation succeeds or produces only documented upstream-limit failures.
- The March 31, 2026 failure set is reduced to only genuine remaining blockers, with each blocker explicitly categorized.
- A full-system verification run completes and produces a cron email where scoped failures, missing runs, and partial-success notes match the actual route behavior.

## Open Questions

- What exact environment variable name should store the NST key?
- Should the NST key be sent primarily as a custom header, as a query parameter, or with a header-first and query-string fallback policy?
- Are any NST requests still routed indirectly through other hosted functions that also need host/key migration?
- For routes such as `update-stats-cron` and `update-line-combinations`, what response contract should represent partial progress versus actionable failure?
- Should the cron report suppress known safe side-effect routes from “No audit row” warnings when they are intentionally out of scope for Supabase audit coverage?
- Is a small follow-up PRD needed after this work to cover non-Supabase scheduled side-effect routes and remaining cron observability gaps?
