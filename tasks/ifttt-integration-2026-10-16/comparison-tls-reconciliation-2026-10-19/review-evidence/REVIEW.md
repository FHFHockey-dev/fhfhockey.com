# Instrumented retry TLS incident — independent narrow review

**Recommend zero-charge reconciliation for `lindgren-approved-retry-0`: its failure is pre-HTTP TLS authentication failure on the pinned fresh HTTPS connection path. Keep the first attempt unknown.** No provider usage is required for this non-dispatch classification; no ledger change or further request was performed.

## Evidence and call order

The retry's retained failure is stage `open`, `SSLCertVerificationError`, errno1, verify_code20. Its safe metadata exactly matches the aggregate ledger. All 17 executed inputs match execution manifest `f1e452f1a7737a1fb5fc831ed78138a3d9d445867886005418be3315d8b9a968`; all seven incident artifact entries match.

The actual executed `pilot.py:253`–`:259` creates a fresh verified SSL context and opener, fixed HTTPS destination, empty proxy configuration, no redirects and no retry. The retry runner stops its loop on the exception; neither Decisions stage ran. Absence of an HTTP response or usage alone would not prove non-dispatch. The certificate-verification exception plus this path supplies the proof:

1. Local Python3.13 `urllib.request.HTTPSHandler.https_open:1366` calls `AbstractHTTPHandler.do_open:1278`, constructing a new `HTTPSConnection`.
2. `http.client.HTTPConnection.send:1027` calls `connect()` before any `sock.sendall` of HTTP headers/body.
3. `HTTPSConnection.connect:1467` calls `context.wrap_socket`; its default immediate handshake must complete certificate authentication before returning to the HTTP sender.
4. Verification error20 identifies failed certificate authentication. The fresh default context's zero CAs and missing default trust paths support initial-handshake failure. No proxy CONNECT, redirect, reused connection, early application-data path or retry can hide a prior HTTP request on this pinned call path.

The offline control exercises those actual stdlib methods with only socket creation and the TLS failure mocked. It observes one connection path, verification failure20 wrapped as URLError, **zero application write calls and zero application bytes**. It uses no DNS, real socket, credential or provider. This is a call-order control, not a historical packet capture. See `stdlib-call-path.json`, `probe_no_http_after_tls_failure.py`, `offline-no-http-proof.json`.

TCP/TLS handshake traffic may have occurred in the real attempt. The HTTP request line, Authorization header and model input could not cross this failed TLS authentication boundary.

## Accounting scope

Reconcile only the instrumented retry to zero charge with an evidence-linked audit preserving its previous uncertain reservation and failed attempt. Release **$0.2543948**; do not reset it to resendable or erase the failure. The original `lindgren-0` retains its **$0.2543948** unknown reservation: its discarded RuntimeError cause cannot be reconstructed from the retry or current trust-store state.

Proposed aggregate exposure becomes **$0.2543948**, with **$0.2656052** unreserved under the existing $0.52 cap. Aggregate actual spend remains unknown because of the first attempt. No reconciliation, block clearing, retry allocation or new network authority follows automatically from this recommendation.

## Smallest existing verified transport option

Keep urllib verification and explicitly use the installed certifi bundle in a per-request context: `ssl.create_default_context(cafile=certifi.where())`.

The existing bundle `/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13/site-packages/certifi/cacert.pem` successfully loads **151 CAs** into an offline scratch context with **CERT_REQUIRED** and **check_hostname=True**. Default context metadata confirms zero CAs and missing default paths. See `offline-trust-option.json` for path/hash, runtime version and counts.

No installation, environment edit, disabled verification or persistent/global trust change is needed. The scratch context made no connection; the provider chain is not live-retested. This option was not wired into the runner. A reviewed transport patch/resealed execution and applicable parent authorization must precede another request.

## Integrity and limits

The aggregate database was opened via immutable read-only SQLite and remains byte-identical: SHA256 `a3d98e15e73b9a58f2312d33153c15bf1b30711f0f80f48a16a83d05eb64e361`. No credential file/value, provider endpoint, trust setting or ledger was modified/read as a credential action. No real handshake/provider request occurred in review. All new evidence is under this `/tmp` root; source and original evidence are unchanged. No action was denied or left pending/in flight. The historical first billing outcome alone remains explicitly unknown.
