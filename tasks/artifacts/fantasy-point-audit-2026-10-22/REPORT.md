# Fantasy-point projection audit (2026-10-22)

Audit only. No code, configuration or database changes; no production calls.

- **Production audited:** `origin/master` `248df9923` (R20). File:line references are to master (`git show origin/master:<path>`) unless marked "oct".
- **Evidence:** a code trace of every step from the FORGE stat heads to the FP numbers on Start Chart and the RSO, plus a re-analysis of the 10-21 audit session's reconstruction captures (read-only).
- **Backtest sample:** 62 games, 10-13..10-20, 2,074 dressed skater-games.
  - **a** = master code as deployed at R18 (`56fb03fef`).
  - **b** = a + sidecar hydration (`6767073ea`, unreleased).
- **Scratch:** `/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/36e743be-fccb-484b-8982-5ef9e7a9ba43/scratchpad/fp-audit/`. It holds the scripts, `rows.json` (sha256 `f315992b…`) and `analysis-out*.txt`.

---

## 1. Plain-English answer to TJ's hypothesis

**The 0.22 × 3 = 0.66 arithmetic is right, and the code does exactly that.**
- An expected fantasy-point total is the sum of weight × expected count. That holds whether or not the stats are correlated.
- A player expected to score 0.22 goals per game has about:
  - an 80% chance of 0 goals;
  - an 18% chance of 1 goal;
  - a 2% chance of 2 or more.
- Over many games he averages 0.66 FP from goals. On any one night he gets 0, 3 or 6 FP, never 0.66.
- The backtest confirms this for exactly TJ's example. The 350 player-games projected at 0.19–0.25 goals (mean 0.217) actually averaged 0.226 goals, and 80.0% of them scored none (Poisson predicts 80.3%). **Goals are calibrated in that band.**

**I found no FP valuation bug.**
- The weights are TJ's league weights, applied to the right stats.
- PPP is included.
- Start probability is applied once to goalies. Skaters are valued "if he plays".
- Units are per game everywhere.
- Rounding is 3–4 decimals.
- Section 2 lists each step with a verdict.

**But production projections really are low, by about 22% in total.** The cause is the expected stat counts that go in, not how they are valued.
- Master under-projects a dressed skater by **0.44 FP per game** (95% CI −0.55 to −0.34). Summed over all player-games, actual/projected = **1.28** [1.22, 1.35].
- That is about 7.4 FP per team-game across a team's skaters.
- It is concentrated in **forwards**, who are projected 32% too low (actual/projected 1.48). **Defencemen are projected 6% too high** (0.94). So master ranks D above F on average, when forwards actually outscore D by 39%.
- The gap breaks down as:
  - **Assists, 43%.** Power-play assists are on a deliberately halved scale. Even-strength assists are derived from each player's own goals.
  - **Blocks and hits, 29%.** Half the rows have no recent per-60 rates, and FORGE then uses 1 hit and 0.5 blocks per 60 minutes.
  - **Goals, 17%.** The shooting-percentage and shot-rate priors ignore position, and shorthanded goals are not modelled.
  - **PPP and SOG, 11%.**
- With the unreleased hydration fix, the gap falls to −0.16 FP per game (actual/projected 1.09), and the top decile is calibrated (0.98).

**Part of the "far lower" feeling is the shape of single games, and that never goes away.**
- The median single game is 1.05 FP, while the mean is 2.01 FP.
- 84% of skater-games have no goal.
- The best 10% of games produce 35% of all fantasy points.
- Even the nearly calibrated hydrated variant comes in under projection on 61% of nights. Yet summed over a week (players with 3 or more games), its median actual/projected is 0.99, and 49.6% of players beat their projection.
- On master the weekly sums do **not** match. The median player's ratio is 1.15, 59% of players beat their projection, and the pooled ratio is 1.30.

---

## 2. Valuation path, step by step

