## Relevant Files

- `tasks/TASKS/cron-operations/prd/prd-cron-nst-audit-remediation.md` - Shared PRD pairing this email-derived remediation list with the broader Cron/NST/audit initiative.
- `tasks/TASKS/cron-operations/cron-schedule.md` - Source-of-truth schedule inventory, SQL itinerary, and active/retired job status.
- `web/pages/api/v1/db/cron-report.ts` - Builds scheduled job matching, audit summaries, missing-run detection, and both email payloads.
- `web/components/CronReportEmail/CronAuditEmail.tsx` - CEO-style audit briefing email presentation.
- `web/components/CronReportEmail/CronReportEmail.tsx` - Job-status email presentation and noise controls.
- `web/lib/cron/cronInventory.ts` - Shared parser for schedule inventory and SQL route extraction.
- `web/lib/cron/withCronJobAudit.ts` - Shared audit wrapper for routes that should write `cron_job_audit`.
- `web/utils/adminOnlyMiddleware.ts` and `web/__tests__/utils/adminOnlyMiddleware.test.ts` - Existing admin/cron boundary and the pending fail-closed missing-secret regression required before protecting the season writer.
- `web/pages/api/internal/cron-auth-check.ts` and its focused test - Non-mutating value-free old/new bearer authorization proof endpoint for the P0 rotation sequence.
- `web/__tests__/pages/api/v1/db/cron-auth-boundaries.test.ts` - Focused production-mode proof that season and WGO writers reject unauthenticated/missing-secret calls and admit only the exact cron bearer or an authenticated admin.
- `web/lib/cron/cronAuditCoverage.ts` - Resolves active scheduled HTTP routes to Pages API files and freezes both audit ownership and current/target inbound-auth plus non-cron caller contracts.
- `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts` - Static regression gate proving every active scheduled HTTP route has an audit owner and an explicit auth/caller classification.
- `web/pages/api/v1/db/update-line-combinations/index.ts` - Failing line-combination route.
- `web/pages/api/v1/db/run-projection-v2.ts` - Failing projection execution route.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Projection accuracy route blocked by projection freshness.
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - FORGE derived builder with separate failed-stage, failed-row, and deferred-date contracts.
- `web/__tests__/pages/api/v1/db/build-projection-derived-v2.test.ts` - Covers bounded execution, resume/deferred dates, and stage-failure classification.
- `web/pages/api/v1/db/update-sko-stats.ts` - Failing sKO stats route with schema mismatch.
- `web/pages/api/v1/db/update-power-rankings.ts` - Disabled legacy route that is still scheduled.
- `web/pages/api/v1/db/update-nhl-edge-stats.ts` - NHL Edge ingestion route with endpoint-family-specific skip diagnostics for skaters, goalies, and teams.
- `web/__tests__/pages/api/v1/db/update-nhl-edge-stats.test.ts` - Focused diagnostic reason regression coverage.
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - Goalie projection writer with confirmed-row accounting and database-write failure separation.
- `web/__tests__/pages/api/v1/db/update-goalie-projections-v2.test.ts` - Verifies chunk success/failure accounting.
- `web/pages/api/v1/db/update-wgo-skaters.ts` - WGO skater refresh route with per-date skip/failure classification preserved through retries.
- `web/lib/cron/wgoDateOutcome.ts` - Typed WGO date outcome and bounded diagnostic summary contract.
- `web/lib/cron/wgoDateOutcome.test.ts` - Covers expected no-game skips, failure categories, reasons, and bounded samples.
- `web/pages/api/Teams/nst-team-stats.ts` - Shared NST team route with explicit deferred-date, empty-source skip, request-failure, and failed-row contracts.
- `web/lib/cron/nstTeamStatsOutcome.ts` - Builds bounded NST team audit diagnostics without treating backlog dates as failures.
- `web/lib/cron/nstTeamStatsOutcome.test.ts` - Verifies backlog/skip separation and bounded request-failure samples.
- `web/pages/api/v1/db/update-shifts.ts` - Shift chart wrapper route that needs production audit coverage after deploy.
- `web/pages/api/v1/db/update-standings-details/index.ts` - Cron-invoked route reported without audit payload.
- `web/pages/api/v1/db/update-nst-goalies.ts` - Cron-invoked NST route reported without audit payload.
- `web/pages/api/v1/db/update-nst-current-season.ts` - Cron-invoked NST route reported without audit payload.
- `web/pages/api/v1/db/update-nst-team-daily.ts` - Cron-invoked NST route reported without audit payload.
- `web/pages/api/v1/db/update-season-stats.ts` - Cron-invoked route reported without audit payload.
- `web/__tests__/pages/api/v1/db/update-season-stats.route.test.ts` - Route-level season/dynamic stats regressions, including the pending authorized inbound-auth contract.
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
- Current full TypeScript passes for the locally verified Cron/NST remediation; the earlier `scripts/analyze-tweet-news-phrases.ts` generic errors no longer reproduce in the current tree.
- Do not blindly wrap routes that already insert into `cron_job_audit`; duplicate audit rows will make the emails noisier.
- Treat the Supabase `cron.job` itinerary as the production source of truth. Sync `tasks/TASKS/cron-operations/cron-schedule.md` only after confirming the active Supabase schedule.

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
- Production schedule timing has been applied: the 2026-06-11 Supabase export shows `daily-cron-report` active at `15 21 * * *` (`21:15 UTC`) after `update-pbp` at `20:51 UTC`, and `update-power-rankings` inactive.

