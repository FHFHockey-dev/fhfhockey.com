# Power-play over-prediction — diagnosis (2026-10-21)

Reads: S5 (wgo_skater_stats PP split) and S6 (forge_player_projections PP TOI + allocation JSON), TJ-approved in this session, run once each via read-only psql (SQL in prod-queries.sql). Same cohort/run selection as the assists backtest; 1,488 player-games with all four heads and actuals.

| subset | PP goals pred / act (act÷pred) | PP assists pred (×2) / act | PP shots pred / act | PP TOI min pred / act | actual PP A per PP G |
|---|---|---|---|---|---|
| all | 0.0559 / 0.0504 (0.90) | 0.0510 (0.1020) / 0.0934 | 0.365 / 0.315 | 2.18 / 1.86 | 1.85 |
| top goal decile | 0.1647 / 0.1216 (**0.74**) | 0.1448 (0.2896) / 0.2162 | 0.955 / 0.723 | 4.12 / 3.21 | 1.78 |

## Finding
- The PP over-prediction is **usage, not conversion**: predicted PP TOI is 17% high overall and **28% high for the top decile** (4.12 vs 3.21 min), PP shots are 16% / 32% high, and PP goals follow (10% / 26% high). PP goals per PP shot are close to right (pred 0.153 vs act 0.160 overall; 0.172 vs 0.168 top decile).
- Actual PP assists per PP goal ≈ 1.8, so the per-goal PP assist refit (×2 of today's ~0.91) is the right scale; it only overshoots because PP goals are inflated by excess PP minutes.
- Mechanism (REPORT §3 R5, W3 §1 T5/T7): the stage reallocates PP TOI to the team's L10 PP share by role weight × √(toiPp+1) and floors TOP-role players at 120 s PP; the top decile gets the floor and the largest role weights, so their PP minutes and shots are inflated.

## Next (proposal, not done)
1. Fix PP usage first: reallocation weight closer to each player's own recent PP TOI share; drop the 120 s TOP floor when the player has no PP unit; backtest PP TOI/shots/goals with the harness (S6 gives the stored PP TOI for the counterfactual).
2. Then enable the PP half of the assist refit (`{ es: "per_goal", pp: "per_goal" }`) and re-backtest PPP.

## Round 2 (S7/S8, TJ-approved, read-only, once each)
- The stage's team PP target is `toi_pp/(toi_es+toi_pp) × 18,000` from the last 10 `forge_team_game_strength` rows (`team-context-queries.ts:45-50` selects ES and PP only; the table also has `toi_pk_seconds`). Per game the summed team targets are **26% above** official PP skater-seconds.
- Preseason is not the cause (6 preseason rows in the table; 0.18 per window on average).
- `forge_team_game_strength` sums each player's shift-chart totals (`buildStrengthTablesV2.ts:313`). Against official WGO data for the same games: PP skater-seconds **+38%** (4,263 vs 3,079 per game), PP shots **+19%** (10.4 vs 8.7), and ES+PP+PK = 21,472 skater-seconds per team-game instead of ~18,000 (all strengths over-counted; PP most).
- Effect of the denominator alone (adding PK): target/actual 1.41 → 1.29 on a replica of the stage's calculation (the replica does not reproduce the stored targets to the second, so treat these as directional).
- The role weighting (1.8 for TOP-tier players, √minutes evidence) and the 120 s TOP floor decide who receives the excess; the excess itself comes from the shift-derived totals.

## Fix options
1. **Stage-only, minimal:** PK in the PP-share denominator; allocation weights proportional to each player's official season-to-date PP TOI (`deploymentPrior.ppToiPerGameSec`, already read by the stage); TOP floor only with a PP unit. Removes ~9 points of the target excess plus the top-decile concentration; the shift-chart bias (~15–20%) remains.
2. **Stage, official targets:** team PP TOI share and PP shots targets from official WGO per-player data aggregated per team (last 10 regular-season games) in `team-context-queries.ts`, plus option 1's allocation. Removes the bias without touching production data; one new bounded team-level read per run.
3. **Root cause:** fix the shift-chart strength totals upstream and recompute the derived strength tables (production writes, ask-first); other readers (`splitsServer.ts`, `homepageGameAnalytics.ts`) also consume these totals.
