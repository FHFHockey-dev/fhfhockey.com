# W3 cross-check: player-forecasts-season part 4 and part 5 (M-PFC-181 to M-PFC-264)

Fable, 2026-11-11, on `octoberBranch` at `859cfb512`. Read-only: no code changed, no tests run. Paths are under `web/lib/` unless they start with `modeling/` or `web/`. "p1", "p2", "p3" mean `audits/player-forecasts-season-part1.md`, `-part2.md`, `-part3.md`; "Astra W1", "Astra p2", "Astra p3" are the matching peer reviews.

## 0. Brief

- **Question.** These 84 Codex-only records re-describe the TypeScript season evaluator and its helpers at a finer grain. Did the part 1–3 audits and Astra's reviews miss or misjudge anything in that code?
- **What the records are.** 67 are named forecast heads (target-array entries in `fantasy-projections/contracts.ts:26-138`) that all carry one generic description. 17 are functions in `fantasy-projections/` (evaluator, contracts, seasonJobs, settlement) and `player-forecasts/` (gameContract, modeledGoalieParticipation). The prompt's summary of part 5 as "SQL runtime features" does not match the packet: no record resolves to SQL, so `audits/sql-cross-cut.md` adds nothing here.
- **Done when** every record has a verdict or an upstream pointer, and each new point has file:line, reach, fix and test.

## 1. Summary

| Result | Count |
|---|---:|
| Covered upstream, nothing to add | 48 |
| Covered upstream, but a TypeScript twin or reader is missing from the upstream fix list | 20 |
| New: mis-specified | 12 |
| New: wrong (second copy of an upstream "wrong") | 1 |
| New: sound | 3 |

All 67 heads stay empirically undetermined, as upstream: no artifact exists.

**Reach, 2026-11-11.** Exact counts: `player_forecast_season_active_releases`, `_releases`, `_artifacts` and `native_forecast_catalog_heads` all hold 0 rows. The page reader needs an active release (`fantasy-projections/queries.ts:98-121`, traced upstream), so everything under `fantasy-projections/` is dormant. **No P0.** Every finding below is an activation blocker or a missing reader, not a wrong number on screen today.

**Top 5 by user impact at activation**

1. **A second copy of the zero-rewarding skill score is not in any fix list** (M-PFC-259, 258; F7). p2 D2 judged `player-forecasts/settlement.ts:176-180` wrong. The same formula lives in `fantasy-projections/settlement.ts:13-19,41` and scores every season primitive, probabilities included.
2. **Goalie wins, losses, OTL, shutouts and quality starts are scaled by game pace** (M-PFC-182, 184; F1). Both goalies in a fast game gain wins; a shutout becomes more likely as shots rise.
3. **A missing scoring category counts as 0 in the fantasy total** (M-PFC-248; F6), so an incomplete line ranks as if complete (decisions 47, 48).
4. **Bands for points, assists and saves are sums of component bands** (M-PFC-249; F4): 1.28× to 1.73× too wide for a three-part sum, on every per-game line and on v3/v4 season totals.
5. **Players added after the artifact freeze get a line of cohort medians** (M-PFC-254, 255; F8): rare stats become 0, and role "probabilities" of 0.65 are invented constants shown on the player page.

## 2. Per-entry table

