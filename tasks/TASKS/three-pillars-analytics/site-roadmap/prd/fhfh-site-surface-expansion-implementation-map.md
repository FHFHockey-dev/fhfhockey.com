# FHFH Site Surface Expansion Implementation Map

This note locks the route ownership, naming, and cross-link assumptions for parent task `1.0` in `tasks/tasks-prd-fhfh-site-surface-expansion-roadmap.md`.

## Canonical Surface Map

| Product need | Canonical destination | Notes |
| --- | --- | --- |
| Homepage slate summary | `/` | Keep lightweight and route users into deeper tools instead of expanding into a full dashboard. |
| Recent form and player comparison hub | `/trends` | Primary destination for trend scanning, team pulse, and player recent-vs-baseline workflows. |
| Player trend deep dive | `/trends/player/[playerId]` | Canonical player-level recent-form and baseline-comparison detail route. |
| Team destination | `/stats/team/[teamAbbreviation]` | Primary team surface for dashboard, schedule, shot map, roster, and future team-context expansion. |
| Lines landing | `/lines` | Entry point for line-combination workflows. |
| Team-specific lines | `/lines/[abbreviation]` | Canonical deployment and PP personnel destination for a single team. |
| Goalie workflow | `/variance/goalies` | Canonical user-facing goalie consistency and weekly-summary destination; `/goalies` remains a redirect alias and `web/pages/goalies.js` remains the shared implementation module. |
| Start or sit matchup board | `/start-chart` | Canonical entry point for starter-context and matchup-planning views. |
| Schedule-planning grid | `/game-grid/7-Day-Forecast` | Treat `/game-grid` as a redirect only, not the canonical shared link target. |
| WGO explainer charts | `/wigoCharts` | Keep as the explanatory chart home, but avoid overlapping it with team-page or trends ownership. |
| Underlying-stats landing | `/underlying-stats` | Supporting reference surface, not the primary home for this roadmap. |
| Splits decision surface | `/splits` | Planned dedicated route if trends cannot carry the UX cleanly. |

## Overlap Decisions

- Use `/stats/team/[teamAbbreviation]` as the canonical team destination.
- Treat `/teamStats` and `/teamStats/[teamAbbreviation]` as legacy or transitional surfaces and do not expand them for roadmap work.
- Use `/variance/goalies` as the canonical goalie surface. Keep `/goalies` as a redirect alias and reuse its implementation module instead of building a competing workflow.
- Treat `/trueGoalieValue` as supporting or experimental until the goalie workflow is consolidated.
- Use `/trends` as the canonical recent-form hub.
- Keep `/wigoCharts` focused on explanatory charting instead of letting it absorb generic navigation or trend-scanning responsibilities.
- Use `/game-grid/7-Day-Forecast` as the canonical game-grid share target because `/game-grid` redirects.

## User-Facing Naming Rules

- Use `Trends Dashboard` for `/trends`.
- Use `Starter Board` for `/start-chart`.
- Use `Game Grid` for `/game-grid/7-Day-Forecast`.
- Use `Team HQ` in navigation copy when linking into `/stats/team/[teamAbbreviation]`.
- Use `Lines` or `Line Combinations` for `/lines` and `/lines/[abbreviation]`.
- Use `Goalie View` or `Goalie Trends` for `/goalies`, depending on available page context.
- Use `Explanatory Charts` in descriptive copy for `/wigoCharts`; retain `WiGO / WGO` only as an alias.
- Use `Player Evaluation Toolkit` in descriptive copy for `PELT` until a public-facing short name is intentionally chosen.
- Pair `Breakout Barometer` and `Value Cost Delta` with descriptive subtitles whenever they surface in UI.

## Experimental Toolkit Scope

- Treat the live skater Rankings matrix and Player Snapshot as the first `Player Evaluation Toolkit` foundation; retain `PELT` only as an internal alias.
- Stage `Breakout Barometer` inside Rankings Trending with exactly `TOI`, `SOG/60`, `iSCF/60`, `iXG/60`, and `iHDCF/60` for its first experiment. Do not create a standalone route or live score until that bounded channel is implemented and validated.
- Stage `Value Cost Delta` inside Draft Dashboard as projection/VORP rank versus Yahoo ADP plus next-pick availability. Preserve league scoring/projection provenance and treat missing ADP as unavailable, never zero cost.
- Keep both experiments inside the collapsed, explicitly labeled Rankings roadmap shell until implementation is ready; planned cards must not behave like live ranking or draft recommendations.

