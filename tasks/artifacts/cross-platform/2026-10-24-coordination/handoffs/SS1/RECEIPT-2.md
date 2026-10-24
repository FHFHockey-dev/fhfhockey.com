# SS1 ticket 2 receipt: Easiest Schedules + Streaming Matchups cards

- Lane: SS1 (Claude), ticket 2, same lease.
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus `SS1.patch` (`33b1032a…`, unchanged).
- Delta: **`SS1-2.patch`** (`6f6fabfe…`, sha256 in `HASHES-2.txt`), 12 files, +584/−27.
  - Verified in scratch: HEAD + SS1.patch + SS1-2.patch reproduces all 16 lease files byte-for-byte.
- No Git writes. Never GIT_DIR. Fixtures only: no Supabase or NHL reads.
  - All Node processes ran under `net-deny-log.cjs`. `t2/node-network.jsonl` holds one denied entry, npm's own `registry.npmjs.org` dist-tags check, and no production host.
- **Server: the isolated :3110 server (`PLAYWRIGHT_ISOLATED_NEXT=1`) is stopped, and the :3110 slot is released for C1.** :3000 and :3105 were never touched; both show 0 listeners.

## What was built (both cards in the priority list)

Both cards are new options in the existing **Graphic** select. The default stays the Best schedules grid. Each card is 1080 × 1080 with the grid card's header and footer, a Download PNG button and full alt text. There is no auto-posting.

1. **Easiest Schedules** (`monday-easiest-schedules.png`)
   - Shows the top 8 teams with 3 or more remaining games, ranked by Game Grid's opponent **DEF** rating, softest first.
   - Each row has the team logo and name, its Week Score rank and off-night count, and a chip for each opponent with its day and an `@` mark when away. Chip ring colours: green = soft (DEF ≤ 33), gold = average, pink-red = strong (≥ 67).
   - The row ends with GP and the DEF number with a meter.
   - Tie-breaks: more games, then Week Score rank.
2. **Streaming Matchups** (`monday-streaming-matchups.png`)
   - Shows up to 8 team-night tiles. Each tile is a top-16 Week Score team playing a soft defense (single-opponent DEF ≤ 33), off-nights first, then the softest opponent, then the better schedule.
   - It picks one night per team, so the card names 8 different teams.
   - Each tile shows the date, an OFF-NIGHT or BUSY tag with the slate size, team vs/@ opponent logos, the opponent's DEF, and the team's Week Score rank and GP.

**Rating semantics, consumed read-only:**
- DEF = 100 − percentile of the opponents' mean xGA/GP from `nst_team_stats` (situation "all"), using Game Grid's own `percentileMap` (`components/GameGrid/utils/scheduleOpportunity.ts`).
- A parity test feeds the same opponents into Game Grid's `buildOpponentRatings` and gets an identical DEF for every ranked team.
- No Game Grid file was edited.

**Trust gates:**
- Both cards render "Ranking unavailable" with the reason, show no rows, and disable export unless both the schedule edition and the opponent layer are ready.
- The opponent layer is ready only when all teams have valid current-season rows updated within 72 h. Otherwise it is `partial`, `stale` or `missing`.
- `assertExportable` re-checks the opponent layer at export time (`{ opponents: true }`). Matchup PNG filenames get a card suffix; the default card's filename is unchanged.

## New data path (built, NOT exercised: needs TJ's approval to verify live)

- `lib/socialShare/server.ts` now loads `loadCurrentSeasonStats(season)`, Game Grid's existing reader, which consumes the `components/GameGrid/utils/useOpponentMetricsData.ts` export read-only.
  - It runs in parallel with the NHL schedule read and becomes a `missing` layer on any failure, so the schedule edition never fails because of it.
  - The API exposes only `{ gp, xgf, xga }` per team. A unit test asserts that team names and other columns are not leaked.
- **Cost and authority:** each `/api/v1/social-share/{game-grid,remaining-week}` request adds one paged anon read of `nst_team_stats` (about 32 rows).
  - It never ran here. Vitest mocks the loader, and the e2e tests mock the API route.
  - A first live check needs TJ's direct approval. Codex should confirm that this read-only consumption of the Game Grid reader is acceptable.

## Default card byte-stability

- Recorded **before** any ticket-2 code change: a new pinned-edition e2e test (fixed fixture time and browser clock) exported the default grid twice on SS1 code. Both runs gave `7f4cf9c0110514618368fcc3ce87149651bdae5fd2ca20766dce4ea359cf8462` (`t2/evidence/monday-grid-pinned.sha256`).
- **After** ticket 2: the same test, with `SOCIAL_SHARE_PINNED_GRID_SHA256` set, asserts the identical hash. It passed in every run, including the final one.
- The grid's header was extracted into a shared `CardHeader` component that renders the same DOM. The matching hash proves the output is unchanged.
- Unpinned grid PNGs differ run to run only because they print the current check time. That is why the pinned test exists.

