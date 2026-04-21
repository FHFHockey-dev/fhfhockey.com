# PRD: Three Pillars Analytics Surface

## 1. Introduction / Overview

This PRD defines the product requirements for the three analytics pillars that should anchor the site’s advanced NHL decision workflow:

1. `/underlying-stats` as the advanced-metrics and team-intelligence landing page
2. `/trends` as the movement and recent-form page for teams, skaters, and goalies
3. `/trendsSandbox` as the sustainability and expectation-vs-performance lab for teams, skaters, and goalies

The goal is to turn the current collection of related dashboards, tables, and prototypes into a coherent product system with explicit route ownership, shared terminology, and launch-ready data/model dependencies.

This PRD is intentionally written as one umbrella document with three separate page sections because the pages share upstream dependencies, overlapping entities, and a common launch goal.

## 2. Current-State Audit

### 2.1 `/underlying-stats`

What it currently does:

- Serves as a team-focused intelligence board
- Shows team power, offense, defense, pace, PP/PK context, SoS past/future, schedule texture, luck, risers/fallers, and supporting narratives
- Uses a snapshot-date workflow and resolves nearest available snapshot data
- Presents a supporting table after the top-level dashboard read

What it does not currently do:

- It is not a full advanced-metrics landing for teams, skaters, and goalies
- It does not expose player offensive/defensive ratings or dedicated goalie ratings on the landing page
- It does not provide a broad date-range and team-filter workflow aligned across entity types
- It does not yet integrate predictions, odds, props, or official betting market comparisons
- It does not manage starting-goalie sourcing or pregame lineup sourcing directly

Important nuance:

- `/underlying-stats` already overlaps with `/underlying-stats/teamStats`, which is a richer filtered team table explorer. This is a route-ownership issue that must be resolved during implementation.

### 2.2 `/trends`

What it currently does:

- Supports skater movement scanning well
- Includes player search, recent-form summary cards, skater percentile movement, team/skater line charts, CTPI pulse/movers, projections, goalie starts, and goalie workload share
- Provides a fast “what is moving now?” dashboard

What it does not currently do:

- It does not yet provide equal team/skater/goalie trend depth
- It does not yet show rolling-average trend packages for goalies comparable to skaters
- It does not yet offer a stable predictions-vs-actual framework
- It does not yet support a candlestick-style trend visualization
- It mixes movement analysis with projection/slate triage in ways that blur route ownership

Important nuance:

- Team trends must remain on `/trends`, even though `/underlying-stats` remains the team intelligence landing. Trends owns movement and directionality, not the deeper explanatory diagnosis.

### 2.3 `/trendsSandbox`

What it currently does:

- Operates as a skater-focused prototype lab
- Includes player search, season selection, rolling windows, elasticity-band snapshots, band history, and hot/cold streak charts
- Proves that there is already meaningful sustainability-model infrastructure in the repo

What it does not currently do:

- It is not yet a team/skater/goalie sustainability surface
- It does not yet expose durable sustainability meters for all entity classes
- It does not yet provide shared threshold-band logic and readable expectation states across teams, skaters, and goalies

Important nuance:

- Much of the skater sustainability math already exists. The missing work is productization, entity expansion, and route hardening, not merely inventing the entire concept.

## 3. Product Goals

- Establish clear ownership and boundaries for `/underlying-stats`, `/trends`, and `/trendsSandbox`
- Launch a coherent advanced-metrics ecosystem for teams, skaters, and goalies
- Make player, goalie, and team ratings first-class data products instead of page-only calculations
- Treat prediction models, odds/props, starting goalies, injuries, and lineup sourcing as launch requirements, not later refactors
- Preserve team trends on `/trends` while keeping `/underlying-stats` as the canonical team intelligence landing
- Build the line-combination sourcing system with an explicit source hierarchy and fallback logic
- Ensure prediction-model work is designed around the final required feature set so it does not need major structural rework after launch

## 4. User Stories

