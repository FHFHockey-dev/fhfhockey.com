# FORGE Dashboard Component Health Inventory

## Purpose

This inventory is the baseline map for the FORGE component-health audit.

Each in-scope surface is listed as a full chain:

- rendering surface
- owning route
- shared adapters or helpers
- serving API routes
- primary source tables or upstream datasets

This artifact is intentionally structural. It does **not** yet score health or assign `green / yellow / red` status. That comes later.

## In-Scope Rendering Surfaces

### 1. Dashboard Shell

| Surface | Owning route | Shared adapters / helpers | Serving APIs | Primary source tables / datasets | Notes |
| --- | --- | --- | --- | --- | --- |
| Dashboard band aggregator | [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) | `ForgeRouteNav`, band-level status aggregation, ownership-band controls, mobile band-state logic | None directly; composes card-level APIs | Indirect only through child cards | The shell is operationally important because it decides how partial failures become band-level loading, stale, degraded, or empty states. |
| Route navigation surface | [ForgeRouteNav.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/ForgeRouteNav.tsx) | Static route map | None | None | No direct data dependency, but it still matters for route-family integrity and drill-in consistency. |

### 2. Slate Context

| Surface | Owning route | Shared adapters / helpers | Serving APIs | Primary source tables / datasets | Notes |
| --- | --- | --- | --- | --- | --- |
| Slate hero card | [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx) inside [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) | `normalizeStartChartResponse`, `fetchCachedJson`, `getGamePowerEdge`, `getTeamMetaById` | `/api/v1/start-chart` | `games`, `player_projections`, `goalie_start_projections`, `yahoo_nhl_player_map_mat`, `yahoo_players`, `team_ctpi_daily`, plus team-ratings data from `team_power_ratings_daily` / `team_power_ratings_daily__new` via `fetchTeamRatings(...)` | Main slate-facing dashboard component. It relies on Start Chart fallback behavior and inherits mixed-source freshness risk from that route. |
| Slate preview module | [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) | `fetchCachedJson`, `normalizeStartChartResponse` | `/api/v1/start-chart` | Same as Slate hero card | Preview surface should stay semantically aligned with the full slate hero, but it currently reimplements the preview composition in-page instead of reusing the card component. |

### 3. Player Opportunity

| Surface | Owning route | Shared adapters / helpers | Serving APIs | Primary source tables / datasets | Notes |
| --- | --- | --- | --- | --- | --- |
| Top Adds rail | [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) inside [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) | `fetchCachedJson`, `rankTopAddsCandidates`, `buildTopAddsScheduleContextMap`, `useSchedule`, `teamsInfo` | `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends` | `forge_runs`, `forge_player_projections`, `seasons`, `rosters`, `yahoo_players`, plus local schedule helper data | Opportunity surface merges two APIs and a schedule helper. Its correctness depends on projection freshness, Yahoo ownership freshness, and rank-formula integrity. |
| FORGE landing Top Adds preview | [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) | `fetchCachedJson`, `rankTopAddsCandidates` | `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends` | Same as Top Adds rail | Preview does its own merge and filtering. It should be checked for drift from the main Top Adds rail behavior. |
| Player detail opportunity surface | [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/player/[playerId].tsx) | `fetchOwnershipContextMap`, `scoreTopAddsCandidate`, `useTeamSchedule` | `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends`, `/api/v1/transactions/ownership-snapshots` | `forge_runs`, `forge_player_projections`, `seasons`, `rosters`, `yahoo_players`, schedule helper data | This route is the drill-in destination for opportunity cards and should stay aligned with the Top Adds card contract. |

### 4. Team Context

