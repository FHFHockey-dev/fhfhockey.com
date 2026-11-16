# BLSH native-input capture v6: daily cron design

**Status:** Phase 1 design, offline. No code, migration, schedule, flag, deploy or provider call yet.
**Lane:** blsh-cron-v6, reporting to Chef (`local_56526db8`). Diary: `tasks/diaries/2026-11-15-claude-blsh-cron-v6.md`.
**Unchanged by this work:** the reviewed 11-17 pilot and its 11-18 fallback, every pinned path, and the gates on the public trade page and five-game windows.

---

## 0. Brief vs reality: what can be reused

**The brief says to reuse the v5 runner, adapter and preparation. Only part of that holds.**

| v5 file (commit `348a122d6`) | Can v6 import it unchanged? | Why |
| --- | --- | --- |
| `nativeProcessCapturePreparation.ts` → `prepareNativeProcessCapture` | **Yes** | It takes the date as input. Its 15-min plan lifetime, 8-day freshness rule and canonical NST URLs all apply as they are. |
| `nativeProcessCaptureAdapter.ts` → `withTlsObservation`, `TLS_OBSERVATION_CHANNEL` (exported) | **Yes** | The per-request TLS observer is date-free. v6 keeps the same observer, byte for byte. |
| `nativeProcessCaptureAdapter.ts` → `createNativeProcessCaptureAdapter` | **No** | `schedule()` hard-codes `…/v1/schedule/2026-11-11`. |
| `nativeProcessCaptureRunner.ts` → `runNativeProcessCapture` | **No** | It hard-codes `DATE = "2026-11-11"` (its game-id regex `/^202602\d{4}$/` is season-wide and is kept). It writes with local `fsync`/`link` and hashes `.ts` sources and the node binary from disk. Its module load also anchors the global dispatcher, so v6 must not even import it for side effects (type-only imports are fine). |
| `web/lib/nst/client.ts` (`fetchNstTextByUrl`, `NstOperationHook`), `sharedAdmission.ts`, `jobLifecycle.server.ts`, `admissionOrigin.ts` | **Yes** | Used exactly as v5 uses them: `retries: 0`, `allowQueryKeyFallback: false`, `maxAdmissionCalls: 1`, `minIntervalMs: 22000`, `plannedRequestCount: 2`. |

**So v6 is new code that needs its own review:**
- a date-parameterised core, derived line by line from the v5 runner, with a pluggable sink in place of the local filesystem;
- a date-parameterised adapter, derived from the v5 adapter;
- a sink (local `/tmp` journal, then Supabase Storage);
- a v6 runtime receipt;
- source-date selection and the claim;
- the route itself.

The review can diff the core and adapter against v5. Every deviation is listed in §2 and §4.

**Phase 2 layout.** All files are new; no pinned path changes.
- `web/lib/blsh/nativeCaptureV6/core.ts`
- `web/lib/blsh/nativeCaptureV6/adapter.ts`
- `web/lib/blsh/nativeCaptureV6/sink.ts`
- `web/lib/blsh/nativeCaptureV6/runtimeReceipt.ts`
- `web/lib/blsh/nativeCaptureV6/sourceDate.ts`
- `web/lib/blsh/nativeCaptureV6/claim.ts`
- `web/pages/api/v1/db/blsh-native-capture.ts`
- tests beside each file
- migration and schedule files (see §8)

The adapter imports `withTlsObservation` from `web/scripts/blsh/nativeProcessCaptureAdapter.ts` with a relative path. The pinned `web/tsconfig.json` includes `**/*.ts`, and `web/lib` tests already import from `web/scripts` this way, so no tsconfig change is needed. That module imports the v5 runner as `import type` only, so the runner's dispatcher anchor never loads. Phase 2 confirms both points with `npm run typecheck`.

---

## 1. Route: `POST /api/v1/db/blsh-native-capture`

**Wrapper:** `withOperationalRouteAuth(handler, { methods: ["POST"], audit: { jobName: "blsh-native-capture" } })`, with the options passed **inline**, so `operationalRouteContracts` is not edited and the work stays in new files.
- `adminOnly` is outermost, so a request without the cron bearer or an admin JWT never reaches the handler.
- **The handler is cron-bearer-only.** Its first line is `invokedByCron(req.headers.authorization)` (exported from `adminOnlyMiddleware`); anything else gets `403` before any gate.
  - Admin JWT callers are refused because `adminOnly`'s JWT path makes two `supabase-js` calls (`auth.getUser`, `users`) on the global fetch to the admission host before the handler runs. That warms the undici TLS session cache.
- `withCronJobAudit` writes `cron_job_audit` only **after** the handler (`withCronJobAudit.ts:303` before `:429`), so nothing in a cron-bearer invocation touches Supabase before the handler.
  - That audit insert does use the global fetch to the admission host **after every invocation**. On a warm instance, it seeds the session cache that a later run may resume. That is one input to the warm-instance probe (§7).
- **No `withNstJobLifecycle` wrapper.** The core runs the lifecycle itself through `runNstJob` (§1.4), as v5 does, so that begin, finish and hold are journaled operations.

**Config:** `export const config = { maxDuration: 240 }`. This matches the `vercel.json` glob for `pages/api/**`. The time budget:

| Phase | Bound |
| --- | --- |
| Pre-flight: kill switch, window, claim, runtime receipt | ≤ 10 s |
| Capture: same deadline as v5 | 120 s, plus 5 s for lifecycle cleanup in enabled mode |
| Packet upload and manifest | ≤ 45 s (each upload has a 5 s timeout) |
| Slack before the 240 s kill | ≥ 60 s |

`net.http_post` uses `timeout_milliseconds := 240000`.

### 1.1 Order of gates (every refusal before the claim is free to retry)

