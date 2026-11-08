# Bounded recovery feasibility — no provider call

**A count-based Responses reservation can fit USD0.0056052; the evidence does not yet justify making the counting call.** The original USD0.2543948 uncertainty remains fully reserved. No counting, inference, auth/model probe, provider retrieval or ledger mutation ran.

## What the official evidence establishes

The [token-counting guide](https://developers.openai.com/api/docs/guides/token-counting) describes an exact model-input count including request-formatting tokens and warns that tools/schemas complicate local counts. A subsequent generation must use the same model and every input-bearing field counted, including instructions and output schema. The output cap includes non-visible tokens. The retrieved OpenAPI confirms `POST /v1/responses/input_tokens`, an integer `input_tokens` result, and ordinary bearer-key authentication. A count is not permission proof for this particular key/project.

The guide, retrieved endpoint spec, targeted official billing searches and [pricing page](https://developers.openai.com/api/docs/pricing) did **not** establish whether counting is free or its charge if billable. Missing pricing is not proof of free service. No call is proposed as ready to execute on that assumption. The official [spending-controller example](https://developers.openai.com/cookbook/articles/per_run_spending_controller_responses_api) demonstrates counting before reservation, but explicitly uses fictional prices; it supplies neither current count pricing nor account permissions. Lookup limitations are recorded in `documentation-evidence.json`.

The existing key was never read. Its actual permission to call the count endpoint remains unknown; no admin access or expanded key scope is warranted. The previous human approval named `/v1/responses` and `/v1/decisions`, not a new token-counting request; this feasibility instruction explicitly prohibits provider calls now.

## Exact conditional arithmetic

Remaining budget is 5,605,200 nano-USD. With 1,024 generated tokens reserved, default short-context Luna rates, every input charged at the higher input/cache-write rate, and the already accepted 10% uplift envelope:

`R(N) = ceil((N × 0.125 + 1024 × 0.50) × 1.10 × 1000)` nano-USD.

| Exact counted input | New reservation | Fits remainder |
| --- | --- | --- |
| 36,669 | USD0.005605188 | Yes |
| 36,670 | USD0.005605325 | No |

36,669 is below the 272K long-context threshold. Even applying long-context rates conservatively, 17,310 inputs reserve USD0.005605050; 17,311 would exceed the remainder. Six exact-integer/Fraction boundary checks pass. For illustration only, **not an actual count**, 2,000 inputs reserve USD0.0008382. Any counting charge must be included before admitting generation and reduces these limits; the table assumes a separately verified zero count charge.

This is a practical conditional route without reserving an entire model context. It is not a new clearance, account-cost guarantee or measured token count. No arbitrary character-to-token assumption was used. The retained request is 4,786 canonical UTF-8 bytes, but bytes are not the complete model input count.

Installed `tiktoken` is version0.9.0 and `encoding_name_for_model('gpt-6-luna')` fails with `KeyError`. No encoding was guessed, downloaded or installed. Exact Responses formatting/schema overhead is not locally proved. Thus a local tokenizer cannot currently close the gap as an alternative to the endpoint.

## Original transport exercised entirely offline

`offline_original_transport.py` compiles the retained **original** source bytes (SHA256 `640db83c58c2045c65f2935d69fe63e7d75ea23402bef8a994b27cf9354daba9`) with only its original resource location supplied. The exact original wire SHA256 is `089b0f5245e08c54157766093a75e9904ce78b7baac77052ec52669e0e8d1086`.

The original sealing, TLS-context creation, real urllib opener construction, request construction and response decoding pass against an in-process stub of `OpenerDirector.open`, using a synthetic bearer string. Network connect, DNS lookup and bind are denied by an audit hook. TLS hostname/certificate requirements, fixed method/URL and20s timeout are checked. One stub call succeeds; no real key or ledger is opened, and no local HTTP server/socket is used. This detects no reproducible construction/runtime error in that boundary. DNS, TLS handshake, actual HTTP socket serialization, the real credential and provider behavior were not exercised. The result does not establish the cause or outcome of the original failure.

## Stop boundary

Before considering any new provider operation, establish the counting endpoint's billing/bound and existing-key permission, then obtain clearance for the exact count payload/destination and a narrowly bounded additional attempt. If counting is not demonstrably zero-cost, its known maximum must also fit the remainder. A count/response/model mismatch, request drift, error or unavailable count must stop before generation. Preserve the old reservation even if a fresh bounded request later succeeds.

The current runner intentionally blocks any later stage while the original attempt is uncertain; no ledger admission policy or executor was changed here. A reviewed amendment would be needed to permit a separately identified operation within the remainder without releasing/resetting the old attempt. Count semantics are now supported; count billing/permission and such an amendment remain the concrete blockers. No further research or user action is requested by this checkpoint.
