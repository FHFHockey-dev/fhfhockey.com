select as_of_date, count(*) n, string_agg(status||'@'||to_char(created_at,'MM-DD HH24:MI'), ' ' order by created_at) runs from forge_runs where as_of_date >= '2026-11-08' group by 1 order by 1
