## Relevant Files

- `tasks/tasks-nhl-api-xg-model.md` - Execution plan for NHL API ingestion, NST parity reconstruction, and xG data-foundation work.
- `tasks/prd-nhl-api-xg-model.md` - Final PRD for the migration and xG data platform once scope decisions are closed.
- `tasks/nhl-api-nst-migration-brief.md` - Current technical brief summarizing the recon findings, schema choice, and open policy questions.
- `tasks/definitions-and-parity.md` - Canonical source of truth for event definitions, exclusions, parity targets, and versioning policy.
- `tasks/event-dictionary.md` - Living catalog of NHL event types, `details` keys, nullable behavior, and examples.
- `tasks/strength-mapping.md` - Canonical mapping for `situationCode`, manpower state, and exact/canonical strength labels.
- `tasks/legacy-ingest-conventions.md` - Audit of the existing `pbp_games`, `pbp_plays`, and `shift_charts` ingest/idempotency/audit contract to preserve or replace during migration.
- `tasks/upstream-ambiguities.md` - Canonical register of sparse fields, endpoint ambiguities, fallback rules, and documented non-parity exceptions.
- `tasks/schema-recommendation.md` - Architecture decision record for raw snapshots, normalized event rows, shift rows, and future derived tables.
- `tasks/metric-parity-map.md` - Mapping of every legacy NST metric and table family to its NHL-derived replacement path.
- `tasks/pbp-plays-vs-nhl-api-events-audit.md` - Comparison of legacy `pbp_plays` against `nhl_api_pbp_events`, including count parity, shared-field parity, and legacy-only assumptions.
- `tasks/shift-charts-vs-nhl-api-shifts-audit.md` - Comparison of legacy `shift_charts` against `nhl_api_shift_rows`, including TOI parity, player coverage, and baseline limitations.
- `tasks/validation-checklist.md` - Manual and automated validation checklist required before parity sign-off or training use.
- `tasks/artifacts/nhl-pbp-recon-2026-03-30.md` - Generated reconnaissance report with sampled games, observed event types, and validated `situationCode` examples.
- `tasks/artifacts/nhl-pbp-recon-2026-03-30.json` - Machine-readable reconnaissance output that can seed later tests or parser fixtures.
- `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql` - Current migration for immutable raw payload snapshots plus normalized roster, event, and shift-row storage.
- `web/scripts/recon-nhl-pbp.mjs` - Reconnaissance script that samples Supabase game IDs, fetches NHL payloads, and logs the event dictionary.
- `web/scripts/ingest-nhl-api-raw.mjs` - Initial raw-ingestion script that stores play-by-play, landing, boxscore, and shiftcharts payloads and upserts normalized rows.
- `web/lib/supabase/database-generated.types.ts` - Regenerated Supabase types after schema additions.
- `web/pages/api/v1/db/update-nhl-play-by-play.ts` - API route to ingest raw and normalized play-by-play data for one game, a range, or a backfill batch.
- `web/__tests__/pages/api/v1/db/update-nhl-play-by-play.test.ts` - Route-level tests for single-game play-by-play ingest and route response handling.
- `web/pages/api/v1/db/update-nhl-shift-charts.ts` - API route to ingest shift charts and any later stint/on-ice derivations.
- `web/__tests__/pages/api/v1/db/update-nhl-shift-charts.test.ts` - Route-level tests for shift-chart backfill selection and route response handling.
- `web/lib/supabase/Upserts/nhlRawGamecenter.mjs` - Reusable library for fetching/storing raw gamecenter and shiftchart payloads and normalizing roster, event, and shift rows.
- `web/lib/supabase/Upserts/nhlRawGamecenterRoute.ts` - Shared API-route helper that resolves game selections and invokes raw NHL gamecenter ingestion through admin/audit-safe endpoints.
- `web/lib/supabase/Upserts/nhlRawGamecenter.test.ts` - Unit tests for raw endpoint retry logic, payload hashing, snapshot idempotency, and batched upserts.
- `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts` - Parser that converts raw NHL play-by-play JSON into normalized event rows.
- `web/lib/supabase/Upserts/nhlPlayByPlayParser.test.ts` - Unit tests for event taxonomy, field extraction, and edge-case parsing.
- `web/lib/supabase/Upserts/nhlStrengthState.ts` - Canonical decoding and normalization of `situationCode`, manpower, and strength labels.
- `web/lib/supabase/Upserts/nhlStrengthState.test.ts` - Unit tests for EV, PP, SH, EN, OT, and rare manpower combinations.
- `web/lib/supabase/Upserts/nhlCoordinates.ts` - Offense-relative coordinate normalization helpers that keep raw rink coordinates separate from derived direction-aware geometry.
- `web/lib/supabase/Upserts/nhlCoordinates.test.ts` - Unit tests for attacking-direction normalization, mirroring rules, and null-side handling.
- `web/lib/supabase/Upserts/nhlEventInclusion.ts` - Canonical normalized-layer inclusion and exclusion rules for shootouts, penalty shots, delayed penalties, empty-net states, overtime, and rare manpower.
- `web/lib/supabase/Upserts/nhlEventInclusion.test.ts` - Unit tests for normalized-layer eligibility and exclusion behavior across special event-state cases.
- `web/lib/supabase/Upserts/nhlOnIceAttribution.ts` - Event-time on-ice attribution helpers for player, pairing, line, and team outputs built on top of reconstructed shift stints.
- `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts` - Unit tests for on-ice player-set attribution, team-relative strength context, and entity membership checks.
- `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts` - Cross-module normalized-layer coverage for standard plays, rare event shapes, empty-net states, overtime, and shift-overlap edge cases.
- `web/lib/supabase/Upserts/nhlShiftStints.ts` - Shift overlap, stint derivation, and on-ice attribution utilities.
- `web/lib/supabase/Upserts/nhlShiftStints.test.ts` - Unit tests for overlap handling, pulled-goalie states, and penalty windows.
- `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts` - Derived shot-event and xG feature generation from normalized event data.
- `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts` - Unit tests for distance, angle, rebound, rush, flurry, and prior-event feature derivation.
- `web/lib/supabase/Upserts/nhlNstParityMetrics.ts` - Reconstruction of NST-era derived metrics from normalized NHL API data.
- `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts` - Unit tests for metric parity mapping, exclusions, and strength splits.
- `web/lib/supabase/Upserts/nhlXgValidation.ts` - Validation and audit helpers for parity checks, event counts, and schema-level QA.
- `web/lib/supabase/Upserts/nhlXgValidation.test.ts` - Unit tests for event-count parity, feature sanity checks, and validation rule outputs.
- `migrations/XXXXXXXXXXXX_create_nhl_shot_features_tables.sql` - Planned migration for derived shot-feature and model-input storage.
- `migrations/XXXXXXXXXXXX_create_nhl_metric_parity_tables.sql` - Planned migration for parity output tables, versioning, and audit fields.

