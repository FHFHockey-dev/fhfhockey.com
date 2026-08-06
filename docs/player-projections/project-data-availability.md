# Project data availability and as-of reproducibility

This report answers what can be established from repository evidence. It does not claim that the hosted database currently contains every table, season, row, snapshot, cron job, secret, or artifact described by the schema.

## Evidence grades

| Grade | Meaning |
| --- | --- |
| A — exact lineage | An immutable source identity and transformation/version receipt can identify the exact stored input. |
| B — dated history | Historical rows exist, but one or more source revision, availability timestamp, or transformation-version dimensions are missing. |
| C — event date only | The row identifies when the hockey event occurred, not when the value became knowable; refreshes may overwrite it. |
| D — current state | Only current or latest state is reliably represented. |
| U — unverified | The schema/code supports the data, but deployed seasons, row counts, continuity, or freshness were not inspected. |

## Migration and database authority

- `supabase/migrations/` is the active replay chain: one production schema baseline plus post-baseline deltas.
- Root `migrations/`, `web/supabase/migrations/`, `web/sql/`, and `supabase/migration-archive/pre-baseline-20260716/` are legacy, design, generated, or historical evidence unless incorporated by an active migration.
- `supabase/migration-archive/pre-baseline-20260716/README.md` says the baseline is schema-only. It does not reproduce hosted data, `cron.job` rows, Vault values, storage buckets, provider configuration, authentication state, or seed data.
- A clean local replay of the full active chain was not run during this documentation audit. That replay is a pre-implementation gate.
- The goalie starter-mixture tables appear only in legacy `migrations/20260527_create_goalie_starter_mixture_tables.sql`; they are absent from the active baseline and deltas even though `web/pages/api/v1/db/update-goalie-starter-mixtures.ts` targets them. Treat that route as orphaned until schema ownership is reconciled.

## Historical source matrix

