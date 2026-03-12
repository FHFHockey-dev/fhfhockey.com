# Rolling Player Metrics Audit Pass-2 Action Items

This file is the running implementation backlog generated during the pass-2 audit.

Each item should use this structure:

### `P1` Category: short title
- category: `correctness | schema / naming | source selection | rolling window semantics | availability / participation semantics | TOI trust / fallback | PP context | line context | diagnostics / observability | freshness / recompute workflow | trendsDebug.tsx | downstream compatibility | performance / efficiency | test coverage | optional enhancement`
- priority: `P0 | P1 | P2 | P3`
- affected metrics:
- affected fields:
- affected files:
- problem:
- recommended action:
- expected benefit:
- blocker status:
- source of discovery:
- status: `open | planned | deferred | blocked | done`

### `P1` Diagnostics / observability: expose per-row TOI trust trace for weighted-rate validation
- category: `TOI trust / fallback`
- priority: `P1`
- affected metrics: `toi_seconds`, `sog_per_60`, `ixg_per_60`, `goals_per_60`, `assists_per_60`, `primary_assists_per_60`, `secondary_assists_per_60`, `hits_per_60`, `blocks_per_60`
- affected fields: `toi_seconds_*`, canonical weighted-rate aliases, legacy weighted-rate aliases
- affected files:
  - `web/lib/supabase/Upserts/rollingPlayerToiContract.ts`
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts`
  - `web/pages/trendsDebug.tsx`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
- problem: stored rolling rows preserve chosen TOI values but not the per-row source choice, trust tier, rejection reasons, fallback-seed origin, or WGO normalization path, which makes weighted-rate mismatches expensive to explain during manual validation.
- recommended action: add TOI source-trace data to the validation payload and render it in a dedicated `trendsDebug.tsx` TOI trust panel, including candidate sources, chosen source, trust tier, rejected candidates, fallback-seed details, and suspicious-value notes.
- expected benefit: faster `/60` validation, fewer false-positive mismatch investigations, and clearer separation between arithmetic defects and denominator-trust issues.
- blocker status: blocker for confident weighted-rate validation when counts TOI is missing or disputed; not a blocker for straightforward authoritative-counts cases.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-weighted-rate-family-audit.md`, `tasks/artifacts/rolling-player-pass-2-helper-contract-map.md`, pass-2 validation matrix notes for Brent Burns.
- status: `open`

### `P1` Diagnostics / observability: add explicit mixed-source PP-share window tracing
- category: `PP context`
- priority: `P1`
- affected metrics: `pp_share_pct`, `pp_share_pct_player_pp_toi_*`, `pp_share_pct_team_pp_toi_*`
- affected fields: canonical `pp_share_pct_*`, legacy `pp_share_pct_total_*`, legacy `pp_share_pct_avg_*`, PP-share support columns
- affected files:
  - `web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts`
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts`
  - `web/pages/trendsDebug.tsx`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
- problem: PP-share windows can mix builder-derived team PPTOI rows with WGO fallback rows, but the stored row surface does not expose per-game denominator-source composition, making stored-vs-reconstructed diffs hard to trust when builder coverage is partial.
- recommended action: emit per-game PP-share component provenance in the validation payload, add a mixed-source window indicator in `trendsDebug.tsx`, and surface whether each selected slot used builder data, WGO fallback, or no trusted denominator.
- expected benefit: clearer PP-share validation, easier freshness triage, and less ambiguity when partial-builder coverage produces otherwise explainable diffs.
- blocker status: blocker for PP-share confidence on mixed-source windows; not a blocker when builder coverage is complete across the selected scope.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-ratio-family-audit.md`, `tasks/artifacts/rolling-player-pass-2-helper-contract-map.md`.
- status: `open`

