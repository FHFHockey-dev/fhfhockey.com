# Audit W2: BLSH (Buy Low / Sell High), M-BLSH-001 to M-BLSH-016

Auditor: Claude (Fable), 2026-11-11. Read-only: no code, data or `web/scripts/blsh/**` changed. Paths are under `web/` unless stated.

## 0. Brief

**Questions.** (1) Is each of the 16 calculations algebraically right and true to its stated definition? (2) Does the served output follow owner decisions 32–35, 61 and 68 (supported production, pre-window baselines, list naming, window views, league reference)? (3) Are the provisional constants labelled as hypotheses (rules 8 and 12)? (4) What is BLSH's real reach today?

**Reference standards.** Luszczyszyn's Game Score (2016) for the Game Score track; method-of-moments empirical Bayes (Efron–Morris; Tango's regression to the mean) for the shrunk reference; Kish effective sample size for weighted baselines; the Gaussian conditional expectation for imputed process deltas; a Poisson count variance for rate uncertainty; the paired cluster bootstrap for forecast contrasts; owner decision 65 (proper scores first) for forecast scoring.

**Evidence.** The served frozen snapshot `lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json` (729 profiles, 551 scored, events through 2026-10-28); the forecast run `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/RESULTS.json` (28,876 evaluation origins, 511 players, 2023-24); one bounded aggregate on `wgo_skater_stats` (2026-10-15 to 2026-10-28, 3,282 player-games).

**Done when** every entry has a verdict with file:line evidence and reach, each defect has a magnitude on dated data where available, a fix, a valid test and a priority, and open owner questions are listed.

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 6 | 003, 008, 009, 012, 014, 016 |
| Mis-specified | 9 | 001, 002, 004, 005, 006, 007, 010, 013, 015 |
| Wrong | 1 | 011 (the served artifact, not the gate code) |
| Undetermined | 0 | |

**Reach, first.** Nothing in this family is visible in production. `pages/buy-low-sell-high/preview.tsx:13` and `pages/buy-low-sell-high/trade.tsx:12-13` return 404 when `NODE_ENV === "production"`; `PlayerAnalysisStudio` (the player-card reader of `retainedBlsh`) is imported only by its test. So there is **no P0**. Every finding below is conditional on the preview being promoted, or research.

**The scorer does not read FORGE.** Only the watchlist/trade path (`market.ts`, `skoElement/interpret.ts`) uses FORGE expectations, and it runs on fixtures. The sustainability → FORGE → BLSH loop named in triage therefore touches M-BLSH-002 only.

**The core algebra holds.** The production gap is a unit-variance z by construction, and the snapshot agrees: the baseline normalised gap has SD 0.998 across the 551 scored profiles. The problems are in what is served and what it is called.

### Top 5 findings by user impact (if the preview is promoted)

1. **The served lists are not the gated lists (M-BLSH-011).** The snapshot was built with mapper v1, so the 20-game, 5-game-window and headline-sign gates in `displayProfile.ts` were never applied. 167 of the 448 listed players (95 of 264 buy-low, 72 of 184 sell-high) fail at least one current gate; 123 have fewer than 20 personal games, and players with no personal history at all are listed against the regulars' average.
2. **A list is nearly everyone (M-BLSH-010).** Membership is by sign alone: 448 of 551 scored players (81%) are on a list. 34% of buy-low and 39% of sell-high members sit within half a standard deviation of their reference, and 71% and 65% within one. The gap distribution is skewed (skewness −0.67, median +0.22, mean +0.09), so 59.5% of baseline gaps read "buy low" and that list is 43% longer.
3. **The reference is 2.4 to 4 years old (M-BLSH-006).** The served arm A uses 2022–24 games only: reference age is 894 to 1,451 days for the 577 profiles that have one. Each gap mixes a 5-game streak with everything that changed in a player's career since. The recency-weighted arm C that decision 34 and 61 describe exists in code but is not what is served.
4. **"Supported" is not supported by the forward test (M-BLSH-013, 010).** The served adjustment (within-player β × 0.5) made next-5-game forecasts worse than the reference alone: MAE +0.0056 fantasy points per game (95% CI 0.0024 to 0.0087), RMSE +0.0084 (0.0044 to 0.0122). Decision 32 asks for weights from out-of-sample evidence; decision 35 says a luck signal alone is never a buy/sell call, and the lists are still named Buy-Low and Sell-High.
5. **The forecast rule can pass on the reference alone (M-BLSH-001).** `forwardPromise` came back true, but the process arm beat the plain reference by 0.0007 MAE on 0.738 (0.1%) and its RMSE interval spans zero. The rule also puts MAE first, against decision 65.

