# Fantasy/DFS projection practice and the evaluation of per-game count projections (NHL focus)

Research date: 2026-10-22. Scope: (a) how fantasy and DFS providers build per-game and rest-of-season NHL projections; (b) how to evaluate and backtest per-game count projections rigorously. Cross-sport material is labelled **[cross-sport]**. Worked numbers labelled **[derivation]** are my own arithmetic (Poisson calculations checked in Python), not sourced claims.

Source-quality note: no surveyed NHL provider (Rotowire, Daily Faceoff, Dobber Hockey, Left Wing Lock, numberFire, Stokastic, FantasyLabs) publishes a formal, reproducible methodology or an audited accuracy record for NHL projections. Provider statements below come from marketing pages, FAQs and strategy articles. The rigorous evaluation guidance comes from the forecasting literature (Gneiting and Raftery; Czado, Gneiting and Held; Kolassa; Hyndman and Athanasopoulos; Mincer and Zarnowitz).

## 1. How established providers project NHL players per game (rates × opportunity)

### Takeaway
Public NHL projection practice is "opportunity × efficiency". Providers project deployment (TOI split into even strength and power play, line and PP-unit assignment, games played) and multiply by per-minute or per-shot rates (shots/60, points/60), then adjust for matchup, opposing goalie and role changes. No provider publishes exact weights, so the structure is well established but the parameters are proprietary.

