# Research brief for an improving NHL game prediction model

## Scope and evidence base

The exact URLs you said were shared in the Sites section were not visible in the tool-accessible context for this session, so this report is built from the accessible materials on your preferred domains first, then supplemented with closely related academic and technical sources that directly address NHL outcome prediction, expected-goals modeling, probability calibration, walk-forward validation, and model monitoring. Where results come from different seasons, different targets, or different evaluation setups, I treat them as informative but not directly apples-to-apples comparable. citeturn24view1turn39view1turn16view1turn15view0turn31view3

The strongest through-line across the usable sources is that the best NHL pregame models are not driven by one magic feature or one exotic algorithm. They work because they combine a few durable signal families: even-strength shot-quality and goal-differential measures, goalie quality and likely starter information, schedule context such as home ice and back-to-backs, and a prior for team or player talent that is then updated as the season unfolds. The models that do well also score themselves with proper probability metrics such as log loss and Brier score, and they evaluate with time-respecting splits instead of random shuffles. citeturn24view1turn39view1turn16view3turn15view0turn32search0turn32search2turn32search8

## Repository schema alignment and corrected direction

After comparing this research with the local Supabase schema docs, the recommended v1 should be even more schema-first than the original brief implied. The project already has enough team, goalie, lineup, and projection infrastructure to avoid a broad new ingestion layer for the first game-prediction build.

Use the existing `games`, `teams`, and `players` tables as the identity backbone. Use `nst_team_gamelogs_as_counts`, `nst_team_gamelogs_as_rates`, `nst_team_gamelogs_pp_counts`, `nst_team_gamelogs_pp_rates`, `nst_team_gamelogs_pk_counts`, `nst_team_gamelogs_pk_rates`, `nst_team_5v5`, `nst_team_all`, `nst_team_pp`, `nst_team_pk`, `wgo_team_stats`, and especially `team_power_ratings_daily` as the primary team-strength feature sources. These tables already expose xG, shot, goal, high-danger, power-play, penalty-kill, pace, and EWMA-style rating signals that map directly to the research recommendations. Do not build a separate team stat warehouse unless the existing tables prove insufficient.

The live source audit adds one important qualification: the NST gamelog tables are the preferred rolling-window inputs, while `nst_team_5v5`, `nst_team_all`, `nst_team_pp`, and `nst_team_pk` should be treated as cumulative/snapshot tables. NST freshness must be recorded explicitly because the audited gamelog tables currently end on 2026-04-11 and snapshot tables on 2026-03-21. Special-teams `xgf_pct` should be recomputed or avoided until its source semantics are confirmed; raw xG/count/rate fields are safer for v1.

The row-level quality pass found no required-field issues in recent schedule rows and no duplicate natural-key groups in representative planned sources. The remaining row-level concerns are operational rather than schema-blocking: recent WGO/goalie outliers need clipping or review, NST gamelog rows with `gp <> 1` must be excluded or classified before rolling-window use, and a small set of recent game/team sides lacks team-power or standings context inside the audit's 14-day lookback.

The leakage pass reinforces the same conservative training posture. `nhl_team_data` is available in the database but should remain excluded from historical training because it is a latest-only display view. Team-strength rows should be selected strictly before game date unless a source-specific pregame timestamp proves same-day data was available before puck drop. Current goalie-start, lineup, and FORGE projection tables are valuable for live/current predictions, but many audited rows were created or observed after scheduled start time or only have date-level `as_of_date`; they should not be used for backtests without pregame snapshot provenance.

The audit also shows that recent `wgo_team_stats` rows are team-game rows (`games_played = 1`) rather than season-to-date snapshots. That makes WGO useful for single-game team context and rolling features when `game_id`/`opponent_id` are populated, with fallback handling for the audited null-ID rows.

Standings record and split math passed the live audit, but naming is imperfect: `goals_for_pctg` and `goal_differential_pctg` should be treated as rate-like fields and normalized from observed distributions, not assumed to be 0-1 probabilities.

