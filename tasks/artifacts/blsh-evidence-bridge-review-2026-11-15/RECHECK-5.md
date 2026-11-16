# RECHECK-5: post-apply test-only change (2026-11-15)

Scope: the bridge author's test-setup fix after `SUCCESSOR.patch` `e8be50de…` was applied (uncommitted) in the canonical checkout. Offline only. Nothing outside this review folder and my diary was written.

**Verdict: APPROVE.** The change is test-only, the applied-tree path refuses every third state, test 14 still runs a real unpatched runner, and no assertion was weakened or removed.

## Bytes checked

| File | RECHECK-4 | Now |
|---|---|---|
| `SHA256SUMS` | `d2de8763…` | `003b5750…` (29/29 OK, before and after my runs) |
| `tests/fixtures.mjs` | `81e054e4…` | `3c5f57a4…` |
| `tests/bridge.test.mjs` | `1eeb6144…` | `be63e2c0…` |
| `README.md` | `5eb126cf…` | `8551e84b…` |
| `TESTS.log` | `2d01f6f6…` | `70117643…` (rerun log, not code) |

Baseline: my RECHECK-4 mirror (`$S/mirror8`) holds the RECHECK-4 `SHA256SUMS` and every file's bytes (its `fixtures.mjs` differs from `81e054e4…` only by my documented scratch `WEB` line).

## (a) Only test files, README and sums changed: **PASS**

`diff` of the RECHECK-4 and current `SHA256SUMS`: only the five rows above differ. The file lists are identical (no added or removed files). Unchanged, among others: `convert.mjs 54e3d624…`, `frames.mjs 9a5875dc…`, `assemble.mjs 836f3bca…`, `propose-policy.mjs ae222ecd…`, `lib.mjs 6dc88336…`, `acquire-boxscores.mjs aa8a9cb7…`, `tests/acquire-harness.mjs`, `tests/observation-equivalence.mjs`, and everything under `approved/`. `TESTS.log` is not code: with `duration_ms` lines stripped it is identical to the RECHECK-4 copy (still 21/21), so only timings changed. Chef's list omitted it.

## (b) Applied-tree path verifies role hashes and refuses any third state: **PASS**

`successorSources()` now runs `patch -p1 -s -f --dry-run` forward and with `-R` against a scratch copy:
- forward only → apply in scratch (`patched_in_scratch`);
- reverse only → no apply (`already_v5`);
- both or neither → `successor_tree_unrecognised`.

**In both accepted states,** the runner, adapter, preparation and bootstrap must then equal the vendored v5 pins (`successor_tree_role_mismatch:<role>`). `-f` stops `patch` from guessing that a patch is reversed, so a forward dry run on a v5 tree fails cleanly.

Reproducer `repro/recheck5/probe-successor-states.mjs` calls the bridge's own `successorSources()`/`exportBase()` on scratch trees. I ran it with both GNU patch 2.7.6 (the default on `PATH` here) and Apple `/usr/bin/patch` 2.0-12u11. Results were identical:

| Input tree | Result |
|---|---|
| live canonical (v5 applied) | `already_v5`, roles `a74cbb0a`/`aa6237bd`/`dbf69c47` |
| `git archive` of base `a9551076` | `patched_in_scratch`, same v5 role hashes |
| base + only the v5 runner | `successor_tree_unrecognised` |
| v5 with base bootstrap | `successor_tree_unrecognised` |
| v5 + bootstrap garbage | `successor_tree_unrecognised` |
| v5 + adapter appended | `successor_tree_role_mismatch:adapter` |
| v5 + runner appended | `successor_tree_role_mismatch:runner` |
| v5 + preparation appended (not in patch) | `successor_tree_role_mismatch:preparation` |
| base + runner appended | `successor_tree_role_mismatch:runner` |
| base + preparation appended | `successor_tree_role_mismatch:preparation` |
| v5 + runner **test** file appended (non-role) | `successor_tree_unrecognised` |
| all patched files emptied | `successor_tree_unrecognised` |

The live runner hash was unchanged after the probes.

**Mutants** (`repro/recheck5/mutate-successor.sh`): each mutant edits a scratch mirror's `fixtures.mjs`, then runs test 14 only.
- `third_state_accepted`: the unrecognised branch is turned into `already_v5`. **Killed.** The test 14 assertion fails; the refusal arrives as `role_mismatch:runner` instead. The role-hash check also blocks this case on its own (defence in depth).
- `role_check_dropped`: the role-hash loop is removed. **Killed** (`Missing expected exception` on the drift case).

