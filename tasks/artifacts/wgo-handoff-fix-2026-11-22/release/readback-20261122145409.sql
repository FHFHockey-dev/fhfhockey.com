set default_transaction_read_only=on;
select json_build_object(
 'ledger',(select json_build_object('version',version,'name',name,'n',array_length(statements,1)) from supabase_migrations.schema_migrations where version='20261122145409'),
 'digest_fn',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='wgo_skater_date_digest'),
 'service_role_exec',has_function_privilege('service_role','public.wgo_skater_date_digest(date)','execute'),
 'anon_exec',has_function_privilege('anon','public.wgo_skater_date_digest(date)','execute'),
 'authenticated_exec',has_function_privilege('authenticated','public.wgo_skater_date_digest(date)','execute'),
 'readiness_has_digest',(select bool_or(pg_get_functiondef(p.oid) like '%sourceDigests%') from pg_proc p where p.proname='read_rankings_publication_readiness'),
 'digest_1121',(select public.wgo_skater_date_digest('2026-11-21'::date))
)::text;
