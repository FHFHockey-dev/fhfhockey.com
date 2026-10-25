# C7 independent review — GS goalie-share: official starts per team game (uncommitted)

**Verdict: accepted.**
- Starts are counted only when every row in the window carries a `0`/`1` label **and** every team game has exactly one starter. Otherwise every goalie on that team gets `null` for that window.
- Appearance share is unchanged.
- No new request.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git, no live reads. Tests ran under the outbound network-deny preload. Evidence is in `r18-evidence/gs/`.

## Pins

- **The four changed paths equal `RECEIPT.md`:** `goalieWorkload.ts` `459fc3d6…`, `GoalieShareChart/index.tsx` `e6e8b813…`, `GoalieShareChart.test.ts` `cd1ac67f…`, `.pagination.test.tsx` `b4b814a4…`.
- **`task-only.patch`:** `3fd92b5f…`.
- **Untouched:** `workloadEvidence.ts` `8d9ae620…` and its test `fcd83058…`.

## Code read

| Item | Evidence | Result |
| --- | --- | --- |
| **Official starts per team game** | `buildGoalieShareByTeam` adds `startersByGame` per team over the window's distinct games, and `startsComplete = startsLabeled && every window game has exactly 1 starter`. Each goalie's `gamesStarted` is the sum of their labels, or `null`. | Holds |
| **Withheld on missing, doubled or invalid labels** | Any row whose label is not exactly `0` or `1` (missing, `null`, `2`, `0.5`) sets `startsLabeled = false`. Zero or two starters in one game fails the per-game check. Either case nulls **every** goalie's starts for that team window. A bad label outside the window doesn't affect it. | Holds |
| **Appearance share unchanged** | `gamesPlayed`, the pie denominator and the tooltip's appearance share are unchanged. Relief appearances are a measured `0` start. | Holds |
| **No false zero in the UI** | The tooltip prints `Starts: X of {totalGames} team games`, or `Starts: Unavailable` when null. One intro sentence was added. | Holds |
| **Scope** | No new request: `gamesStarted` comes from the same `goalie/summary?isGame=true` rows. `workloadEvidence` is still dormant, with no forecast or prior. | Holds |

## Tests

**48/48 pass** (`gs.json`).
- The owner's **47**: pagination 19, chart 16, workloadEvidence 12. That reproduces GS's 47.
- My **G1 property control** (`gsStarts.test.ts`): 400 random teams with 5–45 games, a 70/30 starter split and 10% relief appearances; 40% of teams get one corrupted label (`null`, `2`, `0.5`, or a flipped 0↔1, which gives zero or two starters). I checked all four spans for each team.
  - **Uncorrupted windows:** starts across the team's goalies sum to **exactly** the window's game count (1,056 windows).
  - **Corrupted label in the window:** every goalie's starts are `null` (544 windows).
  - Appearances always equal the window's row count.
  - **0 violations.**

## Observations (to the owner, not blockers)

- **O1:** a team game with **no goalie rows at all** can't be detected, because the window is built from the games that appear in the rows. Starts would then read "X of Y" over the recorded games only. This limit already affects appearance share; it isn't introduced here.
- **O2:** that the live NHL payload carries `gamesStarted` per game row is **inferred** from the canonical writer's use of the same endpoint, not observed. If it is absent, the tooltip shows "Unavailable" and never a zero. The receipt says this.
