## Relevant Files

- `web/rules/cron-schedule.md` - Source-of-truth cron inventory and the schedule file that will be tightened and reordered based on measured durations.
- `tasks/artifacts/cron-schedule-normalized-inventory.md` - Normalized inventory of every scheduled cron block with dependency position, time slot, method, and URL or SQL target.
- `tasks/artifacts/cron-benchmark-runner-shape.md` - Execution-shape decision artifact choosing a shared runner core with a script-first operator surface and an optional thin API wrapper.
- `tasks/prd-cron-audit-and-schedule-optimization.md` - Product requirements document that defines the audit, reporting, NST-spacing, and schedule-optimization scope.
- `web/pages/api/v1/db/cron-report.ts` - Existing cron summary endpoint that must be extended to understand richer timing, optimization denotations, and audit notes.
- `web/lib/cron/cronReportTiming.ts` - Shared cron-report normalization helper for canonical timing extraction from audit payloads and fallback response envelopes.
- `web/lib/cron/cronReportTiming.test.ts` - Tests for cron-report timing extraction so report normalization can ingest canonical `timing` payloads safely.
- `web/lib/cron/cronReportFlags.ts` - Shared slow-job threshold and optimization-denotation helper used by cron-report summaries.
- `web/lib/cron/cronReportFlags.test.ts` - Tests for the 4m30s slow-job threshold and stable optimization warning payloads.
- `web/lib/cron/benchmarkNotes.ts` - Shared static benchmark annotations for known bottlenecks, side effects, and special-handling cron jobs.
- `web/lib/cron/benchmarkNotes.test.ts` - Tests for curated benchmark annotation lookups used by cron-report payloads.
- `web/lib/cron/withCronJobAudit.ts` - Current audit wrapper that records `details.durationMs` for wrapped cron routes and defines the existing route-level timing baseline.
- `web/lib/cron/timingContract.ts` - Shared canonical timing contract and helper for adding nested `timing` payloads to cron responses, audit details, and benchmark observations.
- `web/lib/cron/formatDuration.ts` - Shared cron duration-formatting helper for canonical MMSS output and reusable duration labels.
- `web/lib/cron/cronInventory.ts` - Shared parser and loader for deriving the scheduled cron inventory from `web/rules/cron-schedule.md` with stable chronological ordering.
- `web/lib/cron/cronInventory.test.ts` - Tests for schedule parsing, SQL normalization, broken-job classification, and chronological ordering.
- `web/lib/cron/benchmarkRunner.ts` - Shared sequential benchmark runner that executes normalized inventory items in chronological order and records timing observations.
- `web/lib/cron/benchmarkRunner.test.ts` - Tests for chronological execution order, tie preservation, and per-job observation timing.
- `web/lib/cron/benchmarkObservationMetadata.ts` - Shared metadata helper that classifies touched systems, benchmark notes, and local-run policy for each scheduled job.
- `web/lib/cron/benchmarkObservationMetadata.test.ts` - Tests for touched-system classification and local-run policy metadata.
- `web/lib/cron/benchmarkExecutionPolicy.ts` - Shared skip/fallback policy helper that decides whether benchmark jobs should run normally, be skipped, be observed only, or use a mock fallback in local/dev.
- `web/lib/cron/benchmarkExecutionPolicy.test.ts` - Tests for stable skip/fallback decisions on broken, side-effect, reporting, and safe benchmark jobs.
- `web/lib/cron/sqlTiming.ts` - Shared normalization helper for SQL-only pg_cron jobs that must derive comparable timing from `cron_job_report`.
- `web/lib/cron/timingContract.test.ts` - Tests for canonical timing construction, nested response envelopes, and timing-shape detection helpers.
- `web/lib/cron/withCronJobAudit.test.ts` - Tests for wrapper-generated failure responses and audit timing preservation on timed error payloads.
- `web/components/CronReportEmail/CronReportEmail.tsx` - Daily cron summary email that should display MMSS timing context, slow-job warnings, bottlenecks, and missing observations.
- `web/components/CronReportEmail/CronAuditEmail.tsx` - Audit-focused email surface that should display the richer benchmark and optimization signals.
- `web/pages/api/v1/sustainability/rebuild-priors.ts` - Example cron endpoint already updated for static cron-safe usage and likely to participate in timing contract standardization.
- `web/pages/api/v1/sustainability/rebuild-window-z.ts` - Offset-loop endpoint that needs benchmarking and may require either optimization or explicit sequential scheduling.
- `web/pages/api/v1/sustainability/rebuild-score.ts` - Batch-style sustainability endpoint that should follow the shared timing/reporting contract.
- `web/pages/api/v1/sustainability/rebuild-trend-bands.ts` - Another batch-capable endpoint that should be classified and timed in the audit pass.
- `web/lib/sustainability/resolveSeasonId.ts` - Shared helper for static cron-safe season resolution and a likely pattern reference for other cron-safe route work.
- `web/pages/api/v1/db/update-nst-gamelog.ts` - Representative NST-touching job that must be classified for spacing, rate-limit safety, and benchmark behavior.
- `web/pages/api/Teams/nst-team-stats.ts` - Scheduled NST team scraper used by the team-table cron entries and a key source for direct NST rate-limit classification.
- `web/pages/api/v1/db/update-nst-current-season.ts` - NST-heavy route likely relevant to local/dev audit constraints and spacing analysis.
- `web/pages/api/v1/db/update-nst-team-daily.ts` - NST-touching scheduled route that should be included in the NST safety classification.
- `web/pages/api/v1/db/update-nst-goalies.ts` - NST-related scheduled route likely needing spacing and timing analysis.
- `web/lib/power-ratings.ts` - Helper used by the team-power cron routes; reads NST-backed team gamelog tables.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Rolling-player helper that reads NST gamelog tables and makes the rolling cron job NST-derived rather than NST-direct.
- `web/lib/sustainability/priors.ts` - Sustainability helper that reads `player_totals_unified` NST-backed fields.
- `web/lib/sustainability/windows.ts` - Sustainability helper that reads `player_stats_unified` NST-backed fields.
- `web/lib/sustainability/score.ts` - Sustainability helper that reads NST-backed unified views.
- `web/lib/sustainability/bandService.ts` - Trend-band helper that reads NST-backed unified views.
- `web/pages/api/v1/db/update-rolling-player-averages.ts` - Long-running data job that should expose the shared MMSS timing contract and be measured for schedule tightening.
- `web/pages/api/v1/db/run-projection-v2.ts` - Downstream FORGE projection job whose runtime and dependency position directly affect schedule redesign.
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - Derived-data builder that should be benchmarked and sequenced relative to ingestion and projection jobs.
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - Ingestion job that should be timed and dependency-mapped in the benchmark pass.
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - Projection job that should be benchmarked and checked for schedule fit and stale-data impact.
- `web/pages/api/v1/db/update-start-chart-projections.ts` - Downstream projection consumer that should be included in dependency and timing analysis.
- `web/pages/api/internal/sync-yahoo-players-to-sheet.ts` - Scheduled external side-effect route that writes to Google Sheets and should not be benchmarked blindly in local/dev.
- `web/pages/api/v1/ml/update-predictions-sko.ts` - Scheduled prediction builder with no current route-level timing surface and likely benchmark-runner handling needs.
- `web/pages/api/v1/db/cron-audit-runner.ts` - Likely new route or orchestrator for running the local/dev audit flow if an API-driven runner is chosen.
- `scripts/cron-audit-runner.ts` - Likely new script if the benchmark runner is implemented as a script instead of an API endpoint.
- `web/lib/cron/` - Likely home for shared cron inventory parsing, timing helpers, NST classification metadata, and audit result normalization.
- `web/lib/cron/formatDuration.ts` - Likely new shared helper to standardize milliseconds plus MMSS display formatting across endpoints and reports.
- `web/lib/cron/cronInventory.ts` - Likely new module to derive the scheduled job inventory from `cron-schedule.md` in a reusable way.
- `web/lib/cron/nstClassification.ts` - Shared NST classification helper for direct, indirect, unknown, and non-NST scheduled jobs.
- `web/lib/cron/nstClassification.test.ts` - Tests for NST job classification and direct-vs-indirect detection.
- `web/lib/cron/benchmarkNotes.ts` - Likely new module or data file for storing per-job observations, bottlenecks, and optimization denotations.
- `web/__tests__/pages/api/v1/db/cron-report.test.ts` - Tests for the cron report endpoint after timing and warning logic changes.
- `web/__tests__/components/CronReportEmail/CronReportEmail.test.tsx` - Tests for the daily cron report rendering of MMSS durations and optimization warnings.
- `web/__tests__/components/CronReportEmail/CronAuditEmail.test.tsx` - Tests for the audit email rendering of richer timing and benchmark notes.
- `web/__tests__/lib/cron/cronInventory.test.ts` - Tests for parsing and normalizing the cron inventory from the schedule file.
- `web/__tests__/lib/cron/formatDuration.test.ts` - Tests for the shared MMSS formatting helper.
- `web/__tests__/lib/cron/nstClassification.test.ts` - Tests for NST job classification and spacing metadata.
- `web/lib/cron/sqlTiming.test.ts` - Tests for normalizing SQL-only pg_cron timing into the shared timing contract.

