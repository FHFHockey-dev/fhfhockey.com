# Certifi-fixed pilot: actual extraction, rejected source anchors

The approved further attempt reached OpenAI successfully: **HTTP200**, a completed `gpt-6-luna` response, **877 input +248 output =1,125 tokens**, and **3,971ms** round-trip plus local usage validation. The TLS fix worked while certificate and hostname verification remained enabled. This was one Responses call; no Decisions, retries, extra families or paid grading calls followed.

The model returned two relevant propositions. Both proposed source offsets disagree with their literal quotations, so the sealed pipeline stopped at output validation. Its known usage was settled before this validation; the new charge is accounted for and its unused reservation released. No output was repaired or sent downstream. The four-arm comparison remains incomplete and **inconclusive**.

## Actual output and source matching

The raw response and usage are preserved in `run-01/attempt-0.json`; extracted JSON is in `actual-extraction-proposals.json`. `source-fidelity-grades.json` retains the unchanged provisional labels' provenance, strict admitted-subset grade, raw semantic-field comparisons and original span audit.

| Proposed claim | Proposed UTF-16 range | Exact quoted-text location, diagnostic only | Strict result |
| --- | --- | --- | --- |
| IR placement | [0,70) | [0,71) | Evidence mismatch |
| Injury-caused absence | [71,126) | [72,137) | Evidence mismatch |

The raw values preserve `injured_reserve`, `out; cause=upper-body injury`, and `approximately 4-6 weeks`. Under the **pre-existing** gradable-field masks, both claims match all20 graded semantic fields across the two provisional labels. This is diagnostic field agreement before source-span validation, **not** two accepted true positives. The canonical-ID field is deliberately ungraded; the model populated8479324 on both claims despite the pilot's null-ID instruction. That is separately disclosed without inventing canonical identity truth.

The absence quote begins with “He” and does not include the named subject, which the local single-subject evidence policy also requires. The observed exact quotation locations are recorded solely to explain the mismatch; no alignment, antecedent expansion or field repair was applied. The original raw proposals remain unchanged.

| Arm | Available evidence |
| --- | --- |
| Rules only | Previously captured bounded parser/interpretation projection:1 held proposal, TP0/FP1/FN2 under full material-field matching |
| Extraction only |2 raw proposals;2 source-span rejections;0 admitted predictions/updates, FN2 and2 explicit validation errors |
| Rules +Decisions | Not run after extraction validation stopped |
| Extraction +Decisions | Not run after extraction validation stopped |

Rejected claims are not correct negatives. The strict admitted-subset FP0 is not evidence that the raw extraction made no errors: both original proposals failed source binding. The family and both gold claims remain in the denominator. These are agent-derived provisional development labels on one previously exposed historical family, not human-adjudicated gold or an untouched future sample. No representative quality/safety, winner, medical/world-truth or deployment conclusion follows. Native eligibility remains false.

## Usage, costs and the single aggregate ledger

`usage-and-cost.json` records the actual reported counts and exact calculation. At [published rates](https://developers.openai.com/api/docs/pricing), reported uncached input/output give a base estimate of USD0.0002117 before any applicable premium. The approved conservative settlement prices all input at the maximum short-context input/cache-write rate and includes the10% envelope:

`ceil((877×0.125 +248×0.50)/1,000,000 ×1.10 ×1,000,000,000) =256,988 nano-USD =USD0.000256988`.

This is an observed-usage **charge ceiling**, not a final invoice claim. No cached/cache-write/reasoning tokens were reported, and every reported output token remains included in the calculation.

| Aggregate item | Accounting |
| --- | --- |
| First poorly logged attempt | USD0.2543948 reserved; outcome still unknown |
| Prior pre-HTTP TLS failure | Settled to0 by the independently reviewed reconciliation |
| This completed API call | USD0.000256988 conservative charge ceiling, settled |
| **Aggregate exposure** | **USD0.254651788** |
| **Unreserved within USD0.52** | **USD0.265348212** |

The current call initially reserved USD0.2543948 and released only its own unused USD0.254137812 after known priced usage. The first reservation was not released. Aggregate final invoice spend remains unknown because of that first attempt. The existing active ledger remains `../comparison-retry-execution-2026-10-19/aggregate-budget.sqlite`; the file here is an immutable after-image for evidence, not another live budget.

## Execution proof and limits

The direct user answered yes to the specific pending certifi-fixed attempt within the unchanged USD0.52 total cap. Authorization is bound to21 execution inputs by manifest SHA256671e16306353eeb4d7ab53d89b6d341291b7d5bf69fe774c64a65ec9673ed80d. All inputs still match after execution, including the existing CA bundle. Request/source/clock/context/prompt/schema/label/rules hashes did not drift. 59 focused offline controls passed before dispatch; no new independent verdict on this attempt or grade is claimed.

The safe retained IDs are request `req_e88237c0754740fda3e3859709a2bb2a` and response `resp_09185bc38b898135016ad685fc0b3887d19ba9fc19ab28f9b0`. The stopped summary's generic output-validation metadata has null status/request-ID fields; the authoritative HTTP200 and request ID remain present in the settled attempt's safe audit. No information was reconstructed from secret headers or a new retrieval call.

Post-run SQLite integrity is `ok`. There are exactly3 attempt rows: original uncertain, reviewed zero, current settled; no Decisions rows. The first two complete rows, reconciliation audit, previous authorization and cap/block are unchanged. The original database and prior frozen run/reconciliation evidence remain byte-identical. `aggregate-budget-after.sqlite`, final-ledger, summaries and source-matching files preserve the outcome. No credential values/raw authorization headers were logged; only the existing local key was used for the approved OpenAI authentication.

The exact blocker is automated evidence anchoring: both numeric spans are wrong, and the second isolated quote omits its named antecedent. The next bounded work can use this retained response offline to test deterministic exact-quote/source-context handling and null-ID policy; it needs no new model call to reproduce the failure. No further request or changed pipeline is authorized or executed here. No deployment, push, publishing, credential/system-trust change, expanded sample, production action or data repair occurred.
