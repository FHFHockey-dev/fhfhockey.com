# E07–E16 diagnostic continuation: CLI serialization repair

**Inactive R2 proposal, pending independent review. No paid calls, credentials, application changes or deployment occurred.** This revision fixes the audit's `persisted_artifact_changed_before_seal` reproduction. The real ledger remains disabled with seven calls and $0.265263690 aggregate exposure, including the historical uncertain reservation. Prior paid failures, receipts, candidates and both previous diagnostic proposals are preserved.

## Exact repair

The unchanged [review CLI](../../../../web/scripts/review-ifttt-luna.ts) writes `JSON.stringify(value, null, 2) + "\n"`. R1's checkpoint instead expected compact JSON. [diagnostic-checkpoint.ts](diagnostic-checkpoint.ts) now exports that exact CLI-compatible serializer and records `json-indent-2-trailing-newline-v1` in a version-2 checkpoint. It still compares the saved bytes with independently verified expected objects and stops on a mismatch. It does not normalize or rewrite original files, receipts or grades. The diagnostic classifier is byte-identical to R1.

For each report, the unchanged CLI creates `E07.original.json` and `E07.candidate.json` (substitute the current case ID). The supervisor reads those original bytes, verifies the saved receipt and original review, and creates `E07.receipts.json` and `E07.diagnostic.json` using the exported serializer. It then seals `E07.checkpoint.json` using the same serializer, exclusive writes, and file/directory fsync. All five files and the full ledger prefix must recheck against trusted anchors before advancing or declaring completion. Unexpected bytes are an operational stop; parsing and rewriting a file into compliance is forbidden.

## Offline evidence

[verify-cli-path.ts](verify-cli-path.ts) invokes the actual, pinned CLI as a child process, then feeds its actual files through classification, sealing and the next-case integrity check. The child environment is rebuilt without an env-file option; it contains only a literal fake credential. The network-denial preload remains active, and [mock-cli-provider.cjs](mock-cli-provider.cjs) implements a prescribed fetch with no network fallback, exact request/body checks and a fixed test clock. Disposable ledgers preserve the initial seven receipts and bounds. CLI `--dispatch` in this test exercises the local code path only; it cannot send a provider request.

All nine integration scenarios passed: 42 child CLI invocations, 48 synthetic fetches, **zero provider requests**. A second compare-only run reproduced all evidence byte-for-byte (another 42 child invocations and 48 synthetic fetches; still zero provider requests), recorded in [offline-cli-compare.log](offline-cli-compare.log). [CLI-VERIFICATION.json](CLI-VERIFICATION.json) and [CLI-EVIDENCE/](CLI-EVIDENCE/) retain the original child-process bytes, classifications, checkpoints and final disposable ledgers.

| Scenario | Observed result |
| --- | --- |
| All pass | Ten reports and both conditional Decisions legs; all checkpoints verify. |
| Identity label mismatch | Original failed grade retained; ten reports collected under the unchanged diagnostic policy. |
| E10 offset mismatch | Failed original grade retained; separate bound candidate remains unapplied; E10 Decisions permanently withheld; next case allowed only after sealing. |
| Uncertain E07 Responses | Stops after one mocked request; full $0.233 reservation and unknown-outcome stop preserved; no checkpoint or next call. |
| Uncertain E10 Decisions | Stops after five mocked requests; full reservation retained; no E11. |
| Explicitly incomplete E10 Decisions | Operational stop before E11; no checkpoint for incomplete report. |
| E07 schema/authority violation | Operational stop after one mocked request. |
| Candidate destination already exists | Actual CLI exits 1 before any mocked fetch; occupied file remains unchanged; no classification or checkpoint. |
| E07 original corrupted after sealing | Next integrity check stops before E08; deliberate corruption affects only a disposable test artifact. |

A separate compact-format copy is rejected with the original audit error, proving that compatibility did not become permissive JSON normalization. Normal classification and sealing preserve original CLI and candidate bytes and all receipt data. The post-seal corruption scenario is explicitly marked as a fault injection; its corrupted test file is retained without silently repairing it.

