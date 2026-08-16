# FHFH Player Forecasts — Deep Research Report

Status: approved for private shadow backtesting  
Contract: `player-forecasts-research-v1`  
Contract SHA-256: `9d4a30f5027e8b277015c592a39715e16d18c9a371dd352ddd4f0738868d9574`  
Decision date: 2026-08-02

This report converts the research plan and repository audit into an executable private-shadow contract. Numeric promotion rules are preregistered product-risk policies, not claimed empirical findings. They remain provisional until the sealed lockbox is evaluated.

## 1. Executive Decision Memo

**Decision.** Build a position-aware, decomposed probabilistic forecast: availability/start probability, conditional opportunity/workload, conditional event distributions, then an explicit unconditional mixture. Use interpretable empirical-Bayes and penalized generalized-linear baselines as the primary architecture; gradient-boosted models are challengers. Keep raw hockey outcomes upstream of fantasy scoring.

The MVP covers forwards, defensemen, and goalies for every scheduled game in each team's next ten games. It forecasts skater playing probability, conditional ice time and raw events, goalie start probability, conditional workload and goal prevention, and their unconditional mixtures. Every revision is immutable and cutoff-addressable.

FORGE is retained only as a frozen benchmark. Its coefficients and fantasy-weighted objective are ineligible as candidate features or labels. Neural sequence models, embeddings, and elaborate state-space models are deferred until simpler candidates demonstrate an unresolved performance ceiling.

**Evidence grade:** B for architecture and scoring practice; C for target-specific NHL lift.  
**Confidence:** medium.  
**Unvalidated:** FHFH-specific chronological lift, subgroup behavior, and operational cost.  
**Would change the decision:** sealed chronological evidence showing a simpler direct model or a challenger materially dominates without calibration, subgroup, or operational regressions.

## 2. Research Method and Source Audit

The audit combined the repository inventory, read-only hosted schema queries, primary academic sources, and official platform documentation. Consequential statements are classified as literature evidence, executed repository audit, executed data audit, reasoned recommendation, or untested project hypothesis.

Hosted 2025–26 coverage observed on 2026-08-02:

| Dataset | Rows | Coverage | Classification |
| --- | ---: | --- | --- |
| Games | 1,521 | 2025-09-20–2026-06-17 | Executed data audit |
| Regular-season games | 1,312 | 2025-10-07–2026-04-16 | Executed data audit |
| Skater-game outcomes | 53,846 | 2025-09-20–2026-06-14 | Executed data audit |
| Goalie-game outcomes | 5,987 | 2025-09-20–2026-06-14 | Executed data audit |
| Normalized play-by-play | 443,657 | 2025-10-07–2026-06-14 | Executed data audit |
| Normalized shifts | 1,055,088 | 2025-10-07–2026-06-14 | Executed data audit |
| Generic line-source snapshots | 871 | begins 2026-04-30 | Executed data audit |
| CCC line snapshots | 927 | begins 2026-04-24 | Executed data audit |
| Player-status observations | 101 | begins 2026-04-21 | Executed data audit |

The regular-season chronological midpoint is 2026-01-03. Lineup, injury, and starter archives begin too late for the full second-half lockbox; they are prospective-enriched inputs only. WGO/NST fields remain conditional on a separate definition, rights, and historical-availability audit. A row's event date alone does not prove it was available at a forecast vintage.

The primary literature supports shrinkage/regularization for sparse, confounded hockey effects and competing-process modeling, but does not establish a production winner for FHFH's next-game targets. Proper scoring rules support evaluating complete distributions rather than point estimates alone.

**Decision.** Treat the repository's immutable NHL event/shift pipeline as the historical core and all timestamped news/lineup observations as a distinct prospective track.  
**Evidence grade:** A for repository coverage facts; B for evaluation methodology.  
**Confidence:** high.  
**Unvalidated:** provider rights and reconstructable WGO/NST availability.  
**Would change the decision:** an immutable provider archive proving complete pre-cutoff history.

## 3. Forecast Target Matrix

| Population | Probability | Conditional distribution | Unconditional output |
| --- | --- | --- | --- |
| Forward | plays | TOI, goals, assists, shots, blocks, hits, PIM | zero-mass plus conditional-playing distribution |
| Defense | plays | TOI, goals, assists, shots, blocks, hits, PIM | zero-mass plus conditional-playing distribution |
| Goalie | starts | shots against, goals against, saves | zero-mass plus conditional-start distribution |

