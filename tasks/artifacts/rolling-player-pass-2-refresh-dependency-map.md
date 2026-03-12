# Rolling Player Pass-2 Refresh Dependency Map

## Purpose

This artifact traces the concrete refresh dependency chain for the pass-2 rolling-player audit.

It documents, for the rolling suite’s required upstream tables:

- the table or target surface
- the refresh endpoint or operational command that exists in this repo
- the refresh granularity
- the dependency role in rolling validation
- the practical order in which refreshes should run before stored-vs-source comparison

This is the source artifact for task `3.1`. The broader runbook prose can build on it later, but this file is the exact refresh-surface map.

## Core Dependency Chain

For rolling-player validation, the effective refresh order is:

1. `games`
2. `players`
3. `wgo_skater_stats`
4. `nst_gamelog_*` tables required by the metric family under review
5. `powerPlayCombinations` for PP-share and PP-unit validation
6. `lineCombinations` for line-context validation
7. `rolling_player_game_metrics`

Important scoping rule:

- steps `5` and `6` are family-specific contextual refreshes, not universal blockers for all metric families
- non-PP arithmetic validation does not require `powerPlayCombinations`
- non-line-context validation does not require `lineCombinations`

## Refresh Surface Inventory

| Surface | Table(s) refreshed | Endpoint or command surface | Granularity | Rolling dependency role | Notes |
| --- | --- | --- | --- | --- | --- |
| Games refresh | `games` | `/api/v1/db/update-games` | season-level | authoritative game ledger for availability denominators and game-id validation | accepts optional `seasonId`; depends on current `teams` / `team_season` state |
| Players refresh | `players`, `rosters` | `/api/v1/db/update-players` | current-season roster sweep | player identity universe and roster alignment | no rolling formulas depend directly on player fields, but selectors and player processing scope do |
| WGO skater refresh | `wgo_skater_stats`, `wgo_skater_stats_playoffs` | `/api/v1/db/update-wgo-skaters` | current season, single date, single player, or all seasons | authoritative rolling row spine and fallback inputs | primary row source for dates, game ids, team alignment, WGO fallback stats, PP fallback inputs, and WGO TOI fallback |
| NST player gamelog refresh | all player NST count/rate/on-ice tables | `/api/v1/db/update-nst-gamelog` | full dataset family, by run mode and optional dataset filter | authoritative additive, ratio, weighted-rate, on-ice, and territorial sources | route supports `GET` and `POST`; `datasetType` lets validation target one exact table family |
| PP builder refresh | `powerPlayCombinations` | `/api/v1/db/update-power-play-combinations/[gameId]` | single game | PP-share denominator / numerator provenance and PP-unit context | required before trusting `pp_share_pct`, `pp_unit`, and optional PP context labels for the selected games |
| Line builder refresh | `lineCombinations` | `/api/v1/db/update-line-combinations/[id]` and `/api/v1/db/update-line-combinations` | single game or batch of unprocessed games | line-context labels only | single-game route is the validation-friendly path; batch route uses unprocessed-game RPC rather than explicit game ids |
| Rolling recompute | `rolling_player_game_metrics` | `/api/v1/db/update-rolling-player-averages` | single player, season slice, date slice, resume sweep, or full refresh | derived target rows for stored-vs-source validation | supports `GET`, `POST`, and `HEAD`; target rows are never upstream evidence until refreshed |

## Endpoint Details

### 1. `games`

Route:

- `/api/v1/db/update-games`

Observed handler:

- file: `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-games.ts`
- wrapped with `withCronJobAudit(adminOnly(...))`

Supported scope:

- optional `seasonId`
- default behavior uses the current season when `seasonId` is omitted

Writes:

- `games`

Operational examples:

```text
GET /api/v1/db/update-games
GET /api/v1/db/update-games?seasonId=20252026
```

Dependency notes:

- uses current season and team schedule data from NHL API
- should be refreshed before availability / participation validation and before any run that depends on correct `game_id` existence

### 2. `players`

Route:

- `/api/v1/db/update-players`

Observed handler:

- file: `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-players.ts`
- wrapped with `withCronJobAudit(adminOnly(...))`

Writes:

- `players`
- `rosters`

Operational example:

```text
GET /api/v1/db/update-players
```

Dependency notes:

- does not directly affect arithmetic formulas
- does affect player search, player universe, roster alignment, and downstream player selection logic
- treat as an upstream readiness step before broad rolling reruns, especially if recent callups, trades, or roster changes matter

### 3. `wgo_skater_stats`

Route:

- `/api/v1/db/update-wgo-skaters`

Observed handler:

- file: `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-wgo-skaters.ts`
- supports several modes through query parameters

Supported scope:

- `action=all`
  - current-season sweep
- `action=all&fullRefresh=true`
  - current-season full refresh
- `action=all&startDate=YYYY-MM-DD`
  - forward refresh from a chosen date
- `date=YYYY-MM-DD`
  - single-date refresh
- `playerId=...`
  - targeted player fetch path for debugging
