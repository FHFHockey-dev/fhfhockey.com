# Pure Decisions request/result integration — 2026-10-19

**Owner-tested additive candidate, ready for independent review.** No accepted recovery source, SQL or dependency changed. This is an isolated software contract using the retained reference interface, not proof of current provider-schema compatibility, hockey accuracy or operational readiness.

## Changed paths and authority

- `web/lib/sources/decisionsReference/adapter.mjs`: byte-identical reference adapter, SHA256 `055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1`. Only this module is vendored into runtime; no volume reports, credentials, HTTP client or SDK are added. `adapter.d.mts` describes its retained interface.
- `web/lib/sources/tweetDecisionReviewMapping.ts`: pure default-off packet/statement mapper. It accepts only literal `enabled:true`; it has no transport, provider-budget, database or scheduling interface.
- `web/lib/sources/tweetDecisionReviewResults.ts`: pure result-binding validator against a trusted locally generated mapped plan. It performs no writes and returns review-only assessments.
- `web/lib/sources/tweetDecisionReview.test.ts`: focused mapper/binding cases.
- This task folder: unchanged retained package tests/reference documentation, network-denial preload, scoped configurations, provenance, verification and frozen pins.

`source-pins.json` lists exact owned paths and the 49 accepted read-only pins. Those accepted pins are unchanged before and after verification. The new modules have no route/worker/scheduler callers. All output authority flags remain false. Importing the reference builder does not create an adapter instance or invoke transport. No recovery implementation was reopened, and no migration was added or altered.

## Mapping contract

Whole-post relevance is mapped for zero-claim posts only when the retained original, exact raw text/text version, URL, publication/receipt clocks and explicit extraction version are available. Attribution is reconstructed from retained wrapper/raw fields and compared with the packet; relay or fabricated original identities are withheld. An `authorId` such as `x:handle:reporter` is an explicit retained account-key namespace, not an invented numeric X account ID. Publication times are never borrowed from receipt clocks. Existing source/global holds remain held with no request.

Each candidate requires one positive numeric canonical player ID, a compatible native fact/scope, exact UTF-16 evidence and subject/predicate anchors, the expected extraction version, no prior holds, and exactly one explicit `tweet-decision-statement-v1` proposal. Its statement artifact binds the observation, retained source/text version, player, extraction version, complete fact/scope/modality/effective-time proposition and exact evidence. Numeric player IDs are converted to strings only after validation, as required by the retained interface. Duplicate native IDs, duplicate statements, multiple identities, missing statements, unsupported lineup decomposition and mismatches remain recorded unknowns. Unmatched statement IDs are retained in the plan's audit, not silently dropped. Valid neighboring candidates and source-only relevance remain available.

The mapper does **not generate prose**. Statement text is an explicit proposal, not an assertion that it faithfully verbalizes the native proposition. The binding checks establish declared metadata equality, not logical equivalence of prose. The output result explicitly means `assessment_of_supplied_statement_only`. It cannot establish native-fact correctness or status/publication authority.

Packets/candidate overflow are held. The retained reference's separate 32,768-byte serialized request limit is checked after building the full request, including questions and statements. There is no text truncation or limit increase. Source/native IDs and fingerprints are not changed; new hashes bind the packet, statement proposals, request and result context only. Mapped plans are cloned and recursively frozen to prevent accidental mutation of their trusted expected bindings.

## Result contract

The caller supplies a separate envelope containing binding version, plan hash, packet hash and the reference sidecar. The expected mapped plan must come from trusted local mapping or a separately authenticated store; it must not be supplied by the model/result itself. These hashes are content bindings, not provider authentication or durable effect receipts.

Validation compares application hashes/version; retained prompt/model/extraction versions; exact source/claim/evidence/request digests and idempotency audit key; original as-of clock and causal result clock; every claim/player/span/question binding; and the uncalibrated/no-calibration contract. Unknown transport/budget outcomes, missing/foreign bindings, malformed envelopes and foreign questions cannot produce a bound review. Missing/duplicate/refused/malformed individual answers remain unknown without erasing valid neighbors. Choice distributions and confidence are validated separately; no undocumented relation between them is assumed. Unknown usage/budget warnings stay unknown. Calibration remains `uncalibrated_shadow_only` and reference review reasons are preserved.