### Notes

- Unit tests should typically be placed alongside the code files they cover.
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.
- The benchmark runner should prefer local/dev execution, but the task list should explicitly note where production-only dependencies prevent a local run.
- SQL-only scheduled jobs need the same audit visibility as HTTP jobs even if they are executed through a different mechanism.

## Tasks

- [x] 1.0 Inventory and classify every scheduled cron job from `web/rules/cron-schedule.md`
  - [x] 1.1 Parse every scheduled entry in `web/rules/cron-schedule.md` and build a normalized inventory of job name, time slot, method, URL or SQL body, and dependency position.
  - [x] 1.2 Mark each inventory item as one of: HTTP route, SQL-only job, wrapper-dependent job, or currently non-runnable in local/dev.
  - [x] 1.3 Classify which jobs touch Natural Stat Trick directly or indirectly by inspecting the route implementations instead of relying only on route names.
  - [x] 1.4 Document dependency order between ingestion, materialized-view refreshes, downstream projection jobs, sustainability jobs, and final reporting.
  - [x] 1.5 Record which jobs have existing duration data, which jobs return JSON, and which jobs currently lack a reliable timing surface.
  - [x] 1.6 Produce a first-pass list of likely bottlenecks, stale-data-sensitive jobs, and jobs that may need special handling in the benchmark runner.

