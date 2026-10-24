# Boundary request (SS1 → access-gate owner): stop unmounting the studio on a same-user role re-check

**Status:** request only. SS1 edited neither file; both stay read-only for SS1. SS1-15 already works around the problem on the studio side (see RECEIPT-15 §A).

## The cause (verified in code)

1. **Supabase fires `SIGNED_IN` on every tab return.** On every `visibilitychange` back to visible, auth-js 2.89.0 runs `_onVisibilityChanged` → `_recoverAndRefresh()`. While the session is still valid, that calls `_notifyAllSubscribers('SIGNED_IN', currentSession)`; near expiry it refreshes and fires `TOKEN_REFRESHED` (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`, `_onVisibilityChanged` / `_recoverAndRefresh`).
2. **AuthProvider re-reads the role.** `web/contexts/AuthProviderContext/index.tsx` `syncUserFromSession` keeps the user's role during a same-user re-sync, but still calls `setIsRoleLoading(true)` and re-reads `users.role`.
3. **The gate unmounts the studio.** `web/components/SocialShare/SocialShareAccessGate.tsx` returns `<p role="status">Checking share studio access…</p>` whenever `isLoading || isRoleLoading`. That replaces `children` and unmounts `SocialShare`, so all of its state (week, day selection, card, loaded edition) is lost. That is TJ's "page resets after I navigate away".

The SS1-15 e2e reproduces this: it dispatches a bubbling `visibilitychange`, sees the fictional role read count go up, and the studio remounts.

## Requested change (either one; owner's choice)

- **Option 1 (gate, recommended, smallest).** While `isRoleLoading` is true for the user who is already authorized (same `user.id`, and `user.role` still `social_editor`/`admin` from the previous read), keep rendering `children` instead of the status paragraph. Optionally show a non-blocking "Re-checking access…" note.
  - A failed or revoked role read still sets `role` to null, so the gate closes as it does today.
  - A different user still remounts through the existing `<Fragment key={user.id}>`.
- **Option 2 (provider).** In `syncUserFromSession`, for a same-user re-sync where a role was already resolved, re-read the role without setting `isRoleLoading` to true. Keep the fail-closed `role: null` on error or denial.

## Properties that must stay true

- The edition API still requires the bearer and role server-side; this request changes no API code.
- A revoked or failed role lookup still closes the workspace. (This is Codex R2's "failed role lookup clears authority"; a late old-account grant still can't reopen it.)
- Account switch and logout behave exactly as today.
- Suggested regression test: same user, role re-check pending, so the studio stays mounted. Then the role is revoked, so the studio closes.
