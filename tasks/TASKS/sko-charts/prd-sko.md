SKO (Sustainability KPI Overview)

Working name options
	•	sKO — Sustainability K‑Score & Outlook (my vote: short, pronounceable, keeps “KO” branding)
	•	SKO — Sustainability KPI Overview (your original; totally fine)
	•	SPO — Sustainability Performance Outlook (clear but loses SKO identity)

⸻

1) Product Requirements Document (PRD)

Goal

Compress an NHL skater’s recent game‑log and on‑ice context into a single sustainability barometer answering: is the player running hot, sustainable, or due for regression?

Scope (Phase 1)
	•	Skaters only (forwards + defense). Goalies later.
	•	Strength: All Strengths (AS) for the core score; expose ES/PP/PK as drill‑downs.
	•	Time window: rolling last 15 games (configurable) with exponential decay (default half‑life 5 games).
	•	Training seasons for model/priors: 2021‑22 → 2023‑24. Hold‑out: 2024‑25. No leakage.

Core Output

For a player/date range, return:
	•	sKO.z: standardized score of (actual P/60 − expected P/60) over residual σ.
	•	sKO.scale: mapped to −5 … +5 for a visual bar.
	•	Band: Hot (≥ +2), Warm (+1…+2), Even (−1…+1), Cool (−2…−1), Cold (≤ −2).
	•	Component breakdown (normalized 0–1 contributions): skill, opportunity, onIce, luck.
	•	Expected vs Actual: expected_p60, actual_p60, plus expected_g60, expected_a60.

Conceptual Model

Expected scoring is a linear/elastic‑net model over standardized features:
	•	Individual Skill (IS) — personal shot/creation engine
ixg_per_60, icf_per_60, shots_per_60, rebounds_created_per_60, rush_attempts_per_60, primary_assists_per_60
	•	Opportunity/Usage (OPP) — ice time & role
toi_per_gp, pp_toi_per_gp, o_zone_start_pct, faceoffs_percentage
	•	On‑Ice Environment (OIE) — teammates/system context
xgf_per_60, scf_per_60, hdcf_per_60, on_ice_sh_pct, on_ice_sv_pct (via PDO), off_zone_start_pct
	•	Luck (LUCK) — finishing/variance indicators
delta_g = (goals − ixg) / GP, delta_sh% = shooting% − career_sh%, PDO deviation, IPP deviation

We train three heads: P/60, G/60, A/60. For the “play‑driver” vs “play‑maker” tag, compare standardized G‑head vs A‑head expected/actual.

sKO:
z = (actual_p60 − expected_p60) / sigma_residual
scale = clamp( (z / 2.5) * 5, −5, +5 ) (assumes ~95% within ±2.5σ)

Component attribution: approximate contribution via standardized features:
contrib_i ≈ |w_i * (x_i − μ_i)| / Σ|…| → fold into 4 buckets (IS, OPP, OIE, LUCK) and renormalize.

Data Sources
	•	public.wgo_skater_stats (game logs; actual points, TOI, PPTOI, shooting%, etc.)
	•	public.wgo_skater_stats_totals (season baselines / career priors)
	•	public.nst_gamelog_as_rates & _oi (per‑60 rates & on‑ice context)
	•	Optionally ES/PP/PK siblings for drill‑downs later

Training Dataset (materialized view)

Create a nightly‑refreshed features MV joining by (player_id, date ~ date_scraped):
	•	Grain: player_id × date (games only)
	•	Inputs: selected per‑60 & on‑ice features, plus rolling/decayed aggregates
	•	Targets: p60, g60, a60 built from wgo_skater_stats using TOI to scale
	•	Filters: Seasons in [2021‑22, 2022‑23, 2023‑24] for training; 2024‑25 hold‑out for eval

Use coalesce(ws.date, nr.date_scraped) and strict (player_id, date) unique keys. Rely on your existing unique index on wgo_skater_stats (player_id, date).

Evaluation
	•	Primary: R² / RMSE on 2024‑25 hold‑out for P/60
	•	Calibration: mean(actual − expected) ≈ 0 by position (F vs D)
	•	Stability: rolling sKO autocorrelation; avoid over‑reactive spikes

UI
	•	Sandbox page (/trends/sandbox):
	•	Player picker (search) + date window selector
	•	sKO bar with band label and sparkline of sKO over last 20 games
	•	Expected vs Actual P/60 line chart
	•	Feature contributions bar (IS/OPP/OIE/LUCK)
	•	Correlation explorer: choose a metric X vs Points/60 scatter + live Pearson r
	•	Player page (/trends/skaters/[playerId]):
	•	Hero card: sKO, band, expected vs actual
	•	Percentile wheels for key components
	•	Tabs: AS / ES / PP / PK

API

GET /api/trends/players?playerId=###&window=15&halflife=5 → JSON { player, series[], aggregates, sko }

Milestones
	1.	MV features + API stub returning expected vs actual + placeholder coefficients
	2.	Sandbox UI (charts + correlation explorer)
	3.	Train elastic‑net offline; store coefficients & normalizers in Supabase table analytics.sko_model_v1
	4.	Swap API to fetch model params from DB; add bands & contributions
	5.	Extend to ES/PP/PK tabs; add play‑driver vs play‑maker tag

Risks & Mitigations
	•	Join drift across date vs date_scraped: lock on (player_id, date) with a 0‑day tolerance first; only widen if needed.
	•	Variance in low TOI: enforce minimum TOI per game for rate targets (e.g., ≥ 8 ES mins).
	•	Collinearity: use elastic‑net; log features where heavy‑tailed (e.g., rebounds_created).

9) Next Steps (practical)
	•	Load mv_sko_skater_features and backfill 2021–24.
	•	Train elastic‑net offline (Python or SQL ML) with cross‑val by season; write mu/sigma/weights/intercept/sigma_residual into analytics.sko_model_v1.
	•	Replace API placeholder with real model params; compute component attribution using standardized (x-μ)/σ * w grouping.
	•	Add ES/PP/PK drill‑downs and the play‑driver vs play‑maker tag.