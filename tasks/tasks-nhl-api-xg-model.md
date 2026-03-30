## Relevant Files

- `tasks/tasks-prd-nhl-api-xg-model.md` - Task list for implementing NHL API play-by-play ingestion, xG feature engineering, NST parity reconstruction, and validation.
- `web/pages/api/v1/db/update-nhl-play-by-play.ts` - API route to fetch, normalize, and upsert NHL play-by-play data for one or many games.
- `web/pages/api/v1/db/update-nhl-play-by-play.test.ts` - Route-level tests for fetch modes, idempotency, and error handling.
- `web/pages/api/v1/db/update-nhl-shift-charts.ts` - API route to fetch and persist shift chart data required for on-ice attribution and fatigue features.
- `web/pages/api/v1/db/update-nhl-shift-charts.test.ts` - Route-level tests for shift ingestion and retry behavior.
- `web/lib/supabase/Upserts/nhlRawGamecenter.ts` - Raw payload ingestion and storage for play-by-play, landing, and boxscore endpoints.
- `web/lib/supabase/Upserts/nhlRawGamecenter.test.ts` - Unit tests for raw ingest, checksum handling, and idempotent upserts.
- `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts` - Parser that converts raw NHL play-by-play JSON into normalized event rows.
- `web/lib/supabase/Upserts/nhlPlayByPlayParser.test.ts` - Unit tests for event taxonomy, field extraction, and edge-case parsing.
- `web/lib/supabase/Upserts/nhlStrengthState.ts` - Canonical decoding and normalization of situation/manpower/strength states.
- `web/lib/supabase/Upserts/nhlStrengthState.test.ts` - Unit tests for EV, PP, SH, EN, OT, and rare manpower combinations.
- `web/lib/supabase/Upserts/nhlShiftStints.ts` - Shift overlap and on-ice stint derivation utilities.
- `web/lib/supabase/Upserts/nhlShiftStints.test.ts` - Unit tests for overlapping shifts, pulled-goalie states, and penalty windows.
- `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts` - Derived shot-event and xG feature generation from normalized event data.
- `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts` - Unit tests for distance, angle, rebound, rush, flurry, and prior-event feature derivation.
- `web/lib/supabase/Upserts/nhlNstParityMetrics.ts` - Reconstruction of NST-era derived metrics from normalized NHL API data.
- `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts` - Unit tests for metric parity mapping, exclusions, and strength splits.
- `web/lib/supabase/Upserts/nhlXgValidation.ts` - Validation and audit helpers for parity checks, event counts, and schema-level QA.
- `web/lib/supabase/Upserts/nhlXgValidation.test.ts` - Unit tests for event-count parity, feature sanity checks, and validation rule outputs.
- `web/lib/supabase/database-generated.types.ts` - Regenerated Supabase types after schema additions.
- `supabase/migrations/XXXXXXXXXXXX_create_nhl_raw_gamecenter_tables.sql` - Migration for raw endpoint payload storage and ingest metadata.
- `supabase/migrations/XXXXXXXXXXXX_create_nhl_game_events_tables.sql` - Migration for normalized game event storage.
- `supabase/migrations/XXXXXXXXXXXX_create_nhl_shift_stints_tables.sql` - Migration for shift charts, stints, and on-ice attribution support.
- `supabase/migrations/XXXXXXXXXXXX_create_nhl_shot_features_tables.sql` - Migration for derived shot feature and xG-input storage.
- `supabase/migrations/XXXXXXXXXXXX_create_nhl_metric_parity_tables.sql` - Migration for parity output tables, versioning, and audit fields.
- `tasks/prd-nhl-api-xg-model.md` - Source PRD describing xG model goals, parity requirements, and implementation constraints.
- `tasks/definitions-and-parity.md` - Canonical definitions for shot events, chance types, flurries, rebounds, rushes, exclusions, and parity targets.
- `tasks/event-dictionary.md` - Living catalog of observed NHL API event types, detail keys, and examples.
- `tasks/strength-mapping.md` - Documentation of situation code decoding and canonical strength-state rules.
- `tasks/schema-recommendation.md` - Architecture decision record for raw vs normalized tables and scaling strategy.
- `tasks/metric-parity-map.md` - Mapping of legacy NST metrics to NHL API-derived reproductions, approximations, or gaps.
- `tasks/validation-checklist.md` - Manual and automated validation checklist required before model training or rollout.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.
- In this repo, equivalent focused test execution may also be done with `npx vitest run [optional/path/to/test/file]` where applicable.
- Preserve raw upstream payloads before normalization so parser logic can be re-run when definitions or source semantics change.
- Do not blend public xG methodologies silently. Where MoneyPuck, HockeyStats, Evolving-Hockey, HockeyViz, or NST-style definitions differ, document the difference and choose an explicit implementation path.
- Keep raw event storage, normalized event storage, and derived feature/model-output storage separate.
- Treat strength-state separation, shift integration, parity validation, and versioning as release blockers, not optional enhancements.

