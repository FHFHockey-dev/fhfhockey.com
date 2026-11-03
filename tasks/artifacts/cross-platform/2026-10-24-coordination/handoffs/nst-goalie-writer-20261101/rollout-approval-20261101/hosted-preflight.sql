-- Authorized bounded catalog-only read; no RPC, data writer or provider invocation.
with relations as (
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
 pg_catalog.format_type(a.atttypid,a.atttypmod) as type,a.attnotnull,pg_get_expr(ad.adbin,ad.adrelid) as column_default,pg_get_userbyid(c.relowner) as owner
from wanted w left join pg_class c on c.oid=to_regclass('public.'||w.name)
left join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
left join pg_attrdef ad on ad.adrelid=c.oid and ad.adnum=a.attnum
order by w.name,a.attnum limit 1500
),
constraints as (
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
) order by c.relname,con.conname limit 300
),
indexes as (
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
) order by tablename,indexname limit 300
),
object_acls as (
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
) order by c.relname,a.attnum limit 300
),
policies as (
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
) order by tablename,policyname limit 200
),
roles as (
select rolname,rolsuper,rolbypassrls from pg_roles where rolname in ('anon','authenticated','service_role')
),
functions as (
select p.oid::regprocedure::text as signature,p.prosecdef,p.proconfig,p.proacl,
 pg_get_functiondef(p.oid) as definition
from pg_proc p where p.pronamespace='public'::regnamespace
and (p.proname like 'nst_%') order by signature limit 40
),
dependencies as (
select p.oid::regprocedure::text as function_signature,d.deptype,
 pg_describe_object(d.classid,d.objid,d.objsubid) as dependent
from pg_proc p join pg_depend d on d.refclassid='pg_proc'::regclass and d.refobjid=p.oid
where p.pronamespace='public'::regnamespace and p.proname in ('nst_admit_attempt_v1','nst_admit_attempt_budget_v1')
order by function_signature,dependent limit 100
),
triggers as (
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
) order by c.relname,t.tgname limit 100
),
crypto as (
select to_regprocedure('pg_catalog.sha256(bytea)') as sha256_function,
 to_regprocedure('pg_catalog.gen_random_uuid()') as random_uuid_function
),
default_acls as (
select pg_get_userbyid(d.defaclrole) as creator_role,
 coalesce(n.nspname,'GLOBAL') as schema_name,d.defaclobjtype,d.defaclacl
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
where d.defaclnamespace=0 or n.nspname='public'
order by creator_role,schema_name,d.defaclobjtype limit 100
)
select statement_timestamp() as checked_at,current_user as inspection_role,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from relations q) as relations,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from constraints q) as constraints,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from indexes q) as indexes,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from object_acls q) as object_acls,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from policies q) as policies,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from roles q) as roles,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from functions q) as functions,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from dependencies q) as dependencies,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from triggers q) as triggers,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from crypto q) as crypto,
 (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from default_acls q) as default_acls;
