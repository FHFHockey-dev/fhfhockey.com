# Power-play usage fix ("official PP targets in stage") — backtest verdict (2026-10-21)

Scope chosen by TJ: option 2 of `pp-overprediction-diagnosis.md` — team PP targets from official WGO per-player data, allocation proportional to each player's official PP TOI, the 120 s TOP floor only with a PP unit.

## Code (HOLD, octoberBranch)
- `queries/team-context-queries.ts`: `fetchTeamOfficialPpUsage(teamId, asOfDate)` — the team's last 10 regular-season games before the date (`games.type = 2`), WGO per-player rows for those games (`team_abbrev`), returns team means of summed PP TOI, all-situation TOI and PP shots plus `perPlayerPpToiAvgSec` (each player's mean over the window games he played); null under 3 games. `fetchTeamStrengthAverages` also reads `toi_pk_seconds`.
- `stages/skater-stage.ts`: team PP share = official PP TOI ÷ official all-situation TOI (fallback: strength table with PK in the denominator); team PP shots reconciled to the official PP shots average; PP minutes split proportionally to `perPlayerPpToiAvgSec` (fallback: the pre-allocation rolling PP TOI); role is no longer a multiplier; PP minimums only with a PP unit; `pp_opportunity` persists `target_source`, `allocation_evidence`, `legacy_team_pp_target_seconds`.
- Tests: `lib/projections` + bridge + harness + Start Chart — 59 files, 1,364 pass; eslint clean; `startChartPipeline.test.ts` and `nativeGoalAccounting.test.ts` updated (role-multiplier expectation; official-usage cache stub).

## Backtest (same cohort; TJ-approved S5–S8; harness variants pp1 = usage fix, pp2 = pp1 + PP assists per goal)

| head | baseline bias / RMSE | pp1 bias / ΔRMSE [95% CI] | pp2 bias / ΔRMSE |
|---|---|---|---|
| PP TOI (s) | +24.8 / 104.6 | **+4.8 / −33.3 [−39.5, −27.4]** | same as pp1 |
| PP shots | +0.046 / 0.569 | **+0.022 / −0.017 [−0.032, −0.002]** | same |
| PP goals | +0.0076 / 0.202 | **+0.0053 / −0.0036 [−0.0063, −0.0011]** | same |
| PP assists | −0.046 / 0.329 | −0.048 / −0.0029 (spans 0) | **+0.004** / −0.0036 (spans 0) |
| PPP | −0.038 / 0.401 | −0.042 / **−0.0092 [−0.0172, −0.0018]** | **+0.010** / −0.0058 (spans 0) |
| G | −0.021 / 0.465 | −0.024 / −0.0026 (spans 0) | same as pp1 |
| A | −0.215 / 0.657 | −0.218 / −0.0019 (spans 0) | −0.166 / **−0.0233 [−0.031, −0.016]** |

Team PP target ÷ actual per team-game: **1.285 → 1.056** (Σactual/Σtarget 0.778 → 0.947).

Top goal decile (Σactual/Σpred): PP TOI 0.780 → **0.868** (better); G 1.050 → 1.083 (slightly more under); PPP 1.047 → **1.140** (pp1, now under) / **0.777** (pp2, over). B2B slices: no CI-excluding regression for pp1; pp2 PPP worsens on both (MAE +0.035 / +0.024).

## Verdict
- **pp1 (the usage fix): clears on bias and RMSE for every PP-usage head and on PPP RMSE; regresses top-decile calibration for PPP (+4.5% under → 12% under) and slightly for G (5% → 8% under).** Those regressions are the inflated PP minutes no longer masking the halved PP assist rate (and a little lost PP-goal volume at the top), not new error — but under the literal "no calibration regression in decile 10" rule it does not clear. **TJ's call.**
- **pp2 (PP assists per goal on top): not cleared.** Overall PPP and PP-assist bias are fixed, but top-decile PPP is over-predicted by 29% and both B2B slices get worse. Cause: assists are modelled as the player's own goals × an assists-per-goal rate shrunk toward the league ratio, which over-credits high-volume goal scorers with assists. Fixing that needs a different assist model (e.g. assists from the player's on-ice PP goals/shot-assist share, or a role-aware prior), not a scale change.

## Release risk (whichever is chosen)
Replays of input captures recorded before this change will fail: replay matches each read by a hash of its operation list, and the change adds three reads (`games`, `teams`, `wgo_skater_stats`) and alters the `forge_team_game_strength` select (`inputCapture.ts:110` throws "Unrecorded projection input"). Live runs and `suppressWrites` reconstruction are unaffected. Any offline replay of runs captured before release needs re-capture or a version gate.

## Not verified
- WGO `pp_toi` / `toi_per_game` are seconds per player-game: confirmed on the exports (S5 and S7 agree within 1 s on all 2,231 shared keys); the stage's minute-format guard is code-only.
- The harness counts a team's official PP TOI over players it can map to that team (188 of 5,435 S7 rows unmapped), which can bias its new target slightly low; the stage maps by `team_abbrev` and has no such gap.
- The harness scales PP shots with PP TOI; the stage reconciles team PP shots to the official PP-shot average. These agree in expectation, not row by row.
- No end-to-end stage run against a database.
