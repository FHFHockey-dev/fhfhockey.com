# RECHECK-7: operator-lane fixes for RECHECK-6 R0–R3 (2026-11-15)

Offline and read-only. Nothing outside this review folder and my diary was written. Scratch: `$S/r7a`, `$S/r7b`, `$S/r7c`, `$S/r7dy`.

## Verdict

**R3: NOT CLOSED** until the launcher exists and is reviewed. R3 is now a separate launcher-review precondition (see (3)).
- **R0: CLOSED on bytes** (tool `912041a5…`).
- **R1/R2: CLOSED as written procedure.** This is custody: it has to be carried out on the day, and the bridge cannot check it.

**Precondition 2 (in-process module integrity) is therefore closed for the pilot except for R3.** The DYLD control lives in the launcher's run mode, which `RUNTIME-RECEIPT-PLAN.md` §1 says is "not written yet", so it could only be checked as a specification. No other precondition changes.

**Repository state:**
- HEAD moved `cb42e6c12 → 863fab152` during this recheck. The three commits are another lane's (trend-band reader), and `git log --name-only cb42e6c12..HEAD` touches no `blsh` path, this review folder or my diary.
- The six `web/scripts/blsh` files are still uncommitted (` M`) and still equal the v5 pins: runner `a74cbb0a`, adapter `aa6237bd`, preparation `7f562056`, bootstrap `dbf69c47`.
- The fixed boxscore output path is still absent, and the operator folder has no `attestation/` directory.

## Bytes checked (all match Chef's message)

`tools/dependency-tree-hash.mjs` `912041a5…`, `tools/test-g3-r0.sh` `7d711e2e…`, `tools/env-presence-probe-v2.py` `6218eba8…`, `RUNTIME-RECEIPT-PLAN.md` `d42405e9…`, `OPERATOR-ACCEPTANCE.md` `9cffe3ae…`, baseline `4534fd65…` (unchanged). I read the new tool in full.

## (1) R0: nothing from the checked tree runs before it is verified. **PASS**

**Code read.** In order, the tool:
- refuses any `DYLD_*` key in its own environment (`dyld_env_present`);
- refuses a symlinked or non-plain `node_modules/typescript` (`typescript_not_plain_directory`);
- checks its `package.json` name and version. That step is JSON data only, nothing executed;
- hashes the whole typescript package with builtins-only code;
- requires the hash to equal `TYPESCRIPT_PIN`, which lives in the tool, outside the tree: 129 files, `3556c8c4…`, entry `0fba5508…`;
- compiles **the same buffer it hashed**, so there is no second disk read, using `vm.compileFunction`. The only `require` it hands that code serves Node builtins and nothing else.

The pin equals the baseline record (`3556c8c4…`, 129 files) and the live entry hash (`0fba5508…`). In compare mode the tool also refuses if the baseline's typescript record differs from its pin.

Nothing else from the tree executes in the parent:
- `require.resolve` and the manifest reads are resolution and JSON only;
- the `--loaded` listing child, which runs ts-node, typescript, cheerio and undici from the tree, is spawned only when every other check has already passed (`loaded_listing_skipped_tree_refused`).

**My unchanged `repro/recheck6/g3-self-check.sh`, rerun against the new tool:**
- control: `match`, tree `76c7d466…`;
- undici with one appended comment: `refuse`, `changed:node_modules/undici`;
- forged `typescript.js` prologue: **`refuse`, `typescript_package_hash_mismatch`**. In RECHECK-6 this case printed a forged `match`.

**My own extra canary probe** (`$S/r7c`). I prepended a file-writing canary to `ts-node/dist/index.js`, `cheerio/dist/commonjs/index.js` and `undici/index.js`, then ran with `--loaded`:
- result: `refuse` with `changed:` for all three, `bootstrap_dependency_pin_mismatch` and `loaded_listing_skipped_tree_refused`;
- canary files written: **0**. No tampered byte ran in the parent or in the listing child.

**Chef's `tools/test-g3-r0.sh`, rerun by me in scratch:** 22 PASS lines, `failures: 0`. That covers:
- `tsforged` with and without `--loaded`, and two canary cases (marker absent, no manifest written);
- `tssymlink`, `dyld`, the undici and ts-node cases, symlink-out, nested-extra, a removed dependency, `evil-tls`, `role-extra` and `nodepath-shadow`.

This agrees with `g1-canonical/G3-R0-TESTS.log`.

**Remaining limit (documented in plan §3b).** In the capture process itself, ts-node still loads `typescript` before the bootstrap's own `DEPENDENCIES` check. That is covered only by G3's typescript pin at T−0 and T+0, i.e. by custody. An in-process fix belongs to the capture lane.

## (2) R1/R2: attestation and conversion rule require both T−0 and T+0. **PASS (as procedure; custody)**

