# Yahoo ingestion and identity inventory — 2026-07-22

## Ownership map

| Domain | Current owner | Persistence / consumer boundary |
| --- | --- | --- |
| Per-user OAuth, discovery, refresh, league/team sync | `web/lib/integrations/yahoo/{config,oauth,discovery,refresh,teamRoster}.ts` and `/api/v1/account/yahoo/*` | Owner-scoped connected-account metadata, private token storage, provider preferences/sync runs, external leagues/teams, and roster cache. This is separate from the global ingestion credential. |
| Global ingestion credential | `web/lib/integrations/yahoo/globalCredentials.ts` | Sole active route owner for exact-column service-role reads, complete-row validation, and fail-closed refreshed-token persistence. The three active scheduled/manual routes import it; no browser route or public key owns global credentials. |
| Global game metadata and player keys | `yahoo_game_keys` plus `/api/v1/db/update-yahoo-players` | The database game catalog selects the current scope. The active TypeScript route now completely pages the Yahoo game-player collection and prepares one atomic versioned `yahoo_player_keys` reconciliation; the old Python game/key scripts remain unscheduled compatibility paths pending final game/week retirement. |
| Matchup weeks | `/api/v1/db/update-yahoo-weeks` | Canonical normalized `yahoo_matchup_weeks`; the legacy game-key script still embeds week JSON and remains a consolidation gap. |
| Current Yahoo player detail | `/api/v1/db/update-yahoo-players` | Discovers the newest database-owned NHL game unless an explicit maintenance override is supplied, validates overrides against that catalog, completely pages Yahoo player keys and stable-order active Supabase keys, then batches detail reads by 25 with transient retry and complete/partial telemetry. Candidate migration `20260725220704` supplies the atomic versioned key-snapshot boundary; migrations `20260723113533` and `20260725200808` provide the applied service-role-only latest/ownership/draft writer. `yahooAPI.py` remains an explicit-write opt-in compatibility path. |
| Ownership history/backfill | `yahoo_player_ownership_history` plus the atomic writer | Canonical daily history retains stable player/date identity. Local migration `20260725235646` exposes one read-only security-invoker compatibility view, and named historical UI/API/export readers now consume its normalized alias; Production application and reader-parity proof remain open. |
| Draft history | Production-ledger migrations for `yahoo_player_draft_analysis_history` | Table/index exist, but the active v3 writer does not append this history and therefore is not a complete atomic latest+history owner. |
| Uniform numbers | Current player-detail payload | The scheduled TypeScript pipeline is authoritative. `yahooUniformNumbers.py` is an unscheduled opt-in maintenance fallback with no machine path/current ID default or import-time client; it requires explicit maintenance, game, league, and server credential configuration. |
| Yahoo ↔ NHL mapping | Canonical FHFH external identities plus legacy `yahoo_nhl_player_map` compatibility rows | Deterministic exact/manual/alias stages precede thresholded fuzzy matching; ambiguous candidates use explicit evidence and ties remain unresolved. The 1,857 legacy rows are all distinct but contain 771 repeated Yahoo/NHL ID pairs and 12 null Yahoo IDs, so they are not assigned a fabricated unique key. Predeploy migration `20260726000603` adds the security-invoker base-table view and reduces the materialized cache to select-only compatibility; final cache-read retirement follows deployed reader parity while service refresh ownership remains unchanged. |
| Sheet export | `/api/internal/sync-yahoo-players-to-sheet` | Exact-cron-secret-only internal route called by the global player writer. |

## Current schema and migration evidence

Generated types contain `yahoo_api_credentials`, `yahoo_game_keys`, `yahoo_matchup_weeks`, `yahoo_names`, `yahoo_nhl_player_map`, `yahoo_nhl_player_map_unmatched`, `yahoo_player_draft_analysis_history`, `yahoo_player_keys`, `yahoo_player_ownership_daily`, `yahoo_player_ownership_history`, `yahoo_players`, `yahoo_positions`, and `yahoo_nhl_player_map_mat`. They also expose the legacy overloaded `upsert_players_batch`, active `upsert_yahoo_players_v3`, and the service-role Draft Ranker Yahoo initialization RPC.

The authoritative pre-baseline production ledger preserves the 2025 ownership/history/upsert migrations and the 2026 identity-review, approved-promotion, ownership-foundation, and Yahoo-seed migrations. The older `migrations/` and `web/supabase/migrations/` references in the source PRD are historical names; new schema work must use the canonical root and may not infer live state from the old PRD.

## Routes, schedules, and callers