### Cited Findings
- Stokastic says its NHL projections account for "ice time, line combinations, power-play roles, shot rates, matchup quality, and goaltender performance" (from the search summary; this is a marketing description, not a methodology) — [Stokastic NHL](https://www.stokastic.com/nhl)
- FantasyLabs treats time on ice as the main measure of opportunity: players need opportunity to accumulate peripheral stats, and "one of the main metrics used to measure opportunity is Time on Ice" — [FantasyLabs](https://www.fantasylabs.com/?p=85284)
- theScore's NHL DFS primer recommends targeting high-TOI players, using TOI per shift to see who gets longer shifts, Points/60 as the efficiency measure, and team PP% against the opponent's PK% — [theScore](https://thescore.com/news/835145)
- Daily Faceoff value-play write-ups justify picks with PP deployment signals (for example, a player ranking fourth among his team's forwards in PP ice time, or a promotion to a top unit) and rate stats such as a league-leading 19.43 shots/60 — [Daily Faceoff](https://www.dailyfaceoff.com/news/daily-faceoff-nhl-dfs-value-plays-october-25th)
- Dobber Hockey's 2025 preseason projection series:
  - starts ice-time projections from Evolving Hockey data and uses Frozen Tools for even-strength and PP TOI per game;
  - assumes 82 GP before adjustments;
  - notes that player-level ice time "really doesn't change" much year to year, for example adding about one minute per game (mostly even strength) for Leo Carlsson;
  - weighs PP-unit competition (for example, how many Anaheim players are competing for two PP units);
  - the author says the work is mainly for DFS and calls it "not a finished product" — [Dobber Ramblings Aug 26 2025](https://dobberhockey.com/?p=90455); [Dobber Ramblings Jul 24 2025](https://dobberhockey.com/?p=89864); [Dobber Ramblings Jul 18](https://dobberhockey.com/?p=89786)
- Left Wing Lock sells projections for 600+ players in 25+ categories (skaters: G, A, P, +/-, PIM, hits, blocks, PPP, SOG, FW, FL, ATOI and others; goalies: GS, W, L, OTL, SHO, SA, SV, GA, GAA, SV%):
  - in-season projections are updated for injuries, usage and line changes, rest-of-season projections weekly, and line combinations and PP units daily;
  - the FAQ gives no methodology or test results, only testimonials and teaser comparisons — [Left Wing Lock FAQ](https://leftwinglock.com/draftkits/index.php?s=faq)
- RotoWire's NHL rankings derive from its own projections and its Roto Rankings tool; the pages found do not explain how the projections are computed — [RotoWire 200](https://www.rotowire.com/hockey/article/the-rotowire-200-18421)
- One writer-level method, via search summary: blend a player's own history with his share of team production, weight the last three seasons 50/30/20 (most recent first), then adjust for role and age, producing per-game outputs. This is one writer's method and the specific article in the series was not verified — [The Hockey Writers (Flames series)](https://thehockeywriters.com/?p=1687508)
- Another writer stresses that projected TOI, the most likely linemates and PP usage "can all have significant impact" on any individual projection — via the search summary of [Dobber Ramblings](https://dobberhockey.com/?p=90455)
- **[cross-sport]** FantasyPros' baseball accuracy study grades playing time (AB, IP) as its own category and the other stats per AB or per IP. This mirrors the opportunity × rate decomposition and lets opportunity error be judged separately from rate error — [FantasyPros 2022 baseball accuracy](https://www.fantasypros.com/2023/01/most-accurate-fantasy-baseball-projections-2022/amp/)

### Inferences
- The common provider structure for a skater-game is E[stat] = projected TOI_situation × rate_situation/60 × adjustments (opponent, goalie, home/away, back-to-back), summed over EV and PP. Rest-of-season (ROS) = per-game projection × projected remaining GP, where GP carries injury and scratch risk.
- PP deployment is the highest-leverage opportunity input for star scorers, because PP1 forwards get a large share of their points there. Dobber's observation that TOI is stable suggests TOI should be regressed lightly. Daily line and PP-unit updates (LWL, DFO) are a key per-game input that season-level models lack.
- Because no provider publishes coefficients or backtests, any "industry standard" accuracy claim for NHL per-game projections is unverifiable from public sources.

### Gaps
- No official methodology page was found for RotoWire NHL, numberFire NHL, Sportsline NHL or FantasyLabs NHL. Searches returned only rankings and marketing pages.
- No published weighting of TOI against PP rate, or of recent against long-run rates, from any NHL provider.
- Daily Faceoff's own projection methodology (as opposed to its line-combination and goalie-start data) was not found.

## 2. Converting stat projections into fantasy points (points and categories leagues)

### Takeaway
For linear points scoring, expected fantasy points = Σ weight × E[stat], exactly, by linearity of expectation. DFS scoring adds nonlinear threshold bonuses (5+ SOG, 3+ blocks, 3+ points, hat trick). Their expected value needs P(stat ≥ threshold), not the bonus evaluated at the projected mean. Categories leagues need per-category projections converted to a common scale (z-scores or similar), plus rate-stat weighting.

### Cited Findings
- The DraftKings NHL scoring reported by RotoWire:
  - Goal 8.5, Assist 5, Shot on Goal 1.5, Blocked Shot 1.3, goalie Win 6;
  - bonuses include 5+ SOG = 3 and 3+ Blocked Shots = 3.
  - FantasyData lists different values (Goal 8, SOG 2, Block 1.1), and the dates of both articles are unclear, so verify the current rules on DraftKings — [RotoWire](https://www.rotowire.com/hockey/article.php?id=47353); conflicting: [FantasyData](https://fantasydata.com/draftkings-nhl-showdown-strategy)
- Left Wing Lock builds rankings around the buyer's league scoring and has a Draft Assistant that tracks each drafted player's category contributions, for category leagues — [Left Wing Lock FAQ](https://leftwinglock.com/draftkits/index.php?s=faq)
- **[cross-sport]** FantasyPros evaluates category projections (5×5 roto) one stat at a time, z-scoring each projection error against the cross-source mean and SD, then summing across categories. This is how category projections are commonly put on one scale — [FantasyPros](https://www.fantasypros.com/2023/01/most-accurate-fantasy-baseball-projections-2022/amp/)

### Inferences
- **[derivation]** Bonus terms must be computed as b × P(X ≥ t):
  - SOG ~ Poisson(3.5): P(SOG ≥ 5) = 0.275, so the expected bonus is 3 × 0.275 = 0.82 DK points. A naive "bonus only if projected SOG ≥ 5" rule gives 0.
  - SOG ~ Poisson(4.5): P(SOG ≥ 5) = 0.468, so the expected bonus is 1.40 points.
  - Treating bonuses as f(E[X]) therefore under-projects high-volume stars most, which systematically biases star projections low. Overdispersion beyond Poisson raises the tail probabilities for high-mean players further.
- Points-league weights apply to E[stat] directly. Goalie fantasy points also depend on P(start), so expected points = P(start) × E[FP | start]. Mixing these with "if he starts" projections is a common source of apparent bias.
- Categories leagues: ratio categories (GAA, SV%, FO%) must be weighted by volume (for example, saves above average times projected shots against), not averaged. Per-game projections feed weekly category win probabilities only if the variances (not just the means) are modelled.

### Gaps
- No NHL provider documentation was found that explicitly states how it handles DFS bonus terms (probabilistic versus deterministic).
- No source was fetched on z-score or SGP valuation specific to hockey categories leagues.

## 3. Medians versus means, ceilings and floors, and handling uncertainty

### Takeaway
DFS providers usually publish a median (50th-percentile) projection plus floor and ceiling percentiles drawn from simulations or historical error distributions. Fantasy-point distributions are right-skewed, so the median sits below the mean. A median-based projection will therefore look low against average realized outcomes, and especially against memorable big games. Percentile definitions differ between providers (85/15, 80/20, top 15%).

### Cited Findings
- Stokastic **[cross-sport, NFL/NBA]** defines a median projection as "the 50th percentile, the outcome he beats about half the time":
  - it argues that two players with equal medians can have very different tail probabilities (illustrative table: both have a median of 12.0, one has about 3% of sims above 25 and the other about 14%);
  - it notes that medians are computed player by player, so they ignore teammate correlation;
  - its simulations "play out whole games," so correlation is native — [Stokastic](https://www.stokastic.com/articles/dfs-strategy/dfs-projections-vs-simulations)
- 4for4 **[cross-sport, NFL]** defines Floor as an 85% probability of scoring at least X and Ceiling as a 15% probability:
  - instead of adding or subtracting a percentage of the median (which it says most models do), it uses historical ranges of outcomes for players with similar projected stat lines;
  - so a 19.2-point QB and a 19.3-point RB get different floors (9.7 vs 6.8);
  - no calibration or backtest results are published — [4for4](https://www.4for4.com/nfl-dfs-floor-ceiling-projections)
- FantasyLabs defines Ceiling as the top 15% of scores in a player's range of outcomes. A FantasyLabs UFC model ran 10,000 sims and used 80th/50th/20th percentiles for floor, median and ceiling (via search summary; the specific article ID among the FantasyLabs results was not verified) — [FantasyLabs](https://www.fantasylabs.com/?p=131153)
- A DFS source (via search summary) states that a player's median outcome is lower than his mean "due to a number of factors (e.g., in-game injuries)" and treats the median as more useful for a slate — [Establish The Run](https://establishtherun.com/underdog-fantasy-dfs-projections/) (attribution between this and [Fantasy Six Pack](https://fantasysixpack.net/nba-dfs-median-vs-ceiling/) not verified)
- RotoWire's Chris Liss **[cross-sport, MLB season-long]**, 2021:
  - argues that most projections are "50th percentile seasons, i.e., their mean expected outputs." Note that this conflates median and mean;
  - says payoffs are skewed (a huge season helps far more than a bust hurts), so a 35th-percentile projection may suit early picks while ceilings matter later;
  - proposes publishing 1st–99th percentile outcomes per player and backtesting a default percentile, which he guesses at 55–70 — [RotoWire, "The Ideal Projections System"](https://www.rotowire.com/baseball/article/the-ideal-projections-system-56558)

### Inferences
- A per-game skater fantasy-point distribution is a mixture: a large mass at low values (no goal or assist) plus a long right tail (multi-point games, bonuses). For such right-skewed distributions, median < mean. If a provider or site serves medians, or its model was tuned on MAE (whose optimum is the median, see section 6), its numbers will sit below the realized average by construction. That is a definitional bias, not a modelling error.
- Best practice is to serve the mean as the headline for season-long and points-league decisions, because totals add up means, not medians. Floor, median and ceiling should be quantiles of a modelled predictive distribution (Poisson or negative binomial per stat, with correlation through shared game state), and the stated percentile definitions must be shown.
- For per-game NHL, sources of skew are discrete scoring events and correlated teammates on the same line or PP unit. Sims that draw team goals first and then allocate points to on-ice players reproduce the correlation; independent per-player Poisson draws do not.

### Gaps
- No NHL provider was found that publishes the percentile definitions behind its floor and ceiling numbers, or calibration (coverage) of its ranges.
- No published empirical NHL estimate of the mean–median gap for per-game DK or FD points by player tier.

## 4. Reported accuracy levels

### Takeaway
Public, audited accuracy numbers for NHL per-game projections essentially do not exist. Cross-sport evidence shows that consensus or aggregated projections beat single sources, that season-level projections explain about 50–67% of variance in fantasy football, and that provider rank order is unstable from year to year.

### Cited Findings
- **[cross-sport, NFL season-long]** Fantasy Football Analytics found that averaged or consensus projections (FantasyPros) beat single sources (ESPN, CBS, NFL.com). The best source's R² was about 0.67 in 2012 and 0.50 in 2013, and site rank order was inconsistent from year to year — [R-bloggers / Fantasy Football Analytics](https://www.r-bloggers.com/2014/06/which-site-has-the-best-fantasy-football-projections-2014-update/); [2013 post](https://www.r-bloggers.com/2013/05/who-has-the-best-fantasy-football-projections-espn-cbs-nfl-com-or-fantasypros/)
- **[cross-sport, MLB]** FantasyPros 2022:
  - FanGraphs ATC (a consensus with stat-specific weights) ranked first at −2.37 summed z-error, ahead of THE BAT X at −2.14;
  - this is self-published, with a potential conflict of interest — [FantasyPros](https://www.fantasypros.com/2023/01/most-accurate-fantasy-baseball-projections-2022/amp/)
- **[cross-sport, MLB]** In a RotoValue study, Steamer beat the other systems in all formats and simple Marcel was usually second. One system (CAIRO) was hurt by the most optimistic projections for stars who disappointed — [RotoValue](https://blog.rotovalue.com/?p=534); [RotoValue](https://blog.rotovalue.com/?p=564)
- Left Wing Lock claims "accurate" projections and "the most accurate" line-combination source but gives no test results — [LWL FAQ](https://leftwinglock.com/draftkits/index.php?s=faq)
- 4for4 calls its projections "award-winning" but publishes no backtest for its floor and ceiling ranges — [4for4](https://www.4for4.com/nfl-dfs-floor-ceiling-projections)

### Inferences
- Per-game accuracy is inherently much lower than season accuracy, because a single game's goals and points are dominated by Poisson-type noise. For a skater with λ = 0.35 goals per game, P(≥1 goal) = 0.295 **[derivation]**, so even a perfect model "misses" most games. Low per-game R² is expected and is not by itself evidence of a bad model. Proper scores and calibration (section 6) are the right yardsticks.
- Internal accuracy should be benchmarked against naive baselines and, where available, a consensus or market. Absolute R² or MAE quoted without a baseline is uninformative.

### Gaps
- No NHL-specific published accuracy comparisons of RotoWire, Daily Faceoff, Dobber, LWL, numberFire, FantasyLabs or Sportsline were found for 2024–2026.
- No public per-game NHL DFS projection R², MAE or calibration figures from any provider were found.

## 5. Why projections can look systematically low for top players, and how to detect and correct it

### Takeaway
Apparent under-projection of stars has several distinct causes:
- definitional: median versus mean, and MAE tuning;
- evaluation artefacts: selecting on outcomes, or comparing to memorable games;
- genuine model biases:
  - over-shrinkage toward one global mean;
  - opportunity (TOI or PP) regressed toward average;
  - nonlinear bonuses evaluated at the mean.

The diagnostic is calibration conditioned on the forecast (bins by projected tier), using Σactual/Σpredicted and a Mincer–Zarnowitz slope, never conditioned on the outcome.

### Cited Findings
- Extreme results combine skill and luck, and this year's top players are unlikely to repeat the same luck, so some regression of top performers is correct — [Minitab blog](https://blog.minitab.com/en/blog/fun-with-statistics/fantasy-studs-and-regression-to-the-mean)
- **[cross-sport, NFL]** FiveThirtyEight found that preseason RBs ranked 4–9 were more likely to finish in the bottom half of starters than the top half, attributing this to regression (via search summary; the URL now redirects and the article could not be fetched) — [FiveThirtyEight](https://fivethirtyeight.com/features/how-good-are-we-at-predicting-the-best-fantasy-football-running-backs)
- **[cross-sport, MLB]** Marcel uses three weighted years, regression toward the mean and an age adjustment. A FanGraphs piece contrasts this with OOPSY, which regresses players toward different means depending on their profile (probability of making the majors), instead of Marcel's single mean. Regressing to one mean is the classic source of over-shrinking players who are far from average — [SI/FanGraphs "Behind the numbers"](https://www.si.com/mlb/2007/02/19/fangraphs-projections); [FanGraphs projections comparison](https://blogs.fangraphs.com/comparing-projections-part-i-hitters)
- RotoWire's Liss argues that mean projections may be too aggressive for first-round players (suggesting about the 35th percentile), which is the opposite of the "stars under-projected" complaint — [RotoWire](https://www.rotowire.com/baseball/article/the-ideal-projections-system-56558)
- The Mincer–Zarnowitz test regresses the outcome on the forecast and jointly tests intercept = 0 and slope = 1:
  - a nonzero intercept signals level bias, and a slope ≠ 1 signals over- or under-reaction;
  - it needs HAC standard errors when errors are serially correlated;
  - it has low power in small samples;
  - the fitted line can be used for linear recalibration and then retested (secondary explainer source) — [MetricGate MZ test](https://metricgate.com/docs/mincer-zarnowitz-forecast-test/); original: [Zarnowitz, NBER w1070](https://www.nber.org/papers/w1070)
- **[cross-sport, MLB]** Evaluating playing time (AB, IP) separately from per-opportunity rates is how FantasyPros splits opportunity error from skill error. For NHL, the equivalent split is TOI and PP TOI against per-60 rates — [FantasyPros](https://www.fantasypros.com/2023/01/most-accurate-fantasy-baseball-projections-2022/amp/)

### Inferences
- **Selection effects.** Even a perfectly calibrated forecast shows actual > predicted when you condition on players or games that turned out great, because outcome-selected samples carry positive noise. The fair test bins by forecast (projected-tier deciles) and checks Σactual/Σpredicted ≈ 1 in each bin. Users remembering hat tricks is the informal version of this artefact.
- **Mean versus realized.** For right-skewed per-game points, the typical (median) game for a star is below his mean, so "most nights he beats/misses the number" says little about bias. Only the sum over many games tests the mean.
- **Over-shrinkage.** If shrinkage targets a single league mean (Marcel-style) with a prior that is too strong, the top tier's projected rates are compressed. The symptom is an MZ slope > 1 (actual rises faster than forecast) and a top-decile Σactual/Σpredicted > 1 alongside a bottom-decile ratio < 1. The fix is position- or role-specific priors (OOPSY-style different means), sample-size-dependent shrinkage, or a recalibration layer fitted on out-of-sample data.
- **Opportunity under-projection.** Regressing TOI or PP share toward the team or league average under-projects PP1 stars. Decompose the error by computing bias separately for projected TOI against actual TOI and projected per-60 against actual per-60. If TOI error explains the tier bias, fix the deployment model, not the rates.
- **Nonlinear terms.** Bonuses and threshold events (section 2) evaluated at the mean under-project high-volume players. This bias grows with tier.
- **MAE-driven tuning.** Choosing hyperparameters by MAE pushes per-game count forecasts toward the median, which is often 0 (section 6), and so produces low bias that concentrates where outcomes are skewed.
- **Detection routine.** Use a held-out, rolling-origin backtest with:
  - bias (mean error) and Σactual/Σpredicted by projected-tier decile and by position;
  - an MZ regression with game-clustered or HAC standard errors;
  - separate opportunity and rate error tables.
  Correct only if the out-of-sample tier slope is stable across seasons.

### Gaps
- No NHL-specific published study was found quantifying tier-dependent bias in commercial fantasy projections.
- No source was found that documents a provider performing calibration by tier, although the method is standard in the forecasting literature.

## 6. Evaluation metrics for per-game count projections

### Takeaway
Match the metric to the functional being forecast:
- MAE is minimized by the median and squared error by the mean, so evaluate mean forecasts with squared error (RMSE), bias and Σactual/Σpredicted;
- evaluate full predictive distributions with proper scoring rules (log score, ranked probability score for counts, CRPS);
- evaluate binary "scores a goal" probabilities with the Brier score and reliability diagrams;
- check calibration with randomized or nonrandomized PIT histograms for counts.

On zero-heavy counts MAE rewards forecasting zero. A correct mean fix can therefore worsen MAE while improving RMSE and calibration.

### Cited Findings
- Absolute error is only appropriate if the point forecast is the predictive median, and squared error only if it is the predictive mean. Mean absolute error can favour a forecast that squared error rejects, so "the rule must match the reported summary" — [scoringutils vignette (CRAN)](https://cran.r-project.org/web/packages/scoringutils/vignettes/scoring-rules.html)
- Kolassa (2016, *International Journal of Forecasting* 32(3):788–803) explains why MAD, MASE and wMAPE "are inherently unsuitable for count data" and uses the randomized PIT and proper scoring rules to compare count forecasts — [Kolassa 2016 (IDEAS/RePEc)](https://ideas.repec.org/a/eee/intfor/v32y2016i3p788-803.html); slides: [Kolassa SDS 2016](https://zhaw.ch/storage/hochschule/forschung/kooperationen/datalab/SDS/2016/Slides/kolassa.pdf)
- On intermittent series, the median is 0 if more than 50% of values are zero, and MAE "may select models that predict constant 0's, or are at least heavily biased towards zeros" (via search snippet) — [Hewamalage, Ackermann & Bergmeir, "Forecast Evaluation for Data Scientists: Common Pitfalls and Best Practices" (arXiv 2203.10716, 2022)](https://arxiv.org/abs/2203.10716)
- For Poisson-limited demand, the MAE optimum is the median of the predictive distribution, which replaces the mean, and MAPE is undefined at zero actuals — [Tichy et al., arXiv 2211.16313](https://arxiv.org/pdf/2211.16313)
- Gneiting and Raftery define strictly proper scoring rules: the expected score is uniquely optimized by reporting the true predictive distribution — [Gneiting & Raftery tech report (DTIC; published JASA 2007)](https://apps.dtic.mil/sti/pdfs/ADA459827.pdf)
- Czado, Gneiting and Held (2009, *Biometrics* 65(4):1254–1261), "Predictive Model Assessment for Count Data", propose for counts:
  - a nonrandomized PIT;
  - marginal calibration diagrams;
  - proper scoring rules (predictive deviance, log score and others).
  For the randomized PIT, draw u uniformly between F(y−1) and F(y). A calibrated model gives a uniform PIT histogram — [DOI 10.1111/j.1541-0420.2009.01191.x](https://doi.org/10.1111/j.1541-0420.2009.01191.x); PIT description: [arXiv 2110.14790](https://arxiv.org/pdf/2110.14790); implementation: [tscount pit](https://search.r-project.org/CRAN/refmans/tscount/html/pit.html)
- Scoring-rule definitions (scoringutils):
  - **Log score:** −log P(observed). It is local, "sensitive to outlier forecasts", and penalises overconfidence more than underconfidence.
  - **CRPS:** "a generalisation of the absolute error to predictive distributions" that uses the whole distribution.
  - **RPS for counts:** RPS(P, y) = Σ_x (P(x) − 1{x ≥ y})², the discrete analogue of the CRPS, recommended for counts.
  - **Dawid–Sebastiani score:** ((y − μ)/σ)² + 2 log σ. It is proper and needs only the mean and SD.
  - **Discrete bias:** B = 1 − (P(y) + P(y+1)), bounded in [−1, 1].
  - **Brier score:** (p − y)², strictly proper for binary events.
  — [scoringutils vignette](https://cran.r-project.org/web/packages/scoringutils/vignettes/scoring-rules.html)
- In earthquake count forecasting, the log score and the RPS are the key proper rules for count data — [arXiv 2405.10712](https://arxiv.org/pdf/2405.10712)
- **[cross-sport, football/soccer]** The Brier score can be decomposed into calibration (reliability), refinement (resolution) and uncertainty for Poisson-regression match forecasts, to separate bad calibration from weak discrimination — [arXiv 2106.14345](https://arxiv.org/pdf/2106.14345)

### Inferences
- **[derivation] Why a correct fix can worsen MAE.** For Y ~ Poisson(λ) and a point forecast f in [0, 1), E|Y − f| = λ + f(2e^(−λ) − 1).
  - When λ < ln 2 ≈ 0.693 (true for nearly every skater's goals per game, and many players' assists or points per game), the coefficient is positive, so MAE strictly increases as f rises from 0 toward the true mean.
  - Example: λ = 0.30. Forecasting 0 gives MAE 0.300 and MSE 0.390. Forecasting the correct mean 0.30 gives MAE 0.445 (about 48% worse) and MSE 0.300 (better).
  - So an un-biasing change that lifts low per-game means toward truth will increase MAE and decrease RMSE, bias and log or RPS loss. Report MAE only alongside the metric that matches the served functional.
- **Recommended per-game metric panel** for a mean-projection service, per stat (G, A, PTS, SOG, BLK, FP) and per projected-tier decile:
  1. Mean error and Σactual/Σpredicted, overall and by tier and position.
  2. RMSE (or MSE), with a skill score against baselines.
  3. If a distribution is served: RPS (or log score) for counts, PIT histogram, and central-interval coverage (for example, whether 80% intervals contain about 80% of outcomes).
  4. For P(goal ≥ 1) and other threshold props: the Brier score with its reliability/resolution decomposition, and a reliability diagram binned by forecast probability.
  5. MZ slope and intercept.
- **Bootstrap confidence intervals.** Resample games (or game-dates), not player-rows, because errors within a game are correlated (shared scoring environment, linemates, PP chances). Compute percentile CIs for bias, RMSE ratios and calibration-bin ratios. A paired bootstrap of loss differences between model A and model B (the same resampled games) gives a CI on the improvement.
- **Brier binning precision [derivation].** The SE of an observed frequency in a calibration bin with p ≈ 0.3 is √(0.3·0.7/n): about 0.046 at n = 100 and about 0.023 at n = 400. Bins need hundreds of player-games before a 3–5 percentage-point miscalibration is detectable.

### Gaps
- The full text of Hewamalage et al. (2022) and Kolassa (2016) could not be extracted (PDF or paywall). Statements rely on abstracts and snippets.
- No sports-specific paper was fetched on clustered or block bootstrap for player-game forecast errors, or on Diebold–Mariano tests applied to fantasy projections. The game-clustered bootstrap recommendation is an inference.
- No public study was found evaluating the calibration of NHL anytime-goal-scorer probabilities (Poisson against negative binomial or zero-inflated).

## 7. Backtesting practice

### Takeaway
Backtest on a rolling forecasting origin with strictly point-in-time inputs. Each game's forecast may use only data, lineups and injury news available before puck drop, and evaluation should use the forecasts actually stored and served. Always compare against naive baselines (season-to-date average, last-N, prior-season rate × projected TOI) and, where available, market-implied probabilities. Require enough player-games per tier for the stated CI width, and monitor live served forecasts continuously against settled outcomes.

### Cited Findings
- Time-series cross-validation, or "evaluation on a rolling forecasting origin", uses training sets that contain only observations before each test point, so "no future observations can be used in constructing the forecast":
  - in-sample residuals understate true forecast error (the example shows RMSE of 11.27 under cross-validation against 11.15 on training residuals);
  - the earliest origins are skipped because small training sets give unreliable forecasts;
  - the procedure extends to multi-step horizons (relevant for ROS projections) — [Hyndman & Athanasopoulos, *Forecasting: Principles and Practice* (3rd ed.), §5.10](https://otexts.com/fpp3/tscv.html)
- Hewamalage, Ackermann and Bergmeir frame data partitioning, error-measure choice suited to the data's characteristics, and statistical testing as the core best-practice areas, and emphasise pitfalls from non-normal and non-stationary series — [arXiv 2203.10716](https://arxiv.org/abs/2203.10716)
- Kolassa compares count-forecast models with the PIT and proper scoring rules on held-out daily data, not point-error metrics — [Kolassa 2016](https://ideas.repec.org/a/eee/intfor/v32y2016i3p788-803.html)
- **[cross-sport]** Consensus or averaged projections beat individual sources, so an average of available projections is a strong benchmark to beat — [Fantasy Football Analytics via R-bloggers](https://www.r-bloggers.com/2014/06/which-site-has-the-best-fantasy-football-projections-2014-update/)
- The MZ efficiency test needs HAC standard errors for serially correlated errors, and its power is low in small samples — [MetricGate](https://metricgate.com/docs/mincer-zarnowitz-forecast-test/)
- In-season NHL inputs change daily: Left Wing Lock updates line combinations and PP units daily and ROS projections weekly. Point-in-time backtests must therefore snapshot these inputs as of each forecast time — [LWL FAQ](https://leftwinglock.com/draftkits/index.php?s=faq)

### Inferences
- **Leakage hazards specific to NHL per-game work:**
  - using final-boxscore TOI or PP TOI (instead of the pre-game projection) as an input;
  - season-to-date rates that include the target game;
  - confirmed starting goalie or line combinations scraped after lock;
  - player or team ratings recomputed with full-season data;
  - hyperparameters tuned on the evaluation season.
  Store forecast_issued_at and an input snapshot, and score only rows with issued_at < game start.
- **Rolling-origin design.** Train on all games before date d, forecast d (or the d+1…d+k window for ROS), and step forward by day or week. Report by season segment (October versus later), because early-season shrinkage choices dominate errors when samples are small.
- **Baselines to beat:**
  - season-to-date per-game average;
  - last-10 average;
  - prior-season (or weighted 3-season) per-60 rate × last-10 TOI;
  - league-average by position;
  - for binary props, de-vigged sportsbook implied P(goal ≥ 1);
  - for DFS, a consensus of available public projections.
  Report skill = 1 − loss_model / loss_baseline with a game-clustered bootstrap CI.
- **Minimum sample.** Size the samples from the target CI.
  - The SE of mean bias is about SD_error/√n_eff, where n_eff reflects game clustering.
  - For per-game fantasy points, use the empirical SD of errors from the backtest itself, not an assumed value.
  - Tier analyses (deciles) need about 10× the overall sample.
  - Calibration bins for probabilities near 0.3 need about 400 or more player-games for ±2.3 pp SE (see section 6).
- **Live monitoring of served forecasts:**
  - persist each served forecast immutably (value, distribution parameters, model version, input snapshot, timestamp);
  - settle against official outcomes after games;
  - track rolling 7/14/30-day bias, Σactual/Σpredicted by tier, RMSE skill against baselines, Brier/RPS and PIT uniformity;
  - alert when a CI excludes 0 bias for a tier, instead of reacting to single-game misses;
  - any recalibration layer (for example, MZ-style linear recalibration by tier) should itself be fitted on past served forecasts and validated out of sample.

### Gaps
- No public documentation was found of an NHL fantasy or DFS provider's backtest protocol, live-monitoring dashboard, or served-forecast audit.
- No published NHL-specific guidance on minimum sample sizes was found. The numbers above are derived from standard-error formulas.
- No source was fetched quantifying how sharp market lines (player props) are as an NHL benchmark.
