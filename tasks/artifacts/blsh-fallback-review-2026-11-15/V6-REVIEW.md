# BLSH native capture v6 (daily pg_cron capture): independent review

**Reviewer:** an independent Claude session that had not worked on v6. Requested by Chef on 2026-11-15.

**Conditions:**
- Offline. No hosted DB, no network, no deploy, no migration applied, nothing committed.
- `GIT_DIR` was unset in every run.
- Tests ran in a scratch export: `git archive HEAD web supabase`, plus the untracked v6 files copied in (their 34/34 sums verified), `web/node_modules` symlinked, the request-reader folder and `cron-schedule.md` copied in.
- Test runs used `sandbox-exec`, with outbound network denied except localhost and Unix sockets.

**Disclosures:**
- The SQL test started a **disposable local Postgres** (Homebrew 15, Unix socket only, no TCP) in the system's per-user temp folder. The scratch path was over macOS's 103-byte socket limit. I removed the temp folder my run created; three older `blshv6-*` folders from earlier runs are still there.
- No hosted database was touched.

## Verdicts

| # | Area | Verdict |
|---|---|---|
| 1 | Core and adapter deviations from v5 (`348a122d6`) | **APPROVE** (Lows L1–L4) |
| 2 | One-shot claim and windows | **APPROVE** |
| 3 | The 1 s admission permit and crash semantics | **APPROVE** |
| 4 | Storage privacy, manifest-last, retention | **APPROVE** (Lows L5, L6) |
| 5 | SQL: both migrations | **APPROVE** (Lows L6, L7) |
| 6 | Route auth, kill switch, failure modes, NST budget | **APPROVE** for code; **M1 gates the schedule** |
| 7 | RUNTIME provenance limits as stated | **APPROVE** |

**What the approval covers:**
- **Deploying the route and applying both migrations, inert:** APPROVE. The switch defaults off, there is no schedule, and the route refuses before the claim.
- **Running `SCHEDULE.sql` or setting `enabled = true`:** NOT YET. That needs the approved deployment probe in PROBE-LIST, **with M1 added**.

No finding lets two triggers make two captures, a remote write sit inside the permit, or a crash read as success. Every finding fails closed. The Medium and the Lows are about reliability, meaning a date burned without a usable packet, or about doc accuracy.

## Findings, by severity

### M1 (Medium; gates the schedule): any other undici request in the process during admission or NST fails the run after that call is spent

- **The mechanism:** the v5 TLS observer (`nativeProcessCaptureAdapter.ts:58-69`, imported unchanged) subscribes to the process-wide `undici:client:sendHeaders` channel. It records **every** request during the action, pushing `null` for a non-matching origin or path, and requires exactly one matching event.
  - **On the laptop** that held, because the bootstrap was the only work in its process.
  - **In a Next function** it holds only if nothing else in the same process uses undici during the roughly 1 s admission call or the up-to-15 s NST GET.
- **Reproduced:** V-R4, in the core test harness. One unrelated-origin event during `admission:individual` gives `failed` after the admission. During `nst:individual` it gives `failed` after the NST GET.
- **Why it can happen in production (not verified offline):**
  - `vercel.json` gives every `pages/api/**/*.ts` the same config (`maxDuration: 240`), so routes may share a function.
  - `/api/internal/starter-board` and `/api/internal/yahoo-live-draft` are Vercel crons that run **every minute, including 12:05**.
  - If the project uses in-function concurrency (Fluid compute) or bundles routes, a concurrent request's fetch can land in the window.
  - Any unauthenticated request with any bearer to an `adminOnly` route also makes two supabase-js calls on the global fetch (`adminOnlyMiddleware.ts:32-48`).
- **Not on PROBE-LIST:** item 7 covers sequential warm-instance resumption, not concurrency.
- **Fix:**
  - add a probe item: does this route ever share a process with a concurrent request? Check the project's Fluid setting and the function grouping for `pages/api`;
  - if it can, give the route its own function, for example a distinct `functions` entry, or turn in-function concurrency off for it, before scheduling;
  - alternatively, narrow the observer's count to matching events only. That is a core change and needs review.

### L1: a schedule body without D is recorded as `no_slate`

