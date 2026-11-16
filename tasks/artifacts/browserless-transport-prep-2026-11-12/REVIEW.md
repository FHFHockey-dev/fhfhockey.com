# Independent Browserless transport review

Reviewed on `octoberBranch`, HEAD `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f`, against the working-tree content pinned below. One review pass; no runtime/test/manifest changes.

## Result

No confirmed newly introduced security defect found in the assigned transport validation, TLS options, redirect handling, connection failure cleanup, or error redaction. The constructor receives only a parsed `wss:` URL, `followRedirects: false` and `rejectUnauthorized: true`. The local deadline covers a stalled handshake; failure calls `terminate()` idempotently. Installed ws 8.21.1 forwards TLS options to `tls.connect()` and aborts/destroys connecting requests on `terminate()`. A registered error listener remains available for the asynchronous error emitted during abort. Dependency error objects are replaced by fixed text and allowlisted diagnostic fields, and the webhook continues logging sanitized diagnostics and returning a fixed error response.

## Finding and evidence gaps

- **P2, existing cleanup limitation — `web/pages/api/v1/webhooks/on-new-line-combo.ts:95` through `:157`.** After a successful connection, `newPage`, navigation, selector, screenshot or upload failure skips `browser.close()` because cleanup is only at the successful end. The unchanged retry loop can establish four browser connections on one failing request without closing the earlier ones. The new connection catch at lines 83–84 correctly closes transport on `puppeteer.connect` rejection, but does not make the entire webhook lifecycle cleanup bounded. This is present in the base code, not a newly introduced regression. If acceptance requires cleanup after every downstream failure, this remains unmet; use a `finally` that releases browser/transport and regression assertions on existing failure fixtures.
- **Compatibility evidence gap — `web/lib/lines/browserlessTransport.ts:61`.** Installed Puppeteer 22.13.1's `NodeWebSocketTransport.create` explicitly sets `allowSynchronousEvents: false`; this replacement omits it, and installed ws defaults it to `true`. Thus back-to-back CDP messages can now arrive in the same tick, without promise continuations running between them. No concrete Puppeteer failure was reproduced in this fixture-only pass, so this is not asserted as a confirmed defect. Preserve the installed option or provide bounded protocol-ordering evidence before claiming equivalent message scheduling. The original Puppeteer User-Agent header is also absent; provider acceptance is unverified.
- **Integration coverage gap — `web/__tests__/pages/api/v1/webhooks/on-new-line-combo.test.ts:20`.** The route fixtures use a user-info-bearing endpoint that the real transport correctly rejects, while mocking the transport. The route's success test therefore proves wiring and prior behavior under mocks, not acceptance of a valid real transport endpoint. Transport tests separately verify a valid token-query endpoint, but no test composes the real transport helper with the route's mocked socket/Puppeteer.
- **Dependency readiness.** `dependency-declarations.patch` proposes explicit `ws` and `@types/ws` declarations matching installed/locked versions; live manifests remain unchanged as instructed. Boundary acknowledgement/application is a parent-owned pending step, not completed review evidence.

## Verification and limits

Passed from `web/`: `npm test -- --run lib/lines/browserlessTransport.test.ts lib/lines/webhookErrorDiagnostic.test.ts __tests__/pages/api/v1/webhooks/on-new-line-combo.test.ts` — 3 files, 77 tests. Inspected Vitest setup and fixture imports: WebSocket, Puppeteer, Supabase and fetch are mocked for these paths. No sockets, servers, provider/database calls, deployments, environment-file reads or credential reads were performed. No build, broad suite, typecheck or lint run for this read-only review.

The TLS/environment test proves explicit constructor options even with an insecure environment flag; it does not conduct a real TLS handshake. Certificate rejection, redirects and response aborts are simulated, with installed-library inspection supporting the implementation. No provider compatibility or production behavior is claimed.

The ticket selected reviewer `gpt-6.1-sol`, medium effort. Actual runtime model/effort metadata is not exposed here; neither those settings nor a strict lead/worker reasoning hierarchy could be independently verified.

## Reviewed SHA-256 hashes

