# Rolling Player Metrics Audit Notes

## 1.1 Recompute Flow Map

### Entry Path

1. [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts) accepts `GET`, `POST`, and `HEAD`.
2. It parses runtime controls from query params:
   - `playerId`
   - `season`
   - `startDate`
   - `endDate`
   - `resumeFrom`
   - `fullRefresh`
   - `fullRefreshMode`
   - `deleteChunkSize`
   - `playerConcurrency`
   - `upsertBatchSize`
   - `upsertConcurrency`
3. It lazily imports `main(...)` from [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts).
4. It logs the request payload, runs `main(...)`, and returns a success or error response.
5. The endpoint itself contains no metric logic. It is only a request parser, timer, and delegator.

### Main Pipeline Setup

1. [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts) loads Supabase env vars and creates a service-role client.
2. `main(...)` performs a preflight probe against `games`.
3. It fetches the full `games` table through `fetchGames()`.
4. It converts `games` into a per-team per-season cumulative ledger via `buildTeamGameLedger(...)`.
5. It fetches the player list through `fetchPlayerIds(...)`, excluding goalies unless `playerId` is provided directly.
6. It resolves resume behavior:
   - explicit `resumePlayerId`
   - or auto-resume from the highest `player_id` already present in `rolling_player_game_metrics`
   - unless `fullRefresh` is active

### Full Refresh / Resume Control

1. If `forceFullRefresh` is true, the pipeline can:
   - truncate through RPC: `truncate_rolling_player_game_metrics`
   - fall back to `overwrite_only`
   - or use legacy `delete` mode with chunked row deletion
2. If no full refresh is requested, auto-resume is enabled only when no narrow filters are provided.
3. Filtered player IDs are then processed in ascending order.

### Player-Level Processing

1. `main(...)` creates a worker pool using `playerConcurrency`.
2. Each worker calls `processPlayer(playerId, ledger, knownGameIds, options)`.
3. `processPlayer(...)`:
   - fetches WGO skater rows through `fetchWgoRowsForPlayer(...)`
   - derives the player date range from first and last WGO row
   - collects `gameIds` from WGO rows
   - fetches PP combination rows for those `gameIds`
   - fetches line-combination rows for those `gameIds`

### Strength-Level Processing

For each strength in `all`, `ev`, `pp`, `pk`:

1. The pipeline fetches:
   - NST counts rows from the configured `countsTable`
   - NST rates rows from the configured `ratesTable`
   - NST on-ice counts rows from the configured `countsOiTable`
2. Rows are grouped by `date_scraped`.
3. Coverage diagnostics are computed with [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts):
   - missing counts dates
   - missing rates dates
   - missing on-ice dates
   - missing PP rows where PPTOI exists
   - unknown `game_id` values not found in `games`
4. `buildGameRecords(...)` merges WGO, NST counts, NST rates, NST on-ice rows, PP rows, and line-combination context into one `PlayerGameData` record per WGO date.

### Metric Accumulation

