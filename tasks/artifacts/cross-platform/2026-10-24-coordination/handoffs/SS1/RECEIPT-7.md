# SS1 ticket 7 receipt: SS1-6-O1, Tuesday trends makes zero upstream reads

- Lane: SS1 (Claude), ticket 7, same lease. Source: `handoffs/C7/RECEIPT-SS1-6.md` (SS1-6-O1), via the orchestrator.
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus SS1 `33b1032a…`, SS1-2 `6f6fabfe…`, SS1-3 `b6dee9e2…`, SS1-4 `0b39b560…`, SS1-5 `a36c1b4f…` and SS1-6 `ca5bcbd1…`, all unchanged.
- Delta: **`SS1-7.patch`** `a64adc998fa2686a14956008efdcca03055009de218b71ee704e9b19a5052fe3`. It touches 6 files, +64/−18; hashes for 30 files are in `HASHES-7.txt`.
  - Verified in scratch: HEAD + SS1…SS1-7 reproduces all 23 lease files byte-for-byte.
- Fixtures only, no Git, no GIT_DIR. The deny log (`t7/node-network.jsonl`) holds 1 entry, npm's own `registry.npmjs.org` check.
- No `player-cards` import or edit; :3125 was not touched.
- **The :3110 slot is released.** 0 listeners and 0 leftover processes at 2026-10-24T19:16:39Z. TJ's :3000 was not touched.

## Fix (SS1-6-O1)

**Server**
- A new server-only allowlist, `UPSTREAM_READ_FORMATS = ["game-grid", "remaining-week"]`, decides which formats may read upstream.
- `/api/v1/social-share/tuesday-trends` now returns a **blocked edition with no NHL schedule read and no Supabase read**, built by the pure `buildBlockedSnapshot()`:
  - `state: "blocked"`, `expiresAt: null`;
  - `source: { fetchedAt: null, state: "blocked", reasons: ["No upstream read is made until a live trend source is approved."] }`;
  - `reasons: ["Rolling game metrics and ownership are not connected."]`.
- The format and season-window checks still run first, so a bad week still returns 400 with no read.
- The response is `no-store`, since `shareCacheControl` never caches a non-ready edition.

**Client**
- When an edition has no trend layer, the Tuesday cards now report "rolling game metrics and ownership are not connected", not "schedule edition is not ready".
- Download stays disabled.

**Fixture rendering unchanged**
- `SCHEDULE_FORMATS` (the client and schedule semantics) still includes `tuesday-trends`, so the e2e fixture editions render and export exactly as in SS1-6. All four Tuesday pinned hashes are identical.
- `player-spotlight` and `category-rescue` use the same blocked helper, with their original reason text.

## Tests

- **Unit** (`schedule.test.ts`, replacing SS1-6's "serves Tuesday trends as a schedule edition…" test): "keeps Tuesday trends blocked with zero upstream reads until a live trend source is approved".
  - Three queries are covered: with a week, without a week (default), and with `selectedDates`.
  - Each returns 200 with the blocked state and reasons, no trends or opponents, and `Cache-Control: no-store`.
  - **`getSchedule` and `loadShareTeamRates` are never called.** An out-of-season week returns 400, also with zero calls.
- **E2E #20** "live Tuesday answer is an honest not-connected edition with Download disabled".
  - The API mock replays **exactly** what the real server returns: `buildBlockedSnapshot` with the shared `TUESDAY_NOT_CONNECTED` reasons.
  - The page status reads "Schedule blocked: Rolling game metrics and ownership are not connected.", and all four cards say "Ranking unavailable · … not connected" with no rows and Download disabled.
  - Preview: `t7/evidence/tuesday-live-not-connected-preview.png`.

## Checks run

- **Vitest** `lib/socialShare/`: **62/62** (`t7/vitest.log`).
- **Playwright** `e2e/social-share.spec.ts`: **20/20 pass**, 36.9 s (`t7/e2e-run.log`, `t7/results.json`).
  - Run in skip-server mode (`PLAYWRIGHT_SKIP_WEB_SERVER=1`) against my own `PLAYWRIGHT_ISOLATED_NEXT=1` server on :3110, under the deny preload.
  - **All 18 pinned hashes were asserted and are unchanged:**
    - Monday 7: `7f4cf9c0…`, `d91622b6…`, `2676d8b2…`, `17f84737…`, `46c00e20…`, `c50ad5f8…`, `2b5cd4a3…`;
    - Wednesday 7: `945f1f52…`, `0fa121a1…`, `65ccb4e0…`, `ffa10504…`, `71633a33…`, `e79aa2ad…`, `11067d9e…`;
    - Tuesday 4: `b0643347…`, `ebff332a…`, `ebe8b5b9…`, `e3ac6f2e…`.
  - The hashes are in `t7/evidence/*.sha256`.
- **CSS pure check:** PURE OK; the SCSS is unchanged (`t7/css-pure-check.log`).
- **ESLint:** exit 0 (`t7/eslint.log`).
- **Full `tsc --noEmit`** under `/private/tmp/fhfh-heavy.lock`: only the 2 pre-existing out-of-lease Luna errors (`t7/tsc.log`).
- **Not run:** build, any remote build, any live read.

## Values TJ may tune (SS1-6-O3; left as they are)

**Tuesday Trends (`lib/socialShare/trends.ts`)**

| Value | Current | Constant |
| --- | --- | --- |
| Trend window | last 5 games played vs season to date | `TREND_WINDOW_GAMES = 5` |
| Ownership-mover window | 5 days (the ownership-trends rule) | `MOVER_WINDOW_DAYS = 5` |
| Season sample | ≥ 10 season games | `MIN_TREND_SEASON_GAMES = 10` |
| Per-60 sample | ≥ 50 min of last-5 TOI | `MIN_RATE_TOI_SECONDS_LAST5 = 3000` |
| Activity cutoff | latest game within 7 days | `TREND_MAX_GAME_AGE_DAYS = 7` |
| List sizes | 5 hot/cold, 4 TOI up/down, 3 per rate, 5 risers/fallers | `TREND_LIST`, `DEPLOYMENT_LIST`, `RATE_LIST` |
| Hot/cold metric | points per game only (no per-game streak rule) | `hotCold()` |
| Rolling freshness | ≤ 72 h per row; majority stale ⇒ layer stale | `PLAYER_STATS_MAX_AGE_MS` |

**Earlier editions**

| Value | Current | Where |
| --- | --- | --- |
| Pickup and specialist teams | top-10 Week Score | `players.ts` `PLAYER_TEAM_RANK_MAX` |
| Rate samples | ≥ 5 GP (skaters), ≥ 3 GS (goalies) | `MIN_SKATER_GAMES`, `MIN_GOALIE_STARTS` |
| Goalie rate | quality-start %, then save % | `pickupOrder` |
| Ownership freshness | today or yesterday (New York), per player | `buildPlayerLayer` |
| Soft defense / strong | DEF ≤ 33 / ≥ 67 | `matchups.ts` `SOFT_DEFENSE_MAX` |
| Easiest floor; streaming pool | 3+ games; top-16 Week Score teams, one night per team | `easiestSchedules`, `STREAM_TEAM_RANK_MAX` |
| Opponent stats freshness | 72 h | `OPPONENT_STATS_MAX_AGE_MS` |
| Shared cache | ≤ 300 s + ≤ 300 s stale, kept ≥ 600 s clear of expiry; 60 s while opponents are unready | `server.ts` `SHARE_CACHE_*` |

## Still open (unchanged)

Live player and trend read paths need TJ's approval and the Codex ownership contract. The SS1-3 safeguards and the RECEIPT-4/6 read plans stand.
