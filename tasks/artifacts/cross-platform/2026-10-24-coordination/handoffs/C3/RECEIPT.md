# C3 BILLING-CANCEL-RELOAD — isolated candidate receipt

- Lane / session: Claude C3, `local_d400a595-ead2-4f50-80a6-862b4414be6e` (started by orchestrator `local_88650158-8190-40bb-b2cb-aa7bc8897a5c`)
- Transfer: CODEX-20261024-003. Isolated local candidate only. **No canonical write, Git action, server outside the snapshot, production call, Stripe/Supabase contact or spend.**
- Base: octoberBranch `2a5092d37` working tree (dirty). Snapshot `/private/tmp/fhfh-c3-isolated/web`; pre-edit manifest `evidence/SNAPSHOT-MANIFEST.sha256` (sha256 `e69b61c1d5937be616de35262556b23dc6c56b75f3bd603910080e09ae4c35d6`, 4,089 files). Post-run drift: only the two candidate files changed (`evidence/SNAPSHOT-AFTER.sha256`).
- Diary: `tasks/diaries/2026-10-24-claude-c3-billing-cancel-reload.md`

## Hashes

| Path | Baseline (canonical, unchanged) | Candidate |
| --- | --- | --- |
| web/components/account/InSeasonPanel.tsx | e5cde3349ee10bd4d8c9623e8051eb56853c4f72d50f7a9657fef257d4c70352 | 9987664256fd615d6b47cb41d019edd7c9515456e8c02808d42d741e239776ea |
| web/components/account/InSeasonPanel.test.tsx | d21fd263ef203b557c3f34030205ff9a8fd9ce32d2fa040babb93c0f6eb8b76c | 646b3379e105e0ae3777c196db148fcd9af1366faa757102ccb3ebeae4b3e535 |
| web/components/account/InSeasonPanel.rollout.test.tsx | b63510f723564a0707ed92f581f83f02a1f6db114550ff4415ab770db9d0e930 | unchanged |

- `C3-CANCEL-RELOAD.patch` sha256 `c500b580b79f2bd1ce3bc00e50630ea3ac1d47bd1985843c53121cb8a9b420ff` (2 files, +108/−5). `patch -p1` on fresh copies of the canonical baselines reproduces the candidate hashes exactly (checked in a temporary directory, no Git).
- `candidate/` holds the two post-patch files.

## Gap and fix

The accepted mounted fix keeps unresolved cancellation IDs in a React ref, so a reload loses them. The server dedupes only on `cancel:${requestId}`, so a retry after reload sends a new ID and a second cancellation claim.

The fix keeps the accepted mounted behaviour and adds per-tab `sessionStorage` (`fhfh:in-season-cancellation:v1`), using direct web storage as other repo hooks already do. It adds no new service.
- It stores `{ ownerId, requests: { [subscriptionId]: { requestId, savedAt } } }` and nothing else: no token or email.
- It restores entries only when the current session owner equals the stored `ownerId`. A foreign owner, corrupt JSON, the wrong shape, a request ID that fails the server's regex, a subscription ID that fails the route's regex, a future `savedAt`, or an age of 24 hours or more is discarded and rewritten, and never attached to the request.
- Restore happens on an auth event with a new owner, and also inside `cancel()`, which catches a missed callback.
- A mounted `SIGNED_OUT` or null-owner event clears both memory and storage. An accepted response removes that subscription's entry.
- If storage is unavailable, the panel falls back to the accepted in-memory behaviour.

## Checks (all run in the snapshot, Node 22.11.0, no GIT_DIR)

- Reproduction before the fix: the new reload test **failed** against the baseline component (two different request IDs). See `evidence/REPRODUCTION-BEFORE-FIX.*`; the other 29 tests were skipped by the filter.
- Final: `InSeasonPanel.test.tsx` + `InSeasonPanel.rollout.test.tsx` **52/52 passed** (45 + 7). That is 15 new cases: reload with no callback, with INITIAL_SESSION and with TOKEN_REFRESHED; four reload transitions that must not recover (foreign owner with and without a callback, sign-out then the same owner, anonymous reload then the same owner); six fail-safe stored states; other-subscription preservation; removal on accept; and storage unavailable. All 30 accepted tests still pass, and the rollout file is unchanged.
- Mutation checks (`evidence/MUTATION-CHECKS.log`): removing the owner check, the expiry check, the future check, request-ID validation, sign-out clearing, persistence, or removal on accept each fails between 1 and 13 tests.
- ESLint on the three files: exit 0. Whole-project `tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` (acquired with noclobber and released afterwards): **exit 2**, with only the two errors that were already there (`lib/sources/tweetLunaReview.test.ts:192`, `scripts/review-ifttt-luna.ts:22`, LUNA packet). There are no errors in the InSeasonPanel files.
- Browser (headless Chromium, real `/account?section=in-season` from the snapshot dev server on 127.0.0.1:3120 with `PLAYWRIGHT_ISOLATED_NEXT=1`): the fake Supabase host `localhost:54999` is answered by fixtures, the billing routes are intercepted before Next, every other host is aborted, and the cancel POST is aborted (lost response).
  - Baseline: the same owner gets a **different** ID after reload, which reproduces the gap.
  - Fixed: the same owner reuses the ID after reload; an account switch gets a new ID and owner A's entry is gone; the next owner after a sign-out cannot recover the previous owner's ID; a cross-tab sign-out with the panel mounted clears storage; the same owner gets a new ID after that observed sign-out; a corrupt state gets a valid new ID. All screenshots and `RESULTS.json` are in `evidence/browser-*`.

## Held boundary (request via orchestrator)

The browser run found a limit that the unit tests cannot show. The app's own sign-out (`AuthProviderContext.signOut` → `setUser(null)` → `resetSupabaseBrowserAuthState`) unmounts the panel before `SIGNED_OUT` reaches it. An anonymous reload also never mounts the panel. In both cases the last owner's entry stays in that tab's sessionStorage, for at most 24 hours and only in that tab.
- It **cannot cross accounts**: the next owner's restore discards it, as screenshot 5 and the unit tests show.
- But if the **same** owner signs back in within that window, that owner's own unresolved ID is reused.

The existing lifecycle mechanism for this is `lib/supabase/browser-auth.ts`, whose sign-out already clears listed keys from sessionStorage. `PROPOSED-BOUNDARY-browser-auth.patch` (sha256 `c0deaddc7e9421a13c3b944c37c54e1a4fb421d93452d1275eacac2538e40002`, base file sha256 `7f4cae98be09dd0c77da863264b61d1543f91654da3b58291df9bc016a2daf7a`) adds one pattern so that every app sign-out clears this key. It is **unapplied and untested**, because the file is shared auth code outside this transfer. The decision belongs to the parent.

## Not done / limits

- No real cancellation or refund, no Stripe and no Supabase contact. The server-side duplicate behaviour was inferred from source (`monthlyWebhook.ts:122`, `monthlyLifecycle.ts:213`) and not executed.
- The second serial scope (refund consumer, private-safe errors) was not started. The aborted fetch shows the browser's raw "Failed to fetch". That message predates this change and was left alone.
- The patch is not integrated into the frozen release r1. Parent/independent review is needed before any integration.
