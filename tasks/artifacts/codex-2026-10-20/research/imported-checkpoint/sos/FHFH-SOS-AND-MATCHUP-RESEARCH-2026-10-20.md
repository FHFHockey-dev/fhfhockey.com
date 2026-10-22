# FHFH matchup and strength-of-schedule research

Research date: 2026-10-20 UTC. Primary-source research, read-only repository mapping, and synthetic offline checks. No application changes, production calls, historical NHL backtest or model promotion.

## Executive decisions

- The opponent/opponents’ opponents idea is the RPI family. It is a useful explainable benchmark, not an established NHL fantasy model. Keep team quality, schedule difficulty, scheduled volume and actual fantasy-usable starts distinct.
- FHFH already has overlapping implementations: BCS-style opponent points-percentage SOS, direct-win-percentage SOS, raw team-power/CTPI composites, descriptive opponent metrics, and a contextual FORGE pipeline. The native baseline is a different estimator without those contextual modifiers.
- First reconcile definitions and input provenance. In a synthetic fixture using actual exports, win%-based SOS ranks TOR above MTL (.50 vs .40), while points%-based two-hop SOS ranks MTL above TOR (.6333 vs .50). Empty history is0 in one surface and unknown in the other. These are fictional snapshots, not NHL rankings; the result proves different semantics, not that one predicts better.
- An isolated actual-source helper check confirms a second prerequisite: canonical power ratings center on100, but a downstream opponent-form adjustment centers on50. Constant offsets cancel in some home-away differences; clipping can still distort them. No deployed probability bias has been established.
- For player forecasts, adjust opportunity, rate and conversion separately. Opponent defense, likely goalie and home/rest belong in one coherent matchup layer. Underlying role/form precedes speculative head-to-head boosts. Do not add SOS again to an already matchup-adjusted forecast.
- Proposed sequence: metric/as-of contract → bounded record/latent-strength comparison → one well-supported category trial → held-out qualification. A richer SOS system must not block an independently qualified simpler FORGE release.

## Synthetic specification checkpoint

Fifteen exact-arithmetic tests passed, independently rerun, covering repeated-opponent weights, self-exclusion, observed zero versus missing denominators, future fixtures, and disconnected evidence. This prototype defines one proposed record-SOS contract; it neither validates NHL predictive lift nor selects production coefficients.

## Current task-list integration

F8 covers contextual-effect attribution and evaluation. F9 covers the staged SOS analysis and canonical definitions. F10 covers opponent-form units and historical snapshot coverage. Earlier high-priority RSO and continuation integrity work remains ahead of speculative sophistication.

All coefficients and model choices below are proposals unless explicitly identified as existing code or a published method. Current code existence is not deployment or predictive validation. Public sources are linked inside the methods/evidence sections; repository claims include exact paths and line ranges.

---

# NHL strength of schedule: decision memo for FHFH

Research date: 2026-10-20 UTC. Public-source methodology research only. No production/provider API calls, paid requests, database access, application changes, or Git mutations were made for this memo. No NHL backtest was run. Formulas below are proposed contracts unless explicitly labeled as historical or published methods.

## Decision in one paragraph

The user's opponent-record plus opponents' opponents' record idea is the **RPI family**. Build a transparent, explicitly qualified RPI-style schedule baseline, but do not equate it with predictive team strength or fantasy matchup quality. Benchmark it against a regularized opponent-adjusted team model, then use separate opponent offense/defense and category projections for fantasy. Keep the initial qualified FORGE release independent of this research program: an honest schedule-count/coverage view plus an experimental opponent-strength panel can ship before a richer model earns its place. There is no evidence here that an arbitrary RPI blend improves FHFH forecasts.

## 1. What the literature actually establishes

### Evidence, not a fitted FHFH result