1. Metric definitions are declared in `METRICS`.
2. Each metric is either:
   - `simple`: additive / average accumulation
   - `ratio`: numerator / denominator accumulation through [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
3. Each game updates:
   - rolling simple accumulators
   - rolling ratio accumulators
   - historical simple accumulators
   - historical ratio accumulators
4. TOI normalization is handled by `getToiSeconds(...)`, which falls back in this order:
   - NST counts TOI
   - NST on-ice TOI
   - NST rates `toi_per_gp`
   - fallback TOI assembled in `buildGameRecords(...)`
   - WGO `toi_per_game`

### Availability / GP% Accumulation

1. `playedThisGame` is set differently by split:
   - `all`: always `1`
   - `ev` / `pp` / `pk`: `1` only if TOI for that split is greater than zero
2. `gamesPlayed` is incremented when `playedThisGame > 0`.
3. `appearanceDates` stores the dates of those counted appearances.
4. `teamGamesPlayed` is derived from the ledger for the player’s team, season, and date.
5. `historicalGpPctState` is updated through [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts).
6. Rolling GP% windows are currently based on:
   - `windowDates = appearanceDates.slice(-N)`
   - `playerGamesWindow = windowDates.length`
   - `teamGamesWindow = team games between window start date and current game date`
7. This means rolling GP% is currently anchored to last N appearances, not guaranteed last N team games.

### Output Assembly

1. `deriveOutputs(...)` materializes:
   - `*_total_all`
   - `*_avg_all`
   - `*_total_last3/5/10/20`
   - `*_avg_last3/5/10/20`
   - `*_avg_season`
   - `*_avg_3ya`
   - `*_avg_career`
2. `gp_pct_*` fields are also generated inside `deriveOutputs(...)`.
3. For non-`all` and non-`pp` strengths, `pp_share_pct*` outputs are nulled after derivation.
4. Each game snapshot becomes one row for `rolling_player_game_metrics`, including:
   - player, game, date, season, team
   - `strength_state`
   - line-combo context
   - `pp_unit`
   - all derived metric columns

### Diagnostics and Upsert

1. Per-strength suspicious-output scans run after row construction.
2. `processPlayer(...)` returns:
   - `rows`
   - `coverageWarningCount`
   - `suspiciousOutputCount`
   - `unknownGameIdCount`
3. `main(...)` batches rows per player using `upsertBatchSize`.
4. Upserts use conflict key:
   - `player_id,game_date,strength_state`
5. Upserts run through:
   - `executeWithRetry(...)`
   - `executeWithSlowLog(...)`
   - concurrency-limited batching
6. Final run summary reports:
   - `rowsUpserted`
   - `processedPlayers`
   - `playersWithRows`
   - `coverageWarnings`
   - `suspiciousOutputWarnings`
   - `unknownGameIds`

### Initial Audit Implications from 1.1

- The endpoint wrapper is not a likely source of metric correctness bugs.
- The main correctness surface is inside:
  - `METRICS`
  - `getToiSeconds(...)`
  - `deriveOutputs(...)`
  - GP% / availability window logic
  - source merge logic in `buildGameRecords(...)`
- The current GP% model already shows a semantic mismatch with “last N team games.”
- Rolling metric windows and GP% windows are not derived by the same conceptual model.

## 1.2 Direct Helper Responsibilities

### [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts)

- Owns season, 3-year, and career historical snapshots for simple average metrics.
- Owns historical GP% accumulation through `HistoricalGpPctAccumulator`.
- Uses season-bucket aggregation keyed by normalized season windows.
- Treats historical GP% as ratio-of-aggregates:
  - `playerGames / teamGames`
- Important implication:
  - current GP% history is not a simple per-row average
  - team identity is part of season-level GP% state

### [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)

- Owns rolling and historical accumulation for ratio metrics.
- Accepts numerator / denominator component pairs plus optional secondary components.
- Computes bounded and composite metrics through `RatioAggregationSpec`.
- Supports:
  - primary ratio metrics
  - combined metrics such as PDO
  - rolling windows
  - season / 3-year / career historical snapshots
- Important implication:
  - a ratio row is only accumulated when at least one denominator is present
  - this helper is the reason some `lastN` ratio windows behave like last N valid metric observations

### [rollingPlayerMetricMath.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts)

- Owns math normalization for:
  - `/60` metrics through `resolvePer60Components(...)`
  - share metrics through `resolveShareComponents(...)`
- Converts:
  - raw count + TOI into numerator / denominator components
  - or back-solves numerator from `per60Rate` and TOI when raw value is missing
- For share metrics, converts:
  - raw numerator + share
  - into numerator / inferred denominator
- Important implication:
  - this helper defines whether share semantics are reconstructable from upstream share fields
  - bad upstream share meaning will propagate directly into rolling metrics if not corrected upstream

### [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts)

- Owns runtime observability for:
  - source coverage gaps
  - missing PP rows
  - unknown game IDs
  - suspicious bounded outputs
- Produces warning summaries only; it does not change metric values.
- Important implication:
  - this helper is evidence/reporting infrastructure, not part of the metric math
  - audit findings from it should be separated from formula correctness findings

### Direct Helper Dependency Summary

- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts) owns orchestration and metric definitions.
- [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts) owns historical simple averages and historical GP%.
- [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts) owns bounded ratio math and ratio window semantics.
- [rollingPlayerMetricMath.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts) owns `/60` and share reconstruction logic.
- [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts) owns coverage and suspicious-output reporting.

