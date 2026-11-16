# Recheck: bridge changes and successor v4 (2026-11-15)

**Scope:** only what changed since `REVIEW.md`. **Same rules as before:** read-only, scratch only, no network, provider, DB, ledger, credential or `.env` access, and no git mutation.

**What I checked:**
- **Bridge:** `SHA256SUMS` passes 16/16. Hashes match Chef's message: `convert.mjs eea43c7f…`, `frames.mjs 00c29471…`, `assemble.mjs 0aefc73b…`, `propose-policy.mjs ae222ecd…`, `tests/bridge.test.mjs c5e3056f…`, `tests/fixtures.mjs 491f2e38…`, `ACQUISITION-SPEC.md 8e034e62…`, `README.md e8075c81…`.
- **Successor v4:** `SUCCESSOR.patch 66b4eb30…`, pins `f2f639ea…`, verifier `04a632ba…`. A scratch `patch -p1` reproduces runner `6a7341dc…`, adapter `aa6237bd…` (unchanged) and bootstrap `a224d62e…`.
- **Diffs:** I diffed the changed files against my mirror copy of the previously reviewed bytes, and the v4 runner and bootstrap against my v3 scratch apply. The adapter is unchanged from v3.

**Reproducers in `repro/`:**
- `repro-convert-v4.mjs`: packet level, verifier plus bridge;
- `repro-units-v4.mjs`: the bridge's own checks, called directly;
- `mutate4.sh`: mirror-only mutants. `convert.mjs` was restored and confirmed byte-identical with `cmp`.

## Verdicts

| # | Question | Verdict |
| --- | --- | --- |
| 1 | Q3 closed: can operator-supplied pins, verifier or bootstrap reach the candidate class? | **PASS** |
| 2 | `requiredArtifactSHA256` binds the TLS basis, the frames and the acquisition runtime | **PASS** (one Low gap) |
| 3 | RUNTIME exact key sets and the 14-key per-operation `tls` set enforced | **PASS** |
| 4 | Production frames refused without a reviewed tool; ACQUISITION-SPEC sound | Refusal: **PASS**. Spec: **FAIL (partial)**, three gaps to fix before the tool is reviewed |
| 5 | v4 fields match the bridge; no lifecycle-key coupling left | **PASS** (executed) |
| 6 | Did the three surviving mutants die? | **2 of 3 killed outright.** The third dies at function level; removing its call site is still masked by the now-pinned verifier. |
| 7 | Is Q1 still a custody limit? | **Yes, unchanged** (reproduced against v4) |

**Suite:** 16/17 in my scratch mirror, then **test 3 passes when run alone** after one scratch-only fixture edit. The failure was an artifact of my mirror, not a bridge defect:
- `convert.mjs` pins `WEB_ROOT = /Users/tim/Code/fhfhockey.com/web` for the launch proof;
- `fixtures.mjs` builds `launchFor(true)` from its own location, which in a mirror is the mirror path;
- so test 3 refused with `runtime_not_launched_by_bootstrap`;
- with only the mirror's `fixtures.mjs` `WEB` line set to the canonical path, test 3 passes (1/1). The edit was reverted afterwards.

Tests 1, 2 and 4–17 passed in the full run (140 s), including test 17 ("the suite wrote nothing into the bridge folder").

**Consequence:** the suite can only reach 17/17 in the canonical checkout. I did not run it in place, because I must not modify the bridge folder.

---

## 1. Q3: PASS

`convert.mjs` adds `APPROVED`: pins `f2f639ea…`, verifier `04a632ba…`, bootstrap `a224d62e…`, node `daa77e22…` and lineage `14e0816c…`.
- **Non-synthetic:** the bridge refuses before the readback unless every input matches byte for byte, and `pins._bootstrapSHA256` equals `APPROVED.bootstrapSHA256`.
- **Synthetic:** `evidenceClass` is always `diagnostic_only_synthetic_adapter`.
- **The class itself** is `refused` unless `approvedInputs`.

Reproduced (`repro-convert-v4.mjs`):

