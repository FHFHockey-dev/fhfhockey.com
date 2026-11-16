# BLSH evidence bridge (offline): from a runner packet to evidence the gate can consume

**Status (2026-11-15, after the independent review):** built and tested offline against **successor v4** (`SUCCESSOR.patch` `66b4eb30…`). **Not accepted evidence.**
- Only the separate reviewer session can review it (`REVIEWER-BRIEF.md`). My own tests are not acceptance.
- No network, provider, NST, DB, ledger, credential or `.env` access. Nothing pushed, deployed, committed or flagged.
- Nothing was edited outside this folder and its diary.
- Full file digests are in `SHA256SUMS`.

## RECHECK-11 §C and fallback review H1/M1 fixes (2026-11-15)

- **C1 (High):**
  - `post-capture/check-attestation.mjs` now **unwraps** the launcher's G3 line, requiring `{"launcher":"g3","exitCode":0,"stdout":…}`, and matches the inner G3 line.
  - The rehearsal's attestations are now **written by the operator's own `operator-attestation.py write`**, from launcher-shaped files: the exact `json.dumps(…, sort_keys=True)` lines, the real G3 line and real hashes. So B2 tests the real contract.
  - On the reviewer's repro attestation, the CLI refuses only on `argv0` (that attestation has the operator rehearsal's stub node, which C2 must refuse). Through the operator's same `expect` seam it returns `ok:true`; that seam is function-only, never on the CLI.
- **C2 (Medium):**
  - the check now binds the exec line's `argv0` (`/usr/local/bin/node`), `cwd` (canonical `web/`) and `atUTC` (`<slot date>T14:05:00–14:05:50Z`), and the attestation's `candidate`;
  - POST-CAPTURE gains **step 2b**, `operator-attestation.py check --candidate v5-1117|v5-1118`, and steps 2 and 2b must both accept.
- **C3 (Low):** POST-CAPTURE step 4 and CLI gap 1 now point at the request reader RUNBOOK's single command: right after step 3, about 14:10Z, with its 12 h ceiling and its own approval.
- **H1:** `OPERATOR_PINS["v5-1118"]` holds launcher-1118 `2670353d…` and baseline-1118 `e9c7ec5a…`, taken from the operator lane. Rehearsal B2 now **passes** for v5-1118.
- **M1:** `proposed/SWAP.md` step 2 is gated: swap only after the 11-17 slot is abandoned or missed, or after its frames read has completed. **H2** stays parked; the swap is not executed.
- **Rehearsals:** v5 **36/36**, v5-1118 **31/31**. Both run steps 2 and 2b, plus eight refusals each (B2a–B2h) and a 2b rejection (B2i).

## Parked 11-18 fallback, `v5-1118` (2026-11-15)

Vendored from `blsh-successor-candidate-2026-11-15/fallback-1118/` into `approved/v5-1118/`, with every hash checked on copy and pinned in `UPSTREAM-PINS.json`:

| File | sha256 |
| --- | --- |
| `FALLBACK.patch` | `209b34eb…` |
| `expected-pins.json` | `3f61f9d4…` (bootstrap `849009ee…`) |
| `verify-packet.mjs` | `b86af692…` (byte-identical to v5) |

**Parked: not approved until TJ approves it.**
- **Explicit selection, never auto-detected:**
  - **`CANDIDATES` in `convert.mjs`:** `v5` (= `APPROVED`, unchanged) and `v5-1118`, which differs only in `pinsSHA256` and `bootstrapSHA256`.
  - **Which CLIs take it:** `convert.mjs` (non-synthetic), `assemble.mjs` and `post-capture/check-attestation.mjs` require `--candidate`. `ASSEMBLY.json` records it.
  - **Defaults:** the function APIs default to `v5`, so the existing tests are unchanged.
- **Refusals (test 3):**
  - the fallback pins under the v5 choice, and the v5 pins under the fallback choice: `pins_not_approved`;
  - either pins file on the other candidate's packet: the verifier vetoes it on the bootstrap;
  - a cross-candidate assemble: `conversion_not_approved`;
  - an unknown candidate: `candidate_unknown`.
- **What passes:** a fallback packet with the real fallback bootstrap bytes converts to the candidate class under `v5-1118`.
- **Acquisition tool:** the live, listed tool `aa8a9cb7…` pins the v5 pins file, so it refuses every fallback conversion (`conversion_not_approved`, test 20; rehearsal B4).
  - **Staged fix:** TJ chose "accept either pins file", staged until reviewed. `post-capture/proposed/acquire-boxscores.mjs` `b4b563f4…` accepts both candidates' pins and is the live tool plus exactly two edits (tests 18 and 19; rehearsal B4s).
  - **Swap:** `post-capture/proposed/SWAP.md` gives the procedure: a review, a non-author swap and list entry, then TJ's frames approval.
