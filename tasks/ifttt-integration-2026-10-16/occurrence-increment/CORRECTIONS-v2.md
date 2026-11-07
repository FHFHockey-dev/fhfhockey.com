# Occurrence v2 correction checkpoint — bounded independent review accepted

Frozen source/test/oracle/runner manifest: `owned-source-v2-sha256.json`, 49 paths, SHA256 `b113230355acae6cbc3c1c75bad94d6d56afa9d65b6061effed651d79c90789a`. All 41 accepted v4 pins and both staged SQL migrations remain byte-identical. The additional runtime module is still pure and unwired, excluded from the captured production release. No storage, consumer or dispatch behavior is newly accepted here.

The original rejected candidate, runner output, independent failures and review are preserved. `../review-occurrence/REVIEW.md` is authoritative for that review. Earlier candidate output is also retained as `../offline-completion/baseline-occurrence-v1-*`; original baseline v4 output and the 52-case JSON are unchanged.

## R10–R13 corrections

- R10: a changed extraction with overlapping subject AND predicate in the same immutable text is held across the same receipt or bound original. Exact repeats still reuse their token; disjoint repeated lexical occurrences remain distinct.
- R11: text variants are held across all receipts of the same bound original. Same post ID with conflicting author/publication evidence also rejects across receipts. A new receipt cannot manufacture a new occurrence or erase earlier identity evidence.
- R12: the full-document validator now requires exact input subject/predicate spans and matching relative starts AND ends on both sides. Four unchanged malformed-end reviewer probes now reject; author checks additionally cover either input side.
- R13: the task runner snapshots all prior immutable source, lexical anchor, evidence, interpretation, association, alignment, history, legacy payload/link and effect fields, plus candidate identity rows, before each ingest. It compares those exact canonical payloads after the step, including before any effect exists. Documented effect status/dispute changes and appended links/anchors are allowed; deletion, rewrite or duplicate immutable IDs are detected. Candidate output records this exact manifest path and SHA, separately from its v4 runtime baseline.

The isolated `--mutation-control` option deliberately rewrites the earlier pending interpretation during a verified upgrade. It does not change the fixture or expected assertion. The ordinary CR019 immutable-row count is 0; the control changes it to 1 and the unchanged assertion fails. This proves the runner observes the particular previously missed rewrite; it does not claim that the planner actually performs that rewrite.

## Checks actually run

15 owner identity tests, 16 task audit tests and the 6 unchanged reviewer regressions pass (37 test executions). Targeted strict TypeScript for the new pure source and audit module and scoped ESLint for the occurrence source/test pass. The task-local test config initially failed startup because the base config has no explicit include list; the corrected config passed. No aggregate compiler/build or database/network test was started for these pure corrections.

The unchanged oracle still has **41/43 pure cases and 194/196 assertions passed**, CR011/CR051 failed, and 9 exact persistence DSL cases deferred. The command exits 1. The negative-control run has one additional expected CR019 failure. See `owner-checks-v2.json`, `acceptance-v2.log`, `negative-control-v2.log` and the full JSON reports under `../offline-completion/`.

Independent review reran all 37 focused tests, the byte-identical copied runner and both negative controls. All 49 pins rehashed unchanged; R10–R13 are closed in the bounded pure candidate. The narrow CR019 token/native-ID projection and immutability boundary are accepted; this does not extend v4 held/shadow acceptance to durable occurrence integration. See `../review-occurrence-v2/REVIEW.md` when the final report is saved. `DURABLE-INTEGRATION-GATE.md` names the next actual RPC/CAS/fault-proof increment. `CROSS-TEXT-PROOF.md` names the unresolved CR011/CR051 evidence/policy question; game scopes or fabricated concatenated text do not answer it. TJ subsequently approved the exact catalog retry: query one ran but withheld metadata at its size guard, so query two was stopped (`../offline-completion/CATALOG-READ-RESULT.md`). All operational and genuine future-performance gates remain open.