- **The code:** `completedGames` (`core.ts:158-160`) returns `[]` when no `gameWeek` entry equals D. So a well-formed body that lacks D's day ends exactly like a real off-day, after 1 GET (**V-R1**).
- **Backstop:** the 12:52 watchdog raises when `no_slate` disagrees with `public.games`. So it is detected, but D is burned.
- **Fix:** if a real off-day body lists D with `games: []` (the shape the existing no_slate test uses; I have not checked it against a real NHL off-day body), require D's day entry to be present, and treat a missing entry as `schedule_shape_invalid`, which is a `failed`.

### L2: the pre-schedule checkpoint shares the schedule GET's 15 s timeout

- **The code:** `dispatch("schedule")` arms the 15 s operation timer, then runs `sink.checkpoint()`: 4 objects, each one Storage upload plus one RPC with 5 s timeouts. Only then is the GET sent (`core.ts:249-262`).
- **Effect:** slow writes burn D with **no** NHL GET. V-R2 reproduces it: fake writes of 4 s each give `failed: operation_failed_or_uncertain:schedule`, with 0 fetches.
- **Threshold:** the real writer makes 2 round trips per object, so it trips at about 1.9 s per round trip, not the ~3 s in PROBE-LIST item 11.
- **What a timeout can leave behind:** the first upload loop keeps running while the failure path starts a second `checkpoint()`. Duplicates are refused by `x-upsert:false` and by the contiguous-ordinal RPC, so they cannot corrupt the index. They can leave Storage objects without object rows, or uploads still in flight after the close, which the RPC then refuses. That is acceptable for a failed run.
- **Fix:** give the checkpoint its own budget before arming the schedule timer, and correct PROBE-LIST item 11.

### L3: a refusal at core start leaves the run row `claimed`

- **The code:** `plan_modified`, `plan_date_or_run_mismatch`, `wrong_project`, `adapter_date_mismatch`, the dispatcher check and `buildRuntimeReceiptV6` (`core.ts:187-195`) run **before** the `try`.
- **Effect:** they throw a plain `Error`. The handler answers 500 `capture_setup_failed`, the row stays `claimed`, and the watchdog later calls it `abandoned_uncertain`, even though nothing was sent (**V-R3**).
- **Fix:** close as `failed` with the code, or move these checks inside the `try`. It is safe as it is, just misleading.

### L4: the core is not "line by line" against v5

- Every `need(…)` became `if (!…) fail(…)` in unchanged functions (`peerFacts`, `tlsFacts`), so `diff` shows about 250 changed lines where CORE-DEVIATIONS lists 8 deviations.
- I checked the rewrites by reading them, and they are equivalent: the same conditions and the same codes.
- **Fix:** keep `need` in unchanged code next time, so the diff equals the deviation list.

### L5: retention in the code differs from DESIGN §3.5

- **DESIGN** says "Run and object rows are kept". **`blsh_capture_retention_v1`** deletes the object rows of closed, not-kept runs, and leaves the Storage bytes to a manual Storage-API step that does not exist yet.
- **Effect:** if that step is skipped, bytes stay without their integrity anchor.
- **Fix:** delete the bytes first and the rows last, or keep the rows. Also fix §3.5.
- Retention is unscheduled and dry-run by default, and `service_role` can execute it (any server code holding the key). Consider granting it to the owner only.

### L6: the bucket insert can silently keep an existing bucket

`insert … on conflict (id) do nothing` would keep an existing `blsh-native-packets` bucket's settings, including `public`. The SQL test proves privacy only on a clean database. **Fix:** after the insert, assert `public = false` and the size and MIME limits. Dashboard-created `storage.objects` policies are not in the repo; check them in the probe's read.

### L7: doc accuracy and traceability

- **Approved hash:** `DESIGN.md` is `48012ac5…`. The TJ-approved `f6f78878` bytes are not kept, so I could not check that only the "As built" section was appended. **Fix:** keep the approved copy, or record its diff.
- **Intent row:** DESIGN §3.2 says an intent row is written before the schedule GET. The SQL allows only the two group intents, and the code writes none for the schedule.
- **Upload timing:** DESIGN §1 budgets uploads after the 120 s capture. In the code, publication must finish inside the same 120 s (`publication_after_deadline`).
- **Partial completion:** if the deadline hits between the manifest upload and the close, the run is `failed` with a recorded `MANIFEST.json`. That is correct by the "all three" completion rule, but a reader keyed on MANIFEST alone would be misled.
- **Landing order:** `CRON-SCHEDULE-ENTRY.md` and REGISTRATION.md must land together. `nstCoordination.test` ("burst-clearance schedule synchronized with the canonical inventory") will fail if the inventory gains the job without the registration.