- An official 2018 NCAA hockey memorandum identifies the conventional RPI weights as 25% own winning percentage (WP), 50% opponents' WP (OWP), and 25% opponents' opponents' WP (OOWP). It gives schedule-only SOS as 2/3 OWP + 1/3 OOWP, excludes head-to-head games from OWP, and documents different historical hockey weights: men's 25/21/54 and women's 30/24/46. This is historical methodology, not an NHL validation or a claim about today's NCAA selection rules. [NCAA memorandum, p. 3](https://ncaaorg.s3.amazonaws.com/championships/sports/icehockey/d3/common/2018-20DIIIMWIH_Selections_Pilot_Program.pdf)
- NCAA's women's hockey explanation describes NPI, used since 2022–23, as replacing the OWP/OOWP components with opponents' ratings and iterating to consistency. Its tournament calculation uses final ratings even for early games. That is appropriate to its retrospective selection purpose, not a license to use end-of-season information in forecast tests. [NCAA NPI explanation, pp. 1–2](https://ncaaorg.s3.amazonaws.com/championships/sports/icehockey/nc/women/NCWIH_PairWiseExplained.pdf)
- Bradley–Terry models estimate paired-comparison strength and can include home advantage and contest-specific covariates; the published BradleyTerry2 work also covers bias-reduced estimation. This supports the model family, not a guarantee it wins an NHL comparison. [Turner and Firth, 2012](https://www.jstatsoft.org/article/view/v048i09)
- Colley's published system solves a regularized win/loss schedule-adjustment problem. Its author explicitly distinguishes deservedness from predictiveness. Treat it as a useful reproducible benchmark, not a calibrated win probability by default. [Original method](https://www.colleyrankings.com/matrate.pdf), [author's description](https://www.colleyrankings.com/method.html)
- MoneyPuck describes separate winning, chance-generation, and goalie components; game forecasts add home/rest context. Its raw xG model is a shot-level scoring-probability model, not a schedule-adjusted fantasy model. The site says xG was rebuilt for 2026–27. Its findings about performance are the provider's reports, not independently reproduced here. [MoneyPuck methods](https://www.moneypuck.com/about.htm)

**Inference:** two-hop opponent records are a sensible interpretable baseline. **Unproven hypothesis:** a shrunk, opponent-adjusted, category-specific model will provide more useful weekly fantasy guidance. Only a time-correct comparison can establish that.

## 2. Keep three quantities separate

1. **Team strength:** how good team i currently is, adjusting for opponents faced. This is an estimate of i, not its schedule.
2. **Past schedule difficulty:** how strong the opponents i faced were, optionally including venue/rest conditions. This is a property of the fixtures, not whether i won them.
3. **Future fantasy schedule value:** projected opportunities and category production during a specified future window. It depends on opponents, volume, usable lineup slots, player role, and league rules. A hard opponent to beat is not necessarily hard to shoot against or bad for goalie saves.

Never label the full RPI score “strength of schedule”: the team's own results enter that score. Never call four games “easy” merely because four games offer more opportunities. Display quantity and per-game quality separately.

## 3. Exact RPI-style baseline proposed for NHL

### Data and cutoff contract

Let t be the prediction timestamp. D(t) contains only completed, finalized regular-season games whose results were available before t. Use one canonical game ID, no preseason/playoff mixing, and stable team IDs. Use actual schedule rows rather than a fixed season-length assumption. The 2026–27 NHL schedule is 84 games per team. [NHL schedule announcement](https://www.nhl.com/news/nhl-stats-pack-2026-27-regular-season-schedule)

Let n_ij count games between i and j in D(t), n_i = sum_j n_ij, and y_ig be i's result credit in game g under one explicitly chosen outcome definition:

- **Final-win baseline:** 1 for any win, 0 for any loss, including OT/shootout. Then WP = W/GP and credits for the two teams sum to one.
- **Regulation-equivalent sensitivity:** 1 for regulation win, 0 for regulation loss, 1/2 for both sides when tied after regulation. This deliberately treats post-regulation outcomes as ties; it is not the official NHL standings rule.
- **Standings-oriented sensitivity:** y_ig = actual standings points in g / 2, so P% = actual PTS/(2 GP). Do not call this win percentage. NHL awards a point for an OT/shootout loss. [NHL standings explanation](https://www.nhl.com/news/nhl-standings-are-tight-at-quarter-mark-of-2025-26-season)

Ordinarily PTS = 2W + OTL; use actual point ledger for exceptional forfeitures. Points credits in an ordinary OT game sum to 1.5, so P% is not a complementary paired-comparison probability. If f_OT is the fraction of games awarding the additional point, game-weighted league-average P% = 1/2 + f_OT/4, not 1/2. This identity is a derivation from the scoring rule, not a fitted empirical value. Do not center P% at .500 or substitute it directly into a binary win likelihood.

### Repeated opponents, exclusions, and smoothing

The following is a **specified FHFH RPI-style variant**, not a claim to reproduce every NCAA implementation. In particular, the focal-team exclusion at the second hop is intentionally stricter than a casual “average opponents' OWP” implementation.

Define p_j^(-S) as team j's shrunk result percentage after removing its games against every team in exclusion set S:

    p_j^(-S) = [sum of y_jg over eligible games + kappa * mu] /
               [eligible games + kappa]

Here mu = .5 for final-win/regulation-equivalent credit. For the points variant, use a league points-credit prior estimated from data available before t. kappa is prior-equivalent games and must be selected with past-only validation. Candidate values such as 8, 16, and 32 are a tuning grid, not a recommendation supported by this research. For a purely descriptive unsmoothed view, use kappa = 0 and mark zero-denominator cases unavailable.

Use game-frequency weights w_ij = n_ij/n_i: meeting an opponent four times should count four times. Do not silently switch to one vote per distinct opponent or pool every opponent's games into one aggregate record; those answer different questions.

**Synthetic denominator check, no shrinkage:** suppose i faces A three times and B once. Their already-excluded records are A = 4/5 = .800 and B = 1/10 = .100. The per-fixture mean is (3 * .800 + .100)/4 = **.625**. A unique-opponent mean is (.800 + .100)/2 = **.450**. Pooling unique opponents' result totals gives (4 + 1)/(5 + 10) = **.333**. Pooling records while duplicating A for each meeting gives (3 * 4 + 1)/(3 * 5 + 10) = **.520**. These are four different estimands, not interchangeable implementations of the same one. Here the intended team schedule statistic is .625. The example is constructed, not an NHL result.

    OWP_i = sum over j [w_ij * p_j^(-{i})]

For the second hop, remove the focal team from the intermediary's opponent mix as well:

    v_jk^(-i) = n_jk / sum over l != i [n_jl], for k != i

    OOWP_i = sum over j [w_ij *
                         sum over k != i,j [v_jk^(-i) * p_k^(-{i,j})]]

When j has no opponents besides i, replace its entire inner mean with mu and record that it is prior-only. This prevents i's own outcomes re-entering through i -> j -> i and removes the immediate head-to-head contribution to the inner rate. Record the exact exclusion policy with the model version; do not imply that every historical RPI implementation makes all these exclusions.

    SOS_record_i = (2/3) OWP_i + (1/3) OOWP_i
    RPI_style_i  = .25 p_i + .50 OWP_i + .25 OOWP_i

**Interpretation:** SOS_record measures schedule opponent record strength; RPI_style blends i's results and schedule. On the points-credit version, both are record indices rather than win probabilities. Return component values and eligible sample sizes alongside any single score.

For a future window H, replace only the outer weights by future fixture frequencies m_ij(H)/sum_j m_ij(H). Continue computing every inner rate and second-hop mix from D(t), not from future results. Equivalently, average each future game's opponent contribution [(2/3) p_j^(-{i}) + (1/3) sum_k v_jk^(-i) p_k^(-{i,j})]. This is a forward schedule index using today's evidence, not a forecast that the opponents' records will stay fixed. An empty window has no per-game schedule score, not an easy schedule of zero.

### What this baseline cannot establish

- It does not distinguish offense, defense, goalie skill, shot opportunity, or player usage.
- Winning percentage has large early-season variance. A 4–0 team is not established as elite; shrinkage changes uncertainty, not the number of observed games.
- Two graph hops are not a statistically optimized depth. “Opponent's opponent” is not intrinsically independent evidence.
- A weak team's rating can improve as its opponents subsequently improve, even without new games by that team. Specify whether historical displays are frozen as-of-game or recomputed as-of-now.
- Do not copy tournament bonuses, “negative win” deletions, or historical college home/away weights into an NHL prediction model without testing their effect.

## 4. Recommended opponent-adjusted benchmark

### Regularized Bradley–Terry, final-win target

For one observation per completed game, designate home team i, away team j, y_g = 1 if i wins in any manner and 0 otherwise. Let H_g = 1 at an actual home venue and 0 at a neutral site. Proposed model:

    eta_g = theta_i - theta_j + h H_g + beta' z_g
    P(home wins) = logistic(eta_g)

z contains only pregame-known context: rest differential, back-to-back indicators, verified neutral site, and eventually goalie/roster inputs. Fit home advantage h rather than treating a provider's reported effect as universal. Minimize weighted binary cross-entropy plus:

    (lambda/2) * sum_i (theta_i - theta0_i)^2

Set sum_i theta_i = 0 (center theta0 consistently), use lambda > 0, and give h and beta finite weakly informative penalties/priors too. Otherwise a fully separated early sample, such as every home team winning, could still drive an unpenalized context coefficient infinite. theta0 can initially be a league-average prior; a validated prior-season carryover is an alternative, not a given. A proposed time-decay weight is exp[-log(2) * age_days / half_life], with half-life tuned using earlier seasons. Start without many weakly identified covariates.

**Why this candidate:** each team's results are evaluated jointly against opponent strength rather than applying two ad hoc record averages. Its output has an explicit game-probability target. Regularization keeps undefeated/winless small samples finite. Model-family support is from Turner/Firth; the ridge/time-decay/prior choices here are proposals.

**Important limitations:** a disconnected schedule graph cannot reveal cross-component relative strength from results alone. A common prior supplies an anchor, not new matchup evidence. Report connectivity, effective sample size, and uncertainty. A converged optimizer does not mean an early-season ranking is reliable. Fractional OT-as-tie outcomes require an explicitly different/quasi-likelihood target, or a proper win/tie/loss model; do not quietly advertise that fit as final-win probability.

### Derive schedule difficulty from the model, not from i's win chance

For a fixed average reference team with theta_ref = 0:

    d_g = P(opponent j defeats the reference team under g's conditions)
    SOS_latent(i, H) = sum over fixtures g in H [q_g * d_g] / sum_g q_g

Use the same opponent-independent reference for every team. Setting the reference to team i would confound team quality with schedule difficulty: the same opponents would look easier just because i is stronger. Default q_g = 1 for team schedule difficulty; use different documented exposure weights only for player-specific opportunity.

The reference must hold its own-team skater talent, goalie quality and role assumptions constant, not merely theta_ref. Vary the opponent and fixture conditions, including the reference side's schedule-driven venue/rest/travel, while keeping reference talent fixed. An actual team's projected starter mixture belongs in its game/player forecast, not in a pure schedule-difficulty comparison. Opponent goalie composition may vary as part of the opponent, with its uncertainty shown.

Expose neutral-context opponent quality separately from contextual difficulty. Home/away, rest and travel enter once in the game predictor, not again as a post-hoc SOS bonus. Freeze all future-opponent estimates at t; confirmed goalie changes can produce a newer timestamped forecast.

For past fixtures distinguish:

- **Faced then:** pregame opponent strength and known context at each historical game time.
- **Retrospective now:** opponent strength recomputed using all games available at current t.

Both can be useful descriptions. Only the first is a faithful replay of what a past forecast could know.

### One inexpensive matrix benchmark: Colley

For final binary wins/losses, published Colley solves C r = b with C_ii = 2 + n_i, C_ij = -n_ij (i != j), and b_i = 1 + (W_i - L_i)/2. Its +2 term provides regularization; r is not automatically a calibrated P(win). This is a clean baseline for jointly accounting for opponent schedules. [Colley, original derivation, pp. 9–10](https://www.colleyrankings.com/matrate.pdf)

Do not inflate scope into a many-algorithm tournament. Record-only SOS, Colley, and regularized BT are enough to test whether recursion adds useful information before considering score-margin or dynamic alternatives.

## 5. Fantasy needs a category-specific matchup layer

### Proposed offense/defense decomposition

For category k and a team-side game/stint observation, define exposure E_ig = minutes/60 for a per-60 model, or the number of opportunities for an opportunity-specific model. Proposed mean structure:

    log E[Y_igk] = log(E_ig) + mu_k + a_ik + d_jk + beta_k' z_ig

a_ik is i's category production strength; d_jk is j's allowance effect, so larger d means more permissive defense for category k. Constrain team effects to sum to zero and shrink them. Fit attack and defense together so raw “allowed” rates are not mistaken for opponent-adjusted defensive quality.

- For shots/goals, start with an appropriate count likelihood and assess overdispersion.
- xG is a sum of shot probabilities and noninteger, so use an appropriate mean/quasi-likelihood or continuous response model. Do not pretend a fractional xG total is an observed Poisson count.
- Separate 5v5 and special teams. Project penalty opportunities/PP time as well as PP scoring efficiency. Overall penalty-kill percentage alone is not a full PP matchup model.
- Keep empty-net and shootout-awarded goals out of ordinary chance-generation fits, or model them explicitly. Do not mix 3v3 OT with 5v5 without labeling the exposure.
- Score/venue/flurry adjustment, shot quality, and opponent adjustment are distinct operations. If provider data is already score/venue adjusted, do not apply that correction twice. Do not assume provider xG already adjusts for opponent team strength.
- Keep goalie talent separate when projecting actual goals/saves. Avoid re-adding goalie effects already embedded in a team outcome rating or a talent-adjusted input.

MoneyPuck's current methods distinguish raw shot xG from shooting-talent adjustment, describe goalie and rest inputs, and report a 2026–27 xG rebuild. Preserve provider, metric definition, model version, and data-as-of metadata. A historical file recomputed by a newer xG model is not necessarily an as-of historical feature. [Provider methods](https://www.moneypuck.com/about.htm)

### Concrete category mapping

- **Skater goals/assists/points:** opponent defensive chances, goalie mixture and expected player role/TOI; teammate links matter for assists. A team SOS is only supporting context.
- **Shots:** opponent shot allowance/pace and expected shooter volume; do not reuse a goals difficulty multiplier automatically.
- **PPP:** opponent PK opportunities, PP allowance and player PP share. Sample sizes are smaller, so shrink more strongly.
- **Goalie wins:** own team/opponent strengths plus probability of starting, with game-level win attribution assumptions stated.
- **Goalie saves:** opponent shots, own team's suppression and expected minutes. A difficult opponent can increase saves while worsening GA/SV%, so one ease score is misleading.
- **Goalie GAA/SV%/shutouts:** project their underlying joint quantities. A plug-in aggregate SV% is total expected saves / total expected shots, and GAA is 60 * total expected GA / total expected minutes; arithmetic averages of per-game ratios are wrong. These are pooled ratio-of-means point summaries, not generally E[realized SV%] or E[realized GAA]. Exact expected realized ratios, category-win probabilities and ratio uncertainty need a joint distribution/simulation. State league minimum-start/minute rules and a zero-denominator policy: absent shots/minutes means unavailable or league-defined handling, never an arbitrary 0% or perfect score.
- **Hits/blocks/PIM:** require their own exposure/opportunity models. A win-record or xG SOS cannot be assumed to provide a validated modifier.

For each category k, a future per-game **ease** multiplier can compare a fixed reference player's expected production against the actual opponent/context with that same reference against league-average neutral conditions. Specify the reference role. For undesirable outcomes such as goals allowed, invert the display direction or label it explicitly. Do not turn an uncalibrated rank percentile into a claimed percent change in production.

### Volume, quality, and usability

For a future window H and player p:

    E[category total] = sum over g in H [P(active/start in g) * E[Y_pg | active/start]]

Keep three outputs: scheduled games, expected usable starts, and per-game matchup quality. Skater lineup congestion/off-night value depends on the user's roster and rules; a public team schedule alone cannot know it. Goalie starts are a mixture over possible starters, not all team games assigned to the likely starter. Use forecast probabilities for distant games and confirmed information only when actually available.

If a single fantasy score is required, make it league-specific: combine category projections using the scoring rules, not an arbitrary league-agnostic blend. Head-to-head category leagues need joint outcome probabilities or category-specific views rather than an unexplained sum of z-scores.

## 6. Avoid circular double boosts

Two legitimate workflows exist:

1. Use raw rates plus an explicit validated opponent adjustment.
2. Fit opponent-adjusted attack/defense or strength, then predict against the future opponent once.

Do not schedule-adjust a player rate, blend in team RPI as another strength reward, and then apply SOS again for the same fixture. The same schedule information would be credited repeatedly. Similarly, don't add an OOWP bonus on top of a latent-strength rating already learned from the whole opponent network unless a held-out ablation demonstrates incremental value.

Accounting identity to test: replacing the future opponent/context by league-average neutral conditions should remove the matchup adjustment while leaving the player baseline/role intact. Changing number of games should alter projected volume, not the reported per-game ease.

## 7. Leakage-safe validation plan

### Compare only what the intended decision needs

Predeclare separate targets: final game win; next-7/14-day team/player category totals; fantasy-usable lineup value. Do not select a fantasy model solely because it explains final standings.

1. **Baseline ladder:** schedule counts only; shrunk raw opponent rates; record-only SOS/RPI-style; Colley; regularized BT; separate offense/defense category model. Keep existing qualified FORGE output as its own comparator, not as presumed ground truth.
2. **Rolling origins:** at each historical forecast timestamp, build D(t), fit/tune only from then-available data, freeze the forecast, and score future games/windows. Use an outer held-out season or chronological block and inner earlier rolling validation. No random game-level train/test split.
3. **Time-correct inputs:** use historical injury/goalie/lineup information known at the cutoff, not eventual starters. Use historical schedule versions where available; do not let a later postponement correction masquerade as known earlier. Verify feature availability timestamps and correction policy.
4. **Provider/model leakage:** if xG was backfilled using a model trained on later seasons, separate that retrospective experiment from a true as-of test. Do not quietly label it leakage-free. Where snapshots cannot be reconstructed, use the simpler result/shot baselines and disclose limits.
5. **Metrics:** log loss, Brier and calibration for win probabilities; MAE plus appropriate deviance and interval coverage for counts/rates; rank correlation/top-streamer precision and roster-aware regret for fantasy decisions. Evaluate volume and per-game quality separately.
6. **Ablations:** OWP versus OWP+OOWP; binary win versus regulation-equivalent/points credit; no versus shrinkage/prior; no versus home/rest; no versus opponent adjustment; no versus goalie mixture. Compare equal data coverage, not a richer model's convenient subset.
7. **Uncertainty/stability:** paired comparisons on identical test windows; cluster or block uncertainty estimates by time/team-week because fixtures and overlapping forecast windows are dependent. Report early/mid/late-season and high/low-coverage slices. Check ranking churn after one surprising game.
8. **Promotion gate:** predeclare a practically meaningful improvement, acceptable calibration, coverage/freshness, uncertainty and no material category regressions. Tune thresholds on earlier data. “More comprehensive,” a nicer ranking, or one season's in-sample correlation is not a promotion criterion.

### Minimum unit/property fixtures before integration

- All-prior/no-game state stays prior-only with no fake evidence or divide-by-zero.
- One game, repeated opponents, undefeated and winless teams remain finite under shrinkage.
- Own team's games do not leak back into its record-only SOS exclusions.
- Repeated opponent weighting is per fixture; changing a single opponent's game count does not silently reweight the entire league incorrectly.
- Disconnected schedule components surface weak identification rather than confident global ranks.
- Venue/rest input enters once; neutral-site handling is explicit.
- No later results, final-season standings, eventual goalies or post-cutoff schedules enter a frozen forecast.
- Category multiplier equals one under its defined reference condition; volume and quality are separable.
- Ratio-category aggregation uses underlying totals, and shootout-awarded goals do not contaminate ordinary goal models.

## 8. Staged scope that does not block qualified FORGE

### Stage A: immediate specification and honest display

- Preserve/ship the simpler qualified FORGE path with clear window, coverage, timestamp, and availability language.
- Show actual scheduled-game counts and per-category limitations.
- Add a research-only RPI-style component card only if inputs already exist and are reliable. Show WP/OWP/OOWP/SOS separately and label provisional or prior-heavy states.
- No unsupported numeric promise of uplift. No new paid feeds or production backfills are authorized by this research.

### Stage B: offline result-only baseline comparison

- On authorized historical fixtures/results, implement the exact exclusion/outcome contracts and reproduce a few hand-checkable examples.
- Compare record-only SOS, Colley and regularized BT at rolling cutoffs.
- Output a reproducible benchmark, uncertainty, failure slices and data requirements. Stop and decide if results do not establish meaningful lift.

### Stage C: opponent-adjusted category trial

- Add one well-covered category/strength state first, preferably shots or 5v5 chance generation, with separate offense/defense and exposure.
- Add goalie and special-teams context only after coverage and as-of provenance are adequate.
- Validate against raw-rate baselines and qualified FORGE, including category-specific harms. Do not force unsupported categories into one score.

### Stage D: production promotion only after evidence

- Version model/metric definitions, calibration, exclusion policy and feature availability.
- Present average per-game difficulty/ease separately from games and usable starts; publish uncertainty/coverage states.
- Use shadow comparisons before changing user-facing rankings. Keep a reversible fallback to the simpler qualified output.

## 9. Recommended decision now

Approve the **research design**, not a production algorithm choice: RPI-style SOS is the explainable baseline; regularized BT is the minimal opponent-adjusted outcome benchmark; separate offense/defense category projections are the fantasy destination. Choose coefficients only after rolling tests. This memo completes the public-methodology investigation; computing NHL ranks, evaluating actual lift, acquiring new data, or modifying FORGE is separate work requiring the appropriate environment and authorized scope.

## Sources and limits

Primary source families used: NCAA methodology documents; Turner/Firth's paired-comparison paper; Colley's original derivation; MoneyPuck's own current model explanation; NHL's own rule/standings and schedule explanations. College tournament formulas are not NHL forecast studies. Provider performance statements have not been reproduced. No supplied source establishes that the proposed FHFH weighting, shrinkage, decay, or category mapping is empirically optimal.


---

# Record-SOS synthetic checkpoint

2026-10-20 UTC. **15 test methods passed; zero failures/errors.** A repeat run produced byte-identical JSON. This validates arithmetic and specified invariants on invented fixtures, not NHL predictive performance.

## Files and reproduction

- `sos_synthetic.py`: Python standard library only; exact `fractions.Fraction` arithmetic, no random draws.
- `SOS-SYNTHETIC-RESULTS.json`: full fixture ledgers for the main examples, exact fractions plus decimal summaries, component details, and test results.
- `SOS-METHODS.md`: the surrounding research design and empirical promotion gates.

Run from this directory:

    python sos_synthetic.py --output SOS-SYNTHETIC-RESULTS.json

The process exits nonzero if a test fails. Timing is omitted from the saved log so the JSON is reproducible. No network, provider, paid-request, database, application, or Git operations occur. All input histories are stipulated available at one frozen synthetic cutoff. This kit does not implement real-data ingestion, timestamp filtering, or historical snapshot reconstruction.

## Exact contract implemented

Default result credit is 1 for a final win and 0 for a final loss, inclusive of OT/shootout. The kit separately implements regulation-equivalent credit (both sides .5 after a regulation tie) and ordinary standings-points credit (actual ordinary-game points/2). These modes are never mixed. Exceptional standings-point forfeitures are outside this synthetic scoring constructor.

The demonstration prior is kappa=2 equivalent games and mu=.5. This is a transparent fixture choice, not an estimated NHL parameter. Points mode requires an explicit prior mean; its test uses a stipulated .55, not a fitted estimate.

For each team j and excluded team set S:

    p_j^(-S) = (eligible result credits + kappa * mu) /
               (eligible games + kappa)

Every outer fixture has one vote: opponent j's weight is its scheduled meeting count divided by all focal fixtures. This is neither a unique-opponent mean nor pooled opponents' credits/games.

- Direct opponent rates exclude every game against focal team i.
- Each intermediary j's second-hop fixture mix excludes i.
- Each second-hop team k's rate excludes games against both i and j.
- SOS = (2/3) OWP + (1/3) OOWP.
- Historical RPI-style = .25 own shrunk record + .50 OWP + .25 OOWP.
- Future opponent lists change only the outer fixture weights; all inner records/mixes remain frozen. The kit deliberately does not invent a future RPI-style score.

Missingness is explicit. No scheduled fixtures means no per-game schedule score. A zero denominator with kappa=0 is unavailable and propagates to the composite, without dropping the missing observation or renormalizing the rest. An observed 0/1 is valid zero, not missing. When an intermediary has no opponents besides the focal team, the declared structural fallback is mu and is marked prior-only.

`state=available` means arithmetically computable, not empirically reliable. Direct and second-hop prior-only exposure weights, eligible counts, and schedule components accompany it. A computable score can be entirely prior-driven.

## Results that matter

1. **No observations is not an average schedule.** With no history and no fixtures, the own-rate prior is .5 but SOS is null. If two future fixtures are known despite no results, SOS is computable as .5 with 100% direct/second-hop prior-only exposure. These states remain distinct.

2. **One game provides no independent opponent-record evidence.** After A beats B once, both schedule scores are .5 and entirely prior-driven after exclusions. Their RPI-style scores differ: A=13/24, B=11/24. This makes team results versus schedule visible.

3. **Weighting changes the answer.** Focal i plays A three times and B once. Excluding i, A is 4/5 and B is 1/10. Unsmoothed per-fixture OWP=5/8=.625; unique-opponent mean=.450; unique-record pooling=1/3; repeated-record pooling=.520. With the declared prior, OWP=97/168, OOWP=1/2, SOS=139/252, and historical RPI-style=209/336.

4. **Unknown is not zero.** The unsmoothed unequal-history example has OWP=.625, but missing second-hop rates make OOWP/SOS null. A separate positive-denominator fixture gives observed OWP=OOWP=SOS=0 and RPI-style=1/4, with `state=available`.

5. **Focal-result feedback is excluded.** Flip only the three focal-game winners, leaving opponents, fixture counts and all non-focal results fixed. Qualified SOS remains exactly 769/1620 before and after. Historical RPI-style appropriately changes from 1201/2160 to 877/2160 because own results belong in RPI. The unexcluded OWP negative control changes from 1/3 to 11/18; ordinary opponents' OWP averaging, which permits focal re-entry, changes from 13/24 to 41/90. The invariance check also runs under each declared outcome mode.

6. **Disconnected evidence stays disconnected.** Two isolated matchup pairs report two components. Their similarly situated winners receive identical prior-heavy scores; this does not establish equal underlying strength. Reversing a result in the other disconnected component cannot change focal A's score. A common prior creates a comparable numeric scale, not missing cross-component evidence.

7. **Future frequency is separate from history.** Keeping the same records but changing the future list from A,A,A,B to A,B changes SOS from 139/252 to 29/63. Inner rates are unchanged. Repeating the historical outer list reproduces historical SOS exactly.

Additional assertions check bounded scores, normalized defined mixtures, fixture-order invariance, team-relabel equivariance, and rejection of duplicate IDs, self-games, or unknown teams.

## Why naive endless averaging is not a fitted rating

The kit's triangle uses a connected, symmetric, non-bipartite neighbor-averaging matrix P. Starting with x=(1,0,0), the unanchored update x_next=P x converges to (1/3,1/3,1/3), losing all ranking separation. The seed is an arbitrary signal, not a claimed feasible round-robin record table. After 40 exact-arithmetic steps each entry is within 1e-11 of that limit.

This is an example, not a claim that every connected graph's synchronous average converges. A two-node bipartite example alternates (1,0) -> (0,1) -> (1,0). For other graphs the conserved limiting mean can be stationary-weighted rather than an arithmetic mean.

An illustrative anchored recurrence r_next=(1-alpha)y+alpha P r with alpha=3/4 and y=(1,0,0) instead converges to (5/11,3/11,3/11). The result contribution is retained at every step, and alpha<1 provides a contraction. **This is not a fitted or validated NHL rating.** It simply explains why blindly averaging neighbors repeatedly is not equivalent to a properly specified model that retains observed outcomes and has an objective, anchors/regularization, identifiability checks and a convergence criterion. No BT/Colley model was fitted, and infinite iteration was not assumed to be the user's request.

## Still empirical, and not a release blocker

These checks establish implementation consistency only. They do not establish optimal weights, prior strength, outcome credit, early-season reliability, model calibration, xG/category lift, or fantasy value. Those require leakage-safe historical comparisons and credible as-of inputs. Whether the stricter focal exclusion is predictively preferable remains a testable design choice, not an empirical conclusion from invariance alone.

Qualified FORGE can remain the simpler, explicitly limited path while this research is evaluated. No production scoring choice or richer-model promotion is warranted solely by these 15 passing tests.


---

# Strength-of-schedule code map

Read-only inspection, 2026-10-20. Application baseline supplied by lead: base `392c02af`, master `b630e0767`. Paths below are relative to `/workspace/shared/fhfhockey.com`. This is source evidence, not a claim about deployed behavior, populated data, model selection, or measured predictive improvement. No application, Git, dependency, provider, production, Vercel, or Supabase changes/calls were made. No application runtime or test suite was executed; one isolated pure-helper fixture was run outside the repository, as detailed below.

## Result

There is already an opponent/opponents'-opponents formula, but there is **no single consistent SOS contract** across the inspected surfaces. The underlying-stats page has a BCS-style points-percentage composite; the trends/legacy team page uses direct win percentage only; game predictions construct a separate recent-opponent power-rating adjustment; OMT describes raw upcoming opponent rates; FORGE already applies explicit matchup, goalie, pace, venue, and rest effects. A new multiplier pasted across those surfaces would risk inconsistent definitions and double counting.

A particularly actionable code-level concern is that the prediction-form adjustment assumes neutral power **50**, while the canonical producer centers the relevant ratings at **100**. This must be characterized before interpreting that adjustment or reusing it.

## 1. Existing record-based SOS and displayed surfaces

### Snapshot producer: common data, not a recursive rating

`web/pages/api/v1/db/update-team-sos.ts:226-241` fetches regular-season schedules once and standings at each requested date. For every occurrence of an opponent, `:268-285` adds that opponent's entire W/L/OTL record as of the snapshot date; repeat meetings repeat its record. Games dated **on or before** that date enter past, later dates enter future. Both buckets therefore use records known at the snapshot date, not future realized win records. The producer persists team records, opponent arrays with opponent/date, and aggregate opponent W/L/OTL (`:290-310`). It does not remove games against the focal team, require completed game status, or save per-opponent adjusted records.

This yields a valid descriptive question: “How good are these opponents now?” It is not the same as “How good were they before each historical meeting?” A same-day snapshot must not be assumed pregame-safe. Historic schedule reconstruction also uses the schedule fetched at run time, not necessarily the schedule version known then.

### Trends and older team-page SOS: direct wins only

`web/lib/trends/strengthOfSchedule.ts:53-59` uses W/(W+L+OTL), expressly not NHL points percentage. `:83-110` computes past and future values, pools their record denominators into combinedWinPct, and outputs 100×combinedWinPct as sosScore. `:117-172` provides separate canonical-team rankings with the same formula. Empty denominators return zero rather than unknown.

Readers: `/api/v1/trends/team-sos` reads the latest season snapshot and calls this function (`web/pages/api/v1/trends/team-sos.ts:24-50,65-89`). It does not honor a historic date selector in the inspected handler. `web/pages/statsPlaceholder.tsx:314-347` uses the canonical rankings. Thus “SOS” here excludes opponents' opponents.

### Underlying-stats SOS: BCS-style composite already implemented

`web/lib/underlying-stats/teamScheduleStrength.ts:134-149` defines NHL points percentage P=(2W+OTL)/(2(W+L+OTL)). For bucket b:

- Direct D_i,b is P from i's aggregate opponent record.
- Indirect I_i,b is the meeting-count-weighted mean of each opponent j's **own direct bucket** D_j,b (`:202-232`).
- SOS_i,b=(2D_i,b+I_i,b)/3, falling back to the available component (`:233-245`).
- Past and future are separately ranked (`:279-298`); overall sos is their unweighted arithmetic mean (`:309-322`).

The loader reads exact-date sos_standings plus games within ±14 days (`:505-538`). Schedule texture is separate: next-7/14 game counts, home/road, B2B, 3-in-4, rest advantage/disadvantage (`:430-467`). The merge appends SOS fields to team ratings, without changing those ratings (`web/lib/underlying-stats/teamLandingRatings.ts:277-308`). The actual page calls the labels “BCS-style” (`web/pages/underlying-stats/index.tsx:1188-1205`).

**Interpretation limitations:**

1. Direct ratios pool record denominators, so opponents with more games played receive additional weight beyond meeting count. Indirect is an average of ratios. These are different estimands.
2. No focal-team exclusions: i's results contribute to opponents' records, and paths i→j→i contribute indirectly. This is a finite two-hop calculation, not a converged recursive adjustment or a decontaminated RPI implementation.
3. For future, I averages opponents' **future-schedule difficulty**, rather than using opponents' historical opponent quality to estimate their present strength. That is remaining-schedule network context, not necessarily stronger evidence that the upcoming opponents are good.
4. A season-average past/future score is not a clean retrospective or upcoming SOS. Keep those outputs distinct.
5. Missing opponent snapshots are silently omitted from the indirect mean (`:223-228`); counts exist, but there is no per-component full-coverage admission gate.

## 2. Team power and CTPI are not schedule-adjusted team statistics

Canonical team power (`web/lib/power-ratings.ts`): raw NST/WGO rate sources (`:131-180`), last-25-game exponential decay with 10-game half-life (`:3-4,320-380`), early-season league shrinkage (`:503-521`), offense = .7z(xGF60)+.2z(SF60)+.1z(GF60), defense = -.7z(xGA60)-.2z(SA60)-.1z(GA60), pace=z(pace) (`:581-589`). Final main and subratings are centered at **100**, generally 100+15z (`:652-683`). No opponent quality enters these formulas.

The display team-power composite is a further different number: mean(off,def,pace)+1.5×(3−PP tier)+1.5×(3−PK tier), `web/lib/dashboard/teamContext.ts:27-40`. The dated opponent-strength index splits that composite into thirds only when ≥30 teams are present (`web/lib/teamOpponentStrength.ts:16-49`). It is reusable context, not a continuous corrected SOS.

CTPI (`web/lib/trends/ctpi.ts`) filters gp=1 and uses last-10 linear weights 1,.9,…,.1 (`:45-46,120-149,230-235`). After cross-team standardization, offense=.5xGF+.3HDCF+.2GF; defense=−.5xGA−.3HDCA−.2CA; ST=.55PPxGF−.45PKxGA; goalie=.4 season GSAx+.6 recent GSAx. Raw=.35 offense+.30 defense+.20 goalie+.15 ST+.10 PDO luck; score=50+15raw (`:291-321`). It contains no opponent ID or schedule correction. Only explicitly approved, versioned, nonempty CTPI is eligible for trusted consumers (`:3-18`).

The V2 candidate improves missingness/coverage, effective sample size and excludes PDO from the score, but is still not opponent-adjusted (`web/lib/trends/recentTeamFormV2.ts:3-10,64-69,107-112,171-241`). Do not present candidate availability as publication or model promotion.

## 3. Forecast context is a separate existing path

`web/lib/game-predictions/featureBuilder.ts:1091-1157` constructs recent-opponent strength from at most 10 prior team games and each opponent's power snapshot strictly **before that historical game**. It averages off/def/goalie/special (`:1082-1088`), unlike the display's off/def/pace+tier composite. Last-5 is calculated after dropping opponents missing power rows, which can differ from the raw recent-form window; a gap-aware join is needed for exact comparability.

Current adjustment formulas (`:1160-1208`):

- adjusted goal differential/game = raw + (opponent composite−50)/50.
- adjusted xGF share = clamp(raw + .05×(opponent composite−50)/50,0,1).

**Scale mismatch:** canonical ratings are centered at 100 (`power-ratings.ts:652-683`). A composite of 100 produces +1 GD/game and +.05 xGF share, not zero adjustment. It is not safe to “correct” coefficients without an offline characterization and evaluation. Equal offsets can cancel in a home-minus-away feature, but clipping, missingness, heterogeneous producer versions and interpretation remain relevant. This audit does not establish realized prediction harm.

**Verified source provenance and offline check:** `update-team-power-ratings.ts:221-222,316-323,359-363` passes calculateFinalRating output unmodified into team_power_ratings_daily. `featureBuilder.ts:2730-2737` selects the same columns, and `:2894` passes raw results directly to feature inputs; `:670-673` only converts finite numeric values. No 100→50 conversion occurs. The reader does not select calculation_version/source_through_date, so it cannot admit rows by canonical producer version. The standalone `verify-sos-scale.cjs` extracts/transpiles only the actual pure producer/consumer functions, without importing application modules. `SOS-SCALE-FIXTURE.json` records source hashes and passing arithmetic observations: neutral producer ratings/composite=100; raw GD=0 becomes1; raw xGF=.50 becomes.55. Home−away GD (.4−.2) stays .2; interior xGF (.55−.50) stays .05; clipped xGF (.98−.95) changes from .03 to0. Downstream subtracts home−away before vectorization (`featureBuilder.ts:1906-1920`), and learned training-set centering/scaling is applied (`baselineModel.ts:578-628`), so the per-team offset alone does not prove probability bias or predictive degradation. No model inference, calibration check, row-population claim, or live version check was performed.

**Retrieval coverage prerequisite:** the live-input loader requests only the latest 100 power rows across the entire league, without a team-specific historical bound/pagination (`featureBuilder.ts:2730-2737`), while this feature needs dated opponents’ snapshots from prior meetings. It can therefore omit older required snapshots even when they exist. Characterize this with bounded fixtures before reusing the recent-opponent features.

The baseline's feature list contains raw form, CTPI, opponent composite, opponent-adjusted form and FORGE projection differences (`web/lib/game-predictions/baselineModel.ts:22-58`). This establishes a source-code input path, not that all are selected in the deployed champion. `featureBuilder.ts:702-710` provides a useful strict-prior selector, while date filtering alone does not prove original publication-time availability.

## 4. OMT is descriptive upcoming context, not a forecast scaler

`web/components/GameGrid/utils/useOpponentMetricsData.ts:74-105` averages raw GF/GA/xGF/xGA/SF/SA per game across selected week opponents, plus PTS/(2GP), and returns null unless every scheduled opponent has the metric. Current-season all-strength nst_team_stats is the source (`:140-165`); source-observation freshness/as-of safety is explicitly unknown (`:251-272`). This is not opponent-adjusted and has no opponents'-opponents component.

Existing safeguards are especially reusable: role/category-specific direction rather than a universal “easy” sign; high opponent shots help saves/blocks but hurt GA; all-strength rates cannot proxy PPP or SV% (`web/components/GameGrid/utils/opponentCategoryEffects.ts:24-56`). Generic strength inputs are explicitly disallowed as category factors (`:72-99`). The file already has effect-ownership/double-count detection (`:82-89`).

## 5. FORGE already applies opponent effects

The historical forge_team_game_strength table contains raw summed player shots/goals/TOI by manpower, not schedule-adjusted strength despite its name (`web/lib/projections/derived/buildStrengthTablesV2.ts:365-402`). Raw team history queries exclude the cutoff date (`web/lib/projections/queries/team-context-queries.ts:39-50,420-452`).

Forecast adjustments are explicit: team xGF, opponent xGA/save%, NST pace proxy, PDO, sample shrinkage and bounded shot/goal/assist multipliers (`web/lib/projections/calculators/skater-adjustments.ts:221-295`), plus opponent goalie and rest/venue context (`:298-402`). These multiply skater rate/conversion forecasts directly (`web/lib/projections/stages/skater-stage.ts:2097-2116,2148-2161`). Goalie shots/win context also uses opponent offense/defense priors (`web/lib/projections/calculators/team-context-adjustments.ts:30-100`) and further rest/home/ST/NST effects (`web/lib/projections/stages/goalie-stage.ts:281-287,333-339`). No record-based OOW input was found in these bounded stage/calculator paths.

Do not apply an additional generic opponent/pace/rest/goalie factor to a FORGE-derived output without attributing and ablating effects already present. Preserve neutral baseline vs today's matchup-conditioned forecast as separate objects.

## 6. Legacy duplication not to revive

`web/lib/supabase/Upserts/fetchPowerRankings.js:849-941` has another SOS: average l_ten_pts_pct from power_rankings_store, with past rows date≤cutoff and **future rows date≥cutoff**. It is not OOW, weights returned history rows rather than scheduled repetitions, and is unsuitable for pregame backtests. Its route is a 410 quarantine stub (`web/pages/api/v1/db/update-power-rankings.ts:20-32`). The alternate `update-team-power-ratings-new.ts` is a no-write quarantine stub. Do not add parallel writers or treat retained source as active ownership.

## Recommended reuse boundary

Reuse canonical game/team identity, retained cutoff-safe game facts, dated power/CTPI provenance, existing SOS opponent arrays where verified, and texture/coverage/effect-ownership patterns. Define one versioned **raw record SOS** and an independently evaluated **latent/opponent-adjusted team strength** module; expose past vs next-N/remaining schedule explicitly. Freeze a cutoff for every evaluation. Resolve win% vs NHL points%, meeting vs pooled-denominator weights, focal-team exclusions, early-season shrinkage and missing-source gates before selecting coefficients. Compare OWP-only, existing two-hop, and recursive/shrinkage challengers offline; keep outcome adjustment separate from fantasy category context.

Nearest existing tests: `web/lib/underlying-stats/teamScheduleStrength.test.ts:8-128`, `web/lib/trends/strengthOfSchedule.test.ts:29-69`, `web/lib/game-predictions/featureBuilder.test.ts:979-1127`, and OMT tests beside the hook. They were inspected by name/source only, not executed.


---

# FORGE contextual code map, read-only, 2026-10-20

Scope: bounded inspection of `web/lib/projections` skater stages/calculators/constants/queries, reconciliation, and directly relevant native baseline files. No application edits, execution, tests, providers, production, deployment, or database checks. This establishes code behavior, not accuracy, actual input availability, runtime activation, or what the website currently serves.

Snapshots: scan HEAD `6d07db77` has no differences in `web/lib/projections` from development snapshot `392c02af` (`origin/octoberBranch`). Master snapshot is `b630e0767` (`origin/master`). All line references below are development/scan unless stated otherwise. Opponent/rest/goalie context calculator bodies, rest/goalie queries, trend utility, and reconciliation are already present in master, not newly introduced development features. Native-baseline extensions differ, so they must not be conflated with the contextual skater stage or assumed deployed.

## Eight findings

1. **Opponent quality already exists in the contextual skater stage.** `calculators/skater-adjustments.ts:221-295` combines own-team xGF, opponent xGA, opponent 5v5 save percentage, own PDO, and a team/opponent NST xGA pace proxy. Samples shrink the signal and multipliers are capped. The stage fetches both clubs and calls it at `stages/skater-stage.ts:1779-1794`; applies shot modifiers at `2097-2117` and conversion modifiers at `2148-2162`. These bodies also exist in master (calculator begins at master line 214).

2. **Opposing-goalie quality already exists, probability weighted.** `queries/goalie-queries.ts:360-410` reads up to three `goalie_start_projections`, probability-weights projected GSAA/60, and supports a confirmed-goalie restriction. `calculators/skater-adjustments.ts:298-341` shrinks by starter certainty/probability mass and lowers goal/assist conversion against stronger projected goalies. Stage wiring: `stages/skater-stage.ts:1799-1814,2151-2161`. Missing context returns neutral. No live freshness/coverage verified.

3. **Own and opponent rest already exist, without travel.** `calculators/skater-adjustments.ts:344-403` takes both teams' rest-day values and isHome, adjusting TOI, shots, goal and assist conversion. Stage wiring: `1815-1835,2011-2019,2097-2117,2148-2162`. A separate goalie stage also explicitly handles opponent B2B/defending-team B2B at `stages/goalie-stage.ts:330-337`. A new blanket B2B boost would overlap these pathways.

4. **Rest units need checking before tuning.** `queries/team-context-queries.ts:456-472` returns the calendar gap since the latest earlier game date. `utils/date-utils.ts:24-28` confirms the raw date difference; playing yesterday therefore returns 1. In the skater calculator the strongest fatigue branch is <=0, while gap 1 gets the milder fatigue component (`368-370`). The stronger branch is normally unreachable through that earlier-date query. The goalie stage treats gap 1 explicitly as B2B (`goalie-stage.ts:335-336`). This is a concrete convention inconsistency to investigate, not a proven production defect. The query also has no explicit completed-game-state filter.

5. **Home/away exists only as a generic small edge in this inspected skater path, not a demonstrated learned player split.** `calculators/skater-adjustments.ts:371-389` adds fixed home/away terms; `stages/skater-stage.ts:1831` supplies the side. A bounded search of projection queries/calculators/stages found no dedicated skater-v-opponent history or learned player-specific home/away split input. That is scoped absence, not a claim that no such data/code exists anywhere in the repository.

6. **Recent form exists twice, so do not stack a naive hot/cold boost.** Stage TOI and shot rates favor last-five inputs (`stages/skater-stage.ts:1984-2010,2058-2095`), and conversion learns from recent/all paired observations (`calculators/skater-adjustments.ts:554-599,604-649`). Sustainability trend modifiers are applied at `stages/skater-stage.ts:2234-2247`. `utils/trend-adjustments.ts:57-134` uses outside-band signed distance, effective-sample and age weighting, neutralizes stale/within-band signals, caps shots/assists at 0.88-1.12 and goal conversion at 0.86-1.14, and increases volatility. It is not a literal streak-length rule. Body already exists in master.

7. **Reconciliation can absorb common boosts; effects also compound across heads.** Stage targets TOI and shots by strength, with shots taken from team historical averages when present (`stages/skater-stage.ts:2338-2365,2509-2540`), and writes reconciled values back (`2585-2592`). `reconcile.ts:66-82,119-146` rescales player opportunities to those team totals. A team-wide multiplier applied only before this step can be partially/fully canceled or become relative redistribution, depending on shrinkage/bounds. Meanwhile goals = reconciled shots * goal conversion, assists = goals * assist conversion (`stages/skater-stage.ts:2610-2613`), so goal-context and assist-context effects compound. Team opponent-save% plus explicit goalie GSAA also overlap conceptually (`skater-adjustments.ts:250,270,278,318-332`). These are calibration/double-counting risks, not proof that existing settings are wrong.

8. **The separate native baseline is deliberately simpler.** `player-forecasts/baselinePolicy.ts:56-70` says participation excluded and adjustments none; `baselineRates.ts:184-198` labels its per-appearance rates unvalidated and without opponent/role/deployment adjustment. The newer current-season-only mean builder (`baselineRates.ts:230-267`) computes weighted observed counts per appearance and labels them unvalidated. These are not the same estimator as `stages/skater-stage.ts`; game-level UI/data-source selection was not verified. Do not tell the user every displayed projection already has all contextual factors merely because the legacy/contextual code does.

## Discussion implication

First establish which estimator feeds the user's game projections. Then a useful design is one interpretable opponent/rest/goalie game environment feeding category-specific player estimates and coherent team targets; player home/away and head-to-head histories should be small, heavily shrunk residual features tested out of time. Distinguish sustainable form changes (shots, deployment, chance quality) from scoring luck. No numerical weights above are recommendations or evidence of validation.


---

# Matchup and form adjustments: focused evidence and proposed tests

Research date: 2026-10-20 UTC. Read-only public research. No repository inspection or implementation claim; no fits, production changes, provider/paid calls, or dependency changes. The priority ordering and model design below are recommendations, not measured incremental gains for FHFH.

## Bottom line

The useful sophistication is to explain *which part of the forecast changed*, not to stack favorable-matchup multipliers. Prioritize (1) current opponent opportunity/rate context plus goalie conversion, (2) jointly estimated home/rest context, (3) recent underlying role/rate change, and (4) heavily shrunk player-versus-team residuals only if they improve a locked chronological comparison.

### 1. Opponent and goalie: separate volume, chance quality, and finishing

- Opponent defense: estimate expected attempts/on-target shots and chance mix by strength, conditioned on both teams' current attack/defense. An opponent allowing many low-danger shots is different from one allowing fewer high-danger chances. Avoid using raw GA/game as a defense-only rating because it includes goaltending and opponent schedule.
- Goalie: primarily modify shot-to-goal conversion conditional on chance quality, not every fantasy category or SOG automatically. Jointly estimate/shrink shooter finishing and goalie shot-stopping; do not divide offensive projection by raw recent SV% or add cumulative GSAx as a per-shot multiplier.
- Assists/PPP: propagate the resulting team/line/PP goal environment through participation and PP exposure. Do not independently boost goals, assists, and PPP for the same weak goalie, then boost fantasy points again.
- Do not assume the starter. Before confirmation, use candidate-starter probabilities and conditional forecasts; update when a starter is actually known.

Evidence: Noel's Nov 10, 2025 preprint reports 2021–22 held-out shot-outcome improvements from combined shooter/goalie skill features. This supports a candidate *conversion* model, not a universal percentage boost or demonstrated next-game G/A/PPP accuracy. It covers 5v5 on-target shots only. Macdonald et al. (2012) explicitly separate shot quantity/quality/finishing, but their historical split-half comparisons do not establish that weighted shots universally outperform simpler volume measures. Hence test both shot volume and quality; do not assume xG supersedes SOG.

### 2. Home/away and own/opponent back-to-back: one joint context model

- Use own and opponent rest information, at minimum the four states neither/own-only/opponent-only/both played yesterday. Include venue jointly and allow a regularized interaction only if supported. A both-B2B game is not the same as a relative rest advantage.
- Plausible targets: team event rates/opportunities and possibly player deployment. A player-minute effect and a per-minute effect are separate hypotheses; a back-to-back need not reduce every player's minutes or every category.
- Condition on starter choice and current roster/usage. Otherwise a B2B feature may partly capture backup-goalie selection already represented elsewhere. Home and opponent-strength adjustments overlap too.
- Call this a schedule association unless a causal identification design supports fatigue. Do not turn a team win association into a fixed individual-scoring boost.
- Venue has an additional observation channel for HIT/BLK. Estimate neutral player skill from appropriately venue-adjusted history, then forecast recorded fantasy events at the destination venue once. Do not both retain raw home-inflated skill and reapply the same rink multiplier. Refit current rink effects with shrinkage/time variation; do not import 2007–13 coefficients.

Evidence: a 2017 Post/Stefanski/Osborne conference poster fits NHL team/season and both teams' played-yesterday indicators, illustrating home/rest confounding at team outcome level. It is not modern player-game validation or causal fatigue evidence. Schuckers/Macdonald (2014) find historical rink/event recording differences after team/score/home adjustment. Their BLOCK is defined from the shooting team's blocked attempt: implementation must map to the defending credited blocker before using it for fantasy BLK.

### 3. Hot/cold: distinguish changed process from realized luck

- Update recent EV/PP minutes, attempt/SOG rates and chance quality separately. A promotion or sustained increase in shot generation is different from a five-goal finishing streak with unchanged opportunities.
- Estimate recent change relative to the player's established, context-adjusted baseline using paired count/exposure support and shrinkage. Tune decay/window strength on training/validation only. A recent-rate update is not a second independent hot-streak bonus.
- For goals/assists or goalie save outcomes unexplained by underlying opportunities, require incremental out-of-sample evidence before adding a streak state. A drought alone does not make a player "due," and a goalie cold streak does not establish a rebound bonus.

Evidence: Ding et al., first online March 31, 2025, analyze 48,431 shots faced by 93 NHL playoff goalies in 2008–16, controlling for shot/game characteristics. They find no hot-hand support and some negative next-shot association. This is retrospective playoff shot-level analysis, not a walk-forward next-game fantasy forecast or skater-streak result. Its negative coefficient is not a deployable generic cold-goalie bonus. The author preprint's centered current-playoff group means also need replacement by strictly pregame available estimates for serving.

### 4. Player history against a specific opponent: residual experiment, last priority

No opened source establishes incremental next-game fantasy predictive value for raw player-versus-team splits. A recommended experimental feature is a strongly pooled player×opponent interaction *after* predicting ordinary opponent defense, starter, venue/rest, role/teammates and player talent. Use past-only residuals and effective exposure, not raw career points per game. Repeated meetings can be old, few, roster/coach dependent, schedule selective, and share the same teammates/goalies. Decay stale evidence; let sparse interactions shrink almost to zero. Retain only if they improve future forecasts over those already-known effects. An attractive descriptive split is not that validation.

## Category-specific routing

- SOG: EV/PP exposure × player shot-generation rate × conditional opponent opportunity adjustment. Goalie skill is not a blanket SOG modifier.
- G: on-target shot distribution × chance-quality mix × shrunk shooter/goalie conversion. Keep goals within SOG in joint simulations.
- A/PPP: shared team/line scoring events, role/participation and PP opportunities. Preserve PPP as a subset of G+A, rather than independent bonuses.
- HIT: role/minutes, opponent context and venue observation process; not generic weak-goalie offense boost.
- BLK: defensive minutes/role, opponent attempts and share reaching/blockable locations plus venue/credited-blocker mapping. A favorable offensive matchup need not increase blocks.
- Goalies: start/playing-time probability first; expected shots faced from opponent offense and own defense; GA from the joint shot-quality/conversion process; derive saves consistently as eligible SA minus GA. Derive SV%, win and shutout probabilities from that same game distribution and league scoring rules, not disconnected ratings. A higher-SA matchup can offer more saves while also increasing GA risk.

## Minimal falsifiable experiment

1. Freeze a pregame information cutoff and baseline. Reconstruct all historical rolling/opponent/starter/lineup inputs as known then; no final-season ratings or eventual confirmed starters at an earlier forecast timestamp. Keep protected test dates untouched.
2. Fit each family separately, then the combined model with regularization. Compare baseline, each add-on, combined, and combined-minus-each-family ablations. Conditional gain is the question; not the sum of standalone gains.
3. Partition opportunity/minutes, per-exposure generation, and conversion. Trace changes before and after any existing team reconciliation/bootstrap. A boost that disappears under a fixed team budget did not create additional team offense; it may only redistribute player shares.
4. Use rolling chronological validation across seasons/teams; score all eligible forecasts, including observed zeros. Choose windows/shrinkage/interactions without looking at the held-out test. Report paired uncertainty clustered by game/date, not falsely independent player rows.
5. Evaluate distributions as well as means: count log score or suitable deviance, MAE as a secondary operational metric, zero/tail calibration; Brier/log loss and reliability for scoring/start/win/shutout probabilities. Inspect by strength, role, starter-certainty and rest state. Do not promote a feature for significance or in-sample fit alone.
6. Require coherent totals and category relationships. Attribute explanations to conditional model counterfactuals or one defined ordering, not independent percentages that imply causal/additive credit. Until this succeeds, expose matchup/form context as context rather than claim a verified accuracy increase.

## Opened primary sources and precise limits

1. J. T. P. Noel. *Expected by Whom? A Shooter and Goaltender Skill-adjusted Expected Goals Model for the NHL*. Preprint, Nov 10, 2025. https://arxiv.org/html/2511.07703v1
   - Opened §§3.1, 3.3–3.5, 4–5 (HTML lines 78–83, 119–188, 193–211). Reports prior-game skill histories and 2012–20 training/2021–22 holdouts; joint shooter/goalie model improves reported shot metrics. Baseline xG remains dominant. Only 5v5, on-net, offensive-zone shots with required coordinates/type; preprint, not independently reproduced. Skill bracket construction/timing deserves audit before borrowing architecture. Reported 1–5% metric gains are not fantasy-projection multipliers.
2. Brian Macdonald, Craig Lennon, Rodney Sturdivant. *Evaluating NHL Goalies, Skaters, and Teams Using Weighted Shots*. May 8, 2012. https://arxiv.org/html/1205.1746v1
   - Opened §§1, 5.1, 5.3–5.4 (lines 50–74, 189–209, 254–282). Historical split-half/odd-even analyses give limited evidence for adjusted SV% improvement and no established superiority of weighted shots over simpler shot rates for player/team prediction. Not chronological pregame fantasy validation; old data/model and rink concerns. Supports separating descriptive explanation from prediction, not rejecting modern xG.
3. Justin B. Post, Len Stefanski, Jason A. Osborne. *Scheduling Effects in the NBA and NHL*. 2017 New England Symposium on Statistics in Sports poster. https://jbpost2.github.io/files/scheduling_effects.pdf
   - Opened one-page poster, especially introduction, schedule table, model and findings (lines 52–74, 103–166). Team outcome regressions include team-season and own/opponent played-yesterday factors. Home/rest overlap is explicit. Mixed NBA/NHL poster, historical and observational; no player/category estimates or contemporary out-of-sample feature gain. Do not borrow its "fatigue" causal wording or assert home advantage disappears universally.
4. Michael Schuckers, Brian Macdonald. *Accounting for Rink Effects in the National Hockey League's Real Time Scoring System*. Dec 2, 2014 preprint. https://arxiv.org/html/1412.1035v1
   - Opened data/model, BLOCK definition, HIT/SHOT results and conclusions (lines 50–57, 98–110, 176–211, 239–257, 443–493). Six seasons, 2007–08 to 2012–13, regulation non-empty-net 5v5; team/score/home/rink terms. Historical event-recording effects, not proof of current coefficients or individual player-game forecast gain. BLOCK label is shooting-side blocked attempts, requiring fantasy-credit mapping.
5. Likang Ding, Ivor Cribben, Armann Ingolfsson, Monica Tran. *Do NHL goalies get hot in the playoffs? A multilevel logistic regression analysis*. Journal of Sports Analytics, first online Mar 31, 2025. https://journals.sagepub.com/doi/10.1177/22150218251314737
   - Opened journal abstract/date and author preprint §§3–5, conclusion. Author copy: https://sites.ualberta.ca/~aingolfs/documents/Hot_hand_17_feb_21.pdf . NHL playoff shot outcomes, 2008–16; no hot-hand evidence across recent-save windows after controls. Not skater/regular-season/next-game proof and not an OOS test of a production streak bonus. Avoid mechanistic claims from its negative association.
