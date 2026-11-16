# Recheck 3: acquisition tool `4f8a0888…` and RECHECK-2 F1–F3 (2026-11-15)

**Rules (unchanged):** read-only, scratch only, no git mutation; no network, provider, DB, ledger, credential or `.env` access. Every attack ran with a loopback-only socket guard. The tool's real fixed output path (`/Users/tim/Library/Application Support/fhfh-blsh-boxscores-20261111`) was **never created**; I checked after every run.

## State of the bytes (read this first)

**Code under review: stable.** `acquire-boxscores.mjs` **`4f8a0888…`**, `frames.mjs` `9a5875dc…`, `convert.mjs` `eea43c7f…`, `assemble.mjs` `836f3bca…`, `lib.mjs` `6dc88336…`, `tests/acquire-harness.mjs` `c5400216…` and `tests/observation-equivalence.mjs` `a6cc11f6…` all match Chef's message.

**The bridge lane was still editing during this recheck.**
- At 11:08 it added `approved/` (vendored upstream v4 and Chef files, plus `UPSTREAM-PINS.json`) and rewrote `tests/bridge.test.mjs` (now `cb91d4b7…`) and `tests/fixtures.mjs` (now `ff6c2069…`).
- `SHA256SUMS` now fails 2 of 19 (those two test files). Chef's `82fcc976…` and `573d0a00…` are gone.

**Successor v5 landed at 11:05–11:08**, during this recheck:
- `SUCCESSOR.patch e8be50de…`, verifier `b86af692…`, pins `a2a1e694…`;
- v4 moved to `superseded/`;
- the bridge's `APPROVED`, and the tool's own copy of it, still name **v4** (`f2f639ea…`, `04a632ba…`).

**Suite:**
- my first mirror snapshot, taken mid-edit, gave **0/21**: every `before()` was vetoed by the live v5 verifier;
- **on the current test bytes**, with the vendored v4 `approved/` folder and my usual one-line scratch fixture edit (`WEB` set to the canonical `web/`, which the launch proof pins), it gave **21/21** in 178 s.

