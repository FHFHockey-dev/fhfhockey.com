# BLSH native capture: successor candidate, handoff for Scout

## Corrections to what v4 stated (read first)

- **The transport is npm undici 7.29.0, not Node's bundled undici 6.29.1.**
  - When the runner module loads, its pinned `cheerio` import loads npm `undici` 7.29.0. That registers its own default `Agent` under `Symbol.for('undici.globalDispatcher.1')`, and Node's bundled `fetch` honors that registry.
  - Evidence: `tls-loopback/who-sets-output.txt`, `dispatcher-launch-check-output.txt`, and `TRANSPORT-RESULT.txt`. In the last, an untrusted cert fails with the import-time `Agent` but succeeds once a CA-carrying `Agent` is in the registry.
  - `process.versions.undici` (6.29.1) is **not** the transport's version.
- **The registry is not "unset until the first fetch" in this launch.** That is true for bare Node, and false once the runner has loaded. The v4 design note said otherwise; v5 implements the corrected rule.
- **The TLS observation holds on the real transport.** With the runner loaded, npm undici publishes the same `undici:client:sendHeaders` event, once per request. The adapter records full authorized facts on GET and POST (`TRANSPORT-RESULT.txt`).
  - The older `LOOPBACK`/`REUSE`/`RESUME` results were taken **without** the runner loaded, so on bundled undici. Keep-alive reuse and session resumption were **not** observed on the npm-undici path in loopback; every request there opened a new connection.
  - The raw-socket resumption result (`peerCertificate: {}`) is undici-independent.
- **`node_modules/undici` is unpinned.** The code that builds every live connection is not in the bootstrap's `DEPENDENCIES`; only cheerio's entry file is. I recommend the operator lane's dependency-tree check covers it. I added no pins.

---

**What this is.** One patch, `SUCCESSOR.patch` (**v5**), which supersedes every earlier patch (now in `superseded/`, including v4 `66b4eb30…` and v3 `40dd64bc…`). It contains:
- the date, slot and output move;
- per-operation TLS observation, with resumed-session and keep-alive binding;
- a packet-bound `RUNTIME.json` receipt, now with **launch proof** (`launch.*`);
- a **per-dispatch default-CA-store check** (`tls.defaultCACertificatesSHA256`);
- the bootstrap **refusing a present `NST_JOB_LIFECYCLE_ENABLED`**;
- **v5:** a **global undici dispatcher identity check**, anchored at runner load.

**What changed in v5 (dispatcher identity; no `web/lib/nst/**` edits):**
- **Runner:**
  - It captures `globalThis[Symbol.for('undici.globalDispatcher.1')]` as its module finishes loading (`DISPATCHER_AT_RUNNER_LOAD`). That is the npm undici default `Agent` its imports registered.
  - At run start it refuses before any output unless that same object, named `Agent`, is still in place (`global_dispatcher_not_runner_load_default`). This also refuses an unset registry.
  - **Before** every dispatch it refuses to send if the object changed (`global_dispatcher_changed_before_dispatch`).
  - **After** every settlement it records `tls.globalDispatcher` and fails closed with `global_dispatcher_changed` if the object differs.
- **Bootstrap:** it refuses before its three dynamic imports if any dispatcher is already registered (`bootstrap_global_dispatcher_preinstalled`).
- **Why both checks:** a custom `Agent` and the default `Agent` cannot be told apart by name. The bootstrap check (registry empty before the imports) plus the runner anchor (the object registered during the pinned imports) gives "no dispatcher other than the import-time default".
- **Residual risk:** the import-time `Agent` is created by unpinned `node_modules/undici`.

