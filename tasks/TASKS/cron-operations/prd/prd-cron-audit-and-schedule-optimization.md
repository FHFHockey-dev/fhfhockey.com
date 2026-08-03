# PRD: Cron Audit and Schedule Optimization

**2026-08-03 guarded B-DRM publication receipt:** The exact `9cc3fcaac` push reached READY branch artifact `dpl_FdqykdwxfNYR89RxJFxEjn5JDzEJ`; one authorized promotion produced READY/Production `dpl_9otZoeDi1izJz6NWdX2iBUZdCi9X` with a two-minute completed build. Value-free route/auth-boundary checks passed and the runtime-error scan was empty. The only new cron-audit rows are the two intentional unauthenticated GET probes, each with persisted final-audit status; no natural successful retained-schedule run has yet supplied termination plus persisted final-audit evidence. No schedule, checkbox, database, writer, repair, backfill, provider, credential, analytics, push, or Yahoo state changed beyond the guarded publication.

**2026-08-03 local cron-contract cohort verification:** The shared cron/audit regression cohort passes `27` files / `182` tests, including report skip/upsert metrics, audit-wrapper receipts, schedule inventory, timing, benchmark, NST, WGO, and transactional helper contracts. This is local evidence only under the no-push/no-build/no-deployment freeze; no checkbox, denominator, or external state changed.

**2026-08-03 published cron-report upsert-metric correction:** The bounded-feed regression also showed that stale audit `rows_affected` values could make a successful `skipped_external_feed_unavailable` response appear to have upserted candidate rows. `parseAuditDetails` now treats that explicit status as zero upserts unless the response supplies an explicit processed/upserted count. The same `13/13` cron-report suite, TypeScript, scoped ESLint, and diff checks pass; the correction is included in published commit `9cc3fcaac` / READY Production `dpl_9otZoeDi1izJz6NWdX2iBUZdCi9X`, with a natural report confirmation still required.

**2026-08-03 published cron-report skip-metric correction:** A regression test using a successful `skipped_external_feed_unavailable` line-combination receipt exposed that `collectFailureEntries` counted primitive `skippedGameIds` as failed rows, recreating a false partial warning. The collector now traverses non-failure arrays only for nested objects and counts entries exclusively under explicit failure keys. The focused cron-report suite passes `13/13`, including the new skip-metric contract; the correction is included in published commit `9cc3fcaac` / READY Production `dpl_9otZoeDi1izJz6NWdX2iBUZdCi9X`, with a natural report confirmation still required.

**2026-08-03 18:00Z error-cohort follow-up:** Read-only Production `cron_job_audit` now reaches 273 observations: 264 successes and 9 non-successes, unchanged from the prior bounded window. Every line-combination run from `12:00Z` through `18:00Z` returned HTTP `200` with `skipped_external_feed_unavailable`; the four HTTP `500` line-combination rows are confined to `10:50Z`–`11:50Z` before the published route correction was reflected. The remaining workload failures are one intentional legacy rolling-games `410` and one each for the provider-dependent Yahoo weeks/player `500`s; the two retained `401` rows are historical probes. The `13:00:59Z` natural cron report remains HTTP `200` with `59/59` activity and zero missing jobs, but that pre-deployment report artifact predates the now-published report corrections. No checkbox, denominator, migration, writer, repair, backfill, provider, analytics, credential, push, build, or deployment state changed under the freeze.

**2026-08-03 latest 24-hour error-cohort reconciliation:** Read-only Production audit metadata contains 273 observations: 264 successes and 9 HTTP-error observations. The line-combination failures were confined to the early external-feed window; every subsequent run from `12:00Z` through `17:25Z` returned HTTP `200` with `skipped_external_feed_unavailable`, matching the published route correction. The remaining error groups are the intentional rolling-games `410`, provider-dependent Yahoo `500`s, and retained `401` probes. No checkbox, denominator, migration, writer, repair, backfill, provider, analytics, credential, push, build, or deployment state changed under the freeze.

**2026-08-03 current catalog reconciliation:** Read-only Production `cron.job` evidence reports 69 jobs: 59 active (54 HTTP and 5 SQL) and 10 inactive (`251,277,280,281,308,330,370,371,372,376`). The source JSON inventory now explicitly preserves job 308 as inactive and distinct horizon-5 job 393 as active. This corrects current schedule documentation only; no checkbox, denominator, migration, writer, repair, backfill, provider, analytics, credential, push, build, or deployment state changed under the freeze.

