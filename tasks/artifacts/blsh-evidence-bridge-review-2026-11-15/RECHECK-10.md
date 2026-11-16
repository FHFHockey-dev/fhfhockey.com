# RECHECK-10: G4 approved-tool list change (2026-11-15)

Offline and read-only. Nothing outside this review folder and my diary was written. Scratch: `$S/mirror10`, `$S/tmp-tests10`, `$S/r10c`.

## Verdict

**APPROVE** `frames.mjs` `8b57ffbf…`, with `APPROVED_ACQUISITION_TOOLS = ["aa8a9cb7e90b057e53524f3ebabc261f32f67b06eac79b4e75d64298e432b107"]`, and the adapted tests (`bridge.test.mjs` `d2283c19…`, `fixtures.mjs` `5128fb98…`).

**Custody consequence, stated plainly:** any acquisition directory that is well-formed, carries the real `aa8a9cb7…` tool bytes and is consistent with an approved conversion now yields **production** frames (`mode: "production"`, receipt class `acquisition_v2_tls_verified`), even if every fact in it was hand-written. Nothing in the directory proves the tool ran. Only the operator's custody of an untouched directory does.

## Bytes

Bridge `SHA256SUMS` `3f50a7c4…` checks **29/29 OK**. Compared with the RECHECK-5 sums, the rows that changed are `frames.mjs`, `tests/bridge.test.mjs`, `tests/fixtures.mjs`, `README.md`, `ACQUISITION-SPEC.md` and `TESTS.log`. The file list is unchanged and `acquire-boxscores.mjs` is still `aa8a9cb7…`. `ACQUISITION-SPEC.md` was not in Chef's list; its diff is four documentation lines about the list (G4), with no rule changes.

## (a) `frames.mjs` differs only by the list line and its comment. **PASS**

`diff` against my RECHECK-5 mirror copy (`9a5875dc…`) shows one hunk at lines 29–31: the doc comment, rewritten to name RECHECK-4, Chef, TJ and RECHECK-10, and `Object.freeze([])` → `Object.freeze(["aa8a9cb7…"])`. Nothing else changed.

**Low:** two comments are now stale:
- `frames.mjs:16` still says the list "stays EMPTY until the tool is independently reviewed";
- `acquire-boxscores.mjs:2` says its hash "is NOT in … APPROVED_ACQUISITION_TOOLS".

Leave the tool's comment alone: editing it changes the approved hash. The `frames.mjs` comment can be fixed at the next reviewed `frames.mjs` change.

## (b) Exactly the RECHECK-4-approved hash; nothing else accepts it implicitly. **PASS**

- **The hash.** The listed hash is the full `aa8a9cb7e90b057e53524f3ebabc261f32f67b06eac79b4e75d64298e432b107`. It equals `sha256(acquire-boxscores.mjs)` today, and it is the hash RECHECK-4 approved, whose diff from `4f8a0888…` was only the two `APPROVED` constants plus a comment. Test 15 now asserts both facts.
- **One read site.** The list is read only at `frames.mjs:102`, inside `verifyAcquisition()`, against `toolSHA256 = sha(files.get("source-tool.mjs"))`. `frames.mjs` computes that hash itself (line 84), and it must also equal the runtime's `toolSHA256` and the launch block's `entryScriptSHA256` (line 89).
- **No other acceptance.** No other file in the bridge (`convert`, `assemble`, `propose-policy`, `lib`) or in the tool references the list or the hash.
- **Test mode.** It skips this check, but it is a function option only, its output is marked, and `propose-policy` refuses it, as before.
- **The tool check is the last `need()` in `verifyAcquisition`.** Every earlier defect check still runs first, so listing the hash relaxes nothing else.

## (c) The "unreviewed tool" refusal is still covered. **PASS**

- **The fixture.** `UNREVIEWED_TOOL_BYTES` is the real tool with its final newline replaced by a space: same length, different hash, and asserted to differ from the listed hash. `makeAcquisitionDir(..., { toolBytes })` binds it with **consistent** runtime and launch hashes.
- **The three tests:**
  - test 3: `writeFramesFromAcquisition` → `acquisition_tool_not_reviewed`, with no output directory;
  - test 15: well-formed directory plus the one-byte tool → `acquisition_tool_not_reviewed`;
  - test 20: the production frames CLI → exit 2, `acquisition_tool_not_reviewed`, target untouched.
