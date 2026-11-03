-- PROPOSED ONLY. Requires explicit TJ approval. Project fyhftlxokyjtpndbkfse; role postgres.
-- Accepted source body is unchanged. Apply only after verified privilege prerequisite.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
CREATE TABLE public.nst_request_admission_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  attempts timestamptz[] NOT NULL DEFAULT '{}',
  last_spacing_ms integer NOT NULL DEFAULT 22000 CHECK(last_spacing_ms IN (0,22000))
);
ALTER TABLE public.nst_request_admission_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nst_request_admission_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.nst_request_admission_state TO service_role;
INSERT INTO public.nst_request_admission_state(singleton) VALUES (true);

-- One row lock serializes every provider attempt across hosts/languages/keys.
-- Count attempts, never distinct URLs. Failed/expired permits are not refunded.
-- Bounded complete plans may use rolling headroom without fixed pacing.
-- Unknown/large plans retain22s admission spacing, including paced/burst transitions.
-- A1s dispatch TTL is added to EVERY window so no delayed permit ages out early.
CREATE FUNCTION public.nst_admit_attempt_v1(p_burst boolean DEFAULT false, p_planned_requests integer DEFAULT NULL) RETURNS jsonb
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
REVOKE ALL ON FUNCTION public.nst_admit_attempt_v1(boolean,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nst_admit_attempt_v1(boolean,integer) TO service_role;

commit;
