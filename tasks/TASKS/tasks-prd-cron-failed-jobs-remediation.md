## Relevant Files

- `tasks/prd-cron-failed-jobs-remediation.md` - PRD describing the failed-job remediation scope and NST constraints.
- `tasks/tasks-prd-cron-failed-jobs-remediation.md` - Execution checklist for this remediation effort.
- `tasks/artifacts/cron-benchmark-run-latest.md` - Human-readable benchmark source for the failed jobs list, timers, and error summaries.
- `tasks/artifacts/cron-benchmark-run-latest.json` - Structured benchmark payload for grouping failures by route and failure mode.
- `tasks/artifacts/cron-failed-jobs-inventory.md` - Normalized failed-job inventory grouped by failure category and primary failure surface.
- `tasks/artifacts/cron-rolling-player-failure-analysis.md` - Root-cause analysis for the two `update-rolling-player-averages` failures and why their surfaces differ.
- `tasks/artifacts/cron-forge-projection-failure-analysis.md` - Root-cause matrix for the failed FORGE/projection-chain jobs, separating route timeouts from stale-data and transport failures.
- `tasks/artifacts/cron-sql-refresh-failure-analysis.md` - Classification of the failed SQL-backed refresh jobs, showing RPC transport failures versus downstream consumer impact.
- `tasks/artifacts/cron-sql-refresh-execution-paths.md` - Distinguishes benchmark RPC SQL failures from direct pg_cron SQL execution and records the per-job remediation determination for the SQL refresh cluster.
- `tasks/artifacts/cron-downstream-failure-dependencies.md` - Direct dependency mapping for the remaining failed downstream routes, including sustainability and ML jobs.
- `tasks/artifacts/cron-failed-jobs-root-cause-matrix.md` - Consolidated matrix mapping every failed job to root cause, dependent systems, proposed fix type, and validation path.
- `tasks/artifacts/cron-audit-findings.md` - Existing bottleneck and dependency-risk findings that should guide remediation order.
- `web/rules/context/cron-schedule.md` - Current cron ordering and slot assignments that may need adjustment after fixes.
- `web/vercel.json` - Vercel Cron entrypoint schedule for production cron invocations.
- `web/lib/cron/cronInventory.ts` - Cron schedule parser used by reports and alignment checks.
- `web/lib/cron/cronInventory.test.ts` - Coverage for SQL-block and JSON inventory parsing.
- `web/scripts/cron-audit-runner.ts` - Benchmark script used to re-run targeted validation after fixes.
- `web/pages/api/v1/db/update-rolling-player-averages.ts` - Failing rolling metrics route used by both the `GET` and `POST` cron jobs.
- `web/__tests__/pages/api/v1/db/update-rolling-player-averages.test.ts` - Tests for rolling-player endpoint behavior and failure handling.
- `web/pages/api/v1/db/update-nst-goalies.ts` - Failed NST goalie ingestion route with bounded URL logic and potential burst-mode changes.
- `web/pages/api/v1/db/update-nst-gamelog.ts` - Existing NST route with known per-date URL counts and pacing behavior, useful as a reference.
- `web/pages/api/v1/db/update-nst-team-daily.ts` - Failed NST team-daily route and incremental variant.
- `web/pages/api/v1/db/update-nst-current-season.ts` - NST route with currently weak pacing guarantees; relevant for consistent burst logic.
- `web/pages/api/Teams/nst-team-stats.ts` - NST team stats route used by both `update-nst-tables-all` and `update-nst-team-stats-all`.
- `web/pages/api/v1/db/calculate-wigo-stats.ts` - Failed WIGO table stats route reading NST-backed data.
- `web/pages/api/v1/db/update-start-chart-projections.ts` - Failed start-chart builder in the FORGE chain.
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - Failed projection-ingest route with existing timing instrumentation.
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - Failed derived-table builder in the FORGE chain.
- `web/pages/api/v1/db/run-projection-v2.ts` - Failed FORGE projection executor with strict preflight gates.
- `web/lib/projections/runProjectionV2.test.ts` - Existing projection test coverage that should expand with remediation.
- `web/pages/api/v1/db/update-season-stats.ts` - Failed season stats route surfacing upstream HTML through nested dependency lookups.
- `web/pages/api/v1/db/update-rolling-games.ts` - Failed rolling games route with `require is not a function`.
- `web/pages/api/v1/db/update-sko-stats.ts` - Failed SKO stats route with upstream dependency failure handling.
- `web/__tests__/pages/api/v1/db/update-sko-stats.test.ts` - Tests for the SKO stats endpoint.
- `web/pages/api/v1/db/update-wgo-averages.ts` - Failed WGO averages route reading NST seasonal tables.
- `web/pages/api/v1/db/sustainability/rebuild-baselines.ts` - Failed sustainability baseline rebuild route.
- `web/pages/api/v1/sustainability/rebuild-priors.ts` - Failed priors rebuild route.
- `web/pages/api/v1/sustainability/rebuild-window-z.ts` - Failed window-z rebuild route, now also relevant for explicit batch behavior.
- `web/pages/api/v1/sustainability/rebuild-score.ts` - Failed score rebuild route, now also relevant for explicit batch behavior.
- `web/pages/api/v1/sustainability/rebuild-trend-bands.ts` - Failed trend-band rebuild route, now also relevant for explicit batch behavior.
- `web/lib/sustainability/` - Shared sustainability logic and data loaders behind the failed rebuild routes.
- `web/pages/api/v1/ml/update-predictions-sko.ts` - Failed downstream ML prediction refresh job.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Failed projection accuracy route at the end of the schedule.
- `web/pages/api/v1/db/cron-report.ts` - Reporting route that should surface cleaner failure summaries after remediation.
- `web/lib/cron/benchmarkNotes.ts` - Benchmark annotations that may need updates once root causes are known.
- `web/lib/cron/benchmarkRunner.ts` - Benchmark runner core used to verify post-fix outcomes.
- `web/lib/cron/withCronJobAudit.ts` - Shared audit wrapper that can preserve richer error details after fixes.