For goalies, use `goalie_start_projections` as the first source for starter probability and confirmation state, with `wgo_goalie_stats`, guarded current-prior/fallback use of `wgo_goalie_stats_totals`, `vw_goalie_stats_unified`, and the NST goalie all/5v5/EV/PP/PK count and rate tables as quality inputs. This is better aligned with the product than treating starting goalie handling as an open problem. The model should blend across likely starters when `confirmed_status` is false, weighted by `start_probability`, and collapse to the confirmed starter when reliable confirmation exists.

Goalie-source audit results reinforce the starter-probability approach but add guardrails. Current `goalie_start_projections` covers both team sides for every audited game, but some game/team probability sums and projected GSAA values need normalization or review. Recent `wgo_goalie_stats` rows are goalie-game rows, while `wgo_goalie_stats_totals` lacks a stat-date key and should not be used for historical training without snapshot rules. NST goalie sources are broad but stale as of 2026-04-09 and contain low-TOI rate outliers, especially on PK, so v1 should use freshness flags and robust clipping.

For lineup and player context, keep the original "optional, non-blocking" recommendation, but change the data source assumption. The repo already has `lineCombinations`, `lines_nhl`, `lines_dfo`, `lines_gdl`, `lines_ccc`, `forge_roster_events`, `forge_player_projections`, `forge_goalie_projections`, and `forge_team_projections`. These should be used as optional context and explanation features before building any new player-simulation layer. The live audit confirms this direction: `lineCombinations` is mostly populated but not complete, the line-source tables are sparse/current, FORGE projection tables require freshness gates, and `forge_roster_events` is empty. These sources should not be hard dependencies for historical model training unless coverage improves and is measured again.

For prediction storage, prefer extending or wrapping the existing analytics contract in `game_prediction_outputs` rather than inventing a parallel first table by default. Its `components`, `provenance`, and `metadata` JSONB fields are suitable for factor explanations, source freshness, feature-set versions, and model confidence. However, its current primary key is based on `snapshot_date`, `game_id`, `model_name`, `model_version`, and `prediction_scope`, so it does not by itself preserve multiple intraday pregame predictions for the same model/game. If multiple same-day updates are required, add an append-only prediction history table or extend the contract with a generated prediction ID / `computed_at` uniqueness strategy before relying on it for honest evaluation.

The storage audit narrows this further. The existing prediction output tables are empty and payload-complete, which is good for first public serving rows, but they do not include a prediction ID, `computed_at` in the primary key, `feature_snapshot_id`, or `run_id`. `forge_runs` is useful as shared run metadata, but not enough by itself for game-model evaluation slices unless metrics are written with explicit model/version/feature-set/date-segment keys. `source_provenance_snapshots` should be reused where practical, but current null/expired freshness rows mean the prediction pipeline must write its own source cutoffs and fallback flags into prediction history or feature snapshots.

One important leakage correction follows from the schema: avoid using "latest-only" views such as `nhl_team_data` for historical training rows. They can be useful for current UI display, but historical features must be recreated from dated tables with `date < game.startTime::date` or a stricter prediction timestamp cutoff. Similarly, season-to-date tables and rolling views must be joined as-of the prediction time, not as-of the current database state.

Yahoo tables should not be part of the core game model. `yahoo_players`, `yahoo_nhl_player_map_mat`, ownership history, and related fantasy metadata can help with player identity, display, or future fantasy-oriented surfaces, but they are not primary inputs for NHL team win probability unless a later validation pass proves incremental lift.

## Source-by-source analysis

**entity["organization","American Statistical Association","stats society us"] / entity["people","Sam Buttrey","statistics researcher"].** The JSM paper “Predicting the Winners of Hockey Games” is a process model, not a feature-heavy machine-learning model. It separately models goals and penalties as rare events, uses exponentially decayed historical weighting, and then converts those rates into win probabilities through both an analytic Markov model and a richer Monte Carlo simulation. The important lesson is methodological: a hockey prediction model can improve by explicitly modeling how goals arise at different manpower states and by weighting recent evidence more heavily. The caution is just as important: the Monte Carlo version beat the simpler Markov version, but the author explicitly warns that the apparent betting edge may still contain overfitting, and the same scheme lost money in earlier seasons. That makes this source valuable for architecture ideas, but not a good argument for a pure generative pregame model as your first production build. citeturn10view0turn10view2turn10view4turn9view1

