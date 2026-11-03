# SC-541-FIX-2 receipt: non-JSON 401/403 also hides the private lineup (C7 R37 F1) (2026-10-26, Claude)

Lane SC-541-FIX. Nothing committed. No production, network, Yahoo or DB access. No GIT_DIR.

## Files (sha256)
| File | sha256 |
|---|---|
| web/components/StarterBoardYahoo.tsx | c233ef136358fd7e1bfb750b1100ef1052eb544821be47e4f2cce497854c91d1 |
| web/components/StarterBoardYahoo.test.tsx | ae7718fae140e0039a1f7707e29a3af66bab85f2050581ca8a849d209ecaa912 |

`web/e2e/start-chart.spec.ts` is unchanged in this pass.

## Fix (`StarterBoardYahoo.tsx`, `load()`)
- `denied = response.status === 401 || response.status === 403` is now set **right after `fetch` resolves, before parsing**.
- The body is parsed defensively (`await response.json().catch(() => null)`). A non-JSON error body, or an unparseable OK body, raises the generic "Unable to load Yahoo recommendations." instead of a `SyntaxError`.
- Everything else is unchanged: 401/403 clear the lineup; other failures keep it with the error; success replaces it; abort handling is the same.

## Tests (`StarterBoardYahoo.test.tsx`)
- Added C7's two cases (`it.each([401, 403])`): a denied refresh with a non-JSON body (`json()` throws `SyntaxError`). Each asserts the error shows the generic message and that no "Private Center" or "Saved evidence" remains. That's slightly stronger than C7's `toBeTruthy` alert check.
- **Fail-before:** at `8b1b17828` (product file unmodified) both new cases fail and the 10 existing pass (`run-7/sby7-before.log`).
- **Pass-after:** 12/12.

## Runs
| Suite | UTC | America/New_York |
|---|---|---|
| `components/StarterBoardYahoo.test.tsx` | 12/12 | 12/12 |
| `__tests__/pages/start-chart.test.tsx` | 73/73 | 73/73 |
| `tests/api/dashboard-endpoints.test.ts` (start-chart and dashboard API endpoints) | 7/7 | 7/7 |
| `lib/integrations/providerSyncPaywall.test.ts` (provider-sync gating, incl. the starter-board route) | 49/49 | 49/49 |
| **Total** | **141/141** (`run-7/sby7-after-UTC.log`) | **141/141** |

eslint (both files): clean. The E2E rerun was skipped as optional: `load()` changed only as specified, and `start-chart.spec.ts` was 18/18 in both zones in RECEIPT-6.
