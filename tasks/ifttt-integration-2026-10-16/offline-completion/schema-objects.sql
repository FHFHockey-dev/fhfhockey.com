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
), wanted_functions(name) as (values ('capture_starter_board_goalies'), ('capture_starter_board_lineup'),
 ('enqueue_player_forecast_job'), ('append_line_decisions'), ('claim_tweet_pipeline_job')),
standard_roles as (
 select oid, rolname::text as name from pg_catalog.pg_roles where rolname in ('anon','authenticated','service_role')
 union all select 0::oid, 'PUBLIC'
), relations as (
 select c.oid,c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 join wanted w on w.name=c.relname where n.nspname='public'
), objects as (
 select 'constraint' as kind, r.relname::text as relation, c.conname::text as name,
   jsonb_build_object('type',c.contype,'validated',c.convalidated,
     'definitionMd5',md5(pg_catalog.pg_get_constraintdef(c.oid,true))) as detail
 from pg_catalog.pg_constraint c join relations r on r.oid=c.conrelid
 union all
 select 'index',r.relname::text,i.relname::text,
   jsonb_build_object('unique',x.indisunique,'valid',x.indisvalid,
     'definitionMd5',md5(pg_catalog.pg_get_indexdef(x.indexrelid)))
 from pg_catalog.pg_index x join relations r on r.oid=x.indrelid join pg_catalog.pg_class i on i.oid=x.indexrelid
 union all
 select 'function',null,w.name,
   jsonb_build_object('exists',p.oid is not null,'signature',pg_catalog.pg_get_function_identity_arguments(p.oid),
     'securityDefiner',p.prosecdef,'volatility',p.provolatile,
     'definitionMd5',case when p.oid is not null then md5(pg_catalog.pg_get_functiondef(p.oid)) end,
     'grants',coalesce((select jsonb_agg(jsonb_build_object('role',r.name,'privilege',a.privilege_type,'grantable',a.is_grantable) order by r.name)
       from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
       join standard_roles r on r.oid=a.grantee),'[]'::jsonb))
 from wanted_functions w left join pg_catalog.pg_namespace n on n.nspname='public'
 left join pg_catalog.pg_proc p on p.pronamespace=n.oid and p.proname=w.name and p.prokind in ('f','p')
), bounded as (select * from objects order by kind,relation,name,detail::text limit 101), document as (
 select jsonb_build_object('records',jsonb_agg(jsonb_build_object('kind',kind,'schema','public',
   'relation',relation,'name',name,'detail',detail) order by kind,relation,name,detail::text),
   'rowCount',count(*),'rowGuard',count(*)>100,
   'missingFunctionCount',count(*) filter(where kind='function' and not (detail->>'exists')::boolean)) as payload from bounded
)
select case when octet_length(payload::text)>24000 or (payload->>'rowGuard')::boolean
 then jsonb_build_object('guard','size_or_row_limit','rowCount',payload->'rowCount','dataBytes',octet_length(payload::text))
 else jsonb_build_object('guard',null,'dataBytes',octet_length(payload::text),'data',payload) end as evidence
from document;
commit;