1. **Kill switch:** the `public.blsh_capture_control` singleton has `enabled = false` by default. If disabled → `200 {skipped:"disabled"}`. This is a DB read through the isolated writer (§3.3).
2. **Pilot fence:** a code constant refuses any UTC date before `2026-11-19`. That keeps v6 off the 11-17 slot and the 11-18 fallback, even if someone enables the switch by mistake.
3. **Server-side window:** `12:00:00Z ≤ now < 12:30:00Z`, read from the server clock. A request body cannot widen it. Outside the window → `409 outside_window`.
4. **Candidate date from the clock:** `D = UTC date(now) − 1 day` (§2). It must be inside preparation's season bounds (2026-07-01…2027-06-30); regular-season scope is then enforced by the schedule check (`gameType 2`).
5. **Environment:** `NEXT_PUBLIC_SUPABASE_URL` must be the pinned project (`nstAdmissionOrigin`). `NST_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must be present. The lifecycle mode must equal the approved mode (§1.4). `VERCEL_DEPLOYMENT_ID` and `VERCEL_ENV=production` must be present (§4.1). Otherwise → `503`, with no claim.

**Then the claim.** It runs before any provider or admission traffic.

6. **Claim:** `insert into blsh_capture_runs(pipeline, source_date, run_id, state, …) values ('native-v6', D, gen_random_uuid(), 'claimed', …)`. A unique `(pipeline, source_date)` index makes the second trigger fail → `200 {skipped:"already_claimed"}`, with no network. It returns 200 rather than 409 so that the expected daily backup refusal does not appear as a failure in the 13:00Z `cron-report`. The kill switch and the pilot fence are 200 skips for the same reason. An out-of-window or wrong-environment call stays non-2xx, because from cron it is an anomaly. **From this point everything is final for D:** no retry and no re-run, whatever happens.
7. **Runtime receipt:** `RUNTIME.json` is written (§4).
8. **Capture:** five operations, or seven in enabled mode (§1.3).
9. **Upload and close:** packet upload, manifest last, run row closed (§3).

### 1.2 Two triggers, one capture

pg_cron fires at **12:05Z** and again at **12:20Z**. The 15-minute gap respects the repo's 10-minute rule between direct NST cron starts (`NST_MIN_CRON_BURST_GAP_MS`, §6).
- The second trigger exists only to cover a first trigger that never arrived (a `pg_net` drop, or a cold start that timed out before the claim).
- If the first trigger claimed D, the second refuses at step 6 in under a second.
- Refusals before the claim (steps 1–5) do not burn the date.

### 1.3 Operations: same ceilings as v5

| # | Operation | Target | Limits |
| --- | --- | --- | --- |
| 1 | `schedule` | `GET https://api-web.nhle.com/v1/schedule/{D}` | 15 s, 1 MiB |
| 2 | `admission:individual` | `POST …/rest/v1/rpc/nst_admit_attempt_v1` (`nst_admit_job_attempt_v1` in enabled mode) | 5 s, 64 KiB |
| 3 | `nst:individual` | canonical `playerteams.php` URL for D (`stdoi=std`) | 15 s, 2 MiB |
| 4 | `admission:onIce` | as row 2 | 5 s, 64 KiB |
| 5 | `nst:onIce` | canonical URL (`stdoi=oi`) | 15 s, 2 MiB |

These rules carry over from v5 unchanged:
- `retries: 0`, `maxAdmissionCalls: 1` per group, concurrency 1, `redirect: "error"`;
- NST starts at least **22 s** apart (monotonic), and every NST start needs a current permit;
- 120 s deadline (wall clock and monotonic);
- `operation_after_failure` stops everything after the first failure.

An admission **denial** is final for D, as in v5. There is no waiting and no second admission call.

### 1.4 Lifecycle mode: **a question for Chef**

The client's behaviour depends on two production facts that this lane must not read (they are credentials and production state):

| Fact | If it holds | Then |
| --- | --- | --- |
| Vercel production env has `NST_JOB_LIFECYCLE_ENABLED === "true"` | `requireNstJob()` throws without an enclosing job | v6 **must** run in enabled mode through `runNstJob`. **7 operations on success:** schedule, begin, then admission and NST for each of the two groups, then finish. The cap is **8**, which leaves room for `hold` after a failed `finish`. |
| `public.nst_job_control.enforced = true` | `nst_admit_attempt_v1` raises `NST enclosing job token required` | Disabled mode would fail at operation 2, after the claim. |

The design supports both modes; the v5 core already does. **The route refuses at gate 5 unless the mode equals a constant fixed at review.**

`convert.mjs` today requires disabled mode **and** the env key to be absent (`runtime_lifecycle_key_present`). If production is enabled, the bridge's v6 profile must accept enabled mode: 7 operations, with a cap of 8 (§4.3).

---

## 2. Source date: the latest completed slate

- **Candidate:** `D = UTC date(now) − 1`.
  - At 12:05Z it is 07:05 ET, so D is also the ET calendar date of last night's slate. NHL schedule dates are local dates.
  - D comes from the clock, so the claim precedes the schedule GET.
- **Plan:** `prepareNativeProcessCapture({ seasonId: 20262027, date: D, plannedAtUTC: <now, ms-precision ISO>, groups: ["individual","onIce"] })`.
  - It is called unchanged, which keeps its rules: the 15-minute plan lifetime, `date < today`, and `now − D < 8 days`.
  - The core rebuilds the plan and compares it with the input, as v5 does (`plan_modified`).
