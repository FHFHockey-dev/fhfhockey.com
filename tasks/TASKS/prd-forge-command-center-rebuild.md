# PRD: FORGE Command Center Rebuild

## 1. Introduction / Overview

FORGE needs a new dashboard page built from scratch instead of another incremental edit to the current route family.

The current FORGE surface already has useful pieces: canonical projection readers, slate context, goalie risk, top adds, team context, sustainability, route navigation, fallback metadata, and a tested dashboard component set. The problem is that those pieces were assembled across multiple passes and now carry too much accumulated complexity: mixed-cadence data, repeated stale-state repairs, overlapping component families, inconsistent route continuity, and a dashboard composition that still reads more like a patched collection of modules than a premium fantasy hockey control surface.

This PRD defines a new FORGE page, tentatively named **FORGE Command Center**, that should be built as a clean route first, validated in parallel, and only promoted to replace the existing dashboard after passing data, route, responsive, and visual gates.

Recommended route:

- New build route: `/forge/command-center`
- Existing reference/rollback route: `/forge/dashboard`
- Existing landing preview route: `/FORGE`
- Promotion target after validation: `/forge/dashboard`

The desired visual direction is guided by:

- `/Users/tim/Desktop/FHFH Stuff/Generated image 3.png`
- `/Users/tim/Desktop/FHFH Stuff/dashboardInspo.png`

The new page should feel like a dense, polished fantasy hockey terminal: dark, sharp, data-rich, cyan/green/red status language, scan-first tables, small multiples, and clear action states. It must not become a marketing landing page or a decorative card wall.

## 2. Goals

1. Build a new scratch FORGE dashboard route that can replace the current `/forge/dashboard` after validation.
2. Preserve the useful existing FORGE ecosystem contracts while avoiding another direct rewrite of the current page.
3. Make the first viewport solve the fantasy manager workflow: slate, team environment, goalie context, top adds, and player trust/fade signals.
4. Use one coherent command-center layout inspired by the supplied images, not a stack of unrelated panels.
5. Make stale, fallback, partial, and mixed-date states visible at page level and module level.
6. Keep canonical FORGE outputs as the projection source: `forge_player_projections`, `forge_goalie_projections`, `forge_team_projections`, and `forge_runs`.
7. Preserve existing drill-ins for player, team, start-chart, and trends views while fixing route context continuity.
8. Reduce duplicated dashboard component logic by creating a small reusable component family for tables, tiles, chips, sparks, and module states.
9. Require source-to-UI reconciliation before the new route can replace the old dashboard.
10. Validate desktop and mobile layouts with browser screenshots before launch.

## 3. User Stories

1. As a fantasy hockey manager, I want one page that tells me what matters tonight so I can make lineup, waiver, and streaming decisions quickly.
2. As a fantasy hockey manager, I want team environment and goalie context near the top so player projections have real matchup meaning.
3. As a fantasy hockey manager, I want top adds filtered by realistic ownership so the recommendations are actionable in my league.
4. As a fantasy hockey manager, I want to know who is hot, who is cold, who is sustainable, and who is fake hot without opening four pages.
5. As a fantasy hockey manager, I want clear start/sit and add/fade language that is backed by visible projection, trend, ownership, and risk evidence.
6. As a maintainer, I want a clean route that can be developed and tested without destabilizing the current dashboard.
7. As a maintainer, I want every module to declare its API, freshness contract, fallback behavior, and reconciliation method.
8. As a maintainer, I want a controlled promotion path so `/forge/dashboard` changes only after the new route proves it is better.

## 4. Functional Requirements

1. The system must create a new route at `web/pages/forge/command-center.tsx`.
2. The system must not directly replace `web/pages/forge/dashboard.tsx` until the new route passes launch gates.
3. The new route must use the existing FHFH global chrome and route navigation patterns where practical.
4. The new route must support these global filters:
   1. date
   2. team
   3. position
   4. slate state or games window
5. The selected filter state must be reflected in the URL.
6. Click-through routes must preserve relevant context:
   1. requested date
   2. resolved fallback date when present
   3. selected team
   4. selected position
   5. add mode: `tonight` or `week`
   6. return URL
7. The page must include a top global nav matching the supplied visual direction:
   1. FORGE/FHFH identity
   2. dashboard
   3. players
   4. teams
   5. matchups or start chart
   6. tools/trends access
   7. search affordance
8. The first viewport on desktop must include:
   1. Team Power Terminal
   2. Focused Slate + Goalie Context
   3. Top Adds Watchlist
9. The second major band must include:
   1. Player Insight Core
   2. sustainable/trustworthy risers
   3. regression/fade candidates
   4. hot/cold momentum tracker
