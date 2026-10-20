# D4 caller audit: who touches the 123 objects, and with which privileges

Read-only audit of `/Users/tim/Code/fhfhockey.com` working tree, 2026-10-20. Scope: web/, functions/, cms/. There is no webhooks/ dir. modeling/ only names tables in bundles and has no DB client. Tests and generated types are excluded. Paths are relative to `web/` unless they start with `supabase/`. Line numbers are from the current working tree, which is being edited at the same time (for example, `workspace.ts` lines moved during the audit).

## 0. Client map (web/lib/supabase)

| client | built with | role at PostgREST |
|---|---|---|
| `lib/supabase/server.ts` (default `serviceRoleClient` proxy, `getServiceRoleClient()`) | `SUPABASE_SERVICE_ROLE_KEY` | **service_role** |
| `lib/supabase/client.ts` (also re-exported as the default of `lib/supabase/index.ts`) | public key, `persistSession:true` (browser) | **authenticated** when signed in, otherwise anon |
| `lib/supabase/public-client.ts`, `serverReadonly.ts` | public key, no session | anon |
| `createClientWithToken()` (`lib/supabase/index.ts:19`) | public key + user bearer | authenticated. Used only for `auth.getUser` and the `users.role` lookup (`utils/adminOnlyMiddleware.ts:32`, `lib/api/requireApiUser.ts:33`, `utils/playerForecastSeasonEditorOnlyMiddleware.ts:68`, `pages/api/v1/player-forecasts/conflicts.ts:23`, draft-ranker/community.ts). **It never touches any audited object.** |
| `adminOnly` / `withOperationalRouteAuth` / `playerForecastAdminOnly` / `playerForecastSeasonEditorOnly` | set `req.supabase = serviceRoleClient` after auth | service_role |

Every server lib that touches these objects either imports `lib/supabase/server` or receives `req.supabase` or `serviceRoleClient` from a route wrapper listed above. Only 4 browser files touch audited tables, all through `lib/supabase/client`: `components/account/AccountSettingsPage.tsx`, `components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx`, `FantraxImportPanel.tsx` and `PatreonConnectionPanel.tsx` (the last two use types only). No anon client touches any audited object. `scripts/verify-player-forecast-local-acceptance.ts:82` is a local negative probe that expects anon SELECT on `player_forecast_outputs` to be denied.

**Global findings:**
- **TRUNCATE:** no TRUNCATE of any audited table in TS or SQL. The only SQL TRUNCATEs are on `rolling_player_*` in the baseline (line 5172).
- **REFERENCES / TRIGGER:** none found. No views reference these tables, and creating foreign keys or triggers is migration-owner work.
- **upsert:** every PostgREST upsert in this table set uses `ignoreDuplicates:true`, which becomes `ON CONFLICT DO NOTHING` and needs INSERT only. There are exactly two exceptions:
  - the provider-linkage tables (`external_leagues`, `external_teams`)
  - `roster_optimizer_team_games`

  Those need INSERT+UPDATE.

### Immutability triggers

`fhfh_internal.reject_player_forecast_mutation()` and `public.reject_line_evidence_mutation()` run BEFORE UPDATE OR DELETE and raise an exception. They are on:
- all 14 player_forecast foundation tables except `inference_queue`, `runs`, `champion_history` and `rest_of_season_outputs` (`20260802163747`:415-438)
- 19 season-v3 tables, including `release_teams` and `team_aggregates` (`20260813001304`:589-614)
- `forge_game_revisions` (`20260916012353`:23)
- the 5 `forge_board_*`, `forge_final_pregame_revisions` and `forge_game_selection_events` tables (`20260916023000`:47-53)
- all 6 `line_*` tables (`20261002134400`:63-69)

UPDATE or DELETE on those tables can never succeed, so granting them does nothing. A granted TRUNCATE would bypass these row triggers.

## 1. Provider linkage: connected_accounts, external_leagues, external_teams, provider_sync_runs