## Pickups card: fixture contract only (not built)

`lib/socialShare/pickupsFixture.ts` defines the contract:
- `PickupOwnershipRow` = `Pick<yahoo_players Row, …>`, checked against `database-generated.types.ts` with `satisfies keyof Row`. The columns are player_key, player_id, player_name, editorial_team_abbreviation, display_position, eligible_positions, position_type, percent_ownership, ownership_timeline, status, season and last_updated.
- `PICKUP_TIERS` = 50/30/20.
- The Yahoo team alias map.
- `fictionalPickupRows()`: "Fixture Player N" names, at least 3 players per F/D/G per tier (unit-tested).

Rules recorded for the build, taken from existing readers:
- Ownership is the latest valid `ownership_timeline` point, else `percent_ownership`, as in `ownership-snapshots.ts`.
- `eligible_positions` is an array of `{position}`, as in `yahooEligibilityCache.ts`.
- Yahoo aliases LA/NJ/SJ/TB/WAS/MON map to NHL abbreviations.

Note: `lib/dashboard/commandCenterData.ts` only names `yahoo_players` as a source table; the column reads live in the files above.

## Judgement calls (tunable; flag to TJ if he wants different values)

- Soft defense: DEF ≤ 33. This is Game Grid's "easier" third; strong is ≥ 67.
- Easiest card: 3+ games floor. A shorter date selection lowers the floor to the most games available.
- Streaming: top-16 Week Score teams, one night per team, 8 tiles.
- Freshness: NST stats older than 72 h are `stale`.

## Requirement table

| Requirement (ticket 2) | Status | Evidence |
| --- | --- | --- |
| Build Easiest Schedules first | Met | e2e: 8 rows in `easiestSchedules()` order, per-row opponent chips = GP, DEF text, no overflow or footer overlap, 0 broken images, PNG 1080². Unit: ranking, floor and Game Grid parity. |
| Then Streaming Matchups if it fits cleanly | Met | e2e: tiles in `streamingNights()` order, geometry, PNG. Unit: DEF ≤ 33, rank ≤ 16, unique teams, off-nights first. |
| 1080 × 1080, one idea per card, unlinked page, Download PNG, no auto-posting | Met | `downloadedPng` checks 1080 × 1080. Page and route unchanged and noindex. |
| Fixtures only | Met | Fictional schedule plus fictional NST-shaped rates (`fictionalTeamStats`). Deny-log shows no production host. |
| Default card byte-stable | Met | Pinned sha `7f4cf9c0…` before and after (asserted). |
| Pickups fixture shape from commandCenterData + generated types | Met (shape only) | `pickupsFixture.ts` plus a unit test. |
| Untrusted inputs never rank | Met | e2e: stale and missing rates and a partial schedule all show "Ranking unavailable", no rows and Download disabled, while the grid stays exportable. |
| E2E with PLAYWRIGHT_SKIP_WEB_SERVER=1 on own isolated :3110 | Met | `t2/e2e-run.log`, `t2/results.json`: **12/12 pass** (9 from SS1, plus pinned, matchup cards and unready gates). |
| CSS pure check | Met | `t2/css-pure-check.log`: PURE OK, using Next's `postcss-modules-local-by-default` `{mode:"pure"}` on the sass output (`t2/css-pure-check.cjs`). Negative control: `[data-x]` was rejected as impure. |
| Heavy tsc under `/private/tmp/fhfh-heavy.lock` | Met | `lockf /private/tmp/fhfh-heavy.lock` with a 9 GB heap; see Checks run. |

## Checks run

- Vitest `lib/socialShare/`: **38/38** (`t2/vitest.log`): schedule 24, mondayGrid 6, matchups 8.
- Playwright `e2e/social-share.spec.ts`: **12/12**, 19.2 s, skip-server mode against my own isolated :3110 server under the deny preload.
- ESLint on the touched directories, pages and spec: exit 0 (`t2/eslint.log`).
- Full `tsc --noEmit` under the heavy lock: exit 2, with only the 2 pre-existing out-of-lease Luna errors (`lib/sources/tweetLunaReview.test.ts:192`, `scripts/review-ifttt-luna.ts:22`) (`t2/tsc.log`).
  - My first tsc run also flagged my new spec line with the same Buffer/BinaryLike typing issue. I fixed it with `new Uint8Array(png)` and reran.
- Not run: `npm run build`, any remote build, any production read.

## Evidence PNGs (`t2/evidence/`; fictional fixture week and rates, not real NHL data)

- `monday-easiest-schedules.png`, `monday-streaming-matchups.png`: the new cards.
- `monday-streaming-unavailable-preview.png`: the unready state (a preview screenshot; export is disabled there).
- `monday-grid-pinned.png` + `.sha256`: the byte-stability anchor.
- The other spec outputs were regenerated.