- **Finality, checked inside the claimed run (v5's `completedGames`, with D as a parameter):**
  - exactly one `gameWeek` day equals D;
  - every game has `season 20262027`, `gameType 2`, `gameState ∈ {OFF, FINAL}` and `gameScheduleState "OK"`;
  - game and team identities are unique;
  - the duplicate-key scan is kept.
  - The id regex `/^202602\d{4}$/` is kept as is: it already covers the whole 2026-27 regular season.
- **Outcomes after the claim:**
  - **No games on D** (an off-day or All-Star break): state `no_slate`. One schedule GET is spent, and no NST traffic.
  - **Any game not final, postponed, or a non-regular game type:** state `refused_schedule`, with no NST traffic. D is not retried. This is rare; a postponed game burns that day. **This is a decision for TJ:** whether a `refused_schedule` with zero NST calls may release the claim. The design default is no, because one-shot means one-shot.
  - **Otherwise:** capture proceeds.
- **"Latest completed slate" means D only.** The route never reaches back to an older date. Each older date had its own day and its own claim. A missed date stays missed; that keeps the one-shot rule simple and auditable.

---

## 3. Storage: the packet

### 3.1 Why not `/tmp` alone

Vercel's `/tmp` dies with the instance. v6 uses it **only as a fast in-run journal** (§3.2). The durable packet lives in Supabase:

| Store | What | Why |
| --- | --- | --- |
| Private Storage bucket `blsh-native-packets` | the packet's files, byte-exact, at `native-v6/{D}/{run_id}/{file}` | Large bodies (≤ 2 MiB each) belong in Storage, not the DB, which is the repo's pattern (`player-forecast-models`). |
| `public.blsh_capture_runs` | one row per `(pipeline, source_date)`: claim, state, deployment facts, manifest sha256, timestamps | one-shot fence, state machine, monitoring |
| `public.blsh_capture_objects` | append-only rows `(run_id, ordinal, path, sha256, bytes, written_at)` | the integrity anchor: the service role can overwrite or delete Storage objects, but a trigger refuses UPDATE and DELETE on these rows (§8) |

File names and JSON shapes are **v5's**, so the bridge changes as little as possible:
- `STARTED.json`, `PLAN.json`, `RUNTIME.json`;
- `operation-N-STARTED/SETTLED.json`;
- `schedule.raw.json`, `{group}.parser-input.html`;
- `*.TRANSPORT-OBSERVATION.json`;
- `MANIFEST.json` or `FAILED.json`.

v6 drops the `source-*.ts` files (§4.2).

### 3.2 Journaling inside the 1-second permit: the hard constraint

- **Where the 1 s comes from:** the ledger itself (`receipt.permitTtlMs === 1000`, checked in `sharedAdmission.ts`). The client measures it from **before** sending admission. The v5 core adds its own `now + 1000` permit, taken at dispatch entry, **before** the journal write.
- **Why v5's pattern breaks:** v5 puts four durable writes between that entry and the NST send: admission STARTED, admission SETTLED, NST STARTED, plus the RPC itself. On the laptop those are fsyncs, ~1 ms each. Each remote write is a 50–200 ms round trip, so copying v5 would intermittently burn a production admission with no NST call.

**v6 rule:**

| When | Durable remote write (Storage or DB) | Local `/tmp` journal |
| --- | --- | --- |
| Before the schedule GET | `operation-1-STARTED` is uploaded **and** an intent row is written | same |
| After the schedule settles | `operation-1-SETTLED` and `schedule.*` | same |
| Before `admission:G` | **one** intent row `{run_id, group G, ops: [admission:G, nst:G], intendedAtUTC}`: "a permit and an NST GET may be consumed from here on" | — |
| admission:G STARTED/SETTLED and nst:G STARTED | **none** | written and fsynced (≈ ms) |
| After nst:G settles, or fails | flush `/tmp` files for ops 2–3 (or 4–5), plus the body and observation | — |

Lifecycle `begin`, `finish` and `hold` sit outside any permit window, so they are written remotely before and after, as v5 writes them locally.

**What an interruption leaves behind:**
- **Killed between the intent row and the flush:** the intent row stands, and the run row stays `claimed`. The watchdog (§7) marks it `abandoned_uncertain`. Both the admission and the NST GET are counted as **possibly consumed**. Nothing is re-run, and no success is invented.
- **Killed after the flush, before the manifest:** the objects exist, but there is no `MANIFEST.json`. The state is `abandoned_uncertain`, and the partial packet is kept for diagnosis.
- **A `/tmp` write fails:** the same `operation_journal_failed` stop as v5, before transmission.

### 3.3 The Supabase writer must not share the TLS path

- **What breaks if it does:** in-run writes go to the same host as the admission RPC (`fyhftlxokyjtpndbkfse.supabase.co`). Through the global fetch (`supabase-js`), a new admission socket could **resume** a TLS session cached by an earlier write. The resumption has no peer certificate and no full handshake observed in this run, so the core rejects it (`tls_resumed_without_full_handshake`) after the permit is spent.
- **Correction to an earlier note:** keep-alive reuse is **not** the risk. The adapter's `connectionReused` comes from its own module-level `WeakMap`, so a socket first opened by an unobserved write reads as a fresh connection that still has its certificate.
- **v6 writer:** claims, control reads, intent rows, Storage uploads and run-row updates all go through `node:https` with `new https.Agent({ keepAlive: false, maxCachedSessions: 0 })`.
  - That is a separate TLS stack from undici's fetch, so it shares no session cache and no sockets, and it emits nothing on `undici:client:sendHeaders`.
  - It needs no new dependency and does not touch the global dispatcher. The design rules out swapping the global dispatcher and using a dispatcher from transitively installed undici.
  - Writes never overlap a dispatch: the core's `active` guard serialises them.
- **To verify offline in Phase 2:** "a same-host write before admission" in the successor lane's `tls-loopback` harness (reused read-only).

### 3.4 Manifest-last and hashes

- Every object is uploaded with `x-upsert: false`, so an existing path refuses.
- After each upload, its `blsh_capture_objects` row is inserted with the sha256 computed in-process.
- `MANIFEST.json` lists every file with its sha256 and bytes. It is uploaded **last**, and then the run row moves to `packet_complete_pending_review` with `manifest_sha256`.
- **Completion requires all three:** the manifest object, its object row, and the run state.
- A reader downloads the bytes, recomputes the sha256s, and compares them against `blsh_capture_objects`, not against the bucket listing.

### 3.5 Retention and privacy

- **Content:** the public NHL schedule, and NST pages after the client's key redaction (the core keeps v5's `capture_credential_echo` check). Plus timing and TLS facts.
  - No credentials, request headers, cookies or personal data.
  - Environment variables are recorded as presence only; `valuesRecorded: false`.
