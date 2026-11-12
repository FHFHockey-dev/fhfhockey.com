# W2 audit: player-forecasts-season-part2 (M-PFC-061 to M-PFC-120)

Fable, 2026-11-11, on `octoberBranch` at `68d907dc2`. Read-only: no code changed, no tests run. Paths are repo-relative; `season.py` means `modeling/player_forecasts/season.py`.

## 0. Brief

- **Questions.** (1) Which Python season artifact does `/fantasy-projections` serve? (2) Is the v4 season model's rate estimation and selection (M-PFC-073 to 080) sound and scored properly (decision 65)? (3) Are the season labels (111 to 114) and team contexts (067 to 069) what they claim? (4) Do the TypeScript scoring and ledger entries follow decisions 38, 39 and 41?
- **Reference standards.** Empirical-Bayes / Gamma-Poisson shrinkage (Tango's regression to the mean); Poisson IRLS with an exposure offset (McCullagh and Nelder); proper scoring rules (Gneiting and Raftery: MAE elicits the median, squared error the mean); Simple Rating System (Sports-Reference); Vollman's quality start (decision 40); NHL official strength and empty-net scoring conventions.
- **Fixtures and data.** The repo's own functions run on a seeded synthetic freeze (600 skaters, seed 20261111); bounded production reads on dated windows (section 6).
- **Done when.** Every entry has a verdict with file:line and reach; each defect has a magnitude or a stated reason there is none, a fix and a valid test; unread entries are marked undetermined, not guessed.

## 1. Summary

| Verdict | Count |
|---|---:|
| Sound | 7 |
| Mis-specified | 25 |
| Wrong | 11 |
| Undetermined | 17 |

**Triage question settled: no Python season artifact is served.** The page reads `player_forecast_season_active_releases`, then `player_forecast_season_releases` (`web/lib/fantasy-projections/queries.ts:98-121`), filtered to the v3/v4/v5 contract checksums (`contracts.ts:18-22`). On 2026-11-11 both tables hold **0 rows**, so the API throws release-not-found and the page shows no projections. `native_forecast_catalog_heads` also holds 0 rows. So there is **no P0**: everything in the Python season model is dormant until a release is imported. The only live items here are the ledger controls (097) and code paths that currently receive no native rows (064, 088).

**Top 5 findings by user impact (at activation, unless marked live).**

1. **Season skater labels carry placeholder zeros** (M-PFC-111, P1). `skatersGameStats.powerPlayToi`, `shorthandedToi` and `faceoffs` are `00:00` / `0/0` on every sampled row from 2024-25 onward (5,544 rows in three sampled weeks; 2023-24 has real values). `SKATER_QUERY` turns them into `PP_TOI = 0`, `PK_TOI = 0`, `EV_TOI = TOTAL_TOI` and `FACEOFFS_WON/LOST = 0`. A release would publish near-zero faceoffs, and the v4 decay and shrinkage for PP/PK TOI are tuned against zeros.
2. **Selection by MAE rewards predicting zero** (M-PFC-078, 079, 066; decision 65; P1). On the synthetic freeze a constant 0 scores MAE 0.162 against 0.259 to 0.270 for every real candidate; MAE picks the weakest shrinkage (k = 5) where squared error picks k = 20. The settlement "skill score" has the same flaw: always forecasting 0 goals earns about 89 of 100 against a calibrated baseline.
3. **Scheduled back-to-backs are read off UTC dates** (M-PFC-102, P1). On the 2026-27 schedule (2,688 team-games) the flag marks 564 games where 377 are true back-to-backs: 84 real ones missed, 271 false.
4. **The "penalized GLM" undoes the shrinkage it is fed** (M-PFC-076, 077, 080; P1). It regresses each player's observed mean on a shrunk copy of the same mean. Fitted slopes were 1.06 to 1.39, and its error against true rates equalled the raw mean's (0.0417 against 0.0376 for plain shrinkage).
5. **The validated v4 model is not the served v4 model** (M-PFC-074, P1). Decay, shrinkage and family are chosen on game rows, then TOI and ten scoring targets are overwritten by a season-total exposure model that was never scored (rule 7).

Also: roster-adjusted goals against subtract a skater suppression sum that counts each on-ice event about five times (069); empty-net goal labels over-count by 35% in a 97-game sample (111).

## 2. Per-entry table

Reach: L live, C conditional, D dormant, R research. "Up" = settled upstream in `audits/player-forecasts-season-part1.md` or the W1-8 consolidation, cited not re-audited.

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| 061 | mis-specified | `rookies.py:517-610` one season, strict `<`, unweighted MAE | D | rookie serving gate |
| 062 | mis-specified | `rookies.py:619-668` unfitted multiplier (rule 12) | D | rookie play probability, variance |
| 063 | mis-specified | `season.py:3415-3460` only G, A, PIM translated | D | season artifact |
| 064 | mis-specified | `contributions.ts:19-21,307-311` unfitted UTC-day ramp | C | RSO planning, start chart |
| 065 | sound | `contributions.ts:387` (light read) | L | RSO planning |
| 066 | wrong | `settlement.ts:176-180` (D2) | D | evaluation revisions, accountability |
| 067 | mis-specified | `season.py:2554-2627`, `4099-4102` (D8) | D | `_target_multiplier`, team cards |
| 068 | mis-specified | `season.py:2630-2661` (D8) | D | hits, blocks, takeaways, giveaways |
| 069 | wrong | `season.py:2691-2696,2747-2750` (D5) | D | opponent multipliers, team ratings |
| 070 | mis-specified | `challenger_math.py:63-97` (D9) | R | challenger hits |
| 071 | mis-specified | `challenger_model.py:37-52,259` MAE winners; Up D7 | R | flagged-off worker |
| 072 | mis-specified | `model.py:57-80` in-sample coverage; MAE bootstrap `:107-128` | R | lockbox report |
| 073 | mis-specified | `season.py:1591-1622` (D7) | D | all v4 rates |
| 074 | wrong | `season.py:3148-3166,3343-3366` (D4) | D | TOI and scoring rates |
| 075 | sound | `season.py:1900-1914` | D | all v4 rates |
| 076 | wrong | `season.py:1994-2016` (D3) | D | selected family |
| 077 | mis-specified | `season.py:1957-1967` (D3) | D | selected family |
| 078 | wrong | `season.py:2192-2209` (D2) | D | decay, shrinkage |
| 079 | mis-specified | `season.py:2341-2369` (D2) | D | model family |
| 080 | mis-specified | `season.py:2084-2180` (D3) | D | hurdle targets |
| 081 | undetermined | not read; private pilot | R | none |
| 082 | undetermined | not read; private pilot | R | none |
| 083 | mis-specified | `serving.ts:327-331` first game = 0 = back-to-back | C | validation features |
| 084 | mis-specified | `fantasy-projections.tsx:236-240,710,714` (D10) | C | page badges, filter |
| 085 | wrong | `import-player-forecast-season-settlement.ts:318-323` (D10) | C | season evaluations |
| 086 | wrong | `advanced.py:76-118` (D10); Up Astra | D | v5 on-ice targets |
| 087 | undetermined | not read; legacy blend only | D | legacy baselines |
| 088 | mis-specified | `baselineSourceLineage.ts:308-315` (D10) | C | native rates, settlement |
| 089 | mis-specified | Up D1 (hard prior/current switch) | D | native means |
| 090 | undetermined | not read; orchestration only | R | starter board |
| 091 | sound | `daily_board_data.py:78-85`; its distrust of PP/SH TOI is confirmed by D1 | R | starter board |
| 092 | undetermined | not read | R | starter board |
| 093 | undetermined | not read; no consumers | D | none |
| 094 | undetermined | `accountability.ts:20-45` light; `revisionValue` not read | C | dashboard |
| 095 | sound | `gameContract.ts:137-165` identities (light) | R | fixtures only |
| 096 | mis-specified | `servedForecastLedger.ts:193-200,236-240` (D10) | C | ledger market rows (0 today) |
| 097 | wrong | `servedForecastLedger.ts:143-161` (D6) | L | `/api/v1/forge/scoreboard` |
| 098 | sound | `horizons.py:44-62` labelled reconstruction, validation-only | R | challenger features |
| 099 | mis-specified | `season.py:4577` 48 h, no correction path (light) | D | season settlement |
| 100 | mis-specified | `season.py:907-1005` non-null counts as observed (D1) | D | v4 training gate |
| 101 | mis-specified | `season.py:130-183` (D9) | D | defense signal, 069 |
| 102 | wrong | `season.py:4166-4177` (D4b) | D | back-to-back multiplier |
| 103-108 | undetermined | not read; bounds and gates, no arithmetic | C | native cadence |
| 109 | sound | `resolvedPlanningForecast.ts:100-132` | L | planning |
| 110 | undetermined | not read | R | challenger labels |
| 111 | wrong | `season.py:186-467` (D1) | D | every skater rate |
| 112 | sound | `season.py:471-499`; 2,788 rows, max gap 0.01 s | D | exposure model |
| 113 | wrong | `season.py:532-566`; Up Astra A, D9; decision 40 | D | goalie rates |
| 114 | mis-specified | `season.py:1166-1185` splits not rewritten | D | assist splits |
| 115 | undetermined | not read; no consumers | D | none |
| 116 | mis-specified | `sourceObservations.ts:439` denominator 20 for power play | C | lineup completeness |
| 117 | undetermined | not read | R | none |
| 118 | mis-specified | `validation.ts:149` `?? expected` passes missing values | C | release gate |
| 119 | mis-specified | `rosterIntegrity.ts:120,147,168` conflict reports max | C | roster confidence, 084 |
| 120 | undetermined | `baselineGeneration.ts:97` light; fallback label not traced | C | contribution units |

## 3. Defects

### D1 · Season skater labels: placeholder zeros, empty-net and shootout handling (M-PFC-111, 100) · P1 · dormant
- **Placeholder zeros.** `SKATER_QUERY` parses `powerPlayToi`, `shorthandedToi` and `faceoffs` from `skatersGameStats` (`season.py:407-444`). Sampled weeks: 2023-11-01 to 07 has real values (1,179 of 1,763 rows with PP TOI; faceoffs up to `9/22`). 2024-11-01 to 07 (1,872 rows), 2025-12-01 to 07 (1,980) and 2026-10-20 to 26 (1,692) are `00:00` and `0/0` on every row. `daily_board_data.py` already refuses these columns.
- **Effect.** False zeros, not nulls (rule 5). `FACEOFFS_WON/LOST` are base targets, so a release would publish faceoffs averaged with two seasons of zeros. PP/PK TOI are replaced at serving by season totals (D4), but their decay and shrinkage are still tuned on the zero rows. The coverage gate (100) counts any non-null as observed and does not cover base targets.
- **Empty-net goals.** With complete play-by-play, `EMPTY_NET_GOALS` counts goals in strength state `EN` (`:453`). 97 games, 2025-10-07 to 20: play-by-play 58, official WGO 43 (+35%). PP goals 127 against 130, SH 13 against 14, so `EN` also absorbs some official PP and SH goals. Those player-games trip `source_conflict` and lose all assist labels (`:330-339`); the nulled rows are all scoring games.
- **Shootouts.** 13 shootout attempts carry `is_goal` in the same sample. `pbp_complete` compares distinct `is_goal` events with boxscore goals (`:286-289`), so all 6 shootout games (6.2%) fail it and lose their strength splits.
- **Fix.** Take strength TOI and faceoffs from a verified source (WGO game rows or shift-derived seconds) and emit null when absent. Define empty-net as "scored into an empty net" and keep official PP/SH strength. Exclude `period_type = 'SO'` from goal counts. Make the coverage gate value-aware (a season of all zeros fails) and extend it to base targets.
- **Test.** On a frozen week per season: Σ PP_TOI > 0; Σ FACEOFFS_WON equals the WGO total; Σ EMPTY_NET_GOALS, PP_GOALS and SH_GOALS equal WGO; every shootout game has `pbp_complete`.

### D2 · Mean forecasts selected and scored by absolute error (M-PFC-078, 079, 066; decision 65) · P1 · dormant
- `_select_rate_policy` picks decay, shrinkage and family by MAE (`season.py:2192-2209,2341-2369`); the 0.1% lift rule is also on MAE with no uncertainty.
- **Magnitude (synthetic, 600 skaters, 42,600 scored games, seed 20261111).** MAE best: decay 1.0, k = 5 (0.2595). MSE best: decay 1.0, k = 20 (0.16503). Constant 0: MAE 0.162, MSE 0.201. Constant mean: MAE 0.277, MSE 0.175. Any candidate that biases low wins on MAE. The direction (less shrinkage) is specific to this fixture; the lead guessed the opposite.
- `compositeSkillScore = 50 + 50·(AE_base − AE)/AE_base`, clipped to 0 to 100 (`settlement.ts:176-180`). With a true goal mean of 0.2 and a baseline forecast of 0.19, forecasting 0 scores 100 when the player has no goal (82%) and 38 otherwise: 89 expected. A baseline error of 0 sets the denominator to 1e-9 and pins the score to 0 or 100.
- **Fix.** Select by squared error or Poisson deviance; report MAE second. Require a paired, time-clustered interval on the lift. Replace the per-forecast ratio with an aggregate `1 − Σ loss / Σ baseline loss` on a proper loss, per target.
- **Test.** A zero forecast must lose to the population mean in selection and score below 50. Halving a calibrated forecast must lower its score. Report held-out selection with uncertainty (rule 11).

### D3 · Circular GLM features (M-PFC-076, 077, 080) · P1 · dormant
- `_fit_penalized_rate_glm` builds one point per player: feature `log(EB rate)`, response the same player's observed mean on the same rows (`season.py:2005-2014`). The offset algebra is correct (`:1974`).
- **Magnitude (same fixture).** Slope on `log(EB rate)`: 1.06 (k = 5), 1.22 (k = 20), 1.39 (k = 40). RMSE against true rates: GLM 0.0417, shrinkage 0.0376, raw mean 0.0419. The ridge penalty of 10 is negligible next to weights that sum to total counts.
- The negative-binomial dispersion comes from those in-sample player totals (`:1957-1967`), so it is understated. The hurdle's positive-mean stage is constant for the binary targets (shutouts, quality starts).
- **Fix.** Fit on out-of-time pairs: features before a cutoff, outcomes after. Standardise features before penalising. Drop the hurdle for binary targets.
- **Test.** On a synthetic freeze with known rates, the GLM's error against truth must not exceed plain shrinkage; the fitted slope stays at or below 1.

### D4 · Validated and served v4 models differ (M-PFC-074) · P1 · dormant
- Game-row policies are selected and scored, then `apply_exposure_rate` overwrites `TOTAL/EV/PP/PK_TOI` and the ten `SKATER_SCORING_EXPOSURES` targets with season-total rates (`season.py:3343-3366`). The artifact keeps the game-row `validationMae` and interval scale for numbers that path did not produce.
- The exposure fit reuses that policy's decay and shrinkage (`:3153-3166`), tuned for a per-game mean, for PP/PK TOI against the zeros in D1. Support is weighted games, not exposure seconds, so a rate from 60 PP seconds is trusted like one from 15,000.
- `_weighted_exposure_summary` has no cutoff argument (`:1625`), so this path cannot be scored chronologically as written.
- **Fix.** Give the exposure path its own cutoff-aware selection on a proper score, with exposure-based reliability. Report its own validation. **Test.** Rebuild with a cutoff and score the next season's totals; the reported loss must come from the served path.

### D4b · Back-to-back flag from UTC dates (M-PFC-102) · P1 · dormant
- Serving takes `scheduled_start_at` in UTC and uses its date (`season.py:4166-4177`); training uses the local `game_date` (`:1665-1690`).
- **Magnitude.** `games`, season 20262027, 1,344 games: 1,860 of 2,688 team-games change date in UTC. True back-to-backs 377; flagged 564; missed 84; false 271.
- **Fix.** Use the schedule's local game date. **Test.** Flag counts equal the local-date counts on the frozen 2026-27 schedule (377).

### D5 · Roster-adjusted goals against (M-PFC-069, with 101) · P1 · dormant
- `defense_suppression = Σ p · per-60 · TOI/3600` over all skaters (`season.py:2691-2696`). Five skaters share each on-ice event, so a roster of average per-60 value s sums to about 5s. It is then subtracted from the goalies' goals against per game (`:2747-2750`), which already contain the team's defence.
- The fallback signal when no shift history exists is plus-minus per 60, a different quantity (`:3504-3507`). Sums run over every pooled player, so roster size moves `goalsFor` and the suppression total.
- **Fix.** Convert to a team rate (TOI-weighted mean, or divide by skaters on ice) and normalise to a dressed lineup. Fit the goalie and skater split on held-out team seasons (rule 12). **Test.** A roster of league-average players returns league-average goals against, whatever its size.

### D6 · Ledger naive controls (M-PFC-097; decisions 38, 41) · P1 · live
- Already settled upstream (D6, C18) and still in the code: participation fixed at 1, goalie "last 5" uses 10 starts and 10 team games (`servedForecastLedger.ts:159`).
- New: a missing team win probability becomes 0.5 (`:150`), a made-up value (rule 5), and the control equates goalie win with start share × team win (decision 38). The ledger held 11,547 rows to 2026-11-08, none `market`, none `native`.
- **Fix.** Null the win head when the team probability is missing; score per decision 41. **Test.** A goalie row with no team probability has a null `exp_win_prob` and is excluded from win scoring.

### D7 · Recency weights are anchored to 2025-26 (M-PFC-073) · P2 · dormant
- `_season_age` measures from `TRAINING_CUTOFF_SEASON` (`season.py:1591-1611`). Validation predicts 2025-26 games with same-season rows at weight 1; serving predicts 2026-27 with no same-season rows. Decay and k are tuned for one estimand and used for another (rule 9).
- **Fix.** Validate as served: predict a full season from prior seasons only. **Test.** Selection on season-ahead folds, reported next to the in-season result.

### D8 · Team and venue multipliers (M-PFC-067, 068) · P2 · dormant
- One season of raw goal ratios with no regression, clipped at ±35% (`season.py:2608-2610`). A team with no rows gets a goal rate of 0 and the 0.65 floor (`:2565`, rule 5). Save percentage includes empty-net goals.
- `_target_multiplier` applies `√(team pace × opponent pace)` to rates that already contain the player's own team pace (`:4099-4102`), so a +8% pace team gains about 4% on every count.
- Venue effects pool home and visiting skaters at a rink (`:2644-2660`). With no scorer bias and a home team 25% above league in hits, the multiplier is about 1.09 for visitors too, and home players' rates already include it.
- The damped rating iteration converges (factor about 0.5 per step): sound.
- **Fix.** Shrink team effects with a fitted weight; apply opponent pace only; estimate rink bias from the same teams home against away. **Test.** A league of identical teams yields multipliers of 1; a synthetic biased rink is recovered and a physical home team is not.

### D9 · Research and input defects · P2
- **070:** the prior uses unweighted player rates without removing Poisson noise. Synthetic (700 players): true prior exposure 1,500 s, fitted 1,140 s (24% weak).
- **101:** team totals count shootout events and all strengths; the player join excludes them.
- **061, 062:** one validation season, 20 and 10 samples, strict inequality, a survivor-selected pool; the uncertainty multiplier is unfitted.
- **063:** rookies get translated goals and assists while shots, PP scoring and TOI stay on the population prior, so PP goals can exceed goals.
- **114:** the official correction rewrites totals but not the PP/SH/EV/EN primary and secondary splits.

### D10 · Other · P2
- **086:** the champion pick orders by `is_champion` (the leaky model, decision 5); missing xG becomes 0; no empty-net exclusion (decision 7); inclusive shift end double-credits changes.
- **085:** missing actuals and forecasts become 0 (decision 41).
- **096:** a prop-implied mean is conditional on playing and model-dependent, stored beside unconditional bridge means (rule 9); one pooled market probability, not per book (decision 30).
- **088:** `FACEOFFS_LOST` holds the second number of `won/taken`, which is faceoffs taken (2023-24 strings such as `9/22`).
- **084, 119:** "High confidence" shows roster bookkeeping; a conflicted player reports the maximum of the disagreeing sources.
- **118:** a missing derived value passes the identity check. The 1,344-game, 84-per-team shape is right for 2026-27.
- **116:** a full power-play report scores about 0.5 on completeness.
- **064:** the 7-day ramp is unfitted and uses UTC days.

## 4. Questions for the owner (not answered by decisions 1 to 68)

1. **Faceoffs and strength TOI source.** Approve replacing `skatersGameStats` for these labels (WGO game rows or shift-derived), and should the ingestion that writes `00:00` / `0/0` since 2024-25 be repaired as its own task?
2. **Empty-net definition for fantasy labels.** "Scored into an empty net" (official), with extra-attacker goals staying EV/PP?
3. **Which contract is intended for the first 2026-27 release:** v3 (the code default), v4 or v5? D1 and D4 bite differently in each.
4. **Season-ahead validation.** Accept that v4 has no season-ahead evidence until D7 is rerun, and label releases so under decision 39?
5. **Market rows.** `LEDGER_MARKET_ENABLED` is true but no market rows exist. Keep it on, or turn it off until decision 30's fixes land?

## 5. Limits

- **Undetermined (17).** Not read: 081, 082, 087, 090, 092, 093, 103 to 108, 110, 115, 117. Light read only: 094, 120. A direct read of each named function settles them; most are bounds and gates with no arithmetic.
- **Light reads behind a verdict:** 065, 071, 072, 095, 099, 114.
- **Synthetic magnitudes** (D2, D3, D9) come from one seeded fixture with Gamma-Poisson goals. They show the mechanism, not production sizes; no season freeze or artifact exists in the repo or database to score.
- **Samples are dated windows, not population rates** (rule 1). D1's zeros are shown for three sampled weeks from 2024-25 onward; the first bad date was not located.
- I did not confirm what strength state `EN` means in the ingestion code; the 58 against 43 comparison is the evidence.
- No NST, NHL or Yahoo calls. No tests run.

## 6. Reproduction

`pg_stat_activity` showed 0 other active queries before every read. All reads were aggregates or catalog lookups; no jsonb column was touched.

- **Served status:** `count(*)` on `player_forecast_season_active_releases`, `player_forecast_season_releases`, `native_forecast_catalog_heads`.
- **D4b:** `games` where `"seasonId" = 20262027 and type = 2`; per team, `lag` of `date` and of `("startTime" at time zone 'UTC')::date`; count rest = 1 under each.
- **D1 zeros:** `"skatersGameStats"` joined to `games` (`type = 2`) for 2023-11-01..07, 2024-11-01..07, 2025-12-01..07, 2026-10-20..26; count non-`00:00` `"powerPlayToi"` / `"shorthandedToi"` and non-`0/0` `faceoffs`.
- **D1 strength and shootout:** `nhl_api_pbp_events` for games dated 2025-10-07..20 (97 games), `is_goal` by `strength_state` and `period_type`; `wgo_skater_stats` sums of `goals`, `pp_goals`, `sh_goals`, `empty_net_goals` for the same dates; `"skatersGameStats"` goal sum.
- **112:** `wgo_skater_stats_totals`, seasons 20232024 to 20252026, skaters with `games_played > 0`: count `abs(toi_per_game * games_played − (ev + pp + sh)) > 2` and the assist and point identities.
- **D6:** `forge_served_forecast_ledger` grouped by `source`, `player_class` (counts, date range).
- **Synthetic:** 600 players, goals rate Gamma(2.2, mean 0.17), three seasons, scored with `season._weighted_summary`, `_eb_rate`, `_fit_penalized_rate_glm`, `_glm_prediction` over `VALIDATION_FOLDS`; hits with `challenger_math.fit_hierarchical_hits`, 700 players, Gamma(2, mean 1.2 per 900 s). Scripts were scratch files, not committed.
