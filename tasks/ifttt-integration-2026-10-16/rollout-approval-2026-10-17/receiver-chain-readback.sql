-- PROPOSAL ONLY. Read-only catalog readback for the IFTTT receiver chain (SQL6 -> SQL7 -> SQL8).
-- Run once before and once after an approved migration: BEGIN READ ONLY; SET LOCAL statement_timeout='5s';
-- SET LOCAL lock_timeout='2s'; <this statement>; ROLLBACK. Returns catalog metadata and aggregate counts only:
-- no function bodies, policy expressions, credentials or application row values.
with names(relname) as (values ('line_source_ifttt_events'),('lines_ccc_ifttt_events'),
  ('ifttt_raw_receipt_variants'),('ifttt_intake_policies'),('ifttt_intake_receipts')),
fns(proname) as (values ('retain_ifttt_raw_receipt'),('guard_ifttt_raw_receipt_variant'),('valid_ifttt_intake_policy'),
  ('guard_ifttt_intake_state'),('register_ifttt_intake_policy'),('stop_ifttt_intake_policy'),
  ('retain_bounded_ifttt_raw_receipt'),('reconcile_ifttt_raw_receipt')),
rels as (select c.oid,c.relname,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
  from pg_class c join names n using(relname) where c.relnamespace='public'::regnamespace and c.relkind in ('r','p'))
select jsonb_build_object(
 'server',jsonb_build_object('version',current_setting('server_version'),'timeZone',current_setting('TimeZone'),'currentUser',current_user),
 'roles',(select jsonb_object_agg(rolname,jsonb_build_object('bypassrls',rolbypassrls,'config',to_jsonb(rolconfig)))
   from pg_roles where rolname in ('service_role','authenticator','anon','authenticated','postgres')),
 'missingRelations',(select coalesce(jsonb_agg(n.relname order by n.relname),'[]') from names n where not exists(select 1 from rels r where r.relname=n.relname)),
 'relations',(select coalesce(jsonb_object_agg(r.relname,jsonb_build_object(
   'owner',pg_get_userbyid(r.relowner),'rls',r.relrowsecurity,'forceRls',r.relforcerowsecurity,
   'acl',(select coalesce(jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type) order by 1),'[]')
     from aclexplode(r.relacl) a),
   'columns',(select jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) order by attnum)
     from pg_attribute where attrelid=r.oid and attnum>0 and not attisdropped),
   'indexes',(select coalesce(jsonb_agg(pg_get_indexdef(indexrelid) order by 1),'[]') from pg_index where indrelid=r.oid),
   'triggers',(select coalesce(jsonb_agg(jsonb_build_array(tgname,tgenabled,tgfoid::regproc::text) order by 1),'[]')
     from pg_trigger where tgrelid=r.oid and not tgisinternal),
   'policies',(select count(*) from pg_policy where polrelid=r.oid))),'{}') from rels r),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),
   'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'volatility',p.provolatile,'config',to_jsonb(p.proconfig),
   'acl',case when p.proacl is null then to_jsonb('DEFAULT(PUBLIC EXECUTE)'::text) else (select jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type) order by 1)
     from aclexplode(p.proacl) a) end) order by p.proname,2),'[]')
   from pg_proc p join fns f using(proname) where p.pronamespace='public'::regnamespace),
 'counts',jsonb_build_object(
   'ifttt_intake_policies',case when to_regclass('public.ifttt_intake_policies') is null then null
     else (xpath('//n/text()',query_to_xml('select count(*) n from public.ifttt_intake_policies',false,false,'')))[1]::text::bigint end,
   'ifttt_intake_receipts',case when to_regclass('public.ifttt_intake_receipts') is null then null
     else (xpath('//n/text()',query_to_xml('select count(*) n from public.ifttt_intake_receipts',false,false,'')))[1]::text::bigint end,
   'ifttt_raw_receipt_variants',case when to_regclass('public.ifttt_raw_receipt_variants') is null then null
     else (xpath('//n/text()',query_to_xml('select count(*) n from public.ifttt_raw_receipt_variants',false,false,'')))[1]::text::bigint end)
) readback;
