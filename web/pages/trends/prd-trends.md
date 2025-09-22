# Trends Sandbox PRD

## Context & Goal
- Build Sustainability KPI Overview (SKO) for NHL skaters detecting and predicting HOT/COLD streak onsets.
- Training window: 2021-22 to 2023-24 seasons; 2024-25 reserved for hold-out validation.
- Visual analytics delivered through `/trends` D3 notebook interface (legacy alias `/trendsSandbox`).

## Key Deliverables
1. Data contracts for SKO endpoints (baseline, player time series, evaluation summaries).
2. Supabase SQL artifacts: training moments materialized view, per-game EB z-scores, SKO scoring view, streak RPC.
3. SKO statistical framework (features, robust standardization, ridge weights, thresholds, detection rules).
4. HOT/COLD onset prediction models (logistic + tree baseline) with evaluation harness outputs.
5. Frontend `/trends` (legacy alias `/trendsSandbox`) D3 notebook experience with cells A–H and top controls.
6. Evaluation harness generating calibration, PR, threshold JSON for validation cells and barometer.

## Current Status (2025-03-12)
- ✅ Initial cross-functional specification draft prepared (Sections 1–6 deliverable).
- ✅ Folder `/pages/trends/` created and PRD initialized for ongoing tracking.
- ✅ `/trends` sandbox page scaffolded (alias `/trendsSandbox`) with D3 Cell A (baseline) and Cell B (time-series) mock data visualizations.
- ⏳ SQL view definitions pending implementation and verification against Supabase schema.
- ⏳ Model prototyping pending feature extraction pipeline.
- ⏳ Frontend scaffold requires integration with actual API endpoints once ready.

## Recent Updates
- Documented planner guardrails, statistical procedures, SQL artifacts, frontend scaffold, evaluation plan, and UX design blueprint in first design package.
- Established default hyperparameters (λ=1.8 HOT, 1.6 COLD; EWMA span=5; L=2 HOT, 3 COLD) for validation.
- Implemented interactive mock `/trends` page (controls, baseline violin, time-series ribbons) using deterministic fixture data for Cells A & B.

## Next Steps
1. Confirm availability of required columns in `wgo_skater_stats` and related NST tables; adjust feature list if needed.
2. Implement `mv_sko_skater_moments` and validate medians/MADs for sample skaters.
3. Build `vw_sko_skater_zscores` and `vw_sko_skater_scores`; unit-test EB shrinkage math.
4. Prototype ridge regression for SKO weights using Python notebook; store coefficients in config table.
5. Define API routes in Next.js (or Supabase Edge Functions) matching data contracts; prepare mock responses.
6. Wire `/trends` page to real API once contracts stabilized; replace deterministic fixtures with fetched data.
7. Implement evaluation harness script and schedule nightly job to refresh 2024-25 metrics.

## Open Questions
- Best data source for injury/return indicators if not present in Supabase tables?
- Should SKO weights diverge for forwards vs defense or add position interaction terms?
- How to represent travel fatigue without external distance dataset?

## Decision Log
- 2025-09-21: Adopt robust median/MAD baselines with EB shrinkage (κ=30) and tanh-bounded SKO.
- 2025-09-21: Default λ, L, EWMA span as per spec; to be revisited after validation results.

## Owners
- Product / Coordination: Tim
- Data Engineering: TBD (Supabase views & RPCs)
- Data Science / Modeling: TBD (ridge, logistic, tree, evaluation harness)
- Frontend / D3: TBD (sandbox implementation)
- UX: TBD (notebook interaction design)

## Reporting
- Weekly sync every Monday with summary posted to `/pages/trends/prd-trends.md`.
- Discord channel `#trends` hosts daily asynchronous status updates.
