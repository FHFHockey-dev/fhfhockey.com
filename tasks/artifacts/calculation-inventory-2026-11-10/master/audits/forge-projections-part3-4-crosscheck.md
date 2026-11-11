# Cross-check W3: FORGE projections, parts 3 and 4 (M-FRG-121 to M-FRG-186)

Auditor: Fable, 2026-11-11, at `859cfb512` on `octoberBranch`. Read-only; no code changed. Paths are under `web/` unless stated. "W1-6" and "W1-7" are [forge-projections-part1.md](forge-projections-part1.md) and [forge-projections-part2.md](forge-projections-part2.md) as corrected by Astra ([part 1 review](../W1-Astra-PR/forge-projections-part1.md), [part 2 review](../W1-Astra-PR/forge-projections-part2.md)) and merged in [BATCH-BC-CONSOLIDATED.md](../BATCH-BC-CONSOLIDATED.md).

## 0. Brief

- 66 Codex-only records re-describe code W1-6 and W1-7 already judged, one function per record.
- For each record I found the upstream entry covering the same function. Where upstream read the lines, the record is "covered".
- Where upstream skimmed or skipped the function (W1-6 039 and 052 name the unread files), I read the function and judged it.
- Five functions hold something upstream missed. One upstream framing (reserve shutout) needs correcting.
- No P0. Every new finding is inert, dormant or research-only today.
- Two bounded database reads (`wgo_goalie_stats`, 2026-11-11) size the one finding on a live code path.
- Binding inputs: decisions 25, 28, 30, 35, 60, 63, 65 and rules 5, 7, 8, 13, 16, 17, 18.

## 1. Summary

| Verdict | Count |
|---|---:|
| Covered upstream, nothing to add | 37 |
| Sound on a fresh read (upstream skimmed or did not open) | 24 |
| Mis-specified (new) | 5 |
| Wrong | 0 |
| Undetermined | 0 |

### Top 5 findings by user impact

1. **The goalie rest-split save % term never fires, and would be wrong if it did (M-FRG-130).** It is called on the live goalie path, but its "profile" is one game's row, so no bucket ever reaches the 2-game minimum. If the input is ever made cumulative, the bucket lookup is off by one day and the term overlaps the fitted back-to-back term. No user-visible effect today.
2. **Market flag "confidence 0–100" is the edge divided by the threshold (M-FRG-184, 185).** It is not a probability. With the known spread sign error (W1-6 D4b) a wrong-way spread flag is stored at confidence 100. Dormant: the flags table is empty and decision 30 keeps ingestion off.
3. **Reserve shutout is correctly left unscaled; the lineup value is the defect (M-FRG-163).** W1-6 007 called the difference an inconsistency. Under decision 28 a fix lane must not "align" the reserve row to the lineup row.
4. **Research goal kernels are not ready to promote (M-FRG-154, 157, 160).** The opponent blend is an unreferenced 50/50 average, the fold summary is MAE-only on sparse goal means (decision 65), and a shot-volume context effect moves a player's goals but not his assists. All are research-only and labelled as such.
5. **Several packet "consumer" lists are name collisions (M-FRG-126, 136–140, 144, 147, 183).** These are module-private helpers. Reach for those records is the owning file's reach, not the listed files (rule 18).

## 2. Per-entry table

