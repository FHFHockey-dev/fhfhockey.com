# P6 — C0076 local diagnosis, 2026-10-19

C0076 remains **OPEN**. A remaining team-daily route runtime cause was reproduced and locally fixed. This is synthetic/local evidence, not proof of the current deployed cause or a natural terminal production audit.

Runtime confirmed from this worker's own `turn_context`: `gpt-6.1-sol`, `high`; Chef confirmed `xhigh`. No FAST setting changed. Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. Other owners' dirty work was preserved. Chef accepted exact route/test ownership before edits.

## Ranked causes and evidence

| Rank | Finding | Evidence and disposition |
| --- | --- | --- |
| 1 | **Reproduced, fixed locally:** URL-count bounds did not bound total route time. | Team-daily permitted 8 datasets/date and up to 2 dates for a small queue, each with a 45-second request timeout. The NST client created a fresh 220-second deadline for each URL (`web/lib/nst/client.ts:252–264`), including up to 2 retries. Thus even successful slow calls could exceed the route's 300-second configuration before the outer audit insert. New fixture: 16 successful mocked calls of 45 seconds each produced a terminal audit only at **720,000 ms** before the change. With the change, the same fixture writes its mocked terminal audit at **180,000 ms**, defers the partially stored date, and the next invocation fetches only missing datasets and completes. |
| 2 | **Previously fixed; verified, not duplicated:** goalie configuration failure retries and standings full-history replay. | `update-nst-goalies.ts:395–402` already rethrows `NstConfigError`; its existing regression proves one mocked NST invocation and HTTP 500. `update-standings-details/index.ts:57–70` already resumes at latest persisted date, clamps the season end, and caps default/date=all work at 14 inclusive dates; `full=true` remains explicit historical work. Pure date-range tests pass. These bounds reduce work but do not prove an invocation cannot time out. |
| 3 | **Confirmed source failure mode; current production occurrence unknown:** process termination or import failure before terminal insert. | All selected routes place audit outermost. `withCronJobAudit.ts:261–273` awaits the handler, then `:365–390` inserts. A killed/unresolved invocation never reaches this terminal insert. NST routes also validate Supabase variables and call `process.exit(1)` during module initialization (`update-nst-goalies.ts:83–91`, team-daily `:58–66`), before an exported wrapper can run. No environment values were read. |
| 4 | **Confirmed residual bounds, not reproduced production causes:** preflight/database/standings I/O can still delay terminal audit. | `adminOnly` waits for auth/role reads for non-cron tokens; off-season lookup precedes the route handler. Standings `index.ts:247–263` has four retries but no fetch abort or upper bound on positive Retry-After. The new team-daily deadline covers NST admission and its client requests, not all database waits, auth, off-season lookup, or audit-insert latency. No claim of a universal wall-clock guarantee. |
| 5 | **Confirmed source behavior, current production occurrence unknown:** audit insert failure can leave no row. | Wrapper `:367–390` awaits and logs both returned and thrown insert errors, then flushes the response. These routes do not opt into `includeFinalAuditReceipt`; a 200 route response alone is not persistence evidence. Existing mocked wrapper tests cover insert errors and audit-before-response ordering. No wrapper change was necessary. |
| 6 | **Not reproduced:** method, early-response, redirect, or route-alias mismatch. | Goalie accepts GET (`:824–828`); team-daily accepts GET/POST (`:753–763`); standings imposes no method exclusion. All inspected return paths use JSON, including 400/401/403/405/500 and off-season skips; none uses streaming, redirect, `res.end`, or a detached handler promise. Outer wrapper captures JSON/send and inserts before flushing. `web/next.config.js:94–117` rewrites studio and redirects game-grid, with no named cron redirect. Hosted edge/host configuration remains unknown. |

The retained August 4 runtime correlation in `tasks/TASKS/cron-operations/prd/prd-cron-nst-audit-remediation.md:5` records missing NST configuration and 240-second failures on an older deployment. It supports investigation priority only; it is not a fresh October 19 production read or proof that this patch fixes every historical gap.

