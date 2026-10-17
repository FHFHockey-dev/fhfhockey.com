# SEC-01 resumed checkpoint — local tested candidate, independent review pending

## Stop and resume gate

TJ prohibited Fast/UltraFast and instructed this task to checkpoint and stop unless Standard could be verified through a supported control. No task speed control/status is exposed here. **Observed speed: unavailable; Standard is unverified.** No speed was inferred from the model name. No subthreads/subagents were launched. Further substantial work requires Standard to be explicitly verified/set. This stop supersedes the previous deadline and continuation request.

## Exact saved package

- `sec01-local-fix-resumed-manifest.json` records baseline HEAD, exact SHA256 and Git blob hashes for all four changed application/test files, candidate patch SHA256, and actual checks.
- `sec01-local-fix-resumed.patch` contains only these four application/test changes, including new files.
- Original `sec01-local-fix-draft.patch`, `sec01-cors-original.ts.txt`, `sec01-local-fix-checkpoint.md`, and `/tmp/fhfh-sec01-checkpoint.md` remain preserved.
- Canonical checkout remains `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`. Baseline HEAD: a8f58de6178e282acd3a71851c66f4a56b119f14.
- On resumption, the original route matched saved HEAD contents and the three-file working draft exactly matched prior patch SHA256 `a5ec02502020731362e76f2f9b8e9016c7b1de947534dab80b151e6c76e10898`.

## Changed files and behavior

1. `web/pages/api/cors/index.ts`: permits HTTP GET only, rejects unsupported URL/method query including repeated values, preserves supported NHL JSON responses and existing bounded upstream diagnostics, hides raw transport errors.
2. `web/lib/NHL/corsProxy.ts`: allows only canonical HTTPS resources on `api-web.nhle.com` and `api.nhle.com` verified in browser callers. Limits paths and statistics query keys/values, denies credentials/ports/fragments/controls/backslashes/path normalization tricks, denies all redirects, uses a checked/pinned public IPv4 lookup in a per-request HTTPS Agent, aborts after 10 seconds including DNS/body, and caps decoded response bodies at 4 MiB. Direct helper destinations also undergo the URL policy. Existing node-fetch v2 dependency only; no manifest/lock changes. A type adapter bridges its older AbortSignal declaration; runtime native-signal behavior is exercised by tests.
3. `web/__tests__/pages/api/cors.test.ts`: 66 route tests with node-fetch fully mocked, covering anonymous reproduction, malformed/private/disallowed destinations, HTTP methods, all verified browser URL families, JSON/error behavior and size of diagnostic previews.
4. `web/lib/NHL/corsProxy.test.ts`: 48 DNS/transport tests. DNS and both native HTTP/HTTPS request functions are replaced before tests. Real node-fetch consumes synthetic streams; no sockets open. Covers actual checked-address lookup handed to the connection, mixed public/private answers, reserved IPv4 ranges and IPv6 rejection, all five redirect status codes, redirect to an approved endpoint, oversized plain/gzip-decoded bodies, stalled DNS/headers/body deadline and cleanup.

Browser helper `web/lib/cors-fetch.ts` remains unchanged. Admin-bypass, RSO, FORGE, IFTTT, radar and other dirty work remain outside this task's edits.

## Completed checks

- Original mock regression reproduced the vulnerable route before the initial checkpoint (expected assertion failed: old route returned 200 instead of 400), without network.
- Resumed proxy tests passed: 114 tests in 2 files.
- Final combined relevant run passed: **130 tests in 5 files**, command in manifest. Includes existing cors-fetch, Game Grid and Linemate Matrix tests.
- Scoped TypeScript used the existing `web/tsconfig.json` compiler options with exactly the four owned root files and their dependencies, no emit: **0 diagnostics**. Initial attempt exposed five type errors in new code/tests; these were corrected, and the final scoped check passed. No full-tree TypeScript pass is claimed.
- Scoped ESLint for the same four files: **passed, exit 0**.
- No full application suite, full-tree lint/typecheck, build, browser, production or live provider checks run. Existing node-fetch dependency emits the Node punycode deprecation warning during tests.

## Review and coordination status

**Independent review has not happened. Do not call this an independently reviewed/accepted remediation.** Tried sending a coordination note to supplied source thread `01a10d0c-2480-73ea-aa65-3be0547bd0d5`; the thread tool returned “thread not found,” so no note was delivered. A read-only thread-list lookup was still pending when the speed stop arrived; its exec cell was terminated. No processes or servers from this task remain running. Full-tree checks were deliberately avoided, so no concurrent full-tree work was started.

Repository delegation instructions require actual model/reasoning verification before a worker assignment. The available task status did not expose those settings; no reviewer was spawned. Parent/Chef should review this exact file/hash package under verified Standard speed, or assign its reviewer with the required model/reasoning settings. Review should inspect URL parser canonicalization, verified caller coverage, socket-level DNS pinning and private-address list, default HTTPS certificate/hostname verification, redirects and cleanup, and the fixture-only test harness.

## Behavior tradeoffs and remaining scope

- Arbitrary upstream destination/method selection is removed; unsupported NHL resources and unusual URL spelling are denied. Explicit `:443`, uppercase host spelling, fragments, extra api-web query parameters, unknown or repeated stats parameters, stats limits above 100, starts beyond six digits and oversized query values are denied.
- Egress is IPv4 only. IPv6-only provider availability fails closed. DNS failure, empty results or any nonpublic/malformed IPv4 answer rejects the whole lookup.
- Redirects always fail even between approved NHL endpoints. Requests exceeding 10 seconds or 4 MiB decoded data fail. Live upstream compatibility/performance was not tested.
- Anonymous permitted NHL requests remain possible. This change does not add a distributed rate limit or claim to eliminate upstream/runtime availability abuse.
- Existing server-side cors-fetch callers bypass this public route and retain their existing behavior; this is scoped to the arbitrary anonymous proxy boundary.

## Next action

After Standard speed is verified/set, have the independent reviewer compare current four file hashes with the manifest and review the exact candidate patch. Resolve substantive findings in owned files, rerun only checks justified by any resulting changes, refresh manifest/patch and hand off for Chef acceptance. No deployment/push/production authorization exists. Do not rerun the historical audit script wholesale: it asserts the old vulnerable behavior in other workers' scope. Keep all unrelated uncommitted work intact.
