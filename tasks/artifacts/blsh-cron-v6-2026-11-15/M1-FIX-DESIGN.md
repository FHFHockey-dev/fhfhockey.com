# M1 fix design: keep the TLS binding while Fluid compute stays on (offline, 2026-11-16 UTC)

**Status (2026-11-16):** the approved text is kept unchanged as `M1-FIX-DESIGN-APPROVED-daa9c051.md`. TJ chose parts 1 and 3, and they are implemented in the working tree (not committed; Chef commits after independent review). Part 2 waits for probe B-M1a.

**Unverified until probe B-M1b:** the self-test loads `node:http` with a dynamic import, which no other deployed route does, and it listens on loopback.
- **If either fails in production,** the 12:05 and 12:20 triggers both return 503 every day until a redeploy.
- **What that costs:** no date is claimed or burned, but each such day's capture is missed. So "refusal is free" above holds per invocation, not per day.

**One code difference from §4.1/§4.3:** a mismatched attributed request keeps v5's single code, `capture_tls_observation_missing`, rather than a separate mismatch code.

**Inputs:**
- TJ: Fluid compute is **ON** for project `fhfhockey` (V6-PROBE-A, M1 row).
- v6 is deployed inert on master `89284e9c4` (`dpl_23ZsbjhA…`), and migrations 153/154 are applied.
- V6-REVIEW `c0789453`, finding M1, and `M1-ISOLATION.md`.

## 0. Recommendation: three separable parts, for TJ to choose

**The smallest M1 fix is part 1 alone.** Parts 2 and 3 are separate choices. None of the three touches a frozen or pinned file.

| Part | What it does | Recommendation |
| --- | --- | --- |
| **1. A′-core: context tagging** | The observer counts only undici requests **created inside the observed action's own async context** (AsyncLocalStorage plus `undici:request:create`, matched by object identity). Concurrent traffic from other invocations is ignored. It still requires exactly one such request, matching origin, path and method. v5's connection semantics are kept **exactly**: `socketTls` is unchanged. | **Yes.** This is the M1 fix. |
| **2. A′-strict: the foreign-socket rule** | A request riding a keep-alive socket that **another** request opened fails closed (`capture_tls_connection_foreign`). Today v5, and A′-core, label such a socket a fresh connection (§2.3). | **Yes if probe B-M1a shows the route is its own function; no if it is grouped.** **Benefit:** no mislabelled "fresh" connection in the evidence. **Cost:** a new way to burn D, which v5 does not have (§4.3). Its frequency depends on B-M1a. |
| **3. Pre-claim loopback self-test** | Proves the tagging works in the deployed bundle before a date is claimed, so a runtime surprise costs a 503, not a burned date (§4.4). | **Yes.** It is small, and refusal is free. |

**This reverses Chef's 2026-11-15 "no copy" decision.** `socketTls` and its `connections` map are not exported from the pinned v5 adapter. So A′ must copy them, verbatim, into a v6 file, and the observer is no longer "v5's, imported unchanged". The bridge statement and PROFILE-SPEC change with it (§5).

## 1. Facts this design rests on

