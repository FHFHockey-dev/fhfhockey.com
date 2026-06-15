# PRD: FHFH Site Surface Expansion Roadmap

## Document Status
- Status: Draft, curated for task-list generation
- Owner: TBD
- Primary audience: junior developer implementing the feature and AI assistant generating the task list
- Intended follow-up artifact: `tasks/tasks-prd-fhfh-site-surface-expansion-roadmap.md`

## Introduction and Overview
This PRD consolidates a large set of product ideas, partial implementations, and older notes into one umbrella roadmap for expanding FHFHockey.com.

The primary product goal is to improve:
- fantasy lineup and start/sit decisions
- team-level hockey analysis and explanation
- power-user workflows that need deeper context than the current landing pages provide

This document is intentionally organized by page and surface area rather than by backend system. The expected implementation shape is a phased rollout with a strong v1, using existing routes and components where practical and introducing dedicated pages only when that is cleaner than continuing to expand overloaded pages.

This PRD includes user-facing features plus the data and API work required to support them.

## Problem Statement
FHFH already has a meaningful amount of surface area in production:
- homepage slate and status modules
- trends and FORGE surfaces
- player WiGO and trend tooling
- team pages with schedule, dashboard, shot map, and line-combination coverage
- lines pages and power-play unit displays
- goalie pages and weekly ranking experiments
- game grid and four-week forecast tools

The current issue is not a total lack of capability. The issue is fragmentation.

Important user jobs are split across older and newer pages, some note ideas are only partially represented, and several pages expose the ingredients for a feature without actually delivering the exact decision surface implied by the original note. That creates three product gaps:

1. Fantasy users cannot reliably move from slate context to player/team split context to recent-form context without jumping between unrelated pages.
2. Power users can often infer the answer from multiple tools, but the site does not consistently expose the final, opinionated surface they actually want.
3. Several high-value ideas live as partial UI, background data work, or experimental pages rather than as deliberate, stable product features.

## Goals
1. Convert the notes inventory into a coherent roadmap of user-facing features with explicit scope, phase order, and non-goals.
2. Improve existing page surfaces first where the current repo already has strong foundations, especially homepage, trends, team pages, lines pages, and the four-week grid.
3. Add the highest-value fantasy utility features in early phases, especially splits, L10 power-style context, PP shot-share context, and rolling comparison tools.
4. Standardize naming and product framing so internal concepts such as WiGO, WGO, PELT, and experimental visualizations can be understood by users and implementers.
5. Prefer daily-refresh data contracts for most features unless a surface is explicitly live-slate or line-combo dependent.
6. Keep experimental concepts in the roadmap, but stage them later than the highest-leverage production surfaces.
7. Ensure every approved surface has a clear “what the user can do” contract, not just a set of raw metrics.

## Product Naming and Aliases
- `FHFH Site Surface Expansion` is the umbrella program name in this PRD.
- `WiGO / WGO charts` should be described in UI copy as explanatory player or team trend charts rather than relying only on internal naming.
- `PELT` should be described in UI copy as a player evaluation toolkit, with `PELT` retained as an internal alias unless later approved as a public product name.
- `Breakout Barometer` and `Value Cost Delta` may retain their internal names as later-phase feature aliases, but the UI should pair them with descriptive subtitles.

## User Stories
- As a fantasy user, I want stronger recent-form and opponent-context surfaces so I can make lineup decisions faster.
- As a fantasy user, I want to compare players by recent windows versus historical baselines so I can identify real role changes versus noise.
- As a fantasy user, I want clearer line and power-play context so I can react to deployment changes before the market fully catches up.
- As a power user, I want team and player split views that answer specific matchup questions without requiring me to combine three pages manually.
- As a power user, I want team overperformance and underperformance explainers so I can understand whether recent results are sustainable.
- As a user browsing team pages, I want the main team surfaces to contain schedule, opponent, shot-map, line, and special-teams context in one coherent flow.
- As a user of the game grid, I want the four-week view to support additional tabbed perspectives so I can compare schedule convenience and new stats without leaving the tool.
- As a returning site user, I want experimental tools to feel intentional and labeled, not like isolated debug pages.

