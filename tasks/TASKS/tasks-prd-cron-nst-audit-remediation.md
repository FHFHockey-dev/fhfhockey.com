## Relevant Files

- `web/pages/api/v1/db/cron-report.ts` - Daily cron summary route that correlates scheduled jobs, audit rows, and email output.
- `web/components/CronReportEmail/CronReportEmail.tsx` - Primary daily cron summary email template.
- `web/components/CronReportEmail/CronAuditEmail.tsx` - Audit-focused email template for raw audit run reporting.
- `web/lib/cron/withCronJobAudit.ts` - Shared audit wrapper that currently infers success and failure state for cron routes.
- `web/lib/cron/timingContract.ts` - Shared timing envelope utilities used by cron responses and audit rows.
- `web/lib/cron/cronReportTiming.ts` - Timing extraction logic used by the report when reading audit details.
- `web/lib/cron/benchmarkNotes.ts` - Benchmark annotations shown in the cron emails and report tables.
- `web/pages/api/v1/db/update-nst-gamelog.ts` - NST gamelog route and a likely missing-wrapper migration target.
- `web/pages/api/v1/db/update-nst-current-season.ts` - Current-season NST route that must use the new authenticated NST host.
- `web/pages/api/v1/db/update-nst-last-ten.ts` - NST route that must be migrated to the new authenticated host.
- `web/pages/api/v1/db/update-nst-goalies.ts` - NST goalie route that must be migrated and verified.
- `web/pages/api/v1/db/update-nst-team-daily.ts` - NST team-daily route tied to missing-audit observations in the cron report.
- `web/pages/api/v1/db/update-nst-player-reports.ts` - NST player report route that must share the new host and auth flow.
- `web/pages/api/v1/db/check-missing-goalie-data.ts` - NST-backed helper route that must share the new host and auth flow.
- `web/pages/api/Teams/nst-team-stats.ts` - Team stats route behind `update-nst-tables-all` and `update-nst-team-stats-all`.
- `web/pages/api/v1/db/shift-charts.ts` - Cron-scheduled Supabase-writing route with bespoke audit insertion that needs normalization.
- `web/pages/api/v1/db/update-season-stats.ts` - Scoped Supabase-writing cron route that appeared as a missing-audit case.
- `web/pages/api/v1/db/update-rolling-games.ts` - Scoped Supabase-writing cron route that appeared as a missing-audit case and had a recent runtime failure.
- `web/pages/api/v1/db/cron/update-stats-cron.ts` - Repeated audit failure source that likely needs partial-success classification changes.
- `web/pages/api/v1/db/update-line-combinations/index.ts` - Repeated audit noise source during live-game processing.
- `web/pages/api/v1/db/update-standings-details/index.ts` - Live failing route with NHL API `429` behavior to triage.
- `web/pages/api/v1/db/run-projection-v2.ts` - Live failing route with `422` preflight or pipeline validation behavior.
- `web/pages/api/v1/db/update-sko-stats.ts` - Live failing route with the `assists_5v5` schema mismatch.
- `web/pages/api/v1/db/update-power-rankings.ts` - Live failing route with the `(void 0) is not a function` runtime error.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Live failing downstream route that depends on a succeeded projection run.
- `web/lib/cron/withCronJobAudit.test.ts` - Unit tests for audit status inference and structured partial-success handling.
- `web/pages/api/v1/db/cron-report.test.ts` - Tests for route-to-job matching, missing-audit handling, and report classification.
- `web/pages/api/v1/db/update-nst-gamelog.test.ts` - Tests for NST configuration failure and authenticated-host usage.
- `web/pages/api/Teams/nst-team-stats.test.ts` - Tests for NST team-stats host migration and audit/report compatibility.

### Notes

- Unit tests should typically be placed alongside the code files they are testing.
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.
- The NST key is not yet available, so task sequencing should separate configuration-failure validation from authenticated live-route validation.

## Tasks

- [ ] 1.0 Build the remediation baseline from the March 29 and March 31, 2026 cron emails and map every scoped issue to its owning route, audit source, and failure category.
- [ ] 2.0 Migrate all scoped NST routes to the new authenticated `data.naturalstattrick.com` integration with fail-fast configuration handling and secret-safe logging.
- [ ] 3.0 Normalize audit production and cron-report correlation for cron-scheduled Supabase-writing routes so missing-audit and false-failure cases are eliminated.
- [ ] 4.0 Fix the live non-NST application failures and partial-success classification problems that currently prevent a clean cron health report.
- [ ] 5.0 Re-run targeted route validation and the end-to-end cron email process, then confirm the post-remediation report is accurate and stable.
