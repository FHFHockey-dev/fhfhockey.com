# FORGE sandbox: capture → publish → both RSO readers, local candidate, November 19, 2026

**Status:** local, disposable rehearsal only. Nothing was pushed, nothing in production changed, and no cron was registered. The base is origin/master `02f0426d5`, whose hosted capture-only run passed on Nov 19.

One cron GET does all of the following within 240 s:
- runs the existing FORGE v1 capture for fixture `2099020991`;
- publishes exactly once from that qualified claim with the real FORGE publisher (`publishQualifiedPregameCapture` → `computeForgePregamePublication` → `forge_pregame_publish_v1`);
- reads the committed revision through both real RSO readers.

Access uses the same narrow pattern as before: the NOLOGIN role `forge_sandbox_api`, granted to authenticator, reaching only views and SQL wrappers in the exposed schema `forge_sandbox_api`, with a JWT of at most 12 h. There is no service role and no signing secret in the app.

The wrappers now also cover `forge_pregame_publish_v1`, `forge_pregame_publication_receipt_v1` and `read_forge_game_revisions`. The new views are `yahoo_matchup_weeks`, `forge_runs`, `forge_player_projections`, `forge_team_projections`, `forge_goalie_projections`, `forge_reserve_projections`, `player_forecast_source_observations`, `wgo_skater_stats_totals`, `opponent_skater_allowed_by_position` and `forge_game_revisions`.

## Module decisions

Of the candidate's 13 modules that differ from master, this branch changes three, minimally, and adds one new shared module. The other ten are left at master.