Reach: D dormant, C conditional, R research. "Up" = covered upstream.

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| 181 | Up: p1 047, p3 176–178 | `evaluator.ts:321-326` | D | goalie line |
| 182 | Mis-specified (F1) | `evaluator.ts:352` | D | shutouts |
| 183 | Up: p3 176–178 | `evaluator.ts:316-320` | D | GAA denominator |
| 184 | Mis-specified (F1) | `evaluator.ts:352` | D | wins, win % |
| 185, 188–201 | Up: p1 D4 (C17), 003, p2 086; TS twin missing (F2) | `evaluator.ts:229,234,296` | D | v5 advanced lines |
| 186, 187 | Up: p1 009 | `evaluator.ts:192-196` | D | "expected" assists |
| 202–205 | Up: p2 D1 (EN labels; Tier B Q31) | `contracts.ts:81-91` | D | EN points |
| 206–208 | Mis-specified (F5) | `contracts.ts:523-548` | D | EV goals, EV assists |
| 209, 211–214, 229 | Up: p3 168–174 (no artifact) | `evaluator.ts:328-352` | D | fantasy v4 lines |
| 210, 219, 220, 226 | Up: p2 D8 (venue multiplier) | `evaluator.ts:303-305` | D | hits, blocks, TK, GV |
| 215–218 | Up: p2 114, p3 157–158 | `contracts.ts:566-571` | D | PP/SH assists |
| 221, 228, 232, 238 | Up: p2 D1, D4 | `evaluator.ts:316-320` | D | TOI lines |
| 222, 223 | Up: p2 D1, D10 (088) | `contracts.ts:44-45` | D | faceoff % |
| 224 | Up: Astra p3 PR8, p3 D9 | `evaluator.ts:440-479` | D | GP, per-game ratios |
| 225, 230, 231, 233–237 | Up: p2 D2–D4, D8 | `evaluator.ts:328-351` | D | scoring lines |
| 227 | Up: Astra p2 §8 (120), p1 057 | `contracts.ts:39` | D | PIM |
| 239, 240, 244–247 | Up: p1 D4 (team totals), p2 086; description corrected (F3) | `modeling/player_forecasts/advanced.py:2160-2180` | D | team cards |
| 241, 242 | Up: p1 003 (distance band shown as "HD") | `web/pages/fantasy-projections.tsx:759-760` | D | team cards |
| 243 | Sound (label note) | `advanced.py:1285-1290` | D | "Pace / game" = (CF + CA) ÷ 2 per game; state the unit |
| 248 | Mis-specified (F6) | `contracts.ts:799-807` | D | points-league total and sort |
| 249 | Up: p1 056, p3 D12 note; magnitude added (F4) | `contracts.ts:632-634`; `evaluator.ts:365` | D | every non-v5 band |
| 250 | Up: p3 D11, D12, Astra p3 PR9; plus F5 | `contracts.ts:457-626` | D | all derived values |
| 251 | Up: p1 D5, Astra p3 PR8; TS reader missing (F2) | `evaluator.ts:605-669` | D | season totals |
| 252 | Up: p1 006, Astra W1 PR-P2; TS twin missing (F2) | `evaluator.ts:532-603` | D | v5 season bands |
| 253 | Up: p3 176–178, Astra p3 PR8; plus F1, F3 | `evaluator.ts:394-520` | D | every per-game line |
| 254 | Mis-specified (F8) | `fantasy-projections/seasonJobs.ts:158-287` | D | newcomer lines |
| 255 | Mis-specified (F8) | `seasonJobs.ts:109-156` | D | player-page role odds |
| 256 | Mis-specified (F9) | `seasonJobs.ts:428-470` | D | team-card lines |
| 257 | Mis-specified (F7, minor) | `fantasy-projections/settlement.ts:66-79` | D | published-forecast scoring |
| 258 | Mis-specified (F7) | `settlement.ts:21-64` | D | season evaluations |
| 259 | Wrong (F7; twin of p2 066) | `settlement.ts:13-19` | D | season evaluations |
| 260 | Sound | `player-forecasts/gameContract.ts:435-467` | R | none outside the file |
| 261 | Sound | `gameContract.ts:415-432` | R | 260 |
| 262, 263 | Up: p1 D8 with Astra's window correction | `player-forecasts/modeledGoalieParticipation.ts:33-83,145-182` | C | native participation |
| 264 | Mis-specified (F10, label) | `modeledGoalieParticipation.ts:173,212-225` | C | native start receipts |

260 and 261 are the pattern the fixes should copy: a null component keeps the sum null, the ratio is labelled a ratio of expectations, and seconds are converted to minutes explicitly (rule 17).

## 3. Defects (new or extended only)

### F1 · Goalie outcome heads take the pace multiplier (M-PFC-182, 184, 253) · P1 at activation · dormant
- `targetMultiplier` handles TOI, goalie shots and goals against, and skater scoring, then falls through to `contextual × pace × venue` for everything else (`evaluator.ts:352`). For goalies that fall-through covers `WINS_GOALIE`, `LOSSES_GOALIE`, `OTL_GOALIE`, `SHUTOUTS_GOALIE` and `QUALITY_STARTS_GOALIE`. The Python twin is identical (`modeling/player_forecasts/season.py:4090-4138`). p1 047 judged this function but listed only the missing own-defence and PK terms.
- **Why it is wrong.** Pace is √(team pace × opponent pace). A game has one win; pace cannot raise both goalies' win rates. Shutouts move the wrong way: the same game raises shots against (`:321-326`) and the shutout rate together. Opponent strength, the one context that does move wins, is absent.
- **Size (analytic, no artifact).** Pace multipliers 1.08 and 1.04 give 1.06: +6% wins, losses, OTL, shutouts and quality starts for both goalies. Team multipliers are clipped at ±35% upstream (p2 D8), so the worst case is about ±35%.
- **Fix.** Return `contextualMultiplier` only for the five goalie outcome heads in both languages. Decision 38 governs any replacement (fitted, team win ≠ goalie win); decision 46 governs W/L/OTL coherence (p3 D12).
- **Test.** Oriented fixture (rule 15): two teams with pace 1.2; each goalie's conditional wins equal his artifact rate × home/away effect; the two unconditional wins in the game sum to at most 1.

