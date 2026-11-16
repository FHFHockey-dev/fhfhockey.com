# RECHECK-6: RECHECK-4 precondition 2 (in-process module integrity) against the G3 evidence (2026-11-15)

Offline and read-only. Nothing outside this review folder and my diary was written. Scratch: `$S/r6`.

## Answer

**Not closed as built. Coverage is sufficient, but three operator-lane changes are needed, plus one capture-lane fix:**
- **(R0, High)** G3 executes code from the tree it is checking, so a modified `typescript.js` can forge its `match`. Reproduced below.
- **(R2)** add a T+0 rerun.
- **(R1)** attest the T−0 and T+0 outputs, because the bridge cannot verify them.
- **(R3, capture lane)** refuse `DYLD_*`.

1. **Coverage: yes.** Re-derived, not taken from the evidence files:
   - every module file the capture loads, statically or after dispatch, lies in the pinned roles, the bootstrap, or a G3 package whose every file is hashed;
   - the hashed tree equals the published npm tarballs (42/42);
   - the tree is unchanged today.

   Today's tree is clean by an independent check (`provenance.py`), not by G3 alone (see R0).
2. **What remains** is R0–R3 and one Low limit, detailed below. With all four fixed, I would call precondition 2 closed for in-process JavaScript.

## What I re-derived

**Tool and inputs.** Hashes match Chef's message:
- `tools/dependency-tree-hash.mjs` `274f9969…`;
- `tools/list-loaded-modules.cjs` `b47e0a67…`;
- `evidence/DEPENDENCY-TREE-BASELINE.json` `4534fd65…`;
- `evidence/LOADED-MODULES-COVERAGE-v5.json` `99f37b90…`;
- `g1-canonical/G3-LOADED.json` `1a1f1724…`.

I read both tools in full.

**1. G3 rerun (my own, applied canonical tree).** `node dependency-tree-hash.mjs --baseline … --loaded` from scratch, with `TMPDIR` in scratch and `GIT_DIR` unset, gave:
- `dependencyTree: "match"`, tree `76c7d466…`;
- 256 loaded files: 9 roles, 1 bootstrap, 245 package files, 34 package paths, 15 capture-loaded builtins;
- `uncovered: []`.

This is identical to Chef's `G3-LOADED.json`.

**2. Method soundness.**
- **Closure.** It starts from the bootstrap's 4 `DEPENDENCIES` plus every runtime import found in the AST of the bootstrap and its 9 roles. The 10 local files walked are exactly those 10, and the bare runtime imports are `cheerio` and `memory-cache` (`next` is type-only). It then walks `dependencies` and `optionalDependencies` with Node-style resolution, and refuses any package or symlink outside `web/node_modules`.
- **Package hashing.** Every regular file of each closure package is hashed, not only loaded ones: 42 packages, 1,634 files.
- **Classification.** Each `require.cache` file is classed by its realpath. Role and bootstrap files are hash-checked, and package files are covered by the tree hash taken in the same invocation. Anything else, including files in an un-walked nested `node_modules`, refuses.
- **Lazy requires in roles.** None of the 10 local files has a function-level `require`. The only dynamic `import()` calls are the bootstrap's three literal imports of roles.
- **ts-node.** ts-node's un-walked peers (`@swc/*`) load only with `TS_NODE_SWC`, `TS_NODE_TRANSPILER` or a `ts-node` section in `tsconfig.json`. The bootstrap refuses all 13 `TS_NODE_*` override keys. `web/tsconfig.json` is `bf729d54…` (pinned by the bootstrap) and has no `ts-node`, `extends` or `plugins` key.

- **Exception: R0.** All of the above holds only if the checker itself is honest. G3 requires `typescript` from the checked tree before hashing it (see R0).