### Notes

- Unit tests should typically be placed alongside the code files they are testing.
- In this repo, focused test execution can be done with `npx vitest run [optional/path/to/test/file]`.
- Preserve raw upstream payloads before normalization so parser logic can be replayed when definitions or source semantics change.
- Keep raw payload storage, normalized event storage, and derived feature/model-output storage separate.
- Treat strength-state decoding, shift integration, parity validation, and versioning as release blockers.
- Do not silently blend public methodologies. If NST-style rules and future xG logic diverge, document the difference and version the behavior explicitly.

## Tasks

- [x] 1.0 Finalize scope, policy decisions, and source-of-truth documentation
  - [x] 1.1 Decide whether phase 1 parity covers skaters only or skaters plus goalies, and record that decision in the PRD and parity map. Phase 1 parity will cover skaters plus goalies.
  - [x] 1.2 Decide whether exact NST parity or NHL-derived “correctness” wins when the two disagree on edge cases, and document the policy explicitly. NHL-derived correctness wins when it conflicts with NST on edge cases; any intentional divergence must be documented and versioned.
  - [x] 1.3 Decide whether the first production rollout targets current season only or includes immediate historical backfill, and update the backfill tasks accordingly. Prioritize current season only for the first rollout, but build in a query parameter that can trigger immediate historical backfill when needed.
  - [x] 1.4 Decide whether rush, rebound, flurry, and danger-bucket classifications are phase-1 deliverables or a second-pass derived layer after raw/event/shift ingestion stabilizes. Rush, rebound, flurry, and danger-bucket classifications are phase-1 deliverables.
  - [x] 1.5 Convert `tasks/nhl-api-nst-migration-brief.md` plus the resolved decisions into `tasks/prd-nhl-api-xg-model.md`.
  - [x] 1.6 Create `tasks/definitions-and-parity.md` as the canonical source of truth for event definitions, exclusions, parity expectations, and versioning policy.
  - [x] 1.7 Create `tasks/metric-parity-map.md` listing every existing NST-derived metric currently used by the repo, its target NHL-derived replacement, and its status: exact, close approximation, unsupported, or deprecated.
  - [x] 1.8 Define versioning rules for parser logic, strength logic, parity logic, derived features, and future xG model versions.