- **Access:**
  - The bucket is private. RLS is on for both tables, with all privileges revoked from `anon` and `authenticated`.
  - Only the service role writes. Reads for review are a human-gated production read (§5).
- **Retention:**
  - Packets not referenced by a conversion are kept for **45 days**, then deleted by an explicit, approved retention function. It is not scheduled in v6.
  - Packets that a conversion or acceptance references are kept until **2027-09-30**.
  - Run and object rows are kept; they are small.
- **Size:** each packet is ≤ 8 MiB (v5's cap); about 1–3 MiB is expected. 45 days is about 50–150 MiB, and a full season about 0.5 GiB, if nothing is pruned.

---

## 4. Provenance: replacing the laptop pins

### 4.1 What v6 records (`RUNTIME.json`, version `fhfh.blsh.native-capture-runtime.v6-vercel`)

| Key | Content | Source |
| --- | --- | --- |
| `startedAtUTC` | equals `STARTED.json` | clock |
| `node` | `version`, `execPath`, `execPathSHA256` (or `null` if unreadable, plus the reason code), `execArgv` | process |
| `tls` | the same 4 CA keys as v5 (`root…SHA256/Count`, `defaultCA…SHA256/Count`) | `node:tls` |
| `environmentPresence` | the **same 15 keys** as v5, presence only | `process.env` |
| `supabaseOrigin`, `lifecycleMode`, `adapterEnvironmentPresence` | as v5 | env |
| `deployment` | `provider:"vercel"`, `deploymentId` (`VERCEL_DEPLOYMENT_ID`), `env` (`VERCEL_ENV`), `region` (`VERCEL_REGION`), `gitCommitSha` and `gitCommitRef` (`VERCEL_GIT_*`, or **null** for CLI deploys), `nextBuildId` (or null), `routeBundleSHA256`: the sha256 of this route's compiled server file, read at runtime | env and fs |
| `instance` | `coldStart` (the first invocation of this module), `invocationOrdinal`, `processUptimeMs` | module state |
| `globalDispatcher` | `present`, `constructorName`, `sameAsCoreLoad` | as v5 |
| `valuesRecorded` | `false` | — |

**Dropped entirely, with nothing equivalent on Vercel:**
- `launch.*`: entry script, bootstrap hash, `cwd`, `NODE_PATH`/`TS_NODE_*` presence;
- the node binary pin;
- `DYLD_*`;
- the checkout path;
- the launcher and attestation;
- the dependency-tree hash.

**Per operation:** the 15-key `tls` object, exactly as in v5. That includes `globalDispatcher.identityUnchanged` and the CA store re-read before and after each dispatch.

### 4.2 Things the bundle cannot prove (the bridge must get these elsewhere)

- **The `.ts` sources (producer, redactor, core) and `web/package-lock.json` are not in the deployed function.**
  - The bridge obtains their bytes **offline from git at the deployment's commit**: `git show <sha>:web/lib/blsh/nativeCaptureV6/adapter.ts`, and likewise for `web/lib/nst/client.ts` and the lockfile.
  - The SHA comes from `deployment.gitCommitSha`, or, for a CLI deploy, from the repo's release receipt that maps deployment id → SHA. Releases already record one.
- **Residual:** the link between the deployed compiled code and the git source rests on Vercel's build record and the release receipt. A packet cannot prove it.
  - `routeBundleSHA256` makes a deployment **consistent** across days. It does not tie the deployment to source, because Next builds are not byte-reproducible.
  - The Vercel API can confirm the deployment's SHA. That is a human-gated, read-only check.
- **Unknown until an approved probe on a real deployment.** Record these, and treat their required values as provisional:
  - which of the 15 override keys Vercel's runtime sets (`NODE_OPTIONS` especially);
  - whether the default CA store equals the bundled roots;
  - whether `process.execPath` is readable and how long hashing it takes;
  - whether this route's compiled server file is readable at runtime, which `routeBundleSHA256` depends on (otherwise null plus a reason code);
  - whether cheerio's npm undici registers the global dispatcher inside the Next server bundle, and so whether `constructorName === "Agent"`;
  - the warm-instance TLS-resumption failure rate (§7).

### 4.3 What the bridge's v6 runtime profile must accept (for Chef to route to the bridge lane; this lane does not edit `convert.mjs`)

1. `RUNTIME.version === "fhfh.blsh.native-capture-runtime.v6-vercel"`, with the key set above. `launch` is absent, and `deployment` and `instance` are present.
2. `checkRuntimeCore` without `runtime_node_binary_not_pinned` and without `ALLOWED_EXEC_ARGV`:
   - `node.version` must match `^v22\.`;
   - `execArgv` must be `[]` (provisional);
   - `execPathSHA256` is recorded and not pinned.
3. **Kept:** all 15 `environmentPresence` keys `false` (provisional until the probe); `defaultCA == bundled roots` (provisional); `valuesRecorded === false`; `startedAtUTC` binding; the pinned `supabaseOrigin`.
4. **Lifecycle:** accept the mode Chef confirms (§1.4).
   - In enabled mode: `adapterEnvironmentPresence.NST_JOB_LIFECYCLE_ENABLED === true`, `lifecycleMode === "enabled"`, and on a complete packet exactly **7** operations in this order: schedule, begin, admission, nst, admission, nst, finish. A failed packet may hold up to 8, with `hold` last.
   - In disabled mode: v5's rule (key absent, 5 operations).
5. **No `checkLaunch`.** In its place, `deployment.deploymentId` must be non-empty and `deployment.env === "production"`. The approved `{deploymentId → gitSha}` binding comes from a pins input, **not** from the packet.
6. **Producer and redactor bytes** come from `git show <approvedSha>:<path>`, hashed against the pins. `source-*.ts` files are absent from the packet.
7. **Plan, schedule finality, TLS chain, retrieval chronology and the 8-day rule:** unchanged, with the date taken from `PLAN.json`. The bridge already derives the date from the plan; check its game-id regex.
8. **Packet location:** a downloaded copy of `native-v6/{D}/{run_id}/`, whose sha256s must equal `blsh_capture_objects`. The download is a human-gated production read.

**Other lanes pinned to v5 (Chef to route):**
- `verify-packet.mjs` (`b86af692…`) and `READBACK.json`, which convert requires: needs a v6 mode.
- The boxscore tool `aa8a9cb7…` (pinned in `frames.mjs:31` and `bridge.test.mjs:475`) and the frames approval: needs v6 support (§5).
- The request reader (`run_live_read.py` `c23eb286…`, scope `d84a9547…`): candidate- and date-bound (`--candidate v5`, `eventThroughDate 2026-11-11`). It needs a per-date mode.
- `check-attestation.mjs` and `operator-attestation.py`: do not apply to v6. They are replaced by the deployment pins (item 5).

---

## 5. Downstream daily chain

**How the reviewed v5 chain is ordered (POST-CAPTURE.md):**
1. verify;
2. attestation;
3. **convert**;
4. request read;
5. boxscores;
6. frames;
7. deadline;
8. assemble, prepare, propose;
9. review.

Steps 4 and 5 both run **after** an approved conversion. The boxscore tool takes its game ids from the conversion's hash-checked `schedule.raw.json`, and its runtime binds `conversionSHA256` (ACQUISITION-SPEC). Conversion stays human (below), so a fully automated daily chain cannot keep that order.

**What v6 changes, and what each step needs:**

| Step | When (UTC, capture day C = D+1) | Who | Network | Needs | Gate | Binding time rule |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Capture (this route) | 12:05, backup 12:20 | pg_cron | 1 NHL + 2 NST + 2 admission (+ 3 lifecycle, enabled mode) | — | automatic once TJ approves the deploy, flag and schedule | 8-day freshness (`now − D < 8 d`) |
| 2. Boxscores: proposed route `POST /api/v1/db/blsh-boxscore-acquire` (**Phase 3**, not in Phase 2) | 12:35 | pg_cron, run only when the capture row is `packet_complete_pending_review`; its own one-shot claim `('boxscore-v6', D)` | **N** sequential GETs `https://api-web.nhle.com/v1/gamecenter/{id}/boxscore` (the URL in `acquire-boxscores.mjs:118`). N is the number of games in the packet's `completedGameIds`: 1–16, not 6. 0 retries, 1 s apart, 15 s and 4 MiB each, 120 s total. No NST traffic. | **The capture packet**, not a conversion. Ids are re-derived from the packet's own TLS-observed `schedule.raw.json` and must equal `completedGameIds`. The acquisition binds the packet's `manifest_sha256`. The route must reuse the same `withTlsObservation` observer and write a runtime receipt plus 14-key TLS facts per GET, as the v2 acquisition format does. | automatic, after TJ approves it, **and** after the bridge lane gives `frames.mjs` a v6 acquisition profile that binds the packet manifest instead of `conversionSHA256` and drops `launch` and the fixed laptop output path | frames ≤ 24 h before evaluation |
| 3. Request and context read | after conversion, within 12 h of T0 | **human-run by default**, with the existing reader (owner-role DB connection from `web/.env.local`) | one bounded read-only transaction (≤ 35 statements, ≤ 10,000 rows, ROLLBACK) | the native packet; a per-date reader mode (today it is bound to `--candidate v5` and 2026-11-11) | **TJ approval for each run**, as today | reader: after the latest native retrieval and **within 12 h of T0** (about 00:05Z on C+1) |
| 4. Verify, convert, assemble, prepare, propose | before the deadline, after one human-gated download | human or laptop, bridge tools | the download only | v6 profiles in verify-packet and convert (§4.3) | human | — |
| 5. Deadline check | before review | human | none | — | human | **capture age: evaluation ≤ T0 + 24 h** (about 12:05Z on C+1); **event age: eval date − D ≤ 7 d** (`maxEventAgeDays` 7) |
| 6. Independent review, then acceptance install | inside the 24 h window | reviewer, then Scout/Codex | — | — | **human (TJ)** | by T0 + 24 h, or the day expires |

`T0` is the earliest native retrieval, about 12:05:20Z on C.

**Why step 3 is not automated in v6:**
- The reader needs **one** `REPEATABLE READ READ ONLY` transaction of up to 35 statements ending in `ROLLBACK`. A Vercel route holds only the service-role REST key, and PostgREST runs each call in its own transaction, so a route cannot do this.
- **Automating it needs one of two production changes, both for TJ:**
  - a read-only login role whose credential lives in Vercel env (a new secret);
  - or a reviewed `security definer` SQL function, `blsh_request_context_v1(p_date)`, that does the bounded read in one call and returns bounded JSON. Its parity with the reader would need its own review.

**Daily realities:**
- **24 h binds before 7 days.** Any day nobody reviews simply expires. Nothing is re-captured; a re-capture would be a second live run.
- **The CLOSED policy admits 0 windows** (the bridge's finding). Daily packets therefore build evidence for policy work. They do not change any public number.
- **Automated:** step 1 in Phase 2; step 2 in Phase 3, if approved.
- **Human:** step 3 by default, and steps 4–6.
- **Always gated:** the public trade page, five-game windows, scores and prices, flags and deploys.

**Phase 2 scope:** the capture route (step 1), its migration, the watchdog SQL and the schedule file. `blsh-boxscore-acquire` is design-only until the frames profile decision. `blsh-request-context` is not built.

---

## 6. NST budget and slot

**Active NST traffic,** from the JSON inventory in `cron-schedule.md` (the source of truth), with `active` flags, plus `vercel.json`:

| UTC | Job (id) | Active | Notes |
| --- | --- | --- | --- |
| 07:25 | `update-nst-gamelog` (79) | **no** | unscheduled 2026-10-22 |
| 08:10 | `update-nst-tables-all` (17) | **no** | |
| 08:30 | `update-nst-goalies` (99) | yes | direct NST |
| 08:45 | `update-nst-current-season` (220) | yes | 4 URLs |
| 09:15 | `update-nst-team-stats-all` (329) | yes | |
| 09:55 | `update-nst-team-daily` (275) | **no** | |
| 09:55 | `update-nst-team-daily-incremental` (328) | yes | |
| 10:05–10:55 | `run-rolling-forge-pipeline` (Vercel cron, 9 triggers) | yes | its `upstream_skater_sources` fetches the previous day's NST gamelogs (about 20 a day) |

- **Not scheduled anywhere:** `check-missing-goalie-data`, `update-nst-player-reports`, `update-nst-last-ten` and the goalie catch-up are direct-NST routes (`nstClassification.ts`) run only on demand.
- **Ad hoc traffic:** `/db/runner` jobs (TJ) and user-triggered pages go through the same admission ledger.
- **After about 11:00Z, no scheduled NST caller exists.**

**Slot: 12:05Z, backup 12:20Z.**
- **The 10-minute rule.** `NST_MIN_CRON_BURST_GAP_MS` and `NST_ACTIVE_DIRECT_CRON_STARTS` in `web/lib/cron/nstCoordination.ts` require 10 min between direct NST cron starts. The nearest active start is 09:55, so 12:05 is 130 min clear. The backup is 15 min after the primary, and it only reaches NST if the primary never claimed.
- **Hourly window:** the latest band request is about 11:00Z, so its 1-hour window clears by about 12:00Z. v6's two GETs land in an empty 1 h, 15 m, 5 m and 1 m window and add at most 2 to each.
- **Margin:** the worst case is 2/39, 2/80, 2/100 and 2/180, even if another caller ran a full burst. The ledger, not the slot, is the authority: a denial is a clean, final, no-NST outcome for D.
- **Spacing:** 22 s between the two GETs, above the 21 s (`NST_MIN_REQUEST_INTERVAL_MS`) that satisfies all four windows.
- **Clear of other jobs:**
  - the 10:05–10:55 FORGE pipeline and the 11:xx sustainability and prediction crons (non-NST, but CPU and DB heavy);
  - the 11-17 pilot at 14:05Z, which v6 is fenced off anyway (gate 2).
- **Ordering:** it runs before the 13:00Z `cron-report`, which covers the trailing 24 h.
- **Data readiness:** the 10:05Z pipeline already relies on the previous day's NST gamelogs. By 12:05Z the latest West-coast finals (about 06:30Z) are about 5.5 h old.
- **Shared code to report, not edit.** Neither `NST_ACTIVE_DIRECT_CRON_STARTS` (`nstCoordination.ts`) nor `DIRECT_REMOTE_NST_JOBS` (`nstClassification.ts`) lists the new job. Without them:
  - the burst-clearance helper does not know the slot;
  - `cron-report` and the audit tooling classify `blsh-native-capture` as an unknown NST touch.

  Both are shared NST files, which this lane must not edit. **Chef should route a two-line registration to the lane that owns them.** It is not required for the route to work.

---

## 7. Failure modes, kill switch, monitoring, cost

**Run states:** `claimed`, `no_slate`, `refused_schedule`, `failed` (with a whitelisted reason code), `abandoned_uncertain`, `packet_complete_pending_review`. Only the watchdog sets `abandoned_uncertain`. Every state after the claim is terminal for D.

| Failure | Outcome | Date burned? |
| --- | --- | --- |
| Kill switch off, outside the window, pilot fence, wrong env or mode | refused before the claim, `cron_job_audit` row | no (the backup trigger may still claim, if inside the window) |
| Second trigger, or a manual re-trigger | `200 skipped: already_claimed`, no network | — |
| Admin JWT or other non-cron caller | `403` in the handler, before any gate | — |
| Schedule not final, postponed, or wrong game type | `refused_schedule`, 1 NHL GET | yes (TJ decision, §2) |
| Admission denied, invalid or expired | `failed: permit_not_usable`; 1 admission consumed, no NST for that group | yes |
| NST non-200, timeout, byte limit, parser shape, credential echo | `failed`; the partial packet is kept | yes |
| TLS: resumption without a full handshake **in this run**, or a socket first seen by a **previous warm invocation** (`tls_connection_unbound`) | `failed` after consumption | yes. **The rate is unknown, and it blocks approval of the *schedule*, not of this design.** It needs an approved probe on a real deployment (§4.2). |
| CA store or global dispatcher changed | `failed` before the next dispatch | yes |
| Function killed at `maxDuration` | the run row stays `claimed` → watchdog → `abandoned_uncertain`; intent rows show what may have been consumed | yes |
| Storage or DB write fails mid-run | before transmission: stop; after: `FAILED.json` best effort, partial objects kept | yes |
| Upload fails after a complete capture | no manifest → `failed: publication_failed` | yes (the evidence is incomplete) |

**Kill switch, in order of speed:**
1. `update public.blsh_capture_control set enabled = false`: instant, no deploy. The Phase 3 boxscore route reads the same switch.
2. `cron.unschedule('blsh-native-capture')` and the backup job.
3. The pilot-fence constant, and a redeploy, as a last resort.

**Monitoring:**
- `cron_job_audit` through `withOperationalRouteAuth`, which the 13:00Z `cron-report` already summarises.
- **Watchdog**, an SQL-only pg_cron job at **12:50Z** (file only, §8). It:
  - marks rows `claimed` for more than 10 min as `abandoned_uncertain`;
  - raises an audit row if the previous date had games (`games` table) but no run row exists.
- No new email channel. The X-poller Resend pattern exists if TJ wants one later.

**Cost (Vercel and Supabase):**
- **Capture:** 1–2 invocations a day.
  - Capture is about 25–60 s of wall time: 22 s spacing plus the operations, and about 10–20 s of uploads.
  - The refused backup is under 1 s.
  - At 1 GB memory that is about 0.02 GB-h a day, or about 4 GB-h a season.
- **Boxscore route (Phase 3, if approved):** about 20 s a day.
- **Transfer:** about 3–6 MiB out a day.
- **No builds:** v6 adds no Vercel cron. The schedules live in pg_cron.
- **Storage:** about 1–3 MiB a day (§3.5), well inside the plan's included Storage.
- **Not a cost:** DB rows are small. NST and NHL traffic is free, but rate-limited.
- **One deploy is needed**, after TJ's approval, together with the next release candidate. There is no separate deploy for v6.

---

## 8. Migrations: files only, never applied by this lane

1. **`supabase/migrations/2026111x_blsh_native_capture_v6.sql`** (tables and bucket; it is inert until the route is deployed and the switch is flipped):
   - **`blsh_capture_control`:** singleton, `enabled boolean not null default false`, `updated_at`.
   - **`blsh_capture_runs`:**
     - columns: `run_id uuid pk`, `pipeline text`, `source_date date`, `state`, `reason`, `claimed_at`, `closed_at`, `deployment jsonb`, `lifecycle_mode`, `manifest_sha256`, `operation_intents jsonb[]`;
     - **`unique (pipeline, source_date)`**;
     - a state-transition trigger: `claimed` → a terminal state, once; terminal rows are immutable; DELETE is refused.
   - **`blsh_capture_objects`:** an append-only trigger refuses UPDATE and DELETE except through `blsh_capture_retention_v1(p_before date, p_dry_run boolean default true)`, which sets a transaction-local GUC the trigger checks.
   - **Bucket:** `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('blsh-native-packets', …, false, 2621440, '{application/json,text/html}') on conflict do nothing`.
   - **Security:** RLS on, all privileges revoked from `anon`, `authenticated` and `public`, granted to `service_role`. The functions are `security definer` with `set search_path = ''`.
2. **`tasks/artifacts/blsh-cron-v6-2026-11-15/schedule/SCHEDULE.sql`**, deliberately **outside** `supabase/migrations/` so that `db push` cannot apply it:
   - **`fhfh_internal.invoke_blsh_endpoint(p_path)`:** mirrors `invoke_player_forecast_endpoint`. It allows only `^/api/v1/db/blsh-native-capture$` (widened to `blsh-boxscore-acquire` only if Phase 3 is approved), gets `site_url` from Vault and `require_cron_request_headers()`, and uses `timeout_milliseconds 240000`.
   - **`cron.schedule` entries:**
     - `'5 12 * * *'` and `'20 12 * * *'` for the capture;
     - `'50 12 * * *'` for the watchdog (SQL);
     - Phase 3 only, if approved: `'35 12 * * *'` for boxscores;
     - a matching `cron.unschedule` rollback block.
   - The `cron-schedule.md` inventory entry is drafted beside it, not edited in place, until TJ approves the schedule.

---

## 9. Tests and offline rehearsal (Phase 2)

**Vitest, run one file at a time with `GIT_DIR` unset. Then `npm run typecheck`, reading the exit code.**
- **`sourceDate.test.ts`:**
  - D from the clock at window edges (11:59:59.999Z refused; 12:00Z and 12:29:59.999Z allowed; 12:30Z refused);
  - pilot fence through 2026-11-18;
  - season bounds;
  - month and year rollover.
- **`core.test.ts`**, ported from v5's `nativeProcessCaptureRunner.test.ts` cases with a fake sink:
  - order and the operation budget (5 and 8);
  - 22 s spacing, permit expiry and the 120 s deadline;
  - one stop per failure, with no retry;
  - schedule finality for an arbitrary D (no slate, postponed, duplicate keys, wrong id range);
  - **the permit window with a slow remote sink**: a 300 ms simulated remote write must not sit between admission and NST, and only `/tmp` writes may;
  - TLS rules unchanged;
  - credential echo;
  - manifest-last.
- **`sink.test.ts`:**
  - upload order and sha256s;
  - `x-upsert:false` refusal;
  - an object row per file;
  - manifest last;
  - failure leaves no manifest;
  - interruption after the intent row leaves `claimed` plus the intent;
  - the writer uses `node:https` with `maxCachedSessions: 0` (asserted on the agent).
- **`claim.test.ts`:** unique conflict → `already_claimed`; refusals before the claim leave no row.
- **`runtimeReceipt.test.ts`:**
  - exact key set;
  - presence-only env;
  - `deployment` fields with and without `VERCEL_GIT_COMMIT_SHA`;
  - `valuesRecorded:false`.
- **Route test (`blsh-native-capture.test.ts`):**
  - 401 without the bearer, 405 on GET;
  - kill switch, window, mode mismatch;
  - 403 for an admin JWT, before any Supabase call by the handler;
  - claim conflict → 200 skip;
  - the audit runs after the handler.
- **Migration test:** SQL assertions in `supabase/tests/` style (trigger refusals, unique claim), runnable only against a local database. **Not run against production.**

**Offline rehearsal**, in `tasks/artifacts/blsh-cron-v6-2026-11-15/rehearsal/`:
- It runs the real route handler in-process against loopback TLS servers, with a reserved `.invalid` Supabase origin and fake NST/NHL hosts.
- It reuses the successor lane's `tls-loopback` harness approach (read-only; nothing in that folder is changed).
- **Scenarios:**
  - happy path;
  - no slate;
  - admission denied;
  - a same-host write before admission (must stay TLS-clean through the isolated writer);
  - warm-instance resumption (must fail closed);
  - a kill mid-run (intent row, then watchdog);
  - double trigger.
- **0 real network attempts**, asserted.

**Not runnable offline:** Vercel's runtime facts (§4.2) and the warm-instance rate. Both need a separately approved probe on a deployment.

---

## Decisions needed (Chef to TJ)

1. **Lifecycle mode:** the production values of `NST_JOB_LIFECYCLE_ENABLED` on Vercel and `nst_job_control.enforced` (§1.4).
2. **Postponed games:** whether `refused_schedule` with zero NST calls may release the claim. The default is no.
3. **Request read:** it stays human-run by default (§5). Automating it needs either a read-only login role or a reviewed `security definer` SQL function; both are production changes.
4. **Slot:** 12:05Z, with the 12:20Z backup (§6).
5. **Vercel system env:** whether "Automatically expose System Environment Variables" is on. Otherwise `VERCEL_DEPLOYMENT_ID` and the git SHA are absent, and v6 refuses at gate 5.
6. **Bridge, reader, verifier and boxscore-tool lanes:** v6 profiles (§4.3, §5), routed by Chef.
7. **Shared NST registration:** a two-line addition to `nstCoordination.ts` and `nstClassification.ts` (§6), owned by another lane.
8. **Boxscores:** whether to automate step 2 in Phase 3, bound to the packet manifest instead of a conversion (§5).

---

## As built (Phase 2, 2026-11-15; revised after V6-REVIEW c0789453)

**How this file relates to the approval:**
- Everything above this section is byte-identical to the design TJ approved (`f6f78878`). That copy is kept as `DESIGN-APPROVED-f6f78878.md`.
- This appendix is the only addition. Where it disagrees with the text above, the appendix and the code win.

**Chef's decisions:**
- disabled mode, 5 operations;
- the request read as a SECURITY DEFINER function file;
- boxscores in Phase 3;
- `refused_schedule` keeps the claim.

### Errata to the approved text

- **§0, TLS observer (release blocker, 2026-11-15):** origin/master's v5 adapter predated v5, so master + v6 alone did not compile. Chef's decision (2026-11-15): the RC (c2b3bd24c) ships v5 (348a122d6) on top of origin/master, so v6 imports the observer from the v5 adapter unchanged, as reviewed. The verbatim copy is not used; its bytes are kept in release/fix-tls-observer/ for reference only.
- **TLS observer, M1 fix (2026-11-16; TJ chose M1-FIX-DESIGN parts 1 and 3):** the observer is v6's `tlsObservation.ts`. It copies v5's socket-fact block verbatim, and attributes requests by async context so Fluid's shared instances cannot break or join an observation. Gate 5.5, a loopback observer self-test, runs after the kill switch and before the claim; a refusal is a 503 that does not burn D. See M1-FIX-DESIGN.md.
- **§1, gate order:** every check that does no I/O runs first: cron bearer, clock (fence and window), environment, runtime precheck. The kill-switch read follows, then the plan and adapter, then the claim (`handler.ts` header).
- **§1, `maxDuration`:** 250, not 240. The route and `web/vercel.json` both set it, so Vercel bundles the route as its own function (M1).
- **§1, time budget (review L7):** uploads are **not** budgeted after the 120 s capture.
  - Publication must finish inside the same 120 s; otherwise the run fails with `publication_after_deadline`.
  - The pre-schedule checkpoint has its own 20 s budget, which runs before the schedule GET's 15 s timer is armed (L2). It still counts toward the 120 s.
- **§3.2, intent rows (review L7):** there is **no** intent row before the schedule GET.
  - The schedule GET is preceded by a remote checkpoint: STARTED, PLAN, RUNTIME and `operation-1-STARTED.json` are in Storage before it is sent.
  - Intent rows exist only for the two admission+NST pairs, one per group, and the SQL allows exactly those two, in order.
- **§3.4, partial completion (review L7):**
  - Completion needs all three: `MANIFEST.json` recorded as the last object, its row, and the run row closed as `packet_complete_pending_review` (or `no_slate`) with that manifest's sha256.
  - If the deadline or the close fails after the manifest upload, the run is `failed`, or left `claimed` for the watchdog, **with a recorded MANIFEST.json**. A reader must key on the run state, never on the manifest alone.
- **§3.5, retention (review L5):** object and run rows are **kept forever**. Pruning is three owner-only steps, never scheduled:
  1. `blsh_capture_retention_v1(p_before)` lists the paths of closed, not-kept runs older than 45 days;
  2. the bytes are deleted through the Storage API;
  3. `blsh_capture_mark_pruned_v1(run_id)` sets `pruned_at`, and refuses while any of the run's bytes remain.

  Neither function is executable by `service_role`.
- **§8, bucket (review L6):** after the insert, the migration refuses an existing `blsh-native-packets` bucket unless it is private, 2.5 MiB, and JSON/HTML only.
- **§2, missing day (review L1):** a schedule body without D's day entry is `schedule_shape_invalid` (failed). Only a present day with `games: []` is `no_slate`.
  - Not yet checked against a real NHL off-day body; that is PROBE-LIST item 12.
- **§4.1, RUNTIME:** final shape in PROFILE-SPEC.md §3.
  - `nextBuildId` is dropped.
  - `node.execPathUnavailable` and `deployment.routeBundleUnavailable` are added.
  - `globalDispatcher` keeps v5's key, `sameAsRunnerLoad`.
- **§7, watchdog:** two SQL jobs, mark at 12:50 and assert at 12:52, so a raised alert never rolls back the marking. The assert also raises on `no_slate` when `public.games` lists games for D.

### Pointers

- **Code layout:** there is no `claim.ts`; the claim, intent, object and close calls live in `writer.ts` as `CaptureStore`, and the state machine is in the SQL RPCs.
- **M1 (in-process isolation):** `M1-ISOLATION.md`.
- **Core and adapter deviations from v5:** CORE-DEVIATIONS.md, with `core-v5.diff` for the hunks.
- **Request read:** REQUEST-CONTEXT.md.
- **Shared NST registration:** REGISTRATION.md. It must land together with `schedule/CRON-SCHEDULE-ENTRY.md` (see that file).
- **Schedule:** `schedule/SCHEDULE.sql`, not applied.
