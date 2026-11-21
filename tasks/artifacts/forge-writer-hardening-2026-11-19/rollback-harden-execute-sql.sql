-- Roll back harden-execute-sql.sql: give service_role EXECUTE on execute_sql again (the pre-hardening grant) and remove
-- csv_create_table_v1. Tables it created stay (they hold uploaded data). Re-opens writer-reach probes F1-F4. Run as postgres.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
grant execute on function public.execute_sql(text) to service_role;
drop function if exists public.csv_create_table_v1(text, jsonb);
commit;
notify pgrst, 'reload schema';
select json_build_object('serviceRoleExecuteSql', has_function_privilege('service_role', 'public.execute_sql(text)', 'EXECUTE'),
  'csvCreatePresent', to_regprocedure('public.csv_create_table_v1(text, jsonb)') is not null);
