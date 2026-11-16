# BLSH pilot: operator runtime/TLS evidence plan (pre-approval)

Prepared 2026-11-15 ~02:20Z. Credential-free checks were run, plus one TJ-approved presence-only probe of `web/.env.local` (§3), which passed.

> **Design change (BLSH Chef `local_56526db8`, 2026-11-15).**
> - **Authoritative receipt:** the candidate runner writes the runtime/TLS receipt **in-process**, as `RUNTIME.json` inside the packet, bound to `STARTED.startedAtUTC`, plus per-operation TLS facts.
> - **This plan's role:** everything here, including the T−1-day probe, is **pre-approval evidence only**. It shows that a configured process can exist and passes `--check`. It is **not** runtime provenance and **not** `TLSVerified` evidence.
> - **Field names:** exact, from the successor `HANDOFF.md` §2–3 for **v5** (`SUCCESSOR.patch` sha256 `e8be50de132887be4e4c33b086003a1f639ba554f23c85f08d27d5a780d7752f`; bootstrap `dbf69c474bedefd9…`, runner `a74cbb0a59d4b352…`, adapter unchanged `aa6237bd…`). The pre-approval check uses the evidence bridge's own `checkRuntime` (`blsh-evidence-bridge-2026-11-15/convert.mjs`, sha256 `54e3d624…57e8` at this writing), plus the successor verifier's v5 dispatcher rule; see §3a.
> - **Unchanged rule:** no env file or credential is loaded without TJ's pop-up approval of the exact command.

## 1. The problem: a Claude operator has no "configured process"

The 11-12 plan says to run "in the already configured operator process … No shell wrapper, `.env` loader, secret export". A Claude session has no such process.

**What the bootstrap and adapter read from `process.env`** (grep of the 9 pinned modules):

| Variable | Requirement |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | must equal `https://fyhftlxokyjtpndbkfse.supabase.co` after trim |
| `NST_KEY` | non-empty |
| `SUPABASE_SERVICE_ROLE_KEY` | non-empty |
| `NST_JOB_LIFECYCLE_ENABLED` | must not be `"true"` |
| `NODE_PATH`, `DISABLE_V8_COMPILE_CACHE`, `TS_NODE_COMPILER_OPTIONS` | exact loader values |
| `TMPDIR` | indirectly: the local NST ledger lives at `tmpdir()/fhfhockey-nst-budget-<uid>` |

None of the 9 modules loads an env file itself (no `dotenv`, `@next/env` or `loadEnvConfig`). `--env-file` is refused by the exact `execArgv` check.

This operator's own shell **cannot be inherited**:
- It carries `NODE_USE_SYSTEM_CA`, which is on the bootstrap's forbidden list (variable name checked only).
- Its `TMPDIR` is correct.
- The forbidden list is a denylist. It omits, for example, `OPENSSL_CONF`, which Node honours at startup.

**Decision (TJ approved the design 2026-11-15 by pop-up, relayed by Chef; the hash pin and independent review are RECHECK-8):** use a small, hashed, value-free **launcher** in `tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/`. It reads **one named env file** and `execve`s node with an env built **from an allowlist only**. It is not a shell, does not source the file, puts no secrets in argv, never prints a value and runs no retries.

The child env is exactly:

| Key | Value |
| --- | --- |
| `PATH` | `/usr/bin:/bin` |
| `TMPDIR` | output of `getconf DARWIN_USER_TEMP_DIR` (currently `/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/`). This is the **real** same-user ledger dir, where `fhfhockey-nst-budget-501/` exists (mode 0700, mtime Nov 13 12:24). Under `env -i` without `TMPDIR`, Node would use `/tmp`, which has no ledger: a **substitute ledger**, forbidden by the plan |
| `NODE_PATH` | `.` |
| `DISABLE_V8_COMPILE_CACHE` | `1` |
| `TS_NODE_COMPILER_OPTIONS` | `{"module":"commonjs","moduleResolution":"node"}` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NST_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | from the named file |
| `NST_JOB_LIFECYCLE_ENABLED` | **must be absent from the file; if it is present (any value), refuse to launch.** The launcher never drops it, because that would manufacture "disabled", and never passes it on, because `checkRuntime` requires `adapterEnvironmentPresence.NST_JOB_LIFECYCLE_ENABLED === false` (key not present). A `=false` line would veto the packet after five live calls. Today's `.env.local`: absent |

argv is exactly `/usr/local/bin/node --require ./node_modules/ts-node/register/transpile-only scripts/blsh/nativeProcessCaptureBootstrap.ts --run <receipt path>`, with cwd `web/`.

**DYLD refusal (RECHECK-6 R3; for the Nov 17 pilot, the closing control).** TJ decided on 2026-11-15, relayed by Chef: keep v5 and close R3 for this pilot through this launcher refusal plus the attestation's `dyldKeysPresent: false`. The bootstrap-side refusal is queued for the next candidate. The launcher refuses to start if **any key beginning `DYLD_`** is in its own environment or in the env file. It is a prefix match, not a fixed list, and only names are reported, never values. `/usr/local/bin/node` carries `allow-dyld-environment-variables` and `disable-library-validation`, so `DYLD_INSERT_LIBRARIES` would load native code before any JavaScript, invisible to `require.cache` and G3. The allowlist env already drops such keys, but the refusal makes their presence a stop rather than a silent drop. The attestation (§3c) records `dyldKeysPresent: false`. Probe v2 (§3a) and G3 (§3b) apply the same prefix rule. The bootstrap-side refusal with a `RUNTIME` field is queued for the next candidate; this lane does not edit `web/scripts/blsh`. **Note for the launcher's implementation:** a launcher run by a SIP-protected interpreter (`/usr/bin/python3`, `/bin/sh`) has `DYLD_*` stripped from its own environment by macOS, so its own-environment check cannot see them (tested for the probe, §3a). Those keys then cannot reach node either, because the launcher builds node's env from the allowlist. The env-file check, and G3's node-side check at T−0/T+0, remain meaningful.

### 1a. The launcher as built: `tools/nst-pilot-launcher.py` (sha256 `31c370c3110ddb5d4cf90e730e9650639e36bd442959f7a7c791bbc28926197b`)

**Only supported invocation** (any cwd; it changes to `web/` itself), run in the background at about 14:04:00Z:

```bash
/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/nst-pilot-launcher.py --run <absolute receipt path> > /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation/launcher.log 2>&1
```

Any other argv refuses (`usage`) before anything is read. Every refusal is one JSON line `{"launcher":"refuse","code":…}` and exit 2. Codes and log lines carry key names only, never values, and an unexpected exception prints only its type name, never a traceback.

**Why `/usr/bin/env -i PATH=/usr/bin:/bin` first (RECHECK-8, blocking).** `/usr/bin/python3` is an xcode-select shim that honours `DEVELOPER_DIR`. That key is not `DYLD_*`, so neither SIP nor the DYLD check catches it.
- **Bare command:** with `DEVELOPER_DIR` pointing at a fake folder, the shim ran a fake interpreter instead of python (tested: marker written). That interpreter could exec node with any environment.
- **With the prefix:** `/usr/bin/env` is itself SIP-protected and clears every key before the shim runs, so the shim resolves the real Command Line Tools python (tested: no marker, real refusal output).
- **Compatibility:** the launcher needs nothing from the caller's environment. It derives `TMPDIR` from `getconf`.