| Case | Result |
| --- | --- |
| operator-written pins naming a synthetic adapter, no flag | `pins_not_approved` |
| same pins, with `--synthetic-adapter-ok` | `diagnostic_only_synthetic_adapter` |
| verifier edited by one comment line | `verifier_not_approved` |
| other `--node-sha256` | `node_pin_not_approved` |
| synthetic adapter under the approved pins, no flag | `packet_vetoed:source_not_frozen_candidate:adapter` |
| approved inputs, with the synthetic flag | diagnostic class |
| launch: entry is not the bootstrap / other bootstrap hash / cwd elsewhere | `runtime_not_launched_by_bootstrap` / `runtime_bootstrap_not_candidate` / `runtime_not_launched_by_bootstrap` |

**Bootstrap:** it is bound twice: by the pins' `_bootstrapSHA256`, and by `checkLaunch(…, APPROVED.bootstrapSHA256)`, which requires `entryIsBootstrap`, `entryScript == bootstrapPath`, `entryScriptSHA256 == bootstrapSHA256`, `cwd == WEB_ROOT` and the three launcher keys present. Direct calls give `runtime_launch_unlisted_ts_node_keys` and `runtime_not_launched_by_bootstrap` without the verifier in the loop.

**Residual (Low, custody):** `assemble.mjs` still takes `CONVERSION.json.evidenceClass` and `FRAMES.json.mode` as written. It does not re-check `CONVERSION.pinsSHA256`, `verifierSHA256` or `approvedInputs` against `APPROVED`. `CONVERSION.json` is now bound (item 2), so a reviewer can check it, but a hand-written conversion directory would pass assemble. A three-line re-check in assemble would close this.

## 2. Binding: PASS

- **Packet:** `convert.mjs` now keeps, as bound roles, `PLAN.json`, `packet-MANIFEST.json`, all ten operation journal files and the three `*.TRANSPORT-OBSERVATION.json`. My v4 packet's conversion lists 26 artifacts in 15 roles.
- **Assemble** adds `CONVERSION.json`, `FRAMES.json`, `ACQUISITION-RUNTIME.json` and every `boxscore-*` file to `extraBoundArtifactSHA256`.
- **Byte-for-byte:** test 3, which passed in my rerun, asserts that every packet file (STARTED, PLAN, RUNTIME, MANIFEST, 3 observations, 10 journal files), `CONVERSION.json`, `FRAMES.json` and `ACQUISITION-RUNTIME.json` is in `requiredArtifactSHA256` with its exact bytes.

**Gap (Low):** the frames directory's own `MANIFEST.json` is not bound. It is only used for internal consistency, so this is low impact.

## 3. Exact key sets: PASS

**Bridge's own checks, called directly (`repro-units-v4.mjs`):**
- RUNTIME top-level extra key → `runtime_unexpected_keys`;
- extra key under `node` → `runtime_node_shape`;
- `launch` missing → `runtime_launch_shape`;
- 13-key (v3-shape) `tls` → `tls_observation_shape`;
- extra `tls` key → `tls_observation_shape`;
- CA changed on op 2 → `tls_ca_store_changed`;
- runtime CA hash missing (`null`) → `tls_ca_store_changed`.

**Packet level:** the verifier vetoes first, for example `runtime_receipt_key_set_mismatch` and `operation_3_ca_store_changed`.

**Key sets match the writer:** the 10 RUNTIME keys, 8 `launch` keys, 17 launch-environment keys, 4 `node` keys, 4 CA keys and the 14 `tls` keys equal what the v4 runner writes. I confirmed this on a real v4 rehearsal packet: `operation-1-SETTLED.json.tls` has exactly the 14 keys.

`peerCertificate` subfields are shape-checked only (fingerprint and chain length), as before. Low.

## 4. Frames and ACQUISITION-SPEC

### Refusal: PASS

`APPROVED_ACQUISITION_TOOLS` is empty, so production mode refuses every frame:
- a legacy self-asserted receipt → `boxscore_receipt_self_asserted_tls`;
- a well-formed v2 set (runtime, 14-key TLS, bound operations) → `acquisition_tool_not_reviewed`, which proves every earlier check passed.

`testMode` is a function option only; neither CLI exposes it. Propose refuses test-mode frames (`frames_not_from_reviewed_acquisition`) unless the test-only function flag is set, and then labels the output `TEST_ONLY…`.

### Spec soundness: FAIL (partial)

