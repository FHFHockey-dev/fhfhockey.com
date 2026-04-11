# PRD: Sustainability Barometer (Player Performance Regression-to-Mean Risk)

## 1. Introduction / Overview

Fantasy hockey managers struggle to distinguish sustainable performance (driven by repeatable underlying process) from transient “hot streaks” driven by volatile, luck-heavy metrics (e.g., elevated shooting percentages, inflated on-ice conversion). This leads to suboptimal trade, waiver, and roster decisions. 

The Sustainability Barometer is a composite 0–100 score computed per player after each game plus rolling windows (5-game, 10-game) and Season-To-Date (STD). It estimates the likelihood that a player’s recent production level is *sustainable* (low regression risk) versus likely to normalize downward (high regression risk). High scores indicate skill-aligned, process-backed performance; low scores signal outsized reliance on unstable conversion metrics.

Primary users: authenticated fantasy hockey managers (future: premium gating). Internal stakeholders: data engineering, analytics, product.

## 2. Goals
1. Provide a single interpretable sustainability score (0–100) per player-game and rolling windows (5GRA, 10GRA, STD) with <150ms read latency via precomputation.
2. Smooth volatility while preserving *signal* using empirical-Bayes shrinkage + reliability weighting + soft-clipped z-scores.
3. Support explainability: expose per-component raw z, soft z, reliability factor r, sample size n, weight contribution.
4. Deliver nightly batch pipeline (Vercel cron) completing <300s for all NHL skaters.
5. Store versioned outputs to allow future model revisions without historical overwrite.
6. Provide quantitative distribution monitoring (nightly percentiles, outlier flags) for QA and tuning.

## 3. User Stories
1. As a manager, I can view a sustainability score column in the player listing to quickly identify overperformers at risk of regression.
2. As a manager, I see a badge + sparkline (last N scores) to evaluate trend stability.
3. As a manager, I can sort / filter players by 5-game or 10-game rolling sustainability to find emerging targets.
4. As a manager, I can open a tooltip to view component breakdown (z-values + weighted contributions) for decision transparency.
5. As internal staff, I can monitor nightly logs to confirm pipeline health, distribution stability, and anomaly flags.

## 4. Functional Requirements
FR1. System MUST compute per-player sustainability scores for: (a) individual game, (b) 5-game rolling window (freshness-limited), (c) 10-game rolling window, (d) season-to-date.
FR2. System MUST exclude games older than freshness threshold X=45 days when forming rolling windows (only consider recent games until N reached or terminate early if insufficient fresh games).
FR3. System MUST generate league×position (pos groups = C, LW, RW, D treated separately) seasonal Beta priors for: SH%, on-ice SH% (oiSH%), IPP.
FR4. System MUST compute multi-season recency-weighted player priors (weights 0.6 / 0.3 / 0.1 for seasons now / prev / prev2) blending successes & trials (not rates) for SH%, oiSH%, IPP.
FR5. System MUST produce posterior means (player “true talent” baselines) via Beta update using league prior and blended player counts.
FR6. System MUST compute standardized raw z-scores for each “luck” component comparing observed rolling window rate to posterior mean; initial σ constants fixed (pre-calculated before 2024-12-05 training freeze); later can switch to empirical position-season σ (config toggle).
FR7. System MUST reliability-weight each component using exposure-based r = sqrt(n / (n + k_r)) (SH% k_r=50, oiSH% k_r=150, IPP k_r=30) with n = window trials (shots, on-ice shots-for, on-ice GF respectively).
FR8. System MUST apply soft clipping to raw z via z_soft = c * tanh(z_raw / c) with c=3.0; store both raw and soft.
FR9. System MUST compute finishing residual components (goals − ixG) and (goals_per_60 − ixG_per_60) if feature toggle use_finishing_residuals=true (default ON per decision 1.2) and incorporate as negative regressors or log but exclude if disabled.
FR10. System MUST treat PDO parts (oiSH%, oiSV%) separately (NOT aggregated PDO) per selection (1.3=C); combined PDO is NOT included to avoid double weighting.
FR11. System MUST include stabilizer metrics (definition below) as positive contributors (ixG/60, ICF/60, HDCF/60) — all standardized to position-season; additional optional (xGF%, SCF%, shot volume) may be toggled in later iteration (config flags default false if not yet selected). (See §5.)
FR12. System MUST compute final logistic score S_raw = sigmoid( Σ_i weight_i * (r_i * z_soft_i) ), scaled to S = round(S_raw *100) with guardrails (only show 100 if S_raw≥0.995; only show 0 if ≤0.005).
FR13. System MUST persist both S_raw (float) and S (int 0–100) plus sustainability_quintile (0–4) computed from nightly distribution (quantile-based dynamic tiers).
FR14. System MUST record component details in JSON: per metric {metric_code, z_raw, z_soft, r, n, weight, contrib}.
FR15. System MUST mark status='provisional' if exposures below heuristic sufficiency yet still produce a score (no hard gating; FR16 handles variance broadening implicitly via reliability r).
FR16. System MUST treat IPP gracefully when on-ice GF=0: use posterior mean only (no deviation; z_raw=0, r=0, flag neutral_component=true) per decision (6.3=B).
FR17. System MUST set rookie_status=true when missing prior seasons (weights renormalized over available seasons; league prior still applied) and store in record.
FR18. System MUST exclude goalies (skaters only) for MVP.
FR19. System MUST provide API inclusion in existing player summary response plus endpoints for leaderboard & filtered list.
FR20. System MUST supply nightly distribution snapshot (percentiles, mean, stdev, N) for monitoring and tier derivation.
FR21. System MUST log anomalies: |z_raw|>5 (extreme flag) and missing priors.
FR22. System MUST store model_version and config hash for each record.
FR23. System MUST support append-only writes for new games, plus asynchronous recompute queue for retro backfill when priors/config change.
FR24. System MUST produce <150ms fetch latency for typical player queries (read precomputed row set, not recompute on demand).
FR25. System MUST allow DB-based configuration (weights, toggles, window lengths, c, k_r values) modifiable without redeploy.