**Gates, in order** (the first failure stops; nothing is retried):
0. **Interpreter guard, before any other import** (builtins only). It refuses `not_isolated` unless `sys.flags.isolated` (that is, `-I`), and `unexpected_interpreter` unless `sys.executable` is `/Library/Developer/CommandLineTools/usr/bin/python3`.
   - So a `hashlib.py` or `json.py` on `PYTHONPATH` cannot run before a gate, and the refusal is one JSON line with no traceback (tested).
   - `-I` itself keeps `PYTHONPATH`, the user site and the script directory's shadowing out. A `sitecustomize` would need `PYTHONPATH`, which `-I` ignores.
   - The exec line records `pythonIsolated` and `pythonExecutable`.
1. **Own environment:** `NST_JOB_LIFECYCLE_ENABLED` present → `lifecycle_key_in_launcher_env`; any `DYLD_*` → `dyld_key_in_launcher_env:<names>`.
2. **Receipt:** an absolute path to a regular file owned by this user with no group or other access; otherwise `receipt_path_not_absolute`, `receipt_missing` or `receipt_not_private_regular_file`.
3. **Real `TMPDIR`:** from `/usr/bin/getconf DARWIN_USER_TEMP_DIR`. Its `fhfhockey-nst-budget-<uid>` ledger directory must exist (no substitute ledger), else `nst_ledger_dir_missing`.
4. **Window, checked before the env file is opened:** the clock must be in 2026-11-17 14:03:00–14:05:00Z, else `outside_start_window`. Outside the slot, the credentials file is therefore never read (tested with the real `main()`). The date is fixed, so the 11-18 contingency needs a new launcher hash and a new approval.
4b. **Lock (RECHECK-8 Low).** After the window gate and before the env file is opened, the launcher creates `tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation/launcher-20261117T1405Z.lock` with `O_CREAT | O_EXCL | O_NOFOLLOW`, mode 0600. The file holds only `{pid, takenAtUTC}` and is **never removed**, so any second launcher refuses `launcher_lock_exists`, even after the first has exec'd.
   - A missing `attestation/` directory gives `launcher_lock_unavailable`. The §3c T−0 command creates that directory at about 14:03Z, so T−0 must run first.
   - An out-of-window call takes no lock (tested).
5. **`web/.env.local`**, the only file it reads, parsed with the probe's line rules and never sourced:
   - any `DYLD_*` key → `dyld_key_in_env_file:<names>`;
   - `NST_JOB_LIFECYCLE_ENABLED` with any value → `lifecycle_key_in_env_file`;
   - a duplicate of a capture-path key → `duplicate_key_in_env_file:<names>`;
   - a missing or empty `NEXT_PUBLIC_SUPABASE_URL`, `NST_KEY` or `SUPABASE_SERVICE_ROLE_KEY` → `missing_or_empty_key:<name>`;
   - whitespace or a stray quote in one of those three values (for example an inline `# comment`) → `value_shape_suspect:<name>`;
   - a URL other than exactly the pinned origin → `supabase_origin_not_pinned`;
   - an unreadable file → `env_file_unreadable`.
   - **File hygiene, checked first (RECHECK-8 Low).** The file is opened with `O_NOFOLLOW | O_NONBLOCK`, then `fstat` runs on the **same** descriptor. It must be a regular file owned by this user with no group or other access, else `env_file_not_private_regular_file`. A symlink, a FIFO (no hang), a directory and a 0640 file all refuse (tested). The launcher never chmods or writes it. The not-owned-by-me branch is code-read only: making a file owned by another uid needs root.
   - **The real `web/.env.local`, checked by `stat` only (no read, 2026-11-15):** regular file, mode `0600`, uid 501 (this user), 1 link, not a symlink. **It passes this gate as it stands.**
6. **Sleep** until 14:05:05Z (at most 125 s).
7. **G3, inside the launcher** (§3b): it verifies the G3 tool is `912041a5…` and the baseline is `4534fd65…`, then runs `dependency-tree-hash.mjs --baseline … --loaded` from `web/` with env `PATH` plus `TMPDIR` set to a fresh `mkdtemp` folder (no credentials). Because the launcher runs under `env -i`, that folder is created under `/tmp`. It logs **a wrapper line**, not the bare G3 line: `{"launcher": "g3", "exitCode": <G3 exit>, "stdout": "<the G3 JSON line>"}` (`nst-pilot-launcher.py:131`). It requires exit 0, `match`, tree `76c7d466…`, `differences: []`, `uncovered: []` and `dyldKeysPresent: false`. Otherwise it refuses with `g3_tool_not_pinned`, `g3_baseline_not_pinned`, `g3_unparsed` or `g3_not_match`.
8. **Clock re-read:** it must be in 14:05:00–14:05:50Z, else `outside_exec_window`.
9. **Exec:** it logs `{"launcher":"exec", atUTC, launcherSHA256, cwd, argv0, envKeys, dyldKeysPresent:false, lifecycleKeyPresent:false}`, changes to `web/`, and makes **exactly one** `os.execve` of the argv above with the allowlist env. A failed execve refuses; there is no second attempt.

**Interpreter and the SIP caveat (decided).** The launcher runs under `/usr/bin/python3`, the SIP-protected stub, on purpose:
- macOS purges every `DYLD_*` variable before the stub loads, so no injected library can load into the launcher and none can reach node. Tested: started through the stub with `DYLD_PRINT_LIBRARIES=1`, node received exactly the allowlist.
- The own-environment refusal therefore cannot fire under the supported invocation. It is defence in depth: started through an unprotected interpreter (the Command Line Tools python, directly), it **does** see `DYLD_*` and refuses (tested).
- The env-file refusal is fully meaningful, and G3's node-side refusal runs inside the launcher's gate 7.
- The stub also injects `CPATH`, `SDKROOT`, `LC_CTYPE` and similar into the launcher's own environment. None reaches node, whose env is built from the allowlist only.
- Inside node, CoreFoundation adds `__CF_USER_TEXT_ENCODING` itself (observed in the stub test). It is not one of the keys `RUNTIME.json`/`checkRuntime` inspect.
- **Pre-start shell check (advisory, both keys):** `export -p | grep -c -E 'DYLD_|DEVELOPER_DIR'` must print 0. The `env -i` prefix makes both harmless anyway; the check catches a contaminated operator shell early.
- **T−1 interpreter check:** `/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I -c 'import sys; print(sys.executable)'` must print `/Library/Developer/CommandLineTools/usr/bin/python3`. If `xcode-select` has been switched by then, the launcher would refuse `unexpected_interpreter` at the slot.
- **The operator's own shell must be checked with a builtin:** `/usr/bin/env` and `printenv` are SIP-protected and **cannot** see `DYLD_*` (tested). Use `export -p | grep -c DYLD_` in zsh, which must print 0. My earlier "0 DYLD keys" check used `env` and was therefore blind; the builtin check on 2026-11-15 also gave 0.