**2026-08-03 local error-cohort verification:** Local Supabase schema lint exited clean across all five local schemas. The bounded cron/projection, Yahoo/sKO, and migration-contract suites pass `108/108` tests (`38/28/42`); this remains local evidence only under the no-push/no-build/no-deployment freeze. C0047/7.5 and provider/history/natural-run gates remain open; no checkbox, denominator, or external state changed.

**2026-08-03 projection failure-inventory classification correction:** The Cron source inventory no longer labels `run-forge-projection-v2` and `run-projection-accuracy` as currently failing HTTP 422. Historical preflight/freshness 422 receipts remain documented; later natural receipts are HTTP 200, while C0012/C0013 remain open for current-date input freshness and provenance-complete eligible calibration evidence. No checkbox, denominator, or external state changed under the no-push/no-build/no-deployment freeze.

**2026-08-03 fresh local Supabase replay correction:** The disposable Colima/Docker stack replayed all 28 repository migrations in timestamp order through `20260801195126_drop_legacy_public_rpcs_after_zero_use.sql` with Supabase CLI `2.111.0` and an isolated CLI home; the installed `2.90.0` parser failure at the atomic Yahoo writer is resolved without changing migration SQL. Data-free guards skipped only scheduler ownership, Utah identity repair, and unified materialized-view retargeting. Full local database lint returned zero findings across `analytics`, `extensions`, `fhfh_internal`, `internal_stats`, and `public`; one-migration down/reapply passed. Value-free catalog checks show 14 analytics relations, forced RLS on the five new state tables, the normalized Yahoo reader view, and no retired legacy RPC signatures; the one queued Sustainability `config_change` record is the expected baseline activation. Ten focused migration/route files pass 77/77 tests. This is local prerequisite evidence only: no hosted/Production migration, writer, repair, backfill, provider, analytics, credential, push, build, deployment, checkbox, or denominator changed.

**2026-08-03 local Yahoo provider-failure classification correction:** Read-only Production shows Yahoo jobs 233 (`update-yahoo-weeks`) and 106 (`update-yahoo-players`) remain provider-dependent HTTP 500s. The local classifier now labels HTTP 429/5xx and transient network/timeout failures as `provider_unavailable`; the weeks route exposes that category on its existing fail-closed 500 response, player batches retain it without changing partial/failure status or write eligibility, and cron health surfaces the warning. Focused Yahoo verification passes 13/13 plus TypeScript, scoped ESLint, and diff integrity. This remains local/unpublished under the no-push/no-build/no-deployment freeze; no checkbox or denominator changed.

**2026-08-03 line-combination unavailable-state correction:** Read-only Production failures showed recent-gap archived/offseason Gamecenter `FUT`/`PRE` states and feed `503` responses being surfaced as HTTP 500. The recent-gap route now classifies those bounded external-feed conditions as `skipped_external_feed_unavailable` while preserving explicit historical-backfill failures as fail-closed. The focused route suite passes 6/6, and the route plus cron-report corrections are included in published commit `9cc3fcaac` / READY Production `dpl_9otZoeDi1izJz6NWdX2iBUZdCi9X`. A natural post-deployment report is still required, so no checkbox or denominator changed.

**2026-08-03 latest natural cron-report receipt:** Read-only Production metadata shows `daily-cron-report` succeeded at `2026-08-03T13:00:59.008817Z` with HTTP `200`, `59/59` scheduled jobs active in the report window, `jobsMissingLast=0`, and one intentionally disabled job. That pre-deployment report still reports four missing route-audit payloads and partial identities `update-line-combinations-job`/10, `update-line-combinations-all`/10, `update-nhl-edge-stats`/5, and `daily-cron-report`/25. Subsequent line-combination audits at and after `13:00Z` return HTTP `200` with explicit `skipped_external_feed_unavailable` status and ten skipped historical games, so the 10-row entries are bounded external-feed availability observations rather than current route failures. The self-metric correction is now published; C0047/7.5 remains open for a post-deployment natural report and correlated route-audit receipts, and no external state changed.

