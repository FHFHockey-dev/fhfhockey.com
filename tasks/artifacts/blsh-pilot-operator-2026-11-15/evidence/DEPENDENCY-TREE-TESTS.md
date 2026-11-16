# Dependency-tree gate (G3): credential-free tests, 2026-11-15

All runs used `env -i PATH=/usr/bin:/bin TMPDIR=<scratch>` and `/usr/local/bin/node tools/dependency-tree-hash.mjs`. Sources: a scratch `git archive` of base `a9551076` with `SUCCESSOR.patch` v4 (`66b4eb30…`) applied. Mutations were made only in a scratch copy of the 42 closure package directories, never in `web/node_modules`.

| Case | Result | Exit |
| --- | --- | --- |
| baseline generation, real `web/node_modules` | 42 packages, 1,634 files, tree `76c7d466…473a`; the 4 bootstrap DEPENDENCIES pins and the 9 v4 role pins all match | 0 |
| regenerate the baseline | byte-identical (deterministic) | 0 |
| real tree, v4 sources, compared with the baseline | `match` | 0 |
| real tree, canonical sources as they are now (unpatched bootstrap `d4d2fcac`) | `refuse`: `bootstrap_differs_from_baseline` | 1 |
| [a] scratch copy, unmodified | `match` (same tree hash, so the relative paths are location-independent) | 0 |
| [b] 1 byte appended to `cheerio/package.json` | `refuse`: `changed:node_modules/cheerio`, `bootstrap_dependency_pin_mismatch` | 1 |
| [c] symlink `memory-cache/evil` → `/etc/hosts` | `refuse`: `symlink_outside_tree:node_modules/memory-cache/evil` | 1 |
| [d] extra empty file in nested `htmlparser2/node_modules/entities` | `refuse`: `changed:node_modules/htmlparser2/node_modules/entities` | 1 |
| [e] 1 byte appended to the pinned `ts-node/dist/index.js` | `refuse`: `changed:node_modules/ts-node`, `bootstrap_dependency_pin_mismatch` | 1 |
| [f] `yn` removed | `refuse`: `dependency_unresolved:yn<-node_modules/ts-node` | 1 |
| [g] copy restored | `match` | 0 |
| the probe's exact invocation shape (`--web --sources --baseline`, env `PATH` + `TMPDIR` only), with `acorn/package.json` mutated in the copy | `refuse`: `changed:node_modules/acorn` | 1 |

**Not run:** probe v2 end to end. It reads `web/.env.local` and needs TJ's pop-up at T−1. Its dependency step is the exact command tested in the last row.

## v5 rebaseline (SUCCESSOR.patch `e8be50de…`, bootstrap `dbf69c47…`, runner `a74cbb0a…`, adapter unchanged `aa6237bd…`)

- **Superseded baseline:** the v4 baseline moved to `superseded/DEPENDENCY-TREE-BASELINE-v4.json` (`e278b666…`).
- **New baseline:** `DEPENDENCY-TREE-BASELINE.json`, sha256 `4534fd65c30d7c6e86ac84fd0664074074c039980ba207d5f5928277a52c1bb3`. Sources are a scratch `git archive` of `a9551076` with v5 applied.
- **Closure unchanged:** 42 packages, 1,634 files, tree `76c7d466…473a`. Only the `sources` block differs from v4: bootstrap and runner hashes. Imports and local files walked are identical.
- **Pins:** all 4 dependency pins and all 9 v5 role pins match. Regeneration is byte-identical.
- **undici 7.29.0 is in the closure:** `node_modules/undici`, 210 files, package sha256 `3f7368898f81…7058`, required by `node_modules/cheerio`. `cheerio/dist/commonjs/index.js` requires `undici`, which resolves to `node_modules/undici/index.js` (7.29.0); Node's bundled undici is 6.29.1. An `env -i` check shows the `undici.globalDispatcher.1` registry is unset before `require('cheerio')` and holds an `Agent` after it.

| Case | Result | Exit |
| --- | --- | --- |
| real tree, v5 sources | match | 0 |
| real tree, v4 sources, against the v5 baseline | refuse: `bootstrap_differs_from_baseline` | 1 |
| canonical sources now (unpatched) | refuse: `bootstrap_differs_from_baseline` | 1 |

## Predicted RUNTIME.json, v5 shape (bridge `convert.mjs` `54e3d624…`, expected-pins `a2a1e694…`)

All under `env -i` with the launcher allowlist and scratch `TMPDIR`. Secrets are absent; their presence booleans were set by hand.