Reach: **live** (called in the nightly run or a served route), **cond.** (behind a flag or table state), **dormant** (code present, no data or caller), **research** (offline or not served).

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| 121 `partitionExamples` | Covered by W1-7 071 | `lib/forge-v2/model.ts:78-99` | research | v2 fitting |
| 122 `availabilityAdjusted` | Sound | `lib/forge-v2/participation.ts:79-91`: mean × p once, refuses a second pass | research | none |
| 123 `fitParticipation` | Covered by W1-7 071 | `participation.ts:45-63` | research | — |
| 124 `participationLabel` | Sound | `participation.ts:7-11`: ambiguous stays unknown | research | — |
| 125 `predictParticipation` | Covered by W1-7 071 | `participation.ts:65-77` | research | — |
| 126 `rawProbability` | Covered by W1-7 071 | `participation.ts:22-42`; module-private, packet consumers are another symbol | research | — |
| 127 `buildOpportunities` | Sound | `lib/forge-v2/schedule.ts:38-77` | research | fixture harness |
| 128 `evaluatePinnedIntervals` | Covered by W1-7 073, 088 | `lib/forge-v2/uncertainty.ts:144-174` | research | — |
| 129 `reproduceIntervals` | Covered by W1-7 073, 090 | `uncertainty.ts:131-142` | research | — |
| 130 Goalie rest-split save % | **Mis-specified** (N1) | `lib/projections/calculators/goalie-save-pct-context.ts:30-85`; `queries/goalie-queries.ts:203-250`; `stages/goalie-stage.ts:531-536` | live call, inert by data | Modelled save %, GA, win, shutout |
| 131 `computeWorkloadSavePctPenalty` | Covered by W1-6 005 | no caller; imports only | dormant | — |
| 132 `blendSkaterScenarioStatLines` | Covered by W1-6 054, Astra N1 | `calculators/scenario-blending.ts:71-132` | cond. (candidate mode) | — |
| 133 `resolveAssistDenominators` | Covered by W1-6 018 / D11 | `calculators/skater-adjustments.ts:573-579` | live (selector) | — |
| 134 `formatGameLength` | Covered by W1-6 006 | `lib/projections/gameLength.ts` | live | shift charts |
| 135–141 interval reconciliation helpers | Sound | `lib/projections/nativeIntervalReconciliation.ts:26-71`; W1-6 039 skimmed, read here | research | reconcile script |
| 142 `fixedKernelSensitivity` | Sound | `nativeSkaterParticipationResearch.ts:31-41`: exact fractions | research | — |
| 143 `inspectSkaterParticipationFrame` | Sound | `:43-92`: bounds, never a probability | research | — |
| 144 `allocate` | Covered by W1-6 052 | `research/skater-candidates/accounting.ts:41-66`; module-private | research | — |
| 145 `allocatePkMinutes` | Sound | `accounting.ts:98-111` | research | — |
| 146 `combineStrengthHeads` | Sound | `accounting.ts:133-144`: a null head gives a null total | research | — |
| 147, 148, 150, 151 | Covered by W1-6 052 | `accounting.ts:7-91` | research | — |
| 149 `projectShorthanded` | Sound | `accounting.ts:114-129`: per-minute rate, minute exposure | research | — |
| 152 `ablateContexts` | Sound (inherits 154) | `context.ts:37-40` | research | — |
| 153 `opportunityCountMoments` | Covered by W1-6 052 | `context.ts:43-50` | research | — |
| 154 `projectContext` | **Mis-specified** (N3) | `context.ts:31-35` | research | — |
| 155 `estimatePositionPrior` | Sound | `priors.ts:54-60`: pooled ratio, matched pairs | research | assist export script |
| 156 `fitSplitHalfK` | Covered by W1-6 052 | `priors.ts:67-95` | research | — |
| 157 chronological folds | **Mis-specified** (N4) | `lib/projections/researchGameGoals.ts:314-350` | research | evaluation script |
| 158 `forecastResearchGameGoals` | Sound (inherits 160) | `researchGameGoals.ts:277-311` | research | diagnostics |
| 159 `researchGoalCellSummary` | Sound | `:153-162`: cells partition the mean | research | — |
| 160 `teamKernel` | **Mis-specified** (N5) | `:190-193`, parameters `:9-11` | research | — |
| 161 `estimateResearchPlayerGoals` | Sound | `researchGoalBaseline.ts:27-80`: fails closed | research | — |
| 162 `evaluateRetainedResearchGoals` | Sound where read | `researchGoalBaseline.ts:102-130` only | research | scripts |
| 163 `buildReserveSkaterRow` | Covered by W1-6 007, **with a correction** (N6) | `reserveProjections.ts:123-143,146-162` | cond. (table absent) | RSO bridge |
| 164 `runPerGameGoalieStage` | Covered by W1-6 023–029, W1-7 093 | — | live | goalie rows |
| 165 `runMetricsFinalizationStage` | Sound (nit) | `stages/metrics-finalization-stage.ts:50-67`: empty share is 0, empty average is null | live (ops metric) | run metrics |
| 166 `runPerGameSkaterStage` | Covered by W1-6 042–060, W1-7 061–064, 103–112 | — | live | skater rows |
| 167 `addStartChartPositionRanks` | Sound | `startChartFantasyScoring.ts:65-122`: nulls unranked, competition ties, declared goalie score | live | Start Chart |
| 168 `computeStartChartFantasyPoints` | Covered by W1-6 015 | `:124-142`; labelled "FHFH default" (decision 54) | live | Start Chart |
| 169 `summarizeTeamForm` | Sound | `startChartTeamForm.ts:13-36`; shootout goal disclosed at `pages/start-chart.tsx:1382` | live | Start Chart |
| 170–174, 176, 179–181 | Covered by W1-7 065 | `uncertainty.ts:782-947` | live / dormant | props, bands |
| 175, 178 normal-approximation quantiles | Covered by W1-7 066 | `uncertainty.ts:117-135`; only when `simulationSamples <= 1` (`:22` is 400) | dormant | — |
| 177 `playerToiCv` | Covered by W1-7 065, Astra N4 | `uncertainty.ts:955-966` | live | bands |
| 182 `impliedProbabilityToAmerican` | Covered by W1-6 040 / D18 | `utils/devig.ts:263-268`: exact inverse | dormant | synthetic quotes |
| 183 `median` | Covered by W1-6 040 | `devig.ts:255-260` | dormant | — |
| 184 `buildFlagConfidence` | **Mis-specified** (N2) | `utils/market-output-builders.ts:77-90,123,590` | dormant | flag rows |
| 185 `buildModelMarketFlagRow` | Covered by W1-6 041 (inherits 184) | `:92-133` | dormant | flag rows |
| 186 `expectedValueWithPush` | Covered by W1-6 041 | `:363-371` | dormant | flag rows |

