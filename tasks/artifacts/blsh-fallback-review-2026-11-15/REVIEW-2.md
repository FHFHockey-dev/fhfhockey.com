# BLSH 2026-11-18 fallback: recheck of the REVIEW.md findings

**Reviewer:** the same independent session as REVIEW.md (`6ef29d6f…`). Requested by Chef on 2026-11-15. Offline and read-only, with one exception: the npm network touch disclosed under L2. No edits outside this folder and the diary. Nothing applied, swapped or committed. `GIT_DIR` was unset in every run. Today is 2026-11-15 UTC, so the new slot-date guards do not trigger.

## Overall verdict

**READY for TJ's approval decision, for use only if 11-17 is missed.** Every finding from REVIEW.md that the authors were asked to fix is fixed and holds up under my own runs.

What stays open is by design and is not a defect:
1. **H2, the tool swap, is not executed.** It is now gated (M1). When it is executed, after 11-17 is abandoned or missed:
   - the `frames.mjs` list, the live `acquire-boxscores.mjs` and tests 15 and 18 change;
   - the rehearsal's B4 flips;
   - those resulting hashes need a short check.
2. **TJ's own approvals** are not given yet: A1-1118, A2-1118, the 1118 slot receipt, and the frames approval for `b4b563f4…` with 11-18 timing.
3. **Applying `FALLBACK.patch`** in canonical `web/` happens only after 11-17 is abandoned or missed. After the apply, the bootstrap vitest suite and the predicted-runtime probe become authoritative.

## Item verdicts

| Finding | Fixed file (sha256) | Verdict |
|---|---|---|
| **H1:** null v5-1118 operator pins | `post-capture/check-attestation.mjs` `b95318303cef…`; `rehearsal-inputs.mjs` `d9d0aefd714f…` | **FIXED, APPROVE** |
| **H2:** acquisition swap | staged tool `b4b563f4…` unchanged; live `aa8a9cb7…` and `frames.mjs` `8b57ffbf…` unchanged | **OPEN BY DESIGN**, now gated by M1 |
| **M1:** swap timing gate | `post-capture/proposed/SWAP.md` `bfd710fb35c5…` | **FIXED, APPROVE** |
| **M2:** RUNBOOK §8 stop-check order | `RUNBOOK.md` `236aace4…` | **FIXED, APPROVE** |
| **L1:** 11-18 re-clearance | `RUNBOOK.md` `236aace4…` §8 | **FIXED, APPROVE** |
| **L2:** typecheck evidence | `fallback-1118/logs/typecheck.log` `0dd03544…` | **FIXED, APPROVE** (my patched re-run: exit 0) |
| **RECHECK-11 B1:** no suite or rehearsal on a slot date | `tools/test-nst-pilot-launcher.py` `33aa7cb4…`; `tools/dress-rehearsal.sh` `49377aa0…` | **APPROVE**; the 1118 variants are covered |

**Earlier approvals still hold.** The launchers are unchanged (`31c370c3…` and `2670353d…`), as are the baseline-1118 `e9c7ec5a…`, `FALLBACK.patch` `209b34eb…`, the `approved/v5-1118/*` files, `convert.mjs` `5f642fc9…`, `assemble.mjs` `a972216e…`, `frames.mjs`, and the live and staged acquisition tools.

## Evidence

### H1: `check-attestation.mjs` `b9531830…`

**Pins:** `OPERATOR_PINS["v5-1118"]` is now:
- `operatorCandidate: "v5-1118"`, `date: "2026-11-18"`;
- baseline `e9c7ec5a…` and launcher `2670353d…`.

Both match the operator-built files and the operator's `operator-attestation.py` table.

**The rewrite does more than fill the pins.** I read the whole file (104 lines). The extra checks are all correct tightenings:
- `a.candidate` must equal the operator candidate;
- `refuseLine` must be absent;
- the exec line must carry the real `argv0` (`/usr/local/bin/node`) and `cwd` (canonical `web/`);
- the exec time must fall inside the slot date's 14:05:00–14:05:50Z window;
- the launcher's G3 line must be the real wrapper shape `{"launcher":"g3","exitCode":0,"stdout":…}`, with the inner line checked like the T−0 and T+0 runs.