### F2 · Upstream fixes name the Python side only; the TypeScript twins serve the page (20 records) · P1 at activation · dormant
The TypeScript evaluator, not Python, writes `player_forecast_season_game_outputs` and `_player_aggregates` on every roster event (`seasonJobs.ts:1044-1045`). Three upstream defects have unlisted twins here (rule 4):
- **C17 (p1 D4).** `mergeAdvancedSeasonArtifact` sets `variance = max(rate, residual80²)` (`evaluator.ts:234`), the 80% half-width used as a standard deviation. Astra's condition holds: it bites only where the residual dominates, and the DNP atom must be carried.
- **Unknown → 0 (rule 5).** A v5 rate missing from the advanced artifact becomes the policy baseline, then 0 (`:229`); a missing conditional rate becomes 0 (`:447`); a missing variance becomes `|mean|` (`:456`).
- **Independent games (p1 D5) and the 0.65 loading (p1 006, Astra W1 PR-P2).** `aggregateSeasonGames` sums per-game variances (`:627-629`). `correlatedAggregateQuantiles` uses loading 0.65, so pairwise correlation is 0.4225 although the variable is named `correlation` (`:550`); 256 draws; the v5 p50 is a sample median, so it differs from the published mean by noise.
- **Fix.** Add these three sites to the p1 D4, D5 and 006 fix items. **Test.** One frozen artifact evaluated by both languages gives equal means, variances and bands within rounding.

### F3 · The records' shared description is wrong for three groups · P2 · dormant
- **Team heads (239–247)** are not "participation-integrated by the evaluator". TypeScript copies `model_means`, `p10`, `p90` from the Python source rows (`seasonJobs.ts:1066-1085`); the arithmetic is `advanced.py:2160-2180` (p1 D4).
- **Advanced skater heads (185–201)** get no context: `targetMultiplier` returns 1 (`evaluator.ts:289-297`). Sound, but not "context-adjusted".
- **Conditional variance is scaled linearly by the multiplier** (`:454-458`). That is exact for a Poisson variance and understates a calibrated residual variance, which scales with m². At m = 1.2 the SD is 9% low. Minor; fix with F2.

### F4 · Bands of sums are sums of bands (M-PFC-249) · P2 · dormant
- `quantiles()` gives derived targets zero variance (`evaluator.ts:365`, variances hold primitives only), then `reconcileProjectionQuantiles` rebuilds each quantile from that quantile's primitives (`contracts.ts:632-634`). So p10(points) = p10(G) + p10(A1) + p10(A2), which is the comonotonic case. p3 D12 noted the mechanism; no size was given.
- **Size (analytic).** Three equal-variance parts: half-width 3σ against √3σ if independent (1.73× too wide) or 2.35σ at the model's own 0.4225 correlation (1.28×). Affects every per-game band and v3/v4 season bands. v5 season bands reconcile per draw and are not affected.
- EV components are differences of bounds (`p10(G) − p10(PP) − …`), which is not a quantile in either direction.
- **Fix.** Give sums a variance (Σ variances + 2Σ covariances under the stated loading), or use the per-draw path for every contract. Label bands uncalibrated regardless (decision 39). **Test.** Synthetic normal components with known covariance: empirical coverage of the emitted points band within 0.80 ± 0.02.