| Data domain | Repository evidence | Grain and time fields | Revision behavior | Coverage proven by repository | Grade | Forecast-time use |
| --- | --- | --- | --- | --- | --- | --- |
| NHL schedule | `games`; `update-games` routes and NHL server helpers | Game ID, season, date/start time, teams; table has `created_at` but no schedule-revision ledger | Upserted current schedule; revisions overwrite prior start/opponent state | Multi-season support only; hosted bounds unknown | C/U | Safe only for current inference unless schedule snapshots are added |
| NHL raw Gamecenter | `nhl_api_game_payloads_raw`, snapshot heads, ingest/normalization migrations | Game, endpoint, fetched time, payload hash, raw JSON, monotonic head version | Append-only exact payload identities; mutation blocked | Routes support bounded backfill; hosted season bounds unknown | A/U | Strong raw foundation when the prediction references exact raw IDs/versions |
| Normalized NHL PBP and shifts | `nhl_api_pbp_events`, `nhl_api_shift_rows`, roster spots, `projection_game_materialization_status` | Game/event/shift rows plus source fingerprints and parser/materializer versions | Transactional replacement invalidates stale derived state when raw heads change | Dated xG artifacts prove 2025-26 use; current hosted coverage unknown | A/B | Reproducible for materialized games when receipts are retained with the forecast |
| Derived FORGE game strength | `forge_player_game_strength`, `forge_team_game_strength`, `forge_goalie_game` | Completed game/player/team rows; separate materialization status holds version/fingerprint | Current head is replaceable, but its receipt identifies the raw generation | Hosted extent unknown | B | Reusable if forecasts persist the referenced generation; current run rows do not |
| WGO skaters/goalies/teams | `wgo_skater_stats`, `wgo_goalie_stats`, `wgo_team_stats`, unified views | Player/team and hockey event date/season | Provider refreshes upsert the same event grain; most rows lack actual capture/version time | Scripts and SQL reference multiple seasons; exact hosted bounds unknown | C/U | Event-date filtering is insufficient for honest historical vintages |
| NST game logs | `nst_gamelog_*` skater/goalie tables and team tables | Player/team, season and `date_scraped` used as game/date scope | Upserts overwrite provider revisions; `date_scraped` is not a capture-time ledger | Multi-season schema; hosted continuity unknown | C/U | Needs raw/provider version and `available_at` history before historical training |
| Rolling player metrics | `rolling_player_game_metrics` and support payloads | Player, game date, strength; 3/5/10/20 plus season/3YA/career features | Recomputes can rewrite or truncate history; only `updated_at`, no source fingerprint/model version | Current pipeline support; hosted row counts unknown | B/C | Chronological builder logic is useful, but stored rows are not immutable features |
| Players and rosters | `players`, `rosters`, FHFH identity and organization history | Current identity/team plus some effective intervals | `players.team_id` and current roster flags mutate; transfers can close prior rows, missing players are not globally closed | Schema only | B/D | Stable FHFH identity is reusable; team/roster state needs cutoff-addressable history |
| Line and PP context from completed games | `lineCombinations`, `powerPlayCombinations`, deployment tallies | Game/player role and usage | Per-game rows can be rebuilt; season tallies are delete/rebuild aggregates | Hosted history unknown | B | Previous-game role signal only; not a pregame lineup archive |
| Pregame line sources | `lines_nhl`, `lines_dfo`, `lines_gdl`, `line_source_snapshots`, source ingestion | `observed_at`, capture key, ordered lines/goalies/injuries, raw payload | Prospective snapshots are retained | Start date/continuity and schedule ownership unknown | B/U | Best current lineup-vintage foundation; cannot honestly replay dates before capture began |
| Injury/status | `player_status_history`, current status view | Observed time, status, expiry | Historical observations retained | No active Vercel or retained pg_cron owner found | B/U | Schema is usable prospectively, but unscheduled capture prevents continuous history |
| Goalie starts | `goalie_start_projections`, line-source goalies, FORGE roster events | Game/player probability and mutable update time; event evidence can have effective times | One mutable row per game/player; confirmed/projected observations are not a full vintage ledger | Current-season writer only; hosted history unknown | D/U | Unsafe for historical training; retrospective writer can include the target game itself |
| Yahoo ownership/ADP/weeks | Yahoo player snapshots, normalized history, matchup-week snapshots | Several dated snapshots and current player rows | Newer migrations improve snapshot identity; legacy/current tables coexist | Hosted bounds unknown | B/U | Useful product context once exact source-observed cutoffs are enforced |
| External annual projections | Ten `PROJECTIONS_20252026_*` tables and upload batches | Provider table, season encoded in table name, uploaded rows | Latest/upload batch semantics; no uniform observed-at/revision/model methodology | Exactly the 2025-26 table family in active baseline | B/C | Benchmark/consensus only after license, source vintage and revision lineage are verified |
| NHL xG features/predictions | `nhl_xg_*` tables, versioned artifacts and registry | Shot/game/player with feature/model versions, calibration metadata and artifact checksum | Versioned predictions and registry; raw/feature lineage is comparatively strong | Committed approval artifacts cover 2025-26 | A/B | Reusable player features only if their forecast-time availability and aggregation cutoff are explicit |
| Team game-prediction features | `game_prediction_feature_snapshots`, history, model versions and outputs | Game and forecast cutoff with source cutoffs/missingness/fallbacks | Immutable history separated from latest serving outputs | Runtime supports current forecasts/backtests; hosted depth unknown | A/B | Directly reusable contract pattern, not a player target |

## Known dated coverage evidence

The following establishes only that code or committed artifacts used the period; it is not a current hosted-database count.

- The active WGO identity repair targets a bounded April 1–6, 2023 slice, showing both historical rows and a known identity-quality risk.
- The reconstructed analytics sKO RPC hard-codes 2021-22 through 2023-24 as a descriptive baseline.
- The retained offline sKO feature artifact covers only 2024-25, from November 4, 2024 through April 16, 2025.
- Committed xG approval artifacts cover 2025-26. The corrected candidate records chronological train, validation and test date ranges.
- The annual external projection tables are specifically 2025-26.
- No repository-only evidence establishes complete NHL player, line, injury, goalie-start, or provider-snapshot coverage for every desired training season.