**Tests** (`tools/test-nst-pilot-launcher.py`, sha256 `33aa7cb4730199af4391b0570d8b2eedf0ef944cb2f461754fd7cc73e796f0c7`; it refuses on 2026-11-17/18 UTC, and its real-script cases use a scratch launcher copy with only `ENV_FILE` and `LOCK_PATH` changed). No credentials, no network, never `web/.env.local` and never the real bootstrap. Each case runs in its own process with a fake env file, a fake clock (sleep advances it), a fake user temp dir and a node **stub** as the execve target. The stub prints argv, cwd, env key names and sha256 digests of the three values. **Result: 49/49 PASS, exit 0, and no fake secret appears in any output.** The suite itself was run under `/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I`.
- **Exec cases:** happy path; extra keys dropped (`OTHER_KEY`, `NODE_OPTIONS`, `HTTPS_PROXY`, `NODE_USE_SYSTEM_CA`, `OPENSSL_CONF`, `TS_NODE_PROJECT`); window-open edge at 14:03:00 (slept 125 s); and the real pinned G3 on canonical `web/` (`match`, `uncovered: []`). Each makes exactly one execve with the exact argv, cwd `web/`, exactly the 8 allowlisted keys and the right value digests, at or after 14:05:05Z.
- **Refusal cases**, each with zero execve calls:
  - `NST_JOB_LIFECYCLE_ENABLED` in the file (`false` and `true`) and in the launcher env;
  - `DYLD_*` in the launcher env and in the file;
  - a duplicate key, a missing key, an empty key, an origin mismatch, an inline-comment value and an unreadable env file;
  - 14:02:59, 14:05:00 and 11-18;
  - G3 too slow for the exec window, G3 refusing, and a G3 tool-pin mismatch;
  - a receipt that is 0644, relative or missing;
  - a missing ledger directory.
- **No retry:** a failing execve is attempted once, then refuses.
- **Real interpreters:** with `DYLD_PRINT_LIBRARIES=1`, the CLT python refuses and the SIP stub purges it, so node gets the allowlist only.
- **argv contract:** no args, an extra arg and `--check` all refuse with `usage`.
- **RECHECK-8 additions (15 cases):**
  - env file as a symlink, 0640, a FIFO or a directory → `env_file_not_private_regular_file`;
  - an existing lock → `launcher_lock_exists`, also before any env-file read; a missing lock directory → `launcher_lock_unavailable`; out of window, no lock is created;
  - the real script without `-I` → `not_isolated`, and with a `hashlib.py`/`json.py` on `PYTHONPATH` also `not_isolated`, with no marker and no traceback; with `-I`, `PYTHONPATH` is ignored (`outside_start_window`, no marker);
  - a symlinked interpreter path → `unexpected_interpreter`;
  - `DEVELOPER_DIR` set: the bare shim command is redirected (marker written), while the documented `env -i` command runs the real launcher (no marker, `outside_start_window`);
  - every exec case logs `pythonIsolated: true` and `pythonExecutable` = the CLT python, and writes a lock holding only `pid` and `takenAtUTC`.
- **Production path:** the test asserts the constants `main()` uses: `ENV_FILE` = `web/.env.local`, `WEB`, `NODE` = `/usr/local/bin/node`, the origin, the G3 pins, the five slot times, and that `launch()` defaults to the real `os.execve` and the real G3. It then runs the **real `main()`** (real clock, real `getconf`, real ledger check) with a scratch 0600 receipt: `outside_start_window`, exit 2, before any env file is opened. A seam case also confirms that an absent env file still gives `outside_start_window` outside the slot.
- **Exec stub:** the stub is a node script, not python, because the `/usr/bin/python3` shim injects its own variables; node adds only `__CF_USER_TEXT_ENCODING`. The keys handed to `execve` are asserted to be exactly the 8 allowlisted keys.

**Additions beyond the approved list (for Chef and TJ to accept or strip):**
- **G3 inside the launcher** (gate 7): a second node process at about 14:05:05Z. §3b already said "the launcher must run it too".
- **Receipt privacy** (gate 2), the **origin pin** and the **value-shape refusal** (gate 5).
- `value_shape_suspect` is also in probe v2 (`246bf6b4…`), so the T−1 probe predicts it rather than meeting the real file for the first time at the slot.

**Hash coupling:** the launcher pins the expected interpreter path, the lock path, the G3 tool `912041a5…` and baseline `4534fd65…` and the 2026-11-17 date. Any G3 change, a re-baseline or the 11-18 contingency means a new launcher hash and a new approval.

**What `dyldKeysPresent` means where (RECHECK-7 Low):**
- G3's stdout field describes only **the checker's own** environment, which is always `PATH` + `TMPDIR`, so it says nothing about the capture launch.
- The capture-side evidence is the launcher's exec line, which reports the env keys it passed to `execve` and `dyldKeysPresent: false`, written after the env-file `DYLD_*` gate. That line is recorded in the attestation's `launcher.*`.

## 2. Credential-free checks already run (operator, 2026-11-15)

All checks ran under `env -i` with `TMPDIR` set to scratch, from `web/`. Outputs are in `evidence/`.

| Check | Result |
| --- | --- |
| Bootstrap `--check` (**expired bootstrap `d4d2fcac…`, slot 11-13**) | exit 0; `sourcePinsMatched 9`, `project "unset"`, `lifecycle "disabled"`, `networkRequests 0`, `outputCreated false`; scratch `TMPDIR` stayed empty. `evidence/check-expired-bootstrap-env-i.json` sha256 `268b4e50…61df`. **Must be re-run on the successor hash**; this run proves only the mechanism |
| Node | `/usr/local/bin/node` v22.23.4 darwin arm64, SHA-256 `daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef` (matches pin) |
| TLS stack | OpenSSL 3.5.9 (static, `node_shared_openssl=false`), Undici 6.29.1, default min TLSv1.2 / max TLSv1.3 |
| CA set | `tls.getCACertificates`: default = bundled = 116 roots; system 0; extra 0. My method, sha256 of the roots joined by `\n`: `5aab51f9…024c`. The 11-12 record's `98c3b150…5dd9` was **not reproduced**: its serialization is not recorded, and four tried serializations differ. Because the Node binary hash is identical and the roots are compiled into it, no drift is implied; the hash itself is unconfirmed. `evidence/runtime-probe.cjs` sha256 `0a8ea7ac…1280` |
| Env in child | only `PATH`, `TMPDIR`, `__CF_USER_TEXT_ENCODING` (macOS adds it); `NODE_TLS_REJECT_UNAUTHORIZED` absent |
| Output parent | `/Users/tim/Library/Application Support` is user-owned 0700 (has an ACL `+`; the bootstrap does not check ACLs) and writable; no `fhfh-blsh*` child exists |

## 3. Presence-only probe: **TJ approved by pop-up; run once 2026-11-15 ~02:25Z on `.env.local`, PASS**

The hash was verified before the run. Output: `evidence/env-presence-probe-env-local.json`.

| Item | Result |
| --- | --- |
| `NST_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `present_nonempty` |
| `NEXT_PUBLIC_SUPABASE_URL` | `pinned` |
| `NST_JOB_LIFECYCLE_ENABLED` | `absent_disabled` |
| Duplicates, forbidden names | none |
| Bootstrap `--check` (expired bootstrap `d4d2fcac…`) | exit 0, `project "pinned"`, `lifecycle "disabled"` |
| Secrets passed to a child, values printed | none |

Re-run it at T−1 day on the successor bootstrap. The command below is the one that was approved.

- **File:** `tools/env-presence-probe.py`, sha256 `6c4df9aae79cf336815b2d7f54e53e7af803b3de028964a8c6b8d424e804cdcb`.
- **Command (exact):**

```bash
cd /Users/tim/Code/fhfhockey.com/web && env -i PATH=/usr/bin:/bin /usr/bin/python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/env-presence-probe.py .env.local
```

**What it does:**
- It reads `web/<file>` (allowlist: `.env.local`, `.env.production`, `.env.development.local`, `.env.development`).
- It reduces `NST_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to `present_nonempty` / `present_empty` / `absent`, then drops them.
- It reports `NEXT_PUBLIC_SUPABASE_URL` as `pinned` / `pinned_after_trim` / `mismatch` / `unset`, and `NST_JOB_LIFECYCLE_ENABLED` as `absent_disabled` / `present_disabled` / `enabled`.
- It lists duplicate capture-path keys and which forbidden override **names** appear in the file.
- It then runs the bootstrap `--check` with only the two **non-secret** values (URL, lifecycle flag) plus the loader vars, and scratch `TMPDIR`. **Secrets never enter a child process.**
- It refuses to print if any secret value appears in its own output. Output: one JSON line of enums only.

