-- ROLLBACK for supabase/migrations/20261109015836_nst_admission_post_burst_gap.sql. DRAFT, NOT APPLIED.
-- Restores the accepted shared-admission budget body (source sha256 aefd3c20..., the
-- function renamed to nst_admit_attempt_budget_v1 by 20261101161622) verbatim, then drops
-- the two burst columns. CREATE OR REPLACE keeps the owner and ACL. One transaction.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
CREATE OR REPLACE FUNCTION public.nst_admit_attempt_budget_v1(p_burst boolean DEFAULT false, p_planned_requests integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE
  entries timestamptz[];
  observed timestamptz;
  prior_spacing integer;
  requested_spacing integer := CASE WHEN p_burst IS TRUE AND p_planned_requests BETWEEN 1 AND 78 THEN 0 ELSE 22000 END;
  delay_ms bigint := 0;
  window_ms integer;
  cap integer;
  count_in_window integer;
  oldest timestamptz;
BEGIN
  SELECT attempts, last_spacing_ms INTO STRICT entries, prior_spacing FROM public.nst_request_admission_state
    WHERE singleton = true FOR UPDATE;
  observed := clock_timestamp();
  SELECT coalesce(array_agg(t ORDER BY t), '{}'::timestamptz[]) INTO entries
    FROM unnest(entries) t WHERE t >= observed - interval '3601 seconds';
  IF cardinality(entries) > 0 THEN
    delay_ms := greatest(0, ceil(extract(epoch FROM (entries[cardinality(entries)] + (greatest(prior_spacing, requested_spacing) * interval '1 millisecond') - observed))*1000)::bigint);
  END IF;
  FOR window_ms, cap IN SELECT * FROM (VALUES (60000,39),(300000,80),(900000,100),(3600000,180)) limits(ms,cap)
  LOOP
    SELECT count(*), min(t) INTO count_in_window, oldest FROM unnest(entries) t
      WHERE t >= observed - ((window_ms + 1000) * interval '1 millisecond');
    IF count_in_window >= cap THEN
      delay_ms := greatest(delay_ms, ceil(extract(epoch FROM (oldest + ((window_ms + 1001) * interval '1 millisecond') - observed))*1000)::bigint);
    END IF;
  END LOOP;
  IF delay_ms > 0 THEN
    RETURN jsonb_build_object('version',1,'scope','global-nst','allowed',false,'waitMs',delay_ms,'permitTtlMs',1000);
  END IF;
  UPDATE public.nst_request_admission_state SET attempts = array_append(entries, observed), last_spacing_ms = requested_spacing WHERE singleton = true;
  RETURN jsonb_build_object('version',1,'scope','global-nst','allowed',true,'waitMs',0,'permitTtlMs',1000);
END;
$$;
alter table public.nst_request_admission_state drop column burst_last_at, drop column burst_remaining;
delete from supabase_migrations.schema_migrations where version = '20261109015836';
commit;
-- Readback: md5(prosrc) of nst_admit_attempt_budget_v1 = b1821941a79c71b95eeab6bd0ec13950 (the pre-change body).
