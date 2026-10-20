# D4 Data API grants: migrations 89–90, isolated receipt and grant-to-caller list

2026-10-20, Claude (ticket D4, Chef local_60e96358). **Local source only. Nothing was applied to a hosted
project, and no migration command or production call was run.** Hosted apply of each migration needs
TJ's separate explicit approval.

## Migrations

| Order | File | What it does |
| --- | --- | --- |
| 89 | `supabase/migrations/20261020224500_data_api_explicit_default_privileges.sql` | Revokes the baseline's replayable `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public` (ALL on tables, sequences and functions to anon, authenticated and service_role), plus postgres's global PUBLIC EXECUTE on new functions. History is untouched; objects created from here on get nothing until granted. |
| 90 | `supabase/migrations/20261020224600_data_api_reviewed_object_grants.sql` | Resets PUBLIC/anon/authenticated/service_role ACLs on the reviewed 76 tables, 1 sequence and 46 RPCs, then grants exactly what traced callers use. Narrows only. RLS, policies and function bodies are unchanged. |

Ledger: orders 89–90 in `migration-authority.json` (`pending`, `security`). The ticket said use 92+ unless
the ledger says otherwise. The ledger test requires order = index + 1, so these take 89–90 and IFTTT SQL6–8 move to
91–93. Their drafts already grant explicitly, including service_role, so they work after 89.
`supportedBaselineMigration.test.ts` counts 88→90 rows and 3→5 pending; the super-goal summary line it
pins was updated to match.

## Review of Codex's proposal (what changed and why)

Kept: the overall shape (future defaults revoked for postgres; per-object REVOKE ALL then explicit GRANT);
browser denial everywhere except provider-linkage owner SELECT; FORGE, line and forecast tables server-only;
native head SELECT plus CAS EXECUTE; RSO saved plans server-only; and every RPC service-only with no PUBLIC.

Narrowed after the caller audit (no caller uses these privileges):
- **Provider linkage:** service_role ALL → SELECT, INSERT, UPDATE, DELETE. `provider_sync_runs` drops DELETE too; its only delete runs inside a DEFINER RPC.
- **Draft Pro:** CRUD → only the operations used directly. Every other write goes through SECURITY DEFINER RPCs. `private_import_blobs`, `private_import_uploads` and `save_sessions` get no service_role table grant.
- **In-season:** `in_season_grants` → SELECT; `in_season_workspaces` → SELECT, INSERT, UPDATE.
- **Forecast tables:** `season_release_teams` and `season_team_aggregates` go ALL → SELECT, INSERT. Their reject-mutation triggers make UPDATE and DELETE dead, and TRUNCATE would bypass those triggers. `season_runs` goes ALL → SELECT, INSERT, UPDATE.
- **`champion_history` and `season_completeness_waivers`:** SELECT only. Nothing inserts into them, except the uncalled promote RPC on `champion_history`.
- **`promote_player_forecast_model_atomic`:** service EXECUTE revoked; the function has no caller.
- **`roster_optimizer_team_games_id_seq`:** USAGE, SELECT → USAGE. The upsert omits `id`; nothing reads the sequence directly.

Kept although no app code uses it: anon and authenticated SELECT on `roster_optimizer_team_games`. It is the
deliberate public-read grant and policy from 20260829161013, so revoking it is a product decision for TJ.

