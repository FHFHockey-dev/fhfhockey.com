# Security RPC rollout runbook

Prepared: 2026-08-19  
Target project: `fyhftlxokyjtpndbkfse` (`fhfhockey.com`)  
Authority: AUDIT-TASK-001 and AUDIT-TASK-002

## Scope and authorization boundary

This runbook covers exactly two independently deployable ACL-only migrations:

| Task | Migration | SHA-256 |
| --- | --- | --- |
| AUDIT-TASK-001 | `supabase/migrations/20260820013120_revoke_execute_sql_browser_roles.sql` | `fb2d6df0e1ea360bb49cc27db443f5924d18654698a25c0f712016703ac4415b` |
| AUDIT-TASK-002 | `supabase/migrations/20260820013124_revoke_truncate_rolling_metrics_browser_roles.sql` | `f037ac34a8a698d828ce4bb05210f7ca8964e4891c284f8cc5502a6fc4c3ce2c` |

Applying either migration is a production mutation and requires explicit authorization naming the migration. Authorization for one does not imply authorization for the other, later migrations, a general migration push, or any RPC invocation.

The routines must never be called during preflight or verification. Do not print environment values, use a browser-role request as a probe, run unrelated migrations, or inspect application data.

## Read-only preflight receipts

The 2026-08-19 catalog check found:

- `public.execute_sql(text)` is SECURITY DEFINER, owned by `postgres`, has pinned search path `pg_catalog, public, extensions, pg_temp`, and grants EXECUTE to `PUBLIC`, `anon`, `authenticated`, `postgres`, and `service_role`.
- `public.truncate_rolling_player_game_metrics()` is SECURITY DEFINER, owned by `postgres`, has pinned search path `public`, and grants EXECUTE to `anon`, `authenticated`, `postgres`, and `service_role`.
- The deployed migration ledger ends at `20260815023132_espn_fantasy_private_beta`; neither migration listed above is applied.

A resumed read-only check on 2026-08-26 produced the same ACL and migration-ledger state. PostgreSQL rendered the arbitrary-SQL routine identity as `public.execute_sql(sql_statement text)`; its callable type signature remains `public.execute_sql(text)`. Neither routine was invoked.

The latest read-only check on 2026-08-29 confirms both routines still grant effective EXECUTE to `anon` and `authenticated`, with `service_role` also retained. The Production ledger now contains 45 versions through `20260829161013`, but neither ACL migration in this runbook is present. The two Production-only ESPN versions `20260829133258` and `20260829133637` lack active source files and are tracked as a separate source-retention discrepancy. No routine was invoked or database state changed during this check.

Immediately before an authorized rollout, repeat the following catalog-only query and stop if the signatures, owner, SECURITY DEFINER state, search path, or grantee set differs:

```sql
select
  p.oid::regprocedure::text as function_identity,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  p.proconfig as configuration,
  pg_get_userbyid(p.proowner) as owner_name,
  coalesce(grantee_role.rolname, 'PUBLIC') as grantee,
  privilege.privilege_type,
  privilege.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) privilege
left join pg_roles grantee_role on grantee_role.oid = privilege.grantee
where n.nspname = 'public'
  and p.proname in (
    'execute_sql',
    'truncate_rolling_player_game_metrics'
  )
order by function_identity, grantee;
```

Also confirm the exact source hash above and verify that the target version is still absent from the deployed migration ledger. Source presence or migration-authority classification is not deployment authorization.

## Authorized application sequence

Apply one exact migration through the repository's normal migration mechanism. Do not paste or adapt its statements into a broader batch. A successful application must be followed immediately by the post-check before the second migration is considered.

Expected post-state for each affected signature:

- `postgres`: EXECUTE retained through ownership/ACL.
- `service_role`: explicit EXECUTE retained.
- `PUBLIC`: no EXECUTE.
- `anon`: no EXECUTE.
- `authenticated`: no EXECUTE.

Repeat the catalog query above and verify the applied migration version appears exactly once. This proves ACL state without executing the routine.

## Stop and rollback rules

Stop without changing anything further if:

- a function signature, owner, SECURITY DEFINER flag, or search path differs;
- a previously unknown non-browser grantee or evidenced consumer appears;
- the migration version is already present but the ACL does not match;
- the migration mechanism would also apply any unapproved migration;
- the post-check cannot be performed truthfully.

Do not restore `PUBLIC`, `anon`, or `authenticated` access as a generic rollback. If an evidenced privileged non-browser consumer fails, prepare a new, separately reviewed forward migration granting EXECUTE only to that exact operator role. Never edit an applied migration.

## Operator receipt

Record one receipt per migration:

| Field | Value |
| --- | --- |
| Task and migration | Pending |
| Explicit authorization reference | Pending |
| Target project ID | `fyhftlxokyjtpndbkfse` |
| Preflight timestamp and ACL summary | Pending |
| Verified source SHA-256 | Pending |
| Apply mechanism and result | Pending |
| Applied-ledger version observed | Pending |
| Post-check timestamp and ACL summary | Pending |
| RPC invoked during verification | Must remain `No` |
| Unexpected consumer or rollback action | Pending / None |

Until every applicable Pending field has authoritative evidence, AUDIT-TASK-001.4 or AUDIT-TASK-002.4 remains incomplete.
