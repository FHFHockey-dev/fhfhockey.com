# Original Base Prompt:

````
For my website, I have an idea for a webpage and new database. I would like to brainstorm with you to cover:

- any gaps in my vision that i might have missed
- potential features that would provide value to the end user
- prerequisites needed to accomplish these tasks
- considerations for optimizing the data pipeline
- Making sense of my haphazard notes and scattered ideas jotted down into a coherent game-plan PRD style prompt for Codex. 
- more

Here is what I have scribbled:

A page for displaying player rankings in a variety of metrics, optionally filtered by timeframe ( Last 5 GP, 10GP, 20GP etc.) or by deployment*.

* Deployment will be calculated by using our `lineCombinations` supabase table, and averaging out the Time on Ice per game of players in each of the following buckets:

- Forwards: 1st Liners (L1), 2nd Liners (L2), L3, L4
- Defensemen: 1st Pairing defensemen (P1), P2, P3

Once skaters are separated into their respective bucket, calculations will be made to find a players raw rank, and percentile rank inside their own respective bucket. Defenseman and Forwards should be separated for a lot of the rankings and percentiles.

Raw rank and Percentile will also be applicable for: Season to date data and the option for a minimum GP filter. Raw rank and percentiles will be calculated for each metric individually, so we can see: “This skater is 23rd amongst his peers of 2nd line forwards for SOG/60, and in the 84th percentile for SOG/60 amongst 2nd line forwards.” The same calculation for the other metrics we choose, that have not been finalized yet. 

We will also define an overall Offense and Defense rating for each player, again one O rating and one D rating for the local deployment bucket, one for overall, and recalculating anytime a timeframe filter is applied or another filter is applied. 

For Skaters: A novel metric, which we should formulate, inspired by the "BSH" metric, which stands for Blocks, Shots and Hits - which arbitrarily works to rank skaters in fantasy hockey for the purpose of finding "bangers" which are useful in categories leagues when you need peripheral stats outside of offensive stats. Our novel metric should be percentile based, and an average of the categories. We are going to come up with a name, but I like MCM for multi-cat-monster, we could also toss around naming conventions like "BEAST" which could be an acronym for something, "Bangs Everything And Shoots Too"? I don't know. It's quirky and fun. My thoughts behind this new novel metric will be to highlight players who excel in at the very least 2 of the 3 peripheral categories, Blocks, Hits, Shots, but also excel in at least 1 of the other scoring categories: Goals, Assists, Points and/or Power Play Points. 

