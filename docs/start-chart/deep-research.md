# Deep Research Report: Practical NHL Player Projections and Starter Board Decision Engine

**Research cutoff:** September 16, 2026, America/Chicago. The prompt specifies September 15, 2026; the system date for this investigation is September 16, 2026, so the literature and source review is current through the latter date.

**Repository boundary:** I did not inspect the local repository paths listed in the prompt. A connected GitHub search did not expose a matching installed repository. Therefore, every statement below about the existing application is explicitly based on the static-tracing findings supplied in the prompt, not independent repository verification. Repository-specific implementation choices remain contingent on Codex inspecting the named files, schemas, jobs, historical records, and tests before changing code.

## Executive recommendation and evidence matrix

The strongest practical design is **not a wholesale replacement of FORGE with a neural network or one monolithic “better model.”** The highest-value path is to make the existing projection system point-in-time correct and decision-aware, then evaluate modular challengers against it.

The recommended architecture decomposes the problem into **participation → deployment → category production conditional on deployment → scenario-aware distributions → league scoring → roster decision utility**. That decomposition matters because a player projected for 4.0 fantasy points *if he plays* but with a 60% chance of dressing has roughly 2.4 unconditional expected fantasy points before considering alternative scenarios; ranking him at 4.0 answers the wrong start/sit question. The same distinction is even more important for uncertain goalies.

NHL-specific statistical literature strongly supports contextual adjustment and shrinkage because hockey observations are sparse, players repeatedly share ice with the same teammates, scoring events are relatively rare, and raw player effects are highly collinear. Thomas et al. modeled NHL scoring hazards with teammate, opponent and game-situation effects and hierarchical shrinkage; Gramacy, Taddy and Jensen likewise emphasized shrinkage in a large, imbalanced hockey player-effect problem; Macdonald used ridge regression specifically because frequent teammate combinations and sparse goal events produce collinearity and large uncertainty. citeturn17view4turn17view5turn18academia28

The practical implication is to use **hierarchical/empirical-Bayes rate estimation and interpretable nonlinear context as the statistical spine**, retain current useful FORGE logic where it proves beneficial, and use gradient boosting as a challenger or residual component rather than assuming it is superior. CatBoost is attractive for high-cardinality tabular features because its ordered methods were explicitly designed to reduce a form of target leakage in categorical target statistics, but that general machine-learning result is not NHL-specific and therefore does not establish that CatBoost will improve this application. citeturn13search9

The second major recommendation is that **point-in-time data engineering is more urgent than model sophistication**. A historical backtest is not trustworthy if it uses lineup information, injury status, revised statistics, roster membership, or model features that were not actually available at the decision timestamp. Rolling-origin evaluation is the appropriate outer evaluation pattern for a sequential forecasting problem, but even a correctly ordered train/test split does not cure feature-level leakage. citeturn14search1turn14search2

The third major recommendation is to make the current-day lineup/news path an explicit **pregame evidence overlay**, rather than removing the existing “games before projection date” restriction. The user-supplied trace says that restriction protects the normal historical line-combination path but also excludes tonight’s lineup attached to tonight’s game. The correct fix is to preserve historical baseline logic and overlay only evidence whose **knowledge time** was on or before the projection’s `as_of` time. Corrections, deleted posts and late-arriving reports then become naturally replayable.

The fourth recommendation is to separate **goalie start probability** from **goalie fantasy value** immediately. Starting probability is an input to value, not the ranking target. A goalie with an 85% chance to start behind a weak defense against a high-shot/high-scoring opponent can be a worse fantasy start than a 70% probable starter in a favorable game. Goalie value should be a mixture over starter identity and relief scenarios and should jointly produce saves, goals allowed, win probability and shutout probability.

The fifth recommendation is to make **uncertainty a generated property of the projection model**, not a hand-built “confidence score.” Proper scoring-rule literature provides a principled basis for judging full probabilistic forecasts; logarithmic score, Brier score for binary events, and CRPS for continuous/count-derived distributions reward honest calibrated probability distributions rather than decorative confidence indicators. citeturn13search16

### Evidence matrix

“Existing,” “Partial,” “Absent on inspected page,” and “Unverified” below refer to the **user-supplied static trace**, not independent code inspection.

| Factor or capability | Supplied application status | Research evidence | Recommended treatment | Required data | Validation method | Confidence and caveats |
|---|---|---|---|---|---|---|
| Participation / probability of playing | **Unverified as a separately calibrated target** | Forecasting production without accounting for opportunity conflates distinct sources of uncertainty; hierarchical hockey work demonstrates the value of separating context and player effects. citeturn17view4turn17view5 | Add explicit `p_play`/`p_dress`; default rankings use unconditional production | Historical rosters, scratches, injury/news state, transactions, actual TOI | Brier, log loss, reliability curves; segmented by healthy scratch, injury return, call-up | **High recommendation confidence**; exact target definition must match available official roster data |
| EV/PP/PK deployment | **Existing, but empirical calibration unverified** | NHL player-effect research explicitly separates manpower/game situations; aging work also shows player-specific opportunity/selection matters. citeturn17view4turn18academia28turn15view5 | Model usage by situation separately from production rates | Shift/TOI splits, roles, lines, PP units, team PP opportunities | MAE/log-likelihood/quantile coverage for TOI and PP TOI | **High**; deployment is among the most actionable pregame signals |
| Long-term ability and shrinkage | **Existing elements; exact statistical form unverified** | NHL literature repeatedly identifies sparse/high-dimensional player effects and uses hierarchical or penalized shrinkage. citeturn17view4turn17view5turn18academia28 | Make shrinkage explicit and measurable; use position/role/age priors | Multi-season player event/TOI history | Walk-forward deviance/log score against raw-rate baseline | **High** |
| Recent form / “sustainability” | **Partial** | Public NHL xG research continues to find shot situation dominant and skill refinements often incremental; the 2025 skill-adjusted xG preprint reports only modest gains over its baseline, so apparent hot/cold finishing signals should not be presumed durable. citeturn17view3 | Replace overlapping recent-rate plus trend multipliers with one shrinkage-aware recent residual/state signal unless ablations justify both | Event history, xG/shot context, role history | Remove/add recent features in PIT ablations; compare calibration and proper scores | **Medium-high**; current 2025 xG evidence is a preprint, not definitive |
| Aging/development | **Unverified** | NHL aging research shows selection bias matters; flexible models with player effects outperformed naïve curves in simulations and NHL application. citeturn15view5 | Smooth age-by-position prior; never apply a universal fixed “peak age” rule | DOB, position, historical NHL career paths | Walk-forward by age and experience tier | **High methodology confidence**, modest effect expected game-to-game |
| Same-day lineup news | **Partial; supplied trace identifies a same-day gap** | This is principally a PIT data-engineering issue; commercial official-partner feeds illustrate that injuries, depth charts and game information can change throughout the day. citeturn17view1turn17view2 | Add bitemporal evidence/assertion/resolution layer and game-specific pregame overlay | Raw posts/announcements with publication and ingestion timestamps | Prospective latency + correctness; historical replay only where knowledge timestamps exist | **Very high priority** |
| Partial lineup / PP reports | **Partial; full promotion reportedly requires 12F/6D** | High-dimensional interaction research argues for shrinkage rather than all-or-nothing inference from sparse combinations. citeturn17view4turn17view5 | Permit assertions about individual player/line/unit changes without promoting an entire lineup | Resolved player/team/game entities, assertion type and confidence | Precision/recall on labeled reports; downstream projection ablation | **High** |
| Individual teammate chemistry | **Partial simple teammate adjustment; sophisticated effects unverified** | Frequent NHL teammate pairings cause severe confounding/collinearity; shrinkage is required to identify player effects. citeturn18academia28turn17view5 | Keep role/shared-TOI effects first; pair random effects only as challenger; defer trio effects unless data prove identifiable | Shift-level shared TOI, line histories, opponent context | Out-of-time pair-effect ablation including unseen/new pairs | **Medium**; public evidence does not establish fantasy-projection lift from pair chemistry |
| Opponent context | **Existing** | NHL player models show opponent/context adjustment matters for isolating ability, but that is not evidence that every matchup feature improves next-game fantasy forecasts. citeturn17view4turn18academia28 | Retain broad opponent defense/pace/PK/shot-quality features; validate each family | Team event rates, strengths, opponent goalie scenarios | Feature-family ablation by season/team/position | **High for broad context; lower for individual matchup history** |
| Player-vs-specific-opponent history | **Unverified** | I found no strong public NHL evidence establishing incremental fantasy value after controlling for player, team, role, venue and opponent strength; NHL interaction research warns about sparse/confounded effects. citeturn17view5turn18academia28 | Exclude by default; test only as strongly shrunk player×opponent random effect | Long interaction history with stable IDs/teams/roles | Strict out-of-season ablation | **Low evidence for implementation** |
| Rest / schedule density | **Existing rest adjustment; learned value unverified** | NHL research found condensed schedules and <1 day rest associated with higher injury rates, but that does not directly establish a particular same-game scoring penalty. citeturn20search4 | Keep as candidate predictors; learn effects instead of assuming fixed penalties; distinguish availability risk from performance effect | Schedule, rest, travel, TOI workload | Ablate rest/travel; interaction with position/usage; calibration of participation | **Moderate**; physiological mechanism is plausible, fantasy effect must be demonstrated |
| Venue recording effects | **Unverified** | Schuckers and Macdonald found significant, persistent rink effects in NHL RTSS event recording. citeturn17view6 | For talent estimation, de-bias rink effects; for fantasy prediction of officially credited HIT/BLK/SOG, reapply current-rink recording tendency if still predictive | Rink-season event factors | Holdout prediction by venue; yearly stability tests | **High importance for peripherals**, coefficients must be continually re-estimated |
| Shot quality / finishing | **Existing shot-quality context** | Current NHL EDGE publicly exposes shot-location and related tracking-derived metrics since the tracking era; recent xG research finds situation/shot quality dominant with shooter/goalie skill offering smaller incremental gains. citeturn12search1turn17view3 | Model shot quantity and quality separately; shrink finishing skill strongly | Shot events/xG, SOG, shooter and likely-goalie identity | Goal log loss/Brier; goals/SOG calibration; ablation of skill adjustment | **High concept confidence; source-access caveats apply** |
| Public tracking features | **Coverage unverified** | NHL says tracking became fully operational in 2021-22; the public EDGE product is curated rather than a comprehensive raw data dump and historically refreshed after games rather than functioning as a same-day lineup feed. citeturn12search1turn12search3 | Use only where licensed/stably ingestible and demonstrated incremental value | EDGE or licensed tracking feed | Season-era ablation, especially 2021-22+ | **Medium** because usable raw access/licensing is the limiting factor |
| Goalie fantasy value | **Partial: ordering reportedly uses start probability** | Shot context and goalie identity can affect goal probability; commercial feeds expose goalie/shot-zone data, but start probability alone cannot represent saves, GA, wins and shutouts. citeturn17view1turn19academia20 | Separate start model and conditional performance model; simulate joint fantasy outcomes | Starter news, goalie history, opponent shots/xG, team win model | Start Brier/log loss plus fantasy CRPS/regret | **Very high priority** |
| League scoring personalization | **Absent on inspected page / selector disabled** | Yahoo’s current developer catalog still lists Fantasy Sports API support for Hockey game, league, team and player information, showing that first-party league integration remains technically plausible, though exact endpoint/scoping details must be reverified. citeturn20search0turn20search8 | First implement internal scoring-profile registry; external league integration later | League categories/weights, roster slots, eligibility, availability | Golden scoring fixtures and optimizer tests | **High for internal scoring; external access dependent** |
| Probabilistic uncertainty | **Unverified calibration** | Proper scoring rules provide principled evaluation for probability and distribution forecasts. citeturn13search16 | Produce scenario-aware predictive distributions; display calibrated quantiles instead of arbitrary confidence | Historical PIT outcomes and model residuals | Log score, CRPS, Brier, coverage, PIT/reliability | **Very high** |
| Historical backtesting / leakage controls | **Unverified** | Rolling forecasting-origin evaluation is designed for sequential forecasts; forecast-evaluation research stresses out-of-sample design decisions. citeturn14search1turn14search2 | Build replay harness before declaring model improvements | Historical immutable snapshots or reconstructible as-of data | Rolling-origin, nested tuning, paired block bootstrap | **Critical prerequisite** |
| Team Form visualization | **Existing and reportedly separate from ranking inputs** | No research reviewed here establishes that the displayed chart should independently modify projections after underlying rate/team-context features are included | Keep explanatory-only until an ablation proves incremental forecast value | Existing form history | Add-feature ablation | **High confidence in deferral** |