## 3. Defects

### P1

None.

### P2

**N1. Goalie rest-split save % adjustment (M-FRG-130). Inert today; three latent faults.**
- **Why it is inert.** `fetchGoalieRestSplitProfile` reads the single latest `wgo_goalie_stats` row (`goalie-queries.ts:214-250`). Those rows are one game each. Sample, 2026-11-11: 319 rows dated 2026-10-20 to 2026-11-10, `games_played` at most 1, every rest bucket at most 1. `GOALIE_REST_SPLIT_MIN_GAMES` is 2, so the function returns 0 for every goalie. This agrees with W1-6 028 ("context shifts are a few ten-thousandths") and is the same single-game-profile pattern as W1-6 D6 and D7.
- **Fault 1, off by one.** The source defines days of rest as the calendar gap minus one. Sample, 523 goalie appearances since 2026-10-01: gap 1 day → bucket 0 (9 of 9); gap 2 → bucket 1 (149 of 149); gap 3 → bucket 2 (113 of 113); gap 4 → bucket 3 (84 of 84). The code feeds the raw gap into `toGoalieRestSplitBucket` (`goalie-save-pct-context.ts:30-39`), so a back-to-back reads the 1-day bucket. Bucket "0" needs a gap of 0, which `.lt("game_date", asOfDate)` rules out.
- **Fault 2, double count.** A back-to-back already takes the fitted −0.003 (`goalie/goalieOutcomes.ts:22,73`); the split would add a second rest effect.
- **Fault 3, noise.** Weight n/(n + 6) on a save % from as few as 2 games, with a game-weighted (not shot-weighted) baseline that includes the bucket itself. Ten games at 28 shots have a save % SD near .018, so the ±.012 clamp would bind often. After the 0.25 pass-through the swing is ±.003, against a modelled between-goalie SD of .0025 (W1-6 028). These are calculations, not a replay.
- **Also:** `daysSinceLastStart` counts relief appearances (W1-6 032), and `lte("date", asOfDate)` admits a same-day row.
- **Fix.** Keep the term off until it is fitted (decision 60: legacy buckets stay until a tested replacement beats them and a no-rest baseline). Either remove the call, or build the profile from pooled shots and saves per bucket over credited starts strictly before the date, map gap − 1 to the bucket, shrink by shots toward the goalie's own pooled save %, and exclude the back-to-back bucket while the fitted term exists.
- **Readers.** `goalie-stage.ts:531-544` (`savePctAdjustment`, `restSplitAdjustment`), the reserve goalie row's `modeled_save_pct`, and the `rest_split` metadata on goalie rows.
- **Test.** Oriented fixture: last appearance yesterday selects the 0-day bucket; a 2-game bucket at .800 moves modelled save % by less than a stated bound; with the term on and off, saves and GA differ only through the final served row (rule 7). Held-out: the term must beat no-rest on a proper score before it is enabled.
- **Priority** P2. **Reach** live call, inert by table state (conditional). Do not change the WGO ingest to cumulative rows without fixing this first.

