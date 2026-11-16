# Read packet 2 receipt — 2026-11-15 01:58–02:01 UTC (TJ approved A–C)
Raw: `packet2/out/*`. URLs come from `packet2/urls.json` (page builders, parser-validated offline). Each call ran on its own and was checked before the next.

## A. Deployed GETs (fhfhockey.com @ 89da739cb): 3 of 5 sent; stopped on a 5xx
| # | View | HTTP | s | bytes | Result |
|---|---|---|---|---|---|
| A1 | skaters, page default (min_gp=10) | 200 | 5.92 | 211,866 | durable 11-11; 740 ranked / **582 qualified**; P/60 leader MacKinnon, 19 GP |
| A2 | goalies 2025-26 | 200 | 1.59 | 4,053 | **0 rows**; flags `partial_goalie_population_identity / _official_game_coverage / _population_reconciliation` |
| A3 | teams 2025-26 | **500** | 8.44 | 109 | Vercel log: "Unable to load team unit-TOI rows: canceling statement due to statement timeout" |

A4 (trending) and A5 (Metric Explorer) were **not sent** (stop rule).

## C. SQL: 4 calls (1 timeout)
- **C1:** `nst_team_5v5` from 09-29 holds only `5v5`: 622 rows = 311 games × 2, through 11-13. No legacy all-situation rows.
- **C2:** WGO goalies, 2025-26 regular season (2025-10-07..2026-04-16): **98 goalies, 2,768 rows, every row without `game_id`**. The reader (11-09 population patch) excludes rows with no game id, so the historical goalie view is empty. **Upstream data gap:** a `game_id` backfill is needed; this is not a reader drop.
- **C3a:** `team_unit_toi` by season/snapshot timed out at 5 s, the same symptom as A3.
- **C3b:** by `game_date ≥ 11-10`: snapshot 11-08 (893 rows, games through 11-10) and 11-13 (3,193 rows, games through 11-12). Power max is 11-14. `snapshot_date` is not a strict event cutoff, because nightly mode appends games to the current snapshot.
- **C4** (projection age) **skipped**: budget used. TJ already chose 7 days.

## B. Local fixed code (isolated :3110) against the prod DB
| # | Check | HTTP | s | Result |
|---|---|---|---|---|
| B1 | F13 team=EDM | 200 | 4.24 (was 21.05) | durable `entity_metric_rankings` 11-11; 23 ranked / 21 qualified, pool team 22; derived-pool and league-scope composite warnings; **0 null composites** (v3) |
| B2 | F13 position=D | 200 | 4.78 | durable 11-11; 255 ranked / 199 qualified, pool position/defense; 0 null composites |
| B3 | F14 snapshot of unpublished 8473533 | 200 | **0.54** (was >30) | "Selected skater is not in the published cohort for this context." (warm cache from B1/B2 likely helped) |
| B4 | goalie snapshot, traded 8482076 (Daws) | 200 | 1.20 | performance pooled across teams (7 GP / 6 GS / 154 SA); workload on latest team WPG (2/20 starts); notes explain both |
| B5 | team snapshot EDM | 200 | 8.84 | one build, available; style 11-11, power 11-14, coverage 20/20. Fails the 5 s target: the cost is the team build itself |
| B6 | W1 dry build (script, no upsert, no route, no audit) | — | 19.7 | **769 distinct skaters**, 17 metrics, snapshot 11-13, coverage verified, **all 24 previously omitted ids now included** |