**entity["organization","University of Ottawa","ottawa university canada"] / entity["people","Joshua Weissbock","uottawa researcher"].** The 2013 workshop paper is historically important because it is one of the earliest explicit NHL game-winner ML papers. It mixed traditional stats and advanced metrics, found a tuned neural network to be the best classifier at 59.38% accuracy, and reported that location, goals against, and goal differential ranked as the most important features for single-game prediction, while PDO did not help. The paper is also surprisingly honest about a distinction many hockey modelers still miss: advanced metrics can be more useful for long-run forecasting than for the very next game. The main limitation is the dataset itself: it was built on a lockout-shortened 2012-13 season and only 517 games, so I would treat it as foundational rather than operationally decisive. citeturn30view0turn31view3turn31view2turn31view1

**entity["people","Gianni Pischedda","sports modeling author"].** Pischedda’s 2014 follow-up is useful less for the specific model and more for the criticism it makes of hockey feature folklore. Using the Ottawa dataset, it argues that simple contextual variables like Team and Location drove much of the predictive power while many complex derived metrics added less than people assumed, and it proposed a day-by-day dynamic model-building framework for practical prediction. I would not elevate its exact results into “truth,” because it relies partly on proprietary tooling and an inherited dataset, but its directional insight matters: context variables and sequential updating can matter as much as increasingly elaborate hockey-specific aggregates. citeturn27view0turn28view0turn28view1

**entity["people","Lars Skytte","hockey analytics writer"] on Hockey-Statistics variable testing.** Lars Skytte’s series is one of the most practically useful source clusters because it isolates variables, uses log loss, and keeps asking whether added complexity actually improves next-game prediction. In Part I, the strongest single predictors were offensive on-ice measures and individual forward scoring-type metrics: forward individual goals, forward and defender goals-for, and xGF variants all beat Corsi, penalty variables, and goalie GSAx in his setup. In Part IB, he then explains why that can coexist with older research favoring xG or Corsi: for one-game-ahead forecasting, goals and xG can beat possession; for longer-horizon future scoring, xG and Corsi regain the edge. That is exactly the distinction you need for a website model whose target is the next game, not end-of-season points. citeturn8view0turn12search0

**Skytte on combining signals and making the model learn.** His in-season model combines EV xG+/-, EV G+/-, PP and SH goal-based components, GSAx, and individual points-above-average, producing a player-based model that approaches market-level log loss once it has enough games to learn. He then improves it materially by adding a pre-season prior based on prior-year player value and decaying that prior as the season progresses; the best historical blend used a 1% per-game decay and slightly beat the closing market on log loss. Two unusually useful conclusions come out of this series. First, an in-season-only learner starts too cold and needs preseason priors. Second, pure goalie prior by itself is weak from year to year. Those are both directly relevant to your goal of a model that improves over time without becoming too expensive. citeturn11view1turn11view4turn15view0

**Skytte on xG model design.** His 2025 xG 2.0 article adds a newer layer: running three-year models tested on the following season instead of a single random train/test split. It reports that XGBoost outperformed logistic regression, random forest was weak in his implementation, BoxID shot location plus handedness was by far the dominant feature, and removing the rebound variable improved predictiveness for future results even if rebound information can help describe current shot danger. For you, the key takeaway is not “must use XGBoost,” but rather that shot-location model design, temporal testing, and feature pruning matter more than piling on more event annotations. citeturn38view0turn38view2

**entity["people","Darryl Blackport","hockey analytics writer"].** Blackport’s post is one of the cleanest pregame-model writeups because it explicitly refuses random train/test splits and instead holds out whole seasons. His final ensemble used logistic regression, CatBoost, and naive Bayes, while random forest and AdaBoost failed to improve the ensemble out of sample. The feature set that survived his validation process is a strong practical template: adjusted xG, adjusted Fenwick/Corsi, goal-plus-minus windows, player talent summaries such as WAR and Game Score, starting-goalie quality, special-teams matchup terms, and rest advantage. His biggest reported weakness was early season performance, which again reinforces the need for a preseason prior and shrinkage toward the mean when current-season samples are still thin. citeturn39view1turn39view2turn39view3turn39view4

