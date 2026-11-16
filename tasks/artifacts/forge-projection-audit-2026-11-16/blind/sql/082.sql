select max(as_of_date) last_asof, max(updated_at) last_upd, count(*) filter (where as_of_date >= '2026-11-09') since_1109 from forge_projection_results where as_of_date >= '2026-10-25'
