-- Bounded read-only reconciliation of one known legacy job; never replay or call a route.
select statement_timestamp() as checked_at,
 (select to_jsonb(j) from (
  select id,route_path,contract,status,steps,kills,rows_total,last_status_code,last_operation_status,
    created_at,updated_at,finished_at,lease_until,not_before,expires_at,
    left(regexp_replace(regexp_replace(last_error,'https?://[^[:space:]"<>]+','[URL]','g'),'[A-Za-z0-9_-]{80,}','[REDACTED]','g'),500) as last_error_redacted,
    (select jsonb_object_agg(key,value) from jsonb_each(initial_query) where key in
      ('startDate','endDate','maxDays','maxUrls','requestIntervalMs','runMode','overwrite','datasetType','cursor','resumeScope','plannedUrls')) as bounded_initial_query,
    (select jsonb_object_agg(key,value) from jsonb_each(next_query) where key in
      ('startDate','endDate','maxDays','maxUrls','requestIntervalMs','runMode','overwrite','datasetType','cursor','resumeScope','plannedUrls')) as bounded_next_query,
    (select jsonb_object_agg(key,value) from jsonb_each(coalesce(progress,'{}'::jsonb)) where key in
      ('lastSignature','stalls','consecutiveKills','lastProcessedDate','lastCompletedDate','nextStartDate','nextCursor','pendingUrlsProcessed','plannedUrls')) as bounded_progress
  from public.route_runner_jobs where id='c3f5b27e-d8ae-42a8-809d-a9c5175694c4'::uuid limit 1
 ) j) as job,
 (select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from (
  select id,at,level,step,status_code,rows,duration_ms,
   left(regexp_replace(regexp_replace(message,'https?://[^[:space:]"<>]+','[URL]','g'),'[A-Za-z0-9_-]{80,}','[REDACTED]','g'),500) as message_redacted,
   (select jsonb_object_agg(key,value) from jsonb_each(coalesce(progress,'{}'::jsonb)) where key in
      ('stalls','pendingUrlsProcessed','nextStartDate','lastSignature','cursor','nextCursor','operationStatus','retrySafe','requiresReview')) as bounded_progress
  from public.route_runner_events where job_id='c3f5b27e-d8ae-42a8-809d-a9c5175694c4'::uuid
  order by id desc limit 35
 ) e) as events,
 (select jsonb_agg(to_jsonb(p)) from (
   select relname,has_table_privilege('service_role',c.oid,'SELECT') as service_select,
    has_table_privilege('service_role',c.oid,'INSERT') as service_insert,
    has_table_privilege('service_role',c.oid,'UPDATE') as service_update,
    has_sequence_privilege('service_role','public.route_runner_events_id_seq','USAGE') as event_sequence_usage
   from pg_class c where c.relnamespace='public'::regnamespace and
     c.relname in ('route_runner_jobs','route_runner_events','seasons','games','wgo_goalie_stats')
   order by c.relname limit 5
 ) p) as dependency_privileges,
 to_regclass('supabase_migrations.schema_migrations')::text as migration_history_relation;
