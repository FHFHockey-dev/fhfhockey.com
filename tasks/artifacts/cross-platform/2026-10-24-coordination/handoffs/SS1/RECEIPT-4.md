# SS1 ticket 4 receipt: Pickups (3 tier cards) + Category Specialists card

- Lane: SS1 (Claude), ticket 4, same lease.
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus `SS1.patch` `33b1032a…`, `SS1-2.patch` `6f6fabfe…` and `SS1-3.patch` `b6dee9e2…`, all unchanged.
- Delta: **`SS1-4.patch`** `0b39b560742928027554861eb318217202246e51738ad7cba395a97d8b2fe0f1`. It touches 8 files, +534/−14; full hashes are in `HASHES-4.txt`.
  - Verified in scratch: HEAD + SS1 + SS1-2 + SS1-3 + SS1-4 reproduces all 20 lease files byte-for-byte.
- No Git writes, no GIT_DIR, fixtures only. No Supabase or NHL read was made. The deny log (`t4/node-network.jsonl`) holds 1 entry, npm's own `registry.npmjs.org` dist-tags check.
- **No server or API change in this ticket, so there is no new read path.** `server.ts` and `pages/api/v1/social-share/[format].ts` are byte-identical to their SS1-3 state.
- Codex's player-card namespace was not touched. `web/lib/player-cards/**`, `web/components/player-cards/**` and :3125 were neither read nor edited. The only "player-cards" text in SS1 files is the evidence filename `monday-player-cards-pinned.sha256`.
- **The :3110 slot is released.** Server stopped; 0 listeners at 2026-10-24T17:46:30Z. TJ's :3000 was not touched.

## What was built

Four new options in the existing **Graphic** select. The default stays the Best schedules grid. Each card is 1080 × 1080 with the shared header and footer, Download PNG and full alt text, and there is no auto-posting.

- **Pickups · under 50% / under 30% / under 20% rostered**: one card per tier, so 27 players are never crammed onto one image (`monday-pickups-under-{50,30,20}.png`).
  - Each card has three columns, FORWARDS, DEFENSE and GOALIES, with up to 3 tiles per column.
  - Each tile shows the team logo, rostered %, name, team and positions, the rate, and the team's Week Score rank, GP and off-nights.
- **Category Specialists** (`monday-specialists.png`): three columns, HITS, SHOTS ON GOAL and BLOCKS, with 3 tiles each, showing the per-game rate (HIT/GP, SOG/GP, BLK/GP).
- **Source and as-of on every card:** "Yahoo rostered % as of {date}", "NHL.com season totals updated {time}", and "Season rates, not projections".

## Ranking rule (explicit; no projection formula)

**Pickups**
- **Teams:** Week Score rank ≤ 10 with at least 1 remaining game in the selected dates, recomputed when days are toggled.
- **Per-player rate:** existing columns only.
  - Skaters: `wgo_skater_stats_totals.points_per_game`.
  - Goalies: `wgo_goalie_stats_totals.quality_starts_pct`, tie-broken by `save_pct`.
- **Order within F/D/G:** rate (descending), then team Week Score rank, then lower rostered %, then name.
- **Tiers:**
  - Lists are nested by TJ's definition: every player in "under 30%" is under 30%.
  - Each player appears **once**. Tiers fill **strictest first** (under 20, then 30, then 50), so deep-league lists keep the best low-rostered players.
  - The card says "One tier per player, strictest first".

**Specialists**
- **Pool:** skaters under 50% rostered on the same top-10 teams.
- **Rate:** per game = WGO season total (`hits`, `shots`, `blocked_shots`) ÷ `games_played`.
- **Order:** rate (descending), then Week Score rank, then lower rostered %. Top 3 per category; a player may lead more than one category.

**Eligibility, applied while building the player layer**
- The season matches.
- Yahoo `status` is empty or `DTD`; IR, O, NA, SUSP and other statuses are excluded.
- Ownership is known (latest valid `ownership_timeline` point, else `percent_ownership`, matching the existing `resolveOwnership` rule).
- The player is mapped to an NHL id through `yahoo_nhl_player_map_read`.
- Skaters need ≥ 5 GP; goalies need ≥ 3 GS.
- The WGO `current_team_abbreviation` is authoritative. A player whose Yahoo team alias disagrees with it is dropped.

**Freshness and trust**
- The layer is `ready` only if Yahoo ownership is from today or yesterday (New York date) and WGO totals are under 72 h old. Otherwise it is `stale`; future times make it `missing`, and absent sources make it `missing` with "not connected".
- Unready layer or untrusted schedule: the card says "Ranking unavailable" with the reason, shows no tiles, and Download is disabled. `assertExportable` re-checks with `{ players: true }`.
- The output holds only public fields. No Yahoo keys, timelines or notes are copied (unit-tested).

## Data contracts (read-only shapes; fixtures only)

`lib/socialShare/players.ts` types each source as a `Pick<>` of `database-generated.types.ts`:

| Source | Columns consumed |
| --- | --- |
| `yahoo_players` (ticket-2 `PickupOwnershipRow`) | player_key, player_id, editorial_team_abbreviation, eligible_positions, percent_ownership, ownership_timeline, status, season, last_updated, … |
| `yahoo_nhl_player_map_read` (view) | yahoo_player_id, nhl_player_id |
| `wgo_skater_stats_totals` | player_id, player_name, season, games_played, points_per_game, shots, hits, blocked_shots, current_team_abbreviation, updated_at |
| `wgo_goalie_stats_totals` | goalie_id, goalie_name, season_id, games_played, games_started, quality_starts_pct, save_pct, current_team_abbreviation, updated_at |

