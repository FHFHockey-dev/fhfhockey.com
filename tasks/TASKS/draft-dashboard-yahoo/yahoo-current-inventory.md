# Yahoo ingestion and identity inventory — 2026-07-22

## Ownership map

| Domain | Current owner | Persistence / consumer boundary |
| --- | --- | --- |
| Per-user OAuth, discovery, refresh, league/team sync | `web/lib/integrations/yahoo/{config,oauth,discovery,refresh,teamRoster}.ts` and `/api/v1/account/yahoo/*` | Owner-scoped connected-account metadata, private token storage, provider preferences/sync runs, external leagues/teams, and roster cache. This is separate from the global ingestion credential. |
| Global ingestion credential | `web/lib/integrations/yahoo/globalCredentials.ts` | Sole active route owner for exact-column service-role reads, complete-row validation, and fail-closed refreshed-token persistence. The three active scheduled/manual routes import it; no browser route or public key owns global credentials. |
| Global game metadata and player keys | `/api/v1/db/update-yahoo-weeks`, `yahoo_game_keys`, and `/api/v1/db/update-yahoo-players` | The TypeScript metadata/week route discovers the current Yahoo NHL identity, atomically versions metadata plus normalized weeks, and updates the compatibility JSON only from that complete snapshot. The player route selects that catalog scope and completely pages/reconciles Yahoo keys. Old Python game/key scripts remain unscheduled compatibility paths pending final retirement. |
| Matchup weeks | `/api/v1/db/update-yahoo-weeks` plus `replace_yahoo_game_weeks_snapshot` | Canonical normalized `yahoo_matchup_weeks` is exact-replaced only after complete validation; the embedded game-key JSON is transaction-owned compatibility output rather than an independent writer. |
| Current Yahoo player detail | `/api/v1/db/update-yahoo-players` | Discovers the newest database-owned NHL game unless an explicit maintenance override is supplied, validates overrides against that catalog, completely pages Yahoo player keys and stable-order active Supabase keys, then batches detail reads by 25 with transient retry and complete/partial telemetry. Applied migration `20260725220704` supplies the atomic versioned key-snapshot boundary; migrations `20260723113533` and `20260725200808` provide the applied service-role-only latest/ownership/draft writer. `yahooAPI.py` remains an explicit-write opt-in compatibility path. |
| Ownership history/backfill | `yahoo_player_ownership_history` plus the atomic writer | Canonical daily history retains stable player/date identity. Local migration `20260725235646` exposes one read-only security-invoker compatibility view. Its premature consumer publication produced Production `42P01`; named UI/API/export readers are locally restored to `yahoo_players` until migration-first application and reader-parity proof. |
| Draft history | Production-ledger migrations for `yahoo_player_draft_analysis_history` | Table/index exist, but the active v3 writer does not append this history and therefore is not a complete atomic latest+history owner. |
| Uniform numbers | Current player-detail payload | The scheduled TypeScript pipeline is authoritative. `yahooUniformNumbers.py` is an unscheduled opt-in maintenance fallback with no machine path/current ID default or import-time client; it requires explicit maintenance, game, league, and server credential configuration. |
| Yahoo ↔ NHL mapping | Canonical FHFH external identities plus legacy `yahoo_nhl_player_map` compatibility rows | Deterministic exact/manual/alias stages precede thresholded fuzzy matching; ambiguous candidates use explicit evidence and ties remain unresolved. The 1,857 legacy rows are all distinct but contain 771 repeated Yahoo/NHL ID pairs and 12 null Yahoo IDs, so they are not assigned a fabricated unique key. Predeploy migration `20260726000603` adds the security-invoker base-table view; its consumers are locally restored to `yahoo_nhl_player_map_mat` after Production proved the view absent. Final cache-read retirement follows migration-first deployed parity while service refresh ownership remains unchanged. |
| Sheet export | `/api/internal/sync-yahoo-players-to-sheet` | Exact-cron-secret-only internal route awaited by the global player writer only after an exact complete provider/persistence receipt. Candidate scheduler migration `20260730091500` deactivates the duplicate standalone sheet job. |

## Current schema and migration evidence

Generated types contain `yahoo_api_credentials`, `yahoo_game_keys`, `yahoo_matchup_weeks`, `yahoo_names`, `yahoo_nhl_player_map`, `yahoo_nhl_player_map_unmatched`, `yahoo_player_draft_analysis_history`, `yahoo_player_keys`, `yahoo_player_ownership_daily`, `yahoo_player_ownership_history`, `yahoo_players`, `yahoo_positions`, and `yahoo_nhl_player_map_mat`. They also expose the legacy overloaded `upsert_players_batch`, active `upsert_yahoo_players_v3`, and the service-role Draft Ranker Yahoo initialization RPC.

