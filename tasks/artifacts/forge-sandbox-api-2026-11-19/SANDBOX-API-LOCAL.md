# FORGE sandbox over a narrow PostgREST interface: local proof and proposed production change, November 19, 2026

**Status: local, disposable proof only. No production access was used.** The design is capture-only on master `dbe6a9e33`, with zero changed shared modules and production's actual flags. It replaces the direct-login design, which TJ stopped after the `pgsodium.mask_role` finding: that function is a PUBLIC-executable SECURITY DEFINER that runs `GRANT ALL`. This design creates no database login.

## Design

- **Private schemas** `forge_sandbox`, `forge_sandbox_capture`, `forge_sandbox_internal` and `forge_sandbox_exec`:
  - They hold the frozen fixture and the custody tables and RPCs.
  - The NOLOGIN `forge_sandbox_owner` owns them. Its only grant outside the sandbox is USAGE on `extensions`, for pgcrypto.
  - They are never exposed through the Data API.
- **Exposed schema `forge_sandbox_api`**, also owned by `forge_sandbox_owner` ([sandbox-api.sql](sandbox-api.sql)):
  - 34 `security_barrier` views. These are the capture transport's allowlisted relations that the fixture has, with their original names.
  - 13 SECURITY DEFINER SQL wrappers, each calling one sandbox function with the same arguments, result and volatility. That keeps the three native-input RPCs GET-callable. The wrappers cover:
    - the 7 custody RPCs: claim, save, settle, read, lookup, record_witness and record_outcome;
    - the 3 native-input RPCs: `forge_latest_rolling_rows`, `forge_league_skater_physical_totals` and `forge_latest_trend_bands`;
    - the run ledger: `forge_sandbox_run_begin_v1`, `forge_sandbox_run_finish_v1` and `forge_sandbox_receipt_v1`.
- **Role `forge_sandbox_api`**:
  - NOLOGIN, noinherit, with no attributes. It has `statement_timeout=20s` and `TimeZone=UTC`.
  - It is granted to `authenticator`.
  - Its grants are USAGE on `forge_sandbox_api`, SELECT on its views and EXECUTE on its wrappers. It has nothing on the private schemas: the former service_role grants are re-pointed at it and then revoked everywhere private.
  - PUBLIC, anon and authenticated have nothing anywhere in the sandbox.
- **Route `web/pages/api/v1/db/forge-sandbox-run.ts`**:
  - GET with WGO's `invokedByCron` (`CRON_SECRET`), `no-store`, no query string, and game `2099020991` fixed.
  - It uses supabase-js with `db.schema = 'forge_sandbox_api'`. It sends the anon apikey with `FORGE_SANDBOX_API_TOKEN` as Bearer.
  - The token must claim `role=forge_sandbox_api`, expire within 24 h and have at least 5 minutes left; otherwise the route returns 503 before any request.
  - It does not use `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` or a pg login, and it has no fallback.
- **Capture path**: master's `runHostedPregameGame` v1 capture runs through its existing `deps.readSchedule`, `deps.runCapture`, `deps.signal` and `deps.env`, and through `CaptureWiring.fetchImpl`.
  - The transport's existing guard admits only the default profile. The read client therefore withholds the profile header from it, and the transport's own `fetchImpl` forces `Accept-Profile: forge_sandbox_api` on every strict read.
  - No capture read can resolve outside the sandbox API. Even if one did, the token has no access to `public` (see the denial matrix below).

## Local proof: [check_sandbox.py](check_sandbox.py), exit 0 ([LOCAL-PROOF.json](LOCAL-PROOF.json))

The proof ran PostgreSQL 15.19 and PostgREST 16.6. PostgREST connected as `authenticator` with anon role `anon`, `db-schemas=public,graphql_public,forge_sandbox_api` and an HS256 JWT secret.

The stand-in live project had:
- Supabase-like roles and `graphql_public`;
- Vault, net, and a cron stand-in with a WGO job;
- the full FORGE fixture platform with seed in `public`;
- Supabase's default client grants on the sample tables `public.games` and `public.forge_runs`.

The route ran with production's flags: `STARTER_BOARD_COMPUTE_ENABLED=false` and `STARTER_BOARD_CANARY_GAME_IDS=2026010049`.