**entity["people","Gary Schwaeber","data scientist"] on entity["company","Medium","publishing platform"] and entity["company","GitHub","software hosting platform"].** Schwaeber’s project is a strong “ship-it” reference because it starts from a manageable team-plus-goalie feature stack rather than requiring a full player simulation engine. He uses rolling team features from Natural Stat Trick, goalie logs, Elo, and schedule data, then tests multiple feature-window strategies and several classifiers. His best model was a neural network based on 40-game team features, and the published repo reports a 2021 season log loss of 0.655534 with a backtested ROI above 2%. I would not treat the ROI as your target metric for primary model selection, but his work is very persuasive evidence that a relatively lean, top-down architecture can be good enough to publish and iterate before you build an expensive bottom-up player pipeline. citeturn6search0turn16view0turn16view1turn16view2turn16view3turn16view4

**entity["people","Christian Lee","hockey stats writer"].** The random-forest Medium article is best read as a cautionary source. It reports roughly 70% accuracy and names Net.PP, Net.PK, blocks, and offensive-versus-defensive-zone faceoff differential among the most important features. But the article also openly acknowledges that statistics like same-game even-strength save percentage can contain goal information from the game itself and therefore inflate apparent predictive accuracy. The author says future work should use prior information only. That makes this source extremely useful for identifying leak-prone features and for understanding why impressive raw accuracies can be misleading in pregame sports models. citeturn19view4turn19view2

**entity["people","JNoel71","github author"].** This repo is a good example of a more industrial feature-engineering approach: three separate season-stage models, multiple rolling windows, optional cross-season crossover, more than 600 engineered features, mutual-information feature selection, and an ExtraTrees classifier. Its held-out 2021 test performance is impressive on paper, with log loss 0.6526, accuracy 0.6320, and AUC 0.6224. The strengths are stage-aware modeling and representing features as home-minus-away differences. The downside is operational: this is harder to maintain, more expensive to recompute, and more brittle for a website project than the leaner team-plus-goalie models above. citeturn17view0

**entity["organization","MoneyPuck","nhl analytics site"].** MoneyPuck is the most useful current public benchmark because it is both transparent enough to study and recent enough to matter. Its current pregame model, rebuilt in 2025, splits team strength into three components: ability to win, scoring chances, and goaltending. The published weights are 17% ability to win, 54% scoring chances, and 29% goaltending, with home/rest added for game-level predictions. It also uses shooting-talent-adjusted xG and a separate starting-goalie model that blends rest, recent usage, performance, age, roster depth, and game importance. Over the 2022-23 through 2024-25 regular seasons, the published pregame log loss sits in the 0.656 to 0.661 range. This is the strongest source in your stack for the proposition that a website-ready model should explicitly combine xG, goalie state, and schedule context rather than rely on any single stat family. citeturn24view1turn24view3turn24view4

**entity["organization","DRatings","sports ratings site"].** DRatings is more useful as a benchmark product than as a modeling blueprint. Its methodology page says the ratings backbone is logistic regression, specifically the Bradley-Terry model, with sport-specific adjustments layered on top, and its NHL pages prominently display log loss against sportsbook baselines. That transparency about output metrics is good. The actual NHL feature-level ingredients, however, are not disclosed in enough detail to guide your build. I would borrow its public-facing reporting style, not its hidden internals. citeturn23view0turn20search0turn20search3

**entity["company","8rain Station","sports analytics platform"].** The 8rain Station piece is not a rigorous methodology paper, but it is very useful for deciding what the website should do around the model. It argues that the model should be independent of market prices, should output a probability distribution rather than a pick, and should be judged with Brier score, log loss, and calibration. It also presents a hybrid workflow that blends model opinion, market consensus, and historical-stat weighting. I would not use it as evidence for which hockey stats are truly best, but I would use it as evidence for how to expose the model to users and how to track probability quality in production. citeturn25view0