### `P1` Schema / naming: reduce ratio and weighted-rate alias ambiguity where `*_total_*` and `*_avg_*` store the same snapshot
- category: `schema / naming`
- priority: `P1`
- affected metrics: `shooting_pct`, `expected_sh_pct`, `primary_points_pct`, `ipp`, `oz_start_pct`, `pp_share_pct`, `on_ice_sh_pct`, `on_ice_sv_pct`, `pdo`, `cf_pct`, `ff_pct`, `sog_per_60`, `ixg_per_60`, `goals_per_60`, `assists_per_60`, `primary_assists_per_60`, `secondary_assists_per_60`, `hits_per_60`, `blocks_per_60`
- affected fields: legacy `*_total_*`, legacy `*_avg_*`, canonical `*_all`, `*_lastN`, `*_season`, `*_3ya`, `*_career`
- affected files:
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/lib/rollingPlayerMetricCompatibility.ts`
  - `web/pages/trends/player/[playerId].tsx`
  - `web/lib/projections/queries/skater-queries.ts`
  - `web/lib/projections/run-forge-projections.ts`
  - `web/pages/api/v1/db/update-start-chart-projections.ts`
- problem: legacy ratio and weighted-rate names imply totals versus averages, but both surfaces store the same derived snapshot, which increases schema drag and raises the odds of downstream misinterpretation.
- recommended action: document authoritative canonical fields, gate legacy alias use behind compatibility helpers only, and plan a later alias-retirement or freeze strategy once downstream consumers are confirmed to read canonical fields safely.
- expected benefit: lower semantic ambiguity, simpler downstream query logic, and a cleaner path to schema cleanup after pass-2 validation.
- blocker status: not a blocker for current arithmetic correctness; blocker for long-term schema clarity and consumer safety.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-ratio-family-audit.md`, `tasks/artifacts/rolling-player-pass-2-weighted-rate-family-audit.md`, `tasks/artifacts/rolling-player-pass-2-surface-confirmation.md`.
- status: `open`

### `P1` Diagnostics / observability: add dedicated support traces for `on_ice_sv_pct` validation
- category: `diagnostics / observability`
- priority: `P1`
- affected metrics: `on_ice_sv_pct`, `pdo`
- affected fields: canonical `on_ice_sv_pct_*`, legacy `on_ice_sv_pct_total_*`, legacy `on_ice_sv_pct_avg_*`, additive `oi_sa_*`, additive `oi_ga_*`
- affected files:
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/lib/supabase/database-generated.types.ts`
  - `migrations/20260311_add_optional_rolling_player_support_metrics.sql`
  - `web/pages/trendsDebug.tsx`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
- problem: `on_ice_sv_pct` has no dedicated persisted numerator / denominator support columns, so validation has to back-solve through additive `oi_sa` and `oi_ga` companions, which makes it harder to inspect the exact saved ratio components and explain `pdo` coupling.
- recommended action: either add explicit `on_ice_sv_pct` support outputs for canonical scopes or guarantee first-class reconstruction helpers and UI panels that show the exact `saves` and `shots against` components used for the selected window.
- expected benefit: clearer on-ice save-percentage audits, easier PDO debugging, and lower reconstruction friction in the debug console.
- blocker status: not a blocker for eventual reconstruction because additive companions exist; blocker for efficient manual validation and support-field parity with other ratio families.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-ratio-family-audit.md`, `tasks/artifacts/rolling-player-pass-2-helper-contract-map.md`.
- status: `open`

### `P2` Diagnostics / observability: add all-scope support visibility for weighted-rate numerators and denominators
- category: `diagnostics / observability`
- priority: `P2`
- affected metrics: `sog_per_60`, `ixg_per_60`, `goals_per_60`, `assists_per_60`, `primary_assists_per_60`, `secondary_assists_per_60`, `hits_per_60`, `blocks_per_60`
- affected fields: canonical weighted-rate aliases, legacy weighted-rate aliases, historical weighted-rate support columns, additive numerator companions, `toi_seconds_*`
- affected files:
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/lib/supabase/database-generated.types.ts`
  - `migrations/20260311_add_optional_rolling_player_weighted_rate_metrics.sql`
  - `web/pages/trendsDebug.tsx`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
- problem: weighted-rate families persist dedicated support only for `season`, `3ya`, and `career`, leaving `all` and `lastN` validation dependent on derived reconstruction from separate additive and TOI fields instead of a direct support surface.
- recommended action: evaluate adding canonical `all` and `lastN` numerator / TOI support outputs or, if schema growth is not justified, add a normalized validation payload that precomputes those components for the debug console.
- expected benefit: faster `/60` validation, easier stored-vs-reconstructed diffs, and fewer manual cross-field joins during audit work.
- blocker status: not a blocker for correctness; blocker for efficient all-scope and lastN inspection.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-weighted-rate-family-audit.md`.
- status: `open`

