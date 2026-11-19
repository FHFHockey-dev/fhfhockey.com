-- Read-only production audit for the FORGE witness verifier. Changes nothing; safe before or after installation.
-- Before installation it reports what a new role would inherit from PUBLIC (exactly what forge_witness_api would have
-- outside its own grants). After installation it also proves the receipt tables are writable only through the owner's
-- definers. Prints one JSON line with a verdict. Exposed schemas default to the proposed Data API value; override with
--   psql -v exposed='public,graphql_public,storage,analytics,forge_witness_api' -f prod-isolation-witness.sql
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
\if :{?exposed}
\else
\set exposed 'public,graphql_public,storage,analytics,forge_witness_api'
\endif
select set_config('forge_audit.exposed', :'exposed', false);
with who(rolname) as (
  select case when exists (select from pg_catalog.pg_roles where rolname = 'forge_witness_api') then 'forge_witness_api' else 'public' end),
installed(yes) as (select to_regclass('forge_witness.verdicts') is not null),
exposed(nsp, nspname) as (
  select n.oid, n.nspname from pg_catalog.pg_namespace n
  where n.nspname = any (string_to_array(replace(current_setting('forge_audit.exposed'), ' ', ''), ','))),
-- What the API role can reach in exposed schemas (PUBLIC and inherited grants included).
relations as (
  select e.nspname || '.' || c.relname as relation,
    array_remove(array[case when pg_catalog.has_table_privilege(w.rolname, c.oid, 'SELECT') then 'SELECT' end,
      case when pg_catalog.has_table_privilege(w.rolname, c.oid, 'INSERT') then 'INSERT' end,
      case when pg_catalog.has_table_privilege(w.rolname, c.oid, 'UPDATE') then 'UPDATE' end,
      case when pg_catalog.has_table_privilege(w.rolname, c.oid, 'DELETE') then 'DELETE' end,
      case when pg_catalog.has_table_privilege(w.rolname, c.oid, 'TRUNCATE') then 'TRUNCATE' end], null) as privileges
  from who w cross join exposed e join pg_catalog.pg_class c on c.relnamespace = e.nsp
  where c.relkind in ('r', 'p', 'v', 'm', 'f') and pg_catalog.has_schema_privilege(w.rolname, e.nsp, 'USAGE')),
functions as (
  select e.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' as fn,
    p.prosecdef as definer, pg_catalog.pg_get_userbyid(p.proowner) as owner,
    p.prosrc ~* 'pgsodium' as mentions_pgsodium,
    p.prosrc ~* '\m(grant|revoke|alter\s+role|create\s+role|set\s+role|security\s+label)\M' as runs_privilege_ddl,
    p.prosrc ~* '\mexecute\M' as dynamic_sql
  from who w cross join exposed e join pg_catalog.pg_proc p on p.pronamespace = e.nsp
  where pg_catalog.has_schema_privilege(w.rolname, e.nsp, 'USAGE') and pg_catalog.has_function_privilege(w.rolname, p.oid, 'EXECUTE')),
-- Receipt tables: every non-superuser role other than the owner holding a write privilege (expected: none).
receipt_writers as (
  select r.rolname, c.relname,
    array_remove(array[case when pg_catalog.has_table_privilege(r.oid, c.oid, 'INSERT') then 'INSERT' end,
      case when pg_catalog.has_table_privilege(r.oid, c.oid, 'UPDATE') then 'UPDATE' end,
      case when pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE') then 'DELETE' end,
      case when pg_catalog.has_table_privilege(r.oid, c.oid, 'TRUNCATE') then 'TRUNCATE' end], null) as privileges
  from installed i cross join pg_catalog.pg_roles r
  join pg_catalog.pg_class c on i.yes and c.relnamespace = to_regnamespace('forge_witness') and c.relkind = 'r'
  where not r.rolsuper and r.rolname <> 'forge_witness_owner' and r.rolname !~ '^pg_'),
-- Who can act as the owner (SET ROLE or inherit). Expected: nobody (an admin-only membership, PG16+, is reported).
owner_members as (
  select r.rolname as member, m.admin_option,
    pg_catalog.pg_has_role(r.oid, 'forge_witness_owner', 'USAGE') as inherits,
    pg_catalog.pg_has_role(r.oid, 'forge_witness_owner', 'MEMBER') as member_any
  from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid = m.member join pg_catalog.pg_roles g on g.oid = m.roleid
  where g.rolname = 'forge_witness_owner'),