**2026-08-02 C0047 local self-metric correction:** Generic audit row inference was misclassifying nested report warning counts as `daily-cron-report` rows, producing a self-reinforcing 50-row partial warning. The report now opts out of row-metric inference; the focused 23/23 report/wrapper cohort plus TypeScript, ESLint, Prettier, and diff checks passes. Natural Production confirmation remains gated.

**2026-08-02 C0047 current-state follow-up:** Natural Production receipts for coordinator, direct projection, and accuracy are HTTP 200/success; later 401/405 rows are probes. The latest natural report still shows four missing route-audit payloads and partial failures 50/10/10/5. Local static coverage confirms the four route files already use the shared audit wrapper; focused route/projection coverage passes 14/14. This remains a deployed/natural evidence gate with no external mutation.

**2026-08-02 local scheduled-result isolation:** Production read-only metadata shows job-392's scheduled POST succeeded, but same-name GET probes later returned 401/405. `cron-report.ts` now rejects POST-to-GET method mismatches while retaining only the documented GET-to-POST wrapper compatibility. `withCronJobAudit` now makes a successful durable audit row self-consistent with `finalAudit.status="persisted"`; an insert failure returns `failed` and leaves no durable row. The local 33/33 focused cohort plus TypeScript, ESLint, Prettier, and diff-integrity checks pass. Stale job-319 410, Yahoo provider 500s, and provenance-gated accuracy remain explicit external/history gates; no publication, build, deployment, migration, writer, provider, or repair ran.

**2026-08-02 natural job-392/current-auth receipt:** Read-only Production audit evidence shows scheduled job 392 completed `POST` HTTP `200`/success at `2026-08-02T12:00:13.778493Z` in `11,603` ms with bounded response fields `success=true`, `playersProcessed=0`, `gamesProcessed=52,151`, and `metricsUpserted=0`. This is current Vault-secret parity proof without a manual invocation; no credential value was read. Separate Vercel runtime evidence records genuine NST `NST_KEY`-missing/timeout failures, and the next natural cron report succeeded without a self-audit gap but retained real missing-audit/partial-failure warnings. C0051/NEW 9.0 closes; C0047/7.5 remains open.

**2026-08-02 natural-report receipt clarification:** Read-only Production evidence now confirms scheduled run `148950` at `2026-08-01T21:15:06Z` completed success/HTTP 200 with zero warning and missing-observation counts. The later `2026-08-02T01:23:19Z` audit row is still `/api/v1/db/cron-report?preview=json` by URL despite lacking a dedicated preview key, so it is not a natural run. The unrelated `sync-yahoo-players-to-sheet` observation remains explicit; 7.5/C0047 and NEW 9.0 remain open. No email, writer, or mutation ran.

**2026-08-02 authenticated cron-report preview checkpoint:** One Vault-backed authenticated GET to `/api/v1/db/cron-report?preview=json` returned HTTP 200 as request 218 with `success:true`, `dryRun:true`, `preview:"json"`, 59 scheduled jobs, 59 with activity, `warnMissingAudit:0`, and no missing-observation jobs. Both email paths were suppressed, so no email was sent. A bounded read-only post-deployment audit query found only this preview row and zero non-preview `daily-cron-report` rows; the next natural report has not occurred, so 7.5/C0047 and NEW 9.0's natural-observation gate remain open.

## Introduction / Overview

This project defines a full audit and optimization pass for the scheduled cron jobs documented in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/tasks/TASKS/cron-operations/cron-schedule.md). The work has two connected goals:

1. Build a reliable benchmarking and reporting workflow that can run every scheduled job from earliest to latest, capture completion timing, and surface the results in the existing cron report tooling.
2. Use those observations to redesign the cron schedule so it runs efficiently, respects external dependencies such as Natural Stat Trick (NST), and finishes with a trustworthy end-of-run cron report.

The primary execution mode for the audit is local/dev where possible, with production use only when necessary. The resulting system should make it obvious which jobs are safe, slow, rate-limited, incorrectly ordered, or in need of optimization.

## Goals

