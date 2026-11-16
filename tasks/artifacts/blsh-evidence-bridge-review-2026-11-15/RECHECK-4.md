# Recheck 4: bridge rebound to successor v5 (2026-11-15)

**Rules (unchanged):** read-only, scratch only, no git mutation; no network, provider, DB, ledger, credential or `.env` access. Every live-socket reproducer is loopback-only. The tool's real fixed output path was never created.

**Bytes:** bridge `SHA256SUMS` passes in full (29 entries). Matches Chef's message:
- `convert.mjs 54e3d624…`, `acquire-boxscores.mjs aa8a9cb7…`;
- `tests/bridge.test.mjs 1eeb6144…`, `tests/fixtures.mjs 81e054e4…`;
- `approved/UPSTREAM-PINS.json 4678911d…`;
- vendored `approved/v5/`: patch `e8be50de…`, verifier `b86af692…`, pins `a2a1e694…`. These equal the live successor folder.

A scratch `patch -p1` of v5 gives runner `a74cbb0a…`, adapter `aa6237bd…` (unchanged) and bootstrap `dbf69c47…`, matching the pins and `APPROVED.bootstrapSHA256`. `frames.mjs` (`9a5875dc…`) and `lib.mjs` are unchanged since RECHECK-3.

**Suite:** 21/21 in a scratch mirror (184 s), on the bytes above, against the **vendored v5 verifier `b86af692…`** and pins `a2a1e694…`. As in every previous recheck, my one-line scratch fixture edit pointed `WEB` at the canonical `web/`.

**New reproducers in `repro/v5/`:** `rehearse-preinstall.ts` (scratch copy of the v5 `rehearse.ts` plus a preinstall block), `tls-connect-patch.cjs`, `units-v5.mjs`, `forge-v5-conversion.mjs`, plus `repro/acq3/wrapper-happy.mjs`.

## Verdicts

| # | Item | Verdict |
| --- | --- | --- |
| 1 | Tool diff `4f8a0888 → aa8a9cb7` is only the APPROVED constants and a comment | **PASS** |
| 2 | `checkRuntime` / `verifyTlsChain` require exactly v5's dispatcher facts and refuse v4 | **PASS** |
| 3 | Dispatcher design sound? What residual does the undici-only dependency check close? | **Sound against registry swaps after the runner loads. NOT sufficient on its own:** a `tls.connect` wrapper defeats it (reproduced), and so does a pre-runner install, unless the bootstrap really ran. The undici-only check closes only tampering *inside undici*. |
| 4 | Regressions vs RECHECK-3 | **None** |

### **APPROVE tool hash aa8a9cb7… for APPROVED_ACQUISITION_TOOLS**

- **The tool is unaffected by item 3's residual:** it loads no npm modules and refuses any preload, so nothing else runs in its process. This approves those bytes only, for **v5-approved conversions**: v4 conversions are now refused.
- **Running it** still needs TJ's separate approval.
- **Item 3 is a capture precondition,** not a tool defect (see the precondition list).

---

## 1. Tool diff: PASS

`diff` of my RECHECK-3 copy (`4f8a0888…`) against `aa8a9cb7…`:
- **`APPROVED.pinsSHA256`:** `f2f639ea…` → `a2a1e694…`;
- **`APPROVED.verifierSHA256`:** `04a632ba…` → `b86af692…`;
- one comment line added.

Nothing else changed: `nodeSHA256` and `lineageSHA256` are unchanged, and the code is byte-identical. The CLI now gives `conversion_not_approved` for a v4 conversion.

## 2. v5 dispatcher facts: PASS

**`checkRuntime`** requires the RUNTIME key `globalDispatcher` to be exactly `{present: true, constructorName: "Agent", sameAsRunnerLoad: true}`.

**`verifyTlsChain`** in packet mode requires the 15-key per-operation `tls`, with `globalDispatcher` keys exactly `{present, constructorName, identityUnchanged}`: `present` and `identityUnchanged` true, `constructorName` equal to RUNTIME's. `convertPacket` always passes `runtime.globalDispatcher ?? null`, so packet mode cannot be skipped.

Probes (`units-v5.mjs`, run on a real v5 rehearsal packet with no verifier in the loop):

| Probe | Result |
| --- | --- |
| v5 RUNTIME and ops as written | accepted / accepted |
| RUNTIME without `globalDispatcher` (v4 shape) | `runtime_unexpected_keys` |
| `sameAsRunnerLoad: false` / `constructorName: "ProxyAgent"` / extra key | `runtime_global_dispatcher_invalid` (each) |
| per-op `globalDispatcher` removed (v4 14-key tls) | `tls_observation_shape` |
| op 4 `identityUnchanged: false` / `constructorName` differs | `tls_global_dispatcher_changed` |
| RUNTIME `globalDispatcher` missing → `null` | `tls_global_dispatcher_changed` |
| **v4 rehearsal packet through the v5 bridge** | vetoed: `source_not_frozen_candidate:runner`, `runtime_receipt_key_set_mismatch`, `runtime_global_dispatcher_invalid`, `runtime_bootstrap_not_candidate`, `operation_N_global_dispatcher_changed`… |