Bernoulli targets use probabilities. Positive continuous TOI uses a Gamma-family baseline. Overdispersed event counts use negative-binomial baselines; PIM uses a hurdle count baseline. Goalie goals against are conditional on workload through a beta-binomial partial-pooling baseline, and saves are reconciled as shots against minus goals against.

All targets store `target_key`, target version, conditioning, unit, distribution, parameters, and p10/p25/p50/p75/p90. Fantasy points are never a training label.

**Decision.** Adopt the exact target list in `research-contract-v1.json`; additions require a new contract version.  
**Evidence grade:** C.  
**Confidence:** medium.  
**Unvalidated:** which lower-frequency categories clear the strongest baseline.  
**Would change the decision:** poor support or irreducible calibration failure in chronological folds.

## 4. Evidence-Ranked Metric Library

1. **Tier A — transparent historical core:** games, player-game outcomes, normalized play-by-play, shifts, position, team/opponent identity, home/away, rest, prior TOI and strength-state opportunity.
2. **Tier B — derived cutoff-safe features:** expanding career/season rates, last-5/10/20 rates, tuned exponential decay, empirical-Bayes position/role shrinkage, team/opponent historical rates, missingness indicators.
3. **Tier C — prospective enriched:** observed lineup, pair, power-play, scratch, injury, and goalie-start evidence with source and `available_at`.
4. **Conditional:** WGO/NST and proprietary fields only after definition/version/rights/availability audits.
5. **Rejected:** unrestricted latest-state joins, full-season rebuilds at historical cutoffs, FORGE coefficients, fantasy scores, post-cutoff confirmations, and future target columns.

Every transformation is fitted inside a chronological fold. Missingness is explicit; it is not silently replaced by present-day state.

**Decision.** Historical-core features define the lockbox model; enriched features define a separate prospective challenger.  
**Evidence grade:** A for availability; C for incremental predictive value.  
**Confidence:** high on legality, medium on lift.  
**Unvalidated:** ablation value by family.  
**Would change the decision:** chronological ablations showing no benefit or unstable definitions.

## 5. Relationship Analysis

The ordered empirical program is: persistence, opportunity persistence, recency windows, exponential decay, shrinkage, position heterogeneity, finishing, schedule context, goalie workload/prevention, then provider/enriched ablations. Each analysis reports sample support, cutoff legality, fold, baseline, paired loss difference, and dependence-aware uncertainty.

Regularized hockey player-effect research demonstrates that sparse, collinear on-ice observations require shrinkage; it does not justify transplanting coefficients into next-game player forecasts. Competing-process models support separating event intensities. These findings motivate, but do not prove, the decomposed design.

**Decision.** No relationship becomes a production feature merely because it is contemporaneously correlated. It must improve a later chronological fold.  
**Evidence grade:** B.  
**Confidence:** high.  
**Unvalidated:** FHFH effect sizes.  
**Would change the decision:** none; this is a leakage-control invariant.

## 6. Recommended Baseline and Sustainability System

Every target runs a frozen tournament: position prior, previous-season rate, career rate, multi-season weighted rate, season-to-date, last 5/10/20, tuned exponential decay, and empirical-Bayes opportunity-adjusted rate. The strongest valid chronological baseline becomes the comparator.

The recommended simple baseline is empirical-Bayes partial pooling over exposure, position, role, and season phase, updated with tuned exponential decay. Abrupt role changes enter through opportunity features and prospective observations, not manual performance multipliers.

**Decision.** Use the strongest tournament entry, not a predetermined easy baseline.  
**Evidence grade:** B.  
**Confidence:** medium-high.  
**Unvalidated:** pooling groups and decay values, which are tuned only in development folds.  
**Would change the decision:** consistent challenger lift with equal or better calibration.

## 7. Recommended Model Architecture

1. Availability: calibrated penalized logistic model; boosted-tree challenger.
2. Opportunity: penalized Gamma GLM for conditional TOI; boosted-tree challenger.
3. Skater events: position-specific penalized negative-binomial GLMs with exposure; boosted-tree challengers.
4. Goalie starts: calibrated multinomial/logistic model over eligible team goalies.
5. Goalie workload: negative-binomial shots-against model.
6. Goalie prevention: beta-binomial partial pooling conditional on shots.
7. Simulation/reconciliation: deterministic seeded draws preserving nonnegative counts, saves = shots − goals, and explicit zero-mass mixtures.

