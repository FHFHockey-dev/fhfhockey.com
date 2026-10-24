# SS1 ticket 14 receipt: live tier-list support, plus ticket 13's e2e and PNGs

**TJ's live message ("Ranking unavailable… does not carry tier-list players yet") is fixed in code.** The live trim now keeps the tier-list players and their per-tier counts. **Not live-verified:** no live request was made, and TJ will refresh his own view to confirm. That needs this code running on the server TJ views; nothing was released.

- Lane: SS1 (Claude), ticket 14, same lease. Codex returned all 12 access paths (CODEX-056/-057). I did not touch AuthProviderContext + test, access.ts + test, SocialShareAccessGate + test, or the page and API auth lines.
- Base: the SS1-13 state. 6 of the 8 touched files match Codex's latest candidate pins (`latest-social-access/CANDIDATE.json`). `schedule.test.ts` is Codex's returned `29a8d4f8…`; I rebuilt it by reversing my edits and the hash matched exactly.
- Delta: **`SS1-14.patch`** `7f87b795521e0dfd1e3c8771929cca0fe52b30ad5e3e4f0fdbd55d994c084bd7`. It touches 8 files, +190/−37. Hashes are in `HASHES-14.txt`.
  - Verified in scratch: the base + SS1-14 equals all 8 working files (8/8).
- **Fixtures and mocks only; no live request.** The Node deny log (`t14/node-network.jsonl`) has 2 entries, both npm's own registry check at server start. The browser blocked every non-local host.
- No Git, no GIT_DIR. **The :3110 slot is released:** 0 listeners at 2026-10-24T22:31:38Z.

## 1. Server support (`lib/socialShare/tiers.ts`, `server.ts`, `types.ts`)

- **`trimEditionPlayers(snapshot, layer)`** replaces `trimPlayerLayer` in `server.ts`.
  - It keeps the pickup and specialist players (the unchanged `trimPlayerLayer`) **plus the rows the tier list shows in both strict and widened mode**, built from the same untrimmed player layer.
  - It records **`tierCounts: { strict: number[]; widened: number[] }`**, the full eligible count per tier.
- **Nothing new is read:** same players layer, same reads, no new tables.
  - The last-five-games read now also covers the kept tier players. Its row limit already scales with the id count (14 rows per player).
  - Per-player freshness, the stale/missing handling, the cache rules (`shareCacheControl`), `private, no-store` and read-only behaviour are unchanged.
- **Exposure rule:** only players shown on some card leave the server.
  - The new maximum is **`TRIMMED_PLAYERS_MAX = 66`**: 27 pickups + 9 specialists + 2 × 15 tier rows (`TIER_LIST_ROWS`).
  - That covers both tier modes, because the card can switch modes without refetching. The pickup trim alone stays ≤ 36.
- **Client side (`streamingTiers`):**
  - On a trimmed layer, rows are split using the server's counts, so `shown` and "+N more" equal the full-layer result. The kept players always contain each tier's shown rows as a prefix of its list order.
  - If counts are missing or don't match the tiers, the card lists nobody rather than a partial set.
  - **Stale layers:** unchanged. Nobody is kept, there are no counts, and the card shows the player-data reason.
  - **Older editions:** an edition cached before this change now says "this edition was prepared before tier-list support; refresh to load it" instead of "pending server support".

## 2. Tests

- **`schedule.test.ts`** (server-level, real handler with mocked sources):
  - **Success:** the live-shaped response keeps exactly the pickups + specialists + both tier modes' shown players, stays ≤ 66, and has no hidden player names. Strict and widened tiers (shown ids and "+N more") equal the untrimmed reference, and `tierCounts` equals the reference counts.
  - **Stale:** no players and no `tierCounts`, and the tiers list nobody.
- **`tiers.test.ts`** (+2, now 7):
  - a live-shaped trim matches the full layer for strict and widened; pickups and specialists are unchanged; there are no hidden players and the cap holds;
  - an empty tier stays empty with count 0;
  - a stale layer keeps nobody;
  - a layer with no counts, or mismatched counts, lists nobody.