**N2. Market flag "confidence" is an edge ratio (M-FRG-184, 185).**
- `confidence_0_to_100 = min(100, |edge| ÷ threshold × 50)` (`market-output-builders.ts:77-90`). At the threshold it is 50; at twice the threshold, 100. For game flags the edge is in goals against 0.4 (totals) or 0.5 (spreads); for props it is a probability edge against 0.05 (`:590`).
- It measures neither the chance the flag is right nor a calibrated quantity. With the spread sign error (W1-6 D4b: +2.30 where −0.70 is right) the stored value is 100 on a wrong-way flag.
- **Fix.** Rename the stored field to what it is (edge-to-threshold ratio) or drop it; if a confidence is wanted, derive it from the model probability and its calibration evidence (decisions 30, 35). Fix with W1-6 D4b, D17, D18 and W1-7 D6, before odds ingestion resumes.
- **Readers.** No application reader found (`rg confidence_0_to_100`: the builder, generated types and `sql/ratings/002_…sql` only). Check any external reader of the flags table before renaming the column; a column rename is a migration.
- **Test.** A flag at exactly the threshold does not present as "50% confident"; the corrected spread fixture (3.4, 2.6, −1.5) produces no home-cover flag at any confidence.
- **Priority** P2. **Reach** dormant.

**N3. Research context: shot volume does not reach assists (M-FRG-154).**
- `projectContext` scales the player's shots by `shotVolume`, so his goals rise, but on-ice goals use only `opportunity` and `goalEnvironment` (`context.ts:31-35`). A team-level +3% shot-volume effect raises his goals 3% and his assists 0%.
- **Fix.** Decide the channel's owner: either team shot volume also scales on-ice goals, or the type forbids team-owned `shotVolume` effects. **Test.** A team-owned shot-volume multiplier m with other factors neutral scales goals and assists by the same m.
- **Priority** P2. **Reach** research (no non-test importer).

**N4. Research goal folds are scored by MAE only (M-FRG-157).**
- `teamMAE` and `meanPlayerMAE` are the only loss summaries (`researchGameGoals.ts:341-347`). For sparse goal counts the absolute-error optimum is the median, usually 0, so the comparison rewards the lower forecast rather than the better mean. Decision 65 makes squared error, deviance or log score primary.
- The output already says `forecastLift: "not_established"`, so nothing is over-claimed today.
- **Fix.** Add squared error and Poisson deviance per fold, paired across models on the same folds, with MAE secondary. **Test.** On a simulated Poisson fixture the true-mean forecast beats a constant-zero forecast on the primary score.
- **Priority** P2. **Reach** research.

