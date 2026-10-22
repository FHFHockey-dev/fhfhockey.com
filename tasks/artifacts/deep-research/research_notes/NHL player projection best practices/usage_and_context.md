# NHL single-game projections: player opportunity (ice time, deployment) and game context

Research notes compiled 2026-10-22. Sources are mostly analyst blogs, model methodology pages and fantasy/DFS outlets; peer-reviewed work on per-game TOI projection was not found. Where a figure came from a search-result summary rather than a page I fetched and read, it is flagged "(search summary; page not fetched)".

## TOI projection: methods, team-total reconciliation, and error size

### Takeaway
Last season's (or recent) TOI per game is a strong baseline: year-to-year R² is about 0.74 for TOI/GP. Public systems model TOI with prior-season values as the dominant input, then adjust for role changes. Deployment follows a depth-chart structure: each rank plays about one minute less than the rank above, and #1 forwards play about 21 minutes. Team totals must respect hard ceilings. The top defenceman's share of team even-strength (EV) time has peaked at about 41–45%, and the top-100 defencemen average about 37%. No public source quantifies per-game TOI error in minutes or how much stat-projection error it explains. The best proxy is that the power play caused over half of the 2024-25 points overshoot in one projection audit (see the Power play section).

### Cited Findings
- **Year-to-year TOI/GP stability (R²), using Evolving Hockey data.** 2021-22→2022-23: .656; 2022-23→2023-24: .739; 2023-24→2024-25: .736; .759 when restricted to players with 10+ GP in both seasons. The author concludes "we could do a whole lot worse than just copy/paste a player's ice time per game from 2024-25." — [Clifford, DobberHockey, 2025-07-22](https://dobberhockey.com/?p=89836)
- **Size of role changes.** Forwards whose TOI rose gained about 1.31 min/GP on average, and the top quartile of risers gained about 1.85 min. Defencemen who rose gained about 1.82 min. Six players gained 5+ min/GP from 2023-24 to 2024-25, and five of them were defencemen; Broberg gained "nearly nine minutes per game." Big jumps are hard to predict, and some players "are going to be missed, and some by a lot." — [Clifford, DobberHockey, 2025-07-22](https://dobberhockey.com/?p=89836)
- **Defencemen's share of team EV TOI.** The top-100 defencemen averaged "a shade over 37%" of team EVTOI in 2024-25, about the same as in 2021-22. The single-defenceman maximum fell from 43–45% (2021-22, 2022-23) to 41–43% in the last two seasons, about 40 fewer minutes per season for the top player. Defencemen at ≥40.5% of team EVTOI fell from 10 (2022-23) to 6 (2024-25). — [Clifford, DobberHockey, 2025-07-18](https://dobberhockey.com/?p=89786)
- **Depth-chart structure.** McCurdy's Magnus 9 model notes that "each rank on the depth chart plays about a minute less than the one above it," and #1 forwards average roughly 21 minutes per night. Most 5v5 play happens in the first 30–40 seconds of shifts. — [HockeyViz, Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- **Evolving-Hockey 2021 projection system.** It has 16 LightGBM models producing 20 metrics, including GP and average TOI (ATOI), with total TOI = GP × ATOI. It is trained on 2–3 prior seasons, and "the prior years' versions of those metrics" were the most important predictors. GAR, xGAR and RAPM "weren't particularly good at predicting standard box score metrics." It was "often better and more reliable to model the underlying raw metrics" than ratios. Outputs were Z-score rescaled to the observed mean and SD of recent seasons (described as "not a standard technique"). No error metrics were published, and EV/PP/SH splits are not described. — [Evolving-Hockey, 2021 Fantasy Hockey Projections](https://evolving-hockey.com/?p=708)
- **Lineup-driven per-game TOI in practice.** Daily Faceoff's DFS projections say: "Using the up-to-date lines on DailyFaceoff.com, we can accurately project for TOI." Projected TOI feeds goals, assists, shots and blocks. Line-level views combine each line's expected TOI, matchups and opponent stats, plus each line's power-play xG. — [Daily Faceoff DFS projections, 2025-02-15](https://www.dailyfaceoff.com/news/dfo-dfs-projections-02-15-25); [Daily Faceoff DFS charts, 2025-04-10](https://www.dailyfaceoff.com/news/dfo-dfs-charts-04-10-25)
- **Simulation-based game models use lineups directly.** HockeyStats.com takes team lineups "directly from Daily Faceoff" and reruns simulations "when a game ends or a roster changes." Its back-test author says lineups were not updated every game in the 2019-20 test, so "it was not a proper test." — [HockeyStats.com methodology](https://hockeystats.com/methodology/win-odds)

### Inferences
- **Reconciliation identity.** A per-game model should allocate within a fixed budget of skater-minutes, not project each player independently. In a regulation game that budget is 5 skaters × 5v5 minutes, plus 5 on the PP side and 4 on the PK side for each manpower state, plus overtime. At 5v5, forwards fill 3 seats and defencemen 2. Forwards' 5v5 time must therefore sum to 3 × team 5v5 minutes and defencemen's to 2 × (team share 300% and 200%). The observed ceilings support capping individual shares: about 41–45% of team EV time for a top defenceman, and roughly 21 min of total TOI for a #1 forward with about −1 min per depth rank.
- **Practical recipe consistent with these sources.**
  1. Estimate each strength state's minutes at team level (5v5, PP, PK, from projected penalties).
  2. Give players shares of each state from a recency-weighted blend of season and last-N-game shares, conditioned on the current line/pair/PP unit from the confirmed lineup.
  3. Normalize shares so they sum to the seat count (3 F / 2 D at 5v5, typically 4F+1D or 3F+2D on PP).
  4. Multiply shares by the state minutes.
  Independent player-level TOI projections that are not normalized will drift. When a regular is scratched, the team's total gets overstated, or the replacement's minutes get double-counted.
- Because season-to-season R² is about 0.74 but individual jumps of 2–9 minutes occur, a game-level model should weight recent games (role changes) more heavily than a season model does. This matters most for defencemen, who show the largest swings.
- The Evolving-Hockey finding that raw counts model more reliably than ratios supports projecting minutes and per-minute rates separately, then multiplying, rather than projecting points per game directly.

### Gaps
- No public source found that reports per-game TOI projection error (e.g. MAE in minutes for ES/PP/SH) or a variance decomposition of fantasy-point error into opportunity (TOI) versus efficiency (rate). The year-to-year R² values are season-level, not game-level.
- No published methodology found for how Evolving-Hockey, MoneyPuck or Daily Faceoff split TOI into ES/PP/SH at game level.
- No source found on how TOI shifts by in-game score state, for example top players getting more minutes when trailing. Magnus 9 reports that score effects on shot rates are large within a game but "almost negligible" at season scale.

## Power play: PP1/PP2 allocation, PP1 share, PP opportunities and minutes

### Takeaway
PP opportunities have fallen. Teams averaged 2.9–3.1 per game for about a decade, and 2024-25 dropped by 0.31 per team-game, to about 2.71, the lowest on record. Meanwhile top units took a larger share: the top-100 PP skaters averaged 70.1% of their team's PP time in 2024-25, up from 67.6% in 2021-22. Team-level PP1 shares range from about 55% to about 80%. Projections that carried prior PP-opportunity levels forward overshot points: in one audit, the PP explained more than half of the 2024-25 point-projection overshoot, and top projected goal scorers fell more than 6 goals per 82 games short.

### Cited Findings
- **PP opportunity levels.** Teams averaged "somewhere between 2.9 and 3.1" PP opportunities per game for about a decade, and year-over-year changes were normally within ±0.2. 2024-25 saw "a decline of -0.31 power play opportunities per team per game." Across 2,624 team-games that is about 800 fewer PP opportunities and, at about 21.6% conversion, about 176 fewer PP goals than 2023-24. — [Clifford, DobberHockey, 2025-07-18](https://dobberhockey.com/?p=89786)
- **Record low in 2024-25.** The 2024-25 league average was 2.71 PP opportunities per team per game, the lowest since tracking began in 1977-78. The prior lows were 2.89 (2020-21 and 2021-22). Penalty calls were 3.48 per team per game, the lowest for an 82-game season in 20 years. (Search summary; page not fetched; source listed as [newsio.com](https://newsio.com/?p=172319).) The 2.71 figure is consistent with Dobber's roughly 3.0 decade baseline minus 0.31.
- **Top-unit share is rising.** The top-100 PP skaters' average share of team PP time rose from 67.6% (2021-22) to 70.1% (2024-25). For a player on a team with "five PPTOI minutes per game," that is about 9–10 extra PP minutes per 82-game season. — [Clifford, DobberHockey, 2025-07-18](https://dobberhockey.com/?p=89786)
- **Team-level PP1 share examples (mostly fantasy outlets, varying dates):**
  - LA's PP1 "upwards of 70%" and Boston's PP1 "over 65%." — [Daily Faceoff power play report](https://www.dailyfaceoff.com/news/daily-fantasy-hockey-power-play-report-11-16) (search summary)
  - Colorado PP1 expected at "75-80 percent" in 2024-25. — [DobberHockey](https://dobberhockey.com/?p=85576) (search summary)
  - Anaheim forwards McTavish at 55.9% and Terry at 52.9%; a Calgary player rose to 59.8%. — [DobberHockey](https://dobberhockey.com/?p=85204) (search summary)
  - Boston's top unit at about 56% in an older piece. — [The Hockey Writers](https://thehockeywriters.com/breaking-down-the-bad-boston-bruins-dismal-powerplay/) (search summary)
  - The Rangers' top five players at about 80% of PP time, scoring 26 of 28 PP goals (93%). The author notes it is "impossible to accurately gauge ice time for the first unit" and used the top five players' PP TOI as a proxy. — [Blue Line Station, 2021-04-13](https://bluelinestation.com/2021/04/13/happened-new-york-rangers-power-play/2) (search summary)
- **Effect on projections.** Clifford audited 2024-25 preseason projections for 285 forwards:
  - Points were overshot by 6.5% and goals by 11.4%.
  - Removing the PP production gap cut the points overshoot from 6.5% to 2.9%, so "over half" of the point-projection gap came from the power play.
  - Forward PP goals were 115 fewer than 2023-24 and 154 fewer than 2022-23.
  - The top-45 projected goal scorers finished "over six fewer goals" per 82 games than projected, while the bottom-45 beat their projections.
  - Projected shots were 2.17 per game against 1.99 actual, a shot shortfall worth about 0.75 goals per 82 games per forward.
  — [Clifford, DobberHockey, 2025-05-23](https://dobberhockey.com/?p=88967)
- **PP rate home/away asymmetry.** At 5v4 in controlled matchups (2015–2019), home teams generated 84.4 unblocked attempts per 60, against 80.1 for away teams (about 5%). — [Meghan Hall, "Examining the Effect of the Last Change"](https://meghan.rbind.io/blog/2020-08-03-last-change/)
- **Lineup sources for PP units.** Daily Faceoff's notebook (published after morning skates) lists injuries, projected lines and pairings, and goalie status flags: Confirmed, Probable, Projected. Lines are marked "Subject to change." — [Daily Faceoff Daily Fantasy Hockey Notebook](https://www.dailyfaceoff.com/news/daily-fantasy-hockey-notebook-03-13-23)

### Inferences
- **Typical PP minutes (approximate arithmetic, not a measured average).** About 2.7 opportunities × at most 2:00 each, less early terminations from goals (roughly 21–22% conversion), gives about 4.5–5 team PP minutes per game. This matches the "five PPTOI minutes per game" example. At a 70% share, a PP1 skater gets about 3.2–3.5 PP minutes per game and a PP2 skater about 1.3–1.5. In 2024-25, holding share fixed while PP opportunities fell by about 10% would have overstated PP1 PP minutes by about 0.3–0.4 per game.
- **Main systematic-bias risk.** Projecting a PP1 player's PP minutes from his share alone, or from last season's PP TOI/GP, ignores the team's PP-opportunity environment. Better:
  1. Project team PP opportunities from both teams' penalties-drawn and penalties-taken rates, regressed to the current-season league mean (which can move by about 0.3 per game year to year).
  2. Multiply by expected minutes per opportunity.
  3. Allocate by unit share.
  The Dobber audit, where PP was over half the overshoot and top scorers were most overshot, shows the cost of over-allocating to top players when the league environment shifts.
- **Unit-share heterogeneity.** PP1 share varies from about 55% to about 80% across teams, so a single league-wide PP1 share (e.g. 65%) will under-project PP1 on top-heavy teams (COL, LA) and over-project on balanced ones. Use team-specific, recency-weighted shares, updated when unit composition changes.
- **Unit composition volatility.** PP shares can shift quickly within a season (e.g. a player climbing to 59.8%), so PP-unit assignment from the latest practice or lineup report should override season-average share when they conflict.

### Gaps
- No league-wide public study found that measures PP1 versus PP2 time share or production split (points per 60 by unit) for 2024-26 using shift data. The figures above are top-player shares or team anecdotes.
- No team-by-team table of PP opportunities per game for 2024-25 or 2025-26 was retrieved, and 2025-26 league-level PP opportunity figures were not found.
- The Yost/TSN piece on tired teams taking more penalties ([TSN, 2016](https://www.tsn.ca/the-old-adage-is-true-tired-teams-take-penalties-1.415364)) returned 404, so the effect size of rest on penalties drawn/taken is unverified.
- No source found that measures projected PP minutes per opportunity (accounting for PP goals, coincidental minors, 5v3s).

## Lines and deployment: line combinations, linemates, zone starts, quality of competition, lineup news

### Takeaway
Teammate quality matters far more than quality of competition. Magnus 9 finds the teammate distribution "much bigger" than the competition distribution, and Hockey-Graphs finds forward-teammate and opposing-defence quality both significant for forwards' shot rates. Zone starts boost shot rates strongly in the first seconds of a shift, but only about 12% of shifts start in the offensive zone, so their per-game scoring impact is small. Lineup news (lines and PP units after morning skate, confirmed goalies) is the main per-game deployment input in public DFS and simulation models.

### Cited Findings
- **Teammates versus competition (Magnus 9).** Teammate effects are the icetime-weighted sum of teammates' estimates (×4) and competition effects the icetime-weighted sum of opponents' (×5). "The teammate distribution is _much_ bigger than the competition distribution." Competition variation is larger offensively than defensively, and coaching-system effects are "broadly similar to that of competition." — [HockeyViz, Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- **Quality of competition (QoC) and quality of teammates (QoT) by position (Stimson and DTMAboutHeart, 2015-16, players with >200 5v5 min).**
  - The four TOI-weighted QoC/QoT metrics plus team controls explain 69% (adjusted R²) of forwards' CF/60.
  - Opposing defencemen (Defence QoC) and forward teammates (Forward QoT) carried most of the significance and "appear equal in importance."
  - For forwards' CA/60, the forwards they played with and against mattered.
  - For defencemen only one metric was significant per outcome: defence QoT for CF60, forward QoC for CA60.
  - Caveat: shot-based, in-sample, and not controlling for the player's own talent.
  — [Hockey-Graphs, 2016-10-10](https://hockey-graphs.com/2016/10/10/just-how-important-is-quality-of-competition-very-also-not-much-its-all-relative/)
- **QoC at shift level versus season level.** At the binned shift level, observed CF% falls about 1.5 points for each 1-point rise in competition CF% — [Hockey-Graphs, 2015-10-19](https://hockey-graphs.com/2015/10/19/the-relationship-between-competition-and-observed-results-is-real-and-its-spectacular/) (search summary). Over a season, competition "for the most part evens out," with nearly all players facing average opponents within about ±1 Corsi/60 — [Hockey-Graphs, 2014-01-01](https://hockey-graphs.com/2014/01/01/overemphasizing-context-a-mistake-just-as-poor-as-explaining-context-in-the-first-place/) (search summary).
- **Last change and matchup control.** About 38% of 5v5 time (just over 18 min per game; teams range 35–41%) is a home-controlled matchup. In controlled matchups home teams out-attempt away teams 41.1 to 35.6 unblocked attempts per 60 (about 15%). On offensive-zone faceoffs it is 60.5 to 55.2 (about 10%). In the playoffs the controlled-matchup edge rises to about 23%. — [Meghan Hall, 2020-08-03](https://meghan.rbind.io/blog/2020-08-03-last-change/)
- **Zone starts (Magnus 9).** An offensive-zone start "helps boost shot rates considerably," and the effect fades over about 35 seconds. Defensive-zone and neutral-zone starts depress rates similarly. — [HockeyViz, Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- **Zone starts are small for scoring.**
  - Counting on-the-fly shifts, an average player's offensive-zone starts are about 12% of shifts (Matt Cane's "true" zone starts) — [The Hockey Writers](https://thehockeywriters.com/jeff-blashill-vs-advanced-stats/) (search summary).
  - Hockey-Graphs' goal-based measure (expected faceoff goal differential) concludes zone starts have "a relatively small effect" for most players, since teams shoot less and with lower quality right after a draw — [Hockey-Graphs, 2015-10-19](https://hockey-graphs.com/2015/10/19/a-new-way-to-measure-deployment-expected-faceoff-goal-differential/) (search summary).
  - A David Johnson worked example puts Daniel Sedin's offensive-zone-start bias at about 2 additional points in a season — [Canucks Army](https://canucksarmy.com/news/small-but-not-insignificant) (search summary).
  - Counterpoint: extreme deployments (OZ% <40% or about 75%) visibly distort raw shot-attempt numbers — [DobberHockey](https://dobberhockey.com/?p=74635), [Penalty Box Radio](https://penaltyboxradio.com/?p=25873) (search summaries).
- **Lineup news timing.** Daily Faceoff publishes its fantasy notebook "as soon as the morning skates finish," with projected lines and pairings, injuries, "GAMETIME DECISIONS," and goalie flags (Confirmed / Probable / Projected). — [Daily Faceoff notebook](https://www.dailyfaceoff.com/news/daily-fantasy-hockey-notebook-03-13-23)
- **Starting goalies.** MoneyPuck runs a separate starting-goalie model that predicts starter probabilities from rest, recent results, playing time, age, GSAx "and other factors." — [MoneyPuck About](https://moneypuck.com/about.htm)

### Inferences
- **Linemate effects.** For per-game projections, a player's per-minute rates should be conditioned on projected linemates, especially forward linemates for forwards, before opponent quality, which is second order. A player moved up to a top line with a strong centre should get both more TOI (depth-rank effect, about 1 min per rank) and a rate bump. Applying only one is a common under-adjustment.
- **QoC.** Over a single game, the home coach's last change concentrates matchups. Road top lines face the opponent's chosen matchup more often, but the effect size on individual scoring is not quantified publicly. A small home/away rate adjustment (next section) captures most of it.
- **Zone starts.** These are better treated as a second-order rate adjustment. Because of reverse causality, OZ share partly reflects the coach's view of the player, which already shows up in his rates. Explicit zone-start adjustments risk double counting.
- **Lineup confirmation.** Projections should be recomputed when lines, PP units and goalies are confirmed (morning skate, then warmups). A model that freezes deployment the night before will misallocate minutes in games with scratches or line shuffles. That error is concentrated, and large, on the affected players.

### Gaps
- No accuracy study found for Daily Faceoff (or Left Wing Lock) projected lines against actual lines after warmups.
- No 2024-26 public study found that quantifies the per-game scoring effect of a line promotion or demotion.
- No academic paper found that directly models game-level deployment (TOI allocation) for projection. Shift-level ridge/logistic regressions such as Macdonald and Gramacy et al. ([arXiv 1209.5026](https://arxiv.org/pdf/1209.5026); [arXiv 1201.0317](https://arxiv.org/pdf/1201.0317)) evaluate players and do not project ice time.
- Left Wing Lock methodology was not retrieved.

## Opponent and venue adjustments: opponent defence, goalie quality, home/away, rest, travel, score effects

### Takeaway
The best-supported, measurable adjustments are:
- **Home ice:** home teams win about 54% and outscore opponents by about 0.27 goals per game. Home teams also get about 5% more 5v5 unblocked attempts overall and about 15% more in last-change-controlled matchups.
- **Rest:** a team on zero rest wins about 45% against about 51–52% on 1–2 days. Goal differential is about 0.2 goals per game worse than the same venue on one day of rest. MoneyPuck uses about −4 percentage points of win probability when only one team played the previous day.
- **Goaltending:** a large component of game models (29% of MoneyPuck's team-strength weighting), but save % is unreliable year to year, so goalie effects should be shrunk heavily.

Score effects strongly change shot volume within a game but are almost negligible over a season. Travel is not modelled by the main public models.

### Cited Findings
- **Rest, salary-cap era (2005-06 onward, 50,568 team-games, nhlscraper vignette).**
  - All games, by days of rest: 0 days: 8,648 games, win .450, average GD −0.274. 1 day: .508, +0.038. 2 days: .521, +0.119. 3+ days: .501, +0.042.
  - By venue: 0-rest away .422 / −0.453 against 1-rest away .461 / −0.250. 0-rest home .509 / +0.107 against 1-rest home .550 / +0.292.
  - The zero-rest share of team-games was 0.137–0.173 in 2018-19 to 2025-26 (0.152 in 2024-25, 0.164 in 2025-26).
  - The vignette does not control for opponent rest.
  — [nhlscraper "back-to-back tax" vignette](https://ftp.fau.de/cran/web/packages/nhlscraper/vignettes/back-to-back-tax.html)
- **Rest in MoneyPuck's pre-game model.** Playing the day before when the opponent did not "can reduce a team's win chance by about 4%." Home teams win about 54%, partly attributed to referee bias. — [MoneyPuck About](https://moneypuck.com/about.htm)
- **Rest effect on shot and goal shares (Yost, TSN, older).** Road back-to-back teams posted a 46% goal share against 49% for all road teams, and 47.0% score-adjusted Fenwick against 48.0%. Teams rested less than their opponent also underperform. (Search summary; sample period not clearly stated.) — [TSN, Travis Yost](https://www.tsn.ca/yost-rest-makes-a-major-difference-in-nhl-performance-1.120073)
- **Fatigue in Magnus 9.** The 5v5 model has rested, normal and tired categories. Tired is "associated with weaker results," rest helps less than tiredness hurts, and the fatigue effect is "incredibly tiny" relative to other effects. — [HockeyViz, Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- **Position heterogeneity on back-to-backs.** A FantasyLabs analysis notes the effect varies by position and that defencemen are least affected the day after a game. (Search summary.) — [FantasyLabs](https://www.fantasylabs.com/?p=44820)
- **Goalies on back-to-backs.** Tired and rested goalies differed little before 2011-12, and the gap widened in favour of rested goalies afterward. — [NHL.com Super 16 (2014)](https://www.nhl.com/ice/m_news.htm?id=734778) (search summary)
- **Home ice, shot rates.** 2015–2019 at 5v5: home teams averaged 42.6 unblocked attempts per 60 against 40.7 for away teams, a gap that "holds for every season." In controlled matchups it is 41.1 against 35.6 (about 15%). — [Meghan Hall, 2020-08-03](https://meghan.rbind.io/blog/2020-08-03-last-change/)
- **Home ice by period (Magnus 9).** Home/away by period terms; example effect "+9.3% xG/60" for the home team in the 2nd period relative to league average. Home advantage is modelled separately from matchup (last-change) effects. — [HockeyViz, Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- **Home ice, player shots.** Players averaged about 0.07 more shots per game at home (Frozen Tools data). — [DobberHockey, Frozen Tools Forensics](https://dobberhockey.com/?p=70751) (search summary)
- **Team-specific home splits.** Carolina scored 3.74 goals per game at home and 2.61 on the road in 2024-25, an outlier. — [The Hockey News](https://thehockeynews.com/news/latest-news/five-nhl-teams-that-are-elite-at-home-but-shocking-on-the-road) (search summary)
- **Score effects (McCurdy method, Evolving-Hockey weights).** Evolving-Hockey score-adjusts all on-ice metrics with McCurdy's method. The score-state column is from the home team's perspective, and a weight below 1 means the team over-produces in that state.
  - 5v5 shots on goal: home team trailing by 3+: home weight 0.862, away weight 1.191. Tied: 0.972 / 1.029. Home leading by 3+: 1.104 / 0.914.
  - 5v5 Corsi: trailing by 3+: 0.843 / 1.230. Leading by 3+: 1.140 / 0.891.
  - 5v5 xG: trailing 0.923 / 1.091; tied 0.954 / 1.051; leading 0.991 / 1.010.
  - 5v4 shots: trailing 0.844 / 1.226; leading 1.046 / 0.958.
  — [Evolving-Hockey glossary: Score Adjustments](https://evolving-hockey.com/glossary/score-adjustments/)
- **Score effects at game versus season scale.** "Within a single game the score is important; at the scale of a whole season it is not, for most players." Score effects are strongest in the 3rd period. — [HockeyViz, Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)
- **Goaltending weight and repeatability.**
  - MoneyPuck's pre-game model (trained 2017-18 to 2023-24, rebuilt January 2025) weights components as 17% win%, 54% scoring chances and 29% goaltending. The goaltending component uses the current goalies' GSAx/60 and save % over several seasons, weighted to recent play and to each goalie's share of games — [MoneyPuck About](https://moneypuck.com/about.htm).
  - HockeyStats.com shrinks goalie projections toward zero because performance "was not very repeatable from year-to-year" — [HockeyStats.com](https://hockeystats.com/methodology/win-odds).
  - Evolving-Hockey calls save % "one of the most unreliable and unrepeatable metrics I've ever had to work with" — [Evolving-Hockey 2021](https://evolving-hockey.com/?p=708).
- **Ceiling on game predictability.** MoneyPuck's regular-season log loss is 0.648–0.661, with the favourite winning 60.1–64.1% (2020-21 to 2024-25). — [MoneyPuck About](https://moneypuck.com/about.htm). HockeyStats.com reports a test log loss of about 0.678. — [HockeyStats.com](https://hockeystats.com/methodology/win-odds)
- **Opponent defence in DFS practice.** DFS research uses opponent xGA/60 and shot volume allowed when targeting matchups (e.g. an opponent's "3.23" xG/60 rank cited for goalie selection). — [FanDuel Research](https://www.fanduel.com/research/nhl-daily-fantasy-picks-and-helper-saturday-3-9-24) (search summary)
- **Travel.** Magnus 9 has no travel term. — [HockeyViz, Magnus 9 EV](https://hockeyviz.com/txt/magnus9EV)

### Inferences
- **Effect sizes computed from the nhlscraper table (my arithmetic).**
  - Across all rest buckets, home teams won about 54.4% with an average GD of about +0.27 per game, matching MoneyPuck's about 54%.
  - Zero rest costs about 0.19–0.20 goals of differential relative to one day of rest at the same venue: away −0.453 against −0.250, home +0.107 against +0.292.
  - The about 0.2 GD penalty combines offence and defence. Splitting it evenly, which is an assumption, implies a team-goal adjustment of about −0.1 for the tired team and +0.1 for its opponent, about 3–4% of a roughly 3-goal team total. Tired-team skater scoring would fall about 3–4%, and opposing skaters would rise similarly.
- **Home-ice adjustment.** The +0.27 GD home edge, split evenly, implies roughly ±0.13 goals per team (about ±4–5%), consistent with the about 4.7% home edge in 5v5 unblocked attempts (42.6 against 40.7). A per-game model could apply about +4% home and −4% away to team scoring and shot rates, with team-specific deviations heavily regressed.
- **Score effects in a pre-game projection.** Expected game script follows from team strength: favourites lead more often, so they generate fewer shots and the underdog more. Shot projections for heavy favourites should be shaded down and for underdogs up (5v5 SOG multipliers of about ±10–19% in multi-goal states). Goals are much less affected (xG weights of about ±5–9%). Ignoring this biases shot-on-goal projections for players on strong teams upward.
- **Goalie adjustments.** Because save % is unreliable, an opposing-goalie adjustment should use multi-season GSAx shrunk heavily toward league average, weighted by starter probability before confirmation. An unshrunk single-season save % produces overconfident opponent adjustments.
- **Ceiling and priorities.** With game outcomes near log loss 0.65, context adjustments should be modest. The order of priority:
  1. Lineup and TOI (opportunity).
  2. Team scoring environment (team strength, home ice, goalie, rest).
  3. Second-order effects: competition, zone starts, travel.

### Gaps
- No public study found that quantifies how opposing-goalie quality (GSAx) changes individual skater goals or points per game. Any multiplier needs to be estimated in-house.
- Rest and back-to-back effects specifically on shots and xG in 2023-26 data were not found. The Yost figures are older and shot-attempt based, and the nhlscraper vignette does not control for opponent rest.
- Travel effects (distance, time zones) found no measured effect size in public analytics. The leading public model omits travel.
- No current (2024-26) league-wide home/away split of goals per game was retrieved beyond the computed long-run figures.
- Specific opponent shot-suppression multipliers (e.g. opponent CA/60 or xGA/60 regressed and applied to player shots) were not documented in a public methodology.

## Team-level scoring environment: projecting team goals, implied totals, allocating goals to players

### Takeaway
Public game models project team scoring by combining team offence and defence impacts with league-average rates. Most use simulation; MoneyPuck adds a goaltending component. DFS practice anchors team scoring to sportsbook implied totals derived from moneyline and total. Allocating team goals to players by projected share of team shots or xG under the confirmed lineup is standard practice, but no rigorous public write-up of the allocation method was found. The 2024-25 audit shows that league-level environment shifts (fewer PP opportunities, about 5,000 fewer shots) propagate into systematic overprojection of top scorers if team totals are not re-anchored.

### Cited Findings
- **Implied totals.** "Implied totals are the number of goals each team is implied to score based on Sportsbook's game line and total. Targeting players on teams with the highest implied totals is usually a good place to start." Goalie projections blend team metrics with sportsbook odds (implied win %, implied goals against, expected saves). — [Daily Faceoff DFS charts, 2025-01-28](https://www.dailyfaceoff.com/news/dfo-dfs-charts-01-28-25); [Daily Faceoff DFS projections, 2025-02-15](https://www.dailyfaceoff.com/news/dfo-dfs-projections-02-15-25)
- **Simulation-based team goals.** HockeyStats.com merges "the projected impact of each team with the corresponding impact of their opponent" and adds it to league-average shot and goal rates. It simulates 3,600 one-second rows for regulation and 600 for overtime, with shooting and goaltending impacts applied per shot. — [HockeyStats.com methodology](https://hockeystats.com/methodology/win-odds)
- **MoneyPuck team strength.** The "scoring chances" component (54% weight) is driven by shooting-talent-adjusted xG, actual goals, shot attempts, shots on goal and defensive-zone giveaways. It is computed separately per manpower situation and weights recent games slightly more. — [MoneyPuck About](https://moneypuck.com/about.htm)
- **League environment shifts.** Shots on goal fell by about 5,000 from 2023-24 to 2024-25. Projected forward shots were 2.17 per game against 1.99 actual. Goals were overshot by 11.4% and points by 6.5%, and the PP explained more than half of the points overshoot. — [Clifford, DobberHockey, 2025-05-23](https://dobberhockey.com/?p=88967)
- **Distribution matters for scoring probabilities.** A player's total xG alone is not sufficient for scoring probabilities; how that xG breaks down across shots changes P(0, 1, 2+ goals). — [StatsBomb, "Comparing actual and expected goals"](https://blogarchive.statsbomb.com/articles/soccer/comparing-actual-and-expected-goals/) (soccer; search summary)

### Inferences
- **Top-down architecture.** The pipeline consistent with these sources:
  1. Project each team's goals, by strength state, from team ratings, home ice, rest and the expected starting goalie.
  2. Optionally blend with the market-implied team total, which already prices lineup news and goalie confirmations.
  3. Project team PP and PK minutes from both teams' penalty rates.
  4. Allocate each strength state's team goals and shots to players by (player TOI share in that state) × (player's per-minute share of on-ice shots/xG, conditioned on linemates).
  5. Derive assists from on-ice goals with player-specific primary/secondary assist rates.
  This keeps the sum of player goals equal to team goals and prevents the documented over-concentration on stars, where the top-45 projected scorers were overshot by more than 6 goals per 82.
- **Re-anchoring to the league environment.** The current-season league environment (PP opportunities per game, shots per game, shooting %) should be re-estimated from season-to-date data, not carried over from prior seasons. In 2024-25 a roughly 10% PP-opportunity drop and roughly 8% per-forward shot shortfall would otherwise have built in a 6–11% overprojection.
- **Market totals.** Implied totals have the advantage of incorporating late lineup and goalie news. The model total and the market total should be blended, or the market used as a check, rather than one ignored. The weighting needs in-house backtesting; no public evidence was found.

### Gaps
- No public, rigorous NHL-specific methodology found for allocating team implied totals to player goals or points (e.g. anytime-goalscorer pricing models), or for how accurate implied team totals are against realized team goals.
- No public study found comparing model-based against market-based team totals for skater fantasy-point accuracy.
- No public data found on the share of team goals or points that PP1 players capture per game in 2024-26, beyond the 2021 Rangers anecdote (26 of 28 PP goals by the top unit).
