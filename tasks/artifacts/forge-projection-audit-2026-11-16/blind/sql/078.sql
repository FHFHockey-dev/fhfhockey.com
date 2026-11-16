select status, count(*), max(created_at) from forge_runs where created_at > now() - interval '30 days' group by 1