**3. Lazy loads after dispatch (the limit Chef asked about).** I dumped `require.cache` at process exit for two real runs, each with the bootstrap-shaped `env -i` launcher from canonical `web/` (`repro/recheck6/launch.sh` + `dump-cache-on-exit.cjs`, classified by `classify.mjs`):

| Run | Files | Outside closure | Not in the static G3 listing |
|---|---|---|---|
| v5 `rehearse.ts happy`: full runner flow, 5 operations, cheerio parse of both pages, `networkAttempts: 0` | 248 | **none** | none |
| Pinned v5 adapter `withTlsObservation` + npm-undici `fetch`, loopback only (`real-adapter-loopback.cjs`) | 255 | **none** | `node_modules/undici/lib/llhttp/llhttp_simd-wasm.js` |

The adapter run covered GET with gzip, br and deflate bodies, a JSON POST, a windows-1252 HTML page parsed by cheerio, and `authorized: true` on all four.

So the real transport lazily loads one file after the first request. That file is inside the hashed `undici` package, so the tree hash covers it even though the pre-launch listing never sees it. This is why G3's whole-package hashing, rather than the listing alone, is what closes lazy loads.

**4. Baseline provenance: not just trust-on-first-use.** `repro/recheck6/provenance.py` (Python `-I`, offline) does the following for each of the 42 closure packages:
- reads `package-lock.json`'s sha512 `integrity`;
- opens the content-addressed tarball in the local npm cache;
- re-verifies the tarball's sha512;
- compares every file in memory with the installed copy.

Result: **42/42 byte-identical**, no changed, extra or missing files. All 42 versions equal the lockfile's. The G3 baseline is therefore the published code pinned by the committed lockfile, not merely "whatever was on disk at 11:17".

**5. Builtins and non-`require` inputs.**
- The 15 newly loaded builtins (45 after real dispatch) come from the node binary. The bootstrap pins it as `daa77e22…`, and `RUNTIME.node` records it.
- `tsconfig.json` is pinned by the bootstrap.
- Package `package.json` files are inside hashed package directories.
- `web/package.json` is read by Node but not pinned. It holds no code and no `imports` map used by the roles, so this is Low with no action.

## What remains (precondition 2 is closed only together with these)

- **(R0, High) G3 runs code from the tree it hashes.**
  - **The cause.** `dependency-tree-hash.mjs:49` does `createRequire(join(WEB, "package.json"))("typescript")` at top level, before any package is hashed. Whatever is in `web/node_modules/typescript/lib/typescript.js` therefore runs inside the checker first.
  - **The test.** `repro/recheck6/g3-self-check.sh` builds a scratch web root holding copies of the 42 closure packages, `package.json`, the v5 `scripts/blsh` and `lib/{nst,cron}`, then runs the **unchanged** operator tool with `--web <scratch> --baseline …`:
    - **control** (unmodified): `match`, tree `76c7d466…`;
    - **undici** (one appended comment): `refuse`, `changed:node_modules/undici`. The tree hash works for non-executed packages;
    - **tsforged** (a one-line prologue in `typescript.js` that prints a canned result and exits): **`match`, tree `76c7d466…`, `loaded.uncovered: []`, `differences: []`**. That result is forged.

    (The printed `exit=` values in that script are the pipe's, not node's.)
  - **The capture has the same blind spot.** ts-node's register loads `typescript` before the bootstrap's own `DEPENDENCIES` pin check runs. So in-process, typescript can also defeat the bootstrap's entry-hash check, for example by hooking `fs`/`crypto` first.
  - **The fix (operator lane):** G3 must hash at least `node_modules/typescript`, and compare it with the baseline, using builtins-only code *before* requiring it. Simpler still: require nothing from the checked tree (a builtins-only import scan, or a typescript copy outside `web/` pinned by hash). The parent's tree comparison happens before the `--loaded` child is spawned, so the child's ts-node/typescript load is safe once R0 is fixed.
  - **Today:** `provenance.py` (Python, independent of the tree) shows `typescript` 5.7.3 is byte-identical to its lockfile tarball. Until G3 is fixed, the operator should run `provenance.py` (or an equivalent independent hash of `node_modules/typescript`) at T−0 alongside G3.

