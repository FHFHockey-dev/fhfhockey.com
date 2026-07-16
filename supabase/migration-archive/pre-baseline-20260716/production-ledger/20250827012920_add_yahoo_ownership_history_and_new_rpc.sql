-- Migration: add_yahoo_ownership_history_and_new_rpc
-- 1. Create ownership history table
CREATE TABLE IF NOT EXISTS public.yahoo_player_ownership_history (
  player_key text NOT NULL,
  ownership_date date NOT NULL,
  ownership_pct double precision,
  source text DEFAULT 'yahoo',
  inserted_at timestamptz DEFAULT now(),
  PRIMARY KEY (player_key, ownership_date)
);

-- 2. Supporting index (optional query patterns by date)
CREATE INDEX IF NOT EXISTS idx_yahoo_player_ownership_history_date ON public.yahoo_player_ownership_history (ownership_date);

-- 3. Seed (initial snapshot) if table empty (idempotent)
INSERT INTO public.yahoo_player_ownership_history (player_key, ownership_date, ownership_pct, source)
SELECT player_key, CURRENT_DATE, percent_ownership, 'initial-seed'
FROM public.yahoo_players
WHERE percent_ownership IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. New RPC: upsert_yahoo_players_v2
CREATE OR REPLACE FUNCTION public.upsert_yahoo_players_v2(players_data jsonb[], record_history boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_data jsonb;
  _player_key text;
  _today date := current_date;
  processed int := 0;
  new_ownership_entry jsonb;
  last_entry jsonb;
  existing_timeline jsonb;
BEGIN
  FOREACH player_data IN ARRAY players_data LOOP
    _player_key := player_data->>'player_key';

    -- Build optional ownership entry (string date for parity with prior timeline format)
    new_ownership_entry := jsonb_build_object('date', to_char(_today,'YYYY-MM-DD'), 'value', (player_data->>'percent_ownership')::double precision);

    -- Preserve legacy ownership_timeline behavior but avoid duplicate same-day append
    SELECT ownership_timeline INTO existing_timeline FROM public.yahoo_players WHERE player_key = _player_key;
    IF existing_timeline IS NULL THEN
      existing_timeline := '[]'::jsonb;
    END IF;
    -- Get last element if any
    IF jsonb_array_length(existing_timeline) > 0 THEN
      last_entry := existing_timeline->(jsonb_array_length(existing_timeline)-1);
    ELSE
      last_entry := NULL;
    END IF;
    IF record_history AND (last_entry IS NULL OR (last_entry->>'date') <> to_char(_today,'YYYY-MM-DD')) THEN
      existing_timeline := existing_timeline || new_ownership_entry; -- append
    END IF;

    INSERT INTO public.yahoo_players (
      player_name, player_id, draft_analysis, average_draft_pick, average_draft_round, average_draft_cost,
      percent_drafted, editorial_player_key, editorial_team_abbreviation, editorial_team_full_name,
      eligible_positions, display_position, headshot_url, injury_note, full_name, percent_ownership,
      player_key, position_type, status, status_full, last_updated, uniform_number, ownership_timeline
    ) VALUES (
      player_data->>'player_name',
      player_data->>'player_id',
      (player_data->>'draft_analysis')::jsonb,
      (player_data->>'average_draft_pick')::double precision,
      (player_data->>'average_draft_round')::double precision,
      (player_data->>'average_draft_cost')::double precision,
      (player_data->>'percent_drafted')::double precision,
      player_data->>'editorial_player_key',
      player_data->>'editorial_team_abbreviation',
      player_data->>'editorial_team_full_name',
      (player_data->>'eligible_positions')::jsonb,
      player_data->>'display_position',
      player_data->>'headshot_url',
      player_data->>'injury_note',
      player_data->>'full_name',
      (player_data->>'percent_ownership')::double precision,
      player_data->>'player_key',
      player_data->>'position_type',
      player_data->>'status',
      player_data->>'status_full',
      (player_data->>'last_updated')::timestamp,
      (player_data->>'uniform_number')::smallint,
      CASE WHEN record_history THEN existing_timeline ELSE COALESCE(existing_timeline,'[]'::jsonb) END
    )
    ON CONFLICT (player_key) DO UPDATE SET
      player_name = EXCLUDED.player_name,
      player_id = EXCLUDED.player_id,
      draft_analysis = EXCLUDED.draft_analysis,
      average_draft_pick = EXCLUDED.average_draft_pick,
      average_draft_round = EXCLUDED.average_draft_round,
      average_draft_cost = EXCLUDED.average_draft_cost,
      percent_drafted = EXCLUDED.percent_drafted,
      editorial_player_key = EXCLUDED.editorial_player_key,
      editorial_team_abbreviation = EXCLUDED.editorial_team_abbreviation,
      editorial_team_full_name = EXCLUDED.editorial_team_full_name,
      eligible_positions = EXCLUDED.eligible_positions,
      display_position = EXCLUDED.display_position,
      headshot_url = EXCLUDED.headshot_url,
      injury_note = EXCLUDED.injury_note,
      full_name = EXCLUDED.full_name,
      percent_ownership = EXCLUDED.percent_ownership,
      position_type = EXCLUDED.position_type,
      status = EXCLUDED.status,
      status_full = EXCLUDED.status_full,
      last_updated = EXCLUDED.last_updated,
      uniform_number = EXCLUDED.uniform_number,
      ownership_timeline = CASE WHEN record_history THEN EXCLUDED.ownership_timeline ELSE yahoo_players.ownership_timeline END;

    IF record_history THEN
      INSERT INTO public.yahoo_player_ownership_history(player_key, ownership_date, ownership_pct, source)
      VALUES (_player_key, _today, (player_data->>'percent_ownership')::double precision, 'daily-ingest')
      ON CONFLICT DO NOTHING;
    END IF;

    processed := processed + 1;
  END LOOP;
  RETURN processed;
END;
$$;

-- 5. (Optional) Comment for discoverability
COMMENT ON FUNCTION public.upsert_yahoo_players_v2(jsonb[], boolean) IS 'Batch upsert for yahoo_players plus normalized ownership history (idempotent per day).';;
