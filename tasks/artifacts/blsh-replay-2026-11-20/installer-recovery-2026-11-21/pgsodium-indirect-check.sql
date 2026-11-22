-- BLSH replay: READ-ONLY proof that neither sandbox role can reach pgsodium indirectly (TJ 12:45 CT, Nov 21).
-- Run as postgres after install, before exposure: psql -X -A -t -v ON_ERROR_STOP=1 -v exposed='public,storage,...,blsh_replay_api' -f pgsodium-indirect-check.sql
-- The only accepted inheritance is pgsodium schema USAGE via PUBLIC. Every path below must be closed.
\set ON_ERROR_STOP on
begin transaction read only;
set local statement_timeout = '60s';
with roles(r) as (values ('blsh_replay_api'), ('blsh_replay_owner')),
exposed as (select trim(x) as nspname from unnest(string_to_array(:'exposed', ',')) x),
ext_re as (select '\m(pgsodium|vault)\.'::text as re),
-- 1. every function/view outside pgsodium that references pgsodium (the only indirect routes into it)
bridges_fn as (select n.nspname, p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname <> 'pgsodium' and p.prokind in ('f','p') and p.prosrc ~* 'pgsodium'),
bridges_view as (select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where c.relkind in ('v','m') and n.nspname <> 'pgsodium' and pg_get_viewdef(c.oid) ~* 'pgsodium'),
-- 2. can either role use the schemas those bridges live in?
bridge_schema_use as (select r, b.nspname, has_schema_privilege(r, b.nspname, 'USAGE') as usage
                      from roles, (select nspname from bridges_fn union select nspname from bridges_view) b),
-- 3. functions either role can EXECUTE in exposed schemas (the API surface) and in the sandbox (wrapper callees)
reach_fn as (select r, n.nspname, p.proname, p.prosecdef, p.proowner::regrole::text as owner, p.prosrc
             from roles, pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where (n.nspname in (select nspname from exposed) or n.nspname in ('blsh_replay','blsh_replay_api'))
               and p.prokind in ('f','p') and has_function_privilege(r, p.oid, 'EXECUTE')
               and has_schema_privilege(r, n.oid, 'USAGE')),  -- callable needs both EXECUTE and schema USAGE
reach_bad as (select distinct r, nspname || '.' || proname as fn from reach_fn, ext_re
              where prosrc ~* re or prosrc ~* '\mexecute\M\s+(format|\$|''|[a-z_]+\s*(\|\||;))' or
                    prosrc ~* ('\m(' || coalesce((select string_agg(proname, '|') from bridges_fn), '^$') || ')\s*\(')),
-- 4. definer wrappers in the API schema: owner and callees
wrappers as (select proname, owner, prosecdef, (select array_agg(distinct m[1]) from regexp_matches(prosrc, '\m([a-z_]+)\.[a-z_0-9]+\s*\(', 'gi') m) as callee_schemas
             from reach_fn where nspname = 'blsh_replay_api' and r = 'blsh_replay_api'),
-- 5. pgsodium security labels and key-role membership
labels as (select l.objoid::regclass::text as obj, n.nspname from pg_seclabel l join pg_class c on c.oid = l.objoid join pg_namespace n on n.oid = c.relnamespace where l.provider = 'pgsodium'),
keyroles as (select r, k.rolname from roles, pg_roles k where k.rolname like 'pgsodium%' and pg_has_role(r, k.oid, 'MEMBER'))
select json_build_object(
  'probe', 'blsh-pgsodium-indirect-v1', 'at', clock_timestamp(),
  'exposed', (select json_agg(nspname) from exposed),
  'exposesPgsodiumOrVault', (select count(*) from exposed where nspname in ('pgsodium','vault')),
  'pgsodiumUsageViaPublicOnly', (select json_object_agg(r, has_schema_privilege(r, 'pgsodium', 'USAGE')) from roles),
  'bridgeFunctions', (select coalesce(json_agg(nspname||'.'||proname||(case when prosecdef then ' (definer)' else '' end) order by 1), '[]') from bridges_fn),
  'bridgeViews', (select coalesce(json_agg(nspname||'.'||relname order by 1), '[]') from bridges_view),
  'bridgeSchemaUsableByRole', (select coalesce(json_agg(r||':'||nspname) filter (where usage), '[]') from bridge_schema_use),
  'reachableFunctionsCount', (select json_object_agg(r, n) from (select r, count(*) n from reach_fn group by r) x),
  'reachableTouchingPgsodiumVaultDynamicOrBridge', (select coalesce(json_agg(r||':'||fn order by 1), '[]') from reach_bad),
  'definerWrappers', (select count(*) from wrappers where prosecdef),
  'wrappersNotOwnedBySandboxOwner', (select coalesce(json_agg(proname), '[]') from wrappers where prosecdef and owner <> 'blsh_replay_owner'),
  'wrapperCalleeSchemasOutsideSandbox', (select coalesce(json_agg(distinct proname||':'||s), '[]') from wrappers, unnest(coalesce(callee_schemas, '{}')) s where s not in ('blsh_replay','blsh_replay_api','pg_catalog')),
  'pgsodiumLabels', (select coalesce(json_agg(obj), '[]') from labels),
  'pgsodiumLabelsInReach', (select coalesce(json_agg(obj), '[]') from labels where nspname in (select nspname from exposed) or nspname like 'blsh_replay%'),
  'keyRoleMemberships', (select coalesce(json_agg(r||'>'||rolname), '[]') from keyroles),
  'verdict', case when
      (select count(*) from exposed where nspname in ('pgsodium','vault')) = 0
      and not exists (select from bridge_schema_use where usage)
      and not exists (select from reach_bad)
      and not exists (select from wrappers where prosecdef and owner <> 'blsh_replay_owner')
      and not exists (select from wrappers, unnest(coalesce(callee_schemas, '{}')) s where s not in ('blsh_replay','blsh_replay_api','pg_catalog'))
      and not exists (select from labels where nspname in (select nspname from exposed) or nspname like 'blsh_replay%')
      and not exists (select from keyroles)
      and (select count(*) from wrappers where prosecdef) = 16
    then 'ok' else 'fail' end);
rollback;