- Active pg_cron: `update-yahoo-matchup-dates` at 07:20 UTC calls `/api/v1/db/update-yahoo-weeks?game_key=nhl`; `update-yahoo-players` at 08:40 UTC calls `/api/v1/db/update-yahoo-players?gameId=465`; `sync-yahoo-players-to-sheet` at 08:55 UTC calls the exact-cron-only internal sheet route. Vault-backed callers already send the cron bearer; sheet failures now return/log fixed value-free copy.
- Manual global refresh: `/api/v1/db/manual-refresh-yahoo-token`; no static browser caller was found.
- Per-user routes: connect, callback, refresh, disconnect, and team-roster are authenticated owner-scoped account surfaces.
- Direct table/API consumers: Draft Dashboard processing and diagnostics; Draft Ranker discovery/community/export; Command Center ownership context; Start Chart; Player Pickup; team stats; True Goalie Value; Variance; projection administration; matchup-week hooks; ownership snapshots/trends; sheet synchronization; and cron reporting.

## Configuration and artifact boundary

Active global ingestion routes use `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the private `yahoo_api_credentials` row only through `globalCredentials.ts`; `CRON_SECRET` remains their caller-auth boundary. Per-user OAuth separately accepts server-only `YAHOO_CONSUMER_KEY`/`YAHOO_CONSUMER_SECRET` with `YFPY_*` compatibility. Unscheduled Python mapping, historical backfill, and duplicate uniform maintenance paths require their exact write-enable variables plus server-only configuration and are not canonical scheduled/global credential owners. The deleted token JSON remains absent and exactly ignored.

Tracked generated/review artifacts are the normalization spec, mapping TODO/reverse/unmatched JSON files, generated database types, production-ledger migrations, and focused migration/matcher tests. They are evidence or reviewed inputs, not permission to run a provider call, database write, promotion, or cleanup.

## Dependency graph

```text
global Yahoo credential -> game metadata -> matchup weeks
                        -> player keys -> player detail -> latest/history
                                                   \-> mapping/review -> FHFH identity
per-user OAuth token -> current Yahoo game -> leagues/teams/rosters -> account UI
FHFH identity + Yahoo latest fields -> Draft Dashboard / Draft Ranker / Start Chart
Yahoo normalized ownership history -> read-only compatibility view -> ownership APIs, Draft surfaces, Start Chart, and analytics consumers
Yahoo/NHL base mapping -> security-invoker compatibility view -> projections, ownership, Draft, and variance consumers
```

## Current verified gaps

The current scan found and contained public-key and dry-analysis mutation paths in the Python mapping writer; Production's non-atomic v3 latest/history behavior and ambiguous legacy RPC overload; fixed live scheduling plus provider-pagination/deactivation/change-detection gaps in legacy ingestion; legacy/normalized mapping and ownership-history cutover drift; and recurrent stale archived-migration fixture paths now repaired. Active global configuration/token persistence is consolidated, all active global provider calls share bounded retry telemetry, mapping ambiguity is deterministic and evidence-scored, and legacy Python alternatives are explicitly unscheduled/quarantined. The repaired service-role-only atomic detail replacement is applied and passes value-free latest/omission, ownership/draft idempotency, forced late-failure rollback, privilege, and zero-residue proof. The local key-lifecycle candidate now completes provider pagination and defines a locked, versioned, exact-scope reconciliation with safe absent-key deactivation, but its executable database proof/application, controlled provider run, fixed-cron removal, and legacy game/week retirement remain open.

Read-only Production key evidence on 2026-07-25 proves 2,827/2,827 rows use exact `<game>.p.<player>` syntax, split only across game 453 (1,333) and game 465 (1,494). This validates the candidate generated game-scope column without implying migration application.

## Read-only production evidence — 2026-07-23

`yahoo_matchup_weeks` is the canonical normalized weeks store; embedded `yahoo_game_keys.game_weeks` is legacy read compatibility until lifecycle consolidation. Retention remains non-destructive: production contains 488,901 normalized ownership-history rows for 1,548 players (2024-10-04 through 2026-07-22), 32,017 daily rows for 1,333 players, and no draft-history rows.

Complete database-side aggregates reconcile 2,827 Yahoo players to 2,092 mapped and 735 unmapped, including 210/107 mapped/unmapped goalies and 1,882/628 skaters plus every team/display-position segment. The full 3,555-player NHL universe is 1,070 mapped and 2,485 unmapped across every position/team-id segment; the denominator includes 2,127 players with no current team or team `0`.

All Yahoo tables have RLS enabled. Credential storage has no browser policy; intended public datasets expose read-only policies, while service-role writers remain separate. Authorized migration `20260723040553_restrict_legacy_yahoo_player_writers.sql` is applied with exact local/remote history alignment: both `upsert_players_batch` overloads and `upsert_yahoo_players_v3` now report `anon=false`, `authenticated=false`, and `service_role=true` for EXECUTE, and the advisor no longer reports browser execution of the `SECURITY DEFINER` writer. NEW 9.6 remains open because catalog proof finds broad browser table grants on `yahoo_players`/`yahoo_positions` despite RLS-denied row mutation, plus no unique index on `yahoo_names` or `yahoo_nhl_player_map`; the exposed `yahoo_nhl_player_map_mat` remains an intended public read surface.
