begin transaction read only;
set local statement_timeout = '5s';
set local lock_timeout = '2s';
with wanted(name) as (values
 ('line_source_ifttt_events'), ('lines_ccc_ifttt_events'), ('line_source_snapshots'), ('lines_ccc'),
 ('tweet_projection_reports'), ('tweet_player_events'), ('news_feed_items'),
 ('player_forecast_goalie_start_observations'), ('player_forecast_lineup_snapshots'),
 ('player_forecast_lineup_assignments'), ('player_forecast_inference_queue'), ('line_source_captures'),
 ('line_claim_revisions'), ('line_claim_relations'), ('line_entry_revisions'), ('line_pp_decisions'),
 ('tweet_pipeline_jobs'), ('nhl_api_game_roster_spots'), ('nhl_api_game_normalization_status'), ('nhl_api_game_payloads_raw')
), standard_roles as (
 select oid, rolname::text as name from pg_catalog.pg_roles where rolname in ('anon','authenticated','service_role')
 union all select 0::oid, 'PUBLIC'
), selected as (
 select w.name, c.oid, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relowner, c.relacl
 from wanted w left join pg_catalog.pg_namespace n on n.nspname = 'public'
 left join pg_catalog.pg_class c on c.relnamespace = n.oid and c.relname = w.name
), records as (
 select name,oid is null as missing,jsonb_build_object('name',name,'exists',oid is not null,
   'kind',relkind,'rls',relrowsecurity,'forceRls',relforcerowsecurity,
   'standardAclMd5',md5(coalesce((select jsonb_agg(jsonb_build_array(r.name,p.privilege_type,p.is_grantable) order by r.name,p.privilege_type)::text
     from pg_catalog.aclexplode(coalesce(s.relacl,pg_catalog.acldefault('r',s.relowner))) p
     join standard_roles r on r.oid=p.grantee),'[]'))) item
 from selected s
), document as (
 select jsonb_build_object('schema','public','records',jsonb_agg(item order by name),
   'rowCount',count(*),'missingCount',count(*) filter(where missing)) payload from records
)
select case when octet_length(payload::text)>7800
 then jsonb_build_object('guard','size_limit','rowCount',payload->'rowCount','dataBytes',octet_length(payload::text))
 else jsonb_build_object('guard',null,'dataBytes',octet_length(payload::text),'data',payload) end evidence from document;
commit;
