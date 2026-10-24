# Proposed slice05 — dedicated owner boundary and page integration

2026-10-24. Read-only application discovery on canonical `octoberBranch`, HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. **Transfer request only: none of the application paths below has been edited.** This proposal plus `EVIDENCE.json` and `LIBRARY-DELIVERY.json` are the only new report paths in this step. Existing task diary updated. Source paths/baselines are pinned in the evidence.

## Recommendation

Reuse the existing bearer-verification helper `web/lib/api/requireApiUser.ts` inside a dedicated fail-closed Testing Grounds boundary, then apply `createTestingGroundsOwnerPolicy`. Do not reuse admin-only middleware, projection editor grants, service-role authority or a client role flag. This adds a local page/API integration seam without modifying the authentication system or enabling execution.

`requireApiUser` extracts a bearer token and calls `client.auth.getUser(accessToken)` before returning the verified user ID. It does not contain an admin, cron or localhost exception. Its optional `onUnauthorized` callback allows the new boundary to return consistent safe denials without reflecting token/provider errors. The dedicated boundary should validate one strict bearer value first, catch thrown verification errors, discard returned email, and pass only the verified ID to the existing owner policy. Invalid/missing configured owner must deny before creating/verifying a client. This source has been inspected; no claim of a separate existing acceptance receipt for the helper is made. The new wrapper proof must exercise the real helper with a mocked auth client.

The existing owner policy already compares one configured UUID against a request-scoped server-verifier result, re-verifies each check, and denies another resource owner. An admin role is not ownership. Proposed server configuration name: `FORGE_TESTING_GROUNDS_OWNER_USER_ID`, validated without trimming/coercion; no value is supplied, inspected or activated by this proposal. Missing configuration remains fail-closed. Production/environment setup requires its normal review.

## Verified session transport and page boundary

The existing browser client uses persisted Supabase sessions; `AuthProviderContext` obtains `getSession()` and subscribes to auth changes. Client role/profile state is presentation context, not server authorization. The bounded inspection of `lib/supabase`, `contexts/AuthProviderContext`, `pages/auth` and `lib/api` found no site-auth SSR cookie bridge. Browser navigation does not normally supply the bearer header used by the APIs. Do not invent a trusted cookie or authorize SSR from decoded session claims.

**Proposed page behavior:** initial SSR/HTML contains only a generic locked frame, with no experiment data, artifact URLs or owner identity. The client obtains its existing access token solely for transport, calls the dedicated access endpoint, and mounts the workspace only after server owner verification. Every subsequent API call independently verifies the token and configured owner. Sign-out/session changes immediately withdraw the workspace, clear prior authorization, abort pending reads and discard late replies from an old session. No authorization result is saved in localStorage or trusted on refresh. Set `private, no-store` and `noindex,nofollow` on the new page and API responses.

This makes the **workspace and all data/actions owner-only**; it does not claim the generic HTML frame itself returns an owner-authenticated HTTP status on initial navigation. If the required boundary is literal SSR denial before any frame bytes, an explicit server session-transport/cookie design is required outside this proposed slice. That is the one integration distinction for Scout to approve; TJ-only ownership itself is already settled. Do not change the shared auth context/cookies merely to conceal this distinction.

The current shared `_app` mounts AuthProvider, layout and analytics. This slice must not run the full app or claim its inherited global behavior has been isolated. Offline tests mock that context and the provider client. Shared `_app`/layout changes, if later necessary, require a separate lease.

## Exact requested paths — all absent

| New path | Small responsibility |
| --- | --- |
| `web/lib/forge-testing-grounds/serverOwnerBoundary.ts` | Request-scoped adapter around existing verified bearer auth and local owner policy; safe denial/cache headers, strict principal boundary, no role/cron/local bypass. |
| `web/lib/forge-testing-grounds/serverOwnerBoundary.test.ts` | Actual helper with mocked client; owner, impersonation, malformed/expired bearer, verifier failure and no-side-effect controls. |
| `web/lib/forge-testing-grounds/ownerRoutes.ts` | Injectable small handlers with an explicit operation/method allowlist and trusted owner-scoped store metadata; default execution inactive. No database/provider imports. |
| `web/lib/forge-testing-grounds/ownerRoutes.test.ts` | Every artifact/action denial, resource ownership, sealing, method/origin policy and zero side effects using inert stores. |
| `web/lib/forge-testing-grounds/TestingGroundsOwnerGate.tsx` | Generic locked/denied/unavailable frame, verified-access handshake, sign-out/race-safe workspace mount. Reuse existing session transport, not its role decision. |
| `web/lib/forge-testing-grounds/TestingGroundsOwnerGate.test.tsx` | No premature mount/fetch; failed auth and session change/late response isolation. |
| `web/pages/forge/testing-grounds.tsx` | Thin Pages Router mount with no private SSR props and page-local cache/indexing headers. No navigation change. |
| `web/pages/api/v1/forge/testing-grounds/access.ts` | GET access check, returning a minimal granted/inactive response only after server owner verification. Never expose configured ID. |
| `web/pages/api/v1/forge/testing-grounds/runs/index.ts` | GET history-list / POST launch boundary. Default backend inactive; no job acceptance or execution enabled. |
| `web/pages/api/v1/forge/testing-grounds/runs/[runId]/[operation].ts` | Exact allowlisted read/action dispatch; reject unsupported operations. No catch-all worker/executor access. |