## Current-State Baseline
The following surfaces already exist and should be treated as foundations rather than rebuilt from scratch:
- homepage slate cards and standings/injuries sections
- trends dashboard
- player trend detail page
- WiGO charts page
- team stats page and team tab navigation
- team dashboard, schedule calendar, and shot-map tooling
- lines landing page and per-team lines page
- power-play combinations component
- goalie share chart
- goalie weekly ranking pages
- start chart
- four-week forecast grid
- opponent metrics table
- underlying-stats landing pages

The following note items are already partially represented and should usually be framed as enhancements rather than greenfield builds:
- L10-style trend context
- L7/14/30 vs historical baseline comparisons
- goalie weekly categorization
- PP personnel context
- category coverage / percentile views
- breakout and value-analysis ingredients

## Phase Plan

### Phase 1: High-Value Enhancements On Existing Surfaces
Focus on a balanced mix of:
- high fantasy utility
- highest leverage on existing pages
- low-friction upgrades where the repo is already close

Primary targets:
- homepage polish and correctness follow-ups
- trends and player-comparison improvements
- team page expansion
- lines and PP context expansion
- four-week grid enhancements
- selected fantasy-utility features such as splits, PP shot share, and rolling comparison tools where existing data already supports them

### Phase 2: Dedicated Decision Surfaces
Add dedicated pages or modules where enhancement of an existing page is no longer clean:
- deeper splits surfaces
- clearer L10 power/context products
- WGO over/under-performance explainers
- goalie consistency and workload decision surfaces

### Phase 3: Experimental and Toolkit Surfaces
Ship later-phase exploratory products once core production surfaces are stable:
- PELT
- Breakout Barometer
- Value Cost Delta / ROI for ADP

## Functional Requirements

### 1. Roadmap and Surface Strategy
1. The system must treat this PRD as an umbrella roadmap covering homepage, trends, player tools, team pages, lines pages, goalies, game grid, and experimental surfaces.
2. The implementation must prefer enhancement of existing routes before creating new pages.
3. The system may introduce new dedicated pages when extending an existing page would make the user flow or implementation contract less clear.
4. Every feature added from this PRD must be explicitly assigned to a named page, route, or module before implementation begins.

### 2. Homepage
5. The homepage must preserve and continue to support live in-progress game state display using period and time-remaining context rather than only scheduled start time.
6. The homepage standings module must remain fully populated and reliable.
7. The homepage injury table must receive visual polish where required, including date-column layout fixes if the current width remains inconsistent.
8. Homepage follow-up work must include validation of any displayed PP-related metrics that materially affect fantasy decision-making.
9. Homepage additions in this PRD must remain lightweight and summary-oriented, with deeper analysis routed to downstream pages.

### 3. Splits and Matchup Context
10. The product must support a `Splits` decision surface covering player-versus-team and team-versus-team style comparisons.
11. The splits surface must be designed for fantasy and matchup analysis rather than only raw historical lookup.
12. The system must allow users to compare how a player performs in specific contexts relevant to lineup decisions.
13. The system must allow users to compare teams in a matchup-oriented leaderboard format where the output is readable without manual calculation.
14. If an existing route cannot support a clean splits UX, the system may create a dedicated splits page.

### 4. Rolling Comparison Toolkit
15. The product must provide a user-facing comparison surface for recent windows against historical baselines.
16. The strong-v1 comparison scopes must include recent rolling windows and historical baselines already supported by the repo’s current metric pipeline.
17. The strong-v1 comparison surface must support at least recent-vs-season and recent-vs-career style analysis.
18. Where practical, the system should also expose last-year style comparison if source reliability and contract clarity are acceptable.
19. The system must clearly label each baseline mode so users understand whether they are viewing season, last-year, 3-year, career, or cumulative context.

### 5. Trends Expansion
20. Trends surfaces must continue to support rolling player trend charts for TOI, shots, and related key fantasy metrics.
21. The product must add clearer packaging for rolling-average use cases that currently exist only as component behavior or buried page capability.
22. The product must support a clearer goalie-share or goalie-workload trend surface where current goalie usage distribution is material.
23. The product should favor using the existing trends and player-trend pages as the base for these additions unless a dedicated surface is cleaner.

