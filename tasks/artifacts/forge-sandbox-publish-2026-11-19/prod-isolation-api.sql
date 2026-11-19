-- Read-only production audit for the proposed forge_sandbox_api role. Safe before or after installation: it changes
-- nothing. Before installation the role does not exist yet, so it reports what any new role inherits from PUBLIC
-- (which is exactly what forge_sandbox_api would have outside its own grants). Prints one JSON line.
-- Exposed schemas default to the proposed Data API value; set psql variable exposed to override, e.g.
--   psql -v exposed='public,graphql_public,forge_sandbox_api' -f prod-isolation-api.sql
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
\if :{?exposed}
\else
\set exposed 'public,graphql_public,forge_sandbox_api'
\endif
select set_config('forge_audit.exposed', :'exposed', false);
with who(rolname) as (
  select case when exists (select from pg_catalog.pg_roles where rolname = 'forge_sandbox_api') then 'forge_sandbox_api' else 'public' end),
exposed(nsp, nspname) as (
  select n.oid, n.nspname from pg_catalog.pg_namespace n
  where n.nspname = any (string_to_array(replace(current_setting('forge_audit.exposed'), ' ', ''), ','))),
-- Relations in exposed schemas the role can read or write (PUBLIC and inherited grants included).
relations as (
  select e.nspname || '.' || c.relname as relation, c.relkind::text as kind,
    array_remove(array[case when pg_catalog.has_table_privilege(w.rolname, c.oid, 'SELECT') then 'SELECT' end,
      case when pg_catalog.has_table_privilege(w.rolname, c.oid, 'INSERT') then 'INSERT' end,
      case when pg_catalog.has_table_privilege(w.rolname, c.oid, 'UPDATE') then 'UPDATE' end,
      case when pg_catalog.has_table_privilege(w.rolname, c.oid, 'DELETE') then 'DELETE' end,
      case when pg_catalog.has_table_privilege(w.rolname, c.oid, 'TRUNCATE') then 'TRUNCATE' end], null) as privileges
  from who w cross join exposed e join pg_catalog.pg_class c on c.relnamespace = e.nsp
  where c.relkind in ('r', 'p', 'v', 'm', 'f') and pg_catalog.has_schema_privilege(w.rolname, e.nsp, 'USAGE')),
-- Functions in exposed schemas the role can EXECUTE (callable as /rpc/... once the schema is in the Data API).
functions as (
  select e.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' as fn,
    p.prosecdef as definer, pg_catalog.pg_get_userbyid(p.proowner) as owner, p.provolatile::text as volatility,
    p.prosrc ~* 'pgsodium' as mentions_pgsodium,
    p.prosrc ~* '(insert\s+into|update|delete\s+from|truncate)\s+[\w."]*(forge|player_forecast|starter_board|rolling_player|projection|roster_optimizer|fhfh_)' as writes_forge,
    p.prosrc ~* '\m(grant|revoke|alter\s+role|create\s+role|set\s+role|security\s+label)\M' as runs_privilege_ddl,
    p.prosrc ~* '\mexecute\M' as dynamic_sql
  from who w cross join exposed e join pg_catalog.pg_proc p on p.pronamespace = e.nsp
  where pg_catalog.has_schema_privilege(w.rolname, e.nsp, 'USAGE') and pg_catalog.has_function_privilege(w.rolname, p.oid, 'EXECUTE')),
-- pgsodium reachability: direct (only if pgsodium were exposed) and through exposed definers that name it.
sodium as (
  select p.proname, p.prosecdef, pg_catalog.has_function_privilege(w.rolname, p.oid, 'EXECUTE') as executable
  from who w cross join pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'pgsodium' and p.proname in ('mask_role', 'update_mask', 'create_key', 'update_masks'))
select json_build_object(
  'evaluatedAs', (select rolname from who),
  'exposedSchemas', (select json_agg(nspname) from exposed),
  'roleExists', exists (select from pg_catalog.pg_roles where rolname = 'forge_sandbox_api'),
  'apiRoleAttributes', (select json_build_object('login', rolcanlogin, 'super', rolsuper, 'createrole', rolcreaterole, 'bypassrls', rolbypassrls,
      'inherit', rolinherit, 'config', rolconfig) from pg_catalog.pg_roles where rolname = 'forge_sandbox_api'),
  'apiRoleMemberOf', (select coalesce(json_agg(g.rolname), '[]') from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid = m.member
      join pg_catalog.pg_roles g on g.oid = m.roleid where r.rolname = 'forge_sandbox_api'),
  'membersOfApiRole', (select coalesce(json_agg(r.rolname), '[]') from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid = m.member
      join pg_catalog.pg_roles g on g.oid = m.roleid where g.rolname = 'forge_sandbox_api'),
  'schemaUsage', (select json_object_agg(e.nspname, pg_catalog.has_schema_privilege(w.rolname, e.nsp, 'USAGE')) from who w cross join exposed e),
  'writableRelations', (select coalesce(json_agg(r) filter (where r.privileges && array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']), '[]') from relations r),
  'readableRelationsOutsideApi', (select coalesce(json_agg(r.relation) filter (where 'SELECT' = any (r.privileges) and r.relation not like 'forge\_sandbox\_api.%'), '[]') from relations r),
  'executableFunctionsOutsideApi', (select count(*) from functions where fn not like 'forge\_sandbox\_api.%'),
  'executableDefinersOutsideApi', (select coalesce(json_agg(f) filter (where f.definer and f.fn not like 'forge\_sandbox\_api.%'), '[]') from functions f),
  'exposedFunctionsReachingPgsodium', (select coalesce(json_agg(f.fn) filter (where f.mentions_pgsodium), '[]') from functions f),
  'exposedDefinersWritingForge', (select coalesce(json_agg(f.fn) filter (where f.definer and f.writes_forge), '[]') from functions f),
  'exposedDefinersRunningPrivilegeDdl', (select coalesce(json_agg(f.fn) filter (where f.definer and (f.runs_privilege_ddl or f.dynamic_sql)), '[]') from functions f),
  'pgsodiumSchemaExposed', exists (select from exposed where nspname = 'pgsodium'),
  'pgsodiumEscalationFunctions', (select coalesce(json_agg(s), '[]') from sodium s),
  'verdict', case
    when exists (select from exposed where nspname = 'pgsodium') then 'unsafe: pgsodium exposed'
    when exists (select from functions f where f.fn not like 'forge\_sandbox\_api.%' and f.definer
      and (f.mentions_pgsodium or f.writes_forge or f.runs_privilege_ddl or f.dynamic_sql)) then 'review: exposed definers listed above are callable'
    when exists (select from relations r where r.privileges && array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) then 'unsafe: writable exposed relations'
    else 'ok' end);
