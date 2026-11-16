select scope, max(date) last_date, count(*) filter (where date >= '2026-11-01') rows_nov, max(updated_at) upd from forge_projection_accuracy_daily group by 1