### Initial Audit Implications from 1.2

- Metric correctness bugs are likely to cluster into one of three buckets:
  - orchestration / window semantics in `fetchRollingPlayerAverages.ts`
  - ratio semantics in `rollingMetricAggregation.ts`
  - source-reconstruction assumptions in `rollingPlayerMetricMath.ts`
- GP% issues are split across:
  - per-row window assembly in `fetchRollingPlayerAverages.ts`
  - historical GP% storage in `rollingHistoricalAverages.ts`
- Diagnostics should be audited for coverage usefulness, but not treated as core metric logic.

## 1.3 Upstream Table Inventory and Classification

### Tables Read Directly by the Rolling Suite

| Table | Role | Classification | Notes |
| --- | --- | --- | --- |
| `games` | Team game ledger, date ordering, known game IDs, full-refresh preflight | Authoritative for team schedule context | Used to build team cumulative game counts and rolling team-game windows. |
| `players` | Player ID inventory for batch processing | Authoritative for player scope | Excludes goalies in default all-player runs. |
| `wgo_skater_stats` | Per-game player surface stats, dates, game IDs, team abbreviation, PP TOI share inputs | Mixed: authoritative for date spine and WGO-only fields, fallback for some counting stats | Acts as the primary row spine for `buildGameRecords(...)`. |
| `lineCombinations` | Line slot and position-group context | Derived contextual table | Used only for `line_combo_slot` and `line_combo_group`. |
| `powerPlayCombinations` | PP unit context and PP usage semantics | Derived contextual table | Current rolling pipeline reads `unit`, `PPTOI`, and legacy `percentageOfPP`, though `pp_share_pct` now relies on WGO share inputs instead. |
| `nst_gamelog_as_counts` | All-strength player counts | Authoritative for NST count metrics | Used for counts like goals, points, shots, ixG, iSCF, iHDCF, hits, blocks. |
| `nst_gamelog_as_rates` | All-strength player rates | Fallback / supplementary | Used mainly for `shots_per_60`, `ixg_per_60`, and `toi_per_gp` fallback. |
| `nst_gamelog_as_counts_oi` | All-strength on-ice counts | Authoritative for on-ice and territorial metrics | Drives IPP denominator, OZS%, oiSH%, PDO, CF/CA, FF/FA. |
| `nst_gamelog_es_counts` | Even-strength player counts | Authoritative for EV split counts | Same role as all-strength counts, but EV-specific. |
| `nst_gamelog_es_rates` | Even-strength player rates | Fallback / supplementary | Same role as all-strength rates, but EV-specific. |
| `nst_gamelog_es_counts_oi` | Even-strength on-ice counts | Authoritative for EV on-ice metrics | Same role as all-strength on-ice counts, but EV-specific. |
| `nst_gamelog_pp_counts` | Power-play player counts | Authoritative for PP split counts | Same role as all-strength counts, but PP-specific. |
| `nst_gamelog_pp_rates` | Power-play player rates | Fallback / supplementary | Same role as all-strength rates, but PP-specific. |
| `nst_gamelog_pp_counts_oi` | Power-play on-ice counts | Authoritative for PP on-ice metrics | Same role as all-strength on-ice counts, but PP-specific. |
| `nst_gamelog_pk_counts` | Penalty-kill player counts | Authoritative for PK split counts | Same role as all-strength counts, but PK-specific. |
| `nst_gamelog_pk_rates` | Penalty-kill player rates | Fallback / supplementary | Same role as all-strength rates, but PK-specific. |
| `nst_gamelog_pk_counts_oi` | Penalty-kill on-ice counts | Authoritative for PK on-ice metrics | Same role as all-strength on-ice counts, but PK-specific. |
| `rolling_player_game_metrics` | Existing target table for resume detection, delete/truncate, and final upsert destination | Derived storage table | Not an upstream source for metric values, but part of the suite’s control path and stale-row behavior. |

