# SC-541 receipt: start-chart.spec.ts:541 "protects the private Yahoo comparison…" (2026-10-26, Claude)

**Verdict: a product regression; stopped, as the ticket requires.** Two test-side drifts were fixed along the way. Nothing committed. No product source edited. No production, network, Yahoo or DB access. No GIT_DIR. Baselines ran from `/private/tmp` git-archive copies (no files swapped in the canonical tree). The archives were deleted afterwards.

## Files changed (sha256)
| File | sha256 |
|---|---|
| web/e2e/start-chart.spec.ts | d2ce825496b91068dfee444f12cdea0025126595897177b17d044b06fb1ba6b7 |

## 1. Pre-existing? Yes
| Copy | Served from (server cwd verified) | Result |
|---|---|---|
| origin/master `bd337d97a` (git archive) | `/private/tmp/sc541-bd337d97a/web` on :3160, `PLAYWRIGHT_ISOLATED_NEXT=1`, that copy's own spec | 2/2 fail at line 578: `getByText('My Yahoo team · Today · Draft Pro')` not found. The page snapshot shows `group: My Yahoo team · Today · Premium sync`. |
| `e168c841c` (git archive) | `/private/tmp/sc541-e168c841c/web`, same setup | Same failure, same snapshot |

So this predates today's RSO commits (per-account keys, legacy migration) and the FORGE admission changes. It isn't a clock or date issue either: the failure points are identical in UTC and America/New_York.

## 2. Root cause: three layers, all from `fd58ba245` ("10-22 sync", 2026-10-22, `web/components/StarterBoardYahoo.tsx`)
That commit moved the panel from Draft Pro to premium provider-sync access but did not update the test:
1. **Copy drift (test):** the summary was renamed "My Yahoo team · Today · Draft Pro" → "… · Premium sync". **Fixed test-side.**
2. **Access-model drift (test):** the panel now gates on `useProviderSyncAccess()` (`/api/v1/account/provider-sync`, `data.access.eligible`), and "Refresh today's comparison" is `disabled={busy || !canSync}`. The test mocked only Draft Pro access, and its `**/api/**` catch-all returned `[]`, so the button stayed disabled (60 s click timeout). **Fixed test-side** by mocking provider-sync access as eligible for this test.
3. **Product regression (not fixed; report):** the same commit removed `setData(null)` from `load()`:
   - before: `setBusy(true); setError(null); setData(null);`
   - after: `setBusy(true); setError(null);`

   So when a refresh fails with **403** ("Draft Pro access is required."/access denied) or **401** ("Yahoo connection expired"), the previous refresh's **private Yahoo lineup stays on screen** under the error. The test's privacy check fails at line 603: `panel.getByText(/C: Private Center/)` expected 0, got 1, in both viewports, in UTC and America/New_York. The rest of the test (pending request aborted by sign-out, late response must not restore private data) was not reached.
   - **Exact fix for a product lane:** in `web/components/StarterBoardYahoo.tsx` `load()`, clear private data when access fails: restore `setData(null)` at the start of a refresh, or at minimum call `setData(null)` in the error path (or on 401/403 responses). I did not edit product code.

## Runs (canonical tree with the two test fixes, isolated :3160, `PLAYWRIGHT_ISOLATED_NEXT=1`, server stopped)
| Check | Result |
|---|---|
| `start-chart.spec.ts:541`, UTC | 0/2: both fail at line 603 (the regression), past the two drift fixes (`run-5/pw-541-fix.log`) |
| Same, America/New_York | 0/2: same point (`run-5/pw-541-ny.log`) |
| Full `start-chart.spec.ts`, America/New_York | 15/18. 541 ×2 (above), plus 271 at 1180px failing at line 333 (`injuryTable` "Ongoing report"). That case has now failed twice, both times as the first test on a freshly started server, and passed 5/5 on a warm rerun earlier; likely cold-start flakiness. Not investigated within this time box. |
| eslint `start-chart.spec.ts` | clean |

The spec cannot pass until the product regression is fixed. The Done criterion "passes in UTC and America/New_York" is **blocked on product code**.