There should be Tiers to this new metric for example, a "BEAST" could be someone who excels in 2/3 peripheral cats (nicknamed "Riffs" for pe**riph**eral", and then 1/4 of the other categories. Maybe "BEAST+" is 2/3 riffs and 2 of the scoring cats, or all 3 riffs and 1/4 scoring - as long as 4/7 cats are flagged as Good, Great, Dominant or Elite - I suppose we will need tiers to the percentile ranks - like 50-60th percentile = good, 61-70 = Great, and so on. 

- Another skater-specific metric should be, are they "Shoot-First"? Do they have a large percentage of the on-ice shot attempts for while they are on the ice. 
- Is the player Pass first? Do they have a lot of Primary Assists, and does their Assists total equate for more than 70% (arbitrary example number, another number may work better) of their points total? 
- xS% or Expected Shooting Percentage. ` xG / Shots `
- SAX% = Shooting Percentage Above Expected = differential of some sort of xS% and true S%
- Unexpected Goals = xG - Goals
- a "Play Driver" would be someone who's Primary Assists and Goals account for a vast majority of their point totals. This would indicate that this player directly contributes to their line / teams' success. 
- Another attribute of a play driver is someone who carries the team. Relative 5v5 GF%, which is `Personal GF% - Team GF% **ONLY** when player is not on the ice. Highlighting the difference-making ability of this player to single-handedly improve the team's offense. The inverse is also true, an "Albatross" or a player who is carried by their team, dragging their team down would be someone who's Rel5v5GF% is negative
- What is a players "Luck Score"? 

```
oi = on ice, av = league average by position - Forward or defenseman, i: denotes time period and strength state (ev, 5v5, pk, pp, etc)

Results-i = (oiGFPer60-i / oixGFPer60-i)+(PointsPer60-i / oiGFPer60-i) + (oiSH%-i / av oiSH%-i)

Luck Score = (Results-current-EV / Results-past240games-EV) + (Results-current-PP / Results-past240Games-PP)
```
The philosophy behind luck score is simple - produce a single number that can evaluate whether a player's production in a small sample is indicative of what we can expect their production to be over a larger sample. Long-time followers may remember my luck score equations/approaches from past seasons - this season's approach builds off those and (l believe) improves them considerably. The major difference this year being the inclusion of a player specific 'Results Baseline'.
A skater's baseline results at even strength and on the powerplay are calculated from the results equation above using the players' most recent 3 seasons of data (current season data is included in this baseline, and as the season progresses less data from 3 years ago is used). The current season results use the same equation, but only data from this year is used. Then, luck score is calculated by taking the ratio of current results to baseline results at both strength states and summing them. Thus, a player getting the same results they usually get will have a score around 2, while a player getting more luck will be over 2 and a player getting less luck will be below 2.

The Results equation terms:
GF/×GF - the ratio of a players on-ice actual goals to on-ice expected goals. Over larger sample sizes players who are more skilled (at passing, finishing, etc.) will have higher values of this.
Points/GF - individual points percentage (IPP). It measures the fraction of the goals a player is on the ice for that they get a point on. High end players max out at an IPP around 80% over large samples.
oiSH%/av-oiSH% - the ratio of on-ice shooting percentage to league average on ice shooting percentage. This is like the GF/xGF ratio - highly skilled players will have higher values of this ratio over large samples.

//

For Goalies, "deployment" will be defined a little differently. 

For example, let’s take a hypothetical scenario where the Boston Bruins are 50 games into their season. Their two goalies are: Jeremy Swayman and Joonas Korpisalo. Hypothetically, Swayman has played/started 32/50 games and Korpisalo has played the remaining 18/50 games. The “Netshare %” (net%) is 64:36 in Swayman’s majority. Swayman would be defined as the starter, and Korpisalo would be defined as the backup. 

Different tiers would exist for Goalies net% to segregate them into their respective buckets:

- Netshare % of >= 65% = G1 - Workhorse
- 55%-64.9% = G1 - Starter
- 50-54.9% = G1A - Tandem
- 45-49.9% = G1B - Tandem (Tandem is only applicable if the same team has two goalies with 40% or more share of starts. 
- 40-44.9% = G2 - “Busy” Backup
- 35-39.9% = G2 - Backup
- <=34.9% = G2 - Shelf Backup

Open to renaming the buckets or redefining the percentage thresholds for those buckets. 

There will be instances of a third or fourth goalie being in the array of “active goalies” for any given team. Sometimes with injuries and callups a third or fourth is necessary. We should have deductive logic in place to recognize these third and fourth string placeholder goaltenders, and then be able to define G1 and G2 percentages and their bucket assignments based on the G1 GP + G2 GP total rather than total team games. 

Example: Boston again, 50 games in.

Swayman: 26/50
Korpisalo: 15/50
Michael DiPietro: 9/50

Swayman played 52%, Korpi 30% and Dipietro 18%. If Swayman or Korpi did not play AT ALL during the window of DiPietro’s first game until their most recent game, it’s safe to assume this was an injury related call-up. Therefore, Swayman’s bucket percentage assignment should reflect 26/41 which I believe is 63.5%, and Korpisalo at 15/41 or 36.5%, removing the necessity of the DiPietro stint from the equation reflects the true nature of how the coach views his #1 and 2 goalies.

Other metrics needed:
- xGA per Shot Against
- MVP type metric, where a goalies relative sv% ( ` personal save percentage - team sv% excluding said goalie `)  breaches a certain threshold. 
- Quality Start percentage, games with a save percentage above league average
- Really Bad Starts
- Tap into the `/trueGoalieValue` page to find other metrics and insights we can bring into the Goalie ecosystem for this new page. 
- "Stealing" a game. Steal Games: One conceptual metric is the "steal," which can be defined as games where the goalie's GSAx exceeds the goal differential (meaning he essentially was the difference in a win. a If a team wins 3-2 but their goalie faced enough quality to expect 4 or 5 goals against, that goalie stole the game. If a goalie has multiple obvious "steal" performances in a short time span, he's on a special run. Advanced metrics will reflect this (big positive single-game GSAx values). Some analysts track "Steal %" - what portion of a goalie's wins are largely attributable to him. A flurry of steals = hot streak.
- "Under Pressure" Goalies: High GSAA but slightly lower HDSV% (top-left quadrant) - they perform well above average overall (good GSAA) but show some vulnerability on the toughest shots. This might indicate strong fundamental goaltending with only occasional lapses against prime chances.

For team style (or “coaching style” we could say): 

- in the ‘/shiftcharts’ ecosystem we have logic defined to assign players to a power play unit based on how much PPTOI they had as a percentage of that team’s total PPTOI available per game. We then know how much % of the PP that the top power play unit receives, and how much the second power play unit receives. 
- We also can find out if a coach “rolls his lines” so the avg time on ice for all Line 1 players as a percentage of total team game time, Line 2, 3 and 4 — if those percentages are close, this coach likes to “roll his lines”. If Line 1 receives a noticeable percentage more than line 2, and then line 2 is significantly or relatively higher than 3 and 3 is more than 4, this coach “Top Loads” his offense. Same for defensive pairings, if he rides his first pairing hard, or rolls pairings; we could define that. 
- We could use the shot coordinate locations to determine where the coach likes to defer their offense to: do they prefer the perimeter, the slot, the circles — is the coach a “shot quantity” or “shot quality” type of coach. We could find the amount of shots that miss the net, we could find a higher number of total shots, or a lower efficacy of goals or team shooting percentage which would imply the coach wants to pepper the opposing goalie. Or do they coach to pick your shots, lower shot totals but higher shooting percentage. Could be defined as: `100*(xGF/CF)`
- Are they a “lucky” team? `(Goals for/xGoals For) + (goals against/xGoals against)`
- Are they “run and gun”? `(xGF+xGA)-(absolute value of their difference)`
- Does a team rely on their PP, are they “PP Merchants” - higher percentage of PPG out of the total number of team goals.
- Do they play high event or low event hockey: `xGF + xGA`
- Do they play in a lot of 1 goal games? Winning or losing by 1 goal. Do they win/lose by more than 1 goal often? Or go to overtime a lot.
- Do they have a significantly better record at home or on the road?
- Do they play better/worse when they have 1 day of rest, 2 days, 3 days, 4+?
- Percentile or raw ranks of the team in: shots for, shots against, pp%, pk%, shooting percentage, team save percentage, blocked shots, hits, 
- Do their defenseman score a lot of goals?
- Is the team disciplined? `Net penalties taken vs penalties drawn`
- Do they capitalize shorthanded?
- Do they capitalize on mistakes? (Using play by play data, a takeaway or opposing giveaway followed shortly after by a goal or a “flurry” of shots. 
- Do they score more/less than the avg team, in the first/2nd/3rd period?
- Do they control play? CF%, xGF% and offensive zone time percentage. 
- Are they a physical team? `Hits + Hits Taken + Blocks + Penalties + Penalties Drawn`

I’m sure there are more, but this is already an extensive list for all of Skaters, Goalies and Teams. I would like to brainstorm this with you, where are my gaps? What could I add, What needs more thought? What prerequisite data would I need for this page? 
````

# Chat GPT Response:

## Project: Contextual Hockey Rankings Page

### Objective

Build a new rankings ecosystem for the website that displays contextual rankings for skaters, goalies, and eventually teams. The page should allow users to rank players by individual metrics, raw rank, and percentile rank across dynamic peer groups such as position, deployment bucket, timeframe, and strength state.

The main product goal is to help users understand not just who ranks highly overall, but who ranks highly relative to their role and opportunity.

Example target sentence:

> This skater ranks 23rd among qualified L2 forwards in SOG/60 and is in the 84th percentile among L2 forwards over the selected timeframe.

### Existing Context

- The app uses Supabase.
- There is an existing `lineCombinations` Supabase table that should be used to help infer skater deployment.
- There is an existing `/shiftcharts` ecosystem with logic for assigning power-play units based on PPTOI share.
- There is an existing `/trueGoalieValue` page whose goalie metric logic should be inspected and reused where appropriate.
- Do not query raw play-by-play or shot data directly from the frontend leaderboard. Use derived aggregate tables, views, or RPC functions.

### Primary Entities

Support three entity types over time:

1. Skaters
2. Goalies
3. Teams

For the first implementation, prioritize skater rankings and the database/API structure needed to support goalie and team expansion later.

### Required Filters

The rankings UI should support:

- Season
- Entity type: skaters, goalies, teams
- Timeframe:
  - Season to date
  - Last 5
  - Last 10
  - Last 20
- Position group:
  - All skaters
  - Forwards
  - Defensemen
- Deployment:
  - Forwards: L1, L2, L3, L4
  - Defensemen: P1, P2, P3
  - Goalies: G1 Workhorse, G1 Starter, G1A, G1B, G2, G3/Call-Up
- Strength state:
  - All
  - 5v5
  - EV
  - PP
  - PK
- Minimum GP
- Minimum TOI
- Team

Every selected filter should recalculate the raw rank and percentile rank.

### Skater Deployment Logic

Use the `lineCombinations` table and average EV/5v5 TOI per game to classify skaters into deployment buckets.

Forwards:

- L1
- L2
- L3
- L4

Defensemen:

- P1
- P2
- P3

Deployment should be calculated per selected window and should include a confidence field.

Store:

- `ev_deployment_bucket`
- `pp_deployment_bucket`
- `pk_deployment_bucket`
- `avg_ev_toi_per_gp`
- `avg_total_toi_per_gp`
- `avg_pp_toi_per_gp`
- `deployment_confidence`

Avoid using total TOI alone as the primary deployment source because PP and PK specialists can distort even-strength role.

### Ranking Logic

Each metric should have:

- `metric_key`
- `display_name`
- `entity_type`
- `category`
- `description`
- `higher_is_better`
- `default_strength_state`
- `minimum_gp`
- `minimum_toi`
- `minimum_starts`
- `formula_description`

Raw rank should be calculated within the selected peer group.

Percentile should mean:

> This entity is better than X% of qualified peers in the selected peer group.

For lower-is-better metrics, invert the value before calculating rank and percentile.

### Required Skater Metrics for MVP

Implement or prepare structure for:

- Goals/60
- Assists/60
- Primary Assists/60
- Points/60
- SOG/60
- Shot Attempts/60
- Hits/60
- Blocks/60
- Individual xG/60
- xS% = individual xG / shots on goal
- Shooting Percentage Above Expected = actual shooting percentage - expected shooting percentage
- Goals Above Expected = goals - individual xG
- Unrealized xG = individual xG - goals
- On-ice GF%
- On-ice xGF%
- Relative 5v5 GF%
- Relative 5v5 xGF%

### Composite Skater Ratings

Prepare support for:

1. Overall Offense Rating
2. Overall Defense Rating
3. Deployment-relative Offense Rating
4. Deployment-relative Defense Rating
5. MCM Score
6. BEAST Tier
7. Shoot-First Score
8. Pass-First Score
9. Play Driver Score
10. Results Luck Index

Composite ratings should be calculated from metric percentiles, not raw values.

### MCM / BEAST Metric

Create a multi-category fantasy metric that rewards players who contribute across peripheral and scoring categories.

Peripheral categories, called "Riffs":

- Shots/60
- Hits/60
- Blocks/60

Scoring categories:

- Goals/60
- Primary Assists/60
- Points/60
- PP Points/60

Suggested MCM formula:

```ts
riff_score = average(top_2([
  shots_percentile,
  hits_percentile,
  blocks_percentile
]))

scoring_score = max([
  goals_percentile,
  primary_assists_percentile,
  points_percentile,
  pp_points_percentile
])

depth_score = average([
  shots_percentile,
  hits_percentile,
  blocks_percentile,
  goals_percentile,
  primary_assists_percentile,
  points_percentile,
  pp_points_percentile
])

mcm_score =
  0.45 * riff_score +
  0.35 * scoring_score +
  0.20 * depth_score
```

Suggested BEAST tiers:

* MCM Watch:
  * At least 2 Riff categories at or above 60th percentile
  * At least 1 scoring category at or above 60th percentile
* MCM:
  * At least 2 Riff categories at or above 70th percentile
  * At least 1 scoring category at or above 60th percentile
  * MCM Score >= 70
* BEAST:
  * At least 2 Riff categories at or above 75th percentile
  * At least 1 scoring category at or above 70th percentile
  * At least 4 of 7 categories at or above 70th percentile
  * MCM Score >= 80
* BEAST+:
  * All 3 Riff categories at or above 80th percentile
  * At least 2 scoring categories at or above 75th percentile
  * At least 4 of 7 categories at or above 80th percentile
  * MCM Score >= 88

### Shoot-First Score

Calculate from:

* Individual shot attempts as share of on-ice shot attempts
* Individual shots on goal as share of on-ice shots
* Individual xG as share of on-ice xG

Suggested formula:

```
shoot_first_score =
  0.45 * percentile(individual_attempt_share) +
  0.35 * percentile(individual_shot_share) +
  0.20 * percentile(individual_xg_share)
```

### Pass-First Score

Calculate from:

* Primary assists/60
* Assists as share of points
* Primary assists as share of total assists
* Optional inverse shot-volume component

Require a minimum point and assist sample before assigning a strong label.

### Play Driver Score

Calculate from:

* Primary points/60
* Primary point share
* Relative 5v5 GF%
* Relative 5v5 xGF%
* Individual xG/60

Suggested formula:

```
play_driver_score =
  0.30 * percentile(primary_points_per_60) +
  0.20 * percentile(primary_point_share) +
  0.20 * percentile(rel_xgf_pct) +
  0.15 * percentile(rel_gf_pct) +
  0.15 * percentile(individual_xg_per_60)
```

### Results Luck Index

Implement a player-specific current-results-vs-baseline metric.

Use the concept:

```
Results =
  GF/xGF
  + IPP
  + oiSH% / league_average_oiSH%
```

Compare current-window results to a historical baseline.

Preferred user-facing scale:

```
results_luck_index = 100 * current_results / baseline_results
```

Where:

* Around 100 = normal
* Above 115 = running hot
* Below 85 = running cold

Use EV and PP separately where sample allows. If PP sample is too small, exclude PP or regress it toward peer average.

For players without enough historical data, blend player history with peer-group average.

### Goalie Deployment

Use starts rather than games played as the primary role input.

Calculate:

```
raw_netshare = goalie_starts / team_starts
adjusted_core_netshare = goalie_starts / core_goalie_starts
```

Suggested goalie buckets:

* 65%+ = Workhorse
* 57.5-64.9% = Starter
* 50-57.4% = Tandem Lead
* 42.5-49.9% = Tandem Partner
* 35-42.4% = Busy Backup
* 25-34.9% = Backup
* <25% = Spot / Call-Up

Create logic to identify likely injury call-up/replacement stints and exclude those starts from adjusted core netshare when appropriate.

Store both raw and adjusted netshare.

### Goalie Metrics

Prepare support for:

* Save percentage
* GSAx
* GSAx/60
* GSAx/start
* xGA per shot against
* Relative SV% = goalie SV% - team SV% excluding that goalie
* Quality Start %
* Really Bad Start %
* Steal Games
* Steal %
* High-danger SV%
* Under Pressure profile

Suggested steal game logic:

```
steal_game =
  goalie_started
  AND team_won
  AND goalie_gsax >= max(1.0, adjusted_goal_differential)
```

Prefer adjusted goal differential that excludes empty-net goals if available.

### Team Style Metrics

Prepare later support for:

* Forward line rolling score
* Forward top-load index
* Defense pair rolling score
* Defense top-load index
* PP1 usage share
* PP2 usage share
* Shot quantity score
* Shot quality score
* Run-and-gun score
* High-event score
* PP dependency score
* Team luck index
* Physicality score
* Discipline score
* Home/road splits
* Rest splits
* Period scoring tendencies
* One-goal game frequency
* Mistake capitalization rate

Do not implement all team metrics in the first pass unless the data layer already supports them.

### Data Architecture

Create or adapt derived tables/views for:

1. metric_definitions
2. skater_window_aggregates
3. skater_deployment_windows
4. entity_metric_rankings
5. skater_composite_ratings
6. goalie_window_aggregates
7. goalie_deployment_windows
8. team_style_windows

Prefer aggregate tables or materialized views over frontend calculations.

Store numerators and denominators, not only rates.

Precompute common windows:

* Season to date
* Last 5
* Last 10
* Last 20
* Last 40
* Past 240 games for baseline metrics

### Frontend Requirements

Create a rankings page with:

* Filter controls
* Metric selector
* Sortable leaderboard table
* Raw rank column
* Percentile column
* Deployment column
* Sample-size indicators
* Player tags/badges
* Expandable explanation drawer
* Shareable URL state

Each row should be able to explain why the player ranks highly.

Example explanation:

```
Why this player stands out:
- 91st percentile in SOG/60 among L2 forwards
- 84th percentile in Hits/60
- 77th percentile in Goals/60
- MCM Score: 82
- BEAST Tier: BEAST
```

### Performance Requirements

* The frontend should not run expensive percentile calculations.
* Rankings should come from precomputed tables, materialized views, or Supabase RPC functions.
* Add indexes for:
  * season
  * window_type
  * window_size
  * entity_type
  * metric_key
  * peer_group_key
  * position_group
  * deployment_bucket
  * team_id

### Acceptance Criteria

* User can select a metric and see raw rank plus percentile.
* Percentiles recalculate correctly by selected peer group.
* Forwards and defensemen are not incorrectly mixed for deployment-specific rankings.
* Lower-is-better metrics rank correctly.
* Low-sample rows are clearly labeled.
* Skater deployment buckets are calculated from line combinations and/or EV usage.
* MCM Score and BEAST Tier are available for qualified skaters.
* The page uses URL query params for shareable filter state.
* Metric definitions are not hardcoded only in the frontend.
* The implementation is structured so goalie and team rankings can be added without rewriting the whole system.

### Important Constraints

* Do not query raw play-by-play data directly on leaderboard page load.
* Do not hardcode metric formulas inside React table components.
* Do not calculate percentiles client-side for full-league datasets.
* Do not mix strength states without making it explicit.
* Do not assign confident deployment labels for very small samples.
* Do not treat inferred goalie injury/call-up logic as certain; include role confidence.

---

## 18. My suggested build order

I would build this in this order:

### Step 1: Metric registry

Create a central definition for every metric.

Do this first. It will save you pain later.

---

### Step 2: Skater aggregate table

Build `skater_window_aggregates`.

Support:

```txt
season
last_5
last_10
last_20
```

Start with core stats only.

⸻

### Step 3: Deployment table

Build skater_deployment_windows.

Use lineCombinations plus EV/5v5 TOI.

⸻

### Step 4: Ranking table/RPC

Build the raw rank and percentile logic.

Make sure it supports:

```
league-wide
position-specific
deployment-specific
```

⸻

### Step 5: First leaderboard UI

Launch the first usable version with:

* Player
* Team
* Pos
* Deployment
* GP
* TOI/G
* Metric value
* Raw rank
* Percentile

⸻

### Step 6: Add MCM / BEAST

This should be the first “signature” feature after the basic rankings work.

⸻

### Step 7: Add archetypes

Add:

* Shoot-First
* Pass-First
* Play Driver
* Results Luck Index
* Goals Above Expected
* Unrealized xG

⸻

### Step 8: Add goalies

Goalies are a different enough ecosystem that they should come after the skater system is stable.

⸻

### Step 9: Add team style

This is the most complex and least urgent, but it could become a very strong standalone page later.

⸻

## 19. The highest-value “extra” idea

The best extra feature, in my opinion, is not another metric.

It is this:

### Opportunity Change Detection

Fantasy users care deeply about changing opportunity.

Add badges like:
```
TOI Up
PP1 Promotion
Line Promotion
Shot Volume Spike
Usage Drop
Starter Share Rising
New Tandem Split
```

Examples:

Player moved from L3 to L2 and gained 2:41 TOI/G over the last 5 games.

Defenseman moved to PP1 and ranks in the 88th percentile for shots among P2 defensemen.

Goalie has started 4 of the team’s last 5 games and moved from Backup to Tandem Lead.

This is where rankings become actionable. Metrics tell users who is good. Opportunity-change detection tells users who to act on before everyone else notices.
