-- Read hygiene gate: stop if >5 active queries or any active query older than 10 s.
select count(*) filter (where state = 'active' and pid <> pg_backend_pid()) as active,
       coalesce(max(extract(epoch from now() - query_start)) filter (where state = 'active' and pid <> pg_backend_pid()), 0)::int as longest_active_s
from pg_stat_activity
where datname = current_database() and backend_type = 'client backend';