Also measured: the Game Score track counts all-situation on-ice goals, where Luszczyszyn's uses 5v5 (M-BLSH-004). On 3,282 player-games it changes 29% of rows, adds 0.058 per game for players with 3+ power-play minutes (7% of their mean) and takes 0.026 from players with none.

## 2. Per-entry table

Reach: **cond** = dev-only preview (production 404); **research** = offline harness; **dormant** = no mounted reader.

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| M-BLSH-001 | Mis-specified | `forecastEvaluation.ts:279-288` (rule), `:21,25` (constants); RESULTS.json | research | forecast report; snapshot `predictiveResearch` note |
| M-BLSH-002 | Mis-specified (inherited) | `market.ts:48-57`; `skoElement/interpret.ts:88-98,108-109,367-383` | dormant (fixtures; trade page 404) | trade comparison, Sko preview |
| M-BLSH-003 | Sound | `opportunity.ts:101-143,157-165,232,245-246` | cond | profile opportunity context; does not gate lists |
| M-BLSH-004 | Mis-specified | `productionReference.ts:55-58` | cond | stages 2–5, opportunity, forecast harness |
| M-BLSH-005 | Mis-specified | `productionReference.ts:239-247`; `currentWindows.ts:195-200` | cond | stage 2c, stage 3 covariance |
| M-BLSH-006 | Mis-specified (served arm) | code `productionReference.ts:186-218` sound; `currentWindows.ts:210-211`; snapshot `referencePolicy.arm` | cond | every gap, list and card |
| M-BLSH-007 | Mis-specified | `productionReference.ts:256-261` | cond | stage 3 |
| M-BLSH-008 | Sound | `productionReference.ts:277-294` | cond | stage 4 |
| M-BLSH-009 | Sound | `supportGap.ts:200-242` | cond | stage 4c |
| M-BLSH-010 | Mis-specified | `supportGap.ts:269-294` | cond | lists, cards, explanation |
| M-BLSH-011 | Wrong (served artifact) | `displayProfile.ts:249-256,417-426`; `researchSnapshot.server.ts:11`; `BuyLowSellHighPreview.tsx:154` | cond | preview lists, `retainedBlsh` |
| M-BLSH-012 | Sound | `supportGap.ts:477-529,630-645` | cond | player detail |
| M-BLSH-013 | Mis-specified | `supportGap.ts:8-9,146,188` | cond | stage 4b/4c, harness `P2_transfer` |
| M-BLSH-014 | Sound (C43 stands) | `currentInput.ts:3`, `validateRequest`, `qualifyCurrentInputs` | cond | stage 1 |
| M-BLSH-015 | Mis-specified (minor) | `researchSnapshot.ts:330-332` | cond | preview, player detail |
| M-BLSH-016 | Sound | `productionReference.ts:86-98`; `supportGap.ts:101-128` | cond | stages 2–4 |

## 3. Defects

### D1 (P1, cond). Served lists ignore the owner's gates — M-BLSH-011

`readCurrentBlshSnapshot` serves a fixed file whose `mapperVersion` is `blsh-display-profile-v1`; the preview renders the v3 gated lists only for v3 snapshots (`BuyLowSellHighPreview.tsx:154`). The gates added later (`displayProfile.ts:21-23,249-256`) are therefore absent from what is shown. `score` assigns a list without looking at `personal_n` (`supportGap.ts:294`), so the gate is the only protection.