### `P1` Availability / participation semantics: make legacy `gp_pct_*` ambiguity impossible to miss in downstream and debug surfaces
- category: `availability / participation semantics`
- priority: `P1`
- affected metrics: `season_availability_pct`, `three_year_availability_pct`, `career_availability_pct`, `availability_pct_lastN_team_games`, `season_participation_pct`, `three_year_participation_pct`, `career_participation_pct`, `participation_pct_lastN_team_games`, `gp_pct_*`
- affected fields: `games_played`, `team_games_played`, `gp_semantic_type`, all `gp_pct_*` fields
- affected files:
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts`
  - `web/lib/rollingPlayerMetricCompatibility.ts`
  - `web/pages/trendsDebug.tsx`
  - `web/pages/trends/player/[playerId].tsx`
- problem: `gp_pct_*`, `games_played`, and `team_games_played` remain semantically overloaded because the same field names can mean all-strength availability or split-strength participation depending on `gp_semantic_type`, which is easy for consumers to miss.
- recommended action: require `gp_semantic_type` to be shown anywhere legacy GP fields are displayed, add explicit canonical-versus-legacy comparison panels in `trendsDebug.tsx`, and audit downstream consumers for implicit `gp_pct_*` interpretation before any alias-retirement step.
- expected benefit: fewer denominator misunderstandings, safer compatibility maintenance, and clearer traded-player / split-strength interpretation.
- blocker status: blocker for safe interpretation of legacy GP aliases; not a blocker for canonical availability / participation fields themselves.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-availability-participation-audit.md`, `tasks/artifacts/rolling-player-pass-2-helper-contract-map.md`.
- status: `open`

### `P1` TrendsDebug.tsx: build a dedicated validation payload instead of ad hoc client-side joins
- category: `trendsDebug.tsx`
- priority: `P1`
- affected metrics: all persisted rolling metrics and contextual fields
- affected fields: all validation-console-visible fields
- affected files:
  - `web/pages/trendsDebug.tsx`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
  - `web/pages/api/v1/debug/rolling-player-metrics.test.ts`
  - `web/pages/trendsDebug.test.tsx`
- problem: the current page is a narrow sustainability sandbox and there is no dedicated read-only payload that returns stored rows, recomputed rows, source rows, diagnostics, formula metadata, source precedence, and trust/fallback traces together.
- recommended action: implement a server-side validation payload route or shared loader that returns the full reconciliation bundle needed by the pass-2 console, then rewrite `trendsDebug.tsx` around that contract and add endpoint/UI tests.
- expected benefit: a stable audit console, less duplicated browser-side logic, and a clearer foundation for pass-2 validation and future debugging.
- blocker status: blocker for the full debug-console scope defined by the PRD.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-surface-confirmation.md`, `tasks/artifacts/rolling-player-pass-2-helper-contract-map.md`, current `trendsDebug.tsx` scope review in the PRD-derived checklist.
- status: `open`

### `P2` Test coverage: add targeted tests for validation-console payloads and hidden contract state
- category: `test coverage`
- priority: `P2`
- affected metrics: PP-share validation flows, TOI-trust-sensitive weighted rates, contextual PP/line labels, legacy-versus-canonical compatibility views
- affected fields: validation payload fields, trust/fallback metadata, canonical-versus-legacy comparison outputs
- affected files:
  - `web/pages/api/v1/debug/rolling-player-metrics.test.ts`
  - `web/pages/trendsDebug.test.tsx`
  - `web/lib/rollingPlayerMetricCompatibility.test.ts`
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
- problem: contract tests exist for the helper modules, but there is no route-level or UI-level test surface yet for the pass-2 validation console, mixed-source blockers, or the way hidden contract state is exposed to users.
- recommended action: add endpoint tests for validation payload completeness and blocker messaging, add UI tests for stale / mismatch / support-field views, and extend compatibility tests where canonical-versus-legacy rendering decisions become user-visible.
- expected benefit: lower regression risk when debug-console work lands and better confidence that audit-critical visibility stays intact.
- blocker status: not a blocker for immediate documentation work; blocker for safely shipping the validation console and related observability changes.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-surface-confirmation.md`, `tasks/artifacts/rolling-player-pass-2-helper-contract-map.md`.
- status: `open`