### Upstream Builders Affecting Table Semantics

| Table | Builder / Writer | Classification | Why It Matters |
| --- | --- | --- | --- |
| `powerPlayCombinations` | [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts) | Derived contextual table | Defines PP unit assignment, legacy `percentageOfPP`, and new team-share / unit-relative PP usage semantics. |
| `lineCombinations` | Not yet traced in this subtask | Derived contextual table | Needed later for context-only audit, not core metric formulas. |

### Current Classification Rules

- `Authoritative`:
  - the table is treated as the primary source for that metric family inside the current pipeline
- `Fallback / supplementary`:
  - the table is used only when primary fields are missing or to reconstruct missing numerators / denominators
- `Derived contextual table`:
  - the table is itself produced by another builder and contributes context rather than base metric totals
- `Derived storage table`:
  - the table is the output target of the suite or is used for operational resume / refresh behavior

### Source Quirk Notes Identified So Far

- `wgo_skater_stats`
  - doubles as both date spine and fallback stat source
  - `toi_per_game` can be minutes or seconds depending on ingest behavior, so the pipeline sanitizes it heuristically
- `nst_gamelog_*_rates`
  - rates are not used as the primary truth when raw totals exist
  - `toi_per_gp` is used as a fallback denominator source
- `nst_gamelog_*_counts_oi`
  - critical for on-ice percentages and territorial ratios
  - these tables supply the numerators and denominators needed to avoid summing per-game percentages incorrectly
- `powerPlayCombinations`
  - legacy `percentageOfPP` is a unit-relative usage index, not a true team PP share
  - new PP semantics are split across unit-relative fields and `pp_share_of_team`

### Initial Audit Implications from 1.3

- The suite has three distinct source classes:
  - WGO date spine / fallback surface stats
  - NST authoritative count and on-ice tables
  - derived context tables for lineup and PP usage
- Many correctness questions are really source-precedence questions rather than formula questions.
- `rolling_player_game_metrics` should be treated as a target and stale-state artifact during audit, not as evidence of current-code truth unless the row is known to be refreshed.

## 1.4 Upstream Builders That Affect Rolling Semantics

### [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts)

#### What It Builds

- Writes rows into `powerPlayCombinations`
- Persists:
  - `unit`
  - `PPTOI`
  - `percentageOfPP`
  - `pp_unit_usage_index`
  - `pp_unit_relative_toi`
  - `pp_vs_unit_avg`
  - `pp_share_of_team`

#### Source Inputs

- `fetchTOIRawData(gameId)`
- `getTOIData(rawData, "pp-toi")`
- `getPowerPlayBlocks(plays)`
- [powerPlayCombinationMetrics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts)

#### Semantic Impact on Rolling Metrics

- This builder directly controls the meaning of:
  - `pp_unit`
  - legacy `percentageOfPP`
  - all new PP unit-relative semantics
- It previously created the semantic trap where `percentageOfPP` looked like a team-share percentage even though it was actually:
  - `player PPTOI / average PPTOI of assigned unit`
- The current rolling pipeline no longer relies on `percentageOfPP` for `pp_share_pct`, but this builder still determines PP unit context and remains critical to any audit of PP semantics.

#### Audit Relevance

- High relevance for:
  - PP role interpretation
  - unit assignment assumptions
  - true team PP share vs unit-relative usage
- Medium relevance for:
  - rolling `pp_share_pct` only insofar as the rolling pipeline still reads `pp_unit` from this table