- **Magnitude (snapshot of 2026-10-28, 448 listed):** fewer than 20 personal games 123 (77 BL, 46 SH); window under 5 games 40 (30, 10); headline FP gap against the list's direction 47 (19, 28); any of the three 167 (95, 72). Served order is tier, then |index| (25 of 25 match on both sides), not the FP gap.
- **Fix:** regenerate the snapshot with the current assembler and mapper v3 (Codex's lane), or refuse to render lists from a v1 snapshot. Update the pinned hash and byte count with it.
- **Test:** on the served file, assert every listed profile has `personalGames ≥ 20`, `window.games ≥ 5` and a headline gap in the list's direction; assert `mapperVersion` equals `DISPLAY_MAPPER_VERSION`.
- **Readers:** preview lists; `lib/player-cards/retainedBlsh.ts` pins the same hash (`RETAINED_BLSH_SHA256`).

### D2 (P1, cond). Sign-only membership, on a skewed gap — M-BLSH-010

`researchList` is BL or SH whenever the support gap and the baseline gap share a sign (`supportGap.ts:283,294`). There is no size condition, so the lists are a partition of almost every scored player, and five-game totals are right-skewed counts, so "expected minus observed" is positive more often than not.

- **Magnitude (551 scored):** 448 listed (81%); 43 conflicting; |normalised gap| median 0.70 on both sides, 90th percentile 1.33 (BL) and 1.86 (SH); one BL member in 264 is beyond 2. Baseline gap: mean +0.091, median +0.222, SD 0.998, skewness −0.67, 59.5% positive.
- **Fix:** a membership threshold on the standardised gap, or show only the top N and call the rest "within the usual range" (decision 33). Any threshold is a hypothesis to validate (rule 12). Judge the direction on a scale that is symmetric for count data, for example a mid-p Poisson tail of the window total, so a median player is not "buy low".
- **Test:** simulate window totals from each profile's own reference rate (no signal). The share listed should match the stated threshold's false-positive rate, and BL and SH counts should be equal within sampling error.
- **Not in the scale, and labelled so:** β uncertainty and the imputed-process variance (`missingProcessVarianceNotAddedToBaseline`).

### D3 (P1, cond). The served reference is the stale arm — M-BLSH-006

`assembleProfiles` arm A pools development rows only (`currentWindows.ts:210`), so 2024-25, 2025-26 and this season's pre-window games are left out. The snapshot states this (`referencePolicy.stale: true`, each profile shows its age). It is honest labelling, but it is not the baseline of decisions 34 and 61.

- **Magnitude:** reference age 894 to 1,451 days (577 profiles). 115 scored profiles have no personal reference and 48 have 1 to 19 games; for the first group the "reference" is the 2022–24 regulars' mean.
- **Fix:** serve arm C (`weightedBaseline`), which is pre-window by construction (`productionReference.ts:188`) and has the right Kish effective exposure (`:201,214`). Its 1.0 / 0.6 / 0.3 / 0.1 weights stay provisional until the reserve test reports.
- **Test:** for every served profile, the newest reference game is earlier than the window's first date and, where the player has current-season games before the window, the reference includes them.

### D4 (P1, cond). The support adjustment is unvalidated and the list names overclaim — M-BLSH-013, 010

β is a same-window, within-player association of production with ixG/60, on-ice xGF/60 and xGA/60, halved by `SHRINK = 0.5` (`supportGap.ts:8,188`). As a description of the window it is a luck measure. As evidence that production will persist, it failed: in the harness the same β (`P2_transfer`) was worse than the reference alone on fantasy points and Game Score, with G+A's RMSE also worse. A forward-fitted γ (`P2`) recovered 0.1%.

- **Magnitude on the snapshot:** median |adjustment| 0.46 FP against a median |baseline gap| of 2.57 (18%); support and baseline gaps correlate 0.971. The adjustment flips 43 profiles to "conflicting" and otherwise barely moves the answer.
- **Binding decisions:** 32 (weights from out-of-sample evidence), 35 (lists named for what they measure; a luck signal alone is never a trust/fade call), rule 12 (0.5 is a hypothesis).
- **Fix:** rename the lists to what they measure (for example "Producing below / above reference, process-adjusted"); keep β out of membership until a held-out test shows it helps, or fit the shrinkage. `SEASONS` is hard-coded and `fitPrior` throws on any other season (`:9,146`): pass seasons in.
- **Test:** on the reserved 2025-26 set, paired cluster-bootstrap contrast of `P2_transfer` against `P1` on squared error; adopt only if the interval is below zero.

### D5 (P2, research). Forecast decision rule — M-BLSH-001

- The rule (`forecastEvaluation.ts:283-287`) needs the process arm to beat the prior-season mean with an interval, but to beat the plain reference by a point estimate only. Result: P2−P0 FP MAE −0.0576 (−0.0716 to −0.0442), almost all of it P1−P0 (−0.0569); P2−P1 −0.0007 (−0.0012 to −0.0002), RMSE −0.0004 (−0.0010 to +0.0002).
- MAE is the primary score. Five-game fantasy means are skewed, so MAE rewards a median-like, low forecast. Decision 65 puts squared error first.
- One training season (2022-23, first window 2023-01-25) and one evaluation season; the report says exploratory.
- **Fix:** make P2−P1 on squared error the gating contrast, with its interval below zero; keep MAE secondary. **Test:** a synthetic set where P2 equals P1 plus noise must return `forwardPromise: false`.
- Sound here: prior-only origins (`:155-165`), player-cluster bootstrap with a seeded generator, conservative percentile indices (`:264`).

### D6 (P2, cond). Game Score variant — M-BLSH-004

`outcomes` adds 0.15 × (ES + PP + SH on-ice goals for − against) (`productionReference.ts:58`). Luszczyszyn's Game Score uses 5v5 goals. The display label is "FHFH WiGO Game Score", which marks it as a house variant but not how it differs.

- **Magnitude (2026-10-15 to 10-28, n = 3,282):** the PP+SH term is non-zero in 29.2% of rows, mean +0.0056, SD 0.101, against a Game Score SD of 0.836; correlation of the served value with the ES-only value 0.993. Rows with PP TOI ≥ 180 s (n = 583): +0.058 per game on an ES-only mean of 0.830. Rows with PP TOI < 10 s (n = 1,373): −0.026.
- The SAT term looks 5v5 (mean SAT difference +1.05 for the PP group, −0.57 for the no-PP group), so the track mixes a 5v5 shot term with an all-situations goal term. Inferred from that split, not confirmed against the NHL report definition.
- Effect on gaps is smaller than on levels, since window and reference share the definition; it matters when a player's PP role changes.
- **Fix:** use ES on-ice goals, or keep the variant and state the difference on the page. **Test:** a row with one PP goal for and nothing else must change the track by exactly 0 (5v5 version) or the label must say all situations.
- Also: the track is `raw_points` in `PRODUCTION_TRACKS` (`:8`) and `goals_plus_assists` elsewhere; one name.

### D7 (P2, cond). Reference estimator details — M-BLSH-005, 007

- `personalReference` uses one scalar weight for all three tracks (`:256-259`); snapshot weights are 0.77 at the median, 0.83 at the 90th percentile. A track-by-track or matrix weight `S(S + Ω/t)⁻¹` would shrink noisy G+A more and steadier FP less. The posterior covariance (`:261`) is the right error of the estimator for any weight, so the gap's scale stays honest; only efficiency is lost.
- The metric is the inverse of `observedCov + noise` (`:240,247`), and `observedCov` already contains the sampling noise, so noise is counted twice in the metric and in the units used for the PSD projection (`:242-245`). It changes only how tracks are weighted inside the scalar. Intent is not documented.
- Donors must have a complete, single-position 50 games (`currentWindows.ts:197-198`), so the cohort mean is a regulars' mean. Combined with D3 it is the reference for every newcomer.
- Donor cutoff `"2026-07-01"` is hard-coded (`currentWindows.ts:199`; C43).
- **Fix:** per-track weights (fit and compare, rule 12); document or correct the metric; state the donor population on the page (decision 68). **Test:** with one track's noise set far above the others, that track's reference must move toward the cohort more than the others.

### D8 (P2). Smaller items

- **M-BLSH-002 (dormant).** The gap compares FORGE's expected per scheduled team game with recent output per team game; units and "unknown is not zero" hold. It inherits W1-6 D1: FORGE skater lines omit short-handed and extra-attacker production (fantasy points −5.5% in that audit's ledger sample), while the observed side is all situations. With sign-only membership (`interpret.ts:108-109`) a level player reads "cooling". Fix with decision 24; then add a magnitude rule.
- **M-BLSH-003.** Comparison (a) scales by `SD·√n` (`opportunity.ts:232`) and leaves out the uncertainty of the baseline mean, so z is overstated by √(1 + n/n_eff), 11.8% at n = 5 and n_eff = 20. The 0.5 band, 3,600 PP pseudo-seconds and 1,800-second floor are labelled provisional (`:32`). The PP rate variance (`:245`) is the correct Poisson form.
- **M-BLSH-015.** `currentStateLabel` appends "stale reference" unconditionally (`researchSnapshot.ts:331`); it becomes false once arm C is served. Read `referencePolicy.stale`.
- **M-BLSH-011 ranking.** The v3 order is the raw FP gap (`displayProfile.ts:421-423`). Across the served list members, |FP gap| correlates 0.45 (BL) and 0.28 (SH) with the player's reference level, against 0.18 and 0.12 for the standardised gap; among those that pass the gates, the top 25 by FP gap have a median reference of 12.9 FP (BL) against 9.9 for the pool, and share 19 (BL) and 18 (SH) names with the top 25 by standardised gap. A presentation choice; label it "largest fantasy-point gaps", not strongest evidence.
- **M-BLSH-014.** Gates are sound; season 20262027, game-id year 2026 and the July bounds are hard-coded (C43, already logged).

