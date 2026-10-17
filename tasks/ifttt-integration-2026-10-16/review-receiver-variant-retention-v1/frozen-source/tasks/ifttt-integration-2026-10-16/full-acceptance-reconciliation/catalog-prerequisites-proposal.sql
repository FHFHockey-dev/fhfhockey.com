-- PROPOSAL ONLY: requires separate explicit IFTTT authorization for project
-- fyhftlxokyjtpndbkfse. One call, no retries; no stored values or bodies returned.
begin transaction read only;
set local statement_timeout='5s';
set local lock_timeout='2s';
with wanted(name) as (values
 ('tweet_projection_reports'),('tweet_player_events'),('line_source_snapshots'),('lines_ccc'),
 ('player_forecast_goalie_start_observations'),('player_forecast_lineup_snapshots'),('line_claim_revisions'),
 ('line_entry_revisions'),('line_pp_decisions'),('line_source_captures'),('news_feed_items'),
 ('player_forecast_inference_queue'),('player_forecast_lineup_assignments'),('line_claim_relations'),
 ('line_source_ifttt_events'),('lines_ccc_ifttt_events'),('tweet_pipeline_jobs'),('games'),
 ('roster_optimizer_team_games'),('nhl_api_game_roster_spots'),('nhl_api_game_normalization_status'),
 ('nhl_api_game_payloads_raw'),('forge_game_update_queue')
), relations as (
 select w.name,c.oid,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
  md5(coalesce((select jsonb_agg(jsonb_build_array(role,has_table_privilege(role,c.oid,'SELECT'),
   has_table_privilege(role,c.oid,'INSERT'),has_table_privilege(role,c.oid,'UPDATE'),has_table_privilege(role,c.oid,'DELETE')) order by role)::text
   from unnest(array['anon','authenticated','service_role']) role),'null')) acl_hash,
  md5(jsonb_build_object(
   'columns',(select jsonb_agg(jsonb_build_array(a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
    md5(coalesce(pg_get_expr(d.adbin,d.adrelid),''))) order by a.attnum) from pg_attribute a
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
   'constraints',(select jsonb_agg(jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid,true)) order by k.conname) from pg_constraint k where k.conrelid=c.oid),
   'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid) order by i.indexrelid::regclass::text) from pg_index i where i.indrelid=c.oid),
   'triggers',(select jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true),md5(pg_get_functiondef(t.tgfoid))) order by t.tgname)
    from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),
   'policies',(select jsonb_agg(jsonb_build_array(p.polname,p.polpermissive,p.polroles,p.polcmd,
    md5(coalesce(pg_get_expr(p.polqual,p.polrelid),'')),md5(coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''))) order by p.polname)
    from pg_policy p where p.polrelid=c.oid))::text) shape_hash
 from wanted w left join pg_namespace n on n.nspname='public' left join pg_class c on c.relnamespace=n.oid and c.relname=w.name
), functions as (
 select p.proname name,pg_get_function_identity_arguments(p.oid) args,p.prosecdef definer,p.provolatile volatility,
  md5(pg_get_functiondef(p.oid)) definition_hash,md5(coalesce(p.proconfig::text,'')) config_hash,
  md5((select jsonb_agg(jsonb_build_array(role,has_function_privilege(role,p.oid,'EXECUTE')) order by role)::text
   from unnest(array['anon','authenticated','service_role']) role)) acl_hash
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('capture_starter_board_lineup','capture_starter_board_goalies',
  'enqueue_player_forecast_job','claim_tweet_pipeline_job','append_line_decisions')
), payload as (
 select jsonb_build_object('version','ifttt-prerequisite-catalog-v1','relationCount',(select count(*) from relations),
  'missingCount',(select count(*) from relations where oid is null),'functionCount',(select count(*) from functions),
  'relations',(select jsonb_agg(jsonb_build_object('name',name,'exists',oid is not null,'kind',relkind,
   'rls',relrowsecurity,'forceRls',relforcerowsecurity,'aclHash',acl_hash,'shapeHash',shape_hash) order by name) from relations),
  'functions',(select coalesce(jsonb_agg(to_jsonb(f) order by name,args),'[]') from functions f)) data
), measured as (select data,octet_length(data::text) bytes from payload)
select case when bytes>7900 or (data->>'functionCount')::integer>16 then
 jsonb_build_object('guard','size_or_function_limit','dataBytes',bytes,'relationCount',23,'functionCount',(data->>'functionCount')::integer)
 else jsonb_build_object('guard',null,'dataBytes',bytes,'data',data) end evidence from measured;
commit;