| object | client(s) | ops used | evidence | needed grant | verdict |
|---|---|---|---|---|---|
| connected_accounts | **authenticated (browser)**; service_role (server) | auth: SELECT. svc: SELECT, INSERT(+RETURNING), UPDATE(+RETURNING), DELETE | auth: `components/account/AccountSettingsPage.tsx:880` (head count), `:1025` (`select *`). svc: `pages/api/v1/account/yahoo/callback.ts:35` update+select, `:58` insert+select; `pages/api/v1/account/yahoo/disconnect.ts:37` delete; `lib/integrations/patreon/sync.ts:202` insert, `:612`/`:852` delete; `lib/integrations/yahoo/refresh.ts:208` update | auth SELECT; svc SELECT, INSERT, UPDATE, DELETE | Applied `supabase/migrations/20261019052934_restrict_provider_linkage_browser_writes.sql` already matches (auth SELECT only; owner `_select_own` policy kept). |
| external_leagues | **authenticated (browser)**; svc | auth: SELECT. svc: SELECT, upsert ON CONFLICT DO UPDATE (+RETURNING), UPDATE, DELETE | auth: `AccountSettingsPage.tsx:872`, `:1031`; `RosterScheduleOptimizer.tsx:446` (embedded `external_leagues!…(league_name)`). svc: `lib/integrations/yahoo/discovery.ts:458` upsert onConflict `connected_account_id,…` (no ignoreDuplicates), `:582` delete; `lib/integrations/fantrax/manualImport.ts:762` upsert; `lib/integrations/fantrax/server.ts:594` update; `lib/integrations/yahoo/liveDraftServer.ts:554` update | auth SELECT; svc SIUD | same |
| external_teams | **authenticated (browser)**; svc | auth: SELECT. svc: SELECT, upsert DO UPDATE, UPDATE, DELETE | auth: `AccountSettingsPage.tsx:1037`; `RosterScheduleOptimizer.tsx:446`. svc: `lib/integrations/fantrax/server.ts:662` upsert, `lib/integrations/fantrax/manualImport.ts:831` upsert, `lib/integrations/yahoo/discovery.ts:515` upsert, `:572` delete; `lib/integrations/yahoo/teamRoster.ts:298` update; `lib/integrations/yahoo/liveDraftServer.ts:585` update | auth SELECT; svc SIUD | same |
| provider_sync_runs | **authenticated (browser)**; svc | auth: SELECT. svc: SELECT, INSERT(+RETURNING), UPDATE. **No direct DELETE.** | auth: `AccountSettingsPage.tsx:1049`. svc: `lib/integrations/yahoo/refresh.ts:182` insert+select, `:167` update; `lib/integrations/patreon/sync.ts:420`, `lib/integrations/fantrax/server.ts:749`, `lib/integrations/yahoo/liveDraftServer.ts:750` insert; `lib/integrations/espn/server.ts:1199` update | auth SELECT; svc SIU | svc DELETE has no direct caller. The only DELETE is inside DEFINER `commit_fantrax_connection_secure`. |

SQL writers, all SECURITY DEFINER (so caller grants do not matter):
- `commit_espn_connection_secure`: connected_accounts I/U + FOR UPDATE; external_* INSERT ON CONFLICT DO UPDATE
- `commit_fantrax_connection_secure`: also DELETE external_*, DELETE provider_sync_runs
- `disconnect_espn_account_secure`, `disconnect_fantrax_account_secure`: DELETE connected_accounts
- `delete_espn_league_secure`: DELETE external_leagues
- `claim_espn_sync_lease`: provider_sync_runs I/U
- `apply_espn_settings_secure`, `apply_fantrax_settings_secure`: read only

`apply_yahoo_draft_snapshot` is SECURITY INVOKER and reads external_teams and provider_sync_runs, so service_role needs SELECT. It writes only `yahoo_draft_*`.

**Verdict 1.**
- **Authenticated SELECT:** yes, used, on all 4 tables. Keep it. It comes from the signed-in browser client with owner RLS.
- **Anon:** no caller on any of the 4 tables.
- **service_role TRUNCATE/REFERENCES/TRIGGER:** none needed.
- **service_role needs:** SELECT, INSERT, UPDATE, DELETE on connected_accounts, external_leagues and external_teams; SELECT, INSERT, UPDATE on provider_sync_runs. DELETE on provider_sync_runs is unused.

## 2. roster_optimizer_team_games and its id sequence

| object | client(s) | ops used | evidence | needed grant | verdict |
|---|---|---|---|---|---|
| roster_optimizer_team_games | **service_role only** | SELECT; upsert ON CONFLICT DO UPDATE (rows have **no `id`**); DELETE | write: `lib/rosterScheduleData/persistence.ts:130` upsert onConflict `ROSTER_SCHEDULE_UPSERT_CONFLICT` (no ignoreDuplicates), `:152` delete; called from `pages/api/v1/db/update-roster-optimizer-schedule.ts:523`/`:535` with `req.supabase` (withOperationalRouteAuth → adminOnly → service). Reads (all service): `pages/api/v1/roster-schedule-optimizer/schedule.ts:28`, `pages/api/v1/draft-pro/dust.ts:76`/`:119`, `lib/draft-pro/scenariosServer.ts:15`, `pages/api/v1/start-chart.ts:959` → `lib/rosterScheduleData/planningInputs.ts:130`, `lib/projections/issuedContext.ts:73`, `lib/player-forecasts/scopeReads.ts:132`, cron `pages/api/v1/db/cron/update-roster-optimizer-schedule-daily.ts:95`, `pages/api/v1/db/refresh-roster-optimizer-schedule.ts:76` | svc SELECT, INSERT, UPDATE, DELETE; anon/auth: none | **anon SELECT and authenticated SELECT have no app caller.** `RosterScheduleOptimizer.tsx:79,682` only compare the string `"roster_optimizer_team_games"`. Revoking them would not break app code. Migration `20260829161013`:86 grants them on purpose, with the `roster_optimizer_team_games_public_read` policy, so revoking is a product decision. |
| roster_optimizer_team_games_id_seq | service_role | nextval through the column default, on every upsert attempt (rows omit `id`: `lib/rosterScheduleData/normalize.ts:169-203`) | `persistence.ts:130`; verification scripts POST without id (`scripts/draft-pro/verify-reports-routes-runner.ts:70`) | svc USAGE (SELECT not needed) | No explicit `nextval`/`setval` anywhere. Migration grants `usage, select` (`20260829161013`:90). |