## 4. Owner questions not answered by decisions 1–68

1. **Membership size.** Should a BLSH list need a minimum standardised gap (and which), or stay sign-only with only a top N shown?
2. **Ranking basis.** Order by raw fantasy-point gap (favours high-usage players) or by the standardised gap?
3. **Decision 35 scope.** It was written for the sustainability lists. Does it also rename "Buy Low / Sell High" for a retrospective gap?
4. **Game Score.** Keep the all-situations on-ice goals variant with an explicit label, or move to 5v5 goals?
5. **Snapshot.** Should the preview refuse a v1 snapshot until Codex's lane regenerates it with arm C and mapper v3?
6. **Support model.** Given the forward test, should β stay in list membership, become context only, or be refitted?

## 5. Limits

- No Vitest run and no recomputation of the prior matrices; verdicts on stages 2–4 rest on reading the algebra and on the snapshot's saved outputs. The cohort prior's matrices are not in the snapshot, so D7's scalar-weight and metric effects are not sized.
- `web/scripts/blsh/**` (block and donor construction, the dry-run and forecast runners) was not read; training-block units (`Y` per hour) are taken from the packet.
- Snapshot statistics came from two throwaway Node scripts over the served JSON: counts by `score.list`, `score.status`, `evidence.reference.personalGames`, `evidence.window.games`, sign of `tracks[0].gap`; moments of `score.normalizedGap` and `score.baselineNormalizedGap`; Pearson correlations with `tracks[0].referenceAtCurrentTOI`. Top-25 comparisons are per side, not per position.
- Forecast figures are read from `RESULTS.json` (`primary.contrasts`, `primary.metrics`, `primary.decision`), not re-run.
- Database: one `pg_stat_activity` and `pg_indexes` check (0 active queries), then one aggregate: `wgo_skater_stats` where `date between '2026-10-15' and '2026-10-28' and games_played = 1` with all 17 Game Score fields non-null; `count`, `avg`, `stddev` and `corr` of the served Game Score, of `0.15*(pp_goals_for+sh_goals_for-pp_goals_against-sh_goals_against)` and of `sat_for-sat_against`, filtered by `pp_toi_per_game >= 180` and `< 10`. No jsonb, no writes, no NST, NHL or Yahoo calls.
- SAT strength (5v5) is inferred from that split, not from the NHL report definition.
- Magnitudes are dated samples (rule 1), not population rates.
