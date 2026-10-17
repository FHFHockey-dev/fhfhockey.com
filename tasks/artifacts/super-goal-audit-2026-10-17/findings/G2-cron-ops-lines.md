# G2-cron-ops-lines findings (read-only audit, 2026-10-17, HEAD ceceb407a, working tree dirty)

## (a) Coverage

- Completed (`[x]`) ledger rows in the group: 431 (EML 65, SCH 43, FLD 34, NSR 75 of 76, NAP 46, CCC 94, GDL 74 of 85), plus completed master rows 5.1 and 5.1.1-5.1.4. Master 3.2, 3.3 and 4.1 are open; their completed rows are covered through the source rows.
- Audited: 67 rows (5 master + 62 source rows). No tests were run (the Chef full-suite result was used). I did not edit anything except this file.
- Selection:
  1. Master rows 5.1 and 5.1.1-5.1.4.
  2. Every completed source row that claims current code behaviour for the schedule, report, email, NST client, auth boundary or CCC/GDL contracts, and every P0/P1 row I could check from code.
  3. Rows whose files changed in `7f094c8e6` or the working tree: `cron-schedule.md`, `adminOnlyMiddleware.ts`, `nst/client.ts`, `requestBudget.ts`, `nstBurstPlans.ts`, `update-nst-gamelog.ts`, `lineSourceIftttReceiver.ts`, `incremental.ts`, `rebuild-score.ts`, `rebuild-baselines.ts`.
  4. A spread sample of the remainder.
- Rows that depend on Production DB, Vercel or provider state are marked UNVERIFIABLE-OFFLINE (list in section d).
- Row-id legend (all paths under `tasks/TASKS/`; the ledger line is the line in `super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md`):
  - EML = `cron-operations/tasks-cron-audit-email-failures.md`
  - SCH = `cron-operations/tasks-prd-cron-audit-and-schedule-optimization.md`
  - FLD = `cron-operations/tasks-prd-cron-failed-jobs-remediation.md`
  - NSR = `cron-operations/tasks-prd-cron-nst-audit-remediation.md`
  - NAP = `cron-operations/tasks-prd-nst-api-audit-and-migration.md`
  - CCC = `lines-ccc-ingestion/tasks-prd-lines-ccc-ingestion.md`
  - GDL = `lines-gdl-ingestion/tasks-prd-gdl-suite-ingestion.md`
  - Full id = `SRC::tasks/TASKS/<path>::Cnnnn`; below it is `<PREFIX>::Cnnnn`.

## Failing-test diagnosis (`cron-audit-wrappers.test.ts`: 46 auth findings, expected 47)