## Tasks

- [x] 1.0 Reconcile the production cron schedule with local schedule inventory
  - [x] 1.1 Query Supabase `cron.job` and `cron.job_run_details` to export the active job list, command text, schedule, active status, and latest run metadata.
  - [x] 1.2 Update `tasks/TASKS/cron-operations/cron-schedule.md` so the JSON inventory and SQL itinerary agree with the intended production-based schedule.
  - [x] 1.3 Mark retired or intentionally disabled jobs inactive, including `update-power-rankings`, `update-start-chart-projections`, and obsolete materialized-view placeholders.
  - [x] 1.4 Define `daily-cron-report` as the final daily job at `21:15 UTC`, after `update-pbp` at `20:51 UTC`, in the local schedule docs.
  - [x] 1.5 Add or correct route aliases for jobs whose production job names differ from API audit names.
  - [x] 1.6 Apply the approved schedule changes to Supabase `cron.job`, including moving `daily-cron-report` from `13:00 UTC` to `21:15 UTC`.
    - Verified by refreshed production export `tasks/artifacts/cron-supabase-export-2026-06-11T13-51-45Z.json`: `daily-cron-report` is `15 21 * * *`; `update-power-rankings` is inactive.

- [ ] 2.0 Fix hard route failures
  - [x] 2.1 Update `update-line-combinations` to skip or quarantine Gamecenter 404s for stale playoff game IDs instead of failing the whole scheduled job.
  - [x] 2.2 Add a bounded retry/quarantine summary for line-combination failed games so the email shows actionable IDs without huge repeated error text.
  - [x] 2.3 Fix `update-sko-stats` by reconciling the route payload with the current `sko_skater_stats` schema or adding the missing `assists_per_game` migration if that column is still required.
    - Production schema verification: `select column_name from information_schema.columns where table_schema='public' and table_name='sko_skater_stats' and column_name like '%per_game%' order by column_name;` currently returns only `pp_toi_pct_per_game`, so the route now strips unsupported NHL `scoringpergame` payload fields before upsert.
  - [ ] 2.4 Fix `run-forge-projection-v2` preflight/data dependency failures so the route can produce a successful current-date projection run.
    - BLOCKED (production data dependency / mutation): latest audit still fails `projection_input_ingest` (`pbp_coverage=0.64`, `pbp_games=7`, `shift_rows=229`). Do not run production mutation without deployment approval. Command after approval: `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "https://fhfhockey.com/api/v1/db/ingest-projection-inputs?startDate=2026-05-28&endDate=2026-06-10"` then `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "https://fhfhockey.com/api/v1/db/run-projection-v2?date=2026-06-11"`. Expected result: JSON `success: true` and a current `runId`. Verification query: `select job_name, run_time, status, details->>'statusCode' as status_code, details->>'response' as response from cron_job_audit where job_name='run-projection-v2' order by run_time desc limit 1;`.
  - [ ] 2.5 Re-run `run-projection-accuracy` after projection execution succeeds and confirm it no longer fails on freshness.
    - BLOCKED (depends on 2.4): after projection succeeds, run `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "https://fhfhockey.com/api/v1/db/run-projection-accuracy?projectionOffsetDays=0"`. Expected result: JSON `success: true`. Verification query: `select job_name, run_time, status, details->>'statusCode' as status_code, left(details->>'response', 500) from cron_job_audit where job_name='run-projection-accuracy' order by run_time desc limit 1;`.
  - [x] 2.6 Remove or replace the scheduled `update-power-rankings` job since the loader returns intentional HTTP 410.
    - Verified inactive in production export: job `330`, `update-power-rankings`, `active: false`.

