# 2026-11-15 claude: BLSH native capture v6 (daily cron) design

## Scope
Offline design (Phase 1) then implementation (Phase 2, after Chef relays TJ's OK) of a daily
pg_cron -> net.http_post -> /api/v1/db/blsh-native-capture route. Reports to Chef (local_56526db8).
No deploy, push, migration apply, schedule, flag, provider/prod call, credential read, commit.
Pinned until Chef says 11-17/18 pilot done: web/scripts/blsh/*, web/lib/nst/*,
web/lib/cron/nstRateLimitPolicy.ts, web/tsconfig.json, package.json/lockfile/node_modules.

## Where
- Branch octoberBranch (shared checkout), no commits.
- Design: tasks/artifacts/blsh-cron-v6-2026-11-15/DESIGN.md

## State
- Read: withOperationalRouteAuth, adminOnly, v5 runner/adapter/preparation, nstRateLimitPolicy,
  cron-schedule.md NST band, vercel.json crons, player-forecast cron migrations
  (fhfh_internal.require_cron_request_headers + vault site_url), bridge convert.mjs runtime checks,
  POST-CAPTURE.md, request-reader RUNBOOK headings, sibling notes.

## Insights / gotchas
- v5 runner AND adapter hard-code DATE 2026-11-11 (runner const, adapter schedule URL) and write to
  local fs with fsync/link; game-id regex /^202602\d{4}$/. They cannot be reused unmodified for daily
  dates -> v6 needs a new date-parameterised core; reuse withTlsObservation (exported), preparation's
  prepareNativeProcessCapture (date-generic), lib/nst client/admission as-is.
- convert.mjs checkRuntime requires node.execPathSHA256 == pinned NODE_SHA256, launch.* bootstrap
  proof, cwd == WEB_ROOT laptop path: a v6 RUNTIME.json can never pass it; bridge needs a v6 profile.
- In-route Supabase writes hit the admission host. Risk is TLS session RESUMPTION (no peer cert,
  no full handshake in this run) and sockets first seen by a previous warm invocation; NOT plain
  keep-alive (adapter's connectionReused is its own WeakMap). Design: writer on node:https with
  maxCachedSessions 0, keepAlive false. No global-dispatcher swap.
- Permit TTL 1000 ms is ledger-side (receipt.permitTtlMs), measured from before admission send:
  no remote writes between admission STARTED and NST send -> /tmp journal + one remote intent row.
- Lifecycle: prod NST_JOB_LIFECYCLE_ENABLED / nst_job_control.enforced unknown -> question to Chef.
- No scheduled NST caller after ~11:00Z (forge pipeline Vercel cron 10:05..10:55). 12:05Z is clear.

## Phase 2 (started after Chef relayed TJ's OK on DESIGN f6f78878; decisions: disabled mode/5 ops,
request read = SECURITY DEFINER fn file only, boxscores Phase 3, refused_schedule keeps claim)
- Built (new files only): web/lib/blsh/nativeCaptureV6/{sourceDate,runtimeReceipt,writer,sink,core,adapter,
  handler,requestContext}.ts + tests + fakeCaptureStore.testHelper.ts; web/pages/api/v1/db/blsh-native-capture.ts;
  supabase/migrations/20261116000000_blsh_native_capture_v6.sql, 20261116000100_blsh_request_context_v1.sql (NOT applied);
  supabase/tests/blsh_capture_v6.py (disposable PG15, 48/48); artifact folder: schedule/, REGISTRATION.md,
  PROFILE-SPEC.md, REQUEST-CONTEXT.md, CORE-DEVIATIONS.md, fixtures/.
- Vitest per file so far: sourceDate 5, runtimeReceipt 3, writer 3, sink 3, core 9, handler 8, requestContext 3.
- Gotcha: gates reordered vs DESIGN §1.1 so all no-I/O gates (clock, env, runtime precheck) run before the kill-switch read.

- Advisor review fixes: 12 tsc errors in my files fixed (Buffer/Uint8Array); service_role explicit revoke (baseline default
  privileges grant ALL; 20261020224500 revokes them, proof now emulates the baseline); watchdog raises on no_slate with games;
  fixture moved beside test, reader checks skip if folder absent; removed a __pycache__ I created in the reader folder (17:27).
- Writer isolation loopback (real TLS, 127.0.0.1): PASS. Control showed undici did not resume on plain node either.

- Final checks: Vitest per file 37/37 (v6) + pinned guards nstBypassGuard 4, callerLifecycle 12, operational-route-auth 72;
  npm run typecheck exit 0 (third run; first two had 12 then 4 errors, all in my files, fixed); eslint 0; SQL proof 50/50;
  rehearsal 7 scenarios; loopback PASS. SHA256SUMS (34 files) b01191f1.

## V6-REVIEW c0789453 fix ticket (M1, L1-L7), offline
- M1: web/vercel.json + route maxDuration 250 (own function per Vercel docs); Fluid in-function concurrency not
  per-function controllable -> PROBE-LIST M1 + M1-ISOLATION.md (narrowed observer = option only).
- L1 missing day -> schedule_shape_invalid; L2 pre-schedule checkpoint own 20 s budget before timer, sink serialized;
  L3 start refusals inside try (close failed w/ code); L4 core rebuilt from v5 text (verbatim splices), core-v5.diff 14 hunks;
  L5 rows kept, owner-only retention list + mark_pruned (bytes first); L6 bucket settings asserted; L7 DESIGN approved
  bytes recovered exactly (f6f78878) as DESIGN-APPROVED-f6f78878.md, errata in appendix; landing order noted.
- Checks: Vitest v6 40/40 (8 files incl. rehearsal), guards 155/155, typecheck exit 0, eslint 0, SQL proof 57/57,
  loopback PASS. SHA256SUMS (40 files) ae8caef1.

## Release prep (Chef: inert release approved; v6 committed 6d4aba061; RC built on origin/master), offline
- release/: rollback SQL x2 (capture keeps empty private bucket, refuses while bytes remain), proof/rollback_roundtrip.py 15/15,
  authority 153/154 pending (master copy + 20 lines), baseline test 154/8 pending, super-goal summary sentence (154; required by test),
  sql/{preflight,apply-15x,readback-15x}.sql + proof/rehearse_apply.py 17/17 (non-superuser, atomic), PREFLIGHT-AND-APPLY.md, GATE.md.
- BLOCKER found: origin/master's v5 adapter is pre-v5 (0162fb52), no withTlsObservation -> master+v6 tsc exit 2 (2x TS2305),
  core/rehearsal fail. Prepared option B in release/fix-tls-observer (verbatim v5 lines 14-73 copy, sha pin c01da6d8). Needs Chef.
- Gotcha: migration files carry their own begin/commit -> apply only the body (lines between) inside the ledger transaction.

- TJ: "Fix the blockers" -> applied option B in the canonical working tree (uncommitted): adapter.ts import -> ./tlsObservation,
  new tlsObservation.ts (verbatim v5 lines 14-73, sha c01da6d8) + test. Canonical: v6 Vitest all pass (tlsObservation 2/2 direct
  compare), guards pass, typecheck 0, eslint 0. Same bytes typecheck 0 on master export. Docs + SHA256SUMS refreshed (e5c65c96, release 5eeca7e3).

- Chef decision: RC c2b3bd24c (chef/blsh-v6-inert-release) ships v5 348a122d6 on master; v6 imports the observer unchanged.
  Chef restored adapter.ts and removed the copy; release/fix-tls-observer kept for reference. My docs corrected to match
  (CORE-DEVIATIONS, PROFILE-SPEC, DESIGN appendix, M1, GATE, REPORT); SHA256SUMS d3de585c, release 56e62100.
  Rule from Chef: ask before editing tracked files in the canonical checkout.

## Next
Release paused for TJ; nothing pending in this lane. Phase 2 done; stop for independent review. Report hashes/counts to Chef. Then: probe (PROBE-LIST.md), lanes per PROFILE-SPEC.md.
NOTE for Chef: two unapplied migrations sit in supabase/migrations/ of the shared checkout (a db push would apply them).

## Blockers / approvals
Phase 2 waits on TJ's design OK via Chef.

## M1 fix design (Chef ticket after probe A: Fluid ON), 2026-11-15
- Wrote tasks/artifacts/blsh-cron-v6-2026-11-15/M1-FIX-DESIGN.md. It recommends option A': a v6-local observer that tags requests by
  context (AsyncLocalStorage + undici:request:create, attribution by object identity), with origin/path/method kept as a second factor.
  A socket another request opened fails closed (capture_tls_connection_foreign). Add-on: a pre-claim loopback self-test.
- (a) dedicated Agent: blocked (frozen NST fetch calls, the dispatcher guard, npm undici only transitive). (b) per-route Fluid: not documented.
- Experiments in m1-fix/ (offline, localhost): D 60/60 vs ground truth, C1 0/50, v5 control 6 events.
- Gotcha: the v5 observer reports a foreign-opened keep-alive socket as a fresh connection (pre-existing).
- Reverses Chef's "no copy" (socketTls is not exported). Nothing tracked edited. SHA256SUMS cf7728da; recommendation split into part 1 (tagging, the M1 fix), part 2 (foreign-socket rule; only if B-M1a shows own function), part 3 (loopback self-test).
- Next: Chef/TJ choose; implementation only on Chef's OK (tracked v6 files).

## M1 fix implemented (parts 1 + 3, Chef-cleared), 2026-11-16 UTC, uncommitted
- New: web/lib/blsh/nativeCaptureV6/tlsObservation.ts (v5 lines 14-52 verbatim f05d54f6 + context-attributed withTlsObservation,
  withAttributedRequests, observerSelfTest) and tlsObservation.test.ts (15).
- Changed: adapter.ts (import), handler.ts (gate 5.5 selfTest dep), handler.test.ts (10), core.test.ts (14: stubs publish
  undici:request:create; M1 concurrency + extra-request cases), routeRehearsal.test.ts (4: self-test mocked; refusal scenario).
- Negative control: the M1 core test fails with v5's observer (adapter temporarily pointed back, then restored).
- Gate: all v6 Vitest files pass; typecheck exit 0; eslint exit 0. SHA256SUMS aae79c94 (after: self-test rejection-leak fix + test, approved copy M1-FIX-DESIGN-APPROVED-daa9c051.md, RESULTS.json 9 scenarios).
- Gotcha: core.test/routeRehearsal forbid node:http, so the self-test loads node:http with a dynamic import, and the rehearsal mocks observerSelfTest.
- Next: Chef's independent review and commit; then probe B (B-M1a decides part 2, B-M1b = self-test in production).
