# E2 plan: remove the database-owner credential from the Vercel app (for the V1b design TJ chose to validate)

Revised Sun 2026-11-22 00:55Z (Sat 18:55 CST) by the managed-signer lane, after BLSH Chef's read-only R2 and R3 (`r1-hosted-20261122/R1-FINDINGS.md` and its R2/R3 section, `r2.out`, `r3-env-sources.tsv`).

This is validation only, under TJ's "BLSH S0-V1b+E2". **This lane changed nothing in production:** no rotation, key staging, migration, push or arming.

This lane's production reads were names and metadata only:
- Vercel env names;
- the deployment list and its SHA mapping;
- GitHub secret names;
- the commit list.

**One incident to disclose.** A research helper this lane started ran the Vercel CLI with the words `docs search`. CLI 48 treated them as deploy paths and refused with "Can't deploy more than one path" before any upload. I then listed the deployments of all six projects: **no new deployment exists**. The newest is the production redeploy at 00:25Z, which predates the helper.

## 0. Verdict

- **The boundary holds after E2.**
  - **Local proof:** 14/14 tests, 106 PASS lines, over production grants emulated exactly as R1, R1b and R2 read them.
  - **What it shows:** with every credential it keeps, the Vercel runtime cannot do any of the following:
    - read the keys or the bearer;
    - change the mandate, the policy, the signer's database objects or its BLSH cron jobs;
    - mint an approval that Y's verifier accepts.
  - **What remains:** denial of service only (§5).
- **No added cost:** E2 is dashboard work. It needs **0 builds and 0 redeploys**, and no paid service.
- **No blocker.** The R3 finding changes step 1. The integration owns two variables the app reads, so they are recreated as manual variables inside a build freeze. That needs no build, because each deployment keeps its own baked env.

## 1. Who uses the owner credential or an integration-owned variable today