- As a user, I want `/underlying-stats` to tell me what current team, skater, and goalie stats mean so I can understand strength, weakness, schedule context, and sustainability.
- As a user, I want `/trends` to show me what is moving lately for teams, skaters, and goalies so I can identify form shifts, risers, fallers, and short-term directionality.
- As a user, I want `/trendsSandbox` to show whether a team, skater, or goalie is sustaining current performance or running above/below expectation.
- As a betting-oriented user, I want lineup, goalie-start, injury, odds, and prop context integrated early enough that prediction models are built around real decision inputs.
- As a fantasy or analysis user, I want source provenance and fallback behavior to be understandable when an official lineup or goalie source is unavailable.

## 5. Page Ownership and Boundaries

### 5.1 `/underlying-stats` ownership

This page owns:

- Team intelligence landing behavior
- Season-total and snapshot-first advanced metrics
- Team, skater, and goalie advanced ratings surfaces
- Interpretation of what current stats mean
- Team and player offensive/defensive ratings
- Goalie rating surfaces
- Team strength of schedule, both past and future
- Prediction-model intelligence where explanatory context matters
- Market overlays where comparison between model and market is part of the current-state read

This page does not own:

- Primary recent-form discovery
- Prototype-only charting experiments
- The main sustainability-meter workflow
- Candlestick-style trend experiments

### 5.2 `/trends` ownership

This page owns:

- Movement, directionality, and recent-form scanning
- Team trend movement
- Skater trend movement
- Goalie trend movement
- Rolling averages and trend windows
- Risers, fallers, hot streaks, and cold streaks
- Prediction-oriented short-horizon trend reads that belong to recent movement rather than full explanatory diagnosis

This page does not own:

- Full team intelligence diagnosis
- The primary sustainability-meter framework
- Raw table-explorer behavior better handled by ULS detail routes

Important explicit exception:

- Team trends remain in scope here. `/trends` must show movement in team metrics and recent directionality even though `/underlying-stats` remains the main team-intelligence landing.

### 5.3 `/trendsSandbox` ownership

This page owns:

- Sustainability meters for teams, skaters, and goalies
- Threshold bands, standard-deviation framing, and expectation-state design
- Experimental but durable expectation-vs-performance workflows
- Alternate baseline logic before concepts are promoted into stable production language

This page does not own:

- General movement discovery
- The main team-intelligence landing behavior
- Prediction-market comparisons as the primary workflow

## 6. Functional Requirements

### 6.1 Shared launch requirements across all three pillars

1. The system must support team, skater, and goalie analytics as first-class entity types.
2. The system must establish shared naming and interpretation rules for ratings, trends, baselines, and sustainability states.
3. Prediction models are launch scope and must be designed together with lineup, goalie-start, injury, odds, and props requirements.
4. The data model must support current-state reads, recent-form reads, and expectation-vs-baseline reads without rebuilding the conceptual model later.
5. Source provenance must be visible internally so downstream features know whether data came from official, semi-official, or fallback sources.

### 6.2 `/underlying-stats`

6. `/underlying-stats` must remain team-intelligence-first on landing.
7. The default landing state must show team data first.
8. The page must expose clear navigation paths from team landing to skater and goalie advanced-metrics surfaces.
9. The page must support season-total snapshot behavior anchored to the most current data available.
10. The page must support narrowing by date range and relevant team filters.
11. The page must provide individual skater offensive ratings.
12. The page must provide individual skater defensive ratings.
13. The page must provide goalie ratings.
14. The page must provide team ratings.
15. The page must explain what current ratings and advanced stats mean in readable product language.
16. The page must provide team and skater offensive rankings/ratings.
17. The page must provide team and skater defensive rankings/ratings.
18. The page must provide team strength-of-schedule context for both past and future.
19. The page must support prediction-model outputs where they are used to explain current edge or expected performance.
20. The page must support official odds and props ingestion as launch scope.
21. The page must support model-vs-market comparisons and highlight props that the model flags positively.

### 6.3 `/trends`