- [x] 3.0 Resolve missing scheduled observations
  - [x] 3.1 Determine whether missing SQL jobs actually ran outside the 24-hour window, were inactive in Supabase, or are only stale local inventory entries.
  - [x] 3.2 Remove inactive stale jobs from the active JSON inventory or reschedule them in Supabase if they are still required.
  - [x] 3.3 Fix matching for SQL-only jobs so materialized-view refreshes are matched by SQL text and job name, not treated as missing when command text differs slightly.
  - [x] 3.4 Add explicit schedule aliases for `update-nhl-xg-shot-features` and `update-nhl-xg-shot-predictions` so recent successful manual runs do not mask missing scheduled runs.
  - [x] 3.5 Decide whether full `rebuild-sustainability-*` jobs should remain scheduled as monolithic jobs or be represented only by their batch jobs.
    - Decision: keep the active monolithic `rebuild-sustainability-*` production jobs represented in inventory; refreshed export shows them active and observed on 2026-06-11.

- [x] 4.0 Close audit payload gaps
  - [x] 4.1 Deploy the `update-shifts` audit wrapper change and verify the next scheduled run writes a `cron_job_audit` row.
    - Verified 2026-07-18 with a bounded read-only production audit: the natural 07:45 UTC `update-shift-charts` run recorded `success`, the exact `/api/v1/db/update-shifts?action=all` path, and HTTP 200. The deployed route source uses `withCronJobAudit` under the canonical job name, so the former deployment/observation gate is closed without triggering a manual writer run.
  - [x] 4.2 Inspect `update-standings-details`, `update-nst-goalies`, `update-nst-current-season`, `update-nst-team-daily`, `update-season-stats`, `update-rolling-games`, `sync-yahoo-players-to-sheet`, and `daily-cron-report` to confirm whether wrappers are missing, not deployed, or not capturing responses.
    - Current code has wrappers for inspected routes, but production still lacks audit rows for several jobs. Verification query used: `with latest_report as (...) select ... from cron_job_report left join cron_job_audit ... where a.job_name is null;`.
  - [x] 4.3 Normalize manual audit inserts to include `method`, `url`, `statusCode`, `durationMs`, `response`, `rowsUpserted`, `failedRows`, and concise `error`.
    - `withCronJobAudit` now writes normalized `rowsUpserted` and `failedRows` alongside existing method/url/status/duration/response/error details.
  - [x] 4.4 Fix `update-nst-gamelog` so its audit row uses `success` or `failure`, includes timing metadata, and avoids `UNKNOWN` unless status truly cannot be determined.
    - Implemented 2026-07-11: removed non-terminal `started` and phase audit rows, normalized every terminal path to `success`/`failure`, added the shared timing envelope plus `failedRows`, and removed stack persistence. Cron timing/wrapper/report tests pass and `tsc --noEmit` passes. Production observation remains covered by 7.5; do not trigger active NST backfills for this check.
  - [x] 4.5 Add tests or route-level assertions for every scheduled API route that should write `cron_job_audit`.
    - Implemented 2026-07-11: the static harness derives active HTTP routes from `cron-schedule.md`, resolves each Pages API owner, and requires `withCronJobAudit`, a manual `cron_job_audit` insert, or an explicit exemption. Current result: zero uncovered routes, zero exemptions, four recognized manual owners, and all remaining routes use the shared wrapper. Exact 13-test cron gate and `tsc --noEmit` pass.

