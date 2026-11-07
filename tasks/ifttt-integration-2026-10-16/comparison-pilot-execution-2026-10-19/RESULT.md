# Approved single-family pilot: guarded incomplete

The approved local pilot executed one extraction transport attempt and stopped without a usable reply or reported usage. Both Decisions calls were skipped. The comparison is **inconclusive**; there is no model-quality or winner result.

## Execution and authorization

- Frozen source manifest: `541a3d34a4a4861405cfdedd78ce256600191a3fdb8863ba9f14dce31942da79`.
- Execution manifest: `6f34fe79654f4d3c69eb4082fa1aeafa8d70c3aa7c6ac5651e291a5bf0e27f3b`.
- Independent pre-execution review accepted 28 offline cases, recorded in `/private/tmp/ifttt-sequential-review-20261019-gjf4u4dq/REVIEW.md`. Those checks establish local controls, not this paid attempt's outcome.
- Parent clearance and direct human approval cover the exact retained Ryan Lindgren/SeattleKrakenPR source and context sent to `api.openai.com/v1/responses` and `/v1/decisions`, within the existing aggregate USD0.26 cap.
- The first tool invocation was rejected before process creation for exact-payload egress authorization. That historical refusal remains in `execution-blocker.json`. After the user's explicit payload/destination approval, the same reviewed command was retried once and executed. There is no current approval denial or pending authorization for that exact past attempt.
- Family: `original-x-2108233461026726263`. Both provisional gold claims remain in the denominator. They are historical development labels, not human-adjudicated future holdout evidence.

## Actual result and accounting

| Stage | Observed result | Usage / billing |
| --- | --- | --- |
| Responses extraction (`lindgren-0`) | One attempted transport; no parsed response/audit; state `uncertain`; retained error `RuntimeError` | No usage reported; USD0.2543948 reservation retained |
| Decisions review of rules proposals | Not attempted | No stage reservation or usage |
| Decisions review of extraction proposals | Not attempted | No stage reservation or usage |

The first attempt's durable start was `2026-10-19T19:58:29.421635+00:00`; uncertain settlement was recorded at `2026-10-19T19:58:29.512656+00:00`. The approximately 91ms interval includes local ledger work and the failed transport; it is **not model latency**. No request ID, HTTP status, parsed error body or underlying exception subtype was retained. The safe error wrapper discards that detail. Do not infer TLS, authentication, model availability, provider acceptance or non-billing from the generic error or short interval.

The ledger reports zero **known settled charge ceilings**, not zero actual spend. Actual charge and provider receipt/processing remain uncertain. Exposure remains USD0.2543948 of USD0.26. The remaining unreserved USD0.0056052 cannot cover another authorized stage reservation. The experiment is blocked as `unknown billed outcome`. No automatic retry, extra family, budget reset, alternative transport or additional provider call was performed after uncertainty.

See `run-01/stopped-partial-pair.json`, `run-01/final-ledger.json`, and the original persistent ledger at `../comparison-live-binding-2026-10-19/experiment-state/budget.sqlite`. Preserve that database and its attempt identity; a new output directory is not a new budget.

## Available grading evidence

`rules-only-offline-grade.json` applies the frozen grader to the already captured exact rules output, without rerunning the producer or making a network call. It produces one coarse proposal: TP0 / FP1 / FN2 under full material-field exact matching, held1, accepted0, hallucinations0. The matched absence proposal has value, polarity and time mismatches, and the independent IR placement is missed. FP here denotes a material-field mismatch, not an invented event. This covers the bounded parser/interpretation projection, not the complete deployed pipeline.

The extraction-only and both verifier-assisted grades are unavailable. Missing API results must not be scored as successful empty extraction, correct negatives or evidence that either path is superior. Native eligibility remains false.

## Checks and next boundary

Post-run read-only checks confirm all five owned source pins and all 13 execution inputs still match, SQLite integrity is `ok`, exactly one uncertain extraction attempt exists, zero Decisions attempts exist, and no completed model comparison report exists. See `post-run-integrity.json`. No further test suite, build, deployment, migration, production ingestion, publication or credential configuration ran for this result.

The runner unwound through its `finally` block and wrote the final ledger. An optional `ps` observation was sandbox-denied; no escalation or process intervention was attempted. No command was relaunched.

The next useful work is bounded outcome/account reconciliation using provider evidence before any replay, and an independently reviewed local observability correction that retains allowlisted transport/error categories without headers, key values or unfiltered bodies. This report does not authorize further authenticated network reads, spending or resuming the experiment. Preserve the uncertain reservation until authoritative evidence resolves it; any future execution must respect the same aggregate cap and receive clearance for the changed plan. The current failure alone cannot identify a safe correction to the transport.
