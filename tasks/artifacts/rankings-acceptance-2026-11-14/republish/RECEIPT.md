# Current-season republish receipt (TJ approved by two separate pop-ups)

The writer ran on an isolated `next dev :3110`, served from the clean `git archive` export of release candidate 546d0a580. That tree equals master `baeb5df7f`. Calls were trusted only because they came from the local loopback (`invokedByLocalDev`); no secret was handled. Each route call wrote its normal cron-audit row.

## 1. entity_metric_rankings (2026-11-15 02:48–02:50 UTC)
- **Dry run:** 52,292 rows = 769 × 17 × 4. All 4 windows at 11-13, coverage verified, no unavailable metrics.
- **Write** (`dryRun=false`): HTTP 200, 65.9 s, **52,292 upserted**.
- **SQL check:** each window (season, last_5, last_10, last_20) at 11-13 holds 13,073 rows, **769 distinct skaters**, 17 metrics, and **24/24 previously omitted ids**.
- **Deployed checks:**
  - V1, page-default matrix: 200, 3.76 s, `entity_metric_rankings` 11-13, **769 ranked** / 584 qualified.
  - V2, snapshot `selected_player=8473533` (Jordan Staal, one of the 24): 200, 3.21 s, **available** at 11-13.

## Regression found and fixed: blank composites
**Cause.** V1 showed composites null on 10/10 rows. The matrix reads `skater_composite_ratings` at exactly the rankings snapshot date (`playerMatrix.ts:815`). Composites were still at 11-11. Chef's republish brief had said composites would stay unchanged; that missed the coupling.

**Fix (TJ approved composite republish):**
- A default-cutoff dry run would have landed at 11-14 (new rolling rows), so the run was pinned to `as_of_date=2026-11-13`.
- Dry run: 769 rows, ready, coverage verified.
- Write (2026-11-15 14:02:40 UTC): HTTP 200, 15.1 s, **769 upserted**.
- SQL: `contextual_composites_v3` at 11-13 holds 769 rows, 767 with MCM, 143 with a BEAST tier, and all 24 ids.
- Deployed V3, page-default matrix: 200, 3.64 s, 769 ranked, **0 null composites**, composite snapshot 11-13.

**Exposure:** production showed blank composites from about **02:50 to 14:03 UTC on 2026-11-15** (about 11 h).

**Lesson for any future republish:** publish rankings and composites at the same `as_of_date` in one session, or add a reader fallback.

## Not done (out of scope)
- Historical (2025-26) republish.
- Any recurring schedule.
- Cleanup of the 11-11 rows: they remain as the previous generation; the older v1 11-07 composite generation also remains.
