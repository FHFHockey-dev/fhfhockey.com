# CHANGES REQUIRED — slice05 owner-boundary/gate review

One **P2 finding, S05-R1**: an auth refresh can remount the workspace after background withdrawal while the document remains hidden. Server-owner checks, inactive actions and other exercised request/session boundaries pass. This is offline local-boundary review, not owner activation or hosted/full-dashboard acceptance.

## S05-R1 — auth callbacks override background withdrawal

`web/lib/forge-testing-grounds/TestingGroundsOwnerGate.tsx:46`–50 withdraws then schedules a fresh verification on every auth callback. `verify` checks liveness/generation but not whether background/pagehide withdrawal remains in force (lines20–36). `visibilitychange` separately withdraws on hidden (lines67–69), so a subsequent TOKEN_REFRESHED event can reopen it without a return-to-visible event.

Finite independent reproduction:

1. Mocked server returns the exact owner/synthetic_preview/disabled capability; real synthetic component mounts.
2. Set document.visibilityState=hidden and dispatch visibilitychange; workspace correctly withdraws.
3. While still hidden, deliver TOKEN_REFRESHED and resolve its new mocked access response as granted.
4. **Observed:** `Synthetic preview` mounts again, with document.visibilityState still hidden. Expected: workspace stays withdrawn until the supported foreground-return path re-verifies.

Original failing expectation/source is [gate-controls.test.tsx](gate-controls.test.tsx), `[S05-R1]`; output preserved in [offline-boundaries.log](offline-boundaries.log). This is a declared background-lock lifecycle defect, **not** a bypass of server identity verification, a wrong-owner grant or an observed leak of real/sealed results. Only the synthetic sample was rendered. Keep foreground/pagehide withdrawal distinct from unrelated auth refreshes, preserve stale-response checks and re-verify on a legitimate return. A correction can stay within the gate and adjacent test; no shared auth/server/config change is needed. No source repair, retry or weakened assertion here.

## Exact scope/pins

Canonical `octoberBranch`, HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. All ten new candidate files, **104 protected files** and 13 owner artifacts matched: **127/127 pins unchanged at end**. Exact expected/actual values in [PINS.start.json](PINS.start.json) / [PINS.end.json](PINS.end.json); owner EVIDENCE additionally hashed and unchanged.

| Main implementation | SHA-256 |
| --- | --- |
| `serverOwnerBoundary.ts` | `5bdd35c403441dd6c04f34908ea0bb3f91a7de4fb7690d63e884cf642bc09fde` |
| `ownerRoutes.ts` | `33c185c9c693e42872b61b9e003dbade8471e2a8f9f73abede6debf7437cb249` |
| `TestingGroundsOwnerGate.tsx` | `741008b25f39935a3bafcd34d83908f34e97d2802da34cd8f40893e7d4f2c529` |
| `web/pages/forge/testing-grounds.tsx` | `69860a37f7df17830b5c09645d774d51c31ec3bb6b1c531bf9f87dcc693daba2` |

The ten-path scope includes those three modules and adjacent tests, the page and three thin access/collection/per-run wrappers. All were inspected along with the actual requireApiUser helper and relevant shared client source. No existing shared source was changed by the candidate. These are uncommitted pins; HEAD alone does not identify the slice.

## Passing evidence and precise trust limits

- Missing/invalid configured owner denies before provider initialization. The server uses the existing real requireApiUser implementation with a **mocked** client factory; that helper calls getUser(token), not decoded client role/getSession. Only verified user ID is retained. Different admin/cron/local/body/query claims cannot establish ownership. Every request re-verifies; provider construction failures, error responses, malformed IDs and thrown private errors become generic denials.
- Duplicate raw authorization headers and malformed normalized credentials deny before provider construction. Responses remain private/no-store/noindex and reflect no token, provider error or private identity. A malformed internal rawHeaders container can fall into generic unavailable handling; this review does not claim public arbitrary-object request validation beyond the actual HTTP boundary.
- All owner mutations remain inactive even after helper-backed synthetic owner, valid origin and JSON content type. The injected store's read and mutation/claim/finish/reveal spies remain untouched. Exported wrappers have no store/executor/trusted mutation origin connected. Unsupported operations/methods, ambiguous resource IDs and mismatched stored owner/run IDs are denied.
- Logs/results/export each require a separate literal trusted true; client reveal/state flags and truthy strings/numbers/objects do not qualify. Error paths do not call sealed readers or reflect private exception text. Late capability JSON completion after logout is ignored, as are tested stale account/session responses. Session-read errors and a capability with execution=enabled cannot mount the sample.
- Generic SSR frame contains no private props or sample data and sets no-store/noindex headers. This is the parent-approved public locked frame, **not SSR session authentication**. Browser session is token transport only; client roles are not authorization.

