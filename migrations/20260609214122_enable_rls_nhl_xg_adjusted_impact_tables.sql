-- Secure the adjusted-impact output tables for Supabase Data API exposure.
-- The tables are model output/provenance tables: public read is allowed, but
-- writes are reserved for service-role ingestion jobs.

DO $$
DECLARE
  table_name text;
  table_names text[] := ARRAY[
    'nhl_xg_adjusted_impact_model_runs',
    'nhl_xg_adjusted_player_impacts'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_names LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );

    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM anon, authenticated',
      table_name
    );

    EXECUTE format(
      'GRANT SELECT ON TABLE public.%I TO anon, authenticated',
      table_name
    );

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role',
      table_name
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = 'public_read'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "public_read" ON public.%I FOR SELECT TO anon, authenticated USING (true)',
        table_name
      );
    END IF;
  END LOOP;
END $$;