- [x] 5.0 Fix partial row failures and row-count quality
  - [x] 5.1 Investigate the two failed `update-all-wgo-skaters` dates and determine whether they are expected no-game dates, source failures, or real transform errors.
    - Implemented 2026-07-11: both incremental and all-seasons refreshes preserve typed per-date outcomes through retries. Empty successful NHL responses are `expected_no_game` skips; source transport/HTTP, transform, Supabase write, and season-mapping failures retain category and reason in bounded samples. Failed dates no longer masquerade as failed rows (`failedRows: 0`, separate `failedDatesCount`), partial runs return 207, and audit details include confirmed rows plus skip/failure diagnostics. Focused outcome/cron tests pass 5/5 and `tsc --noEmit` passes. Production observation remains under 7.5.
  - [x] 5.2 Investigate `update-power-play-combinations` failed rows for skipped pregame games and classify expected skips separately from row errors.
    - Verified 2026-07-11: `FUT`/`PRE` game-state failures are returned in `skips`, counted under `skipped`, excluded from `failures`/`failed`, and preserve HTTP 200 when no true errors remain. The focused route suite passes 4/4 tests.
  - [x] 5.3 Investigate `update-nst-tables-all` and `update-nst-team-stats-all` 100 failed rows and determine whether the route is reporting skipped backlog dates as failures.
    - Resolved locally 2026-07-11 without invoking active NST backfills: both schedules share `nst-team-stats`, whose bounded backlog is now explicit `deferredDates` and never a failure/row count. Empty source responses are structured skips; nonempty responses that cannot map are transform/request failures. The response declares `failedRows: 0`, separate `failedRequests`, and bounded failure/skip samples so audit inference cannot turn deferred dates or request failures into 100 failed database rows. Focused NST/WGO/audit tests pass 7/7 and `tsc --noEmit` passes. Post-deploy production observation remains under 7.5.
  - [x] 5.4 Investigate `update-nhl-edge-stats` failed metric families and add per-family failure reasons.
    - Implemented 2026-07-11: every skater/goalie/team skip now includes `endpointFamily` and a family-named reason; team supplemental 404s become structured skips instead of aborting the route. The response reports team skip counts and bounded samples. Edge/power-play suites pass 11/11 tests and `tsc --noEmit` passes.
  - [x] 5.5 Investigate `update-goalie-projections-v2` failed downstream routes and distinguish dashboard refresh warnings from failed database upserts.
    - Implemented 2026-07-11: the current route has upstream goalie-log data-quality warnings but no dashboard-refresh mutation. Those remain warnings. Database writes now use bounded chunks, count only confirmed rows, expose `failedRows` and bounded stage-specific failures, and return 207/500 rather than false success when writes fail. Focused persistence/partial-failure tests pass 6/6 and `tsc --noEmit` passes.
  - [x] 5.6 Investigate `build-forge-derived-v2` 30 failed rows and decide whether they are acceptable warnings, skipped dates, or true failed writes.
    - Resolved 2026-07-11: the route’s `errors` entries are date/stage build exceptions, not database row-write failures; the shared wrapper was inferring array length as `failedRows`. The response now sets `failedRows: 0`, emits structured/bounded `failedStages`/`failures`, and separates max-day/timeout carryover into `deferredDates`. True stage failures still return 207 and `success: false`. Derived/audit/report tests pass 10/10 and `tsc --noEmit` passes.
  - [x] 5.7 Ensure each route reports true domain rows upserted instead of wrapper/audit-row counts.
    - `withCronJobAudit` now records inferred domain `rowsUpserted` and `failedRows` in details; route-specific domain count cleanup remains part of items 5.1-5.6.

- [x] 6.0 Improve CEO briefing signal-to-noise
  - [x] 6.1 Split the audit email into sections: critical failures, missing required jobs, audit gaps, partial successes, and successful jobs.
  - [x] 6.2 Hide successful jobs by default unless they have row failures, audit gaps, slow runtime, or missing freshness.
  - [x] 6.3 Show `Last Success` for failures by looking back beyond the current 24-hour window when needed.
  - [x] 6.4 Collapse repeated benchmark notes into short tags plus one-line remediation hints.
  - [x] 6.5 Make the job-status email focus on schedule health and remove duplicate detail already shown in the CEO briefing.
  - [x] 6.6 Add a `?dryRun=true` or `?preview=json` mode to `cron-report` for testing email payloads without sending Resend emails.