**Exit criteria:**
- **Pass:** both keys `present_nonempty`, project `pinned`, lifecycle `absent_disabled` (tightened; see §1), no duplicates, no forbidden names, `--check` exit 0 with `project "pinned"`. The 11-15 v1 run met all of these.
- **Anything else:** this operator choice fails. Report it to the parent; do not try another file without a new TJ yes.

Before running, `git diff` the probe against the hash above.

## 3a. T−1 probe v2: predicted `RUNTIME.json` checked by the bridge's own `checkRuntime` (written; **not run with credentials**)

v1 above is kept unchanged as the record of what TJ approved and what ran. For T−1, use v2, which adds a predicted `RUNTIME.json` checked by the bridge's own code. **It needs its own TJ pop-up**, with the exact command and hashes, at that time.

| File | sha256 |
| --- | --- |
| `tools/env-presence-probe-v2.py` | `246bf6b4…` (DYLD and value-shape refusals, candidate argument, fresh `mkdtemp` scratch; supersedes `dabbbd5b…`, `bf39d6ae…`, `6218eba8…`, `2177714d…`) |
| `tools/runtime-snapshot.cjs` | `1c246594…5d87` (v5 shape) |
| `tools/check-predicted-runtime.mjs` | `8d78225b…c979` (v5) |

**How v2 works:**
- After the v1 presence classification, it runs `runtime-snapshot.cjs` under the **launcher-shaped env**, which has no secrets. The snapshot runs with the exact `execArgv`, from `web/`, and builds a predicted `RUNTIME.json` with HANDOFF §3's exact keys:
  - `version`, `node.{version,execPath,execPathSHA256,execArgv}`;
  - `tls.{rootCertificatesSHA256,rootCertificateCount,defaultCACertificatesSHA256,defaultCACertificateCount}`, hashed with the HANDOFF method: sha256 of the certificates joined by `\n`;
  - `environmentPresence` with all 15 keys;
  - `supabaseOrigin`, `lifecycleMode`, `adapterEnvironmentPresence` and `valuesRecorded: false`.
