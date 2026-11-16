# Recheck 2: RECHECK §4 fixes and the acquisition tool (2026-11-15)

**Rules (unchanged):** read-only, scratch only, no git mutation; no network, provider, DB, ledger, credential or `.env` access. The reproducers use loopback sockets only, and every non-loopback connect is refused in-process.

**Bytes reviewed:** bridge `SHA256SUMS` passes **18/18**. The hashes match Chef's message:
- `acquire-boxscores.mjs e075b90a…`, `frames.mjs 0a233199…`, `assemble.mjs 836f3bca…`;
- `tests/acquire-harness.mjs 0487e9fe…`, `tests/bridge.test.mjs 4b5f1a26…`, `tests/fixtures.mjs 308a30a6…`;
- `ACQUISITION-SPEC.md 91c72518…`.

`convert.mjs` (`eea43c7f…`) and the verifier (`04a632ba…`) are unchanged.

**Suite:** **20/20** in my scratch mirror, 179 s. The only scratch edit was the mirror's `fixtures.mjs` `WEB` line, pointed at the canonical `web/`, as in RECHECK 1, because the launch proof pins that path. Test 18, the tool over loopback TLS, passed.

**New reproducers in `repro/`:**
- `acq-closure/inject-into-lib.mjs.txt` and `acq-closure/loopback-server.mjs`;
- `repro-acq-structure.mjs`;
- `mutate5.sh` (mirror-only mutants; `convert.mjs` restored byte-identical, checked with `cmp`).

## Verdicts

| # | Item | Verdict |
| --- | --- | --- |
| 1 | 4a: launch block enforced; `toolSHA256` derived from the bound source; approved list empty | **PASS** for what it covers. The tool hash does **not** cover the tool's import closure (item 5, F1). |
| 2 | 4b: only complete acquisition directories accepted | **PASS** |
| 3 | 4c: node pin = `APPROVED.nodeSHA256`; `redirected === false` and `finalUrl === url` | **PASS** |
| 4 | Mutant 3 dies at the call site, verifier not weakened | **PASS** |
| 5 | The tool itself | **FAIL**: F1 (High, reproduced), F2 (Medium, reproduced), F3 (Low); one wire-level point **UNVERIFIED** |
| 6 | Call budget | **PASS** |

### **DO NOT APPROVE tool hash e075b90a… for APPROVED_ACQUISITION_TOOLS.**

**F1:** the hash pins one file, not the code that runs. An injected import made `frames.mjs` emit **production** frames from a self-signed loopback server while `toolSHA256` stayed `e075b90a…` (reproduced below).

**F2:** the tool takes game ids from any conversion directory, including a diagnostic one.

Fix both, then re-review the new hash.

---

## 1. 4a: PASS (scope limited by F1)

**Production `verifyAcquisition`** (`frames.mjs`) requires:
- exact runtime keys, now with `launch`, `adapterSHA256` and `conversionSHA256`;
- the launch block: `entryScript === ACQUISITION_TOOL_PATH` (the tool beside `frames.mjs`), `entryScriptSHA256 === toolSHA256`, `cwd === WEB_ROOT`, the three launcher keys present, and `OPENSSL_CONF`, other `TS_NODE_*` and unlisted `TS_NODE_*` all absent;
- `runtime.conversionSHA256` equal to the conversion actually supplied;
- `adapterSHA256 = aa6237bd…`.

`toolSHA256` is computed in `frames.mjs` from the bound `source-tool.mjs`. It must equal the runtime's claim and the entry-script hash, and it must be in `APPROVED_ACQUISITION_TOOLS`, which is **still empty**.

**Probes** (`repro-acq-structure.mjs`):
- `OPENSSL_CONF` present → `acquisition_launch_override_present`;
- `testTransport` key present → `acquisition_runtime_missing_or_shape`;
- `source-tool.mjs` edited and resealed → `acquisition_not_launched_canonically`;
- a well-formed acquisition under the real `frames.mjs` → `acquisition_not_launched_canonically` (scratch cwd), and, with the canonical cwd, `acquisition_tool_not_reviewed`. Test 15 shows the second.