- [ ] 7.0 Verify end-to-end
  - [x] 7.1 Add focused tests for schedule parser path coverage, route alias matching, SQL job matching, and stale inactive job exclusion.
  - [x] 7.2 Add component tests for the new CEO briefing sections and hidden-success behavior.
  - [x] 7.3 Run the targeted Vitest suite and TypeScript check.
  - [ ] 7.4 Send a preview or controlled test email and confirm the report lists only actionable failures and gaps.
    - BLOCKED (requires deployed code or local server with production env): command after deploy/local server: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://fhfhockey.com/api/v1/db/cron-report?preview=json"`. Expected result: JSON `success: true`, `dryRun: true`, no Resend send, one suppressed job-status result. Verification query: `select job_name, run_time, details->>'url' from cron_job_audit where job_name='daily-cron-report' order by run_time desc limit 1;`.
  - [ ] 7.5 After deployment, verify the next morning report shows zero false missing jobs, zero false audit gaps, and only real route/data failures.
    - BLOCKED (next scheduled report after deploy): after 2026-06-12 21:15 UTC, run `select job_name, run_time, status, details->>'response' as response from cron_job_audit where job_name='daily-cron-report' and run_time >= '2026-06-12 21:15:00+00' order by run_time desc limit 1;`. Expected result: response counts show no false missing inactive jobs, no duplicate email send path, and only real route/data failures.

- [x] NEW 8.0 Reconcile the two failing `update-nst-gamelog` URL-contract assertions with the current `URLSearchParams` output before treating the full route suite as green.
  - [x] NEW 8.1 Confirm the HTTP contract is decoded parameter semantics: query order is irrelevant and hyphens are valid unescaped query characters.
  - [x] NEW 8.2 Update assertions to compare the endpoint plus decoded parameter map and rerun the suite. Result: all 13 NST route tests and all 23 combined NST/audit/report tests pass (2026-07-11).

- [ ] NEW 9.0 **P1 inbound scheduled-route authentication boundary:** Audit and enforce the intended inbound authentication contract across scheduled HTTP routes. The machine-checked rolling inventory now proves 59 active HTTP jobs / 52 routes: 30 use `adminOnly`, one destructive internal route is exact-cron-secret-only, and 21 remain explicitly unprotected. No public unauthenticated exception is approved; migrate the remaining frozen set route-by-route while preserving every inventoried browser/internal caller.
  - [x] NEW 9.1 Inventory every active HTTP job and public/manual caller, define fail-closed exceptions and rollout/rollback behavior, then propose the cross-route enforcement boundary before changing production contracts. Evidence updated 2026-07-22: after projection, `update-PbP`, Sustainability, SKO, and Yahoo hardening, the static contract still resolves all 59 active HTTP jobs to 52 route files and now freezes 30 admin-or-cron / 1 exact-cron-only / 21 unprotected modes, while preserving 5 browser-admin, 11 internal-server, 4 mixed, and 32 cron-only caller shapes. No public unauthenticated target is allowed; route-by-route caller propagation, 401/current-auth canary/audit observation, and affected-batch rollback remain required. The current focused inventory/auth group passes 10/10 plus full TypeScript.
  - [x] NEW 9.2 **P1 privileged season-writer auth gap:** `update-season-stats` now composes `withCronJobAudit(adminOnly(handler))`; unauthenticated requests are rejected before workload/audit execution and exact cron plus authenticated-admin callers reach the handler in focused production-mode regressions. Deployment remains inside the approved P0 stable-redeploy sequence (verified locally 2026-07-14).

