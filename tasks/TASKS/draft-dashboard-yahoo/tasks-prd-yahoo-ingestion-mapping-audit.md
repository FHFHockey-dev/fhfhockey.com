# Yahoo Ingestion and NHL Identity Mapping — Audit, Remediation, and Rollout Tasks

## Relevant Files

- `tasks/TASKS/draft-dashboard-yahoo/prd-yahoo-audit.md` - Source PRD/audit, schema proposals, priority findings, and historical-ingestion addendum.
- `tasks/TASKS/draft-dashboard-yahoo/tasks-prd-draft-dashboard.md` - Downstream Draft Dashboard consumer requirements and missing-player diagnostics.
- `tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md` - Per-user Yahoo connection/token architecture and completed tracked-secret remediation.
- `tasks/TASKS/draft-dashboard-yahoo/yahoo-current-inventory.md` - Current ownership, schema, route/schedule/caller, configuration, artifact, dependency, and gap inventory.
- `web/lib/integrations/yahoo/` - Shared server-side Yahoo configuration, OAuth, discovery, and provider adapter code.
- `web/lib/supabase/Upserts/Yahoo/yahooAPIgameIds.py` - Historical game metadata/week ingestion path.
- `web/lib/supabase/Upserts/Yahoo/yahooApiPlayerKeys.py` - Historical player-key ingestion path.
- `web/lib/supabase/Upserts/Yahoo/yahooAPI.py` - Player detail/draft/ownership batch path.
- `web/lib/supabase/Upserts/Yahoo/yahooHistoricalOwnership.py` - Paginated, adaptive historical ownership backfill tool.
- `web/lib/supabase/Upserts/Yahoo/populate_yahoo_nhl_mapping.py` - Yahoo-to-NHL mapping implementation candidate.
- `web/lib/supabase/yahooUniformNumbers.py` - Standalone uniform-number path to merge or quarantine.
- `web/pages/api/v1/db/update-yahoo-players.ts` - Current TypeScript batched player writer/RPC caller.
- `web/pages/api/v1/db/update-yahoo-weeks.ts` - Current matchup-week ingestion route.
- `web/pages/api/v1/db/manual-refresh-yahoo-token.ts` - Global Yahoo token refresh route requiring strict internal authorization.
- `web/lib/standardization/nameStandardization.ts` - Existing TypeScript player normalization/alias source.
- `web/lib/supabase/Upserts/Yahoo/player_name_normalization_spec.json` - Cross-runtime normalization artifact if current and generated safely.
- `web/lib/supabase/database-generated.types.ts` - Current Yahoo table/RPC schema evidence.
- `migrations/` and `web/supabase/migrations/` - Yahoo schema/mapping/history migration evidence; reconcile duplicate migration roots before changes.

### Notes

- This list repairs the PRD-only Yahoo audit pair and converts recommendations into executable verification/remediation tasks.
- The previously tracked Yahoo token JSON was deleted and ignored; credentials were confirmed rotated/re-authorized on 2026-07-11. Do not recreate JSON credential artifacts. Use server-only environment or approved encrypted/Vault-backed storage.
- Keep global ingestion credentials separate from per-user connected-account tokens and ownership.
- Prefer one authoritative writer per domain while preserving compatibility readers during staged migration.
- All Yahoo/provider calls, production cron changes, live token checks, database application, and controlled account events use the super-goal checkpoint protocol.
- Complete-table Supabase/PostgREST reads must paginate until a short page or use a verified aggregate/RPC.

## Tasks

- [x] 1.0 Establish the authoritative current Yahoo inventory and contracts
  - [x] 1.1 Re-inventory every Python/TypeScript route, shared helper, table, RPC, migration, cron entry, UI consumer, environment name, and generated artifact related to Yahoo.
  - [x] 1.2 Record stable ownership for game metadata/weeks, player keys, player details, ownership history, draft history, uniform numbers, NHL mapping, global token refresh, and per-user league sync.
  - [x] 1.3 Reconcile live/generated schema with the PRD's inferred tables and identify stale names such as `_mat`, duplicated week storage, or conflicting migration roots.
  - [x] 1.4 Build a dependency graph from credentials → games/weeks → player keys → player details/history → mapping → downstream projections/Draft Dashboard.
  - [x] 1.5 Convert every verified P0–P3 gap into a `NEW` task with current evidence rather than relying on the 2025 audit state.
    - Evidence (1.0–1.5, 2026-07-22): `yahoo-current-inventory.md` records the complete current owner/schema/RPC/migration/cron/caller/environment/artifact set, explicit legacy/canonical boundaries, dependency graph, and every current gap under NEW 9.1–9.7. No provider or database operation was executed.

