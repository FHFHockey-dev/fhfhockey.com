# Narrow source-anchoring and retained pilot review — 2026-10-19

**Accept the explicit offline anchoring change and the honest separation of original versus postprocessed results. No blocking implementation finding within this scope.** This is not paid-pipeline integration, publishable eligibility, model-quality certification or permission for further calls.

## What was independently verified

All **20 focused cases pass** from isolated copies with network denied. A fresh offline evaluation exactly reproduces `offline-four-arm-results.json`. All three owned and five read-only pins and both named artifact manifests match before/after; no drift. The preserved attempt record remains SHA256 `1fb1490bd6d8afaa14b3e1339e0a35d7f62b3b5a3c0c007407be4b0a7c1e1dc7`. The active aggregate ledger remains SHA256 `2da989c4526fdc0316af78242c9a0fc3d766607e363d88863d65aca7d3a627ce`. Only an immutable after-image was queried read-only; tests hash an isolated copy of that after-image, not live budget state.

The retained completed Luna response reports 877 input +248 output =1125 tokens, default tier and zero reported cache/reasoning categories. Transmitted source text/identity/author/publication/receipt fields match the unchanged profile; the request hash recomputes correctly. Decoding the retained model JSON exactly matches `actual-extraction-proposals.json`.

The source has137 ASCII/code-point/UTF-16/UTF-8 units. Its unique literal quote positions are `[0,71)` and `[72,137)`, against original model offsets `[0,70)` and `[71,126)`. Only those numbers change. Every non-offset field, original quotation, qualifier/cause, model-populated ID and original proposal remains unchanged. No Unicode-offset convention explains this ASCII mismatch; no internal model counting cause is inferred.

## Adapter and grading boundaries

`anchors.py:39`–`:77` preserves already-valid strict anchors. Invalid numeric spans may be repaired only by finding the **unchanged quotation exactly once** in the original source, including detection of overlapping repetitions. No fuzzy/case/whitespace/Unicode normalization, nearest-match selection or evidence expansion occurs. Repaired candidates must pass the unchanged strict validator. Invalid provenance/schema/IDs/quotes or unresolved batch errors do not become admissible through partial dropping (`evaluate.py:26`–`:28`). The tests exercise these negative cases and preserve semantic/qualifier holds.

The original admitted-subset grades reproduce their frozen values. The new extraction TP2/FP0/FN0 is explicitly **Luna output plus deterministic quote alignment** under the pre-existing field masks, not original model anchoring success. Rules receive the same alignment policy and their valid anchor/grade remain unchanged. Both verifier arms are `not_run`, grade null; no response or probability is fabricated. The two source labels remain exposed, agent-derived provisional development annotations.

Both repaired extraction rows remain held: IR has `unresolved_time`; the second quote has `single_subject_evidence_unproved`. Accepted/usable updates remain0 and actionable misses remain2. Original numeric player IDs violate the null-ID instruction and remain disclosed/ungraded, not rewritten into successful identity binding. No native/world/publication authority is created.

## Usage reconciliation

Independent rational arithmetic gives base usage estimate `(877 × .10 +248 × .50)/1e6 = $0.0002117`. The approved conservative formula gives **ceil(256987.5 nano-USD) =256988 = $0.000256988**, matching the settled attempt and cost artifact. This is a charge ceiling, not a final invoice.

The after-image has exactly three Responses rows: first uncertain reservation254394800, prior reviewed TLS retry settled0, current call settled256988. Aggregate exposure is **$0.254651788** and remaining within $0.52 is **$0.265348212**. The first unknown reservation is retained. No Decisions row exists; no reviewer settlement/release/edit occurred.

## Missing evidence and smallest next step

An honest **source-support** comparison is missing authentic Decisions replies for the exact rules proposals and explicitly postprocessed extraction proposals. Prepare a versioned, sealed verifier-only continuation using the retained response, source hash and alignment audit; apply the same anchoring policy to both producers, label original/postprocessed grades separately, and keep both qualification holds immutable. This reuses paid extraction output; another extraction request is unnecessary. Obtain applicable review/run authorization before any verifier dispatch, reserve each planned call sequentially under the existing aggregate accounting, and stop on unknown or insufficient balance. This review makes no request or authorization.

The source-support question can be assessed on held proposals. It must not be mistaken for clearance to publish or repair them. To remove the **IR time hold**, supply independently retained applicability/transaction-time evidence; publication/receipt clocks do not prove that date. To remove the **subject hold**, retain an explicit reviewed antecedent/coreference binding from the existing named first sentence to the second quote, or a separately versioned context policy. The full source already contains that context, but the current isolated evidence quote does not encode the required link. Do not silently expand the model quotation or invent a subject anchor. Model-populated numeric IDs likewise require independent identity proof for native use; keep instruction noncompliance visible.

For the verifier-only comparison, freeze how ungraded/unverified IDs and these held fields are treated, without synthesizing identity or applicability. Any high-confidence verifier result may only add holds under the current policy, never erase existing time/subject limitations. If all final outputs remain held, report a source-support/abstention comparison and zero usable updates. One exposed family cannot establish a winner or future performance.

No provider request, spend, credential access, trust/ledger change, deployment or implementation edit occurred in this review. All new artifacts are under this `/tmp` root; no test remains running. Reproduce from the copied `comparison-source-anchoring-2026-10-19/` folder with `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v test_anchors`, then `PYTHONDONTWRITEBYTECODE=1 python3 evaluate.py` (new stdout destination).
