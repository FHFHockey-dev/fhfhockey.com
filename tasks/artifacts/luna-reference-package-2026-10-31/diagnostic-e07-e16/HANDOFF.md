# Proposed diagnostic collection for E07–E16 — inactive

**Preparation only: no paid calls, credential access, ledger activation, application changes or production action.** The real ledger remains disabled with seven consumed calls and **$0.265263690 exposure**, including the historical uncertain reservation. This proposed policy requires independent review before use. Previous stop-on-first-failure rules remain the active policy.

## Diagnosis and justification

[DIAGNOSIS.json](DIAGNOSIS.json) independently compares the retained raw provider output, original source, frozen allowed variants and original grade for all three offset failures:

| Case | Expected wording returned | Model span | Required span for its exact quote | Missing characters |
| --- | --- | --- | --- | --- |
| E02 | ruled_out | [4,38) | [4,40) | `t.` |
| E03 | projected | [4,45) | [4,46) | `.` |
| E06 | confirmed | [4,57) | [4,61) | `ups.` |

The quotes are exact, unique source substrings, while their numeric offsets are invalid. The raw provider proposals match the retained originals. Valid matching spans were already allowed by the frozen labels. All three sources are ASCII, so Unicode indexing differences do not explain these cases. The inconsistent errors do not justify a fixed offset adjustment. The model's internal cause is unknown; the evidence supports neither pipeline truncation nor a scorer defect. **No validator, label, raw response or historical failed grade was changed or counterfactually regraded.**

Stopping the entire evaluation after every such failure repeatedly prevents later cases from being observed. This proposal changes only diagnostic case advancement. A model failure remains a failure, its held observation remains held, and its correction candidate remains separate. Advancing to another immutable synthetic report gives no publication, application, training or truth authority. Frozen future requests do not depend on previous model content.

## Exact frozen sequence and unchanged budget

The sequence is E07, E08, E09, E10, E11, E12, E13, E14, E15, E16. Each report has one Responses call; **only E10/E11 have a conditional Decisions call**, as already specified in their unchanged inputs. The existing caller runs Decisions only after the original Responses validates. If a specifically collectible held Responses prevents that leg, record it as `not_run_original_responses_held` and never revisit it or use a coordinate candidate to force it.

| Case | Endpoints | New request ordinals if both Decisions legs run | Maximum cumulative ordinal |
| --- | --- | --- | --- |
| E07 | Responses | 1 | 8 |
| E08 | Responses | 2 | 9 |
| E09 | Responses | 3 | 10 |
| E10 | Responses, conditional Decisions | 4–5 | 11–12 |
| E11 | Responses, conditional Decisions | 6–7 | 13–14 |
| E12 | Responses | 8 | 15 |
| E13 | Responses | 9 | 16 |
| E14 | Responses | 10 | 17 |
| E15 | Responses | 11 | 18 |
| E16 | Responses | 12 | 19 |

Actual later ordinals decrease when a conditional Decisions leg is withheld. A completed case record must account for the exact consumed prefix and the permitted withheld leg before the next case. No other skipping, reordering or substitution is allowed.

- **Maximum 12 new calls; at most 19 cumulative.** The global cap remains 20. The extra slot is deliberately unused and cannot be repurposed.
- Preserve all seven starting receipts and historical exposure; exclude E01–E06, including E06's unsent Decisions. No retries or replays of those paid cases.
- Same **$1 aggregate cap**, starting **$0.265263690**, additional headroom **$0.734736310**.
- Preserve historical **$0.254394800 uncertain reservation** within $0.262519843 prior exposure.
- Reserve **$0.233000000 before each call**. Actual charged usage must settle before proceeding. The 12-call allowance does not guarantee all calls fit at worst-case usage.
- Zero retries, concurrency one; unchanged **November 1, 2026 23:59:59 UTC** expiry and $5 promotional safety reserve.
- Remaining request-cost estimate from the unchanged frozen estimates: **$0.030071588**. It is neither a token ceiling nor an invoice.