## Historical-vintage assessment

### Reconstructable now

- Exact stored NHL Gamecenter raw payloads and their materialized PBP/shift generation, when the raw receipt is known.
- Versioned xG artifact/prediction identities and game-prediction feature snapshots.
- Run-scoped FORGE outputs by `run_id` and `as_of_date`, while those run rows remain retained.
- Sustainability scores after the version-provenance migration, at the score grain only.

### Partially reconstructable

- Player/team/game identity, completed-game roles, rolling metrics, external projections, and prospective line/status evidence.
- These rows have dates, but dates do not consistently encode provider availability, capture time, source revision or transformation version.
- `forge_runs.as_of_date` is a date rather than a cutoff instant; roster events can be admitted through end-of-day, so a morning forecast cannot be recreated exactly.

### Not reconstructable honestly from current contracts

- The schedule as it appeared at an arbitrary historical forecast time.
- Mutable WGO/NST values before provider revisions.
- Full historical active roster and `players.team_id` state.
- Intraday lineup, scratch, injury-return, trade, and goalie-confirmation state for periods before prospective snapshots began.
- Historical `goalie_start_projections` vintages.
- Historical rolling rows under the exact then-current source values and feature implementation.
- Old sustainability baselines/bands when season totals or later games were read during historical rebuilds.

## Concrete leakage and availability failures

1. `web/pages/api/v1/db/update-goalie-projections-v2.ts` admits goalie logs with `gameDate <= projected game date`; a retrospective run can see the starter/outcome of the game being predicted.
2. `web/lib/projections/queries/team-context-queries.ts` has an unrestricted latest-row fallback when no team-strength row exists on/before the forecast date.
3. FORGE uses mutable current player/roster state for historical pools and can use season aggregates/current goalie probabilities without a cutoff-addressable revision.
4. The TypeScript sustainability baseline route accepts a snapshot date but does not consistently constrain all source games/totals to it; the band service reuses full-season totals across historical snapshots.
5. Analytics sKO moments aggregate all available history before computing earlier z-scores.
6. The retained offline sKO “next five” target was historically built with a shifted rolling expression that included four already-known games; its metrics are invalid forecast evidence.
7. `source_provenance_snapshots` does not include `observed_at` in its primary key, so multiple same-day observations at the same source/entity/game grain can overwrite intraday state.
8. FORGE accuracy retains/replaces only the latest succeeded run for a date, preventing vintage-to-vintage evaluation.

## Identity readiness

The strongest identity foundation is the FHFH identity family:

- `fhfh_player_identities`: stable FHFH player ID, optional NHL ID, lifecycle/verification/merge state and provenance.
- `fhfh_player_external_identities`: provider/context/external-ID mapping with confidence and verification.
- `fhfh_player_identity_aliases`, review queue, and effective organization history.

Current analytics and FORGE tables still primarily key players by NHL `players.id`, while older Yahoo, name, lineup and provider maps coexist. A future contract should use `fhfh_player_id` as the stable product identity or persist both FHFH and NHL identities explicitly. It should not create another independent mapper.

## Operational environment

