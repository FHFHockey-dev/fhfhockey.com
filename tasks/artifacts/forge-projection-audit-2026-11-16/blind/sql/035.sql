select 'reserve_proj' t, count(*) n, max(created_at)::text from forge_reserve_projections where as_of_date >= '2026-11-01'
