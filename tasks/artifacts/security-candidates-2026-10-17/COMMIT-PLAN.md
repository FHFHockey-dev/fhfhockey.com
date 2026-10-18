# HEAD reconciliation for the security candidates (sprint lane S-08, 2026-10-18)

**Superseded plan.** TJ committed and pushed `0de97e77d` ("10/17 1930 checkpointing") at 19:35 EDT on 2026-10-17, so no commit series is needed. The material below the result table is kept only as history.

## Result

Applying `1-proxy-redirect.patch`, then `2-admin-relay.patch`, then `3-admin-role-binding.patch` to the `ceceb407a` blobs gives this when compared with HEAD `0de97e77d`:

| File | HEAD vs. replayed result |
| --- | --- |
| `web/lib/NHL/corsProxy.ts` | Same |
| `web/lib/NHL/corsProxy.test.ts` | Same |
| `web/__tests__/pages/api/cors.test.ts` | Same |
| `web/utils/adminOnlyMiddleware.ts` | Same |
| `web/__tests__/pages/api/v1/db/cron-auth-boundaries.test.ts` | Same |
| `web/__tests__/pages/api/v1/db/operational-route-auth.test.ts` | Same |
| `web/__tests__/utils/adminOnlyMiddleware.test.ts` | Differs only by one uncommitted 401 case (`getUser` errors while carrying an id), added on 2026-10-18 on top of `0de97e77d` |

So HEAD equals the intended proxy-redirect, admin-relay and role-binding result. The only new change is that 4-line test case.

## Artifacts
- **Restored:** `candidate-a-proxy-redirect.patch` and `candidate-b-admin-relay.patch` are committed history in `0de97e77d` and were restored unchanged.
- **Kept as evidence, untracked:** the patches `1-`, `2-` and `3-*.patch` plus `evidence/mkpatch-and-verify.sh` are the decomposition that proves the equality above. Drop them if only the committed history matters.

---


Local only. Nothing was committed, pushed or deployed by this lane.

## Where the code is now
- **Already committed:** TJ's checkpoint commit `0de97e77d` ("10/17 1930 checkpointing", on top of `ceceb407a`) contains all three changes together, mixed with unrelated work.
- **Not yet committed:** the working tree differs from `0de97e77d` in these files only by one added 401 test case in `web/__tests__/utils/adminOnlyMiddleware.test.ts`. That case covers a `getUser` call that errors while still carrying a user id.
- **What these patches are for:** the separate commits below are for splitting history or for a sliced release onto `master`. Production `master` is still at release `457435eb`, which shipped neither repair.

## Patches, applied in order to `ceceb407a` bytes

| # | Patch | SHA-256 | Files |
| --- | --- | --- | --- |
| 1 | `1-proxy-redirect.patch` | `18776478…fe7b6` | `web/lib/NHL/corsProxy.ts`, `web/lib/NHL/corsProxy.test.ts`, `web/__tests__/pages/api/cors.test.ts` |
| 2 | `2-admin-relay.patch` | `110ff7e2…ca7e8` | `web/utils/adminOnlyMiddleware.ts`, `web/__tests__/utils/adminOnlyMiddleware.test.ts` |
| 3 | `3-admin-role-binding.patch` | `53406421…6a5ec` | `web/utils/adminOnlyMiddleware.ts`, `web/__tests__/utils/adminOnlyMiddleware.test.ts`, `web/__tests__/pages/api/v1/db/cron-auth-boundaries.test.ts`, `web/__tests__/pages/api/v1/db/operational-route-auth.test.ts` |

These replace `candidate-a-proxy-redirect.patch` and `candidate-b-admin-relay.patch`, which no longer matched once patch 3 landed in the same file.

**Proof** (`evidence/mkpatch-and-verify.sh`):
1. A scratch copy starts from the `ceceb407a` blobs of all seven files.
2. `git apply --check` runs, then `git apply`, for patches 1 → 2 → 3.
3. All seven resulting SHA-256s equal the current working-tree bytes (`all_match=1`).

