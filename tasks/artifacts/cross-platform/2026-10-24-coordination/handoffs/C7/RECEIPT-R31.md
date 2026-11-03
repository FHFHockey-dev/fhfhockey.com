# C7 ticket 31 — review of `842ea60f6` (RSO bridge: never scale a goalie's start chance past an unknown teammate)

**Verdict: accept.** It closes my R29 B1 and B2. One residual edge is noted (T1, low).

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commit** (`git archive 842ea60f6` at `/private/tmp/c7-r31`), not the working tree.
- Tests ran under the outbound network-deny preload.
- Evidence is in `r31-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **Commit**: `forgeDailyBridge.test.ts` | **65/65** |
| **Parent mirror** (bridge reverted to `842ea60f6^` = `e8e8c293c`) | **60/65.** The 5 new tests fail: "keep a known share as read beside an unknown teammate, scaling down only past 1", "split what FORGE's starter leaves without scaling the others up", "hand a ruled-out goalie's chance to known teammates only when none is unknown", "thin the starter on a back-to-back without handing his chance to known teammates past an unknown…", and "count a goalie with no current NHL team…" |
| **My controls** (`c7/bridgeR31.test.ts`; the owner fixture plus Q1–Q4) | 4/4, results in `r31-observed.json`. The 134 total in `head.json` includes a second copy of the owner's 65 from my copied file. |

## Requirements (`web/lib/rosterScheduleData/forgeDailyBridge.ts`, the start-probability block)

| Requirement | Evidence | Result |
| --- | --- | --- |
| **Renormalise only when every team goalie is known** | `open()` is true if the team has a **teamless** goalie attributed to it, or any **roster goalie** of the team (`rosterGoalies`, built from every goalie with a current `nhlTeamId`, identified or not) has no probability for this game. `rescale` multiplies by `mass / total` only when `open()` is false; otherwise it uses **`min(1, mass / total)`**, which can only scale down. **My Q3:** all known shares of 0.6 and 0.6 give **0.5 and 0.5**, the same as before. | Holds |
| **One known plus one unknown never gives 1.0; all unknown gives unknown** | **My Q1:** g1 has a TOR row at 0.7, and g2's only row is from his old team, giving **g1 0.7, g2 `null`**, plus the limitation "1 team-games have a goalie with no start share; …sum to less than 1." This is my R29 G3 case, which used to give 1.0. With **no share rows**, both are `null` and neither gets a forecast. | Holds |
| **Goalies with no team id are counted and can't inflate a teammate** | A `teamless` goalie is attributed to the team named by his latest current-season start row, or else his latest FORGE line, and that team becomes `open`. **My Q2:** g2 has `nhlTeamId: null` and a current TOR row, and **g1 stays 0.7** (it used to be 1.0). The limitation "1 goalies have no current NHL team, so their start chances are unknown; …" is listed. | Holds (see T1) |
| **The exact-FORGE-row path is unchanged when the team is complete** | The exact goalie still gets `exactProbability`, and the others are `rescale(exact, 1 − p)`. When the team isn't open, that equals the old `(1 − p) × share / mass`. When it is open, the others are only scaled down to fit (new test). The pre-existing exact-row tests still pass. | Holds |
| **No NaN or 0 regressions into `gameForecastPoints`** | `rescale` uses a factor of 0 only when `total` is 0. The shares are finite parsed values. **My Q4:** every emitted `startProbability` across mixed cases (0, an invalid 1.3, 0.9, 0) is finite and in [0, 1]. Unknown goalies get no forecast, so they never reach scoring as 0. A share actually **read** as 0 stays 0 (a measured zero, as before). | Holds |
| **Related paths** | **Back-to-back:** the starter is thinned, and the moved chance goes to teammates only when nothing is open; otherwise it stays unassigned. **News** (confirmed / ruled out / floor) now uses the same `rescale`, so a ruled-out goalie's chance isn't pushed past an unknown teammate (new test). | Holds |

## Residual (info, not blocking)

- **T1 (low):** a teamless goalie with **no** current-season start row **and** no FORGE line can't be attributed to any team, so he can't make his real team `open`, and that team's known goalies renormalise as if complete. This is rare: a goalie on the roster with no team id and no rows at all. He is still counted in the "no current NHL team" limitation. The only fix would need another team source, so I'd leave it.
- **Note:** start chances for an open team-game now **sum to less than 1** by design, and the new limitation says so.
