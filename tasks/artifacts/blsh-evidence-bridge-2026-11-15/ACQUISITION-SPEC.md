# Official boxscore acquisition tool: `acquire-boxscores.mjs`

**Status (2026-11-15, after RECHECK-2; rebound to successor v5):** rebuilt **self-contained** and tested **offline only**. The current hash is `aa8a9cb7…`: only its `APPROVED` constants differ from the RECHECK-3-reviewed `4f8a0888…` (v4 conversions are now refused): a loopback TLS server, a throwaway certificate and zero non-loopback connections.
- **Listed (G4).** `frames.mjs` `APPROVED_ACQUISITION_TOOLS` is exactly `["aa8a9cb7…"]`, set by Chef at TJ's direction. Any other tool is refused with `acquisition_tool_not_reviewed`. TJ's separate approval of the run below is still required.
- **Approval order:** independent review, then a reviewed change that adds this file's sha256, then TJ's separate approval of the run below.
- **Never run against the real endpoint without that approval.**

**Why it exists.** Review Q5: a receipt that merely says `TLSVerified: true` is a self-assertion, and production frames now refuse it. Production frames need a completed acquisition directory written by this tool, with per-request TLS observations equivalent to the capture runner's. RECHECK-2 found that the previous tool (`e075b90a…`, **not approvable**) loaded code its hash did not cover; this version imports only `node:` builtins.

## Exact call budget, for TJ's separate approval (2026-11-11)

| Item | Value |
| --- | --- |
| Endpoint | `GET https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore` (official NHL; not NST) |
| Game ids | Re-derived from the **approved-candidate** conversion's hash-checked `schedule.raw.json` (the packet's own TLS-verified schedule call) and required to equal `scheduleFacts`. No schedule call; no other source. Expected for 2026-11-11: 2026020293–2026020298. |
| Requests | **Exactly one GET per game: 6.** Sequential (concurrency 1). Hard cap 16 games. |
| Retries | **0.** The first failure stops the run with `FAILED.json` and no completion manifest. A rerun needs a new approval and a new output path. |
| Redirects | `redirect: "error"`. The receipt records `finalUrl` (must equal the URL) and `redirected` (must be `false`). |
| Timeouts / sizes | 15 s per request, 120 s total, 4 MiB per body (streamed and counted), 1 s spacing (6 requests take about 6 s) |
| Output | Fixed: `/Users/tim/Library/Application Support/fhfh-blsh-boxscores-20261111`, refused if it exists. |
| Not touched | NST, Supabase, the admission ledger, credentials, `.env`. No writes outside the fixed output directory. |
| When | Right after the native capture and conversion. All of these must fall within 24 h before gate evaluation: the NST retrievals, these frame observations and the `CURRENT-REQUEST` captures. For a 2026-11-17T14:05Z capture, run within about an hour, and well before 2026-11-18T14:05Z. |

## Launch (self-contained; RECHECK-2 F1)

The tool imports **only `node:` builtins**. The adapter's `socketTls`/`withTlsObservation` and the needed `lib.mjs` helpers are **copied in**, so the tool's sha256 pins everything that runs besides Node itself, and Node is pinned by its execPath hash. It is launched with an **empty `execArgv`**: no ts-node, no `--require` or `--import`, and no `NODE_PATH`.

```bash
cd /Users/tim/Code/fhfhockey.com/web && env -i PATH=/usr/bin:/bin HOME="$HOME" TMPDIR="$TMPDIR" \
  /usr/local/bin/node /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15/acquire-boxscores.mjs \
  --conversion <approved conversion dir>
```

- **Output path is FIXED** (F3): `/Users/tim/Library/Application Support/fhfh-blsh-boxscores-20261111` for the 2026-11-11 source date. There is no `--out`; passing one is refused (`output_path_is_fixed`). An existing path is refused before any request. The approval names this exact path.
- **Requirements:** `/usr/local/bin/node` is `daa77e22…`, and the bridge folder is at its reviewed hashes. v4 does not need to be applied for the tool, which no longer loads the adapter file.