There is no test seam on the CLI path; `expect` is only an API argument.

**Timestamp shape:** the launcher writes `isoformat()` with microseconds, for example `2026-11-18T14:05:05.123456Z`. I confirmed that node parses this, and that the window comparison accepts 14:05:05.123456 and 14:05:49.999999.

**Bridge rehearsal:** `bash post-capture/dress-rehearsal.sh <scratch> v5-1118` (`9f154839…`) gives **31/31 PASS**, matching the author's report.
- B2 accepts the launcher-shaped 1118 attestation.
- B2op is the operator's own `operator-attestation.py check`, and it accepts too.
- B2a–B2i each stop as named.
- The fixed real paths are untouched, and the bridge folder is unchanged.

**My mutations (R6) of the accepted 1118 attestation, through the CLI defaults:**

| Mutation | Result |
|---|---|
| None (unchanged) | accept |
| 11-17 launcher hash | `launcher_not_pinned` |
| 11-17 baseline hash | `g3_baseline_not_pinned` |
| Exec on 2026-11-17 | `launcher_exec_time_outside_2026-11-18_window` |
| Exec at 14:05:50.000001Z | `launcher_exec_time_outside_2026-11-18_window` |
| Candidate field `v5-1117` | `attestation_candidate_mismatch` |
| Capture exit 1 | `capture_exit_not_0` |
| Refuse line present | `launcher_refused` |
| Checked as `--candidate v5` | `attestation_candidate_mismatch` |

**Bridge `SHA256SUMS`** (`caa7f6f5…`, 39 entries): every entry verifies.

### M1: `SWAP.md` `bfd710fb…`

Step 2 is now gated, before any copy, on one of two conditions:
- **(a)** the 11-17 slot is abandoned or missed (the same trigger as applying `FALLBACK.patch`);
- **(b)** the 11-17 frames read has completed, and its output and manifest exist.

It says outright never to swap before or during the 11-17 frames read, and it cites `APPROVAL-SHEET.md:45` and `PILOT-APPROVAL-PACKET-v3.md:130`. It also states that keeping `aa8a9cb7` on the list does not protect that run. This closes M1.

### M2 and L1: RUNBOOK §8 (`236aace4…`)

**The stop check comes first.** It is a single command that counts:
- the 11-17 lock, `launcher.log` and `capture.exit`, both in `attestation/` and in `attestation/abandoned-20261117/`;
- the 11-17 output directory.

Anything but `0` means stop, no fallback.

**Nothing that proves a start ever moves.** The lock, `launcher.log` and `capture.exit` are "never moved, renamed or deleted, on any day". Only `g3-T-0.*` and `shell-dyld-devdir.count` move, and only after the check prints `0`.

**L1:** the re-clearance is explicit. The SLOT-CLEARANCE §5 recheck runs again for 11-18 13:45–14:03Z, with fresh owner confirmations for 13:45–14:15Z on 11-18 and its own T-minus record and coordination receipt. The 11-17 confirmations do not carry over.

**Operator rehearsal:** `zsh tools/dress-rehearsal.sh <scratch> 1118` gives **31 PASS / 2 SKIP / 0 FAIL**, matching the author's report. The SKIPs are the same two day-of agent and DB steps as before. It includes the §8 stop-check block run verbatim (`0`), and a negative: an 11-17 lock moved into `abandoned-20261117/` is still found, giving `1`, so stop. No real `attestation/` folder or Application Support output was created.

**Launcher suite** (`33aa7cb4…`): 49/49 for 1118 and 49/49 for 1117, with no fake secret seen.

### L2: typecheck

**The author's log:** `npm run typecheck` (8 GB `tsc --noEmit`) on `git archive 348a122d6 web supabase`, unpatched and patched, both exit 0. The web-only run shows 46 identical errors in both trees. They come from four files importing `supabase/functions` (absent in a web-only export), and none is in `scripts/blsh`.

**My independent re-run:** the same export plus `FALLBACK.patch`, giving bootstrap `849009ee`:
- `npm run typecheck` exits **0**, with 0 `error TS` lines;
- run 21:40:31Z–21:41:43Z; log at `logs/recheck-typecheck-patched.log`.