## Evidence by area

### 1. Core and adapter deviations

- **Adapter:** the diff is exactly the documented changes:
  - a date-parameterised schedule URL;
  - no `withJob`;
  - `NST_JOB_LIFECYCLE_ENABLED` must be **absent**;
  - `withTlsObservation` imported from v5;
  - an exported environment check;
  - one duplicate `need` dropped next to an equivalent `if`.
- **Core:** the same as v5:
  - 5 operations, `calls.size < 5`;
  - order and phase guards;
  - `retries: 0`, `maxAdmissionCalls: 1`;
  - 22 s monotonic spacing, checked at entry and again at dispatch;
  - the permit at `now + 1000` from dispatch entry, re-checked at dispatch;
  - the 120 s wall and monotonic deadline, with stop and terminal timers;
  - CA store and dispatcher identity before and after each call;
  - `operation_after_failure`;
  - the 8 MiB cap;
  - credential echo;
  - `tlsFacts` rules.
- **Freshness rule untouched:** `prepareNativeProcessCapture` is imported unchanged (8-day rule, 15-min plan) and rebuilt or compared (`plan_modified`). `web/lib/buyLowSellHigh` is unchanged in the canonical checkout (`git status` is clean for `scripts/blsh`, `lib/nst`, `lib/buyLowSellHigh`, `lib/cron`, `utils`, the package files, `vercel.json` and `tsconfig.json`).

### 2. Claim and windows

- **Clock gates first:**
  - pilot fence: capture date < 2026-11-19 gives a 200 skip;
  - window: [12:00, 12:30)Z, else 409;
  - D = UTC date − 1;
  - season bounds.
- **Then the other pre-claim gates:** environment and deployment (503), runtime precheck (503), kill switch (200 skip), plan and adapter (503). None of them burns D.
- **The claim:** `blsh_capture_claim_v1` re-checks `enabled` inside the claim (no TOCTOU), then `insert … on conflict (pipeline, source_date) do nothing`, so a second trigger, a duplicate `pg_net` delivery or a manual call gets `already_claimed`.
- **An unacknowledged claim** returns 503 without capturing. If the row was in fact written, the backup sees it, and the watchdog marks it.
- **Proof:**
  - `handler.test.ts`;
  - the rehearsal's `backup_trigger_1220`;
  - the SQL test "one-shot claim".

### 3. The 1 s permit

- **Remote writes are only:**
  - the pre-schedule checkpoint;
  - after the schedule is retained;
  - `intent(group)` plus a checkpoint before each admission;
  - after each page.
- **Inside dispatch**, admission and NST have only local `/tmp` journals (`wx`, file fsync, directory fsync).
- **Proof:** `core.test.ts` "keeps remote writes out of the permit window" with 400 ms remote writes, and my read of `core.ts:214-301` and `:359-383`.
- **Crash:** the intent row stands and the row stays `claimed`. The watchdog marks it `abandoned_uncertain`, and both calls count as possibly consumed.
- **No false success:** completion needs `MANIFEST.json` recorded **last** with the matching sha256 (enforced in SQL), then the close. Two details are rehearsal-approximated:
  - the "kill" is a close-unacknowledged run; a real process kill was not rehearsed;
  - writer isolation was shown on loopback with Node's **bundled** undici (`WRITER-ISOLATION.json`), not the npm undici that cheerio installs. `node:https` is a separate stack either way. I read that script; I did not re-run it.

### 4. Storage

- **Private bucket:** 2.5 MiB per object, JSON and HTML only. RLS is on, there are no policies, and all privileges are revoked from anon and authenticated.
- **Writes:** `x-upsert:false`, `Cache-Control: no-store`. The object RPC re-derives the path from the run row, requires contiguous ordinals, checks the Storage object's existence and size, and refuses anything after MANIFEST.json.
- **Content:** the response body is limited to 64 KiB, and errors are whitelisted codes only. There are no credentials in packets (`core.test.ts`).
- **Retention:** see L5.