## Cross-Link Contract For Phase 1

- Homepage must link into `Starter Board`, `Goalie View`, `Trends Dashboard`, `Game Grid`, and `Lines`.
- Trends must link into `Starter Board`, `Game Grid`, `Goalie View`, and `Lines`.
- Team pages must link into the matching team `Lines` page plus `Starter Board`, `Game Grid`, and `Trends`.
- Team lines pages must link back to the matching `Team HQ` page plus `Starter Board`, `Game Grid`, and `Trends`.
- `Start Chart` must link into `Trends`, `Game Grid`, `Lines`, and `Goalie View`.
- `Goalies` must link into `Starter Board`, `Trends`, and `Game Grid`.
- `Game Grid` must link into `Starter Board`, `Trends`, `Goalie View`, and `Lines`.

## Shared Data And Freshness Contract

The roadmap extends the existing product contracts below; it does not add a parallel endpoint solely for presentation.

| Surface | Reused contract | Freshness behavior |
| --- | --- | --- |
| Homepage | Existing NHL schedule/game-center reads, persisted status/standings data, and `/api/v1/games` date reads | Live-slate exception: server output is cached for 60 seconds with a 120-second stale window, and date changes reload the slate plus live game-center clocks. Daily is sufficient for non-live summary sources. |
| Trends and Team HQ | Existing Trends loaders/APIs, `team_summary_years`, dated WGO/xG helpers, canonical line rows, and paginated dated team-power snapshots | Request-time/on-mount reads expose source dates. Daily source refresh is the default; no synthetic same-day freshness is claimed for historical timelines or opponent strength. |
| Lines and PP context | Existing `lineCombinations`, bounded recent-game stat aggregation, PP personnel/history, and PP shot-share helpers | Lines exception: the canonical team lines route uses 60-second ISR because deployment can change within a slate day. Source/provider rollout stays owned by A-GDL. |
| Goalie consistency/workload | Existing `goalie_stats_unified` client read and shared weekly calculation/metric helpers | Goalie-start exception: the canonical route reads current stored goalie rows on mount. Starts/role context may refresh within the slate day; weekly consistency bands are recomputed from the stored season sample and do not imply live win-probability updates. |
| Game Grid | Existing schedule hooks/payload, opponent-metrics helper, and four-week shaping helper | Schedule-planning data loads for the selected window. Daily refresh is the normal planning contract; users can reload when the provider publishes a same-day schedule change. |
| WGO explanatory charts | Existing `nst_team_5v5` and `wgo_team_stats` tables with bounded 22-day as-of windows | Daily source refresh is the default. Each card exposes its actual source range, and mixed-recency remains visible rather than being presented as a single synchronized snapshot. |
| Rankings/toolkit shell | Existing Rankings APIs/SWR matrix, metric registry, trending foundation, and Player Snapshot | Rankings uses request-keyed SWR with a 30-second dedupe interval and no focus revalidation; displayed source/sample context governs freshness. Planned experiments add no new live data contract yet. |

All Supabase reads added by this roadmap are either provably bounded below the page cap or explicitly paginated. A dedicated API is warranted only when a future surface cannot preserve authorization, completeness, pagination, or shared semantics through one of these contracts.

## V1 Closeout And Deferred Work

- Goalie quality-of-competition remains optional until a verified opponent-quality join can distinguish role changes without inventing precision.
- Breakout Barometer remains a planned Rankings Trending experiment until its five-metric signal is implemented and validated.
- Value Cost Delta remains a planned Draft Dashboard experiment until projection/VORP, Yahoo ADP, next-pick availability, and scoring provenance can be joined without treating missing ADP as zero.
- `/splits` remains uncreated; the current Trends/Rankings split foundations should be extended first unless a dedicated workflow is justified by measured UX evidence.
- Production/provider rollout for line-source ingestion remains in A-GDL, and broader Sustainability/history coverage remains in A-SUST; this roadmap does not duplicate those operational gates.
- The ranking-vote concept and a broad live-site redesign remain out of scope.

## Deferred And Out-Of-Scope For This Parent Task

- Do not build the ranking-vote concept.
- Do not commit to a live-site redesign.
- Do not move ownership of WGO charts while parallel WGO chart work is in flight.
- Do not create `/splits` yet unless a later parent task explicitly takes it on.
