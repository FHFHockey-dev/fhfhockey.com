# RECHECK-8: pilot launcher review, the last R3 item (2026-11-15)

Offline and read-only. I never ran the launcher against `web/.env.local` or the real bootstrap. Its real `main()` ran in two ways, both on today's date (2026-11-15), and both refused `outside_start_window` before any env-file read: through Chef's test, and directly in my `-I`/`PYTHONPATH` probe. Nothing outside this review folder and my diary was written. Scratch: `$S/r8t`, `$S/r8p`, `$S/r8i`.

## Verdict

**NOT CLOSED, on one documentation fix.** The launcher's code passes, but the documented invocation does not guarantee the reviewed interpreter.
- **The cause.** `/usr/bin/python3` is an xcode-select shim, and it honours `DEVELOPER_DIR`. That key is not `DYLD_*`, so neither SIP nor the builtin `export -p | grep DYLD_` check catches it.
- **The test.** `DEVELOPER_DIR=<scratch>/fake /usr/bin/python3 -I -c …` ran a marker-writing fake `xcrun` instead of python (marker written). An attacker-controlled interpreter could then exec node with any environment, including `DYLD_INSERT_LIBRARIES`, so the R3 control would be bypassed before the launcher's code ever runs.
- **The control.** With the same outer `DEVELOPER_DIR` set, `/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I -c …` ran the real `/Library/Developer/CommandLineTools/usr/bin/python3` (0 markers). `/usr/bin/env` is itself SIP-protected.
- **The fix** (no launcher change, so `1bc56fab…` stands): change the §1a and OPERATOR-ACCEPTANCE "One start" command to

  `/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I …/nst-pilot-launcher.py --run <receipt> > …/attestation/launcher.log 2>&1`

  Chef's suite already runs the launcher under a `PATH`-only environment (the real-`main()` case), and the launcher derives `TMPDIR` from `getconf`, so this is compatible. **R3, and with it RECHECK-4 precondition 2, close once that text is in place.** No re-review of the code is needed, only a check of the changed lines.

Everything else passes ((1)–(4) below). The remaining items are custody or Low and do not block. **Applying any Low fix that touches `nst-pilot-launcher.py` changes its hash and voids this review and TJ's approval of it.**

## Bytes checked (all match Chef's message)

`tools/nst-pilot-launcher.py` `1bc56fab…` (read in full, 206 lines), `tools/test-nst-pilot-launcher.py` `84ef919a…`, `RUNTIME-RECEIPT-PLAN.md` `64efd9be…` (§1a read in full), probe v2 `bf39d6ae…`, G3 tool `912041a5…`, baseline `4534fd65…`.

**Chef's suite, rerun by me in scratch** (`env -i`, `/usr/bin/python3 -I`): **34/34 PASS**, `failures: 0`, "fake secret seen in any output: False". This matches `g1-canonical/LAUNCHER-TESTS.log`.

**My own probes:** `repro/recheck8/edge-probes.py`, 15 cases through the launcher's own seams (fake clock, fake env file, recording `execve`, fake G3), plus the shell commands quoted in (3) and (5).

## (1) One exec only, inside the window; `.env.local` read only inside the start window. **PASS**

- **One exec per invocation.** The only `os.execve` is at line 183. A successful exec replaces the process. A failed one raises `OSError`, which `main()` turns into `unexpected_OSError` and exit 2, with no loop and no retry. Chef's `execve-fails-once` case shows exactly one attempt.
- **Exec window.** Gate 8 re-reads the clock after G3 and requires `[14:05:00, 14:05:50)Z` on 2026-11-17. My probes: exec at 14:05:49.999 → one exec; at 14:05:50.000 → `outside_exec_window`, 0 execs.
- **Start window.** Gate 4 requires `[14:03:00, 14:05:00)Z`. My probes: start at 14:04:59.999 → exec; at 14:05:00.000 → `outside_start_window`, 0 execs. The date is a constant, so 11-18 needs a new hash, as the plan states.
- **`.env.local` timing.** In code order, gate 4 (clock) comes before gate 5 (`parse_env_file`). Nothing earlier opens the env file: gate 3's `getconf` runs with `env={}`. Chef's real-`main()` case refuses `outside_start_window` today before any env-file open, and a seam case shows the same result with the file absent.
- **Across invocations (Low, informational).** The launcher has no lock, so two launchers started inside the window would each exec once. A second capture is still stopped by the runner: `mkdirSync(outputDirectory, { mode: 0o700 })` at `nativeProcessCaptureRunner.ts:269` is atomic and runs "before any network". I read this, and the v5 rehearsal's `repeat` rows (`RESULTS.jsonl` 23–24) show the sequential case: `EEXIST` on `mkdir`, `dispatched: []`, `networkAttempts: 0`, packet tree unchanged. The concurrent case is unverified. The operator's "one start" rule covers it procedurally. **(1) PASS is per invocation.**

