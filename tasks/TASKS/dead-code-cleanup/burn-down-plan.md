# Burn Down / Simplify sKO Predictions Pipeline (v2 Plan)

Date: 2025-09-28
Owner: (you)
Scope: Replace complex multi-horizon forward targets + recovery scripts with a lean, single-horizon (next-game) prediction pipeline and derived rollups. Keep UI intact but point it to simplified data sources.

---
## 1. Core Objectives
- Deliver reliable per-game (horizon=1) predictions for each player/stat.
- Derive multi-game (3/5/10/20) aggregates from stored per-game predictions instead of training separate forward-horizon models.
- Remove fragile recovery / backfill logic and forward target labeling complexity.
- Produce a smaller, auditable schema and minimal scripts (features, train, score, upload) under a new v2 namespace.
- Maintain legacy tables read-only until cutover confidence is achieved.

---
## 2. Current Pain Points
| Area | Issue | Impact |
|------|-------|--------|
| Forward horizons | Need future ground truth -> empty early-season labels | Complex flags, missing rows |
| Recovery scripts | Long-running, opaque batching | Wasted time, confusion |
| Mixed uniqueness & stat_key defaults | Required corrective migrations | Risk of silent overwrites |
| Manifest feature drift | Missing columns -> brittle scoring | Frequent manual intervention |
| UI multi-horizon logic | Recomputes actuals in browser, depends on forward rows | Hard to reason about |

---
## 3. Target Architecture (v2)
### Table: `predictions_next_game`
One row per (player_id, target_game_date, stat_key).

Columns (proposed):
- player_id (int, not null)
- anchor_date (date, not null) – last completed game / feature snapshot cutoff
- target_game_date (date, not null) – the game being predicted
- stat_key (text, not null) – e.g. points, goals, assists, shots, hits, blocked_shots, pp_points
- pred_mean (numeric) – expected count (next game)
- pred_p05/p25/p50/p75/p95 (numeric, nullable) – optional quantiles (later)
- model_version (text, not null)
- model_name (text, nullable)
- sko (numeric, nullable) – stability-adjusted or blended score if retained
- created_at (timestamptz default now())

Unique Index: (player_id, target_game_date, stat_key)

### Derived View: `v_predictions_next_game_rollup`
Roll sums of future games using window frame on ordered target_game_date per player/stat.

Example columns:
- player_id, target_game_date, stat_key
- sum_next3, sum_next5, sum_next10, sum_next20 (NULL if insufficient future prediction rows available)

(View definition can be refined after base table exists.)

### Minimal Scripts (all under `web/scripts/modeling_v2/`):
- `features_v2.py` – For each player: pull last N games (e.g. 30), compute rolling means/variance & schedule density, emit one latest feature row per player with `anchor_date` & next scheduled `target_game_date` (from schedule table).
- `train_v2.py` – Train 1 model per stat_key (predict next-game stat). Outputs: model pickle(s) + manifest (stat_keys, feature_columns, run_id, timestamp).
- `score_v2.py` – Load manifest + models, load latest features parquet, produce predictions for all stat_keys -> output parquet with tall schema.
- `upload_v2.py` – Upsert to `predictions_next_game` using unique key; optional batch size param.
- (Optional) `uncertainty_v2.py` – If adding quantiles via simple Poisson/Gamma or residual bootstrap later.

### UI Adaptations
- Player page: use `predictions_next_game` rows directly; no need to reconstruct game window for horizon=1.
- Multi-horizon toggle: query rollup view for aggregated sums (e.g., `sum_next5`) instead of forward-horizon predictions.
- Leaderboard: unchanged, but source aggregated SKO value from next-game predictions (points) or blended across stats if desired.

---
## 4. Migration Plan
1. Create migration: `migrations/20250928_create_predictions_next_game.sql`:
   ```sql
   BEGIN;
   CREATE TABLE IF NOT EXISTS predictions_next_game (
     player_id INT NOT NULL,
     anchor_date DATE NOT NULL,
     target_game_date DATE NOT NULL,
     stat_key TEXT NOT NULL,
     pred_mean NUMERIC,
     pred_p05 NUMERIC,
     pred_p25 NUMERIC,
     pred_p50 NUMERIC,
     pred_p75 NUMERIC,
     pred_p95 NUMERIC,
     model_version TEXT NOT NULL,
     model_name TEXT,
     sko NUMERIC,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY (player_id, target_game_date, stat_key)
   );

   CREATE OR REPLACE VIEW v_predictions_next_game_rollup AS
   WITH ordered AS (
     SELECT *,
       ROW_NUMBER() OVER (PARTITION BY player_id, stat_key ORDER BY target_game_date) AS seq
     FROM predictions_next_game
   )
   SELECT o.player_id,
          o.stat_key,
          o.target_game_date,
          SUM(o2.pred_mean) FILTER (WHERE o2.seq BETWEEN o.seq AND o.seq+2)  AS sum_next3,
          SUM(o2.pred_mean) FILTER (WHERE o2.seq BETWEEN o.seq AND o.seq+4)  AS sum_next5,
          SUM(o2.pred_mean) FILTER (WHERE o2.seq BETWEEN o.seq AND o.seq+9)  AS sum_next10,
          SUM(o2.pred_mean) FILTER (WHERE o2.seq BETWEEN o.seq AND o.seq+19) AS sum_next20
   FROM ordered o
   JOIN ordered o2 ON o.player_id = o2.player_id AND o.stat_key = o2.stat_key
   GROUP BY 1,2,3, o.seq;
   COMMIT;
   ```
