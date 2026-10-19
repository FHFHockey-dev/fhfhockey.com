# FHFH IFTTT Decisions shadow reference

Prepared October 16, 2026. This is a small standalone implementation and integration plan, not a change to the current FHFH repository. No production integration, credential setup, deployment, or live model request has been performed.

## Contents and verification

- `adapter.mjs`: dependency-free Node.js ESM request builder and shadow adapter
- `test/adapter.test.mjs`: offline flow/schema tests with synthetic replies
- `package.json`: `npm test` / `npm run check`; no install step or dependencies

Run with Node.js 22 or newer. The package contains no network implementation, OpenAI SDK, API key handling, database client, or environment-variable reader. A caller must explicitly inject a transport. The included tests never contact OpenAI.

All test probabilities, labels and the test-only calibration object are synthetic fixtures. Passing them establishes software behavior, not hockey classification quality, calibration or achieved accuracy. No labeled corpus evaluation has been run.

## What the adapter does

1. Validates source metadata, timestamps and candidate source spans. Spans are JavaScript UTF-16 offsets with an exact quote. Stable claim/player IDs must come from the existing parser and identity resolver.
2. Asks one post-level material-news predicate using the source text, independent of extracted claims. Empty or malformed claims do not suppress this question. Classification is not exhaustive extraction.
3. Asks two separate questions for each valid candidate: source support and source wording. It never collapses a multi-player post into one status. Invalid candidates are withheld and recorded as unknown; valid candidates retain correct bindings.
4. Normalizes responses into an audited, review-only sidecar. It never assigns a status, publishes, filters ingress, changes FORGE inputs, or modifies an optimizer.

The wording labels describe language in the source. `direct_assertion` does not mean independently verified or factually certain. A model probability is not a player participation probability. Choice `confidence` is retained separately from the option distribution; its undocumented mathematical relation is not invented or used for gating.

Refusals, missing/duplicate answers, unknown question names, wrong models, invalid distributions and transport failures are explicit unknowns. Bad individual answers do not erase valid neighboring answers. Invalid source metadata prevents a request entirely.

At most 99 candidates are evaluated in one call (199 questions including triage). Overflow candidates remain unknown for review; they are not silently dropped. Full source text is not truncated. Oversized requests skip scoring and retain the existing workflow.

## Default-off usage and transport boundary

`createShadowAdapter()` is disabled. Setting only `enabled: true` still produces zero calls because request/token/dollar budgets default to zero.

The factory accepts:

- `config`: explicitly enabled limits; see `DEFAULT_CONFIG`
- `transport`: an injected async function returning `{ body, requestId? }`
- `now`: optional ISO timestamp clock for deterministic tests
- `calibration`: optional versioned, frozen threshold artifact; none is supplied

Transport receives `(request, { signal, idempotencyKey })`. `request` follows the official `POST /v1/decisions` shape: `model`, string `input`, and `questions`. Production must send it server-side only and honor the abort signal. No endpoint/header/key implementation is included here. The idempotency key is for the application's ledger; this package does not claim provider-side idempotency support.

Calling `evaluate({ source, claims, extractionVersion })` returns a sidecar, not database mutations. Supply the real extraction version; omission is explicitly recorded as `unspecified`. Use the tests as executable input examples. Only allowlisted source and candidate fields are forwarded. Exact source snapshots must remain available in the authorized ingress store so recorded hashes and quote spans can be audited.

Without a calibration artifact, results explicitly say `uncalibrated_shadow_only`. Zero-valid-claim posts enter development sampling/review regardless of score. A supplied frozen post-material predicate threshold can flag `material_news_without_extracted_claims`; it can never auto-approve claims. A low score is not permission to discard a post or evidence of exhaustive extraction.

## Budget accounting: reference guards, not production billing controls

Config bounds requests, aggregate input tokens, estimated dollars, serialized request bytes, reserved tokens per call, and timeout. Reservations happen before awaiting transport, including concurrent calls on one adapter instance. No automatic retry is performed. Same-evidence calls are deduplicated within that instance.