- **Same command at both times.** `OPERATOR-ACCEPTANCE.md` step 4 (T−0, about 14:03Z) and step 6 (T+0, "immediately after the capture exits") run the identical G3 `--loaded` command and save its stdout verbatim. Plan §3c gives the exact command, with `inputs-sha256` of the tool and baseline captured each time.
- **What "Required" means, each time:** exit 0; exactly one JSON line with `match`; tree and baseline tree both `76c7d466…`; `checkerTypeScript: "verified_before_load"`; `dyldKeysPresent: false`; `loaded` exactly `{256, 9, 1, 245, 34, 15, uncovered: []}`; `differences: []`. Both tool hashes must equal the TJ-approved hash.
- **The conversion rule** (§3c, and step 7): "no conversion unless `g3.bothMatch` is `true` and `launcher.dyldKeysPresent` is `false`". A T+0 refusal quarantines the packet, with no retry and no second live run. Step 8a repeats it for the T+0 rerun.
- **The real T−0 gate today.** I ran the node part of the §3c command myself on canonical `web/` (applied v5, tool `912041a5…`, `--loaded`), with `TMPDIR` and stdout in scratch. I did not write `attestation/`. Result: exit 0, exactly one line, and every "Required" field matches: `match`, both trees `76c7d466…`, `verified_before_load`, `dyldKeysPresent: false`, `loaded` `{256, 9, 1, 245, 34, 15, []}`, `differences: []`. It equals Chef's `G3-LOADED-912041a5.json` field for field, timestamps aside.
- **Standing.** The plan says correctly that nothing in the bridge or verifier reads the attestation. This is operator custody, as R1 asked, and is stated in the attestation's own `custodyNote`.
- **Who the rule binds.** The rule lives only in the operator docs. **Precondition:** whoever runs `convert.mjs` on the pilot packet must receive `OPERATOR-ATTESTATION.json` and check `g3.bothMatch === true` and `launcher.dyldKeysPresent === false` before converting.
- **Documented residual (§3b):** a change made after T−0 and undone before T+0 is undetectable from outside the process. Accepted for the pilot.

## (3) R3: launcher DYLD prefix refusal and the SIP caveat. **Specification PASS; bytes not reviewable yet**

- **The specification (§1, OPERATOR-ACCEPTANCE 6a)** is correct:
  - refuse on **any key beginning `DYLD_`** (prefix match), whether in the launcher's own environment or the env file;
  - report names only;
  - build node's environment from the allowlist;
  - record `launcher.dyldKeysPresent: false` in the attestation.
- **Probe v2** (`6218eba8…`) applies the same prefix rule to the env file and its own environment (lines 70–71, 128, 137–139).
- **G3** refuses `DYLD_*` in its own environment. I confirmed this with `env -i … DYLD_FOO=1 node dependency-tree-hash.mjs …` → `dyld_env_present`, exit 1.
- **SIP caveat: verified true, and it matters.**

  | Command | `DYLD_*` keys seen |
  |---|---|
  | `DYLD_FOO=1 /bin/sh -c env` | 0 |
  | `DYLD_FOO=1 /usr/bin/python3` | `[]` |
  | `DYLD_FOO=1 /usr/local/bin/node` | `['DYLD_FOO']` |
  | `/usr/bin/env -i DYLD_FOO=1 /usr/local/bin/node` | `['DYLD_FOO']` |

  So a shell or Python launcher's own-environment check is blind, as the plan says. The real protections are the env-file check and an **allowlist-only** environment for node, because `env -i KEY=… node` passes whatever the launcher names.
- **Not verifiable today:** the launcher's run mode is "not written yet" (§1). **Launcher-review precondition (R3):**
  - the launcher builds node's environment strictly from the §1 allowlist, so it can never name a `DYLD_*` key;
  - it refuses any `DYLD_*` key in the env file;
  - it writes `dyldKeysPresent: false` from that check;
  - its hash is in the approval.
- **Low (wording):** G3's stdout field `dyldKeysPresent: false` describes **the checker's** environment. That environment is always `env -i PATH TMPDIR`, so the field can never be true. It says nothing about the capture launch. §1 says G3's node-side check at T−0/T+0 "remain[s] meaningful". It shows only that the checker itself was not launched with `DYLD_*`. The capture-side evidence is the attestation's `launcher.*` fields. No change is needed if the verifier reads it that way.

## (4) Is precondition 2 closed for the pilot?

**R0 is closed on bytes and R1/R2 are closed as procedure. R3 is NOT CLOSED: it moves to the launcher review.** For the pilot, precondition 2 holds once all of these are true:
- the operator follows steps 4, 6 and 7: T−0 and T+0 `match`, both recorded in the attestation;
- the person converting checks the attestation first;
- the reviewed launcher meets the R3 precondition above.

**Residual limits, all accepted or documented:**
- Custody only: the bridge cannot verify G3 or the attestation.
- An edit made and reverted between T−0 and T+0 is not detectable.
- Capture-side typescript loads before the bootstrap's pin check. G3 covers it only by custody.
- My RECHECK-6 dynamic runs covered success paths only. Every lazily loaded file I can identify sits inside a hashed package.
- **Low ordering note.** Probe v2 runs the bootstrap `--check` and its snapshot child, both tree code, before its own G3 step (plan §3a, left as is because v2's hash is pinned). At T−0 itself, make G3 the **first** process that touches the tree. Step 4 already has it first in the T−0 sequence.

Reproducers:
- `repro/recheck6/g3-self-check.sh`, rerun unchanged;
- `repro/recheck7/probes.sh`: the canary probe in three packages with `--loaded`, the SIP stripping table and G3's `DYLD` refusal. Its last run gave `refuse`, 0 canaries fired, the same table and `dyld_env_present`.

The scratch logs are volatile; the scripts regenerate them.
