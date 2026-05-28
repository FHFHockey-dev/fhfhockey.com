## Relevant Files

- `web/rules/context/cron-schedule.md` - Source-of-truth schedule inventory, SQL itinerary, and active/retired job status.
- `web/pages/api/v1/db/cron-report.ts` - Builds scheduled job matching, audit summaries, missing-run detection, and both email payloads.
- `web/components/CronReportEmail/CronAuditEmail.tsx` - CEO-style audit briefing email presentation.
- `web/components/CronReportEmail/CronReportEmail.tsx` - Job-status email presentation and noise controls.
- `web/lib/cron/cronInventory.ts` - Shared parser for schedule inventory and SQL route extraction.
- `web/lib/cron/withCronJobAudit.ts` - Shared audit wrapper for routes that should write `cron_job_audit`.
- `web/pages/api/v1/db/update-line-combinations/index.ts` - Failing line-combination route.
- `web/pages/api/v1/db/run-projection-v2.ts` - Failing projection execution route.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Projection accuracy route blocked by projection freshness.
- `web/pages/api/v1/db/update-sko-stats.ts` - Failing sKO stats route with schema mismatch.
- `web/pages/api/v1/db/update-power-rankings.ts` - Disabled legacy route that is still scheduled.
- `web/pages/api/v1/db/update-shifts.ts` - Shift chart wrapper route that needs production audit coverage after deploy.
- `web/pages/api/v1/db/update-standings-details/index.ts` - Cron-invoked route reported without audit payload.
- `web/pages/api/v1/db/update-nst-goalies.ts` - Cron-invoked NST route reported without audit payload.
- `web/pages/api/v1/db/update-nst-current-season.ts` - Cron-invoked NST route reported without audit payload.
- `web/pages/api/v1/db/update-nst-team-daily.ts` - Cron-invoked NST route reported without audit payload.
- `web/pages/api/v1/db/update-season-stats.ts` - Cron-invoked route reported without audit payload.
- `web/pages/api/v1/db/update-rolling-games.ts` - Cron-invoked route reported without audit payload.
- `web/pages/api/internal/sync-yahoo-players-to-sheet.ts` - Side-effect route reported without audit payload.
- `web/__tests__/pages/api/v1/db/cron-report.test.ts` - Tests for schedule parsing, matching, summary counts, and email payloads.
- `web/__tests__/components/CronReportEmail/CronAuditEmail.test.tsx` - Tests for the CEO briefing email.
- `web/__tests__/components/CronReportEmail/CronReportEmail.test.tsx` - Tests for the job-status email.
- `tasks/artifacts/cron-supabase-export-latest.json` - Latest read-only export of production Supabase `cron.job` plus latest run metadata.
- `tasks/artifacts/cron-supabase-export-2026-05-27T20-31-24Z.json` - Timestamped production cron export from task 1.1.
- `tasks/artifacts/cron-supabase-export-2026-05-27T20-31-24Z.md` - Human-readable production cron export from task 1.1.

### Notes

- Test command: `cd web && npm test -- --run __tests__/pages/api/v1/db/cron-report.test.ts __tests__/components/CronReportEmail/CronAuditEmail.test.tsx __tests__/components/CronReportEmail/CronReportEmail.test.tsx`.
- Type-check command: `cd web && npx tsc --noEmit --pretty false --skipLibCheck --incremental false`.
- Current type-check is blocked by pre-existing `scripts/analyze-tweet-news-phrases.ts` Supabase generic type errors; targeted cron/email tests pass.
- Do not blindly wrap routes that already insert into `cron_job_audit`; duplicate audit rows will make the emails noisier.
- Treat the Supabase `cron.job` itinerary as the production source of truth. Sync `web/rules/context/cron-schedule.md` only after confirming the active Supabase schedule.

## Failure Inventory