The dependency-free reservation is the UTF-8 size of the complete serialized request plus 512 units for overhead. It deliberately includes all source text, instructions, questions, option descriptions and candidate statements. This is a conservative heuristic, **not an exact tokenizer or guaranteed token bound**. Returned `usage.input_tokens` reconciles the reservation. Unknown usage or an over-reservation result blocks additional calls. Failure/timeout keeps the reservation and blocks further calls because the request may have incurred a charge. Aborting does not prove the provider stopped or that no charge occurred.

The counters/dedup map are **process-local demo guards**. A restart loses them; multiple processes have separate quotas. Production needs an atomic durable quota/idempotency ledger, a defined billing-period reset, provider spend limits and request-rate limits. An actual response can exceed a heuristic estimate; a local dollar setting cannot retroactively prevent charges. Price settings must be verified before activation.

Base estimate, without cache discounts:

`USD = sum(all request input tokens) / 1,000,000 × $0.10 × applicable billing multiplier`

Count question/instruction/context tokens, repeated context, retries, evaluation calls and separate requests, not just tweet tokens. At 7,000 calls/month, 2,000 tokens/call is about $1.40; 10,000 is $7, before applicable premiums. Decisions has no output/cache-read/cache-write charges; using total reported input tokens here is a conservative estimate, not an invoice calculation. Live usage has not been measured.

## Fresh-source integration checklist

Planning baseline supplied with this task: retained ingress contains 5,494 posts from April 24 through October 15; complete May–September averaged 700.8/month; trailing 30 days contained 3,166. These retained observations satisfy the user's 7,000/month condition. They do not establish complete upstream capture or cap future traffic. The user subsequently requested planning the integration. This package prepares that plan; activation remains unperformed.

1. Obtain the **fresh source from the user's Mac** through the authorized task route. Inspect repository instructions, current ingress/parser/queue boundaries, IDs, event shapes, retries and tests. Do not integrate against a stale checkout or assume current schemas.
2. Map the real ingress and candidate records to this narrow adapter input. Preserve original text and timestamps. Establish the proper player resolver and exact quote offsets. Persist ingestion before external model work.
3. Add a durable background job/outbox after ingress commit so the IFTTT webhook response does not wait on OpenAI. Score raw posts even when extraction yields zero claims. Persist sidecars separately, with prompt/model/threshold versions, source bindings, result distributions, usage and reviewer outcomes.
4. Replace demo quota/dedup state with existing durable infrastructure. Define monthly cap, maximum concurrency, provider rate-limit handling and bounded retries. Retried attempts consume budget. Ensure accounting and idempotency survive worker restarts. Add an operator kill switch. Do not enable automatic status updates.
5. Complete secure credential setup using the user's approved secret-management path. No credentials have been requested, read, created or stored here. Credential creation or persistent-access changes require the applicable user approval. Keep keys server-side, outside repository/client bundles/logs. Reverify account access, beta availability, prices and schema before a live smoke test.
6. Build labeled examples from representative retained posts. Label source support and wording per claim separately from independent post materiality. Include zero-claim posts, missed entities, multiple players, negation, jokes, quoted reports, corrections, tentative language and temporal ambiguity. Preserve an unfiltered sample, not only posts the current parser already accepts.
7. Group original posts, reposts, retweets, quotes and near-duplicate families before splitting. Use an earlier development/calibration window and a later untouched test window, with an author-disjoint robustness holdout. Keep each family in one split; do not use later context to score earlier posts. Do not tune on the test data.
8. Learn thresholds on development data and freeze prompt/version/thresholds before final evaluation. Record the development dataset hash and freeze timestamp. Measure false certainty, missed material news (including parser misses), unknown/refusal rate, coverage, reviewer effort, latency and full-input cost. No threshold value or performance target is asserted as already validated here.
9. Run a small authorized live shadow sample only after access and budget setup. Compare sidecars with human review and the unchanged production pipeline. Report actual measured results and any errors. Wider shadow rollout and any later automatic action should be separate explicit decisions based on evidence.

## Official sources checked

- [Decisions guide, availability, price and answer types](https://developers.openai.com/api/docs/guides/decisions)
- [Create a decision: request/response schema, question limits, refusals](https://developers.openai.com/api/reference/resources/decisions/methods/create)
- [October 6 beta release](https://developers.openai.com/api/docs/changelog)

Only text input is used. The guide and reference disagree about hosted image URL support, so that unresolved edge is deliberately outside this pilot.
