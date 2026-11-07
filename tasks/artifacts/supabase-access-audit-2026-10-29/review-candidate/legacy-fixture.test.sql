-- Disposable local PostgreSQL only; synthetic catalog and rows.
-- Exercises both review candidates and their observed-state rollbacks.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE non_api_role NOLOGIN;

CREATE TABLE public.cron_job_audit
  (job_name text, run_time timestamptz, status text, rows_affected integer, details jsonb);
CREATE TABLE public.job_locks (job_name text PRIMARY KEY, locked_at timestamptz DEFAULT now());
ALTER TABLE public.cron_job_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.cron_job_audit FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.job_locks FOR SELECT USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.cron_job_audit, public.job_locks TO anon, authenticated, service_role;
INSERT INTO public.cron_job_audit VALUES ('synthetic', now(), 'ok', 1, '{}'::jsonb);

CREATE FUNCTION public.acquire_lock(job_name_param text, timeout_interval interval)
RETURNS boolean LANGUAGE plpgsql
SET search_path TO pg_catalog, public, pg_temp AS $function$
DECLARE lock_acquired boolean;
BEGIN
  BEGIN
    INSERT INTO public.job_locks (job_name) VALUES (job_name_param);
    lock_acquired := true;
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.job_locks SET locked_at = now()
      WHERE job_name = job_name_param AND locked_at < (now() - timeout_interval)
      RETURNING true INTO lock_acquired;
    lock_acquired := coalesce(lock_acquired, false);
  END;
  RETURN lock_acquired;
END
$function$;
GRANT EXECUTE ON FUNCTION public.acquire_lock(text, interval) TO anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT has_function_privilege('non_api_role', 'public.acquire_lock(text,interval)', 'EXECUTE') THEN
    RAISE EXCEPTION 'fixture must capture inherited PUBLIC EXECUTE';
  END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.cron_job_audit) <> 1 THEN
    RAISE EXCEPTION 'baseline anonymous policy must expose the synthetic audit row';
  END IF;
END $$;
RESET ROLE;

\ir 02-legacy-operational-tables.sql
\ir 03-legacy-acquire-lock-function.sql

DO $$
DECLARE r text; t text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.cron_job_audit','public.job_locks'] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(r,t,p) THEN RAISE EXCEPTION '% retains % on %',r,p,t; END IF;
      END LOOP;
    END LOOP;
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF NOT has_table_privilege('service_role',t,p) THEN
        RAISE EXCEPTION 'service unexpectedly lost % on %',p,t;
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('cron_job_audit','job_locks')) THEN
    RAISE EXCEPTION 'public-read policies remain';
  END IF;
  IF has_function_privilege('anon','public.acquire_lock(text,interval)','EXECUTE')
    OR has_function_privilege('authenticated','public.acquire_lock(text,interval)','EXECUTE')
    OR has_function_privilege('non_api_role','public.acquire_lock(text,interval)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.acquire_lock(text,interval)','EXECUTE') THEN
    RAISE EXCEPTION 'lock function EXECUTE matrix does not match candidate';
  END IF;
END $$;

SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.cron_job_audit;
    RAISE EXCEPTION 'anon audit read should have failed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.job_locks;
    RAISE EXCEPTION 'authenticated lock read should have failed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE service_role;
INSERT INTO public.cron_job_audit VALUES ('service-fixture', now(), 'ok', 2, '{}'::jsonb);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.cron_job_audit) <> 2 THEN
    RAISE EXCEPTION 'service audit write/read failed';
  END IF;
  IF public.acquire_lock('synthetic-lock', interval '10 minutes') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'service could not acquire a fresh lock';
  END IF;
  IF public.acquire_lock('synthetic-lock', interval '10 minutes') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'service did not observe an existing lock';
  END IF;
END $$;
RESET ROLE;

\ir 02-legacy-operational-tables-rollback.sql
\ir 03-legacy-acquire-lock-function-rollback.sql
DO $$
DECLARE r text; t text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.cron_job_audit','public.job_locks'] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF NOT has_table_privilege(r,t,p) THEN RAISE EXCEPTION 'rollback missing % % on %',r,p,t; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('cron_job_audit','job_locks') AND roles='{public}'
    AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual='true') <> 2 THEN
    RAISE EXCEPTION 'rollback policies do not match observed baseline';
  END IF;
  IF NOT has_function_privilege('non_api_role','public.acquire_lock(text,interval)','EXECUTE') THEN
    RAISE EXCEPTION 'rollback did not restore PUBLIC EXECUTE';
  END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.cron_job_audit) <> 2 THEN
    RAISE EXCEPTION 'rollback did not restore the original public read';
  END IF;
END $$;
RESET ROLE;
\echo PASS: legacy ACL, RLS, service behavior, PUBLIC function impact and rollback