### F5 · Fitted EV heads are discarded (M-PFC-206–208, 250) · P2 · dormant
`reconcileStrengthFamily` overwrites `EV_GOALS`, `EV_PRIMARY_ASSISTS` and `EV_SECONDARY_ASSISTS` with total − (PP + SH + EN), and zeroes EV when the other three exceed the total (`contracts.ts:523-548`). The three EV heads are declared primitives with their own policies and validation loss, but their fitted values never reach an output; their variances still do. Keeping the total authoritative is reasonable (rule 16); the defect is validation evidence for a head that is not served (rule 7). **Fix.** Move the three to derived targets in a successor contract, or reconcile by a stated rule that uses them, and report how often the clamp fires. **Test.** With EV = 10, PP = 3, SH = 1, EN = 1, total = 14: the output states which input lost and the clamp counter is 0.

### F6 · Fantasy total treats a missing category as 0 (M-PFC-248) · P1 at activation · dormant
`fantasyProjectionTotal` uses `values[key] ?? 0` and skips non-finite products (`contracts.ts:799-807`). A league that scores faceoffs or takeaways gets a total for a v3 line that has neither, with no flag; the table sorts on it (`web/pages/fantasy-projections.tsx:677,1103-1114`). Decisions 47 and 48: a missing projection is not 0 and totals are marked incomplete. p3 D11 will add more nulls, which this function would also swallow. **Fix.** Return `{ total, missingKeys }`; show the total as incomplete and sort it below complete lines. Readers: the table cell, the sort, the compare view. **Test.** Scoring `{GOALS: 3, FACEOFFS_WON: 0.1}` on a line without faceoffs returns `missingKeys = ["FACEOFFS_WON"]`.

### F7 · Season accountability scoring (M-PFC-257–259) · P1 at activation · dormant
- **259, wrong.** `seasonSkillIndex` is `clip(50 + 50·(L_base − L)/max(L_base, 1e-9))` on per-row **absolute** errors (`settlement.ts:13-19,41`). It is the formula p2 D2 judged wrong, in a second file with its own scoring version. Astra's corrected numbers apply: for Poisson(0.2), forecasting 0 scores 88.9 and the true mean 48.0; a perfect baseline gives 50.
- **258.** The same index is computed for `GAMES_PLAYED` and `GAMES_STARTED` probabilities. Absolute error on a probability is improper: an honest 0.9 expects 0.18, a forecast of 1.0 expects 0.10. Brier and log loss are stored correctly beside it (`:43-55`). Interval coverage is inclusive on discrete outcomes (`:59`), Astra W1's point: for a 0.2-goal game line the band [0, 0.77] "covers" every scoreless game, 82%.
- **257.** Proportional allocation is exact when the base total is the sum of the game means. Two gaps: the fallback divides by expected games played, not scheduled games, so a delta on a zero-base target is over-allocated (60 expected of 82 scheduled gives 1.37×); and an adjusted play or start probability is not bounded to [0, 1] before log loss (`web/scripts/import-player-forecast-season-settlement.ts:319-339`).
- **Fix.** One shared skill function for both settlement files: aggregate a proper loss per target first, then 1 − ΣL/ΣL_base; unavailable when ΣL_base = 0. Bump `FANTASY_PROJECTION_SCORING_VERSION`. Apply p2 D10 (085) for missing actuals. **Test.** Expected-loss assertion (Astra p2 §2): on Poisson(0.2) outcomes the true mean out-scores 0; a hedged 1.0 scores worse than an honest 0.9 on Bernoulli(0.9).

