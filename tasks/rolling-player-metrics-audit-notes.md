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

## 2.1 Metric Family Inventory

The rolling table has two kinds of persisted fields:
- row identity and context fields
- metric families, each repeated across one or more window / baseline suffix sets

### Row Identity and Context Fields

- `player_id`
- `game_date`
- `game_id`
- `season`
- `team_id`
- `strength_state`
- `line_combo_slot`
- `line_combo_group`
- `pp_unit`
- `updated_at`

These are not metric families, but they define row identity, split context, and auditability.

### Family 1: Availability / Participation

- `games_played`
- `team_games_played`
- `gp_pct`

Coverage style:
- `games_played` and `team_games_played` are single-state counters
- `gp_pct` has:
  - `total_all`
  - `avg_all`
  - `total_last3/5/10/20`
  - `avg_last3/5/10/20`
  - `avg_season`
  - `avg_3ya`
  - `avg_career`

### Family 2: Time On Ice

- `toi_seconds`

Coverage style:
- `total_all`
- `avg_all`
- `total_last3/5/10/20`
- `avg_last3/5/10/20`
- `avg_season`
- `avg_3ya`
- `avg_career`

### Family 3: Surface Counting Stats

- `goals`
- `assists`
- `shots`
- `hits`
- `blocks`
- `pp_points`
- `points`

Coverage style for each:
- `total_all`
- `avg_all`
- `total_last3/5/10/20`
- `avg_last3/5/10/20`
- `avg_season`
- `avg_3ya`
- `avg_career`

### Family 4: Individual Chance / Opportunity Counting Stats

- `ixg`
- `iscf`
- `ihdcf`

Coverage style for each:
- `total_all`
- `avg_all`
- `total_last3/5/10/20`
- `avg_last3/5/10/20`
- `avg_season`
- `avg_3ya`
- `avg_career`

### Family 5: Weighted `/60` Rate Stats

- `sog_per_60`
- `ixg_per_60`
- `hits_per_60`
- `blocks_per_60`

Coverage style for each:
- `total_all`
- `avg_all`
- `total_last3/5/10/20`
- `avg_last3/5/10/20`
- `avg_season`
- `avg_3ya`
- `avg_career`

Important note:
- for these families, `total_*` and `avg_*` are currently the same stored value because the pipeline materializes the weighted rate snapshot into both columns

### Family 6: Finishing / Individual Ratio Stats

- `shooting_pct`
- `primary_points_pct`
- `expected_sh_pct`

Coverage style for each:
- `total_all`
- `avg_all`
- `total_last3/5/10/20`
- `avg_last3/5/10/20`
- `avg_season`
- `avg_3ya`
- `avg_career`

Important note:
- like the other ratio families, `total_*` and `avg_*` are currently the same stored value because they represent aggregated ratio snapshots, not additive totals

### Family 7: On-Ice Conversion and Puck-Luck Context

- `ipp`
- `on_ice_sh_pct`
- `pdo`

Coverage style for each:
- `total_all`
- `avg_all`
- `total_last3/5/10/20`
- `avg_last3/5/10/20`
- `avg_season`
- `avg_3ya`
- `avg_career`

### Family 8: Zone and Usage Context

- `oz_start_pct`
- `pp_share_pct`

Coverage style for each:
- `total_all`
- `avg_all`
- `total_last3/5/10/20`
- `avg_last3/5/10/20`
- `avg_season`
- `avg_3ya`
- `avg_career`

### Family 9: Territorial / Possession Counting Stats

- `cf`
- `ca`
- `ff`
- `fa`

Coverage style for each:
- `total_all`
- `avg_all`
- `total_last3/5/10/20`
- `avg_last3/5/10/20`
- `avg_season`
- `avg_3ya`
- `avg_career`

### Family 10: Territorial / Possession Ratio Stats

- `cf_pct`
- `ff_pct`

Coverage style for each:
- `total_all`
- `avg_all`
- `total_last3/5/10/20`
- `avg_last3/5/10/20`
- `avg_season`
- `avg_3ya`
- `avg_career`

### Family 11: Historical Baseline Layer

The following suffix families are baseline-oriented and should be audited separately from rolling windows:

- `avg_season`
- `avg_3ya`
- `avg_career`

They exist for nearly every metric family except raw row identity fields and certain context counters.

### Family 12: Rolling Window Layer

The following suffix families are rolling-window-oriented and should be audited separately from historical baselines:

- `total_last3`
- `avg_last3`
- `total_last5`
- `avg_last5`
- `total_last10`
- `avg_last10`
- `total_last20`
- `avg_last20`

Important note:
- these suffixes do not necessarily mean the same thing across all metric families today
- some are additive sums
- some are rolling averages
- some are aggregated ratio snapshots
- some may currently reflect last N valid observations rather than last N team games

### Family 13: Career-to-Date Layer

The following suffix families represent cumulative career-to-date state at each row:

- `total_all`
- `avg_all`

Important note:
- `total_all` truly means additive cumulative total only for additive families
- for ratio families and weighted-rate families, `total_all` is a snapshot label rather than an additive total

### Initial Audit Implications from 2.1

- The family inventory confirms the table is semantically overloaded:
  - the same suffix labels are reused across additive counts, weighted rates, bounded ratios, and availability metrics
- The audit will need to judge not just formulas, but also whether suffix naming remains appropriate per family.
- `total_*` versus `avg_*` is already suspicious for ratio and weighted-rate families because both columns currently store the same snapshot value.

## 2.2 Column-by-Column Inventory

This section is the concrete stored-column inventory for `rolling_player_game_metrics`. It is grouped by family for readability, but the intent is column-level completeness.

### Row Identity and Context Columns

- `player_id`
- `game_date`
- `game_id`
- `season`
- `team_id`
- `strength_state`
- `line_combo_slot`
- `line_combo_group`
- `pp_unit`
- `updated_at`

### Availability / Participation Columns

- `games_played`
- `team_games_played`
- `gp_pct_total_all`
- `gp_pct_avg_all`
- `gp_pct_total_last3`
- `gp_pct_avg_last3`
- `gp_pct_total_last5`
- `gp_pct_avg_last5`
- `gp_pct_total_last10`
- `gp_pct_avg_last10`
- `gp_pct_total_last20`
- `gp_pct_avg_last20`
- `gp_pct_avg_season`
- `gp_pct_avg_3ya`
- `gp_pct_avg_career`

### TOI Columns

- `toi_seconds_total_all`
- `toi_seconds_avg_all`
- `toi_seconds_total_last3`
- `toi_seconds_avg_last3`
- `toi_seconds_total_last5`
- `toi_seconds_avg_last5`
- `toi_seconds_total_last10`
- `toi_seconds_avg_last10`
- `toi_seconds_total_last20`
- `toi_seconds_avg_last20`
- `toi_seconds_avg_season`
- `toi_seconds_avg_3ya`
- `toi_seconds_avg_career`

### Surface Counting Columns

#### `goals`

- `goals_total_all`
- `goals_avg_all`
- `goals_total_last3`
- `goals_avg_last3`
- `goals_total_last5`
- `goals_avg_last5`
- `goals_total_last10`
- `goals_avg_last10`
- `goals_total_last20`
- `goals_avg_last20`
- `goals_avg_season`
- `goals_avg_3ya`
- `goals_avg_career`

#### `assists`

- `assists_total_all`
- `assists_avg_all`
- `assists_total_last3`
- `assists_avg_last3`
- `assists_total_last5`
- `assists_avg_last5`
- `assists_total_last10`
- `assists_avg_last10`
- `assists_total_last20`
- `assists_avg_last20`
- `assists_avg_season`
- `assists_avg_3ya`
- `assists_avg_career`

#### `shots`

- `shots_total_all`
- `shots_avg_all`
- `shots_total_last3`
- `shots_avg_last3`
- `shots_total_last5`
- `shots_avg_last5`
- `shots_total_last10`
- `shots_avg_last10`
- `shots_total_last20`
- `shots_avg_last20`
- `shots_avg_season`
- `shots_avg_3ya`
- `shots_avg_career`

#### `hits`

- `hits_total_all`
- `hits_avg_all`
- `hits_total_last3`
- `hits_avg_last3`
- `hits_total_last5`
- `hits_avg_last5`
- `hits_total_last10`
- `hits_avg_last10`
- `hits_total_last20`
- `hits_avg_last20`
- `hits_avg_season`
- `hits_avg_3ya`
- `hits_avg_career`

#### `blocks`

- `blocks_total_all`
- `blocks_avg_all`
- `blocks_total_last3`
- `blocks_avg_last3`
- `blocks_total_last5`
- `blocks_avg_last5`
- `blocks_total_last10`
- `blocks_avg_last10`
- `blocks_total_last20`
- `blocks_avg_last20`
- `blocks_avg_season`
- `blocks_avg_3ya`
- `blocks_avg_career`

#### `pp_points`

- `pp_points_total_all`
- `pp_points_avg_all`
- `pp_points_total_last3`
- `pp_points_avg_last3`
- `pp_points_total_last5`
- `pp_points_avg_last5`
- `pp_points_total_last10`
- `pp_points_avg_last10`
- `pp_points_total_last20`
- `pp_points_avg_last20`
- `pp_points_avg_season`
- `pp_points_avg_3ya`
- `pp_points_avg_career`

#### `points`

- `points_total_all`
- `points_avg_all`
- `points_total_last3`
- `points_avg_last3`
- `points_total_last5`
- `points_avg_last5`
- `points_total_last10`
- `points_avg_last10`
- `points_total_last20`
- `points_avg_last20`
- `points_avg_season`
- `points_avg_3ya`
- `points_avg_career`

### Individual Chance / Opportunity Counting Columns

#### `ixg`

- `ixg_total_all`
- `ixg_avg_all`
- `ixg_total_last3`
- `ixg_avg_last3`
- `ixg_total_last5`
- `ixg_avg_last5`
- `ixg_total_last10`
- `ixg_avg_last10`
- `ixg_total_last20`
- `ixg_avg_last20`
- `ixg_avg_season`
- `ixg_avg_3ya`
- `ixg_avg_career`

#### `iscf`

- `iscf_total_all`
- `iscf_avg_all`
- `iscf_total_last3`
- `iscf_avg_last3`
- `iscf_total_last5`
- `iscf_avg_last5`
- `iscf_total_last10`
- `iscf_avg_last10`
- `iscf_total_last20`
- `iscf_avg_last20`
- `iscf_avg_season`
- `iscf_avg_3ya`
- `iscf_avg_career`

#### `ihdcf`

- `ihdcf_total_all`
- `ihdcf_avg_all`
- `ihdcf_total_last3`
- `ihdcf_avg_last3`
- `ihdcf_total_last5`
- `ihdcf_avg_last5`
- `ihdcf_total_last10`
- `ihdcf_avg_last10`
- `ihdcf_total_last20`
- `ihdcf_avg_last20`
- `ihdcf_avg_season`
- `ihdcf_avg_3ya`
- `ihdcf_avg_career`

### Weighted `/60` Rate Columns

#### `sog_per_60`

- `sog_per_60_total_all`
- `sog_per_60_avg_all`
- `sog_per_60_total_last3`
- `sog_per_60_avg_last3`
- `sog_per_60_total_last5`
- `sog_per_60_avg_last5`
- `sog_per_60_total_last10`
- `sog_per_60_avg_last10`
- `sog_per_60_total_last20`
- `sog_per_60_avg_last20`
- `sog_per_60_avg_season`
- `sog_per_60_avg_3ya`
- `sog_per_60_avg_career`

#### `ixg_per_60`

- `ixg_per_60_total_all`
- `ixg_per_60_avg_all`
- `ixg_per_60_total_last3`
- `ixg_per_60_avg_last3`
- `ixg_per_60_total_last5`
- `ixg_per_60_avg_last5`
- `ixg_per_60_total_last10`
- `ixg_per_60_avg_last10`
- `ixg_per_60_total_last20`
- `ixg_per_60_avg_last20`
- `ixg_per_60_avg_season`
- `ixg_per_60_avg_3ya`
- `ixg_per_60_avg_career`

#### `hits_per_60`

- `hits_per_60_total_all`
- `hits_per_60_avg_all`
- `hits_per_60_total_last3`
- `hits_per_60_avg_last3`
- `hits_per_60_total_last5`
- `hits_per_60_avg_last5`
- `hits_per_60_total_last10`
- `hits_per_60_avg_last10`
- `hits_per_60_total_last20`
- `hits_per_60_avg_last20`
- `hits_per_60_avg_season`
- `hits_per_60_avg_3ya`
- `hits_per_60_avg_career`

#### `blocks_per_60`

- `blocks_per_60_total_all`
- `blocks_per_60_avg_all`
- `blocks_per_60_total_last3`
- `blocks_per_60_avg_last3`
- `blocks_per_60_total_last5`
- `blocks_per_60_avg_last5`
- `blocks_per_60_total_last10`
- `blocks_per_60_avg_last10`
- `blocks_per_60_total_last20`
- `blocks_per_60_avg_last20`
- `blocks_per_60_avg_season`
- `blocks_per_60_avg_3ya`
- `blocks_per_60_avg_career`

### Finishing / Individual Ratio Columns

#### `shooting_pct`

- `shooting_pct_total_all`
- `shooting_pct_avg_all`
- `shooting_pct_total_last3`
- `shooting_pct_avg_last3`
- `shooting_pct_total_last5`
- `shooting_pct_avg_last5`
- `shooting_pct_total_last10`
- `shooting_pct_avg_last10`
- `shooting_pct_total_last20`
- `shooting_pct_avg_last20`
- `shooting_pct_avg_season`
- `shooting_pct_avg_3ya`
- `shooting_pct_avg_career`

#### `primary_points_pct`

- `primary_points_pct_total_all`
- `primary_points_pct_avg_all`
- `primary_points_pct_total_last3`
- `primary_points_pct_avg_last3`
- `primary_points_pct_total_last5`
- `primary_points_pct_avg_last5`
- `primary_points_pct_total_last10`
- `primary_points_pct_avg_last10`
- `primary_points_pct_total_last20`
- `primary_points_pct_avg_last20`
- `primary_points_pct_avg_season`
- `primary_points_pct_avg_3ya`
- `primary_points_pct_avg_career`

#### `expected_sh_pct`

- `expected_sh_pct_total_all`
- `expected_sh_pct_avg_all`
- `expected_sh_pct_total_last3`
- `expected_sh_pct_avg_last3`
- `expected_sh_pct_total_last5`
- `expected_sh_pct_avg_last5`
- `expected_sh_pct_total_last10`
- `expected_sh_pct_avg_last10`
- `expected_sh_pct_total_last20`
- `expected_sh_pct_avg_last20`
- `expected_sh_pct_avg_season`
- `expected_sh_pct_avg_3ya`
- `expected_sh_pct_avg_career`

### On-Ice Conversion / Context Ratio Columns

#### `ipp`

- `ipp_total_all`
- `ipp_avg_all`
- `ipp_total_last3`
- `ipp_avg_last3`
- `ipp_total_last5`
- `ipp_avg_last5`
- `ipp_total_last10`
- `ipp_avg_last10`
- `ipp_total_last20`
- `ipp_avg_last20`
- `ipp_avg_season`
- `ipp_avg_3ya`
- `ipp_avg_career`

#### `on_ice_sh_pct`

- `on_ice_sh_pct_total_all`
- `on_ice_sh_pct_avg_all`
- `on_ice_sh_pct_total_last3`
- `on_ice_sh_pct_avg_last3`
- `on_ice_sh_pct_total_last5`
- `on_ice_sh_pct_avg_last5`
- `on_ice_sh_pct_total_last10`
- `on_ice_sh_pct_avg_last10`
- `on_ice_sh_pct_total_last20`
- `on_ice_sh_pct_avg_last20`
- `on_ice_sh_pct_avg_season`
- `on_ice_sh_pct_avg_3ya`
- `on_ice_sh_pct_avg_career`

#### `pdo`

- `pdo_total_all`
- `pdo_avg_all`
- `pdo_total_last3`
- `pdo_avg_last3`
- `pdo_total_last5`
- `pdo_avg_last5`
- `pdo_total_last10`
- `pdo_avg_last10`
- `pdo_total_last20`
- `pdo_avg_last20`
- `pdo_avg_season`
- `pdo_avg_3ya`
- `pdo_avg_career`

