with expected_raw as materialized (
select goalie_id,goalie_name,date,season_id,games_played,game_id,team_abbreviation from public.wgo_goalie_stats
where date between date '2026-10-27' and date '2026-10-31' order by date,goalie_id limit 501
), expected as materialized (select * from expected_raw where season_id=20262027 and games_played>0),
observed as materialized ((select 'nst_gamelog_goalie_5v5_counts'::text as dataset, to_jsonb(t) as r from public.nst_gamelog_goalie_5v5_counts t where date_scraped between date '2026-10-27' and date '2026-10-31' order by date_scraped,player_id limit 501)
union all
(select 'nst_gamelog_goalie_5v5_rates'::text as dataset, to_jsonb(t) as r from public.nst_gamelog_goalie_5v5_rates t where date_scraped between date '2026-10-27' and date '2026-10-31' order by date_scraped,player_id limit 501)
union all
(select 'nst_gamelog_goalie_all_rates'::text as dataset, to_jsonb(t) as r from public.nst_gamelog_goalie_all_rates t where date_scraped between date '2026-10-27' and date '2026-10-31' order by date_scraped,player_id limit 501)
union all
(select 'nst_gamelog_goalie_ev_counts'::text as dataset, to_jsonb(t) as r from public.nst_gamelog_goalie_ev_counts t where date_scraped between date '2026-10-27' and date '2026-10-31' order by date_scraped,player_id limit 501)
union all
(select 'nst_gamelog_goalie_ev_rates'::text as dataset, to_jsonb(t) as r from public.nst_gamelog_goalie_ev_rates t where date_scraped between date '2026-10-27' and date '2026-10-31' order by date_scraped,player_id limit 501)
union all
(select 'nst_gamelog_goalie_pk_counts'::text as dataset, to_jsonb(t) as r from public.nst_gamelog_goalie_pk_counts t where date_scraped between date '2026-10-27' and date '2026-10-31' order by date_scraped,player_id limit 501)
union all
(select 'nst_gamelog_goalie_pk_rates'::text as dataset, to_jsonb(t) as r from public.nst_gamelog_goalie_pk_rates t where date_scraped between date '2026-10-27' and date '2026-10-31' order by date_scraped,player_id limit 501)
union all
(select 'nst_gamelog_goalie_pp_counts'::text as dataset, to_jsonb(t) as r from public.nst_gamelog_goalie_pp_counts t where date_scraped between date '2026-10-27' and date '2026-10-31' order by date_scraped,player_id limit 501)
union all
(select 'nst_gamelog_goalie_pp_rates'::text as dataset, to_jsonb(t) as r from public.nst_gamelog_goalie_pp_rates t where date_scraped between date '2026-10-27' and date '2026-10-31' order by date_scraped,player_id limit 501)),
datasets as (select unnest(array['nst_gamelog_goalie_5v5_counts','nst_gamelog_goalie_5v5_rates','nst_gamelog_goalie_all_rates','nst_gamelog_goalie_ev_counts','nst_gamelog_goalie_ev_rates','nst_gamelog_goalie_pk_counts','nst_gamelog_goalie_pk_rates','nst_gamelog_goalie_pp_counts','nst_gamelog_goalie_pp_rates']) as dataset),
qualified as (
select dataset,r,
array(select f from unnest(case when dataset like '%_counts'
then array['gp','toi','shots_against','saves','goals_against','xg_against','hd_shots_against','hd_saves']
else array['gp','toi','toi_per_gp','shots_against_per_60','saves_per_60','gaa','xg_against_per_60','hd_shots_against_per_60','hd_saves_per_60'] end) f
where (r->>f is null) and (dataset like '%_counts' or f in ('gp','toi') or (r->>'toi')::numeric>0)) as missing_core_fields
from observed
),
per_table as (
select d.dataset,
(select count(*) from observed o where o.dataset=d.dataset) as rows_read,
(select count(distinct (r->>'player_id',r->>'date_scraped',r->>'season')) from observed o where o.dataset=d.dataset) as distinct_keys,
(select count(*) from observed o where o.dataset=d.dataset and r->>'season'='20262027') as season_rows,
(select count(*) from expected e where exists(select 1 from observed o where o.dataset=d.dataset and r->>'player_id'=e.goalie_id::text and r->>'date_scraped'=e.date::text and r->>'season'='20262027')) as matched_wgo_keys,
(select jsonb_agg(jsonb_build_object('date',e.date,'goalieId',e.goalie_id,'name',e.goalie_name) order by e.date,e.goalie_id) from expected e where not exists(select 1 from observed o where o.dataset=d.dataset and r->>'player_id'=e.goalie_id::text and r->>'date_scraped'=e.date::text and r->>'season'='20262027')) as absent_wgo_keys,
(select jsonb_agg(jsonb_build_object('date',r->>'date_scraped','goalieId',r->>'player_id','name',r->>'player_name','season',r->'season') order by r->>'date_scraped',r->>'player_id') from observed o where o.dataset=d.dataset and not exists(select 1 from expected e where r->>'player_id'=e.goalie_id::text and r->>'date_scraped'=e.date::text and r->>'season'=e.season_id::text)) as unmatched_or_invalid_season_rows,
(select jsonb_agg(jsonb_build_object('date',r->>'date_scraped','goalieId',r->>'player_id','name',r->>'player_name','toi',r->'toi','missingFields',missing_core_fields) order by r->>'date_scraped',r->>'player_id') from qualified o where o.dataset=d.dataset and cardinality(missing_core_fields)>0) as missing_core_fields,
(select jsonb_agg(v order by v->>'date') from (select jsonb_build_object('date',r->>'date_scraped','rows',count(*),'matched',count(*) filter(where exists(select 1 from expected e where r->>'player_id'=e.goalie_id::text and r->>'date_scraped'=e.date::text and r->>'season'=e.season_id::text)),'zeroToi',count(*) filter(where (r->>'toi')::numeric=0),'nullToi',count(*) filter(where r->>'toi' is null)) v from observed o where o.dataset=d.dataset group by r->>'date_scraped') x) as per_date,
(select jsonb_object_agg(field,n) from (select k.key field,count(*) n from observed o cross join lateral jsonb_each(o.r) k where o.dataset=d.dataset and k.value='null'::jsonb group by k.key) x) as null_field_counts,
(select jsonb_agg(jsonb_build_object('date',r->>'date_scraped','goalieId',r->>'player_id','name',r->>'player_name','gp',r->'gp','toi',r->'toi','team',r->>'team')) from observed o where o.dataset=d.dataset and (coalesce((r->>'gp')::numeric,0)<=0 or coalesce((r->>'toi')::numeric,-1)<0 or nullif(r->>'team','') is null)) as invalid_identity_or_exposure,
(select jsonb_agg(jsonb_build_object('date',r->>'date_scraped','goalieId',r->>'player_id')) from observed o where o.dataset=d.dataset and d.dataset not like '%_all_rates' and not exists(select 1 from observed p where p.dataset=case when d.dataset like '%_counts' then replace(d.dataset,'_counts','_rates') else replace(d.dataset,'_rates','_counts') end and p.r->>'player_id'=o.r->>'player_id' and p.r->>'date_scraped'=o.r->>'date_scraped' and p.r->>'season'=o.r->>'season')) as absent_from_paired_table
from datasets d)
select statement_timestamp() as checked_at, current_database() as database_name,
(select count(*) from expected_raw) as wgo_rows_read,
(select count(*) from expected) as wgo_expected_rows,
(select count(distinct (goalie_id,date,season_id)) from expected) as wgo_distinct_keys,
(select jsonb_agg(v order by v->>'date') from (select jsonb_build_object('date',date,'rows',count(*),'gamesPlayedSum',sum(games_played),'nullGameIds',count(*) filter(where game_id is null),'duplicateGameDayPossible',bool_or(games_played<>1)) v from expected group by date) x) as wgo_per_date,
(select jsonb_agg(to_jsonb(e)) from expected_raw e where season_id is distinct from 20262027 or games_played is null or games_played<=0) as wgo_excluded_or_unknown,
(select jsonb_agg(to_jsonb(t) order by dataset) from per_table t) as tables