**entity["organization","The University of North Carolina Press","university press nc"] / Markov-chains paper.** The 2023 Maths and Sports paper on continuous-time Markov processes predicts in-game win probability from shot and goal differential state. This is not a pregame build spec, but it is a useful reminder that if your site later expands into live win probability, a simpler state-based live model can coexist with a pregame model. I would place it in a future phase, not in v1. citeturn40view0turn40view1turn40view2

## Overlapping methods, differing methods, strong methods, and sub-optimal methods

The overlaps are clear. Across the best sources, the recurring useful ingredients are even-strength xG or shot-quality differential, actual goal differential or goal-rate context, goalie quality and likely starter, home/rest/schedule effects, and a prior for talent that gets updated in season. The overlaps in evaluation are equally important: use probabilities, optimize or at least monitor log loss, and validate with time-aware holdouts or walk-forward testing. citeturn24view1turn39view1turn16view3turn15view0turn32search0turn32search2

The biggest disagreements are about horizon and granularity. Older long-horizon work and xG literature argue that xG and Corsi are better than goals for predicting future scoring over many games, while Skytte’s one-game-ahead tests find that actual goals can be as good or better than xG in a micro-prediction setting. Likewise, some sources push player-based lineup models, but Skytte’s own follow-up found that using player-level on-ice stats did not clearly outperform team-based versions when the model was otherwise built on on-ice metrics. The practical inference is that a next-game website model should absolutely include xG, but it should not be embarrassed to use rolling goal differential too, and it should begin team-plus-goalie first unless player-level incremental lift is proven. citeturn12search0turn36search0turn11view4

The most successful methods, in context, are the ones that combine a strength prior with in-season updating and keep the feature stack focused. MoneyPuck’s three-component model, Blackport’s season-held-out ensemble, Skytte’s preseason-plus-in-season blend, Schwaeber’s 40-game neural-net team model, and JNoel71’s stage-aware ExtraTrees all fit that pattern even though the algorithms differ. Their common success factor is the feature family design and evaluation discipline, not one universally best classifier. citeturn24view1turn39view1turn15view0turn16view3turn17view0

The methods that look sub-optimal or by now clearly risky are also consistent across sources. Random shuffles for train/test are inappropriate for time-ordered sports data. Same-game or postgame box-score features leak the answer and can create fake accuracy. Penalty taken/drawn variables appear to have little standalone predictive value. PDO and “luck” are weak as direct next-game predictors. Goalie prior by itself is weak year to year. And models that start the season with no prior information learn too slowly to be competitive in October and early November. citeturn32search0turn19view4turn8view0turn31view1turn15view0

## Which statistics appear most important

If your objective is **pregame win probability for the next NHL game**, the evidence suggests the following ranking.

First, build around **even-strength shot-quality differential**, especially xGF%, xG+/-, or a related adjusted expected-goal differential. This is the most consistently strong family in public models, and current public benchmark models give their heaviest share of influence to scoring-chance information. If you need a single headline family to anchor the model, this is it. citeturn24view1turn8view0turn39view2

Second, keep **rolling actual goal differential and goal rates** in the model rather than discarding them for ideological reasons. Multiple next-game sources find that goals or goal-plus-minus remain highly predictive in micro settings, especially when evaluated over the right rolling windows. The evidence does not support replacing goals with xG; it supports using both. citeturn8view0turn12search0turn39view2

Third, treat **goaltending and likely starter identity** as non-negotiable. MoneyPuck gives goaltending 29% of model influence, Blackport includes starter WAR, starter Game Score, and goals-saved terms, and Schwaeber explicitly makes the goalie the lone exception to a top-down team model because the starter/backup gap matters. The strongest practical form is not generic team save percentage; it is starter-specific recent and multi-season quality, ideally blended with a starting-goalie probability model when confirmation is not yet public. citeturn24view1turn24view3turn39view3turn6search0

Fourth, include **schedule context**: home ice, back-to-back, games played in the last few days, and rest asymmetry. These features show up again and again and are among the cheapest reliable inputs you can compute. They also matter operationally because they update before lineup news is fully settled. citeturn24view1turn8view0turn39view2turn16view0