**Sound:**
- 6 GETs, one per game, ids taken only from the packet's TLS-verified schedule;
- 0 retries, concurrency 1, `redirect: "error"`;
- the adapter's own observation code reused;
- a 14-key TLS object with a CA-store re-read;
- no `TLSVerified` field;
- a separate TJ approval.

**Gaps to fix before the tool is reviewed:**
- **(a) Medium: no launch proof.** `fhfh.blsh.official-acquisition-runtime.v1` (`frames.mjs` `ACQ_RUNTIME_KEYS`) has no `launch` block, so `OPENSSL_CONF`, `TS_NODE_*`, entry script and cwd are neither recorded nor refused. The packet now requires these, and the acquisition should meet the same bar. `toolSHA256` is self-reported by the tool.
- **(b) Medium: completeness and retries are not enforced by the bridge.** `frames.mjs` neither reads the acquisition directory's `MANIFEST.json` nor requires one receipt per scheduled game. A one-receipt prefix of a two-game set passes every check up to `acquisition_tool_not_reviewed` (probe `wellformed_v2_prefix_subset_1_of_2`). So a partial, failed acquisition without a manifest, which the spec says must not count, could be used once a tool is approved. Missing games only drop frames, so rows are held, not falsely admitted. Still, the bridge should require the acquisition's completion manifest and report or refuse a partial set.
- **(c) Low:**
  - the acquisition's node pin is the caller's `--node-sha256`, not `APPROVED.nodeSHA256` (probe `node_pin_is_caller_supplied`, which stops only at the tool check);
  - the receipt's `redirected` value is never checked, and no final URL is recorded.
- **Wording:** "Run from the canonical checkout after `npm ci`" repeats my earlier caveat. State it as a requirement (node_modules integrity), not a command that rewrites the tree the bootstrap pins were taken against.

## 5. v4 interface and lifecycle coupling: PASS (executed)

I ran the successor v4 `rehearse.ts` offline in a scratch tree: the v4 `scripts/blsh` with the rest of `web/` symlinked, `env -i`, clock 2026-11-13T01:00Z and 0 network attempts. Each packet then went through the bridge with the approved pins, verifier and node and the synthetic flag:

| Scenario | Runner | Bridge |
| --- | --- | --- |
| `happy` | `packet_complete_pending_review` | converts (diagnostic) |
| `tls_resumed_ok` | complete | converts |
| `tls_keepalive_ok` | complete | converts |
| `lifecycle_key_false` (the harness sets `=false`, bypassing the bootstrap) | complete | `packet_vetoed:runtime_lifecycle_key_present` |
| `ca_store_swap_during` (real `tls.setDefaultCACertificates`) | stops after op 2 | vetoed: `operation_2_ca_store_changed`, FAILED, no manifest |
| `ca_store_swap_between` | stops before op 2 (pre-dispatch guard) | vetoed: FAILED, no manifest |

**Lifecycle coupling is gone:**
- the bootstrap now refuses *presence* of `NST_JOB_LIFECYCLE_ENABLED` before any dispatch (`checkExecution`, by reading);
- the verifier vetoes it, and so does the bridge.

All three agree, and the only launcher accepted for a candidate is the bootstrap. The rehearsal harness can still spend a run with the key set, but only in synthetic rehearsals.

**Unchanged residuals:**
- **CA swap:** the CA re-read happens before dispatch and after settlement. A swap made *and reverted* inside one request's window would not show; that needs in-process hostile code, which the source review already has to rule out.
- **`node_modules`** is still bound only by the bootstrap's entry-file pins.

## 6. Mutants

| Mutant (in `convert.mjs`) | Before | Now |
| --- | --- | --- |
| `< 8` changed to `<= 8` (now inside `nativeDateFresh`) | survived | **killed**: test 5's direct boundary assertions |
| drop the mirror check in `verifyTlsChain` | survived (verifier-masked) | **killed**: direct `mirrorOff` assertion |
| drop `observation_overclaims_tls`, function body | survived | **killed**: direct `checkObservationClaims` assertion |
| drop the `checkObservationClaims(obs)` **call site** | – | **survives** (8/8 "negative" tests pass). Masked by the verifier's `provenance_overclaims`. Acceptable now that the verifier is fixed approved bytes, but it is still bridge-level dead weight. |
| new: disable the `APPROVED` gate | – | killed (test 3) |
| new: drop the per-operation CA re-check | – | killed (test 5) |
| new: drop the exact 14-key `tls` check | – | killed (test 5, case 18) |

