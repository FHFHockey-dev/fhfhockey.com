# BLSH v6 M1 fix (A′-core context tagging + pre-claim self-test): independent review

**Reviewer:** the same independent session that raised M1 (V6-REVIEW `c0789453`) and rechecked v6 (V6-RECHECK `afe7ecc0`). Requested by Chef on 2026-11-16 UTC.

**Conditions:**
- Offline and read-only. Nothing committed, deployed or applied.
- `GIT_DIR` was unset in every run.
- Tests and experiments ran in a scratch export: HEAD `web` and `supabase`, with the working-tree `nativeCaptureV6/` copied in (its directory is identical to the working tree). They ran under `sandbox-exec`, with outbound network denied except localhost and Unix sockets.
- The experiments used a throwaway self-signed certificate in scratch, on loopback only.
- No web access this time.

**Design:** `M1-FIX-DESIGN.md` is `95451447…`. The TJ-chosen text is kept as `M1-FIX-DESIGN-APPROVED-daa9c051.md`, whose hash I confirmed as `daa9c051…`. The current file differs only in its status header and two disclosed notes: the self-test is unverified until probe B-M1b, and a mismatch keeps v5's single code.

## Verdict

**APPROVE parts 1 and 3** for commit and an inert deploy. This closes M1 **in code**: concurrent traffic from other invocations in a Fluid instance can no longer fail a run.

**Scheduling** (`SCHEDULE.sql`, `enabled = true`) **stays gated by probe B:**
- **B-M1a:** the route deploys as its own function (250 s). This decides part 2.
- **B-M1b:** the gate-5.5 self-test passes in production (loopback listen, `node:http` dynamic import). If it fails, every trigger returns 503 every day, with no date burned but every capture missed.
- **The earlier probe items:**
  - 6: dispatcher anchor in the Next bundle;
  - 7 and 8: warm-instance TLS;
  - 12: off-day body;
  - 13: dashboard Storage policies.
- **Also:** REGISTRATION landing with the inventory entry, and TJ's approvals.

## Checks

### (1) The copied lines: PASS

- `web/scripts/blsh/nativeProcessCaptureAdapter.ts` is `aa6237bd…`, equal to `git show 348a122d6`.
- Its lines 14–52 hash to `f05d54f679df9405…`.
- `tlsObservation.ts` lines 16–54 (between the BEGIN/END VERBATIM markers) are **byte-identical** to them (`cmp`).
- `tlsObservation.test.ts` pins the hash, and compares bytes directly while the v5 file is `aa6237bd`.
- The only code outside the block is:
  - a local `need`;
  - `withAttributedRequests`, which uses AsyncLocalStorage plus `undici:request:create`, matched to `undici:client:sendHeaders` by request-object identity;
  - `withTlsObservation`, which keeps v5's origin/path/method match and `socketTls`, and requires `created === 1 && events.length === 1 && events[0] !== null`;
  - `observerSelfTest`.

### (2) Concurrent traffic is ignored, and exactly one tagged request is still required: PASS

My code reading:
- the listeners never throw;
- they subscribe only for the action's duration and unsubscribe in `finally`;
- the ALS context is entered only around `action`;
- attribution is by object identity, not by URL.

My experiment on the **production dispatcher path** (`repro/v6/m1-npm-undici-plain.mjs`, output `.out`):
- **Setup:** plain Node 22.23.4 with no test-runner module loading. `require("cheerio")` registers **npm undici 7.29.0**'s `Agent` as the global dispatcher, which I confirmed with `instanceof`. The design's own experiment used Node's bundled 6.29.1. The run used real loopback **HTTPS** and loaded the observer file byte for byte with `--experimental-strip-types`.

| Case | Result |
|---|---|
| E1: 40 rounds, each with 6 concurrent POSTs to the **same** origin, path and method from other async contexts, before and during ours | **40/40 attributed correctly**, `authorized: true` |
| E2: a second request created inside the action | `capture_tls_observation_missing` (fails closed) |
| E3: our request to another path | `capture_tls_observation_missing` |
| E4: **a context-propagation break** (a request created by a loop started outside the action) | `created=0` → `capture_tls_observation_missing` |
| E5: the action sends nothing | `capture_tls_observation_missing` |
| E6: the self-test with concurrent noise | `null` (pass) |
| E7: the dispatcher is unchanged afterwards | npm `Agent` |

**Both the admission and NST steps** are covered by the lane's `core.test.ts`. Its fake transport publishes `undici:request:create` at the frozen client's real `fetch` call site, plus foreign events from a separate `AsyncResource` context, at all 5 operations. The run completes, and no foreign socket fact (`EE…`) is stored.

The frozen `sharedAdmission.ts` and `client.ts` call `fetch` directly from awaited code. Their only timers are `setTimeout`, which keeps the async context, and there are no queues or emitters. So the self-test's direct-fetch shape is representative of production.

**A Vitest-only quirk, for future checks:** inside Vitest, an `Agent` is registered before any fetch, but a class-identity check against npm undici fails across Vitest's module loading. That is why the definitive run is plain Node (`repro/v6/m1-npm-undici.experiment.test.ts` and `.out` keep the Vitest attempt). E1–E6 also passed there.