10. The page must include a slate/game strip or matchup matrix that shows:
    1. teams
    2. game time
    3. projected or known goalie context
    4. matchup edge
    5. game fantasy environment
    6. stale/fallback state when applicable
11. The page must include a Team Power Terminal that shows:
    1. selected team trend
    2. league average comparison
    3. offense score
    4. defense score
    5. pace score
    6. trend score
    7. finishing score
    8. goalie score
    9. variance or instability score
12. Team context must use existing team data sources where possible:
    1. `/api/team-ratings`
    2. `/api/v1/trends/team-ctpi`
    3. `/api/v1/start-chart`
    4. `forge_team_projections` where needed for projected team environment
13. The page must include a Focused Slate + Goalie Context module that shows:
    1. selected highest fantasy environment matchup
    2. team logos and records where available
    3. power edge
    4. pace
    5. shots per game or projected shot environment
    6. total projected fantasy environment
    7. add/stream rating
    8. goalie confidence
14. Goalie context must use:
    1. `/api/v1/forge/goalies`
    2. `goalie_start_projections` context when exposed through existing slate/start-chart APIs
    3. goalie uncertainty metadata, including confidence tier, volatility, blowup risk, and recommendation
15. The page must include a Top Adds Watchlist that shows:
    1. rank
    2. player
    3. position
    4. team
    5. ownership percent
    6. recent ownership movement
    7. projection
    8. model/add score
    9. trend sparkline
16. Top Adds must default to the `25%` to `75%` ownership band.
17. Other player insight modules must default to the `25%` to `50%` ownership band unless a stronger reason is documented.
18. Top Adds must support `Dashboard`, `Players`, `Matchups`, and `Goalies` view toggles only if those toggles map to real filtered states.
19. The page must include live status chips for:
    1. live/fresh
    2. adds updated within 1 day
    3. goalie data available
    4. fallback or stale state
20. The page must include a Player Insight Core with a quadrant or equivalent view for:
    1. sustainability/trust
    2. recent momentum
    3. cold fades
    4. overheated heaters
21. Player Insight Core must include paired tables for:
    1. Top Trust / Sustainable Plays
    2. Regression Risk / Fade Candidates
22. Player Insight Core must include a Hot / Cold Momentum Tracker.
23. Sustainability and trend modules must use existing APIs where practical:
    1. `/api/v1/sustainability/trends`
    2. `/api/v1/trends/skater-power`
    3. `/api/v1/transactions/ownership-trends`
    4. `/api/v1/transactions/ownership-snapshots`
24. The page must distinguish sustainability from short-term trend movement in both data handling and UI labels.
25. The page must not merge all player cards into a single generic component if the information purpose differs.
26. The implementation must create or reuse distinct component modes for:
    1. projection/opportunity
    2. sustainability/trust
    3. momentum/hot-cold
    4. goalie/risk
    5. team/context
27. Each data-backed module must render explicit states for:
    1. loading
    2. empty
    3. partial
    4. stale/fallback
    5. error
28. The page must include one page-level mixed-state banner when any module serves data from a different resolved date than the requested date.
29. The page must include module-level stale/fallback notes with concise user-facing language.
30. The system must centralize data loading for the command center instead of letting each child component independently fetch overlapping APIs without coordination.
31. The command-center data layer must dedupe requests and expose one normalized view model to the page.
32. The implementation must define a module contract for each dashboard module:
    1. source APIs
    2. source tables
    3. freshness expectation
    4. fallback strategy
    5. empty-state rule
    6. click-through destination
33. The page must have a source-to-UI reconciliation checklist before promotion.
34. The page must include responsive behavior for:
    1. desktop `1440x900`
    2. desktop `1920x1080`
    3. mobile `390x844`
    4. mobile `430x932`
    5. tablet `768x1024`
    6. tablet `834x1194`
35. On mobile, the page must preserve the same decision hierarchy:
    1. controls
    2. slate/focused matchup
    3. top adds
    4. player insight
    5. goalie risk
    6. team context
36. On mobile, dense tables must become horizontally safe compact rows, accordions, or ranked lists without hiding core decision labels.
37. The implementation must not introduce SVG-only hero art, marketing copy, gradient orbs, decorative blobs, or oversized landing-page sections.
38. The new page must use team logos, player headshots, icon buttons, sparklines, status chips, and compact charts where they support real decisions.
39. The new page must include no more than `2` to `3` compact charts visible at once on desktop.
40. The implementation must include tests for:
    1. route render
    2. URL filter parsing
    3. module state aggregation
    4. data normalization
    5. top-add scoring/filtering
    6. stale/fallback banner behavior
    7. click-through context preservation