- **(R1) Binding: operator-attested, not bridge-verifiable.**
  - G3 runs in a separate process at T−0, before `execve`. Its output is not in the packet, `RUNTIME.json` or the conversion, so the bridge can never check it. It has the same custody standing as the bootstrap's empty-registry rule (RECHECK-4 item 3).
  - This is acceptable for the pilot only if the operator attestation carries the exact T−0 G3 stdout (`match`, tree `76c7d466…`, `uncovered: []`) with its timestamp.
  - A require-cache manifest written by the capture process into `RUNTIME` would not be stronger against an in-process attacker, who could forge it. It would only add a record of what actually loaded.
- **(R2) Time-of-check gap.** The check-to-launch window is seconds, and the capture runs for about a minute, so a file swapped in that window would go unseen. **Fix:** rerun the same G3 `--loaded` command immediately after the capture exits (T+0) and require `match` / `uncovered: []` before converting. Attach both outputs to the attestation. This costs about one second and needs no credentials.
- **(R3) Native-code channel outside module integrity.**
  - `/usr/local/bin/node` is hardened-runtime but carries `com.apple.security.cs.allow-dyld-environment-variables` and `…disable-library-validation`. `env -i DYLD_PRINT_LIBRARIES=1 /usr/local/bin/node -e 0` prints dyld's load list, so dyld environment variables are honoured.
  - `DYLD_INSERT_LIBRARIES` would therefore load arbitrary native code before any JavaScript runs. It would appear in neither `require.cache` nor G3.
  - Nothing checks this today. `grep DYLD` finds no match in the v5 `web/scripts/blsh/*.ts` (bootstrap, runner, adapter), the bridge `*.mjs` (including `convert.mjs` `LAUNCH_ENV`), the successor `verify-packet.mjs`, or the operator `tools/*` (including the T−1 `env-presence-probe-v2.py`) and `*.md`. `OPENSSL_CONF`, by contrast, is recorded and refused in the launch block.
  - **Inferred, not demonstrated:** I did not build or inject a dylib.
  - **Fix (capture lane):** the bootstrap refuses any `DYLD_*` key, and RUNTIME/launch records `dyldKeysPresent: false`. Until then, the `env -i` launcher is the only guard (custody), and the attestation should state it.
- **(Limit) Untested paths.** My dynamic runs cover the happy runner flow and the real transport's success paths. Error paths (source-map stack rendering, undici error branches, other iconv-lite encodings) may lazily load more files. `require.cache` shows only CommonJS: an ESM `import()` from a package would appear in neither G3's listing nor my dumps, though whole-package hashing still covers its bytes. All such files I can identify are inside hashed closure packages. A load outside the closure on an untested path would be missed by the static listing, though the post-run check (R2) would at least confirm the tree did not change. Low.

## Final status of RECHECK-4 precondition 2

**Open, pending operator-lane changes.** Coverage is sufficient.

It closes for in-process JavaScript when all four hold:
- **(R0)** G3 verifies `typescript`, or uses nothing from the checked tree, before executing it. Until then, run an independent hash such as `provenance.py` at T−0.
- **(R1)** the T−0 and T+0 outputs are in the operator attestation.
- **(R2)** G3 `--loaded` prints `match` / `uncovered: []` at T−0 **and** at T+0.
- **(R3)** the launcher is `env -i` with no `DYLD_*` keys, attested until the bootstrap refuses them.

All other RECHECK-4 preconditions are unchanged.

Reproducers: `repro/recheck6/` (`launch.sh`, `dump-cache-on-exit.cjs`, `real-adapter-loopback.cjs`, `classify.mjs`, `provenance.py`, `g3-self-check.sh`).