The authoritative pre-baseline production ledger preserves the 2025 ownership/history/upsert migrations and the 2026 identity-review, approved-promotion, ownership-foundation, and Yahoo-seed migrations. The older `migrations/` and `web/supabase/migrations/` references in the source PRD are historical names; new schema work must use the canonical root and may not infer live state from the old PRD.

## Routes, schedules, and callers

- Current Production pg_cron reflects the applied scheduler-ownership migration: `update-yahoo-matchup-dates` (job 233) remains active at 07:20 UTC, `update-yahoo-players` (job 106) remains active at 08:40 UTC without a fixed-game override, and duplicate standalone `sync-yahoo-players-to-sheet` (job 251) is inactive. The player route owns receipt-gated export. Vault-backed callers already send the cron bearer; sheet failures return/log fixed value-free copy.
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
Yahoo normalized ownership history -> staged compatibility view -> migration-first cutover -> ownership APIs, Draft surfaces, Start Chart, and analytics consumers
Yahoo/NHL base mapping -> staged security-invoker view -> migration-first cutover -> projections, ownership, Draft, and variance consumers
```

## Current verified gaps

Guarded recovery `96ccea804` is READY/Production as `dpl_HCFwiK4yAPeXUG3QzC3R28NtYvsc`. Populated Start Chart API and exact 1440×900/390×844 browser proof pass; ownership trends returns structured 200, and Variance, Player Pickup/Game Grid, Command Center, and projections surfaces render without application errors. Deployment-scoped runtime-error/5xx queries are empty. This closes P1 NEW 9.14 without applying a migration or invoking a writer; migration-first normalized cutover remains under NEW 9.6.

The current scan found and contained public-key and dry-analysis mutation paths in the Python mapping writer; Production's non-atomic v3 latest/history behavior and ambiguous legacy RPC overload; fixed live scheduling plus provider-pagination/deactivation/change-detection gaps in legacy ingestion; legacy/normalized mapping and ownership-history cutover drift; and recurrent stale archived-migration fixture paths now repaired. Exact Production `dpl_2DyH68oEiUhfsakGfRcHMAFdmumA` additionally proved the normalized readers were published before their migrations, making Start Chart return 500; P1 NEW 9.14 records the violation and a local legacy-reader recovery. Active global configuration/token persistence is consolidated, all active global provider calls share bounded retry telemetry, mapping ambiguity is deterministic and evidence-scored, and legacy Python alternatives are explicitly unscheduled/quarantined. The repaired service-role-only atomic detail replacement is applied and passes value-free latest/omission, ownership/draft idempotency, forced late-failure rollback, privilege, and zero-residue proof. Local metadata/week and key lifecycle candidates now provide complete provider validation, locked versioned exact-scope replacement, physical no-DML replay, safe absence removal/deactivation, and exact receipts; Production application, one controlled provider run, scheduler cutover, and final legacy Python retirement remain open.

Read-only Production key evidence on 2026-07-25 proves 2,827/2,827 rows use exact `<game>.p.<player>` syntax, split only across game 453 (1,333) and game 465 (1,494). This validates the candidate generated game-scope column without implying migration application.

## Read-only production evidence — 2026-07-23

`yahoo_matchup_weeks` is the canonical normalized weeks store; embedded `yahoo_game_keys.game_weeks` is legacy read compatibility until lifecycle consolidation. Retention remains non-destructive: production contains 488,901 normalized ownership-history rows for 1,548 players (2024-10-04 through 2026-07-22), 32,017 daily rows for 1,333 players, and no draft-history rows.

Complete database-side aggregates reconcile 2,827 Yahoo players to 2,092 mapped and 735 unmapped, including 210/107 mapped/unmapped goalies and 1,882/628 skaters plus every team/display-position segment. The full 3,555-player NHL universe is 1,070 mapped and 2,485 unmapped across every position/team-id segment; the denominator includes 2,127 players with no current team or team `0`.

All Yahoo tables have RLS enabled. Credential storage has no browser policy; intended public datasets expose read-only policies, while service-role writers remain separate. The exact ordered predeploy migrations `20260723040553`, `20260723113533`, `20260725200808`, `20260725220704`, `20260725235646`, and `20260726000603` are now present in the connected Production ledger; the writer RPCs remain browser-denied/service-role-only, and the normalized reader/read-surface ACL contract is applied. The separately classified postdeploy migration `20260731022805` remains absent and may run only after populated normalized-reader parity. The 1,857-row legacy map remains intentionally without a guessed key because 771 ID pairs repeat across distinct full rows and 12 rows lack a Yahoo ID. NEW 9.6 remains open for the provider/runtime, populated cutover parity, and separately gated postdeploy retirement/advisor proof.