[PLAN.json](PLAN.json) freezes the policy, sequence and limits. [PACKETS.json](PACKETS.json), [REQUESTS.json](REQUESTS.json) and `inputs/` are exact subsets of the original v4 rehearsal: ten reports, twelve potential request bodies, unchanged dated identities, source policies, labels, evidence variants and Decisions bindings. S01–S10 are absent. All material is **exposed synthetic development data**, selected after earlier failures; it is not independent holdout or human ground truth.

## Proposed collection and stop rules

[diagnostic-policy.ts](diagnostic-policy.ts) is an **inactive, artifact-local classifier**. No application imports it. It cannot write files, load credentials, fetch, mutate admission, apply candidates or change production state. Before classifying, it checks completed settled receipts and usage, exact frozen request hashes, then replays those receipts offline through the pinned existing caller/transport. The reconstructed original review must match exactly. This is a local verification of newly collected records, never a new provider request or repair.

Only these outcomes can advance the proposed diagnostic sequence:

1. An original `review_only` result, including a frozen-label mismatch, after every required leg settles and any Decisions result is bound. A mismatch is stored as `recorded_model_failure`.
2. An original `held` result with exactly one of six deterministic model-validation reasons: `goalie_subject_binding_invalid`, `goalie_certainty_inflation`, `goalie_definite_wording_unsupported`, `goalie_context_unresolved`, `goalie_conflict_or_correction_unresolved`, or `goalie_tentative_wording_unsupported`. The receipt-bound replay must reproduce that failure, identity must have validated, no goalie status may have been accepted and no Decisions leg may have run. This is a recorded failure, regardless of whether a coordinate candidate exists.

Everything else stops: transport/provider failure, unsettled or uncertain outcomes, incomplete or malformed output, schema escape, unlisted/generic validation failures, unresolved Decisions, unexpected CLI exit, changed authority, mismatched receipt/source/request/original review, pins/order/clock/retention/funding/credential/budget failures, inability to durably save artifacts, or completion. **Durably disable the same ledger before another invocation; preserve an existing unknown-outcome reason and all reservations.** No automatic resume is proposed.

Preserve raw scores, original status and holds separately from the diagnostic disposition. Count a recorded pass only after receipt-bound replay, a `recorded_pass` classification and durable case artifacts; operationally unverified or unpersisted results are not passes. Keep model failures, operational stops, withheld Decisions and uncalled cases separate in denominators. A field matching an abstention label after validation rejected the proposal does not make the original held report pass.

Unique exact-quote correction candidates remain separate receipt/request/source-bound artifacts with `canApply:false`. They are **not an input to the diagnostic classifier**, cannot change a grade or force a Decisions call, and are not needed to permit collection of a model failure. No human decision is fabricated. Any future human decision remains separately bound to reviewer/time and conveys no production authority.

## Offline safety evidence

**All 25 final scenarios passed; scoped TypeScript passed.** Tests use an empty inherited environment, network-denial preload, synthetic fetches and disposable ledgers seeded with all seven real starting receipts. Only those temporary ledgers are enabled. The real and archived ledgers remain unchanged.

Six complete-collection scenarios verify the intended distinction:

| Mock scenario | Reports recorded | New mock calls | Original passes / model failures | Separate candidates |
| --- | --- | --- | --- | --- |
| All pass | 10 | 12 | 10 / 0 | 0 |
| Identity label mismatch in E07 | 10 | 12 | 9 / 1 | 0 |
| Unsupported projected backup in E07 | 10 | 12 | 9 / 1 | 0 |
| Decisions label mismatch in E10 | 10 | 12 | 9 / 1 | 0 |
| Wrong offset in E10 | 10 | 11 | 9 / 1 | 1 |
| Wrong offsets in E10/E11/E15 | 10 | 10 | 7 / 3 | 3 |

