-- Scope a tweet-name alias to a kind of slot: F (forward line), D (defence pair) or G (net).
-- NULL keeps today's meaning: the alias applies in any slot. With team_id this lets
-- "Hughes" -> Luke Hughes apply only on NJD and only in a defence pair.
ALTER TABLE public.lineup_player_name_aliases
  ADD COLUMN IF NOT EXISTS position_group text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lineup_player_name_aliases_position_group_check'
      AND conrelid = 'public.lineup_player_name_aliases'::regclass
  ) THEN
    ALTER TABLE public.lineup_player_name_aliases
      ADD CONSTRAINT lineup_player_name_aliases_position_group_check
      CHECK (position_group IS NULL OR position_group IN ('F', 'D', 'G'));
  END IF;
END $$;

COMMENT ON COLUMN public.lineup_player_name_aliases.position_group IS
  'Optional slot scope: F, D or G. NULL applies the alias in every slot.';