## Tasks

- [ ] 1.0 Define scope, canonical definitions, and parity requirements
  - [ ] 1.1 Review the PRD and create `tasks/definitions-and-parity.md` as the canonical source of truth for event definitions, exclusions, and parity expectations.
  - [ ] 1.2 Define exactly what counts as a shot attempt, unblocked shot attempt, shot on goal, missed shot, blocked shot, goal, failed attempt, rebound, rush chance, flurry chance, scoring chance, medium-danger chance, and high-danger chance.
  - [ ] 1.3 Define explicit inclusion and exclusion rules for penalty shots, shootouts, delayed penalties, empty-net events, overtime, and rare manpower states.
  - [ ] 1.4 Separate learned xG outputs from rule-based parity metrics so NST-style chance logic is not confused with xG model probabilities.
  - [ ] 1.5 Decide which public-source concepts will be implemented directly, which will be approximated, and which will only be logged/documented for future versions.
  - [ ] 1.6 Create `tasks/metric-parity-map.md` listing every existing NST-derived metric currently used by the repo, its source, its target replacement, and its parity status.
  - [ ] 1.7 Mark every metric in the parity map as one of: exact reproduction target, close approximation target, unsupported with current public data, or intentionally deprecated.
  - [ ] 1.8 Define a versioning policy for parser logic, feature engineering logic, parity logic, and future xG model versions.

- [ ] 2.0 Audit NHL API endpoints and document the raw event taxonomy
  - [ ] 2.1 Identify all NHL endpoints needed for the project, including play-by-play, landing, boxscore, shift charts, and any other supporting gamecenter or stats endpoints.
  - [ ] 2.2 Curl a representative sample of gamecenter play-by-play endpoints across multiple game types: normal regulation, overtime, shootout, special-teams heavy, empty-net, low-event, and high-event games.
  - [ ] 2.3 For each sampled game, log all observed event types, type codes, detail keys, nullable fields, and unusual payload structures into `tasks/event-dictionary.md`.
  - [ ] 2.4 Confirm how event ordering works and identify the canonical sequence field to use for deterministic event ordering within a game.
  - [ ] 2.5 Inspect all relevant current repo endpoints and Supabase upsert flows to understand existing ingestion patterns, idempotency strategies, logging patterns, and schema conventions.
  - [ ] 2.6 Audit current NST scraping endpoints and derived tables to identify every metric, split, and aggregation currently produced by the legacy pipeline.
  - [ ] 2.7 Create `tasks/strength-mapping.md` that documents all observed raw manpower/situation encodings and the intended canonical mapping to exact strength states.
  - [ ] 2.8 Validate that the sampled data contains enough information for coordinates, shot type, event participants, score state, and team attribution to support feature generation.
  - [ ] 2.9 Identify upstream ambiguities or missing fields that may require approximation, fallback logic, or separate enrichment layers.
  - [ ] 2.10 Produce a concise endpoint reconnaissance summary that a future developer can use without repeating the full audit.