- **My own CLI probe** (`repro/recheck10/custody-probe.sh`, on the suite's `acq-cand`):
  - one-byte tool with the runtime and launch still claiming `aa8a9cb7…` → `acquisition_not_launched_canonically`;
  - one-byte tool with **consistent** hashes → `acquisition_tool_not_reviewed`;
  - no `frames-flip*` output was created in either case.

## (d) No assertion weakened beyond the three intended changes. **PASS**

The `bridge.test.mjs` diff has three hunks, one per test:
- **Test 3.** The old `tool_not_reviewed` expectation now applies to the one-byte tool. Added: real tool → production frames, `mode: "production"`, every frame `acquisition_v2_tls_verified`, `MANIFEST.json` present.
- **Test 15.** `deepEqual(list, [])` became `deepEqual(list, [aa8a9cb7…])`. Added: list equals `sha(TOOL_PATH)`; same length and different hash for the one-byte tool; `run(one-byte) === acquisition_tool_not_reviewed`; real tool → frames, all `acquisition_v2_tls_verified`. The defect cases after it in test 15 are unchanged.
- **Test 20.** Only the fixture call changed, gaining `toolBytes: UNREVIEWED_TOOL_BYTES`. The expected refusal and the "untouched" assertion are unchanged.

The `fixtures.mjs` diff only adds `UNREVIEWED_TOOL_BYTES` and a `toolBytes` option that defaults to the real tool. The `WEB` line is the original `join(REPO, "web")`; my mirror's line differs only by my usual scratch edit.

**Coverage moved, not lost.** Test 20 no longer exercises the frames CLI's `output_exists` path with a *valid* acquisition; it couldn't before G4 either. My probe covers it: real-tool input with an existing `--out` → `output_exists`, and the target held only `keep.txt`.

**Suite (mine).** 21/21 in scratch mirror `mirror10` on the applied v5 tree, with `BRIDGE_PINS` = v5 pins and the default vendored v5 verifier. The usual scratch-only `WEB` edit applied, and a `.git` pointer file was used for test 14's `git archive`, then removed. This agrees with Chef's `BRIDGE-TESTS-g4-final.log`.

## (e) Custody consequence, demonstrated

My probe ran the production frames CLI on the suite's hand-built `acq-cand`. Its facts are fixture-written, its tool bytes are real and nothing was fetched. Result: `{"ok":true,"frames":288}`, `FRAMES.json` `mode: "production"`, and all 288 frames with receipt class `acquisition_v2_tls_verified`. This is the same custody limit as the packet side (Q1, RECHECK-4). From here on, the only protection for the 2026-11-11 boxscores is the operator's custody: the tool runs under TJ's approval, into the fixed path, and the untouched directory goes straight to `frames.mjs`.

## RECHECK-4 preconditions still open for using the tool on the 2026-11-11 slate

**Met:**
- (1) v5 applied, suites green;
- (2) in-process integrity: RECHECK-9, closed for the 2026-11-17 pilot, subject to TJ approving launcher `31c370c3…`;
- (5a) the list change, by a non-author at TJ's direction, now reviewed (this recheck).

**Still open:**
- **(5b) TJ's separate run approval** for the tool:
  - exactly 6 GETs, 0 retries, the exact launch;
  - the fixed `fhfh-blsh-boxscores-20261111` output path absent beforehand (absent today);
  - run right after an **approved v5 conversion** (the tool refuses any other: `conversion_not_approved`);
  - output handed untouched to `frames.mjs`.
- **The capture and conversion themselves:** the 2026-11-17 slot under launcher `31c370c3…`, plus (3) custody and attestation (T−0 and T+0 G3, `g3.bothMatch`, `launcher.dyldKeysPresent: false`, checked before conversion).
- **(4) Bridge inputs** stay pinned: pins `a2a1e694…`, verifier `b86af692…`, node `daa77e22…`, lineage `14e0816c…`.
- **(6) Timing:** gate evaluation within 24 h of the earliest evidence, on a UTC date no later than 2026-11-18.
- **(7) Holds:** dotted-code teams stay held, the on-ice page format is still unproven on real bytes, and windows are never admitted.
- **(8)** An independent `reviewSHA256` fills the policy entry and a separate policy owner installs it. `TEST_ONLY` proposals are never reviewed.

**Repository state:** HEAD is `a9d1eb507`, unchanged since RECHECK-9. No `fhfh-blsh-*` output directory exists. The canonical bridge sums are 29/29 after my runs.

Reproducer: `repro/recheck10/custody-probe.sh`.