- `update-line-combinations-all` is failing with HTTP 500 because stale playoff game IDs return NHL Gamecenter 404s.
- `run-forge-projection-v2` is failing with HTTP 422 and blocks downstream projection freshness.
- `run-projection-accuracy` is failing with HTTP 422 because projection freshness depends on a successful projection run.
- `update-sko-stats-full-season` is failing with HTTP 400 because `sko_skater_stats` is missing the expected `assists_per_game` column.
- `update-power-rankings` is scheduled but intentionally disabled with HTTP 410.
- Missing schedule observations: `update-teams-job`, `update-seasons-job`, `update-players-job`, `update-games-job`, `daily-refresh-nstwgo-matview`, `update-team-power-ratings-new`, `update-start-chart-projections`, `update-nhl-xg-shot-features`, `update-nhl-xg-shot-predictions`, `rebuild-sustainability-window-z`, `rebuild-sustainability-score`, and `rebuild-sustainability-trend-bands`.
- Cron/audit gaps: `update-shift-charts`, `update-standings-details`, `update-nst-goalies`, `update-nst-current-season`, `sync-yahoo-players-to-sheet`, `update-nst-team-daily`, `update-season-stats-current-season`, `update-rolling-games-recent`, and `daily-cron-report` have cron observations without reliable audit payloads.
- `update-nst-gamelog` reports `UNKNOWN` because its audit row does not provide reliable status and timing metadata.
- Partial row failures remain on otherwise successful jobs: `update-all-wgo-skaters`, `update-power-play-combinations`, `update-nst-tables-all`, `update-nhl-edge-stats`, `update-goalie-projections-v2`, `update-player-underlying-stats-yesterday`, and `build-forge-derived-v2`.
- The email still over-reports non-executive details: missing retired jobs are mixed with real failures, repeated benchmark notes dominate rows, `Last Success` is blank for several failures, and many upsert counts are wrapper row counts rather than domain row counts.
- Production schedule timing still needs application: the intended local schedule now puts `daily-cron-report` at `21:15 UTC`, after the final `update-pbp` job at `20:51 UTC`, but Supabase still needs an approved schedule update.

## Tasks

- [ ] 1.0 Reconcile the production cron schedule with local schedule inventory
  - [x] 1.1 Query Supabase `cron.job` and `cron.job_run_details` to export the active job list, command text, schedule, active status, and latest run metadata.
  - [x] 1.2 Update `web/rules/context/cron-schedule.md` so the JSON inventory and SQL itinerary agree with the intended production-based schedule.
  - [x] 1.3 Mark retired or intentionally disabled jobs inactive, including `update-power-rankings`, `update-start-chart-projections`, and obsolete materialized-view placeholders.
  - [x] 1.4 Define `daily-cron-report` as the final daily job at `21:15 UTC`, after `update-pbp` at `20:51 UTC`, in the local schedule docs.
  - [x] 1.5 Add or correct route aliases for jobs whose production job names differ from API audit names.
  - [ ] 1.6 Apply the approved schedule changes to Supabase `cron.job`, including moving `daily-cron-report` from `13:00 UTC` to `21:15 UTC`.

- [ ] 2.0 Fix hard route failures
  - [ ] 2.1 Update `update-line-combinations` to skip or quarantine Gamecenter 404s for stale playoff game IDs instead of failing the whole scheduled job.
  - [ ] 2.2 Add a bounded retry/quarantine summary for line-combination failed games so the email shows actionable IDs without huge repeated error text.
  - [ ] 2.3 Fix `update-sko-stats` by reconciling the route payload with the current `sko_skater_stats` schema or adding the missing `assists_per_game` migration if that column is still required.
  - [ ] 2.4 Fix `run-forge-projection-v2` preflight/data dependency failures so the route can produce a successful current-date projection run.
  - [ ] 2.5 Re-run `run-projection-accuracy` after projection execution succeeds and confirm it no longer fails on freshness.
  - [ ] 2.6 Remove or replace the scheduled `update-power-rankings` job since the loader returns intentional HTTP 410.