- `action=all_seasons_full_refresh`
  - historical backfill

Writes:

- `wgo_skater_stats`
- `wgo_skater_stats_playoffs`

Operational examples:

```text
GET /api/v1/db/update-wgo-skaters?action=all
GET /api/v1/db/update-wgo-skaters?action=all&fullRefresh=true
GET /api/v1/db/update-wgo-skaters?action=all&startDate=2026-03-10
GET /api/v1/db/update-wgo-skaters?date=2026-03-10
```

Dependency notes:

- this is the rolling row spine
- refresh before any rolling validation run
- if WGO is stale, every family becomes suspect because row existence, date ordering, PP fallback inputs, and TOI fallback inputs all derive from it

### 4. `nst_gamelog_*`

Route:

- `/api/v1/db/update-nst-gamelog`

Observed handler:

- file: `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-gamelog.ts`
- supports `GET` and `POST`

Supported control parameters:

- `runMode`
  - `incremental`
  - `forward`
  - `reverse`
- `startDate=YYYY-MM-DD`
- `overwrite=yes|no`
- `datasetType=...`
- `table=...`
  - alias for `datasetType`

Dataset-to-table mapping used by the route:

| `datasetType` | Table |
| --- | --- |
| `allStrengthsCounts` | `nst_gamelog_as_counts` |
| `allStrengthsRates` | `nst_gamelog_as_rates` |
| `allStrengthsCountsOi` | `nst_gamelog_as_counts_oi` |
| `allStrengthsRatesOi` | `nst_gamelog_as_rates_oi` |
| `evenStrengthCounts` | `nst_gamelog_es_counts` |
| `evenStrengthRates` | `nst_gamelog_es_rates` |
| `evenStrengthCountsOi` | `nst_gamelog_es_counts_oi` |
| `evenStrengthRatesOi` | `nst_gamelog_es_rates_oi` |
| `powerPlayCounts` | `nst_gamelog_pp_counts` |
| `powerPlayRates` | `nst_gamelog_pp_rates` |
| `powerPlayCountsOi` | `nst_gamelog_pp_counts_oi` |
| `powerPlayRatesOi` | `nst_gamelog_pp_rates_oi` |
| `penaltyKillCounts` | `nst_gamelog_pk_counts` |
| `penaltyKillRates` | `nst_gamelog_pk_rates` |
| `penaltyKillCountsOi` | `nst_gamelog_pk_counts_oi` |
| `penaltyKillRatesOi` | `nst_gamelog_pk_rates_oi` |

Operational examples:

```text
GET /api/v1/db/update-nst-gamelog?runMode=incremental
GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10
GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillCounts
GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillRates
GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillCountsOi
```

Dependency notes:

- additive families require the appropriate `*_counts` table
- ratio families generally require `*_counts` and `*_counts_oi`
- weighted-rate families require `*_counts`, may require `*_rates`, and depend heavily on the TOI source selected across counts, counts-on-ice, and rates
- `*_rates_oi` tables exist in the endpoint mapping but are not part of the minimum required pass-2 rolling source set

### 5. `powerPlayCombinations`

Route:

- `/api/v1/db/update-power-play-combinations/[gameId]`

Observed handler:

- file: `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts`
- wrapped with `withCronJobAudit(adminOnly(...))`

Supported scope:

- single `gameId`

Writes:

- `powerPlayCombinations`

Operational example:

```text
GET /api/v1/db/update-power-play-combinations/2025021023
```

Observed March 11 validation command:

```bash
CRON_SECRET=$(grep '^CRON_SECRET=' web/.env.local | cut -d= -f2-)
curl -sS -m 180 -H "Authorization: Bearer ${CRON_SECRET}" "http://localhost:3000/api/v1/db/update-power-play-combinations/2025021023"
```

Dependency notes:

- required before trusting:
  - `pp_share_pct`
  - `pp_unit`
  - `pp_share_of_team`
  - `pp_unit_usage_index`
  - `pp_unit_relative_toi`
  - `pp_vs_unit_avg`
- this is a per-game builder, so validation must refresh every affected game in the selected PP window, not just the latest season globally

### 6. `lineCombinations`

Routes:

- `/api/v1/db/update-line-combinations/[id]`
- `/api/v1/db/update-line-combinations`

Observed handlers:

- single-game file: `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts`
- batch file: `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts`
- both wrapped with `withCronJobAudit(adminOnly(...))`

Supported scope:

- single-game route:
  - explicit `id`
- batch route:
  - optional `count`
  - internally selects ids through RPC `get_unprocessed_line_combinations`
  - default batch size is `5`

Writes:

- `lineCombinations`

Operational examples:

```text
GET /api/v1/db/update-line-combinations/2025021023
GET /api/v1/db/update-line-combinations?count=10
```

Dependency notes:

- required before trusting:
  - `line_combo_slot`
  - `line_combo_group`
- for targeted validation, the single-game route is the exact refresh surface
- the batch route is operationally useful, but less deterministic because it depends on the “unprocessed” RPC rather than an explicit audit game list

