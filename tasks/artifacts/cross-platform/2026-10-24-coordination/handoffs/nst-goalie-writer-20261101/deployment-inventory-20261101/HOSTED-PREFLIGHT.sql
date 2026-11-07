-- PREPARED, NOT EXECUTED. Catalog-only preflight for the final reviewed hash.
-- Project fyhftlxokyjtpndbkfse. SELECT only; no RPC invocation, no NST/HTTP calls.
-- Preserve output privately; function definitions below are limited to NST controls.
-- Abort release on incompatible/missing dependencies or unexpected name collisions.

-- 1. Exact relation shape. Expected: 15 existing dependency/output tables,
-- one missing shared admission table and ten absent candidate tables BEFORE install.
with wanted(name) as (values
  ('nst_request_admission_state'),
  ('route_runner_jobs'),
  ('route_runner_events'),
  ('seasons'),
  ('games'),
  ('wgo_goalie_stats'),
  ('nst_goalie_cohorts'),
  ('nst_goalie_units'),
  ('nst_goalie_cohort_units'),
  ('nst_goalie_daily_budget'),
  ('nst_goalie_claims'),
  ('nst_goalie_unit_receipts'),
  ('nst_goalie_control'),
  ('nst_goalie_day_evidence'),
  ('nst_job_control'),
  ('nst_jobs'),
  ('nst_gamelog_goalie_5v5_counts'),
  ('nst_gamelog_goalie_5v5_rates'),
  ('nst_gamelog_goalie_ev_counts'),
  ('nst_gamelog_goalie_ev_rates'),
  ('nst_gamelog_goalie_all_counts'),
  ('nst_gamelog_goalie_all_rates'),
  ('nst_gamelog_goalie_pp_counts'),
  ('nst_gamelog_goalie_pp_rates'),
  ('nst_gamelog_goalie_pk_counts'),
  ('nst_gamelog_goalie_pk_rates')
)
select w.name,c.relkind,c.relrowsecurity,a.attnum,a.attname,
 pg_catalog.format_type(a.atttypid,a.atttypmod) as type,a.attnotnull
from wanted w left join pg_class c on c.oid=to_regclass('public.'||w.name)
left join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
order by w.name,a.attnum limit 1500;

-- 2. Unique keys/checks/FKs/indexes. Every goalie output needs a usable
-- nonpartial player_id,date_scraped conflict target; inspect extra unique keys,
-- defaults and constraints for incompatible write behavior. Do not "fix" here.
select c.relname,con.conname,con.contype,pg_get_constraintdef(con.oid,true) as definition
from pg_constraint con join pg_class c on c.oid=con.conrelid
where con.connamespace='public'::regnamespace and c.relname in (
  'nst_request_admission_state',
  'route_runner_jobs',
  'route_runner_events',
  'seasons',
  'games',
  'wgo_goalie_stats',
  'nst_goalie_cohorts',
  'nst_goalie_units',
  'nst_goalie_cohort_units',
  'nst_goalie_daily_budget',
  'nst_goalie_claims',
  'nst_goalie_unit_receipts',
  'nst_goalie_control',
  'nst_goalie_day_evidence',
  'nst_job_control',
  'nst_jobs',
  'nst_gamelog_goalie_5v5_counts',
  'nst_gamelog_goalie_5v5_rates',
  'nst_gamelog_goalie_ev_counts',
  'nst_gamelog_goalie_ev_rates',
  'nst_gamelog_goalie_all_counts',
  'nst_gamelog_goalie_all_rates',
  'nst_gamelog_goalie_pp_counts',
  'nst_gamelog_goalie_pp_rates',
  'nst_gamelog_goalie_pk_counts',
  'nst_gamelog_goalie_pk_rates'
) order by c.relname,con.conname limit 300;
select tablename,indexname,indexdef from pg_indexes where schemaname='public'
and tablename in (
  'nst_request_admission_state',
  'route_runner_jobs',
  'route_runner_events',
  'seasons',
  'games',
  'wgo_goalie_stats',
  'nst_goalie_cohorts',
  'nst_goalie_units',
  'nst_goalie_cohort_units',
  'nst_goalie_daily_budget',
  'nst_goalie_claims',
  'nst_goalie_unit_receipts',
  'nst_goalie_control',
  'nst_goalie_day_evidence',
  'nst_job_control',
  'nst_jobs',
  'nst_gamelog_goalie_5v5_counts',
  'nst_gamelog_goalie_5v5_rates',
  'nst_gamelog_goalie_ev_counts',
  'nst_gamelog_goalie_ev_rates',
  'nst_gamelog_goalie_all_counts',
  'nst_gamelog_goalie_all_rates',
  'nst_gamelog_goalie_pp_counts',
  'nst_gamelog_goalie_pp_rates',
  'nst_gamelog_goalie_pk_counts',
  'nst_gamelog_goalie_pk_rates'
) order by tablename,indexname limit 300;

