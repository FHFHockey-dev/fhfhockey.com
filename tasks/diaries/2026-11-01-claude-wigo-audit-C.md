# WiGO overhaul audit, lane C (calculated numbers), 2026-11-01

- Scope: read-only audit of every calculated number on wigoCharts; report at `tasks/artifacts/wigo-charts-overhaul-2026-11-01/audits/C.md`.
- Where: octoberBranch, no commits. Budget 20 prod SELECTs, logged in `audits/PROD-READ-LEDGER.md`.
- State: read the brief, old audits, writer, ratings, percentiles, DIFF. Next: client mapping, radar, drivers, then queries.
- Blockers: none.
- Gotchas: none yet.

- Checkpoint: 19 of 20 queries used; report written at audits/C.md. Pending: ask planning thread whether lane C may read nst_seasonal_* with the last query (extension in the brief names lane B only). If yes, confirm C-21/C-22/C-26 root cause and update C.md. If no, leave them marked as proven by effect.
- Gotcha: the writer's 240 s limit plus fixed id order starves ids above about 8483787; WGO and NST TOI agree on every joined row this season.

- Done: TJ approved the last read; used 20 of 20. C.md updated with confirmed causes: 215 skaters have no seasonal row, stale pre-trade rows are summed, zone-start columns are null. Next: the planning thread combines reports. Diary stays until the plan records the outcome.
