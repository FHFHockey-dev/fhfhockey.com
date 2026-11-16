# RECHECK-9: launcher `31c370c3…` and its exact launch instructions (2026-11-15)

Offline and read-only. I never ran it against `web/.env.local` or the real bootstrap. Every real-launcher run used the real clock (2026-11-15). Any run that got past the interpreter gates refused `outside_start_window`, which comes before the lock and before any env-file access. The operator folder still has no `attestation/` directory. Nothing outside this review folder and my diary was written. Scratch: `$S/r9p`, `$S/r9i`, `$S/r9t`.

## Verdict

**CLOSED.** R3, and with it RECHECK-4 precondition 2, is closed for the 2026-11-17 pilot on these bytes:
- launcher `31c370c3110ddb5d…`;
- plan `3d09b802…`;
- acceptance `f5984419…`.

The RECHECK-8 blocker is fixed. Every documented launch command carries the `/usr/bin/env -i PATH=/usr/bin:/bin` prefix, and my `DEVELOPER_DIR` probe against the exact documented line ran the real interpreter (0 markers). The residuals are custody and Low items, listed at the end. **TJ's approval must name `31c370c3…`.** Any edit to the launcher changes the hash and voids this verdict.

## Bytes (all match Chef's message)

Launcher `31c370c3110ddb5d…`, tests `2c01f08a…`, `RUNTIME-RECEIPT-PLAN.md` `3d09b802…`, `OPERATOR-ACCEPTANCE.md` `f5984419…`, probe v2 `bf39d6ae…`. Also unchanged: G3 tool `912041a5…` and baseline `4534fd65…`.

**Chef's suite, rerun by me** under `/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I`: **49/49 PASS**, `failures: 0`, "fake secret seen in any output: False". This matches `LAUNCHER-TESTS-31c370c3.log`. The suite takes its lock path from a seam, and it did not create `attestation/`.

## Nothing else changed

I re-read `31c370c3…` in full (255 lines) against `1bc56fab…`, which I read in full in RECHECK-8. The only logic changes are these:
1. A pre-import gate at lines 24–30: `import sys` (always built in), then refuse unless `sys.flags.isolated` and `sys.executable == "/Library/Developer/CommandLineTools/usr/bin/python3"`. It writes a fixed line and exits 2.
2. `import errno`, the `LOCK_PATH` constant, and `take_lock()` as gate 4b, between the window check and the env read.
3. `read_private_env_file()`: `O_RDONLY|O_NOFOLLOW|O_NONBLOCK`, then `fstat` on the same descriptor. `parse_env_file()` now takes text and splits on `\n`, after text mode has normalised `\r\n`. The line rules are unchanged.
4. The exec log line gains `pythonIsolated` and `pythonExecutable`.
5. The docstring is updated, and `launch()` gains a `lock_path` seam.

Everything else is byte-for-byte the same logic: gates 1–9, the windows, the 8-key allowlist, the argv, G3 at gate 7 with the same pins and acceptance test, `main()` and the refusal handling.

## (a) `/usr/bin/env -i` prefix on every documented launch command. **PASS**

- **The documented commands.** There are exactly two: plan §1a line 56 and the OPERATOR-ACCEPTANCE "One start" step at line 36. Both read `/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I …/tools/nst-pilot-launcher.py --run <receipt> > …/attestation/launcher.log 2>&1`. The launcher's own docstring says the same.
- **My `DEVELOPER_DIR` probe** (`repro/recheck9/interpreter-probes.sh`). I exported `DEVELOPER_DIR=<fake>`, `DYLD_FOO=1` and `PYTHONPATH=<injector>` in the outer shell, then ran **the documented line verbatim**, with only its redirect pointed at scratch:
  - result: `outside_start_window`, **0 markers**. The real interpreter ran;
  - control without the prefix: the fake `xcrun` ran (marker 1), and the launcher never started.
- **T−1 interpreter check** (plan line 100): it prints `/Library/Developer/CommandLineTools/usr/bin/python3` today, which equals the pin.
- **Pre-start shell check** (advisory): it is now `export -p | grep -c -E 'DYLD_|DEVELOPER_DIR'`.

## (b) Isolated-mode refusal and `sys.executable` pin. **PASS**

All on the real launcher, with real `main()`:

| Case | Result | Marker |
|---|---|---|
| No `-I`, `PYTHONPATH` `hashlib.py` | `not_isolated` | **0**: the RECHECK-8 case is fixed |
| `-I` from anaconda, `/usr/local/bin` and `/opt/homebrew` pythons | `unexpected_interpreter` (each) | — |
| CLT python started directly (not the stub) with `-I` and `DYLD_FOO` | `dyld_key_in_launcher_env:DYLD_FOO` | — |
| Documented line, clean environment | `outside_start_window` | — |