## 2. 4b: PASS

`readAcquisition` runs before any mode-specific check, so it applies in production and test mode alike. It requires:
- no `FAILED.json` and no `.MANIFEST.json.tmp`;
- `MANIFEST.json` present with status `acquisition_complete_pending_review`;
- every file listed and hash-equal, and nothing unlisted;
- the file set **exactly** equal to {runtime, `source-tool.mjs`, and per scheduled game one `operation-k-STARTED`, body and receipt}.

Every probe was taken from a real completed acquisition directory produced by the tool (my F1 run), damaged one way, and resealed where noted:

| Probe | Result |
| --- | --- |
| prefix: last game's 3 files dropped, resealed | `acquisition_incomplete_or_extra` |
| extra file, resealed | `acquisition_incomplete_or_extra` |
| extra file, unlisted | `acquisition_unlisted_file` |
| retry: a 7th `operation-*-STARTED.json`, resealed | `acquisition_incomplete_or_extra` |
| `FAILED.json` present | `acquisition_failed_or_partial` |
| `.MANIFEST.json.tmp` present | `acquisition_unpublished_manifest` |
| `MANIFEST.json` missing | `acquisition_manifest_missing` |
| body byte flipped, not resealed | `acquisition_hash_drift` |

Within one run a retry cannot happen: the loop makes one call per id, and any failure throws, writes `FAILED.json` and skips the manifest. A rerun must use a new `--out`, because `mkdirSync` refuses an existing path.

## 3. 4c: PASS

- `checkRuntimeCore(runtime, APPROVED.nodeSHA256)`: the CLI no longer accepts `--node-sha256`. Probe: node hash `9…9` gives `runtime_node_binary_not_pinned`.
- Receipts carry `finalUrl`, and `verifyAcquisition` requires `httpStatus === 200 && redirected === false && finalUrl === url`. Probes past the launch check, using my scratch-approved copy: `redirected: true` and a different `finalUrl` both give `boxscore_transport_unqualified`.
- The tool also enforces `redirect: "error"`, `response.url === url` and `response.redirected === false` before reading the body (`acquire-boxscores.mjs:77-78`). In test 18, the loopback redirect fault stops at request 2 with no manifest.

## 4. Mutant 3: PASS

Test 16 runs convert in **synthetic** mode, which accepts any verifier and can only yield the diagnostic class. It uses a test stub verifier that always passes, so the bridge's own call sites are exercised. The approved verifier is untouched: `04a632ba…` re-hashed after the run.

**Mutants** (mirror only, `--test-name-pattern="call sites"`):
- remove `checkObservationClaims(obs);` → **killed**;
- remove the mirror check → **killed**.

The stub cannot reach the candidate class: test 16 shows `pins_not_approved`. RECHECK §1's Low is also closed: `assemble.mjs` now refuses a hand-labelled candidate (`conversion_not_approved`, test 17) and binds the frames directory's manifest.

## 5. The tool itself: FAIL

### F1 (High, reproduced): `toolSHA256` does not pin what runs

**The closure the tool hash leaves out:**
- `lib.mjs`, imported by the tool;
- the adapter's transitive modules: `lib/nst/client.ts`, `jobLifecycle.server.ts`, `admissionOrigin.ts` and what they import. The tool hashes only the adapter file and then `require`s it, which loads them;
- `node_modules`: ts-node, and the npm `undici` that the harness uses.

Any of them can install a **global** undici dispatcher at import time. Its custom `ca` makes `authorized: true` against a private root, while `tls.getCACertificates("default")` stays equal to the bundled roots, so the CA re-read sees nothing. `testTransport` is recorded only when a dispatcher is passed through the tool's own function argument.

**Reproducer** (all scratch; loopback only):
1. **Setup:**
   - a scratch copy of the bridge with `inject-into-lib.mjs.txt` appended to `lib.mjs`. The appended code refuses every non-loopback socket, then `setGlobalDispatcher` with an npm `undici` Agent that trusts a throwaway self-signed `api-web.nhle.com` cert and connects to a loopback server;
   - `acquire-boxscores.mjs` itself unchanged: **sha256 `e075b90a…`**.
