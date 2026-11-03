# Focused independent BLSH fix re-review — 2026-11-01

Both prior findings are closed for the reviewed implementation. No remaining correctness finding was identified within this two-guard change. This is local research-adapter acceptance only, not empirical model, integrated-app or production acceptance.

## Guard correctness and original reproductions

- **P2 closed:** `midseason-absence-cohort-20261101-01/cohort.py:58–59` now requires a nonempty list containing only nonblank strings, followed by exact registry membership. The original empty candidate + empty registry probe now raises `ValueError: Missing explicit episode evidence`. Empty candidate + populated registry, missing/null/non-list references and blank/non-string elements are covered. Short-circuiting validates element types before constructing the reference set. Episode-specific source meaning still requires human review, as the checkpoint correctly states.
- **P3 closed:** `absence-ledger-replay-20261101-01/ledger_replay.py:66` now requires `row.get('team_abbrev') == 'SEA'`, consistent with this adapter's fixed qualified team ID 55. The original BOS row probe now raises `ValueError: Metric row identity mismatch`. Missing, null and empty team labels also reject. A wholly missing appearance row still produces an unavailable appeared event with value null. Valid zero, absent-game nulls and missing FP operands retain their existing behavior.

No broader abstraction or source-selection change was introduced. Actual current-file diffs exactly reconstruct `CHANGES.patch`, covering only two adapters, two adjacent test files and two source-pin manifests. Current source/shared pin manifests and every file listed by the fix FINAL-RECEIPT match actual hashes.

## Tests and regression sensitivity

Independently ran **32/32 tests: 18 cohort and 14 Tanev adapter**. All passed. Independently reran both original reproductions, which reject as above.

For a sensitivity check, restored each old function in memory only and ran the four new regression methods against it. All four failed or errored as expected: empty-proof tests produced two assertion failures; malformed-proof tests exposed two old non-ValueError paths; wrong-team produced one failure; missing-team produced three failures. Restored the current functions afterward. No source file was modified. These deliberate old-code failures are evidence the regressions distinguish the fix, not failures of the corrected implementation.

Evidence: `fix-rereview/tests.log`, the four `*-old-guard.log` files, `fix-rereview/RESULTS.json`, and `fix-rereview/verify.py`. Checks used an atomically acquired shared heavy lock and released it afterward.

## Independent equivalence checks

Compared the actual `replay-01` and `replay-02` files directly, rather than trusting EQUIVALENCE.json assertions. All eight claimed exact comparisons match byte-for-byte and match the reported hashes: both summaries, both fixed baseline files, both five-policy trace files, Tanev visual-check JSON and cohort qualification JSON.

Both adapter-event payloads match recursively after excluding only `known_at_utc`; verified the packaging timestamp changed in each event. Counts independently reconcile to **59 unique ledger events, 37 null-valued absences, 22 appearances and 295 policy steps**. Thus the prior independent numerical/source audit remains applicable to the unchanged frozen results. Baseline membership and statistics did not change, and the existing fixed-baseline object checks remain present and pass.

Inspected all five implementer `PROCESS-RECEIPT.json` files for tests-02, qualification-02 and replay-02: exit code 0 and own-lock release recorded. Full data qualification/replays and image rendering were not rerun by this focused review; their retained outputs and receipts were checked. No claim of new browser, visual-image or integrated-app QA is made.

## Unchanged limitations and boundaries

The 150 fixed baseline rows still have 133 unknown calendar links. Human episode-proof interpretation, provisional half-lives/alpha, convenience-cohort selection, partial independent PPP validation and absence of predictive evidence remain the limitations recorded by the original review. They are not resolved by these guards and are not new defects in this patch.

This re-review made no source, score or original-data edits, and no web/provider/API/NST/database/production request, reserved-season read, Git ref/index mutation, deployment or dependency change. Only review evidence and the required diary were written. No denied/pending action or uncertain mutation; no blocker to closing the two prior adapter findings.