**v5 rehearsals through the bridge** (real v5 runner, synthetic adapter, offline, approved v5 pins and verifier):
- `happy`, `tls_resumed_ok` and `tls_keepalive_ok` convert (diagnostic class);
- `dispatcher_swap_before_start` gives `global_dispatcher_not_runner_load_default` and no packet;
- `dispatcher_swap_between` gives `FAILED.json` and no manifest;
- `dispatcher_swap_during` gives `operation_5_global_dispatcher_changed`.

Acquisition receipts keep the 14-key `tls` (`frames.mjs` calls `verifyTlsChain` without a packet dispatcher), and test 15 covers that.

## 3. Dispatcher design: sound for what it checks, insufficient alone

**What v5 does.** The bootstrap requires the registry (`Symbol.for('undici.globalDispatcher.1')`) to be empty before its three dynamic imports. The runner then anchors whatever is in the registry when its module finishes loading: npm undici 7.29.0's default `Agent`, registered via `cheerio`. The runner requires that object, named `Agent`, at start, before every dispatch and after every settlement.

**Attacks:**

| Route | Result |
| --- | --- |
| swap after runner load: before start / between ops / during an op (v5's own rehearsal) | refused, each fail-closed |
| **preinstall a private-CA `new undici.Agent({connect:{ca}})` before the runner loads** (scratch `rehearse-preinstall.ts`) | **packet completes.** RUNTIME `globalDispatcher {present, "Agent", sameAsRunnerLoad: true}`, every op `{…, identityUnchanged: true}` (15 keys). The bridge converts it. |
| preinstall a bare `ProxyAgent` | refused (`global_dispatcher_not_runner_load_default`: the name is not `Agent`) |
| **preinstall `class Agent extends ProxyAgent`** (forged `constructorName`) | **packet completes**, indistinguishable from the default |
| **wrap `node:tls` `connect`** after cheerio has loaded undici (`tls-connect-patch.cjs`, pinned v5 adapter `aa6237bd…` observing, real npm-undici transport, loopback) | `{"status":200,"authorized":true,"issuerCNChain":["api-web.nhle.com"],"registryConstructor":"Agent","identityUnchanged":true,"caStoreUnchanged":true}`: a self-signed root trusted, and every v5 check passes |

The v5 rehearsal harness itself also replaces `tls.connect`, `net.Socket.prototype.connect`, `dns.lookup` and `fetch` in-process, and the runner still reports a clean RUNTIME. That is direct evidence that the dispatcher check does not cover builtin monkeypatching.

**What this means:**
- **(a) The pre-runner install** is stopped only by the bootstrap's empty-registry check. The packet proves the bootstrap ran only through the self-reported `launch` block. That is the custody limit again (same class as Q1), not a code gap. `constructorName` adds nothing against a determined actor: any `Agent`, or a subclass named `Agent`, passes.
- **(b) The `tls.connect` wrapper is a real gap.** Any code in the capture process can install it at import time without touching the registry or the CA store.
- **(c) Measured in-process code** for the v5 capture (preparation + runner + adapter under ts-node): **32 npm packages and 245 module files** in `require.cache`:
  - `undici`, `cheerio` and its 20-odd parse and encoding deps (`parse5`, `htmlparser2`, `domutils`, `entities`, `encoding-sniffer`, `iconv-lite`, `whatwg-*`, …);
  - `ts-node`, `typescript`, `@cspotcode/source-map-support`, `@jridgewell/*`;
  - `memory-cache`, and more.

  The bootstrap pins only the entry file and `package.json` of `ts-node`, `typescript`, `cheerio` and `memory-cache`.

**What the operator's undici-only dependency-tree check closes:** tampering *within the undici 7.29.0 package*, meaning its default `Agent`, connector, TLS options or diagnostics publication. That is the most direct target.

**What it does not close:** the same effect from any of the other ~31 in-process packages, through a `tls.connect` or `net` wrapper, a `Module._load` hook, or patches to undici prototypes. ts-node and typescript load first, before the bootstrap's own check, and could do any of these.

**Smallest sufficient fix.** Pick either one; both are capture-lane changes:
1. Extend the operator's dependency-tree check to **every file the capture process loads**: today the 245 files and 32 packages, taken from a dry `require.cache` listing. Pin it as one manifest hash.
2. Or have the runner record, in RUNTIME, the sorted `(path, sha256)` list of `require.cache` at start and at end, and have the bridge pin that list's hash.

Either one plus the bootstrap's launch proof reduces the remaining exposure to custody.

## 4. Regressions vs RECHECK-3: none

- **Tool `aa8a9cb7…`, rerun of every RECHECK-3 route** with an approved v5 conversion (forged, custody), loopback only:
  - `--require` preload → `runtime_exec_argv_not_empty`;
  - `NODE_OPTIONS` → `runtime_override_env_present`;
  - `--out` → `output_path_is_fixed`;
  - preinstalled global → `global_dispatcher_preinstalled`;
  - mid-run swap → `acquisition_failed:global_dispatcher_changed`.
- **F2 probes:** diagnostic conversion → `conversion_not_approved`; schedule byte flip → `conversion_hash_drift`; extra game resealed → `schedule_hash_drift`; ids added → `schedule_ids_drift`; unlisted file → `conversion_unlisted_file`. My hand-relabel probe now says `conversion_not_approved` only because it writes v4 hashes; a v5 relabel would pass, as in RECHECK-3 (custody).
- **Positive path:** the tool completed 6 requests via the loopback test dispatcher. Production `frames.mjs` refuses that output (`acquisition_runtime_missing_or_shape`, the test-transport key), and test-mode frames gave 12.
- **Custody (Q1) for v5:** `forge-v5-conversion.mjs` hand-writes a v5 packet: real v5-pinned sources, synthetic 15-key TLS, launch proof and dispatcher facts, zero network. It converts under the APPROVED v5 inputs, without the synthetic flag, to `candidate_pending_independent_review` with `TLSVerified: true`. This is unchanged in kind.
- **Bridge code:** the only changes are the APPROVED constants and the v5 dispatcher checks. Tests 1–21 pass.

---

## Final preconditions for a v5 pilot

1. **Capture code:**
   - apply `SUCCESSOR.patch e8be50de…` in the canonical checkout: runner `a74cbb0a…`, adapter `aa6237bd…`, bootstrap `dbf69c47…`;
   - run the four successor suites there;
   - the bridge `SHA256SUMS` passes in full and its suite gives 21/21 in the canonical checkout.
2. **In-process integrity (new, item 3):** before the slot, one of these holds:
   - the operator's dependency-tree check covers **every module file the capture process loads** (today 32 packages and 245 files, including ts-node and typescript), not only undici 7.29.0; or
   - the capture lane adds a `require.cache` manifest to RUNTIME, and the bridge pins it.

   Without this, `TLSVerified: true` rests on unreviewed `node_modules` code.
3. **Capture custody:**
   - the v5 bootstrap runs in the approved slot with the operator's `env -i` launcher, from `/Users/tim/Code/fhfhockey.com/web`;
   - no `NST_JOB_LIFECYCLE_ENABLED`, `OPENSSL_CONF`, `TS_NODE_*` overrides, `NODE_OPTIONS`, or CA or proxy overrides;
   - no preloads beyond the pinned ts-node register;
   - the fixed `OUTPUT` is converted in place, with an operator attestation.

   The empty-registry check is only as good as the evidence that the bootstrap ran.
4. **Bridge inputs:** pins `a2a1e694…`, verifier `b86af692…`, `--node-sha256 daa77e22…`, lineage `14e0816c…`. Anything else is refused or demoted to diagnostic.
5. **Acquisition:**
   - `aa8a9cb7…` is added to `APPROVED_ACQUISITION_TOOLS` by a reviewed change from a lane other than the bridge author;
   - TJ separately approves 6 GETs for games 293–298, 0 retries, the exact `env -i` launch with no `execArgv` or `NODE_OPTIONS`, and the fixed output `…/fhfh-blsh-boxscores-20261111`, which must not exist beforehand;
   - it runs right after conversion, and the output goes untouched and in place to `frames.mjs`.
6. **Timing:** gate evaluation no later than 24 h after the earliest of the NST retrievals, the frame observations and the request captures, and on a UTC date no later than 2026-11-18.
7. **Holds and gate:** dotted-code teams stay held; the on-ice page format is unproven on real bytes; windows are never admitted.
8. **Review and install:** an independent review fills `reviewSHA256` and is appended to the required list. A policy owner other than the bridge lane installs it. `TEST_ONLY…` proposals are never reviewed.

**Side effects:**
- I did not modify the bridge folder: its sums are 29/29 OK.
- `git status web` shows only the pre-existing `next-env.d.ts`.
- The loopback servers exited on their own timers, and the fixed output path does not exist.
- All packets and outputs are under the session scratchpad.
