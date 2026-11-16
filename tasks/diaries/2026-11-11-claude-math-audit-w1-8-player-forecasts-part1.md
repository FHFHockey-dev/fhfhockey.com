# W1-8 math audit: player-forecasts-season-part1 (M-PFC-001–060)

- **Scope:** read-only audit; output `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/player-forecasts-season-part1.md`. No code changes.
- **Where:** octoberBranch, started at e56c5d635. Report committed on its own (see git log for the SHA).
- **State (2026-11-11):** done. 20 sound, 33 mis-specified, 5 wrong, 2 undetermined. No P0: nothing in the packet is served today.
- **Checks run:** bounded prod SQL only (catalog, row counts, ledger aggregates, one date-indexed goalie aggregate). No tests.
- **Next:** Chef consolidates; Astra peer review. Owner questions are in section 4 of the report.
- **Blockers:** none.
- **Gotchas:**
  - `player_forecast_season_*` tables and `native_forecast_catalog_heads` are empty in prod: season model and native means are not served.
  - `player_forecast_source_observations` is 71 MB of jsonb in ~740 rows; even a GROUP BY on payload keys detoasts all of it. Don't.
  - 2026-27 is an 84-game season; the "84 vs 82" lead is not a bug.
  - C19 (quality start) under-counts vs Vollman, not over; C16's "effective 8 games" is the weight sum, not the effective sample.