- **Operator pins:** the 11-18 operator pins (G3 baseline, launcher) don't exist yet, so `check-attestation.mjs --candidate v5-1118` refuses with `candidate_operator_pins_unset`.
- **Runbook and rehearsal:** see the fallback section in `post-capture/POST-CAPTURE.md`. `dress-rehearsal.sh <dir> v5-1118` passes 21/21, and shows the deadline check and the real gate refusing an evaluation on the next UTC day (the 11-19 case).

## Post-capture runbook (2026-11-15)

`post-capture/POST-CAPTURE.md` lists the exact commands Chef runs after the Nov 17 capture, with every stop rule and the deadline. `post-capture/dress-rehearsal.sh` runs the same CLIs in scratch.
- **Result:** 28/28 on the v5 tree; real fixed paths and this folder are unchanged.
- **New CLIs:**
  - `check-attestation.mjs`: the operator attestation (`g3.bothMatch`, `launcher.dyldKeysPresent`, re-derived from the verbatim G3 lines);
  - `deadline-check.mjs`: the gate's time rules, giving `deadlineUTC`.
- **Rehearsal only:** `rehearsal-inputs.mjs`, which builds scratch inputs from the test fixtures and runs the real gate under a labelled synthetic review.
- **The largest manual gap on the day:** a fresh CURRENT-REQUEST and CONTEXTS covering 2026-11-11.

## Approved tool list (G4, 2026-11-15)

At TJ's direction, Chef (not this lane) set `frames.mjs` `APPROVED_ACQUISITION_TOOLS` to exactly `["aa8a9cb7…"]` (`frames.mjs` `8b57ffbf…`). Only the tests changed here:
- **The "unreviewed tool" refusal stays covered.** A fixture option binds a tool one byte different from the listed tool (the final newline replaced by a space; same length), with matching runtime and launch hashes. Tests 3, 15 and 20 require `acquisition_tool_not_reviewed` for it, and test 20 still requires the frames CLI to refuse before any write.
- **Test 15 asserts the list is exactly `[aa8a9cb7…]`** and that it equals the real tool's sha256.
- **Custody limit, now asserted explicitly (tests 3 and 15):** a well-formed acquisition directory with **hand-written facts** and the **real tool bytes** produces **production** frames (`mode: "production"`, receipt class `acquisition_v2_tls_verified`). Nothing in the directory proves the tool ran; only the operator's custody of an untouched directory does.
- No other assertion was weakened.

## Post-apply mode (2026-11-15)

`SUCCESSOR.patch` `e8be50de…` is now applied in the canonical tree (committed in `348a122d6`), and the suite runs on either tree.
- **`successorSources()` detects the tree state** with `patch --dry-run -f` in scratch, forward and in reverse:
  - **base** (forward applies only): it applies the patch in scratch, as before;
  - **already v5** (reverse applies only): it skips the apply;
  - **anything else** → `successor_tree_unrecognised`.

  Either way, the runner, adapter, preparation and bootstrap must then equal the v5 pins (`successor_tree_role_mismatch:<role>`). Nothing in the checkout is touched.
- **Test 14's unpatched runner** now comes from a `git archive` export of base `a955107671ee` (`web/scripts/blsh`, `web/lib/nst`, `web/lib/cron`, `tsconfig.json`, `package.json`, plus a symlink to the live `node_modules`), never the live tree. It runs Chef's vendored `rehearse.ts` and converts under Chef's pins, and the export's runner and client hashes are asserted against those pins.
- **New regressions (test 14):**
  - the base export patches to the v5 pins (`patched_in_scratch`);
  - a non-base, non-v5 bootstrap → `successor_tree_unrecognised`;
  - a runner the patch still applies to, but whose result is not v5 → `successor_tree_role_mismatch:runner`.
- `acquire-boxscores.mjs` is unchanged (`aa8a9cb7…`).

## Rebound to successor v5 (2026-11-15)

**The approved candidate is v5:**

| File | sha256 |
| --- | --- |
| `SUCCESSOR.patch` | `e8be50de…` |
| verifier | `b86af692…` |
| pins | `a2a1e694…` |
| bootstrap | `dbf69c47…` |
| runner | `a74cbb0a…` |
| adapter (unchanged) | `aa6237bd…` |

The three upstream files are vendored in `approved/v5/` and hash-checked at test load. `approved/v4/` is kept for refusal tests only.