`pages/api/v1/db/refresh-roster-optimizer-schedule.ts:93` calls `rpc("commit_recurring_roster_schedule")`. That RPC is **not in supabase/migrations**; its only definition is `tasks/artifacts/schedule-refresh-recurring-2026-10-15/database-prerequisite.sql`. It is SECURITY INVOKER and does `INSERT … ON CONFLICT (game_key,source_game_id,team_id) DO UPDATE` (lines 49-121). If it is installed in prod, service_role needs INSERT+UPDATE on the table plus USAGE on the sequence. The table has a trigger `roster_optimizer_team_games_set_updated_at` → `touch_updated_at` (modifies NEW only).

**Verdict 2:** the anon/authenticated SELECT is used only through server APIs that run as service_role. No browser, anon or user-JWT client reads the table.

## 3. FORGE and line tables (question: does narrowing service_role to SELECT,INSERT break anything?)

All the SQL writers below are SECURITY INVOKER, so service_role needs INSERT on the target table. Every insert is a plain INSERT or `ON CONFLICT DO NOTHING`. There is no UPDATE, DELETE, upsert-with-update or FOR UPDATE on these tables anywhere, and all of them carry the immutability trigger.

| object | client(s) | ops used | evidence | proposal | verdict |
|---|---|---|---|---|---|
| forge_game_revisions | svc | SELECT direct; INSERT through INVOKER `publish_forge_game_revisions` (DO NOTHING) | `lib/projections/starterBoardDataset.ts:153`, `lib/player-forecasts/orchestration.ts:209`, `lib/player-forecasts/readiness.ts:164`, `scripts/run-forge-local.ts:234`; rpc `lib/projections/gameRevisions.ts:172`; reads in INVOKER `read_forge_game_revisions`, `select_starter_board_revision`, `read_starter_board_operational_events`, `inspect_forge_local_attempt` | SELECT,INSERT | OK |
| forge_final_pregame_revisions | svc | SELECT; INSERT through INVOKER `freeze_starter_board_pregame` (DO NOTHING) | `lib/projections/starterBoardDataset.ts:150`, `lib/player-forecasts/evaluation.ts:315`; rpc `pages/api/internal/starter-board.ts` | SELECT,INSERT | OK |
| forge_game_selection_events | svc | SELECT (through INVOKER `read_forge_game_revisions`); INSERT through INVOKER `select_starter_board_revision` (+RETURNING) | rpc `pages/api/v1/db/starter-board-release.ts` (adminOnly); `lib/rosterScheduleData/planning.ts:149`, `lib/projections/gameRevisions.ts:195` | SELECT,INSERT | OK |
| forge_board_news_events | svc | SELECT direct; INSERT by INVOKER triggers `enqueue_starter_board_observation` and `enqueue_starter_board_resolution` (DO NOTHING) on inserts into lineup_snapshots, goalie_start_observations and conflict_resolutions | `lib/projections/acceptedNews.ts:23`; triggers `20260916014510`:58-71 | SELECT,INSERT | OK |
| forge_board_visibility_observations | svc | SELECT through INVOKER `read_starter_board_operational_events`; INSERT through INVOKER `record_starter_board_visibility(_timed)` (DO NOTHING) | rpc `pages/api/v1/db/starter-board-release.ts` | SELECT,INSERT | OK |
| forge_board_dispatch_observations | svc | SELECT through operational-events RPC; INSERT by INVOKER trigger `record_starter_board_dispatch`, which fires AFTER UPDATE on `forge_game_update_queue` | `20260916023000`:86-96 | SELECT,INSERT | OK |
| line_source_captures | svc (`update-line-sources`, adminOnly) | upsert `ignoreDuplicates` | `lib/lines/storage.ts:11` | SELECT,INSERT | OK (SELECT used only by RLS and readiness, not by code) |
| line_claim_revisions | svc | upsert ignoreDuplicates; SELECT | `lib/lines/storage.ts:13`, `:20`, `:41` | SELECT,INSERT | OK |
| line_claim_relations | svc | upsert ignoreDuplicates | `lib/lines/storage.ts:33` | SELECT,INSERT | OK |
| line_game_state_observations | svc | upsert ignoreDuplicates; SELECT | `lib/lines/storage.ts:37`; `lib/lines/service.ts:24` | SELECT,INSERT | OK |
| line_entry_revisions | svc | SELECT; INSERT through INVOKER `append_line_decisions` | `lib/lines/storage.ts:47`, `:54`; rpc `:70` | SELECT,INSERT | OK |
| line_pp_decisions | svc | SELECT; INSERT through INVOKER `append_line_decisions` (DO NOTHING) | `lib/lines/storage.ts:55`; rpc `:70` | SELECT,INSERT | OK |

**Verdict 3:** narrowing to SELECT,INSERT breaks nothing. The migrations already grant exactly `select,insert` (`20260916012353`:22, `20260916023000`:50, `20261002134400`:67). Side note: the trigger `guard_starter_board_publication` does `SELECT … FOR UPDATE` on `forge_game_update_queue`, a table outside this list, so service_role must keep UPDATE on that queue.

## 4. player_forecast_* tables

