## Relevant Files

- `tasks/artifacts/rolling-player-pass-2-main-audit.md` - Consolidated pass-2 audit source used as the implementation brief for the next remediation phase.
- `tasks/rpm-audit-action-items-pass-2.md` - Prioritized backlog of correctness, observability, schema, compatibility, performance, and enhancement follow-ups discovered during the audit.
- `tasks/artifacts/rolling-player-pass-2-upsert-repro-2026-03-12.md` - Deterministic repro artifact for the targeted `rolling_player_game_metrics` upsert failure, including the raw `Bad Request` payload and the derived row-shape summary.
- `tasks/artifacts/rolling-player-pass-2-upsert-debugging-controls-2026-03-12.md` - Added dry-run and payload-summary controls for the rolling writer, plus Brent Burns verification that the no-write path exposes batch shape without attempting an upsert.
- `tasks/artifacts/rolling-player-pass-2-upsert-root-cause-fix-2026-03-12.md` - Root-cause confirmation that the failure was in the wide-table Supabase client upsert transport path, plus the direct PostgREST writer fix and Brent Burns success verification.
- `tasks/artifacts/rolling-player-pass-2-post-fix-freshness-rerun-2026-03-12.md` - Post-fix rerun evidence showing all four validation-player recomputes now write successfully and that remaining Perry/Jones blockers are source-tail PK blockers only.
- `tasks/artifacts/rolling-player-pass-2-upsert-regression-tests-2026-03-12.md` - Regression-test artifact covering the new direct PostgREST writer success path and structured error propagation for malformed upsert responses.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Primary rolling recompute pipeline and likely home of upsert, source-trace, and support-surface changes.
- `web/pages/api/v1/db/update-rolling-player-averages.ts` - Target recompute endpoint that currently needs targeted-upsert blocker remediation.
- `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts` - Validation payload builder that needs richer formula, window, provenance, and mismatch output.
- `web/pages/api/v1/debug/rolling-player-metrics.ts` - Read-only debug route that will carry more diagnostics and validation metadata.
- `web/pages/trendsDebug.tsx` - Primary validation console for the post-audit optimization work.
- `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts` - Diagnostics surface for freshness, completeness, and readiness improvements.
- `web/lib/supabase/Upserts/rollingPlayerToiContract.ts` - TOI-trust and fallback logic that needs better trace visibility.
- `web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts` - PP-share provenance contract that needs mixed-source tracing improvements.
- `web/lib/rollingPlayerMetricCompatibility.ts` - Compatibility helper likely touched by canonical-first cleanup work.
- `web/lib/rollingPlayerMetricCompatibility.test.ts` - Compatibility tests for canonical-first migration work and alias-freeze safety.
- `web/pages/trends/player/[playerId].tsx` - Downstream consumer that still needs migration away from legacy-only suffix assumptions.
- `web/lib/projections/queries/skater-queries.ts` - Projection query layer affected by canonical-versus-legacy cleanup.
- `web/lib/projections/run-forge-projections.ts` - Downstream projection consumer affected by rolling-field authority changes.
- `web/pages/api/v1/db/update-start-chart-projections.ts` - Projection endpoint that must stay compatible with rolling-surface cleanup.
- `web/lib/supabase/database-generated.types.ts` - Generated row types that will change if migrations or persisted metric additions land.
- `migrations/20260311_add_optional_rolling_player_support_metrics.sql` - Existing support-metric migration surface relevant to ratio support parity follow-ups.
- `migrations/20260311_add_optional_rolling_player_weighted_rate_metrics.sql` - Existing weighted-rate support migration surface relevant to support completeness and optional additions.
- `migrations/` - Location for any follow-up migration needed for alias freeze or new persisted optional metrics.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` - Pipeline tests to extend for upsert fixes, support fields, and optional metric additions.
- `web/pages/api/v1/debug/rolling-player-metrics.test.ts` - Debug-route tests for richer validation payload output.
- `web/pages/trendsDebug.test.tsx` - UI tests for the validation console’s new observability and mismatch features.
- `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts` - Diagnostics tests to extend for completeness warnings, PP coverage cautions, and readiness labels.

### Notes

- This task list is sourced from the completed pass-2 audit artifact rather than a new standalone PRD.
- The highest-priority implementation work should follow the `P0`/`P1` ordering already captured in `tasks/rpm-audit-action-items-pass-2.md`.
- Run Vitest from `/Users/tim/Code/fhfhockey.com/web` with `npm test -- --run` or a narrower file path when iterating on individual areas.

## Tasks

- [ ] 1.0 Restore rolling recompute reliability and close freshness blockers
  - [x] 1.1 Reproduce the targeted `rolling_player_game_metrics` upsert `Bad Request` failure with a deterministic player/season slice and capture the exact Supabase error payload plus offending row shape.
  - [x] 1.2 Add targeted logging or a dry-run validation path in `fetchRollingPlayerAverages.ts` / `update-rolling-player-averages.ts` so invalid payload columns, nullability mismatches, or over-wide row batches can be isolated without writing rows.
  - [x] 1.3 Fix the root cause of the targeted upsert failure and verify that player-specific recomputes can write fresh rows successfully again.
  - [x] 1.4 Re-run the March 12 blocked recompute examples for Brent Burns, Corey Perry, Jesper Bratt, and Seth Jones and update the freshness evidence once target writes succeed.
  - [x] 1.5 Add regression coverage for the repaired recompute path, including error handling for malformed upsert payloads and successful targeted writes.
- [ ] 2.0 Expand validation payload and `trendsDebug.tsx` observability for metric-by-metric inspection
  - [ ] 2.1 Populate server-authoritative formula metadata, helper-contract summaries, and rolling-window membership data in `rollingPlayerValidationPayload.ts` and the debug route.
  - [ ] 2.2 Add per-row TOI source-trace output to the validation payload, including candidate sources, chosen source, trust tier, rejected candidates, fallback seed, and suspicious-value notes.
  - [ ] 2.3 Add PP-share provenance output to the validation payload, including per-game builder versus WGO denominator source mix and mixed-source window flags.
  - [ ] 2.4 Add family-wide mismatch summaries and focused-row comparison matrices to the validation payload so `trendsDebug.tsx` can show all mismatches before drilling into one metric.
  - [ ] 2.5 Update `trendsDebug.tsx` to render the new server-authoritative formula, window, TOI, PP provenance, and mismatch summary sections instead of relying on browser heuristics.
  - [ ] 2.6 Add readiness-state refinements in `trendsDebug.tsx` for `READY`, `READY WITH CAUTIONS`, and `BLOCKED`, driven by the richer payload output.
  - [ ] 2.7 Extend debug-route and page tests to cover the richer payload contract, mismatch summaries, TOI trust panel data, mixed-source PP windows, and updated readiness states.
- [ ] 3.0 Improve diagnostics, support-surface completeness, and provenance visibility across ratio and weighted-rate families
  - [ ] 3.1 Promote coverage, freshness, derived-window completeness, and suspicious-output diagnostics into a reusable API/payload surface rather than ad hoc script-only inspection.
  - [ ] 3.2 Add PP coverage caution reporting that distinguishes `latest game covered` from `window fully covered`, including `missingPpGameIds` and `missingPpShareGameIds`.
  - [ ] 3.3 Surface ratio-support completeness states such as `complete`, `partial`, `absent`, `invalid`, and `valuePresentWithoutComponents` for ratio families in the validation payload and UI.
  - [ ] 3.4 Decide whether `on_ice_sv_pct` support parity should be solved with persisted support fields or payload-only helpers, then implement the chosen path.
  - [ ] 3.5 Decide whether all-scope / `lastN` weighted-rate support completeness should be solved with persisted support fields or payload-level reconstruction helpers, then implement the chosen path.
  - [ ] 3.6 Add diagnostics regression coverage for PP caution states, ratio completeness states, and any new support-surface outputs or helper behavior.
- [ ] 4.0 Migrate downstream consumers toward canonical rolling surfaces and formalize compatibility cleanup
  - [ ] 4.1 Audit and update `rollingPlayerMetricCompatibility.ts` so ratio, weighted-rate, and availability families resolve canonical-first while keeping additive and TOI legacy semantics intact where `avg` versus `total` still matters.
  - [ ] 4.2 Migrate `web/pages/trends/player/[playerId].tsx` off legacy-only suffix selection and onto canonical-first field resolution with compatibility fallback.
  - [ ] 4.3 Review and update downstream projection readers in `skater-queries.ts`, `run-forge-projections.ts`, and `update-start-chart-projections.ts` so they follow the audited authoritative-field policy.
  - [ ] 4.4 Add or update compatibility tests that protect canonical-first reads, legacy fallback behavior, and `gp_semantic_type`-aware GP interpretation.
  - [ ] 4.5 Document and, if implementation-ready, add the first staged alias-freeze follow-up for compatibility-only ratio / weighted-rate / GP fields without breaking current readers.
- [ ] 5.0 Implement approved optional metric additions from existing source columns only
  - [ ] 5.1 Add additive rolling families for `primary_assists` and `secondary_assists`, including storage, writer logic, validation-console exposure, and tests.
  - [ ] 5.2 Add `penalties_drawn` and `penalties_drawn_per_60` using existing NST columns and the existing weighted-rate TOI contract.
  - [ ] 5.3 Add `pp_toi_seconds` for `all` and `pp` scopes using builder `PPTOI` with WGO fallback-only context, and expose it in the validation console.
  - [ ] 5.4 Update generated types, compatibility helpers, validation payload output, and any relevant debug selectors or copy helpers for the new optional metrics.
  - [ ] 5.5 Add or update tests covering the new optional metric families, their formulas, and their validation-console visibility.
- [ ] 6.0 Strengthen regression coverage and performance around the post-audit validation workflow
  - [ ] 6.1 Add focused regression coverage for the repaired recompute path, richer validation payload output, canonical-first downstream reads, and new optional metric families.
  - [ ] 6.2 Reduce validation-console overfetch by splitting stable summary data from heavy detail payload sections or caching scope-level data across metric pivots.
  - [ ] 6.3 Reassess whether the legacy sustainability sandbox should stay on `trendsDebug.tsx` or move behind a secondary tab / route once the validation console is fully authoritative.
  - [ ] 6.4 Run the full Vitest suite and targeted validation flows after the optimization work lands, then update any audit/runbook artifacts that depend on changed behavior.