`fictionalPlayerSources()` generates 10 invented players for every team ("Fixture TEAM-n") in these shapes. It includes IR and DTD statuses, backup goalies under the starts minimum, and Yahoo team aliases.

## Live read path: deliberately NOT built (needs a Codex contract and TJ's approval)

**Why not:**
- Ownership is a coordination-required Codex contract (CLAUDE-009).
- A live path needs four reads per request, over thousands of `yahoo_players` rows unless filtered server-side.

In production today the API attaches no `players` layer, so these four cards show "Ranking unavailable · player ownership and season totals are not connected" and cannot be exported. Nothing new runs or costs anything.

**Proposed read plan, for Codex and TJ to approve, following the SS1-3 pattern:**
1. Run only after the schedule read succeeds, and only for the top-10 teams of that edition.
2. `yahoo_nhl_player_map_read` → `percent_ownership < 50`, `nhl_team_abbreviation in (top-10)`, columns `yahoo_player_id,nhl_player_id`, `limit 600` with an exact count, failing closed.
3. `yahoo_players` → `season = Y`, `player_key in (…)`, with only the ownership, position, status and team columns.
4. `wgo_skater_stats_totals` and `wgo_goalie_stats_totals` → `season`, `player_id/goalie_id in (…)`, with only the listed columns. Each read has an explicit `limit`.
5. Expose only `SharePlayer` fields. Apply the same reduced cache ceiling as the opponent layer (60 s) while the player layer is unready.

## Byte stability

The pinned-edition e2e test now exports all 7 cards on one fixed edition:

| Card | sha256 | Status |
| --- | --- | --- |
| Default Best schedules grid | `7f4cf9c0110514618368fcc3ce87149651bdae5fd2ca20766dce4ea359cf8462` | unchanged since ticket 1; asserted |
| Easiest Schedules | `d91622b66fc47bc3d34f00a53dd74f159fa4c2ecc1a48e79a778216a8a11811e` | unchanged since ticket 2; asserted |
| Streaming Matchups | `2676d8b2d5e42a02f0de6978c5d4d9fcd4b87060dec1eb3b1414ab0d76c9abef` | unchanged since ticket 2; asserted |
| Pickups under 50% | `4579feb17f26c515d80af15797ef0d680713e932b23e2015e72a5fbfb818a807` | new anchor (identical across 3 runs); asserted |
| Pickups under 30% | `1a6eb8a75c1557f4c608113f04bf3bbbc088d79683142fac98094c9154000de4` | new anchor; asserted |
| Pickups under 20% | `193ae6a64873103130789b51dd1237089c6d3c939a116f128cf2b03feb712b6c` | new anchor; asserted |
| Category Specialists | `2b5cd4a38813e6e963d6453181947c56f45d995d71ffb3d02f3bd71a9650e0b1` | new anchor; asserted |

The env vars are `SOCIAL_SHARE_PINNED_GRID_SHA256`, `…_EXTRA_SHA256` and `…_PLAYER_SHA256`.

## Checks run

- **Vitest** `lib/socialShare/`: **53/53** (`t4/vitest.log`). Of these, `players.test.ts` has 8 new tests:
  - public-only join, and exclusion of IR, small samples, unmapped players, other seasons and team mismatches;
  - stale, missing and future freshness;
  - `resolveOwnership`;
  - tier bounds, uniqueness and rate order;
  - strictest-first fill;
  - recomputation on day toggles and the untrusted gate;
  - specialist per-game math and order.
- **Playwright** `e2e/social-share.spec.ts`: **14/14 pass**, 24.4 s (`t4/e2e-run.log`, `t4/results.json`).
  - Run in skip-server mode (`PLAYWRIGHT_SKIP_WEB_SERVER=1`) against my own `PLAYWRIGHT_ISOLATED_NEXT=1` server on :3110, under the deny preload, with all 7 pinned hashes asserted.
  - The 2 new tests cover the cards (tile order equals the library's order; no overflow or footer overlap; 0 broken images; PNG 1080²) and the gates (stale and missing players and a partial schedule show "Ranking unavailable" with Download disabled; other cards stay exportable).
- **CSS pure check:** PURE OK (`t4/css-pure-check.log`).
- **ESLint:** exit 0 (`t4/eslint.log`).
- **Full `tsc --noEmit`** under `/private/tmp/fhfh-heavy.lock`: only the 2 pre-existing out-of-lease Luna errors (`t4/tsc.log`).
- **Not run:** build, any remote build, any live read.

## Judgement calls and known limits (flag to TJ)

- **Tunable values:** top-10 teams; min 5 GP / 3 GS; QS% as the goalie rate; DTD allowed; strictest-first tier fill; ownership counted fresh if dated today or yesterday.
- **Long names:** player names are single-line with an ellipsis, so a very long real name can be cut on the image. The alt text keeps the full name.
- **"Only N qualify":** this path renders when a column is short, but the fixture always fills every column, so e2e doesn't exercise it.
- **Evidence:** PNGs in `t4/evidence/` use fictional fixture names and values only.
