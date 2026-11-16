# RECHECK-12: the RECHECK-11 fixes (2026-11-15)

Offline and read-only. I never ran the reader's `--execute-read-only`, the egress `--run`, or anything that reads `.env.local`. Only the operator rehearsal's T−1.4 block `stat`s it, metadata only. Scratch: `$S/r12`, `$S/mirror12`. Nothing outside this review folder and my diary was written, apart from scratch, G3's empty `mkdtemp` folders, and one temp file of mine that I wrote to `/tmp` and deleted at once.

## Verdicts

| Area | Verdict | Open item |
|---|---|---|
| **A. Request reader** | **APPROVE** | none; the custody residual is stated in the RUNBOOK and the approval wording |
| **B. Operator day-of** | **APPROVE** | none; three changed files that Chef did not list are covered below |
| **C. Bridge post-capture** | **APPROVE the code, on the condition of two POST-CAPTURE text fixes** | C4 (Medium): step 4's inline reader command is the superseded one, and it refuses. C5 (Low): step 2b names the old operator-tool hash. |

**Bytes.** Every hash in Chef's message matches. Launchers `31c370c3` and `2670353d`, `frames.mjs` `8b57ffbf` and the tool `aa8a9cb7` are unchanged.
- Reader `SHA256SUMS` `90190ca1`: 28/28 OK.
- Bridge `SHA256SUMS` `caa7f6f5`: 39/39 OK.
- HEAD `2c1cd633d`.

## A. Request reader (`run_live_read.py` `c23eb286`, scope `d84a9547`)

### A1: closed

I diffed the new wrapper against the RECHECK-11 copy and probed it (`repro/recheck12/reader-gates.sh`, `origin_probe.py`).

**No bytecode.**
- Before any import, the `__main__` gate refuses `bytecode_cache_not_disabled` unless `sys.pycache_prefix == "/var/empty"` and `/var/empty` is root-owned and empty.
- Without the prefix, and with a different empty prefix, the reader refuses.
- The documented command gives `preflight_ok` with `pycachePrefix: "/var/empty"`.

**No shadowing.**
- The `sys.path.insert(ROOT)` is gone. `capture_reader` and `read_only_session` are now executed by `load_pinned_module` from the exact bytes it has just hashed, with no finder and no `.pyc`. A wrong pin refuses `module_source_not_pinned`.
- `-I` keeps the script's folder off `sys.path` (checked).
- `run()` refuses first if the folder is not the pinned path. My RECHECK-11 attack (a copied folder with a planted `psycopg2.py`) now refuses `reader_root_not_pinned`, and the plant never runs.

**Origin check after import.** In preflight and in the run, before the env file is opened, every module loaded since start-up must come from:
- the stdlib, excluding `site-packages`;
- the pinned psycopg2 tree;
- or the two pinned reader files.

`psycopg2` and `psycopg2._psycopg` must come from the pinned tree. The injected cases each refuse `module_origin_not_pinned:<name>`: an unpinned `site-packages` module, an unpinned file from the reader folder, a `psycopg2` from elsewhere, and a `capture_reader` from a copy.

**Rerun of `repro/recheck11/reader-interpreter-probe.sh`.**
- Its generic Python lines are unchanged, as expected: `-B` still loads a planted `.pyc`, and the prefix stops it.
- Its preflight on a copied folder now refuses (`bytecode_cache_not_disabled`, because that script omits the prefix).
- Its "PLANTED … ran" line comes from the probe's **own** `sys.path.insert` import, which is the old loading method. The reader no longer loads that way. The new gates are exercised by `repro/recheck12/reader-gates.sh`.

**Custody residual.** It is now stated in the docstring, in RUNBOOK "Custody", and in the draft approval wording:
- stdlib source and `lib-dynload`;
- the `libcrypto` behind `hashlib`;
- the `.pth` hooks, whose modules are recorded as `startupNonStdlibModules: ["__main__","_distutils_hack","zope"]`.

A new **source** file planted under the stdlib path would pass the origin check; that is this same residual.

### A2: closed

