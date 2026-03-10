## Relevant Files

- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Main rolling-player recompute pipeline; owns source merge logic, metric definitions, rolling windows, GP% row assembly, and output derivation.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` - Focused tests for row-spine invariants, unknown-game handling, and later pipeline-level rolling-window / GP% coverage.
- `web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts` - Additive-source precedence helper used to keep NST-over-WGO selection rules explicit and testable.
- `web/lib/supabase/Upserts/rollingPlayerSourceSelection.test.ts` - Focused tests that lock down healthy additive-family source precedence and prevent regressions.
- `web/pages/api/v1/db/update-rolling-player-averages.ts` - Endpoint wrapper for targeted recomputes, refresh controls, and top-level run summaries.
- `web/pages/api/v1/db/update-rolling-player-averages.test.ts` - Endpoint tests for request parsing, refresh-mode behavior, and run-summary responses.
- `web/lib/supabase/Upserts/rollingMetricAggregation.ts` - Ratio-family and weighted-rate rolling/historical aggregation logic, including rolling window semantics.
- `web/lib/supabase/Upserts/rollingMetricAggregation.test.ts` - Unit tests for ratio-of-aggregates math, fixed appearance-window behavior, null/zero policy, and alias semantics.
- `web/lib/supabase/Upserts/rollingHistoricalAverages.ts` - Historical simple averages and GP% historical accumulation logic.
- `web/lib/supabase/Upserts/rollingHistoricalAverages.test.ts` - Unit tests for season, 3YA, career, and cross-stint availability semantics.
- `web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts` - Shared code-level contract for intended availability versus participation semantics across season, rolling, and historical scopes.
- `web/lib/supabase/Upserts/rollingPlayerMetricMath.ts` - TOI-backed `/60` math, share reconstruction, and ixG fallback logic.
- `web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts` - Unit tests for TOI normalization, share-component reconstruction, and ixG fallback behavior.
- `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts` - Coverage, suspicious-output, and run-quality diagnostics for the rolling suite.
- `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts` - Unit tests for new diagnostic surfaces, fallback counters, GP% window diagnostics, and stale-tail warnings.
- `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts` - Upstream PP unit-relative and team-share semantics that must stay distinct from rolling PP share.
- `web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts` - Unit tests for PP team-share versus unit-relative semantics.
- `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts` - Refresh path for upstream PP combination rows used in PP-context validation.
- `web/pages/api/v1/db/update-line-combinations/[id].ts` - Refresh path for upstream line-combination rows used in context-label validation.
- `web/pages/api/v1/db/update-line-combinations/index.ts` - Batch wrapper for line-combination refreshes.
- `web/lib/supabase/database-generated.types.ts` - Generated Supabase types for `rolling_player_game_metrics` and related upstream tables; must stay aligned with schema changes.
- `migrations/20260310_remediate_rolling_player_metrics_gp_pct.sql` - Existing GP% remediation migration that should be reviewed, amended, replaced, or superseded as part of the new schema contract.
- `migrations/[timestamp]_rolling_player_metrics_remediation.sql` - New migration file for required schema, naming, raw-support-field, and compatibility-layer changes.
- `web/pages/trends/player/[playerId].tsx` - Downstream rolling-metric consumer that may need field-name, alias, or contract updates.
- `web/pages/trendsDebug.tsx` - Debug surface that reads rolling metrics and is useful for schema transition and validation tooling.
- `web/lib/projections/queries/skater-queries.ts` - Projection queries that depend on `rolling_player_game_metrics` and may require compatibility updates.
- `web/lib/projections/run-forge-projections.ts` - Downstream projection pipeline reading rolling metrics; must remain compatible with any schema transition.
- `web/pages/api/v1/db/update-start-chart-projections.ts` - Downstream endpoint that queries `rolling_player_game_metrics` and may require schema-contract updates.
- `tasks/rolling-player-metrics-audit-notes.md` - Authoritative remediation source used for traceability and final completeness checks.
- `tasks/prd-rolling-player-metrics-remediation-blueprint.md` - PRD this task list implements.

### Notes

- Unit tests should typically be placed alongside the code files they are testing.
- This workspace uses Vitest in `/web`; use `npx vitest run [optional/path/to/test/file]` from `/Users/tim/Code/fhfhockey.com/web` for focused test runs.
- Schema changes will likely require regenerating `web/lib/supabase/database-generated.types.ts` after migrations are finalized.
- Validation work must use fresh source data and fresh `rolling_player_game_metrics` rows; stale data is a blocker, not a reason to skip a verification step.

## Tasks

- [x] 1.0 Rework the rolling pipeline contract and source-merge foundations
  - [x] 1.1 Inventory the current source precedence rules in `fetchRollingPlayerAverages.ts` for WGO, NST counts, NST rates, NST on-ice rows, PP rows, and line-combination rows, then document the authoritative/fallback contract in code comments or nearby docs where the implementation needs it.
  - [x] 1.2 Refactor `buildGameRecords(...)` and adjacent row-construction helpers so missing source components are represented explicitly rather than silently changing row meaning.
  - [x] 1.3 Add structured tracking for source fallback usage during row assembly, including WGO fallbacks for additive stats, rate-based reconstructions, TOI fallback tier usage, and missing upstream component counts.
  - [x] 1.4 Review and preserve the audit-approved source precedence for healthy additive metric families so the remediation does not regress currently correct count outputs.
  - [x] 1.5 Ensure unknown `game_id` handling, source-gap reporting, and row-spine behavior remain intact while the merge contract is being refactored.
  - [x] 1.6 Add pipeline-level tests covering merged row construction, source precedence, null handling, and fallback transparency.

- [ ] 2.0 Redesign GP% and participation semantics across all scopes
  - [x] 2.1 Reverse the current GP% implementation assumptions in `fetchRollingPlayerAverages.ts` and `rollingHistoricalAverages.ts` into explicit replacement contracts for all-strength availability, split-strength participation, season scope, rolling scope, 3YA scope, and career scope.
  - [x] 2.2 Implement all-strength season availability as a player-centered aggregate across all current-season team stints instead of the current `season:teamId` bucket-only behavior.
  - [x] 2.3 Implement rolling availability windows as exact current-team chronological team-game windows for `last3`, `last5`, `last10`, and `last20`.
  - [x] 2.4 Redesign split-strength GP% semantics into explicit participation-in-state behavior based on positive TOI, with separate naming or explicit compatibility handling so these fields are not mistaken for ordinary games played.
  - [x] 2.5 Decide and implement how legacy GP% fields map to the new contract: replace in place, preserve as compatibility aliases, or deprecate behind new canonical fields.
  - [x] 2.6 Add raw numerator and denominator support fields for availability windows and historical availability scopes so post-trade and missed-game behavior can be audited directly.
  - [x] 2.7 Update historical GP% accumulation in `rollingHistoricalAverages.ts` to support cross-stint season, 3YA, and career semantics under the new contract.
  - [x] 2.8 Add dedicated GP% unit tests for one-team healthy cases, injury/missed-games cases, traded-player season cases, split-strength participation cases, and rolling current-team windows.

- [ ] 3.0 Redesign ratio-family and `/60` rolling-window semantics
  - [ ] 3.1 Define the canonical `lastN` window rules in code for each metric family class: availability, additive performance, ratio performance, and weighted `/60`.
  - [ ] 3.2 Refactor rolling ratio accumulation so window membership is determined by fixed appearance windows where required, instead of by valid-observation-only qualification.
  - [ ] 3.3 Define per-family missing-component policy inside fixed appearance windows, including whether missing numerator/denominator pairs become zero, null, or excluded outputs after the window is selected.
  - [ ] 3.4 Preserve the corrected ratio-of-aggregates arithmetic for bounded ratios and composite metrics while updating the rolling window contract.
  - [ ] 3.5 Preserve the corrected weighted-rate arithmetic for `/60` families while updating rolling window membership to the canonical appearance-based contract.
  - [ ] 3.6 Review all ratio-family and `/60` zero-denominator behaviors and standardize them against explicit product rules instead of inherited implementation defaults.
  - [ ] 3.7 Document or encode scale expectations for each `pct` family so `0-100` and `0-1` metrics are not conflated during validation or downstream consumption.
  - [ ] 3.8 Add focused tests for `shooting_pct`, `primary_points_pct`, `expected_sh_pct`, `ipp`, `on_ice_sh_pct`, `pdo`, `cf_pct`, `ff_pct`, `sog_per_60`, `ixg_per_60`, `hits_per_60`, and `blocks_per_60` under the new rolling-window contract.

- [ ] 4.0 Implement schema, naming, and storage contract changes
  - [ ] 4.1 Audit the current `rolling_player_game_metrics` column surface and classify which fields are healthy as-is, which are semantically misleading, which are redundant aliases, and which require replacement fields.
  - [ ] 4.2 Design the migration plan for GP% redesign, ratio and `/60` alias cleanup, raw numerator/denominator support fields, and any renamed participation or availability fields.
  - [ ] 4.3 Create the new migration file for required schema changes and decide whether the existing `20260310_remediate_rolling_player_metrics_gp_pct.sql` migration should be amended, superseded, or left as historical context.
  - [ ] 4.4 Update generated Supabase types to match the new schema surface after migrations are finalized.
  - [ ] 4.5 Update row-writing logic in `fetchRollingPlayerAverages.ts` so all new or renamed fields are populated consistently and any deprecated alias behavior is intentional.
  - [ ] 4.6 Update downstream consumers of `rolling_player_game_metrics` that rely on renamed, deprecated, or newly canonical fields, including trends pages, debug views, and projection queries.
  - [ ] 4.7 Add migration and compatibility tests or validation scripts that prove legacy consumers still work where backward compatibility is promised.

- [ ] 5.0 Harden PP-share, PP-role, TOI, and helper-specific semantic dependencies
  - [ ] 5.1 Finalize the authoritative denominator contract for `pp_share_pct` by comparing the current WGO-inferred path against upstream `pp_share_of_team` and deciding whether to store one contract or both with distinct names.
  - [ ] 5.2 Ensure PP team-share semantics remain separate from PP unit-relative semantics such as `percentageOfPP`, `pp_unit_usage_index`, `pp_unit_relative_toi`, and `pp_vs_unit_avg`.
  - [ ] 5.3 Review `pp_unit` as a contextual label and define any freshness or validation requirements needed to trust it independently of rolling PP share.
  - [ ] 5.4 Review `line_combo_slot` and `line_combo_group` as contextual labels and define how freshness and upstream builder behavior affect their trust level.
  - [ ] 5.5 Harden `getToiSeconds(...)` and adjacent TOI helpers so denominator trust, WGO unit normalization, and suspicious TOI detection are explicit and testable.
  - [ ] 5.6 Reduce `ixg_per_60` fallback fragility by preferring direct raw ixG accumulation when available and making any rate-based reconstruction clearly diagnosable.
  - [ ] 5.7 Add helper-level tests for PP share resolution, PP-role separation, TOI normalization, and ixG fallback behavior.

- [ ] 6.0 Expand diagnostics, run summaries, and refresh observability
  - [ ] 6.1 Preserve the existing coverage, suspicious-output, and unknown-game diagnostics while refactoring the metric logic.
  - [ ] 6.2 Extend diagnostics to report GP% window membership, team-game denominators, fixed appearance-window membership, ratio-component completeness, TOI fallback tier usage, and rate-reconstruction usage.
  - [ ] 6.3 Add diagnostics for stale or partial source tails so validation can detect incomplete upstream coverage before metric comparisons begin.
  - [ ] 6.4 Add persisted or exportable structured run summaries containing processed players, rows upserted, coverage warnings, suspicious-output warnings, unknown game IDs, fallback-heavy metrics, and freshness blockers.
  - [ ] 6.5 Improve long-run progress visibility in the endpoint and pipeline logs with explicit phase markers for source fetch, merge, derive, upsert, and final summary emission.
  - [ ] 6.6 Add or update diagnostic tests to cover new warning families and structured summary output.

- [ ] 7.0 Execute live-data validation, freshness remediation, and full audit traceability signoff
  - [ ] 7.1 Build the post-implementation validation checklist from the PRD so every metric family and disputed metric has an explicit verification step.
  - [ ] 7.2 Validate source freshness for Brent Burns, Corey Perry, Jesper Bratt, Seth Jones, and any replacement traded-player case before comparing stored rows.
  - [ ] 7.3 Run the required stale-layer refresh actions when validation is blocked, including targeted rolling recomputes, PP-combination refreshes, line-combination refreshes, and any upstream WGO/NST refresh steps needed to advance stale tails.
  - [ ] 7.4 Reconstruct each metric family from live upstream data and compare the reconstructed values to fresh stored rows after the remediation changes land.
  - [ ] 7.5 Re-verify all disputed metrics individually, including GP% replacement fields, rolling ratio-family `lastN` fields, `pp_share_pct_total_lastN`, and `ixg_per_60`.
  - [ ] 7.6 Validate contextual fields `pp_unit`, `line_combo_slot`, and `line_combo_group` against refreshed upstream builder outputs.
  - [ ] 7.7 Record any remaining mismatches with explicit cause buckets: stale source, stale target, logic defect, schema-contract issue, or external blocker.
  - [ ] 7.8 Perform a final completeness pass by re-reading `tasks/rolling-player-metrics-audit-notes.md` and confirming every actionable remediation item is implemented, intentionally deferred as optional, or intentionally deferred as follow-up.

- [ ] 8.0 Deliver optional metric additions and follow-up improvements after required remediation is stable
  - [ ] 8.1 Add the highest-priority optional support metrics from the PRD once correctness work is stable: `on_ice_sv_pct`, raw zone-start counts, and raw on-ice goal/shot counts.
  - [ ] 8.2 Add optional weighted-rate families such as `goals_per_60`, `assists_per_60`, and assist-decomposition rates if the required remediation work is complete and validated.
  - [ ] 8.3 Add optional PP-role context fields to rolling rows, including `pp_unit_usage_index`, `pp_unit_relative_toi`, `pp_vs_unit_avg`, and `pp_share_of_team`, if they are still not part of the required schema contract.
  - [ ] 8.4 Extend downstream consumers and debug surfaces to expose any approved optional support fields.
  - [ ] 8.5 Run targeted validation for each optional addition and document whether it remains optional, graduates into the core contract, or is deferred to a later workstream.
