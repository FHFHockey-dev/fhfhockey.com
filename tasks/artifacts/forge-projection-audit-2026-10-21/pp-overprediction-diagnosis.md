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