- **`convert.mjs` `APPROVED` → v5.** `assemble.mjs` follows automatically, and the tool's copy is updated (a test asserts equality).
- **v5 dispatcher facts, consumed and required:**
  - **Background:** the live transport is npm undici 7.29.0, loaded by cheerio at runner load. The runner anchors the import-time default `Agent`.
  - **`RUNTIME.json.globalDispatcher`** must be exactly `{present: true, constructorName: "Agent", sameAsRunnerLoad: true}` (`runtime_global_dispatcher_invalid`). It is part of the exact top-level key set, so its absence gives `runtime_unexpected_keys`.
  - **Each operation's `tls.globalDispatcher`** must be exactly `{present: true, constructorName: <RUNTIME's>, identityUnchanged: true}` (`tls_global_dispatcher_changed`). The per-operation `tls` key set is now 15 keys.
  - **Acquisition receipts** keep the 14-key `tls`; their dispatcher facts are receipt-level fields.
- **v4 refused:** v4 pins → `pins_not_approved`; v4 verifier → `verifier_not_approved`; a v4-shaped packet (no dispatcher facts) → vetoed by the v5 verifier, and refused by the bridge's own checks (direct asserts).
- **New negatives (test 3 and test 5):**
  - **Preinstalled dispatcher recorded:** `sameAsRunnerLoad: false`.
  - **Identity change at op N:** ops 3 and 4.
  - **Missing dispatcher fields:** in RUNTIME, in an operation, or a missing field inside the block.
  - **Other cases:** another class (`ProxyAgent`), `present: false`, an extra field, and a v4-shaped 14-key chain.
  - **Mutation:** ignoring either dispatcher check fails test 5.
- **Acquisition tool:** only its `APPROVED` constants changed, so it has a new hash, **`aa8a9cb7…`**. The fetch and observation logic is byte-identical to `4f8a0888…`, which RECHECK-3 approved for v4 only; the diff is the two constants plus one comment line. `APPROVED_ACQUISITION_TOOLS` now lists exactly `aa8a9cb7…` (G4: set by Chef at TJ's direction, not by this lane; see "Approved tool list (G4)").
- **Carried facts (residual, not a bridge check):** `node_modules/undici`, which builds every live connection, is unpinned by the bootstrap. It is covered by the operator's dependency-tree check (G3, rebaseline pending).

## Upstream inputs are vendored (2026-11-15)

The successor lane overwrote its **live** folder with v5 work in progress (verifier `b86af692…`, pins `a2a1e694…`), and the suite used to read that path. The bridge now reads **no live upstream folder**.

- **`approved/v4/`** holds the approved v4 inputs, copied from `blsh-successor-candidate-2026-11-15/superseded/`:
  - `verify-packet.mjs` `04a632ba…`;
  - `expected-pins.json` `f2f639ea…`;
  - `SUCCESSOR.patch` `66b4eb30…`.
- **`approved/chef/`** holds Chef's pre-successor files, used only by tests: `verify-packet.mjs` `7816ec6a…`, `expected-pins.json` `010c5647…`, `rehearse.ts` `e01f8772…`.
- **`approved/UPSTREAM-PINS.json`** lists those 6 vendored files, plus 14 files pinned **in place**. Those are the prior-art prep scripts, which resolve siblings by their own path, and the external read-only fixtures.
- **`tests/fixtures.mjs`** checks every entry at import, so any drift fails the suite before a test runs.
- **For an operator:** run `convert.mjs` with `--verifier approved/v5/verify-packet.mjs --pins approved/v5/expected-pins.json`. `APPROVED` refuses any other bytes.

**v5:** rebound, see above.

## Changes after RECHECK-2 (`../blsh-evidence-bridge-review-2026-11-15/RECHECK-2.md` §5): the previous tool `e075b90a…` is NOT approvable

| Item | Fix | Test # |
| --- | --- | --- |
| F1 (High): the tool hash did not pin its import closure | **Option (a):** `acquire-boxscores.mjs` is self-contained.<br>• It imports only `node:` builtins (asserted statically), with the v4 adapter's `socketTls`/`withTlsObservation` and the needed `lib.mjs` helpers copied in.<br>• The copy is identical to the original over 12 scenarios.<br>• It is launched with `execArgv` `[]`, and frames require `[]` and no launch or ts-node keys.<br>**Global-dispatcher identity:** unset at start (refused otherwise), and afterwards the object the first bundled fetch created, identical at every check. Recorded in the runtime and in each receipt, and verified by frames. | 15, 18, 19 |
| F1 regression | The reviewer's reproducer, as code run before the tool: a global undici dispatcher trusting a private root gives `global_dispatcher_preinstalled` (0 requests, no output). Installed mid-run, it gives `global_dispatcher_changed` (fails closed). The literal `lib.mjs` injection can no longer execute, because the tool imports nothing local. | 18, 19 |
| F2 (Medium): ids not tied to an approved conversion | The tool applies `conversion_not_approved`, the same test as `assemble.mjs`, and re-derives the ids from the hash-checked `schedule.raw.json` (date filter, all OFF or FINAL), which must equal `scheduleFacts`. | 19, 20 |
| F3 (Low) | `--out` was removed. The path is fixed per source date (`…/fhfh-blsh-boxscores-20261111`): `--out` → `output_path_is_fixed`, and frames require the runtime's `outputDirectory` to be that path. `bindTls` shape-checks `peerCertificate`. | 15, 20 |
| Wire level (documented, not proven) | Every `sendHeaders` for each game's path is counted, and anything other than 1 fails closed (`send_headers_count_not_one`). Receipts carry `sendHeadersEvents: 1`, and frames require it. A duplicate GET on a closed keep-alive socket therefore loses the run; it does not count as evidence. | 15, 19 |

## Changes after the recheck (`../blsh-evidence-bridge-review-2026-11-15/RECHECK.md` §4, §1, §2, §6)

| Recheck item | Fix | Regression (test #) |
| --- | --- | --- |
| 4a: acquisition launch proof | The acquisition runtime gains a `launch` block: entry script and sha, cwd, the 17 launch keys, unlisted `TS_NODE_*` names. **Production requires:**<br>• canonical tool path;<br>• `cwd` = canonical `web/`;<br>• launcher keys present;<br>• no `OPENSSL_CONF` or `TS_NODE_*` overrides.<br>`toolSHA256` is **computed by `frames.mjs` from the bound `source-tool.mjs`**, must equal the launch and runtime claims, and must be in `APPROVED_ACQUISITION_TOOLS` (now exactly `aa8a9cb7…`, G4). The runtime is also bound to its conversion (`conversionSHA256`) and to the v4 adapter pin. | 15 |
| 4b: completeness | **Production frames accept only a completed acquisition directory:** `MANIFEST.json`, no `FAILED.json` or temp manifest, every file listed and hash-equal, and **exactly** one journal + body + receipt per scheduled game (`acquisition_incomplete_or_extra` for a prefix, extra or retry). Loose pairs are test-mode only (`acquisition_directory_required`). | 15, 18 |
| 4c: pins and redirect | The node pin is `APPROVED.nodeSHA256`; the `--node-sha256` argument was removed from the frames CLI. Receipts carry `finalUrl`; production requires `redirected === false` and `finalUrl == url`. The spec's `npm ci` wording is now a stated requirement. | 15 |
| §6 mutant 3 | The `checkObservationClaims` call site now dies too: synthetic mode with a **test stub verifier** (synthetic output is diagnostic only, and the pinned verifier is unchanged and still required for a candidate). The mirror-check call site is covered the same way. Confirmed by mutation: dropping the call fails test 16; file restored and checked with `cmp`. | 16 |
| §1 residual | `assemble.mjs` re-derives a candidate class: `approvedInputs` and pins / verifier / node / lineage must equal `APPROVED`, otherwise `conversion_not_approved`. | 17 |
| §2 Low | The frames directory's own `MANIFEST.json` and all copied `acquisition-*` files are bound. | 17 |
| Build the tool | `acquire-boxscores.mjs`: one GET per scheduled game (6 for 2026-11-11), 0 retries, concurrency 1, `redirect: "error"`. TLS observation comes from the v4 adapter's `withTlsObservation` (hash-pinned `aa6237bd…`). Output is exclusive 0700/0600 with the manifest last. **Tested offline** against loopback TLS (happy, keep-alive binding, 5 faults, 2 pre-start refusals). See `ACQUISITION-SPEC.md` for the exact call budget and approvals. | 18, 19 |

## Changes after the independent review (`../blsh-evidence-bridge-review-2026-11-15/REVIEW.md`)

| Review item | Fix | Regression (test #) |
| --- | --- | --- |
| Q3: pins unpinned | `convert.mjs` `APPROVED` constants. The candidate class needs **exactly** the v4 pins (`f2f639ea…`), the v4 verifier (`04a632ba…`), node `daa77e22…`, lineage `14e0816c…` and bootstrap `a224d62e…` (pins `_bootstrapSHA256`). Otherwise it refuses with `pins_not_approved`, `verifier_not_approved`, `node_pin_not_approved` or `lineage_not_approved`. A synthetic adapter can only ever be diagnostic. | 3 (operator pins, synthetic + operator pins, old verifier, wrong node); 11 |
| Q6: TLS basis unbound | Bound as artifacts: every `operation-*-STARTED/SETTLED.json`, every `*.TRANSPORT-OBSERVATION.json`, the packet `MANIFEST.json` (as `packet-MANIFEST.json`), `PLAN.json`, `RUNTIME.json` and `STARTED.json`, plus `CONVERSION.json`, `FRAMES.json` and `ACQUISITION-RUNTIME.json`. | 3 (each hash asserted in `requiredArtifactSHA256`, byte-equal to the packet files) |
| Interface: exact keys | `RUNTIME.json` exact key set at the top level and in `node`, `tls` and `launch`, plus the 15 environment keys and the 17 v4 launch keys. Each per-operation `tls` has an exact 14-key set. | 5 (`runtime_unexpected_keys`, `tls_observation_shape`, launch shape) |
| Q5: frame transport | Production `frames.mjs` refuses `TLSVerified` self-assertion and any `syntheticTestOnly` marker. It requires v2 receipts with a per-request TLS chain plus an acquisition runtime, and a reviewed tool hash (now `aa8a9cb7…`; any other tool → `acquisition_tool_not_reviewed`). Test mode is a function option only; it is marked, and `propose-policy` refuses it. **Tool spec:** `ACQUISITION-SPEC.md` (6 calls, 0 retries, separate TJ approval). | 3, 12, 15 |
| Q7: tests wrote into the folder | Tests 12 and 13 write to scratch. Both Python scripts write only to an explicit output path. Test 17 asserts the folder is byte-identical before and after the suite. | 17 |
| Q10: EEXIST | All four CLIs report `output_exists` (exit 2), and the target is untouched. | 16 |
| Lifecycle key | `NST_JOB_LIFECYCLE_ENABLED` must be **absent**: present (even "false") → `runtime_lifecycle_key_present`. | 5 |
| v4 alignment | `launch` proof checked: overrides, unlisted `TS_NODE_*` names, the bootstrap hash, and launched-by-bootstrap for a candidate. Each operation's `tls.defaultCACertificatesSHA256` must equal RUNTIME's (`tls_ca_store_changed`). | 3, 5 |
| MUTATIONS survivors | Direct asserts for the exact 8-day boundary (`nativeDateFresh`), the TRANSPORT-OBSERVATION mirror and `observation_overclaims_tls`. The `<8 → <=8`, drop-mirror and drop-overclaim mutants are now each caught (rerun 2026-11-15; file restored and checked with `cmp`). | 5 |

**v3 → v4 note.** Chef asked for the pins `55a50c6d…` (v3). Before this fix landed, the successor lane superseded v3 with v4. Because `APPROVED` names v4, v3 packets are refused. If v3 is what TJ approves instead, swap the three constants in a reviewed change.

## What it does

The bridge turns one verified runner packet into the inputs that `prepare_packet.py` (prior art, unchanged) composes into a witness bundle for the unchanged gate `createCurrentProcessEvidenceGate`. The prior art is reused, not rewritten.

```
packet (+ its RUNTIME.json) ──convert.mjs──► NativeReceipts, definition, allowlist, bound copies (CONVERSION.json)
official boxscores ─────────frames.mjs───► OfficialFrames (FRAMES.json)
request + context ─────────assemble.mjs──► native-inputs.json (fhfh.blsh.native-packet-inputs.v1) + window report
                     prepare_packet.py (pinned nst_lineage.py parses NST cells) ──► PROPOSED-BUNDLE.json
                     propose-policy.mjs ──► PROPOSED acceptance entry (reviewSHA256 = null, so it cannot be installed)
