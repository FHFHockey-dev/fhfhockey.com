# SS1 ticket 6 receipt: Wednesday edition (rest of week) + Tuesday Trends

- Lane: SS1 (Claude), ticket 6, same lease. TJ approved both editions on fixtures (relayed by the orchestrator).
- The ticket was paused once on a usage limit. On resume, the 8 changed lease files were re-checked against `HASHES-5.txt`: the only differences were this ticket's own edits, confirmed by rebuilding the delta from the SS1-5 baseline.
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus SS1 `33b1032a…`, SS1-2 `6f6fabfe…`, SS1-3 `b6dee9e2…`, SS1-4 `0b39b560…` and SS1-5 `a36c1b4f…`, all unchanged.
- Delta: **`SS1-6.patch`** `ca5bcbd1a03fde913506131d74d7ce67b9e441f6e1cf8a26743c33fe8bc4bce7`. It touches 11 files, +658/−30; full hashes for 29 files are in `HASHES-6.txt`.
  - Verified in scratch: HEAD + SS1…SS1-6 reproduces all 23 lease files byte-for-byte.
- Fixtures only, no Git, no GIT_DIR. The deny log (`t6/node-network.jsonl`) holds 1 entry, npm's own `registry.npmjs.org` check.
- No `player-cards` import or edit; :3125 was not touched.
- **The :3110 slot is released.** 0 listeners and 0 leftover processes at 2026-10-24T18:54:51Z. TJ's :3000 was not touched.

## 1. Wednesday edition (`remaining-week`)

Monday's code paths are reused; nothing is forked. Every card already computes from `snapshot.selectedDates`, and the Wednesday default selection is Thursday–Sunday.

- **Default card:** the Best schedules grid, with Mon–Wed dimmed and every rank, GP and off-night count recomputed for Thu–Sun. The extras are the same as Monday's: Easiest Schedules, Streaming Matchups, Pickups in the 30–49%, 20–29% and under-20% bands, Specialists, and the leaders and team-focus cards.
- **Covered dates on every card:** when the selection is not the full week, the shared header shows `COVERS THU–SUN` and the date range instead of "WEEK OF". It also carries `data-covered` with the exact dates. Non-contiguous selections list the days ("Mon, Wed, Fri").
  - The full-week header DOM is unchanged, so Monday cards are byte-identical.
  - The same rule makes a Monday card honest if a user switches days off.
- **Edition-aware text:** eyebrows read "Wednesday · Rest of week / Softest opponents / Soft defenses / Pickups on top-10 schedules / Under 50% rostered", and the grid alt text says "Wednesday streamer grid, covering Thu–Sun".
- **No server change for Wednesday.** It uses the existing SS1-3 read path: schedule first, then team rates; cached only when ready; season-window 400. The player layer is still not connected live.

## 2. Tuesday Trends (`tuesday-trends`)

Four one-idea cards. **Hot & Cold** is the default; the extras are **Deployment Changes**, **Rate Standouts** and **Ownership Movers**.

| Card | Metric (existing columns only) | Window | Ranking |
| --- | --- | --- | --- |
| Hot & Cold | `rolling_player_game_metrics.points_avg_last5` vs `points_avg_season` | last 5 games played vs season to date | 5 largest positive and 5 largest negative gaps |
| Deployment Changes | `toi_seconds_avg_last5` vs `toi_seconds_avg_season`; badges show `line_combo_slot`/`line_combo_group` and `pp_unit` (latest game vs 5 games earlier) and `pp_share_pct_season → pp_share_pct_last5` | last 5 vs season; line and PP unit vs the row 5 games earlier | 4 up and 4 down by TOI/GP change |
| Rate Standouts | `sog_per_60_*`, `shot_attempts_per_60_*` (iCF/60), `ixg_per_60_*`, last 5 vs season | last 5 vs season, with ≥ 50 min of last-5 TOI (`toi_seconds_total_last5`) | top 3 gains per rate |
| Ownership Movers | `yahoo_players.ownership_timeline` | latest point vs the point on, or the latest one before, the date 5 days earlier: **the same rule as `pages/api/v1/transactions/ownership-trends.ts`** | 5 risers and 5 fallers by rostered-% change |

**Shared rules**
- Rolling rows use `strength_state = "all"` (the codebase convention), the current season, and the latest row per skater.
- Eligibility: skaters only, with ≥ 10 season games, and a latest game within the last 7 days. Inactive skaters are excluded and counted in the reasons.
- Names come from `players.fullName/position`. Teams come from the row's `team_id`.
- "GP this week" comes from the schedule edition.
- No formula is invented: each value is one existing column minus its own season column.

**Adds/drops:** FHFH's sources have no Yahoo add/drop transaction counts. The Movers card says so in its legend, footer and alt text ("this card shows rostered-% movers, not adds or drops").

**Freshness** follows the SS1-4-F1 lesson and is gated per player:
- Rolling rows updated more than 72 h ago are stale, and a majority of stale rows makes the layer `stale`.
- Ownership is fresh only if dated today or yesterday (New York), again with a majority-stale rule.
- **Metrics and movers are gated separately**, so stale ownership never blocks the stats cards, and stale metrics never block Movers.
- Footers show the source, "through {oldest latest game}", "updated {oldest row}" or "as of {oldest ownership date}", and "Observed rates, not projections".