- [x] NEW 10.0 **P0 CRON_SECRET transcript-exposure containment:** A value-bearing production `cron.job.command` inventory was returned in connector output on 2026-07-14. Treat the live bearer as compromised without repeating or reusing it; rotate it again, update Vercel and Supabase Vault, migrate every affected active inline command to a Vault-backed lookup where supported, reconcile any necessary bounded compatibility exceptions, redeploy, and prove old-secret rejection/new-secret authorization without exposing either value in logs, task artifacts, or chat.
  - [x] NEW 10.1 **Value-free preflight and quiesce:** Verified the non-mutating auth regressions, asserted one canonical non-empty Vault row, 69 total/65 active jobs, 59 one-occurrence literal definitions (57 active/2 inactive; 58 JSONB-header/one build-object), two active Vault-backed consumers, and zero unsupported shapes. A private RLS/no-grant non-secret operation ledger recorded all 61 affected definitions and prior activation; `cron.alter_job` atomically quiesced the 59 active consumers. Post-quiesce proof is zero affected active/running jobs and zero queued old-authorization rows (2026-07-14).
  - [x] NEW 10.2 **Candidate staging and isolated stable redeploy:** Generated the replacement only in memory, staged one uniquely named temporary Vault candidate through the service-role-only RPC, saved the existing all-environments Vercel record without value output, and cleared the transient browser value. Same-source Production redeploy `dpl_ALiDv4okqPrv1HZ3oiX7xJXTEbWX` reached READY in 3m53s with `fhfhockey.com` current; the private ledger is `deployment_attested`, exactly one candidate row remains, and affected active/running counts remain zero (2026-07-14).
  - [x] NEW 10.3 **Old/candidate authorization proof:** With all affected jobs paused, two fixed-URL `pg_net` requests used Vault values only in transient headers. Request IDs 8315/8316 proved compromised-canonical HTTP 401 and candidate HTTP 200 with no timeout/error. Both response rows were deleted without selecting content/headers/error text, scoped request-queue rows are zero, and the private run advanced to `proof_passed` (2026-07-14).
  - [x] NEW 10.4 **Atomic canonical/Vault and 59-literal rotation:** One advisory-locked transaction verified all 59 normalized command digests/invariants and both existing-Vault definitions, replaced exactly one old occurrence per literal through `cron.alter_job`, updated canonical Vault through `vault.update_secret`, and left every affected job inactive. Post-commit proof reports canonical=candidate, 59/59 rotated literal definitions, 2/2 unchanged existing-Vault definitions, zero active/running jobs, and canonical request 8317 HTTP 200 without timeout/error; response/queue debris is zero and the temporary candidate remains for final closure (2026-07-14).
  - [x] NEW 10.5 **Staged Vault-backed conversion and incremental restoration:** Converted jobs 280/330 first and retained them inactive; restored the two unchanged pre-existing Vault jobs individually; then converted/restored the 57 previously active literals through one build-object canary, 14 isolated batches, one 4-job batch, four 8-job batches, and one 6-job batch. Every batch preserved command/metadata digests, used only `cron.alter_job`, passed independent pre/post canonical HTTP 200 authorization observations, and left zero probe queue/response debris. Final value-free evidence is 61/61 activation parity, 59/59 converted literals, 2/2 existing-Vault restorations, zero digest/metadata/Vault-shape/inline-bearer mismatches, 47/47 green probes across 24 batches, and zero rollback events (verified 2026-07-14).
  - [x] NEW 10.6 **Closure, debris removal, retention scope, and runbook reconciliation:** Value-free finalization records 93,168 affected literal-definition history rows across 59 jobs, zero ambiguous history rows, zero candidate matches in history/current commands/pg_net queue/responses, zero inline-bearer/current-Vault/activation/metadata/digest mismatches, and zero known probe debris. Old=401, missing=401, and current=200 evidence remains intact; the committed rotation asserted old-current-zero before the old scalar was intentionally not retained. The exact candidate was deleted (canonical Vault one/candidate zero), all ten executable helpers and three `/tmp` scripts were removed, the three private non-secret ledgers retain RLS with no client grants, and the runbook now records jobs 308/393 as active canonical-Vault consumers. The original connector transcript, Vercel/provider history and logs, PostgreSQL cron history, WAL/backups/PITR, and internal logs remain explicit retention boundaries; this is current-state containment, not a claim of physical/global historical erasure (verified 2026-07-14).

- [x] NEW 11.0 **P1 missing-secret scheduled-auth bypass:** `invokedByCron` now requires a configured non-empty `CRON_SECRET`, rejects absent/empty/whitespace configuration and literal `Bearer undefined`, and the value-free auth-check endpoint applies the same blank-secret fail-closed rule. Combined auth/route verification passes 5 files/56 tests plus full TypeScript, scoped legacy ESLint, Prettier, and diff integrity (verified locally 2026-07-14).
- [x] NEW 9.3 **P1 unprotected WGO mutation boundary:** The exported WGO handler is now wrapped by `adminOnly`, protecting range overwrite/prune, date, incremental, player/date, and full-history modes through one boundary; focused production-mode regressions prove unauthenticated rejection and exact cron/authenticated-admin admission. Deployment remains inside the approved P0 stable-redeploy sequence (verified locally 2026-07-14).
