# v6 packet and runtime profile (for the bridge, verifier and reader lanes; Chef routes)

**Status:** final for Phase 2. The shapes below are what `web/lib/blsh/nativeCaptureV6/*` writes. They are fixed by tests (`runtimeReceipt.test.ts`, `core.test.ts`). This lane edits none of `convert.mjs`, `verify-packet.mjs`, `export_context.cjs`, `frames.mjs` or `acquire-boxscores.mjs`.

## 1. Where a packet lives

- **Storage:** private bucket `blsh-native-packets`, key `native-v6/{D}/{run_id}/{file}`.
- **Index:** `public.blsh_capture_objects (run_id, ordinal, path, sha256, bytes)`, append-only, with contiguous ordinals.
- **Completion:** the last object is `MANIFEST.json`, and `public.blsh_capture_runs.state` is `packet_complete_pending_review`, with `manifest_sha256` equal to that object's sha256.
- **A local copy for the bridge:** one human-gated production read downloads every object of the run. The bridge recomputes each sha256 against `blsh_capture_objects`, not against the bucket listing.
- **Other states** (`no_slate`, `refused_schedule`, `failed`, `abandoned_uncertain`) are never convertible.
- **Key on the run state, never on MANIFEST.json alone.** A `failed` or `abandoned_uncertain` run can carry a recorded `MANIFEST.json`, if the deadline or the close failed after the upload (review L7).

## 2. Files (v5 names, except where noted)

| File | v6 vs v5 |
| --- | --- |
| `STARTED.json` | `version: "fhfh.blsh.native-capture-run.v6"`; keys `version, startedAtUTC, supabaseOrigin, lifecycleMode ("disabled"), sourceDate, runId, deploymentBinding`. **No `sourceBindings`.** |
| `PLAN.json` | unchanged (`prepareNativeProcessCapture` output; date = D) |
| `RUNTIME.json` | new version and keys (§3) |
| `operation-{1..5}-STARTED.json` | unchanged keys (`operation, url, method, startedAtUTC`); never a `jobToken` |
| `operation-{1..5}-SETTLED.json` | unchanged keys (`operation, completedAtUTC, permit, transport, tls`); `tls` is the same 15-key object (with `globalDispatcher.identityUnchanged`) |
| `schedule.raw.json`, `{individual,onIce}.parser-input.html` | unchanged |
| `*.TRANSPORT-OBSERVATION.json` | same keys as v5, except `sourceBindings` is replaced by `deploymentBinding: { deploymentId, gitCommitSha, routeBundleSHA256 }` |
| `source-*.ts` | **absent**: the deployment has no `.ts` sources |
| `MANIFEST.json` | v5 keys plus `sourceDate` and `runId`. There is no `.MANIFEST.json.tmp` link step; completion is §1. |
| `FAILED.json` | failure only; adds `runState` and `reason` (a whitelisted code) |

The operation order is exactly the 5 operations in disabled mode: schedule, then admission and NST for individual, then admission and NST for onIce. There are no begin, finish or hold operations.

## 3. `RUNTIME.json` (`fhfh.blsh.native-capture-runtime.v6-vercel`)

**Exact top-level keys:** `version, startedAtUTC, node, tls, environmentPresence, supabaseOrigin, lifecycleMode, adapterEnvironmentPresence, deployment, instance, globalDispatcher, valuesRecorded`. Compared with v5, `launch` is removed and `deployment` and `instance` are added.

