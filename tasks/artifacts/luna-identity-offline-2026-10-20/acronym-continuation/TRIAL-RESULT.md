# Completed S06 identity shadow trial

Exactly one approved `gpt-6-luna` Responses request completed and passed the existing proposal validator. Both returned identities agree with TJ's development labels. No alias, claim, lineup, notification or production record was changed.

The original text was retained: “Podkolzin will take RNH’s spot on the first unit powerplay… via Babcock.” Published 2026-09-29T16:28:31Z, @JasonGregor, original post 2104971594632454155. Source spans are original UTF-16/grapheme boundaries.

| Occurrence | Experimental candidate basis | Existing baseline / improved deterministic assignment | Raw Luna proposal | Identity confidence |
| --- | --- | --- | --- | --- |
| `Podkolzin` [0,9) | Surname | Vasily Podkolzin, `nhl:8481617` | `matched`, `nhl:8481617` | `strong` |
| `RNH` [20,23) | Canonical name token initials; no verified alias | Abstain / abstain | `matched`, `nhl:8476454` (Ryan Nugent-Hopkins) | `tentative` |

The confidence words are uncalibrated identity labels, not probabilities or claim certainty. Owner labels were excluded from the wire and bound separately by unique occurrence ID and exact span for grading.

## Comparison and practical limits

On this one exposed development tweet, initial retrieval before the acronym correction contained the expected ID for Podkolzin and missed RNH. Corrected retrieval offered both expected IDs; no owner answer was inserted as a hint or alias. Existing baseline and improved deterministic assignment each made one owner-agreeing assignment and one abstention. Luna proposed two owner-agreeing assignments, no abstentions and no wrong-player assignments on these two occurrences. These are case counts, not estimated accuracy/coverage rates or release qualification.

The approved directory contains only two player candidates and is explicitly partial. It cannot establish league-wide acronym uniqueness, collision rates, performance on spelling mistakes/non-player text or representative retrieval recall. Both owner labels were already exposed development evidence, not an independently adjudicated holdout. No numerical generalization follows from this trial or the synthetic/mock checks.

The validator accepted the exact request/directory hashes, per-occurrence allowed NHL IDs, occurrence IDs and copied source spans. Registry IDs 10190/9521 remained distinct from NHL IDs 8481617/8476454. The roster intervals support team 22 at the actual source time under existing created_at/ended_at/current semantics; no team hint was inferred into the source. RNH remained a weak acronym hypothesis, not a verified global alias. All publication, alias-writing and status-changing authority flags remain false.

This tested upstream identity proposals only. It did not test the replacement operation, prior PP-slot state, game/timing confirmation, claim certainty inflation or claim subject binding. No model-written lineup or claim prose was requested or used. No live rollout occurred and alias-email volume is unaffected.

## Actual request, usage and cost

- HTTP status **200**, response status **completed**, exact returned model **gpt-6-luna**.
- Request ID: `req_5a5ef60809514649a56f317f2f02413a`.
- Response ID: `resp_0e89be16b75e0558016ad7f25a615487d28f3bb79829b88b42`.
- Input **1,930 tokens**, output **237 tokens**, total **2,167**; cached, cache-write and reasoning tokens **0**.
- Observed wrapper elapsed time **3,478 ms**, including admission/key loading and HTTP through result capture, rather than a separately measured provider-only latency.
- Usage-derived standard token price: **$0.000311500** (1,930 × $0.10/M + 237 × $0.50/M).
- Conservative ledger charge ceiling including the documented 10% regional envelope: **$0.000342650**. Actual invoice/region attribution was not queried or verified.
- Pre-admitted maximum reservation: **$0.231844800**, based on the full context/long-rate bound. Only this new attempt was settled to evidenced usage and its conservative charge ceiling.
- Aggregate accounted exposure after settlement: **$0.262519843** under the original **$0.52 TOTAL** cap. This remaining headroom does not authorize another request.

Only one provider request was dispatched. There were no retries after dispatch, paid widening requests, Decisions requests, reviewer fan-out or model substitutions. The earlier execution rejection occurred before process creation; after explicit user confirmation, its admission was retried once and admitted.

## State and preservation proof

Attempt `identity-s06-shadow-v1-0` is **settled**, reserve 231844800 nano-USD, actual conservative charge 342650 nano-USD. The original 36 attempt rows, experiment, reconciliation records and prior authorization records have the same baseline fingerprint before and after the continuation: `3dc641c1be6fd951a97edf05c6871dbee7beb5aaa2a829b723f37eda75c78245`.

- Original `lindgren-0`: still uncertain, reservation **$0.254394800**, actual null. Original global block remains `unknown billed outcome`.
- Ledger SHA-256 intentionally changed only for this authorized continuation: baseline `52d4848b5a9eb1a91b3ddfd9928625951fe2da81814669d41bdbd08a261c9b5c`; final `e8418735afaeff893177e550df6774600c6c6fec4f49c2b01c183712cdc064f2`.
- Retained reference adapter unchanged: `055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1`.
- Exact canonical wire digest unchanged: `3f30779c9e886822373e491404a26d49e87edca98799abdd1a4676664988127f`.
- Independently approved 40-file manifest unchanged: `1bf7243e870dd0a7c82f5883e4e5fcd7657384685759b18fe54d83db88edba08`.
- Approved directory unchanged: `1e95394b5e380e815f16bbc9c7b2c84d8a36ce8144d807556b0179c64f517e30`.

## Deliverables and executed commands

The six experimental source/test paths and full current diff are recorded in [REPORT.md](REPORT.md) and [CURRENT-OWNED-FILES.patch](CURRENT-OWNED-FILES.patch). No application source changed during this execution continuation; unrelated concurrent changes were preserved.

Existing verification remains **91 focused Vitest tests**, project typecheck and targeted lint, **5 offline admission/usage tests**, guarded grading-binding checks and independent preflight approval. Their exact commands and guard mechanism are in REPORT.md. No application suites were repeated solely for this already-sealed execution.

Commands run for this final continuation, from repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 tasks/artifacts/luna-identity-offline-2026-10-20/acronym-continuation/run-once.py
PYTHONDONTWRITEBYTECODE=1 python3 tasks/artifacts/luna-identity-offline-2026-10-20/acronym-continuation/run-once.py --execute
```

The first performed read-only preflight with no key or provider access. The second performed the single reviewed transactional continuation. It then invoked the existing strict proposal validator in a network-guarded Node subprocess; validation passed. Final read-only checks confirmed the settled row, original-state fingerprint, source/output bindings, cap/block and reference/manifest hashes. No additional database export or provider/account call was made.

New execution evidence: EXECUTION-APPROVAL.json, EXECUTION-STARTED.json, PROVIDER-RESULT.json, RAW-PROPOSALS.json, VALIDATED-RESULT.json, EXECUTION-OUTCOME.json, FINAL-LEDGER.json and this TRIAL-RESULT.md. Earlier BLOCKED-EXECUTION.json/REPORT.md remain historical evidence of the superseded pre-execution rejection.

## Remaining rollout decisions

No blocker remains for this single development trial. Keep the experimental path default-off and suggestions separate from alias assignment/publication. A later authorized evaluation should use an approved broader dated directory, a targeted failure bank plus an untouched representative holdout, original/relay/edit lineage splits and independent adjudication. Measure retrieval recall, wrong-player count/rate, assignments/abstentions, non-player rejection, certainty inflation, subject-binding errors and token/cost/latency before considering production integration. Any further model calls, data access or rollout require separately bounded scope; this trial grants no automatic continuation.
