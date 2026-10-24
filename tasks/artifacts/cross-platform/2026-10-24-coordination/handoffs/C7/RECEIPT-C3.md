# C7 independent review — C3 BILLING-CANCEL-RELOAD and AUTH-SIGNOUT-CLEANUP

**Reviewer:** Claude C7 lane session (not the author). Read-only: I didn't touch the C3 snapshot or canonical source, made no Git writes, ran no server, made no Stripe or Supabase call and spent nothing. Evidence is in `r4-evidence/c3/`.

**Verdict: accepted with limits**, for both patches together. Taken alone, `C3-CANCEL-RELOAD` leaves the app's own sign-out path uncleaned; `C3-AUTH-SIGNOUT-CLEANUP` closes that.

## Pins

- **Patch hashes:** `C3-CANCEL-RELOAD.patch` `c500b580…20ff` and `C3-AUTH-SIGNOUT-CLEANUP.patch` `5ad23a50…23e4` match the orchestrator's values and `SHA256SUMS`.
- **Baselines:** I took them from my own rsync of the canonical working tree. They match the receipts:
  - `InSeasonPanel.tsx` `e5cde334…`
  - `.test.tsx` `d21fd263…`
  - `.rollout.test.tsx` `b63510f7…`
  - `browser-auth.ts` `7f4cae98…`
  - `AuthProviderContext.test.tsx` `7e9bb5e5…`
- **After applying both patches (`git apply`):** `9987664…`, `646b3379…`, `6c4f86fe…` and `9173deb1…`. All four are **byte-identical** to `/private/tmp/fhfh-c3-isolated/web`, which I read without changing.

## Executed (vitest jsdom, scratch config and cache, offline guard)

**Base:**
- 65 tests: **6 of my 7 controls fail**, as expected:
  - X1: two subscriptions get new IDs after reload.
  - X2: a 503 retry gets a new ID.
  - X3: there's no storage hygiene because there's no storage.
  - X5: nothing is persisted.
  - X6 ×2: `resetSupabaseBrowserAuthState` leaves the key in place.
- The base owner tests all pass.

**Both patches applied: 84/84 pass.**
- My controls: 7.
- `AuthProviderContext`: 25.
- `InSeasonPanel`: 45.
- Rollout: 7.

This reproduces C3's 77 (25 + 45 + 7).

## What holds

- **Owner isolation:**
  - Restore requires `stored.ownerId === session.user.id`.
  - A foreign owner's entry is discarded and the key rewritten (owner tests, my X3).
  - Nothing is written before the first cancel. Storage never holds a token or email (X5).
- **Subscription isolation (X1):**
  - Two subscriptions with lost responses each reuse their **own** ID after reload.
  - Accepting one removes only that subscription's entry; the other is kept.
  - Hostile keys (`__proto__`, `constructor`, `sub_a/../x`) are dropped, nothing is polluted and they are never sent (X3).
- **Lost-response reuse:** the same owner after a reload, with or without an auth callback, sends the same ID (owner tests, X1).
- **Reuse after a definite failure (X2):** a 503 also reuses the ID after reload. This is safe by server design:
  - `cancelMonthlyBilling` claims `cancel:${requestId}`.
  - `claim_in_season_sandbox_monthly` returns `duplicate` only when an event row exists, i.e. after commit.
  - An in-flight lease raises "busy".
  - **Caveat:** I read this from the draft SQL `tasks/artifacts/in-season-billing-2026-10-21/drafts/20261021210000_in_season_sandbox_billing.sql`. The migration file is deleted in the working tree (`D supabase/migrations/…`), and none of this was executed.
- **Sign-out with the panel unmounted (X6, real `resetSupabaseBrowserAuthState`, sign-out resolved and rejected):**
  - The exact key is cleared from both sessionStorage and localStorage, case-insensitively.
  - `…:v1:old` and `…:v10` are preserved.
  - The owner's timeout case and mutation checks cover the anchors.
- **Corrupt and expired state:** the owner's six fail-safe cases pass in my run (corrupt JSON, foreign owner, expired, future, malformed ID, wrong shape).

## Findings and limits (for C3 or the owner)

- **C3-O1 (low, hardening):** the request-ID check `/^[a-f0-9-]{36}$/` accepts non-UUIDs. A stored 36-dash string is restored and **sent** (X4). The server route uses the same regex, so it would accept it as a claim key.
  - It can only come from the same owner's own tab storage, so the impact is minimal.
  - Suggested fix, on both sides: a strict UUID shape such as `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.
- **C3-O2 (evidence quality):** most of the browser "state" screenshots are byte-identical files. `9cf9ad3e…` covers 12 PNGs, including lost-response, after-reload, after-switch and corrupt-state, and `2f1f742d…` covers 5 more. The screenshots therefore don't distinguish states. The browser claims rest on `RESULTS.json` alone. I didn't re-run the browser (no server allowed in this ticket).
- **Lingering entries (as disclosed by C3):**
  - An entry survives in a tab whose session ends without an app sign-out or a mounted-panel event, for example external expiry followed by an anonymous reload.
  - It can't cross accounts, and it's restore-ineligible after 24 hours.
  - A "duplicate tab" also copies sessionStorage. Both tabs then reuse the same ID, which the server dedupes.
- **Not done:** no real cancellation, refund, Stripe or Supabase call. The refund consumer and private-safe errors are still outstanding. `browser-auth.ts` is shared auth under exception CODEX-20261024-012, and integration needs the release owner.
