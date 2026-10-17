# Next experiment: one fixed prior-pool contrast for HIT and TOI

**PROPOSAL ONLY.** Prepared from released B aggregate results, accepted receipts and approved formula definitions. No forecast/label bodies opened, new fit/score/bootstrap performed, or Jan14+ access. B and its default M0 remain immutable. This proposal introduces one explicitly NEW grouping rule for future approval; it is not an already-approved recipe or a demonstrated improvement.

## What explains the observed regressions

Let r=C/E be own historical HIT per minute, m5 recent-five mean minutes, Rp the global exposure-weighted HIT rate, n own appearances, T own mean minutes and Tp the global appearance-weighted minute mean. For supported own history:

- HIT M1−M0 = r × (m5−E/n), with matched target histories. This changes the exposure estimate; it does not establish a real-world role change.
- HIT M2−M1 = m5 × [180/(E+180)] × (Rp−r). M1/M2 share m5, support and fallback rules. Their contrast isolates the added shrinkage operation in this fixed computation, not a causal effect of pooling generally or a percentage attribution of squared error.
- TOI M2−M0 = [10/(n+10)] × (Tp−T). Reported M2 TOI does **not** use m5. Its regression cannot be attributed to the internal recent-minute multiplier used by its count heads. M1 TOI is m5 and is a separate exposure estimator.

The no-own-history fallback is identical across policies (90 development cases, six continuation cases), so it cannot explain their differential losses. It remains a shared weakness, not addressed by the proposed experiment.

### Existing errors and paired differences

All entries below are copied or arithmetically contrasted from the released aggregate—not newly scored. MSE units are HIT² or minutes²; MAE units are HIT or minutes. Positive paired gain means improvement versus M0. Each development row uses8,243 matched cases; continuation uses1,260.

| Target/period | M0 MSE / MAE | M1 MSE / MAE | M2 MSE / MAE |
|---|---|---|---|
| HIT development | 1.411293 / 0.873357 | 1.423920 / 0.877164 | 1.509518 / 0.920897 |
| HIT Jan8–13 | 1.363204 / 0.875984 | 1.377767 / 0.880371 | 1.469601 / 0.917909 |
| TOI development | 7.147261 / 2.033982 | 7.132838 / 2.027806 | 9.926338 / 2.433900 |
| TOI Jan8–13 | 6.993587 / 2.049608 | 6.468566 / 1.946709 | 8.724418 / 2.291227 |

| Development contrast | Paired absolute MSE gain vs M0 | Existing7-day95% sensitivity range |
|---|---:|---|
| HIT M1 | −0.0126270 | [−0.0187061, −0.0034853] |
| HIT M2 | −0.0982244 | [−0.1568663, −0.0541599] |
| TOI M1 | +0.0144228 | [−0.1711586, +0.1304525] |
| TOI M2 | −2.7790769 | [−3.1486272, −2.3946320] |

HIT's incremental M2−M1 MSE increase is0.0855974 in development and0.0918338 in continuation. No M2-versus-M1 uncertainty interval was published; do not subtract marginal interval endpoints or infer significance for that contrast. Existing paired MAE improvements relative to M0 are simply baseline MAE minus candidate MAE; individual-row absolute-error differences and their uncertainty were not released and are not requested here.

These bootstrap ranges are exposed-development sensitivity under unverified dependence/stability assumptions, not confirmatory coverage guarantees. The continuation has only six dates and is already exposed: its direction supports describing the same concern, not independent confirmation. M1's TOI development change is small with a sensitivity range spanning zero; its7.51% January gain does not establish a universal recent-five improvement. M2 HIT/TOI loss increases versus M0 occur in all four development folds and in continuation. The incremental HIT pooling contrast is not uniformly harmful across folds: M2 improves over M1 in fold1. Do not conflate those comparisons.

### Evidence for a pool-mismatch hypothesis, with limits

M2's small overall bias conceals opposite subgroup errors:

| Development group | HIT M0 bias → M2 bias | TOI M0 bias → M2 bias |
|---|---|---|
| Prior D (n2,736) | +0.03866 → +0.14408 | −0.11674 → −1.02618min |
| Prior F (n5,417) | +0.02171 → −0.10538 | −0.04991 → +0.64775min |
| Prior m5 below12 (n1,149) | +0.02164 → −0.60252 | −0.12184 → +2.94583min |
| Prior m5≥20 (n1,812) | +0.04953 → +0.26413 | −0.07041 → −2.03779min |