22. `/trends` must show movement for teams, skaters, and goalies.
23. The page must include rolling-average views for each entity class.
24. The page must support recent-form windows that are comparable across entities where possible.
25. The page must provide risers and fallers for teams, skaters, and goalies.
26. The page must identify hot and cold streaks.
27. The page must expose recent directionality of team metrics in addition to player/goalie movement.
28. The page must distinguish movement from full diagnostic explanation so that route ownership remains clean.

Explicit deferment inside Trends:

29. Predictions-vs-actual trend presentation and candlestick-style visualization are intentionally flagged for later implementation, even though prediction models themselves are launch scope.

### 6.4 `/trendsSandbox`

30. `/trendsSandbox` must evolve from skater-only to team/skater/goalie sustainability coverage.
31. The page must use season-long baselines and rolling averages together.
32. The page must expose threshold bands or standard-deviation framing that indicate whether current production is likely sustainable.
33. The page must show when a team, skater, or goalie is overperforming baseline expectation.
34. The page must show when a team, skater, or goalie is underperforming baseline expectation.
35. The page must support category-specific metric sets rather than forcing identical metrics on teams, skaters, and goalies.
36. The page must surface the reasoning inputs behind a sustainability state in a readable way.

### 6.5 Line combinations, goalie starts, injuries, and source hierarchy

37. Pregame line-combination sourcing is launch scope.
38. The default source for projected line combinations must be NHL.com lineup projections when available.
39. A scraper or fetcher must check DailyFaceoff team line-combination pages as a higher-priority fallback source only when those pages reflect an official/current source and not merely “Last Game”.
40. If DailyFaceoff indicates “Last Game”, the system must continue using the NHL.com lineup-projection source.
41. GameDayTweets `/lines` must be treated as a tertiary fallback source for line-combination and power-play discovery.
42. The ingestion pipeline must support regex and keyword extraction for lineup-related tweet content.
43. The extraction layer must support keyword groups for regular lines, defense pairs, power plays, goalie starts, injuries, and related status notes.
44. Parsed player names must be cross-referenced against `players` and/or `rosters` tables to validate identity and team assignment before persisting.
45. Starting-goalie sourcing is launch scope and must support official and fallback sourcing strategies.
46. Injury enhancement is launch scope and must support normalized statuses including at least `injured` and `returning`.
47. A returning-player state must remain available after a player leaves the live injury endpoint, so other surfaces can treat recent-return context distinctly.

### 6.6 Odds, props, and model integration

48. Odds, props, and betting-line ingestion are launch scope.
49. The ingestion system must support official or stable third-party sources for game odds and player props.
50. Prediction-model outputs must be stored in a way that allows page-specific presentation without reworking the model layer.
51. The system must support flagging when a market prop is liked by the internal model.
52. The system must preserve market-source provenance and freshness.

### 6.7 Data-model and Supabase requirements

53. Supabase tables or views must be created or refactored for offensive, defensive, and goalie ratings.
54. Ratings storage must support teams, skaters, and goalies as distinct but comparable product surfaces.
55. Sustainability storage must expand beyond skater-only production use where needed.
56. Trend storage must support team, skater, and goalie movement products.
57. Model output storage must support predictions, market comparisons, and downstream page consumption.

### 6.8 NHL Edge and additional public API requirements

58. Additional advanced metrics from public NHL endpoints are in launch scope where they materially improve the three pillars.
59. Existing context from `web/rules/context/nhl-edge-stats-api.md` must be used as a starting point, not assumed complete.
60. The implementation plan must include an endpoint-discovery pass for NHL Edge coverage gaps.

## 7. Design Considerations

- `/underlying-stats` should feel snapshot-first, explanatory, and intelligence-oriented.
- `/trends` should feel movement-first and faster to scan.
- `/trendsSandbox` should feel experimental but not throwaway; it is the controlled lab for sustainability concepts.
- The same metric should not be described differently across pages unless the page explicitly frames it differently.
- Route-level copy must clearly say what the surface owns and what it defers.
- Team, skater, and goalie tabs or drill-down paths must feel like one system, not separate prototypes.