## 5. Metric Definitions

### 5.1 Luck / Regression-Prone Metrics
- SH%: goals / shots (all strengths). Successes=goals, trials=shots.
- On-ice SH% (oiSH%): on-ice GF / on-ice SF. Successes=on-ice GF, trials=on-ice SF.
- IPP: individual points (G+A) / on-ice GF.
- Finishing residual (rate): goals_per_60 − ixG_per_60 (5v5 or all strengths per config). *Optional toggle.*
- Finishing residual (count): goals − ixG (window sum). *Optional toggle.*
- On-ice Save % (oiSV%): on-ice saves / on-ice shots against (used as regression indicator counterpart to oiSH%).

### 5.2 Stabilizer (Skill / Process) Metrics (MVP Active)
- ixG/60 (individual expected goals per 60)
- ICF/60 (individual Corsi For per 60)
- HDCF/60 (individual high-danger chances for per 60)

### 5.3 Potential Future Stabilizers (Toggled Off Initially)
- Shot volume (shots_per_game or shots/60)
- xGF% on-ice (quality share)
- SCF% on-ice (scoring chance share)

### 5.4 Standardization
Luck metrics standardized against player posterior baseline; stabilizers standardized vs position-season mean/σ (initial fixed constants → empirical later when toggle activated).

## 6. Non-Goals (Out of Scope MVP)
NG1. Goalie sustainability modeling.
NG2. Strength-state splits (5v5 vs PP) in base score (possible later extension).
NG3. Real-time mid-game updates.
NG4. Mobile-specific UI redesign.
NG5. Team context adjustment (capping oiSH% boost) — future toggle.

## 7. Design Considerations (UI/UX)
- Player list table: new column “Sustainability” (int 0–100) with color-coded badge tier (dynamic quantiles each night). 
- Tooltip on hover: component table (metric label, contrib, z_raw, z_soft, r, n).
- Sparkline mini-chart (last N scores) inline or on hover.
- Accessibility: color + numeric value (avoid color-only encoding).
- Tiers derived nightly via quantiles (e.g., Q0–Q1 High Risk, Q1–Q3 Neutral, Q3–Q5 Stable) but stored as quintile (0–4) for fast rendering.

## 8. Technical Considerations
- Runtime: Nightly Vercel cron trigger (Edge function → queue worker / serverless function) executing Postgres queries + transformation logic.
- DB: Supabase Postgres; prefer idempotent UPSERT patterns.
- Performance: Use set-based aggregation queries; minimize per-player round trips.
- Versioning: model_version increments on weight schema or feature inclusion changes; historical rows not rewritten unless manual backfill queued.
- Reliability weighting + soft clipping ensures bounded contribution while preserving ranking monotonicity.
- Config-driven toggles allow controlled feature rollout: finishing residuals ON at launch; team context OFF; strength splits OFF.

