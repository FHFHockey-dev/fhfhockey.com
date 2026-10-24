# SS1 ticket 10 receipt: card flair and enhancements (TJ, direct request)

- Lane: SS1 (Claude). TJ asked directly in this session, with a reference image (the Anaheim Ducks banner: team-color band over sporty stripes, logo overlapping).
- TJ answered one pop-up: **"Widen the team pool"** for filling short pickup lists.
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus SS1 … SS1-9, all unchanged.
- Delta: **`SS1-10.patch`** `afe52ca0ce5c3c0608d6f732b4dcd27615fdae0d437fcdcb109dea73fcab91b2`. It touches 17 files, +548/−120; hashes for 38 files are in `HASHES-10.txt`.
  - Verified in scratch: HEAD + SS1…SS1-10 reproduces all 30 lease files byte-for-byte.
- Fixtures only; **no live request in this ticket.** The deny log (`t10/node-network.jsonl`) holds only npm's own registry check.
- No Git, no GIT_DIR. Codex's player-cards namespace and :3125 were not touched.
- **The :3110 slot is released.** 0 listeners at 2026-10-24T20:15:27Z.

## TJ's question: are we surveying only my league's free agents?

**No.** `lib/socialShare/playerSources.ts` reads `yahoo_players.percent_ownership`, which is **Yahoo's global rostered % across all Yahoo leagues**. Its only filters are season, `< 50`, and teams. There is no league, roster, session or waiver-wire filter anywhere in `lib/socialShare`. This ticket also widens the team filter to **every team with games**, so the fill rule can reach beyond the top 10.

## Changes, request by request