**Read-adapter limitation:** listOwned/readOperational/readSealed payloads are passed through from the optional trusted store. A deliberate inert adapter returning `{ unsafeAdapterMarker: "SYNTHETIC_OUTCOME" }` from readOperational is returned unchanged; the independent control documents this interface limit. There is no active adapter in default wrappers, so no actual data was exposed. Before wiring one, validate its projection schemas, owner-scoped retrieval, independent reveal/finality policy and atomic/resource access inside the adapter. Method routing and ownership metadata checks alone do not prove payload sealing, source safety, grants/RLS, token revocation or actual stored-object access.

No real session, JWT, owner UUID, profile/settings record, store, runner or hosted provider was read/written here. Pure local owner-policy/request tests do not establish live authentication readiness.

## Actual commands/results

Cwd `web/`, existing Node22.11.0/npm10.9.0; [COMMANDS.json](COMMANDS.json) records exact argv, timings and artifact-local npm cache/log overrides. The standard inert setup is used, all auth/provider construction is mocked, UI fetch is a controlled in-process fixture and server tests forbid external fetch.

```sh
npm test -- --run --config ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-05-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
```

**Failed, exit1:68passed/1failed.** Owner tests **61/61** (19server +32routes +10gate); independent **7/8** (5server +2passing gate/1failed gate). One invocation; original S05-R1 failure preserved. Punycode and Next Head useLayoutEffect SSR-in-jsdom warnings retained, not hidden or treated as browser evidence.

```sh
npx --no-install tsc --noEmit --project ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-05/tsconfig.json
npx --no-install eslint --report-unused-disable-directives-severity warn lib/forge-testing-grounds/serverOwnerBoundary.ts lib/forge-testing-grounds/serverOwnerBoundary.test.ts lib/forge-testing-grounds/ownerRoutes.ts lib/forge-testing-grounds/ownerRoutes.test.ts lib/forge-testing-grounds/TestingGroundsOwnerGate.tsx lib/forge-testing-grounds/TestingGroundsOwnerGate.test.tsx pages/forge/testing-grounds.tsx pages/api/v1/forge/testing-grounds/access.ts pages/api/v1/forge/testing-grounds/runs/index.ts 'pages/api/v1/forge/testing-grounds/runs/[runId]/[operation].ts'
```

**Passed, exit0 each**, empty [scoped-ts.log](scoped-ts.log) / [scoped-lint.log](scoped-lint.log). The frozen scoped TS config disables incremental output and includes only named sources/bootstrap plus imports. No full build/suite. Canonical next-env.d.ts changed concurrently from its observed start hash during this review; both hashes are in PINS.end. Attribution is unknown; the reviewer neither edited/restored it nor started a server. No compiled application/hydration/browser acceptance follows.

First reviewer pin script stopped with FileNotFoundError after resolving root mise-en-place.md under the packet; corrected only the path selection before tests. Original error/changed approach is recorded in PINS.start. This is separate from the substantive gate failure. Owner's Vitest import failure, heavy-lock refusal, EPERM/startup denial and diagnostic curl failure remain in unchanged owner logs.

## Activation/startup gates — unchanged

Trusted assignment and retained local diagnosis identify **owner_not_configured**, before token/provider verification. This is missing FORGE_TESTING_GROUNDS_OWNER_USER_ID, **not rejection of TJ's identity**. No environment files or live session were inspected by this reviewer. Parent's request for direct approval of local owner config plus one bounded read-only session verification remains pending. Inherited AuthProvider profile/settings writes need separate containment/approval; auth-read approval does not authorize those writes.

The historical static action `node tasks/artifacts/forge-testing-grounds-2026-10-24/slice-05/preview-server.mjs` was denied by automatic approval review before process creation. Retained LOCAL-VIEW states the reason was the trusted port3000 prohibition and that indirect/workaround execution was prohibited. This review did not retry it, use another port/agent, probe localhost, identify/replace an existing process or seek substitute approval. Those viewing/activation gates do not block this completed offline source review.

Only reviewer artifacts and the existing diary append changed. No application/shared config/auth/credential/permission/owner activation, production/model/provider/data call, migration, server/browser, Git mutation or new worker. No review operation is running or uncertain. Review itself has no blocked check; S05-R1 requires a bounded frozen correction. Real owner/access activation, safe read adapter, persistence/worker/model/metrics/pilot and visual/browser acceptance remain open. Scout retains acceptance authority.
