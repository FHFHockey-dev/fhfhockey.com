# Yahoo ingestion and identity inventory — 2026-07-22

## Ownership map

| Domain | Current owner | Persistence / consumer boundary |
| --- | --- | --- |
| Per-user OAuth, discovery, refresh, league/team sync | `web/lib/integrations/yahoo/{config,oauth,discovery,refresh,teamRoster}.ts` and `/api/v1/account/yahoo/*` | Owner-scoped connected-account metadata, private token storage, provider preferences/sync runs, external leagues/teams, and roster cache. This is separate from the global ingestion credential. |
| Global ingestion credential | `web/lib/integrations/yahoo/globalCredentials.ts` | Sole active route owner for exact-column service-role reads, complete-row validation, and fail-closed refreshed-token persistence. The three active scheduled/manual routes import it; no browser route or public key owns global credentials. |
| Global game metadata and player keys | `web/lib/supabase/Upserts/Yahoo/yahooAPIgameIds.py` and `yahooApiPlayerKeys.py` | `yahoo_game_keys` and `yahoo_player_keys`; retained unscheduled maintenance alternatives with explicit `YFPY_*` compatibility configuration, not canonical credential or browser owners. |
| Matchup weeks | `/api/v1/db/update-yahoo-weeks` | Canonical normalized `yahoo_matchup_weeks`; the legacy game-key script still embeds week JSON and remains a consolidation gap. |
| Current Yahoo player detail | `/api/v1/db/update-yahoo-players` | Batches 25 keys, defensively normalizes Yahoo response shapes, and calls `upsert_yahoo_players_v3`; `yahooAPI.py` remains a legacy maintenance alternative. |
| Ownership history/backfill | `yahooHistoricalOwnership.py` plus the v3 RPC | `yahoo_player_ownership_history`/`yahoo_player_ownership_daily`; current UI trend code still reads `yahoo_players.ownership_timeline`, so normalized-history cutover remains open. |
| Draft history | Production-ledger migrations for `yahoo_player_draft_analysis_history` | Table/index exist, but the active v3 writer does not append this history and therefore is not a complete atomic latest+history owner. |
| Uniform numbers | Current player-detail payload plus `yahooUniformNumbers.py` | The standalone script remains a quarantined duplicate with historical path assumptions. |
| Yahoo ↔ NHL mapping | `player_name_normalization_spec.json`, `player_name_matcher.py`, `populate_yahoo_nhl_mapping.py`, and `generate_yahoo_identity_promotion.py` | Deterministic normalization/exact/alias/thresholded-fuzzy review feeds legacy map/unmatched objects and the service-role-only FHFH identity review/promotion contract. Draft Dashboard resolves current-game collisions fail closed. |
| Sheet export | `/api/internal/sync-yahoo-players-to-sheet` | Exact-cron-secret-only internal route called by the global player writer. |

## Current schema and migration evidence

Generated types contain `yahoo_api_credentials`, `yahoo_game_keys`, `yahoo_matchup_weeks`, `yahoo_names`, `yahoo_nhl_player_map`, `yahoo_nhl_player_map_unmatched`, `yahoo_player_draft_analysis_history`, `yahoo_player_keys`, `yahoo_player_ownership_daily`, `yahoo_player_ownership_history`, `yahoo_players`, `yahoo_positions`, and `yahoo_nhl_player_map_mat`. They also expose the legacy overloaded `upsert_players_batch`, active `upsert_yahoo_players_v3`, and the service-role Draft Ranker Yahoo initialization RPC.

The authoritative pre-baseline production ledger preserves the 2025 ownership/history/upsert migrations and the 2026 identity-review, approved-promotion, ownership-foundation, and Yahoo-seed migrations. The older `migrations/` and `web/supabase/migrations/` references in the source PRD are historical names; new schema work must use the canonical root and may not infer live state from the old PRD.

## Routes, schedules, and callers