## 8. Technical Considerations

### 8.1 Route architecture

- Keep `/underlying-stats` as the team intelligence landing.
- Keep team movement in `/trends`.
- Resolve overlap between `/underlying-stats` and `/underlying-stats/teamStats`.
- Recommended implementation rule:
  - `/underlying-stats` = intelligence landing
  - `/underlying-stats/teamStats` = raw/filtered team table explorer
  - `/underlying-stats/playerStats` and `/underlying-stats/goalieStats` = entity-specific advanced-metrics explorers

### 8.2 Existing repo strengths to preserve

- Team ratings, schedule strength, and team narratives already have meaningful implementation depth.
- Skater sustainability math and trend-band infrastructure already exist and should be promoted, not discarded.
- Goalie-start probabilities already exist internally and should be integrated into the final source strategy.

### 8.3 Known gaps to close

- Player offensive/defensive ratings are not yet first-class stored products.
- Goalie rating products are not yet clearly unified for page consumption.
- Team/skater/goalie parity is inconsistent across current routes.
- Tweet-based fallback sources can be noisy and truncated.
- Current line-combination logic uses after-the-fact/live data and is insufficient for pregame use cases by itself.

### 8.4 External source strategy

Recommended launch hierarchy for line combinations:

1. NHL.com lineup projections when available
2. DailyFaceoff team line-combination pages when current-source evidence exists and page state is not “Last Game”
3. GameDayTweets `/lines` as tertiary fallback for discovery and extraction

Recommended launch strategy for goalie starts:

1. Official NHL source when available
2. DailyFaceoff starting goalies
3. Existing internal starter-probability model as context, not sole truth

### 8.5 Parsing and normalization

- Tweet parsing must handle truncated previews as a degraded case.
- The system should prefer direct source links and structured pages over heuristic-only tweet parsing.
- Regex and keyword extraction must be backed by roster validation.
- Name normalization must handle initials, accents, and role context where possible.

## 9. Non-Goals / Out of Scope

- Rebuilding the entire existing analytics stack from scratch
- Treating `/trendsSandbox` as a disposable prototype surface with no path to production concepts
- Moving all team trend content out of `/trends`
- Shipping a prediction-model UX first and retrofitting lineup, goalie-start, injury, and market inputs later
- Implementing the predictions-vs-actual candlestick visualization in the initial launch tranche

## 10. Success Metrics

- Users can explain the difference between the three pages without confusion.
- Each page has clear ownership of its primary workflow.
- Team, skater, and goalie entity coverage is consistent enough that no pillar feels incomplete by category.
- Line-combination, goalie-start, and injury status data can be sourced and persisted with explicit fallback behavior.
- Prediction models do not require structural rework when odds, props, injuries, and lineup inputs are added because those were included from launch scope.
- Market-comparison features can identify model-liked props using stored prediction and odds data.

## 11. Open Questions

- Which official or stable odds/props provider will become the production launch source?
- Which official or semi-official source should be treated as the strongest goalie-start source when NHL.com is incomplete?
- How should confidence or freshness be displayed when fallback lineup/goalie sources are used?
- Which metrics should be category-defining for team sustainability versus skater sustainability versus goalie sustainability?
- Should some sustainability concepts graduate from `/trendsSandbox` into `/trends` or `/underlying-stats` at launch, or only after validation?
- How should the UI communicate the difference between current-state intelligence, recent movement, and sustainability expectation without duplicating content?

## 12. Implementation Notes for the Team

- Do not treat lineup sourcing, goalie starts, injuries, odds/props, or prediction models as separable “later” infrastructure. They are launch-shaping dependencies.
- Do not conflate “team trend movement” with “team intelligence landing.” Both are required, but they belong to different pages for different reasons.
- Build persistent data contracts first for ratings, trends, sustainability, source provenance, and model outputs so the UI layer does not become the de facto data model.
