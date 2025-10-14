# PRD Checklist — Sustainability Step 4: Window Scores

Date: 2025-10-12
Branch: `octoberBranch`

## Goal
Turn per-window EB z-scores and a set of skill stabilizers into a single, explainable 0–100 "Sustainability" score per player × snapshot_date × window.

---

## High-level plan (this PRD)
- Input: EB z's for proportion stats (SH%, oiSH%, IPP, PP SH%) computed per-window (L3/L5/L10/L20) in `sustainability_window_z` plus per-game stabilizer counts in `player_stats_unified`.
- Compute per-window stabilizer rates (ixG/60, ICF/60, HDCF/60) from game logs and standardize vs season×position league μ/σ from `player_totals_unified`.
- Mix luck (negative weights) and skill stabilizers (positive weights) into S_raw, apply sigmoid, scale to 0–100 and persist with components JSON for explainability.

---

## What we have accomplished (Done)
- Data model & migration
  - Added idempotent SQL migration: `migrations/20251001_add_sustainability_scores.sql` to create `sustainability_scores` table with indexes. (file added)

- Priors (Step 2)
  - `web/lib/sustainability/priors.ts` contains:
    - StatCode includes `shp`, `oishp`, `ipp`, `ppshp`.
    - Helpers to compute league pooled μ and Beta priors; player-season blended counts; upsert league and player priors.
  - Blending and Beta posterior logic implemented.

- Window z-scores (Step 3)
  - Implemented `web/lib/sustainability/windows.ts` (generalized):
    - Fetch priors per stat × position group.
    - Fetch per-player rolling counts (goals/shots, oi gf/sf, points/gf, pp goals/shots) via a single query.
    - Generic EB z calculation `ebZ_generic`.
    - Orchestrator `rebuildBetaWindowZForSnapshot` producing rows for `sustainability_window_z` and accepting stat filter.
  - API route `web/pages/api/v1/sustainability/rebuild-window-z.ts` updated to call the generalized function and accept optional `?stat=` filter.

- Score computation (Step 4)
  - New helper `web/lib/sustainability/score.ts` added:
    - `fetchSkillLeagueRef(season, pg)` reads `player_totals_unified` per-60 references (ixG/60, ICF/60, HDCF/60) and computes µ/σ.
    - `fetchSkillWindowRates(player, snapshot, n)` computes per-window rates from `player_stats_unified` (sum of metric / sum TOI → per60).
    - Clips skill z’s to ±3.
    - Mixes components with default weights (`DEFAULT_WEIGHTS`) and applies sigmoid → 0..100.
    - `upsertScores` to write to `sustainability_scores`.
  - New API route `web/pages/api/v1/sustainability/rebuild-score.ts`:
    - Batches via `?limit` & `?offset`, supports `?dry=1`.
    - Builds windows L3/L5/L10/L20 and returns sample rows.

- Build & basic verification
  - Next.js build ran successfully after adding the new files; routes are present in the build manifest including `/api/v1/sustainability/rebuild-score` and `/api/v1/sustainability/rebuild-window-z`.

---

