# Independent review — disabled IFTTT sidecar preparation,2026-10-19

Verdict: **revise the bounded recovery path before accepting this as a durable batch-preparation contract.** One P2 functional defect is reproduced. The disabled/no-model/no-publication behavior is supported. This is not a general product, provider or operational approval.

Exact source-pins manifest SHA256: `1c7ec613a52dbfc88e59f05e5163b978501d0a7d0f1feafd894e36402dcb67b9`. All7 owned and42 dependency hashes match before and after review, including the concurrently owned newsFeed dependency. No dependency drift was observed; future drift must be reconciled, not restored over another owner. Tests execute against captured dependency/owned module bytes through the recorded snapshot resolver. No claim is made that every one of the42 pinned dependencies executed.

## P2 — permanently unpreparable oldest receipts starve later valid work

Locations:
- `web/lib/sources/tweetReviewSidecarStorage.ts:24` and36–39: failure increments only a returned unresolved counter; no durable held/backoff/cursor state advances.
- Task SQL9 `list_ifttt_review_receipts`, lines17–22: excludes only an existing matching job, orders oldest first, then applies the caller's limit.
- Task SQL9 `prepare_ifttt_review_sidecar`, line37: preparation envelopes above81,920bytes are permanently rejected.

A fully legal intake envelope with30,000bytes of raw text and the same retained raw_payload text is under SQL6's intake limits. The new review packet repeats those retained bytes in receiptSnapshot and selected source text; its serialized packet is91,671bytes. SQL9 rejects it. A later ordinary short receipt is valid and committed. Two fresh limit=1 invocations both produce prepared0/unresolved1, select the same first receipt ID, create no job and never reach the second ID. This behavior repeats deterministically without an input or budget change. At the maximum limit, a prefix of25 such receipts similarly blocks later work.

Repro: `/tmp/ifttt-sidecar-independent-20261019-dufjx0_n/independent.test.ts`, filter `independent legal oversized`. Evidence: `evidence/oldest-unresolved-starvation.json`, `independent-results.json`, `independent.log`. The test has one failed liveness assertion;17 inherited cases are skipped, not counted as passes. The mapper is the normal retained-context mapper; no injected resolver failure is needed. Both ingress commits survive, so this is review-preparation liveness, not ingestion loss.

Action: handle legal-but-unpreparable packets explicitly without truncating source bytes or changing fingerprints, and give failures durable held/backoff state or bounded cursor progress so later receipts remain reachable within the same work budget. Add a poison-prefix/byte-overflow recovery case. Merely retrying the oldest page or widening a limit does not supply the advertised bounded recovery behavior.

## Checks actually run

- Original16 packet cases +17 disposable-PG cases:33/33 pass in one completed run. `original33-corrected-results.json` and `.log`.
- One independent actual-PG liveness probe: fails as described;17 inherited cases skipped.
- One scoped TypeScript check including the added probe: exit0; `scoped-tsc.log`.
- First attempt collected no tests because macOS realpath translated/tmp to/private/tmp outside the initial reviewer resolver/allow prefix. Original log/results/config retained. Only the reviewer path normalization was corrected before the completed33-case run. No test body or implementation was changed to repair setup.
- No full compiler/build/suite, browser, provider request, hosted query/write, credentials, deployment or activation. PostgreSQL17 clusters were disposable, synthetic, Unix-socket only/TCP disabled; stopped and removed. Repository files were read-only throughout. All reviewer outputs are in/tmp. No denied, pending or uncertain tool action remains.

## Supported boundaries

The application seam is disabled when enabled/limit are absent and makes no RPC/resolver call then. There is no receiver/scheduler hook or provider import/call in the new seam. New SQL only selects retained protocol state and inserts a namespaced pending review job. It does not publish, update raw/factual claim status or grant model execution. canPublish,canChangeStatus and providerDispatchEnabled are false in prepared packets and checked by SQL. Existing broad service-role privileges are not thereby removed; this is a code/contract boundary, not a universal role sandbox.

Post-commit ingress survival, missing-context/write failure recovery when the cause is later fixed, concurrent preparation, acknowledgment-loss/wrong-key uncertainty without a second write, restart skip, full JSON immutability and claimed-job lease/status preservation are supported by actual PG tests. Source/text/receipt clocks bind to retained input; missing publication time stays null; relay or unmatched/enriched-source data is held; zero-claim relevance is retained; exact UTF-16 spans and stable copied IDs are checked; overflow count is held explicitly. No existing parser/r3/replay/fingerprint source bytes were changed, and packet tests verify no input mutation. These positives do not cure the P2 poison-prefix case.

Searches for the exact new function names, job namespace and migration timestamp across the four local SQL trees found no active collision or newer local alteration of tweet_pipeline_jobs. Other current migrations were left untouched. This is local evidence only: unseen Claude proposals and deployed objects/order are not verified. SQL9 remains task-local outside active migration authority and follows selected SQL6v2/SQL7v2/SQL8 plus the existing jobs schema in fixtures.

## Evaluation plan and missing evidence

The four arms use the same family-disjoint cases and distinguish deterministic rules, structured extraction proposals, Decisions assessments and both. Budgets remain zero; neither Luna nor Decisions is selected. The plan calls for zero-claim recall, blinded adjudication, abstention/attribution/wording metrics, retries0,durable multi-instance quota and untouched prospective families. It explicitly labels the discovery corpus/provisional labels as development data and fixture/mock tests as preservation/protocol evidence, not model accuracy. No quality or cost benchmark was observed.

Provider endpoint/model/pricing/SDK statements in the proposal were not independently revalidated by this offline review. Decisions package bytes were not available: the owner records two supported materialization failures with `library file transfer failed: download failed`. No adapter installation, live wire compatibility, account access, Gateway routing or provider latency/quality is inferred. That is a missing-input integration blocker, not an approval denial or uncertain execution by this reviewer.

Remaining gates: fix and rerun the P2 recovery case; authenticated retained-context/enrichment mapping; known Claude/deployed migration/object/ownership/full ACL/trigger/writer reconciliation; actual PostgREST deadline behavior; provider package and software-only wire/result protocol; durable worker/claim/result/quota ownership; exact cohort/DDL/deployment/config/paid-call authority; authentic source/history and genuine forward labels/metrics. No model, publication, full52 or production approval follows from this review.