### [powerPlayCombinationMetrics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts)

#### What It Owns

- Pure math for PP unit-relative and team-share derived fields.
- Defines:
  - `percentageOfPP`
  - `pp_unit_usage_index`
  - `pp_unit_relative_toi`
  - `pp_vs_unit_avg`
  - `pp_share_of_team`

#### Semantic Impact

- Confirms that:
  - `percentageOfPP` and `pp_unit_usage_index` are the same unit-relative index
  - `pp_vs_unit_avg` is the signed ratio vs unit average
  - `pp_unit_relative_toi` is the signed seconds vs unit average
  - `pp_share_of_team` is the only true team-share metric in this builder

### [update-line-combinations/[id].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts)

#### What It Builds

- Writes rows into `lineCombinations`
- Persists per-game, per-team:
  - `forwards`
  - `defensemen`
  - `goalies`

#### Source Inputs

- `simpleGetTOIData(id)`
- TOI-driven line sorting through `sortByLineCombination(...)`
- NHL boxscore goalie pull through `https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`

#### Semantic Impact on Rolling Metrics

- This builder affects only contextual columns in the rolling pipeline:
  - `line_combo_slot`
  - `line_combo_group`
- It does not influence the math of rolling counts, ratios, or rates directly.
- Its semantic risk is contextual accuracy:
  - whether slot assignment reflects real role
  - whether stale or missing line combinations produce null or misleading role labels

#### Audit Relevance

- High relevance for:
  - role-context labeling
  - contextual interpretation of rolling rows
- Low relevance for:
  - core formula correctness of metrics like rates, percentages, and GP%

### [update-line-combinations/index.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts)

- Batch wrapper for line-combination refreshes.
- Operationally relevant because it determines whether the contextual table is kept fresh enough to support role labels.
- Not directly relevant to metric math.

### Builder Impact Summary

- `powerPlayCombinations` builder:
  - directly affects PP usage semantics
  - can create misleading meanings if field naming and field usage diverge
- `lineCombinations` builder:
  - affects only role and slot context
  - can influence interpretation but not the underlying metric math

### Initial Audit Implications from 1.4

- PP usage should be audited as both:
  - a rolling metric formula question
  - an upstream semantic builder question
- Line combinations should be audited separately as a context-label accuracy problem, not mixed into the metric-formula review.
- The final audit should treat upstream builders as first-class semantic dependencies, not just background ingestion jobs.

## 1.5 Draft Upstream Tables Section

### Upstream Tables

#### Core Scheduling and Scope Tables

| Table | Classification | Purpose in Rolling Suite | Key Quirks / Risks |
| --- | --- | --- | --- |
| `games` | Authoritative | Supplies game dates, team schedule order, known game IDs, and team-game ledger construction. | Drives team-game windows and current GP% math. Any missing or mismapped game IDs affect both context and availability logic. |
| `players` | Authoritative | Supplies batch player scope for recompute runs. | Default all-player runs exclude goalies, which is intentional but should be explicit in the audit. |

#### Primary Per-Game Stat Spine

| Table | Classification | Purpose in Rolling Suite | Key Quirks / Risks |
| --- | --- | --- | --- |
| `wgo_skater_stats` | Mixed: authoritative for row spine, fallback for some surface stats | Provides the per-game player date spine, game IDs, team abbreviation, WGO surface fields, PPTOI, PP share input, and WGO TOI fallback. | `toi_per_game` may arrive in minutes or seconds, so the pipeline uses heuristic normalization. This table can also mask missing NST data because it keeps the game row alive even when NST rows are absent. |

#### Authoritative NST Count and On-Ice Tables

