-- PROPOSAL ONLY. Not a migration, not executed, and not live-write authority.
-- Install in one approved transaction only after the one-time owner hands back.
-- Existing source shape: supabase/migrations/20260829161013_*.sql.
-- All ordinary INSERT/UPDATE/DELETE statements share this transaction lock;
-- OLD in the row guard is the row version PostgreSQL has locked for UPDATE.
BEGIN;

CREATE FUNCTION public.roster_schedule_writer_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(20260829, 161013) THEN
    RAISE EXCEPTION USING ERRCODE = 'RS002', MESSAGE = 'Roster schedule writer busy';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER roster_schedule_writer_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.roster_optimizer_team_games
FOR EACH STATEMENT EXECUTE FUNCTION public.roster_schedule_writer_lock();

CREATE FUNCTION public.roster_schedule_monotonic_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.fetched_at IS NULL OR NOT pg_catalog.isfinite(NEW.fetched_at)
    OR NEW.fetched_at > pg_catalog.clock_timestamp() + interval '5 seconds' THEN
    RAISE EXCEPTION USING ERRCODE = 'RS003', MESSAGE = 'Invalid schedule observation clock';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.fetched_at <= OLD.fetched_at THEN
    RAISE EXCEPTION USING ERRCODE = 'RS001', MESSAGE = 'Stale or equal schedule observation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER roster_schedule_monotonic_receipt
BEFORE INSERT OR UPDATE ON public.roster_optimizer_team_games
FOR EACH ROW EXECUTE FUNCTION public.roster_schedule_monotonic_receipt();

CREATE FUNCTION public.roster_schedule_observation_clock()
RETURNS timestamptz LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = pg_catalog
AS $$ SELECT pg_catalog.clock_timestamp(); $$;