- The two secret-key presence booleans come from the file probe. The secrets never enter the snapshot process.
- `check-predicted-runtime.mjs` then imports `checkRuntime` from the bridge's `convert.mjs`. It calls it with the `NODE_SHA256` pin read from the bootstrap passed as v2's second argument (the **successor** bootstrap at T−1), and `synthetic=false`.
- v2 `pass` requires the v1 criteria, `checkRuntime: "pass"` **and** `dependencyTree: "match"` (§3b), **no value-shape suspect** among the three capture-path values (`valueShapeSuspectKeys`, names only; the launcher's gate 5), and **no `DYLD_*` key** (prefix match) in the env file or in the probe's own environment (RECHECK-6 R3). It reports `dyldKeysInFile`, `dyldKeysInProbeEnv` (names only) and `dyldKeysPresent`. The G3 step inside the probe also runs `--loaded`.
  - **Limit:** `/usr/bin/python3` is SIP-protected, so macOS strips `DYLD_*` from its environment and `dyldKeysInProbeEnv` is always empty (tested). The env-file check is real; the own-environment checks that count are G3's (node sees `DYLD_*`) and the launcher's.
  - **Ordering:** v2 runs the bootstrap `--check` and the snapshot child, both of which execute tree code, **before** its G3 step. The verdict is unaffected (G3 still fails `pass`), but a tampered tree would run in those children first. Not reordered, because v2 is unrun and its hash is what the T−1 pop-up approves; the T−0 G3 command runs first on its own.
- **v5 additions to the prediction.**
  - `launch.*` is predicted for the launcher's **fixed** argv: `scripts/blsh/nativeProcessCaptureBootstrap.ts` from `web/`, so `entryScript` = `bootstrapPath` = `/Users/tim/Code/fhfhockey.com/web/scripts/blsh/nativeProcessCaptureBootstrap.ts`, `cwd` = `web/`. `launch.environmentPresence` is read from the real child env.
  - `globalDispatcher` is predicted by checking that the `undici.globalDispatcher.1` registry is **unset**, which is the bootstrap rule `bootstrap_global_dispatcher_preinstalled`. The tool then loads the pinned `cheerio`, which loads npm undici 7.29.0 and registers its default `Agent`, and reads `{present, constructorName, sameAsRunnerLoad}`.
  - The bridge is now called with its fifth argument: the expected bootstrap hash `_bootstrapSHA256` from `blsh-successor-candidate-2026-11-15/rehearsal/expected-pins.json` (`a2a1e694…`).
  - The verifier's dispatcher rule is applied locally: exactly `{present: true, constructorName: "Agent", sameAsRunnerLoad: true}`, and not preinstalled.
  - Tests: `evidence/DEPENDENCY-TREE-TESTS.md`, section "Predicted RUNTIME.json, v5 shape". With the expected bootstrap set to the canonical hash, the prediction **passes** both checks. Each injected fault vetoes with its own code: `TS_NODE_*` unlisted or listed, `OPENSSL_CONF`, system CA, lifecycle key, a preinstalled dispatcher, a non-`Agent` dispatcher. Against the v5 pins it vetoes `runtime_bootstrap_not_candidate` until `SUCCESSOR.patch` is applied in the canonical tree, which is correct.

**Command for T−1.** For TJ's pop-up then, not approved now:

```bash
cd /Users/tim/Code/fhfhockey.com/web && env -i PATH=/usr/bin:/bin /usr/bin/python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/env-presence-probe-v2.py .env.local /Users/tim/Code/fhfhockey.com/web/scripts/blsh/nativeProcessCaptureBootstrap.ts
```

**Coverage of `checkRuntime`, tested credential-free on 2026-11-15.** These tests used the public URL only, with hand-set presence booleans, under `env -i` with scratch `TMPDIR`. Each fault was injected alone:

| `checkRuntime` condition | Injected fault | Result |
| --- | --- | --- |
| baseline (all conditions) | none | **pass**; pin `daa77e22…` = `execPathSHA256`; roots = default = 116, `5aab51f9…024c` |
| all 15 override keys false | `NODE_USE_SYSTEM_CA=1` / `NO_PROXY=localhost` / `NODE_EXTRA_CA_CERTS=<pem>` | veto `runtime_override_env_present` (each) |
| default CA = bundled roots | extra CA, with its presence flag masked so this check fires alone | veto `runtime_default_ca_store_not_bundled` (117 ≠ 116) |
| pinned origin, disabled mode | `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co` | veto `runtime_receipt_incoherent` |
| lifecycle key absent | `NST_JOB_LIFECYCLE_ENABLED=false` | veto `runtime_adapter_environment_shape` |
| 3 credential keys present | `NST_KEY` presence false | veto `runtime_adapter_environment_absent` |
| `execArgv` allowlisted, `execPathSHA256` = `NODE_SHA256` | not injected. Both are also enforced exactly by bootstrap `--check`, which v2 runs; `--check` is stricter, since the bridge also allows `[]` | covered by `--check` |
| `valuesRecorded` false, `startedAtUTC` binding, `version` | runner-written only; cannot be predicted before the run | verifier checks after the run |

**Limits:**
- The snapshot runs in a process **without** the two secrets. Their presence does not affect `environmentPresence` or CA state, so the prediction holds for them.
- The real run's values are what `RUNTIME.json` records. This remains pre-approval evidence only.

## 3b. Packet gate G3: dependency-tree hash (TJ chose "hash the dependency tree")

The tool is `tools/dependency-tree-hash.mjs` (sha256 `912041a513f0dabf034797d6c4d93fcb2a22ded6d2019f44463ce82f56103bf4`; supersedes `274f9969…` after RECHECK-6 R0). It is offline and read-only: no `npm ci`, no install, and nothing in `node_modules` is touched.

**R0: the checker runs nothing from the tree before hashing it (RECHECK-6).** `274f9969…` required `typescript` from the checked tree before hashing anything, so a forged `typescript.js` could print a forged `match` (the reviewer's `tsforged` case). Now:
- **Pin outside the tree.** The tool holds `TYPESCRIPT_PIN`: `node_modules/typescript` 5.7.3, 129 files, package sha256 `3556c8c4764b5c0bd2276af5ccac31352355dd24caab158a7065f68adb1956fd`, entry `lib/typescript.js` sha256 `0fba5508ecbe50cd00a45f132a76582fb22a4ec55769fd3d794fd0e026f9fb67`. It equals the `4534fd65…` baseline record, and RECHECK-6's `provenance.py` found typescript 5.7.3 byte-identical to its lockfile tarball.
- **Hash first, with builtins only.** Before any parsing, the tool hashes the whole `node_modules/typescript` directory (which must be a plain directory, not a symlink) and compares it with the pin, in generate mode as well as compare mode.
- **Run only the hashed bytes.** It compiles the exact Buffer it hashed (no second disk read) with `vm.compileFunction` and a `require` that serves Node builtins only. typescript's optional `require("source-map-support")` therefore cannot load from the tree.
- **Baseline consistency.** In compare mode, a baseline whose typescript record differs from the pin refuses (`baseline_typescript_differs_from_tool_pin`).
- **Listing child gated.** `--loaded` spawns its listing child (which loads ts-node, typescript and the capture modules from the tree) **only after** the tree, pins and bootstrap have matched. Otherwise it records `loaded_listing_skipped_tree_refused`, so tampered tree code is never executed, even in the child.
- **DYLD.** Any `DYLD_*` key in the checker's own env refuses (`dyld_env_present`).
- **Output.** Compare-mode stdout now carries `startedAtUTC`, `finishedAtUTC`, `checkerTypeScript: "verified_before_load"` and `dyldKeysPresent: false`. The manifest schema is unchanged: regenerating the baseline gives a byte-identical `4534fd65…`.

**What it hashes:**
- **Starting set:** the four bootstrap `DEPENDENCIES` (ts-node, typescript, cheerio, memory-cache), plus every runtime bare import reachable from the v4 bootstrap and its nine `SOURCE_PINS` roles.
  - Imports are read from the TypeScript AST. Type-only forms are ignored: `import type`, `export type` and `import("next")` types.
  - Imports are followed through the 10 local files that are walked.
  - The only bare runtime imports are `cheerio` (runner) and `memory-cache` (client). `next` is type-only.
- **Package walk:** each package's `dependencies` and `optionalDependencies`, resolved like Node: nearest `node_modules`, walking up from the requirer's real directory. A package resolved outside `web/node_modules` refuses. `peerDependencies` are recorded but not walked; only ts-node has them: `@swc/core`, `@swc/wasm`, `@types/node`, `typescript`.
- **Per package:** every regular file is hashed, sorted by relative path; per-package sha256 = sha256 of `path\0sha\n` lines.
  - Nested `node_modules` are skipped. They are separate packages, hashed only if they are in the closure.
  - A symlink outside `web/node_modules` refuses.
  - `web/node_modules/node_modules`, the pre-existing self-symlink, is recorded as excluded with its reason.
- **Tree hash:** sha256 of the sorted `path\tname@version\tfiles\tsha` lines.
- **Pin checks:** it re-checks that the four `DEPENDENCIES` entry and manifest hashes still equal the bootstrap's pins, and that the nine role pins match.

**Baseline, v5** (`evidence/DEPENDENCY-TREE-BASELINE.json`, sha256 `4534fd65c30d7c6e86ac84fd0664074074c039980ba207d5f5928277a52c1bb3`, also in `.sha256`). The v4 baseline `e278b666…` is kept in `evidence/superseded/`.
- **Inputs:** v5 sources read from a scratch `git archive` of `a9551076` with `SUCCESSOR.patch` `e8be50de…` applied; real `web/node_modules`.
- **Closure:** **42 packages, 1,634 files**, tree sha256 **`76c7d466725ea13208b87adfb5ac6688a42454b66382996fbd9a7ab36432473a`**, unchanged from v4 because v5 changed no imports. Only the baseline's `sources` block differs: the bootstrap and runner hashes.
- **The live transport is covered.** v5 HANDOFF says npm **undici 7.29.0** is the live transport, loaded by cheerio when the runner loads. It is in the closure: `node_modules/undici`, 210 files, package sha256 `3f7368898f81b9ac6681e9ad93ce00addc7a5fa0ab8543692b2f174a6c497058`, required by `node_modules/cheerio`. `cheerio/dist/commonjs/index.js` requires it and it resolves to `node_modules/undici/index.js`, not Node's bundled 6.29.1. The bootstrap's `DEPENDENCIES` still pins only cheerio's entry, so G3 is the only pin on undici's bytes.
- **Pins:** all 4 dependency pins and all 9 role pins match.
- **Determinism:** regenerating gives a byte-identical file. Paths are relative and the file contains no secrets.

**Gate at T−1 and T−0.**
- **T−1:** probe v2 runs `node dependency-tree-hash.mjs --web web --sources <dir of the bootstrap given> --baseline evidence/DEPENDENCY-TREE-BASELINE.json --loaded` with env `PATH` + scratch `TMPDIR` only. Anything but `match` makes `pass: false`.
- **T−0:** the operator runs the same command with `--loaded`, which is credential-free and needs no pop-up, immediately before the launcher, at about 14:03Z. Its stdout is saved verbatim (§3c).
- **T+0 (RECHECK-6 R2):** the operator reruns the **identical** command immediately after the capture exits and saves its stdout verbatim (§3c). Conversion requires `match` with `loaded.uncovered: []` at **both** T−0 and T+0. This closes the check-to-launch and run-time windows to the extent of "the tree was the same before and after"; a swap-and-restore inside the run is not detectable from outside the process.

  ```bash
  cd /Users/tim/Code/fhfhockey.com/web && env -i PATH=/usr/bin:/bin TMPDIR="$(mktemp -d)/" /usr/local/bin/node /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/dependency-tree-hash.mjs --baseline /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/DEPENDENCY-TREE-BASELINE.json --loaded
  ```

  `match` with `loaded.uncovered: []` is required. The launcher runs the same check again at about 14:05:05Z, immediately before `execve` (§1a gate 7). The scratch `TMPDIR` keeps the listing process away from the real NST ledger.
- **Refusals in compare mode:** any added, removed or changed package; a pin mismatch; role pins not matching; a bootstrap differing from the baseline's bootstrap; an unresolved dependency; a symlink outside the tree; `typescript_package_hash_mismatch`, `typescript_entry_hash_mismatch`, `typescript_version_not_pinned`, `typescript_not_plain_directory` (all before any tree code runs); `baseline_typescript_differs_from_tool_pin`; `dyld_env_present`; `loaded_file_uncovered:<path>`; `loaded_listing_skipped_tree_refused`.
- **Canonical tree today (applied v5, bootstrap `dbf69c47…`).** The T−0 command run on canonical `web/` at 2026-11-15T18:29Z printed `match`, tree `76c7d466…`, 256 loaded, `uncovered: []`, exit 0. The earlier note that canonical refuses until the patch is applied is obsolete: the patch has been applied.

**Tests** (credential-free, `env -i`; mutations only in a scratch copy of the closure): see `evidence/DEPENDENCY-TREE-TESTS.md`. `tools/test-g3-r0.sh` asserts 20 cases on the current tool `912041a5…`: the R0 cases (tsforged with and without `--loaded`, an unconditional canary prologue in compare and generate modes, symlinked typescript, DYLD) and **every earlier mutation case rerun**. Result: 20/20 PASS, exit 0. The reviewer's unchanged `repro/recheck6/g3-self-check.sh` now gives control `match`, undici `refuse`, tsforged `refuse`.
- An unmodified copy gives `match`, also in the probe's `--web --sources --baseline --loaded` shape.
- Each of these refuses with the expected code: a 1-byte change, a symlink to `/etc/hosts`, an extra nested file, a pinned-entry change, a removed dependency, a new package required by a closure package, an unpinned role import and a NODE_PATH shadow.
- Probe v2 end to end is **not run**: it reads `.env.local` and needs TJ's pop-up at T−1.

**Loaded-file coverage (RECHECK-4 item 3, option 1).** `--loaded` launches `tools/list-loaded-modules.cjs` exactly like the bootstrap: same cwd, `env -i` loader env, pinned ts-node register. It loads the bootstrap, preparation, runner and adapter modules, never calling the factory or dispatching, and classifies every `require.cache` file:
- a v5 role, with its hash checked against the pin;
- the candidate bootstrap, hash-checked;
- a file inside a G3 package directory;
- the harness;
- or **uncovered**.

Any uncovered file refuses (`loaded_file_uncovered:<path>`).

**v5 result:** 256 files loaded: 9 roles, 1 bootstrap, 245 package files in 34 package paths (32 names) and 1 harness. **Uncovered: none.** Fifteen capture-loaded builtins are reported. The G3 baseline is unchanged (`4534fd65…`). Evidence and tests: `evidence/LOADED-MODULES-COVERAGE-v5.json`, `evidence/DEPENDENCY-TREE-TESTS.md`.

**Limits:**
- **Point in time.** The checks bind the files on disk at T−0 and T+0. A change that is made after T−0 and undone before T+0 is not detectable from outside the process; load-time hashing would need runner code.
- **Capture-side typescript.** In the capture process, ts-node's register loads `typescript` before the bootstrap's own `DEPENDENCIES` check runs (RECHECK-6). G3's typescript pin at T−0 and T+0 covers this by custody only; an in-process fix belongs to the capture lane.
- **Lazy loads.** Lazily required files appear only if loaded at import time. Lazy loads from inside a closure package (e.g. undici internals on first request) resolve within hash-covered directories. A lazy load from outside the closure would need code in a covered file, which the tree hash would catch.
- **Builtin monkeypatching** (e.g. wrapping `tls.connect`) is closed only to the extent that every loaded file is pinned: there is no unpinned code in the process.

## 3c. Operator attestation: G3 at T−0 and T+0, DYLD (RECHECK-6 R1, R2, R3)

G3 runs in its own process, outside the packet, so the bridge cannot verify it. Since 2026-11-15 the bridge lane's post-capture gate (`post-capture/check-attestation.mjs`, that lane's file) also reads this attestation, beside `operator-attestation.py check`. It must unwrap `launcher.g3Line` as described in §1a gate 7 (RECHECK-11 C1, the bridge lane's fix). `verify-packet.mjs` and `checkRuntime` do not read it, so there is no key set to collide with. Its standing is custody, like the bootstrap's empty-registry rule.

**Where:** `tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation/`, created at T−0. Never in the capture output directory.

**T−0 (about 14:03Z) and T+0 (right after the capture exits), the identical command each time:**

```bash
A=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation; P=T-0; mkdir -p "$A"
shasum -a 256 /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/dependency-tree-hash.mjs /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/DEPENDENCY-TREE-BASELINE.json > "$A/g3-$P.inputs-sha256"
cd /Users/tim/Code/fhfhockey.com/web && date -u +%Y-%m-%dT%H:%M:%SZ > "$A/g3-$P.shell-start-utc" && env -i PATH=/usr/bin:/bin TMPDIR="$(mktemp -d)/" /usr/local/bin/node /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/dependency-tree-hash.mjs --baseline /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/DEPENDENCY-TREE-BASELINE.json --loaded > "$A/g3-$P.stdout"; echo $? > "$A/g3-$P.exit"; date -u +%Y-%m-%dT%H:%M:%SZ > "$A/g3-$P.shell-end-utc"
```

At T+0 the same line runs with `P=T+0`. `env -i` keeps the outer shell's `DYLD_*` and `NODE_*` keys away from the check.

**Required, each time:** exit `0`, and the stdout is exactly one JSON line with `dependencyTree: "match"`, `treeSHA256` and `baselineTreeSHA256` both `76c7d466725ea13208b87adfb5ac6688a42454b66382996fbd9a7ab36432473a`, `checkerTypeScript: "verified_before_load"`, `dyldKeysPresent: false`, `loaded: {files: 256, roles: 9, bootstrap: 1, packageFiles: 245, packages: 34, builtins: 15, uncovered: []}` and `differences: []`. Today's canonical stdout has this shape (§3b).

**`attestation/OPERATOR-ATTESTATION.json`** (written after T+0; names only, never values):

| Field | Content |
| --- | --- |
| `version` | `fhfh.blsh.operator-attestation.v1` |
| `operator` | `claude-nst-operator.local_017907a3` |
| `g3.tool` | `{path: "tools/dependency-tree-hash.mjs", sha256}` from `g3-T-0.inputs-sha256` and `g3-T+0.inputs-sha256` (both must equal the TJ-approved hash) |
| `g3.baseline` | `{path: "evidence/DEPENDENCY-TREE-BASELINE.json", sha256: "4534fd65…1bb3"}`, from the same files |
| `g3.tMinus0` / `g3.tPlus0` | `{shellStartUTC, shellEndUTC, exitCode, stdout (the exact line, verbatim), stdoutSHA256}` |
| `g3.bothMatch` | `true` only if both runs meet "Required" above |
| `launcher` | `{sha256, execLine (the verbatim `"launcher":"exec"` line), g3Line (the launcher's verbatim **wrapper** line; the G3 JSON is its `stdout` field), dyldKeysPresent: false, dyldKeysInEnvFile: [], dyldKeysInLauncherEnv: [], operatorShellDyldCount: 0}` (from `attestation/launcher.log` and the builtin check in §1a) |
| `capture` | `{exitCode, startedAtUTC, endedAtUTC}` as observed by the operator; the authoritative values are in the packet |
| `custodyNote` | "G3 and the DYLD check ran outside the capture process; operator-attested, not bridge-verifiable." |

**Tooling (2026-11-15):** `tools/operator-attestation.py` (`write --dir`, `check`) builds this record from the files above and applies the rule below, recomputing every verdict from the verbatim stdouts and log lines. `tools/write-authorization-receipt.py` writes the bootstrap's authorization receipt. The day-of order is in `RUNBOOK.md`, rehearsed by `tools/dress-rehearsal.sh`.

**Ordering (RECHECK-11 B2):** `check` also requires T−0 G3 to end at or before the exec `atUTC`, and T+0 G3 to start at or after `capture.endedAtUTC`.

**Candidate binding (2026-11-15, Chef's decision):** `check --candidate v5-1117|v5-1118` binds the exec line to the real capture: `argv0` `/usr/local/bin/node`, `cwd` the canonical `web/`, and an exec time inside the candidate date's 14:05:00–14:05:50Z window. It takes the candidate from its own argument, never from the file. Only the dress rehearsal relaxes `argv0` and `cwd`, through the `check()` function's `expect` seam; the CLI cannot.

**Conversion rule:** no conversion unless `g3.bothMatch` is `true` and `launcher.dyldKeysPresent` is `false`. **Whoever runs `convert.mjs` on the pilot packet receives `OPERATOR-ATTESTATION.json` and checks both fields first** (RECHECK-7 precondition). A T+0 refusal quarantines the packet: report to the parent and verifier, no retry and no second live run.

## 4. Pre-approval evidence at T−1 day (after the successor exists and TJ approves the launcher)

**Not the runtime receipt.** The authoritative receipt is the runner's in-process `RUNTIME.json` (§4a).

`PREAPPROVAL-RUNTIME-EVIDENCE.json` (private copy outside the repo; a sanitized copy in this folder) records these **non-secret** items. It lets TJ approve a candidate whose configured process demonstrably exists.

The probe and `--check` steps load credentials only through the exact command TJ approves by pop-up at that time. The 11-15 approval covered one run of the probe on the expired bootstrap and does not carry over.

1. Successor bootstrap `--check` output under the launcher's exact env, but with the two secret keys **withheld**. `--check` reads neither; the adapter's presence assert runs only in `--run`. Expect `project "pinned"`, `lifecycle "disabled"`, 9 pins.
2. Presence probe v2 result (§3a): the predicted `RUNTIME.json` and its `checkRuntime` verdict.
3. Launcher sha256, probe and tool sha256s, bootstrap/runner/adapter sha256.
4. Beyond the predicted `RUNTIME.json` fields: OpenSSL and Undici versions, TLS min/max, system/extra CA counts, child env **key names** (expected: the 9 above + `__CF_USER_TEXT_ENCODING`).
5. `TMPDIR` value and the existence/mode of the ledger dir (stat only; contents never read).
6. Output path absent; parent 0700, user-owned.
7. Statement: no `NODE_TLS_REJECT_UNAUTHORIZED`, CA, proxy, `OPENSSL_CONF` or preload overrides; default certificate and hostname verification.

**TLS boundary:** this evidence proves the **defaults and the absence of overrides** before the run only. It does not prove a verified TLS session with NHL, Supabase or NST, and it must never be cited as `TLSVerified` provenance.

## 4a. Authoritative in-process receipt (owned by the successor runner, not this lane)

- **Location:** `RUNTIME.json` inside the packet directory, written by the runner and bound to `STARTED.startedAtUTC`.
- **`RUNTIME.json` fields (HANDOFF §3, exact):**
  - `version` = `fhfh.blsh.native-capture-runtime.v1`, `startedAtUTC` = `STARTED.json.startedAtUTC`;
  - `node.{version, execPath, execPathSHA256, execArgv}`;
  - `tls.{rootCertificatesSHA256, rootCertificateCount, defaultCACertificatesSHA256, defaultCACertificateCount}`;
  - `environmentPresence.{NODE_EXTRA_CA_CERTS, NODE_TLS_REJECT_UNAUTHORIZED, NODE_OPTIONS, NODE_USE_SYSTEM_CA, NODE_USE_ENV_PROXY, SSL_CERT_FILE, SSL_CERT_DIR, HTTPS_PROXY, HTTP_PROXY, ALL_PROXY, NO_PROXY, https_proxy, http_proxy, all_proxy, no_proxy}`, all `false`;
  - `supabaseOrigin`, `lifecycleMode` = `disabled`;
  - `adapterEnvironmentPresence.{NST_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL}` = `true` and `.NST_JOB_LIFECYCLE_ENABLED` = `false`;
  - `launch.{entryScript, entryScriptSHA256, cwd, bootstrapPath, bootstrapSHA256, entryIsBootstrap, environmentPresence, otherTsNodeKeysPresent}`. Required: `entryIsBootstrap` true; `cwd` = `/Users/tim/Code/fhfhockey.com/web`; `launch.environmentPresence` with `NODE_PATH`, `DISABLE_V8_COMPILE_CACHE`, `TS_NODE_COMPILER_OPTIONS` true; `OPENSSL_CONF` and every other listed `TS_NODE_*` false; `otherTsNodeKeysPresent` = `[]`;
  - **v5:** `globalDispatcher.{present, constructorName, sameAsRunnerLoad}`, exactly `{true, "Agent", true}`;
  - `valuesRecorded` = `false`.
- **Per-operation TLS facts (HANDOFF §2, exact):**
  - `operation-N-SETTLED.json.tls` for all five operations, mirrored in `{schedule,individual,onIce}.TRANSPORT-OBSERVATION.json.tls`.
  - Fields: `channel`, `authorized`, `authorizationError`, `servername`, `alpnProtocol`, `protocol`, `cipher.{name,standardName,version}`, `sessionReused`, `connectionReused`, `connectionSequence`, `resumedFromOperation`, `connectionFromOperation`, `peerCertificate.{fingerprint256, valid_from, valid_to, subjectCN, issuerCNChain}`, `defaultCACertificatesSHA256` (v4: must equal `RUNTIME.json.tls.defaultCACertificatesSHA256`), and **v5** `globalDispatcher.{present, constructorName, identityUnchanged}` (must be `{true, RUNTIME's constructorName, true}`).
  - `peerCertificate` is `null` only on a resumed session, which must bind via `resumedFromOperation` to an earlier full handshake for the same `servername` (in this order, 4→2 and 5→3).
  - Keep-alive reuse binds via `connectionFromOperation`.
  - `TLSVerified` stays `null`; the bridge decides.
- **Two TLS failure signatures (HANDOFF §2):**
  - `capture_tls_observation_missing`: the operation is left STARTED with no SETTLED file, i.e. uncertain and possibly dispatched.
  - `tls_observation_missing`: SETTLED has `tls: null`, and the run stops.
  - Either one is final for the slot; no retry.
- **v5 dispatcher and CA refusals** (from HANDOFF; each is final for the slot):
  - `bootstrap_global_dispatcher_preinstalled`: a dispatcher was registered before the bootstrap's imports.
  - `global_dispatcher_not_runner_load_default`: at run start, before any output.
  - `global_dispatcher_changed_before_dispatch`: the request is not sent.
  - `global_dispatcher_changed`: after settlement.
  - `ca_store_changed_before_dispatch` / `ca_store_changed`.
  - The verifier vetoes `runtime_global_dispatcher_invalid` and `operation_N_global_dispatcher_changed`.
- **Operator implication:** the launcher must not preload, register or wrap any undici dispatcher. No `--require` beyond ts-node is allowed (the exact `execArgv`), and `NODE_OPTIONS` is forbidden. §3a's prediction checks that the registry is empty before the imports.
- **Operator's job:** after the run, the operator compares `RUNTIME.json` with the §3a predicted `RUNTIME.json`, field by field:
  - `node.*`, `tls.*`, `environmentPresence`, `adapterEnvironmentPresence`;
  - plus `TMPDIR` and the launcher/bootstrap/runner/adapter hashes.

  It reports any difference to the verifier as a **veto**, not a fix. The independent verifier, not the operator, decides acceptance.

## 5. Not done, and why

- Apart from the one approved probe of `.env.local` (§3), no env file was opened, sourced or listed. Nothing was sourced into a shell or exported.
- No adapter factory, no `--run`, no network call.
- The launcher (§1a) was tested offline only: never with `web/.env.local`, never executing the real bootstrap, and never live.
- The successor v5 bootstrap (`dbf69c47…`) is now applied in canonical `web/` (not by this lane), and G3 matches it (§3b). Its credential-free `--check` and the §3a prediction have **not** been rerun on canonical by this lane since the apply; both are T−1 steps. It carries date 2026-11-11, slot 2026-11-17T14:05Z and output `…20261117T140500Z`, consistent with this plan.

## 6. Receipt IDs (must match `^[A-Za-z0-9._:-]{1,200}$`)

| Field | ID |
| --- | --- |
| `operator` | `claude-nst-operator.local_017907a3` |
| `runtimeReceipt` | `blsh-preapproval-runtime-20261116.<sha12 of PREAPPROVAL-RUNTIME-EVIDENCE.json>`. The authorization receipt requires this field before the run, so it can only reference pre-approval evidence. The in-process `RUNTIME.json` is produced later and is bound inside the packet |
| `coordinationReceipt` | `blsh-slot-20261117T1405Z.tminus.<sha12 of the T-minus record>` |
| `admissionReceipt` | see ADMISSION-CONTROL §5 |

## 7. File hashes (2026-11-15, after the RECHECK-6 fixes)

| File | sha256 |
| --- | --- |
| `tools/env-presence-probe.py` (v1; the file TJ approved and that ran) | `6c4df9aae79cf336815b2d7f54e53e7af803b3de028964a8c6b8d424e804cdcb` |
| `tools/env-presence-probe-v2.py` (DYLD and value-shape refusals; candidate argument; not run with credentials) | `246bf6b43d3282693ea71f1f4509a7eb4398585342d746aa4d41e4b4608e7867` |
| `tools/dependency-tree-hash.mjs` (R0: typescript verified before load; listing gated; DYLD) | `912041a513f0dabf034797d6c4d93fcb2a22ded6d2019f44463ce82f56103bf4` |
| `tools/write-authorization-receipt.py` (receipt writer; mirrors `readAuthorization`; `--candidate v5-1117\|v5-1118`) | `5e2060596446d1813ac80fb03a9f14b839903874dbf3651b631ef3242129e469` |
| `tools/operator-attestation.py` (attestation writer + conversion check, §3c; candidates; binds `argv0`, `cwd` and the date) | `de0982a6bb6be1afc591cabc5a3e8fcbb80e674897f51c8eb5c7be66d023762b` |
| `tools/dress-rehearsal.sh` (RUNBOOK rehearsal, 1117 and 1118) | `49377aa0a6f71be30df66597401cfadef574802bcf6101ca691d13b3aae1d70a` |
| `tools/preapproval-runtime-snapshot.cjs` (§4 items 4 and 7) | `fd9019e3e1a24d47ef5366b3bc04fee128c45290ee69f955faf40f37139b9da0` |
| `tools/egress-connect-check.mjs` (T−1.5 connect-only; tests `32abcddc75c74e717e565b3644a4966766dd352ce215188843a9105a9ae955bf`) | `c61c7fe7bfa65df9f26dca8c0ba072e4697c642596cb508deb76b95d0af05d4f` |
| `tools/nst-pilot-launcher-1118.py` (11-18 fallback; RUNBOOK §8) | `2670353dff80d47a642fd657cfa22449a703acdbc6068a33971692f2621cd444` |
| `evidence/DEPENDENCY-TREE-BASELINE-1118.json` (fallback bootstrap `849009ee…`) | `e9c7ec5a8afc627c231331a7c7ace6488064ee414244947a078325b7a4ccd7e9` |
| `tools/nst-pilot-launcher.py` (the launcher, §1a) | `31c370c3110ddb5d4cf90e730e9650639e36bd442959f7a7c791bbc28926197b` |
| `tools/test-nst-pilot-launcher.py` (49 offline cases; optional variant `1118`) | `33aa7cb4730199af4391b0570d8b2eedf0ef944cb2f461754fd7cc73e796f0c7` |
| `tools/test-g3-r0.sh` (20 asserted G3 cases; exits 1 on any mismatch) | `7d711e2ecdfc9a9df099965135a840387bc86e6cc1eaac1fdb8c6a5444918fb9` |
| `tools/list-loaded-modules.cjs` | `b47e0a67fff8b7e694c35444c6f76eaa3ed01f5b8a33ddd4711e57280c4f4e1c` |
| `evidence/LOADED-MODULES-COVERAGE-v5.json` | `99f37b90c4047cb6771bcb77fc8dd799841a0a258d92eb444d471b52379d4cb0` |
| `evidence/DEPENDENCY-TREE-BASELINE.json` (v5) | `4534fd65c30d7c6e86ac84fd0664074074c039980ba207d5f5928277a52c1bb3` |
| `evidence/superseded/DEPENDENCY-TREE-BASELINE-v4.json` | `e278b666ad6d3a27b7079bb30b7648e2d2ab86413160890aa77d29412a975836` |
| `tools/runtime-snapshot.cjs` | `1c24659496adf0c79614152d5454ae4595aa5b2254f2a6d17342cda59e087d5f` |
| `tools/check-predicted-runtime.mjs` | `8d78225bc0c9309f5b57030f4000c5abcea5215548f3181b1ebc4e8f9a65c979` |
| bridge `convert.mjs` (imported, read-only; the bridge lane changes it, so re-check at T−1) | `54e3d6247000d1d23f64fed4eb90025fad50713fc297687857acf6bf88ca57e8` |
| successor `rehearsal/expected-pins.json` (v5) | `a2a1e694dfa79ba9ebc110a3e45a249540b739c0061e0558fc6887e0f30367d1` |
| successor `SUCCESSOR.patch` **v5** (G3 baseline sources; supersedes v4 `66b4eb30…`, v3 `40dd64bc…`) | `e8be50de132887be4e4c33b086003a1f639ba554f23c85f08d27d5a780d7752f` |

The hashes of this file and OPERATOR-ACCEPTANCE.md are reported to the parent; they are not recorded here, because a file cannot contain its own hash.
