# C7 independent review — SS1-4 (Pickups ×3 tiers + Category Specialists)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no source edits, no Git, no production, no live read. I made **one** essential browser run, because client files changed: isolated :3110 under the deny preload, stopped afterwards. Evidence is in `r9-evidence/ss1-4/`.

**Verdict: accepted with limits.**
- The ranking rules are explicit and use existing columns only, with no projection.
- Each card holds one idea, with no overflow.
- "Ranking unavailable" gates block export for missing, stale or future-dated player layers.
- There is no new live read path, and nothing touches `player-cards` or :3125.
- All earlier PNGs are byte-stable, independently reproduced.

There is one finding about the freshness semantics, which matters before a live path is connected.

## Pins

- **Patch:** `SS1-4.patch` `0b39b560…f0e1`, which matches and `git apply --check --reverse` cleanly against the working tree.
- **Lease files:** all **20** in `HASHES-4.txt` equal the canonical tree (0 mismatches).
- **Changes from SS1-3:**
  - Changed: `SocialShare.tsx`, the SCSS, `export.ts`, `types.ts`, `pickupsFixture.ts` and the e2e spec.
  - New: `players.ts` and its test.
  - `server.ts` and `pages/api/v1/social-share/[format].ts` are **byte-identical** to SS1-3.

## No new read path; namespace untouched

- **Supabase:** `players.ts` and `pickupsFixture.ts` import only `type { Database }`. There is no client, `fetch` or Supabase call.
- **Fetch:** the only `fetch` in `SocialShare.tsx` is the pre-existing `/api/v1/social-share/{format}` call.
- **API:** unchanged, so in production the player layer is absent: "not connected", export disabled.
- **`player-cards`:** no import from or edit to `web/{lib,components}/player-cards/**`.
- **Ports:** :3125 had 0 listeners before and after; my run used only :3110.

## Executed

**Vitest: 58/58** (`ss1t4.json`).
- SS1's 53: schedule 28, players 8, matchups 8, mondayGrid 6, teamRates 3. This reproduces their 53/53.
- My 5 controls.

| Control | Result |
| --- | --- |
| **G1 export gates** | With a ready layer, `assertExportable(..., {players:true})` passes and there are 3 tiers and 3 hits specialists. With **missing**, **stale ownership** (6 days), **stale totals** (4 days) or **future ownership**, export is blocked and there are **0** tiers and 0 specialists, while the schedule grid stays exportable. |
| **G2** | An untrusted schedule yields no tiers or specialists even with a ready player layer. |
| **T1 tier semantics** | Each player appears once, every tile is under its tier bound, and the "under 50%" card holds **0** players under 30% (strictest-first fill). |
| **R1** | Specialist rate = total ÷ GP exactly (0 mismatches). Player fields contain no proj/forecast/expected/xG keys, and the public JSON carries no Yahoo key, timeline or editorial fields. |
| **F1 (finding probe)** | Ownership is 25 days old for every player except **one** row dated today: the layer still reports **`ready`** (298 players). |

**Playwright, isolated :3110, my own run** (`run-ss1-4-pinned.sh`, `run.log`, `results.json`): **14/14 pass**.
- **All 7 pinned hashes asserted and matched:**
  - grid `7f4cf9c0…` (unchanged since ticket 1);
  - easiest `d91622b6…` and stream `2676d8b2…` (unchanged since ticket 2);
  - pickups 50/30/20 `4579feb1…`, `1a6eb8a7…`, `193ae6a6…`;
  - specialists `2b5cd4a3…` (SS1's new anchors, reproduced by me).
- **External requests:** the deny log has 1 denied `registry.npmjs.org` check and nothing else.
- **Ports:** :3110 had 0 listeners before and after, and 0 processes were left in the server's group. A process I don't own was listening on :3000 throughout; I didn't touch it.

**Visual check:**
- `monday-pickups-50-pinned.png` and `monday-specialists-pinned.png`: 1080², three columns of three tiles, no overflow, footer legend.
- The cards print "Season rates, not projections", "Per GP = season total ÷ games played" and "One tier per player, strictest first", plus the source as-of lines.

## Findings (to SS1)

**SS1-4-F1 (medium, must be fixed before any live connection): freshness uses the newest timestamp, not each player's.**
- `buildPlayerLayer` sets `ownershipAsOf` and `statsUpdatedAt` to the **maximum** over players and gates the whole layer on those values (`players.ts:95-104`).
- So one fresh ownership point makes weeks-old ownership for every other player count as current (my F1: 297 stale rows, layer `ready`).
- Fix: filter per player (drop or flag players whose own ownership is older than yesterday or whose totals are older than 72 h), or gate on the **minimum**. Show the oldest as-of on the card.
- This is harmless today, because no live path exists.

**SS1-4-O1 (decision for TJ): the "under 50%" card can never show anyone under 30%.**
- With strictest-first, one-tier-per-player fill, the under-50 card shows only 30–49% players. The rendered card shows 32–49%.
- That is disclosed in the footer, but TJ's spec ("three lists: under 50/30/20%") can also be read as three independent nested lists. SS1 already flags this as tunable.

**SS1-4-O2 (low): `positionGroup` puts a C/D dual-eligible skater in D only.** That is rare, but it means such a player never competes in Forwards.

**SS1-4-O3 (carried):** long names are cut with an ellipsis on the image (the alt text keeps them), and the "Only N qualify" path isn't exercised by e2e.

## Proposed live read plan (not built)

SS1's plan follows the SS1-3 pattern: read after the schedule succeeds; limit to the top-10 teams; give each read an explicit limit and fail closed; expose only `SharePlayer` fields; use a 60 s cache when unready.

It still needs, as decisions for Codex and TJ:
- the Codex ownership contract;
- TJ's approval for a production read;
- the F1 fix.
