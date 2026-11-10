# Audit packet: Rolling player averages & trends (part 2 of 2)

Master entries M-ROLL-061 to M-ROLL-075 (15 of 75 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-ROLL-061 | oi_xga | Codex only | 0 | 1 |
| M-ROLL-062 | oi_xgf | Codex only | 0 | 1 |
| M-ROLL-063 | oz_starts | Codex only | 0 | 1 |
| M-ROLL-064 | penalties_drawn | Codex only | 0 | 1 |
| M-ROLL-065 | penalties_drawn_per_60 | Codex only | 0 | 1 |
| M-ROLL-066 | penalties_taken_per_60 | Codex only | 0 | 1 |
| M-ROLL-067 | pp_points | Codex only | 0 | 1 |
| M-ROLL-068 | pp_toi_seconds | Codex only | 0 | 1 |
| M-ROLL-069 | primary_assists | Codex only | 0 | 1 |
| M-ROLL-070 | primary_assists_per_60 | Codex only | 0 | 1 |
| M-ROLL-071 | secondary_assists | Codex only | 0 | 1 |
| M-ROLL-072 | secondary_assists_per_60 | Codex only | 0 | 1 |
| M-ROLL-073 | shot_attempts_per_60 | Codex only | 0 | 1 |
| M-ROLL-074 | shots | Codex only | 0 | 1 |
| M-ROLL-075 | toi_seconds | Codex only | 0 | 1 |

## M-ROLL-061 oi_xga

- **Match:** Codex only; Opus —; Codex rolling-oi_xga
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1445 METRICS[oi_xga]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-oi_xga, calculation; Codex family 'Rolling player metrics'):** oi_xga
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: oi_xga counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-oi_xga): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-oi_xga) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-062 oi_xgf

- **Match:** Codex only; Opus —; Codex rolling-oi_xgf
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1439 METRICS[oi_xgf]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-oi_xgf, calculation; Codex family 'Rolling player metrics'):** oi_xgf
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: oi_xgf counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-oi_xgf): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-oi_xgf) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-063 oz_starts

- **Match:** Codex only; Opus —; Codex rolling-oz_starts
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1409 METRICS[oz_starts]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-oz_starts, calculation; Codex family 'Rolling player metrics'):** oz_starts
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: oz_starts counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-oz_starts): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-oz_starts) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-064 penalties_drawn

- **Match:** Codex only; Opus —; Codex rolling-penalties_drawn
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1336 METRICS[penalties_drawn]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-penalties_drawn, calculation; Codex family 'Rolling player metrics'):** penalties_drawn
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: penalties_drawn counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-penalties_drawn): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-penalties_drawn) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-065 penalties_drawn_per_60

- **Match:** Codex only; Opus —; Codex rolling-penalties_drawn_per_60
- **Possible related records (low-confidence location link, unconfirmed):** ROLL-024
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1249 METRICS[penalties_drawn_per_60]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. 3600 × SUM(penalties_drawn) / SUM(TOI seconds); missing/nonpositive denominator => null.`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Codex view (rolling-penalties_drawn_per_60, calculation; Codex family 'Rolling player metrics'):** penalties_drawn_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: penalties_drawn counts and TOI seconds, source contracts below
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-penalties_drawn_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-penalties_drawn_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-066 penalties_taken_per_60

- **Match:** Codex only; Opus —; Codex rolling-penalties_taken_per_60
- **Possible related records (low-confidence location link, unconfirmed):** ROLL-024
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1263 METRICS[penalties_taken_per_60]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. 3600 × SUM(penalties_taken) / SUM(TOI seconds); missing/nonpositive denominator => null.`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Codex view (rolling-penalties_taken_per_60, calculation; Codex family 'Rolling player metrics'):** penalties_taken_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: penalties_taken counts and TOI seconds, source contracts below
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-penalties_taken_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-penalties_taken_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-067 pp_points

- **Match:** Codex only; Opus —; Codex rolling-pp_points
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1657 METRICS[pp_points]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-pp_points, calculation; Codex family 'Rolling player metrics'):** pp_points
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: pp_points counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-pp_points): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-pp_points) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-068 pp_toi_seconds

- **Match:** Codex only; Opus —; Codex rolling-pp_toi_seconds
- **Possible related records (low-confidence location link, unconfirmed):** ROLL-024
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1469 METRICS[pp_toi_seconds]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-pp_toi_seconds, calculation; Codex family 'Rolling player metrics'):** pp_toi_seconds
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: pp_toi_seconds seconds
  - Output scale: Totals in seconds; averages in seconds per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-pp_toi_seconds): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-pp_toi_seconds) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-069 primary_assists

- **Match:** Codex only; Opus —; Codex rolling-primary_assists
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1277 METRICS[primary_assists]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-primary_assists, calculation; Codex family 'Rolling player metrics'):** primary_assists
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: primary_assists counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-primary_assists): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-primary_assists) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-070 primary_assists_per_60

- **Match:** Codex only; Opus —; Codex rolling-primary_assists_per_60
- **Possible related records (low-confidence location link, unconfirmed):** ROLL-024
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1289 METRICS[primary_assists_per_60]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. 3600 × SUM(primary_assists) / SUM(TOI seconds); missing/nonpositive denominator => null.`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Codex view (rolling-primary_assists_per_60, calculation; Codex family 'Rolling player metrics'):** primary_assists_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: primary_assists counts and TOI seconds, source contracts below
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-primary_assists_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-primary_assists_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-071 secondary_assists

- **Match:** Codex only; Opus —; Codex rolling-secondary_assists
- **Possible related records (low-confidence location link, unconfirmed):** ROLL-024
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1283 METRICS[secondary_assists]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-secondary_assists, calculation; Codex family 'Rolling player metrics'):** secondary_assists
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: secondary_assists counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-secondary_assists): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-secondary_assists) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-072 secondary_assists_per_60

- **Match:** Codex only; Opus —; Codex rolling-secondary_assists_per_60
- **Possible related records (low-confidence location link, unconfirmed):** ROLL-024
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1303 METRICS[secondary_assists_per_60]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. 3600 × SUM(secondary_assists) / SUM(TOI seconds); missing/nonpositive denominator => null.`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Codex view (rolling-secondary_assists_per_60, calculation; Codex family 'Rolling player metrics'):** secondary_assists_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: secondary_assists counts and TOI seconds, source contracts below
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-secondary_assists_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-secondary_assists_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-073 shot_attempts_per_60

- **Match:** Codex only; Opus —; Codex rolling-shot_attempts_per_60
- **Possible related records (low-confidence location link, unconfirmed):** ROLL-024
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1207 METRICS[shot_attempts_per_60]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. 3600 × SUM(icf) / SUM(TOI seconds); missing/nonpositive denominator => null.`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Codex view (rolling-shot_attempts_per_60, calculation; Codex family 'Rolling player metrics'):** shot_attempts_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: icf counts and TOI seconds, source contracts below
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-shot_attempts_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-shot_attempts_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-074 shots

- **Match:** Codex only; Opus —; Codex rolling-shots
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1639 METRICS[shots]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-shots, calculation; Codex family 'Rolling player metrics'):** shots
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: shots counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-shots): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-shots) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-075 toi_seconds

- **Match:** Codex only; Opus —; Codex rolling-toi_seconds
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1463 METRICS[toi_seconds]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-toi_seconds, calculation; Codex family 'Rolling player metrics'):** toi_seconds
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: toi_seconds seconds
  - Output scale: Totals in seconds; averages in seconds per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-toi_seconds): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-toi_seconds) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

