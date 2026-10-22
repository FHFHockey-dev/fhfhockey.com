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