Direct models are retained as challengers. Candidate selection is target-specific; one family need not win every target.

**Decision.** Decomposed interpretable primary, nonlinear challenger, deterministic failure fallback.  
**Evidence grade:** C.  
**Confidence:** medium.  
**Unvalidated:** empirical winner by target.  
**Would change the decision:** sealed development evidence favoring a direct model with operational simplicity.

## 8. Horizon Construction

Forecast each scheduled game independently using that game's opponent, venue, rest, and cutoff state. H1–H10 is schedule order per team, not multiplication of a first-game estimate. Retain the first H10 opening even if schedule revisions reorder later horizons.

Player candles use opening, extrema across valid pregame revisions, final successful pregame close, final interval, revision path, and actual. Aggregate accountability uses standardized cohort checkpoints; it never chooses the best vintage separately per player after outcomes are known.

**Decision.** Per-game schedule-aware forecasts with explicit vintage reconciliation.  
**Evidence grade:** reasoned recommendation.  
**Confidence:** high.  
**Unvalidated:** cross-game dependence needed for multi-game totals.  
**Would change the decision:** evidence that joint simulation materially improves calibrated aggregate distributions.

## 9. Backtesting and Acceptance Framework

Primary 2025–26 regular-season design:

- Development ends 2026-01-02.
- Lockbox runs 2026-01-03 through 2026-04-16.
- Tuning uses rolling-origin folds entirely inside development.
- The lockbox may be evaluated once.
- Slate-date block bootstrap supplies 95% paired intervals.
- Post-lockbox model changes convert the result to validation and require untouched 2026–27 prospective confirmation.

Losses are MAE and negative log likelihood for counts/continuous targets, Brier/log loss for probabilities, weighted interval score/coverage error for distributions, and ECE/calibration slope for reliability.

The versioned 0–100 skill index transforms each baseline-normalized loss to `clip(50 + 50 × relative loss reduction, 0, 100)`. It macro-averages position × target × horizon before applying 40% point/count accuracy, 25% probability accuracy, 20% distribution quality, and 15% calibration. A score of 50 equals the frozen baseline.

Provisional promotion policy requires at least 2% primary relative loss reduction, a paired 95% lower bound above zero, probability losses no more than 1% worse, no critical subgroup more than 5% worse, 80% interval coverage error at most five percentage points, deterministic replay, zero post-cutoff inputs, and all SLOs passing.

**Decision.** Seal manifests and evaluation receipts before accessing lockbox labels.  
**Evidence grade:** A for chronology/proper scoring principles; D for policy magnitudes.  
**Confidence:** high on design, low on threshold optimality.  
**Unvalidated:** whether any candidate clears the gates.  
**Would change the decision:** user-utility or cost evidence supporting revised thresholds in a new preregistered contract.

## 10. Continuous-Learning and Monitoring Design

Daily canonical seeding runs at 10:00 UTC; source updates debounce for five minutes. Training is offline and never triggered by a user request. Outcomes settle provisionally the next morning, rescore append-only for 48 hours, then finalize. Drift, calibration, missingness, queue age, cutoff misses, artifact integrity, subgroup support, and cost are monitored by model and contract version.

Continuous learning means scheduled challenger retraining and evaluation, not automatic champion replacement. Promotion and rollback remain explicit audited actions.

**Decision.** Human-approved champion–challenger lifecycle.  
**Evidence grade:** reasoned operational recommendation.  
**Confidence:** high.  
**Unvalidated:** optimal retraining cadence.  
**Would change the decision:** sustained drift or cost evidence.

## 11. Supabase/PostgreSQL Integration Blueprint

Immutable observations feed a versioned resolver, feature snapshots, leased inference jobs, runs, outputs, outcome revisions, evaluations, and accountability revisions. Model artifacts use private checksum-addressed Storage paths. Browser clients receive data only through authenticated Next.js APIs. Anonymous/authenticated database grants remain revoked; service-role grants are explicit; RLS is forced.

The Python Function receives immutable identities and checksums. It must reject contract, feature, or artifact mismatches. Next.js coordinates and persists; it does not implement statistical logic.

