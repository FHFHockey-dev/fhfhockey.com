# Two verifier checks completed — paired development result

Both approved Decisions calls completed with HTTP200, sequentially and without retries. No extraction was repeated. The retained successful Luna output was reused only after the explicitly audited, independently accepted exact-quote alignment. Original raw output/grades remain unchanged.

| Proposal set | Whole-set support probability | Input/output tokens | Round-trip plus usage validation | Settled charge ceiling |
| --- | --- | --- | --- | --- |
| Unchanged rules |0.70 |595 /0 |924ms |USD0.00006545 |
| Luna plus explicit quote alignment |1.00 |824 /0 |156ms |USD0.00009064 |

These are the endpoint's **uncalibrated estimated probabilities**, not percentages of claims proven correct. Each request asks one predicate about its whole proposal set (one rules claim versus two Luna claims). No per-claim rationale or field scores were returned. The verifier is also gpt-6-luna; it is not independent corroboration or human adjudication. The descriptive probability difference0.30 and the single-call latency differences establish no population effect, calibration or reliable winner.

## Four paired arms and preserved holds

| Arm | Field-matched TP /FP /FN | Model support | Held /accepted /usable |
| --- | --- | --- | --- |
| Rules only |0 /1 /2 |— |1 /0 /0 |
| Rules +Decisions |0 /1 /2 |0.70 |1 /0 /0 |
| Luna +alignment only |2 /0 /0 |— |2 /0 /0 |
| Luna +alignment +Decisions |2 /0 /0 |1.00 |2 /0 /0 |

The0.95 threshold was frozen before these calls. The0.70 rules result adds `one_question_verifier_unknown_or_not_all_supported` alongside its original `unresolved_time` hold. The1.00 Luna result clears nothing: IR retains `unresolved_time`; the pronoun-only absence quote retains `single_subject_evidence_unproved`. All four arms have zero usable updates and two actionable misses. Native/world/publication eligibility remains false.

Luna's TP2 reflects **software-postprocessed** source anchors under the existing gradable-field masks. The original model supplied two wrong spans; its strict raw output grade remains preserved separately. The numeric player IDs remain populated contrary to the pilot's null-ID instruction, unverified and excluded by the support question and frozen grading mask. High support does not certify identity, applicability dates, medical clearance or a formal antecedent binding. This is one previously exposed historical family with provisional agent-derived labels, not human gold or a genuine future holdout.

The aligned Luna proposals have better field agreement and a higher set-support score on this particular example. Operational eligibility remains equally held across all arms. The verdict is **inconclusive for a general winner**.

## Usage and aggregate budget

Both replies reported zero output/cached/cache-write/reasoning tokens. Under the [published Decisions input-only price](https://developers.openai.com/api/docs/guides/decisions), base estimates are USD0.0000595 and USD0.0000824. The accepted10% envelope gives the settled conservative ceilings in the table. `usage-and-cost.json` retains exact rational arithmetic. These are usage-based ceilings, not final invoices.

| Accounting item | Amount |
| --- | --- |
| These two verifier calls |USD0.00015609 |
| All known successful calls, including reused extraction |USD0.000413078 |
| First poorly logged attempt, still reserved/unknown |USD0.2543948 |
| **Aggregate exposure** |**USD0.254807878** |
| **Unreserved within USD0.52** |**USD0.265192122** |

The reviewed pre-HTTP TLS failure stays settled at zero. Each verifier call reserved its full USD0.231 before sending, then released only its own unused reservation after safe usage settlement. The first call settled before the second began. Peak reserved exposure was USD0.485717238, below the unchanged USD0.52 cap. The first unknown reservation was not released. Aggregate final billing remains unknown because of that original attempt.

For arm attribution, the successful Luna extraction ceiling was USD0.000256988 and observed API latency3971ms. The Luna-plus-alignment-plus-verifier arm therefore has known API ceiling USD0.000347628 and observed API time4127ms, excluding unmeasured local alignment. Rules-plus-verifier has USD0.00006545 plus unmeasured local parsing. Shared extraction was charged once; do not sum those arm attributions as separate spends. One-case timing is not a performance benchmark.

## Evidence, checks and scope

- `run-01/check-0.json` and `check-1.json`: exact sealed requests, actual sanitized responses, safe request IDs, usage, latency and charge ceilings. The endpoint returned no response-ID field.
- `run-01/report.json`: paired outputs, all four grades, immutable holds, original raw model grade and provisional label provenance.
- `run-01/final-ledger.json`, `aggregate-budget-after.sqlite`: final accounting; the database file here is an immutable evidence copy. The one live aggregate remains `../comparison-retry-execution-2026-10-19/aggregate-budget.sqlite`.
- Source/request manifest SHA2564165e22e8422ee4d3acbca5043cc0db7367d608eb87e56c747105279bed34e2d matches all28 inputs after execution. Request wire hashes are a6d1545f1333711a3013b0c982831b3dcd0f5ee20232342680d2116ac1bfdfc9 and f2045125c0974867d185611928913f2bf8b5d65e92d8488680752fafb05d7e52.

13 new focused offline continuation controls passed before execution. The20 source-anchor tests and adapter were independently accepted earlier; this continuation has no new independent reviewer verdict. Post-run SQLite integrity is ok: exactly five attempts, with the three prior rows and reconciliation unchanged, and exactly two new settled Decisions rows. Earlier raw response/grade, alignment and reconciliation artifact manifests still verify byte-for-byte. No credential values/raw authorization headers were retained.

No approval or execution remains pending for these two checks. Both have finished; no new request is authorized. There was no extra extraction, paid grading, expanded sample, production mutation, deployment, publication, credential or system-trust change. Remaining eligibility needs independently retained applicability-time evidence for IR and an explicit reviewed antecedent/subject binding for the absence quote. Neither model confidence nor publication/receipt timestamps supply those facts. Genuine future evaluation remains necessary before choosing a reliable overall winner.