### `P0` Freshness / recompute workflow: fix `rolling_player_game_metrics` upsert failure that blocks targeted recomputes
- category: `freshness / recompute workflow`
- priority: `P0`
- affected metrics: all persisted rolling metrics and contextual fields
- affected fields: entire `rolling_player_game_metrics` row surface
- affected files:
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/pages/api/v1/db/update-rolling-player-averages.ts`
  - `web/lib/supabase/database-generated.types.ts`
- problem: March 12 targeted recomputes for Brent Burns, Corey Perry, Jesper Bratt, and Seth Jones all completed fetch, merge, and derive phases successfully but failed in the final upsert phase with repeated `Bad Request` responses, which means source freshness work cannot reliably produce new target rows when a stored-row refresh is actually needed.
- recommended action: capture the exact Supabase error payload for the failed batch, log the offending row shape or column subset, add a dry-run validation mode for upsert payloads, and isolate whether the failure is caused by schema drift, bad nullability assumptions, an over-wide batch payload, or a specific generated column mismatch.
- expected benefit: restores targeted recompute as a trustworthy validation step, removes the biggest operational blocker in the runbook, and prevents stale-target evidence from lingering when source data is already fresh.
- blocker status: full blocker for any pass-2 comparison that requires a newly written target row rather than comparison against already-fresh stored rows.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-refresh-execution-2026-03-12.md`, `tasks/artifacts/rolling-player-pass-2-reconstruction-evidence-2026-03-12.md`.
- status: `done`

### `P1` Diagnostics / observability: promote coverage and completeness diagnostics to a first-class validation surface
- category: `diagnostics / observability`
- priority: `P1`
- affected metrics: all persisted rolling metrics, with special impact on PP-share, ratio support fields, and GP support fields
- affected fields: coverage summaries, freshness summaries, GP support counters, ratio support columns, suspicious-output summaries
- affected files:
  - `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts`
  - `web/scripts/check-rolling-player-validation-freshness.ts`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
  - `web/pages/trendsDebug.tsx`
- problem: only source-tail freshness currently has a dedicated repeatable script, while March 12 coverage, derived-window completeness, and suspicious-output review required an ad hoc `ts-node` snapshot to call the diagnostics helpers against live data, which makes the validation workflow less reproducible than it should be.
- recommended action: add an official diagnostics script or API payload that returns `summarizeCoverage(...)`, `summarizeSourceTailFreshness(...)`, `summarizeDerivedWindowDiagnostics(...)`, and `summarizeSuspiciousOutputs(...)` together for the selected player and strength, and wire that output directly into `trendsDebug.tsx`.
- expected benefit: repeatable diagnostics collection, less ad hoc tooling during audit work, and a stable path for freshness / completeness review in both CLI and UI validation flows.
- blocker status: not a blocker for manual one-off validation, but a blocker for efficient repeatable audit execution and for the intended debug-console workflow.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-diagnostics-classification-2026-03-12.md`, March 12 live diagnostics snapshot workflow.
- status: `open`

### `P1` PP context: surface PP builder coverage cautions even when `ppTailLag` is zero
- category: `PP context`
- priority: `P1`
- affected metrics: `pp_share_pct`, `pp_unit`, `pp_share_of_team`, `pp_unit_usage_index`, `pp_unit_relative_toi`, `pp_vs_unit_avg`
- affected fields: PP context fields, PP-share support columns, freshness summary outputs
- affected files:
  - `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts`
  - `web/scripts/check-rolling-player-validation-freshness.ts`
  - `web/pages/trendsDebug.tsx`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
- problem: the March 12 diagnostics snapshot showed ready players with `ppTailLag = 0` but still non-empty `missingPpGameIds` or `missingPpShareGameIds`, which means the latest builder game is present while some selected PP rows still lack builder coverage or share population that matters for confidence.
- recommended action: add explicit `READY WITH CAUTIONS` handling for PP coverage gaps, surface `missingPpGameIds` and `missingPpShareGameIds` in the validation payload and UI, and teach the freshness workflow to distinguish “latest game covered” from “window fully covered.”
- expected benefit: fewer false assumptions that PP validation is fully clean once `ppTailLag` is zero, clearer PP-share trust labeling, and faster investigation of partial-builder windows.
- blocker status: not a blocker for every PP comparison, but a blocker for high-confidence PP-share and PP-context signoff when coverage gaps remain in the selected window.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-diagnostics-classification-2026-03-12.md`, March 12 live diagnostics snapshot for Burns, Perry, Bratt, and Jones.
- status: `open`

