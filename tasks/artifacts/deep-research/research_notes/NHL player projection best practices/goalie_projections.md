# NHL Goalie Single-Game Projections: Start Probability, Saves, Goals Against, Wins, Shutouts

Research date: 2026-10-22. Source quality varies: some findings come from search excerpts of pages that could not be fetched directly. Those are marked "(search excerpt)". Everything under "Inferences" is derived arithmetic or reasoning, not a sourced claim.

## Start probability: how starters are predicted, how accurate early calls are, and how to hedge

### Takeaway
Public sources use tiered labels (Confirmed / Expected-Likely / Probable/Unconfirmed) and model-based start probabilities (MoneyPuck). Workload is spread more widely than it used to be: the top goalie's share of team starts fell from about 69% (2012) to about 58% (2023), and split starts on back-to-backs are now the norm. No public accuracy figure for early-day starter calls was found, so a projection should carry an explicit P(start) and blend scenarios rather than assume the predicted starter plays.

### Cited Findings
- Daily Faceoff label definitions (2010 legend): "Confirmed" means the starter was verified by the team or a beat writer. "Probable" is the site's best guess from recent games when no reliable source has confirmed anyone. "Expected/Likely" means a source expects the goalie to start, usually before the morning skate. Some sources were trusted enough to confirm a day ahead. — [Daily Faceoff, 2010](https://www.dailyfaceoff.com/news/starting-goalies-sunday-march-21-2010)
- A 2014 Daily Faceoff DFS rankings post warned that "Likely" starters are not official and that these labels often change near game time. — [Daily Faceoff, 2014](https://www.dailyfaceoff.com/daily-fantasy-hockey-goalie-rankings-november-25th)
- MoneyPuck runs a separate model that gives each goalie a probability of starting. It shows the most likely starter until the media confirms one, then switches to the confirmed goalie with a source link. The starting-goalie model uses GSAx over the past two years. In the team-strength model, each goalie's share of the goaltending rating is proportional to his share of games played, and pull frequency is also a factor. — [MoneyPuck About](https://moneypuck.com/about.htm)
- MoneyPuck (2026-27 documentation): a team that played the day before when its opponent did not has its win chances lowered by about 4%. The page does not say whether this is absolute or relative. — [MoneyPuck About](https://moneypuck.com/about.htm)
- The starter's share of team games (starter = the goalie with the most games for the team that season) fell steadily: 2012 .693, 2015 .669, 2017 .666, 2018 .650, 2019 .620, 2020 .596, 2021 .581, 2022 .590, 2023 .582. In 2023 the average starter started 47.7 of 82 games. — [Robnett & Welsh, CMU SURE 2023](https://www.stat.cmu.edu/cmsac/sure/2023/showcase/hockey_saves/report.html)
- On back-to-backs, Seattle coach Dave Hakstol said teams "typically split starts". The article reports a "precipitous drop" in the same goalie playing both games since Tulsky's 2013 study, but gives no figures. Which goalie starts which half of the back-to-back can depend on the opponent and on rest. Decades earlier, primary starters played up to about 70% of games. — [NHL.com/Kraken, Lukan, Jan 2022](https://nhl.com/kraken/news/core-concepts-examining-goalie-workload-329507592)
- In a dataset of about 40,000 games (1987–2014), pairs of consecutive goalie games one day apart (back-to-backs) made up 9.5% of pairs, two days apart 35.6%, and three days apart 19.2%. — [Hockey Graphs, Dec 2014](https://hockey-graphs.com/2014/12/01/goaltender-performance-vs-rest/)
- DFS projection vendors say they update goalie projections as confirmations arrive. For example, Stokastic says its projections "update as goalie confirmations and line combinations are announced". This is vendor marketing and unverified. — [Stokastic NHL](https://www.stokastic.com/nhl)
- Concrete examples of backups started on the second half of a back-to-back: Montreal's Dobes started at Colorado after Montembeault played the night before (2024-25), and Dallas's DeSmith posted a 33-save shutout on the second night of a back-to-back. — [The Hockey Writers](https://thehockeywriters.com/canadiens-2025-26-player-previews-jakub-dobes/); [NHL.com Stars profile](https://nhl.com/news/2025-26-dallas-stars-player-profile-casey-desmith-082125)

### Inferences
- Hedged projection: E[FP] = P(start) × E[FP | start] + P(relief appearance) × E[FP | relief]. With league-wide starter shares near 58–60%, the prior for an unconfirmed #1 on a non-back-to-back night should sit well below 100%, and on the second half of a back-to-back it should be heavily tilted toward the backup.
- Useful start-probability features, drawn from the sources above: whether the game is the second half of a back-to-back and who played game one; the goalie's season share of starts (the MoneyPuck-style games-played share); recent start sequence (the rotation pattern); days of rest; opponent strength (coaches may save the starter for the tougher half); recent GSAx (MoneyPuck uses a two-year window); and injury or recall news. The label tier from a feed like Daily Faceoff should act as a strong override: Confirmed ≈ 1.0, Expected/Likely high but below 1, Unconfirmed falls back to the model prior.
- Because the vendors publish no label accuracy, a model should calibrate its own label-to-probability mapping from history: log each label with its timestamp, compare against actual starters, and fit P(start | label tier, hours to puck drop).

### Gaps
- No published hit rate was found for Daily Faceoff "Likely/Expected" labels, morning-of predictions, or MoneyPuck's start-probability model.
- No current (2024–26) league-wide statistic was found for how often a team's #1 starts the second half of a back-to-back. The Kraken article gives only a direction ("precipitous drop").
- No public source quantified how injury news or "goalie leaves practice first" signals affect start probability.

## Saves and goals against: shots-against projection, save % regression, shot quality, back-to-back effects

### Takeaway
Saves and GA should be built as projected shots against × a heavily regressed save %. Season-level save % is mostly noise: year-over-year r is about 0.12–0.30, and roughly 3,000 shots are needed before half of the observed signal is talent. Adjusting for shot quality (xG/GSAx) helps only a little in public tests. Back-to-back fatigue effects are real but modest, about 0.005–0.011 of save % in better-controlled estimates, with larger raw gaps confounded by road games and backup quality. League save % has also drifted down (.915 → .904), so the regression target must be season-current.

### Cited Findings
**Save % reliability and stabilization**
- A goalie's save % begins to stabilize after about 3,000 shots faced, the point at which half of observed performance reflects talent. The busiest goalies face about 2,000 shots a season, so it takes roughly 1.5 seasons of data even for workhorses. Playoff samples (≤800 shots) are far too small. — [Neil Paine (FiveThirtyEight, Apr 2014)](https://neilpaine.substack.com/p/a-hot-goalie-isnt-a-better-goalie)
- The year-to-year correlation of GA%- (an adjusted goals-against rate) is 0.296 for goalies qualifying in consecutive seasons (26+ games). Only about 30% of a goalie's season-level gap from league average is attributable to the goalie. An above-average goalie has a 59.2% chance of being above average the next year, versus 47.2% for a below-average goalie. Replacement level is about .006 below league average save %. — [Paine](https://neilpaine.substack.com/p/a-hot-goalie-isnt-a-better-goalie)
- JFresh (Aug 2020): year-over-year r = 0.12 for save % above expected, using Cole Anderson's shot-quality model (described as the most repeatable public above-expected model at the time). Raw goals saved above average per 60 was also r = 0.12. Regular season to playoffs was r = 0.15. The sample was small: 18 goalies who started in each of three seasons. Of the top-10 goalies from three seasons earlier, only two were above average in the latest season. — [JFresh Substack](https://jfresh.substack.com/p/why-goaltending-is-basically-random?s=r)
- Among NHL goalies with 25+ games over four seasons, 20 went from above-average GSAx/60 to below average the following season and 24 went the other way, showing large GSAx/60 churn. — [Sportsnaut](https://sportsnaut.com/nhl/new-jersey-devils/devils-news-why-devils-unorthodox-goaltending-makes-sense-allen-daws-rittich)
- Save % is a weakly repeatable skill and a weak predictor of future performance. The paper suggests controlling for shot type or using xG-based measures. — [SMU Data Science Review](https://scholar.smu.edu/datasciencereview/vol1/iss2/12)
- A weighted-shot / adjusted save % study (split-half reliability, goalies with more than 1,000 even-strength shots against, 2008–2011) found some evidence that shot-quality-adjusted save % is more consistent and slightly more predictive. The authors called the evidence "far from overwhelming" and the gain small. This comes from a search excerpt; the PDF text could not be extracted. — [arXiv 1205.1746](https://arxiv.org/pdf/1205.1746)
- Hockey Graphs (2015) argued for split-half (odd versus even games) reliability testing over year-to-year correlations because it allows larger samples, and claimed an "xSV" (expected save %) model predicts future goaltending better than existing models. Title and summary only; not fetched. — [Hockey Graphs, Oct 2015](https://hockey-graphs.com/2015/10/23/xsv-is-a-better-predictor-of-goaltending-performance-than-existing-models/)

**League baseline drift**
- League save % by season: 2016 .9149, 2017 .9135, 2018 .9122, 2019 .9099, 2020 .9096, 2021 .9079, 2022 .9070, 2023 .9042. The authors link part of the decline (but not all of it) to starters playing a smaller share of games. — [Robnett & Welsh, CMU 2023](https://www.stat.cmu.edu/cmsac/sure/2023/showcase/hockey_saves/report.html)
- League averages for 2021-22 through Jan. 2 (1,019 games): 31.5 shots and 28.4 saves per team-game. — [NHL.com/Kraken](https://nhl.com/kraken/news/core-concepts-examining-goalie-workload-329507592)

**Shot quality (xG) inputs**
- MoneyPuck's xG model was rebuilt for 2026-27. It is a gradient-boosted model trained on about 289,000 shots (2023-24 to 2025-26) with features for shot location, shot type, the preceding event, defender time on ice, skater counts, off-wing, and empty net. AUC is 0.807, up from 0.784 for the old model. GSAx/60 and save % are the largest factors in its goaltending component. — [MoneyPuck About](https://moneypuck.com/about.htm)

**Back-to-back and rest effects**
- Tulsky (2013), as summarized by NHL.com: rested goalies posted about .912 in the second game of a back-to-back, versus about .901 for goalies who played the night before (search excerpt). The fetched article describes the gap as "just over 11 percent" and extrapolates to "nearly three more goals against per game". Later work by Andrew Thomas (SMT) and Dom Luszczyszyn (The Athletic) found the effect "may not be as significant". No figures are given for those studies. — [NHL.com/Kraken, Jan 2022](https://nhl.com/kraken/news/core-concepts-examining-goalie-workload-329507592)
- Hockey Graphs (1987–2014, about 40,000 games, no controls) compared a goalie's first and second game by days between them. One day apart (back-to-back): save % .905 → .897, win % .498 → .421, shots faced 28.9 → 29.7. Two days: .908 → .901. Three days: .905 → .900. Four days: .899 → .898. Five days: .892 → .899. The author flags confounding: most back-to-backs are on the road, and backups get more rest. — [Hockey Graphs, Dec 2014](https://hockey-graphs.com/2014/12/01/goaltender-performance-vs-rest/)
- A team-level blog study (Toronto) of second halves of back-to-backs found .892 when the goalie had played the night before and .912 when rested, with no formal controls. Search excerpt; not fetched. — [Leafs Nation, 2020](https://theleafsnation.com/2020/08/05/do-we-see-jack-campbell-in-game-four/)

**Shots-against projection practice (betting)**
- Action Network's prop models output a projected save count per goalie and compare it with the book's line. Examples include a slate-high Gibson projection of 36.24 saves against a 31.5 line (over) and Mike Smith at 19.73 (under). Stated inputs include the opponent's shot volume and Corsi (shot attempts), and an opponent's low shot-attempt tendency was used to explain a 23.78 projection for Quick. These are 2018-era examples; the method is not documented and there is no published track record. — [Action Network (Mike Smith)](https://www.actionnetwork.com/nhl/nhl-player-prop-bets-picks-mike-smith-over-under-mike-smith); [Action Network (Hellebuyck 29.5 saves)](https://www.actionnetwork.com/nhl/top-nhl-props-for-saturday-hellebuyck-over-under-29-5-total-saves)

### Inferences
- **Regression constant.** Under a beta-binomial model, "half signal at about 3,000 shots" implies a prior weight k ≈ 3,000 shots: projected save % = (saves + k × league save %) / (shots + k). Example: a goalie at .925 on 1,500 shots with league at .903 projects to (1,387.5 + 2,709) / 4,500 ≈ .910. The weaker r = 0.12 on about 1,500–2,000 shots per season implies k ≈ n(1 − r)/r ≈ 11,000–15,000 shots. A defensible k is therefore about 3,000 (aggressive) to more than 10,000 (conservative). Fit k on your own data, for example with split-half reliability.
- **Implied talent spread.** With p ≈ .905 and per-shot variance p(1 − p) ≈ .086, k = 3,000 implies a true-talent standard deviation of about √(.086/3,000) ≈ .0054. At k = 11,000 it is about .0028. Over 30 shots, one talent standard deviation is only about 0.08–0.16 goals per game. In contrast, single-game binomial noise is about √(.905 × .095 / 30) ≈ .054 of save %, ten times or more the talent spread. Goalie identity therefore matters far less per game than projected shot volume and the team in front of him.
- **Regression target.** Regress toward the current-season league save %, or a goalie-tier mean such as starter versus backup, not toward a multi-year constant. The baseline moved about .011 between 2016 and 2023.
- **Shot quality.** Use GSAx-based or expected save % as the talent signal, but expect only a small improvement over raw save % (the arXiv result, and JFresh's r = 0.12 for both). The opponent's and the goalie's own team's xG per shot belongs mainly in the expected save % of the matchup, that is the team-defense term, not the goalie-talent term.
- **Back-to-back adjustment.** A reasonable prior is −0.005 to −0.010 of save % for a goalie playing both halves of a back-to-back, plus about 0.8 extra shots against (Hockey Graphs raw: 29.7 vs 28.9). The NHL.com "11 percent → three goals" extrapolation is arithmetically inconsistent with .912 vs .901: that is a 0.011 absolute gap, worth about 0.35 goals on 31.5 shots. Treat it as an error in the article.
- **Saves equation.** E[saves] = E[shots against] × projected save %, and E[GA] = E[shots against] × (1 − projected save %), excluding empty-net goals. Projected shots against should combine the opponent's shot generation, the goalie's team's shot suppression, and home/away, then adjust for expected game state: a goalie whose team is expected to lead will face more late shots from a trailing opponent.
- **Pull risk caps the distributions.** A starter pulled after a bad start ends with fewer saves and a censored GA total, so the saves distribution has a left tail that a simple Poisson or normal on shots misses.

### Gaps
- No public 2024–26 study gave year-over-year or split-half r specifically for GSAx/60 from MoneyPuck or Evolving-Hockey.
- No source quantified the stabilization of team shots-against rates (CA/60, SA/60) or the predictive weight of opponent shot generation versus own-team suppression for single-game shots against.
- No modern controlled back-to-back estimate was found. The Thomas and Luszczyszyn follow-ups are described only qualitatively.
- No source measured how a high-danger shot mix affects single-game save % beyond the xG model itself.
- No public accuracy, calibration, or closing-line evidence was found for any goalie saves-prop model.
- The arXiv split-half reliability values could not be extracted from the PDF.

## Wins: deriving win probability from team strength and moneylines, and handling overtime and shootouts

### Takeaway
Goalie wins come from team win probability, from either a team-strength model or de-vigged moneylines (which include OT and shootouts). That figure is then reduced by the chance the goalie is not the goalie of record. NHL games are close to coin flips: even MoneyPuck's favorites win only about 60–61%, with log loss around 0.656–0.661. About 21–27% of games are tied after regulation, which matters both for overtime-loss scoring and for shootout handling (MoneyPuck treats shootouts as 50-50).

### Cited Findings
- MoneyPuck's pre-game win model sums three components: "ability to win" (win %, weighted to recent games, with OT and shootout results counted as ties); "scoring chances" (shooting-talent-adjusted xG, goals, shot attempts, shots on goal, and defensive-zone giveaways by manpower); and goaltending (multi-season GSAx/60 and save %). Goaltending carries 29% of the model's influence. Home teams win about 54% of games. — [MoneyPuck About](https://moneypuck.com/about.htm)
- MoneyPuck's accuracy (favorite's win rate / log loss): 2024-25 60.4% / 0.658; 2023-24 61.1% / 0.661; 2022-23 60.6% / 0.656; 2021-22 64.1% / 0.648; 2020-21 60.1% / 0.6596. — [MoneyPuck About](https://moneypuck.com/about.htm)
- MoneyPuck's "Deserve To Win O'Meter" treats a shootout as a 50-50 toss-up. Its live model simulates regulation and OT win/loss outcomes. — [MoneyPuck About](https://moneypuck.com/about.htm)
- Overtime frequency: an Oilers Nation table row labeled "2025" shows 271 of 1,312 games (20.65%) going to OT or a shootout. The season label is ambiguous. — [Oilers Nation](https://oilersnation.com/news/early-season-nhl-trends-shootouts-caufield-ovechkin-east-vs-west-and-more). Early 2025-26: 27.3% of the first 425 games were tied after regulation, a record pace. — [ESPN](https://africa.espn.com/nhl/story/_/id/47210375/nhl-2025-26-games-shootout-theories-trends-stats-standings)
- Shootouts have averaged about 97 per full season since 2015-16 and were falling. Search excerpt. — [Daily Faceoff](https://www.dailyfaceoff.com/news/should-nhl-finally-extend-3-on-3-overtime-shootout)
- DFS sites suggest Vegas moneylines as the starting point for goalie win projections, since wins are weighted heavily on both DraftKings and FanDuel. — [FantasyLabs](https://www.fantasylabs.com/?p=84873)
- In raw historical data, goalies playing the second half of a back-to-back won .421 of those games versus .498 in the first game (uncontrolled). — [Hockey Graphs, 2014](https://hockey-graphs.com/2014/12/01/goaltender-performance-vs-rest/)
- Pulling the goalie for an extra attacker "nearly quadruples" the opponent's scoring probability while "not even doubling" the trailing team's own chances (Asness & Brown, as reported). The thesis argues coaches should pull earlier. — [IBJ](https://www.ibj.com/articles/69118-kim-nhl-coaches-and-investors-often-focus-on-wrong-risk)

### Inferences
- **From moneylines.** Convert each side's odds to implied probability (decimal odds: 1/odds), then remove the vig by normalizing the two sides to sum to 1. A proportional or power method is common; neither is sourced here. The NHL moneyline settles including OT and shootouts, so it is directly P(team win), not P(regulation win).
- **Goalie win.** P(goalie win) ≈ P(start) × P(team win | this goalie starts) × P(not pulled while the team still wins). The win is credited to the goalie of record, so pull risk subtracts from the starter's win probability. The moneyline already reflects the expected starter only if the market priced him; if the goalie changes after the line, adjust using the goaltending weight (MoneyPuck: 29% of influence).
- **OTL and SOL.** P(reach OT) ≈ 0.21–0.27 from the figures above. Assuming roughly 50-50 OT/SO outcomes, scaled slightly by team strength, P(goalie OTL) ≈ 0.10–0.13 per start for scoring systems that award OTL points (DraftKings: +2). A three-outcome model (regulation win, tie after regulation, regulation loss) is preferable to a binary win model for fantasy goalie scoring.
- **Narrow range.** With the best public model's favorites winning only about 60–61%, nearly all goalie win probabilities fall roughly between 0.35 and 0.65. Wins therefore separate goalies less than volume-driven stats (saves) do, despite their high per-event fantasy weight.
- **Inconsistency risk.** Shot-volume projections and win probability should be correlated in the same model. Underdogs typically face more shots, so a goalie's saves outlook and win outlook usually move in opposite directions. Combining them independently, for example taking saves from team shot rates and wins from moneylines without a shared game-script model, risks inconsistent projections.

### Gaps
- No source quantified the goalie-specific gap between P(team win) and P(goalie credited with win), i.e. pull-and-relief frequency in wins.
- No source gave the market's historical calibration (closing moneyline versus outcomes) for the NHL in 2024–26.
- No confirmed full-season 2024-25 OT/shootout share was found; the 20.65% figure is from an ambiguously labeled table.

## Shutouts: probability model and calibration

### Takeaway
Poisson on goals against, P(GA = 0) = e^(−λ), is the standard approximation. A simple league-wide check, about 3 goals per team-game giving about 4.8% shutouts, tracked observed early-season shutouts closely. Score effects and momentum violate independence, and fantasy shutouts additionally require the goalie to play the full game (including OT; shootout goals don't count). No public calibration study of goalie-level shutout projections was found.

### Cited Findings
- 338Canada/Maclean's: a Poisson curve using the season average of about 3 goals per team per game gave a theoretical shutout rate of 4.8%, which tracked the first 581 games of that season closely. The article notes that hockey's momentum violates Poisson's independence assumption. Search excerpt; the page returned 403 and the season is not stated. — [Maclean's / 338Canada](https://macleans.ca/sports/338canada-now-for-something-lighter-than-politics-nhl-projections)
- Fantasy shutout definition (DraftKings, per a Daily Faceoff cheat sheet): the goalie must complete the entire game with 0 goals allowed in regulation plus overtime; shootout goals do not prevent a shutout. — [Daily Faceoff cheat sheet](https://www.dailyfaceoff.com/draftkings-fantasy-hockey-cheat-sheet-december-2nd)
- Current DraftKings shutout bonus: +4. — [DKNetwork](https://dknetwork.draftkings.com/2020/07/02/beginner-nhl-dfs-scoring/)
- A Bayesian Poisson treatment of NHL scoring rates exists for goalie-pull timing analysis, demonstrating Poisson goal-rate modeling in practice. Notebook; not reviewed in detail. — [agalea91 notebook](https://nbviewer.jupyter.org/github/agalea91/nhl-goalie-pull-optimization/blob/master/notebooks/src/4_bayes_poisson.ipynb)

### Inferences
- **Sensitivity.** P(GA = 0) = e^(−λ): λ = 2.5 → 8.2%; λ = 2.9 → 5.5%; λ = 3.2 → 4.1%. Shutout probability is highly sensitive to λ, so λ must come from the same shots-against × (1 − save %) pipeline as GA, excluding empty-net goals, which are not charged to the goalie.
- **Shots-conditional form.** P(SO) = E_shots[sv^shots]. At 30 shots and .905, .905^30 ≈ 0.050. Because the function is convex in shots, variance in shots against raises P(SO) relative to plugging in mean shots. A mixture over a shots distribution, such as negative binomial shots with binomial goals, is more faithful than a single Poisson.
- **Full-game condition.** Multiply by P(goalie plays the full game | GA = 0 through regulation), which is near 1 for starters but not exactly 1 because of injuries and rare mid-game swaps. For backups who might enter in relief, P(SO) is effectively 0.
- **Score effects.** Teams that lead (the scenarios where shutouts happen) face more shots late. This leading-team "turtle" effect slightly raises shots against in shutout game states and violates independence. Calibrate empirically: bin predicted P(SO) and compare with observed shutout frequency per bin over several seasons.

### Gaps
- No published reliability diagram or Brier score for goalie-level shutout projections was found.
- No source quantified the overdispersion of NHL goals against relative to Poisson in recent seasons.
- No recent league shutout rate per goalie start (2024–26) was found in this search.

## How DFS and fantasy sites project goalies, and the known pitfalls

### Takeaway
DraftKings scoring (win +6, save +0.7, GA −3.5, shutout +4, OTL +2, 35+ saves +3, no shootout points) makes saves the largest expected-value component and wins and GA the largest swing components. The main pitfalls follow from the evidence above: overweighting wins (which barely separate goalies), overweighting recent or hot save % (r ≈ 0.12–0.30 year over year), ignoring pull risk, and projecting a starter at 100% before confirmation. Goalie fantasy points are highly volatile, and public sources offer little quantified guidance beyond moneylines and shot volume.

### Cited Findings
- DraftKings NHL goalie scoring: win +6, save +0.7, goal against −3.5, shutout bonus +4, overtime loss +2, 35+ saves bonus +3. — [DKNetwork](https://dknetwork.draftkings.com/2020/07/02/beginner-nhl-dfs-scoring/). Goalies earn no points in shootouts. — [RotoWire DFS Hockey 101](https://www.rotowire.com/hockey/article/dfs-hockey-101-how-to-play-on-draftkings-47353)
- Older DraftKings scoring (2015–16 cheat sheets) was win +3, save +0.2, GA −1, shutout +2. Historical projections built on that system are not comparable. — [Daily Faceoff cheat sheet](https://www.dailyfaceoff.com/draftkings-fantasy-hockey-cheat-sheet-december-2nd)
- FantasyLabs: wins are "weighted significantly" on DraftKings and FanDuel, and an underperforming goalie can sink an otherwise strong lineup. It asks, without confirming, whether chasing high-win-probability goalies adds consistency at a "variance-filled position", and suggests moneylines as the starting point. — [FantasyLabs](https://www.fantasylabs.com/?p=84873)
- A hot goalie is not reliably a better goalie: regular season to playoff correlation is even lower than year-to-year, and no one can predict which goalies will fluctuate. — [Paine](https://neilpaine.substack.com/p/a-hot-goalie-isnt-a-better-goalie); [JFresh](https://jfresh.substack.com/p/why-goaltending-is-basically-random?s=r)
- Pull risk: even the best NHL goalies get pulled several times a season (2011-12 analysis). — [Minitab](https://blog.minitab.com/en/the-statistical-mentor/when-should-nhl-goalies-get-pulled). MoneyPuck includes pull frequency in its goalie weighting. — [MoneyPuck About](https://moneypuck.com/about.htm). Example headline: Vasilevskiy pulled for the 13th time in his career. — [TSN](https://www.tsn.ca/nhl/tampa-bay-lightning-andrei-vasilevskiy-pulled-for-13th-time-in-career-we-left-him-out-to-dry-1.2193150)
- Betting-model practice projects saves from opponent shot volume and Corsi and compares the result with the prop line. — [Action Network](https://www.actionnetwork.com/nhl/top-nhl-props-for-saturday-hellebuyck-over-under-29-5-total-saves)

### Inferences
- **Worked DraftKings expected value** for a typical starter, using illustrative assumed inputs (P(win) .55, 27 saves, 2.8 GA, P(SO) .06, P(OTL) .11, P(35+ saves) .12): 3.30 (win) + 18.90 (saves) − 9.80 (GA) + 0.24 (SO) + 0.22 (OTL) + 0.36 (35+) ≈ 13.2 FP. Saves contribute the most expected value. The win term has a standard deviation of about 6 × √(.55 × .45) ≈ 3.0 FP on its own, and the GA term (σ_GA ≈ 1.7) about 6 FP. These swings, which are correlated with each other, drive goalie volatility.
- **Pitfall: overrating wins.** Since win probability spans only about 0.35–0.65, a 10-point edge in P(win) is worth about 0.6 FP, roughly the same as 0.9 extra projected saves. Favorite goalies often face fewer shots, so the save and win effects partly offset.
- **Pitfall: ignoring pull risk.** A pulled goalie loses the win (or takes the loss), loses the shutout and the 35+ bonus, and carries early GA. Projections should model the left tail explicitly, for example with a per-start pull probability conditioned on early GA, rather than using a symmetric distribution.
- **Pitfall: confirmed-starter assumption.** Before confirmation, use P(start)-weighted expected value. For tournaments, ownership often follows confirmations, so an unconfirmed but likely starter carries both projection risk and leverage.
- **Pitfall: recency.** Weight multi-season, shot-quality-adjusted talent with heavy shrinkage (k ≈ 3,000–11,000 shots) over recent-game save %, consistent with year-over-year r ≈ 0.12–0.30.
- **35+ saves bonus.** This requires modeling the shots-against distribution, not just its mean: P(saves ≥ 35) is driven by the right tail of opponent shot volume, typically for underdog goalies facing high-volume teams.

### Gaps
- No quantified public study was found on DFS goalie projection accuracy (for example, MAE of site projections versus actual FP) or on how often sites overrate wins.
- No public league-wide rate of starters pulled per start (2024–26) was found. Pull frequency would need to be computed from play-by-play or games started versus games finished.
- No source quantified the empirical standard deviation of goalie DraftKings FP per start or the correlation between goalie FP and team win.
