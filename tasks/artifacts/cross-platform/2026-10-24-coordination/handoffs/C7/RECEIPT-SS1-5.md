# C7 independent review — SS1-5 (fixes for SS1-4 F1, O1, O2, O3)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no source edits, no Git, no production, no live read. I ran **one** isolated browser check on :3110 under the deny preload and stopped it afterwards. Evidence is in `r10-evidence/ss1-5/`.

**Verdict: accepted.**
- F1, O1, O2 and O3 are fixed as specified.
- Only the three pickup PNGs changed, and the other four pinned cards are byte-identical.
- There is still no live read path.

## Pins

- **Patch:** `SS1-5.patch` `a36c1b4f…7476`, which matches and `git apply --check --reverse` cleanly against the working tree.
- **Lease files:** all **20** in `HASHES-5.txt` equal the canonical tree (0 mismatches).
- **Changed from SS1-4:** `SocialShare.tsx`, `types.ts`, `players.ts`, `players.test.ts`, `pickupsFixture.ts` and the e2e spec.
- **Unchanged:** server, API, page and SCSS.

## Executed

**Vitest: 65/65** (`ss1t5.json`).
- SS1's 55 = players 10 + schedule 28 + matchups 8 + mondayGrid 6 + teamRates 3, reproducing their 55/55.
  - Nit: RECEIPT-5 lists "players 11", but the file has 10 tests; the total of 55 is correct.
- My 10 controls.

**Playwright, my own isolated run** (`run-ss1-5-pinned.sh`, `run.log`, `results.json`): **15/15 pass**.
- **All 7 pins asserted:**
  - grid `7f4cf9c0…`, easiest `d91622b6…`, stream `2676d8b2…`, specialists `2b5cd4a3…`: **unchanged**;
  - pickups 30–49% `17f84737…`, 20–29% `46c00e20…`, under 20% `c50ad5f8…`: SS1's new anchors, reproduced.
- **External requests:** the deny log has 1 blocked `registry.npmjs.org` check.
- **Ports:** :3110 had 0 listeners before and after, with 0 processes left. Processes I don't own were listening on :3000 and :3125 (the latter likely Codex's player-cards server); I didn't touch either.

| Item | C7 evidence | Result |
| --- | --- | --- |
| **F1 per-player freshness** | My SS1-4 case (every row 25 days old except one) now gives a **`stale`** layer ("Most player rows are stale (297 of 298)…"), with no tiers or specialists. Minority stale (10 old rows, 2 rows from yesterday, 2 undated rows): the layer is `ready`, every stale or undated player is **excluded** (0 included), `ownershipAsOf` is the **oldest included** (`2026-10-25`), and the reason says "Excluded 11 stale…". Code: undated → stale, future → dropped separately, as-of = oldest included. | Fixed |
| **O1 separate bands** | `PICKUP_BANDS` = 30–49% [30,50), 20–29% [20,30), Under 20% [0,20). Boundary sweep: 50 excluded; 49.99 and 30 → 30–49%; 29.99 and 20 → 20–29%; 19.99 and 0 → Under 20%; each player appears once. Tiles show `floor(%)`, so 49.99 reads "49%". The card title, menu options, alt text and footer ("Bands: 30–49% · 20–29% · under 20%") state the bands exactly; I viewed the 20–29% card: all tiles 20–29%, and goalies show "None qualify". | Fixed |
| **O2 primary position** | `positionGroup` exported and tested: "C,D" → F, "D,C" → D, "Util,D,C" → D, no display order → first eligible, G → G, Util/BN only → excluded. Every eligible position still shows on the tile. Documented in a code comment and the receipt. | Fixed |
| **O3 "Only N qualify"** | e2e #15 passes in my run. `monday-pickups-under-20-thin.png` shows the goalie column with one tile and "Only 1 qualifies", and it exports. | Fixed |
| **Only pickup PNGs changed** | Pinned before/after: only the three pickup hashes differ, and the four other cards are byte-identical. | Holds |

## Observations (not blockers; tunable values for SS1/TJ)

- **SS1-5-O1:** the layer goes `stale` only when stale rows **outnumber** the kept rows. With exactly half stale (my F1c: 149 kept, 149 excluded), the layer stays `ready` and ranks from the fresh half. The card's as-of is still honest (oldest included), but the "Excluded N stale…" reason isn't shown on the card. Consider a lower threshold, or surfacing the exclusion count.
- **SS1-5-O2:** `display_position` order is taken as Yahoo's primary-first convention. That holds for the fixtures; a real-payload fixture should confirm it once a live read is approved.
- **Still open, unchanged:** the live player read needs the Codex ownership contract and TJ's approval.