**What changed in v4** (from the review's "Bridge ↔ SUCCESSOR.patch interface" section):
1. **Lifecycle key.** The bootstrap's pre-dispatch check (`checkExecution`, run twice before the adapter is used) now requires `NST_JOB_LIFECYCLE_ENABLED` to be **absent**. `"false"` and `""` are refused with `bootstrap_configured_environment_mismatch`. The verifier vetoes `runtime_lifecycle_key_present`. The adapter is unchanged.
2. **Launch proof** in `RUNTIME.json.launch` (section 3).
3. **Post-snapshot TLS state.** Node 22.23.4 exposes `tls.getCACertificates('default')`, and also `tls.setDefaultCACertificates`, which can change the store mid-process. The runner re-reads the store's hash **before** every dispatch (`ca_store_changed_before_dispatch`, nothing sent) and **after** every settlement. It records the hash as `tls.defaultCACertificatesSHA256` and fails closed with `ca_store_changed` if it differs from RUNTIME's. If the API is unavailable, the run refuses before any output (`runtime_ca_store_unavailable`).
4. **Dispatcher identity:** reported as feasible in v4, implemented in v5 (above). The v4 note "unset until the first fetch" is corrected at the top.

Everything was built and tested offline, in throwaway `git archive` exports of base `a955107671ee7c1b2521891393a6bad6d95e9f89`:
- The canonical `web/scripts/blsh/**` was not edited.
- No production, provider, NST, DB, ledger or credential access was made, and `.env` was never loaded.
- Nothing was pushed, deployed or committed.
- **The patch carries no approval and reserves no slot.**

## Apply

```bash
git apply --check -p1 tasks/artifacts/blsh-successor-candidate-2026-11-15/SUCCESSOR.patch
```

- The patch has sha256 `e8be50de132887be4e4c33b086003a1f639ba554f23c85f08d27d5a780d7752f` and touches six files in `web/scripts/blsh/`: runner, adapter and bootstrap, plus their tests.
- At handoff the live HEAD was `eb0a07e94`, and no pinned path had changed since the base. `git apply --check` passed in the live checkout (check only).
- A fresh export with the patch applied reproduces these hashes:

| | sha256 |
| --- | --- |
| runner | `a74cbb0a59d4b3525572a2f71811b4777b36c63bdb26c42b4dea7ea911af81b0` |
| adapter | `aa6237bdb8d977cbd21f3ed769d9f5c7f9028e23a921965f41e278e021947be0` (unchanged since v3) |
| bootstrap | `dbf69c474bedefd9c34fbd783d4beccc1840e8288fd2fa3435b5d89e8521bb46` |

The other seven roles are unchanged; see `CANDIDATE.json`.

The successor readback inputs have new hashes in v5: `rehearsal/verify-packet.mjs` is `b86af692e5c4b3b9b1650f949171cbbaeed6663c6d1668efdc443e91fa0ad5c5`, and `rehearsal/expected-pins.json` is `a2a1e694dfa79ba9ebc110a3e45a249540b739c0061e0558fc6887e0f30367d1` (nine roles plus `_bootstrapSHA256`).

**The bootstrap hash changed** (v4 `a224d62e…` → v5 `dbf69c47…`), so the operator lane's dependency-tree check, which also pins the bootstrap, must be rebaselined.

**After applying, rerun the four suites in the canonical tree.** That run is authoritative, because the bootstrap binds the canonical `web/` path and cannot pass in an export.

## 1. Date move

| | Frozen predecessor | Successor |
| --- | --- | --- |
| DATE (runner `:14`, adapter schedule URL, bootstrap plan) | 2026-11-07 | **2026-11-11** (games 2026020293–298) |
| SLOT | 2026-11-13T14:05Z | **2026-11-17T14:05:00.000Z** (09:05 EST), with a 60 s start window and a 120 s work budget. Not reserved. |
| OUTPUT | `…20261113T140500Z` | `…fhfh-blsh-native-20261117T140500Z`. Still one fixed path, and the `attempted` flag is kept. |
| Source-date expiry (preparation `:48`, unchanged) | 2026-11-15T00:00Z | **2026-11-19T00:00:00.000Z** (18 Nov, 19:00 EST) |

- **Fixtures** shifted by a uniform +4 days. **One extra line:** `nativeProcessCaptureBootstrap.test.ts:96` pins the runner hash. No fixture needed more than a shift or a pin update.
- **Slate evidence:** sha256 values are in `CANDIDATE.json.slateEvidence`. All of those files are untracked local artifacts.
- These are unchanged: the 5 ordered operations, disabled mode, retries 0, 22 s spacing, caps, fsync and the manifest logic.

## 2. TLS observation (field names for the bridge)

**Mechanism.** Node 22.23.4 bundles undici 6.29.1, which publishes `undici:client:sendHeaders` with `{ request, headers, socket }` once per request.
- The adapter subscribes only while each schedule, admission or NST action runs. It matches on origin, pathname and method, and keeps socket facts only, never paths, query strings or headers.
- No `web/lib/nst/**` file changed, and there are still nine roles.

**Where it is written:**
- `operation-N-SETTLED.json` → `tls`, for operations 1–5. **The admission operations have their TLS facts here only**, because they have no TRANSPORT-OBSERVATION file.
- `{schedule,individual,onIce}.TRANSPORT-OBSERVATION.json` → `tls`, identical to that operation's SETTLED `tls`.
- `TLSVerified` stays `null`. The bridge decides.

**Exact fields** (the runner whitelist; anything else is dropped):

```json
"tls": {
  "channel": "undici:client:sendHeaders",
  "authorized": true,
  "authorizationError": null,
  "servername": "<request host>",
  "alpnProtocol": "http/1.1",
  "protocol": "TLSv1.3",
  "cipher": { "name": "…", "standardName": "…", "version": "…" },
  "sessionReused": false,
  "connectionReused": false,
  "connectionSequence": 2,
  "resumedFromOperation": null,
  "connectionFromOperation": null,
  "peerCertificate": {
    "fingerprint256": "AA:…(32 bytes, upper-case hex)",
    "valid_from": "…",
    "valid_to": "…",
    "subjectCN": "…",
    "issuerCNChain": ["<leaf issuer CN>", "…"]
  },
  "defaultCACertificatesSHA256": "<64 hex; must equal RUNTIME.json.tls.defaultCACertificatesSHA256>",
  "globalDispatcher": { "present": true, "constructorName": "Agent", "identityUnchanged": true }
}
```

| Field | Meaning |
| --- | --- |
| `tls.sessionReused` | The socket's `isSessionReused()` result. |
| `tls.connectionReused` | `true` when this socket was already seen by an earlier observation in this process (keep-alive). |
| `tls.connectionSequence` | An opaque per-process connection number assigned by the adapter. It is not an address or a port. |
| `tls.resumedFromOperation` | The operation number N (as in `operation-N-*.json`) of the full handshake this resumption descends from; otherwise `null`. Set by the runner. |
| `tls.connectionFromOperation` | The operation number N that opened the reused connection; otherwise `null`. Set by the runner. |
| `tls.peerCertificate` | `null` only on a resumed session. Node 22.23.4 returns `{}` from `getPeerCertificate(true)` when a session is resumed. |
| `tls.globalDispatcher` | **v5.** `{ present, constructorName, identityUnchanged }`, read after settlement. `identityUnchanged` is `true` only if the registry still holds the object captured at runner load; otherwise the run stops with `global_dispatcher_changed`. Set by the runner. |
| `tls.defaultCACertificatesSHA256` | **v4.** The runner re-reads the default CA store after settlement. Its sha256 is taken over `tls.getCACertificates('default')` joined by `\n`. It must equal RUNTIME's value, otherwise the run stops with `ca_store_changed`. A pre-dispatch re-read refuses to send at all (`ca_store_changed_before_dispatch`). Set by the runner. |

**Binding rules.** The runner applies these, and they fail closed. The verifier re-derives them independently from the SETTLED files.
- **Resumed session** (`sessionReused: true`): needs `authorized: true` **and** an earlier operation in the same run with a full-handshake observation for the same `servername`. A full handshake means `sessionReused: false`, `connectionReused: false` and a peer certificate present. The runner records the earliest such operation as `resumedFromOperation`.
  - **Why this is safe:** the one-shot process starts with an empty TLS session cache, so any resumption must descend from a handshake that was verified in this process during this run.
  - In this run's order, a resumed operation 4 (Supabase) binds to 2, and a resumed operation 5 (NST) binds to 3. A resumed operation 1, 2 or 3 fails closed.
- **No resumption:** a peer certificate is required.
- **Keep-alive reuse** (`connectionReused: true`): needs an earlier operation with the same `connectionSequence` and the same `servername`. That operation is recorded as `connectionFromOperation`.
- **A new connection that repeats an earlier `connectionSequence`** fails closed.
- **Host binding:** `servername` must equal the request host.

**Two failure signatures, which the bridge and verifier must handle:**
- **The adapter finds no matching observation:** `capture_tls_observation_missing` is thrown inside the action, after the request went out. The operation is left STARTED with no SETTLED, and is uncertain in FAILED.json.
- **The adapter returns an observation the runner rejects** (missing, malformed, wrong host or unbound): SETTLED is written with `tls: null`, and the run stops with `tls_observation_missing`.

Lifecycle operations are not observed; they exist only in enabled mode.

## 3. `RUNTIME.json` (field names for the bridge)

The runner writes it before the first dispatch, after STARTED.json and PLAN.json. It is fsynced and listed in MANIFEST. It contains non-secret facts only, and every environment entry is **key presence** from `process.env`; values are never read into the packet.

```json
{
  "version": "fhfh.blsh.native-capture-runtime.v1",
  "startedAtUTC": "<== STARTED.json.startedAtUTC>",
  "node": { "version": "v22.23.4", "execPath": "/usr/local/bin/node", "execPathSHA256": "<64 hex>", "execArgv": ["--require", "./node_modules/ts-node/register/transpile-only"] },
  "tls": { "rootCertificatesSHA256": "<sha256 of tls.rootCertificates joined by \\n>", "rootCertificateCount": 116,
           "defaultCACertificatesSHA256": "<sha256 of tls.getCACertificates('default') joined by \\n>", "defaultCACertificateCount": 116 },
  "environmentPresence": { "NODE_EXTRA_CA_CERTS": false, "NODE_TLS_REJECT_UNAUTHORIZED": false, "NODE_OPTIONS": false, "NODE_USE_SYSTEM_CA": false,
    "NODE_USE_ENV_PROXY": false, "SSL_CERT_FILE": false, "SSL_CERT_DIR": false, "HTTPS_PROXY": false, "HTTP_PROXY": false, "ALL_PROXY": false,
    "NO_PROXY": false, "https_proxy": false, "http_proxy": false, "all_proxy": false, "no_proxy": false },
  "supabaseOrigin": "https://fyhftlxokyjtpndbkfse.supabase.co",
  "lifecycleMode": "disabled",
  "adapterEnvironmentPresence": { "NST_KEY": true, "SUPABASE_SERVICE_ROLE_KEY": true, "NEXT_PUBLIC_SUPABASE_URL": true, "NST_JOB_LIFECYCLE_ENABLED": false },
  "launch": {
    "entryScript": "/Users/tim/Code/fhfhockey.com/web/scripts/blsh/nativeProcessCaptureBootstrap.ts",
    "entryScriptSHA256": "<sha256 of entryScript>",
    "cwd": "/Users/tim/Code/fhfhockey.com/web",
    "bootstrapPath": "<runner dir>/nativeProcessCaptureBootstrap.ts",
    "bootstrapSHA256": "<sha256 of bootstrapPath>",
    "entryIsBootstrap": true,
    "environmentPresence": { "NODE_PATH": true, "DISABLE_V8_COMPILE_CACHE": true, "TS_NODE_COMPILER_OPTIONS": true, "OPENSSL_CONF": false,
      "TS_NODE_PROJECT": false, "TS_NODE_SKIP_PROJECT": false, "TS_NODE_COMPILER": false, "TS_NODE_TRANSPILE_ONLY": false, "TS_NODE_REQUIRE": false,
      "TS_NODE_CWD": false, "TS_NODE_DIR": false, "TS_NODE_COMPILER_HOST": false, "TS_NODE_EMIT": false, "TS_NODE_SCOPE": false,
      "TS_NODE_SCOPE_DIR": false, "TS_NODE_SWC": false, "TS_NODE_TRANSPILER": false },
    "otherTsNodeKeysPresent": []
  },
  "globalDispatcher": { "present": true, "constructorName": "Agent", "sameAsRunnerLoad": true },
  "valuesRecorded": false
}
```

**`launch` (v4).** These are non-secret launch facts:
- `entryScript` is `resolve(process.argv[1])`, the script Node was started with, and `entryScriptSHA256` is its hash.
- `cwd` is `process.cwd()`.
- `bootstrapPath` and `bootstrapSHA256` describe the bootstrap file that sits next to the runner.
- `entryIsBootstrap` is true only when the entry script **is** that file with the same hash.
- `environmentPresence` holds presence booleans for every `TS_NODE_*` key the bootstrap knows, plus `NODE_PATH`, `DISABLE_V8_COMPILE_CACHE` and `OPENSSL_CONF`.
- `otherTsNodeKeysPresent` lists the **names** of any other `TS_NODE_*` keys that are set. No values are ever recorded.

- **Cross-check:** in the rehearsal, `execPathSHA256` was `daa77e22…`, which equals the bootstrap's pinned `NODE_SHA256`.
- `defaultCACertificatesSHA256` reflects the effective default store, so it changes if extra CAs are added. `rootCertificatesSHA256` is Node's bundled list.
- The runner hashes the node binary once per process (memoized), inside the run's time budget.

**Verifier rules** (`rehearsal/verify-packet.mjs`):
- **Receipt shape:** it requires RUNTIME.json, the `startedAtUTC` binding, and `valuesRecorded: false`.
  - The **exact key set** must hold at the top level and in `node`, `tls` and `launch`. An extra key gives `runtime_receipt_key_set_mismatch`.
  - Every presence value must be a boolean.
- **Environment:**
  - `runtime_override_present:<KEY>` for any override that is present.
  - `runtime_lifecycle_key_present` unless `NST_JOB_LIFECYCLE_ENABLED` is absent.
  - `runtime_default_ca_store_not_bundled` unless `defaultCACertificatesSHA256 == rootCertificatesSHA256`, matching the bridge.
- **Launch:**
  - `runtime_launch_override_present:<KEY>` for `OPENSSL_CONF` or any `TS_NODE_*` other than `TS_NODE_COMPILER_OPTIONS`.
  - `runtime_launch_unlisted_ts_node_keys` if `otherTsNodeKeysPresent` is non-empty.
  - `runtime_bootstrap_not_candidate` unless `launch.bootstrapSHA256` equals `expected-pins.json._bootstrapSHA256`.
- **CA store:** `operation_N_ca_store_changed` when a SETTLED `tls.defaultCACertificatesSHA256` differs from RUNTIME's.
- **Dispatcher (v5):**
  - `runtime_global_dispatcher_invalid` unless `RUNTIME.globalDispatcher` is exactly `{ present: true, constructorName: "Agent", sameAsRunnerLoad: true }`.
  - `operation_N_global_dispatcher_changed` unless every SETTLED `tls.globalDispatcher` is `{ present: true, identityUnchanged: true }` with RUNTIME's `constructorName`.
  - The exact key sets cover both blocks.
- **Non-synthetic packets only:**
  - `runtime_adapter_environment_absent` unless NST_KEY, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are present.
  - `runtime_not_launched_by_bootstrap` unless `entryIsBootstrap`, the entry path equals `bootstrapPath`, the hashes match, `cwd` equals the web root, and `NODE_PATH`, `DISABLE_V8_COMPILE_CACHE` and `TS_NODE_COMPILER_OPTIONS` are present.
  - A synthetic rehearsal is launched by the harness, so it skips only the launch-by-bootstrap check.

## Checks

Suites (`vitest run` for the Runner, Adapter, Bootstrap and Preparation tests, under `env -i`, with `TMPDIR` set to scratch and no `GIT_DIR`):

| Tree | Prep | Bootstrap | Adapter | Runner | Total |
| --- | --- | --- | --- | --- | --- |
| Unpatched export (baseline) | 27/27 | 16/32 | 29/29 | 87/87 | 159/175 |
| **Successor v5, fresh export** (`git archive` + patch) | 27/27 | 16/35 | 46/46 | 120/120 | 209/228 |
| Successor v5, WEB relocated (non-candidate bytes) | 27/27 | **35/35** | 46/46 | 120/120 | **228/228** |

- In the export rows, every bootstrap failure is `bootstrap_wrong_checkout` (16 in the baseline, 19 in v5). The relocated copy changes only the `WEB` literal in the bootstrap and its test.
- **New in v4:**
  - **Bootstrap:** `NST_JOB_LIFECYCLE_ENABLED=false` and `=""` are refused before the adapter is used.
  - **Runner, launch facts:** recorded exactly, with entry, cwd and bootstrap hashes; `OPENSSL_CONF` and an unlisted `TS_NODE_*` key are recorded as presence or names only, never values.
  - **Runner, CA store:** an unreadable store refuses before any output. A store swapped between operations is refused before the next dispatch, with no STARTED. A store swapped during operation 2 or **5** fails closed, and SETTLED records the swapped hash.
- **New in v5 (dispatcher identity):**
  - **The anchor in tests:** the vitest worker already holds a real undici `Agent`, so the runner suites anchor on it. Tests that replace the dispatcher restore it by assignment; the entry is writable but non-configurable.
  - **Runner:**
    - the happy path records `{ present: true, constructorName: "Agent", identityUnchanged: true }` on every operation;
    - a different `Agent` installed after the runner loaded → refused before output;
    - an unset registry → refused before output;
    - replaced between operations 3 and 4 → operation 4 is never sent;
    - replaced during operation 5 → SETTLED 5 records `identityUnchanged: false`, and the run fails closed.
  - **Bootstrap:** a dispatcher registered before its imports → `bootstrap_global_dispatcher_preinstalled`, with no adapter or runner call. Only the bootstrap suite assigns `undefined` to model a fresh launch.
- **v5 mutation checks:**
  - Dropping the pre-dispatch guard fails 1 test.
  - Dropping the post-settle check fails 1.
  - Dropping the start check fails 2.
  - Dropping the bootstrap check fails 1.
- **v4 mutation checks:**
  - Dropping the pre-dispatch guard fails 1 test.
  - Dropping the post-settle check fails 1 test (the operation-5 case, added for exactly this).
  - Allowing an unreadable store fails 1 test.
- A scoped `tsc` reports 0 errors.
- **New tests in the runner:**
  - resumed with an earlier full handshake → passes;
  - keep-alive reuse → binds;
  - **fails closed** for: resumed with no prior full handshake; resumed with `authorized: false`; resumed where earlier full handshakes are for other servernames; resumed under a servername that is not the request host; a missing peer certificate without resumption; keep-alive reuse of another host's connection; keep-alive reuse of an unknown connection; a new connection repeating a sequence number;
  - RUNTIME.json is written before the first dispatch, with presence booleans only and no values.
- **New tests in the adapter:** resumed and keep-alive onIce operations bind to 2 and 3; resumed schedule, resumed NST individual and unauthorized resumed `admission:onIce` all fail closed. The adapter suite also has the earlier 12 TLS fail-closed cases.
- **Mutation checks:**
  - Dropping the authorized check fails 2 tests.
  - Dropping the connection binding fails 1.
  - Letting any earlier record count as a full handshake fails 4.
  - Dropping the explicit full-handshake `need` changes nothing observable, because `full!.index` throws inside the same try and still fails closed (an equivalent mutant).

**Loopback (`tls-loopback/`)**, run on the final adapter with bundled fetch and real sockets:
- **Real resumed sessions** (TLS 1.3 and 1.2): `sessionReused: true` and `peerCertificate: null` (`RESUME-RESULT.txt`).
- **Real keep-alive reuse:** `connectionReused: true`, with the opener's `connectionSequence` (`REUSE-RESULT.txt`). The B2 and B3 labels name the intended resumption; the side log shows none occurred.
- **Untrusted cert, path mismatch, or two requests in one operation:** fail closed (`LOOPBACK-RESULT.txt`, from the earlier adapter; that check path is unchanged).

**Rehearsal (`rehearsal/RESULTS.jsonl`).** It ran the real runner and preparation code with a synthetic adapter, a fresh export plus the patch, the clock shifted to 2026-11-13T01:00Z, sockets, TLS, DNS and fetch blocked, and `env -i`.

| Case | Result |
| --- | --- |
| happy (6 synthetic games 2026020293–298) | `complete_pending_review`: 5 ops, 29 files including RUNTIME.json |
| **lifecycle_key_false** (v4: `NST_JOB_LIFECYCLE_ENABLED=false` in the env) | the runner completes (it records presence only); **verifier vetoes** `runtime_lifecycle_key_present`. The bootstrap would refuse first (unit-tested). |
| **ca_store_swap_during** (v4: real `tls.setDefaultCACertificates` inside op 2) | stopped at op 2; SETTLED 2 records the swapped hash; vetoed `operation_2_ca_store_changed` |
| **ca_store_swap_between** (v4: swap after op 1, before op 2) | refused before op 2 was sent (no `operation-2-STARTED.json`); vetoed |
| **dispatcher_swap_before_start** (v5: real npm undici `Agent` with a private CA put in the registry after the runner loaded) | refused `global_dispatcher_not_runner_load_default`: 0 ops, no output dir |
| **dispatcher_swap_between** (v5: the same swap between ops 3 and 4) | op 4 never sent; vetoed |
| **dispatcher_swap_during** (v5: the same swap inside op 5) | SETTLED 5 records `identityUnchanged: false`; vetoed `operation_5_global_dispatcher_changed` |
| **tls_resumed_ok** (ops 4/5 resumed, `peerCertificate: null`) | `complete_pending_review`; `resumedFromOperation` 2 and 3 |
| **tls_keepalive_ok** (ops 4/5 reuse connections 2/3) | `complete_pending_review`; `connectionFromOperation` 2 and 3 |
| **tls_resumed_no_prior** (op 3 resumed; earlier full handshakes are other hosts) | vetoed (`operation_3_tls_observation_missing`); stopped at op 3 |
| **tls_resumed_unauthorized** (op 4 resumed, `authorized: false`) | vetoed (`operation_4_tls_observation_missing`); stopped at op 4 |
| tls_missing_admission / tls_missing_nst | vetoed at op 2 / op 3 |
| schedule not final / duplicate key / empty day / wrong season | vetoed after op 1 (no admission) |
| NST no rows / row cap | vetoed after op 3 |
| denied permit | vetoed (`operation_2_permit_denied`), no NST GET |
| partial write (ENOSPC) | vetoed (no MANIFEST) |
| interrupted (SIGKILL in nst:individual) | vetoed (`operation_3_started_without_settlement_possibly_dispatched`) |
| repeat into the happy and the interrupted packet | `EEXIST` before dispatch; tree unchanged |
| expired, **real clock** (~2026-11-15) | **accepted**, because 11-11 is fresh until 11-19 |
| clock exactly 2026-11-19T00:00:00.000Z | refused `future_incomplete_or_stale_date`, no output dir |
| clock 2026-11-18T23:59:59.000Z | accepted, `complete_pending_review` |
| tamper: drop provenance / flip byte / extra file / real adapter pin / strip `tls` | vetoed each |
| **tamper: strip RUNTIME.json** | vetoed (`runtime_receipt_missing`, `manifest_file_missing:RUNTIME.json`) |
| **v4 tampers:** `launch.bootstrapSHA256` zeroed / `launch.environmentPresence.OPENSSL_CONF` → true / `NST_JOB_LIFECYCLE_ENABLED` presence → true / extra key `syntheticTestOnly` / SETTLED 3 `tls.defaultCACertificatesSHA256` zeroed | vetoed: `runtime_bootstrap_not_candidate` / `runtime_launch_override_present:OPENSSL_CONF` / `runtime_lifecycle_key_present` / `runtime_receipt_key_set_mismatch` / `operation_3_ca_store_changed` (each also a manifest hash mismatch) |
| **v5 tampers:** `RUNTIME.globalDispatcher.sameAsRunnerLoad` → false / SETTLED 4 `tls.globalDispatcher.identityUnchanged` → false | vetoed: `runtime_global_dispatcher_invalid` / `operation_4_global_dispatcher_changed` |
| tamper `real_pins` (verified without `--synthetic-adapter-ok`) | vetoed: `source_not_frozen_candidate:adapter`, `runtime_adapter_environment_absent`, `runtime_not_launched_by_bootstrap` |
| network attempts / NST ledger dir entries | 0 / 0 |

- **Verifier fix during this run.** The verifier's credential-echo scan first flagged every complete packet, because `SUPABASE_SERVICE_ROLE_KEY` is a presence key name in RUNTIME.json and the scan matched it. The scan now ignores that exact key name; a planted value in RUNTIME.json is still vetoed.
- The table shows the v5 run (`rehearsal/RESULTS.jsonl`; 41 lines; happy RUNTIME `globalDispatcher` = `{present: true, constructorName: "Agent", sameAsRunnerLoad: true}`). Earlier runs are in `superseded/`.

## Limits

- `--check` cannot run in an export: the bootstrap binds `/Users/tim/Code/fhfhockey.com/web`. I did not work around it, apart from the labelled relocated test copy.
- The rehearsal's TLS facts are synthetic. Real handshakes against the production hosts were not exercised.
- The keep-alive and resumption bindings rely on adapter-asserted `connectionSequence` and `sessionReused` values. The runner checks that they are consistent, not that they are true.
- **Dispatcher identity** proves that no swap happened after runner load. It does not prove the import-time `Agent` is benign: that rests on the bootstrap's empty-registry check plus the integrity of the unpinned `node_modules/undici`.
- **On the real transport** (npm undici 7.29.0), keep-alive reuse and session resumption were not reproduced in loopback, so those binding paths are unit- and rehearsal-tested only.
- Real-clock refusal will not reproduce until 2026-11-19T00:00Z.
- The canonical `web/node_modules/node_modules` is a pre-existing self-symlink. I did not create it, and I left it alone.