Stage 1+2 is byte-identical to the state tested on 2026-10-17: 10 files, 274 tests, scoped ESLint and tsc clean.

## Suggested commit messages
1. `Follow one allowlisted NHL redirect in the CORS proxy`
   > The proxy refused all redirects, so the allowlisted /v1/{schedule,standings,score}/now resources (307 to a dated path) failed with 502. It now follows at most one hop. Each hop must pass parseNhlProxyUrl, gets a fresh checked IPv4 lookup, and shares the 10 s deadline. The redirect body is consumed before the next hop.
2. `Withdraw the local admin exception for relayed requests`
   > A tunnel or reverse proxy that presents Host: localhost delivered remote callers on a loopback socket and received the service-role client. The exception now also requires local-only forwarding evidence: no Forwarded or Via header, a local X-Forwarded-Host, and loopback-only X-Forwarded-For and X-Real-IP. It also requires a strictly parsed local Host, which fixes the [::1] branch. These headers can only withdraw access.
3. `Bind the admin role lookup to the verified user id`
   > adminOnly now takes data.user.id from getUser(), returns 401 when the id is missing or getUser errors, and filters users by user_id instead of relying on RLS alone. Tests cover 403 for non-admins, admin success, the id binding and 401 for a missing or unverified id.

End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Test commands (run from `web/`)
- **After commit 1:** `npm test -- --run __tests__/pages/api/cors.test.ts lib/NHL/corsProxy.test.ts lib/cors-fetch.test.ts components/HomePage/useHomepageGames.test.tsx`
- **After commits 2 and 3:** `npm test -- --run __tests__/utils/adminOnlyMiddleware.test.ts __tests__/pages/api/v1/db/operational-route-auth.test.ts __tests__/pages/api/v1/db/cron-auth-boundaries.test.ts __tests__/pages/api/v1/db/projection-materialization-auth.test.ts`
- **Lint:** `./node_modules/.bin/eslint lib/NHL/corsProxy.ts lib/NHL/corsProxy.test.ts __tests__/pages/api/cors.test.ts utils/adminOnlyMiddleware.ts __tests__/utils/adminOnlyMiddleware.test.ts __tests__/pages/api/v1/db/cron-auth-boundaries.test.ts __tests__/pages/api/v1/db/operational-route-auth.test.ts`

## Results on the final state (2026-10-18)

| Check | Result | Log |
| --- | --- | --- |
| Focused tests (proxy, its browser callers, admin guard, three route-auth suites) | 10 files, 280/280 passed | `evidence/focused-green-s08.log` |
| Scoped ESLint, 7 files | Exit 0 | `evidence/eslint-s08.log` |
| Scoped TypeScript, 8 roots plus `.d.ts`, 1,095 source files | 0 diagnostics | `evidence/scoped-tsc-s08.log` |

Not run: full tsc, full suite, build, live NHL or production. The NHL `/now` redirect behaviour stays unverified until a bounded smoke test after an authorized release.

## Coverage of the audit items
- **G1 P3** (`super-goal-audit-2026-10-17/findings/G1-auth-draftranker.md` item 9): the audit's "HEAD" was `ceceb407a`. The current code follows one allowlisted, DNS-rechecked hop and refuses everything else. Tests cover:
  - unapproved Locations: metadata IP, http downgrade, port, lookalike host, userinfo, unapproved path, fragment, `[::1]`, invalid;
  - a missing Location;
  - a second hop;
  - rebinding on the hop;
  - a stalled hop against the shared deadline;
  - route-level allowed and denied redirects.

  No further fix was needed.
- **G1** ("committed tests cover neither 403 nor admin success"): `adminOnlyMiddleware.test.ts` covers these, each in both development and production:
  - non-admin and missing role → 403;
  - admin → handler with the service-role client;
  - the `.eq("user_id", id)` binding;
  - missing, empty or unverified id → 401;
  - rejected or malformed bearer → 401.