- Active pg_cron: `update-yahoo-matchup-dates` at 07:20 UTC calls `/api/v1/db/update-yahoo-weeks?game_key=nhl`; `update-yahoo-players` at 08:40 UTC calls `/api/v1/db/update-yahoo-players?gameId=465`; `sync-yahoo-players-to-sheet` at 08:55 UTC calls the internal sheet route. Vault-backed callers already send the cron bearer.
- Manual global refresh: `/api/v1/db/manual-refresh-yahoo-token`; no static browser caller was found.
- Per-user routes: connect, callback, refresh, disconnect, and team-roster are authenticated owner-scoped account surfaces.
- Direct table/API consumers: Draft Dashboard processing and diagnostics; Draft Ranker discovery/community/export; Command Center ownership context; Start Chart; Player Pickup; team stats; True Goalie Value; Variance; projection administration; matchup-week hooks; ownership snapshots/trends; sheet synchronization; and cron reporting.

## Configuration and artifact boundary

Active global ingestion routes use `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the private `yahoo_api_credentials` row only through `globalCredentials.ts`; `CRON_SECRET` remains their caller-auth boundary. Per-user OAuth separately accepts server-only `YAHOO_CONSUMER_KEY`/`YAHOO_CONSUMER_SECRET` with `YFPY_*` compatibility. Unscheduled Python maintenance alternatives retain explicit `YFPY_*`/`YHO_*` configuration and bounded backfill controls, but are not canonical scheduled/global credential owners. The deleted token JSON remains absent and exactly ignored.

Tracked generated/review artifacts are the normalization spec, mapping TODO/reverse/unmatched JSON files, generated database types, production-ledger migrations, and focused migration/matcher tests. They are evidence or reviewed inputs, not permission to run a provider call, database write, promotion, or cleanup.

## Dependency graph

```text
global Yahoo credential -> game metadata -> matchup weeks
                        -> player keys -> player detail -> latest/history
                                                   \-> mapping/review -> FHFH identity
per-user OAuth token -> current Yahoo game -> leagues/teams/rosters -> account UI
FHFH identity + Yahoo latest fields -> Draft Dashboard / Draft Ranker / Start Chart
Yahoo ownership timeline -> ownership APIs -> Command Center and analytics consumers
```

## Current verified gaps

The current scan found: unauthenticated global maintenance routes (locally remediated, deployment proof pending); a now-removed public-key fallback in the Python mapping writer; non-atomic v3 latest/history behavior and an ambiguous legacy RPC overload; hard-coded/current-season and retry/completeness gaps in legacy ingestion; legacy/normalized mapping and ownership-history cutover drift; and two stale archived-migration test paths now repaired. Active global configuration/token persistence is consolidated and legacy Python alternatives are explicitly unscheduled/quarantined under closed NEW 9.4. The remaining gaps are owned by NEW 9.1/9.3/9.5/9.6/9.8 in the source list.

## Read-only production evidence — 2026-07-23

`yahoo_matchup_weeks` is the canonical normalized weeks store; embedded `yahoo_game_keys.game_weeks` is legacy read compatibility until lifecycle consolidation. Retention remains non-destructive: production contains 488,901 normalized ownership-history rows for 1,548 players (2024-10-04 through 2026-07-22), 32,017 daily rows for 1,333 players, and no draft-history rows.

Complete database-side aggregates reconcile 2,827 Yahoo players to 2,092 mapped and 735 unmapped, including 210/107 mapped/unmapped goalies and 1,882/628 skaters plus every team/display-position segment. The full 3,555-player NHL universe is 1,070 mapped and 2,485 unmapped across every position/team-id segment; the denominator includes 2,127 players with no current team or team `0`.

All Yahoo tables have RLS enabled. Credential storage has no browser policy; intended public datasets expose read-only policies, while service-role writers remain separate. Current security advisors found one Yahoo-specific P0: both legacy `upsert_players_batch` overloads and `upsert_yahoo_players_v3` are executable by browser roles, including a `SECURITY DEFINER` overload. Migration `20260723040553_restrict_legacy_yahoo_player_writers.sql` locally revokes `PUBLIC`/`anon`/`authenticated` execution and preserves `service_role`; production apply and live re-verification remain gated by NEW 9.8. The exposed `yahoo_nhl_player_map_mat` materialized view is already an intended public read surface, not a mutation path.
