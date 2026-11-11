# W1-12 audit: fantasy scoring (M-FSC-001 to 053)

Auditor: Claude (Fable), 2026-11-11, on `octoberBranch` at `37106e4ab`. Read-only: no code, data or configuration was changed. Paths are relative to `web/` unless they start with `modeling/` or `tasks/`.

**Evidence labels**
- **Run**: I executed the repository's own code on fixture or synthetic inputs, from scripts kept outside the repo (section 5).
- **DB sample**: a bounded, read-only production read on 2026-11-11, with `pg_stat_activity` checked first (0 other active queries). Dated sample evidence, not a population rate.
- **Read**: established by reading the code only.

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 26 | 001, 002, 003, 005, 006, 007, 008, 010, 016, 020, 022, 023, 026, 029, 030, 032, 033, 034, 035, 036, 038, 043, 044, 050, 051, 053 |
| Mis-specified | 20 | 004, 009, 011, 012, 014, 015, 018, 019, 024, 027, 028, 031, 039, 040, 041, 046, 047, 048, 049, 052 |
| Wrong | 6 | 013, 017, 021, 025, 037, 042 |
| Undetermined | 1 | 045 (needs Yahoo's published default weights, which I did not fetch) |

**The done-criteria from the brief**
- *weekScore's intent written and checked:* yes. The intent is in the code and in the page's help text (`components/GameGrid/utils/calcWeekScore.ts:44-48`; `components/GameGrid/GameGrid.tsx:863-876`, `:1585-1592`): games first, off-night games second, two small nudges that can never outweigh one off-night. The formula does what it says on the real-week fixture (section 3, note A). The 6/4 weights and the ±0.5 bonus are intended. The −100 value is an intended "no games" marker, but it is stored as a number in the score field, and one reader treats it as a score (D1).
- *One off-night definition chosen:* not chosen; that is an owner decision (question 1). There is one **threshold** everywhere (8 or fewer regular-season games), but four **valuations**: +4 on a 6-point game (Week Score), +0.25 on a 1-point game (four-week opportunity), a weighted 0.286–0.32 per game (social share, computed and not shown), and +1 game-equivalent (a fixture-only score). On the real-week fixture the first two rank all 32 teams the same way (0 discordant pairs of 407). They can disagree: 3 games with 3 off-nights beats 4 games with 1 off-night on Week Score (30 against 28) and loses on opportunity (3.75 against 4.25).
- *Category scores recomputed on a rostered pool:* yes (D2). Skater ranks barely move (Spearman 0.996 inside the top 170; biggest move 15 places). The goalie finding is larger and is not about the pool: the SV% category carries about a sixth of the weight of wins or saves.

**Top 5 findings by user impact**

1. **The pickup table's team boost stops working late in the week (C30; M-FSC-042, 019; P0).** Run on the real-week fixture: with every day included the boost spreads teams from 0.75 to 1.25. On the Saturday view one team has no games left, its Week Score is −100, and every other team lands between 1.203 and 1.250. On the Sunday view 18 teams are idle and all 14 playing teams get exactly 1.25. The boost is on by default (`PlayerPickupTable.tsx:1886`) and the Game Grid drops past days automatically (`GameGrid.tsx:528-532`), so this is the normal weekend state, not a rare bye week. Boosted scores can also pass 100 on a percentile scale.
2. **Category value nearly ignores SV% and GAA (C33; M-FSC-013; P0 for category-league draft and projection ranks).** The mean and SD come from every goalie's raw rate, including one-game samples, and then each goalie's rate is shrunk before it is compared with that SD. DB sample (98 goalies, 2025-26 totals): raw SV% SD is 0.036 (0.013 among goalies with 10 or more starts); after the shrink, SV% z-scores run from −0.22 to +0.43 with an SD of 0.15, against 0.62 for wins among the top 36. A recomputation on a 36-goalie pool with SV% as saves above average moves top-36 goalies by 3.2 places on average and up to 10 (Shesterkin 13th to 8th, Dostal 10th to 17th).
3. **The Roster Optimizer's ±20% "sensitivity" check can't disagree with itself in points leagues (M-FSC-004; P1).** Every counting stat in both plans is scaled by the same factor, so the difference between the plans is scaled too and keeps its sign. The label can only read "candidate", "baseline" or "equal", never "sensitive", unless the league scores penalty minutes (which the regex leaves unscaled by accident). Users see a robustness check that always passes. Read, by algebra; not run.
4. **The back-to-back win-odds cut is a 25% multiplier and misses some back-to-backs (M-FSC-021, 018; P2 by size).** A 55% favourite becomes 41%. It only feeds the Week Score matchup nudge, where one such game in a three-game week costs 0.046 points (Run), so the visible effect is tie-breaking among teams with the same games and off-nights. Detection keys on "yesterday's odds exist", so a back-to-back is missed when yesterday's game has no odds row, and always across a Sunday–Monday boundary. The odds themselves are the legacy Game Grid numbers W1-4 D5 and W1-10 D2 already found weak.
5. **Lower-is-better categories are decided by a three-item list, not by the provider (M-FSC-046, 047, 048, 014, 031; P1 where it bites).** Yahoo's `sort_order` is not read, Fantrax has no direction handling, ESPN encodes a mismatch as a −1 weight that other readers reject or ignore, and the Start Chart inverts only goals against. Four different skater-or-goalie key routers exist. The common categories (GAA, GA, L) come out right; faceoffs lost, OT losses and any league-specific reverse category do not.

Not in the top five but worth a decision: FHFH's default points weights are probably not Yahoo's (045, question 2).

## 2. Per-entry table

"Ref" is the standard compared against. YH = Yahoo default scoring and category rules. McG = z-score valuation over the rostered pool with rate stats converted to impact (Art McGee, *How to Value Players for Rotisserie Baseball*). HM = Hungarian method, checked by brute force. BA = `BATCH-A-CONSOLIDATED.md` cross-cutting rule. Int = internal consistency and honest labelling.

| ID | Verdict | Evidence | Ref | Magnitude | Downstream |
|---|---|---|---|---|---|
| 001 Starter Board default points | Sound | `modeling/player_forecasts/daily_board_training.py:17,24-26`; `daily_board_context.py:181-183`; `daily_board_baseline_issuance.py:97,110` | Int | Weights equal the web defaults (`lib/projectionsConfig/fantasyPointsConfig.ts:8-14`); skater-only by design and named DEFAULT | Board training and settlement |
| 002 Joint fantasy samples | Sound | `modeling/player_forecasts/daily_board.py:51-67` | Int | Scores each draw before percentiles, which keeps covariance. Identity checks (SV + GA = SA, G ≤ SOG) are right | Board intervals |
| 003 Paired decision evaluation | Sound (dormant) | `lib/player-forecasts/evaluation.ts:141-176` | Int | No non-test caller. Every weight is applied to every player, so a mixed skater-goalie plan needs zero-filled outcomes or the row is excluded as `missing_outcome`. Opportunity loss is one-sided by definition | None live |
| 004 Plan comparison, ±20% sensitivity | **Mis-specified** | `lib/player-forecasts/planComparison.ts:80-104`, `:149-158`; live at `components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx:772` | Int | D3 | RSO matchup panel |
| 005 Ledger fantasy points | Sound | `lib/player-forecasts/servedForecastLedger.ts:60-72` | W1-6 entry 015 | Weights confirmed there. A custom weight on a stat the ledger doesn't carry (PIM, +/−, SHP, FOW) is ignored rather than nulling the total; only default weights are passed today | Served-forecast ledger |
| 006 Game forecast points | Sound | `lib/rosterScheduleOptimizer/planning.ts:120-176` | Int | Expired forecasts dropped; null on any missing weighted stat | RSO cards |
| 007 Swap category breakdown | Sound | `planning.ts:198-250` | Int | Gains and sacrifices are sums of per-player net changes; ratios shown as components, never blended | RSO swap explanation |
| 008 Candidate horizon and active points | Sound (dormant) | `planning.ts:253-299`, `:1580-1582` | Int | `candidateMetrics` has no importer | None live |
| 009 Per-game play value | **Mis-specified** | `planning.ts:301-322` | McG | Points mode is a correct weighted sum. Category mode returns 0 for every play, so start/sit in category leagues is schedule capacity only. Owned by W1-11 entry 008 | RSO lineups in category leagues |
| 010 Category values and matchup result | Sound | `planning.ts:60-90` | YH (pooled ratios) | Ratios are pooled numerator over denominator, which is how Yahoo scores GAA and SV%. Win/loss compares means and says so | RSO matchup |
| 011 Recent form totals | **Mis-specified** | `lib/rosterScheduleOptimizer/recentForm.ts:25-66` | OD 2; Tango shrinkage | Arithmetic is right. One game weighs the same as ten; `LOSSES_GOALIE` excludes OT losses. Owned by W1-11 D1 | Streaming rank, autopsy |
| 012 Legacy points analysis script | **Mis-specified** | `scripts/fantasy_points_analysis.py:53-66`, `:177-232` | Int | Scores both `sh_goals` and `sh_points`, so a shorthanded goal earns 3 + 1 + 1. Hard-coded season. Offline script, no reader | None |
| 013 Category z-score value | **Wrong** | `lib/scoring/categoryScores.ts:98-118`, `:67-82`, `:124-136`; test `categoryScores.test.ts:6-41` | McG | D2 | Fantasy Projections page, Draft Dashboard values, Draft Pro category fit |
| 014 Start Chart today value and lineup | **Mis-specified** | `lib/projections/weightedAssignment.ts:2-42`; `starterBoardPersonalization.ts:38-110`; `lib/integrations/yahoo/starterBoard.ts:139-145`, `:239-245` | HM; YH | Assignment is exact: 4,000 random instances matched exhaustive search, including negative values (Run). Key routing is by `_GOALIE` suffix only, so `GAMES_STARTED`, `SAVE_PERCENTAGE` and `GOALS_AGAINST_AVERAGE` weights land on skaters and null every skater's points. It fails closed with a limitation message. Category mode inverts only goals against | Yahoo Start Chart |
| 015 Ownership and ADP trend | **Mis-specified** | `pages/api/v1/transactions/ownership-trends.ts:181-198`, `:438-460` | Int | Ownership compares the latest point with "today minus N", so a stale timeline compares two old values over a shorter span than labelled. ADP anchors on the latest point. `deltaPct` holds percentage points for ownership and percent change for ADP | Risers and fallers |
| 016 Roster Autopsy retained points | Sound | `lib/rosterAutopsy/manual.ts:216-221` | Int | Delegates to 011 and is labelled a historical hint | Autopsy |
| 017 Selected-period opponent point % | **Wrong** (no reader) | `components/GameGrid/GameGrid.tsx:540-549` | BA 5 | No known opponents becomes 0 (reads as the weakest schedule) and partial coverage is averaged. The value is passed to the pickup table, which declares it (`PlayerPickupTable.tsx:322`) and never reads it. The correct helper `getOpponentPointPct` (`utils/scheduleSummary.ts:7-18`) has no caller | None today |
| 018 Week Score matchup bonus | **Mis-specified** | `utils/calcWeekScore.ts:27-42` | Int | Bounded ±0.5 and labelled interim. Inputs are the legacy odds (W1-4 D5) after the 021 cut. It decides order inside groups of teams with equal games and off-nights (six teams tied at 4 games, 2 off-nights in the fixture) | Game Grid rank, RSO team context |
| 019 Week Score | **Mis-specified** | `utils/calcWeekScore.ts:54-77`; `utils/scheduleSummary.ts:58-88` | Int | Formula matches its written intent (note A). `/16` assumes 32 teams. The −100 marker is a number in the score field: D1 | Game Grid, pickup boost, RSO, social share |
| 020 Slate crowding | Sound | `utils/calcWeekScore.ts:6-24` | Int | ±0.25 for the whole horizon, neutral when coverage is incomplete. Overlaps the off-night term in concept; too small to matter | Week Score |
| 021 Win odds with back-to-back cut | **Wrong** | `utils/calcWinOdds.ts:6-18`, `:53-77` | Int; W1-10 note | D4 | Matchup bonus only (displayed odds are unadjusted: `TeamRow.tsx:341-342`) |
| 022 Tertile bands and rank maps | Sound | `utils/fourWeekMetricBands.ts:4-21`; `utils/metricRanks.ts:4-24` | Int | 32 distinct values split 11 / 10 / 11; ties share a band and a competition rank | Four-week and opponent tables |
| 023 Team games and off-night counts | Sound | `utils/helper.ts:12-56`, `:116-128` | Int | Regular-season only, postponed and cancelled excluded, one count per game id. Today's finished games still count until the day rolls over | Everything schedule-based |
| 024 Weighted off-nights | **Mis-specified** | `utils/helper.ts:71-113`; `lib/socialShare/schedule.ts:100-108` | Int | A third off-night valuation built on a legacy constant, (9 − 7)/7. Stored on social-share rows; I found no renderer | None found |
| 025 Poisson matrix "tie-breaker" | **Wrong** | `utils/poissonHelpers.ts:45-61` | Poisson | The redistribution writes each draw cell back unchanged (the two ratios sum to 1). Display is unaffected. Truncation at 10 goals is negligible. Owned by W1-10 entry 016 | Heat map |
| 026 Opponent atk/def percentile | Sound | `utils/scheduleOpportunity.ts:12-38` | Int | Mid-rank percentile over teams with complete coverage; labelled a provisional observed percentile. No early-season shrinkage | Opponent meters |
| 027 Four-week opportunity score | **Mis-specified** | `utils/scheduleOpportunity.ts:71-138` | Int | Arithmetic and coverage rules are right. The off-night weight (0.25 of a game) contradicts Week Score's (0.67 of a game) on the same page: D5 | Four-week grid |
| 028 Four-week averages and OPP score | **Mis-specified** (dormant) | `utils/scheduleSummary.ts:21-42` | Int | Averages are sound. `getFourWeekScore` adds a 0–1 point-percentage gap to game counts, so the opponent term is about a hundredth of a game. Fixture only (`e2e/fixtures/opponent-four-week-metrics/App.tsx:40`) | None live |
| 029 Team-vs-player reconciliation | Sound (dormant) | `utils/teamForecasts.ts:175-224`; `utils/teamGameExpectations.ts:54-92` | Int | No production caller | None live |
| 030 Team forecast category subtotal | Sound | `components/GameGrid/TeamDetails.tsx:119-150` | Int | Sums the rounded per-game values on purpose so cards and totals agree; error at most 0.05 per game. Refuses mixed vintages | Team details |
| 031 Stat applicability | **Mis-specified** | `planning.ts:91-104` | Int | Fourth copy of the skater-or-goalie rule. `GOALS_AGAINST_AVERAGE` and `OTL_GOALIE` are missing from the fixed set and fall to "whoever's forecasts carry the key": D6 | RSO scoring |
| 032 Sandbox fantasy score | Sound | `pages/trendsSandbox.tsx:200-207`, `:2006-2012` | Int | A copy of the defaults with the same values; ignores league settings | Sandbox chart |
| 033 True Goalie Value defaults | Sound | `pages/trueGoalieValue.tsx:104-109` | Int | A copy of the goalie defaults with the same values | Legacy goalie page |
| 034 Edge snapshot freshness gate | Sound (dormant) | `lib/NHL/edgeFeatureContract.ts:245-262` | Int | No production caller | None live |
| 035 Schedule game type and daily counts | Sound | `lib/NHL/server/index.ts:530` | NHL game id format | Type = digits 5–6 of the id. Raw `numGamesPerDay` includes other game types, but the Game Grid feeds its totals row and scores from the regular-season recount (`GameGrid.tsx:277-279`, `:982`, `:1496`) | Game Grid |
| 036 Goalie minimum games | Sound | `lib/NHL/statsPageFetch.ts:239-250` | Int | A quarter of average team games once that average passes 10; no minimum before then | Stats page |
| 037 TOI share and team PP time | **Wrong** (dead) | `lib/NHL/TOI.ts:31-50`, `:82-110` | Int | Team PP time is the roster's PP TOI divided by 5 whatever the manpower; TOI% divides by 60. It calls the retired stats API and has no caller | None |
| 038 Ownership freshness filter | Sound | `PlayerPickupTable.tsx:171-228` | BA 5 | Stale or undated ownership becomes unknown, not a number | Pickup table |
| 039 Pickup GP% | **Mis-specified** | `PlayerPickupTable.tsx:2464-2494` | OD 16 | Player games across all teams over the current team's games, clamped to 1. Wrong for traded players in either direction | Pickup percentile |
| 040 Pickup metric percentiles | **Mis-specified** | `PlayerPickupTable.tsx:2546-2640`, `:111-134` | Int | Season totals, so volume dominates. The pool is the filtered list, so changing the ownership slider changes every score. Shots against is ranked higher-is-better. A missing stat shows percentile 0 (it is left out of the average) | BPA ranking |
| 041 Pickup composite score | **Mis-specified** | `PlayerPickupTable.tsx:2627`, `:2654-2752` | Int | Equal weight per metric whatever the league scores; GP% counts as a metric; points, goals and assists are three of ten. Single-metric mode shows the mean of the *other* metrics while sorting by the chosen one | BPA ranking |
| 042 Pickup team boost | **Wrong** | `PlayerPickupTable.tsx:2755-2799`, `:1886` | Int | D1 | BPA ranking, default on |
| 043 Yahoo credited goalie appearances | Sound | `lib/integrations/yahoo/rosterPlanning.ts:104-135` | YH | Counts appearances in an active G slot and returns unknown on any gap. The setting is Yahoo's `min_games_played`; the variable is named `minimumGoalieStarts` (`liveDraft.ts:519-525`) | RSO goalie minimum |
| 044 Yahoo past-lineup points | Sound | `rosterPlanning.ts:43-96` | Int | Weighted sum of the night's actual stats; null unless the game is final and rows have landed. A traded player is looked up against his current team's schedule | RSO banked points |
| 045 Default points and category weights | Undetermined | `lib/projectionsConfig/fantasyPointsConfig.ts:8-30`; `lib/user-settings/defaults.ts:41-51`, `:80-92`; `lib/user-settings/mappers.ts:16-35`, `:118-138` | YH | Question 2. All copies agree with each other (001, 005, 032, 033). Manual settings are merged over the defaults, so a category a user deleted comes back unless it is stored as 0; provider mappings are kept exact | Every default-scored surface |
| 046 ESPN scoring mapping | **Mis-specified** | `lib/integrations/espn/normalize.ts:52-56`, `:270-278` | Int | D6 | Draft tools for ESPN category leagues |
| 047 Fantrax scoring mapping | **Mis-specified** | `lib/integrations/fantrax/normalize.ts:611-641` | Int | D6 | Draft tools for Fantrax leagues |
| 048 Yahoo scoring adaptation | **Mis-specified** | `lib/integrations/yahoo/liveDraft.ts:449-498` | YH `sort_order` | D6 | Draft tools, Start Chart, RSO |
| 049 Date-range grid counts | **Mis-specified** | `components/GameGrid/DateRangeTeamGrid.tsx:50-61`, `:123-131` | Int | Off-nights count regular-season games only; back-to-backs and home/away count any game type. They differ only in ranges that include preseason | Date-range grid |
| 050 League daily totals row | Sound | `components/GameGrid/TotalGamesPerDayRow.tsx:90-125` | Int | Fed the regular-season counts. Shares the name `calcTotalOffNights` with `utils/helper.ts:39`, which counts something else (team games, not league days) | Header row |
| 051 Opponent category effect map | Sound | `utils/opponentCategoryEffects.ts:30-70` | Int | Signs are defensible, conflicts are left uncoloured, and categories with no qualified input stay empty. The two guard functions have no caller | Opponent table colours |
| 052 Four-week per-week Week Score | **Mis-specified** (dormant) | `utils/useFourWeekSchedule.ts:109-111`, `:146-149` | Int | Computed with no odds and no coverage, so it is 6 × (GP − avg) + 4 × ON under the same name. Nothing reads it; the four-week grid shows the opportunity score | None live |
| 053 Opponent metric averages | Sound | `utils/useOpponentMetricsData.ts:77-141` | Int | Per-game means over scheduled opponents, null unless every opponent is known. All-situations season totals. The field `avgWinPct` holds points percentage and is labelled PTS% on screen | Opponent table |

### Note A: Week Score against its written intent

Intent, from the code comment and the help popover: rank teams by games, then off-night games, with a matchup nudge (±0.5) and a light-slate nudge (±0.25) that together (1.5 points of swing) can't overturn the 2-point edge of 4 games/1 off-night over 3 games/2 off-nights.

Run on `e2e/fixtures/game-grid-previews/real-week-32.ts` (32 teams, 52 games, nightly slate 5/9/2/14/1/14/7, no odds):
- Scores run from −7.7 to +12.5. Six teams with 4 games and 2 off-nights score 12.4–12.5; 4 games and 1 off-night score 8.4.
- The ordering is exactly games-then-off-nights, with crowding breaking ties by at most 0.1.
- Against the four-week opportunity formula (GP + 0.25 × ON) on the same week: Spearman 0.990, no discordant pairs. The two definitions agree here.

The weights are a judgement, not a fit. An off-night game is worth 10 and a busy-night game 6, a ratio of 1.67. That is plausible if a streamer fits a lineup nearly always on an off-night and about 60% of the time on a busy night, but nobody has measured it. The Roster Optimizer's lineup-fit results could calibrate it.

## 3. Defects

### D1 · Pickup team boost reads the −100 marker as a score · P0 (M-FSC-042, 019; C30 confirmed)
- **What.** `calcWeekScore` returns −100 for a team with no included games (`calcWeekScore.ts:62`). The pickup table min-max scales every team's Week Score with no filter (`PlayerPickupTable.tsx:2758-2779`) and multiplies player scores by 0.75–1.25 (`:2793-2797`).
- **Size (Run, real-week fixture).** Days fully included, Monday to Friday views: no idle team, spread 0.75–1.25 as designed. Saturday view: 1 idle team, playing teams 1.203–1.250 (spread 0.047 instead of 0.5). Sunday view: 18 idle teams, all 14 playing teams exactly 1.25. So the boost carries no schedule information on the days most people stream for the weekend, and it is the default.
- **Also.** A boosted percentile can exceed 100. In "none" mode the sort value −1 is multiplied too, which reorders players who have no score.
- **Fix.** Return `null` (or a typed "no games" result) instead of −100, and update each reader: Game Grid rank sort (`GameGrid.tsx:418`), desktop and transposed tables, team row, RSO team context, social share, pickup boost. In the boost, scale over teams that have games and give idle teams an explicit rule (the owner picks: the floor multiplier, or hide them). Cap or relabel the boosted score.
- **Test.** With one idle team in the input, the multipliers of the other teams equal those computed without it. No reader compares a score with −100.

### D2 · Category z-scores mute goalie rate categories; pool and volume are non-standard · P0 for goalie ranks in category leagues (M-FSC-013; C33 confirmed and re-sized)
- **What.**
  1. Mean and SD are taken over every goalie's raw rate, unweighted, including tiny samples (`categoryScores.ts:98-118`). Each goalie's rate is then shrunk toward that mean (`:67-82`) and divided by the unshrunk SD (`:128-134`). The numerator shrinks and the denominator doesn't.
  2. The mean is an unweighted mean of rates, not the pooled rate.
  3. The pool is every player passed in, not the players a league would roster. The test pins this as the contract ("uses full-pool role-specific sample standard deviations").
  4. Rates are not converted to impact (rate above average × volume). The shrink acts as a partial volume weight only.
  5. `OTL_GOALIE` is not inverted while `LOSSES_GOALIE` is. Whether an OT loss is good or bad depends on the league (question 3).
- **Size (DB sample, 2026-11-11; last season's actual totals as a stand-in for projections).**
  - Goalies, 98 with a shot faced in 2025-26: unweighted mean SV% .8889 against pooled .8958; SD .0359 (.0133 among the 71 with 10+ starts). Under the code's method SV% z-scores span −0.22 to +0.43 (SD 0.15). Wins z-scores among the top 36 by starts have SD 0.62. So SV% moves a goalie's total about a quarter as much as wins does, and a sixth of what a category "should" (SD near 1 in the rostered pool).
  - Recomputed on a 36-goalie pool (top 36 by starts) with SV% as (SV% − pool SV%) × shots against, z-scored on that pool: Spearman 0.954 with the current ranks; mean move 3.2 places, largest 10; one swap in the top 12. Movers: Lankinen (.875) 37th to 47th, Bobrovsky (.877) 22nd to 31st, Dostal (.888) 10th to 17th, Shesterkin (.912) 13th to 8th.
  - Skaters, 951 in `wgo_skater_stats_totals_ly` (which holds 2022-23, despite the name), six default categories, pool = top 170 by the current score: Spearman 0.996 inside the top 170; mean move 2.9 places, largest 15; 3 swaps in the top 50 and 1 in the top 100; defencemen in the top 100 unchanged at 25. The pool changes the category balance (PPP's SD goes from 9.1 to 11.3, shots from 75 to 59) but not much of the order.
  - So the triage's "deep pools compress the gaps" is true and small for skaters. The goalie rate handling is the part that changes ranks.
- **Who is affected.** Category-league value on the Fantasy Projections page (`pages/fantasy-projections.tsx:1057-1068`), Draft Dashboard values (`lib/draftDashboard/playerValues.ts:85`, which then feeds replacement levels and tiers) and Draft Pro category fit (`lib/draft-pro/recommendations.ts:164-168`).
- **Fix.**
  1. Define the pool from league settings (teams × roster slots by role, plus a bench share), iterate once or twice until the pool is stable, and take mean and SD there.
  2. For SV% and GAA use impact: (rate − pool rate) × volume, with the pool rate pooled from components, then z-score the impact. Drop the separate shrink for projections, which are already regressed, or apply it before the SD is taken.
  3. Decide OTL direction per league from the provider (D6).
- **Test.** Property tests rather than fixed numbers: the SD of each category's z-score inside the pool is 1; adding a 1-start goalie with a .500 SV% to the input changes no rostered goalie's score; two goalies with the same SV% and different workloads are ordered by workload when above average and the reverse when below.
- **Evidence limits.** Actual totals, not projections; one season each; pool chosen by starts. Treat the rank moves as an indication.

### D3 · ±20% sensitivity can't change sign in points leagues · P1 (M-FSC-004)
- **What.** `comparePlanSensitivity` scales every counting stat of every game in both plans by 0.8, 1 and 1.2 (`planComparison.ts:149-158`). Points are linear, and the banked part is common to both plans, so candidate − baseline at factor f is f × (candidate − baseline). The direction is the same at all three factors. Keys matching `MINUTES` are left unscaled, which includes `PENALTY_MINUTES`, a counting stat; only a PIM-weighted league can ever read "sensitive".
- **Size.** Structural: the points-league result is always the sign of the mean difference. In category leagues the check is informative only because the opponent's totals are held fixed while yours scale.
- **Fix.** Stress the things that differ between plans: scale only the added players' lines, or only goalie starts, or apply per-player draws from the forecast spread when one exists. Match excluded keys exactly (`TIME_ON_ICE_PER_GAME`, ratio keys) instead of by substring.
- **Test.** A points-league fixture where the candidate wins on means by less than 20% of the added player's contribution must read "sensitive". PIM is scaled.

### D4 · Back-to-back cut: size and detection · P2 (M-FSC-021; C31 confirmed)
- **What.**
  - `winOdds * 0.75` on the second night (`calcWinOdds.ts:57-59`): 55% becomes 41.25%, and the two sides of a game no longer sum to 100. The opponent's own back-to-back is ignored. Estimates I know of put the rest effect at a few percentage points; I did not fetch a source, so treat that as a recollection. W1-10 reached the same view.
  - `isBackToBack` tests whether yesterday's *odds* are non-null (`:69-77`), so a real back-to-back is missed when yesterday's game has no odds row, and Monday can never be a second night because Sunday is outside the row.
  - `calculateBlendedWinOdds` returns the model odds on both branches (`:6-18`). W1-10 found 0 of 274 rows this season carry API odds, so nothing is lost today.
- **Size (Run).** Three games at 55%: bonus +0.050; with one cut game +0.004. The largest possible effect of one cut game is 0.25 × odds ÷ games, about 0.05 in a three-game week, against a 4-point off-night. In the fixture 16 of 104 team-games are second nights.
- **Fix.** Detect back-to-backs from the schedule (game on the previous calendar date, including the day before the window). Replace the multiplier with an additive adjustment in probability, applied to both sides and net of the opponent's rest, with a value fitted on past seasons. Or drop it until the Game Grid odds are repaired (W1-4 direction: fix or withhold). Remove the no-op blend or implement it with de-vigged market odds.
- **Test.** A game with odds following a game without odds is still a second night. Adjusted home and away probabilities sum to 100.

### D5 · Four valuations of an off-night · P1, owner decision (M-FSC-019, 024, 027, 028, 052)
- **What.** Section 1. One threshold, four weights, two of them on the same page under different names (Week Score and the four-week Score).
- **Size.** Same order on the fixture week. Different order whenever a team trades a game for two extra off-nights.
- **Fix.** Pick one ratio for "an off-night game relative to a busy-night game" and express every score with it. Keep the threshold in one exported constant (it is written out in at least nine files, among them `utils/helper.ts:52`, `utils/scheduleOpportunity.ts:102`, `utils/useDateRangeTeamGrid.ts:23`, `TotalGamesPerDayRow.tsx:121`, `DateRangeTeamGrid.tsx:126`, `lib/socialShare/schedule.ts:72`, `lib/draftDashboard/scheduleMetrics.ts:50`). Retire `calcWeightedOffNights` and `getFourWeekScore` once their dependencies are inventoried (BA 6).
- **Test.** One table of (games, off-nights) pairs ranked identically by every schedule score.

### D6 · Category direction and skater-or-goalie routing are decided in several places · P1 (M-FSC-014, 031, 046, 047, 048)
- **What.**
  - Direction. `isInvertedCategory` lists GAA, goals against and losses (`categoryScores.ts:35-41`). Yahoo's `sort_order` is not read (`liveDraft.ts:449-498`), so a Yahoo league scoring faceoffs lost (mapped at `:291`) treats more as better. Fantrax takes no direction (`fantrax/normalize.ts:619`). ESPN writes −1 when its flag disagrees with the list (`espn/normalize.ts:270-278`). That works in `calculateCategoryScores`, but `lib/draftDashboard/categoryStandings.ts:100` treats a negative weight as unavailable, `lib/draftDashboard/settingsValidation.ts:227` rejects it, `lib/draft-pro/recommendations.ts:133` takes its absolute value, and `lib/draft-pro/reports.ts:58` looks only at the list. The Start Chart inverts only goals against (`starterBoard.ts:242`; `starterBoardScoring.ts:256`).
  - Routing. Four rules: `isGoalieCategory` (`categoryScores.ts:20-33`), `GOALIE_STATS` plus a data-driven fallback (`planning.ts:91-104`), `isGoalieStat` (`recentForm.ts:14`; `rosterPlanning.ts:36`), and "ends with `_GOALIE`" (`starterBoard.ts:244`). They disagree on `GAMES_STARTED`, `SAVE_PERCENTAGE`, `GOALS_AGAINST_AVERAGE` and `OTL_GOALIE`.
- **Size.** The common setups are right. The Start Chart case fails closed (all skaters lose their value and a limitation shows). The direction cases give a wrong sign for the affected category only. Not measured on real leagues.
- **Fix.** One stat registry: key, role, direction, counting or ratio, components. Carry direction as its own field from the provider (Yahoo `sort_order`, ESPN `isReverseItem`) and never in the weight's sign. Every reader takes role and direction from the registry (BA 4: list the readers and test each).
- **Test.** For every key in the provider maps, all readers return the same role and direction. A Yahoo fixture with a lower-is-better skater category ranks fewer as better.

### D7 · Smaller items · P2
- **017 Opponent point % default.** Use `getOpponentPointPct` (null unless complete) or delete the unused field. Test: unknown opponents give null, not 0.
- **015 Ownership trend.** Anchor both metrics on the latest point, refuse a latest point older than the pickup table's 3-day rule, and rename `deltaPct` or make it a percent change. Test: a timeline whose last point is 10 days old returns no 5-day movement.
- **039–041 Pickup scores.** Per-game or per-60 inputs, a fixed reference pool, weights from the user's league, GP% as a filter not a metric, shots against dropped or neutral. Follow owner decision 16 for games available. This is a redesign, not a patch; the page should say the score is a percentile blend until then.
- **049 Date-range back-to-backs.** Apply the regular-season filter used for off-nights.
- **052, 024, 028, 008, 003, 029, 034, 037 Dormant code.** Inventory and retire, or mark as unused. `lib/NHL/TOI.ts` calls an API that no longer exists.
- **012 Legacy script.** Remove the `sh_goals` weight or the `sh_points` weight if the script is ever reused.
- **045 Settings merge.** Decide whether a manual user who removes a category should get it back from the defaults.

## 4. Questions for the owner

1. **Off-night value.** What is one off-night game worth next to a busy-night game: 1.67× (Week Score), 1.25× (four-week Score), or a ratio measured from the Roster Optimizer's lineup fits? One answer, used everywhere.
2. **Default points weights.** Are the defaults (G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25; W 4, GA −1, SV 0.2, SO 3) meant to be Yahoo's defaults or FHFH's own? From memory Yahoo's public default is on a different scale and includes plus/minus, so I think they are not Yahoo's, but I did not fetch Yahoo's page. If they are FHFH's own, the label should say "FHFH default".
3. **OT losses in category value.** Good (a point earned), bad (a loss), or taken from each league's own setting?
4. **Idle teams in the pickup boost.** When a team has no games left in the window, should its players be pushed down (0.75×), hidden, or left unboosted?
5. **Category leagues in the Roster Optimizer.** Every play is worth 0 there today (009; W1-11 entry 008). Is a z-score or standings-gain value wanted, once D2 is fixed?

## 5. Limits

- **Not run end to end.** D3 is an algebraic reading of `planComparison.ts`; I did not build a planning snapshot to execute it. D6's wrong-sign cases are read from code, not reproduced on a real league payload.
- **No provider or NHL calls.** Yahoo's default scoring, `sort_order` values and the goalie-minimum rule were not fetched. ESPN's direction for OT losses is unknown to me.
- **Category recomputation uses actual season totals** (skaters 2022-23, goalies 2025-26), not the projections the pages feed in. Projected pools have less small-sample noise, so the goalie SD inflation may be smaller there; the shrink-against-unshrunk-SD mismatch is in the code regardless.
- **One fixture week.** The Week Score and boost numbers come from `real-week-32.ts` with no odds. Other weeks will differ in detail; the weekend collapse of the boost needs only one idle team.
- **Back-to-back effect size** is from recollection, not a cited study.
- **Upstream dependencies not re-audited:** Game Grid odds (W1-4 D5, W1-10 D2), recent form in the streaming rank (W1-11 D1), default weights in FORGE accuracy (W1-6 entry 015).
- **Scripts** (outside the repo, in the session scratchpad; not kept): a brute-force check of `weightedAssignment` on 4,000 random instances, and a replay of `calcWeekScore` over the real-week fixture for each first included day. Two aggregate SQL reads (one per table) produced the D2 numbers; no rows were exported.
- Line numbers are from `37106e4ab`.
