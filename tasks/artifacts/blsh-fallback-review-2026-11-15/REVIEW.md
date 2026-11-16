# BLSH 2026-11-18 fallback: second independent review

**Reviewer:** Claude side session, started by Chef (`local_56526db8`), 2026-11-15. Offline and read-only. No network, credentials or production. No edits outside this folder and the diary. Nothing applied, nothing committed. `GIT_DIR` was unset in every run.

**Checkout:** octoberBranch HEAD `2c1cd633d`. The fallback base `348a122d6` is an ancestor. Since then nothing has changed in `web/scripts/blsh`, `web/lib/buyLowSellHigh`, `web/lib/nst`, `web/lib/cron/nstRateLimitPolicy.ts`, `web/package.json` or `web/package-lock.json` (R1).

The earlier reviewer's RECHECK-1 to RECHECK-10 were read as context only. Every verdict below rests on my own runs and reads.

## Verdicts

| # | Item | Verdict |
|---|---|---|
| 1 | **Candidate:** `FALLBACK.patch` `209b34eb…`, `CANDIDATE.json` `5029c1cc…`, `HANDOFF.md` `28d4287b…`, bootstrap `849009ee…`, pins `3f61f9d4…` | **APPROVE** (bytes and timing) |
| 2a | **Operator:** `nst-pilot-launcher-1118.py` `2670353d…` and `DEPENDENCY-TREE-BASELINE-1118.json` `e9c7ec5a…` | **APPROVE** |
| 2b | **Operator:** RUNBOOK §8 as written | **DO NOT APPROVE** until M2 is fixed (a one-paragraph reorder) |
| 3a | **Bridge:** `approved/v5-1118/` vendored pins, plus explicit candidate selection in convert, assemble and check-attestation | **APPROVE** |
| 3b | **Bridge:** staged `post-capture/proposed/acquire-boxscores.mjs` `b4b563f4…` (the change itself) | **APPROVE** (the bytes only, not the swap) |
| 3c | **Bridge:** the fallback set as runnable end to end | **DO NOT APPROVE**: H1 and H2 are open, and M1 must be added to SWAP.md |

**Bottom line:** every byte that differs from the reviewed 11-17 set is date-, slot- or pin-coupled, and correct. The set is **not runnable yet**:
- the bridge's attestation gate has no 11-18 operator pins (H1);
- the either-pins acquisition tool is staged but not swapped or listed (H2).

Both fail closed: nothing can run wrongly, the fallback just refuses. Each remaining fix produces new hashes (listed under "What still has to happen"). Those need a short recheck before TJ's separate fallback approval.

## Findings, by severity

### H1: Bridge post-capture gate 2 refuses every v5-1118 packet (open; already declared as the bridge's blocker 2)

- **Where:** `blsh-evidence-bridge-2026-11-15/post-capture/check-attestation.mjs:18` sets `OPERATOR_PINS["v5-1118"] = { g3BaselineSHA256: null, launcherSHA256: null }`, so `checkAttestation` throws `candidate_operator_pins_unset` (`:46`).
- **What exists now:** the operator lane has built both hashes, launcher-1118 `2670353d…` and baseline-1118 `e9c7ec5a…`. The operator's own `operator-attestation.py:35-37` already carries them.
- **Effect:** after an 11-18 capture, POST-CAPTURE step 2 quarantines the packet, so there is no conversion. The rehearsal step B2 expects exactly this.
- **Reproducer:** R3 prints both null pins, the refusal, and the operator-built hashes.
- **Is filling the pins the whole fix?** In code, yes. I read all of `check-attestation.mjs`:
  - it has no other 11-17 literal (no date, lock name, baseline path or candidate field);
  - the candidate binding comes only from the launcher and baseline hashes.
- **What else must change:**
  - `rehearsal-inputs.mjs:32-38` builds its attestation fixture from the 11-17 launcher `31c370c3…` and baseline `4534fd65…`, even for v5-1118. It needs a 1118 fixture.
  - Rehearsal B2 flips from refusal to pass.
  - `SHA256SUMS` changes.

### H2: The live acquisition tool refuses every v5-1118 conversion (open; already declared as blocker 1)

- **What exists:** the staged tool `b4b563f4…` is correct (3b), but it is not live. `frames.mjs:31` lists only `aa8a9cb7…`.
- **What runs it:** SWAP.md steps 2 to 5. They need:
  - a non-author copy over the live tool;
  - a `frames.mjs` list entry;
  - test 15 and test 18 updated;
  - the rehearsal's B4 flipped;
  - TJ's frames approval re-issued for the new hash, timed after the 11-18 capture and before 2026-11-18T23:59:59Z.