**Decision.** Use the `player_forecast_*` contract already introduced by the foundation migration.  
**Evidence grade:** A for repository fit.  
**Confidence:** high.  
**Unvalidated:** preview load and cost.  
**Would change the decision:** preview SLO or platform-limit failure.

## 12. Phased Implementation Roadmap

1. Restore migration parity, readiness, fixtures, RLS tests, and contract-only preview.
2. Freeze/audit historical data and execute development-only baseline experiments.
3. Train candidates, register immutable artifacts, and prove deterministic inference.
4. Run the one-time lockbox evaluation and publish the sealed evidence report.
5. Operate a private 2026–27 prospective shadow challenger.
6. Request explicit production activation and, later, champion approval.

## 13. First Ten Experiments

1. Dataset coverage and cutoff legality by source.
2. Position-prior versus career/season/multi-season baselines.
3. Last-5/10/20 versus tuned exponential decay.
4. Empirical-Bayes shrinkage by position and exposure.
5. Conditional TOI persistence and role-change error.
6. Skater count distribution diagnostics.
7. Forward versus defense model sharing.
8. Goalie starter and workload baseline calibration.
9. Team/opponent/rest context ablation.
10. Full decomposed model versus strongest direct baseline.

Experiments 1–10 are development-only. The lockbox is not an eleventh tuning experiment.

## 14. Risks, Contradictions, and Open Questions

- Historical lineup/status coverage is inadequate for the primary lockbox.
- WGO/NST availability and rights remain conditional.
- Rare-event targets may not support stable subgroup estimates.
- A 0–100 composite can conceal target failures; raw metrics remain mandatory.
- Goalie candidate-set reconstruction may be incomplete historically.
- Schedule revisions and trades require time-valid identities.
- Preview branches contain schema but no production data; fixtures prove infrastructure, not model validity.
- Platform cost/SLO evidence is not yet available.
- Numeric promotion magnitudes are governance policy, not empirical truth.

No open question permits leakage, automatic promotion, historical timestamp fabrication, or fantasy-target contamination.

## 15. Bibliography and Source-Evidence Matrix

