# SS1 ticket 13 receipt (PARTIAL): Schedule-Aware Streaming Options tier list

**Status: code and unit tests done. E2E and PNGs are blocked; the live server integration is held.** The reasons are below.

## Context

- Lane: SS1 (Claude), ticket 13, same lease. TJ's mockup is `handoffs/SS1/references/tj-streaming-tier-list-mockup.png` (`f03c024e…`).
- **TJ pop-up (this session):** tier pairs are ordered by **Week Score**, not off-nights-first or games-first.
- Base: octoberBranch @ `2a5092d37…` + SS1 … SS1-12.
- Delta: **`SS1-13.patch`** `e0a1a46c339990879c225739b24528787f8b3a3704a0b27c2a7027b2f901cfad`. It touches 5 files, +276/−6, **my files only**:
  - `tiers.ts` and `tiers.test.ts` (new);
  - `SocialShare.tsx`, `SocialShare.module.scss` and `e2e/social-share.spec.ts`.
- Verified in scratch: the SS1-12 tree + SS1-13 equals these 5 working files. `players.ts` and `types.ts` are unchanged from SS1-12.
- Fixtures only; no live request. No Git, no GIT_DIR. The :3110 slot is released (0 listeners at 2026-10-24T21:31:14Z).

## Concurrent custody found mid-ticket (not mine; untouched)

- Between 16:57 and 17:00 a **Codex social-access worker** (`CODEX-TO-CLAUDE.md`, `SOCIAL-EDITOR-CUSTODY.json`) changed SS1 lease paths reserved to it until handback:
  - the social-share page and API routes;
  - `editionFetch` and its test;
  - `schedule.test.ts` and `SocialShare.test.tsx`;
  - new access files (`access.ts`, its test, `SocialShareAccessGate.tsx`, its test).
- **I did not edit any of these.** The SS1-13 patch excludes them.
- Against `HASHES-12.txt`, those six reserved paths are the only mismatches besides my own five.

## What's built

**`lib/socialShare/tiers.ts`**
- **Pairs:** teams with games are grouped by their exact (GP, off-nights) pair. Ties share a pair. Pairs are ordered by Game Grid **Week Score** (the best team's score in the pair, per TJ's pop-up), then GP, then off-nights. Teams inside a pair are ordered by rank.
- **Top 3 tiers only.**
- **Strict** (default): one pair per tier.
- **Widen:** Tier 1 keeps the best pair alone, and Tiers 2 and 3 each fold in the next pair.
  - On TJ's Oct 26 week, Week Score order gives strict T1 = 4/3 (CGY, EDM), T2 = 4/2 (WPG), T3 = 4/1 (LAK, OTT). Week Score rates 4GP/1OFF above 3GP/2OFF by design.
  - **Widened** gives T1 = 4/3, **T2 = 4/2 + 4/1 (WPG, LAK, OTT)**, **T3 = 3/2 (TOR, NJD, PHI, WSH) + the next pair**. That is TJ's example, with LAK and OTT joining T2 "if we're widening".
- **Players:**
  - **only** under-50% players on tier teams;
  - tier order before rate (no team appears in two tiers);
  - within a tier, skaters by PTS/GP, then goalies by QS% and SV%;
  - each row shows its band (`<20%`, `20–29%`, `30–49%`) and the L5 line.
- **Row budget:** 15 rows. Each tier gets an equal share capped at its player count; leftovers go to earlier tiers; an empty tier keeps one row for its note. A tier that runs out shows **"+N more"** in its bar; text never shrinks.
- **Live guard:** the server trims the live player layer to the pickup and specialist cards' players. So on a live (trimmed) edition the tier card says "the live edition does not carry tier-list players yet" instead of listing an incomplete set.

**Card** (Graphic options "Streaming options · tier list" and "· widened tiers", Monday and Wednesday)
- **Header:** the shared header, eyebrow "{Day} · Schedule-aware tier list", title **STREAMING OPTIONS**.
- **Tier bars:** "TIER N", the team logos, the GP·OFF pair(s) and "+N more", over a stripe.
- **List rows** (not tiles), each in the player's team colors: rank, logo, name, team · positions, rostered % with its band chip, the L5 GP line on a dark chip, and the rate.
- **Footer:** what a tier is, the widen rule, sources and as-of.
- Alt text lists every tier, its teams and its rows.