## 9. Scoring Formula

Let each component i have:
  z_raw_i = (observed_rate_i − baseline_i) / σ_i
  z_soft_i = c * tanh(z_raw_i / c)  (c=3)
  r_i = sqrt(n_i / (n_i + k_r_i))  (exposure reliability)
  contrib_i = w_i * (r_i * z_soft_i)

Score raw probability:
  S_raw = sigmoid( Σ_i contrib_i )
Persisted integer score:
  S = RoundedScore(S_raw)

Guardrails: if S_raw ≥0.995 → show 100; if ≤0.005 → show 0; else Math.round(S_raw*100).

Initial weights (subject to future logistic regression fit – config table override):
- SH%: -1.2
- oiSH%: -1.0
- oiSV%: -0.8
- IPP: -0.8
- Finishing residual (rate): -0.6 (if enabled)
- Finishing residual (count): -0.4 (if enabled)
- ixG/60: +0.9
- ICF/60: +0.7
- HDCF/60: +0.6
(Weights for disabled metrics ignored; stored for transparency.)

## 10. Data & Pipeline Steps

### 10.1 Nightly Batch Sequence
1. Load configuration (weights, toggles, constants, version).
2. Compute league×position seasonal aggregates (successes & trials) for SH%, oiSH%, IPP → derive μ and Beta priors (α0=μ*k, β0=(1−μ)*k) using k: SH% 200, oiSH% 800, IPP 60.
3. Upsert priors_cache rows.
4. Pull last three seasons per player (successes/trials for each stat) → apply weights 0.6/0.3/0.1 (renormalize if missing seasons) to produce successes_blend, trials_blend.
5. Apply Beta posterior: post_mean = (α0 + successes_blend)/(α0 + β0 + trials_blend) → upsert into player_priors_cache.
6. If initial constants phase active: ensure standard deviation constants loaded from static table (precomputed offline). If empirical phase toggle on: recompute position-season σ values.
7. Identify new games since last run (join `games` table + player game logs). For each player-game:
   a. Build rolling windows (5, 10) applying freshness filter (≤45 days).
   b. Aggregate window exposures & successes.
   c. Compute observed rates for luck metrics and process metrics.
   d. For each luck metric: z_raw vs posterior baseline; apply reliability & soft clip.
   e. For each stabilizer: z_raw vs position-season mean/σ; reliability uses appropriate exposure (e.g., minutes or attempts) — for MVP treat r=1 for stabilizers (or optional minute-based reliability if present; can log r=1 placeholder).
   f. Compute finishing residual metrics if toggle enabled.
   g. Assemble contribution list, sum → S_raw + S.
   h. Determine quintile assignment using previous night thresholds (or provisional if new distribution not yet built today).
   i. Persist record into model_player_game_barometers (one per player-game + window_type rows if materializing separate rows per window; or separate entries per window).
8. After all player-game computations: build distribution snapshot (percentiles: 1,5,10,25,50,75,90,95,99) and store.
9. Update quantile → tier mapping, recompute sustainability_quintile for *new* rows (previous rows remain for historical fidelity unless retro queue executed).
10. Log summary (counts, duration, extremes, failure list).
11. Enqueue retro recompute tasks if configuration version changed since last run or priors updated (async worker processes queue).

### 10.2 On-Demand (API Read)
1. Player summary endpoint fetches latest S (game, 5GRA, 10GRA, STD) precomputed rows.
2. Tooltip fetch uses stored JSON components (no recomputation).
3. Leaderboard endpoint filters by window_type & supports sorting and min/max thresholds.

## 11. Database Schema (DDL Suggestions)