- `SHA256SUMS` passes 28/28.
- `run_all.sh` now writes only into its scratch folder. I ran it **in place**, with output in scratch: **77 passed, 0 failed** (Python 50, node 9/9, e2e 18/18). A before/after hash of every file and folder showed the reader folder **unchanged**.
- `tests/publish.sh` is the one step that copies a receipt in and regenerates the scope and sums together.
- **Note:** the suite can no longer run from a copied folder. My mirror run failed 11 cases, all on the new `reader_root_not_pinned`, which is intended. Run it in place.

### A3: closed

`load_conversion` now takes an explicit `--candidate`. It refuses `conversion_not_approved_for_candidate` unless `pinsSHA256`, `verifierSHA256`, `nodeSHA256` and `lineageSHA256` equal that candidate's values. It refuses `conversion_packet_not_candidate_slot` unless `packet` is that slot's output name.
- Its constants equal `convert.mjs` `CANDIDATES` exactly: v5 `a2a1e694`/`b86af692`/`daa77e22`/`14e0816c`; v5-1118 differs only in pins `3f61f9d4`.
- The v5 packet name equals the bootstrap's `OUTPUT` basename.

### Owner role: stated

RUNBOOK "Custody" records two things:
- the connection is `postgres.<ref>`, with read-only enforced by the client;
- a grep of the migration and SQL trees finds no read-only login role.

The draft approval wording says both and accepts the interpreter residual. I did not repeat the grep.

## B. Operator day-of

### B1: closed

**Slot-date guard, checked first.**
- `dress-rehearsal.sh` line 4 refuses with exit 3 when `/bin/date -u` gives 2026-11-17 or 2026-11-18.
- `test-nst-pilot-launcher.py` lines 11–14 do the same, before any other import.
- RUNBOOK §0 states the rule.
- I checked this by code reading only; I cannot set the clock.

**Seams for the other days.**
- The rehearsal's start line (L.1) now runs a scratch copy of the launcher. The script asserts the copy differs from the original in exactly two lines, `ENV_FILE` and `LOCK_PATH`, both pointing into scratch.
- In the suite, every `script()` case, the `devdir` cases and the real-`main()` case run `SCRIPT_COPY` (built the same way).
- The driver cases import the real launcher but pass a scratch env file and lock through `launch()`.
- The real launcher is otherwise loaded only to read its constants.

So no case uses the real lock or the real env file, even outside the guard.

### B2: closed

`check` now runs `order_reasons`:
- T−0 `shellEndUTC` must be ≤ the exec `atUTC`, else `tMinus0_g3_not_before_exec`;
- `capture.endedAtUTC` must be ≤ T+0 `shellStartUTC`, else `tPlus0_g3_not_after_capture_end`;
- unparseable times refuse `order_times_unparseable`.

Equality is allowed, which suits the shell's one-second times.

### B3: closed

- Plan §1a gate 7 and §3c now describe the **wrapper** line, with the G3 JSON in its `stdout` field.
- The stale test hash is updated to `33aa7cb4`.
- Probe v2 now uses a fresh `mkdtemp` folder, not another session's scratchpad.

### Files changed but not in Chef's list

- **Plan `38748c73`:** doc changes as above.
- **Snapshot `fd9019e3`:** comment only. The npm-code wording now names the ts-node preload.
- **Probe v2 `246bf6b4`:** I read the changed region and the secret handling around it. The only change is the private `mkdtemp` scratch. The secrets still never reach a child, and the self-check still suppresses any leak.

The RUNBOOK §7 table lists all three new hashes.

### My runs

- `dress-rehearsal.sh … 1117`: **28 PASS, 2 SKIP, 0 FAIL**, with no real path created.
- Launcher suite: **49/49**, no fake secret seen.

## C. Bridge post-capture

### C1: closed

`check-attestation.mjs` now parses the launcher line as the wrapper. It requires `launcher:"g3"`, `exitCode:0` and a string `stdout`, then applies the full §3c match to the inner line. `rehearsal-inputs.mjs` now writes launcher-shaped files and runs the **real** `operator-attestation.py write` to build every rehearsal attestation, with a negative case for the old raw shape.