| TJ asked | Built |
| --- | --- |
| Player cards: team logo in place, team-color sporty stripes (`teamsInfo`), **player name as the header**, rostered % in the header | New `components/SocialShare/TeamBanner.tsx`.<br>**Band:** the team's primary color, or the secondary when the primary is near-black (BOS, PIT, NJD, LAK, UTA).<br>**Stripes:** dark, light, mid (secondary or accent) and dark, from that team's own `teamsInfo` colors.<br>**Logo:** overlaps the stripes, with a drop shadow; text color chosen for contrast.<br>**Pickup and Specialist tiles:** the banner holds the player name, team, positions, and rostered % on the right. |
| Highlight each player's **last 5 GP** to justify the pick | An "L5 GP" line on every tile, focused on the card's idea:<br>**Pickups (skaters):** `G A P · SOG · PPP · TOI`.<br>**Goalies:** `W-L · SV% · GA · QS`.<br>**Specialists:** hits, blocks or SOG focus.<br>Sources: `rolling_player_game_metrics` (strength all; latest row's `*_total_last5` / `*_avg_last5`) and per-game `wgo_goalie_stats` (sum of the 5 latest games played; SV% = saves ÷ shots). A window older than 14 days shows "No game in the last two weeks". |
| **Fill 3 per window and category** even when fewer qualify | **Wider pool (TJ's pop-up choice):**<br>- The band stays literally true.<br>- Top-10 Week Score teams come first, by the existing rate.<br>- A short list fills from teams ranked 11+, best schedule first, then the same rate.<br>- Fill tiles carry a **WIDER POOL** tag and the legend explains it.<br>- "Only N qualify" now appears only when no team has enough players. |
| Survey **all** players, not my league's waiver wire | Already global (see above). The server now reads every team with games, with the limits raised to Yahoo 2000, skaters 1500 and goalies 200 (all still fail closed). |
| BEST SCHEDULES: add the weekScore value | The last column is now **SCORE** (the Week Score) with `GP · OFF` beneath it. |
| …green / yellow / white / orange / red by Week Score rank | Five tiers by competition rank (tied scores share a tier), shown as a left rail and the score color. The legend shows the scale from best to worst. |
| Off-nights: highlighted column, not per-cell green borders | The per-cell off-night borders are removed. The whole off-night column, including game cells, is tinted, and the header stays highlighted. |
| Give the Streaming Matchups (cherry-picked) games a gentle border to tie the images together | A gentle gold border on grid cells that appear on the Streaming Matchups card (`data-cherry`), matching the Streaming tiles' border. The legend reads "Streaming pick". |
| Easiest Schedules: logo + stylized stripes | The team cell is a small striped `TeamBanner` with the team name and its Week Score rank. |
| Streaming Matchups: show which team we cherry-pick against, the tilt, and **why**, with data | **Tiles** (6, larger): the streaming team's banner, the opponent logo with VS or @, `TILT → TEAM`, and signal chips.<br>**Evidence rows:**<br>- **Goals:** team GF/GP vs opponent GA/GP, each with its league rank.<br>- **Shots:** SF/GP vs SA/GP, with ranks.<br>- **Rest:** opponent on the 2nd night of a back-to-back, the team on one, or both rested.<br>- **Defense:** OPP DEF.<br>**Signals:**<br>- *Goal storm:* both sides in the league's top third.<br>- *Shot storm:* the same, for shots.<br>- *Tired opponent:* the opponent played the day before and the team didn't.<br>**Selection:** top-16 Week Score team, soft defense or a storm signal, **most signals first**, then off-night, softest defense and better schedule; one night per team.<br>**Data:** observed season rates from the same `nst_team_stats` row (`gf, ga, sf, sa` added to the existing read) and the schedule. No projection. |
| Top 3 schedule leaders: stripes and flare, opponent logo chips, a 7-day week row | Rebuilt on the shared header and footer. Each leader has a banner (name, rank, Schedule Score) and a **Mon–Sun row of opponent logo chips** (@ for away, off-night columns tinted, unselected days dimmed), plus games left and off-nights. The team-focus variant uses the same block plus its itinerary. |

## Data and read-path notes (live verification needs TJ's approval)

- New server reads, **not run live in this ticket**, following the SS1-3 pattern:
  - **Recent-form reads**, only for the ≤ 36 shown players: `rolling_player_game_metrics` (`season`, `strength_state = all`, `player_id in (shown skaters)`, `game_date ≥ today − 21 d`, ≤ 14 rows per player) and `wgo_goalie_stats` (`season_id`, `goalie_id in (shown goalies)`, `date ≥ today − 21 d`, ≤ 14 rows per player). Explicit limits, fail closed. If they fail, the card shows "No game in the last two weeks" and stays exportable.
  - **Player sources** are now read for every team with games (was top-10).
  - **`nst_team_stats`** adds `gf, ga, sf, sa`: same table, same row, 4 more numeric columns.
- **Mocked tests:** filters, limits, lookback, no-read with no players, the recent loader called with exactly the shown ids, and the stale/missing paths keep no names and make no recent read.
- A bounded live check (now concurrency 1 via the ticket-9 harness) would confirm the real L5 rows.

## Pinned PNGs (all 18 asserted on the final code)

| Edition | Status |
| --- | --- |
| Monday 7 | **new by design** (grid tiers and columns, banners, Streaming evidence) |
| Wednesday 7 | **new by design** (same cards) |
| Tuesday 4 | **unchanged**: `19f368aa…`, `4863603f…`, `94740e90…`, `305daf54…`; trend cards untouched |

The full values are in `t10/pinned-env.txt` and `t10/evidence/*.sha256`. They were identical across two independent runs.

## Checks run

- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **75/75** (`t10/vitest.log`). New tests cover the wider-pool fill order and tags, L5 attachment (skater latest row, goalie 5-game sums, stale windows), Streaming evidence (ranked rates, storms, back-to-backs, signal ordering) and the recent-form loader.
- **Playwright (mocked)** `e2e/social-share.spec.ts`: **23/23**, 48.2 s (`t10/e2e-run.log`). Run in skip-server mode on my own isolated :3110 server under the deny preload, with all 18 pinned hashes asserted.
  - **New #23:** 32 tiered grid rows with scores; cherry-pick borders equal to the Streaming nights; 9 tiles per band with "L5 GP", name and rostered % in the banner and WIDER POOL tags; geometry checks; leaders cards with three 7-day rows.
- **CSS pure check:** PURE OK (`t10/css-pure-check.log`). **ESLint:** exit 0.
- **Full `tsc --noEmit`** under `/private/tmp/fhfh-heavy.lock`: only the 2 pre-existing out-of-lease Luna errors (`t10/tsc.log`).
  - It first caught one error of mine (`Math.round` on a nullable OPP DEF in the Streaming alt text). I fixed it, then reran the unit tests, tsc and the full e2e.

## Evidence PNGs (`t10/evidence/`; fictional fixtures)

`flair-grid.png`, `flair-pickups-{50,30,20}.png`, `flair-specialists.png`, `flair-easiest.png`, `flair-stream.png`, `flair-leaders.png`, `team-fixture.png` (team focus), plus the pinned set.

## Values TJ may tune (new this ticket)

- **Grid tiers:** five tiers by competition rank (quintiles).
- **Storm threshold:** the league's top third.
- **Streaming:** 6 tiles; top-16 teams; soft defense or a storm.
- **L5 recency:** 14 days, with a 21-day read lookback.
- **Wider pool:** teams ranked 11+ by Week Score.
- **Banner background rule:** the primary color, or the secondary when the primary is near-black.
