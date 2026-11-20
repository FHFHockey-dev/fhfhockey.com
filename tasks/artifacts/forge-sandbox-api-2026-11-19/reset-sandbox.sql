-- Sandbox only. Removes the sandbox job, the five sandbox schemas, the two sandbox roles and authenticator's membership
-- in forge_sandbox_api, so a new attempt can be generated for a new puck drop (sandbox_bootstrap.py --start ...) and
-- applied fresh. Nothing outside the sandbox is dropped: the guard refuses if either role owns anything elsewhere.
-- Remove forge_sandbox_api from the Data API exposed schemas as well when the sandbox is retired.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
select cron.unschedule(jobid) from cron.job where jobname = 'forge-sandbox-get-2099020991';
do $$ begin
  if exists (select from pg_catalog.pg_class c join pg_catalog.pg_roles r on r.oid = c.relowner
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where r.rolname in ('forge_sandbox_owner', 'forge_sandbox_api') and n.nspname not like 'forge_sandbox%'
        and c.relkind <> 't' and n.nspname !~ '^pg_toast')
    or exists (select from pg_catalog.pg_proc p join pg_catalog.pg_roles r on r.oid = p.proowner
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where r.rolname in ('forge_sandbox_owner', 'forge_sandbox_api') and n.nspname not like 'forge_sandbox%')
    then raise exception 'sandbox role owns objects outside the sandbox; inspect before reset'; end if;
end $$;
drop schema if exists forge_sandbox_api, forge_sandbox, forge_sandbox_capture, forge_sandbox_internal, forge_sandbox_exec cascade;
do $$ begin
  if exists (select from pg_catalog.pg_roles where rolname = 'forge_sandbox_api') then
    revoke forge_sandbox_api from authenticator;
    drop role forge_sandbox_api;
  end if;
  if exists (select from pg_catalog.pg_roles where rolname = 'forge_sandbox_owner') then
    revoke usage on schema extensions from forge_sandbox_owner;
    execute format('revoke forge_sandbox_owner from %I', current_user);
    drop role forge_sandbox_owner;
  end if;
end $$;
commit;
notify pgrst, 'reload schema';
select count(*) as sandbox_schemas_left from pg_catalog.pg_namespace where nspname like 'forge_sandbox%';
