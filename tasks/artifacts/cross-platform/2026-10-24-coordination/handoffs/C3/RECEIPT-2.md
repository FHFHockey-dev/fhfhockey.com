# C3 ticket 2: the app's sign-out clears the cancellation key (isolated candidate)

- Lane / session: Claude C3, `local_d400a595-ead2-4f50-80a6-862b4414be6e`. Grant: **CODEX-20261024-012**, a two-file isolated cleanup exception and the only auth exception.
- No canonical write, Git action, API/RPC/schema/Stripe/entitlement change, remote call or production action. The orchestrator owns the lease file, so this receipt records the exception and does not edit `CLAUDE-LEASES.json`.
- Snapshot `/private/tmp/fhfh-c3-isolated/web`, the same one as ticket 1. The pre-edit manifest `SNAPSHOT-MANIFEST.sha256` (`e69b61c1…`) already contained both baselines with the granted hashes. Read-only baseline copies are in `/private/tmp/fhfh-c3-isolated/baseline2/`.
- Snapshot drift after ticket 2 (`evidence-2/SNAPSHOT-AFTER-2.sha256`): exactly four files changed, the two from ticket 1 and the two below.
- Ticket-1 receipt `RECEIPT.md` and patch `C3-CANCEL-RELOAD.patch` (`c500b580…`) are unchanged. This patch is separate and applies independently of it.

## Hashes

| Path | Baseline (canonical, unchanged) | Candidate |
| --- | --- | --- |
| web/lib/supabase/browser-auth.ts | 7f4cae98be09dd0c77da863264b61d1543f91654da3b58291df9bc016a2daf7a | 6c4f86fefb3219fb310513efc85aaafe3dc5b698a2fab24b78731628255ef2b0 |
| web/__tests__/contexts/AuthProviderContext.test.tsx | 7e9bb5e5f6370b1e8ffb69eca11dbcc4385fab0aa441facceb62de66758d8074 | 9173deb1c043c2e03e1a9de1dd7184dd66f8c3835f256263d3ed5def2b81aa8c |

- `C3-AUTH-SIGNOUT-CLEANUP.patch` sha256 `5ad23a504c4a1892bbd5ae33d83959afedcb4aca5d3bf60039f8ffc37aae23e4` (+33/−0). Running `patch -p1` on fresh copies of the canonical baselines reproduces both candidate hashes exactly; this was done in a temporary directory, without Git.
- `candidate-2/` holds the two post-patch files.

## Change

The patch adds one entry to `SUPABASE_STORAGE_KEY_PATTERNS`: `/^fhfh:in-season-cancellation:v1$/i`. The source line is identical to proposal `c0deaddc…`.
- The existing `clearMatchingStorage` call sites in `resetSupabaseBrowserAuthState` are unchanged: localStorage, then sessionStorage, still reached after a sign-out rejection or the 5-second timeout.
- No blanket clearing and no other auth behaviour change.

## Checks (snapshot, Node 22.11.0, no GIT_DIR)

### Unit tests
- **Reproduction:** with the baseline `browser-auth.ts`, the three new cases **failed** (3 failed, 22 passed). See `evidence-2/AUTH-REPRODUCTION-BEFORE-FIX.*`.
- **New regressions:** one `it.each` with three cases, sign-out that resolves, rejects, or never settles. The never-settling case uses fake timers: the key is still present at 4,999 ms and cleared at 5,000 ms.
  - The billing panel is absent; the probe renders only AuthProvider and UserMenu.
  - The exact key and a different-case variant are both cleared.
  - These keys are preserved: `…:v2`, `…:v1:draft`, `x-…:v1`, and an unrelated localStorage plan key.
- **Mutation checks** (`AUTH-MUTATION-CHECKS.log`): each of these fails all three cases:
  - an unanchored start;
  - an unanchored end;
  - a case-sensitive pattern;
  - a `v\d+` version wildcard.
- **Final run:** `AuthProviderContext.test.tsx` + `InSeasonPanel.test.tsx` + `InSeasonPanel.rollout.test.tsx` **77/77 passed** (25 + 45 + 7; the panel's 52 are unchanged).
- **Other consumers of `browser-auth`:** `AuthForm.test.tsx` and `pages/auth/index.test.tsx` 6/6 passed.

### Static checks
- **ESLint** on the five files: exit 0.
- **Whole-project `tsc --noEmit`:** **exit 2**, with only the two errors that were already there (`lib/sources/tweetLunaReview.test.ts:192`, `scripts/review-ifttt-luna.ts:22`). None of the errors is in the changed files.
  - It ran under `/private/tmp/fhfh-heavy.lock`, acquired with noclobber and released afterwards.

### Browser (`evidence-2/browser-ticket2`, 9/9)
- Run against the real `/account?section=in-season` page from the snapshot on 127.0.0.1:3120 with `PLAYWRIGHT_ISOLATED_NEXT=1`. Supabase and billing were served by fixtures, other hosts were aborted, and the server is stopped.
- The **app's own same-tab menu sign-out now removes the key** (`storedAfterSignOut: null`), even though the panel unmounts first. In ticket 1 this step left the entry in place.
- The same owner signing back in after that sign-out gets a **new** request ID.
- All ticket-1 controls still pass:
  - same-owner reload reuse;
  - account switch;
  - the next owner after a sign-out cannot recover the previous ID;
  - cross-tab sign-out;
  - corrupt stored state.

## Limits

- **24 hours limits restore, not deletion.** The 24-hour age limits which entries can be restored and reused. It is **not** a promise that an entry is physically deleted in every tab.
- **Cleanup only runs on actual sign-out events.** Cleanup now runs on:
  - every app sign-out through `resetSupabaseBrowserAuthState`;
  - mounted-panel `SIGNED_OUT` or null-owner events, including those from other tabs.
- **When an entry can linger:** if a tab loses its session without either of those paths (for example, auth storage removed or expired outside the app, then an anonymous reload), the entry stays in that tab. The browser run's `8-anonymous-reload` step characterises this case. It still cannot cross accounts: a foreign owner's restore discards it. It also stops being eligible after 24 hours.
- **Session storage is per tab.** Another tab's sessionStorage is cleared only by that tab's own sign-out path or its mounted panel.
- **Not done:** no real cancellation, refund, Stripe or Supabase contact, and no integration into release r1. Final independent review is still required before any integration.
