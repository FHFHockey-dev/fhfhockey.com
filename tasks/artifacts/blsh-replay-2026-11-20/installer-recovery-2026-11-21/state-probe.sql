-- BLSH replay installer: READ-ONLY state probe (run as postgres on a fresh connection after any install attempt).
-- psql -X -A -t -v ON_ERROR_STOP=1 -v app=<install application_name> -v pid=<install backend pid|0> -v bstart=<its backend_start|epoch> -v astart=<attempt start|epoch> -v full=on|off -f state-probe.sql
-- (Through Supavisor, application_name shows 'Supavisor', so the pid + backend_start pair is the identity. Supavisor reuses
--  backends in session mode, so a live pid alone is not 'lingering': only a transaction on it that began at/after the attempt.)
-- Prints one JSON object. Never writes: the whole probe runs in a READ ONLY transaction.
-- Fingerprints use names/definitions only (no OIDs), so a clean reference install on another cluster is comparable.
\set ON_ERROR_STOP on
begin transaction read only;
set local statement_timeout = '60s';
select
  (select count(*) from pg_roles where rolname in ('blsh_replay_owner','blsh_replay_api')) as roles,
  (select count(*) from pg_namespace where nspname in ('blsh_replay','blsh_replay_api')) as schemas,
  exists (select from pg_auth_members am join pg_roles r on r.oid = am.roleid join pg_roles m on m.oid = am.member
          where r.rolname = 'blsh_replay_owner' and m.rolname = current_user) as owner_member
\gset
\if :owner_member
  set local role blsh_replay_owner;
\endif
with s(n) as (values ('blsh_replay'), ('blsh_replay_api')),
roles as (select string_agg(format('%s|%s|%s|%s|%s|%s', r.rolname, r.rolcanlogin, r.rolinherit, r.rolsuper, r.rolbypassrls,
            coalesce((select string_agg(x, ',' order by x) from pg_db_role_setting d, unnest(d.setconfig) x where d.setrole = r.oid), '')), ';' order by r.rolname) v
          from pg_roles r where r.rolname in ('blsh_replay_owner','blsh_replay_api')),
mem as (select string_agg(format('%s>%s|%s', r.rolname, m.rolname, am.admin_option), ';' order by r.rolname, m.rolname) v
        from pg_auth_members am join pg_roles r on r.oid = am.roleid join pg_roles m on m.oid = am.member
        where r.rolname like 'blsh\_replay%' or m.rolname like 'blsh\_replay%'),
nsp as (select string_agg(format('%s|%s|%s', nspname, nspowner::regrole, nspacl), ';' order by nspname) v from pg_namespace where nspname in (select n from s)),
rel as (select string_agg(format('%s.%s|%s|%s|%s|%s', n.nspname, c.relname, c.relkind, c.relacl, c.relrowsecurity, c.relowner::regrole), ';' order by n.nspname, c.relname) v
        from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in (select n from s)),
col as (select string_agg(format('%s.%s.%s|%s|%s|%s', table_schema, table_name, column_name, data_type, is_nullable, column_default), ';'
          order by table_schema, table_name, ordinal_position) v from information_schema.columns where table_schema in (select n from s)),
fn as (select string_agg(format('%s.%s(%s)|%s|%s|%s', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), md5(pg_get_functiondef(p.oid)), p.proacl, p.proowner::regrole), ';'
         order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) v
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in (select n from s) and p.prokind in ('f','p')),
con as (select string_agg(format('%s|%s|%s', c.conrelid::regclass, c.conname, pg_get_constraintdef(c.oid)), ';' order by c.conrelid::regclass::text, c.conname) v
        from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname in (select n from s)),
trg as (select string_agg(format('%s|%s', t.tgname, pg_get_triggerdef(t.oid)), ';' order by t.tgrelid::regclass::text, t.tgname) v
        from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in (select n from s) and not t.tgisinternal),
pol as (select string_agg(format('%s.%s|%s|%s|%s|%s|%s|%s', schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check), ';'
          order by schemaname, tablename, policyname) v from pg_policies where schemaname in (select n from s)),
