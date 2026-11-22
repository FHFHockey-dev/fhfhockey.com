-- Separate authorization for this synthetic fixture and automated independent witness only.
\set ON_ERROR_STOP on
begin;
set local lock_timeout='2s';
do $$ begin
  if (select count(*) from cron.job where not active and username=current_user
      and jobname in ('forge-isolated-dispatch-2099020991','forge-isolated-watch-2099020991'))<>2
    or exists(select from cron.job where active)
    or coalesce(current_setting('cron.timezone',true),'GMT') not in ('GMT','UTC')
    or (select count(*) from vault.decrypted_secrets where name='forge_pregame_dispatch_secret'
      and decrypted_secret ~ '^[!-~]{32,}$')<>1 then raise exception 'isolated_preflight_failed'; end if;
end $$;
select forge_pregame_capture.hosted_arm_v2(2099020991);
select cron.alter_job(jobid,active:=true) from cron.job where jobname in
  ('forge-isolated-dispatch-2099020991','forge-isolated-watch-2099020991') and username=current_user;
commit;