| Case | Bridge `checkRuntime` | Dispatcher rule |
| --- | --- | --- |
| now, expected bootstrap = v5 `dbf69c47…` | veto `runtime_bootstrap_not_candidate` (canonical is still `d4d2fcac…`; correct before apply) | pass |
| now, expected bootstrap = canonical hash (isolates everything else) | **pass** | **pass** (`Agent`, `sameAsRunnerLoad`, not preinstalled) |
| `TS_NODE_FOO=1` | veto `runtime_launch_unlisted_ts_node_keys` | pass |
| `TS_NODE_TRANSPILE_ONLY=true` | veto `runtime_launch_override_present` | pass |
| `OPENSSL_CONF=/dev/null` | veto `runtime_launch_override_present` | pass |
| `NODE_USE_SYSTEM_CA=1` | veto `runtime_override_env_present` | pass |
| `NST_JOB_LIFECYCLE_ENABLED=false` | veto `runtime_lifecycle_key_present` | pass |
| dispatcher marked preinstalled | pass | **veto** |
| `constructorName` set to `ProxyAgent` | veto `runtime_global_dispatcher_invalid` | veto |

`TS_NODE_PROJECT=x` stops ts-node itself before any output, which also prevents a launch.

## Loaded-file coverage (RECHECK-4 item 3, option 1), v5

**Harness:** `tools/list-loaded-modules.cjs` (`b47e0a67…`). It was launched exactly like the bootstrap: cwd = scratch v5 export `web/` (its `node_modules` is a symlink to the real tree, so cache keys are real paths), `env -i` + `NODE_PATH=.`, `DISABLE_V8_COMPILE_CACHE=1`, `TS_NODE_COMPILER_OPTIONS`, `--require ./node_modules/ts-node/register/transpile-only`, scratch `TMPDIR`.
- It requires the bootstrap, preparation, runner and adapter modules, top level only. No adapter factory, runner, plan or dispatch call.
- There are no hooks or monkeypatching: it reads `require.cache` and `process.moduleLoadList`.
- Scratch `TMPDIR` stayed empty: no writes.

**Classification:** `dependency-tree-hash.mjs --loaded` (`274f9969…`). Result: `evidence/LOADED-MODULES-COVERAGE-v5.json` (`99f37b90…`). Paths are relative; no absolute paths or secrets.

| Class | Files |
| --- | --- |
| v5 `SOURCE_PIN` role (hash checked against the pin) | 9: adapter, admission, admissionOrigin, budget, client, lifecycle, preparation, ratePolicy, runner |
| candidate bootstrap (hash = baseline `dbf69c47…`) | 1 |
| inside a G3 closure package directory (hash-covered) | 245, in 34 package paths, which is 32 distinct names because `entities` appears at 3 paths. undici contributes 110, ts-node 23, cheerio 15, parse5 14, … typescript 1 |
| listing harness (excluded; in the real run the entry is the bootstrap) | 1 |
| **uncovered** | **0** |
| **total `require.cache`** | **256** |

- **Builtins** loaded by the capture modules (15): `_http_agent`, `_http_client`, `_http_common`, `_http_incoming`, `_http_outgoing`, `_http_server`, `_tls_common`, `_tls_wrap`, `dns`, `fs/promises`, `http`, `http2`, `tls`, `util/types`, `zlib`. There are 41 public builtins in the process in total.
- **Not in `require.cache`** (read with fs, not required): `web/tsconfig.json`, pinned by the bootstrap (`bf729d54…`), and the `package.json` files Node reads during resolution, which sit inside G3 package directories.
- **Baseline unchanged:** a closure of 42 packages / 1,634 files covers all 34 loaded package paths. Regenerating the baseline with the extended tool is byte-identical (`4534fd65…`).

**Refusal tests.** All used scratch copies only: `webcopy` = copied closure, `exportcopy` = v5 export with `node_modules` → `webcopy`.

| Case | Result |
| --- | --- |
| [a] clean copy | match; 256 loaded, 0 uncovered |
| [b] `memory-cache/index.js` gains `require("evil-tls")` + new package `node_modules/evil-tls` | refuse: `changed:node_modules/memory-cache`, `bootstrap_dependency_pin_mismatch`, **`loaded_file_uncovered:node_modules/evil-tls/index.js`** (257 loaded) |
| [c] `memory-cache` removed + `web/memory-cache.js` shadow in the sources (NODE_PATH route) | refuse: `dependency_unresolved:memory-cache<-bootstrap DEPENDENCIES`. The tree walk stops before classification |
| [e] `lib/nst/client.ts` gains `import "./extra"` + new `lib/nst/extra.ts` | refuse: `source_role_pin_mismatch`, **`loaded_file_uncovered:lib/nst/client.ts`**, **`loaded_file_uncovered:lib/nst/extra.ts`** |
| [f] restored | match; 256 / 0 |
| real canonical tree today (unpatched bootstrap) | refuse: `bootstrap_differs_from_baseline`, `loaded_file_uncovered:scripts/blsh/nativeProcessCaptureBootstrap.ts` (correct before apply) |

The rows above ran with `274f9969…` (the first table in this file with `cf43a102…`). **All of them were rerun on `912041a5…`; see the next section.** The "canonical tree today (unpatched bootstrap)" rows here and above, and the "now, expected bootstrap = v5" prediction row, are historical: canonical `web/` now carries the applied v5 bootstrap `dbf69c47…`. The prediction was not rerun by this lane after apply; it is part of the T−1 probe.