### Zone and Usage Context Ratio Columns

#### `oz_start_pct`

- `oz_start_pct_total_all`
- `oz_start_pct_avg_all`
- `oz_start_pct_total_last3`
- `oz_start_pct_avg_last3`
- `oz_start_pct_total_last5`
- `oz_start_pct_avg_last5`
- `oz_start_pct_total_last10`
- `oz_start_pct_avg_last10`
- `oz_start_pct_total_last20`
- `oz_start_pct_avg_last20`
- `oz_start_pct_avg_season`
- `oz_start_pct_avg_3ya`
- `oz_start_pct_avg_career`

#### `pp_share_pct`

- `pp_share_pct_total_all`
- `pp_share_pct_avg_all`
- `pp_share_pct_total_last3`
- `pp_share_pct_avg_last3`
- `pp_share_pct_total_last5`
- `pp_share_pct_avg_last5`
- `pp_share_pct_total_last10`
- `pp_share_pct_avg_last10`
- `pp_share_pct_total_last20`
- `pp_share_pct_avg_last20`
- `pp_share_pct_avg_season`
- `pp_share_pct_avg_3ya`
- `pp_share_pct_avg_career`

### Territorial Counting Columns

#### `cf`

- `cf_total_all`
- `cf_avg_all`
- `cf_total_last3`
- `cf_avg_last3`
- `cf_total_last5`
- `cf_avg_last5`
- `cf_total_last10`
- `cf_avg_last10`
- `cf_total_last20`
- `cf_avg_last20`
- `cf_avg_season`
- `cf_avg_3ya`
- `cf_avg_career`

#### `ca`

- `ca_total_all`
- `ca_avg_all`
- `ca_total_last3`
- `ca_avg_last3`
- `ca_total_last5`
- `ca_avg_last5`
- `ca_total_last10`
- `ca_avg_last10`
- `ca_total_last20`
- `ca_avg_last20`
- `ca_avg_season`
- `ca_avg_3ya`
- `ca_avg_career`

#### `ff`

- `ff_total_all`
- `ff_avg_all`
- `ff_total_last3`
- `ff_avg_last3`
- `ff_total_last5`
- `ff_avg_last5`
- `ff_total_last10`
- `ff_avg_last10`
- `ff_total_last20`
- `ff_avg_last20`
- `ff_avg_season`
- `ff_avg_3ya`
- `ff_avg_career`

#### `fa`

- `fa_total_all`
- `fa_avg_all`
- `fa_total_last3`
- `fa_avg_last3`
- `fa_total_last5`
- `fa_avg_last5`
- `fa_total_last10`
- `fa_avg_last10`
- `fa_total_last20`
- `fa_avg_last20`
- `fa_avg_season`
- `fa_avg_3ya`
- `fa_avg_career`

### Territorial Ratio Columns

#### `cf_pct`

- `cf_pct_total_all`
- `cf_pct_avg_all`
- `cf_pct_total_last3`
- `cf_pct_avg_last3`
- `cf_pct_total_last5`
- `cf_pct_avg_last5`
- `cf_pct_total_last10`
- `cf_pct_avg_last10`
- `cf_pct_total_last20`
- `cf_pct_avg_last20`
- `cf_pct_avg_season`
- `cf_pct_avg_3ya`
- `cf_pct_avg_career`

#### `ff_pct`

- `ff_pct_total_all`
- `ff_pct_avg_all`
- `ff_pct_total_last3`
- `ff_pct_avg_last3`
- `ff_pct_total_last5`
- `ff_pct_avg_last5`
- `ff_pct_total_last10`
- `ff_pct_avg_last10`
- `ff_pct_total_last20`
- `ff_pct_avg_last20`
- `ff_pct_avg_season`
- `ff_pct_avg_3ya`
- `ff_pct_avg_career`

### Inventory Summary

- Total row-identity/context columns: `10`
- Total one-off availability counters: `2`
- Total `gp_pct` columns: `13`
- Total metric families with repeated suffix sets: `29`
- Each repeated metric family currently expands into:
  - `13` stored columns
  - except where the family is single-state only, such as `games_played` and `team_games_played`

### Initial Audit Implications from 2.2

- The full table inventory confirms that the audit should track findings at two levels:
  - metric family
  - exact stored column
- The repeated 13-column suffix pattern is a useful audit scaffold, but it also hides where the same suffix name means different things across families.
- Any remediation plan may need to distinguish:
  - family-level logic fixes
  - suffix naming fixes
  - schema simplification opportunities

## 2.3 Current Shorthand Formula Inventory

These formulas describe the current code behavior, not yet whether the behavior is correct.

### General Suffix Rules

#### Simple / Additive Families

For a simple metric family `m`:

- `m_total_all = sum(m across all accumulated rows)`
- `m_avg_all = sum(m across all accumulated rows) / count(non-null m rows)`
- `m_total_lastN = sum(m across rolling window values)`
- `m_avg_lastN = sum(m across rolling window values) / count(non-null m rows in window)`
- `m_avg_season = season-to-date average from historical accumulator`
- `m_avg_3ya = 3-year weighted average from historical accumulator`
- `m_avg_career = career average from historical accumulator`

#### Ratio Families

For a ratio metric family `r` with numerator `num` and denominator `den`:

- `r_total_all = ratio(sum(num), sum(den))` using the family’s scale and combine rules
- `r_avg_all = same stored value as r_total_all`
- `r_total_lastN = ratio(sum(window numerators), sum(window denominators))`
- `r_avg_lastN = same stored value as r_total_lastN`
- `r_avg_season = historical season ratio snapshot`
- `r_avg_3ya = historical 3-year ratio snapshot`
- `r_avg_career = historical career ratio snapshot`

Important current behavior:
- ratio rows are only included when at least one required denominator exists
- therefore some ratio windows can behave like “last N valid observations”

#### Weighted `/60` Families

For a weighted `/60` metric `x_per_60`:

- `x_per_60_total_all = (sum(raw x) / sum(toi_seconds)) * 3600`
- `x_per_60_avg_all = same stored value as x_per_60_total_all`
- `x_per_60_total_lastN = (sum(window raw x) / sum(window toi_seconds)) * 3600`
- `x_per_60_avg_lastN = same stored value as x_per_60_total_lastN`
- `x_per_60_avg_season = historical season weighted /60 snapshot`
- `x_per_60_avg_3ya = historical 3-year weighted /60 snapshot`
- `x_per_60_avg_career = historical career weighted /60 snapshot`

### Availability / Participation Formulas

#### `games_played`

- current all-strength behavior: increments by `1` for every WGO row processed
- current split behavior (`ev`, `pp`, `pk`): increments by `1` only when split TOI is greater than `0`

#### `team_games_played`

- `team_games_played = team cumulative game count from games ledger as of current game_date`

#### `gp_pct`

- `gp_pct_total_all = games_played / team_games_played`
- `gp_pct_avg_all = same stored value as gp_pct_total_all`
- `gp_pct_total_lastN = playerGamesWindow / teamGamesWindow`
- `gp_pct_avg_lastN = same stored value as gp_pct_total_lastN`
- `gp_pct_avg_season = historical season playerGames / teamGames`
- `gp_pct_avg_3ya = historical 3-year playerGames / teamGames`
- `gp_pct_avg_career = historical career playerGames / teamGames`

Important current behavior:
- `playerGamesWindow` is based on last N appearance dates, not guaranteed last N team games
- this is already a likely semantic mismatch

### Time On Ice Formula

#### `toi_seconds`

- source value = `getToiSeconds(game)`
- fallback order:
  - `counts.toi`
  - `countsOi.toi`
  - `rates.toi_per_gp`
  - `fallbackToiSeconds`
  - WGO `toi_per_game` normalized to seconds

Stored forms:
- `toi_seconds_total_all = sum(toi_seconds)`
- `toi_seconds_avg_all = average(toi_seconds)`
- `toi_seconds_total_lastN = sum(window toi_seconds)`
- `toi_seconds_avg_lastN = average(window toi_seconds)`

### Surface Counting Formulas

#### `goals`

- game value = `counts.goals` else WGO `goals` for `all`

#### `assists`

- game value = `counts.total_assists` else WGO `assists` for `all`

#### `shots`

- game value = `counts.shots` else WGO `shots` for `all`

#### `hits`

- game value = `counts.hits` else WGO `hits` for `all`

#### `blocks`

- game value = `counts.shots_blocked` else WGO `blocked_shots` for `all`

#### `pp_points`

- `pp` strength game value = `counts.total_points`
- `all` strength game value = WGO `pp_points`

#### `points`

- game value = `counts.total_points` else WGO `points` for `all`

Stored forms for each simple counting family:
- `metric_total_all = sum(game value)`
- `metric_avg_all = average(game value)`
- `metric_total_lastN = sum(window game values)`
- `metric_avg_lastN = average(window game values)`

### Individual Chance / Opportunity Counting Formulas

#### `ixg`

- game value = `counts.ixg` else WGO fallback key if present

#### `iscf`

- game value = `counts.iscfs`

#### `ihdcf`

- game value = `counts.hdcf`

Stored forms:
- additive sum / average model, same as simple counting stats

### Weighted `/60` Formulas

#### `sog_per_60`

- numerator source = `shots`
- denominator source = `toi_seconds`
- fallback numerator reconstruction allowed through NST `shots_per_60`

#### `ixg_per_60`

- numerator source = `counts.ixg` else WGO fallback key
- denominator source = `toi_seconds`
- fallback numerator reconstruction allowed through NST `ixg_per_60`

#### `hits_per_60`

- numerator source = `hits`
- denominator source = `toi_seconds`

#### `blocks_per_60`

- numerator source = `blocks`
- denominator source = `toi_seconds`

Stored forms for each:
- `metric_total_all = (sum(numerator) / sum(denominator)) * 3600`
- `metric_avg_all = same stored value`
- `metric_total_lastN = (sum(window numerator) / sum(window denominator)) * 3600`
- `metric_avg_lastN = same stored value`

### Finishing / Individual Ratio Formulas

#### `shooting_pct`

- `shooting_pct = (sum(goals) / sum(shots)) * 100`

#### `primary_points_pct`

- `primary_points_pct = (sum(goals + first_assists) / sum(total_points))`

#### `expected_sh_pct`

- `expected_sh_pct = (sum(ixg) / sum(shots))`

Stored forms for each:
- ratio snapshot model across all / lastN / historical windows

### On-Ice Conversion / Context Ratio Formulas

#### `ipp`

- `ipp = (sum(player points) / sum(on-ice goals for)) * 100`

#### `on_ice_sh_pct`

- `on_ice_sh_pct = (sum(on-ice goals for) / sum(on-ice shots for)) * 100`

#### `pdo`

- `pdo = (((sum(gf) / sum(sf)) * 100) + (((sum(sa) - sum(ga)) / sum(sa)) * 100)) * 0.01`

Stored forms for each:
- ratio snapshot model across all / lastN / historical windows

### Zone and Usage Context Ratio Formulas

#### `oz_start_pct`

- `oz_start_pct = (sum(off_zone_starts) / sum(off_zone_starts + def_zone_starts)) * 100`

Important note:
- neutral-zone starts are excluded in the current code path

#### `pp_share_pct`

- current source components come from WGO:
  - numerator = `pp_toi`
  - denominator is inferred from `pp_toi_pct_per_game`
- shorthand:
  - `pp_share_pct = sum(pp_toi) / sum(inferred_team_pp_toi_from_wgo_share)`

Stored forms for each:
- ratio snapshot model across all / lastN / historical windows

### Territorial Counting Formulas

#### `cf`

- game value = `countsOi.cf`

#### `ca`

- game value = `countsOi.ca`

#### `ff`

- game value = `countsOi.ff`

#### `fa`

- game value = `countsOi.fa`

Stored forms:
- additive sum / average model, same as simple counting stats

### Territorial Ratio Formulas

#### `cf_pct`

- `cf_pct = (sum(cf) / sum(cf + ca)) * 100`

#### `ff_pct`

- `ff_pct = (sum(ff) / sum(ff + fa)) * 100`

Stored forms:
- ratio snapshot model across all / lastN / historical windows

### Historical Baseline Formulas

For simple families:
- `metric_avg_season = season average of simple values`
- `metric_avg_3ya = 3-year average of simple values`
- `metric_avg_career = career average of simple values`

For ratio families:
- `metric_avg_season = ratio-of-aggregates snapshot within current season`
- `metric_avg_3ya = ratio-of-aggregates snapshot across last 3 season keys`
- `metric_avg_career = ratio-of-aggregates snapshot across career`

For weighted `/60` families:
- historical fields behave like ratio-of-aggregates `/60` snapshots

### Initial Audit Implications from 2.3

- The shorthand formulas confirm that identical suffix names are doing different jobs depending on family type.
- `total_*` is already a misnomer for ratio and weighted-rate families because it stores a snapshot, not a true additive total.
- `gp_pct` has its own semantics and cannot safely be audited as just another ratio family.

## 2.4 Additive Counting Stats and Baseline Fields Audit

This subsection covers the families that use the simple accumulator path:

- `ixg`
- `iscf`
- `ihdcf`
- `toi_seconds`
- `cf`
- `ca`
- `ff`
- `fa`
- `goals`
- `assists`
- `shots`
- `hits`
- `blocks`
- `pp_points`
- `points`

### Current Additive Logic

For each simple metric:

- per-game value is resolved from the configured source field
- null / NaN rows are skipped
- cumulative state uses:
  - `sumAll += value`
  - `countAll += 1`
- rolling windows store:
  - last N non-null values
  - rolling sum
  - rolling non-null count
- outputs are materialized as:
  - `total_all = sumAll`
  - `avg_all = sumAll / countAll`
  - `total_lastN = window sum`
  - `avg_lastN = window sum / window count`
- historical baselines are computed through `HistoricalAverageAccumulator`

### Logic Review by Family Type

#### Surface Counting Families

- `goals`
- `assists`
- `shots`
- `hits`
- `blocks`
- `pp_points`
- `points`

Current verdict:
- additive accumulation logic appears internally correct
- rolling sums and rolling averages match the intended arithmetic model for player-game values

Important caveat:
- source precedence still matters
- for example, `points` and `pp_points` mix NST and WGO depending on strength, so formula correctness does not automatically guarantee source correctness

#### Individual Chance / Opportunity Counts

- `ixg`
- `iscf`
- `ihdcf`

Current verdict:
- additive accumulation logic appears internally correct
- `avg_*` semantics are straightforward means over non-null qualifying rows

Important caveat:
- `ixg` has a WGO fallback path even though NST counts are preferred
- that fallback should be reviewed later under source-precedence audit, not arithmetic audit

#### Territorial Counting Families

- `cf`
- `ca`
- `ff`
- `fa`

Current verdict:
- additive accumulation logic appears internally correct
- sums and averages are behaving as true count totals and count means

Important caveat:
- these are on-ice team-event counts, not individual player event counts
- the arithmetic is fine, but the final audit should still explain that distinction clearly in the rationale section

#### TOI Family

- `toi_seconds`

Current verdict:
- additive accumulation logic is internally consistent
- `total_*` meaningfully represents total accrued TOI
- `avg_*` meaningfully represents average TOI per qualifying row

Important caveat:
- correctness of `toi_seconds` still depends on `getToiSeconds(...)` source normalization and fallback order
- that makes the family arithmetic sound, but the source-resolution layer still needs validation

### Historical Baseline Logic for Simple Families

Simple historical baselines use [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts):

- `careerSum` / `careerCount`
- `bySeason` sum / count buckets
- normalized season-window logic for 3-year selection

Current verdict:
- arithmetic model for simple-family historical baselines is internally correct
- `avg_season`, `avg_3ya`, and `avg_career` behave like standard means over accumulated qualifying rows

### Semantics Review

For simple additive families, the current suffix semantics are mostly coherent:

- `total_*` means additive total
- `avg_*` means arithmetic mean over qualifying rows

This is notably better than the ratio and weighted-rate families, where suffix naming is already overloaded.

### Early Status Read from 2.4

Likely `✅` candidates, pending source validation:
- `goals`
- `assists`
- `shots`
- `hits`
- `blocks`
- `pp_points`
- `points`
- `ixg`
- `iscf`
- `ihdcf`
- `cf`
- `ca`
- `ff`
- `fa`
- `toi_seconds`
- simple-family `avg_season`
- simple-family `avg_3ya`
- simple-family `avg_career`

