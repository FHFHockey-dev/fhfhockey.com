# R1 outgoing grammatical-slot correction

**Fixed locally; ready for independent re-review.** Only `web/lib/sources/tweetIdentityReplacementReview.ts` and its nearest test changed. The runtime repair is one comparison: the outgoing occurrence must start exactly at `incoming.evidence.end + " will take ".length`. Existing exact source/span/end checks and full-clause equality remain in force.

This rejects the final common noun `spot` and the predicate `will` when caller annotations select those repeated words instead of the possessive subject. Correctly positioned `spot`/`will` subjects still produce held review packets. Straight/curly apostrophes, Unicode offsets, unit evidence and full-source context retain their prior behavior. All authority flags remain false; no dispatch, swaps, publication, alias/status writes or new caller was added.

## Evidence

- Copied the reviewer's original synthetic setup and both R1 regression bodies into the nearest application test. The two original regression bodies remain verbatim; two correct-slot positive controls were added.
- Reproduced **both original failures** against the retained pre-fix helper in this task's scratch copy: received `reviewable_held`, expected `held`. `red.log` records two failures/nine skipped reviewer controls. An earlier test-port setup failure from a missing helper import is separately preserved in `red-setup-error.log`; it is not counted as defect reproduction.
- Corrected snapshot: **34 owner tests passed** (16 projection + 18 replacement), and **all 11 unchanged original reviewer controls passed**. That is 45 executions, with the two R1 regressions intentionally present in both suites; do not claim 45 independent new cases.
- Scoped TypeScript and targeted two-file ESLint: **exit 0**, no diagnostics. Scoped diff/whitespace checks and patch parsing passed.
- All 17 copied source/configuration files matched canonical bytes before/after corrected verification. The complete original reviewer test stayed byte-identical (`2eb47699a268abdaffe8043e8d4aad540fa6600f8565f9abb4981939332b53cb`).
- Of the original 55 owner pins, **53 remain unchanged**; only the intended helper and test have new hashes. All **40 retained trial pins** and reference digest `055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1` are unchanged. Historical owner/reviewer packets were not rewritten.

New source hashes:

| File | SHA256 |
| --- | --- |
| `tweetIdentityReplacementReview.ts` | `2be0e11a013683992ab449c6806311bd9c7bece0dce2be3a0b79e1399ee6516a` |
| `tweetIdentityReplacementReview.test.ts` | `3abe7656f8c7fae3f8474749cd9f4297ea428c8ea57efe8b83fe031028db8451` |

`correction.patch` SHA256: `ed584d5e242458530c23e4e1eeb835bcfd09a37b9835d7b857d857115c18b5f6`.

The checkout remained canonical `octoberBranch`. Starting HEAD was `fd58ba2452c0175b201e50285df156cb7f91b4f4`; concurrent work advanced it to `87ab20cbd6059d2e2116843f303ed00b4902c2ac` during verification. Both touched files at that newer HEAD still equal their exact saved pre-correction bytes. This patch is only the two-file correction; unrelated changes were preserved. No commit, reset, stash, branch/worktree change, deployment or external action occurred.

## Review packet and limits

- `CANDIDATE.json`, `SHA256SUMS`, `correction.patch`: exact correction and preservation proof.
- `FIXED-SNAPSHOT.json`, `corrected-source.tar.gz`: bounded 17-file source closure plus original reviewer test/configs; no dependency tree, environments or credentials.
- `fixed-tests.json`, `fixed-tests.log`, `tsc.log`, `lint.log`, `red.log`: actual receipts. `COMMANDS.md` records commands/environment.
- Baseline copies and `original-r1-controls.txt`: before/after review and verbatim regression proof.

The source-cutoff composition limitation remains an **integration gate**: a bare snapshot projected for a later source is not safe to reuse for an earlier causal source. Preserve full projection/mode lineage, validate the same source publication instant or regenerate per cutoff before wiring/evaluation. The unchanged reviewer characterization still passes; this narrow repair does not claim to resolve it.

No new paid/network/service/data action was attempted. The guard produced no diagnostics in corrected test/type/lint logs. Existing RNH persistence, historical-evidence unknowns, single-player/temporal gates and all operational restrictions remain intact. No full suite/compiler, browser, build, database or model test was run. Independent acceptance of the corrected hashes remains pending; there is no tool/permission blocker.