-- Functions in forge_witness / forge_witness_api and who outside the owner may execute them.
witness_functions as (
  select n.nspname || '.' || p.proname as fn, pg_catalog.pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer,
    array(select r.rolname from pg_catalog.pg_roles r where r.rolname in ('public', 'anon', 'authenticated', 'service_role', 'forge_witness_api',
      'authenticator', 'postgres') and r.rolname <> pg_catalog.pg_get_userbyid(p.proowner)
      and pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE') order by 1) as executable_by
  from installed i cross join pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where i.yes and n.nspname in ('forge_witness', 'forge_witness_api')),
-- The owner's privileges outside its own schemas (expected: SELECT on the five custody tables only).
owner_outside as (
  select n.nspname || '.' || c.relname as relation,
    array_remove(array[case when pg_catalog.has_table_privilege(ow.oid, c.oid, 'SELECT') then 'SELECT' end,
      case when pg_catalog.has_table_privilege(ow.oid, c.oid, 'INSERT') then 'INSERT' end,
      case when pg_catalog.has_table_privilege(ow.oid, c.oid, 'UPDATE') then 'UPDATE' end,
      case when pg_catalog.has_table_privilege(ow.oid, c.oid, 'DELETE') then 'DELETE' end], null) as privileges
  from pg_catalog.pg_roles ow cross join pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where ow.rolname = 'forge_witness_owner' and c.relkind in ('r', 'p', 'v', 'm')
    and n.nspname not in ('forge_witness', 'forge_witness_api', 'pg_catalog', 'information_schema')
    and pg_catalog.has_schema_privilege(ow.oid, n.oid, 'USAGE')
    and (pg_catalog.has_table_privilege(ow.oid, c.oid, 'SELECT') or pg_catalog.has_table_privilege(ow.oid, c.oid, 'INSERT')
      or pg_catalog.has_table_privilege(ow.oid, c.oid, 'UPDATE') or pg_catalog.has_table_privilege(ow.oid, c.oid, 'DELETE'))),
-- SECURITY DEFINER functions the writer (service_role) can execute whose owner could write the receipts (a superuser or
-- the owner itself) AND that run dynamic SQL: the only remaining indirect write path. Expected: none from the owner.
writer_reach as (
  select n.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' as fn,
    pg_catalog.pg_get_userbyid(p.proowner) as owner
  from installed i cross join pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_roles o on o.oid = p.proowner
  where i.yes and p.prosecdef and p.prosrc ~* '\mexecute\M' and pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
    and pg_catalog.has_schema_privilege('service_role', n.oid, 'USAGE')
    -- Owners able to write the receipts: a superuser, the owner itself, or a CREATEROLE role (it can grant itself the owner).
    and (o.rolsuper or o.rolcreaterole or o.rolname = 'forge_witness_owner')),
-- The writer (service_role, the live publisher's credential): every privilege it holds on any object in the two
-- witness schemas. Expected exactly: USAGE on forge_witness, EXECUTE on publication_gate_v1 and require_accepted_v1.
writer_grants as (
  select 'schema ' || n.nspname as object, array_remove(array[
      case when pg_catalog.has_schema_privilege('service_role', n.oid, 'USAGE') then 'USAGE' end,
      case when pg_catalog.has_schema_privilege('service_role', n.oid, 'CREATE') then 'CREATE' end], null) as privileges
  from installed i cross join pg_catalog.pg_namespace n where i.yes and n.nspname in ('forge_witness', 'forge_witness_api')
  union all
  select 'relation ' || n.nspname || '.' || c.relname, array_remove(array[
      case when pg_catalog.has_table_privilege('service_role', c.oid, 'SELECT') then 'SELECT' end,
      case when pg_catalog.has_table_privilege('service_role', c.oid, 'INSERT') then 'INSERT' end,
      case when pg_catalog.has_table_privilege('service_role', c.oid, 'UPDATE') then 'UPDATE' end,
      case when pg_catalog.has_table_privilege('service_role', c.oid, 'DELETE') then 'DELETE' end,
      case when pg_catalog.has_table_privilege('service_role', c.oid, 'TRUNCATE') then 'TRUNCATE' end,
      case when pg_catalog.has_table_privilege('service_role', c.oid, 'REFERENCES') then 'REFERENCES' end,
      case when pg_catalog.has_table_privilege('service_role', c.oid, 'TRIGGER') then 'TRIGGER' end], null)
  from installed i cross join pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where i.yes and n.nspname in ('forge_witness', 'forge_witness_api') and c.relkind in ('r', 'p', 'v', 'm')
  union all
  select 'sequence ' || n.nspname || '.' || c.relname, array_remove(array[
      case when pg_catalog.has_sequence_privilege('service_role', c.oid, 'USAGE') then 'USAGE' end,
      case when pg_catalog.has_sequence_privilege('service_role', c.oid, 'UPDATE') then 'UPDATE' end], null)
  from installed i cross join pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where i.yes and n.nspname in ('forge_witness', 'forge_witness_api') and c.relkind = 'S'
  union all
  select 'function ' || n.nspname || '.' || p.proname, array['EXECUTE']
  from installed i cross join pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where i.yes and n.nspname in ('forge_witness', 'forge_witness_api') and pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')),
-- Where the verifier credential and the cron bearer travel, and whether the writer can see them. The credential is in
-- forge_witness.credentials (covered by writer_grants) and in pg_net's queue while a request is pending.
secret_reach as (
  select 'table ' || r as object, case when to_regclass(r) is null then null
    else pg_catalog.has_table_privilege('service_role', to_regclass(r), 'SELECT') end as service_role_select
  from unnest(array['forge_witness.credentials', 'net.http_request_queue', 'net._http_response', 'cron.job', 'cron.job_run_details',
    'forge_witness_ops.fires', 'vault.decrypted_secrets']) r
  union all
  select 'schema cron usage', case when to_regnamespace('cron') is null then null
    else pg_catalog.has_schema_privilege('service_role', 'cron', 'USAGE') end),
triggers as (
  select c.relname, t.tgname, t.tgenabled
  from installed i cross join pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid
  where i.yes and c.relnamespace = to_regnamespace('forge_witness') and not t.tgisinternal),
sodium as (
  select p.proname, p.prosecdef, pg_catalog.has_function_privilege(w.rolname, p.oid, 'EXECUTE') as executable
  from who w cross join pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'pgsodium' and p.proname in ('mask_role', 'update_mask', 'create_key', 'update_masks'))
select json_build_object(
  'evaluatedAs', (select rolname from who),
  'installed', (select yes from installed),
  -- forge_witness.schedule_v1 runs as its installer; public.roster_optimizer_team_games is FORCE RLS, so the installer
  -- must bypass RLS (Supabase's postgres does) or the verifier fails closed with schedule_unavailable.
  'installer', (select json_build_object('role', rolname, 'bypassrls', rolbypassrls, 'super', rolsuper)
    from pg_catalog.pg_roles where rolname = coalesce((select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p
      where p.oid = to_regprocedure('forge_witness.schedule_v1(bigint)')), current_user)),
  'exposedSchemas', (select json_agg(nspname) from exposed),
  'roles', (select json_object_agg(rolname, json_build_object('login', rolcanlogin, 'super', rolsuper, 'createrole', rolcreaterole,
      'bypassrls', rolbypassrls, 'inherit', rolinherit, 'config', rolconfig))
    from pg_catalog.pg_roles where rolname in ('forge_witness_api', 'forge_witness_owner')),
  'apiRoleMemberOf', (select coalesce(json_agg(g.rolname), '[]') from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid = m.member
      join pg_catalog.pg_roles g on g.oid = m.roleid where r.rolname = 'forge_witness_api'),
  'membersOfApiRole', (select coalesce(json_agg(r.rolname), '[]') from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid = m.member
      join pg_catalog.pg_roles g on g.oid = m.roleid where g.rolname = 'forge_witness_api'),
  'ownerMembers', (select coalesce(json_agg(o), '[]') from owner_members o),
  'ownerOutside', (select coalesce(json_agg(o order by o.relation), '[]') from owner_outside o),
  'schemaUsage', (select json_object_agg(e.nspname, pg_catalog.has_schema_privilege(w.rolname, e.nsp, 'USAGE')) from who w cross join exposed e),
  'writableRelations', (select coalesce(json_agg(r) filter (where r.privileges && array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']), '[]') from relations r),
  'readableRelationsOutsideApi', (select coalesce(json_agg(r.relation) filter (where 'SELECT' = any (r.privileges) and r.relation not like 'forge\_witness\_api.%'), '[]') from relations r),
  'executableFunctionsOutsideApi', (select count(*) from functions where fn not like 'forge\_witness\_api.%'),
  'executableDefinersOutsideApi', (select coalesce(json_agg(f) filter (where f.definer and f.fn not like 'forge\_witness\_api.%'), '[]') from functions f),
  'exposedFunctionsReachingPgsodium', (select coalesce(json_agg(f.fn) filter (where f.mentions_pgsodium), '[]') from functions f),
  'pgsodiumSchemaExposed', exists (select from exposed where nspname = 'pgsodium'),
  'pgsodiumEscalationFunctions', (select coalesce(json_agg(s), '[]') from sodium s),
  'serviceRoleOnWitnessObjects', (select coalesce(json_agg(g order by g.object), '[]') from writer_grants g where cardinality(g.privileges) > 0),
  -- vault.decrypted_secrets is expected readable by service_role (production); that is why the credential is not there.
  'writerSecretReach', (select coalesce(json_agg(x order by x.object), '[]') from secret_reach x),
  'receiptWriters', (select coalesce(json_agg(rw) filter (where cardinality(rw.privileges) > 0), '[]') from receipt_writers rw),
  'witnessFunctions', (select coalesce(json_agg(f order by f.fn), '[]') from witness_functions f),
  'writerReachableDynamicDefiners', (select coalesce(json_agg(x), '[]') from writer_reach x),
  'receiptTriggers', (select coalesce(json_agg(t order by t.relname, t.tgname), '[]') from triggers t),
  'verdict', case
    when exists (select from exposed where nspname = 'pgsodium') then 'unsafe: pgsodium exposed'
    when exists (select from relations r where r.privileges && array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) then 'unsafe: writable exposed relations'
    when (select yes from installed) and exists (select from receipt_writers rw where cardinality(rw.privileges) > 0) then 'unsafe: receipt writable outside the owner'
    when (select yes from installed) and exists (select from writer_grants g where cardinality(g.privileges) > 0
      and (g.object, g.privileges) not in (('schema forge_witness', array['USAGE']), ('function forge_witness.publication_gate_v1', array['EXECUTE']),
        ('function forge_witness.require_accepted_v1', array['EXECUTE']))) then 'unsafe: service_role holds more than USAGE and the two gate EXECUTEs'
    when (select yes from installed) and exists (select from secret_reach x where x.service_role_select
      and x.object <> 'table vault.decrypted_secrets') then 'unsafe: service_role can read where the verifier credential travels'
    when (select yes from installed) and exists (select from owner_members o where o.inherits or not o.admin_option) then 'unsafe: owner has members'
    when (select yes from installed) and exists (select from witness_functions f where f.fn in ('forge_witness.record_v1', 'forge_witness.arm_v1',
      'forge_witness.evidence_v1') and f.executable_by && array['public', 'anon', 'authenticated', 'service_role', 'forge_witness_api', 'authenticator']::name[]) then 'unsafe: private definers callable'
    when (select yes from installed) and exists (select from writer_reach x where x.owner = 'forge_witness_owner') then 'unsafe: owner definer with dynamic SQL reachable by the writer'
    when (select yes from installed) and (select count(*) from triggers t where t.tgenabled = 'A') <> 4 then 'unsafe: receipt triggers not ALWAYS'
    when (select yes from installed) and not exists (select from pg_catalog.pg_proc p join pg_catalog.pg_roles o on o.oid = p.proowner
      where p.oid = to_regprocedure('forge_witness.schedule_v1(bigint)') and (o.rolbypassrls or o.rolsuper)) then 'unsafe: schedule helper owner cannot bypass RLS (verifier would fail closed)'
    when exists (select from functions f where f.fn not like 'forge\_witness\_api.%' and f.definer
      and (f.mentions_pgsodium or f.runs_privilege_ddl or f.dynamic_sql)) then 'review: exposed definers listed above are callable'
    when exists (select from writer_reach) then 'review: superuser- or CREATEROLE-owned dynamic-SQL definers executable by service_role are listed'
    else 'ok' end);