## 7. Q1: still a custody limit

Probe `v4_forged_real_pins`:
- **The packet:** the real v4-pinned runner and adapter bytes, hand-written 14-key TLS on all five operations, and a hand-written RUNTIME carrying a well-formed launch proof (bootstrap path, `a224d62e…`, canonical cwd, launcher keys present). Zero network.
- **The run:** converted with the approved pins, verifier and node and **no** synthetic flag.
- **Result:** `candidate_pending_independent_review` with `TLSVerified: true`.

v4 raises the cost of an *accidental* wrong launch to zero: every such launch is refused. It does not change what an offline byte check can prove. The launch block is self-reported by the runner, exactly like the TLS facts.

---

## Updated preconditions (replaces the list in REVIEW.md)

1. **Custody.**
   - The packet comes from the v4 bootstrap `a224d62e…`, run by the named operator in the approved slot 2026-11-17T14:05Z, into its fixed `OUTPUT` path, from `/Users/tim/Code/fhfhockey.com/web`.
   - It is converted directly from that path, with an operator attestation of who, when and the launcher used.
   - It is never a copy received from elsewhere.
   - Optionally, the admission-ledger rows for ops 2 and 4 are matched as an outside witness.
2. **Apply v4 exactly.**
   - `SUCCESSOR.patch 66b4eb30…` applied in the canonical checkout, giving runner `6a7341dc…`, adapter `aa6237bd…` and bootstrap `a224d62e…`.
   - The bridge run with `--pins` = `expected-pins.json` `f2f639ea…`, `--verifier` `04a632ba…`, `--node-sha256 daa77e22…` and `--lineage 14e0816c…`. Anything else is now refused, or demoted to diagnostic.
   - The bridge's suite is run **in the canonical checkout**, where test 3 can pass: the launch proof pins the canonical `web/` path. Expect 17/17.
3. **Environment:**
   - node_modules integrity is established before the slot, without invalidating the bootstrap's dependency pins;
   - `/usr/local/bin/node` `daa77e22…`;
   - no `NST_JOB_LIFECYCLE_ENABLED`, `OPENSSL_CONF`, extra `TS_NODE_*`, or CA, proxy or `NODE_OPTIONS` overrides. The bootstrap, verifier and bridge all now refuse these.
4. **TLS basis binding:** done by the bridge. The reviewer checks that `CONVERSION.json` shows `approvedInputs: true` and the approved hashes. Optional hardening: assemble re-checks this itself.
5. **Official frames: still blocked.** No production frame exists until all of these are done:
   - the acquisition tool is built to ACQUISITION-SPEC;
   - its runtime gains a launch block like the packet's (gap 4a);
   - `frames.mjs` requires the acquisition's completion manifest and full game coverage, uses `APPROVED.nodeSHA256` and checks `redirected === false` (gaps 4b and 4c);
   - the tool is independently reviewed and its hash added to `APPROVED_ACQUISITION_TOOLS` by a reviewed change;
   - TJ separately approves the 6 GETs, game ids, output path and time window.
6. **Timing:**
   - the acquisition runs soon after the capture;
   - gate evaluation is no later than about 2026-11-18T14:05Z, which is 24 h after the earliest of the NST retrievals, the frame observations and the request captures;
   - the evaluation UTC date is ≤ 2026-11-18 for current use;
   - `CURRENT-REQUEST` captures fall inside the same 24 h.
7. **Expected holds** (unchanged): rows on dotted-code teams stay held until a reviewed team map ships; the on-ice markup is unproven on real bytes; windows are never admitted.
8. **Review and install:** an independent review artifact fills `reviewSHA256` and is appended to the required list. A policy owner other than the bridge lane installs it. Propose output labelled `TEST_ONLY…` must never be reviewed or installed.

**Leakage:** I reran the scan after the changes over 26 files in the bridge folder and this folder: 0 player names, 0 player IDs. The only secret-pattern hits are the two pattern names written in `REVIEW.md`.

**Side effects:** `git status web` is unchanged (only the pre-existing `next-env.d.ts`). The bridge folder's sums are 16/16 and its listing is unchanged by this recheck.
