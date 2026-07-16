SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- Preserve the existing ownership contract while allowing Postgres to evaluate
-- auth.uid() once per statement instead of once per row.
DO $$
DECLARE
    v_table TEXT;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'user_profiles',
        'user_settings',
        'user_saved_teams',
        'connected_accounts',
        'external_leagues',
        'external_teams',
        'user_provider_preferences',
        'provider_sync_runs',
        'user_entitlements'
    ]
    LOOP
        EXECUTE format(
            'ALTER POLICY %I ON public.%I USING ((SELECT auth.uid()) = user_id)',
            v_table || '_select_own',
            v_table
        );
        EXECUTE format(
            'ALTER POLICY %I ON public.%I WITH CHECK ((SELECT auth.uid()) = user_id)',
            v_table || '_insert_own',
            v_table
        );
        EXECUTE format(
            'ALTER POLICY %I ON public.%I USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)',
            v_table || '_update_own',
            v_table
        );
        EXECUTE format(
            'ALTER POLICY %I ON public.%I USING ((SELECT auth.uid()) = user_id)',
            v_table || '_delete_own',
            v_table
        );
    END LOOP;
END $$;
;