### Notes

- Unit tests should typically be placed alongside the code files they are testing or in the existing `__tests__` locations already used by this repo.
- Use `npm run test:full` from `web/` for parent-task closeout validation. Targeted `vitest` runs are appropriate while iterating on a failure cluster.
- SQL-backed jobs should be validated both for query correctness and for how their failures surface through the Supabase RPC path, since several benchmark failures returned Cloudflare HTML instead of structured JSON.
- NST changes must preserve all published limits: `40/1m`, `80/5m`, `100/15m`, and `180/1h`.

## Tasks

- [x] 1.0 Classify every failed cron job by failure mode and identify the concrete root cause in code, SQL, or infrastructure.
  - [x] 1.1 Build a normalized failed-jobs inventory from `tasks/artifacts/cron-benchmark-run-latest.md` and `tasks/artifacts/cron-benchmark-run-latest.json` that groups failures into categories such as application error, timeout, fetch failure, SQL/RPC failure, and upstream HTML failure.
  - [x] 1.2 Trace the two `update-rolling-player-averages` failures separately and determine whether the `GET` timeout and the `POST` fetch failure share the same root cause or represent different execution modes breaking for different reasons.
  - [x] 1.3 Trace every failed FORGE/projection-chain job (`update-start-chart-projections`, `ingest-projection-inputs`, `build-projection-derived-v2`, `run-projection-v2`, `run-projection-accuracy`) and document whether each failure is caused by upstream stale data, route timeout, infrastructure instability, or code defects.
  - [x] 1.4 Trace every failed SQL-backed or data-refresh job (`goalie_stats_unified`, `yahoo_nhl_player_map_mat`, `player_totals_unified`, `refresh_team_power_ratings(...)`) and determine whether the benchmark failures originated in SQL execution, Supabase RPC transport, or downstream consumers of those views.
  - [x] 1.5 Trace the remaining failed downstream routes (`calculate-wigo-stats`, `update-season-stats`, `update-rolling-games`, `update-sko-stats`, `update-wgo-averages`, `update-predictions-sko`, sustainability rebuild routes) and capture the direct failing dependency for each.
  - [x] 1.6 Produce a concise root-cause matrix artifact that maps each failed job to: root cause, dependent systems, proposed fix type, and required validation path.

