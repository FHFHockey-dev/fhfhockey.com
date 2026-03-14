## Relevant Files

- `tasks/prd-rolling-player-metrics-audit.md` - Source PRD defining the scope, structure, and deliverables for the rolling-player-metrics audit.
- `tasks/tasks-prd-rolling-player-metrics-audit.md` - Task tracker for executing the audit and organizing findings.
- `tasks/rolling-player-metrics-audit-notes.md` - Working audit notes that capture flow mapping, intermediate findings, and evidence as the audit progresses.
- `web/pages/api/v1/db/update-rolling-player-averages.ts` - API entrypoint that triggers the rolling-player-metrics recompute flow and runtime controls.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Main rolling-player-metrics computation, sourcing, windowing, and upsert pipeline.
- `web/lib/supabase/Upserts/rollingHistoricalAverages.ts` - Historical baseline accumulation logic used by the rolling pipeline.
- `web/lib/supabase/Upserts/rollingMetricAggregation.ts` - Ratio aggregation and rolling-window utilities for bounded metrics.
- `web/lib/supabase/Upserts/rollingPlayerMetricMath.ts` - `/60` and share-metric math helpers used by the rolling pipeline.
- `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts` - Coverage and suspicious-output diagnostics for rolling metric runs.
- `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts` - Upstream builder whose PP semantics affect rolling PP usage metrics.
- `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts` - PP usage math and derived-field semantics for the upstream PP table.
- `web/lib/supabase/database-generated.types.ts` - Supabase-generated types for `rolling_player_game_metrics` and upstream tables.
- `migrations/20260309_add_power_play_combination_usage_fields.sql` - Migration documenting newly added PP usage fields that affect rolling semantics.

### Notes

- This task list is for the audit itself, not for fixing all discovered issues immediately.
- The final audit output should keep metric status lists, explanations, validation examples, schema recommendations, and suggested additions in separate sections.
- Live validation should use targeted player examples and, where needed, targeted recomputes to avoid confusing stale rows with current-code behavior.

## Tasks

- [x] 1.0 Inventory the rolling-player-metrics suite and its upstream dependencies
  - [x] 1.1 Read and annotate the primary entry files to map the full recompute flow from API trigger to table upsert.
  - [x] 1.2 Trace all direct helper dependencies used by the rolling pipeline and record what responsibility each helper owns.
  - [x] 1.3 Inventory all upstream tables read by the suite and classify each as authoritative, fallback-only, or derived.
  - [x] 1.4 Identify upstream builders whose semantics affect rolling values, especially PP usage and lineup context.
  - [x] 1.5 Produce the `Upstream Tables` section for the audit, including source quirks, scale notes, and dependency mapping.
- [x] 2.0 Audit metric family semantics, formulas, and window definitions
  - [x] 2.1 Build the metric family inventory for `rolling_player_game_metrics`, grouping persisted columns into logical families.
  - [x] 2.2 Build the full column-by-column inventory of persisted fields in `rolling_player_game_metrics`.
  - [x] 2.3 Document the current shorthand formula for every metric family and key persisted column.
  - [x] 2.4 Audit additive counting stats and baseline fields for correct accumulation and average semantics.
  - [x] 2.5 Audit bounded percentage and ratio metrics, including `shooting_pct`, `expected_sh_pct`, `primary_points_pct`, `ipp`, `oz_start_pct`, `pp_share_pct`, `on_ice_sh_pct`, `pdo`, `cf_pct`, and `ff_pct`.
  - [x] 2.6 Audit all `/60` rate metrics to verify numerator, denominator, fallback order, and TOI unit handling.
  - [x] 2.7 Audit PP usage and role-context metrics, including `pp_unit`, unit-relative fields, and team-share semantics.
  - [x] 2.8 Audit historical baseline fields (`*_avg_season`, `*_avg_3ya`, `*_avg_career`) separately from rolling windows.
  - [x] 2.9 Determine whether each metric family currently represents last N team games, last N appearances, or last N valid observations.
  - [x] 2.10 Recommend the canonical `lastN` rule per family and flag any columns whose names no longer match their behavior.
- [x] 3.0 Validate live metric outputs against upstream source data
  - [x] 3.1 Define the player validation set, including a regular full-season skater, an injury / missed-game case, a partial-team-season case if available, and a heavy PP-role player.
  - [x] 3.2 For each major metric family, pull live source rows from the upstream tables and reconstruct the intended calculation manually.
  - [x] 3.3 Compare live source-derived values to stored `rolling_player_game_metrics` values and classify mismatches by cause.
  - [x] 3.4 Use targeted recomputes where needed to separate stale-row issues from current-code issues.
  - [x] 3.5 Capture validation examples in a separate `Live Validation Examples` section for the final audit.
  - [x] 3.6 Mark each validated metric family or column as `WORKING`, `BROKEN`, `ALMOST`, or `NEEDS REVIEW` based on evidence.
- [x] 4.0 Audit GP% and availability modeling, including schema-fit issues
  - [x] 4.1 Reverse-engineer current `games_played`, `team_games_played`, `gp_pct_total_*`, and `gp_pct_avg_*` behavior from the current code paths.
  - [x] 4.2 Compare current GP% behavior against intended team-game availability semantics, including players who missed games.
  - [x] 4.3 Define the intended model for career, season, and rolling GP% windows.
  - [x] 4.4 Determine whether the current schema can represent the intended GP% meaning cleanly or whether new columns are required.
  - [x] 4.5 Produce a separate `Schema Change Recommendations` list for GP% and availability redesign items.
- [x] 5.0 Produce the final grouped audit artifact and remediation plan
  - [x] 5.1 Write the `Metric Families` section and the `Column-by-Column Inventory` section.
  - [x] 5.2 Write the clean checklist-style `WORKING` section with emoji, shorthand formula, and short status note only.
  - [x] 5.3 Write the clean checklist-style `BROKEN` section with emoji, shorthand formula, and short status note only.
  - [x] 5.4 Write the clean checklist-style `ALMOST` section with emoji, shorthand formula, and short status note only.
  - [x] 5.5 Write the clean checklist-style `NEEDS REVIEW` section with emoji, shorthand formula, and short status note only.
  - [x] 5.6 Write the separate `Explanation / Rationale` section covering why each family landed in its status bucket.
  - [x] 5.7 Write the separate `Suggested Metric Additions` section limited to metrics available from existing upstream data.
  - [x] 5.8 Write the prioritized `Remediation Plan`, separating correctness blockers, schema redesign items, observability improvements, and optional additions.
  - [x] 5.9 Confirm the final audit output keeps status lists, explanations, validation examples, schema recommendations, and additions in separate sections and explicitly notes that the main implementation track resumes at `4.2.2`.
  - [x] 5.10 Cross-reference the `WORKING`, `BROKEN`, `ALMOST`, `NEEDS REVIEW` lists of metrics to confirm it is comprehensive, and does not skip any metric families or columns in the `Column-by-Column Inventory` Section.