## What the tool does (and refuses)

1. **Before anything is written or sent, it refuses:**
   - a non-empty `execArgv`;
   - any of the 15 override keys, any of the 17 launch keys (including `NODE_PATH` and all `TS_NODE_*`) or any other `TS_NODE_*`;
   - **a preinstalled global undici dispatcher** (`global_dispatcher_preinstalled`);
   - a default CA store that is not the bundled roots;
   - **a conversion that is not an approved candidate** (F2: the same `conversion_not_approved` test as `assemble.mjs`: class, `approvedInputs`, and pins / verifier / node / lineage equal to `APPROVED`);
   - an incomplete or altered conversion directory;
   - an existing output path.
2. **Game ids are re-derived** from the conversion's hash-checked `schedule.raw.json`: date filter, exactly one day, all games OFF or FINAL, ids `202602xxxx`. They must equal `CONVERSION.json.scheduleFacts` (`schedule_ids_drift`).
3. **TLS observation:** the byte-copied adapter code (`undici:client:sendHeaders`, socket facts only). Test 18 runs it and the v4 original (`aa6237bd…`) on 12 identical scenarios, and the results are identical.
   - **Binding** follows the v4 runner's rules, plus a `peerCertificate` shape check (F3).
   - **The default CA store is re-read** before each dispatch (refusing to send if it changed) and after each response.
4. **Global-dispatcher identity** (`globalThis[Symbol.for('undici.globalDispatcher.1')]`):
   - it must be unset before the first request, checked synchronously just before `fetch`;
   - afterwards it must be the object the first bundled fetch created, identical at every later before- and after-request check;
   - with a test dispatcher option, it must stay unset;
   - any change → `global_dispatcher_changed`, `FAILED.json`, no manifest.

   Recorded as `globalDispatcherAtStart: "unset"` (runtime) and `globalDispatcher: "unchanged"` (each receipt).
5. **Wire-level duplicates (documented, not proven).** The tool counts every `sendHeaders` event for each game's path and requires **exactly 1** (`send_headers_count_not_one`, recorded in `FAILED.json`). Each receipt records `sendHeadersEvents: 1`.
   - **What this does NOT prove:** that Node's bundled undici never re-sends an idempotent GET on a keep-alive socket the server closed.
   - **What it guarantees:** if that happens, the run fails closed: no manifest, so no frames.
   - **Remaining exposure:** at most one extra GET per game, which is the same exposure as the capture runner.
6. **Output:** a new 0700 directory with 0600 files, each fsynced, and `MANIFEST.json` written last (temp + hard link):
   - **`ACQUISITION-RUNTIME.json`** (`fhfh.blsh.official-acquisition-runtime.v2`, exact keys), written before the first request: `startedAtUTC`, `toolSHA256`, `conversionSHA256`, `outputDirectory`, `node` (`execArgv` `[]`), `tls` (CA hashes), `environmentPresence`, `launch`, `globalDispatcherAtStart`, `valuesRecorded: false`.
   - **`source-tool.mjs`**: the tool's own bytes. `frames.mjs` hashes this file itself.
   - **`operation-N-STARTED.json`**, written before each dispatch.
   - **`boxscore-{id}.body.json`** and **`boxscore-{id}.receipt.json`** (`fhfh.blsh.official-boxscore-receipt.v3`), with exact keys: `operation`, `url`, `finalUrl`, `httpStatus`, `redirected`, `retrievedAtUTC`, `sha256`, `bytes`, `tls` (14 keys), `sendHeadersEvents`, `globalDispatcher`, `acquisitionStartedAtUTC`.

## What `frames.mjs` requires in production