**Disclosure:** npm printed an update notice during this run. With a fresh `HOME`, npm's update notifier almost certainly made one anonymous version request to the public npm registry. No credentials, project data or production were involved. It still breaks the offline rule, and I am reporting it rather than leaving it out. A future offline run should pass `--no-update-notifier`, or set `NO_UPDATE_NOTIFIER=1`.

### RECHECK-11 B1: the slot-date guards cover the 1118 variants

**Guard placement:**
- `test-nst-pilot-launcher.py`: the guard is the first executable code after the docstring. On a UTC date of 2026-11-17 or 2026-11-18 it exits 3.
- `dress-rehearsal.sh`: line 4 uses `/bin/date -u` with an absolute path, so `PATH` cannot spoof it. It exits 3 on those dates.

**Both guards run before the variant is chosen,** so `1118` is covered exactly like `1117`.

**R7 extracted both guards and ran them with faked dates:**

| Date | Result |
|---|---|
| 11-16 | runs |
| 11-17 | refused |
| 11-18 | refused |
| 11-19 | runs |

**Seam copies are built from the selected variant:**
- the suite builds `launcher-seam-copy.py` from `nst-pilot-launcher-1118.py` when the variant is `1118`. It asserts that exactly two lines differ, `ENV_FILE` and `LOCK_PATH`, both in scratch, and that the lock line it replaces is the 1118 one.
- the rehearsal's L.1 start line is rewritten to the seam copy for both launcher names (regex `nst-pilot-launcher(-1118)?\.py`).

No case in either script uses the real `ENV_FILE` or `LOCK_PATH`.

**Other callers:** nothing else in the operator, bridge or readiness lanes executes `nst-pilot-launcher-1118.py`.

## New finding (Low; other lane; not a fallback defect)

**N1:** two of the other reviewer's probe scripts run the **real 11-17 launcher** with its real `ENV_FILE` and `LOCK_PATH`, with no slot-date guard:
- `blsh-evidence-bridge-review-2026-11-15/repro/recheck8/shell-probes.sh:11-12`;
- `repro/recheck9/interpreter-probes.sh:13-19`.

Outside 14:03–14:05Z they refuse before the lock and the env-file read, but they are unsafe to run inside the 11-17 window. If one ran then, it would take the real 11-17 lock, which under the new §8 stop check also ends the fallback.

Neither references launcher-1118. The fix belongs to that lane: add the same date guard, or retire the scripts. Until then, the rule "no rehearsal or suite on a slot date" covers them only by instruction.

## Not covered

- **Operator tools changed but not line-reviewed:** `operator-attestation.py` `de0982a6…`, `env-presence-probe-v2.py` `246bf6b4…` and `preapproval-runtime-snapshot.cjs` `fd9019e3…` changed since REVIEW.md and were not named in the fix list. I did not line-review them; I only exercised them through the 31/2/0 rehearsal and the bridge's B2op and B2i steps.
- **Changed candidate files:** `CANDIDATE.json` (`b2bdb9c5…`) and `HANDOFF.md` (`1adde7f9…`) changed. I checked only that `CANDIDATE.json` still names patch `209b34eb`, bootstrap `849009ee`, status `parked_fallback_not_applied_not_approved`, and the new typecheck record.
- **Not run:** the bridge suite `tests/bridge.test.mjs`, the patched bootstrap vitest in canonical `web/` (it needs the apply), and the unpatched typecheck re-run.

## Reproducers added

- **R6** `repro/r6-attestation-1118-mutations.mjs <bridge v5-1118 rehearsal scratch> <new scratch>`: nine attestation cases, output in `repro/r6.out`.
- **R7** `repro/r7-slot-date-guards.sh`: the guards with faked dates, output in `repro/r7.out`.

**Recheck logs** (in `logs/`):
- `recheck-bridge-rehearsal-v5-1118.log`;
- `recheck-operator-rehearsal-1118.log`;
- `recheck-launcher-tests-1118.log` and `recheck-launcher-tests-1117.log`;
- `recheck-typecheck-patched.log`.