2. Deploy migration.
3. Do NOT drop legacy tables yet.

---
## 5. Cutover Phases
| Phase | Goal | Actions | Exit Criteria |
|-------|------|---------|---------------|
| P0 | Groundwork | Add new table + scripts skeleton | Migration applied; scripts importable |
| P1 | Single stat test | Train & score just `points` | 1 row per player in new table; UI test page loads |
| P2 | Multi-stat expansion | Add remaining stat_keys | All 7 stat_keys populate for one run |
| P3 | Rollup integration | Implement rollup view & UI toggle | Player page shows aggregated horizons |
| P4 | Validation | Compare legacy vs v2 horizon=1 predictions distribution | Acceptable error deltas |
| P5 | UI cutover | Feature flag toggle to use v2 endpoints | No user-facing regressions |
| P6 | Decommission | Archive or drop unused legacy scripts | Observability in place |

---
## 6. Data Backfill Strategy (v2)
Because v2 only stores next-game predictions:
- Historical backfill optional. If desired, iterate chronological anchor_dates:
  1. Build features up to date D.
  2. Score next-game predictions (target_game_date = first game after D).
  3. Insert.
- Simplify by limiting backfill to current season start + forward.

---
## 7. Model Simplicity (Initial)
- Use LightGBM or Gradient Boosted Trees with minimal hyperparameter search.
- Features: rolling mean (5/10/20), rolling std/coef variation, simple schedule density (games in last 7/14 days, days since last game, games next 7 days).
- No SHAP / feature contributions in first pass.

---
## 8. Uncertainty (Defer)
Options when needed:
- Poisson assumption (lambda = pred_mean) → derive quantiles.
- Empirical residual quantiles from validation splits.
- Keep columns nullable until implemented.

---
## 9. Frontend Refactor Checklist
| Component/Page | Change |
|----------------|--------|
| PlayerTrendPage | Replace dual builders with: horizon=1 direct mapping; multi-horizon from rollup view. Remove buildWindowTrendData. |
| TrendsIndexPage | Use new table for latest run detection (max target_game_date OR max anchor_date). |
| PredictionsLeaderboard | Query v2 table (points stat_key) for primary list. |
| SearchBox | Unchanged. |
| MetricCards | Recompute metrics client-side or build minimal `predictions_next_game_metrics` later. |
| Stepper | Replace step-forward POST with daily batch run trigger (optional). |

---
## 10. Deletion Candidates (After Cutover)
- `predictions_sko` (+ uncertainty, metrics) tables (archive first)
- Scripts: `backfill_missing_h1.py`, `recover_missing_stat_keys.py`, forward-horizon portions of `features.py`, horizon loops in `score.py`
- Complex env flags: `SKO_FEATURE_KEEP_LATEST_UNLABELED`, `SKO_SCORE_FILL_MISSING`, `SKO_SCORE_MULTI_STAT`, etc.

---
## 11. Risk Mitigation
| Risk | Mitigation |
|------|------------|
| Schema mismatch | Introduce type assertion test that loads parquet → dict keys map to table columns |
| Performance regression | Limit features to ~<150 columns initially; profile scoring time |
| UI break during toggle | Use feature flag `PREDICTIONS_V2_ENABLED` and dual-fetch logic |
| Data drift vs legacy | Run parallel daily horizon=1 scoring for 3 days and compare MAE/RMSE |

---
## 12. Rollback Plan
- Keep legacy scripts & cron wired until P4 sign-off.
- If v2 fails: disable feature flag, continue legacy ingestion (no schema changes needed).
- Preserve migration order; no destructive drops until P6.

---
## 13. Initial Task Breakdown (Actionable)
1. Add migration file (as above).
2. Scaffold `modeling_v2/` with empty: `features_v2.py`, `train_v2.py`, `score_v2.py`, `upload_v2.py`, `__init__.py`.
3. Implement minimal features extraction (points, goals, assists, shots, hits, blocked_shots, pp_points + rolling means + schedule density).
4. Implement one-model training (points) + manifest.
5. Implement scoring for points → insert into new table.
6. Expand to all stat_keys.
7. Add rollup view columns & validate window sums.
8. Create feature flag in UI and dual fetch branch.
9. Remove legacy horizon>1 UI logic; adapt per-game chart to use target_game_date directly (no inference logic needed for future boundaries besides actual null vs predicted).
10. Parallel run comparison script (legacy vs v2) → generate diff summary.

---
## 14. Open Questions
- Do we keep `sko` (stability multiplier) or recompute on the fly from recent variance? (Decision pending.)
- Should target_game_date be derived from team schedule table or player_stats_unified next row? (Recommend schedule table to allow future projections; fallback = next actual game row for historical backfill.)
- Are we retaining multi-stat within same model (multi-output) or one model per stat? (Recommend one per stat for clarity.)

---
## 15. Acceptance Criteria
- A. New table populated for at least 90% active skaters with horizon=1 predictions for current date.
- B. Player page loads solely from v2 data behind feature flag with parity (± small tolerance) to legacy horizon=1 predicted values.
- C. Rollup view returns non-null sums once enough future prediction rows exist.
- D. No runtime errors in logs after 48h dual-run.
- E. Legacy tables not mutated during validation (except normal ingestion).

---
## 16. Next Immediate Step
Implement migration + scaffolding (Tasks 1–2), then move to minimal feature + points-only pipeline (Task 3–5).

---
_End of Plan_