### 6. L10 Team Context and Power-Style Views
24. The product must support an L10-style team context feature aimed at lineup and matchup decisions.
25. The strong-v1 version must combine recent team performance with opponent context rather than exposing isolated L10 values without framing.
26. The feature must communicate recent offense, defense, and special-teams context in a way that supports fantasy decisions.
27. If the exact note concept cannot be cleanly delivered on the existing trends page, the system may introduce a dedicated team-context module or page.

### 7. PP Shot Share and PP Role Context
28. The product must expose a user-facing metric for player share of team shots on the power play.
29. The PP shot-share surface must be clearly distinguished from broader PP share or PP TOI usage metrics already present in the codebase.
30. The PP shot-share output must be accessible from a player-oriented surface, not only from raw internal metrics.
31. The system should integrate PP shot-share context with existing PP role and personnel data where possible.

### 8. Team Pages
32. Team pages must remain the primary home for schedule, shot-map, line-combination, and team-context workflows.
33. The team experience must support a monthly schedule grid as a first-class feature.
34. The team experience must continue to support a shot-map surface.
35. The team experience must support stronger opponent-success or opponent-quality context where relevant to recent or upcoming schedule interpretation.
36. The team experience must support PP split context by personnel, either on the team page or through a clearly linked sub-surface.
37. The team experience should support line-chart style views for rolling team metrics such as GF/GP, PP%, points percentage, xGF, xGA, and shots-for rates where the data contract is already supported.
38. Team page additions must not require users to switch between legacy and new team routes without a clear redirect or navigation strategy.

### 9. Lines Pages and Lines Data Pipeline
39. The product must preserve the existing lines pages and line-combination workflows already present in the repo.
40. The line-combination pipeline must continue to support ingestion and refresh of lines data for display on the site.
41. The product should improve the translation from line-ingestion background jobs into stable user-facing output.
42. The lines experience must support stronger line-level context such as L1 through L4 timeshare and goal-share visualization.
43. The lines experience must continue to support PP personnel context, with a preference for integrating historical recent-unit context where already available.

### 10. Goalie Surfaces
44. The goalie experience must support a weekly consistency framework that helps users understand goalie reliability over time.
45. The strong-v1 goalie consistency surface must bucket goalie weeks into named quality bands.
46. The strong-v1 goalie surface must support summary tables that help users understand different quality-start patterns over time.
47. The goalie experience should support starts-per-week and workload interpretation.
48. Later-phase goalie work may include stronger quality-of-competition framing for backup-to-starter transitions if the source contract is sufficiently reliable.

### 11. Game Grid and Four-Week Grid
49. The four-week grid must remain part of the core planning workflow for fantasy users.
50. The four-week grid must support a second “back side” or alternate tabbed view rather than forcing all data into one table.
51. The tabbed design must allow users to switch between the current four-week columns and additional statistics without leaving the page.
52. The current four-week grid output must remain available and recognizable after the redesign.
53. The game-grid ecosystem must continue to support related side surfaces such as opponent metrics and schedule context.

### 12. WGO / Explanation Charts
54. The product must support a clearer explanatory chart surface for why a team is overperforming or underperforming over a selected span.
55. The explanatory surface must favor narrative clarity over metric overload.
56. The strong-v1 explanation should connect recent output to underlying drivers such as chance creation, chance suppression, finishing, or special-teams context when those signals are available.
57. The WGO explanation work may live on an existing WGO-style page or a new dedicated explanatory route.

### 13. Category Coverage and Percentile Synthesis
58. The product must preserve the existing category-coverage and percentile-rank foundations.
59. The roadmap must support a later surface that synthesizes percentile-style outputs into clearer fantasy category coverage guidance.
60. The strong-v1 implementation may begin as a derived leaderboard or summary card rather than a full standalone tool if that is faster and clearer.

### 14. Experimental and Toolkit Features
61. The roadmap must keep `PELT` in scope as a later-phase toolkit concept.
62. The roadmap must keep `Breakout Barometer` in scope as a later-phase experimental visualization.
63. The roadmap must keep `Value Cost Delta / ROI for ADP` in scope as a later-phase value-analysis surface.
64. Experimental features must not block or delay production-facing improvements to homepage, trends, team pages, lines, goalies, or game-grid surfaces.