- **Evidence:** rehearsal B4 (live tool refuses, 0 requests) and B4s (staged tool serves over loopback, one GET per game).

### M1: SWAP.md does not gate the swap on the 11-17 slot being over

- **The gap:** SWAP.md step 2 copies `b4b563f4…` over the live `acquire-boxscores.mjs` "after review". Nothing ties step 2 to the 11-17 slot being abandoned or done. Step 5, re-issuing the frames approval "for whichever slot runs", comes after the swap and does not gate it.
- **The risk:** an early swap replaces the RECHECK-4-reviewed tool on the 11-17 path. TJ's existing frames approval names `aa8a9cb7…`: I checked `blsh-pilot-readiness-2026-11-14/APPROVAL-SHEET.md:45` and `PILOT-APPROVAL-PACKET-v3.md:130`. So the 11-17 frames read would then run a tool hash nobody approved for it. Keeping `aa8a9cb7` on the `frames.mjs` list does not help, because the file on disk is the new one.
- **Fix:** gate step 2 in SWAP.md: "swap only after the 11-17 slot is abandoned or missed (the trigger for applying FALLBACK.patch), or after the 11-17 frames read has completed".

### M2: RUNBOOK §8 moves the evidence that its own stop rule reads

- **The text:** under "Attestation folder", the first instruction is "Before the 11-18 T−0, move any 11-17 T−0 files into `attestation/abandoned-20261117/`". The second is "If `attestation/launcher.log` or `launcher-20261117T1405Z.lock` exists, the 11-17 launcher started: stop, no fallback".
- **The problem:** "11-17 T−0 files" is not defined. In RUNBOOK's own headings, §2 is "T−0 morning" and the launcher start is §3, so whether the lock and `launcher.log` count is ambiguous. An operator who reads them as T−0 output and follows the order as written moves them first, and the stop check then passes.
- **No code backstop:** launcher-1118 checks only its own lock name.
  - R4 shows this with all-fake inputs: an 11-17 lock exists in the same `attestation/` folder, and launcher-1118 still reaches its single `execve`.
  - This is not a launcher defect. A cross-slot check would break the "only date, window, output and pins differ" rule, and the stop rule is procedural by design.
- **Partial backstop:** the T−0.4 block requires **both** output directories to be absent. That catches an 11-17 attempt only if the v5 bootstrap got far enough to create `…20261117T140500Z`. A launcher that started and then refused before the bootstrap leaves only the lock and the log.
- **Fix (doc only):**
  - put the stop check first;
  - say the lock and `launcher.log` are never moved;
  - or make the check also look inside `abandoned-20261117/`.
- After the fix: RUNBOOK §8 gets a new hash, which Chef records (a file cannot contain its own hash).

### L1: Slot clearance is dated 11-17 only

- **The text:** SLOT-CLEARANCE §3 and §5 ask owners to confirm "13:45–14:15Z on 11-17", and §6 names 11-18 as the contingency.
- **The gap:** RUNBOOK §8's substitution table does not say to redo the SLOT-CLEARANCE §5 recheck and the owner confirmations for 11-18. The dress rehearsal SKIPs T−0.1b, as expected.
- **Fix:** add one line to §8.

### L2: The candidate's "tsc 0 errors" log is not proof

- **The log:** `fallback-1118/logs/tsc-exp.log` is empty, and no exit code is recorded.
- **Why it matters:** this repo has seen plain `npx tsc` OOM (exit 134) and look clean when grepped.
- **Risk:** low, because the patch changes two string literals only. A typecheck with its exit code recorded, after the apply in canonical `web/`, would settle it.

### L3 (informational): candidate defaults in the bridge APIs

- **The defaults:** `assemble()` and `convertPacket()` default `candidate = "v5"` at the function-API level, and the synthetic-adapter CLI path uses `?? "v5"`.
- **Why it is safe:** the real CLIs require `--candidate` (R5: N4, N6 and N7 refuse), and a mismatched candidate refuses (N1, N2, N3, N5). So the default never picks a candidate silently.
- **Fix:** none needed.

### L4 (informational): the bootstrap's `approvedAtUTC` has no lower bound