- [x] 2.0 Consolidate reconnaissance and legacy-contract findings into living docs
  - [x] 2.1 Promote the sampled event taxonomy from `tasks/artifacts/nhl-pbp-recon-2026-03-30.md` into `tasks/event-dictionary.md`.
  - [x] 2.2 Promote the validated `situationCode` findings into `tasks/strength-mapping.md`, including explicit examples for `1331`, `0651`, and `1560`.
  - [x] 2.3 Record the current upstream endpoint shape differences, including the finding that `play-by-play` exposes `rosterSpots` while `boxscore` may not expose the expected roster sections for the same game.
  - [x] 2.4 Confirm the canonical event-ordering field for deterministic in-game sequencing and document it in the event dictionary and parser notes.
  - [x] 2.5 Audit the current repo’s legacy NST scraping endpoints, `pbp_plays`, `pbp_games`, and `shift_charts` flows to capture the existing ingest, idempotency, and audit conventions that the new pipeline must preserve or replace.
  - [x] 2.6 Enumerate every current NST table family and strength split in use: all situations, EV, PP, PK, plus counts, rates, on-ice counts, and on-ice rates where applicable.
  - [x] 2.7 Confirm that the sampled NHL data supports the required coordinates, shot types, participant IDs, score state, and team attribution needed for parity and feature generation.
  - [x] 2.8 Identify any upstream ambiguities or missing fields that require approximation, fallback logic, or documented non-parity exceptions.

- [x] 3.0 Finalize the scalable schema and migration plan
  - [x] 3.1 Expand `tasks/schema-recommendation.md` to explain why raw snapshots plus normalized event and shift rows are preferred over a primary per-game JSONB design.
  - [x] 3.2 Review and refine `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql` so it fully captures immutable raw payload snapshots, normalized roster spots, normalized event rows, and raw shift rows.
  - [x] 3.3 Decide which raw payload fields remain only in JSONB, which are promoted to typed columns, and which are deferred to derived feature tables.
  - [x] 3.4 Ensure the schema supports both exact manpower labels (`5v5`, `5v4`, `6v5`, `3v3`) and canonical strength states (`EV`, `PP`, `SH`, `EN`).
  - [x] 3.5 Ensure the schema supports normalized attacking-direction coordinates, parser/feature/parity versions, and replayable backfills.
  - [x] 3.6 Add or plan indexes and constraints for efficient querying by game, event order, team, player, strength, and event type.
  - [x] 3.7 Plan the next migrations for derived shot-feature storage and NST-parity output storage so the raw and normalized foundations do not get overloaded with derived concerns.
  - [x] 3.8 Regenerate `web/lib/supabase/database-generated.types.ts` after the migration set is finalized and applied.

- [x] 4.0 Operationalize raw ingestion in Supabase and the repo
  - [x] 4.1 Apply `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql` to Supabase and confirm the new tables and view exist in the target project.
  - [x] 4.2 Run `web/scripts/ingest-nhl-api-raw.mjs` for the sampled recon games and verify that raw payload snapshots, roster spots, event rows, and shift rows are populated as expected.
  - [x] 4.3 Compare the newly ingested `nhl_api_pbp_events` rows against existing `pbp_plays` rows for overlapping games to identify flattening gaps, field mismatches, or legacy-only assumptions.
  - [x] 4.4 Compare `nhl_api_shift_rows` against existing `shift_charts` aggregates to confirm the raw shift feed can support current TOI totals and later stint reconstruction.
  - [x] 4.5 Extract shared logic from `web/scripts/ingest-nhl-api-raw.mjs` into reusable library modules such as `web/lib/supabase/Upserts/nhlRawGamecenter.ts`.
  - [x] 4.6 Add or update API routes that can invoke the new raw-ingestion flow for one game, a date range, or a backfill batch using the repo’s normal audit and auth patterns.
  - [x] 4.7 Decide whether the legacy `pbp_games`, `pbp_plays`, and `shift_charts` flows should dual-write during migration or remain frozen while the new pipeline is validated. Legacy `pbp_games`, `pbp_plays`, and `shift_charts` will remain frozen while the new NHL API pipeline is validated.
  - [x] 4.8 Add unit and route-level tests covering raw ingest retries, checksum/idempotency handling, and basic Supabase upsert behavior.

- [ ] 5.0 Build the normalized event, strength, and on-ice attribution layer
  - [x] 5.1 Implement `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts` to extract typed event rows from raw play-by-play payloads, including participants, coordinates, shot type, reasons, score state, and sequence context.
  - [x] 5.2 Implement `web/lib/supabase/Upserts/nhlStrengthState.ts` to decode `situationCode` and assign exact/canonical strength labels consistently across EV, PP, SH, EN, OT, and rare manpower states.
  - [x] 5.3 Implement normalized attacking-direction coordinate handling so downstream distance and angle calculations do not depend on raw rink orientation.
  - [x] 5.4 Implement `web/lib/supabase/Upserts/nhlShiftStints.ts` to reconstruct overlapping shift intervals, stints, and on-ice player sets from raw shift rows.
  - [x] 5.5 Define and implement the inclusion and exclusion rules for penalty shots, shootouts, delayed penalties, empty-net events, overtime, and rare manpower states at the normalized layer.
  - [x] 5.6 Define and implement on-ice attribution rules needed for player, line, pairing, and team outputs across all relevant strengths.
  - [x] 5.7 Add unit tests covering standard plays, rare event shapes, pulled-goalie states, OT states, and shift-overlap edge cases.