Only allowlisted assessment fields are returned. Model/caller `publish`, assignment or permission fields are never invoked or promoted. A scored support label is about the supplied statement and source, not independently verified fact, corroboration or player participation probability.

## Verification actually run

Node **v22.11.0**, existing dependencies, no installation/lockfile changes.

| Check | Outcome | Evidence |
| --- | --- | --- |
| Retained 23 author + 34 independent package tests, copied byte-for-byte | **57/57 pass**, network denied | `evidence/retained-package57.tap` |
| New focused mapping/result tests | **54/54 pass**, network denied | `evidence/frozen-candidate-results.json`, `.log` |
| Scoped TypeScript including new types/modules/tests | **exit 0** | `evidence/frozen-candidate-tsc.log` |
| ESLint, three authored TypeScript files | **exit 0** | `evidence/frozen-candidate-lint.log` |
| Accepted baseline and runtime reference integrity | **49 unchanged**, exact vendor hash | `evidence/accepted49-before.json`, final integrity/pin records |

The initial focused run passed 51/52; one table-driven test accidentally spread ID arrays as test arguments, so the empty-ID case failed in fixture setup. The first scoped compiler also reported that table typing and one readonly test-span assignment. The test table now passes arrays explicitly and uses structural span replacement; original logs remain. Native fact/scope checks and transport-failure coverage were added, followed by the passing 54-case run. A final explicit literal-enabled guard was verified in the frozen candidate. Counts refer to distinct cases in those two suites, not repeated executions.

Tests exercise ordinary explicit statements, source-only triage, missing source/clocks, relays, duplicate/multiple/unresolved identities, mismatched source/claim/version/proposition/evidence, Unicode/surrogate offsets, existing holds, request overflow, valid-question reindexing after held candidates, wrong audit/player/question bindings, refusal/missing/duplicate answers, malformed distributions, unknown billing, no automatic retry and no-write authority. All replies/probabilities/budgets in these tests are synthetic. No PG suites, full repository compiler/build, browser, live API/provider or hosted action ran in this increment. The prior accepted recovery tests were reused by exact pins, not rerun or counted here.

## Unresolved contracts and next review scope

1. **Automated statement producer:** choose and independently review a deterministic, versioned serializer or another explicitly supported producer that supplies canonically bound names, source-time scope and governing qualifications. This increment deliberately requires an explicit proposal rather than inventing natural-language policy or copying a quote as a supposedly validated native proposition. Native candidates without a proposal stay held; valid zero-claim/post relevance remains possible. A statement-only support score must not be used as native-fact acceptance before this producer's equivalence contract is established.
2. **Multi-player propositions:** no joining IDs, selecting the first identity or silent lineup splitting. Define independently anchored proposition IDs and names before expanding beyond single-player facts.
3. **Future durable execution:** no queue consumer, result persistence, multi-instance quota/idempotency ledger or real provider transport is implemented. The reference's process-local counters and byte/token heuristic remain demo guards. Provider schema/account access, immutable result/lease protocol, exact spend/cohort authority, calibration and genuinely future evaluation remain separate gates.

Suggested bounded review: verify the vendored bytes and unchanged retained tests; inspect the explicit-statement trust boundary, strict source/identity/span/version holds, request byte/overflow behavior and result binding/unknown handling; rerun only the two offline suites and scoped type check, with directly motivated negative controls. Parent coordinates review. No further integration stage should be started from this candidate alone.

No environment configuration or credential changes, paid call, live budget activation, background job, ingestion/replay, deployment, staging, commit, hosted read/write or production update occurred. Tests use only synthetic transport replies and virtual budget fixtures. The application remains default-off and the 49 accepted pins remain unchanged.