## Scheduler comparison (local retained definitions only)

`tasks/TASKS/cron-operations/cron-schedule.md` has a structured inventory plus older commented SQL with conflicting times. Do not mistake the old SQL for the present hosted command.

| Job | Structured inventory | Accepted route behavior |
| --- | --- | --- |
| 43 update-standings-details | Lines 217–223: active, GET, `/api/v1/db/update-standings-details?date=all`, 08:15 UTC | Incremental bounded date=all path; no method mismatch. |
| 99 update-nst-goalies | Lines 244–250: active, GET, `/api/v1/db/update-nst-goalies`, 08:30 UTC | GET accepted; defaults incremental. |
| 275 update-nst-team-daily | Lines 379–385: **inactive**, GET, `/api/v1/db/update-nst-team-daily` | Same implementation as job 328. No new natural run is expected while inactive. |
| 328 update-nst-team-daily-incremental | Lines 560–566: active, GET, `/api/v1/db/update-nst-team-daily`, 09:55 UTC | No query parameters; defaults incremental. There is no separate incremental route file. |

The Oct 17 retained JSON inventory confirms these active flags. Migration `supabase/migrations/20260909161959_consolidate_duplicate_nst_and_remove_legacy_rolling.sql:10–12,33–51` disables legacy 275 by name and keeps 328 active; it preserves the existing command. No migration was executed. Wrapper default job identity is the request path without query (`withCronJobAudit.ts:222–225`), so both team scheduler aliases map to the same route audit identity; do not require a literal audit job_name `update-nst-team-daily-incremental`.

## Local change and its limits

Only team-daily and its nearest existing route test changed. The route creates one absolute **220,000 ms** deadline on handler entry (`:749–752`), rejects new dataset admission when another 45-second request plus existing pacing cannot fit (`:868–875`), and passes the absolute deadline into the existing NST client control (`:375–390`). Retries retain their existing count and inherit the deadline. Client admission uses a minimum of **21,000 ms**, including retries. The deadline leaves 20 seconds before the retained 240-second runtime boundary for ordinary completion/auditing; slow database operations can still exceed that margin.

The current partially processed date is included in `remainingDates`/`nextStartDate`. Existing incremental completeness checks reuse persisted datasets on the next run. HTTP 200 with `success=true, complete=false` truthfully denotes completed work so far plus deferred work; actual request errors remain HTTP 207, `success=false`, and audit failure. No new autonomous continuation, provider request, schedule change, wrapper contract, or fenced caller edit was added.

## Verification

Before running tests, inspected selected test files, Vitest config/setup, mocks, imports, and npm test entrypoint. Supabase clients/NST/season fetches are mocked, dotenv is mocked in route suites, and the modified suite uses the actual audit wrapper with an in-memory insert sink. No selected test has Git mutations or hosted/provider execution. Fake timers exercise runtime without real waiting. No credential value was inspected.

| Check | Result |
| --- | --- |
| `npm test -- __tests__/pages/api/v1/db/update-nst-team-daily.test.ts --run` before source fix | Expected regression failure: 5 pass / 1 fail; audit time 720000 was not less than 240000. Full output: `regression-before.log`. |
| Same command after fix and second failure-state regression | **7/7 pass**; `regression-after.log`. Slow successes defer/resume correctly; slow failures preserve HTTP207 and audit failure. |
| `npm test -- lib/cron/withCronJobAudit.test.ts lib/cron/standingsDateRange.test.ts __tests__/pages/api/v1/db/update-nst-goalies.route.test.ts --run` | **21/21 pass**; `unchanged-contract-tests.log`. Synthetic missing-key stderr is expected test behavior. |
| Scoped `git diff --check` | Pass. |
| `npx tsc --noEmit` with NODE_OPTIONS heap limit 8192 MB | Chef-reported serialized check: pass, exit 0. Not run by this worker. |
| `npm run lint` | Chef-reported serialized check: pass, exit 0; 0 errors and 68 warnings outside changed files. Not run by this worker. |
| Chef independent focused checks | Route suite 7/7 pass; unchanged three-file cohort 21/21 pass reported (session 35504; process exit confirmation pending at the last worker receipt). |
| Hosted, NST/provider, build, install, migration, Git mutation, natural production run | Not run. |