| # | Step | Evidence (master) | What happens | Verdict |
|---|---|---|---|---|
| 1 | League weights (FHFH default) | `web/lib/projectionsConfig/fantasyPointsConfig.ts:8-14, 25-30` | G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25; W 4, GA −1, SV 0.2, SHO 3. Identical to TJ's league. | **Correct** |
| 2 | FP formula | `web/lib/projections/accuracy/fantasyPoints.ts:28-52` | Plain Σ weight × value. Non-finite values count as 0, but every caller checks completeness first. | **Correct** |
| 3 | FORGE skater heads | `stages/skater-stage.ts:2709-2747, 3137-3164` | Per game (h1 horizon scalar = 1, `:1217`). Goals = shots × goal rate; assists = goals × assist rate; HIT/BLK = (ES+PP TOI) × an ES per-60 rate. ES and PP heads only: `proj_*_pk` is always null (`:3149-3162`). | **Correct units.** Risks: no SH or PK heads (F5); input fallbacks (F2, F3) |
| 4 | Skater conditioning | `skater-stage.ts:2291-2319`; `uncertainty.model.skater_selection.production_conditioning` | All 2,074 backtest rows are `conditional_playing`. No ×P(play) is applied. | **Correct** for "if he plays". Risk F9: with `STARTER_BOARD_COMPUTE_ENABLED=false` (production per the 10-20 orchestrator diary), DTD, benching and scratch multipliers (0.2–1) are baked into the mean |
| 5 | Team reconciliation | `skater-stage.ts:2416-2491, 2610-2694` | Team skater TOI is fixed at 18,000 s across ES+PP; PK minutes are folded into ES. Team ES and PP shots are fixed to team averages. Individual multipliers then only redistribute among teammates. HIT/BLK and the goal and assist rates are **not** reconciled to team totals. | **Correct** arithmetic. Risk: PK time is allocated by ES weight (F5) |
| 6 | FORGE goalie line | `stages/goalie-stage.ts:577-653, 738-756`; `goalieModel.ts:190-194`; `calculators/goalie-starter.ts:27-70` | Per-start line (`starterProbability: 1`), blended across the team's candidate starters. W = logistic((GF−GA)/1.25); SHO = e^−GA. `starter_probability` is stored separately. | **Correct** (conditional on a start). Risk F6: the two teams' W probabilities are not constrained per game |
| 7 | Head totals | `lib/projections/modeledHeadTotals.ts:7-12, 34-58` | G = es + pp (+pk ?? 0); PPP = ppG + ppA. A null ES or PP head makes the total unknown. | **Correct** |
| 8 | Bridge skater line (RSO) | `lib/rosterScheduleData/forgeDailyBridge.ts:235-250, 343-389` | Six FORGE keys map onto Yahoo keys. Stats are emitted as `unconditional` with no ×p, so P(play) is implicitly 1. SH_*, PIM and +/− are season rates (`:27, :246`) and not in TJ's weights. | **Correct**. Scratched players are over-valued: the opposite direction, measured as ledger "phantoms" |
| 9 | Bridge goalie line (RSO) | `forgeDailyBridge.ts:252-260, 394-447` | Per-start line × p, applied once (`:446`). `conditionalStats` keeps the per-start line. The xG Poisson win estimate is used only when FORGE's W is null (`:443-445`). | **Correct** (W and SHO are probabilities × points) |
| 10 | Multi-game weeks | `forgeDailyBridge.ts:165-189, 375-389`; RSO `planning.ts:699-714` | Each future game gets its own re-aimed copy of the latest per-game line. Weekly totals are Σ per game. | **Correct** (any per-game bias carries straight into weekly totals) |
| 11 | RSO weights | `lib/integrations/yahoo/rosterPlanning.ts:424`; `liveDraft.ts:275-304, 399-406, 467-492` | Yahoo `stat_modifiers` are taken as-is, keyed by stat id with a label cross-check. Unsupported stats are flagged (`rosterPlanning.ts:401`). | **Correct** in code. The GA sign depends on Yahoo's stored modifier: check with Appendix Q1 |
| 12 | RSO valuation | RSO `planning.ts:95-98, 107-128, 244-251, 460-486, 817-853` | `playValue` = Σ league weight × unconditional stats. Goalie keys apply only to goalies. `projectedValue` = banked realized stats + Σ active assigned games. Any missing key → null (strict). | **Correct** |
| 13 | Start Chart (GET) | `pages/api/v1/start-chart.ts:1504-1567, 1609-1660, 1685-1687`; `startChartFantasyScoring.ts:37-49, 124-142` | Skaters: FHFH-default weights (= TJ's) on the per-game heads, conditional, 3 decimals. Goalies: `proj_fantasy_points: null`, ranked by start probability. Starter-board scoring runs only when serving is on, which is `false` in production. | **Correct**. Gap: no goalie FP on Start Chart (F8) |
| 14 | Start Chart (POST scoring) | `start-chart.ts:1110-1122`; `starterBoardScoring.ts:50-66, 122-161, 173-191, 239-258` | Board scoring uses `expected ?? conditional ?? legacy`. Goalies are integrated once (× start probability). Skaters stay conditional unless confirmed in or out. | **Correct** |
| 15 | Display: RSO | `components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx:860-873, 1077`; `SlotWeekGrid.tsx:166, 202, 233` | **Per game**: projected FP per future cell (1 decimal), actual FP per past cell. Goalie cells are p × per-start FP. The "Projected points" metric is the **matchup total** (banked + remaining active games). "Projected active points" excludes banked results. | **Correct** but label-sensitive. Risk F7: the grid sums only the keys it knows |
| 16 | Display: Start Chart | `pages/start-chart.tsx:1085-1086, 1110` | **Per game**, 2 decimals, labelled "FP if playing". The week's game count is shown separately ("N GM"). | **Correct** |
| 17 | Actual points (RSO past days) | `rosterPlanning.ts:21-28, 37-88` | WGO per-game stats × league weights; a player who did not dress = 0. A null WGO stat counts as 0 (`:80`); oct makes it null. | Minor risk (it understates actuals, the opposite direction) |
| 18 | Accuracy job | `pages/api/v1/db/run-projection-accuracy.ts:1919-1935, 2221-2233` | Same formula, same weights, predicted vs actual. | **Correct** |

**Rounding.**
- FORGE stores heads to 3 decimals (`skater-stage.ts:3150-3164`).
- The bridge rounds to 4 decimals (`forgeDailyBridge.ts:43`). Start Chart FP keeps 3 decimals.
- The worst-case FP error from these is under 0.01. The 1-decimal grid is display only.

**Per-60 vs per-game, ES vs all situations.**
- Per-60 rates are multiplied by projected minutes / 60, which is correct.
- HIT/BLK use the **ES** per-60 rate across ES+PP minutes. PK minutes are not modelled per player: they are folded into the team ES total and spread by ES weight (F5).

---

## 3. Findings

No FP arithmetic bug. The findings below are in the stat model, its inputs, or display and measurement.

Severity:
- **High:** ≥ 0.05 FP per player-game, or a material misranking.
- **Medium:** 0.02–0.05 FP per player-game, or a ranking risk.
- **Low:** under 0.02 FP per player-game, or display only.

| ID | Severity | Finding | Impact (master backtest, per dressed skater-game) | Minimal fix (not implemented) |
|---|---|---|---|---|
| **F1** | **High** | **Forwards under-valued, defencemen over-valued.** On master the shot-evidence weight is capped at 0.58 × the TOI weight, because `shots_total_all` is a NULL pruned field (`calculators/skater-adjustments.ts:399-431`). Every skater is then pulled at least 42% toward position-blind priors: 6 SOG per 60 (`skater-stage.ts:2128-2138`, fallback 6 at `:2110`) and a 9.5% ES shooting % (`:2251-2255`). | <ul><li>Forwards: projected 1.50 FP vs actual 2.22 (×1.48). G 0.152 vs 0.239; SOG 1.41 vs 1.73; shooting % 10.8 vs 13.8.</li><li>D: projected 1.71 vs actual 1.60 (×0.94). G 0.171 vs 0.072; SOG 1.65 vs 1.33; shooting % 10.4 vs 5.4.</li><li>40% of master's top FP decile are D.</li><li>The aggregate G bias is small (−0.025) only because forwards and D cancel out.</li></ul> | <ul><li>Use F- and D-specific priors for ES SOG/60 and ES shooting %.</li><li>Hydration (R21) lifts the cap: forwards ×1.17, D ×0.90. It helps but does not finish the job.</li></ul> |
| **F2** | **High** | **Power-play assists on a halved scale.** The PP assist rate is PP assists ÷ (PP goals × 2) (`skater-adjustments.ts:542-551`, comment `:433-436`). It is applied as PP goals × rate, with no ×2 (`skater-stage.ts:2713-2714`). The scale was left deliberately "pending the power-play over-prediction". R19 has since fixed PP usage. | <ul><li>PP assists projected 0.040 vs actual 0.072 (×1.83).</li><li>Projected PP A per PP goal is 0.92; actual is 1.85.</li><li>Each PP assist is worth 3 FP (A 2 + PPP 1), so this costs **−0.098 FP per game, 22% of the gap**.</li></ul> | <ul><li>Do not just flip it to per-goal. The pp2 test over-predicted the top-decile PPP by 29% (`pp-usage-verdict.md`), because assists come from each player's own goals.</li><li>Minimal option: per-goal PP assists with a stronger shrink toward the league PP A/G (≈1.8) for high-volume scorers.</li><li>Better option: PP assists from team PP goals × the player's on-ice PP share.</li><li>Re-backtest on master inputs.</li></ul> |
| **F3** | **High** | **Hit and block fallbacks.** On 993 of 2,074 rows (48%), the latest ev rolling row has TOI but null per-60 rates (`sog_`, `hits_`, `blocks_per_60_last5`). The `_all` fallbacks are pruned NULL on master, so FORGE uses constants: 1 hit per 60 and 0.5 blocks per 60 (`skater-stage.ts:2171-2200`). A last-5 rate of exactly 0 projects 0 (321 hit rows, 478 block rows). | <ul><li>Null-rate rows: hits 0.29 projected vs 1.10 actual; blocks 0.15 vs 0.80. That is −0.156 FP per game overall.</li><li>Zero-rate rows: −0.056 FP per game.</li><li>Rows with a positive rate over-project: hits 2.09 vs 1.38 and blocks 1.40 vs 0.95, which offsets +0.085.</li><li>Net HIT+BLK: **−0.127 FP per game, 29% of the gap**.</li><li>Null rows by date grow from 0 on 10-14 to 120 of 130 on 10-19. That is consistent with NST count gaps (inferred; Appendix Q5 checks it).</li></ul> | <ul><li>Fall back to a position or player prior (season WGO per-game rate) instead of 1 and 0.5 per 60.</li><li>Treat a 0 last-5 rate with a small sample as missing.</li><li>Ship hydration with F3/F4 hits and blocks (R21 + R22). Hydration alone overshoots hits (+0.26).</li></ul> |
| **F4** | **Medium** | **ES assists are tied to the player's own goals.** ES assists = own ES goals × an assists-per-goal ratio (`skater-stage.ts:2711-2713`; `skater-adjustments.ts:532-541`). The assist head inherits every goal error, including F1's. | <ul><li>Non-PP assists: 0.166 projected vs 0.229 actual. **−0.125 FP per game, 28% of the gap.**</li><li>Forward assists are 39% short.</li><li>The R18 refit already halved this error. With hydration it is −0.078.</li></ul> | Longer term: model assists from team on-ice goals × the player's assist share. That also fixes F2. |
| **F5** | **Low–Medium** | **Structural omissions.** No shorthanded goals or assists and no PK shots (`proj_*_pk` null). PK minutes are folded into ES. Team shot targets cover ES and PP only (`skater-stage.ts:2610-2617`). | <ul><li>Estimated −0.02 to −0.03 FP per game (SH ≈ 2–3% of goals; not measured here; Appendix Q2).</li><li>Penalty-killing D-men's blocks are under-allocated.</li></ul> | Add SH goals and assists as season-rate terms to G and A (the bridge already computes SH_* season rates), or model PK minutes per player. |
| **F6** | **Low–Medium** | **Goalie win probabilities are not constrained per game.** P(win) comes from each team's own GF−GA (`goalieModel.ts:190-192`). Team GF is the sum of the under-projected skater ES+PP goals (`skater-stage.ts:3374-3377` → `goalie-stage.ts:289, 352-358`). | <ul><li>On master the two teams' W probabilities sum to 0.974 per game on average, but range from 0.73 to 1.15.</li><li>An individual goalie can be off by ±0.13 W, which is ±0.5 FP per start.</li><li>Goalie FP accuracy itself is unmeasured (no goalie actuals in the cohort).</li></ul> | Normalize the two teams' win probabilities to ≈0.98 per game, or use the bridge's xG Poisson model. Measure first with the ledger (Q3). |
| **F7** | **Low** | **The RSO grid shows partial sums.** `pointsFor` adds only the keys present and shows a number if any key is known (`RosterScheduleOptimizer.tsx:866-871`). The planner itself is strict (null). | Not triggered for TJ's league today: bridge rows carry all six skater keys and all four goalie keys. | Show "—", or flag a cell as partial when a weighted key is missing. |
| **F8** | **Low** | **Goalie values are easy to misread.** RSO goalie cells are p × per-start FP. With p = 0.55 and a per-start value of about 4.2 (master mean), the cell shows about 2.3, while a start scores 4.2 on average. Start Chart on master shows no goalie FP at all. | Perception only. | Show "if starts" FP next to the expected value; `conditionalStats` already holds it. |
| **F9** | **Low** | **Mean haircuts before team reconciliation.** The role-stability multiplier (0.70–1.05, `skater-stage.ts:771-790, 2306-2319`) is below 1 on 89% of rows (mean 0.885). It is renormalized at the team level, so it moves volume between teammates. Rows under 0.95 run ×1.32 vs ×1.20 for the rest. With compute off in production, DTD, benching and scratch multipliers do the same. | Misallocation within a team, not a level bias. | Express volatility as uncertainty, not as a cut to the mean. |
| **F10** | **Low (measurement)** | **The ledger scoreboard mixes populations.** Its FP bias pools rows for players who did not dress (actual = 0, `servedForecastLedger.ts:172-177`) with dressed rows. Its decile-10 ranks by expected goals, not FP (`:219-225`). | The scoreboard FP bias will look less negative than the dressed-only value. | Read the dressed-only numbers (Appendix Q3 and Q4). |

---

## 4. Bias decomposition (master reconstruction "a"; "b" = + hydration)

**Reproduced:** n = 2,074.
- a: FP bias −0.442, RMSE 2.101; top decile (by a's projected FP) 1.234.
- b: −0.158 and 0.975.

These match the 10-21 verdict.

Game-clustered bootstrap, 2,000 reps:

| | FP bias [95% CI] | Σactual/Σprojected [95% CI] | top-decile ratio [95% CI] |
|---|---|---|---|
| a (master) | −0.442 [−0.550, −0.341] | 1.282 [1.215, 1.352] | 1.234 [1.072, 1.401] |
| b (hydration) | −0.158 [−0.259, −0.059] | 1.086 [1.032, 1.141] | 0.975 [0.854, 1.099] |

### 4.1 By stat (weight × bias)

| stat (weight) | projected / actual per game (a) | FP contribution (a) | share of the a gap | FP contribution (b) |
|---|---|---|---|---|
| A (2) | 0.206 / 0.301 | −0.191 | 43.1% | −0.147 |
| BLK (0.25) | 0.477 / 0.800 | −0.081 | 18.2% | −0.002 |
| G (3) | 0.158 / 0.183 | −0.075 | 16.9% | −0.022 |
| HIT (0.2) | 0.904 / 1.136 | −0.046 | 10.5% | **+0.052** |
| PPP (1) | 0.083 / 0.111 | −0.029 | 6.5% | −0.019 |
| SOG (0.2) | 1.490 / 1.594 | −0.021 | 4.7% | −0.020 |
| **Total** | 1.567 / 2.009 FP | **−0.442** | 100% | **−0.158** |

### 4.2 By cause (a)

The parts sum to the total.

| cause | FP per game |
|---|---|
| ES + SH assists (F4; includes the SH share, F5) | −0.125 |
| PP assists on the halved scale (F2) | −0.098 |
| ES + SH goals: forwards under, D over, SH missing (F1, F5) | −0.086 |
| PP goals: **over**-projected, PP TOI 1.89 vs 1.46 minutes (fixed in R19) | +0.015 |
| Hits: null-rate rows −0.077, zero-rate rows −0.021, positive-rate rows +0.052 (F3) | −0.046 |
| Blocks: null-rate rows −0.079, zero-rate rows −0.035, positive-rate rows +0.033 (F3) | −0.081 |
| SOG | −0.021 |
| **Total** | **−0.442** |

### 4.3 By tier (deciles of a's projected FP)

| decile | projected | actual | actual/projected | share of the total shortfall | b (same bins) actual/projected |
|---|---|---|---|---|---|
| 1 (lowest) | 0.77 | 1.22 | 1.59 | 10% | 1.23 |
| 2 | 0.95 | 1.70 | 1.80 | 17% | 1.51 |
| 3 | 1.09 | 1.54 | 1.42 | 10% | 1.20 |
| 4 | 1.23 | 1.80 | 1.47 | 13% | 1.29 |
| 5 | 1.38 | 1.62 | 1.18 | 6% | 1.09 |
| 6 | 1.53 | 1.98 | 1.29 | 10% | 1.18 |
| 7 | 1.72 | 1.93 | 1.12 | 5% | 0.97 |
| 8 | 1.93 | 2.17 | 1.12 | 5% | 0.97 |
| 9 | 2.22 | 2.60 | 1.17 | 9% | 0.97 |
| **10 (top)** | **2.85** | **3.51** | **1.23** | **15%** | **0.98** |

**Master's shortfall is broad-based, not a top-decile problem.**
- The top decile carries 15% of the gap: 0.67 FP per game.
- Its gap is all goals and assists: G +0.28, A +0.52 and PPP +0.10 per game, partly offset by HIT −0.18 and BLK −0.08, which are over-projected there.
- The worst ratios are in deciles 1–4, where depth forwards on fallback rates sit.

**Hydration fixes the top half. The remaining gap is in low-projection players.**
- In hydration's own deciles, deciles 1–3 run ×1.37–1.72 and deciles 9–10 run ×0.91–0.98. That spread suggests b's projections are slightly too spread out.

### 4.4 By position (a)

| | n | projected FP | actual FP | ratio | weighted bias by stat |
|---|---|---|---|---|---|
| F | 1,379 | 1.50 | 2.22 | 1.48 | G −0.26, A −0.26, PPP −0.05, SOG −0.06, HIT −0.05, BLK −0.04 |
| D | 695 | 1.71 | 1.60 | 0.94 | G +0.30, A −0.06, PPP +0.02, SOG +0.06, HIT −0.04, BLK −0.17 |

Forwards on null-rate rows are the worst group: −0.95 FP per game (n = 673), and they alone account for −0.31 of the −0.44 total.

### 4.5 Genuine bias vs the shape of single games

| | a (master) | b (hydration) |
|---|---|---|
| median actual FP per game vs mean projected | 1.05 vs 1.57 | 1.05 vs 1.85 |
| share of games below projection | 57.8% | 61.2% |
| share of skater-games with 0 goals (Poisson at the projected mean) | 84.4% (85.5%) | 84.4% (84.5%) |
| share of all FP produced by the best 10% of games | 34.7% | 34.7% |
| 512 players with ≥ 3 games: median Σactual/Σprojected | **1.15** | **0.99** |
| … share of players beating their multi-game projection | **59.4%** | **49.6%** |
| team-game skater FP, projected vs actual | 26.2 vs 33.6 | 31.0 vs 33.6 |

How to read this:
- Single games are right-skewed. Even a calibrated model loses on about 60% of nights and looks small next to a memorable 2-point night. That is the "shape".
- The test of a genuine bias is whether **sums** match.
  - On master they do not. Players beat their multi-game projections 59% of the time; the pooled sum is 30% over and the per-player median ratio is 1.15.
  - With hydration, the per-player sums match (median 0.99, coin-flip 49.6%), and the pooled sum is 9% over, mostly from assists.
- So TJ's impression is both: about two thirds genuine bias on master and one third shape. With hydration, it is mostly shape.

### 4.6 Caveats: reconstruction vs production

- The reconstruction ran master code as of R18 against **today's** database, with `STARTER_BOARD_COMPUTE_ENABLED=true`.
- Production at R20 adds R19 (official PP usage). Applying the pp1 deltas from `pp-usage-verdict.md` gives an FP bias about 0.02 more negative, so roughly −0.46 (an estimate).
- Production ran with compute=**false** (10-20 orchestrator diary §5.5). That bakes event multipliers into the means: redistribution within a team (F9), not a level change.
- How common null per-60 rates were at serve time is not known (Q5). The served-forecast ledger measures the real thing (§5).

---

## 5. What the S-B served-forecast ledger will confirm

The ledger (`forge_served_forecast_ledger`) has been live since R19. It snapshots at 12:30Z and settles at 11:00Z. The public view is `/api/v1/forge/scoreboard`.

**What it can settle:**
1. **Production's real bias on the lines the RSO was actually served.**
   - `bridge_exact` (own-game run) and `bridge_reaimed` (copied lines for later games in the week) are compared against `naive_last5` and `naive_season` on identical player-games.
   - That answers "is it the model or the inputs" and "does re-aiming add error".
2. **Goalie FP for the first time:** expected (× start probability) vs actual, plus reliability bins for W, SHO and starts (F6).
3. **Participation errors:** "phantoms" are forecasts for players who did not dress (an over-projection, the opposite direction).
4. **Before/after evidence for R21 hydration and R22 hits/blocks** on the same scoreboard.

**Numbers to watch.** Expected values assume the reconstruction holds for R20.

| metric | where | expect on R20 | target |
|---|---|---|---|
| Skater FP bias, `bridge_exact`, **dressed only** | Q3 (the scoreboard pools non-dressed rows, F10) | ≈ −0.44 to −0.46 | \|bias\| ≤ 0.10 |
| Σactual/Σexpected FP, dressed | Q3 | ≈ 1.28 | 0.95–1.05 |
| Weighted bias by stat | Q3 | A ≈ −0.19, BLK ≈ −0.08, G ≈ −0.07, HIT ≈ −0.05, PPP ≈ −0.03 (or more negative after R19), SOG ≈ −0.02 | each \|·\| ≤ 0.03 |
| FP by forward/defence | Q3 | F ≈ ×1.48, D ≈ ×0.94 | both 0.95–1.05 |
| FP decile 10 and deciles 1–4 (by expected FP, not goals) | Q4 | ≈ 1.23; 1.4–1.8 | 0.9–1.1 |
| Share of games below projection; median actual | Q4 | ≈ 58%; ≈ 1 FP | the shape stays near 60% even when calibrated |
| `bridge_reaimed` minus `bridge_exact` FP bias | Q3 | unknown | ≈ 0 |
| Goalie FP bias; W reliability bins | Q3 + `/scoreboard?scope=goalie` | unknown (F6) | \|bias\| ≤ 0.2 per start |
| Naive controls vs bridge FP bias | Q3 | naive is roughly unbiased by construction; if the bridge is worse, it is the model | the bridge's MAE should beat naive |

**Sample size.**
- About 2,500–2,800 dressed skater-games a week. One week puts the FP bias standard error near 0.05, enough to confirm or refute −0.44.
- Two weeks are needed for the stat, decile and position splits.
- Goalies need 3–4 weeks (about 100 starts a week).

---

## 6. Where octoberBranch differs (unreleased)

- **Hydration** (`6767073ea`, `queries/skater-queries.ts`): FP bias −0.44 → −0.16; top decile 1.23 → 0.98.
  - Hits flip to over-projection (+0.26).
  - Forwards ×1.17, D ×0.90.
- **F3/F4 all-strength hits and blocks with position and league priors** (`skater-stage.ts` oct `:2266+`, `computeSkaterPhysicalEventRates`): the matching fix for F3. Not on master.
- **F1 aligned heads / withholding** (HOLD): makes G and A null when the evidence is missing, and the goalie W null when team GF is null.
- **PP assists:** still per two goals on octoberBranch (`skater-adjustments.ts:558`). F2 is unresolved on both branches.
- **Bridge** (oct `:375`): emits own-game rows even when the latest line is unknown. This is coverage, not valuation.
- **`rosterPlanning.ts`** (oct): a null WGO stat makes past actual points null instead of 0.
- **Start Chart** (oct): `scoreStartChartPayload` and game-expectation scoring. Same weights.

---

## Appendix A: read-only SQL for TJ (6 bounded queries)

All are SELECT-only. Run them in order; each is independent.

```sql
-- Q1. Stored Yahoo scoring modifiers for your leagues (checks every weight and the GA sign).
--     Replace the uuid with your auth user id. ≤ 10 rows.
select external_league_key, league_name, season_key,
       scoring_settings->>'scoring_type'  as scoring_type,
       scoring_settings->'stat_modifiers' as stat_modifiers
from public.external_leagues
where provider = 'yahoo'
  and user_id = '00000000-0000-0000-0000-000000000000'  -- <- your user id
order by imported_at desc nulls last
limit 10;
```

```sql
-- Q2. Structural gap in the backtest window: shorthanded / empty-net / PK shots by position. 2 rows.
select case when position_code = 'D' then 'D' else 'F' end as pos,
       count(*) as player_games,
       sum(goals) as goals, sum(pp_goals) as pp_goals, sum(sh_goals) as sh_goals, sum(empty_net_goals) as en_goals,
       sum(assists) as assists, sum(pp_assists) as pp_assists, sum(sh_assists) as sh_assists,
       sum(shots) as shots, sum(pp_shots) as pp_shots, sum(sh_shots) as sh_shots,
       sum(hits) as hits, sum(blocked_shots) as blocks, sum(sh_time_on_ice) as sh_toi_raw
from public.wgo_skater_stats
where date between '2026-10-13' and '2026-10-20'
group by 1
order by 1;
```

```sql
-- Q3. Ledger: dressed-only vs pooled FP bias and weighted bias by stat, per source × class × F/D. ≤ 40 rows.
select l.source, l.player_class,
       case when l.player_class = 'goalie' then 'G' when p.position = 'D' then 'D' else 'F' end as pos,
       l.dressed, count(*) as n,
       round(avg(l.exp_fantasy_points - l.act_fantasy_points), 3)                    as fp_bias,
       round(sum(l.act_fantasy_points) / nullif(sum(l.exp_fantasy_points), 0), 3)    as act_over_exp,
       round(avg(3    * (l.exp_goals     - l.act_goals)), 3)     as g_fp,
       round(avg(2    * (l.exp_assists   - l.act_assists)), 3)   as a_fp,
       round(avg(1    * (l.exp_pp_points - l.act_pp_points)), 3) as ppp_fp,
       round(avg(0.2  * (l.exp_shots     - l.act_shots)), 3)     as sog_fp,
       round(avg(0.2  * (l.exp_hits      - l.act_hits)), 3)      as hit_fp,
       round(avg(0.25 * (l.exp_blocks    - l.act_blocks)), 3)    as blk_fp,
       round(avg(0.2  * (l.exp_saves     - l.act_saves)), 3)     as sv_fp,
       round(avg(-1   * (l.exp_goals_against - l.act_goals_against)), 3) as ga_fp,
       round(avg(4    * (l.exp_win_prob  - l.act_win)), 3)       as w_fp,
       round(avg(3    * (l.exp_shutout_prob - l.act_shutout)), 3) as sho_fp
from public.forge_served_forecast_ledger l
left join public.players p on p.id = l.player_id
where l.served_date between '2026-10-21' and current_date
  and l.settled_at is not null
  and l.exp_fantasy_points is not null and l.act_fantasy_points is not null
group by 1, 2, 3, 4
order by 2, 1, 3, 4;
```

```sql
-- Q4. Ledger: FP calibration by decile of EXPECTED FP (dressed skaters), plus the single-game shape. ≤ 50 rows.
with s as (
  select source, exp_fantasy_points as e, act_fantasy_points as a,
         ntile(10) over (partition by source order by exp_fantasy_points, player_id, game_id) as decile
  from public.forge_served_forecast_ledger
  where served_date between '2026-10-21' and current_date
    and settled_at is not null and player_class = 'skater' and dressed
    and exp_fantasy_points is not null and act_fantasy_points is not null
)
select source, decile, count(*) as n,
       round(avg(e), 3) as mean_exp, round(avg(a), 3) as mean_act,
       round(sum(a) / nullif(sum(e), 0), 3) as act_over_exp,
       round((percentile_cont(0.5) within group (order by a))::numeric, 2) as median_act,
       round(avg((a < e)::int), 3) as share_below_exp
from s
group by 1, 2
order by 1, 2;
```

```sql
-- Q5. Production rolling inputs: how often the latest ev per-60 rates are NULL or 0 (F3), by game date. ≤ 15 rows.
select game_date, count(*) as ev_rows,
       count(*) filter (where sog_per_60_last5    is null) as sog_last5_null,
       count(*) filter (where hits_per_60_last5   is null) as hits_last5_null,
       count(*) filter (where hits_per_60_last5   = 0)     as hits_last5_zero,
       count(*) filter (where blocks_per_60_last5 is null) as blocks_last5_null,
       count(*) filter (where blocks_per_60_last5 = 0)     as blocks_last5_zero
from public.rolling_player_game_metrics
where strength_state = 'ev' and season = 20262027
  and game_date between '2026-10-07' and '2026-10-21'
group by game_date
order by game_date;
```

```sql
-- Q6. Production FORGE rows on R19/R20 runs: mean projected FP, PP A per PP G (F2), zero hits/blocks (F3). ≤ ~15 rows.
select r.as_of_date, left(r.git_sha, 9) as git_sha, count(*) as rows,
       round(avg(3 * (p.proj_goals_es + p.proj_goals_pp) + 2 * (p.proj_assists_es + p.proj_assists_pp)
                 + (p.proj_goals_pp + p.proj_assists_pp) + 0.2 * (p.proj_shots_es + p.proj_shots_pp)
                 + 0.2 * p.proj_hits + 0.25 * p.proj_blocks)::numeric, 3)          as mean_fp,
       round((sum(p.proj_assists_pp) / nullif(sum(p.proj_goals_pp), 0))::numeric, 2) as pp_a_per_pp_g,
       count(*) filter (where p.proj_hits = 0)   as zero_hits,
       count(*) filter (where p.proj_blocks = 0) as zero_blocks,
       round(avg(p.proj_hits)::numeric, 3)   as mean_hits,
       round(avg(p.proj_blocks)::numeric, 3) as mean_blocks
from public.forge_runs r
join public.forge_player_projections p on p.run_id = r.run_id
where r.status = 'succeeded'
  and r.as_of_date between '2026-10-18' and '2026-10-22'
  and p.horizon_games = 1
group by 1, 2
order by 1, 2;
```

**How to read them:**
- **Q1:** GA should be −1, SV 0.2, W 4, SHO 3, G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25.
- **Q2:** gives the shorthanded share of goals and assists for F5.
- **Q3 and Q4:** replace the backtest with what was actually served.
- **Q5:** shows whether F3's null rates are a production problem or a reconstruction artefact.
- **Q6:** checks F2 on production rows (≈0.9 means PP assists are still halved).

## Appendix B: method

- **Extraction:** `scripts/extract.py` reads the captures in `…/0ab9b1ac…/scratchpad/recon/out/{a,b,a0,b0}`. It keeps the h1 `forge_player_projections` upserts, the `players` positions and the latest ev rolling row, and joins them to `cohort/s3_actuals.json`, `s9_hits_blocks.json` and `s5_pp_actuals.json`. It keeps player-games present in all four variants and with an actual row: 2,074, matching the 10-21 report.
- **Analysis:** `analyze.py`, `analyze2.py`, `multipliers.py`, `bootstrap.py` (game-clustered, 2,000 reps, seed 1). Outputs are in `analysis-out*.txt`.
- **Goalie check:** per game, P(win) summed across the two teams' `forge_goalie_projections` rows in the same captures.
- **Not run:** tests, tsc, any production read. The production flag value comes from a diary note, not a direct read.