- [ ] 3.0 Design scalable ingestion, normalization, and Supabase schema architecture
  - [ ] 3.1 Design raw ingest tables to store untouched endpoint payloads for play-by-play, landing, boxscore, and shift chart responses along with fetch metadata and checksums.
  - [ ] 3.2 Design normalized event tables with one row per event rather than using one giant JSONB row per game as the primary analytic store.
  - [ ] 3.3 Decide which fields should remain in raw JSONB, which should be promoted to typed columns, and which should be derived later in feature tables.
  - [ ] 3.4 Design a normalized schema for players, teams, games, events, on-ice participants, and shift stints that will scale to multiple seasons and repeated backfills.
  - [ ] 3.5 Ensure the schema supports both raw coordinates and normalized attacking-direction coordinates for downstream distance/angle calculations.
  - [ ] 3.6 Ensure the schema supports exact manpower splits such as 5v5, 5v4, 5v3, 4v4, 3v3, 6v5, and empty-net variants in addition to canonical EV/PP/SH labels.
  - [ ] 3.7 Add parser version, feature version, parity version, and ingest timestamps to the schema so future backfills are reproducible and auditable.
  - [ ] 3.8 Design indexes and constraints for efficient querying by game, event sequence, team, player, strength, and event type.
  - [ ] 3.9 Write `tasks/schema-recommendation.md` explaining why the chosen architecture is preferred over alternatives such as storing all events in a single per-game JSONB blob.
  - [ ] 3.10 Create the initial Supabase migrations for raw payload tables, normalized event tables, shift tables, feature tables, and validation/parity support tables.
  - [ ] 3.11 Regenerate Supabase types after the migrations are finalized.
  - [ ] 3.12 Confirm that the schema can support future model versions, replayable backfills, and season-over-season historical comparisons without destructive redesign.

- [ ] 4.0 Build derived event-feature specifications for xG inputs and NST parity outputs
  - [ ] 4.1 Define the normalized event parser requirements for extracting all relevant fields from raw play-by-play payloads, including participants, coordinates, shot type, reason fields, score state, and sequence context.
  - [ ] 4.2 Define the logic for converting raw coordinates into normalized attacking-direction coordinates and deriving distance and angle features.
  - [ ] 4.3 Define prior-event context requirements such as previous event type, previous event team, time since previous event, and distance from previous event.
  - [ ] 4.4 Define rebound logic explicitly, including time-window and sequence assumptions, and store rebound flags as derived fields rather than inferred ad hoc in downstream queries.
  - [ ] 4.5 Define rush logic explicitly, including the transition assumptions needed to approximate or reproduce rush-based chance logic from public data.
  - [ ] 4.6 Define flurry logic and ensure the schema supports both raw per-shot xG and flurry-adjusted sequence accounting without overwriting either value.
  - [ ] 4.7 Define handling for “short” misses and other miss reasons, including whether they contribute to xG totals, sequence context, parity metrics, or only raw logging.
  - [ ] 4.8 Define on-ice attribution rules using shift charts so player, line, pairing, and team on-ice outputs can be derived consistently across strengths.
  - [ ] 4.9 Define feature support for fatigue, power-play age, east-west movement proxies, and other contextual factors if present or approximable from the available public data.
  - [ ] 4.10 Define the set of derived outputs required for exact NST parity attempts, including strength-separated player, team, line, and pairing metrics where feasible.
  - [ ] 4.11 Define the set of derived outputs required for future xG model training tables, keeping model-input tables separate from parity-output tables.
  - [ ] 4.12 Ensure all derived logic is documented in implementation notes so future developers can understand the difference between raw fields, normalized fields, and modeled outputs.

- [ ] 5.0 Establish validation, backfill, and production-readiness requirements
  - [ ] 5.1 Create `tasks/validation-checklist.md` covering raw payload parity, normalized event counts, shot-family counts, score progression sanity, strength-state sanity, and shift overlap sanity.
  - [ ] 5.2 Define automated validation rules that compare normalized event totals against raw payload totals for every ingested game.
  - [ ] 5.3 Define parity validation rules that compare newly derived metrics against the existing NST-based outputs for a representative sample of games, teams, and players.
  - [ ] 5.4 Define manual audit requirements for several sampled games so event parsing, strength mapping, and on-ice attribution can be spot-checked by a human.
  - [ ] 5.5 Define idempotent backfill behavior so the same game can be re-fetched and re-parsed safely without creating duplicate logical records.
  - [ ] 5.6 Define retry, error logging, and partial-failure handling for upstream API failures, malformed payloads, or schema mismatches.
  - [ ] 5.7 Ensure all new routes, parsers, upserts, and validation helpers have unit tests covering standard cases and edge cases.
  - [ ] 5.8 Confirm that no final model training or production rollout happens until event taxonomy, strength decoding, shift integration, and parity validation are all documented and passing.
  - [ ] 5.9 Produce a final implementation summary listing what is complete, what is approximated, what is intentionally deferred, and what still blocks release.
  - [ ] 5.10 Leave follow-up tasks for future model training, coefficient fitting, calibration, benchmarking, and advanced feature additions after the data foundation is validated.