### F8 · Runtime newcomer prior (M-PFC-254, 255) · P2 · dormant
- Each target is the cohort **median**, taken separately (`seasonJobs.ts:197-225`). For a mean forecast of right-skewed rates the median is low, and rare targets (SH goals, OT goals, GWG) are 0 whenever more than half the cohort is 0. An empty cohort value returns 0 (`:100`).
- Play probability is the cohort's 25th percentile (`:235-237`); variance is ×2.25 (`:223`); role odds are fixed at 0.65 / 0.35 for F4, D3, G3 (`:125,137,151`). All unfitted (rule 12; the 2.25 is p3 D10's constant). `confidence: 0` and three fallback flags are set, so the line is honestly flagged in data; the player page still shows the role odds (`fantasy-projections.tsx:1651`).
- **Fix.** Use cohort means (or the rookie model's prior), keep unknown targets null, and show "prior only" in place of role odds. **Test.** A cohort with SH goal rates {0, 0, 0, 0.02, 0.04} yields 0.012, not 0.

### F9 · Team "lines" are a sort by projected ice time (M-PFC-256) · P2 · dormant
`teamDeployment` slices forwards in threes and defence in pairs by conditional `TOTAL_TOI`, power-play units by `PP_TOI` and goalies by start probability (`seasonJobs.ts:428-470`). No play-probability filter (an injured player with a team id stays on line 1) and no position rule for PP units. With p2 D1's placeholder zeros, PP and PK sort keys tie at 0 and the units fall back to total-TOI order. The page lists them as lines and units. **Fix.** Label "projected ice-time order", exclude players below a stated play probability, and withhold PP/PK units until strength TOI is real. **Test.** A roster whose top forward has play probability 0 does not list him.

### F10 · Roster-observation start receipts carry the frozen-window label (M-PFC-264) · P2 · conditional
`buildRosterObservationGoalieStartReceipt` reuses the kernel's limitations and removes only the "Assumes fresh cutoff eligibility" line (`modeledGoalieParticipation.ts:222`), so the receipt still says "Experimental frozen Sep29–Oct12 America/New_York … official starter frequency" (`:173`). The rolling-window twin replaces the list (`rollingWindowParticipation.ts:133`). The arithmetic (starter labels ÷ the same eligible opportunities, withheld on any unknown label) is sound and fail-closed. **Fix.** Give the method its own limitations list; issued receipts stay as issued (rule 21). **Test.** No limitation string on a roster-observation receipt mentions the frozen window.

## 4. Owner questions (not in decisions 1–79 or Tier B)

1. **Goalie outcome context (F1).** Until decision 38's fitted goalie-win model exists, should wins, losses, OTL, shutouts and quality starts carry no game-context multiplier (recommended), or opponent strength only?
2. **Post-freeze newcomers (F8).** Show a flagged population-prior line, or "no projection yet" until the next artifact?
3. **Team card lines (F9).** Relabel as projected ice-time order, or hide until real line data feeds it?

## 5. Limits

- No season artifact, release or evaluation row exists, so every size here is analytic or a worked example, not a measurement. The 67 heads remain empirically undetermined.
- Dormant is from exact zero counts on four tables plus the upstream trace of the page reader; I did not read Vercel env values or trace `seasonJobs.ts` job triggers.
- I read the named functions only; `seasonJobs.ts` outside lines 60–300, 420–470 and 1040–1110 was not read. Lane ownership of `fantasy-projections/` (Claude or Codex) was not checked.
- Database: one `pg_stat_activity` check (0 active) and two catalog/count reads on empty tables. No jsonb, no NST, NHL or Yahoo calls. No tests run.

## 6. Final analysis and fix-agent handoff

### Final analysis
The upstream audits judged the season model mostly in Python and the reconciliation helpers in TypeScript. This cross-check finds no contradiction with them. What slipped through is structural: **the TypeScript evaluator is the code that would write the served rows, and several upstream fixes name only its Python twin.** C17's variance, the independent-games sum, the 0.65 loading (correlation 0.4225, per Astra) and the unknown-to-zero defaults all exist a second time in `evaluator.ts`. The zero-rewarding skill score exists a second time in `fantasy-projections/settlement.ts`. Fixing one copy would leave the served numbers unchanged (rules 4, 14).

Four points are new. The context multiplier's fall-through scales goalie wins, losses, OTL, shutouts and quality starts by pace in both languages. Bands for sums are built by adding component bands. Three EV heads are fitted and validated but never served. The page's fantasy total silently treats a missing category as zero. Three smaller items are labelling: newcomer medians and invented role odds, a team "lines" card that is an ice-time sort, and a stale limitation string on native start receipts.

Astra's corrections are applied: the lockbox was already designated consumed (decision 39); the GP/GS Bernoulli variance defect (PR8) stands and is not repeated; per-appearance goalie rates × appearance probability are coherent; a perfect baseline scores 50; a median prior is a policy choice, so F8 calls the median of sparse rates a defect only because the line is a declared mean forecast.

### Fixes in priority order
All are dormant; "P1" means before any season release is imported.

| # | P | Change | Files and symbols | Readers (rule 4) | Proof |
|---|---|---|---|---|---|
| 1 | P1 | One proper, aggregated skill score | `fantasy-projections/settlement.ts` `seasonSkillIndex`, `scoreSeasonPrimitive`; `player-forecasts/settlement.ts:171-180` | `web/scripts/import-player-forecast-season-settlement.ts:319-345` (no reader of `player_forecast_season_evaluations` found in `web/lib` or `web/pages`) | F7 expected-loss tests |
| 2 | P1 | No pace on goalie outcome heads | `evaluator.ts` `targetMultiplier`; `season.py` `_target_multiplier` | `evaluatePortableSeasonGame`; Python game outputs; golden vectors | F1 fixture |
| 3 | P1 | Incomplete fantasy totals | `contracts.ts` `fantasyProjectionTotal` | `web/pages/fantasy-projections.tsx:677,1103-1114` | F6 test |
| 4 | P1 | Add TS twins to p1 D4, D5, 006 and rule-5 defaults; fold in Astra PR8 | `evaluator.ts` `mergeAdvancedSeasonArtifact`, `evaluatePortableSeasonGame`, `aggregateSeasonGames`, `correlatedAggregateQuantiles` | `seasonJobs.ts` writers; `seasonGameContributions.ts` preview | Cross-language parity on one frozen artifact |
| 5 | P2 | Sum bands from variance, not from bands | `evaluator.ts` `quantiles`; `contracts.ts` `reconcileProjectionQuantiles` | page bands, draft dashboard, season editor (same readers as p3 D11) | F4 coverage test |
| 6 | P2 | EV heads: derive or use | `contracts.ts` `reconcileStrengthFamily`, target arrays | Python `_reconcile`; artifact policies | F5 test |
| 7 | P2 | Newcomer prior and role odds | `seasonJobs.ts` `buildRuntimeNewcomerPrior`, `runtimeNewcomerDeployment` | `fantasy-projections.tsx:1651` | F8 test |
| 8 | P2 | Team lines label and filter | `seasonJobs.ts` `teamDeployment` | `fantasy-projections.tsx:828` | F9 test |
| 9 | P2 | Start-receipt limitations | `modeledGoalieParticipation.ts` `buildRosterObservationGoalieStartReceipt` | `nativeDailyPipeline.ts:168`, `nativeInputMaterialization.ts:244`, `modeledGoalieParticipationStore.ts:121` | F10 test |

### Directional suggestions (not defects)
- Add a moment-invariant check to `verifyPortableSeasonArtifact` (Bernoulli GP/GS variance, SA = SV + GA, W + L + OTL ≤ GP), so a malformed artifact fails at load.
- Name the 0.65 constant `sharedFactorLoading` and record the implied correlation in the artifact.
- State the unit on "Pace / game" (shot attempts per team per game).

### Context for fix agents
- **Decisions.** 38 (no assumed goalie-win shortcut; fitted shrinkage), 39 (bands labelled uncalibrated; no 2025-26 re-tuning), 41 and 78 (declared basis; unresolved excluded), 46 (W/L/OTL/no-decision reconcile), 47 and 48 (missing ≠ 0), 65 (proper scores first). Rules 4, 5, 12, 14, 15, 21.
- **Traps.** `TOTAL_TOI` is seconds; GAA uses 3600 × GA ÷ seconds in `contracts.ts` and 60 × GA ÷ minutes in `gameContract.ts`. Goalie conditional rates are per appearance, relief included, and pair with play probability, not start probability (Astra W1 PR-P3, p3 D5). `PLUS_MINUS` is signed: no clamp at 0. `round` is 10 decimals and feeds `componentHash`, so any numeric change alters hashes.
- **Do not change in place.** Contract versions and checksums v3/v4/v5 (`contracts.ts:14-22`), `FANTASY_PROJECTION_SCORING_VERSION`, native method version strings and issued receipts: ship versioned successors (rule 21). Do not delete the EV heads or the newcomer path because of these findings (rule 6). Keep preview permissions denied (Astra p3 PR5).
- **Python twins** live in `modeling/player_forecasts/season.py` and `advanced.py`; change both languages in one lane and regenerate golden vectors, or parity breaks.
- **Production actions needing the owner's approval.** None to land the code. Importing a season artifact or release, re-running season settlement, and any migration for a new evaluation column are separate approvals. Verify with Vitest (`web/lib/fantasy-projections/fantasyProjections.test.ts`) and `modeling/player_forecasts/tests/`; no remote build.
- **Suggested lanes.** (A) Season evaluator and contracts: fixes 2, 4, 5, 6 with the p3 D11/D12 and Astra PR8/PR9 items, TypeScript and Python together. (B) Season accountability scoring: fix 1 with p2 D2 and D10 (085). (C) Fantasy-projections page and seasonJobs presentation: fixes 3, 7, 8. (D) Native participation labels: fix 9, with the p1 D8 work. Check lane ownership in the coordination file before editing; it was not verified here.
