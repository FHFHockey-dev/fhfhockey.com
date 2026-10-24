# ACCEPT WITH LIMITS — frozen slice 02

Accepted as a **local TJ-only identity/ownership policy interface**, conditional on the trusted resolver/configuration/metadata contract. No owner-source defect reproduced. This is not acceptance of real authentication, route authorization, storage controls or hosted activation.

All **26/26 candidate/dependency/artifact pins matched at start and end**, with no drift. Node v22.11.0 and npm 10.9.0. Canonical `octoberBranch` HEAD remains `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`; the two new source files are uncommitted, so their hashes identify the candidate:

| File | SHA-256 |
| --- | --- |
| `web/lib/forge-testing-grounds/ownerPolicy.ts` | `b0de88d27e731856e37470aee46cde57cf50af351fa6cc8ebeacb070842748c5` |
| `web/lib/forge-testing-grounds/ownerPolicy.test.ts` | `9d715c4577c2e98d28f641b96c7e46c3a08d1234db62e8bf7059a89f18fc776d` |

[PINS.start.json](PINS.start.json) and [PINS.end.json](PINS.end.json) retain the exact expected/actual hashes: 2 candidate, 20 dependency and 4 owner-artifact pins. Owner EVIDENCE itself and runtime/lock/config/coordination files are additionally hashed and unchanged. Slice-01 reviewer artifact checksums remain intact. No moving slice-01 application source was read or tested.

## Actual checks and preserved original failure

- **Owner tests: 10/10 passed** in the initial run.
- **Independent controls: all 12 distinct controls passed across two runs.** Initial run was 11 independent passes and one reviewer-fixture failure; the corrected single control subsequently passed. This is not a claim of one 22/22 green invocation.
- **Scoped strict TypeScript: passed, exit 0. Scoped ESLint: passed, exit 0.** Both owner files only; empty logs retained.

Initial Vitest command, cwd `web/`:

```sh
npm test -- --run --config ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-02-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
```

**Exit 1:** 21 passed / 1 failed (owner 10 passed; independent 11 passed / 1 failed). The reviewer's `make(resolver, configuredOwnerUserId = OWNER)` helper substituted OWNER for an explicitly undefined test configuration, so the first invalid-config assertion actually tested a valid owner. This was a reviewer test-factory error, not an owner policy defect. Before changing it, retained the original test source as [boundaries.initial.test.ts.txt](boundaries.initial.test.ts.txt), original [boundaries.initial.log](boundaries.initial.log) and [COMMANDS.initial.json](COMMANDS.initial.json). The initial [boundaries.log](boundaries.log) is also unchanged.

Only that isolated reviewer assertion changed to construct the policy directly with `configuredOwnerUserId: configuredOwner`. No owner test or source repair, weakened expected denial or broad suite repetition. Reran exactly that control:

```sh
npm test -- --run --config ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-02-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism -t 'canonicalizes an exact UUID'
```

**Exit 0: 1 passed / 21 skipped**, including the invalid-config table previously short-circuited by the harness error. All other controls had already passed. Output retained in [fixture-correction.log](fixture-correction.log).

```sh
npx --no-install tsc --noEmit --strict --skipLibCheck --target es2015 --module esnext --moduleResolution bundler --esModuleInterop lib/forge-testing-grounds/ownerPolicy.ts lib/forge-testing-grounds/ownerPolicy.test.ts
npx --no-install eslint --report-unused-disable-directives-severity warn lib/forge-testing-grounds/ownerPolicy.ts lib/forge-testing-grounds/ownerPolicy.test.ts
```

**Exit 0 each**, [scoped-ts.log](scoped-ts.log) / [scoped-lint.log](scoped-lint.log). Exact argv/timing and artifact-local npm cache/log environment overrides for every run are in [COMMANDS.json](COMMANDS.json). Isolated config uses existing Vitest, Node environment and inert repository setup, with no server or external service.

## Verified local behavior

- Missing, null, primitive/object/array/boxed-string, whitespace/line-terminated, malformed-version/variant and placeholder owner settings deny before resolver execution. Valid UUID case is canonicalized without coercion or trimming. Missing/nonfunction verifier denies.
- A different principal is denied even with admin, cron, service-role, localhost or owner-like claims. Extra call arguments and boolean-only authentication claims cannot authorize. The code imports no generic admin middleware or environment bypass.
- Null/malformed principal identities deny. Resolver rejection, synchronous throws and a throwing principal userId getter produce generic `verification_unavailable`, with no reflected exception/token/private identity. Browser-window presence denies without running the resolver; this guard is not a security attestation of server execution.
- Every owner/resource call invokes the captured resolver again. Session loss, resolver outage and another identity do not reuse a previous allow. Request-scoped configuration and resolver are captured at construction; mutating the options object does not switch them afterward.
- Trusted stored-owner mismatch/malformed/missing metadata denies with the same 404 code after authorization. No resource owner/identity leaks through denials. Decisions and the returned policy are frozen. Allow decisions contain only `allowed` and the configured owner UUID; that identifier is intentionally returned for internal owner scoping, not an upstream token or session dump.

## Required integration gates

1. **Resolver trust is an external prerequisite.** `ServerVerifiedPrincipal` is a TypeScript name, not runtime proof. An independent control deliberately returns `{ userId: OWNER, verified: false, authenticated: false }` and is allowed. The helper consumes userId from the resolver; it does not validate either boolean, tokens, signatures or sessions. A fabricated resolver returning OWNER succeeds regardless of those flags. This demonstrates the documented interface limit, not a live-authentication test. A client-controlled boolean/userId/body/query/decoded-token claim cannot establish actual authentication. Integration must obtain the principal from a trusted server verification service and construct the policy in the real request context; no such adapter is present or accepted here.
2. **TJ identity must come from trusted configuration.** No actual TJ account/configuration was read or installed. Generic admin/cron/local permission must not select or override the owner. A cached global policy cannot substitute for the documented per-request construction and correct request-scoped authentication resolver.
3. **Stored metadata must be trusted and retrieval owner-scoped.** `authorizeStoredResource(OWNER)` only compares its argument; it neither loads a resource nor proves its existence, real ownership, storage permissions or absence of a fetch-before-authorize leak. Passing a client owner field violates the contract. Verify APIs, direct URLs, RLS/object storage, artifacts, logs, exports and cross-owner reads/writes with actual integration fixtures before private payload access.
4. **Separate gates remain:** authenticated page/API integration, session revocation behavior in the real auth adapter, mutation/CSRF/idempotency, worker-specific authority, sealing/planned reveal, audit/retention and activation. An `allowed` identity decision grants no early reveal or runner/model/data-pilot permission. No host or model pilot was approved; parent is asking TJ only for runner design direction.

This supports only local Task 2.6/7.1 policy portions. PRD §§1, 7, 8 and 13 authorization/sealing acceptance remain open. No active route, real session verification, database/provider call, paid call, capture, server/browser/full-suite check, Git/index/ref mutation, shared auth/config/policy/migration write or new worker/subagent occurred. The same Astra owner remains the implementation owner; Claude's leased files/Next resource were preserved.

No review check is blocked, denied or running. Owner's original coordination-message delivery to `01a16e23-72b5-76ee-8ade-2d209d0e7002` remains **unconfirmed** because its durable host was unavailable; this review neither retried it nor treats it as an authorization/integration result. Parent can reconcile the lease via the working parent channel. Slice-01 original failed evidence is unchanged and its correction awaits a separate new frozen receipt.