### `P1` Diagnostics / observability: expose ratio-support completeness warnings in the validation console
- category: `diagnostics / observability`
- priority: `P1`
- affected metrics: `primary_points_pct`, `ipp`, `pdo`, `pp_share_pct`
- affected fields: ratio support columns, `primary_points_pct_*`, `ipp_*`, `pdo_*`, `pp_share_pct_*`
- affected files:
  - `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts`
  - `web/pages/trendsDebug.tsx`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
- problem: March 12 derived-window diagnostics showed widespread `valuePresentWithoutComponents` and some `partial` windows for ratio families even in scopes where arithmetic reconstruction still passed, which means support columns cannot be trusted on their own but that caution is currently too easy to miss.
- recommended action: add per-metric completeness badges and scope summaries to the validation payload and UI, including `complete`, `partial`, `absent`, `invalid`, and `valuePresentWithoutComponents`, and label support-field-based validation as incomplete whenever those summaries are non-clean.
- expected benefit: prevents over-trusting support columns, makes it obvious when source reconstruction is still required, and aligns the debug-console trust model with the March 12 diagnostics findings.
- blocker status: not a blocker for arithmetic validation when source reconstruction is available; blocker for efficient support-field-only inspection and for interpreting ratio support parity correctly.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-diagnostics-classification-2026-03-12.md`.
- status: `open`

### `P1` TrendsDebug.tsx: move formula, window, and contract metadata out of browser derivation and into the validation payload
- category: `trendsDebug.tsx`
- priority: `P1`
- affected metrics: all persisted rolling metrics, with highest impact on ratio, weighted-rate, PP-share, and availability families
- affected fields: `contracts`, `formulas`, `windows`, `helpers`, selected metric metadata, rolling-window membership output
- affected files:
  - `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
  - `web/pages/trendsDebug.tsx`
  - `web/pages/trendsDebug.test.tsx`
- problem: the current validation payload still returns `contracts`, `formulas`, `windows`, and `helpers` as `null`, so `trendsDebug.tsx` relies on a browser-side formula map, family heuristics, and client-derived rolling-window membership that can drift from the actual helper contracts over time.
- recommended action: populate server-authoritative formula metadata, helper-contract summaries, window-membership snapshots, and copy-helper strings in the validation payload, then simplify the page to render those payload sections directly instead of reconstructing them in the browser.
- expected benefit: lower UI drift risk, cleaner contract visibility, thinner page logic, and a validation console that reflects the rolling pipeline contract rather than a duplicated display approximation.
- blocker status: not a blocker for current targeted inspection; blocker for making the validation console the authoritative long-term audit surface.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-trendsdebug-server-path.md`, `tasks/artifacts/rolling-player-pass-2-trendsdebug-validation-payload-design.md`, `tasks/artifacts/rolling-player-pass-2-trendsdebug-validation-panels.md`, `tasks/artifacts/rolling-player-pass-2-trendsdebug-copy-helpers.md`.
- status: `open`

### `P1` TrendsDebug.tsx: add family-wide mismatch summaries instead of only one focused-metric diff
- category: `trendsDebug.tsx`
- priority: `P1`
- affected metrics: all persisted rolling metrics and support fields
- affected fields: row-level diff summaries, family-level mismatch counts, selected-row comparison output
- affected files:
  - `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
  - `web/pages/trendsDebug.tsx`
  - `web/pages/trendsDebug.test.tsx`