This is consistent with global pooling compressing heterogeneous player profiles. It does not prove position grouping will repair the errors or identify the sole mechanism. Usage and position groups overlap; they are not independent effects. Sparse-history HIT actually benefits from M2 while established-history HIT worsens, so “shrinkage is always bad” is unsupported. TOI's shared no-history fallback has +4.88450min bias across all policies—a separate issue. These are archive-derived prior groups, not certified pregame roles, rookies, trades or injury returns. Do not select a threshold or new group from the observed best losses.

## Minimal genuinely new rule to propose

Recommend **one fixed two-output M3**, keeping the existing M2 formulas and strengths exactly, changing only the prior pool from all skaters to prior-position F/D peers. This tests a concrete heterogeneity hypothesis motivated by released opposite F/D biases. It does not retune shrinkage strength, recent window or model family. Position grouping is the new proposed assumption; no result for it exists.

At each origin d, apply B's same d−2 eligibility. For each player, set originClass to the native historical role F or D from that player's last eligible positive-TOI appearance at or before d−2, ordered by the existing game_date/game_id/player_id convention; otherwise UNKNOWN. B admits native historical roles F/D only: do not invent a C/L/R/LW/RW mapping. Preserve every original role/team field and store originClass separately. Never use target-day/current identity position or actual target-day TOI.

For the target player's known F/D group, form the peer pool from eligible positive-TOI history of players whose last eligible position at that same origin matches it. Include own history. For HIT, sum target-valid HIT over matching valid positive minutes from those SAME records. For TOI, divide total eligible minutes by eligible appearance count, not by players or an average of player means. Retain each peer's eligible earlier records; classify each peer once per current origin and assign all its eligible history to that class, never using future observations. Use exactly this version rather than an alternative row-position or position-at-each-old-game pool. No minimum-sample threshold search: report pool counts and sparse pools, and preserve the following fixed fallback.

- HIT: M3=m5×(ownHIT+180×peerHIT/peerMinutes)/(ownMinutes+180).
- TOI: M3=(ownMinutes+10×peerMeanMinutesPerAppearance)/(ownAppearances+10).
- Branch order is fixed per target: (1) no eligible own target history → unchanged global APPEARANCE MEAN shared by M0/M1/M2; empty global pool → missing; (2) own history but required recent support absent → unchanged omission; (3) otherwise compute the class prior, with unknown/empty/invalid class pool → original global M2 PRIOR, explicitly logged (HIT exposure-weighted rate; TOI appearance-weighted mean). Do not use the class-prior fallback to override either earlier branch.
- UNKNOWN position and UNKNOWN_NO_OWN_HISTORY_OR_SUPPORT usage groups remain explicit; never invent a position or pooled m5 for cold starts.

M3's count multiplier and reported TOI still differ as in M2. This isolates prior-pool changes, not a unified latent-exposure architecture. All other target outputs are out of this experiment: no copied “winning-head” full vector and no new scores for G/A/SOG/BLK/PIM. A future complete-vector/utility experiment would need separate authority.

The tempting HIT=M1/TOI=M0 recomposition contains only predictions already generated in B. It would produce no new per-target evidence; it is posthoc head recombination, not this proposed experiment. No such blend is made or scored.

## Fixed comparisons, dates and budget

Comparators are B's preserved M0/M1/M2 forecasts, with their exact immutable output pins. **Do not refit or regenerate them.** One new M3 rule emits HIT and TOI only; primary new contrasts are M3 versus M2 (does the pool substitution help?) and M3 versus M0 (does it earn complexity?). M1 remains the existing unshrunk/recent reference, reported descriptively. No second M3, F/D strength grid, usage-band pool, alternate window, clipping or calibration variant.

Same normalized accepted-A input SHA e19b9753be67b7011b452d50f909055864a88c64c5959594617624a667c54c0e; no raw originals or new sources. Seed Oct7–Nov16,2025; development folds Nov17–30,Dec1–14,Dec15–Jan2,Jan3–7; Jan8–13 separately reported exposed diagnostics. Jan14 onward remains closed. At most52 origins and9,503 player-games ×2 outputs = **19,006 new values**; preserve missing forecasts and the full baseline comparison denominator.