- [ ] 2.0 Secure credentials, routes, and provider interaction
  - [x] 2.1 Verify the removed token JSON remains absent/ignored and scan tracked Yahoo code/artifacts for credential-shaped values without printing secrets.
  - [ ] 2.2 Centralize global Yahoo credential configuration in server-only code with explicit required-variable validation and redacted logging.
  - [x] 2.3 Keep per-user connected-account tokens in the approved encrypted service-role-only path and prove browser/RLS clients cannot read them.
  - [ ] 2.4 Protect manual refresh, ingestion, backfill, mapping mutation, and sync routes with internal secret/admin authorization plus method/rate controls.
  - [x] 2.5 Return minimal refresh metadata rather than provider payloads and avoid logging token/key fragments.
    - Evidence (2.1/2.3/2.5, 2026-07-22): the deleted token artifact remains absent and exactly ignored; tracked-value shape scans are clean; the production-verified connected-account wrapper remains service-role-only with owner-scoped browser access; and the global refresh route now discards the Yahoo games payload and returns only success/refreshed/timestamp metadata.
  - [ ] 2.6 Add focused authorization, missing-config, redaction, and provider-error tests.

- [ ] 3.0 Consolidate game metadata, weeks, and player-key ingestion
  - [ ] 3.1 Choose and document one canonical normalized weeks representation while preserving a compatibility view/read path during cutover.
  - [ ] 3.2 Consolidate game/week ingestion into idempotent versioned writes with change detection, bounded concurrency, retries, and partial-result reporting.
  - [ ] 3.3 Parameterize game/league/season selection; remove hard-coded current IDs from canonical jobs while retaining explicit maintenance overrides.
  - [ ] 3.4 Fetch all player keys through verified Yahoo/provider pagination and paginate all Supabase source reads; do not assume 2,000 or a large limit is complete.
  - [ ] 3.5 Mark absent keys inactive only after a complete successful scope snapshot so partial provider responses cannot falsely deactivate players.
  - [ ] 3.6 Add deterministic fixtures/tests for multi-season weeks, unchanged skips, additions/removals, partial batches, retries, and completeness counts.

- [ ] 4.0 Complete player detail plus ownership/draft history persistence
  - [x] 4.1 Verify efficient multi-key batching and defensive extraction across supported Yahoo response shapes without debug single-key restrictions.
  - [ ] 4.2 Separate fetch, transform, persistence, and telemetry responsibilities while retaining a shared row contract across Python and TypeScript maintenance paths.
  - [x] 4.3 Create/verify normalized daily ownership history and, if required, draft-analysis history with stable player/date/source/version identity and query indexes.
    - Evidence (4.1/4.3, 2026-07-22): the active TypeScript writer uses 25-key Yahoo batches and array/object/primitive ownership extraction; generated types and production-ledger migrations verify normalized ownership/draft-history tables, stable per-player date/timestamp identities, source fields, and query indexes. NEW 9.3 keeps atomic writer/history semantics open.
  - [ ] 4.4 Make the canonical RPC/writer atomically upsert latest-compatible `yahoo_players` fields and idempotently append the scoped history snapshot.
  - [ ] 4.5 Preserve an explicit missing/omitted status when a snapshot ran but Yahoo omitted a player; do not convert missing values to fabricated zero ownership.
  - [ ] 4.6 Merge uniform-number extraction into the canonical detail pipeline or prove the standalone tool remains necessary; quarantine hard-coded path behavior.
  - [ ] 4.7 Define evidence-based retention/aggregation only after measuring volume and consumers; destructive pruning requires approval.
  - [ ] 4.8 Add RPC/integration tests for atomic latest+history writes, duplicate date reruns, response-shape variation, omissions, partial failures, and rollback.