idx as (select string_agg(indexdef, ';' order by schemaname, indexname) v from pg_indexes where schemaname in (select n from s)),
content as (
  select string_agg(format('%s=%s', c.oid::regclass,
    (xpath('/row/h/text()', query_to_xml(format(
       'select count(*)::text || '':'' || coalesce(md5(string_agg(j::text, ''|'' order by j::text)), '''') as h from (select to_jsonb(t) - %L::text[] as j from %s t) q',
       coalesce((select array_agg(ic.column_name::text) from information_schema.columns ic
                 where ic.table_schema = n.nspname and ic.table_name = c.relname
                   and (ic.column_default ilike '%now()%' or ic.column_default ilike '%clock_timestamp()%' or ic.column_default ilike '%gen_random_uuid()%')), '{}'),
       c.oid::regclass), false, true, '')))[1]::text), ';' order by c.oid::regclass::text) v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in (select n from s) and c.relkind in ('r','p')),
outside_narrow as (  -- memberships of the two roles the installer grants into, excluding the sandbox roles themselves
  select string_agg(format('%s>%s|%s', r.rolname, m.rolname, am.admin_option), ';' order by r.rolname, m.rolname) v
  from pg_auth_members am join pg_roles r on r.oid = am.roleid join pg_roles m on m.oid = am.member
  where m.rolname in ('authenticator','postgres') and r.rolname not like 'blsh\_replay%')
select json_build_object(
  'probe', 'blsh-installer-state-probe-v1',
  'at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'roles', :roles, 'schemas', :schemas,
  'memberships', (select count(*) from pg_auth_members am join pg_roles r on r.oid = am.roleid join pg_roles m on m.oid = am.member
                  where r.rolname like 'blsh\_replay%' or m.rolname like 'blsh\_replay%'),
  'lingeringInstallBackends', (select count(*) from pg_stat_activity where (application_name = :'app' or (pid = :pid and backend_start = :'bstart'::timestamptz and xact_start >= :'astart'::timestamptz)) and pid <> pg_backend_pid()),
  'lingeringDetail', (select json_agg(json_build_object('pid', pid, 'state', state, 'xactStart', xact_start)) from pg_stat_activity where (application_name = :'app' or (pid = :pid and backend_start = :'bstart'::timestamptz and xact_start >= :'astart'::timestamptz)) and pid <> pg_backend_pid()),
  'tables', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('blsh_replay','blsh_replay_api') and c.relkind = 'r'),
  'functions', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('blsh_replay','blsh_replay_api')),
  'parts', json_build_object('roles', md5(coalesce((select v from roles), '')), 'memberships', md5(coalesce((select v from mem), '')),
                             'schemas', md5(coalesce((select v from nsp), '')), 'relations', md5(coalesce((select v from rel), '')),
                             'columns', md5(coalesce((select v from col), '')), 'functions', md5(coalesce((select v from fn), '')),
                             'constraints', md5(coalesce((select v from con), '')), 'triggers', md5(coalesce((select v from trg), '')),
                             'policies', md5(coalesce((select v from pol), '')), 'indexes', md5(coalesce((select v from idx), '')),
                             'content', md5(coalesce((select v from content), ''))),
  'sandboxFingerprint', md5(concat_ws('#', (select v from roles), (select v from mem), (select v from nsp), (select v from rel), (select v from col),
                                     (select v from fn), (select v from con), (select v from trg), (select v from pol), (select v from idx), (select v from content))),
  'outsideNarrowFingerprint', md5(coalesce((select v from outside_narrow), '')))
;
\if :full
reset role;
-- Full catalog outside the sandbox (disposable clusters; optional on hosted): names, ACLs and definitions, no OIDs.
select json_build_object('outsideFullFingerprint', md5(concat_ws('#',
  (select string_agg(format('%s|%s|%s|%s|%s', rolname, rolcanlogin, rolinherit, rolsuper, rolbypassrls), ';' order by rolname) from pg_roles where rolname not like 'blsh\_replay%'),
  (select string_agg(format('%s>%s', r.rolname, m.rolname), ';' order by r.rolname, m.rolname) from pg_auth_members am join pg_roles r on r.oid = am.roleid join pg_roles m on m.oid = am.member
     where r.rolname not like 'blsh\_replay%' and m.rolname not like 'blsh\_replay%'),
  (select string_agg(format('%s|%s', nspname, nspacl), ';' order by nspname) from pg_namespace where nspname not in ('blsh_replay','blsh_replay_api') and nspname not like 'pg\_temp%' and nspname not like 'pg\_toast%'),
  (select string_agg(format('%s.%s|%s|%s', n.nspname, c.relname, c.relkind, c.relacl), ';' order by n.nspname, c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname not in ('blsh_replay','blsh_replay_api','pg_toast') and n.nspname not like 'pg\_temp%' and n.nspname not like 'pg\_toast\_temp%'),
  (select string_agg(format('%s.%s(%s)|%s', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), p.proacl), ';' order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname not in ('blsh_replay','blsh_replay_api','pg_catalog','information_schema')),
  (select string_agg(format('%s|%s', d.defaclrole::regrole, d.defaclacl), ';' order by d.defaclrole::regrole::text, d.defaclobjtype, d.defaclacl::text) from pg_default_acl d)
))) as full_outside
\gset
select :'full_outside';
\endif
commit;