| Fact | Evidence |
| --- | --- |
| Both NST-path requests are bare global `fetch` calls in **frozen** files, with no `dispatcher` option. | The admission POST is `web/lib/nst/sharedAdmission.ts` (`fetch(endpoint, { method: "POST", … })`). The provider GET is `web/lib/nst/client.ts` `executeNstUrl` (`fetch(url.toString(), { method: "GET", … })`). |
| The core requires the global dispatcher to be the `Agent` present at runner load, before and after every dispatch. | `core.ts` `DISPATCHER_AT_RUNNER_LOAD`, with codes `global_dispatcher_not_runner_load_default` and `global_dispatcher_changed_before_dispatch`. |
| The `undici:client:sendHeaders` payload is `{ request, headers, socket }`, with no dispatcher reference. The socket carries undici-internal symbols (`client`, `kSocketUsed`, `socket request counter`), which are not API. | `m1-fix/symbols.mjs` (takes a directory holding `key.pem`/`cert.pem`), Node 22.23.4, bundled undici **6.29.1**. |
| `undici:request:create` fires synchronously in the dispatch path, in the **caller's** async context. It carries the same `request` object that later appears in `sendHeaders`. | `undici/lib/dispatcher/client.js:340` (`new Request(…)` in `Client[kDispatch]`; npm 7.29.0 source as a proxy) and experiment A/C/D (§3). |
| The default global `Agent` has no connection limit (`connections` unset gives a Pool with `kConnections = null`). So the Pool never queues `{opts, handler}` for construction later in another request's context. | `pool.js` `kGetDispatcher` (always returns or creates a client when unlimited) and `pool-base.js:160` (queue only when no dispatcher). Read in npm undici 7.29.0; Node's bundled 6.29.1 is not on disk, so this is confirmed **empirically** on 6.29.1 (C1: 0/50, D: 60/60). |
| `diagnostics_channel` is per thread: a worker's undici traffic is invisible to the main thread's subscribers, and the reverse holds too. | `m1-fix/worker.mjs` (same certificate argument): `mainSawDuringWorker: 0`, `workerSaw: 1`. |
| npm `undici` in `web/node_modules` is 7.29.0, a **transitive** dependency of `cheerio` that nothing in `lib/`, `pages/` or `utils/` imports. Using it for a v6 `Agent` would mean depending on an undeclared package, or editing `package.json`, which is frozen until the 11-17/18 pilot is over. | `package-lock.json` (cheerio `"undici": "^7.12.0"`). |

**Vercel docs** (fetched 2026-11-16 UTC, vercel.com only):
- **Instances:** Fluid "allows multiple invocations to share a single function instance". "This in-function-concurrency is especially effective when multiple requests target the same function." (`/docs/fluid-compute`.)
- **No per-function switch is documented.** The `functions` entry accepts exactly eight keys: `runtime`, `memory` (not settable under Fluid), `maxDuration`, `supportsCancellation`, `includeFiles`, `excludeFiles`, `regions` and `functionFailoverRegions`. `fluid` is a **top-level** boolean, per deployment or custom environment. The dashboard switch is per project. (`/docs/project-configuration/vercel-json`.)

## 2. The problem, precisely

### 2.1 M1 (as reviewed)

`withTlsObservation` (v5) subscribes to `undici:client:sendHeaders` for the duration of one action and requires `events.length === 1`.
- **What breaks it:** any other undici request in the process during that window adds an event. The run then fails **after** the call was spent (admission permit or NST GET), which burns D.
- **Who can share the instance:** under Fluid, only other invocations of the **same function**. That is this route, if the 250 s entry bundles it alone (probe B confirms), or its function group otherwise.

### 2.2 What concurrent traffic exists in this function

- **The route wrapper:** `adminOnly` is outermost (`withOperationalRouteAuth`). A JWT bearer makes two `supabase-js` calls on global `fetch` (`auth.getUser`, then `users`) **before** the v6 handler runs.
- **`withCronJobAudit`** writes after each invocation's handler. Checked in `web/lib/cron/withCronJobAudit.ts`: `await handler(req, res)` runs before any insert.
- **The cron-bearer branch of `adminOnly`** (`invokedByCron`) only selects the service-role client; it makes no network call. Checked in `web/utils/adminOnlyMiddleware.ts`.
- **So inside the capture's own invocation,** the only undici request before `admission:individual` is `schedule` (to `api-web.nhle.com`). Admission's Supabase socket can be foreign only through **another** invocation in the same instance:
  - an earlier invocation's audit insert or JWT check, within undici's idle keep-alive window (4 s by default, absent a server hint);
  - or, if the route is grouped with other routes (B-M1a), their constant traffic.