- **E2E** (`e2e/social-share.spec.ts`, now **27**):
  - **#26:** after strict and widened, the test re-serves the edition through the server's own trim (`liveTrim`). Both modes then render the same rows, never "Ranking unavailable", and stay exportable.
  - **#27 (negative):** signed out shows "Sign in…"; signed in with no role shows "Social editor access is required…". In both, the studio stays hidden, the edition API is never called, and nothing is written.

## 3. Ticket 13 finished: e2e behind the real gate, and PNG pins

**Sign-in fixture**
- It works the same way as Codex's social-access browser fixture:
  - a fictional session is placed in the Supabase client's own storage key;
  - a mocked auth and role service answers on a fictional host (`http://supabase.e2e.invalid`);
  - requests are intercepted; writes are refused and recorded; every other external host is blocked.
- The real AuthProvider, SocialShareAccessGate and editionFetch run unchanged. There is no app-code flag, bypass or gate change.
- The mocked edition API requires the fictional bearer token.
- The spec refuses to run unless the Supabase host ends in `.invalid`.
- The server and the spec run with `NEXT_PUBLIC_SUPABASE_URL=http://supabase.e2e.invalid` (see `t14/run-e2e.sh`), so no real project, token or id is used.

**Why not Codex's helper:** CODEX-058's helper (`socialEditorSession.ts` + `social-share.spec-only.patch`) was not adopted.
- It hard-codes its own port, :3140, outside my lease.
- Its patch only applies to spec `83230d53…`, which ticket 14 has changed.
- The mechanism is the same, and I added its `.invalid` host safety guard.

**CSS:** CODEX-058's reviewed overflow correction was adopted exactly.
- The widened tier bar overflowed the square (scrollWidth 1177 > 1080), and the e2e caught it.
- I first fixed it myself, then replaced my fix with Codex's `css-r1/correction.patch` (`7a243a2a…`) on its exact baseline `0e9d2fca…`. The result is `07622368…`, as pinned.
- So the stylesheet now equals Codex's candidate stylesheet byte-for-byte.

**Pinned PNGs (all 22 asserted; repeated identically, `t14/run-a` vs `t14/run-b`, and in the final pinned run)**

| Set | Status |
| --- | --- |
| All 18 ticket-12 pins (Monday 7, Wednesday 7, Tuesday 4) | **unchanged**, byte-identical |
| **New:** Monday tiers / tiers-wide | `9086d77e…` / `479f4012…` (env `SOCIAL_SHARE_PINNED_TIERS_SHA256`) |
| **New:** Wednesday tiers / tiers-wide | `d8492900…` / `f7cc648a…` (added to the `SOCIAL_SHARE_PINNED_WEDNESDAY_SHA256` list) |

The full values are in `t14/pinned-env.txt` and `t14/evidence/*.sha256`. Runs before the CSS swap are kept in `t14/first-css/`. Among them, only the 4 tier PNGs differ.

## Checks run

- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **133/133** (`t14/vitest.log`).
- **Playwright (mocked)** `e2e/social-share.spec.ts`: **27/27**, 58.3 s, with all 22 pins asserted (`t14/e2e-run.log`, `t14/results.json`).
  - Run in skip-server mode on my own isolated :3110 server (`PLAYWRIGHT_ISOLATED_NEXT=1`) under the deny preload and the fictional Supabase host.
- **CSS pure check:** PURE OK (`t14/css-pure-check.log`). **ESLint** on the 7 touched TS/TSX files: exit 0.
- **Full `tsc --noEmit`** (8 GB heap, under `/private/tmp/fhfh-heavy.lock`): only the 2 pre-existing Luna errors (`t14/tsc.log`). The first attempt ran out of memory at the default heap.
- **Not run:** any live request, build or deploy.

## Not covered

- The real API handler with a real session, and a real account's role. Those are covered by Codex's handler unit tests, not this browser run.
- TJ's live view, which he confirms by refreshing.
- Codex's composition candidate `8f883c65…` predates this ticket and needs SS1-14 composed on top. Everything else, including an end-of-slice review, is the orchestrator's call.
