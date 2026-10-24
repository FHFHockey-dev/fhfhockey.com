# C7 independent review — SS1-8 (first live player data path)

**Reviewer:** Claude C7 lane session (not the author). Read-only, built from code, mocks and SS1's recorded evidence:
- **no live requests of my own**: no server, no Supabase or NHL calls;
- no source edits, no Git.

Evidence is in `r13-evidence/ss1-8/`.

**Verdict: accepted with limits.**
- **Read path:** anon, select-only, bounded and fail-closed, filtered server-side.
- **Exposure:** only the shown players leave the server.
- **Freshness and cache:** both hold.
- **"Not ready" diagnosis:** correct.

**On the live check:** it stayed within the approval's **tables and volume**. The two extra tables were directly approved by TJ in a second pop-up. It deviated from the approval's **"sequential / concurrency 1"** wording, and RECEIPT-8 misstates two counts (see "Live check vs approval").

## Pins

- **Patch:** `SS1-8.patch` `e230e43d…8eee`, which matches and `git apply --check --reverse` cleanly against the working tree.
- **Lease files:** all **25** in `HASHES-8.txt` equal the canonical tree.
- **New:** `playerSources.ts` (+test).
- **Changed:** `server.ts`, `players.ts` (+test), `types.ts`, `SocialShare.tsx`, `schedule.test.ts`.

## Code review of the read path