```

**Files:**
- `lib.mjs`: strict JSON, the gate's exact timestamp grammar, the canonical NST URL, and exclusive 0700/0600 output with a hard-link completion manifest.
- `convert.mjs`: the TLS decision, the runtime check and the representation map.
- `frames.mjs`, `assemble.mjs`, `propose-policy.mjs`.
- `real_fixture_lineage.py`, `window_feasibility.py`.
- `tests/`.

**Pinned or used, unchanged:**

| Item | sha256 |
| --- | --- |
| gate | `e69db2c0…c724` |
| `currentInput.ts` | `58a87ea1…6232` |
| `prepare_packet.py` | `b8a5fc7f…05f3` |
| `closed_gate.cjs` | `b5578fd7…353c` |
| `nst_lineage.py` | `14e0816c…4da` |
| `intake.py` | `7cb3e091…9b92` |
| successor v4 `verify-packet.mjs` | `04a632ba…2101` |
| successor v4 `expected-pins.json` | `f2f639ea…f21c` |
| successor v4 `SUCCESSOR.patch` | `66b4eb30…85d` (bootstrap `a224d62e…51e7`) |

**Use the successor's verifier for successor packets.** Chef's earlier `verify-packet.mjs` (`7816ec6a…`) vetoes every successor packet: its credential scan matches the presence key *name* `SUPABASE_SERVICE_ROLE_KEY` inside `RUNTIME.json`.

## Input contract

### 1. `convert.mjs`

```
node convert.mjs --candidate v5|v5-1118 --packet <dir> --pins <expected-pins.json> --verifier <successor verify-packet.mjs> \
  --node-sha256 <bootstrap NODE_SHA256> --lineage <nst_lineage.py> --out <new dir> [--synthetic-adapter-ok]