| Capability | Current evidence | Assessment |
| --- | --- | --- |
| Next.js batch/request runtime | `web/vercel.json` gives TypeScript API routes 240 seconds | Suitable for bounded daily inference slices, not unbounded history or expensive training |
| Python serverless | `functions/vercel.json` gives Python APIs 240 seconds and 1 GB; requirements include numerical/ML libraries | Useful for bounded offline-compatible calls, but the mapped `/sko/pipeline` file is absent and the surviving Flask step returns unimplemented behavior |
| Offline training | `web/scripts` and `functions/lib/sustainability/offline.py`; tracked Parquet/pickle/JSON artifacts | Manual/local script environment exists; there is no dedicated worker/container training scheduler in the repository |
| Vercel scheduling | 20 current cron entries, including rolling FORGE, sustainability, odds/game forecast and health | Strong bounded orchestration, with hard duration constraints |
| Supabase pg_cron/pg_net | Historical schedule artifacts plus active ownership-consolidation migration | Hosted rows are not replayed from baseline; desired ownership is partly encoded but must be checked live |
| Concurrency/idempotency | Advisory locks, leases, run manifests, compare-and-swap state, transactional replacement RPCs | Strong reusable foundation |
| Artifact storage | Git-tracked output files; xG registry URI/checksum; game model JSONB metadata | No durable player-model object-store flow or configured model bucket was found |
| Monitoring | `cron_job_audit`, cron report, xG/game/SKO health, pipeline manifests | Good run health; no unified player-model drift/calibration/feature-snapshot health surface |
| Alerting | Cron report and health APIs | No clearly configured external alert sink found in the inspected foundations |
| Database size/query cost | Pagination, bounded routes, indexes and time budgets show awareness | Actual database size, table cardinalities, index hit rates and expensive-query plans are unknown without live inspection |
| Serving latency | Dashboard health helpers contain route budgets for selected surfaces | No universal player-prediction latency SLO; current APIs use latest-run fallbacks and bounded pagination |

Operational inconsistencies to resolve before implementation:

- Historical scheduler evidence includes `update-rolling-games-recent`, but `web/pages/api/v1/db/update-rolling-games.ts` is an intentional HTTP 410 quarantine stub.
- Some documented pg_net timeouts and ingest/repair budgets exceed the deployed 240-second API ceiling.
- Full overnight/repair rolling budgets require a non-request worker or tighter slicing.
- Prospective player-status and lineup-provenance collection is not continuously scheduled in the discovered owners.
- The goalie-mixture writer targets tables outside the active replay chain and lacks the normal admin authorization wrapper.

## Required live data audit before research experiments

Perform this as a read-only, bounded production audit after user authorization:

1. Record min/max dates, seasons, row counts, distinct games/players and null rates for every candidate source.
2. Measure duplicate and revision counts by natural key, including same-event values with different capture times.
3. Verify the active migration list, hosted `cron.job` ownership, job health, Vault-independent metadata and stale routes.
4. Measure schedule, roster, line, injury and goalie-start snapshot continuity by date and intraday observation.
5. Confirm which raw NHL games have exact payload, normalization and materialization receipts.
6. Reconstruct a sample of historical forecasts using only rows available before a chosen cutoff; fail the source if unrestricted/current fallback is required.
7. Measure joins from every retained prediction to completed raw outcomes without latest-row substitution.
8. Inventory database size, largest relations, index coverage and query plans for proposed training extracts.
9. Confirm durable artifact storage, checksum retrieval and rollback behavior outside a developer checkout.

## Schema requirements independent of model choice

The future data contract will need these fields or equivalent semantics regardless of statistical architecture:

- `forecast_issued_at` and explicit data cutoff timestamp.
- Hockey `event_time` separately from `available_at`/`observed_at` and `ingested_at`.
- Stable player/team/game/season identities plus time-valid organization and position state.
- Provider name, provider version, raw snapshot identity/hash and transformation version.
- Immutable feature snapshot ID/hash and source-cutoff manifest.
- Model, feature-set, configuration and artifact checksum identities.
- Conditional/unconditional and target/horizon/strength-state semantics.
- Append-only prediction vintage plus separate latest-serving pointer.
- Outcome linkage and scoring status.

No production schema should be created from this list until the final research architecture fixes the exact target and output contracts.

## Current Supabase platform watchlist

This audit makes no Supabase change, but two current platform changes matter when implementation begins:

- The repository pins Postgres 15 locally. Supabase's 2026 self-hosting changelog moves the default self-hosted image to Postgres 17; any self-hosted environment must pin or deliberately migrate rather than assuming an in-place data-directory upgrade: <https://supabase.com/changelog/46080-self-hosted-supabase-upgrading-from-pg-15-to-17-breaking-change>.
- Supabase is changing automatic Data API exposure for new tables. Future exposed tables need deliberate grants and RLS review rather than assuming `public` is automatically reachable: <https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically>.
