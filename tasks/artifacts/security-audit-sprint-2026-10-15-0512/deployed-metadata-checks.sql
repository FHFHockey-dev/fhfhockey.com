-- PREPARED ONLY. This audit did not connect to or run SQL against any database.
-- An authorized database operator can run these bounded catalog reads after
-- confirming the target project and read-only session. No application rows,
-- function source bodies, credential values, or provider tokens are returned.
-- These checks do not invoke execute_sql, truncate, or application RPCs.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

-- Expect browser_can_execute=false and public_acl_execute=false for both RPCs.
-- PUBLIC is an ACL grantee with OID zero, not an entry in pg_roles.
WITH targets(signature) AS (
  VALUES ('public.execute_sql(text)'),
         ('public.truncate_rolling_player_game_metrics()')
), routines AS (
  SELECT signature, to_regprocedure(signature)::oid AS routine_oid FROM targets
), browser_roles AS (
  SELECT oid, rolname FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon', 'authenticated')
)
SELECT r.signature,
       r.routine_oid IS NOT NULL AS routine_exists,
       b.rolname,
       CASE WHEN r.routine_oid IS NULL THEN NULL
            ELSE pg_catalog.has_function_privilege(b.oid, r.routine_oid, 'EXECUTE')
       END AS browser_can_execute,
       p.prosecdef AS security_definer,
       EXISTS (
         SELECT 1
         FROM pg_catalog.aclexplode(
           coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
         ) AS a
         WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
       ) AS public_acl_execute
FROM routines AS r
CROSS JOIN browser_roles AS b
LEFT JOIN pg_catalog.pg_proc AS p ON p.oid = r.routine_oid
ORDER BY r.signature, b.rolname;

-- Confirm the restrictive entitlement policy exists for browser roles.
-- Fingerprints avoid returning expression text. Compare these against a known
-- reference database built from the accepted migration; existence alone does
-- not prove the predicate is correct. Missing rows are a verification failure.
SELECT policyname, permissive, roles, cmd,
       md5(coalesce(qual, '')) AS using_expression_fingerprint,
       md5(coalesce(with_check, '')) AS check_expression_fingerprint
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_entitlements'
  AND policyname = 'user_entitlements_draft_pro_service_only';

-- Read-only metadata for identity claims and operational audit exposure.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       md5(coalesce(qual, '')) AS using_expression_fingerprint,
       md5(coalesce(with_check, '')) AS check_expression_fingerprint
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('connected_accounts', 'cron_job_audit')
ORDER BY tablename, policyname;

-- Flag public tables that currently have RLS disabled and browser privileges.
-- Do not use this list to issue automatic revokes; consumers require review.
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       b.rolname,
       pg_catalog.has_table_privilege(b.oid, c.oid, 'SELECT') AS can_select,
       pg_catalog.has_table_privilege(b.oid, c.oid, 'INSERT') AS can_insert,
       pg_catalog.has_table_privilege(b.oid, c.oid, 'UPDATE') AS can_update,
       pg_catalog.has_table_privilege(b.oid, c.oid, 'DELETE') AS can_delete
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
CROSS JOIN (
  SELECT oid, rolname FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon', 'authenticated')
) AS b
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND NOT c.relrowsecurity
ORDER BY c.relname, b.rolname
LIMIT 300;

-- Default grants and event-trigger names only; no trigger/function source.
SELECT owner.rolname AS owner_role, n.nspname AS schema_name,
       d.defaclobjtype AS object_kind,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       a.privilege_type
FROM pg_catalog.pg_default_acl AS d
JOIN pg_catalog.pg_roles AS owner ON owner.oid = d.defaclrole
LEFT JOIN pg_catalog.pg_namespace AS n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS a
LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = a.grantee
WHERE owner.rolname = 'postgres'
  AND (n.nspname = 'public' OR d.defaclnamespace = 0)
  AND (a.grantee = 0 OR grantee.rolname IN ('anon', 'authenticated'))
ORDER BY schema_name, object_kind, grantee, privilege_type;

SELECT evtname, evtevent, evtenabled
FROM pg_catalog.pg_event_trigger
ORDER BY evtname;

ROLLBACK;
