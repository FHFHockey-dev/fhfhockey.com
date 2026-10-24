# SS1 ticket 8 receipt: schedule "not ready" diagnosis and live player layer (Monday/Wednesday)

- Lane: SS1 (Claude), ticket 8, same lease. TJ's words, via the orchestrator: "We should connect the necessary data…".
- TJ's direct pop-up approved the bounded live check. A second pop-up in this session approved two extra reads the endpoint makes (`nst_team_stats` and `yahoo_nhl_player_map_read`): "Proceed, include both".
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus SS1 … SS1-7 (`33b1032a…`, `6f6fabfe…`, `b6dee9e2…`, `0b39b560…`, `a36c1b4f…`, `ca5bcbd1…`, `a64adc99…`), all unchanged.
- Delta: **`SS1-8.patch`** `e230e43d9585c1ea07731beaba3027ca08d32f1ffe1eea2028f39b0804a88eee`. It touches 8 files, +252/−9; hashes for 33 files are in `HASHES-8.txt`.
  - Verified in scratch: HEAD + SS1…SS1-8 reproduces all 25 lease files byte-for-byte.
- No Git, no GIT_DIR, no writes anywhere.
- No `player-cards` import or edit; :3125 was not touched.
- **The :3110 slot is released.** 0 listeners at 2026-10-24T19:33:42Z. TJ's :3000 was not touched.

## 1. Diagnosis: why TJ's view said "the schedule edition is not ready"

**Code reading (confirmed live):**
- On a game day the edition's freshness window is **15 minutes**, and it never runs past a puck drop (`selectScheduleDates`: "soon" when a game starts within 6 h).
- On Saturday Oct 24, with afternoon and evening games, every edition expires 15 minutes after loading. The live edition generated at 19:33:24Z had `expiresAt` 19:48:24Z.
- Once expired, `trusted` is false. Every unready card then printed one hard-coded string, **"the schedule edition is not ready"**. That hid two things:
  - the real cause (expired, so refresh);
  - for Pickups, the further blocker that players weren't connected.
- The schedule feed itself is fine: the live response was `ready` with no reasons (48 games, 32 teams). UTA's id 68 resolves through `teamsInfo`.

**Fix (real bug: misleading text):** a new `scheduleReason()` names the cause in every matchup, player and trend card and in the alt text:
- `the schedule edition expired at {time}; refresh the schedule`;
- `the schedule edition is not ready ({state}: {first reason})`;
- or "the last refresh failed or a different week is loaded".

The 15-minute game-day window is a design value from SS1-1. It is listed under "values TJ may tune" and was not changed.

## 2. Live player layer (Monday and Wednesday pickups and specialists)

**New `lib/socialShare/playerSources.ts`**
- Anon `public-client`, read-only `select`s only, each with an **explicit row limit and exact count, failing closed** (`PLAYER_SOURCE_LIMITS`):
  - `yahoo_players`: `season = Y`, **`percent_ownership < 50`**, `editorial_team_abbreviation in (edition top-10, NHL and Yahoo aliases)`, 9 columns. No `ownership_timeline`, names, notes or headshots. Limit 1000.
  - `wgo_skater_stats_totals`: `season = "S"`, `current_team_abbreviation in (top-10)`, 10 columns, limit 800.
  - `wgo_goalie_stats_totals`: `season_id = S`, the same teams, 9 columns, limit 120.
  - The existing **`yahoo_nhl_player_map_read`** view: `yahoo_player_id in (…)` (both key forms), 2 columns, chunks of 150 ids, limit 2 × chunk.

**Server (`server.ts`)**
- Players are read **only after a ready schedule edition** (a failed or partial schedule means zero player reads), only for Monday and Wednesday, and only for that edition's **top-10 Week Score teams**.
- **Tuesday stays blocked with zero reads.**

**Join and freshness**
- Joined by the existing `buildPlayerLayer`, with **per-player freshness** (SS1-4-F1): ownership dated today or yesterday, totals updated within 72 h, and a majority of stale rows makes the layer stale.
- Ownership falls back to `percent_ownership` dated by `last_updated`, because timelines are not read.

**Only needed names leave the server**
- The new `trimPlayerLayer` keeps **only the players the pickup and specialist cards show** for the edition's selected dates (≤ 36; 25 in the live run) and records `selectedDates`.
- An unready layer keeps **nobody**.
- If the user toggles days, the cards say "player rows were prepared for different days; refresh the schedule for this selection".

**Cache:** the shared cache is ≤ 300 s only when opponents **and** players are ready; otherwise it is capped at 60 s. Non-ready editions stay `no-store`.

## 3. Mocked tests (no Supabase or NHL)

- `playerSources.test.ts` (3): server-side filters (season, `< 50`, teams with Yahoo aliases, no timeline or name columns), exact limits, map chunking (150 + 50), over-limit and null-count fail closed, and no read without teams.
- `schedule.test.ts` (+2):
  - **Success:** the loader is called after the schedule with exactly the top-10 teams; the layer is `ready` with the selection recorded; only the shown players are present; a hidden player's name is absent; no Yahoo key fields; `s-maxage=300`.
  - **Id-mapping miss:** a shown skater loses its map row and simply drops out.
  - **Stale:** players `[]`, no "Fixture" name in the JSON, `s-maxage=60`.
  - **Missing:** the loader throws; the schedule still serves, and the error text doesn't leak.
  - **No player reads** after a failed (503) or partial schedule.
  - The Tuesday test also asserts zero player-loader calls.
