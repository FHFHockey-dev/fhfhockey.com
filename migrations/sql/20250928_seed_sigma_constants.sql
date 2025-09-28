-- Migration: Seed fixed standard deviation constants for initial 'fixed' σ mode
-- Date: 2025-09-28
-- NOTE: Values are placeholder baseline approximations; replace with empirically derived preseason / historical sample values.

BEGIN;

-- Helper: upsert function (optional). Using INSERT ... ON CONFLICT is sufficient if supported.

-- Metric codes seeded: sh_pct, oish_pct, oisv_pct, ipp, ixg_per60, icf_per60, hdcf_per60
-- Position codes: C, LW, RW, D
-- Placeholder logic: skill/process metrics typically have higher variance in small samples; shooting% narrower.

INSERT INTO sustainability_sigma_constants (metric_code, position_code, sigma)
VALUES
  -- Shooting % (typical per-season SD around 4-5 percentage points -> 0.045) using decimal fraction of 1
  ('sh_pct','C',0.045), ('sh_pct','LW',0.046), ('sh_pct','RW',0.046), ('sh_pct','D',0.030),
  -- On-ice Shooting % (oiSH%) higher volatility
  ('oish_pct','C',0.055), ('oish_pct','LW',0.056), ('oish_pct','RW',0.056), ('oish_pct','D',0.050),
  -- On-ice Save % (oiSV%) (treated as fraction of 1; e.g., .900 baseline; SD small)
  ('oisv_pct','C',0.015), ('oisv_pct','LW',0.015), ('oisv_pct','RW',0.015), ('oisv_pct','D',0.014),
  -- IPP variance (forwards wider than defense)
  ('ipp','C',0.12), ('ipp','LW',0.13), ('ipp','RW',0.13), ('ipp','D',0.08),
  -- ixG/60 per 60 variance (rates) placeholders
  ('ixg_per60','C',0.35), ('ixg_per60','LW',0.36), ('ixg_per60','RW',0.36), ('ixg_per60','D',0.20),
  -- ICF/60 variance
  ('icf_per60','C',3.8), ('icf_per60','LW',4.1), ('icf_per60','RW',4.1), ('icf_per60','D',2.6),
  -- HDCF/60 variance (rarer events)
  ('hdcf_per60','C',0.90), ('hdcf_per60','LW',0.95), ('hdcf_per60','RW',0.95), ('hdcf_per60','D',0.60)
ON CONFLICT (metric_code, position_code) DO UPDATE SET sigma = EXCLUDED.sigma;

COMMIT;
