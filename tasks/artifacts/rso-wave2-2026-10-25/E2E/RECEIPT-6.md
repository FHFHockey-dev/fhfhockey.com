# SC-541-FIX receipt: hide the private Yahoo lineup on auth failure (2026-10-26, Claude)

Contract (TJ, via the orchestrator): **"Hide on auth failure."** Lane SC-541-FIX. Nothing committed. No production, network, Yahoo or DB access. No GIT_DIR.

## Files (sha256)
| File | sha256 |
|---|---|
| web/components/StarterBoardYahoo.tsx | 368828bbebcf6b56eda759fd2e374720cf1d068a5e89568badaa7d0bb0377c5c |
| web/components/StarterBoardYahoo.test.tsx | fed2a9a37db9e3a70db1eb8d9d4b317be987ae4a6dc352a5ff19039924c082fb |
| web/e2e/start-chart.spec.ts | 7211bd2224aa8c9eb0c873ef95a80502350f4cdb2e1d7c8de9dfb8f5421218dd |

## Product change (`web/components/StarterBoardYahoo.tsx`, `load()`)
- `let denied = false` is set before the `try`. After the response, `denied = response.status === 401 || response.status === 403`.
- In the `catch`, when not aborted: `if (denied) setData(null);` then `setError(...)`. So a 401 (Yahoo connection expired) or 403 (access denied or unverified) hides the private lineup and shows the error. Any other failure (network, 5xx, provider error) keeps the last comparison with the error.
- A successful in-flight refresh still doesn't blank the lineup (no `setData(null)` at the start of a refresh).
- Lapsed entitlement (`canSync` false, no refresh) keeps the comparison read-only with Refresh disabled (unchanged).

## Unit tests (`web/components/StarterBoardYahoo.test.tsx`)
- The old "retains the comparison on a failed refresh and when entitlement is lost" test is split by contract:
  - **hides** on 403 "Access could not be verified" (its old mock, now an explicit 403), on 403 "Draft Pro access is required." and on 401 "Yahoo connection expired". No "C: Private Center", team name or evidence remains, and the error is shown.
  - **keeps** the last comparison with the error after a 500 provider error and after a network rejection.
  - **lapsed entitlement:** the comparison stays visible, Refresh is disabled, and no second request is made.
- Results: **10/10 in UTC and in America/New_York.**
- **Mutation check** (a `/private/tmp` git-archive copy, with `if (denied) setData(null);` removed; the canonical tree was not touched): exactly the 3 hide cases fail, and the 5xx, network and lapsed cases pass (`run-6/sby-mutation.log`). The copy was deleted.

## E2E `web/e2e/start-chart.spec.ts` (isolated :3160, `PLAYWRIGHT_ISOLATED_NEXT=1`, specs block non-loopback, server stopped)
Test-side drift fixes for case 541. All of it is drift from `fd58ba245` (premium sync) and the account-menu redesign; no assertion was weakened.
1. Summary label "… · Draft Pro" → "… · Premium sync" (from RECEIPT-5).
2. Provider-sync access mock, eligible (from RECEIPT-5).
3. Sign-out: at 1440px "Sign Out" is now a `button` in the account menu (was `menuitem`). At 390px it sits inside the "Account & league settings" disclosure of the "Site menu" dialog, which is opened first.
4. The signed-out link was renamed "Sign in and connect Yahoo" → "Sign in to check premium sync access".

| Run | UTC | America/New_York |
|---|---|---|
| 541 (both viewports), after the fixes | 2/2 | 2/2 |
| **Full spec, final (warm server)** | **18/18** (`run-6/pw-sc6f-UTC.log`) | **18/18** (`run-6/pw-sc6f-America-New_York.log`) |
| Full spec, first run (before fix 3/4) | 15/18 | 16/18 |

The first runs failed in 541 at sign-out (fixes 3 and 4). UTC also failed 271 at 1180px (line 333, injury table "Ongoing report"). That case has now failed three times, each time as the **first test after a fresh server start**, and has passed on every warm run (including both final runs). It's likely cold-compile flakiness; not changed here.

eslint (all 3 files): clean.