- [ ] 5.0 Build authoritative Yahoo-to-NHL identity mapping and review
  - [x] 5.1 Define a generated, versioned cross-runtime normalization specification for punctuation, Unicode/diacritics, suffixes, aliases, whitespace, and canonical IDs.
  - [ ] 5.2 Apply deterministic exact/alias matches before fuzzy candidates and use team, position cluster, active status, and provider IDs only as explicit scored evidence.
  - [ ] 5.3 Persist authoritative mappings with confidence, method, review status, effective dates, lineage/supersession, source version, and reviewer notes.
  - [x] 5.4 Persist unmatched/conflicting candidates with reasons, attempts, candidate scores, source identities, and timestamps rather than dropping them.
  - [ ] 5.5 Support incremental mapping for new/changed players and an explicit full recompute that never overwrites approved manual mappings silently.
  - [x] 5.6 Provide or verify an authorized review/approve/reject/reassign workflow and downstream cache/materialized-view refresh.
  - [ ] 5.7 Reconcile mapping completeness against the full Yahoo and NHL player universes using paginated reads and report goalie/skater/team/position segments.
  - [x] 5.8 Add normalization, deterministic ranking, ambiguity, false-positive, manual override, supersession, and incremental-update tests.
    - Evidence (5.1/5.4/5.6/5.8, 2026-07-22): the shared JSON/Python normalizer, unmatched table, FHFH identity review queue, guarded promotion generator/migration, lineage/provenance fields, and matcher/promotion/migration/Draft Dashboard collision tests preserve unresolved identities and deterministic review. Team/position scoring, full incremental recompute behavior, and current segmented completeness stay open.

- [ ] 6.0 Add operational scheduling, retries, and observability
  - [ ] 6.1 Define exact schedules and dependency gates for token freshness, games/weeks, keys, details/history, mapping, and downstream consumers.
  - [ ] 6.2 Implement bounded exponential backoff with jitter and `Retry-After` handling for 429/transient responses plus fail-fast handling for auth/schema/systemic errors.
  - [ ] 6.3 Persist run identity, component, parameters, start/end, processed/succeeded/failed/omitted counts, rate-limit events, retries, and partial-success state.
  - [ ] 6.4 Make historical backfill resumable/idempotent with bounded date/player scopes and machine-readable telemetry; do not treat local log files as the sole operational record.
  - [ ] 6.5 Alert on stale last success, repeated ownership failure, mapping coverage regression, unmatched growth, rate-limit saturation, token failure, and schema drift.
  - [x] 6.6 Update cron inventory/reporting so scheduled route names, audit rows, expected tables, and partial failures correlate accurately.
    - Evidence (6.6, 2026-07-22): the canonical 64-job schedule and cron-report maps record the Yahoo weeks/player/sheet jobs, exact routes/tables/order, shared audit wrapper ownership, and partial/failure classification.

- [ ] 7.0 Verify downstream compatibility and user-facing states
  - [ ] 7.1 Verify projections and Draft Dashboard consumers retain latest ADP/round/drafted/ownership fields while historical timelines use normalized history.
  - [x] 7.2 Verify missing/unmatched players surface through diagnostics and review state rather than silently disappearing.
  - [x] 7.3 Verify matchup-week, goalie, shift, roster, connected-account, and league/team consumers use the canonical identities and current-season selection.
  - [x] 7.4 Provide loading, empty, stale, partial, rate-limited, unmapped, and provider-unavailable states with last-success/source metadata.
  - [x] 7.5 Add compatibility/contract tests around the stable latest-player view/API and representative downstream queries.
    - Evidence (7.2–7.5, 2026-07-22): A-DRAFT exposes bounded unmapped/conflict/current-game-missing diagnostics without dropping projections; current matchup/week, goalie/shift, roster, account, and league/team consumers use current-season and owner-scoped identities; connected-account and dashboard surfaces preserve loading/empty/error/partial/rate-limit/provider states; focused mapping, pagination, ownership, discovery, roster, and migration contracts pass. Row 7.1 remains open because ownership trends still read the legacy timeline JSON instead of normalized history.

