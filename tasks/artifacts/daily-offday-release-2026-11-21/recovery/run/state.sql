set default_transaction_read_only=on;
select json_build_object(
 'at', now(),
 'runs', (select json_agg(json_build_object('run_id',run_id,'status',status,'git_sha',git_sha,'created_at',created_at,'scope',metrics->'execution_scope','resume',metrics->'resume') order by created_at) from forge_runs where as_of_date='2026-11-21'),
 'running', (select count(*) from forge_runs where as_of_date='2026-11-21' and status='running'),
 'player_rows', (select json_object_agg(k,c) from (select run_id::text||':'||game_id k, count(*) c from forge_player_projections where as_of_date='2026-11-21' group by 1) x),
 'team_rows', (select count(*) from forge_team_projections where as_of_date='2026-11-21'),
 'goalie_rows', (select count(*) from forge_goalie_projections where as_of_date='2026-11-21'),
 'live0359', (select json_build_object('outcome',outcome,'terminal_at',terminal_at,'revision_id',revision_id) from forge_pregame_capture.live_runs where game_id=2026020359),
 'writers', (select json_agg(json_build_object('pid',pid,'app',application_name,'state',state,'xact_start',xact_start,'q',left(query,120))) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and state<>'idle' and backend_type='client backend')
)::text;
