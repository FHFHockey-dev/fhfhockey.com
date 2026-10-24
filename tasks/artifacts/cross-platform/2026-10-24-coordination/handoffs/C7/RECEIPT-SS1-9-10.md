# C7 independent review — SS1-9 (live-check corrections) and SS1-10 (flair, L5 lines, wider pool, streaming "why")

**Reviewer:** Claude C7 lane session (not the author). Read-only, built from code, mocks and SS1's recorded evidence:
- **no live requests**, no server, no Supabase, NHL or Yahoo calls;
- no source edits, no Git.

Every test ran under the network-deny preload. Evidence is in `r14-evidence/ss1-9-10/`.

**Verdict.**
- **SS1-9: accepted.**
  - The correction receipt is truthful.
  - Strict-mode loads now share one API call.
  - The harness enforces concurrency 1 and the cap.
  - The eyebrow is date-aware.
- **SS1-10: accepted with one finding for SS1 (F1) and one copy finding (F2).**
  - The L5 lines use real columns.
  - Every band stays literally true.
  - The streaming chips are backed by data.
  - The banners stay inside the image.
  - The expanded read path is anon, select-only, bounded, fail-closed and trimmed.
  - It roughly doubles the typical upstream reads per uncached GET (O1).

## Pins

- **Patches:**
  - `SS1-9.patch` `364a3118…` and `SS1-10.patch` `afe52ca0…` match their stated hashes.
  - `SS1-10.patch` applies with `git apply --check --reverse` against the working tree.
- **Lease files:** `HASHES-10.txt` lists 30 files, and all 30 equal the canonical tree.

## SS1-9

| Claim | Evidence | Result |
| --- | --- | --- |
| The correction receipt states the errors truthfully | `RECEIPT-8-CORRECTION.md` now says:<br>- "2 of 5 GETs … sequentially" **is false**: the two API GETs started **2 ms apart** and broke "concurrency 1";<br>- the server saw **4** local GETs (2 page, 2 API), not "2 API + 1 warm-up";<br>- the cause was the strict-mode double mount;<br>- the two extra tables were approved by TJ's pop-up.<br>It leaves RECEIPT-8 unedited. These match my RECEIPT-SS1-8 findings. Telling TJ about the deviation is still the orchestrator's job. | Holds |
| One API call per load, including the strict-mode double mount | `lib/socialShare/editionFetch.ts` keeps one in-flight promise per URL and clears it in `finally`. The second mount's effect runs before the first resolves, so it gets the same promise. `SocialShare.tsx:427` is the only caller. Owner test `editionFetch.test.ts` passes 3/3. | Holds |
| The harness enforces concurrency 1 | `SS1/live-harness/serial-guard.cjs`: `begin()` refuses a request while another is in flight or once the cap is reached. `live-check.cjs` routes every counted page/API request through it, **aborts** a refused request before it reaches the server, and exits with code 2 on any violation. `node --test serial-guard.test.cjs`: **2/2 pass** (`serial-guard.log`). | Holds |
| The eyebrow is date-aware | `edition.ts` `editionLabel()` returns the posting-day label (e.g. "Monday") only when the edition is generated on that day in New York time. Otherwise it returns "Week ahead", "This week" or "Past week". This closes SS1-8-O3 (a "MONDAY" eyebrow on a Saturday). The flair PNGs show "WEEK AHEAD" for an Oct 24 generation of the Oct 26 week. | Holds |

## SS1-10 flair and data

**Tests: 82/82 pass** (`ss1t10.json`).
- SS1's **75**: SocialShare 1, editionFetch 3, matchups 9, mondayGrid 6, playerSources 4, players 12, schedule 31, teamRates 3, trends 6. This reproduces their 75/75.
- My **7** controls (`ss1T10.test.ts`, results in `ss1t10-observed.json`).

| Check | Evidence | Result |
| --- | --- | --- |
| L5 lines use real columns | Every recent-form column exists in `database-generated.types.ts`: `rolling_player_game_metrics.Row` (13 of 13; `season` is a number) and `wgo_goalie_stats.Row` (9 of 9). The 11 `nst_team_stats` columns, including the new `gf, ga, sf, sa`, are 11 of 11. `attachRecent` uses the latest `strength_state = "all"` row dated on or before today, and only if it is within 14 days. Goalies get sums over their 5 latest games with `games_played > 0`; SV% = saves ÷ shots against. | Holds |
| The wider pool keeps each band literally true | **B1:** 36 shown, 3 widened. **0** players outside `min ≤ % < max`. Every widened player ranks 11+ and appears after every non-widened player in its list; every non-widened player ranks ≤ 10. Specialists are all under 50%. `rosteredLabel` floors, so 49.9 prints "49%" and stays inside "30–49%". The player read covers all **32** teams with games. | Holds |
| Streaming "why" chips are backed by data | **S1:** I recomputed GF/GP, GA/GP, SF/GP and SA/GP league ranks independently from the fixture's `nst_team_stats`. For all 6 nights, every goal or shot storm equals "both sides top third", and every "tired" chip equals "the opponent played the day before and the team did not" (from the schedule). Every night qualifies by DEF ≤ 33 or a non-tired storm. 0 mismatches. No projection is used. In `flair-stream.png`, each green row matches its chip, e.g. DET GF/GP 11th vs STL GA/GP 5th gives a goal storm, with no soft-defense chip at DEF 39. | Holds |
| Team banners stay within the image | CSS: `.teamBanner` is `auto minmax(0, 1fr) auto`. The title and subtitle use `nowrap`, `overflow: hidden` and `ellipsis`. Player tiles have `overflow: hidden`. The spec's geometry checks (`fits`, `rowsInside`) pass on the pinned runs. **I viewed** `flair-pickups-30.png` and `flair-stream.png`: every banner, logo, chip and "MONTRÉAL CANADIENS" sits inside its tile, with no clipping of the image edge. | Holds |