```sql
-- League/position priors
CREATE TABLE IF NOT EXISTS priors_cache (
  season_id        INT NOT NULL,
  position_code    TEXT NOT NULL,        -- C, LW, RW, D
  stat_code        TEXT NOT NULL,        -- 'sh_pct','oish_pct','ipp'
  alpha0           DOUBLE PRECISION NOT NULL,
  beta0            DOUBLE PRECISION NOT NULL,
  k                INT NOT NULL,
  league_mu        DOUBLE PRECISION NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id, position_code, stat_code)
);

-- Player blended priors
CREATE TABLE IF NOT EXISTS player_priors_cache (
  player_id        BIGINT NOT NULL,
  season_id        INT NOT NULL,    -- target season
  position_code    TEXT NOT NULL,
  stat_code        TEXT NOT NULL,
  successes_blend  DOUBLE PRECISION NOT NULL,
  trials_blend     DOUBLE PRECISION NOT NULL,
  post_mean        DOUBLE PRECISION NOT NULL,
  rookie_status    BOOLEAN NOT NULL DEFAULT FALSE,
  model_version    INT NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, season_id, stat_code)
);

-- Sustainability per player window (one row per player per window_type per game_date)
CREATE TABLE IF NOT EXISTS model_player_game_barometers (
  id                    BIGSERIAL PRIMARY KEY,
  player_id             BIGINT NOT NULL,
  game_id               BIGINT,                 -- null for rolling windows if not tied to single game? keep for per-game
  game_date             DATE NOT NULL,
  season_id             INT NOT NULL,
  window_type           TEXT NOT NULL,          -- 'GAME','G5','G10','STD'
  sustainability_score  INT NOT NULL,
  sustainability_score_raw DOUBLE PRECISION NOT NULL,
  sustainability_quintile SMALLINT,             -- 0–4
  status                TEXT NOT NULL,          -- 'ok','provisional','missing_component'
  model_version         INT NOT NULL,
  config_hash           TEXT NOT NULL,
  components_json       JSONB NOT NULL,         -- array of component objects
  rookie_status         BOOLEAN NOT NULL DEFAULT FALSE,
  extreme_flag          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configuration table
CREATE TABLE IF NOT EXISTS model_sustainability_config (
  id              BIGSERIAL PRIMARY KEY,
  model_version   INT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  weights_json    JSONB NOT NULL,    -- {metric_code: weight}
  toggles_json    JSONB NOT NULL,    -- {use_finishing_residuals: true, cap_team_context: false, split_strengths: false}
  constants_json  JSONB NOT NULL,    -- {c:3, k_r:{sh_pct:50,oish_pct:150,ipp:30}}
  sd_mode         TEXT NOT NULL,     -- 'fixed' | 'empirical'
  freshness_days  INT NOT NULL DEFAULT 45,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Distribution snapshots
CREATE TABLE IF NOT EXISTS sustainability_distribution_snapshots (
  snapshot_date      DATE PRIMARY KEY,
  season_id          INT NOT NULL,
  model_version      INT NOT NULL,
  window_type        TEXT NOT NULL DEFAULT 'GAME',
  percentiles_json   JSONB NOT NULL,  -- {p01:..,p05:.., ...}
  stats_json         JSONB NOT NULL,  -- {mean:.., stdev:.., N:..}
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Retro recompute queue
CREATE TABLE IF NOT EXISTS sustainability_recompute_queue (
  id            BIGSERIAL PRIMARY KEY,
  player_id     BIGINT,
  season_id     INT,
  reason        TEXT NOT NULL,      -- 'config_change','data_backfill'
  status        TEXT NOT NULL DEFAULT 'pending',
  enqueued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);
```

## 12. Data Dictionary (Key Fields)
| Field | Description |
|-------|-------------|
| window_type | GAME (single game), G5 (5-game rolling), G10 (10-game rolling), STD (season cumulative) |
| components_json | JSON array: [{"metric":"sh_pct","z_raw":..,"z_soft":..,"r":..,"n":..,"weight":..,"contrib":..,"extreme":false}, ...] |
| config_hash | Hash of weights_json + toggles_json + constants_json for reproducibility |
| extreme_flag | True if any |z_raw|>5 among components |
| rookie_status | Derived from prior seasons absence |
| status | ok / provisional / missing_component |

## 13. Algorithmic Details

### 13.1 Priors Construction
For each stat_code S in {sh_pct, oish_pct, ipp} per season_id & position_code:
  league successes = Σ successes_S
  league trials = Σ trials_S
  μ = successes / trials
  α0 = μ * k_S ; β0 = (1-μ) * k_S

### 13.2 Player Multi-Season Blend
For player p and stat S over up to last 3 seasons (s0 current, s1 previous, s2 previous2):
  successes_blend = Σ w_i * successes_{s_i} (renormalize weights if seasons missing)
  trials_blend = Σ w_i * trials_{s_i}
Posterior mean: (α0 + successes_blend)/(α0 + β0 + trials_blend)