**N5. Research opponent blend has no league reference (M-FRG-160).**
- The `opponent_blended` budget is 0.5 × own goals for + 0.5 × opponent goals against, per cell (`researchGameGoals.ts:190-193`). A strong offence against a weak defence is averaged, not compounded: own 3.5 and opponent-allowed 3.5 at a league mean of 3.0 give 3.5, where own × opponent ÷ league gives 4.08.
- The file labels the weights "unfitted research choices", so this is a modelling limit, not an arithmetic error (rule 16). It needs a decision before any promotion (decision 27: fitted on held-out games).
- **Priority** P2. **Reach** research.

**N6. Correction to W1-6 007: reserve shutout (M-FRG-163).** `buildReserveGoalieRow` leaves `proj_shutout_prob` unscaled while counts are multiplied by the horizon scalar (`reserveProjections.ts:157-158`). W1-6 listed that as an inconsistency with lineup rows. Under decision 28 the reserve row is the correct one. No reserve change is needed; W1-6 D24 fixes the lineup side.

**Nit (no defect raised).** `runMetricsFinalizationStage` reports the recent-rate shares as 0 when no player was considered, and the pool average as null (`metrics-finalization-stage.ts:50-67`). Rule 5 prefers null for both. Operational metric only.

## 4. Owner questions

None that decisions 1–79 leave open. N1 follows decision 60, N2 follows decisions 30 and 35, N4 follows decision 65. N5 becomes a question only if the research goal kernel is proposed for promotion.

## 5. Limits

- Cross-check only. Covered entries rely on the upstream audit; I did not re-derive them.
- `researchGoalBaseline.ts:131-249`, `nativeIntervalReconciliation.ts:141-268` and the unread remainder of `forge-v2/schedule.ts` were not opened. M-FRG-162 is judged on `:102-130`.
- N1's inertness rests on one dated table state (2026-11-11). Stored goalie-row metadata was not read (jsonb reads are not allowed), so "always 0" is inferred from inputs, not observed in output.
- N1's ±.003 and N5's 4.08 are hand calculations. No function was executed and no test was run.
- Reach for the research kernels comes from an import search (`rg` over `lib`, `pages`, `scripts`, `components`, tests excluded), not a traced call graph.
- No NST, NHL or Yahoo calls, no writes, no migrations.

## 6. Final analysis and fix-agent handoff

### Final analysis

Parts 3 and 4 add no new live defect. They are function-level records of code whose defects W1-6 and W1-7 already own: the all-situation gap and PK double count (decisions 24, 59), goalie slot mixtures (decisions 25, 63), the band and quantile work (decision 29), and the market items that gate decision 30. Astra's corrections stand unchanged here: the skater gap is the PK bucket only; 300 skater-minutes is not an oracle; discrete p10–p90 coverage above 80% is not miscalibration; the simulator must not collapse to one NB; ELITE is reachable; the pool-guard remedy is rejected.

The one finding on a live code path is the goalie rest-split term. It is wired into the goalie stage but fed a one-game row, so it contributes nothing. That is fortunate, because its bucket lookup is one day off the source's own definition and it would stack on the fitted back-to-back term. The risk is a future "fix" to the WGO input that silently turns it on.

The market flag confidence is a mislabel that the spread sign error turns into maximum confidence on wrong-way flags. It is dormant and belongs with the other pre-ingestion market fixes.

The research kernels (`research/skater-candidates/*`, `researchGameGoals.ts`, `researchGoalBaseline.ts`, `nativeIntervalReconciliation.ts`, `nativeSkaterParticipationResearch.ts`) are careful: they fail closed, keep unknowns unknown and label themselves research-only. Three modelling limits (N3, N4, N5) matter only if one is promoted.

### Recommendations, by priority