The evidence matrix points to an important ordering principle: **better timestamps, target decomposition, goalie value, uncertainty and evaluation are more defensible investments than adding extra “hockey intelligence” multipliers.** A complex model evaluated against leaky history can look better while being worse in production.

## Prediction problem and recommended model architecture

**Prediction unit.** For a player \(i\), team \(t\), game \(g\), decision timestamp \(\tau\), and strength state \(s\in\{\mathrm{EV},\mathrm{PP},\mathrm{PK}\}\), every feature must be a function of information available by \(\tau\). This “as-of” qualifier should be part of the model contract, not merely a backtest convention.

Define:

\[
D_{ig} = \mathbb{1}\{\text{player appears in game}\}
\]

\[
p_{ig}(\tau)=P(D_{ig}=1\mid \mathcal I_\tau)
\]

where \(\mathcal I_\tau\) is the information set genuinely available at decision time. If the data can reliably distinguish being on the dressed roster from taking a shift, model those separately; otherwise, for fantasy purposes, `played = TOI > 0` is the most useful operational endpoint.

Conditional on playing, let:

\[
M_{igs} = \text{minutes played in strength state }s
\]

and for statistic \(k\),

\[
Y_{igsk} = \text{count of statistic }k\text{ in state }s.
\]

The fundamental fantasy target is then **not** merely \(E[Y\mid D=1]\). It is:

\[
E[Y_{igk}\mid\mathcal I_\tau]
=
p_{ig}(\tau)
E\left[
\sum_sY_{igsk}\mid D=1,\mathcal I_\tau
\right],
\]

plus any separately modeled relief/partial-appearance scenario where appropriate.

That distinction should be visible in the API. Suggested fields are `play_probability`, `conditional_mean`, `unconditional_mean`, and distribution quantiles. The board should rank normal start/sit decisions by unconditional utility while permitting users to inspect “if active” production.

### Target definitions

For skaters, the preferred primitive targets are:

| Fantasy statistic | Preferred modeling target |
|---|---|
| Goals | Goals by strength; preferably linked to SOG/shot quality rather than completely independent count |
| Primary assists | A1 by strength |
| Secondary assists | A2 by strength |
| Total assists | Derived \(A1+A2\), unless source limitations force a direct model |
| SOG | Credited shots on goal by strength |
| PPP | Derived from PP goals + PP assists, rather than independently projected where possible |
| Hits | Credited hits, with latent player ability plus rink recording context |
| Blocks | Credited blocked shots, likewise rink-aware |
| PIM | Prefer penalty-event count plus penalty-duration/type model; direct overdispersed count is a simpler baseline |
| SHP | Derived from SH goals/assists if required by a league |
| Faceoff wins | Binomial-like opportunities × win rate if required |
| Plus/minus | Only if league scoring requires it; model jointly with team/game scoring state rather than as player “ability” |
| TOI | Total plus EV/PP/PK decomposition |
| Shots/attempts/xG | Intermediate opportunity/quality targets, not necessarily league outputs |

Power-play points deserve special attention. If \(G_{\mathrm{PP}}\) and \(A_{\mathrm{PP}}\) are already modeled, then

\[
PPP=G_{\mathrm{PP}}+A_{\mathrm{PP}}
\]

is internally coherent. Independently fitting a PPP model can produce impossible or contradictory marginal projections unless a reconciliation layer fixes them.

PIM is also structurally different from SOG or HIT. Penalty minutes arrive in discrete penalty events with characteristic durations, so a compound model,

\[
N_i^{pen}\sim \text{NegBin}(\mu_i,\phi),
\qquad
L_{ij}\sim \text{Categorical}(2,4,5,10,\ldots),
\qquad
PIM_i=\sum_jL_{ij},
\]

is more faithful when the data support it.

### Strong baseline

Before fitting any sophisticated challenger, implement a reproducible empirical-Bayes baseline.

For a count statistic, a simple Gamma-Poisson version is:

\[
Y_i\mid\lambda_i,E_i\sim\operatorname{Poisson}(E_i\lambda_i)
\]

\[
\lambda_i\sim \operatorname{Gamma}(a_r,b_r),
\]

where \(E_i\) is exposure in hours and \(r\) indexes an appropriate peer group such as position/role. The posterior mean is:

\[
E[\lambda_i\mid Y_i,E_i]
=
\frac{a_r+Y_i}{b_r+E_i}.
\]

This gives an explicit, auditable form of regression toward an appropriate prior. In actual NHL data, residual overdispersion should be tested and negative-binomial likelihood used when warranted; many zeros alone are not sufficient justification for zero inflation. That methodological warning has been demonstrated outside hockey by Warton and transfers directly to model selection: compare ordinary count, hurdle and zero-inflated alternatives empirically rather than equating “many zeros” with “zero-inflated process.” citeturn13search3

Recent and prior seasons should feed the baseline through **time weighting plus shrinkage**, rather than several overlapping modifiers. A generic exposure-weighted estimator is:

\[
\hat\lambda_i =
\frac{
\alpha_0 m_r+
\sum_j w(t_j)Y_{ij}
}{
\beta_0+
\sum_j w(t_j)E_{ij}
},
\]

where \(w(t)\), for example an exponential decay, is tuned inside historical training folds. Its half-life must be estimated, not invented.

For usage, a baseline can estimate:

\[
E[M_{i,s}\mid D=1]
=
\text{shrunk weighted mean of recent situation-specific minutes},
\]

with explicit role overrides from current line/PP evidence.

This simple baseline is valuable because it is hard for a complex model to hide behind opaque gains: every challenger must beat a reasonable recency + regression-to-mean + role baseline.

### Preferred production statistical core

The preferred production model is a **modular hierarchical generalized model**, enhanced by GAM-style smooth effects and optionally ensembled with a tabular booster once validation proves lift.

For category \(k\) and strength state \(s\):

\[
Y_{igsk}\mid D=1,M_{igs}
\sim
\operatorname{NegBin}(\mu_{igsk},\phi_k)
\]

with

\[
\log \mu_{igsk}
=
\log\left(\frac{M_{igs}}{60}\right)
+
\alpha_{k,s}
+
u_{i,k,s}
+
f_{k,s}(\mathrm{age}_{i})
+
\beta_{k,s}^{T}X_{ig}
+
\gamma_{k,s}^{T}R_{ig}.
\]

Here:

- \(\log(M/60)\) is the exposure offset.
- \(\alpha\) is the population intercept.
- \(u_{i,k,s}\) is a partially pooled player effect.
- \(f(\mathrm{age})\) is a smooth age term.
- \(X\) contains stable player/team/opponent context.
- \(R\) contains current role/deployment/scenario features.
- \(\phi_k\) is the category-specific overdispersion parameter.

An appropriate prior is:

\[
u_{i,k,s}\sim N(0,\sigma^2_{k,s,r(i)}),
\]

potentially with separate variances for forwards, defensemen and role tiers. This is directly aligned with the NHL-specific finding that player effects need partial pooling or regularization under hockey’s sparse, correlated design. citeturn17view4turn17view5turn18academia28

For SOG and other peripherals, this negative-binomial formulation is a practical first production model. For goals, a stronger extension is to separate opportunity from conversion:

\[
SOG_{igs}\sim \operatorname{NegBin}(\mu^{SOG}_{igs},\phi^{SOG})
\]

\[
G_{igs}\mid SOG_{igs}
\sim \operatorname{BetaBinomial}
(SOG_{igs}, p_{igs},\rho),
\]

with

\[
\operatorname{logit}(p_{igs})
=
\text{shot-quality context}
+
\text{shrunk shooter skill}
+
\text{goalie effect}.
\]

Event-level shot models are preferable when sufficiently rich shot data exist because location, situation and preceding context are important determinants of goal probability. The recent NHL skill-adjusted xG preprint found skill adjustments improved its baseline only modestly, while baseline xG remained the dominant feature; that argues for conservative shrinkage of shooting/goalie skill rather than large “finisher” multipliers. citeturn16view3turn17view3

### Modeling usage rather than hiding it inside rates

Deployment should have its own models.

For total TOI, a transformed conditional model is reasonable:

\[
\operatorname{logit}
\left(
\frac{M_i}{M_{\max}}
\right)
=
\eta_i+\epsilon_i,
\]

or a boosting/quantile model can predict the distribution directly.

PP usage is naturally two-part:

\[
P(M_{i,\mathrm{PP}}>0)=q_i
\]

followed by a positive PP share model conditional on receiving PP deployment.

This distinction prevents “zero PP production” from being interpreted as low scoring ability when the true cause is no opportunity. It also makes PP-unit news immediately actionable.

Team PP opportunity should be modeled separately:

\[
O^{PP}_{tg}\sim
\operatorname{NegBin}
(\mu^{PP}_{tg},\phi_{PP}),
\]

using both teams’ penalty-drawn/taken tendencies and game context. The player’s PP share then converts team opportunity into individual minutes.

### Recent form without double counting

