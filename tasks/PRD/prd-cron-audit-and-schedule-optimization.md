# PRD: Cron Audit and Schedule Optimization

## Introduction / Overview

This project defines a full audit and optimization pass for the scheduled cron jobs documented in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md). The work has two connected goals:

1. Build a reliable benchmarking and reporting workflow that can run every scheduled job from earliest to latest, capture completion timing, and surface the results in the existing cron report tooling.
2. Use those observations to redesign the cron schedule so it runs efficiently, respects external dependencies such as Natural Stat Trick (NST), and finishes with a trustworthy end-of-run cron report.

The primary execution mode for the audit is local/dev where possible, with production use only when necessary. The resulting system should make it obvious which jobs are safe, slow, rate-limited, incorrectly ordered, or in need of optimization.

## Goals

- Create a repeatable audit process that runs every scheduled cron job in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md) from earliest to latest.
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

1. The system must define the complete in-scope job inventory directly from [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md), including HTTP cron routes and SQL-only scheduled jobs such as materialized-view refreshes.
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

- 100% of scheduled jobs in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md) are inventoried and classified.
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