## (2) Child env is exactly the 8 allowlisted keys; no value printed or put in argv. **PASS**

- **The child env** (lines 169–177) is `PATH`, `TMPDIR` (from `getconf`), `NODE_PATH`, `DISABLE_V8_COMPILE_CACHE`, `TS_NODE_COMPILER_OPTIONS`, plus the three file keys `NEXT_PUBLIC_SUPABASE_URL`, `NST_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Every probe that reached exec passed exactly 8 keys. In particular, `NODE_OPTIONS=--require …` in the file was silently dropped.
- **argv** is the fixed node, ts-node register, bootstrap and `--run`, plus the receipt path. No value appears.
- **Output.**
  - Log lines carry key names only (`envKeys`).
  - Refusal codes carry names only. `dyld_key_in_env_file:<names>` echoes names from the file, never values.
  - Unexpected exceptions print only the type name.
  - The G3 stdout that gets logged comes from a process with no credentials.
  - In all 15 of my probes, `valueInLogs` was `false`.
- **Scope: the launcher, plus what lands in `launcher.log` after exec.** node inherits stdout and stderr, so the capture's own output goes to `attestation/launcher.log`. The bootstrap prints only `JSON.stringify(result)` (a fixed state object) or the fixed line "BLSH bootstrap failed. Preserve any packet; no automatic retry.", because its `catch` swallows the error (`nativeProcessCaptureBootstrap.ts:141–149`). A Node crash before `main()`, such as a ts-node compile error, would print a stack trace: file paths and code, not env values. I read this; I did not run it.
- **Low (custody).** A process's environment is readable by same-user tools (`ps -E`). This comes with passing credentials through the environment, which the plan chose; same user only.

## (3) DYLD handling and G3 at gate 7. **PASS for the launcher code; the invocation needs `env -i` (see the Verdict)**

- **Stub purge.** `/usr/bin/python3` resolves to the CLT python 3.9.6 via the SIP-protected stub. `DYLD_FOO=1 /usr/bin/python3 -I -c …` sees 0 `DYLD_*` keys, both in RECHECK-7 and again now. Chef's "real interpreters" case shows node receiving the allowlist only.
- **Own-environment refusal.** It does fire when the keys are visible. Probe `own_env_DYLD` → `dyld_key_in_launcher_env:DYLD_INSERT_LIBRARIES`, 0 execs. Under the stub it is defence in depth, as documented.
- **Env-file refusal**, checked by my probes:
  - `export DYLD_INSERT_LIBRARIES=…` → refused;
  - `  DYLD_LIBRARY_PATH = /tmp ` → refused;
  - lowercase `dyld_insert_libraries=…` → accepted but dropped. It is not in the allowlist, and dyld only honours upper-case `DYLD_`.
- **Builtin shell check: claim verified.** In zsh 5.9 with `export DYLD_FOO=1`:

  | Check | Result |
  |---|---|
  | `export -p \| grep -c DYLD_` | 1 |
  | `/usr/bin/env \| grep -c DYLD_` | 0 |
  | `/usr/bin/printenv \| grep -c DYLD_` | 0 |
  | stub python | 0 |

  So the builtin is the only shell-side check that can see them. It is advisory, because the stub purges them anyway.
- **G3 at gate 7.**
  - The launcher checks `sha256(dependency-tree-hash.mjs) == 912041a5…` and `sha256(baseline) == 4534fd65…`. It then runs `--baseline … --loaded` from `web/` with env `{PATH, TMPDIR: fresh mkdtemp}`, so no credentials reach G3.
  - It requires exit 0, `match`, tree `76c7d466…`, `differences: []`, `uncovered: []` and `dyldKeysPresent is False`.
  - Chef's `real-g3-canonical` case passes, and `g3-tool-pin-mismatch` → `g3_tool_not_pinned`.
  - A G3 run longer than the exec window → `outside_exec_window`, and a G3 timeout (60 s) → `unexpected_TimeoutExpired`. Both refuse.

## (4) The three additions are fail-closed only. **PASS**

Each one can only raise `Refuse` or add a read-only step:
- **G3 in the launcher** adds a credential-free, offline node process with a scratch `TMPDIR` and no ledger. Its only effect is a refusal or a log line.
- **Receipt privacy** (`lstat`: regular file, own uid, no group/other bits) and the **origin pin** (exact string; my probe with a trailing `/` → `supabase_origin_not_pinned`) only refuse.
- **Value-shape** (whitespace or a leading quote) only refuses. Two notes:
  - a `#` without a space is accepted, which is correct, since it is legitimate in a value;
  - a CRLF file is accepted, because `strip()` removes the `\r`.