## What is NOT done / Pending (To do)
- Run migration to create `sustainability_scores` in your production DB. (migration file added but not executed by code)
- Ensure `sustainability_priors` table contains league priors for all stats (especially `ppshp`) for the target `season_id` & position groups before running window/z rebuild. If priors are missing, `rebuildBetaWindowZForSnapshot` will skip missing priors.
- Populate `sustainability_window_z` for all desired stats (if you haven't already). The generalized window builder exists and can run for multiple stats; run it in dry mode first to confirm row counts.
- Run full end-to-end dry-run and then persist (manual steps below). Validate a few players by hand:
  - Confirm L5 ixG/60 equals 3600 * sum(nst_ixg) / sum(nst_toi) over last 5 games.
  - Confirm EB z's in `sustainability_window_z` match expectations for SH%/oiSH%/IPP/ppshp.
- Monitoring / performance
  - Current implementation queries per-player per-window. For large batches you may want to optimize by bulk-fetching recent N-game rows and computing windows in-process to reduce DB round-trips.
- Tests & CI
  - No automated unit tests added yet. Add at least one integration test that runs the score builder in dry mode for a synthetic snapshot (happy path + missing-priors path).
- PDO (planned for Step 4b)
  - PDO and other composites are intentionally deferred to keep this step focused.

---

## Acceptance checklist (how to validate)
- Preconditions
  - `player_totals_unified` has per-season per-player per-pos per60 fields: `nst_ixg_per_60`, `nst_icf_per_60`, `nst_hdcf_per_60`.
  - `player_stats_unified` has per-game rows with `nst_ixg`, `nst_icf`, `nst_hdcf`, `nst_toi`, plus the shooting fields used by window z (goals, shots, nst_oi_gf, nst_oi_sf, points_5v5, pp_goals, pp_shots).
  - `sustainability_priors`/`sustainability_window_z` exist and are populated for the snapshot/season or you will run their rebuild endpoints first.

- Quick smoke test (dry-run):

```
GET /api/v1/sustainability/rebuild-score?season=20242025&snapshot_date=2025-10-01&dry=1&limit=50
```

Expected:
- `rows_built` = `processed_players * 4` (L3/L5/L10/L20)
- `s_100` values appear centered around 40–60 with sensible outliers.
- `sample` includes a small set of component breakdowns including `z_shp`, `z_oishp`, `z_ipp`, `z_ppshp`, `z_ixg60`, `z_icf60`, `z_hdcf60` and `weights`.

- Persist after manual inspection:

```
GET /api/v1/sustainability/rebuild-score?season=20242025&snapshot_date=2025-10-01&limit=50
```

Then spot-check a few rows in `sustainability_scores` and cross-validate numbers against underlying tables.

---

## Files added in this work
- `migrations/20251001_add_sustainability_scores.sql` — idempotent DDL for `sustainability_scores`.
- `web/lib/sustainability/score.ts` — score builder, league refs, per-window per60 rates, component mix + upsert.
- `web/pages/api/v1/sustainability/rebuild-score.ts` — batch API route to build & persist scores.

(Other changes were made earlier in previous steps: `priors.ts`, `windows.ts`, `rebuild-window-z.ts`, `rebuild-priors.ts`, etc. — this PRD assumes those exist and are unchanged by this step.)

---

## Next recommended steps (prioritized)
1. Run the migration (or apply SQL) to create `sustainability_scores` in your DB.
2. Rebuild league priors and player priors for the target season if not already done:
   - `/api/v1/sustainability/rebuild-priors?season=20242025&dry=1`
   - inspect output, then run without `dry` to persist.
3. Rebuild window z's for the stats you care about (dry-run first):
   - `/api/v1/sustainability/rebuild-window-z?season=20242025&snapshot_date=2025-10-01&dry=1&limit=200`
   - If you want all stats: omit `?stat` or use `?stat=shp,oishp,ipp,ppshp`.
4. Run the score builder (dry-run), inspect samples, then persist.
5. Add a small integration test that runs steps 2→4 in dry mode and validates sizes and a few expected invariants.
6. (Optional) Performance: refactor window builder to bulk-fetch recent-game rows for a batch of players to reduce round-trips.
7. Add Step 4b (PDO) and expand weights + tuning lab.

---

## Assumptions & Notes
- The public/anon DB key cannot execute DDL safely; migrations should be applied using a privileged connection (CI or DBA).
- The score formula and weights are configurable via `DEFAULT_WEIGHTS` in `score.ts`.
- Skill μ/σ computed from `player_totals_unified` uses simple pooled sample mean and sample variance (N-1 denom). Sigma has a floor of `1e-6`.
- Skill z's are clipped to ±3 to avoid extreme influence.

---

If you'd like, I can:
- Add a small integration test and wire it into the repo's test runner.
- Add an ephemeral CLI script to run the full pipeline for a snapshot (dry & persist modes).
- Add a read-only dashboard query that returns latest scores per player.

