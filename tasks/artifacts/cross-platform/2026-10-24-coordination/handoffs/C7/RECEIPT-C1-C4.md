# C7 independent review — C1 STATS-S06 and C4 SITE-WIGO (frozen packets)

**Reviewer:** Claude C7 lane session. I didn't author either packet. This was a read-only review: no source edits, no Git writes, no server, no production access. Evidence is in `c1-c4-evidence/`. All tests ran under the offline network guard, with the Vite cache kept in reviewer scratch.

| Packet | Verdict |
| --- | --- |
| C1 STATS-S06 (`C1-S06.patch` `ecef9b66…d7d4`) | **Accepted with limits.** The read gating and stale-team guard hold. The lineup placement for 13F/5D is misleading (C1-F1). |
| C4 SITE-WIGO (`C4-SITE-WIGO.patch` `2266893f…190e`) | **Accepted with limits.** IDs are valid, and Back is consistent with the code. League-wide links carry no player context despite their copy (C4-F1), and one partial-state message contradicts its heading (C4-F2). |

## Pins (checked 15:5x–16:17Z, HEAD `2a5092d37`)

- Both patch hashes match the orchestrator's values.
- Each patch's `index` preimage blobs equal the HEAD blobs.
- Both patches `git apply --check --reverse` cleanly against the working tree, before and after my runs.
- The C1 `DEPENDENCIES.sha256` matches 15/15. The C4 candidate `fd3e6b7f…` and the new test `ee8f00a8…` match.
- The 7 C4 read-only dependencies match the receipt.

No drift was found, so no scratch rebuild was needed. The working tree is exactly HEAD plus each patch for these files.

## Executed

1. **Owner tests rerun on the frozen bytes** (`c1c4-owner-rerun.json`): useShotData 16, TeamTabNavigation 19, teamAbbreviation 4, wigoCharts 6.
   - **45/45 pass.** This reproduces C1's 39 and C4's 6.
   - I didn't rerun the owners' HEAD-baseline failure runs (C1's 18 failures, C4's 6). Those remain their preserved claims.
2. **Independent controls** (`c1S06.test.tsx`, `c4Wigo.test.tsx`; `c1c4-run1.log`, `c1-observed.json`, `c4-observed.json`): **20/20 pass**, first run.
   - These render the real components. Supabase is replaced with **deferred** promises, so I control response order.
   - Heavy children and the WiGO data hook are mocked, as in the owners' harnesses.
3. **Screenshots inspected:** C1 `after-lines-TOR-13F5D-1440.png`. C4's four JPEGs are hash-listed in its receipt.
4. **No browser re-run.** SS1 holds :3110. C4's Back and touch evidence is the owner's browser claim; see "Back" below.

## C1 STATS-S06

**Confirmed**

- **Inactive reads (G1, G2, G5):**
  - The Dashboard, Schedule, Game State, Timeline, Roster and Shot Map tabs make **0** `lineCombinations` and **0** `yahoo_nhl_player_map` reads.
  - Season Stats makes exactly one of each.
  - Leaving and returning for the same team reuses the result, with no extra read.
  - Leaving mid-flight drops the response and makes no player-map read while inactive; returning refetches once.
- **Stale team (G3, G4):**
  - A late `lineCombinations` response for team A, arriving after a switch to B, is discarded. It never triggers A's player-map read, and B's lineup is what renders.
  - A late player-map response for A, after the switch, renders nothing for A.
  - The guard holds at both await points.
