-- Preserve known same-game observations when an upstream refill omits them.
-- NULL is unavailable evidence, never an inferred zero. Non-NULL corrections win.
-- This is an additive database-only guard; existing ingestion upserts stay unchanged.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '5s';

CREATE FUNCTION public.preserve_wgo_skater_on_ice_goals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  NEW.es_goals_for := COALESCE(NEW.es_goals_for, OLD.es_goals_for);
  NEW.pp_goals_for := COALESCE(NEW.pp_goals_for, OLD.pp_goals_for);
  NEW.sh_goals_for := COALESCE(NEW.sh_goals_for, OLD.sh_goals_for);
  NEW.es_goals_against := COALESCE(NEW.es_goals_against, OLD.es_goals_against);
  NEW.pp_goals_against := COALESCE(NEW.pp_goals_against, OLD.pp_goals_against);
  NEW.sh_goals_against := COALESCE(NEW.sh_goals_against, OLD.sh_goals_against);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.preserve_wgo_skater_on_ice_goals()
  FROM PUBLIC, anon, authenticated;

-- UPDATE also covers the conflict branch of INSERT ... ON CONFLICT DO UPDATE.
-- Match complete game identity; never carry a value to a different/unknown game.
CREATE TRIGGER wgo_skater_on_ice_goals_preserve_known
BEFORE UPDATE ON public.wgo_skater_stats
FOR EACH ROW
WHEN (
  OLD.player_id IS NOT NULL AND OLD.date IS NOT NULL
  AND OLD.game_id IS NOT NULL AND OLD.season_id IS NOT NULL
  AND NEW.player_id = OLD.player_id AND NEW.date = OLD.date
  AND NEW.game_id = OLD.game_id AND NEW.season_id = OLD.season_id
  AND (
    (OLD.es_goals_for IS NOT NULL AND NEW.es_goals_for IS NULL)
    OR (OLD.pp_goals_for IS NOT NULL AND NEW.pp_goals_for IS NULL)
    OR (OLD.sh_goals_for IS NOT NULL AND NEW.sh_goals_for IS NULL)
    OR (OLD.es_goals_against IS NOT NULL AND NEW.es_goals_against IS NULL)
    OR (OLD.pp_goals_against IS NOT NULL AND NEW.pp_goals_against IS NULL)
    OR (OLD.sh_goals_against IS NOT NULL AND NEW.sh_goals_against IS NULL)
  )
)
EXECUTE FUNCTION public.preserve_wgo_skater_on_ice_goals();

COMMENT ON FUNCTION public.preserve_wgo_skater_on_ice_goals() IS
  'Retain last known six on-ice goal counts for the same identified game when incoming values are NULL; do not impute zero or suppress non-NULL corrections.';
COMMENT ON TRIGGER wgo_skater_on_ice_goals_preserve_known ON public.wgo_skater_stats IS
  'Atomic NULL preservation for regular-season WGO conflict updates; does not cover deletes/reinserts, identity changes or playoffs.';
COMMIT;
