-- Enable RLS for true 5v5 skater NST gamelog tables.
-- These tables are public read-only stat surfaces; writes are reserved for
-- service-role ingestion jobs.

DO $$
DECLARE
  table_name TEXT;
  public_read_tables TEXT[] := ARRAY[
    'nst_gamelog_5v5_counts',
    'nst_gamelog_5v5_rates',
    'nst_gamelog_5v5_counts_oi',
    'nst_gamelog_5v5_rates_oi'
  ];
BEGIN
  FOREACH table_name IN ARRAY public_read_tables LOOP
    EXECUTE format(
      'ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY',
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

    EXECUTE format('DROP POLICY IF EXISTS "public_read" ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY "public_read" ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      table_name
    );
  END LOOP;
END $$;