### 13.3 Z-Score (Luck Metrics)
z_raw = (observed_rate_window − post_mean) / σ_S
σ_S sourced from fixed constants table in MVP (pretrained), else empirical stdev over position-season distribution.

### 13.4 Reliability Weight
r = sqrt( n / (n + k_r) ) ; n = window trials for the metric.

### 13.5 Soft Clipping
z_soft = c * tanh(z_raw / c) (monotone, symmetric, rank preserving in finite z range).

### 13.6 Contribution
contrib_i = weight_i * (r_i * z_soft_i)

### 13.7 Final Score
S_raw = sigmoid( Σ contrib_i ) ; S = integer formatting (see FR12).

### 13.8 Handling Zero or Sparse Exposure
If n=0 (e.g., IPP when on-ice GF=0): set z_raw=0, z_soft=0, r=0, neutral flag; metric does not shift score.
Sparse but >0 exposures: small r tempers influence naturally.

## 14. Pseudo-Code (Nightly Pipeline)
```pseudo
function runNightlySustainabilityJob(targetSeason):
  cfg = loadActiveConfig()
  priors = buildLeaguePriors(targetSeason, cfg)
  upsertPriors(priors)

  playerBlends = buildPlayerBlendedCounts(targetSeason, lookbackSeasons=3)
  playerPosteriors = []
  for pb in playerBlends:
     prior = priors[pb.position_code][pb.stat_code]
     post_mean = (prior.alpha0 + pb.successes_blend) / (prior.alpha0 + prior.beta0 + pb.trials_blend)
     playerPosteriors.append({...pb, post_mean, model_version=cfg.model_version})
  upsertPlayerPosteriors(playerPosteriors)

  sigmaMap = loadSigmaConstants(cfg)  # fixed or empirical
  newGames = fetchNewGamesSinceLastRun()
  gameLogs = loadPlayerGameLogs(newGames)

  results = []
  for player in playersIn(gameLogs):
     windows = buildWindows(player, gameLogs[player], cfg.freshness_days)  # GAME, G5, G10, STD aggregates
     posteriorRowSet = indexPosteriors(player)
     for w in windows:
        components = []
        for metric in cfg.luck_metrics:
           obs_rate, trials = computeObserved(metric, w)
           posterior = posteriorRowSet[metric].post_mean
           sigma = sigmaMap[metric][player.position_code]
           if trials == 0 and metric == 'ipp':
              z_raw=0; r=0; z_soft=0; neutral=true
           else:
              z_raw = (obs_rate - posterior) / sigma
              r = sqrt(trials / (trials + k_r(metric)))
              z_soft = cfg.c * tanh(z_raw / cfg.c)
           contrib = cfg.weights[metric] * (r * z_soft)
           components.append(pack(metric))
        for metric in cfg.stabilizers_active:
           obs_rate, exposure = computeObserved(metric, w)
           mu = positionMean(metric, player.position_code)
           sigma = sigmaMap[metric][player.position_code]
           z_raw = (obs_rate - mu)/sigma
           r = 1  # or exposure-based later
           z_soft = cfg.c * tanh(z_raw / cfg.c)
           contrib = cfg.weights[metric] * (r * z_soft)
           components.append(pack(metric))
        if cfg.toggles.use_finishing_residuals:
           components += finishingResidualComponents(...)
        sumContrib = Σ component.contrib
        S_raw = sigmoid(sumContrib)
        S_int = formatScore(S_raw)
        quintile = assignQuintile(S_raw, previousSnapshot)
        status = deriveStatus(components)
        results.append(makeRow(player, w, S_raw, S_int, quintile, components, status, cfg))
  bulkInsertBarometer(results)

  snapshot = computeDistributionSnapshot(results where window_type='GAME')
  storeSnapshot(snapshot)
  logSummary(snapshot, results)
  enqueueRetroIfConfigChanged(cfg)
```

## 15. API Changes
- Extend existing player summary response: add { sustainability: { game: {score, raw, quintile}, g5: {...}, g10: {...}, std: {...} } }.
- New endpoint: GET /api/sustainability/leaderboard?window=G10&min_games=5&min_score=60 (returns paginated list with filtering).
- Player listing parameters: ?window=G5&min_score=50&rookies=only
- All endpoints return version + config_hash for debugging.

