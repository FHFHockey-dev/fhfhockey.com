ALTER TABLE public.entity_metric_rankings
  ADD COLUMN IF NOT EXISTS methodology_version TEXT NOT NULL DEFAULT 'contextual_rankings_v1';

ALTER TABLE public.skater_composite_ratings
  ADD COLUMN IF NOT EXISTS methodology_version TEXT NOT NULL DEFAULT 'contextual_rankings_v1';

CREATE OR REPLACE FUNCTION public.set_contextual_snapshot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entity_metric_rankings_updated_at
  ON public.entity_metric_rankings;

CREATE TRIGGER trg_entity_metric_rankings_updated_at
  BEFORE UPDATE ON public.entity_metric_rankings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contextual_snapshot_updated_at();

DROP TRIGGER IF EXISTS trg_skater_composite_ratings_updated_at
  ON public.skater_composite_ratings;

CREATE TRIGGER trg_skater_composite_ratings_updated_at
  BEFORE UPDATE ON public.skater_composite_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contextual_snapshot_updated_at();

COMMENT ON COLUMN public.entity_metric_rankings.methodology_version IS
  'Contextual ranking methodology version used to publish this snapshot row.';

COMMENT ON COLUMN public.skater_composite_ratings.methodology_version IS
  'Contextual composite methodology version used to publish this snapshot row.';

CREATE INDEX IF NOT EXISTS idx_entity_metric_rankings_methodology_snapshot
  ON public.entity_metric_rankings (methodology_version, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_skater_composite_ratings_methodology_snapshot
  ON public.skater_composite_ratings (methodology_version, snapshot_date DESC);