| Check | Result |
| --- | --- |
| GET 1 (real route through PostgREST, sandbox token) | **200 `succeeded` / `capture_qualified`**, 188 ms in the app, 181 ms in the DB. Custody and witness qualified. Packet 27,263 bytes, 131 reads; 36 skaters including 8471001, 4 goalies, 4 reserves. |
| GET 2 | **409 `duplicate`**. Custody and run rows and `xmin` unchanged. 1 TSA call in total. |
| Route traffic | 148 REST calls, all with profile `forge_sandbox_api` and the sandbox token as Bearer. No other network traffic except the local TSA. |
| Denials over HTTP | anon, and no token at all, against `forge_sandbox_api` (views and RPCs): 401. Ordinary `authenticated`: 403. The sandbox token gets 403 on POST, PATCH or DELETE of `public.games` and `public.forge_runs`, on GET of `public.games`, on RPCs to the `public` custody and publication definers, and on writes to its own views. `Accept-Profile` for any `forge_sandbox*` private schema, `pgsodium` or `vault` returns 406. Positive control: the sandbox token reading its own view returns 200. |
| Outside the sandbox | `pg_dump` byte-identical before and after the bootstrap, both GETs and every denial: SHA-256 `b69c87de…`, 397,392 bytes. New roles: only `forge_sandbox_api` and `forge_sandbox_owner`. Changed memberships: only `authenticator` (added `forge_sandbox_api`) and `postgres` (added `forge_sandbox_owner`, for SET ROLE during setup). |
| [isolation-check.sql](isolation-check.sql) | `ok`. No write or CREATE outside the sandbox for either role. The API role has nothing on private schemas and cannot write its own views. The API surface is exactly 34 views and 13 definers. No anon, authenticated, authenticator, service_role or PUBLIC access to any sandbox schema or function. No role attributes or memberships. |
| [prod-isolation-api.sql](prod-isolation-api.sql) against the stand-in | Verdict `ok`. No writable exposed relations. No exposed definers outside the API reaching pgsodium, writing FORGE tables, or running privilege DDL or dynamic SQL. pgsodium is not exposed. |
| Cron | `fired 1`, then `already_fired`, at 240,000 ms with the Vault `cron_secret` in the header only. The job unschedules itself. Reset removes the schemas, both roles and the authenticator membership. The WGO stand-in job is intact. |

## Proposed production change list (for TJ's approval; Chef applies)

1. **Audit before the change.** Run [prod-isolation-api.sql](prod-isolation-api.sql) read-only on production.
   - Before installation it evaluates PUBLIC's privileges, which is all a new role inherits.
   - Review `executableDefinersOutsideApi`, `exposedFunctionsReachingPgsodium` and `exposedDefinersRunningPrivilegeDdl` for the exposed schemas.
   - pgsodium itself is not exposed. Its `mask_role` is reachable over the Data API only if an exposed function calls it; the audit lists any such function.
2. **Database.** Apply one generated file as `postgres` (`sandbox_bootstrap.py --start <T> --out <sql>`, with T more than 75 minutes ahead and at least 65 minutes after the firing). It creates:
   - roles `forge_sandbox_owner` (NOLOGIN) and `forge_sandbox_api` (NOLOGIN, `statement_timeout=20s`, `TimeZone=UTC`);
   - `GRANT forge_sandbox_api TO authenticator`;
   - `GRANT forge_sandbox_owner TO postgres`, which the setup needs for SET ROLE;
   - `GRANT USAGE ON SCHEMA extensions TO forge_sandbox_owner`;
   - five schemas, all owned by the owner: `forge_sandbox`, `forge_sandbox_capture`, `forge_sandbox_internal`, `forge_sandbox_exec` and `forge_sandbox_api`;
   - the frozen fixture, the API views and wrappers, and the grants described above.

   Then run [isolation-check.sql](isolation-check.sql), which must report `ok`.
3. **Data API setting.** Change Exposed schemas from the current value (expected `public, graphql_public`) to `public, graphql_public, forge_sandbox_api`. Leave "Extra search path" unchanged. Reload the schema cache; the bootstrap also sends `notify pgrst`.
4. **Vercel `fhfhockey`, production.**
   - Add `FORGE_SANDBOX_API_TOKEN` (sensitive) through [sandbox_token_setup.py](sandbox_token_setup.py). The JWT secret goes in on stdin; the token carries `role=forge_sandbox_api` and expires in at most 24 h.
   - The existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY` and `CRON_SECRET` are reused. No other env changes, and no flag changes.
5. **Release.** Deploy the commit adding the route.
6. **Cron.** [arm-sandbox-get.sql](arm-sandbox-get.sql) `-v schedule='<m> <h> <dom> <mon> *'` registers job `forge-sandbox-get-2099020991` with `net.http_get` to `https://fhfhockey.com/api/v1/db/forge-sandbox-run`, the Vault `cron_secret` Bearer and 240,000 ms. Then run [readback-sandbox-get.sql](readback-sandbox-get.sql) promptly, then [disarm-sandbox-get.sql](disarm-sandbox-get.sql).
7. **Retire.** Run [reset-sandbox.sql](reset-sandbox.sql) and remove `forge_sandbox_api` from Exposed schemas. Delete `FORGE_SANDBOX_API_TOKEN`, which expires within 24 h anyway.