| Holder | Uses it? | Evidence |
|---|---|---|
| Live production deployment `dpl_DAnfYkXBXG3twWnqP1XP9tGEnHbs` (redeploy of `523ba0108`) and the rollback deployments (`356f93a5d`, `c922514df`, `b37a0180d`, `2236ecb7c`, `096b78b62`, `f47905d28`, `3e360ae4c`, older) | They **hold** `POSTGRES_*` baked in. **No code reads them at any SHA.** | `git log --all -S` over web, functions, cms and webhooks finds only Docker-local `draft-pro` scripts. No dependency reads `process.env.POSTGRES_*`. Vercel docs: rollbacks keep their original env. |
| The same deployments, for the other integration-owned variables (R3) | **Two are read:** `SUPABASE_URL` by `web/pages/api/ThreeYearAverages/nstgamelog.py` (`os.getenv('SUPABASE_URL')`, **no fallback**), and `NEXT_PUBLIC_SUPABASE_ANON_KEY` by `pages/api/v1/transactions/ownership-{snapshots,trends}.ts` (the **last** fallback after the manual `SUPABASE_SERVICE_ROLE_KEY`). **Unread:** `SUPABASE_JWT_SECRET`, `SUPABASE_SECRET_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `git grep -w` at `523ba0108`, excluding tests and scripts. The other `SUPABASE_URL` matches either read `NEXT_PUBLIC_SUPABASE_URL` first (`nst_admission.py`, the Yahoo and NST scrapers) or run outside Vercel (`witnessEdgeCore.ts`, an Edge Function, and `forge-replay-run.ts`, which builds its own env) |
| 32 Vercel crons | No owner credential; supabase-js keys | same grep |
| pg_cron | Healthy, **134/134 succeeded** in 60 min (R2). Supabase-managed: "other Supabase managed services are updated automatically" | R2; Supabase roles doc |
| **Sessions** (R2) | **No unknown owner client.** The only `postgres` client session was R2 itself via Supavisor. Also present: 7 PostgREST `authenticator` sessions, the `supabase_admin` exporter, and platform workers (pg_cron scheduler, pg_net worker, TimescaleDB launcher) | `r2.out` |
| Operator tooling (this Mac) | **Yes:** `web/.env.local` `SUPABASE_DB_URL` (`pgpool.sh` ×4, BLSH, FORGE and DRM operators, several `web/scripts/*`) and `web/scripts/.env` `SUPABASE_DB` | `e2-inventory/` |
| Stale recovery copy (`fhfhockey-workspace-recovery-2026-10-24/.../web/.env.local`) | Holds an owner URL, unused | `e2-inventory/` |
| **Supabase↔Vercel integration** `icfg_7nf55HM63SBdtQcRy8Tpogr8` (`projectSelection: all`, read-write env vars) | **Owns 14 fhfhockey Production variables:** `POSTGRES_*` ×7, `SUPABASE_JWT_SECRET`, `SUPABASE_SECRET_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. It owns nothing in the other 5 projects. | R3 (`configurationId`) |
| **Manual** (stay untouched) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | R3 |
| Edge Functions (`forge-witness-verify`, `x-timeline-ingest`, `x-timeline-poll`) | Use the platform-injected service key, not `SUPABASE_DB_URL` | `supabase/functions/*` |

## 2. What happens to integration-owned variables, and whether a build is needed

**Vercel facts (§7):**
- Environment changes "only apply to new deployments", and Instant Rollback keeps a deployment's original variables.
- Deleting an integration configuration removes its "Project Env variables". Disabled integrations are removed after 30 days, along with their variables.
- What *removing a project from Manage Access* does to existing variables is **undocumented**.
- A variable with the same name and target **cannot be created twice** (403 "already exists"). So "recreate first, then cut" is impossible; the integration's copy must go before the manual one can exist.

**Therefore:**
- Step 1 runs inside a **build freeze**. No deploy happens between cutting the sync and recreating the two read variables, so no build ever sees them missing.
- The live deployment keeps its baked values throughout.

**Is a redeploy needed? No.**
- **Running deployments:** the live and rollback deployments keep their own baked env, including the identical `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus dead `POSTGRES_*` after rotation.
- **The next ordinary build** (the pilot's keyed push) reads the manual copies.
- **`NEXT_PUBLIC_*` at build:** Next.js inlines these values into the bundle at build time. Because the recreated value is **byte-identical**, the inlined constant is identical, so recreating it changes no behaviour, even for an old deployment promoted later.
- **Python functions** read `SUPABASE_URL` from their deployment's env at runtime, and that env is baked per deployment.

**The one exact choice: remove `fhfhockey` from the integration's project access. Do not uninstall the integration.**
- Uninstalling could act on the linked Supabase resource. Its marketplace/external link semantics are undocumented, and `vercel integration remove` requires deleting its resources first.
- The integration's only effect on this project is the env sync.
- The other five projects hold no integration variables. A names readback across all six projects becomes part of every pilot precheck (P4).

## 3. Cutover

**Conditions:**
- Each step needs TJ's approval; TJ does the dashboard steps.
- A quiet window: for example 15:00–16:00Z on a non-pilot day, outside 10:00–13:15Z and any NST window.
- **A build freeze from step 1 until step 2's readback passes.** No pushes, no redeploys, no promotions.

| # | Step | Readback | If it fails |
|---|---|---|---|
| 0 | **Done (R2, R3).** No unknown owner sessions; pg_cron healthy; the sources are known. | — | — |
| 1 | **Cut the sync:** Vercel → Integrations → Supabase → Manage Access → remove `fhfhockey`. | Names and **sources** of all `fhfhockey` variables (the R3 method), plus names for all 6 projects | **The integration's variables are gone:** go to step 2a. **They are still there, with `configurationId` intact:** go to step 2b. **Access can't be scoped:** stop and report. Do not uninstall. |
| 2a | **Recreate the two read variables** as **manual**, Production only, with values identical to the integration's: `SUPABASE_URL` (the project URL; not secret; equal to `NEXT_PUBLIC_SUPABASE_URL`) and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public anon key). **Do not recreate the other 12.** | Sources show exactly those two with `configurationId` = `-`, no other integration-owned names remain, and **0 `POSTGRES_*`** | A wrong value only matters at the next build. Fix it before the freeze lifts. |
| 2b | (If step 1 left them in place) **delete** all 14 integration-owned variables, then do step 2a. | Same as 2a | A delete that refuses because the variable is integration-managed means step 1 didn't take effect. Retry step 1. |
| 3 | **Stop local tooling.** No `psql` or `pgpool` session open. | `ps` | — |
| 4 | **Reset the database password** (Supabase → Database → Settings; Owner/Admin). TJ generates and keeps the value: **never chat, Vercel or Git.** | (a) **All 6 projects' names: still 0 `POSTGRES_*`**, at about +5 min and again at about +60 min. (b) **R2 again:** session counts, pg_cron status counts (expect `succeeded` only), and no `postgres` client backend older than the reset. | **Variables re-added** (the sync wasn't really cut): they hold the *new* password. Delete them, repeat step 1, and **reset again**. Nothing was built, so no deployment carried them. **pg_cron failures:** stop and report (Supabase says managed services update themselves). **Operator lockout:** the SQL editor uses account login; TJ resets again and pastes. |
| 5 | **Update the legitimate holders:** TJ pastes the new value into `web/.env.local` (`SUPABASE_DB_URL`) and `web/scripts/.env` (`SUPABASE_DB`). Optionally delete the stale recovery copy. | One `select 1` through `pgpool.sh` | A paste error gives "password authentication failed". Repeated failures can trip the Supavisor circuit breaker (Supabase troubleshooting doc); wait, then re-paste. |
| 6 | **Only if step 4's R2 shows them:** end owner sessions that predate the reset, with `pg_terminate_backend(pid)` for exactly the listed PIDs. Never `supabase_admin`, never platform workers. `postgres` holds `pg_signal_backend` (R2). | R2: none older than the reset | **Unknown consumer reconnects and fails:** identify it from the Postgres log count `password authentication failed for user "postgres"`. If it is legitimate and not Vercel, give it the new value in its own secret store. |
| 7 | **Watch for 30 min**, then **lift the freeze** | Postgres auth-failure count; Vercel runtime errors for `/api/ThreeYearAverages/nstgamelog` and `/api/v1/transactions/ownership-*`; R2 pg_cron counts | **A Vercel path breaks:** that contradicts §1. Stop. **Instant Rollback** to the previous deployment keeps its own env (Vercel docs). Report before changing anything. |

**Cost:** about 60 min of TJ's time, 0 builds, $0. **A reset has no undo;** recovery means distributing the new value.

## 4. Boundary proof (`proof/`; `./proof/run-proof.sh`, about 25 s)

**Result:** **14/14 tests, 106 PASS lines, 4 FINDING lines, 3 RESIDUAL lines.** The E2 block adds 3 tests, with lines prefixed `E2` in `proof/out/proof-log.txt`.

**The harness emulates production as R1, R1b and R2 read it:**
- **`service_role`:**
  - BYPASSRLS, `fhfh_internal` USAGE, BLSH table SELECT;
  - Vault read and write;
  - **EXECUTE** on `cron.schedule` and `cron.unschedule(bigint)` and on `net.http_get`/`http_post`;
  - **SELECT on all of `cron.job`**, and **writes** to `cron.job_run_details`;
  - **no** `net.http_request_queue` or `_http_response` read, and **no** `execute_sql`.
- **`authenticator`** can assume `anon`, `authenticated` and `service_role`.
- **pg_cron 1.4.2 semantics** (source below):
  - jobs are keyed on (jobname, username), and the caller is recorded as `username`;
  - unscheduling another role's job needs DELETE on `cron.job`; the error is "permission denied for table job";
  - a job runs as its `username`;
  - RLS policies apply; `alter_job` is owner-only, and `service_role` can't execute it (R2).

| Vercel credential (after E2) | Keys or bearer | Mandate, policy, signer objects, BLSH jobs | Accepted approval |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` (manual), `SUPABASE_SECRET_KEY` (deleted in step 2), a `SUPABASE_JWT_SECRET`-minted `service_role` (secret deleted from Vercel in step 2) | **Denied** | **Denied:** evidence/step functions, signer URL, steps, ledger, INSTALL pin, native/context rows, `execute_sql`. **Cron (R2):** (a) no job command embeds the bearer or the grant: they are read at run time, and the AUTOMATE-ONCE, AUTOMATE-ONCE-SUPABASE and SCHEDULE-ONCE texts carry no secret literal; (b) `cron.unschedule` of the postgres dispatch job → "permission denied for table job", UPDATE/DELETE on `cron.job` are denied, and a same-name `cron.schedule` creates a **separate** `service_role` job while the postgres job stays byte-identical; (c) a `service_role`-scheduled job **runs as `service_role`** and is denied the keys, the ledger, a signer step, the evidence function and step resets. The mandate is an Edge Function secret. | **No.** Signatures from any other key → Y returns `approval_invalid` for both routes |
| `net.http_post` / `http_get` as `service_role` | (d) Reaches the signer only **without** the bearer → 403 `trigger_bearer_required`, with no evidence query. It can't read the bearer (private table) or the queue (R2) | — | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY`, anon/publishable keys, JWT-minted `anon`/`authenticated` | **Denied** | **Denied** | No |
| `POSTGRES_*` | Today: yes (RESIDUAL, proved over TCP with SCRAM). After step 2 they are absent from Vercel; after step 4 old logins **fail**; held sessions are **ended** in step 6 (proved) | — | — |

**Checks kept, at Y's handlers and at the signer:**
- replay of both envelopes → `already_claimed`, still 1 context run and 1 official run;
- late official grant → `outside_official_slot`;
- signer: one-shot `duplicate_request`, official after issuance → `evidence_conflict`, expiry, wrong slate, stop switch `signer_disarmed`;
- the earlier V1b suites: missing or mismatched receipt, deployment, SHA and slate; a concurrent pair → one; key swap and delete; selfcheck.

**Denial of service only (never an accepted approval):**
- `service_role` can overwrite or pre-create the Vault grant, which Y then refuses (`approval_invalid`), or the 12:42 step refuses;
- it can write `cron.job_run_details`, which is observability only: steps, ledger and dispatch rows are unchanged (proved);
- it can schedule its own jobs, which run with its own denied privileges.

The earlier "bearer visible in the pg_net queue" DoS **does not apply** to `service_role`: R2 shows it can't read the queue.

**Still trusted (they can read the keys or change the signer):**
- Supabase org Owner, Administrator and Developer: SQL editor, Edge Function deploy and secrets;
- personal access tokens: the Management API, **the Supabase MCP connector in these agent sessions**, and the CLI (`cli_login_postgres`);
- the new DB password on this Mac;
- `supabase_admin` and Supabase staff;
- Vercel team members, who can re-add variables or deploy. They no longer find any Supabase owner credential or JWT secret in Vercel.

**Not proven:**
- the real behaviour of Manage Access removal (step 1's readback decides 2a or 2b);
- the reset's effect on live connections (R2 after step 4);
- the real Edge runtime.

## 5. Approval lines (each separate)

| Line | Who | What |
|---|---|---|
| **E2-1** | TJ (BLSH Chef confirms the freeze) | Start the build freeze. Step 1, then the step 2a/2b readback, then recreate `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as manual Production variables with identical values |
| **E2-2** | TJ | Steps 3–5: stop tooling, reset the password, update the 2 local files, readbacks (all-project names at +5 and +60 min; R2) |
| **E2-3** | TJ, only if R2 lists pre-reset owner sessions | Step 6: `pg_terminate_backend` for the listed PIDs |
| **E2-4** | BLSH Chef | Step 7: watch, then lift the freeze |

**Exact next approval: E2-1** (TJ). Then V1b's S1–S6, where S4 `/selfcheck` confirms the Edge runtime after the reset. **Slate plan unchanged:** Nov 27 (capture Sat 11-28 12:05Z).

## 6. Proof files

- `proof/harness/managedSigner.proof.test.ts` (E2 blocks at the end)
- `proof/sql/R2-READONLY.sql`
- `proof/out/{vitest.txt, proof-log.txt, r2-local-emulation.txt}`
- production reads: `r1-hosted-20261122/`

## 7. Sources

- **pg_cron v1.4.2** (Supabase runs 1.4-1):
  - [src/job_metadata.c](https://github.com/citusdata/pg_cron/blob/v1.4.2/src/job_metadata.c): `EnsureDeletePermission` checks owner or `ACL_DELETE` on `cron.job`; schedule uses `on conflict on constraint jobname_username_uniq`; `alter_job` is limited by `username = $n` unless superuser; and "must be superuser to create a job for another role".
  - [pg_cron.sql](https://github.com/citusdata/pg_cron/blob/v1.4.2/pg_cron.sql): `cron_job_policy ... USING (username = current_user)`.
  - [pg_cron--1.2--1.3.sql](https://github.com/citusdata/pg_cron/blob/v1.4.2/pg_cron--1.2--1.3.sql): the `(jobname, username)` unique index and `cron_job_run_details_policy`.
  - In [src/pg_cron.c](https://github.com/citusdata/pg_cron/blob/v1.4.2/src/pg_cron.c), jobs connect as `username`.
- **Vercel:**
  - [Environment variables](https://vercel.com/docs/environment-variables): changes apply to new deployments only.
  - [Instant Rollback](https://vercel.com/docs/instant-rollback).
  - [Delete an integration configuration](https://vercel.com/docs/rest-api/integrations/delete-an-integration-configuration): removes its Project Env variables.
  - [Manage integrations](https://vercel.com/docs/integrations/install-an-integration/manage-integrations-reference): disabled integrations are removed after 30 days with their variables; Manage Access steps.
  - [Create environment variables](https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables): 403 when a variable already exists.
  - [CLI integration](https://vercel.com/docs/cli/integration): `remove` requires deleting resources first.
- **Next.js:** [Environment variables](https://nextjs.org/docs/pages/guides/environment-variables): `NEXT_PUBLIC_` values are inlined into the bundle during `next build`.
- **Supabase:**
  - [Postgres roles](https://supabase.com/docs/guides/database/postgres/roles): reset, no downtime, managed services updated.
  - [Supavisor: password authentication failed after rotation](https://supabase.com/docs/guides/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation).
  - [Supavisor: circuit breaker after rotation](https://supabase.com/docs/guides/troubleshooting/supavisor-error-circuit-breaker-open-after-password-rotation-0fdb72).
  - [Changelog: Edge Function secrets updated on reset](https://supabase.com/changelog/18972-edge-functions-secrets-should-now-get-updated-upon-resetting-db-password-or-jwt-secret).
  - [Vercel Marketplace integration](https://supabase.com/docs/guides/integrations/vercel-marketplace).
- **PostgreSQL 15:** [Server signalling functions](https://www.postgresql.org/docs/15/functions-admin.html): `pg_terminate_backend` and `pg_signal_backend`.