Requested helper/UI files remain in the assigned Testing Grounds namespace; the page and three API wrappers require explicit transfer before edits. Future slice artifacts would need their own exact ownership receipt before implementation. No changes are requested to shared `requireApiUser`, `lib/supabase`, auth context, admin/editor gates, `_app`, global layout, navigation, package files or schema.

Proposed operation allowlist: GET `progress`, `health`, `manifest`, `logs`, `results`, `export`; POST `cancel`, `retry`, `reveal`. History/launch use the collection route. Unknown operations including `claim`, `finish` and raw `checkpoint` access are denied. Candidate/refit/settings writes are not implemented by this slice; they remain absent/disabled until their schemas and leases exist. Listing an operation does not enable it: default adapters return a safe unavailable response after authorization. Real result/export/reveal providers remain disabled; even an owner does not bypass the planned reveal contract.

## Minimal offline proof before handback

1. **Principal and configuration:** missing/invalid owner denies before verifier/store calls; missing, malformed, duplicate or expired bearer denies; thrown verifier errors become a generic unavailable response. Forged body/query/user/role claims, another verified admin, cron bearer and loopback headers grant nothing. The only passing principal is the server-verified configured owner. Do not emit token/email/owner-config values in responses or logs.
2. **Every artifact/action:** table-driven checks cover access, list, launch and each allowlisted per-run operation. On denial, assert zero payload/store/action calls. Fetch only trusted owner-scoped metadata after authentication; another resource owner yields the same not-found response as absence. Caller-supplied owner fields are rejected/ignored, never authorization. All responses use private/no-store; no cross-origin access headers.
3. **Sealing:** running, pending, cancelled, failed and completed-awaiting-reveal fixtures cannot return result payloads, result exports, score-bearing logs or raw checkpoints, even to the owner. Only an injected, trusted reveal authorization may permit the permitted result projection in offline tests; a run-state string or client `revealed=true` must not grant it. Worker checkpoint/claim/finish are never exposed through owner routes.
4. **Actions and CSRF:** strict method/content-type validation; no state-changing GET. Use non-cookie bearer authorization and reject cross-site unsafe requests. Proposed mutation Origin policy compares against an explicitly configured trusted origin, not Host/forwarded headers; absent/invalid origin configuration fails closed. No ambient cookie fallback. Unauthorized/malformed/repeated clicks cannot launch a real job; default backend never accepts launch. The approved store idempotency contract remains a later integration dependency.
5. **Page lifecycle:** signed out/checking/denied/verifier-unavailable states mount no workspace or data hooks. Client admin spoofing cannot authorize. Sign-out or account switch clears access immediately and ignores late successful responses. The page's initial HTML carries no private configuration or artifact links. Existing fixture-preview state stays clearly labeled and is not represented as persisted execution.

Run only the three new focused test files, scoped TypeScript/ESLint and fixture SSR/static checks. No full suite, Next server/build slot, hosted `getUser`, DB, credential lookup, production/provider requests or real owner configuration. Tests inject synthetic identities and mock the auth factory before imports; import-time requests are a failing test. Browser visual/reconnect verification needs a separate resource allocation.

## Read-only dependencies and current limits

Direct candidate dependencies: existing `ownerPolicy.ts`, progress/health projection modules, `requireApiUser.ts`, `lib/supabase/index.ts` token factory, browser session client/context, and frozen preview components. The token factory imports the shared browser client and has a public URL fallback; local tests must not let those real clients initialize or verify sessions. New boundary should defer its real verifier dependency until an authorized request path, and tests must mock it. No ignored environment file is read.

`adminOnlyMiddleware.ts` has cron/local exceptions and grants any admin; `AdminPageGate.tsx` is client role-based and can admit a review-token route. Both are unsuitable as Testing Grounds authorization. `playerForecastSeasonEditorOnlyMiddleware.ts` adds its own local-runtime/editor-list/admin database policy and service-role client; do not repurpose or change those grants.

S03-R1 has now been accepted by Scout within independent local-review limits. Its E+W bound (legacy up to2E) must be counted in any future hosted plan. That acceptance does not establish durable atomicity, scheduler availability, auth integration, actual model/source validity or a budget. This requested slice similarly proves only local access-boundary behavior; hosting/migrations/private storage/provider credentials/activation and actual real-data pilot remain separately gated.

## Preview delivery and visual-check option

Frozen slice04 HTML was uploaded using the supported Library create flow and local identity metadata helper. Library ID **`libfile_cc38ec891b2481918b7a88ecd0c24341`**, file `file_00000000d41481fd8a1a40aac3162ff1`, version0, filename **`preview(1).html`**, 236107 bytes. Original HTML bytes still match the frozen SHA-256. No sharing policy was changed. Native download: `https://chatgpt.com/api/library/files/libfile_cc38ec891b2481918b7a88ecd0c24341/download`. Full delivery receipt is `LIBRARY-DELIVERY.json`.

Library attachment succeeded; **inline rendering/browser visual QA has not been observed**. User may download and open the self-contained HTML. If a rendered view is needed, request one bounded local static-file Playwright session at 1440×1000 and 390×844, with all network requests blocked, on this exact HTML. It needs no Next server/build directory/port. Keep screenshots local in a newly allocated artifact path; do not upload them without a screenshot-delivery request. If the local browser requires HTTP rather than file access, ask coordinator for one distinct loopback static-server port and private temporary directory first; never use Claude's `.next-playwright`/3110 or ports3000/3105. This visual check is proposed, not started or a claim of tested appearance.