The safest definition of “recent form” is not another multiplier over recent rolling statistics. It is a **shrunk recent residual after accounting for expected opportunity and context**:

\[
e_{it}=Y_{it}-E[Y_{it}\mid
\text{role, minutes, opponent, shot quality, venue}],
\]

\[
F_{it}
=
\operatorname{Shrink}
\left(
\sum_{j<t}\omega_{t-j}e_{ij}
\right).
\]

Then \(F\) is one feature, not three versions of the same recent scoring streak.

A more principled challenger is a dynamic state model:

\[
\theta_{i,t}=\theta_{i,t-1}+\epsilon_{i,t},
\qquad
\epsilon_{i,t}\sim N(0,\sigma_\theta^2),
\]

with counts generated conditional on \(\theta_{i,t}\). This lets the data determine how quickly apparent ability moves. It is especially attractive for usage and shot-generation rates, but maintenance and inference complexity are greater, and there is no reason to promote it unless rolling tests show materially better forecasts.

Trades, coaching changes and line changes should first modify **context and opportunity**, not erase a player’s underlying talent estimate. A new coach or trade can justify faster adaptation of role/team effects; it is not evidence that a player’s shooting talent abruptly reset.

Aging belongs in the prior/context layer. Schuckers, Lopez and Macdonald found that naïve NHL aging curves are distorted by selection: poorer older players disappear from the observed population, so flexible models with player effects are preferable to fixed population curves. citeturn15view5

### Matchup, venue, and schedule treatment

Opponent features worth testing include expected team shot volume, shot quality allowed, pace/attempt generation, PP/PK environment, likely-goalie mixture, home/away, and team system effects. The key word is **testing**: NHL player-value papers establish that teammates/opponents and game situations confound player evaluation, but they do not prove that every plausible matchup statistic improves one-game fantasy forecasting. citeturn17view4turn18academia28

Direct player-versus-opponent history should be **rejected as a default feature**. It has tiny effective samples, changes with trades, teammates and coaches, and is highly confounded. The only defensible version is a strongly shrunk player×opponent interaction:

\[
v_{i,o}\sim N(0,\sigma^2_{opp}),
\]

promoted only if \(\sigma_{opp}\) and out-of-time forecast gains survive ablation. Public evidence located in this investigation is insufficient to recommend it.

Rest and congestion are plausible but should not automatically become production penalties. A large NHL study found higher injury rates with back-to-backs and denser schedules, which supports testing participation/workload effects, but it did not establish that a specific fantasy-production percentage should be subtracted from every tired player. citeturn20search4

Travel distance, time zones and circadian direction should therefore enter as challenger features, not hard-coded hockey truths, unless this application’s walk-forward evaluation demonstrates incremental value.

Venue scorer effects are different because NHL-specific research directly found systematic rink-to-rink event-recording differences. citeturn17view6 For fantasy, there is an important two-layer solution:

\[
\text{latent HIT ability}
=
\text{observed HIT rate adjusted for historical rink scorer}
\]

then