```text
c3421b03ab934bc7d5fb4e04f2a293039b01a4345f254c11126396462ea84ff6  web/lib/lines/browserlessTransport.ts
89587e9150475ad1076b2a37ee0b0d178a1a76a293249af0f355449ef9ca857b  web/lib/lines/browserlessTransport.test.ts
ae67ac61a862946593253dd71ee7341ad29ba9f8f3ff7296f39892fdb72c478f  web/lib/lines/webhookErrorDiagnostic.ts
57fc5cabf77a6d7dd1e383c14b3f5918ca48b7e9eddf465df8c26dfce0bc9fe7  web/lib/lines/webhookErrorDiagnostic.test.ts
98ac3f4b2dc30d4cfd0f7abddfd5efe360fd1468ed3b8088deb0e3a548a2b96b  web/pages/api/v1/webhooks/on-new-line-combo.ts
63a52d30be2bf620548e23eb49441a14a1a28998148a0804190cc7f3d2208db3  web/__tests__/pages/api/v1/webhooks/on-new-line-combo.test.ts
a17876fa6b0e886e9ab65c0855bb871b1c417e882747007f08346d41a8463334  tasks/artifacts/browserless-transport-prep-2026-11-12/dependency-declarations.patch
```

## Final bounded re-review disposition

Re-reviewed the corrections at the same branch/HEAD. **No outstanding local security/correctness finding identified within this review scope.** This disposition supersedes the initial finding/evidence gaps above for the final hashes below.

- **Cleanup finding resolved for the owned connection.** The capture body now runs in `try/finally`, with `transport.close()` after success or a downstream rejection. The connection catch still closes on Puppeteer connect rejection. Existing newPage/goto/upload/Discord failure fixtures now assert the correct cleanup count per attempt. The success fixture checks both browser close and transport close. This bounds local socket cleanup when the operation settles; it does not impose an overall webhook deadline or prove remote browser-process reclamation by Browserless after disconnect. Those remain operational limits, not a claimed guarantee.
- **Scheduling/header gap resolved.** The adapter explicitly sets `allowSynchronousEvents: false` and the matching installed Puppeteer User-Agent. The option type extends current ws typings locally. The package.json import is supported by installed Puppeteer's wildcard exports and repository `resolveJsonModule` setting; the focused test run imports it successfully.
- **Composition gap resolved.** Route configuration uses a valid query-token `wss:` endpoint; nested synthetic user-info errors still exercise redaction. Three new cases compose the actual helper with mocked ws and Puppeteer for success, insecure URL rejection and redirect rejection. They assert downstream side effects, socket allocation/termination and cleared timers.
- **Dependency/operational limits unchanged.** Explicit dependency declarations remain an unapplied patch pending parent boundary acknowledgement. Fixture tests and installed-source inspection do not establish real TLS or provider compatibility, production configuration, browser process lifecycle, or deployment packaging. No external action or credential/environment-file read was performed. No broader suite, typecheck, lint or build was run by this reviewer.

Final focused run: **3 test files passed, 80 tests passed** using the same command recorded above. Re-review budget is complete; no additional review pass was performed. Runtime model/effort metadata remains unavailable.

Final reviewed SHA-256 hashes:

```text
e5a10d123352692b86d116b026a50cfbf6301ba4b91cb373b2d27ee82ba46032  web/lib/lines/browserlessTransport.ts
f64540bde0ebe715eb95280fa6edfbec56180b960d8d3258962143476f3d7dfc  web/lib/lines/browserlessTransport.test.ts
ae67ac61a862946593253dd71ee7341ad29ba9f8f3ff7296f39892fdb72c478f  web/lib/lines/webhookErrorDiagnostic.ts
57fc5cabf77a6d7dd1e383c14b3f5918ca48b7e9eddf465df8c26dfce0bc9fe7  web/lib/lines/webhookErrorDiagnostic.test.ts
5b25812bc291c1e7cfc8be0d819aca9284c21730b8801f00209c9e6d18fdf5e7  web/pages/api/v1/webhooks/on-new-line-combo.ts
ea625c495a098131f74ea49131ad918a1e91edfe323823279948997825cee80a  web/__tests__/pages/api/v1/webhooks/on-new-line-combo.test.ts
a17876fa6b0e886e9ab65c0855bb871b1c417e882747007f08346d41a8463334  tasks/artifacts/browserless-transport-prep-2026-11-12/dependency-declarations.patch
```