**Documented limit, not a blocker.** Without `-I`, a `sitecustomize.py` on `PYTHONPATH` runs during interpreter start-up, before any line of the launcher (marker 1), and the launcher then refuses `not_isolated`. The same applies to a real `DYLD_INSERT_LIBRARIES` against the CLT binary started directly. Only the documented line prevents these, and it does: under `-I`, `sitecustomize` gave 0 markers, and `env -i` drops every `DYLD_*` key and `PYTHONPATH`. The gate catches operator deviations. It cannot stop code that runs before the script, and the docstring says so.

## (c) `.env.local` symlink, owner and mode refusal. **PASS**

`repro/recheck9/seam-probes.py`, through `launch()`'s seams:

| Env file | Result |
|---|---|
| `0644` | `env_file_not_private_regular_file` |
| `0640` | `env_file_not_private_regular_file` |
| symlink to a good file | `env_file_not_private_regular_file` (`ELOOP`) |
| FIFO | `env_file_not_private_regular_file`, no hang |
| directory | `env_file_not_private_regular_file` |
| missing | `env_file_unreadable` |
| private hard link | accepted; it is a regular file the user owns, so this is correct |

In every case: 0 execve calls and no value in the logs.

- **Not-owned-by-me:** I read the code only. A file owned by another uid needs root. `fstat` runs on the opened descriptor, so a path swap after the open cannot win.
- **The real file.** The plan records `stat`-only facts for the real file (0600, uid 501, regular, 1 link). I did not stat it myself.
- **Low.** Probe v2 does not predict this gate. Re-run the plan's `stat` at T−1 so a mode change can't surprise the slot.

## (d) O_EXCL lock: taken before the env read, never removed. **PASS**

- **Order.** By code, gate 4b comes after the window check and before `read_private_env_file`. My spy on that function saw the lock file already present at the moment of the read.
- **Second launcher.** Same lock path → `launcher_lock_exists`, with 0 execve and no env read.
- **Lock survives a refusal.** A first launcher that refuses at the env gate still holds the lock, and a later launcher with a good env file then gets `launcher_lock_exists`. This is consistent with "no retry".
- **Planted symlink at the lock path** → `launcher_lock_exists` (`O_EXCL` does not follow it), and the symlink target was **not** created.
- **Missing `attestation/` directory** → `launcher_lock_unavailable`.
- **Out of the window** → no lock file.
- **Never removed.** No code path unlinks the lock. The file holds only `{pid, takenAtUTC}`.
- **Operational dependency.** The §3c T−0 command's `mkdir -p "$A"` must run before the launcher, or it refuses. This is documented at plan line 76, and step 4 comes before step 5, so the order is right.

## (e) Stop item 11 wording. **PASS**

Item 11 now separates three times:
- the wake-up message must arrive by 14:04:30Z;
- the start window is 14:03:00–14:05:00Z;
- the exec window is 14:05:00–14:05:50Z.

Each time matches the launcher's constants, and "any miss is a stop, not a retry".

## Residual limits (none blocks)

- **Custody, unchanged from RECHECK-6 to RECHECK-8.**
  - The bridge verifies none of this. The launcher log, both G3 outputs and the attestation are operator records, and whoever converts must check `g3.bothMatch` and `launcher.dyldKeysPresent` first.
  - An edit made and reverted between T−0 and T+0 can't be detected.
  - Capture-side typescript is covered only by the G3 pins.
  - Credentials in node's environment are visible to same-user `ps -E`.
- **Invocation.** The protection rests on the operator typing the documented line. Deviations are refused, except code that runs at interpreter start-up (see (b)).
- **Low, T−1:** re-stat `web/.env.local` (mode `0600`, own uid, regular file, not a symlink), because probe v2 does not predict gate 5's hygiene check.
- **Low, concurrency backstop.** It is now the lock. The runner's atomic `mkdir` remains a second layer.
- **The lock is never removed and the date is fixed.** The 11-18 contingency needs a new launcher hash, a new lock name and new approval, as the plan states.

**Precondition 2: CLOSED for the 2026-11-17 pilot** with R0 (on bytes), R1/R2 (as procedure) and R3 (on bytes, launcher `31c370c3…`), subject to TJ's approval naming that hash. No other precondition changes.

**Repository state:** during this recheck, HEAD moved `863fab152 → a9d1eb507` through six commits by another lane (FORGE trend-band reader and migration 151). `git log --name-only` shows no `blsh` path, no file in this review folder and not my diary. The six `web/scripts/blsh` files are still uncommitted. No `fhfh-blsh-*` output directory exists, and there is no `attestation/` folder in the operator lane.

Reproducers: `repro/recheck9/interpreter-probes.sh` (real launcher, real clock) and `repro/recheck9/seam-probes.py` (seams, scratch only).
