# Writer-gate hardening, November 19, 2026 (Track B)

Local and disposable rehearsal only. Nothing in production changed. Every production step below needs TJ's approval.

## The problem

Production's audit failed the writer gate. The FORGE writer runs with the service role key in Vercel's production environment. Two of its paths reach far more than the writer should.

1. **`public.execute_sql(text)`**: a `SECURITY DEFINER` function owned by `postgres`, whose body is `EXECUTE sql_statement`. `service_role` may EXECUTE it.
   - In production `postgres` is `NOSUPERUSER`, but it has `CREATEROLE` and `BYPASSRLS` and owns `forge_pregame_capture`.
2. **Database and JWT secrets in Vercel production env**: `POSTGRES_URL` and `POSTGRES_PASSWORD` (user `postgres`), and `SUPABASE_JWT_SECRET`.

## 1. Faithful production copy, and what the writer can reach

**How the copy was built** (`FAITHFUL-LIFECYCLE.txt`, `AUDIT-*.txt`):
- A fresh PostgreSQL 15 cluster whose bootstrap superuser is `supabase_admin`.
- Production's role dump loaded verbatim. The only line dropped is `session_preload_libraries`, because those libraries are not available locally.
- The Supabase stubs, then production's schema dump with grants.
- It therefore holds production's applied state: publication, verifier 9673316c and live run, all inert.

**`writer-reach-audit.sql`**: a catalog survey plus probes run as `service_role`, each rolled back.

| Probe | Before | After hardening |
| --- | --- | --- |
| F1: `execute_sql('grant forge_witness_api to authenticator')` | succeeds; PostgREST can then switch to the witness role | permission denied |
| F2: `execute_sql('grant forge_witness_owner to postgres')`, then read `forge_witness.credentials` | succeeds | permission denied |
| F3: `execute_sql('alter table forge_pregame_capture.publications disable trigger require_live_verdict')` | succeeds | permission denied |
| F4: `execute_sql(create or replace forge_witness.require_accepted_v1 … accepted:true)` | succeeds | permission denied |
| F5: the same writes without `execute_sql` | denied | denied |

Other findings from the survey:
- `execute_sql` is the only privileged dynamic-SQL definer that `service_role` can EXECUTE (section B).
- No privileged definer that `service_role` can reach is missing a pinned search path (section G).
- `service_role` is a member of `pgsodium_keyholder`. Vault internals are not in the dump, so I could not audit them.