- **Duplicate triggers** (backup 12:20, a stray cron call) run the kill-switch read and the claim through the isolated `node:https` writer. That traffic is not undici, so it is invisible to all observers.
- **Unknown runtime traffic:** whatever the Vercel/Next runtime sends in-process during a capture.

### 2.3 A second, pre-existing gap: the foreign-opened socket

v5's `socketTls` registers a socket in its `connections` map the first time **the observer** sees it.
- **The gap:** if our request rides an idle keep-alive socket that a different request opened (for example the Supabase socket left by a prior invocation's audit write), the observation says `connectionReused: false` with a new sequence. The core then accepts it as a connection this run opened.
- **Are the facts false?** No: the TLS facts are still the real facts of the socket that carried the request. The "fresh connection" claim is what is false.
- **Status:** not new, but Fluid makes warm, shared instances the norm.
- **How this is known for v5:** by **code reading** of `socketTls` (v5 adapter lines 29–52: first sight means `connectionReused: false`). The experiment ran only the prototype, which classifies such sockets `capture_tls_connection_foreign` (A1, and the 24 "foreign" rounds in D).
- **The 11-17/18 laptop pilot:** not assessed. It is not raised as a pilot blocker here.

## 3. Experiment (offline; localhost only; nothing external)

**Files:**
- `m1-fix/m1-experiment.mjs`: it generates a throwaway self-signed certificate in a temp dir, deletes it after, and re-executes itself with `NODE_EXTRA_CA_CERTS`;
- the output, `m1-fix/m1-experiment.out`.

**Setup:** Node v22.23.4, bundled undici 6.29.1. The prototype observer is the §4.1 rule in plain JS. It is **not** product code.

| Case | Result |
| --- | --- |
| v5 control: ours plus 5 concurrent foreign POSTs to the same origin, path and method | v5 observer sees **6** events, so it fails |
| A2: ours with 10 foreign POSTs to the **same** origin, path and method, started before and after ours, outside our context | tagged **1**, events **1**, classified fresh |
| A3: our action sends a second request | `capture_tls_observation_missing(created=2,events=2)`: fails closed |
| A4: our request to the wrong path | `capture_tls_observation_mismatch`: fails closed |
| A5: the action sends nothing | `capture_tls_observation_missing(created=0,events=0)`: fails closed |
| A1: ours right after the control traffic (it rode an idle socket the control left) | `capture_tls_connection_foreign`: fails closed |
| D: 60 mixed rounds (foreign warm-ups, idle expiry, concurrent foreign traffic) against per-socket ground truth | **60/60 correct:** 16 fresh, 20 own-reuse, 24 foreign; 0 mismatches. Undici picks idle sockets nondeterministically, so single-shot connection cases are not asserted; D is the check. |
| C1: 50 rounds with 6 concurrent foreign requests each | **0** attribution failures |

**Also:** `m1-fix/` holds `symbols.mjs`, `worker.mjs` and `loopback-selftest.mjs`. No certificate or key is kept.

**An earlier scratch run's S3 "failure"** was a test-setup error: it started the foreign requests *inside* the action. That exercised the A3 path, which correctly failed closed.

**Limits:**
- This is plain Node on localhost, not the Next bundle on Vercel.
- Two directions are possible, and both fail closed:
  - a **missed tag** (fetch wrapped across contexts) gives `created=0`;
  - a **leaked context** (a foreign request created inside the action) gives `created=2`.
- §4.4 and probe B settle the deployed runtime.

## 4. Option A′ specification (recommended)

### 4.1 Rule

**New file: `web/lib/blsh/nativeCaptureV6/tlsObservation.ts`.**
- **Copied verbatim:** v5 adapter lines **14–52** (channel constant, `Peer`/`SocketLike` types, `str`, `TlsObservation`, `connections`/`connectionCount`, `socketTls`), sha256 `f05d54f679df94050fed367ae556e67fb50793603551a5d2ccda3967e835c107` from `aa6237bd`.
- **Replaced:** only `withTlsObservation` (v5 lines 54–73).
- **Reuse:** `release/fix-tls-observer/` already holds the verbatim 14–73 copy and its hash-pin test. This is that copy, with its last 20 lines replaced.

**`withTlsObservation(url, method, action)`, per call:**
- **Context:** a fresh `token = {}`, and `created = Set<request>`, `fresh = WeakSet<socket>`, `foreignUsed = WeakSet<socket>`, `events = []`.
- **Subscriptions** (for the action's duration only; listeners never throw):
  - `undici:request:create` adds `m.request` to `created` **iff** `als.getStore() === token`;
  - `undici:client:connected` adds `m.socket` to `fresh`;
  - `undici:client:sendHeaders`: if `m.request ∉ created`, add `m.socket` to `foreignUsed` and **ignore** the event. Otherwise, push one entry:
    - `null` with code `capture_tls_observation_mismatch` unless origin, path (query stripped) and method match (the v5 match, kept as a second factor);
    - **Part 1 (A′-core):** otherwise `socketTls(socket)`, unchanged, exactly as v5.
    - **Part 2 (A′-strict) replaces that line with two cases:**
      - `socketTls(socket)`, unchanged, if `connections.has(socket)` (a socket this module observed before: the core then binds it to its opener in **this** run, or fails `tls_connection_unbound`), or if the socket connected during this action and no foreign request used it first;
      - otherwise `null` with code `capture_tls_connection_foreign`.
    - **Without part 2,** the `connected` subscription and `foreignUsed` are not needed.
- **Run:** `als.run(token, action)`, then unsubscribe all three in `finally`.
- **Enforce:** `created.size === 1 && events.length === 1 && events[0]` is facts. Anything else throws its code, defaulting to v5's `capture_tls_observation_missing`.

**Exported shape:** unchanged (`TLS_OBSERVATION_CHANNEL`, `TlsObservation`, `withTlsObservation`). So `adapter.ts` changes **one import path** plus its header comment, and `core.ts` is unchanged: the new codes match its code-shaped `catch`.

### 4.2 What is kept, and what changes

| Property | v5 | A′ (part 1; part 2 where noted) |
| --- | --- | --- |
| Exactly one request **sent by this action** | Yes, and also "no other request in the process" | Yes, but other requests in the process are ignored |
| Its origin, path and method match the plan | Yes | Yes |
| TLS facts are those of the socket that carried **this request object** | Yes, by origin/path/method plus the "only event" rule | Yes, by **object identity**, which is stronger |
| Resumed sessions bound to this run's full handshake | Core rule | Core rule, unchanged |
| Reused connection bound to its opener in this run | Core rule, but a foreign-opened socket passed as fresh (§2.3) | Part 1: as v5. Part 2: a foreign-opened socket **fails closed** |
| Concurrent same-function traffic | Fails the run after the call is spent | Ignored |

### 4.3 Failure modes (all fail closed; none sends a provider request it should not)

| Cause | Code | When | D burned? |
| --- | --- | --- | --- |
| Tagging does not work in the deployed bundle | `capture_tls_observation_missing` | `schedule`, the first op, with 0 NST calls | Yes, unless §4.4 catches it pre-claim |
| Our action sends two requests | `capture_tls_observation_missing` | any op | Yes; v5 behaves the same |
| **Part 2 only:** a foreign-opened idle socket is reused (v5 and part 1 instead label it a fresh connection and continue) | `capture_tls_connection_foreign` | Usually `admission:G` (Supabase), with the permit spent and **no NST GET sent**; also `schedule` if the route is grouped with routes that call `api-web.nhle.com` | Yes. **If B-M1a shows its own function: rare.** The capture invocation itself sends nothing to Supabase over undici before admission (§2.2), so it needs another invocation of this route in the same instance within the idle keep-alive window (about 4 s). **If the route is grouped:** possibly frequent, so do not ship part 2. |
| A new connection resumes a TLS session cached by a prior invocation | `tls_resumed_without_full_handshake` (core) | `admission:individual` | Yes. **Pre-existing**, unchanged by A′ |

### 4.4 Add-on: pre-claim loopback self-test (recommended; small)

- **When:** at gate 5.5, after the kill switch reads `true` and before the claim. The run is still free.
- **What it does:**
  1. Starts a plain `http` server on `127.0.0.1:0`.
  2. Runs the **same** tagging code (an internal `observeAttribution()` that `withTlsObservation` also uses) around one global `fetch` to it.
  3. Requires `created=1, events=1`, with the event's request being the created object.
  4. Closes the server.
- **Refusal:** `observer_selftest_failed`, a 503 with no claim. The 12:20 backup retries, and any refusal is visible.
- **What it cannot be confused with:** a loopback socket. That origin is never a capture origin, and non-TLS sockets are never registered in `connections`.
- **Checked locally:** `m1-fix/loopback-selftest.mjs` gives `created 1, events 1, sameObject true`, with a foreign request to the same URL running concurrently (`m1-fix/loopback-selftest.out`).
- **Not verified:** whether Vercel functions may listen on loopback is unverified. If they may not, the self-test refuses pre-claim, which is safe, and probe B shows it. The fallback is to drop the add-on and accept that the first live run is the check.

### 4.5 Cost

- **Runtime:** one `AsyncLocalStorage` (Node 22 enables promise hooks for the process). Only this function pays, and the overhead is negligible for a 5-operation job.
- **Network and NST:** no extra network and no NST budget. The self-test is loopback only.

## 5. Files touched (none frozen or pinned; each tracked edit needs Chef's OK first)

| File | Change |
| --- | --- |
| `web/lib/blsh/nativeCaptureV6/tlsObservation.ts` (new) | v5 14–52 verbatim plus the A′ `withTlsObservation` and `observeAttribution` (about 35 lines) |
| `web/lib/blsh/nativeCaptureV6/tlsObservation.test.ts` (new) | Hash pin of the verbatim block (plus a direct byte check when the v5 adapter is `aa6237bd`). The A1–A5 and D classes run against the real Node undici on a loopback **http** server (attribution only) and on mocked publishes for the TLS paths. |
| `web/lib/blsh/nativeCaptureV6/adapter.ts` | Import from `./tlsObservation` instead of `../../../scripts/blsh/nativeProcessCaptureAdapter`; header comment |
| `web/lib/blsh/nativeCaptureV6/core.test.ts`, `routeRehearsal.test.ts` | Their fake transports already publish `sendHeaders`. They must also publish `undici:request:create` (same request object, inside the stub) and `undici:client:connected` for new fake sockets. Add one case each: concurrent foreign events are ignored; with part 2, a foreign-opened socket fails closed. |
| `web/lib/blsh/nativeCaptureV6/handler.ts` (+ `handler.test.ts`) | Add-on only: gate 5.5 self-test |
| Docs | CORE-DEVIATIONS (adapter deviation 4), PROFILE-SPEC (the observer producer becomes v6's `tlsObservation.ts`), M1-ISOLATION (superseded), the bridge's "observer is v5's" statement |

**Untouched:**
- `web/scripts/blsh/*`, `web/lib/nst/*`, `nstRateLimitPolicy.ts`, `tsconfig.json`, `package.json`/lockfile;
- `vercel.json` (the 250 s entry stays as defence in depth);
- `core.ts`, the migrations, and `SCHEDULE.sql`.

## 6. Review needed

- **Code review of the observer:** about 35 new lines (about 20 with part 1 only) plus the verbatim block's hash. Reviewers check the classification, listener non-throwing, unsubscribe in `finally`, and that ALS is entered only around `action`.
- **With part 2, recheck the core's TLS binding rules against the new `connectionReused` semantics.** A socket is "fresh" only if it connected in-window and we were its first user. A socket already in `connections` is reported reused.
- **Gate:** the v6 Vitest files one by one, `npm run typecheck` (read the exit code), eslint on `lib/blsh/nativeCaptureV6`, and the clean-export gate as in `release/GATE.md`.
- **Then:** a deploy (inert) and probe B, each a separate TJ approval.

## 7. Residual risk with A′ (parts 1 and 3, and part 2 where noted)

- **TLS resumption from a session cached by an earlier invocation** (pre-existing; unchanged by every part).
  - **Effect:** `tls_resumed_without_full_handshake` at `admission:individual`. It fails closed and burns D, with no NST request sent.
  - **Visibility:** the 12:52 watchdog-assert reports it.
  - **Removal:** only option A, after the pilot.
- **With part 2:** a foreign-opened socket fails closed (§4.3); its frequency depends on B-M1a.
- **Without part 2:** such a socket is still recorded as a fresh connection. The TLS facts are true; the "fresh" label is not.
- **Runtime fetch wrapping that breaks async context.** This is caught pre-claim by the self-test if loopback listening is allowed. Otherwise the first run's `schedule` fails closed (D burned, 0 NST calls).
- **Unknown in-process runtime traffic** is now **ignored** rather than fatal.

## 8. Options considered and not recommended now

| Option | Why not now | Frozen/pinned files | Residual |
| --- | --- | --- | --- |
| **(a) A dedicated v6 undici `Agent`, observer filtered to its sockets** (a recording `connect` function) | NST admission and provider `fetch` take no dispatcher. Plumbing one means editing frozen `client.ts` and `sharedAdmission.ts`. `setGlobalDispatcher` is process-wide (concurrent invocations would ride v6's Agent) and trips the core's dispatcher guards. A v6 Agent also needs npm `undici` declared in `package.json` (frozen; today it is only cheerio's transitive 7.29.0, against the runtime's 6.29.1). | `web/lib/nst/client.ts`, `sharedAdmission.ts`, `package.json` | Lowest: own sockets and no shared session cache, so it also removes §7's first item. **Best follow-up after 11-17/18**, as a shared-NST change with its own review. |
| **(b) A per-route Fluid opt-out** | Not documented as of 2026-11-16: no such key among the eight per-function keys, and `fluid` is top-level per deployment. Turning Fluid off project-wide is TJ's option (a) in M1-ISOLATION (cost and cold-start behaviour for every route). | none | n/a |
| **(c1) Run the capture in a `worker_threads` Worker** | Channels are per thread (verified), so the v5 observer could stay byte for byte. But the worker needs its own compiled bundle of core, adapter and the frozen NST client, traced into the function. That is build-specific and only verifiable with `next build`/deploy (costly). | none directly; bundling config | Low, but delivery risk is high |
| **(c2) An in-process busy gate** (refuse while another invocation is in flight) | `adminOnly` is outermost, so a gate inside the handler can't cover its `supabase-js` calls; one in the route file can't cover requests already in flight or runtime traffic. With A′ it is not needed for correctness. | none | Optional defence in depth only |
| **(c3) The origin/path/method-only filter** (M1-ISOLATION's option) | Strictly weaker than A′: a concurrent same-path request would be mis-attributed or counted, and §2.3 stays open. | none | Superseded |
| **(c4) Host the route in a separate Vercel project with Fluid off** | A new project, environment, domain and cron URL, plus a second build per release. That is ops and cost for one route. | none | Low, but heavy |

## 9. Probe B additions (when approved)

- **B-M1a:** the deployment's function list shows `blsh-native-capture` as its own function (250 s). This decides part 2.
- **B-M1b:** the gate-5.5 self-test passes in production. This needs the kill switch on for one invocation, *or* a self-test-only diagnostic path. Chef decides which. The simplest is the first scheduled run, where a refusal costs nothing.