- [x] 2.0 Fix the rolling, FORGE, and projection-pipeline jobs that failed due to timeouts, fetch failures, or application defects.
  - [x] 2.1 Repair `update-rolling-player-averages` so both the `GET` and `POST` cron paths complete reliably, including reviewing concurrency defaults, timeout behavior, and any broad-sweep execution profile assumptions.
  - [x] 2.2 Fix `update-start-chart-projections` by identifying whether its failure is caused by missing prerequisites, oversized single-request work, or transport/runtime budgeting, then implement the appropriate guard or chunking change.
  - [x] 2.3 Fix `ingest-projection-inputs` so it surfaces actionable progress/failure information and can complete without collapsing into `fetch failed` at the route boundary.
  - [x] 2.4 Fix `build-projection-derived-v2` so derived-table orchestration is resilient to backlog size and no longer fails silently at the timeout boundary.
  - [x] 2.5 Fix `run-projection-v2` and `run-projection-accuracy` by addressing whichever preflight or dependency failures were surfaced in the root-cause pass, while preserving audit timing and machine-readable error context.
  - [x] 2.6 Add or update focused tests for the repaired rolling and FORGE/projection routes so the specific benchmark failure modes are covered by regression tests.

- [x] 3.0 Fix the SQL-backed refresh and downstream data-consumer jobs that failed due to Supabase/Cloudflare HTML failures or stale dependency chains.
  - [x] 3.1 Investigate the failing SQL-backed refresh jobs and determine whether they need query changes, RPC retry/error normalization, workload reduction, or schedule-aware dependency protection.
  - [x] 3.2 Fix `calculate-wigo-stats`, `update-season-stats`, `update-sko-stats`, and `update-wgo-averages` so upstream table or view failures are surfaced as structured operator-usable errors instead of leaking raw HTML pages through nested exceptions.
  - [x] 3.3 Fix `update-rolling-games` and `update-power-rankings` by resolving the `require is not a function` defect and adding regression coverage for the runtime/module-loading path.
  - [x] 3.4 Fix the sustainability chain (`rebuild-baselines`, `rebuild-priors`, `rebuild-window-z`, `rebuild-score`, `rebuild-trend-bands`) so it handles missing upstream refreshes and Supabase failures cleanly, and succeeds once prerequisites are healthy.
  - [x] 3.5 Fix `update-predictions-sko` so it degrades gracefully when unified-view dependencies are unavailable and succeeds once those dependencies are restored.
  - [x] 3.6 Add or update tests for the repaired SQL/data-consumer routes, focusing on structured error surfacing, dependency preconditions, and post-fix successful execution paths.

- [x] 4.0 Audit and harden every NST-touching failed route, including validating whether a compliant small-batch burst mode is available and safe.
  - [x] 4.1 Confirm the real per-date URL counts and current burst/timer behavior for `update-nst-goalies`, `update-nst-team-daily`, `update-nst-team-daily-incremental`, and `update-nst-team-stats-all`, including the “one or two days means no wait timer” branch where it exists.
  - [x] 4.2 Define a shared NST safety calculation or policy helper that can decide when burst mode is allowed while staying under all four published limits.
  - [x] 4.3 Repair `update-nst-goalies` so bounded small-batch runs can complete reliably, and only skip wait intervals when the URL count is safely below all rate-limit thresholds.
  - [x] 4.4 Repair `update-nst-team-daily` and the incremental variant using the same policy, ensuring that burst behavior is explicitly gated by URL-count math rather than implicit assumptions.
  - [x] 4.5 Audit `nst-team-stats` / `update-nst-team-stats-all` for the same burst-mode opportunity, confirm the real per-run URL count, and implement safe burst behavior if it is compliant.
  - [x] 4.6 Add or update tests around NST rate-limit policy, small-batch burst eligibility, and failure handling so the remediated routes cannot silently exceed the published limits.

- [x] 5.0 Re-run targeted validations for every remediated failure cluster, record outcomes, and update the benchmark artifacts with a clean failure-resolution summary.
  - [x] 5.1 Re-run targeted local/dev validation for the rolling and FORGE/projection cluster and record per-route outcomes, durations, and any remaining blockers.
  - [x] 5.2 Re-run targeted validation for the SQL-backed refresh and downstream consumer cluster and verify that failures, if any, now return structured operator-usable details instead of raw HTML bodies.
  - [x] 5.3 Re-run targeted validation for the NST cluster and verify that any burst-mode optimization remains compliant with all NST request limits while improving completion time where appropriate.
  - [x] 5.4 Update or create benchmark artifacts that summarize the failed-job remediation status in a clean readable format, including resolved jobs, still-blocked jobs, and jobs requiring infrastructure follow-up.
  - [x] 5.5 Reflect the remediation outcomes back into the cron notes/reporting surfaces if any benchmark annotations, optimization denotations, or route guidance changed materially after the fixes.