**Exactly which tests ran, against which verifier** (answering Chef's 11:1x warning; v4 was already vendored when I ran):

| Run | Test bytes | Verifier and pins used | Result |
| --- | --- | --- | --- |
| Suite, mirror6 (mid-edit snapshot, discarded) | pre-11:08 tests | live successor `rehearsal/verify-packet.mjs` **`b86af692…` (v5)** | 0/21: every `before()` vetoed by v5. Not used as evidence. |
| **Suite, mirror7 (the evidence)** | `bridge.test.mjs cb91d4b7…`, `fixtures.mjs ff6c2069…` (current, not in SHA256SUMS) | vendored `bridge/approved/v4/verify-packet.mjs` **`04a632ba…`**, `approved/v4/expected-pins.json` **`f2f639ea…`**, `approved/v4/SUCCESSOR.patch` **`66b4eb30…`**. Byte-identical to `superseded/rehearsal-v4/` and `superseded/SUCCESSOR-v4-66b4eb30.patch`; I re-hashed both. | **21/21** |
| `repro-convert-v4.mjs` | n/a | `REVIEW_SUCC_REHEARSAL=bridge/approved/v4` (**`04a632ba…`** / **`f2f639ea…`**) | same results as RECHECK 1 |
| `repro-units-v4.mjs`, `acq3/*`, `f2-probes.mjs` | n/a | no verifier involved (direct bridge and tool calls). The approved conversion `rc4/conv-v4_forged_real_pins` came from a v4 convert (`04a632ba…`). | as tabled below |

**New reproducers in `repro/acq3/`:** `common.mjs`, `preload-guard.cjs`, `wrapper-preinstall.mjs`, `wrapper-midrun.mjs`, `wrapper-spoof.mjs` and `f2-probes.mjs`. `repro/packet.mjs` gained a `REVIEW_SUCC_REHEARSAL` override so my older reproducers can target the vendored v4 files.

## Verdicts

| # | Item | Verdict |
| --- | --- | --- |
| 1 | F1: self-contained, injection routes, dispatcher identity, observation equivalence | **PASS** (custody residual stated) |
| 2 | F2: ids only from an approved conversion's hash-checked `schedule.raw.json` | **PASS** (custody residual, Low date check) |
| 3 | F3: fixed output path; `peerCertificate` shape | **PASS** (two Lows) |
| 4 | `send_headers_count_not_one` guard and its wording | **PASS** (one wording nit) |
| 5 | Regressions vs REVIEW, RECHECK and RECHECK-2 | **None in the bridge.** One upstream **mismatch**: successor v5 vs the bridge's and tool's v4 `APPROVED`. |

### **APPROVE tool hash 4f8a0888… for APPROVED_ACQUISITION_TOOLS**

- **Scope:** this approves *these bytes* as the acquisition tool. It does **not** authorize running them; that is TJ's separate approval.
- **The tool acts only for v4-approved conversions.** It refuses anything else (`conversion_not_approved`). If the pilot moves to successor v5, the tool's `APPROVED` must change, which gives a new hash and needs a new review.
- I did not edit `frames.mjs`.

---

## 1. F1: PASS

**Self-contained.**
- `acquire-boxscores.mjs` imports only `node:diagnostics_channel`, `node:crypto`, `node:tls`, `node:fs`, `node:path` and `node:url`, with no `createRequire`, `import()` or `require` (`:15-20`; test 18 asserts this by regex, and I read the whole file).
- The tool refuses a non-empty `process.execArgv` before anything else (`:196`), and `frames.mjs` independently requires `runtime.node.execArgv` to be `[]` (`acquisition_exec_argv_not_empty`).
- The adapter observation code is **textually identical** to v4 `aa6237bd…` lines 19–75: I diffed it myself against a scratch `patch -p1`. The only differences are TypeScript type erasure, two removed comments, and `need(…)` replaced by the equivalent `if (!(…)) throw new Error(…)`.
- `observation-equivalence.mjs` adds a behavioural check on 12 scenarios (full, reused socket, resumed, unauthorized, plain, no leaf, path mismatch, query stripped, two events, none, other origin, POST). The textual diff is the stronger evidence.

**Injection routes, each attacked (loopback only):**

| Route | Result |
| --- | --- |
| `--require` preload that installs a global dispatcher | `runtime_exec_argv_not_empty` (nothing written or sent) |
| `--import` preload | `runtime_exec_argv_not_empty` |
| `NODE_OPTIONS="--require …"` (does not appear in `execArgv`) | `runtime_override_env_present` |
| `OPENSSL_CONF` / `NODE_PATH` set, no preload | `runtime_launch_override_present` |
| `NODE_EXTRA_CA_CERTS` set | `runtime_override_env_present` |
| global dispatcher **preinstalled** by a wrapper entry (npm undici, or simply loading npm undici, which registers one) | `global_dispatcher_preinstalled` (0 requests, no directory) |
| global dispatcher **swapped mid-run** (op 1 through the loopback test dispatcher, global set during spacing) | `acquisition_failed:global_dispatcher_changed` with `FAILED.json`, no manifest, op 2 not sent (`sendHeadersEventsAtFailure: 0`) |
| modified `node:` builtin | Not possible without loader hooks, which need `--import`/`--loader` (`execArgv`) or code already running; `node:` specifiers resolve only to builtins compiled into the pinned binary (`daa77e22…`, static OpenSSL 3.5.9). |
| OpenSSL default config | The binary's `OPENSSLDIR` is `/System/Library/OpenSSL/`, which is root-owned on the system volume; its `openssl.cnf` has no `nodejs_conf` section. Machine-level only. |

**Dispatcher identity check: sound for the documented launch.**
- On bare Node 22.23.4 the registry is `undefined` until the first bundled `fetch` creates an `Agent`; I verified this.
- The tool requires it to be unset at start and before op 1, takes the object fetch creates, and requires that same object before and after every later request.
- A self-contained tool has no other code that could run between those points.
- This is not the capture runner's situation. v5's HANDOFF shows the capture transport is npm undici, loaded by cheerio. The tool loads no npm modules, so it runs on Node's bundled undici.

**Custody residual (unchanged class, same as Q1).** `wrapper-spoof.mjs` is a *non-documented* entry script that lies:
- it sets `process.argv[1]` to the tool path;
- it replaces global `fetch` with one that routes through a private-CA loopback `Agent` and plants a sentinel registry value after the start check.

The run completed 6 requests, and its runtime and receipts self-report everything `frames.mjs` checks: `execArgv: []`, entry script equal to the tool with hash `4f8a0888…`, `globalDispatcherAtStart: "unset"`, `globalDispatcher: "unchanged"`, `sendHeadersEvents: 1`, and `authorized: true` against the self-signed cert.

Real production `frames.mjs` refused it only for `acquisition_output_path_not_fixed`, because my scratch output path was used; a wrapper run from the canonical checkout into the fixed path would self-report that too. Like a hand-written directory, this is defeated only by custody (operator, launcher, path), not by bytes.

## 2. F2: PASS

`approvedScheduleIds` (`:159-176`) requires:
- a completed conversion directory, with no unlisted files and every used file hash- and size-checked against its `MANIFEST.json`;
- `CONVERSION.json` with `evidenceClass === candidate…`, `approvedInputs === true`, and pins, verifier, node and lineage equal to `APPROVED`;
- `sha256(schedule.raw.json) === scheduleFacts.scheduleSHA256`;
- ids re-derived from the schedule body (date filter, all OFF or FINAL, at most 16, `202602dddd`, unique) and equal to `scheduleFacts`.

Probes (`f2-probes.mjs`):

| Probe | Result |
| --- | --- |
| diagnostic conversion | `conversion_not_approved` |
| `schedule.raw.json` byte flip, not resealed | `conversion_hash_drift` |
| schedule with an extra game, manifest resealed | `schedule_hash_drift` |
| `CONVERSION.json` ids added, resealed | `schedule_ids_drift` |
| unlisted file | `conversion_unlisted_file` |
| **diagnostic conversion hand-relabelled** as approved candidate, resealed | **passes every id check** and dispatches (to loopback, here refused) |

The last row is the custody limit: the conversion directory is self-attested. The tool also checks `APPROVED` values that `assemble.mjs` re-derives later.

**Low:** `c.date` is not format-checked before it builds the output path. A forged date cannot escape, because the non-existent `fhfh-blsh-boxscores-` component stops resolution, and `frames.mjs` `checkFacts` refuses a bad date anyway. Add `isDay(c.date)`.

## 3. F3: PASS

**Output path:**
- `fixedOutputPath(date)` = `/Users/tim/Library/Application Support/fhfh-blsh-boxscores-YYYYMMDD`;
- the CLI refuses any `--out` (`output_path_is_fixed`, reproduced);
- `mkdirSync` is non-recursive, so an existing path gives `output_exists`;
- `frames.mjs` requires `runtime.outputDirectory === fixedOutputPath(scheduleFacts.date)`.

**Low:** `frames.mjs` checks the *recorded* path but not that the directory it is reading is that path (`realpath(acquisitionDir) === runtime.outputDirectory`). A copied directory is accepted. Add the check, or name the path in the operator procedure.

**`peerCertificate`:** `bindTls` now refuses a malformed certificate (`tls_peer_certificate_shape`): fingerprint regex, chain of 1–10, and `valid_from`, `valid_to` and `subjectCN` each string or null.
- **Low:** the elements of `issuerCNChain` are not type-checked (the runner's `peerFacts` does check them).
- `frames.mjs` `verifyTlsChain` re-checks fingerprint and chain length.

## 4. `send_headers_count_not_one`: PASS (wording nit)

It counts every `undici:client:sendHeaders` for the game's path, from subscription before the request until the body is fully read, and requires exactly 1. `withTlsObservation` independently requires exactly one event of any kind. `frames.mjs` requires `sendHeadersEvents === 1` in every receipt.

**Honest about its limits.** ACQUISITION-SPEC §5 says it "does NOT prove" the absence of a wire-level re-send, and it does not. It detects after the fact: an extra GET would already have been sent, and the run then fails closed with no manifest.

**Nit:** "at most one extra GET per game" is a claim about undici's behaviour, not something the tool bounds. Say "detected and fail-closed; any extra sends are bounded by undici's own behaviour". The exposure is official NHL GETs only; nothing is NST-rate-limited.

## 5. Regressions

**Bridge: none.**
- Against the vendored v4 inputs (`REVIEW_SUCC_REHEARSAL=…/approved/v4`), my RECHECK-1 reproducers (`repro-convert-v4.mjs`, `repro-units-v4.mjs`) give the same results as before:
  - approved inputs reach the candidate class only with approved bytes;
  - exact key sets, launch proof, CA re-check and lifecycle key all behave as before.
- RECHECK-2's frames probes now stop earlier, because loose pairs are refused outright in production (`acquisition_directory_required`). The structural checks (prefix, extra, retry, FAILED, temp manifest) are unchanged in `readAcquisition`.
- 4c and mutant 3 are covered by tests 15 and 16, which pass.

**Upstream mismatch (not a bridge defect, but it blocks a live run until resolved).**
- Successor **v5** is now the live candidate. Against the live successor folder, every `convertPacket` in my reproducer gives `pins_not_approved`, and my earlier mid-edit snapshot of the suite gave 0/21.
- The bridge and the tool are approved for **v4 only**. Either the pilot runs v4 (vendored in `bridge/approved/v4`, `SUCCESSOR.patch 66b4eb30…`), or the bridge's `APPROVED`, the tool's `APPROVED`, its hash and this approval are all redone for v5.
- v5's HANDOFF also says the *capture* transport is npm undici 7.29.0 (`node_modules`, unpinned), not bundled undici. That is for the capture review, not this tool, which loads no npm modules.

---

## Updated preconditions

1. **Choose the candidate.** Capture with v4 (`66b4eb30…`), matching the bridge's and the tool's `APPROVED`. Or re-pin the bridge and the tool for v5 and re-review them (new tool hash).
2. **Re-seal the bridge folder.** Its `SHA256SUMS` must pass in full again (it fails 2 of 19 right now). The suite must then pass 21/21 in the canonical checkout.
3. **Approve the tool:** add `4f8a0888…` to `APPROVED_ACQUISITION_TOOLS` by a reviewed change from a lane other than the bridge author. This review is the evidence.
   - Optional Lows first, which would change the hash and need re-review: an `isDay(c.date)` check in the tool; type-checking the `issuerCNChain` elements in the tool; a realpath check in `frames.mjs`, which is outside the tool hash; the wording nit.
4. **TJ's separate run approval:**
   - exactly 6 GETs for 2026-11-11 (games 293–298, per the packet's own schedule), 0 retries;
   - run right after conversion, within the 24 h evaluation window;
   - the exact launch: `cd /Users/tim/Code/fhfhockey.com/web && env -i PATH=/usr/bin:/bin HOME=… TMPDIR=… /usr/local/bin/node <bridge>/acquire-boxscores.mjs --conversion <approved conversion dir>`, with no `execArgv`, no `NODE_OPTIONS` and no other entry script;
   - output only at `/Users/tim/Library/Application Support/fhfh-blsh-boxscores-20261111`, which must not exist beforehand. The operator hands that directory, untouched and in place, to `frames.mjs`.
5. **Capture custody, timing, holds, review and install:** unchanged from RECHECK 1 items 1–3 and 6–8, plus RECHECK-2. Gate evaluation no later than about 2026-11-18T14:05Z. Dotted-code teams, the on-ice page format and windows stay held. An independent `reviewSHA256` is filled in and installed by a separate policy owner.

**Side effects:**
- the bridge folder was not touched by me (its 2 failing sums are the bridge lane's own 11:08 edits);
- `git status web` is unchanged;
- the loopback server exited on its own timer after serving 7 loopback requests;
- the fixed output path does not exist.