```

`--candidate` is required unless `--synthetic-adapter-ok` is given (`candidate_required`); an unknown value → `candidate_unknown`. It selects the approved input set (`CANDIDATES` in `convert.mjs`) and is never inferred from the packet. `assemble.mjs` takes the same required `--candidate`.

The steps run in this order, and **every validation happens before any output exists**, so a refusal creates no output directory.

1. **Readback.** Runs the verifier and refuses on any veto (`packet_vetoed:<reasons>`). After that, every byte is re-read by the bridge itself.
2. **Producer and redactor** come from the **pins**, never from the packet: producer = `pins.adapter`, redactor = `pins.client`. The packet's bindings and `source-*.ts` bytes must agree with them.
   - With `--synthetic-adapter-ok`, the producer is the packet's unpinned adapter, and the result is classed `diagnostic_only_synthetic_adapter`. `propose-policy.mjs` refuses that class.
3. **Plan scope.** The date, season and both URLs are re-derived with the frozen `pageUrl` rule and must be byte-equal. The run must start within the 15-minute plan lifetime.
4. **Freshness rule, unchanged** (`nativeProcessCapturePreparation.ts:48`), applied at each NST retrieval: date < retrieval UTC day, and retrieval − date 00:00Z < 8 days. Otherwise it refuses with `future_incomplete_or_stale_date`.
5. **Representation.** `client_redacted_parser_input → parser_input_after_redaction` is the only mapping.
   - **Why the mapping is exact:** the runner's NST bytes are `Buffer.from(redactNstMessage(text))` from `client.ts:fetchNstTextByUrl` (adapter `:124-137`), retained unmodified (runner `:280-296`).
   - The schedule's `original_decoded_body` is never a NativeReceipt. Any other label → `representation_unmapped`.
6. **`TLSVerified: true`** is decided once for the run, and **only** if both of these hold:
   - **(a) `verifyTlsChain`.** Successor HANDOFF §2 fields: `operation-N-SETTLED.json.tls` for **all five** operations, including the schedule, which supplies finality for every frame. They must also be mirrored byte-for-byte in `{schedule,individual,onIce}.TRANSPORT-OBSERVATION.json.tls`. The bridge re-derives the rules independently:
     - channel `undici:client:sendHeaders`;
     - `authorized` true, with no `authorizationError`;
     - TLS 1.2 or 1.3;
     - `servername` = the request host;
     - **not resumed:** a full peer certificate (32-byte fingerprint, issuer chain of 1–10 entries) and `resumedFromOperation: null`;
     - **resumed:** `resumedFromOperation` = the earliest earlier full handshake for the same host;
     - **keep-alive:** `connectionFromOperation` = the opener of that `connectionSequence`, same host;
     - a new connection never repeats a sequence number.
   - **(b) `checkRuntime`**, on the packet's own `RUNTIME.json` (`fhfh.blsh.native-capture-runtime.v1`, written in-process before the first dispatch and listed in MANIFEST):
     - `startedAtUTC` equals STARTED's;
     - the pinned project, disabled lifecycle, and `valuesRecorded: false`;
     - all 15 `environmentPresence` keys present and `false` (no extra or system CA, no reject-unauthorized override, no proxy, no `NODE_OPTIONS`);
     - **`defaultCACertificatesSHA256 == rootCertificatesSHA256`** with equal counts, so the effective store is Node's bundled roots;
     - an allowlisted `execArgv`;
     - `node.execPathSHA256 == --node-sha256` (the bootstrap's pinned `NODE_SHA256`);
     - outside synthetic mode, the adapter's three credential keys reported present.

   The packet's own `TLSVerified` must stay `null`.
7. **Outputs** (new directory, 0700/0600, `MANIFEST.json` written last):
   - `receipt-{individual,onIce}.json`: exactly the gate's NativeReceipt fields, with `url` = the plan URL;
   - `native-*.parser-input.html`, copied byte-identical;
   - `definition.json`: scope, cells and the TOI contract; `model: "unknown"`;
   - `producer-allowlist.json`;
   - bound copies of the producer and redactor sources, `STARTED.json`, `READBACK.json`, `RUNTIME.json` and `schedule.raw.json`;
   - `CONVERSION.json`: schedule facts, receipts and the TLS facts used.

### 2. `frames.mjs` (OfficialFrames)

```
node frames.mjs --conversion <conv>/CONVERSION.json --boxscore <body.json>,<receipt.json> [...] --out <new dir>
```

- **Official source:** `GET https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore`, **one call per game**. Its shape was verified against retained real bodies.
- **Receipt:** the existing official-read receipt `{at, url, httpStatus: 200, TLSVerified: true, sha256, bytes, state: "verified"}`.
- **Checks:**
  - the game is on the packet's schedule;
  - `season 20262027`, `gameType 2`, the date, OFF or FINAL, `gameScheduleState` OK;
  - the teams equal the schedule's;
  - TOI `MM:SS` converts to whole seconds;
  - each player appears once per date;
  - a skater with 0 TOI gets no frame.
- **Empty input** is refused (`no_official_boxscores_supplied`). `FRAMES.json` lists `scheduledGamesWithoutBoxscore`.
- **`completedByUTC`** = the **earliest** official observation showing the game final, normally the packet's own TLS-verified schedule call, which precedes the NST requests. It is never start time plus a guess.
- **`gamesOnNativeDate`** and **`dateMembershipComplete`** come from the packet schedule.
- **Acquisition is NOT done here.** It is a separate bounded read for TJ's approval:
  - for 2026-11-11: **6 boxscore calls** (games 2026020293–298);
  - one player's latest five: **5 calls**;
  - a league-wide 8-date refresh: **59 calls** in the retained calendar.

### 3. `assemble.mjs`, `prepare_packet.py` and `propose-policy.mjs`

- **`assemble.mjs`:** `--request --context --conversion <dir>… --frames <dir>… --out`.
  - It writes one row per selected WGO record × group that has a native packet for its date, a unique stored process row and a frame.
  - Window report: `short_window`, `window_dates_without_native_capture:n` and `window_members_without_official_frame:n`. It always reports `windowComplete: false`.
- **`prepare_packet.py`** is unchanged. Use the CLI template from its HANDOFF.
- **`propose-policy.mjs`:** `--prepared --assembly`.
  - **Output:** `{bundleSHA256, requestSHA256, reviewSHA256: null, reviewScope, requiredArtifactSHA256}`.
  - **What it binds:** every witness artifact, plus the readback, `RUNTIME.json`, STARTED, the schedule and the boxscores.
  - **What it refuses:** synthetic classes and empty bundles. It is **never installed**.

**CLI smoke (run 2026-11-15 on scratch packets):**
- `convert`: ok (exit 0). A packet without TLS or RUNTIME → exit 2, `packet_vetoed:operation_1…5_tls_observation_missing|runtime_receipt_missing|…`.
- `frames`: 288 frames; empty input → exit 2.
- `assemble`: 576 entries.
- `prepare_packet`: 468 witnesses, 0 admissions.
- `propose-policy`: refuses synthetic (exit 2); with candidate-class inputs it emits a 261-artifact proposal with `reviewSHA256: null`.

## Tests: **21/21 pass** in the canonical checkout with v5 applied, the G4 tool list and the parked fallback and staged-tool tests (`TESTS.log`, 182 s, `BRIDGE_PINS` = v5 pins; the suite writes only to `TMPDIR` scratch, asserted by test 21; no test creates the real fixed output path)

The numbered list below is the original 14. The added tests and regressions are in the two tables at the top:
- 15: production frames over acquisition directories;
- 16: call-site mutants;
- 17: assemble re-check;
- 18: tool is self-contained / adapter-copy equivalence / constants;
- 19: loopback acquisition tool;
- 20: CLI `output_exists` / `output_path_is_fixed` / `conversion_not_approved`;
- 21: no writes into this folder.

Test 3 needs the canonical path, because the launch proof pins `/Users/tim/Code/fhfhockey.com/web`.

```bash
cd tasks/artifacts/blsh-evidence-bridge-2026-11-15 && env -u GIT_DIR TMPDIR=<scratch> node --test tests/bridge.test.mjs
```

**Tree precondition.** Packets are generated from the live `web/` sources, so the live runner must equal the pins file in use.
- **Unpatched tree** (runner `5ef3a631…`): no settings; `BRIDGE_PINS` defaults to Chef's `expected-pins.json`.
- **v5 applied** (runner `a74cbb0a…`): set `BRIDGE_PINS` to `approved/v5/expected-pins.json`. `BRIDGE_VERIFIER` already defaults to `approved/v5/verify-packet.mjs`.
- `BRIDGE_REHEARSE` and `BRIDGE_REHEARSAL_CLOCK` are no longer read: test 14 always uses Chef's vendored `rehearse.ts` and its clock against a `git archive` export of the base commit.

```bash
cd tasks/artifacts/blsh-evidence-bridge-2026-11-15 && env -u GIT_DIR TMPDIR=<scratch> BRIDGE_PINS=$PWD/approved/v5/expected-pins.json node --test tests/bridge.test.mjs
```

1. **End-to-end through the REAL gate with a test-only policy.** Inputs: a synthetic successor-format packet, the **real** NST 2026-10-01 counts page and the **real** stored rows, with only the clocks re-stamped in scratch.
   - Result: **234 individual + 234 on-ice rows qualify**, which is exactly the rule: all 288 rows except the 54 on teams that NST prints dotted.
   - The on-ice page is synthetic markup, because no real all-strength on-ice counts page was retained.
2. **The CLOSED policy admits 0** (direct call and `prepare_packet`'s replay).
3. **Proposal.**
   - Refused for a synthetic adapter.
   - The candidate-class proposal (test-only pins and packet) is rejected by the gate constructor as written.
   - Once a test review is filled in, it qualifies the same 234 + 234 rows, and it binds the readback, `RUNTIME.json`, STARTED and the schedule.
4. **TLS and RUNTIME missing** (the pre-successor format): vetoed, and no output.
5. **TLS and runtime, 12 packet-level cases:**
   - unauthorized peer;
   - schedule servername;
   - missing certificate;
   - TLS 1.1;
   - inconsistent mirror;
   - admission `tls: null`;
   - resumed with no prior handshake;
   - a default CA store that is not the bundled roots (bridge-only);
   - an env override present;
   - an unbound RUNTIME;
   - an exec override;
   - RUNTIME missing.

   It also covers an unpinned node binary and **positive** resumed and keep-alive bindings. Ten chain rules are asserted directly on `verifyTlsChain`, including a resumption pointing at the wrong operation or none while a valid handshake exists; the runtime rules are asserted on `checkRuntime`. (The test file was extended after `TESTS.log`; that one test was rerun alone and passed.)
6. **Gate layer:**
   - `TLSVerified: false` or the runner's label → `native_transport_or_representation_unqualified`;
   - wrong `fd` or `sit` → `native_date_strength_or_unit_scope_unqualified`;
   - frame TOI + 1 → `official_identity_or_exposure_hold`;
   - an artifact byte change → `accepted_artifact_hash_mismatch`.
7. **Frame TOI mismatch at the bridge layer** → `official_exposure_hold`; no witness.
8. **Wrong date or strength in the packet URLs:** vetoed, or `plan_url_not_canonical` even for a coherent forgery.
9. **Stale:**
   - retrieval at ≥ 8 days, or on the same day, → `future_incomplete_or_stale_date`;
   - gate evaluation one day later, with the oldest evidence about 25.5 h old, → `current_use_evidence_stale_or_unknown`, which fails the source observation too.
10. **Short window:** reported and never admitted (`fewer_than_five_captured_records`).
11. **Vetoed packets:** a `FAILED.json`, a byte flip, an extra file, an unmapped representation, or a synthetic adapter under the real pins.
12. **Real boxscore 2026020187:** **36/36** frame TOIs equal the real stored WGO and NST TOI. Empty input is refused.
13. **Real NST pages through the pinned parser:**
    - counts page: **234/288 match on every field**; **54 held** on team text (NJD/SJS/TBL ×18);
    - real rates and PK on-ice pages: refused by scope.
14. **Fidelity.** The real, unpatched runner (Chef `rehearse.ts happy`, offline, 0 network attempts) produces the same file set and JSON key sets as the generator, apart from the successor's `RUNTIME.json` and `tls` additions.
    - Its packet is refused.
    - With successor-shaped facts injected into those real bytes, it converts.

**Mutation checks:** removing the TLS chain call fails test 5, and removing the 8-day rule fails test 9. The file was restored byte-identical.

## Headline findings for the parent

1. **The final `SUCCESSOR.patch` supplies what the bridge needs:** TLS on all five operations with resumption and keep-alive bindings, plus a packet-bound `RUNTIME.json`. A real successor packet can convert, provided:
   - its facts pass the rules above;
   - it is verified with the **successor's** verifier;
   - the bridge is given the pinned `NODE_SHA256`.
2. **Window feasibility: the 8-day capture rule combined with the gate's 24 h capture age** (`WINDOW-FEASIBILITY.json`; real retained request, 644 players with ≥ 5 games):
   - A latest-five window spans min 7, median 9, p90 14 days.
   - All five members can be source-observation-qualified at one evaluation only if span ≤ 7: **68/644 (10.6%)**, and only with the oldest date captured about 24 h before a late-day evaluation.
   - Current use of all five needs span ≤ 6: **0/644**.
   - **Per player:** 5 single-date packets (10 NST requests) + 5 boxscore calls, all within the same 24 h. League-wide: up to 8 packets (16 NST requests) + about 59 boxscores per evaluation.
   - **Today's runner hard-codes one `DATE` and one output path**, so five packets means five separately pinned and approved candidates.
   - Both rules were kept intact.
3. **The gate never admits a window.** `capturedWindows` hard-codes `completeLatestFiveEstablished: false` and `currentUseQualified: false` (`:262-266`). Short-window refusal is a bridge-layer report.
4. **Team codes (proposal, not applied).** The pinned `nst_lineage.py` compares NST's team cell literally with WGO `team_abbrev`, which holds **every player on dotted-code teams**: 54/288 on 10-01 (NJD, SJS and TBL observed).
   - **Proposed:** a reviewed explicit map in a new pinned lineage version: `{N.J:NJD, S.J:SJS, T.B:TBL}`, plus `L.A:LAK`, which is **unverified on retained bytes** (LAK did not play 10-01).

## What a live run must additionally supply

1. A packet from the applied, approved `SUCCESSOR.patch`, verified with its `verify-packet.mjs` and `expected-pins.json`. Its real TLS facts must satisfy the rules above; the rehearsal's TLS facts were synthetic.
2. The bootstrap's pinned `NODE_SHA256` (`daa77e22…1fef`, from `SUCCESSOR.patch:310`) as `--node-sha256`. The NST custodian must accept "every override absent, plus default store == bundled roots" as sufficient evidence of the default CA (BLOCKERS B2 item 1).
   - The bridge does not check that the adapter leaves the global dispatcher or agent unreplaced. That is a source-review item for the pinned adapter.
3. Boxscores for every game on the native date (6 for 2026-11-11), acquired in a separate bounded read approved by TJ, with receipts in the shape above, inside the capture-age window before evaluation.
4. A `CURRENT-REQUEST.json` whose captures are within `maxCaptureAgeHours` of evaluation and include the native date's stored rows, plus a `CONTEXTS.json` selection.
5. A real all-strength **on-ice** counts page. On-ice markup is unproven on real bytes.
6. An independent review artifact. Its hash fills `reviewSHA256`, and a server policy owner other than this lane installs the reviewed entry.

## Gate change proposals

None is required for the bridge. If window admission is ever wanted, it needs a new reviewed gate version; today the window fields are constants. The capture-age-versus-8-day interaction is a policy question, not a code defect.