**Tests**
- `tiers.test.ts` (5, all passing):
  - grouping, ties and Week Score order;
  - TJ's example week, strict and widened;
  - row allocation, including empty tiers, the leftover order and the 15-row cap;
  - no players outside tier teams, ownership under 50%, tier precedence, skaters then goalies, `shown` plus `more`;
  - an empty tier, untrusted (none), and the live-trimmed layer (none).
- **E2E #26 written but not run:** strict and widened; DOM rows equal to the library's; "+N more"; L5; geometry; PNG export.

## Blocked and held (needs a decision)

1. **E2E and PNGs are blocked.**
   - The page is now wrapped in the Codex `SocialShareAccessGate`, which needs a signed-in social-editor Supabase user, and the API requires a bearer token.
   - My isolated, network-denied e2e harness has no session. A one-test probe showed "Sign in with your FHFH social editor account to continue" (`t13/test-results/…/test-failed-1.png`).
   - **All** e2e tests are affected, not only the tier card, so the 18 pinned PNGs can't be re-verified right now either.
   - Unblocking needs either an e2e auth fixture (mocking AuthProvider or the Supabase session, both in the worker's custody) or the worker's handback with one.
2. **Live tier rows are held.** Keeping tier rows in the server trim, and giving them recent-form reads, would change assertions in the reserved `schedule.test.ts`. That waits for handback.

## Checks run

- Vitest `lib/socialShare/` + `components/SocialShare/`: **131/131** (`t13/vitest.log`). This count includes the Codex worker's new access tests.
- ESLint: exit 0. CSS pure check: PURE OK.
- Full `tsc` under the heavy lock: only the 2 pre-existing Luna errors.
- **Not run:** the e2e (blocked, see above), PNGs, any live request.

## Addendum (2026-10-24 ~17:45 EDT): option B tried, fallback to A

The orchestrator authorized B: an e2e-only auth mock in `e2e/social-share.spec.ts`, using Playwright `page.route` only, with no source bypass and no change to the gate. It also said to stop and fall back to A if the network layer alone cannot satisfy the gate.

- **Custody check:** `SOCIAL-EDITOR-CUSTODY.json` lists 8 source paths and 4 new paths. `web/e2e/social-share.spec.ts` is not among them, so it is editable.
- **Finding: the network layer alone cannot satisfy the gate.**
  - The gate reads `useAuth()`. AuthProvider takes its user only from `supabase.auth.getSession()` and `onAuthStateChange`.
  - The browser client (`lib/supabase/client.ts`) sets `persistSession: true`, `detectSessionInUrl: false` and `flowType: "pkce"`.
  - In auth-js 2.89.0, `__loadSession` reads the session from `localStorage` (`getItemAsync(storage, storageKey)`). With nothing stored it returns `{ session: null }` without any request.
  - So no `/auth/v1/*` or `/rest/v1/users` request is ever made for `page.route` to answer, and no URL callback is read either. The page always renders "Sign in with your FHFH social editor account to continue."
  - Getting past it needs browser storage seeding (`addInitScript` / `storageState`) or a rewritten HTML document. Both fall outside "network layer only" (the second is a source-side bypass in all but name), so neither was done.
- **Action taken: fallback A.** No file was changed in this addendum and there is no delta patch; SS1-13.patch (`e0a1a46c…`) stands as is.
  - The negative e2e (no role means the gate blocks) was not added. It belongs with the positive fixture.
  - E2E #26, the tier PNGs and the re-check of all 18 pins wait for the Codex handback with an e2e auth fixture.
  - A `storageState`/`addInitScript` fixture with a fake identity, plus `page.route` for `/rest/v1/users`, would work without touching the gate. It still needs explicit approval because it seeds browser storage.
- **Still deferred until the Codex handback:** keeping tier rows in the live server trim (`trimPlayerLayer` / recent read), which changes the reserved `schedule.test.ts`.
- No live request, no server started, no Git. :3110 remains free.