All callers are service_role: `playerForecastAdminOnly` and `playerForecastSeasonEditorOnly` routes, cron, and scripts using `getServiceRoleClient`. `lib/player-forecasts/readiness.ts:46-60` probes SELECT on all 18 foundation tables, and `lib/fantasy-projections/readiness.ts` reads the season tables. INVOKER triggers matter here: `enqueue_player_forecast_observation` on goalie_start_observations and lineup_snapshots calls INVOKER `enqueue_player_forecast_job`, which does INSERT ON CONFLICT DO UPDATE on inference_queue. The season enqueue trigger is DEFINER.

| object | ops used (direct / through INVOKER SQL) | evidence | proposal | verdict |
|---|---|---|---|---|
| accountability_revisions | SELECT; INSERT only from the fixture seed script | `lib/player-forecasts/dashboard.ts:146`; `scripts/seed-player-forecast-fixtures.ts:362` (upsertIgnore) | S,I | OK. INSERT is used only by a local fixture seeder. |
| champion_history | SELECT (readiness probe) only. INSERT+UPDATE only inside INVOKER `promote_player_forecast_model_atomic`, **which has no app caller** | `lib/player-forecasts/readiness.ts:28` | S,I | **OVER-GRANT: INSERT has no caller.** Latent: if `promote_player_forecast_model_atomic` is ever called, it needs INSERT+UPDATE. The table has no immutability trigger. |
| conflict_members | SELECT, INSERT; INSERT through INVOKER `capture_starter_board_goalies` | `pages/api/v1/player-forecasts/conflicts.ts:40`; `lib/player-forecasts/sourceObservations.ts:274` | S,I | OK |
| conflict_resolutions | SELECT, INSERT(+RETURNING) | `pages/api/v1/player-forecasts/conflicts.ts:41`, `:103` | S,I | OK |
| evaluation_revisions | upsert ignoreDuplicates +RETURNING | `lib/player-forecasts/settlement.ts:488` | S,I | OK |
| feature_snapshots | upsert ignoreDuplicates; SELECT; INSERT | `lib/player-forecasts/serving.ts:283`, `:348`; `scripts/seed-player-forecast-serving-proof.ts:60` | S,I | OK |
| goalie_start_observations | SELECT, INSERT(+RETURNING); INSERT through INVOKER `capture_starter_board_goalies` (DO NOTHING) | `lib/player-forecasts/sourceObservations.ts:223`, `:412` | S,I | OK. Its INVOKER trigger needs I+U on inference_queue, which is granted. |
| inference_queue | UPDATE(+RETURNING) direct; INVOKER `enqueue_player_forecast_job` INSERT DO UPDATE; `claim_player_forecast_jobs` SELECT FOR UPDATE + UPDATE; `finish_player_forecast_job` UPDATE | `pages/api/v1/player-forecasts/jobs/retry.ts:14`; rpc `lib/player-forecasts/orchestration.ts:299`, `:491`, `:534` | S,I,U | OK |
| lineup_assignments | INSERT; INSERT through INVOKER `capture_starter_board_lineup` | `lib/player-forecasts/sourceObservations.ts:485` | S,I | OK |
| lineup_snapshots | SELECT, INSERT(+RETURNING); INVOKER capture (DO NOTHING) | `lib/player-forecasts/sourceObservations.ts:465`, `:475` | S,I | OK |
| model_artifacts | upsert ignoreDuplicates; SELECT | `lib/player-forecasts/serving.ts:150` (onConflict `id`, ignoreDuplicates at `:186`), `:406` | S,I | OK |
| observation_conflicts | SELECT, INSERT(+RETURNING); INVOKER capture | `lib/player-forecasts/sourceObservations.ts:245`, `:254`; `pages/api/v1/player-forecasts/send-conflict-review.ts:35` | S,I | OK |
| outcome_revisions | SELECT; upsert ignoreDuplicates +RETURNING | `lib/player-forecasts/settlement.ts:378`, `:446` | S,I | OK |
| outputs | SELECT; upsert ignoreDuplicates | `lib/player-forecasts/orchestration.ts:449` (ignoreDuplicates `:468`); `lib/player-forecasts/settlement.ts:355` | S,I | OK |
| rest_of_season_outputs | SELECT, INSERT | `lib/player-forecasts/restOfSeason.ts:90`, `:155` | S,I | OK |
| runs | INSERT(+RETURNING), SELECT, **UPDATE** | `lib/player-forecasts/orchestration.ts:431`, `:471` | S,I,U | OK |
| schedule_revisions | INSERT | `lib/player-forecasts/orchestration.ts:253` | S,I | OK |
| source_observations | SELECT, INSERT(+RETURNING); INSERT through INVOKER `begin_forge_local_run` | `lib/projections/gameRevisions.ts:156`; `lib/player-forecasts/contributionStore.ts:271`; `lib/player-forecasts/sourceSnapshot.ts:81` | S,I | OK |
| season_active_releases | SELECT direct; INVOKER publish and rollback: INSERT ON CONFLICT DO UPDATE | `lib/fantasy-projections/queries.ts:105`; rpc `lib/fantasy-projections/admin.ts:1215`, `:1284` | S,I,U | OK |
| season_artifacts | SELECT, INSERT | `scripts/import-player-forecast-season.ts:325`; `lib/fantasy-projections/seasonJobs.ts:479` | S,I | OK |
| season_completeness_waivers | **SELECT only** (direct and in INVOKER publish/create) | `lib/fantasy-projections/admin.ts:1027` (selectAll) | S,I | **OVER-GRANT: INSERT has no caller** |
| season_deployment_assignments | INSERT | `scripts/import-player-forecast-season.ts:595` | S,I | OK. SELECT is used only by the DEFINER enqueue trigger and readiness. |
| season_deployment_snapshots | SELECT, INSERT | `scripts/import-player-forecast-season.ts:546`, `:555` | S,I | OK |
| season_evaluation_revisions | upsert ignoreDuplicates; SELECT | `scripts/import-player-forecast-season-settlement.ts:361`; `lib/fantasy-projections/readiness.ts:112` | S,I | OK |
| season_game_outputs | INSERT (insertChunks); SELECT; INVOKER clone/create INSERT | `lib/fantasy-projections/seasonJobs.ts:1044`; `scripts/import-player-forecast-season.ts:504` (ignoreDuplicates helper `:160`) | S,I | OK |
| season_outcome_revisions | INSERT; SELECT | `scripts/import-player-forecast-season-settlement.ts:290`; `lib/fantasy-projections/seasonJobs.ts:548` | S,I | OK |
| season_overrides | SELECT, INSERT; INVOKER `inherit_player_forecast_season_assumptions` INSERT | `lib/fantasy-projections/admin.ts:837`, `:859` | S,I | OK |
| season_player_aggregates | SELECT; INSERT; INVOKER clone/create INSERT | `lib/fantasy-projections/seasonJobs.ts:1045`; `lib/fantasy-projections/admin.ts:669` | S,I | OK |
| season_player_pool_review | SELECT; INSERT; upsert ignoreDuplicates; INVOKER `resolve_player_forecast_season_identity` INSERT | `lib/fantasy-projections/rosterReconciliation.ts:627` (ignoreDuplicates); `scripts/import-player-forecast-season.ts:466`; `lib/fantasy-projections/identityResolution.ts:272` | S,I | OK |
| season_queue | SELECT direct; INVOKER enqueue INSERT DO UPDATE; claim FOR UPDATE + UPDATE; finish and compact UPDATE | `lib/fantasy-projections/seasonJobs.ts:1113`; rpc `:1181`, `:1281`, `:581`; `scripts/compact-player-forecast-season-local-queue.ts:25` | S,I,U | OK |
| season_release_events | INSERT through INVOKER publish and rollback; SELECT readiness | `lib/fantasy-projections/readiness.ts:36` | S,I | OK |
| season_release_players | SELECT; INSERT through INVOKER publish | `lib/fantasy-projections/queries.ts:175` | S,I | OK |
| **season_release_teams** | SELECT; INSERT through INVOKER publish. Immutable trigger. | `lib/fantasy-projections/queries.ts:483` | **ALL** | **OVER-GRANT: UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER.** UPDATE/DELETE are blocked by the trigger; TRUNCATE would bypass it. Need S,I. |
| season_releases | SELECT; INSERT through INVOKER publish (+RETURNING) | `lib/fantasy-projections/queries.ts:114`; `scripts/publish-player-forecast-season-local.ts:61` | S,I | OK |
| season_roster_conflict_members | INSERT | `lib/fantasy-projections/rosterReconciliation.ts:797` | S,I | OK |
| season_roster_conflict_resolutions | SELECT, INSERT(+RETURNING) | `lib/fantasy-projections/rosterReconciliation.ts:744`; `lib/fantasy-projections/admin.ts:984` | S,I | OK |
| season_roster_conflicts | SELECT, INSERT(+RETURNING) | `lib/fantasy-projections/rosterReconciliation.ts:780` | S,I | OK |
| season_roster_members | SELECT, INSERT; INVOKER `apply_player_forecast_season_roster_snapshot` INSERT | `scripts/import-player-forecast-season.ts:392`; `lib/fantasy-projections/admin.ts:950` | S,I | OK |
| season_roster_observations | SELECT, INSERT, upsert ignoreDuplicates; INVOKER `latest_…` SELECT | `lib/fantasy-projections/rosterReconciliation.ts:614`; `scripts/import-player-forecast-season-transaction-audit.ts:203` | S,I | OK |
| season_roster_snapshots | SELECT, INSERT(+RETURNING); INVOKER apply (DO NOTHING +RETURNING) | `scripts/import-player-forecast-season.ts:376`; rpc `lib/fantasy-projections/rosterReconciliation.ts:945` | S,I | OK |
| **season_runs** | SELECT, INSERT, **UPDATE**; INVOKER clone/create INSERT (DO NOTHING). **No DELETE anywhere.** | `lib/fantasy-projections/seasonJobs.ts:880`, `:1148`; `lib/fantasy-projections/admin.ts:780`, `:1174` update; `scripts/import-player-forecast-season.ts:483` insert | **ALL** | **OVER-GRANT: DELETE, TRUNCATE, REFERENCES, TRIGGER.** Need S,I,U. |
| season_schedule_games | INSERT; SELECT (admin selectAll, INVOKER create/publish) | `scripts/import-player-forecast-season.ts:442`; `lib/fantasy-projections/admin.ts:1021` | S,I | OK |
| season_schedule_snapshots | SELECT, INSERT(+RETURNING) | `scripts/import-player-forecast-season.ts:426` | S,I | OK |
| **season_team_aggregates** | INSERT (insertChunks); SELECT; INVOKER clone/create INSERT. Immutable trigger. | `lib/fantasy-projections/seasonJobs.ts:1100`; `scripts/reconcile-player-forecast-season-local-queue.ts:33` | **ALL** | **OVER-GRANT: UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER.** Need S,I. |