2. **The tool run:** the exact launcher from the spec, from a v4 web tree with the real `aa6237bd…` adapter, giving `{"ok":true,"requests":6}`. In the resulting `ACQUISITION-RUNTIME.json`:
   - `toolSHA256` is `e075b90a…`;
   - there is **no** `testTransport` key;
   - the default CA store equals the bundled roots;
   - the entry script is the tool.

   Every receipt has `tls.authorized: true`, `servername: api-web.nhle.com` and issuer chain `["api-web.nhle.com"]`, the self-signed cert.
3. **The frames run:** the scratch `frames.mjs` with only two constants changed: `WEB_ROOT` set to the stand-in tree in place of the canonical checkout, and `APPROVED_ACQUISITION_TOOLS = ["e075b90a…"]`, as if approved. Result: `{"ok":true,"frames":12}`, `mode: "production"`, `receiptClass: "acquisition_v2_tls_verified"`.

**Fix before review** (any one of these closes the gap; the first is simplest):
- **(a) Make the tool self-contained.** Copy `socketTls`, `withTlsObservation` and the needed `lib.mjs` helpers byte-identically into one `.mjs`, as the spec already allows ("or a byte-identical copy"). Import only `node:` builtins, so `execArgv` can be `[]` with no ts-node. Then `frames.mjs` requires `execArgv === []` for acquisitions.
- **(b)** Otherwise, pin the whole closure at run time, and bind and verify each file the way the bootstrap does for the capture (`SOURCE_PINS` plus `DEPENDENCIES`): `lib.mjs`, the adapter's transitive NST modules, and the ts-node entry files.
- **Defence in depth either way:** before each request, refuse if a global dispatcher other than Node's default is installed, and record that it was.

### F2 (Medium, reproduced): game ids are not tied to an approved conversion

The tool accepts any conversion directory whose `MANIFEST.json` lists `CONVERSION.json`. It does not check `evidenceClass`, `approvedInputs` or the `APPROVED` hashes, and it does not re-derive the ids from the bound `schedule.raw.json`.

My F1 run used `conv-happy` from a v4 **synthetic** rehearsal (`diagnostic_only_synthetic_adapter`) and the tool made 6 requests. The blast radius is small: at most 16 GETs, only to `api-web.nhle.com/v1/gamecenter/<202602xxxx>/boxscore`, and assemble later refuses a diagnostic conversion. But a hand-written `CONVERSION.json` can steer real requests.

**Fix:** apply the same `conversion_not_approved` test that `assemble.mjs` now applies, and re-derive the ids from `schedule.raw.json` in the conversion directory: hash-checked, date filter, all OFF or FINAL.

### F3 (Low)

- **`--out` is free-form.** The spec says "a new fixed private directory", but the CLI accepts any path. TJ's approval should name the exact path, and the tool could pin it.
- **`bindTls` copies `peerCertificate` without shape-checking it.** `frames.mjs` `verifyTlsChain` does check it, so this is not a hole, only less fail-fast than the runner's `tlsFacts`.

### UNVERIFIED (wire level)

**"Never more than one GET per game."** At the request level this holds:
- one `fetch` per id;
- 0 retries in the tool;
- `redirect: "error"`.

At the wire level I did not prove that Node's bundled undici never re-sends an idempotent GET on a keep-alive socket closed by the server. If it did, `withTlsObservation` would see two `sendHeaders` events and fail closed (`capture_tls_observation_missing`): the run is lost and one extra GET was sent. Test 18 shows exactly one request per game over real pooled keep-alive. This is the same exposure the capture runner has.

### Checked and sound