- **A completed directory,** with exactly one journal, one body and one receipt per scheduled game (no prefix, extra or retry).
- **Runtime v2** with exact keys:
  - **`execArgv` must be `[]`**; the global dispatcher was `unset` at start; `outputDirectory` is the fixed path for the date;
  - bound to this conversion; node = `APPROVED.nodeSHA256`; no overrides; default store = bundled roots;
  - launch: the canonical tool path, its sha = the sha256 of the bound `source-tool.mjs` = `toolSHA256`, cwd = the canonical `web/`, and **no** launch or ts-node keys present.
- **Receipts v3:**
  - exact keys; operation N = the N-th scheduled game; `finalUrl == url`; `redirected === false`; HTTP 200;
  - `sendHeadersEvents === 1`; `globalDispatcher === "unchanged"`;
  - bound to the acquisition start and its journal.
- **TLS:** the same chain rules as the packet, including the CA store.
- **Tool:** its hash must be in `APPROVED_ACQUISITION_TOOLS`, which is exactly `[aa8a9cb7…]` (G4).

## Offline tests (`tests/bridge.test.mjs`)

- **Test 18:**
  - the tool's import specifiers are all `node:`, and it has no `createRequire` or dynamic `import()`;
  - the adapter copy is identical to the v4 original over 12 scenarios: full, reused socket, resumed, unauthorized, plain socket, no leaf, path mismatch, query stripped, two events, no event, other origin, POST;
  - its `APPROVED` constants equal `convert.mjs`'s.
- **Test 19: the real tool against loopback TLS.**
  - **Setup:** run with `execArgv` `[]`; trust only through a test dispatcher; 0 non-loopback connects; conversion = an approved-candidate conversion.
  - **Happy run:** one GET per scheduled game; real pooled keep-alive binding; `sendHeadersEvents` 1; dispatcher unchanged; 0700/0600; production frames refuse the test-transport output; test-mode frames produce 288.
  - **Faults** each leave `FAILED.json` and no manifest: redirect, 500, over 4 MiB, a CA swap mid-run, an untrusted certificate, and **a global dispatcher installed mid-run** (`global_dispatcher_changed`, 1 request).
  - **Refused before any write or request:**
    - **the RECHECK-2 reproducer:** a global dispatcher trusting a private root installed *before* the tool, with no dispatcher argument → `global_dispatcher_preinstalled`, 0 requests, no directory;
    - a pre-start CA swap; an existing output path;
    - a diagnostic conversion; a hand-edited class or pins; ids that drift from `schedule.raw.json`; an unmanifested edit.

   *The reviewer's literal `lib.mjs` injection can no longer run, because the tool imports nothing local (test 18 asserts this statically). Code that runs before the tool is reproduced by the preinstalled case.*
- **Test 15:** production frames over hand-built directories. A well-formed directory with the real tool yields production frames (the custody limit); bound to a tool one byte different it reaches only `acquisition_tool_not_reviewed`; and every defect gets its own code, including a non-empty `execArgv` (`--import`, ts-node), a preinstalled dispatcher, a non-fixed output path, `NODE_PATH` present, `sendHeadersEvents` 2, and a changed dispatcher.
- **Test 20:** the tool CLI refuses `--out` (`output_path_is_fixed`) and a diagnostic conversion (`conversion_not_approved`) before any write or request. No test ever created the real fixed path.

## Approvals still needed (separate from the capture approval)

1. **Independent review** of `acquire-boxscores.mjs`, then a reviewed change adding its sha256 to `APPROVED_ACQUISITION_TOOLS`. The list change is made (G4, by Chef at TJ's direction, not this lane); the reviewer's recheck of it is pending.
2. **TJ's specific approval:**
   - the tool hash;
   - the exact game ids from the converted packet;
   - the 6-GET ceiling, 0 retries, the output path and the time window.

   It is an external read of official NHL endpoints, not covered by the five-call capture approval.
3. **A named operator**, who makes one start and then hands the untouched directory to the bridge.
