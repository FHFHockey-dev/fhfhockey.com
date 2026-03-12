# Rolling Player Metrics Audit Pass 2

This is the work-in-progress main audit artifact for the pass-2 rolling-player metrics audit. Supporting evidence is staged first in standalone artifacts and then consolidated here as the task list advances.

## Live Validation Examples

The examples below package the strongest March 12, 2026 live evidence into reusable final-audit form.

Supporting evidence:

- [rolling-player-pass-2-reconstruction-evidence-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-reconstruction-evidence-2026-03-12.md)
- [rolling-player-pass-2-diagnostics-classification-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-diagnostics-classification-2026-03-12.md)
- [rolling-player-pass-2-refresh-execution-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-execution-2026-03-12.md)
- [rolling-player-context-label-validation-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-context-label-validation-report-2026-03-11.md)

Representative row snapshot basis:

- live Supabase-backed validation snapshot run on `2026-03-12T15:18:52.881Z`

### Example 1: Brent Burns healthy full-season control for additive and on-ice ratio families

- player: `Brent Burns` (`8470613`)
- archetype: healthy full-season skater
- target row: `2026-03-10 | all | game_id 2025021023`
- source rows used:
  - `wgo_skater_stats`: `61`
  - `nst_gamelog_as_counts`: `63`
  - `nst_gamelog_as_rates`: `63`
  - `nst_gamelog_as_counts_oi`: `63`
  - `powerPlayCombinations`: `52`
  - `lineCombinations`: `122`
- intended formulas:
  - `goals_total_last20 = sum(goals over the player’s last 20 all-strength appearances)`
  - `on_ice_sh_pct_last20 = sum(oi_gf) / sum(oi_sf) * 100`
