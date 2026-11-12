-- Rollback for 20261111181100_add_nst_seasonlong_5v5_views.sql: drops the three views it created (nothing else
-- depends on them; rates first because it reads the two count views). No pre-existing object is touched.
begin;
DROP VIEW public.nst_seasonlong_5v5_rates;
DROP VIEW public.nst_seasonlong_5v5_counts_oi;
DROP VIEW public.nst_seasonlong_5v5_counts;
commit;