| Source | Use | Evidence class |
| --- | --- | --- |
| Gramacy, Taddy & Tian, [Estimating player contribution in hockey with regularized logistic regression](https://doi.org/10.1515/jqas-2012-0001) | Regularization under hockey-player confounding | Direct literature |
| Macdonald, [A Regression-Based Adjusted Plus-Minus Statistic for NHL Players](https://doi.org/10.2202/1559-0410.1284) | Exposure/context-adjusted player effects | Direct literature |
| Macdonald, [Adjusted Plus-Minus using Ridge Regression](https://doi.org/10.1515/1559-0410.1447) | Shrinkage and alternative event responses | Direct literature |
| Thomas et al., [Competing process hazard function models for player ratings in ice hockey](https://doi.org/10.1214/13-AOAS646) | Decomposed event intensities | Direct literature |
| Gneiting & Raftery, [Strictly Proper Scoring Rules, Prediction, and Estimation](https://doi.org/10.1198/016214506000001437) | Distribution/probability evaluation | Direct literature |
| Tashman, [Out-of-sample tests of forecasting accuracy](https://doi.org/10.1016/S0169-2070(00)00065-0) | Chronological evaluation | Direct literature |
| [Supabase Branching documentation](https://supabase.com/docs/guides/deployment/branching) | Isolated schema preview and data-less branch behavior | Official platform evidence |
| [Vercel Functions documentation](https://vercel.com/docs/functions) | Bounded Python/Node function serving | Official platform evidence |
| Repository audit documents in this directory | Existing systems, leakage, contracts, and integration | Executed repository audit |
| Hosted read-only coverage queries dated 2026-08-02 | FHFH data support and historical gaps | Executed data audit |

The source matrix does not claim that adjusted plus-minus methods directly forecast the selected box-score targets. Those papers support regularization and decomposition principles; target-specific selection remains an FHFH chronological experiment.

# 2026–27 season-platform addendum (v3)

The executable season contract is
`research-contract-v3-season.json`, checksum
`29c6766f63ba9a8dbf8890cb6a388418945134b70217d58e9d8645b34dc36b93`.
It extends, but does not replace, the H1–H10 research contract. FORGE remains a
benchmark and is not an input to the candidate model.

The v3 historical-core baseline uses official NHL outcomes, Gamecenter-derived
events, normalized play-by-play, shifts, and the complete official schedule.
WGO is authorized only as a checksum-frozen settled outcome-label source for
historical assist and strength-state targets. It is never a cutoff-time feature,
and its retrospective rows receive no fabricated availability timestamp. NST and
retrospective lineup or goalie-current-state fallbacks remain excluded. Primary
and secondary assists are modeled separately; official assists remain their
arithmetic sum, because the tested fixed 70:30 and 80:20 alternatives did not
improve total-assist accuracy. Every frozen skater-game must name its label
source and satisfy A1 + A2 = settled assists; unresolved rows block training.
Player-specific rates remain on their observed scale: game evaluation may adjust
for pace and opponent defense, but it does not multiply those rates by the
current team's offense rating again. That prevents roster-derived team offense
from double-counting the environment already present in an established
player's history.

The initial August 12, 2026 audit found 32 teams, 1,344 unique regular-season
games, 84 games per team, 810 official offseason-roster players, 802 resolved
stable identities, and eight unresolved identities. After the owner resolved
those eight, the refreshed local freeze contained 1,090 eligible players and no
player-pool publication blocker. Its 141,488 skater-game outcome rows contain
42,688 complete normalized-play-by-play labels, 98,612 frozen WGO labels, 27
verified official-boxscore zero labels, and 161 final Gamecenter resolutions.
The reconciliation detected 149 PBP/WGO conflicts and checked 203 affected
rows against checksum-captured final NHL Gamecenter payloads. It corrected 161
rows and retained 42 selected-label/box-score disagreements because the final
official record supported the selected label. All rows identify their source,
all satisfy A1 + A2 = assists, and zero remain unresolved or invalid.

The raw WGO outcome values are complete for the required projection targets,
but its historical game-log metadata is not uniformly reliable: 347,791 of
441,274 audited `wgo_skater_stats` rows lack `game_id`, and 253,362 rows tagged
as 2024–25 fall outside that season's official date window. The freeze therefore
never trusts WGO `game_id` or `season_id`; it joins a player and game date to the
unique official NHL game and derives the season from that game. Ambiguous or
unmatched rows cannot enter the training freeze.

The verified historical-core artifact contains 1,090 player priors and 32 team
contexts. It uses chronological development folds to select among the frozen
population rate, empirical-Bayes decay/shrinkage, and penalized log-link GLM for
each population and target. The final local artifact selected 33 GLMs, five
empirical-Bayes models, and nine explicit population-rate fallbacks across 47
target policies; no selected policy had worse chronological MAE than its
reported baseline. Its checksum is
`11f21dfafd3a46c55b7ac8d8dbe588b0077eb43423423980d4c90a8391bbce53`.
The artifact reports held-forward MAE and predictive-interval coverage. Its
defensive rating uses position-regularized on-ice
shot-attempt and goal suppression adjusted for team and opponent. It is a
cutoff-safe baseline, not a proprietary expected-goals model; players lacking
eligible shift history retain an explicit adjusted-plus/minus fallback flag.
Prospect outputs are prior-based and carry wider uncertainty/fallback metadata.

The 2025–26 season is consumed training and validation evidence. It is not a
new blind test. The untouched evidence that can support later promotion begins
with the frozen 2026–27 opening artifact and separately settled model-only and
editorial projections.

Every remaining game is evaluated independently and then aggregated. Opening,
current full-season, and rest-of-season releases preserve their component
manifests, schedule/roster revisions, cutoff, artifact, source watermark, and
contract checksum. Raw projections and fantasy-scoring weights remain separate.
Historical participation denominators remain 82 games for the eligible prior
seasons; 2026–27 expectations and GP/start distribution bounds use its actual
84-game schedule.

Season settlement uses `player-forecast-season-accountability-v1`. It appends
provisional results after the source capture becomes available, appends any
correction through 48 hours, and then appends a final revision. Model and
editorial forecasts receive separate absolute/squared losses, probability
Brier/log losses, and p10–p90 coverage diagnostics. The 0–100 index retains the
v1 preregistered formula and 40/25/20/15 point, probability, distribution, and
calibration weights; raw losses always accompany it. Direct editorial season
deltas are allocated across remaining component games for daily diagnostics
and are also judged exactly against the final season total.
