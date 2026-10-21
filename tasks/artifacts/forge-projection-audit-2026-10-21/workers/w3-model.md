# W3 — FORGE v2 projection model: accuracy levers and runtime hotspots

Read-only audit, 2026-10-21, `octoberBranch` working tree (uncommitted sibling edits present; line numbers are from the current tree). No tests, builds, DB or HTTP calls were made. Nothing below is empirically verified against production rows; "hypothesis" means a code-level mechanism that a fixture would confirm.

Prior evidence reused (not redone): MASTER-TASKLIST F3/F5/F6/F7/F8/F11/S1, CONSOLIDATED-CHECKPOINTS §C, sibling notes `forge-hits-blocks-zeros-2026-10-19.md` and `forge-skater-pool-coverage-2026-10-19.md`.

Scoring context (TJ's Yahoo league): G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25; goalie W 4, GA −1, SV 0.2, SHO 3. So goal/assist heads and goalie W dominate; a 5% error on goals is worth ~25x a 5% error on SOG per unit.

---

## 0. Pipeline shape (for orientation)

`run-projection-v2.ts:963` parses `horizonGames` (1..10, default 1) → `runProjectionV2ForDate` (`run-forge-projections.ts:414`) → `runProjectionCalculations` → per slate game (`:837`): `hasCompleteStoredPbpGame`, `classifyStoredShiftChartStrengthGame`, `runPerGameSkaterStage` (`skater-stage.ts:1235`, both teams), `runPerGameGoalieStage` (`goalie-stage.ts:100`, both goalie candidates), then game-level market flags and `persistPerGameAnalyticsOutputs` (`run-forge-projections.ts:1118`).

Skater pipeline per player (all in `skater-stage.ts:1983–2318`, then team passes `:2321–2611`, then row assembly `:2625–3134`):

```
TOI(last5|all|700) --blend WGO deployment prior--> x rest.toi --> shrink(sampleWeight) --> role bounds
SOG/60(last5|all|6) x shotQuality x onIce x teamLevel x rest --> shrink(sampleWeight -> 6) --> role SOG cap
shots = TOI x SOG/60 / 3600  x availability x trend
goalRate = alignedPairs(last5,all) Bayes-blend x [shotQuality x onIce x teamLevel x oppGoalie x rest]  --> shrink(sampleWeight -> 0.095) x trend
assistRate (per goal) = alignedPairs x [onIce x teamLevel x oppGoalie x rest] --> shrink --> x trend --> x teammateCoupling
team pass: PP TOI reallocated to team PP target (shots rescaled), team TOI/shots reconciled to forge_team_game_strength averages
goals = reconciledShots x goalRate ; assists = goals x assistRate ; (candidate mode: role-scenario blend)
hits/blocks = (toiEs+toiPp) x physicalToiMultiplier x rate/60 ; optional season bootstrap ; x horizon total scalar ; null-mask unsupported heads
```

---

## 1. Adjustment inventory

### 1a. Skater heads

| # | Head | Adjustment | Where | Inputs | Shrinkage / prior | Clamp | Double-count / notes |
|---|---|---|---|---|---|---|---|
| T1 | TOI | Base: `toi_seconds_avg_last5` → `toi_seconds_avg_all` → 700/120 | `skater-stage.ts:2001–2008` | rolling EV/PP rows | none on last5 (a 1-game last5 window counts the same as 5) | — | last5 is NST-only at EV/PP (hits-blocks note §1) so often thin or null |
| T2 | TOI | Blend with WGO deployment prior | `:2013–2026`, `blendToiSecondsWithDeploymentPrior:329` | `wgo_skater_stats` latest row | fixed 0.8 rolling / 0.45 if row missing | — | OK; the only owner of deployment |
| T3 | TOI | × rest `toiMultiplier` | `:2027–2036`; `skater-adjustments.ts:348–408` | team/opp rest days, home | none (sampleWeight=1) | [0.88,1.1] | **Rest enters 4 heads** (TOI, shot rate, goal rate, assist rate) → compounds on goals ≈ toi×shot×goal, assists ×assist again. See §1c. |
| T4 | TOI | Sample shrink toward `toi_seconds_avg_all` | `:2054–2067` | `sampleWeight` (F3) | w = 0.58·TOI/(TOI+900) + 0.42·shots/(shots+45) | — | F3: w≈0.7 for any veteran regardless of window thinness; same w reused for SOG and conversion (S3, G4) |
| T5 | TOI | Role usage bounds | `:2130–2146`; `applyRoleSpecificUsageBounds:1113` | role tag (line combos / roster events) | — | TOP ES 780–1500, PP 120–560; MIDDLE 560–1180 / 40–360; DEPTH 260–940 / 0–190 | Fine as guardrail; forces a TOP-tagged player to ≥120 s PP even with no PP history |
| T6 | TOI | × availability (event × recency × roleStability) | `:2251–2277` | roster events, days since metric, role continuity | — | roleStability from `computeSkaterRoleStabilityMultiplier:773` | roleStability also feeds scenario probabilities (candidate mode) — a second owner of role volatility |
| T7 | PP TOI | Reallocated to team PP target by role weight × √(toiPp+1) | `:2419–2454`; `allocatePpToiByTeamOpportunity:1000` | ppShare from `forge_team_game_strength` L10 | — | per player ≤1400 s; shot rescale [0.25,4] | Overrides T1–T6 for PP; individual PP history matters only via √; role weight dominates |
| T8 | TOI/shots | Team reconciliation to 5·3600 s and L10 team shots | `:2521–2611`; `reconcile.ts:97` | `fetchTeamStrengthAverages` | — | proportional scale; validation blends 40% toward baseline only if top share >0.24 ES / 0.58 PP | See §3 |
| S1 | SOG/60 | Base: `sog_per_60_last5` → `_all` → 6 (EV) / 8 (PP) | `:2085–2112` | rolling rows | none on last5 | — | thin-window input used raw (F3-adjacent) |
| S2 | SOG/60 | × shotQuality.shotRate × onIce.shotEnv × teamLevel.shotRate × rest.shotRate | `:2113–2135` | NST ixG/shot, rush+rebound; on-ice xGF/xGA/CF%; team xGF, opp xGA, pace, PDO; rest | each has its own "sampleWeight" (see §1c) | [0.82,1.2]·[0.86,1.16]·[0.86,1.18]·[0.86,1.14] → combined up to ×1.78 before the outer clamp [1.5,20] | **xGF signal enters S2, G2 and A2** (three heads) |
| S3 | SOG/60 | Sample shrink toward 6/8 | `:2113–2135` | sampleWeight | same w as T4 | [1.5,20] / [2,28] | — |
| S4 | SOG/60 | Role SOG cap | `:2130–2146` | role tier | — | TOP 15/21, MIDDLE 11.5/17, DEPTH 8.2/13 | — |
| S5 | shots | × availability × trend.shotRate | `:2285–2286` | `sustainability_trend_bands` (fantasy_score first) | trend's own n_eff/confidence | — | `fantasy_score` trend applied to shots, goals and assists simultaneously (S5, G5, A5) |
| S6 | shotsPp | × PP allocation ratio | `:2443–2447` | T7 | — | [0.25,4] | — |
| S7 | shots | Team reconciliation | `:2551–2611` | T8 | — | unbounded scale (`reconcile.ts:78`) | **Scale is global per team-strength**: players with inflated thin-window rates take a disproportionate share (§2) |
| G1 | goal/shot | Bayesian blend recent vs all with adaptive prior | `skater-adjustments.ts:528–640`, `computeSupportedStrengthSplitConversionRates:641` | aligned NST pair support (`aligned_count_support`) | priorStrength EV 12–72 (base 42, scale 70), PP 9–54; fallback 0.095 / 0.145 | [0.025,0.24] EV, [0.04,0.36] PP | Null when no aligned pair (F6/A-08, ~35% rows) |
| G2 | goal/shot | × shotQuality.goal × onIce.goalEnv × teamLevel.goal × oppGoalie.goal × rest.goal | `:2167–2176` | as S2 + `goalie_start_projections` GSAA + opp 5v5 save% | each own sampleWeight | product clamp [0.02,0.3]; component clamps [0.78,1.3]·[0.84,1.2]·[0.82,1.2]·[0.82,1.22]·[0.85,1.16] → ≤×2.4 pre-clamp | **Opponent goaltending enters twice**: `opponentSaveEdge*2.3` (team 5v5 SV%, `skater-adjustments.ts:280`) and oppGoalie GSAA (`:302–346`) |
| G3 | goal/shot | Second shrink toward 0.095/0.145 by sampleWeight | `:2186–2195` | sampleWeight | **double shrinkage**: G1 already shrinks via priorStrength; G3 shrinks again toward the same constant | [0.025,0.3] | For a veteran w≈0.7 this pulls a 0.14 shooter to 0.127 regardless of career shots — a systematic star-compression on G (3 pts) |
| G4 | goal/shot | × trend.goalRate | `:2287` | S5 | — | [0.025,0.3] | — |
| G5 | goals | Scenario blend (candidate mode only; default `baseline`, `skaterRollout.ts:17`) | `:2628–2650`; `scenario-blending.ts:134–270`, `:45–70`; `buildSkaterRoleScenarios:806` | role continuity | — | role mult [0.82,1.2] goal, [0.8,1.24] assist | **Scenarios are only downward** (`adjacentRole:794` = n+1, depth = L4/D3): an L1 at default continuity gets ≈0.966 on G/A, an L4 gets 1.0. Inert today; a known trap if candidate is turned on. |
| G6 | goals/shots | Season bootstrap blend with last-season + public fantasy per-game | `:2666–2677`; `seasonBootstrap.ts:95–153` | `skatersGameStats`, projection sources | progress = games/transitionGames | — | Gated: compute flag && h=1 && no decisionAsOf && env (`run-forge-projections.ts:434`). When on, **re-multiplies teamLevel×oppGoalie×rest goal multipliers onto the prior** (`:2669–2671`) which the organic line already carries → double application. |
| A1 | assist/goal | Bayesian blend, denominators = 2×goals | `skater-adjustments.ts:575–601` | aligned pairs | prior 8–40 / 6–30; fallback 0.72 / 0.95 | [0.2,1.45] / [0.3,1.8] | null without pair |
| A2 | assist/goal | × onIce.assistEnv × teamLevel.assist × oppGoalie.assist × rest.assist | `:2177–2182` | as above | — | ≤×1.9 pre-clamp; clamp [0.2,1.7]/[0.3,2] | assists = goals × rate, so **every goal multiplier also multiplies assists**, then A2 adds its own copies of the same signals (xGF, opp defense, rest, opp goalie) |
| A3 | assist/goal | Second shrink toward 0.72/0.95 | `:2191–2200` | sampleWeight | double shrinkage as G3 | — | — |
| A4 | assist/goal | × teammate coupling | `:2473–2505`; `computeTeammateAssistCoupling:1053` | line-group ES shots share, PP TOI share | — | [0.82,1.2] ES, [0.8,1.24] PP | Uses already-adjusted shots; PP share after T7 so role weight leaks in again |
| A5 | assist/goal | × trend.assistRate | `:2288` | S5 | — | — | — |
| PP | PP heads | PP goals/assists = shotsPp × goalRatePp × assistRatePp; withheld (null) without aligned PP pair | `applySupportedSkaterConversionHeads:684` | F6 | — | — | PPP exported only when both goals_pp and assists_pp present (`:3100–3105`) |
| H1 | hits/blocks | All-strength row, last5 blended with 3-season baseline shrunk to F/D prior, league rescale | `computeSkaterPhysicalEventRates:454` | `all` rolling row; `forge_league_skater_physical_totals` RPC (migration 88, may be absent → scale 1) | KR 240/1000 min, KP 50/300 min; league scale [0.7,1.3] | — | F5. Only head with a real sample-size-based shrink. |
| H2 | hits/blocks | × (toiEs+toiPp) × physicalToiMultiplier | `:2663–2665` | `toi_seconds_avg_last5` (all) / (toiEs+toiPp) raw | — | [1,1.3] | Ratio computed on raw TOI (`:2157`) but applied to reconciled TOI; PK time still not projected |

### 1b. Goalie heads (`goalie-stage.ts`, `goalieModel.ts`, `goalie-starter.ts`)

| # | Head | Adjustment | Where | Inputs | Shrinkage | Clamp | Notes |
|---|---|---|---|---|---|---|---|
| P1 | start prob | Override from board evidence (`goalieOverrideByTeamId`) | `goalie-stage.ts:354–372` | `forge_roster_events` via preflight | — | — | starterProb may be 1 |
| P2 | start prob | Heuristic logit score: 2.4·(L10 share−0.5) + 0.7·logit(prior) + 0.45·logit(lineCombo prior) + 0.5·GSAA/60 + 0.28·(seasonStartPct−0.5)·w + 0.2·w ± B2B/weak-opp/stale terms | `computeStarterProbabilities:126–243` | `forge_goalie_game` L10 starts (`fetchTeamGoalieStarterContext:86`), `goalie_start_projections` prior/GSAA/season pct (`skater-stage.ts:3297–3372`), `lineCombinations` goalies | seasonGamesWeight g/(g+10) | 2-goalie sigmoid [0.02,0.98]; softmax otherwise | **Prior from `goalie_start_projections` already encodes L10 share / season pct / B2B** (its columns l10_start_pct, season_start_pct) and FORGE adds the same features again → double counting of the same evidence; B2B_REPEAT_STARTER_PENALTY 2.75 is a near-hard rule |
| SA1 | shots against | 0.65·opponent FORGE team shots + 0.35·team L10 SA + 0.25·(SA5−SA10) | `goalie-stage.ts:271–285` | `teamShotsByTeamId` (skater stage output), `forge_goalie_game` | — | trend [−3,3] | opponent FORGE shots already carry teamLevel (opp xGA = this team's defense) |
| SA2 | shots against | × (1 + teamStrength.shotsAgainstPct) | `:286–290`; `team-context-adjustments.ts:30–101` | `nhl_team_data`/in-house xG: defending xGA, opp xGF | sampleWeight (xga)/280 | ±9% | opponent offense (xGF) now entered via SA1 (FORGE shots) and SA2 |
| SA3 | shots against | × (1 + contextPct); contextPct = 0.45·oppShots5 trend + 0.35·oppGoals5 trend + rest (opp ≥2: +0.03; opp B2B: −0.04; own B2B: +0.02) + home ±0.02/0.01 + 5v5 ctx + NST danger | `:313–343` | `forge_team_game_strength` L10/L5, rest days, `wgo_team_stats`, `nst_team_*` | 5v5: g/(g+8); NST: g/(g+30) | contextPct [−0.15,0.2] | opp 5-game goals trend is a third owner of opponent offense; NST xGA (defending) is another owner of own defense alongside SA2's xGA |
| SV1 | save% | leagueSavePct = 0.9 − 0.04·contextPct + 5v5 leagueSavePctAdj | `:345–350` | same contextPct | — | [0.88,0.92] | **Same contextPct raises SA and lowers SV%** → GA double-penalised for the same opponent-strength signal |
| SV2 | save% | − workload penalty (5 starts/14d: 0.025; 6+: 0.04; goalie B2B: 0.03) + rest-split adj | `:506–516`; `goalie-save-pct-context.ts:15–85` | `forge_goalie_game` L30, `wgo_goalie_stats` splits | rest split g/(g+6) | [0.86,0.92]; rest ±0.012 | F11 |
| SV3 | save% | Posterior: career→season→recent anchors, league prior 350–1250 shots | `goalieModel.ts:128–165` | `fetchGoalieEvidence` L20/season/L200 | multi-layer | [0.85,0.94] | Sound; "recent" (20 starts) and "season" overlap heavily early in the season (same rows) |
| GA/SV | GA = SA×(1−SV), saves = SA−GA | `goalieModel.ts:166–167` | — | — | — | Coherent by construction |
| W | win | logistic((GF−GA)/1.25) × starterProb; GF = team FORGE goals × (1+teamStrength.teamGoalsForPct) | `goalieModel.ts:193–194`; `goalie-stage.ts:351–357` | `teamGoalsByTeamId` (sum of player goal heads) | — | — | **GF is null whenever any player row has a null goal head** (`nativeGoalAccounting.ts:134–138`, `skater-stage.ts:3292`) → `proj_win_prob` null (W = 4 pts missing). With ~35% null-head rows (F6), most teams likely hit this. Not verified against rows. |
| SHO | shutout | exp(−GA) × starterProb | `goalieModel.ts:195–196` | — | — | — | Poisson zero; OK |
| BL | top-2 blend | Per-scenario full-start models blended by top-2 normalised prob; residual mass to selected goalie | `:519–652`; `blendTopStarterScenarioOutputs:27` | — | — | — | — |
| HZ | horizon | all heads × Σ goalieHorizonScalars (mean of both teams' scalars) | `:706–760` | `games` dates | — | — | **`proj_win_prob` × Σscalars** (≈4.7 at h=5) turns a probability column into expected wins; `starter_probability` is not scaled |

Null handling (goalie): missing opponent FORGE shots → goalie skipped, no row (`:171–177`); missing `forge_goalie_game` evidence → sums 0 → `safeRate` falls to league (`goalieModel.ts:47`); GF null → W null preserved; `goalie_start_projections` missing → prior 0.5 for all candidates.

### 1c. Thin-window inputs used without a real sample-size shrink (beyond hits/blocks)

- `toi_seconds_avg_last5`, `sog_per_60_last5` (`skater-stage.ts:2001, 2085`): a last5 "window" with one NST game is treated like five. Hits-blocks note §1 shows the same mechanism for shots/goals/assists.
- `computeSkaterShotQualityAdjustments` `sampleWeight = shots/60 / (shots/60 + 5)` (`skater-adjustments.ts:104`) is a **rate**, not a count: a 10 SOG/60 player gets w=0.67 off one game.
- `computeSkaterOnIceContextAdjustments` `sampleWeight = (xGF/60 + xGA/60)/(…+2.5)` (`:171`): again a rate magnitude, not games.
- `computeSkaterRestScheduleAdjustments` `sampleWeight: 1` always (`:395`).
- F3 `sampleWeight` (`:410–443`) is the only skater-wide shrink and it is window-blind.
- Goalie `fetchGoalieEvidence` recent = last 20 appearances; early-season "season" ⊂ "recent", so the three anchors are not independent.

### 1d. Rest convention mismatch (confirms F8)

`fetchTeamRestDays` returns `daysBetweenDates(asOf, previous)` so a back-to-back is **1**. Skater `computeSkaterRestScheduleAdjustments` treats `teamRest <= 0` as the heavy fatigue tier (0.11) and `=== 1` as mild (0.035) (`skater-adjustments.ts:372–374`); 0 is unreachable (same-day game). Goalie stage treats `=== 1` as B2B (`goalie-stage.ts:331–334`, `goalie-starter.ts:162–165`, workload `isGoalieBackToBack: daysSinceLastStart === 1`). So skaters on a B2B get ~1/3 of the intended penalty and the "opponent on B2B" boost (`oppRest <= 0 ? 0.055 : 0.018`) is likewise mostly unreachable. Any later recalibration must fix the scale first.

---

## 2. Larkin/Wood shot/goal anomaly — mechanism and fixture

**Goals are not an independent head.** `baseGoalsEs = shotsEs * p.goalRateEs` (`skater-stage.ts:2628–2631`) where `shotsEs` is the **team-reconciled** shot count and `goalRateEs` is the conversion rate from §1 G1–G4. Assists = goals × rate. So per player G/S is always exactly `goalRate`; a "disagreement" means the shot count and the conversion rate come from different evidence frames:

1. **Shots from a thin/absent recent window, conversion from the history-wide pair.** `sog_per_60_last5` is NST-only at EV/PP; with 74% of 2026-27 skater-games missing (hits-blocks note), the last5 is either (a) 1–2 early-October games (volatile rate, used raw, capped only by role tier at 15/21 per 60), or (b) null → `sog_per_60_all` (history-wide up to 1 year, `skater-queries.ts:196–216`). Meanwhile the conversion blend uses `all.denominator` (shots) with a prior of 12–72 shots so it is stable. A player in case (a) with 5 SOG in 11 ES minutes projects ~27 SOG/60 → capped 15 → 3.6 ES shots on 860 s, times a normal 9.5% rate → goals also 1.6× normal. Wood-type "too high on both" fits (a); Larkin-type fits (b) plus (3).
2. **Team reconciliation redistributes shots to inflated rates.** `reconcileFloatTotalByWeight` (`reconcile.ts:76–81`) scales all players by one factor to hit the team's L10 official shots; because the share is proportional to each player's pre-reconciliation shots, case-(a) players take a larger share and case-(b) players a smaller one. Conversion rates are not re-derived after reconciliation, so a player whose shots were cut 20% keeps the same G/S → goals cut 20% too, while another player's goals rise — the team goal total floats with the shot redistribution.
3. **PP shots present, PP goals null.** When the PP row has no aligned pair, `proj_shots_pp > 0` but `proj_goals_pp`/`proj_assists_pp` are null (`applySupportedSkaterConversionHeads:684–723`). A reader summing shots (0.2 pts) but seeing null goals sees "lots of shots, few goals"; the RSO bridge drops the row entirely (pool-coverage note cause A). Larkin had no 2026-27 NST row at all (hits-blocks note §1) so his EV/PP support is from 2025-26 or absent.
4. **PP reallocation scales PP shots but not the conversion** (`:2443–2447`, clamp [0.25,4]): a TOP-tagged player whose own PP TOI history is small gets 4× the PP shots at his thin-window PP goal rate.
5. **Trend band on `fantasy_score` multiplies shots and goal rate and assist rate** (`:2285–2288`), so one hot/cold trend compounds ≈ cubically into points.
6. **Double shrink on conversion only** (G3): shots are shrunk once (toward 6/8), the goal rate twice (G1 prior + G3 toward 0.095). High-conversion stars therefore see goals compressed relative to shots: Larkin at a true ~13% ES conversion → after G1 (prior 42 → maybe 12.5%) → after G3 with w=0.7 → 11.6%. This is a systematic bias, not a per-player anomaly, but it shows up exactly as "shots fine, goals low".

**Fixture to confirm (not verified):** a pure-function test using `computeSkaterSampleShrinkageAdjustments`, `computeSupportedStrengthSplitConversionRates`, `applyRoleSpecificUsageBounds`, `computeShotsFromRate` and `reconcileTeamToPlayers` with three players on one team:
- A: `sog_per_60_last5 = 27`, `toi_seconds_avg_last5 = 660`, `shots_total_all = 420`, aligned pair all 420/40, last5 11/1;
- B: identical `all` fields, `sog_per_60_last5 = null`, last5 pair null;
- C: `pp` row absent, `ev` as B.
Assert: A.shots/B.shots ≈ cap ratio (15/√…) before reconciliation; after reconciliation to a 28-shot team target, A still carries >1.6× B; C has `proj_shots_pp > 0` and `proj_goals_pp === null`. A second assertion freezes G3: for `goalRateEs` from pairs = 0.13 with w=0.7, the persisted rate is 0.1195 (i.e. the second shrink alone costs 8% of goals). Nearest home: `web/lib/projections/runProjectionV2.test.ts` ("strength-split conversion rates" block at :915). A stage-level harness would need `supabase` mocked; `run-forge-projections.local-attempt.test.ts` shows the pattern.

---

## 3. Team reconciliation / scenario blending

- **What is normalised:** per team and game, ES TOI and PP TOI to a fixed 18,000 s total split by the team's L10 PP share (`skater-stage.ts:2321–2416`; integer apportionment in `reconcile.ts:119–131`), and ES/PP shots to the team's L10 average official shots from `forge_team_game_strength` (`:2527–2560`, fallback = model sum). Goals and assists are **not** normalised to a team total; they float as Σ shots×rate. The pool guard (`computeSkaterTeamToiTargetWithPoolGuard`, `scenario-blending.ts:421–480`) only caps the TOI target when <15 skaters are projected.
- **Effect on stars vs depth:** TOI reconciliation is proportional so it preserves relative TOI; `validateReconciledPlayerDistribution` (`scenario-blending.ts:296–419`) blends 40% toward the pre-reconciliation vector only when one skater exceeds 24% of ES TOI (= 17.3 of 72 min at 5 skaters; normal 1D ≈ 25%) or 58% of PP TOI — so top-pair D on heavy minutes are routinely trimmed and the trim is spread to everyone. PP reallocation (T7) replaces individual PP TOI with a role-weighted share: PP1 quarterbacks and PP2 flex players converge toward tier means, the single biggest driver of PPP (1 pt) compression for elite PP players, especially when a `ppEventByPlayer` role tag is missing and the ES line role stands in (`:2425`).
- **Shots reconciliation** is a pure team-level scale with no clamp; the team target is official NHL SOG while player rates are NST-window driven. When most of a team's players sit on thin or history-only windows the scale can be far from 1 and `toi_scale_*` metrics record only the TOI side.
- **Scenario blending** is inert in `baseline` mode (default). In `candidate` mode it blends role scenarios that are always current-or-lower (§1 G5), multiplied by horizon reversion toward uniform (0.18/game, `scenario-blending.ts:179–186`): stars lose 3–4% G/A at h=1 and more at h=5, depth players gain nothing. If candidate mode is ever enabled, this is a built-in star tax with no calibration evidence.
- **Goalie-side team xG entries:** `fetchTeamStrengthPrior` (xGF/xGA per game from `nhl_team_data` / in-house aggregates) enters (i) skater teamLevel multipliers (own xGF, opp xGA), (ii) goalie SA via `shotsAgainstPctAdjustment` (own xGA, opp xGF), (iii) GF/opp-GF for the win logistic and the weaker/weak-opponent starter flags (`goalie-stage.ts:351–357, 379–396`). NST team xGA/60 enters skater pace proxy and goalie `nstOpponentDangerAdjustment`. So opponent offensive strength reaches GA through the opponent's FORGE shots (already xG-adjusted), SA2, SA3 (5-game trends) and SV1, four overlapping routes with independent weights.

---

## 4. Goalie path summary

- **Start probability:** override → else heuristic logit (§1 P2) seeded with `goalie_start_projections` (`skater-stage.ts:3297–3372`), line-combo goalie prior (`fetchTeamLineComboGoaliePrior`), L10 starts from `forge_goalie_game`. Two-goalie case is a sigmoid of score difference; B2B repeat penalty 2.75 ≈ 94% swing by itself. Candidates limited to 3 (`selectStarterCandidateGoalieIds:76`), current-team filter and 75-day stale gate.
- **Wins:** not market-based. `logistic((GF − GA)/1.25) × starterProb` with GF = own FORGE goal sum (null-propagating) and GA = SA×(1−SV). Market totals/spreads are only used for `model_market_flags_daily` (`run-forge-projections.ts:1000–1075`), never as inputs.
- **Saves/GA coherence:** yes by construction (SA − GA). Season bootstrap (goalie) preserves today's SA and rescales saves/GA by the blended ratio (`seasonBootstrap.ts:155–166`).
- **Shutout:** `exp(−GA) × starterProb`.
- **Nulls:** GF null → W null (kept); opponent shots missing → no goalie row at all; evidence missing → league rates; prior missing → 0.5. The GF null case is the material one (see risk R1).

---

## 5. Horizon: `horizonGames=1` vs `=5`

- One row per (run, game, player, horizon) in all three tables (`persistence-stage.ts:11–40` upsert keys). A h=5 run writes **one aggregated row per player for the slate game**, not five per-game rows; `game_id` is today's game.
- All count heads (TOI, shots, goals, assists, hits, blocks; goalie SA/GA/saves/shutout/**win prob**) are multiplied by `teamHorizonTotalScalar = Σ scalars` where scalars come only from the team's next N `games` dates: `1 − 0.015·i`, −0.12 if two games same date, −0.08 if B2B, +0.03 if ≥3 days rest, clamped [0.75,1.08] (`date-utils.ts:41–67`; `skater-stage.ts:1176–1197`). Goalie scalars average both teams' (`goalie-stage.ts:706–718`).
- **Not re-aimed.** Opponent, opponent goalie, rest, home/away, line combos, trend, PP target — everything is game-1 context (`skater-stage.ts:1700–1850`). A h=5 projection is "today's matchup × ~4.7". `starter_probability` stays game-1's. Uncertainty bands scale with `effectiveHorizon` (`uncertainty.ts:161, 439, 574`).
- Season bootstrap, issued-context capture and daily-board confirmation only run at h=1 (`run-forge-projections.ts:433–434`, `goalie-stage.ts:466–470`).
- Accuracy backtest reads only `horizon_games = 1` (`run-projection-accuracy.ts:1701, 2014`); h>1 rows have no evaluation.

---

## 6. Runtime hotspots (12-game slate, 24 teams, ~18 skaters/team, 2 goalies/team)

Per-run constants: preflight ~6 queries (`preflight-stage.ts`), run lifecycle writes.

Per game (`run-forge-projections.ts:850–860, 1118`): `pbp_games` + plays read, shift-chart classification, 5 analytics write/delete calls → ~8 × 12 = **~96**.

Per team (skater stage, all awaited **sequentially**, no `Promise.all`, `skater-stage.ts:1347–1900`):
- line combo (2 queries via `fetchRecentTeamLineCombinations`), horizon scalars (h>1 only), `rosters`, `players` meta, `rolling_player_game_metrics` ×3 strength states each **plus** the support-payload sidecar ×3 (`fetchRollingRows:208–318`; 6 paged reads of up to 500 rows each with `count: "exact"` and full-JSON `support_payload` hydration for every row of the last **365 days** per player — ~80 rows × 18 players × 2 tables × 3 states ≈ 8,600 rows and ~4 pages per state), recency `games` by id, league physical RPC (cached per run), team strength prior ×2 (cached by team-date, so ~24 unique), 5v5 profile ×2, NST xG ×2, opponent goalie context (`goalie_start_projections`), rest ×2, WGO deployment (`limit 5000`), `player_stats_unified` (`limit 5000`), `sustainability_trend_bands` (`limit 12000`), role history, team strength averages, `goalie_start_projections` again (`:3297`), latest goalie, starter context (2), current goalie ids, line-combo goalie prior, 2 upserts.
- Estimate: ~30 queries per team incl. ~8 paged rolling reads → **~720 queries, ~200k rows hydrated** per slate, dominated by the rolling+sidecar pairs (the sidecar JSON is the F7 "support payload" and is read whole, then only `historicalCompatibility` and `alignedCountSupport` keys are used).
- Caches are keyed `team:asOfDate` and live across games within a run (strength prior, 5v5, NST, rest, defensive env) but `fetchLatestLineCombinationForTeam`, `fetchRollingRows`, deployment/context/trend reads are **not** cached and are per team-game — fine for one slate (each team plays once) but the `goalie_start_projections` read happens twice per team (`:1815` opponent context and `:3297` own), and `fetchTeamGoalieStarterContext`/`fetchCurrentTeamGoalieIds` are fetched in the skater stage and again guarded in the goalie stage (cache hit, OK).

Per goalie candidate (goalie stage, `goalie-stage.ts:164–560`): `fetchGoalieEvidence` = 4 parallel queries (L20, season ≤120, L200, WGO) per goalie, workload (L30), rest split (`wgo_goalie_stats`), repeated for each top-2/board scenario goalie (cached per goalie-date) → ~6–7 queries × ~48 goalies ≈ **~300**. `loadSeasonBootstrap` (when on) pages `skatersGameStats`/`goaliesGameStats` with a `games!inner` join across two seasons per team.

Serialization: each player row carries a large `uncertainty` JSON (`skater-stage.ts:2740–3045`: holdout baselines, scenario metadata, every multiplier, source rows), upserted 18 at a time; the goalie row embeds `daily_board_candidates`. The RSO bridge later re-reads these payloads (pool-coverage note: 1.93 MB snapshot).

Top 3 hotspots: (1) `fetchRollingRows` ×3 states + sidecar per team with 365-day span and exact counts; (2) sequential per-team awaits for ~30 context reads (no batching across the two teams of a game, no `Promise.all` of independent reads); (3) goalie evidence fan-out (4 queries per goalie, 2–3 goalies per team, both stages) plus per-game analytics deletes/inserts.

---

## 7. Hand-set constants and calibration evidence

`projection-weights.ts` holds ~130 constants. Those with the most leverage on G/A/PPP:

| Constant group | Values | Calibration evidence in repo |
|---|---|---|
| Fixed conversion priors 0.095 / 0.145 (G/S), 0.72 / 0.95 (A/G) | `skater-adjustments.ts:593–631`, `skater-stage.ts:2186–2200`, `:2680–2683` | none; also exported as `naive_prior` baseline in uncertainty (`:2763–2776`) and compared by the accuracy route (`run-projection-accuracy.ts:1924–1928`) — i.e. the backtest can show whether the learned heads beat them, but no fit of the values |
| Prior strengths 42/26/22/16 with 0.35+1.35·shrink and bounds | `:538–573` | none |
| F3 sampleWeight scales 900 s / 45 shots, 58/42 | `projection-weights.ts:87–88` | F3 checkpoint: 10 algebraic checks, no empirical fit |
| Shot-quality / on-ice / team-level / opp-goalie / rest coefficients (0.05, 0.26, 0.14, 0.18, 0.2, 2.3, 0.18, 0.11, …) and their [min,max] clamps | `skater-adjustments.ts:76–408`; weights `:50–85` | unit tests of sign/neutrality only (`runProjectionV2.test.ts:490–760`); no fit, no held-out attribution (F8 open) |
| Role usage bounds, SOG caps, RECON shares, RECON_BLEND 0.4 | `projection-weights.ts:107–129` | none |
| PP role weights (`roleBasedPpShareWeight:993`), √ opportunity | `skater-stage.ts:993–1043` | one allocation test (`:1014`) |
| Teammate coupling 1.65, 0.62, 0.75, offsets 0.14/0.18 | `skater-stage.ts:1053–1112` | none |
| Trend multipliers (external `sustainability_trend_bands`) | `fetchLatestSkaterTrendAdjustments` | S1 lane; none here |
| Scenario multipliers 0.07/0.09 per rank, reversion 0.18 | `scenario-blending.ts:45–70`, `projection-weights.ts:130–131` | none (inert by default) |
| Hits/blocks priors, KP, KR, league shrink | `projection-weights.ts:89–106` | **yes**: Poisson-deviance fit on games 2–30 of 2024-25/2025-26 (comment `:89–94`, checkpoint §C) |
| Goalie: starter score weights 2.4/0.7/0.45/0.5/0.28/0.2, B2B 2.75/0.65, stale −6/−3 | `goalie-starter.ts:177–211`, `projection-weights.ts:11–23` | behaviour tests only (`runProjectionV2.test.ts:99–265`) |
| Goalie SV% layers (900/300 shot scales, 1100 prior, 0.6/0.4 penalties), win scale 1.25 | `goalieModel.ts:128–194` | 5 tests in `goalieModel.test.ts`; no fit |
| Horizon decay/penalties | `projection-weights.ts:47–51` | none; h>1 rows are never backtested |
| Goalie context 0.45/0.35/0.03/0.04/0.02, −0.04 SV% per contextPct | `goalie-stage.ts:323–350`, `projection-weights.ts:26–30` | none |

Existing evaluator: `run-projection-accuracy.ts` scores h=1 skater/goalie fantasy points vs `wgo_skater_stats`/`goalie_stats_unified`, with `current_baseline` and `naive_prior` holdout comparisons and `forge_projection_calibration_daily`. `tasks/TASKS/forge-projections/v1/tasks-prd-projection-model.md:238–287` (cited by S1) constrains experiments to baseline-plus-two-challengers.

---

## 8. Top accuracy risks (ranked by league-point exposure)

| # | Risk | Evidence | Category |
|---|---|---|---|
| R1 | Team GF (and so goalie `proj_win_prob`) is null whenever **any** skater row has a null goal head; with ~35% null-head rows most goalie W projections may be null and `teamIsWeaker`/`opponentIsWeak` starter flags disabled | `nativeGoalAccounting.ts:134–138`, `skater-stage.ts:3292`, `goalie-stage.ts:351–357, 379–396`, `goalieModel.ts:193` | Goalie W (4), start prob |
| R2 | Conversion rate is shrunk twice (Bayes prior then F3 `sampleWeight` toward 0.095/0.145) and shots once; systematic compression of high-conversion scorers' G and (via assists = goals×rate) A and PPP | `skater-adjustments.ts:538–631`, `skater-stage.ts:2186–2200` | G, A, PPP |
| R3 | Thin NST windows feed `sog_per_60_last5`/`toi_last5` raw while conversion uses stable history; team shot reconciliation then redistributes shots toward the inflated players (Larkin/Wood mechanism, §2) | `skater-stage.ts:2001–2008, 2085–2135, 2551–2611`; `reconcile.ts:76–81` | SOG, G, A |
| R4 | Same signals stacked across heads: xGF in shot/goal/assist env; opponent goaltending via team 5v5 SV% (×2.3) and opp-goalie GSAA; rest in TOI/shot/goal/assist; `fantasy_score` trend in shots/goal/assist; goalie contextPct in SA and SV%; starter prior re-adds its own features | `skater-adjustments.ts:76–346`, `skater-stage.ts:2113–2182, 2285–2288`, `goalie-stage.ts:313–350`, `goalie-starter.ts:177–211` | G, A, GA |
| R5 | PP TOI reallocation by role weight × √(toiPp+1) and TOP-tier 120 s floor overwrite individual PP usage; PPP for elite PP1 players compressed toward tier means, especially when the PP role tag is missing | `skater-stage.ts:1000–1043, 1113–1175, 2419–2454` | PPP, PP G/A |
| R6 | Skater rest scale is off by one (B2B = 1 hits the mild tier; heavy tier unreachable); goalie side uses 1 = B2B | `skater-adjustments.ts:372–376`; `team-context-queries.ts:456–473`; `goalie-stage.ts:331–334` | G, A, TOI (small) |
| R7 | `proj_win_prob` × Σ horizon scalars at h>1 changes the column's meaning; h>1 rows are never backtested; h>1 is not re-aimed at future opponents | `goalie-stage.ts:755`, `run-projection-accuracy.ts:1701, 2014` | Multi-day RSO decisions |
| R8 | Candidate-mode scenario blend is downward-only (star tax) — latent | `skater-stage.ts:794–868`, `scenario-blending.ts:45–70` | G, A (if enabled) |
| R9 | Season bootstrap re-applies context multipliers to the prior — latent (flag-gated) | `skater-stage.ts:2666–2677` | G, A (if enabled) |

---

## 9. Proposals (lane: Claude; verification = fixture + `run-projection-accuracy` frozen cohort)

### Quick wins (S, low risk)

**Q1. Team GF with partial heads (R1).** In `buildNativeTeamGoalAccounting`, report `reportedEsPpMean` when ≥ k of n contributors have heads and expose `contributorCoverage`; or for the goalie win input only, sum known heads plus the `naive_prior` goals of null-head rows (already computed in `holdout_baselines.naive_prior`) tagged as `prior_filled`. Keep the strict null in the team table if the accounting contract needs it; the goalie stage can take the filled value. Files: `nativeGoalAccounting.ts`, `skater-stage.ts:3286–3294`, `goalie-stage.ts:351`. Verify: fixture with 18 rows, 6 null heads → GF finite, W finite, `uncertainty.model.goals_for_source` recorded; backtest goalie W coverage before/after. Impact: restores W (4 pts) for affected goalies; medium-high. Effort S. Risk: must respect the "no fabricated certainty" policy — tag the fill.

**Q2. Remove the second conversion shrink or make it window-aware (R2).** Drop `(splitRates.goalRateEs ?? 0.095) * w + (1−w)*0.095` at `skater-stage.ts:2186–2200` when `splitRates.*` is non-null (the Bayes prior already shrinks), keeping it only for the fallback path. Verify: fixture asserting a 0.13 pair rate with 400 shots persists as the Bayes value; frozen-cohort backtest on skater G MAE and calibration decile 10 (`forge_projection_calibration_daily`) — expectation: top-decile under-projection narrows. Effort S. Risk: low (pure arithmetic), but it is a model change → Release gate.

**Q3. Rest-days convention (R6).** Change `teamRest <= 0 → 0.11 / === 1 → 0.035` to `=== 1 → 0.11 / === 2 → 0.035` (and the opponent mirror) so the skater stage matches the goalie stage; or centralise a `restBucket()` helper used by both. Verify: extend `runProjectionV2.test.ts:721–760` with explicit `teamRestDays: 1` expecting the heavy tier; backtest B2B-game slice. Effort S. Risk: low; this is a unit fix, not a coefficient tune — but the 0.11 magnitude itself remains uncalibrated (F8), so ship as "consistency fix" and let F8 own the size.

**Q4. Horizon win column (R7).** Persist `proj_win_prob` unscaled and add `proj_expected_wins` (or document the semantics and keep `starter_probability` scaled consistently). Files: `goalie-stage.ts:755`, readers in `forgeDailyBridge.ts`. Verify: fixture h=5 → `proj_win_prob ≤ 1`. Effort S. Risk: reader contract — check bridge consumers first.

**Q5. Dedupe reads (runtime).** Fetch `goalie_start_projections` once per game for both teams and pass to `fetchOpponentGoalieContextForGame`; `Promise.all` the independent per-team context reads at `skater-stage.ts:1745–1860` (strength prior ×2, 5v5 ×2, NST ×2, rest ×2, deployment, context profiles, trend). Effort S. Risk: low; no model change. Verify: query-count assertion in a mocked stage test; wall-clock from `metrics.started_at/finished_at` on a local run.

### Structural (M)

**S1. Window-aware evidence weights (R3, F3).** Add `games_in_window`/`toi_seconds_total_last5` (already present on the `all` row; add for EV/PP if absent) and weight last5 vs all by covered minutes, as `computeSkaterPhysicalEventRates` already does for hits/blocks (KR pattern). Apply to TOI and SOG/60 before any multiplier. Files: `skater-queries.ts` select clause, `skater-stage.ts:2001–2135`, new pure helper in `skater-adjustments.ts`. Verify: F3's fixed-recent/variable-history fixtures; backtest SOG and G MAE on players with <3 NST games in window vs ≥5. Effort M. Risk: medium (touches every skater); gate on backtest.

**S2. Single-owner context multipliers (R4).** Define one multiplier per *effect* (opponent defense, opponent goaltending, own on-ice environment, rest/home, shot quality) and one target head per effect (shots or conversion, not both), with assists inheriting through goals only. Concretely: drop `opponentSaveEdge` from teamLevel goal (keep opp-goalie GSAA), drop xGF from assist env (keep in goal env), apply rest to TOI and shot rate only, apply `fantasy_score` trend to one head. Verify: attribution fixture (each effect toggled alone must move only its head); frozen-cohort backtest with baseline-plus-two-challengers per the PRD evaluator. Effort M. Risk: medium; this is F8's attribution experiment made concrete, not a coefficient tune.

**S3. PP usage: blend individual history with role share (R5).** `allocatePpToiByTeamOpportunity` weight = roleWeight^α × (toiPp)^β with β near 1 for players with ≥N PP games this season, falling back to the current √ when thin; remove the hard 120 s TOP floor when `ppEventByPlayer` says no PP unit. Verify: fixture with PP1 QB 240 s vs PP2 90 s history; backtest PPP calibration for top PP-TOI decile. Effort M. Risk: medium.

**S4. Goalie context single-entry (R4 goalie side).** Let opponent FORGE shots be the only owner of opponent offense (drop `oppShots5`/`oppGoals5` trends and `opponentOffenseEdge` from SA, or drop SA3 and keep SA2); do not feed `contextPct` into SV%. Verify: GA/saves backtest; fixture asserting an opponent-strength change moves SA once. Effort M. Risk: medium.

**S5. Rolling read diet (runtime).** Bound `fetchRollingRows` to the rows actually used (latest row per player per state is what `pickLatestByPlayer` keeps, plus recency dates): select `order game_date desc` with `limit = players × k` or a `distinct on` RPC; read the sidecar only for the kept rows. Files: `skater-queries.ts:179–318`. Effort M. Risk: the exact-count integrity guards (`count_drift`, `duplicate_row`) were added deliberately; keep them on the reduced set. Verify: existing `skater-queries.test.ts`; row-count metric before/after on a local run.

### Not proposed
Tuning any coefficient from the Larkin/Wood anecdotes; enabling candidate mode or season bootstrap; changing null-head policy (A-08 decision belongs to TJ/Chef).

---

## 10. Could not verify

- Any production row values (Larkin/Wood, null-GF frequency, W-null share, reconciliation scale factors): no DB access in this slice.
- Whether `goalie_start_projections` rows exist for the slate games on cron runs (the source route was not inspected).
- Actual query counts/latency (estimates are from code paths, sequential awaits counted once per unique cache key).
- Whether the uncommitted sibling edits in the working tree (git status shows `skater-adjustments.ts`-adjacent files modified by other sessions) match what master runs; line numbers are from the current tree.
- `reconcileFloatTotalByWeight` unbounded scale is confirmed in code; its typical magnitude is not.