-- 3. Privileges/policies and role properties. Service-role control table
-- activation UPDATE must stay operator-only; inspect column ACLs as well as ACLs.
select c.relname,c.relacl,a.attname,a.attacl
from pg_class c left join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and a.attacl is not null
where c.relnamespace='public'::regnamespace and c.relname in (
  'nst_request_admission_state',
  'route_runner_jobs',
  'route_runner_events',
  'seasons',
  'games',
  'wgo_goalie_stats',
  'nst_goalie_cohorts',
  'nst_goalie_units',
  'nst_goalie_cohort_units',
  'nst_goalie_daily_budget',
  'nst_goalie_claims',
  'nst_goalie_unit_receipts',
  'nst_goalie_control',
  'nst_goalie_day_evidence',
  'nst_job_control',
  'nst_jobs',
  'nst_gamelog_goalie_5v5_counts',
  'nst_gamelog_goalie_5v5_rates',
  'nst_gamelog_goalie_ev_counts',
  'nst_gamelog_goalie_ev_rates',
  'nst_gamelog_goalie_all_counts',
  'nst_gamelog_goalie_all_rates',
  'nst_gamelog_goalie_pp_counts',
  'nst_gamelog_goalie_pp_rates',
  'nst_gamelog_goalie_pk_counts',
  'nst_gamelog_goalie_pk_rates'
) order by c.relname,a.attnum limit 300;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public'
and tablename in (
  'nst_request_admission_state',
  'route_runner_jobs',
  'route_runner_events',
  'seasons',
  'games',
  'wgo_goalie_stats',
  'nst_goalie_cohorts',
  'nst_goalie_units',
  'nst_goalie_cohort_units',
  'nst_goalie_daily_budget',
  'nst_goalie_claims',
  'nst_goalie_unit_receipts',
  'nst_goalie_control',
  'nst_goalie_day_evidence',
  'nst_job_control',
  'nst_jobs',
  'nst_gamelog_goalie_5v5_counts',
  'nst_gamelog_goalie_5v5_rates',
  'nst_gamelog_goalie_ev_counts',
  'nst_gamelog_goalie_ev_rates',
  'nst_gamelog_goalie_all_counts',
  'nst_gamelog_goalie_all_rates',
  'nst_gamelog_goalie_pp_counts',
  'nst_gamelog_goalie_pp_rates',
  'nst_gamelog_goalie_pk_counts',
  'nst_gamelog_goalie_pk_rates'
) order by tablename,policyname limit 200;
select rolname,rolsuper,rolbypassrls from pg_roles where rolname in ('anon','authenticated','service_role');

-- 4. Existing functions and dependency/trigger footprint. The admission body
-- must match the accepted prerequisite; compare actual definition, not just MD5.
select p.oid::regprocedure::text as signature,p.prosecdef,p.proconfig,p.proacl,
 pg_get_functiondef(p.oid) as definition
from pg_proc p where p.pronamespace='public'::regnamespace
and (p.proname like 'nst_%') order by signature limit 40;
select p.oid::regprocedure::text as function_signature,d.deptype,
 pg_describe_object(d.classid,d.objid,d.objsubid) as dependent
from pg_proc p join pg_depend d on d.refclassid='pg_proc'::regclass and d.refobjid=p.oid
where p.pronamespace='public'::regnamespace and p.proname in ('nst_admit_attempt_v1','nst_admit_attempt_budget_v1')
order by function_signature,dependent limit 100;
select c.relname,t.tgname,pg_get_triggerdef(t.oid,true) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not t.tgisinternal and c.relnamespace='public'::regnamespace and c.relname in (
  'nst_request_admission_state',
  'route_runner_jobs',
  'route_runner_events',
  'seasons',
  'games',
  'wgo_goalie_stats',
  'nst_goalie_cohorts',
  'nst_goalie_units',
  'nst_goalie_cohort_units',
  'nst_goalie_daily_budget',
  'nst_goalie_claims',
  'nst_goalie_unit_receipts',
  'nst_goalie_control',
  'nst_goalie_day_evidence',
  'nst_job_control',
  'nst_jobs',
  'nst_gamelog_goalie_5v5_counts',
  'nst_gamelog_goalie_5v5_rates',
  'nst_gamelog_goalie_ev_counts',
  'nst_gamelog_goalie_ev_rates',
  'nst_gamelog_goalie_all_counts',
  'nst_gamelog_goalie_all_rates',
  'nst_gamelog_goalie_pp_counts',
  'nst_gamelog_goalie_pp_rates',
  'nst_gamelog_goalie_pk_counts',
  'nst_gamelog_goalie_pk_rates'
) order by c.relname,t.tgname limit 100;
-- Check pgcrypto/core crypto availability without computing or invoking an NST RPC.
select to_regprocedure('pg_catalog.sha256(bytea)') as sha256_function,
 to_regprocedure('pg_catalog.gen_random_uuid()') as random_uuid_function;

-- POST-INSTALL ONLY, after confirming both control relations exist:
-- select singleton,enabled,enabled_at,bootstrap_date from public.nst_goalie_control;
-- select singleton,enforced,qualified_at,qualification_fingerprint,last_untracked_at from public.nst_job_control;
-- Expected disabled flags, no qualification/bootstrap; zero newly-created jobs/claims.
-- Do not call begin/claim/prepare/finish or admit RPCs as a read-only smoke test.

-- Default privileges affect new objects even when explicit grants are narrow.
-- Include global and public defaults for the owner that will apply the SQL;
-- compare grants to PUBLIC, anon, authenticated and service_role before install.
select pg_get_userbyid(d.defaclrole) as creator_role,
 coalesce(n.nspname,'GLOBAL') as schema_name,d.defaclobjtype,d.defaclacl
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
where d.defaclnamespace=0 or n.nspname='public'
order by creator_role,schema_name,d.defaclobjtype limit 100;