**Privacy:** movers are keyed by public name and team, so no Yahoo key or timeline leaves the layer (unit-tested).

**Server:** `tuesday-trends` is now in `SCHEDULE_FORMATS`.
- It reads the NHL schedule through the existing SS1-3 path, which is cached only when ready and returns 400 for out-of-season weeks.
- It makes **no** team-rate read (`OPPONENT_RATE_FORMATS` excludes it), and it attaches **no** trend layer.
- In production the four cards therefore show "Ranking unavailable · rolling game metrics and ownership are not connected", and export is disabled.
- **A live trend read path is not built.** It would need TJ's approval and the Codex ownership contract. It would read `rolling_player_game_metrics` (strength all, the current season, the latest rows only, with an explicit limit), `players` (id, name, position) and `yahoo_players` timelines, after the schedule succeeds, using the SS1-3 safeguards.
- `player-spotlight` and `category-rescue` stay source-gated.

## Pinned PNGs (fixed edition; all 18 asserted in the final run)

| Edition | Card | sha256 |
| --- | --- | --- |
| Monday | grid / easiest / stream | `7f4cf9c0…`, `d91622b6…`, `2676d8b2…` (**unchanged**) |
| Monday | pickups 30–49 / 20–29 / under 20, specialists | `17f84737…`, `46c00e20…`, `c50ad5f8…`, `2b5cd4a3…` (**unchanged**) |
| Wednesday | grid | `945f1f52855f6f60…` |
| Wednesday | easiest / stream | `0fa121a1e8d9a25d…`, `65ccb4e0f27fd017…` |
| Wednesday | pickups 30–49 / 20–29 / under 20 | `ffa1050479204488…`, `71633a339e7ede96…`, `e79aa2ad0bc49447…` |
| Wednesday | specialists | `11067d9ead535054…` |
| Tuesday | hot / deployment / rates / movers | `b06433475f192837…`, `ebff332a9e0819e8…`, `ebe8b5b93bfe3441…`, `e3ac6f2ee7c39ae2…` |

- Full Wednesday and Tuesday values are in `t6/evidence/{wednesday,tuesday}-cards-pinned.sha256` and `t6/pinned-env.txt`.
- The new anchors were identical in a separate repeat run (`t6/pinned-repeat/`).
- The asserting env vars are `SOCIAL_SHARE_PINNED_{GRID,EXTRA,PLAYER,WEDNESDAY,TUESDAY}_SHA256`; `t6/run-e2e.sh` sets the Monday ones.

## Checks run

- **Vitest** `lib/socialShare/`: **62/62** (`t6/vitest.log`).
  - Breakdown: schedule 29 (+1: Tuesday is served as a schedule edition with no team-rate read), trends 6 (new), players 10, matchups 8, mondayGrid 6, teamRates 3.
  - Correction to RECEIPT-5: its players count should have read 10, not 11; its total of 55 was right.
- **Playwright** `e2e/social-share.spec.ts`: **19/19 pass**, 35.4 s (`t6/e2e-run.log`, `t6/results.json`).
  - Run in skip-server mode (`PLAYWRIGHT_SKIP_WEB_SERVER=1`) against my own `PLAYWRIGHT_ISOLATED_NEXT=1` server on :3110, under the deny preload.
  - **New:**
    - #16 pinned Wednesday and Tuesday;
    - #17 Wednesday: default grid, `COVERS THU–SUN` and `data-covered`, and every card's order equal to the library's Thu–Sun result, with PNGs;
    - #18 Tuesday: all four cards' order equals the library's, with legends, sources, geometry and PNGs;
    - #19 Tuesday gates: stale metrics → "Ranking unavailable" with Download disabled on 3 cards while Movers stays exportable; missing → "not connected".
  - Test 7 now gates only `player-spotlight` and `category-rescue`.
- **CSS pure check:** PURE OK (`t6/css-pure-check.log`).
- **ESLint:** exit 0 (`t6/eslint.log`).
- **Full `tsc --noEmit`** under `/private/tmp/fhfh-heavy.lock`: only the 2 pre-existing out-of-lease Luna errors (`t6/tsc.log`).
- **Not run:** build, any remote build, any live read.

## Evidence (`t6/evidence/`; fictional fixtures only)

- `wednesday-best-schedules-grid.png` and `wednesday-{easiest,stream,pickups-50,specialists}.png`.
- `tuesday-{hot,deployment,rates,movers}.png` and `tuesday-movers-unavailable-preview.png`.
- The pinned PNGs and the regenerated Monday evidence.

## Judgement calls (tunable; flag to TJ)

- Trend window of 5 games; ≥ 10 season games; ≥ 50 min of last-5 TOI for per-60 rates; 7-day activity cutoff.
- List sizes: 5 hot/cold, 4 up/down, 3 per rate, 5 risers/fallers.
- Hot/cold uses points per game only. A per-game streak sequence (the `lib/trends/utils.ts` run rule) would need per-game rows, so it was not used.
- The Tuesday cache ceiling: Tuesday has no opponent layer, so the existing SS1-3 rule caps its shared cache at 60 s.