The other 19 scenarios stop on schema escape, invalid JSON, incomplete response, unresolved usage, transport failure, uncertain Decisions, unresolved Decisions, budget rejection before Decisions, tampered original review, substituted receipt, CLI error, pin/source mismatch, invalid clock, disabled/expired/insufficient ledger, preexisting unsettled attempt and artifact-write failure. Uncertainty retains its full reservation and stop reason. No-request gates send zero mocks. Every final synthetic ledger is disabled, prior seven receipts are preserved and a post-stop reservation probe is rejected.

The verifier persists/fsyncs original reviews, receipt records, separate candidate/absence artifacts and diagnostic dispositions before advancing, then checks their hashes on the next case. Its real exclusive-create failure test confirms an occupied output path stops before another case. Operationally unverified or unpersisted outcomes are excluded from pass counts.

[OFFLINE-VERIFICATION.json](OFFLINE-VERIFICATION.json), [COLLECTION-RESULTS.json](COLLECTION-RESULTS.json), [OFFLINE-RESULTS.json](OFFLINE-RESULTS.json) and [offline-verification.log](offline-verification.log) retain the final results. [OFFSET-E10-original-review.json](OFFSET-E10-original-review.json) remains failed beside [OFFSET-E10-separate-candidate.json](OFFSET-E10-separate-candidate.json), while the simulated sequence advances under the proposed diagnostic rule. Initial passing rehearsals are retained in separate checkpoint directories; later rehearsals added durable persistence and excluded unverified results from pass reporting. No paid retry occurred.

Reproduction from `web/`:

```sh
env -i PATH="$PATH" TMPDIR=/tmp NODE_PATH=.:./node_modules NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowJs":false}' node --experimental-require-module -r ts-node/register/transpile-only ../tasks/artifacts/luna-reference-package-2026-10-31/diagnostic-e07-e16/verify-continuation.ts
env -i PATH="$PATH" TMPDIR=/tmp NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' ./node_modules/.bin/tsc --noEmit --incremental false -p ../tasks/artifacts/luna-reference-package-2026-10-31/diagnostic-e07-e16/tsconfig.json
```

The verifier refuses arguments and overwriting saved outputs. A repeat needs a reviewed alternate output destination or an in-memory compare-only replay; do not delete frozen evidence. No application suite or build was rerun for this artifact-only preparation. The prescribed replies demonstrate control behavior, not model accuracy.

## Review gate and pins

Independent review must approve this exact changed collection policy before any use. A later supervising operator must use the reviewed classifier with the pinned manual CLI, preserve the exact conditional sequence and durable case records, and check fresh funding/concurrent spend, restricted replacement credential, seven-receipt starting ledger, full reservation headroom, unchanged pins and expiry. Old browser observations are not fresh preflight. The owner's non-expiring key exception does not extend the batch expiry; verified revocation/rotation before production remains required.

The proposed activation changes only policy ID, enabled and the known continuation-stop reason after review; it is not applied here. No new ledger, retry budget, source privilege, automatic loop or production consumer was introduced. The previous execution scripts retain the old stop policy and must not be reused unchanged for this proposal.

- Plan SHA256: `69745e85933a552a6e425a0443d5dacc25157fa4ca1169ffd7df89d119f57419`.
- Packets SHA256: `b50ace71b2f7ad72d6ea86cbeb93c7427b729b1d44b5d623369f5777e98fef41`.
- Requests SHA256: `d59caecc7bb6d2c237c49d437259c66a7cbf097e232c71d538dc63a41cfc6fc4`.
- Proposed classifier SHA256: `2469572d3c684f8635b53c6b0e699a4d50b6085bef65b16a77f0a4e3873454dc`.
- Unchanged disabled seven-call ledger SHA256: `2bf56d754b1f98888785b8d7e759d1c701b5541b0fb9e91ade63eff041ff3ceb`.

[FILE-PINS.json](FILE-PINS.json) pins this proposal. Real-world qualification, rights-cleared independent evaluation, unresolved language limitations and production acceptance remain separate gaps. No paid action is denied or uncertain in this preparation; policy approval and fresh execution preflight are pending.