\[
\text{forecast credited HIT}
=
\text{latent HIT expectation}
\times
\text{expected scorer effect at tonight's rink}.
\]

Removing scorer bias is correct for evaluating talent; reintroducing a stable scorer effect can be correct when predicting the **officially credited fantasy statistic**.

### Teammate identity and line chemistry

Actual linemate identities matter through at least three channels: shared ice time, team/line shot creation, and finishing/assist opportunity. The existing teammate-shot adjustment described in the supplied trace may already capture part of that.

Do **not** stack a new “chemistry score” over that signal. Hockey player-effect literature shows why: repeated linemates create collinearity so severe that ridge or hierarchical shrinkage is needed even for main player effects. citeturn17view5turn18academia28

A pair challenger can be written:

\[
\eta_{i}
=
u_i
+
\sum_{j\in L_i}a_j
+
\sum_{j\in L_i}c_{ij}
\]

with

\[
c_{ij}\sim N(0,\sigma_c^2).
\]

Only pairs with enough historical shared exposure and enough variation apart from one another can inform \(c_{ij}\). Unseen pairs shrink automatically to zero. Trio interactions are combinatorially much sparser and should remain deferred unless tracking/shift history and out-of-time tests prove value.

### Model-family decision

| Model family | Recommended role | Training objective and uncertainty | Practical strengths | Primary failure mode |
|---|---|---|---|---|
| Recent/season weighted baseline | **Mandatory baseline** | Count likelihood or MAE; empirical residual intervals | Simple, auditable, hard to fool | Misses nonlinear role/context changes |
| Empirical Bayes / hierarchical GLM | **Production backbone** | Poisson/NB/Binomial likelihood; posterior/approximate parameter uncertainty | NHL-specific rationale; principled small-sample shrinkage | Misspecified linear/additive effects |
| GAM | **Production component** | Penalized likelihood | Smooth nonlinear age/rest/context without losing interpretability | Can miss complex interactions |
| Gradient boosting / CatBoost | **Challenger; ensemble after proof** | Target-specific likelihood or loss; bootstrap/quantile/ensemble uncertainty | Strong nonlinear tabular interactions and categorical handling; fast inference citeturn13search9 | Easy to leak time-dependent features; probability calibration may need correction |
| Dynamic/state-space model | **Challenger for ability/usage** | Sequential likelihood/Bayesian posterior | Naturally represents changing role/form | More difficult fitting, tuning and debugging |
| Giant joint multivariate model | **Do not start here** | Multivariate likelihood | Theoretical coherence | Complexity, identifiability, operational fragility |
| Monte Carlo simulation | **Recommended decision layer** | Not a replacement estimator; samples fitted component distributions | Propagates lineup, goalie and category correlations | Garbage-in/garbage-out if component distributions uncalibrated |
| Neural network | **Deferred** | Task-dependent | May exploit dense tracking sequences | Current public/typical tabular NHL data do not by themselves justify complexity; maintenance cost high |

The recommended **champion/challenger policy** is consequently:

**Champion initially:** the existing FORGE engine, after point-in-time instrumentation, plus a reproducible empirical-Bayes baseline for comparison.

**Preferred production evolution:** hierarchical/GAM-style participation, deployment and category components with scenario simulation.

**Challenger:** CatBoost or another boosted tree per target, then a rolling out-of-fold ensemble only where it improves held-out proper scoring and decision utility.

**Later challenger:** dynamic latent-state models and more coherent event allocation.

**Deferred:** neural architectures unless raw tracking volume, licensing and repeated holdout gains make them worthwhile.

### Worked illustrative player/game example

All numbers below are deliberately **illustrative, not fitted coefficients or claims about a real NHL player**.

Assume Player A has:

\[
P(\text{play})=0.90
\]

and conditional deployment:

- EV: 14.0 minutes
- PP: 3.5 minutes
- PK: 0.5 minutes

Suppose the conditional rates per 60 are:

| Statistic | EV | PP | PK |
|---|---:|---:|---:|
| Goals | 0.75 | 2.40 | 0.20 |
| Assists | 1.40 | 3.00 | 0.40 |
| SOG | 10.0 | 14.0 | 4.0 |

and overall rates are 4.5 HIT/60 and 2.5 BLK/60.

Then conditional expected goals are:

\[
14(0.75)/60+
3.5(2.4)/60+
0.5(0.2)/60
=0.3167.
\]

Conditional assists:

\[
14(1.4)/60+
3.5(3.0)/60+
0.5(0.4)/60
=0.505.
\]

If PPP is derived from PP goals plus assists:

\[
E[PPP\mid play]
=
3.5(2.4+3.0)/60
=0.315.
\]

Likewise:

\[
E[SOG\mid play]=3.183,
\]

\[
E[HIT\mid play]=1.35,
\qquad
E[BLK\mid play]=0.75.
\]

Under the supplied default scoring system,

\[
FP=3G+2A+PPP+0.2SOG+0.2HIT+0.25BLK,
\]

conditional expected fantasy value is:

\[
E[FP\mid play]
\approx 3.369.
\]

But the start/sit expectation is:

\[
E[FP]
=
0.90(3.369)
\approx 3.032.
\]

Ranking Player A at 3.369 without displaying the 10% no-play mass overstates the decision value by about 11.1% relative to the unconditional expectation. This is why the board should display both **“projection if active”** and **“expected start value”**, with the latter driving the default ranking.

For a full predictive distribution, the simulation would draw the play scenario first, deployment second, relevant goalie/line scenario third, then correlated category outcomes. Consequently the distribution contains an explicit point mass near zero from the scratch scenario rather than hiding availability risk inside a generic wider standard deviation.

## Data, point-in-time features, news ingestion, and operational provenance

### Point-in-time eligibility contract

The projection engine should adopt a bitemporal rule:

> A feature may influence a prediction made at timestamp \(\tau\) only if the application could actually have known that feature by \(\tau\), using the version of that record that existed at \(\tau\).

Every mutable external fact should therefore have at least:

- **`event_time` / `effective_at`** — when the underlying hockey fact became effective.
- **`published_at`** — source publication timestamp.
- **`first_seen_at` / `ingested_at`** — when this application received it.
- **`superseded_at`** — when a correction or newer assertion invalidated it.
- **`valid_from`, `valid_to`** — hockey-domain validity.
- **source and raw-record identity**.
- **parser/resolver version**.

For external evidence, a safe historical availability timestamp is:

\[
available\_at=
\max(published\_at, first\_seen\_at).
\]

A historical projection at \(\tau\) requires:

\[
available\_at\le\tau.
\]

This prevents an old-looking post ingested after the fact from leaking backward into a replay.

Postgame statistic corrections require the same treatment. A revised shot/hit/block count must not silently replace what the training or decision system “knew” before the game unless the model explicitly trains on finalized outcomes while keeping **features** historically point-in-time.

### Recommended feature contract

| Feature family | Examples | Point-in-time rule |
|---|---|---|
| Identity/biography | NHL ID, DOB, position, handedness | Version by known date; position eligibility may be fantasy-provider specific |
| Membership | team, call-up, assignment, trade | Use membership effective at projection timestamp |
| Availability | injury, illness, scratch, return, suspension | Evidence must have been ingested by `as_of`; unresolved conflicts stay probabilistic |
| Deployment | line, pair, PP unit, PK role, projected TOI | Most recent eligible evidence; distinguish observed practice from confirmed game lineup |
| Ability | shrunk EV/PP/PK rates, shot rate, finishing, assist rates | Historical games closed before `as_of`; no current-game outcomes |
| Recent state | residual form or state-space latent value | Computed solely from prior closed games |
| Team context | shots/xG/pace/PP/PK rates | Same |
| Opponent context | shot suppression, xGA, penalties, likely goalie | Same; goalie identity represented as scenario if uncertain |
| Schedule | home, rest, B2B, travel, density | Deterministic schedule information known by `as_of`; account for postponements as known then |
| Venue | rink scorer effect | Only seasons/games before `as_of`; shrink by rink-season |
| News | source assertions | `available_at <= as_of` and assertion valid for game/team |
| League | scoring profile, eligibility, roster slots, ownership | Version corresponding to user league at decision time |

### News and lineup evidence model

The current supplied behavior should **not** be fixed by simply changing “game date < projection date” to `<=`. That would solve tonight while damaging historical replay unless every query also became as-of aware.

Instead, use an immutable evidence layer.

A proposed `lineup_evidence` record:

```text
evidence_id
source_id
source_type
external_post_id
canonical_url
author_id
raw_text_or_payload
payload_hash
published_at
first_seen_at
edited_at
deleted_at
team_id
game_id
retrieval_version
created_at
```

The raw source should never be overwritten when a correction arrives.

A second `lineup_assertion` layer represents parsed meaning:

```text
assertion_id
evidence_id
assertion_type
player_id
team_id
game_id
value_json
observed_at
effective_from
effective_to
parser_version
parser_confidence
entity_resolution_confidence
status
```

Useful `assertion_type` values include:

```text
EXPECTED_LINE
EXPECTED_PAIR
PP_UNIT
PK_UNIT
OUT
QUESTIONABLE
GAME_TIME_DECISION
EXPECTED_TO_PLAY
CONFIRMED_ACTIVE
HEALTHY_SCRATCH
GOALIE_EXPECTED_STARTER
GOALIE_CONFIRMED_STARTER
RETURNING_FROM_INJURY
```

A third `resolved_lineup_state` table captures the decision after conflict resolution, and a junction such as `projection_evidence` records **exactly which evidence and resolution records influenced every published player projection**.

That provenance structure follows the broader principle that model outputs should be auditable back to evidence rather than accepted because an automated parser said so; NIST’s current work on AI evaluation likewise emphasizes machine-readable audit trails, factual grounding and provenance. citeturn20search5turn20search11

### Partial lineup reports

The user-supplied trace says full skater lineup promotion currently requires 12 resolved forwards and six defensemen. That can remain a requirement for declaring **“full lineup resolved.”** It should not be a requirement for consuming useful partial evidence.

For example:

> “Player A moved to PP1 at morning skate.”

should create one high-value PP assertion. It need not fabricate or resolve the other 17 skaters.

Likewise:

> “A–B–C remains intact; D rotated in for E.”

can produce assertions for only those entities.

The model can then generate scenarios such as:

\[
P(\text{A on PP1})=.78,\quad
P(\text{A on PP2})=.22
\]

if conflicting information remains, rather than choosing an unsupported certainty. Those probabilities must eventually be calibrated from historical source/assertion performance; values such as `.78` are examples, not recommended constants.

### Source reliability and conflict resolution

Do not create permanent hand-written source weights such as “beat reporter = 0.9.” Start with source tiers as operational priors if necessary, then estimate reliability by **source × assertion type** against later ground truth.

A simple reliability model is:

\[
\theta_{s,a}\sim Beta(\alpha_a,\beta_a),
\]

where \(s\) is source and \(a\) is assertion type. Historical correct/incorrect assertions update that distribution.

A better production resolver can calibrate:

\[
P(\text{assertion true})
=
\sigma(
\beta_0+
\beta_{source}+
\beta_{type}+
\beta_{age}\Delta t+
\beta_{confirm}N_{independent}
+
\beta_p parser\_score
+
\ldots).
\]

Corrections should **supersede, not erase**, earlier assertions. A deleted tweet similarly remains part of the historical evidence log with `deleted_at`; a replay at a timestamp before the deletion must be able to see what the production system actually saw then.

An official later announcement should not retroactively make an earlier speculative report “confirmed” in a historical backtest.

### LLM-assisted parsing

An LLM is suitable for **structured extraction**, not for establishing hockey truth.

The safe pipeline is:

```text
raw source
  ↓
LLM → constrained assertion JSON
  ↓
schema validation
  ↓
deterministic player/team/game resolution
  ↓
consistency rules
  ↓
source/reliability resolution
  ↓
auto-publish OR human review
```

The LLM must not invent missing linemates, infer a scratch merely because a player is absent from an incomplete list, or turn “expected” into “confirmed.” Store prompt/model/parser version with every assertion.

Evaluate the parser using labeled reports and report precision, recall and F1 by assertion class. False positives for `OUT`, `HEALTHY_SCRATCH`, `CONFIRMED_ACTIVE`, and `GOALIE_CONFIRMED_STARTER` should be tracked independently because their downstream cost is substantially higher than a harmless line-number misread.

Human review is appropriate for unresolved name ambiguity, materially conflicting high-impact reports, and source texts that fail deterministic validation. “Human reviewed” should also be recorded as an explicit provenance event.

### Same-day recomputation graph

The projection system should know its dependencies:

```text
new evidence
    ↓
parsed assertion
    ↓
resolved game/team lineup snapshot
    ↓
changed participation / role / goalie scenarios
    ↓
affected projection inputs
    ↓
affected player projections
    ↓
fantasy scoring
    ↓
lineup / streamer decision layer
    ↓
Starter Board cache
```

For a PP-unit change, affected skaters are principally the player, displaced player, unit teammates, and potentially team opportunity allocations. A line change affects the changed players plus linemate-dependent features. A confirmed opposing goalie can affect every opposing shooter. A goalie scratch can affect both goalie scenarios and opponent skater scoring distributions.

Use an **input hash** for idempotency and debounce bursts of reports so a morning-skate thread does not launch redundant full-slate recomputations.

Measure operational latency as:

\[
first\_seen\_at
\rightarrow
resolved\_at
\rightarrow
projection\_completed\_at
\rightarrow
board\_visible\_at.
\]

The service-level threshold should be set from actual workload and product needs, not fabricated in this report.

### Projection provenance

Every published projection run should preserve something equivalent to:

```text
projection_run_id
decision_as_of
slate_date
code_commit
model_version
model_artifact_hash
feature_schema_version
feature_snapshot_id
news_resolution_version
scoring_profile_id
source_cutoffs_json
random_seed
started_at
completed_at
status
```

At player level, retain:

```text
projection_run_id
player_id
game_id
play_probability
conditional_stats
unconditional_stats
distribution_summary
input_hash
evidence_ids
fallback_flags
```

This makes “What changed?” answerable.

The safest change attribution is:

\[
\Delta =
Prediction(\text{current model,current inputs})
-
Prediction(\text{previous model,previous inputs}).
\]

First separate:

\[
\Delta
=
\Delta_{\text{model version}}
+
\Delta_{\text{data/input}},
\]

by recomputing old inputs with the current model or vice versa where feasible.

Within a stable model version, stage-level decompositions from the existing modular pipeline are ideal. For non-additive ML models, counterfactual input-group attribution can be used, but it should be labeled **model attribution, not causal explanation**.

### Data-source feasibility

NHL EDGE provides a useful public tracking-derived layer. The NHL states puck/player tracking became fully operational in 2021-22 and produces large volumes of location data, but the public product is a **curated presentation rather than a comprehensive raw dump**. The redesigned EDGE product continues to expose daily advanced metrics and player/team comparisons. Therefore, EDGE is valuable for feature research but should not be assumed to provide unrestricted low-latency raw tracking data for production modeling. citeturn12search1turn12search3

MoneyPuck offers unusually useful historical research data: its current download page includes season, game, line, goalie and shot datasets going back many seasons, including shot history from 2007-08 onward. Critically, MoneyPuck explicitly says its downloadable data is free for **non-commercial purposes and journalism**, requires credit, asks other users to inquire, and prohibits unapproved scraping. A commercial Starter Board therefore cannot simply adopt MoneyPuck as a production dependency without authorization. citeturn17view0turn16view6

Sportradar is a realistic paid/restricted option. Its current NHL documentation identifies it as an official NHL data partner and exposes injuries, depth charts, play-by-play, shot zones, game analytics, time on ice and live event positional information, with authentication required. It also documents all-day injury/transaction updates. Its generic API FAQ says trial keys are limited to 1,000 calls per rolling 30 days, production access has different limits, APIs are server-to-server, and pricing is related to request/update frequency. Exact production cost is therefore a sales/authorization question, not something this report can responsibly estimate. citeturn17view1turn17view2turn16view7

Yahoo’s developer catalog currently says its Fantasy Sports API supports hockey and retrieval of game, league, team and player information through Yahoo APIs/OAuth. During this research the deeper documentation returned HTTP 429 on fetch, so specific scoring-settings, roster, transaction and write capabilities should be verified against the current API contract before being included in an implementation plan. citeturn20search0turn20search8

A practical feasibility classification is therefore:

| Tier | Data | Recommendation |
|---|---|---|
| **Immediately achievable from existing/common sources** | Existing Supabase history; official game schedules/results; existing line/news ingestion; public NHL Stats/EDGE features already legally and technically consumed | First build PIT snapshots, replay and stronger models from data already possessed |
| **Achievable after ingestion/history improvements** | Immutable same-day lineup evidence, historical injury assertions, source reliability, travel/time-zone features, historical scoring profiles | High priority because these improve correctness rather than merely feature count |
| **Permission or provider dependent** | MoneyPuck in commercial use, licensed tracking, commercial realtime feeds, external fantasy-league account data | Do not make roadmap completion depend on these without explicit approval |
| **Potentially expensive/restricted** | Sportradar realtime/analytics/tracking-class feeds or comparable commercial services | Evaluate only after quantifying the gap in existing sources |

No model should make a paid source mandatory until an ablation or shadow study estimates the incremental value of the information the source would provide.

## Goalie projections, uncertainty, scoring, and personalized decisions

### Separate goalie start and performance models

For goalie \(g\),

\[
S_g=\mathbb 1\{\text{goalie starts}\}
\]

and

\[
p_g=P(S_g=1\mid\mathcal I_\tau).
\]

This is the model the supplied trace suggests the current visible ranking largely represents.

The fantasy model must instead evaluate:

\[
E[FP_g]
=
p_g E[FP_g\mid S_g=1]
+
(1-p_g)E[FP_g\mid S_g=0].
\]

The second term may be close to zero but is not always exactly zero because relief appearances occur.

Starter probability features should include current goalie announcements, recent rotation, back-to-back status, workload, injury/return status, team practice evidence and competing-goalie status. News-derived confirmation should carry the strongest immediate influence but remain subject to the same PIT evidence rules as skaters.

### Conditional goalie game model

Conditional on starting, model opponent shot volume first:

\[
N^{SOG}_{opp}
\sim
\operatorname{NegBin}
(\mu^{SOG}_{opp},\phi).
\]

Then either model save outcomes at shot level:

\[
Goal_j
\sim
Bernoulli(p_j),
\]

\[
\operatorname{logit}(p_j)
=
xG_j+
u_{\text{shooter}}
-
v_{\text{goalie}},
\]

or, if only aggregate data are available, use an overdispersed goals-against distribution conditional on shots and opponent shot quality.

The core accounting relationship is:

\[
Saves=SOGAgainst-GoalsAllowed.
\]

Those outcomes must therefore not be sampled independently.

Goalie minutes should also be random:

\[
M_g\mid S_g=1
\sim
P(M\mid
\text{game state, performance, injury, pull/relief risk}).
\]

A full-game score simulation then derives team win and shutout outcomes rather than fitting unrelated marginal probabilities:

\[
Win_g=\mathbb 1\{\text{goalie's team wins and goalie receives decision}\}
\]

\[
SO_g=\mathbb 1\{GA_g=0 \land \text{shutout eligibility conditions}\}.
\]

Recent NHL shooter/goaltender xG research supports incorporating goalie skill beyond pure shot context, but the reported improvements over baseline were modest; the evidence therefore supports a **shrunk goalie skill term**, not dramatic one-game goalie adjustments. citeturn17view3turn19academia20

### Goalie identity uncertainty as a scenario mixture

Suppose:

\[
P(G_1\text{ starts})=.65,\qquad
P(G_2\text{ starts})=.35.
\]

Every opposing skater projection should integrate over that uncertainty:

\[
p(Y_i)
=
.65\,p(Y_i\mid G_1)
+
.35\,p(Y_i\mid G_2).
\]

Once a trustworthy confirmation arrives, the mixture collapses.

This is superior to using an “average opposing goalie” and separately displaying uncertain goalie status because identity uncertainty is propagated into the actual skater distribution.

### Full-distribution simulation

A practical slate simulation can draw:

1. Player participation scenarios.
2. Line/PP role scenarios.
3. Starting-goalie identity.
4. Team game environment: EV/PP opportunity, shot and scoring volume.
5. Player usage.
6. Player category outcomes.
7. Joint fantasy scoring.

Shared scenario draws naturally create useful correlations. Two linemates share PP opportunity; a team’s shooters are affected by the same opponent goalie; opposing goalie saves correlate positively with opponent shot volume and negatively with opponent conversion; win and goals allowed are dependent.

A giant fitted multivariate probability model is not required on day one. A well-designed scenario simulator around calibrated marginal/conditional components captures the major dependencies more maintainably.

### Safe team reconciliation

Player models can produce team totals that are internally implausible. Before forcibly altering them, measure the mismatch.

Where an additive team constraint is genuinely appropriate, a variance-weighted reconciliation can solve:

\[
\min_{\tilde y}
\sum_i
\frac{(\tilde y_i-\hat y_i)^2}{\sigma_i^2}
\]

subject to

\[
\sum_i\tilde y_i=Y_{team},
\qquad
\tilde y_i\ge0.
\]

The weighting means uncertain player estimates move more than precise ones.

But do **not** naïvely force assists to sum to goals: an NHL goal can have zero, one or two credited assists. Likewise, goals and shots are structurally linked. For those categories, event simulation is safer than arbitrary post-hoc normalization.

The first implementation should therefore report reconciliation diagnostics. Promote hard reconciliation only if it improves held-out player and team forecasts.

### Calibration and quantiles

The board should expose, for example:

- mean
- median
- 20th percentile
- 80th percentile
- probability of exceeding the best bench/replacement option

but only after calibration is measured.

Do not call the 20th percentile a “floor” in an absolute sense. It is a 20th-percentile outcome, meaning outcomes below it should occur about 20% of the time when the distribution is correctly calibrated.

Proper scoring rules provide the correct evaluation framework for these distributions. Logarithmic score evaluates full predictive likelihood, Brier score evaluates binary probability events, and CRPS evaluates predictive cumulative distributions. citeturn13search16

Conformalized quantile regression is worth testing as an outer calibration challenger because it can adapt interval width to heterogeneous uncertainty, but its textbook finite-sample coverage conditions rely on exchangeability assumptions that sequential NHL observations do not cleanly satisfy. Any conformal layer therefore needs rolling, time-respecting calibration and empirical coverage evaluation rather than a blanket guarantee. citeturn10search1

### League scoring

Represent fantasy scoring as versioned configuration:

```ts
type ScoringProfile = {
  goal?: number;
  assist?: number;
  primaryAssist?: number;
  secondaryAssist?: number;
  powerPlayPoint?: number;
  shortHandedPoint?: number;
  shotOnGoal?: number;
  hit?: number;
  block?: number;
  penaltyMinute?: number;
  plusMinus?: number;

  goalieSave?: number;
  goalieGoalAllowed?: number;
  goalieWin?: number;
  goalieShutout?: number;

  // plus any supported categorical/nonlinear rules
};
```

For a linear points league:

\[
E[FP_i]
=
\sum_k w_kE[Y_{ik}].
\]

Correlation between categories does **not** matter for the mean of a linear score, but it matters strongly for quantiles and threshold probabilities. Therefore, the mean can be calculated directly while the distribution should come from joint simulation.

The supplied default becomes simply one profile:

\[
3G+2A+PPP+.2SOG+.2HIT+.25BLK.
\]

This should remain the default for backwards compatibility rather than being embedded in ranking logic.

### Category leagues

Category leagues need a fundamentally different decision objective.

The question is not:

\[
\max E[fantasy\ points].
\]

It is closer to:

\[
\max
P(\text{win weekly matchup})
\]

or

\[
\max E[\text{categories won}],
\]

conditional on current category standings, remaining games, both rosters and schedule.

A blocked-shot specialist can therefore be the correct pickup when that category is close even if his points-league expectation is mediocre.

The simulator should combine existing weekly totals with distributions for remaining starts. This naturally supports H2H-category decisions without inventing an opaque “category score.”

### Roster-slot optimization

For daily points leagues, define binary decision \(x_{i,r}\) for assigning player \(i\) to eligible roster slot \(r\):

\[
\max \sum_{i,r}x_{i,r}U_i
\]

subject to:

\[
\sum_i x_{i,r}\le1
\]

\[
\sum_r x_{i,r}\le1
\]

and

\[
x_{i,r}=0
\quad\text{when player }i\text{ is not eligible for }r.
\]

This is a small assignment/integer optimization problem, not a ranking problem. Multi-position eligibility is therefore handled correctly instead of giving every player a standalone positional rank and leaving the user to infer the lineup.

For weekly streaming:

\[
StreamerValue(p)
=
U(Roster+p-drop)
-
U(Roster)
-
TransactionCost.
\]

“Transaction cost” can represent finite weekly adds, waiver priority, FAB, opportunity cost or simply zero in an unlimited-add league.

The system should consider **usable games**, not only games remaining. A Tuesday/Thursday/Saturday streamer can be more valuable than a player with four games that all fall on already-full roster nights.

### Trust metric

Do not collapse uncertainty, source freshness and model accuracy into one arbitrary “87% confidence” number.

Expose separate concepts:

- `P(play)` or `P(start)`.
- projection distribution width.
- lineup status: confirmed / expected / unresolved.
- source freshness.
- data fallback flags.
- model/run version.
- whether a full or partial lineup was known.
- last historical calibration report.

This allows the user to understand *why* uncertainty is high.

## Backtesting, calibration, ablation, and reliability

### Historical replay design

The outer evaluation should be rolling-origin:

```text
train ──────────────┐ test slate A
train ───────────────────┐ test slate B
train ─────────────────────────┐ test slate C
...
```

Rolling forecasting-origin evaluation is a standard method for sequential forecast assessment because each evaluation only trains on data before its forecast origin. citeturn14search1turn14search2

For an NHL projection system, an evaluation record should be defined by:

```text
game_id
decision_timestamp
historical_information_snapshot
model_version
prediction
realized_outcome
```

Useful standard decision times include, for example, morning, a fixed period before puck drop, and latest pregame projection. Those exact times are product choices; the essential requirement is that each snapshot only knows information genuinely available then.

### Preventing leakage

**Historical news.** If the application does not possess trustworthy historical `first_seen_at` records, it cannot honestly claim a retrospective estimate of the benefit from same-day news. Later web timestamps are not equivalent to what the system knew. In that case, evaluate news parsing prospectively in shadow mode.

**Backfilled features.** A feature generated today from corrected historical data can be valid for model training as an outcome or stable historical statistic only if it represents something that would have been computable at the historical cutoff. A current “final lineup” table must never be joined directly into a historical pregame row.

**Training cutoffs.** All rolling features must stop strictly before the prediction cutoff. A season-to-date feature for October 20 cannot be calculated from a final season aggregate.

**Tuning.** Hyperparameter selection must occur inside the historical training period. The final evaluation windows cannot repeatedly influence feature selection or tuning.

**Roster membership.** Players must belong to the team they were actually on at that historical timestamp. Present-day team IDs cannot be retroactively joined across trades.

**Cold starts.** Rookies, call-ups and newly acquired players need role/position/league priors and separate evaluation. The model must not silently require NHL samples that they do not possess.

**Season boundaries.** Previous-season information is allowed because it was known; future-season roster/deployment information is not. Changes in rules, tracking availability and scorer behavior should be versioned.

### Baselines

No model should be called superior unless it beats several baselines:

**Naïve season baseline:** season-to-date rate × simple expected TOI.

**Recent/season blend:** shrunk weighted recent + season rate.

**Role baseline:** same plus line/PP role.

**Current FORGE:** exactly reproduced from historical input snapshots.

**Market-like or public comparator**, only if a legally usable, consistently archived historical comparator exists.

This prevents the project from “winning” merely by comparing an elaborate model to an unrealistic baseline.

### Metrics by target

| Target | Primary evaluation | Supplementary |
|---|---|---|
| Plays / dresses | Log loss, Brier score | Reliability curve, calibration intercept/slope |
| Goalie start | Log loss, Brier score | Reliability by announced/uncertain status |
| TOI / PP TOI | MAE, probabilistic log score/CRPS | Quantile coverage, bias |
| Count stats | NB/Poisson deviance or log score | MAE, RMSE, calibration by predicted bucket |
| Goal/shot conversion | Log loss/Brier | Calibration by xG/skill segment |
| Full category distribution | CRPS/log score | PIT, interval coverage and width |
| Fantasy points | CRPS/log score plus MAE | Bias and rank correlation |
| Top-N board ranking | Decision-regret / realized utility | NDCG/Spearman as descriptive measures |
| Lineup selection | Realized feasible utility and regret vs comparator strategy | Win rate in paired slates |
| H2H categories | Brier/log score for matchup/category probabilities | Categories won / regret |
| News extraction | Precision, recall, F1 | Critical false-positive rate and latency |

Rank correlation by itself is not enough. A model can improve Spearman correlation while making the actual start/sit threshold worse.

### Calibration

For a probability forecast, bucket predictions and compare predicted with realized frequencies, but include uncertainty around each empirical bin.

For a nominal interval \([L_\alpha,U_\alpha]\), evaluate:

\[
Coverage_\alpha
=
\frac{1}{N}
\sum_i
\mathbb 1
\{L_{\alpha,i}\le y_i\le U_{\alpha,i}\}.
\]

Coverage alone is not enough because extremely wide intervals trivially cover. Proper interval scores and CRPS evaluate both sharpness and reliability. citeturn13search16

### Ablation program

Use a predeclared ladder:

| Step | Added information | Question |
|---|---|---|
| Base | Shrunk season/multi-season rates | Is the minimum model competitive? |
| Usage | TOI + EV/PP/PK role | How much does deployment add? |
| Opponent | Team defense/pace/xG/PK | Does matchup improve PIT forecasts? |
| Goalie | Likely-goalie mixture | Does goalie context improve skaters? |
| Schedule | Rest/B2B/travel/density | Does it beat opportunity-only explanation? |
| Venue | Rink scorer factor | Does it improve HIT/BLK/SOG forecasts? |
| News | Pregame line/PP/scratch assertions | Does timely evidence add value? |
| Teammates | Identity/shared-TOI effects | Is value beyond line role/team context? |
| Recent state | Shrunk residual form | Is anything left after recent base rates? |
| Age | Smooth age prior | Does it improve forward prediction, especially cold starts? |
| Reconciliation | Team consistency | Does coherence improve player forecasts? |
| Booster | CatBoost residual/challenger | Is nonlinear complexity worth operating? |

Also perform **reverse ablations** from the full model, because correlated feature groups can appear useless when added last even though removing them from the mature model causes a loss.

The current `sustainability_trend_bands` logic deserves a particularly direct test:

```text
current model
vs.
trend modifier disabled
vs.
one shrinkage-aware recent residual feature
```

If the trend multiplier does not improve out-of-time proper scores and fantasy decisions, remove it even if its hockey story sounds compelling.

### Segment evaluation

Report performance by:

- forwards vs defensemen.
- top-six / bottom-six or usage tier.
- PP1 / PP2 / no-PP.
- rookies and call-ups.
- low-history players.
- injury returns.
- traded players.
- home/away.
- back-to-back status.
- high/low lineup uncertainty.
- source freshness.
- team.
- rink.
- goalie start-probability bin.
- early season vs mature season.

An aggregate improvement that is driven by stars but badly degrades low-owned streamers would be unacceptable for a Starter Board whose core use case includes streaming.

### Correlated errors and uncertainty in benchmark gains

Player-game observations from the same game/slate are not independent. A common goalie surprise or game environment can move many errors together.

Use paired resampling at an appropriately clustered unit such as **slate or game**, and where weekly fantasy utility is the endpoint, consider week-level blocks.

For model A vs B, calculate per-block paired loss difference:

\[
d_b=L_{A,b}-L_{B,b},
\]

then bootstrap blocks to estimate the uncertainty in the average improvement.

Do not report thousands of player-games as if they were thousands of independent experimental replicates.

### Promotion criteria

Numeric thresholds should **not be invented in this report**. Establish them empirically after observing historical metric variation and product utility.

A production challenger should satisfy predeclared criteria of this form:

1. Improves the target’s primary proper scoring rule against both the strong simple baseline and current champion across multiple contiguous holdout windows.
2. Does not materially worsen calibration.
3. Does not produce unacceptable regressions in critical segments.
4. Improves or at least preserves actual fantasy decision utility.
5. Fits operational latency and reliability constraints.
6. Has reproducible features and training/inference parity.
7. Has a documented rollback artifact.

For small estimated gains, the confidence interval and practical magnitude matter more than a favorable point estimate.

### Shadow testing, drift, and rollback

Every materially changed projection component should be versioned and run in shadow before becoming authoritative.

Track:

```text
feature-distribution drift
target residual drift
probability calibration drift
source freshness/coverage
projection latency
recompute failures
input fallback rate
model disagreement
segment loss
```

A challenger that wins historically but loses prospectively should remain a challenger.

Rollback should switch the active model/run pointer, not rebuild historical data. The old model artifact and its compatible feature snapshot must remain available.

## Starter Board design and prioritized implementation roadmap

### What the user should see

For each skater, the primary row should answer the decision, not expose model internals first.

**Recommendation:** Start / Lean Start / Bench / Stream candidate should be derived from an explicitly defined utility comparison. Do not use unexplained thresholds.

**Expected start value:** unconditional expected fantasy value under the selected league profile.

**If active:** conditional projection, making scratch risk transparent.

**Availability:** `P(play)` and state such as confirmed active, expected, questionable, unresolved.

**Usage:** expected TOI, PP TOI/share, line and PP unit.

**Distribution:** mean, median, calibrated 20th/80th percentiles.

**Matchup:** only model features that actually enter the projection, with direction and approximate effect where interpretable.

**Schedule:** remaining games plus **usable** games relative to roster congestion.

**Availability in fantasy league:** available/free agent/rostered if a connected league eventually provides it.

**Changed since previous run:** both fantasy-point delta and important changed inputs.

**Evidence freshness:** last lineup/news evidence time and source class.

**Projection provenance:** model/run ID and data cutoff already partly present according to the supplied trace; preserve and expand that behavior.

A representative change card could read:

> **+0.62 expected FP since 11:10 AM**  
> PP role changed PP2 → PP1; expected PP TOI increased.  
> Play probability 94% → 98% after lineup report.  
> Opposing goalie remains unresolved.  
> Projection updated 3 minutes after the latest eligible evidence.

Those numbers are illustrative UI examples; real explanations must be generated from stored run diffs.

### What “trustworthy” means on the board

Avoid a single confidence gauge.

Instead, show:

```text
Availability: High evidence / confirmed
Role evidence: Morning-skate report, 47m old
Projection interval: 2.1–5.6 FP (20th–80th percentile)
Data health: Full statistical history; opponent goalie unresolved
Model: FORGE-x.y / run abc123
As of: 6:41 PM CT
```

If a source is stale, say exactly what is stale.

If a prior-date lineup was used, show:

> Line deployment fallback: last complete lineup from Sep. 14.

If a statistical upstream source is stale through a particular game/date, say:

> Rate features use completed games through Sep. 14.

Do not silently neutralize missing features and then show the same confidence presentation.

### Streamer presentation

A streamer board should rank:

\[
\Delta U
=
U(\text{roster after add/drop})
-
U(\text{current roster}),
\]

not generic projected points.

At minimum, show:

```text
Expected usable games
Expected marginal points/categories
Best starting nights
Player to drop / opportunity cost
Availability confidence
Line/PP role
Next game projection
Weekly projection distribution
```

Until connected-league availability exists, clearly label the result **“projection-based streamer candidates”** rather than “best available pickup.”

### Goalie presentation

Goalie rows should lead with:

```text
Expected fantasy value
P(start)
Starter status
Expected saves
Expected goals allowed
P(win)
P(shutout)
Distribution
Opponent shot environment
```

This corrects the current supplied limitation where goalie ordering primarily answers “who is likely to start?”

### Roadmap

| Phase | Objective and user benefit | Dependencies | Smallest complete implementation | Likely code/data boundary, pending inspection | Migration/backfill | Meaningful tests and empirical acceptance | Rollout / cost / authorization |
|---|---|---|---|---|---|---|---|
| **Point-in-time foundation** | Make every projection reproducible and historically honest; enables all later model evaluation | Existing run tables, source schemas, scheduler knowledge | `decision_as_of`, input snapshot/hash, source cutoffs, immutable evidence IDs, replay API/test harness | Projection run orchestration; Supabase migrations; API output. Inspect supplied projection stage/query files before mapping | Backfill historical stats cutoffs where possible; do **not** manufacture historical news arrival timestamps | Same snapshot + same artifact reproduces same output; future evidence fails PIT tests; run provenance complete | Shadow metadata first; no paid service; DB migration/production publish requires separate authorization |
| **Pregame evidence overlay** | Same-day scratches, lines, PP changes and goalies influence the next projection without contaminating historical queries | PIT foundation; source ingestion inspection | Evidence/assertion/resolution tables; partial assertions; same-day game overlay; dependency-based recompute | Candidate boundaries: `lineSourceIftttReceiver.ts`, `linesCccIngestion.ts`, `lineupSourceIngestion.ts`, `lineSourceLineCombinations.ts`, `line-combo-queries.ts` | Backfill raw historical evidence only when trustworthy timestamps exist | Labeled parser precision/recall; no current-day exclusion; correction/deletion replay tests; recompute idempotency; prospective latency | Shadow then limited publish; human review rules may require operational approval; no paid data required if existing feeds sufficient |
| **Decision-correct projections** | Rank uncertain skaters and goalies by actual expected fantasy value | PIT snapshots; current FORGE outputs | Explicit `p_play`; conditional/unconditional values; goalie conditional performance; versioned scoring-profile registry with current default | Candidate: `skater-stage.ts`, adjustments, Start Chart API/page; exact location must be verified | Add columns/tables for component projections and scoring profile | Backtests beat naïve conditional ranking in realized decision utility; goalie value produces calibrated distributions; existing default scoring reproduces current values when `p_play=1` | Can shadow beside current board; no external spending |
| **Calibrated baseline and ablations** | Establish whether existing adjustments genuinely help | Replay harness and historical feature availability | Empirical-Bayes baseline, metrics, segment report, ablation runner | Prefer separate evaluation package/job, not UI request path | Historical closed-game features; avoid huge backfill until feasibility known | Reproduce current champion; predeclared rolling-origin reports; no leakage; paired uncertainty around gains | Internal/shadow only; model promotion requires human approval |
| **Distribution and explanation layer** | Show uncertainty, threshold probability and “what changed” | Component models calibrated | Scenario simulation; quantiles; previous-run diff; uncertainty/fallback UI | Projection batch job + API response + Start Chart UI | Store distribution summaries rather than every draw unless analysis requires draws | Coverage/proper-score calibration; deterministic seeded runs; explanation matches input diffs | Feature flag; easy fallback to means-only |
| **League personalization** | Answer “who should *I* start?” and “best available pickup?” | Scoring registry, optimizer, external league access or manual roster | Manual scoring/roster configuration first; daily slot optimizer; then read-only provider integration | New league/profile/roster service; Starter Board API/UI | User profiles/league config; no mass provider backfill initially | Golden scoring fixtures; brute-force optimizer equivalence on small cases; no invalid slot assignments; decision utility tests | External API integration needs privacy/security/provider review; write/submission actions remain deferred |
| **Advanced challengers and premium data** | Extract incremental performance after fundamentals are correct | Stable benchmark suite | CatBoost challenger; dynamic latent-state challenger; pair effects; commercial-feed experiment | Offline training/artifact service; should not initially replace FORGE stages | Potential large feature backfill | Promote only on repeated PIT holdouts with calibration and decision improvement | Paid services, large backfills and production model switch require separate authorization |

### What should change first

The first code change should **not** be “replace trend bands with XGBoost,” “remove the line-date filter,” or “build a neural network.”

The first executable engineering goal should be:

> **Create a reproducible, point-in-time projection snapshot and pregame evidence overlay, then expose unconditional skater/goalie fantasy value while leaving the existing FORGE numerical engine in place as the champion.**

That delivers correctness and creates the experimental infrastructure needed to decide intelligently what modeling code deserves replacement.

### Rejected or deferred approaches

**Wholesale engine rewrite — rejected.** The supplied trace already describes useful opponent, historical rate, shot-quality, role, rest, teammate and trend components. Without ablation results, rewriting all of it would destroy useful prior work and make it impossible to identify what actually improved.

**Removing the line-combination date filter — rejected.** It fixes a symptom while risking historical leakage. Add an explicit current-game as-of overlay.

**One universal “sustainability score” — rejected.** Sustainable shot generation, finishing, PP role and teammate conversion are different processes. Recent xG evidence also suggests contextual shot quality dominates many skill refinements, so a monolithic hot/cold adjustment is not justified. citeturn17view3

**Large unshrunk teammate/trio coefficients — rejected.** NHL player-effect literature shows precisely why correlated teammate designs require regularization. citeturn17view4turn17view5turn18academia28

**Player-vs-opponent historical splits — deferred/rejected by default.** Public evidence for incremental predictive value was insufficient; samples are sparse and confounded.

**Automatic zero-inflated distributions because hockey counts contain zeros — rejected.** Compare distributions diagnostically; many zeros can be explained by low conditional means. citeturn13search3

**Raw save percentage as goalie talent — rejected.** Shot context and shooter/goalie interaction matter; use shrunk context-adjusted performance. citeturn19academia20

**Fixed global home/rest bonuses without ablation — deferred.** Plausible hockey mechanisms do not establish an optimal numeric effect. NHL schedule research supports workload/injury relevance but not a universal same-game fantasy coefficient. citeturn20search4

**Arbitrary confidence/upside/matchup composite — rejected.** Display calibrated probabilities/distributions and validated decision utility instead. Proper scoring rules give a principled evaluation framework. citeturn13search16

**Raw tracking as an immediate dependency — deferred.** NHL EDGE public data are curated and the tracking era begins in 2021-22, while commercial-grade raw access can involve licensing/provider constraints. citeturn12search1turn12search3

**Neural model — deferred.** There is currently no supplied benchmark or data-volume evidence establishing that the maintenance cost would outperform hierarchical/tabular approaches.

**Direct fantasy-lineup submission — deferred.** Read-only league personalization and recommendation correctness should precede state-changing external actions.

## Codex handoff, repository evidence required, and annotated bibliography

### Precise implementation objective

**Proposed objective for `/plan → /goal`:**

> Preserve the existing FORGE projection engine as the production champion while implementing a point-in-time projection/evidence contract for Starter Board. Add same-day partial lineup/PP/scratch/goalie evidence as an auditable pregame overlay, expose participation-aware unconditional skater projections and fantasy-value-based goalie projections under a versioned scoring profile, record exact input/evidence provenance for every run, and build a rolling historical replay framework that can validate all subsequent model changes before promotion.

This is deliberately narrower than “build the final perfect model.” It establishes the foundation on which the statistically stronger model can be implemented and proved.

### Confirmed input facts versus assumptions Codex must verify

**Accepted as supplied static-trace facts, not independently inspected:**

The Starter Board reads stored `forge_player_projections`; fixed default scoring is currently \(3G+2A+PPP+.2SOG+.2HIT+.25BLK\); opening the page does not itself run projections; goalie ordering uses `start_probability`; opponent/rest/historical/line/trend adjustments exist; same-day `lineCombinations` are excluded by the normal strict-before-date lookup; roster events provide another current-change path; full lineup promotion requires 12 forwards and six defensemen; teammate shot effects exist; the scoring profile selector is disabled; actual league roster/availability and personalized slot optimization were not present on the inspected page.

**Assumptions requiring repository verification before implementation:**

The actual schema and timestamp semantics of every involved table; whether evidence rows are mutable; whether ingestion already stores raw post timestamps; how projection runs are invoked; whether recomputations are queued; whether a scoring-profile abstraction exists elsewhere; whether league integration exists outside `/start-chart`; how goalie fantasy projections may already be computed elsewhere; whether historical feature snapshots or model-training pipelines already exist; and what production jobs/schedulers actually run.

### Ordered milestones and completion criteria

**Inspect and reproduce.** Codex should first trace one complete skater and goalie projection from raw/current inputs to API response and page rendering. Completion means a written dependency map exists and a selected stored run can be reproduced without changing behavior.

**Define the as-of contract.** Add or reuse `decision_as_of`, source knowledge timestamps, run versioning and input/evidence hashes. Completion means automated tests prove that a row first seen after timestamp \(t\) cannot influence a replay at \(t\).

**Separate raw evidence from resolved lineup state.** Preserve immutable source evidence and parse individual assertions. Completion means a partial same-day PP/line/scratch report can affect only its relevant entities without requiring a complete 12F/6D lineup.

**Add game-specific pregame overlay.** Keep the historical prior-game line lookup intact, then overlay assertions valid for that game and available by the run timestamp. Completion means same-day information can influence live projections and the same query reproduces historical information sets without future leakage.

**Make start value unconditional.** Introduce or identify `play_probability`; expose conditional and unconditional means. Completion means a scratch-risk player no longer ranks as if playing were certain.

**Correct goalie decision semantics.** Preserve `start_probability` as a visible field but rank by expected fantasy value under starter/relief scenarios. Completion means the goalie order can differ from start-probability order when matchup/performance expectations warrant it.

**Version scoring.** Move the current hard-coded weights behind an explicit default profile. Completion means the existing default output is regression-tested exactly, while an alternate test profile changes rankings without modifying projection statistics.

**Build replay and baseline suite.** Implement rolling-origin evaluation, strong empirical-Bayes/recent-rate baseline, current FORGE champion, segment metrics and ablations. Completion means a report can compare models using only information available at each historical cutoff.

**Add probabilistic distributions and board explanation.** Completion means participation/role/goalie uncertainty propagates into quantiles, coverage is measured, and the board can identify which stored inputs changed between runs.

**Only then evaluate challenger models.** CatBoost, state-space models, pair effects and richer reconciliation remain challenger branches until repeated PIT evaluation justifies promotion.

### Dependency graph

```text
Repository/schema inspection
          │
          ▼
Projection-run provenance ───────► Historical replay
          │                            │
          │                            ▼
          │                     Baselines + metrics
          │                            │
          ▼                            ▼
Immutable news evidence ───────► Ablation framework
          │
          ▼
Assertion resolution
          │
          ▼
Same-day pregame overlay
          │
          ├────────► Participation model
          │
          ├────────► Deployment model
          │
          └────────► Goalie-start scenarios
                          │
                          ▼
Existing FORGE stats + improved components
                          │
                          ▼
Scenario distributions
                          │
                 ┌────────┴────────┐
                 ▼                 ▼
          Scoring profiles     Provenance/diffs
                 │                 │
                 └────────┬────────┘
                          ▼
                    Starter Board
                          │
                          ▼
              Roster/availability layer
                          │
                          ▼
                 Lineup/stream optimizer

Historical replay + metrics
          │
          └────────► CatBoost / state-space / teammate challengers
```

External paid feeds are **not** on the critical path.

### Staged verification strategy

At the database layer, test bitemporal/as-of selection, supersession, immutable evidence, idempotency and migrations.

At the ingestion layer, use fixtures for corrections, deleted posts, ambiguous names, incomplete line reports, PP changes and goalie confirmations.

At the projection layer, freeze fixtures and verify current FORGE output before changing semantics. Then test `p_play=1` as a backwards-compatibility case:

\[
E[Y]=E[Y\mid play].
\]

At the scoring layer, use hand-calculated fixtures for the default profile and alternate profiles.

At the goalie layer, verify identities such as:

\[
Saves=SOGAgainst-GA
\]

and ensure fantasy outputs are generated from consistent scenarios.

At the replay layer, include deliberate “future” records and assert that they cannot affect earlier predictions.

At the statistical layer, compare proper scores, calibration, segment loss and decision utility with paired time blocks.

At the UI layer, verify stale/fallback labels, run IDs, evidence timestamps, previous-run changes and conditional/unconditional terminology.

At production rollout, shadow new results first, then gate any ranking switch behind a model/version flag with immediate rollback.

### What can be reused

Based on the supplied trace, likely reusable components include FORGE’s stored per-stat projections, opponent context, historical rates, shot-quality context, rest/schedule features, existing line/role assignments, roster-event overrides, teammate shot adjustment, trend-band data as a candidate feature, source coverage metadata, warnings/fallback presentation, run IDs, and the existing `/start-chart` filtering/ranking interface.

The objective is to make those components **measurable and point-in-time reproducible**, not discard them.

### Material stop conditions

Stop a historical news-backtest claim if reliable ingestion/knowledge timestamps do not exist. Run a prospective shadow test instead.

Stop a commercial data integration if licensing/terms are unclear. MoneyPuck, for example, explicitly distinguishes non-commercial from other use. citeturn17view0

Stop model promotion if the challenger’s apparent gain disappears under rolling point-in-time evaluation.

Stop pair/trio modeling if effects collapse under shrinkage or unseen-pair holdouts.

Stop a probability/quantile rollout if calibration is materially worse even when point MAE improves.

Stop production publishing if the new recomputation path cannot be made idempotent and attributable to exact inputs.

Stop a large historical backfill if the information cannot be reconstructed faithfully; missing history is better than fabricated historical certainty.

Stop any paid provider purchase, production schema publication, large backfill, or external write capability pending the separate authorization required in the prompt.

### Exact repository artifacts Codex must inspect

Before finalizing a repository-specific implementation plan, Codex should inspect the supplied paths:

`/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx`

`/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts`

`/Users/tim/Code/fhfhockey.com/web/lib/projections/stages/skater-stage.ts`

`/Users/tim/Code/fhfhockey.com/web/lib/projections/calculators/skater-adjustments.ts`

`/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/line-combo-queries.ts`

`/Users/tim/Code/fhfhockey.com/web/lib/projections/utils/trend-adjustments.ts`

`/Users/tim/Code/fhfhockey.com/web/lib/sources/lineSourceLineCombinations.ts`

`/Users/tim/Code/fhfhockey.com/web/lib/sources/lineSourceIftttReceiver.ts`

`/Users/tim/Code/fhfhockey.com/web/lib/sources/linesCccIngestion.ts`

`/Users/tim/Code/fhfhockey.com/web/lib/sources/lineupSourceIngestion.ts`

It additionally needs the Supabase migrations or schemas for `forge_player_projections`, `goalie_start_projections`, `lineCombinations`, roster-event tables, `sustainability_trend_bands`, projection/model runs and source-coverage tables; all indexes/RLS policies affecting those tables; scheduler/cron/workflow definitions; projection entrypoints and job queues; training scripts and stored model artifacts; at least several raw tweet/news payloads with timestamps and their parsed/resolved rows; historical lineup samples; three representative slates with raw inputs, published projections and logs; goalie calculation code; source freshness configuration; existing tests/fixtures; and any fantasy-league/scoring/roster code outside `/start-chart`.

The most important unanswered repository questions are:

| Question | Exact evidence needed |
|---|---|
| Does news have reliable historical knowledge time? | Raw ingestion schema + representative rows with source publication and DB creation timestamps |
| What actually triggers recomputation? | scheduler/job/queue entrypoint and logs |
| Are roster events immutable? | schema, write paths and update history |
| Can a projection be reproduced? | full run record, artifact version, inputs and random seeds |
| Is `p_play` already modeled elsewhere? | projection schema and engine search |
| Is goalie fantasy value already computed elsewhere? | goalie model/service files and columns |
| Are scoring profiles implemented outside this page? | repo-wide references to scoring profile tables/types |
| Is league integration already present? | OAuth/provider modules and DB schema |
| Can historical lineups be reconstructed as-of? | source tables and timestamp semantics |
| Does training equal inference feature logic? | model training/build scripts versus runtime calculators |
| Are adjustment stages additive or interacting? | `skater-stage.ts`, adjustment code and unit tests |
| What exactly does trend freshness mean? | trend schema, producer and `trend-adjustments.ts` |
| Is Team Form truly excluded from ranking? | API mapping and page calculation path |
| What current monitoring exists? | logs, alerts, source-health jobs, dashboards |

### Codex completion checklist

- [ ] Trace one skater and one goalie end to end.
- [ ] Inventory all timestamps and distinguish event time from knowledge time.
- [ ] Locate projection run/model/source version metadata.
- [ ] Locate actual recomputation/scheduler path.
- [ ] Verify supplied same-day line-query behavior.
- [ ] Verify how roster events override lines.
- [ ] Verify partial vs full lineup semantics.
- [ ] Inspect raw news persistence and correction behavior.
- [ ] Identify existing scoring abstractions outside the page.
- [ ] Identify any existing play-probability or injury model.
- [ ] Identify any existing goalie performance model.
- [ ] Locate training/backtesting code and feature materialization.
- [ ] Confirm historical roster/team identity handling.
- [ ] Confirm whether revised statistics overwrite historical rows.
- [ ] Build a reproducible current-output fixture before changing logic.
- [ ] Do not approve a model rewrite before baseline/ablation results.
- [ ] Do not approve a historical-news benchmark without historical knowledge timestamps.
- [ ] Keep paid data, production publishing, large backfills and external writes behind separate authorization.

### Annotated bibliography and direct links

**Thomas, Ventura, Jensen & Ma — “Competing Process Hazard Function Models for Player Ratings in Ice Hockey.”** NHL-specific statistical modeling. Models team scoring as competing semi-Markov processes dependent on players on ice and explicitly uses Bayesian hierarchical partial pooling/penalization. This is one of the strongest pieces of direct evidence for contextual player effects and shrinkage in hockey, although its objective is player rating rather than one-game fantasy projection. citeturn17view4  
Direct link: https://arxiv.org/abs/1208.0799

**Gramacy, Taddy & Jensen — “Estimating Player Contribution in Hockey with Regularized Logistic Regression.”** NHL-specific. Shows why marginal plus/minus is noisy and why high-dimensional, imbalanced hockey player effects require strong prior shrinkage. Highly relevant to teammate-effect design and the danger of estimating unregularized player/pair interactions. citeturn17view5  
Direct link: https://arxiv.org/abs/1209.5026

**Macdonald — “Adjusted Plus-Minus for NHL Players using Ridge Regression with Goals, Shots, Fenwick, and Corsi.”** NHL-specific. Directly discusses teammate collinearity and sparse scoring, and shows why ridge regression and higher-frequency shot events can reduce uncertainty relative to goal-only effects. citeturn18academia28  
Direct link: https://arxiv.org/abs/1201.0317

**Schuckers & Macdonald — “Accounting for Rink Effects in the National Hockey League’s Real Time Scoring System.”** NHL-specific and directly actionable for fantasy peripheral categories. Finds significant and persistent scorer/rink effects across several recorded event types; supports estimating latent ability separately from the rink effect expected in tonight’s official statistics. citeturn17view6  
Direct link: https://arxiv.org/abs/1412.1035

**Schuckers, Lopez & Macdonald — “Estimation of Player Aging Curves Using Regression and Imputation.”** Applies flexible age-curve methods to NHL data and demonstrates the selection-bias problem in observed careers. Supports smooth age priors with player effects rather than fixed universal age adjustments. citeturn15view5  
Direct link: https://arxiv.org/abs/2110.14017

**Noel — “Expected by Whom? A Shooter and Goaltender Skill-adjusted Expected Goals Model for the NHL.”** 2025 preprint, therefore lower evidentiary weight than peer-reviewed work. Its skill-adjusted xG models report modest improvements while shot situation remains dominant, supporting conservative shooter/goalie skill adjustments rather than large finishing multipliers. citeturn17view3turn19academia20  
Direct link: https://arxiv.org/abs/2511.07703

**NHL — NHL EDGE puck and player tracking launch.** Primary league documentation. States full deployment from 2021-22, explains the high-frequency tracking infrastructure and explicitly describes the public EDGE site as curated rather than a complete raw data dump. Useful for assessing what tracking-era features are realistically public. citeturn12search1  
Direct link: https://www.nhl.com/news/nhl-edge-launches-website-for-puck-and-player-tracking-data

**NHL — redesigned NHL EDGE.** Current primary documentation describing daily EDGE updates, zone maps, player comparisons and newer metrics. Supports EDGE as a research/feature resource but not as a substitute for live lineup/news ingestion. citeturn12search3  
Direct link: https://www.nhl.com/news/nhl-edge-site-new-look-has-advanced-statistics-for-everybody

**Sportradar — NHL API overview.** Primary commercial-provider documentation. Lists injuries, depth charts, play-by-play, analytics, shot zones, TOI and real-time information; authentication is required. Useful benchmark for what a paid production-grade NHL feed can provide. citeturn17view1turn17view2  
Direct link: https://developer.sportradar.com/ice-hockey/reference/nhl-overview

**Sportradar — API registration FAQ.** Primary provider documentation for operational constraints. Documents limited trial requests, production access differences, server-side architecture and request-frequency-based commercial tiers. Exact NHL production pricing still requires provider contact. citeturn16view7  
Direct link: https://developer.sportradar.com/golf/v2/docs/faqs

**MoneyPuck — Download Data.** Useful public historical hockey resource with game/player/line/goalie/shot datasets. Its explicit non-commercial-use language is crucial: a commercial application needs permission rather than assuming the downloads are free production data. citeturn17view0turn16view6  
Direct link: https://moneypuck.com/data.htm

**Yahoo Developer Network — Fantasy Sports API.** Primary provider source confirming that current Yahoo APIs support Fantasy Hockey game, league, team and player information. Deeper endpoint details should be reconfirmed before designing an integration because current detailed pages were rate-limited during this investigation. citeturn20search0turn20search8  
Direct link: https://developer.yahoo.com/api/

**Blond, Blond & Loscalzo — “Game Spacing and Density in Relation to the Risk of Injuries in the National Hockey League.”** NHL-specific empirical study across 2005-06 through 2018-19; finds higher injury rates with back-to-backs and denser schedules. Supports schedule density as a participation/workload candidate, but does not validate a fixed fantasy-production penalty. citeturn20search4  
Direct link: https://pmc.ncbi.nlm.nih.gov/articles/PMC8058808/

**Gneiting & Raftery — “Strictly Proper Scoring Rules, Prediction, and Estimation.”** General statistical methodology, not hockey-specific. Foundational justification for using log scores, Brier-type scores, CRPS and proper interval scoring to evaluate honest probabilistic forecasts. citeturn13search16  
Direct link: https://doi.org/10.1198/016214506000001437

**Tashman — “Out-of-sample Tests of Forecasting Accuracy: An Analysis and Review.”** General forecasting methodology. Discusses rolling origins, train/test design and reproducibility of out-of-sample forecasting studies; directly relevant to a sequential NHL backtest. citeturn14search2turn14search13  
Direct link: https://doi.org/10.1016/S0169-2070(00)00065-0

**Hyndman & Athanasopoulos — time-series cross-validation / rolling forecasting origin.** General forecasting reference that clearly describes rolling-origin evaluation. Useful engineering reference for the replay harness, although NHL point-in-time feature eligibility requires additional controls beyond chronological splits. citeturn14search1  
Direct link: https://otexts.com/fpp3/tscv.html

**Bergmeir, Hyndman & Koo — “A Note on the Validity of Cross-Validation for Evaluating Autoregressive Time Series Prediction.”** General methodology warning that time-series validation assumptions matter. Supports treating dependent, sequential NHL observations carefully instead of using arbitrary shuffled folds. citeturn14search11  
Direct link: https://robjhyndman.com/publications/cv-time-series/

**Warton — “Many Zeros Does Not Mean Zero Inflation.”** General count-model methodology from ecology, not hockey. Demonstrates why zero frequency alone is insufficient evidence for a zero-inflated model; transferable as a model-selection caution for rare hockey outcomes. citeturn13search3  
Direct link: https://doi.org/10.1002/env.702

**Prokhorenkova et al. — “CatBoost: Unbiased Boosting with Categorical Features.”** General machine-learning methodology. Ordered boosting and categorical-feature handling make CatBoost a sensible tabular challenger when player/team/role/source features are categorical, but NHL superiority must be demonstrated rather than inferred from generic benchmarks. citeturn13search9  
Direct link: https://proceedings.neurips.cc/paper/2018/hash/14491b756b3a51daac41c24863285549-Abstract.html

**Romano, Patterson & Candès — “Conformalized Quantile Regression.”** General uncertainty methodology. Useful challenger for heteroskedastic intervals; its exchangeability assumptions mean NHL use should rely on time-respecting rolling calibration and empirical coverage rather than claiming automatic coverage under temporal drift. citeturn10search1  
Direct link: https://arxiv.org/abs/1905.03222

**NIST — synthetic-content provenance and current agent-evaluation work.** General AI engineering rather than hockey research. The relevant lesson for LLM-assisted lineup parsing is provenance, trusted reference evidence and machine-readable audit trails: the parser should extract claims, not become the authority for them. citeturn20search5turn20search11  
Direct links: https://www.nist.gov/publications/reducing-risks-posed-synthetic-content-overview-technical-approaches-digital-content  
https://www.nist.gov/programs-projects/building-evaluation-probes-agentic-ai