-- Sample migration to compute 3yr blended and career aggregates for player_baselines
-- This is a sample SQL migration that computes per-player 3yr blended ixg_per_60 and career ixg totals
-- It demonstrates how you could materialize similar fields in the DB instead of computing them in TypeScript.

-- create a view that aggregates season totals (if not already present)
-- assuming player_totals_unified exists

CREATE MATERIALIZED VIEW IF NOT EXISTS player_baselines_3yr AS
SELECT
  pt.player_id,
  now()::date AS snapshot_date,
  -- compute blended numerators/denoms using window functions and weights (newest-first)
  -- This is a simplified approach: pick top-3 seasons by season_id and apply weights
  (
    SELECT (
      0.6 * coalesce((select nst_ixg from player_totals_unified p2 where p2.player_id = pt.player_id order by season_id desc limit 1),0)
      + 0.3 * coalesce((select nst_ixg from player_totals_unified p3 where p3.player_id = pt.player_id order by season_id desc offset 1 limit 1),0)
      + 0.1 * coalesce((select nst_ixg from player_totals_unified p4 where p4.player_id = pt.player_id order by season_id desc offset 2 limit 1),0)
    )
  ) AS blended_nst_ixg,
  (
    SELECT (
      0.6 * coalesce((select nst_toi from player_totals_unified p2 where p2.player_id = pt.player_id order by season_id desc limit 1),0)
      + 0.3 * coalesce((select nst_toi from player_totals_unified p3 where p3.player_id = pt.player_id order by season_id desc offset 1 limit 1),0)
      + 0.1 * coalesce((select nst_toi from player_totals_unified p4 where p4.player_id = pt.player_id order by season_id desc offset 2 limit 1),0)
    )
  ) AS blended_nst_toi,
  -- career sums
  (select sum(coalesce(nst_ixg,0)) from player_totals_unified p5 where p5.player_id = pt.player_id) as career_nst_ixg,
  (select sum(coalesce(nst_toi,0)) from player_totals_unified p6 where p6.player_id = pt.player_id) as career_nst_toi
FROM (
  select distinct player_id from player_totals_unified
) pt;

-- Note: this view is illustrative. For production you'd likely create an upsert function or job that merges into player_baselines.
