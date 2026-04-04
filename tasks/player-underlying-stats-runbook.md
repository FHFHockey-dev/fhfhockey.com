# Player Underlying Stats Runbook

## TL;DR

This feature ships two shared surfaces:

- landing page: `web/pages/underlying-stats/playerStats/index.tsx`
- detail page: `web/pages/underlying-stats/playerStats/[playerId].tsx`

Both surfaces use:

- one shared filter-state contract
- one shared wide-table contract
- one shared server aggregation engine in `web/lib/underlying-stats/playerStatsLandingServer.ts`

The steady-state production path is:

1. raw NHL Gamecenter ingest
2. normalized event + shift coverage
3. persisted per-game underlying summary refresh
4. landing/detail reads from persisted summary partitions first
5. live normalized reconstruction only for missing games or unsupported cache paths

## Product Surfaces

### Landing Page

Route:

- `web/pages/underlying-stats/playerStats/index.tsx`

Purpose:

- master player table across the six stat families
- filter changes, sorting, pagination, and drill-down links

API route:

- `web/pages/api/v1/underlying-stats/players.ts`

### Detail Page

Route:

- `web/pages/underlying-stats/playerStats/[playerId].tsx`

Purpose:

- season-level or season-team log rows for one player
- same table/filter philosophy as landing
- `Against Specific Team` replaces landing `Team`

API route:

- `web/pages/api/v1/underlying-stats/players/[playerId].ts`

## Core Architecture

### Shared UI Contract

Primary modules:

- `web/components/underlying-stats/PlayerStatsFilters.tsx`
- `web/components/underlying-stats/PlayerStatsTable.tsx`
- `web/components/underlying-stats/playerStatsColumns.ts`
- `web/lib/underlying-stats/playerStatsFilters.ts`
- `web/lib/underlying-stats/playerStatsQueries.ts`
- `web/lib/underlying-stats/playerStatsTypes.ts`

Key rule:

- landing and detail should not drift into separate filter or table implementations

### Shared Transport Rules

- row payloads use camelCase keys
- numeric values stay raw; formatting is not done in the query layer
- TOI is transported in seconds
- percentage and ratio fields are transported as decimal fractions
- goalie rows may retain internal goalie identity metadata even though the visible table omits `Position`

### Shared Server Aggregation Contract

Primary engine:

- `web/lib/underlying-stats/playerStatsLandingServer.ts`

Responsibilities:

- source-game filtering
- persisted summary reads
- live normalized fallback reads
- landing grouping and detail grouping
- combine versus split traded-player behavior
- post-aggregation minimum TOI gating
- canonical sort + server pagination

### Shared Row Contract

Every row should carry:

- stable `rowKey`
- `playerId`
- `playerName`
- `teamLabel`
- `gamesPlayed`
- `toiSeconds`

Landing rows aggregate by:

- `player`
- `playerTeam`

Detail rows aggregate by:

- `season`
- `seasonTeam`

## Canonical Data Sources

Canonical day-one source stack:

- `public.nhl_api_pbp_events`
- `public.nhl_api_shift_rows`
- `public.nhl_api_game_roster_spots`
- `public.games`
- native shot-feature logic in `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts`
- native parity logic in `web/lib/supabase/Upserts/nhlNstParityMetrics.ts`

Compatibility/validation surfaces only:

- legacy `nst_gamelog_*`
- legacy `nst_gamelog_goalie_*`

Do not treat legacy NST tables as the source of truth for landing/detail scope logic.

## Persisted Summary Fast Path

Summary refresh route:

- `web/pages/api/v1/db/update-player-underlying-summaries.ts`

Storage strategy:

- persisted into `nhl_api_game_payloads_raw`
- legacy summary key family:
  - `derived://underlying-player-summary/{gameId}`
- current partitioned summary key family:
  - `derived://underlying-player-summary-v2/...`

Why this exists:

- full-season landing reads were too slow when reconstructed entirely from raw normalized data
- persisted per-game summary partitions let the landing/detail APIs reuse canonical derived metrics without a schema migration

## Raw Coverage And Shift Fallbacks

Raw ingest route family:

- `web/lib/supabase/Upserts/nhlRawGamecenterRoute.ts`
- `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`

Shift coverage strategy:

1. fetch NHL JSON shiftcharts endpoint
2. if a finished game returns empty shiftcharts, fall back to:
   - `TH*.HTM`
   - `TV*.HTM`