| Question | Finding |
| --- | --- |
| Non-boxscore requests | None: URLs are built only as `https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`, with ids matching `/^202602\d{4}$/`. |
| Redirects | Not followed (above). |
| Writes outside `--out` | None. File names come from integers and fixed strings. `mkdirSync` is non-recursive and refuses an existing path, all files open `wx` at 0600, the manifest is temp + hard link, and the directory is fsynced. Test 18 asserts 0700/0600. |
| TLS observation | The pinned v4 adapter's own `withTlsObservation`, refused unless the file hashes to `aa6237bd…`. `bindTls` applies the runner's rules: resumed → earliest full handshake for the host; keep-alive → opener; no repeated sequence. Test 18 shows real pooled keep-alive with `connectionFromOperation` equal to the opener, and `verifyTlsChain` accepts the chain. Resumption is not exercised over loopback, but the rule is identical to the runner's, and `frames.mjs` re-checks it. |
| CA swap / untrusted cert | Fail closed with `FAILED.json` and no manifest. Test 18 covers: swap during a request (`ca_store_changed`, 1 sent), swap before (`runtime_default_ca_store_not_bundled`, 0 sent, no directory), untrusted cert (0 sent). Oversize body (`boxscore_body_limit`) and HTTP 500 also fail closed. |
| Test transport → production frames? | Through the function argument, no: `testTransport` makes the runtime key set fail. Through a global dispatcher installed by an import, **yes**: that is F1. |
| Order | Environment refusals (overrides, launch keys, non-bundled CA, adapter pin) run before anything is written or sent. The runtime and `source-tool.mjs` are written before the first request, and each request is journalled before dispatch. |

## 6. Call budget: PASS

`BUDGET = { maxGames: 16, perRequestTimeoutMs: 15000, totalMs: 120000, maxBodyBytes: 4 MiB, spacingMs: 1000, retries: 0 }` (`:26`).
- **Games:** 6 GETs for 2026-11-11, one per scheduled game (`CANDIDATE.json` slate 293–298; the packet's own schedule decides). A hard cap of 16 is the most games the NHL schedules in a day.
- **Timeouts:** `AbortSignal.timeout(15 s)` covers the request and body stream. `Date.now() + 15 s <= deadline` is checked before each request, so the total stays ≤ 120 s plus fsync time. The per-request timeout is verified by reading only; there is no timeout test.
- **Size and spacing:** 4 MiB is a streamed cap (oversize test). 1 s spacing goes between requests, so 6 requests take about 5 s plus transfer. No NST limits apply.
- **What is not touched:** no Supabase, ledger or credentials. The tool reads no secret env keys.

---

## Updated preconditions

1. **Capture custody:** unchanged from RECHECK 1, items 1–3: the v4 bootstrap in the slot, fixed output, operator note, approved pins, verifier, node and lineage, `node_modules` integrity, and no override or lifecycle keys.
2. **Run the bridge suite in the canonical checkout** with v4 applied. Expect 20/20.
3. **Acquisition tool: not approvable at `e075b90a…`.** Before any production frame:
   1. fix F1, ideally a self-contained `.mjs` with `execArgv: []` and frames requiring it;
   2. fix F2, the approved-conversion check plus ids re-derived from `schedule.raw.json`;
   3. optionally fix F3;
   4. have the new hash independently reviewed;
   5. add it to `APPROVED_ACQUISITION_TOOLS` by a reviewed change;
   6. get TJ's separate approval of the 6 GETs, the game ids, the exact `--out` path and the time window.
4. **Run the tool exactly as specified:**
   - from the canonical `web/` with v4 applied (adapter `aa6237bd…`, unless F1(a) removes that dependency);
   - from the bridge folder at its reviewed hashes;
   - with the spec's `env -i` launcher;
   - right after conversion.

   Hand the untouched output directory to `frames.mjs`.
5. **Timing, holds, review and install:** unchanged from RECHECK 1, items 6–8. Gate evaluation is no later than about 2026-11-18T14:05Z with all captures within the same 24 h. Rows on dotted-code teams, the on-ice page format and windows stay held. An independent review fills `reviewSHA256`, and a separate policy owner installs it. `TEST_ONLY…` output is never reviewed.

**Side effects:**
- the bridge folder's sums are 18/18 and its listing is unchanged;
- `git status web` shows only the pre-existing `next-env.d.ts`;
- the loopback server ran in scratch and exited on its own timer;
- the reproducers write only under the session scratchpad.