**Verdict 4:**
- **UNDER-GRANT:** none. Every table that is updated directly or through an INVOKER function already has UPDATE in the proposal (inference_queue, runs, season_active_releases, season_queue, season_runs).
- **OVER-GRANT:**
  - season_release_teams, season_team_aggregates (ALL; need S,I)
  - season_runs (ALL; need S,I,U)
  - INSERT on champion_history (only caller is the uncalled promote RPC)
  - INSERT on season_completeness_waivers (no caller)

The ALL grants come from migrations `20260820050000`:108-109 and `20260820052000`:79. The earlier v3 intent (`20260813001304`:1408-1430) was S,I for release_teams and team_aggregates and S,I,U for season_runs.

## 5. draft_pro_* and in_season_*

All app callers are service_role: `serviceRoleClient` or `getServiceRoleClient` in `pages/api/v1/account/draft-pro/*`, `lib/draft-pro/*`, `lib/integrations/stripe/*` (default `client = serviceRoleClient`), and `lib/in-season/server.ts:24`. The `.sh` probes use psql (not a Supabase role).

| object | direct service_role ops | through SECURITY DEFINER RPC (caller grant irrelevant) | evidence (direct) | needed svc table grant |
|---|---|---|---|---|
| draft_pro_access_code_attempts | none in app (SELECT only in the verify runner) | `redeem_draft_pro_access_code` INSERT DO UPDATE | `scripts/draft-pro/verify-access-codes-runner.ts:84` | none for app (SELECT for the runner) |
| draft_pro_access_codes | none in app (runner SELECT) | `issue_…` INSERT, `redeem_…` UPDATE + FOR UPDATE, `revoke_…` UPDATE | runner `:113` | none for app (SELECT for the runner) |
| draft_pro_drafts | SELECT | `begin/commit_…save_session`, `delete/rename/duplicate_…`, `list/read_…` | `lib/draft-pro/account/index.ts:96`; `lib/draft-pro/scenariosServer.ts:37` | SELECT |
| draft_pro_private_import_blobs | none | `commit_…`, `delete_…`, `claim_…cleanup`, `confirm_…cleanup`, `read_…blob` | none | none |
| draft_pro_private_import_uploads | none | `begin_…upload`, `stage_…`, `commit_…`, `claim/confirm_…upload_cleanup`, `read_…upload` | none | none |
| draft_pro_private_imports | SELECT (plus one PATCH in a verify runner) | `commit_…`, `delete_…`, `duplicate_…` | `lib/draft-pro/account/index.ts:101`; `lib/draft-pro/scenariosServer.ts:40`; runner `scripts/draft-pro/verify-scenarios-routes-runner.ts:115` (UPDATE `deleted_at`) | SELECT (+UPDATE only for the runner) |
| draft_pro_provider_events | SELECT, INSERT(+RETURNING), UPDATE | `record_draft_pro_stripe_event` INSERT DO NOTHING + UPDATE | `lib/integrations/patreon/sync.ts:957` insert, `:981`/`:989`/`:996` update; `lib/draft-pro/account/index.ts:115` | S,I,U |
| draft_pro_purchases | SELECT, UPDATE | `begin_…checkout_attempt` INSERT, `attach_…` UPDATE, `record_…event` UPDATE (all FOR UPDATE) | `lib/integrations/stripe/checkout.ts:39` update; `pages/api/v1/account/draft-pro/checkout/verify.ts:39`; `lib/draft-pro/account/refunds.ts:95` | S,U |
| draft_pro_refund_requests | SELECT, INSERT(+RETURNING), UPDATE | none | `lib/draft-pro/account/refunds.ts:113` insert, `:73`/`:148`/`:214` update | S,I,U |
| draft_pro_reports | SELECT, INSERT(+RETURNING) | none | `pages/api/v1/account/draft-pro/reports/index.ts:24`, `:54` | S,I |
| draft_pro_save_sessions | none | `begin_…save_session`, `commit_…`, `begin_…upload`, `stage_…` | none | none |
| draft_pro_scenarios | SELECT, INSERT(+RETURNING) | none | `pages/api/v1/account/draft-pro/scenarios/index.ts:20`, `:38`; `pages/api/v1/account/draft-pro/reports/index.ts:35` | S,I |
| in_season_grants | SELECT | none | `lib/in-season/server.ts:33` | SELECT. There is no app writer; grants are managed outside the app. |
| in_season_workspaces | SELECT, INSERT(+RETURNING), UPDATE(+RETURNING) | none | `pages/api/v1/roster-schedule-optimizer/workspace.ts:150` insert, `:113`/`:155` update; `pages/api/v1/roster-schedule-optimizer/diagnostic-context.ts:64` select | S,I,U |

