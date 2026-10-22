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