41. Before replacing `/forge/dashboard`, the implementation must run:
    1. focused unit/page tests
    2. TypeScript check
    3. production build
    4. browser visual verification screenshots
42. The new route must keep the current `/forge/dashboard` available as rollback until the user approves promotion.

## 5. Non-Goals (Out of Scope)

1. This PRD does not require changing the projection model math.
2. This PRD does not require changing Supabase schema.
3. This PRD does not require replacing `run-forge-projections.ts`.
4. This PRD does not require rebuilding the rolling-player pipeline.
5. This PRD does not require adding a new external data provider.
6. This PRD does not require removing `/FORGE`, `/forge/dashboard`, `/forge/player/[playerId]`, or `/forge/team/[teamId]` during initial build.
7. This PRD does not require betting-focused workflows.
8. This PRD does not require authentication or per-user league personalization.
9. This PRD does not require every historical artifact or older dashboard component to be deleted.
10. This PRD does not authorize visual polish that hides stale, fallback, or incomplete data states.

## 6. Design Considerations

1. The design target is closer to `dashboardInspo.png`: a compact analytics terminal with strong top nav, hard panel edges, small uppercase labels, scan-friendly data tables, and bright status accents.
2. The first image supports the broader dashboard inventory: start chart, games, hot/cold players, waiver adds, team trends, and power rankings.
3. The second image is the stronger page-shape reference for the new build: Team Power Terminal, Focused Slate + Goalie Context, Top Adds Watchlist, Player Insight Core.
4. The page should use a dark charcoal/black base with cyan for active/focus, green for positive/actionable, red for risk/fade, yellow/orange for caution, and muted gray for baseline.
5. Cards should be tight panels with `8px` or smaller radius unless existing FHFH styles require less.
6. Avoid nested cards. Use full-width dashboard bands and panels, not cards inside cards.
7. Text must remain compact and readable; no hero-scale type inside dashboard panels.
8. Sparklines should be small and supportive, not decorative.
9. Tables should lead with the fastest decision columns and push secondary evidence rightward.
10. Icon buttons should use the existing icon library if available.
11. Every number must have enough label context that a junior user can understand whether higher is good, risky, stale, or neutral.
12. The page must avoid one-note palette drift; cyan should be an accent, not the entire design.

## 7. Technical Considerations

### 7.1 Existing Surfaces To Reuse Carefully

1. `web/pages/forge/dashboard.tsx`
   - Use as a behavioral reference, not the base file for the rebuild.
2. `web/pages/FORGE.tsx`
   - Use preview-fetch and fallback handling ideas, but avoid copying the preview page structure into the command center.
3. `web/components/forge-dashboard/*`
   - Reuse logic only after checking whether the component contract is still suitable.
4. `web/lib/dashboard/normalizers.ts`
   - Reuse and extend for command-center view models.
5. `web/lib/dashboard/freshness.ts`
   - Reuse for requested/resolved date and stale-state handling.
6. `web/lib/dashboard/topAddsRanking.ts`
   - Reuse for top adds scoring unless the scoring formula is revised in a separate PRD.
7. `web/lib/dashboard/playerOwnership.ts`
   - Reuse for Yahoo ownership snapshots and trends.
8. `web/lib/dashboard/teamContext.ts`
   - Reuse for power, CTPI, and matchup edge utilities.
9. `web/lib/dashboard/forgeLinks.ts`
   - Reuse for route context parsing/building and extend if needed.

### 7.2 Primary APIs

The command center should consume or wrap these APIs:

1. `/api/v1/start-chart`
2. `/api/v1/forge/players`
3. `/api/v1/forge/goalies`
4. `/api/team-ratings`
5. `/api/v1/trends/team-ctpi`
6. `/api/v1/sustainability/trends`
7. `/api/v1/trends/skater-power`
8. `/api/v1/transactions/ownership-trends`
9. `/api/v1/transactions/ownership-snapshots`
10. `/api/v1/runs/latest` if page-level run status is needed

### 7.3 Source Tables

The implementation must treat these as important source surfaces:

1. `forge_runs`
2. `forge_player_projections`
3. `forge_team_projections`
4. `forge_goalie_projections`
5. `goalie_start_projections`
6. `games`
7. `players`
8. `teams`
9. `rosters`
10. `yahoo_players`
11. `team_power_ratings_daily`
12. `team_ctpi_daily`
13. `sustainability_scores`
14. `rolling_player_game_metrics`
15. `lineCombinations`
16. `powerPlayCombinations`
17. `forge_player_game_strength`
18. `forge_team_game_strength`
19. `forge_goalie_game`

### 7.4 Pipeline Constraints

The command center must respect the current pipeline order:

1. core entity freshness
2. upstream skater sources
3. contextual builders
4. rolling player recompute
5. projection input ingest
6. projection derived build
7. projection execution
8. accuracy refresh
9. monitoring

The page must not imply that a successful downstream accuracy refresh makes stale projections healthy.

### 7.5 Audit Findings That Shape This PRD

1. The deep research report says FORGE should treat prediction as matchup-and-state dependent, with explicit home/rest/special-teams/goalie context and pregame-safe rolling features.
2. The deep research report says goalie prediction needs uncertainty and starter probability, not a thin point estimate.
3. The previous dashboard PRD already concluded that the current page should be recomposed, not simply restyled.
4. The component health audit found repeated stale and mixed-cadence risks across slate, top adds, team context, sustainability, trend movement, goalie risk, landing, and drill-in routes.
5. Later audit artifacts show progress on tests, freshness policy, and launch gates, but the route remains an accumulation of remediation work rather than a clean target architecture.
6. The source-surface audit says the strongest dashboard bands are slate, top adds, team trend context, player insight, goalie/risk, and supporting drill-ins.
7. The component consolidation plan recommends shared families for slate matchup, team context, player opportunity, trend signals, search/drill-ins, and section shells.
8. Current APIs already expose useful fallback and degraded metadata; the new page must aggregate and present that metadata instead of hiding it in child modules.

### 7.6 Recommended Architecture

1. Create `web/pages/forge/command-center.tsx` as a thin page shell.
2. Create a command-center data hook or loader under `web/lib/dashboard/commandCenterData.ts`.
3. Create command-center view-model types under `web/lib/dashboard/commandCenterTypes.ts`.
4. Create reusable command-center UI components under `web/components/forge-command-center/`.
5. Keep module components mostly presentational; the data layer should normalize API responses before rendering.
6. Prefer one coordinated fetch layer over independent child component fetches.
7. Keep existing `web/components/forge-dashboard/` components intact unless a component is deliberately extracted or superseded.
8. Add page tests under `web/__tests__/pages/forge/command-center.test.tsx`.
9. Add focused data tests under `web/lib/dashboard/commandCenterData.test.ts` or equivalent.

### 7.7 Suggested Component Families

1. `CommandCenterShell`
2. `CommandCenterTopNav`
3. `CommandCenterControls`
4. `TeamPowerTerminal`
5. `FocusedSlateContext`
6. `TopAddsWatchlist`
7. `PlayerInsightCore`
8. `MomentumTracker`
9. `GoalieContextPanel`
10. `StatusChip`
11. `MetricPill`
12. `TrendSparkline`
13. `ModuleState`
14. `MixedStateBanner`

## 8. Success Metrics

1. The new route is visually closer to the supplied dashboard references than the current `/forge/dashboard`.
2. A user can identify tonight’s best slate, best adds, highest risk goalies, and top trust/fade players in the first two viewport bands.
3. The page shows one coherent mixed-state summary when data comes from multiple resolved dates.
4. Each module exposes clear stale, fallback, empty, and error states.
5. The page preserves route context across player, team, start-chart, and trends drill-ins.
6. Top Adds returns actionable players in the default `25%` to `75%` ownership band when data exists.
7. Player Insight distinguishes sustainability from momentum and does not blur hot/cold into trust/fade.
8. Desktop screenshots at `1440x900` and `1920x1080` show no overlapping content, clipped text, or incoherent density.
9. Mobile screenshots at `390x844` and `430x932` keep the core decision hierarchy usable.
10. Focused tests, TypeScript, and production build pass before route promotion.

## 9. Open Questions

1. Should the new scratch route be `/forge/command-center`, `/forge/dashboard-v2`, or another route name before promotion?
   - Recommended default: `/forge/command-center`.
2. Should the visual target lean more toward Image #2’s terminal design or Image #1’s broader all-in-one dashboard?
   - Recommended default: `70%` Image #2, `30%` Image #1.
3. Should `/FORGE` remain a quick preview page after the new command center launches?
   - Recommended default: yes, keep `/FORGE` as a preview/entry route.
4. Should the new route initially use only existing APIs, or may it create one command-center aggregate API to reduce client fetch coordination?
   - Recommended default: start with existing APIs plus a client/server data adapter; create an aggregate API only if request coordination becomes brittle.
5. Should command-center promotion replace `/forge/dashboard` immediately after validation, or should both routes coexist for one release cycle?
   - Recommended default: coexist for one release cycle.
6. Should the implementation include any formula changes to top-add scoring, sustainability, goalie risk, or team power?
   - Recommended default: no formula changes in this PRD; preserve current math and improve composition/trust presentation first.