- **The rule:** the bootstrap requires only `approvedAtUTC ≤ now`.
- **Why it is safe:** the receipt also binds `bootstrapSHA256` (`849009ee`), `slotStartUTC` and `outputDirectory`, so an 11-17 receipt is refused. The patched test keeps that negative (`slotStartUTC: 2026-11-17T14:05`).

## Item 1: Candidate

**Hashes match the brief:**
- patch `209b34ebe121a3de08c91ec74aaabd61844ad09e1ae0538cd045872bfc2fe8cf`;
- CANDIDATE `5029c1cc2ae49fd3ddac350242875a14ffedf778f2df2e1e71c72635aab9fd42`;
- HANDOFF `28d4287b9818d4dece2485b48c7f4f35f95ab51e8e22a621a923ac2fd83b08f9`.

**Apply check:** `git apply --check` against HEAD exits 0 (check only, not applied). Applied in a scratch `git archive HEAD`, the bootstrap hash is `849009ee3b68527858f93512c050ef5d0c01c20ef740c9e62addec4df21b4465`. Its diff against v5 (`dbf69c47…`) is exactly `SLOT` and `OUTPUT` (R1).

**Test file changes are a consistent one-day shift:**
- the fixture slot, the output and `approvedAtUTC` move by one day;
- the window negatives move to 11-18;
- the post-construction recheck moves to 11-18 14:06;
- the mismatch negative now uses the *11-17* slot, so a v5 receipt is refused;
- the late-approval negative moves to 11-19.

**No stray literals:** `git grep` in `web/` finds `20261117T140500Z` and `2026-11-17T14:05` only in those two patched files.

**The freshness rule is untouched:**
- the patch touches no file under `web/lib`;
- `currentProcessEvidence.server.ts` and `currentInput.ts` are unchanged since `348a122d6`;
- `maxEventAgeDays` 7 and `maxCaptureAgeHours` 24 come from the request policy `blsh-capture-reader-v1-event7days-capture24hours` (`capture_reader.py:178`), not from code.

**Timing verdict confirmed (R2, independent date arithmetic):**

| Rule | Where | Result for the 11-18 slot |
|---|---|---|
| Capture age < 8 d | preparation `:48` | 7 d 14 h 05 m at the slot, so a **9 h 55 m** margin |
| Event recent | gate `:210`, `:212`, `:215` | true through 2026-11-18T23:59:59.999Z, false at 2026-11-19T00:00Z |
| Capture ≤ 24 h | gate `:211`, `:213-214` | true until about 11-19T14:05Z, so it does not bind |
| Window recency | gate `:252` | the same date anchor, no stricter |
| Request cutoff | `currentInput.ts:165`/`:172`, `:257`/`:260` | the request reader sets `eventThroughDate` to `DATE_MAX` = `2026-11-11` (`capture_reader.py:17`, `:182`). So the CURRENT-REQUEST capture's `asOfUTC` date must also be ≤ 2026-11-18: the same limit, no stricter |

- **Usable window:** about **9 h 53 m**, from the capture end (about 14:07Z) to UTC midnight on 11-18. Frame read, conversion, CURRENT-REQUEST capture and evaluation all have to fit inside it.
- **Real gate code:** the bridge rehearsal ran the actual gate at the same offsets.
  - B12a: at the exact deadline, still 234/234 current.
  - B12b: at the next UTC midnight, 0 current and 234 source-observation only.
  - B8b/B8c: `event_age_exceeded` 1 ms late.