Likely `🔧` or `⚠️` carryover areas, but not because of additive arithmetic itself:
- source precedence for mixed NST/WGO fields
- TOI source normalization
- null-window semantics for players with missing source rows

### Initial Audit Implications from 2.4

- The simple accumulator path looks materially healthier than the ratio path.
- For additive families, the main remaining audit work is not the arithmetic engine itself; it is:
  - source precedence
  - null coverage
  - whether the qualifying-row model matches intended “last N team games” semantics

## 2.5 Bounded Percentage and Ratio Metrics Audit

This subsection covers:

- `shooting_pct`
- `expected_sh_pct`
- `primary_points_pct`
- `ipp`
- `oz_start_pct`
- `pp_share_pct`
- `on_ice_sh_pct`
- `pdo`
- `cf_pct`
- `ff_pct`

### Ratio Engine Verdict

The shared ratio engine in [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts) appears materially correct after the recent fixes:

- it now aggregates summed numerators and denominators instead of averaging per-game percentages
- it supports composite ratios like PDO
- it supports historical ratio snapshots
- it supports zero-denominator behavior only when explicitly configured

Current verdict on the shared engine:
- likely `✅` for arithmetic behavior
- likely `🔧` for naming / semantics because `total_*` and `avg_*` are identical snapshots for all ratio families

### Family-by-Family Ratio Review

#### `shooting_pct`

Current formula:
- `(sum(goals) / sum(shots)) * 100`

Current audit read:
- arithmetic is now correct
- `zeroWhenNoDenominator: true` means games / windows with no shots can materialize as `0` rather than `null`

Current status lean:
- `✅` on arithmetic
- `🔧` on whether zero-denominator windows should be `0` or `null`

#### `primary_points_pct`

Current formula:
- `sum(goals + first_assists) / sum(total_points)`

Current audit read:
- arithmetic is now coherent
- scale is `0-1`, not `0-100`
- field name includes `pct`, which could mislead readers into expecting `0-100`
- `zeroWhenNoDenominator: true` also forces zero instead of null

Current status lean:
- `🔧`

Likely reasons:
- formula is close and likely mathematically intended
- naming and scale semantics need explicit clarification

#### `expected_sh_pct`

Current formula:
- `sum(ixg) / sum(shots)`

Current audit read:
- arithmetic is now coherent
- scale is `0-1`, not `0-100`
- field name includes `pct`, which again can mislead readers into expecting `0-100`

Current status lean:
- `🔧`

Likely reasons:
- formula itself appears correct for a proportion
- naming and scale semantics need refinement

#### `ipp`

Current formula:
- `(sum(player points) / sum(on-ice goals for)) * 100`

Current audit read:
- arithmetic is now coherent after the ratio fix
- strongly depends on `countsOi.gf` coverage
- uses `zeroWhenNoDenominator: true`, so some zero-denominator states become `0`

Current status lean:
- `🔧`

Likely reasons:
- math path is right
- meaning can still drift when on-ice source coverage is sparse or missing

#### `oz_start_pct`

Current formula:
- `(sum(off_zone_starts) / sum(off_zone_starts + def_zone_starts)) * 100`

Current audit read:
- arithmetic is coherent
- current implementation intentionally excludes neutral-zone starts, matching NST-style OZS semantics rather than a broader “all starts” interpretation

Current status lean:
- `✅` if the audit accepts NST OZS semantics as canonical
- `⚠️` only if product expectation is a different zone-start definition

#### `pp_share_pct`

Current formula:
- `sum(pp_toi) / sum(inferred_team_pp_toi_from_wgo_share)`

Current audit read:
- this is a major improvement over the old `percentageOfPP` misuse
- however, the denominator is reconstructed from WGO’s share field instead of sourced from a direct team PPTOI truth table
- therefore the arithmetic is coherent, but the source path is still indirect

Current status lean:
- `🔧`

Likely reasons:
- formula is close and probably acceptable
- but a direct team PPTOI denominator would be cleaner and easier to audit

#### `on_ice_sh_pct`

Current formula:
- `(sum(on-ice goals for) / sum(on-ice shots for)) * 100`

Current audit read:
- arithmetic is now correct
- this was one of the key fixed families

Current status lean:
- `✅`

#### `pdo`

Current formula:
- `(((sum(gf) / sum(sf)) * 100) + (((sum(sa) - sum(ga)) / sum(sa)) * 100)) * 0.01`

Current audit read:
- arithmetic is now coherent as an aggregated PDO snapshot
- the output scale is approximately `0-2`, not `0-200`
- diagnostics now explicitly bound this family to the expected range

Current status lean:
- `✅`

#### `cf_pct`

Current formula:
- `(sum(cf) / sum(cf + ca)) * 100`

Current audit read:
- arithmetic is now correct as an aggregated territorial ratio

Current status lean:
- `✅`

#### `ff_pct`

Current formula:
- `(sum(ff) / sum(ff + fa)) * 100`

Current audit read:
- arithmetic is now correct as an aggregated territorial ratio

Current status lean:
- `✅`

### Cross-Family Semantic Issues

These issues affect most or all ratio families:

1. `total_*` vs `avg_*`
- both currently store the same ratio snapshot
- that is not mathematically wrong, but it is semantically awkward and likely misleading

2. Zero-denominator behavior
- some families explicitly materialize `0`
- others materialize `null`
- this is a product-definition question as much as a math question

3. Scale inconsistency behind `pct` naming
- some `pct` families are `0-100`
- some are `0-1`
- this does not make them wrong, but it does make them easy to misread

4. Valid-row window semantics
- ratio families only accumulate when qualifying denominators exist
- therefore `lastN` may mean last N valid ratio observations rather than last N team games

### Early Status Read from 2.5

Likely `✅` candidates:
- `shooting_pct`
- `oz_start_pct` if NST semantics are accepted
- `on_ice_sh_pct`
- `pdo`
- `cf_pct`
- `ff_pct`

Likely `🔧` candidates:
- `primary_points_pct`
- `expected_sh_pct`
- `ipp`
- `pp_share_pct`
- all ratio-family `total_*` / `avg_*` naming semantics

Likely `⚠️` carryover area:
- whether product expectations for `oz_start_pct` match NST-style zone-start semantics
- whether `lastN` semantics should remain “last N valid ratio observations”

### Initial Audit Implications from 2.5

- The major arithmetic bug cluster for percentages appears largely fixed.
- The next layer of risk is semantic consistency:
  - scale
  - naming
  - null vs zero behavior
  - denominator-qualification rules
- This means the final ratio-family section will probably contain fewer `BROKEN` items than originally feared, but more `ALMOST` items than the additive-family section.

## 2.6 `/60` Rate Metrics Audit

This subsection covers:

- `sog_per_60`
- `ixg_per_60`
- `hits_per_60`
- `blocks_per_60`

### Shared `/60` Math Path

All `/60` families currently use:

- [resolvePer60Components.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts)
- ratio accumulation through [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
- scale `3600`

Current shorthand:
- `metric_per_60 = (sum(metric numerator) / sum(toi_seconds)) * 3600`

This is the correct weighted-rate approach and avoids the old bug of averaging per-game `/60` values directly.

### TOI Denominator Resolution

Current TOI fallback order from `getToiSeconds(...)`:

1. `counts.toi`
2. `countsOi.toi`
3. `rates.toi_per_gp`
4. `fallbackToiSeconds`
5. WGO `toi_per_game`, normalized heuristically

Sanitization rules:
- null / undefined rejected
- non-finite rejected
- `<= 0` rejected
- `>= 4000` rejected as likely inflated / broken

Current audit read:
- the fallback chain is pragmatic and defensible
- the most sensitive piece is WGO TOI normalization because the code must infer whether the source is in minutes or seconds

### Numerator Resolution by Family

#### `sog_per_60`

- preferred numerator = `shots`
- `shots` source precedence:
  - `counts.shots`
  - WGO `shots` for `all`
- if raw numerator missing:
  - reconstruct implied total from `rates.shots_per_60 * toi_seconds / 3600`

Current status lean:
- `✅` on weighted-rate arithmetic
- `🔧` on source fallback transparency

#### `ixg_per_60`

- preferred numerator = `counts.ixg`
- fallback numerator = WGO `ixg` key if present
- fallback reconstruction allowed through `rates.ixg_per_60`

Current status lean:
- `🔧`

Reason:
- arithmetic is sound
- but this family has the most layered numerator fallback path, so source precedence and missing-field semantics deserve extra scrutiny

#### `hits_per_60`

- preferred numerator = `hits`
- `hits` source precedence:
  - `counts.hits`
  - WGO `hits` for `all`
- no dedicated per-60 rate reconstruction fallback is used beyond raw numerator + TOI

Current status lean:
- `✅` on arithmetic
- `🔧` only if the audit later finds all-strength WGO fallback creates coverage skew

#### `blocks_per_60`

- preferred numerator = `blocks`
- `blocks` source precedence:
  - `counts.shots_blocked`
  - WGO `blocked_shots` for `all`
- no dedicated per-60 rate reconstruction fallback is used beyond raw numerator + TOI

Current status lean:
- `✅` on arithmetic
- `🔧` only if source precedence later proves inconsistent

### Historical Baseline `/60` Logic

Historical `/60` baseline fields use the same ratio-of-aggregates logic:

- `metric_per_60_avg_season`
- `metric_per_60_avg_3ya`
- `metric_per_60_avg_career`

Current audit read:
- this is the correct general approach
- it preserves weighting by total TOI rather than averaging season-level rates naïvely

### Known Risk Areas

1. TOI Unit Ambiguity
- WGO `toi_per_game` can require heuristic normalization
- a bad unit assumption can distort every `/60` family materially

2. Fallback Transparency
- reconstructed numerators from NST rates are mathematically fine
- but should probably be documented separately from directly observed numerators in the final rationale

3. Qualifying-Row Window Semantics
- `/60` families only accumulate when TOI exists
- that means `lastN` can behave like last N valid TOI rows rather than last N team games

4. `total_*` Naming
- for `/60` families, `total_*` is still not an additive total
- it is a weighted rate snapshot

### Early Status Read from 2.6

Likely `✅` candidates:
- shared weighted-rate arithmetic
- `sog_per_60`
- `hits_per_60`
- `blocks_per_60`
- `/60` historical baselines as weighted snapshots

Likely `🔧` candidates:
- `ixg_per_60`
- all `/60` families on naming semantics (`total_*` vs actual meaning)
- all `/60` families where WGO TOI normalization or fallback reconstruction is used

### Initial Audit Implications from 2.6

- The `/60` families look much healthier after the weighted-rate fix.
- Remaining risk is mostly about:
  - denominator trust
  - fallback transparency
  - suffix naming
  - lastN qualifying-row semantics

## 2.7 PP Usage and Role-Context Metrics Audit

This subsection covers:

- `pp_unit`
- `pp_share_pct`
- `line_combo_slot`
- `line_combo_group`

### `pp_unit` Audit

Current source:
- derived from `powerPlayCombinations.unit`
- populated in the rolling row as:
  - `pp_unit: game.ppCombination?.unit ?? null`

Current audit read:
- `pp_unit` is not a calculated rolling metric
- it is a contextual label copied from a derived upstream table

Implication:
- correctness depends on the upstream PP builder’s unit assignment logic, not on the rolling accumulator path

Current status lean:
- `⚠️`

Reason:
- likely useful and directionally correct
- but it needs validation against actual intended PP-unit semantics and freshness of the source table

### `pp_share_pct` Audit

Current source path:
- does **not** use `powerPlayCombinations.percentageOfPP`
- uses WGO-based components through `getPpShareComponents(...)`
- `resolveShareComponents(...)` reconstructs the denominator from:
  - numerator = `wgo.pp_toi`
  - share = `wgo.pp_toi_pct_per_game`

Current audit read:
- this is a real improvement over the previous misuse of legacy `percentageOfPP`
- the rolling formula is now independent of the misleading upstream unit-relative ratio field
- but the denominator is still inferred from WGO share rather than taken from a direct team PPTOI source in the rolling pipeline

Current status lean:
- `🔧`

Reason:
- the logic is close and likely acceptable
- but it still uses a reconstructed denominator instead of a directly-sourced team PPTOI measure

### `line_combo_slot` Audit

Current source:
- derived in `resolveLineCombo(...)`
- based on:
  - `lineCombinations.forwards`
  - `lineCombinations.defensemen`
  - `lineCombinations.goalies`
- slot is inferred as:
  - forwards in groups of 3
  - defense in groups of 2
  - goalies individually

Current audit read:
- this is a contextual label, not a rolling metric formula
- correctness depends on the freshness and quality of the `lineCombinations` table

Current status lean:
- `⚠️`

Reason:
- likely directionally useful
- but needs validation for staleness, missing rows, and whether the line sorting algorithm matches the intended product meaning

### `line_combo_group` Audit

Current source:
- derived alongside `line_combo_slot`
- possible values:
  - `forward`
  - `defense`
  - `goalie`
  - `null`

Current audit read:
- this is also a context label rather than a rolling metric
- correctness depends entirely on upstream lineup classification and `resolveLineCombo(...)`

Current status lean:
- `⚠️`

Reason:
- should be mostly correct when source rows are fresh
- but it still requires validation as a contextual classification field

### Relationship Between PP Usage Fields

Important current-state distinction:

- `pp_unit`
  - comes from the derived `powerPlayCombinations` builder
- `pp_share_pct`
  - is computed independently inside the rolling pipeline from WGO share inputs
- legacy `percentageOfPP`
  - is no longer the source of truth for rolling PP share
- upstream PP builder still matters for:
  - unit identity
  - unit-relative usage semantics
  - future PP-context expansion

### Early Status Read from 2.7

Likely `🔧` candidates:
- `pp_share_pct`

Likely `⚠️` candidates:
- `pp_unit`
- `line_combo_slot`
- `line_combo_group`

### Initial Audit Implications from 2.7

- PP usage needs to stay split into two audit tracks:
  - rolling PP share math
  - upstream PP role / unit semantics
- Line-combo fields should not be graded by the same standard as numeric rolling metrics because they are contextual labels, not accumulated stat families.

## 2.8 Historical Baseline Fields Audit

This step isolates the historical baseline suffix layer from the rolling-window layer:

- `*_avg_season`
- `*_avg_3ya`
- `*_avg_career`

The narrower question here is:

- are these baseline fields mathematically correct for their metric family?
- are the remaining issues arithmetic problems, naming problems, or schema-fit problems?

### Baseline Engine Split

Historical baseline logic is split across two paths:

1. [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts)
- simple-family historical averages
- GP% historical snapshots

2. [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
- ratio-family historical snapshots
- weighted `/60` historical snapshots

That split matters because not all `*_avg_*` fields mean “average of rows.”

### Simple-Family Historical Baselines

For additive / simple families, the historical baseline model is:

- `m_avg_season = sum(current season values) / count(current season qualifying rows)`
- `m_avg_3ya = sum(last 3 season values) / count(last 3 season qualifying rows)`
- `m_avg_career = sum(career values) / count(career qualifying rows)`

Current audit read:

- this is a standard mean accumulator
- season bucketing is straightforward
- the earlier season-key normalization fix removed the most obvious 3YA risk
- arithmetic looks healthy

Likely `✅` baseline families here:

- `toi_seconds_avg_*`
- additive count baselines such as `goals_avg_*`, `assists_avg_*`, `shots_avg_*`, `hits_avg_*`, `blocks_avg_*`, `pp_points_avg_*`, `points_avg_*`
- chance / opportunity baselines such as `ixg_avg_*`, `iscf_avg_*`, `ihdcf_avg_*`
- territorial count baselines such as `cf_avg_*`, `ca_avg_*`, `ff_avg_*`, `fa_avg_*`

### Ratio-Family Historical Baselines

For bounded ratio families, the historical baseline model is not “average of row-level percentages.”
It is a ratio-of-aggregates snapshot over the historical window:

- `r_avg_season = aggregated numerator / aggregated denominator within current season`
- `r_avg_3ya = aggregated numerator / aggregated denominator across the last 3 season keys`
- `r_avg_career = aggregated numerator / aggregated denominator across career`

Current audit read:

- this is the right general model
- it is materially better than averaging game-level percentages
- it aligns with the corrected rolling ratio logic

Remaining issues are mostly semantic:

- the suffix `avg_*` implies mean-of-rows, but these are really historical snapshot ratios
- some ratio families are on a `0-100` scale while others are on `0-1`
- zero-denominator null behavior still differs by family

Likely `✅` historical ratio baselines:

- `shooting_pct_avg_*`
- `on_ice_sh_pct_avg_*`
- `pdo_avg_*`
- `cf_pct_avg_*`
- `ff_pct_avg_*`

Likely `🔧` historical ratio baselines:

- `primary_points_pct_avg_*`
- `expected_sh_pct_avg_*`
- `ipp_avg_*`
- `pp_share_pct_avg_*`

`oz_start_pct_avg_*` remains conditionally healthy if NST OZS semantics are accepted as the intended definition.

### Historical `/60` Baselines

For `/60` families, the historical baseline model is a weighted rate snapshot:

- `x_per_60_avg_season = 3600 * sum(metric numerator) / sum(TOI seconds) within season`
- `x_per_60_avg_3ya = 3600 * sum(metric numerator) / sum(TOI seconds) across 3YA window`
- `x_per_60_avg_career = 3600 * sum(metric numerator) / sum(TOI seconds) across career`

Current audit read:

- this is the correct general method
- it preserves TOI weighting
- it avoids the mistake of averaging per-game rates

Remaining issues are mostly semantic and source-related:

- suffix naming: these are weighted historical rate snapshots, not ordinary row means
- TOI denominator trust still matters
- `ixg_per_60` remains more fragile because of fallback reconstruction paths

Likely `✅` historical `/60` baselines:

- `sog_per_60_avg_*`
- `hits_per_60_avg_*`
- `blocks_per_60_avg_*`

Likely `🔧` historical `/60` baselines:

- `ixg_per_60_avg_*`

### GP% Historical Baselines

`gp_pct_avg_season`, `gp_pct_avg_3ya`, and `gp_pct_avg_career` do not use the ordinary historical average accumulator.
They use a separate season-team bucket model in [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts):

- bucket key = `season:teamId`
- `playerGames` increments only on games the player appeared in
- `teamGames` tracks the max seen `teamGamesPlayed`
- final snapshot = `playerGames / teamGames`, capped at `1`

Current audit read:

- this is internally coherent for a coarse availability ratio
- but it is not semantically equivalent to the other `avg_*` fields
- it is also where current season / partial-team-season semantics become confusing
- this family should be judged in the dedicated GP% section, not merged into the generic historical-baseline “healthy” bucket

So for this step:

- the arithmetic path is coherent enough to keep moving
- but GP% remains `⚠️` pending the dedicated availability redesign audit in section `4.0`

### Main Conclusion from 2.8

The historical baseline layer is materially healthier than the rolling-window layer.

The main residual problems are:

1. Naming semantics
- `avg_*` means different things across simple, ratio, weighted-rate, and GP% families

2. Source / unit transparency
- especially `/60` denominator trust and ratio-family scale clarity

3. GP% special handling
- GP% is not a generic historical average
- it is an availability model and should be audited as such

### Early Status Read from 2.8

Likely `✅`:

- simple-family `avg_season`
- simple-family `avg_3ya`
- simple-family `avg_career`
- ratio-family historical snapshots where source semantics are already accepted
- weighted `/60` historical snapshots other than `ixg_per_60`

Likely `🔧`:

- `ixg_per_60_avg_*`
- `primary_points_pct_avg_*`
- `expected_sh_pct_avg_*`
- `ipp_avg_*`
- `pp_share_pct_avg_*`
- any baseline family where suffix naming is materially misleading

Likely `⚠️`:

- `gp_pct_avg_season`
- `gp_pct_avg_3ya`
- `gp_pct_avg_career`

## 2.9 Actual `lastN` Window Behavior by Metric Family

This step answers a very specific question:

- when the table says `*_last3`, `*_last5`, `*_last10`, or `*_last20`, what is the window actually sliding over?

Current code review shows the table does not use one universal `lastN` rule.
It currently mixes three different behaviors:

1. last N player appearances with a non-null simple value
2. last N valid ratio observations with a usable denominator
3. GP%-specific windows built from last N appearance dates and then translated into team-game counts

That mixed behavior is the core reason the suffix layer is confusing.

### Simple / Additive Metric Families

Simple families use `updateAccumulator(...)` in [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts).

Behavior:

- a value is added only when `metric.getValue(game)` returns a non-null finite value
- null rows are skipped entirely
- each window stores the last N qualifying values, not the last N team games

So the real semantics are:

- `goals_total_last20` = sum of the last 20 qualifying game-level `goals` values
- `goals_avg_last20` = mean of those same 20 qualifying values

This is often close to “last 20 appearances,” because simple metrics typically only exist when the player played.
But it is still not guaranteed to be last 20 team games.

Current read for simple families:

- closest label = last N appearances with a valid simple value

Affected families include:

- `toi_seconds`
- `ixg`
- `iscf`
- `ihdcf`
- `cf`
- `ca`
- `ff`
- `fa`
- `goals`
- `assists`
- `shots`
- `hits`
- `blocks`
- `pp_points`
- `points`

### Ratio and `/60` Families

Ratio families and weighted `/60` families use `updateRatioRollingAccumulator(...)` in [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts).

Behavior:

- a row is added only when the metric has a usable denominator:
  - primary denominator > 0
  - or secondary denominator > 0 for combined metrics such as `pdo`
- if there is no usable denominator, the row is skipped entirely
- each window stores the last N valid observations for that metric family

So the real semantics are:

- `shooting_pct_total_last20` = ratio snapshot across the last 20 qualifying shooting observations
- `oz_start_pct_total_last20` = ratio snapshot across the last 20 qualifying OZS observations
- `sog_per_60_total_last20` = weighted rate snapshot across the last 20 qualifying TOI-backed observations

This is not the same as:

- last 20 team games
- or even always the last 20 player appearances

It is last N valid metric rows.

Current read for ratio and `/60` families:

- closest label = last N valid observations for that metric

Affected families include:

- `sog_per_60`
- `ixg_per_60`
- `shooting_pct`
- `primary_points_pct`
- `expected_sh_pct`
- `ipp`
- `hits_per_60`
- `blocks_per_60`
- `oz_start_pct`
- `pp_share_pct`
- `on_ice_sh_pct`
- `pdo`
- `cf_pct`
- `ff_pct`

### GP% Rolling Windows

GP% rolling fields are built separately in [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts):

- `appearanceDates` stores dates where `playedThisGame > 0`
- for each `lastN`, the code slices the last N appearance dates
- `playerGamesWindow[size] = windowDates.length`
- `teamGamesWindow[size]` is then computed from the ledger between:
  - `windowStart = first of those N appearance dates`
  - `game.gameDate = current row date`

This means GP% rolling windows currently behave like:

- choose the last N appearances
- count how many team games happened between the first of those appearances and the current game
- compute `playerGames / teamGames` over that date span

That is not equal to:

- last N team games
- and not even equal to last N chronological appearances if there were missed games inside the span

It is a hybrid availability window derived from appearance anchors.

Current read for GP% rolling families:

- closest label = availability ratio over the team-game span defined by the player’s last N appearances

This is the clearest mismatch between column names and actual behavior.

### `all` vs split-strength appearance semantics

There is one additional nuance in `playedThisGame`:

- for `strength_state = all`, `playedThisGame` is always `1`
- for split strengths, `playedThisGame` requires positive TOI from `getToiSeconds(game)`

That means even GP% semantics differ by strength state:

- `all` tracks general appearance presence
- `ev` / `pp` / `pk` track participation only when that strength has TOI

So split-strength GP% fields are not pure “games played” ratios.
They are closer to “share of team games with positive TOI in this strength state.”

### Main Conclusion from 2.9

The current `lastN` suffix layer is semantically mixed:

1. simple families
- last N qualifying appearances

2. ratio and `/60` families
- last N valid metric observations

3. GP% families
- availability span derived from last N appearance anchors

This means the suffix names alone are not enough to infer behavior.
The audit should therefore treat `lastN` semantics as a first-class correctness and schema-labeling issue, not just a documentation issue.

### Early Status Read from 2.9

Likely `🔧`:

- most simple-family `lastN` fields if the intended product meaning is last N appearances
- most ratio-family and `/60` `lastN` fields if the intended product meaning is explicitly “last N valid observations”

Likely `⚠️`:

- any `lastN` field presented to users as “last N games” without clarifying its true behavior
- all `gp_pct_total_last*`
- all `gp_pct_avg_last*`

## 2.10 Canonical `lastN` Recommendation and Naming Mismatch Review

This step is prescriptive rather than descriptive:

- what should `lastN` mean for each family?
- which current columns are mislabeled if we keep their existing behavior?

The cleanest answer is not one universal rule for every family.
Different families need different canonical window semantics to stay mathematically honest and product-legible.

### Recommended Canonical Rules by Family

#### Rule A: Last N Team Games

This should be the canonical rule for availability-style metrics and any product surface explicitly described as “last N games.”

Recommended families:

- `gp_pct_total_last*`
- `gp_pct_avg_last*`

Reason:

- GP% is fundamentally a team-game availability concept
- users naturally interpret GP% windows as “of the last N team games, how many did the player appear in?”
- using appearance-anchored date spans creates confusing outputs like the Corey Perry example

Recommended formula intent:

- denominator = last N chronological team games for the player’s team as of the row date
- numerator = number of those team games in which the player appeared

#### Rule B: Last N Appearances

This should be the canonical rule for simple player-game stat families where the stat is only meaningful when the player actually played.

Recommended families:

- `toi_seconds`
- `ixg`
- `iscf`
- `ihdcf`
- `goals`
- `assists`
- `shots`
- `hits`
- `blocks`
- `pp_points`
- `points`
- likely also on-ice additive count families:
  - `cf`
  - `ca`
  - `ff`
  - `fa`

Reason:

- for these families, “last N appearances” is intuitive and avoids diluting player performance with team games they did not play
- it also lines up with how many of these values are actually sourced

Recommended formula intent:

- window anchor = last N chronological player appearances in this strength state
- aggregate only those appearance rows

#### Rule C: Last N Appearances, Aggregated as Ratio/Weighted Snapshot

This should be the canonical rule for ratio and `/60` families if the product intent is still player-performance recency rather than team-availability recency.

Recommended families:

- `sog_per_60`
- `ixg_per_60`
- `shooting_pct`
- `primary_points_pct`
- `expected_sh_pct`
- `ipp`
- `hits_per_60`
- `blocks_per_60`
- `oz_start_pct`
- `pp_share_pct`
- `on_ice_sh_pct`
- `pdo`
- `cf_pct`
- `ff_pct`

Reason:

- “last N valid observations” is mathematically convenient but product-ambiguous
- the more legible rule is:
  - choose the last N appearances
  - aggregate numerators and denominators across those appearances
  - compute one ratio / weighted-rate snapshot
- this keeps windows aligned with user expectations without reverting to bad percentage-averaging math

Recommended formula intent:

- window anchor = last N chronological appearances in this strength state
- rows with missing components inside the window should contribute zero numerator / zero denominator only if that meaning is truly valid
- otherwise they should remain missing, but the window membership itself should still be determined by appearances, not by valid-row filtering

This recommendation may require a more explicit missing-component policy per family.

### Why One Universal Rule Is Not Ideal

A single rule like “all lastN means last N team games” would create avoidable dilution for player-performance stats.
A single rule like “all lastN means last N valid observations” would keep the current ambiguity and produce opaque windows.

So the recommended split is:

1. availability families
- last N team games

2. player performance families
- last N appearances

3. ratio and `/60` performance families
- last N appearances, then aggregate within that fixed appearance window

### Columns Whose Names No Longer Match Their Behavior

#### Clear naming/behavior mismatches right now

- all `gp_pct_total_last*`
- all `gp_pct_avg_last*`

Reason:

- current behavior is not “last N team games”
- it is appearance-anchored span availability

#### Likely mismatches if product copy says “last N games”

- all simple-family `*_last3`, `*_last5`, `*_last10`, `*_last20`
- all ratio-family `*_last3`, `*_last5`, `*_last10`, `*_last20`
- all `/60`-family `*_last3`, `*_last5`, `*_last10`, `*_last20`

Reason:

- current code does not consistently mean last N chronological team games
- and ratio families do not even consistently mean last N appearances

#### Suffix naming mismatches independent of window selection

- ratio families where `total_last*` and `avg_last*` are the same snapshot value
- `/60` families where `total_last*` is not an additive total

Affected groups include:

- `shooting_pct_total_last*` vs `shooting_pct_avg_last*`
- `ipp_total_last*` vs `ipp_avg_last*`
- `cf_pct_total_last*` vs `cf_pct_avg_last*`
- `sog_per_60_total_last*` vs `sog_per_60_avg_last*`
- `hits_per_60_total_last*` vs `hits_per_60_avg_last*`
- and the rest of the ratio / weighted-rate families

Reason:

- even after fixing window membership, `total_*` remains a misleading suffix for snapshot ratios and weighted rates

### Current Recommendation for the Final Audit

The final audit should recommend:

1. keep the conceptual split
- GP% lastN = team-game windows
- player stat lastN = appearance windows

2. flag the current implementation as semantically mixed
- especially GP%
- and ratio `/60` valid-row filtering

3. treat suffix naming as a schema / product contract issue
- not just an implementation detail

4. consider eventual schema or API alias changes where necessary
- especially for GP%
- and for ratio `/60` `total_*` fields that are not true totals

### Early Status Read from 2.10

Likely `🔧`:

- most non-GP `lastN` fields if the implementation is moved to fixed appearance windows
- most ratio and `/60` suffix names

Likely `❌`:

- current `gp_pct_total_last*`
- current `gp_pct_avg_last*`

Likely `⚠️`:

- any metric family where missing-component policy inside a fixed appearance window is still undefined

## 3.1 Live Validation Player Set

The live validation phase should use a small fixed player set so metric comparisons are consistent across families and not cherry-picked per issue.

### Validation Set Goals

The PRD called for four representative buckets:

1. a regular full-season skater
2. a missed-games / injury case
3. a partial-team-season case if available
4. a heavy PP-role player

### Selected Validation Players

#### 1. Brent Burns (`player_id = 8470613`) — regular full-season skater

Why selected:

- regular, high-usage veteran skater
- current-season source rows run from opening night through the latest refreshed date
- enough sample to validate additive, ratio, `/60`, and on-ice families without the row being dominated by tiny-sample noise

Current live source evidence:

- team: `COL`
- first current-season WGO row: `2025-10-07`
- latest current-season WGO row: `2026-02-04`
- current-season WGO row count: `55`
- Colorado team games through that date: `61`
- latest `pp_toi_pct_per_game`: `0.243`

Why this player is useful:

- good anchor for “normal” player-performance windows
- enough games played to test last-N appearance semantics cleanly
- not so PP-dominant that PP share overwhelms the rest of the audit

#### 2. Corey Perry (`player_id = 8470621`) — missed-games / availability edge case

Why selected:

- already surfaced the GP% confusion directly
- has meaningful missed-team-game exposure
- also carries a strong PP role, which makes him useful for secondary PP-share validation

Current live source evidence:

- team: `LAK`
- first current-season WGO row: `2025-10-21`
- latest current-season WGO row: `2026-02-05`
- current-season WGO row count: `45`
- Los Angeles team games through that date: `63`
- latest `pp_toi_pct_per_game`: `0.695`

Why this player is useful:

- exposes the gap between:
  - team games available
  - player appearances
  - current rolling GP% semantics
- useful for validating whether “last N games” language matches stored values

#### 3. Seth Jones (`player_id = 8477495`) — partial / incomplete season proxy

Why selected:

- current-season source coverage is materially incomplete relative to team games through the last row date
- good proxy for partial-season logic, even if the exact root cause is not yet proven from one source table alone

Current live source evidence:

- team: `FLA`
- first current-season WGO row: `2025-10-07`
- latest current-season WGO row: `2026-01-02`
- current-season WGO row count: `40`
- Florida team games through that date: `47`
- latest `pp_toi_pct_per_game`: `0.107`

Important caveat:

- this is not yet a conclusively proven traded-player example
- the current WGO view appears current-team-only, so it is not a reliable single-table proof of team-change history
- for now, Seth Jones should be treated as the “partial / incomplete season proxy”
- if a cleaner traded-player example is discovered during `3.2` or `3.4`, this slot can be replaced

Why this player is useful:

- good for checking how the pipeline handles interrupted or incomplete season coverage
- low PP share makes him a useful contrast against PP-heavy validation players

#### 4. Jesper Bratt (`player_id = 8479407`) — heavy PP-role player

Why selected:

- latest current-season source shows an extreme PP role
- ideal for validating:
  - `pp_share_pct`
  - PP unit semantics
  - PP-related rolling windows and denominators

Current live source evidence:

- team: `NJD`
- first current-season WGO row: `2025-10-09`
- latest current-season WGO row: `2026-02-05`
- current-season WGO row count: `57`
- New Jersey team games through that date: `64`
- latest `pp_toi_pct_per_game`: `1.000`

Why this player is useful:

- strongest obvious PP-share stress test found from live source rows
- gives the audit a high-confidence PP-heavy example independent of Corey Perry’s broader availability issues

### Validation Set Coverage Summary

This set gives the audit four complementary perspectives:

- Brent Burns
  - regular recency / baseline behavior
- Corey Perry
  - missed-games and GP% behavior
- Seth Jones
  - incomplete-season / partial-coverage proxy
- Jesper Bratt
  - heavy PP-share behavior

### Constraints and Caveats

1. Current rolling table coverage is incomplete
- the full refresh is not complete, so stored-row validation will need targeted recomputes in section `3.4`

2. Upstream source shape limits direct traded-player proof
- current WGO current-season rows do not obviously preserve multi-team history in a way that is easy to prove from a single quick query
- if a better traded-player example is found during manual reconstruction, it should replace Seth Jones in the final audit

3. This player set is for repeatable validation, not exclusivity
- section `3.2` can still pull extra spot-check players if a family needs a more specific edge case

### Main Conclusion from 3.1

The audit should proceed with these four primary validation players:

- Brent Burns (`8470613`)
- Corey Perry (`8470621`)
- Seth Jones (`8477495`)
- Jesper Bratt (`8479407`)

This set is good enough to begin live metric reconstruction while still leaving room to swap in a cleaner traded-player example if one emerges later in the audit.

## 3.2 Manual Source Reconstruction by Major Metric Family

This step reconstructs intended values directly from upstream source rows for the primary validation players.

Important scope note:

- this section is about intended source-derived values
- it is not yet the stored-vs-source mismatch classification step
- stored-row comparison belongs in `3.3`
- stale-row vs current-code separation belongs in `3.4`

### Reconstruction Method Used in 3.2

For this step, the manual reconstruction used:

- WGO current-season rows as the appearance spine
- `nst_gamelog_as_counts` for additive player counts
- `nst_gamelog_as_rates` for `/60` fallback context
- `nst_gamelog_as_counts_oi` for on-ice and territorial numerators / denominators

The reconstruction window used for player-performance metrics in this section is:

- last 20 appearances

That choice matches the canonical recommendation from `2.10` for performance families and avoids inheriting the current mixed last-N implementation semantics.

### Formula Conventions Used Here

- `shooting_pct = goals / shots * 100`
- `sog_per_60 = shots / toi_seconds * 3600`
- `ixg_per_60 = ixg / toi_seconds * 3600`
- `primary_points_pct = (goals + first_assists) / total_points`
- `ipp = total_points / on_ice_gf * 100`
- `on_ice_sh_pct = on_ice_gf / on_ice_sf * 100`
- `pdo = ((on_ice_gf / on_ice_sf) * 100 + ((on_ice_sa - on_ice_ga) / on_ice_sa) * 100) * 0.01`
- `cf_pct = cf / (cf + ca) * 100`
- `ff_pct = ff / (ff + fa) * 100`
- `oz_start_pct = off_zone_starts / (off_zone_starts + def_zone_starts) * 100`
- `expected_sh_pct = ixg / shots`
- `pp_share_pct = sum(player_pp_toi) / sum(inferred_team_pp_toi from WGO share components)`

### Example A: Corey Perry — additive counts, finishing, on-ice context, and GP% edge-case anchor

Source scope:

- player: `Corey Perry` (`8470621`)
- current visible upstream team: `LAK`
- current visible source range: `2025-10-21` through `2026-02-05`
- last-20 appearance reconstruction date anchor: `2026-02-05`

Manual last-20 appearance totals:

- `goals_last20 = 4`
- `shots_last20 = 30`
- `points_last20 = 14`
- `toi_seconds_last20 = 18269`
- `ixg_last20 = 6.08`

Manual last-20 derived values:

- `shooting_pct_last20 = 4 / 30 * 100 = 13.333333`
- `sog_per_60_last20 = 30 / 18269 * 3600 = 5.911654`
- `ixg_per_60_last20 = 6.08 / 18269 * 3600 = 1.198095`
- `primary_points_pct_last20 = (4 + first_assists) / 14 = 0.714286`
- `ipp_last20 = 14 / 22 * 100 = 63.636364`
- `on_ice_sh_pct_last20 = 22 / 149 * 100 = 14.765101`
- `pdo_last20 = (14.765101 + 89.999999...) * 0.01 = 1.047651`
- `cf_pct_last20 = 347 / (347 + 279) * 100 = 55.43131`
- `ff_pct_last20 = 244 / (244 + 200) * 100 = 54.954955`
- `oz_start_pct_last20 = 69 / (69 + 22) * 100 = 75.824176`
- `expected_sh_pct_last20 = 6.08 / 30 = 0.202667`
- `pp_share_pct_last20 = 0.616859`

Manual season-to-date derived spot checks:

- `shooting_pct_season = 13.580247`
- `sog_per_60_season = 7.578947`
- `pp_share_pct_season = 0.554674`

Why this example matters:

- it covers additive counts
- it covers ratio families
- it covers `/60`
- it covers PP share
- it remains the primary GP% / availability stress case

Important source-freshness caveat:

- you reported that Corey Perry was later traded from `LAK` to `TBL`, with his last LAK game on `2026-03-05`
- the current upstream rows visible in this quick validation only show `LAK` through `2026-02-05`
- so the audit now has an explicit freshness / upstream coverage question to carry forward:
  - is the visible source stale?
  - or is the rolling refresh slice incomplete relative to more recent source updates?

That trade edge case should remain attached to Corey Perry for later GP% and cross-team validation.

### Example B: Brent Burns — regular high-sample baseline player

Source scope:

- player: `Brent Burns` (`8470613`)
- team: `COL`
- source range: `2025-10-07` through `2026-02-04`
- last-20 appearance reconstruction date anchor: `2026-02-04`

Manual last-20 appearance totals:

- `goals_last20 = 4`
- `shots_last20 = 47`
- `points_last20 = 7`
- `toi_seconds_last20 = 23281`
- `ixg_last20 = 1.57`

Manual last-20 derived values:

- `shooting_pct_last20 = 8.510638`
- `sog_per_60_last20 = 7.267729`
- `ixg_per_60_last20 = 0.242773`
- `primary_points_pct_last20 = 0.714286`
- `ipp_last20 = 35`
- `on_ice_sh_pct_last20 = 9.852217`
- `pdo_last20 = 1.01109`
- `cf_pct_last20 = 51.833123`
- `ff_pct_last20 = 51.52027`
- `oz_start_pct_last20 = 33.333333`
- `expected_sh_pct_last20 = 0.033404`
- `pp_share_pct_last20 = 0.206086`

Manual season-to-date spot checks:

- `shooting_pct_season = 7.563025`
- `sog_per_60_season = 6.656929`
- `pp_share_pct_season = 0.148833`

Why this example matters:

- cleaner full-season sample
- less availability noise than Corey Perry
- good anchor for validating whether ordinary high-minute skater math is coherent

### Example C: Jesper Bratt — heavy PP-share validation

Source scope:

- player: `Jesper Bratt` (`8479407`)
- team: `NJD`
- source range: `2025-10-09` through `2026-02-05`
- latest visible `pp_toi_pct_per_game = 1.000`

Manual last-20 appearance totals:

- `goals_last20 = 7`
- `shots_last20 = 44`
- `points_last20 = 12`
- `toi_seconds_last20 = 22663`
- `ixg_last20 = 5.45`

Manual last-20 derived PP and performance values:

- `pp_share_pct_last20 = 0.735552`
- `pp_share_pct_season = 0.72828`
- `shooting_pct_last20 = 15.909091`
- `sog_per_60_last20 = 6.989366`
- `ipp_last20 = 75`
- `on_ice_sh_pct_last20 = 6.779661`

Why this example matters:

- best current PP-heavy stress case in the visible source sample
- useful for validating whether PP-share math behaves plausibly on extreme usage players

### Example D: Seth Jones — incomplete / partial-coverage proxy

Source scope:

- player: `Seth Jones` (`8477495`)
- team: `FLA`
- source range: `2025-10-07` through `2026-01-02`
- current-season source row count: `40`
- team games through latest visible source date: `47`

Manual last-20 appearance totals:

- `goals_last20 = 3`
- `shots_last20 = 44`
- `points_last20 = 13`
- `toi_seconds_last20 = 28008`
- `ixg_last20 = 2.27`

Manual last-20 derived values:

- `shooting_pct_last20 = 6.818182`
- `sog_per_60_last20 = 5.655527`
- `ixg_per_60_last20 = 0.291774`
- `primary_points_pct_last20 = 0.461538`
- `ipp_last20 = 44.827586`
- `on_ice_sh_pct_last20 = 11.196911`
- `pdo_last20 = 0.994322`
- `cf_pct_last20 = 55.841372`
- `ff_pct_last20 = 54.649499`
- `oz_start_pct_last20 = 47.530864`
- `expected_sh_pct_last20 = 0.051591`
- `pp_share_pct_last20 = 0.604884`

Why this example matters:

- good pressure test for incomplete season coverage
- useful for spotting whether missing tail coverage changes last-N source reconstruction

### Family-Level Reconstruction Coverage from 3.2

This step now has live source-derived examples for the major families:

- additive player counts
  - goals, shots, points, ixg, toi_seconds
- weighted `/60` rates
  - `sog_per_60`, `ixg_per_60`
- finishing / individual ratios
  - `shooting_pct`, `primary_points_pct`, `expected_sh_pct`, `ipp`
- on-ice context
  - `on_ice_sh_pct`, `pdo`
- territorial context
  - `cf_pct`, `ff_pct`
- zone / usage context
  - `oz_start_pct`
- PP usage
  - `pp_share_pct`

What is intentionally not finalized yet:

- stored-row mismatch explanation
- stale-row vs current-code separation
- GP% redesign conclusions

Those belong to `3.3`, `3.4`, and `4.x`.

### Main Conclusion from 3.2

The audit now has a manual source-derived reconstruction baseline for all major metric families.

The immediate takeaway is:

- the core formulas are now easy to reconstruct directly from source rows
- the next step is not more formula discovery
- the next step is comparing these source-derived values to stored rolling rows and classifying any mismatches by cause

## 3.3 Stored vs Source Comparison and Mismatch Cause Classification

This step compares the source-derived values from `3.2` to the currently stored `rolling_player_game_metrics` rows.

Important scope note:

- this section classifies mismatch causes
- it still does not try to decide whether a mismatch is stale-row-only or current-code-only
- that separation belongs in `3.4`

### Comparison Results: Brent Burns

Stored row used:

- player: `Brent Burns`
- row date: `2026-02-04`
- `strength_state = all`

#### Clear matches

These stored values matched the source-derived reconstruction exactly or to rounding tolerance:

- `goals_total_last20 = 4`
- `shots_total_last20 = 47`
- `points_total_last20 = 7`
- `toi_seconds_total_last20 = 23281`
- `ixg_total_last20 = 1.57`
- `sog_per_60_total_last20 = 7.267729`
- `ixg_per_60_total_last20 = 0.242773`
- `primary_points_pct_total_last20 = 0.714286`
- `on_ice_sh_pct_total_last20 = 9.852217`
- `pdo_total_last20 = 1.01109`
- `cf_pct_total_last20 = 51.833123`
- `ff_pct_total_last20 = 51.52027`
- `oz_start_pct_total_last20 = 33.333333`
- `shooting_pct_avg_season = 7.563025`
- `sog_per_60_avg_season = 6.656929`
- `pp_share_pct_avg_season = 0.148833`

#### Mismatches

- `shooting_pct_total_last20`
  - source-derived: `8.510638`
  - stored: `9.803922`
  - likely cause: current last-20 ratio window semantics, not fixed last-20 appearance semantics

- `ipp_total_last20`
  - source-derived: `35`
  - stored: `43.333333`
  - likely cause: current ratio-family valid-row window behavior

- `expected_sh_pct_total_last20`
  - source-derived: `0.033404`
  - stored: `0.031765`
  - likely cause: current ratio-family last-20 denominator window does not align with fixed appearance window

- `pp_share_pct_total_last20`
  - source-derived: `0.206086`
  - stored: `0.146401`
  - likely cause: PP-share valid-row window / component-availability window mismatch

#### Cause classification for Brent Burns

- additive counts: `MATCH`
- weighted `/60`: `MATCH`
- season baseline snapshots checked here: `MATCH`
- ratio-family `last20` mismatches: most likely `window-definition mismatch`
- no evidence here that the corrected arithmetic itself is broken for the matched families

### Comparison Results: Corey Perry

Stored row used:

- player: `Corey Perry`
- row date: `2026-02-05`
- `strength_state = all`

#### Clear matches

These stored values matched the source-derived reconstruction exactly or to rounding tolerance:

- `goals_total_last20 = 4`
- `shots_total_last20 = 30`
- `points_total_last20 = 14`
- `toi_seconds_total_last20 = 18269`
- `ixg_total_last20 = 6.08`
- `sog_per_60_total_last20 = 5.911654`
- `ixg_per_60_total_last20 = 1.198095`
- `on_ice_sh_pct_total_last20 = 14.765101`
- `pdo_total_last20 = 1.047651`
- `cf_pct_total_last20 = 55.43131`
- `ff_pct_total_last20 = 54.954955`
- `oz_start_pct_total_last20 = 75.824176`
- `shooting_pct_avg_season = 13.580247`
- `sog_per_60_avg_season = 7.578947`
- `pp_share_pct_avg_season = 0.554674`
- `gp_pct_avg_season = 0.714286`

#### Mismatches

- `shooting_pct_total_last20`
  - source-derived: `13.333333`
  - stored: `9.52381`
  - likely cause: current ratio-family last-20 valid-observation semantics

- `primary_points_pct_total_last20`
  - source-derived: `0.714286`
  - stored: `0.730769`
  - likely cause: ratio-family window membership mismatch

- `ipp_total_last20`
  - source-derived: `63.636364`
  - stored: `55.172414`
  - likely cause: valid-row window mismatch for ratio family

- `expected_sh_pct_total_last20`
  - source-derived: `0.202667`
  - stored: `0.17881`
  - likely cause: ratio-family denominator window mismatch

- `pp_share_pct_total_last20`
  - source-derived: `0.616859`
  - stored: `0.606081`
  - likely cause: minor PP-share window/component mismatch

- `gp_pct_total_all`
  - source-derived expectation for visible LAK source slice: `45 / 63 = 0.714286`
  - stored: `22.793651`
  - likely cause: GP% / games-played model bug, not a stale-ratio issue

#### Cause classification for Corey Perry

- additive counts: `MATCH`
- weighted `/60`: `MATCH`
- several ratio-family `last20` fields: `window-definition mismatch`
- `gp_pct_total_all`: `logic / model bug`
- Corey Perry remains the clearest combined example of:
  - ratio-window mismatch
  - GP% modeling problems
  - upstream freshness / team-change concerns

### Comparison Results: Jesper Bratt

Stored row status:

- no current `rolling_player_game_metrics` all-strength row found in the visible refreshed slice

Cause classification:

- not enough stored data yet for direct stored-vs-source comparison
- this is currently a `refresh coverage / stale-table visibility` issue, not a metric verdict

Why the player remains in the validation set:

- the source-derived reconstruction is still valuable for PP-share validation
- once a targeted recompute is run, Jesper Bratt should become the cleanest PP-heavy stored-vs-source comparison

### Comparison Results: Seth Jones

Stored row status:

- no current `rolling_player_game_metrics` all-strength row found in the visible refreshed slice

Cause classification:

- not enough stored data yet for direct stored-vs-source comparison
- this is currently a `refresh coverage / stale-table visibility` issue, not a metric verdict

Why the player remains in the validation set:

- still useful as the incomplete / partial-coverage proxy
- likely to become more informative after targeted recompute

### Cross-Family Comparison Summary from 3.3

Current pattern from the refreshed comparable rows:

1. additive count families
- current stored values match source-derived values well

2. weighted `/60` families
- current stored values match source-derived values well

3. season baseline spot checks
- current stored values match the source-derived snapshots that were checked here

4. ratio-family `last20` values
- several do not match fixed last-20 appearance reconstructions
- mismatch cause is most plausibly current window semantics rather than broken arithmetic

5. GP%
- current `gp_pct_total_all` is not trustworthy
- the Corey Perry row makes that visible immediately

6. refresh coverage
- Jesper Bratt and Seth Jones show that part of the validation problem is simply missing fresh stored rows

### Preliminary Cause Buckets from 3.3

The comparisons so far fit into these cause buckets:

- `current stored value matches intended formula`
  - additive counts
  - weighted `/60`
  - several season baseline fields

- `current stored value diverges because the implementation window is different from the intended fixed appearance window`
  - `shooting_pct_total_last20`
  - `primary_points_pct_total_last20`
  - `ipp_total_last20`
  - `expected_sh_pct_total_last20`
  - `pp_share_pct_total_last20`

- `current stored value diverges because the underlying model is wrong`
  - `gp_pct_total_all`

- `current stored value cannot yet be judged because the row is not fresh / not present`
  - Jesper Bratt all-strength row
  - Seth Jones all-strength row

### Main Conclusion from 3.3

The strongest current read is:

- the corrected arithmetic work appears to be holding for additive counts and weighted `/60`
- the biggest remaining correctness problem in visible stored rows is GP%
- the biggest remaining semantics problem in visible stored rows is ratio-family `lastN` window definition

That means `3.4` should focus on targeted recomputes for:

- Jesper Bratt
- Seth Jones
- and at least one Corey Perry / Brent Burns spot-check after recompute

## 3.4 Targeted Recomputes to Separate Stale Rows from Current-Code Behavior

This step used targeted endpoint-driven recomputes to determine whether the mismatches from `3.3` were:

- stale-table artifacts
- or real current-code behavior

### Targeted Recompute Runs Executed

These endpoint calls completed successfully:

- `/api/v1/db/update-rolling-player-averages?playerId=8470621&season=20252026`
- `/api/v1/db/update-rolling-player-averages?playerId=8470613&season=20252026`
- `/api/v1/db/update-rolling-player-averages?playerId=8479407&season=20252026`
- `/api/v1/db/update-rolling-player-averages?playerId=8477495&season=20252026`

All four returned:

- `200`
- `{\"message\":\"Rolling player averages processed successfully.\"}`

### What the targeted recomputes changed

#### Jesper Bratt

Before targeted recompute:

- no visible all-strength row in the current stored slice

After targeted recompute:

- latest stored all-strength row exists
- latest row date: `2026-03-08`
- team: `NJD`
- `games_played = 62`
- `team_games_played = 71`

Conclusion:

- Jesper Bratt’s earlier absence was a stale / missing-row problem
- this was not evidence of a metric-family logic issue by itself

#### Seth Jones

Before targeted recompute:

- no visible all-strength row in the current stored slice

After targeted recompute:

- latest stored all-strength row exists
- latest row date remains `2026-01-02`
- team: `FLA`
- `games_played = 40`
- `team_games_played = 47`

Conclusion:

- Seth Jones’ earlier absence in the visible stored slice was also a stale / missing-row visibility problem
- the latest visible source date itself still stops at `2026-01-02`, so source-tail freshness remains a separate question

#### Brent Burns

Before targeted recompute:

- latest stored row date was `2026-02-04`
- some ratio-family comparisons were already suspicious

After targeted recompute:

- latest stored row date advanced to `2026-03-08`
- additive and `/60` fields updated coherently with the new source range

Conclusion:

- Brent Burns confirms the stored table was stale before the targeted recompute
- but he also remains a live example where some ratio-family `last20` values continue to diverge after refresh

#### Corey Perry

Before targeted recompute:

- latest stored row date was `2026-02-05`
- team was `LAK`
- `gp_pct_total_all = 22.793651`
- `gp_pct_avg_season = 0.714286`

After targeted recompute:

- latest stored row date advanced to `2026-03-08`
- team changed to `TBL`
- `games_played = 50`
- `team_games_played = 69`
- `gp_pct_total_all = 0.724638`
- `gp_pct_avg_season = 0.028986`

Conclusions:

- the old Corey Perry row was definitely stale
- the absurd `gp_pct_total_all = 22.793651` was a stale-row artifact, not current code behavior
- but the new `gp_pct_avg_season = 0.028986` is now the stronger signal:
  - current GP% season-baseline logic is still wrong for a traded player
  - the bug survives recompute

### Post-Recompute Source vs Stored Spot Checks

After targeted recompute, the audit re-ran a smaller source-derived comparison against the newly refreshed rows.

#### Families that now clearly look healthy after recompute

These continued to line up well with current source-derived values:

- additive count families
- weighted `/60` families
- season baseline spot checks such as:
  - `shooting_pct_avg_season`
  - `sog_per_60_avg_season`
  - `pp_share_pct_avg_season`

Examples:

- Corey Perry
  - `shooting_pct_avg_season = 13.978495` matched source-derived value
  - `sog_per_60_avg_season = 7.84277` matched source-derived value
  - `pp_share_pct_avg_season = 0.546838` matched source-derived value

- Jesper Bratt
  - `shooting_pct_avg_season = 10.071942` matched source-derived value
  - `sog_per_60_avg_season = 7.143367` matched source-derived value
  - `pp_share_pct_avg_season = 0.723749` matched source-derived value

- Seth Jones
  - `shooting_pct_avg_season = 7.692308` matched source-derived value
  - `sog_per_60_avg_season = 4.980843` matched source-derived value
  - `pp_share_pct_avg_season = 0.625051` matched source-derived value

#### Mismatches that survived recompute

These are the most important post-refresh findings, because they now point to current implementation semantics rather than stale rows.

##### Brent Burns

Source-derived last-20 appearance values:

- `shooting_pct_last20 = 9.52381`
- `primary_points_pct_last20 = 0.857143`
- `ipp_last20 = 36.842105`
- `expected_sh_pct_last20 = 0.032857`
- `pp_share_pct_last20 = 0.199811`

Stored post-refresh values:

- `shooting_pct_total_last20 = 7.692308`
- `primary_points_pct_total_last20 = 0.714286`
- `ipp_total_last20 = 37.931034`
- `expected_sh_pct_total_last20 = 0.0325`
- `pp_share_pct_total_last20 = 0.166284`

Cause read:

- these surviving mismatches are consistent with current ratio-family window semantics, not stale data

##### Corey Perry

Source-derived last-20 appearance values:

- `shooting_pct_last20 = 16.666667`
- `primary_points_pct_last20 = 0.8`
- `ipp_last20 = 57.692308`
- `expected_sh_pct_last20 = 0.174722`
- `pp_share_pct_last20 = 0.629725`

Stored post-refresh values:

- `shooting_pct_total_last20 = 14.285714`
- `primary_points_pct_total_last20 = 0.72`
- `ipp_total_last20 = 53.333333`
- `expected_sh_pct_total_last20 = 0.164286`
- `pp_share_pct_total_last20 = 0.623119`

Cause read:

- these mismatches also survive recompute
- that means Corey Perry’s ratio-family last-20 divergences are current semantics issues, not stale-row artifacts

##### Jesper Bratt

Source-derived last-20 appearance values:

- `shooting_pct_last20 = 12.820513`
- `primary_points_pct_last20 = 0.785714`
- `ipp_last20 = 77.777778`
- `expected_sh_pct_last20 = 0.140256`
- `pp_share_pct_last20 = 0.695275`

Stored post-refresh values:

- `shooting_pct_total_last20 = 11.320755`
- `primary_points_pct_total_last20 = 0.7`
- `ipp_total_last20 = 66.666667`
- `expected_sh_pct_total_last20 = 0.129811`
- `pp_share_pct_total_last20 = 0.695275`

Cause read:

- PP share matched exactly here after recompute
- the remaining ratio-family divergences again point to current appearance-window vs valid-observation-window semantics

##### Seth Jones

Source-derived last-20 appearance values:

- `shooting_pct_last20 = 6.818182`
- `primary_points_pct_last20 = 0.461538`
- `ipp_last20 = 44.827586`
- `expected_sh_pct_last20 = 0.051591`
- `pp_share_pct_last20 = 0.604884`

Stored post-refresh values:

- `shooting_pct_total_last20 = 9.615385`
- `primary_points_pct_total_last20 = 0.5`
- `ipp_total_last20 = 43.589744`
- `expected_sh_pct_total_last20 = 0.054615`
- `pp_share_pct_total_last20 = 0.604884`

Cause read:

- PP share matched exactly here after recompute
- the remaining ratio-family divergences survive refresh and therefore point to current semantics

### What 3.4 definitively separated

#### Stale-row / missing-row issues

Now clearly stale-row related:

- Corey Perry’s old `LAK` row and absurd `gp_pct_total_all = 22.793651`
- Jesper Bratt missing all-strength row
- Seth Jones missing all-strength row in the previously visible stored slice
- Brent Burns older stored row date ending at `2026-02-04`

#### Current-code / current-semantics issues

Now clearly current behavior after recompute:

- ratio-family `last20` values do not represent fixed last-20 appearance windows
- `gp_pct_avg_season` breaks badly for Corey Perry after the team change to `TBL`

#### Families that now look materially trustworthy

Post-recompute evidence supports these as materially healthy:

- additive counts
- weighted `/60` rates
- several season baseline snapshots
- `pp_share_pct` season baselines
- `pp_share_pct_last20` for Jesper Bratt and Seth Jones specifically

### Main Conclusion from 3.4

Targeted recomputes resolved the stale-data ambiguity.

The strongest conclusions are now:

1. stale-row issues were real
- several missing or obviously wrong rows were simply old / incomplete refresh artifacts

2. ratio-family `lastN` semantics are still a current implementation issue
- the mismatches survived targeted recompute across multiple players

3. GP% still has a true current-code problem
- Corey Perry’s post-trade `gp_pct_avg_season = 0.028986` is the clearest proof so far

That means the audit can now move into `3.5` and `3.6` with much higher confidence about which findings are stale-row problems and which are actual logic defects.

## 3.5 Draft `Live Validation Examples` Section

This section packages the strongest evidence from `3.2` through `3.4` into a cleaner final-audit shape.
The goal is to give the final document a short list of reusable examples rather than forcing readers to reconstruct the narrative from the working notes.

### Example 1: Corey Perry post-trade GP% failure

Player:

- `Corey Perry` (`8470621`)

Stored post-recompute row:

- row date: `2026-03-08`
- team: `TBL`
- `games_played = 50`
- `team_games_played = 69`
- `gp_pct_total_all = 0.724638`
- `gp_pct_avg_season = 0.028986`

Why this example matters:

- it proves stale rows were masking the current GP% problem
- after recompute, the total availability ratio became sane
- but the season baseline GP% became obviously wrong for a traded player

Validation takeaway:

- `gp_pct_total_all` can now be interpreted after refresh
- `gp_pct_avg_season` is still a live model bug for team-change scenarios

### Example 2: Corey Perry ratio-family `last20` mismatch that survives recompute

Source-derived last-20 appearance values:

- `shooting_pct_last20 = 16.666667`
- `primary_points_pct_last20 = 0.8`
- `ipp_last20 = 57.692308`
- `expected_sh_pct_last20 = 0.174722`
- `pp_share_pct_last20 = 0.629725`

Stored post-recompute values:

- `shooting_pct_total_last20 = 14.285714`
- `primary_points_pct_total_last20 = 0.72`
- `ipp_total_last20 = 53.333333`
- `expected_sh_pct_total_last20 = 0.164286`
- `pp_share_pct_total_last20 = 0.623119`

Why this example matters:

- it isolates a current semantics issue
- the row is fresh, but the `last20` ratio values still do not match a fixed appearance-window reconstruction

Validation takeaway:

- ratio-family `lastN` mismatch is not just a stale-row problem

### Example 3: Brent Burns as the “healthy control” for counts and `/60`

Player:

- `Brent Burns` (`8470613`)

Post-recompute source and stored agreement:

- additive counts aligned
- weighted `/60` values aligned
- season baseline spot checks aligned

Why this example matters:

- it shows the pipeline is not globally broken
- the corrected additive and weighted-rate arithmetic now behaves credibly on a normal high-sample player

Validation takeaway:

- count-family and `/60` fixes appear materially sound

### Example 4: Jesper Bratt heavy-PP validation after targeted recompute

Player:

- `Jesper Bratt` (`8479407`)

Before recompute:

- no visible all-strength row in the stored slice

After recompute:

- fresh row exists at `2026-03-08`
- `pp_share_pct_total_last20 = 0.695275`
- source-derived `pp_share_pct_last20 = 0.695275`

Why this example matters:

- it proves that at least one PP-heavy case now matches perfectly on `pp_share_pct_last20`
- it also proves the earlier missing-row issue was stale coverage, not absent source data

Validation takeaway:

- PP share appears healthier than some of the other ratio families
- especially after the earlier source correction away from legacy `percentageOfPP`

### Example 5: Seth Jones incomplete-source-tail example

Player:

- `Seth Jones` (`8477495`)

Stored post-recompute row:

- row date: `2026-01-02`
- `games_played = 40`
- `team_games_played = 47`

Why this example matters:

- it separates two concerns:
  - the row itself can now be refreshed successfully
  - but the visible source tail still ends early

Validation takeaway:

- some validation limitations are source-tail freshness issues, not rolling arithmetic issues

### Example 6: Brent Burns / Jesper Bratt / Seth Jones as evidence that ratio-family `last20` semantics are current behavior

Common post-recompute pattern:

- source-derived fixed-appearance-window ratio values still diverge from stored `*_total_last20` values
- this holds across multiple players
- the pattern affects:
  - `shooting_pct`
  - `primary_points_pct`
  - `ipp`
  - `expected_sh_pct`
  - sometimes `pp_share_pct`

Why this example matters:

- it shows the issue is systematic, not player-specific
- it strongly supports the `2.9` / `2.10` audit conclusion that ratio-family windows are still based on current valid-observation semantics

Validation takeaway:

- this belongs in the final audit as a cross-player example, not just a single-row anomaly

### Draft `Live Validation Examples` Takeaway

The final audit’s `Live Validation Examples` section should include at least these six examples because together they show:

- stale-row failure
- stale-row recovery
- current GP% bug
- healthy additive and `/60` arithmetic
- healthy PP-share case
- persistent ratio-window semantics mismatch

## 3.6 Evidence-Based Status Assignment for Validated Families

This step assigns provisional status buckets only for the families and columns that now have live source validation evidence.

Important scope note:

- these are not the final polished `WORKING / BROKEN / ALMOST / NEEDS REVIEW` output sections yet
- those final clean lists belong in section `5.0`
- this section is the evidence-to-status bridge so later writing is traceable

### `WORKING` candidates from live validation

These families or columns now have direct post-recompute evidence supporting `WORKING` status:

#### Additive count families

Status:

- `WORKING`

Evidence basis:

- Brent Burns, Corey Perry, Seth Jones, and Jesper Bratt all showed clean agreement on the additive count spot checks that were reconstructed
- examples included:
  - `goals_total_last20`
  - `shots_total_last20`
  - `points_total_last20`
  - `ixg_total_last20`
  - `toi_seconds_total_last20`

Current read:

- additive count accumulation is behaving correctly on refreshed rows

#### Weighted `/60` families

Status:

- `WORKING`

Evidence basis:

- refreshed rows matched source-derived values for:
  - `sog_per_60_total_last20`
  - `ixg_per_60_total_last20` in the validated examples where reconstructed
  - season `/60` baselines that were checked

Current read:

- the earlier weighted-rate fixes appear to be holding

#### Season baseline spot checks for validated families

Status:

- `WORKING`

Evidence basis:

- post-recompute source-derived values aligned on:
  - `shooting_pct_avg_season`
  - `sog_per_60_avg_season`
  - `pp_share_pct_avg_season`

Validated players:

- Corey Perry
- Jesper Bratt
- Seth Jones
- Brent Burns

Current read:

- historical season baseline snapshots are materially healthier than the rolling ratio windows

#### `pp_share_pct_total_last20` in selected cases

Status:

- `WORKING` in validated cases

Evidence basis:

- exact match after recompute for:
  - Jesper Bratt
  - Seth Jones

Current read:

- `pp_share_pct` is behaving materially better than the other ratio families in some validated cases
- this supports keeping it out of `BROKEN`

### `BROKEN` candidates from live validation

These families or columns now have direct post-recompute evidence supporting `BROKEN` status.

#### `gp_pct_avg_season`

Status:

- `BROKEN`

Evidence basis:

- Corey Perry post-trade row after recompute:
  - `games_played = 50`
  - `team_games_played = 69`
  - `gp_pct_total_all = 0.724638`
  - `gp_pct_avg_season = 0.028986`

Why that matters:

- the row is fresh
- the team change to `TBL` has been incorporated
- the season baseline GP% is still nonsensical

Current read:

- this is a live model defect, not a stale-row issue

### `ALMOST` candidates from live validation

These families are close enough that the core arithmetic looks healthy, but current semantics or naming still make them unfit for full `WORKING` status.

#### Ratio-family `last20` windows

Status:

- `ALMOST`

Affected validated families:

- `shooting_pct_total_last20`
- `primary_points_pct_total_last20`
- `ipp_total_last20`
- `expected_sh_pct_total_last20`
- in some cases `pp_share_pct_total_last20`

Evidence basis:

- mismatches survived targeted recompute across:
  - Brent Burns
  - Corey Perry
  - Jesper Bratt
  - Seth Jones

Current read:

- the underlying ratio arithmetic is not the main problem anymore
- the problem is that current `last20` semantics do not match the intended fixed last-20 appearance window

Why `ALMOST` instead of `BROKEN`:

- the values are internally coherent under the current implementation
- the issue is semantic mismatch and window definition, not obviously corrupted arithmetic

#### `pp_share_pct` as a family

Status:

- `ALMOST`

Evidence basis:

- season baselines matched well across validated players
- `last20` matched exactly for Jesper Bratt and Seth Jones
- but Corey Perry and Brent Burns still showed smaller `last20` divergences

Current read:

- this family is healthier than the other ratio families
- but it still inherits rolling-window semantics questions, so it is not cleanly `WORKING` as a whole

### `NEEDS REVIEW` candidates from live validation

These still need either broader evidence or a more specific audit slice before a hard status call.

#### `gp_pct_total_all`

Status:

- `NEEDS REVIEW`

Evidence basis:

- Corey Perry’s stale row was absurd
- Corey Perry’s refreshed row is now sane
- but GP% as a family still has broader team-change and season-bucket problems

Current read:

- `gp_pct_total_all` may be closer to `WORKING` than `gp_pct_avg_season`
- but it should stay out of `WORKING` until the dedicated section `4.0` fully validates the intended cross-team semantics

#### `gp_pct_total_last*` and `gp_pct_avg_last*`

Status:

- `NEEDS REVIEW`

Evidence basis:

- code audit already showed these windows use appearance-anchored spans rather than literal last N team games
- live validation so far has focused more on season and all-time GP% than on each rolling GP% window

Current read:

- likely to end up `BROKEN` or require schema redesign
- but the final call should wait for the dedicated GP% section

#### Context-label fields

Status:

- `NEEDS REVIEW`

Affected fields:

- `pp_unit`
- `line_combo_slot`
- `line_combo_group`

Reason:

- current live validation focused on numeric metrics
- these fields still need freshness and semantic validation against their upstream builders

### Main Status Takeaway from 3.6

The strongest validated status assignments so far are:

- `WORKING`
  - additive counts
  - weighted `/60`
  - validated season baselines

- `BROKEN`
  - `gp_pct_avg_season`

- `ALMOST`
  - ratio-family `last20` windows
  - `pp_share_pct` as a whole family

- `NEEDS REVIEW`
  - the rest of GP%
  - context-label fields

This gives the final audit a grounded starting point for the clean status lists in section `5.0`.

## 4.1 Reverse-Engineered Current GP% and Availability Logic

This step isolates the exact implementation path for:

- `games_played`
- `team_games_played`
- `gp_pct_total_all`
- `gp_pct_avg_all`
- `gp_pct_total_last3/5/10/20`
- `gp_pct_avg_last3/5/10/20`
- `gp_pct_avg_season`
- `gp_pct_avg_3ya`
- `gp_pct_avg_career`

### Current GP% write path

The GP% family is built across two files:

1. [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
- computes current-row rolling and all-time GP% outputs

2. [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts)
- computes historical GP% snapshots for season / 3YA / career

This is already a warning sign because GP% is not using the same baseline path as other metric families.

### How `games_played` is currently computed

In [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts), each processed game row sets:

- `playedThisGame = 1` for `strength_state = all`
- `playedThisGame = 1` for split strengths only if `getToiSeconds(game) > 0`

Then:

- if `playedThisGame > 0`, increment `gamesPlayed`
- also push `game.gameDate` into `appearanceDates`

So the current meaning is:

- `games_played`
  - for `all`: count of processed appearance rows in this source slice
  - for `ev` / `pp` / `pk`: count of rows with positive TOI in that strength

This means split-strength `games_played` is not literal game participation.
It is participation-with-positive-TOI in the specific strength state.

### How `team_games_played` is currently computed

For each processed game row:

- `teamGamesPlayed = getTeamGamesPlayed(ledger, teamId, season, gameDate)`

`getTeamGamesPlayed(...)` uses the prebuilt team ledger from `games` and returns:

- cumulative number of team games for that team and season through the row date

So the current meaning is:

- `team_games_played = chronological team games through this row’s date for the row team_id`

This is a clean team-ledger concept by itself.

### How `gp_pct_total_all` and `gp_pct_avg_all` are currently computed

In `deriveOutputs(...)`:

- `gp_pct_total_all = gamesPlayed / teamGamesPlayed`
- `gp_pct_avg_all = gp_pct_total_all`

So the current meaning is:

- `gp_pct_total_all`
  - running appearance count divided by current row’s team games through date

This is only straightforward when:

- the player is on one team
- the processed source rows are complete

It becomes ambiguous or wrong when:

- the player changes teams midseason
- source coverage is partial
- split strengths are used

### How rolling `gp_pct_total_last*` and `gp_pct_avg_last*` are currently computed

The rolling path uses `appearanceDates`, not team-game windows directly.

For each `size in [3, 5, 10, 20]`:

1. take the last N dates from `appearanceDates`
2. let `windowStart = first of those dates`
3. compute:
   - `playerGamesWindow[size] = windowDates.length`
   - `teamGamesWindow[size] = getTeamGamesWindowCount(ledger, teamId, season, windowStart, gameDate)`
4. set:
   - `gp_pct_total_lastN = playerGamesWindow / teamGamesWindow`
   - `gp_pct_avg_lastN = gp_pct_total_lastN`

So the current meaning is:

- pick the player’s last N appearances
- count how many team games occurred between the first of those appearances and the current row date
- divide N by that team-game span

This is not:

- last N team games
- nor purely last N appearances

It is an appearance-anchored span ratio.

### How `gp_pct_avg_season`, `gp_pct_avg_3ya`, and `gp_pct_avg_career` are currently computed

The historical GP% accumulator is separate from all other families.

In [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts):

- key = `season:teamId`
- per processed row:
  - if `playedThisGame`, increment `playerGames`
  - set `teamGames = max(teamGames, teamGamesPlayed)`

Then `getHistoricalGpPctSnapshot(...)` returns:

- `season = seasonPlayerGames / seasonTeamGames` only for buckets matching both:
  - `bucketSeason === currentSeason`
  - `bucketTeamId === currentTeamId`

- `threeYear = sum(playerGames across season-team buckets in window) / sum(teamGames across season-team buckets in window)`
- `career = sum(playerGames across all season-team buckets) / sum(teamGames across all season-team buckets)`

This is the most important current semantic detail:

- `gp_pct_avg_season` is not “current season availability across the player’s season”
- it is “availability within the current row’s current team bucket for this season”

That is exactly why Corey Perry’s post-trade row can produce:

- sane `gp_pct_total_all`
- broken `gp_pct_avg_season`

because his current row is on `TBL`, and the season snapshot only looks at the `20252026:TBL` bucket.

### Why Corey Perry breaks the current model

For Corey Perry after the trade:

- `games_played = 50`
- `team_games_played = 69`
- `gp_pct_total_all = 50 / 69 = 0.724638`

But `gp_pct_avg_season` is computed only from the current `season:teamId` bucket:

- effectively `TBL games played / TBL team games since joining`

That is why the refreshed row showed:

- `gp_pct_avg_season = 0.028986`

This value is internally consistent with the current code path.
It is not an arithmetic glitch.
It is the wrong season-bucket model for a traded-player interpretation.

### Reverse-engineered current meanings by field

- `games_played`
  - running count of appearances in processed rows
  - split strengths require positive TOI in that strength

- `team_games_played`
  - chronological team games through row date for current row team

- `gp_pct_total_all`
  - `games_played / team_games_played`

- `gp_pct_avg_all`
  - identical to `gp_pct_total_all`

- `gp_pct_total_lastN`
  - player last-N-appearance count divided by team-game count across the span from first of those appearances to row date

- `gp_pct_avg_lastN`
  - identical to `gp_pct_total_lastN`

- `gp_pct_avg_season`
  - historical season ratio inside the current `season:teamId` bucket only

- `gp_pct_avg_3ya`
  - ratio of summed playerGames to summed teamGames across all season-team buckets in 3YA window

- `gp_pct_avg_career`
  - ratio of summed playerGames to summed teamGames across all season-team buckets in career

### Main implementation problems exposed by 4.1

1. `avg` naming is misleading
- GP% fields are not ordinary averages
- `avg_all` and `avg_lastN` are just aliases of ratio snapshots

2. Season semantics are team-bucketed, not season-bucketed
- `gp_pct_avg_season` breaks for traded players by design

3. Rolling semantics are appearance-anchored spans
- `gp_pct_total_lastN` is not last N team games

4. Split-strength GP% changes the meaning of “games played”
- split strengths really mean “games with positive TOI in that state”

### Main Conclusion from 4.1

The current GP% implementation is not one coherent availability model.
It is a mix of:

- running appearance ratios
- appearance-anchored rolling span ratios
- season-team historical buckets

That mixed model explains why:

- some GP% fields can look sane
- others can be obviously wrong on the same player row

The next step is to compare this current behavior directly against the intended team-game availability semantics, especially for injuries and team changes.

## 4.2 Current GP% Behavior vs Intended Team-Game Availability Semantics

This step compares the reverse-engineered current GP% model against the product meaning that is actually desirable.

### Intended GP% semantics

The intended availability interpretation is:

- GP% should answer “of the relevant team games available in this window, how many did the player appear in?”

That implies:

#### For `gp_pct_total_all`

- denominator:
  - total team games available to the player across the full relevant season/career scope
- numerator:
  - player appearances across those same team games

#### For `gp_pct_total_lastN`

- denominator:
  - last N chronological team games available in the relevant team window
- numerator:
  - number of those games in which the player appeared

#### For `gp_pct_avg_season`

- intended reading:
  - season-to-date availability ratio across the player’s season context
- not:
  - current-team-only bucket since latest trade

#### For injuries / healthy scratches

- missed team games should remain in the denominator
- the player simply does not get a numerator increment for those games

#### For traded players

- team context must either:
  - remain segmented explicitly by team stint
  - or be aggregated over the player’s full season path in a clearly defined way

The current implementation does neither cleanly.

### Current behavior vs intended meaning

#### `gp_pct_total_all`

Current behavior:

- running appearance count divided by current row’s `team_games_played`

Where it aligns:

- for a one-team player with full source coverage, this is close to the intended season-to-date availability ratio

Where it breaks:

- traded players
- partial source coverage
- split-strength states, where “games played” really means “games with positive TOI in that state”

Current verdict at this step:

- partially aligned for simple one-team cases
- semantically unstable across trades and split strengths

#### `gp_pct_total_lastN`

Current behavior:

- appearance-anchored span ratio

Intended behavior:

- literal last N chronological team games

Gap:

- the current denominator expands or contracts based on when the player’s appearances happened
- that means two players can both have “last20” GP% values even though the underlying team-game windows are different

Current verdict at this step:

- misaligned with intended last-N team-game semantics

#### `gp_pct_avg_season`

Current behavior:

- current `season:teamId` historical bucket only

Intended behavior:

- season availability ratio for the player’s season context

Gap:

- post-trade rows collapse the season baseline to the current team stint only
- that destroys the expected meaning of “season” for players who changed teams

Current verdict at this step:

- fundamentally misaligned for traded players

### Corey Perry as the canonical trade / missed-games example

Current source evidence now shows:

- first visible current-season row:
  - `2025-10-21`, `LAK`
- last visible current-season row:
  - `2026-03-08`, `TBL`
- visible current-season teams:
  - `LAK`
  - `TBL`
- total visible current-season appearances:
  - `50`

Relevant refreshed stored rows:

#### LAK row before the move

- row date: `2026-03-05`
- `team_id = 26`
- `games_played = 48`
- `team_games_played = 68`
- `gp_pct_total_all = 0.705882`
- `gp_pct_avg_season = 0.705882`

Interpretation:

- while the player was still on `LAK`, current all-time and season GP% were aligned because both were still inside the same team bucket

#### TBL rows after the move

- row date: `2026-03-07`
- `team_id = 14`
- `games_played = 49`
- `team_games_played = 68`
- `gp_pct_total_all = 0.720588`
- `gp_pct_avg_season = 0.014706`

- row date: `2026-03-08`
- `team_id = 14`
- `games_played = 50`
- `team_games_played = 69`
- `gp_pct_total_all = 0.724638`
- `gp_pct_avg_season = 0.028986`

Interpretation:

- `gp_pct_total_all` remained interpretable because it kept using total appearances over current row team games through date
- `gp_pct_avg_season` collapsed because the season snapshot now only looked at the `TBL` bucket

This is the clearest direct proof that:

- the current GP% model cannot represent traded-player season semantics correctly

### Injury / missed-game semantics vs current implementation

For an injured or scratch-heavy player, the intended model is:

- denominator keeps advancing with team games
- numerator only advances on appearances

The current implementation partially captures that in `gp_pct_total_all`, but rolling `lastN` windows do not.

Why:

- rolling windows start from last N appearance dates
- if a player missed multiple games inside the chronological last-20 team-game window, the current code can still report a ratio over a wider or different team-game span

So for injury / missed-game cases:

- `gp_pct_total_all` can still be directionally useful
- `gp_pct_total_lastN` is not trustworthy if the intended reading is “last N team games”

### Split-strength semantics vs intended GP%

For `ev`, `pp`, and `pk`, the current implementation sets:

- `playedThisGame = 1` only if the player had positive TOI in that strength

That means split-strength GP% currently means:

- share of team games in which the player recorded TOI in that strength

This may be acceptable if explicitly named that way.
It is not equivalent to:

- general game participation

So the audit should treat split-strength GP% as a separate semantic product decision, not just a technical variant of all-strength GP%.

### Current GP% behavior mapped to intended use cases

#### One-team, healthy regular

Current fit:

- `gp_pct_total_all`: often acceptable
- `gp_pct_avg_season`: often appears acceptable
- rolling `gp_pct_lastN`: still semantically wrong if shown as last N team games

#### One-team, missed-games / injury case

Current fit:

- `gp_pct_total_all`: directionally acceptable
- rolling `gp_pct_lastN`: misaligned because it is appearance-anchored

#### Traded player

Current fit:

- `gp_pct_total_all`: only partially acceptable and still ambiguous across team contexts
- `gp_pct_avg_season`: broken
- rolling `gp_pct_lastN`: broken for intended team-game semantics

#### Split-strength participation

Current fit:

- only acceptable if explicitly interpreted as “games with positive TOI in this strength state”
- not acceptable if product copy implies standard GP%

### Main conclusion from 4.2

Compared to the intended team-game availability model:

- `gp_pct_total_all` is the closest field to being useful, but still needs clearer team-change semantics
- `gp_pct_total_last*` and `gp_pct_avg_last*` are misaligned with intended last N team-game behavior
- `gp_pct_avg_season` is clearly broken for traded players
- split-strength GP% should probably be treated as a separate concept from ordinary games-played percentage

This means the next step is not a small formula tweak.
It is to define the intended GP% model explicitly for:

- all-strength season
- all-strength rolling windows
- career / 3YA
- team-change cases
- split-strength participation cases

## 4.3 Intended GP% Model for Career, Season, and Rolling Windows

This step defines the target availability model the audit should use going forward.

The core design principle is:

- GP% should model availability against team games
- but the relevant team-game scope depends on whether the window is:
  - career / 3YA
  - season-to-date
  - rolling last N
  - all-strength or split-strength

### Intended all-strength GP% model

#### Intended `games_played`

Definition:

- count of team games in which the player appeared

All-strength rule:

- a game counts if the player has a valid appearance row for that game

This should not depend on:

- whether a stat family is missing for that game
- whether a particular ratio denominator exists

#### Intended `team_games_played`

Definition:

- count of team games available in the relevant scope

All-strength rule:

- use the team schedule ledger, not appearance rows

### Intended all-strength season model

#### Intended `gp_pct_total_all`

Target meaning:

- season-to-date player availability across the player’s full current season path

Recommended formula:

- numerator:
  - total appearances in current season across all team stints included in the source scope
- denominator:
  - total team games available across those same team stints

Trade handling:

- if a player changed teams, season total availability should span all current-season stints
- it should not reset or collapse to the current team only

This means Corey Perry’s post-trade season availability should still reflect:

- LAK stint team games before the move
- plus TBL team games since the move

#### Intended `gp_pct_avg_season`

Target meaning:

- same season-to-date availability concept as `gp_pct_total_all`, unless the schema explicitly chooses to separate:
  - “season snapshot”
  - from “running total ratio”

Current audit recommendation:

- there is no useful semantic distinction between `gp_pct_total_all` and `gp_pct_avg_season` under the intended model
- both are season availability ratios, not ordinary averages

So the intended model is:

- either make them identical intentionally and name them more clearly
- or remove one of them in a redesign

### Intended all-strength rolling model

#### Intended `gp_pct_total_lastN`

Target meaning:

- of the last N chronological team games available in the relevant team window, what fraction did the player appear in?

Recommended formula:

- denominator:
  - exactly N team games, unless fewer than N team games exist in scope
- numerator:
  - number of those games in which the player appeared

#### Trade handling for rolling last N

The cleanest intended behavior is:

- rolling windows should follow the current team context of the row

That means for a post-trade `TBL` row:

- `gp_pct_total_last10`
  - should refer to the last 10 `TBL` team games up to that row date
- not:
  - the last 10 appearances spread across `LAK` and `TBL`

Reason:

- rolling recency is a current-team usage / availability signal
- mixing teams in rolling windows makes current-team interpretation much harder

So the intended split is:

- season / career availability
  - aggregate across stints in the relevant scope
- rolling availability
  - current-team window only

#### Intended `gp_pct_avg_lastN`

Current audit recommendation:

- same issue as `gp_pct_avg_season`
- there is no meaningful “average” interpretation here distinct from the rolling ratio snapshot itself

So the intended model is:

- either keep it as an alias intentionally
- or remove / rename it in redesign

### Intended career and 3YA GP% model

#### Intended `gp_pct_avg_3ya`

Target meaning:

- player appearances across the last three season windows divided by total team games available across those same three seasons

Trade handling:

- aggregate across all stints within the included seasons

#### Intended `gp_pct_avg_career`

Target meaning:

- total player appearances across career divided by total team games available across all career stints in scope

Trade handling:

- aggregate across all teams and seasons in scope

This means career and 3YA GP% should be:

- player-centered aggregates across stints
- not current-team-only snapshots

### Intended split-strength GP% model

Split-strength GP% needs separate treatment because it is not ordinary “games played.”

#### Recommended split-strength concept

Target meaning:

- share of team games in which the player recorded positive TOI in that strength state

Examples:

- EV participation rate
- PP participation rate
- PK participation rate

Recommended naming interpretation:

- this should not be marketed as standard GP%
- it is a participation-in-state rate

Recommended denominator:

- team games in the current team window / season scope

Recommended numerator:

- games with positive TOI in that state

Trade handling:

- same split as all-strength
  - season / career aggregate across stints
  - rolling windows follow current-team context

### Intended model by field family

#### All-strength season-to-date

- `games_played`
  - appearances across current-season stints in scope
- `team_games_played`
  - team games across current-season stints in scope
- `gp_pct_total_all`
  - `games_played / team_games_played`
- `gp_pct_avg_all`
  - probably redundant alias unless renamed
- `gp_pct_avg_season`
  - same underlying season ratio unless schema redesign chooses otherwise

#### All-strength rolling

- `gp_pct_total_lastN`
  - current-team last N chronological team games
- `gp_pct_avg_lastN`
  - probably redundant alias unless renamed

#### Historical 3YA / career

- `gp_pct_avg_3ya`
  - player-centered aggregate across included stints
- `gp_pct_avg_career`
  - player-centered aggregate across career stints

#### Split strengths

- same window logic as above
- but numerator means games with positive TOI in that state

### Why this intended model fits the validated examples

#### Corey Perry

Under the intended model:

- season availability after the trade would remain a season-wide ratio
- rolling `lastN` after the trade would switch cleanly to current-team `TBL` windows

That matches the intuitive product meaning:

- season tells you how available he has been this year overall
- rolling tells you how available he has been recently for Tampa Bay

#### Injured / missed-games case

Under the intended model:

- season availability remains depressed by missed games
- rolling availability shows literal recent team-game participation

That matches user intuition much better than appearance-anchored spans.

### Main conclusion from 4.3

The intended GP% model should use this split:

1. season / 3YA / career
- player-centered availability aggregates across all relevant team stints

2. rolling last N
- current-team chronological team-game windows

3. split strengths
- same window logic, but numerator means positive-TOI participation in that state

This gives the audit a concrete target model for the next step:

- determine whether the current schema can represent that cleanly

## 4.4 Can the Current Schema Represent the Intended GP% Model Cleanly?

This step answers a narrower question than “what should GP% mean?”:

- can the current columns express that intended meaning without ambiguity?

Short answer:

- not cleanly

The current schema can partially represent the intended model for some fields, but not for the full design without either:

- semantic overload
- redundant aliases
- or new columns / renamed fields

### Current GP% column surface

The GP% family currently has:

- `games_played`
- `team_games_played`
- `gp_pct_total_all`
- `gp_pct_avg_all`
- `gp_pct_total_last3`
- `gp_pct_avg_last3`
- `gp_pct_total_last5`
- `gp_pct_avg_last5`
- `gp_pct_total_last10`
- `gp_pct_avg_last10`
- `gp_pct_total_last20`
- `gp_pct_avg_last20`
- `gp_pct_avg_season`
- `gp_pct_avg_3ya`
- `gp_pct_avg_career`

### What the current schema can represent reasonably well

#### `games_played`

Schema fit:

- acceptable as a raw numerator field

Caveat:

- its meaning changes by strength state
- so it is only clean if the product explicitly accepts:
  - all-strength appearances
  - versus split-strength positive-TOI participation counts

#### `team_games_played`

Schema fit:

- acceptable as a raw denominator field for the current row scope

Caveat:

- it only captures the current row’s team-games-through-date context
- it does not preserve multi-team season denominator structure by itself

#### `gp_pct_total_all`

Schema fit:

- potentially usable if explicitly defined as:
  - current-scope running availability ratio

Caveat:

- it becomes ambiguous once season totals are meant to span multiple team stints

### What the current schema does not represent cleanly

#### `gp_pct_avg_all`

Schema fit:

- poor

Reason:

- it is just an alias of `gp_pct_total_all`
- there is no distinct “average” concept here

Conclusion:

- current schema has redundant surface area

#### `gp_pct_total_lastN` vs `gp_pct_avg_lastN`

Schema fit:

- poor

Reason:

- these are also aliases, not distinct concepts
- if the intended model is a rolling team-game availability ratio, there is no meaningful total-vs-average distinction

Conclusion:

- the suffix pattern is forcing a ratio family into a count-style naming template that does not fit

#### `gp_pct_avg_season`

Schema fit:

- poor under the intended model

Reason:

- the field name suggests a season-level availability concept
- but current schema has no explicit way to say whether that season concept is:
  - current-team-only
  - all-team-stints season aggregate
  - or something else

Under the intended model:

- this field should represent season-wide availability across stints
- but the current semantics and naming do not enforce that cleanly

#### Rolling lastN across current team only

Schema fit:

- incomplete

Reason:

- the stored ratio value alone does not indicate:
  - which team window it used
  - whether the denominator was exactly N team games
  - whether it crossed a team-change boundary

If rolling GP% is meant to be current-team-only after a trade, the schema currently relies on row `team_id` plus implementation assumptions rather than explicit window metadata.

### Core schema-fit problems

#### Problem 1: Redundant alias fields

The schema stores both:

- `gp_pct_total_*`
- `gp_pct_avg_*`

But for GP%, these are not distinct concepts.

This creates:

- naming confusion
- extra surface area to maintain
- false implication that both a total and average exist

#### Problem 2: No explicit representation of team-stint scope

The intended model needs to distinguish:

- season aggregate across all current-season stints
- rolling window against current team only

The current schema has no dedicated fields to encode:

- season-stint denominator totals
- current-team rolling denominator counts
- whether a ratio spans multiple teams

So the model is being inferred from implementation rather than represented explicitly.

#### Problem 3: Split-strength participation is overloaded into GP%

For split strengths, `games_played` means:

- games with positive TOI in that strength

That is not the same concept as normal games played.
The current schema does not distinguish:

- all-strength appearances
- state-specific participation counts

So the same column names are trying to carry two different semantic models.

#### Problem 4: Historical season vs rolling season naming collision

The intended model needs:

- a season aggregate concept
- a rolling lastN concept

But the `avg_*` naming pattern makes GP% look like just another metric family when it is actually an availability model with its own rules.

### Minimum conclusion on schema sufficiency

If the goal were only:

- one-team all-strength season availability

then the current schema could be salvaged with documentation and code fixes.

But given the intended model from `4.3`, the current schema is not sufficient to represent all of this cleanly:

- traded-player season aggregates across stints
- current-team rolling windows
- split-strength participation semantics
- removal of fake total-vs-average distinctions

### What likely requires schema changes

At a minimum, one of these must happen:

1. semantic simplification
- collapse redundant GP% alias columns

2. explicit scope fields or replacement columns
- distinguish:
  - season aggregate across stints
  - current-team rolling availability
  - split-strength participation availability

3. clearer naming
- stop pretending GP% has meaningful `total` and `avg` variants in the same way counts do

### Main conclusion from 4.4

The current schema cannot represent the intended GP% model cleanly without redesign.

The most important reasons are:

- redundant alias columns
- no explicit team-stint scope representation
- overloading split-strength participation into the same GP% naming family

That means `4.5` should produce explicit schema-change recommendations rather than trying to rescue the current field set with documentation alone.

## 4.5 Draft `Schema Change Recommendations` for GP% and Availability

This section is intentionally separate from the metric status buckets.
These are redesign recommendations, not status labels.

### Recommendation 1: Stop treating GP% like a normal `total_* / avg_*` metric family

Priority:

- high

Recommendation:

- remove or deprecate the fake GP% total-vs-average duplication

Affected current fields:

- `gp_pct_avg_all`
- `gp_pct_avg_last3`
- `gp_pct_avg_last5`
- `gp_pct_avg_last10`
- `gp_pct_avg_last20`

Reason:

- these are currently aliases, not distinct concepts
- keeping both surfaces implies a semantic distinction that does not exist

Preferred outcome:

- keep only one canonical ratio field per GP% window
- or rename the survivor to a clearer availability-oriented name

### Recommendation 2: Introduce explicit season availability fields that aggregate across team stints

Priority:

- high

Recommendation:

- replace or supplement `gp_pct_avg_season` with a season aggregate that is explicitly player-season scoped across all current-season stints

Suggested replacement concepts:

- `season_availability_pct`
- `season_games_played`
- `season_team_games_available`

Why:

- Corey Perry proved the current team-bucketed season snapshot is structurally wrong for traded players
- the intended season view needs to aggregate across all season stints, not just the current team

### Recommendation 3: Make rolling GP% explicitly current-team and team-game based

Priority:

- high

Recommendation:

- redefine rolling GP% windows around exact team-game windows, not appearance-anchored spans

Suggested replacement concepts:

- `availability_pct_last3_team_games`
- `availability_pct_last5_team_games`
- `availability_pct_last10_team_games`
- `availability_pct_last20_team_games`

Optional denominator fields:

- `team_games_available_last3`
- `team_games_available_last5`
- `team_games_available_last10`
- `team_games_available_last20`

Optional numerator fields:

- `games_played_last3_team_games`
- `games_played_last5_team_games`
- `games_played_last10_team_games`
- `games_played_last20_team_games`

Why:

- the current stored ratio alone hides too much window logic
- explicit numerator/denominator support makes later debugging and UI explanation much easier

### Recommendation 4: Separate all-strength availability from split-strength participation

Priority:

- high

Recommendation:

- stop overloading one GP% concept across all-strength and split strengths

Suggested concept split:

- all-strength fields keep `games played / team games available`
- split-strength fields use a different name, for example:
  - `ev_participation_pct_*`
  - `pp_participation_pct_*`
  - `pk_participation_pct_*`

Possible supporting numerator fields:

- `ev_games_with_toi`
- `pp_games_with_toi`
- `pk_games_with_toi`

Why:

- split-strength “games played” is really “games with positive TOI in this state”
- that is a different concept and should be named that way

### Recommendation 5: Preserve raw numerator and denominator fields for GP% windows

Priority:

- medium-high

Recommendation:

- store raw counts alongside ratios

Suggested field concepts:

- season:
  - `season_games_played`
  - `season_team_games_available`

- career / 3YA:
  - `career_games_played`
  - `career_team_games_available`
  - `three_year_games_played`
  - `three_year_team_games_available`

- rolling:
  - `games_played_lastN_team_games`
  - `team_games_available_lastN`

Why:

- ratios alone are opaque
- raw counts make:
  - UI explanation easier
  - audit checks easier
  - debugging after trades or injuries much easier

### Recommendation 6: Treat team-stint scope as explicit metadata, not hidden implementation behavior

Priority:

- medium-high

Recommendation:

- make it explicit whether a GP% field is:
  - aggregated across season stints
  - current-team-only
  - or strength-state participation based

Options:

1. clearer field names
2. separate columns by scope
3. explicit metadata fields if the storage model remains wide

Why:

- the current model hides team-stint scope inside the implementation
- that is what made the Corey Perry trade failure hard to detect quickly

### Recommendation 7: Keep `games_played` and `team_games_played` only if their row-scope meaning is documented clearly

Priority:

- medium

Recommendation:

- keep these raw fields only if they are explicitly documented as row-scope counters

Why:

- they are still useful for debugging and UI readouts
- but users can misread them as season-final counters rather than row-scope running values

Possible alternative names if redesigned:

- `row_scope_games_played`
- `row_scope_team_games`

This may be too verbose for the actual schema, but the conceptual distinction matters.

### Recommendation 8: Deprecate current GP% naming in the final API/UI contract

Priority:

- medium

Recommendation:

- even if legacy columns remain for backward compatibility, the UI/API contract should pivot to clearer availability names

Suggested contract language:

- `season availability`
- `availability over last 10 team games`
- `PP participation rate`

Not:

- ambiguous `gp_pct_avg_*` style labels

Why:

- most of the confusion here is partly a naming-contract problem, not just a SQL problem

### Recommended redesign direction

If the goal is the cleanest long-term model, the best direction is:

1. keep or expose raw count fields
- appearances numerator
- team games denominator

2. define season / career / 3YA as player-centered aggregates across stints

3. define rolling windows as current-team team-game windows

4. split all-strength availability from EV/PP/PK participation

5. deprecate redundant `avg` aliases

### Main conclusion from 4.5

The GP% redesign should not be a one-line bug fix.
It should include:

- field simplification
- explicit team-window semantics
- split-strength renaming
- and raw numerator / denominator support

These recommendations should feed directly into the final audit’s separate `Schema Change Recommendations` section.