Fifth, include a **preseason or talent prior**, whether that is last-season team strength, Elo, player-value aggregates, or multi-year player projections shrunk toward league average. Early-season prediction quality degrades sharply without this layer, and the best public writeups that explicitly address learning over the season all converge on this point. citeturn15view0turn16view0turn39view1

Sixth, use **special-teams matchup strength**, but keep it subordinate to even-strength play. Skytte found PP performance somewhat predictive and better than PK, Christian Lee found Net.PP and Net.PK high in his feature-importance plots, and Blackport explicitly includes PP offense versus opponent PK defense terms. But across the broader set, special teams are secondary rather than primary and can easily turn into leakage if defined from same-game stats. citeturn8view0turn19view2turn39view2

Seventh, treat **possession proxies such as Corsi and Fenwick** as useful but not sacred. They matter more over longer horizons and are often weaker than xG for current public benchmark models; in next-game settings they can be helpful context features rather than lead features. citeturn36search0turn12search0turn39view2

The families that look weakest for your use case are **penalties drawn/taken, raw PDO/luck, and overly descriptive same-game box-score stats**. I would also avoid a player-first architecture in v1 unless you already have a cheap, reliable lineup and player-state pipeline, because the public evidence for material lift over a good team-plus-goalie model is mixed. citeturn8view0turn31view1turn19view4turn12search0

## How to implement a model that learns and improves over time

The cleanest architecture is a **two-layer pregame model**. Layer one is a preseason prior that estimates team strength before the season starts, based on last-season and multi-season team and player information, regressed toward average. Layer two is an in-season updater that gradually overrides that prior using rolling current-season data. This is the structure that most directly matches the strongest practical evidence in the source set. citeturn15view0turn24view1

For your first version, I would not build a fully online player-simulation pipeline. I would build a **batch-updated team-plus-goalie model** that refreshes after each game day. Hockey is not high-frequency enough to require streaming updates every few seconds, and your labels only settle once games end. A daily or twice-daily retrain plus a lighter-weight daily calibration layer is simpler, cheaper, and far easier to host. Schwaeber, Blackport, and MoneyPuck all show some version of this logic: strong pregame models can be built from rolling team data, goalie data, and schedule context without requiring real-time player micro-models on day one. citeturn16view3turn39view1turn24view1

Validation should be **walk-forward or expanding-window**, never random. The reason is simple and official: time-series splits avoid training on the future and testing on the past, and successive train sets should only accumulate prior data. That is exactly how Blackport validated his model by leaving out full seasons, and it is also how Skytte’s xG 2.0 construction evaluates on the following season. citeturn32search0turn39view1turn38view0

Probability quality needs its own maintenance loop. Even good classifiers can be overconfident or underconfident, so a separate calibration step is desirable. Official scikit-learn documentation is explicit that predicted probabilities often need postprocessing and that calibration curves should be inspected alongside proper scoring rules. In practice, that means your “learning” system should do two things on a schedule: refit the base model on fresh historical data and recalibrate the output probabilities on a recent holdout slice. citeturn32search7turn32search8turn32search2

If you want the model to improve continuously after deployment, add **drift monitoring** rather than jumping straight to fully online learning. River’s concept-drift tooling is built for monitoring an error stream over time, and Evidently’s drift tooling is built for reference-versus-current data distribution checks. For a sports model, this gives you a practical trigger framework: if feature distributions drift, prediction distributions drift, or recent log loss worsens enough, force a retrain or increase the weight on recent games. That is a safer operational definition of “learning” than retraining blindly after every slate. citeturn33search8turn33search0turn33search2turn33search13

A good compromise between simplicity and performance is to start with this cadence. Rebuild the preseason prior once per offseason. Refit the main pregame model daily or weekly with an expanding historical window and capped rolling features. Update goalie-start probabilities several times per day as news firms up. Recalibrate probabilities daily. Recompute public site predictions whenever goalie confirmation or major lineup news changes enough to move the output materially. This gets you most of the benefit of a “learning” system without the fragility of a full streaming stack. citeturn24view3turn15view0turn39view1

## What metrics are necessary to build and host the model on your website

