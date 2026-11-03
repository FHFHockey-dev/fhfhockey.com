# Diary: WiGO audit lane D (page-load performance), 2026-11-01

- **Scope:** read-only audit; measure WiGO page load waterfall, rank savings. No app changes, no git mutations.
- **Where:** report `tasks/artifacts/wigo-charts-overhaul-2026-11-01/audits/D.md`; screenshots `audits/screens/L1..L6*.png`; ledger lines D-L1..D-L6 in `audits/PROD-READ-LEDGER.md`. Capture script and raw JSON per load stay in the session scratchpad (not in the repo).
- **State:** done. 6 of 6 page loads used (1440x900, isolated dev :3217, production Supabase). Server stopped by exact PID (52889, parent 52866); planning thread told.
- **Checks run:** Playwright capture per load; code reads; baseline migration reads. No tests, no build, no EXPLAIN.
- **Next step:** planning thread folds D.md into the plan. Open questions for TJ: migrations for ES/PP/PK percentile views (finding D-01/D-02 in report), server-side cohort RPCs, proxy/season Cache-Control headers.
- **Blockers / approvals pending:** none for lane D.
- **Gotchas:** (1) L6 focus test was invalid: synthetic `visibilitychange` did not bubble to `window`, so A-07 runtime is unverified. (2) Ratings cohort retries 12 waves x 4 = 48 failed reads per view; loads 3-6 capped at 25 s to spare production. (3) `nst_percentile_{es,pp,pk}_*` are views over GROUP BY of game-log tables; only the `as` ones are tables and `as` has no 20262027 rows.