- problem: the current route and page expose only the selected metric diff for the focused row, which means mismatch-only review and metric-by-metric audit sweeps still require repeated manual metric switching rather than showing the complete mismatch footprint for a row or family.
- recommended action: add per-row mismatch counts, family-wide diff summaries, and a focused-row comparison matrix to the validation payload and UI so validators can see all mismatches in scope before drilling into one metric.
- expected benefit: faster pass-2 audit execution, easier row triage, and better support for the PRD goal of validating every persisted metric systematically.
- blocker status: not a blocker for one-off metric inspection; blocker for efficient full-table audit throughput.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-trendsdebug-validation-panels.md`, `tasks/artifacts/rolling-player-pass-2-trendsdebug-tests.md`, live implementation review during `4.4` through `4.7`.
- status: `open`

### `P1` Downstream compatibility: migrate the player trends page off legacy-only suffix selection
- category: `downstream compatibility`
- priority: `P1`
- affected metrics: ratio families, weighted-rate families, availability / participation families, any metric shown in `trends/player/[playerId].tsx`
- affected fields: legacy `avg_*` suffix reads, canonical ratio/weighted-rate aliases, future canonical availability / participation fields
- affected files:
  - `web/pages/trends/player/[playerId].tsx`
  - `web/lib/rollingPlayerMetricCompatibility.ts`
- problem: the player trends page still encodes legacy suffixes such as `avg_last5`, `avg_season`, and `avg_career` directly into its UI/query model, which makes it a hard blocker for retiring misleading ratio/weighted-rate aliases or exposing canonical availability/participation semantics cleanly.
- recommended action: redesign the trend-page metric field resolution so ratio and weighted-rate families read canonical-first with compatibility fallback, keep additive/TOI family handling distinct where `avg` versus `total` remains semantically real, and stop using legacy suffixes as the page’s only conceptual model.
- expected benefit: removes the clearest downstream blocker to schema cleanup, reduces user-facing legacy naming, and aligns the trends page with the validated pass-2 contract.
- blocker status: blocker for any later ratio/weighted-rate alias retirement or freeze strategy that expects downstream UI adoption of canonical fields.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-downstream-compatibility-dependencies.md`, `tasks/artifacts/rolling-player-pass-2-schema-change-recommendations.md`.
- status: `open`

### `P2` Schema / naming: stage a formal alias-freeze and later cleanup migration set for ratio, weighted-rate, and GP compatibility fields
- category: `schema / naming`
- priority: `P2`
- affected metrics: all ratio families, all weighted-rate families, availability / participation compatibility fields
- affected fields: legacy ratio `*_avg_*`, legacy ratio `*_total_*`, legacy weighted-rate `*_avg_*`, legacy weighted-rate `*_total_*`, `gp_pct_*`, convenience GP mirrors
- affected files:
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `migrations/20260311_add_canonical_rolling_player_metric_contract_fields.sql`
  - future cleanup migrations touching `rolling_player_game_metrics`
- problem: pass-2 now has enough evidence to classify several legacy surfaces as compatibility-only, but there is no explicit schema plan yet for how those fields move from “still written” to “frozen” to “later deprecation candidate.”
- recommended action: document an alias-freeze policy now, prevent new readers from adopting those compatibility-only fields, and prepare a later migration set that can deprecate or stop writing them once downstream compatibility blockers are removed.
- expected benefit: turns schema cleanup into a staged plan instead of open-ended drift, lowers the odds of new legacy dependencies appearing, and gives later implementation phases a clear migration target.
- blocker status: not a blocker for current correctness; blocker for finishing pass-2 schema cleanup in a controlled way.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-authoritative-field-classification.md`, `tasks/artifacts/rolling-player-pass-2-schema-change-recommendations.md`.
- status: `open`

### `P2` Performance / efficiency: reduce validation-console overfetch and render weight for repeated metric inspection
- category: `performance / efficiency`
- priority: `P2`
- affected metrics: all metrics shown in `trendsDebug.tsx`
- affected fields: full validation payload sections, legacy sustainability sandbox state, selected metric and family pivots
- affected files:
  - `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts`
  - `web/pages/api/v1/debug/rolling-player-metrics.ts`
  - `web/pages/trendsDebug.tsx`
  - `web/pages/trendsDebug.module.scss`
- problem: the page currently fetches stored rows, recomputed rows, source rows, and diagnostics together on every scope change, and it still keeps the legacy sustainability sandbox mounted on the same route, which adds unnecessary payload and render cost during repeated audit use.
- recommended action: split the validation payload into a lightweight summary layer plus on-demand heavy detail sections, cache stable scope-level data across metric pivots, and consider moving the sustainability sandbox to a secondary tab or separate route once the audit console is fully established.
- expected benefit: snappier inspection loops, less redundant server work, and a clearer validation-first page architecture.
- blocker status: not a blocker for correctness; blocker for comfortable high-volume audit usage and future console scalability.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-trendsdebug-current-surface-audit.md`, `tasks/artifacts/rolling-player-pass-2-trendsdebug-validation-payload-design.md`, `tasks/artifacts/rolling-player-pass-2-trendsdebug-tests.md`.
- status: `open`