- actual code path:
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - [rollingPlayerSourceSelection.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts)
  - [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
- stored values:
  - `goals_total_last20 = 4`
  - `on_ice_sh_pct_last20 = 9.836066`
- reconstructed values:
  - `goals_total_last20 = 4`
  - `on_ice_sh_pct_last20 = 9.836066`
- match result: `MATCH`
- mismatch cause bucket: none
- why this example matters:
  - it shows the pipeline is not globally broken
  - both a simple additive window and a ratio-of-aggregates on-ice family matched on a fresh high-sample control row

### Example 2: Brent Burns TOI and weighted-rate fallback validation

- player: `Brent Burns` (`8470613`)
- archetype: TOI / fallback validation skater
- target row: `2026-03-10 | all | game_id 2025021023`
- source rows used:
  - `wgo_skater_stats`: `61`
  - `nst_gamelog_as_counts`: `63`
  - `nst_gamelog_as_rates`: `63`
  - `nst_gamelog_as_counts_oi`: `63`
- intended formulas:
  - `toi_seconds_total_last20 = sum(resolved_toi_seconds over the player’s last 20 appearances)`
  - `ixg_per_60_last20 = sum(ixg) / sum(toi_seconds) * 3600`
- actual code path:
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - [rollingPlayerToiContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts)
  - [rollingPlayerMetricMath.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts)
  - [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
- stored values:
  - `toi_seconds_total_last20 = 22955`
  - `ixg_per_60_last20 = 0.197604`
- reconstructed values:
  - `toi_seconds_total_last20 = 22955`
  - `ixg_per_60_last20 = 0.197604`
- match result: `MATCH`
- mismatch cause bucket: none
- why this example matters:
  - it proves the resolved TOI denominator and the weighted `/60` formula are aligned on a fresh ready case
  - it supports keeping weighted-rate arithmetic out of the broad failure bucket even while TOI-trace visibility still needs better debug support

### Example 3: Corey Perry missed-games denominator validation

- player: `Corey Perry` (`8470621`)
- archetype: injured / missed-games skater
- target row: `2026-03-10 | all | game_id 2025021015`
- source rows used:
  - `games`
  - `wgo_skater_stats`: `51`
  - `nst_gamelog_as_counts`: `53`
  - `nst_gamelog_as_rates`: `53`
  - `nst_gamelog_as_counts_oi`: `53`
- intended formula:
  - `availability_pct_last20_team_games = games_played_last20_team_games / team_games_available_last20`
- actual code path:
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - [rollingPlayerAvailabilityContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts)
  - [rollingWindowContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.ts)
- stored values:
  - `games_played_last20_team_games = 3`
  - `team_games_available_last20 = 20`
  - `availability_pct_last20_team_games = 0.15`
- reconstructed values:
  - `games_played_last20_team_games = 3`
  - `team_games_available_last20 = 20`
  - `availability_pct_last20_team_games = 0.15`
- match result: `MATCH`
- mismatch cause bucket: none
- why this example matters:
  - it shows the pass-2 availability contract handles missed-games denominators correctly on a live current-season row
  - it confirms the rolling current-team denominator semantics that replaced the overloaded GP% interpretation

### Example 4: Corey Perry traded-player season availability validation

- player: `Corey Perry` (`8470621`)
- archetype: traded or multi-team skater
- target row: `2026-03-10 | all | game_id 2025021015`
- source rows used:
  - `games`
  - `wgo_skater_stats`: `51`
  - player season ledger reconstructed through the availability contract across team stints
- intended formulas:
  - `season_availability_pct = season_games_played / season_team_games_available`
  - compatibility check: `gp_pct_total_all = games_played / team_games_played`
- actual code path:
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - [rollingPlayerAvailabilityContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts)
  - [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts)
- stored values:
  - `season_games_played = 51`
  - `season_team_games_available = 138`
  - `season_availability_pct = 0.369565`
  - `gp_pct_total_all = 0.369565`
- reconstructed values:
  - `season_games_played = 51`
  - `season_team_games_available = 138`
  - `season_availability_pct = 0.369565`
  - `gp_pct_total_all = 0.369565`
- match result: `MATCH`
- mismatch cause bucket: none
- why this example matters:
  - it is the clearest live proof that the new replacement availability fields and the retained total GP compatibility ratio can stay aligned on a traded-player row
  - it keeps the pass-2 concern focused on semantics and naming cleanup rather than current arithmetic failure for this validated scope

### Example 5: Jesper Bratt heavy-PP PP-share validation

- player: `Jesper Bratt` (`8479407`)
- archetype: heavy-PP skater
- target row: `2026-03-08 | pp | game_id 2025021005`
- source rows used:
  - `wgo_skater_stats`: `62`
  - `nst_gamelog_pp_counts`: `62`
  - `nst_gamelog_pp_rates`: `62`
  - `nst_gamelog_pp_counts_oi`: `62`
  - `powerPlayCombinations`: `60`
  - current-game builder row:
    - `PPTOI = 199`
    - `unit = 1`
    - `pp_share_of_team = null`
- intended formula:
  - `pp_share_pct_last20 = sum(player_pp_toi) / sum(team_pp_toi_inferred_from_share)`
- actual code path:
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - [rollingPlayerPpShareContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts)
  - [rollingPlayerPpUnitContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpUnitContract.ts)
  - [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
- stored values:
  - `pp_share_pct_last20 = 0.695275`
  - `pp_share_pct_player_pp_toi_last20 = 3488`
  - `pp_share_pct_team_pp_toi_last20 = 5016.722496`
  - `pp_unit = 1`
- reconstructed values:
  - `pp_share_pct_last20 = 0.695275`
  - `pp_share_pct_player_pp_toi_last20 = 3488`
  - `pp_share_pct_team_pp_toi_last20 = 5016.722496`
  - `pp_unit = 1`
- match result: `MATCH`
- mismatch cause bucket: none
- why this example matters:
  - it is the strongest ready-case proof that the team-share PP denominator contract is reconstructable from current sources
  - it also confirms that the contextual `pp_unit` label stayed aligned with the builder-owned PP row on the same validation slice

### Example 6: Seth Jones line-context validation with blocked PK proxy companion

- player: `Seth Jones` (`8477495`)
- archetypes:
  - line-context validation skater
  - retained blocked-tail proxy
- target row: `2026-01-02 | all | game_id 2025020641`
- source rows used:
  - `wgo_skater_stats`: `40`
  - `lineCombinations`: `80`
  - current-game line builder row:
    - `gameId = 2025020641`
    - `teamId = 13`
    - `defensemen = [8478055, 8477932, 8478859, 8484304, 8473507, 8477495]`
- intended derivation:
  - `line_combo_group = "defense"` when the player is found in the game/team defensemen list
  - `line_combo_slot = 3` for third-pair assignment from the ordered defensemen list
- actual code path:
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - [rollingPlayerLineContextContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts)
- stored values:
  - `line_combo_slot = 3`
  - `line_combo_group = "defense"`
- reconstructed values:
  - `line_combo_slot = 3`
  - `line_combo_group = "defense"`
- match result: `MATCH`
- mismatch cause bucket: none for line context
- blocked companion validation:
  - Seth Jones `pk` arithmetic remains blocked because March 12 diagnostics still showed:
    - `countsTailLag = 1`
    - `ratesTailLag = 1`
    - `countsOiTailLag = 1`
  - blocked mismatch cause bucket for PK-sensitive validation: `stale source`
- why this example matters:
  - it proves the line-context label surface can still be validated cleanly even when the same player remains the canonical stale-tail proxy for PK-sensitive arithmetic
  - it cleanly separates contextual-label confidence from blocked metric-family confidence

## Live Validation Examples Takeaway

These six examples cover every required pass-2 archetype and show:

- healthy full-row arithmetic parity on additive, on-ice, TOI, and weighted-rate families
- missed-games and traded-player availability parity under the replacement availability contract
- heavy-PP PP-share and PP-unit parity on a ready validation case
- clean line-context label parity
- a concrete stale-source blocker that prevents over-trusting PK-sensitive comparisons

The current live evidence supports:

- treating most ready active families as arithmetic matches
- isolating the remaining active mismatch evidence to the historical weighted-rate legacy subset
- treating stale-tail PK cases as blocked validation scopes rather than as proof of broken rolling math

## Freshness and Recompute Runbook

This runbook defines the minimum operational order required before any stored-versus-source comparison is trusted.

Primary operational sources:

- [rolling-player-pass-2-refresh-dependency-map.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-dependency-map.md)
- [rolling-player-pass-2-refresh-execution-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-execution-2026-03-12.md)
- [rolling-player-pass-2-diagnostics-classification-2026-03-12.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-diagnostics-classification-2026-03-12.md)

### Upstream Refresh Surface

| Surface | Table(s) | Route or command surface | Why it matters for validation |
| --- | --- | --- | --- |
| Games | `games` | `/api/v1/db/update-games` | authoritative game ledger for `game_id` existence, team-game denominators, and availability window membership |
| Players | `players`, `rosters` | `/api/v1/db/update-players` | player search universe, roster alignment, and current player/team scope |
| WGO row spine | `wgo_skater_stats`, `wgo_skater_stats_playoffs` | `/api/v1/db/update-wgo-skaters` | authoritative row spine for rolling chronology, base game ids, WGO fallback counts, PP fallback, and WGO TOI fallback |
| NST player gamelog | `nst_gamelog_as_*`, `nst_gamelog_es_*`, `nst_gamelog_pp_*`, `nst_gamelog_pk_*` | `/api/v1/db/update-nst-gamelog` | authoritative additive, ratio, weighted-rate, on-ice, and territorial source tables |
| PP builder | `powerPlayCombinations` | `/api/v1/db/update-power-play-combinations/[gameId]` | PP-share denominator source and PP context labels |
| Line builder | `lineCombinations` | `/api/v1/db/update-line-combinations/[id]`, `/api/v1/db/update-line-combinations` | line-context label authority |
| Rolling target | `rolling_player_game_metrics` | `/api/v1/db/update-rolling-player-averages` | stored validation target; must be fresh before comparing stored and reconstructed rows |

### Endpoint and Operational Details

#### `games`

- route:
  - `/api/v1/db/update-games`
- observed file:
  - [update-games.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-games.ts)
- supported scope:
  - optional `seasonId`
- operational examples:
  - `GET /api/v1/db/update-games`
  - `GET /api/v1/db/update-games?seasonId=20252026`

#### `players`

- route:
  - `/api/v1/db/update-players`
- observed file:
  - [update-players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-players.ts)
- operational example:
  - `GET /api/v1/db/update-players`

#### `wgo_skater_stats`

- route:
  - `/api/v1/db/update-wgo-skaters`
- observed file:
  - [update-wgo-skaters.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-wgo-skaters.ts)
- supported scope:
  - `action=all`
  - `action=all&fullRefresh=true`
  - `action=all&startDate=YYYY-MM-DD`
  - `date=YYYY-MM-DD`
  - `playerId=...`
- operational examples:
  - `GET /api/v1/db/update-wgo-skaters?action=all`
  - `GET /api/v1/db/update-wgo-skaters?action=all&startDate=2026-03-10`
  - `GET /api/v1/db/update-wgo-skaters?date=2026-03-10`

#### `nst_gamelog_*`

- route:
  - `/api/v1/db/update-nst-gamelog`
- observed file:
  - [update-nst-gamelog.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-gamelog.ts)
- supported controls:
  - `runMode`
  - `startDate`
  - `overwrite`
  - `datasetType`
  - `table`
- key dataset mappings used in pass 2:
  - `allStrengthsCounts -> nst_gamelog_as_counts`
  - `allStrengthsRates -> nst_gamelog_as_rates`
  - `allStrengthsCountsOi -> nst_gamelog_as_counts_oi`
  - `evenStrengthCounts -> nst_gamelog_es_counts`
  - `evenStrengthRates -> nst_gamelog_es_rates`
  - `evenStrengthCountsOi -> nst_gamelog_es_counts_oi`
  - `powerPlayCounts -> nst_gamelog_pp_counts`
  - `powerPlayRates -> nst_gamelog_pp_rates`
  - `powerPlayCountsOi -> nst_gamelog_pp_counts_oi`
  - `penaltyKillCounts -> nst_gamelog_pk_counts`
  - `penaltyKillRates -> nst_gamelog_pk_rates`
  - `penaltyKillCountsOi -> nst_gamelog_pk_counts_oi`
- operational examples:
  - `GET /api/v1/db/update-nst-gamelog?runMode=incremental`
  - `GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10`
  - `GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillCounts`
  - `GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillRates`
  - `GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillCountsOi`

#### `powerPlayCombinations`

- route:
  - `/api/v1/db/update-power-play-combinations/[gameId]`
- observed file:
  - [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts)
- operational example:
  - `GET /api/v1/db/update-power-play-combinations/2025021023`
- March 11 and March 12 validation pattern:
  - refresh the exact PP-window game ids needed for the player under review rather than running a broad PP builder sweep

#### `lineCombinations`

- routes:
  - `/api/v1/db/update-line-combinations/[id]`
  - `/api/v1/db/update-line-combinations`
- observed files:
  - [update-line-combinations/[id].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts)
  - [update-line-combinations/index.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts)
- supported scope:
  - single explicit game id
  - batch `count` path driven by unprocessed-game RPC
- operational examples:
  - `GET /api/v1/db/update-line-combinations/2025021023`
  - `GET /api/v1/db/update-line-combinations?count=10`

#### `rolling_player_game_metrics`

- route:
  - `/api/v1/db/update-rolling-player-averages`
- observed file:
  - [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
- supported scope:
  - `playerId`
  - `season`
  - `startDate`
  - `endDate`
  - `resumeFrom`
  - `fullRefresh`
  - `fullRefreshMode`
  - `playerConcurrency`
  - `upsertBatchSize`
  - `upsertConcurrency`
  - `skipDiagnostics`
  - `fastMode`
- operational examples:
  - `GET /api/v1/db/update-rolling-player-averages?playerId=8470613&season=20252026`
  - `GET /api/v1/db/update-rolling-player-averages?playerId=8470613&season=20252026&fastMode=true`
  - `GET /api/v1/db/update-rolling-player-averages?startDate=2026-03-10&endDate=2026-03-12`

### Recommended Refresh Order

The pass-2 default operational order is:

1. Refresh `games` if game-ledger drift, denominator drift, or unknown-game concerns are present.
2. Refresh `players` if roster alignment, callups, or traded-player scope is in question.
3. Refresh `wgo_skater_stats` for the validation slice.
4. Refresh only the NST table families required by the metric family under review.
5. Refresh `powerPlayCombinations` only if the selected family depends on PP-share or PP-unit context.
6. Refresh `lineCombinations` only if the selected family depends on line-context labels.
7. Recompute `rolling_player_game_metrics` for the selected player or date slice.
8. Only after steps `1-7` are complete should stored values be compared to reconstructed values.

Important scope rule:

- PP builder and line builder refreshes are family-specific, not universal prerequisites for every rolling comparison.

### Family-Specific Refresh Prerequisites

#### Availability / participation

Required chain:

1. `games`
2. `players` when roster or traded-player scope is stale
3. `wgo_skater_stats`
4. `rolling_player_game_metrics`

Why:

- denominator semantics come from the team-game ledger
- numerator semantics come from the WGO appearance spine and correct team assignment

#### Additive counts

Required chain:

1. `wgo_skater_stats`
2. relevant `nst_gamelog_*_counts`
3. `rolling_player_game_metrics`

Why:

- additive families use the WGO row spine plus NST-first source selection

#### Ratio families

Required chain:

1. `wgo_skater_stats`
2. relevant `nst_gamelog_*_counts`
3. relevant `nst_gamelog_*_counts_oi` for on-ice, territorial, or PDO-style families
4. `rolling_player_game_metrics`

Why:

- these families are ratio-of-aggregates over source components, not averages of per-game percentages

#### Weighted `/60`

Required chain:

1. `wgo_skater_stats`
2. relevant `nst_gamelog_*_counts`
3. relevant `nst_gamelog_*_counts_oi`
4. relevant `nst_gamelog_*_rates`
5. `rolling_player_game_metrics`

Why:

- TOI source precedence can move across counts, counts-on-ice, rates, fallback seed, and WGO normalization

#### PP share and PP context

Required chain:

1. `wgo_skater_stats`
2. `powerPlayCombinations`
3. relevant `nst_gamelog_pp_*` tables when validating PP arithmetic families
4. `rolling_player_game_metrics`

Why:

- `pp_share_pct` and contextual PP labels depend on current per-game builder rows
- PP arithmetic families also need fresh PP NST rows

#### Line context

Required chain:

1. `lineCombinations`
2. `rolling_player_game_metrics`

Why:

- `line_combo_slot` and `line_combo_group` are contextual copies from the builder, not rolling aggregates

### Stale-Tail and Dependency-Chain Risks

Treat every non-zero tail lag from `summarizeSourceTailFreshness(...)` as a blocker for the affected comparison scope.

Blocker rules:

- `countsTailLag > 0`
  - blocks count-driven families for that strength
- `ratesTailLag > 0`
  - blocks rate-reconstruction and TOI-fallback validation for that strength
- `countsOiTailLag > 0`
  - blocks on-ice, territorial, zone-start, PDO, and other `counts_oi`-backed families for that strength
- `ppTailLag > 0`
  - blocks PP-share and PP-unit validation for the affected games
- `lineTailLag > 0`
  - blocks line-context validation for the affected games
- `unknownGameIds > 0`
  - blocks trust in row identity and game-ledger comparisons until game mapping is repaired

March 12 pass-2 live blocker state:

- Corey Perry `pk`
  - `countsTailLag = 1`
  - `ratesTailLag = 1`
  - `countsOiTailLag = 1`
  - status: blocked
- Seth Jones `pk`
  - `countsTailLag = 1`
  - `ratesTailLag = 1`
  - `countsOiTailLag = 1`
  - status: blocked
- all retained ready scopes for Burns and Bratt
  - all tail lags `= 0`
  - status: comparison-ready with normal coverage cautions only

### Coverage and Component Completeness Rules

Coverage warnings are not identical to stale-tail blockers.

Trust rules:

- if tail freshness is healthy but `summarizeCoverage(...)` reports missing PP-share rows, missing split dates, or missing builder rows, comparison may still proceed only with explicit source-row inspection
- if `summarizeDerivedWindowDiagnostics(...)` reports GP partial or invalid windows, GP-based comparisons are not trustable until support counters reconcile
- if ratio windows show `partial` or `valuePresentWithoutComponents`, support columns are incomplete evidence and direct source reconstruction should win over support-column-only reasoning
- if `summarizeSuspiciousOutputs(...)` reports any issue, treat the affected row as untrusted until manually reconstructed

March 12 live result:

- `suspiciousIssueCount = 0` for every retained validation player and strength
- GP windows were internally coherent
- ratio-support completeness remained weaker than GP support, especially in `primary_points_pct`, `ipp`, and `pdo`
- these ratio-support warnings were cautions, not automatic arithmetic failures, because active ready-scope source reconstructions still matched

### How to Know Validation Is Blocked

Validation is blocked when any of the following is true:

- the relevant source-tail lag is non-zero
- the target recompute has not been rerun after source refresh
- the target recompute path fails in the upsert phase
- `unknownGameIds` is non-zero for the selected source slice
- the metric family depends on PP or line context and the relevant builder rows were not refreshed

March 12 operational note:

- targeted source refreshes succeeded for the PK NST tables
- the rolling recompute path still failed during the `rolling_player_game_metrics` upsert phase with repeated `Bad Request` responses
- this means fresh source rows alone are not enough; the target-write phase must also be healthy before new stored rows are trusted

### Practical Validation Recipes

#### Recipe A: availability / participation validation

1. Refresh `games` if any ledger drift is suspected.
2. Refresh `wgo_skater_stats` for the validation dates.
3. Rerun `update-rolling-player-averages` for the player and season.
4. Check:
   - `summarizeSourceTailFreshness(...)`
   - `summarizeDerivedWindowDiagnostics(...)`
5. Compare:
   - `season_games_played`
   - `season_team_games_available`
   - `season_availability_pct`
   - `availability_pct_lastN_team_games`

#### Recipe B: PP-share validation

1. Refresh `wgo_skater_stats`.
2. Refresh the exact PP builder game ids in the relevant window.
3. Refresh relevant `nst_gamelog_pp_*` tables if validating PP arithmetic beyond pure PP-share.
4. Rerun `update-rolling-player-averages`.
5. Check:
   - `ppTailLag`
   - `missingPpGameIds`
   - `missingPpShareGameIds`
6. Compare:
   - `pp_share_pct_*`
   - `pp_share_pct_player_pp_toi_*`
   - `pp_share_pct_team_pp_toi_*`
   - `pp_unit`

#### Recipe C: line-context validation

1. Refresh the exact `lineCombinations` game ids needed for the selected row.
2. Rerun `update-rolling-player-averages`.
3. Check:
   - `lineTailLag`
4. Compare:
   - `line_combo_slot`
   - `line_combo_group`

#### Recipe D: weighted-rate validation

1. Refresh `wgo_skater_stats`.
2. Refresh the relevant split `counts`, `counts_oi`, and `rates` tables.
3. Rerun `update-rolling-player-averages`.
4. Check:
   - `countsTailLag`
   - `ratesTailLag`
   - `countsOiTailLag`
   - suspicious-output summary
5. Compare:
   - `toi_seconds_*`
   - weighted `/60` metrics
   - historical weighted-rate fields where applicable

### `trendsDebug.tsx` Freshness Requirements

The debug page must expose freshness state before a user starts trusting metric comparisons.

Minimum page requirements:

- show latest source dates for counts, rates, and counts-on-ice
- show latest PP builder and line builder coverage for the selected player and row
- show latest stored rolling row date for the selected player and strength
- show blocker counts:
  - `countsTailLag`
  - `ratesTailLag`
  - `countsOiTailLag`
  - `ppTailLag`
  - `lineTailLag`
- show coverage cautions:
  - missing PP rows
  - missing PP share rows
  - missing PP unit rows
  - missing split source dates
  - unknown game ids
- show derived-window cautions:
  - GP support partial / invalid
  - ratio support partial / value-present-without-components
- visibly label the selected comparison as one of:
  - `READY`
  - `READY WITH CAUTIONS`
  - `BLOCKED`
- show the exact next required refresh action for the selected metric family

### Runbook Takeaway

The pass-2 comparison workflow is trustworthy only when:

- the relevant upstream sources are fresh for the selected family
- family-specific contextual builders are refreshed when required
- `rolling_player_game_metrics` has been recomputed after those source refreshes
- diagnostics show no stale-tail blocker for the selected comparison scope

Any comparison that skips one of those steps is audit input, not audit evidence.