| Requirement | Evidence | Result |
| --- | --- | --- |
| Anon, select-only | `playerSources.ts` uses `lib/supabase/public-client`, which is `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY` with no session persistence. There is no insert, update, upsert, delete or rpc. My Q1 drives the **real loader** against a recording mock: 0 write calls. | Holds |
| Explicit limits, fail-closed counts | `bounded()` uses an exact count with `pageSize = limit = PLAYER_SOURCE_LIMITS` (Yahoo 1000, skaters 800, goalies 120, map 2 × 150-id chunk). A count change or rows ≠ count throws, the layer becomes `missing`, and the schedule still serves. Q1: ranges `[0,999]`, `[0,799]`, `[0,119]`. | Holds |
| Server-side filters | **yahoo_players:** `season = 2026`, `percent_ownership < 50` (a **numeric** column per the generated types, so a true numeric compare), `editorial_team_abbreviation in` the top-10 teams plus their Yahoo aliases (Q1 shows `NJ`, `TB` added). **WGO skaters:** `season = "20262027"` (text), teams in the top 10. **Goalies:** `season_id = 20262027`, same teams. **Map view:** `yahoo_player_id in` the chunk. | Holds |
| Needed columns only | Yahoo: 9 columns, with **no** `ownership_timeline`, names, notes or headshots. Skaters 10, goalies 9, map 2 (the view also has `injury_note` and names, which aren't selected). | Holds |
| No reads when the schedule fails, for Tuesday, or when blocked | My G1 (mocked): player loader calls are Monday ready **1**, Wednesday ready **1**, Tuesday **0**, schedule 503 **0**, partial schedule **0**, out-of-season (400) **0**, `player-spotlight` **0**. The first call's teams are exactly the 10 top-ranked teams. Code: Tuesday returns a blocked snapshot before any read; players are read only after `state === "ready"`. | Holds |

## Exposure

- **`trimPlayerLayer`** keeps only the players that the pickup and specialist cards show for the edition's selected dates, and an unready layer keeps nobody.
- **My E1:**
  - the API snapshot carries **30** players (≤ 36), with **0** not shown on a card;
  - a planted, never-shown skater named "Zqx Sentinel-Hidden" is **absent** from the JSON;
  - there are no Yahoo `player_key`, `465.p.` or `ownership_timeline` values;
  - the player keys are public fields only (name, team, positions, rostered %, GP and rates).
- **Changed days:** a different day selection makes `playersReady` false, and the cards ask for a refresh (owner test).
- **Live:** RECEIPT-8 reports 25 shown; the live PNGs hold public NHL and Yahoo-rostered data only. I viewed the 30–49% card.

## Freshness on live-shaped data

- The live loader doesn't read timelines, so ownership is `percent_ownership` dated by `last_updated`.
- **My F1**, with `ownership_timeline = null`:
  - all `last_updated` today → `ready`, as of 2026-10-26;
  - 25% of rows dated 10-15 → `ready`, with those rows excluded ("Excluded 77 stale…");
  - 75% stale → `stale`, with **0** players exposed.

## Cache

My C1 (mocked API flow):

| Layer state | `Cache-Control` |
| --- | --- |
| Opponents **and** players ready | `public, max-age=0, s-maxage=300, stale-while-revalidate=300` |
| Players stale | `public, max-age=0, s-maxage=60`, with no swr |
| Players missing (the loader throws "SECRET pg detail") | `s-maxage=60`, and the error text is **absent** from the JSON |
| Schedule not ready (partial) | `no-store` |

This matches the requirement: ≤ 300 s only when fully ready, otherwise ≤ 60 s or `no-store`.

## "Not ready" diagnosis

- **Correct:** on a game day the edition window is 15 minutes and never runs past a puck drop (SS1-1 design, `selectScheduleDates`).
- **Live evidence:** `generatedAt` 19:33:24Z, `expiresAt` 19:48:24Z, the schedule `ready` with 0 reasons, 48 games, 32 teams.
- **Fix:** the old hard-coded "the schedule edition is not ready" text is replaced by `scheduleReason()`, which names expiry, the state and reason, or a failed or different-week load. That is a genuine text-honesty fix.
- **Unchanged by design:** the 15-minute window is still a value TJ may tune.

## Tests

**73/73** (`ss1t8.json`): SS1's 68 (schedule 31, players 11, playerSources 3, trends 6, matchups 8, mondayGrid 6, teamRates 3) plus my 5.

## Live check vs approval: assessed plainly

**TJ's first pop-up** (CLAUDE-033, 19:25Z): "Up to 5 sequential local GETs … read-only selects of `yahoo_players` …, `wgo_skater_stats_totals` and `wgo_goalie_stats_totals`, plus one NHL schedule read. No writes, concurrency 1, stop at the first correct render."

**SS1's recorded evidence** (`t8/live/upstream.jsonl`, `server.log`, `live-summary.json`, `live-allow-log.cjs`):

| Item | Recorded | Within approval? |
| --- | --- | --- |
| Hosts | Allowlist of `api-web.nhle.com` and the project's Supabase host, with GET/HEAD only on Supabase. One npm check was denied. | Yes |
| Writes | None. Every Supabase line is GET. | Yes |
| Local GETs | `server.log`: **2** page GETs of `/social-share/game-grid` (997 ms, 218 ms) and **2** API GETs. That is **4**, not "2 API + 1 warm-up" as RECEIPT-8 states. The page SSR made no upstream read. | Yes (4 ≤ 5); the receipt miscounts |
| Sequential / concurrency 1 | The two API GETs started **2 ms apart** (NHL fetches at 19:33:24.448 and .450; `generatedAt` .452 and .458). Every upstream read then ran **twice in parallel**. RECEIPT-8 says "sequentially", which the evidence contradicts. The cause is the React strict-mode double mount in dev; it was disclosed as such, but not as concurrent. | **No.** It deviates from "concurrency 1", although the volume stayed within cap |
| Upstream volume | 2 NHL schedule reads and 14 Supabase GETs: `nst_team_stats` ×2, `yahoo_players` ×2, skaters ×2, goalies ×2, map view ×6. These match RECEIPT-8's table. | Bounded |
| Tables beyond those named | `nst_team_stats` (the existing SS1-3 opponent layer) and `yahoo_nhl_player_map_read` (the id map). | See below |

**The two extra tables.**
- SS1's transcript contains a direct TJ pop-up answer in SS1's own session: `…live check including those two reads?"="Proceed, include both (Recommended)"`.
- I found it with a read-only search of session transcripts. It is the format of a user's AskUserQuestion answer, not a relayed claim. Its wording places it before the run; the snippet has no timestamp.
- SS1's diary records the same ("TJ pop-up approved incl. nst_team_stats + map view").
- So **the extra reads were directly approved**. They are also intrinsic to the approved endpoint (the opponent layer and the id join).
- **Process gap:** the orchestrator ledger CLAUDE-034 records them only as a "disclosure … beyond the tables TJ named" and doesn't mention this second approval. It should be reconciled.

**Bottom line.**
- **Within the spirit of the approval:** read-only, the named host set, bounded volume, stopped at the first correct render, and the extra tables explicitly approved.
- **Not within the letter:** it ran at **concurrency 2** for the API calls (and therefore every upstream read), against "concurrency 1 / sequential".
- **Inaccurate receipt:** RECEIPT-8 understates the local GET count (4, not 3) and calls the duplicate GETs sequential.
- **What the deviation cost:** no more data or harm than two sequential calls (same bounded reads, no writes). It should be reported to TJ as a deviation, not described as compliance.
- **Avoiding a repeat:** a future live check should bypass the dev double mount, e.g. a single scripted `fetch` of the API rather than a page load, or a production build.

## Observations (not blockers)

- **SS1-8-O1:** each uncached Monday or Wednesday API GET in production makes ~8 upstream reads (1 NHL + 7 Supabase). A cache of up to 5 + 5 min applies only when every layer is ready; otherwise 60 s. Under the Vercel cost rules this is acceptable for an unlinked page, but worth noting.
- **SS1-8-O2:** live `yahoo_players` rows with null `percent_ownership` (timeline-only) are excluded by `lt(…, 50)`. That is conservative.
- **SS1-8-O3 (cosmetic):** the live 30–49% card says "MONDAY · Pickups…" on a Saturday current-week edition with 1 GP left. The eyebrow follows the format, not the day.
- **Release:** before production use, the orchestrator ledger should record both approvals, and Codex should confirm the anon grants on `yahoo_players`, `wgo_*` and `yahoo_nhl_player_map_read` are intended for public read.