## RECHECK-6 R0, and every earlier case rerun on the current tool (2026-11-15 ~18:35Z)

**Tool:** `dependency-tree-hash.mjs` `912041a513f0dabf034797d6c4d93fcb2a22ded6d2019f44463ce82f56103bf4`. **Script:** `tools/test-g3-r0.sh` (hash in RUNTIME-RECEIPT-PLAN §7). It builds each scratch web root exactly like the reviewer's `repro/recheck6/g3-self-check.sh`, runs under `env -i` with a scratch `TMPDIR`, **asserts** node's own exit code and an expected stdout string, and exits 1 on any mismatch or if a canary marker exists. Result: **20/20 PASS, 0 failures, script exit 0.**

| Case | Expected and observed | Exit |
| --- | --- | --- |
| control | `match`, tree `76c7d466…` | 0 |
| control `--loaded` | `match`, 256 loaded (9 / 1 / 245, 34 packages, 15 builtins), `uncovered: []` | 0 |
| control, probe shape (`--web X --sources X --baseline … --loaded`) | `match`, 256 / `[]` | 0 |
| **tsforged** (reviewer's argv-gated forged-`match` prologue) | **`refuse`, `typescript_package_hash_mismatch`** | 1 |
| **tsforged `--loaded`** | **`refuse`, `typescript_package_hash_mismatch`** | 1 |
| tscanary (unconditional prologue that writes a marker file) | `refuse`, `typescript_package_hash_mismatch`; **marker absent**: the forged bytes never ran | 1 |
| tscanary, generate mode (no `--baseline`) | same refusal; marker absent; no manifest written | 1 |
| tssymlink (`node_modules/typescript` → a copy outside the tree) | `refuse`, `typescript_not_plain_directory` | 1 |
| dyld (`DYLD_PRINT_LIBRARIES=1` in the checker's env) | `refuse`, `dyld_env_present` | 1 |
| undici (comment appended to `index.js`) | `refuse`, `changed:node_modules/undici` | 1 |
| undici `--loaded` | adds `loaded_listing_skipped_tree_refused` | 1 |
| 1 byte appended to `cheerio/package.json` | `changed:node_modules/cheerio`, `bootstrap_dependency_pin_mismatch` | 1 |
| symlink `memory-cache/evil` → `/etc/hosts` | `symlink_outside_tree:node_modules/memory-cache/evil` | 1 |
| extra file in nested `htmlparser2/node_modules/entities` | `changed:node_modules/htmlparser2/node_modules/entities` | 1 |
| 1 byte appended to pinned `ts-node/dist/index.js` | `changed:node_modules/ts-node` | 1 |
| `yn` removed | `dependency_unresolved:yn<-node_modules/ts-node` | 1 |
| [b] `memory-cache` requires a new `evil-tls` package, `--loaded` | `changed:node_modules/memory-cache`, `bootstrap_dependency_pin_mismatch`, `loaded_listing_skipped_tree_refused`. The listing child no longer runs on a refused tree, so `loaded_file_uncovered` is not reached | 1 |
| [e] `lib/nst/client.ts` imports a new `extra.ts`, `--loaded` | `source_role_pin_mismatch`, `loaded_listing_skipped_tree_refused` | 1 |
| [c] `memory-cache` removed + `web/memory-cache.js` shadow (NODE_PATH route) | `dependency_unresolved:memory-cache` | 1 |

- **The reviewer's own script, unchanged** (`g3-self-check.sh`): control `match`, undici `refuse`, tsforged `refuse` (`typescript_package_hash_mismatch`). Its printed `exit=` values are the pipe's, as the reviewer noted.
- **Canonical `web/` (applied v5, bootstrap `dbf69c47…`), T−0 command form:** exit 0, `match`, tree `76c7d466…`, 256 loaded, `uncovered: []`, `checkerTypeScript: "verified_before_load"`, `dyldKeysPresent: false`. The scratch `TMPDIR` stayed empty.
- **Baseline unchanged:** generate mode on canonical is byte-identical to `4534fd65…`.
- **The classifier** (`loaded_file_uncovered`) is unchanged code. It is now reachable only on a matching tree, as the second line; its uncovered branch was exercised by [b] and [e] on `274f9969…` (rows above).
- **Probe v2 DYLD parsing**, credential-free on a synthetic scratch file: `export DYLD_INSERT_LIBRARIES=…` and quoted `DYLD_FOO` are reported and a commented line is not. Under `/usr/bin/python3` (SIP-protected), an injected `DYLD_BAR` was **not visible** in the probe's own environment, because SIP strips `DYLD_*` from protected binaries. `dyldKeysInProbeEnv` is therefore not a meaningful check; the launcher's and G3's own-env checks are the ones that count (G3's node sees them, per the dyld case).
- **Not run:** probe v2 end to end. It reads `.env.local` and needs TJ's pop-up at T−1.