### 5. SQL

**Capture migration:**
- every function is `set search_path = ''`, with schema-qualified references;
- the functions are SECURITY DEFINER, owned by the migration role. EXECUTE is revoked from public, anon and authenticated and granted to service_role;
- service_role has SELECT only on the tables, so all writes go through the RPCs;
- the guard trigger makes objects append-only, run identity immutable and terminal rows frozen (only keep false → true), with intents append-only.

**Request-context function:**
- STABLE plpgsql, so it cannot write, and it reads from one statement snapshot;
- SECURITY DEFINER, `search_path ''`, service_role only;
- bounds: a span of ≤ 28 days inside the season, ≤ 10,000 keys (refused at 10,001), linked lists `LIMIT 9`, ≤ 8 MiB of JSON;
- indexes exist for every lookup: `(player_id, date_scraped, season)` on both NST tables, `wgo_skater_stats (player_id, date, season_id)` and the date indexes, `games` primary key;
- **gap:** no statement timeout is pinned. The caller is not built yet; when it is, give it a bounded `statement_timeout`.

**SQL test:** 50/50 PASS on a disposable local Postgres with the production baseline schema. It covers claim, intents, objects, append-only, close, watchdog, retention, grants, the private bucket and reader parity.

### 6. Route, kill switch, failure modes, NST budget

- **Auth:** `adminOnly` is outermost. On the cron-bearer branch it makes **no** network call. `withCronJobAudit` makes no call before the handler, never retries, and inserts the audit row after it. The handler's first line requires the cron bearer, so an admin JWT gets 403.
- **Kill switch:** read before the claim, and checked again inside the claim.
- **Failure modes:** a refused slate gives 422; a failure after the claim gives 500 with `runClosed`.
- **NST:** 2 GETs a day, 22 s apart, through the shared ledger. A denial is final for D, with no wait and no retry. The slot is 130 minutes after the last NST cron start (09:55).
- **Census tests:** 5 files, 133/133 with the v6 route present: `nstClassification`, `nstCoordination`, `combinedCronInventory`, `operational-route-auth` and `rebuild-team-underlying-summaries`.
- **REGISTRATION:** not applied, which is correct; see L7.

### 7. RUNTIME provenance

The limits are stated accurately:
- presence-only environment (15 + 4 keys);
- the CA store hashed and re-checked;
- deployment id, env, region and git SHA, regex-filtered;
- `routeBundleSHA256` and `execPathSHA256` are null with a reason when unavailable;
- the dispatcher anchor is checked before the claim.

The residual is stated honestly: a packet cannot tie compiled code to source, so the deployment-to-SHA binding must come from a pins input.

## Checks

| Check | Result |
|---|---|
| v6 `SHA256SUMS` `b01191f1…` | 34/34 OK (canonical and scratch) |
| Vitest, the 8 v6 files (sandboxed) | **37/37 PASS** |
| Census tests | **133/133 PASS** |
| `tsc --noEmit` (direct, 8 GB, sandboxed) | **exit 0**, 0 errors |
| SQL test, disposable local Postgres | **50/50, RESULT OK** |
| My reproducers (`repro/v6/`) | **5/5**: V-R1, V-R2, V-R3, V-R4 ×2 |
| Rehearsal `RESULTS.json`, `WRITER-ISOLATION.json` | read, not re-run |
| Line-reviewed | `core.ts`, `adapter.ts`, `writer.ts`, `sink.ts`, `handler.ts`, the route, `sourceDate.ts`, `runtimeReceipt.ts`, both migrations, `SCHEDULE.sql`, DESIGN, CORE-DEVIATIONS, PROBE-LIST, REGISTRATION, REQUEST-CONTEXT |
| Skimmed | `requestContext.ts`, PROFILE-SPEC, CRON-SCHEDULE-ENTRY |
| Run, not line-reviewed | the test files other than `core.test.ts` |

## Reproducers and logs

- `repro/v6/review-tail.test.ts.part`, with `repro/v6/README.md` (how to append it to the harness in scratch) and output `repro/v6/review-repro.out`.
- `logs/v6/vitest-8-files.log`, `logs/v6/census-tests.log`, `logs/v6/sql-disposable-postgres.log`, `logs/v6/tsc.log`.
