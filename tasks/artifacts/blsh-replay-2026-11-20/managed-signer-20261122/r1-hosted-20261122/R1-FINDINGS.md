# R1 on production: findings (BLSH Chef, Sun 2026-11-22 about 01:4xZ)

Read-only, run once through the operator path in a `READ ONLY` transaction with rollback. It read catalog metadata and Vercel environment-variable names only: no secret values, no row data. Raw output is in `r1.out` (R1-READONLY.sql), `r1-followup.out` (ACLs) and `read-at.txt`.

| # | Fact | Production | What it means for PROPOSAL-SUPABASE.md |
|---|---|---|---|
| 1 | `public.execute_sql(text)` | ACL `{postgres=X/postgres}`. **`service_role` cannot execute it.** | **E1 is already in effect in production.** The FORGE writer hardening (`forge-writer-hardening-2026-11-19/harden-execute-sql.sql`) was applied. The repo is behind: migrations `20260716112908` and `20260820013120` still grant it to `service_role`, so reapplying them would restore the grant. E1 becomes **repo reconciliation**: a migration that matches production, plus moving the three script consumers. It needs no production change. Owner: the migration-authority owner. |
| 2 | Other `SECURITY DEFINER` dynamic-SQL functions `service_role` can execute | `public.csv_create_table_v1(text,jsonb)` (postgres), `pgsodium.mask_role(regrole,text,text)` (supabase_admin, ACL null, so PUBLIC) | **`csv_create_table_v1`** is the hardening's narrow definer: a validated identifier regex, a fixed type map, `%I` formatting, and it creates only new `public` tables. It **cannot reach** `fhfh_internal`. **`mask_role`** is the pgsodium masking-view builder already reviewed on Nov 21 (pgsodium-indirect check). Neither gives arbitrary SQL, so the decision rule is not tripped, but the proposal should name both. |
| 3 | `service_role` attributes | NOSUPERUSER, NOCREATEROLE, **BYPASSRLS**, member of **`pgsodium_keyholder`** | BYPASSRLS doesn't matter for the V1b table, which is privilege-gated, not RLS-gated. Keyholder membership drives fact 4. |
| 4 | Vault | `vault.secrets` / `decrypted_secrets` ACL: `supabase_admin` and `pgsodium_keyiduser`. **`has_table_privilege('service_role', …, 'select')` = true on both.** (R1 item 4's `information_schema` query returned 0 rows because it hides grants made through membership.) | **V1 (keys in Vault) is confirmed out:** the Vercel app's key can read decrypted Vault secrets. It can also run `vault.create_secret` and `update_secret`. |
| 5 | `fhfh_internal` | owner postgres; **`service_role` has USAGE**; 0 default ACLs | V1b's AUTOMATE check (no table privilege for `service_role`) still holds. The USAGE grant is harmless for a table with no grant, but note it. |
| 6 | Extensions | pg_cron 1.4-1, pg_net 0.8.0, pgsodium 3.1.8, supabase_vault 0.2.8 | As assumed. |
| 7 | **Vercel production env (names only)** | **`POSTGRES_URL`, `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`, `POSTGRES_HOST`, `POSTGRES_DATABASE` and `SUPABASE_JWT_SECRET` are present.** | **This is the blocker the proposal missed.** The FORGE hardening doc (§3) records `POSTGRES_*` as the `postgres` user's credentials. So **the verifying app's runtime env, and anyone who can read Vercel env or deploy, holds the database-owner password**, which can read V1b's key table. "Vercel deploy credentials: No" (§3 of the proposal) is wrong today. **V1b is not independent of the verifying app** until that password is rotated and the `POSTGRES_*` variables are removed from Vercel. The hardening doc says nothing in the repo reads them. Rotation must account for every holder: the operator `pgpool.sh`, which reads `SUPABASE_DB_URL` from `web/.env.local`, plus anything else. `SUPABASE_JWT_SECRET` only mints PostgREST roles (anon, authenticated, service_role, plus any role granted to `authenticator`), so on its own it does not reach V1b's table. |

## Net effect

- **V1 (Vault keys) is out**, now confirmed on production.
- **V1b (private-table keys)** needs the existing E1 state, which production already has, **plus E2**:
  - rotate the Supabase database password;
  - remove `POSTGRES_*` from Vercel production (and from any other project that holds them);
  - update every legitimate holder.
  - Without E2, the verifying app holds a credential that can read the signing keys.
- **V2 (no keys, a permit in Supabase)** has the same E2 dependency, because `postgres` could insert a permit.
- **Supabase project admins and access-token paths** (Owner, Administrator, Developer, the MCP connector, the CLI, Edge deployers, staff) can read or forge under every Supabase option. That is the accepted-risk line TJ would sign.

## R1b (Sun 2026-11-22 about 02:2xZ; `r1b.out` plus the Vercel integration list, read-only)

- **Roles `authenticator` can assume** (what a `SUPABASE_JWT_SECRET`-minted token reaches): `anon` and `authenticated`, both with no `fhfh_internal` usage, and `service_role`, which has BYPASSRLS and `fhfh_internal` USAGE but **no table grant under V1b; AUTOMATE refuses otherwise**. `forge_witness_api` is not currently granted. **So `SUPABASE_JWT_SECRET` does not reach V1b's keys**, matching the proposal.
- **Login roles:** `authenticator`, `cli_login_postgres` (Supabase CLI login; an admin path), `pgbouncer`, `postgres` (CREATEROLE), `supabase_admin` (super), `supabase_auth_admin`, `supabase_functions_admin`, `supabase_read_only_user`, `supabase_replication_admin`, `supabase_storage_admin`. Nothing unexpected; all are platform or admin paths.
- **The Supabase↔Vercel integration IS installed:** `icfg_7nf55HM63SBdtQcRy8Tpogr8`, slug `supabase`, marketplace/external, **`projectSelection: all`**, scopes include **`read-write:project-env-vars`**. It is installed, but this read shows only scopes, not whether it actually syncs. So **E2 step 2 is required:** disconnect the integration's env sync for `fhfhockey` (or remove the integration) **before** the password reset. Otherwise the reset may write a new `POSTGRES_*` back into Vercel.

## R2 and R3 (Sun 2026-11-22 00:48Z; `r2.out`, `r3-env-sources.tsv`; read-only, names and counts only)

**R2: sessions and privileges**
- **Sessions:** the only `postgres` client session was this R2 itself (Supavisor, 00:48). There were 7 PostgREST `authenticator` sessions and the platform's `supabase_admin` exporter, plus the usual background workers. **No unknown owner client.**
- **Cron health:** pg_cron had 134 succeeded runs in 60 minutes and 0 failed.
- **Termination:** `postgres` holds `pg_signal_backend` and is not a superuser.
- **New `service_role` reach the E2 plan must cover:**
  - EXECUTE on `cron.schedule` (2- and 3-argument forms), `cron.unschedule(bigint)`, `net.http_get` and `net.http_post`;
  - SELECT on `cron.job`, which matters because `service_role` is BYPASSRLS and so sees every job's command text;
  - SELECT **and write** on `cron.job_run_details`.
- **Questions this raises:**
  1. Do any AUTOMATE-ONCE-SUPABASE or SCHEDULE-ONCE job commands embed the bearer or a grant literally? `service_role` can read every command.
  2. Can `service_role` unschedule or alter BLSH jobs owned by `postgres`?
  3. A `service_role`-scheduled job runs as `service_role`, so it gains no extra privilege. Confirm.
  4. Run-history tampering is an observability and DoS concern only.

**R3: `fhfhockey` env variable sources**
- **Owned by the Supabase integration (`icfg_7nf55…`, Production only):**
  - all 7 `POSTGRES_*`;
  - `SUPABASE_JWT_SECRET`, `SUPABASE_SECRET_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_URL`;
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Manual:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- **Code at `523ba0108` that reads integration-owned names:**
  - `SUPABASE_URL`: 12 non-test files, including the Python route `web/pages/api/ThreeYearAverages/nstgamelog.py` and `functions/lib/nst_admission.py`;
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 7 files, listed by the command that produced this.
- **Consequence:** removing the integration, or its access, could delete variables the app reads. E2 must recreate any read integration-owned variable as a manual one **before** cutting the sync, or prove the cut leaves them in place.

## Chef check of E2-PLAN.md (revised), Sun 2026-11-22 about 01:1xZ

- **Proof rerun by Chef:** 14/14. SHA256SUMS OK.
- **Correction to E2-PLAN §1:** `dpl_DAnfYkXBXG3twWnqP1XP9tGEnHbs` (00:25Z, `source: cli`, target production, **no alias**) is **not** the live production deployment. The fhfhockey.com alias is still `dpl_w4ThHx3Y9McLFEYUygUusxGPRfkh` on `523ba0108` (`vercel inspect fhfhockey.com`, about 01:1xZ). `dpl_DAnf…` matches the News/Luna "deployment-specific, no domain assignment" single-job pattern. No BLSH lane made it, and the managed-signer lane's refused CLI call came after it. It holds the same baked env, so the plan's conclusions are unchanged.
