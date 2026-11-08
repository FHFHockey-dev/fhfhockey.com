# Four-arm evaluation proposal — no paid execution authorized

Current request, token and spend budgets are **zero**. No model winner is selected. Compare quality and abstention first, then choose the cheapest qualified arm. This proposal does not enable the existing inference route.

## Contracts checked against official documentation, 2026-10-19

[Decisions](https://developers.openai.com/api/docs/guides/decisions) is a public-beta typed assessment endpoint, `POST /v1/decisions`, currently using `gpt-6-luna`. It answers predicates, fixed choices or rubric scores. Responses Structured Outputs is the documented route for custom extracted objects or prose. Decisions input pricing is $0.10/M tokens without output/cache charges; regional and long-context premiums can apply. The documented JS SDK minimum is 7.30.0. Account access and application wire compatibility remain untested.

[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) lists uncached input/output rates of $0.10/$0.50 per million tokens. Those rates do not prove available Gateway routing, account permissions, latency or hockey extraction quality. Do not translate an agent model name into an assumed application API route.

The existing `tweetNewsInference.ts` uses `openai/gpt-5.4-mini`, `generateText`/`Output.object`, a 1,200 output-token cap and 25-second abort. Its caller can create published news under its existing flags; it is not this review-only seam. It was neither changed nor invoked. A future separately approved experiment must explicitly set retry limits: [AI SDK documents `maxRetries: 0`](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) to disable its default two retries. Durable quota, not process memory alone, must bound multi-instance spend.

## Same family-disjoint cases, four arms

| Arm | Proposed behavior | Output authority |
| --- | --- | --- |
| A: rules | Existing deterministic extraction/bindings | Current bounded baseline |
| B: rules + structured extraction | Lightweight model proposes missing claim fields/spans; deterministic identity/date/source validation still applies | Review evidence only |
| C: rules + Decisions | Whole-post relevance plus per-bound-candidate support/wording assessment | Review evidence only |
| D: both | B proposals pass deterministic validation before C assessment | Review evidence only |

Use the same frozen post families and game/source context in every arm. Keep relays, mirrors, retweets, quote variants and edits of one original in the same split; they are not independent corroboration. Include zero-claim posts so recall is measured outside already-extracted candidates. Compare the input available at the original cutoff, not later metadata. Refusal, invalid/extra output, timeout, overflow or unresolved source/clock/binding yields unknown/held.

## Labels, metrics and future separation

The current 5,494-receipt discovery corpus and the imported provisional semantic fixtures are development data. Their existing labels are not human-adjudicated holdout truth. The exact-byte fixture test verifies preservation only. The historical 2,158 receipts without publication clocks remain in a missing-clock stratum, with unknown metadata; they cannot prove source-time precision. Historical trailing-30-day ingress counts are not a current budget estimate.

Before paid comparison, freeze family membership and blinded full-context labels for: post relevance; each claim's subject, event kind, polarity/certainty and governing qualifier; health/attendance/selection distinction; source-time team/league/date/game; extras and unusual roles; original author and post lineage; supported versus unknown/conflicting wording. Retain adjudication provenance and disagreement resolutions. Authenticated edits are revisions/supersession, not automatic independent effects. Original CR011/CR051 ambiguous fixtures remain negative holds; use the separately approved anchored positives for game separation.

Report per-arm precision/recall and missed-claim recall on zero-claim posts, field/qualifier errors, attribution errors, unsupported wording, abstention/coverage, malformed/refusal/timeout rate, latency distribution, tokens/requests and actual billed cost. Include cost per correctly supported claim, rather than request price alone. Do not count abstention as a correct negative or select thresholds on the final evaluation split. Hard qualification gates include zero observed unsupported status changes and zero relay-as-original labels in the frozen evaluation; limited samples cannot establish a zero population error rate.

For genuine forward evaluation, reuse the existing `tweetClaimEvaluation*` capture/bounds/export mechanisms after review and explicit activation authority. Freeze a future startsAt/cutoff/parser/label version, bounded source scopes/count/time window and stop rule before capturing new posts. Keep predictions immutable before labels; record publication, receipt, capture and adjudication clocks separately. Freeze the untouched future families before tuning. Offline development results and local protocol tests cannot replace this step.

## Next approval package, not current permission

First obtain verified package bytes and finish software-only request/response compatibility, injected-fault tests and independent review. Then propose exact project/provider/model IDs, frozen family list, prompts/schema hashes, per-arm call/token caps, concurrency one, retries zero, wall-clock deadline, server-enforced total spend cap, stop conditions, usage accounting and result-only destination. Include reasoning/output tokens, applicable processing premiums and any Gateway fees in the estimate. Do not request credentials or make paid calls until that concrete package is authorized. Rewriting and public formatting follow validated facts and need their own bounded integration review.