- [ ] 6.0 Build derived shot-feature and NST-parity outputs
  - [ ] 6.1 Define and implement prior-event context features such as previous event type, previous event team, time since previous event, and distance from previous event.
  - [ ] 6.2 Define and implement rebound logic explicitly, including time-window and same-sequence assumptions, and store rebound flags as derived fields.
  - [ ] 6.3 Define and implement rush logic explicitly, including the transition assumptions needed to approximate or reproduce rush-based public metrics.
  - [ ] 6.4 Define and implement flurry logic so raw per-shot values and flurry-adjusted sequence accounting can coexist without overwriting one another.
  - [ ] 6.5 Define handling for “short” misses and other miss reasons, including whether they contribute to xG totals, parity metrics, sequence context, or only raw logging.
  - [ ] 6.6 Define and implement feature support for fatigue, power-play age, east-west movement proxies, and other contextual factors if they are present or approximable from public data.
  - [ ] 6.7 Implement `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts` so model-input tables remain separate from parity-output tables.
  - [ ] 6.8 Implement `web/lib/supabase/Upserts/nhlNstParityMetrics.ts` to reconstruct the required NST-era metrics, strength splits, and on-ice outputs from normalized events and shifts.
  - [ ] 6.9 Document the final raw-field, normalized-field, derived-feature, and parity-output boundaries so future developers can understand the data contract.
  - [ ] 6.10 Add unit tests covering feature derivation, parity mapping, exclusions, and strength-separated outputs.

- [ ] 7.0 Validate, backfill, and prepare for rollout
  - [ ] 7.1 Create `tasks/validation-checklist.md` covering raw payload parity, normalized event counts, shot-family counts, score progression sanity, strength-state sanity, and shift overlap sanity.
  - [ ] 7.2 Implement automated validation rules that compare normalized event totals against raw payload totals for every ingested game.
  - [ ] 7.3 Implement parity validation rules that compare the new NHL-derived outputs against existing NST-based outputs for a representative sample of games, teams, and players.
  - [ ] 7.4 Define manual audit requirements and audit a representative sample of games so event parsing, strength mapping, and on-ice attribution can be spot-checked by a human.
  - [ ] 7.5 Define idempotent backfill behavior so the same game can be re-fetched and re-parsed safely without creating duplicate logical records.
  - [ ] 7.6 Define retry, error logging, and partial-failure handling for upstream API failures, malformed payloads, or schema mismatches.
  - [ ] 7.7 Confirm that no model training or production rollout occurs until event taxonomy, strength decoding, shift integration, and parity validation are documented and passing.
  - [ ] 7.8 Produce a final implementation summary listing what is complete, what is approximated, what is intentionally deferred, and what still blocks release.
  - [ ] 7.9 Leave follow-up tasks for model training, coefficient fitting, calibration, benchmarking, and advanced feature additions after the data foundation is validated.

- [ ] 8.0 Resolve live schema drift discovered during NHL raw-ingest execution
  - [ ] 8.1 Compare the live `nhl_api_*` table shapes in the target Supabase project against `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql` and identify every missing lineage/raw JSON/index-related column.
  - [ ] 8.2 Create an additive corrective migration so already-created `nhl_api_*` tables gain the missing phase-1 columns without requiring destructive table recreation.
  - [ ] 8.3 Apply the corrective migration in the target Supabase project, regenerate `web/lib/supabase/database-generated.types.ts`, and retry `web/scripts/ingest-nhl-api-raw.mjs` for the sampled recon games.
  - [ ] 8.4 Decide whether to keep `pbp_plays` frozen as a partial comparison baseline or backfill its missing recent-game coverage for broader overlap validation.
  - [ ] 8.5 Decide whether `shift_charts` should remain a validation baseline as-is or be repaired/backfilled, given that recent rows can have null `game_toi`, `durations`, and `shifts`.
  - [x] 8.6 Add retry/backoff handling around raw NHL endpoint fetches so multi-game ingest batches survive transient `UND_ERR_SOCKET` failures instead of aborting the whole run. Completed during `4.8` by adding shared retry/backoff fetch handling in `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`.