### (3) The self-test runs before the claim, and failure is a free refusal: PASS

- **Placement:** `handler.ts` gate 5.5 runs after the kill switch reads `true` and after the plan and adapter, and **before** `store.claim`.
- **Failure:** a refusal or a throw returns 503 `observer_selftest_failed`, with no claim.
- **Proof:** `handler.test.ts` checks both: `fake.runs.size === 0`, `run` not called, and no self-test while the kill switch is off.
- **The self-test itself:**
  - it is HTTP on `127.0.0.1:0` with `connection: close`, a 3 s abort and server cleanup in `finally`;
  - an untagged concurrent fetch runs alongside, with its rejection handled at creation;
  - it never touches `socketTls` or `connections`.
- **Free per invocation, not per day:** the design header says this outright. B-M1b decides it.

### (4) No other behaviour change against V6-RECHECK: PASS

- **Committed v6 = what I rechecked:** HEAD's v6 files, the route, `vercel.json` and both migrations are byte-identical to my V6-RECHECK baseline (`ae8caef1` bytes).
- **The working-tree delta is only:**
  - `adapter.ts`: one import path plus a comment;
  - `handler.ts`: the gate 5.5 call and its `selfTest` dependency;
  - the new `tlsObservation.ts`;
  - tests.
- **Unchanged:** `core.ts`, `sink.ts`, `writer.ts`, `runtimeReceipt.ts`, `sourceDate.ts`, the route, `vercel.json` and the migrations. No diff against HEAD in `web/scripts`, `web/lib/nst`, `web/lib/cron`, `web/utils` or the package files.
- **Docs:** CORE-DEVIATIONS (adapter deviation 4), PROFILE-SPEC (the producer now includes `tlsObservation.ts`; the bridge must pin it) and the M1-ISOLATION "superseded in part" note are updated.
- **v6 `SHA256SUMS`:** `aae79c94…`, all OK.

**Runs** (scratch, sandboxed):

| Run | Result |
|---|---|
| v6 Vitest, 9 files | **61/61** |
| Plus the census files (`nstClassification`, `nstCoordination`, `combinedCronInventory`, `operational-route-auth`) | 13 files, **182/182** |
| Plain-Node experiment | **PASS** |
| Typecheck and eslint | not re-run (Chef's runs) |

### (5) Does this close M1 for scheduling with Fluid ON?

**It closes M1's mechanism in code. Scheduling waits for probe B (above). The residuals:**

1. **TLS resumption from a session cached by another invocation (pre-existing, unchanged).**
   - A new connection at `admission:individual` resuming such a session fails closed (`tls_resumed_without_full_handshake`) after the permit is spent, with no NST GET. That burns D, and the 12:52 assert reports it.
   - **Measured** (`repro/v6/m1-resumption-plain.mjs`): on npm undici 7.29.0, a request from another context, then a forced new connection, gave a **full handshake** for both TLS 1.3 and 1.2 (no resumption, peer certificate present).
   - That is loopback with Node's server, not Supabase's edge, so it is not proof. It suggests the rate is low, and probe item 7 still measures it.
2. **The deferred part 2: a foreign-opened keep-alive socket** (for example one left by another invocation's audit insert).
   - Our request can ride it and is recorded `connectionReused: false`. The **TLS facts are the socket's real facts**, but "fresh connection" is not proven. E1 showed this class happening routinely.
   - Under part 1 this is **not** a burn risk.
   - **The bridge must not read `connectionReused: false` as "opened by this run"** until part 2 (or option A) lands. PROFILE-SPEC should say so explicitly; today it says the connection semantics are v5's.
3. **New, minor: the `connections` map lives at module level.**
   - Under Fluid it persists across invocations. A socket observed in a previous capture and reused within the idle keep-alive (about 4 s) would bind to a previous run's sequence, and the core fails `tls_connection_unbound`.
   - With one capture a day, this is negligible. It fails closed.
4. **Unknown runtime fetch wrapping** (Next or Vercel patching `fetch` across contexts) gives `created=0`. The self-test catches it pre-claim if B-M1b passes.

## Findings

- **Low 1:** the self-test's fetch passes `cache: "no-store"`, which the frozen admission and NST calls do not. Under a runtime-patched `fetch`, different options could take different paths, so the self-test could pass while production differs, or the reverse. **Fix:** mirror the production call shape (method plus `redirect`/`signal` only), or document why `no-store` is needed.
- **Low 2:** add the residual 2 caveat to PROFILE-SPEC for the bridge, and record residual 3 next to it.
- **Info:** the self-test also runs on the 12:20 backup (an enabled invocation) before it learns `already_claimed`. Harmless: loopback only, ≤ 3 s.

## Files

- `repro/v6/m1-npm-undici-plain.mjs` and `.out`: the plain-Node experiment on npm undici 7.29.0 (production path).
- `repro/v6/m1-resumption-plain.mjs` and `.out`: the cross-context resumption check.
- `repro/v6/m1-npm-undici.experiment.test.ts` and `.out`: the Vitest attempt; E0 shows the identity quirk, E1–E6 pass.
- `logs/v6-m1/vitest.log`.