The 59 prior control scenarios also pass with the new serialization, including both-endpoint incomplete/error indicators, all required artifact deletion/corruption, ledger-prefix mutation, during-call mutation and final-completion corruption. Scoped TypeScript passes. [OFFLINE-VERIFICATION.json](OFFLINE-VERIFICATION.json), [offline-verification.log](offline-verification.log), [offline-cli.log](offline-cli.log), [typecheck.log](typecheck.log) and [VERIFICATION.json](VERIFICATION.json) record the checks. No application suite/build was needed because application code is unchanged. Prescribed replies test controls and integration, not model accuracy.

The new integration verifier supports an exact compare-only replay from `web/`; it recreates disposable outputs and compares them byte-for-byte with the frozen evidence without overwriting it:

```sh
env -i PATH="$PATH" TMPDIR=/tmp NODE_PATH=.:./node_modules NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowJs":false}' node --experimental-require-module -r ts-node/register/transpile-only ../tasks/artifacts/luna-reference-package-2026-10-31/diagnostic-e07-e16-r2/verify-cli-path.ts --compare
env -i PATH="$PATH" TMPDIR=/tmp NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' ./node_modules/.bin/tsc --noEmit --incremental false -p ../tasks/artifacts/luna-reference-package-2026-10-31/diagnostic-e07-e16-r2/tsconfig.json
```

The 59-case `verify-continuation.ts` retains its exclusive-output behavior: rerunning it in the frozen directory refuses to overwrite evidence. Its retained log is the actual successful run. Do not describe a direct second invocation as a successful replay.

## Unchanged execution limits and residuals

[PLAN.json](PLAN.json) freezes E07 → E08 → E09 → E10 → E11 → E12 → E13 → E14 → E15 → E16. Only E10 and E11 may have a Decisions call, and only if the original Responses validates in the existing caller. Maximum **12 new calls, 19 cumulative**, within the unchanged global 20-call/$1 caps; the remaining slot cannot be repurposed. Exclude all E01–E06 and their unsent Decisions. Zero retries, concurrency one, $0.233 per-call reservation, $5 promotional reserve, and unchanged batch expiry **2026-11-01T23:59:59Z**. Starting exposure is $0.265263690; additional exposure headroom is $0.734736310. The $0.030071588 estimate is neither an invoice nor a token ceiling.

All examples remain exposed synthetic development data, including the uncalled cases; they are neither independent holdout nor human ground truth. S01–S10 are omitted. Original grades and holds remain authoritative; candidates cannot change them, drive Decisions, authorize publishing, or train automatically. The classifier is a post-report supervisor guard: the unchanged CLI can consume a same-report Decisions leg before classification; both allowed legs are budgeted. Supervision and external trusted anchors remain necessary. Hashes do not authenticate against an operator able to alter every trust anchor. This package creates no automated production loop.

Independent review of this exact revision is pending. Later execution still needs fresh funding/concurrent-spend, restricted credential, unchanged pin/ledger and expiry checks, followed by supervised activation of only the reviewed three ledger fields. No live preflight was performed in this offline turn. The owner's non-expiring key exception does not extend batch expiry; verified key revocation/rotation remains a separate production gate. Hosted dispatch, publishing and production deployment remain unauthorized.

## Pins

- Plan: `af1499f51ffd1baba22aee3fbefd20a0bc1919b12bbc972289bcf0f7d5d431b5`.
- Checkpoint helper: `0c58ea53ad665cd7851c6180e44b62f3e32d32c7cd50930663b573a49ef44fb4`.
- Unchanged classifier: `5e96e99beb1558c66f00c73cdce49f3b722cbdf7f4395f6fbb6388ec7cd1da20`.
- Unchanged packets: `b50ace71b2f7ad72d6ea86cbeb93c7427b729b1d44b5d623369f5777e98fef41`.
- Unchanged requests: `d59caecc7bb6d2c237c49d437259c66a7cbf097e232c71d538dc63a41cfc6fc4`.
- Disabled seven-call ledger: `2bf56d754b1f98888785b8d7e759d1c701b5541b0fb9e91ade63eff041ff3ceb`.

[FILE-PINS.json](FILE-PINS.json) pins this revision. No action was denied and no new real provider outcome is uncertain. Independent review and fresh execution preflight are pending; all paid execution remains stopped.