### 7. `rolling_player_game_metrics`

Route:

- `/api/v1/db/update-rolling-player-averages`

Observed handler:

- file: `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts`
- supports `GET`, `POST`, and `HEAD`

Supported scope controls:

- `playerId`
- `season`
- `startDate`
- `endDate`
- `resumeFrom`
- `fullRefresh`
- `fullRefreshMode`
  - `rpc_truncate`
  - `overwrite_only`
  - `delete`
- `deleteChunkSize`
- `playerConcurrency`
- `upsertBatchSize`
- `upsertConcurrency`
- `skipDiagnostics`
- `fastMode`

Writes:

- `rolling_player_game_metrics`

Operational examples:

```text
GET /api/v1/db/update-rolling-player-averages?playerId=8470613&season=20252026
GET /api/v1/db/update-rolling-player-averages?playerId=8470613&season=20252026&fastMode=true
GET /api/v1/db/update-rolling-player-averages?startDate=2026-03-10&endDate=2026-03-12
GET /api/v1/db/update-rolling-player-averages?fullRefresh=true&fullRefreshMode=rpc_truncate
HEAD /api/v1/db/update-rolling-player-averages
```

Observed March 11 validation command:

```bash
CRON_SECRET=$(grep '^CRON_SECRET=' web/.env.local | cut -d= -f2-)
curl -sS -m 300 -H "Authorization: Bearer ${CRON_SECRET}" "http://localhost:3000/api/v1/db/update-rolling-player-averages?playerId=8470613&season=20252026&fastMode=true"
```

Dependency notes:

- always run after required source refreshes for the validation family under review
- stale target rows are blockers, not evidence
- targeted player recomputes are the preferred pass-2 validation path

## Family-Specific Refresh Requirements

### Availability / participation

Required chain:

1. `games`
2. `players` if roster or team assignment is stale
3. `wgo_skater_stats`
4. `rolling_player_game_metrics`

Why:

- denominator semantics require fresh team-game ledgers
- numerator semantics require fresh WGO appearance rows and correct team mapping

### Additive counts

Required chain:

1. `wgo_skater_stats`
2. relevant `nst_gamelog_*_counts`
3. `rolling_player_game_metrics`

Why:

- additive counts use WGO row spine plus NST-first source selection

### Ratio families

Required chain:

1. `wgo_skater_stats`
2. relevant `nst_gamelog_*_counts`
3. relevant `nst_gamelog_*_counts_oi` where the family is on-ice or territorial
4. `rolling_player_game_metrics`

Why:

- ratio families are ratio-of-aggregates over source components, not averages of per-game percentages

### Weighted `/60`

Required chain:

1. `wgo_skater_stats`
2. relevant `nst_gamelog_*_counts`
3. relevant `nst_gamelog_*_counts_oi`
4. relevant `nst_gamelog_*_rates`
5. `rolling_player_game_metrics`

Why:

- TOI source precedence can move across counts, counts-on-ice, rates, fallback seed, and WGO normalization

### PP-share and PP context

Required chain:

1. `wgo_skater_stats`
2. `powerPlayCombinations`
3. relevant `nst_gamelog_pp_*` tables if validating PP arithmetic families
4. `rolling_player_game_metrics`

Why:

- PP-share and PP context depend on builder freshness at the game level
- PP arithmetic families also need refreshed PP NST rows

### Line context

Required chain:

1. `lineCombinations`
2. `rolling_player_game_metrics`

Why:

- line labels are contextual copies, not rolling aggregates

## March 11, 2026 Validation Recipes Reused by Pass 2

Documented in:

- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-refresh-actions-report-2026-03-11.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-validation-freshness-report-2026-03-11.md`

Confirmed useful targeted refreshes:

- Brent Burns PP builder repair:
  - `/api/v1/db/update-power-play-combinations/2025021023`
- Corey Perry PK NST retries:
  - `/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillCounts`
  - `/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillRates`
  - `/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillCountsOi`
- targeted rolling recomputes:
  - `/api/v1/db/update-rolling-player-averages?playerId=8470613&season=20252026&fastMode=true`
  - analogous player-targeted recomputes for Corey Perry, Jesper Bratt, and Seth Jones

Interpretation carried forward into pass 2:

- source-side freshness is the usual blocker, not stale target rows
- PP and line validation should use exact game-targeted refreshes whenever possible
- player-targeted rolling recomputes are the preferred comparison surface for audit work

## Immediate Pass-2 Recommendation

Use this dependency chain as the default operational order for task `3.2` and later live-validation work:

1. refresh `games` if denominator or game-id drift is suspected
2. refresh `players` if roster or traded-player scope is suspected
3. refresh `wgo_skater_stats` for the validation dates
4. refresh only the NST table families required by the selected metric family
5. refresh PP or line builders only when the selected family depends on them
6. rerun targeted `update-rolling-player-averages` for the selected player and season
7. only then compare stored values to reconstructed values