No direct DELETE on any draft_pro_* or in_season_* table; the DEFINER `delete_draft_pro_saved_draft` is a soft-delete UPDATE. The migrations grant SIUD on all of them (`20260907143356`:124, `20260907182507`:73, `20260909120000`:24, `20260927104934`:39), so DELETE is everywhere an over-grant by usage. Triggers on these tables are `*_touch_updated_at` → `update_updated_at_column` (modify NEW only).

## 6. native_forecast_catalog_heads

| object | client | ops used | evidence | needed grant | verdict |
|---|---|---|---|---|---|
| native_forecast_catalog_heads | svc | **SELECT only, direct.** Writes only through `cas_native_forecast_catalog_head`, which is SECURITY DEFINER (INSERT ON CONFLICT DO NOTHING + UPDATE, `20261017183611`:22). | `lib/player-forecasts/nativeCatalogHead.ts:56` select, rpc `:139`; `lib/player-forecasts/forecastServingSource.ts:46` select; `scripts/native-baseline-cadence.ts:136-137` only matches REST paths | svc SELECT; EXECUTE on the CAS RPC | **Confirmed.** Migration `20261017183611`:19-20 and 62-63 already grant only SELECT and EXECUTE. |

## 7. Functions

**SQL callers** of these functions:
- `clone_player_forecast_season_run` ← `clone_…_with_assumptions`
- `create_player_forecast_season_event_run` ← `create_…_with_assumptions`
- `inherit_player_forecast_season_assumptions` ← both `*_with_assumptions`
- `enqueue_player_forecast_season_job` ← `resolve_…_identity`, `apply_…_roster_snapshot`, `compact_…_queue`
- `enqueue_player_forecast_job` ← trigger `fhfh_internal.enqueue_player_forecast_observation`
- `get_connected_account_tokens_secure` ← `commit_fantrax_connection_secure`
- `upsert_connected_account_tokens_secure` ← `commit_fantrax_connection_secure`, `commit_espn_connection_secure`