- [x] 2.0 Add standardized timing instrumentation for cron endpoints and auditable jobs
  - [x] 2.1 Define a shared timing contract that includes start time, end time, raw duration in milliseconds, and a human-readable `MMSS` string.
  - [x] 2.2 Implement a shared helper for duration formatting so endpoints and reports do not each invent their own `MMSS` formatting logic.
  - [x] 2.3 Update representative cron endpoints to adopt the shared response contract without breaking existing clients or cron consumers.
  - [x] 2.4 Define how SQL-only scheduled jobs will emit comparable timing data even though they do not naturally return JSON payloads.
  - [x] 2.5 Ensure failure responses can still surface useful timing or partial-run timing context when a job errors after doing work.
  - [x] 2.6 Add tests for the shared timing helper and any timing-aware response normalization logic.

- [x] 3.0 Extend cron reporting and email output for benchmark visibility
  - [x] 3.1 Update `web/pages/api/v1/db/cron-report.ts` to ingest the richer timing contract and preserve existing success/failure and rows-affected metrics.
  - [x] 3.2 Add slow-job denotations for anything over 4 minutes 30 seconds and make those warnings visible in the report summary.
  - [x] 3.3 Add support for bottleneck notes, missing-observation warnings, and benchmark annotations to the report payload.
  - [x] 3.4 Update `web/components/CronReportEmail/CronReportEmail.tsx` to render the new timing and optimization signals clearly.
  - [x] 3.5 Update `web/components/CronReportEmail/CronAuditEmail.tsx` to render the same benchmark and optimization signals in the audit-oriented view.
  - [x] 3.6 Add tests covering MMSS rendering, slow-job warnings, missing observations, and optimization denotations in both email surfaces and the API response.

- [x] 4.0 Build the benchmark runner and audit capture workflow
  - [x] 4.1 Choose the benchmark execution shape: script, API endpoint, or a small shared runner that can be invoked by either.
  - [x] 4.2 Implement chronological execution from earliest to latest using the normalized inventory from `web/rules/cron-schedule.md`.
  - [x] 4.3 Add support for both HTTP jobs and SQL-only jobs so the benchmark run can treat the whole schedule as one ordered workflow.
  - [x] 4.4 Capture per-job observations including duration, success/failure, MMSS timer, touched systems, notes, and whether the job could be run locally.
  - [x] 4.5 Ensure the runner does not impose a hard per-job duration limit during the audit pass, so true completion time can be observed.
  - [x] 4.6 Add a documented skip or fallback mechanism for jobs that cannot safely run in local/dev because of production-only dependencies or side effects.
  - [x] 4.7 Store or emit benchmark results in a format that `cron-report.ts` can consume consistently.

- [ ] 5.0 Run the audit and evaluate bottlenecks, NST safety, and batch-loop strategy
  - [ ] 5.1 Run the full benchmark sequence locally/dev where possible and capture completion notes for every scheduled job.
  - [ ] 5.2 Measure which jobs consistently finish quickly enough to justify 1-minute or 2-minute spacing instead of 5-minute spacing.
  - [ ] 5.3 Flag every job exceeding 4 minutes 30 seconds and record an optimization denotation plus a short explanation of the likely cause.
  - [ ] 5.4 Evaluate every NST-touching job against the published request caps and determine whether current or proposed spacing is safe.
  - [ ] 5.5 For jobs with internal loops or offsets, decide whether they should be optimized into one cron-safe call or split into explicit sequential URLs.
  - [ ] 5.6 Write down concrete bottlenecks, dependency risks, missing telemetry gaps, and jobs that should not be packed tightly despite short runtimes.

- [ ] 6.0 Redesign `web/rules/cron-schedule.md` using measured results
  - [ ] 6.1 Move the start of the daily schedule so the first cron job runs no earlier than 3:00 AM EST.
  - [ ] 6.2 Reorder or tighten short-running jobs so the schedule runs a tighter sequence without violating dependencies.
  - [ ] 6.3 Preserve or increase spacing around NST-touching jobs, preferring at least 15 minutes between them unless internal throttling evidence supports an exception.
  - [ ] 6.4 Add explicit sequential URLs for offset-based jobs when optimization under 4 minutes 30 seconds is not feasible.
  - [ ] 6.5 Ensure `cron-report` is scheduled after every other daily job has completed.
  - [ ] 6.6 Update the timeline summary and the detailed cron blocks in `web/rules/cron-schedule.md` so the documented schedule matches the measured redesign exactly.