- [ ] 3.0 Resolve missing scheduled observations
  - [ ] 3.1 Determine whether missing SQL jobs actually ran outside the 24-hour window, were inactive in Supabase, or are only stale local inventory entries.
  - [ ] 3.2 Remove inactive stale jobs from the active JSON inventory or reschedule them in Supabase if they are still required.
  - [ ] 3.3 Fix matching for SQL-only jobs so materialized-view refreshes are matched by SQL text and job name, not treated as missing when command text differs slightly.
  - [ ] 3.4 Add explicit schedule aliases for `update-nhl-xg-shot-features` and `update-nhl-xg-shot-predictions` so recent successful manual runs do not mask missing scheduled runs.
  - [ ] 3.5 Decide whether full `rebuild-sustainability-*` jobs should remain scheduled as monolithic jobs or be represented only by their batch jobs.

- [ ] 4.0 Close audit payload gaps
  - [ ] 4.1 Deploy the `update-shifts` audit wrapper change and verify the next scheduled run writes a `cron_job_audit` row.
  - [ ] 4.2 Inspect `update-standings-details`, `update-nst-goalies`, `update-nst-current-season`, `update-nst-team-daily`, `update-season-stats`, `update-rolling-games`, `sync-yahoo-players-to-sheet`, and `daily-cron-report` to confirm whether wrappers are missing, not deployed, or not capturing responses.
  - [ ] 4.3 Normalize manual audit inserts to include `method`, `url`, `statusCode`, `durationMs`, `response`, `rowsUpserted`, `failedRows`, and concise `error`.
  - [ ] 4.4 Fix `update-nst-gamelog` so its audit row uses `success` or `failure`, includes timing metadata, and avoids `UNKNOWN` unless status truly cannot be determined.
  - [ ] 4.5 Add tests or route-level assertions for every scheduled API route that should write `cron_job_audit`.

- [ ] 5.0 Fix partial row failures and row-count quality
  - [ ] 5.1 Investigate the two failed `update-all-wgo-skaters` dates and determine whether they are expected no-game dates, source failures, or real transform errors.
  - [ ] 5.2 Investigate `update-power-play-combinations` failed rows for skipped pregame games and classify expected skips separately from row errors.
  - [ ] 5.3 Investigate `update-nst-tables-all` and `update-nst-team-stats-all` 100 failed rows and determine whether the route is reporting skipped backlog dates as failures.
  - [ ] 5.4 Investigate `update-nhl-edge-stats` failed metric families and add per-family failure reasons.
  - [ ] 5.5 Investigate `update-goalie-projections-v2` failed downstream routes and distinguish dashboard refresh warnings from failed database upserts.
  - [ ] 5.6 Investigate `build-forge-derived-v2` 30 failed rows and decide whether they are acceptable warnings, skipped dates, or true failed writes.
  - [ ] 5.7 Ensure each route reports true domain rows upserted instead of wrapper/audit-row counts.

- [ ] 6.0 Improve CEO briefing signal-to-noise
  - [ ] 6.1 Split the audit email into sections: critical failures, missing required jobs, audit gaps, partial successes, and successful jobs.
  - [ ] 6.2 Hide successful jobs by default unless they have row failures, audit gaps, slow runtime, or missing freshness.
  - [ ] 6.3 Show `Last Success` for failures by looking back beyond the current 24-hour window when needed.
  - [ ] 6.4 Collapse repeated benchmark notes into short tags plus one-line remediation hints.
  - [ ] 6.5 Make the job-status email focus on schedule health and remove duplicate detail already shown in the CEO briefing.
  - [ ] 6.6 Add a `?dryRun=true` or `?preview=json` mode to `cron-report` for testing email payloads without sending Resend emails.

- [ ] 7.0 Verify end-to-end
  - [ ] 7.1 Add focused tests for schedule parser path coverage, route alias matching, SQL job matching, and stale inactive job exclusion.
  - [ ] 7.2 Add component tests for the new CEO briefing sections and hidden-success behavior.
  - [ ] 7.3 Run the targeted Vitest suite and TypeScript check.
  - [ ] 7.4 Send a preview or controlled test email and confirm the report lists only actionable failures and gaps.
  - [ ] 7.5 After deployment, verify the next morning report shows zero false missing jobs, zero false audit gaps, and only real route/data failures.