**F1 (to SS1, medium): a failed recent-form read prints a false claim and is cached for 5 minutes.**
- **Behaviour:** if `loadSharePlayerRecent` throws, every shown player gets `recent: null`. Causes include a network error, a count change, or more than ids × 14 rows (one duplicate-heavy player is enough). `recentLine()` then prints **"No game in the last two weeks"** for all of them.
- **My R2:** the recent loader rejects. Result: 33 shown players, all `recent: null`, players `ready`, and `Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=300`. The error text doesn't leak.
- **Disclosure:** RECEIPT-10 discloses this behaviour ("stays exportable"). It still states as fact something the server didn't observe, and the shared cache keeps it up to 10 minutes.
- **Suggested fix:** keep "no recent game" (the source answered) separate from "recent form unavailable" (the read failed). Print the latter text, and cap the cache at the 60 s unready ceiling.

**F2 (to SS1, low, copy):** the pickups eyebrow says "Pickups on top-10 schedules", and the alt text says "Players on top-10 Week Score teams" (`SocialShare.tsx:230`, `:233`, `:271`). Yet the card can show wider-pool players: `flair-pickups-30.png` has #13, #19 and #20 goalies. The in-card legend and footer explain the WIDER POOL tag, but the alt text never mentions it. Suggested wording: "top-10 first".

**Nit:** "top third" is computed as rank ≤ ⌈n/3⌉, which is 11 of 32 (34%). The 11th-ranked team counts as top third (DET GF/GP 11th in the PNG). This is cosmetic. Either use ⌊n/3⌋ or say "top 11".

## Cost and safety of the expanded read path

| Requirement | Evidence | Result |
| --- | --- | --- |
| Fail-closed limits | **Q2 (real loader, 32 teams):** ranges are `yahoo_players [0,1999]`, `wgo_skater_stats_totals [0,1499]`, `wgo_goalie_stats_totals [0,199]`. **Q1 (real recent loader):** `rolling_player_game_metrics [0,41]` for 3 skaters and `wgo_goalie_stats [0,13]` for 1 goalie, i.e. ids × 14. Each read uses an exact count; a count change, or rows ≠ count, throws. | Holds |
| No reads on a failed schedule | **R1:** the recent loader runs **once** on a ready Monday. It runs **0** times for Tuesday, a schedule 503, a partial schedule, stale players, a players read failure, and `player-spotlight`. In the code, players are read only after the schedule and source are `ready`, and the recent read happens only when the trimmed layer is ready and non-empty. | Holds |
| No writes | Q1 and Q2 recorded every builder call on the anon `public-client`: **0** insert, update, upsert, delete or rpc calls. | Holds |
| No leaked columns or hidden players | **R1:** the recent read's ids equal the trimmed shown ids exactly (24 skaters and 9 goalies of 33 shown, ≤ 36), split correctly by group, `since = today − 21 d`. **L1:** the recent object carries only derived fields (`kind, games, through, goals…qualityStarts`). The snapshot JSON contains none of `strength_state`, `goalie_id`, `season_games_played`, `*_last5`, `465.p.`, `player_key` or `ownership_timeline`. My SS1-8 E1 sentinel check still applies to the trim, which is unchanged. | Holds |
| Read count per uncached GET | See O1. | Bounded |

**O1 (cost, release owner):** each uncached Monday or Wednesday API GET now makes these upstream reads:

| Read | Count |
| --- | --- |
| NHL schedule | 1 |
| `nst_team_stats` | 1 |
| `yahoo_players`, skater totals, goalie totals | 3 |
| `yahoo_nhl_player_map_read` | **M** = ⌈2R ÷ 150⌉, run sequentially, where R is the Yahoo rows (each row asks for both `player_key` and `player_id`) |
| Recent form | ≤ 2 |

- **At the 2000-row Yahoo ceiling:** M = **27**, which Q2 observed. The worst case is then **34** reads.
- **Typical estimate:** SS1-8's live 10-team run needed 3 map reads. Scaling to 32 teams gives M ≈ 8–10, so **~15–17** reads, against **~8** in SS1-8. That is roughly double.
- **Mitigation already in place:** the 300 s shared cache applies only when every layer is ready; otherwise the ceiling is 60 s.
- **Assessment:** acceptable for an unlinked page under the Vercel rules, but worth recording. Asking the map view only for the key form it actually uses would halve M.

**Release:** before any live check, TJ's pop-up must name the two new tables (`rolling_player_game_metrics`, `wgo_goalie_stats`). Codex should confirm their anon read grants are intended. SS1-10 ran no live request; its deny log holds only npm's registry check.

## Global ownership claim

**Confirmed from code.** Both `yahoo_players` writers request Yahoo's **game-scoped** player resource, not a league resource:
- `pages/api/v1/db/update-yahoo-players.ts:267`: `players;player_keys=…;out=draft_analysis,percent_owned`, writing through `playerWriter.ts`;
- `lib/supabase/Upserts/Yahoo/yahooAPI.py:37`: `fantasy/v2/players;player_keys=…` with `percent_owned`.

`percent_owned` there is Yahoo's site-wide rostered percentage across Yahoo leagues.

The league-scoped `league/{key}/players…/ownership` path in `providerClient.ts:206` does not write `yahoo_players`; the only other `yahoo_players` use is a read in `liveDraftServer.ts`.

`lib/socialShare` filters only on season, `< 50` and teams, and selects no league, roster or team-key column. So **no private league data** enters the cards.

The limit: whether the live rows were all written by those writers is a data-provenance fact I didn't query.