3. normalize parsed HTML report rows into `nhl_api_shift_rows`

Important operational fact:

- some finished NHL games expose valid PBP but empty JSON shiftcharts
- the HTML TOI report fallback is required for reliable season coverage

## Supported Day-One Filter Surface

### Supported Strengths

- `allStrengths`
- `evenStrength`
- `fiveOnFive`
- `powerPlay`
- `penaltyKill`

### Unsupported Strengths

These currently fail closed with route-level `400` responses:

- `fiveOnFourPP`
- `fourOnFivePK`
- `threeOnThree`
- `withEmptyNet`
- `againstEmptyNet`

### Supported Score State

- `allScores`

### Unsupported Score States

These currently fail closed with route-level `400` responses:

- `tied`
- `leading`
- `trailing`
- `withinOne`
- `upOne`
- `downOne`

### Season Type

Current support:

- `regularSeason`
- `playoffs`
- `preSeason` is still not a guaranteed steady-state operational path and should be treated cautiously until an explicit preseason coverage workflow is needed

## Shared Filter Semantics

### Scope Modifiers

Exactly one scope modifier may be active at a time:

- `none`
- `dateRange`
- `gameRange`
- `byTeamGames`

### Minimum TOI

- applied after aggregation
- same semantics across counts and rates
- retained in goalie mode

### Team Semantics

Landing:

- `teamId` means player team filter

Detail:

- `againstTeamId` means opponent-team filter
- landing `teamId` must not leak into detail state

### Traded Players

Landing:

- `combine` => one row per player
- `split` => one row per player-team

Detail:

- default => one row per season
- `split` => one row per season-team

## Canonical Grouping Keys

Landing grouping happens after the active sample is filtered and before:

- minimum TOI gating
- sorting
- pagination

Landing row keys:

- combine: `landing:player:{playerId}`
- split: `landing:playerTeam:{playerId}:{teamId}`

Detail grouping happens after the active sample is filtered and before:

- minimum TOI gating
- sorting
- pagination

Detail row keys:

- combine: `detail:season:{playerId}:{seasonId}`
- split: `detail:seasonTeam:{playerId}:{seasonId}:{teamId}`

Display rules:

- combined traded-player rows use ordered combined labels like `BOS / NJD`
- split rows keep a real single-team label
- detail `Against Specific Team` is only a filter, never a grouping dimension

## Scope Pipeline

Canonical order:

1. apply non-scope filters
2. build the eligible game universe
3. select scope-specific game ids
4. aggregate only those selected games
5. apply post-aggregation minimum TOI
6. sort and paginate

Do not:

- aggregate a full season first and clip it later
- select the scope window before team/opponent, venue, strength, or season filtering

### Date Range

- filters the eligible game universe by actual game date before aggregation

### Game Range

- appearance-anchored window
- uses the last `X` eligible player appearances
- missed team games do not occupy window slots

### By Team Games

- team-chronology anchored window
- uses the last `X` eligible team games
- a player may have fewer appearances than the selected team-game window if they missed some of those games

## Query And Sort Order

Canonical query order:

1. mode compatibility
2. route player id on detail
3. season span + season type
4. player/team/game context
5. team or opponent filter
6. venue + position filter
7. strength + score-state filtering
8. scope selection
9. combine/split grouping
10. minimum TOI gating
11. sort + paginate

Sort rules:

- every visible column is sortable
- numeric columns sort by raw numeric value
- text columns sort by normalized text
- nulls sort last in both directions
- final comparator must end in stable row identity

Default family sorts:

- `individualCounts` -> `totalPoints desc`
- `individualRates` -> `totalPointsPer60 desc`
- `onIceCounts` -> `xgfPct desc`
- `onIceRates` -> `xgfPct desc`
- `goalieCounts` -> `savePct desc`
- `goalieRates` -> `savePct desc`

## Table Contract

Table shell:

- `web/components/underlying-stats/PlayerStatsTable.tsx`

Rendering decision:

- `pagination`
- not virtualization

Why:

- server-side sorting and pagination are the scale strategy
- the client renders only the active page slice

Families:

- `individualCounts`
- `individualRates`
- `onIceCounts`
- `onIceRates`
- `goalieCounts`
- `goalieRates`

The shared column contract lives in:

- `web/components/underlying-stats/playerStatsColumns.ts`

That is the first file to update when adding or removing visible table columns.