No other object function is called from SQL.

| function | security (latest def) | app caller(s) (all service_role) | tables the caller needs (INVOKER only) |
|---|---|---|---|
| append_line_decisions | INVOKER (`20261002134400`:73) | `lib/lines/storage.ts:70` | INSERT line_entry_revisions, line_pp_decisions; SELECT |
| apply_player_forecast_season_roster_snapshot | INVOKER (v4:235) | `lib/fantasy-projections/rosterReconciliation.ts:945` | INSERT roster_snapshots (+RETURNING), roster_members; through enqueue: I+U season_queue |
| attach_draft_pro_stripe_checkout_session | DEFINER | `lib/integrations/stripe/checkout.ts:75` | none |
| begin_draft_pro_private_import_upload | DEFINER | `lib/draft-pro/privateImportTransport.ts:44` | none |
| begin_draft_pro_save_session | DEFINER | `lib/draft-pro/savedDraftsServer.ts:45`; `lib/draft-pro/privateImportTransport.ts:39` | none |
| begin_draft_pro_stripe_checkout_attempt | DEFINER | `lib/integrations/stripe/checkout.ts:23`, `:46` | none |
| build_player_forecast_runtime_features | DEFINER (`20260805003121`:3) | `lib/player-forecasts/serving.ts:211` | none |
| cas_native_forecast_catalog_head | DEFINER | `lib/player-forecasts/nativeCatalogHead.ts:139` | none |
| claim_draft_pro_private_import_cleanup | DEFINER | `lib/draft-pro/privateImportCleanup.ts:29` | none |
| claim_draft_pro_private_import_upload_cleanup | DEFINER | `lib/draft-pro/privateImportCleanup.ts:43` | none |
| claim_player_forecast_jobs | INVOKER | `lib/player-forecasts/orchestration.ts:491` | SELECT FOR UPDATE + UPDATE inference_queue |
| claim_player_forecast_season_jobs | INVOKER | `lib/fantasy-projections/seasonJobs.ts:1181`; `scripts/reconcile-player-forecast-season-local-queue.ts:71` | SELECT FOR UPDATE + UPDATE season_queue |
| clone_player_forecast_season_run | INVOKER | **SQL only** (through `_with_assumptions`) | INSERT season_runs, game_outputs, player_aggregates, team_aggregates |
| clone_player_forecast_season_run_with_assumptions | INVOKER | `lib/fantasy-projections/admin.ts:769` | the clone tables above + INSERT season_overrides |
| commit_draft_pro_save_session | DEFINER | `lib/draft-pro/savedDraftsServer.ts:54` | none |
| compact_player_forecast_season_queue | INVOKER | `scripts/compact-player-forecast-season-local-queue.ts:25` (script only) | UPDATE + I/U season_queue |
| confirm_draft_pro_private_import_cleanup | DEFINER | `lib/draft-pro/privateImportCleanup.ts:38` | none |
| confirm_draft_pro_private_import_upload_cleanup | DEFINER | `lib/draft-pro/privateImportCleanup.ts:51` | none |
| create_player_forecast_season_event_run | INVOKER | **SQL only** | INSERT (DO NOTHING) runs, game_outputs, player_aggregates, team_aggregates; SELECT roster_snapshots, schedule_* |
| create_player_forecast_season_event_run_with_assumptions | INVOKER | `lib/fantasy-projections/seasonJobs.ts:862` | as above + INSERT overrides |
| delete_draft_pro_saved_draft | DEFINER | `lib/draft-pro/savedDraftsServer.ts:75` | none |
| duplicate_draft_pro_saved_draft | DEFINER | `lib/draft-pro/savedDraftsServer.ts:84` | none |
| enqueue_player_forecast_job | INVOKER | `pages/api/v1/player-forecasts/conflicts.ts:119`; `lib/player-forecasts/sourceObservations.ts:299`, `:326`; `lib/player-forecasts/orchestration.ts:299`; `scripts/seed-player-forecast-serving-proof.ts:80` | INSERT ON CONFLICT DO UPDATE inference_queue |
| enqueue_player_forecast_season_job | INVOKER | `lib/fantasy-projections/seasonJobs.ts:1281`; `lib/fantasy-projections/admin.ts:894` | INSERT DO UPDATE season_queue |
| finish_player_forecast_job | INVOKER | `lib/player-forecasts/orchestration.ts:534` | UPDATE inference_queue |
| finish_player_forecast_season_job | INVOKER | `lib/fantasy-projections/seasonJobs.ts:581`; reconcile script `:101` | UPDATE season_queue |
| inherit_player_forecast_season_assumptions | INVOKER | **SQL only** | INSERT season_overrides; SELECT season_runs |
| issue_draft_pro_access_code | DEFINER | `scripts/draft-pro/access-codes.ts:25` (CLI) | none |
| latest_player_forecast_season_roster_observations | INVOKER | `lib/fantasy-projections/rosterReconciliation.ts:282`, `:651`; `lib/fantasy-projections/readiness.ts:114`; 2 scripts | SELECT roster_observations |
| list_draft_pro_saved_drafts | DEFINER | `lib/draft-pro/savedDraftsServer.ts:38` | none |
| promote_player_forecast_model_atomic | INVOKER | **no caller** | (INSERT+UPDATE champion_history; SELECT model_artifacts) |
| publish_forge_game_revisions | INVOKER | `lib/projections/gameRevisions.ts:172` | INSERT forge_game_revisions; SELECT source_observations |
| publish_player_forecast_season_release_atomic | INVOKER (v4:672) | `lib/fantasy-projections/admin.ts:1215`, `:1260` | INSERT releases, release_players, release_teams, release_events; I+U active_releases; SELECT on ~11 season tables |
| read_draft_pro_private_import_blob | DEFINER | `lib/draft-pro/privateImportTransport.ts:129`, `:142` | none |
| read_draft_pro_private_import_upload | DEFINER | `lib/draft-pro/privateImportTransport.ts:28` | none |
| read_draft_pro_snapshot | DEFINER | `lib/draft-pro/savedDraftsServer.ts:65` | none |
| read_forge_game_revisions | INVOKER (`20261004181455`:7); EXECUTE granted to service_role only (`20260916012353`:97-99) | `lib/rosterScheduleData/planning.ts:149`; `lib/projections/gameRevisions.ts:195` | SELECT forge_game_revisions, forge_final_pregame_revisions, forge_game_selection_events |
| record_draft_pro_stripe_event | DEFINER | `lib/integrations/stripe/fulfillment.ts:87`, `:156` | none |
| redeem_draft_pro_access_code | DEFINER | `pages/api/v1/account/draft-pro/access-codes/redeem.ts:15` | none |
| rename_draft_pro_saved_draft | DEFINER | `lib/draft-pro/savedDraftsServer.ts:84` | none |
| resolve_player_forecast_season_identity | INVOKER | `lib/fantasy-projections/identityResolution.ts:385` | INSERT pool_review (+RETURNING); through enqueue: I+U season_queue |
| revoke_draft_pro_access_code | DEFINER | `scripts/draft-pro/access-codes.ts:29` (CLI) | none |
| rollback_player_forecast_season_release_atomic | INVOKER | `lib/fantasy-projections/admin.ts:1284` | I+U active_releases; INSERT release_events; SELECT releases |
| stage_draft_pro_private_import_upload | DEFINER | `lib/draft-pro/privateImportTransport.ts:105`, `:119` | none |
| get_connected_account_tokens_secure | DEFINER (baseline:1326; reads `private.*`) | `lib/integrations/espn/server.ts:298`, `lib/integrations/patreon/sync.ts:639`, `lib/integrations/fantrax/server.ts:416`, `lib/integrations/yahoo/refresh.ts:95`, `lib/integrations/yahoo/teamRoster.ts:120`, `lib/integrations/yahoo/tokenManager.ts:74` | none |
| upsert_connected_account_tokens_secure | DEFINER (baseline:5289) | `lib/integrations/yahoo/teamRoster.ts:154`, `lib/integrations/yahoo/discovery.ts:176`, `lib/integrations/yahoo/tokenManager.ts:202`, `lib/integrations/patreon/sync.ts:250` | none |

Functions with no app caller: `promote_player_forecast_model_atomic` has none at all. `clone_player_forecast_season_run`, `create_player_forecast_season_event_run` and `inherit_player_forecast_season_assumptions` are called only from SQL; service_role needs EXECUTE on them only if they check privileges as INVOKER-nested calls. They do: EXECUTE is checked for nested calls too, so keep it.