| Key | Shape | Bridge rule (proposed) |
| --- | --- | --- |
| `node` | `{version, execPath, execPathSHA256 \| null, execPathUnavailable \| null, execArgv}` (**5 keys**; v5 had 4) | `version` must match `^v22\.`. `execArgv` must be `[]` (provisional). `execPathSHA256` is recorded, **not pinned**: Vercel patches Node. |
| `tls` | v5's 4 CA keys | unchanged: default store == bundled roots (provisional until the probe) |
| `environmentPresence` | v5's 15 keys, booleans | all `false` (provisional). Chef's names-only listing shows `NODE_OPTIONS`, `NODE_USE_SYSTEM_CA`, `OPENSSL_CONF` and `NODE_EXTRA_CA_CERTS` absent from Vercel production. |
| `supabaseOrigin` | pinned project | unchanged |
| `lifecycleMode` | `"disabled"` | unchanged |
| `adapterEnvironmentPresence` | v5's 4 keys | unchanged: `NST_JOB_LIFECYCLE_ENABLED === false` (absent); the other three `true` |
| `deployment` | `{provider: "vercel", deploymentId, env, region, gitCommitSha \| null, gitCommitRef \| null, routeBundleSHA256 \| null, routeBundleUnavailable \| null}` | `deploymentId` must be non-empty and `env === "production"`. **`{deploymentId → gitSha}` comes from a pins input, never from the packet**: the release receipt, or the Vercel API record of that deployment. `gitCommitSha` is null for a CLI deploy. |
| `instance` | `{coldStart, invocationOrdinal, processUptimeMs}` | recorded. A bridge may choose to report `coldStart: false`. Whether to refuse it is a policy decision; the TLS rules already fail closed on a warm-instance resumption. |
| `globalDispatcher` | `{present, constructorName, sameAsRunnerLoad}` | `{true, "Agent", true}`, with the same key as v5 |
| `valuesRecorded` | `false` | unchanged |

**Removed from v5:**
- `launch.*`: the bootstrap, `cwd == WEB_ROOT`, `NODE_PATH`/`TS_NODE_*` presence and `entryIsBootstrap`;
- the node binary pin (`runtime_node_binary_not_pinned`);
- `ALLOWED_EXEC_ARGV`;
- `DYLD_*`;
- operator attestation (`check-attestation.mjs`, `operator-attestation.py`).

## 4. Producer and redactor bytes

- **Producer:** `web/lib/blsh/nativeCaptureV6/adapter.ts` and `web/lib/blsh/nativeCaptureV6/tlsObservation.ts`.
  - **The observer is v6's own** (M1 fix (2026-11-16; TJ chose M1-FIX-DESIGN parts 1 and 3)). It is no longer v5's, imported unchanged.
  - **What stays v5's:** `tlsObservation.ts` keeps v5 adapter lines 14–52 verbatim: the channel constant, types, `connections` and `socketTls`. So the TLS facts and the `connectionReused`/`connectionSequence` semantics in TRANSPORT-OBSERVATIONs are v5's. The block's sha256 is `f05d54f6…`, from `aa6237bd`; `tlsObservation.test.ts` pins it.
  - **What is new:** `withTlsObservation` counts only the undici requests created inside the observed action's own async context, so another invocation's traffic in the same Fluid instance is ignored. Exactly one attributed request is still required, with v5's origin/path/method match.
  - **Packet fields:** no observation field changed shape.
  - **For the bridge:** pin `tlsObservation.ts` alongside `adapter.ts` at the approved SHA, and stop pinning `web/scripts/blsh/nativeProcessCaptureAdapter.ts` as a v6 producer.
- **Core:** `web/lib/blsh/nativeCaptureV6/core.ts`.
- **Redactor:** `web/lib/nst/client.ts`.
- The bridge gets their bytes **offline** with `git show <approvedSha>:<path>` and hashes them against the pins input, at the SHA that §3's pins map the deployment to.
- **Residual:** the link between the compiled deployed code and that source rests on Vercel's build record and the release receipt. A packet cannot prove it (DESIGN.md §4.2).

## 5. Lane-by-lane changes needed

- **`convert.mjs`:**
  - a `v6` candidate that uses §3 instead of `checkRuntime`/`checkLaunch`;
  - a 5-operation journal (unchanged);
  - producer and redactor bytes from git (§4);
  - `deploymentBinding` in place of `sourceBindings`;
  - the date from `PLAN.json` (already the case);
  - no `source-*.ts` files.
- **`verify-packet.mjs` (READBACK.json):** a v6 mode with the same differences. Completion is the manifest-last object order plus the run state (§1), not a hard link.
- **`acquire-boxscores.mjs` / `frames.mjs`:** Phase 3 (the boxscore route), not now.
- **Request reader (`export_context.cjs`):** accept a capture made by `blsh_request_context_v1` (see REQUEST-CONTEXT.md):
  - `captureContext: "definer_function_request_context_v1"`;
  - a RESULT with `executionMode: "definer_function_request_context_v1"`, `atomicDatabaseSnapshot: true` (one STABLE statement), and no session to close.
  - The request's exact-key shape is unchanged and already passes `checkRequestShape` (`requestContext.test.ts`).