Low note: once `<scratch>/<name>` exists, `successorSources()` returns its cached `STATE` without re-checking. The cache lives in the per-run `mkdtemp` scratch and is keyed by name, and tests 3/18/19 reuse the same source, so this has no effect today.

Low note: both mutants are killed by test 14's base-origin cases. No suite test feeds a **v5** tree with drift, so a mutant that skipped the role check only when `state === "already_v5"` would likely survive the suite. On the current bytes, applied-tree refusals are shown by my probe table only, not by a regression test. A follow-up test could copy the live v5 `blsh` folder, append to the adapter, and expect `successor_tree_role_mismatch:adapter`.

## (c) Test 14 still runs a real unpatched runner: **PASS**

Test 14 now exports base commit `a955107671ee…` with `git archive`. That commit is an ancestor of HEAD `cb42e6c12`, and `git diff a9551076 HEAD -- web/scripts/blsh web/lib/nst web/lib/cron` is empty. The export:
- is read-only, with `GIT_*` stripped from the environment;
- is asserted to have runner `5ef3a631…` (Chef's pins, the unpatched runner) and client `1a568c28…`;
- runs Chef's vendored `rehearse.ts` with `cwd` set to the export. `rehearse.ts` loads the runner and preparation from `process.cwd()` unless `REHEARSAL_WEB` is set, and the test's explicit `env` does not set it;
- converts under `BASE_PINS_T` (Chef's pins plus the v5 bootstrap hash), so every role binding in the produced packet is checked against unpatched pins.

The rest of test 14 is byte-identical to the RECHECK-4 version: the shape comparison, the `tls_observation_missing` veto, and injected-facts conversion.

## (d) No assertion weakened or removed: **PASS**

Every line removed from `bridge.test.mjs` is replaced:
- The rehearse spawn now uses `BASE_REHEARSE`, `BASE_REHEARSAL_CLOCK` and the base export as cwd, in place of `REHEARSE`, `REHEARSAL_CLOCK` and live `web/`.
- The conversion uses `BASE_PINS_T` in place of `PINS_T`. These are equal on the base tree, and the change is required on the applied tree.
- The tree-precondition message text changed. Its assertion did not.

Added:
- one `state` assertion in test 3;
- in test 14: two export hash assertions, the `patched_in_scratch` and v5-runner assertions, and two refusal assertions.

In `fixtures.mjs`, the only removals are:
- the `BRIDGE_REHEARSE` and `BRIDGE_REHEARSAL_CLOCK` env overrides, which narrow test 14 to fixed vendored inputs;
- the unconditional `patch` call, replaced by the state-checked one above.

`makeTestPins` keeps its old default behaviour.

## Suite rerun (my own, on the applied canonical tree)

- **21/21 pass** (185 s). Run in scratch mirror `$S/mirror9`, with `BRIDGE_PINS=approved/v5/expected-pins.json`, verifier at the default vendored v5 `b86af692…`, `TMPDIR` in scratch, and `GIT_DIR` unset. Test 3 recorded `already_v5`.
- **Mirror setup:**
  - It has a `.git` *file* pointing at the canonical object store, so `git archive` can read the base commit. Nothing else in git is used.
  - It uses the same scratch-only `WEB` line edit as in RECHECK-3/4. With the bridge's own `join(REPO, "web")`, the mirror's `web` is a symlink, so the canonical launch proof refused it: tests 3, 15, 19 and 20 failed with `runtime_not_launched_by_bootstrap` / `acquisition_not_launched_canonically`. That is a mirror artifact, not a defect: those checks are meant to require the canonical path.
- **This agrees with Chef's** `g1-canonical/BRIDGE-TESTS-postapply.log` (21/21).

After all runs:
- canonical bridge folder still holds 30 files; `SHA256SUMS` 29/29 OK;
- `HEAD` still `cb42e6c12`; no new reflog entry or stash. The scratch `.git` pointer files were deleted after the runs;
- `git status` identical to before;
- the fixed boxscore output path does not exist.

## Verdict

**APPROVE** the post-apply test change (`tests/fixtures.mjs 3c5f57a4…`, `tests/bridge.test.mjs be63e2c0…`, `README.md 8551e84b…`, `SHA256SUMS 003b5750…`).

No non-test code changed, so the RECHECK-4 verdict (APPROVE tool `aa8a9cb7…`) and its v5 preconditions stand unchanged. On precondition 1: Chef's `g1-canonical/BRIDGE-TESTS-postapply.log` reports 21/21 on the canonical applied tree, and my mirror run (with the `WEB` edit) agrees. I did not recheck the successor's own capture suites (`CAPTURE-SUITES.log`). Precondition 2 (in-process module integrity beyond undici) is not addressed by this change.