- `players.test.ts` (+1): trimming keeps card output identical; toggled days make `playersReady` false; a stale layer keeps nobody.

## 4. Bounded live check (TJ-approved)

**Setup**
- My own `PLAYWRIGHT_ISOLATED_NEXT=1` server on :3110.
- Preload `t8/live-allow-log.cjs`: the only allowed hosts were `api-web.nhle.com` and the project's Supabase host, and Supabase allowed **GET/HEAD only**. Everything else was refused; npm's registry check was denied.
- Script `t8/live-check.cjs`: a single browser pass, hard-capped at 5 social-share API calls, refusing every non-local browser request.
- One warm-up GET of the page route `/social-share/game-grid`. Its SSR makes no upstream read: the log shows no upstream entry before the API calls.

| # | Local GET | Status | Time | Edition | Cache |
| --- | --- | --- | --- | --- | --- |
| 1 | `/api/v1/social-share/game-grid?weekStart=2026-10-19` | 200 | 1339 ms | ready, 0 reasons; opponents ready (32); players **ready**, 25 shown, ownership as of 2026-10-24, totals 2026-10-24 08:20Z | `s-maxage=299` |
| 2 | same (React strict mode in dev double-mounts the page's first fetch) | 200 | 1356 ms | identical | `s-maxage=299` |

- **Stopped at the first correct render:** all five cards (pickups 30–49 / 20–29 / under 20, specialists, grid) were exportable with tiles. **2 of 5 GETs were used**, sequentially; there was no week change.

**Upstream reads per GET** (`t8/live/upstream.jsonl`; status, row range and timing only):

| Read | Rows (Content-Range) | Time |
| --- | --- | --- |
| NHL `api-web.nhle.com/v1/schedule/2026-10-19` | n/a | 132–149 ms |
| `nst_team_stats` (all situations, season) | 0-31/32 | ~191 ms |
| `yahoo_players` (season, < 50%, top-10 teams) | 0-202/203 | ~180 ms |
| `wgo_skater_stats_totals` (season, top-10 teams) | 0-222/223 | 86–180 ms |
| `wgo_goalie_stats_totals` (season, top-10 teams) | 0-22/23 | ~180 ms |
| `yahoo_nhl_player_map_read` (3 chunks) | 57 + 75 + 52 | 118–162 ms |

- **Totals:** 2 NHL schedule reads and 14 Supabase GETs. No writes or other routes. No private data was printed; the summary holds states, counts and timings only.
- **Logger quirk:** the NHL fetch lines show method "FALSE" because my logging expression fell back to a boolean. Those calls use fetch's default GET. Every Supabase line is logged as GET.

**Live PNGs** (`t8/live/`; public data only: NHL player and team names, NHL.com season rates, Yahoo's public rostered %):
- `live-current-week-pickups-{50,30,20}.png`, `live-current-week-specialists.png`, `live-current-week-grid.png`.
- The cards render correctly, including the "Only 1 qualifies" and "None qualify" notes.
- This edition is the current week on a Saturday, so each team shows 1–2 GP left. A Monday card for the coming week would use that week's edition.

## Checks run

- **Vitest** `lib/socialShare/`: **68/68** (`t8/vitest.log`).
- **Playwright (mocked)** `e2e/social-share.spec.ts`: **20/20**, 37.8 s (`t8/e2e-run.log`).
  - Run in skip-server mode (`PLAYWRIGHT_SKIP_WEB_SERVER=1`) against my own isolated :3110 server, under the deny preload.
  - **All 18 pinned hashes were asserted and are unchanged:** Monday 7, Wednesday 7, Tuesday 4. Monday and Wednesday PNGs are byte-stable.
- **CSS pure check:** PURE OK (`t8/css-pure-check.log`).
- **ESLint:** exit 0 (`t8/eslint.log`).
- **Full `tsc --noEmit`** under `/private/tmp/fhfh-heavy.lock`: only the 2 pre-existing out-of-lease Luna errors (`t8/tsc.log`).
- **Not run:** build, any remote build or deploy, any write.

## Values TJ may tune

- **Game-day edition freshness:** 15 minutes when a game starts within 6 h, and never past a puck drop (`schedule.ts`). This is what expires TJ's view.
- **Player read limits** (`PLAYER_SOURCE_LIMITS`): Yahoo 1000, skaters 800, goalies 120, map chunk 150. The live counts were 203 / 223 / 23 / 184.
- **Ownership source:** `percent_ownership` and `last_updated`. Switching to `ownership_timeline` would make the read heavier.
- All earlier values in RECEIPT-7 still apply, unchanged.

## Notes for Codex and the release owner

- This is the first live player read. It ran only on the local isolated server, under TJ's approval. **Production behaviour after a release:** each uncached Monday or Wednesday API GET makes these ~8 reads, cached up to 5 + 5 min when every layer is ready.
- `yahoo_nhl_player_map_read` keys appear in both forms, so the loader queries both. 184 map rows served 203 Yahoo rows; unmapped players simply drop out.
