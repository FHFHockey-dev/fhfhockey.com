# One approved retry — TLS certificate failure, stopped

The single user-approved retry executed and stopped at the first extraction attempt with **SSLCertVerificationError**, stage **open**, errno1, verification code20. The diagnostic patch retained this specific cause. No HTTP status, provider request/response ID or usage was returned. Neither Decisions call ran; no extraction result or four-arm comparison exists. The process exited0 because it handled and recorded the partial failure, not because the pilot completed.

Local read-only inspection subsequently found the Python3.13/OpenSSL3.0.15 default TLS context loads **zero CA certificates**. Neither compiled default trust file `/Library/Frameworks/Python.framework/Versions/3.13/etc/openssl/cert.pem` nor trust directory `/Library/Frameworks/Python.framework/Versions/3.13/etc/openssl/certs` exists. `certifi` is installed. This is a concrete current local trust-store problem consistent with the certificate-verification failure. No trust setting, certificate, credential or environment variable was changed; no further handshake/request was made. It does not reconstruct the first attempt's discarded exception.

## Authorization and accounting

The direct user statement was “Approve one retry with a $0.52 total test cap.” Its exact scope, prior payload authority and fixed runtime hashes are retained in `../comparison-authorized-retry-2026-10-19/authorization.json` and `execution-manifest.json`. The same retained source, clocks, player context, schema/prompt, provisional labels and rules proposals were used. No token-count endpoint or new family was added.

One aggregate ledger contains an exact copy of the original unresolved row and the new retry row. The original database remains byte-identical evidence; no old row or reservation was released or reset. The approved aggregate cap amendment is USD0.52. Current exposure is:

| Item | Retained reservation |
| --- | --- |
| Original uncertain extraction | USD0.2543948 |
| Instrumented retry extraction | USD0.2543948 |
| **Total reserved exposure** | **USD0.5087896** |
| Unreserved within USD0.52 | USD0.0112104 |

There is no known settled charge ceiling. **Actual spend is unknown**, not established as zero. Despite the observed TLS failure, both reservations remain conservatively retained. No accounting reconciliation or non-dispatch proof was substituted for authoritative evidence. The new attempt ran from `2026-10-19T20:34:17.908769+00:00` through failure recording at `2026-10-19T20:34:18.044736+00:00`; this approximately136ms failed local/transport interval is not model latency. No further call or automatic retry occurred.

## Verification and quality limits

55 focused offline cases passed before execution:12 aggregate retry/admission cases,15 diagnostic cases,25 existing pilot cases,3 unchanged secret/binding regressions. They cover original-reservation carry-forward, one-winner concurrent admission, exact cap/one-nano boundary, no-reset/restart, uncertain stop, safe actual-transport HTTP-error propagation, source binding and secret redaction. They are owner executions; no new independent review is claimed.

Post-run checks match all17 pinned execution files, all9 original run artifacts and the original artifact manifest. The original database SHA256 remains `ac28e83814ed20381b3cfee8049bfdc580dfc556f98ca1da33c70f0897015c44`. Its original row is byte-for-value identical in the aggregate. Aggregate SQLite integrity is `ok`; it has exactly two uncertain Responses rows, no Decisions rows, and a USD0.52 cap. See `result-summary.json`, `run-01/stopped-partial-pair.json`, `run-01/final-ledger.json`, `aggregate-budget.sqlite` and `local-tls-metadata.json`.

The earlier source-only rules baseline remains the sole grade: one held coarse proposal, TP0/FP1/FN2 under full material-field exact matching against two provisional development labels, with no hallucinated event. It is not the complete deployed pipeline. No model/verifier output is available to grade or compare, and the family/gold claims remain in the denominator. Native eligibility stays false; no superiority or future-performance conclusion follows.

The next bounded action is review of the Python CA-bundle configuration offline, preserving certificate verification. Another provider request, budget release or reconciliation requires its own applicable authorization/evidence; the single retry authorized here has been consumed. No production/Vercel/deployment/publication, credential change, data repair, new key read after the failed attempt or external communication was performed.
