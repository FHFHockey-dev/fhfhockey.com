# Object-level access candidates — review only

These are **local review artifacts**, not migrations and not permission to change the hosted project. No hosted SQL or settings were changed. Recheck the live catalog, application consumers, current ownership and source hashes before approving or preparing any forward migration. All proposed browser-access changes can break unknown external clients.

## Current Data API settings

At approximately 13:25–13:35 UTC on 2026-10-29, the production project's [Data API settings](https://supabase.com/dashboard/project/fyhftlxokyjtpndbkfse/integrations/data_api/settings) showed the integration installed; `public`, `analytics`, `graphql_public` and `storage` selected as exposed; 179 of 508 tables and 55 of 249 functions shown as exposed; and **Automatically expose new tables on**. The selector marked `public.cron_job_audit`, `public.job_locks` and `public.acquire_lock` exposed. The dashboard flagged `storage` as a protected schema that should not be exposed. No setting was changed and no live Data API request was made.

The catalog shows RLS on all eight storage tables. `storage.objects` grants browser roles SELECT/INSERT/UPDATE/DELETE, but its only browser-role policies are restrictive and its two permissive policies target service_role; no browser-role permissive policy was found. Seven other storage tables have no policies. This metadata is not proof of a Storage API bypass or of every route's behavior. Treat removing `storage` from **Data API exposed schemas** as a separately reviewed settings decision, preserving `public`, `analytics` and `graphql_public`. First trace any direct PostgREST clients and verify Draft Pro private-import transport, line-combination image uploads and forecast artifact storage on a disposable setup. Do not revoke Storage's schema or table grants as a substitute: those privileges can also matter to the separate Storage service.

## 1. Future table creation: FORGE reserve

Supabase states existing table grants remain and new public tables require explicit opt-in after the rollout. No blanket default-privilege statement is proposed here. The current creator defaults for both `postgres` and `supabase_admin` are broad; re-read them and the dashboard setting after the platform transition. The old D4 default-privilege draft also affects functions and global PUBLIC EXECUTE, which is a separate decision.

The real pending FORGE migration already enables RLS, gives `anon` and `authenticated` SELECT through `public_read`, and gives `service_role` SELECT/INSERT/UPDATE/DELETE. Its browser-role revoke does not remove pre-existing service-role defaults. Proposed addition, in the same creation transaction **after** the existing grants, is [01-future-forge-grant.sql](01-future-forge-grant.sql):

```sql
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.forge_reserve_projections
  FROM service_role;
```

| Object | Intended browser access | Service access retained | Dependency and impact |
| --- | --- | --- | --- |
| `forge_reserve_projections` | SELECT, with current public-read RLS policy | SELECT, INSERT, UPDATE, DELETE | `persistence-stage.ts` upserts; `forgeDailyBridge.ts` reads when the reserve pass is enabled. The existing DELETE grant is retained pending the owner's planned resume cleanup; browser exposure is unchanged. |
| `rso_yahoo_past_lineups` | None; RLS enabled, no client policy | SELECT, INSERT, UPDATE, DELETE | `rosterPlanning.ts` reads/upserts and falls back to Yahoo when unavailable. The invoker purge function needs DELETE and service EXECUTE. The existing pending migration already specifies these grants; no change is proposed. |

The FORGE migration is Claude's leased source; obtain its owner's coordination before any edit. If the source amendment is reverted before table creation, remove the proposed additional statement from the candidate source. If the table has already been created, snapshot its **actual direct ACL and role memberships immediately before** the revoke and restore only privileges that were actually removed. For the verified broad-default local fixture, the privilege rollback is:

```sql
GRANT TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.forge_reserve_projections TO service_role;
```

Under the tested opt-in-default fixture those three grants were absent before the proposed revoke, so its ACL rollback is a no-op; do not issue the broad-default rollback in that case. A mixed or changed ACL needs a corresponding subset, using the captured grantor and grant-option information. Neither branch authorizes dropping the table or changing hosted defaults.

## 2. Existing operational tables

[02-legacy-operational-tables.sql](02-legacy-operational-tables.sql) individually removes the seven observed direct browser-role privileges from `public.cron_job_audit` and `public.job_locks`, and removes each named unconditional PUBLIC SELECT policy. RLS stays enabled. Current `service_role` privileges are untouched to avoid an unverified operational break; this is a targeted browser hardening step, not a claim that the remaining service ACL is fully least-privilege. No other table, role, default privilege or view is changed.