### 15. Data and API Requirements
65. User-facing features in this roadmap may require new API routes, expanded query contracts, or derived tables where current UI coverage is incomplete.
66. Data work should favor extending current APIs and tables when the existing contract is already close to the needed feature.
67. New data contracts must be shaped around user-facing outputs rather than exposing internal metric fields without interpretation.
68. Daily refresh is the default freshness target for this roadmap unless a feature depends on line-combination changes or live-slate state.
69. Features that depend on line changes, goalie starts, or same-day slate updates may define tighter freshness expectations separately.

### 16. Navigation and Cross-Linking
70. Features added through this roadmap must include clear navigation between related surfaces.
71. The homepage, trends, team pages, lines pages, and start-chart style surfaces should cross-link where that reduces user guesswork.
72. If a feature exists both as a summary module and a deep-dive page, the summary module must link directly to the deep-dive surface.

## Non-Goals (Out of Scope)
1. User voting, crowdsourced rankings input, or any other user-generated-data workflow is out of scope for this roadmap.
2. The specific note item “page that votes on rankings scoring system” is out of scope under the current no-voting constraint.
3. Full near-real-time refresh across every feature is out of scope. Daily-refresh contracts are acceptable for most roadmap items.
4. A full site-wide redesign is out of scope.
5. Replacing the underlying model math or re-deriving every historical metric from scratch is out of scope unless a specific feature cannot be delivered without it.
6. Admin-only dashboards and internal debug consoles are not the primary target of this roadmap, though supporting data/API work is in scope where required for user-facing features.
7. Exact commitment to every later-phase experimental surface shipping in v1 is out of scope.

## Design Considerations
- Existing visual language should be preserved unless a specific page already has a modernized design direction.
- Existing routes with strong recognition value should be enhanced rather than replaced abruptly.
- New names shown to users should be descriptive first, with internal aliases retained where helpful.
- Summary surfaces should avoid overwhelming users with raw metric density if a clearer grouped or tabbed pattern is possible.
- The four-week grid redesign should use explicit tabs or mode controls rather than overloading one table with too many columns.

## Technical Considerations
- Reuse existing routes and modules wherever practical, especially:
  - `web/pages/index.tsx`
  - `web/pages/trends/index.tsx`
  - `web/pages/trends/player/[playerId].tsx`
  - `web/pages/stats/team/[teamAbbreviation].tsx`
  - `web/pages/lines/[abbreviation].tsx`
  - `web/pages/goalies.js`
  - `web/pages/start-chart.tsx`
  - `web/components/GameGrid/utils/FourWeekGrid.tsx`
- Treat current partial implementations as foundations:
  - trend pages already support multiple historical baselines
  - lines pages already support line-combo and PP-unit displays
  - team pages already support schedule, shot-map, and dashboard modules
  - goalie pages already support weekly ranking concepts
- Distinguish carefully between:
  - PP share
  - PP TOI share
  - PP shot share
  - PP personnel/unit context
  because these are related but not interchangeable.
- Any new dedicated page should have an obvious navigation path from an existing high-traffic route.
- Where multiple legacy pages overlap, implementation should choose one canonical user-facing surface rather than duplicating similar outputs.

## Success Metrics
1. Users can reach the most important fantasy-decision surfaces through homepage, trends, team pages, lines pages, or game-grid navigation without hunting through old experimental routes.
2. At least the strongest-v1 subset of the notes inventory is converted from scattered partial implementations into clear product surfaces.
3. Existing high-value pages gain functionality without becoming less understandable.
4. New features ship with explicit output contracts that a junior developer can test against.
5. Experimental concepts remain staged and labeled rather than diluting the clarity of production surfaces.

## Open Questions
1. Should the splits experience become one dedicated route, or should it be distributed across trends, player, and team pages with shared controls?
2. For rolling comparison surfaces, should “last year” be treated as a required baseline in strong v1 or as a follow-up after season and career modes are fully stabilized?
3. Which existing team route should become the single canonical team destination if more team-page capabilities are added?
4. Should goalie consistency live inside the current goalie pages or become a dedicated route with clearer weekly-bucket storytelling?
5. Should WGO explanatory charts focus first on team-level over/under-performance, player-level sustainability, or both?
6. Which later-phase experimental surface should be prioritized first after the core production phases: PELT, Breakout Barometer, or Value Cost Delta?
