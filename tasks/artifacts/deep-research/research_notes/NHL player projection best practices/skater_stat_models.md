# Statistical methods for projecting NHL skater per-game counting stats (G, A, P, PPP, SOG, HIT, BLK)

Research run 2026-10-22. Labels used below: "fetched" means the claim was read on the source page; "search summary" means it came from a search-result digest and was not read in full on the page. Treat search-summary items as lower confidence. Some documents surfaced in search are excluded as evidence: internal-looking "council ruling" pages on edge-assist.duckdns.org about an NHL player-props pipeline are unpublished design notes, not independent research.

## 1. How established public models build player rate estimates

### Takeaway
The leading public models (Evolving-Hockey RAPM/GAR, HockeyViz Magnus, MoneyPuck xG) all estimate per-60 rates with regularized regression or Bayesian updating, not raw box-score rates. They weight observations by time on ice and adjust for context (score, zone, strength, rest, venue). They also carry prior information forward: Magnus uses last season's estimate plus aging as the prior. MoneyPuck models a shooter's finishing talent separately from location-based xG.

### Cited Findings
**Evolving-Hockey (RAPM / GAR / xG)**
- RAPM models are "stint-level weighted ridge regressions", run per season, with a separate row for each team a traded player played for. A stint is a stretch of play with no substitutions, and each stint is weighted by its length (fetched). — [Evolving-Hockey RAPM glossary](https://evolving-hockey.com/glossary/regularized-adjusted-plus-minus/)
- Targets are per-60 rates: separate regressions for GF/60, CF/60 and xGF/60. Goalies enter only the GF/60 regression (fetched). — [Evolving-Hockey RAPM glossary](https://evolving-hockey.com/glossary/regularized-adjusted-plus-minus/)
- Covariates (fetched):
  - score state: 7 levels for CF (home lead -3 to +3); 3 levels (trailing, tied, leading) for GF and xGF;
  - strength-state groups: EV = 5v5, 4v4, 3v3; PP/SH = 5v4, 5v3, 4v3;
  - offensive, neutral and defensive zone-start indicators;
  - a back-to-back indicator.

  The page does not say how lambda is chosen. — [Evolving-Hockey RAPM glossary](https://evolving-hockey.com/glossary/regularized-adjusted-plus-minus/)
- Multi-season ratings are TOI-weighted averages of single-season ratings. The page's example: Bergeron 11.12 over 1090.07 min and 13.41 over 1105.25 min combine as (202.03 + 247.02) / (2195.32 min) × 60 = 12.27 (fetched). — [Evolving-Hockey RAPM glossary](https://evolving-hockey.com/glossary/regularized-adjusted-plus-minus/)
- GAR converts RAPM-style per-60 ratings into goals above replacement. The 2018 slide deck's title refers to "SPM", but its statistical plus-minus details were not retrieved. The site also runs xGAR, which mirrors the original WAR-on-ice approach. Evolving-Hockey lists a "Global Expected Goals Model (xG) 2.0", dated 2019-10-02 (search summary). — [Evolving-Hockey/Hockey-Graphs RITSAC 2018 GAR/SPM slides](https://hockey-graphs.com/wp-content/uploads/2018/08/gar_spm_ritsac_18.pdf); [Evolving-Hockey about](https://evolving-hockey.com/about/)

**HockeyViz / Micah McCurdy (Magnus, version 9, dated 2025-08-27)**
- Magnus 9 is a generalized ridge regression that minimizes ||Y − Xβ||²_W + ||β − β₀||²_Λ + ||β||²_K, with closed form β = (XᵀWX + Λ + K)⁻¹(XᵀWY + Λβ₀). W is diagonal with stint lengths (fetched). — [HockeyViz Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- Each season's prior β₀ is the previous season's estimate shifted by an aging term f(a) = c(a − 24)², where c is 25 basis points of league average. New players get a prior of −10% of league average on offence and +10% on defence (fetched). — [HockeyViz Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- Prior strength depends on age. The penalty is a bell curve with b(24) = 50,000, b(18) = b(30) = 5,000, and 2,000 at large ages, so players near 24 are assumed to change least. Seasons are fit in sequence from 2007-08, so old information is down-weighted but never discarded (fetched). — [HockeyViz Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- Context terms (fetched):
  - score terms per minute and score state;
  - zone terms for four shift-start types, capped at 35 seconds in v9;
  - rest in three patterns;
  - venue/period terms.

  Zero-sum constraints use a weight of about 1e15. — [HockeyViz Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- Magnus models shot-rate maps (where shots occur), not just counts. In the special-teams version each unblocked shot is smoothed as a Gaussian with a 10 ft standard deviation, to absorb location-recording error. Version 6 tested pressure-based weighting and version 7 tested multi-season pooling; neither was kept (search summary of the Magnus pages). — [Magnus v7 ST](https://hockeyviz.com/txt/magnus7ST); [Magnus v6 EV](https://hockeyviz.com/txt/magnus6EV); [Magnus v7 EV](https://hockeyviz.com/txt/magnus7EV)

**MoneyPuck**
- The xG model is gradient boosting, trained on a random sample of more than 289,000 shots from 2023-24 to 2025-26 and rebuilt for 2026-27 (fetched). — [MoneyPuck About](https://moneypuck.com/about.htm)
- Features (fetched):
  - shot location and angle;
  - shot type;
  - the prior event, its location, and the seconds since it;
  - shift time on ice for both teams;
  - manpower state;
  - off-wing (shooter handedness against the side of the ice);
  - empty net.

  AUC rose from 0.784 to 0.807 overall. — [MoneyPuck About](https://moneypuck.com/about.htm)
- Flurry-adjusted xG = P(no goal yet in the flurry) × the shot's xG, capped at 1.0 per flurry. In the page's example, shots of 0.33 and 0.82 become 0.33 and 0.55, for a flurry total of 0.88 instead of 1.15 (fetched). — [MoneyPuck About](https://moneypuck.com/about.htm)
- "Shooting Talent Adjusted xG": the xG model excludes shooter skill, so MoneyPuck estimates each shooter's finishing talent with Bayesian statistics from goals versus xG to date. The page gives no prior or parameters (fetched). — [MoneyPuck About](https://moneypuck.com/about.htm)
- The pre-game win model weights scoring chances at 54%, goaltending at 29% and ability to win at 17%. Recent games get slightly more weight. Home teams win about 54% of games, and playing the previous day when the opponent did not costs about 4% (fetched). — [MoneyPuck About](https://moneypuck.com/about.htm)

**Dom Luszczyszyn (The Athletic)**
- Game Score (July 2016) adapts the Bill James / John Hollinger single-game productivity metric. It evolved into Game Score Value Added (GSVA), which adjusts for age, teammates and competition at 5-on-5 (secondary source). — [NL Ice Data Substack](https://nlicedata.substack.com/p/assessing-players-teams-and-projecting)
- A Win Shares projection inspired by Luszczyszyn found the most predictive season weights were 75% for the previous season and 25% for the one before. It also describes an in-season blend: the current season weighs 0% on day one and about 50% a year later, with 35% and 15% on the two prior seasons (secondary source; this is not Luszczyszyn's own model). — [NL Ice Data Substack](https://nlicedata.substack.com/p/assessing-players-teams-and-projecting)

**Academic**
- Thomas, Ventura, Jensen & Ma (Annals of Applied Statistics, 2013) model each team's scoring as a semi-Markov process with hazard functions that depend on the players on the ice. They fit full Bayesian hierarchical models that partially pool player effects by position, using 5v5 data from five seasons (search summary). — [arXiv:1208.0799](https://arxiv.org/abs/1208.0799)
- Gramacy, Jensen & Taddy use regularized logistic regression for player contributions to goal odds and stress careful prior shrinkage because of the large-p, imbalanced design. Their finding is that most players are not measurably strong or weak contributors (search summary). — [arXiv:1209.5026](https://web3.arxiv.org/pdf/1209.5026v1)
- In a weighted-shots study, shots are more consistent than goals and better at predicting future goals. Weighted shots/60 is more consistent than goals/60 but not more than shots, Fenwick or Corsi per 60. Adjusted shooting % did not beat raw shooting % at the team level (search summary). — [Evaluating NHL Goalies, Skaters, and Teams Using Weighted Shots, arXiv:1205.1746](https://arxiv.org/pdf/1205.1746)

### Inferences
- The common architecture is: (a) estimate TOI per game by situation; (b) estimate per-60 rates for each situation with shrinkage toward a prior; (c) multiply them to get per-game expectations. Ridge penalties, Magnus's age-dependent Λ and MoneyPuck's Bayesian talent estimate all do the same job: pulling small-sample rates toward a prior.
- Magnus's "last season plus aging" prior is a ready-made template for a skater projection prior. Its −10% offence entry prior for new players also signals that rookies should not start at league average.
- Evolving-Hockey's TOI-weighted multi-season combination is plain pooling with no recency decay. Magnus's sequential refitting gives implicit recency decay.

### Gaps
- I did not retrieve the Evolving-Hockey xG feature list or its lambda selection, or the published GAR/SPM component weights for individual G and A.
- I found no primary Athletic explainer for Luszczyszyn's projection model, so its exact season weights and aging adjustments are unverified.
- I found no methodology documentation for Natural Stat Trick-based projection approaches. NST publishes rates and on-ice stats, not a projection method.
- No specific MIT Sloan paper on per-game skater counting-stat projection surfaced.

## 2. Shrinkage, stabilization points, priors and multi-season weighting

### Takeaway
Hockey's documented shrinkage practice is Marcel-style: 3–4 seasons of weights plus padding with league-average "phantom" sample, and ridge or Bayesian priors centred on positional or previous-season values. Published, quantitative stabilization points for individual skater stats (Sh%, shots/60, IPP, hits/60, blocks/60) were not found in this research and need to be estimated in-house. The best-supported qualitative ordering, from most to least stable, is shot volume, then on-ice and individual shooting %, then IPP.

### Cited Findings
- Hockey Marcel (Hockey-Graphs, Feb 2014; data through 2014-01-31) adapts baseball's Marcel, which weights the last three years 5/4/3, adds regression to the mean and applies an aging adjustment (fetched). — [Hockey-Graphs four-year hockey Marcels](https://hockey-graphs.com/2014/02/03/forecasting-future-goalie-performance-with-four-year-hockey-marcels/)
- Eric Tulsky's goalie weights by shots faced are 5/3/2.5/1.5 (most recent season first): years 3, 2 and 1 count 60%, 50% and 30% as much as year 4 (fetched). — [Hockey-Graphs four-year hockey Marcels](https://hockey-graphs.com/2014/02/03/forecasting-future-goalie-performance-with-four-year-hockey-marcels/)
  - A search summary described 5/3/2.5/1.5 as Tulsky's skater weights, but the fetched page applies them only to goalie shots faced. The skater label is unverified. — [Hockey-Graphs (search summary)](https://hockey-graphs.com/2014/04/19/projecting-future-goalie-performance-updating-and-improving-hockey-marcels/)
- Goalie regression padded each goalie's weighted shots with league-average saves up to 4,000 shots. The author called 4,000 somewhat arbitrary and the weakest part of the method (fetched). A 2015 update reportedly added 1,525 league-average shots instead (search summary, not verified). — [Hockey-Graphs four-year Marcels](https://hockey-graphs.com/2014/02/03/forecasting-future-goalie-performance-with-four-year-hockey-marcels/); [Hockey-Graphs 2015 midseason Marcels](https://hockey-graphs.com/2015/02/02/2015-midseason-goalie-projections-using-hockey-marcels/)
- On-ice shooting % regresses heavily. Tulsky's example: an 11% on-ice shooter over three years projects to about 9.2% over the next three, against a league average near 7.5%. Centres were examined separately from wingers and defencemen, among players with at least 1,000 minutes and 150 games (search summary). — [TSN: on-ice shooting percentage by position](https://www.tsn.ca/examining-on-ice-shooting-percentage-by-position-1.338499)
- Magnus sets prior strength by age (b(24) = 50,000; b(18) = b(30) = 5,000; 2,000 at large ages). The prior mean is last season's estimate plus aging, and new entrants start at −10% offence / +10% defence. Forward and defender priors are re-centred to a time-weighted mean of zero, which is effectively a positional prior (fetched). — [HockeyViz Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- Thomas et al. partially pool player parameters by position in a Bayesian hierarchical model (search summary). — [arXiv:1208.0799](https://ar5iv.arxiv.org/html/1208.0799)
- IPP baselines: forwards average about 68% (Travis Yost, 2015). Another source gives about 70% for forwards and 30% for defencemen. Yost argued IPP "is not a repeatable skill" and regresses substantially. Dobber counters that elite top-line forwards typically sit around 80% and middle-six forwards around 60–75%, and suggests comparing a player to his own multi-year IPP: five seasons at 55–65% followed by 85% marks a regression candidate (search summary). — [Russian Machine Never Breaks (Yost IPP)](https://russianmachineneverbreaks.com/2015/09/16/what-individual-point-percentage-can-tell-us-about-the-2015-16-caps/); [Dobber: Frozen Tools Forensics IPP](https://dobberhockey.com/?p=81332); [Dobber: Even-strength IPP and regression](https://dobberhockey.com/?p=63985); [LeftWingLock: Using IPP](https://leftwinglock.com/articles.php?id=3130)
- Year-to-year repeatability of shooting % and save % is weak, so both are vulnerable to luck (search summary). — [JFresh: Percentage Luck in Hockey, Explained](https://jfresh.substack.com/p/percentage-luck-in-hockey-explained)
- MoneyPuck's finishing-talent estimate is Bayesian on goals versus xG. The page's conceptual example: a shooter 10% above average talent who beats xG by 20% over 1,000 shots. No prior parameters are published (fetched). — [MoneyPuck About](https://moneypuck.com/about.htm)

### Inferences
- Tulsky's example implies (11 − 9.2) / (11 − 7.5) ≈ 51% regression toward the mean over about three seasons of on-ice data. One search digest described this as "roughly two-thirds", which does not match the stated numbers.
- In a Marcel/empirical-Bayes framework, the projected rate is (Σ wᵢ·eventsᵢ + k·league_rate) / (Σ wᵢ·opportunitiesᵢ + k). Here k is the stabilization sample, the opportunity count at which observed and prior get equal weight, so the reliability r = n / (n + k). The k values for skaters (shots for Sh%, minutes for shots/60, on-ice goals for IPP, minutes for hits/60 and blocks/60) are not published in the sources found. They should be fit in-house, for example by split-half correlation across many players or by beta-binomial or gamma-Poisson maximum likelihood.
- The goalie analogue (k between 1,525 and 4,000 shots for Sv%) and the heavy regression of on-ice Sh% both suggest that finishing and percentage stats need large k. Volume stats (shots/60, hits/60, blocks/60) behave like player habits and should need far smaller k. This ordering is inferred, not measured here.
- Positional and role priors should at least split forwards (F) from defencemen (D). Magnus re-centres F and D separately. The IPP baselines (about 70% F, 30% D) show the size of the positional gap in assist-type stats.

### Gaps
- No published stabilization point was found for individual Sh%, shots/60, IPP, primary-assist rate, hits/60 or blocks/60. Several queries returned nothing quantitative. Commonly quoted figures from older blog posts (for example Sh% stabilization in the hundreds of shots) could not be verified and are omitted.
- No validated skater-Marcel accuracy test (MAE or RMSE against naive baselines) was found.
- No hockey source specifies a recency-decay half-life for skater rates.

## 3. Goals: shots × Sh% versus xG finishing versus direct goal-rate models

### Takeaway
Shot volume is the stable, predictive base. Finishing (Sh% or goals above xG) is real but heavily regressed. The best-supported structure is projected SOG (or xG) multiplied by a shrunk finishing multiplier, not raw goal rates. League scoring and shooting environments have shifted since about 2023-24, so league baselines must be recomputed per season.

### Cited Findings
- Shots are more consistent than goals and better at predicting future goals. The paper attributes this to earlier work by Ferrari, JLikens and Macdonald (search summary). — [arXiv:1205.1746](https://arxiv.org/pdf/1205.1746)
- MoneyPuck's xG deliberately excludes shooter skill. Finishing talent is a separate Bayesian estimate from goals versus xG, fed into the "Scoring Chances" component of its game model (fetched). — [MoneyPuck About](https://moneypuck.com/about.htm)
- Even elite shooters regress. Stamkos and Ovechkin each fell about two points from their starting shooting % (search summary). Stamkos's career 17.2% against a league average near 8.5% shows that finishing talent exists (search summary). — [TSN: a cautionary tale about shooting performance](https://www.tsn.ca/a-cautionary-tale-about-shooting-performance-1.894187?tsn-amp); [The Hockey Writers: expected PDO](https://thehockeywriters.com/predicting-the-unpredictable-expected-pdo-atlantic-division/)
- The best finishers typically shoot above 12–13%. Players below 10% are usually defencemen, low-offence bottom-line forwards, or unlucky (search summary). — [The Hockey News: regression candidates 2023-24](https://thehockeynews.com/nhl/fantasy/lists/7-candidates-for-a-regression-in-2023-24)
- League environment (Hockey-Reference, per team per game; fetched). The page shows shots against (SA), not shots for.

  | Season | Goals | PP goals | Shots against |
  |---|---|---|---|
  | 2018-19 | 2.98 | 0.58 | 31.3 |
  | 2019-20 | 2.98 | 0.60 | 31.3 |
  | 2020-21 | 2.90 | 0.57 | 29.8 |
  | 2021-22 | 3.11 | 0.60 | 31.4 |
  | 2022-23 | 3.14 | 0.65 | 31.1 |
  | 2023-24 | 3.08 | 0.63 | 30.1 |
  | 2024-25 | 3.01 | 0.59 | 28.1 |
  | 2025-26 | 3.08 | 0.61 | 27.6 |

  — [Hockey-Reference NHL league averages](https://www.hockey-reference.com/leagues/stats.html)
- MoneyPuck's flurry adjustment caps a rebound sequence's combined xG at 1.0. This matters if goals are projected from xG summed over shots (fetched). — [MoneyPuck About](https://moneypuck.com/about.htm)

### Inferences
- Implied league goals per shot rose from about 2.98 / 31.3 ≈ 9.5% (2018-19) to about 3.08 / 27.6 ≈ 11.2% (2025-26). This is a rough ratio, since goals include empty-net goals and SA excludes empty-net shots. The pitfall cuts both ways:
  - shot priors anchored on pre-2024 seasons will over-project SOG per game by roughly 10% or more;
  - Sh% priors anchored on older league averages will under-project goals.

  Recompute league baselines for each season. The cause of the shot decline (play style or recording changes) was not established here.
- Recommended goal formula: E[G/game] = Σ over situations (EV, PP, SH) of TOI_s × shots/60_s (shrunk) × Sh%_s (shrunk toward a position- or role-specific prior using the player's career shots). An xG variant replaces shots × Sh% with ixG/60 × a finishing multiplier shrunk toward 1.0. Either way, finishing must be regressed far more than volume.
- Using raw recent goal rates over-projects hot shooters and under-projects cold ones. This is the most common systematic error the sources point to.

### Gaps
- No public, quantified comparison of out-of-sample error (shots × regressed Sh% vs xG × finishing vs direct goal rate) for individual skaters was found.
- MoneyPuck's finishing-talent prior and regression strength are not published.
- League shots-for and shooting % by season were not separately sourced; the figures above use shots against.

## 4. Assists, points and PPP

### Takeaway
Assists are best projected as on-ice goals for (from a context-adjusted on-ice rate such as RAPM-style xGF/GF) multiplied by a shrunk individual point share (IPP minus goal share), split by situation. IPP baselines of about 70% for forwards and 30% for defencemen are well documented. A league assists-per-goal ratio of about 1.7 is consistent with those baselines but was not directly sourced.

### Cited Findings
- IPP baselines: forwards about 68% (Yost) or about 70%, defencemen about 30%. Elite forwards are often around 80%, middle-six forwards 60–75%. Repeatability is disputed: Yost says not repeatable, Dobber says elite players sustain it (search summary). — [Russian Machine Never Breaks (Yost)](https://russianmachineneverbreaks.com/2015/09/16/what-individual-point-percentage-can-tell-us-about-the-2015-16-caps/); [Dobber IPP](https://dobberhockey.com/?p=81332); [LeftWingLock IPP](https://leftwinglock.com/articles.php?id=3130)
- Up to two assists per goal have been standard since 1936-37 (before 1936 only one assist was credited) (search summary). — [The Hockey Writers: goal-to-assist ratios](https://thehockeywriters.com/nhl-highest-goal-to-assist-ratios/)
- There are more two-assist goals on the power play than at even strength. Analysts debate whether secondary assists are meaningful (search summary). — [Japers' Rink: Primary thoughts on secondary](https://www.japersrink.com/primary-thoughts-on-secondary-02-15-2019/)
- Evolving-Hockey's RAPM gives context-adjusted on-ice GF/60 and xGF/60 by strength state (EV and PP/SH). These are natural "on-ice goals for" inputs (fetched). — [Evolving-Hockey RAPM glossary](https://evolving-hockey.com/glossary/regularized-adjusted-plus-minus/)
- League PP goals run about 0.57–0.65 per team-game from 2018-19 to 2025-26, about 20% of all goals (fetched; percentage computed). — [Hockey-Reference league averages](https://www.hockey-reference.com/leagues/stats.html)

### Inferences
- Implied assists per goal: with three forwards at about 0.70 IPP and two defencemen at about 0.30, the on-ice points per goal are about 3(0.70) + 2(0.30) = 2.7, which implies about 1.7 assists per goal. This is consistent with the 1.7–1.8 figure in the brief, but is derived, not sourced. PP goals carry more two-assist goals, so the ratio is higher on the PP than at EV.
- Assist formula: E[A/game] = Σ over situations of TOI_s × on-ice GF/60_s × (IPP_s − individual goal share_s), with IPP_s shrunk toward a position, role and situation prior (F EV about 0.68–0.70; D about 0.30; PP higher). Linemate and PP-unit quality enter through on-ice GF/60. PPP = PP TOI × PP on-ice GF/60 × PP IPP.
- Assists inherit goal randomness: on-ice GF depends on teammates' shooting %, so raw on-ice GF/60 must be regressed, ideally from on-ice xGF/60 or a shrunk on-ice shooting %. Tulsky's roughly 51% on-ice Sh% regression over three years shows how large that correction is.
- Secondary assists are likely noisier than primary ones; a model can shrink A2 rates more than A1 rates. No source quantified this.

### Gaps
- No sourced league-wide assists-per-goal ratio by season. Compute it from NHL API season totals.
- No published repeatability numbers (split-half or year-to-year r) for primary versus secondary assist rates, or for IPP by position.

## 5. Count distributions for per-game outcomes

### Takeaway
Team goals per game are well described by Poisson, and that research goes back to the 1970s. No published NHL study tests player-level per-game distributions. Standard count-model practice says shots, hits and blocks (higher-mean, game-script-dependent counts) should use a negative binomial (NB2) to handle overdispersion, while Poisson is usually adequate for a single player's goals. Probabilities such as P(goal ≥ 1) and P(SOG ≥ k) follow from the chosen distribution's CDF.

### Cited Findings
- Team goals per game fit Poisson. Examples (search summary):
  - Mullet (1973-74) found goals for and against, home and away, Poisson-distributed for each team;
  - Ryder (2004) explains NHL scoring with Poisson models;
  - Buttrey et al. (2011) use a Poisson GLM in which the rate depends on the teams, home ice and manpower.

  — [Lakehead: Poisson Processes and Applications in Hockey](https://lakeheadu.ca/sites/default/files/uploads/77/docs/DejardineFinal.pdf); [Buttrey, Washburn & Price, "Estimating NHL Scoring Rates" (NPS)](https://faculty.nps.edu/awashburn/docs/EstimatingNHLScoringRates.pdf)
- NB2 parameterization: Var = μ + αμ², with Poisson as the special case α = 0 (search summary). — [John D. Cook: three views of the negative binomial](https://www.johndcook.com/blog/2009/09/22/negative-binomial-distribution/)
- Sports scores are often overdispersed. Overdispersion barely biases point estimates but shrinks standard errors, so Poisson becomes overconfident (search summary). — [MetricGate: overdispersed sports scores](https://metricgate.com/blogs/overdispersed-sports-scores-negbin/)
- By analogy from soccer, a negative binomial fit goals best and Poisson underestimated zero-goal matches (search summary). — [AUEB thesis repository](https://pyxida.aueb.gr/items/5e0f7a40-3464-4f7e-b340-a39032623436)
- Negative binomial and zero-inflated extensions of Poisson regression address overdispersion and excess zeros (general methods reference; search summary). — [SPEEDS regression 2: Poisson](https://speeds.quarto.pub/speeds/regression_2_Poisson.pdf)

### Inferences
These are standard derivations, not hockey-specific findings.
- Under Poisson(λ): P(X ≥ 1) = 1 − e^(−λ), and P(X ≥ k) = 1 − Σ_{j<k} e^(−λ) λ^j / j!.
- Under NB2 with mean μ and size r = 1/α: P(X = 0) = (r / (r + μ))^r, which is higher than e^(−μ). So Poisson overstates P(≥1) and understates both tails.
- A Poisson whose rate is uncertain (a gamma posterior from shrinkage) or varies with the game (TOI, score state, opponent, rink) is exactly a negative binomial. Overdispersion is therefore expected from parameter uncertainty and game-to-game TOI variance, even when shots within a game are Poisson. A practical model draws TOI per game, then counts given TOI × rate, or fits α per stat (and per position) on game logs.
- Expected relative dispersion:
  - goals (low mean, about 0.1–0.5 per game) are close to Poisson, because αμ² is small when μ is small;
  - SOG (μ about 1–4) and hits/blocks (strongly affected by game script, opponent and rink) are likely materially overdispersed.

  Zero-inflation is mainly useful for players with uncertain dressing or role, for example 4th-liners and 7th defencemen whose TOI may collapse; modelling TOI explicitly can stand in for it.
- Pitfall: Poisson-based P(SOG ≥ 3) or P(hits ≥ 3) will be miscalibrated in the tails. Calibrate against held-out game logs, using reliability curves by probability bucket.

### Gaps
- No peer-reviewed or reputable public NHL study comparing Poisson, NB and zero-inflated fits for individual skater per-game goals, points, SOG, hits or blocks was found. The only NHL-specific discussion surfaced was unpublished internal design documents, excluded as evidence.
- No published dispersion (α) values for NHL skater per-game SOG, hits or blocks.

## 6. Physical stats: hits, blocks, and rink/scorekeeper bias

### Takeaway
Hits and blocks carry large, persistent rink-recording effects, and the published adjustment is to divide each event by its rink's multiplier. Historically (2007-13), hit multipliers ranged from about 0.59 (NJ) to 1.30 (LA), and block multipliers from about 0.54 (NJ) to 1.27 (MTL). A 2025 update finds rink effects narrowed in 2023-24, possibly because of player tracking. Score and venue adjustments add further gains.

### Cited Findings
- **Schuckers & Macdonald rink-effects paper (arXiv:1412.1035).**
  - Data: 2007-08 to 2012-13, 6,858 games, 5v5, non-empty-net, first three periods, counts prorated to 3,600 s.
  - Model: ln(Y*) = μ + γ_rink + β·ASD + φ_for + ω_against + η·home + η·γ·home + ε.
  - Fit with elastic net (glmnet, 10-fold CV).
  - A rink counts as persistent only if its effect has the same sign in at least 5 of 6 seasons and is confirmed by the pooled model (fetched).

  — [arXiv:1412.1035 (ar5iv)](https://ar5iv.arxiv.org/html/1412.1035)
- The adjustment reweights each event by 1/RE. For example, a Boston block RE of 0.866 means multiplying Boston blocks by 1.154 (fetched). — [arXiv:1412.1035](https://ar5iv.arxiv.org/html/1412.1035)
- Persistent hit REs (fetched): LA 1.298, NYR 1.274, DAL 1.197, FLA 1.175, PHX 1.163, TOR 1.132, OTT 1.091; COL 0.848, EDM 0.805, MIN 0.783, CGY 0.639, NJ 0.592 (the paper's text also gives 0.581). Home-by-rink "homer" terms: NJ 1.196, DAL 1.073, TOR 0.906. — [arXiv:1412.1035](https://ar5iv.arxiv.org/html/1412.1035)
- Persistent block REs (fetched): MTL 1.271, TOR 1.245, NYI 1.208, SJ 1.196, WSH 1.187, CAR 1.187, EDM 1.124, PHI 1.123; DET 0.879, FLA 0.868, LA 0.866, BOS 0.852, CBJ 0.852, ANA 0.721, NJ 0.541. Blocks had no significant homer effects. — [arXiv:1412.1035](https://ar5iv.arxiv.org/html/1412.1035)
- Shots on goal had the fewest persistent rink effects (only FLA and STL, both small). Ratio metrics such as Corsi% barely change after adjustment, but player counts do: Clutterbuck's 2012-13 hits rose from 155 to about 181 (fetched). — [arXiv:1412.1035](https://ar5iv.arxiv.org/html/1412.1035)
- **Knodell (Puck Over the Glass, 2025-02-14).**
  - Method: ridge regression of ln(team 5v5 hits/60) per game, run per season, with team, opponent, rink, hitting-team score differential, home and per-rink homer terms.
  - Venue coefficients: about 93% (2009-14) and about 96% (2014-24); the adopted home adjustments are 0.928 and 0.962.
  - Score effect: about 1.03 per goal of the hitting team's lead, applied as 1.03^(goal differential), capped at ±3.
  - 2023-24 showed a much narrower range of rink coefficients; the author suggests tracking technology may be the reason (opinion) (fetched).

  — [Puck Over the Glass: Revisiting Scorekeeper Bias for Hits](https://puckovertheglass.substack.com/p/revisiting-scorekeeper-bias-and-scorevenue)
- In Knodell's tests, every adjustment beat raw hit rates at predicting team hit rates. Best in the regular season: rink adjustment plus HockeyViz score/venue adjustment, where adjustment = (total events / 2) / the team's events in that score state. The R² gap to the regression approach was only 0.002 (fetched). — [Puck Over the Glass](https://puckovertheglass.substack.com/p/revisiting-scorekeeper-bias-and-scorevenue)
- An older informal analysis suggests scorers may credit known shot-blockers more readily, and that block counts favour players on the ice without the puck (search summary). — [Pension Plan Puppets: Leafs best shot blockers](https://www.pensionplanpuppets.com/the-leafs-best-shot-blockers/)

### Inferences
- For per-game hit and block projections:
  - estimate a player's rink-neutral rate as raw events divided by the RE of each game's rink;
  - for a specific game, multiply the neutral rate by the RE of the rink being played in (and the homer term for the home team);
  - apply venue and score-state multipliers if game script is projected.

  Without this, players on teams with inflating home scorers are over-projected on the road, and players on deflating-rink teams are under-projected on the road.
- The 2007-13 multipliers are stale (two teams have since relocated or been renamed, and arenas and scorers change). Given Knodell's evidence that the spread narrowed by 2023-24, re-estimate REs on recent seasons (2023-24 onward) with the same log-linear team/opponent/rink/venue/score model, and shrink them toward 1.0.
- Hits and blocks are also driven by possession. Teams and players without the puck block and hit more, so a team's projected possession share (CF%) is a sensible covariate alongside player habit.

### Gaps
- No current (2024–26) published rink multipliers for blocks; Knodell covers hits only and his per-rink values are in charts, not text.
- No published stabilization point or year-to-year reliability for individual hits/60 or blocks/60.

## 7. Aging curves and early-season blending

### Takeaway
Skater scoring is roughly flat from the early to mid-twenties, with a mild decline from about 29 and steeper declines in the mid-30s. Estimates of the peak range from 24 to 28 depending on method and metric. The delta method is standard but biased by survivorship. Early-season projections should keep most weight on the multi-season prior and let current-season data in through sample-size-based shrinkage. One Luszczyszyn-inspired model reaches only about 50% current-season weight after a full year.

### Cited Findings
- Most aging curves use the delta method (originated by Tom Tango): average year-over-year change at each age, chained into a curve. Hockey-Graphs notes that "peak age" is misleading because the change between ages 22 and 25 is small (search summary). — [Hockey-Graphs: A New Look at Aging Curves for NHL Skaters (part 1)](https://hockey-graphs.com/2017/03/23/a-new-look-at-aging-curves-for-nhl-skaters-part-1/)
- Peak-age estimates vary (search summary):
  - 27–28 for forwards (Brander, Egan & Yeung, as cited in an SFU thesis);
  - 24 on average (a secondhand blog citation of a scoring study);
  - the mid-twenties for points per 60 (The Hockey Writers, 2025).

  — [SFU aging paper (Swartz)](https://www.sfu.ca/~tswartz/papers/aging.pdf); [SFU thesis](https://summit.sfu.ca/_flysystem/fedora/2023-02/etd22294.pdf); [The Hockey Writers: forward production and age](https://thehockeywriters.substack.com/p/how-does-the-production-of-nhl-forwards-change-with-age)
- Survivorship bias: average and below-average players drop out, so late-30s samples are elite, and the tails of the age distribution rest on few players. Proposed fixes are regression- and imputation-based age curves (search summary). — [arXiv:2110.14017](https://arxiv.org/pdf/2110.14017)
- One summary of an earlier 5v5 points/60 model says decline is mild from 24 to about 29 (about 90% of peak), then steeper, reaching about 50% of peak at 37 (secondary blog source). — [Winging It In Motown](https://www.wingingitinmotown.com/what-is-fair-to-expect-from-henrik-zetterberg-next-season/)
- Magnus uses quadratic aging around 24, f(a) = c(a − 24)² with c = 25 bp of league average, and lets older and younger players move more (prior strength 5,000 at ages 18 and 30 versus 50,000 at 24) (fetched). — [HockeyViz Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- Luszczyszyn-inspired in-season blending: day 1 is 0% current season; after about one season it is about 50% current, 35% one year back and 15% two years back. Best preseason weights were 75/25 across the two prior seasons (secondary source). — [NL Ice Data Substack](https://nlicedata.substack.com/p/assessing-players-teams-and-projecting)
- MoneyPuck's game model weights team inputs "slightly more" toward recent games, without published decay parameters (fetched). — [MoneyPuck About](https://moneypuck.com/about.htm)

### Inferences
- Early-season handling falls out of empirical Bayes: current-season weight = n_current / (n_current + k_stat), where the prior is the aged, Marcel-weighted multi-season rate. Stats with small k (shot volume, hits, blocks) should adapt within weeks; stats with large k (Sh%, IPP, on-ice Sh%) should barely move in October. Role changes (TOI, PP unit, linemates) are not noise. They should update TOI and on-ice context inputs immediately rather than waiting for rates to stabilize.
- The two aging pitfalls run in opposite directions:
  - delta-method survivorship bias understates decline in the 30s, which over-projects older players;
  - generic positive aging applied to every young player over-projects young players who are not actually improving.

  Magnus's age-dependent prior strength is a principled middle ground.
- Aging probably differs by stat (for example, finishing and physical stats versus playmaking), but no source found quantified stat-specific curves.

### Gaps
- No source quantified separate aging curves for shots/60, Sh%, assists/60, hits/60 or blocks/60.
- No published optimal in-season decay or half-life for skater counting stats; the 0% → 50% schedule above is from a Win Shares model, not a counting-stat model.
- No measured projection error (MAE, RMSE or log-loss) from public NHL skater projection systems was found to benchmark against.