- Create a repeatable audit process that runs every scheduled cron job in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/tasks/TASKS/cron-operations/cron-schedule.md) from earliest to latest.
- Ensure each audited job returns a completion timer in `MMSS` format in its JSON response, alongside machine-readable duration data.
- Extend the cron reporting pipeline so benchmark results are visible through [CronAuditEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronAuditEmail.tsx), [CronReportEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronReportEmail.tsx), and [cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts).
- Identify the real execution time, bottlenecks, and failure modes for each scheduled job.
- Redesign the schedule so short-running jobs are packed more tightly while preserving correctness and dependency order.
- Enforce safe NST behavior by respecting published request limits and preferring at least 15 minutes between NST-touching jobs.
- Flag any job taking longer than 4 minutes 30 seconds as an optimization target.
- Ensure the final cron report runs only after all scheduled work has finished.
- Ensure the first daily cron job starts no earlier than 3:00 AM Eastern Time.

## User Stories

- As an operator, I want to run all scheduled jobs in order and capture their real durations so that I can redesign the schedule based on data instead of estimates.
- As an operator, I want cron-report emails to surface slow jobs, missing jobs, bottlenecks, and optimization candidates so that I can quickly see where maintenance is needed.
- As an operator, I want NST-touching jobs to be spaced and rate-limited safely so that the system does not get throttled or blocked by NST.
- As a developer, I want offset-based or batch-based jobs to have a clear cron-safe strategy so that they can be automated reliably.
- As a developer, I want the schedule to minimize unnecessary idle time so that the daily refresh pipeline completes sooner without breaking dependencies.

## Functional Requirements

1. The system must define the complete in-scope job inventory directly from [cron-schedule.md](/Users/tim/Code/fhfhockey.com/tasks/TASKS/cron-operations/cron-schedule.md), including HTTP cron routes and SQL-only scheduled jobs such as materialized-view refreshes.
2. The system must provide a benchmark runner or audit process that executes scheduled jobs in chronological order from earliest to latest.
3. The benchmark runner must support local/dev execution as the primary mode, and it must document which jobs cannot be run locally without production dependencies.
4. The benchmark runner must not impose a fixed per-job duration cutoff during the audit pass. It must allow a job to complete so true timing can be recorded.
5. Each audited job must produce machine-readable duration data in the JSON response when the job completes successfully or unsuccessfully.
6. Each audited job that returns JSON must include a human-readable timer formatted as `MMSS`.
7. If a job currently does not return JSON, the implementation must define a consistent way to capture and store duration for that job.
8. The system must record at minimum the following fields per job run: job name, schedule slot, route or SQL identifier, start time, end time, duration in milliseconds, duration in `MMSS`, success/failure status, and execution notes.
9. The system must record observations about what each job touched, including whether it touched NST, Supabase, local database functions, external APIs, or materialized views.
10. The system must classify which jobs touch `www.naturalstattrick.com` directly or indirectly.
11. The system must enforce NST request limits across the full schedule:
    - 40 requests per 1 minute
    - 80 requests per 5 minutes
    - 100 requests per 15 minutes
    - 180 requests per hour
12. The system should prefer at least 15 minutes between scheduled jobs that touch NST, unless the implementation can prove that an exception is safe because the underlying job already self-throttles correctly.
13. The system must identify jobs that take longer than 4 minutes 30 seconds and mark them with an optimization denotation in reporting output.
14. The cron reporting pipeline must be updated so [CronAuditEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronAuditEmail.tsx), [CronReportEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronReportEmail.tsx), and [cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts) can display the new timing and optimization data.
15. The cron reporting pipeline must include slow-job highlights, bottleneck notes, and missing-observation warnings.
16. The cron reporting pipeline must continue to show existing success/failure and rows-affected style metrics where available.
17. The redesigned schedule must keep jobs in dependency-safe order from source ingestion through downstream derived tables and final reporting.
18. The redesigned schedule must group short-running jobs more tightly when they do not have dependency or external-rate-limit conflicts.
19. The redesigned schedule must remove unnecessary 5-minute gaps when measured execution data shows a job consistently completes much faster.
20. The redesigned schedule must ensure the first daily scheduled job starts no earlier than 3:00 AM Eastern Time.
21. The redesigned schedule must ensure [cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts) runs after all other scheduled jobs have completed.
22. The implementation must identify schedule weaknesses and bottlenecks, including:
    - jobs that block downstream jobs
    - jobs with unstable or missing duration reporting
    - jobs that overrun their intended slot
    - jobs that are incorrectly ordered relative to their dependencies
    - jobs that create excessive idle time
