-- Writer-reach audit (read-only catalog survey + exploit probes that always ROLL BACK). Run as a superuser on a
-- DISPOSABLE copy of production (roles + schema + grants). Never run the probe section on production.
-- Question: can the FORGE writer's credential (service_role) forge or bypass the independent verdict or the live fences?
\set ON_ERROR_STOP off
\pset footer off
\echo '== A. service_role memberships (transitive)'
with recursive m(role, via) as (
  select r.rolname::text, r.rolname::text from pg_auth_members a join pg_roles r on r.oid = a.roleid
    where a.member = 'service_role'::regrole
  union
  select r.rolname::text, m.via from m join pg_auth_members a on a.member = m.role::regrole join pg_roles r on r.oid = a.roleid)
select role, via from m order by 1;

\echo '== B. SECURITY DEFINER functions service_role may EXECUTE, owned by a privileged role, with dynamic SQL'
select p.oid::regprocedure as function, pg_get_userbyid(p.proowner) as owner,
  (p.prosrc ~* '\mexecute\M\s+(format|[a-z_]+\s*(;|\|\|)|''|\$)' or p.prosrc ~* 'execute\s+[a-z_]+\s*;') as dynamic_sql
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
join pg_roles o on o.oid = p.proowner
where p.prosecdef and has_function_privilege('service_role', p.oid, 'EXECUTE')
  and (o.rolsuper or o.rolbypassrls or o.rolcreaterole or o.rolname in ('postgres', 'supabase_admin', 'forge_witness_owner'))
  and n.nspname not in ('pg_catalog', 'information_schema')
  and p.prosrc ~* '\mexecute\M'
order by 1;

\echo '== C. service_role write/trigger/truncate privileges in the evidence schemas (expect none)'
select c.oid::regclass as relation, p.privilege_type
from pg_class c join pg_namespace n on n.oid = c.relnamespace,
  lateral (select unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']) privilege_type) p
where n.nspname in ('forge_witness', 'forge_witness_api') and c.relkind in ('r', 'v', 'p')
  and has_table_privilege('service_role', c.oid, p.privilege_type)
order by 1, 2;
select n.nspname as schema, has_schema_privilege('service_role', n.oid, 'CREATE') as service_role_create,
  has_schema_privilege('service_role', n.oid, 'USAGE') as service_role_usage
from pg_namespace n where n.nspname in ('public', 'forge_witness', 'forge_witness_api', 'forge_pregame_capture') order by 1;

\echo '== D. definer owners that can grant roles (CREATEROLE) and authenticator memberships'
select rolname, rolsuper, rolcreaterole, rolbypassrls from pg_roles where rolname in ('postgres', 'service_role', 'forge_witness_owner') order by 1;
select pg_has_role('authenticator', 'forge_witness_api', 'MEMBER') as authenticator_may_use_witness_role,
  pg_has_role('authenticator', 'forge_witness_owner', 'MEMBER') as authenticator_may_use_owner;

\echo '== E. owners of the live-fence objects'
select c.oid::regclass, pg_get_userbyid(c.relowner) from pg_class c
where c.oid in (to_regclass('forge_pregame_capture.publications'), to_regclass('forge_pregame_capture.live_runs'),
  to_regclass('forge_witness.verdicts'), to_regclass('forge_witness.credentials')) order by 1;

\echo '== G. privileged SECURITY DEFINER functions without a pinned search_path that service_role can EXECUTE (search-path hijack candidates)'
select p.oid::regprocedure as function, pg_get_userbyid(p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles o on o.oid = p.proowner
where p.prosecdef and has_function_privilege('service_role', p.oid, 'EXECUTE')
  and (o.rolsuper or o.rolbypassrls or o.rolcreaterole)
  and not exists (select from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  and n.nspname not in ('pg_catalog', 'information_schema')
order by 1;

\echo '== F. exploit probes as service_role (each rolled back)'
\echo '-- F1 make the witness role reachable through PostgREST (then any holder of the JWT secret can act as the verifier)'
begin; set local role service_role;
select public.execute_sql('grant forge_witness_api to authenticator');
reset role; select 'F1 authenticator now member of forge_witness_api: ' || pg_has_role('authenticator', 'forge_witness_api', 'MEMBER');
rollback;
\echo '-- F2 become the verifier owner (CREATEROLE definer grants itself the role), then read the witness credential'
begin; set local role service_role;
select public.execute_sql('grant forge_witness_owner to postgres');
select public.execute_sql('create table public.__writer_probe as select count(*) as credentials from forge_witness.credentials');
reset role; select 'F2 credential rows readable through execute_sql: ' || credentials from public.__writer_probe;
rollback;
\echo '-- F3 switch off the publication verdict trigger'
begin; set local role service_role;
select public.execute_sql('alter table forge_pregame_capture.publications disable trigger require_live_verdict');
reset role; select 'F3 require_live_verdict enabled: ' || (tgenabled <> 'D') from pg_trigger where tgname = 'require_live_verdict';
rollback;
\echo '-- F4 rewrite the publisher gate itself'
begin; set local role service_role;
select public.execute_sql('grant forge_witness_owner to postgres');
select public.execute_sql($q$create or replace function forge_witness.require_accepted_v1(p_claim_id uuid, p_raw_sha256 text,
  p_canonical_sha256 text, p_tsa_token_sha256 text) returns jsonb language sql as 'select jsonb_build_object(''accepted'', true)'$q$);
reset role; select 'F4 gate replaced: ' || (pg_get_functiondef('forge_witness.require_accepted_v1(uuid,text,text,text)'::regprocedure) like '%''accepted'', true%');
rollback;
\echo '-- F5 control: direct writes without execute_sql (expect permission denied)'
begin; set local role service_role; select count(*) from forge_witness.credentials; rollback;
begin; set local role service_role; insert into forge_witness.verdicts (claim_id) values (gen_random_uuid()); rollback;
begin; set local role service_role; alter table forge_pregame_capture.publications disable trigger require_live_verdict; rollback;
