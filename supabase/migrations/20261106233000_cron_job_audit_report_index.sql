-- The daily cron report reads cron_job_audit for a 24-hour window, ordered by
-- (run_time, job_name, status, rows_affected, details) and paged with OFFSET.
-- The table had no index at all (350,605 rows, 596 MB on 2026-11-06), so every
-- page was a parallel sequential scan plus a full sort and hit the 8 s API
-- statement timeout from page 2 on. The 11-05 and 11-06 reports were
-- "incomplete telemetry; totals unknown" for that reason.
--
-- This index matches the leading order keys: the window becomes an index range
-- scan, and only rows that tie on all four keys need the jsonb sort. The
-- success-history lookback (filtered by job_name and status) uses it too.
--
-- Applying by hand in the SQL editor: run the statements below as written, or
-- run the CONCURRENTLY form on its own to avoid blocking audit inserts while the
-- index builds:
--   create index concurrently if not exists cron_job_audit_run_time_idx
--     on public.cron_job_audit (run_time, job_name, status, rows_affected);
--   analyze public.cron_job_audit;

create index if not exists cron_job_audit_run_time_idx
  on public.cron_job_audit (run_time, job_name, status, rows_affected);

-- The planner estimated 1 row for a 24-hour window; refresh the statistics.
analyze public.cron_job_audit;