- **Cause: an uncommitted working-tree edit.**
  - `tasks/TASKS/cron-operations/cron-schedule.md` now has pg_cron job 234 `daily-cron-report` set to `"active": false` (diff near L613; TJ's intentional disable, last run 2026-10-15 per the added comment at L27-33).
  - `inspectScheduledCronAuthCoverage` (`web/lib/cron/cronAuditCoverage.ts:334-399`) groups only the active GET/POST jobs parsed from that markdown by route. `/api/v1/db/cron-report` had only job 234 in pg_cron, so it drops out.
  - Resulting counts: 47 to 46 routes, 51 to 50 jobs, `internal-server` callers 12 to 11.
- The route itself is unchanged and still `withCronJobAudit(adminOnly(...))`. It is still scheduled, through Vercel `0 13 * * *` in `web/vercel.json`. This is not an auth regression.
- The same working-tree change updated the sibling `web/lib/cron/combinedCronInventory.test.ts` (pg_cron 56 to 55, total 83 to 82) but not `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts` (lines 72, 76-80, 83-86 still expect 47 / 51 / `internal-server` 12).
- `git diff HEAD` on the wrapper test is empty, so at committed HEAD the suite was green. Fix: update the expectations to 46 / 50 / 11 (not run).
- Claims it contradicts: 5.1.2 ("wrapper ... regressions pass"), and 5.1.1/EML::C0063/C0065 (frozen counts).

## (b) Findings table

| row id | ledger line | verdict | evidence | note |
|---|---|---|---|---|
| 5.1 `C-OPS` | L471 | REGRESSED | Failing `cron-audit-wrappers.test.ts` (above); `cron-schedule.md` working-tree diff; live `cron.job` snapshot `tasks/artifacts/ops-health-2026-10-17/live-cron-job-2026-10-17.json` (58 active) vs inventory 55 active | "Mechanically complete / inventory matches" no longer true. Counts 25 files/214 tests are stale. |
| 5.1.1 | L472 | REGRESSED | Live snapshot: jobs 394 `player-forecasts-daily-seed`, 396 `player-forecasts-settlement`, 397 `player-forecasts-queue-drain` are active but absent from `cron-schedule.md` JSON (ops-health OPS-08). Counts: inventory 55 active pg_cron, live 58, `web/vercel.json` has 27 crons (HEAD and 457435eb), not 20. NEW 65.0's own text says the 65-job figure was the 2026-07-30 pre-deactivation snapshot (59 at readback). | Was true on 2026-07-30; drift has returned and the "fail-closed" gate cannot see the 3 new jobs. |
| 5.1.2 | L473 | REGRESSED | `cron-audit-wrappers.test.ts:72` fails (uncommitted `cron-schedule.md` edit). Also: job 374/326 overlap, partial write 400/968 on 2026-10-17 (ops-health OPS-02) | "Wrapper/report/authorization regressions pass" false in the current tree. |
| 5.1.3 | L474 | STALE-EVIDENCE | All active TS ingestion routes import `lib/nst/client` (`update-nst-*.ts`, `fetch_team_table.ts`, `SustainabilityStats/[playerId].ts`). But `client.ts` and `requestBudget.ts` were rewritten in unreviewed `7f094c8e6`. `Teams/nst-team-stats.ts:18,335` still calls the external Python function. | Outcome holds; evidence predates the rewrite. See problem 6 (open `/api/fetch_team_table`). |
| 5.1.4 | L475 | VERIFIED | `update-lines-ccc.ts:197`, `update-line-sources.ts:320` are `withCronJobAudit(adminOnly(...))`; receivers use timing-safe secret compare (`lineSourceIftttReceiver.ts:49-57,236`); tests `ccc-tweet.test.ts`, `NHL-Rosters-tweet.test.ts:40` (401) | Caveat: secret also accepted via `?secret=` (`lineSourceIftttReceiver.ts:44`). |
| EML::C0005 (1.4 report is final daily job at 21:15) | L1482 | REGRESSED | Uncommitted: job 234 inactive. `cron-schedule.md` diff L621-: "Current intended report job: 13:00 UTC Vercel cron". Vercel cron-report at 13:00 UTC since 2026-05-11 (`c7a7b30c90`) | Intentional (TJ), but the claim is now false and unrecorded in the source row. |
| EML::C0007 (1.6 move report 13:00 to 21:15) | L1484 | REGRESSED | Same as above; the 21:15 job is disabled, the 13:00 Vercel cron is the only report. At 457435eb the doc still says job 234 active. | |
| EML::C0017 (3.2 remove stale jobs from active inventory) | L1494 | REGRESSED | HEAD and prod doc: job 234 `active:true`, live inactive (OPS-06); fixed only in the working tree. Jobs 394/396/397 missing (OPS-08). | The report warned "missing daily-cron-report" on 2026-10-17. |
| EML::C0021 (4.0 audit payload gaps; last natural `update-shift-charts` success 2026-07-18) | L1498 | STALE-EVIDENCE | OPS-03: `update-shift-charts` failed 14/14 days (10-04 to 10-17). Root cause at HEAD: `shift-charts.ts` name-only first match (`playerPositions.find(... full_name ...)` at ~L742); fix uncommitted (`selectRelationshipYahooPosition`). | Audit-payload claim holds; the job it cites is failing in production. |
| EML::C0025 (4.4 gamelog audit status) | L1502 | VERIFIED | `update-nst-gamelog.ts:2379,2740,2773` write `success`/`failure`; `update-nst-gamelog.test.ts` | Route rewritten in 7f094c8e6; behaviour retained. |
| EML::C0026 (4.5 audit coverage harness) | L1503 | VERIFIED | `cron-audit-wrappers.test.ts:30-52` (tests 1-2 pass): zero uncovered, 4 manual owners, `CRON_AUDIT_EXEMPTIONS` = {} | Covers pg_cron routes only; Vercel-scheduled routes are not in this harness. |
| EML::C0036 (6.1 five sections) | L1513 | CONTRADICTED | `CronAuditEmail.tsx:147,151` has only "Needs attention" and "Other job results" (priority sort at L72). No critical/missing/audit-gap/partial/success split. | Spec not met; see problem 7. |
| EML::C0037 (6.2 hide successful jobs by default) | L1514 | CONTRADICTED | `CronAuditEmail.tsx:151-153` ("Every remaining job, including healthy ... runs"); test `CronAuditEmail.test.tsx:73` "includes clean successful jobs once in the briefing" asserts the opposite. | Deliberately reversed later; the row was never amended. |
| EML::C0038 (6.3 Last Success looks back past 24h) | L1515 | CONTRADICTED | `cron-report.ts:1499-1501` audit read is `.gte("run_time", since)` (24h); `buildLastKnownSuccessMap` (L1342-1355) only sees those rows; only two `from("cron_job_*")` reads (L1492, L1499). No test for "Last recorded success". | A failing job shows no last success unless it also succeeded within the same 24h. |
| EML::C0041 (6.6 dryRun/preview) | L1518 | VERIFIED | `cron-report.ts:1483-1485,2094-2105`; dry-run tests in `cron-report.test.ts` | |
| EML::C0047 (7.5 natural 21:15 report) | L1524 | STALE-EVIDENCE | Receipt of 2026-08-03 21:15 is real history; the 21:15 job is now disabled. | |
| EML::C0052 (NEW 9.1 counts 54/48, 48/0/0, shapes 5/12/4/27) | L1531 | STALE-EVIDENCE | Current test: 47 routes/51 jobs, shapes 5/4/26/12 (HEAD); 46/50 in tree | Counts differ from the master text. |
| EML::C0053 (NEW 10.0 P0 CRON_SECRET rotation) | L1532 | UNVERIFIABLE-OFFLINE | Vault/Vercel/pg_cron state | See d-1. |
| EML::C0060 (NEW 9.2 season-stats adminOnly) | L1539 | VERIFIED | `update-season-stats.ts:1100` `withCronJobAudit(adminOnly(handler))`; `update-season-stats.route.test.ts` | |
| EML::C0061 (NEW 11.0 missing-secret bypass) | L1540 | VERIFIED | `adminOnlyMiddleware.ts:64-72` (`invokedByCron` false for blank/unset secret); tests `adminOnlyMiddleware.test.ts`, `cron-auth-boundaries.test.ts` ("Bearer undefined") | Working-tree changes to this file (user-id bound role lookup, tighter `invokedByLocalDev`) are covered by updated tests; `users.user_id` exists in generated types. |
| EML::C0062 (NEW 9.3 WGO mutation boundary) | L1541 | VERIFIED | `update-wgo-skaters.ts:2228`, `update-wgo-goalies.ts:1653`, `update-wgo-totals.ts:854` all `adminOnly(...)` | |
| EML::C0063 (NEW 9.4 frozen inventory 31/1/20) | L1542 | STALE-EVIDENCE | Frozen counts are now the 47-route contract (46 in tree); 0 unprotected | Superseded by later NEW rows. |
| EML::C0065 (NEW 9.6 exact inventory 51/1/0) | L1544 | STALE-EVIDENCE | `cron-audit-wrappers.test.ts:72-86` expects 47 routes / 51 jobs and all `admin-or-cron`; the single "cron-secret-only" route is not in the pg_cron set | Failing test (above). |
| SCH::C0017 (3.2 slow >4:30 denotation) | L1564 | VERIFIED | `cronReportFlags.ts:3` (270000 ms), `cron-report.ts:1246,1295,1728`; `cronReportFlags.test.ts` | |
| SCH::C0038 (6.1 first job no earlier than 3:00 AM EST) | L1585 | CONTRADICTED | Active jobs before 08:00 UTC (03:00 EST): 3/5/6/7 at 00:00-03:00 UTC, 271 at 04:00 UTC, 233 07:20, 79 07:25, 9 07:30, 8 07:35, 14 07:40, 16 07:45, 248 07:50, 23 07:55, plus `*/20` and `*/25` jobs 2 and 1. Doc timeline L713-728 lists 02:20-02:55 EST. | PRD (`prd-cron-audit-and-schedule-optimization.md:68,103`) requires 3:00 AM EST. Section header "03:00 EST Floor Cluster" is stale. |
| SCH::C0040 (6.3 NST spacing >=15 min) | L1587 | VERIFIED | Active NST jobs: 07:25, 08:30, 08:45, 09:55, 10:55 (min gap 15 min); doc says 15 min | Cross-instance 21 s spacing is not enforced (see problem 8). |
| SCH::C0042 (6.5 report after every other daily job) | L1589 | REGRESSED | Report runs 13:00 UTC (Vercel); evening jobs `update-pbp` 20:51 and odds 17:34/21:10 now fall in the next day's report. Job 234 disabled. | Doc now says "report covers trailing 24 hours". |
| SCH::C0043 (6.6 docs match schedule exactly) | L1590 | STALE-EVIDENCE | Timeline lists `sync-yahoo-players-to-sheet` (job 251, inactive) and `run-forge-projection-v2` (308, inactive) with no marker; omits active `update-lineup-deployment-tallies` (391) and jobs 394/396/397. | P3 documentation drift. |
| FLD::C0019 (3.4 sustainability chain handles Supabase failures cleanly) | L1612 | CONTRADICTED | HEAD `rebuild-baselines.ts` kept `processed` inside `try`; failure returned no write receipt. Ops-health OPS-02: 2026-10-17 baselines run timed out and left 400 of ~968 rows written (partial write unreported). Fix uncommitted (`rowsUpserted`, `partialWrite`). | See problem 2. |
| FLD::C0028 (4.6 NST policy tests) | L1621 | VERIFIED | `nstRateLimitPolicy.test.ts`, `nstBurstPlans.test.ts` (updated in 7f094c8e6) pass in Chef's run | |
| NSR::C0006 (NEW 4.1 immutable-unaccent) | L1636 | UNVERIFIABLE-OFFLINE | Production catalog | See d-2. |
| NSR::C0016 (NEW 12.0 status advancement exact-ID set) | L1646 | VERIFIED | `lib/cron/statsStatusAdvancement.ts:55-80`; used by `update-stats-cron.ts:16`; `statsStatusAdvancement.test.ts:20` | |
| NSR::C0017 (NEW 13.0 gap-safe cursor) | L1647 | VERIFIED | `update-season-stats.ts:580-582` break at first failure; deferred ids L598-616; route tests | |
| NSR::C0019 (NEW 15.0 audit-insert error) | L1649 | VERIFIED | `withCronJobAudit.ts:335-349`; test `withCronJobAudit.test.ts:265` | |
| NSR::C0025 (NEW 21.0 count 1-10) | L1655 | VERIFIED | `update-stats-cron.ts:29,66-80` (400 before RPC) | Job 2 uses `count=4`. |
| NSR::C0035 (NEW 31.0 durable outcome) | L1665 | UNVERIFIABLE-OFFLINE | Production DB | See d-2. |
| NSR::C0049 (NEW 45.0 exact promotion) | L1679 | UNVERIFIABLE-OFFLINE | Vercel deployment `dpl_Hgjr...` | See d-3. |
| NSR::C0054 (NEW 50.0 cron-report zero-inventory) | L1684 | STALE-EVIDENCE | Code fails closed on zero active jobs (`cron-report.ts:1529-1534`; test "fails report generation before rendering"). The "64 scheduled jobs / job 234 run" receipt is stale. | |
| NSR::C0062 (NEW 58.0 self-audit grace) | L1692 | VERIFIED | `cron-report.ts:46,1419`; cron-report tests | |
| NSR::C0063 (NEW 59.0 partialFailureJobs) | L1693 | VERIFIED | `cron-report.ts:329,2034`; `CronReportEmail.tsx:282-297` | |
| NSR::C0065 (NEW 61.0 sustainability owner/order gate; ordered chain complete) | L1695 | CONTRADICTED | `web/lib/sustainability/incremental.ts` at HEAD and 457435eb, `detectSustainabilitySourceAdvance` (L34-62) takes the newest 100 `sustainability_scores` by `computed_at` and skips when the newest source cutoff is already processed. The three Vercel score offsets (0/250/500) then skip as `source_already_processed` after offset 0 writes. Added in `fbaf45caa` (2026-07-23), before the claim. OPS-01: only 250 skaters scored on 10-12, 13, 14, 15, 17. | Fix is uncommitted (`incremental.ts`, `rebuild-score.ts`, plus tests). Job 374 refresh (10:41) also overlapped baselines (10:40-10:41); the gate did not order job 374. |
| NSR::C0066 (NEW 62.0 import-time process.exit) | L1696 | STALE-EVIDENCE | File moved by `fbe2aa599` (2026-07-22) to `web/scripts/WGOAverages/calculateAverages.ts`; env gate `RUN_WGO_AVERAGES_SCRIPT` present there. Same defect class remains: module-level `process.exit(1)` when Supabase env is missing in 7 route files (problem 9). | |
| NSR::C0069 (NEW 65.0 legacy rolling-games auth) | L1699 | VERIFIED | `update-rolling-games.ts` default export `withCronJobAudit(adminOnly(handler))`; `update-rolling-games.test.ts:39-49` (401), L56-66 (410). Job 319 inactive in live snapshot. | |
| NAP::C0009 (2.2 shared NST client) | L1718 | VERIFIED | `lib/nst/client.ts` (base URL, `nst-key` header, timeout, retries, redaction); `client.test.ts` | Rewritten in unreviewed `7f094c8e6`. |
| NAP::C0010 (2.3 key redaction) | L1719 | VERIFIED | `client.ts` `redactNstUrl`/`redactNstMessage` used on all returned text | |
| NAP::C0016 (3.2 team-table flows) | L1725 | VERIFIED | `fetch_team_table.ts:3,76` use `fetchNstTextByUrl`; `functions/api/fetch_team_table.py:78-102` uses the `nst-key` header | `nst-team-stats` still goes through the external Python function by design. |
| NAP::C0022 (4.1 replace four-window model) | L1731 | CONTRADICTED | `lib/cron/nstRateLimitPolicy.ts:24-29` still defines the legacy 40/80/100/180 windows; `assessNstRequestPlan` (L60-100), `canBurstNstRequests` and `requestBudget.ts:5,99-105` enforce them. Token constants (L31-40) are used only for `burstPageCap` in `nstCoordination.ts:78`. | Numerically consistent with token caps (180 and 80 pages), so low impact (P3). |
| NAP::C0025 (4.4 shared-budget coordination) | L1734 | VERIFIED | `requestBudget.ts:66-148` (file ledger, windows, retries counted). It is explicitly instance-local (`NST_BUDGET_COORDINATION_SCOPE`, L68) | Scope-limited; see problem 8. |
| NAP::C0038 (6.3 fetch_team_table disposition) | L1747 | CONTRADICTED | `web/pages/api/fetch_team_table.ts:63-112` default export has no auth at all. It interpolates query params into the NST URL and consumes the shared `NST_KEY` budget on anonymous GETs. Only tests reference it (callers use the external function). The row records no decision. | See problem 6. |
| CCC::C0034 (5.1 SQL file) | L2664 | VERIFIED | `web/sql/ratings/007_create_lines_ccc.sql` exists | Applied state: d-5. |
| CCC::C0042 (6.1 admin route) | L2672 | VERIFIED | `update-lines-ccc.ts:197-198` | |
| CCC::C0055 (7.5 honest timestamps) | L2685 | VERIFIED | `linesCccIngestion.ts:1688-1699` (explicit-timezone only); `tweetPublicationFromUrl` at L1701-1715 derives the Snowflake creation time, tested at `linesCccIngestion.test.ts:1425` | The later Snowflake fallback is a true publication time, labelled `tweet_id_or_unknown`. |
| CCC::C0065 (9.2 IFTTT receiver shared secret) | L2695 | VERIFIED | `pages/api/v1/sources/ifttt/ccc-tweet.ts` via `createLineSourceIftttReceiver`; 500 when secret unset (L228-232), 401 on mismatch (L236). 401 tests are on sibling receivers using the same factory. | Query-string secret accepted (L44). |
| CCC::C0093 (P1 parseTimestampToIso) | L2723 | VERIFIED | No `parseTimestampToIso` reference remains in `linesCccIngestion.ts`; `normalizeTweetPostedAt` is used; test `linesCccIngestion.test.ts:155` | |
| CCC::C0094 (P0 static-generation blocker, 83 pages) | L2724 | UNVERIFIABLE-OFFLINE | Needs a production build; builds are barred | See d-4. |
| GDL::C0017 (3.2 generic processing route) | L2744 | VERIFIED | `update-line-sources.ts:320`, `lineSourceProcessing.ts`; tests `update-line-sources.test.ts`, `lineSourceProcessing.test.ts` | OPS-10: 32 of 13,223 runs failed in 72h with `Forecast schedule scope is incomplete or inconsistent` (`player-forecasts/scopeReads.ts:27`, imported at `update-line-sources.ts:9`); not traced. |
| GDL::C0023 / C0026 (4.0 / 4.3 first-arrival) | L2750 / L2753 | VERIFIED | `lineSourceFirstArrival.ts:40-115` (posted time, else observed, tie-breakers); `twitterEmbeds/index.tsx:362-391,606-621`; tests `lineSourceFirstArrival.test.ts`, `__tests__/pages/twitterEmbeds/index.test.ts` | |
| GDL::C0031 / C0033 / C0034 / C0035 (5.0-5.4 tweet to `lineCombinations`) | L2758-2762 | VERIFIED | `lineSourceLineCombinations.ts:52-124` (accepted/observed only; `lineup`/`practice_lines` need 12 unique forwards and 6 D; `goalie_start` goalies only); winners via `selectFirstArrivalBuckets` (L151-160); `lineSourceLineCombinations.test.ts` | `syncLineCombinationSourceWinners` is a no-op when `tweetPipelineFlags().interpretation` is on (L188). |
| GDL::C0059 (9.2 protected catch-up processor) | L2786 | VERIFIED | `update-line-sources.ts:320-321` `withCronJobAudit(adminOnly(...))`; bounded limit/date/source params | Retry path `retryPendingLineSourceEvents` is now disabled while an IFTTT pilot is configured (working tree, `lineSourceIftttReceiver.ts:139-141`); intentional retain-only. |
| GDL::C0066 (10.3 SQL applied in Supabase) | L2793 | UNVERIFIABLE-OFFLINE | Production catalog | See d-5. |
| GDL::C0075 (NEW 12.0 raw processor error) | L2802 | VERIFIED | `lineSourceIftttReceiver.ts:158-193` returns only status and `Processor request failed` | |
| GDL::C0083 (NEW 20.0 P0 receiver-secret rotation) | L2810 | UNVERIFIABLE-OFFLINE | Vercel env + IFTTT applet headers | See d-6. |
| GDL::C0084 (NEW 21.0 CCC receiver error containment) | L2811 | VERIFIED | Same function as C0075; `ccc-tweet.test.ts:107` | |

Verdict tally (67 rows): VERIFIED 36, REGRESSED 7, CONTRADICTED 8, STALE-EVIDENCE 9, UNVERIFIABLE-OFFLINE 7, NOT-CHECKED 0.

## (c) Top problems (severity order)

1. **P1 (data correctness, user-facing): Sustainability score only scores the first ~250 skaters (contradicts NSR::C0065 NEW 61.0, FLD::C0019).**
   - `web/lib/sustainability/incremental.ts` (HEAD and production 457435eb, L34-62) decides "source already processed" from the newest 100 `computed_at` rows across all batches. After the offset-0 Vercel cron (`0 11`) writes, the offset-250 and offset-500 crons (`6 11`, `12 11`) skip with `source_already_processed`. Per ops-health OPS-01 this left about 250 players scored on 10-12, 13, 14, 15 and 17.
   - The fix (per-snapshot, per-batch completeness check in `incremental.ts` and `rebuild-score.ts`, with tests) is uncommitted and unreleased, so Production is still wrong.
   - Related: `rebuild-baselines.ts` did not report committed batches on failure (partial write 400/968 on 10-17). Job 374 (10:41) overlapped baselines (10:40-10:41); the NEW 61 ordering gate never modelled job 374. The reschedule to 10:38 plus a partial-write receipt is done but uncommitted.
2. **P1 (production job failing): `update-shift-charts` failed 14 of 14 days (EML::C0021).**
   - `web/pages/api/v1/db/shift-charts.ts` at HEAD (~L742) matches `yahoo_positions` by `full_name` only. Two Vancouver Elias Pettersons throw "Conflicting relationship position" and abort the run.
   - Fix is uncommitted (`selectRelationshipYahooPosition`). The row cites only the audit payload, which is why it still reads as done.
3. **P2: the frozen inventory and gate are out of sync with production (5.1, 5.1.1, 5.1.2, EML::C0017/C0063/C0065).**
   - Failing `cron-audit-wrappers.test.ts` (diagnosis above). Live `cron.job` has 58 active jobs; inventory has 55.
   - Jobs 394/396/397 (player-forecasts) are active but absent from `cron-schedule.md`, so the daily report can never flag them missing.
   - The master text claims 65 pg_cron plus 20 Vercel; `web/vercel.json` has 27 crons at both HEAD and production.
   - The Vercel crons are not covered by the pg_cron-only audit/auth freeze tests.
4. **P2: the report/email contract (EML::C0036, C0037, C0038) is not met, and the report schedule changed (EML::C0005/C0007, SCH::C0042).**
   - "Last Success" is limited to the same 24h window (`cron-report.ts:1499-1501`, `1342-1355`).
   - The email has two sections, not five, and shows all successful jobs.
   - The single daily report is the Vercel 13:00 UTC cron; the 21:15 pg_cron report (job 234) is disabled by the owner (uncommitted doc change).
   - The rows say the opposite and were never amended.
5. **P2: SCH::C0038 (nothing before 3:00 AM EST).** About a dozen active jobs run earlier: 00:00-04:00 UTC legacy jobs, 07:20-07:55 UTC pipeline jobs, and the `*/20` and `*/25` jobs.
6. **P2 (abuse / NST budget): `web/pages/api/fetch_team_table.ts` is an unauthenticated public route (NAP::C0038).**
   - It spends the shared authenticated NST key on any anonymous GET. Query values are interpolated unvalidated into the NST URL (L112), and the response returns the fetched URL under `debug.FetchingURL`.
   - Nothing in the app calls it (`nst-team-stats` calls the external function), so the safest closure is `adminOnly` or removal.
7. **P3: NAP::C0022 (four-window model retained as the enforcement engine).**
   - `nstBurstPlans.ts:170` (7f094c8e6) lets gamelog burst at 0 ms for up to 40 requests, bypassing `canBurstNstRequests` (`NST_MAX_BURST_REQUESTS` = 39).
   - The cross-job NST budget ledger is a local `tmpdir()` file (`requestBudget.ts:68-70`). It does not coordinate Vercel instances, so the "21 s apart across jobs" rule rests on schedule spacing alone. A stale lock directory or an unacknowledged dispatch entry also blocks all NST admission until cleared (`requestBudget.ts:34-42,80-83`).
8. **P3 (data freshness; unverifiable offline): NST gamelog backlog grows.**
   - Per OPS-05: deferred 334 to 374; `nst_gamelog_5v5_counts` and `nst_gamelog_pp_counts` have no new rows since 2026-10-02.
   - Code shows the cause is structural: one run per day, 21 s interval, 220 s deadline (`update-nst-gamelog.ts:186,2959`), so about 10 URLs per run.
9. **P3: module-level `process.exit(1)` when Supabase env is absent** in `update-nst-gamelog.ts:160`, `update-nst-goalies.ts:87`, `update-nst-current-season.ts:27`, `update-nst-team-daily.ts:60`, `update-nst-last-ten.ts:26`, `update-nst-player-reports.ts:33`, `check-missing-goalie-data.ts:24`. This is the same defect class as NEW 62.0; it is harmless where env is set.
10. **P3: the IFTTT receivers accept the shared secret in the query string** (`lineSourceIftttReceiver.ts:44`), which can land in request logs. Also, `SCH::C0043` timeline drift (inactive jobs 251 and 308 listed unmarked).

## (d) UNVERIFIABLE-OFFLINE checks needed (read-only)

1. NSR/EML NEW 10.x and 9.0 (CRON_SECRET rotation, Vault conversion, 401/200 parity):
   - Value-free query of `cron.job.command` shape (no literal bearer, Vault reference present) for the active jobs.
   - Vercel env presence for `CRON_SECRET` (name only).
   - A 401 check on one denied probe, within the 5-request production smoke budget.
2. NSR NEW 4.1, 29, 31, 32, 34, 35, 40, 46, 55-57, 66 (Production migrations/DB state): `supabase_migrations.schema_migrations` versions, catalog queries (`pg_proc`/`pg_indexes`/ACLs), `get_advisors`.
3. NSR NEW 45/49/51/53 (Vercel exact deployment): Vercel deployment read for each `dpl_...` id and alias.
4. CCC::C0094 (83 static pages, P0 build blocker): the latest production deployment build log. Do not run a local build.
5. GDL::C0066 and CCC::C0034 (SQL applied): catalog check that `lines_ccc`, `line_source_snapshots`, `line_source_ifttt_events`, `lines_ccc_ifttt_events` exist with the indexes and the `upsert_line_combinations_from_source` RPC (service-role-only EXECUTE).
6. GDL NEW 13-22 (IFTTT key retirement / receiver-secret rotation):
   - IFTTT applet headers (names only).
   - Vercel Production env names for the four `IFTTT_*_WEBHOOK_SECRET` variables.
   - The open provider thread for NEW 18.
7. To confirm problem 1 live: `select snapshot_date, count(distinct player_id) from sustainability_scores group by 1 order by 1 desc limit 8`.
8. To confirm problem 2: the last 14 `cron_job_audit` rows for `update-shift-charts` and their `details`.
9. To confirm 5.1.1: the live `cron.job` active count (expected 58 per today's snapshot) against `cron-schedule.md`.