None of the three widens the env, the argv or the window.

## (5) Is R3, and with it RECHECK-4 precondition 2, closed for the pilot?

**Not yet: closed once the §1a and "One start" commands are prefixed with `/usr/bin/env -i PATH=/usr/bin:/bin`** (see the Verdict). After that, precondition 2 is closed for the 2026-11-17 pilot:
- R0 on bytes (RECHECK-7);
- R1/R2 as procedure, re-checked against plan `64efd9be…`:
  - §3b/§3c still require T−0 and T+0 `match`;
  - `g3.bothMatch` and the conversion rule are intact, and now name the converter's duty to check the attestation;
  - `launcher.*` now takes the verbatim exec line and gate-7 G3 line from `launcher.log`.
- R3 on launcher bytes `1bc56fab…`.

**Remaining items:**
- **TJ's approval of the hash.** Plan line 33 says TJ approved the *design*. The hash pin is pending this review. TJ's approval must name launcher `1bc56fab…` and the wait-then-exec change (OPERATOR-ACCEPTANCE "One start").
- **Doc drift.** `OPERATOR-ACCEPTANCE.md` is now `17597d2e…`. Chef's RECHECK-7 list had `9cffe3ae…`, and it was not in this request's list; I re-read the relevant lines. Low wording issue: stop item 11 ("wake-up arrives after 14:05:30Z") concerns the operator's wake-up message, not the exec window (14:05:00–14:05:50Z). Worth one clarifying word.
- **Custody, unchanged.** The bridge verifies none of this. An edit made and reverted between T−0 and T+0 can't be detected. Capture-side typescript is covered only by the G3 pins.
- **Low: the launcher cannot enforce `-I`.** Without `-I`, a `PYTHONPATH` `hashlib.py` ran before any gate (marker written), and the run ended in a raw traceback. With `-I`, nothing ran. Logging `sys.flags.isolated` and `sys.executable` in the exec line, and refusing unless isolated, would catch operator mistakes. **It changes the hash** (see the Verdict).
- **Low: env-file hygiene.** A symlinked or `0644` `.env.local` is accepted (my probes). No R3 effect. A fix also changes the hash.
- **Low: no cross-invocation lock.** See (1).

Reproducers:
- `repro/recheck8/edge-probes.py`: 15 seam cases;
- `repro/recheck8/shell-probes.sh`: `DEVELOPER_DIR` redirection and its `env -i` control, the `-I`/`PYTHONPATH` marker, and the zsh builtin-versus-`env`/`printenv`/stub table.

**Repository state after this recheck:**
- HEAD is still `863fab152`, with no new commits.
- The six `web/scripts/blsh` files are still uncommitted.
- No `fhfh-blsh-*` directory exists under `~/Library/Application Support/`.