1. **P2, goalie lane. Disable or rebuild the rest-split term (N1).**
   - Files: `lib/projections/calculators/goalie-save-pct-context.ts` (`toGoalieRestSplitBucket`, `computeGoalieRestSplitSavePctAdjustment`); `lib/projections/queries/goalie-queries.ts` (`fetchGoalieRestSplitProfile`, `fetchGoalieWorkloadContext`); `lib/projections/stages/goalie-stage.ts:531-544`.
   - Readers: goalie row save % and its `rest_split` metadata; reserve goalie `modeled_save_pct`; anything reading `workloadPenalty` and `restSplitAdjustment`.
   - Test: the oriented bucket fixture and the bound in N1; a served-row test with the term on and off.
2. **P2, market lane. Replace the flag confidence (N2)** together with W1-6 D4b, D17, D18 and W1-7 D6.
   - Files: `lib/projections/utils/market-output-builders.ts` (`buildFlagConfidence`, `buildModelMarketFlagRow`, the override at `:590`); `lib/projections/run-forge-projections.ts:1070-1116`.
   - Readers: none in the app; confirm external readers of the flags table first.
   - Test: the threshold and spread fixtures in N2.
3. **P2, research lane. Before promoting any research goal kernel (N3, N4, N5):** make the shot-volume channel consistent, add proper scores to the folds, and fit the opponent blend against a league reference on held-out games.
   - Files: `research/skater-candidates/context.ts` (`projectContext`); `researchGameGoals.ts` (`teamKernel`, `evaluateResearchGoalChronologicalFolds`).
4. **No change: reserve shutout (N6).** Record the correction against W1-6 007 so D24 is applied to lineup rows only.

### Directional suggestions (not defects)

- Remove the unused `computeWorkloadSavePctPenalty` import and mark its constants as legacy, after a dependency inventory (rule 6; W1-6 D29). Its penalties are positive numbers ten times the fitted live terms.
- Return null, not 0, for the empty learning shares in `runMetricsFinalizationStage`.
- Delete or clearly mark the `simulationSamples <= 1` normal-approximation branch (`uncertainty.ts:117-135`): its quantiles are non-integer and are not Poisson quantiles at small means.
- In future inventories, drop "consumers" for module-private helpers; several here point at unrelated same-named symbols.

### Context a fix agent needs

- **Decisions:** 25 and 63 (goalie candidate rows, relief), 28 (no probability × horizon), 30 (odds ingestion waits for the market fixes), 35 (a ratio or percentile is not confidence), 60 (legacy rest buckets stay until beaten), 65 (proper scores first).
- **Units and scales.** `wgo_goalie_stats` rows are per game. Source rest buckets are gap − 1 days. Save % terms are fractions (.003, not 0.3). `GOALIE_CONTEXT_SAVE_PCT_PASS_THROUGH` is 0.25 and multiplies the rest-split and context shifts, not the fitted back-to-back term. Game flag edges are goals; prop flag edges are probabilities.
- **Nulls.** `safeNumber(…, NaN)` marks a missing bucket save %; keep it unknown. `daysSinceLastStart` null maps to "4_plus"; treat null as unknown when rebuilding.
- **Do not change.** The research files' fail-closed returns and `researchOnly` / `acceptanceEligible: false` labels; the reserve shutout; the Start Chart rank contract (nulls unranked, competition ties); the disclosed shootout goal in team form.
- **Ownership.** The starter-probability inputs and `forge_goalie_game` credited-start work belong to the W1-5 fix order; do the rest-split rebuild after it, because it needs credited starts. FORGE v2 (`lib/forge-v2/*`) is disabled and not part of any fix lane here.
- **Production steps needing owner approval.** Renaming or dropping `confidence_0_to_100` (migration); any change to the WGO goalie ingest shape; re-enabling odds ingestion (decision 30). N1's code-only disable needs none.
- **Suggested lanes.** (1) Goalie model lane: N1, after the W1-5 outcome fix. (2) Market lane: N2 with the existing market items. (3) Research lane, only on promotion: N3 to N5.
