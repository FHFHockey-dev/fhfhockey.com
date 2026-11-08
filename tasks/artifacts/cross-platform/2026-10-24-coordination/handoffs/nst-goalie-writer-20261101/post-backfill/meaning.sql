with observed as materialized ((select 'nst_gamelog_goalie_5v5_counts'::text as dataset, to_jsonb(t) as r from public.nst_gamelog_goalie_5v5_counts t where date_scraped between date '2026-10-27' and date '2026-10-31' order by date_scraped,player_id limit 501)
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
null_checks as (
select dataset,r->>'date_scraped' as date,r->>'player_id' as goalie_id,k.field,k.denominator,
(r->>k.denominator)::numeric as denominator_value
from observed o cross join lateral (values
('sv_percentage',case when dataset like '%_counts' then 'shots_against' else 'shots_against_per_60' end),
('hd_sv_percentage',case when dataset like '%_counts' then 'hd_shots_against' else 'hd_shots_against_per_60' end),
('md_sv_percentage',case when dataset like '%_counts' then 'md_shots_against' else 'md_shots_against_per_60' end),
('ld_sv_percentage',case when dataset like '%_counts' then 'ld_shots_against' else 'ld_shots_against_per_60' end),
('avg_shot_distance',case when dataset like '%_counts' then 'shots_against' else 'shots_against_per_60' end),
('avg_goal_distance',case when dataset like '%_counts' then 'goals_against' else 'gaa' end)
) k(field,denominator) where r->>k.field is null),
absent(situation,date,goalie_id) as (values
('pk','2026-10-27',8476945),('pk','2026-10-30',8478916),('pk','2026-10-31',8478406),
('pp','2026-10-27',8479193),('pp','2026-10-29',8477992),('pp','2026-10-29',8482076),('pp','2026-10-31',8482949)),
exposures as (
select a.*, ar.r->>'player_name' as name,(ar.r->>'toi')::numeric as all_toi,(ev.r->>'toi')::numeric as ev_toi,(other.r->>'toi')::numeric as other_special_toi,
(ar.r->>'toi')::numeric-(ev.r->>'toi')::numeric-(other.r->>'toi')::numeric as remaining_toi
from absent a left join observed ar on ar.dataset='nst_gamelog_goalie_all_rates' and ar.r->>'date_scraped'=a.date and ar.r->>'player_id'=a.goalie_id::text
left join observed ev on ev.dataset='nst_gamelog_goalie_ev_counts' and ev.r->>'date_scraped'=a.date and ev.r->>'player_id'=a.goalie_id::text
left join observed other on other.dataset='nst_gamelog_goalie_'||(case a.situation when 'pk' then 'pp' else 'pk' end)||'_counts' and other.r->>'date_scraped'=a.date and other.r->>'player_id'=a.goalie_id::text
)
select statement_timestamp() as checked_at,
(select jsonb_agg(to_jsonb(e) order by situation,date,goalie_id) from exposures e) as absent_situation_exposure,
(select jsonb_agg(to_jsonb(n) order by dataset,date,goalie_id,field) from null_checks n where denominator_value is null or denominator_value<>0) as unexplained_nulls,
(select count(*) from null_checks where denominator_value=0) as null_values_with_zero_denominator,
(select jsonb_agg(v order by v->>'dataset') from (select jsonb_build_object('dataset',dataset,'rowsRead',count(*)) v from observed group by dataset) x) as read_caps