- **Error and retry (G6):** the error is shown, and re-entering the tab retries.
- **IDs (G7):** null, blank and nested IDs never become `/stats/player/…` links, and the player-map read receives only clean IDs.
- **Shot fixes** (code plus the owner's 16 tests):
  - The game-type filter uses ID digits 5–6.
  - An explicitly empty selection reads nothing.
  - Unparseable coordinates are dropped (0 is kept).
  - Shooting % is goals ÷ (goals + `shot-on-goal`), and is hidden when no saved shots are loaded. Reset is a native `<button>`.

**C1-F1 — Medium (truthfulness): extra forwards are presented as defensemen.**
- On a 13F/5D lineup, F13 renders inside the section labelled **"Defense"**, as D25's third-pair partner (E3). On 14F/4D, F13 and F14 both do (L1).
- No data says those forwards played defense. The pairing slot asserts a deployment the source doesn't contain.
- With a player-map row, the only cue is a small "LW" eligibility line (visible in the TOR screenshot). Without one, the card shows just the name or ID under "Defense" (L2: card text `113`).
- The mirror case 11F/7D (D7 shown in the forwards' C4 slot) was existing HEAD behaviour. 10F/8D is new and has the same issue.
- "Nobody is dropped" is a real improvement over HEAD dropping F13, but the placement is misleading.
- **Smallest repair (C1's file):** render overflow skaters in their true group with an explicit marker such as "Extra F (13F/5D)", or label the borrowed cell. Don't present them as a pair partner. The design choice belongs to C1 or its owner.

**C1-F2 — Low:** payloads with 19 or more skaters drop a player silently (13F/6D drops F13; 12F/7D drops D7). This only happens with bad data, but nothing indicates the omission.

**Limits**
- `useTeamSchedule` still reads `games` on every tab, so the brief's "without unnecessary inactive reads" is only partly met. The owner reports this as follow-up 1, which needs a lease.
- The owner's remaining follow-ups (the clipped 390px rink, the array-valued `tab` query) are unchanged. There were no 320/1024px captures and no real devices.

## C4 SITE-WIGO

**Confirmed**

- **IDs (W1):** all 32 `teamsInfo` teams round-trip through id → name → `teamNameToAbbreviationMap` → the same key. That gives exactly `/stats/team/{KEY}` and `/lines/{KEY}`.
  - `/stats/team/[teamAbbreviation]` accepts only `teamsInfo` keys (`hasOwnProperty`, `:267`).
  - `/lines/[abbreviation]` resolves through `mapTeamAbbreviation` and `getTeams()`, which needs the network. I didn't verify it at runtime. All 32 keys are current NHL abbreviations, including UTA.
- **No stale team:** `teamAbbreviation` is derived synchronously from the selected-player query data (no `placeholderData`). A new player shows generic links until their team resolves; another player's team is never shown.
- **Structure (W4, W5):** links are plain same-origin `next/link` anchors (push, no `target` or `rel`). There is exactly one workflow section at 1280, 769, 768 and 375px.

**Back:** WiGO writes `playerId` and `tab` with a shallow `router.replace`, and the links push, so Back should restore the player and tab. That is consistent with the code. Actual Back behaviour rests on C4's browser evidence (keyboard Enter → `/trends` → Back; tap on Starter Board → Back), which I didn't re-run. If the release owner wants an independent browser pass, it needs the :3110 slot.

**C4-F1 — Low (context):** the league-wide links carry no player or team context, but their copy says they do.
- The hrefs are `/trends`, `/game-grid/7-Day-Forecast` and `/start-chart`, with no player or team parameter (W2).
- Their shared descriptions say, for example, "Carry the player and team context into start-or-sit decisions" and "Compare the player and team explanation…".
- The team-scoped links do preserve the team. Only C4's own sentence ("…or a league-wide decision view") is accurate.
- The descriptions live in read-only `siteSurfaceLinks.ts`, so the repair belongs to that file's owner: soften the copy, or add supported query context.

**C4-F2 — Low (copy, C4's file):** with a player selected but the team unresolved, the heading reads "Take the {player} read further" while the description says "Select a player to add their team HQ and lines…" (W3). The fix is to branch the description on `selectedPlayer`, not only on `teamAbbreviation`.

**Process observation:** C4's own browser run reached the public NHL API (≥5 server-side calls). It also attempted `localhost:3000` four times from `fetchCurrentSeason`; nothing was listening, so all four got ECONNREFUSED. C4 disclosed both. Future isolated runs should set `NEXT_PUBLIC_SITE_URL` to an inert host.

## Luna addendum (cross-reference)

A full-tree `tsc --noEmit` (`fulltree-tsc.log`, exit 2) shows exactly two errors, both in the Luna packet: `tweetLunaReview.test.ts:192` and `review-ifttt-luna.ts:22` (Buffer → BinaryLike). I've recorded this as F7 in `REVIEW.md`. Neither C1 nor C4 adds a type error.
