-- Migration: Seed initial Sustainability Barometer configuration (model_version=1)
-- Date: 2025-09-28
-- Inserts only if no active row with model_version=1 exists.

BEGIN;

WITH missing AS (
  SELECT 1 FROM model_sustainability_config 
   WHERE model_version = 1 AND active = TRUE
)
INSERT INTO model_sustainability_config (
  model_version,
  active,
  weights_json,
  toggles_json,
  constants_json,
  sd_mode,
  freshness_days
) SELECT 
    1 AS model_version,
    TRUE AS active,
    -- Weights: negative for regression-prone, positive for stabilizers
    '{
      "sh_pct": -1.2,
      "oish_pct": -1.0,
      "oisv_pct": -0.8,
      "ipp": -0.8,
      "finish_res_rate": -0.6,
      "finish_res_cnt": -0.4,
      "ixg_per60": 0.9,
      "icf_per60": 0.7,
      "hdcf_per60": 0.6
    }'::jsonb,
    '{
      "use_finishing_residuals": true,
      "cap_team_context": false,
      "split_strengths": false
    }'::jsonb,
    '{
      "c": 3.0,
      "k_r": {"sh_pct": 50, "oish_pct": 150, "ipp": 30},
      "guardrails": {"upper_raw": 0.995, "lower_raw": 0.005},
      "quintiles": {"strategy": "dynamic"}
    }'::jsonb,
    'fixed' AS sd_mode,
    45 AS freshness_days
WHERE NOT EXISTS (SELECT 1 FROM missing);

COMMIT;

-- NOTE: For future versions, insert a new row with incremented model_version and set previous active=FALSE in an application migration / admin script.
