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
