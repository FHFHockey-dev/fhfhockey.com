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
| Goalie workflow | `/goalies` | Canonical user-facing goalie consistency and weekly-summary destination. |
| Start or sit matchup board | `/start-chart` | Canonical entry point for starter-context and matchup-planning views. |
| Schedule-planning grid | `/game-grid/7-Day-Forecast` | Treat `/game-grid` as a redirect only, not the canonical shared link target. |
| WGO explainer charts | `/wigoCharts` | Keep as the explanatory chart home, but avoid overlapping it with team-page or trends ownership. |
| Underlying-stats landing | `/underlying-stats` | Supporting reference surface, not the primary home for this roadmap. |
| Splits decision surface | `/splits` | Planned dedicated route if trends cannot carry the UX cleanly. |

## Overlap Decisions

- Use `/stats/team/[teamAbbreviation]` as the canonical team destination.
- Treat `/teamStats` and `/teamStats/[teamAbbreviation]` as legacy or transitional surfaces and do not expand them for roadmap work.
- Use `/goalies` as the canonical goalie surface.
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

## Cross-Link Contract For Phase 1

- Homepage must link into `Starter Board`, `Goalie View`, `Trends Dashboard`, `Game Grid`, and `Lines`.
- Trends must link into `Starter Board`, `Game Grid`, `Goalie View`, and `Lines`.
- Team pages must link into the matching team `Lines` page plus `Starter Board`, `Game Grid`, and `Trends`.
- Team lines pages must link back to the matching `Team HQ` page plus `Starter Board`, `Game Grid`, and `Trends`.
- `Start Chart` must link into `Trends`, `Game Grid`, `Lines`, and `Goalie View`.
- `Goalies` must link into `Starter Board`, `Trends`, and `Game Grid`.
- `Game Grid` must link into `Starter Board`, `Trends`, `Goalie View`, and `Lines`.

## Deferred And Out-Of-Scope For This Parent Task

- Do not build the ranking-vote concept.
- Do not commit to a live-site redesign.
- Do not move ownership of WGO charts while parallel WGO chart work is in flight.
- Do not create `/splits` yet unless a later parent task explicitly takes it on.