- [ ] 8.0 Execute staged verification and synchronize the initiative
  - [x] 8.1 Run unit/fixture tests without live Yahoo dependency, targeted database/RPC checks, and safe local dry runs with bounded samples.
    - Evidence (8.1, 2026-07-22): deterministic Python matcher tests pass 10/10; focused Vitest route-inventory, auth-boundary, mapping, ownership, account-provider, and migration checks pass 16 files/60 tests; full TypeScript and Python compilation pass. Generated promotion SQL remains review/apply-separated and no live Yahoo or database call occurred.
  - [ ] 8.2 Verify schema indexes, RLS/API exposure, row identities, and complete pagination using current Supabase docs/changelog and advisors where available.
  - [ ] 8.3 Run staging/provider controlled verification only through a checkpoint; record counts without storing credentials or sensitive provider payloads.
  - [ ] 8.4 Reconcile one bounded end-to-end path from Yahoo source through history/mapping to Draft Dashboard/player visibility.
  - [ ] 8.5 Update the PRD, this list, auth/provider tasks, Draft Dashboard list, cron docs, runbook, and master ledger with final evidence.

## NEW Tasks

- [ ] NEW 9.0 Append every verified defect, schema drift, provider/manual dependency, unmatched identity class, and optimization discovered during execution here before closure.
- [ ] NEW 9.1 **P0 unauthenticated global Yahoo maintenance routes:** `/api/v1/db/manual-refresh-yahoo-token`, `/api/v1/db/update-yahoo-weeks`, and `/api/v1/db/update-yahoo-players` performed credential reads/provider calls/service-role writes without `adminOnly`. All three now use the shared fail-closed admin/cron boundary; scheduled callers already send Vault-backed cron authorization and focused missing-auth/static-inventory tests pass. Exact commit `6cdef000069f3d890c6ee3e6db1fe041a86a0ce8` is READY as target-null branch deployment `dpl_CLMBhhAnuqDSREaFHdZBemxF1uxE`; its root is 200, all three routes return 401 for missing and invalid authorization, and the bounded route-error query is empty. Keep open until an exact deployment is Production-targeted and the same missing/invalid plus current-auth safe-method probes pass without executing a writer (discovered and updated 2026-07-22).
- [x] NEW 9.2 **P0 public-key fallback in mapping writer:** `populate_yahoo_nhl_mapping.py` allowed `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY` as a fallback for persistence. The writer now requires `SUPABASE_SERVICE_ROLE_KEY`; a focused source-contract test prevents regression and no mapping/database operation ran (closed 2026-07-22).
- [ ] NEW 9.3 **P1 non-atomic canonical player/history writer drift:** the active route calls `upsert_yahoo_players_v3`, which swallows ownership-history insert errors, coerces several absent values through zero, and does not append draft history, while generated types report an ambiguous overloaded legacy `upsert_players_batch`. Choose one fail-closed atomic latest/ownership/draft writer, preserve omission semantics and compatibility, then verify migration/runtime/rollback before closing 4.2/4.4/4.5/4.8 (discovered 2026-07-22).
- [ ] NEW 9.4 **P1 split global credential/configuration ownership:** per-user OAuth uses the server Yahoo integration and private token wrappers, while global TypeScript routes read `yahoo_api_credentials` directly and Python maintenance mixes `YFPY_*`, environment-token persistence, and compatibility names. Define one server-only global credential owner with required-variable validation, redacted errors, and no browser-readable key/token path before closing 2.2/2.6 (discovered 2026-07-22).
- [ ] NEW 9.5 **P1 incomplete ingestion lifecycle and fixed-season scheduling:** the active player cron still pins `gameId=465`; legacy game/key/player paths lack one shared complete-provider-pagination, retry/backoff, complete-snapshot deactivation, change-detection, and partial-result contract. Preserve explicit maintenance overrides but implement canonical current-game discovery and completeness telemetry before closing 3.x/6.1–6.4 (discovered 2026-07-22).
- [ ] NEW 9.6 **P1 schema/read cutover and security proof drift:** generated/live-era contracts retain normalized and legacy week, mapping, ownership, and RPC surfaces; ownership trends still read `yahoo_players.ownership_timeline`. Reconcile canonical compatibility views/readers and obtain current global-Yahoo-object RLS/API/grant/index/advisor proof before closing 7.1/8.2/8.4 (discovered 2026-07-22).
- [x] NEW 9.7 **P2 archived-migration test fixture drift:** the Yahoo identity-review and Draft Ranker Yahoo-seed tests still resolved their SQL from the removed active migration root after the clean-baseline archive. Both now read the exact immutable production-ledger copies; the focused suites pass without restoring duplicate active migrations (closed 2026-07-22).