| Surface | Owning route | Shared adapters / helpers | Serving APIs | Primary source tables / datasets | Notes |
| --- | --- | --- | --- | --- | --- |
| Team Trend Context card | [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx) inside [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) | `normalizeTeamRatings`, `normalizeCtpiResponse`, `normalizeStartChartResponse`, `buildSlateMatchupEdgeMap`, `computeCtpiDelta`, `computeTeamPowerScore` | `/api/team-ratings`, `/api/v1/trends/team-ctpi`, `/api/v1/start-chart` | `team_power_ratings_daily`, `team_power_ratings_daily__new`, `team_ctpi_daily`, fallback CTPI sources `nst_team_gamelogs_as_rates`, `nst_team_gamelogs_as_counts`, `nst_team_gamelogs_pp_counts`, `nst_team_gamelogs_pk_counts`, plus Start Chart tables | Mixed-source component with known risk: team ratings, CTPI, and slate matchup data can have different freshness cadences. |
| Team detail route | [team/[teamId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/team/[teamId].tsx) | `useTeamSchedule`, `normalizeTeamRatings`, `normalizeCtpiResponse`, `normalizeStartChartResponse`, `buildSlateMatchupEdgeMap`, `computeCtpiDelta`, `computeTeamPowerScore` | `/api/team-ratings`, `/api/v1/trends/team-ctpi`, `/api/v1/start-chart` | Same as Team Trend Context card plus schedule helper data | Drill-in route for team clicks. It should be semantically consistent with Team Trend Context rather than becoming a separate logic branch. |

### 5. Sustainability

| Surface | Owning route | Shared adapters / helpers | Serving APIs | Primary source tables / datasets | Notes |
| --- | --- | --- | --- | --- | --- |
| Sustainable vs Unsustainable card | [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx) inside [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) | `normalizeSustainabilityResponse`, `fetchCachedJson`, `describePlayerSignalFrame`, `describeSustainabilityBand`, `resolveInsightTone`, `fetchOwnershipContextMap` | `/api/v1/sustainability/trends`, `/api/v1/transactions/ownership-trends`, `/api/v1/transactions/ownership-snapshots` | `sustainability_scores`, `player_baselines`, `yahoo_players` | This component combines long-horizon sustainability signals with ownership-band filtering and explanation-language mapping. |
| FORGE landing sustainability preview | [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) | `fetchCachedJson`, `normalizeSustainabilityResponse` | `/api/v1/sustainability/trends` | `sustainability_scores`, `player_baselines` | Preview uses hot/cold sustainability pulls directly and may drift from the dashboard card’s ownership-aware filtering and explanation contract. |

### 6. Trend Movement

| Surface | Owning route | Shared adapters / helpers | Serving APIs | Primary source tables / datasets | Notes |
| --- | --- | --- | --- | --- | --- |
| Hot / Cold and Trending Up / Down card | [HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx) inside [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) | `normalizeSkaterTrendResponse`, `fetchCachedJson`, `describePlayerSignalFrame`, `describeTrendBand`, `resolveInsightTone`, `fetchOwnershipContextMap` | `/api/v1/trends/skater-power`, `/api/v1/transactions/ownership-trends`, `/api/v1/transactions/ownership-snapshots` | `player_trend_metrics`, `players`, `yahoo_players` | Short-term movement surface. It has its own meaning and should not be treated as a sustainability alias. |

### 7. Goalie Risk

| Surface | Owning route | Shared adapters / helpers | Serving APIs | Primary source tables / datasets | Notes |
| --- | --- | --- | --- | --- | --- |
| Goalie decision band | [GoalieRiskCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/GoalieRiskCard.tsx) inside [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) | `normalizeGoalieResponse`, `fetchCachedJson` | `/api/v1/forge/goalies` | `forge_runs`, `forge_goalie_projections`, `forge_projection_calibration_daily`, `games` | Goalie surface is fully FORGE-backed and depends on run resolution, calibration hints, and uncertainty metadata. |

## Shared Adapter And Helper Surfaces

These are not user-facing components by themselves, but they are critical to source-to-UI integrity and must be treated as part of the audit chain.

| Shared surface | Role in the chain | Current downstream consumers |
| --- | --- | --- |
| [normalizers.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts) | Converts raw API payloads into dashboard-specific contracts. A likely drift point if nulls are coerced or fields are silently dropped. | Slate, team context, sustainability, skater trends, goalie band |
| [teamContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.ts) | Shared interpretation layer for team power score, CTPI delta, and matchup-edge logic. | TeamPowerCard, SlateStripCard, team detail route, Trends/Underlying Stats alignment work |
| [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts) | Shared Yahoo ownership context fetcher and merger for dashboard player surfaces. | SustainabilityCard, HotColdCard, player detail route |
| [topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts) | Dashboard-owned Top Adds scoring and ordering contract. | TopAddsRail, FORGE landing preview, player detail score presentation |
| [topAddsScheduleContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsScheduleContext.ts) | Adds week-mode schedule context to Top Adds. | TopAddsRail |

## Route Family Summary

The route family currently breaks into three operational layers:

1. Primary dashboard route
   - [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
   - owns the six main dashboard modules and aggregates their band-level status

2. Preview route
   - [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
   - composes slate, Top Adds, and sustainability previews without fully reusing the main dashboard components

3. Drill-in routes
   - [team/[teamId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/team/[teamId].tsx)
   - [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/player/[playerId].tsx)
   - these must remain consistent with the originating card semantics on the dashboard

## Current Cron Ownership And Runtime Expectations

This section maps the **current** scheduled ownership visible in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md) into the component families above.

The goal here is to make current ownership explicit, including where it is incomplete or indirect.

### Legend

- `Freshness target` comes from [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts) where a dashboard policy already exists.
- `Serving runtime` comes from [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts) where a dashboard endpoint budget already exists.
- `Refresh timeout` refers to the HTTP timeout currently defined for upstream cron jobs in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md).

### Component-Family Refresh Map

| Component family | Current scheduled refresh chain | Freshness target | Serving runtime expectation | Current ownership notes |
| --- | --- | --- | --- | --- |
| Slate context | `update-games` pre-ingestion slot, `update-yahoo-players` at `08:40 UTC`, `update-team-ctpi-daily` at `09:10 UTC`, `update-team-power-ratings` at `09:15 UTC`, `update-team-power-ratings-new` at `09:20 UTC`, `update-goalie-projections-v2` at `09:30 UTC`, `update-start-chart-projections` at `09:40 UTC`, `daily-refresh-matview` for `yahoo_nhl_player_map_mat` at `10:00 UTC` | `start-chart` max age `30h` (`error`) | `/api/v1/start-chart` target `p95 900ms`, payload budget `300 KB` | Slate is explicitly scheduled, but it is still a mixed-source chain. A stale upstream job can leave the route usable-looking while one part of the context is older than the rest. |
| Player opportunity / Top Adds | `update-yahoo-players` at `08:40 UTC`, static additions `update-season-stats` at `10:20 UTC`, `update-sko-stats` at `10:30 UTC`, `update-wgo-averages` at `10:35 UTC`, `update-predictions-sko` at `10:45 UTC`, plus the FORGE chain `ingest-projection-inputs` at `09:45 UTC`, `build-forge-derived-v2` at `09:50 UTC`, and `run-forge-projection-v2` at `10:05 UTC` | No explicit dashboard freshness policy is currently codified for `/api/v1/forge/players` or the Yahoo ownership APIs | No explicit dashboard endpoint budget is currently codified for `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends`, or `/api/v1/transactions/ownership-snapshots` | Top Adds has a visible scheduled chain, but its freshness policy and serving runtime budget are still implicit rather than formalized in the dashboard health helpers. |
| Team context | `update-wgo-teams` at `09:35 UTC`, `update-team-ctpi-daily` at `09:10 UTC`, `update-team-power-ratings` at `09:15 UTC`, `update-team-power-ratings-new` at `09:20 UTC`, SQL `refresh-team-power-ratings-daily` at `10:15 UTC`, `update-nst-team-daily` at `09:55 UTC`, static additions `update-nst-team-daily` at `10:50 UTC`, and `nst-team-stats` at `10:55 UTC`, plus the older `update-nst-tables-all` at `08:10 UTC` | `team-ratings` max age `30h` (`error`); `team-ctpi` max age `72h` (`warn`) | `/api/team-ratings` target `p95 800ms`, payload budget `120 KB`; `/api/v1/trends/team-ctpi` target `p95 800ms`, payload budget `180 KB` | Team context is the clearest mixed-cadence family. It also has multiple team-power writers, which should be treated as ownership complexity rather than evidence of health. |
| Sustainability | Upstream raw inputs are scheduled through `update-nst-gamelog` at `07:25 UTC`, `update-all-wgo-skaters` at `07:30 UTC`, `update-nst-current-season` at `08:45 UTC`, static `update-season-stats` at `10:20 UTC`, and static `rebuild-sustainability-baselines` at `10:40 UTC` | `sustainability` max age `72h` (`warn`) | `/api/v1/sustainability/trends` target `p95 850ms`, payload budget `140 KB` | The current schedule clearly covers some upstream sustainability inputs and `player_baselines`, but it does **not** clearly schedule `rebuild-priors`, `rebuild-window-z`, `rebuild-score`, or `rebuild-trend-bands`. Current ownership for `sustainability_scores` is therefore incomplete. |
| Trend movement | Upstream raw player data is refreshed by general stats jobs such as `update-season-stats`, `update-sko-stats`, and related player-stat ingestion, but no explicit cron entry was found for rebuilding `player_trend_metrics` through `/api/v1/trends/player-trends` | `skater-power` max age `72h` (`warn`) | `/api/v1/trends/skater-power` target `p95 900ms`, payload budget `280 KB` | This is currently an ownership gap. The serving API is budgeted and freshness-scored, but the explicit scheduled writer for `player_trend_metrics` is not present in the current cron schedule. |
| Goalie risk | `update-goalie-projections-v2` at `09:30 UTC`, `build-forge-derived-v2` at `09:50 UTC`, `run-forge-projection-v2` at `10:05 UTC`, plus the general `update-games` pre-ingestion slot | `forge-goalies` max age `30h` (`error`) | `/api/v1/forge/goalies` target `p95 800ms`, payload budget `220 KB` | Goalie risk has the cleanest explicit FORGE-backed chain among the dashboard card families, but it still depends on broader projection-ingest health upstream. |
| Route previews and drill-ins | No independent cron ownership; `FORGE.tsx`, team detail, and player detail inherit the chains of the component families they preview or drill into | Inherit the strictest relevant underlying target | Inherit the underlying API budgets of the surfaces they call | These routes should not be scored from cron ownership independently. They should inherit and expose the operational state of their underlying data families. |

### Current Refresh Timeout Patterns Seen In Schedule

The current schedule uses two relevant timeout patterns for the dashboard’s upstream jobs:

1. `100000ms`
   - CTPI refresh
   - Yahoo players
   - several legacy or older NST/team jobs
2. `300000ms`
   - team power ratings
   - Start Chart projections
   - static jobs added for season stats, SKO stats, WGO averages, sustainability baselines, predictions, and NST team refreshes

These timeout values are not the same thing as serving endpoint budgets, but they do establish the current operational ceiling for the refresh chain.

## Immediate Takeaways From Inventory

1. The main dashboard is not backed by one shared server-assembled payload. It is a composition of multiple client-side fetches and shared adapters.
2. Start Chart data is reused in more places than just the slate hero. It also influences team context and preview surfaces.
3. Team context is the first obviously mixed-cadence component because it depends on team ratings, CTPI, and slate matchup context simultaneously.
4. Player opportunity and player insight surfaces depend on Yahoo ownership data in different ways:
   - Top Adds merges ownership directly into its ranking board
   - sustainability and trend movement use ownership as a discovery filter and supporting context
5. The FORGE landing route is not just a static gateway. It is already a data-backed preview layer and must be audited like a real operational surface.
6. The shared normalizer/helper layer is important enough to be part of the audit, because source-to-UI drift can happen there without any visible route-level code change.
7. The component families do **not** have equally mature cron ownership:
   - slate and goalie paths are fairly explicit
   - team context is explicit but mixed and duplicated
   - Top Adds is explicit but still missing formal dashboard freshness/runtime policy
   - sustainability is only partially explicit
   - trend movement currently has a visible writer-gap in the schedule

## Deferred To Later Audit Steps

The following are intentionally not finalized in `1.1`:

- final `green / yellow / red` scoring
- degraded-state verdicts
- source-to-UI reconciliation procedures

Those are handled in later `1.x` subtasks and the component-specific audit passes.