## Explicit Derived Metrics

These are query-layer derivations, not direct persisted source columns:

- `IPP`
- `SH%`
- `Faceoffs %`
- `CF%`
- `FF%`
- `SF%`
- `GF%`
- `xGF%`
- `SCF%`
- `HDCF%`
- `HDGF%`
- `MDCF%`
- `MDGF%`
- goalie `SV%`
- goalie danger-split `SV%`
- `GSAA`
- `GSAA/60`
- goalie danger-split `GSAA`
- goalie danger-split `GSAA/60`
- `HD Goals Against`
- `LD Saves`
- `LD Goals Against`

Zero-denominator behavior:

- these fields should return `null`
- do not invent fallback percentages or per-60 values

## Explicitly Excluded Day-One Columns

These exist in parity/reference surfaces but are intentionally not part of the shipped page contract:

- `LDCA`
- `LDCF%`
- `LDGF`
- `LDGA`
- `LDGF%`
- `LDCA/60`
- `LDCF/60`
- `LDGF/60`
- `LDGA/60`
- on-ice `PDO`
- zone-start columns
- zone-faceoff columns

## Fallback Behavior

### Allowed Fallback

- `Individual Counts` may use a PBP-only fallback when a finished game has broken/empty shiftcharts

### Not Allowed As A Full Fallback

Do not fabricate TOI-dependent or on-ice context from PBP-only data for:

- `individualRates`
- `onIceCounts`
- `onIceRates`
- `goalieCounts`
- `goalieRates`

## Operational Refresh Order

Recommended nightly/postgame order:

1. raw Gamecenter ingest
2. normalized shift coverage completion, including HTML fallback when needed
3. summary refresh via `update-player-underlying-summaries`

Steady-state target:

- trigger raw ingest per finished game
- then trigger summary refresh for that same game
- use season backfill only for catch-up or repair

## Local Development Notes

- direct Postgres hostname resolution may fail in the local app runtime
- when that happens, landing/detail reads fall back to Supabase REST
- that fallback is functional, but persisted summary partitions are still required for acceptable full-season latency

## Testing Map

Core suites:

- `web/lib/underlying-stats/playerStatsFilters.test.ts`
- `web/components/underlying-stats/playerStatsColumns.test.ts`
- `web/components/underlying-stats/PlayerStatsTable.test.tsx`
- `web/lib/underlying-stats/playerStatsQueries.test.ts`
- `web/lib/underlying-stats/playerStatsLandingServer.test.ts`
- `web/pages/underlying-stats/playerStats/index.test.tsx`
- `web/pages/underlying-stats/playerStats/[playerId].test.tsx`
- `web/pages/api/v1/underlying-stats/players.test.ts`
- `web/pages/api/v1/underlying-stats/players/[playerId].test.ts`

Operational/backfill suites:

- `web/__tests__/pages/api/v1/db/update-nhl-shift-charts.test.ts`
- `web/lib/supabase/Upserts/nhlRawGamecenter.test.ts`
- `web/pages/api/v1/db/update-player-underlying-summaries.test.ts`

## Files Future Maintainers Will Actually Touch

Product/UI:

- `web/pages/underlying-stats/playerStats/index.tsx`
- `web/pages/underlying-stats/playerStats/[playerId].tsx`
- `web/components/underlying-stats/PlayerStatsFilters.tsx`
- `web/components/underlying-stats/PlayerStatsTable.tsx`
- `web/components/underlying-stats/playerStatsColumns.ts`

Filter/query contract:

- `web/lib/underlying-stats/playerStatsFilters.ts`
- `web/lib/underlying-stats/playerStatsQueries.ts`
- `web/lib/underlying-stats/playerStatsTypes.ts`

Server aggregation:

- `web/lib/underlying-stats/playerStatsLandingServer.ts`

Coverage/refresh:

- `web/pages/api/v1/db/update-player-underlying-summaries.ts`
- `web/lib/supabase/Upserts/nhlRawGamecenterRoute.ts`
- `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`

## Change Safety Rules

- keep landing and detail on one shared contract
- do not widen unsupported strengths or score states silently
- do not replace canonical native derivations with legacy NST shortcuts
- do not invent TOI or on-ice attribution from PBP-only data
- if new columns are added, update:
  - `playerStatsColumns.ts`
  - `playerStatsColumns.test.ts`
  - `PlayerStatsTable.test.tsx`
  - any affected route/query tests
