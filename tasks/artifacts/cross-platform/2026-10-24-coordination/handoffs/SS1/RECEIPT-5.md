# SS1 ticket 5 receipt: C7 SS1-4 findings (F1, O1, O2, O3)

- Lane: SS1 (Claude), ticket 5, same lease. Source: `handoffs/C7/RECEIPT-SS1-4.md`, plus TJ's pop-up decision on SS1-4-O1 (relayed by the orchestrator).
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus SS1 `33b1032a…`, SS1-2 `6f6fabfe…`, SS1-3 `b6dee9e2…` and SS1-4 `0b39b560…`, all unchanged.
- Delta: **`SS1-5.patch`** `a36c1b4f37d0d32b20e4fa06633646c80caa052ab20d5cc66857bdb2c48a7476`. It touches 6 files, +137/−57; full hashes are in `HASHES-5.txt`.
  - Verified in scratch: HEAD + SS1…SS1-5 reproduces all 20 lease files byte-for-byte.
- **No change to the server, API, page or SCSS.** There is still no live read path.
- Fixtures only, no Git, no GIT_DIR. The deny log (`t5/node-network.jsonl`) holds 1 entry, npm's own `registry.npmjs.org` check.
- Codex's `player-cards` namespace and :3125 were not touched.
- **The :3110 slot is released.** 0 listeners and 0 leftover processes at 2026-10-24T18:04:57Z. TJ's :3000 was not touched.

## Fixes

| ID | Change | Tests |
| --- | --- | --- |
| **SS1-4-F1** (medium) | **Freshness is now gated per player.** A player is dropped if its own Yahoo ownership is undated or older than yesterday (New York date), or its own WGO totals are undated or older than 72 h. Future-dated rows are dropped separately. **If dropped-stale rows outnumber the players kept, the layer is `stale`**: that pattern means the source refresh failed, so nobody is ranked. Otherwise the layer stays ready and records `Excluded N stale and M future-dated player rows.` `ownershipAsOf` and `statsUpdatedAt` are now the **oldest included** values, so each as-of the card prints covers every tile. | `players.test.ts` "gates freshness per player" reproduces C7's F1 case: every row 25 days old except one fresh row → layer `stale` (`Most player rows are stale (N of M)…`), and the pickup lists are empty. A second case drops 5 old-ownership rows and 3 old-totals rows individually, keeps a row dated yesterday, and reports `ownershipAsOf = 2026-10-25`. The existing stale, missing and future cases still pass. |
| **SS1-4-O1** (TJ: separate bands) | Titles, footers, menu options and alt text now read **30–49%**, **20–29%** and **Under 20% ROSTERED**, with footer legend "Bands: 30–49% · 20–29% · under 20%". To make each label literally true, every band now has a **lower bound** (`min ≤ rostered < max`). **One behaviour change to note:** in SS1-4, when the under-20 list was full, a sub-20% player could spill onto the "under 30%" card (a 10% player appeared there). With true bands that can't happen. Each player still appears once. Tiles show `floor(rostered)`, so a 49.6% player never reads "50%" on the 30–49% card. | `players.test.ts` "uses separate … bands": band table, `min ≤ % < max` for every tile, and each list is its band's top three. e2e asserts the band titles and the legend. |
| **SS1-4-O2** | **Primary-position rule:** a player's group is that of its first playing position in Yahoo's `display_position` (Yahoo lists the primary first), else in `eligible_positions`. A C/D player listed "C,D" competes in Forwards and one listed "D,C" in Defense, and each appears once. The tile still shows every eligible position, and non-playing slots (Util, BN) are ignored. | `players.test.ts` "places each skater in one group by primary position": "C,D" → F; "D,C" (with Util) → D; no display order → first eligible; LW,RW → F; G → G; Util/BN only → excluded. |
| **SS1-4-O3** | New e2e covering "Only N qualify". A "thin" fixture keeps one goalie under 20% on a top-10 team, so the column renders **"Only 1 qualifies"**. The test checks the note text, the tile count, the alt text, the geometry and that the PNG exports. "None qualify" also renders naturally on the 20–29% goalies column. Long names keep the ellipsis on the image, and the alt text has the full name. | e2e #15 `short pickup columns say how many qualify and the card still exports`, with PNG `t5/evidence/monday-pickups-under-20-thin.png`. |

## Pinned PNGs (one fixed edition; all 7 asserted in the final run)

| Card | sha256 | Change |
| --- | --- | --- |
| Default Best schedules grid | `7f4cf9c0110514618368fcc3ce87149651bdae5fd2ca20766dce4ea359cf8462` | unchanged since ticket 1 |
| Easiest Schedules | `d91622b66fc47bc3d34f00a53dd74f159fa4c2ecc1a48e79a778216a8a11811e` | unchanged since ticket 2 |
| Streaming Matchups | `2676d8b2d5e42a02f0de6978c5d4d9fcd4b87060dec1eb3b1414ab0d76c9abef` | unchanged since ticket 2 |
| Category Specialists | `2b5cd4a38813e6e963d6453181947c56f45d995d71ffb3d02f3bd71a9650e0b1` | unchanged since ticket 4 |
| Pickups 30–49% | `17f84737929843a5c844bf596a620385c2120acb8bd5935975c404e936d1409f` | **new**; was `4579feb1…` |
| Pickups 20–29% | `46c00e2040d774a08855e4f45dad2209f5597457210c14617fccac9b6fb8c5b9` | **new**; was `1a6eb8a7…` |
| Pickups under 20% | `c50ad5f895e6e8cae65255fef764ed1afe06d429590df764637adce31fadfffd` | **new**; was `193ae6a6…` |

- Only the three pickup cards changed. The causes are the band titles and legend and, on the 20–29% card, the end of sub-20% spill-over: its goalie column is now "None qualify".
- The new anchors were identical in a separate repeat run (`t5/pinned-repeat/`).
- The tile's switch from `Math.round` to `Math.floor` didn't change any pixels, because the fixture's ownership values are whole numbers. That's why the Specialists hash is unchanged.

## Checks run

- **Vitest** `lib/socialShare/`: **55/55** (`t5/vitest.log`): players 11 (3 new or replaced), schedule 28, matchups 8, mondayGrid 6, teamRates 3.
- **Playwright** `e2e/social-share.spec.ts`: **15/15 pass**, 25.1 s (`t5/e2e-run.log`, `t5/results.json`).
  - Run in skip-server mode (`PLAYWRIGHT_SKIP_WEB_SERVER=1`) against my own `PLAYWRIGHT_ISOLATED_NEXT=1` server on :3110, under the deny preload.
  - `SOCIAL_SHARE_PINNED_GRID_SHA256`, `…_EXTRA_SHA256` and `…_PLAYER_SHA256` (new values) were all asserted.
- **CSS pure check:** PURE OK (`t5/css-pure-check.log`). The SCSS is unchanged since SS1-4.
- **ESLint:** exit 0 (`t5/eslint.log`).
- **Full `tsc --noEmit`** under `/private/tmp/fhfh-heavy.lock`: only the 2 pre-existing out-of-lease Luna errors (`t5/tsc.log`).
- **Not run:** build, any remote build, any live read.

## Still open (unchanged)

- A live player read path needs the Codex ownership contract and TJ's approval. The read plan in RECEIPT-4 stands, and F1 is now fixed for it.
- **Tunable values:**
  - top-10 teams;
  - min 5 GP / 3 GS;
  - QS% as the goalie rate;
  - ownership fresh if dated today or yesterday; totals fresh within 72 h;
  - the "most rows stale ⇒ layer stale" rule.