## 16. Observability & QA
- Logs: nightly summary (N players processed, duration, failure count, extreme count, percentile table).
- Assertions: scores in [0,100], components_json not empty, model_version matches active config.
- Outlier review: store any component |z_raw|>5 (extreme_flag).
- Random sample recompute: pick ~50 players nightly; recompute in-memory; diff tolerance <1e-9 in S_raw.
- Distribution drift: track mean & stdev; alert if stdev shifts >25% week-over-week.

## 17. Success Metrics
- Coverage: ≥ 98% of active skaters with non-provisional GAME score daily.
- Latency: player summary fetch p95 < 120ms including sustainability payload.
- Stability: <1% of GAME scores changing >15 points solely due to nightly recompute (excluding new games) → indicates deterministic pipeline.
- Adoption: sustainability column used in ≥30% of player listing page views (event instrumentation future).

## 18. Open Questions
1. Should we persist separate rows for each window type per game_date, or pack all window scores into a single JSON row? (Current design: separate rows — simpler indexing & filtering.)
2. When empirical σ mode activates, do we freeze σ for remainder of season once stable thresholds (min observations) reached? (Proposed: recompute weekly to reduce noise.)
3. Do we incorporate time-on-ice normalization for stabilizer reliability r in v1 (currently r=1)?
4. Finishing residual duplication risk: keep both rate & count, or pick one after initial evaluation?

## 19. Assumptions
- Training constants (σ for fixed mode) will be computed offline prior to feature launch and inserted manually or via migration.
- All necessary raw stat tables already replicated in warehouse with consistency by 06:00 UTC.
- PostgreSQL JSONB indexing available if needed for analytic queries on components.

## 20. Implementation Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Sparse early-season data inflates z | Noisy scores | Reliability weighting + soft clip; provisional status |
| Config drift without versioning | Non-reproducible history | model_version + config_hash stored per row |
| Performance degradation with retro recomputes | Cron overruns | Async queue with batch size throttling |
| Double counting luck metrics | Biased score | Explicit selection (no aggregated PDO) |
| Overfitting weights | Misleading ordering | Initial expert priors then logistic fit after N>5k samples |

## 21. Deployment Plan (High-Level)
1. Migrations: create schema tables (priors_cache, player_priors_cache, model_sustainability_config, etc.).
2. Insert initial model_sustainability_config (model_version=1, fixed σ mode).
3. Backfill priors & player_priors for current season.
4. Precompute first GAME-only sustainability run (no rolling yet) for validation.
5. Add rolling windows logic & recompute.
6. Validate distributions; adjust any extreme weight if >5% scores near 0 or 100.
7. Integrate API changes & UI column with tooltip + sparkline placeholder.
8. Enable finishing residuals toggle; monitor effect size.
9. Launch to authenticated users; gather feedback.
10. Consider enabling empirical σ mode after sample maturity threshold (e.g., 25 games into season).

## 22. Future Enhancements (Post-MVP)
- Strength splits (5v5, PP components) with aggregated sustainability or multi-context display.
- Team context modulation factor (discount extreme oiSH% if team baseline inflated).
- Goalies adaptation (different feature set: GSAA, rebound control, etc.).
- Bayesian dynamic shrink factors (learn k adaptively per stat & position).
- Feature importance dashboard (Shapley approximations) for stakeholder explanation.

## 23. Appendices
### 23.1 Metric Codes (Suggested)
| Human Label | Code |
|-------------|------|
| Shooting % | sh_pct |
| On-ice Shooting % | oish_pct |
| On-ice Save % | oisv_pct |
| Individual Point % | ipp |
| Finishing Residual (Rate) | finish_res_rate |
| Finishing Residual (Count) | finish_res_cnt |
| ixG/60 | ixg_per60 |
| ICF/60 | icf_per60 |
| HDCF/60 | hdcf_per60 |

### 23.2 Component JSON Example
```json
{
  "metric": "sh_pct",
  "z_raw": 2.84,
  "z_soft": 2.69,
  "r": 0.73,
  "n": 22,
  "weight": -1.2,
  "contrib": -2.36,
  "extreme": false
}
```

### 23.3 Score Formatting Function
```ts
function formatScore(raw: number): number {
  if (raw >= 0.995) return 100;
  if (raw <= 0.005) return 0;
  return Math.round(raw * 100);
}
```

---
Model Version: 1 (initial)  
Prepared for: Sustainability Barometer MVP  
Status: Draft Ready for Task Breakdown  