| Module | Change | Live importers | Live behaviour change |
| --- | --- | --- | --- |
| `lib/projections/forgeEnvScope.ts` (new) | AsyncLocalStorage overlay. `forgeEnv()` returns `process.env` itself outside `withForgeEnv`. | `starterBoardFlags`, `run-forge-projections`; new: the route, `hostedReaders` | None outside the scope. Overlays are per async chain; `process.env` is never modified. |
| `lib/projections/starterBoardFlags.ts` | The 3 default parameters change from `= process.env` to `= forgeEnv()`. | run-forge-projections, skater/goalie/preflight stages, rosterScheduleData/planning, starterBoardQueue, starter-board routes, run-projection-v2 and others (all server-only; no non-API page reaches it) | None: outside a scope `forgeEnv() === process.env`. Explicitly passed env still wins. |
| `lib/projections/run-forge-projections.ts` (+109/−3) | `projectionModelEnvironment` reads `forgeEnv()`. Additive `computeForgePregamePublication`, the candidate's code with `calendarRevisionOf` inlined. `runProjectionCalculations` gets an optional 5th parameter `lifecycle?: { omitPregameSidecars }`. | run-projection-v2 (the live FORGE cron), starterBoardQueue, hostedGame, nativeInputs, replay-forge-snapshot | None. Existing callers pass no lifecycle, so sidecars stay "enabled". The env key list is unchanged (the candidate's `FORGE_RESERVE_PASS_ENABLED` addition is **not** taken). The candidate's `observeSuccess` is **not** taken. |
| `lib/projections/inputCapture.ts` (+11/−3, the candidate's hunk verbatim) | Additive replay option `rejectUnrecordedReads`. | run-forge-projections, gameRevisions, starterBoardOperations, research and diagnostics scripts | None: the option defaults off, and replay already threw on unrecorded reads. |

**Not taken: the candidate's `forgeDailyBridge` (+109/−43).** It times runs by `succeeded_observed_at`, which master's live writer never records (the candidate's `observeSuccess` would). Shipping it alone would make every live FORGE run "untimed" and turn live RSO planning schedule-only.

Also not taken: `laterImpactInputs`, `run-lifecycle-queries`, `externalInputProof`, `verifiedForgeReleases`, `issuedContext`, `hostedGame`, `runner`, `custody`, `rpc` and `policy`.

**New, non-live files:**
- `pregameCapture/publication.ts`: the candidate's file, unchanged.
- `pregameCapture/hostedReaders.ts`: the candidate's file with two deliberate deviations:
  1. Its env reads go through `forgeEnv()`.
  2. The daily timing check binds the bridge row's `issuedAt` to the published run's `forge_runs.created_at`, which is the released bridge's semantics, and requires `created_at ≤ observed`. The candidate's check used `succeeded_observed_at`. The run = claim, `captured_snapshot` proof and release checks are unchanged.

**Flags.** The production environment is unchanged. Inside the request, `withForgeEnv` layers on only `STARTER_BOARD_COMPUTE_ENABLED=true`, `STARTER_BOARD_SERVING_ENABLED=true` and `STARTER_BOARD_CANARY_GAME_IDS=2099020991`. The model mode, reserve pass and season bootstrap stay at production's values; the RSO bridge and calendar defaults already match.

**Producer closure.** It changes from master's `a6a3bb7a…` to **`78655939ef3fcdb47a12c2388644b96a7015f49c2327cac00ddbd8a050dfd6e9`** (see the gate log). Production build admission will refuse this commit until that closure is verified with `scripts/verify-forge-release-sha.ts` and listed in `VERIFIED_FORGE_PRODUCER_CLOSURES`. That needs TJ's approval; this branch does not add the entry.

## Rehearsal (`check_sandbox.py`, exit 0; [LOCAL-PROOF.json](LOCAL-PROOF.json))

Run on PostgreSQL 15.19 and PostgREST 16.6, with `db-schemas=public,graphql_public,forge_sandbox_api`, a populated `public` and production's flags.

| Check | Result |
| --- | --- |
| GET 1 | **200 `succeeded` / `readers_recorded`, 5,529 ms.** Capture 238 ms, packet summary 6 ms, publication 5,203 ms (≈5 s of it is the publisher's signed cutoff-tolerance wait), readers 48 ms. Claim `547f4665-1bd3-48d7-a8b6-0d2b3b963cb8`, revision `16777bb1-48e6-4548-a905-d7e769aa5ba5`. |
| Daily RSO reader | **2.965 points at C#1**. The run is the claim; revision `forge-daily-bridge-v1:<claim>`. |
| Detailed RSO reader | Same claim and the committed revision. **`missing_participation`**, with points and slot withheld. |
| GET 2 | **409 `duplicate`**. One publication; claims, artifacts, witnesses, outcomes, `forge_runs`, revisions, 36 player rows and the run row's `xmin` are all unchanged. 1 TSA call in total. |
| Route traffic | 178 REST calls, all on profile `forge_sandbox_api` with the sandbox token. No other network traffic except the local TSA. No HTTP errors. |
| Denials | anon / no token on the sandbox API: 401. Authenticated: 403. Sandbox token writing or reading `public`, calling public definers, or writing its own views: 403. `Accept-Profile` for private schemas, `pgsodium` or `vault`: 406. Positive control: 200. |
| Outside the sandbox | `pg_dump` byte-identical (SHA-256 `fa506615…`). New roles: only `forge_sandbox_api` and `forge_sandbox_owner`. `isolation-check.sql` reports ok; `prod-isolation-api.sql` reports ok. |
| Cron | Fires once, a duplicate tick does nothing, the job unschedules itself, and readback and reset work. |

Fixture note: production's `nhl_team_data` has `season_id`, which the released daily bridge filters on. The fixture shape (taken from the candidate's reads) lacked it, so the sandbox adds it with value 20262027.

## Proposed production change list (for TJ's approval; Chef applies)

1. **Release admission.**
   - Verify closure `78655939…` with `scripts/verify-forge-release-sha.ts <commit>`.
   - Add the receipt and the `VERIFIED_FORGE_PRODUCER_CLOSURES` entry in a follow-up commit. Without it, `next build` fails with `VERCEL_ENV=production`.
2. **Audit.** Run `prod-isolation-api.sql` (read-only) before the change.
3. **Database.** Run `sandbox_bootstrap.py --start <T> --out <sql>` and apply the result as `postgres`. T must be more than 75 min ahead and at least 65 min after the firing. It creates:
   - roles `forge_sandbox_owner` (NOLOGIN) and `forge_sandbox_api` (NOLOGIN);
   - `GRANT forge_sandbox_api TO authenticator`;
   - five schemas, including `forge_sandbox_api` with 44 views and 16 wrappers.

   Then run `isolation-check.sql`; it must report ok.
4. **Data API.** Set Exposed schemas to `public, graphql_public, forge_sandbox_api`.
5. **Vercel `fhfhockey`, production.** Add `FORGE_SANDBOX_API_TOKEN` with `sandbox_token_setup.py --hours 11` (stdin only; at most 12 h). No flag changes.
6. **Deploy, then cron.** Run `arm-sandbox-get.sql -v schedule=…`. Afterwards run `readback-sandbox-get.sql` (cron run → `net._http_response` → receipt with claim, revision and readers), then `disarm-sandbox-get.sql`.
7. **Cleanup.**
   - Run `reset-sandbox.sql`.
   - Remove `forge_sandbox_api` from Exposed schemas.
   - Delete `FORGE_SANDBOX_API_TOKEN`.
   - Decide whether the route and the env scope stay in master.
