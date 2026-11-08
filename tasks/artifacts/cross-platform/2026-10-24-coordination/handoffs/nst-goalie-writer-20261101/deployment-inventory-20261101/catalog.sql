select statement_timestamp() as checked_at,
 (select jsonb_agg(to_jsonb(j)) from (
   select jobid,jobname,schedule,active,
     substring(command from 'https?://[^''"[:space:])?]+') as destination_without_query,
     command ~* 'net\.http_(get|post)' as uses_pg_net,
     md5(command) as command_fingerprint
   from cron.job
   where command ~* '(naturalstattrick|update-nst|fetch_team_table|nst-team-stats|route-runner|cron-report)'
      or jobname ~* '(nst|route.runner|cron.report)'
   order by jobid limit 40
 ) j) as schedules,
 (select jsonb_agg(to_jsonb(p)) from (
   select n.nspname as schema,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
     l.lanname as language,p.prosecdef as security_definer,md5(pg_get_functiondef(p.oid)) as definition_fingerprint
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
   where n.nspname='public' and (p.proname like 'nst_%' or p.proname like 'route_runner_%')
   order by p.proname,p.oid limit 60
 ) p) as available_control_functions,
 (select jsonb_agg(to_jsonb(c)) from (
   select n.nspname as schema,c.relname,c.relkind,c.relrowsecurity
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and (c.relname in ('nst_request_admission_state','route_runner_jobs','route_runner_steps','nst_jobs','nst_job_control') or c.relname like 'nst_goalie_%')
    and c.relkind in ('r','p','v')
   order by c.relname limit 30
 ) c) as available_control_relations
