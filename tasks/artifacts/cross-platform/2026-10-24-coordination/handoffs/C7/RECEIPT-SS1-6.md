# C7 independent review — SS1-6 (Wednesday rest-of-week + Tuesday Trends)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no source edits, no Git, no production, no live read. I ran **one** isolated browser check on :3110 under the deny preload and stopped it afterwards. Evidence is in `r12-evidence/ss1-6/`.

**Verdict: accepted with limits.**
- The Wednesday cards recompute Thu–Sun only, through the Monday paths, with no Mon–Wed leakage.
- Every Tuesday metric is a single existing `rolling_player_game_metrics` column minus its season column. Windows and sources are printed on the cards, and adds/drops are disclosed as unsupported.
- The gates, one-idea cards and byte stability hold. No live trend path was added, and nothing touches `player-cards`.

The one limit is a new upstream schedule read for `tuesday-trends` (see SS1-6-O1).

## Pins

- **Patch:** `SS1-6.patch` `ca5bcbd1…bce7`, which matches and `git apply --check --reverse` cleanly against the working tree.
- **Lease files:** all **23** in `HASHES-6.txt` equal the canonical tree (0 mismatches).
- **New:** `trends.ts`, `trends.test.ts`, `trendsFixture.ts`.
- **Changed:** `server.ts`, `types.ts`, `schedule.ts` (+test), `export.ts`, `SocialShare.tsx`/SCSS and the spec.

## Executed

**Vitest: 68/68** (`ss1t6.json`).
- SS1's 62 = schedule 29, trends 6, players 10, matchups 8, mondayGrid 6, teamRates 3. This reproduces their 62/62.
- My 6 controls.
- **Mistake of mine (log kept as `ss1t6-run1.json`):** run 1 failed T2 because I passed an old `today` to `fictionalTrendSources`, which also aged the game rows. I now shift only the ownership timelines.

| Control | Result |
| --- | --- |
| **W1 Wednesday isolation** | `remaining-week` generated on Wed 10/28 defaults to **Thu–Sun** (10/29–11/01). There is **0** leakage: no Mon–Wed game is counted in grid cells; every row's `remainingGames` equals its count of qualifying selected-date games; and every Easiest game and Streaming night falls on a selected date. Pickup tiers build from the same rows. |
| **W2 adversarial Mon–Wed-only team** | OTT with all Thu–Sun games removed: `remainingGames` 0. The grid shows **no rank** (`rank: null`; the raw `snapshot.rows` order still lists it 32nd). It is absent from Easiest, Streaming, Pickups and Specialists. |
| **T1 Tuesday provenance** | For every hot/cold, deployment and rate pick, the delta equals **exactly** `col_last5 − col_season` on that player's latest `strength_state = "all"` row: `points_avg_*`, `toi_seconds_avg_*`, `sog_per_60_*`, `shot_attempts_per_60_*`, `ixg_per_60_*`. 0 mismatches. 0 rate picks below `toi_seconds_total_last5` ≥ 3000 s. |
| **T2 independent gates** | Stale metrics: `state` stale, `moversState` ready, so 0 hot picks and 5 Movers. Stale ownership: `moversState` stale, so 0 Movers and 5 hot picks. |
| **T3 server read scope** | `tuesday-trends` makes **1** schedule read and **0** team-rate reads, with no trend layer attached, so the cards are "not connected" in production. `player-spotlight` stays blocked, with 0 reads. |
| **T4 privacy** | The trend layer JSON has no `465.p.`, `ownership_timeline` or `player_key`. Mover keys are `name|team`. No adds/drops fields exist. |

**Column check:** all 22 columns used appear in `database-generated.types.ts` → `rolling_player_game_metrics.Row` (623 columns, 0 missing).

**Movers rule check:** `trends.ts` uses the latest point vs the point on (today − 5 d), else the latest earlier point. That is the same as `pages/api/v1/transactions/ownership-trends.ts:393-412` for ownership. One nuance: SS1 measures "today" in **New York** time, while the route uses the **UTC** date. That can shift the target by one day around midnight; it's cosmetic.

**Playwright, my own isolated run** (`run-ss1-6-pinned.sh`, `run.log`, `results.json`): **19/19 pass**.
- **All 18 pins asserted and matched:**
  - Monday grid, easiest, stream, the three pickup cards and specialists are **byte-identical** to SS1-5.
  - Wednesday (7) and Tuesday (4) reproduce SS1's new anchors.
- **External requests:** the deny log has 1 blocked `registry.npmjs.org` check.
- **Ports:** :3110 had 0 listeners before and after. Processes I don't own were listening on :3000 and :3125; I didn't touch either.

**Visual:**
- **`wednesday-best-schedules-grid.png`:** header "COVERS THU–SUN · Oct 29 – Nov 1". Mon–Wed columns are dimmed. GP counts Thu–Sun (e.g. WSH 4).
- **`tuesday-movers.png`:** rising/falling rostered-% deltas "since Oct 19" against an Oct 24 as-of. The legend says "Add/drop counts are not in FHFH's sources", and the footer says "this card shows rostered-% movers, not adds or drops".
- Both are one-idea cards with no overflow.

## Limits and observations (to SS1 / the release owner)

- **SS1-6-O1 (cost and read surface):**
  - `tuesday-trends` moved into `SCHEDULE_FORMATS`. Each request now makes one NHL schedule read, where before it made **none** (blocked).
  - It has no opponent layer, so its shared cache is capped at 60 s, and it still has no usable output until a trend layer is connected.
  - Consider keeping it blocked (no upstream read) until the live trend path is approved, or accept the extra read knowingly.
- **SS1-6-O2:** the Tuesday cards have the same shape as the earlier live-path plan. A live read (`rolling_player_game_metrics`, `players`, `yahoo_players`) still needs TJ's approval and the Codex contract, plus SS1-3-style bounds.
- **SS1-6-O3 (tunable values, flagged by SS1):**
  - a 5-game window;
  - ≥ 10 season games;
  - ≥ 50 min of last-5 TOI;
  - a 7-day activity cutoff;
  - list sizes;
  - hot/cold uses points per game only (no streak rule).
- **SS1-6-O4:** the receipt corrects RECEIPT-5's player count (11 → 10), matching my earlier note.