### `P2` Optional enhancement: add additive `primary_assists` and `secondary_assists` rolling families
- category: `optional enhancement`
- priority: `P2`
- affected metrics: `primary_assists`, `secondary_assists`
- affected fields: new additive rolling fields for `*_total_all`, `*_total_lastN`, `*_avg_all`, `*_avg_lastN`, `*_avg_season`, `*_avg_3ya`, `*_avg_career`
- affected files:
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/lib/supabase/database-generated.types.ts`
  - future migration(s) touching `rolling_player_game_metrics`
  - `web/pages/trendsDebug.tsx`
- problem: the rolling table already persists `primary_assists_per_60` and `secondary_assists_per_60`, but it does not persist the additive `first_assists` and `second_assists` families underneath them, which leaves assist decomposition less inspectable than the current source surface allows.
- recommended action: add additive rolling families for `primary_assists` and `secondary_assists`, wire them into the additive audit/debug surfaces, and surface them in `trendsDebug.tsx` alongside the existing assist-rate metrics.
- expected benefit: better additive parity under the existing weighted-rate contract, easier validation of `primary_points_pct` and assist-mix behavior, and a cleaner downstream assist decomposition surface.
- blocker status: not a blocker for pass-2 correctness; optional improvement that should be sequenced after the current audit backlog.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-suggested-metric-additions-review.md`, `tasks/prd-rolling-player-metrics-audit-pass-2-trends-debug.md`.
- status: `open`

### `P2` Optional enhancement: add `penalties_drawn` and `penalties_drawn_per_60` from existing NST columns
- category: `optional enhancement`
- priority: `P2`
- affected metrics: `penalties_drawn`, `penalties_drawn_per_60`
- affected fields: new additive rolling `penalties_drawn_*` fields and matching weighted-rate `penalties_drawn_per_60_*` fields
- affected files:
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/lib/supabase/Upserts/rollingPlayerToiContract.ts`
  - `web/lib/supabase/database-generated.types.ts`
  - future migration(s) touching `rolling_player_game_metrics`
  - `web/pages/trendsDebug.tsx`
- problem: current NST sources already provide `penalties_drawn`, but the rolling table does not persist either the raw draw count or a deployment-adjusted draw rate, leaving a useful role/discipline signal unused despite requiring no new provider.
- recommended action: add additive `penalties_drawn` rolling families plus `penalties_drawn_per_60` using the existing weighted-rate contract and TOI resolution path, then expose both in `trendsDebug.tsx`.
- expected benefit: stronger role/context coverage, a new discipline/opportunity-creation lens for downstream consumers, and efficient reuse of source columns already in the ingest surface.
- blocker status: not a blocker for pass-2 correctness; optional improvement that should be sequenced after the current audit backlog.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-suggested-metric-additions-review.md`, `tasks/prd-rolling-player-metrics-audit-pass-2-trends-debug.md`.
- status: `open`

### `P2` Optional enhancement: persist `pp_toi_seconds` for direct PP deployment validation
- category: `optional enhancement`
- priority: `P2`
- affected metrics: `pp_toi_seconds`, `pp_share_pct`
- affected fields: new `pp_toi_seconds_*` rolling fields and related debug-surface companions
- affected files:
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts`
  - `web/lib/supabase/database-generated.types.ts`
  - future migration(s) touching `rolling_player_game_metrics`
  - `web/pages/trendsDebug.tsx`
- problem: current PP validation has to infer player PP deployment indirectly through `pp_share_pct` support fields and builder context rather than reading a direct persisted PP TOI metric, even though the necessary builder and fallback source columns already exist.
- recommended action: add `pp_toi_seconds` for the `all` and `pp` splits using builder `PPTOI` as the primary source and WGO `pp_toi` as fallback-only context, then surface direct PP deployment traces in `trendsDebug.tsx`.
- expected benefit: easier PP-share validation, clearer PP deployment inspection, and less reverse-engineering of numerator/denominator context during manual audit work.
- blocker status: not a blocker for pass-2 correctness; optional improvement best sequenced after PP provenance and mixed-source backlog items.
- source of discovery: `tasks/artifacts/rolling-player-pass-2-suggested-metric-additions-review.md`, `tasks/prd-rolling-player-metrics-audit-pass-2-trends-debug.md`.
- status: `open`