## Exact production-read proposal — requires TJ approval; not executed

Purpose: correlate one naturally scheduled window with the actual deployment SHA, safe scheduler metadata, HTTP outcomes, and terminal audit. No manual route call, refresh, cron execution, credential read, write, or schedule activation. Prefer existing logs; stop once conclusive. Inactive job275 needs a retained inactive disposition, not a new invocation.

1. One value-free scheduler metadata query; do not return raw `command` or headers:

```sql
SELECT jobid, jobname, schedule, active,
       substring(command from '/api/v1/db/[a-z-]+') AS route_path,
       command ~* 'net\.http_get' AS uses_get,
       command ~* 'net\.http_post' AS uses_post,
       command ~ 'date=all' AS date_all,
       substring(command from 'timeout_milliseconds\s*:=\s*([0-9]+)') AS timeout_ms
FROM cron.job
WHERE jobid IN (43,99,275,328)
ORDER BY jobid;
```

2. Set an explicit UTC window around one natural occurrence before approval (at most 24 hours); retain at most 20 recent submission records/job. Read `jobid, runid, status, start_time, end_time` from `cron.job_run_details`; expose `return_message` only if it is a numeric HTTP request identifier, never raw command/header/body. Scheduler success is submission evidence, not route/audit success. If a numeric ID is available and `net._http_response` retains it, read only `id,status_code,timed_out,created` for those exact IDs, capped at 80 rows. If the local production schema differs, request metadata-only column discovery rather than guessing or widening the read.

3. For the same approved UTC window, bounded audit query (max100 rows), using route identity rather than alias alone. Read the legacy serialized `details.response` and truncation flag so the proposal also works with an older deployed wrapper. Current local wrapper additionally records `responseOutcome` at line 361; its presence in the deployed artifact is unverified. Do not return raw `details`, URL/header fields, or credential values; the expression below redacts URL strings in the response preview:

```sql
SELECT run_time, job_name, status, rows_affected,
       details->>'method' AS method,
       details->>'statusCode' AS http_status,
       details->>'durationMs' AS duration_ms,
       regexp_replace(details->>'response', 'https?://[^"[:space:]<>]+',
                      '[redacted-url]', 'gi') AS response,
       details->>'responseTruncated' AS response_truncated
FROM public.cron_job_audit
WHERE run_time >= :approved_start_utc AND run_time < :approved_end_utc
  AND job_name IN ('/api/v1/db/update-standings-details',
                  '/api/v1/db/update-nst-goalies',
                  '/api/v1/db/update-nst-team-daily',
                  'update-standings-details','update-nst-goalies',
                  'update-nst-team-daily','update-nst-team-daily-incremental')
ORDER BY run_time DESC LIMIT 100;
```

Decode `response` JSON offline only when `response_truncated` is explicitly false. Extract `success`, `complete`, `nextStartDate`, and failure counts from that decoded object. A truncated, missing, or invalid JSON preview leaves these facts unknown; never cast the serialized preview to JSON in the production query. Keep any unexpected credential-bearing content out of the retained receipt; no environment or credential read is authorized.

4. One bounded existing deployment/runtime-log read for the exact matching deployment and these three paths/window: deployment SHA/state, request timestamps/method/status/duration, timeout or boot-failure classification, and occurrence/count of `cron_job_audit insert failed`. Include only the presence/name of a missing NST-key error, never the key or raw authenticated URL. Record edge redirect status/Location path if present. A present deployment containing the patch plus a later natural correlated terminal audit is required for a release/natural receipt claim. No deployment is authorized by this proposal.
