select table_name, jsonb_agg(jsonb_build_object('column',column_name,'type',data_type,'nullable',is_nullable) order by ordinal_position) as columns
from information_schema.columns
where table_schema='public' and table_name in
('wgo_goalie_stats','nst_gamelog_goalie_5v5_counts','nst_gamelog_goalie_5v5_rates','nst_gamelog_goalie_ev_counts','nst_gamelog_goalie_ev_rates','nst_gamelog_goalie_all_rates','nst_gamelog_goalie_pp_counts','nst_gamelog_goalie_pp_rates','nst_gamelog_goalie_pk_counts','nst_gamelog_goalie_pk_rates')
group by table_name order by table_name limit 10