For **model-quality metrics**, the mandatory set is log loss, Brier score, and calibration curves. Log loss is the most common denominator in the hockey sources and the public benchmark sites; Brier score measures mean squared probability error; calibration curves tell you whether 60% predictions win about 60% of the time. Accuracy and AUC are still useful, but they are secondary because your product is a probability engine, not just a winner picker. citeturn24view3turn25view0turn32search2turn32search8

For **sports-model product metrics**, I would add segment-level slices: early season versus late season, favorites versus underdogs, home versus away, confirmed-starter games versus uncertain-starter games, and games updated after lineup news versus static games. This is how you catch the exact failure modes that show up in public models, especially weak early-season performance and shaky predictions before starter confirmation. If betting utility matters later, add optional tracking for closing-line value and ROI, but do not make those your primary training targets. citeturn39view2turn15view0turn24view3turn25view0

For **ML health metrics**, the necessary set is feature drift, prediction drift, target drift when labels arrive, stale-model age, missing-feature rate, data-freshness lag, and starter-confidence lag. In practice, I would monitor whether the distribution of xG differential, goalie-quality inputs, and rest/travel inputs has shifted away from the training reference; whether the predicted win probabilities have become too concentrated or too flat; and whether recent realized log loss has worsened enough to justify a recalibration or retrain. citeturn33search2turn33search13turn33search8

For **website and API operational metrics**, use the four golden signals: latency, traffic, errors, and saturation. Google’s SRE guidance is explicit that if you can only monitor four things on a user-facing service, those are the four. For your site, translate that into p95 or p99 prediction latency, request volume by endpoint, failure rate by endpoint, and resource saturation on the app and database layers. If you show game pages publicly, also track freshness timestamps so users can see when the prediction last updated. citeturn34search0turn34search8turn34search9

## Open questions and limitations

The main limitation of this report is that I could not directly see the exact URLs you said were already shared, so I reconstructed the research set from the accessible materials on your preferred domains and the most relevant adjacent sources. A second limitation is comparability: public hockey models report on different eras, different data windows, and different targets, so a raw “best log loss wins” ranking would overstate precision. The safest conclusion is pattern-based, not leaderboard-based: the best documented approaches repeatedly combine xG-like chance quality, rolling goal context, goalie information, schedule context, and explicit temporal validation. citeturn24view1turn39view1turn16view1turn15view0

The most important unresolved design choice for your build is not the algorithm. It is whether you want v1 to be a lean pregame win-probability model or a broader ecosystem that also predicts player and goalie performance and then rolls those estimates upward. The source base supports starting lean. The player-first path can be more expressive, but it is more expensive and public evidence does not yet show that it is clearly better than a well-built team-plus-goalie model for next-game prediction. citeturn6search0turn12search0turn17view0

## Handoff prompt for Codex 5.5

Use the following prompt with Codex 5.5:

