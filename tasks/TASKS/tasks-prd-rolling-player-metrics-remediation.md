## Relevant Files

- `tasks/prd-rolling-player-metrics-remediation.md` - Remediation PRD derived from the audit contract.
- `tasks/rolling-player-metrics-audit-notes.md` - Authoritative remediation blueprint and final verification source.
- `web/pages/api/v1/db/update-rolling-player-averages.ts` - Endpoint wrapper for rolling-player recompute controls.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Main rolling-player pipeline, metric definitions, window assembly, and row derivation.
- `web/lib/supabase/Upserts/rollingHistoricalAverages.ts` - Historical season, three-year, career, and GP% accumulation logic.
- `web/lib/supabase/Upserts/rollingMetricAggregation.ts` - Rolling and historical ratio aggregation helper that currently drives valid-observation window behavior.
- `web/lib/supabase/Upserts/rollingPlayerMetricMath.ts` - Per-60 and share component reconstruction logic, including PP-share denominator reconstruction.
- `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts` - Coverage and suspicious-output diagnostics for auditability.
- `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts` - Upstream PP semantics helper for authoritative team-share comparison.
- `web/lib/supabase/Upserts/rollingHistoricalAverages.test.ts` - Unit tests for historical averages and GP% history behavior.
- `web/lib/supabase/Upserts/rollingMetricAggregation.test.ts` - Unit tests for rolling and historical ratio aggregation behavior.
- `web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts` - Unit tests for per-60 and share reconstruction logic.
- `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts` - Unit tests for rolling diagnostics behavior.
- `web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts` - Unit tests for upstream PP semantic helpers.
- `migrations/20260310_remediate_rolling_player_metrics_gp_pct.sql` - Adds explicit GP% raw-support fields and availability semantics metadata to `rolling_player_game_metrics`.
- `web/package.json` - Test commands for targeted and full `web` suite execution.

### Notes

- Tests in this area run through Vitest, using `npm test -- --run` or `npx vitest run [path]` from `/Users/tim/Code/fhfhockey.com/web`.
- After each parent task, run the focused tests that cover that task; after the parent task is complete, run the full `web` test suite before marking it complete.
- Treat the audit notes as the implementation contract when a current code path disagrees with existing behavior.
- Search for downstream references before renaming helpers, fields, or semantics.

## Tasks

- [x] 1.0 Lock the remediation contract into explicit rolling-window and availability primitives
  - [x] 1.1 Inspect `fetchRollingPlayerAverages.ts` and identify where current simple, ratio, weighted-rate, and GP% windows are assembled.
  - [x] 1.2 Introduce explicit window-contract helpers or internal abstractions so additive metrics, ratio metrics, and GP% do not rely on mixed implicit rules.
  - [x] 1.3 Redesign ratio-family `lastN` membership to use fixed last-N appearances in the relevant strength state rather than last N valid observations.
  - [x] 1.4 Preserve additive-family appearance-window behavior while making the contract explicit in code comments and helper boundaries where needed.
  - [x] 1.5 Add focused tests proving fixed-appearance-window behavior for ratio-family and weighted-rate `lastN` snapshots.

- [x] 2.0 Redesign GP% and participation semantics around team-game scope and traded-player handling
  - [x] 2.1 Reverse-map current GP% calculations in `fetchRollingPlayerAverages.ts` and `rollingHistoricalAverages.ts` to the audited target model before editing.
  - [x] 2.2 Implement all-strength season availability as player-season aggregates across all current-season stints rather than current-team-only buckets.
  - [x] 2.3 Implement rolling GP% windows as current-team last-N chronological team-game windows ending at the current row date.
  - [x] 2.4 Separate all-strength appearance semantics from EV/PP/PK positive-TOI participation semantics in code and stored outputs.
  - [x] 2.5 Add or update raw numerator/denominator support fields and migration work required to represent GP% scope cleanly.
  - [x] 2.6 Add focused tests for traded-player season availability, current-team rolling windows, and split-strength participation semantics.

- [x] 3.0 Rebase PP share and related ratio inputs on authoritative source semantics
  - [x] 3.1 Inspect current `pp_share_pct` input precedence across WGO rows, PP combination rows, and share-reconstruction helpers.
  - [x] 3.2 Compare WGO-inferred team-share semantics with upstream `pp_share_of_team` semantics and choose the authoritative denominator contract required by the audit.
  - [x] 3.3 Update `rollingPlayerMetricMath.ts`, `fetchRollingPlayerAverages.ts`, and any delegated helpers so `pp_share_pct` uses the chosen authoritative contract while keeping unit-relative role fields separate.
  - [x] 3.4 Tighten `ixg_per_60` fallback ordering to prefer direct raw ixG accumulation whenever audited source coverage allows it.
  - [x] 3.5 Add focused tests for PP-share authority, helper-level share reconstruction, and `/60` fallback precedence.

- [x] 4.0 Apply schema, dependency, and diagnostics updates required by the corrected contracts
  - [x] 4.1 Create and apply any migration needed for new GP% or ratio raw-support fields, canonical availability fields, or contract-clarity columns.
  - [x] 4.2 Search the repository for references to changed rolling fields, helper contracts, or PP-share semantics and update dependent code paths as needed.
  - [x] 4.3 Keep or improve rolling diagnostics for coverage gaps, suspicious outputs, GP% window behavior, and fallback reconstruction visibility without mixing diagnostics into metric math.
  - [x] 4.4 Add or update tests for diagnostics and any migration-adjacent helper behavior affected by the redesign.

- [x] 5.0 Validate the full remediation and close the audit loop
  - [x] 5.1 Run targeted tests after each preceding parent task and address any regressions before moving on.
  - [x] 5.2 Run the full `web` test suite after each parent task is completed and again after the entire remediation is implemented.
  - [x] 5.3 Recompute or simulate representative scenarios in tests so the Corey Perry trade case, ratio `lastN` cases, and PP-share cases remain protected.
  - [x] 5.4 Re-read `tasks/rolling-player-metrics-audit-notes.md` and verify that all suggested actions, redesign requirements, and remediation items have been fully addressed.
  - [x] 5.5 If the final verification finds remaining gaps, create a new PRD, generate a new task list, and process the remaining work until the audit contract is fully satisfied.