CREATE FUNCTION public.commit_recurring_roster_schedule(
  p_rows jsonb, p_observed_at timestamptz, p_start_date date, p_end_date date
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
SET lock_timeout = '1s'
AS $$
DECLARE
  incoming_count integer;
  applied_count integer;
  existing jsonb;
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(20260829, 161013) THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'skipped_busy', 'rowsUpserted', 0);
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date
    OR p_end_date - p_start_date + 1 > 31 OR p_observed_at IS NULL
    OR NOT pg_catalog.isfinite(p_observed_at)
    OR p_observed_at > pg_catalog.clock_timestamp() + interval '5 seconds'
    OR p_observed_at < pg_catalog.clock_timestamp() - interval '90 seconds'
    OR p_rows IS NULL OR pg_catalog.jsonb_typeof(p_rows) <> 'array'
    OR pg_catalog.octet_length(p_rows::text) > 1048576 THEN
    RAISE EXCEPTION USING ERRCODE = 'RS003', MESSAGE = 'Recurring write scope or byte budget invalid';
  END IF;
  incoming_count := pg_catalog.jsonb_array_length(p_rows);
  IF incoming_count < 1 OR incoming_count > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = 'RS003', MESSAGE = 'Recurring side budget invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_populate_recordset(NULL::public.roster_optimizer_team_games, p_rows) r
    WHERE r.game_key IS DISTINCT FROM '477' OR r.season IS DISTINCT FROM '2026'
      OR r.source_season_id IS DISTINCT FROM 20262027::bigint OR r.game_type IS DISTINCT FROM 2::smallint
      OR r.fetched_at IS DISTINCT FROM p_observed_at OR r.game_date IS NULL
      OR r.game_date < p_start_date OR r.game_date > p_end_date
      OR r.mapping_status IS DISTINCT FROM 'mapped'
  ) OR (
    SELECT count(DISTINCT (r.source_game_id, r.team_id))
    FROM pg_catalog.jsonb_populate_recordset(NULL::public.roster_optimizer_team_games, p_rows) r
  ) <> incoming_count THEN
    RAISE EXCEPTION USING ERRCODE = 'RS003', MESSAGE = 'Recurring rows differ from the fixed profile';
  END IF;
  -- One overflow sentinel. Do not call an incomplete/raced API read complete.
  SELECT coalesce(pg_catalog.jsonb_agg(s), '[]'::jsonb) INTO existing FROM (
    SELECT source_game_id, team_id FROM public.roster_optimizer_team_games
    WHERE game_key = '477' AND season = '2026'
      AND game_date BETWEEN p_start_date AND p_end_date LIMIT 1001
  ) s;
  IF pg_catalog.jsonb_array_length(existing) > 1000 OR EXISTS (
    WITH incoming AS MATERIALIZED (
      SELECT source_game_id, team_id FROM pg_catalog.jsonb_populate_recordset(NULL::public.roster_optimizer_team_games, p_rows)
    )
    SELECT 1 FROM pg_catalog.jsonb_to_recordset(existing) AS e(source_game_id bigint, team_id smallint)
    LEFT JOIN incoming r USING (source_game_id, team_id) WHERE r.source_game_id IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'RS003', MESSAGE = 'Recurring cache range is oversized or a cached side disappeared';
  END IF;
  -- Includes matching identities previously stored outside the new date range.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_populate_recordset(NULL::public.roster_optimizer_team_games, p_rows) r
    JOIN public.roster_optimizer_team_games e USING (game_key, source_game_id, team_id)
    WHERE e.fetched_at >= p_observed_at
  ) THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'skipped_stale', 'rowsUpserted', 0);
  END IF;
  INSERT INTO public.roster_optimizer_team_games AS target (
    yahoo_matchup_week_id, game_key, season, week, source_game_id, source_season_id,
    game_date, start_time, game_type, game_status, schedule_status, mapping_status,
    is_countable, team_id, team_abbreviation, opponent_team_id, opponent_abbreviation,
    home_away, source_url, source_updated_at, source_metadata, fetched_at
  ) SELECT
    r.yahoo_matchup_week_id, r.game_key, r.season, r.week, r.source_game_id, r.source_season_id,
    r.game_date, r.start_time, r.game_type, r.game_status, r.schedule_status, r.mapping_status,
    r.is_countable, r.team_id, r.team_abbreviation, r.opponent_team_id, r.opponent_abbreviation,
    r.home_away, r.source_url, r.source_updated_at, r.source_metadata, r.fetched_at
  FROM pg_catalog.jsonb_populate_recordset(NULL::public.roster_optimizer_team_games, p_rows) r
  ORDER BY r.source_game_id, r.team_id
  ON CONFLICT (game_key, source_game_id, team_id) DO UPDATE SET
    yahoo_matchup_week_id = EXCLUDED.yahoo_matchup_week_id,
    season = EXCLUDED.season, week = EXCLUDED.week, source_season_id = EXCLUDED.source_season_id,
    game_date = EXCLUDED.game_date, start_time = EXCLUDED.start_time, game_type = EXCLUDED.game_type,
    game_status = EXCLUDED.game_status, schedule_status = EXCLUDED.schedule_status,
    mapping_status = EXCLUDED.mapping_status, is_countable = EXCLUDED.is_countable,
    team_abbreviation = EXCLUDED.team_abbreviation, opponent_team_id = EXCLUDED.opponent_team_id,
    opponent_abbreviation = EXCLUDED.opponent_abbreviation, home_away = EXCLUDED.home_away,
    source_url = EXCLUDED.source_url, source_updated_at = EXCLUDED.source_updated_at,
    source_metadata = EXCLUDED.source_metadata, fetched_at = EXCLUDED.fetched_at;
  GET DIAGNOSTICS applied_count = ROW_COUNT;
  IF applied_count <> incoming_count THEN
    RAISE EXCEPTION USING ERRCODE = 'RS003', MESSAGE = 'Recurring statement did not apply every side';
  END IF;
  RETURN pg_catalog.jsonb_build_object('outcome', 'applied', 'rowsUpserted', applied_count);
EXCEPTION
  -- This enclosing exception block rolls back all its database changes before
  -- returning a known no-op. Do not catch generic transport/SQL errors as skips.
  WHEN SQLSTATE 'RS001' THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'skipped_stale', 'rowsUpserted', 0);
  WHEN SQLSTATE 'RS002' THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'skipped_busy', 'rowsUpserted', 0);
  WHEN SQLSTATE 'RS003' THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'rejected', 'rowsUpserted', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.roster_schedule_writer_lock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roster_schedule_monotonic_receipt() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roster_schedule_observation_clock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_recurring_roster_schedule(jsonb,timestamptz,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roster_schedule_writer_lock(), public.roster_schedule_monotonic_receipt(),
  public.roster_schedule_observation_clock(), public.commit_recurring_roster_schedule(jsonb,timestamptz,date,date) TO service_role;

COMMIT;