**Live and verifier fences on this copy, as non-superuser `postgres`** (production's operator role): all pass, including the credential fences.
- Two gaps in the copy were set to match production: `postgres` has CREATE on the database, and there is exactly one `cron_secret`.

## 2. Smallest hardening that keeps CSV admin working

**SQL:** `harden-execute-sql.sql`, applied as postgres in one transaction. Rollback is `rollback-harden-execute-sql.sql`.
- Revoke EXECUTE on `execute_sql` from `public`, `anon`, `authenticated` and `service_role`. `postgres` keeps it.
- Add `public.csv_create_table_v1(p_table text, p_columns jsonb)`, a `SECURITY DEFINER` owned by postgres with `search_path=''`. EXECUTE goes to `service_role` only. It:
  - validates the table name: the route's regex, and no `pg_` prefix;
  - leaves an existing public relation untouched: no DDL and no grant (same as today's `IF NOT EXISTS`);
  - refuses a name that would shadow a relation in another schema;
  - accepts 1 to 200 columns, validating each name with the route's regex and refusing `upload_batch_id` and `player_id`;
  - maps the eight route types to fixed literals, so no type text from the input is ever interpolated;
  - creates the table with the same shape as today (`upload_batch_id` uuid PK, `player_id` bigint, and the FK to `players`);
  - then grants `service_role` exactly SELECT and INSERT on the new table.

**Code:** `web/pages/api/v1/db/upsert-csv.ts` calls `csv_create_table_v1` instead of `execute_sql`, and any refusal now stops before the insert.
- Tests: `__tests__/pages/api/v1/db/upsert-csv.test.ts` (RPC name and payload; a refusal is a 500 with no insert), plus the existing identity tests.

**Rehearsed** (`HARDEN-CHECK.txt`):
- apply, then a second apply refuses;
- as service_role: create, insert, read;
- an existing table is left alone;
- the new table's ACL is service_role SELECT and INSERT only, owner postgres, and anon gets nothing;
- injection in the table name, column name or type is refused;
- the reserved `player_id` column is refused;
- a shadowing name (`verdicts`) is refused;
- a `pg_` prefix is refused;
- `execute_sql` is denied to service_role; anon and authenticated cannot call the new function;
- rollback, then re-harden.

**Today's route is already broken for new tables.** Production's default privileges for `postgres` in `public` grant nobody else anything, so a table created through `execute_sql` gives `service_role` no INSERT. Verified on the copy: "permission denied for table csv_probe_today". So today, a new-table CSV upload fails at its insert, and 12 postgres-owned public tables already lack service_role INSERT. The hardening fixes this for new tables.

**Every `execute_sql` caller, and the impact:**

| Caller | Surface | After the revoke |
| --- | --- | --- |
| `pages/api/v1/db/upsert-csv.ts`, called from `pages/db/upsert-projections.tsx` | Deployed admin route | Switched to `csv_create_table_v1`. Works. Deploy the code **before** the revoke. |
| `scripts/sql-refresh-validation.ts` (REFRESH MATERIALIZED VIEW ×3, `refresh_team_power_ratings`) | Local script, run by hand | Fails. Run it as an operator through psql or `SUPABASE_DB_URL`, or add a narrow refresh definer later. |
| `scripts/sql-refresh-team-power-validation.ts` | Local script | Same as above |
| `scripts/cron-audit-runner.ts` (the SQL-only cron jobs in `cron-schedule.md`) | Local benchmark script | Same as above |
| pg_cron jobs, migrations, functions/, edge functions, CI | — | None call it |
| The Supabase MCP connector's `execute_sql` tool | Management API | Unaffected; it is a different thing |

## 3. Removing POSTGRES_\* and SUPABASE_JWT_SECRET from Vercel: what that fixes and what it doesn't

**What removal fixes:** new deployments no longer carry those values.

Nothing in the repository reads `POSTGRES_URL`, `POSTGRES_PASSWORD`, any other `POSTGRES_*` variable, or `SUPABASE_JWT_SECRET`, so removing them breaks no code.

**What removal does not fix:**
- **Old deployments.** Vercel bakes environment values into each deployment. Every earlier deployment keeps them, and they stay reachable through their own deployment URLs until they are deleted or protected.
- **Copies elsewhere.** Anyone or anything that already read the values (a deployment, a build log, a teammate, a local `.env`) still holds working credentials. **Only rotation revokes them.**
- **`execute_sql` is independent.** The escalation through `execute_sql` uses only the service role key, which the writer legitimately holds. Env removal alone leaves F1–F4 open; the revoke above closes them.
- **`SUPABASE_DB_URL` was not in the audit list, but the deployed code reads it:**
  - `lib/underlying-stats/playerStatsLandingServer.ts` and `adminRouteHelpers.ts` (the `/api/v1/underlying-stats/players*` routes and the db catch-up and backfill routes);
  - `functions/lib/postgres.py` (`fetch_team_table`).
  If it holds the `postgres` user and password, it is the same exposure as `POSTGRES_*` and needs the same decision. Check its user in Vercel.
- **The JWT secret.** With `SUPABASE_JWT_SECRET`, the writer can mint a `forge_witness_api` token. While the verifier is armed (`set-witness-credential.sql` grants `forge_witness_api` to authenticator), it could call `record_v1` directly and skip the route's RFC 3161 check. The database re-checks hashes and timing, but not the TSA signature. **Env removal does not make this secret unknown.**

**Rotating the database password (postgres user):**
- **Breaks** every holder of the old URL or password:
  - `SUPABASE_DB_URL` in Vercel, for both the web and functions projects if set;
  - `web/.env.local` for every local and `tasks/` operator script (`pgpool.sh` ×4, the `blsh` readers, the `drm` and `forge` operator scripts);
  - any `POSTGRES_*` values from the Vercel integration (unused).
- **Behavior after rotation:**
  - `adminRouteHelpers` falls back to PostgREST on any error.
  - `playerStatsLandingServer` falls back only on connection or timeout errors. A "password authentication failed" error would likely make the `/api/v1/underlying-stats/players*` routes return 500 until `SUPABASE_DB_URL` is updated (inferred, not tested).
  - `fetch_team_table` silently uses its hard-coded seasons.
- **Unaffected:** PostgREST and supabase-js (key-based), pg_cron jobs inside the database, and the dashboard.
- **Needs a new production deployment** to pick up the new `SUPABASE_DB_URL`. Old deployments then fail to connect, which is the point.

**Rotating the legacy JWT secret** (from Supabase's docs: "JWT Signing Keys" and "Migrating to publishable and secret API keys"; I read keyword-filtered excerpts, not the full pages):
- **Legacy rotation:**
  - Signs out every active user immediately.
  - Forces `anon` and `service_role` to rotate together. The new keys must reach:
    - Vercel (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY`/`_ANON_KEY`, which are inlined at build, so a rebuild is needed);
    - the anon keys committed in `web/.env.production`, `.env.development` and `.env.test`;
    - GitHub `rankings-e2e` secrets;
    - functions/ (`nst_admission.py`);
    - edge functions (whether they auto-inject is unverified);
    - local `.env` files.
  - Re-mint `FORGE_SANDBOX_API_TOKEN` and the witness token.
  - **Side effect:** `lib/draft-ranker/communityServer.ts:403` uses `SUPABASE_SERVICE_ROLE_KEY` as the HMAC key for community pseudonyms, so every pseudonym changes.
- **Lower-downtime path:** migrate to JWT signing keys plus publishable and secret API keys. Then revoke the legacy secret, after which `SUPABASE_JWT_SECRET` mints nothing that is accepted.
  - The docs say this needs no downtime and signs no one out if you wait one token lifetime (plus 15 min) before revoking.
  - Secret API keys aren't JWTs and can be rotated one at a time.
  - Supabase also supports importing your own signing key, so the witness token can be minted with a private key that never enters Vercel. This needs a change to `witness_token_setup.py`.
  - This is a project-level change for TJ; it is not suitable for tonight.

**Bottom line:**
- The writer gate passes when **all** of the following hold:
  - the `execute_sql` revoke (section 2);
  - **no** database password or JWT signing secret reachable from Vercel production, including `SUPABASE_DB_URL` if it is the postgres user;
  - **rotation** of every such value already exposed. The database password, and the JWT secret or its replacement by signing keys.
- Track A's signed verdict removes the dependence on the JWT secret for the verdict itself. **It does not stop a postgres-password holder from disabling the trigger**, so the database password still needs rotating.

## 4. Order for production (all need TJ's approval)

1. Deploy a release that contains the new `upsert-csv` code.
2. Apply `harden-execute-sql.sql` as postgres, then re-run `writer-reach-audit.sql` sections A–E and G. Those sections are read-only and safe on production; **never run the probe section F on production.**
3. Rotate the database password, update `SUPABASE_DB_URL` wherever it is used, and remove `POSTGRES_*` (and `SUPABASE_DB_URL`, if it is the postgres user) from Vercel.
4. Decide on JWT secret rotation, or a move to signing keys, together with Track A.
