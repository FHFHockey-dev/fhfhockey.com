# Failed-attempt diagnosis — no replay

The original provider/transport exception is not recoverable from retained evidence. The precise established defect is **loss of diagnostic information in two exception handlers**. The call failed inside `post_once` before it returned to `run`; evidence cannot distinguish pre-dispatch construction/transport failure from an HTTP error or a received reply that failed local decoding. No non-dispatch or zero-charge proof is available. Billing remains uncertain.

## Recovered original log and call boundary

`original-command-evidence.json` preserves the exact completed command item recovered read-only from this thread using the Codex app. This is the original invocation, not a reproduction. Execution item `exec-c5d42692-46db-431a-87a1-4af4483a0b17` exited 1 after 115ms; its stdout/stderr capture is explicitly untruncated. Its only exception message is `RuntimeError: stopped: unknown billed outcome; reservation retained`, raised at `pilot.py:319`. No original subtype, HTTP error/status or request ID appears. The separate earlier tool approval refusal was resolved by human approval and did not execute; it is not this failure.

The fixed ledger records start `2026-10-19T19:58:29.421635+00:00` and uncertain finish `2026-10-19T19:58:29.512656+00:00` (91.021ms). Neither that interval nor the full 115ms process duration is model latency or proof about provider receipt.

The unchanged reviewed code establishes these boundaries:

1. `pilot.py:308–311` verifies/seals the request, reserves the stage, loads the key, and begins the durable attempt before transport. The actual `sent` then `uncertain` transition means these steps completed. There is no evidence of a key-loading or admission/binding rejection at this boundary.
2. `pilot.py:314` assigns `body,audit` only when `post_once` returns. Both remain null in the original durable record, so no parsed/redacted transport result returned to the caller.
3. `pilot.py:196–198` constructs the opener, TLS context and request before entering its inner try. `:200–205` covers open/read/size/decode/JSON/redaction/canonical serialization. Errors in that block become `RuntimeError('transport_or_reply_<type>')` at `:208`; original exception display is suppressed with `from None`.
4. `pilot.py:318` persists only `type(exc).__name__`, throwing away even that sanitized subtype string. `:319` raises another generic exception with suppressed context. The short-lived Python process then exited. No retained traceback contains the suppressed exception objects. No durable HTTP status, IDs, usage, headers or reply bytes exist from which they could be reconstructed.
5. A missing/inconsistent-usage error after transport returned would retain the parsed body/audit and a different exception type. An extraction schema failure runs only after usage settlement (`:322–325`) and would leave a settled attempt/attempt JSON. Both differ from this original record. No provider response was discarded by the later model schema/grade check, based on this call path.

The transport may itself have received and discarded an error or malformed/oversize reply before returning. That possibility cannot be equated to proof that it happened. An unexpected construction-time RuntimeError is likewise indistinguishable in this record. A local construct-only check can currently create the default TLS context/opener and a request with a synthetic key; it made no network call and does not establish historical behavior.

## Offline checks

All **11 fresh controls pass** against the unchanged reviewed functions, synthetic keys/transports and disposable SQLite. Network socket connections are denied. Eight controls reproduce the same uncertain/RuntimeError/null-response/null-audit signature across construction failure, DNS, TLS, HTTP401 with a request ID, read timeout, UTF-8 decoding, JSON decoding and oversize reply. Three controls distinguish a sealed-wire rejection, missing usage and a schema failure after priced usage. These are information-loss demonstrations, not claims that any particular synthetic exception occurred in the real run.

The initial 11-case run passed but emitted warnings for harness readback connections that SQLite context managers do not close automatically. The harness now explicitly closes them; all 11 pass again with ResourceWarnings promoted to errors. Both logs are preserved. No original source, tests, SQLite budget, result artifact or approval was edited.

## Read-only retrieval assessment

No `resp_...` response ID, provider `req_...` request ID, caller correlation ID or HTTP status was retained. The local `lindgren-0` and request SHA256 are client ledger identifiers, not provider retrieval identifiers. The request used `store:false`. No guessed retrieval URL, new inference, model/auth probe, admin/usage endpoint, broadened key scope or new credentials were used. There is no known-ID retrieval target to reconcile under the existing API permissions. The official [error-code guide](https://developers.openai.com/api/docs/guides/error-codes) distinguishes connection failures from status-coded API failures; the current record lost the information needed to choose either remedy. A documentation lookup for the Responses retrieval reference yielded only a generated stub and no endpoint spec; this is not evidence of provider availability or permissions.

## Smallest recovery boundary

Keep the original reservation and attempt identity blocked. Request existing account/request/billing evidence for the exact UTC interval, endpoint and model through an already permitted user/account view; do not create an admin credential, scan unrelated logs or rerun inference to diagnose it. Such evidence must establish the original outcome before any release or replay. No provider-side lookup was executed during this investigation because there is no known ID and no verified narrowly scoped read target.

Before any later approved execution, the smallest local diagnostic correction is to retain a typed, allowlisted failure record at both handler boundaries: construction/open/read/decode phase; fixed exception category; safe errno/TLS verification code or HTTP status; validated/redacted request/response correlation IDs if present; and bounded, structurally parsed non-secret usage when available. Never persist `str(exc)`/raw headers/arbitrary error bodies, and never let diagnostic writes release a reservation or trigger a resend. This forward correction would not recover this past exception. It has **not** been wired into the frozen runner or used to justify another call.

The experiment remains `unknown billed outcome`, exactly one uncertain Responses attempt, zero Decisions attempts, USD0.2543948 reserved against USD0.26, actual charge unknown. Budget database SHA256 `ac28e83814ed20381b3cfee8049bfdc580dfc556f98ca1da33c70f0897015c44` is byte-identical before/after. All five owned pins, thirteen execution inputs, nine execution artifacts and their original manifest match. No real key was read by this investigation. No new paid call, retry, reservation release/reset, source edit, credential configuration or production action occurred.
