# How sportsbooks and modelers price NHL player props, and how projection models can use market lines

Scope note: this is educational and modeling context only, not betting advice. Source quality is mixed. Most public material on NHL prop pricing comes from betting-media and vendor blogs (BettorEdge, RotoWire, Unabated, Wizard of Odds, Daily Faceoff). I found **no peer-reviewed study of NHL player-prop market efficiency**. Academic hockey evidence covers game totals and moneylines only. Material from other sports is labelled **[ANALOGY]**. Formulas under "Inferences" are standard probability derivations I wrote myself. They are not quoted from the sources.

---

## Q1. How do books and sharp modelers build prop prices? (TOI × rate; Poisson vs negative binomial; converting a mean to O/U probabilities and back; removing the vig)

### Takeaway
The public practitioner method is: projected TOI (split by strength state, with PP deployment the biggest lever) × per-60 rate, adjusted for opponent and goalie. The result is a count mean. A Poisson (or an overdispersed distribution, or a Monte Carlo simulation) turns that mean into probabilities for every half-point line, and those are compared with de-vigged book prices. De-vigging is usually done proportionally. That method is known to misallocate margin on longshots, which matters most for anytime-goalscorer (ATG) prices.

### Cited Findings
**TOI × rate construction**
- Skater props are framed as a per-60 rate × expected TOI. Worked example: 10 shots/60 × 15:36 projected TOI gives 2.6 expected SOG. At 18:00 TOI the same player projects to 3.0 SOG. — [BettorEdge, "NHL Player Props Explained" (G. Kajewski, 2026-10-17)](https://www.bettoredge.com/post/nhl-player-props-explained)
- A move to the first power-play unit is called the biggest single driver of a skater projection. It can raise the projection "with no change in talent", but the article gives no numeric adjustment. Goalie saves are framed as shots faced minus goals allowed, so they are driven mainly by the opponent's shot volume. — [BettorEdge](https://www.bettoredge.com/post/nhl-player-props-explained)
- RotoWire's "Lamp Lab" ATG model blends each skater's 5v5, PP and PK scoring rates with an expected-goals (xG) rate from MoneyPuck data. The blend is used as a Poisson λ against a league-average opponent. λ is then adjusted for the opponent's goals allowed per game at the player's position and for a multiplier on the opposing starting goalie. Both adjustments are **dampened 50% toward neutral**. Blend weights, TOI handling and shrinkage formula are not disclosed. — [RotoWire, "NHL Anytime Goal Scorer Model: The Lamp Lab, Explained" (T. Leary, updated 2026-09-30)](https://www.rotowire.com/hockey/article/nhl-anytime-goal-scorer-model-137385)
- Soccer [ANALOGY]: ATG traders estimate each player's scoring probability from minutes, shot volume, position and penalty duties, then apply a margin. — [Track360 glossary, "Anytime Goalscorer"](https://track360.io/glossary/anytime-goalscorer)
- Daily Faceoff's DFS projections use up-to-date line combinations to project TOI. Those TOI figures feed projected goals, assists, SOG and blocks. The statistical model itself is not described. — [Daily Faceoff DFS charts (2025-04-17)](https://www.dailyfaceoff.com/news/dfo-dfs-charts-04-17-25)
- A hobbyist NHL model uses deployment shares as features: PP share, TOI rank, and shot or xG share. It is an unreviewed GitHub project. — [tjolmo/bardown-iq PR #23](https://github.com/tjolmo/bardown-iq/pull/23)

**Distribution choice**
- Poisson is the default practitioner tool. For λ = 2.6 SOG: P(over 1.5) = 73.3% (fair −274), P(over 2.5) = 48.2% (fair +108), P(over 3.5) = 26.4% (fair +279). At λ = 3.0, P(over 2.5) = 57.7% (fair −136). The same author notes that real shot totals are "a little more spread out than a pure Poisson", so Poisson is only a starting estimate. — [BettorEdge](https://www.bettoredge.com/post/nhl-player-props-explained)
- ATG uses P(≥1 goal) = 1 − e^(−λ). λ = 0.35 gives about 29.5% (fair +239). — [BettorEdge](https://www.bettoredge.com/post/nhl-player-props-explained); the same formula appears in [RotoWire Lamp Lab](https://www.rotowire.com/hockey/article/nhl-anytime-goal-scorer-model-137385)
- MLB [ANALOGY]: a negative binomial (NB) is described as a Poisson generalisation with a dispersion parameter r that converges to Poisson as r grows. The same guide recommends different distributions at different lines, with NB for 0.5–3.5 lines. — [PredictionEngine MLB props guide](https://predictionengine.app/learn/mlb-player-props-guide) (search snippet; not fetched in full)
- One NHL practitioner guide uses binary classifiers, not Poisson, for ATG markets, and treats team expected goals as a Poisson λ. — [PredictionEngine NHL betting analytics](https://predictionengine.app/learn/nhl-betting-analytics) (search snippet)
- Low-quality, unreviewed practitioner notes record a consensus of "Poisson for goals, Negative Binomial for SOG" because shots are overdispersed relative to goals. — [edge-assist NHL props data-audit ruling](https://edge-assist.duckdns.org/data-status/docs/nhl-player-props/ruling/NHL%20Player%20Props%20Data%20Audit%20Council%20Ruling) (private hobby site; treat as anecdote)
- Team-level Poisson assumes the two teams score independently. A bivariate Poisson is suggested for more accuracy. — [BetHero Poisson calculator](https://betherosports.com/calculators/poisson) (search snippet)

**Simulation-based pricing of main and alternate lines**
- Unabated's Props Simulator runs 10,000 Monte Carlo simulations from a projection plus historical outcome data. It reports the fair price at the main line and every alternate line from the same distribution: "the sharper your inputs, the sharper individual prices for every tick will be". It does not name a distribution family, a correlation treatment or a vig method. — [Unabated Props Simulator](https://unabated.com/tools/core/props-simulator)
- Unabated notes that Over 24.5 at −110 and Over 26.5 at −110 are different wagers, so each threshold needs its own price. — [Unabated NBA tools page](https://unabated.com/sports/nba) [ANALOGY; search snippet]

**Mean vs median (why the line is not the mean)**
- [ANALOGY, NFL] Books set prop lines near the **median**, where over and under are equally likely. Player stat distributions are right-skewed (floor of 0, long upper tail), so the **mean sits above the median**. Bettors who treat a DFS-style mean projection as the line "bet far too many overs". — [Unabated, "The Biggest Mistake You're Making When Betting NFL Player Props" (J. Andrews, 2026-07-31)](https://unabated.com/post/the-biggest-mistake-youre-making-when-betting-nfl-player-props)
- Break-even at −110 is 52.4%. A player averaging 2.6 SOG is therefore a losing over-2.5 bet at −110 under Poisson (48.2%). — [BettorEdge](https://www.bettoredge.com/post/nhl-player-props-explained)

**Vig / hold and de-vigging**
- Hold = (sum of implied probabilities across sides) − 1. A −110/−110 market holds about 4.8%. The standard de-vig divides each side's implied probability by the sum (proportional/multiplicative). Stated hold ranges: major props 4–6%, secondary 6–10%, exotic 10–20%, live 8–15%. A two-way hold above 10% is a red flag. — [Wizard of Odds, "Player Props: Understanding the Math Behind the Lines" (J. Shackelford, updated 2026-08-03)](https://wizardofodds.com/article/player-props-understanding-the-math-behind-the-lines/)
- Proportional margin allocation produces the favourite–longshot pattern mechanically. Data Golf models the bookmaker's optimal allocation as an **roughly equal absolute margin per price**, which means longshots carry a larger *proportional* margin. Proportional de-vigging therefore **overstates longshot probabilities**. Evidence: in 27,150 Pinnacle soccer closings (2012–2020), the average total margin was 0.027. The longest-odds bin had implied probability 0.0391 against an observed frequency of 0.0263. In golf, win markets with 100+ runners sum to 120–150%. — [Data Golf, "The Favourite-Longshot Bias is not a bias" (2021-02-09)](https://datagolf.com/fav-longshot-not-a-bias)
- The open-source `penaltyblog` library implements several margin-removal algorithms, including Shin's method. — [penaltyblog docs](https://penaltyblog.readthedocs.io/en/latest/implied/index.html)
- Unabated's "Unabated Line" is described as a vig-free consensus built from a sport-specific blend of sharp market-making books, used as a fair-value anchor. — [sportsapis.dev review of Unabated API](https://sportsapis.dev/apis/unabated) (third-party review)
- Pinnacle's model is credited with pioneering reduced-margin, high-turnover pricing. — [Wikipedia: Pinnacle Sports](https://en.wikipedia.org/wiki/Pinnacle_Sports)

**How books produce prop prices operationally**
- Player markets are thinner and less liquid than headline lines. They need more modeling effort and more frequent line management, and correlation must be handled when the same players appear in multiple parlay legs. — [Track360 glossary, "Player Props"](https://track360.io/glossary/player-props)
- [ANALOGY, soccer] B2B prop suppliers (e.g., Sporting Risk) price every player across 20+ markets from player-action-level data. Parts are automated but "there are still significant manual functions". — [iGaming Business, D. O'Boyle (2022-10-21)](https://igamingbusiness.com/sports-betting/natural-evolution-player-props/)

### Inferences
- **Poisson inversion (line + odds → implied mean).** De-vig the over/under pair to get p_over for line L = k + 0.5. Solve P(X ≥ k+1 | λ) = p_over for λ. The left side increases monotonically in λ, so bisection or Newton works.
  - For 0.5 lines (ATG, points 0.5, assists 0.5, PPP 0.5) the solution is closed-form: **λ = −ln(1 − p_over)**. Example: a de-vigged ATG probability of 30% implies λ ≈ 0.357 goals.
  - The relationship is non-linear, so a juiced line carries information. At line 2.5, p_over = 0.482 implies λ ≈ 2.6, while p_over = 0.577 implies λ ≈ 3.0 (consistent with the BettorEdge numbers above).
- **NB inversion needs a second constraint.** With one line and its odds you can recover μ only if dispersion r is fixed beforehand, e.g. from historical fits per stat and position. With a main line plus one or more alternate lines, you can solve for (μ, r) jointly. This argues for ingesting alt-line ladders where available.
  - Using Poisson where the truth is overdispersed **overstates the mean recovered from an over price on a high line** and misprices tails. The effect is largest for SOG and saves, smallest for goals.
- **ATG de-vig is structurally hard.** Many books post only the "Yes" side, so there is no two-way pair to normalise. Options:
  - use a book that posts Yes/No;
  - normalise across a team so the implied scorer distribution matches the implied team total (see Q3);
  - apply an equal-absolute-margin or Shin-style removal instead of proportional, given the Data Golf evidence that proportional de-vig inflates longshots.
- **Points ≠ goals + assists as independent Poissons.** A player can earn at most one point per goal. Points over 0.5 is better modeled from on-ice team goals × the player's point-involvement rate. Treating G and A as independent Poissons overstates the variance of points.
- **Saves are bounded by shots faced** and depend on opponent SOG and the goalie's save%. A natural model is SOG_against (overdispersed) × save%, or saves ≈ SA − GA (excluding empty-net goals, which do not count against the goalie).

### Gaps
- No primary source from an NHL sportsbook or trading team describes their prop-pricing stack: distribution families, TOI models, or whether they copy sharp books. No public, verifiable NHL-specific fit (Poisson vs NB dispersion by stat and position) was found in this pass.
- I did not retrieve Unabated's or Pinnacle's own written methodology on which de-vig method they use for props, or Buchdahl's margin-weights-proportional-to-odds formulation. Searches returned only secondary summaries.
- I saw a secondary summary of a calibration study (~36,000 two-outcome observations: sub-50% outcomes outperform proportional de-vig by 0.7–2.2 pts) and a reference to Štrumbelj (2014) on de-vig method choice. I could not confirm the original source URLs, so neither is cited above.

---

## Q2. How efficient are NHL player prop markets? Evidence on biases (ATG favourite–longshot, shots over/under, star overpricing) and speed of line moves on lineup and goalie news

### Takeaway
There is **no peer-reviewed evidence specific to NHL player props**. Practitioner consensus, and the structural argument from lower limits, higher holds and less sharp money, is that props are less efficient than sides and totals, but also more heavily margined. Academic hockey evidence exists only for game totals: older work found an under bias, a later dissertation found the market largely efficient. The favourite–longshot pattern is well documented generally, and a margin-allocation argument predicts it in ATG prices. Goalie news moves game lines about 3–5 percentage points of win probability. Saves props generally are not posted until the starter is confirmed.

### Cited Findings
**Prop-market efficiency (general / practitioner)**
- Star-player props and high-volume stats are described as efficient, with fair probability likely close to true probability. Secondary players, exotic stats, lower-tier leagues and live props are described as less efficient because of less sharp action, smaller limits and less sophisticated modeling. Higher holds in those markets mean they are "not necessarily easier to beat". — [Wizard of Odds](https://wizardofodds.com/article/player-props-understanding-the-math-behind-the-lines/)
- [ANALOGY, NFL] A 2025 Claremont thesis on NFL moneylines finds predictable line movement tied to sharp action. It *asserts, without testing,* that such opportunities are more prevalent in player-prop and alt-line markets with less volume. — [Claremont McKenna senior thesis](https://scholarship.claremont.edu/cgi/viewcontent.cgi?article=5145&context=cmc_theses)
- Industry sources contradict each other on which NBA props are efficient and provide no data. — [nbabettingsystem.com](https://nbabettingsystem.com/articles/nba-betting-market-efficiency/) (vendor content; low reliability)

**Overs / unders bias**
- [ANALOGY, NFL props] Using mean projections against median-set lines leads to systematic over betting. This is a structural argument, not a measured study. — [Unabated (J. Andrews, 2026-07-31)](https://unabated.com/post/the-biggest-mistake-youre-making-when-betting-nfl-player-props)
- NHL game totals: "Market Efficiency and the NHL totals betting market: Is there an under bias?" reports significant inefficiency and a 54.20% win rate for UNDER bets across more than 5,000 games. — [ResearchGate listing](https://www.researchgate.net/publication/227410468_Market_Efficiency_and_the_NHL_totals_betting_market_Is_there_an_under_bias) (search snippet; full text 403)
- Woodland & Woodland, *Journal of Sports Economics* 12(1):106–117 (2011), DOI 10.1177/1527002510368792. The repository abstract says the NHL goal-totals over/under market is "found to be inefficient" and that simple wagering strategies earn profitable returns. **Caveat:** the repository lists this abstract under the title "The reverse favorite–longshot bias in the National Hockey League: Do bettors still score on longshots?", so the abstract and title appear mismatched in the index. — [EMU Digital Commons](https://commons.emich.edu/accfin_facsch/91)
- A 2018 University of Northern Colorado dissertation tested five heuristic strategies on NHL totals. It found the market largely efficient, with only one strategy showing a marginal above-average return. It also notes that only one prior published NHL-totals study existed. — [UNCO dissertation](https://digscholarship.unco.edu/cgi/viewcontent.cgi?article=1526&context=dissertations) (search snippet; full text 403)

**Favourite–longshot bias (relevant to ATG pricing)**
- Snowberg & Wolfers find that a misperception model, in which bettors overweight small probabilities, fits horse-racing data better than risk-love. — [Caltech record](https://resolver.caltech.edu/CaltechAUTHORS:20120604-093454009); overview in [Ottaviani & Sørensen, Kellogg](https://www.kellogg.northwestern.edu/academics-research/research/detail/2008/the-favorite-longshot-bias-an-overview-of-the-main)
- Counter-view: the favourite–longshot pattern is what a rational book produces under roughly equal-absolute margin allocation, not bettor irrationality. Back-solved horse-racing margins run from about 0.067 at 1/3 odds to about 0.006 at 100/1. — [Data Golf (2021)](https://datagolf.com/fav-longshot-not-a-bias)
- [ANALOGY, prediction markets] On Polymarket, the favourite–longshot bias is robust in crypto and politics but "surprisingly absent" in sports contracts. — [arXiv 2609.12878](https://arxiv.org/pdf/2609.12878)

**News and line-movement speed**
- Goalie value: a sportsbook hockey executive (via a 2024 ESPN piece) put a starting goalie at about **3–5 percentage points of implied win probability**, and said no player is worth much more than 5%. Example: Winnipeg started backup Eric Comrie at Tampa instead of Connor Hellebuyck, and the line moved from pick'em at open to TB −145 at close. Lines posted the night before price in the *projected* starter. A mismatch at confirmation makes the line jump, and teams with similar goalies move little. — [BettorEdge, "Starting Goalie Betting" (G. Kajewski, 2026-10-07)](https://www.bettoredge.com/post/nhl-starting-goalie-betting)
- Once a goalie is confirmed as the starter, books release saves props. Goals-against props exclude empty-net goals. — [ScoresAndStats goalie props guide](https://www.scoresandstats.com/?p=17721) (search snippet)
- When a skater prop moves, practitioners check line changes and PP-unit changes first. — [BettorEdge](https://www.bettoredge.com/post/nhl-player-props-explained)

### Inferences
- The structural features (multi-runner "Yes"-only pricing, large total overround, proportional de-vig) mean that **raw ATG prices will look miscalibrated against outcomes at long odds**, even if books price them rationally. A model calibrated to proportionally de-vigged ATG prices would inherit inflated longshot probabilities, for example for bottom-six or defence players.
- The mean > median skew for SOG, points and saves predicts that **naive "projection > line" signals tilt toward overs**. Model-versus-market comparisons should be made in probability space at the posted line, not mean versus line.
- Goalie confirmation is the single largest scheduled information shock in a game day. Saves, GA, win and shutout props, plus every skater prop that depends on opponent goalie quality, should be treated as stale until confirmation.

### Gaps
- No peer-reviewed or rigorous public study measures NHL player-prop efficiency, ATG calibration by price bucket, a SOG over/under bias, or "star overpricing" in NHL props. This is a genuine literature gap, not a search failure.
- No quantified, timestamped evidence was found on how fast NHL *player-prop* prices (as opposed to moneylines) react to line-combination, PP-unit or goalie news.
- From memory and unverified this session: Woodland & Woodland (2001, *Southern Economic Journal*) reported a *reverse* favourite–longshot bias in NHL moneylines (longshots underbet). Confirm before citing.
- A search summary mentioned NFL totals studies (Paul & Weinbach 2002 on overs in high totals; a 59.7% contrarian-under result for 2001–2009 that disappeared in 2010–2018). I could not confirm the primary URLs, so they are not cited above.

---

## Q3. How do modelers combine their own projections with market lines? (weighted blending; implied team totals to scale player projections; game totals and moneylines for goalie wins and GA)

### Takeaway
Public practitioners use the market as a fair-value anchor: a sharp-book consensus (Unabated Line) or de-vigged prices. They also use game totals and moneylines to derive **implied team totals**, which drive skater goal projections and goalie implied win%, goals against and expected saves (Daily Faceoff's DFS method). No public source gives exact NHL blend weights. Recoverable weights and formulas below are inferences.

### Cited Findings
- Daily Faceoff defines implied team totals as the goals each team is expected to score, derived from the sportsbook game line and total. It projects goalie **implied win %, implied goals against and expected saves** from "a combination of team underlying metrics and sportsbook odds". Weights and formulas are not disclosed. — [Daily Faceoff DFS charts (2025-04-17)](https://www.dailyfaceoff.com/news/dfo-dfs-charts-04-17-25); also [DFO DFS projections (2024-04-17)](https://www.dailyfaceoff.com/news/dfo-dfs-projections-04-17-24)
- DFS slate analysis uses implied team totals as a first filter, e.g. noting which teams sit above 3.5. A high total is not a guarantee. — [RotoGrinders NHL DFS slate summary](https://rotogrinders.com/articles/nhl-dfs-slate-summary-saturday-december-17th-3800921) (search snippet)
- RotoWire's ATG model compares its probability with DraftKings' implied probability (Edge = model − DK, in percentage points) and publishes model Fair Odds. "High Total" and similar signals are shown for reference but are **not** built into ATG%. — [RotoWire Lamp Lab](https://www.rotowire.com/hockey/article/nhl-anytime-goal-scorer-model-137385)
- The Unabated Line is a vig-free consensus from sharp market-making books, used as a fair price against which other books' prices are judged. — [sportsapis.dev](https://sportsapis.dev/apis/unabated)
- Team expected goals can serve as the Poisson λ for team-level props, and two teams' rates can be summed for game totals. — [PredictionEngine NHL analytics](https://predictionengine.app/learn/nhl-betting-analytics) (snippet)

### Inferences
- **Implied team totals from total + moneyline.**
  - De-vig the moneyline to get P(home win incl. OT/SO).
  - Choose (λ_H, λ_A) so that two conditions hold. First, the Poisson or Skellam regulation result plus an OT/SO split (roughly 50/50, shaded by strength) reproduces P(home win). Second, the implied total distribution reproduces the de-vigged over/under probability at the posted total line (e.g. 6.5 with juice).
  - Empty-net goals inflate late-game scoring and correlate with the leader, so a pure independent Poisson understates the total's tail.
  - The simpler DFS shortcut is to split the total by win-probability share. It is approximate.
- **Scaling player projections to the team total.** For each team, compute model expected team goals G_model and the market-implied G_mkt. Then:
  - Scale each skater's goal λ by G_mkt / G_model. Optionally use a partial weight, w·G_mkt + (1−w)·G_model, so the model keeps some say.
  - Apply the same factor to on-ice goals-for, which drives assists and points.
  - Shots scale less than goals, because the market total moves with goaltending and shooting talent as well as volume. Scale SOG with team implied *shots* if a team-shots market exists. Otherwise use a damped factor.
- **Blending a model with player props.**
  - Convert each prop (line + de-vigged odds) to an implied mean via Poisson or NB inversion (Q1).
  - Blend in mean space or log-odds space. Weight the market by a liquidity proxy: higher for sharp-book or consensus main lines, lower for single-book, "Yes"-only or exotic props, and lower further before goalie or lineup confirmation.
  - A Bayesian reading treats the market-implied mean as a prior and the model as the likelihood. Weights can be fit on history by minimising log-loss or Brier against outcomes.
- **Goalie markets.**
  - P(goalie win) ≈ P(team win) × P(goalie gets the decision | starts). The latter is close to 1, with small leakage from in-game pulls.
  - Expected GA ≈ opponent implied team total minus expected empty-net goals.
  - Expected saves ≈ opponent expected SOG − expected GA. Opponent SOG comes from the model, ideally anchored to a team-shots market or player SOG props summed across the opponent roster.
  - Shutout ≈ P(0 goals against in regulation + OT while in net), from the opponent-total Poisson (overdispersion matters).
- **Consistency check across props.** The sum of de-vigged ATG implied λs on a team should be roughly the team's implied goals, less some leakage, and the same holds for SOG props versus team shot expectations. Large mismatches show which side, player props or team total, carries the stale or soft price.

### Gaps
- No published NHL-specific blend weights (model vs market) or out-of-sample results from blending were found.
- I found no public description of how DFO, RotoWire or Action Network convert implied team totals into individual player goal and assist rates, or of their goalie implied win%, GA and saves formulas.
- No source quantified empty-net goal effects on the relation between implied totals and player or goalie props.

---

## Q4. What data feeds and timing do prop modelers rely on? (confirmed starting goalies, morning skate and line news, injury news)

### Takeaway
The game-day timeline runs in this order:
1. Overnight lines price the *projected* starter.
2. The morning skate, plus coach comments afterwards, usually confirms the starter.
3. Some starters are confirmed only at pregame warmups.
4. Line rushes and PP-unit deployment drive skater-prop changes.
5. Saves props are generally posted only after confirmation, and void if the goalie does not start.

Lineup services label goalies as confirmed, expected or unknown, and DFS projections are rebuilt from current line combinations.

### Cited Findings
- Most NHL teams hold an optional morning skate, and the head coach usually names the starter afterwards. Some coaches wait until pregame warmups. Before confirmation, the No. 1 is the default projection, and the backup is likelier on the second night of a back-to-back. — [BettorEdge, "Starting Goalie Betting" (2026-10-07)](https://www.bettoredge.com/post/nhl-starting-goalie-betting)
- Rotowire's NHL lineup tool marks goalies as confirmed, expected or unknown. — [RotoWire NHL advanced lineups](https://m.rotowire.com/daily/nhl/nhl_adv_lineups.php) (search snippet)
- Action Network prop write-ups flag starters who are "expected to start but not confirmed". — [Action Network saves-prop article](https://www.actionnetwork.com/nhl/four-nhl-prop-bets-for-monday-quick-over-under-28-0-total-saves) (search snippet)
- Daily Faceoff's projections use the "up-to-date lines" on DailyFaceoff.com to project TOI, and from it G, A, SOG and BLK. Line-matchup projections come from historical home-team 5v5 deployment. — [Daily Faceoff DFS charts](https://www.dailyfaceoff.com/news/dfo-dfs-charts-04-17-25)
- RotoWire's ATG model uses a "PP1" flag and an opponent back-to-back flag as reference filters, plus the opposing starting goalie as a λ multiplier. — [RotoWire Lamp Lab](https://www.rotowire.com/hockey/article/nhl-anytime-goal-scorer-model-137385)
- Grading rules (DraftKings house rules, Aug 2025 version, as described; rules vary by operator):
  - skater props void if the player does not dress;
  - a dressed player has action even with zero TOI;
  - goalie props void if the goalie does not start;
  - a starter pulled early still has action;
  - overtime counts, the shootout does not. — [BettorEdge props explainer](https://www.bettoredge.com/post/nhl-player-props-explained)
- Moneyline, puck line and totals stand regardless of the goalie. Shutout "Yes" requires a full game with no goals allowed. — [BettorEdge goalie piece](https://www.bettoredge.com/post/nhl-starting-goalie-betting)

### Inferences
- A projection pipeline that mirrors market timing would keep three snapshots: overnight (projected starters and lines), post-morning-skate (confirmed starters, line rushes), and pregame (warmup confirmations, scratches). Each projection should carry `goalie_status ∈ {confirmed, expected, unknown}`.
- Before confirmation, the correct opponent-goalie input is a **mixture**: P(starter) × starter quality + P(backup) × backup quality, using back-to-back and schedule priors. It should not be a point assumption. This is how overnight lines price uncertainty.
- Grading rules define the target variable. OT counts but the shootout does not. Skater props are conditional on dressing, and goalie props on starting. A fantasy model scored on the same event definitions can be calibrated directly against props. Stats that differ, such as fantasy scoring of shootout goals or goalie wins credited after relief, must be adjusted.

### Gaps
- No source documented the timing distribution of goalie confirmations (e.g. % confirmed by 11 a.m. ET), or how fast player-prop prices (not moneylines) update after confirmation.
- No authoritative public feed was identified for line rushes and PP units beyond Daily Faceoff's and RotoWire's lineup pages. Licensing and API terms were not researched.
- No source quantified the injury-news effect on NHL props.

---

## Q5. Which betting and prop practices translate to fantasy projections? (e.g. anchoring player projections to market-implied team totals)

### Takeaway
The most transferable practices are:
- anchor team scoring to market-implied team totals, so player projections sum to a realistic team total (DFS sites already use implied totals as their first-order input);
- project distributions, not just means, so medians and percentiles are honest;
- treat de-vigged prop prices as external calibration targets;
- version projections to the news timeline (projected vs confirmed goalie, lines, PP units).

### Cited Findings
- DFS practice uses implied team totals from sportsbook lines as the primary environment signal, and goalie implied win% and implied GA from odds plus team metrics. — [Daily Faceoff DFS charts](https://www.dailyfaceoff.com/news/dfo-dfs-charts-04-17-25)
- Fair probabilities at every threshold come from a full simulated distribution, not a single mean. — [Unabated Props Simulator](https://unabated.com/tools/core/props-simulator)
- [ANALOGY, NFL] Mean projections from DFS sites differ from prop lines because lines sit near medians of right-skewed distributions. Comparing a mean to a line biases decisions toward overs. — [Unabated (2026-07-31)](https://unabated.com/post/the-biggest-mistake-youre-making-when-betting-nfl-player-props)
- Opponent and goalie adjustments are shrunk 50% toward neutral in a production ATG model. This is a regularisation choice that transfers directly to fantasy matchup adjustments. — [RotoWire Lamp Lab](https://www.rotowire.com/hockey/article/nhl-anytime-goal-scorer-model-137385)
- A TOI change of about 2.4 minutes moves SOG over/under probabilities by about 10 percentage points (15:36 → 18:00 moves P(over 2.5) from 48.2% to 57.7%). TOI and PP projection is therefore the highest-leverage input. — [BettorEdge](https://www.bettoredge.com/post/nhl-player-props-explained)

### Inferences
- **Team-total anchoring for fantasy.**
  1. Compute implied goals per team from the de-vigged total and moneyline (Q3).
  2. Allocate team goals to skaters by on-ice goal share × TOI share. Allocate assists from the same on-ice goals × assist-involvement rates.
  3. Rescale so that Σ player goals ≈ implied team goals. Σ assists should be around 1.6–1.8 × team goals, the typical NHL assists-per-goal ratio; that figure is from general knowledge and was not sourced this session, so verify it from NHL totals.
  4. Allocate PPP from a team PP-goal expectation derived from the team total, both teams' PP and PK rates, and penalty rates.

  This prevents the common fantasy failure where every player on a team is projected optimistically and the team sum exceeds any plausible total.
- **Use props as calibration targets, not as truth.** Convert de-vigged closing props to implied means or probabilities. Track per-stat and per-bucket gaps between model and market, and evaluate both against outcomes (log-loss, Brier, calibration curves). Prefer closing over opening prices, liquid over illiquid books, and two-way over "Yes"-only markets.
- **Shrink toward the market more where markets are sharp and the model is weak** (star SOG, game totals). Trust the model more where markets are thin or high-hold (depth-player ATG, PPP, blocks).
- **Publish distributions.** Fantasy users comparing "projection vs prop line" need P(over line) or the median, not only the mean. Otherwise the mean/median skew misleads them.
- **Goalie fantasy.**
  - Win probability: from the de-vigged moneyline × P(start).
  - GA: from the opponent implied total less empty-net goals.
  - Saves: from opponent SOG (anchored to opponent player SOG props or team shots, where available) − GA.
  - All should carry a confirmed/expected flag and a mixture over starters before confirmation.

### Gaps
- No public validation was found showing that market anchoring improves fantasy projection accuracy for NHL specifically; analogous evidence from other sports was not retrieved.
- The assists-per-goal ratio and the share of NHL goals that are empty-net goals were not sourced this session. They should be computed from the project's own data before being hard-coded.