**Rehearsal and logs (the author's runs, read and compared, not re-run):**
- `rehearse.ts`, `run-rehearsal.sh` and `verify-packet.mjs` are byte-identical to v5's.
- `RESULTS.jsonl`: 41 lines each. With elapsed time, byte totals (a 24-byte scratch-path length difference), hashes and the day ignored, the outcomes match except scratch paths and the real-clock stamp.
- `CROSS-PINS.txt`: the fallback packet is vetoed `runtime_bootstrap_not_candidate` under the v5 pins and accepted under `3f61f9d4`.
- Suite logs: export 209/228, all failures `bootstrap_wrong_checkout`; relocated 228/228. Mutations: old slot 11/35, old output 12/35. For tsc, see L2.
- **Not run by me:** the vitest suite on the patched bootstrap. It binds canonical `web/` and is authoritative only after the apply.

## Item 2: Operator

**Launcher diff** (`nst-pilot-launcher.py` `31c370c3…` against `-1118.py` `2670353d…`). Only these differ:
- the docstring;
- the slot dates in `SLOT` (same times, 11-17 → 11-18);
- `LOCK_PATH` (`launcher-20261118T1405Z.lock`);
- `G3_BASELINE` and its pin (`DEPENDENCY-TREE-BASELINE-1118.json`, `e9c7ec5a…`).

The G3 tool pin `912041a5…`, the tree `76c7d466…`, `WEB`, `ENV_FILE`, `NODE`, `ORIGIN`, the allowlist, the gate order and argv are all unchanged. There is no output path in the launcher; output is pinned by the bootstrap and the receipt.

**Baseline:** `DEPENDENCY-TREE-BASELINE-1118.json` `e9c7ec5a…` differs from `4534fd65…` in exactly one of 399 leaves, `sources.bootstrapSHA256` (`dbf69c47` → `849009ee`).

**Tests:** `test-nst-pilot-launcher.py` `d90999ec…` passes 49/49 for 1118 and 49/49 for 1117, with no fake secret in any output. The real G3 on canonical `web/` correctly gives `g3_not_match` for 1118, because v5 is still applied.

**Disclosure:** the suite's `main-real-outside-window` case runs the real launcher `main()` with its production constants. Today is 11-15, so it refuses `outside_start_window` at gate 4. That is before the lock (gate 4b) and before `web/.env.local` is opened (gate 5).

**Rehearsal:** `dress-rehearsal.sh <scratch> 1118` (`b01ea793…`) gives 26 PASS, 2 SKIP and 0 FAIL. The two SKIPs are the admission SQL and the day-of agent steps. It created no real output, attestation, lock, receipt or evidence path; I confirmed `attestation/` is still absent.

Before running it I read the script:
- the egress block is never run;
- the only real-launcher call is the verbatim start line at today's real clock, which refuses `outside_start_window` before the env file is opened;
- `.env.local` gets one `stat` and is never read.

**RUNBOOK §8:** the substitution table matches what the rehearsal applies. **Not approved** because of M2, and L1 is also open.

## Item 3: Bridge

**Vendored files:** `approved/v5-1118/` holds:
- `FALLBACK.patch` `209b34eb…`;
- `expected-pins.json` `3f61f9d4…`;
- `verify-packet.mjs` `b86af692…`.

These are byte-equal to the candidate's copies. Against v5, the pins differ only in `_bootstrapSHA256` (`849009ee`) and `_source`. The verifier does read `_bootstrapSHA256` (`verify-packet.mjs:149`). `UPSTREAM-PINS.json` lists all three.

**Role pins match HEAD:** all nine runtime-role pins resolve to files at HEAD:
- runner, adapter and preparation;
- `nst/client`, `sharedAdmission`, `admissionOrigin`, `jobLifecycle.server` and `requestBudget`;
- `cron/nstRateLimitPolicy`.

**Explicit selection (R5, real CLIs on the rehearsal's v5-1118 packet):** all seven cases refuse with exit 2 and create no output.

| Case | Result |
|---|---|
| N1: fallback packet, `--candidate v5`, v5 pins | `packet_vetoed:runtime_bootstrap_not_candidate` |
| N2: fallback packet, `--candidate v5`, 1118 pins | `pins_not_approved` |
| N3: fallback packet, `--candidate v5-1118`, v5 pins | `pins_not_approved` |
| N4: convert without `--candidate` | `candidate_required` |
| N5: assemble `--candidate v5` on the 1118 conversion | `conversion_not_approved` |
| N6: assemble without `--candidate` | `candidate_required` |
| N7: check-attestation without `--candidate` | `candidate_unknown` |

**Staged tool:** `diff` of live `aa8a9cb7…` against staged `b4b563f4…` shows exactly two hunks:
- `APPROVED_PINS = [a2a1e694 (v5), 3f61f9d4 (v5-1118)]` and its comment;
- the conversion check `c.pinsSHA256 === APPROVED.pinsSHA256` → `APPROVED_PINS.includes(c.pinsSHA256)`.

The verifier, node and lineage checks are unchanged. The fixed output path follows the source date, the same for both slots. Schedule IDs are still re-derived from the hash-checked `schedule.raw.json`. SWAP.md describes this diff accurately; M1 is its only gap.

**Rehearsal:** `post-capture/dress-rehearsal.sh <scratch> v5-1118` (`c0c752b3…`) gives **21/21 PASS**. The four real fixed paths stay absent, and the bridge folder is unchanged.

**Not run by me:** the bridge suite (`node --test tests/bridge.test.mjs`). The author reports 21/21.

## What still has to happen before TJ can approve the fallback

Status of each knock-on in fallback HANDOFF §3 (all of §1–§4 read):

| Knock-on | Status |
|---|---|
| Candidate patch, bootstrap `849009ee`, pins `3f61f9d4` | Done; approved here |
| Bridge `approved/v5-1118/`, `UPSTREAM-PINS`, `convert.mjs` `CANDIDATES`, explicit `--candidate` | Done; approved here |
| Operator launcher-1118, baseline-1118, `operator-attestation.py` 1118 pins, `write-authorization-receipt.py` 1118 bootstrap | Done (launcher and baseline approved here; the other two read only) |
| Bridge `check-attestation.mjs` `OPERATOR_PINS["v5-1118"]` plus a `rehearsal-inputs.mjs` 1118 fixture plus B2 flip | **Open (H1)** |
| Acquisition swap to `b4b563f4`, `frames.mjs` list, tests 15 and 18, B4 flip | **Staged (H2), and gated by M1** |
| RUNBOOK §8 stop-rule order; slot-clearance line | **Open (M2, L1)** |
| Operator docs and `tools/dress-rehearsal.sh` (HANDOFF operator items 6–7) | Done for the rehearsal (1118 variant, 26/2/0). Docs other than RUNBOOK §8 were not reviewed |
| Readiness: `APPROVAL-SHEET.md` and `PILOT-APPROVAL-PACKET-v3.md` | **Open.** They cite `dbf69c47`, `a2a1e694`, `31c370c3`, `aa8a9cb7` and "before 2026-11-18 14:05Z". An 11-18 approval packet is needed. `g1-canonical/*` and `bridge-verification/*` need a rerun after the apply |
| Review lane: RECHECK repro scripts use 11-17 clocks and v5 hashes | Covered for this set by this review. The other reviewer's files are not edited |
| Mailbox `CLAUDE-TO-CODEX.md` | A message log, not a pin; nothing to do |
| TJ approvals: A1-1118, A2-1118, the 1118 slot receipt, and the frames approval for the new tool hash with 11-18 timing | Not given (TJ's) |
| Apply `FALLBACK.patch` in canonical `web/` | Only after 11-17 is abandoned or missed; then the vitest suite and a typecheck with exit code (L2) |

The H1, H2, M1 and M2 fixes each change at least one hash: `check-attestation.mjs`, `rehearsal-inputs.mjs`, `SHA256SUMS`, `acquire-boxscores.mjs`, `frames.mjs`, `tests/*`, `SWAP.md` and `RUNBOOK.md`. They need a short recheck before the set is runnable.

## Reproducers (`repro/`, outputs beside each)

- **R1** `r1-candidate-apply.sh <new scratch>`: `git apply --check` on HEAD, the drift check, a scratch apply, the bootstrap hash and the diff.
- **R2** `r2-timing.py`: the timing rules, re-derived.
- **R3** `r3-bridge-attestation-1118-unset.sh`: null 1118 operator pins, then `candidate_operator_pins_unset`, against the operator-built hashes.
- **R4** `r4-launcher1118-ignores-1117-lock.py <new scratch>`: launcher-1118 with every input faked still reaches `execve` while an 11-17 lock exists (M2).
- **R5** `r5-candidate-negatives.zsh <bridge rehearsal scratch> <new scratch>`: the seven explicit-candidate negatives.

**Run logs (`logs/`):**
- `launcher-tests-1118.log` and `launcher-tests-1117.log`;
- `operator-rehearsal-1118.log`;
- `bridge-rehearsal-v5-1118.log`.

## Check status

| Check | Status |
|---|---|
| `git apply --check` on HEAD | passed |
| Scratch apply and bootstrap hash | passed |
| Launcher tests (1118 and 1117) | passed, 49/49 each |
| Operator rehearsal 1118 | passed, 26/2/0 |
| Bridge rehearsal v5-1118 | passed, 21/21 |
| R1 to R5 | run; outputs in `repro/` |
| Candidate rehearsal and logs | read and compared, not re-run |
| Bridge suite | not run |
| Patched bootstrap vitest | not run (needs canonical `web/`) |
| Typecheck | not run |
| Drift during the review | none: every reviewed file re-hashed at the end and unchanged |
| Writes outside this folder | none: no `__pycache__` or `.pyc` in the lane folders. Real Application Support paths and `attestation/` are absent |