| Table | Classification | Purpose in Rolling Suite | Key Quirks / Risks |
| --- | --- | --- | --- |
| `nst_gamelog_as_counts` | Authoritative | All-strength player counts and individual chance metrics. | Core source for goals, assists, points, shots, ixG, iSCF, iHDCF, hits, and blocks. |
| `nst_gamelog_as_counts_oi` | Authoritative | All-strength on-ice counts and territorial context. | Required for IPP denominator, OZS%, oiSH%, PDO, CF/CA, and FF/FA. |
| `nst_gamelog_es_counts` | Authoritative | EV split player counts. | Same semantic role as all-strength counts, but split-specific. |
| `nst_gamelog_es_counts_oi` | Authoritative | EV split on-ice counts. | Same semantic role as all-strength on-ice counts, but split-specific. |
| `nst_gamelog_pp_counts` | Authoritative | PP split player counts. | Same semantic role as all-strength counts, but split-specific. |
| `nst_gamelog_pp_counts_oi` | Authoritative | PP split on-ice counts. | Same semantic role as all-strength on-ice counts, but split-specific. |
| `nst_gamelog_pk_counts` | Authoritative | PK split player counts. | Same semantic role as all-strength counts, but split-specific. |
| `nst_gamelog_pk_counts_oi` | Authoritative | PK split on-ice counts. | Same semantic role as all-strength on-ice counts, but split-specific. |

#### NST Rate Tables Used as Supplementary Inputs

| Table | Classification | Purpose in Rolling Suite | Key Quirks / Risks |
| --- | --- | --- | --- |
| `nst_gamelog_as_rates` | Fallback / supplementary | Supplies `shots_per_60`, `ixg_per_60`, and `toi_per_gp` fallback values. | Rates should not override raw totals when counts exist; audit must confirm this stays true. |
| `nst_gamelog_es_rates` | Fallback / supplementary | EV split rate and TOI fallback input. | Same fallback semantics as all-strength rates. |
| `nst_gamelog_pp_rates` | Fallback / supplementary | PP split rate and TOI fallback input. | Same fallback semantics as all-strength rates. |
| `nst_gamelog_pk_rates` | Fallback / supplementary | PK split rate and TOI fallback input. | Same fallback semantics as all-strength rates. |

#### Derived Context Tables Consumed by the Rolling Suite

| Table | Classification | Purpose in Rolling Suite | Key Quirks / Risks |
| --- | --- | --- | --- |
| `lineCombinations` | Derived contextual table | Supplies `line_combo_slot` and `line_combo_group`. | Context-label only; affects interpretation rather than metric math. Staleness or missing rows produce null or misleading role context. |
| `powerPlayCombinations` | Derived contextual table | Supplies `pp_unit` and legacy / new PP usage semantics. | Legacy `percentageOfPP` is unit-relative, not team-share. The rolling pipeline now uses WGO PP share for `pp_share_pct`, but still depends on this table for unit context. |

#### Target / Operational Table

| Table | Classification | Purpose in Rolling Suite | Key Quirks / Risks |
| --- | --- | --- | --- |
| `rolling_player_game_metrics` | Derived storage table | Stores final per-game rolling snapshots and is also used for resume detection and full-refresh control flow. | Must not be treated as proof of current-code correctness unless rows are known to be refreshed after a logic change. |

### Upstream Builder Dependencies

| Builder | Output Table | Why It Matters to Rolling Metrics |
| --- | --- | --- |
| [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts) | `powerPlayCombinations` | Defines PP unit assignment and unit-relative PP semantics that affect `pp_unit` interpretation and PP-context audit work. |
| [update-line-combinations/[id].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts) | `lineCombinations` | Defines line slot and position-group context used by the rolling table’s contextual columns. |

### Final Notes for the Future Audit Writeup

- The final audit’s `Upstream Tables` section can be built from this draft directly.
- The most important classification distinction is:
  - WGO = row spine plus selective fallback
  - NST counts / on-ice tables = metric truth for most formulas
  - NST rates = reconstruction fallback
  - derived context tables = interpretation / labeling support
- The final audit should keep upstream table semantics separate from metric status labels so source-truth questions are not buried inside the `WORKING / BROKEN / ALMOST / NEEDS REVIEW` lists.