One invocation, at most30minutes/8GiB, concurrency1, no automatic retry, existing sole executor/evaluator, no new workers. Same reviewed supervisor with conservative7GiB sampled guard plus actual peak accounting and1800s watchdog; disclose that sampling is not a hard OS memory guarantee. No work overlapping today's live pilot; existing owners recheck scheduling/resource availability before launch without changing it. A new durable private root, proposed `forge-hit-toi-peer-pool-development-20261015-v1`, preserves B/A and all earlier evidence.

Before execution, direct approval and existing-evaluator acceptance must bind this exact new rule, input/forecast hashes, group mapping, peer eligibility/fallbacks, code/runtime, metrics and resource checks. Synthetic engineering tests may verify arithmetic, d−2/prior-position isolation, unknown/empty groups, unchanged comparator bytes and resource stops only after implementation is authorized. They are not predictive evidence. No real-data smoke run.

Forecasts freeze before each day's scoring release; current-day target values remain outside features. All data are already exposed, and the new hypothesis is post-B development adaptation; staging does not restore independence. A future fit/score approval must explicitly include using the accepted normalized values and frozen comparator forecasts for this bounded comparison; this planning request does not.

Per-target primary score: paired player-game-weighted MSE, absolute and relative gains where baseline loss>0; secondary MAE/RMSE/bias and fixed prior-group summaries. Approval and executable review must bind frozen common comparison keys from B for each target and contrast. Coverage must use the same baseline-covered cases; if M3 misses any required case, withhold the complete-coverage primary comparison and report the failure. Any intersection score is explicitly secondary with its denominator; no post-result key changes. Existing B counts are8,243 development and1,260 continuation per target. No promotion threshold is required to report descriptive scores; M0 remains default regardless of the comparison until a separate decision.

If approved, compute exactly2,000 shared paired calendar-block bootstrap draws at7days plus2,000 at14days, same predeclared mechanics/seed20261015 as B; apply the same sampled blocks jointly to all four primary columns (HIT M3vsM0, HIT M3vsM2, TOI M3vsM0, TOI M3vsM2), using ratio-of-loss-sums/counts. M1 comparisons remain descriptive references, not an additional bootstrap selection family. No new bootstrap was done for this proposal. Report sensitivity only, not confirmatory confidence/multiplicity claims. Jan8–13 remains separate; no policy updates from that diagnostic. Return every fixed comparison, including losses, with no candidate replacement, automated promotion or winner blend.

Stop on data/code/date drift, target expansion, comparator mismatch, leakage, broken accounting or resource limits; retain actual terminal evidence without rerun. No new acquisitions, production writes/deployment, Jan14+ access, PPP/goalie validation or live-pilot changes. Preserve immutable inputs/outputs outside `/tmp`, with verified authorized durable backup before cleanup.

## Decision required / exact approval request

“Approve one separately gated retrospective HIT-and-TOI development experiment with one new fixed prior-position F/D pooled variant of M2, retaining180 pseudo-minutes for HIT and10 pseudo-appearances for TOI and all existing d−2/fallback rules. Compare against the already frozen M0/M1/M2 outputs without rerunning them, on the same exposed development folds through Jan7 and separately reported Jan8–13. Cap19,006 new values, one run,30minutes/8GiB and no automatic retry. Require independent protocol/runtime/synthetic review first. Report paired errors, uncertainty and coverage; no tuning, promotion, head blending, Jan14+ access, new sources or live-pilot changes.”

TJ may instead stop at the existing diagnosis and retain M0; that requires no additional data/model work. The F/D-pool hypothesis is the only new recipe proposed, not a request to choose among several pools after inspecting outcomes. Independent evaluator planning review is to be bound separately; this draft is not an execution gate.

Evidence: released B aggregate SHA5733050c65c655e5ac52a18ecd5a06f8a37d9786be8e1b662e555d8d195c6d94 and final review SHAeec8716fdc30a23a18017f265d65f8df2b11625f2c8b88e84d3d71ac63b39bfe under `/Users/tim/Documents/FHFH-private/forge-core-multioutput-development-b-20261015-v1/`. All numerical values above are released aggregate results or simple contrasts of them; no row-level errors were examined.