The 2026-10-29 catalog shows both tables owned by `postgres`, with seven direct non-grantable privileges each from `postgres` to `anon`, `authenticated` and `service_role`, no PUBLIC table grant and no explicit column grants. Both have only the named permissive PUBLIC SELECT policy. `anon` and `authenticated` have no inherited application-role memberships. A role-level metadata scan also found `postgres`, `service_role` and `supabase_read_only_user` effectively able to SELECT; those three have BYPASSRLS. A view-dependency catalog scan found no dependent views for these two tables. These observations are point-in-time, not proof of all clients or dynamic SQL.

| Object | Intended effect | Known dependency | Approval risk |
| --- | --- | --- | --- |
| `cron_job_audit` | Deny browser-role SELECT and other table privileges; default-deny RLS remains | `cron-report.ts` uses the service-role client for reads; audit wrappers insert, and rolling-resume/admin-health paths read through injected clients | Public or signed-in direct consumers will stop working; trace injected callers, external clients, retention/maintenance and alerting first. No service grant is revoked. |
| `job_locks` | Deny browser roles; default-deny RLS remains | `public.acquire_lock(text,interval)` is an invoker function that inserts/updates this table; service privileges remain | An anon/authenticated caller of the function would now fail. The repository search found no direct application caller, but external or scheduled clients are unknown. |

After a fresh matching pre-change snapshot, [02-legacy-operational-tables-rollback.sql](02-legacy-operational-tables-rollback.sql) restores the original seven direct browser grants and original permissive `TO PUBLIC USING (true)` SELECT policies. Executing it restores public-read behavior and therefore requires explicit authorization. Matching the original grantor requires an appropriately authorized `postgres` migration role; recheck any intervening ACL or policy changes before rollback.

For later service-role minimization, trace actual maintenance and retention first: the repository shows audit SELECT/INSERT and lock INSERT/UPDATE, but does not establish the absence of external service-role UPDATE/DELETE/TRUNCATE or DDL consumers. This packet intentionally does not revoke those privileges or assume a complete caller inventory.

## 3. Existing lock function: separate decision

[03-legacy-acquire-lock-function.sql](03-legacy-acquire-lock-function.sql) revokes EXECUTE on exactly `public.acquire_lock(text,interval)` from PUBLIC, anon and authenticated, preserving the observed direct service-role grant and owner execution. PostgreSQL PUBLIC means **all roles**, so this can also break non-browser roles that inherited EXECUTE from PUBLIC. The independent fixture demonstrates that impact. Inventory scheduled jobs, custom SQL roles and external consumers before approving; the table candidate alone already denies browser-role table access while leaving this function grant intact.

[03-legacy-acquire-lock-function-rollback.sql](03-legacy-acquire-lock-function-rollback.sql) restores the observed PUBLIC and direct browser-role EXECUTE grants. It deliberately widens function access and requires separate authorization. The actual rollback must be checked against a fresh pre-change ACL, including grantor and grant options.

## Verification and limits

The final local run passed on PostgreSQL 15.19 using a new, Unix-socket-only disposable cluster and synthetic fixtures. It:

- applied the exact two unmodified, SHA-pinned pending table migration files to synthetic dependencies under both broad and opt-in table defaults;
- reproduced the FORGE service-role excess privileges under broad defaults, applied the one-object proposed revoke, and checked seven privileges per role, RLS, real anon/authenticated reads, private-lineup denial and service INSERT plus conflict UPDATE;
- exercised the two legacy-table and function candidates on catalog-shaped fixtures, verified service audit reads/inserts and invoker lock acquisition, then executed and checked the two observed-state rollback scripts;
- confirmed the PUBLIC function revoke also removes a synthetic non-API role's inherited EXECUTE.

The sandboxed first attempt failed because `shmget` was denied; the successful run used approved local execution outside that sandbox. Both completed runs atomically acquired and released their own shared heavy-check lock, and stopped their own servers. The final cluster and its local logs remain at `/tmp/fhfh-supabase-acl-audit-s13wdzjz`. [LOCAL-TEST-RECEIPT.md](LOCAL-TEST-RECEIPT.md) records commands and hashes. This is a focused PG fixture, not a full production-schema replay, PostgREST/JWT test, Storage test or hosted acceptance test. No actual production rows were read.

## Required later authorization

The current task explicitly prohibits hosted changes. A later request must approve separately: (1) the exact FORGE creation candidate and source-owner coordination, (2) the operational-table SQL with its direct-client impact and rollback, (3) the function SQL with its all-roles PUBLIC impact and rollback, and (4) any Data API schema-setting change after dependency review. For each hosted action identify project `fyhftlxokyjtpndbkfse`, environment, exact ordered SQL or setting, file hash, preflight snapshot, expected impact and rollback. Production verification requests and any push/deploy require their own bounded authorization.
