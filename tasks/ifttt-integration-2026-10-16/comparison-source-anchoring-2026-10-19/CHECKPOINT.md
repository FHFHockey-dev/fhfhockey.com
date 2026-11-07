# Explicit offline source-anchoring correction

**Diagnosis:** the model supplied incorrect numeric offsets. The exact source text decoded from the transmitted request equals the retained policy text. It is137ASCII characters:137code points,137UTF-16 units and137UTF-8 bytes. Unicode conventions therefore do not explain these errors. The first quote has71units but the proposed [0,70) range has70; the second quote has65units but [71,126) has55. A uniform inclusive-end convention does not explain both. The strict UTF-16 slicing adapter correctly rejected them. No internal model counting method is inferred.

**Correction:** new `anchors.py` provides an explicit offline adapter. It preserves already-valid anchors. For an invalid numeric span, it searches for the unchanged literal quotation in the exact source. Exactly one occurrence permits deriving its UTF-16 offsets; no occurrence or multiple occurrences (including overlaps) remains held. It does not choose a nearest match, normalize case/Unicode/whitespace, expand quotation text, infer a subject, remove qualifiers, change claim fields or weaken the existing strict validator. Candidate spans pass that same validator. Every changed offset is recorded with before/after evidence and source-text hash. Batch errors still block the whole batch rather than silently dropping unresolved claims.

These are new task-local files (`anchors.py`, `evaluate.py`, `test_anchors.py`); exact added-file patches accompany them. Existing comparison.py, pilot.py, paid executors, prompts, labels and pipeline were not edited. The adapter is opt-in and exercised by the new retained-response offline evaluator. It is not wired into paid or production execution, and literal anchoring alone does not prove semantic support, qualifier completeness or source eligibility.

## Original versus explicitly postprocessed result

| Claim | Original model span | Corrected exact-source span |
| --- | --- | --- |
| IR placement | [0,70), rejected | [0,71) |
| Injury-caused absence | [71,126), rejected | [72,137) |

All non-offset fields and original quoted text are byte-for-value unchanged, including the populated player IDs. The null-ID instruction noncompliance remains disclosed; canonical identity truth stays ungraded. The second quote remains pronoun-only. No antecedent text was inserted to make it pass subject binding.

`offline-four-arm-results.json` reruns every arm for which authentic inputs exist. Frozen raw grades are reproduced exactly and retained untouched. Both rules and extraction receive the same explicit alignment policy:

| Arm | Original authentic-input result | Offline corrected result |
| --- | --- | --- |
| Rules only |1held proposal; TP0/FP1/FN2 | Unchanged valid anchor and grade |
| Extraction only |2raw proposals rejected;0admitted,2validation errors |2exact anchors;2/2field-matching propositions, but both held;0usable updates |
| Rules +Decisions | No authentic response exists | Not run; no invented score |
| Extraction +Decisions | No authentic response exists | Not run; no invented score |

The corrected extraction's TP2/FP0/FN0 describes the unchanged gradable source-proposition fields after deterministic software alignment. It is **not original model success**, actionable recall or representative quality. Accepted/usable counts stay0 and actionable misses stay2. Existing holds are `unresolved_time` for IR and `single_subject_evidence_unproved` for the isolated absence quote. No publication/world authority follows. The labels are unchanged agent-derived provisional annotations on one previously exposed historical family, not human-adjudicated/future holdout evidence; the comparison remains inconclusive.

## Verification and remaining work

**20focused tests pass**, covering the retained real response and grade preservation, emoji/code-point/UTF-8-to-UTF-16 differences, valid existing anchors, Unicode composition differences, repeated/overlapping text, absent quotes, strict whitespace/case, malformed spans, provenance/schema errors, duplicate IDs, batch rejection, invalid source Unicode, unchanged negation/conditions and pronoun hold preservation. Python AST parsing passes for all3new files. No broader application suite, compiler/build or independent candidate review ran.

The raw response, original grades, all prior execution artifacts and both original/aggregate ledgers are unchanged. Aggregate ledger SHA256 remains2da989c4526fdc0316af78242c9a0fc3d766607e363d88863d65aca7d3a627ce. Exposure stays USD0.254651788 and unreserved budget USD0.265348212 under USD0.52. This task made0provider calls, read0credentials and wrote0ledger rows. There was no deployment, publication, credential/configuration change or unrelated edit.

A Decisions comparison still needs authentic verifier responses bound to the exact rules and postprocessed extraction proposals after applicable review/authorization; none were simulated here. Verifier confidence may only add holds and cannot erase these existing scope/subject limitations. Further source/subject handling and genuine future evaluation remain separate work. No new provider request, spending or paid-pipeline change is authorized by this checkpoint.
