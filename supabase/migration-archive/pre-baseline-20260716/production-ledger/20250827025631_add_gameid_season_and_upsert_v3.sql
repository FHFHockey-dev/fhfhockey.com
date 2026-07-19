-- Add game_id and season to yahoo_players and adjust uniqueness for per-season rows
BEGIN;

-- Add columns if missing
ALTER TABLE IF EXISTS public.yahoo_players
  ADD COLUMN IF NOT EXISTS game_id integer;

ALTER TABLE IF EXISTS public.yahoo_players
  ADD COLUMN IF NOT EXISTS season integer;

-- Remove unique constraint on player_id if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.contype = 'u' AND t.relname = 'yahoo_players' AND c.conname = 'yahoo_players_player_id_key'
  ) THEN
    ALTER TABLE public.yahoo_players DROP CONSTRAINT yahoo_players_player_id_key;
  END IF;
EXCEPTION WHEN others THEN
  -- continue silently
  RAISE NOTICE 'Could not drop constraint or it did not exist';
END$$;

-- Ensure player_key is unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'yahoo_players' AND indexname = 'yahoo_players_player_key_key'
  ) THEN
    CREATE UNIQUE INDEX yahoo_players_player_key_key ON public.yahoo_players (player_key);
  END IF;
END$$;

-- Create a per-season uniqueness index (player_id, season) so same player_id can exist across seasons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'yahoo_players' AND indexname = 'yahoo_players_player_id_season_key'
  ) THEN
    CREATE UNIQUE INDEX yahoo_players_player_id_season_key ON public.yahoo_players (player_id, season);
  END IF;
END$$;

-- Create a new RPC upsert_yahoo_players_v3 that upserts on player_key and inserts ownership history idempotently
CREATE OR REPLACE FUNCTION public.upsert_yahoo_players_v3(players_data jsonb[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  p jsonb;
  new_owner_entry jsonb;
BEGIN
  FOREACH p IN ARRAY players_data LOOP
    -- Upsert main player record using player_key as the conflict target
    INSERT INTO public.yahoo_players (
      player_key, player_id, player_name, draft_analysis, average_draft_pick, average_draft_round, average_draft_cost,
      percent_drafted, editorial_player_key, editorial_team_abbreviation, editorial_team_full_name, eligible_positions,
      display_position, headshot_url, injury_note, full_name, percent_ownership, game_id, season, position_type, status,
      status_full, last_updated, uniform_number, ownership_timeline
    ) VALUES (
      p->>'player_key',
      (p->>'player_id')::integer,
      p->>'player_name',
      (p->'draft_analysis'),
      COALESCE(NULLIF((p->>'average_draft_pick'),'')::numeric,0),
      COALESCE(NULLIF((p->>'average_draft_round'),'')::numeric,0),
      COALESCE(NULLIF((p->>'average_draft_cost'),'')::numeric,0),
      COALESCE(NULLIF((p->>'percent_drafted'),'')::numeric,0),
      p->>'editorial_player_key',
      p->>'editorial_team_abbreviation',
      p->>'editorial_team_full_name',
      p->'eligible_positions',
      p->>'display_position',
      p->>'headshot_url',
      p->>'injury_note',
      p->>'full_name',
      COALESCE(NULLIF((p->>'percent_ownership'),'')::numeric,0),
      CASE WHEN (p->>'game_id')~'^[0-9]+$' THEN (p->>'game_id')::integer ELSE NULL END,
      CASE WHEN (p->>'season')~'^[0-9]+$' THEN (p->>'season')::integer ELSE NULL END,
      p->>'position_type',
      p->>'status',
      p->>'status_full',
      CASE WHEN (p->>'last_updated') IS NOT NULL THEN (p->>'last_updated')::timestamptz ELSE now() END,
      CASE WHEN (p->>'uniform_number')~'^[0-9]+$' THEN (p->>'uniform_number')::integer ELSE NULL END,
      COALESCE(p->'ownership_timeline','[]'::jsonb)
    ) ON CONFLICT (player_key) DO UPDATE SET
      player_id = EXCLUDED.player_id,
      player_name = COALESCE(EXCLUDED.player_name, yahoo_players.player_name),
      draft_analysis = COALESCE(EXCLUDED.draft_analysis, yahoo_players.draft_analysis),
      average_draft_pick = COALESCE(NULLIF(EXCLUDED.average_draft_pick,0), yahoo_players.average_draft_pick),
      average_draft_round = COALESCE(NULLIF(EXCLUDED.average_draft_round,0), yahoo_players.average_draft_round),
      average_draft_cost = COALESCE(NULLIF(EXCLUDED.average_draft_cost,0), yahoo_players.average_draft_cost),
      percent_drafted = COALESCE(NULLIF(EXCLUDED.percent_drafted,0), yahoo_players.percent_drafted),
      editorial_player_key = COALESCE(EXCLUDED.editorial_player_key, yahoo_players.editorial_player_key),
      editorial_team_abbreviation = COALESCE(EXCLUDED.editorial_team_abbreviation, yahoo_players.editorial_team_abbreviation),
      editorial_team_full_name = COALESCE(EXCLUDED.editorial_team_full_name, yahoo_players.editorial_team_full_name),
      eligible_positions = COALESCE(EXCLUDED.eligible_positions, yahoo_players.eligible_positions),
      display_position = COALESCE(EXCLUDED.display_position, yahoo_players.display_position),
      headshot_url = COALESCE(EXCLUDED.headshot_url, yahoo_players.headshot_url),
      injury_note = COALESCE(EXCLUDED.injury_note, yahoo_players.injury_note),
      full_name = COALESCE(EXCLUDED.full_name, yahoo_players.full_name),
      percent_ownership = COALESCE(NULLIF(EXCLUDED.percent_ownership,0), yahoo_players.percent_ownership),
      game_id = COALESCE(EXCLUDED.game_id, yahoo_players.game_id),
      season = COALESCE(EXCLUDED.season, yahoo_players.season),
      position_type = COALESCE(EXCLUDED.position_type, yahoo_players.position_type),
      status = COALESCE(EXCLUDED.status, yahoo_players.status),
      status_full = COALESCE(EXCLUDED.status_full, yahoo_players.status_full),
      last_updated = GREATEST(COALESCE(EXCLUDED.last_updated, now()), yahoo_players.last_updated),
      uniform_number = COALESCE(EXCLUDED.uniform_number, yahoo_players.uniform_number),
      ownership_timeline = COALESCE(yahoo_players.ownership_timeline, '[]'::jsonb) || COALESCE(EXCLUDED.ownership_timeline,'[]'::jsonb);

    -- Insert normalized ownership history per-day if percent_ownership provided
    IF (p->>'percent_ownership') IS NOT NULL THEN
      new_owner_entry := jsonb_build_object('date', p->>'current_date', 'percent_ownership', (p->>'percent_ownership')::numeric, 'source', 'upsert_yahoo_players_v3');
      BEGIN
        INSERT INTO public.yahoo_player_ownership_history (player_key, ownership_date, ownership_pct, source, inserted_at)
        VALUES (p->>'player_key', (p->>'current_date')::date, (p->>'percent_ownership')::numeric, 'upsert_yahoo_players_v3', now())
        ON CONFLICT (player_key, ownership_date) DO NOTHING;
      EXCEPTION WHEN others THEN
        -- ignore individual insert errors
        NULL;
      END;
    END IF;
  END LOOP;
END; $$;

COMMIT;
;