Probed with `repro/recheck12/attestation-fixed.sh`, on an attestation written by the operator's own tool:

| # | Input | Result |
|---|---|---|
| 1 | As written | `launcher_argv0_not_real_node` |
| 2 | `argv0` and `cwd` set to the real values, nothing else changed | **`ok:true`** |
| 3 | The old bare G3 line | `launcher_g3_line_not_wrapper_exit_0` |
| 4 | Exec at 14:05:50.000001Z | `launcher_exec_time_outside_2026-11-17_window` |

**The author is right:** case 1 is the intended C2 refusal of the rehearsal's stub node, not a C1 defect. The unwrap works, and only `argv0` fails. Through the function's `expect` seam, the same file gives `ok:true`.

### C2: closed in code

- The bridge check binds `argv0 = /usr/local/bin/node`, `cwd` = canonical `web/`, and an exec time inside `<date>T14:05:00–14:05:50Z`. It also refuses a launcher refuse line and checks `candidate` against the operator candidate.
- `expect` is a function seam only; the CLI never passes it.
- POST-CAPTURE step 2b runs `operator-attestation.py check`, and both must accept. On case 2's file, step 2b gave `{"conversion": "accept", "reasons": []}`.

### C3: mostly closed; replaced by C4

Step 4 and "CLI gaps" #1 now point at the reader.

### C4 (Medium; condition): step 4's inline reader command is the superseded one

POST-CAPTURE step 4 says "exactly the command in the reader RUNBOOK", citing RUNBOOK `269ed3d9` and scope `c731a79f`. But it prints the **old** command, without `-X pycache_prefix=/var/empty` and without `--candidate v5`.
- The reader RUNBOOK is now `8e27a427`, scope `d84a9547`.
- Run as printed, the new reader refuses at once with `bytecode_cache_not_disabled`, before any env-file read or connection, so it fails closed. But it costs a time-critical step on the day.

**Fix:** copy the current reader command and hashes into step 4, or replace the inline command with a pointer only.

### C5 (Low; condition): step 2b names the old operator tool

Step 2b says "This tool is `becd44e0…`". It is now `de0982a6`, which adds the B2 ordering checks.

### Unchanged since RECHECK-11, and still passing

- `deadline-check.mjs`.
- The `v5-1118` operator pins in `OPERATOR_PINS` (`e9c7ec5a`/`2670353d`) are new; I leave them to the fallback reviewer.

### My runs

- `dress-rehearsal.sh … v5`: **36/36**, with the guards unchanged.
- 21-test bridge suite in a fresh mirror: **21/21**, with v5 pins, the scratch-only `WEB` edit, and a temporary `.git` pointer (removed). Canonical sums are still 39/39.

## Repository state

- HEAD `2c1cd633d`.
- No `fhfh-blsh-*` directory, and no `attestation/` folder.

## Reproducers

- `repro/recheck12/reader-gates.sh` with `origin_probe.py`: the A1 gates.
- `repro/recheck12/attestation-fixed.sh`: C1/C2. It refuses on a slot date, because it uses the operator rehearsal.

## Addendum (2026-11-15, after Chef's doc fix): C4 and C5 met. C is APPROVE.

Doc-only recheck; read-only. POST-CAPTURE is now `c1ae5d46`, and bridge `SHA256SUMS` `5e701ee7` checks 39/39 OK.

- **C4 met.**
  - Step 4 no longer copies the reader command. It points at the reader RUNBOOK's "The single command" section, to be run exactly as printed there, so it cannot drift again. That RUNBOOK's command has `-X pycache_prefix=/var/empty` and `--candidate v5`.
  - It cites reader RUNBOOK `8e27a427`, `run_live_read.py` `c23eb286` and scope `d84a9547`. All three equal the files on disk now, and step 4 has the operator check them and TJ's approval scope first.
  - The old `269ed3d9` and `c731a79f` no longer appear anywhere in POST-CAPTURE.
- **C5 met.** Step 2b names `operator-attestation.py` `de0982a6`, which equals the file on disk. The old `becd44e0` is gone.

Nothing else was rechecked. HEAD is still `2c1cd633d`.
