# Read packet 3 receipt — 2026-11-15 02:12–02:13 UTC (TJ approved all three)
Raw: `packet2/out/P3-*`. Each call ran on its own; no stop rule tripped.

| # | Call | HTTP | s | Result |
|---|---|---|---|---|
| A1 | deployed trending (page default) | 200 | **19.86** | rolling fallback, 11-13, 25 rows, 89 KB. Fires on every skater page load. Just under the 20 s stop |
| A2 | deployed Metric Explorer (G/60, min_gp=10) | 200 | 2.25 | durable 11-11, 100 rows. **Parity with the deployed matrix (A1 of packet 2): 10/10 overlapping skaters identical** in value, rank, percentile and peers (582) |
| SQL | `pg_indexes` on team_unit_toi | — | — | `idx_team_unit_toi_latest (season_id, snapshot_date DESC, unit_type, team_id, unit_number)` and 4 others exist in production |
| SQL | EXPLAIN (no ANALYZE) of the F15 query, 2025-26 | — | — | BitmapOr of two `idx_team_unit_toi_latest` scans (power_play; unit_number=1); about 5.3k estimated rows vs about 198k in the season. No new index needed (planner estimate, not timing) |
| B1 | local fixed code, teams 2025-26 | 200 | 2.53 | 32 teams (deployed: **500**). **Unit usage empty** (F9 cap hides the post-season snapshot), so F9 is amended to in-progress seasons only. Style: 0 style games, coverage 66/82 incomplete (open; separate source) |
| B2 | local fixed code, teams current | 200 | 2.38 | 32 teams; **unit usage values and team order identical to deployed d4** (F15 changes no output) |

## Parity reads (TJ approved, 02:23 UTC): local fixed code vs saved deployed responses
- **PAR1, page-default skaters:** 4.67 s. Compared with deployed A1: 200 field differences, all F13 additions. 10 rows × 19 `rankScopes.deployment` go from null to filled (e.g. L1, 97 peers), plus 2 new composite scope fields per row. **Every value, rank and percentile in the current and overall scopes is unchanged**, as are row order and composites.
- **PAR2, current goalies:** 1.07 s. **0 differences** from deployed d3.
- **PAR3, McDavid snapshot (page defaults):** 3.22 s. Identical to his fixed table row, and equal to his deployed A1 row apart from the F13 additions.

Side check: W1's dry-build path has no write calls. The only write is `upsertEntityMetricRankingRows` (`entityMetricRankingWriter.ts:353`), which the script never called; the `.delete` hits in `rankingQueries.ts` are in-memory Map deletes. F11 leaves the BEAST/composite and entity writers unchanged, because both routes send an explicit `min_gp` (default 1) and an explicit value always wins over `window`.