> Build an NHL pregame win-probability model for a website. The goal is not just to predict winners, but to output calibrated probabilities that improve over time with ongoing data updates.
>
> Requirements:
>
> Create a production-oriented design, not a notebook demo. No betting-odds inputs should be required for the core model. The model should be independent of the market and should estimate true win probability from hockey data.
>
> The architecture should use a two-layer approach:
>
> 1. A preseason prior that initializes team strength before the season starts using prior-season and multi-season information, shrunk toward league average.
> 2. An in-season updater that gradually overrides the preseason prior using current-season rolling data.
>
> The initial v1 should be a team-plus-goalie model, not a full player-simulation pipeline. Player-level features can be added later if they demonstrate real lift. If lineup data is available cheaply, allow optional lineup-strength aggregates, but do not make the first version depend on expensive player-level prediction generation.
>
> Repository-specific schema direction:
>
> - Reuse `games`, `teams`, `players`, and `seasons` for identity and schedule.
> - Use `team_power_ratings_daily`, `nst_team_gamelogs_as_counts`, `nst_team_gamelogs_as_rates`, `nst_team_gamelogs_pp_counts`, `nst_team_gamelogs_pp_rates`, `nst_team_gamelogs_pk_counts`, `nst_team_gamelogs_pk_rates`, `nst_team_5v5`, `nst_team_all`, `nst_team_pp`, `nst_team_pk`, `wgo_team_stats`, and `nhl_standings_details` for team features.
> - Use `goalie_start_projections`, `wgo_goalie_stats`, guarded `wgo_goalie_stats_totals`, `vw_goalie_stats_unified`, and NST goalie all/5v5/EV/PP/PK count and rate tables for starter and goalie-quality features.
> - Use `lineCombinations`, `lines_nhl`, `lines_dfo`, `lines_gdl`, `lines_ccc`, `forge_roster_events`, and FORGE projection tables only as optional v1 context unless historical coverage is verified.
> - Prefer `game_prediction_outputs` as the current public output contract, but add append-only prediction history or extend the key before supporting multiple same-day pregame updates.
> - Do not use latest-only display views such as `nhl_team_data` for historical model training.
>
> Prioritize these feature families:
>
> - Even-strength shot-quality differential: xGF%, xGA%, xG+/-, adjusted expected-goal differential
> - Rolling actual goal differential / goal rate
> - Goalie quality and likely starter identity
> - Home ice, rest asymmetry, back-to-back status, games in last 3 days
> - Preseason/talent prior: team Elo, multi-year team strength, or player-value aggregates
> - Special-teams matchup terms as secondary features
> - Possession features such as Corsi/Fenwick as supporting context, not the sole backbone
>
> Treat these as weak or risky:
>
> - Raw PDO/luck as a primary predictor
> - Penalties drawn/taken as major standalone features
> - Same-game or postgame stats that leak the outcome
> - Random train/test splits for time-ordered data
>
> Modeling guidance:
>
> - Use walk-forward or expanding-window validation only
> - Compare several probabilistic classifiers, including a strong interpretable baseline and at least one tree-based model
> - Consider an ensemble only if it improves out-of-sample log loss
> - Add a separate probability-calibration step
> - Allow different rolling windows, but keep the system simple enough for daily production refreshes
>
> Operational learning guidance:
>
> - Refit the core model on a scheduled cadence (daily or weekly)
> - Recalibrate probabilities on a recent holdout cadence
> - Add drift monitoring for feature drift, prediction drift, and recent error drift
> - Trigger retraining or reweight recent data when drift or recent log loss degradation is detected
>
> Goalie handling:
>
> - If a starter is confirmed, use confirmed starter features
> - If a starter is unconfirmed, estimate starter probabilities and blend win probabilities across likely starters
>
> Output requirements:
>
> - Pregame home win probability
> - Pregame away win probability
> - Model confidence metadata
> - Last-updated timestamp
> - Optional explanation surface showing the largest contributors: scoring chances, goaltending, rest/home, prior strength
>
> Evaluation requirements:
>
> - Primary metrics: log loss, Brier score, calibration curve / reliability analysis
> - Secondary metrics: accuracy, AUC
> - Segment analysis: early season vs late season, favorite vs underdog, home vs away, confirmed vs unconfirmed goalie
> - Optional business metrics: CLV and ROI, but do not optimize the model directly on ROI
>
> Website / API requirements:
>
> - Expose predictions through a stable API
> - Track latency, traffic, errors, and saturation
> - Track model freshness, missing-feature rate, stale-model age, and drift status
> - Cache predictions where appropriate, but force refresh when starter confirmation or major lineup news changes the output materially
>
> Build this in a way that supports a phased roadmap:
>
> Phase 1: team-plus-goalie pregame model
> Phase 2: lineup-strength enhancements
> Phase 3: optional player and goalie prop ecosystem if justified by incremental lift
>
> Please return:
>
> - A recommended system design
> - A data schema
> - A feature-generation plan
> - A validation plan
> - A calibration and monitoring plan
> - A deployment plan for a website/API context
> - A phased implementation roadmap
> - A short list of risk factors and caveats for NHL prediction models

The prompt above encodes the highest-confidence guidance from the source set: next-game models should center on xG-like scoring-chance strength, rolling goal context, goalie state, and schedule effects; they should use preseason priors plus in-season updating; they should validate with time-respecting methods; and they should be monitored as probability systems, not just winner-picking engines. citeturn24view1turn15view0turn39view1turn16view3turn32search0turn32search8turn34search0