Not adopted: an automatic replacement default for service_role. This matches Supabase's 2026-10-30
posture for anon, authenticated and service_role
([announcement](https://github.com/orgs/supabase/discussions/45329)).

## Every grant and its caller (after migration 90)

All app callers below use service_role (`web/lib/supabase/server.ts`, or `req.supabase` after
`adminOnly` / `withOperationalRouteAuth` / `playerForecast*Only`), except the authenticated browser client
(`web/lib/supabase/client.ts`). Paths are under `web/`. "INVOKER" means a SECURITY INVOKER SQL function
running as service_role.

| Object(s) | Role: privileges | Caller |
| --- | --- | --- |
| connected_accounts, external_leagues, external_teams, provider_sync_runs | authenticated: SELECT (owner RLS) | `components/account/AccountSettingsPage.tsx:872,880,1025-1049`; `RosterScheduleOptimizer.tsx:446` |
| connected_accounts | service: S I U D | `pages/api/v1/account/yahoo/callback.ts:35,58`; `yahoo/disconnect.ts:37`; `lib/integrations/patreon/sync.ts:202,612`; `yahoo/refresh.ts:208` |
| external_leagues / external_teams | service: S I U D (upsert DO UPDATE) | `lib/integrations/yahoo/discovery.ts:458,515,572,582`; `fantrax/manualImport.ts:762,831`; `fantrax/server.ts:594,662`; `yahoo/liveDraftServer.ts:554,585`; `yahoo/teamRoster.ts:298` |
| provider_sync_runs | service: S I U | `lib/integrations/yahoo/refresh.ts:167,182`; `patreon/sync.ts:420`; `fantrax/server.ts:749`; `espn/server.ts:1199`; INVOKER `apply_yahoo_draft_snapshot` reads it |
| draft_pro_access_code_attempts, draft_pro_access_codes | service: S | `scripts/draft-pro/verify-access-codes-runner.ts:84,113` (writes are DEFINER RPCs) |
| draft_pro_drafts | service: S | `lib/draft-pro/account/index.ts:96`; `lib/draft-pro/scenariosServer.ts:37` |
| draft_pro_private_imports | service: S U | `lib/draft-pro/account/index.ts:101`; `scenariosServer.ts:40`; `scripts/draft-pro/verify-scenarios-routes-runner.ts:115` (U) |
| draft_pro_provider_events | service: S I U | `lib/integrations/patreon/sync.ts:957,981,989,996`; `lib/draft-pro/account/index.ts:115` |
| draft_pro_purchases | service: S U | `lib/integrations/stripe/checkout.ts:39`; `pages/api/v1/account/draft-pro/checkout/verify.ts:39`; `lib/draft-pro/account/refunds.ts:95` |
| draft_pro_refund_requests | service: S I U | `lib/draft-pro/account/refunds.ts:73,113,148,214` |
| draft_pro_reports / draft_pro_scenarios | service: S I | `pages/api/v1/account/draft-pro/reports/index.ts:24,35,54`; `scenarios/index.ts:20,38` |
| draft_pro_private_import_blobs, _uploads, draft_pro_save_sessions | none | DEFINER RPCs only |
| in_season_grants | service: S | `lib/in-season/server.ts:33` |
| in_season_workspaces | service: S I U | `pages/api/v1/roster-schedule-optimizer/workspace.ts` (insert/update with user_id, context and lock_version); `diagnostic-context.ts:64` |
| roster_optimizer_team_games | service: S I U D | `lib/rosterScheduleData/persistence.ts:130` (upsert DO UPDATE), `:152` (delete); readers in `schedule.ts`, `draft-pro/dust.ts`, `planningInputs.ts`, `issuedContext.ts`, `scopeReads.ts` |
| roster_optimizer_team_games | anon, authenticated: S | none in app; deliberate public-read grant (flagged above) |
| roster_optimizer_team_games_id_seq | service: USAGE | identity default on the upsert (rows omit `id`) |
| forge_game_revisions | service: S I | `lib/projections/starterBoardDataset.ts:153`, `player-forecasts/orchestration.ts:209`; INVOKER `publish_forge_game_revisions` |
| forge_final_pregame_revisions | service: S I | `starterBoardDataset.ts:150`; INVOKER `freeze_starter_board_pregame` |
| forge_game_selection_events | service: S I | INVOKER `select_starter_board_revision`, `read_forge_game_revisions` |
| forge_board_news_events / _visibility_observations / _dispatch_observations | service: S I | `lib/projections/acceptedNews.ts:23`; INVOKER enqueue/record triggers and RPCs (`starter-board-release.ts`) |
| line_source_captures, line_claim_revisions, line_claim_relations, line_game_state_observations | service: S I | `lib/lines/storage.ts:11-41` (upsert ignoreDuplicates); `lib/lines/service.ts:24` |
| line_entry_revisions, line_pp_decisions | service: S I | `lib/lines/storage.ts:47-55`; INVOKER `append_line_decisions` |
| native_forecast_catalog_heads | service: S | `lib/player-forecasts/nativeCatalogHead.ts:56`; `forecastServingSource.ts:46` (writes only via CAS) |
| player_forecast_inference_queue | service: S I U | `pages/api/v1/player-forecasts/jobs/retry.ts:14`; INVOKER enqueue/claim/finish |
| player_forecast_runs | service: S I U | `lib/player-forecasts/orchestration.ts:431,471` |
| player_forecast_season_active_releases | service: S I U | `lib/fantasy-projections/queries.ts:105`; INVOKER publish/rollback (DO UPDATE) |
| player_forecast_season_queue | service: S I U | `lib/fantasy-projections/seasonJobs.ts:1113`; INVOKER enqueue/claim/finish/compact |
| player_forecast_season_runs | service: S I U | `seasonJobs.ts:880,1148`; `admin.ts:780,1174` (update); INVOKER clone/create |
| player_forecast_champion_history, _season_completeness_waivers | service: S | `lib/player-forecasts/readiness.ts:28`; `lib/fantasy-projections/admin.ts:1027` |
| 37 other player_forecast_* tables (migration 90 `grant select, insert` list) | service: S I | append-only writers in `lib/player-forecasts/*`, `lib/fantasy-projections/*`, `scripts/import-player-forecast-season*.ts`, and INVOKER publish/clone/capture functions. Per-table evidence is in the audit appendix, section 4. |
| 45 RPCs (migration 90 `grant execute` list) | service: EXECUTE | each `.rpc()` caller. Nested-only: clone/create season run and inherit assumptions (from `*_with_assumptions`), `enqueue_player_forecast_job` (trigger), `*_secure` token RPCs (also DEFINER commits). Per-RPC evidence is in the audit appendix, section 7. |
| promote_player_forecast_model_atomic | none | no caller |

Audit appendix: the full per-object evidence is copied to [`caller-audit.md`](caller-audit.md).

## Isolated proof

Harness: [`harness.py`](harness.py), [`bootstrap.sql`](bootstrap.sql), [`pgtap-shim.sql`](pgtap-shim.sql).
- **Cluster:** a fresh `initdb` Homebrew PostgreSQL **17.11**, reachable only over a Unix socket, run under `/private/tmp/fhfh-heavy.lock`, and deleted afterwards. No Docker runtime exists on this Mac, so this is not a Supabase stack. The configured major is 15.
- **Replay:** the bootstrap, then all ledger migrations in order. No platform auto-grants exist here, so the replay's only defaults are the baseline's own.
- **Receipted deviations:**
  - Six unavailable extensions (`http`, `pg_cron`, `pg_net`, `pgjwt`, `pgsodium`, `supabase_vault`) are stripped from the baseline and replaced with schema stand-ins.
  - The PG17 view-deparse md5 guard in `20260731040341` is skipped.
  - Synthetic cron rows are seeded before `20260909161959`, which asserts that production jobs exist.
- **pgTAP:** not installed (no dependency install), so the shim implements `no_plan`, `ok`, `throws_ok`, `lives_ok`, `results_eq` and `finish`.

| Run | Purpose | Result |
| --- | --- | --- |
| [run-v5](run-v5/) | 88-file chain only, baseline ACL snapshot | replay clean |
| [run-v7](run-v7/receipt.json) | chain + 89 + 90, reapply, tests | **passed**. Reapply idempotent (identical ACL snapshots). `data_api_grants_claude.sql` 205/205; Codex defaults 34/34; Codex RSO isolation 10/10; existing `in_season_access_workspace.sql` exit 0; Codex matrix 1804/1870, with all 66 failures being the reviewed narrowings above, each pinned to the opposite answer in `data_api_grants_claude.sql` (the harness fails on any other failure) |
| [run-v8](run-v8/receipt.json) | negative control: tests without 89/90 | fails as intended. Claude 121 not-ok, Codex defaults 34 not-ok, Codex matrix 72 not-ok. RSO isolation already held before D4 (in-season migration). |

ACL delta, v7 before → after: 174 privilege entries removed. These are all postgres public default entries for the three roles, plus service_role extras on 27 tables and one RPC. One entry was added: the global postgres function default, which now lists only the owner. No grant was added to any role.

`data_api_grants_claude.sql` covers:
- **Native head:** service CAS create, advance and stale-conflict (40001); direct service INSERT, UPDATE and DELETE denied; anon and authenticated denied on both the table and CAS EXECUTE.
- **Provider linkage:** user A sees only their own row; forged writes and the token RPC are denied; anon is denied.
- **RSO schedule:** service writes through the identity column; browser reads; browser writes and sequence use denied; `setval` denied to service.
- **TRUNCATE:** denied on FORGE, Draft Pro and saved plans.
- **Future objects:** a new public table and serial sequence carry no grants; a new postgres function in another schema has no PUBLIC EXECUTE; an explicit grant restores exactly the granted operation.

Not covered: real PostgREST/JWT HTTP calls; PG15-specific behaviour; hosted ACLs, which may differ from the replay but converge because every reviewed object is reset first; and `analytics`/`graphql_public` objects and the other ~470 public relations, which keep their existing grants.

## Follow-ups for the Chef

1. Product decision: keep or revoke the unused anon/authenticated SELECT on `roster_optimizer_team_games`.
2. `pages/api/v1/db/refresh-roster-optimizer-schedule.ts:93` calls `rpc("commit_recurring_roster_schedule")`, which no canonical migration defines. Its only definition is a draft in `tasks/artifacts/schedule-refresh-recurring-2026-10-15/`. If it exists in production, that is schema drift outside the ledger.
3. 178 public relations still give anon and authenticated full write privileges from the baseline. Existing grants survive Oct 30, so this is out of D4's scope, but it is the largest remaining exposure.
4. Before hosted apply: a read-only check of live `pg_default_acl` and the reviewed ACLs, then apply 89 before 90 (each needs TJ approval).