23. For offset-loop or batch-loop jobs such as [rebuild-window-z.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/rebuild-window-z.ts#L25), the system must choose one of two supported strategies:
    - define explicit sequential cron-safe URLs per offset or batch
    - optimize the endpoint so a single static cron-safe URL can finish in under 4 minutes 30 seconds
24. The preferred strategy for offset-loop jobs must be optimization first when practical, but the final implementation may use explicit sequential URLs if that is safer or more reliable.
25. The audit output must capture notes explaining why a job is slow, brittle, rate-limited, dependency-sensitive, or otherwise problematic.
26. The final deliverable must include a revised schedule proposal based on measured durations rather than placeholder spacing.

## Non-Goals (Out of Scope)

- This PRD does not implement the benchmark runner, cron-report changes, or schedule changes.
- This PRD does not rewrite the full business logic of every scheduled endpoint.
- This PRD does not require production-first benchmarking of all jobs.
- This PRD does not require frontend design changes beyond what is needed to support reporting in the existing email/report surfaces.
- This PRD does not define the final task list. That will be generated in the next step.

## Design Considerations

- Reuse the current cron reporting surfaces instead of inventing a separate reporting UI:
  - [CronAuditEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronAuditEmail.tsx)
  - [CronReportEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronReportEmail.tsx)
  - [cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts)
- Duration display should be easy to scan. Even if raw milliseconds remain the source of truth, the human-facing report should clearly show `MMSS`.
- Optimization denotations should be visually obvious in reports and easy to filter in follow-up work.
- The final report should make NST-sensitive jobs easy to identify.

## Technical Considerations

- [cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts) already parses durations, statuses, and rows-upserted style metrics. The implementation should extend that logic rather than replace it.
- [CronReportEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronReportEmail.tsx) and [CronAuditEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronAuditEmail.tsx) already render duration fields. They need support for richer timing and optimization context, but not a new reporting system.
- Some scheduled items are SQL statements instead of HTTP routes. The audit design must define how those jobs are executed and timed consistently with HTTP jobs.
- Some routes already support static cron-safe parameters, including recently updated sustainability routes. The audit should prefer static URLs where possible.
- Some routes may fan out internally to many requests. NST classification must consider internal behavior, not just the route path name.
- A local/dev benchmark mode may require authenticated local calls, seeded env vars, or wrappers for SQL-only jobs.
- Jobs that depend on live external data may need a documented fallback or skip behavior when local execution is not realistic.
- The implementation should standardize a shared timing helper so individual endpoints do not each invent their own duration response format.
- The implementation should avoid breaking existing cron consumers while adding timing metadata.

## Success Metrics

- 100% of scheduled jobs in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/tasks/TASKS/cron-operations/cron-schedule.md) are inventoried and classified.
- 100% of JSON-returning scheduled jobs expose a machine-readable duration and a human-readable `MMSS` timer.
- 100% of in-scope scheduled jobs have benchmark observations recorded in the audit process, or an explicit documented reason why they could not be run locally.
- 100% of NST-touching jobs are identified and evaluated for safe spacing.
- The revised schedule starts no earlier than 3:00 AM Eastern Time.
- The revised schedule places [cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts) at the end of the run.
- All jobs exceeding 4 minutes 30 seconds are visibly flagged as optimization targets.
- The revised schedule reduces unnecessary idle gaps while preserving dependency correctness and NST safety.

## Open Questions

- Which SQL-only scheduled jobs need wrappers, scripts, or direct database execution in order to participate in the same benchmark run as HTTP endpoints?
- Which jobs are unsafe to run locally because they require production-only data, secrets, or external side effects?
- Should slow-job denotations use a single severity level, or should there be multiple levels such as `slow`, `very slow`, and `optimization required`?
- For NST-touching jobs that already self-throttle internally, what evidence is sufficient to allow spacing exceptions below the preferred 15-minute gap?
- Should the benchmark runner persist results into an existing audit table, a new table, local files, or all three?
