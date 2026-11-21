-- Read-only isolation audit for an installed FORGE sandbox (narrow PostgREST interface). Changes nothing.
-- Prints one JSON line; ok=true requires every list to be empty and the API surface to be exactly views and wrappers.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
with private(nsp) as (select oid from pg_catalog.pg_namespace where nspname in
    ('forge_sandbox', 'forge_sandbox_capture', 'forge_sandbox_internal', 'forge_sandbox_exec')),
api_ns(nsp) as (select oid from pg_catalog.pg_namespace where nspname = 'forge_sandbox_api'),
sandbox(nsp) as (select nsp from private union all select nsp from api_ns),
roles(rolname) as (values ('forge_sandbox_owner'), ('forge_sandbox_api')),
-- Any write path to a relation outside the sandbox for either role, including PUBLIC and inherited grants.
writes as (
  select r.rolname, n.nspname || '.' || c.relname as relation, p.priv
  from roles r cross join pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(priv)
  where c.relkind in ('r', 'p', 'v', 'm', 'f') and n.oid not in (select nsp from sandbox)
    and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_toast'
    and pg_catalog.has_table_privilege(r.rolname, c.oid, p.priv)),
creates as (
  select r.rolname, n.nspname from roles r cross join pg_catalog.pg_namespace n
  where n.oid not in (select nsp from sandbox) and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
    and pg_catalog.has_schema_privilege(r.rolname, n.oid, 'CREATE')),
-- The API role reaches nothing private and may not write even its own views.
api_private as (
  select n.nspname from pg_catalog.pg_namespace n where n.oid in (select nsp from private)
    and pg_catalog.has_schema_privilege('forge_sandbox_api', n.oid, 'USAGE')),
api_writes as (
  select c.relname, p.priv from pg_catalog.pg_class c cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(priv)
  where c.relnamespace in (select nsp from api_ns) and pg_catalog.has_table_privilege('forge_sandbox_api', c.oid, p.priv)),
api_surface as (
  select c.relname as name, c.relkind::text as kind from pg_catalog.pg_class c where c.relnamespace in (select nsp from api_ns) and c.relkind <> 'v'
  union all
  select p.proname, 'non-definer function' from pg_catalog.pg_proc p where p.pronamespace in (select nsp from api_ns) and not p.prosecdef),
-- No other client role, nor PUBLIC, may reach any sandbox schema.
exposure as (
  select g.rolname, n.nspname from (values ('anon'), ('authenticated'), ('authenticator'), ('service_role')) g(rolname)
  join pg_catalog.pg_roles x on x.rolname = g.rolname cross join pg_catalog.pg_namespace n
  where n.oid in (select nsp from sandbox) and pg_catalog.has_schema_privilege(g.rolname, n.oid, 'USAGE')
  union all
  select 'PUBLIC', n.nspname from pg_catalog.pg_namespace n, pg_catalog.aclexplode(coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) a
  where n.oid in (select nsp from sandbox) and a.grantee = 0
  union all
  select 'PUBLIC', p.proname from pg_catalog.pg_proc p, pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
  where p.pronamespace in (select nsp from sandbox) and a.grantee = 0),
attributes as (
  select rolname from pg_catalog.pg_roles where rolname in (select rolname from roles)
    and (rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls or rolcanlogin)),
memberships as (
  select r.rolname as member, g.rolname as granted from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid = m.member
  join pg_catalog.pg_roles g on g.oid = m.roleid where r.rolname in (select rolname from roles))
select json_build_object(
  'ok', not exists (select from writes) and not exists (select from creates) and not exists (select from api_private)
        and not exists (select from api_writes) and not exists (select from api_surface) and not exists (select from exposure)
        and not exists (select from attributes) and not exists (select from memberships)
        and (select count(*) from pg_catalog.pg_class where relnamespace in (select nsp from api_ns) and relkind = 'v') > 0,
  'writesOutsideSandbox', (select coalesce(json_agg(w), '[]') from writes w),
  'createOutsideSandbox', (select coalesce(json_agg(c), '[]') from creates c),
  'apiRoleOnPrivateSchemas', (select coalesce(json_agg(a), '[]') from api_private a),
  'apiRoleWritesOwnViews', (select coalesce(json_agg(a), '[]') from api_writes a),
  'apiSurfaceOtherThanViewsAndDefiners', (select coalesce(json_agg(a), '[]') from api_surface a),
  'apiViews', (select count(*) from pg_catalog.pg_class where relnamespace in (select nsp from api_ns) and relkind = 'v'),
  'apiFunctions', (select count(*) from pg_catalog.pg_proc where pronamespace in (select nsp from api_ns)),
  'sandboxExposure', (select coalesce(json_agg(e), '[]') from exposure e),
  'roleAttributes', (select coalesce(json_agg(a), '[]') from attributes a),
  'roleMemberships', (select coalesce(json_agg(m), '[]') from memberships m));
